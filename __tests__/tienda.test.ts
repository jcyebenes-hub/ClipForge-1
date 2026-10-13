import { describe, expect, it } from 'vitest';
import { recordarTienda, vieneDeLaTienda } from '../src/lib/tienda';

describe('versión de la tienda', () => {
  it('el navegador normal no es la tienda', () => {
    expect(vieneDeLaTienda('', '')).toBe(false);
    expect(vieneDeLaTienda('?fuente=web', 'https://clipforge-7hdq.onrender.com/')).toBe(false);
  });

  it('la dirección de empaquetado sí lo es', () => {
    expect(vieneDeLaTienda('?fuente=play', '')).toBe(true);
  });

  it('Android avisa con android-app aunque no haya parámetro', () => {
    expect(vieneDeLaTienda('', 'android-app://app.clipforge.twa')).toBe(true);
  });

  it('una vez marcada, sigue oculta el cobro al cambiar de página', () => {
    const caja = new Map<string, string>();
    const leer = () => caja.get('clipforge_tienda') ?? null;
    const guardar = (v: string) => caja.set('clipforge_tienda', v);

    expect(recordarTienda('?fuente=play', '', leer, guardar)).toBe(true);
    expect(recordarTienda('', '', leer, guardar)).toBe(true);
  });

  it('no marca la sesión si es una visita normal', () => {
    let guardado = false;
    recordarTienda('', 'https://google.com', () => null, () => {
      guardado = true;
    });
    expect(guardado).toBe(false);
  });
});
