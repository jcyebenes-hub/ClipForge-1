-- ============================================================================
-- CLIPFORGE - ESQUEMA COMPLETO DE BASE DE DATOS (Supabase / PostgreSQL)
-- Ejecutar TODO este script en: Supabase Dashboard → SQL Editor → New query
-- Es idempotente: puedes ejecutarlo las veces que quieras sin romper nada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIÓN uuid (por si acaso)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 2. TABLA: profiles  (perfil público de cada usuario)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            TEXT PRIMARY KEY,
  email         TEXT,
  nombre        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  plan          TEXT DEFAULT 'gratis',
  marca_de_agua BOOLEAN DEFAULT TRUE
);

-- ----------------------------------------------------------------------------
-- 3. TABLA: proyectos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proyectos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  titulo         TEXT NOT NULL,
  nombre         TEXT,
  url_youtube    TEXT,
  archivo_nombre TEXT,
  video_url      TEXT,
  subtitulos_json JSONB,
  transcripcion  TEXT,
  estado         TEXT DEFAULT 'nuevo', -- nuevo | importando | transcrito | analizado | clips_listos | exportado
  duracion_seg   INTEGER DEFAULT 0,
  creado_en      TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. TABLA: clips
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clips (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id               UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  inicio_seg                REAL NOT NULL,
  fin_seg                   REAL NOT NULL,
  duracion_seg              REAL,
  puntuacion_viral          REAL DEFAULT 50,
  score_llm                 INTEGER,
  score_heuristica          INTEGER,
  razon                     TEXT,
  titulo_hook               TEXT DEFAULT '',
  cta                       TEXT,
  hashtags                  TEXT[] DEFAULT '{}',
  descripcion               TEXT,
  mejor_momento_primera_frase TEXT,
  titulos_sugeridos         TEXT[] DEFAULT '{}',
  ctas_sugeridos            TEXT[] DEFAULT '{}',
  hook_como_primer_subtitulo BOOLEAN DEFAULT TRUE,
  subtitulos_json           JSONB,
  video_url                 TEXT,
  video_vertical_url        TEXT,
  video_short_url           TEXT,
  texto_transcrito          TEXT,
  tipo_encuadre             TEXT DEFAULT 'smart_crop',
  estilo_subtitulos         TEXT DEFAULT 'hormozi',
  estado                    TEXT DEFAULT 'sugerido', -- sugerido | aprobado | renderizado | publicado
  creado_en                 TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. TABLA: configs_canal  (Automatización de canal de YouTube)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configs_canal (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 TEXT NOT NULL,
  url_canal_youtube       TEXT,
  canal_id                TEXT,
  canal_nombre            TEXT,
  activo                  BOOLEAN DEFAULT TRUE,
  auto_crear_shorts       BOOLEAN DEFAULT FALSE,
  auto_publicar           BOOLEAN DEFAULT FALSE,
  estilo_predeterminado   TEXT DEFAULT 'hormozi',
  frecuencia_publicacion  TEXT DEFAULT 'diaria',
  ultima_video_id         TEXT,
  creado_en               TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. TABLA: uso_usuario  (rate limiting anti-abuso)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uso_usuario (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT,
  ip_hash          TEXT NOT NULL,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  transcribir_count INTEGER DEFAULT 0,
  analizar_count   INTEGER DEFAULT 0,
  exportar_count   INTEGER DEFAULT 0,
  min_datos        NUMERIC DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fecha, ip_hash)
);

-- ----------------------------------------------------------------------------
-- 7. TABLA: publicaciones_programadas  (calendario multicanal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.publicaciones_programadas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  clip_id          TEXT,
  proyecto_id      TEXT,
  titulo           TEXT NOT NULL,
  descripcion      TEXT,
  plataforma       TEXT NOT NULL, -- youtube | tiktok | instagram
  fecha_programada TIMESTAMPTZ NOT NULL,
  estado           TEXT DEFAULT 'programado', -- programado | publicado | error
  error_mensaje    TEXT,
  publicado_en     TIMESTAMPTZ,
  video_url        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. TABLA: user_oauth  (tokens de YouTube / TikTok / Instagram cifrados)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_oauth (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'youtube', -- youtube | tiktok | instagram
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

-- ----------------------------------------------------------------------------
-- 9. ÍNDICES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_proyectos_user_id     ON public.proyectos (user_id);
CREATE INDEX IF NOT EXISTS idx_clips_proyecto_id     ON public.clips (proyecto_id);
CREATE INDEX IF NOT EXISTS idx_configs_canal_user    ON public.configs_canal (user_id);
CREATE INDEX IF NOT EXISTS idx_pub_programadas_user  ON public.publicaciones_programadas (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user_provider   ON public.user_oauth (user_id, provider);
CREATE INDEX IF NOT EXISTS idx_uso_usuario_fecha_ip  ON public.uso_usuario (fecha, ip_hash);

-- ----------------------------------------------------------------------------
-- 10. TRIGGER: crear 'profiles' automáticamente al registrarse
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre)
  VALUES (
    NEW.id::TEXT,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'usuario'), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 11. TRIGGER: actualizar 'actualizado_en' automáticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_proyectos ON public.proyectos;
CREATE TRIGGER set_updated_at_proyectos
  BEFORE UPDATE ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) — cada usuario solo ve/edita lo suyo
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configs_canal           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_usuario             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones_programadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_oauth              ENABLE ROW LEVEL SECURITY;

-- profiles: el usuario gestiona su propio perfil
DROP POLICY IF EXISTS "Perfil visible para su dueño" ON public.profiles;
CREATE POLICY "Perfil visible para su dueño"
  ON public.profiles FOR SELECT
  USING (auth.uid()::TEXT = id);
DROP POLICY IF EXISTS "Perfil editable por su dueño" ON public.profiles;
CREATE POLICY "Perfil editable por su dueño"
  ON public.profiles FOR UPDATE
  USING (auth.uid()::TEXT = id);
DROP POLICY IF EXISTS "Perfil creado al registrarse" ON public.profiles;
CREATE POLICY "Perfil creado al registrarse"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid()::TEXT = id);

-- proyectos
DROP POLICY IF EXISTS "Proyectos visibles para su dueño" ON public.proyectos;
CREATE POLICY "Proyectos visibles para su dueño"
  ON public.proyectos FOR SELECT
  USING (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Proyectos insertables por su dueño" ON public.proyectos;
CREATE POLICY "Proyectos insertables por su dueño"
  ON public.proyectos FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Proyectos editables por su dueño" ON public.proyectos;
CREATE POLICY "Proyectos editables por su dueño"
  ON public.proyectos FOR UPDATE
  USING (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Proyectos borrables por su dueño" ON public.proyectos;
CREATE POLICY "Proyectos borrables por su dueño"
  ON public.proyectos FOR DELETE
  USING (auth.uid()::TEXT = user_id);

-- clips (a través del proyecto)
DROP POLICY IF EXISTS "Clips visibles para su dueño" ON public.clips;
CREATE POLICY "Clips visibles para su dueño"
  ON public.clips FOR SELECT
  USING (
    auth.uid()::TEXT IN (
      SELECT user_id FROM public.proyectos WHERE id = clips.proyecto_id
    )
  );
DROP POLICY IF EXISTS "Clips insertables por su dueño" ON public.clips;
CREATE POLICY "Clips insertables por su dueño"
  ON public.clips FOR INSERT
  WITH CHECK (
    auth.uid()::TEXT IN (
      SELECT user_id FROM public.proyectos WHERE id = clips.proyecto_id
    )
  );
DROP POLICY IF EXISTS "Clips editables por su dueño" ON public.clips;
CREATE POLICY "Clips editables por su dueño"
  ON public.clips FOR UPDATE
  USING (
    auth.uid()::TEXT IN (
      SELECT user_id FROM public.proyectos WHERE id = clips.proyecto_id
    )
  );
DROP POLICY IF EXISTS "Clips borrables por su dueño" ON public.clips;
CREATE POLICY "Clips borrables por su dueño"
  ON public.clips FOR DELETE
  USING (
    auth.uid()::TEXT IN (
      SELECT user_id FROM public.proyectos WHERE id = clips.proyecto_id
    )
  );

-- configs_canal
DROP POLICY IF EXISTS "Canales visibles para su dueño" ON public.configs_canal;
CREATE POLICY "Canales visibles para su dueño"
  ON public.configs_canal FOR SELECT
  USING (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Canales insertables por su dueño" ON public.configs_canal;
CREATE POLICY "Canales insertables por su dueño"
  ON public.configs_canal FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Canales editables por su dueño" ON public.configs_canal;
CREATE POLICY "Canales editables por su dueño"
  ON public.configs_canal FOR UPDATE
  USING (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Canales borrables por su dueño" ON public.configs_canal;
CREATE POLICY "Canales borrables por su dueño"
  ON public.configs_canal FOR DELETE
  USING (auth.uid()::TEXT = user_id);

-- uso_usuario (rate limiting: cualquier usuario autenticado puede insertar)
DROP POLICY IF EXISTS "Uso insertable por todos" ON public.uso_usuario;
CREATE POLICY "Uso insertable por todos"
  ON public.uso_usuario FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Uso editable por todos" ON public.uso_usuario;
CREATE POLICY "Uso editable por todos"
  ON public.uso_usuario FOR UPDATE
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Uso visible para su dueño" ON public.uso_usuario;
CREATE POLICY "Uso visible para su dueño"
  ON public.uso_usuario FOR SELECT
  USING (auth.uid()::TEXT = user_id OR (user_id IS NULL AND ip_hash IS NOT NULL));

-- publicaciones_programadas
DROP POLICY IF EXISTS "Publicaciones visibles para su dueño" ON public.publicaciones_programadas;
CREATE POLICY "Publicaciones visibles para su dueño"
  ON public.publicaciones_programadas FOR SELECT
  USING (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Publicaciones insertables por su dueño" ON public.publicaciones_programadas;
CREATE POLICY "Publicaciones insertables por su dueño"
  ON public.publicaciones_programadas FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Publicaciones editables por su dueño" ON public.publicaciones_programadas;
CREATE POLICY "Publicaciones editables por su dueño"
  ON public.publicaciones_programadas FOR UPDATE
  USING (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "Publicaciones borrables por su dueño" ON public.publicaciones_programadas;
CREATE POLICY "Publicaciones borrables por su dueño"
  ON public.publicaciones_programadas FOR DELETE
  USING (auth.uid()::TEXT = user_id);

-- user_oauth
DROP POLICY IF EXISTS "OAuth visible para su dueño" ON public.user_oauth;
CREATE POLICY "OAuth visible para su dueño"
  ON public.user_oauth FOR SELECT
  USING (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "OAuth insertable por su dueño" ON public.user_oauth;
CREATE POLICY "OAuth insertable por su dueño"
  ON public.user_oauth FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "OAuth editable por su dueño" ON public.user_oauth;
CREATE POLICY "OAuth editable por su dueño"
  ON public.user_oauth FOR UPDATE
  USING (auth.uid()::TEXT = user_id);
DROP POLICY IF EXISTS "OAuth borrable por su dueño" ON public.user_oauth;
CREATE POLICY "OAuth borrable por su dueño"
  ON public.user_oauth FOR DELETE
  USING (auth.uid()::TEXT = user_id);

-- ----------------------------------------------------------------------------
-- 13. STORAGE: bucket 'media' para vídeos originales y clips
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', FALSE)
ON CONFLICT (id) DO NOTHING;

-- El usuario autenticado puede subir archivos solo a SU carpeta {user_id}/...
DROP POLICY IF EXISTS "Subir a mi carpeta" ON storage.objects;
CREATE POLICY "Subir a mi carpeta"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Descargar de mi carpeta" ON storage.objects;
CREATE POLICY "Descargar de mi carpeta"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Actualizar en mi carpeta" ON storage.objects;
CREATE POLICY "Actualizar en mi carpeta"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Borrar en mi carpeta" ON storage.objects;
CREATE POLICY "Borrar en mi carpeta"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ----------------------------------------------------------------------------
-- 14. COMPROBACIÓN RÁPIDA (debe devolver 7 filas: una por tabla)
-- ----------------------------------------------------------------------------
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles','proyectos','clips','configs_canal','uso_usuario','publicaciones_programadas','user_oauth')
ORDER BY tablename;
