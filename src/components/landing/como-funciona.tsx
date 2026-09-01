import React, { useState } from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { Link2, Cpu, Share2, Youtube, Sparkles, Wand2, CheckCircle2, ArrowRight, Video, Scissors, FileText } from 'lucide-react';

export const ComoFunciona: React.FC = () => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.15 });
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      number: '01',
      title: 'Pega una URL de YouTube o sube tu vídeo',
      description:
        'Introduce el enlace de cualquier vídeo de YouTube, Twitch o podcast, o arrastra directamente tu archivo MP4, MOV o WebM. ClipForge analiza el audio y el vídeo al instante.',
      icon: Link2,
      tag: 'Importación Instantánea',
      detail: 'Soporta vídeos de hasta 4K y 4 horas de duración.',
      visual: (
        <div className="w-full h-48 bg-[#0d0d1a] rounded-xl p-4 border border-purple-900/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-purple-300 font-medium">
              <Youtube className="w-4 h-4 text-red-500" /> Fuente de vídeo
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Listo para analizar
            </span>
          </div>

          <div className="bg-[#141424] p-3 rounded-lg border border-slate-700/60 flex items-center gap-3">
            <div className="w-12 h-10 bg-slate-800 rounded flex items-center justify-center text-slate-400">
              <Video className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                https://youtube.com/watch?v=Episodio-Completo-Podcast-42
              </p>
              <p className="text-[11px] text-slate-400">Duración: 58:24 • Calidad: 1080p60</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400">Extracción de transcripción automática</span>
            <span className="font-semibold text-cyan-400">100% Completado</span>
          </div>
        </div>
      ),
    },
    {
      number: '02',
      title: 'La IA detecta los momentos virales y añade mejoras',
      description:
        'Nuestros algoritmos analizan los picos de retención, las emociones de voz y el dinamismo para recortar las mejores partes. Añade automáticamente subtítulos con estilo, seguimiento de rostros en 9:16 y ganchos de alta conversión.',
      icon: Cpu,
      tag: 'Procesamiento IA',
      detail: 'Reencuadre facial inteligente + Whisper IA para subtítulos sin fallos.',
      visual: (
        <div className="w-full h-48 bg-[#0d0d1a] rounded-xl p-4 border border-purple-900/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> 4 Clips Virales Generados
            </span>
            <span className="text-[11px] text-slate-400">Puntuación: 98/100</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { time: '02:14 - 02:58', score: '98%', title: 'El Gran Secreto' },
              { time: '14:20 - 15:05', score: '95%', title: 'Error Fatal' },
              { time: '38:10 - 39:02', score: '92%', title: 'Consejo Clave' },
            ].map((clip, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg border text-left transition-all ${
                  idx === 0
                    ? 'bg-purple-950/40 border-purple-500/60 ring-1 ring-purple-500/40'
                    : 'bg-[#141424] border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-bold text-cyan-300">{clip.score}</span>
                  <Scissors className="w-2.5 h-2.5 text-purple-400" />
                </div>
                <p className="text-[11px] font-semibold text-slate-200 truncate">{clip.title}</p>
                <p className="text-[9px] text-slate-400">{clip.time}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs bg-purple-950/30 px-2.5 py-1.5 rounded-lg border border-purple-800/30">
            <span className="text-[11px] text-purple-200">Subtítulos & Auto-Crop 9:16 aplicados</span>
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
        </div>
      ),
    },
    {
      number: '03',
      title: 'Descarga o publica en TikTok, Shorts y Reels',
      description:
        'Exporta tus vídeos listos en alta resolución 1080p sin marcas de agua molestas o conéctate para programar y publicar con un solo clic directamente en tus canales favoritos.',
      icon: Share2,
      tag: 'Exportación y Publicación',
      detail: 'Listo para TikTok, YouTube Shorts, Instagram Reels y Facebook.',
      visual: (
        <div className="w-full h-48 bg-[#0d0d1a] rounded-xl p-4 border border-purple-900/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Clips listos para distribuir
            </span>
            <span className="text-[11px] text-slate-400">Formato 9:16 (1080x1920)</span>
          </div>

          <div className="flex items-center justify-center gap-3 py-2">
            {[
              { name: 'TikTok', color: 'bg-[#010101] text-cyan-400 border-cyan-500/40' },
              { name: 'YT Shorts', color: 'bg-red-950/50 text-red-400 border-red-500/40' },
              { name: 'IG Reels', color: 'bg-pink-950/50 text-pink-400 border-pink-500/40' },
            ].map((plat, i) => (
              <div
                key={i}
                className={`px-3 py-2 rounded-xl border text-center font-bold text-xs ${plat.color} flex flex-col items-center gap-1 shadow-md`}
              >
                <span>{plat.name}</span>
                <span className="text-[9px] text-slate-300 font-normal">Sincronizado</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-300 font-medium">Descarga Directa MP4</span>
            <button className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded text-[11px] font-bold text-white">
              Exportar todo
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      ref={ref}
      id="como-funciona"
      className={`py-20 md:py-32 relative bg-[#0a0a14] transition-all duration-700 ${
        isVisible ? 'reveal-active' : 'reveal-init'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/70 border border-purple-800/40 text-xs font-bold text-purple-300 mb-4">
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Flujo Simplificado en 3 Pasos</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif] mb-4">
            De 1 hora de podcast a{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400">
              10 shorts virales
            </span>{' '}
            en minutos
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            Olvídate de pasar horas recortando pistas de audio y sincronizando subtítulos a mano. ClipForge automatiza todo el proceso.
          </p>
        </div>

        {/* 3 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          
          {/* Connector Line on Desktop */}
          <div className="hidden md:block absolute top-1/2 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-purple-800 via-indigo-700 to-cyan-700 -translate-y-12 z-0 opacity-40" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative z-10 flex flex-col bg-[#0f0f1d]/90 backdrop-blur-md rounded-2xl p-6 sm:p-7 border border-purple-900/40 hover:border-purple-600/60 shadow-xl shadow-black/40 hover:-translate-y-1 transition-all duration-300 group"
              >
                {/* Step Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600/20 to-cyan-500/20 border border-purple-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-cyan-300" />
                  </div>
                  <span className="font-black text-3xl text-purple-500/40 font-['Plus_Jakarta_Sans',sans-serif] group-hover:text-purple-400 transition-colors">
                    {step.number}
                  </span>
                </div>

                {/* Step Tag */}
                <div className="mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                    {step.tag}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-white mb-3 leading-snug">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-6 flex-1">
                  {step.description}
                </p>

                {/* Rich Diagram / Visual Box */}
                <div className="mt-auto">
                  {step.visual}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
