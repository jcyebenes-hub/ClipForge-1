/**
 * Búsqueda de vídeo de banco (Pexels) con licencia que permite uso comercial.
 *
 * Licencia de Pexels (resumen): uso comercial y no comercial permitido, sin
 * necesidad de atribución (aunque se agradece); no se pueden vender copias sin
 * modificar ni redistribuir el material como si fuera propio.
 * https://www.pexels.com/license/
 *
 * Notas de la API verificadas (2026-09):
 *  - `GET https://api.pexels.com/videos/search` responde con `access-control-allow-origin: *`,
 *    así que se puede llamar desde el navegador sin proxy.
 *  - Los archivos de `videos.pexels.com` también permiten CORS (`*`) y rangos
 *    (`accept-ranges: bytes`), por lo que el navegador puede descargarlos directamente.
 *  - Oficialmente la API pide clave gratuita; hoy responde también sin ella
 *    (200 con datos, apoyado en caché: `cache-control: public, max-age=3600`).
 *    Por eso la clave es OPCIONAL: si algún día la exigen, basta con añadir
 *    VITE_PEXELS_API_KEY y se manda en la cabecera Authorization.
 */

export interface ArchivoVideoStock {
  id: number;
  calidad: string; // 'hd' | 'sd'
  tipo: string; // 'video/mp4'
  ancho?: number;
  alto?: number;
  fps?: number;
  enlace: string;
}

export interface VideoStock {
  id: number;
  /** Página del vídeo en Pexels (para atribución). */
  pagina: string;
  /** Miniatura. */
  imagen: string;
  duracionSeg: number;
  ancho: number;
  alto: number;
  autor: string;
  autorUrl: string;
  archivos: ArchivoVideoStock[];
}

export interface ResultadoBusquedaStock {
  videos: VideoStock[];
  total: number;
  pagina: number;
  /** true si la petición se hizo sin clave (puede dejar de funcionar si Pexels la exige). */
  sinClave: boolean;
}

export interface OpcionesBusquedaStock {
  apiKey?: string;
  /** Solo para pruebas: sustituye la URL de la API (por defecto Pexels). */
  endpoint?: string;
  page?: number;
  perPage?: number;
  /** 'portrait' da más resultados verticales, útiles para Reels/TikTok. */
  orientacion?: 'landscape' | 'portrait' | 'square';
  tamano?: 'large' | 'medium' | 'small';
}

export const PEXELS_ENDPOINT = 'https://api.pexels.com/videos/search';

/** Lanza un error legible cuando la API rechaza la petición. */
function errorApi(status: number, cuerpo: string): Error {
  if (status === 401 || status === 403) {
    return new Error(
      'Pexels pide clave de API. Crea una gratis en https://www.pexels.com/api/ y añádela como VITE_PEXELS_API_KEY.'
    );
  }
  if (status === 429) {
    return new Error('Has alcanzado el límite de peticiones de Pexels. Espera un poco y vuelve a intentarlo.');
  }
  return new Error(`Pexels respondió ${status}${cuerpo ? `: ${cuerpo.slice(0, 200)}` : ''}`);
}

export async function buscarVideosStock(
  query: string,
  opciones: OpcionesBusquedaStock = {}
): Promise<ResultadoBusquedaStock> {
  const { apiKey, page = 1, perPage = 12, orientacion, tamano, endpoint = PEXELS_ENDPOINT } = opciones;
  const limpia = query.trim();
  if (!limpia) return { videos: [], total: 0, pagina: page, sinClave: !apiKey };

  const params = new URLSearchParams({ query: limpia, page: String(page), per_page: String(perPage) });
  if (orientacion) params.set('orientation', orientacion);
  if (tamano) params.set('size', tamano);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = apiKey;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${endpoint}?${params.toString()}`, { headers });
  } catch (e: any) {
    throw new Error(`No se pudo contactar con Pexels (${e?.message || 'error de red'})`);
  }
  if (!respuesta.ok) throw errorApi(respuesta.status, await respuesta.text());

  const datos = await respuesta.json();
  const crudos: any[] = Array.isArray(datos?.videos) ? datos.videos : [];

  const videos: VideoStock[] = crudos
    .map((v) => ({
      id: Number(v.id),
      pagina: String(v.url || ''),
      imagen: String(v.image || ''),
      duracionSeg: Number(v.duration) || 0,
      ancho: Number(v.width) || 0,
      alto: Number(v.height) || 0,
      autor: String(v?.user?.name || 'Pexels'),
      autorUrl: String(v?.user?.url || 'https://www.pexels.com/'),
      archivos: (Array.isArray(v.video_files) ? v.video_files : [])
        .filter((f: any) => f?.link && String(f.file_type || '').includes('mp4'))
        .map((f: any) => ({
          id: Number(f.id),
          calidad: String(f.quality || ''),
          tipo: String(f.file_type || 'video/mp4'),
          ancho: f.width ? Number(f.width) : undefined,
          alto: f.height ? Number(f.height) : undefined,
          fps: f.fps ? Number(f.fps) : undefined,
          enlace: String(f.link),
        })),
    }))
    .filter((v) => v.archivos.length > 0);

  return {
    videos,
    total: Number(datos?.total_results) || videos.length,
    pagina: Number(datos?.page) || page,
    sinClave: !apiKey,
  };
}

/**
 * Elige el archivo más adecuado: mp4, con la altura más cercana a `altoObjetivo`
 * sin pasarse demasiado (por defecto 1080p). Devuelve null si no hay mp4.
 */
export function elegirArchivo(
  video: VideoStock,
  altoObjetivo = 1080
): ArchivoVideoStock | null {
  if (!video.archivos.length) return null;
  const conAlto = video.archivos.filter((a) => a.alto && a.alto > 0);
  const candidatos = conAlto.length ? conAlto : video.archivos;
  return [...candidatos].sort((a, b) => {
    const da = Math.abs((a.alto || 0) - altoObjetivo);
    const db = Math.abs((b.alto || 0) - altoObjetivo);
    if (da !== db) return da - db; // el más cercano a 1080p
    return (b.alto || 0) - (a.alto || 0); // a igualdad, el de más resolución
  })[0];
}

/** Formatea segundos como m:ss. */
export function formatoSegundos(seg: number): string {
  if (!Number.isFinite(seg) || seg <= 0) return '--:--';
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
