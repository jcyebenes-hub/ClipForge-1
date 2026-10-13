import { describe, expect, it } from 'vitest';
import {
  ASUNTO_BORRADO,
  CORREO_CONTACTO,
  PLAZO_BORRADO_DIAS,
  mailtoBorrado,
  textoSolicitudBorrado,
} from '../src/lib/contacto';

describe('contacto de borrado', () => {
  it('usa el buzón que el responsable lee', () => {
    expect(CORREO_CONTACTO).toBe('academiamicabo@hotmail.com');
  });

  it('incluye el correo de la cuenta cuando hay sesión', () => {
    const texto = textoSolicitudBorrado('ana@ejemplo.com');
    expect(texto).toContain('ana@ejemplo.com');
    expect(texto).toContain(String(PLAZO_BORRADO_DIAS));
  });

  it('no inventa un correo si no hay sesión', () => {
    expect(textoSolicitudBorrado(null)).toContain('el mismo desde el que escribo');
    expect(textoSolicitudBorrado('  ')).not.toContain('@');
  });

  it('el mailto abre el buzón real con el asunto codificado', () => {
    const url = mailtoBorrado('ana@ejemplo.com');
    expect(url.startsWith(`mailto:${CORREO_CONTACTO}?`)).toBe(true);
    expect(url).toContain(encodeURIComponent(ASUNTO_BORRADO));
    expect(url).toContain(encodeURIComponent('ana@ejemplo.com'));
    expect(url).not.toContain('clipforge.ai');
  });
});
