import { describe, it, expect } from 'vitest';
import {
  analizarVideos,
  velocidadVideo,
  diasDesde,
  grado,
  metricasCanal,
  type YTVideo,
} from '../src/lib/analisisYoutube';

const AHORA = Date.parse('2026-10-11T00:00:00Z');

function vid(
  id: string,
  titulo: string,
  dias: number,
  duracionSeg: number,
  vistas: number,
  canal = 'Canal',
  etiquetas: string[] = []
): YTVideo {
  const publicado = new Date(AHORA - dias * 86400000).toISOString();
  return { id, titulo, publicado, duracionSeg, vistas, likes: vistas / 10, comentarios: vistas / 100, etiquetas, canal };
}

describe('analisisYoutube', () => {
  it('ordena por vistas/día (velocidad), no por vistas totales', () => {
    const viejo = vid('a', 'Video viejo con muchas vistas', 80, 30, 1_000_000);
    const nuevo = vid('b', 'Video nuevo reciente', 2, 30, 200_000); // 100k/día > 12.5k/día
    const inf = analizarVideos([viejo, nuevo], { ahora: AHORA });
    expect(inf.destacados[0].id).toBe('b');
    expect(inf.destacados[0].vistasPorDia).toBeGreaterThan(inf.destacados[1].vistasPorDia);
  });

  it('el grupo de análisis (top) es ~25% y deja un "resto" con el que comparar', () => {
    // 8 vídeos → top = ceil(8*0.25) = 2, resto = 6
    const videos = Array.from({ length: 8 }, (_, i) =>
      vid(`v${i}`, `Titulo numero ${i}`, i + 1, 30 + i * 10, (8 - i) * 100_000)
    );
    const inf = analizarVideos(videos, { ahora: AHORA, topN: 10 });
    expect(inf.destacados.length).toBe(8); // destacados muestra todos (hasta topN)
    expect(inf.top.length).toBe(2);
    // duraciones top = 30 y 40 → mediana 35 ; resto = 50..100 → mediana 75
    expect(inf.duracionMediaTop).toBe(35);
    expect(inf.duracionMediaResto).toBe(75);
    expect(inf.vistasMediaResto).toBeGreaterThan(0);
  });

  it('detecta las palabras que se repiten en los títulos ganadores', () => {
    const videos = [
      vid('1', 'Cómo ganar dinero', 1, 30, 900_000),
      vid('2', 'Cómo ganar seguidores', 1, 30, 800_000),
      vid('3', 'Otro tema distinto', 1, 30, 700_000),
      vid('4', 'Nada que ver aquí', 1, 30, 600_000),
      vid('5', 'Cocina fácil en casa', 1, 30, 500_000),
      vid('6', 'Trucos de cocina', 1, 30, 400_000),
      vid('7', 'Recetas rápidas', 1, 30, 300_000),
      vid('8', 'Postres sencillos', 1, 30, 200_000),
    ];
    // top = ceil(8*0.25) = 2 → los dos primeros, que comparten "ganar"
    const inf = analizarVideos(videos, { ahora: AHORA });
    const palabras = inf.palabrasTitulo.map((p) => p.palabra);
    expect(palabras).toContain('ganar');
    const ganar = inf.palabrasTitulo.find((p) => p.palabra === 'ganar')!;
    expect(ganar.enTop).toBe(2);
    expect(ganar.ratioTop).toBe(1);
    // "cómo" es stopword y no debe aparecer
    expect(palabras).not.toContain('como');
  });

  it('no toma trozos de cifras como palabras ("000" de $1,000,000)', () => {
    const videos = [
      vid('1', 'Gana $1,000,000 ahora mismo', 1, 30, 900_000),
      vid('2', 'Regalo $1,000,000 a un suscriptor', 1, 30, 800_000),
      vid('3', 'Otro vídeo más del canal', 1, 30, 700_000),
      vid('4', 'Y un cuarto vídeo cualquiera', 1, 30, 600_000),
    ];
    const inf = analizarVideos(videos, { ahora: AHORA });
    const palabras = inf.palabrasTitulo.map((p) => p.palabra);
    expect(palabras).not.toContain('000');
    expect(palabras).not.toContain('1000000');
  });

  it('prioriza palabras usadas por los ganadores sobre las más frecuentes', () => {
    // "cocina" se repite mucho en el conjunto pero no en los 2 mejores (25% de 8);
    // "ganar" sí aparece en los 2 mejores → la lista debe mostrar solo las del top.
    const videos = [
      vid('1', 'Cómo ganar en un día', 1, 30, 900_000),
      vid('2', 'Truco para ganar siempre', 1, 30, 800_000),
      vid('3', 'Cocina fácil número uno', 2, 30, 700_000),
      vid('4', 'Cocina fácil número dos', 3, 30, 600_000),
      vid('5', 'Cocina fácil número tres', 4, 30, 500_000),
      vid('6', 'Cocina fácil número cuatro', 5, 30, 400_000),
      vid('7', 'Cocina fácil número cinco', 6, 30, 300_000),
      vid('8', 'Cocina fácil número seis', 7, 30, 200_000),
    ];
    const inf = analizarVideos(videos, { ahora: AHORA });
    expect(inf.palabrasTitulo.map((p) => p.palabra)).toContain('ganar');
    expect(inf.palabrasTitulo.every((p) => p.enTop >= 1)).toBe(true);
    expect(inf.palabrasTitulo.map((p) => p.palabra)).not.toContain('cocina');
  });

  it('calcula cadencia semanal de publicación', () => {
    const videos = [
      vid('1', 'Top uno', 1, 20, 900_000),
      vid('2', 'Top dos', 2, 25, 800_000),
      vid('3', 'Flojo uno', 3, 120, 10_000),
      vid('4', 'Flojo dos', 4, 130, 9_000),
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, periodoDias: 28 });
    expect(inf.publicacionesPorSemana).toBe(1); // 4 vídeos / 4 semanas
  });

  it('genera sugerencias accionables', () => {
    const videos = [
      vid('1', 'Cómo editar shorts', 1, 30, 500_000),
      vid('2', 'Cómo editar shorts viral', 1, 30, 400_000),
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, periodoDias: 14 });
    expect(inf.sugerencias.length).toBeGreaterThanOrEqual(2);
    expect(inf.sugerencias.some((s) => /duran ~\d+s/.test(s))).toBe(true);
    expect(inf.sugerencias.some((s) => s.includes('editar'))).toBe(true);
  });

  it('no falla con lista vacía', () => {
    const inf = analizarVideos([], { ahora: AHORA });
    expect(inf.total).toBe(0);
    expect(inf.destacados).toEqual([]);
    expect(inf.top).toEqual([]);
    expect(inf.duracionMediaTop).toBe(0);
  });

  it('velocidadVideo y diasDesde son coherentes', () => {
    const v = vid('x', 'test', 4, 30, 400_000);
    expect(Math.round(diasDesde(v.publicado, AHORA))).toBe(4);
    expect(velocidadVideo(v, AHORA)).toBeCloseTo(100_000, -3);
  });
});

describe('métricas viewtrap', () => {
  it('clasifica en 5 niveles con los umbrales exactos', () => {
    expect(grado('perf', 0.29)).toBe('Malo');
    expect(grado('perf', 0.3)).toBe('Regular');
    expect(grado('perf', 1)).toBe('Normal');
    expect(grado('perf', 3)).toBe('Bueno');
    expect(grado('perf', 10)).toBe('Excelente');
    expect(grado('perf', 999)).toBe('Excelente');
    expect(grado('perf', null)).toBe('-');
    // otros baremos
    expect(grado('contrib', 1.5)).toBe('Bueno');
    expect(grado('subPorDia', 5)).toBe('Regular');
    expect(grado('subPorDia', 800)).toBe('Excelente');
  });

  it('calcula las métricas de canal', () => {
    const creado = new Date(AHORA - 365 * 86400000).toISOString();
    const c = metricasCanal(
      { id: 'UC1', nombre: 'Canal', subs: 1000, vistasTotales: 1_000_000, videos: 100, creado },
      AHORA
    );
    expect(c.diasCanal).toBe(365);
    expect(c.vistasMedia).toBe(10_000); // 1M / 100 vídeos
    expect(c.subPorMilVistas).toBe(1); // 1000 subs / 1M vistas * 1000
    expect(c.subPorDia).toBe(2.7); // 1000 / 365
    expect(c.rendimientoVideo).toBe(10); // 10000 / 1000
    expect(c.vistasPorDia).toBe(2740); // 1M / 365
  });

  it('un canal pequeño supera a uno enorme si rinde más por suscriptor', () => {
    const canales = {
      PEQ: metricasCanal(
        { id: 'PEQ', nombre: 'Pequeño', subs: 1_000, vistasTotales: 5_000_000, videos: 100, creado: new Date(AHORA - 400 * 86400000).toISOString() },
        AHORA
      ),
      GRA: metricasCanal(
        { id: 'GRA', nombre: 'Gigante', subs: 10_000_000, vistasTotales: 5_000_000_000, videos: 500, creado: new Date(AHORA - 4000 * 86400000).toISOString() },
        AHORA
      ),
    };
    const videos: YTVideo[] = [
      // 1M de vistas en un canal de 10M subs → perf 0.1
      { ...vid('grande', 'Vídeo del canal gigante', 1, 30, 1_000_000, 'Gigante'), canalId: 'GRA' },
      // 50k vistas en un canal de 1k subs → perf 50 (outlier de verdad)
      { ...vid('peque', 'Vídeo del canal pequeño', 1, 30, 50_000, 'Pequeño'), canalId: 'PEQ' },
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, canales, orden: 'rendimiento' });
    expect(inf.ordenadoPor).toBe('perf');
    expect(inf.destacados[0].id).toBe('peque'); // gana el outlier pese a tener 20x menos vistas
    expect(inf.destacados[0].perf).toBe(50);
    expect(inf.destacados[0].gradoPerf).toBe('Excelente');
    expect(inf.destacados[1].perf).toBe(0.1);
    expect(inf.destacados[1].gradoPerf).toBe('Malo');
    expect(inf.ratioExcelentes).toBe(50); // 1 de 2 supera 10x
  });

  it('contrib mide el vídeo contra la media de su propio canal', () => {
    const canales = {
      C: metricasCanal(
        { id: 'C', nombre: 'Canal', subs: 10_000, vistasTotales: 30_000_000, videos: 300, creado: new Date(AHORA - 1000 * 86400000).toISOString() },
        AHORA
      ),
    }; // vistas medias = 100.000
    const videos: YTVideo[] = [
      { ...vid('a', 'Tres veces la media', 1, 30, 300_000, 'Canal'), canalId: 'C' },
      { ...vid('b', 'La mitad de la media', 1, 30, 50_000, 'Canal'), canalId: 'C' },
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, canales });
    expect(inf.destacados[0].contrib).toBe(3);
    expect(inf.destacados[1].contrib).toBe(0.5);
  });

  it('sin datos de canal sigue ordenando por velocidad y no da grados', () => {
    const inf = analizarVideos(
      [vid('a', 'Uno', 10, 30, 100_000), vid('b', 'Dos', 1, 30, 50_000)],
      { ahora: AHORA }
    );
    expect(inf.ordenadoPor).toBe('velocidad');
    expect(inf.destacados[0].id).toBe('b');
    expect(inf.destacados[0].perf).toBeNull();
    expect(inf.destacados[0].gradoPerf).toBe('-');
    expect(inf.ratioExcelentes).toBeNull();
  });
});

  it('por defecto ordena por contribución (comparable entre tamaños)', () => {
    const canales = {
      PEQ: metricasCanal(
        { id: 'PEQ', nombre: 'Pequeño', subs: 1_000, vistasTotales: 5_000_000, videos: 100, creado: new Date(AHORA - 400 * 86400000).toISOString() },
        AHORA
      ), // media 50.000
      GRA: metricasCanal(
        { id: 'GRA', nombre: 'Gigante', subs: 10_000_000, vistasTotales: 5_000_000_000, videos: 500, creado: new Date(AHORA - 4000 * 86400000).toISOString() },
        AHORA
      ), // media 10.000.000
    };
    const videos: YTVideo[] = [
      { ...vid('g', 'Del gigante', 1, 30, 9_000_000, 'Gigante'), canalId: 'GRA' }, // contrib 0.9
      { ...vid('p', 'Del pequeño', 1, 30, 200_000, 'Pequeño'), canalId: 'PEQ' },  // contrib 4
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, canales });
    expect(inf.ordenadoPor).toBe('contrib');
    expect(inf.destacados[0].id).toBe('p'); // 4x su media gana a 0.9x, pese a 45x menos vistas
    expect(inf.destacados[0].contrib).toBe(4);
    expect(inf.destacados[1].contrib).toBe(0.9);
  });

  it('no aconseja copiar algo que no destaca sobre la media de su canal', () => {
    const canales = {
      G: metricasCanal(
        { id: 'G', nombre: 'Gigante', subs: 10_000_000, vistasTotales: 1_000_000_000, videos: 100, creado: new Date(AHORA - 3000 * 86400000).toISOString() },
        AHORA
      ), // media 10.000.000
    };
    const videos: YTVideo[] = [
      { ...vid('a', 'Short normal del gigante', 1, 30, 5_000_000, 'Gigante'), canalId: 'G' },
      { ...vid('b', 'Otro short normal', 2, 30, 4_000_000, 'Gigante'), canalId: 'G' },
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, canales });
    const texto = inf.sugerencias.join(' | ');
    expect(texto).not.toContain('Copia su gancho');
    expect(texto).toContain('crecen por tamaño');
  });

  it('separa los canales jóvenes (<1 año) ordenados por crecimiento', () => {
    const canales = {
      NUEVO: metricasCanal(
        { id: 'NUEVO', nombre: 'Recién creado', subs: 30_000, vistasTotales: 9_000_000, videos: 60, creado: new Date(AHORA - 100 * 86400000).toISOString() },
        AHORA
      ), // 300 subs/día
      VIEJO: metricasCanal(
        { id: 'VIEJO', nombre: 'Veterano', subs: 5_000_000, vistasTotales: 2_000_000_000, videos: 900, creado: new Date(AHORA - 3000 * 86400000).toISOString() },
        AHORA
      ), // 1.666 subs/día pero no es joven
      MEDIO: metricasCanal(
        { id: 'MEDIO', nombre: 'Otro joven', subs: 10_000, vistasTotales: 2_000_000, videos: 40, creado: new Date(AHORA - 200 * 86400000).toISOString() },
        AHORA
      ), // 50 subs/día
    };
    const videos: YTVideo[] = [
      { ...vid('a', 'Un short', 1, 30, 100_000, 'Recién creado'), canalId: 'NUEVO' },
      { ...vid('b', 'Otro short', 1, 30, 90_000, 'Veterano'), canalId: 'VIEJO' },
      { ...vid('c', 'Y otro', 1, 30, 80_000, 'Otro joven'), canalId: 'MEDIO' },
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, canales });
    expect(inf.canales.length).toBe(3);
    // el veterano queda fuera aunque crezca más por día
    expect(inf.canalesJovenes.map((c) => c.id)).toEqual(['NUEVO', 'MEDIO']);
    expect(inf.canalesJovenes.every((c) => c.diasCanal <= 365)).toBe(true);
  });
