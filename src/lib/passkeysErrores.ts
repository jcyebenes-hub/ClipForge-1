/**
 * passkeysErrores.ts — traducción de errores de WebAuthn/Supabase (parte pura).
 *
 * Va en un módulo aparte de passkeys.ts a propósito: no importa el cliente de
 * Supabase, así se puede probar sin levantar una conexión.
 */

/**
 * Convierte el error de Supabase/WebAuthn en un mensaje que se entienda.
 * Función pura: se prueba en __tests__/passkeys.test.ts.
 */
export function traducirErrorPasskey(error: unknown): string {
  // Cancelación del usuario: el navegador lanza un DOMException, no un error de Supabase.
  if (error instanceof Error && 'name' in error) {
    if (error.name === 'NotAllowedError') {
      return 'Has cancelado la verificación. Vuelve a intentarlo cuando quieras.';
    }
    if (error.name === 'NotSupportedError') {
      return 'Este navegador no admite este tipo de passkey. Prueba con el navegador del móvil.';
    }
    if (error.name === 'SecurityError') {
      return 'El navegador ha bloqueado la passkey por seguridad (la página debe ir por HTTPS y con el dominio correcto).';
    }
  }

  const bruto =
    typeof error === 'string'
      ? error
      : (error as { message?: string; code?: string })?.message ??
        (error as { code?: string })?.code ??
        '';
  const texto = String(bruto).toLowerCase();
  const codigo = String((error as { code?: string })?.code ?? '').toLowerCase();
  const junto = `${codigo} ${texto}`;

  if (junto.includes('passkey_disabled')) {
    return 'Las passkeys aún no están activadas en el proyecto. Hay que encender el interruptor en Supabase (Authentication → Passkeys).';
  }
  if (junto.includes('webauthn_credential_exists')) {
    return 'Este lector de huellas ya está registrado en tu cuenta. Puedes usarlo para entrar directamente.';
  }
  if (junto.includes('webauthn_credential_not_found')) {
    return 'No hay ninguna huella registrada para tu cuenta en este dispositivo. Actívala primero desde tu perfil.';
  }
  if (junto.includes('webauthn_challenge_expired') || junto.includes('webauthn_challenge_not_found')) {
    return 'La verificación ha caducado. Vuelve a intentarlo.';
  }
  if (junto.includes('webauthn_verification_failed')) {
    return 'No se ha podido verificar la huella. Inténtalo otra vez.';
  }
  if (junto.includes('too_many_passkeys')) {
    return 'Has llegado al máximo de passkeys permitidas por cuenta. Borra alguna desde tu perfil.';
  }
  if (junto.includes('email_not_confirmed') || junto.includes('not_confirmed')) {
    return 'Primero tienes que confirmar tu correo electrónico para poder activar la huella.';
  }
  if (junto.includes('session_not_found') || junto.includes('not_logged_in')) {
    return 'Tienes que iniciar sesión una vez con tu correo antes de activar la huella.';
  }

  return String(bruto) || 'No se ha podido completar la operación con la huella.';
}
