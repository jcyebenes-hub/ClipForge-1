/**
 * API Route: /api/competencia — análisis de competencia/tendencias (Fase 2).
 *
 * Lee canales de YouTube, descarga sus vídeos de los últimos N días y extrae los
 * patrones de los que mejor rinden (duración, palabras de título, cadencia) con el
 * motor de analisisYoutube.ts. SOLO LECTURA sobre la API de YouTube (clave en servidor).
 *
 * Clave: YOUTUBE_API_KEY (Google Cloud → YouTube Data API v3). Si falta, responde 503
 * con instrucciones. Cuota por análisis: ~3 unidades por canal (muy por debajo del
 * límite gratuito de 10.000/día).
 */

import { analizarVideos, metricasCanal, type MetricaCanal, type YTVideo } from '@/src/lib/analisisYoutube';

export const runtime = 'nodejs';

const YT = 'https://www.googleapis.com/youtube/v3';

function isoDuracionASegundos(iso?: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

/** Extrae un channelId (UC...) o un handle (@...) de cualquier entrada. */
function parseCanal(input: string): { id?: string; handle?: string } {
  const raw = input.trim();
  if (!raw) return {};
  if (/^UC[\w-]{20,}$/.test(raw)) return { id: raw };
  const mUrl = raw.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i);
  if (mUrl) return { id: mUrl[1] };
  const mHandle = raw.match(/(?:youtube\.com\/)?@([A-Za-z0-9._-]{2,})/i);
  if (mHandle) return { handle: '@' + mHandle[1] };
  if (raw.startsWith('@')) return { handle: raw };
  return { handle: raw.startsWith('@') ? raw : '@' + raw };
}

async function ytFetch(path: string, params: Record<string, string>, key: string) {
  const url = new URL(`${YT}/${path}`);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`YouTube ${path} ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

interface CanalCrudo {
  id: string;
  nombre: string;
  subs: number;
  vistasTotales: number;
  videos: number;
  creado: string;
}

async function canalAId(entrada: string, key: string): Promise<CanalCrudo | null> {
  const { id, handle } = parseCanal(entrada);
  const params: Record<string, string> = { part: 'contentDetails,snippet,statistics' };
  if (id) params.id = id;
  else if (handle) params.forHandle = handle;
  else return null;
  const data = await ytFetch('channels', params, key);
  const c = data?.items?.[0];
  if (!c) return null;
  const st = c.statistics ?? {};
  return {
    id: c.id,
    nombre: c.snippet?.title ?? handle ?? id ?? 'canal',
    subs: st.hiddenSubscriberCount ? 0 : Number(st.subscriberCount ?? 0),
    vistasTotales: Number(st.viewCount ?? 0),
    videos: Number(st.videoCount ?? 0),
    creado: c.snippet?.publishedAt ?? new Date().toISOString(),
  };
}

async function videosDelCanal(canalId: string, nombre: string, dias: number, key: string): Promise<YTVideo[]> {
  const ch = await ytFetch('channels', { part: 'contentDetails', id: canalId }, key);
  const uploads = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  const desde = Date.now() - dias * 86400000;
  const ids: string[] = [];
  let pageToken: string | undefined;
  // Máx. 2 páginas (100 vídeos) por canal para controlar la cuota.
  for (let pag = 0; pag < 2; pag++) {
    const pl: any = await ytFetch(
      'playlistItems',
      { part: 'contentDetails', playlistId: uploads, maxResults: '50', ...(pageToken ? { pageToken } : {}) },
      key
    );
    for (const it of pl?.items ?? []) {
      const publicado = it?.contentDetails?.videoPublishedAt;
      if (publicado && new Date(publicado).getTime() >= desde) ids.push(it.contentDetails.videoId);
    }
    pageToken = pl?.nextPageToken;
    if (!pageToken || ids.length >= 100) break;
  }
  if (!ids.length) return [];

  const out: YTVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const lote = ids.slice(i, i + 50);
    const vd: any = await ytFetch(
      'videos',
      { part: 'snippet,statistics,contentDetails', id: lote.join(',') },
      key
    );
    for (const v of vd?.items ?? []) {
      out.push({
        id: v.id,
        titulo: v.snippet?.title ?? '',
        publicado: v.snippet?.publishedAt ?? new Date().toISOString(),
        duracionSeg: isoDuracionASegundos(v.contentDetails?.duration),
        vistas: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comentarios: Number(v.statistics?.commentCount ?? 0),
        etiquetas: v.snippet?.tags ?? [],
        canal: nombre,
        canalId,
      });
    }
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      return Response.json(
        {
          error:
            'Falta YOUTUBE_API_KEY. Créala gratis en Google Cloud (APIs → YouTube Data API v3 → Credenciales → Clave de API) y añádela en Render > Environment.',
        },
        { status: 503 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const canales: string[] = Array.isArray(body.canales)
      ? body.canales.filter((c: unknown) => typeof c === 'string' && c.trim()).slice(0, 5)
      : typeof body.canales === 'string'
        ? body.canales.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
        : [];
    const dias = Math.min(180, Math.max(7, Number(body.dias) || 90));
    // Solo Shorts por defecto: sin este filtro entran vídeos de 20-60 min y
    // contaminan el ranking (los largos acumulan vistas y siempre ganan).
    // YouTube admite Shorts de hasta 3 minutos, así que ese es el umbral.
    const soloShorts = body.soloShorts !== false;
    const MAX_SHORT_SEG = 180;
    if (!canales.length) return Response.json({ error: 'Indica al menos un canal (@handle o URL).' }, { status: 400 });

    const todos: YTVideo[] = [];
    const errores: string[] = [];
    const mapaCanales: Record<string, MetricaCanal> = {};
    for (const c of canales) {
      try {
        const res = await canalAId(c, key);
        if (!res) {
          errores.push(`No se encontró el canal «${c}».`);
          continue;
        }
        mapaCanales[res.id] = metricasCanal(res);
        const vids = await videosDelCanal(res.id, res.nombre, dias, key);
        todos.push(...(soloShorts ? vids.filter((v) => v.duracionSeg > 0 && v.duracionSeg <= MAX_SHORT_SEG) : vids));
      } catch (e: any) {
        errores.push(`«${c}»: ${e?.message ?? 'error'}`);
      }
    }

    if (!todos.length) {
      return Response.json(
        {
          error: soloShorts
            ? 'No se encontraron Shorts (≤3 min) en ese periodo para esos canales. Prueba con más días o desactiva «Solo Shorts».'
            : 'No se encontraron vídeos en el periodo para esos canales.',
          errores,
          informe: null,
        },
        { status: 404 }
      );
    }

    const informe = analizarVideos(todos, { periodoDias: dias, canales: mapaCanales });
    return Response.json({ informe, errores, analizados: todos.length });
  } catch (e: any) {
    console.error('[competencia] Error:', e);
    return Response.json({ error: e?.message ?? 'Error interno' }, { status: 500 });
  }
}
