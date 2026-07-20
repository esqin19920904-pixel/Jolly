const CACHE_NAME = 'jolly-v7';
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

  // Şəkil/font — nadir dəyişir, sürət üçün keşdən (varsa) göstər
  if (['image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resp.clone()));
          }
          return resp;
        });
      })
    );
    return;
  }

  // Kod/HTML (document, script, style) — HƏMİŞƏ əvvəlcə şəbəkədən ən son
  // versiyanı gətir. Yalnız internet yoxdursa (offline), keşdəkini göstər.
  // Bu sayədə yeni kod yükləyəndən sonra tətbiqi bağlayıb-açmaq kifayətdir —
  // storage/keş əl ilə təmizlənməli olmur.
  if (['document', 'style', 'script'].includes(request.destination)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).then((resp) => {
        if (resp && resp.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, resp.clone()));
        }
        return resp;
      }).catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
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
