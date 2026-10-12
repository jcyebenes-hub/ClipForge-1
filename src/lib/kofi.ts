/**
 * lib/kofi.ts
 * El enlace de apoyo en Ko-fi, en un solo sitio.
 *
 * POR QUÉ ESTÁ EN EL CÓDIGO Y NO SOLO EN EL ENTORNO
 * --------------------------------------------------
 * Es una URL PÚBLICA de donaciones, no una credencial: no hay ningún riesgo en
 * que viaje dentro del bundle. Se dejó aquí como valor por defecto porque la
 * clave de la API de Render caducó y no se podía añadir VITE_KOFI_URL al
 * entorno; el resultado era que los tres componentes que dependen de esa
 * variable no se renderizaban y no existía ninguna vía de apoyo.
 *
 * `VITE_KOFI_URL` sigue teniendo prioridad si se configura, así que se puede
 * cambiar el enlace sin tocar el código.
 */

/** Enlace por defecto. */
export const KOFI_URL_POR_DEFECTO = 'https://ko-fi.com/clipforge1';

/**
 * Devuelve el enlace de Ko-fi que hay que usar.
 * Nunca devuelve una cadena vacía: siempre hay un destino al que mandar al usuario.
 */
export function urlKoFi(): string {
  const delEntorno = ((import.meta.env.VITE_KOFI_URL as string | undefined) || '').trim();
  return delEntorno || KOFI_URL_POR_DEFECTO;
}
