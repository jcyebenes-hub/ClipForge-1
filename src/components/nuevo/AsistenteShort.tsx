'use client';

import { useEffect, useState } from 'react';
import type { SubtitleStylePreset } from '../../lib/subtitulos';

/**
 * AsistenteShort
 *
 * Ventana de dos preguntas que sustituye a la fila de botones técnicos.
 * No ejecuta nada por su cuenta: devuelve la decisión y la página llama a los
 * mismos manejadores que ya existían (handleGenerarShortCompleto,
 * handleConvertToVertical, handleDownloadClip).
 */

export type ModoShort = 'short' | 'vertical' | 'horizontal';

export interface DecisionShort {
  modo: ModoShort;
  estilo?: SubtitleStylePreset;
}

interface ClipResumido {
  id: string;
  titulo_hook?: string;
  estilo_subtitulos?: string;
}

interface Props {
  clip: ClipResumido | null;
  onCerrar: () => void;
  onGenerar: (decision: DecisionShort) => void;
}

const ESTILOS: { id: SubtitleStylePreset; nombre: string; desc: string }[] = [
  { id: 'moderno', nombre: 'Moderno', desc: 'Blanco con relleno que va palabra a palabra. El más usado.' },
  { id: 'neon', nombre: 'Neón', desc: 'Colores vivos con borde marcado. Llama más la atención.' },
  { id: 'minimal', nombre: 'Minimal', desc: 'Discreto y limpio. No tapa el vídeo.' },
];

export function AsistenteShort({ clip, onCerrar, onGenerar }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [modo, setModo] = useState<ModoShort>('short');
  const [estilo, setEstilo] = useState<SubtitleStylePreset>('moderno');

  // Se reinicia cada vez que se abre para otro clip.
  useEffect(() => {
    if (clip) {
      setPaso(1);
      setModo('short');
      // Se respeta el estilo que el clip ya tuviera, si es uno de los tres conocidos.
      setEstilo(ESTILOS.find(e => e.id === clip.estilo_subtitulos)?.id ?? 'moderno');
    }
  }, [clip?.id]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!clip) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [clip, onCerrar]);

  if (!clip) return null;

  const avanzar = () => {
    if (modo === 'short') setPaso(2);
    else onGenerar({ modo });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Preparar el clip"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-purple-900/50 bg-[#0d0d1a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">
          Paso {paso} de 2
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">
          {paso === 1 ? '¿Cómo quieres el vídeo?' : '¿Qué estilo de subtítulos?'}
        </h2>
        {clip.titulo_hook ? (
          <p className="mt-1 truncate text-sm text-slate-400">{clip.titulo_hook}</p>
        ) : null}

        {paso === 1 ? (
          <div className="mt-5 flex flex-col gap-2.5">
            <Opcion
              activa={modo === 'short'}
              onClick={() => setModo('short')}
              titulo="Vertical con subtítulos"
              desc="9:16 con subtítulos quemados. Listo para TikTok, Reels y Shorts."
              etiqueta="Recomendado"
            />
            <Opcion
              activa={modo === 'vertical'}
              onClick={() => setModo('vertical')}
              titulo="Vertical sin subtítulos"
              desc="Solo el encuadre 9:16, sin texto encima."
            />
            <Opcion
              activa={modo === 'horizontal'}
              onClick={() => setModo('horizontal')}
              titulo="Horizontal tal cual"
              desc="Descarga el corte 16:9 original, sin cambios."
            />
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2.5">
            {ESTILOS.map((e) => (
              <Opcion
                key={e.id}
                activa={estilo === e.id}
                onClick={() => setEstilo(e.id)}
                titulo={e.nombre}
                desc={e.desc}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={onCerrar}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white cursor-pointer"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            {paso === 2 ? (
              <button
                onClick={() => setPaso(1)}
                className="rounded-xl border border-purple-800/50 px-4 py-2 text-sm font-semibold text-purple-300 transition hover:bg-purple-900/30 cursor-pointer"
              >
                Atrás
              </button>
            ) : null}
            <button
              onClick={paso === 1 ? avanzar : () => onGenerar({ modo, estilo })}
              className="rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow transition hover:from-pink-500 hover:to-indigo-500 cursor-pointer"
            >
              {paso === 1 && modo !== 'short' ? 'Continuar' : paso === 1 ? 'Siguiente' : 'Generar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Opcion({ activa, onClick, titulo, desc, etiqueta }: {
  activa: boolean;
  onClick: () => void;
  titulo: string;
  desc: string;
  etiqueta?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition cursor-pointer ${
        activa
          ? 'border-purple-500 bg-purple-900/25'
          : 'border-purple-900/40 bg-[#12121f] hover:border-purple-700/60'
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          activa ? 'border-purple-400 bg-purple-500' : 'border-slate-600'
        }`}
      >
        {activa ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{titulo}</span>
          {etiqueta ? (
            <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              {etiqueta}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-slate-400">{desc}</span>
      </span>
    </button>
  );
}

export default AsistenteShort;
