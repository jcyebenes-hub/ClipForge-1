/**
 * API Route: /api/youtube/transcribir
 * Obtiene la transcripción REAL de un vídeo de YouTube a partir de sus subtítulos
 * (manuales o automáticos) usando la API interna de YouTube (cliente ANDROID) y
 * descargando la pista en VTT con marcas de tiempo.
 *
 * NO usa la página web (bloqueada desde IPs de servidor) ni genera contenido simulado.
 * Devuelve la misma estructura que /api/transcribir para que el pipeline siga igual.
 */

import { sanitizarTitulo } from '@/src/lib/sanitizer';
import {
  probarClientes,
  fetchVttCapitulos,
  parseVttATranscripcion,
} from '@/src/lib/youtubeApi';

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

const ORDEN_IDIOMAS = ['es', 'es-419', 'es-ES', 'es-US', 'es-MX', 'en', 'pt', 'ca'];

function idiomaCorto(lang?: string): string {
  if (!lang) return 'es';
  const base = lang.split('-')[0].toLowerCase();
  return base;
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

    // 1. Pedir info de reproducción + pistas de subtítulos (probando clientes)
    const player = await probarClientes(videoId);
    const tracks = player.captionTracks || [];
    const debug = body?.debug === 1 || body?.debug === true;

    // 2. Elegir la mejor pista (español primero)
    let track: any = null;
    for (const lang of ORDEN_IDIOMAS) {
      track = tracks.find((t: any) => t.languageCode === lang);
      if (track) break;
    }
    if (!track) track = tracks[0];

    if (!track) {
      return new Response(
        JSON.stringify({
          error:
            'Este vídeo no tiene subtítulos disponibles (ni manuales ni automáticos). YouTube no genera subtítulos automáticos si el audio no tiene voz clara, el vídeo es musical o el creador los desactivó.',
          code: 'NO_CAPTIONS',
          video_id: videoId,
          debug: debug
            ? player.intentos.map((i) => ({
                cliente: i.cliente,
                httpOk: i.httpOk,
                statusApi: i.statusApi || undefined,
                razon: i.razon || undefined,
                playable: i.playable,
                numPistas: i.numPistas,
                conTitulo: Boolean(i.titulo),
                duracionApi: i.duracion_seg || 0,
              }))
            : undefined,
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Descargar VTT
    let vtt = '';
    try {
      vtt = await fetchVttCapitulos(track.baseUrl);
    } catch (err: any) {
      console.warn('[YT transcribir] Error descargando subtítulos:', err?.message);
      return new Response(
        JSON.stringify({
          error: 'No se pudo descargar la pista de subtítulos del vídeo.',
          code: 'CAPTIONS_DOWNLOAD_FAILED',
          video_id: videoId,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parsear a segmentos con palabras
    const { segmentos, palabras } = parseVttATranscripcion(vtt, track.languageCode || 'es');

    if (segmentos.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'La pista de subtítulos del vídeo está vacía.',
          code: 'EMPTY',
          video_id: videoId,
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const duracionTotal = segmentos[segmentos.length - 1].end;
    const textCompleto = segmentos.map((s) => s.text).join(' ');

    const payload = {
      task: 'transcribe',
      language: idiomaCorto(track.languageCode || 'es'),
      duration: Number(duracionTotal.toFixed(2)),
      text: sanitizarTitulo(textCompleto, 16000),
      segments: segmentos.map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        text: sanitizarTitulo(s.text, 600),
        words: s.words || [],
      })),
      words: palabras,
      provider: 'youtube-captions',
      fuente: 'subtítulos de YouTube (API interna, con marcas por palabra)',
      url_youtube: url,
      video_id: videoId,
      titulo_video: sanitizarTitulo(player.titulo || '', 300) || undefined,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error en /api/youtube/transcribir:', err);
    return new Response(
      JSON.stringify({
        error: err.message || 'Error obteniendo la transcripción de YouTube',
        code: 'YT_TRANSCRIBE_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
