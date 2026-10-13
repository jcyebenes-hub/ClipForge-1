import { describe, expect, it } from 'vitest';
import { copiarEnElGesto } from '../src/lib/portapapeles';

describe('copiar en el mismo toque', () => {
  it('no intenta copiar un texto vacío', () => {
    expect(copiarEnElGesto('')).toBe(false);
    expect(copiarEnElGesto('   ')).toBe(false);
  });
});
