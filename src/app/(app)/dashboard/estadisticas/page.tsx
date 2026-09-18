import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  Eye, 
  MousePointerClick, 
  FolderPlus, 
  Download, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw,
  Zap,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { getAnalyticsSummary, type MetricasResumen, type EventoData } from '../../../../lib/analytics';
import { toast } from 'sonner';

interface EstadisticasPageProps {
  onNavigate?: (path: string) => void;
}

export const EstadisticasPage: React.FC<EstadisticasPageProps> = ({ onNavigate }) => {
  const [data, setData] = useState<MetricasResumen | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadMetrics = async () => {
    setIsRefreshing(true);
    try {
      const metrics = await getAnalyticsSummary();
      setData(metrics);
    } catch (err: any) {
      toast.error('Error al cargar métricas de analítica');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
          <span>Cargando analítica interna...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0a0a12] text-slate-100 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-purple-900/30">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/70 border border-purple-800/50 text-xs font-semibold text-purple-300 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Panel Privado de Administrador</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Estadísticas & Rendimiento
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Métricas clave de uso, embudo de conversión y actividad en tiempo real de ClipForge.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-stats"
            onClick={loadMetrics}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#141424] hover:bg-[#1f1f38] border border-purple-900/40 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 my-6">
        {/* 1. Visitas Landing */}
        <div className="p-4 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Visitas Landing</span>
            <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-['Plus_Jakarta_Sans',sans-serif]">{data.totalVisitas}</p>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400 font-semibold">
            <TrendingUp className="w-3 h-3" />
            <span>{data.actividadPorDia.reduce((a, d) => a + d.visitas, 0)} esta semana (real)</span>
          </div>
        </div>

        {/* 2. Clicks Empezar Gratis */}
        <div className="p-4 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Clicks "Empezar"</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-['Plus_Jakarta_Sans',sans-serif]">{data.totalClicksEmpezar}</p>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-cyan-300 font-semibold">
            <span>CTR: {data.tasaConversionCTR}%</span>
          </div>
        </div>

        {/* 3. Proyectos Creados */}
        <div className="p-4 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Proyectos Creados</span>
            <div className="w-8 h-8 rounded-lg bg-pink-950/60 border border-pink-800/50 flex items-center justify-center text-pink-400">
              <FolderPlus className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-['Plus_Jakarta_Sans',sans-serif]">{data.totalProyectos}</p>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-pink-400 font-semibold">
            <span>Vídeos subidos e importados</span>
          </div>
        </div>

        {/* 4. Clips Exportados */}
        <div className="p-4 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Clips Exportados</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <Download className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-['Plus_Jakarta_Sans',sans-serif]">{data.totalClipsExportados}</p>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-400 font-semibold">
            <span>Tasa de finalización: {data.tasaExportacion}%</span>
          </div>
        </div>

        {/* 5. Errores */}
        <div className="p-4 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Tasa de Error</span>
            <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-['Plus_Jakarta_Sans',sans-serif]">{data.totalErrores}</p>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400 font-semibold">
            <span>{data.totalErrores === 0 ? '0.0% - Todo óptimo' : 'Bajo control'}</span>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-6">
        {/* Gráfica 1: Actividad en el Tiempo (Área) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>Actividad Diaria (Últimos 7 días)</span>
              </h2>
              <p className="text-xs text-slate-400">Visitas a landing vs proyectos creados y clips exportados.</p>
            </div>
          </div>

          <div className="h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.actividadPorDia} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVisitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorProyectos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorExportaciones" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#242438" />
                <XAxis dataKey="fecha" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131322', borderColor: '#4c1d95', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="visitas" name="Visitas" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitas)" />
                <Area type="monotone" dataKey="proyectos" name="Proyectos" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorProyectos)" />
                <Area type="monotone" dataKey="exportaciones" name="Exportaciones" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorExportaciones)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica 2: Distribución de Eventos (Pie / Donut) */}
        <div className="p-5 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Distribución de Interacciones</span>
            </h2>
            <p className="text-xs text-slate-400">Porcentaje por categoría de acción.</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.distribucionEventos}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.distribucionEventos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131322', borderColor: '#4c1d95', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
            {data.distribucionEventos.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-300 truncate">{item.name}: <strong className="text-white">{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Embudo de Conversión & Últimos Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
        {/* Embudo */}
        <div className="p-5 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-xl">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Embudo de Conversión de Creadores</span>
          </h2>

          <div className="space-y-4">
            {/* Paso 1: Visita */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>1. Visita Landing Page</span>
                <span>{data.totalVisitas} usuarios (100%)</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full w-full"></div>
              </div>
            </div>

            {/* Paso 2: Click Empezar */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>2. Intención / Click "Empezar gratis"</span>
                <span>{data.totalClicksEmpezar} usuarios ({data.tasaConversionCTR}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(data.tasaConversionCTR, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Paso 3: Proyecto Creado */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>3. Proyecto Creado (Vídeo cargado)</span>
                <span>{data.totalProyectos} proyectos ({data.totalVisitas > 0 ? Math.round((data.totalProyectos / data.totalVisitas) * 100) : 0}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(Math.round((data.totalProyectos / (data.totalVisitas || 1)) * 100), 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Paso 4: Clip Exportado */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>4. Clip Renderizado y Descargado</span>
                <span>{data.totalClipsExportados} clips ({data.tasaExportacion}% de proyectos)</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(data.tasaExportacion, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Registro de Últimos Eventos */}
        <div className="p-5 rounded-2xl bg-[#121222] border border-purple-900/30 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Registro de Eventos Recientes</span>
            </h2>
            <p className="text-xs text-slate-400 mb-3">Actividad anónima de navegación y acciones.</p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {data.ultimosEventos.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No hay eventos registrados todavía.</p>
            ) : (
              data.ultimosEventos.map((ev, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[#18182c] border border-purple-950 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      ev.tipo === 'clip_exportado' ? 'bg-emerald-400' :
                      ev.tipo === 'proyecto_creado' ? 'bg-pink-400' :
                      ev.tipo === 'click_empezar_gratis' ? 'bg-cyan-400' :
                      ev.tipo === 'error_sistema' ? 'bg-red-400' : 'bg-purple-400'
                    }`} />
                    <span className="font-semibold text-slate-200">{ev.tipo}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstadisticasPage;
