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
/* ★ 2026-08-19: v28 → v29.
   `index.html`-dən köhnə icazə faylları çıxarıldı, amma Service
   Worker köhnə nüsxəni keşdən verirdi — ona görə `jolly-user-mode.js`
   yüklənməkdə davam edirdi və "🔒 Bu bölməyə icazən yoxdur" yazısı
   sönmürdü. Versiya artanda köhnə keş silinir (aşağıdakı activate). */
const CACHE_NAME = 'jolly-v29';
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
  './jolly-lazy-loader.js',
  './jolly-fix-mode.js',
  './jolly-health-report.js',
  './jolly-import.js',
  './jolly-scan-marathon.js',
  './jolly-sheet-bridge.js',
  './jolly-barcode-log.js',
  './jolly-selftest.js',
  './jolly-testdata.js',
  './jolly-guide.js',
  './jolly-group-health.js',
  './jolly-perm-preview.js',
  './jolly-tasks.js',
  './jolly-photo-session.js',
  './jolly-perms-extra.js',
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

/* ------------------------------------------------------------
   Paylaşılan məlumatı IndexedDB-yə yazan köməkçi
   (localStorage burada işləmir — service worker-in ona girişi yoxdur,
   üstəlik şəkil base64 kimi 5 MB limitini partladardı)
   ------------------------------------------------------------ */
const SHARE_DB = 'jolly_share';
const SHARE_STORE = 'inbox';

function shareDbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(SHARE_DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function shareDbPut(record) {
  return shareDbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readwrite');
    const q = tx.objectStore(SHARE_STORE).put(record);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  }));
}

async function handleShare(request) {
  let saved = 0;
  try {
    const form = await request.formData();
    const title = form.get('sharedTitle') || '';
    const text  = form.get('sharedText')  || '';
    const link  = form.get('sharedUrl')   || '';

    const files = form.getAll('sharedImages').filter((f) => f && f.size > 0);
    const images = [];
    for (const f of files) {
      const buf = await f.arrayBuffer();
      images.push({ name: f.name || 'share.jpg', type: f.type || 'image/jpeg', size: f.size, data: buf });
    }

    await shareDbPut({
      at: Date.now(),
      title: String(title),
      text: String(text),
      url: String(link),
      images: images,
      handled: false
    });
    saved = images.length || 1;
  } catch (e) {
    // Paylaşma oxunmadı — istifadəçini yenə səhifəyə buraxırıq, orada mesaj görünəcək
    console.error('[SW] paylaşma oxunmadı:', e);
  }

  // 303 ilə GET-ə yönləndiririk — POST təkrarlanmasın
  return Response.redirect('./share-target.html?shared=' + saved + '&t=' + Date.now(), 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* ============================================================
     PAYLAŞMA (share target) — 2026-07-30 düzəlişi
     ------------------------------------------------------------
     PROBLEM: manifest.json paylaşmanı POST + multipart ilə göndərir
     (şəkil başqa yolla göndərilə bilmir). Əvvəl bu POST birbaşa
     serverə ötürülürdü — Cloudflare Pages statik fayla POST qəbul
     etmir və HTTP 405 qaytarırdı ("Bu səhifə işləmir").
     Üstəlik share-target.html məlumatı ünvan sətrindən oxuyurdu,
     POST-da isə ünvan sətri boş olur.

     HƏLL (PWA-da yeganə düzgün yol): service worker POST-u ÖZÜ oxuyur,
     şəkli və mətni IndexedDB-yə (`jolly_share`/`inbox`) yazır, sonra
     brauzeri adi GET ünvanına yönləndirir. Səhifə məlumatı oradan alır.
     ============================================================ */
  if (request.method === 'POST' && url.pathname.includes('share-target')) {
    event.respondWith(handleShare(request));
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
