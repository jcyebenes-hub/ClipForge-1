'use client';

import React from 'react';
import { Coffee } from 'lucide-react';
import { trackEvent } from '../../lib/analytics';

/**
 * Tacita compacta de Ko-fi para la barra superior. Discreta y siempre accesible,
 * sin competir con la acción principal. Solo se renderiza si VITE_KOFI_URL está
 * configurada. En móvil muestra solo el icono; en escritorio, icono + "Apoyar".
 */
export function KoFiTopButton() {
  const kofiUrl = ((import.meta.env.VITE_KOFI_URL as string | undefined) || '').trim();
  if (!kofiUrl) return null;

  return (
    <a
      href={kofiUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void trackEvent('click_donacion', { destino: 'kofi_top' })}
      title="Apoya ClipForge en Ko-fi"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#141424] border border-purple-900/40 text-slate-300 hover:text-white hover:border-purple-500/50 transition-colors text-sm font-semibold shrink-0"
    >
      <Coffee className="w-4 h-4 text-amber-400" />
      <span className="hidden sm:inline">Apoyar</span>
    </a>
  );
}
