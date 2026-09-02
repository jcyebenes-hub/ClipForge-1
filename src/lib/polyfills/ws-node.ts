/**
 * Polyfill de WebSocket SOLO para entornos Node.js (servidor de producción).
 * Node 20 no incluye WebSocket nativo y Supabase (realtime) lo necesita.
 *
 * IMPORTANTE: este archivo NO debe importarse desde código del navegador.
 * Solo lo importa server.ts (que nunca se empaqueta con Vite).
 */
import { createRequire } from 'node:module';

if (typeof (globalThis as Record<string, unknown>).WebSocket === 'undefined') {
  try {
    const require = createRequire(import.meta.url);
    // Se anota como `unknown` a propósito: no hay @types/ws instalado y escribir
    // `typeof WebSocket` aquí haría que la anotación se refiera a sí misma (TS2502).
    const moduloWs = require('ws') as { WebSocket: unknown };
    (globalThis as Record<string, unknown>).WebSocket = moduloWs.WebSocket;
    console.log('[ClipForge] WebSocket polyfill activado (Node sin WebSocket nativo)');
  } catch (err) {
    console.warn('[ClipForge] No se pudo cargar ws para el polyfill de WebSocket:', err);
  }
}
