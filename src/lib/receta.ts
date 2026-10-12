/**
 * lib/receta.ts
 * La "receta" que se extrae de un Short viral y se lleva al flujo de creación.
 *
 * Propósito: convertir el informe de «Vídeos virales» en acción. El usuario ve un
 * Short que rinde, pulsa «Crear Short con esta receta» y llega a la creación con
 * el enlace, la duración objetivo y las palabras ganadoras ya puestas.
 *
 * Este módulo es PURO (sin Supabase, sin red) para poder probarlo en Node.
 * El acceso a localStorage está aislado en tres funciones y protegido con try/catch:
 * si el navegador lo bloquea, la app sigue funcionando sin la receta.
 */

export interface RecetaShort {
  /** id del vídeo de YouTube analizado. */
  videoId: string;
  titulo: string;
  canal?: string;
  /** Duración real del Short viral, en segundos. */
  duracionSeg: number;
  /** Duración media de los que mejor rinden en ese nicho, en segundos. */
  duracionObjetivo: number;
  /** Palabras que se repiten en los títulos ganadores. */
  palabras: string[];
  /** Cuándo se generó, en ISO. */
  creado: string;
}

/** Clave de localStorage. Un único sitio, para que crear y leer no diverjan. */
export const CLAVE_RECETA = 'clipforge_receta_short';

/** Ritmo por defecto de la receta Shorts (FASE 1). */
export const RITMO_RECETA = 1.3;

const MAX_PALABRAS = 6;
const MAX_TITULO = 120;

function esTexto(v: unknown): v is string {
  return typeof v === 'string';
}

function numeroEntero(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Valida lo que viene de localStorage (o de cualquier origen poco fiable).
 * Devuelve null si no es utilizable, para que un valor corrupto nunca rompa la app.
 */
export function sanearReceta(crudo: unknown): RecetaShort | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const c = crudo as Record<string, unknown>;

  const videoId = esTexto(c.videoId) ? c.videoId.trim() : '';
  // id de YouTube: 11 caracteres alfanuméricos, guiones y guiones bajos.
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;

  const duracionSeg = numeroEntero(c.duracionSeg);
  if (duracionSeg <= 0) return null;

  const duracionObjetivo = numeroEntero(c.duracionObjetivo);
  const palabras = Array.isArray(c.palabras)
    ? c.palabras.filter(esTexto).map((p) => p.trim()).filter(Boolean).slice(0, MAX_PALABRAS)
    : [];

  return {
    videoId,
    titulo: (esTexto(c.titulo) ? c.titulo : '').trim().slice(0, MAX_TITULO),
    canal: esTexto(c.canal) && c.canal.trim() ? c.canal.trim() : undefined,
    duracionSeg,
    duracionObjetivo: duracionObjetivo > 0 ? duracionObjetivo : duracionSeg,
    palabras,
    creado: esTexto(c.creado) ? c.creado : new Date().toISOString(),
  };
}

/** Enlace del Short de referencia. */
export function enlaceYoutube(videoId: string): string {
  return `https://youtube.com/watch?v=${videoId}`;
}

/**
 * Propone un título a partir de las palabras que se repiten en los títulos
 * ganadores. Es una sugerencia para editar, no un título definitivo.
 */
export function sugerirTitulo(receta: RecetaShort): string {
  if (receta.palabras.length > 0) {
    const base = receta.palabras.slice(0, 3).join(' ');
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  if (receta.titulo) return receta.titulo.slice(0, 60).trim();
  return '';
}

/**
 * Líneas legibles que resumen la receta. Se muestran tal cual en la interfaz,
 * así que van redactadas para que se entiendan sin explicar qué es un outlier.
 */
export function descripcionReceta(receta: RecetaShort): string[] {
  const lineas: string[] = [];

  lineas.push(
    receta.duracionObjetivo > 0
      ? `Apunta tu Short a ~${receta.duracionObjetivo} s (es lo que duran los que mejor rinden).`
      : 'No hay datos de duración en este nicho.',
  );

  if (receta.duracionSeg > 0 && receta.duracionObjetivo > 0 && receta.duracionSeg !== receta.duracionObjetivo) {
    const diferencia = receta.duracionSeg - receta.duracionObjetivo;
    lineas.push(
      diferencia > 0
        ? `El de referencia dura ${receta.duracionSeg} s: recorta unos ${diferencia} s.`
        : `El de referencia dura ${receta.duracionSeg} s: ya está por debajo del objetivo.`,
    );
  }

  if (receta.palabras.length > 0) {
    lineas.push(`Palabras que se repiten en los títulos ganadores: ${receta.palabras.join(', ')}.`);
  }

  lineas.push(`Ritmo ${RITMO_RECETA.toLocaleString('es-ES')}× y título arriba activados.`);

  return lineas;
}

/* ------------------------------------------------------------------ */
/* Acceso a localStorage (aislado y tolerante a fallos)                */
/* ------------------------------------------------------------------ */

function almacenamiento(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Guarda la receta. Devuelve false si el navegador no lo permite. */
export function guardarReceta(receta: RecetaShort): boolean {
  const sano = sanearReceta(receta);
  const store = almacenamiento();
  if (!sano || !store) return false;
  try {
    store.setItem(CLAVE_RECETA, JSON.stringify(sano));
    return true;
  } catch {
    return false;
  }
}

/** Lee la receta pendiente, sin borrarla. */
export function leerReceta(): RecetaShort | null {
  const store = almacenamiento();
  if (!store) return null;
  try {
    const crudo = store.getItem(CLAVE_RECETA);
    if (!crudo) return null;
    return sanearReceta(JSON.parse(crudo));
  } catch {
    return null;
  }
}

/** Borra la receta pendiente (por ejemplo cuando ya se ha aplicado). */
export function borrarReceta(): void {
  const store = almacenamiento();
  if (!store) return;
  try {
    store.removeItem(CLAVE_RECETA);
  } catch {
    /* nada que hacer */
  }
}
