/**
 * La app de la tienda es la misma web, abierta dentro de Android.
 * Google no deja cobrar un producto digital (quitar la marca de agua) por fuera
 * de su sistema de pagos. En esa versión no hay botón de pago. En el navegador, sí.
 *
 * Se reconoce por `?fuente=play` (la dirección con la que se empaqueta) o porque
 * Android abre la web con un referrer `android-app://`. Se guarda en la sesión
 * para que no se pierda al cambiar de página.
 */

export const CLAVE_TIENDA = 'clipforge_tienda';
export const PARAM_TIENDA = 'fuente';
export const VALOR_TIENDA = 'play';

export function vieneDeLaTienda(busqueda: string, referrer = ''): boolean {
  const bruto = busqueda.startsWith('?') ? busqueda.slice(1) : busqueda;
  const params = new URLSearchParams(bruto);
  if (params.get(PARAM_TIENDA) === VALOR_TIENDA) return true;
  return referrer.includes('android-app://');
}

/** Lee la marca ya guardada. No toca window: así se puede probar. */
export function tiendaGuardada(valor: string | null): boolean {
  return valor === '1';
}

/**
 * Si esta visita viene de la tienda, deja la marca. Devuelve si hay que ocultar el cobro.
 */
export function recordarTienda(
  busqueda: string,
  referrer: string,
  leer: () => string | null,
  guardar: (valor: string) => void
): boolean {
  if (tiendaGuardada(leer())) return true;
  if (!vieneDeLaTienda(busqueda, referrer)) return false;
  guardar('1');
  return true;
}

/** Para los componentes. En el navegador normal es false. */
export function esAppDeTienda(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return recordarTienda(
      window.location.search,
      document.referrer,
      () => sessionStorage.getItem(CLAVE_TIENDA),
      (valor) => sessionStorage.setItem(CLAVE_TIENDA, valor)
    );
  } catch {
    return false;
  }
}
