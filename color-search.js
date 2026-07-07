/* ==========================================================================
   JOLLY RƏNGƏ GÖRƏ AXTARIŞ MODULU (color-search.js)
   ==========================================================================
   Roadmap #5: "Qırmızı olanları göstər" — p.color sahəsinə görə məhsul tapmaq.

   Necə işləyir:
   - Bütün məhsulların p.color sahəsini toplayır, unikal rəngləri çıxarır
   - Topbar-da 🎨 düyməsi, basanda rəng çipləri açılır
   - Rəngə toxunanda o rəngdəki məhsullar JollyProducts.renderCard ilə göstərilir
     (mövcud kart görünüşü ilə tam uyğun, dublikat kod yazılmır)

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də products.js-dən SONRA əlavə et:
      <script src="color-search.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  function getColorCounts() {
    if (typeof JollyDB === "undefined") return {};
    const all = JollyDB.Products.all();
    const counts = {};
    all.forEach(p => {
      const c = (p.color || "").trim();
      if (!c) return;
      const key = c.toLowerCase();
      counts[key] = counts[key] || { label: c, count: 0 };
      counts[key].count++;
    });
    return counts;
  }

  function getProductsByColor(colorKey) {
    if (typeof JollyDB === "undefined") return [];
    return JollyDB.Products.all().filter(p => (p.color || "").trim().toLowerCase() === colorKey);
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-cs-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-cs-styles";
    style.textContent = `
      #jolly-cs-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-cs-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-cs-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-cs-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-cs-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 86vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 16px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-cs-panel h2 {
        margin: 0 0 12px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jcs-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
      .jcs-chip {
        background: #2a2a2a; border: 1px solid #444; color: #eee; font-size: 13px;
        padding: 7px 14px; border-radius: 999px; cursor: pointer;
      }
      .jcs-chip.active { background: #d4af37; color: #1a1a1a; border-color: #d4af37; }
      .jcs-back { background: none; border: none; color: #d4af37; font-size: 13px; cursor: pointer; margin-bottom: 10px; }
      .jcs-empty { text-align: center; color: #888; font-size: 13px; padding: 20px 0; }
    `;
    document.head.appendChild(style);
  }

  function renderChipsView(panel) {
    const counts = getColorCounts();
    const keys = Object.keys(counts).sort((a, b) => counts[b].count - counts[a].count);

    if (!keys.length) {
      panel.querySelector("#jcs-body").innerHTML = `<div class="jcs-empty">Heç bir məhsulda rəng qeyd olunmayıb.</div>`;
      return;
    }

    panel.querySelector("#jcs-body").innerHTML = `
      <div class="jcs-chips">
        ${keys.map(k => `<span class="jcs-chip" data-color="${k}">${counts[k].label} (${counts[k].count})</span>`).join("")}
      </div>
    `;
    panel.querySelectorAll(".jcs-chip").forEach(chip => {
      chip.onclick = () => renderResultsView(panel, chip.dataset.color, counts[chip.dataset.color].label);
    });
  }

  function renderResultsView(panel, colorKey, label) {
    const products = getProductsByColor(colorKey);
    const cardsHtml = products.length
      ? `<div class="product-grid">${products.map(p =>
          (typeof JollyProducts !== "undefined") ? JollyProducts.renderCard(p) : `<div>${p.name}</div>`
        ).join("")}</div>`
      : `<div class="jcs-empty">Bu rəngdə məhsul tapılmadı.</div>`;

    panel.querySelector("#jcs-body").innerHTML = `
      <button class="jcs-back">‹ Rənglərə qayıt</button>
      <div style="font-size:13px;color:#ccc;margin-bottom:10px;">${label} — ${products.length} məhsul</div>
      ${cardsHtml}
    `;
    panel.querySelector(".jcs-back").onclick = () => renderChipsView(panel);
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-cs-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "jolly-cs-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-cs-panel">
        <h2>🎨 Rəngə görə axtarış <button onclick="document.getElementById('jolly-cs-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <div id="jcs-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    renderChipsView(overlay.querySelector("#jolly-cs-panel"));
  }

  function injectButton() {
    if (document.getElementById("jolly-cs-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-cs-toggle";
    btn.className = "top-act";
    btn.title = "Rəngə görə axtarış";
    btn.innerHTML = `<span class="ta-icon">🎨</span><span class="ta-label">Rəng</span>`;
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

  const JollyColorSearch = {
    id: "color-search",
    name: "Rəngə görə axtarış",
    version: "1.0.0",
    show,
    getColorCounts,
    getProductsByColor
  };

  window.JollyColorSearch = JollyColorSearch;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyColorSearch);
    console.log("[JollyColorSearch] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyColorSearch] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyColorSearch.show()).");
  }
})();
