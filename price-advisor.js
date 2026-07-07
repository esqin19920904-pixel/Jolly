/* ==========================================================================
   JOLLY QİYMƏT TÖVSİYƏSİ MODULU (price-advisor.js)
   ==========================================================================
   Roadmap #13: Tarixçə + oxşar mallara baxıb qiymət artır/azalt tövsiyəsi.

   Qeyd: Bu, real AI deyil — eyni qrup/firmadakı digər məhsulların orta
   qiymətinə əsaslanan sadə statistik heuristikadır. Real Gemini AI
   inteqrasiyası üçün jolly-gemini.js-in məzmununu göndər, üstünə qurum.

   Necə işləyir:
   - Topbar-da 💰 düyməsi, basanda axtarış qutusu açılır
   - Məhsul seçiləndə: eyni qrupdakı və eyni firmadakı digər malların
     orta/median qiymətini hesablayır, fərqi görsədir
   - "10%+ ucuz/bahalı" kimi sadə tövsiyə mətni verir

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də products.js-dən SONRA əlavə et:
      <script src="price-advisor.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  function median(nums) {
    if (!nums.length) return null;
    const sorted = nums.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function average(nums) {
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function analyze(product) {
    if (typeof JollyDB === "undefined") return null;
    const all = JollyDB.Products.all().filter(p => p.id !== product.id && p.price != null && p.price !== "");

    const sameGroup = product.group ? all.filter(p => p.group === product.group) : [];
    const sameBrand = product.brand ? all.filter(p => p.brand === product.brand) : [];

    const groupPrices = sameGroup.map(p => parseFloat(p.price)).filter(n => !isNaN(n));
    const brandPrices = sameBrand.map(p => parseFloat(p.price)).filter(n => !isNaN(n));

    return {
      product,
      groupCount: groupPrices.length,
      groupAvg: average(groupPrices),
      groupMedian: median(groupPrices),
      brandCount: brandPrices.length,
      brandAvg: average(brandPrices),
      brandMedian: median(brandPrices)
    };
  }

  function buildAdvice(result) {
    const price = parseFloat(result.product.price);
    if (isNaN(price)) return "Bu məhsulda qiymət yazılmayıb, müqayisə edilə bilmir.";

    const ref = result.groupMedian != null ? result.groupMedian : result.brandMedian;
    const refLabel = result.groupMedian != null ? `"${result.product.group}" qrupunun median qiyməti` : `"${result.product.brand}" firmasının median qiyməti`;

    if (ref == null) return "Müqayisə üçün kifayət qədər oxşar məhsul yoxdur.";

    const diffPct = ((price - ref) / ref) * 100;
    let verdict;
    if (Math.abs(diffPct) < 8) {
      verdict = "✅ Qiymət bazara uyğundur.";
    } else if (diffPct >= 8) {
      verdict = `⬆️ Bu məhsul ${refLabel}dən ${diffPct.toFixed(0)}% bahadır — bazara uyğunlaşdırmaq istəyirsənsə azalda bilərsən.`;
    } else {
      verdict = `⬇️ Bu məhsul ${refLabel}dən ${Math.abs(diffPct).toFixed(0)}% ucuzdur — istəsən qaldıra bilərsən.`;
    }
    return verdict;
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-pa-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-pa-styles";
    style.textContent = `
      #jolly-pa-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-pa-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-pa-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-pa-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-pa-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 84vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 16px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-pa-panel h2 {
        margin: 0 0 12px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      #jpa-input {
        width: 100%; background: #232323; color: #f0e6c8; border: 1px solid #444;
        border-radius: 10px; padding: 10px 12px; font-size: 13px; box-sizing: border-box; margin-bottom: 8px;
      }
      .jpa-result-item { padding: 8px; font-size: 13px; border-bottom: 1px solid #2f2f2f; cursor: pointer; }
      .jpa-result-item:hover { background: #232323; }
      .jpa-report {
        background: #232323; border: 1px solid #333; border-radius: 12px;
        padding: 14px; margin-top: 12px;
      }
      .jpa-report .jpa-price { font-size: 22px; font-weight: 700; color: #d4af37; }
      .jpa-report .jpa-verdict { font-size: 13px; margin-top: 8px; line-height: 1.4; }
      .jpa-report .jpa-stat { font-size: 11px; color: #999; margin-top: 6px; }
    `;
    document.head.appendChild(style);
  }

  function renderReport(result) {
    const panel = document.getElementById("jolly-pa-panel");
    const report = panel.querySelector("#jpa-report-zone");
    const p = result.product;
    report.innerHTML = `
      <div class="jpa-report">
        <div>${escapeHtml(p.name || "")}</div>
        <div class="jpa-price">${p.price} ₼</div>
        <div class="jpa-verdict">${buildAdvice(result)}</div>
        ${result.groupCount ? `<div class="jpa-stat">Qrup ("${escapeHtml(p.group)}"): ${result.groupCount} məhsul, orta ${result.groupAvg.toFixed(2)} ₼, median ${result.groupMedian.toFixed(2)} ₼</div>` : ""}
        ${result.brandCount ? `<div class="jpa-stat">Firma ("${escapeHtml(p.brand)}"): ${result.brandCount} məhsul, orta ${result.brandAvg.toFixed(2)} ₼, median ${result.brandMedian.toFixed(2)} ₼</div>` : ""}
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function handleSearch(panel) {
    const input = panel.querySelector("#jpa-input");
    const resultsZone = panel.querySelector("#jpa-results-zone");
    const q = input.value.trim();
    if (!q || typeof JollyDB === "undefined") {
      resultsZone.innerHTML = "";
      return;
    }
    const matches = JollyDB.Products.search(q).slice(0, 8);
    resultsZone.innerHTML = matches.map(p => `
      <div class="jpa-result-item" data-id="${p.id}">${escapeHtml(p.name || "Adsız")} ${p.price != null && p.price !== "" ? "· " + p.price + " ₼" : ""}</div>
    `).join("");
    resultsZone.querySelectorAll(".jpa-result-item").forEach(item => {
      item.onclick = () => {
        const product = JollyDB.Products.get(item.dataset.id);
        const result = analyze(product);
        if (result) renderReport(result);
      };
    });
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-pa-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "jolly-pa-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-pa-panel">
        <h2>💰 Qiymət Tövsiyəsi <button onclick="document.getElementById('jolly-pa-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <input id="jpa-input" placeholder="Məhsul axtar...">
        <div id="jpa-results-zone"></div>
        <div id="jpa-report-zone"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#jpa-input").oninput = () => handleSearch(overlay.querySelector("#jolly-pa-panel"));
  }

  function injectButton() {
    if (document.getElementById("jolly-pa-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-pa-toggle";
    btn.className = "top-act";
    btn.title = "Qiymət Tövsiyəsi";
    btn.innerHTML = `<span class="ta-icon">💰</span><span class="ta-label">Qiymət</span>`;
    btn.onclick = show;
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

  const JollyPriceAdvisor = {
    id: "price-advisor",
    name: "Qiymət Tövsiyəsi",
    version: "1.0.0",
    show,
    analyze
  };

  window.JollyPriceAdvisor = JollyPriceAdvisor;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyPriceAdvisor);
    console.log("[JollyPriceAdvisor] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyPriceAdvisor] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyPriceAdvisor.show()).");
  }
})();
