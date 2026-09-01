import { supabase, getSupabaseEnv } from './supabase/client';
import { toast } from 'sonner';

export interface DownloadClipOptions {
  proyectoTitulo?: string;
  clipIndex?: number;
  clipId?: string;
  videoUrl?: string | null;
  bucketPath?: string | null;
  blob?: Blob | null;
  aspectRatio?: string;
}

/**
 * Sanitizes a string for clean, cross-platform filesystem filenames.
 * E.g. "¡Mi Podcast Épico #1! -> "mi_podcast_epico_1"
 */
export function sanitizarNombreArchivo(texto?: string): string {
  if (!texto || texto.trim().length === 0) return 'proyecto';

  return texto
    .toLowerCase()
    .normalize('NFD') // separate accents
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/[^a-z0-9-_]/g, '_') // replace non-alphanumeric with underscores
    .replace(/_+/g, '_') // collapse multiple underscores
    .replace(/^_+|_+$/g, '') // trim leading/trailing underscores
    .slice(0, 45) || 'proyecto';
}

/**
 * Generates the standardized sanitized download filename:
 * {titulo_proyecto}-clip-{n}.mp4
 */
export function generarNombreArchivoClip(
  proyectoTitulo?: string,
  clipIndex?: number,
  clipId?: string,
  aspectRatio?: string
): string {
  const baseTitle = sanitizarNombreArchivo(proyectoTitulo);
  const indexStr = typeof clipIndex === 'number' && clipIndex > 0 ? clipIndex : (clipId ? clipId.replace(/[^0-9]/g, '') || '1' : '1');
  
  return `${baseTitle}-clip-${indexStr}.mp4`;
}

/**
 * Triggers a download from a Blob or URL using an invisible <a> tag.
 */
export function triggerFileDownload(blobOrUrl: Blob | string, filename: string) {
  let objectUrl: string;
  let shouldRevoke = false;

  if (blobOrUrl instanceof Blob) {
    objectUrl = URL.createObjectURL(blobOrUrl);
    shouldRevoke = true;
  } else {
    objectUrl = blobOrUrl;
  }

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (shouldRevoke) {
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 5000);
  }
}

/**
 * Downloads a short clip:
 * 1. Checks if direct Blob is provided.
 * 2. If Supabase storage bucket path is provided, downloads via supabase.storage.
 * 3. Falls back to fetch(videoUrl) -> blob -> download.
 * 4. Ensures the filename is {titulo_proyecto}-clip-{n}.mp4.
 */
export async function descargarClipMP4(options: DownloadClipOptions): Promise<boolean> {
  const {
    proyectoTitulo = 'clipforge_video',
    clipIndex = 1,
    clipId,
    videoUrl,
    bucketPath,
    blob,
    aspectRatio,
  } = options;

  const filename = generarNombreArchivoClip(proyectoTitulo, clipIndex, clipId, aspectRatio);

  try {
    // 1. Direct Blob available (from FFmpeg client-side rendering)
    if (blob) {
      triggerFileDownload(blob, filename);
      toast.success('Descarga iniciada', {
        description: `Guardando ${filename} en tu dispositivo.`,
      });
      return true;
    }

    // 2. Fetch from Supabase Storage bucket if bucketPath is available
    if (bucketPath) {
      const { isConfigured } = getSupabaseEnv();
      if (isConfigured) {
        toast.info('Descargando vídeo desde el almacenamiento...', {
          description: `Obteniendo ${filename}...`,
        });

        // Determine bucket name (try 'media', 'videos' or 'shorts')
        const bucketName = bucketPath.includes('/') ? bucketPath.split('/')[0] : 'media';
        const cleanPath = bucketPath.includes('/') ? bucketPath.substring(bucketPath.indexOf('/') + 1) : bucketPath;

        try {
          const { data, error } = await supabase.storage.from(bucketName).download(cleanPath);
          if (!error && data) {
            triggerFileDownload(data, filename);
            toast.success('¡Descarga completada!', {
              description: `Archivo guardado como ${filename}`,
            });
            return true;
          }
        } catch (bucketErr) {
          console.warn('Storage bucket download attempt 1 failed, trying direct URL:', bucketErr);
        }
      }
    }

    // 3. If videoUrl is a blob URL
    if (videoUrl && videoUrl.startsWith('blob:')) {
      triggerFileDownload(videoUrl, filename);
      toast.success('Descarga iniciada', {
        description: `Guardando ${filename}`,
      });
      return true;
    }

    // 4. If videoUrl is a remote HTTP/HTTPS url
    if (videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
      toast.info('Preparando descarga...', {
        description: `Descargando ${filename}...`,
      });

      try {
        const response = await fetch(videoUrl);
        if (response.ok) {
          const fetchedBlob = await response.blob();
          triggerFileDownload(fetchedBlob, filename);
          toast.success('Descarga iniciada', {
            description: `Guardando ${filename}`,
          });
          return true;
        }
      } catch (fetchErr) {
        console.warn('Direct fetch failed due to CORS, opening fallback download link:', fetchErr);
      }

      // Fallback: direct anchor link
      triggerFileDownload(videoUrl, filename);
      toast.success('Descarga iniciada en nueva pestaña', {
        description: filename,
      });
      return true;
    }

    throw new Error('No hay ninguna fuente de vídeo disponible para descargar.');
  } catch (err: any) {
    console.error('Error al descargar clip:', err);
    toast.error('Error al descargar el archivo', {
      description: err.message || 'No se pudo obtener el archivo de vídeo.',
    });
    return false;
  }
}

/**
 * Copies public video link to clipboard with user feedback.
 */
export async function copiarEnlacePublicoClip(url: string, tituloClip?: string): Promise<boolean> {
  if (!url) {
    toast.error('No hay enlace disponible para este clip');
    return false;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      // Fallback for older browsers / unsecured contexts
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    toast.success('¡Enlace copiado al portapapeles!', {
      description: tituloClip ? `Enlace de "${tituloClip.slice(0, 35)}..." listo para compartir.` : 'Puedes pegarlo donde quieras para compartir el vídeo.',
    });
    return true;
  } catch (err: any) {
    console.error('Error al copiar enlace:', err);
    toast.error('No se pudo copiar el enlace automáticamente', {
      description: 'Por favor, copia la URL manualmente desde la barra de direcciones.',
    });
    return false;
  }
}
