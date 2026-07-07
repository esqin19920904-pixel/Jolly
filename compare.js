/* ==========================================================================
   JOLLY SÜRƏTLİ MÜQAYİSƏ MODULU (compare.js)
   ==========================================================================
   Roadmap #9: İki oxşar məhsulu yan-yana (qiymət, tədarükçü, son satış/
   redaktə tarixi) müqayisə etmək.

   Necə işləyir:
   - Topbar-da ⚖️ düyməsi, basanda axtarış qutusu açılır
   - JollyDB.Products.search() ilə iki məhsul seçilir
   - Seçildikdən sonra cədvəl formatında yan-yana müqayisə göstərilir:
     ad, qiymət, firma, qrup, tədarükçü, yer, status, son redaktə tarixi

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də products.js-dən SONRA əlavə et:
      <script src="compare.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  let slotA = null;
  let slotB = null;

  function fmtDate(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleDateString("az-AZ", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) {
      return "—";
    }
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-cmp-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-cmp-styles";
    style.textContent = `
      #jolly-cmp-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-cmp-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-cmp-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-cmp-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-cmp-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 86vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 16px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-cmp-panel h2 {
        margin: 0 0 12px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jcmp-slot {
        background: #232323; border: 1px solid #333; border-radius: 12px;
        padding: 10px; margin-bottom: 10px;
      }
      .jcmp-slot input {
        width: 100%; background: #1a1a1a; color: #f0e6c8; border: 1px solid #444;
        border-radius: 8px; padding: 8px 10px; font-size: 13px; box-sizing: border-box;
      }
      .jcmp-results { margin-top: 6px; max-height: 140px; overflow-y: auto; }
      .jcmp-result-item {
        padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #2f2f2f; cursor: pointer;
      }
      .jcmp-result-item:hover { background: #2a2a2a; }
      .jcmp-picked { font-size: 13px; color: #d4af37; margin-top: 6px; }
      table.jcmp-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
      table.jcmp-table th, table.jcmp-table td {
        border: 1px solid #333; padding: 8px 6px; text-align: left; vertical-align: top;
      }
      table.jcmp-table th { color: #d4af37; width: 30%; }
      .jcmp-clear-btn {
        width: 100%; padding: 10px; border-radius: 10px; border: none;
        background: #333; color: #eee; font-size: 13px; cursor: pointer; margin-top: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  function searchInput(slotLetter, panel) {
    const inputEl = panel.querySelector(`#jcmp-input-${slotLetter}`);
    const resultsEl = panel.querySelector(`#jcmp-results-${slotLetter}`);
    const q = inputEl.value.trim();
    if (!q || typeof JollyDB === "undefined") {
      resultsEl.innerHTML = "";
      return;
    }
    const matches = JollyDB.Products.search(q).slice(0, 8);
    resultsEl.innerHTML = matches.map(p => `
      <div class="jcmp-result-item" data-id="${p.id}">${p.name || "Adsız"} ${p.price != null && p.price !== "" ? "· " + p.price + " ₼" : ""}</div>
    `).join("");
    resultsEl.querySelectorAll(".jcmp-result-item").forEach(item => {
      item.onclick = () => {
        const product = JollyDB.Products.get(item.dataset.id);
        if (slotLetter === "A") slotA = product; else slotB = product;
        renderPanelBody(panel);
      };
    });
  }

  function renderPanelBody(panel) {
    const body = panel.querySelector("#jcmp-body");
    body.innerHTML = `
      <div class="jcmp-slot">
        <input id="jcmp-input-A" placeholder="Birinci məhsulu axtar..." value="${slotA ? "" : ""}">
        <div id="jcmp-results-A" class="jcmp-results"></div>
        ${slotA ? `<div class="jcmp-picked">✅ ${slotA.name}</div>` : ""}
      </div>
      <div class="jcmp-slot">
        <input id="jcmp-input-B" placeholder="İkinci məhsulu axtar..." value="${slotB ? "" : ""}">
        <div id="jcmp-results-B" class="jcmp-results"></div>
        ${slotB ? `<div class="jcmp-picked">✅ ${slotB.name}</div>` : ""}
      </div>
      ${slotA && slotB ? renderComparisonTable() : ""}
      ${(slotA || slotB) ? `<button class="jcmp-clear-btn" id="jcmp-clear">Təmizlə</button>` : ""}
    `;

    body.querySelector("#jcmp-input-A").oninput = () => searchInput("A", panel);
    body.querySelector("#jcmp-input-B").oninput = () => searchInput("B", panel);
    const clearBtn = body.querySelector("#jcmp-clear");
    if (clearBtn) clearBtn.onclick = () => { slotA = null; slotB = null; renderPanelBody(panel); };
  }

  function renderComparisonTable() {
    const rows = [
      ["Ad", slotA.name || "—", slotB.name || "—"],
      ["Qiymət", fmtPrice(slotA.price), fmtPrice(slotB.price)],
      ["Firma", slotA.brand || "—", slotB.brand || "—"],
      ["Qrup", slotA.group || "—", slotB.group || "—"],
      ["Tədarükçü", slotA.supplier || "—", slotB.supplier || "—"],
      ["Ref yeri", slotA.location || "—", slotB.location || "—"],
      ["Status", slotA.status || "—", slotB.status || "—"],
      ["Son redaktə", fmtDate(slotA.updatedAt), fmtDate(slotB.updatedAt)],
    ];
    return `
      <table class="jcmp-table">
        <tr><th></th><th>${escapeHtml(slotA.name || "A")}</th><th>${escapeHtml(slotB.name || "B")}</th></tr>
        ${rows.slice(1).map(r => `<tr><th>${r[0]}</th><td>${escapeHtml(String(r[1]))}</td><td>${escapeHtml(String(r[2]))}</td></tr>`).join("")}
      </table>
    `;
  }

  function fmtPrice(price) {
    return (price != null && price !== "") ? price + " ₼" : "—";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-cmp-overlay");
    if (overlay) overlay.remove();
    slotA = null;
    slotB = null;

    overlay = document.createElement("div");
    overlay.id = "jolly-cmp-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-cmp-panel">
        <h2>⚖️ Müqayisə <button onclick="document.getElementById('jolly-cmp-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <div id="jcmp-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    renderPanelBody(overlay.querySelector("#jolly-cmp-panel"));
  }

  function injectButton() {
    if (document.getElementById("jolly-cmp-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-cmp-toggle";
    btn.className = "top-act";
    btn.title = "Müqayisə";
    btn.innerHTML = `<span class="ta-icon">⚖️</span><span class="ta-label">Müqayisə</span>`;
    btn.onclick = show;
    container.appendChild(btn);
  }

  function init() {
    injectStyles();
    injectButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  const JollyCompare = {
    id: "compare",
    name: "Müqayisə",
    version: "1.0.0",
    show
  };

  window.JollyCompare = JollyCompare;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyCompare);
    console.log("[JollyCompare] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyCompare] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyCompare.show()).");
  }
})();
