/* ==========================================================================
   JOLLY VIEW TRANSITIONS (jolly-transitions.js)
   ==========================================================================
   Səhifə (route) dəyişəndə brauzerin doğma "View Transitions API"-si ilə
   cinematic keçid (cross-fade + yüngül slide) yaradır.

   - Dəstəklənən brauzerlərdə (Chrome/Samsung Internet 115+): yumşaq keçid
   - Dəstəklənməyən brauzerlərdə: heç nə dəyişmir, adi keçid davam edir
     (progressive enhancement — heç bir risk yoxdur)

   Necə işləyir:
   - JollyRouter.go(...) funksiyasını "monkey patch" ilə bükür (özünə TOXUNMUR)
   - Hər çağırışda, əgər brauzer dəstəkləyirsə, dəyişikliyi
     document.startViewTransition() içinə alır

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də ƏN SONA (app.js-dən sonra, JollyRouter artıq mövcud
      olduqdan sonra) əlavə et:
      <script src="jolly-transitions.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  function supportsViewTransitions() {
    return typeof document.startViewTransition === "function";
  }

  function injectStyles() {
    if (document.getElementById("jolly-vt-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-vt-styles";
    style.textContent = `
      ::view-transition-old(root) {
        animation: jollyVtFadeOut 0.22s ease forwards;
      }
      ::view-transition-new(root) {
        animation: jollyVtFadeIn 0.28s ease forwards;
      }
      @keyframes jollyVtFadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.985); }
      }
      @keyframes jollyVtFadeIn {
        from { opacity: 0; transform: scale(1.015); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  const HERO_NAME = "jolly-hero-product";

  function extractProductId(hash) {
    const m = /^#\/product\/([^/?]+)/.exec(hash || "");
    return m ? m[1] : null;
  }

  function tagOutgoingCard(productId) {
    if (!productId) return null;
    const card = document.querySelector(`.product-card[data-id="${CSS.escape(productId)}"] .thumb`);
    if (card) {
      card.style.viewTransitionName = HERO_NAME;
      return card;
    }
    return null;
  }

  function tagIncomingDetail() {
    const target = document.querySelector(".image-strip .image-slot, .image-strip img");
    if (target) target.style.viewTransitionName = HERO_NAME;
    return target;
  }

  function clearHeroName(el) {
    if (el && el.style) el.style.viewTransitionName = "";
  }

  function patchRouter() {
    if (typeof window.JollyRouter === "undefined" || typeof window.JollyRouter.go !== "function") {
      // JollyRouter hələ hazır deyilsə, bir az sonra yenidən yoxla
      setTimeout(patchRouter, 300);
      return;
    }
    if (window.JollyRouter._jollyVtPatched) return;
    window.JollyRouter._jollyVtPatched = true;

    const originalGo = window.JollyRouter.go;
    window.JollyRouter.go = function (...args) {
      if (!supportsViewTransitions()) {
        originalGo.apply(this, args);
        return;
      }

      const targetHash = args[0];
      const productId = extractProductId(targetHash);
      let outgoingEl = null;
      if (productId) {
        outgoingEl = tagOutgoingCard(productId);
      }

      const vt = document.startViewTransition(() => {
        originalGo.apply(this, args);
        if (productId) tagIncomingDetail();
      });

      vt.finished.finally(() => {
        clearHeroName(outgoingEl);
        const incoming = document.querySelector(`[style*="${HERO_NAME}"]`);
        clearHeroName(incoming);
      });
    };
    console.log("[JollyTransitions] JollyRouter.go-ya qoşuldu ✅ (dəstək: " + supportsViewTransitions() + ", kart→detal morph daxil)");
  }

  function init() {
    injectStyles();
    patchRouter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
