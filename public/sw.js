/**
 * ClipForge PWA Service Worker
 * Proporciona soporte offline para la shell de la aplicación, fuentes y activos estáticos.
 *
 * v2: Las navegaciones (HTML) usan SIEMPRE network-first (primero internet, caché solo
 *     como respaldo offline). Así nunca se sirve una versión vieja de la app desde caché.
 */

const CACHE_NAME = 'clipforge-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o que vayan a APIs externas o dinámicas
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-first para llamadas a /api/* y Supabase
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co') || url.hostname.includes('groq.com')) {
    return;
  }

  // Navegaciones (HTML): SIEMPRE network-first para evitar servir versiones viejas.
  // La caché se usa solo como respaldo si no hay internet (modo offline).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => cached || caches.match(event.request));
        })
    );
    return;
  }

  // Recursos estáticos (assets con hash): stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
