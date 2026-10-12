/**
 * lib/ordenarCanales.ts
 * Ordenación de la tabla «Canales: tamaño y crecimiento».
 *
 * Tres cosas que parecen tonterías y no lo son:
 *
 * 1. NO MUTA la lista que recibe. `informe.canales` vive en el estado de React:
 *    ordenarla en el sitio cambiaría el informe original y el orden se perdería
 *    al volver a analizar.
 * 2. Los valores nulos van SIEMPRE al final, también en orden ascendente.
 *    `subPorDia` y `rendimientoVideo` son null cuando YouTube oculta los
 *    suscriptores del canal; si se trataran como 0 aparecerían arriba al ordenar
 *    de menor a mayor, que es justo lo que no interesa ver.
 * 3. Los empates se deshacen por la posición original, para que ordenar no
 *    baraje la tabla de forma distinta cada vez que se pincha.
 *
 * Módulo PURO (sin red ni Supabase) para poder probarlo en Node.
 */

import type { MetricaCanal } from './analisisYoutube';

export type CampoOrdenCanal = 'nombre' | 'subs' | 'subPorDia' | 'vistasMedia' | 'rendimientoVideo';
export type DireccionOrden = 'asc' | 'desc';

/** Orden con el que llega la tabla desde el análisis: crecimiento diario. */
export const CAMPO_POR_DEFECTO: CampoOrdenCanal = 'subPorDia';
export const DIRECCION_POR_DEFECTO: DireccionOrden = 'desc';

/** Cabeceras de la tabla, en el orden en que se ven. */
export const COLUMNAS_CANAL: { campo: CampoOrdenCanal; etiqueta: string }[] = [
  { campo: 'nombre', etiqueta: 'Canal' },
  { campo: 'subs', etiqueta: 'Subs' },
  { campo: 'subPorDia', etiqueta: 'Subs/día' },
  { campo: 'vistasMedia', etiqueta: 'Vistas media' },
  { campo: 'rendimientoVideo', etiqueta: 'Rendim. vídeo' },
];

/** Devuelve true solo para números de verdad: ni null, ni NaN, ni infinito. */
function esNumero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function valorDe(canal: MetricaCanal, campo: CampoOrdenCanal): string | number | null {
  const v = (canal as unknown as Record<string, unknown>)[campo];
  if (campo === 'nombre') return typeof v === 'string' ? v : '';
  return esNumero(v) ? v : null;
}

/**
 * Devuelve una copia ordenada. El array que entra no se toca.
 */
export function ordenarCanales(
  canales: readonly MetricaCanal[],
  campo: CampoOrdenCanal,
  direccion: DireccionOrden = DIRECCION_POR_DEFECTO
): MetricaCanal[] {
  if (!Array.isArray(canales)) return [];
  const signo = direccion === 'asc' ? 1 : -1;

  return canales
    .map((canal, indice) => ({ canal, indice }))
    .sort((a, b) => {
      const va = valorDe(a.canal, campo);
      const vb = valorDe(b.canal, campo);

      // Los vacíos siempre al final, sea cual sea la dirección.
      if (va === null && vb === null) return a.indice - b.indice;
      if (va === null) return 1;
      if (vb === null) return -1;

      if (campo === 'nombre') {
        const comparacion = String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' });
        return comparacion !== 0 ? comparacion * signo : a.indice - b.indice;
      }

      const na = va as number;
      const nb = vb as number;
      if (na !== nb) return (na - nb) * signo;
      return a.indice - b.indice;
    })
    .map((x) => x.canal);
}

/** Al pinchar otra vez en la misma columna se invierte; si es otra, empieza en descendente. */
export function siguienteOrden(
  actual: { campo: CampoOrdenCanal; direccion: DireccionOrden },
  campo: CampoOrdenCanal
): { campo: CampoOrdenCanal; direccion: DireccionOrden } {
  if (actual.campo !== campo) return { campo, direccion: 'desc' };
  return { campo, direccion: actual.direccion === 'desc' ? 'asc' : 'desc' };
}

/** Flecha para la cabecera. Cadena vacía si esa columna no es la activa. */
export function flechaOrden(
  actual: { campo: CampoOrdenCanal; direccion: DireccionOrden },
  campo: CampoOrdenCanal
): string {
  if (actual.campo !== campo) return '';
  return actual.direccion === 'desc' ? '↓' : '↑';
}
