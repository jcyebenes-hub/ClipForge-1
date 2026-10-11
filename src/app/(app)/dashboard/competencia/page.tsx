import React, { useState } from 'react';
import { Radar, Loader2, AlertTriangle, Search, Copy, Check, TrendingUp, Clock, CalendarClock } from 'lucide-react';
import type { InformeAnalisis } from '../../../../lib/analisisYoutube';

interface Props {
  onNavigate?: (path: string) => void;
}

const CompetenciaPage: React.FC<Props> = () => {
  const [canales, setCanales] = useState('');
  const [dias, setDias] = useState(90);
  const [soloShorts, setSoloShorts] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [informe, setInforme] = useState<InformeAnalisis | null>(null);
  const [analizados, setAnalizados] = useState(0);
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(texto.slice(0, 20));
      setTimeout(() => setCopiado(null), 1500);
    });
  };

  const analizar = async () => {
    const lista = canales.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!lista.length) {
      setError('Escribe al menos un canal (@usuario o URL de YouTube).');
      return;
    }
    setCargando(true);
    setError(null);
    setInforme(null);
    try {
      const res = await fetch('/api/competencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canales: lista, dias, soloShorts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      setInforme(data.informe);
      setAnalizados(data.analizados ?? 0);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a12] text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <Radar className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Análisis de competencia</h1>
            <p className="text-sm text-slate-400">
              Estudia qué les funciona a los mejores de tu nicho (últimos {dias} días) y copia su fórmula en tus Shorts.
            </p>
          </div>
        </div>

        {/* Formulario */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Canales a analizar</span>
            <textarea
              value={canales}
              onChange={(e) => setCanales(e.target.value)}
              rows={3}
              placeholder={'@canal1\n@canal2\nhttps://youtube.com/@otrocanal'}
              className="mt-1.5 w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
            />
            <span className="text-[11px] text-slate-500">Uno por línea (o separados por comas). Máximo 5.</span>
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Periodo</span>
              <select
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                className="mt-1.5 rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value={30}>Últimos 30 días</option>
                <option value={60}>Últimos 60 días</option>
                <option value={90}>Últimos 90 días</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloShorts}
                onChange={(e) => setSoloShorts(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
              <span className="text-sm text-slate-200">Solo Shorts <span className="text-slate-500">(≤3 min)</span></span>
            </label>

            <button
              onClick={analizar}
              disabled={cargando}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {cargando ? 'Analizando…' : 'Analizar canales'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Informe */}
        {informe && (
          <div className="space-y-6">
            {/* Métricas clave */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={<Clock className="w-4 h-4 text-cyan-400" />} label="Duración top" value={`${informe.duracionMediaTop}s`} sub={`resto: ${informe.duracionMediaResto}s`} />
              <Stat icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Vistas media top" value={informe.vistasMediaTop.toLocaleString('es-ES')} sub={`resto: ${informe.vistasMediaResto.toLocaleString('es-ES')}`} />
              <Stat icon={<CalendarClock className="w-4 h-4 text-pink-400" />} label="Publicaciones/sem" value={String(informe.publicacionesPorSemana)} sub={`en ${informe.periodoDias} días`} />
              <Stat icon={<Radar className="w-4 h-4 text-purple-400" />} label="Vídeos analizados" value={String(analizados)} sub={informe.canales.join(', ').slice(0, 24)} />
            </div>

            {/* Sugerencias */}
            {informe.sugerencias.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <h2 className="text-sm font-bold text-emerald-300 mb-3">Qué hacer con esto</h2>
                <ul className="space-y-2.5">
                  {informe.sugerencias.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-slate-200">
                      <span className="text-emerald-400 mt-0.5">▸</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Palabras de título */}
            {informe.palabrasTitulo.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <h2 className="text-sm font-bold text-slate-200 mb-3">Palabras en los títulos ganadores</h2>
                <div className="flex flex-wrap gap-2">
                  {informe.palabrasTitulo.map((p) => (
                    <button
                      key={p.palabra}
                      onClick={() => copiar(p.palabra)}
                      title={`${p.enTop} de los top · ${p.veces} en total`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-emerald-500/50 transition"
                    >
                      {copiado === p.palabra ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      {p.palabra}
                      <span className="text-emerald-400/80 font-semibold">{p.enTop}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top vídeos */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <h2 className="text-sm font-bold text-slate-200 mb-3">Los que más rinden (por vistas/día)</h2>
              <div className="space-y-2">
                {informe.destacados.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <a
                        href={`https://youtube.com/watch?v=${v.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-100 hover:text-emerald-300 line-clamp-2"
                      >
                        {v.titulo}
                      </a>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {v.vistas.toLocaleString('es-ES')} vistas · {v.vistasPorDia.toLocaleString('es-ES')}/día · {v.duracionSeg}s{v.canal ? ` · ${v.canal}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => copiar(v.titulo)}
                      className="flex-shrink-0 rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/50 transition"
                      title="Copiar título"
                    >
                      {copiado === v.titulo.slice(0, 20) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({ icon, label, value, sub }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {icon}
      {label}
    </div>
    <div className="mt-1 text-xl font-black text-white">{value}</div>
    {sub && <div className="text-[11px] text-slate-500 truncate">{sub}</div>}
  </div>
);

export default CompetenciaPage;
