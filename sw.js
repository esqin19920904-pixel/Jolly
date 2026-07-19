const CACHE_NAME = 'jolly-v6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './jolly-edge-neon.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname.includes('share-target')) {
    event.respondWith(fetch(request).catch(() => new Response('Share target offline', { status: 503 })));
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (['document', 'style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          fetch(request).then((resp) => {
            if (resp && resp.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, resp.clone()));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then((resp) => {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resp.clone()));
          }
          return resp;
        }).catch(() => {
          if (request.destination === 'document') return caches.match('./index.html');
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
