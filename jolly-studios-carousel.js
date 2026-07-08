/* ==========================================================================
   JOLLY STUDIOS PREMIUM CARDS — DEBUG TEST VERSİYASI
   ==========================================================================
   Bu versiya EKRANIN YUXARISINA QIRMIZI ZOLAQ əlavə edir ki, fayl
   həqiqətən yüklənib-yüklənmədiyini gözlə yoxlayaq.
   ========================================================================== */

(function () {
  "use strict";

  // 1) DƏRHAL görünən qırmızı test zolağı — bu, faylın yükləndiyinin sübutudur
  const banner = document.createElement("div");
  banner.textContent = "✅ jolly-studios-carousel.js YÜKLƏNDİ";
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
    background: red; color: white; text-align: center;
    padding: 8px; font-size: 14px; font-weight: bold;
  `;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(banner));
  if (document.body) document.body.appendChild(banner);

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
        box-shadow: 0 10px 24px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset !important;
        overflow: hidden !important;
      }
      .studio-card.jolly-premium-card .ic {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 46px !important;
        height: 46px !important;
        border-radius: 50% !important;
        background: radial-gradient(circle, ${ACCENT_GLOW} 0%, rgba(212,175,55,0.06) 70%, transparent 100%) !important;
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
      grid.querySelectorAll(".studio-card:not(.jolly-premium-card)").forEach((card) => {
        card.classList.add("jolly-premium-card");
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
