/* ==========================================================================
   JOLLY STUDIOS PREMIUM CARDS (jolly-studios-carousel.js)
   ==========================================================================
   Fintech-tərzi tünd dizayn: HAMISI EYNİ SAKİT TÜND FONDA, tək bir aksent
   rəngi (gold) — dairə fonda böyük ikon, yumşaq kölgə/dərinlik (elevation),
   daha geniş boşluq. Rəngbərəng kartlar YOXDUR, hamısı sakit və premium.
   ========================================================================== */

(function () {
  "use strict";

  const ACCENT_GLOW = "rgba(212,175,55,0.28)";

  function injectStyles() {
    const old = document.getElementById("jolly-sc-styles");
    if (old) old.remove();
    const style = document.createElement("style");
    style.id = "jolly-sc-styles";
    style.textContent = `
      #main .studio-grid .studio-card.jolly-premium-card {
        position: relative;
        background: linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%) !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
        border-radius: 18px !important;
        padding: 20px 16px !important;
        box-shadow:
          0 10px 24px rgba(0,0,0,0.35),
          0 1px 0 rgba(255,255,255,0.04) inset;
        transition: transform 0.18s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        overflow: hidden;
      }
      #main .studio-grid .studio-card.jolly-premium-card:active {
        transform: scale(0.965);
        border-color: rgba(212,175,55,0.35) !important;
        box-shadow:
          0 4px 14px rgba(0,0,0,0.4),
          0 0 22px ${ACCENT_GLOW};
      }
      #main .studio-grid .studio-card.jolly-premium-card .ic {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: radial-gradient(circle, ${ACCENT_GLOW} 0%, rgba(212,175,55,0.06) 70%, transparent 100%);
        font-size: 22px;
        margin-bottom: 12px;
      }
      #main .studio-grid .studio-card.jolly-premium-card .title {
        font-weight: 600;
        letter-spacing: 0.2px;
      }
      #main .studio-grid .studio-card.jolly-premium-card .sub {
        color: rgba(255,255,255,0.45);
        font-size: 12px;
      }
      #main .studio-grid .studio-card.jolly-premium-card::after {
        content: '';
        position: absolute;
        top: -30%; right: -20%;
        width: 60%; height: 60%;
        background: radial-gradient(circle, ${ACCENT_GLOW} 0%, transparent 70%);
        opacity: 0.5;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function applyPremiumStyle() {
    if (location.hash !== "#/studios") return;
    const main = document.getElementById("main");
    if (!main) return;
    const grid = main.querySelector(".studio-grid");
    if (!grid) return;

    grid.classList.remove("jolly-carousel");
    const oldHint = main.querySelector(".jolly-sc-hint");
    if (oldHint) oldHint.remove();

    const cards = grid.querySelectorAll(".studio-card");
    cards.forEach((card) => {
      card.classList.remove("jolly-color-card");
      card.style.removeProperty("--card-accent");
      card.style.removeProperty("--card-accent-glow");
      card.classList.add("jolly-premium-card");
    });
  }

  function watchMain() {
    const main = document.getElementById("main");
    if (!main) {
      setTimeout(watchMain, 300);
      return;
    }
    const observer = new MutationObserver(() => applyPremiumStyle());
    observer.observe(main, { childList: true, subtree: false });
    window.addEventListener("hashchange", () => setTimeout(applyPremiumStyle, 0));
    applyPremiumStyle();
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
