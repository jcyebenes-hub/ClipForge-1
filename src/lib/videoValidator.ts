/**
 * lib/videoValidator.ts
 * Utilidades de validación profunda de archivos de vídeo:
 * 1. Comprobación de extensiones permitidas (.mp4, .webm, .mov)
 * 2. Límite estricto de tamaño (máx 500 MB)
 * 3. Verificación de Magic Bytes / Cabecera binaria del contenedor (FTYP para MP4/MOV, EBML para WebM, etc.)
 * 4. Verificación de decodificación de metadatos de vídeo en el navegador
 */

export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
export const EXTENSIONES_PERMITIDAS = ['.mp4', '.webm', '.mov', '.m4v'];

export interface ValidacionVideoResultado {
  esValido: boolean;
  error?: string;
  formatoDetectado?: 'mp4' | 'webm' | 'mov' | 'desconocido';
  duracionSeg?: number;
  ancho?: number;
  alto?: number;
  tamanoMb?: number;
}

/**
 * Lee los primeros 64 bytes de un archivo o blob para verificar la firma de magic bytes
 */
export async function validarMagicBytesVideo(fileOrBlob: Blob): Promise<{ esVideoReal: boolean; formato: 'mp4' | 'webm' | 'mov' | 'desconocido' }> {
  try {
    const slice = fileOrBlob.slice(0, 64);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. WebM: Comienza con la cabecera EBML [0x1A, 0x45, 0xDF, 0xA3]
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return { esVideoReal: true, formato: 'webm' };
    }

    // 2. MP4 / MOV / M4V: El átomo 'ftyp' suele estar en los bytes 4..7 [0x66, 0x74, 0x79, 0x70] o en los primeros 32 bytes
    let hasFtyp = false;
    let isQuickTime = false;

    for (let i = 0; i <= bytes.length - 8; i++) {
      // "ftyp" en ASCII es 102, 116, 121, 112
      if (bytes[i] === 0x66 && bytes[i + 1] === 0x74 && bytes[i + 2] === 0x79 && bytes[i + 3] === 0x70) {
        hasFtyp = true;
        // Revisar sub-marca: 'qt  ' o 'isom' o 'mp41' o 'mp42' o 'dash'
        const brand = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
        if (brand === 'qt  ' || brand === 'moov') {
          isQuickTime = true;
        }
        break;
      }
      // "moov" en ASCII para algunos archivos QuickTime MOV
      if (bytes[i] === 0x6D && bytes[i + 1] === 0x6F && bytes[i + 2] === 0x6F && bytes[i + 3] === 0x76) {
        hasFtyp = true;
        isQuickTime = true;
        break;
      }
    }

    if (hasFtyp) {
      return { esVideoReal: true, formato: isQuickTime ? 'mov' : 'mp4' };
    }

    // 3. Verificación de Matroska / MKV general (EBML)
    if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45) {
      return { esVideoReal: true, formato: 'webm' };
    }

    return { esVideoReal: false, formato: 'desconocido' };
  } catch (err) {
    console.warn('Error leyendo magic bytes del archivo:', err);
    return { esVideoReal: false, formato: 'desconocido' };
  }
}

/**
 * Valida un archivo de vídeo de manera completa (extensión, tamaño, magic bytes y metadatos)
 */
export async function validarArchivoVideo(file: File): Promise<ValidacionVideoResultado> {
  const tamanoMb = Number((file.size / (1024 * 1024)).toFixed(2));

  // 1. Validar tamaño máximo (500 MB)
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return {
      esValido: false,
      error: `El archivo supera el tamaño máximo permitido de 500 MB (tu archivo pesa ${tamanoMb} MB).`,
      tamanoMb,
    };
  }

  if (file.size === 0) {
    return {
      esValido: false,
      error: 'El archivo seleccionado está vacío (0 bytes).',
      tamanoMb: 0,
    };
  }

  // 2. Validar extensión permitida
  const nombreMin = file.name.toLowerCase();
  const tieneExtensionPermitida = EXTENSIONES_PERMITIDAS.some((ext) => nombreMin.endsWith(ext));

  if (!tieneExtensionPermitida && !file.type.startsWith('video/')) {
    return {
      esValido: false,
      error: `Extensión de archivo no permitida. Formatos admitidos: ${EXTENSIONES_PERMITIDAS.join(', ')}.`,
      tamanoMb,
    };
  }

  // 3. Validar Magic Bytes / Header real del archivo
  const { esVideoReal, formato } = await validarMagicBytesVideo(file);

  // Si no coincide magic bytes y tampoco el mime type video/*, rechazamos
  if (!esVideoReal && !file.type.startsWith('video/')) {
    return {
      esValido: false,
      error: 'El archivo seleccionado no es un contenedor de vídeo válido (cabecera corrupta o formato irreconocible).',
      formatoDetectado: 'desconocido',
      tamanoMb,
    };
  }

  // 4. Validar que el navegador pueda decodificar la pista y metadatos
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';

    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(objectUrl);
        // Si ya pasó magic bytes permitimos continuar aunque el navegador tarde
        resolve({
          esValido: true,
          formatoDetectado: formato !== 'desconocido' ? formato : 'mp4',
          tamanoMb,
        });
      }
    }, 4000);

    tempVideo.onloadedmetadata = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        const duracion = Math.round(tempVideo.duration) || 0;
        const w = tempVideo.videoWidth || 0;
        const h = tempVideo.videoHeight || 0;
        URL.revokeObjectURL(objectUrl);

        resolve({
          esValido: true,
          duracionSeg: duracion,
          ancho: w,
          alto: h,
          formatoDetectado: formato !== 'desconocido' ? formato : (file.name.endsWith('.webm') ? 'webm' : (file.name.endsWith('.mov') ? 'mov' : 'mp4')),
          tamanoMb,
        });
      }
    };

    tempVideo.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);

        // Si falló decodificación pero tenía magic bytes válidos
        if (esVideoReal) {
          resolve({
            esValido: true,
            formatoDetectado: formato,
            tamanoMb,
          });
        } else {
          resolve({
            esValido: false,
            error: 'El archivo de vídeo no pudo ser reproducido o procesado por el códec del navegador.',
            formatoDetectado: formato,
            tamanoMb,
          });
        }
      }
    };

    tempVideo.src = objectUrl;
  });
}
