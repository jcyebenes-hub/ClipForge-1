/**
 * lib/planGratis.ts
 * Cuota mensual del plan gratuito.
 *
 * Por qué se limita en MINUTOS y no en número de clips: el coste real de ClipForge
 * no está en cortar (eso ocurre en el navegador del usuario con FFmpeg WASM, sobre
 * su propia CPU), sino en el almacenamiento y el ancho de banda de Supabase y en las
 * llamadas a la IA. Ambas cosas escalan con la duración del material, no con cuántos
 * trozos se saquen de él.
 *
 * No necesita tablas nuevas: reutiliza `uso_usuario`, que ya tiene la columna
 * `min_datos` y una fila por usuario y día.
 */

import { supabase } from './supabase/client';

/** Minutos de material que el plan gratuito puede procesar al mes. */
export const LIMITE_MINUTOS_MES = 60;

/** Referencia del mercado: Opus Clip y Vizard dan 60 créditos/mes en su plan gratis. */
export const PLANES = {
  gratis: { minutosMes: LIMITE_MINUTOS_MES, marcaDeAgua: true },
  pro: { minutosMes: Infinity, marcaDeAgua: false },
  creador: { minutosMes: Infinity, marcaDeAgua: false },
  agencia: { minutosMes: Infinity, marcaDeAgua: false },
} as const;

export type NombrePlan = keyof typeof PLANES;

export interface CuotaMensual {
  permitido: boolean;
  minutosUsados: number;
  minutosLimite: number;
  minutosRestantes: number;
  /** undefined si no hay superación; mensaje listo para mostrar si la hay. */
  mensaje?: string;
}

function primerDiaDelMes(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function hoyISO(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Suma los minutos procesados en el mes en curso para ese usuario (o, si no hay
 * sesión, para esa IP). Devuelve 0 si no se puede consultar, para no bloquear a
 * nadie por un fallo de red.
 */
export async function obtenerMinutosDelMes(
  userId?: string | null,
  ipHash = 'desconocida'
): Promise<number> {
  try {
    const desde = primerDiaDelMes().toISOString();
    let consulta = (supabase.from('uso_usuario') as any)
      .select('min_datos, user_id, ip_hash')
      .gte('fecha', desde.slice(0, 10));

    if (userId) consulta = consulta.eq('user_id', userId);
    else consulta = consulta.eq('ip_hash', ipHash);

    const { data, error } = await consulta;
    if (error) {
      console.warn('[planGratis] no se pudo leer la cuota:', error.message);
      return 0;
    }
    return (data || []).reduce((total: number, fila: any) => total + (Number(fila.min_datos) || 0), 0);
  } catch (err) {
    console.warn('[planGratis] error leyendo la cuota:', err);
    return 0;
  }
}

export async function comprobarCuotaMensual(
  userId?: string | null,
  ipHash = 'desconocida',
  plan: string = 'gratis'
): Promise<CuotaMensual> {
  const limite = (PLANES as any)[plan]?.minutosMes ?? LIMITE_MINUTOS_MES;
  if (!Number.isFinite(limite)) {
    return { permitido: true, minutosUsados: 0, minutosLimite: limite, minutosRestantes: limite };
  }
  const usados = await obtenerMinutosDelMes(userId, ipHash);
  const permitido = usados < limite;
  return {
    permitido,
    minutosUsados: usados,
    minutosLimite: limite,
    minutosRestantes: Math.max(0, limite - usados),
    mensaje: permitido
      ? undefined
      : `Has alcanzado el límite del plan gratuito (${limite} minutos al mes). ` +
        `Llevas ${usados} minutos este mes. Con el plan Pro no hay límite y se quita la marca de agua.`,
  };
}

/**
 * Anota minutos procesados en la fila del día (la crea si no existe).
 * Nunca lanza: un fallo de telemetría no debe romper el trabajo del usuario.
 */
export async function registrarMinutosProcesados(
  minutos: number,
  userId?: string | null,
  ipHash = 'desconocida'
): Promise<void> {
  const enteros = Math.max(0, Math.round(minutos));
  if (!enteros) return;
  const fecha = hoyISO();
  try {
    let consulta = (supabase.from('uso_usuario') as any)
      .select('id, min_datos')
      .eq('fecha', fecha);
    consulta = userId ? consulta.eq('user_id', userId) : consulta.eq('ip_hash', ipHash);
    const { data } = await consulta.maybeSingle();

    if (data?.id) {
      await (supabase.from('uso_usuario') as any)
        .update({ min_datos: (Number(data.min_datos) || 0) + enteros })
        .eq('id', data.id);
    } else {
      await (supabase.from('uso_usuario') as any).insert({
        user_id: userId || null,
        ip_hash: ipHash,
        fecha,
        min_datos: enteros,
      });
    }
  } catch (err) {
    console.warn('[planGratis] no se pudieron registrar los minutos:', err);
  }
}
