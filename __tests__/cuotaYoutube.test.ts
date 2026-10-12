import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CUOTA_YOUTUBE_DIA,
  COSTE_BUSQUEDA_TENDENCIAS,
  RESERVA_CUOTA,
  BUSQUEDAS_GLOBALES_MAX_DIA,
  BUSQUEDAS_POR_PLAN,
  limiteUsuario,
  puedeBuscar,
  registrarBusqueda,
  busquedasHoy,
  reiniciarCuotaParaPruebas,
} from '../src/lib/cuotaYoutube';

describe('los números cuadran con la cuota real de Google', () => {
  it('una búsqueda cuesta 102 unidades (search 100 + videos 1 + channels 1)', () => {
    expect(COSTE_BUSQUEDA_TENDENCIAS).toBe(102);
  });

  it('el tope global deja un colchón sin usar', () => {
    expect(BUSQUEDAS_GLOBALES_MAX_DIA).toBe(
      Math.floor((CUOTA_YOUTUBE_DIA - RESERVA_CUOTA) / COSTE_BUSQUEDA_TENDENCIAS),
    );
    // Con 10.000 de cuota y 1.500 reservados caben 83 búsquedas.
    expect(BUSQUEDAS_GLOBALES_MAX_DIA).toBe(83);
  });

  it('agotar el tope global no se come la cuota entera', () => {
    const gastado = BUSQUEDAS_GLOBALES_MAX_DIA * COSTE_BUSQUEDA_TENDENCIAS;
    expect(gastado).toBeLessThanOrEqual(CUOTA_YOUTUBE_DIA - RESERVA_CUOTA);
    expect(CUOTA_YOUTUBE_DIA - gastado).toBeGreaterThanOrEqual(RESERVA_CUOTA);
  });
});

describe('limiteUsuario', () => {
  it('cada plan tiene su tope', () => {
    expect(limiteUsuario('gratis')).toBe(5);
    expect(limiteUsuario('creador')).toBe(20);
    expect(limiteUsuario('pro')).toBe(40);
    expect(limiteUsuario('agencia')).toBe(40);
  });

  it('un plan de pago tiene más que el gratis', () => {
    expect(BUSQUEDAS_POR_PLAN.creador).toBeGreaterThan(BUSQUEDAS_POR_PLAN.gratis);
  });

  it('sin sesión o con un plan desconocido, se aplica el del plan gratis', () => {
    expect(limiteUsuario(null)).toBe(5);
    expect(limiteUsuario(undefined)).toBe(5);
    expect(limiteUsuario('')).toBe(5);
    expect(limiteUsuario('emperador')).toBe(5);
  });

  it('no le importan mayúsculas ni espacios', () => {
    expect(limiteUsuario('  CREADOR ')).toBe(20);
  });
});

describe('puedeBuscar', () => {
  it('deja pasar cuando hay margen', () => {
    expect(puedeBuscar({ globalesHoy: 0, usuarioHoy: 0, plan: 'gratis' })).toEqual({ ok: true });
    expect(puedeBuscar({ globalesHoy: 82, usuarioHoy: 4, plan: 'gratis' }).ok).toBe(true);
  });

  it('el tope global manda incluso sobre un plan de pago', () => {
    const v = puedeBuscar({
      globalesHoy: BUSQUEDAS_GLOBALES_MAX_DIA,
      usuarioHoy: 0,
      plan: 'agencia',
    });
    expect(v.ok).toBe(false);
    expect(v.motivo).toBe('global');
    expect(v.mensaje).toContain('mañana');
  });

  it('corta al usuario que agota su propio tope, sin tocar el global', () => {
    const v = puedeBuscar({ globalesHoy: 10, usuarioHoy: 5, plan: 'gratis' });
    expect(v.ok).toBe(false);
    expect(v.motivo).toBe('usuario');
    expect(v.mensaje).toContain('5 búsquedas');
    expect(v.mensaje).toContain('plan Creador');
  });

  it('un plan de pago aguanta más búsquedas que el gratis', () => {
    expect(puedeBuscar({ globalesHoy: 10, usuarioHoy: 5, plan: 'creador' }).ok).toBe(true);
    expect(puedeBuscar({ globalesHoy: 10, usuarioHoy: 20, plan: 'creador' }).ok).toBe(false);
  });

  it('no se rompe con números raros', () => {
    expect(puedeBuscar({ globalesHoy: -5, usuarioHoy: -1, plan: 'gratis' }).ok).toBe(true);
    expect(puedeBuscar({ globalesHoy: NaN, usuarioHoy: NaN, plan: null }).ok).toBe(true);
  });
});

describe('contador en memoria', () => {
  beforeEach(() => {
    reiniciarCuotaParaPruebas();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('empieza a cero', () => {
    expect(busquedasHoy('usuario-1')).toEqual({ globales: 0, usuario: 0 });
  });

  it('cuenta por separado el global y el de cada usuario', () => {
    registrarBusqueda('usuario-1');
    registrarBusqueda('usuario-1');
    registrarBusqueda('usuario-2');

    expect(busquedasHoy('usuario-1')).toEqual({ globales: 3, usuario: 2 });
    expect(busquedasHoy('usuario-2')).toEqual({ globales: 3, usuario: 1 });
  });

  it('cuenta también a quien no tiene sesión', () => {
    registrarBusqueda(null);
    expect(busquedasHoy().globales).toBe(1);
  });

  it('se pone a cero al cambiar el día', () => {
    registrarBusqueda('usuario-1');
    expect(busquedasHoy('usuario-1').globales).toBe(1);

    // Pasa la medianoche UTC.
    vi.setSystemTime(new Date('2026-10-13T00:05:00Z'));
    expect(busquedasHoy('usuario-1')).toEqual({ globales: 0, usuario: 0 });
  });

  it('el tope global se alcanza tras 83 búsquedas y ni una más', () => {
    for (let i = 0; i < BUSQUEDAS_GLOBALES_MAX_DIA; i++) registrarBusqueda(`u${i}`);
    expect(busquedasHoy().globales).toBe(BUSQUEDAS_GLOBALES_MAX_DIA);
    expect(puedeBuscar({ globalesHoy: busquedasHoy().globales, usuarioHoy: 0, plan: 'agencia' }).ok).toBe(false);
  });
});
