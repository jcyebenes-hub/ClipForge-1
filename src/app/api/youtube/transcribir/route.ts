/**
 * API Route: /api/youtube/transcribir
 * Obtiene la transcripción REAL de un vídeo de YouTube a partir de sus subtítulos
 * (manuales o automáticos).
 *
 * Estrategia por capas:
 *   1. Intento directo: API interna youtubei/v1/player (clientes ANDROID/IOS…).
 *   2. Si YouTube bloquea la IP del servidor (anti-bot) o no hay subtítulos y existe
 *      YT_CAPTIONS_WORKER_URL (p. ej. un Worker de Cloudflare con IP no bloqueada),
 *      se delega la petición a ese servicio.
 *
 * Devuelve la misma estructura que /api/transcribir para que el pipeline siga igual.
 */

import { sanitizarTitulo } from '@/src/lib/sanitizer';
import { logEventoServer } from '@/src/lib/telemetria';
import {
  probarClientes,
  fetchVttCapitulos,
  parseVttATranscripcion,
} from '@/src/lib/youtubeApi';

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const raw = String(url).trim();
  const idOk = (s: string | null | undefined): string | null =>
    s && /^[\w-]{11}$/.test(s) ? s : null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') return idOk(u.pathname.slice(1).split('/')[0]);
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host.endsWith('.youtube.com')) {
      const v = idOk(u.searchParams.get('v'));
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      const known = ['shorts', 'live', 'embed', 'v'];
      if (parts.length >= 2 && known.includes(parts[0])) return idOk(parts[1]);
      return idOk(parts[parts.length - 1]);
    }
    return null;
  } catch {
    const m = raw.match(/[\w-]{11}/);
    return m ? m[0] : null;
  }
}

const ORDEN_IDIOMAS = ['es', 'es-419', 'es-ES', 'es-US', 'es-MX', 'en', 'pt', 'ca'];

function idiomaCorto(lang?: string): string {
  if (!lang) return 'es';
  return lang.split('-')[0].toLowerCase();
}

/** Normaliza la respuesta del Worker (misma forma que la respuesta directa) */
function normalizarWorkerPayload(p: any): any {
  const segs = Array.isArray(p?.segments) ? p.segments : [];
  const words = Array.isArray(p?.words) ? p.words : [];
  const duracion = Number(p?.duration) || (segs.length ? segs[segs.length - 1]?.end || 0 : 0);
  return {
    task: 'transcribe',
    language: idiomaCorto(p?.language || 'es'),
    duration: Number(duracion.toFixed(2)),
    text: sanitizarTitulo(String(p?.text || segs.map((s: any) => s.text).join(' ')).slice(0, 16000), 16000),
    segments: segs.map((s: any, i: number) => ({
      id: i,
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: sanitizarTitulo(String(s.text || ''), 600),
      words: Array.isArray(s.words)
        ? s.words.map((w: any) => ({
            word: sanitizarTitulo(String(w.word || ''), 50),
            start: Number(w.start) || 0,
            end: Number(w.end) || 0,
          }))
        : [],
    })),
    words: words.map((w: any) => ({
      word: sanitizarTitulo(String(w.word || ''), 50),
      start: Number(w.start) || 0,
      end: Number(w.end) || 0,
    })),
    provider: 'youtube-captions',
    fuente: p?.fuente || 'subtítulos de YouTube (vía Worker)',
    url_youtube: p?.url_youtube || '',
    video_id: p?.video_id || undefined,
    titulo_video: p?.titulo_video ? sanitizarTitulo(String(p.titulo_video), 300) : undefined,
  };
}

/** Delegación al Worker externo (IP no bloqueada por YouTube) */
async function transcribirViaWorker(url: string): Promise<{ payload?: any; error?: string; code?: string }> {
  const workerUrl = process.env.YT_CAPTIONS_WORKER_URL || '';
  if (!workerUrl) return { error: 'YT_CAPTIONS_WORKER_URL no configurado', code: 'NO_WORKER' };
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Secreto compartido opcional: si el Worker define WORKER_SECRET, la app debe
    // enviar la misma clave en YT_CAPTIONS_WORKER_SECRET para autorizarse.
    const secret = process.env.YT_CAPTIONS_WORKER_SECRET || '';
    if (secret) headers['x-worker-secret'] = secret;
    const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/transcribir`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.ok || (Array.isArray(data?.segments) && data.segments.length > 0))) {
      return { payload: normalizarWorkerPayload(data) };
    }
    return { error: data?.error || `Worker devolvió ${res.status}`, code: data?.code || 'WORKER_ERROR' };
  } catch (err: any) {
    return { error: String(err?.message || err).slice(0, 200), code: 'WORKER_UNREACHABLE' };
  }
}

/** Intento directo (sin worker) */
async function transcribirDirecto(url: string, videoId: string, debug: boolean): Promise<Response> {
  // 1. Pedir info de reproducción + pistas de subtítulos (probando clientes).
  // pot:true → si todo falla y hay provider POT, intenta WEB+POT (salta LOGIN_REQUIRED).
  const player = await probarClientes(videoId, { pot: true });
  const tracks = player.captionTracks || [];

  // 2. Elegir la mejor pista (español primero)
  let track: any = null;
  for (const lang of ORDEN_IDIOMAS) {
    track = tracks.find((t: any) => t.languageCode === lang);
    if (track) break;
  }
  if (!track) track = tracks[0];

  const debugPayload = debug
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
    : undefined;

  const blockedJson = (code: string, error: string, status: number) =>
    new Response(JSON.stringify({ error, code, video_id: videoId, debug: debugPayload }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (!track) {
    const bloqueadoPorYoutube =
      player.intentos.length > 0 &&
      player.intentos.every(
        (i) =>
          !i.titulo &&
          (i.statusApi === 'LOGIN_REQUIRED' ||
            i.statusApi === 'ERROR' ||
            i.razon === 'HTTP 400' ||
            i.razon === 'HTTP 403')
      );
    if (bloqueadoPorYoutube) {
      return blockedJson(
        'YT_BOT_BLOCKED',
        'YouTube ha bloqueado el acceso desde este servidor (protección anti-bots para IPs de la nube). El vídeo puede tener subtítulos, pero YouTube no permite leerlos desde aquí.',
        422
      );
    }
    const restringido =
      player.intentos.some((i) => i.statusApi === 'UNPLAYABLE') ||
      player.intentos.some((i) => i.statusApi === 'LOGIN_REQUIRED' && i.razon?.includes('edad'));
    return blockedJson(
      restringido ? 'VIDEO_RESTRICTED' : 'NO_CAPTIONS',
      restringido
        ? 'Este vídeo está restringido (privado, por edad o con límites de país) y no se puede transcribir.'
        : 'Este vídeo no tiene subtítulos disponibles (ni manuales ni automáticos).',
      422
    );
  }

  // 3. Descargar VTT
  let vtt = '';
  try {
    vtt = await fetchVttCapitulos(track.baseUrl);
  } catch (err: any) {
    console.warn('[YT transcribir] Error descargando subtítulos:', err?.message);
    return blockedJson('CAPTIONS_DOWNLOAD_FAILED', 'No se pudo descargar la pista de subtítulos del vídeo.', 502);
  }

  // 4. Parsear a segmentos con palabras
  const { segmentos, palabras } = parseVttATranscripcion(vtt, track.languageCode || 'es');

  if (segmentos.length === 0) {
    return blockedJson('EMPTY', 'La pista de subtítulos del vídeo está vacía.', 422);
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
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = body?.url || '';
    const debug = body?.debug === 1 || body?.debug === true;

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

    // YouTube bloquea de forma INTERMITENTE las IPs de servidor, así que reintentamos
    // el ciclo (directo + Worker) unas veces antes de rendirnos. Solo se reintenta en
    // códigos que pueden ser bloqueo transitorio, nunca en errores definitivos
    // (BAD_URL, VIDEO_RESTRICTED, etc.).
    const INTENTOS = 3;
    const REINTENTABLES = new Set([
      'YT_BOT_BLOCKED', 'NO_CAPTIONS', 'WORKER_UNREACHABLE', 'WORKER_ERROR',
      'EMPTY', 'CAPTIONS_DOWNLOAD_FAILED',
    ]);
    let finalJson: any = null;
    let finalStatus = 502;
    let youtubeBloqueado = false; // ¿YouTube bloqueó nuestra IP en algún intento directo?

    for (let intento = 1; intento <= INTENTOS; intento++) {
      // Capa 1: intento directo
      const directo = await transcribirDirecto(url, videoId, debug);
      if (directo.status === 200) {
        logEventoServer('transcripcion_youtube', { video_id: videoId, via: 'directo' });
        return directo;
      }
      const directoJson = await directo.json().catch(() => ({}));
      if (directoJson?.code === 'YT_BOT_BLOCKED') youtubeBloqueado = true;
      finalJson = directoJson;
      finalStatus = directo.status;

      // Capa 2: si falló y hay Worker configurado, delega
      if (process.env.YT_CAPTIONS_WORKER_URL) {
        const workerRes = await transcribirViaWorker(url);
        if (workerRes.payload) {
          logEventoServer('transcripcion_youtube', { video_id: videoId, via: 'worker' });
          return new Response(JSON.stringify(workerRes.payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        console.warn(`[YT transcribir] intento ${intento}: Worker también falló:`, workerRes.code, workerRes.error);
        // Si el fallo directo fue por bloqueo de IP y el worker respondió, mostramos su error
        if (directoJson.code === 'YT_BOT_BLOCKED' && workerRes.code && workerRes.code !== 'NO_WORKER') {
          finalJson = {
            error: workerRes.error || directoJson.error,
            code: workerRes.code || 'WORKER_ERROR',
            video_id: videoId,
          };
          finalStatus = 422;
        }
      }

      const reintentable = REINTENTABLES.has(finalJson?.code);
      if (!reintentable || intento === INTENTOS) break;
      // Pausa creciente antes del siguiente intento (1.5s, 3s)
      await new Promise((r) => setTimeout(r, 1500 * intento));
    }

    // `directo` ya tuvo su body consumido por directo.json(); no podemos devolverlo
    // tal cual (el adaptador de server.ts volvería a leerlo y lanzaría "body used").
    // Reconstruimos la respuesta con el status y el JSON del último intento.
    // Señal fiable de bloqueo: si YouTube bloqueó nuestra IP en el intento directo,
    // lo marcamos aunque el Worker haya devuelto otro código (p. ej. NO_CAPTIONS),
    // para que el front muestre el aviso correcto y ofrezca subir el archivo.
    if (finalJson && typeof finalJson === 'object' && youtubeBloqueado) {
      finalJson = { ...finalJson, bloqueado_por_youtube: true };
    }
    logEventoServer(
      youtubeBloqueado ? 'youtube_bloqueado' : 'youtube_fallo',
      { video_id: videoId, code: finalJson?.code || null }
    );
    return new Response(JSON.stringify(finalJson), {
      status: finalStatus,
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
