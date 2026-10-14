import { describe, expect, it } from 'vitest';
import { capitulosDeVideo, marcaTiempo, textoFicha } from '../src/lib/fichaPublicacion';

describe('ficha para publicar', () => {
  it('empieza en 0:00 y usa los títulos de los cortes', () => {
    const caps = capitulosDeVideo({
      cortes: [
        { titulo: 'El dato', inicio: 12, fin: 40 },
        { titulo: 'La prueba', inicio: 80, fin: 110 },
        { titulo: 'El cierre', inicio: 140, fin: 170 },
      ],
      segmentos: [{ start: 0, end: 8, text: 'Hola, hoy vemos un caso real.' }],
    });
    expect(caps[0].marca).toBe('0:00');
    expect(caps.map((c) => c.texto)).toContain('El dato');
    expect(caps.map((c) => c.texto)).toContain('La prueba');
    expect(marcaTiempo(80)).toBe('1:20');
  });

  it('no inventa capítulos si el vídeo es corto', () => {
    const caps = capitulosDeVideo({
      cortes: [{ titulo: 'Solo esto', inicio: 2, fin: 18 }],
      segmentos: [{ start: 0, end: 18, text: 'Una frase corta.' }],
      duracionSeg: 18,
    });
    expect(caps).toHaveLength(1);
    expect(caps[0].texto).toBe('Solo esto');
  });

  it('escribe la ficha con capítulos y cortes', () => {
    const texto = textoFicha({
      titulo: 'Entrevista larga',
      cortes: [
        { titulo: 'El dato', inicio: 12, fin: 40 },
        { titulo: 'La prueba', inicio: 80, fin: 110 },
      ],
      segmentos: [{ start: 0, end: 6, text: 'Hoy hablamos de un caso.' }],
      duracionSeg: 180,
    });
    expect(texto).toContain('0:00');
    expect(texto).toContain('Capítulos:');
    expect(texto).toContain('1. El dato');
  });
});
