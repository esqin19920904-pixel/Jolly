/* ==========================================================================
   JOLLY STUDIOS — ŞÜŞƏ + NEON VERSİYA (v10)
   ==========================================================================
   Glassmorphism (bulanıq, yarı-şəffaf fon) + neon gold parıltı birləşməsi.
   ========================================================================== */

(function () {
  "use strict";

  function injectStyles() {
    if (document.getElementById("jolly-sc-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-sc-styles";
    style.textContent = `
      .studio-card.jolly-premium-card::before,
      .studio-card.jolly-premium-card::after {
        background: none !important;
        opacity: 0 !important;
      }
      .studio-card.jolly-premium-card {
        animation: jollyGlassPulse 4s ease-in-out infinite;
      }
      @keyframes jollyGlassPulse {
        0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 12px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.1); }
        50% { box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 22px rgba(212,175,55,0.35), inset 0 1px 0 rgba(255,255,255,0.15); }
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

  function styleCard(card) {
    card.classList.add("jolly-premium-card");
    const s = card.style;
    s.setProperty("background", "rgba(255,255,255,0.05)", "important");
    s.setProperty("background-image", "none", "important");
    s.setProperty("backdrop-filter", "blur(14px) saturate(140%)", "important");
    s.setProperty("-webkit-backdrop-filter", "blur(14px) saturate(140%)", "important");
    s.setProperty("border", "1px solid rgba(212,175,55,0.4)", "important");
    s.setProperty("border-radius", "20px", "important");
    s.setProperty("position", "relative", "important");
    s.setProperty("overflow", "hidden", "important");

    const icon = card.querySelector(".ic");
    if (icon) {
      icon.style.setProperty("display", "inline-flex", "important");
      icon.style.setProperty("align-items", "center", "important");
      icon.style.setProperty("justify-content", "center", "important");
      icon.style.setProperty("width", "48px", "important");
      icon.style.setProperty("height", "48px", "important");
      icon.style.setProperty("border-radius", "50%", "important");
      icon.style.setProperty("background", "radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0.08) 70%, transparent 100%)", "important");
      icon.style.setProperty("box-shadow", "0 0 14px rgba(212,175,55,0.4)", "important");
      icon.style.setProperty("margin-bottom", "10px", "important");
    }

    card.dataset.jollyStyled = "1";
  }

  function pollAndApply() {
    injectStyles();
    const grids = document.querySelectorAll(".studio-grid");
    grids.forEach((grid) => {
      if (!isStudiosHubGrid(grid)) return;
      grid.querySelectorAll(".studio-card").forEach((card) => {
        if (card.dataset.jollyStyled === "1") return;
        styleCard(card);
      });
    });
  }

  setInterval(pollAndApply, 600);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pollAndApply);
  } else {
    pollAndApply();
  }
})();
