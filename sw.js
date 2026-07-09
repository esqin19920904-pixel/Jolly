/* ==========================================================================
   JOLLY SERVICE WORKER (sw.js)
   ==========================================================================
   Məqsəd: JOLLY-ni internetsiz açıla bilən (offline) etmək.

   NECƏ İŞLƏYİR (Şəbəkə-əvvəl, keşə-son strategiyası):
   1) Hər sorğuda əvvəlcə İNTERNETDƏN cəhd edir (ən təzə versiyanı almaq üçün)
   2) Uğurlu olsa — nəticəni KEŞƏ yazır (növbəti dəfə offline lazım ola bilər)
   3) İnternet yoxdursa (uğursuz olsa) — KEŞDƏN oxuyur
   4) Heç bir fayl siyahısı əvvəlcədən yazılmır — istifadə etdikcə özü öyrənir
      (bu, faylı unutmaq riskini aradan qaldırır)

   Firebase, Telegram, UPCitemdb kimi XARİCİ sorğulara TOXUNMUR — yalnız
   JOLLY-nin öz faylları (HTML/JS/CSS/şəkillər) keşlənir.
   ========================================================================== */

const CACHE_NAME = "jolly-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting(); // yeni versiya dərhal aktivləşsin
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

  // Yalnız GET sorğuları keşlə (POST/PUT və s. toxunma)
  if (req.method !== "GET") return;

  // Xarici (başqa domendəki) sorğulara toxunma — Firebase, Telegram, UPCitemdb və s.
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
          // Naviqasiya sorğusudursa (səhifə açılışı), heç olmasa ana səhifəni göstər
          if (req.mode === "navigate") return caches.match("/index.html");
          return new Response("", { status: 504, statusText: "Offline və keşdə yoxdur" });
        })
      )
  );
});
