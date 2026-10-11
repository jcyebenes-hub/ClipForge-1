import { describe, it, expect } from 'vitest';
import { analizarVideos, velocidadVideo, diasDesde, type YTVideo } from '../src/lib/analisisYoutube';

const AHORA = Date.parse('2026-10-11T00:00:00Z');

function vid(id: string, titulo: string, dias: number, duracionSeg: number, vistas: number, canal = 'Canal', etiquetas: string[] = []): YTVideo {
  const publicado = new Date(AHORA - dias * 86400000).toISOString();
  return { id, titulo, publicado, duracionSeg, vistas, likes: vistas / 10, comentarios: vistas / 100, etiquetas, canal };
}

describe('analisisYoutube', () => {
  it('ordena por vistas/día (velocidad), no por vistas totales', () => {
    const viejo = vid('a', 'Video viejo con muchas vistas', 80, 30, 1_000_000);
    const nuevo = vid('b', 'Video nuevo reciente', 2, 30, 200_000); // 100k/día > 12.5k/día
    const inf = analizarVideos([viejo, nuevo], { ahora: AHORA });
    expect(inf.top[0].id).toBe('b');
    expect(inf.top[0].vistasPorDia).toBeGreaterThan(inf.top[1].vistasPorDia);
  });

  it('detecta las palabras que se repiten en los títulos ganadores', () => {
    const videos = [
      vid('1', 'Cómo ganar dinero rápido', 1, 30, 500_000),
      vid('2', 'Cómo ganar seguidores rápido', 1, 30, 400_000),
      vid('3', 'Cómo ganar vistas rápido', 1, 30, 300_000),
      vid('4', 'Otro tema sin relación', 1, 30, 100_000),
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, topN: 3 });
    const palabras = inf.palabrasTitulo.map((p) => p.palabra);
    expect(palabras).toContain('ganar');
    expect(palabras).toContain('rapido'); // sin tilde
    const ganar = inf.palabrasTitulo.find((p) => p.palabra === 'ganar')!;
    expect(ganar.enTop).toBe(3);
    expect(ganar.ratioTop).toBe(1);
  });

  it('calcula duración media del top frente al resto y cadencia semanal', () => {
    const videos = [
      vid('1', 'Top uno', 1, 20, 900_000),
      vid('2', 'Top dos', 2, 25, 800_000),
      vid('3', 'Flojo uno', 3, 120, 10_000),
      vid('4', 'Flojo dos', 4, 130, 9_000),
    ];
    const inf = analizarVideos(videos, { ahora: AHORA, topN: 2, periodoDias: 28 });
    expect(inf.duracionMediaTop).toBe(23); // mediana(20,25)=22.5 -> redondea a 23
    expect(inf.duracionMediaResto).toBe(125); // mediana(120,130)
    expect(inf.duracionMediaTop).toBeLessThan(inf.duracionMediaResto);
    // 4 vídeos en 4 semanas = 1/semana
    expect(inf.publicacionesPorSemana).toBe(1);
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
    expect(inf.top).toEqual([]);
    expect(inf.duracionMediaTop).toBe(0);
  });

  it('velocidadVideo y diasDesde son coherentes', () => {
    const v = vid('x', 'test', 4, 30, 400_000);
    expect(Math.round(diasDesde(v.publicado, AHORA))).toBe(4);
    expect(velocidadVideo(v, AHORA)).toBeCloseTo(100_000, -3);
  });
});
