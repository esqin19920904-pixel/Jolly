/* ==========================================================================
   JOLLY RƏQƏMSAL SƏRGİ (jolly-showcase.js) — Roadmap #22
   ==========================================================================
   Seçilmiş/favori məhsulları tam-ekran, Instagram-story tərzi, sürüşdürərək
   göstərir. AI tələb etmir — tam JollyDB.getFavorites()-a əsaslanır.
   ========================================================================== */

(function () {
  "use strict";

  let items = [];
  let idx = 0;

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = String(s == null ? "" : s);
    return div.innerHTML;
  }

  function injectStyles() {
    if (document.getElementById("jolly-showcase-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-showcase-styles";
    style.textContent = `
      #jolly-showcase-overlay {
        position: fixed; inset: 0; background: #000; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
      }
      .jsc-progress-row {
        position: absolute; top: 10px; left: 10px; right: 10px;
        display: flex; gap: 4px; z-index: 2;
      }
      .jsc-progress-seg {
        flex: 1; height: 3px; background: rgba(255,255,255,0.25); border-radius: 2px; overflow: hidden;
      }
      .jsc-progress-seg.done { background: #d4af37; }
      .jsc-close {
        position: absolute; top: 16px; right: 14px; z-index: 3;
        background: rgba(0,0,0,0.4); border: none; color: #fff; font-size: 22px;
        width: 36px; height: 36px; border-radius: 50%;
      }
      .jsc-slide {
        width: 100%; height: 100%; display: flex; flex-direction: column;
        align-items: center; justify-content: center; padding: 60px 20px 40px;
        text-align: center; color: #fff;
      }
      .jsc-slide img {
        max-width: 100%; max-height: 55vh; border-radius: 16px; object-fit: contain;
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      }
      .jsc-slide .jsc-emoji { font-size: 100px; }
      .jsc-name { font-family: system-ui, sans-serif; font-size: 24px; font-weight: 700; margin-top: 18px; }
      .jsc-price { font-size: 30px; font-weight: 800; color: #d4af37; margin-top: 6px; }
      .jsc-sub { font-size: 13px; color: #ccc; margin-top: 4px; }
      .jsc-empty { color: #ccc; text-align: center; padding: 20px; }
      .jsc-nav-zone { position: absolute; top: 0; bottom: 0; width: 35%; z-index: 1; }
      .jsc-nav-left { left: 0; }
      .jsc-nav-right { right: 0; }
    `;
    document.head.appendChild(style);
  }

  function renderSlide() {
    const overlay = document.getElementById("jolly-showcase-overlay");
    if (!overlay) return;
    const zone = overlay.querySelector("#jsc-slide-zone");
    if (idx >= items.length) idx = items.length - 1;
    if (idx < 0) idx = 0;
    const p = items[idx];

    overlay.querySelectorAll(".jsc-progress-seg").forEach((seg, i) => {
      seg.classList.toggle("done", i <= idx);
    });

    if (!p) {
      zone.innerHTML = `<div class="jsc-slide"><div class="jsc-empty">Heç bir favori məhsul yoxdur.<br>Məhsul kartında ⭐ basıb favori et.</div></div>`;
      return;
    }

    const imgHtml = (p.images && p.images[0])
      ? `<img ${typeof JollyStorage !== "undefined" ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'}>`
      : `<div class="jsc-emoji">🧴</div>`;

    zone.innerHTML = `
      <div class="jsc-slide">
        ${imgHtml}
        <div class="jsc-name">${esc(p.name || "Adsız")}</div>
        ${p.price != null && p.price !== "" ? `<div class="jsc-price">${esc(p.price)} ₼</div>` : ""}
        <div class="jsc-sub">${[p.brand, p.group].filter(Boolean).map(esc).join(" · ")}</div>
      </div>
    `;
  }

  function next() {
    if (idx < items.length - 1) { idx++; renderSlide(); }
    else close();
  }
  function prev() {
    if (idx > 0) { idx--; renderSlide(); }
  }

  function close() {
    const overlay = document.getElementById("jolly-showcase-overlay");
    if (overlay) overlay.remove();
  }

  function show() {
    injectStyles();
    items = (typeof JollyDB !== "undefined" && JollyDB.getFavorites) ? JollyDB.getFavorites() : [];
    idx = 0;

    let overlay = document.getElementById("jolly-showcase-overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "jolly-showcase-overlay";

    const segs = items.length
      ? items.map(() => `<div class="jsc-progress-seg"></div>`).join("")
      : `<div class="jsc-progress-seg"></div>`;

    overlay.innerHTML = `
      <div class="jsc-progress-row">${segs}</div>
      <button class="jsc-close" id="jsc-close-btn">✕</button>
      <div class="jsc-nav-zone jsc-nav-left" id="jsc-nav-left"></div>
      <div class="jsc-nav-zone jsc-nav-right" id="jsc-nav-right"></div>
      <div id="jsc-slide-zone" style="width:100%;height:100%;"></div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#jsc-close-btn").onclick = close;
    overlay.querySelector("#jsc-nav-left").onclick = prev;
    overlay.querySelector("#jsc-nav-right").onclick = next;

    // Sürüşdürmə (swipe) dəstəyi
    let startX = null;
    overlay.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener("touchend", (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (dx < -50) next();
      else if (dx > 50) prev();
      startX = null;
    }, { passive: true });

    renderSlide();
  }

  window.JollyShowcase = {
    id: "showcase",
    name: "Rəqəmsal Sərgi",
    version: "1.0.0",
    show
  };

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(window.JollyShowcase);
  }
})();
