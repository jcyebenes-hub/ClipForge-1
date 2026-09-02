import React, { useEffect, useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  FileVideo, 
  Youtube, 
  Layers, 
  ShieldCheck, 
  Cpu, 
  RefreshCw,
  Share2,
  Volume2,
  Play,
  Pause,
  Copy,
  Download,
  Search,
  AlertTriangle,
  Flame,
  Check,
  Subtitles,
  Sliders,
  Scissors,
  Wand2,
  Film,
  Zap,
  Edit3,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Radio
} from 'lucide-react';
import { useAuth } from '../../../../../context/AuthContext';
import { supabase } from '../../../../../lib/supabase/client';
import type { Proyecto, Clip } from '../../../../../lib/supabase/types';
import { extract16kHzAudio } from '../../../../../lib/audioExtractor';
import { generarVentanasTemporales, calcularHeuristicasVentanas } from '../../../../../lib/audioHeuristics';
import { captureVideoFrame } from '../../../../../lib/thumbnailExtractor';
import { toast } from 'sonner';

export interface WordData {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface SegmentData {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordData[];
}

export interface TranscriptionPayload {
  task?: string;
  language?: string;
  duration?: number;
  text: string;
  segments: SegmentData[];
  words?: WordData[];
  provider?: string;
}

export interface ClipItem {
  id: string;
  proyecto_id: string;
  inicio_seg: number;
  fin_seg: number;
  duracion_seg: number;
  puntuacion_viral: number;
  score_llm?: number;
  score_heuristica?: number;
  titulo_hook: string;
  razon: string;
  cta?: string;
  texto_transcrito?: string;
  thumbnail?: string;
  estado?: 'sugerido' | 'seleccionado' | 'procesando' | 'listo';
}

interface ProyectoDetallePageProps {
  proyectoId?: string;
  onNavigate?: (path: string) => void;
}

export const ProyectoPage: React.FC<ProyectoDetallePageProps> = ({ 
  proyectoId = '', 
  onNavigate 
}) => {
  const { user, isSupabaseConfigured } = useAuth();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Transcription state
  const [transcribing, setTranscribing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [progressDetail, setProgressDetail] = useState('');
  const [transcriptData, setTranscriptData] = useState<TranscriptionPayload | null>(null);

  // Viral Analysis State (Fase 5)
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgressPercent, setAnalyzeProgressPercent] = useState(0);
  const [analyzeProgressStage, setAnalyzeProgressStage] = useState('');
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [activeClipPreview, setActiveClipPreview] = useState<ClipItem | null>(null);
  const [loopPreview, setLoopPreview] = useState(true);
  const [editingClip, setEditingClip] = useState<ClipItem | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'clips' | 'transcripcion'>('clips');
  
  // Video player & transcript sync state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Extract ID from pathname or prop
  const effectiveId = proyectoId || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '') || 'proj-demo';

  // ── Estado para proyectos de YouTube (reproductor real, sin vídeos de muestra) ──
  const [analyzeProvider, setAnalyzeProvider] = useState<string | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytApiReadyRef = useRef<boolean>(false);

  function extraerIdYoutube(url: string | null): string | null {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|v\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]{11})/);
    return m ? m[1] : null;
  }
  const videoIdYt = proyecto?.url_youtube ? extraerIdYoutube(proyecto.url_youtube) : null;
  const esYoutube = Boolean(videoIdYt) && !proyecto?.video_url;

  // Resolver URL real de reproducción cuando el proyecto tiene archivo en storage (subida)
  useEffect(() => {
    let activo = true;
    if (!proyecto || esYoutube || proyecto.video_url || !proyecto.archivo_nombre) return;
    if (!isSupabaseConfigured || !user) return;
    (async () => {
      try {
        const filePath = `${user.id}/${proyecto.id}/original.mp4`;
        const { data, error } = await supabase.storage
          .from('media')
          .createSignedUrl(filePath, 60 * 60 * 24 * 7);
        if (activo && !error && data?.signedUrl) {
          setProyecto((prev) => (prev ? { ...prev, video_url: data.signedUrl } : prev));
        }
      } catch {
        /* sin URL firmada: el preview quedará en negro con aviso */
      }
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto?.id, proyecto?.estado, proyecto?.archivo_nombre, isSupabaseConfigured, user?.id, esYoutube]);

  // Cargar la API de YouTube y crear el reproductor cuando el proyecto es de YouTube
  useEffect(() => {
    if (!esYoutube || !videoIdYt) return;

    let destruido = false;

    function cargarApiYoutube(): Promise<any> {
      return new Promise((resolve, reject) => {
        const win = window as any;
        if (win.YT && win.YT.Player) return resolve(win.YT);
        const prev = win.onYouTubeIframeAPIReady;
        win.onYouTubeIframeAPIReady = () => {
          if (prev) prev();
          resolve(win.YT);
        };
        if (!document.getElementById('yt-iframe-api')) {
          const s = document.createElement('script');
          s.id = 'yt-iframe-api';
          s.src = 'https://www.youtube.com/iframe_api';
          s.async = true;
          s.onerror = () => reject(new Error('No se pudo cargar la API de YouTube'));
          document.head.appendChild(s);
        }
      });
    }

    (async () => {
      try {
        const YT = await cargarApiYoutube();
        if (destruido || !ytContainerRef.current) return;
        ytPlayerRef.current = new YT.Player(ytContainerRef.current, {
          videoId: videoIdYt,
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            controls: 1,
            hl: 'es',
            origin: window.location.origin,
          },
          events: {
            onReady: (e: any) => {
              if (destruido) return;
              ytApiReadyRef.current = true;
              try {
                const d = e.target.getDuration?.();
                if (d && d > 0) setVideoDuration(d);
              } catch {}
            },
            onStateChange: (e: any) => {
              if (e.data === 1) setIsPlaying(true);
              if (e.data === 2 || e.data === 0) setIsPlaying(false);
            },
            onError: () => {
              toast.error('YouTube no permite reproducir este vídeo incrustado. Abre el enlace directamente.');
            },
          },
        });
      } catch (err) {
        console.warn('Error cargando reproductor de YouTube:', err);
        toast.error('No se pudo cargar el reproductor de YouTube.');
      }
    })();

    return () => {
      destruido = true;
      ytApiReadyRef.current = false;
      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
      }
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esYoutube, videoIdYt]);

  // Polling de tiempo para el reproductor de YouTube (el <video> usa onTimeUpdate)
  useEffect(() => {
    if (!esYoutube) return;
    const intervalo = window.setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || !ytApiReadyRef.current) return;
      try {
        const estado = p.getPlayerState?.();
        if ([0, 1, 2, 3].includes(estado)) {
          const t = Number(p.getCurrentTime?.() ?? 0);
          if (isFinite(t)) procesarAvance(t);
        }
      } catch {}
    }, 350);
    return () => window.clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esYoutube, activeClipPreview, loopPreview]);

  // Load project & saved clips
  useEffect(() => {
    async function loadProyecto() {
      setLoading(true);
      
      // 1. Try local storage
      let localItem: any = null;
      try {
        const localData = localStorage.getItem('clipforge_local_proyectos');
        if (localData) {
          const list = JSON.parse(localData);
          localItem = list.find((p: any) => p.id === effectiveId);
          if (localItem) {
            setProyecto(localItem);
            if (localItem.subtitulos_json) {
              setTranscriptData(localItem.subtitulos_json);
            }
          }
        }

        // Load local clips
        const localClipsData = localStorage.getItem(`clipforge_clips_${effectiveId}`);
        if (localClipsData) {
          const parsedClips: ClipItem[] = JSON.parse(localClipsData);
          setClips(parsedClips);
          if (parsedClips.length > 0) {
            setSelectedClipIds(new Set(parsedClips.slice(0, 3).map(c => c.id)));
          }
        }
      } catch (e) {
        console.error('Error reading local storage:', e);
      }

      // 2. Query Supabase if configured
      if (isSupabaseConfigured && user) {
        try {
          const { data, error } = await supabase
            .from('proyectos')
            .select('*')
            .eq('id', effectiveId)
            .single();

          if (!error && data) {
            const proj = data as Proyecto;
            // Validate user ownership
            if (proj.user_id && proj.user_id !== user.id) {
              toast.error('No tienes permisos para ver este proyecto');
              onNavigate?.('/dashboard');
              return;
            }
            setProyecto(proj);
            if (proj.subtitulos_json) {
              setTranscriptData(proj.subtitulos_json as unknown as TranscriptionPayload);
            }
          }

          // Query clips table from Supabase
          const { data: dbClips, error: clipsErr } = await (supabase.from('clips') as any)
            .select('*')
            .eq('proyecto_id', effectiveId)
            .order('puntuacion_viral', { ascending: false });

          if (!clipsErr && dbClips && dbClips.length > 0) {
            const formatted: ClipItem[] = dbClips.map((c: any) => ({
              id: c.id,
              proyecto_id: c.proyecto_id,
              inicio_seg: c.inicio_seg,
              fin_seg: c.fin_seg,
              duracion_seg: Math.round(c.fin_seg - c.inicio_seg),
              puntuacion_viral: c.puntuacion_viral || 75,
              titulo_hook: c.titulo_hook,
              razon: c.cta || 'Momento de alta retención viral.',
              cta: c.cta || '¡Sígueme para más trucos de crecimiento!',
              estado: c.estado || 'sugerido',
            }));
            setClips(formatted);
            setSelectedClipIds(new Set(formatted.slice(0, 3).map(c => c.id)));
          }
        } catch (err) {
          console.warn('Supabase query error:', err);
        }
      }

      // 3. Fallback dummy if empty
      if (!localItem && !isSupabaseConfigured) {
        const defaultProj: Proyecto = {
          id: effectiveId,
          user_id: user?.id || 'demo-user',
          titulo: 'Estrategia de Retención Viral en TikTok y Shorts',
          url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          archivo_nombre: null,
          estado: 'transcrito',
          duracion_seg: 180,
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString(),
        };
        setProyecto(defaultProj);
      }

      setLoading(false);
    }

    loadProyecto();
  }, [effectiveId, isSupabaseConfigured, user, onNavigate]);

  // ── Control de reproducción unificado: <video> (archivos) o YouTube IFrame ──
  // Avance de tiempo + bucle del clip activo
  const procesarAvance = (time: number) => {
    setCurrentTime(time);
    if (activeClipPreview) {
      if (time >= activeClipPreview.fin_seg) {
        if (loopPreview) {
          if (esYoutube) {
            ytPlayerRef.current?.seekTo?.(activeClipPreview.inicio_seg, true);
          } else if (videoRef.current) {
            videoRef.current.currentTime = activeClipPreview.inicio_seg;
          }
        } else {
          if (esYoutube) {
            ytPlayerRef.current?.pauseVideo?.();
          } else {
            videoRef.current?.pause();
          }
          setIsPlaying(false);
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) procesarAvance(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setVideoDuration(videoRef.current.duration);
  };

  // Orden de reproducción según el tipo de proyecto
  const controlarReproduccion = (op: 'seek' | 'toggle', timestamp?: number) => {
    if (esYoutube) {
      const p = ytPlayerRef.current;
      if (!p || !ytApiReadyRef.current) {
        toast.info('El reproductor de YouTube está cargando…');
        return;
      }
      if (op === 'seek' && typeof timestamp === 'number') {
        p.seekTo(timestamp, true);
        if (p.getPlayerState?.() !== 1) p.playVideo?.();
        setIsPlaying(true);
      } else {
        const estado = p.getPlayerState?.();
        if (estado === 1) {
          p.pauseVideo?.();
          setIsPlaying(false);
        } else {
          p.playVideo?.();
          setIsPlaying(true);
        }
      }
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (op === 'seek' && typeof timestamp === 'number') {
      v.currentTime = timestamp;
      if (v.paused) v.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      if (v.paused) {
        v.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        v.pause();
        setIsPlaying(false);
      }
    }
  };

  // Seek to specific timestamp (both players)
  const seekTo = (timestamp: number, stopClipPreview: boolean = true) => {
    if (stopClipPreview) setActiveClipPreview(null);
    controlarReproduccion('seek', timestamp);
  };

  const togglePlay = () => controlarReproduccion('toggle');

  // Play clip preview
  const playClipPreview = (clip: ClipItem) => {
    setActiveClipPreview(clip);
    controlarReproduccion('seek', clip.inicio_seg);
    toast.info(`Reproduciendo "${clip.titulo_hook}" (${clip.duracion_seg}s)`);
  };

  // Toggle clip selection
  const toggleClipSelect = (id: string) => {
    setSelectedClipIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedClipIds.size === clips.length) {
      setSelectedClipIds(new Set());
    } else {
      setSelectedClipIds(new Set(clips.map(c => c.id)));
    }
  };

  // Transcripción REAL por subtítulos de YouTube (proyectos creados con URL de YouTube)
  const transcribirDesdeYoutube = async () => {
    if (!proyecto?.url_youtube) return;
    setTranscribing(true);
    setProgressPercent(15);
    setProgressStage('Obteniendo subtítulos reales de YouTube…');
    setProgressDetail('Buscando transcripción en español (manual o automática)…');

    try {
      const res = await fetch('/api/youtube/transcribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: proyecto.url_youtube }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `Error obteniendo subtítulos de YouTube (${res.status})`);
      }

      setProgressPercent(85);
      setProgressStage('Guardando transcripción con marcas de tiempo…');
      setProgressDetail('Indexando segmentos y palabras por segundo…');

      const result = data as TranscriptionPayload;
      const duracion = Number(result.duration) || proyecto.duracion_seg || 60;

      const updatedProj: Proyecto = {
        ...proyecto!,
        estado: 'transcrito',
        duracion_seg: Math.round(duracion),
        subtitulos_json: result as any,
        actualizado_en: new Date().toISOString(),
      };
      setProyecto(updatedProj);
      setTranscriptData(result);

      if (isSupabaseConfigured && user) {
        try {
          await (supabase.from('proyectos') as any)
            .update({
              estado: 'transcrito',
              duracion_seg: Math.round(duracion),
              subtitulos_json: result,
              actualizado_en: new Date().toISOString(),
            })
            .eq('id', effectiveId);
        } catch (dbErr) {
          console.warn('Error guardando transcripción YouTube en Supabase:', dbErr);
        }
      }

      try {
        const localData = localStorage.getItem('clipforge_local_proyectos');
        const list = localData ? JSON.parse(localData) : [];
        const index = list.findIndex((p: any) => p.id === effectiveId);
        if (index >= 0) {
          list[index] = updatedProj;
        } else {
          list.push(updatedProj);
        }
        localStorage.setItem('clipforge_local_proyectos', JSON.stringify(list));
      } catch (e) {
        console.warn('Error guardando en localStorage:', e);
      }

      setProgressPercent(100);
      setProgressStage('¡Transcripción completada!');
      toast.success(
        `Transcripción real de YouTube obtenida (${result.segments?.length || 0} segmentos)`
      );
    } catch (err: any) {
      console.error('Transcripción YouTube error:', err);
      toast.error(err.message || 'Error al obtener los subtítulos de YouTube');
    } finally {
      setTimeout(() => {
        setTranscribing(false);
      }, 800);
    }
  };

  // Transcription process
  const startTranscription = async () => {
    // Proyecto de YouTube: usar subtítulos reales en vez de extraer audio del bucket
    if (esYoutube && proyecto?.url_youtube && !proyecto?.video_url) {
      await transcribirDesdeYoutube();
      return;
    }

    setTranscribing(true);
    setProgressPercent(10);
    setProgressStage('Iniciando proceso...');
    setProgressDetail('Preparando conexión con el servicio de almacenamiento');

    try {
      let audioBlobToSend: Blob | null = null;
      let calculatedDuration = proyecto?.duracion_seg || 180;

      if (calculatedDuration > 7200) {
        toast.warning('El audio dura más de 2 horas. Se procesará por bloques.');
      }

      setProgressPercent(25);
      setProgressStage('Descargando vídeo...');
      setProgressDetail('Obteniendo archivo binario desde el bucket...');

      let videoBlob: Blob | null = null;

      if (isSupabaseConfigured && user && proyecto) {
        try {
          const filePath = `${user.id}/${proyecto.id}/original.mp4`;
          const { data: downloadedBlob, error: downloadErr } = await supabase
            .storage
            .from('media')
            .download(filePath);

          if (!downloadErr && downloadedBlob) {
            videoBlob = downloadedBlob;
          }
        } catch (storageErr) {
          console.warn('Storage download fallback:', storageErr);
        }
      }

      if (videoBlob) {
        setProgressPercent(45);
        setProgressStage('Extrayendo audio a 16kHz mono...');
        const extraction = await extract16kHzAudio(videoBlob, (p) => {
          setProgressPercent(45 + Math.round(p.percent * 0.2));
          setProgressStage(p.stage);
          if (p.detail) setProgressDetail(p.detail);
        });
        audioBlobToSend = extraction.audioBlob;
        calculatedDuration = Math.round(extraction.duration);
      }

      setProgressPercent(70);
      setProgressStage('Transcribiendo con Whisper Large v3 Turbo...');
      setProgressDetail('Groq IA analizando palabras y marcas de tiempo exactas...');

      const formData = new FormData();
      if (audioBlobToSend) {
        formData.append('file', audioBlobToSend, 'audio.wav');
      }
      formData.append('language', 'es');
      formData.append('duracion_seg', String(calculatedDuration));

      const apiRes = await fetch('/api/transcribir', {
        method: 'POST',
        body: audioBlobToSend ? formData : JSON.stringify({ duracion_seg: calculatedDuration }),
        headers: audioBlobToSend ? undefined : { 'Content-Type': 'application/json' },
      });

      if (!apiRes.ok) {
        throw new Error(`Error en el servidor de transcripción (${apiRes.status})`);
      }

      const result: TranscriptionPayload = await apiRes.json();

      setProgressPercent(95);
      setProgressStage('Guardando subtítulos estructurados...');
      setProgressDetail('Indexando marcas de tiempo por palabra...');

      const updatedProj: Proyecto = {
        ...proyecto!,
        estado: 'transcrito',
        duracion_seg: calculatedDuration || result.duration || 180,
        subtitulos_json: result as any,
        actualizado_en: new Date().toISOString(),
      };

      setProyecto(updatedProj);
      setTranscriptData(result);

      // Save to Supabase
      if (isSupabaseConfigured && user) {
        try {
          await (supabase.from('proyectos') as any)
            .update({
              estado: 'transcrito',
              duracion_seg: updatedProj.duracion_seg,
              subtitulos_json: result,
              actualizado_en: new Date().toISOString(),
            })
            .eq('id', effectiveId);
        } catch (dbErr) {
          console.warn('Error saving transcription to Supabase:', dbErr);
        }
      }

      // Save to LocalStorage
      try {
        const localData = localStorage.getItem('clipforge_local_proyectos');
        const list = localData ? JSON.parse(localData) : [];
        const index = list.findIndex((p: any) => p.id === effectiveId);
        if (index >= 0) {
          list[index] = updatedProj;
        } else {
          list.push(updatedProj);
        }
        localStorage.setItem('clipforge_local_proyectos', JSON.stringify(list));
      } catch (e) {
        console.warn('Error saving to localStorage:', e);
      }

      setProgressPercent(100);
      setProgressStage('¡Transcripción completada!');
      toast.success('Audio transcrito con éxito con marcas de tiempo');
    } catch (err: any) {
      console.error('Transcription error:', err);
      toast.error(err.message || 'Error al transcribir el audio');
    } finally {
      setTimeout(() => {
        setTranscribing(false);
      }, 800);
    }
  };

  // Viral Hooks Analysis (Fase 5)
  const startViralAnalysis = async () => {
    if (!transcriptData) {
      toast.error('Primero debes completar la transcripción del audio');
      return;
    }

    setAnalyzing(true);
    setAnalyzeProgressPercent(15);
    setAnalyzeProgressStage('Dividiendo transcripción en ventanas de 30s...');

    try {
      const duracionTotal = proyecto?.duracion_seg || (transcriptData.segments.length ? transcriptData.segments[transcriptData.segments.length - 1].end : 180);
      
      // 1. Generar ventanas de 30s con 5s solape
      const ventanas = generarVentanasTemporales(duracionTotal, 30, 5);

      setAnalyzeProgressPercent(35);
      setAnalyzeProgressStage('Calculando heurísticas locales (Web Audio API & velocidad de habla)...');

      // 2. Heurísticas acústicas y ritmo
      const words = transcriptData.words?.length 
        ? transcriptData.words 
        : (transcriptData.segments?.flatMap(s => s.words || []) || []);

      const heuristicas = await calcularHeuristicasVentanas(ventanas, words);

      setAnalyzeProgressPercent(55);
      setAnalyzeProgressStage('Evaluando potencial viral con Llama 3.3 70B...');

      // 3. Llamar API /api/analizar
      const response = await fetch('/api/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: effectiveId,
          duracion_seg: duracionTotal,
          subtitulos_json: transcriptData,
          heuristicas,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en el análisis de viralidad (${response.status})`);
      }

      const data = await response.json();
      const rawClips: ClipItem[] = data.clips || [];
      if (data?.provider) setAnalyzeProvider(data.provider);

      setAnalyzeProgressPercent(80);
      setAnalyzeProgressStage('Generando miniaturas de vídeo…');

      // 4. Miniaturas: frame real del vídeo (archivos) o miniatura de YouTube (URL)
      let clipsWithThumbs: ClipItem[] = rawClips;
      if (esYoutube && videoIdYt) {
        clipsWithThumbs = rawClips.map((clip) => ({
          ...clip,
          thumbnail: `https://i.ytimg.com/vi/${videoIdYt}/hqdefault.jpg`,
        }));
      } else {
        const videoSrc = proyecto?.video_url || '';
        if (videoSrc) {
          clipsWithThumbs = await Promise.all(
            rawClips.map(async (clip) => {
              try {
                const thumb = await captureVideoFrame(videoSrc, clip.inicio_seg + 1);
                return { ...clip, thumbnail: thumb };
              } catch {
                return clip;
              }
            })
          );
        }
      }

      setClips(clipsWithThumbs);
      setSelectedClipIds(new Set(clipsWithThumbs.slice(0, 3).map(c => c.id)));

      // 5. Actualizar estado del proyecto a 'analizado'
      const updatedProj: Proyecto = {
        ...proyecto!,
        estado: 'analizado',
        actualizado_en: new Date().toISOString(),
      };
      setProyecto(updatedProj);

      // Guardar en Supabase
      if (isSupabaseConfigured && user) {
        try {
          await (supabase.from('proyectos') as any)
            .update({
              estado: 'analizado',
              actualizado_en: new Date().toISOString(),
            })
            .eq('id', effectiveId);

          // Guardar clips en la tabla clips
          for (const c of clipsWithThumbs) {
            await (supabase.from('clips') as any).upsert({
              id: c.id,
              proyecto_id: effectiveId,
              inicio_seg: c.inicio_seg,
              fin_seg: c.fin_seg,
              puntuacion_viral: c.puntuacion_viral,
              titulo_hook: c.titulo_hook,
              cta: c.cta || c.razon,
              estado: 'sugerido',
              creado_en: new Date().toISOString(),
            });
          }
        } catch (dbErr) {
          console.warn('Error saving clips to Supabase:', dbErr);
        }
      }

      // Guardar en LocalStorage
      try {
        localStorage.setItem(`clipforge_clips_${effectiveId}`, JSON.stringify(clipsWithThumbs));
        const localData = localStorage.getItem('clipforge_local_proyectos');
        const list = localData ? JSON.parse(localData) : [];
        const index = list.findIndex((p: any) => p.id === effectiveId);
        if (index >= 0) {
          list[index] = updatedProj;
          localStorage.setItem('clipforge_local_proyectos', JSON.stringify(list));
        }
      } catch (e) {
        console.warn('Error saving to localStorage:', e);
      }

      setAnalyzeProgressPercent(100);
      setAnalyzeProgressStage('¡Análisis viral completado!');
      setActiveViewTab('clips');
      toast.success(`Se han extraído ${clipsWithThumbs.length} momentos virales con éxito`);
    } catch (err: any) {
      console.error('Error analyzing viral hooks:', err);
      toast.error(err.message || 'Fallo durante el análisis de viralidad');
    } finally {
      setTimeout(() => {
        setAnalyzing(false);
      }, 700);
    }
  };

  // Save edited clip
  const handleSaveClipEdit = (edited: ClipItem) => {
    setClips(prev => prev.map(c => c.id === edited.id ? edited : c));
    try {
      const current = clips.map(c => c.id === edited.id ? edited : c);
      localStorage.setItem(`clipforge_clips_${effectiveId}`, JSON.stringify(current));
    } catch {}
    toast.success('Cambios del clip guardados');
    setEditingClip(null);
  };

  // Generate Clips Batch Action (Fase 6 - Corte)
  const handleGenerateShorts = (clipIdsToProcess: string[]) => {
    if (clipIdsToProcess.length === 0) {
      toast.warning('Selecciona al menos un clip para generar');
      return;
    }

    // Corte real = necesita el archivo de vídeo (mp4). Los proyectos de YouTube
    // todavía no tienen el mp4 original descargado (YouTube lo bloquea), así que
    // no podemos generar el archivo cortado sin el original.
    if (proyecto?.url_youtube && !proyecto?.video_url) {
      toast.warning(
        'Para generar los clips en formato vertical se necesita el archivo de vídeo. ' +
          'Por ahora puedes previsualizar y editar los momentos desde esta pantalla. ' +
          'El corte desde YouTube estará disponible cuando se habilite la descarga del original (o importa el mp4 con "Subir archivo").'
      );
      return;
    }

    toast.success(`Iniciando corte y procesamiento de ${clipIdsToProcess.length} clip(s)...`);
    
    // Save selected clips
    try {
      const selectedClips = clips.filter(c => clipIdsToProcess.includes(c.id));
      localStorage.setItem(`clipforge_selected_clips_${effectiveId}`, JSON.stringify(selectedClips));
    } catch {}

    onNavigate?.(`/dashboard/proyecto/${effectiveId}/clips`);
  };

  // Copy full transcript to clipboard
  const copyTranscript = () => {
    if (!transcriptData) return;
    const text = transcriptData.text || transcriptData.segments.map(s => s.text).join(' ');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Transcripción copiada al portapapeles');
    setTimeout(() => setCopied(false), 2500);
  };

  // Download SRT
  const downloadSRT = () => {
    if (!transcriptData?.segments?.length) return;
    
    function formatSRTTime(seconds: number): string {
      const date = new Date(0);
      date.setMilliseconds(seconds * 1000);
      const iso = date.toISOString();
      const timePart = iso.substring(11, 23).replace('.', ',');
      return timePart;
    }

    let srtContent = '';
    transcriptData.segments.forEach((seg, idx) => {
      srtContent += `${idx + 1}\n`;
      srtContent += `${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}\n`;
      srtContent += `${seg.text.trim()}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${proyecto?.titulo || 'subtitulos'}.srt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Archivo .SRT descargado');
  };

  // Helper format time
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Word list for transcription
  const allWords = transcriptData?.words?.length 
    ? transcriptData.words 
    : (transcriptData?.segments?.flatMap(s => s.words || []) || []);

  const displayTitle = proyecto?.titulo || 'Proyecto sin título';
  const isNuevo = proyecto?.estado === 'nuevo' || proyecto?.estado === 'importando';
  const isTranscrito = proyecto?.estado === 'transcrito';
  const isAnalizado = proyecto?.estado === 'analizado' || clips.length > 0;

  // Viral Score Badge Helpers
  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return {
        label: 'Viral Legend',
        bg: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-purple-500/30',
        ring: 'ring-purple-500/40',
        textColor: 'text-purple-400',
      };
    }
    if (score >= 80) {
      return {
        label: 'Alto Potencial',
        bg: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-cyan-500/30',
        ring: 'ring-cyan-500/40',
        textColor: 'text-cyan-400',
      };
    }
    if (score >= 60) {
      return {
        label: 'Buen Ritmo',
        bg: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/30',
        ring: 'ring-emerald-500/40',
        textColor: 'text-emerald-400',
      };
    }
    return {
      label: 'Estándar',
      bg: 'bg-slate-700 text-slate-200 shadow-slate-700/20',
      ring: 'ring-slate-600',
      textColor: 'text-slate-400',
    };
  };

  return (
    <div className="flex-1 bg-[#0a0a12] text-slate-100 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-6">
          <div className="flex items-center gap-3">
            <button
              id="back-btn"
              onClick={() => onNavigate?.('/dashboard')}
              className="p-2.5 rounded-xl bg-[#141424] border border-purple-900/40 text-slate-300 hover:text-white hover:border-purple-500/50 transition-colors cursor-pointer"
              title="Volver al panel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {displayTitle}
                </h1>
                {isNuevo && !transcriptData ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    Listo para transcribir
                  </span>
                ) : isAnalizado ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    {clips.length} Clips Virales Extraídos
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Audio Transcrito
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>ID: <code className="text-purple-300 font-mono">{effectiveId}</code></span>
                <span>•</span>
                <span>{proyecto?.url_youtube ? 'YouTube' : 'Archivo Local'}</span>
                <span>•</span>
                <span>Duración: {formatTime(proyecto?.duracion_seg || 180)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {transcriptData && (
              <>
                <button
                  onClick={copyTranscript}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#141424] border border-purple-900/40 text-slate-300 hover:text-white hover:border-purple-500/40 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-purple-400" />}
                  <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
                </button>
                <button
                  onClick={downloadSRT}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#141424] border border-purple-900/40 text-slate-300 hover:text-white hover:border-purple-500/40 transition-colors"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Descargar .SRT</span>
                </button>
              </>
            )}

            {isTranscrito && !isAnalizado && (
              <button
                id="analizar-hooks-btn"
                onClick={startViralAnalysis}
                disabled={analyzing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                <span>⚡ Analizar Hooks Virales</span>
              </button>
            )}
          </div>
        </div>

        {/* SECTION A: If project is 'nuevo' and not transcribed yet */}
        {isNuevo && !transcriptData && (
          <div className="bg-gradient-to-br from-[#131326] via-[#171730] to-[#121222] border border-purple-900/50 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800/50 text-xs font-bold text-purple-300">
                <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Paso 2 del Pipeline de Viralidad</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {esYoutube
                  ? 'Obtener transcripción real de YouTube'
                  : 'Transcribir audio con Whisper Large v3 Turbo'}
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed">
                {esYoutube
                  ? 'Leeremos los subtítulos (manuales o automáticos) del vídeo directamente desde YouTube y construiremos la transcripción con marcas de tiempo por palabra, sin necesidad de descargar el vídeo.'
                  : 'Extraeremos la pista de audio a 16kHz mono directamente en tu navegador y la procesaremos con el motor Whisper de Groq. Obtendrás marcas de tiempo exactas por palabra, detección de idioma automática y una precisión superior al 98%.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300 pt-2">
                <div className="flex items-start gap-2.5 bg-[#0e0e1c]/80 p-3.5 rounded-xl border border-purple-900/40">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Privacidad y Clave Segura</span>
                    <span>Tu clave de API se procesa exclusivamente en el servidor y nunca se expone al navegador.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-[#0e0e1c]/80 p-3.5 rounded-xl border border-purple-900/40">
                  <Cpu className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Extracción 16kHz Ultrarrápida</span>
                    <span>Remuestreo nativo con Web Audio API para máxima compatibilidad y velocidad.</span>
                  </div>
                </div>
              </div>

              {transcribing ? (
                <div className="bg-[#0e0e1a] border border-purple-500/40 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-300 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      {progressStage}
                    </span>
                    <span className="font-mono font-bold text-cyan-400">{progressPercent}%</span>
                  </div>
                  
                  <div className="w-full bg-[#18182e] h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-600 via-cyan-500 to-emerald-400 h-full transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    {progressDetail || 'Procesando...'}
                  </p>
                </div>
              ) : (
                <button
                  id="transcribir-audio-btn"
                  onClick={startTranscription}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <Volume2 className="w-5 h-5 text-cyan-300" />
                  <span>🔊 Transcribir audio</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* SECTION B: Analyzing Viral Hooks Progress Overlay/Card */}
        {analyzing && (
          <div className="bg-gradient-to-r from-purple-950/60 via-[#15152a] to-pink-950/60 border border-purple-500/50 rounded-2xl p-6 shadow-2xl space-y-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-pink-400">
                  <Sparkles className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {analyzeProgressStage || 'Analizando momentos virales...'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Llama 3.3 70B evaluando ganchos + Web Audio API computando energía y velocidad
                  </p>
                </div>
              </div>
              <span className="font-mono text-base font-extrabold text-pink-400">
                {analyzeProgressPercent}%
              </span>
            </div>

            <div className="w-full bg-[#18182e] h-3 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-purple-600 via-indigo-500 to-pink-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${analyzeProgressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* SECTION C: Transcribed & Ready to Analyze Banner (if not analyzed yet) */}
        {isTranscrito && !isAnalizado && !analyzing && (
          <div className="bg-[#121222] border border-purple-900/50 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-950 border border-purple-600/50 flex items-center justify-center text-amber-300 shrink-0">
                <Flame className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  ¡Audio transcrito! Descubre los momentos con mayor potencial viral
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  El algoritmo analizará ventanas de 30s con Llama 3.3 70B (60%) y métricas acústicas de energía/habla (40%) para extraer los 6 mejores clips.
                </p>
              </div>
            </div>

            <button
              onClick={startViralAnalysis}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/30 transition-all transform hover:scale-105 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>⚡ Extraer Clips Virales (Fase 5)</span>
            </button>
          </div>
        )}

        {/* SECTION D: Main Workspace - Playlist Layout (Left Video, Right Suggested Clips) */}
        {transcriptData && (
          <div className="space-y-6">
            {/* View Tabs */}
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveViewTab('clips')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeViewTab === 'clips'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-[#141424] text-slate-400 hover:text-white border border-purple-900/30'
                  }`}
                >
                  <Film className="w-4 h-4 text-pink-300" />
                  <span>Clips Sugeridos ({clips.length})</span>
                </button>
                <button
                  onClick={() => setActiveViewTab('transcripcion')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeViewTab === 'transcripcion'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-[#141424] text-slate-400 hover:text-white border border-purple-900/30'
                  }`}
                >
                  <Subtitles className="w-4 h-4 text-cyan-300" />
                  <span>Transcripción Completa</span>
                </button>
              </div>

              {clips.length > 0 && activeViewTab === 'clips' && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {selectedClipIds.size === clips.length ? 'Desmarcar todos' : 'Seleccionar todos'}
                  </button>
                  <button
                    onClick={() => handleGenerateShorts(Array.from(selectedClipIds))}
                    disabled={selectedClipIds.size === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-md shadow-pink-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Scissors className="w-4 h-4 text-yellow-300" />
                    <span>Generar los clips ({selectedClipIds.size})</span>
                  </button>
                </div>
              )}
            </div>

            {/* Transparencia del motor y del origen del vídeo */}
            {clips.length > 0 && (
              <div className="flex items-start gap-2.5 text-[11px] rounded-xl px-3.5 py-2.5 border border-purple-900/30 bg-[#0e0e1c]/70 text-slate-300">
                <Cpu className="w-3.5 h-3.5 mt-0.5 text-purple-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white">
                    Motor de análisis:{' '}
                    {analyzeProvider === 'groq-llama-3.3'
                      ? 'Llama 3.3 70B (Groq) + heurística'
                      : analyzeProvider === 'algorithmic-heuristic'
                        ? 'Heurístico local (Llama no disponible en este intento)'
                        : '…'}
                  </span>
                  {analyzeProvider === 'algorithmic-heuristic' && (
                    <span className="text-amber-300/90 block mt-0.5">
                      ⚠ Los títulos y razones pueden sonar genéricos. Si se repite, el límite gratuito de la IA se agotó o Groq no respondió a tiempo.
                    </span>
                  )}
                  {esYoutube && (
                    <span className="text-cyan-300/80 block mt-0.5">
                      Origen: YouTube — aquí se reproduce el vídeo real (en línea). El corte a mp4 requiere el archivo original.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* PLAYLIST GRID: Video on Left (5 cols) | Cards / Transcript on Right (7 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: Video Player & Timeline Segment Markers */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#121222] border border-purple-900/40 rounded-2xl overflow-hidden shadow-2xl sticky top-6">
                  {/* Video Container */}
                  <div className="relative aspect-video bg-black flex items-center justify-center group">
                    {esYoutube ? (
                      <>
                        {/* Reproductor REAL de YouTube (el vídeo se ve de verdad) */}
                        <div
                          ref={ytContainerRef}
                          className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
                        />
                        {!ytApiReadyRef.current && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-slate-300 z-10">
                            <Youtube className="w-10 h-10 text-red-500 animate-pulse" />
                            <span className="text-xs font-semibold">Cargando reproductor de YouTube…</span>
                          </div>
                        )}
                        {/* Active Clip Preview Badge */}
                        {activeClipPreview && (
                          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md border border-purple-500/60 px-3 py-1 rounded-lg text-xs font-bold text-pink-300 flex items-center gap-1.5 shadow-lg z-10 pointer-events-none">
                            <Radio className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                            <span>Previsualizando: {activeClipPreview.titulo_hook}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {proyecto?.video_url ? (
                          <video
                            ref={videoRef}
                            src={proyecto.video_url}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            className="w-full h-full object-contain cursor-pointer"
                            onClick={togglePlay}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0a0a14] text-slate-500">
                            <FileVideo className="w-12 h-12 opacity-40" />
                            <span className="text-xs px-6 text-center">
                              El vídeo aparecerá aquí tras procesarse. Si no se ve, abre el archivo original para reproducirlo.
                            </span>
                          </div>
                        )}

                        {/* Overlay Play/Pause Button */}
                        <button
                          onClick={togglePlay}
                          className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 hover:bg-purple-600/80 backdrop-blur-md flex items-center justify-center text-white transition-all transform hover:scale-110 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                        </button>

                        {/* Active Clip Preview Badge */}
                        {activeClipPreview && (
                          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md border border-purple-500/60 px-3 py-1 rounded-lg text-xs font-bold text-pink-300 flex items-center gap-1.5 shadow-lg">
                            <Radio className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                            <span>Previsualizando: {activeClipPreview.titulo_hook}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Player Controls & Interactive Timeline */}
                  <div className="p-4 bg-[#15152a] border-t border-purple-900/30 space-y-3">
                    {/* Visual Segment Markers on Timeline */}
                    <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden flex items-center">
                      {/* Base progress */}
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-purple-600/50 transition-all pointer-events-none"
                        style={{ width: `${((currentTime / (videoDuration || proyecto?.duracion_seg || 180)) * 100)}%` }}
                      />
                      
                      {/* Clip markers */}
                      {clips.map((c) => {
                        const total = videoDuration || proyecto?.duracion_seg || 180;
                        const leftPct = (c.inicio_seg / total) * 100;
                        const widthPct = ((c.fin_seg - c.inicio_seg) / total) * 100;
                        const isActive = activeClipPreview?.id === c.id;

                        return (
                          <div
                            key={c.id}
                            title={`${c.titulo_hook} (${formatTime(c.inicio_seg)} - ${formatTime(c.fin_seg)})`}
                            onClick={() => playClipPreview(c)}
                            className={`absolute top-0 bottom-0 rounded-sm cursor-pointer transition-all ${
                              isActive 
                                ? 'bg-gradient-to-r from-pink-500 to-amber-400 ring-2 ring-white z-10' 
                                : 'bg-purple-400/60 hover:bg-purple-300'
                            }`}
                            style={{ left: `${leftPct}%`, width: `${Math.max(1.5, widthPct)}%` }}
                          />
                        );
                      })}

                      {/* Scrubber slider */}
                      <input
                        type="range"
                        min={0}
                        max={videoDuration || proyecto?.duracion_seg || 180}
                        step={0.1}
                        value={currentTime}
                        onChange={(e) => seekTo(Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={togglePlay}
                          className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer"
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                        </button>
                        <span className="font-mono text-cyan-300 font-bold">
                          {formatTime(currentTime)} / {formatTime(videoDuration || proyecto?.duracion_seg || 180)}
                        </span>
                      </div>

                      {activeClipPreview && (
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={loopPreview}
                            onChange={(e) => setLoopPreview(e.target.checked)}
                            className="accent-pink-500 rounded"
                          />
                          <span>Repetir Clip</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Playlist Metrics Card */}
                {clips.length > 0 && (
                  <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-[#17172f]/70 p-3 rounded-xl border border-purple-900/20">
                      <span className="text-slate-400 block mb-1">Clips Extraídos</span>
                      <span className="text-base font-bold text-white">{clips.length}</span>
                    </div>
                    <div className="bg-[#17172f]/70 p-3 rounded-xl border border-purple-900/20">
                      <span className="text-slate-400 block mb-1">Puntuación Media</span>
                      <span className="text-base font-bold text-pink-400">
                        {Math.round(clips.reduce((acc, c) => acc + c.puntuacion_viral, 0) / clips.length)} pts
                      </span>
                    </div>
                    <div className="bg-[#17172f]/70 p-3 rounded-xl border border-purple-900/20">
                      <span className="text-slate-400 block mb-1">Seleccionados</span>
                      <span className="text-base font-bold text-cyan-300">{selectedClipIds.size}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Playlist of Suggested Clips OR Transcript */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* TAB 1: SUGGESTED CLIPS PLAYLIST */}
                {activeViewTab === 'clips' && (
                  <div className="space-y-4">
                    {clips.length === 0 ? (
                      <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-8 text-center space-y-4">
                        <Sparkles className="w-10 h-10 text-purple-400 mx-auto animate-pulse" />
                        <div>
                          <h3 className="text-base font-bold text-white">Aún no se han generado los clips virales</h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Haz clic en el botón para ejecutar el análisis con Llama 3.3 70B y heurísticas acústicas.
                          </p>
                        </div>
                        <button
                          onClick={startViralAnalysis}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Analizar Clips Virales Ahora</span>
                        </button>
                      </div>
                    ) : (
                      clips.map((clip, index) => {
                        const isSelected = selectedClipIds.has(clip.id);
                        const isPreviewing = activeClipPreview?.id === clip.id;
                        const badge = getScoreBadge(clip.puntuacion_viral);

                        return (
                          <div
                            key={clip.id}
                            className={`p-4 sm:p-5 rounded-2xl transition-all duration-200 border relative ${
                              isPreviewing
                                ? 'bg-gradient-to-r from-purple-950/50 via-[#16162c] to-[#121222] border-pink-500/70 shadow-xl shadow-pink-950/30 ring-1 ring-pink-500/50'
                                : isSelected
                                ? 'bg-[#141428] border-purple-700/60 shadow-lg'
                                : 'bg-[#121222] border-purple-900/30 hover:border-purple-800/50'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row gap-4 items-start">
                              
                              {/* Left Thumbnail with Duration & Play button */}
                              <div 
                                onClick={() => playClipPreview(clip)}
                                className="relative w-full sm:w-44 h-28 bg-[#1a1a32] rounded-xl overflow-hidden shrink-0 group cursor-pointer border border-purple-900/40 shadow-inner"
                              >
                                {clip.thumbnail ? (
                                  <img 
                                    src={clip.thumbnail} 
                                    alt={clip.titulo_hook} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-950 to-slate-900">
                                    <Film className="w-8 h-8 text-purple-400 opacity-60" />
                                  </div>
                                )}

                                {/* Hover Play Overlay */}
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-purple-900/50 flex items-center justify-center transition-colors">
                                  <div className="w-10 h-10 rounded-full bg-white/90 group-hover:bg-pink-500 text-black group-hover:text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                                    {isPreviewing && isPlaying ? (
                                      <Pause className="w-4 h-4" />
                                    ) : (
                                      <Play className="w-4 h-4 ml-0.5" />
                                    )}
                                  </div>
                                </div>

                                {/* Duration & Timestamp Badge */}
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-cyan-300 font-bold backdrop-blur-sm">
                                  {formatTime(clip.inicio_seg)} - {formatTime(clip.fin_seg)} ({clip.duracion_seg}s)
                                </div>
                              </div>

                              {/* Middle & Right Content */}
                              <div className="flex-1 min-w-0 space-y-2.5">
                                
                                {/* Header: Hook Title & Viral Score Badge */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleClipSelect(clip.id)}
                                      className="w-4 h-4 accent-pink-500 rounded cursor-pointer mt-0.5"
                                      title="Seleccionar para exportar"
                                    />
                                    <h4 className="text-sm sm:text-base font-bold text-white leading-snug line-clamp-1">
                                      #{index + 1} {clip.titulo_hook}
                                    </h4>
                                  </div>

                                  {/* Viral Score Pill */}
                                  <div className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-md ${badge.bg}`}>
                                    <Flame className="w-3.5 h-3.5 fill-current" />
                                    <span>{clip.puntuacion_viral}/100</span>
                                  </div>
                                </div>

                                {/* Viral Reason & Mechanism */}
                                <p className="text-xs text-slate-300 leading-relaxed bg-[#0e0e1a]/80 p-2.5 rounded-xl border border-purple-900/30">
                                  <strong className="text-pink-300 font-semibold">Por qué es viral: </strong>
                                  {clip.razon}
                                </p>

                                {/* Score Breakdown Bar (60% LLM + 40% Audio) */}
                                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                                      IA Llama 3.3: <strong className="text-slate-200">{clip.score_llm || clip.puntuacion_viral} pts</strong>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                      Audio/Ritmo: <strong className="text-slate-200">{clip.score_heuristica || Math.round(clip.puntuacion_viral * 0.9)} pts</strong>
                                    </span>
                                  </div>
                                  
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${badge.textColor}`}>
                                    {badge.label}
                                  </span>
                                </div>

                                {/* Action Buttons for this Clip */}
                                <div className="flex items-center justify-between pt-2 border-t border-purple-900/20 gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => playClipPreview(clip)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a32] text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors cursor-pointer"
                                    >
                                      <Play className="w-3 h-3 text-cyan-400" />
                                      <span>Previsualizar</span>
                                    </button>

                                    <button
                                      onClick={() => setEditingClip(clip)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a32] text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3 text-amber-400" />
                                      <span>Editar</span>
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => handleGenerateShorts([clip.id])}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-md shadow-pink-600/20 transition-all cursor-pointer"
                                  >
                                    <Scissors className="w-3.5 h-3.5" />
                                    <span>Cortar Clip</span>
                                  </button>
                                </div>

                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* TAB 2: SYNCHRONIZED TRANSCRIPT VIEW */}
                {activeViewTab === 'transcripcion' && (
                  <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-5 flex flex-col h-[560px] shadow-xl">
                    <div className="flex items-center justify-between gap-3 pb-4 border-b border-purple-900/30">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Buscar palabra o frase en la transcripción..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-[#17172e] border border-purple-900/40 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoScroll}
                          onChange={(e) => setAutoScroll(e.target.checked)}
                          className="accent-purple-500 rounded"
                        />
                        <span>Auto-scroll</span>
                      </label>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2 scrollbar-thin scrollbar-thumb-purple-900">
                      {transcriptData.segments.map((seg, sIdx) => {
                        const isSegActive = currentTime >= seg.start && currentTime <= seg.end;
                        const matchesSearch = searchQuery 
                          ? seg.text.toLowerCase().includes(searchQuery.toLowerCase()) 
                          : true;

                        if (!matchesSearch) return null;

                        return (
                          <div
                            key={seg.id || sIdx}
                            className={`p-3.5 rounded-xl transition-all duration-200 border cursor-pointer ${
                              isSegActive
                                ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/30'
                                : 'bg-[#151528]/60 border-purple-900/20 hover:bg-[#181830] hover:border-purple-800/40'
                            }`}
                            onClick={() => seekTo(seg.start)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  seekTo(seg.start);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#1d1d36] text-cyan-300 border border-cyan-800/40 hover:bg-cyan-950 transition-colors"
                              >
                                <Play className="w-2.5 h-2.5" />
                                <span>{formatTime(seg.start)} - {formatTime(seg.end)}</span>
                              </button>

                              {isSegActive && (
                                <span className="text-[10px] font-semibold text-purple-300 flex items-center gap-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                  Reproduciendo ahora
                                </span>
                              )}
                            </div>

                            <div className="text-sm leading-relaxed text-slate-300">
                              {seg.words && seg.words.length > 0 ? (
                                seg.words.map((w, wIdx) => {
                                  const isWordActive = currentTime >= w.start && currentTime <= w.end;
                                  const isWordSearchMatch = searchQuery && w.word.toLowerCase().includes(searchQuery.toLowerCase());

                                  return (
                                    <span
                                      key={wIdx}
                                      ref={isWordActive ? activeWordRef : null}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        seekTo(w.start);
                                      }}
                                      className={`inline-block px-0.5 py-0.5 rounded transition-all duration-150 cursor-pointer ${
                                        isWordActive
                                          ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black font-extrabold shadow-sm shadow-yellow-400/50 scale-105'
                                          : isWordSearchMatch
                                          ? 'bg-purple-600/60 text-white font-bold'
                                          : 'hover:text-white hover:bg-purple-900/30'
                                      }`}
                                    >
                                      {w.word}{' '}
                                    </span>
                                  );
                                })
                              ) : (
                                <p>{seg.text}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDIT CLIP MODAL */}
        {editingClip && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#141428] border border-purple-800/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              
              <div className="flex items-center justify-between border-b border-purple-900/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-pink-400 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">Editar Parámetros del Clip</h3>
                </div>
                <button
                  onClick={() => setEditingClip(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-900/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Título del Gancho (Hook)</label>
                  <input
                    type="text"
                    value={editingClip.titulo_hook}
                    onChange={(e) => setEditingClip({ ...editingClip, titulo_hook: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#1a1a36] border border-purple-900/50 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Segundo de Inicio</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editingClip.inicio_seg}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setEditingClip({
                          ...editingClip,
                          inicio_seg: val,
                          duracion_seg: Math.round(editingClip.fin_seg - val),
                        });
                      }}
                      className="w-full px-3 py-2 bg-[#1a1a36] border border-purple-900/50 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Segundo de Fin</label>
                    <input
                      type="number"
                      step="0.1"
                      min={editingClip.inicio_seg + 1}
                      value={editingClip.fin_seg}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setEditingClip({
                          ...editingClip,
                          fin_seg: val,
                          duracion_seg: Math.round(val - editingClip.inicio_seg),
                        });
                      }}
                      className="w-full px-3 py-2 bg-[#1a1a36] border border-purple-900/50 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Call to Action (CTA)</label>
                  <input
                    type="text"
                    value={editingClip.cta || ''}
                    onChange={(e) => setEditingClip({ ...editingClip, cta: e.target.value })}
                    placeholder="Ej. ¡Sígueme para más trucos diarios!"
                    className="w-full px-3 py-2 bg-[#1a1a36] border border-purple-900/50 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Razón Viral</label>
                  <textarea
                    rows={2}
                    value={editingClip.razon}
                    onChange={(e) => setEditingClip({ ...editingClip, razon: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1a1a36] border border-purple-900/50 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-purple-900/40">
                <button
                  onClick={() => setEditingClip(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1a1a34] text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSaveClipEdit(editingClip)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-purple-600/30"
                >
                  Guardar Cambios
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProyectoPage;

