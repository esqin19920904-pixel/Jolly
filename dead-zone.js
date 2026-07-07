/* ==========================================================================
   JOLLY ÖLÜ ZONA ANALİZ MODULU (dead-zone.js)
   ==========================================================================
   Roadmap #8: 60-90 gündür redaktə olunmayan/açılmayan məhsulların siyahısı
   ("bunlar unudulub, yoxla — hələ varmı, qiymət düzdürmü").

   Necə işləyir:
   - JollyDB.Products.all() üzərindən p.updatedAt-a baxır
   - Default hədd: 60 gün (dəyişdirilə bilər)
   - Topbar-da 🕸️ düyməsi, basanda siyahı açılır (ən köhnədən sıralı)
   - Mövcud JollyProducts.renderCard(p) funksiyasından istifadə edir ki,
     kartlar tam JOLLY görünüşünə uyğun olsun (dublikat UI kodu yazmır)

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də products.js-dən SONRA əlavə et:
      <script src="dead-zone.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  const DEFAULT_THRESHOLD_DAYS = 60;

  function daysSince(ts) {
    if (!ts) return Infinity;
    return Math.floor((Date.now() - ts) / 86400000);
  }

  function getStaleProducts(thresholdDays) {
    if (typeof JollyDB === "undefined") return [];
    const all = JollyDB.Products.all();
    return all
      .map(p => ({ p, days: daysSince(p.updatedAt || p.createdAt) }))
      .filter(x => x.days >= thresholdDays)
      .sort((a, b) => b.days - a.days);
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-dz-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-dz-styles";
    style.textContent = `
      #jolly-dz-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-dz-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-dz-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-dz-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-dz-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 86vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 16px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-dz-panel h2 {
        margin: 0 0 4px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jdz-sub { font-size: 12px; color: #aaa; margin-bottom: 12px; }
      .jdz-days-badge {
        display: inline-block; font-size: 10px; background: #e53935; color: #fff;
        padding: 2px 8px; border-radius: 999px; margin-bottom: 6px;
      }
      .jdz-empty { text-align: center; color: #888; font-size: 13px; padding: 30px 0; }
    `;
    document.head.appendChild(style);
  }

  function show(thresholdDays) {
    thresholdDays = thresholdDays || DEFAULT_THRESHOLD_DAYS;
    injectStyles();
    let overlay = document.getElementById("jolly-dz-overlay");
    if (overlay) overlay.remove();

    const stale = getStaleProducts(thresholdDays);

    overlay = document.createElement("div");
    overlay.id = "jolly-dz-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    let bodyHtml;
    if (!stale.length) {
      bodyHtml = `<div class="jdz-empty">🎉 ${thresholdDays} gündən köhnə unudulmuş mal yoxdur!</div>`;
    } else {
      const cardsHtml = stale.map(x => {
        const cardHtml = (typeof JollyProducts !== "undefined")
          ? JollyProducts.renderCard(x.p)
          : `<div>${x.p.name}</div>`;
        return `<div class="jdz-badge-wrap"><span class="jdz-days-badge">${x.days} gün toxunulmayıb</span>${cardHtml}</div>`;
      }).join("");
      bodyHtml = `<div class="product-grid">${cardsHtml}</div>`;
    }

    overlay.innerHTML = `
      <div id="jolly-dz-panel">
        <h2>Unudulmuş Mallar <button onclick="document.getElementById('jolly-dz-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <div class="jdz-sub">${thresholdDays}+ gündür redaktə olunmayıb (${stale.length} məhsul)</div>
        ${bodyHtml}
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function injectButton() {
    if (document.getElementById("jolly-dz-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-dz-toggle";
    btn.className = "top-act";
    btn.title = "Unudulmuş Mallar";
    btn.innerHTML = `<span class="ta-icon">🕸️</span><span class="ta-label">Unudulan</span>`;
    btn.onclick = () => show();
    container.appendChild(btn);
  }

  function init() {
    injectStyles();
    // Düymə artıq topbar-a inject olunmur — "🧰 Alətlər" menyusundan çağırılır
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  const JollyDeadZone = {
    id: "dead-zone",
    name: "Unudulmuş Mallar",
    version: "1.0.0",
    show,
    getStaleProducts
  };

  window.JollyDeadZone = JollyDeadZone;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyDeadZone);
    console.log("[JollyDeadZone] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyDeadZone] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyDeadZone.show()).");
  }
})();
