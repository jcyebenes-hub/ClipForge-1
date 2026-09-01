import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Sparkles, 
  Lock, 
  CheckCircle2, 
  X, 
  HardDrive, 
  UploadCloud, 
  FileVideo,
  ArrowRight
} from 'lucide-react';

interface ComoSeProcesaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComoSeProcesaModal: React.FC<ComoSeProcesaModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-[#0f0f1c] border border-purple-800/50 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Arquitectura de Privacidad Cero-Conocimiento</span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white font-['Plus_Jakarta_Sans',sans-serif]">
              ¿Cómo se procesa tu vídeo?
            </h2>
          </div>
        </div>

        {/* Subtitle Banner */}
        <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-xs text-purple-200 my-4 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-white font-semibold">Tu vídeo crudo NUNCA se sube a servidores externos.</strong> El recorte, reencuadre vertical 9:16 y los subtítulos se generan al 100% de forma local en tu navegador utilizando <strong>WebAssembly (FFmpeg WASM)</strong>.
          </p>
        </div>

        {/* 4 Steps Timeline */}
        <div className="space-y-3.5 my-5">
          {/* Paso 1 */}
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#141426] border border-purple-900/30">
            <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
              1
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                <span>Extracción de Audio en tu Dispositivo</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tu navegador extrae únicamente una pista de audio comprimida mediante la API nativa Web Audio, sin enviar los gigabytes de vídeo.
              </p>
            </div>
          </div>

          {/* Paso 2 */}
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#141426] border border-purple-900/30">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-400 font-bold text-xs shrink-0">
              2
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Transcripción y Detección de Ganchos Virales</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                La IA (Whisper v3 + Llama 3.3) procesa el audio transcrito para identificar hooks de alto impacto y generar los subtítulos palabra por palabra.
              </p>
            </div>
          </div>

          {/* Paso 3 */}
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#141426] border border-purple-900/30">
            <div className="w-8 h-8 rounded-xl bg-pink-950/80 border border-pink-700/50 flex items-center justify-center text-pink-400 font-bold text-xs shrink-0">
              3
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-pink-400" />
                <span>Renderizado Local con FFmpeg WebAssembly</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tu CPU y GPU procesan el recorte a 1080x1920 y queman los subtítulos animados en cuestión de segundos, sin costes de nube.
              </p>
            </div>
          </div>

          {/* Paso 4 */}
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#141426] border border-purple-900/30">
            <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
              4
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Solo se Sube el Clip Final Procesado</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Únicamente el clip vertical optimizado de 30-60 segundos se almacena para que puedas descargarlo o publicarlo automáticamente en YouTube, TikTok o Reels.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>100% Gratuito y Privado</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer shadow-md shadow-purple-950/50"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
