/**
 * Correo de contacto de ClipForge, en un solo sitio.
 *
 * Es el buzón que el responsable lee de verdad. Si más adelante hay un correo
 * oficial, se cambia aquí y dejan de existir las direcciones inventadas
 * (contacto@clipforge.ai, soporte@clipforge.ai), que no tienen dominio.
 */

export const CORREO_CONTACTO = 'academiamicabo@hotmail.com';

/** Plazo máximo, en días, para completar un borrado pedido por correo. */
export const PLAZO_BORRADO_DIAS = 30;

export const ASUNTO_BORRADO = 'Borrar mi cuenta de ClipForge';

/** Texto que el usuario envía o copia para pedir el borrado. */
export function textoSolicitudBorrado(email?: string | null): string {
  const cuenta = email?.trim()
    ? `Correo de la cuenta: ${email.trim()}`
    : 'Correo de la cuenta: (el mismo desde el que escribo)';
  return [
    'Hola,',
    '',
    'Quiero borrar mi cuenta de ClipForge y los datos asociados.',
    cuenta,
    '',
    `Entiendo que el borrado se hace a mano, en un plazo de ${PLAZO_BORRADO_DIAS} días.`,
  ].join('\n');
}

/** Abre el correo del usuario con el asunto y el cuerpo ya escritos. */
export function mailtoBorrado(email?: string | null): string {
  return `mailto:${CORREO_CONTACTO}?subject=${encodeURIComponent(ASUNTO_BORRADO)}&body=${encodeURIComponent(textoSolicitudBorrado(email))}`;
}

export function mailtoContacto(asunto = 'Consulta sobre ClipForge'): string {
  return `mailto:${CORREO_CONTACTO}?subject=${encodeURIComponent(asunto)}`;
}
