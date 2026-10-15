/**
 * Client-Side Audio Extractor & Resampler
 * Extrae y remuestrea la pista de audio de un vídeo en el navegador
 * utilizando la Web Audio API nativa para producir WAV 16kHz mono (formato óptimo para Whisper).
 */

/**
 * Convierte un AudioBuffer en un Blob WAV de 16-bit PCM mono a 16kHz.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const channelData = buffer.getChannelData(0);
  const dataLength = channelData.length * (bitDepth / 8);
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true); // SampleRate (16000)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // ByteRate
  view.setUint16(32, numChannels * (bitDepth / 8), true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Write PCM audio samples (clamped between -1.0 and 1.0)
  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export interface AudioExtractionProgress {
  percent: number;
  stage: string;
  detail?: string;
}

/**
 * Extrae la pista de audio de un archivo de vídeo o URL y la remuestrea a 16kHz mono.
 */
import { getLoadedFFmpeg } from './videoCutter';
import {
  contenedorTienePistaAudio,
  extensionParaFFmpeg,
  logsIndicanSinAudio,
} from './pistaAudio';

/**
 * Extrae el audio a 16kHz mono con FFmpeg WASM. Es fiable con cualquier
 * contenedor (MP4, MOV, WebM...), algo que decodeAudioData del navegador NO
 * garantiza para vídeo multiplexado. Devuelve el WAV y su duración.
 */
function parsearDuracionFFmpeg(logs: string[]): number {
  for (const linea of logs) {
    const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(linea);
    if (m) {
      return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
    }
  }
  return 0;
}

async function leerSalida(
  ffmpeg: Awaited<ReturnType<typeof getLoadedFFmpeg>>,
  nombre: string
): Promise<Uint8Array | null> {
  try {
    const out = (await ffmpeg.readFile(nombre)) as Uint8Array;
    return out.length > 44 ? out : null;
  } catch {
    return null;
  }
}

async function extraerConFFmpeg(
  arrayBuffer: ArrayBuffer,
  extension: string,
  onProgress?: (p: AudioExtractionProgress) => void
): Promise<{ audioBlob: Blob; duration: number }> {
  const logs: string[] = [];
  const ffmpeg = await getLoadedFFmpeg();
  const logHandler = ({ message }: { message: string }) => {
    logs.push(message);
    if (logs.length > 400) logs.shift();
  };
  ffmpeg.on('log', logHandler);

  const extensiones = [extension, 'mp4', 'mov', 'webm', 'mkv'].filter(
    (ext, i, todas) => todas.indexOf(ext) === i
  );
  let ultimoNombre = '';

  try {
    for (const ext of extensiones) {
      const inName = `audio_in.${ext}`;
      ultimoNombre = inName;
      await ffmpeg.writeFile(inName, new Uint8Array(arrayBuffer));
      onProgress?.({ percent: 30, stage: 'Extrayendo pista de audio con FFmpeg...' });

      const wavName = 'audio_16k.wav';
      // Sin -map 0:a:0: ese mapa falla en varios móviles aunque el sonido exista,
      // y el mensaje se confundía con "no hay audio".
      let code = await ffmpeg.exec([
        '-i', inName,
        '-vn',
        '-ac', '1',
        '-ar', '16000',
        '-c:a', 'pcm_s16le',
        '-f', 'wav',
        wavName,
      ]);
      if (code === 0) {
        const out = await leerSalida(ffmpeg, wavName);
        if (out) {
          const duration = (out.length - 44) / (16000 * 2);
          onProgress?.({ percent: 60, stage: 'Audio preparado para Whisper IA', detail: `Duración: ${Math.round(duration)}s` });
          return { audioBlob: new Blob([out.buffer], { type: 'audio/wav' }), duration };
        }
      }

      const m4aName = 'audio_copy.m4a';
      code = await ffmpeg.exec([
        '-i', inName,
        '-vn',
        '-c:a', 'copy',
        '-f', ext === 'webm' || ext === 'mkv' ? 'webm' : 'mp4',
        m4aName,
      ]);
      if (code === 0) {
        const out = await leerSalida(ffmpeg, m4aName);
        if (out) {
          const duration = parsearDuracionFFmpeg(logs);
          onProgress?.({ percent: 60, stage: 'Audio preparado para Whisper IA', detail: `Duración: ${Math.round(duration)}s` });
          return { audioBlob: new Blob([out.buffer], { type: ext === 'webm' ? 'audio/webm' : 'audio/mp4' }), duration };
        }
      }

      const abrio = /Input #\d+/i.test(logs.join('\n'));
      try { await ffmpeg.deleteFile(inName); } catch { /* ya no está */ }
      ultimoNombre = '';
      if (abrio) break;
    }
  } finally {
    if (ultimoNombre) {
      try { await ffmpeg.deleteFile(ultimoNombre); } catch { /* ya no está */ }
    }
    try { await ffmpeg.deleteFile('audio_16k.wav'); } catch { /* puede no existir */ }
    try { await ffmpeg.deleteFile('audio_copy.m4a'); } catch { /* puede no existir */ }
  }

  if (logsIndicanSinAudio(logs)) {
    throw new Error('El vídeo no tiene pista de audio.');
  }
  throw new Error(`FFmpeg no pudo extraer el audio: ${logs.slice(-5).join(' | ') || 'sin detalle'}`);
}

export async function extract16kHzAudio(
  source: Blob | File | ArrayBuffer,
  onProgress?: (p: AudioExtractionProgress) => void
): Promise<{ audioBlob: Blob; duration: number }> {
  // Cada vía lee su PROPIA copia de bytes: writeFile de FFmpeg transfiere el
  // buffer al worker y lo desprende, así que reutilizarlo después daría
  // 'detached ArrayBuffer'. Leer de nuevo del Blob siempre da bytes intactos.
  const leerBytes = async (): Promise<ArrayBuffer> =>
    source instanceof ArrayBuffer ? source.slice(0) : await source.arrayBuffer();

  let errorFFmpeg: unknown = null;
  const bytes = new Uint8Array(await leerBytes());
  const pista = contenedorTienePistaAudio(bytes);
  const nombre = source instanceof File ? source.name : '';

  // 1) FFmpeg WASM: fiable con cualquier contenedor de vídeo.
  try {
    onProgress?.({ percent: 15, stage: 'Extrayendo audio con FFmpeg...' });
    return await extraerConFFmpeg(bytes.buffer, extensionParaFFmpeg(bytes, nombre), onProgress);
  } catch (ffErr) {
    errorFFmpeg = ffErr;
    const mFF2 = ffErr instanceof Error ? ffErr.message : String(ffErr);
    if (/no tiene pista de audio/i.test(mFF2) && pista !== true) {
      throw new Error('El vídeo no tiene pista de audio, así que no hay nada que transcribir.');
    }
    console.warn('Extracción con FFmpeg falló; se prueba Web Audio:', ffErr);
  }

  // 2) Respaldo con Web Audio (bytes recién leídos, nunca desprendidos).
  try {
    const arrayBuffer = await leerBytes();
    onProgress?.({ percent: 25, stage: 'Decodificando flujo de audio...' });
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempAudioContext = new AudioContextClass();
    let decodedBuffer: AudioBuffer;
    try {
      decodedBuffer = await tempAudioContext.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      if (tempAudioContext.state !== 'closed') tempAudioContext.close().catch(() => {});
    }

    const duration = decodedBuffer.duration;
    onProgress?.({ percent: 45, stage: 'Remuestreando a 16kHz mono...', detail: `Duración: ${Math.round(duration)} segundos` });

    const targetSampleRate = 16000;
    const targetLength = Math.ceil(duration * targetSampleRate);
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = decodedBuffer;
    sourceNode.connect(offlineCtx.destination);
    sourceNode.start(0);
    const resampledBuffer = await offlineCtx.startRendering();

    onProgress?.({ percent: 65, stage: 'Generando archivo de audio optimizado...' });
    const wavBlob = audioBufferToWavBlob(resampledBuffer);
    onProgress?.({ percent: 75, stage: 'Audio preparado para Whisper IA', detail: `Tamaño: ${(wavBlob.size / 1048576).toFixed(2)} MB` });
    return { audioBlob: wavBlob, duration };
  } catch (err: any) {
    const mFF = errorFFmpeg instanceof Error ? errorFFmpeg.message : String(errorFFmpeg);
    console.error('Error during client audio extraction:', err);
    if (pista === true) {
      throw new Error('Hay sonido, pero no he podido separarlo en este teléfono.');
    }
    throw new Error(`Fallo al extraer el audio (FFmpeg: ${mFF} · WebAudio: ${err.message || 'no decodificable'})`);
  }
}
