import React, { useState } from 'react';
import { copiarEnElGesto } from '../../lib/portapapeles';

interface TitulosExtra {
  titulos: string[];
  descripcion: string;
  hashtags: string[];
}

interface Props {
  titulo: string;
  texto: string;
  transcripcion: string;
  duracionSeg?: number;
  capitulosSuficientes: boolean;
}

/**
 * La parte útil del estudio de OpenShorts: capítulos y textos para copiar.
 * No publica el vídeo. Los títulos extra solo se muestran si los escribe la IA de verdad.
 */
export const FichaPublicacion: React.FC<Props> = ({
  titulo,
  texto,
  transcripcion,
  duracionSeg,
  capitulosSuficientes,
}) => {
  const [pidiendo, setPidiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [extra, setExtra] = useState<TitulosExtra | null>(null);
  const [copiado, setCopiado] = useState(false);

  const textoCompleto = extra
    ? `${texto}\n\nTítulos:\n${extra.titulos.map((t) => `- ${t}`).join('\n')}\n\n${extra.descripcion}\n${extra.hashtags.join(' ')}`
    : texto;

  const copiar = () => {
    const ok = copiarEnElGesto(textoCompleto);
    setCopiado(ok);
    setAviso(ok ? '' : 'No se ha podido copiar. Selecciona el texto y cópialo a mano.');
  };

  const pedirTitulos = async () => {
    setPidiendo(true);
    setAviso('');
    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_id: 'ficha-video',
          transcripcion: transcripcion.slice(0, 4000),
          titulo_actual: titulo,
          duracion_seg: duracionSeg || 60,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.provider !== 'groq-llama-3.3' || !Array.isArray(data.titulo_gancho)) {
        setAviso('No he sacado títulos nuevos. Los de tus cortes sí son de este vídeo.');
        return;
      }
      setExtra({
        titulos: data.titulo_gancho.map((t: unknown) => String(t)).filter(Boolean).slice(0, 3),
        descripcion: String(data.descripcion || ''),
        hashtags: Array.isArray(data.hashtags) ? data.hashtags.map((h: unknown) => String(h)) : [],
      });
    } catch {
      setAviso('No he podido pedir los títulos. La ficha de capítulos sigue lista para copiar.');
    } finally {
      setPidiendo(false);
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-900/40 bg-[#0e0e1a] p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Ficha para publicar</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Capítulos sacados de este vídeo. Cópialos y pégalos en YouTube, TikTok o Instagram.
            ClipForge no publica el vídeo por ti.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pedirTitulos}
            disabled={pidiendo || transcripcion.trim().length < 8}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-[#141424] border border-cyan-800/50 text-cyan-200 disabled:opacity-40"
          >
            {pidiendo ? 'Pidiendo títulos…' : 'Pedir títulos'}
          </button>
          <button
            type="button"
            onClick={copiar}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-cyan-400 text-black"
          >
            {copiado ? 'Copiado' : 'Copiar ficha'}
          </button>
        </div>
      </div>
      {!capitulosSuficientes && (
        <p className="text-xs text-amber-200/90">
          YouTube solo muestra capítulos si hay al menos tres marcas y la primera es 0:00. En este vídeo no hay tantas frases separadas, así que no invento las que faltan.
        </p>
      )}
      {aviso && <p className="text-xs text-amber-200/90">{aviso}</p>}
      {extra && (
        <div className="text-xs text-slate-200 space-y-1">
          {extra.titulos.map((t) => (
            <p key={t}>· {t}</p>
          ))}
          {extra.descripcion && <p className="text-slate-400">{extra.descripcion}</p>}
        </div>
      )}
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 border border-slate-800 p-3 text-[11px] leading-relaxed text-slate-300">
        {textoCompleto}
      </pre>
    </section>
  );
};
