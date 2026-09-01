import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase, getSupabaseEnv } from '../lib/supabase/client';
import type { Profile } from '../lib/supabase/types';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, nombre: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  // Fallback demo login for instant preview testing
  demoSignIn: (nombre?: string, email?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_DEMO_USER_KEY = 'clipforge_demo_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const isSupabaseConfigured = useMemo(() => {
    return getSupabaseEnv().isConfigured;
  }, []);


  // Fetch or create profile from Supabase
  const fetchProfile = async (userId: string, userEmail?: string, userMetaName?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile not found, insert fallback profile
        const newProfile: Profile = {
          id: userId,
          email: userEmail || null,
          nombre: userMetaName || (userEmail ? userEmail.split('@')[0] : 'Creador'),
          plan: 'gratis',
          marca_de_agua: true,
          created_at: new Date().toISOString(),
        };
        await supabase.from('profiles').insert([newProfile] as any);
        setProfile(newProfile);
        return;
      }

      if (data) {
        setProfile(data as unknown as Profile);
      }
    } catch (err) {
      console.warn('Error fetching Supabase profile:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            setUser(session.user);
            await fetchProfile(
              session.user.id,
              session.user.email,
              session.user.user_metadata?.nombre || session.user.user_metadata?.full_name
            );
          }
        } catch (e) {
          console.warn('Supabase auth getSession error:', e);
        }

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(
              session.user.id,
              session.user.email,
              session.user.user_metadata?.nombre || session.user.user_metadata?.full_name
            );
          } else {
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        });

        if (mounted) setLoading(false);
        return () => {
          authListener?.subscription.unsubscribe();
        };
      } else {
        // Check for local demo user session
        const stored = localStorage.getItem(LOCAL_STORAGE_DEMO_USER_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setUser(parsed.user);
            setProfile(parsed.profile);
          } catch {
            localStorage.removeItem(LOCAL_STORAGE_DEMO_USER_KEY);
          }
        }
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [isSupabaseConfigured]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      // Mock instant login for local preview
      const mockId = 'demo-user-' + Math.random().toString(36).substring(2, 8);
      const name = email.split('@')[0] || 'Creador';
      const demoUser = {
        id: mockId,
        email,
        app_metadata: {},
        user_metadata: { nombre: name },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User;

      const demoProfile: Profile = {
        id: mockId,
        email,
        nombre: name,
        plan: 'gratis',
        marca_de_agua: true,
        created_at: new Date().toISOString(),
      };

      setUser(demoUser);
      setProfile(demoProfile);
      localStorage.setItem(LOCAL_STORAGE_DEMO_USER_KEY, JSON.stringify({ user: demoUser, profile: demoProfile }));
      toast.success('¡Sesión iniciada con éxito!');
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (data.user) {
        toast.success('¡Bienvenido de nuevo a ClipForge!');
      }
      return { error: null };
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Error al iniciar sesión');
      return { error };
    }
  };

  const signUpWithEmail = async (email: string, password: string, nombre: string) => {
    if (!isSupabaseConfigured) {
      const mockId = 'demo-user-' + Math.random().toString(36).substring(2, 8);
      const demoUser = {
        id: mockId,
        email,
        app_metadata: {},
        user_metadata: { nombre },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User;

      const demoProfile: Profile = {
        id: mockId,
        email,
        nombre,
        plan: 'gratis',
        marca_de_agua: true,
        created_at: new Date().toISOString(),
      };

      setUser(demoUser);
      setProfile(demoProfile);
      localStorage.setItem(LOCAL_STORAGE_DEMO_USER_KEY, JSON.stringify({ user: demoUser, profile: demoProfile }));
      toast.success('¡Cuenta creada con éxito! Bienvenido a ClipForge.');
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre,
            full_name: nombre,
          },
        },
      });

      if (error) throw error;

      if (data.user && !data.session) {
        toast.info('Por favor revisa tu correo electrónico para confirmar tu cuenta.');
      } else {
        toast.success('¡Cuenta creada correctamente!');
      }
      return { error: null };
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Error al registrar usuario');
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      const mockId = 'google-user-' + Math.random().toString(36).substring(2, 8);
      const demoUser = {
        id: mockId,
        email: 'creador@google.com',
        app_metadata: {},
        user_metadata: { nombre: 'Creador Google' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User;

      const demoProfile: Profile = {
        id: mockId,
        email: 'creador@google.com',
        nombre: 'Creador Google',
        plan: 'gratis',
        marca_de_agua: true,
        created_at: new Date().toISOString(),
      };

      setUser(demoUser);
      setProfile(demoProfile);
      localStorage.setItem(LOCAL_STORAGE_DEMO_USER_KEY, JSON.stringify({ user: demoUser, profile: demoProfile }));
      toast.success('¡Sesión iniciada con Google!');
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Error al conectar con Google');
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    localStorage.removeItem(LOCAL_STORAGE_DEMO_USER_KEY);
    toast.info('Has cerrado sesión');
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return;
    if (isSupabaseConfigured) {
      await (supabase as any).from('profiles').update(data).eq('id', user.id);
    }
    setProfile((prev) => (prev ? { ...prev, ...data } : null));
    toast.success('Perfil actualizado');
  };

  const demoSignIn = (nombre = 'Alex Rivera', email = 'alex@creador.com') => {
    const mockId = 'demo-user-123';
    const demoUser = {
      id: mockId,
      email,
      app_metadata: {},
      user_metadata: { nombre },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User;

    const demoProfile: Profile = {
      id: mockId,
      email,
      nombre,
      plan: 'gratis',
      marca_de_agua: true,
      created_at: new Date().toISOString(),
    };

    setUser(demoUser);
    setProfile(demoProfile);
    localStorage.setItem(LOCAL_STORAGE_DEMO_USER_KEY, JSON.stringify({ user: demoUser, profile: demoProfile }));
    toast.success(`¡Sesión iniciada como ${nombre}!`);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isSupabaseConfigured,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        updateProfile,
        demoSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
