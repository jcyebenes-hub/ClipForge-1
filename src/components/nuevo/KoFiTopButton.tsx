'use client';

import React from 'react';
import { trackEvent } from '../../lib/analytics';

/**
 * Tacita de Ko-fi con el LOGO OFICIAL de la marca (trazos originales de
 * ko-fi.com/img/logo.svg), en rojo Ko-fi para que se vea sobre fondo oscuro.
 * SVG inline: siempre carga, sin depender de red. Solo se renderiza si
 * VITE_KOFI_URL está configurada.
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
      <svg viewBox="0 0 56.7 56.7" className="w-4 h-4" fill="#FF5E5B" aria-hidden="true">
        <path d="M23.6,11.2C14,11.2,6.2,19,6.2,28.6C6.2,38.2,14,46,23.6,46C33.2,46,41,38.2,41,28.6C41,19,33.2,11.2,23.6,11.2z M23.8,38.5l-0.5,0.2l-0.5-0.2c-0.4-0.2-9.8-5.4-9.8-11.3c0-3.8,2.5-6.8,5.8-6.8c1.6,0,3.1,0.7,4.5,2.1c1.3-1.4,2.9-2.1,4.5-2.1c3.2,0,5.8,3,5.8,6.9C33.6,33.1,24.2,38.2,23.8,38.5z" />
        <path d="M56.7,28.8c0-2.6-2-3-3.4-3.1h-5.5C47,17.4,41.8,10,33.3,6.3C22.6,1.7,10,5.7,3.7,15.5c-7.7,12.1-3.1,27.9,9.5,34.2c10.3,5.1,23.1,2,29.9-7.3c2.5-3.4,3.8-6.9,4.3-10.7l6.3,0C55.2,31.7,56.7,31.2,56.7,28.8z M15.9,46.6c-11.3-5-15.4-18.8-8.7-29.1C12.4,9.3,23,6.1,31.9,10c11.3,5,15.4,18.8,8.7,29.1C35.3,47.3,24.7,50.5,15.9,46.6z" />
      </svg>
      <span className="hidden sm:inline">Apoyar</span>
    </a>
  );
}
