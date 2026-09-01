import React, { useState } from 'react';
import { 
  Video, 
  Sparkles, 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Flame 
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { SupabaseStatusBadge } from '../../../components/common/SupabaseStatusBadge';
import { toast } from 'sonner';

interface LoginPageProps {
  onNavigate?: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { signInWithEmail, signInWithMagicLink, signInWithGoogle, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const handleMagicLink = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Escribe primero tu email arriba para poder enviarte el enlace.');
      return;
    }
    setMagicLinkLoading(true);
    try {
      await signInWithMagicLink(email);
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Por favor ingresa tu email y contraseña.');
      return;
    }

    setLoading(true);
    const { error } = await signInWithEmail(email, password);
    setLoading(false);

    if (!error) {
      onNavigate?.('/dashboard');
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Versión de build para diagnóstico de caché */}
      <div className="absolute top-2 right-3 z-20 text-[10px] font-mono text-slate-600 select-none">
        build-20260901-3
      </div>
      <SupabaseStatusBadge />
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[450px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <button
          onClick={() => onNavigate?.('/')}
          className="inline-flex items-center gap-2.5 group focus:outline-none mb-6 p-1 rounded-xl"
        >
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-600/40 group-hover:scale-105 transition-transform duration-200">
            <Video className="w-5 h-5 text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full flex items-center justify-center animate-pulse">
              <Sparkles className="w-2 h-2 text-slate-950" />
            </div>
          </div>
          <span className="font-black text-2xl tracking-tight text-white flex items-center gap-1">
            Clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400">Forge</span>
          </span>
        </button>

        <h1 className="text-3xl font-black text-white tracking-tight sm:text-4xl">
          Iniciar Sesión
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Entra a tu cuenta para convertir videos largos en virales
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-[#121222]/90 backdrop-blur-xl border border-purple-900/40 py-8 px-6 shadow-2xl shadow-black/80 rounded-3xl sm:px-10">
          {/* Google OAuth Button */}
          <button
            id="google-login-btn"
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-700/80 rounded-xl bg-[#1a1a2e] hover:bg-[#22223c] text-sm font-semibold text-white shadow-sm hover:border-purple-500/50 transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                />
              </svg>
            )}
            <span>Continuar con Google</span>
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#121222] px-3 text-slate-500 font-bold tracking-wider">
                O con correo
              </span>
            </div>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="block w-full pl-10 pr-4 py-2.5 bg-[#0a0a14] border border-purple-900/40 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Contraseña
                </label>
                <a
                  href="#recuperar"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info('Ingresa tu email para restablecer la contraseña.');
                  }}
                  className="text-xs font-medium text-purple-400 hover:text-cyan-300 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-[#0a0a14] border border-purple-900/40 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/40 hover:shadow-purple-700/50 transition-all duration-200 cursor-pointer border border-purple-400/30 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <span>Entrar a ClipForge</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Magic Link (entrar sin contraseña) */}
          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#121222] px-3 text-slate-500 font-bold tracking-wider">
                  o entra sin contraseña
                </span>
              </div>
            </div>
            <button
              id="magic-link-btn"
              type="button"
              onClick={handleMagicLink}
              disabled={magicLinkLoading}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-cyan-300 bg-[#0a0a14] border border-cyan-500/40 hover:bg-[#0e1424] hover:border-cyan-400/60 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {magicLinkLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando enlace...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Recibir enlace de acceso por email</span>
                </>
              )}
            </button>
            <p className="mt-2 text-[11px] text-slate-500 text-center">
              Sin contraseñas: te mandamos un enlace a tu correo y entras con un clic.
            </p>
          </div>

          {/* Footer link to Register */}
          <div className="mt-6 text-center text-xs text-slate-400">
            ¿Aún no tienes cuenta?{' '}
            <button
              onClick={() => onNavigate?.('/registro')}
              className="font-bold text-purple-400 hover:text-cyan-300 transition-colors ml-1 cursor-pointer"
            >
              Crear cuenta gratis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
