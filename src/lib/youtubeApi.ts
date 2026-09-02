/**
 * Acceso a YouTube SIN depender de la página web (que desde IPs de servidor/datacenter
 * sale bloqueada o con muro de consentimiento).
 *
 * Usa el endpoint interno youtubei/v1/player probando varios "clientes" oficiales
 * (ANDROID, IOS, MWEB, TV…) porque YouTube aplica respuestas reducidas por IP:
 * si un cliente devuelve respuesta sin subtítulos o sin formatos, probamos el siguiente.
 * Los subtítulos se descargan en VTT, que en los automáticos (ASR) trae marcas por palabra.
 */

export interface CaptionTrackAndroid {
  languageCode: string;
  kind?: string;
  baseUrl: string;
  name?: { simpleText?: string };
}

export interface ClienteYouTube {
  name: string;
  ver: string;
  key: string;
}

export const CLIENTES_YOUTUBE: ClienteYouTube[] = [
  { name: 'ANDROID', ver: '20.10.35', key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w' },
  { name: 'ANDROID', ver: '19.09.37', key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w' },
  { name: 'IOS', ver: '19.45.4', key: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc' },
  { name: 'MWEB', ver: '2.20250310.01.00', key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8' },
  { name: 'TVHTML5', ver: '7.20250101.14.00', key: 'AIzaSyDCU8hByM-X4KzVa9oG9ZZlGpPlfY0WuNw' },
];

export interface IntentoCliente {
  cliente: string;
  httpOk: boolean;
  statusApi?: string;
  razon?: string;
  playable: boolean;
  titulo?: string;
  autor?: string;
  duracion_seg?: number;
  numPistas: number;
  pistas: CaptionTrackAndroid[];
}

export interface PlayerResultado {
  clienteUsado: string;
  titulo: string;
  autor: string;
  duracion_seg: number;
  captionTracks: CaptionTrackAndroid[];
  intentos: IntentoCliente[];
}

const UA_BASE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function userAgentPara(cliente: ClienteYouTube): string {
  if (cliente.name === 'ANDROID') {
    return `com.google.android.youtube/${cliente.ver} (Linux; U; Android 12; es_ES) gzip`;
  }
  if (cliente.name === 'IOS') {
    return `com.google.ios.youtube/${cliente.ver} (iPhone14,3; U; CPU iOS 17_2 like Mac OS X;)`;
  }
  return UA_BASE;
}

async function consultarCliente(videoId: string, cliente: ClienteYouTube): Promise<IntentoCliente> {
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
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgentPara(cliente),
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return {
        cliente: cliente.name,
        httpOk: false,
        playable: false,
        numPistas: 0,
        pistas: [],
        razon: `HTTP ${res.status}`,
      };
    }

    const d = await res.json();
    const vd = d?.videoDetails || {};
    const tracks: CaptionTrackAndroid[] =
      d?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const ps = d?.playabilityStatus || {};

    return {
      cliente: cliente.name,
      httpOk: true,
      statusApi: ps.status,
      razon: ps.reason,
      playable: ps.status === 'OK',
      titulo: vd.title || '',
      autor: vd.author || '',
      duracion_seg: Number(vd.lengthSeconds) || 0,
      numPistas: tracks.length,
      pistas: tracks,
    };
  } catch (err: any) {
    return {
      cliente: cliente.name,
      httpOk: false,
      playable: false,
      numPistas: 0,
      pistas: [],
      razon: String(err?.message || err).slice(0, 120),
    };
  }
}

/**
 * Prueba los clientes en orden y devuelve el mejor resultado:
 *  - preferimos el primero con pistas de subtítulos
 *  - si ninguno trae pistas, el primero reproducible (para metadatos)
 */
export async function probarClientes(videoId: string): Promise<PlayerResultado> {
  const intentos: IntentoCliente[] = [];
  let conPistas: IntentoCliente | null = null;
  let conMetadatos: IntentoCliente | null = null;

  for (const cliente of CLIENTES_YOUTUBE) {
    const it = await consultarCliente(videoId, cliente);
    intentos.push(it);
    if (it.numPistas > 0 && !conPistas) conPistas = it;
    if (!conMetadatos && (it.playable || it.titulo) && !it.razon) conMetadatos = it;
    if (conPistas && conMetadatos) break; // suficiente
  }

  const mejor = conPistas || conMetadatos || intentos.find((i) => i.titulo) || intentos[0];

  return {
    clienteUsado: mejor?.cliente || '—',
    titulo: mejor?.titulo || '',
    autor: mejor?.autor || '',
    duracion_seg: mejor?.duracion_seg || 0,
    captionTracks: mejor?.pistas || [],
    intentos,
  };
}

/** Descarga los subtítulos en VTT de una pista */
export async function fetchVttCapitulos(baseUrl: string): Promise<string> {
  // Normalizar: a veces YouTube devuelve una baseUrl RELATIVA (/api/timedtext?...)
  // y/o con entidades HTML (&amp;) o escapes (\u0026). Sin normalizar, fetch() lanza
  // "Invalid URL". La convertimos a absoluta y decodificamos los separadores.
  let u = String(baseUrl || '')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .trim();
  if (u.startsWith('/')) u = 'https://www.youtube.com' + u;

  let base = u.includes('fmt=')
    ? u.replace(/fmt=[a-z0-9]+/i, 'fmt=vtt')
    : `${u}${u.includes('?') ? '&' : '?'}fmt=vtt`;
  const res = await fetch(base, {
    headers: { 'User-Agent': UA_BASE, 'Accept-Language': 'es-ES,es;q=0.9' },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`YouTube subtítulos devolvió ${res.status}`);
  return res.text();
}

export interface PalabraTiempo {
  word: string;
  start: number; // s
}

export interface SegmentoConstruido {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

function aSegundos(hh: string, mm: string, ss: string, ms: string): number {
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
}

/**
 * Convierte un VTT de YouTube (con marcas por palabra o solo texto plano) en
 * segmentos con palabras.
 */
export function parseVttATranscripcion(vtt: string, idioma: string) {
  // ── Vía 1: subtítulos automáticos con marcas por palabra ──
  const palabrasMarcadas: Array<{ t: number; w: string }> = [];
  const re = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})><c>\s*([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(vtt)) !== null) {
    const t = aSegundos(m[1], m[2], m[3], m[4]);
    const w = m[5].trim();
    if (w) palabrasMarcadas.push({ t, w });
  }

  const PALABRAS_POR_SEGMENTO = 9;

  if (palabrasMarcadas.length >= 10) {
    const segmentos: SegmentoConstruido[] = [];
    const palabrasFinales: Array<{ word: string; start: number; end: number }> = [];

    for (let i = 0; i < palabrasMarcadas.length; i += PALABRAS_POR_SEGMENTO) {
      const grupo = palabrasMarcadas.slice(i, i + PALABRAS_POR_SEGMENTO);
      if (grupo.length === 0) continue;
      const start = grupo[0].t;
      const endRaw = grupo[grupo.length - 1].t;
      const end = Math.min(endRaw + 1.5, start + 18);
      const texto = grupo.map((g) => g.w).join(' ');
      const duracion = end - start || 1;
      const palabrasSeg: Array<{ word: string; start: number; end: number }> = [];
      let wTime = start;
      for (const g of grupo) {
        const wDur = duracion / grupo.length;
        palabrasSeg.push({
          word: g.w,
          start: Number(wTime.toFixed(3)),
          end: Number((wTime + wDur * 0.95).toFixed(3)),
        });
        wTime += wDur;
      }
      palabrasFinales.push(...palabrasSeg);
      segmentos.push({
        id: segmentos.length,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        text: texto,
        words: palabrasSeg,
      });
    }

    return { segmentos, palabras: palabrasFinales, metodo: 'asr-marcas' };
  }

  // ── Vía 2: subtítulos manuales / planos: bloques cue ──
  const cues: Array<{ start: number; end: number; text: string }> = [];
  const bloqueRe =
    /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})[^\n]*\n([\s\S]*?)(?=\n\n|$)/g;
  let bm: RegExpExecArray | null;
  while ((bm = bloqueRe.exec(vtt)) !== null) {
    const start = aSegundos(bm[1], bm[2], bm[3], bm[4]);
    const end = aSegundos(bm[5], bm[6], bm[7], bm[8]);
    const texto = (bm[9] || '')
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}><c>/g, '')
      .replace(/<\/c>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (texto) cues.push({ start, end, text: texto });
  }

  const segmentos: SegmentoConstruido[] = [];
  const palabrasFinales: Array<{ word: string; start: number; end: number }> = [];
  let anteriorTexto = '';
  for (const cue of cues) {
    if (cue.text === anteriorTexto) continue;
    anteriorTexto = cue.text;
    const palabras = cue.text.split(/\s+/).filter(Boolean);
    const duracion = Math.max(cue.end - cue.start, 0.4);
    const palabrasSeg: Array<{ word: string; start: number; end: number }> = [];
    let wTime = cue.start;
    for (const p of palabras) {
      const wDur = duracion / Math.max(palabras.length, 1);
      palabrasSeg.push({
        word: p,
        start: Number(wTime.toFixed(3)),
        end: Number((wTime + wDur * 0.95).toFixed(3)),
      });
      wTime += wDur;
    }
    palabrasFinales.push(...palabrasSeg);
    segmentos.push({
      id: segmentos.length,
      start: Number(cue.start.toFixed(3)),
      end: Number(cue.end.toFixed(3)),
      text: cue.text,
      words: palabrasSeg,
    });
  }

  return { segmentos, palabras: palabrasFinales, metodo: 'cue-texto' };
}

/** ── Estrategia con cookies de sesión (consentimiento/visitor) ── */

export interface SesionCookies {
  cookieHeader: string;
  visitorData?: string;
}

/** Obtiene cookies base de youtube.com (CONSENT, SOCS, VISITOR_INFO1_LIVE…) */
export async function obtenerCookiesYouTube(): Promise<SesionCookies> {
  try {
    const res = await fetch('https://www.youtube.com/?hl=es&gl=ES', {
      headers: {
        'User-Agent': UA_BASE,
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    const raw = res.headers.get('set-cookie') || '';
    const todas = (res.headers.getSetCookie ? res.headers.getSetCookie() : [raw]).map((c: string) => c.split(';')[0]).filter(Boolean);
    const mapa = new Map<string, string>();
    for (const c of todas) {
      const [k, ...rest] = c.split('=');
      if (k) mapa.set(k.trim(), rest.join('='));
    }
    if (!mapa.has('CONSENT')) mapa.set('CONSENT', 'YES+cb.20240101-00-p0.es+FX+100');
    if (!mapa.has('SOCS')) mapa.set('SOCS', 'CAI');
    const cookieHeader = [...mapa.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    return { cookieHeader, visitorData: undefined };
  } catch {
    return { cookieHeader: 'CONSENT=YES+cb.20240101-00-p0.es+FX+100; SOCS=CAI', visitorData: undefined };
  }
}

/** Consulta youtubei con cookies (y opcionalmente con visitorData) */
export async function consultarClienteConCookies(
  videoId: string,
  cliente: ClienteYouTube,
  sesion: SesionCookies
): Promise<IntentoCliente> {
  const body: any = {
    context: {
      client: {
        clientName: cliente.name,
        clientVersion: cliente.ver,
        hl: 'es',
        gl: 'ES',
      },
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };
  if (sesion.visitorData) {
    body.context.client.visitorData = sesion.visitorData;
  }
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${cliente.key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgentPara(cliente),
        'Accept-Language': 'es-ES,es;q=0.9',
        Cookie: sesion.cookieHeader,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return { cliente: `${cliente.name}+cookie`, httpOk: false, playable: false, numPistas: 0, pistas: [], razon: `HTTP ${res.status}` };
    }
    const d = await res.json();
    const vd = d?.videoDetails || {};
    const tracks: CaptionTrackAndroid[] = d?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const ps = d?.playabilityStatus || {};
    return {
      cliente: `${cliente.name}+cookie`,
      httpOk: true,
      statusApi: ps.status,
      razon: ps.reason,
      playable: ps.status === 'OK',
      titulo: vd.title || '',
      autor: vd.author || '',
      duracion_seg: Number(vd.lengthSeconds) || 0,
      numPistas: tracks.length,
      pistas: tracks,
    };
  } catch (err: any) {
    return { cliente: `${cliente.name}+cookie`, httpOk: false, playable: false, numPistas: 0, pistas: [], razon: String(err?.message || err).slice(0, 120) };
  }
}

/** Comprueba qué devuelve la página del vídeo (longitud y marcadores) */
export async function sondearPagina(videoId: string) {
  const resultados: any[] = [];
  const sesion = await obtenerCookiesYouTube();
  resultados.push({ prueba: 'homepage-cookies', cookies: sesion.cookieHeader.length });

  // youtubei con cookies
  for (const cliente of CLIENTES_YOUTUBE.slice(0, 3)) {
    const it = await consultarClienteConCookies(videoId, cliente, sesion);
    resultados.push({
      prueba: `youtubei-${it.cliente}`,
      statusApi: it.statusApi || undefined,
      razon: it.razon || undefined,
      playable: it.playable,
      numPistas: it.numPistas,
      conTitulo: Boolean(it.titulo),
      duracionApi: it.duracion_seg || 0,
    });
  }

  // página watch con cookie de consentimiento
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=es`, {
      headers: {
        'User-Agent': UA_BASE,
        'Accept-Language': 'es-ES,es;q=0.9',
        Cookie: sesion.cookieHeader,
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const ls = html.match(/"lengthSeconds":"?(\d+)/);
    resultados.push({
      prueba: 'watch-page+consent',
      len: html.length,
      lengthSeconds: ls ? ls[1] : null,
      hasCaptionTracks: html.includes('captionTracks'),
      hasLoginRequired: html.includes('LOGIN_REQUIRED') || /no eres un bot|not a bot/.test(html),
    });
  } catch (err: any) {
    resultados.push({ prueba: 'watch-page+consent', error: String(err?.message || err).slice(0, 80) });
  }

  return resultados;
}
