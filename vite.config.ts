import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * CONFIGURACIÓN DE VITE — ClipForge
 * =================================
 * Este archivo SOLO configura el frontend (React + Tailwind + HMR).
 *
 * ⚠️ CAMBIO IMPORTANTE (2026-09-02):
 * Antes había aquí un plugin `youtubeApiPlugin()` de ~780 líneas que interceptaba
 * /api/youtube/info, /api/youtube/descargar, /api/transcribir, /api/analizar,
 * /api/hooks y /api/traducir y devolvía DATOS SIMULADOS (títulos inventados tipo
 * "Cómo facturar $10K/mes...", una transcripción de ejemplo y diccionarios de
 * traducción de juguete) cuando no había worker o clave de Groq configurados.
 *
 * Eso provocaba dos problemas:
 *   1. En desarrollo NO se ejecutaba el código real de producción. Lo que se veía
 *      en el preview no era lo que iba a pasar en Render.
 *   2. Solo cubría 6 de las 17 rutas de server.ts. Las otras 11
 *      (/api/youtube/transcribir, /probe, /auth, /callback, /upload,
 *      /api/tiktok/publish, /api/instagram/publish, /api/cron/*, /api/exportar)
 *      directamente no existían en desarrollo.
 *
 * Ahora las rutas /api/* se delegan por proxy al servidor Express real
 * (server.ts), que es EL MISMO que corre en producción. Desarrollo y producción
 * ejecutan exactamente el mismo código. `scripts/dev.mjs` arranca ambos procesos.
 *
 * Consecuencia esperada: si falta GROQ_API_KEY / YT_WORKER_URL / Supabase, la API
 * devolverá su error real en vez de inventarse una respuesta. Eso es lo correcto.
 */

// Puerto del servidor Express (server.ts) que sirve las rutas /api/* reales.
// Lo arranca scripts/dev.mjs. El proxy es de servidor a servidor (Node → Node),
// nunca desde el navegador, así que 127.0.0.1 aquí es correcto.
const API_PORT = Number(process.env.API_PORT) || 3100;
const API_TARGET = `http://127.0.0.1:${API_PORT}`;

// Imprescindible para ffmpeg.wasm multihilo (core-mt) en el navegador:
// SharedArrayBuffer exige aislamiento de origen.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: crossOriginIsolation,
    // `true` (y no un boolean genérico) para permitir el host del preview.
    allowedHosts: true as const,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: {
    headers: crossOriginIsolation,
  },
  build: {
    // El objetivo es que NINGÚN chunk supere los 500 kB. Con el lazy loading de
    // las páginas + estos vendors el mayor queda por debajo.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        /**
         * Separa en chunks propios las dependencias que se necesitan SIEMPRE,
         * para que el navegador las cachee aparte del código de la app.
         *
         * Solo se agrupan librerías del grafo inicial. NO se agrupan a propósito:
         *   - lucide-react: Rollup ya parte cada icono en su propio chunk y
         *     juntarlos obligaría a descargar iconos que no se usan.
         *   - recharts, @mediapipe, @ffmpeg: solo los usan páginas con
         *     React.lazy(), así que ya viajan en el chunk de su página y no se
         *     descargan hasta que el usuario entra allí.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/@supabase/')) return 'vendor-supabase';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
});
