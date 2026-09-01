import React, { useState } from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { Check, Sparkles, Zap, Flame, Crown, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

interface PricingProps {
  onSelectPlan?: (planName: string) => void;
}

export const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.15 });
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'Gratis',
      priceMonthly: 0,
      priceYearly: 0,
      description: 'Ideal para creadores que están empezando y quieren probar el poder de la IA sin coste.',
      badge: '100% Gratuito',
      isPopular: false,
      buttonText: 'Empezar gratis ya',
      buttonVariant: 'secondary',
      features: [
        'Procesado ilimitado en tu propio navegador',
        'Hasta 1080p Full HD de exportación',
        'Detección automática de momentos virales',
        'Subtítulos automáticos Whisper (Español)',
        'Auto-encuadre facial 9:16',
        'Marca de agua pequeña y discreta opcional',
      ],
      missing: [
        'Sin publicación automática multicanal',
        'Sin soporte de doblaje y traducción 30+ idiomas',
        'Sin renderizado prioritario en la nube',
      ],
    },
    {
      name: 'Creador',
      priceMonthly: 3,
      priceYearly: 2.4, // 20% discount
      description: 'El plan favorito de YouTubers, podcasters y tiktokers que publican contenido semanal.',
      badge: 'Más popular',
      isPopular: true,
      buttonText: 'Elegir plan Creador',
      buttonVariant: 'primary',
      features: [
        'TODO lo del plan Gratis',
        'SIN marca de agua de ningún tipo',
        'Publicación automática en TikTok, Shorts y Reels',
        'Plantillas de subtítulos tipo MrBeast / Hormozi',
        'Generador de hooks y descripciones SEO',
        'Exportación ultra-rápida con aceleración GPU',
        'Soporte prioritario por chat',
      ],
      missing: [],
    },
    {
      name: 'Pro',
      priceMonthly: 8,
      priceYearly: 6.4,
      description: 'Para agencias, canales en rápido crecimiento y creadores con múltiples marcas.',
      badge: 'Automatización Total',
      isPopular: false,
      buttonText: 'Elegir plan Pro',
      buttonVariant: 'secondary',
      features: [
        'TODO lo del plan Creador',
        'Automatización total de canal (Auto-post 24/7)',
        'Traducción y doblaje a más de 30 idiomas',
        'Renderizado cloud prioritario en servidores dedicados',
        'Modo gaming y B-Roll automático ilimitado',
        'Acceso a API y webhooks para integraciones',
        'Gestión de hasta 10 canales y cuentas sociales',
        'Manager de cuenta dedicado',
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
            Comienza gratis para siempre con procesado en tu propio navegador o desbloquea publicación automática por solo 3 €/mes.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-[#111122] p-1.5 rounded-2xl border border-purple-900/50 shadow-inner">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pago Mensual
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Pago Anual</span>
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-extrabold">
                -20% AHORRO
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

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
                      {price === 0 ? '0 €' : `${price} €`}
                    </span>
                    <span className="text-sm font-medium text-slate-400">
                      {price === 0 ? '/ siempre' : '/ mes'}
                    </span>
                    {billingCycle === 'yearly' && price > 0 && (
                      <span className="text-[11px] text-cyan-400 font-semibold ml-1">
                        (facturado anualmente)
                      </span>
                    )}
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
                    onClick={() => onSelectPlan?.(plan.name)}
                    className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                      plan.isPopular
                        ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-900/50 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-purple-500/50'
                    }`}
                  >
                    <span>{plan.buttonText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mt-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sin permanencia • Cancela cuando quieras</span>
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
