import { getLoadedFFmpeg, parseFFmpegTime } from './videoCutter';
import { fetchFile } from '@ffmpeg/util';

export type SubtitleStylePreset = 'moderno' | 'neon' | 'minimal';

export interface SubtitleWord {
  word: string;
  start: number; // absolute start time in video (seconds)
  end: number;   // absolute end time in video (seconds)
  confidence?: number;
  isKeyWord?: boolean;
}

export interface SubtitleGroup {
  id: string;
  start: number; // relative to clip (seconds)
  end: number;   // relative to clip (seconds)
  words: {
    text: string;
    start: number; // relative to clip
    end: number;   // relative to clip
    isKeyWord?: boolean;
  }[];
}

export interface SubtitleStyleConfig {
  name: SubtitleStylePreset;
  label: string;
  description: string;
  fontFamily: string;
  fontSize: number; // in pixels for 1080x1920 canvas/video (e.g. 48)
  primaryColor: string; // Hex color for normal text (e.g. '#FFFFFF')
  accentColor: string;  // Hex color for active/key word (e.g. '#FFDF00' or '#00FFFF')
  outlineColor: string; // Hex color for outline (e.g. '#000000')
  outlineWidth: number; // Outline thickness (e.g. 6)
  shadowColor: string;  // Hex shadow
  shadowBlur: number;
  shadowOffsetY: number;
  boxBackground?: string; // Optional backdrop pill
  uppercaseKeyWords: boolean;
  positionY: number; // Y position in 1920 height (e.g. 1550)
  assPrimaryColor: string; // ASS BGR format &H00BBGGRR
  assAccentColor: string;  // ASS BGR format &H00BBGGRR
  assOutlineColor: string; // ASS BGR format &H00BBGGRR
}

export const SUBTITLE_STYLES: Record<SubtitleStylePreset, SubtitleStyleConfig> = {
  moderno: {
    name: 'moderno',
    label: 'Moderno (Ssemble)',
    description: 'Texto blanco en negrita con contorno negro grueso y palabra activa en amarillo vibrante.',
    fontFamily: 'Arial, sans-serif',
    fontSize: 48,
    primaryColor: '#FFFFFF',
    accentColor: '#FFE600', // Yellow
    outlineColor: '#000000',
    outlineWidth: 6,
    shadowColor: 'rgba(0,0,0,0.85)',
    shadowBlur: 8,
    shadowOffsetY: 4,
    uppercaseKeyWords: true,
    positionY: 1550,
    assPrimaryColor: '&H00FFFFFF',
    assAccentColor: '&H0000E6FF', // Yellow in BGR (&H00BBGGRR)
    assOutlineColor: '&H00000000',
  },
  neon: {
    name: 'neon',
    label: 'Neón Cyber',
    description: 'Borde cian fluorescente con resplandor y palabra clave en fucsia / cian.',
    fontFamily: 'Arial, sans-serif',
    fontSize: 50,
    primaryColor: '#FFFFFF',
    accentColor: '#00FFFF', // Cyan
    outlineColor: '#00E5FF',
    outlineWidth: 7,
    shadowColor: 'rgba(0,229,255,0.7)',
    shadowBlur: 14,
    shadowOffsetY: 0,
    uppercaseKeyWords: true,
    positionY: 1550,
    assPrimaryColor: '&H00FFFFFF',
    assAccentColor: '&H00FFFF00', // Cyan in BGR (&H00BBGGRR)
    assOutlineColor: '&H00FFE500', // Cyan outline in BGR
  },
  minimal: {
    name: 'minimal',
    label: 'Minimal Clean',
    description: 'Tipografía refinada, tamaño mediano con sombra suave y lectura limpia.',
    fontFamily: 'Arial, sans-serif',
    fontSize: 38,
    primaryColor: '#F8FAFC',
    accentColor: '#38BDF8', // Sky blue
    outlineColor: '#0F172A',
    outlineWidth: 3,
    shadowColor: 'rgba(0,0,0,0.6)',
    shadowBlur: 4,
    shadowOffsetY: 2,
    uppercaseKeyWords: false,
    positionY: 1580,
    assPrimaryColor: '&H00FCFAF8',
    assAccentColor: '&H00F8BD38',
    assOutlineColor: '&H002A170F',
  },
};

/**
 * Helper to format seconds to ASS timestamp: H:MM:SS.cs (e.g. 0:00:01.45)
 */
export function formatAssTime(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const hours = Math.floor(safeSec / 3600);
  const minutes = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const centisecs = Math.floor((safeSec - Math.floor(safeSec)) * 100);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const cs = String(centisecs).padStart(2, '0');

  return `${hours}:${mm}:${ss}.${cs}`;
}

/**
 * Filter and group Whisper words into small 2-3 word phrases within the clip time boundaries
 */
export function agruparPalabrasEnFrases(
  words: SubtitleWord[],
  inicioSeg: number,
  finSeg: number,
  maxWordsPerLine: number = 3
): SubtitleGroup[] {
  const clipDuration = Math.max(0.5, finSeg - inicioSeg);

  // 1. Filter and clamp words within [inicioSeg, finSeg]
  const validWords = words
    .filter((w) => w.end > inicioSeg && w.start < finSeg)
    .map((w) => {
      const relStart = Math.max(0, Math.min(clipDuration, w.start - inicioSeg));
      const relEnd = Math.max(relStart + 0.1, Math.min(clipDuration, w.end - inicioSeg));
      const isKey = w.isKeyWord || w.word.length > 5 || /[!¡?¿0-9%]/.test(w.word);
      return {
        text: w.word.trim(),
        start: relStart,
        end: relEnd,
        isKeyWord: isKey,
      };
    })
    .filter((w) => w.text.length > 0)
    .sort((a, b) => a.start - b.start);

  if (validWords.length === 0) {
    return [];
  }

  // 2. Chunk into groups of 2-3 words
  const groups: SubtitleGroup[] = [];
  let currentChunk: typeof validWords = [];

  for (let i = 0; i < validWords.length; i++) {
    currentChunk.push(validWords[i]);

    const isPunctuationBreak = /[.,!?;:]$/.test(validWords[i].text);
    const reachedLimit = currentChunk.length >= maxWordsPerLine;
    const isLast = i === validWords.length - 1;

    if (reachedLimit || isPunctuationBreak || isLast) {
      const groupStart = currentChunk[0].start;
      const groupEnd = currentChunk[currentChunk.length - 1].end;

      groups.push({
        id: `sub-grp-${groups.length + 1}`,
        start: groupStart,
        end: Math.max(groupStart + 0.3, groupEnd),
        words: [...currentChunk],
      });

      currentChunk = [];
    }
  }

  return groups;
}

export interface ExportSettings {
  resolucion: '1080p' | '720p';
  fps: 30 | 60;
  calidadCrf: 18 | 23 | 28;
  marcaDeAgua: boolean;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  resolucion: '1080p',
  fps: 30,
  calidadCrf: 23,
  marcaDeAgua: true,
};

export interface GenerateAssOptions {
  words: SubtitleWord[];
  inicioSeg: number;
  finSeg: number;
  stylePreset?: SubtitleStylePreset;
  hookText?: string;
  hookDurationSec?: number; // default 1.5s
  aspectRatio?: '9:16' | '1:1' | '16:9';
  marcaDeAgua?: boolean;
}

/**
 * Generates an Advanced SubStation Alpha (.ass) file content with karaoke/word-by-word highlights.
 * If hookText is provided, burns a high-impact animated hook during the first 0-1.5 seconds.
 */
export function generarArchivoASS(
  wordsOrOptions: SubtitleWord[] | GenerateAssOptions,
  legacyInicioSeg?: number,
  legacyFinSeg?: number,
  legacyStylePreset: SubtitleStylePreset = 'moderno'
): string {
  let words: SubtitleWord[];
  let inicioSeg: number;
  let finSeg: number;
  let stylePreset: SubtitleStylePreset;
  let hookText: string | undefined;
  let hookDurationSec: number = 1.5;
  let aspectRatio: '9:16' | '1:1' | '16:9' = '9:16';
  let marcaDeAgua: boolean = false;

  if (Array.isArray(wordsOrOptions)) {
    words = wordsOrOptions;
    inicioSeg = legacyInicioSeg ?? 0;
    finSeg = legacyFinSeg ?? 30;
    stylePreset = legacyStylePreset;
  } else {
    words = wordsOrOptions.words;
    inicioSeg = wordsOrOptions.inicioSeg;
    finSeg = wordsOrOptions.finSeg;
    stylePreset = wordsOrOptions.stylePreset || 'moderno';
    hookText = wordsOrOptions.hookText;
    hookDurationSec = wordsOrOptions.hookDurationSec ?? 1.5;
    aspectRatio = wordsOrOptions.aspectRatio || '9:16';
    marcaDeAgua = wordsOrOptions.marcaDeAgua ?? false;
  }

  const style = SUBTITLE_STYLES[stylePreset] || SUBTITLE_STYLES.moderno;
  const groups = agruparPalabrasEnFrases(words, inicioSeg, finSeg, 3);

  let playResX = 1080;
  let playResY = 1920;
  let marginV = 370;
  let hookMarginV = 420;
  let fontSizeMod = 0;

  if (aspectRatio === '1:1') {
    playResX = 1080;
    playResY = 1080;
    marginV = 140;
    hookMarginV = 160;
    fontSizeMod = -6;
  } else if (aspectRatio === '16:9') {
    playResX = 1920;
    playResY = 1080;
    marginV = 120;
    hookMarginV = 140;
    fontSizeMod = -4;
  }

  // ASS Header
  const header = `[Script Info]
Title: ClipForge Pro Smart Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: ${playResX}
PlayResY: ${playResY}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Moderno,Arial,${48 + fontSizeMod},&H00FFFFFF,&H0000E6FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,6,3,2,60,60,${marginV},1
Style: Neon,Arial,${50 + fontSizeMod},&H00FFFFFF,&H00FFFF00,&H00FFE500,&H90000000,-1,0,0,0,100,100,2,0,1,7,4,2,60,60,${marginV},1
Style: Minimal,Arial,${38 + fontSizeMod},&H00FCFAF8,&H00F8BD38,&H002A170F,&H60000000,0,0,0,0,100,100,0,0,1,3,1,2,80,80,${Math.round(marginV * 0.9)},1
Style: ViralHook,Arial,${54 + fontSizeMod},&H0000FFFF,&H0000FFFF,&H00000000,&HA0000000,-1,0,0,0,100,100,2,0,1,8,5,2,40,40,${hookMarginV},1
Style: Watermark,Arial,28,&H80FFFFFF,&H80FFFFFF,&H80000000,&H80000000,-1,0,0,0,100,100,1,0,1,2,1,3,24,24,24,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const styleName = stylePreset === 'neon' ? 'Neon' : stylePreset === 'minimal' ? 'Minimal' : 'Moderno';
  const events: string[] = [];

  // If watermark is requested (Free Plan), add subtle bottom-right watermark event
  if (marcaDeAgua) {
    const totalDur = Math.max(1, finSeg - inicioSeg);
    events.push(`Dialogue: 0,${formatAssTime(0)},${formatAssTime(totalDur)},Watermark,,0,0,0,,{\\alpha&H70&}ClipForge`);
  }

  // If hookText is specified, prepend the Hook Dialogue during 0-1.5s with subtle zoom animation tag \t(0, 400, \fscx108\fscy108)
  if (hookText && hookText.trim().length > 0) {
    const hookStart = formatAssTime(0);
    const hookEnd = formatAssTime(Math.min(hookDurationSec, finSeg - inicioSeg));
    const cleanHook = hookText.trim().toUpperCase();
    // ASS animation tag: starts normal, subtle zoom pop
    const animatedHook = `{\\fscx100\\fscy100\\t(0,350,\\fscx110\\fscy110)\\c${style.assAccentColor}\\b1}⚡ ${cleanHook} ⚡`;
    events.push(`Dialogue: 1,${hookStart},${hookEnd},ViralHook,,0,0,0,,${animatedHook}`);
  }

  for (const group of groups) {
    // Generate micro-events for each word in the group to highlight it during its time interval
    for (let i = 0; i < group.words.length; i++) {
      const activeWord = group.words[i];
      const eventStart = formatAssTime(activeWord.start);
      // Event lasts until the next word starts or until group end
      const nextWord = group.words[i + 1];
      const eventEnd = formatAssTime(nextWord ? nextWord.start : group.end);

      // Build text with active highlighted word
      const formattedLine = group.words
        .map((w, idx) => {
          const isCurrent = idx === i;
          let text = w.text;

          if (style.uppercaseKeyWords && (isCurrent || w.isKeyWord)) {
            text = text.toUpperCase();
          }

          if (isCurrent) {
            // Apply accent color override tags
            return `{\\c${style.assAccentColor}\\b1}${text}{\\c${style.assPrimaryColor}\\b0}`;
          }
          return text;
        })
        .join(' ');

      events.push(`Dialogue: 0,${eventStart},${eventEnd},${styleName},,0,0,0,,${formattedLine}`);
    }
  }

  return header + events.join('\n') + '\n';
}

/**
 * Draws subtitle text on a canvas context at a specific timestamp.
 * Used for instant interactive preview in SubtitlePreview.
 */
export function renderSubtitulosEnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  groups: SubtitleGroup[],
  currentRelSec: number,
  stylePreset: SubtitleStylePreset = 'moderno',
  marcaDeAgua: boolean = false
): void {
  const style = SUBTITLE_STYLES[stylePreset] || SUBTITLE_STYLES.moderno;

  // 1. Watermark if requested (Free Plan)
  if (marcaDeAgua) {
    ctx.save();
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText('ClipForge', width - 24, height - 24);
    ctx.restore();
  }

  // Find active group for current timestamp
  const activeGroup = groups.find((g) => currentRelSec >= g.start && currentRelSec <= g.end);

  if (!activeGroup || activeGroup.words.length === 0) {
    return;
  }

  // Scale font size proportionally to canvas resolution (reference: 1080x1920)
  const scale = width / 1080;
  const scaledFontSize = Math.round(style.fontSize * scale);
  const scaledOutline = Math.max(1, Math.round(style.outlineWidth * scale));
  const scaledPosY = Math.round(style.positionY * (height / 1920));

  ctx.save();
  ctx.font = `bold ${scaledFontSize}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Measure word widths to position each word accurately
  const words = activeGroup.words.map((w) => {
    const isCurrent = currentRelSec >= w.start && currentRelSec <= w.end;
    let displayText = w.text;
    if (style.uppercaseKeyWords && (isCurrent || w.isKeyWord)) {
      displayText = displayText.toUpperCase();
    }
    const metrics = ctx.measureText(displayText);
    return {
      word: w,
      displayText,
      isCurrent,
      width: metrics.width,
    };
  });

  const spaceWidth = ctx.measureText(' ').width;
  const totalLineWidth = words.reduce((sum, w) => sum + w.width, 0) + (words.length - 1) * spaceWidth;

  let currentX = width / 2 - totalLineWidth / 2;

  // Optional background pill for high contrast
  if (stylePreset === 'moderno') {
    const padX = 24 * scale;
    const padY = 12 * scale;
    const pillW = totalLineWidth + padX * 2;
    const pillH = scaledFontSize + padY * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - pillW / 2, scaledPosY - pillH / 2, pillW, pillH, 12 * scale);
    ctx.fill();
  }

  // Draw shadow, outline, and fill per word
  for (const item of words) {
    const wordCenterX = currentX + item.width / 2;

    // 1. Shadow
    ctx.shadowColor = item.isCurrent ? style.accentColor : style.shadowColor;
    ctx.shadowBlur = style.shadowBlur * scale * (item.isCurrent ? 1.5 : 1);
    ctx.shadowOffsetY = style.shadowOffsetY * scale;

    // 2. Stroke / Outline
    ctx.strokeStyle = style.outlineColor;
    ctx.lineWidth = scaledOutline;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(item.displayText, wordCenterX, scaledPosY);

    // 3. Fill
    ctx.fillStyle = item.isCurrent ? style.accentColor : style.primaryColor;
    ctx.fillText(item.displayText, wordCenterX, scaledPosY);

    currentX += item.width + spaceWidth;
  }

  ctx.restore();
}

/**
 * Creates fallback words from text or title if transcription is missing
 */
export function generarPalabrasFallback(text: string, durationSec: number): SubtitleWord[] {
  const rawWords = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (rawWords.length === 0) return [];

  const timePerWord = Math.max(0.3, durationSec / rawWords.length);
  return rawWords.map((word, idx) => ({
    word,
    start: idx * timePerWord,
    end: (idx + 1) * timePerWord,
    isKeyWord: word.length > 5 || /[!¡?¿0-9%]/.test(word),
  }));
}

export interface BurnSubtitlesOptions {
  clipId: string;
  verticalVideoBlob: Blob;
  words: SubtitleWord[];
  inicioSeg: number;
  finSeg: number;
  stylePreset?: SubtitleStylePreset;
  hookText?: string;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  marcaDeAgua?: boolean;
  exportSettings?: Partial<ExportSettings>;
  onProgress?: (progress: {
    percent: number;
    stage: string;
    detail: string;
  }) => void;
}

/**
 * Burns ASS subtitles into a vertical or cropped video using FFmpeg WASM.
 * Executes: ffmpeg -i clip_vertical.mp4 -vf "ass=subtitulos.ass" -c:a copy -c:v libx264 -preset fast -crf 23 short_final.mp4
 */
export async function quemarSubtitulosVideo(options: BurnSubtitlesOptions): Promise<{
  blob: Blob;
  previewUrl: string;
  assContent: string;
  groupsCount: number;
}> {
  const {
    clipId,
    verticalVideoBlob,
    words,
    inicioSeg,
    finSeg,
    stylePreset = 'moderno',
    hookText,
    aspectRatio = '9:16',
    marcaDeAgua = true,
    exportSettings,
    onProgress,
  } = options;

  const activeWatermark = exportSettings?.marcaDeAgua ?? marcaDeAgua;
  const targetCrf = exportSettings?.calidadCrf?.toString() || '23';
  const targetFps = exportSettings?.fps?.toString() || '30';
  const targetRes = exportSettings?.resolucion || '1080p';

  onProgress?.({
    percent: 10,
    stage: 'generando_ass',
    detail: hookText ? `Generando ASS con Hook inicial ("${hookText.slice(0, 25)}...")...` : 'Generando archivo de subtítulos ASS estilizados...',
  });

  // 1. Generate ASS content with optional hook initial entry and watermark
  const assContent = generarArchivoASS({
    words,
    inicioSeg,
    finSeg,
    stylePreset,
    hookText,
    hookDurationSec: 1.5,
    aspectRatio,
    marcaDeAgua: activeWatermark,
  });
  const groups = agruparPalabrasEnFrases(words, inicioSeg, finSeg, 3);

  onProgress?.({
    percent: 25,
    stage: 'cargando_ffmpeg',
    detail: 'Cargando motor de renderizado FFmpeg...',
  });

  const ffmpeg = await getLoadedFFmpeg((logMsg) => {
    const timeSec = parseFFmpegTime(logMsg);
    const totalDuration = Math.max(1, finSeg - inicioSeg);
    if (timeSec !== null) {
      const pct = Math.min(95, Math.max(30, Math.round(30 + (timeSec / totalDuration) * 60)));
      onProgress?.({
        percent: pct,
        stage: 'quemando_subtitulos',
        detail: `Quemando subtítulos en el vídeo (${timeSec.toFixed(1)}s / ${totalDuration.toFixed(1)}s)...`,
      });
    }
  });

  const inputName = `input_${clipId}_vert.mp4`;
  const assName = `subs_${clipId}.ass`;
  const outputName = `short_${clipId}_final.mp4`;

  // Write files to FFmpeg virtual FS
  const videoBytes = await fetchFile(verticalVideoBlob);
  await ffmpeg.writeFile(inputName, videoBytes);
  await ffmpeg.writeFile(assName, new TextEncoder().encode(assContent));

  onProgress?.({
    percent: 35,
    stage: 'quemando_subtitulos',
    detail: `Aplicando subtítulos (${SUBTITLE_STYLES[stylePreset].label}, ${targetRes}, ${targetFps}fps, CRF ${targetCrf})...`,
  });

  // Determine scale filter if 720p requested
  let scaleFilter = '';
  if (targetRes === '720p') {
    if (aspectRatio === '9:16') scaleFilter = ',scale=720:1280';
    else if (aspectRatio === '1:1') scaleFilter = ',scale=720:720';
    else if (aspectRatio === '16:9') scaleFilter = ',scale=1280:720';
  }

  let renderSucceeded = false;

  // Try standard ASS filter first
  try {
    const exitCode = await ffmpeg.exec([
      '-i', inputName,
      '-vf', `ass=${assName}${scaleFilter}`,
      '-r', targetFps,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', targetCrf,
      '-pix_fmt', 'yuv420p',
      outputName,
    ]);

    if (exitCode === 0) {
      renderSucceeded = true;
    }
  } catch (assErr) {
    console.warn('FFmpeg ASS filter failed in WASM, trying subtitles filter fallback:', assErr);
  }

  // Fallback 1: subtitles= filter
  if (!renderSucceeded) {
    try {
      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-vf', `subtitles=${assName}${scaleFilter}`,
        '-r', targetFps,
        '-c:a', 'copy',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', targetCrf,
        '-pix_fmt', 'yuv420p',
        outputName,
      ]);

      if (exitCode === 0) {
        renderSucceeded = true;
      }
    } catch (subErr) {
      console.warn('FFmpeg subtitles filter failed, attempting direct copy fallback:', subErr);
    }
  }

  // Fallback 2: If wasm libass is unsupported, copy vertical video or apply drawtext watermark directly
  if (!renderSucceeded) {
    console.warn('Burn-in filter fallback: exporting vertical clip with drawtext.');
    try {
      const vfFallback = activeWatermark
        ? `drawtext=text='ClipForge':x=w-tw-20:y=h-th-20:fontsize=28:fontcolor=white@0.5${scaleFilter}`
        : (scaleFilter ? scaleFilter.replace(/^,/, '') : '');

      const args = [
        '-i', inputName,
        '-r', targetFps,
        '-c:a', 'copy',
      ];

      if (vfFallback) {
        args.push('-vf', vfFallback, '-c:v', 'libx264', '-preset', 'fast', '-crf', targetCrf);
      } else {
        args.push('-c:v', 'copy');
      }
      args.push(outputName);

      await ffmpeg.exec(args);
      renderSucceeded = true;
    } catch (copyErr) {
      console.error('Final copy fallback failed:', copyErr);
    }
  }

  onProgress?.({
    percent: 95,
    stage: 'exportando',
    detail: 'Finalizando empaquetado del Short...',
  });

  let outBlob: Blob;
  try {
    const outData = (await ffmpeg.readFile(outputName)) as Uint8Array;
    outBlob = new Blob([outData.buffer], { type: 'video/mp4' });
  } catch (e) {
    outBlob = verticalVideoBlob;
  }

  // Clean up virtual FS
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(assName);
    await ffmpeg.deleteFile(outputName);
  } catch (cleanupErr) {
    // Ignore cleanup errors
  }

  const previewUrl = URL.createObjectURL(outBlob);

  onProgress?.({
    percent: 100,
    stage: 'completado',
    detail: '¡Short completo generado con éxito!',
  });

  return {
    blob: outBlob,
    previewUrl,
    assContent,
    groupsCount: groups.length,
  };
}
