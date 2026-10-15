/**
 * Decide si un archivo tiene pista de sonido sin fiarse de un fallo de FFmpeg.
 * "Output file does not contain any stream" sale también cuando el códec no
 * se puede recodificar, y no significa que el vídeo esté mudo.
 */

function ascii(bytes: Uint8Array, inicio: number, n: number): string {
  let s = '';
  for (let i = 0; i < n && inicio + i < bytes.length; i++) {
    s += String.fromCharCode(bytes[inicio + i]);
  }
  return s;
}

/** true = hay pista, false = contenedor abierto y no hay, null = no se sabe. */
export function contenedorTienePistaAudio(bytes: Uint8Array): boolean | null {
  if (bytes.length < 4) return null;

  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return true;
  if (ascii(bytes, 0, 3) === 'ID3') return true;
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    if (['A_OPUS', 'A_VORBIS', 'A_AAC', 'A_PCM', 'A_FLAC', 'A_MPEG'].some((c) => incluye(bytes, c))) {
      return true;
    }
    if (['V_VP8', 'V_VP9', 'V_AV1', 'V_MPEG4'].some((c) => incluye(bytes, c))) return false;
    return null;
  }

  const esIso = ascii(bytes, 4, 4) === 'ftyp';
  if (!esIso && !incluye(bytes, 'moov')) return null;

  let vioCaja = false;
  let vioVideo = false;
  let vioSonido = false;
  for (let i = 0; i + 16 <= bytes.length; i++) {
    if (
      bytes[i] === 0x68 &&
      bytes[i + 1] === 0x64 &&
      bytes[i + 2] === 0x6c &&
      bytes[i + 3] === 0x72
    ) {
      const handler = ascii(bytes, i + 12, 4);
      if (handler === 'soun') vioSonido = true;
      if (handler === 'vide') vioVideo = true;
      if (handler === 'soun' || handler === 'vide') vioCaja = true;
    }
  }
  if (vioSonido) return true;
  if (esIso && vioCaja && vioVideo && !vioSonido) return false;
  return null;
}

function incluye(bytes: Uint8Array, palabra: string): boolean {
  const n = palabra.length;
  for (let i = 0; i + n <= bytes.length; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      if (bytes[i + j] !== palabra.charCodeAt(j)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function extensionParaFFmpeg(bytes: Uint8Array, nombre = ''): string {
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'webm';
  }
  if (ascii(bytes, 0, 4) === 'RIFF') return 'wav';
  if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'mp3';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const marca = ascii(bytes, 8, 4);
    if (marca === 'qt  ') return 'mov';
    return 'mp4';
  }
  const ext = /\.(webm|mkv|mov|mp4|m4a|mp3|wav|ogg|mpeg|mpg|avi|ts)$/i.exec(nombre);
  return ext ? ext[1].toLowerCase() : 'mp4';
}

/**
 * Solo es "sin audio" si FFmpeg abrió el archivo, vio vídeo y no encontró
 * ninguna pista de audio. Un fallo al recodificar no cuenta.
 */
export function logsIndicanSinAudio(logs: string[]): boolean {
  const text = logs.join('\n');
  const hayAudio = /Stream #\d+:\d+[^\n]*Audio:/i.test(text);
  if (hayAudio) return false;
  const abrio = /Input #\d+/i.test(text);
  const hayVideo = /Stream #\d+:\d+[^\n]*Video:/i.test(text);
  const mapaVacio = /matches no streams/i.test(text);
  return abrio && hayVideo && mapaVacio;
}
