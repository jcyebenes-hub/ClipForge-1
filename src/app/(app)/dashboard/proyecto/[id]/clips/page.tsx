import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  ArrowLeft,
  Play,
  Pause,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Film,
  Zap,
  Clock,
  HardDrive,
  Check,
  ExternalLink,
  Flame,
  ChevronRight,
  Sliders,
  Share2,
  Smartphone,
  Eye,
  UserCheck,
  Split,
  Maximize2,
  Activity,
  Target,
  Trophy,
  Subtitles,
  Type,
  Youtube,
} from 'lucide-react';
import { useAuth } from '../../../../../../context/AuthContext';
import { useYouTube } from '../../../../../../context/YouTubeAuthContext';
import { YouTubeUploadModal } from '../../../../../../components/youtube/YouTubeUploadModal';
import { ExportTikTokModal } from '../../../../../../components/publicar/ExportTikTokModal';
import { supabase } from '../../../../../../lib/supabase/client';
import type { Proyecto, Clip } from '../../../../../../lib/supabase/types';
import { cutVideoSegment, CutProgressCallback } from '../../../../../../lib/videoCutter';
import { generarShortVertical, VerticalCropProgress, TipoEnfoque } from '../../../../../../lib/encuadre';
import {
  SubtitleStylePreset,
  SUBTITLE_STYLES,
  SubtitleWord,
  generarArchivoASS,
  generarPalabrasFallback,
  quemarSubtitulosVideo,
} from '../../../../../../lib/subtitulos';
import { SubtitlePreview } from '../../../../../../components/proyecto/SubtitlePreview';
import { ViralShortSection } from '../../../../../../components/proyecto/ViralShortSection';
import {
  descargarClipMP4,
  copiarEnlacePublicoClip,
  generarNombreArchivoClip,
} from '../../../../../../lib/downloadHelper';
import { ConfirmProcessModal } from '../../../../../../components/proyecto/ConfirmProcessModal';
import { trackClipExported, trackError } from '../../../../../../lib/analytics';
import { toast } from 'sonner';

export interface ProcessedClipState {
  id: string;
  proyecto_id: string;
  inicio_seg: number;
  fin_seg: number;
  duracion_seg: number;
  puntuacion_viral: number;
  titulo_hook: string;
  razon?: string;
  cta?: string;
  hashtags?: string[];
  descripcion?: string;
  mejor_momento_primera_frase?: string;
  titulos_sugeridos?: string[];
  ctas_sugeridos?: string[];
  hook_como_primer_subtitulo?: boolean;
  texto_transcrito?: string;
  estado: 'pendiente' | 'procesando' | 'listo' | 'error';
  progreso: number;
  etapa_texto: string;
  video_blob?: Blob;
  preview_url?: string;
  bucket_path?: string;
  error_msg?: string;
  reintentos: number;
  // Vertical 9:16 smart framing fields
  enfoque?: TipoEnfoque;
  enfoque_usado?: TipoEnfoque;
  video_vertical_url?: string;
  vertical_bucket_path?: string;
  vertical_estado?: 'pendiente' | 'procesando' | 'listo' | 'error';
  vertical_progreso?: number;
  vertical_etapa_texto?: string;
  faces_count?: number;
  has_faces?: boolean;
  // Complete Short with subtitles (Fase 7)
  video_short_url?: string;
  short_bucket_path?: string;
  short_estado?: 'pendiente' | 'procesando' | 'listo' | 'error';
  short_progreso?: number;
  short_etapa_texto?: string;
  estilo_subtitulos?: SubtitleStylePreset;
  subtitulos_palabras?: SubtitleWord[];
  show_subtitle_preview?: boolean;
}

interface ClipsProcesadorPageProps {
  proyectoId?: string;
  onNavigate?: (path: string) => void;
}

export default function ClipsProcesadorPage({ proyectoId, onNavigate }: ClipsProcesadorPageProps) {
  const { user, profile, isSupabaseConfigured } = useAuth();
  const { isConnected: isYtConnected, connectYouTube } = useYouTube();
  const effectiveId = proyectoId || (typeof window !== 'undefined' ? window.location.pathname.split('/')[3] || 'proj-demo' : 'proj-demo');

  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [loading, setLoading] = useState(true);
  const [clipsQueue, setClipsQueue] = useState<ProcessedClipState[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [overallLog, setOverallLog] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadModalClip, setUploadModalClip] = useState<ProcessedClipState | null>(null);
  const [tiktokExportClip, setTiktokExportClip] = useState<ProcessedClipState | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Cache original video blob once downloaded so we don't re-download it 5 times
  const originalVideoBlobRef = useRef<Blob | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Load project & saved clips
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        let loadedProj: Proyecto | null = null;
        let loadedClips: ProcessedClipState[] = [];

        // 1. Check local storage
        try {
          const localProjs = localStorage.getItem('clipforge_local_proyectos');
          if (localProjs) {
            const list: Proyecto[] = JSON.parse(localProjs);
            const found = list.find(p => p.id === effectiveId);
            if (found) loadedProj = found;
          }

          const localClips = localStorage.getItem(`clipforge_clips_${effectiveId}`);
          if (localClips) {
            const parsed = JSON.parse(localClips);
            loadedClips = parsed.map((c: any) => ({
              id: c.id,
              proyecto_id: effectiveId,
              inicio_seg: c.inicio_seg,
              fin_seg: c.fin_seg,
              duracion_seg: c.duracion_seg || Math.round(c.fin_seg - c.inicio_seg),
              puntuacion_viral: c.puntuacion_viral || 80,
              titulo_hook: c.titulo_hook || 'Momento Viral',
              razon: c.razon,
              cta: c.cta,
              hashtags: c.hashtags || ['#shorts', '#viral', '#creadores', '#edicion', '#algoritmo', '#marketing', '#trucos', '#retencion'],
              descripcion: c.descripcion || undefined,
              mejor_momento_primera_frase: c.mejor_momento_primera_frase || c.titulo_hook,
              titulos_sugeridos: c.titulos_sugeridos || undefined,
              ctas_sugeridos: c.ctas_sugeridos || undefined,
              hook_como_primer_subtitulo: c.hook_como_primer_subtitulo ?? true,
              texto_transcrito: c.texto_transcrito,
              estado: c.video_url ? 'listo' : 'pendiente',
              progreso: c.video_url ? 100 : 0,
              etapa_texto: c.video_url ? 'Clip ya procesado' : 'En cola para corte',
              preview_url: c.video_url || undefined,
              bucket_path: c.bucket_path,
              video_vertical_url: c.video_vertical_url || undefined,
              vertical_bucket_path: c.vertical_bucket_path,
              vertical_estado: c.video_vertical_url ? 'listo' : 'pendiente',
              vertical_progreso: c.video_vertical_url ? 100 : 0,
              vertical_etapa_texto: c.video_vertical_url ? 'Vertical 9:16 generado' : 'Pendiente de encuadre',
              faces_count: c.faces_count || 0,
              has_faces: c.has_faces ?? (c.faces_count ? c.faces_count > 0 : true),
              enfoque: c.enfoque || 'rostro',
              enfoque_usado: c.enfoque_usado,
              video_short_url: c.video_short_url || undefined,
              short_bucket_path: c.short_bucket_path,
              short_estado: c.video_short_url ? 'listo' : 'pendiente',
              short_progreso: c.video_short_url ? 100 : 0,
              short_etapa_texto: c.video_short_url ? 'Short con subtítulos listo' : 'Pendiente',
              estilo_subtitulos: c.estilo_subtitulos || 'moderno',
              reintentos: 0,
            }));
          }
        } catch (e) {
          console.warn('Error reading localStorage:', e);
        }

        // 2. Fetch from Supabase
        if (isSupabaseConfigured && user) {
          try {
            const { data: dbProj } = await (supabase.from('proyectos') as any)
              .select('*')
              .eq('id', effectiveId)
              .single();

            if (dbProj) loadedProj = dbProj as Proyecto;

            const { data: dbClips } = await (supabase.from('clips') as any)
              .select('*')
              .eq('proyecto_id', effectiveId)
              .order('puntuacion_viral', { ascending: false });

            if (dbClips && dbClips.length > 0) {
              loadedClips = dbClips.map((c: any) => ({
                id: c.id,
                proyecto_id: effectiveId,
                inicio_seg: c.inicio_seg,
                fin_seg: c.fin_seg,
                duracion_seg: Math.round(c.fin_seg - c.inicio_seg),
                puntuacion_viral: c.puntuacion_viral || 80,
                titulo_hook: c.titulo_hook,
                cta: c.cta,
                hashtags: c.hashtags || ['#shorts', '#viral', '#creadores', '#edicion', '#algoritmo', '#marketing', '#trucos', '#retencion'],
                descripcion: c.descripcion || undefined,
                mejor_momento_primera_frase: c.mejor_momento_primera_frase || c.titulo_hook,
                titulos_sugeridos: c.titulos_sugeridos || undefined,
                ctas_sugeridos: c.ctas_sugeridos || undefined,
                hook_como_primer_subtitulo: c.hook_como_primer_subtitulo ?? true,
                texto_transcrito: c.texto_transcrito,
                estado: c.video_url ? 'listo' : 'pendiente',
                progreso: c.video_url ? 100 : 0,
                etapa_texto: c.video_url ? 'Clip guardado en bucket' : 'En cola para corte',
                preview_url: c.video_url || undefined,
                video_vertical_url: c.video_vertical_url || undefined,
                vertical_estado: c.video_vertical_url ? 'listo' : 'pendiente',
                vertical_progreso: c.video_vertical_url ? 100 : 0,
                vertical_etapa_texto: c.video_vertical_url ? 'Vertical 9:16 listo' : 'Pendiente de encuadre',
                faces_count: c.faces_count || 0,
                enfoque: c.enfoque || 'rostro',
                video_short_url: c.video_short_url || c.video_url || undefined,
                short_estado: c.video_short_url ? 'listo' : 'pendiente',
                short_progreso: c.video_short_url ? 100 : 0,
                short_etapa_texto: c.video_short_url ? 'Short con subtítulos listo' : 'Pendiente',
                estilo_subtitulos: c.estilo_subtitulos || 'moderno',
                reintentos: 0,
              }));
            }
          } catch (dbErr) {
            console.warn('Supabase fetch error:', dbErr);
          }
        }

        // Fallback demo clips if empty
        if (loadedClips.length === 0) {
          loadedClips = [
            {
              id: `clip-${effectiveId}-1`,
              proyecto_id: effectiveId,
              inicio_seg: 9.5,
              fin_seg: 38.6,
              duracion_seg: 29,
              puntuacion_viral: 94,
              titulo_hook: 'El error del 99% que destruye la retención',
              razon: 'Gancho directo en los primeros 2 segundos con estadística impactante.',
              cta: '¡Sígueme para duplicar tus vistas en TikTok!',
              estado: 'pendiente',
              progreso: 0,
              etapa_texto: 'Listo para cortar',
              reintentos: 0,
            },
            {
              id: `clip-${effectiveId}-2`,
              proyecto_id: effectiveId,
              inicio_seg: 19.2,
              fin_seg: 48.5,
              duracion_seg: 29,
              puntuacion_viral: 88,
              titulo_hook: 'La regla de oro de los subtítulos virales',
              razon: 'Revela una técnica de edición visual con alto contraste.',
              cta: 'Guarda este vídeo para aplicarlo en tu próximo reel',
              estado: 'pendiente',
              progreso: 0,
              etapa_texto: 'Listo para cortar',
              reintentos: 0,
            },
            {
              id: `clip-${effectiveId}-3`,
              proyecto_id: effectiveId,
              inicio_seg: 0.5,
              fin_seg: 30.0,
              duracion_seg: 30,
              puntuacion_viral: 82,
              titulo_hook: 'Cómo estructurar Shorts para activar el algoritmo',
              razon: 'Introducción de autoridad en formato 9:16.',
              cta: 'Comenta "VIRAL" y te envío la plantilla completa',
              estado: 'pendiente',
              progreso: 0,
              etapa_texto: 'Listo para cortar',
              reintentos: 0,
            },
          ];
        }

        setProyecto(loadedProj || {
          id: effectiveId,
          user_id: user?.id || 'user-demo',
          titulo: 'Estrategia de Retención Viral en TikTok y Shorts',
          url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          archivo_nombre: null,
          estado: 'analizado',
          duracion_seg: 180,
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString(),
        });

        setClipsQueue(loadedClips);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [effectiveId, isSupabaseConfigured, user]);

  const addLog = (msg: string) => {
    setOverallLog(prev => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 49),
    ]);
  };

  /**
   * Downloads original video file from bucket or fallback sample
   */
  const getOriginalVideoBlob = async (): Promise<Blob> => {
    if (originalVideoBlobRef.current) {
      return originalVideoBlobRef.current;
    }

    addLog('Descargando vídeo fuente de alta resolución...');

    // 1. Try Supabase Storage
    if (isSupabaseConfigured && user) {
      try {
        const filePath = `${user.id}/${effectiveId}/original.mp4`;
        const { data, error } = await supabase.storage
          .from('media')
          .download(filePath);

        if (!error && data) {
          addLog(`Vídeo original descargado de Supabase Storage (${(data.size / (1024 * 1024)).toFixed(1)} MB).`);
          originalVideoBlobRef.current = data;
          return data;
        }
      } catch (storageErr) {
        console.warn('Storage download error:', storageErr);
      }
    }

    // 2. Try project video_url or sample
    const sampleUrl = proyecto?.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    try {
      const resp = await fetch(sampleUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        addLog(`Vídeo de origen obtenido (${(blob.size / (1024 * 1024)).toFixed(1)} MB).`);
        originalVideoBlobRef.current = blob;
        return blob;
      }
    } catch (fetchErr) {
      console.warn('Fetch fallback error:', fetchErr);
    }

    throw new Error('No se pudo descargar el archivo de vídeo original para el corte.');
  };

  /**
   * Process a single clip with FFmpeg WASM and upload result
   */
  const processSingleClip = async (clip: ProcessedClipState, retryAttempt = 0): Promise<ProcessedClipState> => {
    addLog(`Iniciando corte de "${clip.titulo_hook}" (${clip.inicio_seg}s - ${clip.fin_seg}s)...`);

    // Update state to 'procesando'
    setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
      ...c,
      estado: 'procesando',
      progreso: 10,
      etapa_texto: 'Preparando motor FFmpeg...',
      reintentos: retryAttempt,
    } : c));

    try {
      const videoBlob = await getOriginalVideoBlob();

      // Callback for FFmpeg progress
      const onProgress: CutProgressCallback = (p) => {
        setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
          ...c,
          progreso: p.percent,
          etapa_texto: p.detail,
        } : c));
      };

      // Execute FFmpeg cut
      const result = await cutVideoSegment({
        clipId: clip.id,
        inicioSeg: clip.inicio_seg,
        finSeg: clip.fin_seg || (clip.inicio_seg + clip.duracion_seg),
        videoSource: videoBlob,
        onProgress,
        useFastCopy: false, // ensures exact frame keying
      });

      addLog(`Corte completado para "${clip.titulo_hook}". Tamaño generado: ${(result.blob.size / (1024 * 1024)).toFixed(2)} MB.`);

      // Upload to Supabase bucket
      let uploadedUrl = result.previewUrl;
      const userId = user?.id || 'user-demo';
      const bucketPath = `${userId}/${effectiveId}/clips/clip_${clip.id}.mp4`;

      if (isSupabaseConfigured && user) {
        onProgress({
          clipId: clip.id,
          percent: 92,
          stage: 'subiendo',
          detail: 'Guardando clip en Supabase Storage...',
        });

        try {
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(bucketPath, result.blob, {
              upsert: true,
              contentType: 'video/mp4',
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('media')
              .getPublicUrl(bucketPath);

            if (publicUrlData?.publicUrl) {
              uploadedUrl = publicUrlData.publicUrl;
            }

            // Update clips table
            await (supabase.from('clips') as any).upsert({
              id: clip.id,
              proyecto_id: effectiveId,
              inicio_seg: clip.inicio_seg,
              fin_seg: clip.fin_seg,
              puntuacion_viral: clip.puntuacion_viral,
              titulo_hook: clip.titulo_hook,
              cta: clip.cta || clip.razon,
              video_url: uploadedUrl,
              estado: 'listo',
            });

            addLog(`Clip guardado exitosamente en bucket: ${bucketPath}`);
          }
        } catch (uploadErr) {
          console.warn('Storage upload error:', uploadErr);
        }
      }

      // Update local storage
      try {
        const stored = localStorage.getItem(`clipforge_clips_${effectiveId}`);
        const currentList = stored ? JSON.parse(stored) : [];
        const idx = currentList.findIndex((item: any) => item.id === clip.id);
        const updatedItem = {
          ...clip,
          estado: 'listo',
          video_url: uploadedUrl,
          bucket_path: bucketPath,
        };
        if (idx >= 0) {
          currentList[idx] = updatedItem;
        } else {
          currentList.push(updatedItem);
        }
        localStorage.setItem(`clipforge_clips_${effectiveId}`, JSON.stringify(currentList));
      } catch (e) {
        console.warn('Local storage error:', e);
      }

      const completedClip: ProcessedClipState = {
        ...clip,
        estado: 'listo',
        progreso: 100,
        etapa_texto: 'Clip recortado y listo',
        video_blob: result.blob,
        preview_url: result.previewUrl,
        bucket_path: bucketPath,
      };

      setClipsQueue(prev => prev.map(c => c.id === clip.id ? completedClip : c));
      toast.success(`"${clip.titulo_hook}" procesado correctamente`);
      return completedClip;

    } catch (err: any) {
      console.error(`Error processing clip ${clip.id}:`, err);
      addLog(`Error en "${clip.titulo_hook}": ${err.message || err}`);

      // Retry logic: 1 automatic retry
      if (retryAttempt < 1) {
        addLog(`Reintentando clip "${clip.titulo_hook}" automáticamente (intento 2)...`);
        toast.warning(`Reintentando "${clip.titulo_hook}"...`);
        return await processSingleClip(clip, retryAttempt + 1);
      }

      const errorClip: ProcessedClipState = {
        ...clip,
        estado: 'error',
        progreso: 0,
        etapa_texto: 'Fallo al procesar clip',
        error_msg: err.message || 'Error desconocido durante la transcodificación',
        reintentos: retryAttempt,
      };

      setClipsQueue(prev => prev.map(c => c.id === clip.id ? errorClip : c));
      toast.error(`Fallo al procesar "${clip.titulo_hook}"`);
      return errorClip;
    }
  };

  /**
   * Sequential Queue Processor (one clip at a time)
   */
  const startSequentialProcessing = async () => {
    if (isProcessingAll) return;

    setIsProcessingAll(true);
    isCancelledRef.current = false;
    addLog(`Iniciando cola secuencial de corte para ${clipsQueue.length} clips...`);

    const pendingClips = clipsQueue.filter(c => c.estado !== 'listo');
    const totalToProcess = pendingClips.length;

    if (totalToProcess === 0) {
      toast.info('Todos los clips ya han sido procesados');
      setIsProcessingAll(false);
      return;
    }

    let processedCount = 0;

    for (let i = 0; i < clipsQueue.length; i++) {
      if (isCancelledRef.current) {
        addLog('Procesamiento cancelado por el usuario.');
        break;
      }

      const clip = clipsQueue[i];
      if (clip.estado === 'listo') {
        continue;
      }

      setCurrentIndex(i);
      processedCount++;
      addLog(`[Cola ${processedCount}/${totalToProcess}] Procesando clip #${i + 1}: "${clip.titulo_hook}"`);

      await processSingleClip(clip, 0);

      // Brief delay between clips to give GC time to free buffer memory
      await new Promise(res => setTimeout(res, 400));
    }

    // Update project state to 'clips_listos'
    if (isSupabaseConfigured && user) {
      try {
        await (supabase.from('proyectos') as any)
          .update({
            estado: 'clips_listos',
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', effectiveId);
      } catch {}
    }

    setIsProcessingAll(false);
    setCurrentIndex(-1);
    addLog('¡Cola de procesamiento de clips finalizada!');
    toast.success('¡Todos los clips seleccionados han sido generados!');
  };

  // Single clip manual retry
  const handleRetrySingle = (clip: ProcessedClipState) => {
    processSingleClip(clip, 0);
  };

  // Download cut clip file (Sanitized: {titulo_proyecto}-clip-{n}.mp4)
  const handleDownloadClip = async (clip: ProcessedClipState) => {
    const clipIndexMatch = clip.id.match(/\d+/);
    const clipIndex = clipIndexMatch ? parseInt(clipIndexMatch[0], 10) : 1;

    const targetUrl = clip.video_short_url || clip.video_vertical_url || clip.preview_url;
    const targetBucketPath = clip.short_bucket_path || clip.vertical_bucket_path || clip.bucket_path;

    await descargarClipMP4({
      proyectoTitulo: proyecto?.titulo || proyecto?.nombre || 'clipforge_proyecto',
      clipIndex,
      clipId: clip.id,
      videoUrl: targetUrl,
      bucketPath: targetBucketPath,
      aspectRatio: clip.video_short_url || clip.video_vertical_url ? '9:16' : '16:9',
    });
  };

  const handleCopyLink = async (clip: ProcessedClipState) => {
    const targetUrl = clip.video_short_url || clip.video_vertical_url || clip.preview_url;
    if (!targetUrl) {
      toast.error('No hay ningún enlace disponible para este clip');
      return;
    }
    await copiarEnlacePublicoClip(targetUrl, clip.titulo_hook || proyecto?.titulo);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  /**
   * Updates focus tracking mode for a clip ('rostro' | 'deportes' | 'centrado')
   */
  const handleUpdateEnfoque = (clipId: string, enfoque: TipoEnfoque) => {
    setClipsQueue(prev => prev.map(c => c.id === clipId ? { ...c, enfoque } : c));
    const labels: Record<TipoEnfoque, string> = {
      rostro: 'Rostro (MediaPipe BlazeFace)',
      deportes: 'Modo Deportes (Movimiento en cuadrícula 8x6)',
      centrado: 'Recorte Centrado 9:16',
    };
    toast.info(`Enfoque seleccionado: ${labels[enfoque]}`);
  };

  /**
   * Updates subtitle style preset for a clip ('moderno' | 'neon' | 'minimal')
   */
  const handleUpdateEstiloSubtitulos = (clipId: string, estilo: SubtitleStylePreset) => {
    setClipsQueue(prev => prev.map(c => c.id === clipId ? { ...c, estilo_subtitulos: estilo } : c));
    toast.info(`Estilo de subtítulos: ${SUBTITLE_STYLES[estilo]?.name || estilo}`);
  };

  /**
   * Toggles the live canvas preview for subtitles
   */
  const handleToggleSubtitlePreview = (clipId: string) => {
    setClipsQueue(prev => prev.map(c => c.id === clipId ? { ...c, show_subtitle_preview: !c.show_subtitle_preview } : c));
  };

  /**
   * Updates viral hook metadata (titles, cta, hashtags, description, hook subtitle)
   */
  const handleUpdateViralMetadata = (
    clipId: string,
    data: {
      titulo_hook: string;
      cta?: string;
      hashtags?: string[];
      descripcion?: string;
      mejor_momento_primera_frase?: string;
      titulos_sugeridos?: string[];
      ctas_sugeridos?: string[];
    }
  ) => {
    setClipsQueue(prev =>
      prev.map(c =>
        c.id === clipId
          ? {
              ...c,
              titulo_hook: data.titulo_hook,
              cta: data.cta,
              hashtags: data.hashtags,
              descripcion: data.descripcion,
              mejor_momento_primera_frase: data.mejor_momento_primera_frase,
              titulos_sugeridos: data.titulos_sugeridos,
              ctas_sugeridos: data.ctas_sugeridos,
            }
          : c
      )
    );

    // Persist changes to Supabase if connected
    if (isSupabaseConfigured && user) {
      (supabase.from('clips') as any)
        .update({
          titulo_hook: data.titulo_hook,
          cta: data.cta,
          hashtags: data.hashtags,
          descripcion: data.descripcion,
          mejor_momento_primera_frase: data.mejor_momento_primera_frase,
        })
        .eq('id', clipId)
        .then(() => {
          // silently synced
        })
        .catch((err: any) => {
          console.warn('Sync clip viral meta error:', err);
        });
    }

    // Persist in localStorage
    try {
      const stored = localStorage.getItem(`clipforge_clips_${effectiveId}`);
      if (stored) {
        const list = JSON.parse(stored);
        const updatedList = list.map((item: any) =>
          item.id === clipId
            ? {
                ...item,
                titulo_hook: data.titulo_hook,
                cta: data.cta,
                hashtags: data.hashtags,
                descripcion: data.descripcion,
                mejor_momento_primera_frase: data.mejor_momento_primera_frase,
              }
            : item
        );
        localStorage.setItem(`clipforge_clips_${effectiveId}`, JSON.stringify(updatedList));
      }
    } catch (e) {
      console.warn('Error saving viral meta to localstorage:', e);
    }
  };

  /**
   * Converts a horizontal clip to smart reframed vertical 9:16 (MediaPipe, Motion 8x6, or Centered + FFmpeg)
   */
  const handleConvertToVertical = async (clip: ProcessedClipState, overrideEnfoque?: TipoEnfoque) => {
    const selectedEnfoque: TipoEnfoque = overrideEnfoque || clip.enfoque || 'rostro';
    const modeLabel = selectedEnfoque === 'deportes'
      ? 'Modo Deportes (Movimiento 8x6)'
      : selectedEnfoque === 'centrado'
      ? 'Modo Centrado'
      : 'Detección Facial MediaPipe';

    addLog(`Iniciando encuadre inteligente 9:16 [${modeLabel}] para "${clip.titulo_hook}"...`);

    setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
      ...c,
      enfoque: selectedEnfoque,
      vertical_estado: 'procesando',
      vertical_progreso: 5,
      vertical_etapa_texto: selectedEnfoque === 'deportes'
        ? 'Iniciando detección de movimiento en cuadrícula 8x6...'
        : selectedEnfoque === 'centrado'
        ? 'Aplicando encuadre 9:16 centrado...'
        : 'Iniciando escaneo facial MediaPipe...',
    } : c));

    try {
      // 1. Download or use cached master video blob
      const videoBlob = await getOriginalVideoBlob();

      // Progress reporting
      const onProgress = (p: VerticalCropProgress) => {
        setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
          ...c,
          vertical_progreso: p.percent,
          vertical_etapa_texto: p.detail,
        } : c));
      };

      // 2. Generate vertical 9:16 short with Face Tracking, Motion or Centered
      const result = await generarShortVertical({
        clipId: clip.id,
        videoSource: videoBlob,
        inicioSeg: clip.inicio_seg,
        finSeg: clip.fin_seg || (clip.inicio_seg + clip.duracion_seg),
        enfoque: selectedEnfoque,
        onProgress,
        segmentDuration: 1.0,
      });

      addLog(`Encuadre 9:16 completado para "${clip.titulo_hook}". Modo: ${result.enfoqueUsado}. Puntos/rostros: ${result.facesCount}. Tamaño: ${(result.blob.size / (1024 * 1024)).toFixed(2)} MB.`);

      // 3. Upload vertical MP4 to Supabase Storage
      let verticalUrl = result.previewUrl;
      const userId = user?.id || 'user-demo';
      const verticalBucketPath = `${userId}/${effectiveId}/clips/clip_${clip.id}_vertical.mp4`;

      if (isSupabaseConfigured && user) {
        onProgress({
          clipId: clip.id,
          percent: 96,
          stage: 'completado',
          detail: 'Guardando Short 9:16 en Supabase Storage...',
        });

        try {
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(verticalBucketPath, result.blob, {
              upsert: true,
              contentType: 'video/mp4',
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('media')
              .getPublicUrl(verticalBucketPath);

            if (publicUrlData?.publicUrl) {
              verticalUrl = publicUrlData.publicUrl;
            }

            // Update clips table
            await (supabase.from('clips') as any).upsert({
              id: clip.id,
              proyecto_id: effectiveId,
              inicio_seg: clip.inicio_seg,
              fin_seg: clip.fin_seg,
              puntuacion_viral: clip.puntuacion_viral,
              titulo_hook: clip.titulo_hook,
              video_vertical_url: verticalUrl,
            });

            addLog(`Short 9:16 subido a bucket: ${verticalBucketPath}`);
          }
        } catch (uploadErr) {
          console.warn('Vertical storage upload error:', uploadErr);
        }
      }

      // Update local storage
      try {
        const stored = localStorage.getItem(`clipforge_clips_${effectiveId}`);
        const currentList = stored ? JSON.parse(stored) : [];
        const idx = currentList.findIndex((item: any) => item.id === clip.id);
        const updatedItem = {
          ...clip,
          enfoque: selectedEnfoque,
          enfoque_usado: result.enfoqueUsado,
          video_vertical_url: verticalUrl,
          vertical_bucket_path: verticalBucketPath,
          vertical_estado: 'listo',
          faces_count: result.facesCount,
          has_faces: result.hasFaces,
        };
        if (idx >= 0) {
          currentList[idx] = updatedItem;
        } else {
          currentList.push(updatedItem);
        }
        localStorage.setItem(`clipforge_clips_${effectiveId}`, JSON.stringify(currentList));
      } catch (e) {
        console.warn('Local storage error:', e);
      }

      setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
        ...c,
        enfoque: selectedEnfoque,
        enfoque_usado: result.enfoqueUsado,
        vertical_estado: 'listo',
        vertical_progreso: 100,
        vertical_etapa_texto: result.enfoqueUsado === 'deportes'
          ? `Short 9:16 generado con Modo Deportes (${result.facesCount} puntos de acción)`
          : result.enfoqueUsado === 'centrado'
          ? 'Short 9:16 generado con encuadre centrado'
          : result.hasFaces
          ? `Short 9:16 generado (${result.facesCount} detecciones faciales)`
          : 'Short 9:16 generado (encuadre centrado)',
        video_vertical_url: verticalUrl,
        vertical_bucket_path: verticalBucketPath,
        faces_count: result.facesCount,
        has_faces: result.hasFaces,
      } : c));

      toast.success(`Short 9:16 de "${clip.titulo_hook}" listo (${modeLabel})`);

    } catch (err: any) {
      console.error(`Error vertical framing for clip ${clip.id}:`, err);
      addLog(`Error en encuadre vertical "${clip.titulo_hook}": ${err.message || err}`);

      setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
        ...c,
        vertical_estado: 'error',
        vertical_progreso: 0,
        vertical_etapa_texto: 'Error en encuadre vertical',
      } : c));

      toast.error(`Fallo al convertir a vertical: ${err.message || 'Error desconocido'}`);
    }
  };

  /**
   * Retrieves words from Whisper transcript or generates fallback words for the clip
   */
  const getWordsForClip = (clip: ProcessedClipState): SubtitleWord[] => {
    if (clip.subtitulos_palabras && clip.subtitulos_palabras.length > 0) {
      return clip.subtitulos_palabras;
    }

    const subsJson = proyecto?.subtitulos_json as any;
    if (subsJson) {
      if (Array.isArray(subsJson.words) && subsJson.words.length > 0) {
        const matching = subsJson.words.filter(
          (w: any) => Number(w.start || 0) >= clip.inicio_seg - 0.5 && Number(w.end || 0) <= clip.fin_seg + 0.5
        );
        if (matching.length > 0) {
          return matching.map((w: any) => ({
            word: w.word || w.text || '',
            start: Number(w.start || 0),
            end: Number(w.end || 0),
            confidence: w.confidence,
            isKeyWord: w.isKeyWord ?? (String(w.word || '').length > 5 || /[!¡?¿0-9%]/.test(String(w.word || ''))),
          }));
        }
      }

      if (Array.isArray(subsJson.segments) && subsJson.segments.length > 0) {
        const extracted: SubtitleWord[] = [];
        for (const seg of subsJson.segments) {
          if (seg.end < clip.inicio_seg - 0.5 || seg.start > clip.fin_seg + 0.5) continue;
          if (Array.isArray(seg.words) && seg.words.length > 0) {
            for (const w of seg.words) {
              extracted.push({
                word: w.word || w.text || '',
                start: Number(w.start || 0),
                end: Number(w.end || 0),
                confidence: w.confidence,
                isKeyWord: w.isKeyWord,
              });
            }
          } else if (seg.text) {
            const segWords = seg.text.trim().split(/\s+/);
            const dur = Math.max(0.5, (seg.end || seg.start + 2) - seg.start);
            const step = dur / Math.max(1, segWords.length);
            segWords.forEach((word: string, i: number) => {
              extracted.push({
                word,
                start: seg.start + i * step,
                end: seg.start + (i + 1) * step,
                isKeyWord: word.length > 5 || /[!¡?¿0-9%]/.test(word),
              });
            });
          }
        }
        if (extracted.length > 0) return extracted;
      }
    }

    const fallbackText = `${clip.titulo_hook}. ${clip.razon || ''} ${clip.cta || ''}`.trim();
    return generarPalabrasFallback(fallbackText, clip.duracion_seg || (clip.fin_seg - clip.inicio_seg));
  };

  /**
   * Generates complete Short: Vertical 9:16 framing + Burnt-in ASS subtitles (Ssemble style) + Optional Hook
   */
  const handleGenerarShortCompleto = async (
    clip: ProcessedClipState,
    overrideStyle?: SubtitleStylePreset,
    overrideHookPhrase?: string
  ) => {
    const selectedStyle = overrideStyle || clip.estilo_subtitulos || 'moderno';
    const selectedEnfoque = clip.enfoque || 'rostro';
    const hookTextToBurn = overrideHookPhrase !== undefined
      ? overrideHookPhrase
      : (clip.mejor_momento_primera_frase || clip.titulo_hook);
    
    addLog(`Iniciando generación de Short Completo (Vertical 9:16 + Subtítulos [${SUBTITLE_STYLES[selectedStyle]?.label || selectedStyle}] + Hook: "${hookTextToBurn}") para "${clip.titulo_hook}"...`);

    setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
      ...c,
      estilo_subtitulos: selectedStyle,
      mejor_momento_primera_frase: hookTextToBurn,
      short_estado: 'procesando',
      short_progreso: 5,
      short_etapa_texto: 'Preparando vídeo y transcripción de subtítulos...',
    } : c));

    try {
      // 1. Ensure we have vertical 9:16 video blob
      let vertBlob: Blob;

      if (clip.video_vertical_url) {
        setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
          ...c,
          short_progreso: 15,
          short_etapa_texto: 'Cargando vídeo vertical 9:16...',
        } : c));
        const res = await fetch(clip.video_vertical_url);
        vertBlob = await res.blob();
      } else {
        setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
          ...c,
          short_progreso: 10,
          short_etapa_texto: `Paso 1/2: Encuadrando vídeo a 9:16 (${selectedEnfoque})...`,
        } : c));
        const masterBlob = await getOriginalVideoBlob();
        const vertRes = await generarShortVertical({
          clipId: clip.id,
          videoSource: masterBlob,
          inicioSeg: clip.inicio_seg,
          finSeg: clip.fin_seg || (clip.inicio_seg + clip.duracion_seg),
          enfoque: selectedEnfoque,
          onProgress: (p) => {
            setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
              ...c,
              short_progreso: Math.round(10 + p.percent * 0.35),
              short_etapa_texto: `Paso 1/2: ${p.detail}`,
            } : c));
          },
          segmentDuration: 1.0,
        });
        vertBlob = vertRes.blob;
      }

      // 2. Get words for this clip
      const words = getWordsForClip(clip);

      // 3. Burn ASS subtitles using FFmpeg WASM (with initial hook subtitle in 0-1.5s and watermark check)
      const isFreePlan = !profile?.plan || profile.plan === 'gratis';
      const burnRes = await quemarSubtitulosVideo({
        clipId: clip.id,
        verticalVideoBlob: vertBlob,
        words,
        inicioSeg: clip.inicio_seg,
        finSeg: clip.fin_seg || (clip.inicio_seg + clip.duracion_seg),
        stylePreset: selectedStyle,
        hookText: hookTextToBurn,
        marcaDeAgua: isFreePlan,
        onProgress: (p) => {
          setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
            ...c,
            short_progreso: Math.round(45 + p.percent * 0.45),
            short_etapa_texto: `Paso 2/2: ${p.detail}`,
          } : c));
        },
      });

      addLog(`Subtítulos quemados exitosamente en "${clip.titulo_hook}". Frases generadas: ${burnRes.groupsCount}. Tamaño: ${(burnRes.blob.size / (1024 * 1024)).toFixed(2)} MB.`);

      // 4. Upload final Short MP4 to Supabase Storage at: {user_id}/{proyecto_id}/clips/{clip_id}_short.mp4
      let shortUrl = burnRes.previewUrl;
      const userId = user?.id || 'user-demo';
      const shortBucketPath = `${userId}/${effectiveId}/clips/${clip.id}_short.mp4`;

      if (isSupabaseConfigured && user) {
        setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
          ...c,
          short_progreso: 95,
          short_etapa_texto: 'Guardando Short completo en Storage...',
        } : c));

        try {
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(shortBucketPath, burnRes.blob, {
              upsert: true,
              contentType: 'video/mp4',
            });

          if (!uploadError) {
            const { data: pubData } = supabase.storage
              .from('media')
              .getPublicUrl(shortBucketPath);

            if (pubData?.publicUrl) {
              shortUrl = pubData.publicUrl;
            }

            // Update clips DB table
            await (supabase.from('clips') as any).upsert({
              id: clip.id,
              proyecto_id: effectiveId,
              inicio_seg: clip.inicio_seg,
              fin_seg: clip.fin_seg,
              puntuacion_viral: clip.puntuacion_viral,
              titulo_hook: clip.titulo_hook,
              cta: clip.cta,
              hashtags: clip.hashtags,
              descripcion: clip.descripcion,
              mejor_momento_primera_frase: hookTextToBurn,
              video_short_url: shortUrl,
              subtitulos_json: burnRes.assContent,
            });

            addLog(`Short completo guardado en: ${shortBucketPath}`);
          }
        } catch (upErr) {
          console.warn('Short storage upload error:', upErr);
        }
      }

      // Update localStorage
      try {
        const stored = localStorage.getItem(`clipforge_clips_${effectiveId}`);
        const currentList = stored ? JSON.parse(stored) : [];
        const idx = currentList.findIndex((item: any) => item.id === clip.id);
        const updatedItem = {
          ...clip,
          estilo_subtitulos: selectedStyle,
          video_short_url: shortUrl,
          short_bucket_path: shortBucketPath,
          short_estado: 'listo',
        };
        if (idx >= 0) {
          currentList[idx] = updatedItem;
        } else {
          currentList.push(updatedItem);
        }
        localStorage.setItem(`clipforge_clips_${effectiveId}`, JSON.stringify(currentList));
      } catch (e) {
        console.warn('Local storage error:', e);
      }

      setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
        ...c,
        estilo_subtitulos: selectedStyle,
        video_short_url: shortUrl,
        short_bucket_path: shortBucketPath,
        short_estado: 'listo',
        short_progreso: 100,
        short_etapa_texto: `Short Completo 9:16 + Subtítulos (${SUBTITLE_STYLES[selectedStyle].label})`,
      } : c));

      toast.success(`¡Short completo con subtítulos listo para "${clip.titulo_hook}"!`);

    } catch (err: any) {
      console.error(`Error generando Short completo para clip ${clip.id}:`, err);
      addLog(`Error en Short Completo "${clip.titulo_hook}": ${err.message || err}`);

      setClipsQueue(prev => prev.map(c => c.id === clip.id ? {
        ...c,
        short_estado: 'error',
        short_progreso: 0,
        short_etapa_texto: 'Error generando Short completo',
      } : c));

      toast.error(`Fallo al generar Short: ${err.message || 'Error desconocido'}`);
    }
  };

  /**
   * Batch process all clips to complete Shorts
   */
  const handleGenerarTodosLosShorts = async () => {
    const pendingShorts = clipsQueue.filter(c => c.estado === 'listo');
    if (pendingShorts.length === 0) {
      toast.info('Corta los clips primero antes de generar los Shorts completos.');
      return;
    }

    addLog(`Iniciando generación en lote de ${pendingShorts.length} Shorts completos...`);
    for (let i = 0; i < pendingShorts.length; i++) {
      const clip = pendingShorts[i];
      await handleGenerarShortCompleto(clip);
    }
    toast.success('¡Todos los Shorts completos con subtítulos han sido generados!');
  };

  const completedCount = clipsQueue.filter(c => c.estado === 'listo').length;
  const inProgressCount = clipsQueue.filter(c => c.estado === 'procesando').length;
  const currentProcessingClip = currentIndex >= 0 ? clipsQueue[currentIndex] : null;

  return (
    <div className="flex-1 bg-[#0a0a12] text-slate-100 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate?.(`/dashboard/proyecto/${effectiveId}`)}
              className="p-2.5 rounded-xl bg-[#141424] border border-purple-900/40 hover:bg-purple-950/60 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Volver al análisis del proyecto"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Corte & Generación de Clips
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  <Scissors className="w-3.5 h-3.5 text-pink-400" />
                  FFmpeg WASM Multithread
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Proyecto: <span className="text-purple-300 font-medium">{proyecto?.titulo || displayTitle(effectiveId)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {completedCount > 0 && (
              <button
                onClick={() => {
                  setPendingAction(() => handleGenerarTodosLosShorts);
                  setShowConfirmModal(true);
                }}
                disabled={isProcessingAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-pink-600/20 transition-all cursor-pointer"
                title="Generar 9:16 + subtítulos quemados para todos los clips disponibles"
              >
                <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                <span>Generar Todos los Shorts</span>
              </button>
            )}

            <button
              onClick={() => {
                setPendingAction(() => startSequentialProcessing);
                setShowConfirmModal(true);
              }}
              disabled={isProcessingAll || clipsQueue.length === 0 || completedCount === clipsQueue.length}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
            >
              {isProcessingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-pink-300" />
                  <span>Procesando cola ({completedCount}/{clipsQueue.length})...</span>
                </>
              ) : completedCount === clipsQueue.length ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Todos los clips completados</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-yellow-300" />
                  <span>Iniciar Corte Secuencial</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SECTION 1: Master Status / Progress Banner */}
        <div className="bg-gradient-to-br from-[#131326] via-[#16162d] to-[#121222] border border-purple-900/50 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
                isProcessingAll 
                  ? 'bg-purple-950 border-purple-500/60 text-pink-400 animate-pulse' 
                  : completedCount === clipsQueue.length && clipsQueue.length > 0
                  ? 'bg-emerald-950 border-emerald-500/60 text-emerald-400'
                  : 'bg-[#181830] border-purple-900/40 text-cyan-400'
              }`}>
                {isProcessingAll ? <Scissors className="w-6 h-6 animate-bounce" /> : <Film className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {isProcessingAll ? (
                    <>
                      <span>Procesando {completedCount + inProgressCount} de {clipsQueue.length} clips...</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-800">
                        Cola Secuencial Activa
                      </span>
                    </>
                  ) : completedCount === clipsQueue.length && clipsQueue.length > 0 ? (
                    <span className="text-emerald-400">¡Todos los {clipsQueue.length} clips han sido cortados con éxito!</span>
                  ) : (
                    <span>Cola de renderizado lista ({completedCount} de {clipsQueue.length} listos)</span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentProcessingClip ? (
                    <span className="text-pink-300">
                      Clip actual: <strong>"{currentProcessingClip.titulo_hook}"</strong> — {currentProcessingClip.etapa_texto}
                    </span>
                  ) : (
                    'Los clips se procesan uno a uno en el navegador para optimizar memoria RAM con FFmpeg WASM y se guardan en el bucket.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="bg-[#1a1a36] px-4 py-2 rounded-xl border border-purple-900/40 text-center">
                <span className="text-slate-400 block text-[10px]">Progreso Global</span>
                <span className="text-base font-bold text-white font-mono">
                  {clipsQueue.length > 0 ? Math.round((completedCount / clipsQueue.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Master Progress Bar */}
          <div className="w-full bg-[#0e0e1a] h-3 rounded-full overflow-hidden border border-purple-950">
            <div 
              className="bg-gradient-to-r from-purple-600 via-indigo-500 to-pink-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${clipsQueue.length > 0 ? (completedCount / clipsQueue.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* SECTION 2: Grid of Clips & Active Previews */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Clips List & Interactive Cards (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Segmentos a Cortar ({clipsQueue.length})</span>
              </h2>
              <span className="text-xs text-slate-400">
                Calidad: <strong className="text-cyan-300">H.264 CRF 23 Fast</strong>
              </span>
            </div>

            {loading ? (
              <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-12 text-center text-purple-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <span className="text-xs">Cargando cola de clips...</span>
              </div>
            ) : clipsQueue.length === 0 ? (
              <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-8 text-center text-slate-400">
                No hay clips en cola. Vuelve a la página de análisis para seleccionar momentos virales.
              </div>
            ) : (
              clipsQueue.map((clip, index) => {
                const isCurrent = currentIndex === index;
                const isListo = clip.estado === 'listo';
                const isError = clip.estado === 'error';
                const isProcesando = clip.estado === 'procesando';

                return (
                  <div
                    key={clip.id}
                    className={`bg-[#121222] border rounded-2xl p-5 transition-all space-y-4 ${
                      isProcesando
                        ? 'border-pink-500/80 shadow-lg shadow-pink-950/30 bg-[#16162d]'
                        : isListo
                        ? 'border-emerald-500/40 hover:border-emerald-500/70'
                        : isError
                        ? 'border-rose-500/50'
                        : 'border-purple-900/40 hover:border-purple-800'
                    }`}
                  >
                    {/* Header Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                          isListo
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isProcesando
                            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 animate-pulse'
                            : 'bg-purple-950 text-purple-300 border border-purple-800/40'
                        }`}>
                          {isListo ? <Check className="w-4 h-4" /> : `#${index + 1}`}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white">{clip.titulo_hook}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-950 text-pink-300 border border-purple-800 font-mono">
                              ⚡ {clip.puntuacion_viral} pts
                            </span>
                            {clip.video_vertical_url && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono flex items-center gap-1 ${
                                clip.enfoque_usado === 'deportes'
                                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                                  : clip.enfoque_usado === 'centrado'
                                  ? 'bg-slate-900 text-slate-300 border-slate-700'
                                  : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              }`}>
                                {clip.enfoque_usado === 'deportes' ? (
                                  <>
                                    <Activity className="w-3 h-3 text-amber-400" />
                                    9:16 Deportes (8x6)
                                  </>
                                ) : clip.enfoque_usado === 'centrado' ? (
                                  <>
                                    <Target className="w-3 h-3 text-slate-300" />
                                    9:16 Centrado
                                  </>
                                ) : (
                                  <>
                                    <Smartphone className="w-3 h-3 text-cyan-400" />
                                    9:16 Rostro IA
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="flex items-center gap-1 font-mono text-cyan-300">
                              <Clock className="w-3 h-3" />
                              {formatTime(clip.inicio_seg)} - {formatTime(clip.fin_seg)} ({clip.duracion_seg}s)
                            </span>
                            {clip.bucket_path && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-500 truncate max-w-[180px]">
                                <HardDrive className="w-3 h-3" />
                                {clip.bucket_path.split('/').pop()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Action Buttons, Focus & Subtitles Controls */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 self-end sm:self-auto flex-wrap">
                        {isListo && (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Focus Selector: Rostro | Deportes | Centrado */}
                            <div className="flex items-center gap-1 bg-[#0d0d1b] p-1 rounded-xl border border-purple-900/40">
                              <span className="text-[11px] font-semibold text-slate-400 px-1.5 flex items-center gap-1">
                                <Sliders className="w-3 h-3 text-cyan-400" />
                                Enfoque:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateEnfoque(clip.id, 'rostro')}
                                disabled={clip.vertical_estado === 'procesando' || clip.short_estado === 'procesando'}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                  (clip.enfoque || 'rostro') === 'rostro'
                                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/40'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-purple-950/40'
                                }`}
                                title="Detección facial con MediaPipe BlazeFace (ideal para personas, entrevistas, vlogs)"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Rostro</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateEnfoque(clip.id, 'deportes')}
                                disabled={clip.vertical_estado === 'procesando' || clip.short_estado === 'procesando'}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                  clip.enfoque === 'deportes'
                                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-900/40'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-amber-950/40'
                                }`}
                                title="Modo Deportes: detecta movimiento acumulado en cuadrícula 8x6 (ideal para deportes, acción y gaming)"
                              >
                                <Activity className="w-3 h-3 text-amber-300" />
                                <span>Deportes</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateEnfoque(clip.id, 'centrado')}
                                disabled={clip.vertical_estado === 'procesando' || clip.short_estado === 'procesando'}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                  clip.enfoque === 'centrado'
                                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-900/40'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-cyan-950/40'
                                }`}
                                title="Recorte 9:16 centrado estático"
                              >
                                <Target className="w-3 h-3 text-cyan-300" />
                                <span>Centrado</span>
                              </button>
                            </div>

                            {/* Subtitle Style Selector: Moderno | Neón | Minimal */}
                            <div className="flex items-center gap-1 bg-[#0d0d1b] p-1 rounded-xl border border-pink-900/40">
                              <span className="text-[11px] font-semibold text-slate-400 px-1.5 flex items-center gap-1">
                                <Subtitles className="w-3 h-3 text-pink-400" />
                                Subs:
                              </span>
                              {(['moderno', 'neon', 'minimal'] as SubtitleStylePreset[]).map(st => {
                                const active = (clip.estilo_subtitulos || 'moderno') === st;
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleUpdateEstiloSubtitulos(clip.id, st)}
                                    disabled={clip.short_estado === 'procesando'}
                                    className={`px-2 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                                      active
                                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-sm shadow-pink-950'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-pink-950/30'
                                    }`}
                                    title={SUBTITLE_STYLES[st].description}
                                  >
                                    {st === 'moderno' ? 'Moderno' : st === 'neon' ? 'Neón' : 'Minimal'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {isListo ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Subtitle Live Preview Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleSubtitlePreview(clip.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                clip.show_subtitle_preview
                                  ? 'bg-pink-950 text-pink-300 border-pink-600 shadow-sm'
                                  : 'bg-[#15152a] text-slate-300 border-purple-900/40 hover:bg-purple-950/50'
                              }`}
                              title="Ver cómo lucirán los subtítulos estilizados sobre el frame"
                            >
                              <Eye className="w-3.5 h-3.5 text-pink-400" />
                              <span>{clip.show_subtitle_preview ? 'Ocultar Preview' : 'Vista Previa Subs'}</span>
                            </button>

                            {/* Full Short Generator (9:16 + Subtitles burned) */}
                            {clip.short_estado === 'procesando' ? (
                              <button
                                disabled
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-950 text-pink-300 border border-pink-700/60 animate-pulse cursor-not-allowed"
                              >
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                                <span>Generando Short...</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGenerarShortCompleto(clip)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-md shadow-pink-950 transition-all cursor-pointer"
                                title="Genera el Short final: Recorte 9:16 inteligente + subtítulos animados quemados con FFmpeg"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                <span>{clip.video_short_url ? 'Regenerar Short 9:16 + Subs' : 'Generar Short Completo'}</span>
                              </button>
                            )}

                            {/* Smart framing 9:16 button (if user just wants vertical without subtitles) */}
                            {clip.vertical_estado === 'procesando' ? (
                              <button
                                disabled
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700/60 animate-pulse cursor-not-allowed"
                              >
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                <span>9:16...</span>
                              </button>
                            ) : !clip.video_vertical_url ? (
                              <button
                                onClick={() => handleConvertToVertical(clip)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a36] text-cyan-300 border border-cyan-800/40 hover:bg-cyan-950/60 transition-colors cursor-pointer"
                                title="Convierte sólo a vertical 9:16 sin quemar subtítulos"
                              >
                                <Smartphone className="w-3.5 h-3.5 text-cyan-300" />
                                <span>Solo Vertical</span>
                              </button>
                            ) : null}

                            <button
                              onClick={() => onNavigate?.(`/dashboard/proyecto/${effectiveId}/clips/${clip.id}/editar`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1d1a38] hover:bg-[#2a2650] text-purple-300 border border-purple-700/60 transition-all cursor-pointer shadow-sm"
                              title="Abrir editor avanzado: recortar inicio/fin en línea de tiempo, aspecto (9:16/1:1/16:9), subtítulos y hooks"
                            >
                              <Sliders className="w-3.5 h-3.5 text-pink-400" />
                              <span>Editar</span>
                            </button>

                            <button
                              onClick={() => handleDownloadClip(clip)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900 transition-colors cursor-pointer"
                              title="Descargar archivo MP4 original cortado"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Descargar</span>
                            </button>
                            <button
                              onClick={() => handleCopyLink(clip)}
                              className="p-1.5 rounded-lg bg-[#1a1a36] text-slate-300 border border-purple-900/40 hover:text-white transition-colors cursor-pointer"
                              title="Copiar enlace del clip"
                            >
                              {copiedId === clip.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                            </button>
                          </div>
                        ) : isError ? (
                          <button
                            onClick={() => handleRetrySingle(clip)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-700/50 hover:bg-rose-900 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reintentar</span>
                          </button>
                        ) : !isProcessingAll ? (
                          <button
                            onClick={() => processSingleClip(clip, 0)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-700/50 hover:bg-purple-900 hover:text-white transition-colors cursor-pointer"
                          >
                            <Scissors className="w-3.5 h-3.5 text-pink-400" />
                            <span>Cortar Este</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">En espera...</span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (when cutting) */}
                    {isProcesando && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-pink-300 font-medium">
                            {clip.etapa_texto}
                          </span>
                          <span className="font-mono text-slate-400">{clip.progreso}%</span>
                        </div>
                        <div className="w-full bg-[#18182e] h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-200 bg-gradient-to-r from-purple-500 to-pink-500"
                            style={{ width: `${clip.progreso}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Vertical Framing Progress Bar */}
                    {clip.vertical_estado === 'procesando' && (
                      <div className="space-y-1.5 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-cyan-300 font-medium flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            {clip.vertical_etapa_texto || 'Detectando rostros y calculando encuadre dinámico...'}
                          </span>
                          <span className="font-mono text-cyan-400 font-bold">{clip.vertical_progreso || 0}%</span>
                        </div>
                        <div className="w-full bg-[#0e1726] h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-200 bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500"
                            style={{ width: `${clip.vertical_progreso || 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Complete Short (9:16 + Subtitles) Burning Progress Bar */}
                    {clip.short_estado === 'procesando' && (
                      <div className="space-y-1.5 p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-pink-950/40 to-indigo-950/40 border border-pink-700/50 shadow-lg">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-pink-300 font-semibold flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                            {clip.short_etapa_texto || 'Generando Short vertical y quemando subtítulos ASS con FFmpeg...'}
                          </span>
                          <span className="font-mono text-pink-400 font-bold">{clip.short_progreso || 0}%</span>
                        </div>
                        <div className="w-full bg-[#0e0e1a] h-2.5 rounded-full overflow-hidden border border-pink-900/30">
                          <div
                            className="h-full transition-all duration-200 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400"
                            style={{ width: `${clip.short_progreso || 0}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Estilo seleccionado: <strong className="text-pink-300 capitalize">{clip.estilo_subtitulos || 'moderno'}</strong>. Aplicando karaoke sincronizado palabra por palabra y exportando a 1080x1920 MP4.
                        </p>
                      </div>
                    )}

                    {/* Live Subtitle Preview Accordion */}
                    {clip.show_subtitle_preview && isListo && (
                      <div className="pt-2">
                        <SubtitlePreview
                          videoUrl={clip.video_vertical_url || clip.preview_url || ''}
                          words={getWordsForClip(clip)}
                          selectedStyle={(clip.estilo_subtitulos as SubtitleStylePreset) || 'moderno'}
                          onStyleChange={(st) =>
                            setClipsQueue((prev) =>
                              prev.map((c) => (c.id === clip.id ? { ...c, estilo_subtitulos: st } : c))
                            )
                          }
                          inicioSeg={clip.inicio_seg}
                          finSeg={clip.fin_seg}
                          marcaDeAgua={profile?.plan === 'gratis' || !profile?.plan}
                        />
                      </div>
                    )}

                    {/* VIRAL HOOKS SECTION ("Tu Short viral" - Llama 3.3 70B & Clickbait Honesto) */}
                    {isListo && (
                      <div className="pt-2">
                        <ViralShortSection
                          clipId={clip.id}
                          proyectoId={effectiveId}
                          transcripcion={proyecto?.transcripcion || clip.texto_transcrito || ''}
                          duracionSeg={clip.duracion_seg}
                          currentTituloHook={clip.titulo_hook}
                          currentCta={clip.cta}
                          currentHashtags={clip.hashtags}
                          currentDescripcion={clip.descripcion}
                          currentMejorMomentoPrimeraFrase={clip.mejor_momento_primera_frase}
                          titulosSugeridos={clip.titulos_sugeridos}
                          ctasSugeridos={clip.ctas_sugeridos}
                          hookComoPrimerSubtitulo={clip.hook_como_primer_subtitulo}
                          onUpdateViralMeta={(data) => handleUpdateViralMetadata(clip.id, data)}
                          onGenerarShortConHook={async (hookPhrase) => {
                            await handleGenerarShortCompleto(clip, clip.estilo_subtitulos, hookPhrase);
                          }}
                          isProcessingShort={clip.short_estado === 'procesando'}
                        />
                      </div>
                    )}

                    {/* Video Previews (Short Final vs 9:16 vs 16:9) */}
                    {isListo && (
                      <div className="pt-3 border-t border-purple-900/20 space-y-4">
                        
                        {/* FEATURE 1: Complete Short Final (Vertical 9:16 + Subtitles burned) */}
                        {clip.video_short_url ? (
                          <div className="bg-gradient-to-br from-[#120d20] via-[#0d0d1b] to-[#12122b] border border-pink-500/40 rounded-2xl p-4.5 space-y-3.5 shadow-xl shadow-pink-950/20">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-900/30 pb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-pink-950 border border-pink-600/50">
                                  <Sparkles className="w-4 h-4 text-yellow-300" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                    Short Final Listo (9:16 + Subtítulos Quemados)
                                  </span>
                                  <p className="text-[11px] text-pink-300 font-mono">
                                    Estilo: {SUBTITLE_STYLES[clip.estilo_subtitulos || 'moderno'].name} • Arial Bold • Karaoke Resaltado
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-700">
                                  1080x1920 (9:16)
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                              {/* Left: Original 16:9 for reference */}
                              <div className="md:col-span-5 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="font-semibold text-slate-300">1. Original (16:9)</span>
                                  <span className="font-mono text-[10px] text-slate-500">1920x1080</span>
                                </div>
                                <div className="aspect-video bg-black rounded-lg overflow-hidden border border-purple-900/40 relative">
                                  <video
                                    src={clip.preview_url}
                                    controls
                                    playsInline
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>

                              {/* Right: Master 9:16 Short with Subtitles */}
                              <div className="md:col-span-7 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-pink-300">
                                  <span className="font-bold flex items-center gap-1">
                                    <Smartphone className="w-3.5 h-3.5 text-pink-400" />
                                    2. Short Vertical con Subtítulos Ssemble
                                  </span>
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-pink-950 text-pink-300 border border-pink-700">
                                    libx264 ASS Burned
                                  </span>
                                </div>
                                <div className="aspect-[9/16] max-h-[340px] mx-auto bg-black rounded-xl overflow-hidden border-2 border-pink-500/60 relative shadow-2xl shadow-pink-950/60">
                                  <video
                                    src={clip.video_short_url}
                                    controls
                                    playsInline
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Action CTA & Editor Navigation */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2.5 border-t border-purple-900/20">
                              <div className="text-xs text-slate-400">
                                {clip.cta && (
                                  <p>
                                    CTA sugerido: <strong className="text-pink-300">"{clip.cta}"</strong>
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(clip)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a36] text-slate-300 border border-purple-900/40 hover:text-white transition-colors cursor-pointer"
                                  title="Copiar enlace público del vídeo"
                                >
                                  {copiedId === clip.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="text-emerald-400">¡Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Share2 className="w-3.5 h-3.5" />
                                      <span>Copiar Enlace</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadClip(clip)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-pink-950 text-pink-300 border border-pink-700/70 hover:bg-pink-900 transition-colors cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Descargar Short MP4</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUploadModalClip(clip)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/60 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                  title="Publicar directamente en YouTube Shorts"
                                >
                                  <Youtube className="w-3.5 h-3.5 fill-white" />
                                  <span>Subir a YouTube</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTiktokExportClip(clip)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-cyan-600 hover:bg-cyan-500 text-black shadow-md shadow-cyan-950/60 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                  title="Exportar paquete listo para TikTok en 1 minuto"
                                >
                                  <span className="font-black text-xs">♪</span>
                                  <span>Exportar para TikTok</span>
                                </button>
                                <button
                                  onClick={() => onNavigate?.(`/dashboard/proyecto/${effectiveId}/clips/${clip.id}/editar`)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md transition-all cursor-pointer"
                                >
                                  <Sliders className="w-3.5 h-3.5 text-yellow-300" />
                                  <span>Abrir en Modo Editor</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : clip.video_vertical_url ? (
                          /* If only vertical version is ready, show Before / After Comparison */
                          <div className="bg-[#0b0b14] border border-cyan-900/40 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Split className="w-4 h-4 text-cyan-400" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                  Comparativa de Encuadre: Antes (16:9) vs Después (9:16)
                                </span>
                              </div>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                clip.enfoque_usado === 'deportes'
                                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                                  : clip.enfoque_usado === 'centrado'
                                  ? 'bg-slate-900 text-slate-300 border-slate-700'
                                  : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              }`}>
                                {clip.enfoque_usado === 'deportes'
                                  ? `Modo Deportes: ${clip.faces_count || 0} puntos de acción`
                                  : clip.enfoque_usado === 'centrado'
                                  ? 'Encuadre Centrado Fijo'
                                  : clip.faces_count
                                  ? `${clip.faces_count} rostros detectados`
                                  : 'Encuadre Centrado'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                              {/* Left: Original 16:9 */}
                              <div className="md:col-span-6 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="font-semibold text-slate-300">1. Original Horizontal (16:9)</span>
                                  <span className="font-mono text-[10px] text-slate-500">1920x1080</span>
                                </div>
                                <div className="aspect-video bg-black rounded-lg overflow-hidden border border-purple-900/40 relative">
                                  <video
                                    src={clip.preview_url}
                                    controls
                                    playsInline
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>

                              {/* Right: Smart Reframed 9:16 */}
                              <div className="md:col-span-6 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-cyan-300">
                                  <span className="font-semibold flex items-center gap-1">
                                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                                    2. Short Vertical con IA (9:16)
                                  </span>
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                                    1080x1920
                                  </span>
                                </div>
                                <div className="aspect-[9/16] max-h-[320px] mx-auto bg-black rounded-lg overflow-hidden border-2 border-cyan-500/50 relative shadow-lg shadow-cyan-950/40">
                                  <video
                                    src={clip.video_vertical_url}
                                    controls
                                    playsInline
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Action CTA & Editor Navigation */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-purple-900/20">
                              <div className="text-xs text-slate-400">
                                {clip.cta && (
                                  <p>
                                    CTA sugerido: <strong className="text-cyan-300">"{clip.cta}"</strong>
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleGenerarShortCompleto(clip)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-sm hover:from-pink-500 hover:to-purple-500 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                  <span>Quemar Subtítulos</span>
                                </button>
                                <a
                                  href={clip.video_vertical_url}
                                  download={`short_vertical_${clip.id}.mp4`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700/60 hover:bg-cyan-900 transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Descargar Short 9:16</span>
                                </a>
                                <button
                                  onClick={() => onNavigate?.(`/dashboard/editor?clip_id=${clip.id}&proyecto_id=${effectiveId}&aspect=9:16`)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md transition-all cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                  <span>Abrir en Editor 9:16</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : clip.preview_url ? (
                          /* Standard 16:9 Clip Preview before converting to 9:16 */
                          <div className="flex flex-col sm:flex-row gap-4 items-start bg-[#0e0e1a]/80 p-3.5 rounded-xl border border-purple-900/30">
                            <div className="w-full sm:w-48 aspect-video bg-black rounded-lg overflow-hidden shrink-0 border border-purple-900/40 relative">
                              <video
                                src={clip.preview_url}
                                controls
                                playsInline
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="flex-1 text-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Clip Horizontal Recortado (16:9)</span>
                                </div>
                              </div>
                              {clip.cta && (
                                <p className="text-slate-300">
                                  <span className="text-slate-400">Call To Action sugerido:</span>{' '}
                                  <strong className="text-cyan-300">"{clip.cta}"</strong>
                                </p>
                              )}
                              <div className="pt-1 flex items-center gap-3 flex-wrap">
                                <button
                                  onClick={() => handleGenerarShortCompleto(clip)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                  <span>Generar Short Completo (9:16 + Subs)</span>
                                </button>
                                <button
                                  onClick={() => handleConvertToVertical(clip)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a36] text-cyan-300 border border-cyan-800/40 hover:bg-cyan-900 transition-all cursor-pointer"
                                >
                                  <Smartphone className="w-3.5 h-3.5 text-cyan-200" />
                                  <span>Solo Vertical 9:16</span>
                                </button>
                                <button
                                  onClick={() => onNavigate?.(`/dashboard/editor?clip_id=${clip.id}&proyecto_id=${effectiveId}`)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a36] text-purple-300 border border-purple-800/40 hover:bg-purple-900/60 transition-all cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                  <span>Abrir en Editor</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Real-Time FFmpeg Console & Storage Info (4 Cols) */}
          <div className="lg:col-span-4 space-y-4 sticky top-6">
            
            {/* Smart Framing Specs Card */}
            <div className="bg-[#121222] border border-cyan-900/40 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Encuadre Inteligente 9:16</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111927]/80 border border-cyan-900/30">
                  <span className="text-slate-400">Modo Rostro</span>
                  <span className="font-mono font-bold text-purple-300">MediaPipe BlazeFace</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111927]/80 border border-cyan-900/30">
                  <span className="text-slate-400">Modo Deportes</span>
                  <span className="font-mono font-bold text-amber-300">Movimiento Cuadrícula 8x6</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111927]/80 border border-cyan-900/30">
                  <span className="text-slate-400">Muestreo</span>
                  <span className="font-mono font-bold text-slate-200">1 cada 4-6 fotogramas</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111927]/80 border border-cyan-900/30">
                  <span className="text-slate-400">Suavizado</span>
                  <span className="font-mono font-bold text-indigo-300">Media móvil (~0.5s)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111927]/80 border border-cyan-900/30">
                  <span className="text-slate-400">Segmentación</span>
                  <span className="font-mono font-bold text-emerald-400">Tramos de 1s + Demuxer</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111927]/80 border border-cyan-900/30">
                  <span className="text-slate-400">Resolución Salida</span>
                  <span className="font-mono font-bold text-pink-300">1080 x 1920 (9:16)</span>
                </div>
              </div>
            </div>

            {/* FFmpeg Tech Specs Card */}
            <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Motor de Transcodificación</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#17172f]/60 border border-purple-900/20">
                  <span className="text-slate-400">Motor</span>
                  <span className="font-mono font-bold text-purple-300">FFmpeg v0.12 WASM</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#17172f]/60 border border-purple-900/20">
                  <span className="text-slate-400">Modo Hilos</span>
                  <span className="font-mono font-bold text-cyan-300">Web Worker Aislado</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#17172f]/60 border border-purple-900/20">
                  <span className="text-slate-400">Video Códec</span>
                  <span className="font-mono font-bold text-slate-200">libx264 (preset fast)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#17172f]/60 border border-purple-900/20">
                  <span className="text-slate-400">Audio Códec</span>
                  <span className="font-mono font-bold text-slate-200">AAC 128k</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#17172f]/60 border border-purple-900/20">
                  <span className="text-slate-400">Gestión de RAM</span>
                  <span className="font-mono font-bold text-emerald-400">Cola 1x1 Secuencial</span>
                </div>
              </div>
            </div>

            {/* Subtitles ASS Engine Tech Specs Card */}
            <div className="bg-[#121222] border border-pink-900/40 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-pink-400" />
                <span>Subtítulos Dinámicos ASS</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a0f26]/70 border border-pink-900/25">
                  <span className="text-slate-400">Estilo Base</span>
                  <span className="font-mono font-bold text-pink-300">Ssemble Karaoke (ASS)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a0f26]/70 border border-pink-900/25">
                  <span className="text-slate-400">Tipografía</span>
                  <span className="font-mono font-bold text-slate-200">Arial Bold ~45px</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a0f26]/70 border border-pink-900/25">
                  <span className="text-slate-400">Borde y Sombra</span>
                  <span className="font-mono font-bold text-cyan-300">Outline=6 + Shadow=3</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a0f26]/70 border border-pink-900/25">
                  <span className="text-slate-400">Karaoke Word-by-Word</span>
                  <span className="font-mono font-bold text-yellow-300">Whisper Timestamps (\k)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a0f26]/70 border border-pink-900/25">
                  <span className="text-slate-400">Quemado de Video</span>
                  <span className="font-mono font-bold text-emerald-400">FFmpeg -vf "ass=subs.ass"</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a0f26]/70 border border-pink-900/25">
                  <span className="text-slate-400">Ajuste de Línea</span>
                  <span className="font-mono font-bold text-purple-300">Máximo 2-3 palabras</span>
                </div>
              </div>
            </div>

            {/* Live Terminal Log Viewer */}
            <div className="bg-[#0b0b14] border border-purple-900/40 rounded-2xl p-4 flex flex-col h-80 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-purple-900/30 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-slate-300">Consola de Eventos</span>
                </div>
                <button
                  onClick={() => setOverallLog([])}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Limpiar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-1.5 scrollbar-thin scrollbar-thumb-purple-900 pr-1">
                {overallLog.length === 0 ? (
                  <span className="text-slate-600 italic">Esperando inicio de tareas de corte...</span>
                ) : (
                  overallLog.map((line, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {line.includes('Error') ? (
                        <span className="text-rose-400">{line}</span>
                      ) : line.includes('completado') || line.includes('exitosamente') ? (
                        <span className="text-emerald-300">{line}</span>
                      ) : line.includes('Procesando') || line.includes('Iniciando') ? (
                        <span className="text-pink-300">{line}</span>
                      ) : (
                        <span>{line}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* YouTube Upload Modal */}
      {uploadModalClip && (
        <YouTubeUploadModal
          isOpen={!!uploadModalClip}
          clip={{
            id: uploadModalClip.id,
            titulo_hook: uploadModalClip.titulo_hook,
            duracion_seg: uploadModalClip.duracion_seg,
            video_short_url: uploadModalClip.video_short_url,
            video_vertical_url: uploadModalClip.video_vertical_url,
            preview_url: uploadModalClip.preview_url,
            descripcion: uploadModalClip.descripcion,
            hashtags: uploadModalClip.hashtags,
          }}
          onClose={() => setUploadModalClip(null)}
          onSuccess={(res) => {
            toast.success(`Short publicado en YouTube: ${res.youtubeUrl}`);
          }}
        />
      )}

      {/* TikTok Export Modal */}
      {tiktokExportClip && (
        <ExportTikTokModal
          isOpen={!!tiktokExportClip}
          clip={{
            id: tiktokExportClip.id,
            titulo_hook: tiktokExportClip.titulo_hook,
            duracion_seg: tiktokExportClip.duracion_seg,
            video_short_url: tiktokExportClip.video_short_url,
            video_vertical_url: tiktokExportClip.video_vertical_url,
            preview_url: tiktokExportClip.preview_url,
            descripcion: tiktokExportClip.descripcion,
            hashtags: tiktokExportClip.hashtags,
          }}
          onClose={() => setTiktokExportClip(null)}
        />
      )}

      {/* Confirmation Modal for Browser Processing */}
      <ConfirmProcessModal
        isOpen={showConfirmModal}
        duracionSeg={clipsQueue.length * 30}
        estiloSubtitulos="Moderno / Neón"
        isProcessing={isProcessingAll}
        onConfirm={() => {
          setShowConfirmModal(false);
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
        onCancel={() => {
          setShowConfirmModal(false);
          setPendingAction(null);
        }}
      />
    </div>
  );
}

function displayTitle(id: string): string {
  return id === 'proj-demo' ? 'Estrategia de Retención Viral' : `Proyecto ${id}`;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const remainingSecs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
}
