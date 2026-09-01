import React from 'react';
import { 
  Play, 
  Youtube, 
  FileVideo, 
  Clock, 
  Calendar, 
  Sparkles, 
  MoreVertical, 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  Layers, 
  ArrowUpRight 
} from 'lucide-react';
import type { Proyecto } from '../../lib/supabase/types';

interface TarjetaProyectoProps {
  proyecto: Proyecto;
  onSelect?: (proyecto: Proyecto) => void;
  onDelete?: (id: string) => void;
  clipsCount?: number;
}

export const TarjetaProyecto: React.FC<TarjetaProyectoProps> = ({
  proyecto,
  onSelect,
  onDelete,
  clipsCount = 0,
}) => {
  const getEstadoBadge = (estado: Proyecto['estado']) => {
    switch (estado) {
      case 'clips_listos':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-950/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Clips Listos
          </span>
        );
      case 'analizado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            Analizado
          </span>
        );
      case 'transcrito':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            Transcrito
          </span>
        );
      case 'importando':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            Importando...
          </span>
        );
      case 'exportado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
            Exportado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/50">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Nuevo
          </span>
        );
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      id={`proyecto-card-${proyecto.id}`}
      className="group relative bg-[#131322] hover:bg-[#18182b] border border-purple-900/30 hover:border-purple-600/50 rounded-2xl p-5 transition-all duration-200 shadow-lg shadow-black/40 hover:shadow-purple-950/20 flex flex-col justify-between"
    >
      <div>
        {/* Top bar: Source icon + Status badge */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            {proyecto.url_youtube ? (
              <div className="w-8 h-8 rounded-lg bg-red-950/50 border border-red-800/40 flex items-center justify-center text-red-400">
                <Youtube className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                <FileVideo className="w-4 h-4" />
              </div>
            )}
            <span className="text-xs text-slate-400 font-medium truncate max-w-[140px]">
              {proyecto.url_youtube ? 'YouTube' : proyecto.archivo_nombre || 'Archivo local'}
            </span>
          </div>

          {getEstadoBadge(proyecto.estado)}
        </div>

        {/* Project Title */}
        <h3 className="font-bold text-white text-base leading-snug line-clamp-2 mb-2 group-hover:text-purple-300 transition-colors">
          {proyecto.titulo}
        </h3>

        {/* Meta details */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2 mb-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatDuration(proyecto.duracion_seg)}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatDate(proyecto.creado_en)}</span>
          </div>
          {clipsCount > 0 && (
            <>
              <div className="w-1 h-1 rounded-full bg-slate-700" />
              <div className="flex items-center gap-1 text-cyan-400 font-medium">
                <Layers className="w-3.5 h-3.5" />
                <span>{clipsCount} clips</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between mt-auto">
        <button
          onClick={() => onSelect?.(proyecto)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-cyan-300 transition-colors cursor-pointer group/btn"
        >
          <span>Ver clips generados</span>
          <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </button>

        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('¿Estás seguro de que deseas eliminar este proyecto?')) {
                  onDelete(proyecto.id);
                }
              }}
              title="Eliminar proyecto"
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default TarjetaProyecto;
