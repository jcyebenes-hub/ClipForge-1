import { refreshYouTubeToken, decryptToken, encryptToken } from './youtubeOauth';
import { supabase } from './supabase/client';

export interface ResumableUploadOptions {
  accessToken: string;
  refreshToken?: string;
  userId?: string;
  videoBuffer?: Uint8Array | ArrayBuffer | Buffer;
  videoUrl?: string;
  title: string;
  description?: string;
  hashtags?: string[];
  duracion_seg?: number;
  isVerticalRatio?: boolean;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  onProgress?: (progress: number, detail: string) => void;
}

export interface ResumableUploadResult {
  success: boolean;
  videoId: string;
  youtubeUrl: string;
  status: string;
  privacyStatus: string;
  title: string;
}

/**
 * Validates Short requirements (aspect ratio 9:16 and duration <= 60s / 180s)
 */
export function validateShortRequirements(options: {
  duracion_seg?: number;
  isVerticalRatio?: boolean;
}): { valid: boolean; warnings: string[]; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (options.duracion_seg !== undefined) {
    if (options.duracion_seg > 180) {
      errors.push(`La duración del vídeo (${options.duracion_seg.toFixed(1)}s) supera el límite máximo de 3 minutos para YouTube Shorts.`);
    } else if (options.duracion_seg > 60) {
      warnings.push(`Duración > 60s (${options.duracion_seg.toFixed(1)}s). YouTube admite Shorts de hasta 3 min en canales actualizados.`);
    }
  }

  if (options.isVerticalRatio === false) {
    warnings.push('El vídeo no parece tener relación de aspecto vertical 9:16. YouTube podría clasificarlo como vídeo estándar.');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Uploads a video as a YouTube Short using YouTube Data API v3 Resumable Upload
 * Handles auto-refresh on 401 and streaming upload
 */
export async function uploadShortResumable(options: ResumableUploadOptions): Promise<ResumableUploadResult> {
  const {
    accessToken: initialToken,
    refreshToken,
    userId,
    videoBuffer,
    videoUrl,
    title,
    description = '',
    hashtags = [],
    duracion_seg,
    isVerticalRatio = true,
    privacyStatus = 'public',
    onProgress,
  } = options;

  // 1. Validation
  const validation = validateShortRequirements({ duracion_seg, isVerticalRatio });
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  let currentAccessToken = initialToken;

  // 2. Obtain video binary data
  let binaryData: Uint8Array;
  if (videoBuffer) {
    if (videoBuffer instanceof Uint8Array) {
      binaryData = videoBuffer;
    } else if (videoBuffer instanceof ArrayBuffer) {
      binaryData = new Uint8Array(videoBuffer);
    } else {
      binaryData = new Uint8Array(videoBuffer as any);
    }
  } else if (videoUrl) {
    onProgress?.(10, 'Descargando clip de vídeo para la subida a YouTube...');
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`No se pudo descargar el archivo de vídeo para subir: ${videoRes.statusText}`);
    }
    const arrayBuf = await videoRes.arrayBuffer();
    binaryData = new Uint8Array(arrayBuf);
  } else {
    throw new Error('Se requiere un búfer de vídeo o una URL para realizar la subida.');
  }

  const videoSizeBytes = binaryData.byteLength;

  // 3. Format Snippet & Tags
  // Ensure title includes #Shorts if not present and is trimmed to 100 chars
  let cleanTitle = title.trim();
  if (!cleanTitle.toLowerCase().includes('#shorts') && cleanTitle.length <= 90) {
    cleanTitle = `${cleanTitle} #Shorts`;
  }
  cleanTitle = cleanTitle.slice(0, 100);

  // Form description with hashtags
  const formattedHashtags = (hashtags || []).map(h => (h.startsWith('#') ? h : `#${h}`));
  const hashtagBlock = formattedHashtags.length > 0 ? `\n\n${formattedHashtags.join(' ')}` : '';
  const fullDescription = `${description.trim()}${hashtagBlock}\n\nCreado con ClipForge AI`.trim();

  const metadata = {
    snippet: {
      title: cleanTitle,
      description: fullDescription,
      tags: formattedHashtags.map(h => h.replace('#', '')),
      categoryId: '22', // People & Blogs
      defaultLanguage: 'es',
    },
    status: {
      privacyStatus: privacyStatus, // 'public' | 'unlisted' | 'private'
      selfDeclaredMadeForKids: false,
      embeddable: true,
    },
  };

  // Helper for YouTube session creation with auto-retry on 401
  const initiateSession = async (token: string, isRetry = false): Promise<string> => {
    onProgress?.(25, 'Iniciando sesión resumable en YouTube Data API...');

    const response = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(videoSizeBytes),
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (response.status === 401 && refreshToken && !isRetry) {
      onProgress?.(30, 'Token de YouTube expirado. Renovando credenciales...');
      const refreshed = await refreshYouTubeToken(refreshToken);
      currentAccessToken = refreshed.access_token;

      // Update Supabase or storage if userId provided
      if (userId) {
        try {
          const encAccess = await encryptToken(refreshed.access_token);
          await (supabase.from('user_oauth' as any) as any)
            .update({
              access_token: encAccess,
              expires_at: refreshed.expires_at,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('provider', 'youtube');
        } catch {}
      }

      return initiateSession(currentAccessToken, true);
    }

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Error al iniciar la subida en YouTube (${response.status}): ${errBody}`);
    }

    const sessionLocation = response.headers.get('Location');
    if (!sessionLocation) {
      throw new Error('YouTube no devolvió una URL de subida (Location header).');
    }

    return sessionLocation;
  };

  const uploadLocationUrl = await initiateSession(currentAccessToken);

  // 4. Upload binary chunks / stream
  onProgress?.(40, `Subiendo paquete de vídeo (${(videoSizeBytes / (1024 * 1024)).toFixed(2)} MB) a YouTube Shorts...`);

  const uploadResponse = await fetch(uploadLocationUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoSizeBytes),
    },
    body: binaryData,
  });

  if (!uploadResponse.ok) {
    const uploadErr = await uploadResponse.text();
    throw new Error(`Error al transferir vídeo a YouTube (${uploadResponse.status}): ${uploadErr}`);
  }

  const resultData = await uploadResponse.json();
  const videoId = resultData.id;
  const youtubeUrl = `https://youtube.com/shorts/${videoId}`;

  onProgress?.(100, `¡Vídeo publicado con éxito! ID: ${videoId}`);

  return {
    success: true,
    videoId,
    youtubeUrl,
    status: resultData.status?.uploadStatus || 'uploaded',
    privacyStatus: resultData.status?.privacyStatus || privacyStatus,
    title: resultData.snippet?.title || cleanTitle,
  };
}
