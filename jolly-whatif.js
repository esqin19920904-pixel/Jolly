/* ==========================================================================
   JOLLY "NƏ OLARDI" HESABLAYICISI (jolly-whatif.js) — Roadmap #15
   ==========================================================================
   DÜRÜST QEYD: Bu, real Gemini söhbəti DEYİL (o, hazırda işləmir). Bunun
   əvəzinə: "qiyməti X% dəyişsəm nə olar" sualına, price-advisor.js-dəki
   eyni statistik məntiqlə (qrup/firma median qiyməti) cavab verən sadə,
   AI-sız bir hesablayıcıdır.
   ========================================================================== */

(function () {
  "use strict";

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = String(s == null ? "" : s);
    return div.innerHTML;
  }

  function median(nums) {
    if (!nums.length) return null;
    const sorted = nums.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function getGroupMedian(product) {
    if (typeof JollyDB === "undefined" || !product.group) return null;
    const prices = JollyDB.Products.all()
      .filter(p => p.id !== product.id && p.group === product.group && p.price != null && p.price !== "")
      .map(p => parseFloat(p.price)).filter(n => !isNaN(n));
    return median(prices);
  }

  function injectStyles() {
    if (document.getElementById("jolly-wf-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-wf-styles";
    style.textContent = `
      #jolly-wf-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-wf-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 86vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-wf-panel h2 {
        margin: 0 0 4px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jwf-note { font-size: 11px; color: #999; margin-bottom: 12px; }
      #jwf-input {
        width: 100%; background: #232323; color: #f0e6c8; border: 1px solid #444;
        border-radius: 10px; padding: 10px 12px; font-size: 13px; box-sizing: border-box; margin-bottom: 8px;
      }
      .jwf-result-item { padding: 8px; font-size: 13px; border-bottom: 1px solid #2f2f2f; cursor: pointer; }
      .jwf-picked {
        background: #232323; border: 1px solid #333; border-radius: 12px; padding: 14px; margin-top: 12px;
      }
      .jwf-preset-row { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
      .jwf-preset-btn {
        flex: 1; min-width: 60px; padding: 8px; border-radius: 8px; border: 1px solid #444;
        background: #2a2a2a; color: #eee; font-size: 12px; cursor: pointer;
      }
      .jwf-answer { margin-top: 14px; font-size: 13.5px; line-height: 1.5; }
      .jwf-answer b { color: #d4af37; }
    `;
    document.head.appendChild(style);
  }

  let currentProduct = null;

  function renderAnswer(panel, pct) {
    const zone = panel.querySelector("#jwf-answer-zone");
    if (!currentProduct) return;
    const price = parseFloat(currentProduct.price);
    if (isNaN(price)) {
      zone.innerHTML = `<div class="jwf-answer">Bu məhsulda qiymət yazılmayıb, hesablaya bilmirəm.</div>`;
      return;
    }
    const newPrice = price * (1 + pct / 100);
    const groupMedian = getGroupMedian(currentProduct);

    let comparisonText = "";
    if (groupMedian != null) {
      const diff = ((newPrice - groupMedian) / groupMedian) * 100;
      if (Math.abs(diff) < 8) {
        comparisonText = `Bu qiymət "${esc(currentProduct.group)}" qrupunun median qiymətinə (${groupMedian.toFixed(2)} ₼) çox yaxın olardı — bazara uyğun.`;
      } else if (diff > 0) {
        comparisonText = `Bu qiymət qrupun median qiymətindən (${groupMedian.toFixed(2)} ₼) ${diff.toFixed(0)}% baha olardı.`;
      } else {
        comparisonText = `Bu qiymət qrupun median qiymətindən (${groupMedian.toFixed(2)} ₼) ${Math.abs(diff).toFixed(0)}% ucuz olardı.`;
      }
    } else {
      comparisonText = "Müqayisə üçün eyni qrupda kifayət qədər məhsul yoxdur.";
    }

    zone.innerHTML = `
      <div class="jwf-answer">
        <b>${price.toFixed(2)} ₼ → ${newPrice.toFixed(2)} ₼</b> (${pct > 0 ? "+" : ""}${pct}%)<br>
        ${comparisonText}
      </div>
    `;
  }

  function renderPicked(panel) {
    const zone = panel.querySelector("#jwf-picked-zone");
    if (!currentProduct) { zone.innerHTML = ""; return; }
    zone.innerHTML = `
      <div class="jwf-picked">
        <div>${esc(currentProduct.name || "")} — hazırkı qiymət: <b>${esc(currentProduct.price)} ₼</b></div>
        <div class="jwf-preset-row">
          <button class="jwf-preset-btn" data-pct="-20">-20%</button>
          <button class="jwf-preset-btn" data-pct="-10">-10%</button>
          <button class="jwf-preset-btn" data-pct="10">+10%</button>
          <button class="jwf-preset-btn" data-pct="20">+20%</button>
        </div>
        <div id="jwf-answer-zone"></div>
      </div>
    `;
    zone.querySelectorAll(".jwf-preset-btn").forEach(btn => {
      btn.onclick = () => renderAnswer(panel, parseFloat(btn.dataset.pct));
    });
  }

  function handleSearch(panel) {
    const input = panel.querySelector("#jwf-input");
    const resultsZone = panel.querySelector("#jwf-results-zone");
    const q = input.value.trim();
    if (!q || typeof JollyDB === "undefined") { resultsZone.innerHTML = ""; return; }
    const matches = JollyDB.Products.search(q).slice(0, 8);
    resultsZone.innerHTML = matches.map(p => `
      <div class="jwf-result-item" data-id="${p.id}">${esc(p.name || "Adsız")} ${p.price != null && p.price !== "" ? "· " + p.price + " ₼" : ""}</div>
    `).join("");
    resultsZone.querySelectorAll(".jwf-result-item").forEach(item => {
      item.onclick = () => {
        currentProduct = JollyDB.Products.get(item.dataset.id);
        renderPicked(panel);
      };
    });
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-wf-overlay");
    if (overlay) overlay.remove();
    currentProduct = null;

    overlay = document.createElement("div");
    overlay.id = "jolly-wf-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-wf-panel">
        <h2>🔮 Nə Olardı? <button onclick="document.getElementById('jolly-wf-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <div class="jwf-note">Real AI deyil — qrup median qiymətinə görə statistik hesablama.</div>
        <input id="jwf-input" placeholder="Məhsul axtar...">
        <div id="jwf-results-zone"></div>
        <div id="jwf-picked-zone"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#jwf-input").oninput = () => handleSearch(overlay.querySelector("#jolly-wf-panel"));
  }

  window.JollyWhatIf = {
    id: "whatif",
    name: "Nə Olardı?",
    version: "1.0.0",
    show
  };

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(window.JollyWhatIf);
  }
})();
