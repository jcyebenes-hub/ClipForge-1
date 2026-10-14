import React, { useEffect, useRef } from 'react';
import type { LineaBitacora } from '../../lib/bitacoraAnalisis';

interface Props {
  youtubeId?: string | null;
  videoUrl?: string | null;
  trabajando: boolean;
  etapa: string;
  porcentaje: number;
  lineas: LineaBitacora[];
}

/**
 * El vídeo sigue en marcha y, debajo, se escribe lo que la app está haciendo.
 * La idea es la de OpenShorts: ver el material mientras se analiza.
 * El texto solo sale de pasos reales, no de telemetría inventada.
 */
export const AnalisisEnVivo: React.FC<Props> = ({
  youtubeId,
  videoUrl,
  trabajando,
  etapa,
  porcentaje,
  lineas,
}) => {
  const fondo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: 'smooth' });
  }, [lineas.length]);

  const etapas = ['Preparar', 'Subtítulos', 'Momentos', 'Listo'];
  const indice =
    porcentaje >= 100 ? 3 :
    porcentaje >= 55 ? 2 :
    porcentaje >= 15 ? 1 : 0;

  return (
    <section className="rounded-2xl border border-cyan-800/40 bg-[#0e0e1a] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cyan-900/40">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
          {trabajando ? 'Analizando en vivo' : 'Análisis'}
        </p>
        <span className="font-mono text-sm font-black text-cyan-200">{Math.min(100, Math.max(0, porcentaje))}%</span>
      </div>

      <div className="relative aspect-video bg-black">
        {youtubeId ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&modestbranding=1&rel=0&playsinline=1`}
            title="Vídeo que se está analizando"
            allow="autoplay; encrypted-media; picture-in-picture"
          />
        ) : videoUrl ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            controls
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            Esperando el vídeo…
          </div>
        )}
        {trabajando && (
          <div
            className="pointer-events-none absolute left-0 right-0 h-0.5 bg-cyan-300 shadow-[0_0_12px_2px_rgba(34,211,238,0.8)]"
            style={{ animation: 'cf-scan 2.6s linear infinite' }}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3">
        {etapas.map((nombre, i) => (
          <span
            key={nombre}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              i === indice
                ? 'bg-cyan-400 text-black'
                : i < indice
                  ? 'bg-emerald-950 text-emerald-300'
                  : 'bg-slate-800 text-slate-500'
            }`}
          >
            {nombre}
          </span>
        ))}
      </div>

      <p className="px-4 text-sm font-semibold text-white">{etapa || 'Preparando…'}</p>
      <div className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }}
        />
      </div>

      <div ref={fondo} className="mx-4 mb-4 mt-3 max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
        {lineas.length === 0 ? (
          <p className="text-slate-500">Aquí irán apareciendo los pasos, uno a uno.</p>
        ) : (
          lineas.map((linea, i) => (
            <p key={`${linea.hora}-${i}`} className="break-words">
              <span className="text-slate-500">{linea.hora}</span> {linea.texto}
            </p>
          ))
        )}
        {trabajando && <p className="animate-pulse text-cyan-300">_</p>}
      </div>
      <style>{`@keyframes cf-scan { from { top: 0; } to { top: 100%; } }`}</style>
    </section>
  );
};
