import React, { useState } from 'react';
import { 
  Video, 
  Sparkles, 
  Plus, 
  LogOut, 
  User as UserIcon, 
  LayoutDashboard, 
  Settings, 
  Flame, 
  ChevronDown, 
  ExternalLink,
  Menu,
  X,
  Youtube,
  Calendar as CalendarIcon,
  BarChart3,
  Radar,
  Fingerprint,
  ShieldCheck,
  Globe,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useYouTube , YOUTUBE_UPLOAD_HABILITADO } from '../../context/YouTubeAuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { KoFiTopButton } from '../nuevo/KoFiTopButton';
import { activarHuella } from '../../lib/passkeys';
import { toast } from 'sonner';
import { ComoSeProcesaModal } from '../common/ComoSeProcesaModal';

interface AppNavbarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  currentPath = '/dashboard',
  onNavigate,
}) => {
  const { user, profile, signOut } = useAuth();
  const { isConnected, channel, connectYouTube, disconnectYouTube } = useYouTube();
  const { idioma, setIdioma, t } = useLanguage();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  /**
   * El menú en un solo sitio. Estaba duplicado de hecho: solo existía en el nav
   * de escritorio, que es `hidden sm:flex`, así que en el teléfono no había
   * forma de llegar a Vídeos virales ni a Estadísticas.
   */
  const navegacion = [
    { ruta: '/dashboard', etiqueta: t('dashboard'), Icono: LayoutDashboard, color: 'text-purple-400' },
    { ruta: '/dashboard/publicar', etiqueta: t('publicar'), Icono: CalendarIcon, color: 'text-pink-400' },
    { ruta: '/dashboard/competencia', etiqueta: 'Vídeos virales', Icono: Radar, color: 'text-emerald-400' },
    { ruta: '/dashboard/estadisticas', etiqueta: t('estadisticas'), Icono: BarChart3, color: 'text-cyan-400' },
  ];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showComoSeProcesa, setShowComoSeProcesa] = useState(false);

  const handleNav = (path: string) => {
    onNavigate?.(path);
    setDropdownOpen(false);
  };

  const displayName = profile?.nombre || user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Creador';
  const planName = profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : t('plan_gratis');

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#0d0d18]/90 backdrop-blur-md border-b border-purple-900/30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Core Navigation */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-8">
              <button
                onClick={() => handleNav('/dashboard')}
                className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg p-1"
              >
                <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-purple-600/30 group-hover:scale-105 transition-transform duration-200">
                  <Video className="w-4 h-4 text-white" />
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full flex items-center justify-center animate-pulse">
                    <Sparkles className="w-1.5 h-1.5 text-slate-950" />
                  </div>
                </div>
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-1 font-['Plus_Jakarta_Sans',sans-serif]">
                  Clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400">Forge</span>
                </span>
              </button>

              {/* Nav links */}
              <nav className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => handleNav('/dashboard')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPath === '/dashboard'
                      ? 'bg-purple-950/60 text-white border border-purple-800/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-purple-400" />
                  <span>{t('dashboard')}</span>
                </button>

                <button
                  onClick={() => handleNav('/dashboard/publicar')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPath === '/dashboard/publicar'
                      ? 'bg-purple-950/60 text-white border border-purple-800/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  <CalendarIcon className="w-4 h-4 text-pink-400" />
                  <span>{t('publicar')}</span>
                </button>

                <button
                  onClick={() => handleNav('/dashboard/estadisticas')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPath === '/dashboard/estadisticas'
                      ? 'bg-purple-950/60 text-white border border-purple-800/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <span>{t('estadisticas')}</span>
                </button>

                <button
                  onClick={() => handleNav('/dashboard/competencia')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPath === '/dashboard/competencia'
                      ? 'bg-purple-950/60 text-white border border-purple-800/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  <Radar className="w-4 h-4 text-emerald-400" />
                  <span>Vídeos virales</span>
                </button>

                <button
                  onClick={() => setShowComoSeProcesa(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-950/40 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('como_se_procesa')}</span>
                </button>
              </nav>
            </div>

            {/* Right: Language Switcher + YouTube + Create CTA + User Menu */}
            <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
              {/* Menú móvil: el nav de arriba es `hidden sm:flex` y en el teléfono
                  no se ve, así que sin este botón no se puede navegar. */}
              <button
                onClick={() => setMenuMovilAbierto((abierto) => !abierto)}
                className="sm:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-[#141424] border border-purple-900/40 text-slate-300 transition-colors hover:text-white"
                aria-label="Abrir menú"
                aria-expanded={menuMovilAbierto}
              >
                {menuMovilAbierto ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              {/* Ko-fi (logo oficial) junto al selector de idioma */}
              <KoFiTopButton />

              {/* Language Switcher */}
              <div className="hidden sm:inline-flex items-center p-1 rounded-xl bg-[#141424] border border-purple-900/40">
                <button
                  onClick={() => setIdioma('es')}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    idioma === 'es' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Español"
                >
                  ES
                </button>
                <button
                  onClick={() => setIdioma('en')}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    idioma === 'en' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="English"
                >
                  EN
                </button>
              </div>

              {/* YouTube Quick Connect Status */}
              {isConnected ? (
                <div 
                  className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-red-950/40 border border-red-800/40 text-xs font-semibold text-slate-200"
                  title={`Canal conectado: ${channel?.channelTitle}`}
                >
                  {channel?.channelThumbnail ? (
                    <img src={channel.channelThumbnail} alt="Canal" className="w-5 h-5 rounded-full object-cover border border-red-500" />
                  ) : (
                    <Youtube className="w-4 h-4 text-red-500 fill-red-500" />
                  )}
                  <span className="max-w-[110px] truncate text-[11px] text-red-200 font-bold">{channel?.channelTitle || 'YouTube'}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </div>
              ) : YOUTUBE_UPLOAD_HABILITADO ? (
                <button
                  id="navbar-connect-youtube-btn"
                  onClick={connectYouTube}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-red-950/60 hover:bg-red-900/50 border border-red-800/40 hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  <Youtube className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                  <span>{t('conectar_youtube')}</span>
                </button>
              ) : null}

              {/* Create Clips button */}
              <button
                id="app-nav-create-btn"
                onClick={() => handleNav('/dashboard/nuevo')}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-purple-400/30"
              >
                <Plus className="w-4 h-4" />
                <span>{t('nuevo_proyecto')}</span>
              </button>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  id="user-menu-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 sm:gap-2.5 p-1 sm:p-1.5 sm:pl-2 rounded-xl bg-[#141424] hover:bg-[#1c1c30] border border-purple-900/40 transition-all text-slate-200 hover:text-white"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm">
                    {displayName.charAt(0)}
                  </div>
                  <span className="hidden md:inline-block text-xs font-semibold max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-56 bg-[#131322] border border-purple-900/50 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <div className="px-4 py-2.5 border-b border-slate-800/80">
                      <p className="text-xs font-bold text-white truncate">{displayName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user?.email || 'Sin correo'}</p>
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/80 text-[10px] font-semibold text-purple-300 border border-purple-800/40">
                        {planName}
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => handleNav('/dashboard')}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-purple-950/40 text-left transition-colors"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-purple-400" />
                        <span>{t('dashboard')}</span>
                      </button>
                      <button
                        onClick={() => handleNav('/dashboard/estadisticas')}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-purple-950/40 text-left transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{t('estadisticas')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          setShowComoSeProcesa(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-purple-300 hover:text-purple-200 hover:bg-purple-950/40 text-left transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{t('como_se_procesa')}</span>
                      </button>
                      {isConnected ? (
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            disconnectYouTube();
                          }}
                          className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-red-300 hover:text-red-200 hover:bg-red-950/40 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Youtube className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                            <span className="truncate max-w-[120px]">{channel?.channelTitle || 'YouTube'}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 hover:text-red-300">{t('desconectar_youtube')}</span>
                        </button>
                      ) : YOUTUBE_UPLOAD_HABILITADO ? (
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            connectYouTube();
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 text-left transition-colors"
                        >
                          <Youtube className="w-3.5 h-3.5" />
                          <span>{t('conectar_youtube')}</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="pt-1 border-t border-slate-800/80">
                      <button
                        id="activar-huella-btn"
                        onClick={async () => {
                          setDropdownOpen(false);
                          toast.info('Sigue las instrucciones del navegador para registrar tu huella');
                          const res = await activarHuella();
                          if (res.ok) {
                            toast.success('Huella activada: la próxima vez entras con el dedo');
                          } else {
                            toast.error(res.error ?? 'No se ha podido activar la huella.');
                          }
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-purple-950/30 text-left transition-colors"
                        title="Registra la huella dactilar o el Face ID de este dispositivo para entrar sin contraseña"
                      >
                        <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Activar la huella</span>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-slate-800/80">
                      <button
                        id="privacidad-btn"
                        onClick={() => {
                          setDropdownOpen(false);
                          handleNav('/privacidad');
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 text-left transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Política de privacidad</span>
                      </button>
                      <button
                        id="eliminar-cuenta-btn"
                        onClick={() => {
                          setDropdownOpen(false);
                          handleNav('/eliminar-cuenta');
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 text-left transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Eliminar mi cuenta</span>
                      </button>
                      <button
                        id="logout-btn"
                        onClick={async () => {
                          setDropdownOpen(false);
                          await signOut();
                          handleNav('/login');
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 text-left transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{t('cerrar_sesion')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {menuMovilAbierto && (
            <nav
              id="menu-movil"
              className="sm:hidden space-y-1 border-t border-purple-900/30 px-1 pb-3 pt-3"
            >
              {navegacion.map(({ ruta, etiqueta, Icono, color }) => (
                <button
                  key={ruta}
                  onClick={() => {
                    setMenuMovilAbierto(false);
                    handleNav(ruta);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                    currentPath === ruta
                      ? 'border border-purple-800/40 bg-purple-950/60 text-white'
                      : 'text-slate-300 hover:bg-slate-900/50'
                  }`}
                >
                  <Icono className={`h-4 w-4 ${color}`} />
                  <span>{etiqueta}</span>
                </button>
              ))}

              <button
                id="menu-movil-privacidad"
                onClick={() => {
                  setMenuMovilAbierto(false);
                  handleNav('/privacidad');
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-900/50"
              >
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                <span>Política de privacidad</span>
              </button>
              {user && (
                <button
                  id="menu-movil-eliminar-cuenta"
                  onClick={() => {
                    setMenuMovilAbierto(false);
                    handleNav('/eliminar-cuenta');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-900/50"
                >
                  <Trash2 className="h-4 w-4 text-slate-400" />
                  <span>Eliminar mi cuenta</span>
                </button>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-purple-900/30 px-3.5 pb-1 pt-3">
                <span className="text-xs font-bold text-slate-400">Idioma</span>
                <div className="inline-flex items-center rounded-xl border border-purple-900/40 bg-[#141424] p-1">
                  <button
                    onClick={() => setIdioma('es')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      idioma === 'es'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ES
                  </button>
                  <button
                    onClick={() => setIdioma('en')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      idioma === 'en'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    EN
                  </button>
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Transparency / Privacy Modal */}
      <ComoSeProcesaModal 
        isOpen={showComoSeProcesa} 
        onClose={() => setShowComoSeProcesa(false)} 
      />
    </>
  );
};

export default AppNavbar;
