import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Sliders,
  Type,
  Eye,
  Check,
  Smartphone,
  Flame,
  Volume2,
} from 'lucide-react';
import {
  SubtitleStylePreset,
  SUBTITLE_STYLES,
  SubtitleWord,
  agruparPalabrasEnFrases,
  renderSubtitulosEnCanvas,
  SubtitleGroup,
} from '../../lib/subtitulos';

interface SubtitlePreviewProps {
  videoUrl?: string;
  words: SubtitleWord[];
  inicioSeg: number;
  finSeg: number;
  selectedStyle: SubtitleStylePreset;
  onStyleChange: (style: SubtitleStylePreset) => void;
  marcaDeAgua?: boolean;
  className?: string;
}

export const SubtitlePreview: React.FC<SubtitlePreviewProps> = ({
  videoUrl,
  words,
  inicioSeg,
  finSeg,
  selectedStyle,
  onStyleChange,
  marcaDeAgua = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const duration = Math.max(1, finSeg - inicioSeg);
  const [currentRelSec, setCurrentRelSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Group words into phrases (2-3 words max)
  const groups = React.useMemo(() => {
    return agruparPalabrasEnFrases(words, inicioSeg, finSeg, 3);
  }, [words, inicioSeg, finSeg]);

  // Load hidden background video element to extract real frames onto canvas
  useEffect(() => {
    if (!videoUrl) return;

    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.src = videoUrl;

    v.onloadedmetadata = () => {
      v.currentTime = inicioSeg;
      setVideoLoaded(true);
    };

    videoRef.current = v;

    return () => {
      v.pause();
      v.src = '';
      videoRef.current = null;
    };
  }, [videoUrl, inicioSeg]);

  // Playback timer loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (isPlaying) {
        const deltaSec = (now - lastTime) / 1000;
        setCurrentRelSec((prev) => {
          const next = prev + deltaSec;
          if (next >= duration) {
            return 0; // Loop back
          }
          return next;
        });
      }
      lastTime = now;
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, duration]);

  // Synchronize video element frame when scrubber or playhead changes
  useEffect(() => {
    if (videoRef.current && videoLoaded) {
      const targetTime = inicioSeg + currentRelSec;
      if (Math.abs(videoRef.current.currentTime - targetTime) > 0.3) {
        videoRef.current.currentTime = targetTime;
      }
    }
  }, [currentRelSec, inicioSeg, videoLoaded]);

  // Render canvas frame + subtitle overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Draw video background or simulated 9:16 gradient backdrop
    if (videoRef.current && videoLoaded && videoRef.current.readyState >= 2) {
      // Fit video to 9:16 canvas
      const v = videoRef.current;
      const vRatio = (v.videoWidth || 16) / (v.videoHeight || 9);
      const cRatio = width / height;

      let drawW = width;
      let drawH = height;
      let drawX = 0;
      let drawY = 0;

      if (vRatio > cRatio) {
        drawW = height * vRatio;
        drawX = (width - drawW) / 2;
      } else {
        drawH = width / vRatio;
        drawY = (height - drawH) / 2;
      }

      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(v, drawX, drawY, drawW, drawH);

      // Add subtle dark vignette bottom for subtitle readability
      const grad = ctx.createLinearGradient(0, height * 0.65, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height * 0.65, width, height * 0.35);
    } else {
      // Fallback gradient backdrop
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#13112c');
      grad.addColorStop(0.5, '#0b0c16');
      grad.addColorStop(1, '#05050a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Grid line decoration
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.15)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // 2. Render Subtitles & Watermark
    renderSubtitulosEnCanvas(ctx, width, height, groups, currentRelSec, selectedStyle, marcaDeAgua);
  }, [currentRelSec, groups, selectedStyle, videoLoaded, marcaDeAgua]);

  // Current active word or phrase text for textual inspection
  const activeGroup = groups.find((g) => currentRelSec >= g.start && currentRelSec <= g.end);
  const activeWord = activeGroup?.words.find((w) => currentRelSec >= w.start && currentRelSec <= w.end);

  const styleConfig = SUBTITLE_STYLES[selectedStyle];

  return (
    <div className={`bg-[#0d0d1b] border border-purple-900/40 rounded-2xl p-4 sm:p-5 space-y-4 ${className}`}>
      {/* Header with Style Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-900/30 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-600 text-white shadow-sm shadow-purple-900/50">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Estilo de Subtítulos Animados</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-800">
                Karaoke 9:16
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Previsualiza cómo se renderizarán los subtítulos sobre el vídeo antes de quemarlos con FFmpeg.
            </p>
          </div>
        </div>

        {/* Style Preset Selector Pills */}
        <div className="flex items-center gap-1.5 bg-[#090912] p-1 rounded-xl border border-purple-900/50">
          {(['moderno', 'neon', 'minimal'] as SubtitleStylePreset[]).map((preset) => {
            const isSelected = selectedStyle === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onStyleChange(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? preset === 'moderno'
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 shadow-md shadow-yellow-900/40'
                      : preset === 'neon'
                      ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white shadow-md shadow-cyan-900/40'
                      : 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-purple-950/30'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                <span>{SUBTITLE_STYLES[preset].label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Stage: 9:16 Live Canvas + Detail Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* 9:16 Canvas Box */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="relative aspect-[9/16] w-full max-w-[220px] bg-black rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-2xl shadow-purple-950/60 group">
            <canvas
              ref={canvasRef}
              width={270}
              height={480}
              className="w-full h-full object-cover"
            />

            {/* Live timestamp overlay badge */}
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-cyan-800/40">
              {currentRelSec.toFixed(1)}s / {duration.toFixed(1)}s
            </div>

            {/* 9:16 safe area guides badge */}
            <div className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-mono text-slate-400 border border-slate-800">
              9:16
            </div>

            {/* Bottom Floating Play/Pause trigger */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Scrubber & Player controls under canvas */}
          <div className="w-full max-w-[220px] space-y-1.5 mt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-800 hover:bg-purple-900 transition-colors cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setCurrentRelSec(0)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Reiniciar a 0s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={currentRelSec}
                onChange={(e) => {
                  setCurrentRelSec(parseFloat(e.target.value));
                  if (isPlaying) setIsPlaying(false);
                }}
                className="flex-1 accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Right Info: Style Parameters & Whisper Sync Status */}
        <div className="md:col-span-7 space-y-3.5 text-xs">
          {/* Active Phrase & Highlighted Word Display */}
          <div className="p-3.5 rounded-xl bg-[#090915] border border-purple-900/30 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                Frase activa en tiempo real:
              </span>
              <span className="font-mono text-cyan-400">
                {groups.length} frases generadas
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0e0e1e] border border-purple-800/40 text-center min-h-[46px] flex items-center justify-center">
              {activeGroup ? (
                <p className="text-sm font-bold tracking-wide space-x-1.5">
                  {activeGroup.words.map((w, idx) => {
                    const isCur = currentRelSec >= w.start && currentRelSec <= w.end;
                    return (
                      <span
                        key={idx}
                        className={`inline-block px-1.5 py-0.5 rounded transition-all ${
                          isCur
                            ? selectedStyle === 'moderno'
                              ? 'bg-yellow-400 text-slate-950 scale-110 shadow-sm'
                              : selectedStyle === 'neon'
                              ? 'bg-cyan-400 text-slate-950 scale-110 shadow-md shadow-cyan-400/50'
                              : 'bg-sky-500 text-white font-extrabold'
                            : 'text-slate-200'
                        }`}
                      >
                        {styleConfig.uppercaseKeyWords ? w.text.toUpperCase() : w.text}
                      </span>
                    );
                  })}
                </p>
              ) : (
                <span className="text-slate-500 italic text-[11px]">
                  Silencio o pausa en este tramo...
                </span>
              )}
            </div>
          </div>

          {/* Style Properties Badges */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-[#111122] border border-purple-900/30">
              <span className="text-slate-400 block text-[10px]">Agrupación</span>
              <span className="font-semibold text-slate-200">Máx. 2-3 palabras/línea</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#111122] border border-purple-900/30">
              <span className="text-slate-400 block text-[10px]">Posición Vertical</span>
              <span className="font-semibold text-cyan-300 font-mono">y ≈ 1550 (Inferior 9:16)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#111122] border border-purple-900/30">
              <span className="text-slate-400 block text-[10px]">Borde / Contorno</span>
              <span className="font-semibold text-emerald-400 font-mono">
                {styleConfig.outlineWidth}px {styleConfig.outlineColor}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#111122] border border-purple-900/30">
              <span className="text-slate-400 block text-[10px]">Color de Resaltado</span>
              <span className="font-semibold font-mono flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full border border-white/40"
                  style={{ backgroundColor: styleConfig.accentColor }}
                />
                <span className="text-slate-200">{styleConfig.accentColor}</span>
              </span>
            </div>
          </div>

          {/* Style description tip */}
          <p className="text-[11px] text-slate-400 leading-relaxed bg-purple-950/20 p-2.5 rounded-lg border border-purple-900/20">
            💡 <strong className="text-purple-300">{styleConfig.label}:</strong> {styleConfig.description}
          </p>
        </div>
      </div>
    </div>
  );
};
