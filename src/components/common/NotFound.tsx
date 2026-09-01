import React from 'react';
import { Video, Home, LayoutDashboard, ArrowLeft, Sparkles, HelpCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface NotFoundProps {
  onNavigate?: (path: string) => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#0a0a12] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-700/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-700/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full text-center p-8 rounded-3xl bg-[#121222]/80 border border-purple-900/40 backdrop-blur-xl shadow-2xl">
        {/* Animated 404 badge */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 via-pink-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-purple-600/30">
            <span className="text-3xl font-black text-white font-['Plus_Jakarta_Sans',sans-serif]">404</span>
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center text-slate-950 animate-bounce">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif] mb-2">
          {t('error_404_title')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-8">
          {t('error_404_desc')} El enlace puede estar roto o el clip/proyecto ha sido eliminado.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            id="btn-404-dashboard"
            onClick={() => onNavigate?.('/dashboard')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-900/40 transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{t('btn_ir_dashboard')}</span>
          </button>

          <button
            id="btn-404-home"
            onClick={() => onNavigate?.('/')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#18182c] hover:bg-[#202038] border border-purple-900/40 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>{t('btn_volver_inicio')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
