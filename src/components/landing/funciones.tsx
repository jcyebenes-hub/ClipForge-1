import React, { useState } from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { 
  Sparkles, 
  ScanFace, 
  Subtitles, 
  Languages, 
  Flame, 
  Gamepad2, 
  ArrowRight, 
  Check, 
  X, 
  Activity,
  Layers,
  Wand2
} from 'lucide-react';

export const Funciones: React.FC = () => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const [activeCompareTab, setActiveCompareTab] = useState<Record<number, 'despues' | 'antes'>>({
    0: 'despues',
    1: 'despues',
    2: 'despues',
    3: 'despues',
    4: 'despues',
    5: 'despues',
  });

  const toggleTab = (index: number, mode: 'despues' | 'antes') => {
    setActiveCompareTab((prev) => ({ ...prev, [index]: mode }));
  };

  const features = [
    {
      title: 'Curación automática',
      subtitle: 'Detecta los momentos de mayor retención y viralidad',
      description:
        'La IA analiza cambios de entonación, risas, pausas dramáticas y momentos clave para extraer automáticamente los fragmentos con mayor probabilidad de convertirse en tendencia.',
      icon: Sparkles,
      tag: 'Algoritmo Viral',
      beforeAfter: {
        beforeText: '1 vídeo plano de 60 min sin segmentar',
        afterText: '4 clips virales con 98% de probabilidad de éxito',
        beforeSvg: (
          <div className="w-full h-28 bg-[#090912] rounded-lg p-2.5 flex flex-col justify-center border border-rose-950/30">
            <div className="flex items-center justify-between text-[10px] text-rose-400 mb-1.5 font-semibold">
              <span className="flex items-center gap-1"><X className="w-3 h-3 text-rose-500" /> Sin IA: Edición manual</span>
              <span>60:00 min</span>
            </div>
            <div className="w-full h-5 bg-slate-800 rounded flex items-center px-1">
              <div className="w-full h-1.5 bg-slate-600 rounded" />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">3 horas buscando los mejores minutos a mano</p>
          </div>
        ),
        afterSvg: (
          <div className="w-full h-28 bg-[#0e0e1c] rounded-lg p-2.5 flex flex-col justify-center border border-cyan-500/30">
            <div className="flex items-center justify-between text-[10px] text-cyan-400 mb-1.5 font-bold">
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-cyan-400" /> Con ClipForge IA</span>
              <span className="text-purple-300">Picos Virales Detectados</span>
            </div>
            <div className="w-full h-6 bg-slate-900 rounded flex items-center justify-between px-1 gap-1 border border-purple-900/50">
              <div className="h-4 w-1/5 bg-purple-500 rounded text-[8px] font-bold text-white flex items-center justify-center">98%</div>
              <div className="h-1.5 w-1/6 bg-slate-700 rounded" />
              <div className="h-4 w-1/5 bg-cyan-400 rounded text-[8px] font-bold text-slate-950 flex items-center justify-center">96%</div>
              <div className="h-1.5 w-1/6 bg-slate-700 rounded" />
              <div className="h-4 w-1/5 bg-purple-500 rounded text-[8px] font-bold text-white flex items-center justify-center">94%</div>
            </div>
            <p className="text-[10px] text-cyan-300 mt-2 text-center font-medium">Listo en 45 segundos con puntuación viral</p>
          </div>
        ),
      },
    },
    {
      title: 'Seguimiento facial inteligente',
      subtitle: 'Encuadre 9:16 vertical que sigue al orador en tiempo real',
      description:
        'Reencuadra vídeos horizontales (16:9) a formato vertical (9:16) manteniendo siempre centrados los rostros de los interlocutores sin deformar la imagen ni perder detalles.',
      icon: ScanFace,
      tag: 'Auto-Crop 9:16',
      beforeAfter: {
        beforeText: 'Imagen 16:9 con barras negras o persona cortada',
        afterText: 'Encuadre perfecto vertical centrado en el sujeto',
        beforeSvg: (
          <div className="w-full h-28 bg-[#090912] rounded-lg p-2 flex items-center justify-center border border-rose-950/30">
            <div className="w-16 h-24 bg-black rounded border border-slate-700 flex flex-col justify-between p-1">
              <div className="h-3 bg-slate-800 rounded-sm" />
              <div className="text-[8px] text-rose-400 text-center font-semibold">Orador fuera de encuadre</div>
              <div className="h-3 bg-slate-800 rounded-sm" />
            </div>
          </div>
        ),
        afterSvg: (
          <div className="w-full h-28 bg-[#0e0e1c] rounded-lg p-2 flex items-center justify-center border border-cyan-500/30">
            <div className="w-16 h-24 bg-[#18182f] rounded border-2 border-cyan-400 flex flex-col items-center justify-center relative p-1 shadow-lg shadow-cyan-500/20">
              <div className="w-8 h-8 rounded-full bg-purple-600/40 border border-cyan-300 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <div className="absolute top-1 right-1 text-[7px] bg-cyan-400 text-slate-950 font-black px-1 rounded">
                AI FOCUS
              </div>
              <span className="text-[8px] font-bold text-white mt-1">100% Centrado</span>
            </div>
          </div>
        ),
      },
    },
    {
      title: 'Subtítulos automáticos (Whisper)',
      subtitle: 'Transcripción precisa con estilos animados tipo Alex Hormozi',
      description:
        'Integración con Whisper IA para subtítulos con 99,4% de precisión fonética, resaltado dinámico de palabras por segundo, emojis automáticos y efectos de color de alto impacto.',
      icon: Subtitles,
      tag: 'Speech-to-Text IA',
      beforeAfter: {
        beforeText: 'Subtítulos aburridos estáticos difíciles de leer',
        afterText: 'Palabras animadas con colores y emojis de retención',
        beforeSvg: (
          <div className="w-full h-28 bg-[#090912] rounded-lg p-2.5 flex flex-col justify-center items-center border border-rose-950/30">
            <div className="text-slate-400 text-[11px] font-sans">
              "hoy les voy a contar cómo..."
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Baja retención visual (30% caída)</p>
          </div>
        ),
        afterSvg: (
          <div className="w-full h-28 bg-[#0e0e1c] rounded-lg p-2.5 flex flex-col justify-center items-center border border-cyan-500/30">
            <div className="bg-black/90 px-3 py-1.5 rounded-lg border border-purple-500/60 shadow-md">
              <span className="text-xs font-black text-white uppercase">HOY LES VOY A </span>
              <span className="text-xs font-black text-yellow-300 bg-purple-900/60 px-1 py-0.5 rounded border border-yellow-400/40 uppercase">
                CONTAR 🚀
              </span>
            </div>
            <p className="text-[10px] text-cyan-300 mt-2 font-bold">+85% Retención media de visualización</p>
          </div>
        ),
      },
    },
    {
      title: 'Traducción a 30+ idiomas',
      subtitle: 'Multiplica tu audiencia global con subtítulos y doblaje multi-idioma',
      description:
        'Traduce tus clips a inglés, portugués, alemán, francés, japonés y más de 30 idiomas con solo un clic. Adapta las frases coloquiales para conectar con audiencias de todo el planeta.',
      icon: Languages,
      tag: 'Alcance Global',
      beforeAfter: {
        beforeText: 'Contenido limitado únicamente a tu idioma local',
        afterText: 'Exportación en más de 30 idiomas simultáneos',
        beforeSvg: (
          <div className="w-full h-28 bg-[#090912] rounded-lg p-2.5 flex flex-col justify-center items-center border border-rose-950/30">
            <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold">
              <span>🇪🇸 Español únicamente</span>
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Audiencia potencial: 400M</p>
          </div>
        ),
        afterSvg: (
          <div className="w-full h-28 bg-[#0e0e1c] rounded-lg p-2.5 flex flex-col justify-center items-center border border-cyan-500/30">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {['🇺🇸 EN', '🇧🇷 PT', '🇫🇷 FR', '🇩🇪 DE', '🇯🇵 JA', '🇮🇹 IT'].map((lang, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/60 border border-purple-600/40 text-cyan-300"
                >
                  {lang}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-cyan-300 mt-2 font-bold">Audiencia potencial: +4.000 Millones</p>
          </div>
        ),
      },
    },
    {
      title: 'Títulos gancho y CTA por IA',
      subtitle: 'Hooks irresistibles generados para maximizar clics',
      description:
        'Genera automáticamente los primeros 3 segundos clave (títulos en pantalla, miniaturas sugeridas y textos de descripción con hashtags optimizados para el algoritmo de TikTok y YouTube).',
      icon: Flame,
      tag: 'Hooks de Conversión',
      beforeAfter: {
        beforeText: 'Títulos genéricos y descripciones vacías',
        afterText: 'Hooks con 95%+ CTR y llamadas a la acción virales',
        beforeSvg: (
          <div className="w-full h-28 bg-[#090912] rounded-lg p-2.5 flex flex-col justify-center border border-rose-950/30 text-left">
            <p className="text-[11px] text-slate-400 font-mono truncate">Episodio 12 del podcast.mp4</p>
            <p className="text-[10px] text-slate-600 mt-1">CTR estimado: 1.2%</p>
          </div>
        ),
        afterSvg: (
          <div className="w-full h-28 bg-[#0e0e1c] rounded-lg p-2.5 flex flex-col justify-center border border-cyan-500/30 text-left">
            <p className="text-[11px] font-extrabold text-white leading-tight">
              🔥 "3 Secretos que los Millonarios NUNCA te dirán"
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-purple-300">
              <span className="bg-purple-900/60 px-1.5 py-0.5 rounded font-bold">#shorts</span>
              <span className="bg-cyan-950 px-1.5 py-0.5 rounded text-cyan-400 font-bold">CTR: 14.8%</span>
            </div>
          </div>
        ),
      },
    },
    {
      title: 'Modo juego y deportes (B-Roll)',
      subtitle: 'Pantalla dividida con gameplay y B-Roll dinámico',
      description:
        'Detecta automáticamente momentos de máxima acción en streams de videojuegos o podcasts largos, insertando automáticamente B-Rolls y composiciones duales para mantener la dopamina al máximo.',
      icon: Gamepad2,
      tag: 'Gaming & B-Roll',
      beforeAfter: {
        beforeText: 'Pantalla fija monótona con caídas de retención',
        afterText: 'Layout interactivo con cámara + clips dinámicos sincronizados',
        beforeSvg: (
          <div className="w-full h-28 bg-[#090912] rounded-lg p-2 flex items-center justify-center border border-rose-950/30">
            <div className="w-20 h-20 bg-slate-900 rounded border border-slate-800 flex items-center justify-center text-[9px] text-slate-500 text-center">
              Cámara fija sin B-roll
            </div>
          </div>
        ),
        afterSvg: (
          <div className="w-full h-28 bg-[#0e0e1c] rounded-lg p-2 flex items-center justify-center border border-cyan-500/30">
            <div className="w-20 h-24 bg-[#121226] rounded border border-cyan-500/50 p-1 flex flex-col gap-1 shadow-md">
              <div className="h-10 bg-purple-900/40 rounded flex items-center justify-center text-[7px] text-purple-200 font-bold">
                Facecam Creador
              </div>
              <div className="flex-1 bg-cyan-950/50 rounded flex items-center justify-center text-[7px] text-cyan-300 font-bold">
                🎮 B-Roll Gameplay
              </div>
            </div>
          </div>
        ),
      },
    },
  ];

  return (
    <section
      ref={ref}
      id="funciones"
      className={`py-20 md:py-32 relative bg-[#0a0a12] transition-all duration-700 ${
        isVisible ? 'reveal-active' : 'reveal-init'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-xs font-bold text-cyan-300 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Herramientas Diseñadas para la Viralidad</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif] mb-4">
            Tecnología IA para dominar los{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400">
              algoritmos verticales
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            Cada función está calibrada matemáticamente para aumentar el tiempo de retención y disparar las recomendaciones orgánicas en redes.
          </p>
        </div>

        {/* 6 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const currentTab = activeCompareTab[index] || 'despues';

            return (
              <div
                key={feature.title}
                className="bg-[#0f0f1d]/90 backdrop-blur-md rounded-2xl p-6 border border-purple-900/40 hover:border-purple-600/60 shadow-xl shadow-black/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-700/50 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-900/30 text-purple-300 border border-purple-800/40">
                      {feature.tag}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-xl font-bold text-white mb-1.5 group-hover:text-cyan-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs font-semibold text-purple-300/90 mb-3">
                    {feature.subtitle}
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    {feature.description}
                  </p>
                </div>

                {/* Interactive Antes / Después SVG Section */}
                <div className="mt-auto pt-4 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Comparativa Visual:
                    </span>
                    <div className="flex bg-[#07070f] p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                      <button
                        onClick={() => toggleTab(index, 'antes')}
                        className={`px-2 py-1 rounded transition-all cursor-pointer ${
                          currentTab === 'antes'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Antes
                      </button>
                      <button
                        onClick={() => toggleTab(index, 'despues')}
                        className={`px-2 py-1 rounded transition-all cursor-pointer ${
                          currentTab === 'despues'
                            ? 'bg-purple-600/40 text-cyan-300 border border-purple-500/50'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Después (IA)
                      </button>
                    </div>
                  </div>

                  {/* Visual Render */}
                  <div className="transition-all duration-200">
                    {currentTab === 'despues' ? feature.beforeAfter.afterSvg : feature.beforeAfter.beforeSvg}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
