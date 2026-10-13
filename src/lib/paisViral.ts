/**
 * País de la búsqueda de vídeos virales.
 *
 * YouTube no dice dónde se grabó un vídeo. `regionCode` significa «se puede ver
 * en ese país». Lo único fiable del origen es el país que el canal declara, y
 * muchos no declaran ninguno. Por eso:
 *   - el país pedido se manda a YouTube como sugerencia
 *   - si el canal declara OTRO país, se quita
 *   - si no declara país, se queda, siempre que el idioma encaje
 */

const HISPANO = new Set([
  'ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO',
  'CR', 'PA', 'GT', 'HN', 'SV', 'NI', 'DO', 'CU', 'PR', 'GQ',
]);

const IDIOMA: Record<string, string> = {
  BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt',
  US: 'en', GB: 'en', IE: 'en', AU: 'en', NZ: 'en', CA: 'en',
  FR: 'fr', BE: 'fr',
  DE: 'de', AT: 'de',
  IT: 'it',
  NL: 'nl',
};

/** Países que salen en el desplegable, además del detectado. */
export const PAISES_SELECTOR = [
  'ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY',
  'US', 'GB', 'BR', 'FR', 'DE', 'IT', 'PT',
];

export const CLAVE_MERCADO_ELEGIDO = 'clipforge_mercado_viral';

export function idiomaDePais(iso: string): string {
  const c = iso.trim().toUpperCase();
  if (HISPANO.has(c)) return 'es';
  return IDIOMA[c] || '';
}

export function banderaDePais(iso: string): string {
  const c = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '🌐';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function nombrePais(iso: string): string {
  const c = iso.trim().toUpperCase();
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(c) || c;
  } catch {
    return c;
  }
}

/** null si la cabecera no trae un país de verdad (XX y T1 son «desconocido»). */
export function paisDeCabecera(valor: string | null | undefined): string | null {
  const c = String(valor || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  if (c === 'XX' || c === 'T1') return null;
  return c;
}

/**
 * Solo descarta cuando el canal HA declarado un país y no es el pedido.
 * Un canal sin país no se tira: YouTube no lo dice, y tirarlo vaciaría la lista.
 */
export function debeDescartarPorPais(paisPedido: string, paisCanal?: string | null): boolean {
  const pedido = paisPedido.trim().toUpperCase();
  if (!pedido || pedido === 'GLOBAL' || pedido === 'LATAM') return false;
  const canal = String(paisCanal || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(canal)) return false;
  return canal !== pedido;
}
