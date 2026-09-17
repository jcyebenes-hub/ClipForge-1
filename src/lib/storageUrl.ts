/**
 * lib/storageUrl.ts
 *
 * El bucket 'media' de Supabase es PRIVADO (comprobado en el proyecto real:
 * storage.buckets -> public = false). Eso tiene una consecuencia que rompió la
 * previsualización y la descarga de los shorts:
 *
 *   getPublicUrl() devuelve .../object/public/media/<ruta>
 *   y esa URL responde HTTP 400 ("Bucket not found") porque el bucket no es
 *   público. Un <video src> no manda cabecera de autenticación, así que no hay
 *   manera de que funcione.
 *
 * La solución correcta con un bucket privado son las URLs firmadas: llevan el
 * permiso en la propia URL y caducan.
 */
import { supabase, getSupabaseEnv } from './supabase/client';

/** Buckets que existen en el proyecto. */
export const BUCKETS_CONOCIDOS = ['media', 'videos', 'shorts'];

/**
 * Separa el nombre del bucket de la ruta.
 *
 * La app guarda rutas SIN el bucket ("{usuario}/{proyecto}/clips/x_short.mp4"),
 * pero el descargador asumía que el primer segmento era el bucket y acababa
 * pidiendo un bucket llamado como el id del usuario.
 */
export function separarBucketYRuta(bucketPath: string): { bucket: string; ruta: string } {
  const primerSegmento = bucketPath.includes('/') ? bucketPath.split('/')[0] : bucketPath;
  if (BUCKETS_CONOCIDOS.includes(primerSegmento)) {
    return { bucket: primerSegmento, ruta: bucketPath.substring(primerSegmento.length + 1) };
  }
  return { bucket: 'media', ruta: bucketPath };
}

/** Saca la ruta interna de una URL pública o firmada de Supabase Storage. */
export function rutaDesdeUrlPublica(url?: string | null): string | null {
  if (!url) return null;
  for (const marca of ['/object/public/', '/object/sign/']) {
    const i = url.indexOf(marca);
    if (i !== -1) {
      const resto = url.slice(i + marca.length);
      const corte = resto.indexOf('/');
      if (corte === -1) return null;
      const ruta = resto.slice(corte + 1).split('?')[0];
      return ruta || null;
    }
  }
  return null;
}

/**
 * Canjea una ruta del bucket por una URL firmada que sí se puede reproducir.
 * Devuelve null si no se puede firmar (el llamador decide qué hacer).
 */
export async function firmarUrlVideo(
  bucketPath?: string | null,
  segundos = 3600
): Promise<string | null> {
  if (!bucketPath) return null;
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) return null;

  const { bucket, ruta } = separarBucketYRuta(bucketPath);
  if (!ruta) return null;

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(ruta, segundos);
    if (error || !data?.signedUrl) {
      console.warn(`[storageUrl] No se pudo firmar ${bucket}/${ruta}:`, error?.message ?? error);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn('[storageUrl] Error firmando la URL:', err);
    return null;
  }
}
