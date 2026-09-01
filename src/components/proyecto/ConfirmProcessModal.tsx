import React from 'react';
import { Cpu, Zap, Clock, ShieldCheck, X, Sparkles, AlertCircle } from 'lucide-react';

interface ConfirmProcessModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  duracionSeg?: number;
  estiloSubtitulos?: string;
  isProcessing?: boolean;
}

export const ConfirmProcessModal: React.FC<ConfirmProcessModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  duracionSeg = 30,
  estiloSubtitulos = 'Hormozi',
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  // Estimation based on clip length
  const tiempoEstimado = duracionSeg <= 30 ? '~30-60 seg' : duracionSeg <= 60 ? '~1-2 min' : '~2-3 min';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0f0f1c] border border-purple-800/60 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow behind */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close */}
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30 text-white">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">WebAssembly Client-Side</span>
            <h2 className="text-lg sm:text-xl font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
              ¿Procesar en tu navegador?
            </h2>
          </div>
        </div>

        {/* Estimation pill */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/40 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-300 font-medium">Tiempo estimado:</span>
          </div>
          <span className="text-xs font-bold text-purple-300 bg-purple-900/60 px-2.5 py-1 rounded-lg border border-purple-700/50">
            {tiempoEstimado}
          </span>
        </div>

        {/* Details list */}
        <div className="space-y-2.5 text-xs text-slate-300 mb-6">
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#141424]">
            <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-semibold">Aceleración por Hardware Local</strong>
              <p className="text-[11px] text-slate-400">Utiliza los núcleos de tu procesador y GPU para renderizar vídeo 1080x1920 9:16 a 30fps sin consumir servidores.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#141424]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-semibold">100% Seguro y Privado</strong>
              <p className="text-[11px] text-slate-400">El vídeo fuente original nunca abandona tu dispositivo. No cierres esta pestaña durante el render.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            id="btn-confirm-start-process"
            onClick={onConfirm}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-lg shadow-purple-950/60 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Iniciar procesamiento</span>
          </button>
        </div>
      </div>
    </div>
  );
};
