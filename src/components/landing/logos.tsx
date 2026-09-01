import React from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { Radio, Video, Zap, Compass, Cpu, Layers, Disc3 } from 'lucide-react';

export const Logos: React.FC = () => {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });

  const logos = [
    { name: 'StreamPeak Studio', icon: Zap },
    { name: 'HyperPod Media', icon: Radio },
    { name: 'NovaCast Network', icon: Disc3 },
    { name: 'VidMatrix Pro', icon: Video },
    { name: 'PulseCast AI', icon: Cpu },
    { name: 'OmniMedia Lab', icon: Layers },
    { name: 'Vortex Creators', icon: Compass },
  ];

  return (
    <section
      ref={ref}
      id="logos"
      className={`py-12 border-y border-purple-950/40 bg-[#080811] transition-all duration-700 ${
        isVisible ? 'reveal-active' : 'reveal-init'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-8">
          Utilizado por más de 50.000 creadores, podcasters y agencias en todo el mundo
        </p>

        {/* Logos Flex Grid */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 md:gap-16 opacity-70 hover:opacity-100 transition-opacity">
          {logos.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors duration-200"
              >
                <Icon className="w-5 h-5 text-slate-500" />
                <span className="font-bold text-sm sm:text-base tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
