import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { YouTubeAuthProvider } from './context/YouTubeAuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotFound } from './components/common/NotFound';
import LandingPage from './app/(landing)/page';
import LoginPage from './app/(auth)/login/page';
import RegistroPage from './app/(auth)/registro/page';
import DashboardPage from './app/(app)/dashboard/page';
import NuevoProyectoPage from './app/(app)/dashboard/nuevo/page';
import ProyectoDetallePage from './app/(app)/dashboard/proyecto/page';
import ClipsProcesadorPage from './app/(app)/dashboard/proyecto/[id]/clips/page';
import ClipEditarPage from './app/(app)/dashboard/proyecto/[id]/clips/[clipId]/editar/page';
import PublicarPage from './app/(app)/dashboard/publicar/page';
import EstadisticasPage from './app/(app)/dashboard/estadisticas/page';
import AppNavbar from './components/layout/AppNavbar';
import { trackLandingVisit } from './lib/analytics';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

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
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-purple-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-xs font-semibold text-slate-400">Cargando ClipForge...</span>
        </div>
      </div>
    );
  }

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
