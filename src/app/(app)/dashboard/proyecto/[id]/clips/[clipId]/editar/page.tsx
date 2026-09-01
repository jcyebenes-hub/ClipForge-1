import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Scissors,
  Sparkles,
  Download,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Type,
  Check,
  Smartphone,
  Square,
  Monitor,
  Volume2,
  VolumeX,
  Loader2,
  Flame,
  Hash,
  MessageSquare,
  Clock,
  Video,
  FileVideo,
  Layers,
  Save,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  Globe,
  Languages,
  Search,
  ChevronDown,
  X,
  Volume1,
  Youtube,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { useYouTube } from '@/src/context/YouTubeAuthContext';
import { YouTubeUploadModal } from '@/src/components/youtube/YouTubeUploadModal';
import { ExportTikTokModal } from '@/src/components/publicar/ExportTikTokModal';
import { supabase } from '@/src/lib/supabase/client';
import { Proyecto } from '@/src/lib/supabase/types';
import { verificarRateLimitCliente, registrarConsumoCliente } from '@/src/lib/rateLimit';
import { sanitizarTitulo } from '@/src/lib/sanitizer';
import {
  SubtitleStylePreset,
  SUBTITLE_STYLES,
  SubtitleWord,
  SubtitleGroup,
  agruparPalabrasEnFrases,
  renderSubtitulosEnCanvas,
  quemarSubtitulosVideo,
  generarPalabrasFallback,
  ExportSettings,
  DEFAULT_EXPORT_SETTINGS,
} from '@/src/lib/subtitulos';
import {
  AspectRatioOption,
  generarShortVertical,
  TipoEnfoque,
} from '@/src/lib/encuadre';
import {
  cutVideoSegment,
  getLoadedFFmpeg,
  parseFFmpegTime,
} from '@/src/lib/videoCutter';
import {
  descargarClipMP4,
  copiarEnlacePublicoClip,
  generarNombreArchivoClip,
} from '@/src/lib/downloadHelper';
import {
  IDIOMAS_DISPONIBLES,
  IdiomaConfig,
  EntradaSubtituloJSON,
  convertirPalabrasAEntradasJSON,
  convertirEntradasJSONAPalabras,
  solicitarTraduccionSubtitulos,
} from '@/src/lib/traduccion';
import {
  Share2,
  Copy,
  SlidersHorizontal,
  ShieldCheck,
  Crown,
  FileCheck,
  Gamepad2,
  Dices,
  UploadCloud,
  Film,
  PlaySquare,
} from 'lucide-react';
import {
  ModoBRoll,
  BRollPreset,
  PRESETS_BROLL,
  BRollConfig,
  calcularTramoAutomaticoBroll,
  generarPresetBRollBlob,
  componerClipConBRoll,
} from '@/src/lib/brollCompositor';
import { ConfirmProcessModal } from '@/src/components/proyecto/ConfirmProcessModal';
import { trackClipExported, trackError } from '@/src/lib/analytics';

interface ClipData {
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
  preview_url?: string;
  bucket_path?: string;
  video_vertical_url?: string;
  vertical_bucket_path?: string;
  video_short_url?: string;
  short_bucket_path?: string;
  estilo_subtitulos?: SubtitleStylePreset;
  aspect_ratio?: AspectRatioOption;
  enfoque?: TipoEnfoque;
  subtitulos_palabras?: SubtitleWord[];
  idioma_subtitulos?: string;
  subtitulos_json?: Record<string, EntradaSubtituloJSON[]> | any;
}

interface ClipEditarPageProps {
  proyectoId?: string;
  clipId?: string;
  onNavigate?: (path: string) => void;
}

export default function ClipEditarPage({
  proyectoId,
  clipId,
  onNavigate,
}: ClipEditarPageProps) {
  const { user, profile, isSupabaseConfigured } = useAuth();
  const { isConnected: isYtConnected, connectYouTube } = useYouTube();
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isTikTokModalOpen, setIsTikTokModalOpen] = useState(false);

  // Extract from URL if not passed in props
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const pathParts = pathname.split('/');
  const effectiveProjId = proyectoId || pathParts[3] || 'proj-demo';
  const effectiveClipId = clipId || pathParts[5] || 'clip-1';

  // Core Data States
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [clip, setClip] = useState<ClipData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Parameters
  const [inicioSeg, setInicioSeg] = useState<number>(0);
  const [finSeg, setFinSeg] = useState<number>(30);
  const [selectedStyle, setSelectedStyle] = useState<SubtitleStylePreset>('moderno');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('9:16');
  const [enfoque, setEnfoque] = useState<TipoEnfoque>('rostro');
  const [tituloHook, setTituloHook] = useState<string>('');
  const [ctaText, setCtaText] = useState<string>('');
  const [mejorMomentoFrase, setMejorMomentoFrase] = useState<string>('');
  const [hookComoPrimerSubtitulo, setHookComoPrimerSubtitulo] = useState<boolean>(true);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtagInput, setNewHashtagInput] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');

  // Export Settings (Fase 11)
  const [exportResolucion, setExportResolucion] = useState<'1080p' | '720p'>('1080p');
  const [exportFps, setExportFps] = useState<30 | 60>(30);
  const [exportCalidadCrf, setExportCalidadCrf] = useState<18 | 23 | 28>(23);
  const isFreePlan = !profile?.plan || profile.plan === 'gratis';
  const [marcaDeAgua, setMarcaDeAgua] = useState<boolean>(isFreePlan);

  // Translation States (Fase 12)
  const [idiomaSubtitulos, setIdiomaSubtitulos] = useState<string>('es');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [subtitulosPorIdioma, setSubtitulosPorIdioma] = useState<Record<string, EntradaSubtituloJSON[]>>({});
  const [isIdiomaModalOpen, setIsIdiomaModalOpen] = useState<boolean>(false);
  const [searchIdiomaQuery, setSearchIdiomaQuery] = useState<string>('');

  useEffect(() => {
    if (profile?.plan === 'creador' || profile?.plan === 'pro') {
      setMarcaDeAgua(false);
    } else {
      setMarcaDeAgua(true);
    }
  }, [profile?.plan]);

  // Processing & UI States
  type EstadoProceso = 'sin_cambios' | 'modificado' | 'procesando' | 'listo' | 'error';
  const [estadoProceso, setEstadoProceso] = useState<EstadoProceso>('sin_cambios');
  const [showConfirmProcessModal, setShowConfirmProcessModal] = useState<boolean>(false);
  const [progreso, setProgreso] = useState<number>(0);
  const [etapaTexto, setEtapaTexto] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  // Generated Video Outputs
  const [videoGeneradoUrl, setVideoGeneradoUrl] = useState<string | null>(null);
  const [videoGeneradoBlob, setVideoGeneradoBlob] = useState<Blob | null>(null);

  // Master Video Reference
  const [videoDuration, setVideoDuration] = useState<number>(60);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Live Canvas Preview Scrubber
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasRelTime, setCanvasRelTime] = useState<number>(0);
  const [isCanvasPlaying, setIsCanvasPlaying] = useState<boolean>(false);

  // Timeline Dragging Ref
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<'start' | 'end' | null>(null);

  // B-Roll / Gameplay States (Metraje de Juego)
  const [brollActivo, setBrollActivo] = useState<boolean>(false);
  const [brollModo, setBrollModo] = useState<ModoBRoll>('automatico');
  const [brollPresetId, setBrollPresetId] = useState<string>('subway_surfers');
  const [brollCustomFile, setBrollCustomFile] = useState<File | null>(null);
  const [brollCustomUrl, setBrollCustomUrl] = useState<string | null>(null);
  const [brollAutoStartSec, setBrollAutoStartSec] = useState<number>(0);
  const [brollAutoEndSec, setBrollAutoEndSec] = useState<number>(15);
  const [brollAutoDesc, setBrollAutoDesc] = useState<string>('');
  const brollVideoRef = useRef<HTMLVideoElement | null>(null);

  // Recalculate automatic non-overlapping 10-20s segment from original video
  const recalcularTramoAutomatico = React.useCallback(() => {
    const desiredDur = Math.min(20, Math.max(10, finSeg - inicioSeg));
    const res = calcularTramoAutomaticoBroll(videoDuration, inicioSeg, finSeg, desiredDur);
    setBrollAutoStartSec(res.startSec);
    setBrollAutoEndSec(res.endSec);
    setBrollAutoDesc(res.descripcionTramo);
  }, [videoDuration, inicioSeg, finSeg]);

  useEffect(() => {
    if (videoDuration > 0) {
      recalcularTramoAutomatico();
    }
  }, [videoDuration, inicioSeg, finSeg, recalcularTramoAutomatico]);

  // Raw Words calculation considering active language
  const words = React.useMemo(() => {
    if (idiomaSubtitulos !== 'es' && subtitulosPorIdioma[idiomaSubtitulos]?.length) {
      return convertirEntradasJSONAPalabras(subtitulosPorIdioma[idiomaSubtitulos]);
    }
    if (subtitulosPorIdioma['es']?.length) {
      return convertirEntradasJSONAPalabras(subtitulosPorIdioma['es']);
    }
    if (clip?.subtitulos_palabras && clip.subtitulos_palabras.length > 0) {
      return clip.subtitulos_palabras;
    }
    const text = clip?.texto_transcrito || proyecto?.transcripcion || 'Aprende este truco viral para retener a tu audiencia en los primeros segundos de tu vídeo.';
    return generarPalabrasFallback(text, Math.max(1, finSeg - inicioSeg));
  }, [clip, proyecto, inicioSeg, finSeg, idiomaSubtitulos, subtitulosPorIdioma]);

  const groups = React.useMemo(() => {
    return agruparPalabrasEnFrases(words, inicioSeg, finSeg, 3);
  }, [words, inicioSeg, finSeg]);

  // 1. Initial Data Fetching
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        let loadedProj: Proyecto | null = null;
        let loadedClip: ClipData | null = null;

        // Check local storage first
        try {
          const localProjs = localStorage.getItem('clipforge_local_proyectos');
          if (localProjs) {
            const list: Proyecto[] = JSON.parse(localProjs);
            loadedProj = list.find((p) => p.id === effectiveProjId) || null;
          }

          const localClipsStr = localStorage.getItem(`clipforge_clips_${effectiveProjId}`);
          if (localClipsStr) {
            const list: any[] = JSON.parse(localClipsStr);
            const found = list.find((c) => c.id === effectiveClipId);
            if (found) {
              loadedClip = found;
            }
          }
        } catch (e) {
          console.warn('LocalStorage error:', e);
        }

        // Check Supabase
        if (isSupabaseConfigured && user) {
          try {
            if (!loadedProj) {
              const { data: dbProj } = await (supabase.from('proyectos') as any)
                .select('*')
                .eq('id', effectiveProjId)
                .single();
              if (dbProj) loadedProj = dbProj as Proyecto;
            }

            const { data: dbClip } = await (supabase.from('clips') as any)
              .select('*')
              .eq('id', effectiveClipId)
              .single();
            if (dbClip) {
              loadedClip = dbClip as ClipData;
            }
          } catch (dbErr) {
            console.warn('Supabase fetch error:', dbErr);
          }
        }

        // Fallback default clip if demo
        if (!loadedClip) {
          loadedClip = {
            id: effectiveClipId,
            proyecto_id: effectiveProjId,
            inicio_seg: 0,
            fin_seg: 25,
            duracion_seg: 25,
            puntuacion_viral: 92,
            titulo_hook: 'El Secreto Para Multiplicar Tus Vistas',
            cta: '¡Sígueme para dominar la edición con IA!',
            mejor_momento_primera_frase: 'Esto cambiará tus vídeos para siempre',
            hashtags: ['#shorts', '#viral', '#edicion', '#creadores', '#algoritmo', '#marketing', '#youtube', '#trucos'],
            descripcion: 'Descubre el método paso a paso para crear vídeos de alto impacto con IA. #shorts',
            hook_como_primer_subtitulo: true,
            estilo_subtitulos: 'moderno',
            aspect_ratio: '9:16',
            enfoque: 'rostro',
            texto_transcrito: 'En este vídeo vamos a desvelar la técnica exacta que utilizan los canales más grandes para retener la atención desde el segundo cero.',
          };
        }

        if (isMounted) {
          setProyecto(loadedProj);
          setClip(loadedClip);
          setInicioSeg(loadedClip.inicio_seg || 0);
          setFinSeg(loadedClip.fin_seg || 25);
          setSelectedStyle(loadedClip.estilo_subtitulos || 'moderno');
          setAspectRatio(loadedClip.aspect_ratio || '9:16');
          setEnfoque(loadedClip.enfoque || 'rostro');
          setTituloHook(loadedClip.titulo_hook || 'Momento Viral');
          setCtaText(loadedClip.cta || 'Sígueme para más');
          setMejorMomentoFrase(loadedClip.mejor_momento_primera_frase || loadedClip.titulo_hook || '');
          setHookComoPrimerSubtitulo(loadedClip.hook_como_primer_subtitulo ?? true);
          setHashtags(loadedClip.hashtags || ['#shorts', '#viral', '#creadores']);
          setDescripcion(loadedClip.descripcion || '');

          if (loadedClip.subtitulos_json && typeof loadedClip.subtitulos_json === 'object') {
            setSubtitulosPorIdioma(loadedClip.subtitulos_json);
          }
          if (loadedClip.idioma_subtitulos) {
            setIdiomaSubtitulos(loadedClip.idioma_subtitulos);
          }

          if (loadedClip.video_short_url) {
            setVideoGeneradoUrl(loadedClip.video_short_url);
            setEstadoProceso('listo');
          } else if (loadedClip.video_vertical_url) {
            setVideoGeneradoUrl(loadedClip.video_vertical_url);
            setEstadoProceso('listo');
          } else if (loadedClip.preview_url) {
            setVideoGeneradoUrl(loadedClip.preview_url);
          }
        }
      } catch (err) {
        console.error('Error loading clip details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [effectiveProjId, effectiveClipId, isSupabaseConfigured, user]);

  // Master video duration extraction
  const sourceVideoUrl = clip?.preview_url || clip?.video_short_url || clip?.video_vertical_url || proyecto?.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const dur = e.currentTarget.duration;
    if (dur && !isNaN(dur) && dur > 0) {
      setVideoDuration(dur);
      if (finSeg > dur) {
        setFinSeg(Math.min(dur, Math.max(inicioSeg + 3, dur)));
      }
    }
  };

  // Switch Subtitle Language (Fase 12: Llama 3.3 70B translation)
  const handleChangeIdioma = async (nuevoIdioma: string) => {
    if (nuevoIdioma === idiomaSubtitulos && subtitulosPorIdioma[nuevoIdioma]?.length) return;

    setIdiomaSubtitulos(nuevoIdioma);
    setEstadoProceso('modificado');

    // Base fallback words
    const baseWords = clip?.subtitulos_palabras && clip.subtitulos_palabras.length > 0
      ? clip.subtitulos_palabras
      : generarPalabrasFallback(
          clip?.texto_transcrito || proyecto?.transcripcion || 'Aprende este truco viral para retener a tu audiencia.',
          Math.max(1, finSeg - inicioSeg)
        );
    const baseEntradas = subtitulosPorIdioma['es'] || convertirPalabrasAEntradasJSON(baseWords, inicioSeg, finSeg, 4);

    if (nuevoIdioma === 'es') {
      const updatedTranslations = {
        ...subtitulosPorIdioma,
        es: baseEntradas,
      };
      setSubtitulosPorIdioma(updatedTranslations);
      toast.success('Idioma de subtítulos: 🇪🇸 Español (Original)');
      return;
    }

    // Check if translation is already cached
    if (subtitulosPorIdioma[nuevoIdioma] && subtitulosPorIdioma[nuevoIdioma].length > 0) {
      const targetInfo = IDIOMAS_DISPONIBLES.find((i) => i.codigo === nuevoIdioma);
      toast.success(`Subtítulos en ${targetInfo?.bandera || ''} ${targetInfo?.nombre || nuevoIdioma} cargados.`);
      return;
    }

    // Perform translation via Groq Llama 3.3 70B
    setIsTranslating(true);
    const targetInfo = IDIOMAS_DISPONIBLES.find((i) => i.codigo === nuevoIdioma);
    toast.info(`Traduciendo subtítulos a ${targetInfo?.bandera || ''} ${targetInfo?.nombre || nuevoIdioma} con Llama 3.3 70B...`);

    try {
      const res = await solicitarTraduccionSubtitulos({
        clip_id: effectiveClipId,
        idioma: nuevoIdioma,
        subtitulos: baseEntradas,
      });

      if (res.success && Array.isArray(res.subtitulos) && res.subtitulos.length > 0) {
        const updatedTranslations = {
          ...subtitulosPorIdioma,
          es: baseEntradas,
          [nuevoIdioma]: res.subtitulos,
        };
        setSubtitulosPorIdioma(updatedTranslations);

        // Update Clip state
        setClip((prev) => prev ? {
          ...prev,
          idioma_subtitulos: nuevoIdioma,
          subtitulos_json: updatedTranslations,
        } : null);

        // Save locally
        try {
          const localKey = `clipforge_clips_${effectiveProjId}`;
          const localClipsStr = localStorage.getItem(localKey);
          if (localClipsStr) {
            const list: any[] = JSON.parse(localClipsStr);
            const updated = list.map((c) => {
              if (c.id === effectiveClipId) {
                return {
                  ...c,
                  idioma_subtitulos: nuevoIdioma,
                  subtitulos_json: updatedTranslations,
                };
              }
              return c;
            });
            localStorage.setItem(localKey, JSON.stringify(updated));
          }
        } catch (saveErr) {
          console.warn('LocalStorage save error:', saveErr);
        }

        // Update Supabase if authenticated
        if (isSupabaseConfigured && user) {
          try {
            await (supabase.from('clips') as any)
              .update({
                subtitulos_json: updatedTranslations,
              })
              .eq('id', effectiveClipId);
          } catch (dbErr) {
            console.warn('Supabase subtitulos_json error:', dbErr);
          }
        }

        toast.success(`¡Subtítulos traducidos con éxito a ${targetInfo?.bandera || ''} ${targetInfo?.nombre}! Pulsa "Re-generar Short" para quemarlos.`);
      } else {
        throw new Error(res.error || 'No se pudieron generar los subtítulos traducidos.');
      }
    } catch (err: any) {
      console.error('Error traduciendo subtítulos:', err);
      toast.error(`Error al traducir: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Video time update sync
  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    setVideoCurrentTime(t);
  };

  // Live Canvas Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const clipDur = Math.max(1, finSeg - inicioSeg);

    const loop = (now: number) => {
      if (isCanvasPlaying) {
        const dt = (now - lastTime) / 1000;
        setCanvasRelTime((prev) => {
          const next = prev + dt;
          if (next >= clipDur) {
            return 0;
          }
          return next;
        });
      }
      lastTime = now;
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isCanvasPlaying, inicioSeg, finSeg]);

  // Draw Canvas Frame & Subtitles with dynamic Aspect Ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Handle B-Roll / Gameplay Split Screen (Top 1080x1650 main + Bottom 480x270 broll)
    if (brollActivo && aspectRatio === '9:16') {
      const mainHeight = height * (1650 / 1920);
      const brollHeight = height - mainHeight;
      const brollY = mainHeight;

      // 1. Draw top main video (cropped to 1080x1650 vertical proportion)
      const video = videoPlayerRef.current;
      if (video && video.readyState >= 2) {
        const vRatio = (video.videoWidth || 16) / (video.videoHeight || 9);
        const cRatio = width / mainHeight;

        let drawW = width;
        let drawH = mainHeight;
        let drawX = 0;
        let drawY = 0;

        if (vRatio > cRatio) {
          drawW = mainHeight * vRatio;
          drawX = (width - drawW) / 2;
        } else {
          drawH = width / vRatio;
          drawY = (mainHeight - drawH) / 2;
        }

        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, mainHeight);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, mainHeight);
        ctx.clip();
        ctx.drawImage(video, drawX, drawY, drawW, drawH);
        ctx.restore();

        // Vignette bottom of main section
        const grad = ctx.createLinearGradient(0, mainHeight * 0.65, 0, mainHeight);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, mainHeight * 0.65, width, mainHeight * 0.35);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, mainHeight);
        grad.addColorStop(0, '#13112c');
        grad.addColorStop(0.5, '#0b0c16');
        grad.addColorStop(1, '#05050a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, mainHeight);
      }

      // 2. Draw Divider & Background for B-Roll
      ctx.fillStyle = '#090912';
      ctx.fillRect(0, brollY, width, brollHeight);

      // Neon separation line
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, brollY);
      ctx.lineTo(width, brollY);
      ctx.stroke();

      // 3. Draw B-Roll / Gameplay at bottom (scaled 480x270 aspect, padded center)
      const brollAspect = 480 / 270;
      const brollW = brollHeight * brollAspect;
      const brollX = (width - brollW) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, brollY, width, brollHeight);
      ctx.clip();

      if (brollModo === 'preset') {
        const t = canvasRelTime;
        if (brollPresetId === 'subway_surfers') {
          // Subway Surfers Canvas Simulation
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(brollX, brollY, brollW, brollHeight * 0.4);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(brollX, brollY + brollHeight * 0.4, brollW, brollHeight * 0.6);

          // Rails
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(brollX + brollW * 0.45, brollY + brollHeight * 0.4);
          ctx.lineTo(brollX + brollW * 0.15, brollY + brollHeight);
          ctx.moveTo(brollX + brollW * 0.55, brollY + brollHeight * 0.4);
          ctx.lineTo(brollX + brollW * 0.85, brollY + brollHeight);
          ctx.stroke();

          // Runner
          const runnerX = brollX + brollW * 0.5 + Math.sin(t * 3) * (brollW * 0.15);
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(runnerX - 6, brollY + brollHeight * 0.55, 12, 14);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(runnerX, brollY + brollHeight * 0.5, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (brollPresetId === 'minecraft_parkour') {
          // Minecraft Parkour Canvas Simulation
          ctx.fillStyle = '#020617';
          ctx.fillRect(brollX, brollY, brollW, brollHeight);
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(brollX, brollY + brollHeight * 0.7, brollW, brollHeight * 0.3);

          const jump = Math.abs(Math.sin(t * 6)) * 8;
          ctx.fillStyle = '#15803d';
          ctx.fillRect(brollX + brollW * 0.35, brollY + brollHeight * 0.4 + jump, 26, 6);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(brollX + brollW * 0.35, brollY + brollHeight * 0.46 + jump, 26, 12);
        } else if (brollPresetId === 'gta_stunts') {
          // GTA Stunt Mega Ramp Simulation
          ctx.fillStyle = '#312e81';
          ctx.fillRect(brollX, brollY, brollW, brollHeight);
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(brollX, brollY + brollHeight);
          ctx.lineTo(brollX + brollW, brollY + brollHeight * 0.3);
          ctx.stroke();

          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(brollX + brollW * 0.4, brollY + brollHeight * 0.45, 18, 8);
        } else {
          // Satisfying Kinetic Sand Simulation
          ctx.fillStyle = '#8b5cf6';
          ctx.fillRect(brollX + brollW * 0.2, brollY + brollHeight * 0.3, brollW * 0.6, brollHeight * 0.5);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(brollX + brollW * 0.15, brollY + brollHeight * 0.35 + (t % 1) * 15, brollW * 0.7, 2);
        }
      } else if (brollVideoRef.current && brollVideoRef.current.readyState >= 2) {
        ctx.drawImage(brollVideoRef.current, brollX, brollY, brollW, brollHeight);
      } else if (video && video.readyState >= 2 && brollModo === 'automatico') {
        ctx.drawImage(video, brollX, brollY, brollW, brollHeight);
      } else {
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(brollX, brollY, brollW, brollHeight);
        ctx.fillStyle = '#c7d2fe';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎮 Metraje de juego (B-Roll)', width / 2, brollY + brollHeight / 2 + 3);
      }

      // Small Badge at bottom corner
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(4, brollY + 3, 98, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('🎮 GAMEPLAY B-ROLL', 7, brollY + 11);

      ctx.restore();

      // Overlay Hook in the first 1.5s if enabled (on top main section)
      if (hookComoPrimerSubtitulo && mejorMomentoFrase && canvasRelTime <= 1.5) {
        ctx.save();
        const hookProgress = canvasRelTime / 1.5;
        const scale = 1.0 + Math.sin(hookProgress * Math.PI) * 0.08;
        ctx.translate(width / 2, mainHeight * 0.35);
        ctx.scale(scale, scale);

        ctx.font = `bold ${Math.round(mainHeight * 0.055)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.lineWidth = 6;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(mejorMomentoFrase.toUpperCase(), 0, 0);

        ctx.fillStyle = '#FFE600';
        ctx.fillText(mejorMomentoFrase.toUpperCase(), 0, 0);
        ctx.restore();
      }

      // Render Subtitles strictly on top main area
      renderSubtitulosEnCanvas(ctx, width, mainHeight, groups, canvasRelTime, selectedStyle, marcaDeAgua);
      return;
    }

    // Standard Single-Screen Canvas (no broll or non-9:16)
    const video = videoPlayerRef.current;
    if (video && video.readyState >= 2) {
      const vRatio = (video.videoWidth || 16) / (video.videoHeight || 9);
      const cRatio = width / height;

      let drawW = width;
      let drawH = height;
      let drawX = 0;
      let drawY = 0;

      if (vRatio > cRatio) {
        drawW = height * vRatio;
        drawX = (width - drawW) / 2;
      } else {
        drawH = width / vRatio;
        drawY = (height - drawH) / 2;
      }

      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(video, drawX, drawY, drawW, drawH);

      // Vignette bottom for subtitle contrast
      const grad = ctx.createLinearGradient(0, height * 0.6, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height * 0.6, width, height * 0.4);
    } else {
      // Stylized gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#13112c');
      grad.addColorStop(0.5, '#0b0c16');
      grad.addColorStop(1, '#05050a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Overlay Hook in the first 1.5s if enabled
    if (hookComoPrimerSubtitulo && mejorMomentoFrase && canvasRelTime <= 1.5) {
      ctx.save();
      const hookProgress = canvasRelTime / 1.5;
      const scale = 1.0 + Math.sin(hookProgress * Math.PI) * 0.08;
      ctx.translate(width / 2, height * 0.35);
      ctx.scale(scale, scale);

      ctx.font = `bold ${Math.round(height * 0.055)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(mejorMomentoFrase.toUpperCase(), 0, 0);

      // Fill with Cyan/Yellow Glow
      ctx.fillStyle = '#FFE600';
      ctx.fillText(mejorMomentoFrase.toUpperCase(), 0, 0);
      ctx.restore();
    }

    // Render karaoke Subtitles & Watermark
    renderSubtitulosEnCanvas(ctx, width, height, groups, canvasRelTime, selectedStyle, marcaDeAgua);
  }, [
    canvasRelTime,
    groups,
    selectedStyle,
    hookComoPrimerSubtitulo,
    mejorMomentoFrase,
    aspectRatio,
    marcaDeAgua,
    brollActivo,
    brollModo,
    brollPresetId,
    brollCustomUrl,
  ]);

  // Handle Timeline Dragging
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickSec = clickRatio * videoDuration;

    // Determine if closer to start handle or end handle
    const distToStart = Math.abs(clickSec - inicioSeg);
    const distToEnd = Math.abs(clickSec - finSeg);

    if (distToStart < distToEnd && distToStart < 5) {
      setIsDraggingHandle('start');
    } else if (distToEnd <= distToStart && distToEnd < 5) {
      setIsDraggingHandle('end');
    } else {
      // Seek video to clicked position
      if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = clickSec;
      }
    }
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingHandle || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = parseFloat((ratio * videoDuration).toFixed(1));

    if (isDraggingHandle === 'start') {
      const clamped = Math.max(0, Math.min(finSeg - 2, targetSec));
      setInicioSeg(clamped);
      setEstadoProceso('modificado');
      if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = clamped;
      }
    } else if (isDraggingHandle === 'end') {
      const clamped = Math.min(videoDuration, Math.max(inicioSeg + 2, targetSec));
      setFinSeg(clamped);
      setEstadoProceso('modificado');
      if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = clamped;
      }
    }
  };

  const handleTimelineMouseUp = () => {
    setIsDraggingHandle(null);
  };

  // Helper time format
  const formatTimeStr = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}:${Number(s) < 10 ? '0' : ''}${s}`;
  };

  // Re-generate complete short with FFmpeg.wasm
  const handleRegenerarShortCompleto = async () => {
    if (estadoProceso === 'procesando') return;

    setEstadoProceso('procesando');
    setProgreso(5);
    setEtapaTexto('Inicializando entorno FFmpeg WASM...');
    setLogs(['Iniciando pipeline de renderizado y edición personalizada...']);

    try {
      // 1. Cut and Crop to Target Aspect Ratio (1080x1920 or requested ratio)
      const totalPasos = brollActivo ? '4' : '3';
      setEtapaTexto(`Paso 1/${totalPasos}: Aplicando encuadre ${aspectRatio} con seguimiento inteligente (${enfoque})...`);
      setProgreso(15);
      setLogs((prev) => [...prev, `[1/${totalPasos}] Encuadrando vídeo a formato ${aspectRatio} (${enfoque})...`]);

      const framingResult = await generarShortVertical({
        clipId: effectiveClipId,
        videoSource: sourceVideoUrl,
        inicioSeg,
        finSeg,
        enfoque,
        aspectRatio,
        onProgress: (p) => {
          setProgreso(Math.min(brollActivo ? 35 : 50, Math.round(15 + p.percent * (brollActivo ? 0.2 : 0.35))));
          setEtapaTexto(`Paso 1/${totalPasos}: ${p.detail}`);
          if (p.stage) {
            setLogs((prev) => [...prev.slice(-15), `[Encuadre ${aspectRatio}] ${p.detail}`]);
          }
        },
      });

      let videoIntermedioParaSubs = framingResult.blob;

      // 2. B-Roll / Gameplay Composition (if enabled)
      if (brollActivo) {
        setEtapaTexto(`Paso 2/${totalPasos}: Preparando metraje de juego (b-roll modo: ${brollModo})...`);
        setProgreso(40);
        setLogs((prev) => [...prev, `[2/${totalPasos}] Preparando metraje de juego (b-roll modo: ${brollModo})...`]);

        const duracionClip = Math.max(1, finSeg - inicioSeg);
        let brollBlob: Blob | null = null;

        if (brollModo === 'subir_archivo' && brollCustomFile) {
          brollBlob = brollCustomFile instanceof Blob ? brollCustomFile : new Blob([brollCustomFile], { type: 'video/mp4' });
        } else if (brollModo === 'preset') {
          brollBlob = await generarPresetBRollBlob(brollPresetId, duracionClip, (msg) => {
            setLogs((prev) => [...prev.slice(-15), `[Gameplay Preset] ${msg}`]);
          });
        } else {
          // Automatic mode: Cut non-overlapping 10-20s fragment from original master video
          setLogs((prev) => [...prev, `[B-Roll Automático] Extrayendo tramo ${brollAutoStartSec.toFixed(1)}s - ${brollAutoEndSec.toFixed(1)}s del vídeo original sin solapar con el clip...`]);
          const cutBroll = await cutVideoSegment({
            clipId: `${effectiveClipId}_broll_auto`,
            inicioSeg: brollAutoStartSec,
            finSeg: brollAutoEndSec,
            videoSource: sourceVideoUrl,
            onProgress: (p) => {
              setLogs((prev) => [...prev.slice(-15), `[B-Roll] ${p.detail}`]);
            },
          });
          brollBlob = cutBroll.blob;
        }

        setEtapaTexto(`Paso 2/${totalPasos}: Componiendo pantalla dividida con ffmpeg.wasm (1080x1650 arriba + 480x270 b-roll abajo)...`);
        setProgreso(55);
        setLogs((prev) => [
          ...prev,
          `[2/${totalPasos}] Ejecutando composición FFmpeg: crop=1080:1650:0:0[main] + scale=480:270,pad=1080:270:300:0[broll] + vstack...`,
        ]);

        const compResult = await componerClipConBRoll({
          clipId: effectiveClipId,
          verticalVideoBlob: framingResult.blob,
          brollVideoBlob: brollBlob,
          clipDurationSec: duracionClip,
          onProgress: (p) => {
            setProgreso(Math.min(68, Math.round(45 + p.percent * 0.22)));
            setEtapaTexto(`Paso 2/${totalPasos}: ${p.detail}`);
            if (p.stage) {
              setLogs((prev) => [...prev.slice(-15), `[Composición Gameplay] ${p.detail}`]);
            }
          },
        });

        videoIntermedioParaSubs = compResult.blob;
      }

      // 3. Burn Styled Subtitles + Viral Hook + Watermark + Export Settings
      const pasoSubs = brollActivo ? '3/4' : '2/3';
      setEtapaTexto(`Paso ${pasoSubs}: Quemando subtítulos ASS (${SUBTITLE_STYLES[selectedStyle].label}) • ${exportResolucion} ${exportFps}fps CRF ${exportCalidadCrf}...`);
      setProgreso(70);
      setLogs((prev) => [...prev, `[${pasoSubs}] Quemando subtítulos ASS (${selectedStyle}), marca de agua (${marcaDeAgua ? 'SI' : 'NO'}), ajustes: ${exportResolucion}/${exportFps}fps/CRF${exportCalidadCrf}...`]);

      const hookTextToBurn = hookComoPrimerSubtitulo ? mejorMomentoFrase || tituloHook : undefined;

      const burnResult = await quemarSubtitulosVideo({
        clipId: effectiveClipId,
        verticalVideoBlob: videoIntermedioParaSubs,
        words,
        inicioSeg,
        finSeg,
        stylePreset: selectedStyle,
        hookText: hookTextToBurn,
        aspectRatio,
        marcaDeAgua,
        exportSettings: {
          resolucion: exportResolucion,
          fps: exportFps,
          calidadCrf: exportCalidadCrf,
          marcaDeAgua,
        },
        onProgress: (p) => {
          setProgreso(Math.min(95, Math.round(70 + p.percent * 0.25)));
          setEtapaTexto(`Paso ${pasoSubs}: ${p.detail}`);
          if (p.stage) {
            setLogs((prev) => [...prev.slice(-15), `[Subtítulos/Exportación] ${p.detail}`]);
          }
        },
      });

      // 4. Complete & Store locally
      const pasoFinal = brollActivo ? '4/4' : '3/3';
      setProgreso(100);
      setEtapaTexto('¡Short re-generado con éxito!');
      setLogs((prev) => [...prev, `[${pasoFinal}] Exportación completada con éxito. Listo para descargar con los ajustes seleccionados.`]);
      setVideoGeneradoBlob(burnResult.blob);
      setVideoGeneradoUrl(burnResult.previewUrl);
      setEstadoProceso('listo');

      // Update local storage
      try {
        const localKey = `clipforge_clips_${effectiveProjId}`;
        const localClipsStr = localStorage.getItem(localKey);
        if (localClipsStr) {
          const list: any[] = JSON.parse(localClipsStr);
          const updated = list.map((c) => {
            if (c.id === effectiveClipId) {
              return {
                ...c,
                inicio_seg: inicioSeg,
                fin_seg: finSeg,
                duracion_seg: Math.round(finSeg - inicioSeg),
                titulo_hook: tituloHook,
                cta: ctaText,
                mejor_momento_primera_frase: mejorMomentoFrase,
                hashtags,
                descripcion,
                hook_como_primer_subtitulo: hookComoPrimerSubtitulo,
                estilo_subtitulos: selectedStyle,
                aspect_ratio: aspectRatio,
                enfoque,
                idioma_subtitulos: idiomaSubtitulos,
                subtitulos_json: subtitulosPorIdioma,
                video_short_url: burnResult.previewUrl,
              };
            }
            return c;
          });
          localStorage.setItem(localKey, JSON.stringify(updated));
        }
      } catch (saveErr) {
        console.warn('LocalStorage save error:', saveErr);
      }

      // Update Supabase if authenticated
      if (isSupabaseConfigured && user) {
        try {
          await (supabase.from('clips') as any)
            .update({
              inicio_seg: inicioSeg,
              fin_seg: finSeg,
              duracion_seg: Math.round(finSeg - inicioSeg),
              titulo_hook: tituloHook,
              cta: ctaText,
              mejor_momento_primera_frase: mejorMomentoFrase,
              hashtags,
              descripcion,
              hook_como_primer_subtitulo: hookComoPrimerSubtitulo,
              estilo_subtitulos: selectedStyle,
              idioma_subtitulos: idiomaSubtitulos,
              subtitulos_json: subtitulosPorIdioma,
            })
            .eq('id', effectiveClipId);
        } catch (dbErr) {
          console.warn('Supabase clip update warning:', dbErr);
        }
      }

      toast.success('¡Vídeo re-generado con éxito!', {
        description: `Recorte: ${formatTimeStr(inicioSeg)} - ${formatTimeStr(finSeg)} • ${exportResolucion} ${exportFps}fps • Estilo: ${SUBTITLE_STYLES[selectedStyle].label}`,
      });
    } catch (err: any) {
      console.error('Error re-generating short:', err);
      setEstadoProceso('error');
      setEtapaTexto(`Error durante el renderizado: ${err.message || 'Fallo desconocido'}`);
      setLogs((prev) => [...prev, `[ERROR] ${err.message || 'Error en FFmpeg'}`]);
      trackError(err.message || 'Error en FFmpeg', 'editor_clip_regenerar');
      toast.error('Error al procesar el vídeo', {
        description: err.message || 'Verifica que el vídeo original sea accesible.',
      });
    }
  };

  // Handle MP4 Download with sanitization and Supabase Storage fallback
  const handleDownloadMp4 = async () => {
    // Check client rate limiting (máx 20 exportaciones al día)
    const rateCheck = verificarRateLimitCliente('exportar', user?.id);
    if (!rateCheck.permitido) {
      toast.error(rateCheck.mensaje || 'Has alcanzado el límite diario de 20 exportaciones.');
      return;
    }

    const urlToDownload = videoGeneradoUrl || clip?.video_short_url || clip?.video_vertical_url || clip?.preview_url;
    if (!urlToDownload && !videoGeneradoBlob && !clip?.short_bucket_path && !clip?.vertical_bucket_path) {
      toast.error('No hay ningún vídeo procesado disponible para descargar');
      return;
    }

    // Track analytics event
    trackClipExported(effectiveClipId, selectedStyle, user?.id);

    const clipIndexMatch = effectiveClipId.match(/\d+/);
    const clipIndex = clipIndexMatch ? parseInt(clipIndexMatch[0], 10) : 1;

    // Registrar exportación en API
    fetch('/api/exportar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clip_id: effectiveClipId,
        proyecto_id: effectiveProjId,
        user_id: user?.id,
        titulo: sanitizarTitulo(tituloHook || clip?.titulo_hook || 'clip_exportado'),
      }),
    }).catch((e) => console.warn('Export API logger note:', e));

    // Registrar en cliente
    registrarConsumoCliente('exportar', user?.id);

    await descargarClipMP4({
      proyectoTitulo: sanitizarTitulo(proyecto?.titulo || proyecto?.nombre || 'clipforge_proyecto'),
      clipIndex,
      clipId: effectiveClipId,
      blob: videoGeneradoBlob,
      videoUrl: urlToDownload,
      bucketPath: clip?.short_bucket_path || clip?.vertical_bucket_path || clip?.bucket_path,
      aspectRatio,
    });
  };

  // Handle Copy Video Link
  const handleCopiarEnlace = async () => {
    const url = videoGeneradoUrl || clip?.video_short_url || clip?.video_vertical_url || clip?.preview_url;
    if (!url) {
      toast.error('No hay ningún enlace disponible para este clip');
      return;
    }
    await copiarEnlacePublicoClip(url, tituloHook || clip?.titulo_hook || proyecto?.titulo);
  };

  // Add hashtag
  const handleAddHashtag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHashtagInput.trim()) return;
    const tag = newHashtagInput.startsWith('#') ? newHashtagInput.trim() : `#${newHashtagInput.trim()}`;
    if (!hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setEstadoProceso('modificado');
    }
    setNewHashtagInput('');
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter((t) => t !== tagToRemove));
    setEstadoProceso('modificado');
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
        <p className="text-sm font-medium text-slate-300">Cargando editor de clip...</p>
      </div>
    );
  }

  const duracionTotalClip = Math.max(0.5, finSeg - inicioSeg);

  return (
    <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/30 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => onNavigate?.('/dashboard')}
              className="hover:text-purple-300 transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <button
              onClick={() => onNavigate?.(`/dashboard/proyecto/${effectiveProjId}`)}
              className="hover:text-purple-300 transition-colors cursor-pointer truncate max-w-[140px]"
            >
              {proyecto?.nombre || 'Proyecto'}
            </button>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <button
              onClick={() => onNavigate?.(`/dashboard/proyecto/${effectiveProjId}/clips`)}
              className="hover:text-purple-300 transition-colors cursor-pointer"
            >
              Clips
            </button>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-purple-400 font-mono font-semibold">Editar Clip</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/40">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <span>Modo Editor de Clip</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-700">
                  {duracionTotalClip.toFixed(1)}s
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Ajusta inicio/fin en la línea de tiempo, personaliza subtítulos y aspecto, y exporta en MP4.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate?.(`/dashboard/proyecto/${effectiveProjId}/clips`)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#131122] hover:bg-[#1a172e] text-slate-300 border border-purple-900/40 hover:border-purple-600/60 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la lista</span>
          </button>

          {/* Chip IDIOMA Selector Header */}
          <button
            type="button"
            onClick={() => setIsIdiomaModalOpen(true)}
            disabled={isTranslating}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-[#17142b] hover:bg-[#231e42] text-purple-200 border border-purple-800/80 hover:border-purple-500 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Cambiar idioma de subtítulos (35+ disponibles)"
          >
            {isTranslating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="text-[10px] tracking-wider uppercase text-purple-400 font-extrabold">IDIOMA:</span>
            <span className="text-xs">
              {IDIOMAS_DISPONIBLES.find((i) => i.codigo === idiomaSubtitulos)?.bandera || '🌐'}
            </span>
            <span className="font-semibold text-white">
              {IDIOMAS_DISPONIBLES.find((i) => i.codigo === idiomaSubtitulos)?.nombre || idiomaSubtitulos.toUpperCase()}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {(videoGeneradoUrl || clip?.video_short_url || clip?.video_vertical_url || clip?.preview_url) && (
            <button
              type="button"
              onClick={handleCopiarEnlace}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#17142b] hover:bg-[#231e42] text-purple-300 border border-purple-800/60 hover:border-purple-500 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Copiar enlace público del vídeo"
            >
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>Copiar Enlace</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadMp4}
            disabled={!videoGeneradoUrl && !clip?.video_short_url && !clip?.preview_url}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              videoGeneradoUrl || clip?.video_short_url || clip?.preview_url
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black shadow-emerald-950/50'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Descargar MP4</span>
          </button>

          <button
            type="button"
            onClick={() => setIsYouTubeModalOpen(true)}
            disabled={!videoGeneradoUrl && !clip?.video_short_url && !clip?.preview_url}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              videoGeneradoUrl || clip?.video_short_url || clip?.preview_url
                ? 'bg-red-600 hover:bg-red-500 text-white font-black shadow-red-950/60 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
            title="Publicar directamente en YouTube Shorts"
          >
            <Youtube className="w-4 h-4 fill-white" />
            <span>Subir a YouTube</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTikTokModalOpen(true)}
            disabled={!videoGeneradoUrl && !clip?.video_short_url && !clip?.preview_url}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              videoGeneradoUrl || clip?.video_short_url || clip?.preview_url
                ? 'bg-cyan-600 hover:bg-cyan-500 text-black font-black shadow-cyan-950/60 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
            title="Exportar paquete listo para TikTok en 1 minuto"
          >
            <span className="font-black text-xs">♪</span>
            <span>Exportar TikTok</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmProcessModal(true)}
            disabled={estadoProceso === 'procesando'}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              estadoProceso === 'procesando'
                ? 'bg-purple-950 text-purple-300 border border-purple-800 cursor-wait'
                : 'bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white shadow-purple-950/60 font-black'
            }`}
          >
            {estadoProceso === 'procesando' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando ({progreso}%)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>Re-generar Short</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Processing Status Banner */}
      {estadoProceso === 'procesando' && (
        <div className="bg-gradient-to-r from-purple-950/60 via-pink-950/40 to-[#0e0e1a] border border-pink-500/50 rounded-2xl p-4.5 space-y-2.5 shadow-xl animate-pulse">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-pink-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
              {etapaTexto || 'Renderizando con FFmpeg WASM...'}
            </span>
            <span className="font-mono text-pink-400 font-bold text-sm">{progreso}%</span>
          </div>
          <div className="w-full bg-[#090912] h-2.5 rounded-full overflow-hidden border border-pink-900/40">
            <div
              className="h-full transition-all duration-300 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Procesamiento 100% en tu navegador. Aplicando recorte temporal ({inicioSeg.toFixed(1)}s–{finSeg.toFixed(1)}s), encuadre {aspectRatio} y subtítulos estilo {selectedStyle}.
          </p>
        </div>
      )}

      {/* Main Grid: Left (Video & Timeline) vs Right (Style, Hooks & Settings) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Timeline & Video Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* SECTION 1: Master Video Player */}
          <div className="bg-[#0e0e1a] border border-purple-900/40 rounded-2xl p-4.5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Reproductor de Edición
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-md border border-cyan-800/40">
                <span>Cursor: {formatTimeStr(videoCurrentTime)}</span>
                <span>/</span>
                <span>{formatTimeStr(videoDuration)}</span>
              </div>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden relative border border-purple-900/40 group">
              <video
                ref={videoPlayerRef}
                src={sourceVideoUrl}
                playsInline
                muted={isMuted}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onTimeUpdate={handleVideoTimeUpdate}
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                className="w-full h-full object-contain"
              />

              {/* Custom Overlay Controls */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between p-2 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 opacity-90 transition-opacity">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (videoPlayerRef.current) {
                        if (isVideoPlaying) videoPlayerRef.current.pause();
                        else videoPlayerRef.current.play();
                      }
                    }}
                    className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer"
                  >
                    {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (videoPlayerRef.current) {
                        videoPlayerRef.current.currentTime = inicioSeg;
                        videoPlayerRef.current.play();
                      }
                    }}
                    title="Reproducir rango seleccionado"
                    className="px-2.5 py-1 rounded-lg bg-[#1a172e] hover:bg-[#252044] text-xs font-bold text-purple-300 border border-purple-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Rango ({formatTimeStr(inicioSeg)})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-1.5 rounded-lg bg-[#1a172e] hover:bg-[#252044] text-slate-300 transition-colors cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Interactive Dual-Handle Timeline Bar */}
          <div className="bg-[#0e0e1a] border border-purple-900/40 rounded-2xl p-4.5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-900/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-pink-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Línea de Tiempo de Recorte (Inicio / Fin)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Duración recortada:</span>
                <span className="text-xs font-mono font-bold text-yellow-300 bg-yellow-950/60 px-2 py-0.5 rounded-md border border-yellow-800/60">
                  {duracionTotalClip.toFixed(1)} segundos
                </span>
              </div>
            </div>

            {/* Visual Scrubber Track */}
            <div className="space-y-2 select-none">
              <div
                ref={timelineRef}
                onMouseDown={handleTimelineMouseDown}
                onMouseMove={handleTimelineMouseMove}
                onMouseUp={handleTimelineMouseUp}
                onMouseLeave={handleTimelineMouseUp}
                className="relative h-14 bg-[#090912] rounded-xl border border-purple-900/50 overflow-hidden cursor-pointer"
              >
                {/* Waveform/Grid Simulated Background */}
                <div className="absolute inset-0 flex items-center justify-between px-2 opacity-30 pointer-events-none">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-purple-500 rounded-full"
                      style={{
                        height: `${Math.sin(i * 0.4) * 40 + 50}%`,
                      }}
                    />
                  ))}
                </div>

                {/* Dark dim outside active range: Left side */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-black/75 pointer-events-none border-r border-red-500/40"
                  style={{ width: `${(inicioSeg / videoDuration) * 100}%` }}
                />

                {/* Active Highlighted Cut Region */}
                <div
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-purple-600/30 via-pink-600/30 to-purple-600/30 border-t-2 border-b-2 border-pink-400 pointer-events-none"
                  style={{
                    left: `${(inicioSeg / videoDuration) * 100}%`,
                    width: `${((finSeg - inicioSeg) / videoDuration) * 100}%`,
                  }}
                />

                {/* Dark dim outside active range: Right side */}
                <div
                  className="absolute top-0 bottom-0 right-0 bg-black/75 pointer-events-none border-l border-red-500/40"
                  style={{ width: `${((videoDuration - finSeg) / videoDuration) * 100}%` }}
                />

                {/* Current Playhead cursor line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_8px_#00ffff] pointer-events-none z-10"
                  style={{ left: `${(videoCurrentTime / videoDuration) * 100}%` }}
                />

                {/* Left Handle (Inicio) */}
                <div
                  className="absolute top-0 bottom-0 w-4 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-white rounded-l-md shadow-lg flex items-center justify-center cursor-ew-resize z-20 hover:scale-105 transition-transform"
                  style={{ left: `calc(${(inicioSeg / videoDuration) * 100}% - 8px)` }}
                >
                  <div className="w-0.5 h-6 bg-white/80 rounded" />
                </div>

                {/* Right Handle (Fin) */}
                <div
                  className="absolute top-0 bottom-0 w-4 bg-gradient-to-r from-pink-500 to-amber-500 border-2 border-white rounded-r-md shadow-lg flex items-center justify-center cursor-ew-resize z-20 hover:scale-105 transition-transform"
                  style={{ left: `calc(${(finSeg / videoDuration) * 100}% - 8px)` }}
                >
                  <div className="w-0.5 h-6 bg-white/80 rounded" />
                </div>
              </div>

              {/* Time stamps axis */}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>0:00</span>
                <span>{formatTimeStr(videoDuration * 0.25)}</span>
                <span>{formatTimeStr(videoDuration * 0.5)}</span>
                <span>{formatTimeStr(videoDuration * 0.75)}</span>
                <span>{formatTimeStr(videoDuration)}</span>
              </div>
            </div>

            {/* Fine-tuning Numeric Controls & Quick-set buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Inicio Control */}
              <div className="bg-[#121124] p-3 rounded-xl border border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-300">Punto de Inicio</span>
                  <span className="text-xs font-mono font-bold text-white bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                    {formatTimeStr(inicioSeg)} ({inicioSeg.toFixed(1)}s)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInicioSeg(Math.max(0, parseFloat((inicioSeg - 0.5).toFixed(1))));
                      setEstadoProceso('modificado');
                    }}
                    className="flex-1 py-1 rounded bg-[#1c1836] hover:bg-[#28224d] text-xs font-mono text-slate-300 border border-purple-900 cursor-pointer"
                  >
                    -0.5s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInicioSeg(Math.min(finSeg - 1, parseFloat((inicioSeg + 0.5).toFixed(1))));
                      setEstadoProceso('modificado');
                    }}
                    className="flex-1 py-1 rounded bg-[#1c1836] hover:bg-[#28224d] text-xs font-mono text-slate-300 border border-purple-900 cursor-pointer"
                  >
                    +0.5s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInicioSeg(parseFloat(videoCurrentTime.toFixed(1)));
                      setEstadoProceso('modificado');
                    }}
                    className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-[11px] font-bold text-white cursor-pointer"
                  >
                    Fijar Aquí
                  </button>
                </div>
              </div>

              {/* Fin Control */}
              <div className="bg-[#121124] p-3 rounded-xl border border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-pink-300">Punto de Fin</span>
                  <span className="text-xs font-mono font-bold text-white bg-pink-950 px-2 py-0.5 rounded border border-pink-800">
                    {formatTimeStr(finSeg)} ({finSeg.toFixed(1)}s)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFinSeg(Math.max(inicioSeg + 1, parseFloat((finSeg - 0.5).toFixed(1))));
                      setEstadoProceso('modificado');
                    }}
                    className="flex-1 py-1 rounded bg-[#1c1836] hover:bg-[#28224d] text-xs font-mono text-slate-300 border border-purple-900 cursor-pointer"
                  >
                    -0.5s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFinSeg(Math.min(videoDuration, parseFloat((finSeg + 0.5).toFixed(1))));
                      setEstadoProceso('modificado');
                    }}
                    className="flex-1 py-1 rounded bg-[#1c1836] hover:bg-[#28224d] text-xs font-mono text-slate-300 border border-purple-900 cursor-pointer"
                  >
                    +0.5s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFinSeg(parseFloat(videoCurrentTime.toFixed(1)));
                      setEstadoProceso('modificado');
                    }}
                    className="px-2.5 py-1 rounded bg-pink-600 hover:bg-pink-500 text-[11px] font-bold text-white cursor-pointer"
                  >
                    Fijar Aquí
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video Final Output Preview if Ready */}
          {videoGeneradoUrl && (
            <div className="bg-gradient-to-br from-[#120d22] via-[#0d0d1b] to-[#14122d] border border-emerald-500/40 rounded-2xl p-4.5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-emerald-900/30 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Vídeo Final Renderizado ({aspectRatio})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadMp4}
                  className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
              </div>

              <div className="flex justify-center bg-black rounded-xl p-2 border border-emerald-900/40">
                <video
                  src={videoGeneradoUrl}
                  controls
                  playsInline
                  className={`max-h-[380px] rounded-lg object-contain ${
                    aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Style, Aspect Ratio, Viral Hooks & Canvas Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* SECTION 3: Aspect Ratio Selector */}
          <div className="bg-[#0e0e1a] border border-purple-900/40 rounded-2xl p-4.5 space-y-3.5 shadow-xl">
            <div className="flex items-center gap-2 border-b border-purple-900/30 pb-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Relación de Aspecto & Encuadre
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* 9:16 */}
              <button
                type="button"
                onClick={() => {
                  setAspectRatio('9:16');
                  setEstadoProceso('modificado');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '9:16'
                    ? 'bg-purple-950/80 border-purple-500 text-white shadow-lg shadow-purple-950/50'
                    : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className={`w-5 h-5 ${aspectRatio === '9:16' ? 'text-pink-400' : ''}`} />
                <span className="text-xs font-bold">9:16 Vertical</span>
                <span className="text-[10px] font-mono text-slate-500">TikTok / Reels</span>
              </button>

              {/* 1:1 */}
              <button
                type="button"
                onClick={() => {
                  setAspectRatio('1:1');
                  setEstadoProceso('modificado');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '1:1'
                    ? 'bg-purple-950/80 border-purple-500 text-white shadow-lg shadow-purple-950/50'
                    : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Square className={`w-5 h-5 ${aspectRatio === '1:1' ? 'text-pink-400' : ''}`} />
                <span className="text-xs font-bold">1:1 Cuadrado</span>
                <span className="text-[10px] font-mono text-slate-500">Instagram Feed</span>
              </button>

              {/* 16:9 */}
              <button
                type="button"
                onClick={() => {
                  setAspectRatio('16:9');
                  setEstadoProceso('modificado');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '16:9'
                    ? 'bg-purple-950/80 border-purple-500 text-white shadow-lg shadow-purple-950/50'
                    : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className={`w-5 h-5 ${aspectRatio === '16:9' ? 'text-pink-400' : ''}`} />
                <span className="text-xs font-bold">16:9 Horizontal</span>
                <span className="text-[10px] font-mono text-slate-500">YouTube Normal</span>
              </button>
            </div>
          </div>

          {/* SECTION 4: Metraje de juego (B-Roll) */}
          <div className="bg-[#0e0e1a] border border-cyan-900/40 rounded-2xl p-4.5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-cyan-900/30 pb-2">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Metraje de juego (B-Roll)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                1080x1650 + 480x270
              </span>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#121124] border border-cyan-900/40">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Añadir gameplay abajo</span>
                  {brollActivo && (
                    <span className="px-1.5 py-0.2 text-[9px] font-black uppercase rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      Activo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Inserta metraje viral en la parte inferior para multiplicar la retención de audiencia.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                <input
                  type="checkbox"
                  checked={brollActivo}
                  onChange={(e) => {
                    setBrollActivo(e.target.checked);
                    setEstadoProceso('modificado');
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* B-Roll Configuration (When active) */}
            {brollActivo && (
              <div className="space-y-3.5 pt-1 animate-in fade-in-50 duration-200">
                {/* Notice on Composition & Audio */}
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#090912] border border-cyan-900/50 text-slate-300">
                  <Film className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <div className="text-[11px] leading-relaxed">
                    <p>
                      <strong className="text-cyan-300 font-semibold">Composición FFmpeg:</strong> El clip se recorta a{' '}
                      <code className="text-cyan-200 bg-cyan-950 px-1 rounded text-[10px]">1080x1650</code> arriba y el gameplay se escala a{' '}
                      <code className="text-cyan-200 bg-cyan-950 px-1 rounded text-[10px]">480x270</code> con pad centrado de{' '}
                      <code className="text-cyan-200 bg-cyan-950 px-1 rounded text-[10px]">1080x270</code> abajo.
                    </p>
                    <p className="text-slate-400 mt-0.5">
                      <strong className="text-emerald-400">Audio:</strong> Se mantiene intacto el audio original.
                    </p>
                  </div>
                </div>

                {/* Mode Selector Tabs (3 options) */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#090912] rounded-xl border border-cyan-900/40">
                  <button
                    type="button"
                    onClick={() => {
                      setBrollModo('automatico');
                      setEstadoProceso('modificado');
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      brollModo === 'automatico'
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Automático</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBrollModo('subir_archivo');
                      setEstadoProceso('modificado');
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      brollModo === 'subir_archivo'
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Subir Propio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBrollModo('preset');
                      setEstadoProceso('modificado');
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      brollModo === 'preset'
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Presets</span>
                  </button>
                </div>

                {/* Option 1: Automatic Fragment from Original Master Video */}
                {brollModo === 'automatico' && (
                  <div className="bg-[#121124] p-3 rounded-xl border border-cyan-900/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Tramo Aleatorio del Vídeo Original</span>
                      <button
                        type="button"
                        onClick={() => {
                          recalcularTramoAutomatico();
                          setEstadoProceso('modificado');
                          toast.info('Nuevo fragmento aleatorio sin solapar seleccionado');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        <span>🎲 Elegir otro</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#090912] border border-cyan-800/40">
                      <div className="space-y-0.5">
                        <div className="text-xs font-mono font-bold text-cyan-300">
                          {formatTimeStr(brollAutoStartSec)} - {formatTimeStr(brollAutoEndSec)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Duración: {(brollAutoEndSec - brollAutoStartSec).toFixed(1)}s (sin coincidir con clip {formatTimeStr(inicioSeg)}-{formatTimeStr(finSeg)})
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                        Sin solape
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-normal">
                      💡 El algoritmo selecciona automáticamente un segmento de 10-20s fuera del tramo activo ({formatTimeStr(inicioSeg)} - {formatTimeStr(finSeg)}) para evitar repeticiones.
                    </p>
                  </div>
                )}

                {/* Option 2: Upload Custom Gameplay Video */}
                {brollModo === 'subir_archivo' && (
                  <div className="bg-[#121124] p-3 rounded-xl border border-cyan-900/40 space-y-2.5">
                    <span className="text-xs font-bold text-white block">Subir Vídeo de Gameplay (MP4/WebM)</span>

                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-cyan-700/50 hover:border-cyan-400 rounded-xl bg-[#090912] hover:bg-cyan-950/20 cursor-pointer transition-colors text-center group">
                      <UploadCloud className="w-6 h-6 text-cyan-400 mb-1.5 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-white">
                        {brollCustomFile ? brollCustomFile.name : 'Haz clic para seleccionar o arrastra tu gameplay'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {brollCustomFile
                          ? `${(brollCustomFile.size / (1024 * 1024)).toFixed(2)} MB • Listo para componer`
                          : 'Formatos recomendados: MP4, WebM (10-60 segs)'}
                      </span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBrollCustomFile(file);
                            const url = URL.createObjectURL(file);
                            setBrollCustomUrl(url);
                            setEstadoProceso('modificado');
                            toast.success(`Gameplay cargado: ${file.name}`);
                          }
                        }}
                        className="hidden"
                      />
                    </label>

                    {brollCustomUrl && (
                      <div className="relative rounded-lg overflow-hidden bg-black border border-cyan-800/40 max-h-32">
                        <video
                          ref={brollVideoRef}
                          src={brollCustomUrl}
                          controls
                          className="w-full h-28 object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Option 3: Viral Gameplay Presets */}
                {brollModo === 'preset' && (
                  <div className="bg-[#121124] p-3 rounded-xl border border-cyan-900/40 space-y-2.5">
                    <span className="text-xs font-bold text-white block">Selecciona un Preset Viral</span>

                    <div className="grid grid-cols-2 gap-2">
                      {PRESETS_BROLL.map((preset) => {
                        const isSelected = brollPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setBrollPresetId(preset.id);
                              setEstadoProceso('modificado');
                            }}
                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                              isSelected
                                ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-950/50'
                                : 'bg-[#090912] border-cyan-900/40 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-base">{preset.icono}</span>
                              <span className="text-xs font-bold text-white leading-tight">{preset.nombre}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight">{preset.descripcion}</p>
                            {isSelected && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 4: Subtitle Style Preset & Live Canvas */}
          <div className="bg-[#0e0e1a] border border-purple-900/40 rounded-2xl p-4.5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-2">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Estilo de Subtítulos Animados
                </h3>
              </div>
              <span className="text-[10px] font-mono text-yellow-300 bg-yellow-950/60 px-2 py-0.5 rounded border border-yellow-800/60">
                Karaoke ASS
              </span>
            </div>

            {/* Preset Selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['moderno', 'neon', 'minimal'] as SubtitleStylePreset[]).map((preset) => {
                const isSelected = selectedStyle === preset;
                const conf = SUBTITLE_STYLES[preset];
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSelectedStyle(preset);
                      setEstadoProceso('modificado');
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? preset === 'moderno'
                          ? 'bg-yellow-950/60 border-yellow-500 text-yellow-300 shadow-md shadow-yellow-950/40'
                          : preset === 'neon'
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-950/40'
                          : 'bg-slate-800 border-slate-400 text-white shadow-md'
                        : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold">{conf.label.split(' ')[0]}</div>
                    <div className="text-[10px] text-slate-500 capitalize">{preset}</div>
                  </button>
                );
              })}
            </div>

            {/* Translation Sub-Panel (Fase 12: Llama 3.3 70B) */}
            <div className="bg-[#121124] p-3.5 rounded-xl border border-purple-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    Idioma de los Subtítulos
                  </span>
                </div>
                {/* Chip IDIOMA */}
                <button
                  type="button"
                  onClick={() => setIsIdiomaModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-950 text-purple-200 border border-purple-700 hover:border-cyan-400 transition-all cursor-pointer shadow-sm"
                >
                  <span className="text-[9px] uppercase font-black text-cyan-400 tracking-wider">IDIOMA:</span>
                  <span>{IDIOMAS_DISPONIBLES.find((i) => i.codigo === idiomaSubtitulos)?.bandera}</span>
                  <span className="text-white">{IDIOMAS_DISPONIBLES.find((i) => i.codigo === idiomaSubtitulos)?.nombre}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </div>

              {/* Quick Language Chips */}
              <div className="flex flex-wrap gap-1.5">
                {IDIOMAS_DISPONIBLES.slice(0, 8).map((idioma) => {
                  const isSelectedLang = idiomaSubtitulos === idioma.codigo;
                  return (
                    <button
                      key={idioma.codigo}
                      type="button"
                      disabled={isTranslating}
                      onClick={() => handleChangeIdioma(idioma.codigo)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        isSelectedLang
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-md border border-pink-400'
                          : 'bg-[#18162e] text-slate-300 border border-purple-900/40 hover:bg-[#231e42] hover:text-white'
                      }`}
                    >
                      <span>{idioma.bandera}</span>
                      <span>{idioma.nombre}</span>
                      {isSelectedLang && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsIdiomaModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900 transition-all cursor-pointer"
                >
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span>+ 35 idiomas</span>
                </button>
              </div>

              {/* Visible Disclaimer Note */}
              <div className="flex items-start gap-2 p-2 rounded-lg bg-[#090912] border border-cyan-900/40 text-slate-300">
                <Volume1 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-relaxed text-slate-300">
                  <strong className="text-cyan-300 font-semibold">El audio permanece original.</strong>{' '}
                  Los subtítulos se traducen dinámicamente con IA (Llama 3.3 70B) preservando los tiempos y métrica exactos.
                </p>
              </div>

              {/* Translation Progress Indicator */}
              {isTranslating && (
                <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/60 p-2 rounded-lg border border-purple-800 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Traduciendo subtítulos con Llama 3.3 70B...</span>
                </div>
              )}
            </div>

            {/* Live Canvas Box */}
            <div className="flex flex-col items-center bg-[#090912] p-3 rounded-xl border border-purple-900/40 space-y-2.5">
              <div
                className={`relative bg-black rounded-lg overflow-hidden border border-purple-500/50 shadow-inner ${
                  aspectRatio === '9:16'
                    ? 'w-[190px] aspect-[9/16]'
                    : aspectRatio === '1:1'
                    ? 'w-[220px] aspect-square'
                    : 'w-full aspect-video'
                }`}
              >
                <canvas
                  ref={canvasRef}
                  width={aspectRatio === '9:16' ? 270 : aspectRatio === '1:1' ? 320 : 480}
                  height={aspectRatio === '9:16' ? 480 : aspectRatio === '1:1' ? 320 : 270}
                  className="w-full h-full object-contain"
                />

                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-cyan-300 border border-cyan-800/50">
                  {canvasRelTime.toFixed(1)}s / {duracionTotalClip.toFixed(1)}s
                </div>
              </div>

              {/* Canvas Playback Controls */}
              <div className="w-full flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => setIsCanvasPlaying(!isCanvasPlaying)}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {isCanvasPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isCanvasPlaying ? 'Pausar' : 'Probar Subtítulos'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCanvasRelTime(0)}
                  className="p-1.5 rounded-lg bg-[#1a172e] hover:bg-[#28224d] text-slate-300 transition-colors cursor-pointer"
                  title="Reiniciar reproducción"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 5: Viral Hooks & CTA Inputs (Pre-filled from Phase 9) */}
          <div className="bg-[#0e0e1a] border border-purple-900/40 rounded-2xl p-4.5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-pink-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Textos & Hooks Virales
                </h3>
              </div>
              <span className="text-[10px] font-mono text-pink-300 bg-pink-950 px-2 py-0.5 rounded border border-pink-800">
                Llama 3.3 70B
              </span>
            </div>

            {/* Hook Title Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300">Título Gancho (Clickbait Honesto)</label>
                <span className={`font-mono text-[10px] ${tituloHook.length > 60 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {tituloHook.length}/60 car.
                </span>
              </div>
              <input
                type="text"
                value={tituloHook}
                onChange={(e) => {
                  setTituloHook(e.target.value);
                  setEstadoProceso('modificado');
                }}
                placeholder="Ej: El Secreto Para Multiplicar Tus Vistas"
                className="w-full bg-[#090912] border border-purple-900/50 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            {/* CTA Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Llamada a la Acción (CTA)</label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => {
                  setCtaText(e.target.value);
                  setEstadoProceso('modificado');
                }}
                placeholder="Ej: ¡Sígueme para más trucos de edición!"
                className="w-full bg-[#090912] border border-purple-900/50 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            {/* First Sentence Hook Checkbox */}
            <div className="bg-[#121124] p-3 rounded-xl border border-purple-900/40 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hookComoPrimerSubtitulo}
                  onChange={(e) => {
                    setHookComoPrimerSubtitulo(e.target.checked);
                    setEstadoProceso('modificado');
                  }}
                  className="rounded border-purple-800 text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-200">
                  Quemar frase de gancho en los primeros 1.5s
                </span>
              </label>

              {hookComoPrimerSubtitulo && (
                <input
                  type="text"
                  value={mejorMomentoFrase}
                  onChange={(e) => {
                    setMejorMomentoFrase(e.target.value);
                    setEstadoProceso('modificado');
                  }}
                  placeholder="Frase impactante (≤8 palabras)"
                  className="w-full bg-[#090912] border border-purple-900/50 rounded-lg px-3 py-1.5 text-xs text-yellow-300 font-semibold focus:outline-none focus:border-yellow-500"
                />
              )}
            </div>

            {/* Hashtags Chips */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-purple-400" />
                <span>Hashtags del Clip</span>
              </label>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-800 text-[11px] font-mono text-purple-300"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHashtag(tag)}
                      className="hover:text-red-400 transition-colors ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <form onSubmit={handleAddHashtag} className="flex gap-2">
                <input
                  type="text"
                  value={newHashtagInput}
                  onChange={(e) => setNewHashtagInput(e.target.value)}
                  placeholder="Añadir hashtag (#ia, #shorts)..."
                  className="flex-1 bg-[#090912] border border-purple-900/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#1c1836] hover:bg-[#28224d] text-xs font-bold text-purple-300 border border-purple-800 cursor-pointer"
                >
                  Añadir
                </button>
              </form>
            </div>
          </div>

          {/* SECTION 6: Panel de Ajustes de Exportación (Fase 11) */}
          <div className="bg-[#0e0e1a] border border-purple-900/40 rounded-2xl p-4.5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Ajustes de Exportación
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/70">
                libx264 • Fast
              </span>
            </div>

            {/* 1. Resolución Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Resolución de Vídeo</span>
                <span className="text-[10px] font-mono text-slate-400">
                  {aspectRatio === '9:16'
                    ? exportResolucion === '1080p'
                      ? '1080 × 1920 px'
                      : '720 × 1280 px'
                    : aspectRatio === '1:1'
                    ? exportResolucion === '1080p'
                      ? '1080 × 1080 px'
                      : '720 × 720 px'
                    : exportResolucion === '1080p'
                    ? '1920 × 1080 px'
                    : '1280 × 720 px'}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExportResolucion('1080p');
                    setEstadoProceso('modificado');
                  }}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    exportResolucion === '1080p'
                      ? 'bg-purple-950/70 border-purple-500 text-white shadow-md'
                      : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">1080p (Full HD)</div>
                  <div className="text-[10px] text-purple-300 font-mono">Máxima nitidez</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExportResolucion('720p');
                    setEstadoProceso('modificado');
                  }}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    exportResolucion === '720p'
                      ? 'bg-purple-950/70 border-purple-500 text-white shadow-md'
                      : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">720p (HD)</div>
                  <div className="text-[10px] text-slate-400 font-mono">Exportación rápida</div>
                </button>
              </div>
            </div>

            {/* 2. FPS Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Fotogramas por Segundo</span>
                <span className="text-[10px] font-mono text-slate-400">{exportFps} FPS</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExportFps(30);
                    setEstadoProceso('modificado');
                  }}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    exportFps === 30
                      ? 'bg-purple-950/70 border-purple-500 text-white shadow-md'
                      : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">30 FPS</div>
                  <div className="text-[10px] text-slate-400">Recomendado estándar</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExportFps(60);
                    setEstadoProceso('modificado');
                  }}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    exportFps === 60
                      ? 'bg-purple-950/70 border-purple-500 text-white shadow-md'
                      : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">60 FPS</div>
                  <div className="text-[10px] text-purple-300 font-mono">Fluidez premium</div>
                </button>
              </div>
            </div>

            {/* 3. Calidad CRF Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Calidad de Compresión (CRF)</span>
                <span className="text-[10px] font-mono text-purple-300">
                  {exportCalidadCrf === 18 ? 'Alta (CRF 18)' : exportCalidadCrf === 23 ? 'Equilibrada (CRF 23)' : 'Ligera (CRF 28)'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { crf: 18 as const, label: 'CRF 18', sub: 'Máxima' },
                  { crf: 23 as const, label: 'CRF 23', sub: 'Óptima' },
                  { crf: 28 as const, label: 'CRF 28', sub: 'Ligera' },
                ].map((item) => (
                  <button
                    key={item.crf}
                    type="button"
                    onClick={() => {
                      setExportCalidadCrf(item.crf);
                      setEstadoProceso('modificado');
                    }}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      exportCalidadCrf === item.crf
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40'
                        : 'bg-[#121124] border-purple-900/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Marca de Agua "ClipForge" */}
            <div className="bg-[#121124] p-3 rounded-xl border border-purple-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-4 h-4 ${marcaDeAgua ? 'text-amber-400' : 'text-emerald-400'}`} />
                  <span className="text-xs font-bold text-slate-200">
                    Marca de agua "ClipForge"
                  </span>
                </div>

                {isFreePlan ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                    Plan Gratis (Activa)
                  </span>
                ) : (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marcaDeAgua}
                      onChange={(e) => {
                        setMarcaDeAgua(e.target.checked);
                        setEstadoProceso('modificado');
                      }}
                      className="rounded border-purple-800 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-[10px] font-semibold text-slate-300">Incluir</span>
                  </label>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isFreePlan ? (
                  <span>
                    Aparece semi-transparente en la esquina inferior derecha. Los suscriptores del{' '}
                    <strong className="text-purple-300">Plan Creador</strong> exportan sin marca de agua.
                  </span>
                ) : (
                  <span className="text-emerald-300 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-yellow-400 inline" />
                    ¡Tienes Plan Creador! La marca de agua se omite automáticamente.
                  </span>
                )}
              </p>
            </div>

            {/* 5. Nombre de archivo generado preview */}
            <div className="bg-[#090912] p-2.5 rounded-xl border border-purple-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Nombre de archivo al descargar:</span>
              </div>
              <p className="text-xs font-mono font-semibold text-emerald-400 truncate">
                {generarNombreArchivoClip(
                  proyecto?.titulo || proyecto?.nombre || 'clipforge_proyecto',
                  parseInt(effectiveClipId.replace(/[^0-9]/g, '')) || 1,
                  effectiveClipId,
                  aspectRatio
                )}
              </p>
            </div>

            {/* 6. Quick Action Buttons inside export panel */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadMp4}
                disabled={!videoGeneradoUrl && !clip?.video_short_url && !clip?.preview_url}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                  videoGeneradoUrl || clip?.video_short_url || clip?.preview_url
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-950/50'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Descargar MP4</span>
              </button>

              {(videoGeneradoUrl || clip?.video_short_url || clip?.video_vertical_url || clip?.preview_url) && (
                <button
                  type="button"
                  onClick={handleCopiarEnlace}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#1c1836] hover:bg-[#28224d] text-purple-300 border border-purple-800 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copiar Enlace</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Selector de Idiomas (35+ Idiomas con Llama 3.3 70B) */}
      {isIdiomaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0e0e1a] border border-purple-800/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-purple-900/40 flex items-center justify-between bg-[#131124]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-900/50 text-cyan-400 border border-purple-700/50">
                  <Languages className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Seleccionar Idioma de Subtítulos</h3>
                  <p className="text-[11px] text-slate-400">Traducción contextual con Llama 3.3 70B</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIdiomaModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-900/40 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notice in modal: Audio remains original */}
            <div className="px-4 py-2.5 bg-cyan-950/40 border-b border-cyan-900/30 flex items-center gap-2.5 text-xs text-cyan-300">
              <Volume1 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="leading-tight">
                <strong>Nota:</strong> El audio del vídeo permanece en su idioma original. Los subtítulos se traducen y se sincronizan con los tiempos exactos.
              </span>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-purple-900/30 bg-[#090912]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchIdiomaQuery}
                  onChange={(e) => setSearchIdiomaQuery(e.target.value)}
                  placeholder="Buscar por idioma (ej: inglés, francés, portugués, japonés, árabe...)"
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#121124] border border-purple-900/50 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Languages Grid */}
            <div className="p-3 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {IDIOMAS_DISPONIBLES.filter(
                (i) =>
                  i.nombre.toLowerCase().includes(searchIdiomaQuery.toLowerCase()) ||
                  i.nombreNativo.toLowerCase().includes(searchIdiomaQuery.toLowerCase()) ||
                  i.codigo.toLowerCase().includes(searchIdiomaQuery.toLowerCase())
              ).map((idioma) => {
                const isSelected = idiomaSubtitulos === idioma.codigo;
                return (
                  <button
                    key={idioma.codigo}
                    type="button"
                    onClick={() => {
                      handleChangeIdioma(idioma.codigo);
                      setIsIdiomaModalOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/80 border-cyan-500 text-white shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500'
                        : 'bg-[#121124] border-purple-900/30 hover:bg-[#1c1836] text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{idioma.bandera}</span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{idioma.nombre}</span>
                          {idioma.codigo === 'es' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/70 text-purple-300 border border-purple-700">
                              Original
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{idioma.nombreNativo}</div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-purple-900/40 bg-[#131124] flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">
                {IDIOMAS_DISPONIBLES.length} idiomas disponibles con Llama 3.3 70B
              </span>
              <button
                type="button"
                onClick={() => setIsIdiomaModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Shorts Direct Upload Modal */}
      {clip && (
        <YouTubeUploadModal
          isOpen={isYouTubeModalOpen}
          clip={{
            id: clip.id,
            titulo_hook: clip.titulo_hook,
            duracion_seg: clip.duracion_seg,
            video_short_url: videoGeneradoUrl || clip.video_short_url || undefined,
            video_vertical_url: clip.video_vertical_url || undefined,
            preview_url: clip.preview_url || undefined,
            descripcion: clip.descripcion || undefined,
            hashtags: clip.hashtags || undefined,
          }}
          onClose={() => setIsYouTubeModalOpen(false)}
          onSuccess={(res) => {
            toast.success(`Short publicado en YouTube: ${res.youtubeUrl}`);
            setIsYouTubeModalOpen(false);
          }}
        />
      )}

      {/* TikTok Export Modal */}
      {clip && (
        <ExportTikTokModal
          isOpen={isTikTokModalOpen}
          clip={{
            id: clip.id,
            titulo_hook: clip.titulo_hook,
            duracion_seg: clip.duracion_seg,
            video_short_url: videoGeneradoUrl || clip.video_short_url || undefined,
            video_vertical_url: clip.video_vertical_url || undefined,
            preview_url: clip.preview_url || undefined,
            descripcion: clip.descripcion || undefined,
            hashtags: clip.hashtags || undefined,
          }}
          onClose={() => setIsTikTokModalOpen(false)}
        />
      )}

      {/* Confirmation Modal for Browser Processing */}
      <ConfirmProcessModal
        isOpen={showConfirmProcessModal}
        duracionSeg={Math.round(finSeg - inicioSeg)}
        estiloSubtitulos={SUBTITLE_STYLES[selectedStyle]?.label || selectedStyle}
        isProcessing={estadoProceso === 'procesando'}
        onConfirm={() => {
          setShowConfirmProcessModal(false);
          handleRegenerarShortCompleto();
        }}
        onCancel={() => setShowConfirmProcessModal(false)}
      />
    </div>
  );
}
