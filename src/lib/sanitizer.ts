/**
 * lib/sanitizer.ts
 * Utilidades de sanitización y escape de strings para prevenir ataques XSS, inyecciones HTML
 * y caracteres no deseados en títulos, hooks, descripciones y subtítulos.
 */

const HTML_ENTITIES_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escapa caracteres HTML peligrosos para prevenir Cross-Site Scripting (XSS).
 */
export function escaparHTML(str?: string | null): string {
  if (!str) return '';
  return String(str).replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES_MAP[char] || char);
}

/**
 * Sanitiza un título de proyecto o gancho eliminando etiquetas HTML, scripts y limitando longitud.
 */
export function sanitizarTitulo(titulo?: string | null, maxLongitud: number = 120): string {
  if (!titulo) return '';
  
  // 1. Quitar posibles etiquetas HTML <script> o <b> etc.
  const sinEtiquetas = String(titulo)
    .replace(/<[^>]*>?/gm, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

  // 2. Escapar caracteres restantes
  const sanitizado = escaparHTML(sinEtiquetas);

  return sanitizado.slice(0, maxLongitud);
}

/**
 * Sanitiza la descripción de un vídeo o clip.
 */
export function sanitizarDescripcion(desc?: string | null, maxLongitud: number = 500): string {
  if (!desc) return '';

  const sinEtiquetas = String(desc)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .trim();

  const sanitizado = escaparHTML(sinEtiquetas);
  return sanitizado.slice(0, maxLongitud);
}

/**
 * Sanitiza un array de hashtags para garantizar que no contengan HTML o inyecciones.
 */
export function sanitizarHashtags(hashtags?: string[] | null): string[] {
  if (!Array.isArray(hashtags)) return [];

  return hashtags
    .map((tag) => {
      const limpio = String(tag)
        .replace(/<[^>]*>?/gm, '')
        .replace(/[^\w\d_#]/g, '')
        .trim();
      return limpio.startsWith('#') ? limpio : `#${limpio}`;
    })
    .filter((tag) => tag.length > 1 && tag.length <= 35)
    .slice(0, 15);
}
