-- ============================================================================
-- CLIPFORGE - Tabla de analítica 'eventos'
-- ============================================================================
-- src/lib/analytics.ts inserta en public.eventos (trackLandingVisit, etc.), pero
-- el esquema original (0001_schema_completo.sql) no la creaba, lo que producía un
-- HTTP 404 en /rest/v1/eventos cada vez que se cargaba la landing.
--
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase (Project -> SQL
-- Editor -> New query -> pegar -> Run). Es idempotente (IF NOT EXISTS).
-- ============================================================================

create table if not exists public.eventos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  ruta        text not null default '/',
  user_id     uuid references auth.users(id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  fecha       timestamptz not null default now()
);

-- Índice para las consultas por tipo y por día del dashboard de estadísticas.
create index if not exists eventos_tipo_fecha_idx on public.eventos (tipo, fecha desc);
create index if not exists eventos_user_idx       on public.eventos (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.eventos enable row level security;

-- Cualquier visitante (anónimo o logueado) puede REGISTRAR telemetría.
-- Es una tabla de escritura: no se lee desde el cliente con anon key.
create policy "eventos_insert_publica"
  on public.eventos for insert
  to anon, authenticated
  with check (true);

-- Solo el propio usuario (o el service_role, que ignora RLS) puede leer sus eventos.
create policy "eventos_select_propio"
  on public.eventos for select
  to authenticated
  using (auth.uid() = user_id);
