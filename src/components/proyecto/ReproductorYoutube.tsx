import React, { useEffect, useRef, useState } from 'react';

function cargarApiYoutube(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('sin window'));
    const win = window as any;
    if (win.YT && win.YT.Player) return resolve(win.YT);
    const previo = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      if (previo) previo();
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

interface Props {
  videoId: string;
  titulo?: string;
}

/**
 * Reproduce el vídeo dentro de la app con la IFrame Player API oficial.
 * No descarga el archivo: lo sirve YouTube.
 */
export const ReproductorYoutube: React.FC<Props> = ({ videoId, titulo }) => {
  const caja = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let muerto = false;
    let player: { destroy?: () => void } | null = null;
    setListo(false);
    setError('');

    (async () => {
      try {
        const YT = await cargarApiYoutube();
        if (muerto || !caja.current) return;
        player = new YT.Player(caja.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            controls: 1,
            hl: 'es',
            origin: window.location.origin,
            enablejsapi: 1,
          },
          events: {
            onReady: () => {
              if (!muerto) setListo(true);
            },
            onError: () => {
              if (muerto) return;
              setListo(true);
              setError('YouTube no deja reproducir este vídeo aquí. Ábrelo en YouTube.');
            },
          },
        });
      } catch {
        if (!muerto) {
          setListo(true);
          setError('No se ha podido cargar el reproductor de YouTube.');
        }
      }
    })();

    return () => {
      muerto = true;
      try {
        player?.destroy?.();
      } catch {
        /* el iframe ya no está */
      }
    };
  }, [videoId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-red-900/40 bg-[#0e0e1a]">
      <div className="flex items-center justify-between gap-3 border-b border-red-900/30 px-4 py-3">
        <p className="text-xs font-bold text-white">Vídeo en la app</p>
        <p className="text-[11px] text-slate-400">Se reproduce aquí. No se descarga.</p>
      </div>
      <div className="relative aspect-video bg-black">
        <div ref={caja} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
        {!listo && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-slate-300">
            Cargando el reproductor de YouTube…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
            <p className="text-xs font-bold text-slate-100">{error}</p>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white"
            >
              Ver en YouTube
            </a>
          </div>
        )}
      </div>
      {titulo && <p className="truncate px-4 py-2 text-xs text-slate-400">{titulo}</p>}
    </section>
  );
};
