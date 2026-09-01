import React, { useState, useEffect } from 'react';
import { Sparkles, Menu, X, ArrowRight, Video, ShieldCheck, Globe } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { ComoSeProcesaModal } from '../common/ComoSeProcesaModal';

interface NavbarProps {
  onStartFree?: () => void;
  onLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onStartFree, onLogin }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showComoSeProcesa, setShowComoSeProcesa] = useState(false);
  const { idioma, setIdioma, t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: idioma === 'es' ? 'Funciones' : 'Features', href: '#funciones' },
    { label: idioma === 'es' ? 'Cómo funciona' : 'How it works', href: '#como-funciona' },
    { label: idioma === 'es' ? 'Precios' : 'Pricing', href: '#precios' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#0a0a12]/85 backdrop-blur-md border-b border-purple-900/30 shadow-lg shadow-black/40 py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a
              href="#"
              id="nav-logo-link"
              className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg p-1"
            >
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-600/30 group-hover:scale-105 transition-transform duration-200">
                <Video className="w-4 h-4 text-white" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full flex items-center justify-center animate-pulse">
                  <Sparkles className="w-2 h-2 text-slate-950" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1 font-['Plus_Jakarta_Sans',sans-serif]">
                  Clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400">Forge</span>
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-7">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200 relative group py-1"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-200 group-hover:w-full"></span>
                </a>
              ))}

              <button
                onClick={() => setShowComoSeProcesa(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/40 text-xs font-semibold text-purple-300 hover:text-white transition-all cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('como_se_procesa')}</span>
              </button>
            </nav>

            {/* Right Action Button & Language */}
            <div className="hidden md:flex items-center gap-3">
              {/* Language Switcher */}
              <div className="inline-flex items-center p-1 rounded-xl bg-[#141424] border border-purple-900/40">
                <button
                  onClick={() => setIdioma('es')}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    idioma === 'es' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ES
                </button>
                <button
                  onClick={() => setIdioma('en')}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    idioma === 'en' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  EN
                </button>
              </div>

              <button
                id="navbar-login-btn"
                onClick={onLogin}
                className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2 rounded-xl hover:bg-purple-950/40 transition-colors cursor-pointer"
              >
                {idioma === 'es' ? 'Iniciar sesión' : 'Log in'}
              </button>
              <button
                id="navbar-cta-btn"
                onClick={onStartFree}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-900/40 hover:shadow-purple-700/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-purple-400/30 cursor-pointer"
              >
                <span>{t('btn_empezar_gratis')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="flex md:hidden items-center gap-2">
              <button
                id="mobile-menu-toggle-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-purple-950/40 border border-purple-900/30 transition-colors"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0e0e1a]/95 backdrop-blur-xl border-b border-purple-900/40 px-6 py-5 shadow-2xl animate-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-slate-200 hover:text-cyan-400 py-2 border-b border-slate-800/50"
                >
                  {link.label}
                </a>
              ))}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowComoSeProcesa(true);
                }}
                className="text-left text-sm font-semibold text-purple-300 py-2 border-b border-slate-800/50 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>{t('como_se_procesa')}</span>
              </button>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  id="mobile-navbar-login-btn"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogin?.();
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-[#141424] border border-purple-900/40"
                >
                  {idioma === 'es' ? 'Iniciar sesión' : 'Log in'}
                </button>
                <button
                  id="mobile-navbar-cta-btn"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onStartFree?.();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-indigo-500"
                >
                  <span>{t('btn_empezar_gratis')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <ComoSeProcesaModal 
        isOpen={showComoSeProcesa} 
        onClose={() => setShowComoSeProcesa(false)} 
      />
    </>
  );
};
