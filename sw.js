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
   ========================================================================== */

const CACHE_NAME = "jolly-cache-v2";
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);
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
