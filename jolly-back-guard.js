/* ==========================================================================
   JOLLY BACK GUARD (jolly-back-guard.js)
   ==========================================================================
   PROBLEM: Android-da "geri" düyməsi basılanda, açıq olan pəncərə (skan,
   filtr, alətlər menyusu və s.) bağlanmaq əvəzinə BÜTÜN TƏTBİQ bağlanır.
   Səbəb: bu pəncərələr brauzer tarixçəsinə (history) yeni sətir əlavə etmir,
   ona görə "geri" düyməsi birbaşa tətbiqdən çıxışa keçir.

   HƏLL: Hər dəfə bir pəncərə/overlay açılanda, süni bir tarixçə addımı
   (history.pushState) əlavə olunur. "Geri" basılanda həmin addım "istifadə
   olunur" və pəncərə bağlanır — tətbiqin özü bağlanmır. Yalnız heç bir
   pəncərə açıq olmayanda əsl "geri" davranışı (adətən tətbiqdən çıxış) baş verir.

   Əhatə etdiyi pəncərələr (zəmanətli, öz modullarımız):
   - Bütün "id$=-overlay" ilə bitən pəncərələr (Alətlər, Roadmap, Audit,
     Müqayisə, Qiymət Tövsiyəsi, Səsli Qeydlər, Unudulan Mallar və s.)
   - Edge Panel (#edgePanel.open)
   - "Daha çox" menyusu (#moreMenuOverlay.on)

   Əhatə etməyə ÇALIŞDIĞI (zəmanətsiz, sənin köhnə fayllarına bağlı):
   - Barkod skan pəncərəsi və digər naməlum modallar üçün, "Escape" düyməsi
     simulyasiya olunur (bir çox modallar bunu dinləyir, amma yəqin olduğu
     bilinmir — barcode.js görmədən zəmanət verə bilmərəm)

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də ƏN SONA əlavə et:
      <script src="jolly-back-guard.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  const GUARD_KEY = "jollyBackGuard";
  let overlayStack = []; // { id: string } sırası ilə açıq pəncərələr
  let suppressNextPop = false; // öz-özümüzə history.back() çağıranda popstate-i görməzdən gəlmək üçün

  // Bizim modullarımızın overlay ID-ləri VƏ sənin köhnə fayllarındakı overlay-lər
  // (böyük/kiçik hərfə həssas deyil, tire olsun-olmasın "overlay" ilə bitən hər id)
  function isKnownOverlayId(id) {
    return /overlay$/i.test(id || "");
  }

  function ensureSentinel() {
    if (!(history.state && history.state[GUARD_KEY] === "sentinel")) {
      history.pushState({ [GUARD_KEY]: "sentinel" }, "");
    }
  }

  function pushOverlayState(id) {
    overlayStack.push(id);
    history.pushState({ [GUARD_KEY]: "overlay", overlayId: id }, "");
  }

  function popOverlayState(fromBackButton) {
    const id = overlayStack.pop();
    if (!id) return;
    closeOverlayById(id);
    if (!fromBackButton) {
      // Pəncərə öz bağlama düyməsi ilə bağlandı — tarixçə balansını qorumaq üçün
      // süni "geri" çağırırıq, amma bunu popstate-də təkrar emal etməyək
      suppressNextPop = true;
      history.back();
    }
  }

  function closeOverlayById(id) {
    if (id === "edgePanel") {
      if (typeof window.JollyEdgePanel !== "undefined" && typeof window.JollyEdgePanel.close === "function") {
        window.JollyEdgePanel.close();
      }
      return;
    }
    if (id === "moreMenuOverlay") {
      const el = document.getElementById("moreMenuOverlay");
      if (el) el.classList.remove("on");
      return;
    }
    if (id === "scanOverlay") {
      // Barkod skaneri — sadəcə DOM-dan silmək kifayət deyil, kamera stream-i
      // düzgün dayandırmaq üçün JollyBarcode.close()-u çağırmaq lazımdır
      if (typeof window.JollyBarcode !== "undefined" && typeof window.JollyBarcode.close === "function") {
        window.JollyBarcode.close();
      } else {
        const el = document.getElementById("scanOverlay");
        if (el) el.remove();
      }
      return;
    }
    const el = document.getElementById(id);
    if (el && typeof el.remove === "function") {
      el.remove();
      return;
    }
    // Naməlum overlay — Escape simulyasiyası, bəlkə dinləyir
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  }

  // ------------------------------------------------------------------------
  // MutationObserver: bizim overlay-lərin body-ə əlavə/çıxarılmasını izləyir
  // ------------------------------------------------------------------------
  function watchOverlays() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (isKnownOverlayId(node.id)) {
            pushOverlayState(node.id);
          }
        });
        m.removedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (isKnownOverlayId(node.id) && overlayStack.includes(node.id)) {
            // Bağlandı, amma bizim "back" düyməmizdən deyil (məs. X düyməsi ilə)
            overlayStack = overlayStack.filter(x => x !== node.id);
            if (!suppressNextPop) {
              suppressNextPop = true;
              history.back();
            } else {
              suppressNextPop = false;
            }
          }
        });
      });
    });
    observer.observe(document.body, { childList: true });

    // Edge Panel və "Daha çox" menyusu class-la açılıb bağlanır (əlavə/çıxarılmır)
    const edgePanel = document.getElementById("edgePanel");
    if (edgePanel) {
      const edgeObserver = new MutationObserver(() => {
        const isOpen = edgePanel.classList.contains("open");
        const tracked = overlayStack.includes("edgePanel");
        if (isOpen && !tracked) pushOverlayState("edgePanel");
        if (!isOpen && tracked) {
          overlayStack = overlayStack.filter(x => x !== "edgePanel");
          if (!suppressNextPop) {
            suppressNextPop = true;
            history.back();
          } else {
            suppressNextPop = false;
          }
        }
      });
      edgeObserver.observe(edgePanel, { attributes: true, attributeFilter: ["class"] });
    }
  }

  // ------------------------------------------------------------------------
  // POPSTATE: "geri" düyməsi basılanda
  // ------------------------------------------------------------------------
  function onPopState(e) {
    if (suppressNextPop) {
      suppressNextPop = false;
      return;
    }
    if (overlayStack.length > 0) {
      popOverlayState(true);
      return;
    }
    // Heç bir pəncərə açıq deyil — sentinel-ə qayıtmış ola bilərik,
    // bunu yenidən quraşdırırıq ki, gələcək overlay-lər üçün hazır olsun
    ensureSentinel();
  }

  function init() {
    ensureSentinel();
    window.addEventListener("popstate", onPopState);
    if (document.body) {
      watchOverlays();
    } else {
      document.addEventListener("DOMContentLoaded", watchOverlays);
    }
    console.log("[JollyBackGuard] Aktivləşdi ✅ — pəncərələr geri düyməsi ilə bağlanacaq, tətbiq bağlanmayacaq");
  }

  init();
})();
