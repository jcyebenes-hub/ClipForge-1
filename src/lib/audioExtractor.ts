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
export async function extract16kHzAudio(
  source: Blob | File | ArrayBuffer,
  onProgress?: (p: AudioExtractionProgress) => void
): Promise<{ audioBlob: Blob; duration: number }> {
  try {
    onProgress?.({ percent: 10, stage: 'Leyendo datos del vídeo...' });

    let arrayBuffer: ArrayBuffer;
    if (source instanceof ArrayBuffer) {
      arrayBuffer = source;
    } else {
      arrayBuffer = await source.arrayBuffer();
    }

    onProgress?.({ percent: 25, stage: 'Decodificando flujo de audio...' });

    // Decode original audio track
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempAudioContext = new AudioContextClass();
    
    let decodedBuffer: AudioBuffer;
    try {
      decodedBuffer = await tempAudioContext.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      if (tempAudioContext.state !== 'closed') {
        tempAudioContext.close().catch(() => {});
      }
    }

    const duration = decodedBuffer.duration;
    onProgress?.({ 
      percent: 45, 
      stage: 'Remuestreando a 16kHz mono...', 
      detail: `Duración: ${Math.round(duration)} segundos` 
    });

    // OfflineAudioContext at target 16,000 Hz sample rate
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

    onProgress?.({ 
      percent: 75, 
      stage: 'Audio preparado para Whisper IA',
      detail: `Tamaño: ${(wavBlob.size / (1024 * 1024)).toFixed(2)} MB`
    });

    return {
      audioBlob: wavBlob,
      duration,
    };
  } catch (err: any) {
    console.error('Error during client audio extraction:', err);
    throw new Error(`Fallo al extraer el audio: ${err.message || 'Formato de audio no decodificable'}`);
  }
}
