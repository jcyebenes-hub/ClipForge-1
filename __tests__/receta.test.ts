import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanearReceta,
  sugerirTitulo,
  descripcionReceta,
  enlaceYoutube,
  guardarReceta,
  leerReceta,
  borrarReceta,
  CLAVE_RECETA,
  RITMO_RECETA,
  type RecetaShort,
} from '../src/lib/receta';

const VALIDA = {
  videoId: 'dQw4w9WgXcQ',
  titulo: 'Minecraft Dungeons 2 is so damn good',
  canal: 'MaccaGames',
  duracionSeg: 31,
  duracionObjetivo: 23,
  palabras: ['minecraft', 'survive'],
  creado: '2026-10-12T10:00:00.000Z',
};

function instalarLocalStorage() {
  const datos = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    setItem: (k: string, v: string) => void datos.set(k, String(v)),
    removeItem: (k: string) => void datos.delete(k),
    clear: () => datos.clear(),
    key: (i: number) => Array.from(datos.keys())[i] ?? null,
    get length() {
      return datos.size;
    },
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = stub;
  return datos;
}

describe('sanearReceta', () => {
  it('acepta una receta válida y la devuelve intacta', () => {
    expect(sanearReceta(VALIDA)).toEqual(VALIDA);
  });

  it('rechaza entradas que no son objeto', () => {
    expect(sanearReceta(null)).toBeNull();
    expect(sanearReceta(undefined)).toBeNull();
    expect(sanearReceta('minecraft')).toBeNull();
    expect(sanearReceta(42)).toBeNull();
    expect(sanearReceta([])).toBeNull();
  });

  it('rechaza un id de YouTube que no tiene 11 caracteres válidos', () => {
    expect(sanearReceta({ ...VALIDA, videoId: 'corto' })).toBeNull();
    expect(sanearReceta({ ...VALIDA, videoId: '' })).toBeNull();
    expect(sanearReceta({ ...VALIDA, videoId: 'con espacios!' })).toBeNull();
    expect(sanearReceta({ ...VALIDA, videoId: 12345678901 })).toBeNull();
  });

  it('rechaza una duración inválida', () => {
    expect(sanearReceta({ ...VALIDA, duracionSeg: 0 })).toBeNull();
    expect(sanearReceta({ ...VALIDA, duracionSeg: -5 })).toBeNull();
    expect(sanearReceta({ ...VALIDA, duracionSeg: 'abc' })).toBeNull();
  });

  it('usa la duración real como objetivo cuando el objetivo no es utilizable', () => {
    const r = sanearReceta({ ...VALIDA, duracionObjetivo: 0 });
    expect(r?.duracionObjetivo).toBe(31);
    const r2 = sanearReceta({ ...VALIDA, duracionObjetivo: undefined });
    expect(r2?.duracionObjetivo).toBe(31);
  });

  it('limpia las palabras: quita vacías, no-textos y deja 6 como mucho', () => {
    const r = sanearReceta({
      ...VALIDA,
      palabras: ['  minecraft ', '', 'survive', 7, null, 'a', 'b', 'c', 'd', 'e'],
    });
    expect(r?.palabras).toEqual(['minecraft', 'survive', 'a', 'b', 'c', 'd']);
  });

  it('no rompe si no hay lista de palabras', () => {
    const r = sanearReceta({ ...VALIDA, palabras: undefined });
    expect(r?.palabras).toEqual([]);
  });

  it('recorta un título descomunal', () => {
    const r = sanearReceta({ ...VALIDA, titulo: 'x'.repeat(500) });
    expect(r?.titulo.length).toBe(120);
  });
});

describe('sugerirTitulo', () => {
  it('propone un título con las tres primeras palabras ganadoras, con mayúscula', () => {
    expect(sugerirTitulo({ ...VALIDA, palabras: ['minecraft', 'survive', 'hardcore', 'extra'] })).toBe(
      'Minecraft survive hardcore',
    );
  });

  it('si no hay palabras, usa el principio del título original', () => {
    expect(sugerirTitulo({ ...VALIDA, palabras: [] })).toBe('Minecraft Dungeons 2 is so damn good');
  });

  it('devuelve cadena vacía si no hay nada que sugerir', () => {
    expect(sugerirTitulo({ ...VALIDA, palabras: [], titulo: '' })).toBe('');
  });
});

describe('descripcionReceta', () => {
  it('dice la duración objetivo y cuánto recortar', () => {
    const lineas = descripcionReceta(VALIDA as RecetaShort);
    expect(lineas.some((l) => l.includes('~23 s'))).toBe(true);
    expect(lineas.some((l) => l.includes('recorta unos 8 s'))).toBe(true);
  });

  it('no pide recortar cuando el de referencia ya es más corto', () => {
    const lineas = descripcionReceta({ ...VALIDA, duracionSeg: 18, duracionObjetivo: 23 });
    expect(lineas.some((l) => l.includes('ya está por debajo'))).toBe(true);
    expect(lineas.some((l) => l.includes('recorta'))).toBe(false);
  });

  it('incluye las palabras ganadoras y el ritmo', () => {
    const lineas = descripcionReceta(VALIDA as RecetaShort);
    expect(lineas.some((l) => l.includes('minecraft, survive'))).toBe(true);
    expect(lineas.some((l) => l.includes(`${RITMO_RECETA.toLocaleString('es-ES')}×`))).toBe(true);
  });

  it('avisa con honestidad cuando no hay datos de duración', () => {
    const lineas = descripcionReceta({ ...VALIDA, duracionObjetivo: 0, duracionSeg: 31 });
    expect(lineas[0]).toContain('No hay datos de duración');
  });
});

describe('enlaceYoutube', () => {
  it('construye el enlace del Short de referencia', () => {
    expect(enlaceYoutube('dQw4w9WgXcQ')).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ');
  });
});

describe('persistencia en localStorage', () => {
  beforeEach(() => {
    instalarLocalStorage();
    borrarReceta();
  });

  it('guarda y recupera la receta', () => {
    expect(guardarReceta(VALIDA as RecetaShort)).toBe(true);
    expect(leerReceta()).toEqual(VALIDA);
  });

  it('devuelve null si no hay nada guardado', () => {
    expect(leerReceta()).toBeNull();
  });

  it('no guarda una receta inválida', () => {
    expect(guardarReceta({ ...VALIDA, videoId: 'malo' } as RecetaShort)).toBe(false);
    expect(leerReceta()).toBeNull();
  });

  it('sobrevive a un JSON corrupto en lugar de lanzar', () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(CLAVE_RECETA, '{esto no es json');
    expect(leerReceta()).toBeNull();
  });

  it('ignora una receta guardada que ya no es válida', () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      CLAVE_RECETA,
      JSON.stringify({ ...VALIDA, duracionSeg: 0 }),
    );
    expect(leerReceta()).toBeNull();
  });

  it('borrarReceta deja el hueco vacío', () => {
    guardarReceta(VALIDA as RecetaShort);
    borrarReceta();
    expect(leerReceta()).toBeNull();
  });
});
