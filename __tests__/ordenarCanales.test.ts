import { describe, it, expect } from 'vitest';
import {
  ordenarCanales,
  siguienteOrden,
  flechaOrden,
  CAMPO_POR_DEFECTO,
  DIRECCION_POR_DEFECTO,
  COLUMNAS_CANAL,
} from '../src/lib/ordenarCanales';
import type { MetricaCanal } from '../src/lib/analisisYoutube';

function canal(parcial: Partial<MetricaCanal> & { id: string; nombre: string }): MetricaCanal {
  return {
    subs: 0,
    vistasTotales: 0,
    videos: 0,
    diasCanal: 100,
    vistasMedia: 0,
    subPorMilVistas: null,
    subPorDia: null,
    rendimientoVideo: null,
    vistasPorDia: 0,
    ...parcial,
  };
}

const TRES = [
  canal({ id: 'a', nombre: 'MrBeast', subs: 300000000, subPorDia: 500, vistasMedia: 1000000, rendimientoVideo: 0.2 }),
  canal({ id: 'b', nombre: 'georgitocraft', subs: 326000, subPorDia: 2187, vistasMedia: 90000, rendimientoVideo: 1.1 }),
  canal({ id: 'c', nombre: 'SenaVD', subs: 588000, subPorDia: 1979, vistasMedia: 120000, rendimientoVideo: 0.9 }),
];

describe('ordenarCanales · números', () => {
  it('por suscriptores, de mayor a menor', () => {
    expect(ordenarCanales(TRES, 'subs', 'desc').map((c) => c.nombre)).toEqual([
      'MrBeast',
      'SenaVD',
      'georgitocraft',
    ]);
  });

  it('por suscriptores, de menor a mayor', () => {
    expect(ordenarCanales(TRES, 'subs', 'asc').map((c) => c.nombre)).toEqual([
      'georgitocraft',
      'SenaVD',
      'MrBeast',
    ]);
  });

  it('por crecimiento diario reproduce el orden con el que ya venía la tabla', () => {
    expect(ordenarCanales(TRES, CAMPO_POR_DEFECTO, DIRECCION_POR_DEFECTO).map((c) => c.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });
});

describe('ordenarCanales · nombres', () => {
  it('ordena alfabéticamente sin que las mayúsculas manden', () => {
    expect(ordenarCanales(TRES, 'nombre', 'asc').map((c) => c.nombre)).toEqual([
      'georgitocraft',
      'MrBeast',
      'SenaVD',
    ]);
  });

  it('y al revés', () => {
    expect(ordenarCanales(TRES, 'nombre', 'desc').map((c) => c.nombre)).toEqual([
      'SenaVD',
      'MrBeast',
      'georgitocraft',
    ]);
  });
});

describe('ordenarCanales · valores vacíos', () => {
  const CON_NULOS = [
    canal({ id: 'a', nombre: 'ConDatos', subs: 1000, subPorDia: 10, rendimientoVideo: 0.5 }),
    canal({ id: 'b', nombre: 'SinCrecimiento', subs: 9000, subPorDia: null, rendimientoVideo: 2 }),
    canal({ id: 'c', nombre: 'SinRendimiento', subs: 5000, subPorDia: 40, rendimientoVideo: null }),
  ];

  it('los nulos van al final al ordenar de mayor a menor', () => {
    expect(ordenarCanales(CON_NULOS, 'subPorDia', 'desc').map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('y también al ordenar de menor a mayor, que es donde se colarían arriba si se trataran como 0', () => {
    expect(ordenarCanales(CON_NULOS, 'subPorDia', 'asc').map((c) => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('si todos son nulos, se conserva el orden original', () => {
    const todos = [
      canal({ id: 'a', nombre: 'A', subPorDia: null }),
      canal({ id: 'b', nombre: 'B', subPorDia: null }),
    ];
    expect(ordenarCanales(todos, 'subPorDia', 'asc').map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('NaN e Infinity se tratan como vacíos, no como números', () => {
    const raros = [
      canal({ id: 'a', nombre: 'A', subs: 10 }),
      canal({ id: 'b', nombre: 'B', subs: NaN }),
      canal({ id: 'c', nombre: 'C', subs: Infinity }),
    ];
    // Solo 'a' es un número válido; los otros dos caen al final.
    expect(ordenarCanales(raros, 'subs', 'desc').map((c) => c.id)[0]).toBe('a');
  });
});

describe('ordenarCanales · no rompe nada', () => {
  it('NO modifica la lista que recibe (vive en el estado de React)', () => {
    const original = [...TRES];
    const antes = original.map((c) => c.id).join(',');
    ordenarCanales(original, 'subs', 'desc');
    expect(original.map((c) => c.id).join(',')).toBe(antes);
  });

  it('devuelve un array nuevo, no el mismo', () => {
    expect(ordenarCanales(TRES, 'subs', 'desc')).not.toBe(TRES);
  });

  it('los empates conservan el orden original en vez de barajar', () => {
    const empate = [
      canal({ id: 'a', nombre: 'A', subs: 100 }),
      canal({ id: 'b', nombre: 'B', subs: 100 }),
      canal({ id: 'c', nombre: 'C', subs: 100 }),
    ];
    expect(ordenarCanales(empate, 'subs', 'desc').map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(ordenarCanales(empate, 'subs', 'asc').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('lista vacía o inválida', () => {
    expect(ordenarCanales([], 'subs')).toEqual([]);
    expect(ordenarCanales(null as unknown as MetricaCanal[], 'subs')).toEqual([]);
  });
});

describe('siguienteOrden · lo que hace pinchar una cabecera', () => {
  it('pinchar otra columna empieza en descendente', () => {
    expect(siguienteOrden({ campo: 'subPorDia', direccion: 'asc' }, 'subs')).toEqual({
      campo: 'subs',
      direccion: 'desc',
    });
  });

  it('pinchar la misma columna invierte la dirección', () => {
    expect(siguienteOrden({ campo: 'subs', direccion: 'desc' }, 'subs')).toEqual({
      campo: 'subs',
      direccion: 'asc',
    });
    expect(siguienteOrden({ campo: 'subs', direccion: 'asc' }, 'subs')).toEqual({
      campo: 'subs',
      direccion: 'desc',
    });
  });
});

describe('flechaOrden', () => {
  it('marca solo la columna activa', () => {
    const activo = { campo: 'subs' as const, direccion: 'desc' as const };
    expect(flechaOrden(activo, 'subs')).toBe('↓');
    expect(flechaOrden({ ...activo, direccion: 'asc' }, 'subs')).toBe('↑');
    expect(flechaOrden(activo, 'nombre')).toBe('');
  });
});

describe('las cabeceras de la interfaz cuadran con los campos', () => {
  it('hay una columna por cada campo ordenable', () => {
    expect(COLUMNAS_CANAL.map((c) => c.etiqueta)).toEqual([
      'Canal',
      'Subs',
      'Subs/día',
      'Vistas media',
      'Rendim. vídeo',
    ]);
    expect(new Set(COLUMNAS_CANAL.map((c) => c.campo)).size).toBe(COLUMNAS_CANAL.length);
  });
});
