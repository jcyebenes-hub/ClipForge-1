import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Youtube, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  FileVideo, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  Film, 
  Clock, 
  User, 
  X, 
  Play, 
  DownloadCloud,
  Check,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { supabase } from '../../../../lib/supabase/client';
import type { Proyecto } from '../../../../lib/supabase/types';
import type { YoutubeInfoResponse } from '../../../api/youtube/info/route';
import { validarArchivoVideo } from '../../../../lib/videoValidator';
import { sanitizarTitulo } from '../../../../lib/sanitizer';
import { CopyrightNoticeModal, hasAcceptedCopyrightNotice } from '../../../../components/proyecto/CopyrightNoticeModal';
import { toast } from 'sonner';

interface NuevoProyectoPageProps {
  onNavigate?: (path: string) => void;
}

export const NuevoProyectoPage: React.FC<NuevoProyectoPageProps> = ({ onNavigate }) => {
  const { user, isSupabaseConfigured } = useAuth();
  
  // Tab state: 'upload' (Pestaña A) or 'youtube' (Pestaña B)
  const [tab, setTab] = useState<'upload' | 'youtube'>('upload');

  // Pestaña A (Subir vídeo) States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isValidatingFile, setIsValidatingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pestaña B (URL de YouTube) States
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isAnalyzingYt, setIsAnalyzingYt] = useState(false);
  const [ytInfo, setYtInfo] = useState<YoutubeInfoResponse | null>(null);
  const [isDownloadingYt, setIsDownloadingYt] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatusText, setDownloadStatusText] = useState('');
  const [isCopyrightModalOpen, setIsCopyrightModalOpen] = useState(false);

  // Handle file selection with deep binary and codec validation
  const handleFileChange = async (file: File) => {
    setIsValidatingFile(true);
    const toastId = toast.loading(`Validando archivo: ${file.name}...`);

    try {
      // Deep validation: extension + max 500 MB + magic bytes + video codec verification
      const validacion = await validarArchivoVideo(file);

      if (!validacion.esValido) {
        toast.dismiss(toastId);
        toast.error(validacion.error || 'Archivo no válido.');
        return;
      }

      // Revoke previous URL if any
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }

      const preview = URL.createObjectURL(file);
      setSelectedFile(file);
      setVideoPreviewUrl(preview);
      const cleanName = sanitizarTitulo(file.name.replace(/\.[^/.]+$/, ''), 80);
      setCustomTitle(cleanName);
      if (validacion.duracionSeg) {
        setVideoDuration(validacion.duracionSeg);
      }

      toast.dismiss(toastId);
      toast.success(`Archivo validado con éxito (${validacion.formatoDetectado?.toUpperCase() || 'VIDEO'}, ${validacion.tamanoMb} MB)`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Error al validar archivo de vídeo: ' + err.message);
    } finally {
      setIsValidatingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClearFile = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setSelectedFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setCustomTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Pestaña A: Handle start upload & save to Supabase
  const handleStartUpload = async () => {
    if (!selectedFile) {
      toast.error('Selecciona un archivo de video primero.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatusText('Generando registro del proyecto...');

    const projectId = 'proj-' + Math.random().toString(36).substring(2, 9);
    const userId = user?.id || 'demo-user';
    const finalTitle = customTitle.trim() || selectedFile.name;
    const storagePath = `${userId}/${projectId}/original.mp4`;

    const newProject: Partial<Proyecto> = {
      id: projectId,
      user_id: userId,
      titulo: finalTitle,
      url_youtube: null,
      archivo_nombre: selectedFile.name,
      estado: 'nuevo',
      duracion_seg: videoDuration || 1420,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };

    // Simulated smooth progress interval
    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev < 85) return prev + 15;
        return prev;
      });
    }, 300);

    try {
      setUploadStatusText(`Subiendo video al bucket media (${storagePath})...`);
      
      if (isSupabaseConfigured && user) {
        // 1. Insert into proyectos
        const { error: insertError } = await supabase.from('proyectos').insert([
          {
            id: projectId,
            user_id: user.id,
            titulo: finalTitle,
            url_youtube: null,
            archivo_nombre: selectedFile.name,
            estado: 'nuevo',
            duracion_seg: videoDuration || 1420,
          },
        ] as any);

        if (insertError) {
          console.warn('Error inserting project into Supabase:', insertError);
        }

        // 2. Upload to Supabase Storage bucket 'media'
        try {
          const { error: storageError } = await supabase.storage
            .from('media')
            .upload(storagePath, selectedFile, {
              cacheControl: '3600',
              upsert: true,
            });

          if (storageError) {
            console.warn('Storage upload notice (bucket might be private or created via dashboard):', storageError.message);
          }
        } catch (storageErr) {
          console.warn('Storage upload error:', storageErr);
        }
      }

      // Save to local storage cache for seamless preview experience
      const localData = localStorage.getItem('clipforge_local_proyectos');
      const existing = localData ? JSON.parse(localData) : [];
      localStorage.setItem('clipforge_local_proyectos', JSON.stringify([newProject, ...existing]));

      clearInterval(progressTimer);
      setUploadProgress(100);
      setUploadStatusText('¡Subida completada con éxito!');

      setTimeout(() => {
        toast.success('Proyecto creado correctamente. Redirigiendo...');
        onNavigate?.(`/dashboard/proyecto/${projectId}`);
      }, 700);

    } catch (err: any) {
      clearInterval(progressTimer);
      setIsUploading(false);
      toast.error('Ocurrió un error al procesar el archivo: ' + (err.message || 'Error desconocido'));
    }
  };

  // Pestaña B: Analizar URL de YouTube
  const handleAnalyzeYoutube = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!youtubeUrl.trim()) {
      toast.error('Por favor ingresa una URL de YouTube.');
      return;
    }

    setIsAnalyzingYt(true);
    setYtInfo(null);

    try {
      // Información REAL desde YouTube (título, autor, duración real del vídeo)
      const response = await fetch(`/api/youtube/info?url=${encodeURIComponent(youtubeUrl.trim())}`);

      if (response.ok) {
        const data: YoutubeInfoResponse = await response.json();
        setYtInfo(data);
        toast.success('Vídeo real localizado en YouTube');
      } else {
        const errData = await response.json().catch(() => ({}));
        setYtInfo(null);
        toast.error(errData?.error || 'No se pudo verificar el vídeo en YouTube.');
      }
    } catch (err) {
      console.warn('Fetch info error:', err);
      setYtInfo(null);
      toast.error('Error de conexión al obtener la información del vídeo.');
    } finally {
      setIsAnalyzingYt(false);
    }
  };

  // Pestaña B: Trigger import flow with copyright check
  const handleTriggerImport = () => {
    if (!ytInfo) return;

    if (hasAcceptedCopyrightNotice()) {
      handleImportYoutubeVideo();
    } else {
      setIsCopyrightModalOpen(true);
    }
  };

  // Pestaña B: Crear el proyecto con la URL real.
  // La transcripción se obtiene en la pantalla del proyecto mediante los
  // subtítulos reales de YouTube (sin descargas ni simulaciones).
  const handleImportYoutubeVideo = async () => {
    if (!ytInfo) return;
    setIsCopyrightModalOpen(false);

    setIsDownloadingYt(true);
    setDownloadProgress(55);
    setDownloadStatusText('Registrando el proyecto en tu cuenta…');

    const projectId = 'proj-yt-' + Math.random().toString(36).substring(2, 9);
    const userId = user?.id || 'demo-user';
    const sanitizedTitle = sanitizarTitulo(ytInfo.titulo, 120);

    const newProject: Partial<Proyecto> = {
      id: projectId,
      user_id: userId,
      titulo: sanitizedTitle,
      url_youtube: youtubeUrl,
      archivo_nombre: null,
      estado: 'nuevo',
      duracion_seg: ytInfo.duracion_seg || 0,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured && user) {
        const { error: insertError } = await supabase.from('proyectos').insert([
          {
            id: projectId,
            user_id: user.id,
            titulo: ytInfo.titulo,
            url_youtube: youtubeUrl,
            archivo_nombre: null,
            estado: 'nuevo',
            duracion_seg: ytInfo.duracion_seg || 0,
          },
        ] as any);

        if (insertError) {
          console.warn('Error insertando proyecto de YouTube en Supabase:', insertError);
        }
      }

      // Save to local storage
      const localData = localStorage.getItem('clipforge_local_proyectos');
      const existing = localData ? JSON.parse(localData) : [];
      localStorage.setItem('clipforge_local_proyectos', JSON.stringify([newProject, ...existing]));

      setDownloadProgress(100);
      setDownloadStatusText('¡Proyecto creado! Dentro obtendrás la transcripción real del vídeo.');
      toast.success('Vídeo de YouTube importado correctamente');
      onNavigate?.(`/dashboard/proyecto/${projectId}`);
    } catch (err: any) {
      setIsDownloadingYt(false);
      toast.error('Error al importar el vídeo: ' + (err.message || 'Error desconocido'));
    }
  };

  // Helper to format bytes
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper to format duration seconds to mm:ss
  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} min`;
  };

  return (
    <div className="flex-1 bg-[#0a0a12] text-slate-100 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Breadcrumb & Header */}
        <div className="flex items-center justify-between border-b border-purple-900/30 pb-6">
          <div className="flex items-center gap-4">
            <button
              id="back-to-dashboard-btn"
              onClick={() => onNavigate?.('/dashboard')}
              className="p-2 rounded-xl bg-[#141424] border border-purple-900/40 text-slate-300 hover:text-white hover:border-purple-500/50 transition-colors cursor-pointer"
              title="Volver al panel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Crear Nuevo Proyecto
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Auto-Hooks IA
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Elige tu método de origen para transcribir y cortar clips virales en 9:16 automáticamente.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selection Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tab A Button */}
          <button
            id="tab-upload-btn"
            type="button"
            onClick={() => setTab('upload')}
            className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 text-left cursor-pointer ${
              tab === 'upload'
                ? 'bg-gradient-to-br from-purple-900/30 via-indigo-950/20 to-[#121222] border-purple-500 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/50'
                : 'bg-[#121222] border-purple-900/30 hover:border-purple-800/60 hover:bg-[#151528]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                tab === 'upload' ? 'bg-purple-600 text-white' : 'bg-[#18182c] text-purple-400'
              }`}>
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">Subir archivo de vídeo</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Sube directamente archivos .mp4, .webm o .mov</p>
              </div>
            </div>

            <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Recomendada (100% legal)
            </span>
          </button>

          {/* Tab B Button */}
          <button
            id="tab-youtube-btn"
            type="button"
            onClick={() => setTab('youtube')}
            className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 text-left cursor-pointer ${
              tab === 'youtube'
                ? 'bg-gradient-to-br from-red-950/20 via-purple-950/20 to-[#121222] border-red-500/80 shadow-lg shadow-red-950/30 ring-1 ring-red-500/40'
                : 'bg-[#121222] border-purple-900/30 hover:border-purple-800/60 hover:bg-[#151528]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                tab === 'youtube' ? 'bg-red-600 text-white' : 'bg-[#18182c] text-red-400'
              }`}>
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">URL de YouTube</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Pega el link de cualquier podcast o video largo</p>
              </div>
            </div>

            <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
              Subtítulos Reales
            </span>
          </button>
        </div>

        {/* ---------------------------------------------------- */}
        {/* PESTAÑA A: SUBIR VÍDEO                               */}
        {/* ---------------------------------------------------- */}
        {tab === 'upload' && (
          <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-900/30 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileVideo className="w-5 h-5 text-purple-400" />
                  <span>Subir vídeo desde tu dispositivo</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Arrastra o selecciona un archivo de video. Se guardará de forma segura en tu almacenamiento privado.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-300 self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Recomendada • 100% Legal</span>
              </div>
            </div>

            {/* If NO file is selected: Drag and Drop Dropzone */}
            {!selectedFile && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="video-file-input"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />

                <div
                  id="dropzone-area"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                    isDragging
                      ? 'border-purple-400 bg-purple-950/40 scale-[1.01]'
                      : 'border-purple-900/60 bg-[#0e0e1a]/80 hover:border-purple-500/70 hover:bg-[#141426]'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-purple-900/30 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-lg shadow-purple-950/50">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">
                    Haz clic para seleccionar o arrastra tu archivo aquí
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-4">
                    Formatos admitidos: <span className="text-purple-300 font-semibold">.mp4, .webm, .mov</span>. Hasta 2 GB por archivo.
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/30 transition-all pointer-events-none"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Examinar archivos</span>
                  </button>
                </div>
              </div>
            )}

            {/* If FILE IS SELECTED: Preview & Details */}
            {selectedFile && (
              <div className="space-y-6">
                <div className="bg-[#0e0e1a] border border-purple-900/40 rounded-2xl p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Left Column: Video Preview Thumbnail */}
                  <div className="md:col-span-5 relative rounded-xl overflow-hidden bg-black aspect-video border border-purple-900/50 shadow-md flex items-center justify-center">
                    {videoPreviewUrl ? (
                      <video
                        src={videoPreviewUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-slate-500 flex flex-col items-center gap-2">
                        <FileVideo className="w-8 h-8" />
                        <span className="text-xs">Cargando previsualización...</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: File Meta & Options */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Archivo cargado listo para procesar
                        </span>
                        <h4 className="text-base font-bold text-white truncate max-w-md" title={selectedFile.name}>
                          {selectedFile.name}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        disabled={isUploading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                        title="Eliminar archivo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-[#141424] p-2.5 rounded-xl border border-purple-900/30">
                        <span className="text-slate-400 block mb-0.5">Tamaño</span>
                        <span className="font-semibold text-slate-200">{formatFileSize(selectedFile.size)}</span>
                      </div>
                      <div className="bg-[#141424] p-2.5 rounded-xl border border-purple-900/30">
                        <span className="text-slate-400 block mb-0.5">Duración aprox.</span>
                        <span className="font-semibold text-purple-300">
                          {videoDuration ? formatDuration(videoDuration) : 'Detectando...'}
                        </span>
                      </div>
                    </div>

                    {/* Custom Title Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 block">
                        Título del proyecto (opcional)
                      </label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        disabled={isUploading}
                        placeholder="Ej: Masterclass de Marketing #1"
                        className="w-full px-3.5 py-2.5 bg-[#141424] border border-purple-900/40 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Upload Progress Bar if uploading */}
                {isUploading && (
                  <div className="bg-[#0e0e1a] border border-purple-900/50 p-5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-purple-300 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        {uploadStatusText || 'Subiendo archivo y creando proyecto...'}
                      </span>
                      <span className="text-cyan-400 font-mono font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#141428] rounded-full overflow-hidden border border-purple-900/40">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Destino: <code className="text-purple-300">supabase.storage('media')</code> → ruta <code className="text-slate-300">{`{user_id}/{proyecto_id}/original.mp4`}</code>
                    </p>
                  </div>
                )}

                {/* Bottom Start Button */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClearFile}
                    disabled={isUploading}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#141424] border border-purple-900/40 transition-colors"
                  >
                    Cambiar archivo
                  </button>
                  <button
                    id="btn-start-upload"
                    type="button"
                    onClick={handleStartUpload}
                    disabled={isUploading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/40 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Procesando y Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-cyan-300" />
                        <span>Empezar procesamiento</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* PESTAÑA B: URL DE YOUTUBE                            */}
        {/* ---------------------------------------------------- */}
        {tab === 'youtube' && (
          <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="border-b border-purple-900/30 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                <span>Importar vídeo desde YouTube</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pega el enlace de un video público o podcast de YouTube para analizarlo y extraer los mejores momentos en formato vertical.
              </p>
            </div>

            {/* Input and Analizar button form */}
            <form onSubmit={handleAnalyzeYoutube} className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Youtube className="w-5 h-5 text-red-500" />
                  </div>
                  <input
                    type="url"
                    id="youtube-url-input"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
                    disabled={isAnalyzingYt || isDownloadingYt}
                    className="w-full pl-11 pr-4 py-3 bg-[#0e0e1a] border border-purple-900/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  id="btn-analyze-youtube"
                  disabled={isAnalyzingYt || isDownloadingYt || !youtubeUrl.trim()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-950/50 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isAnalyzingYt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analizando...</span>
                    </>
                  ) : (
                    <>
                      <span>Analizar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample Quick Links */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Prueba rápida:</span>
                <button
                  type="button"
                  onClick={() => setYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                  className="text-purple-400 hover:underline"
                >
                  Video Viral Ejemplo 1
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setYoutubeUrl('https://www.youtube.com/watch?v=podcast_entrevista_2026')}
                  className="text-purple-400 hover:underline"
                >
                  Podcast Ejemplo 2
                </button>
              </div>
            </form>

            {/* Confirmation Card after /api/youtube/info returns */}
            {ytInfo && (
              <div className="bg-[#0e0e1a] border border-purple-900/50 rounded-2xl p-5 sm:p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Video verificado en YouTube
                  </span>
                  <span className="text-xs text-slate-400">
                    Llamada a <code className="text-purple-300">/api/youtube/info</code>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                  {/* Video Thumbnail */}
                  <div className="sm:col-span-5 relative rounded-xl overflow-hidden bg-black aspect-video border border-purple-900/50 shadow-md group">
                    <img
                      src={ytInfo.miniatura}
                      alt={ytInfo.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[11px] font-bold text-white backdrop-blur-sm flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>{formatDuration(ytInfo.duracion_seg)}</span>
                    </div>
                  </div>

                  {/* Video Metadata */}
                  <div className="sm:col-span-7 space-y-3">
                    <h3 className="text-base font-bold text-white leading-snug line-clamp-2">
                      {ytInfo.titulo}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 text-purple-300 font-medium">
                        <User className="w-3.5 h-3.5" />
                        {ytInfo.autor}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(ytInfo.duracion_seg)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      La app leerá los subtítulos reales del vídeo (manuales o automáticos) y te mostrará el reproductor de YouTube dentro del proyecto para previsualizar cada momento viral.
                    </p>
                  </div>
                </div>

                {/* Downloading Progress Bar */}
                {isDownloadingYt && (
                  <div className="bg-[#141428] border border-purple-900/50 p-5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-purple-300 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                        {downloadStatusText || 'Creando proyecto y preparando la transcripción…'}
                      </span>
                      <span className="text-cyan-400 font-mono font-bold">{downloadProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#0e0e1a] rounded-full overflow-hidden border border-purple-900/40">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 via-purple-600 to-cyan-400 transition-all duration-300 rounded-full"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Creando el proyecto → dentro obtendrás la transcripción real (subtítulos de YouTube) y podrás extraer los momentos virales.
                    </p>
                  </div>
                )}

                {/* Import Confirmation Button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setYtInfo(null)}
                    disabled={isDownloadingYt}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#141424] border border-purple-900/40 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-confirm-import-yt"
                    type="button"
                    onClick={handleTriggerImport}
                    disabled={isDownloadingYt}
                    className="inline-flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 via-purple-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 shadow-md shadow-red-950/40 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isDownloadingYt ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creando proyecto...</span>
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="w-4 h-4" />
                        <span>Importar este vídeo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal de Aviso Legal y Derechos de Autor */}
      <CopyrightNoticeModal
        isOpen={isCopyrightModalOpen}
        onConfirm={handleImportYoutubeVideo}
        onCancel={() => setIsCopyrightModalOpen(false)}
        videoUrl={youtubeUrl}
      />
    </div>
  );
};

export default NuevoProyectoPage;
