/**
 * API Route: /api/transcribir
 * Recibe un archivo de audio (form-data o raw) y lo transcribe con el modelo
 * whisper-large-v3-turbo de Groq con marcas de tiempo a nivel de palabra y segmento.
 * 
 * LA CLAVE GROQ_API_KEY SE MANTIENE 100% SEGURA EN EL SERVIDOR Y NUNCA SE EXPONE AL NAVEGADOR.
 */

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscriptionSegment {
  id: number;
  seek?: number;
  start: number;
  end: number;
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
  words?: TranscriptionWord[];
}

export interface TranscriptionResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: TranscriptionSegment[];
  words: TranscriptionWord[];
  provider?: 'groq-whisper' | 'simulated-fallback';
}

/**
 * Genera transcripción con marcas de tiempo realistas para desarrollo o fallback
 */
// (eliminado) generateRealisticTranscription: generaba transcripciones FICTICIAS y se
// devolvían como reales. Si Groq falla, la ruta ahora devuelve un error honesto.

import { verificarRateLimit, obtenerIpDeRequest } from '@/src/lib/rateLimit';
import { sanitizarTitulo } from '@/src/lib/sanitizer';
import { logEventoServer } from '@/src/lib/telemetria';

export async function POST(request: Request) {
  try {
    const ip = obtenerIpDeRequest(request);
    
    // Parse formData or request payload
    let audioBlob: Blob | null = null;
    let language = 'es';
    let prompt = '';
    let userId: string | null = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') || formData.get('audio');
      if (file && typeof file === 'object') {
        audioBlob = file as Blob;
      }
      if (formData.get('language')) {
        language = String(formData.get('language'));
      }
      if (formData.get('prompt')) {
        prompt = sanitizarTitulo(String(formData.get('prompt')), 200);
      }
      if (formData.get('user_id')) {
        userId = String(formData.get('user_id'));
      }
    } else {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 0) {
        audioBlob = new Blob([buffer], { type: 'audio/mp3' });
      }
    }

    // 1. Rate Limiting Protection (5 transcripciones / hora)
    const rateCheck = await verificarRateLimit('transcribir', userId, ip);
    if (!rateCheck.permitido) {
      return new Response(
        JSON.stringify({
          error: rateCheck.mensaje || 'Límite de transcripciones alcanzado (máx. 5/hora).',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateCheck.reseteoEnSegundos,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.reseteoEnSegundos),
          },
        }
      );
    }

    // Sin audio no hay nada que transcribir: error claro (antes caía al fallback falso).
    if (!audioBlob || audioBlob.size === 0) {
      return new Response(
        JSON.stringify({ error: 'No se recibió ningún archivo de audio para transcribir.', code: 'SIN_AUDIO' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    // Call Groq API if API key exists and audioBlob is valid with 60s AbortController timeout
    if (groqApiKey && audioBlob && audioBlob.size > 0) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      try {
        const groqFormData = new FormData();
        groqFormData.append('file', audioBlob, 'audio.mp3');
        groqFormData.append('model', 'whisper-large-v3-turbo');
        groqFormData.append('response_format', 'verbose_json');
        groqFormData.append('timestamp_granularities[]', 'word');
        groqFormData.append('timestamp_granularities[]', 'segment');
        if (language) {
          groqFormData.append('language', language);
        }
        if (prompt) {
          groqFormData.append('prompt', prompt);
        }

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: groqFormData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (groqRes.ok) {
          const data = await groqRes.json();
          
          // Format segments and words to guarantee unified structure & sanitize strings
          const segments: TranscriptionSegment[] = (data.segments || []).map((s: any, idx: number) => ({
            id: s.id ?? idx,
            start: Number(s.start) || 0,
            end: Number(s.end) || 0,
            text: sanitizarTitulo(s.text || '', 500),
            words: (s.words || []).map((w: any) => ({
              ...w,
              word: sanitizarTitulo(w.word || '', 50),
            })),
          }));

          const words: TranscriptionWord[] = data.words 
            ? data.words.map((w: any) => ({ ...w, word: sanitizarTitulo(w.word || '', 50) }))
            : segments.flatMap(s => s.words || []);

          const responsePayload: TranscriptionResponse = {
            task: data.task || 'transcribe',
            language: data.language || 'spanish',
            duration: Number(data.duration) || (segments.length ? segments[segments.length - 1].end : 60),
            text: sanitizarTitulo(data.text || segments.map(s => s.text).join(' '), 5000),
            segments,
            words,
            provider: 'groq-whisper',
          };

          logEventoServer('transcripcion_whisper', { provider: 'groq-whisper' });
          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          const errText = await groqRes.text();
          console.warn(`[Groq Whisper API] Error ${groqRes.status}: ${errText}`);
          // Fall through to fallback
        }
      } catch (groqError: any) {
        clearTimeout(timeoutId);
        if (groqError.name === 'AbortError') {
          console.warn('[Groq Whisper API] La petición a Groq excedió el tiempo límite de 60s y fue abortada.');
        } else {
          console.error('[Groq Whisper API] Request failed:', groqError);
        }
      }
    }

    // Groq no disponible, falló o dio timeout: NO inventamos una transcripción.
    // Devolvemos un error claro para que el usuario lo sepa y pueda reintentar.
    logEventoServer('transcripcion_whisper_fallo', { motivo: 'groq_no_disponible_o_fallo' });
    return new Response(
      JSON.stringify({
        error: 'No se pudo transcribir el audio en este momento. Inténtalo de nuevo en unos instantes.',
        code: 'TRANSCRIPCION_NO_DISPONIBLE',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error in /api/transcribir:', err);
    return new Response(
      JSON.stringify({
        error: err.message || 'Error al procesar transcripción',
        code: 'TRANSCRIPCION_ERROR',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
