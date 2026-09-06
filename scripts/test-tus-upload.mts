/**
 * Prueba real de `subirPorTrozosTus` contra un servidor tus simulado.
 * Ejecuta el código de producción (src/lib/tusUpload.ts), no una copia.
 *
 * Uso: node_modules/.bin/tsx scripts/test-tus-upload.mts
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { subirPorTrozosTus, b64Utf8, TUS_CHUNK_BYTES } from '../src/lib/tusUpload.js';

let fallos = 0;
const comprueba = (nombre: string, ok: boolean, detalle = '') => {
  console.log(`${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallos++;
};

// ── Servidor tus simulado ────────────────────────────────────────────────────────
const trozosRecibidos: number[] = [];
let bytesGuardados = Buffer.alloc(0);
let falloEnTrozo = -1; // si es >= 0, ese PATCH devuelve ese código HTTP
let contadorPatch = 0;
const momentosProgreso: number[] = [];

const servidor = createServer((req, res) => {
  const url = req.url || '';

  if (req.method === 'POST' && url === '/storage/v1/upload/resumable') {
    const longitud = Number(req.headers['upload-length']);
    const metadata = String(req.headers['upload-metadata'] || '');
    if (req.headers['tus-resumable'] !== '1.0.0') {
      res.writeHead(412).end('falta Tus-Resumable');
      return;
    }
    if (!Number.isFinite(longitud) || !metadata.includes('bucketName')) {
      res.writeHead(400).end('creación inválida');
      return;
    }
    bytesGuardados = Buffer.alloc(0);
    contadorPatch = 0;
    res.writeHead(201, {
      Location: '/storage/v1/upload/resumable/abc123',
      'Tus-Resumable': '1.0.0',
    });
    res.end();
    return;
  }

  if (req.method === 'PATCH' && url === '/storage/v1/upload/resumable/abc123') {
    const offsetCliente = Number(req.headers['upload-offset']);
    const trozo: Buffer[] = [];
    req.on('data', (c) => trozo.push(c as Buffer));
    req.on('end', () => {
      const datos = Buffer.concat(trozo);
      contadorPatch++;
      trozosRecibidos.push(datos.length);

      if (contadorPatch - 1 === falloEnTrozo) {
        res.writeHead(413, { 'Content-Type': 'text/plain' });
        res.end('The object exceeded the maximum allowed size');
        return;
      }
      // El offset declarado por el cliente debe coincidir con lo guardado: es la
      // garantía del protocolo tus (si no, el servidor rechaza con 409).
      if (offsetCliente !== bytesGuardados.length) {
        res.writeHead(409).end(`offset ${offsetCliente} != guardado ${bytesGuardados.length}`);
        return;
      }
      bytesGuardados = Buffer.concat([bytesGuardados, datos]);
      // Retardo para simular red: el progreso solo puede avanzar cuando responde.
      setTimeout(() => {
        res.writeHead(204, {
          'Upload-Offset': String(bytesGuardados.length),
          'Tus-Resumable': '1.0.0',
        });
        res.end();
      }, 120);
    });
    return;
  }

  res.writeHead(404).end('ruta no esperada: ' + req.method + ' ' + url);
});

await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
const puerto = (servidor.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${puerto}/storage/v1`;

// ── Prueba 1: subida completa por trozos ─────────────────────────────────────────
const TAM = 12 * 1024 * 1024 + 345678; // 12,33 MB → 3 trozos de 5 MB
const contenido = new Uint8Array(TAM);
for (let i = 0; i < TAM; i++) contenido[i] = i % 251;
const archivo = new File([contenido], 'vídeo de prueba.mp4', { type: 'video/mp4' });

const porcentajes: number[] = [];
const bytesReportados: number[] = [];
const t0 = Date.now();

await subirPorTrozosTus(archivo, {
  storagePath: 'usuario-1/proyecto-1/original.mp4',
  bucket: 'media',
  token: 'token-de-prueba',
  anonKey: 'anon-de-prueba',
  baseUrl,
  onProgreso: (pct, bytes) => {
    porcentajes.push(pct);
    bytesReportados.push(bytes);
    momentosProgreso.push(Date.now() - t0);
  },
});

const trozosEsperados = Math.ceil(TAM / TUS_CHUNK_BYTES);
comprueba(
  `envió el archivo en ${trozosEsperados} trozos`,
  trozosRecibidos.length === trozosEsperados,
  `recibidos: ${trozosRecibidos.length} de tamaños [${trozosRecibidos.join(', ')}]`
);
comprueba(
  'el servidor guardó el archivo completo y byte a byte idéntico',
  bytesGuardados.length === TAM && Buffer.compare(bytesGuardados, Buffer.from(contenido)) === 0,
  `${bytesGuardados.length} de ${TAM} bytes`
);
comprueba(
  'el progreso terminó en 100%',
  porcentajes[porcentajes.length - 1] === 100,
  `secuencia: [${porcentajes.join(' → ')}]`
);
comprueba(
  'el progreso es creciente y lo marca el servidor (no de golpe)',
  porcentajes.every((p, i) => i === 0 || p > porcentajes[i - 1]) && porcentajes[0] < 100,
  `primer salto: ${porcentajes[0]}%`
);
comprueba(
  'los bytes reportados coinciden con lo confirmado por el servidor',
  bytesReportados[bytesReportados.length - 1] === TAM,
  `reportado: ${bytesReportados.join(' → ')}`
);
comprueba(
  'cada avance llegó tras la respuesta del servidor (progreso real, no de búfer)',
  momentosProgreso.length === trozosEsperados && momentosProgreso[momentosProgreso.length - 1] >= 100 * trozosEsperados,
  `instantes (ms): [${momentosProgreso.join(', ')}]`
);

// ── Prueba 2: el servidor rechaza a mitad → error con su código ──────────────────
falloEnTrozo = 1; // falla el 2º trozo
trozosRecibidos.length = 0;
let errorCapturado = '';
try {
  await subirPorTrozosTus(archivo, {
    storagePath: 'usuario-1/proyecto-1/original.mp4',
    bucket: 'media',
    token: 'token-de-prueba',
    anonKey: 'anon-de-prueba',
    baseUrl,
  });
} catch (e: any) {
  errorCapturado = String(e?.message || e);
}
comprueba(
  'un rechazo del servidor se propaga como error con su código y mensaje',
  errorCapturado.startsWith('413::') && errorCapturado.includes('maximum allowed size'),
  errorCapturado.slice(0, 80)
);
falloEnTrozo = -1;

// ── Prueba 3: base64 UTF-8 (rutas con acentos) ───────────────────────────────────
comprueba(
  'b64Utf8 codifica UTF-8 correctamente',
  b64Utf8('vídeo/ñoño.mp4') === Buffer.from('vídeo/ñoño.mp4', 'utf8').toString('base64'),
  b64Utf8('vídeo/ñoño.mp4')
);

servidor.close();
console.log(fallos === 0 ? '\nRESULTADO: todas las comprobaciones pasaron' : `\nRESULTADO: ${fallos} comprobación(es) fallaron`);
process.exit(fallos === 0 ? 0 : 1);
