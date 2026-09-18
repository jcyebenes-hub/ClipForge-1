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

async function extraerConFFmpeg(
  arrayBuffer: ArrayBuffer,
  onProgress?: (p: AudioExtractionProgress) => void
): Promise<{ audioBlob: Blob; duration: number }> {
  const logs: string[] = [];
  // getLoadedFFmpeg solo engancha onLog en la PRIMERA carga; si la instancia ya
  // existe (p. ej. la cargó el recorte vertical) lo ignora. Enganchamos nuestro
  // propio listener SIEMPRE para tener el diagnóstico real.
  const ffmpeg = await getLoadedFFmpeg();
  const logHandler = ({ message }: { message: string }) => {
    logs.push(message);
    if (logs.length > 300) logs.shift();
  };
  ffmpeg.on('log', logHandler);
  const inName = 'audio_in_video.mp4';

  await ffmpeg.writeFile(inName, new Uint8Array(arrayBuffer));
  onProgress?.({ percent: 30, stage: 'Extrayendo pista de audio con FFmpeg...' });

  // A) Recodificar a WAV 16k mono: lo ideal para Whisper y da la duración exacta.
  const wavName = 'audio_16k.wav';
  let code = await ffmpeg.exec([
    '-i', inName,
    '-map', '0:a:0',
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    '-f', 'wav',
    wavName,
  ]);
  if (code === 0) {
    const out = (await ffmpeg.readFile(wavName)) as Uint8Array;
    if (out.length > 44) {
      const duration = (out.length - 44) / (16000 * 2);
      try { await ffmpeg.deleteFile(inName); await ffmpeg.deleteFile(wavName); } catch {}
      onProgress?.({ percent: 60, stage: 'Audio preparado para Whisper IA', detail: `Duración: ${Math.round(duration)}s` });
      return { audioBlob: new Blob([out.buffer], { type: 'audio/wav' }), duration };
    }
  }

  // B) Si el códec de audio no se puede recodificar aquí (build WASM sin ese
  //    decodificador), COPIAR la pista tal cual. No necesita decodificador y
  //    Whisper la decodifica en su servidor. Mismo truco que usa el corte.
  const m4aName = 'audio_copy.m4a';
  code = await ffmpeg.exec([
    '-i', inName,
    '-map', '0:a:0',
    '-vn',
    '-c:a', 'copy',
    '-f', 'mp4',
    m4aName,
  ]);
  if (code === 0) {
    const out = (await ffmpeg.readFile(m4aName)) as Uint8Array;
    if (out.length > 0) {
      const duration = parsearDuracionFFmpeg(logs);
      try { await ffmpeg.deleteFile(inName); await ffmpeg.deleteFile(m4aName); } catch {}
      onProgress?.({ percent: 60, stage: 'Audio preparado para Whisper IA', detail: `Duración: ${Math.round(duration)}s` });
      return { audioBlob: new Blob([out.buffer], { type: 'audio/mp4' }), duration };
    }
  }

  try { await ffmpeg.deleteFile(inName); } catch {}
  throw new Error(`FFmpeg no pudo extraer el audio: ${logs.slice(-5).join(' | ')}`);
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

  // 1) FFmpeg WASM: fiable con cualquier contenedor de vídeo.
  try {
    onProgress?.({ percent: 15, stage: 'Extrayendo audio con FFmpeg...' });
    return await extraerConFFmpeg(await leerBytes(), onProgress);
  } catch (ffErr) {
    errorFFmpeg = ffErr;
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
    throw new Error(`Fallo al extraer el audio (FFmpeg: ${mFF} · WebAudio: ${err.message || 'no decodificable'})`);
  }
}
