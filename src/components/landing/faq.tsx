import React, { useState } from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { ChevronDown, HelpCircle, AlertCircle, Shield, Cpu, Sparkles, Video, Share2 } from 'lucide-react';

export const Faq: React.FC = () => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.15 });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  const faqItems = [
    {
      question: '¿Es gratis de verdad?',
      icon: Sparkles,
      answer:
        'Sí, 100% real. El plan Gratis de ClipForge te permite procesar y generar clips ilimitados utilizando los recursos de tu propio navegador web mediante aceleración WebAssembly y modelos locales optimizados. No te pediremos tarjeta de crédito para empezar a crear clips y descargarlos.',
    },
    {
      question: '¿Dónde se procesan los vídeos?',
      icon: Cpu,
      answer:
        'En el plan gratuito, el análisis de audio, detección de caras y renderizado se realiza localmente en tu propio dispositivo a través de tu navegador, garantizando máxima privacidad (tus vídeos no se quedan almacenados en ningún servidor). En los planes Creador y Pro, puedes optar por renderizado ultrarrápido en nuestros clusters de GPU en la nube para procesar vídeos de varias horas en pocos segundos.',
    },
    {
      question: '¿Qué idiomas soporta?',
      icon: HelpCircle,
      answer:
        'ClipForge cuenta con soporte completo de transcripción y subtitulado en más de 30 idiomas gracias a la tecnología OpenAI Whisper integrada (español, inglés, portugués, francés, alemán, italiano, japonés, coreano, entre otros). Además, detecta automáticamente el idioma hablado sin que tengas que configurarlo manualmente.',
    },
    {
      question: '¿Necesito experiencia en edición?',
      icon: Video,
      answer:
        'Absolutamente ninguna. ClipForge está diseñado para que cualquier persona pueda convertir un podcast, entrevista o gameplay en un clip viral en menos de 2 minutos. Solo tienes que pegar el enlace de YouTube o arrastrar el archivo de vídeo; la IA detecta los ganchos, centra el encuadre en 9:16 y genera los subtítulos dinámicos de forma automática.',
    },
    {
      question: '¿Puedo publicar automáticamente?',
      icon: Share2,
      answer:
        'Sí. Con los planes Creador y Pro puedes conectar tus cuentas oficiales de TikTok, YouTube Shorts e Instagram Reels para programar o publicar tus clips directamente con un solo clic, incluyendo títulos sugeridos, descripciones y hashtags optimizados para cada algoritmo.',
    },
    {
      question: '¿Qué pasa con los derechos de autor?',
      icon: Shield,
      isWarning: true,
      answer:
        'Somos totalmente transparentes y honestos: solo debes procesar y republicar contenido del cual seas el autor original, tengas autorización expresa del propietario o cuentes con una licencia de uso legítimo (Fair Use / Creative Commons). ClipForge es una herramienta de productividad y edición con IA, por lo que no nos hacemos responsables de infracciones de derechos de autor cometidas por los usuarios. Te recomendamos siempre crear contenido propio o con los debidos permisos.',
    },
  ];

  return (
    <section
      ref={ref}
      id="faq"
      className={`py-20 md:py-32 relative bg-[#0a0a14] transition-all duration-700 ${
        isVisible ? 'reveal-active' : 'reveal-init'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/70 border border-purple-800/40 text-xs font-bold text-purple-300 mb-4">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Preguntas Frecuentes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif] mb-4">
            Todo lo que necesitas saber sobre{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400">
              ClipForge
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            Respuestas claras, sin letras pequeñas ni tecnicismos confusos.
          </p>
        </div>

        {/* Accordion Container */}
        <div className="space-y-4">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            const Icon = item.icon;

            return (
              <div
                key={item.question}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'bg-[#121224] border-purple-500/60 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500/30'
                    : 'bg-[#0e0e1a]/80 border-purple-900/30 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 focus:outline-none cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        item.isWarning
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                          : isOpen
                          ? 'bg-purple-900/60 text-cyan-300 border border-purple-600/40'
                          : 'bg-slate-800/60 text-slate-400 border border-slate-700/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-base sm:text-lg font-bold font-['Plus_Jakarta_Sans',sans-serif] ${
                        isOpen ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {item.question}
                    </span>
                  </div>

                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center bg-slate-800/60 text-slate-400 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 bg-purple-600/30 text-cyan-300' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-slate-300 leading-relaxed border-t border-purple-900/20 animate-in fade-in duration-200">
                    <p>{item.answer}</p>
                    {item.isWarning && (
                      <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200/90">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>Recuerda dar siempre los créditos pertinentes a los creadores de contenido originales.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
