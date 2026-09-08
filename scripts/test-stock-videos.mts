/**
 * Prueba de src/lib/stockVideos.ts contra un servidor local que sirve una RESPUESTA
 * REAL de Pexels (scripts/fixtures/pexels-respuesta-real.json), con los enlaces de
 * descarga redirigidos al propio servidor para poder verificar la descarga.
 *
 * Se prueba así (y no contra api.pexels.com) porque la API de Pexels exige clave:
 * verificado el 2026-09-08, 12/12 peticiones sin clave devuelven 401.
 *
 * Uso: node_modules/.bin/tsx scripts/test-stock-videos.mts
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { buscarVideosStock, elegirArchivo, formatoSegundos } from '../src/lib/stockVideos.js';

let fallos = 0;
const comprueba = (nombre: string, ok: boolean, detalle = '') => {
  console.log(`${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallos++;
};

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/pexels-respuesta-real.json', import.meta.url), 'utf8')
);

// Archivo MP4 mínimo válido (cabecera ftyp) para comprobar la descarga
const mp4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypmp42', 'latin1'),
  Buffer.alloc(4096, 7),
]);

const servidor = createServer((req, res) => {
  const url = req.url || '';
  if (url.startsWith('/search')) {
    const u = new URL(url, 'http://x');
    // Sin clave → 401, como hace Pexels de verdad
    if (!req.headers.authorization) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    // Reescribe los enlaces de descarga al propio servidor
    const copia = JSON.parse(JSON.stringify(fixture));
    copia.videos.forEach((v: any) => {
      v.video_files = (v.video_files || []).map((f: any, i: number) => ({
        ...f,
        link: `http://127.0.0.1:${puerto}/file/${v.id}-${i}.mp4`,
      }));
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(copia));
    return;
  }
  if (url.startsWith('/file/')) {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': String(mp4.length) });
    res.end(mp4);
    return;
  }
  res.writeHead(404).end();
});

await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
const puerto = (servidor.address() as AddressInfo).port;
const endpoint = `http://127.0.0.1:${puerto}/search`;

// 1) Sin clave debe fallar con un mensaje que explique cómo conseguirla
let errorSinClave = '';
try {
  await buscarVideosStock('naturaleza', { endpoint });
} catch (e: any) {
  errorSinClave = String(e?.message || e);
}
comprueba(
  'sin clave avisa que hay que crear la clave gratuita de Pexels',
  errorSinClave.includes('pexels.com/api') && errorSinClave.includes('VITE_PEXELS_API_KEY'),
  errorSinClave.slice(0, 70) + '…'
);

// 2) Con clave devuelve y normaliza los resultados reales
const r = await buscarVideosStock('naturaleza', { endpoint, apiKey: 'clave-de-prueba', perPage: 6 });
comprueba('devuelve los vídeos de la respuesta real', r.videos.length === 6, `${r.videos.length} vídeos, total ${r.total}`);
comprueba('marca que se usó clave', r.sinClave === false);

const primero = r.videos[0];
comprueba(
  'normaliza id, miniatura, duración, autor y resolución',
  primero.id === 1208094 && primero.duracionSeg === 29 && primero.ancho === 1920 && primero.autor === 'Zuzanna Musial',
  `#${primero.id} ${primero.ancho}x${primero.alto} ${primero.duracionSeg}s ${primero.autor}`
);
comprueba(
  'conserva solo los archivos mp4 con enlace',
  primero.archivos.length === 4 && primero.archivos.every((a) => a.enlace.includes('.mp4')),
  `${primero.archivos.length} archivos`
);

// 3) Elección del mejor archivo (debe ser el de 1080p, no el primero que es 540p)
const elegido = elegirArchivo(primero);
comprueba(
  'elige el archivo de 1080p y no el primero de la lista',
  elegido?.alto === 1080 && primero.archivos[0].alto === 540,
  `elegido ${elegido?.alto}p (el primero era ${primero.archivos[0].alto}p)`
);

// 4) Descarga del archivo elegido
const descarga = await fetch(elegido!.enlace);
const bytes = new Uint8Array(await descarga.arrayBuffer());
comprueba(
  'el archivo se descarga y tiene cabecera MP4 (ftyp)',
  descarga.ok && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp',
  `HTTP ${descarga.status}, ${bytes.length} bytes`
);

// 5) Búsqueda vacía no llama a la red
const vacia = await buscarVideosStock('   ', { endpoint, apiKey: 'x' });
comprueba('búsqueda vacía devuelve lista vacía', vacia.videos.length === 0);

// 6) Formato de duración
comprueba(
  'formatoSegundos formatea bien',
  formatoSegundos(65) === '1:05' && formatoSegundos(0) === '--:--',
  `65→${formatoSegundos(65)}`
);


// 7) elegirArchivo según orientación (regresión: en vertical no debe coger un archivo pequeño)
const base = { id: 1, pagina: '', imagen: '', duracionSeg: 10, autor: 'x', autorUrl: '', archivos: [] as any[] };
const mk = (alto: number, ancho: number) => ({ id: alto, calidad: '', tipo: 'video/mp4', ancho, alto, enlace: 'https://x/' + alto + '.mp4' });

const vertical = { ...base, ancho: 1080, alto: 1920, archivos: [mk(3840, 2160), mk(1920, 1080), mk(960, 540)] };
comprueba(
  'en vertical elige 1080x1920 y no el pequeño de 960',
  elegirArchivo(vertical)?.alto === 1920,
  `elegido ${elegirArchivo(vertical)?.alto}p`
);

const horizontal = { ...base, ancho: 1920, alto: 1080, archivos: [mk(2160, 3840), mk(1080, 1920), mk(720, 1280)] };
comprueba(
  'en horizontal elige 1920x1080',
  elegirArchivo(horizontal)?.alto === 1080,
  `elegido ${elegirArchivo(horizontal)?.alto}p`
);

servidor.close();
console.log(fallos === 0 ? '\nRESULTADO: todas las comprobaciones pasaron' : `\nRESULTADO: ${fallos} fallaron`);
process.exit(fallos === 0 ? 0 : 1);
