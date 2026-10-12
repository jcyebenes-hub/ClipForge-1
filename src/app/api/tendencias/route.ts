/**
 * API Route: /api/tendencias — descubrimiento por palabra clave (Fase 2).
 *
 * Dada una palabra clave, busca los Shorts más vistos de los últimos N días en una
 * región/idioma y devuelve los mismos patrones que /api/competencia, más los
 * "canales calientes" (menos de 1 año de vida, ordenados por suscriptores/día), que
 * son los que crecen por formato y no por inercia.
 *
 * Misma llamada que la herramienta de referencia (shorts/trends.py):
 *   search.list part=id q type=video videoDuration=short order=viewCount
 *               publishedAfter regionCode relevanceLanguage
 *
 * ⚠️ CUOTA: search.list cuesta 100 unidades. Con el límite gratuito de 10.000/día
 * eso son ~100 búsquedas al día. Por eso aquí se hace UNA sola búsqueda por petición.
 *
 * Clave: YOUTUBE_API_KEY (servidor).
 */

import { analizarVideos, metricasCanal, type MetricaCanal, type YTVideo } from '@/src/lib/analisisYoutube';
import {
  puedeBuscar,
  registrarBusqueda,
  busquedasHoy,
  limiteUsuario,
  BUSQUEDAS_GLOBALES_MAX_DIA,
} from '@/src/lib/cuotaYoutube';

/**
 * IP del que llama, para poder limitar también a quien no tiene sesión.
 * Versión mínima y local: la de lib/rateLimit.ts hace lo mismo pero importa el
 * cliente de Supabase, y eso impediría probar esta ruta en Node.
 */
function ipDeRequest(req: Request): string {
  const h = req.headers;
  const cf = h.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return h.get('x-real-ip') || 'desconocida';
}

export const runtime = 'nodejs';

const YT = 'https://www.googleapis.com/youtube/v3';
const MAX_SHORT_SEG = 180;

function isoDuracionASegundos(iso?: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

async function ytFetch(path: string, params: Record<string, string | undefined>, key: string) {
  const url = new URL(`${YT}/${path}`);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`YouTube ${path} ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
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
    const palabraClave = String(body.palabraClave ?? '').trim();
    if (!palabraClave) return Response.json({ error: 'Indica una palabra clave.' }, { status: 400 });

    // --- Cuota de YouTube -------------------------------------------------
    // Una búsqueda cuesta 102 unidades y Google da 10.000 al día para TODA la
    // aplicación. Se comprueba antes de llamar a YouTube: gastar unidades y
    // luego rechazar la petición sería tirar el dinero.
    const identificador = String(body.user_id ?? '').trim() || ipDeRequest(req);
    const plan = String(body.plan ?? '').trim() || null;
    const usadas = busquedasHoy(identificador);
    const veredicto = puedeBuscar({
      globalesHoy: usadas.globales,
      usuarioHoy: usadas.usuario,
      plan,
    });
    if (!veredicto.ok) {
      return Response.json(
        {
          error: veredicto.mensaje,
          code: 'CUOTA_YOUTUBE',
          motivo: veredicto.motivo,
          busquedasRestantes: 0,
        },
        { status: 429 }
      );
    }

    const dias = Math.min(180, Math.max(7, Number(body.dias) || 30));
    // 'GLOBAL' busca sin filtro de país ni de idioma. Sirve para cazar tendencias
    // en inglés meses antes de que lleguen al mercado hispano.
    const sinFiltro = String(body.region ?? '').trim().toUpperCase() === 'GLOBAL';
    const region = sinFiltro ? '' : String(body.region ?? 'ES').slice(0, 2).toUpperCase();
    const idioma = sinFiltro ? '' : String(body.idioma ?? 'es').slice(0, 10);
    const orden: 'contribucion' | 'rendimiento' = body.orden === 'rendimiento' ? 'rendimiento' : 'contribucion';

    const despues = new Date(Date.now() - dias * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');

    // 1) UNA búsqueda (100 unidades de cuota).
    const busca: any = await ytFetch(
      'search',
      {
        part: 'id',
        q: palabraClave,
        type: 'video',
        videoDuration: 'short',
        order: 'viewCount',
        publishedAfter: despues,
        regionCode: region || undefined,
        relevanceLanguage: idioma || undefined,
        maxResults: '50',
      },
      key
    );
    const ids = [...new Set((busca?.items ?? []).map((it: any) => it?.id?.videoId).filter(Boolean))] as string[];
    if (ids.length) registrarBusqueda(identificador);
    if (!ids.length) {
      return Response.json(
        { error: `No se encontraron Shorts de «${palabraClave}» en los últimos ${dias} días.`, informe: null },
        { status: 404 }
      );
    }

    // 2) Estadísticas de los vídeos (1 unidad por lote de 50).
    const vd: any = await ytFetch('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') }, key);
    const videos: YTVideo[] = [];
    for (const v of vd?.items ?? []) {
      const dur = isoDuracionASegundos(v.contentDetails?.duration);
      if (dur <= 0 || dur > MAX_SHORT_SEG) continue;
      videos.push({
        id: v.id,
        titulo: v.snippet?.title ?? '',
        publicado: v.snippet?.publishedAt ?? new Date().toISOString(),
        duracionSeg: dur,
        vistas: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comentarios: Number(v.statistics?.commentCount ?? 0),
        etiquetas: v.snippet?.tags ?? [],
        canal: v.snippet?.channelTitle ?? '',
        canalId: v.snippet?.channelId ?? '',
      });
    }
    if (!videos.length) {
      return Response.json({ error: 'La búsqueda devolvió vídeos, pero ninguno era un Short (≤3 min).', informe: null }, { status: 404 });
    }

    // 3) Métricas de los canales implicados (1 unidad).
    const chIds = [...new Set(videos.map((v) => v.canalId).filter(Boolean))] as string[];
    const mapaCanales: Record<string, MetricaCanal> = {};
    for (let i = 0; i < chIds.length; i += 50) {
      const cd: any = await ytFetch('channels', { part: 'snippet,statistics', id: chIds.slice(i, i + 50).join(',') }, key);
      for (const c of cd?.items ?? []) {
        const st = c.statistics ?? {};
        mapaCanales[c.id] = metricasCanal({
          id: c.id,
          nombre: c.snippet?.title ?? c.id,
          subs: st.hiddenSubscriberCount ? 0 : Number(st.subscriberCount ?? 0),
          vistasTotales: Number(st.viewCount ?? 0),
          videos: Number(st.videoCount ?? 0),
          creado: c.snippet?.publishedAt ?? new Date().toISOString(),
        });
      }
    }

    const informe = analizarVideos(videos, { periodoDias: dias, canales: mapaCanales, orden });
    return Response.json({
      informe,
      analizados: videos.length,
      palabraClave,
      region: region || 'GLOBAL',
      idioma: idioma || null,
      sinFiltro,
      costeCuota: 102, // search(100) + videos(1) + channels(1)
      busquedasRestantes: Math.max(0, limiteUsuario(plan) - busquedasHoy(identificador).usuario),
      busquedasGlobalesRestantes: Math.max(
        0,
        BUSQUEDAS_GLOBALES_MAX_DIA - busquedasHoy(identificador).globales
      ),
    });
  } catch (e: any) {
    console.error('[tendencias] Error:', e);
    return Response.json({ error: e?.message ?? 'Error interno' }, { status: 500 });
  }
}
