/* ==========================================================================
   JOLLY SERVICE WORKER (sw.js)
   ==========================================================================
   Purpose: make JOLLY work offline.

   Strategy:
   1) On install, pre-cache the app shell (root + index.html + manifest)
      so offline works even on the very next load, no matter which exact
      URL the browser requests for navigation ("/" vs "/index.html").
   2) On every request: try network first (freshest version). If it
      succeeds, also save it to cache for future offline use.
   3) If network fails (offline), serve from cache. For page navigations
      that aren't cached yet, fall back to the cached app shell.
   4) External requests (Firebase, Telegram, UPCitemdb, Google fonts, etc.)
      are left untouched - only same-origin JOLLY files are cached.

   YENİ: Web Share Target — WhatsApp (və ya hər hansı tətbiq) vasitəsilə
   "Paylaş → JOLLY" edəndə göndərilən şəkli tutur, "jolly-share-cache"-ə
   müvəqqəti saxlayır, sonra "#/share-received" səhifəsinə yönləndirir.
   Əsl emal (Visual Search, namizəd seçimi) share-target.js-dəki
   JollyShareTarget modulu tərəfindən edilir.
   ========================================================================== */

const CACHE_NAME = "jolly-cache-v3";
const SHARE_CACHE = "jolly-share-cache";
const APP_SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url).then((res) => (res.ok ? cache.put(url, res) : null)).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // Köhnə cache versiyalarını sil, AMMA cari cache-i və paylaşım
      // cache-ini (jolly-share-cache) toxunma — orada gözləyən şəkil ola bilər.
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== SHARE_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ---------- Web Share Target — paylaşılan şəkli tut ---------- */
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("sharedFile");
    if (file) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        "/shared-image",
        new Response(file, { headers: { "Content-Type": file.type || "image/jpeg" } })
      );
    }
  } catch (e) {
    console.error("[JOLLY SW] share-target xətası:", e);
  }
  // "Paylaşılan Şəkil" səhifəsinə yönləndir — JollyShareTarget modulu
  // (share-target.js) orada gözləyən şəkli özü Cache Storage-dan oxuyur.
  return Response.redirect("./index.html#/share-received", 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Paylaşım hədəfi (Share Target) — WhatsApp və s.-dən gələn POST sorğusu
  if (req.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(handleShareTarget(req));
    return;
  }

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === "navigate") {
            return caches.match("./index.html").then((shell) => shell || caches.match("./"));
          }
          return new Response("", { status: 504, statusText: "Offline and not cached" });
        })
      )
  );
});
