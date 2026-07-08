/* ==========================================================================
   JOLLY STUDIOS PREMIUM CARDS — İNLİNE STİL VERSİYASI (ən yüksək prioritet)
   ==========================================================================
   Əvvəlki versiyalar stylesheet class-ı ilə işləyirdi, amma sənin
   style.css-in qaydaları daha güclü çıxdı. Bu versiya HƏR KARTIN
   ÜZƏRİNƏ BİRBAŞA (inline, !important ilə) stil yazır — bu, CSS-də
   mümkün olan ƏN YÜKSƏK prioritetdir, heç nə onu üstələyə bilməz.
   ========================================================================== */

(function () {
  "use strict";

  const banner = document.createElement("div");
  banner.textContent = "✅ jolly-studios-carousel.js YÜKLƏNDİ (v8-inline)";
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
    background: red; color: white; text-align: center;
    padding: 8px; font-size: 14px; font-weight: bold;
  `;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(banner));
  if (document.body) document.body.appendChild(banner);

  function isStudiosHubGrid(grid) {
    const titles = grid.querySelectorAll(".studio-card .title");
    for (let i = 0; i < titles.length; i++) {
      if (titles[i].textContent.trim() === "AI Brain") return true;
    }
    return false;
  }

  function styleCard(card) {
    const s = card.style;
    s.setProperty("background", "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)", "important");
    s.setProperty("border", "1px solid rgba(212,175,55,0.35)", "important");
    s.setProperty("border-radius", "18px", "important");
    s.setProperty("box-shadow", "0 10px 24px rgba(0,0,0,0.4), 0 0 16px rgba(212,175,55,0.15)", "important");
    s.setProperty("position", "relative", "important");

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

    // Görünən sübut: kart başlığına kiçik işarə əlavə et
    const title = card.querySelector(".title");
    if (title && !title.dataset.jollyMarked) {
      title.dataset.jollyMarked = "1";
      title.textContent = title.textContent + " ✨";
    }

    card.dataset.jollyStyled = "1";
  }

  function pollAndApply() {
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
