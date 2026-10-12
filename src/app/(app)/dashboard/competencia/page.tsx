import React, { useState } from 'react';
import { Radar, Loader2, AlertTriangle, Search, Copy, Check, TrendingUp, Clock, CalendarClock, Flame, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { guardarReceta } from '../../../../lib/receta';
import { grado, type NombreMetrica } from '../../../../lib/analisisYoutube';

const gradoLabel = (m: NombreMetrica, v: number | null) => grado(m, v);
import type { InformeAnalisis, VideoInforme } from '../../../../lib/analisisYoutube';

/** Color por nivel de la clasificación viewtrap. */
const colorGrado = (g: string) =>
  g === 'Excelente' ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
  : g === 'Bueno' ? 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10'
  : g === 'Normal' ? 'text-slate-300 border-slate-600/50 bg-slate-500/10'
  : g === 'Regular' ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
  : g === 'Malo' ? 'text-rose-300 border-rose-500/40 bg-rose-500/10'
  : 'text-slate-500 border-slate-700 bg-slate-800/40';

interface Props {
  onNavigate?: (path: string) => void;
}

const CompetenciaPage: React.FC<Props> = ({ onNavigate }) => {
  const [modo, setModo] = useState<'canales' | 'clave'>('clave');
  const [canales, setCanales] = useState('');
  const [palabraClave, setPalabraClave] = useState('');
  const [dias, setDias] = useState(90);
  const [soloShorts, setSoloShorts] = useState(true);
  const [orden, setOrden] = useState<'contribucion' | 'rendimiento'>('contribucion');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [informe, setInforme] = useState<InformeAnalisis | null>(null);

  /**
   * Lleva la receta del Short ganador al flujo de creación: enlace, duración
   * objetivo, palabras ganadoras y ritmo. Viaja por localStorage porque entre
   * medias puede haber un registro o un inicio de sesión.
   */
  const usarReceta = (v: VideoInforme) => {
    const guardada = guardarReceta({
      videoId: v.id,
      titulo: v.titulo,
      canal: v.canal,
      duracionSeg: v.duracionSeg,
      duracionObjetivo: informe?.duracionMediaTop ?? v.duracionSeg,
      palabras: (informe?.palabrasTitulo ?? []).map((x) => x.palabra),
      creado: new Date().toISOString(),
    });
    if (!guardada) {
      toast.error('No se ha podido guardar la receta en este navegador.');
      return;
    }
    toast.success('Receta lista: duración, ritmo y palabras ya puestas.');
    if (onNavigate) onNavigate('/dashboard/nuevo');
  };
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
    if (modo === 'canales' && !lista.length) {
      setError('Escribe al menos un canal (@usuario o URL de YouTube).');
      return;
    }
    if (modo === 'clave' && !palabraClave.trim()) {
      setError('Escribe una palabra clave (p. ej. «minecraft», «recetas fáciles»).');
      return;
    }
    setCargando(true);
    setError(null);
    setInforme(null);
    try {
      const res = await fetch(modo === 'clave' ? '/api/tendencias' : '/api/competencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          modo === 'clave'
            ? { palabraClave: palabraClave.trim(), dias, orden }
            : { canales: lista, dias, soloShorts, orden }
        ),
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
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Vídeos virales de tu nicho</h1>
            <p className="text-sm text-slate-400">
              Estudia qué les funciona a los mejores de tu nicho (últimos {dias} días) y copia su fórmula en tus Shorts.
            </p>
          </div>
        </div>

        {/* Formulario */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
          <div className="flex gap-1 rounded-xl bg-slate-900/70 border border-slate-700 p-1 w-fit">
            {([
              ['clave', 'Descubrir por tema'],
              ['canales', 'Canales concretos'],
            ] as const).map(([valor, etiqueta]) => (
              <button
                key={valor}
                onClick={() => setModo(valor)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  modo === valor ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {modo === 'clave' ? (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tema a explorar</span>
              <input
                value={palabraClave}
                onChange={(e) => setPalabraClave(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analizar()}
                placeholder="minecraft, recetas fáciles, finanzas personales…"
                className="mt-1.5 w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <span className="text-[11px] text-slate-500">
                Busca los Shorts más vistos de ese tema (España, español). Cuesta 100 unidades de cuota: ~100 búsquedas/día.
              </span>
            </label>
          ) : (
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
          )}

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
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Criterio</span>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as 'contribucion' | 'rendimiento')}
                className="mt-1.5 rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="contribucion">Vs. media del canal</option>
                <option value="rendimiento">Vs. suscriptores</option>
              </select>
            </label>

            {modo === 'canales' && (
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloShorts}
                onChange={(e) => setSoloShorts(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
              <span className="text-sm text-slate-200">Solo Shorts <span className="text-slate-500">(≤3 min)</span></span>
            </label>
            )}

            <button
              onClick={analizar}
              disabled={cargando}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {cargando ? 'Analizando…' : modo === 'clave' ? 'Descubrir tendencias' : 'Analizar canales'}
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
              <Stat
                icon={<Radar className="w-4 h-4 text-purple-400" />}
                label="Outliers (perf ≥10)"
                value={informe.ratioExcelentes === null ? '—' : `${informe.ratioExcelentes}%`}
                sub={`${analizados} Shorts · ${informe.canales.map((c) => c.nombre).join(', ').slice(0, 22)}`}
              />
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

            {/* Canales calientes: menos de 1 año, por crecimiento */}
            {informe.canalesJovenes.length > 0 && (
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5 overflow-x-auto">
                <h2 className="text-sm font-bold text-orange-300 mb-1 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" /> Canales que suben (menos de 1 año)
                </h2>
                <p className="text-[11px] text-slate-400 mb-3">
                  Estos crecen por formato, no por inercia: son tus mejores referencias.
                </p>
                <div className="space-y-1.5">
                  {informe.canalesJovenes.slice(0, 8).map((c) => (
                    <a
                      key={c.id}
                      href={`https://youtube.com/channel/${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs hover:border-orange-500/40 transition"
                    >
                      <span className="font-semibold text-slate-100">{c.nombre}</span>
                      <span className="text-slate-400">{c.subs.toLocaleString('es-ES')} subs</span>
                      <span className="rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 font-semibold text-orange-200">
                        +{c.subPorDia?.toLocaleString('es-ES')}/día
                      </span>
                      <span className="text-slate-500">{c.diasCanal} días de vida</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Canales: crecimiento */}
            {informe.canales.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 overflow-x-auto">
                <h2 className="text-sm font-bold text-slate-200 mb-3">Canales: tamaño y crecimiento</h2>
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="pb-2 pr-3 font-semibold">Canal</th>
                      <th className="pb-2 pr-3 font-semibold">Subs</th>
                      <th className="pb-2 pr-3 font-semibold">Subs/día</th>
                      <th className="pb-2 pr-3 font-semibold">Vistas media</th>
                      <th className="pb-2 font-semibold">Rendim. vídeo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {informe.canales.map((c) => (
                      <tr key={c.id} className="border-t border-slate-800/70">
                        <td className="py-2 pr-3 font-medium text-slate-200">{c.nombre}</td>
                        <td className="py-2 pr-3 text-slate-300">{c.subs.toLocaleString('es-ES')}</td>
                        <td className="py-2 pr-3">
                          <span className="text-slate-200">{(c.subPorDia ?? 0).toLocaleString('es-ES')}</span>
                          <span className={`ml-1.5 rounded border px-1 py-0.5 text-[10px] ${colorGrado(gradoLabel('subPorDia', c.subPorDia))}`}>
                            {gradoLabel('subPorDia', c.subPorDia)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{c.vistasMedia.toLocaleString('es-ES')}</td>
                        <td className="py-2">
                          <span className="text-slate-200">{c.rendimientoVideo ?? '—'}×</span>
                          <span className={`ml-1.5 rounded border px-1 py-0.5 text-[10px] ${colorGrado(gradoLabel('rendimientoVideo', c.rendimientoVideo))}`}>
                            {gradoLabel('rendimientoVideo', c.rendimientoVideo)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <h2 className="text-sm font-bold text-slate-200 mb-1">
                Los que más rinden{' '}
                {informe.ordenadoPor === 'contrib'
                  ? '(vs. la media de su propio canal)'
                  : informe.ordenadoPor === 'perf'
                    ? '(vs. sus suscriptores)'
                    : '(por vistas/día)'}
              </h2>
              <p className="text-[11px] text-slate-500 mb-3">
                Un Short con «50× subs» multiplica por 50 los suscriptores de su canal: es un outlier aunque el canal sea pequeño.
              </p>
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
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="text-slate-400">{v.vistas.toLocaleString('es-ES')} vistas</span>
                        <span>· {v.vistasPorDia.toLocaleString('es-ES')}/día · {v.duracionSeg}s</span>
                        {v.perf !== null && (
                          <span className={`rounded border px-1.5 py-0.5 font-semibold ${colorGrado(v.gradoPerf)}`} title="Rendimiento: vistas ÷ suscriptores del canal">
                            {v.perf}× subs
                          </span>
                        )}
                        {v.contrib !== null && (
                          <span className={`rounded border px-1.5 py-0.5 font-semibold ${colorGrado(v.gradoContrib)}`} title="Contribución: vistas ÷ media del canal">
                            {v.contrib}× media
                          </span>
                        )}
                        {v.canal && <span>· {v.canal}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => usarReceta(v)}
                      className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
                      title="Lleva la duración objetivo, el ritmo y las palabras ganadoras a la creación"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">Crear Short</span>
                    </button>
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
