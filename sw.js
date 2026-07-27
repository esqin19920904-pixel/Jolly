/* ============================================================
   JOLLY Service Worker
   DÜZƏLİŞ (2026-07-23, offline rejim işləmirdi):
   Əvvəl STATIC_ASSETS-də cəmi 5 fayl var idi — index.html-dəki
   ~100 JS faylından heç biri əvvəlcədən keşə salınmırdı, onlar
   yalnız İSTİFADƏÇİ ƏVVƏLLƏR ONLAYN olanda təsadüfən keşə düşürdü.
   Nəticədə: keş təmizlənsə, təzə deploy olsa, yaxud hansısa fayl heç
   vaxt uğurla fetch olunmayıbsa — həmin fayl offline-da 503 "Offline"
   cavabı alırdı və modul sakitcə sınırdı (məhsullar görünmür, AI
   işləmir və s. — hansı faylın çatmadığından asılı olaraq dəyişirdi).
   İndi BÜTÜN skriptlər `install` zamanı əvvəlcədən yüklənir ki,
   ilk uğurlu quraşdırmadan sonra tətbiq tam offline-safe olsun.
   ============================================================ */
const CACHE_NAME = 'jolly-v10';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './jolly-edge-neon.css',

  './jolly-blackbox.js?v=2',
  './jolly-diag.js',
  './db.js',
  './jolly-archive.js',
  './jolly-showcase.js?v=2',
  './jolly-ad-generator.js?v=1',
  './jolly-holocard.js?v=1',
  './jolly-whatif.js?v=1',
  './module-registry.js',
  './roadmap.js',
  './night-mode.js',
  './gamification.js',
  './voice-notes.js',
  './storage.js',
  './cloud.js?v=4',
  './toast.js',
  './cleanup.js',
  './sound.js',
  './haptic-fx.js',
  './barcode.js',
  './barcode-gen.js',
  './share.js',
  './gallery.js',
  './voice.js',
  './visual-search.js',
  './jolly-live-lens.js',
  './jolly-drive.js',
  './viewer.js',
  './ocr.js',
  './ai.js?v=2',
  './ai-shortcuts.js',
  './jolly-ai-dictionary.js',
  './jolly-ai-typo.js',
  './jolly-ai-search.js',
  './jolly-ai-intent.js',
  './jolly-ai-health.js',
  './jolly-ai-actions.js',
  './jolly-ai-voice.js',
  './jolly-ai-ui.js',
  './jolly-ai-core.js',
  './jolly-gemini.js',
  './jolly-ai-studio.js',
  './brain.js',
  './command.js',
  './product-pro.js',
  './ux-pro.js',
  './insight.js',
  './bulk.js',
  './fx-engine.js',
  './reveal.js',
  './quick.js',
  './history.js',
  './data-doctor.js',
  './products.js',
  './dead-zone.js',
  './daily-summary.js',
  './color-search.js',
  './compare.js',
  './audit.js',
  './price-advisor.js',
  './bg-remove.js?v=2',
  './chat.js?v=2',
  './admin-studio.js',
  './workflow.js',
  './code-studio.js',
  './jolly-ota.js',
  './jolly-announce.js?v=2',
  './jolly-icons.js',
  './jolly-ai-daily.js',
  './jolly-product-dna.js',
  './jolly-store-map.js',
  './jolly-barcode-folder.js',
  './offline-diagnostic.js',
  './dashboard.js',
  './studios.js?v=2',
  './edge-panel.js',
  './jolly-edge-neon.js',
  './map.js',
  './receiving.js',
  './scan-receiving.js',
  './quick-menu.js',
  './radial-fab.js',
  './jolly-users.js',
  './permission-engine.js',
  './security.js',
  './admin-permissions.js',
  './jolly-users-studio.js',
  './filter-studio.js',
  './supplier-order.js',
  './bottom-dock.js',
  './jolly-events.js',
  './jolly-biometric.js',
  './jolly-devmode.js',
  './app.js',
  './jolly-particles.js',
  './jolly-transitions.js',
  './jolly-fx-polish.js',
  './jolly-back-guard.js?v=3',
  './jolly-studios-carousel.js?v=11',
  './jolly-telegram.js',
  './jolly-diagnostics.js?v=2',
  './jolly-diag-report.js?v=2',
  './jolly-github.js',
  './tools-menu.js?v=2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll bir fayl belə 404/xəta versə hamısını uğursuz edir —
      // ona görə hər faylı ayrıca cəhd edirik ki, tək bir səhv (məs.
      // silinmiş/adı dəyişmiş köhnə bir fayl) bütün quraşdırmanı
      // pozmasın, qalanları yenə də keşlənsin.
      return Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((e) => console.warn('[SW] Keşlənmədi:', url, e))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

// Keşdən uyğun cavab tap — əvvəl dəqiq (versiya parametri daxil),
// tapılmasa versiyasız (ignoreSearch) — versiya bump-ı offline-da
// köhnə faylın tapılmamasına səbəb olmasın.
async function matchWithFallback(request) {
  const exact = await caches.match(request);
  if (exact) return exact;
  return caches.match(request, { ignoreSearch: true });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname.includes('share-target')) {
    event.respondWith(fetch(request).catch(() => new Response('Share target offline', { status: 503 })));
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request).catch(() => matchWithFallback(request)));
    return;
  }

  // Şəkil/font — nadir dəyişir, sürət üçün keşdən (varsa) göstər
  if (['image', 'font'].includes(request.destination)) {
    event.respondWith(
      matchWithFallback(request).then((cached) => {
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
        return matchWithFallback(request).then((cached) => {
          if (cached) return cached;
          if (request.destination === 'document') return matchWithFallback(new Request(new URL('./index.html', self.location).href));
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => matchWithFallback(request)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
