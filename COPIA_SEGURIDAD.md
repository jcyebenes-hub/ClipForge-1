# ClipForge — Copia de seguridad / documento de traspaso para IA

> Pegad este archivo (o adjuntadlo) a un agente de Arena.ai para retomar el proyecto.
> Última actualización: 2026-09-02 · HEAD del repo: `b489684` · árbol de trabajo limpio.

## 1. Qué es
**ClipForge** es una app web que, a partir de un vídeo de YouTube, obtiene los subtítulos,
los analiza con IA (Groq) y genera clips, ganchos y traducciones. Frontend **Vite + React + TS**,
backend **Express** (`server.ts`, Node 20) que sirve la API y adapta rutas estilo Next
(`src/app/api/.../route.ts`).

- **Repositorio:** https://github.com/jcyebenes-hub/ClipForge-1 (rama `main`)
- **Producción (Render):** https://clipforge-7hdq.onrender.com
  - Servicio: `clipforge` · id `srv-dabjm2rm8hqs73e39f7g` · región **frankfurt** · free tier · `autoDeploy: true`
- **Worker de Cloudflare (subtítulos):** https://clipforge-yt-captions.jcyebenes.workers.dev
  - Código en `worker/yt-captions/worker.js`. Esquiva (a medias) el bloqueo anti-bots de YouTube.

## 2. Dónde están los secretos (NO están en este documento)
- **`.env`** en la raíz del repo (está en `.gitignore`, NO se sube). Contiene:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VITE_NEXT_PUBLIC_SUPABASE_URL`,
  `VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`.
- **Render → Environment** (mismas 5 + `YT_CAPTIONS_WORKER_URL`).
- **Cloudflare Worker:** secreto opcional `WORKER_SECRET` (ahora mismo NO activado).
- Valores de Supabase/Groq se sacan de sus dashboards. La URL/clave de Supabase y la key de Groq
  están también anotadas en `CREDENCIALES.md` (si existe en el workspace).

## 3. Cómo arrancar en local
```bash
cd ClipForge-1
npm install          # node_modules NO persiste entre sesiones del agente
npm run dev          # Vite (3000) + Express (3100) vía scripts/dev.mjs
```
- Para ejecutar código de `src/lib` bajo Node/tsx, importar primero `src/lib/polyfills/ws-node`
  (Node 20 no tiene WebSocket nativo).
- `npm run lint` = `tsc --noEmit`. `npm run build` = `tsc -b && vite build`.

## 4. Cómo desplegar
- **App (Render):** `git push origin main` → Render redepliega solo. Tarda ~3-6 min.
  - Cambiar variables de entorno por la API de Render NO reinicia; hay que disparar deploy:
    `POST https://api.render.com/v1/services/srv-dabjm2rm8hqs73e39f7g/deploys`.
- **Worker (Cloudflare):** desde `worker/yt-captions/`:
  ```bash
  export CLOUDFLARE_API_TOKEN=...   # token con permiso "Workers Scripts: Edit"
  export CLOUDFLARE_ACCOUNT_ID=0e0c1c21dbf4326056967a35d32b8569
  npx wrangler@3 deploy            # wrangler@4 exige Node 22; el sandbox tiene Node 20 -> usar @3
  ```

## 5. Estado actual (qué funciona y qué no)
**Funciona (verificado en producción):**
- Login con Supabase; badge "Supabase conectado".
- Métricas **100% reales** (sin números inventados): visitas/clics/errores desde localStorage,
  proyectos desde la tabla `proyectos`, clips exportados desde eventos reales. (`src/lib/analytics.ts`)
- Pipeline con Groq real: analizar, ganchos, traducir.
- Extracción del ID de YouTube robusta (watch?v=, youtu.be, /shorts/, /live/, /embed/, /v/). (commit `b489684`)
- Transcripción vía subtítulos de YouTube, con fallback al Worker de Cloudflare.

**Limitación conocida (NO es bug nuestro):**
- YouTube **bloquea IPs de centro de datos de forma intermitente**. Desde Render (y a veces desde el
  colo de Cloudflare más cercano) la transcripción falla con `YT_BOT_BLOCKED` o `NO_CAPTIONS` aunque el
  vídeo tenga subtítulos. Desde una **IP residencial (local)** funciona siempre. Es el anti-bots de YouTube.
- Vídeos **sin subtítulos** (p. ej. algunos directos) no se pueden transcribir por esta vía.

## 6. Tareas pendientes / backlog
- **Migración `eventos` sin aplicar** en Supabase (SQL Editor): `supabase/migrations/20260902_add_eventos_table.sql`.
- **Revocar claves** usadas por el agente: token de GitHub (`ghp_...`), clave de Render (`rnd_...`),
  token de Cloudflare (`cfut_...`).
- Opcional: activar `WORKER_SECRET` en el Worker + `YT_CAPTIONS_WORKER_SECRET` en Render.
- Opcional: reintentos automáticos del Worker (mejora parcial del bloqueo); Whisper (Groq) para vídeos
  sin subtítulos (bajando el audio); proxy residencial (de pago) para fiabilidad total en servidor.
- Google OAuth / Supabase service-role para pruebas autenticadas (ahora mismo no hay acceso service-role).

## 7. Mapa de archivos clave
- `server.ts` — servidor Express; `adapt()` convierte `route.ts` a Express. **Ojo:** su catch de 500
  devuelve "Error interno del servidor"; si un handler lanza, sale ese mensaje.
- `src/lib/youtubeApi.ts` — `probarClientes` (InnerTube), `fetchVttCapitulos`, `parseVttATranscripcion`.
- `src/app/api/youtube/transcribir/route.ts` — transcripción directa + fallback al Worker
  (`transcribirViaWorker`, usa `YT_CAPTIONS_WORKER_URL`).
- `src/app/api/youtube/info/route.ts` — metadatos reales de YouTube.
- `src/app/api/{analizar,hooks,traducir}/route.ts` — IA con Groq. **Van atados a proyecto/clip**
  (piden `proyecto_id`/`clip_id`/`subtitulos`); no son de texto libre.
- `src/lib/analytics.ts` — métricas reales.
- `worker/yt-captions/worker.js` — Worker de Cloudflare (InnerTube + fmt=vtt). Contrato:
  `POST /transcribir {url}` → `{ok, segments, language, duration, text, ...}`.

## 8. Cosas que NO hay que repetir (aprendido)
- NO inventar métricas ni usar suelos/`Math.max`/series aleatorias.
- NO hacer signup de prueba en Supabase (dominio restringido + confirmación por email → 429).
- El modelo `llama-3.3-70b-versatile` ya no existe en Groq → usar la cadena de respaldo de `groqChat`.
- `wrangler@latest` exige Node 22 (el sandbox tiene 20) → usar `wrangler@3`.
- En `fetch()`, NO llamar a una constante local `URL` (sombrea la global y rompe el parseo).
- Al devolver una `Response` cuyo body ya se leyó (`.json()`), el `adapt()` de `server.ts` lanza
  ("body used") → 500. Reconstruir la Response en vez de reutilizarla.
