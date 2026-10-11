/**
 * analisisYoutube.ts — motor de análisis de competencia/tendencias (Fase 2).
 *
 * Funciones PURAS (sin red): reciben vídeos ya descargados de la API de YouTube y
 * extraen los patrones de los que más rinden en los últimos N días, para orientar la
 * creación de Shorts: qué duran, qué palabras usan en el título, cada cuánto publican.
 *
 * Se prueba con datos simulados en __tests__/analisisYoutube.test.ts.
 * La descarga desde YouTube vive en /api/competencia (usa la clave en el servidor).
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
}

export interface PalabraTitulo {
  palabra: string;
  veces: number;      // apariciones en TODOS los títulos analizados
  enTop: number;      // cuántos de los TOP la usan
  ratioTop: number;   // enTop / nº de top (0..1)
}

export interface InformeAnalisis {
  total: number;
  periodoDias: number;
  canales: string[];
  destacados: Array<{
    id: string;
    titulo: string;
    vistas: number;
    vistasPorDia: number;
    duracionSeg: number;
    likes: number;
    comentarios: number;
    canal?: string;
  }>;
  top: Array<{
    id: string;
    titulo: string;
    vistas: number;
    vistasPorDia: number;
    duracionSeg: number;
    likes: number;
    comentarios: number;
    canal?: string;
  }>;
  palabrasTitulo: PalabraTitulo[];
  etiquetasTop: PalabraTitulo[];
  duracionMediaTop: number;
  duracionMediaResto: number;
  vistasMediaTop: number;
  vistasMediaResto: number;
  publicacionesPorSemana: number;
  sugerencias: string[];
}

const STOPWORDS = new Set(
  ('a al los las el la de del que y o un una unos unas por para con sin en su sus se lo al ' +
    'como más pero sus es son fue ser está están este esta estos estas ese esa eso mi tu ' +
    'the a an of to and or in on for with how why what is are was were this that these those ' +
    'i you he she it we they my your our their at from by about into over after before not no')
    .split(/\s+/)
);

const MS_DIA = 86400000;

export function diasDesde(iso: string, ahora = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (ahora - t) / MS_DIA);
}

/** Vistas por día desde su publicación: mide el rendimiento corregido por antigüedad. */
export function velocidadVideo(v: YTVideo, ahora = Date.now()): number {
  const d = diasDesde(v.publicado, ahora);
  return v.vistas / Math.max(1, d);
}

function tokenizar(texto: string): string[] {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // quita tildes
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

/** Analiza un conjunto de vídeos y devuelve el informe de patrones. */
export function analizarVideos(
  videos: YTVideo[],
  opts: { periodoDias?: number; topN?: number; ahora?: number } = {}
): InformeAnalisis {
  const ahora = opts.ahora ?? Date.now();
  const periodoDias = opts.periodoDias ?? 90;
  const topN = opts.topN ?? 10;

  const conVel = videos.map((v) => ({ v, vel: velocidadVideo(v, ahora) }));
  conVel.sort((a, b) => b.vel - a.vel);

  // Dos grupos distintos:
  //  - destacados: los mejores para MOSTRAR (hasta topN).
  //  - top: el grupo de ANÁLISIS (~25% del total) con el que se comparan patrones.
  //    Usar el 25% evita que, con pocos vídeos, el "resto" quede vacío y la
  //    comparación top-vs-resto no signifique nada.
  const destacados = conVel.slice(0, topN);
  const tamTop = Math.max(1, Math.min(topN, Math.ceil(videos.length * 0.25)));
  const top = conVel.slice(0, tamTop);
  const resto = conVel.slice(tamTop);

  // Palabras de título: frecuencia global (veces) y adopción en el top (enTop).
  const contador = new Map<string, { veces: number; enTop: number }>();
  for (const { v } of conVel) {
    for (const p of new Set(tokenizar(v.titulo))) {
      const c = contador.get(p) ?? { veces: 0, enTop: 0 };
      c.veces += 1; // una vez por título
      contador.set(p, c);
    }
  }
  for (const { v } of top) {
    for (const p of new Set(tokenizar(v.titulo))) {
      const c = contador.get(p);
      if (c) c.enTop += 1;
    }
  }
  const palabrasTitulo: PalabraTitulo[] = [...contador.entries()]
    .map(([palabra, c]) => ({
      palabra,
      veces: c.veces,
      enTop: c.enTop,
      ratioTop: top.length ? c.enTop / top.length : 0,
    }))
    .filter((p) => p.veces >= 2)
    .sort((a, b) => b.enTop - a.enTop || b.veces - a.veces || a.palabra.localeCompare(b.palabra))
    .slice(0, 15);

  // Etiquetas.
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

  const durTop = top.map((t) => t.v.duracionSeg).filter((n) => n > 0);
  const durResto = resto.map((t) => t.v.duracionSeg).filter((n) => n > 0);
  const duracionMediaTop = Math.round(mediana(durTop));
  const duracionMediaResto = Math.round(mediana(durResto));
  const vistasMediaTop = Math.round(top.reduce((s, t) => s + t.v.vistas, 0) / (top.length || 1));
  const vistasMediaResto = Math.round(resto.reduce((s, t) => s + t.v.vistas, 0) / (resto.length || 1));

  // Cadencia: publicaciones por semana en el periodo.
  const semanas = Math.max(1, periodoDias / 7);
  const publicacionesPorSemana = Math.round((videos.length / semanas) * 10) / 10;

  const canales = [...new Set(videos.map((v) => v.canal).filter(Boolean))] as string[];

  // Sugerencias accionables derivadas de los números.
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
  if (publicacionesPorSemana >= 1)
    sugerencias.push(
      `Publican ~${publicacionesPorSemana} vídeos/semana. Mantén una cadencia constante para que el algoritmo te dé alcance.`
    );
  else if (videos.length)
    sugerencias.push('Publican poco: hay hueco si tú mantienes una cadencia mayor.');

  const masVisto = destacados[0];
  if (masVisto)
    sugerencias.push(
      `Tu mejor referencia reciente: «${masVisto.v.titulo.slice(0, 70)}» con ${masVisto.v.vistas.toLocaleString('es-ES')} vistas.`
    );

  return {
    total: videos.length,
    periodoDias,
    canales,
    destacados: destacados.map((t) => ({
      id: t.v.id,
      titulo: t.v.titulo,
      vistas: t.v.vistas,
      vistasPorDia: Math.round(t.vel),
      duracionSeg: t.v.duracionSeg,
      likes: t.v.likes,
      comentarios: t.v.comentarios,
      canal: t.v.canal,
    })),
    top: top.map((t) => ({
      id: t.v.id,
      titulo: t.v.titulo,
      vistas: t.v.vistas,
      vistasPorDia: Math.round(t.vel),
      duracionSeg: t.v.duracionSeg,
      likes: t.v.likes,
      comentarios: t.v.comentarios,
      canal: t.v.canal,
    })),
    palabrasTitulo,
    etiquetasTop,
    duracionMediaTop,
    duracionMediaResto,
    vistasMediaTop,
    vistasMediaResto,
    publicacionesPorSemana,
    sugerencias,
  };
}
