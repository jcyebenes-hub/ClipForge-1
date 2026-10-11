/**
 * passkeys.ts — acceso con huella dactilar / Face ID (WebAuthn).
 *
 * Usa el soporte nativo de Supabase Auth (beta desde mayo de 2026, requiere
 * @supabase/supabase-js >= 2.105.0; el proyecto lleva 2.112.4). Supabase emite la
 * sesión él mismo, así que no se genera ningún token por nuestra cuenta.
 *
 * IMPORTANTE: hay que activarlo antes en el panel de Supabase
 * (Authentication → Passkeys → Enable) indicando el Relying Party ID. Si no está
 * activado, Supabase responde `passkey_disabled` y aquí se traduce a un mensaje claro.
 *
 * La huella queda atada al DOMINIO (Relying Party ID). Si cambia el dominio, las
 * passkeys registradas dejan de valer y hay que volver a activarlas.
 */

import { supabase } from './supabase/client';
import { traducirErrorPasskey } from './passkeysErrores';

export { traducirErrorPasskey };

export interface PasskeyInfo {
  id: string;
  friendly_name?: string | null;
  created_at?: string;
}

export interface ResultadoPasskey {
  ok: boolean;
  error?: string;
  id?: string;
  /** Código crudo devuelto por Supabase, para depurar. */
  codigo?: string;
}

/** ¿Este navegador puede usar passkeys? (móvil: Touch ID / huella de Android) */
export function passkeysDisponibles(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';
}

/** Registra la huella de este dispositivo. Requiere una sesión iniciada y el correo confirmado. */
export async function activarHuella(nombre?: string): Promise<ResultadoPasskey> {
  if (!passkeysDisponibles()) {
    return { ok: false, error: 'Este navegador no admite huella dactilar ni Face ID.' };
  }
  try {
    const { data, error } = await (
      supabase.auth as unknown as {
        registerPasskey: (opts?: { friendlyName?: string }) => Promise<{
          data: { id: string } | null;
          error: { message?: string; code?: string } | null;
        }>;
      }
    ).registerPasskey(nombre ? { friendlyName: nombre } : undefined);
    if (error) {
      return { ok: false, error: traducirErrorPasskey(error), codigo: error.code };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: traducirErrorPasskey(e) };
  }
}

/** Entra con la huella. No pide correo ni contraseña: el dispositivo resuelve la cuenta. */
export async function entrarConHuella(): Promise<ResultadoPasskey> {
  if (!passkeysDisponibles()) {
    return { ok: false, error: 'Este navegador no admite huella dactilar ni Face ID.' };
  }
  try {
    const { error } = await (
      supabase.auth as unknown as {
        signInWithPasskey: () => Promise<{
          data: unknown;
          error: { message?: string; code?: string } | null;
        }>;
      }
    ).signInWithPasskey();
    if (error) return { ok: false, error: traducirErrorPasskey(error), codigo: error.code };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducirErrorPasskey(e) };
  }
}

/** Lista las passkeys de la cuenta (para mostrarlas y poder borrarlas). */
export async function listarPasskeys(): Promise<{ ok: boolean; passkeys: PasskeyInfo[]; error?: string }> {
  try {
    const fn = (supabase.auth as unknown as {
      passkey?: { list: () => Promise<{ data: { passkeys?: PasskeyInfo[] } | null; error: unknown }> };
    }).passkey;
    if (!fn?.list) return { ok: false, passkeys: [], error: 'Esta versión de Supabase no expone la lista de passkeys.' };
    const { data, error } = await fn.list();
    if (error) return { ok: false, passkeys: [], error: traducirErrorPasskey(error) };
    return { ok: true, passkeys: data?.passkeys ?? [] };
  } catch (e) {
    return { ok: false, passkeys: [], error: traducirErrorPasskey(e) };
  }
}

/** Borra una passkey de la cuenta. */
export async function borrarPasskey(passkeyId: string): Promise<ResultadoPasskey> {
  try {
    const fn = (supabase.auth as unknown as {
      passkey?: { delete: (o: { passkeyId: string }) => Promise<{ error: unknown }> };
    }).passkey;
    if (!fn?.delete) return { ok: false, error: 'Esta versión de Supabase no permite borrar passkeys.' };
    const { error } = await fn.delete({ passkeyId });
    if (error) return { ok: false, error: traducirErrorPasskey(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducirErrorPasskey(e) };
  }
}
