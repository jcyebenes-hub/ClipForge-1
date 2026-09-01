import { getLoadedFFmpeg, parseFFmpegTime } from './videoCutter';
import { fetchFile } from '@ffmpeg/util';

export type ModoBRoll = 'automatico' | 'subir_archivo' | 'preset';

export interface BRollPreset {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  tipoColor: string;
}

export const PRESETS_BROLL: BRollPreset[] = [
  {
    id: 'subway_surfers',
    nombre: 'Subway Runner',
    descripcion: 'Carrera arcade 3D estilo Subway Surfers con trenes y monedas',
    icono: '🏃💨',
    tipoColor: '#f59e0b',
  },
  {
    id: 'minecraft_parkour',
    nombre: 'Minecraft Parkour',
    descripcion: 'Saltos de bloques cúbicos en primera persona con lava y niebla',
    icono: '🧱⛏️',
    tipoColor: '#10b981',
  },
  {
    id: 'gta_stunts',
    nombre: 'GTA V Mega Rampa',
    descripcion: 'Coche deportivo a alta velocidad cayendo por rampas celestes',
    icono: '🏎️💥',
    tipoColor: '#ec4899',
  },
  {
    id: 'satisfying_slime',
    nombre: 'Satisfying Kinetic Sand',
    descripcion: 'Corte relajante de arena cinética y jabones ASMR de alta retención',
    icono: '🧼✨',
    tipoColor: '#8b5cf6',
  },
];

export interface BRollConfig {
  activo: boolean;
  modo: ModoBRoll;
  customFile?: File | Blob | null;
  customUrl?: string | null;
  presetId?: string;
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

/**
 * Creates an animated video blob for gameplay presets using an offscreen canvas recording
 */
export async function generarPresetBRollBlob(
  presetId: string,
  durationSec: number = 10,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  onProgress?.('Generando metraje cinemático de gameplay con canvas 60fps...');

  return new Promise((resolve) => {
    const width = 480;
    const height = 270;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      resolve(new Blob([], { type: 'video/mp4' }));
      return;
    }

    const fps = 30;
    const totalFrames = Math.round(durationSec * fps);
    const stream = canvas.captureStream(fps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });

    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      resolve(webmBlob);
    };

    mediaRecorder.start();

    let frame = 0;
    const renderFrame = () => {
      if (frame >= totalFrames) {
        mediaRecorder.stop();
        return;
      }

      const t = frame / fps;
      ctx.clearRect(0, 0, width, height);

      // Render preset specific animation
      if (presetId === 'subway_surfers') {
        // Subway Surfers style track and runner
        // Sky
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(0.4, '#38bdf8');
        grad.addColorStop(0.4, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Perspective 3D Track lines
        const horizonY = height * 0.4;
        const centerX = width / 2;

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        // Rails
        ctx.beginPath();
        ctx.moveTo(centerX - 10, horizonY);
        ctx.lineTo(width * 0.1, height);
        ctx.moveTo(centerX + 10, horizonY);
        ctx.lineTo(width * 0.9, height);
        ctx.moveTo(centerX, horizonY);
        ctx.lineTo(centerX, height);
        ctx.stroke();

        // Moving ties
        const tieOffset = (t * 8) % 1;
        for (let i = 0; i < 8; i++) {
          const depth = (i + tieOffset) / 8;
          const y = horizonY + depth * (height - horizonY);
          const w = (width * 0.8) * depth;
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 3 * depth;
          ctx.beginPath();
          ctx.moveTo(centerX - w / 2, y);
          ctx.lineTo(centerX + w / 2, y);
          ctx.stroke();
        }

        // Trains moving
        const trainZ = (t * 1.5) % 3;
        if (trainZ > 0.5) {
          const trainY = horizonY + (trainZ / 3) * (height - horizonY);
          const trainW = 80 * (trainZ / 3);
          const trainH = 60 * (trainZ / 3);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(centerX - 90 * (trainZ / 3), trainY - trainH, trainW, trainH);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(centerX - 80 * (trainZ / 3), trainY - trainH + 5, 10, 10);
        }

        // Runner Character (Back view)
        const runnerY = height - 50 + Math.sin(t * 15) * 4;
        const runnerX = centerX + Math.sin(t * 2) * 30;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(runnerX, height - 20, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body / hoodie
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(runnerX - 12, runnerY - 20, 24, 28);
        // Head / Cap
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(runnerX, runnerY - 28, 10, 0, Math.PI * 2);
        ctx.fill();

        // HUD overlay
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(10, 10, 120, 24);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`🪙 ${Math.floor(t * 142)}  x4.0`, 16, 26);
      } else if (presetId === 'minecraft_parkour') {
        // Minecraft Parkour style 3D cubes
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        // Lava river bottom
        const lavaGrad = ctx.createLinearGradient(0, height * 0.7, 0, height);
        lavaGrad.addColorStop(0, '#ea580c');
        lavaGrad.addColorStop(1, '#b91c1c');
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(0, height * 0.7, width, height * 0.3);

        // Jumping camera bounce
        const camBounce = Math.abs(Math.sin(t * 8)) * 18;
        const forward = (t * 3) % 4;

        // Blocks
        for (let b = 0; b < 5; b++) {
          const bZ = (b - forward + 4) % 4;
          if (bZ < 0.2) continue;
          const bX = width / 2 + Math.sin(b * 3) * 60;
          const bY = height * 0.6 + camBounce + (bZ * 20);
          const bSize = 60 * (1 / bZ);

          // Top face (Grass)
          ctx.fillStyle = '#15803d';
          ctx.fillRect(bX - bSize / 2, bY - bSize / 2, bSize, bSize * 0.3);
          // Side face (Dirt)
          ctx.fillStyle = '#78350f';
          ctx.fillRect(bX - bSize / 2, bY - bSize * 0.2, bSize, bSize * 0.7);
        }

        // Diamond Sword in bottom right hand
        const swordX = width - 70 + Math.sin(t * 8) * 8;
        const swordY = height - 40 - camBounce;
        ctx.fillStyle = '#38bdf8';
        ctx.save();
        ctx.translate(swordX, swordY);
        ctx.rotate(-Math.PI / 4);
        ctx.fillRect(0, 0, 14, 55);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-6, 38, 26, 8);
        ctx.restore();

        // Hearts HUD
        for (let h = 0; h < 8; h++) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(15 + h * 12, height - 18, 9, 9);
        }
      } else if (presetId === 'gta_stunts') {
        // Neon Sky Stunt Mega Ramp
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#312e81');
        skyGrad.addColorStop(0.5, '#4c1d95');
        skyGrad.addColorStop(1, '#831843');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Neon Grid Ramp
        const rampY = height * 0.5;
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.quadraticCurveTo(width / 2, rampY + 50, width, rampY - 20);
        ctx.stroke();

        // Sports Car
        const carX = width * 0.45 + Math.sin(t * 4) * 20;
        const carY = rampY + 10 + Math.sin(t * 12) * 3;
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(carX - 25, carY - 14, 50, 18);
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(carX - 15, carY - 22, 30, 10);
        // Headlights
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(carX + 22, carY - 8, 4, 8);

        // Speedometer
        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`⚡ ${(180 + Math.sin(t * 10) * 40).toFixed(0)} KM/H`, 15, 25);
      } else {
        // Satisfying Sand / ASMR cutting
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        // Gradient kinetic sand layers
        const sandHue = (t * 40) % 360;
        ctx.fillStyle = `hsl(${sandHue}, 80%, 60%)`;
        ctx.fillRect(width * 0.2, height * 0.3, width * 0.6, height * 0.5);

        // Knife cutting
        const knifeY = height * 0.2 + ((t * 2) % 1) * (height * 0.6);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(width * 0.15, knifeY, width * 0.7, 4);

        // Particles
        for (let p = 0; p < 12; p++) {
          ctx.fillStyle = `hsl(${(sandHue + p * 20) % 360}, 90%, 70%)`;
          const px = width * 0.2 + Math.random() * (width * 0.6);
          const py = knifeY + Math.random() * 20;
          ctx.fillRect(px, py, 4, 4);
        }

        ctx.fillStyle = '#a855f7';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('✨ SATISFYING ASMR', 15, 25);
      }

      frame++;
      setTimeout(renderFrame, 1000 / fps);
    };

    renderFrame();
  });
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
