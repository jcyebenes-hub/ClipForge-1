/**
 * lib/rateLimit.ts
 * Sistema de protección contra abuso y Rate Limiting por usuario / IP.
 * - Tabla uso_usuario: user_id, fecha, transcribir_count, analizar_count, exportar_count, min_datos, ip_hash
 * - Límites:
 *     - máx. 5 transcripciones/hora por usuario/IP
 *     - máx. 10 análisis/hora por usuario/IP
 *     - máx. 20 exportaciones/día por usuario/IP
 * - Devuelve 429 con mensaje en español y tiempo de espera.
 */

import { supabase } from './supabase/client';

export type TipoAccionRateLimit = 'transcribir' | 'analizar' | 'exportar';

export interface RateLimitConfig {
  max: number;
  ventanaMs: number; // En milisegundos (1 hora o 24 horas)
  nombreAccion: string;
}

export const RATE_LIMIT_CONFIGS: Record<TipoAccionRateLimit, RateLimitConfig> = {
  transcribir: {
    max: 5,
    ventanaMs: 60 * 60 * 1000, // 1 hora
    nombreAccion: 'transcripciones',
  },
  analizar: {
    max: 10,
    ventanaMs: 60 * 60 * 1000, // 1 hora
    nombreAccion: 'análisis virales',
  },
  exportar: {
    max: 20,
    ventanaMs: 24 * 60 * 60 * 1000, // 24 horas (día)
    nombreAccion: 'exportaciones de vídeo',
  },
};

export interface RateLimitResult {
  permitido: boolean;
  restantes: number;
  max: number;
  reseteoEnSegundos: number;
  mensaje?: string;
}

// Memoria local en servidor / memoria para peticiones sin Redis
interface RegistroEnMemoria {
  timestamps: number[];
}

const memoriaRateLimit = new Map<string, RegistroEnMemoria>();

/**
 * Función criptográfica simple / hash para anonimizar IP sin almacenar datos sensibles
 */
export function generarIpHash(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'ip_' + Math.abs(hash).toString(36);
}

/**
 * Extrae la IP de los encabezados HTTP comunes (Cloudflare, Vercel, Proxies, etc.)
 */
export function obtenerIpDeRequest(req: Request | any): string {
  if (!req) return '127.0.0.1';

  // Si es un Request Web API standard
  if (req.headers && typeof req.headers.get === 'function') {
    const cfIp = req.headers.get('cf-connecting-ip');
    if (cfIp) return cfIp;

    const xForwardedFor = req.headers.get('x-forwarded-for');
    if (xForwardedFor) return xForwardedFor.split(',')[0].trim();

    const xRealIp = req.headers.get('x-real-ip');
    if (xRealIp) return xRealIp;
  }

  // Si es un objeto de req de Node / Express
  if (req.headers && typeof req.headers === 'object') {
    const cfIp = req.headers['cf-connecting-ip'];
    if (cfIp) return Array.isArray(cfIp) ? cfIp[0] : cfIp;

    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const val = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      return val.split(',')[0].trim();
    }

    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }

  return '127.0.0.1';
}

/**
 * Verifica y registra el uso de una acción (transcribir, analizar, exportar)
 */
export async function verificarRateLimit(
  accion: TipoAccionRateLimit,
  userId?: string | null,
  ip?: string | null
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS[accion];
  const ahora = Date.now();
  const identificador = userId && userId !== 'demo-user' && !userId.startsWith('anon_') 
    ? `user_${userId}` 
    : (ip ? generarIpHash(ip) : 'anon_default');

  const clave = `${accion}:${identificador}`;

  // 1. Verificación y actualización en memoria inmediata
  let registro = memoriaRateLimit.get(clave);
  if (!registro) {
    registro = { timestamps: [] };
    memoriaRateLimit.set(clave, registro);
  }

  // Limpiar timestamps fuera de la ventana
  registro.timestamps = registro.timestamps.filter(t => ahora - t < config.ventanaMs);

  if (registro.timestamps.length >= config.max) {
    const masAntiguo = registro.timestamps[0];
    const msParaDesbloqueo = Math.max(1000, (masAntiguo + config.ventanaMs) - ahora);
    const segundosRestantes = Math.ceil(msParaDesbloqueo / 1000);
    const minutosRestantes = Math.ceil(segundosRestantes / 60);

    const tiempoTexto = config.ventanaMs >= 24 * 60 * 60 * 1000
      ? `${Math.ceil(minutosRestantes / 60)} horas`
      : `${minutosRestantes} minutos (${segundosRestantes} segundos)`;

    return {
      permitido: false,
      restantes: 0,
      max: config.max,
      reseteoEnSegundos: segundosRestantes,
      mensaje: `Has alcanzado el límite gratuito de ${config.max} ${config.nombreAccion}. Por favor espera ${tiempoTexto} o actualiza a un plan Pro.`,
    };
  }

  // Registrar nuevo evento
  registro.timestamps.push(ahora);
  const restantes = config.max - registro.timestamps.length;
  const reseteoEnSegundos = Math.ceil(config.ventanaMs / 1000);

  // 2. Opcional: Persistir en Supabase en segundo plano si la tabla uso_usuario existe
  try {
    const hoyStr = new Date().toISOString().split('T')[0];
    const colCount = `${accion}_count`;

    // Intentar upsert o update en tabla uso_usuario
    Promise.resolve().then(async () => {
      try {
        const { data: existing } = await supabase
          .from('uso_usuario')
          .select('id, transcribir_count, analizar_count, exportar_count')
          .eq('fecha', hoyStr)
          .eq(userId ? 'user_id' : 'ip_hash', userId || identificador)
          .maybeSingle();

        if (existing) {
          const currentCount = (existing as any)[colCount] || 0;
          await (supabase.from('uso_usuario') as any)
            .update({ [colCount]: currentCount + 1 })
            .eq('id', (existing as any).id);
        } else {
          await (supabase.from('uso_usuario') as any)
            .insert({
              user_id: userId || null,
              ip_hash: identificador,
              fecha: hoyStr,
              transcribir_count: accion === 'transcribir' ? 1 : 0,
              analizar_count: accion === 'analizar' ? 1 : 0,
              exportar_count: accion === 'exportar' ? 1 : 0,
              min_datos: 0,
            });
        }
      } catch {
        // Ignorar si no está creada la tabla en supabase
      }
    });
  } catch {
    // Non-blocking
  }

  return {
    permitido: true,
    restantes,
    max: config.max,
    reseteoEnSegundos,
  };
}

/**
 * Verificación en el cliente (para avisar antes de iniciar o cuando se exporta)
 */
export function verificarRateLimitCliente(
  accion: TipoAccionRateLimit,
  userId?: string
): { permitido: boolean; mensaje?: string; restantes: number } {
  if (typeof window === 'undefined') {
    return { permitido: true, restantes: RATE_LIMIT_CONFIGS[accion].max };
  }

  const config = RATE_LIMIT_CONFIGS[accion];
  const storageKey = `clipforge_rl_${accion}_${userId || 'local'}`;
  const ahora = Date.now();

  let timestamps: number[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      timestamps = JSON.parse(raw);
    }
  } catch {}

  timestamps = timestamps.filter((t) => ahora - t < config.ventanaMs);

  if (timestamps.length >= config.max) {
    const masAntiguo = timestamps[0];
    const msParaDesbloqueo = Math.max(1000, (masAntiguo + config.ventanaMs) - ahora);
    const minutosRestantes = Math.ceil(msParaDesbloqueo / 60000);

    return {
      permitido: false,
      restantes: 0,
      mensaje: `Has alcanzado el límite gratuito de ${config.max} ${config.nombreAccion}. Espera aprox. ${minutosRestantes} min para reintentar.`,
    };
  }

  return {
    permitido: true,
    restantes: config.max - timestamps.length,
  };
}

/**
 * Registra un consumo en el cliente (ej: al iniciar una exportación MP4)
 */
export function registrarConsumoCliente(accion: TipoAccionRateLimit, userId?: string) {
  if (typeof window === 'undefined') return;

  const config = RATE_LIMIT_CONFIGS[accion];
  const storageKey = `clipforge_rl_${accion}_${userId || 'local'}`;
  const ahora = Date.now();

  let timestamps: number[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      timestamps = JSON.parse(raw);
    }
  } catch {}

  timestamps = timestamps.filter((t) => ahora - t < config.ventanaMs);
  timestamps.push(ahora);

  try {
    localStorage.setItem(storageKey, JSON.stringify(timestamps));
  } catch {}
}
