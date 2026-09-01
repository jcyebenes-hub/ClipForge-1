import { createServerClient } from '@supabase/ssr';

export interface NextRequestLike {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
    set: (name: string, value: string, options?: Record<string, unknown>) => void;
  };
  nextUrl: {
    pathname: string;
    clone: () => {
      pathname: string;
      searchParams: { set: (key: string, val: string) => void };
      toString: () => string;
    };
  };
  url: string;
}

export interface NextResponseLike {
  cookies: {
    set: (name: string, value: string, options?: Record<string, unknown>) => void;
  };
  headers: Headers;
  status: number;
}

/**
 * Middleware para Next.js / Edge runtime que verifica sesiones activas de Supabase
 * y protege las rutas privadas como /dashboard
 */
export async function middleware(request: NextRequestLike) {
  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || '';
  const supabaseAnonKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 200 };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          request.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/registro');

  // If trying to access dashboard without a session, redirect to /login
  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return {
      redirect: url.toString(),
      status: 307,
    };
  }

  // If user is already authenticated and visits login/registro, redirect to dashboard
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return {
      redirect: url.toString(),
      status: 307,
    };
  }

  return { status: 200 };
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
