/* ==========================================================================
   JOLLY STUDIOS COLOR CARDS (jolly-studios-carousel.js)
   ==========================================================================
   Fayl adı "carousel" olaraq qalıb, AMMA carousel effekti YOXDUR artıq.
   Grid strukturu TAM KÖHNƏ KİMİ qalır (2 sütun), yalnız hər kartın
   yuxarı zolağı və ikonu fərqli rəngdə parıldayır.
   ========================================================================== */

(function () {
  "use strict";

  const PALETTE = [
    "#d4af37", "#00c2ff", "#b829f7", "#ff4fa3", "#29e0c9",
    "#ff8a3d", "#4caf50", "#ff5c6c", "#7c8aff", "#f5d76e",
    "#26d0ce", "#e06cff", "#ffb74d", "#66d9c4"
  ];

  function injectStyles() {
    const old = document.getElementById("jolly-sc-styles");
    if (old) old.remove();
    const style = document.createElement("style");
    style.id = "jolly-sc-styles";
    style.textContent = `
      #main .studio-grid.jolly-carousel {
        display: grid !important;
      }
      #main .studio-grid .studio-card.jolly-color-card {
        position: relative;
        overflow: hidden;
        border-top: 3px solid var(--card-accent, #d4af37) !important;
        transition: transform 0.15s ease, box-shadow 0.25s ease;
      }
      #main .studio-grid .studio-card.jolly-color-card:active {
        transform: scale(0.97);
        box-shadow: 0 0 18px var(--card-accent-glow, rgba(212,175,55,0.4));
      }
      #main .studio-grid .studio-card.jolly-color-card .ic {
        filter: drop-shadow(0 0 6px var(--card-accent-glow, rgba(212,175,55,0.5)));
      }
      #main .studio-grid .studio-card.jolly-color-card::after {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: radial-gradient(ellipse at top left, var(--card-accent-glow, rgba(212,175,55,0.08)) 0%, transparent 60%);
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function applyColors() {
    if (location.hash !== "#/studios") return;
    const main = document.getElementById("main");
    if (!main) return;
    const grid = main.querySelector(".studio-grid");
    if (!grid) return;

    grid.classList.remove("jolly-carousel");
    const oldHint = main.querySelector(".jolly-sc-hint");
    if (oldHint) oldHint.remove();

    const cards = grid.querySelectorAll(".studio-card");
    cards.forEach((card, i) => {
      const color = PALETTE[i % PALETTE.length];
      card.classList.add("jolly-color-card");
      card.style.setProperty("--card-accent", color);
      card.style.setProperty("--card-accent-glow", hexToRgba(color, 0.35));
    });
  }

  function watchMain() {
    const main = document.getElementById("main");
    if (!main) {
      setTimeout(watchMain, 300);
      return;
    }
    const observer = new MutationObserver(() => applyColors());
    observer.observe(main, { childList: true, subtree: false });
    window.addEventListener("hashchange", () => setTimeout(applyColors, 0));
    applyColors();
  }

  function init() {
    injectStyles();
    watchMain();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
