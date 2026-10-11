import { describe, it, expect } from 'vitest';
import { analizarVideos, velocidadVideo, diasDesde, type YTVideo } from '../src/lib/analisisYoutube';

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
