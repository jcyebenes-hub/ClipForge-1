import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Play, 
  Youtube, 
  Flame, 
  CheckCircle2, 
  TrendingUp, 
  Volume2, 
  Share2, 
  Heart, 
  MessageCircle, 
  Zap, 
  Upload
} from 'lucide-react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

interface HeroProps {
  onStartFree?: () => void;
  onWatchDemo?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartFree, onWatchDemo }) => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const [demoUrl, setDemoUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onStartFree) onStartFree();
  };

  return (
    <section 
      ref={ref}
      className={`relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-grid-pattern transition-all duration-700 ${
        isVisible ? 'reveal-active' : 'reveal-init'
      }`}
      id="hero"
    >
      {/* Glow Orbs Background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[900px] h-[450px] bg-gradient-to-tr from-purple-700/20 via-indigo-600/15 to-cyan-500/20 blur-[130px] rounded-full pointer-events-none -z-10 animate-pulse-glow" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Copy & Interactive Quick CTA */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            
            {/* Top Announcement Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-900/40 border border-purple-700/50 shadow-inner mb-6 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-semibold text-purple-200 tracking-wide">
                Novedad: Motor IA Whisper v3 + Auto-Face Tracking 9:16
              </span>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 font-bold">
                100% Gratis
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] mb-6 font-['Plus_Jakarta_Sans',sans-serif]">
              Convierte vídeos largos en{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 drop-shadow-sm">
                Shorts virales
              </span>{' '}
              con IA
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed mb-8">
              La IA recorta, subtitula y publica tus vídeos automáticamente en TikTok, YouTube e Instagram. 
              <span className="text-white font-medium"> 100 % gratis.</span>
            </p>

            {/* Fast Interactive Action Box */}
            <div className="w-full max-w-xl bg-slate-900/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-purple-800/40 shadow-2xl shadow-purple-950/40 mb-6">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('url')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'url'
                      ? 'bg-purple-600/30 text-cyan-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Youtube className="w-3.5 h-3.5 text-red-500" />
                  <span>Enlace de YouTube</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'upload'
                      ? 'bg-purple-600/30 text-cyan-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span>Subir MP4 / MOV</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    id="hero-quick-input"
                    type={activeTab === 'url' ? 'url' : 'text'}
                    placeholder={activeTab === 'url' ? 'Pega aquí el enlace de YouTube o Podcast...' : 'Selecciona un archivo de tu equipo...'}
                    value={demoUrl}
                    onChange={(e) => setDemoUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0a0a14] text-sm text-slate-100 placeholder-slate-500 rounded-xl border border-purple-900/50 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                  />
                  {activeTab === 'url' && !demoUrl && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                      <span>Ej: Podcast, Charla, Vlog</span>
                    </div>
                  )}
                </div>
                <button
                  id="hero-generate-btn"
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-lg shadow-purple-900/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>Generar Shorts</span>
                </button>
              </form>
            </div>

            {/* 2 CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-8">
              <button
                id="hero-primary-cta"
                onClick={onStartFree}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-base font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-xl shadow-purple-900/50 hover:shadow-purple-700/60 hover:-translate-y-0.5 active:translate-y-0 transition-all border border-purple-400/40 cursor-pointer"
              >
                <span>Empezar gratis</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                id="hero-secondary-cta"
                onClick={onWatchDemo || (() => {
                  const elem = document.getElementById('como-funciona');
                  elem?.scrollIntoView({ behavior: 'smooth' });
                })}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-base font-semibold text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-purple-900/50 hover:border-cyan-500/50 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-purple-950 border border-purple-600/50 flex items-center justify-center">
                  <Play className="w-3 h-3 text-cyan-400 fill-cyan-400 ml-0.5" />
                </div>
                <span>Ver cómo funciona</span>
              </button>
            </div>

            {/* Micro Highlights */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-4 border-t border-purple-950/60 w-full max-w-xl">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-cyan-400 font-extrabold text-lg sm:text-xl">
                  <span>10x</span>
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-xs text-slate-400">Más visualizaciones</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-purple-300 font-extrabold text-lg sm:text-xl">
                  <span>0 €</span>
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-xs text-slate-400">Gratis en tu navegador</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-lg sm:text-xl">
                  <span>&lt; 60s</span>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs text-slate-400">Procesado instantáneo</span>
              </div>
            </div>

          </div>

          {/* Right Column: High-fidelity CSS/SVG Mobile Mockup */}
          <div className="lg:col-span-5 flex justify-center relative">
            
            {/* Background Ambient Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-purple-600/30 via-indigo-600/20 to-cyan-500/20 blur-3xl -z-10 rounded-full" />

            {/* Floating Badges */}
            <div className="absolute -top-4 -left-4 sm:-left-8 z-20 bg-[#121224]/90 backdrop-blur-md border border-purple-600/40 px-3.5 py-2 rounded-xl shadow-xl shadow-purple-950/60 flex items-center gap-2.5 animate-float-slow">
              <div className="w-7 h-7 rounded-lg bg-purple-900/60 flex items-center justify-center text-cyan-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Detector Viral IA</p>
                <p className="text-xs font-bold text-white flex items-center gap-1">
                  Puntuación Viral: <span className="text-cyan-400">98/100 🔥</span>
                </p>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 sm:-right-6 z-20 bg-[#121224]/90 backdrop-blur-md border border-cyan-500/40 px-3.5 py-2 rounded-xl shadow-xl shadow-black/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-950/60 flex items-center justify-center text-cyan-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Subtítulos Whisper</p>
                <p className="text-xs font-bold text-slate-100">Auto-sincronizado 100%</p>
              </div>
            </div>

            {/* Mobile Phone Mockup Frame (Pure CSS / SVG) */}
            <div className="relative w-[280px] sm:w-[310px] h-[580px] sm:h-[610px] bg-[#0d0d18] rounded-[42px] p-3.5 border-4 border-slate-700/60 shadow-2xl shadow-purple-950/80 ring-1 ring-purple-500/30">
              
              {/* Screen Area (9:16 Aspect Ratio) */}
              <div className="relative w-full h-full bg-[#07070e] rounded-[32px] overflow-hidden flex flex-col justify-between border border-slate-800">
                
                {/* Dynamic Island / Notch */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-30 flex items-center justify-between px-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-pulse" />
                </div>

                {/* SVG Video Stage Graphic (Simulated Podcast / Creator talking) */}
                <div className="absolute inset-0 z-0">
                  <svg className="w-full h-full" viewBox="0 0 300 600" preserveAspectRatio="xMidYMid slice">
                    <defs>
                      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1e1035" />
                        <stop offset="50%" stopColor="#110e28" />
                        <stop offset="100%" stopColor="#0a0a14" />
                      </linearGradient>
                      <radialGradient id="stageLight" cx="50%" cy="40%" r="50%">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                      </radialGradient>
                      <linearGradient id="neonSub" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#facc15" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>

                    {/* Stage background */}
                    <rect width="300" height="600" fill="url(#bgGrad)" />
                    <circle cx="150" cy="220" r="140" fill="url(#stageLight)" />

                    {/* Studio Background Details */}
                    <rect x="40" y="80" width="40" height="80" rx="4" fill="#312e81" opacity="0.3" />
                    <line x1="20" y1="180" x2="280" y2="180" stroke="#4338ca" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />

                    {/* Microphone Element */}
                    <path d="M 120 280 Q 150 250 180 280" stroke="#94a3b8" strokeWidth="4" fill="none" opacity="0.8" />
                    <rect x="140" y="220" width="20" height="40" rx="10" fill="#64748b" stroke="#cbd5e1" strokeWidth="2" />
                    <line x1="150" y1="260" x2="150" y2="330" stroke="#475569" strokeWidth="5" />

                    {/* Speaker Silhouette / Creator Representation */}
                    <circle cx="150" cy="170" r="42" fill="#a855f7" opacity="0.3" />
                    {/* Face tracking target overlay */}
                    <rect x="105" y="125" width="90" height="90" rx="12" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="6 4" />
                    <circle cx="150" cy="170" r="3" fill="#22d3ee" />
                    <path d="M 105 140 L 105 125 L 120 125" stroke="#22d3ee" strokeWidth="2.5" fill="none" />
                    <path d="M 195 140 L 195 125 L 180 125" stroke="#22d3ee" strokeWidth="2.5" fill="none" />
                    <path d="M 105 200 L 105 215 L 120 215" stroke="#22d3ee" strokeWidth="2.5" fill="none" />
                    <path d="M 195 200 L 195 215 L 180 215" stroke="#22d3ee" strokeWidth="2.5" fill="none" />
                    
                    {/* Speaker Body Outline */}
                    <path d="M 70 330 Q 150 260 230 330 L 250 600 L 50 600 Z" fill="#1e1b4b" opacity="0.9" />
                    <path d="M 110 230 Q 150 270 190 230" fill="#312e81" />
                  </svg>
                </div>

                {/* Top Video Header Overlay */}
                <div className="relative z-10 pt-10 px-4 flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="font-semibold text-[11px]">Clip #03 • Gancho 98%</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <Volume2 className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                {/* Center Dynamic Captions (Viral Hormozi / MrBeast Style) */}
                <div className="relative z-10 px-4 my-auto text-center flex flex-col items-center">
                  <div className="bg-black/85 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-purple-500/50 shadow-2xl max-w-[240px] transform hover:scale-105 transition-transform">
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400 mb-0.5">
                      ⚡ MOMENTO CLAVE
                    </div>
                    <p className="text-sm font-black text-white leading-tight uppercase">
                      "SI NO CREAS <span className="text-yellow-300 underline decoration-cyan-400 decoration-2">CONTENIDO CORTO</span> ESTÁS PERDIENDO EL 90% DE AUDIENCIA"
                    </p>
                  </div>

                  {/* Audio Waveform Simulator */}
                  <div className="flex items-center justify-center gap-1 mt-4 px-3 py-1.5 bg-black/60 rounded-full border border-purple-900/40">
                    {[12, 24, 18, 28, 14, 22, 30, 16, 26, 12, 20].map((height, i) => (
                      <div
                        key={i}
                        className="w-1 bg-gradient-to-t from-purple-500 to-cyan-400 rounded-full animate-pulse"
                        style={{
                          height: `${height}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.9s'
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Right Side Social Interaction Column */}
                <div className="absolute right-3 bottom-20 z-10 flex flex-col items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-slate-900/80 border border-slate-700/60 flex items-center justify-center text-rose-500 shadow-lg">
                      <Heart className="w-4 h-4 fill-rose-500" />
                    </div>
                    <span className="text-[10px] font-bold text-white mt-0.5">98.4K</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-slate-900/80 border border-slate-700/60 flex items-center justify-center text-slate-200 shadow-lg">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-white mt-0.5">2.3K</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-slate-900/80 border border-slate-700/60 flex items-center justify-center text-cyan-400 shadow-lg">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-white mt-0.5">14.1K</span>
                  </div>
                </div>

                {/* Bottom Creator Info & Progress bar */}
                <div className="relative z-10 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-white">
                      CF
                    </div>
                    <span className="text-xs font-bold text-white">@clipforge_ai</span>
                    <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-1">
                    Exportado en 9:16 con subtítulos automáticos ⚡
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className="w-2/3 h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full" />
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
