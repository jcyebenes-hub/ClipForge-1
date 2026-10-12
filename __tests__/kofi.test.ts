import { describe, it, expect } from 'vitest';
import { urlKoFi, KOFI_URL_POR_DEFECTO } from '../src/lib/kofi';

describe('urlKoFi', () => {
  it('devuelve el enlace por defecto cuando no hay variable de entorno', () => {
    // En el bundle de test VITE_KOFI_URL no está definida, así que manda el fallback.
    expect(urlKoFi()).toBe(KOFI_URL_POR_DEFECTO);
  });

  it('el enlace por defecto es el real de ClipForge', () => {
    // Fija la URL: si alguien la cambia sin querer, esto salta.
    expect(KOFI_URL_POR_DEFECTO).toBe('https://ko-fi.com/clipforge1');
  });

  it('nunca devuelve una cadena vacía', () => {
    // Los tres componentes que la usan dependen de esto para renderizar.
    expect(urlKoFi().trim().length).toBeGreaterThan(0);
  });

  it('es una URL absoluta de Ko-fi, no una ruta relativa', () => {
    expect(urlKoFi()).toMatch(/^https:\/\/ko-fi\.com\//);
  });
});
