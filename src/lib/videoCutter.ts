import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface CutProgressCallback {
  (progress: {
    clipId: string;
    percent: number;
    stage: 'cargando_ffmpeg' | 'descargando_video' | 'cortando' | 'subiendo' | 'completado' | 'error';
    detail: string;
    timeSec?: number;
    totalSec?: number;
  }): void;
}

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;

/**
 * Initializes and loads FFmpeg WASM instance.
 * Attempts multithreaded core if SharedArrayBuffer is available, otherwise falls back gracefully to standard core.
 */
export async function getLoadedFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  ffmpegInstance = new FFmpeg();

  if (onLog) {
    ffmpegInstance.on('log', ({ message }) => {
      onLog(message);
    });
  }

  // Check if multithread (SharedArrayBuffer) is supported and crossOriginIsolated
  const canUseMultithread = typeof window !== 'undefined' && 
    typeof SharedArrayBuffer !== 'undefined' && 
    (window.crossOriginIsolated || false);

  if (canUseMultithread) {
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
      isLoaded = true;
      return ffmpegInstance;
    } catch (mtErr) {
      console.warn('Multithreaded FFmpeg load failed, falling back to single thread:', mtErr);
    }
  }

  // Single-thread fallback (works universally in all standard browser environments)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  isLoaded = true;
  return ffmpegInstance;
}

/**
 * Helper to parse time in seconds from ffmpeg log (e.g. "time=00:00:14.25")
 */
export function parseFFmpegTime(logMsg: string): number | null {
  const match = logMsg.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
  if (match) {
    const hours = parseFloat(match[1]);
    const minutes = parseFloat(match[2]);
    const seconds = parseFloat(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return null;
}

export interface CutClipOptions {
  clipId: string;
  inicioSeg: number;
  finSeg: number;
  videoSource: Blob | string; // Blob or URL
  onProgress?: CutProgressCallback;
  useFastCopy?: boolean; // Try stream copy first
}

/**
 * Cuts a video segment using FFmpeg WASM.
 * Returns the cut MP4 Blob and an Object URL for immediate preview.
 */
export async function cutVideoSegment(options: CutClipOptions): Promise<{ blob: Blob; previewUrl: string }> {
  const { clipId, inicioSeg, finSeg, videoSource, onProgress, useFastCopy = false } = options;
  const duracion = Math.max(1, finSeg - inicioSeg);

  onProgress?.({
    clipId,
    percent: 5,
    stage: 'cargando_ffmpeg',
    detail: 'Inicializando motor FFmpeg WASM...',
    totalSec: duracion,
  });

  // Track progress from logs
  let lastReportedPercent = 10;
  const handleLog = (msg: string) => {
    const currentTime = parseFFmpegTime(msg);
    if (currentTime !== null && duracion > 0) {
      const calculatedPct = Math.min(95, Math.max(10, Math.round((currentTime / duracion) * 85) + 10));
      if (calculatedPct > lastReportedPercent) {
        lastReportedPercent = calculatedPct;
        onProgress?.({
          clipId,
          percent: calculatedPct,
          stage: 'cortando',
          detail: `Renderizando fotogramas... (${currentTime.toFixed(1)}s / ${duracion.toFixed(1)}s)`,
          timeSec: currentTime,
          totalSec: duracion,
        });
      }
    }
  };

  const ffmpeg = await getLoadedFFmpeg(handleLog);

  // Set ffmpeg progress event
  ffmpeg.on('progress', ({ progress, time }) => {
    if (typeof progress === 'number' && progress > 0) {
      const pct = Math.min(95, Math.max(10, Math.round(progress * 100)));
      if (pct > lastReportedPercent) {
        lastReportedPercent = pct;
        onProgress?.({
          clipId,
          percent: pct,
          stage: 'cortando',
          detail: `Procesando clip con FFmpeg (${pct}%)...`,
          totalSec: duracion,
        });
      }
    }
  });

  onProgress?.({
    clipId,
    percent: 15,
    stage: 'descargando_video',
    detail: 'Cargando fotogramas de origen en memoria virtual...',
    totalSec: duracion,
  });

  // Fetch or prepare input video data
  let inputData: Uint8Array;
  if (videoSource instanceof Blob) {
    const arrayBuffer = await videoSource.arrayBuffer();
    inputData = new Uint8Array(arrayBuffer);
  } else {
    inputData = await fetchFile(videoSource);
  }

  const inputName = `input_${clipId}.mp4`;
  const outputName = `clip_${clipId}.mp4`;

  await ffmpeg.writeFile(inputName, inputData);

  onProgress?.({
    clipId,
    percent: 25,
    stage: 'cortando',
    detail: `Cortando desde ${inicioSeg.toFixed(1)}s hasta ${finSeg.toFixed(1)}s (${duracion.toFixed(1)}s)...`,
    timeSec: 0,
    totalSec: duracion,
  });

  // Command execution
  let cutSuccess = false;

  // Try stream copy if requested
  if (useFastCopy) {
    try {
      await ffmpeg.exec([
        '-ss', inicioSeg.toString(),
        '-i', inputName,
        '-t', duracion.toString(),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',
        outputName,
      ]);
      cutSuccess = true;
    } catch {
      console.warn('Fast copy failed or unaligned keyframes, falling back to full h264 encode.');
    }
  }

  // Standard re-encode
  if (!cutSuccess) {
    await ffmpeg.exec([
      '-ss', inicioSeg.toString(),
      '-i', inputName,
      '-t', duracion.toString(),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputName,
    ]);
  }

  onProgress?.({
    clipId,
    percent: 95,
    stage: 'completado',
    detail: 'Generando archivo MP4 final...',
    totalSec: duracion,
  });

  // Read output file
  const outputData = (await ffmpeg.readFile(outputName)) as Uint8Array;
  const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
  const previewUrl = URL.createObjectURL(outputBlob);

  // Clean up virtual files
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch {}

  onProgress?.({
    clipId,
    percent: 100,
    stage: 'completado',
    detail: '¡Clip recortado con éxito!',
    totalSec: duracion,
  });

  return {
    blob: outputBlob,
    previewUrl,
  };
}
