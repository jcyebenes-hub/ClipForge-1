'use client';

import { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Crop,
  Subtitles,
  Clapperboard,
  Share2,
  Sparkles,
  Download,
  Copy,
  Youtube,
  Music,
  Smartphone,
  UserCheck,
  Activity,
  Target,
  Columns2,
  Layers,
  Wand2,
} from 'lucide-react';
import { SUBTITLE_STYLES, type SubtitleStylePreset } from '../../lib/subtitulos';
import type { TipoEnfoque } from '../../lib/encuadre';

export interface ClipResumen {
  id: string;
  titulo_hook: string;
  duracion_seg: number;
  puntuacion_viral?: number;
  estado?: string;
  enfoque?: TipoEnfoque;
  estilo_subtitulos?: SubtitleStylePreset;
  video_short_url?: string;
  video_vertical_url?: string;
  preview_url?: string;
  short_estado?: string;
  vertical_estado?: string;
  cta?: string;
}

export interface AccionesEspacio {
  setEnfoque: (e: TipoEnfoque) => void;
  sugerir: () => void;
  setSplit: (v: boolean) => void;
  setFondo: (v: boolean) => void;
  split: boolean;
  fondo: boolean;
  generar: (estilo: SubtitleStylePreset) => void;
  vertical: () => void;
  descargar: () => void;
  copiar: () => void;
  youtube: () => void;
  tiktok: () => void;
}

interface Props {
  clip: ClipResumen;
  onClose: () => void;
  acciones: AccionesEspacio;
}

const PASOS = [
  { id: 1, nombre: 'Encuadre', Icono: Crop },
  { id: 2, nombre: 'Subtítulos', Icono: Subtitles },
  { id: 3, nombre: 'Generar y ver', Icono: Clapperboard },
  { id: 4, nombre: 'Publicar', Icono: Share2 },
] as const;

/**
 * Asistente a pantalla completa que guía la creación del short paso a paso,
 * en lugar de mostrar todas las opciones a la vez en la tarjeta. Es aditivo:
 * la tarjeta de la lista sigue funcionando igual.
 */
export function EspacioDeTrabajoShort({ clip, onClose, acciones }: Props) {
  const [paso, setPaso] = useState(1);
  const [estilo, setEstilo] = useState<SubtitleStylePreset>(clip.estilo_subtitulos || 'moderno');

  const irA = (n: number) => setPaso(Math.min(4, Math.max(1, n)));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-purple-800/50 bg-[#0d0d1b] shadow-2xl flex flex-col">
        {/* Cabecera: título + pasos + cerrar */}
        <div className="p-4 border-b border-purple-900/40">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-purple-300 font-bold">Asistente de Short</p>
              <h3 className="text-sm font-bold text-white truncate">{clip.titulo_hook}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 cursor-pointer shrink-0"
              aria-label="Cerrar asistente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {PASOS.map(({ id, nombre, Icono }) => (
              <button
                key={id}
                type="button"
                onClick={() => irA(id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition cursor-pointer ${
                  paso === id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-[#15152a] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icono className="w-3.5 h-3.5" />
                <span className="truncate">{nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="p-4 sm:p-5 flex-1">
          {paso === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Elige cómo recortar el 9:16, o deja que la app lo decida.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    { e: 'deportes' as TipoEnfoque, nombre: 'Deportes', Icono: Activity },
                    { e: 'centrado' as TipoEnfoque, nombre: 'Centrado', Icono: Target },
                  ] as const
                ).map(({ e, nombre, Icono }) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => acciones.setEnfoque(e)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold cursor-pointer ${
                      (clip.enfoque || 'centrado') === e
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-[#15152a] border-purple-900/40 text-slate-300 hover:bg-purple-950/40'
                    }`}
                  >
                    <Icono className="w-4 h-4" />
                    {nombre}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => acciones.setSplit(!acciones.split)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold cursor-pointer ${
                    acciones.split
                      ? 'bg-pink-600 border-pink-500 text-white'
                      : 'bg-[#15152a] border-purple-900/40 text-slate-300'
                  }`}
                >
                  <Columns2 className="w-4 h-4" />
                  Split 2 personas
                </button>
                <button
                  type="button"
                  onClick={() => acciones.setFondo(!acciones.fondo)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold cursor-pointer ${
                    acciones.fondo
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-[#15152a] border-purple-900/40 text-slate-300'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Fondo desenfocado
                </button>
              </div>
              <button
                type="button"
                onClick={acciones.sugerir}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700/60 bg-cyan-950/40 px-3 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/40 cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                Sugerir encuadre automáticamente
              </button>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Elige el estilo de los subtítulos quemados.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(SUBTITLE_STYLES) as SubtitleStylePreset[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEstilo(k)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold cursor-pointer ${
                      estilo === k
                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 border-pink-500 text-white'
                        : 'bg-[#15152a] border-purple-900/40 text-slate-300 hover:bg-pink-950/30'
                    }`}
                  >
                    {SUBTITLE_STYLES[k].label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">{SUBTITLE_STYLES[estilo].description}</p>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => acciones.generar(estilo)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  Generar Short Completo
                </button>
                <button
                  type="button"
                  onClick={acciones.vertical}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a1a36] border border-cyan-800/40 px-4 py-3 text-xs font-semibold text-cyan-300 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  Solo vertical
                </button>
              </div>

              {clip.video_short_url ? (
                <div className="aspect-[9/16] max-h-[300px] mx-auto bg-black rounded-xl overflow-hidden border-2 border-pink-500/60">
                  <video src={clip.video_short_url} controls playsInline className="w-full h-full object-contain" />
                </div>
              ) : clip.video_vertical_url ? (
                <div className="aspect-[9/16] max-h-[300px] mx-auto bg-black rounded-xl overflow-hidden border-2 border-cyan-500/50">
                  <video src={clip.video_vertical_url} controls playsInline className="w-full h-full object-contain" />
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">
                  Aún no hay resultado. Pulsa «Generar Short Completo» y vuelve aquí para verlo.
                </p>
              )}
            </div>
          )}

          {paso === 4 && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={acciones.descargar}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-950 border border-emerald-700/50 px-3 py-3 text-xs font-bold text-emerald-300 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Descargar MP4
              </button>
              <button
                type="button"
                onClick={acciones.copiar}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a1a36] border border-purple-900/40 px-3 py-3 text-xs font-bold text-slate-300 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                Copiar enlace
              </button>
              <button
                type="button"
                onClick={acciones.youtube}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-3 text-xs font-black text-white cursor-pointer"
              >
                <Youtube className="w-4 h-4 fill-white" />
                Subir a YouTube
              </button>
              <button
                type="button"
                onClick={acciones.tiktok}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#141428] border border-cyan-900/40 px-3 py-3 text-xs font-bold text-cyan-300 cursor-pointer"
              >
                <Music className="w-4 h-4" />
                Exportar a TikTok
              </button>
              {clip.cta && (
                <p className="col-span-2 text-[11px] text-slate-400">
                  CTA sugerido: <strong className="text-pink-300">“{clip.cta}”</strong>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navegación inferior */}
        <div className="p-4 border-t border-purple-900/40 flex items-center justify-between">
          <button
            type="button"
            onClick={() => irA(paso - 1)}
            disabled={paso === 1}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-purple-950/40 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
          <span className="text-[11px] text-slate-500">Paso {paso} de 4</span>
          <button
            type="button"
            onClick={() => irA(paso + 1)}
            disabled={paso === 4}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-purple-950/40 disabled:opacity-40 cursor-pointer"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default EspacioDeTrabajoShort;
