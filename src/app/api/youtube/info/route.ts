/**
 * API Route: /api/youtube/info
 * Obtiene metadatos REALES de un video de YouTube (título, autor, duración, miniatura)
 * sin depender de workers externos:
 *   1. API interna youtubei/v1/player (cliente ANDROID) → título/autor/duración reales.
 *   2. Fallback: oEmbed oficial + parseo de la página del vídeo.
 * Ya NO devuelve datos ficticios simulados.
 */

import { probarClientes } from '@/src/lib/youtubeApi';

export interface YoutubeInfoResponse {
  titulo: string;
  autor: string;
  duracion_seg: number;
  miniatura: string;
  videoId?: string;
  embeddable?: boolean;
  fuente: 'youtube-real' | 'mock';
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function extraerNumero(html: string, clave: string, maxLen = 60): number | null {
  const idx = html.indexOf(clave);
  if (idx === -1) return null;
  const trozo = html.slice(idx, idx + maxLen);
  const match = trozo.match(/"(\d+)"/) || trozo.match(/:(\d+)/) || trozo.match(/(\d+)/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return isFinite(num) ? num : null;
}

// Cache simple en memoria (10 min) para no golpear YouTube con cada petición
const cacheInfo = new Map<string, { info: YoutubeInfoResponse; expira: number }>();

/**
 * Obtiene metadatos reales de YouTube. Nunca devuelve datos ficticios:
 * si no puede obtenerlos, lanza un Error con mensaje claro.
 */
export async function fetchYoutubeInfo(url: string): Promise<YoutubeInfoResponse> {
  const videoId = extractYoutubeId(url);
  if (!videoId) {
    throw new Error('No se pudo identificar el ID del vídeo de YouTube en la URL.');
  }

  const cacheado = cacheInfo.get(videoId);
  if (cacheado && cacheado.expira > Date.now()) {
    return cacheado.info;
  }

  // 1. API interna (varios clientes) → título/autor/duración
  let titulo = '';
  let autor = '';
  let duracion = 0;
  try {
    const p = await probarClientes(videoId);
    titulo = p.titulo;
    autor = p.autor;
    duracion = p.duracion_seg;
  } catch (err) {
    console.warn('[YT info] API interna no disponible, uso fallback oEmbed:', (err as Error)?.message);
  }

  // 2. Fallback: oEmbed + página del vídeo
  if (!titulo) {
    try {
      const oe = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) }
      );
      if (oe.ok) {
        const data = await oe.json();
        titulo = data.title || '';
        autor = data.author_name || '';
      }
    } catch {
      /* seguimos */
    }
  }
  if (!duracion) {
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=es`, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' },
        signal: AbortSignal.timeout(15000),
      });
      const html = await res.text();
      const ms = extraerNumero(html, '"approxDurationMs"');
      const secs = extraerNumero(html, '"lengthSeconds"');
      duracion = Math.round((ms ? ms / 1000 : secs) || 0);
    } catch {
      /* duración 0 → se recalculará con la transcripción real */
    }
  }

  if (!titulo || !autor) {
    throw new Error(
      'YouTube no devolvió la información del vídeo. Comprueba que el enlace es correcto y el vídeo es público.'
    );
  }

  const info: YoutubeInfoResponse = {
    titulo,
    autor,
    duracion_seg: duracion,
    miniatura: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoId,
    embeddable: true,
    fuente: 'youtube-real',
  };

  cacheInfo.set(videoId, { info, expira: Date.now() + 10 * 60 * 1000 });
  return info;
}

// Mantenemos la firma de datos "de prueba" exportada por compatibilidad con otros
// módulos que la importen, pero ya NO se usa en el flujo real.
export function getMockYoutubeInfo(url: string): YoutubeInfoResponse {
  const videoId = extractYoutubeId(url) || 'dQw4w9WgXcQ';
  return {
    titulo: 'Video de YouTube',
    autor: 'Canal de YouTube',
    duracion_seg: 0,
    miniatura: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoId,
    embeddable: true,
    fuente: 'mock',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || '';

  if (!url) {
    return new Response(JSON.stringify({ error: 'URL requerida (?url=...)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const info = await fetchYoutubeInfo(url);
    return new Response(JSON.stringify(info), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.warn('[YT info]', err.message);
    return new Response(
      JSON.stringify({
        error: err.message || 'No se pudo obtener información real del vídeo de YouTube.',
        code: 'YT_INFO_FAILED',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = body?.url || '';
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL requerida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const info = await fetchYoutubeInfo(url);
    return new Response(JSON.stringify(info), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Cuerpo de solicitud inválido', code: 'YT_INFO_FAILED' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
