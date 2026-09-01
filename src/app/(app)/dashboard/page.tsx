import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Sparkles, 
  Film, 
  Search, 
  Filter, 
  Layers, 
  Zap, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  RefreshCw,
  Video,
  Youtube,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useYouTube } from '../../../context/YouTubeAuthContext';
import { TarjetaProyecto } from '../../../components/proyecto/TarjetaProyecto';
import { supabase } from '../../../lib/supabase/client';
import type { Proyecto } from '../../../lib/supabase/types';
import { toast } from 'sonner';

interface DashboardPageProps {
  onNavigate?: (path: string) => void;
}

// Sample fallback projects for rich demonstration if user has none or Supabase is in demo mode
const INITIAL_DEMO_PROJECTS: Proyecto[] = [
  {
    id: 'proj-1',
    user_id: 'demo-user',
    titulo: 'Estrategias de Crecimiento para Creadores 2026 - Masterclass Completa',
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    archivo_nombre: null,
    estado: 'clips_listos',
    duracion_seg: 1845,
    creado_en: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    actualizado_en: new Date().toISOString(),
  },
  {
    id: 'proj-2',
    user_id: 'demo-user',
    titulo: 'Podcast #42: Cómo monetizar contenido vertical con Alex y Sofia',
    url_youtube: null,
    archivo_nombre: 'podcast_episodio_42_audio_hq.mp4',
    estado: 'analizado',
    duracion_seg: 2710,
    creado_en: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    actualizado_en: new Date().toISOString(),
  },
];

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, profile, isSupabaseConfigured } = useAuth();
  const { isConnected, channel, connectYouTube, disconnectYouTube } = useYouTube();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('todos');

  const displayName = profile?.nombre || user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Creador';

  const loadProyectos = async () => {
    setLoading(true);
    if (isSupabaseConfigured && user) {
      try {
        const { data, error } = await supabase
          .from('proyectos')
          .select('*')
          .eq('user_id', user.id)
          .order('creado_en', { ascending: false });

        if (error) throw error;
        setProyectos(data || []);
      } catch (err: unknown) {
        console.warn('Error loading proyectos from Supabase:', err);
        // Fallback to local state if error
        const localSaved = localStorage.getItem(`clipforge_proyectos_${user.id}`);
        if (localSaved) {
          setProyectos(JSON.parse(localSaved));
        } else {
          setProyectos(INITIAL_DEMO_PROJECTS);
        }
      }
    } else {
      // Local/Demo mode
      const localSaved = localStorage.getItem('clipforge_local_proyectos');
      if (localSaved) {
        setProyectos(JSON.parse(localSaved));
      } else {
        setProyectos(INITIAL_DEMO_PROJECTS);
        localStorage.setItem('clipforge_local_proyectos', JSON.stringify(INITIAL_DEMO_PROJECTS));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProyectos();
  }, [user, isSupabaseConfigured]);

  const handleDeleteProyecto = async (id: string) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('proyectos').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.warn('Delete error in Supabase:', err);
      }
    }

    setProyectos((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem('clipforge_local_proyectos', JSON.stringify(updated));
      return updated;
    });

    toast.success('Proyecto eliminado correctamente');
  };

  const filteredProyectos = proyectos.filter((p) => {
    const matchesSearch = p.titulo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterEstado === 'todos' || p.estado === filterEstado;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a12] text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-purple-900/30">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
                Panel de Control
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400">{displayName}</span> 👋
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Gestiona tus videos, revisa momentos virales y genera nuevos clips en 9:16 con IA.
            </p>
          </div>

          {/* Big Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate?.('/dashboard/publicar')}
              className="inline-flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-[#141426] hover:bg-[#1f1f3a] border border-purple-900/40 text-slate-200 text-xs font-bold transition-all shadow-md cursor-pointer hover:border-purple-600/50"
            >
              <Calendar className="w-4 h-4 text-pink-400" />
              <span>Calendario de Publicaciones</span>
            </button>

            <button
              id="dashboard-refresh-btn"
              onClick={loadProyectos}
              title="Refrescar lista"
              className="p-3 rounded-2xl bg-[#141424] hover:bg-[#1d1d32] border border-purple-900/40 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            <button
              id="dashboard-create-clips-btn"
              onClick={() => onNavigate?.('/dashboard/nuevo')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xl shadow-purple-950/60 hover:shadow-purple-700/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-purple-400/40 cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>＋ Crear clips nuevos</span>
            </button>
          </div>
        </div>

        {/* YouTube Channel Integration Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#14101e] via-[#161224] to-[#121222] border border-red-900/30 shadow-xl shadow-black/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-md shadow-red-950">
              <Youtube className="w-6 h-6 fill-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Publicación Directa en YouTube Shorts</h3>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 text-[10px] font-bold border border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3" /> Canal Vinculado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold">
                    OAuth 2.0 Desconectado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isConnected
                  ? `Canal activo: "${channel?.channelTitle || 'Mi Canal'}" — Sube tus clips 9:16 con un solo clic en modo Público, No listado o Borrador.`
                  : 'Conecta tu cuenta de YouTube para publicar tus clips virales generados directamente desde el panel.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
            {isConnected ? (
              <>
                {channel?.channelThumbnail && (
                  <img
                    src={channel.channelThumbnail}
                    alt={channel.channelTitle}
                    className="w-8 h-8 rounded-full border border-red-500/60 object-cover"
                  />
                )}
                <button
                  id="dashboard-reconnect-yt-btn"
                  onClick={connectYouTube}
                  className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Cambiar canal
                </button>
                <button
                  id="dashboard-disconnect-yt-btn"
                  onClick={disconnectYouTube}
                  className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-900/50 text-xs font-semibold transition-all cursor-pointer"
                >
                  Desconectar
                </button>
              </>
            ) : (
              <button
                id="dashboard-connect-yt-btn"
                onClick={connectYouTube}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-lg shadow-red-950/60 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Youtube className="w-4 h-4 fill-white" />
                <span>Conectar YouTube</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#121222]/80 border border-purple-900/30 rounded-2xl p-5 shadow-lg shadow-black/40">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Proyectos</span>
              <Film className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-black text-white">{proyectos.length}</div>
            <p className="text-xs text-slate-400 mt-1">Videos largos procesados</p>
          </div>

          <div className="bg-[#121222]/80 border border-purple-900/30 rounded-2xl p-5 shadow-lg shadow-black/40">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Clips Generados</span>
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-white">
              {proyectos.length > 0 ? proyectos.length * 6 : 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Optimizados para TikTok, Reels y Shorts</p>
          </div>

          <div className="bg-[#121222]/80 border border-purple-900/30 rounded-2xl p-5 shadow-lg shadow-black/40">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Viral Score Promedio</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white">
              {proyectos.length > 0 ? '94.8' : '--'}
            </div>
            <p className="text-xs text-slate-400 mt-1">Potencial viral según IA</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por título..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#121222] border border-purple-900/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" /> Estado:
            </span>
            {['todos', 'clips_listos', 'analizado', 'nuevo'].map((estado) => (
              <button
                key={estado}
                onClick={() => setFilterEstado(estado)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filterEstado === estado
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-[#141424] text-slate-400 hover:text-white border border-purple-900/30'
                }`}
              >
                {estado === 'todos' ? 'Todos' : estado.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Projects Grid or Empty State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-sm font-medium">Cargando tus proyectos...</p>
          </div>
        ) : filteredProyectos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProyectos.map((proyecto) => (
              <TarjetaProyecto
                key={proyecto.id}
                proyecto={proyecto}
                clipsCount={proyecto.estado === 'clips_listos' ? 6 : proyecto.estado === 'analizado' ? 4 : 0}
                onSelect={(proj) => {
                  toast.info(`Abriendo visualizador de clips para: ${proj.titulo}`);
                  onNavigate?.('/dashboard/nuevo');
                }}
                onDelete={handleDeleteProyecto}
              />
            ))}
          </div>
        ) : (
          /* Empty State with elegant SVG Illustration */
          <div 
            id="empty-state-container"
            className="bg-[#10101f] border border-dashed border-purple-900/50 rounded-3xl p-12 text-center max-w-2xl mx-auto shadow-2xl shadow-black/50"
          >
            {/* Custom SVG Illustration */}
            <div className="w-28 h-28 mx-auto mb-6 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 via-indigo-600/20 to-cyan-500/30 rounded-3xl blur-xl animate-pulse" />
              <svg 
                className="w-24 h-24 relative z-10 drop-shadow-lg text-purple-400"
                viewBox="0 0 100 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Background slate card */}
                <rect x="20" y="16" width="60" height="68" rx="12" fill="#18182d" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" />
                {/* 9:16 mobile clip overlay */}
                <rect x="34" y="24" width="32" height="52" rx="6" fill="#0f0f1d" stroke="#a855f7" strokeWidth="2.5" />
                {/* Video play icon in clip */}
                <circle cx="50" cy="50" r="9" fill="#7c3aed" />
                <polygon points="48,46 54,50 48,54" fill="#ffffff" />
                {/* Sparkles on corner */}
                <path d="M72 26L74 20L80 22L75 26L79 31L73 29L71 35L69 29L63 31L67 26L62 22L68 20L72 26Z" fill="#22d3ee" />
                {/* Captions wave */}
                <rect x="40" y="65" width="20" height="3" rx="1.5" fill="#22d3ee" />
                <rect x="43" y="70" width="14" height="2.5" rx="1.25" fill="#c084fc" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              No tienes proyectos aún
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Pega una URL de YouTube o sube un video largo para que la inteligencia artificial extraiga los momentos con mayor probabilidad de hacerse virales.
            </p>

            <button
              id="empty-create-btn"
              onClick={() => onNavigate?.('/dashboard/nuevo')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/50 hover:scale-105 transition-all cursor-pointer border border-purple-400/30"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Crear mi primer proyecto</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default DashboardPage;
