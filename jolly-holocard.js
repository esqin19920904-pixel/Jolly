/* ==========================================================================
   JOLLY HOLOQRAFİK KART (jolly-holocard.js) — Roadmap #11 + #12
   ==========================================================================
   DÜRÜST QEYD: Bu, əsl 3D model YARATMIR (o, Gemini/ödənişli AI API tələb
   edir, hazırda mövcud deyil). Bunun əvəzinə: mövcud məhsul şəklini
   barmaqla "əydikcə" (tilt) fırlanan, üstündə göy qurşağı parıltısı olan
   "kart oyunu" effekti yaradır — real 3D deyil, amma təəssürat oxşardır.
   ========================================================================== */

(function () {
  "use strict";

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = String(s == null ? "" : s);
    return div.innerHTML;
  }

  function injectStyles() {
    if (document.getElementById("jolly-holo-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-holo-styles";
    style.textContent = `
      #jolly-holo-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.85);
        z-index: 99999; display: flex; flex-direction: column; align-items: center; justify-content: center;
        perspective: 900px;
      }
      .jholo-close {
        position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.1);
        border: none; color: #fff; font-size: 20px; width: 36px; height: 36px; border-radius: 50%;
      }
      #jholo-card {
        width: 78vw; max-width: 320px; aspect-ratio: 3/4; border-radius: 20px;
        position: relative; overflow: hidden; transition: transform 0.08s ease-out;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        background: #1a1a1a;
      }
      #jholo-card img {
        width: 100%; height: 100%; object-fit: cover; display: block;
      }
      .jholo-emoji-fallback {
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 100px;
        background: linear-gradient(135deg,#232323,#111);
      }
      .jholo-shine {
        position: absolute; inset: 0; pointer-events: none; mix-blend-mode: color-dodge; opacity: 0.55;
        background: linear-gradient(115deg, transparent 20%, rgba(255,0,150,0.5) 30%, rgba(0,225,255,0.5) 40%, rgba(255,225,0,0.5) 50%, transparent 65%);
        background-size: 200% 200%;
      }
      .jholo-label {
        position: absolute; bottom: 0; left: 0; right: 0; padding: 14px;
        background: linear-gradient(0deg, rgba(0,0,0,0.85), transparent);
        color: #fff; text-align: center; font-family: system-ui, sans-serif;
      }
      .jholo-label .name { font-size: 16px; font-weight: 700; }
      .jholo-label .price { font-size: 14px; color: #d4af37; margin-top: 2px; }
      .jholo-hint { color: #999; font-size: 12px; margin-top: 20px; text-align: center; }
      #jad-h-input {
        width: 78vw; max-width: 320px; background: #232323; color: #f0e6c8; border: 1px solid #444;
        border-radius: 10px; padding: 10px 12px; font-size: 13px; box-sizing: border-box; margin-bottom: 14px;
      }
      .jholo-result-item { padding: 8px; font-size: 13px; color: #eee; cursor: pointer; }
    `;
    document.head.appendChild(style);
  }

  function setupTilt(card, shine) {
    function apply(x, y, rect) {
      const px = (x - rect.left) / rect.width;
      const py = (y - rect.top) / rect.height;
      const rotY = (px - 0.5) * 24;
      const rotX = (0.5 - py) * 24;
      card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
      shine.style.backgroundPosition = `${px * 100}% ${py * 100}%`;
    }
    function reset() {
      card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
      shine.style.backgroundPosition = "50% 50%";
    }
    card.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      apply(t.clientX, t.clientY, card.getBoundingClientRect());
    }, { passive: true });
    card.addEventListener("touchend", reset);
    card.addEventListener("mousemove", (e) => apply(e.clientX, e.clientY, card.getBoundingClientRect()));
    card.addEventListener("mouseleave", reset);

    // Cihaz meyli varsa (gyroscope), ona da reaksiya versin
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", (e) => {
        if (e.beta == null || e.gamma == null) return;
        const rotY = Math.max(-24, Math.min(24, e.gamma));
        const rotX = Math.max(-24, Math.min(24, (e.beta - 45)));
        card.style.transform = `rotateX(${-rotX * 0.4}deg) rotateY(${rotY * 0.4}deg) scale(1.02)`;
      });
    }
  }

  function renderCard(overlay, p) {
    const zone = overlay.querySelector("#jholo-card-zone");
    if (!p) { zone.innerHTML = ""; return; }
    const imgHtml = (p.images && p.images[0])
      ? `<img ${typeof JollyStorage !== "undefined" ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'}>`
      : `<div class="jholo-emoji-fallback">🧴</div>`;

    zone.innerHTML = `
      <div id="jholo-card">
        ${imgHtml}
        <div class="jholo-shine"></div>
        <div class="jholo-label">
          <div class="name">${esc(p.name || "Adsız")}</div>
          ${p.price != null && p.price !== "" ? `<div class="price">${esc(p.price)} ₼</div>` : ""}
        </div>
      </div>
      <div class="jholo-hint">👆 Barmağınla üstündə gəz — kart əyilir və parıldayır</div>
    `;
    setupTilt(zone.querySelector("#jholo-card"), zone.querySelector(".jholo-shine"));
  }

  function handleSearch(overlay) {
    const input = overlay.querySelector("#jad-h-input");
    const q = input.value.trim();
    if (!q || typeof JollyDB === "undefined") return;
    const matches = JollyDB.Products.search(q);
    if (matches.length) renderCard(overlay, matches[0]);
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-holo-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "jolly-holo-overlay";
    overlay.innerHTML = `
      <button class="jholo-close" id="jholo-close-btn">✕</button>
      <input id="jad-h-input" placeholder="Məhsul axtar...">
      <div id="jholo-card-zone"></div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#jholo-close-btn").onclick = () => overlay.remove();
    overlay.querySelector("#jad-h-input").oninput = () => handleSearch(overlay);
  }

  window.JollyHoloCard = {
    id: "holocard",
    name: "Holoqrafik Kart",
    version: "1.0.0",
    show
  };

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(window.JollyHoloCard);
  }
})();
