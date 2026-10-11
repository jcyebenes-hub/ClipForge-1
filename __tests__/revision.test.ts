import { describe, it, expect } from 'vitest';
import {
  planificarRevision,
  aplicarRevision,
  ajustesPorDefecto,
  VELOCIDAD_MAX,
  type AjustesClip,
} from '../src/lib/revision';

const base = (): AjustesClip => ({ ...ajustesPorDefecto() }); // ritmo 1.3x, título on, silencios off

describe('planificarRevision', () => {
  it('«más rápido» sube la velocidad un 20%', () => {
    const p = planificarRevision('más rápido', base());
    const v = p.cambios.find((c) => c.clave === 'velocidad');
    expect(v?.nuevo).toBe(1.56); // 1.3 * 1.2
    expect(p.noSoportado).toEqual([]);
  });

  it('«un poco más rápido» sube menos que «más rápido»', () => {
    const suave = planificarRevision('un poco más rápido', base());
    const neutro = planificarRevision('más rápido', base());
    const vs = suave.cambios.find((c) => c.clave === 'velocidad')?.nuevo as number;
    const vn = neutro.cambios.find((c) => c.clave === 'velocidad')?.nuevo as number;
    expect(vs).toBeCloseTo(1.46, 2); // 1.3 * 1.12
    expect(vs).toBeLessThan(vn);
  });

  it('«mucho más rápido» respeta el tope de velocidad', () => {
    const p = planificarRevision('mucho más rápido', { ...base(), velocidad: 1.9 });
    expect(p.cambios.find((c) => c.clave === 'velocidad')?.nuevo).toBe(VELOCIDAD_MAX);
  });

  it('acepta una velocidad exacta: «velocidad 1,5» y «a 1.5x»', () => {
    expect(planificarRevision('velocidad 1,5', base()).cambios.find((c) => c.clave === 'velocidad')?.nuevo).toBe(1.5);
    expect(planificarRevision('ponlo a 1.5x', base()).cambios.find((c) => c.clave === 'velocidad')?.nuevo).toBe(1.5);
  });

  it('«velocidad normal» desactiva la aceleración', () => {
    const p = planificarRevision('pon la velocidad normal', base());
    expect(p.cambios.find((c) => c.clave === 'velocidad')?.nuevo).toBe(1);
    expect(p.cambios.find((c) => c.clave === 'ritmoRapido')?.nuevo).toBe(false);
  });

  it('«más lento» baja y al llegar a 1 apaga la aceleración', () => {
    const p = planificarRevision('más lento', { ...base(), velocidad: 1.1 });
    expect(p.cambios.find((c) => c.clave === 'velocidad')?.nuevo).toBe(1); // 1.1*0.8=0.88 -> limitado a 1
    expect(p.cambios.find((c) => c.clave === 'ritmoRapido')?.nuevo).toBe(false);
  });

  it('activa y desactiva los silencios, distinguiendo la negación', () => {
    expect(planificarRevision('quita los silencios', base()).cambios[0]).toMatchObject({
      clave: 'quitarSilencios',
      nuevo: true,
    });
    expect(
      planificarRevision('no quites los silencios', { ...base(), quitarSilencios: true }).cambios[0]
    ).toMatchObject({ clave: 'quitarSilencios', nuevo: false });
    expect(planificarRevision('sin pausas', base()).cambios[0].clave).toBe('quitarSilencios');
  });

  it('quita y pone el título de arriba', () => {
    expect(planificarRevision('quita el título', base()).cambios[0]).toMatchObject({
      clave: 'tituloArriba',
      nuevo: false,
    });
    expect(
      planificarRevision('pon el título', { ...base(), tituloArriba: false }).cambios[0]
    ).toMatchObject({ clave: 'tituloArriba', nuevo: true });
  });

  it('cambia el estilo de subtítulos (con tildes y sin ellas)', () => {
    expect(planificarRevision('subtítulos neón', base()).cambios[0]).toMatchObject({
      clave: 'estiloSubtitulos',
      nuevo: 'neon',
    });
    expect(planificarRevision('estilo minimalista', base()).cambios[0]).toMatchObject({
      clave: 'estiloSubtitulos',
      nuevo: 'minimal',
    });
  });

  it('activa el fondo con «fondo desenfocado»', () => {
    expect(planificarRevision('fondo desenfocado', base()).cambios[0]).toMatchObject({
      clave: 'fondo',
      nuevo: true,
    });
    expect(
      planificarRevision('quita el fondo', { ...base(), fondo: true }).cambios[0]
    ).toMatchObject({ clave: 'fondo', nuevo: false });
  });

  it('activa la pantalla partida', () => {
    expect(planificarRevision('pantalla partida', base()).cambios[0]).toMatchObject({
      clave: 'split',
      nuevo: true,
    });
  });

  it('fija el texto del gancho conservando mayúsculas originales', () => {
    const p = planificarRevision('gancho: No vas a creer esto', base());
    expect(p.cambios[0]).toMatchObject({ clave: 'gancho', nuevo: 'No vas a creer esto' });
  });

  it('entiende varias cosas a la vez', () => {
    const p = planificarRevision('más rápido y quita los silencios y pon el fondo', base());
    const claves = p.cambios.map((c) => c.clave);
    expect(claves).toContain('velocidad');
    expect(claves).toContain('quitarSilencios');
    expect(claves).toContain('fondo');
    expect(p.noSoportado).toEqual([]);
  });

  it('avisa cuando pide un gancho nuevo sin dar el texto (no lo inventa)', () => {
    const p = planificarRevision('pon otro gancho', base());
    expect(p.cambios).toEqual([]);
    expect(p.noSoportado.length).toBe(1);
    expect(p.noSoportado[0]).toContain('No puedo inventar');
  });

  it('no se inventa cambios ante algo que no entiende', () => {
    const p = planificarRevision('haz que salga en la luna', base());
    expect(p.cambios).toEqual([]);
    expect(p.noSoportado.length).toBe(1);
    expect(p.noSoportado[0]).toContain('No he entendido');
  });

  it('informa cuando el ajuste ya tenía ese valor', () => {
    const p = planificarRevision('quita los silencios', { ...base(), quitarSilencios: true });
    expect(p.cambios).toEqual([]);
    expect(p.yaEstaba.length).toBe(1);
    expect(p.yaEstaba[0]).toContain('ya estaba');
  });

  it('rechaza una instrucción vacía', () => {
    expect(planificarRevision('   ', base()).noSoportado.length).toBe(1);
  });
});

describe('aplicarRevision', () => {
  it('aplica los cambios sobre la configuración', () => {
    const actual = base();
    const plan = planificarRevision('más rápido y quita el título y subtítulos neón', actual);
    const nuevo = aplicarRevision(actual, plan);
    expect(nuevo.velocidad).toBe(1.56);
    expect(nuevo.tituloArriba).toBe(false);
    expect(nuevo.estiloSubtitulos).toBe('neon');
    // lo que no se tocó sigue igual
    expect(nuevo.fondo).toBe(actual.fondo);
    expect(nuevo.gancho).toBe(actual.gancho);
  });

  it('no muta la configuración original', () => {
    const actual = base();
    aplicarRevision(actual, planificarRevision('quita el título', actual));
    expect(actual.tituloArriba).toBe(true);
  });
});

describe('aislamiento entre cláusulas', () => {
  it('el «quita» de una cláusula no apaga lo que otra activa', () => {
    const p = planificarRevision('quita los silencios y pon el fondo', base());
    expect(p.cambios).toContainEqual(
      expect.objectContaining({ clave: 'quitarSilencios', nuevo: true })
    );
    expect(p.cambios).toContainEqual(expect.objectContaining({ clave: 'fondo', nuevo: true }));
    expect(p.yaEstaba).toEqual([]);
  });

  it('dos subidas seguidas se acumulan sobre el valor ya modificado', () => {
    const p = planificarRevision('más rápido y más rápido', base());
    const v = p.cambios.filter((c) => c.clave === 'velocidad');
    expect(v.length).toBe(2);
    expect(v[0].nuevo).toBe(1.56); // 1.3 * 1.2
    expect(v[1].nuevo).toBe(1.87); // 1.56 * 1.2
  });

  it('el texto del gancho puede contener «y» sin romperse', () => {
    const p = planificarRevision('gancho: Pan y queso', base());
    expect(p.cambios[0]).toMatchObject({ clave: 'gancho', nuevo: 'Pan y queso' });
    expect(p.noSoportado).toEqual([]);
  });

  it('instrucción con comas y varias intenciones', () => {
    const p = planificarRevision('velocidad 1.5, sin título, subtítulos neón', base());
    const claves = p.cambios.map((c) => c.clave);
    expect(claves).toContain('velocidad');
    expect(claves).toContain('tituloArriba');
    expect(claves).toContain('estiloSubtitulos');
  });
});

describe('los 7 estilos reales de subtítulos', () => {
  const casos: Array<[string, string]> = [
    ['subtítulos neón', 'neon'],
    ['estilo minimal', 'minimal'],
    ['estilo minimalista', 'minimal'],
    ['pon los subtítulos en modo podcast', 'podcast'],
    ['estilo genz', 'genz'],
    ['subtítulos estilo gen z', 'genz'],
    ['estilo dramático', 'dramatico'],
    ['pon el estilo humor', 'humor'],
    ['vuelve al estilo moderno', 'moderno'],
  ];
  for (const [frase, esperado] of casos) {
    it(`«${frase}» → ${esperado}`, () => {
      // Se parte de un estilo distinto al esperado, si no no habría cambio que hacer.
      const inicial = esperado === 'moderno' ? 'neon' : 'moderno';
      expect(
        planificarRevision(frase, { ...base(), estiloSubtitulos: inicial as 'neon' | 'moderno' }).cambios[0]
      ).toMatchObject({ clave: 'estiloSubtitulos', nuevo: esperado });
    });
  }

  it('no confunde «humor» suelto con el estilo de subtítulos', () => {
    const p = planificarRevision('este clip tiene mucho humor', base());
    expect(p.cambios).toEqual([]);
    expect(p.noSoportado.length).toBe(1);
  });
});
