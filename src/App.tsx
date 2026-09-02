import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { YouTubeAuthProvider } from './context/YouTubeAuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotFound } from './components/common/NotFound';
import LandingPage from './app/(landing)/page';
import LoginPage from './app/(auth)/login/page';
import AppNavbar from './components/layout/AppNavbar';
import { trackLandingVisit } from './lib/analytics';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

/**
 * CARGA PEREZOSA DE LAS PÁGINAS DEL DASHBOARD
 * -------------------------------------------
 * Landing y Login se importan de forma estática: son la puerta de entrada y no
 * deben esperar a ningún chunk extra.
 *
 * El resto se carga con React.lazy() porque arrastran dependencias muy pesadas
 * que antes iban todas dentro del bundle inicial:
 *   - ClipsProcesadorPage / ClipEditarPage → src/lib/encuadre.ts, que importa
 *     @mediapipe/tasks-vision (detección facial) y @ffmpeg/util.
 *   - EstadisticasPage → recharts.
 * Con esto la landing se descarga sin pagar el coste del editor de vídeo.
 */
const RegistroPage = lazy(() => import('./app/(auth)/registro/page'));
const DashboardPage = lazy(() => import('./app/(app)/dashboard/page'));
const NuevoProyectoPage = lazy(() => import('./app/(app)/dashboard/nuevo/page'));
const ProyectoDetallePage = lazy(() => import('./app/(app)/dashboard/proyecto/page'));
const ClipsProcesadorPage = lazy(
  () => import('./app/(app)/dashboard/proyecto/[id]/clips/page')
);
const ClipEditarPage = lazy(
  () => import('./app/(app)/dashboard/proyecto/[id]/clips/[clipId]/editar/page')
);
const PublicarPage = lazy(() => import('./app/(app)/dashboard/publicar/page'));
const EstadisticasPage = lazy(() => import('./app/(app)/dashboard/estadisticas/page'));

/** Spinner reutilizado tanto para el chequeo de auth como para Suspense. */
function Cargando({ texto = 'Cargando ClipForge...' }: { texto?: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-purple-400">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs font-semibold text-slate-400">{texto}</span>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      return pathname || '/';
    }
    return '/';
  });

  const navigate = (path: string) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (currentPath === '/') {
      trackLandingVisit();
    }
  }, [currentPath]);

  // Show loading spinner during initial auth check
  if (loading) {
    return <Cargando />;
  }

  /**
   * Resuelve la ruta actual a su componente. Se extrae a una función para poder
   * envolverla en un único <Suspense> (los early returns de antes no lo permitían).
   * La lógica de rutas no cambia.
   */
  function renderRuta() {
    // Protected Route Check for /dashboard
    const isDashboardRoute = currentPath.startsWith('/dashboard');
    if (isDashboardRoute && !user) {
      return <LoginPage onNavigate={navigate} />;
    }

    // If user is logged in and visits /login or /registro, redirect to /dashboard
    if ((currentPath === '/login' || currentPath === '/registro') && user) {
      return (
        <div className="min-h-screen bg-[#0a0a12] flex flex-col">
          <AppNavbar currentPath="/dashboard" onNavigate={navigate} />
          <DashboardPage onNavigate={navigate} />
        </div>
      );
    }

    // Routing Switch
    if (currentPath === '/login') {
      return <LoginPage onNavigate={navigate} />;
    }

    if (currentPath === '/registro') {
      return <RegistroPage onNavigate={navigate} />;
    }

    if (currentPath === '/dashboard/nuevo') {
      return (
        <div className="min-h-screen bg-[#0a0a12] flex flex-col">
          <AppNavbar currentPath="/dashboard/nuevo" onNavigate={navigate} />
          <NuevoProyectoPage onNavigate={navigate} />
        </div>
      );
    }

    if (currentPath === '/dashboard/publicar' || currentPath.startsWith('/dashboard/publicar')) {
      return (
        <div className="min-h-screen bg-[#0a0a12] flex flex-col">
          <AppNavbar currentPath="/dashboard/publicar" onNavigate={navigate} />
          <PublicarPage onNavigate={navigate} />
        </div>
      );
    }

    if (currentPath === '/dashboard/estadisticas') {
      return (
        <div className="min-h-screen bg-[#0a0a12] flex flex-col">
          <AppNavbar currentPath="/dashboard/estadisticas" onNavigate={navigate} />
          <EstadisticasPage onNavigate={navigate} />
        </div>
      );
    }

    if (currentPath.startsWith('/dashboard/proyecto')) {
      const parts = currentPath.split('/');
      const projId = parts[3] || '';
      const isClipsRoute = parts[4] === 'clips' || currentPath.includes('/clips');
      const isEditClipRoute = isClipsRoute && parts[5] && (parts[6] === 'editar' || parts[6] === 'edit' || currentPath.includes('/editar'));

      if (isEditClipRoute) {
        const clipId = parts[5];
        return (
          <div className="min-h-screen bg-[#0a0a12] flex flex-col">
            <AppNavbar currentPath="/dashboard" onNavigate={navigate} />
            <ClipEditarPage proyectoId={projId} clipId={clipId} onNavigate={navigate} />
          </div>
        );
      }

      if (isClipsRoute) {
        return (
          <div className="min-h-screen bg-[#0a0a12] flex flex-col">
            <AppNavbar currentPath="/dashboard" onNavigate={navigate} />
            <ClipsProcesadorPage proyectoId={projId} onNavigate={navigate} />
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#0a0a12] flex flex-col">
          <AppNavbar currentPath="/dashboard" onNavigate={navigate} />
          <ProyectoDetallePage proyectoId={projId} onNavigate={navigate} />
        </div>
      );
    }

    if (currentPath === '/dashboard') {
      return (
        <div className="min-h-screen bg-[#0a0a12] flex flex-col">
          <AppNavbar currentPath="/dashboard" onNavigate={navigate} />
          <DashboardPage onNavigate={navigate} />
        </div>
      );
    }

    if (currentPath === '/') {
      return <LandingPage onNavigate={navigate} />;
    }

    // 404 Not Found Page for any unhandled routes
    return <NotFound onNavigate={navigate} />;
  }

  return <Suspense fallback={<Cargando texto="Cargando sección..." />}>{renderRuta()}</Suspense>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <YouTubeAuthProvider>
            <Toaster 
              theme="dark" 
              position="top-right" 
              richColors 
              toastOptions={{
                style: {
                  background: '#121222',
                  border: '1px solid rgba(147, 51, 234, 0.4)',
                  color: '#f8fafc',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                },
              }}
            />
            <AppRouter />
          </YouTubeAuthProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
