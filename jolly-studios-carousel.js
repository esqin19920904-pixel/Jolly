/* ==========================================================================
   JOLLY STUDIOS PREMIUM CARDS (jolly-studios-carousel.js)
   ==========================================================================
   Fintech-tərzi tünd dizayn: HAMISI EYNİ SAKİT TÜND FONDA, tək bir aksent
   rəngi (gold) — dairə fonda böyük ikon, yumşaq kölgə/dərinlik (elevation).

   DÜZƏLİŞ: Artıq location.hash === '#/studios' YOXLAMIR (bu heç vaxt doğru
   olmurdu, çünki "Studio" düyməsi URL-i dəyişmədən səhifəni render edir).
   Bunun əvəzinə .studio-grid-in İÇİNDƏ "AI Brain" adlı kart olub-olmadığını
   yoxlayır — bu, yalnız əsl Studios ana səhifəsində olur (Analytics, Theme
   və digər səhifələrdə belə kart yoxdur).
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

  // Bu, əsl Studios ana səhifəsidirmi? (hash-ə güvənmədən, məzmuna görə yoxla)
  function isStudiosHubGrid(grid) {
    const titles = grid.querySelectorAll(".studio-card .title");
    for (let i = 0; i < titles.length; i++) {
      if (titles[i].textContent.trim() === "AI Brain") return true;
    }
    return false;
  }

  function applyPremiumStyle() {
    const main = document.getElementById("main");
    if (!main) return;
    const grid = main.querySelector(".studio-grid");
    if (!grid) return;
    if (!isStudiosHubGrid(grid)) return;

    grid.classList.remove("jolly-carousel");
    const oldHint = main.querySelector(".jolly-sc-hint");
    if (oldHint) oldHint.remove();

    const cards = grid.querySelectorAll(".studio-card");
    cards.forEach((card) => {
      if (card.classList.contains("jolly-premium-card")) return;
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
    observer.observe(main, { childList: true, subtree: true });
    window.addEventListener("hashchange", () => setTimeout(applyPremiumStyle, 0));
    applyPremiumStyle();
    // Topbar-dakı "Studio" düyməsi URL dəyişmədən render edə bilər —
    // ona görə bir neçə dəfə təkrar yoxlayaq (kiçik gecikmələrlə)
    setTimeout(applyPremiumStyle, 300);
    setTimeout(applyPremiumStyle, 800);
    setTimeout(applyPremiumStyle, 1500);
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
