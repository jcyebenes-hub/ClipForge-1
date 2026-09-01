import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Lock, ExternalLink } from 'lucide-react';

interface CopyrightNoticeModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  videoUrl?: string;
}

const STORAGE_KEY_COPYRIGHT_ACCEPTED = 'clipforge_copyright_terms_accepted';

export function hasAcceptedCopyrightNotice(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_COPYRIGHT_ACCEPTED) === 'true';
}

export function markCopyrightNoticeAccepted(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_COPYRIGHT_ACCEPTED, 'true');
}

export const CopyrightNoticeModal: React.FC<CopyrightNoticeModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  videoUrl,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [rememberPreference, setRememberPreference] = useState(true);

  if (!isOpen) return null;

  const handleAccept = () => {
    if (!isChecked) return;

    if (rememberPreference) {
      markCopyrightNoticeAccepted();
    }

    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0e0e18] border border-purple-800/50 rounded-2xl p-6 md:p-7 shadow-2xl shadow-purple-950/80 space-y-6 text-slate-100">
        {/* Header with Shield Icon */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Aviso de Derechos de Autor</span>
            </h3>
            <p className="text-xs text-slate-400">
              Verificación de titularidad y uso legítimo de contenidos.
            </p>
          </div>
        </div>

        {/* Informative Box */}
        <div className="bg-[#141424] border border-slate-800 rounded-xl p-4 space-y-3 text-xs leading-relaxed text-slate-300">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Condiciones obligatorias para importar por URL:</span>
          </div>

          <ul className="list-disc list-inside space-y-1.5 text-slate-300 pl-1">
            <li>
              Debes ser el <strong>propietario legal</strong> del canal o vídeo, o contar con <strong>autorización expresa</strong> de los titulares para crear clips derivados.
            </li>
            <li>
              No utilices este servicio para monetizar o republicar contenido ajeno sin consentimiento (respeto a la DMCA y normativas de copyright).
            </li>
            <li>
              El usuario es el único responsable legal del material importado y su posterior distribución.
            </li>
          </ul>

          {videoUrl && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400 truncate">
              <span className="text-purple-400 font-bold">URL a importar:</span>
              <span className="truncate text-slate-300">{videoUrl}</span>
            </div>
          )}
        </div>

        {/* Required Confirmation Checkboxes */}
        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 p-3 bg-purple-950/20 border border-purple-800/30 rounded-xl cursor-pointer hover:bg-purple-950/30 transition-colors">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-purple-500 text-purple-600 focus:ring-purple-500/50 bg-slate-900 cursor-pointer"
            />
            <span className="text-xs text-slate-200 leading-snug select-none">
              <strong>Confirmo</strong> que poseo los derechos necesarios o autorización sobre este contenido audiovisual para generar y exportar clips.
            </span>
          </label>

          <label className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberPreference}
              onChange={(e) => setRememberPreference(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500/50 bg-slate-900 cursor-pointer"
            />
            <span className="select-none">Recordar mi confirmación en este dispositivo para futuras importaciones</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!isChecked}
            onClick={handleAccept}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              isChecked
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-950/60 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar y Continuar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
