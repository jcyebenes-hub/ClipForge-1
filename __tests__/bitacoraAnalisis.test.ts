import { describe, expect, it } from 'vitest';
import { anotarBitacora } from '../src/lib/bitacoraAnalisis';

describe('bitácora del análisis en vivo', () => {
  const ahora = new Date('2026-10-13T16:05:09');

  it('apunta la hora y no repite la misma frase', () => {
    const una = anotarBitacora([], 'Leyendo subtítulos', ahora);
    const dos = anotarBitacora(una, 'Leyendo subtítulos', ahora);
    expect(dos).toHaveLength(1);
    expect(dos[0].texto).toBe('Leyendo subtítulos');
    expect(dos[0].hora).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('guarda el siguiente paso distinto', () => {
    const lineas = anotarBitacora(
      anotarBitacora([], 'Leyendo subtítulos', ahora),
      'Buscando momentos',
      ahora
    );
    expect(lineas.map((l) => l.texto)).toEqual(['Leyendo subtítulos', 'Buscando momentos']);
  });
});
