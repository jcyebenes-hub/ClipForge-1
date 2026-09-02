/**
 * API Route: /api/youtube/transcribir
 * Obtiene la transcripción REAL de un vídeo de YouTube a partir de sus
 * subtítulos (manuales o automáticos) usando el paquete 'youtube-transcript'
 * (Node puro, sin binarios externos ni workers).
 *
 * Devuelve la misma estructura TranscriptionPayload que /api/transcribir
 * para que el resto del pipeline (ventanas, análisis viral, SRT…) funcione igual.
 */

import { YoutubeTranscript } from 'youtube-transcript';
import { sanitizarTitulo } from '@/src/lib/sanitizer';

interface CaptionEntry {
  text: string;
  duration: number; // ms
  offset: number;   // ms
  lang?: string;
}

export interface YoutubeTranscriptPayload {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;
  words: Array<{ word: string; start: number; end: number }>;
  provider: 'youtube-captions';
  fuente: string;
  url_youtube: string;
  video_id?: string;
}

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

const IDIOMAS_PREFERIDOS = ['es', 'es-419', 'es-ES', 'es-US', 'es-MX', 'en', 'pt'];

/** Normaliza el idioma corto de YouTube (p.ej. "es-419" -> "es") */
function idiomaCorto(lang?: string): string {
  if (!lang) return 'es';
  const base = lang.split('-')[0].toLowerCase();
  if (['es', 'en', 'pt', 'fr', 'it', 'de', 'ca', 'gl', 'eu', 'hi', 'ja', 'ko', 'zh'].includes(base)) {
    return base;
  }
  return lang.toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = body?.url || '';

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL de YouTube requerida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const videoId = extractYoutubeId(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'No se pudo identificar el ID del vídeo de YouTube.', code: 'BAD_URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Intentar obtener subtítulos en español y otros idiomas
    let entries: CaptionEntry[] = [];
    let langUsado = '';
    let errUltimo = '';

    for (const lang of IDIOMAS_PREFERIDOS) {
      try {
        const res = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        if (res && res.length > 0) {
          entries = res as unknown as CaptionEntry[];
          langUsado = lang;
          break;
        }
      } catch (e: any) {
        errUltimo = String(e?.message || e);
      }
    }

    // 2. Último intento: transcripción por defecto (la que YouTube elija)
    if (entries.length === 0) {
      try {
        const res = await YoutubeTranscript.fetchTranscript(videoId);
        if (res && res.length > 0) {
          entries = res as unknown as CaptionEntry[];
          langUsado = entries[0]?.lang || '';
        }
      } catch (e: any) {
        errUltimo = String(e?.message || e);
      }
    }

    if (entries.length === 0) {
      const motivo = errUltimo.includes('disabled') || errUltimo.toLowerCase().includes('unavailable')
        ? 'Este vídeo no tiene subtítulos disponibles (ni manuales ni automáticos). YouTube no genera subtítulos automáticos si el audio no tiene voz clara o el creador los desactivó.'
        : errUltimo.slice(0, 300);
      return new Response(
        JSON.stringify({
          error: `No se pudo obtener la transcripción de YouTube. ${motivo}`,
          code: 'NO_CAPTIONS',
          video_id: videoId,
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Construir la estructura estándar de transcripción
    const segments: YoutubeTranscriptPayload['segments'] = [];
    const words: YoutubeTranscriptPayload['words'] = [];

    entries.forEach((e, idx) => {
      const texto = sanitizarTitulo(e.text || '', 600).trim();
      if (!texto) return;
      const start = Number(((e.offset || 0) / 1000).toFixed(3));
      const end = Number((((e.offset || 0) + (e.duration || 3000)) / 1000).toFixed(3));

      // Aproximar marcas por palabra repartiendo el tiempo uniformemente
      const palabras = texto.split(/\s+/).filter(Boolean);
      const wordSeg = end - start || 1;
      const wordsSeg: Array<{ word: string; start: number; end: number }> = [];
      let wTime = start;
      for (const p of palabras) {
        const wDur = wordSeg / Math.max(palabras.length, 1);
        wordsSeg.push({
          word: p,
          start: Number(wTime.toFixed(3)),
          end: Number((wTime + wDur * 0.95).toFixed(3)),
        });
        wTime += wDur;
      }
      words.push(...wordsSeg);

      segments.push({ id: idx, start, end, text: texto, words: wordsSeg });
    });

    if (segments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'La transcripción obtenida está vacía.', code: 'EMPTY' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const duracionTotal = segments[segments.length - 1].end;
    const textCompleto = segments.map((s) => s.text).join(' ');

    const payload: YoutubeTranscriptPayload = {
      task: 'transcribe',
      language: idiomaCorto(langUsado || 'es'),
      duration: duracionTotal,
      text: sanitizarTitulo(textCompleto, 12000),
      segments,
      words,
      provider: 'youtube-captions',
      fuente: 'subtítulos de YouTube (auto o manual)',
      url_youtube: url,
      video_id: videoId,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error en /api/youtube/transcribir:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error obteniendo la transcripción de YouTube', code: 'YT_TRANSCRIBE_ERROR' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
