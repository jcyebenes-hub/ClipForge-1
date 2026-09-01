import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import { getLoadedFFmpeg, parseFFmpegTime } from './videoCutter';
import { fetchFile } from '@ffmpeg/util';

export type TipoEnfoque = 'rostro' | 'deportes' | 'centrado';
export type AspectRatioOption = '9:16' | '1:1' | '16:9';

export interface FaceDetectionSample {
  t: number; // timestamp in seconds
  x: number; // face or action bounding box origin X in pixels
  y: number; // face or action bounding box origin Y in pixels
  w: number; // width in pixels
  h: number; // height in pixels
  centerX: number; // center X in pixels
  centerY: number; // center Y in pixels
  confidence: number;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SegmentCrop {
  startSec: number;
  endSec: number;
  crop: CropRect;
  hasFace: boolean;
}

export interface VerticalCropProgress {
  clipId: string;
  percent: number;
  stage: 'cargando_modelo' | 'detectando_rostros' | 'detectando_movimiento' | 'suavizando' | 'renderizando_segmentos' | 'concatenando' | 'completado' | 'error';
  detail: string;
  currentSegment?: number;
  totalSegments?: number;
}

let visionFaceDetector: FaceDetector | null = null;

/**
 * Initializes and caches MediaPipe Vision Face Detector instance
 */
export async function getFaceDetector(): Promise<FaceDetector> {
  if (visionFaceDetector) {
    return visionFaceDetector;
  }

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  visionFaceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.4,
  });

  return visionFaceDetector;
}

/**
 * Detects faces across video timeline in a hidden HTML5 video element
 */
export async function detectarRostros(
  videoUrlOrBlob: string | Blob,
  inicioSeg: number,
  finSeg: number,
  onProgress?: (p: { percent: number; currentSec: number; totalSec: number; detail: string }) => void
): Promise<{
  samples: FaceDetectionSample[];
  videoWidth: number;
  videoHeight: number;
  duration: number;
}> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const srcUrl = typeof videoUrlOrBlob === 'string' ? videoUrlOrBlob : URL.createObjectURL(videoUrlOrBlob);
  video.src = srcUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Error al cargar metadata del vídeo para detección de rostros'));
  });

  const origWidth = video.videoWidth || 1920;
  const origHeight = video.videoHeight || 1080;
  const totalDuration = Math.max(1, finSeg - inicioSeg);

  // Hidden offscreen canvas for frame capture
  const canvas = document.createElement('canvas');
  canvas.width = origWidth;
  canvas.height = origHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  onProgress?.({
    percent: 5,
    currentSec: 0,
    totalSec: totalDuration,
    detail: 'Cargando modelo neuronal de detección facial (MediaPipe BlazeFace)...',
  });

  let detector: FaceDetector | null = null;
  try {
    detector = await getFaceDetector();
  } catch (err) {
    console.warn('GPU MediaPipe initialization failed, trying CPU fallback:', err);
    try {
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
      detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.35,
      });
    } catch (fallbackErr) {
      console.error('FaceDetector could not be loaded:', fallbackErr);
    }
  }

  const samples: FaceDetectionSample[] = [];
  
  // Dynamic frame sampling: start with 4-frame interval (~0.15s)
  // If video is long (>45s) or processing slows down, sample 1 frame every 6 frames (~0.25s)
  let stepSec = totalDuration > 45 ? 0.25 : 0.16; // ~4 to 6 frames at 25-30fps
  const startTimeMs = Date.now();

  let currentT = inicioSeg;
  let sampleIndex = 0;

  while (currentT <= finSeg) {
    // Check performance timeout constraint (if detection exceeds 3 min, speed up step)
    const elapsedSec = (Date.now() - startTimeMs) / 1000;
    if (elapsedSec > 180 && stepSec < 0.35) {
      console.warn('Detección tomando más de 3 min, reduciendo muestreo a 1 frame cada 6-8 frames.');
      stepSec = 0.35;
    }

    const seekPromise = new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
    });

    video.currentTime = Math.min(video.duration || finSeg, currentT);
    await seekPromise;

    if (ctx && detector) {
      ctx.drawImage(video, 0, 0, origWidth, origHeight);
      try {
        const detections = detector.detect(canvas);
        if (detections && detections.detections && detections.detections.length > 0) {
          // Pick the largest (main) face bounding box
          let mainFace = detections.detections[0];
          let maxArea = (mainFace.boundingBox?.width || 0) * (mainFace.boundingBox?.height || 0);

          for (let i = 1; i < detections.detections.length; i++) {
            const d = detections.detections[i];
            const area = (d.boundingBox?.width || 0) * (d.boundingBox?.height || 0);
            if (area > maxArea) {
              maxArea = area;
              mainFace = d;
            }
          }

          if (mainFace.boundingBox) {
            const bb = mainFace.boundingBox;
            const w = Math.min(origWidth, Math.max(20, bb.width));
            const h = Math.min(origHeight, Math.max(20, bb.height));
            const x = Math.max(0, Math.min(origWidth - w, bb.originX));
            const y = Math.max(0, Math.min(origHeight - h, bb.originY));

            samples.push({
              t: currentT,
              x,
              y,
              w,
              h,
              centerX: x + w / 2,
              centerY: y + h / 2,
              confidence: mainFace.categories?.[0]?.score || 0.8,
            });
          }
        }
      } catch (detErr) {
        console.warn('Frame detection error at t=', currentT, detErr);
      }
    }

    sampleIndex++;
    currentT += stepSec;

    const progressPct = Math.min(45, Math.max(5, Math.round(((currentT - inicioSeg) / totalDuration) * 40) + 5));
    onProgress?.({
      percent: progressPct,
      currentSec: Math.min(totalDuration, currentT - inicioSeg),
      totalSec: totalDuration,
      detail: `Analizando fotogramas (${samples.length} rostros detectados)...`,
    });
  }

  // Cleanup object url if created
  if (typeof videoUrlOrBlob !== 'string') {
    URL.revokeObjectURL(srcUrl);
  }

  return {
    samples,
    videoWidth: origWidth,
    videoHeight: origHeight,
    duration: totalDuration,
  };
}

/**
 * Detects motion across video timeline by computing pixel difference on an 8x6 grid
 * Ideal for sports, action sequences, or dynamic scenes without clear faces
 */
export async function detectarMovimiento(
  videoUrlOrBlob: string | Blob,
  inicioSeg: number,
  finSeg: number,
  onProgress?: (p: { percent: number; currentSec: number; totalSec: number; detail: string }) => void
): Promise<{
  samples: FaceDetectionSample[];
  videoWidth: number;
  videoHeight: number;
  duration: number;
}> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const srcUrl = typeof videoUrlOrBlob === 'string' ? videoUrlOrBlob : URL.createObjectURL(videoUrlOrBlob);
  video.src = srcUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Error al cargar metadata del vídeo para detección de movimiento'));
  });

  const origWidth = video.videoWidth || 1920;
  const origHeight = video.videoHeight || 1080;
  const totalDuration = Math.max(1, finSeg - inicioSeg);

  // Use a fast scaled grid canvas (160x120 -> 8 cols of 20px, 6 rows of 20px)
  const cols = 8;
  const rows = 6;
  const canvasW = 160;
  const canvasH = 120;
  const cellW = canvasW / cols; // 20
  const cellH = canvasH / rows; // 20

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  onProgress?.({
    percent: 5,
    currentSec: 0,
    totalSec: totalDuration,
    detail: 'Inicializando análisis de vectores de movimiento en cuadrícula 8x6 (Modo Deportes)...',
  });

  const samples: FaceDetectionSample[] = [];
  let stepSec = totalDuration > 45 ? 0.25 : 0.16; // ~4 to 6 frames
  const startTimeMs = Date.now();

  let prevImageData: Uint8ClampedArray | null = null;
  let currentT = inicioSeg;
  let lastKnownCenterX = origWidth / 2;
  let lastKnownCenterY = origHeight / 2;

  while (currentT <= finSeg) {
    const elapsedSec = (Date.now() - startTimeMs) / 1000;
    if (elapsedSec > 180 && stepSec < 0.35) {
      console.warn('Detección de movimiento > 3 min, optimizando paso temporal.');
      stepSec = 0.35;
    }

    const seekPromise = new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
    });

    video.currentTime = Math.min(video.duration || finSeg, currentT);
    await seekPromise;

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvasW, canvasH);
      const currImg = ctx.getImageData(0, 0, canvasW, canvasH);
      const currData = currImg.data;

      if (prevImageData) {
        // Calculate motion delta per 8x6 cell
        const cellDeltas = new Float32Array(cols * rows);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            let sumDiff = 0;
            let pixelCount = 0;

            const startX = Math.floor(c * cellW);
            const endX = Math.floor((c + 1) * cellW);
            const startY = Math.floor(r * cellH);
            const endY = Math.floor((r + 1) * cellH);

            for (let y = startY; y < endY; y += 2) {
              for (let x = startX; x < endX; x += 2) {
                const idx = (y * canvasW + x) * 4;
                const dr = Math.abs(currData[idx] - prevImageData[idx]);
                const dg = Math.abs(currData[idx + 1] - prevImageData[idx + 1]);
                const db = Math.abs(currData[idx + 2] - prevImageData[idx + 2]);
                sumDiff += dr + dg + db;
                pixelCount++;
              }
            }

            cellDeltas[r * cols + c] = pixelCount > 0 ? sumDiff / pixelCount : 0;
          }
        }

        // Find cell with highest motion delta
        let maxDelta = 0;
        let maxCol = Math.floor(cols / 2);
        let maxRow = Math.floor(rows / 2);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const val = cellDeltas[r * cols + c];
            if (val > maxDelta) {
              maxDelta = val;
              maxCol = c;
              maxRow = r;
            }
          }
        }

        // Noise threshold for valid motion: average delta per pixel > 8
        if (maxDelta > 8) {
          const motionCenterX = ((maxCol + 0.5) / cols) * origWidth;
          const motionCenterY = ((maxRow + 0.5) / rows) * origHeight;
          lastKnownCenterX = motionCenterX;
          lastKnownCenterY = motionCenterY;

          const approxBoxW = origWidth / cols;
          const approxBoxH = origHeight / rows;

          samples.push({
            t: currentT,
            x: Math.max(0, motionCenterX - approxBoxW / 2),
            y: Math.max(0, motionCenterY - approxBoxH / 2),
            w: approxBoxW,
            h: approxBoxH,
            centerX: motionCenterX,
            centerY: motionCenterY,
            confidence: Math.min(1, maxDelta / 100),
          });
        } else {
          // If slight/no motion, keep smooth continuity
          samples.push({
            t: currentT,
            x: Math.max(0, lastKnownCenterX - origWidth / (cols * 2)),
            y: Math.max(0, lastKnownCenterY - origHeight / (rows * 2)),
            w: origWidth / cols,
            h: origHeight / rows,
            centerX: lastKnownCenterX,
            centerY: lastKnownCenterY,
            confidence: 0.5,
          });
        }
      }

      // Clone current frame for next comparison
      prevImageData = new Uint8ClampedArray(currData);
    }

    currentT += stepSec;

    const progressPct = Math.min(45, Math.max(5, Math.round(((currentT - inicioSeg) / totalDuration) * 40) + 5));
    onProgress?.({
      percent: progressPct,
      currentSec: Math.min(totalDuration, currentT - inicioSeg),
      totalSec: totalDuration,
      detail: `Escaneando vectores de movimiento (${samples.length} puntos de acción registrados)...`,
    });
  }

  if (typeof videoUrlOrBlob !== 'string') {
    URL.revokeObjectURL(srcUrl);
  }

  return {
    samples,
    videoWidth: origWidth,
    videoHeight: origHeight,
    duration: totalDuration,
  };
}

/**
 * Applies a temporal moving average window filter (~0.5s) to smooth tracking coordinates
 */
export function suavizarTrayectoria(
  samples: FaceDetectionSample[],
  windowSec: number = 0.5,
  origWidth: number,
  origHeight: number,
  inicioSeg: number,
  finSeg: number,
  aspectRatio: AspectRatioOption = '9:16'
): { getTimeCrop: (t: number) => CropRect } {
  let targetAspect = 9 / 16;
  if (aspectRatio === '1:1') targetAspect = 1;
  else if (aspectRatio === '16:9') targetAspect = 16 / 9;

  const cropH = origHeight;
  let cropW = Math.round(cropH * targetAspect);
  if (cropW % 2 !== 0) cropW += 1;
  if (cropW > origWidth) cropW = origWidth;
  const defaultCenterX = origWidth / 2;

  if (samples.length === 0 || aspectRatio === '16:9') {
    if (aspectRatio === '16:9') {
      return {
        getTimeCrop: () => ({
          x: 0,
          y: 0,
          w: origWidth % 2 === 0 ? origWidth : origWidth - 1,
          h: origHeight % 2 === 0 ? origHeight : origHeight - 1,
        }),
      };
    }
    // Default static center crop if no face was found
    const defaultX = Math.max(0, Math.round((origWidth - cropW) / 2));
    const evenX = defaultX % 2 === 0 ? defaultX : defaultX - 1;
    return {
      getTimeCrop: () => ({
        x: Math.max(0, evenX),
        y: 0,
        w: cropW,
        h: cropH,
      }),
    };
  }

  // Pre-calculate smoothed center points
  const smoothedPoints: { t: number; smoothCenterX: number }[] = [];

  for (let i = 0; i < samples.length; i++) {
    const current = samples[i];
    let sumWeight = 0;
    let sumCenterX = 0;

    for (let j = 0; j < samples.length; j++) {
      const neighbor = samples[j];
      const dt = Math.abs(neighbor.t - current.t);
      if (dt <= windowSec) {
        // Gaussian-like weight for smooth trajectory
        const weight = Math.exp(-(dt * dt) / (2 * (windowSec / 2) * (windowSec / 2)));
        sumWeight += weight;
        sumCenterX += neighbor.centerX * weight;
      }
    }

    smoothedPoints.push({
      t: current.t,
      smoothCenterX: sumWeight > 0 ? sumCenterX / sumWeight : current.centerX,
    });
  }

  return {
    getTimeCrop: (t: number): CropRect => {
      // Find nearest smoothed point or interpolate
      if (smoothedPoints.length === 1) {
        const cx = smoothedPoints[0].smoothCenterX;
        return calcularCrop(cx, origWidth, origHeight, aspectRatio);
      }

      // Linear interpolation between closest sample points
      let before = smoothedPoints[0];
      let after = smoothedPoints[smoothedPoints.length - 1];

      for (let i = 0; i < smoothedPoints.length - 1; i++) {
        if (t >= smoothedPoints[i].t && t <= smoothedPoints[i + 1].t) {
          before = smoothedPoints[i];
          after = smoothedPoints[i + 1];
          break;
        }
      }

      const ratio = after.t === before.t ? 0 : Math.max(0, Math.min(1, (t - before.t) / (after.t - before.t)));
      const interpolatedCenterX = before.smoothCenterX + (after.smoothCenterX - before.smoothCenterX) * ratio;

      return calcularCrop(interpolatedCenterX, origWidth, origHeight, aspectRatio);
    },
  };
}

/**
 * Calculates Crop Rect centered on face X with boundaries clamp
 */
export function calcularCrop(
  faceCenterX: number,
  origWidth: number,
  origHeight: number,
  aspectRatio: AspectRatioOption | number = '9:16'
): CropRect {
  let targetAspect = 9 / 16;
  if (typeof aspectRatio === 'number') {
    targetAspect = aspectRatio;
  } else if (aspectRatio === '1:1') {
    targetAspect = 1;
  } else if (aspectRatio === '16:9') {
    targetAspect = 16 / 9;
  }

  if (aspectRatio === '16:9' || targetAspect >= (origWidth / origHeight) - 0.01) {
    let cropW = origWidth;
    let cropH = origHeight;
    if (cropW % 2 !== 0) cropW -= 1;
    if (cropH % 2 !== 0) cropH -= 1;
    return { x: 0, y: 0, w: cropW, h: cropH };
  }

  const cropH = origHeight;
  let cropW = Math.round(cropH * targetAspect);
  if (cropW % 2 !== 0) cropW += 1;
  if (cropW > origWidth) cropW = origWidth;

  // Center around face X and clamp within video bounds [0, origWidth - cropW]
  let cropX = Math.round(faceCenterX - cropW / 2);
  cropX = Math.max(0, Math.min(origWidth - cropW, cropX));
  // Ensure even coordinate for encoder
  if (cropX % 2 !== 0) cropX -= 1;
  cropX = Math.max(0, cropX);

  return {
    x: cropX,
    y: 0,
    w: cropW,
    h: cropH,
  };
}

export interface GenerarShortOptions {
  clipId: string;
  videoSource: Blob | string;
  inicioSeg: number;
  finSeg: number;
  enfoque?: TipoEnfoque;
  aspectRatio?: AspectRatioOption;
  onProgress?: (p: VerticalCropProgress) => void;
  segmentDuration?: number; // default 1.0s segments
}

/**
 * Executes Smart Framing 9:16 Short generation:
 * - 'rostro': Face detection via MediaPipe BlazeFace
 * - 'deportes': Motion tracking via 8x6 pixel difference grid
 * - 'centrado': Direct static center crop
 */
export async function generarShortVertical(options: GenerarShortOptions): Promise<{
  blob: Blob;
  previewUrl: string;
  hasFaces: boolean;
  facesCount: number;
  enfoqueUsado: TipoEnfoque;
}> {
  const { clipId, videoSource, inicioSeg, finSeg, enfoque = 'rostro', aspectRatio = '9:16', onProgress, segmentDuration = 1.0 } = options;
  const totalDuration = Math.max(1, finSeg - inicioSeg);

  let targetW = 1080;
  let targetH = 1920;
  if (aspectRatio === '1:1') {
    targetW = 1080;
    targetH = 1080;
  } else if (aspectRatio === '16:9') {
    targetW = 1920;
    targetH = 1080;
  }

  let samples: FaceDetectionSample[] = [];
  let videoWidth = 1920;
  let videoHeight = 1080;
  let hasTrackingPoints = false;

  if (aspectRatio === '16:9') {
    onProgress?.({
      clipId,
      percent: 20,
      stage: 'suavizando',
      detail: 'Modo 16:9 (YouTube horizontal): manteniendo encuadre original completo...',
    });
  } else if (enfoque === 'centrado') {
    onProgress?.({
      clipId,
      percent: 20,
      stage: 'suavizando',
      detail: `Modo Centrado: aplicando recorte ${aspectRatio} estático centrado...`,
    });
  } else if (enfoque === 'deportes') {
    onProgress?.({
      clipId,
      percent: 5,
      stage: 'detectando_movimiento',
      detail: 'Modo Deportes: iniciando análisis de movimiento en cuadrícula 8x6...',
    });

    const motionResult = await detectarMovimiento(
      videoSource,
      inicioSeg,
      finSeg,
      (p) => {
        onProgress?.({
          clipId,
          percent: p.percent,
          stage: 'detectando_movimiento',
          detail: p.detail,
        });
      }
    );

    samples = motionResult.samples;
    videoWidth = motionResult.videoWidth;
    videoHeight = motionResult.videoHeight;
    hasTrackingPoints = samples.length > 0;

    onProgress?.({
      clipId,
      percent: 45,
      stage: 'suavizando',
      detail: `Modo Deportes: suavizando trayectoria de movimiento (${samples.length} puntos de acción registrados)...`,
    });
  } else {
    // Default 'rostro'
    onProgress?.({
      clipId,
      percent: 5,
      stage: 'detectando_rostros',
      detail: 'Iniciando escaneo inteligente de rostros (MediaPipe)...',
    });

    const detectionResult = await detectarRostros(
      videoSource,
      inicioSeg,
      finSeg,
      (p) => {
        onProgress?.({
          clipId,
          percent: p.percent,
          stage: 'detectando_rostros',
          detail: p.detail,
        });
      }
    );

    samples = detectionResult.samples;
    videoWidth = detectionResult.videoWidth;
    videoHeight = detectionResult.videoHeight;
    hasTrackingPoints = samples.length > 0;

    onProgress?.({
      clipId,
      percent: 45,
      stage: 'suavizando',
      detail: hasTrackingPoints
        ? `Optimizando encuadre facial (${samples.length} detecciones, suavizado temporal 0.5s)...`
        : `No se detectaron rostros: aplicando encuadre centrado ${aspectRatio}...`,
    });
  }

  // Trajectory smoothing (used for 'rostro' and 'deportes')
  const trajectory = suavizarTrayectoria(samples, 0.5, videoWidth, videoHeight, inicioSeg, finSeg, aspectRatio);

  // Divide into 1.0s segments
  const segmentCrops: SegmentCrop[] = [];
  let segStart = inicioSeg;

  while (segStart < finSeg) {
    const segEnd = Math.min(finSeg, segStart + segmentDuration);
    const midPoint = (segStart + segEnd) / 2;
    const crop = trajectory.getTimeCrop(midPoint);

    segmentCrops.push({
      startSec: segStart,
      endSec: segEnd,
      crop,
      hasFace: hasTrackingPoints,
    });

    segStart += segmentDuration;
  }

  // FFmpeg WASM
  onProgress?.({
    clipId,
    percent: 50,
    stage: 'renderizando_segmentos',
    detail: `Inicializando motor FFmpeg para corte ${aspectRatio} y escalado a ${targetW}x${targetH}...`,
    currentSegment: 0,
    totalSegments: segmentCrops.length,
  });

  const ffmpeg = await getLoadedFFmpeg();

  // Load input video file to virtual filesystem
  let inputBytes: Uint8Array;
  if (videoSource instanceof Blob) {
    inputBytes = new Uint8Array(await videoSource.arrayBuffer());
  } else {
    inputBytes = await fetchFile(videoSource);
  }

  const masterInputName = `src_${clipId}.mp4`;
  await ffmpeg.writeFile(masterInputName, inputBytes);

  // If 16:9 mode, centered mode, or no tracking points detected, or only 1 segment: render directly in a single fast pass
  if (aspectRatio === '16:9' || enfoque === 'centrado' || !hasTrackingPoints || segmentCrops.length <= 1) {
    const singleCrop = segmentCrops[0]?.crop || calcularCrop(videoWidth / 2, videoWidth, videoHeight, aspectRatio);
    const outName = `vertical_${clipId}.mp4`;

    onProgress?.({
      clipId,
      percent: 65,
      stage: 'renderizando_segmentos',
      detail: `Renderizando ${aspectRatio} (${singleCrop.w}x${singleCrop.h} -> ${targetW}x${targetH})...`,
      currentSegment: 1,
      totalSegments: 1,
    });

    await ffmpeg.exec([
      '-ss', inicioSeg.toString(),
      '-i', masterInputName,
      '-t', totalDuration.toString(),
      '-vf', `crop=${singleCrop.w}:${singleCrop.h}:${singleCrop.x}:${singleCrop.y},scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outName,
    ]);

    const outData = (await ffmpeg.readFile(outName)) as Uint8Array;
    const blob = new Blob([outData.buffer], { type: 'video/mp4' });
    const previewUrl = URL.createObjectURL(blob);

    try {
      await ffmpeg.deleteFile(masterInputName);
      await ffmpeg.deleteFile(outName);
    } catch {}

    onProgress?.({
      clipId,
      percent: 100,
      stage: 'completado',
      detail: `¡Short ${aspectRatio} renderizado con éxito!`,
    });

    return {
      blob,
      previewUrl,
      hasFaces: false,
      facesCount: 0,
      enfoqueUsado: enfoque,
    };
  }

  // Multi-segment rendering with dynamic smart-crop per segment
  const segmentFiles: string[] = [];

  for (let i = 0; i < segmentCrops.length; i++) {
    const seg = segmentCrops[i];
    const segDuration = seg.endSec - seg.startSec;
    const segFileName = `seg_${clipId}_${i}.mp4`;

    const segPercent = 50 + Math.round(((i + 1) / segmentCrops.length) * 40);
    onProgress?.({
      clipId,
      percent: Math.min(92, segPercent),
      stage: 'renderizando_segmentos',
      detail: `Renderizando segmento ${i + 1} de ${segmentCrops.length} (Encuadre X=${seg.crop.x}px)...`,
      currentSegment: i + 1,
      totalSegments: segmentCrops.length,
    });

    await ffmpeg.exec([
      '-ss', seg.startSec.toString(),
      '-i', masterInputName,
      '-t', segDuration.toString(),
      '-vf', `crop=${seg.crop.w}:${seg.crop.h}:${seg.crop.x}:${seg.crop.y},scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      segFileName,
    ]);

    segmentFiles.push(segFileName);
  }

  // Concat all segments with concat demuxer
  onProgress?.({
    clipId,
    percent: 94,
    stage: 'concatenando',
    detail: `Uniendo segmentos con demuxer FFmpeg en archivo final ${aspectRatio}...`,
    currentSegment: segmentCrops.length,
    totalSegments: segmentCrops.length,
  });

  const concatListContent = segmentFiles.map((f) => `file '${f}'`).join('\n');
  const concatListName = `concat_${clipId}.txt`;
  const finalOutputName = `vertical_${clipId}.mp4`;

  await ffmpeg.writeFile(concatListName, new TextEncoder().encode(concatListContent));

  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListName,
    '-c', 'copy',
    '-movflags', '+faststart',
    finalOutputName,
  ]);

  const finalData = (await ffmpeg.readFile(finalOutputName)) as Uint8Array;
  const finalBlob = new Blob([finalData.buffer], { type: 'video/mp4' });
  const previewUrl = URL.createObjectURL(finalBlob);

  // Cleanup temporary segment files
  try {
    await ffmpeg.deleteFile(masterInputName);
    await ffmpeg.deleteFile(concatListName);
    await ffmpeg.deleteFile(finalOutputName);
    for (const segFile of segmentFiles) {
      await ffmpeg.deleteFile(segFile);
    }
  } catch {}

  onProgress?.({
    clipId,
    percent: 100,
    stage: 'completado',
    detail: `¡Short ${aspectRatio} completado (${enfoque === 'deportes' ? 'Modo Deportes' : 'Seguimiento Facial'})!`,
  });

  return {
    blob: finalBlob,
    previewUrl,
    hasFaces: hasTrackingPoints,
    facesCount: samples.length,
    enfoqueUsado: enfoque,
  };
}
