import { describe, expect, it } from 'vitest';
import {
  debeDescartarPorPais,
  idiomaDePais,
  paisDeCabecera,
} from '../src/lib/paisViral';

describe('país de la búsqueda viral', () => {
  it('España pide español; Brasil, portugués; un país raro no inventa idioma', () => {
    expect(idiomaDePais('ES')).toBe('es');
    expect(idiomaDePais('mx')).toBe('es');
    expect(idiomaDePais('BR')).toBe('pt');
    expect(idiomaDePais('JP')).toBe('');
  });

  it('ignora las cabeceras que significan «no sé el país»', () => {
    expect(paisDeCabecera('ES')).toBe('ES');
    expect(paisDeCabecera('es')).toBe('ES');
    expect(paisDeCabecera('XX')).toBeNull();
    expect(paisDeCabecera('T1')).toBeNull();
    expect(paisDeCabecera('')).toBeNull();
  });

  it('quita el canal que declara otro país y deja el que no declara ninguno', () => {
    expect(debeDescartarPorPais('ES', 'BR')).toBe(true);
    expect(debeDescartarPorPais('ES', 'MX')).toBe(true);
    expect(debeDescartarPorPais('ES', 'ES')).toBe(false);
    expect(debeDescartarPorPais('ES', '')).toBe(false);
    expect(debeDescartarPorPais('ES', null)).toBe(false);
  });

  it('Latinoamérica y el mundo no tiran canales por el país declarado', () => {
    expect(debeDescartarPorPais('LATAM', 'BR')).toBe(false);
    expect(debeDescartarPorPais('GLOBAL', 'US')).toBe(false);
  });
});
