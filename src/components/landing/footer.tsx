import React from 'react';
import { Video, Sparkles, Heart, Shield, Terminal, ArrowUp, Github, Twitter, Youtube, Instagram } from 'lucide-react';

interface FooterProps {
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenContact?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPrivacy, onOpenTerms, onOpenContact }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#06060c] border-t border-purple-950/40 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-12">
          
          {/* Brand & Mission Column */}
          <div className="lg:col-span-2 space-y-4">
            <a href="#" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center shadow-md shadow-purple-600/30">
                <Video className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                Clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Forge</span>
              </span>
            </a>

            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm">
              La plataforma de inteligencia artificial diseñada para que creadores, podcasters y marcas conviertan horas de contenido en Shorts, Reels y TikToks virales en segundos.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-300 font-medium">Todos los motores de IA 100% operativos</span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
              Producto
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#funciones" className="hover:text-cyan-400 transition-colors">Funciones IA</a>
              </li>
              <li>
                <a href="#como-funciona" className="hover:text-cyan-400 transition-colors">Cómo funciona</a>
              </li>
              <li>
                <a href="#precios" className="hover:text-cyan-400 transition-colors">Precios y Planes</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-cyan-400 transition-colors">Preguntas frecuentes</a>
              </li>
              <li>
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300">
                  Whisper v3 Activo
                </span>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
              Legal y Soporte
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href="#precios"
                  onClick={onOpenTerms}
                  className="hover:text-cyan-400 transition-colors cursor-pointer"
                >
                  Precios
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenTerms}
                  className="hover:text-cyan-400 transition-colors cursor-pointer text-left"
                >
                  Términos del Servicio
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="hover:text-cyan-400 transition-colors cursor-pointer text-left"
                >
                  Política de Privacidad
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenContact}
                  className="hover:text-cyan-400 transition-colors cursor-pointer text-left"
                >
                  Contacto & Soporte
                </button>
              </li>
            </ul>
          </div>

          {/* Social / Communities */}
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
              Comunidad
            </h4>
            <div className="flex gap-3 text-slate-400">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-red-400 hover:border-red-500/40 transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-pink-400 hover:border-pink-500/40 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
            <p className="text-[11px] text-slate-500 mt-4">
              ¿Tienes sugerencias? Escríbenos a <span className="text-slate-300">soporte@clipforge.ai</span>
            </p>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-slate-400">
            © 2026 ClipForge. Todos los derechos reservados.
          </p>

          <div className="flex items-center gap-4">
            <span className="text-slate-400 flex items-center gap-1">
              Desarrollado para creadores con visión global
            </span>
            <button
              onClick={scrollToTop}
              className="p-2 rounded-lg bg-slate-900 hover:bg-purple-950 border border-slate-800 hover:border-purple-600/40 text-slate-300 transition-colors cursor-pointer"
              aria-label="Volver arriba"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
