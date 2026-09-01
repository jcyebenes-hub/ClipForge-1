/**
 * Catálogo de idiomas y utilidades para traducción de subtítulos con Llama 3.3 70B
 */

import { SubtitleWord } from './subtitulos';

export interface IdiomaConfig {
  codigo: string;
  nombre: string;
  nombreNativo: string;
  bandera: string;
}

export const IDIOMAS_DISPONIBLES: IdiomaConfig[] = [
  { codigo: 'es', nombre: 'Español', nombreNativo: 'Español', bandera: '🇪🇸' },
  { codigo: 'en', nombre: 'Inglés', nombreNativo: 'English', bandera: '🇺🇸' },
  { codigo: 'pt', nombre: 'Portugués', nombreNativo: 'Português', bandera: '🇧🇷' },
  { codigo: 'fr', nombre: 'Francés', nombreNativo: 'Français', bandera: '🇫🇷' },
  { codigo: 'de', nombre: 'Alemán', nombreNativo: 'Deutsch', bandera: '🇩🇪' },
  { codigo: 'it', nombre: 'Italiano', nombreNativo: 'Italiano', bandera: '🇮🇹' },
  { codigo: 'ru', nombre: 'Ruso', nombreNativo: 'Русский', bandera: '🇷🇺' },
  { codigo: 'ja', nombre: 'Japonés', nombreNativo: '日本語', bandera: '🇯🇵' },
  { codigo: 'ko', nombre: 'Coreano', nombreNativo: '한국어', bandera: '🇰🇷' },
  { codigo: 'hi', nombre: 'Hindi', nombreNativo: 'हिन्दी', bandera: '🇮🇳' },
  { codigo: 'ar', nombre: 'Árabe', nombreNativo: 'العربية', bandera: '🇸🇦' },
  { codigo: 'zh', nombre: 'Chino (Simplificado)', nombreNativo: '简体中文', bandera: '🇨🇳' },
  { codigo: 'zh-TW', nombre: 'Chino (Tradicional)', nombreNativo: '繁體中文', bandera: '🇹🇼' },
  { codigo: 'nl', nombre: 'Holandés', nombreNativo: 'Nederlands', bandera: '🇳🇱' },
  { codigo: 'pl', nombre: 'Polaco', nombreNativo: 'Polski', bandera: '🇵🇱' },
  { codigo: 'tr', nombre: 'Turco', nombreNativo: 'Türkçe', bandera: '🇹🇷' },
  { codigo: 'sv', nombre: 'Sueco', nombreNativo: 'Svenska', bandera: '🇸🇪' },
  { codigo: 'no', nombre: 'Noruego', nombreNativo: 'Norsk', bandera: '🇳🇴' },
  { codigo: 'da', nombre: 'Danés', nombreNativo: 'Dansk', bandera: '🇩🇰' },
  { codigo: 'fi', nombre: 'Finlandés', nombreNativo: 'Suomi', bandera: '🇫🇮' },
  { codigo: 'el', nombre: 'Griego', nombreNativo: 'Ελληνικά', bandera: '🇬🇷' },
  { codigo: 'he', nombre: 'Hebreo', nombreNativo: 'עברית', bandera: '🇮🇱' },
  { codigo: 'id', nombre: 'Indonesio', nombreNativo: 'Bahasa Indonesia', bandera: '🇮🇩' },
  { codigo: 'vi', nombre: 'Vietnamita', nombreNativo: 'Tiếng Việt', bandera: '🇻🇳' },
  { codigo: 'th', nombre: 'Tailandés', nombreNativo: 'ไทย', bandera: '🇹🇭' },
  { codigo: 'cs', nombre: 'Checo', nombreNativo: 'Čeština', bandera: '🇨🇿' },
  { codigo: 'ro', nombre: 'Rumano', nombreNativo: 'Română', bandera: '🇷🇴' },
  { codigo: 'hu', nombre: 'Húngaro', nombreNativo: 'Magyar', bandera: '🇭🇺' },
  { codigo: 'uk', nombre: 'Ucraniano', nombreNativo: 'Українська', bandera: '🇺🇦' },
  { codigo: 'bn', nombre: 'Bengalí', nombreNativo: 'বাংলা', bandera: '🇧🇩' },
  { codigo: 'ms', nombre: 'Malayo', nombreNativo: 'Bahasa Melayu', bandera: '🇲🇾' },
  { codigo: 'tl', nombre: 'Tagalo / Filipino', nombreNativo: 'Tagalog', bandera: '🇵🇭' },
  { codigo: 'fa', nombre: 'Persa', nombreNativo: 'فارسی', bandera: '🇮🇷' },
  { codigo: 'ur', nombre: 'Urdu', nombreNativo: 'اردو', bandera: '🇵🇰' },
  { codigo: 'ca', nombre: 'Catalán', nombreNativo: 'Català', bandera: '🇪🇸' },
  { codigo: 'gl', nombre: 'Gallego', nombreNativo: 'Galego', bandera: '🇪🇸' },
  { codigo: 'eu', nombre: 'Euskera', nombreNativo: 'Euskara', bandera: '🇪🇸' },
];

export interface EntradaSubtituloJSON {
  t_inicio: number;
  t_fin: number;
  texto: string;
}

/**
 * Convierte un arreglo de SubtitleWord en frases/entradas compactas [{t_inicio, t_fin, texto}]
 */
export function convertirPalabrasAEntradasJSON(
  words: SubtitleWord[],
  inicioSeg: number,
  finSeg: number,
  palabrasPorGrupo: number = 4
): EntradaSubtituloJSON[] {
  const validWords = words
    .filter((w) => w.end > inicioSeg && w.start < finSeg)
    .sort((a, b) => a.start - b.start);

  if (validWords.length === 0) return [];

  const entradas: EntradaSubtituloJSON[] = [];
  let chunk: SubtitleWord[] = [];

  for (let i = 0; i < validWords.length; i++) {
    chunk.push(validWords[i]);
    const isPunctuation = /[.,!?;:]$/.test(validWords[i].word);
    const reachedLimit = chunk.length >= palabrasPorGrupo;
    const isLast = i === validWords.length - 1;

    if (reachedLimit || isPunctuation || isLast) {
      entradas.push({
        t_inicio: Number(chunk[0].start.toFixed(2)),
        t_fin: Number(chunk[chunk.length - 1].end.toFixed(2)),
        texto: chunk.map((w) => w.word).join(' '),
      });
      chunk = [];
    }
  }

  return entradas;
}

/**
 * Convierte un arreglo de entradas JSON traducidas [{t_inicio, t_fin, texto}] a SubtitleWord[] con tiempos interpolados
 */
export function convertirEntradasJSONAPalabras(entradas: EntradaSubtituloJSON[]): SubtitleWord[] {
  const words: SubtitleWord[] = [];

  for (const entrada of entradas) {
    const rawTokens = (entrada.texto || '').trim().split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) continue;

    const duracion = Math.max(0.1, entrada.t_fin - entrada.t_inicio);
    const duracionPorPalabra = duracion / rawTokens.length;

    rawTokens.forEach((token, idx) => {
      const start = Number((entrada.t_inicio + idx * duracionPorPalabra).toFixed(2));
      const end = Number((entrada.t_inicio + (idx + 1) * duracionPorPalabra).toFixed(2));
      const isKey = token.length > 5 || /[!¡?¿0-9%]/.test(token);

      words.push({
        word: token,
        start,
        end,
        isKeyWord: isKey,
      });
    });
  }

  return words;
}

/**
 * Fallback de traducción algorítmica para demostración sin Groq API Key
 */
export function traducirEntradasFallback(
  entradas: EntradaSubtituloJSON[],
  idiomaCodigo: string
): EntradaSubtituloJSON[] {
  const prefijosIdiomas: Record<string, string> = {
    en: '[EN] ',
    pt: '[PT] ',
    fr: '[FR] ',
    de: '[DE] ',
    it: '[IT] ',
    ru: '[RU] ',
    ja: '[JA] ',
    ko: '[KO] ',
    hi: '[HI] ',
    ar: '[AR] ',
    zh: '[ZH] ',
  };

  const prefijo = prefijosIdiomas[idiomaCodigo] || `[${idiomaCodigo.toUpperCase()}] `;

  const traduccionesComunes: Record<string, Record<string, string>> = {
    en: {
      'bienvenidos': 'welcome',
      'episodio': 'episode',
      'especial': 'special',
      'retención': 'retention',
      'primer': 'first',
      'error': 'mistake',
      'creadores': 'creators',
      'segundos': 'seconds',
      'gancho': 'hook',
      'regla': 'rule',
      'oro': 'gold',
      'subtítulos': 'subtitles',
      'dinámicos': 'dynamic',
      'amarillo': 'yellow',
      'algoritmo': 'algorithm',
      'viral': 'viral',
    },
    fr: {
      'bienvenidos': 'bienvenue',
      'retención': 'rétention',
      'error': 'erreur',
      'gancho': 'accroche',
      'oro': 'or',
      'subtítulos': 'sous-titres',
    },
    pt: {
      'bienvenidos': 'bem-vindos',
      'retención': 'retenção',
      'error': 'erro',
      'gancho': 'gancho',
      'oro': 'ouro',
      'subtítulos': 'legendas',
    },
    de: {
      'bienvenidos': 'willkommen',
      'retención': 'bindung',
      'error': 'fehler',
      'gancho': 'hook',
      'oro': 'gold',
      'subtítulos': 'untertitel',
    },
  };

  return entradas.map((e) => {
    let texto = e.texto;
    const mapa = traduccionesComunes[idiomaCodigo];
    if (mapa) {
      Object.entries(mapa).forEach(([esWord, trWord]) => {
        const regex = new RegExp(`\\b${esWord}\\b`, 'gi');
        texto = texto.replace(regex, trWord);
      });
    }

    // Si no cambió mucho y no es español, aplicar prefijo para diferenciar visualmente en demo
    if (idiomaCodigo !== 'es' && texto === e.texto) {
      texto = `${prefijo}${texto}`;
    }

    return {
      t_inicio: e.t_inicio,
      t_fin: e.t_fin,
      texto,
    };
  });
}

/**
 * Realiza la llamada a /api/traducir
 */
export async function solicitarTraduccionSubtitulos(params: {
  clip_id: string;
  idioma: string;
  subtitulos: EntradaSubtituloJSON[];
}): Promise<{
  success: boolean;
  idioma: string;
  subtitulos: EntradaSubtituloJSON[];
  provider?: string;
  mensaje?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/traducir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.subtitulos)) {
        return data;
      }
    } else {
      const errJson = await response.json().catch(() => ({}));
      if (errJson?.error) {
        console.warn('API error from /api/traducir:', errJson.error);
      }
    }
  } catch (err) {
    console.warn('API /api/traducir request error, falling back locally:', err);
  }

  // Fallback local en caso de desconexión
  const fallbackSubtitulos = traducirEntradasFallback(params.subtitulos, params.idioma);
  return {
    success: true,
    idioma: params.idioma,
    subtitulos: fallbackSubtitulos,
    provider: 'local-fallback',
    mensaje: 'Subtítulos traducidos mediante motor fallback',
  };
}
