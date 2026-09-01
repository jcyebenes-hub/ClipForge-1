/**
 * CLIPFORGE - Servidor de producción (Node + Express)
 * ====================================================
 * Sirve la app construida (dist/) Y todas las rutas /api/* de la aplicación.
 *
 * Cómo usarlo:
 *   1. npm run build          (genera dist/)
 *   2. npm start              (arranca este servidor)
 *
 * Variables de entorno: lee .env o las variables del sistema (ver .env.example).
 * En producción (Render / Railway / Fly.io / VPS) solo:
 *   - npm run build
 *   - node server.ts  (o con tsx: npx tsx server.ts)
 * con PORT definido por la plataforma (Render usa $PORT).
 */
// ⚠️ PRIMER import: inyecta el polyfill de WebSocket antes de cargar Supabase
import './src/lib/polyfills/ws-node';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'node:buffer';
import 'dotenv/config';

// ---------------------------------------------------------------------------
// Handlers de la API (misma lógica que usa el preview de desarrollo)
// ---------------------------------------------------------------------------
import { POST as transcribirPOST } from './src/app/api/transcribir/route';
import { POST as analizarPOST } from './src/app/api/analizar/route';
import { POST as hooksPOST } from './src/app/api/hooks/route';
import { POST as traducirPOST } from './src/app/api/traducir/route';
import { POST as exportarPOST } from './src/app/api/exportar/route';
import { GET as youtubeInfoGET, POST as youtubeInfoPOST } from './src/app/api/youtube/info/route';
import { POST as youtubeDescargarPOST } from './src/app/api/youtube/descargar/route';
import { GET as youtubeAuthGET } from './src/app/api/youtube/auth/route';
import { GET as youtubeCallbackGET } from './src/app/api/youtube/callback/route';
import { POST as youtubeUploadPOST } from './src/app/api/youtube/upload/route';
import { POST as tiktokPublishPOST } from './src/app/api/tiktok/publish/route';
import { POST as instagramPublishPOST } from './src/app/api/instagram/publish/route';
import { GET as cronPublicarGET } from './src/app/api/cron/publicar/route';
import { GET as cronVigilarGET } from './src/app/api/cron/vigilar-canal/route';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3100;

// Cross-Origin-Isolation: imprescindible para ffmpeg.wasm multihilo (core-mt)
// en el navegador (SharedArrayBuffer). Mismo comportamiento que el dev server.
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// NOTA: NO usar express.json() aquí. Los handlers leen el body crudo (raw) vía
// el adaptador Web Request. Un middleware que consuma el body dejaría al
// adaptador esperando el evento 'end' que ya pasó (cuelgue infinito).

// ---------------------------------------------------------------------------
// Adaptador: Express (req/res) → Web API (Request/Response)
// ---------------------------------------------------------------------------
function adapt(handler: (request: Request) => Promise<Response>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const host = req.headers.host || 'localhost';
      const url = new URL(req.originalUrl || '/', `${proto}://${host}`);

      // Leer el body completo (soporta JSON, form-data y binario)
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });

      const method = (req.method || 'GET').toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD' && rawBody.length > 0;

      const request = new Request(url.toString(), {
        method,
        headers: req.headers as unknown as HeadersInit,
        body: hasBody ? rawBody : undefined,
      });

      const response = await handler(request);

      // Copiar cabeceras de la respuesta
      res.status(response.status);
      response.headers.forEach((value, key) => {
        try {
          res.setHeader(key, value);
        } catch {
          /* cabeceras no permitidas, se ignoran */
        }
      });

      const data = await response.arrayBuffer();
      if (!res.getHeader('Content-Length')) {
        res.setHeader('Content-Length', data.byteLength);
      }
      res.end(Buffer.from(data));
    } catch (err) {
      console.error('[ClipForge API] Error en ruta', req.originalUrl, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error interno del servidor', detalle: String(err) });
      } else {
        res.end();
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Rutas API
// ---------------------------------------------------------------------------
const api = '/api';
app.post(`${api}/transcribir`, adapt(transcribirPOST));
app.post(`${api}/analizar`, adapt(analizarPOST));
app.post(`${api}/hooks`, adapt(hooksPOST));
app.post(`${api}/traducir`, adapt(traducirPOST));
app.post(`${api}/exportar`, adapt(exportarPOST));
app.get(`${api}/youtube/info`, adapt(youtubeInfoGET));
app.post(`${api}/youtube/info`, adapt(youtubeInfoPOST));
app.post(`${api}/youtube/descargar`, adapt(youtubeDescargarPOST));
app.get(`${api}/youtube/auth`, adapt(youtubeAuthGET));
app.get(`${api}/youtube/callback`, adapt(youtubeCallbackGET));
app.post(`${api}/youtube/upload`, adapt(youtubeUploadPOST));
app.post(`${api}/tiktok/publish`, adapt(tiktokPublishPOST));
app.post(`${api}/instagram/publish`, adapt(instagramPublishPOST));
app.get(`${api}/cron/publicar`, adapt(cronPublicarGET));
app.get(`${api}/cron/vigilar-canal`, adapt(cronVigilarGET));

// Ruta de salud (para Render / monitors)
app.get('/health', (_req, res) => {
  res.json({ ok: true, servicio: 'clipforge', hora: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Frontend estático (dist/) con fallback SPA
// ---------------------------------------------------------------------------
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend no construido. Ejecuta: npm run build');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ClipForge servidor de producción escuchando en http://0.0.0.0:${PORT}`);
  console.log(`   - Frontend: dist/ (SPA)`);
  console.log(`   - API: /api/* (${api})`);
});
