/**
 * lib/marcaDeAgua.ts
 *
 * Marca de agua del plan gratuito en formato ASS, para quemarla con el filtro
 * `ass=` de FFmpeg (libass), que es el mismo mecanismo que ya funciona en
 * producción para los subtítulos de los Shorts.
 *
 * Por qué un módulo propio y sin importaciones:
 *   subtitulos.ts importa videoCutter.ts (para el motor FFmpeg). Si videoCutter
 *   importara de subtitulos.ts para reutilizar el estilo, se crearía un ciclo de
 *   módulos. Este fichero no depende de nada, así que ambos pueden usarlo.
 *
 * Se usa `Alignment: 3` (abajo a la derecha), por lo que la marca queda en la
 * esquina también en vídeos verticales: libass escala el guion a la resolución
 * real del fotograma.
 */

export const TEXTO_MARCA_DE_AGUA = 'ClipForge';

/** h:mm:ss.cc, el formato de tiempo que exige ASS. */
function tiempoAss(segundos: number): string {
  const total = Math.max(0, segundos);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  const ccs = cs === 100 ? 0 : cs;
  const extra = cs === 100 ? 1 : 0;
  const ss = s + extra;
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ccs).padStart(2, '0')}`;
}

/**
 * Genera un documento ASS completo que contiene ÚNICAMENTE la marca de agua,
 * visible durante toda la duración indicada.
 */
export function generarASSMarcaDeAgua(
  duracionSeg: number,
  playResX = 1920,
  playResY = 1080
): string {
  const total = Math.max(1, duracionSeg);
  return `[Script Info]
Title: ClipForge Watermark
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: ${playResX}
PlayResY: ${playResY}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Watermark,Arial,28,&H80FFFFFF,&H80FFFFFF,&H80000000,&H80000000,-1,0,0,0,100,100,1,0,1,2,1,3,24,24,24,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,${tiempoAss(0)},${tiempoAss(total)},Watermark,,0,0,0,,{\\alpha&H70&}${TEXTO_MARCA_DE_AGUA}
`;
}
