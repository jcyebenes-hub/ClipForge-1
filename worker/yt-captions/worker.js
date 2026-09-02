// ClipForge — Cloudflare Worker para subtítulos de YouTube.
//
// ¿Por qué? Render (IP de centro de datos) es bloqueado por la protección
// anti-bots de YouTube al pedir subtítulos. Este Worker hace la misma petición
// desde la red de Cloudflare y devuelve el resultado a la app.
//
// Usa el MISMO método que la app (InnerTube + fmt=vtt), que ya funciona, en vez
// de scrapear la página watch (cuyo timedtext viene vacío por el "POT token").
//
// Contrato (lo consume src/app/api/youtube/transcribir/route.ts):
//   POST {WORKER_URL}/transcribir { url } ->
//     OK:   { ok:true, segments:[{start,end,text,words}], words, language, duration, text, titulo_video, video_id, url_youtube }
//     ERROR:{ ok:false, error, code }
//   GET  {WORKER_URL}/health -> { ok:true }
//
// Seguridad opcional: si defines el secreto WORKER_SECRET, el Worker exige la
// cabecera `x-worker-secret` (la app la envía si configuras YT_CAPTIONS_WORKER_SECRET).

const UA_BASE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const CLIENTES = [
  { name: 'ANDROID', ver: '20.10.35', key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w' },
  { name: 'ANDROID', ver: '19.09.37', key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w' },
  { name: 'IOS', ver: '19.45.4', key: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc' },
  { name: 'MWEB', ver: '2.20250310.01.00', key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8' },
  { name: 'TVHTML5', ver: '7.20250101.14.00', key: 'AIzaSyDCU8hByM-X4KzVa9oG9ZZlGpPlfY0WuNw' },
];

function userAgentPara(c) {
  if (c.name === 'ANDROID') return `com.google.android.youtube/${c.ver} (Linux; U; Android 12; es_ES) gzip`;
  if (c.name === 'IOS') return `com.google.ios.youtube/${c.ver} (iPhone14,3; U; CPU iOS 17_2 like Mac OS X;)`;
  return UA_BASE;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-worker-secret',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export function extractId(u) {
  if (!u) return null;
  const raw = String(u).trim();
  const idOk = (s) => (s && /^[\w-]{11}$/.test(s) ? s : null);
  try {
    const x = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    const host = x.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') return idOk(x.pathname.slice(1).split('/')[0]);
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host.endsWith('.youtube.com')) {
      const v = idOk(x.searchParams.get('v'));
      if (v) return v;
      const parts = x.pathname.split('/').filter(Boolean);
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

function aSegundos(h, m, s, ms) {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

async function consultarCliente(videoId, cliente) {
  const body = {
    context: {
      client: {
        clientName: cliente.name,
        clientVersion: cliente.ver,
        hl: 'es',
        gl: 'ES',
        ...(cliente.name === 'IOS' ? { deviceMake: 'Apple', deviceModel: 'iPhone14,3' } : {}),
      },
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${cliente.key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': userAgentPara(cliente), 'Accept-Language': 'es-ES,es;q=0.9' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { numPistas: 0, pistas: [] };
    const d = await res.json();
    const vd = d?.videoDetails || {};
    const pistas = d?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return {
      titulo: vd.title || '',
      duracion_seg: Number(vd.lengthSeconds) || 0,
      numPistas: pistas.length,
      pistas,
    };
  } catch {
    return { numPistas: 0, pistas: [] };
  }
}

export async function obtenerPistas(videoId) {
  for (const cliente of CLIENTES) {
    const r = await consultarCliente(videoId, cliente);
    if (r.numPistas > 0) return r;
  }
  return { titulo: '', duracion_seg: 0, numPistas: 0, pistas: [] };
}

async function fetchVtt(baseUrl) {
  let u = String(baseUrl || '').replace(/\\u0026/g, '&').replace(/&amp;/g, '&').trim();
  if (u.startsWith('/')) u = 'https://www.youtube.com' + u;
  let base = u.includes('fmt=')
    ? u.replace(/fmt=[a-z0-9]+/i, 'fmt=vtt')
    : `${u}${u.includes('?') ? '&' : '?'}fmt=vtt`;
  const res = await fetch(base, {
    headers: { 'User-Agent': UA_BASE, 'Accept-Language': 'es-ES,es;q=0.9' },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Subtítulos devolvieron ${res.status}`);
  return res.text();
}

export function parseVtt(vtt) {
  // Vía 1: automáticos con marcas por palabra (<c>)
  const marcadas = [];
  const re = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})><c>\s*([^<]+)/g;
  let m;
  while ((m = re.exec(vtt)) !== null) {
    const w = m[5].trim();
    if (w) marcadas.push({ t: aSegundos(m[1], m[2], m[3], m[4]), w });
  }
  if (marcadas.length >= 10) {
    const segmentos = [];
    const palabras = [];
    for (let i = 0; i < marcadas.length; i += 9) {
      const g = marcadas.slice(i, i + 9);
      if (!g.length) continue;
      const start = g[0].t;
      const end = Math.min(g[g.length - 1].t + 1.5, start + 18);
      const dur = end - start || 1;
      const ws = [];
      let wt = start;
      for (const x of g) {
        const wd = dur / g.length;
        ws.push({ word: x.w, start: +wt.toFixed(3), end: +(wt + wd * 0.95).toFixed(3) });
        wt += wd;
      }
      palabras.push(...ws);
      segmentos.push({ start: +start.toFixed(3), end: +end.toFixed(3), text: g.map((x) => x.w).join(' '), words: ws });
    }
    return { segmentos, palabras };
  }
  // Vía 2: cues planos
  const cues = [];
  const bre = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})[^\n]*\n([\s\S]*?)(?=\n\n|$)/g;
  let bm;
  while ((bm = bre.exec(vtt)) !== null) {
    const start = aSegundos(bm[1], bm[2], bm[3], bm[4]);
    const end = aSegundos(bm[5], bm[6], bm[7], bm[8]);
    const text = (bm[9] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) cues.push({ start, end, text });
  }
  const segmentos = [];
  const palabras = [];
  let ant = '';
  for (const cue of cues) {
    if (cue.text === ant) continue;
    ant = cue.text;
    const ps = cue.text.split(/\s+/).filter(Boolean);
    const dur = Math.max(cue.end - cue.start, 0.4);
    const ws = [];
    let wt = cue.start;
    for (const p of ps) {
      const wd = dur / Math.max(ps.length, 1);
      ws.push({ word: p, start: +wt.toFixed(3), end: +(wt + wd * 0.95).toFixed(3) });
      wt += wd;
    }
    palabras.push(...ws);
    segmentos.push({ start: +cue.start.toFixed(3), end: +cue.end.toFixed(3), text: cue.text, words: ws });
  }
  return { segmentos, palabras };
}

function pickTrack(tracks) {
  return (
    tracks.find((t) => /^es/.test(t.languageCode || '') && t.kind !== 'asr') ||
    tracks.find((t) => /^es/.test(t.languageCode || '') && t.kind === 'asr') ||
    tracks.find((t) => t.kind !== 'asr') ||
    tracks[0] ||
    null
  );
}

export async function transcribir(videoId) {
  const { titulo, duracion_seg, pistas } = await obtenerPistas(videoId);
  if (!pistas.length) return { ok: false, code: 'NO_CAPTIONS', error: 'El vídeo no tiene subtítulos disponibles.' };
  const track = pickTrack(pistas);
  if (!track) return { ok: false, code: 'NO_CAPTIONS', error: 'Sin pista de subtítulos utilizable.' };
  const baseUrl = String(track.baseUrl || '').replace(/\\u0026/g, '&');
  if (!baseUrl) return { ok: false, code: 'NO_CAPTIONS', error: 'La pista no trae URL.' };
  const vtt = await fetchVtt(baseUrl);
  const { segmentos, palabras } = parseVtt(vtt);
  if (!segmentos.length) return { ok: false, code: 'EMPTY', error: 'Los subtítulos llegaron vacíos.' };
  return {
    ok: true,
    video_id: videoId,
    url_youtube: `https://www.youtube.com/watch?v=${videoId}`,
    titulo_video: titulo,
    language: String(track.languageCode || 'es').slice(0, 2),
    duration: duracion_seg || segmentos[segmentos.length - 1]?.end || 0,
    segments: segmentos,
    words: palabras,
    text: segmentos.map((s) => s.text).join(' ').slice(0, 16000),
    fuente: 'subtítulos de YouTube (vía Worker de Cloudflare)',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
    if (url.pathname === '/health') return json({ ok: true });
    if (request.method === 'POST' && url.pathname === '/transcribir') {
      if (env.WORKER_SECRET) {
        const h = request.headers.get('x-worker-secret');
        if (h !== env.WORKER_SECRET) return json({ ok: false, error: 'No autorizado', code: 'UNAUTHORIZED' }, 401);
      }
      try {
        const body = await request.json().catch(() => ({}));
        const videoId = extractId(body?.url || '');
        if (!videoId) return json({ ok: false, error: 'No se pudo identificar el ID del vídeo.', code: 'BAD_URL' }, 400);
        const r = await transcribir(videoId);
        return json(r, r.ok ? 200 : 422);
      } catch (e) {
        return json({ ok: false, error: String(e?.message || e).slice(0, 200), code: 'WORKER_ERROR' }, 500);
      }
    }
    return json({ ok: false, error: 'Ruta no encontrada. Usa POST /transcribir' }, 404);
  },
};
