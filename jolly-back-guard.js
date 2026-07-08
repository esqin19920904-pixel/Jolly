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
  // ÇIXIŞ TƏSDİQİ — tətbiq bağlanmazdan əvvəl "Bəli/Xeyr" soruşur
  // ------------------------------------------------------------------------
  function injectExitStyles() {
    if (document.getElementById("jolly-exit-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-exit-styles";
    style.textContent = `
      #jolly-exit-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.8);
        z-index: 999999; display: flex; align-items: center; justify-content: center;
      }
      #jolly-exit-box {
        background: #1a1a1a; border: 1px solid rgba(212,175,55,0.4); border-radius: 16px;
        padding: 22px; width: 82%; max-width: 320px; text-align: center;
        font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-exit-box .jx-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
      #jolly-exit-box .jx-row { display: flex; gap: 10px; }
      #jolly-exit-box button {
        flex: 1; padding: 11px; border-radius: 10px; border: none; font-size: 13px; cursor: pointer;
      }
      #jolly-exit-no { background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a; font-weight: 600; }
      #jolly-exit-yes { background: #333; color: #eee; }
    `;
    document.head.appendChild(style);
  }

  function showExitConfirm() {
    injectExitStyles();
    let overlay = document.getElementById("jolly-exit-overlay");
    if (overlay) return; // artıq açıqdır
    overlay = document.createElement("div");
    overlay.id = "jolly-exit-overlay";
    overlay.innerHTML = `
      <div id="jolly-exit-box">
        <div class="jx-title">Proqramı bağlayım?</div>
        <div class="jx-row">
          <button id="jolly-exit-no">Xeyr, qalım</button>
          <button id="jolly-exit-yes">Bəli, bağla</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#jolly-exit-no").onclick = () => {
      overlay.remove();
      ensureSentinel(); // qalmaq istəyir — tarixçəni yenidən "doldur"
    };
    overlay.querySelector("#jolly-exit-yes").onclick = () => {
      overlay.remove();
      // Heç nə etmirik — bu addım artıq "istifadə olunub", növbəti geri
      // basış tətbiqi bağlayacaq (Android-in öz davranışı).
    };
  }

  // ------------------------------------------------------------------------
  // "‹ GERİ" DÜYMƏLƏRİNİN DÜZGÜN DAVRANIŞI (ana menyuya yox, əvvəlki səhifəyə)
  // ------------------------------------------------------------------------
  function patchGoBack() {
    if (typeof window.JollyApp === "undefined") {
      setTimeout(patchGoBack, 300);
      return;
    }
    if (window.JollyApp._backGuardPatched) return;
    window.JollyApp._backGuardPatched = true;
    // Köhnə goBack() nə edirdisə (çox güman "#/home"-a aparırdı), bunu
    // əsl brauzer tarixçəsi ilə əvəz edirik ki, DƏQİQ əvvəlki səhifəyə qayıtsın.
    window.JollyApp.goBack = function () {
      history.back();
    };
    console.log("[JollyBackGuard] JollyApp.goBack() → əsl 'əvvəlki səhifə' davranışına keçirildi ✅");
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
    // VACİB FƏRQ: e.state — İNDİ HARADA olduğumuzu göstərir (haradan
    // gəldiyimizi yox). Yalnız bizim əvvəlcədən qoyduğumuz "sentinel"
    // vəziyyətinə qayıtmışıqsa, deməli geriyə HEÇ bir səhifə qalmayıb —
    // bu, əsl çıxış nöqtəsidir. Əks halda (adi səhifəyə qayıtmışıqsa,
    // e.state adətən null olur) heç nə etmirik, adi keçid davam edir.
    const state = e.state;
    if (state && state[GUARD_KEY] === "sentinel") {
      showExitConfirm();
    }
    // else: adi səhifələr arası geri keçid — bunu ENGƏLLƏMİRİK, sual vermirik
  }

  function init() {
    ensureSentinel();
    window.addEventListener("popstate", onPopState);
    if (document.body) {
      watchOverlays();
    } else {
      document.addEventListener("DOMContentLoaded", watchOverlays);
    }
    patchGoBack();
    console.log("[JollyBackGuard] Aktivləşdi ✅ — pəncərələr geri düyməsi ilə bağlanacaq, tətbiq bağlanmayacaq");
  }

  init();
})();
