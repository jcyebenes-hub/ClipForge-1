'use client';

import React from 'react';
import { trackEvent } from '../../lib/analytics';

/**
 * Tacita de Ko-fi con el ICONO oficial elegido por el usuario (public/kofi.png),
 * servido como estático desde dist/. SVG ya no se usa. Solo se renderiza si
 * VITE_KOFI_URL está configurada.
 */
export function KoFiTopButton() {
  const kofiUrl = ((import.meta.env.VITE_KOFI_URL as string | undefined) || '').trim();
  if (!kofiUrl) return null;

  const base = (import.meta as any).env?.BASE_URL || '/';

  return (
    <a
      href={kofiUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void trackEvent('click_donacion', { destino: 'kofi_top' })}
      title="Apoya ClipForge en Ko-fi"
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#141424] border border-purple-900/40 text-slate-300 hover:text-white hover:border-purple-500/50 transition-colors text-sm font-semibold shrink-0"
    >
      <img
        src={`${base}kofi.png`}
        alt="Ko-fi"
        className="w-5 h-5 rounded-md object-cover"
        loading="lazy"
      />
      <span className="hidden sm:inline">Apoyar</span>
    </a>
  );
}
