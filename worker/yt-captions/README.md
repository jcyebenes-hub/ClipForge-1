# Worker de Cloudflare — subtítulos de YouTube

Render (IP de centro de datos) es bloqueado por la protección anti-bots de YouTube al
pedir subtítulos, por eso a veces sale "YouTube ha bloqueado el acceso desde este
servidor". Este Worker hace la misma petición desde la red de Cloudflare (que
normalmente no se bloquea) y se la devuelve a la app.

La app ya lo usa: si defines `YT_CAPTIONS_WORKER_URL` en Render, `/api/youtube/transcribir`
intenta primero en directo y, si YouTube bloquea, delega en este Worker automáticamente.

## Qué hace
- `POST {URL}/transcribir` con `{ url }` → devuelve `{ ok, segments, language, duration, text, titulo_video, video_id, url_youtube }`.
- `GET {URL}/health` → `{ ok:true }`.
- Usa InnerTube + `fmt=vtt` (el mismo método que la app), no scrapea la página watch.

---

## Opción A — Dashboard de Cloudflare (la más fácil, sin instalar nada)

1. Entra en https://dash.cloudflare.com/ (crea una cuenta gratis si no tienes).
2. Menú lateral → **Workers & Pages** → **Create** → pestaña **Worker** → **Create Worker**.
3. Ponle un nombre, p. ej. `clipforge-yt-captions`. Te dará una URL tipo
   `https://clipforge-yt-captions.TU-SUBDOMINIO.workers.dev`.
4. Pulsa **Edit code** y **borra todo** el contenido del editor.
5. Abre el archivo `worker.js` de esta carpeta, **copia TODO** su contenido y **pégalo** en el editor.
6. Pulsa **Deploy** (arriba a la derecha).
7. (Recomendado) Protege el Worker:
   - Pestaña **Settings** → **Variables and Secrets** → **Add**.
   - Tipo **Secret**, nombre `WORKER_SECRET`, valor una frase larga aleatoria que tú elijas.
   - **Save / Deploy**.

## Opción B — CLI (Wrangler)

```bash
cd worker/yt-captions
npx wrangler login          # abre el navegador para autorizar
npx wrangler deploy         # despliega y muestra la URL *.workers.dev
npx wrangler secret put WORKER_SECRET   # opcional: pega la misma frase larga
```

---

## Conectarlo con la app (en Render)

En **Render → tu servicio → Environment**, añade:

| Variable | Valor |
|----------|-------|
| `YT_CAPTIONS_WORKER_URL` | la URL del Worker, **sin** la ruta final. Ej: `https://clipforge-yt-captions.TU-SUBDOMINIO.workers.dev` |
| `YT_CAPTIONS_WORKER_SECRET` | la MISMA frase que pusiste en `WORKER_SECRET` (solo si activaste el secreto) |

Guarda → Render reinicia. A partir de ahí, cuando YouTube bloquee a Render, la app
usará el Worker automáticamente y la transcripción volverá a funcionar.

## Comprobar que funciona

```bash
# Salud del Worker
curl https://clipforge-yt-captions.TU-SUBDOMINIO.workers.dev/health

# Transcripción directa (si pusiste WORKER_SECRET, añade la cabecera)
curl -X POST https://clipforge-yt-captions.TU-SUBDOMINIO.workers.dev/transcribir \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: TU_FRASE" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

Debe devolver `{"ok":true,"segments":[...],...}`.

## Notas
- Plan gratuito de Cloudflare Workers: 100.000 peticiones/día. De sobra.
- Si un vídeo no tiene subtítulos, el Worker devuelve `{ ok:false, code:"NO_CAPTIONS" }`
  y la app lo muestra como un mensaje claro (no como error 500).
- Este Worker no guarda datos; solo hace de puente con YouTube.
