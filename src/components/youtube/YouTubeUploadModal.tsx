import React, { useState } from 'react';
import {
  Youtube,
  Upload,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Globe,
  Lock,
  EyeOff,
  Sparkles,
  Loader2,
  X,
  Check,
  Copy,
  Hash,
  Share2,
} from 'lucide-react';
import { useYouTube } from '../../context/YouTubeAuthContext';
import type { ResumableUploadResult } from '../../lib/youtubeUploader';
import { toast } from 'sonner';

export interface YouTubeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: {
    id: string;
    titulo_hook: string;
    duracion_seg: number;
    video_short_url?: string;
    video_vertical_url?: string;
    preview_url?: string;
    descripcion?: string;
    hashtags?: string[];
  };
  onSuccess?: (result: ResumableUploadResult) => void;
}

export const YouTubeUploadModal: React.FC<YouTubeUploadModalProps> = ({
  isOpen,
  onClose,
  clip,
  onSuccess,
}) => {
  const { isConnected, channel, connectYouTube, uploadClipToYouTube } = useYouTube();

  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('public');
  const [title, setTitle] = useState(clip.titulo_hook || 'Momento Viral #Shorts');
  const [description, setDescription] = useState(
    clip.descripcion ||
      'Descubre la técnica exacta para multiplicar la retención de tus vídeos cortos y hacerlos despegar.'
  );
  const [hashtags, setHashtags] = useState<string[]>(
    clip.hashtags || ['#Shorts', '#Viral', '#Creadores', '#Edicion', '#ClipForge']
  );
  const [customTag, setCustomTag] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [uploadResult, setUploadResult] = useState<ResumableUploadResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const targetVideoUrl = clip.video_short_url || clip.video_vertical_url || clip.preview_url;

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = customTag.trim().replace(/^#/, '');
      if (clean && !hashtags.includes(`#${clean}`)) {
        setHashtags([...hashtags, `#${clean}`]);
        setCustomTag('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setHashtags(hashtags.filter((t) => t !== tagToRemove));
  };

  const handleStartUpload = async () => {
    if (!isConnected) {
      toast.info('Conecta tu canal de YouTube primero');
      await connectYouTube();
      return;
    }

    if (!targetVideoUrl) {
      toast.error('No se ha detectado el archivo de vídeo para este clip');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setProgressStatus('Iniciando subida a YouTube Shorts...');

    try {
      const result = await uploadClipToYouTube({
        clipId: clip.id,
        videoUrl: targetVideoUrl,
        titulo_hook: title,
        descripcion: description,
        hashtags,
        duracion_seg: clip.duracion_seg,
        privacyStatus,
        onProgress: (percent, text) => {
          setUploadProgress(percent);
          setProgressStatus(text);
        },
      });

      setUploadResult(result);
      toast.success(`¡Short publicado con éxito en YouTube!`);
      onSuccess?.(result);
    } catch (err: any) {
      console.error('Upload modal error:', err);
      toast.error(`Error al subir a YouTube: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyShortUrl = () => {
    if (!uploadResult?.youtubeUrl) return;
    navigator.clipboard.writeText(uploadResult.youtubeUrl);
    setCopiedLink(true);
    toast.success('¡Enlace del Short copiado al portapapeles!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#10101f] border border-red-900/40 rounded-3xl w-full max-w-xl shadow-2xl shadow-red-950/30 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-red-900/30 bg-gradient-to-r from-red-950/40 via-purple-950/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Youtube className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Publicar en YouTube Shorts</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  9:16
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sube automáticamente tu clip con metadatos virales optimizados
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

        {/* Content Area */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          
          {/* Success View */}
          {uploadResult ? (
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 mx-auto flex items-center justify-center shadow-xl shadow-emerald-950/80">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">¡Short Publicado con Éxito!</h3>
                <p className="text-xs text-slate-400">
                  Tu vídeo ya está disponible en tu canal con visibilidad{' '}
                  <span className="font-bold text-red-400 uppercase">
                    {uploadResult.privacyStatus === 'public' ? 'Pública' : uploadResult.privacyStatus === 'unlisted' ? 'No Listada' : 'Borrador'}
                  </span>
                </p>
              </div>

              {/* YouTube Link Card */}
              <div className="p-3 bg-[#16152a] rounded-2xl border border-red-900/40 flex items-center justify-between gap-3 text-left">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono text-red-400 font-bold uppercase block">URL del Short</span>
                  <p className="text-xs font-mono text-slate-200 truncate">{uploadResult.youtubeUrl}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyShortUrl}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    title="Copiar enlace"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={uploadResult.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-900/40"
                  >
                    <span>Ver Short</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#1d1c33] hover:bg-[#282647] text-white text-xs font-bold border border-slate-700 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* YouTube Account Status Bar */}
              <div className="p-3 rounded-2xl bg-[#141426] border border-red-900/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {channel?.channelThumbnail ? (
                    <img
                      src={channel.channelThumbnail}
                      alt={channel.channelTitle}
                      className="w-10 h-10 rounded-full border border-red-500/50 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-950 flex items-center justify-center text-red-400 border border-red-900">
                      <Youtube className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {isConnected ? channel?.channelTitle || 'Canal Conectado' : 'Canal no conectado'}
                      </span>
                      {isConnected && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Listo
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {isConnected
                        ? 'Token OAuth verificado con permisos de subida'
                        : 'Vincula tu canal de YouTube para publicar directamente'}
                    </p>
                  </div>
                </div>

                {!isConnected ? (
                  <button
                    onClick={connectYouTube}
                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-950 transition-all shrink-0 cursor-pointer"
                  >
                    Conectar YouTube
                  </button>
                ) : (
                  <button
                    onClick={connectYouTube}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors shrink-0"
                    title="Cambiar de cuenta o renovar permisos"
                  >
                    Cambiar cuenta
                  </button>
                )}
              </div>

              {/* Video Validation & Specs Banner */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-[#0b0b14] border border-red-900/30 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-[11px]">
                    <span className="text-slate-400 block">Duración:</span>
                    <span className="font-mono font-bold text-white">
                      {clip.duracion_seg.toFixed(1)}s{' '}
                      <span className="text-emerald-400 font-normal">(≤ 60s Óptimo)</span>
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0b0b14] border border-red-900/30 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="text-[11px]">
                    <span className="text-slate-400 block">Formato:</span>
                    <span className="font-bold text-cyan-300">9:16 Vertical Shorts</span>
                  </div>
                </div>
              </div>

              {/* Visibility Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 block">
                  Visibilidad de publicación
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrivacyStatus('public')}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      privacyStatus === 'public'
                        ? 'bg-red-950/60 border-red-500 text-white shadow-md shadow-red-950/50'
                        : 'bg-[#141424] border-red-950/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Globe className={`w-3.5 h-3.5 ${privacyStatus === 'public' ? 'text-red-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-white">Público</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Recomendado para alcance viral inmediato
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrivacyStatus('unlisted')}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      privacyStatus === 'unlisted'
                        ? 'bg-amber-950/60 border-amber-500 text-white shadow-md shadow-amber-950/50'
                        : 'bg-[#141424] border-red-950/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <EyeOff className={`w-3.5 h-3.5 ${privacyStatus === 'unlisted' ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-white">No listado</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Solo quien tenga el enlace podrá verlo
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrivacyStatus('private')}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      privacyStatus === 'private'
                        ? 'bg-purple-950/60 border-purple-500 text-white shadow-md shadow-purple-950/50'
                        : 'bg-[#141424] border-red-950/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Lock className={`w-3.5 h-3.5 ${privacyStatus === 'private' ? 'text-purple-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-white">Borrador</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Privado en YouTube Studio para revisión
                    </span>
                  </button>
                </div>
              </div>

              {/* Title Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">
                    Título del Short (Hook viral)
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {title.length}/100
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#141424] border border-red-900/40 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-semibold"
                />
              </div>

              {/* Description Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#141424] border border-red-900/40 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none"
                />
              </div>

              {/* Hashtags */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-red-400" />
                  <span>Hashtags automáticos</span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-[#141424] border border-red-900/40 min-h-[42px] items-center">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/80 text-red-300 border border-red-800/60 text-[11px] font-bold"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="+ Añadir tag (Enter)"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={handleAddTag}
                    className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-500 focus:outline-none px-2 py-0.5 flex-1 min-w-[100px]"
                  />
                </div>
              </div>

              {/* Upload Progress Bar (When uploading) */}
              {isUploading && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-[#141428] border border-red-700/50 animate-pulse">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                      {progressStatus}
                    </span>
                    <span className="font-mono text-red-300 font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!uploadResult && (
          <div className="p-4 border-t border-red-900/30 bg-[#0c0c17] flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              id="confirm-youtube-upload-btn"
              onClick={handleStartUpload}
              disabled={isUploading || !title.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-red-950 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publicando Short...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                  <span>Subir Short a YouTube</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
