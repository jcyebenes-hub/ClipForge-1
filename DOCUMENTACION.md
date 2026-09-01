# Documentación Técnica y Guía de Despliegue de ClipForge

**ClipForge** es una plataforma integral para creadores de contenido que convierte vídeos largos (podcast, entrevistas, directos o tutoriales) en **Shorts, Reels y TikToks virales** de forma automatizada mediante Inteligencia Artificial gratuita y procesamiento en el cliente.

---

## 1. Arquitectura General del Sistema

El ecosistema de ClipForge está estructurado en 4 capas desacopladas y de alta eficiencia:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIPFORGE FRONTEND (React 18 + Vite / Tailwind)│
│  - Editor de Clips Multiformato (Reencuadre 9:16, Split 50/50, Blur)   │
│  - Renderizado y Animación de Subtítulos (Karaoke, Hormozi, MrBeast)   │
│  - Pipeline WASM FFmpeg en el Navegador (Procesamiento Gratuito)       │
│  - Centro de Distribución y Calendario Multicanal                      │
└───────────────────▲────────────────────────────────┬───────────────────┘
                    │                                │
                    │ Peticiones API                 │ Persistencia & Auth
                    ▼                                ▼
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│       NEXT.JS / VITE API ROUTES      │   │     SUPABASE (Backend BaaS) │
│  - /api/transcribir (Groq Whisper v3)│   │  - PostgreSQL + RLS         │
│  - /api/analizar (Llama 3.3 70B)     │   │  - Supabase Auth (OAuth/JWT)│
│  - /api/traducir (Multiidioma)       │   │  - Supabase Storage         │
│  - /api/cron/* (Vercel Crons)        │   │    ('videos-raw', 'shorts') │
│  - /api/youtube/*, /api/tiktok/*     │   │  - Rate Limiting (uso_user) │
└───────────────────▲──────────────────┘   └─────────────────────────────┘
                    │ Descarga de vídeos
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            YOUTUBE WORKER MICROSERVICE (FastAPI + yt-dlp)               │
│  - Desplegado en Render / Railway / Docker                             │
│  - Extracción de audio/vídeo y metadatos sin saturar la app principal  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Esquema de Base de Datos (Supabase SQL)

Ejecuta el siguiente script en el **SQL Editor** de tu proyecto Supabase:

```sql
-- 1. Tabla de Proyectos
CREATE TABLE IF NOT EXISTS public.proyectos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  url_youtube TEXT,
  archivo_nombre TEXT,
  duracion_seg INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'nuevo', -- 'nuevo' | 'procesando' | 'completado' | 'error'
  subtitulos_json JSONB,
  storage_path TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Clips Virales
CREATE TABLE IF NOT EXISTS public.clips (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  t_inicio REAL NOT NULL,
  t_fin REAL NOT NULL,
  duracion_seg REAL NOT NULL,
  titulo_hook TEXT NOT NULL,
  descripcion TEXT,
  hashtags TEXT[],
  score_viral INTEGER DEFAULT 80,
  score_llm INTEGER,
  score_heuristica INTEGER,
  razon TEXT,
  cta TEXT,
  subtitulos_segmento JSONB,
  tipo_encuadre TEXT DEFAULT 'smart_crop', -- 'smart_crop' | 'fit_blur' | 'split_facecam'
  estilo_subtitulos TEXT DEFAULT 'hormozi',
  estado TEXT DEFAULT 'sugerido', -- 'sugerido' | 'aprobado' | 'renderizado' | 'publicado'
  video_short_url TEXT,
  video_vertical_url TEXT,
  preview_url TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Control de Uso y Rate Limiting
CREATE TABLE IF NOT EXISTS public.uso_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  ip_hash TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  transcribir_count INTEGER DEFAULT 0,
  analizar_count INTEGER DEFAULT 0,
  exportar_count INTEGER DEFAULT 0,
  min_datos NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, ip_hash)
);

-- 4. Tabla de Publicaciones Programadas
CREATE TABLE IF NOT EXISTS public.publicaciones_programadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  clip_id TEXT NOT NULL,
  proyecto_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  plataforma TEXT NOT NULL, -- 'youtube' | 'tiktok' | 'instagram'
  fecha_programada TIMESTAMPTZ NOT NULL,
  estado TEXT DEFAULT 'programado', -- 'programado' | 'publicado' | 'error'
  error_mensaje TEXT,
  publicado_en TIMESTAMPTZ,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Configuración de Canales Automatizados
CREATE TABLE IF NOT EXISTS public.configs_canal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  canal_id TEXT NOT NULL,
  canal_nombre TEXT,
  auto_crear_shorts BOOLEAN DEFAULT FALSE,
  auto_publicar BOOLEAN DEFAULT FALSE,
  estilo_predeterminado TEXT DEFAULT 'hormozi',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones_programadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configs_canal ENABLE ROW LEVEL SECURITY;
```

---

## 3. Despliegue del Microservicio Worker de YouTube en Render

1. Crea un nuevo **Web Service** en [Render.com](https://render.com).
2. Conecta tu repositorio con el código Python FastAPI (`worker/main.py`) o utiliza la imagen Docker:
   - **Environment**: `Python 3` o `Docker`.
   - **Build Command**: `pip install -r requirements.txt && apt-get update && apt-get install -y ffmpeg`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Copia la URL pública generada (ejemplo: `https://clipforge-worker.onrender.com`).
4. Configura dicha URL en la variable `YT_WORKER_URL` de tu frontend.

---

## 4. Guía de Despliegue en Vercel (Paso a Paso)

### Paso 1: Subir cambios a tu repositorio Git
```bash
git add .
git commit -m "feat: preparar proyecto para despliegue en produccion con crons y seguridad"
git push origin main
```

### Paso 2: Importar el proyecto en Vercel
1. Ingresa en [vercel.com/dashboard](https://vercel.com/dashboard).
2. Haz clic en **"Add New..."** → **"Project"**.
3. Selecciona tu repositorio de GitHub / GitLab.
4. En **Framework Preset**, selecciona `Vite` o `Next.js` (detectado automáticamente).

### Paso 3: Configurar Variables de Entorno en Vercel
Ve a **Settings** → **Environment Variables** en Vercel y añade:

| Variable | Valor de Ejemplo / Descripción |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xyzproject.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsIn...` (clave anónima pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsIn...` (clave de servicio privada) |
| `GROQ_API_KEY` | `gsk_...` (Clave de Groq para Whisper y Llama 3.3) |
| `YT_WORKER_URL` | `https://clipforge-worker.onrender.com` |
| `GOOGLE_CLIENT_ID` | `123456...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` |
| `OAUTH_ENCRYPTION_SECRET` | Cadena aleatoria de 32 caracteres para cifrado AES-256 |
| `CRON_SECRET` | Cadena secreta para asegurar las tareas programadas |
| `APP_URL` | `https://tu-proyecto.vercel.app` |

### Paso 4: Desplegar
Haz clic en el botón **"Deploy"**. Vercel compilará la aplicación y configurará automáticamente los cron jobs descritos en `vercel.json`.

---

## 5. Solución de Problemas Comunes en Producción

### 1. Cross-Origin Isolation para FFmpeg WASM
- **Síntoma**: Error `SharedArrayBuffer is not defined` al recortar vídeos localmente con `@ffmpeg/ffmpeg`.
- **Solución implementada**: `vercel.json` y `vite.config.ts` inyectan automáticamente las cabeceras `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`.

### 2. Timeouts en Descargas Largas de YouTube
- **Síntoma**: Timeouts HTTP 504 en Vercel Serverless (límite de 10s–60s).
- **Solución implementada**: El worker externo en Render procesa las descargas de vídeos pesados de forma asíncrona mediante streaming directo a Supabase Storage.

### 3. Rate Limiting y Abuso
- **Protección**: 5 transcripciones/hora, 10 análisis/hora y 20 exportaciones/día por IP/Usuario. Devuelve código HTTP 429 con mensaje explicativo y tiempo de desbloqueo.

---

## 6. Mantenimiento y Crons Automáticos

- **`/api/cron/vigilar-canal` (Cada hora - `0 * * * *`)**: Comprueba automáticamente canales de YouTube suscritos para importar nuevos vídeos y generar borradores.
- **`/api/cron/publicar` (Cada 10 min - `*/10 * * * *`)**: Publica los clips agendados en el calendario que hayan cumplido su hora fijada.
