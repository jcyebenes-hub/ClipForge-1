/**
 * lib/musicaFondo.ts
 *
 * Música de fondo para los clips. Construye los trozos de `filter_complex` que
 * FFmpeg necesita para mezclar una pista con el audio original del vídeo.
 *
 * Por qué un módulo aparte: son funciones puras (no tocan FFmpeg ni el DOM), así
 * que se pueden probar sin navegador.
 *
 * La pista se reproduce en bucle (`-stream_loop -1`) para que cubra clips de
 * cualquier duración, y se desvanece al final para que el corte no quede seco.
 */

export interface MusicaFondo {
  /** Archivo de audio subido por el usuario (mp3, wav, m4a…). */
  blob: Blob;
  /** Volumen de la música respecto al audio original. 0.2 = música al 20 %. */
  volumen: number;
}

export const VOLUMEN_POR_DEFECTO = 0.2;

/** Segundos de fundido de salida. En clips más cortos se reduce o se omite. */
export const DESVANECIDO_SEG = 2;

/**
 * Devuelve los filtros para `filter_complex` que mezclan la música.
 *
 * Asume que la entrada 0 es el vídeo (con su audio) y la entrada 1 la música.
 * `duration=first` hace que el resultado dure lo que el vídeo, no lo que la
 * pista en bucle.
 */
export function construirFiltrosMusica(opts: {
  volumen: number;
  duracionSeg: number;
  etiquetaVideo?: string;
  etiquetaMusica?: string;
}): { filtros: string[]; salida: string } {
  const { volumen, duracionSeg } = opts;
  const entradaVideo = opts.etiquetaVideo ?? '[0:a]';
  const entradaMusica = opts.etiquetaMusica ?? '[1:a]';

  // El volumen se limita a un rango sensato: por encima de 1 la pista satura.
  const vol = Math.min(1, Math.max(0, Number.isFinite(volumen) ? volumen : VOLUMEN_POR_DEFECTO));

  const duracion = Math.max(0.5, duracionSeg);
  const filtros: string[] = [];

  let cadenaMusica = `${entradaMusica}volume=${vol.toFixed(3)}`;
  if (duracion > DESVANECIDO_SEG) {
    const inicio = Math.max(0, duracion - DESVANECIDO_SEG);
    cadenaMusica += `,afade=t=out:st=${inicio.toFixed(2)}:d=${DESVANECIDO_SEG}`;
  }
  filtros.push(`${cadenaMusica}[bg]`);
  filtros.push(`${entradaVideo}[bg]amix=inputs=2:duration=first:dropout_transition=0[musicamezclada]`);

  return { filtros, salida: '[musicamezclada]' };
}

/**
 * Argumentos de entrada que hay que añadir ANTES del `-i` de la música.
 * `-stream_loop` tiene que ir delante del archivo al que afecta.
 */
export function argsEntradaMusica(): string[] {
  return ['-stream_loop', '-1'];
}
