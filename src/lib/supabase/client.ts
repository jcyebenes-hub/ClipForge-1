import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Entorno servidor (Node.js): createBrowserClient necesita `document`,
// así que usamos el cliente universal de @supabase/supabase-js.
// (El polyfill de WebSocket para Node lo inyecta server.ts vía
//  src/lib/polyfills/ws-node.ts; en el navegador no hace falta.)
const IS_NODE = typeof document === 'undefined';

const PLACEHOLDER_URL = 'https://placeholder-project.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export function getSupabaseEnv() {
  const metaEnv = typeof import.meta !== 'undefined' && 'env' in import.meta 
    ? (import.meta as unknown as { env: Record<string, string | undefined> }).env 
    : undefined;

  const rawUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    metaEnv?.NEXT_PUBLIC_SUPABASE_URL ||
    metaEnv?.VITE_NEXT_PUBLIC_SUPABASE_URL ||
    '';

  const rawAnonKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    metaEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    metaEnv?.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  const isConfigured = Boolean(
    rawUrl &&
    rawAnonKey &&
    !rawUrl.includes('placeholder') &&
    !rawAnonKey.includes('placeholder')
  );

  const supabaseUrl = isConfigured ? rawUrl : PLACEHOLDER_URL;
  const supabaseAnonKey = isConfigured ? rawAnonKey : PLACEHOLDER_KEY;

  return { supabaseUrl, supabaseAnonKey, isConfigured };
}

/**
 * Cliente de Supabase para el navegador (Client Component / Browser)
 * Utiliza @supabase/ssr createBrowserClient con tipado completo de base de datos.
 */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    console.info(
      '[Supabase Client] Variables de entorno no detectadas o usando valores temporales. El modo local/demostración está activo.'
    );
  }

  // En servidor (Node.js) usamos el cliente universal; en el navegador, el de @supabase/ssr
  if (IS_NODE) {
    return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Instancia singleton para uso en componentes de cliente
export const supabase = createClient();

