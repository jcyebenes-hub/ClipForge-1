import React from 'react';

interface MarcoLegalProps {
  titulo: string;
  bajada: string;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

/** Página legal pública: se lee sin iniciar sesión y cabe en el móvil. */
export function MarcoLegal({ titulo, bajada, onNavigate, children }: MarcoLegalProps) {
  const ir = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.assign(path);
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-slate-200">
      <header className="border-b border-purple-950/50">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => ir('/')}
            className="text-sm font-black text-white"
          >
            Clip<span className="text-cyan-400">Forge</span>
          </button>
          <button
            type="button"
            onClick={() => ir('/')}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Volver al inicio
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">ClipForge</p>
        <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">{titulo}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{bajada}</p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-300">{children}</div>
      </main>
    </div>
  );
}

export function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-white">{titulo}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
