/**
 * Telemetría de uso REAL, registrada desde el SERVIDOR.
 *
 * A diferencia de src/lib/analytics.ts (que guarda en localStorage y solo ve el
 * navegador actual), esto inserta en la tabla `eventos` de Supabase con la clave
 * anon (la política de insert es pública). Al ser server-side, captura el uso de
 * TODOS los usuarios, no solo el del navegador propio.
 *
 * Es "fire-and-forget": nunca bloquea la petición ni lanza errores. Si la tabla
 * `eventos` no existe todavía, el insert falla en silencio (hay que ejecutar la
 * migración supabase/migrations/20260902_add_eventos_table.sql).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null = null;

function obtenerCliente(): SupabaseClient | null {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cliente = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}

/**
 * Registra un evento de uso. No bloquea ni lanza: la telemetría nunca debe
 * afectar a la respuesta de la ruta.
 */
export function logEventoServer(
  tipo: string,
  metadata: Record<string, any> = {},
  userId?: string | null
): void {
  try {
    const c = obtenerCliente();
    if (!c) return;
    (c.from('eventos') as any)
      .insert({
        tipo,
        ruta: 'server',
        user_id: userId || null,
        metadata,
        fecha: new Date().toISOString(),
      })
      .then(() => {})
      .catch(() => {});
  } catch {
    // silencioso
  }
}
