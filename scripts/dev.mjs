#!/usr/bin/env node
/**
 * ClipForge — arranque en desarrollo
 * ==================================
 * Levanta DOS procesos y los mantiene vivos:
 *
 *   1. API   → `tsx server.ts`   (Express, puerto API_PORT, por defecto 3100)
 *              Sirve las 17 rutas /api/* REALES, las mismas que en producción.
 *   2. WEB   → `vite`            (frontend con HMR, puerto 3000)
 *              Delega /api/* y /health al proceso 1 por proxy.
 *
 * ¿Por qué dos procesos y no uno? Porque así el navegador habla con un único
 * origen (el puerto 3000) y el código de la API que se ejecuta en desarrollo es
 * literalmente el mismo que corre en Render. Antes vite.config.ts simulaba 6 de
 * esas 17 rutas con datos inventados.
 *
 * Si uno de los dos procesos muere, se para el otro: no tiene sentido dejar el
 * frontend sirviendo contra una API caída.
 *
 * Uso:
 *   npm run dev                     (API en 3100, web en 3000)
 *   API_PORT=4000 npm run dev       (cambiar el puerto de la API)
 */
import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = process.env.API_PORT || '3100';

// Se invoca node directamente sobre los binarios de node_modules en vez de usar
// `npx`: evita resolver shells y es más rápido.
const node = process.execPath;

const procesos = [
  {
    nombre: 'api ',
    comando: node,
    args: [path.join(raiz, 'node_modules/tsx/dist/cli.mjs'), 'server.ts'],
  },
  {
    nombre: 'web ',
    comando: node,
    args: [
      path.join(raiz, 'node_modules/vite/bin/vite.js'),
      '--port=3000',
      '--host=0.0.0.0',
    ],
  },
];

const hijos = [];
let cerrando = false;

function cerrar(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  for (const { hijo } of hijos) {
    if (hijo.exitCode === null && hijo.signalCode === null) hijo.kill('SIGTERM');
  }
  // Margen para que los hijos terminen de vaciar su salida antes de salir.
  setTimeout(() => process.exit(codigo), 400);
}

for (const { nombre, comando, args } of procesos) {
  const hijo = spawn(comando, args, {
    cwd: raiz,
    stdio: 'inherit',
    env: { ...process.env, API_PORT, PORT: API_PORT },
  });

  hijo.on('exit', (codigo, señal) => {
    if (cerrando) return;
    console.error(
      `\n[dev] El proceso "${nombre.trim()}" terminó (code=${codigo}, signal=${señal}). Parando el resto.`
    );
    cerrar(typeof codigo === 'number' && codigo !== 0 ? codigo : 1);
  });

  hijo.on('error', (err) => {
    console.error(`[dev] No se pudo arrancar "${nombre.trim()}":`, err.message);
    cerrar(1);
  });

  hijos.push({ nombre, hijo });
}

process.on('SIGINT', () => cerrar(0));
process.on('SIGTERM', () => cerrar(0));
