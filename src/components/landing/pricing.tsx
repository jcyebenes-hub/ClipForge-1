import React from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { Check, Sparkles, Zap, Flame, Crown, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { esAppDeTienda } from '../../lib/tienda';

interface PricingProps {
  onSelectPlan?: (planName: string) => void;
}

export const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.15 });
  const tienda = esAppDeTienda();

  const plans = [
    {
      name: 'Gratis',
      priceMonthly: 0,
      priceYearly: 0,
      description: 'Para empezar a crear Shorts sin pagar nada. Se procesa en tu propio ordenador, no en un servidor.',
      badge: '100% gratuito',
      isPopular: false,
      buttonText: 'Empezar gratis',
      buttonVariant: 'secondary',
      features: [
        'Procesado en tu propio navegador (tu CPU, no un servidor)',
        'Cortes automáticos en vertical 9:16',
        'Subtítulos automáticos en español',
        '7 estilos de subtítulos',
        'Ritmo acelerado, título arriba y limpieza de silencios',
        'Fondo desenfocado y pantalla partida',
        'Revisión de clips escribiendo una frase',
        'Traducción de subtítulos a 37 idiomas',
        'Vídeos virales de tu nicho y receta lista para crear',
        'Exportación en Full HD',
      ],
      missing: [
        'Marca de agua «ClipForge» en la esquina',
        '60 minutos de material al mes',
      ],
    },
    {
      name: 'Creador',
      priceMonthly: 3,
      priceYearly: 2.4, // 20% de descuento
      description: 'Para quien publica cada semana y quiere sacar los vídeos limpios, sin marca de agua.',
      badge: 'Más popular',
      isPopular: true,
      buttonText: 'Elegir plan Creador',
      buttonVariant: 'primary',
      features: [
        'TODO lo del plan Gratis',
        'SIN marca de agua',
        '300 minutos de material al mes (5 veces más)',
        '20 búsquedas de vídeos virales al día (el Gratis tiene 5)',
        'Cada función nueva, en cuanto se publica',
      ],
      missing: [],
    },
    {
      name: 'A medida',
      priceMonthly: -1,
      priceYearly: -1,
      description: '¿Llevas varios canales o una agencia? Dinos qué necesitas y lo ajustamos.',
      badge: 'Hablamos',
      isPopular: false,
      buttonText: 'Escríbenos',
      buttonVariant: 'secondary',
      features: [
        'Minutos adaptados a tu volumen real',
        'Varias cuentas y canales',
        'Factura a nombre de tu empresa',
      ],
      missing: [],
    },
  ];

  return (
    <section
      ref={ref}
      id="precios"
      className={`py-20 md:py-32 relative bg-[#07070f] border-t border-purple-950/30 transition-all duration-700 ${
        isVisible ? 'reveal-active' : 'reveal-init'
      }`}
    >
      {/* Background glow behind popular card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-purple-700/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800/50 text-xs font-bold text-purple-300 mb-4">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Precios Honestos y Transparentes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif] mb-4">
            Planes adaptados a tu ritmo de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400">
              creación de contenido
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            Empieza gratis y sin instalar nada: los vídeos se procesan en tu propio navegador. Pasa a Creador cuando quieras quitar la marca de agua.
          </p>
        </div>

          {/* 3 Pricing Cards Grid */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const price = plan.priceMonthly;

            return (
              <div
                key={plan.name}
                className={`relative rounded-3xl p-7 flex flex-col justify-between transition-all duration-300 ${
                  plan.isPopular
                    ? 'bg-gradient-to-b from-[#16132d] via-[#100f23] to-[#0c0c1a] border-2 border-purple-500 shadow-2xl shadow-purple-900/50 lg:-translate-y-3'
                    : 'bg-[#0e0e1a]/90 backdrop-blur-sm border border-purple-900/40 hover:border-slate-700'
                }`}
              >
                {/* Popular Pill */}
                {plan.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 text-white text-xs font-extrabold px-4 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>MÁS POPULAR</span>
                  </div>
                )}

                <div>
                  {/* Plan Top Meta */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-black text-white font-['Plus_Jakarta_Sans',sans-serif]">
                      {plan.name}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        plan.isPopular
                          ? 'bg-purple-900/60 text-cyan-300 border border-purple-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    {plan.description}
                  </p>

                  {/* Price Display */}
                  <div className="mb-6 pb-6 border-b border-slate-800/80 flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-black text-white font-['Plus_Jakarta_Sans',sans-serif]">
                      {price === 0 ? '0 €' : price < 0 ? 'A medida' : `${price} €`}
                    </span>
                    <span className="text-sm font-medium text-slate-400">
                      {price === 0 ? '/ siempre' : price < 0 ? '' : '/ mes'}
                    </span>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3 mb-8">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Incluye:
                    </p>
                    {plan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                        <div className="w-4 h-4 rounded-full bg-purple-900/60 border border-purple-500/50 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span className="leading-tight">{feat}</span>
                      </div>
                    ))}

                    {plan.missing.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-slate-500 line-through opacity-70">
                        <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
                          <span className="text-[10px]">•</span>
                        </div>
                        <span className="leading-tight">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card CTA Button */}
                <div>
                  <button
                    onClick={() => {
                      if (tienda && plan.name !== 'Gratis') return;
                      onSelectPlan?.(plan.name);
                    }}
                    className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                      plan.isPopular
                        ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-900/50 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-purple-500/50'
                    }`}
                  >
                    <span>{tienda && plan.name !== 'Gratis' ? 'No se cobra en la tienda' : plan.buttonText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mt-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>{tienda ? 'En la app de la tienda el plan es el gratis.' : 'Sin cobro automático. Si pagas, es a mano.'}</span>
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
