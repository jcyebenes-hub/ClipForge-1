import { describe, it, expect } from 'vitest';
import { traducirErrorPasskey } from '../src/lib/passkeysErrores';

describe('traducirErrorPasskey', () => {
  it('traduce el cancelado del usuario (DOMException del navegador)', () => {
    const e = new Error('cancelled');
    e.name = 'NotAllowedError';
    expect(traducirErrorPasskey(e)).toContain('Has cancelado');
  });

  it('traduce navegador sin soporte y bloqueo de seguridad', () => {
    const a = new Error('x');
    a.name = 'NotSupportedError';
    expect(traducirErrorPasskey(a)).toContain('no admite');
    const b = new Error('x');
    b.name = 'SecurityError';
    expect(traducirErrorPasskey(b)).toContain('HTTPS');
  });

  it('traduce passkey_disabled: el interruptor de Supabase está apagado', () => {
    const msg = traducirErrorPasskey({ code: 'passkey_disabled', message: 'Passkey sign-in is not enabled' });
    expect(msg).toContain('Authentication → Passkeys');
  });

  it('traduce los códigos de WebAuthn documentados por Supabase', () => {
    expect(traducirErrorPasskey({ code: 'webauthn_credential_exists' })).toContain('ya está registrado');
    expect(traducirErrorPasskey({ code: 'webauthn_credential_not_found' })).toContain('No hay ninguna huella');
    expect(traducirErrorPasskey({ code: 'webauthn_challenge_expired' })).toContain('caducado');
    expect(traducirErrorPasskey({ code: 'webauthn_challenge_not_found' })).toContain('caducado');
    expect(traducirErrorPasskey({ code: 'webauthn_verification_failed' })).toContain('No se ha podido verificar');
    expect(traducirErrorPasskey({ code: 'too_many_passkeys' })).toContain('máximo');
  });

  it('traduce el correo sin confirmar y la falta de sesión', () => {
    expect(traducirErrorPasskey({ message: 'email_not_confirmed' })).toContain('confirmar tu correo');
    expect(traducirErrorPasskey({ message: 'session_not_found' })).toContain('iniciar sesión una vez');
  });

  it('funciona con un string suelto y con basura', () => {
    expect(traducirErrorPasskey('passkey_disabled')).toContain('Authentication → Passkeys');
    expect(traducirErrorPasskey('')).toContain('No se ha podido completar');
    expect(traducirErrorPasskey(null)).toContain('No se ha podido completar');
    expect(traducirErrorPasskey(undefined)).toContain('No se ha podido completar');
    // un error desconocido se muestra tal cual, no se inventa nada
    expect(traducirErrorPasskey({ message: 'fallo raro 42' })).toBe('fallo raro 42');
  });
});
