/* ==========================================================================
   JOLLY GECƏ REJİMİ MODULU (night-mode.js)
   ==========================================================================
   Roadmap #1: Gold temaya uyğun tünd fon variantı, axşam işləmək üçün göz
   rahatlığı.

   Necə işləyir:
   - Topbar-a (mövcud .top-actions konteynerinə) kiçik 🌙/☀️ düyməsi əlavə edir
   - Basılanda <html> elementinə "jolly-night" class-ı əlavə/silinir
   - CSS öz-özünə <style> tag kimi inject olunur (style.css-ə toxunmur)
   - Seçim localStorage-da saxlanılır, tətbiq yenidən açılanda unudulmur

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də module-registry.js-dən sonra əlavə et:
      <script src="night-mode.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "jolly_night_mode_v1";

  function isNightOn() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  const AMOLED_KEY = "jolly_amoled_mode_v1";

  function isAmoledOn() {
    try {
      return localStorage.getItem(AMOLED_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setAmoled(on) {
    try {
      localStorage.setItem(AMOLED_KEY, on ? "1" : "0");
    } catch (e) {
      console.warn("[JollyNightMode] AMOLED localStorage yazıla bilmədi:", e);
    }
    document.documentElement.classList.toggle("jolly-amoled", !!on);
    updateAmoledButton(on);
  }

  function setNight(on) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch (e) {
      console.warn("[JollyNightMode] localStorage yazıla bilmədi:", e);
    }
    applyNight(on);
    updateButton(on);
  }

  function applyNight(on) {
    document.documentElement.classList.toggle("jolly-night", !!on);
  }

  // --------------------------------------------------------------------
  // CSS - gold temaya toxunmadan, üzərinə tünd overlay/filter qatı
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-night-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-night-styles";
    style.textContent = `
      html.jolly-night body {
        background-color: #050505 !important;
      }
      html.jolly-night #app,
      html.jolly-night main,
      html.jolly-night .ambient-bg {
        filter: brightness(0.82) contrast(1.06) saturate(0.92);
      }
      html.jolly-night .topbar-pro,
      html.jolly-night .bottom-nav,
      html.jolly-night .edge-panel {
        background-color: #0a0a0a !important;
        border-color: rgba(212,175,55,0.25) !important;
      }
      html.jolly-amoled body,
      html.jolly-amoled #app,
      html.jolly-amoled .topbar-pro,
      html.jolly-amoled .bottom-nav,
      html.jolly-amoled .edge-panel {
        background-color: #000000 !important;
      }
      html.jolly-amoled #app,
      html.jolly-amoled main,
      html.jolly-amoled .ambient-bg {
        filter: brightness(0.75) contrast(1.1) saturate(0.85);
      }
      #jolly-amoled-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-amoled-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-amoled-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-night-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-night-toggle .ta-icon {
        font-size: 18px; line-height: 1;
      }
      #jolly-night-toggle .ta-label {
        font-size: 10px; margin-top: 2px; opacity: 0.85;
      }
    `;
    document.head.appendChild(style);
  }

  // --------------------------------------------------------------------
  // TOPBAR DÜYMƏSİ
  // --------------------------------------------------------------------
  function updateButton(on) {
    const btn = document.getElementById("jolly-night-toggle");
    if (!btn) return;
    btn.querySelector(".ta-icon").textContent = on ? "☀️" : "🌙";
    btn.querySelector(".ta-label").textContent = on ? "Gündüz" : "Gecə";
    btn.title = on ? "Gündüz rejiminə keç" : "Gecə rejiminə keç";
  }

  function updateAmoledButton(on) {
    const btn = document.getElementById("jolly-amoled-toggle");
    if (!btn) return;
    btn.querySelector(".ta-icon").textContent = on ? "⚫" : "◐";
    btn.querySelector(".ta-label").textContent = "AMOLED";
    btn.title = on ? "AMOLED rejimini bağla" : "AMOLED (tam qara) rejim aç";
  }

  function injectButton() {
    if (document.getElementById("jolly-night-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      // .top-actions hələ DOM-da yoxdursa, bir az sonra yenidən yoxla
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-night-toggle";
    btn.className = "top-act";
    btn.innerHTML = `<span class="ta-icon"></span><span class="ta-label"></span>`;
    btn.onclick = () => setNight(!isNightOn());
    container.appendChild(btn);
    updateButton(isNightOn());

    const amoledBtn = document.createElement("button");
    amoledBtn.id = "jolly-amoled-toggle";
    amoledBtn.className = "top-act";
    amoledBtn.innerHTML = `<span class="ta-icon"></span><span class="ta-label"></span>`;
    amoledBtn.onclick = () => setAmoled(!isAmoledOn());
    container.appendChild(amoledBtn);
    updateAmoledButton(isAmoledOn());
  }

  function init() {
    injectStyles();
    applyNight(isNightOn());
    document.documentElement.classList.toggle("jolly-amoled", isAmoledOn());
    // Düymələr artıq topbar-a inject olunmur — vahid "🧰 Alətlər" menyusundan (tools-menu.js) çağırılır
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // --------------------------------------------------------------------
  // PUBLİK API + MODULE REGISTRY
  // --------------------------------------------------------------------
  const JollyNightMode = {
    id: "night-mode",
    name: "Gecə Rejimi",
    version: "1.1.0",
    isOn: isNightOn,
    set: setNight,
    toggle: () => setNight(!isNightOn()),
    isAmoledOn,
    setAmoled,
    toggleAmoled: () => setAmoled(!isAmoledOn())
  };

  window.JollyNightMode = JollyNightMode;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyNightMode);
    console.log("[JollyNightMode] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyNightMode] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyNightMode.toggle()).");
  }
})();
