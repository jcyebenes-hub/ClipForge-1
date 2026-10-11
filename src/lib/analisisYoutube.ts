/**
 * analisisYoutube.ts — motor de análisis de competencia/tendencias (Fase 2).
 *
 * Funciones PURAS (sin red): reciben vídeos y canales ya descargados de la API de
 * YouTube y extraen los patrones de los que mejor rinden en los últimos N días.
 *
 * Métricas "viewtrap" (rendimiento / contribución / crecimiento), con las mismas
 * fórmulas y umbrales que la herramienta de referencia (github.com/HelloJaewonLee/shorts,
 * shorts/trends.py). Sirven para detectar OUTLIERS: un Short que rinde muy por encima
 * de lo habitual EN SU PROPIO canal, en vez de ganar solo por tener un canal enorme.
 *
 * Se prueba con datos simulados en __tests__/analisisYoutube.test.ts.
 * La descarga desde YouTube vive en /api/competencia (clave en el servidor).
 */

export interface YTVideo {
  id: string;
  titulo: string;
  publicado: string; // ISO 8601
  duracionSeg: number;
  vistas: number;
  likes: number;
  comentarios: number;
  etiquetas?: string[];
  canal?: string;
  canalId?: string;
}

export interface PalabraTitulo {
  palabra: string;
  veces: number;
  enTop: number;
  ratioTop: number;
}

/** Métricas de canal. Nombres equivalentes a los de la herramienta de referencia. */
export interface MetricaCanal {
  id: string;
  nombre: string;
  subs: number;
  vistasTotales: number;
  videos: number;
  diasCanal: number;
  /** avg_views: media histórica de vistas por vídeo del canal. */
  vistasMedia: number;
  /** sub_per_view: suscriptores ganados por cada 1.000 vistas. */
  subPorMilVistas: number | null;
  /** sub_per_day: crecimiento diario de suscriptores (crecimiento del canal). */
  subPorDia: number | null;
  /** video_perf: vistas medias por suscriptor. */
  rendimientoVideo: number | null;
  vistasPorDia: number;
}

/**
 * Umbrales de la clasificación en 5 niveles (viewtrap). Son empíricos: los valores
 * son los de la herramienta de referencia y se pueden ajustar.
 */
export const UMBRALES_GRADO = {
  perf: [0.3, 1, 3, 10], // rendimiento: vistas ÷ suscriptores
  contrib: [0.3, 0.7, 1.5, 3], // contribución: vistas ÷ media del canal
  subPorMilVistas: [0.5, 1, 3, 8], // suscriptores por cada 1.000 vistas
  subPorDia: [5, 30, 150, 800], // suscriptores por día
  rendimientoVideo: [0.1, 0.3, 1, 3], // vistas medias ÷ suscriptores
} as const;

export type NombreMetrica = keyof typeof UMBRALES_GRADO;

export const ETIQUETAS_GRADO = ['Malo', 'Regular', 'Normal', 'Bueno', 'Excelente'] as const;

/** Clasifica un valor en 5 niveles según los umbrales. Devuelve '-' si no hay dato. */
export function grado(metrica: NombreMetrica, valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '-';
  const umbrales = UMBRALES_GRADO[metrica];
  const nivel = umbrales.filter((b) => valor >= b).length;
  return ETIQUETAS_GRADO[nivel];
}

const MS_DIA = 86400000;
const redondear = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

export function diasDesde(iso: string, ahora = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (ahora - t) / MS_DIA);
}

/** Vistas por día desde su publicación: rendimiento corregido por antigüedad. */
export function velocidadVideo(v: YTVideo, ahora = Date.now()): number {
  const d = diasDesde(v.publicado, ahora);
  // Mínimo 0.5 días para no inflar los vídeos recién subidos.
  return v.vistas / Math.max(0.5, d);
}

/** Calcula las métricas de un canal a partir de los datos crudos de la API. */
export function metricasCanal(
  raw: {
    id: string;
    nombre: string;
    subs: number;
    vistasTotales: number;
    videos: number;
    creado: string;
  },
  ahora = Date.now()
): MetricaCanal {
  const diasCanal = Math.max(1, Math.floor(diasDesde(raw.creado, ahora)));
  const vistasMedia = raw.videos ? raw.vistasTotales / raw.videos : 0;
  return {
    id: raw.id,
    nombre: raw.nombre,
    subs: raw.subs,
    vistasTotales: raw.vistasTotales,
    videos: raw.videos,
    diasCanal,
    vistasMedia: Math.round(vistasMedia),
    subPorMilVistas: raw.vistasTotales ? redondear((raw.subs / raw.vistasTotales) * 1000) : null,
    subPorDia: redondear(raw.subs / diasCanal, 1),
    rendimientoVideo: raw.subs ? redondear(vistasMedia / raw.subs) : null,
    vistasPorDia: Math.round(raw.vistasTotales / diasCanal),
  };
}

const STOPWORDS = new Set(
  ('a al los las el la de del que y o un una unos unas por para con sin en su sus se lo al ' +
    'como más pero sus es son fue ser está están este esta estos estas ese esa eso mi tu ' +
    'the a an of to and or in on for with how why what is are was were this that these those ' +
    'i you he she it we they my your our their at from by about into over after before not no ' +
    'can could would should will shall may might must does did have has had been being also ' +
    'just even very really than then them there here when where which who whose because while ' +
    'until upon under between during against through without within around across behind ' +
    'como mas pero sus este esta ese esa eso mi tu su le les ya ni si hay va van da dar ser ' +
    'hacer hace hacen tiene tienen estaba muy poco cada otro otra otros otras')
    .split(/\s+/)
);

function tokenizar(texto: string): string[] {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function mediana(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface VideoInforme {
  id: string;
  titulo: string;
  vistas: number;
  vistasPorDia: number;
  duracionSeg: number;
  likes: number;
  comentarios: number;
  canal?: string;
  /** perf: vistas ÷ suscriptores del canal. */
  perf: number | null;
  gradoPerf: string;
  /** contrib: vistas ÷ vistas medias del canal. */
  contrib: number | null;
  gradoContrib: string;
}

export interface InformeAnalisis {
  total: number;
  periodoDias: number;
  canales: MetricaCanal[];
  destacados: VideoInforme[];
  top: VideoInforme[];
  palabrasTitulo: PalabraTitulo[];
  etiquetasTop: PalabraTitulo[];
  duracionMediaTop: number;
  duracionMediaResto: number;
  vistasMediaTop: number;
  vistasMediaResto: number;
  publicacionesPorSemana: number;
  /** % de Shorts con rendimiento >= 10 (great_ratio). */
  ratioExcelentes: number | null;
  /** 'perf' si se pudo ordenar por rendimiento, 'velocidad' si no había datos de canal. */
  ordenadoPor: 'perf' | 'velocidad';
  sugerencias: string[];
}

/** Analiza vídeos (y sus canales) y devuelve el informe de patrones. */
export function analizarVideos(
  videos: YTVideo[],
  opts: {
    periodoDias?: number;
    topN?: number;
    ahora?: number;
    canales?: Record<string, MetricaCanal>;
  } = {}
): InformeAnalisis {
  const ahora = opts.ahora ?? Date.now();
  const periodoDias = opts.periodoDias ?? 90;
  const topN = opts.topN ?? 10;
  const mapaCanales = opts.canales ?? {};

  const conVel = videos.map((v) => {
    const vel = velocidadVideo(v, ahora);
    const c = v.canalId ? mapaCanales[v.canalId] : undefined;
    const subs = c?.subs ?? 0;
    const vistasMedia = c?.vistasMedia ?? 0;
    const perf = subs ? redondear(v.vistas / subs) : null;
    const contrib = vistasMedia ? redondear(v.vistas / vistasMedia) : null;
    return { v, vel, perf, contrib };
  });

  // Orden: primero por rendimiento (vistas ÷ suscriptores), que es lo que detecta
  // outliers; si no hay datos de canal, todos tienen perf=null y el orden recae en
  // la velocidad (vistas/día), manteniendo el comportamiento anterior.
  const hayPerf = conVel.some((x) => x.perf !== null);
  conVel.sort((a, b) => {
    if (hayPerf) {
      const pa = a.perf ?? -1;
      const pb = b.perf ?? -1;
      if (pb !== pa) return pb - pa;
    }
    return b.vel - a.vel;
  });

  // Dos grupos:
  //  - destacados: los mejores para MOSTRAR (hasta topN).
  //  - top: el grupo de ANÁLISIS (~25% del total) con el que se comparan patrones.
  const destacados = conVel.slice(0, topN);
  const tamTop = Math.max(1, Math.min(topN, Math.ceil(videos.length * 0.25)));
  const top = conVel.slice(0, tamTop);
  const resto = conVel.slice(tamTop);

  const aVideo = (x: (typeof conVel)[number]): VideoInforme => ({
    id: x.v.id,
    titulo: x.v.titulo,
    vistas: x.v.vistas,
    vistasPorDia: Math.round(x.vel),
    duracionSeg: x.v.duracionSeg,
    likes: x.v.likes,
    comentarios: x.v.comentarios,
    canal: x.v.canal,
    perf: x.perf,
    gradoPerf: grado('perf', x.perf),
    contrib: x.contrib,
    gradoContrib: grado('contrib', x.contrib),
  });

  // --- Palabras de título ---
  const contador = new Map<string, { veces: number; enTop: number }>();
  for (const { v } of conVel) {
    for (const p of new Set(tokenizar(v.titulo))) {
      const c = contador.get(p) ?? { veces: 0, enTop: 0 };
      c.veces += 1;
      contador.set(p, c);
    }
  }
  for (const { v } of top) {
    for (const p of new Set(tokenizar(v.titulo))) {
      const c = contador.get(p);
      if (c) c.enTop += 1;
    }
  }
  const todasPalabras = [...contador.entries()]
    .map(([palabra, c]) => ({
      palabra,
      veces: c.veces,
      enTop: c.enTop,
      ratioTop: tamTop ? c.enTop / tamTop : 0,
    }))
    .filter((p) => p.veces >= 2);
  // La lista debe servir para escribir títulos: si alguna palabra la usa el grupo
  // ganador, se muestran solo esas. Si ninguna se repite en el top (canales con
  // pocos Shorts), se muestra lo más frecuente del conjunto como referencia.
  const enElTop = todasPalabras
    .filter((p) => p.enTop >= 1)
    .sort((a, b) => b.enTop - a.enTop || b.veces - a.veces || a.palabra.localeCompare(b.palabra));
  const palabrasTitulo: PalabraTitulo[] = (
    enElTop.length
      ? enElTop
      : [...todasPalabras].sort((a, b) => b.veces - a.veces || a.palabra.localeCompare(b.palabra))
  ).slice(0, 15);

  // --- Etiquetas ---
  const contEtq = new Map<string, number>();
  for (const { v } of conVel)
    for (const e of new Set(v.etiquetas ?? [])) {
      const k = e.toLowerCase().trim();
      if (k) contEtq.set(k, (contEtq.get(k) ?? 0) + 1);
    }
  const etiquetasTop: PalabraTitulo[] = [...contEtq.entries()]
    .map(([palabra, veces]) => ({ palabra, veces, enTop: 0, ratioTop: 0 }))
    .sort((a, b) => b.veces - a.veces)
    .slice(0, 15);

  // --- Duraciones y vistas medias ---
  const durTop = top.map((t) => t.v.duracionSeg).filter((n) => n > 0);
  const durResto = resto.map((t) => t.v.duracionSeg).filter((n) => n > 0);
  const duracionMediaTop = Math.round(mediana(durTop));
  const duracionMediaResto = Math.round(mediana(durResto));
  const vistasMediaTop = Math.round(top.reduce((s, t) => s + t.v.vistas, 0) / (top.length || 1));
  const vistasMediaResto = Math.round(resto.reduce((s, t) => s + t.v.vistas, 0) / (resto.length || 1));

  // --- Cadencia ---
  const semanas = Math.max(1, periodoDias / 7);
  const publicacionesPorSemana = Math.round((videos.length / semanas) * 10) / 10;

  // --- great_ratio: % de Shorts con perf >= 10 ---
  const conPerf = conVel.filter((x) => x.perf !== null);
  const ratioExcelentes = conPerf.length
    ? Math.round((conPerf.filter((x) => (x.perf as number) >= 10).length / conPerf.length) * 1000) / 10
    : null;

  const canales: MetricaCanal[] = Object.values(mapaCanales).sort(
    (a, b) => (b.subPorDia ?? 0) - (a.subPorDia ?? 0)
  );

  // --- Sugerencias ---
  const sugerencias: string[] = [];
  if (duracionMediaTop > 0) {
    const comp =
      duracionMediaResto > 0 && duracionMediaTop < duracionMediaResto
        ? ' (más cortos que la media del resto)'
        : duracionMediaResto > 0 && duracionMediaTop > duracionMediaResto
          ? ' (algo más largos que la media del resto)'
          : '';
    sugerencias.push(
      `Los que mejor rinden duran ~${duracionMediaTop}s${comp}. Apunta tus Shorts a esa duración.`
    );
  }
  if (palabrasTitulo.length) {
    const fuertes = palabrasTitulo
      .filter((p) => p.ratioTop >= 0.3)
      .slice(0, 6)
      .map((p) => p.palabra);
    if (fuertes.length)
      sugerencias.push(
        `Palabras que se repiten en los títulos ganadores: ${fuertes.join(', ')}. Úsalas en tu «Título arriba».`
      );
  }

  const mejor = destacados[0];
  if (mejor && mejor.perf !== null) {
    sugerencias.push(
      `Mayor outlier: «${mejor.v.titulo.slice(0, 60)}» rinde ${mejor.perf}× sus suscriptores (${grado('perf', mejor.perf)}). Copia su estructura.`
    );
  } else if (mejor) {
    sugerencias.push(
      `Tu mejor referencia reciente: «${mejor.v.titulo.slice(0, 70)}» con ${mejor.v.vistas.toLocaleString('es-ES')} vistas.`
    );
  }
  if (ratioExcelentes !== null) {
    sugerencias.push(
      ratioExcelentes >= 20
        ? `${ratioExcelentes}% de sus Shorts superan 10× sus suscriptores: aciertan el formato a menudo.`
        : `Solo el ${ratioExcelentes}% de sus Shorts supera 10× sus suscriptores: la mayoría se queda en lo normal, así que hay margen para destacar.`
    );
  }
  if (publicacionesPorSemana >= 1)
    sugerencias.push(
      `Publican ~${publicacionesPorSemana} vídeos/semana. Mantén una cadencia constante para que el algoritmo te dé alcance.`
    );
  else if (videos.length)
    sugerencias.push('Publican poco: hay hueco si tú mantienes una cadencia mayor.');

  return {
    total: videos.length,
    periodoDias,
    canales,
    destacados: destacados.map(aVideo),
    top: top.map(aVideo),
    palabrasTitulo,
    etiquetasTop,
    duracionMediaTop,
    duracionMediaResto,
    vistasMediaTop,
    vistasMediaResto,
    publicacionesPorSemana,
    ratioExcelentes,
    ordenadoPor: hayPerf ? 'perf' : 'velocidad',
    sugerencias,
  };
}
