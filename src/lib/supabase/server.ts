import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './types';

const PLACEHOLDER_URL = 'https://placeholder-project.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

function getSupabaseEnv() {
  // Este archivo se usa SOLO en servidor (Node): leemos de process.env.
  // (La variante de navegador con import.meta.env.VITE_* vive en client.ts)
  const rawUrl = process.env?.NEXT_PUBLIC_SUPABASE_URL || '';
  const rawAnonKey = process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

export type CookieStore = {
  get(name: string): { name: string; value: string } | string | undefined;
  set(name: string, value: string, options: CookieOptions): void;
  remove(name: string, options: CookieOptions): void;
};

/**
 * Cliente de Supabase para el servidor (Server Components, Route Handlers, Server Actions o API endpoints)
 * Utiliza @supabase/ssr createServerClient con gestión segura de cookies y tipos.
 */
export function createClient(customCookieStore?: CookieStore) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {

    cookies: {
      getAll() {
        if (!customCookieStore) {
          return [];
        }
        return [];
      },
      setAll(cookiesToSet) {
        if (!customCookieStore) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            customCookieStore.set(name, value, options);
          });
        } catch {
          // El método `setAll` fue llamado desde un Server Component
        }
      },
    },
  });
}

/**
 * Helper para crear cliente con permisos de administración (service_role)
 * Útil para tareas de backend protegidas como webhooks o procesamiento de clips.
 */
export function createAdminClient() {
  const { supabaseUrl } = getSupabaseEnv();
  const serviceRoleKey =
    (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      '[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY no está configurada.'
    );
  }

  return createServerClient<Database>(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
