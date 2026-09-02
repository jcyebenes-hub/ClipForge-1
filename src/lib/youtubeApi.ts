/**
 * Acceso a YouTube SIN depender de la página web (que desde IPs de servidor/datacenter
 * sale bloqueada o con muro de consentimiento).
 *
 * Usa el endpoint interno youtubei/v1/player con el cliente ANDROID (clave pública que
 * viaja en la app oficial de YouTube para Android) y descarga los subtítulos en VTT,
 * que incluyen marcas de tiempo a nivel de palabra en los subtítulos automáticos (ASR).
 */

const UA =
  'com.google.android.youtube/20.10.35 (Linux; U; Android 12; es_ES) gzip';

const ANDROID_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';

export interface CaptionTrackAndroid {
  languageCode: string;
  kind?: string;
  baseUrl: string;
  name?: { simpleText?: string };
}

export interface PlayerAndroidResult {
  videoId: string;
  titulo: string;
  autor: string;
  duracion_seg: number;
  playable: boolean;
  captionTracks: CaptionTrackAndroid[];
}

export async function playerAndroid(videoId: string): Promise<PlayerAndroidResult> {
  const body = {
    context: {
      client: { clientName: 'ANDROID', clientVersion: '20.10.35', hl: 'es', gl: 'ES' },
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${ANDROID_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Accept-Language': 'es-ES,es;q=0.9',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`YouTube API devolvió ${res.status}`);
  }

  const d = await res.json();
  const vd = d?.videoDetails || {};
  const tracks: CaptionTrackAndroid[] =
    d?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const playable = d?.playabilityStatus?.status === 'OK';

  return {
    videoId,
    titulo: vd.title || '',
    autor: vd.author || '',
    duracion_seg: Number(vd.lengthSeconds) || 0,
    playable,
    captionTracks: tracks,
  };
}

/** Descarga los subtítulos en VTT de una pista */
export async function fetchVttCapitulos(baseUrl: string): Promise<string> {
  let base = baseUrl.includes('fmt=')
    ? baseUrl.replace(/fmt=[a-z0-9]+/i, 'fmt=vtt')
    : `${baseUrl}&fmt=vtt`;
  if (!base.includes('&') && !base.includes('?')) {
    base = base.replace('fmt=vtt', '?fmt=vtt');
  }
  const res = await fetch(base, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' },
    signal: AbortSignal.timeout(20000),
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
 * segmentos con palabras. Para ASR usa las marcas individuales; para subtítulos
 * manuales reparte el tiempo de cada cue uniformemente entre sus palabras.
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

    // La primera palabra del vídeo suele ir sin marca propia: se le asigna el
    // instante del primer marcador menos un pequeño margen.
    const primerT = palabrasMarcadas[0].t;
    if (primerT > 0.3) {
      palabrasMarcadas.unshift({ t: Math.max(0, primerT - 0.2), w: '' }); // marcador temporal (se filtra)
    }

    for (let i = 0; i < palabrasMarcadas.length; i += PALABRAS_POR_SEGMENTO) {
      const grupo = palabrasMarcadas.slice(i, i + PALABRAS_POR_SEGMENTO).filter((p) => p.w);
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
      segmentos.push({ id: segmentos.length, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), text: texto, words: palabrasSeg });
    }

    return { segmentos, palabras: palabrasFinales, metodo: 'asr-marcas' };
  }

  // ── Vía 2: subtítulos manuales / planos: bloques cue ──
  const cues: Array<{ start: number; end: number; text: string }> = [];
  const bloqueRe = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})[^\n]*\n([\s\S]*?)(?=\n\n|$)/g;
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
    // Saltar repeticiones acumuladas idénticas a la anterior
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
