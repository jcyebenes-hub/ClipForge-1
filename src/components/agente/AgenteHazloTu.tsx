import React, { useRef, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/client';
import { sanitizarTitulo } from '../../lib/sanitizer';
import {
  elegirVideoViral,
  mercadoDelAgente,
  queHacerSiNoHaySubtitulos,
  urlDeVideoYoutube,
} from '../../lib/agenteHazloTu';
import { CLAVE_MERCADO_ELEGIDO } from '../../lib/paisViral';
import { generarVentanasTemporales, calcularHeuristicasVentanas } from '../../lib/audioHeuristics';
import {
  CopyrightNoticeModal,
  hasAcceptedCopyrightNotice,
} from '../proyecto/CopyrightNoticeModal';

interface Props {
  userId?: string;
  plan?: string | null;
  supabaseListo: boolean;
  onNavigate?: (path: string) => void;
}

type Fase = 'idle' | 'buscando' | 'subtitulos' | 'troceando' | 'parado' | 'listo';

const CLAVE_AVISO = 'clipforge_agente_aviso';

export const AgenteHazloTu: React.FC<Props> = ({ userId, plan, supabaseListo, onNavigate }) => {
  const [tema, setTema] = useState('');
  const [fase, setFase] = useState<Fase>('idle');
  const [aviso, setAviso] = useState('');
  const [pideDerechos, setPideDerechos] = useState(false);
  const derechosAceptados = useRef(false);

  const ocupado = fase === 'buscando' || fase === 'subtitulos' || fase === 'troceando';

  const guardarLocal = (proyecto: Record<string, unknown>) => {
    try {
      const crudo = localStorage.getItem('clipforge_local_proyectos');
      const lista = crudo ? JSON.parse(crudo) : [];
      const i = lista.findIndex((p: { id?: string }) => p.id === proyecto.id);
      if (i >= 0) lista[i] = proyecto;
      else lista.unshift(proyecto);
      localStorage.setItem('clipforge_local_proyectos', JSON.stringify(lista));
    } catch { /* el proyecto sigue en pantalla */ }
  };

  const ejecutar = async () => {
    const palabra = tema.trim();
    if (!palabra) {
      toast.error('Escribe un tema. Por ejemplo: recetas, fútbol, finanzas.');
      return;
    }
    if (!derechosAceptados.current && !hasAcceptedCopyrightNotice()) {
      setPideDerechos(true);
      return;
    }

    setAviso('');
    setFase('buscando');
    try {
      let detectado: string | null = null;
      try {
        const pais = await fetch('/api/pais').then((r) => r.json());
        detectado = pais?.pais || null;
      } catch { /* si no hay país, el mercado cae en España */ }
      const elegido = localStorage.getItem(CLAVE_MERCADO_ELEGIDO);
      const mercado = mercadoDelAgente(elegido, detectado);

      const busca = await fetch('/api/tendencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          palabraClave: palabra,
          user_id: userId,
          plan,
          dias: 90,
          region: mercado.region,
          idioma: mercado.idioma,
          paisEstricto: mercado.estricto,
        }),
      });
      const datos = await busca.json().catch(() => ({}));
      if (!busca.ok) {
        throw new Error(datos.error || 'No he podido buscar vídeos virales.');
      }
      const video = elegirVideoViral(datos?.informe?.destacados || []);
      if (!video) throw new Error('La búsqueda no ha dejado ningún vídeo utilizable.');

      const projectId = 'proj-ag-' + Math.random().toString(36).substring(2, 9);
      const ahora = new Date().toISOString();
      const url = urlDeVideoYoutube(video.id);
      const titulo = sanitizarTitulo(video.titulo, 120);
      const proyecto: Record<string, unknown> = {
        id: projectId,
        user_id: userId || 'demo-user',
        titulo,
        url_youtube: url,
        archivo_nombre: null,
        estado: 'nuevo',
        duracion_seg: 0,
        creado_en: ahora,
        actualizado_en: ahora,
      };

      if (supabaseListo && userId) {
        const { error } = await supabase.from('proyectos').insert([{
          id: projectId,
          user_id: userId,
          titulo,
          url_youtube: url,
          archivo_nombre: null,
          estado: 'nuevo',
          duracion_seg: 0,
        }] as never);
        if (error) console.warn('No se ha guardado el proyecto en la cuenta:', error);
      }
      guardarLocal(proyecto);

      setFase('subtitulos');
      const tr = await fetch('/api/youtube/transcribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, lang: 'es' }),
      });
      const transcripcion = await tr.json().catch(() => ({}));
      if (!tr.ok || !transcripcion?.segments?.length) {
        if (queHacerSiNoHaySubtitulos() !== 'parar_y_pedir_archivo') {
          throw new Error('El agente no tiene un paso seguro si faltan subtítulos.');
        }
        sessionStorage.setItem(CLAVE_AVISO, projectId);
        setFase('parado');
        setAviso('YouTube no ha dejado leer los subtítulos. No bajo el vídeo a ninguna nube: entra al proyecto y súbelo tú en el paso 3. A partir de ahí sigo.');
        onNavigate?.(`/dashboard/proyecto/${projectId}`);
        return;
      }

      const duracion = Math.round(Number(transcripcion.duration) || 0);
      proyecto.estado = 'transcrito';
      proyecto.duracion_seg = duracion;
      proyecto.subtitulos_json = transcripcion;
      proyecto.actualizado_en = new Date().toISOString();
      if (supabaseListo && userId) {
        await (supabase.from('proyectos') as any).update({
          estado: 'transcrito',
          duracion_seg: duracion,
          subtitulos_json: transcripcion,
          actualizado_en: proyecto.actualizado_en,
        }).eq('id', projectId);
      }
      guardarLocal(proyecto);

      setFase('troceando');
      const ventanas = generarVentanasTemporales(duracion || 180, 30, 5);
      const words = transcripcion.words?.length
        ? transcripcion.words
        : (transcripcion.segments || []).flatMap((s: { words?: unknown[] }) => s.words || []);
      const heuristicas = await calcularHeuristicasVentanas(ventanas, words);
      const analisis = await fetch('/api/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: projectId,
          duracion_seg: duracion || 180,
          subtitulos_json: transcripcion,
          heuristicas,
        }),
      });
      const cortes = await analisis.json().catch(() => ({}));
      if (!analisis.ok) throw new Error(cortes.error || 'No he podido trocear el vídeo.');

      const clips = (cortes.clips || []).map((c: { id: string }) => ({
        ...c,
        thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      }));
      localStorage.setItem(`clipforge_clips_${projectId}`, JSON.stringify(clips));
      proyecto.estado = 'analizado';
      if (supabaseListo && userId) {
        await (supabase.from('proyectos') as any).update({
          estado: 'analizado',
          actualizado_en: new Date().toISOString(),
        }).eq('id', projectId);
        for (const c of clips) {
          await (supabase.from('clips') as any).upsert({
            id: c.id,
            proyecto_id: projectId,
            inicio_seg: c.inicio_seg,
            fin_seg: c.fin_seg,
            puntuacion_viral: c.puntuacion_viral,
            titulo_hook: c.titulo_hook,
            cta: c.cta || c.razon,
            estado: 'sugerido',
            creado_en: new Date().toISOString(),
          });
        }
      }
      guardarLocal(proyecto);
      setFase('listo');
      toast.success('Cortes y títulos listos. Para bajar el Short aún hace falta el archivo.');
      onNavigate?.(`/dashboard/proyecto/${projectId}`);
    } catch (err) {
      setFase('idle');
      const msg = err instanceof Error ? err.message : 'El agente se ha parado.';
      setAviso(msg);
      toast.error(msg);
    }
  };

  const textoFase =
    fase === 'buscando' ? 'Buscando un vídeo viral de tu tema…' :
    fase === 'subtitulos' ? 'Leyendo subtítulos…' :
    fase === 'troceando' ? 'Troceando y poniendo títulos…' :
    '';

  return (
    <section className="rounded-2xl border border-purple-800/50 bg-[#121222] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Más adelante, de pago. Hoy no se cobra.</p>
          <h2 className="mt-1 text-lg font-black text-white">Hazlo todo tú</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
            Busca un viral de tu tema, lee los subtítulos si YouTube los deja, y deja los cortes con título.
            No baja el vídeo a ninguna nube. Si faltan subtítulos, se para y lo subes tú.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !ocupado && ejecutar()}
          placeholder="Tema: recetas, fútbol, finanzas…"
          className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <button
          id="hazlo-todo-tu-btn"
          type="button"
          onClick={ejecutar}
          disabled={ocupado}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-black text-black disabled:opacity-60"
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span>Hazlo todo tú</span>
        </button>
      </div>
      {textoFase && <p className="mt-3 text-xs font-semibold text-cyan-200">{textoFase}</p>}
      {aviso && <p className="mt-3 text-xs leading-relaxed text-amber-100">{aviso}</p>}
      <CopyrightNoticeModal
        isOpen={pideDerechos}
        onCancel={() => setPideDerechos(false)}
        onConfirm={() => {
          derechosAceptados.current = true;
          setPideDerechos(false);
          ejecutar();
        }}
      />
    </section>
  );
};
