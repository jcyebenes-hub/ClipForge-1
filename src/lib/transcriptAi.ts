/**
 * Proveedor de respaldo GRATIS para transcripciones de YouTube.
 *
 * Nuestro servidor (IP de centro de datos) es bloqueado por YouTube al leer
 * subtítulos. Este proveedor delega esa descarga en youtube-transcript.ai,
 * cuya infraestructura (Cloudflare) NO está bloqueada, y nos devuelve el
 * transcript en Markdown con marcas de tiempo [m:ss].
 *
 * IMPORTANTE — idiomas: este proveedor NO traduce. Devuelve las pistas de
 * subtítulos que el vídeo YA tiene (manuales, automáticas y las traducciones
 * automáticas de YouTube). Para pedir un idioma hay que usar su código EXACTO
 * (p. ej. `es-MX`, no `es`); si el código no existe, ignora la petición y
 * devuelve el idioma por defecto del vídeo. Por eso aquí:
 *   1. Leemos la lista de idiomas disponibles que viene en la cabecera.
 *   2. Elegimos el mejor código para el idioma objetivo (p. ej. castellano).
 *   3. Si hace falta, volvemos a pedir con ese código exacto.
 * Si el vídeo no tiene el idioma objetivo, devolvemos su idioma original + la
 * lista `idiomas_disponibles` para que el cliente decida (p. ej. traducir con
 * Llama por su cuenta).
 *
 * Uso: gratis y sin clave bajo límites de "fair use" (prototipado / bajo
 * volumen). Para un producto comercial de alto volumen habría que contactar a
 * youtube-transcript.ai o usar un proxy propio (Fase 2).
 *
 * Devuelve null si no se puede obtener (para que el llamador siga su flujo).
 */

export interface IdiomaDisponible {
  codigo: string; // código exacto para pedir (?lang=)
  base: string; // idioma base sin región (es, en, …)
  nombre: string; // nombre legible en español
  auto: boolean; // pista generada automáticamente
}

const NOMBRES_IDIOMA: Record<string, string> = {
  es: 'Español', en: 'Inglés', pt: 'Portugués', fr: 'Francés', de: 'Alemán',
  it: 'Italiano', ca: 'Catalán', gl: 'Gallego', eu: 'Euskera', ru: 'Ruso',
  ja: 'Japonés', ko: 'Coreano', zh: 'Chino', ar: 'Árabe', hi: 'Hindi',
  nl: 'Neerlandés', pl: 'Polaco', tr: 'Turco', sv: 'Sueco', no: 'Noruego',
  da: 'Danés', fi: 'Finlandés', el: 'Griego', he: 'Hebreo', id: 'Indonesio',
  vi: 'Vietnamita', th: 'Tailandés', cs: 'Checo', ro: 'Rumano', hu: 'Húngaro',
  uk: 'Ucraniano', bn: 'Bengalí', ms: 'Malayo', tl: 'Tagalo', fa: 'Persa',
  ur: 'Urdu',
};

function nombreIdioma(base: string): string {
  return NOMBRES_IDIOMA[base] || (base ? base.toUpperCase() : 'Desconocido');
}

/** `es-MX` → `es`; `a-en` (pista automática) → `en` */
export function baseLang(code?: string | null): string {
  let c = String(code || '').toLowerCase();
  if (c.startsWith('a-')) c = c.slice(2);
  return c.split('-')[0] || c;
}

function parseTimestamp(s: string): number {
  const m = s.match(/\[(\d+):(\d+)\]/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function parseDuracion(s: string): number {
  // "2:52" o "1:02:03"
  const parts = s.split(':').map((n) => parseInt(n, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function distribuirPalabras(text: string, start: number, end: number) {
  const palabras = text.split(/\s+/).filter(Boolean);
  const dur = Math.max(1, end - start);
  const paso = dur / Math.max(1, palabras.length);
  return palabras.map((w, i) => ({
    word: w,
    start: Number((start + i * paso).toFixed(2)),
    end: Number((start + (i + 1) * paso * 0.95).toFixed(2)),
  }));
}

/** Idioma actual de la cabecera: `Language: es (auto-generated) · …` */
function parsearIdiomaActual(body: string): { lang: string; auto: boolean } {
  const m = body.match(/Language:\s*([^\n·]+)/);
  if (!m) return { lang: '', auto: false };
  const s = m[1].trim();
  const auto = /auto-generated|\[auto\]/i.test(s);
  const cm = s.match(/^([A-Za-z0-9-]+)/);
  return { lang: cm ? cm[1] : '', auto };
}

/**
 * Construye la lista de idiomas disponibles a partir de la cabecera
 * `Other available languages: a-en (en) [auto], fr-FR (fr-FR), es-MX (es-MX), …`
 * más el idioma actual. Deduplica por idioma base (prefiere pista manual).
 */
function parsearDisponibles(body: string, actual: { lang: string; auto: boolean }): IdiomaDisponible[] {
  const porBase = new Map<string, IdiomaDisponible>();
  const añadir = (codigo: string, auto: boolean) => {
    const base = baseLang(codigo);
    if (!base) return;
    const previo = porBase.get(base);
    if (!previo || (previo.auto && !auto)) {
      porBase.set(base, { codigo, base, nombre: nombreIdioma(base), auto });
    }
  };
  if (actual.lang) añadir(actual.lang, actual.auto);
  const m = body.match(/Other available languages:\s*(.+)/);
  if (m) {
    for (const entrada of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const mm = entrada.match(/^([A-Za-z0-9-]+)\s*\(/);
      if (mm) añadir(mm[1], /\[auto\]/.test(entrada));
    }
  }
  return Array.from(porBase.values());
}

/** Elige el mejor código disponible para un idioma base (p. ej. 'es' → 'es-MX'). */
function elegirMejorCodigo(disponibles: IdiomaDisponible[], objetivoBase: string): string | null {
  const cand = disponibles.filter((d) => d.base === objetivoBase);
  if (!cand.length) return null;
  cand.sort((a, b) => {
    const aExact = a.codigo.toLowerCase() === objetivoBase ? 1 : 0;
    const bExact = b.codigo.toLowerCase() === objetivoBase ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact; // código base exacto primero
    if (a.auto !== b.auto) return a.auto ? 1 : -1; // manual antes que automática
    return a.codigo.length - b.codigo.length; // más simple primero
  });
  return cand[0].codigo;
}

async function descargar(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ClipForge/1.0' } });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

export async function transcribirViaTranscriptAi(
  videoId: string,
  lang = 'es'
): Promise<any | null> {
  try {
    const objetivo = String(lang || 'es').toLowerCase();
    const esAuto = objetivo === 'auto' || objetivo === 'original';
    const base = `https://youtube-transcript.ai/transcript/${videoId}.txt`;

    // 1ª petición: pedimos el idioma objetivo (o el original si lang=auto).
    let body = esAuto ? await descargar(base) : await descargar(`${base}?lang=${encodeURIComponent(lang)}`);
    if (!body || !body.includes('## Transcript')) {
      // Reintento sin idioma por si el parámetro molestó.
      body = await descargar(base);
    }
    if (!body || !body.includes('## Transcript')) return null;

    let actual = parsearIdiomaActual(body);
    let disponibles = parsearDisponibles(body, actual);

    // 2ª petición (solo si procede): el idioma objetivo no vino, pero el vídeo
    // SÍ lo tiene con otro código exacto (p. ej. pedimos `es` y tiene `es-MX`).
    if (!esAuto && baseLang(actual.lang) !== baseLang(lang)) {
      const mejor = elegirMejorCodigo(disponibles, baseLang(lang));
      if (mejor && mejor !== actual.lang) {
        const body2 = await descargar(`${base}?lang=${encodeURIComponent(mejor)}`);
        if (body2 && body2.includes('## Transcript')) {
          body = body2;
          actual = parsearIdiomaActual(body);
          disponibles = parsearDisponibles(body, actual);
        }
      }
    }

    const titleMatch = body.match(/^# Transcript:\s*(.+)$/m);
    const durMatch = body.match(/Duration:\s*([\d:]+)/);

    const lineas = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('['));
    if (lineas.length === 0) return null;

    const parsed = lineas.map((l) => ({
      start: parseTimestamp(l),
      text: l.replace(/\[\d+:\d+\]\s*/, '').trim(),
    }));

    const segments: any[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const start = parsed[i].start;
      const next = i + 1 < parsed.length ? parsed[i + 1].start : null;
      const est = Math.max(4, Math.min(60, Math.round(parsed[i].text.split(/\s+/).length * 0.4)));
      const end = next !== null && next > start ? next : start + est;
      segments.push({
        id: i,
        start,
        end,
        text: parsed[i].text,
        words: distribuirPalabras(parsed[i].text, start, end),
      });
    }

    const words = segments.flatMap((s) => s.words || []);
    const text = parsed.map((p) => p.text).join(' ');
    const duration = durMatch
      ? parseDuracion(durMatch[1])
      : segments.length
        ? segments[segments.length - 1].end
        : 0;

    return {
      task: 'transcribe',
      language: actual.lang || (esAuto ? 'auto' : lang),
      duration,
      text,
      segments,
      words,
      provider: 'youtube-transcript-ai',
      video_id: videoId,
      titulo_video: titleMatch ? titleMatch[1].trim() : '',
      idiomas_disponibles: disponibles,
    };
  } catch {
    return null;
  }
}
