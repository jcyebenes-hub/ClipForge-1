import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Youtube,
  Upload,
  Sparkles,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ExternalLink,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  FileText,
  Download,
  Flame,
  ChevronRight,
  Eye,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../../context/AuthContext';
import { useYouTube } from '../../../../context/YouTubeAuthContext';
import { YouTubeUploadModal } from '../../../../components/youtube/YouTubeUploadModal';
import { ExportTikTokModal } from '../../../../components/publicar/ExportTikTokModal';
import { supabase } from '../../../../lib/supabase/client';

export interface PublicacionItem {
  id: string;
  clip_id: string;
  user_id?: string;
  plataforma: 'youtube' | 'tiktok' | 'instagram';
  titulo: string;
  descripcion?: string;
  hashtags?: string[];
  video_url?: string;
  duracion_seg?: number;
  fecha_programada?: string;
  estado: 'programado' | 'publicado' | 'error' | 'borrador_manual';
  error_mensaje?: string;
  url_publicacion?: string;
  created_at: string;
}

export interface PublicarPageProps {
  onNavigate?: (path: string) => void;
}

export default function PublicarPage({ onNavigate }: PublicarPageProps) {
  const { user, isSupabaseConfigured } = useAuth();
  const { isConnected: isYtConnected, channel: ytChannel, connectYouTube } = useYouTube();

  const [publicaciones, setPublicaciones] = useState<PublicacionItem[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedClipForUpload, setSelectedClipForUpload] = useState<any>(null);
  const [selectedClipForTikTokExport, setSelectedClipForTikTokExport] = useState<any>(null);

  // New publication form state
  const [newTitle, setNewTitle] = useState('');
  const [newPlatform, setNewPlatform] = useState<'youtube' | 'tiktok' | 'instagram'>('youtube');
  const [newDateTime, setNewDateTime] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('#Shorts #Viral #ClipForge');
  const [newVideoUrl, setNewVideoUrl] = useState('');

  // Load schedule list
  const fetchPublicaciones = async () => {
    setLoading(true);
    try {
      let items: PublicacionItem[] = [];

      // 1. Fetch from Supabase if active
      if (isSupabaseConfigured && user) {
        try {
          const { data, error } = await (supabase.from('publicaciones' as any) as any)
            .select('*')
            .eq('user_id', user.id)
            .order('fecha_programada', { ascending: true });

          if (!error && data) {
            items = data;
          }
        } catch (e) {
          console.warn('Supabase fetch publicaciones error:', e);
        }
      }

      // 2. Fetch local storage scheduled posts and drafts
      const localScheduled = JSON.parse(localStorage.getItem('clipforge_scheduled_posts') || '[]');
      const localDrafts = JSON.parse(localStorage.getItem('clipforge_pending_drafts') || '[]');

      // Merge avoiding duplicate IDs
      const combined = [...items];
      [...localScheduled, ...localDrafts].forEach((locItem) => {
        if (!combined.some((c) => c.id === locItem.id)) {
          combined.push(locItem);
        }
      });

      // Default mock if totally empty to showcase the feature
      if (combined.length === 0) {
        combined.push(
          {
            id: 'mock-pub-1',
            clip_id: 'c1',
            plataforma: 'youtube',
            titulo: 'El Secreto de la Retención en Vídeos Cortos #Shorts',
            descripcion: 'Aplica este gancho de 3 segundos para duplicar tus visitas.',
            hashtags: ['#Shorts', '#Viral', '#Tips'],
            video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            duracion_seg: 28,
            fecha_programada: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
            estado: 'programado',
            created_at: new Date().toISOString(),
          },
          {
            id: 'mock-pub-2',
            clip_id: 'c2',
            plataforma: 'tiktok',
            titulo: '3 Hacks de Edición en 2026',
            descripcion: 'Plantillas y subtítulos que convierten.',
            hashtags: ['#TikTokViral', '#Edicion', '#ClipForge'],
            video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            duracion_seg: 35,
            fecha_programada: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
            estado: 'publicado',
            url_publicacion: 'https://www.tiktok.com/@clipforge_ai',
            created_at: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
          },
          {
            id: 'mock-pub-3',
            clip_id: 'c3',
            plataforma: 'instagram',
            titulo: 'Cómo crecer de 0 a 100k seguidores',
            descripcion: 'Reel explicativo paso a paso.',
            hashtags: ['#ReelsInstagram', '#Creator', '#Viral'],
            video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
            duracion_seg: 42,
            fecha_programada: new Date(Date.now() + 3600 * 1000 * 48).toISOString(),
            estado: 'programado',
            created_at: new Date().toISOString(),
          }
        );
      }

      setPublicaciones(combined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicaciones();
  }, [user, isSupabaseConfigured]);

  // Handle scheduling a new post
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDateTime) {
      toast.error('Indica un título y una fecha/hora programada');
      return;
    }

    const newPost: PublicacionItem = {
      id: `pub-${Date.now()}`,
      clip_id: `clip-custom-${Date.now()}`,
      user_id: user?.id || 'demo-user',
      plataforma: newPlatform,
      titulo: newTitle,
      descripcion: newDescription,
      hashtags: newTags.split(' ').filter(Boolean),
      video_url: newVideoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      duracion_seg: 30,
      fecha_programada: new Date(newDateTime).toISOString(),
      estado: 'programado',
      created_at: new Date().toISOString(),
    };

    // Save to Supabase or local storage
    if (isSupabaseConfigured && user) {
      try {
        await (supabase.from('publicaciones' as any) as any).insert([newPost]);
      } catch (err) {
        console.warn('Error saving publication to Supabase:', err);
      }
    }

    const localExisting = JSON.parse(localStorage.getItem('clipforge_scheduled_posts') || '[]');
    localStorage.setItem('clipforge_scheduled_posts', JSON.stringify([newPost, ...localExisting]));

    setPublicaciones([newPost, ...publicaciones]);
    setScheduleModalOpen(false);
    toast.success(`Publicación programada para ${new Date(newDateTime).toLocaleString('es-ES')}`);

    // Reset form
    setNewTitle('');
    setNewDateTime('');
    setNewDescription('');
  };

  // Trigger manual publish now
  const handlePublishNow = async (item: PublicacionItem) => {
    if (item.plataforma === 'youtube') {
      setSelectedClipForUpload({
        id: item.clip_id,
        titulo_hook: item.titulo,
        descripcion: item.descripcion,
        hashtags: item.hashtags,
        video_short_url: item.video_url,
        duracion_seg: item.duracion_seg || 30,
      });
    } else if (item.plataforma === 'tiktok') {
      setSelectedClipForTikTokExport({
        id: item.clip_id,
        titulo_hook: item.titulo,
        descripcion: item.descripcion,
        hashtags: item.hashtags,
        video_short_url: item.video_url,
        duracion_seg: item.duracion_seg || 30,
      });
    } else {
      // Instagram
      toast.info('Iniciando subida a Instagram Reels...');
      try {
        const res = await fetch('/api/instagram/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user?.id,
            clip_id: item.clip_id,
            video_url: item.video_url,
            caption: item.titulo,
            hashtags: item.hashtags,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('¡Reel procesado con éxito en Instagram!');
          fetchPublicaciones();
        } else {
          toast.error(data.error || 'Error al conectar con Instagram');
        }
      } catch (e: any) {
        toast.error(`Error: ${e.message}`);
      }
    }
  };

  // Delete an item
  const handleDeletePost = (id: string) => {
    const updated = publicaciones.filter((p) => p.id !== id);
    setPublicaciones(updated);
    const local = JSON.parse(localStorage.getItem('clipforge_scheduled_posts') || '[]');
    localStorage.setItem(
      'clipforge_scheduled_posts',
      JSON.stringify(local.filter((p: any) => p.id !== id))
    );
    toast.info('Publicación eliminada del calendario');
  };

  // Filtered list
  const filteredPosts = publicaciones.filter((p) => {
    if (filterPlatform !== 'all' && p.plataforma !== filterPlatform) return false;
    if (filterStatus !== 'all' && p.estado !== filterStatus) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#090910] text-slate-100 p-6 md:p-10 space-y-8">
      
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/30 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
            <CalendarIcon className="w-4 h-4" />
            <span>Centro de Distribución Multicanal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Calendario de Publicaciones & Distribución
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Programa, automatiza y distribuye tus Shorts virales en YouTube, TikTok e Instagram Reels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPublicaciones}
            className="p-2.5 rounded-xl bg-[#141426] hover:bg-[#1f1f3a] border border-purple-900/40 text-slate-300 transition-colors cursor-pointer"
            title="Recargar publicaciones"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="open-schedule-modal-btn"
            onClick={() => setScheduleModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-950/60 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Programar Publicación</span>
          </button>
        </div>
      </div>

      {/* Connected Accounts Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* YouTube */}
        <div className="p-4 rounded-2xl bg-[#121224] border border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
              <Youtube className="w-5 h-5 fill-red-500" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">YouTube Shorts</span>
              <span className="text-[11px] text-slate-400">
                {isYtConnected ? ytChannel?.channelTitle || 'Canal Conectado' : 'OAuth Desconectado'}
              </span>
            </div>
          </div>
          {isYtConnected ? (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold">
              API Lista
            </span>
          ) : (
            <button
              onClick={connectYouTube}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Conectar
            </button>
          )}
        </div>

        {/* TikTok */}
        <div className="p-4 rounded-2xl bg-[#121224] border border-cyan-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black">
              ♪
            </div>
            <div>
              <span className="text-xs font-bold text-white block">TikTok</span>
              <span className="text-[11px] text-slate-400">Content Posting API & Export</span>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedClipForTikTokExport({
                id: 'custom-export',
                titulo_hook: 'Mi nuevo Short viral',
                descripcion: 'Edición rápida generada con IA.',
                hashtags: ['#fyp', '#viral', '#edicion'],
                duracion_seg: 30,
              });
            }}
            className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-xs font-bold transition-colors cursor-pointer"
          >
            Exportar 1-Clic
          </button>
        </div>

        {/* Instagram */}
        <div className="p-4 rounded-2xl bg-[#121224] border border-pink-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Instagram Reels</span>
              <span className="text-[11px] text-slate-400">Meta Graph API Container</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-purple-950/80 text-purple-300 border border-purple-800/40 text-[10px] font-bold">
            Reels Activo
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#10101f] border border-purple-900/30">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-slate-300">Filtrar por:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Platform filter */}
          <div className="flex items-center rounded-xl bg-[#16162a] p-1 border border-slate-800">
            {['all', 'youtube', 'tiktok', 'instagram'].map((plat) => (
              <button
                key={plat}
                onClick={() => setFilterPlatform(plat)}
                className={`px-3 py-1 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
                  filterPlatform === plat
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {plat === 'all' ? 'Todas' : plat}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center rounded-xl bg-[#16162a] p-1 border border-slate-800">
            {['all', 'programado', 'publicado', 'error', 'borrador_manual'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
                  filterStatus === st
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'all'
                  ? 'Todos los estados'
                  : st === 'borrador_manual'
                  ? 'Borradores'
                  : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Publications Table */}
      <div className="rounded-2xl border border-purple-900/30 bg-[#101020] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#151428] text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-purple-900/30">
              <tr>
                <th className="py-3.5 px-4">Clip / Título</th>
                <th className="py-3.5 px-4">Plataforma</th>
                <th className="py-3.5 px-4">Fecha Programada</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/40 font-medium">
              {filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Clock3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold">No se encontraron publicaciones con estos filtros.</p>
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => {
                  const isPast = post.fecha_programada && new Date(post.fecha_programada).getTime() < Date.now();
                  
                  return (
                    <tr key={post.id} className="hover:bg-[#16152e] transition-colors">
                      {/* Title & Info */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span className="font-bold text-white block max-w-sm md:max-w-md truncate">
                            {post.titulo}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {(post.hashtags || []).slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] font-mono text-purple-400">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Platform */}
                      <td className="py-4 px-4">
                        {post.plataforma === 'youtube' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/80 text-red-300 border border-red-900/50 font-bold text-[11px]">
                            <Youtube className="w-3.5 h-3.5 fill-red-400" />
                            YouTube Shorts
                          </span>
                        )}
                        {post.plataforma === 'tiktok' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-900/50 font-bold text-[11px]">
                            <span className="font-black">♪</span>
                            TikTok
                          </span>
                        )}
                        {post.plataforma === 'instagram' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-950/80 text-pink-300 border border-pink-900/50 font-bold text-[11px]">
                            <Share2 className="w-3.5 h-3.5 text-pink-400" />
                            IG Reels
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4">
                        {post.fecha_programada ? (
                          <div className="flex items-center gap-2">
                            <Clock className={`w-3.5 h-3.5 ${isPast && post.estado === 'programado' ? 'text-amber-400' : 'text-slate-400'}`} />
                            <span className="font-mono text-slate-200">
                              {new Date(post.fecha_programada).toLocaleString('es-ES', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {post.estado === 'programado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40 text-[10px] font-bold">
                            <Clock3 className="w-3 h-3" />
                            Programado
                          </span>
                        )}
                        {post.estado === 'publicado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Publicado
                          </span>
                        )}
                        {post.estado === 'error' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-950/60 text-red-300 border border-red-800/40 text-[10px] font-bold" title={post.error_mensaje}>
                            <AlertCircle className="w-3 h-3" />
                            Error
                          </span>
                        )}
                        {post.estado === 'borrador_manual' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                            <FileText className="w-3 h-3" />
                            Borrador
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {post.url_publicacion && (
                            <a
                              href={post.url_publicacion}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                              title="Ver en plataforma"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {post.estado !== 'publicado' && (
                            <button
                              onClick={() => handlePublishNow(post)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>Publicar ya</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Post Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#101020] border border-purple-900/40 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-purple-900/30 flex items-center justify-between">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Programar Publicación Automática</span>
              </h2>
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  Plataforma de destino
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPlatform('youtube')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      newPlatform === 'youtube'
                        ? 'bg-red-950/80 border-red-500 text-red-300'
                        : 'bg-[#141426] border-slate-800 text-slate-400'
                    }`}
                  >
                    <Youtube className="w-4 h-4 fill-current" />
                    <span>YouTube</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlatform('tiktok')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      newPlatform === 'tiktok'
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                        : 'bg-[#141426] border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>♪ TikTok</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlatform('instagram')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      newPlatform === 'instagram'
                        ? 'bg-pink-950/80 border-pink-500 text-pink-300'
                        : 'bg-[#141426] border-slate-800 text-slate-400'
                    }`}
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Instagram</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  Título / Gancho
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 3 Consejos que cambiarán tu edición"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#141426] border border-purple-900/40 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  Fecha y Hora programada
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#141426] border border-purple-900/40 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  Descripción y Hashtags
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  placeholder="Detalles adicionales del vídeo..."
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#141426] border border-purple-900/40 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950"
                >
                  Confirmar Programación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* YouTube Direct Upload Modal */}
      {selectedClipForUpload && (
        <YouTubeUploadModal
          isOpen={!!selectedClipForUpload}
          clip={selectedClipForUpload}
          onClose={() => setSelectedClipForUpload(null)}
          onSuccess={() => {
            fetchPublicaciones();
            setSelectedClipForUpload(null);
          }}
        />
      )}

      {/* TikTok Manual Export Modal */}
      {selectedClipForTikTokExport && (
        <ExportTikTokModal
          isOpen={!!selectedClipForTikTokExport}
          clip={selectedClipForTikTokExport}
          onClose={() => setSelectedClipForTikTokExport(null)}
          onSavedToDrafts={() => {
            fetchPublicaciones();
            setSelectedClipForTikTokExport(null);
          }}
        />
      )}

    </div>
  );
}
