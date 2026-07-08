/* ==========================================================================
   JOLLY STUDIOS PREMIUM CARDS (jolly-studios-carousel.js)
   ==========================================================================
   DÜZƏLİŞ v2: MutationObserver-ə güvənmək əvəzinə, hər 600ms-də bir
   sadə "poll" (yoxlama) aparır — #main hansısa səbəbdən tam əvəz
   olunsa belə (köhnə observer-in "kor qalması" problemi), bu üsul
   həmişə DOM-u təzədən sorğulayır, ona görə heç vaxt "kor qalmır".
   ========================================================================== */

(function () {
  "use strict";

  const ACCENT_GLOW = "rgba(212,175,55,0.28)";

  function injectStyles() {
    if (document.getElementById("jolly-sc-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-sc-styles";
    style.textContent = `
      .studio-card.jolly-premium-card {
        position: relative !important;
        background: linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%) !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
        border-radius: 18px !important;
        padding: 20px 16px !important;
        box-shadow:
          0 10px 24px rgba(0,0,0,0.35),
          0 1px 0 rgba(255,255,255,0.04) inset !important;
        transition: transform 0.18s ease, box-shadow 0.25s ease, border-color 0.25s ease !important;
        overflow: hidden !important;
      }
      .studio-card.jolly-premium-card:active {
        transform: scale(0.965) !important;
        border-color: rgba(212,175,55,0.35) !important;
      }
      .studio-card.jolly-premium-card .ic {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 46px !important;
        height: 46px !important;
        border-radius: 50% !important;
        background: radial-gradient(circle, ${ACCENT_GLOW} 0%, rgba(212,175,55,0.06) 70%, transparent 100%) !important;
        font-size: 22px !important;
        margin-bottom: 12px !important;
      }
      .studio-card.jolly-premium-card .sub {
        color: rgba(255,255,255,0.45) !important;
      }
      .studio-card.jolly-premium-card::after {
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

  function isStudiosHubGrid(grid) {
    const titles = grid.querySelectorAll(".studio-card .title");
    for (let i = 0; i < titles.length; i++) {
      if (titles[i].textContent.trim() === "AI Brain") return true;
    }
    return false;
  }

  function pollAndApply() {
    injectStyles();
    const grids = document.querySelectorAll(".studio-grid");
    grids.forEach((grid) => {
      if (!isStudiosHubGrid(grid)) return;
      const cards = grid.querySelectorAll(".studio-card:not(.jolly-premium-card)");
      cards.forEach((card) => {
        card.classList.add("jolly-premium-card");
      });
    });
  }

  // Hər 600ms-də bir yoxla — observer-lərin "kor qalma" riski yoxdur
  setInterval(pollAndApply, 600);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pollAndApply);
  } else {
    pollAndApply();
  }
})();
