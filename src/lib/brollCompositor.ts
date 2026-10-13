import { getLoadedFFmpeg, parseFFmpegTime } from './videoCutter';
import { fetchFile } from '@ffmpeg/util';

export type ModoBRoll = 'automatico' | 'subir_archivo';

export interface BRollConfig {
  activo: boolean;
  modo: ModoBRoll;
  customFile?: File | Blob | null;
  customUrl?: string | null;
  autoStartSec?: number;
  autoEndSec?: number;
  autoDuracionSec?: number;
}

/**
 * Calculates a non-overlapping random 10-20s segment from the original master video.
 * If the current clip is [inicioClip, finClip] (e.g. [300, 360]),
 * it chooses another interval [start, end] outside of that range.
 */
export function calcularTramoAutomaticoBroll(
  totalVideoDuration: number,
  inicioClip: number,
  finClip: number,
  duracionDeseada: number = 15
): { startSec: number; endSec: number; duracion: number; descripcionTramo: string } {
  const duration = Math.max(10, Math.min(25, duracionDeseada));
  const safeTotal = Math.max(totalVideoDuration, 60);

  // Define available non-overlapping zones
  // Zone A: [0, inicioClip - 2]
  // Zone B: [finClip + 2, totalVideoDuration]
  const bufferSec = 2;
  const zoneABounds = { start: 0, end: Math.max(0, inicioClip - bufferSec) };
  const zoneBBounds = { start: Math.min(safeTotal, finClip + bufferSec), end: safeTotal };

  const zoneADuration = Math.max(0, zoneABounds.end - zoneABounds.start);
  const zoneBDuration = Math.max(0, zoneBBounds.end - zoneBBounds.start);

  let chosenStart = 0;

  if (zoneADuration >= duration && zoneBDuration >= duration) {
    // Pick randomly between Zone A or Zone B
    if (Math.random() > 0.5) {
      const maxOffset = zoneADuration - duration;
      chosenStart = zoneABounds.start + Math.random() * maxOffset;
    } else {
      const maxOffset = zoneBDuration - duration;
      chosenStart = zoneBBounds.start + Math.random() * maxOffset;
    }
  } else if (zoneBDuration >= duration) {
    const maxOffset = zoneBDuration - duration;
    chosenStart = zoneBBounds.start + Math.random() * maxOffset;
  } else if (zoneADuration >= duration) {
    const maxOffset = zoneADuration - duration;
    chosenStart = zoneABounds.start + Math.random() * maxOffset;
  } else {
    // If video is short, pick from start or offset
    chosenStart = (inicioClip > 20) ? 0 : Math.min(safeTotal - duration, finClip + 1);
  }

  chosenStart = Math.max(0, parseFloat(chosenStart.toFixed(1)));
  const chosenEnd = Math.min(safeTotal, parseFloat((chosenStart + duration).toFixed(1)));
  const finalDuration = parseFloat((chosenEnd - chosenStart).toFixed(1));

  const formatMinSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return {
    startSec: chosenStart,
    endSec: chosenEnd,
    duracion: finalDuration,
    descripcionTramo: `Minuto ${formatMinSec(chosenStart)} - ${formatMinSec(chosenEnd)} (${finalDuration}s sin solapar)`,
  };
}

export interface ComponerBRollOptions {
  clipId: string;
  verticalVideoBlob: Blob; // The 1080x1920 or vertical source
  brollVideoBlob: Blob;    // The gameplay or broll video
  clipDurationSec: number;
  onProgress?: (progress: {
    percent: number;
    stage: 'cargando_ffmpeg' | 'preparando_archivos' | 'componiendo_broll' | 'completado' | 'error';
    detail: string;
  }) => void;
}

/**
 * Composes a vertical 1080x1920 video with a 480x270 16:9 gameplay b-roll segment at the bottom.
 *
 * Layout details:
 * - Vertical main clip is cropped to 1080x1650 (top part)
 * - B-Roll video is scaled to 480x270, and padded to 1080x270 with centered 300px X-offset.
 * - Both are stacked vertically: 1650 + 270 = 1920 height (1080x1920 total).
 * - Original audio from vertical video is preserved with `-map 0:a`.
 *
 * FFmpeg filter string:
 * `[0:v]crop=1080:1650:0:0[main];[1:v]scale=480:270,pad=1080:270:300:0[broll];[main][broll]vstack[v]`
 */
export async function componerClipConBRoll(
  options: ComponerBRollOptions
): Promise<{ blob: Blob; previewUrl: string }> {
  const { clipId, verticalVideoBlob, brollVideoBlob, clipDurationSec, onProgress } = options;
  const duracion = Math.max(1, clipDurationSec);

  onProgress?.({
    percent: 10,
    stage: 'cargando_ffmpeg',
    detail: 'Cargando motor de composición FFmpeg...',
  });

  const ffmpeg = await getLoadedFFmpeg((logMsg) => {
    const timeSec = parseFFmpegTime(logMsg);
    if (timeSec !== null && duracion > 0) {
      const pct = Math.min(95, Math.max(20, Math.round(20 + (timeSec / duracion) * 70)));
      onProgress?.({
        percent: pct,
        stage: 'componiendo_broll',
        detail: `Componiendo pantalla dividida con gameplay (${timeSec.toFixed(1)}s / ${duracion.toFixed(1)}s)...`,
      });
    }
  });

  onProgress?.({
    percent: 25,
    stage: 'preparando_archivos',
    detail: 'Transfiriendo metraje principal y gameplay a memoria virtual...',
  });

  const mainInputName = `vertical_${clipId}.mp4`;
  const brollInputName = `broll_${clipId}.mp4`;
  const outputName = `short_broll_${clipId}.mp4`;

  const mainBytes = await fetchFile(verticalVideoBlob);
  const brollBytes = await fetchFile(brollVideoBlob);

  await ffmpeg.writeFile(mainInputName, mainBytes);
  await ffmpeg.writeFile(brollInputName, brollBytes);

  onProgress?.({
    percent: 40,
    stage: 'componiendo_broll',
    detail: 'Ejecutando filtro complejo: recorte 1080x1650 + escalado 480x270 + vstack...',
  });

  // Filter complex command:
  // -stream_loop -1 loops the b-roll seamlessly if it is shorter than the main clip
  const filterString = '[0:v]crop=1080:1650:0:0[main];[1:v]scale=480:270,pad=1080:270:300:0[broll];[main][broll]vstack[v]';

  const exitCode = await ffmpeg.exec([
    '-i', mainInputName,
    '-stream_loop', '-1',
    '-i', brollInputName,
    '-t', duracion.toString(),
    '-filter_complex', filterString,
    '-map', '[v]',
    '-map', '0:a?', // Optional audio fallback if main has audio
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputName,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Error en FFmpeg al componer gameplay (código de salida ${exitCode})`);
  }

  onProgress?.({
    percent: 95,
    stage: 'completado',
    detail: 'Extrayendo vídeo final compuesto...',
  });

  const outputData = (await ffmpeg.readFile(outputName)) as Uint8Array;
  const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
  const previewUrl = URL.createObjectURL(outputBlob);

  // Clean up virtual files
  try {
    await ffmpeg.deleteFile(mainInputName);
    await ffmpeg.deleteFile(brollInputName);
    await ffmpeg.deleteFile(outputName);
  } catch {}

  onProgress?.({
    percent: 100,
    stage: 'completado',
    detail: '¡Gameplay integrado con éxito!',
  });

  return {
    blob: outputBlob,
    previewUrl,
  };
}
