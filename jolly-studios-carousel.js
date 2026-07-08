/* ==========================================================================
   JOLLY STUDIOS CAROUSEL (jolly-studios-carousel.js)
   ==========================================================================
   Studios ana səhifəsindəki (yalnız #/studios route-u) 2-sütunlu grid-i
   üfüqi sürüşdürülən "carousel" formatına salır. studios.js-ə TOXUNMUR.

   Diqqət: .studio-grid class-ı digər səhifələrdə də istifadə olunur
   (Analytics, Theme, Voice&Vision) — ona görə bu fayl YALNIZ #/studios
   route-unda (dəqiq, alt-səhifə yox) işə düşür, digərlərinə təsir etmir.

   Necə işləyir:
   - #main-ı izləyir (MutationObserver), hər dəyişiklikdə hash yoxlanılır
   - Hash === '#/studios' (dəqiq) olanda, tapılan .studio-grid-ə
     "jolly-carousel" class-ı əlavə olunur
   - CSS həmin class üzərindən üfüqi scroll + snap effekti yaradır

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də əlavə et: <script src="jolly-studios-carousel.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  function injectStyles() {
    if (document.getElementById("jolly-sc-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-sc-styles";
    style.textContent = `
      .studio-grid.jolly-carousel {
        display: flex !important;
        grid-template-columns: none !important;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        gap: 14px;
        padding: 6px 6px 14px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .studio-grid.jolly-carousel::-webkit-scrollbar { display: none; }
      .studio-grid.jolly-carousel .studio-card {
        flex: 0 0 72%;
        scroll-snap-align: center;
        min-height: 150px;
      }
      .jolly-sc-hint {
        text-align: center;
        font-size: 11px;
        color: rgba(212,175,55,0.7);
        margin: -8px 0 12px;
        letter-spacing: 0.5px;
      }
    `;
    document.head.appendChild(style);
  }

  function applyCarousel() {
    if (location.hash !== "#/studios") return;
    const main = document.getElementById("main");
    if (!main) return;
    const grid = main.querySelector(".studio-grid");
    if (!grid || grid.classList.contains("jolly-carousel")) return;

    grid.classList.add("jolly-carousel");

    if (!main.querySelector(".jolly-sc-hint")) {
      const hint = document.createElement("div");
      hint.className = "jolly-sc-hint";
      hint.textContent = "← Sürüşdür →";
      grid.insertAdjacentElement("beforebegin", hint);
    }
  }

  function watchMain() {
    const main = document.getElementById("main");
    if (!main) {
      setTimeout(watchMain, 300);
      return;
    }
    const observer = new MutationObserver(() => applyCarousel());
    observer.observe(main, { childList: true, subtree: false });
    window.addEventListener("hashchange", () => setTimeout(applyCarousel, 0));
    applyCarousel();
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
