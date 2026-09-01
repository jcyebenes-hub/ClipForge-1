import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Smartphone,
  ExternalLink,
  X,
  FileText,
  Video,
  Share2,
  BookmarkCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ExportTikTokModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: {
    id: string;
    titulo_hook: string;
    video_short_url?: string;
    video_vertical_url?: string;
    preview_url?: string;
    descripcion?: string;
    hashtags?: string[];
    duracion_seg?: number;
  };
  onSavedToDrafts?: () => void;
}

export const ExportTikTokModal: React.FC<ExportTikTokModalProps> = ({
  isOpen,
  onClose,
  clip,
  onSavedToDrafts,
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const videoUrl = clip.video_short_url || clip.video_vertical_url || clip.preview_url || '';
  const tagsList = clip.hashtags && clip.hashtags.length > 0 
    ? clip.hashtags.map(t => t.startsWith('#') ? t : `#${t}`)
    : ['#fyp', '#parati', '#viral', '#edicion', '#clips'];

  const fullCaption = `${clip.titulo_hook}\n\n${clip.descripcion || 'Descubre los mejores momentos y consejos virales.'}\n\n${tagsList.join(' ')}`;

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(fullCaption);
    setCopiedText(true);
    toast.success('¡Texto y hashtags copiados para TikTok!');
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleDownloadVideo = async () => {
    if (!videoUrl) {
      toast.error('No hay vídeo disponible para descargar');
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tiktok-short-${clip.titulo_hook.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('¡Vídeo descargado en alta calidad 9:16!');
    } catch (e: any) {
      toast.error('Error al descargar el vídeo');
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveDraft = () => {
    // Save to local drafts
    const existing = JSON.parse(localStorage.getItem('clipforge_pending_drafts') || '[]');
    const draftItem = {
      id: `draft-${Date.now()}`,
      clip_id: clip.id,
      plataforma: 'tiktok',
      titulo: clip.titulo_hook,
      caption: fullCaption,
      video_url: videoUrl,
      created_at: new Date().toISOString(),
      estado: 'borrador_manual',
    };
    localStorage.setItem('clipforge_pending_drafts', JSON.stringify([draftItem, ...existing]));
    setIsSaved(true);
    toast.success('Guardado en "Borradores pendientes" para subirlo cuando quieras');
    onSavedToDrafts?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#10101c] border border-cyan-500/30 rounded-3xl w-full max-w-lg shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cyan-900/30 bg-gradient-to-r from-cyan-950/50 via-[#14142b] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-pink-500 flex items-center justify-center text-black font-black text-lg shadow-lg">
              ♪
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Exportar para TikTok</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  1 Minuto
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Paquete listo: Vídeo vertical + Copiar descripción con hashtags
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          
          {/* Quick Steps Guide */}
          <div className="p-3.5 rounded-2xl bg-[#141428] border border-cyan-900/40 space-y-2">
            <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>Cómo publicarlo en TikTok en 3 pasos:</span>
            </div>
            <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
              <li><strong className="text-white">Descarga el vídeo</strong> en tu dispositivo o envíatelo al móvil.</li>
              <li>Pulsa <strong className="text-white">"Copiar texto y tags"</strong>.</li>
              <li>Abre TikTok, toca <strong className="text-white">+</strong>, selecciona el vídeo y pega el texto. ¡Listo!</li>
            </ol>
          </div>

          {/* Video Preview & Download */}
          <div className="p-3.5 rounded-2xl bg-[#0d0d17] border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950 flex items-center justify-center text-cyan-400 border border-cyan-900">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block max-w-[200px] truncate">{clip.titulo_hook}</span>
                <span className="text-[11px] text-slate-400 font-mono">Formato 9:16 • {clip.duracion_seg?.toFixed(0) || '30'}s</span>
              </div>
            </div>
            <button
              onClick={handleDownloadVideo}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs shadow-md shadow-cyan-950 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Descargando...' : 'Descargar MP4'}</span>
            </button>
          </div>

          {/* Caption & Hashtags Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Descripción y Hashtags optimizados</span>
              </label>
              <button
                onClick={handleCopyCaption}
                className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-bold"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar al portapapeles</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#141428] border border-cyan-900/30 text-xs text-slate-200 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto select-all">
              {fullCaption}
            </div>
          </div>

          {/* TikTok Web Direct Link / App Link */}
          <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-pink-950/20 border border-pink-900/40">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
              <span className="text-xs text-pink-200">¿Quieres subirlo desde el navegador web?</span>
            </div>
            <a
              href="https://www.tiktok.com/creator-center/upload"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shrink-0 transition-colors"
            >
              <span>Abrir TikTok Upload</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyan-900/30 bg-[#0a0a14] flex items-center justify-between">
          <button
            onClick={handleSaveDraft}
            disabled={isSaved}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <BookmarkCheck className={`w-4 h-4 ${isSaved ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>{isSaved ? 'Guardado en Borradores' : 'Guardar como Borrador Pendiente'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs transition-colors"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
};
