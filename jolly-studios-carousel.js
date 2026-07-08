/* ==========================================================================
   JOLLY STUDIOS PREMIUM CARDS — TAM VERSİYA (v9)
   ==========================================================================
   Fon rəngi (mavi/bənövşəyi) kartın özündə deyil, gizli bir ::before/::after
   təbəqəsində idi — inline stil ora çata bilmirdi. Bu versiya əvvəlcə həmin
   pseudo-təbəqələri "söndürür" (kiçik stylesheet ilə, çünki inline stil
   pseudo-elementlərə təsir edə bilməz), sonra öz sakit fonunu qoyur.
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
        background-image: none !important;
        opacity: 0 !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isStudiosHubGrid(grid) {
    const titles = grid.querySelectorAll(".studio-card .title");
    for (let i = 0; i < titles.length; i++) {
      if (titles[i].textContent.trim().replace(" ✨", "") === "AI Brain") return true;
    }
    return false;
  }

  function styleCard(card) {
    card.classList.add("jolly-premium-card");
    const s = card.style;
    s.setProperty("background", "linear-gradient(160deg, #1c1c22 0%, #131318 100%)", "important");
    s.setProperty("background-image", "linear-gradient(160deg, #1c1c22 0%, #131318 100%)", "important");
    s.setProperty("border", "1px solid rgba(212,175,55,0.35)", "important");
    s.setProperty("border-radius", "18px", "important");
    s.setProperty("box-shadow", "0 10px 24px rgba(0,0,0,0.45), 0 0 16px rgba(212,175,55,0.12)", "important");
    s.setProperty("position", "relative", "important");
    s.setProperty("backdrop-filter", "none", "important");
    s.setProperty("-webkit-backdrop-filter", "none", "important");

    const icon = card.querySelector(".ic");
    if (icon) {
      icon.style.setProperty("display", "inline-flex", "important");
      icon.style.setProperty("align-items", "center", "important");
      icon.style.setProperty("justify-content", "center", "important");
      icon.style.setProperty("width", "46px", "important");
      icon.style.setProperty("height", "46px", "important");
      icon.style.setProperty("border-radius", "50%", "important");
      icon.style.setProperty("background", "radial-gradient(circle, rgba(212,175,55,0.3) 0%, rgba(212,175,55,0.05) 70%, transparent 100%)", "important");
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
  } els {
    pollAndApply();
  }
})();
