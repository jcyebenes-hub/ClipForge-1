import React, { useState } from 'react';
import { Search, Loader2, DownloadCloud, ExternalLink, AlertCircle, Film, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  buscarVideosStock,
  elegirArchivo,
  formatoSegundos,
  type VideoStock,
} from '../../lib/stockVideos';

/**
 * Buscador de vídeo de banco (Pexels) con licencia de uso comercial.
 *
 * El archivo se descarga en el propio navegador (el CDN de Pexels permite CORS y
 * rangos) y se entrega como `File`, de modo que el resto del flujo (subida por
 * trozos con progreso real a Supabase) es idéntico al de un archivo subido a mano.
 */

export interface MetaVideoStock {
  titulo: string;
  autor: string;
  autorUrl: string;
  pagina: string;
  duracionSeg: number;
}

interface Props {
  onElegido: (archivo: File, meta: MetaVideoStock) => void;
  ocupado?: boolean;
}

/** Descarga un URL como File informando del progreso real (lectura del stream). */
async function descargarComoArchivo(
  url: string,
  nombre: string,
  onProgreso: (porcentaje: number, bytes: number, total: number) => void
): Promise<File> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`La descarga del vídeo falló (HTTP ${respuesta.status})`);

  const total = Number(respuesta.headers.get('content-length')) || 0;
  if (!respuesta.body) {
    const blob = await respuesta.blob();
    onProgreso(100, blob.size, blob.size);
    return new File([blob], nombre, { type: blob.type || 'video/mp4' });
  }

  const lector = respuesta.body.getReader();
  const trozos: Uint8Array[] = [];
  let recibidos = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    if (value) {
      trozos.push(value);
      recibidos += value.length;
      onProgreso(total ? Math.min(99, Math.round((recibidos / total) * 100)) : 0, recibidos, total);
    }
  }
  const blob = new Blob(trozos as BlobPart[], { type: 'video/mp4' });
  onProgreso(100, blob.size, blob.size);
  return new File([blob], nombre, { type: 'video/mp4' });
}

export const StockVideoPicker: React.FC<Props> = ({ onElegido, ocupado }) => {
  const apiKey = (import.meta.env.VITE_PEXELS_API_KEY as string) || '';

  const [consulta, setConsulta] = useState('');
  const [orientacion, setOrientacion] = useState<'vertical' | 'horizontal'>('vertical');
  const [resultados, setResultados] = useState<VideoStock[]>([]);
  const [total, setTotal] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [descarga, setDescarga] = useState<{ id: number; pct: number; mb: number; totalMb: number } | null>(null);

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!consulta.trim()) {
      toast.warning('Escribe qué quieres buscar (p. ej. "playa atardecer").');
      return;
    }
    setBuscando(true);
    setError('');
    try {
      const r = await buscarVideosStock(consulta, {
        apiKey: apiKey || undefined,
        perPage: 12,
        orientacion: orientacion === 'vertical' ? 'portrait' : 'landscape',
      });
      setResultados(r.videos);
      setTotal(r.total);
      if (!r.videos.length) setError('No hemos encontrado vídeos para esa búsqueda. Prueba con otras palabras.');
    } catch (err: any) {
      setError(err?.message || 'Error al buscar en Pexels');
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const usarVideo = async (video: VideoStock) => {
    const archivo = elegirArchivo(video);
    if (!archivo) {
      toast.error('Ese vídeo no tiene un archivo MP4 disponible.');
      return;
    }
    const nombre = `pexels-${video.id}-${archivo.alto || 'hd'}p.mp4`;
    setDescarga({ id: video.id, pct: 0, mb: 0, totalMb: 0 });
    try {
      const file = await descargarComoArchivo(archivo.enlace, nombre, (pct, bytes, tot) => {
        setDescarga({
          id: video.id,
          pct,
          mb: bytes / 1048576,
          totalMb: tot / 1048576,
        });
      });
      toast.success('Vídeo descargado. Creando el proyecto…');
      onElegido(file, {
        titulo: `${consulta.trim() || 'Vídeo de banco'} · Pexels #${video.id}`,
        autor: video.autor,
        autorUrl: video.autorUrl,
        pagina: video.pagina,
        duracionSeg: video.duracionSeg,
      });
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo descargar el vídeo');
      setError(err?.message || 'No se pudo descargar el vídeo');
    } finally {
      setDescarga(null);
    }
  };

  return (
    <div className="bg-[#121222] border border-purple-900/40 rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-cyan-600/20 text-cyan-300 flex items-center justify-center shrink-0">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Vídeos de banco con licencia comercial</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Busca en Pexels y usa el vídeo directamente: se descarga, se sube a tu proyecto y puedes
            cortarlo y descargar los clips. Licencia gratuita para uso comercial; no se pueden revender
            copias sin modificar.
          </p>
        </div>
      </div>

      {!apiKey && (
        <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
          <div className="text-[11px] text-amber-100 leading-relaxed">
            <strong className="text-amber-200">Falta la clave gratuita de Pexels.</strong> Sin ella la
            búsqueda no funciona (Pexels devuelve 401). Se crea en 2 minutos:{' '}
            <a
              href="https://www.pexels.com/api/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              pexels.com/api
            </a>{' '}
            → crea cuenta → «Your API Key» → y se añade en Render como{' '}
            <code className="px-1 py-0.5 rounded bg-black/40 font-mono">VITE_PEXELS_API_KEY</code>.
          </div>
        </div>
      )}

      <form onSubmit={buscar} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="¿Qué necesitas? p. ej. playa atardecer, ciudad noche, café…"
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-[#0b0b18] border border-purple-700/40 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400/70"
            />
          </div>
          <button
            type="submit"
            disabled={buscando || ocupado}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-lg shadow-cyan-900/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Formato:</span>
          {(['vertical', 'horizontal'] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrientacion(o)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                orientacion === o
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#18182c] text-slate-400 hover:text-white'
              }`}
            >
              {o === 'vertical' ? 'Vertical 9:16 (Reels/TikTok)' : 'Horizontal 16:9'}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-red-500/10 border border-red-500/40">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
          <p className="text-[11px] text-red-200 leading-relaxed">{error}</p>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400">
            {resultados.length} resultados de {total.toLocaleString('es-ES')} · pulsa uno para usarlo
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {resultados.map((v) => {
              const descargando = descarga?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => usarVideo(v)}
                  disabled={Boolean(descarga) || ocupado}
                  className="group relative rounded-xl overflow-hidden border border-purple-900/40 bg-[#0b0b18] text-left transition-all hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-900/20 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  <div className="relative aspect-[9/16] sm:aspect-video bg-black">
                    {v.imagen && (
                      <img
                        src={v.imagen}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold text-white">
                      {formatoSegundos(v.duracionSeg)}
                    </span>
                    {v.ancho > 0 && (
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-semibold text-slate-200">
                        {v.ancho}×{v.alto}
                      </span>
                    )}

                    {descargando ? (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 p-3">
                        <div className="relative w-14 h-14">
                          <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                            <circle cx="28" cy="28" r="24" fill="none" stroke="#2b2b52" strokeWidth="5" />
                            <circle
                              cx="28"
                              cy="28"
                              r="24"
                              fill="none"
                              stroke="#22d3ee"
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 24}
                              strokeDashoffset={2 * Math.PI * 24 * (1 - descarga.pct / 100)}
                              style={{ transition: 'stroke-dashoffset 0.2s ease' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
                            {descarga.pct}%
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-300 text-center">
                          {descarga.mb.toFixed(1)} MB
                          {descarga.totalMb ? ` de ${descarga.totalMb.toFixed(1)} MB` : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 text-white text-[11px] font-bold">
                          <DownloadCloud className="w-3.5 h-3.5" /> Usar este vídeo
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 truncate">{v.autor}</span>
                    <a
                      href={v.pagina}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-500 hover:text-cyan-300 shrink-0"
                      title="Ver en Pexels"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockVideoPicker;
