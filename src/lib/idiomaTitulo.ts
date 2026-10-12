/**
 * lib/idiomaTitulo.ts
 * Detecta si el título de un vídeo parece español.
 *
 * POR QUÉ EXISTE
 * --------------
 * La API de YouTube no filtra por idioma de verdad. `relevanceLanguage` es una
 * SUGERENCIA (la propia documentación de Google avisa de que devolverá otros
 * idiomas si el término es muy relevante) y `regionCode` significa "vídeos que
 * se pueden VER en ese país", no "vídeos hechos en ese país". Así que en una
 * búsqueda de España pueden colarse títulos en inglés, coreano o ruso.
 *
 * Este módulo es una HEURÍSTICA sobre el texto del título, no un clasificador
 * de idiomas. Su trabajo no es acertar siempre: es avisar. Por eso devuelve
 * 'dudoso' cuando no tiene pistas suficientes, en lugar de inventarse una
 * respuesta.
 *
 * Es PURO (sin red, sin Supabase) para poder probarlo en Node.
 */

export type IdiomaTitulo = 'es' | 'no-es' | 'dudoso';

/** Minúsculas, sin tildes y sin eñe: la forma canónica con la que se compara. */
function normalizar(palabra: string): string {
  return palabra
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Palabras muy propias del español y muy improbables en inglés.
 * Se excluyen a propósito las ambiguas, que existen en los dos idiomas:
 * no, un, video, canal, clip, top, vs, mega, super, extra…
 */
const LISTA_ESPANOL = [
  'de', 'la', 'el', 'los', 'las', 'que', 'del', 'por', 'para', 'con', 'una', 'uno',
  'unos', 'unas', 'su', 'sus', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'eso',
  'como', 'mas', 'pero', 'porque', 'tambien', 'muy', 'ya', 'sin', 'sobre', 'hasta',
  'desde', 'todo', 'todos', 'toda', 'todas', 'mejor', 'peor', 'nuevo', 'nueva',
  'vez', 'veces', 'cosas', 'cosa', 'dia', 'dias', 'ano', 'anos', 'vida', 'mundo',
  'gente', 'persona', 'personas', 'hace', 'hizo', 'hacer', 'tengo', 'tienes',
  'quiero', 'puedes', 'cuando', 'donde', 'quien', 'aqui', 'alli', 'mi', 'tu',
  'nuestro', 'nuestra', 'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'cada',
  'entre', 'durante', 'mientras', 'aunque', 'entonces', 'ahora', 'antes', 'despues',
  'siempre', 'nunca', 'todavia', 'algo', 'nada', 'alguien', 'nadie', 'mucho',
  'mucha', 'muchos', 'muchas', 'poco', 'poca', 'grande', 'pequeno', 'bueno',
  'buena', 'malo', 'mala', 'facil', 'dificil', 'verdad', 'forma', 'manera', 'parte',
  'partes', 'tipo', 'tipos', 'ejemplo', 'ejemplos', 'primera', 'primero', 'segunda',
  'segundo', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'caso', 'casos', 'paso', 'pasos', 'semana', 'mes', 'horas', 'minutos', 'segundos',
  'dinero', 'juego', 'juegos', 'receta', 'recetas', 'truco', 'trucos', 'secreto',
  'secretos', 'increible', 'brutal', 'menudo', 'ojo', 'mira', 'mirad', 'atencion',
];

/** Palabras muy propias del inglés y muy improbables en español. */
const LISTA_INGLES = [
  'the', 'and', 'of', 'to', 'in', 'is', 'it', 'for', 'on', 'with', 'at', 'by',
  'this', 'that', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'but', 'not', 'you', 'your', 'yours', 'we', 'our',
  'ours', 'they', 'their', 'them', 'he', 'she', 'his', 'her', 'how', 'what',
  'why', 'when', 'where', 'which', 'who', 'will', 'would', 'can', 'could',
  'should', 'shall', 'might', 'must', 'just', 'really', 'so', 'very', 'more',
  'most', 'best', 'worst', 'new', 'first', 'second', 'third', 'time', 'times',
  'day', 'days', 'year', 'years', 'life', 'world', 'people', 'person', 'make',
  'makes', 'made', 'get', 'gets', 'got', 'going', 'gonna', 'want', 'need',
  'know', 'think', 'see', 'look', 'watching', 'watch', 'tried', 'trying', 'try',
  'ever', 'never', 'always', 'still', 'only', 'own', 'same', 'different',
  'thing', 'things', 'way', 'ways', 'lot', 'lots', 'guys', 'guy', 'videos',
  'channel', 'subscribe', 'like', 'comment', 'follow', 'tutorial', 'guide',
  'tips', 'tricks', 'hack', 'hacks', 'review', 'against', 'before', 'after',
  'because', 'while', 'although', 'through', 'into', 'over', 'under', 'out',
  'about', 'from', 'than', 'then', 'there', 'here', 'these', 'those', 'some',
  'any', 'all', 'both', 'each', 'every', 'other', 'another', 'such', 'too',
  'also', 'money', 'game', 'games', 'week', 'month', 'crazy', 'insane', 'epic',
  'failed', 'wins', 'beat', 'beats', 'found', 'testing', 'test', 'build',
  'built', 'playing', 'play', 'played', 'stop', 'start', 'started', 'finally',
  'actually', 'literally',
];

/** Las listas se normalizan IGUAL que los títulos, o nunca coincidirían. */
const ESPANOL = new Set(LISTA_ESPANOL.map(normalizar));
const INGLES = new Set(LISTA_INGLES.map(normalizar));

/** Alfabetos que no son español ni inglés: si aparecen, el título no es español. */
const SIN_LATIN = /[\u0400-\u04ff\u0600-\u06ff\u0590-\u05ff\u0e00-\u0e7f\u0370-\u03ff\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\u1100-\u11ff]/;

/** Señales casi inequívocas de español: la eñe y los signos de apertura. */
const SENALES_FUERTES_ES = /[ñ¿¡]/;

/** Mínimas coincidencias para atreverse a decir un idioma. */
const MIN_PISTAS = 2;

/** Quita URLs, @menciones, #hashtags y emojis. */
function limpiar(texto: string): string {
  return texto
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[#@]\S+/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ');
}

/** Parte el texto en palabras canónicas. */
function tokens(texto: string): string[] {
  return limpiar(texto)
    .split(/[^A-Za-z0-9À-ÿñÑ]+/)
    .map(normalizar)
    .filter((p) => p.length > 1);
}

/**
 * Decide si un título parece español.
 *
 * - 'es'     → hay pistas claras de español y más que de inglés.
 * - 'no-es'  → hay otro alfabeto, o más pistas de inglés que de español.
 * - 'dudoso' → no hay pistas suficientes. Típico en títulos de una o dos
 *              palabras ("Minecraft", "GTA 6"): no se puede saber, y es mejor
 *              decirlo que equivocarse.
 */
export function detectarIdiomaTitulo(titulo: string): IdiomaTitulo {
  if (!titulo || typeof titulo !== 'string') return 'dudoso';
  const bruto = titulo.trim();
  if (!bruto) return 'dudoso';

  // Otro alfabeto: no es español, sin más discusión.
  if (SIN_LATIN.test(bruto)) return 'no-es';

  // La eñe o los signos ¿ ¡ no existen en inglés: valen por sí solos.
  if (SENALES_FUERTES_ES.test(bruto)) return 'es';

  const lista = tokens(bruto);
  if (lista.length === 0) return 'dudoso';

  let es = 0;
  let en = 0;
  for (const t of lista) {
    if (ESPANOL.has(t)) es++;
    if (INGLES.has(t)) en++;
  }

  if (es >= MIN_PISTAS && es > en) return 'es';
  if (en >= MIN_PISTAS && en > es) return 'no-es';

  return 'dudoso';
}

/** Comodidad para la interfaz: ¿hay que avisar de que quizá no sea español? */
export function avisarNoEspanol(titulo: string): boolean {
  return detectarIdiomaTitulo(titulo) === 'no-es';
}

/** Texto del aviso, para que la interfaz no se invente redacciones distintas. */
export function textoAvisoIdioma(idioma: IdiomaTitulo): string | null {
  if (idioma === 'no-es') return 'Puede no ser español';
  if (idioma === 'dudoso') return 'Idioma no confirmado';
  return null;
}
