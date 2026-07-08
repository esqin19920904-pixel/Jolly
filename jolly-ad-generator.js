/* ==========================================================================
   JOLLY REKLAM MƏTNİ GENERATORU (jolly-ad-generator.js) — Roadmap #21
   ==========================================================================
   Real AI DEYİL (Gemini işləmədiyi üçün) — şablon-əsaslı, məhsulun öz
   məlumatlarından (ad, qiymət, firma, qrup) hazır İnstagram mətni qurur.
   ========================================================================== */

(function () {
  "use strict";

  const OPENERS = [
    "✨ Yenilik!", "🔥 Tez ol, sayı azdır!", "💎 Premium seçim", "🎯 Bu qiymətə tapılmaz!",
    "🌟 Sənin üçün seçdik", "🛍️ Yeni gəldi", "⚡ Sürətli qapış!"
  ];
  const CLOSERS = [
    "Sifariş üçün mesaj yaz 📩", "Sayı məhduddur, gecikmə! ⏳", "Sənin dolabında yeri var 👗",
    "Bugün al, sabah geyin 🙌", "DM aç, danışaq 💬", "Stoklar tükənməmiş əldə et 🚀"
  ];

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = String(s == null ? "" : s);
    return div.innerHTML;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function slugTag(s) {
    return String(s || "").trim().replace(/\s+/g, "").replace(/[^\wƏəÖöÜüĞğŞşÇçİı]/g, "");
  }

  function generateCaption(p) {
    const opener = pick(OPENERS);
    const closer = pick(CLOSERS);
    const name = p.name || "Məhsul";
    const priceLine = (p.price != null && p.price !== "") ? `\n💰 Qiymət: ${p.price} ₼` : "";
    const brandLine = p.brand ? `\n🏷️ ${p.brand}` : "";

    const tags = ["#jolly", "#магазин", "#alveraz", "#bakı"];
    if (p.brand) tags.push("#" + slugTag(p.brand).toLowerCase());
    if (p.group) tags.push("#" + slugTag(p.group).toLowerCase());
    if (p.color) tags.push("#" + slugTag(p.color).toLowerCase());

    return `${opener}\n\n${name}${brandLine}${priceLine}\n\n${closer}\n\n${[...new Set(tags)].join(" ")}`;
  }

  function injectStyles() {
    if (document.getElementById("jolly-ad-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-ad-styles";
    style.textContent = `
      #jolly-ad-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-ad-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 86vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-ad-panel h2 {
        margin: 0 0 12px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      #jad-input {
        width: 100%; background: #232323; color: #f0e6c8; border: 1px solid #444;
        border-radius: 10px; padding: 10px 12px; font-size: 13px; box-sizing: border-box; margin-bottom: 8px;
      }
      .jad-result-item { padding: 8px; font-size: 13px; border-bottom: 1px solid #2f2f2f; cursor: pointer; }
      .jad-result-item:hover { background: #232323; }
      #jad-caption {
        white-space: pre-wrap; background: #232323; border: 1px solid #333; border-radius: 12px;
        padding: 14px; margin-top: 12px; font-size: 13.5px; line-height: 1.5;
      }
      .jad-btn-row { display: flex; gap: 8px; margin-top: 10px; }
      .jad-btn {
        flex: 1; padding: 10px; border-radius: 10px; border: none; font-size: 13px; cursor: pointer;
      }
      .jad-btn.primary { background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a; font-weight: 600; }
      .jad-btn.ghost { background: #333; color: #eee; }
    `;
    document.head.appendChild(style);
  }

  let currentProduct = null;

  function renderCaption(panel) {
    const zone = panel.querySelector("#jad-report-zone");
    if (!currentProduct) { zone.innerHTML = ""; return; }
    const caption = generateCaption(currentProduct);
    zone.innerHTML = `
      <div id="jad-caption">${esc(caption)}</div>
      <div class="jad-btn-row">
        <button class="jad-btn ghost" id="jad-regen">🔄 Yenidən yarat</button>
        <button class="jad-btn primary" id="jad-copy">📋 Kopyala</button>
      </div>
    `;
    zone.querySelector("#jad-regen").onclick = () => renderCaption(panel);
    zone.querySelector("#jad-copy").onclick = () => {
      const ta = document.createElement("textarea");
      ta.value = caption;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); if (typeof Toast !== "undefined") Toast.success("Kopyalandı"); }
      catch (e) { if (typeof Toast !== "undefined") Toast.error("Kopyalanmadı"); }
      ta.remove();
    };
  }

  function handleSearch(panel) {
    const input = panel.querySelector("#jad-input");
    const resultsZone = panel.querySelector("#jad-results-zone");
    const q = input.value.trim();
    if (!q || typeof JollyDB === "undefined") { resultsZone.innerHTML = ""; return; }
    const matches = JollyDB.Products.search(q).slice(0, 8);
    resultsZone.innerHTML = matches.map(p => `
      <div class="jad-result-item" data-id="${p.id}">${esc(p.name || "Adsız")} ${p.price != null && p.price !== "" ? "· " + p.price + " ₼" : ""}</div>
    `).join("");
    resultsZone.querySelectorAll(".jad-result-item").forEach(item => {
      item.onclick = () => {
        currentProduct = JollyDB.Products.get(item.dataset.id);
        renderCaption(panel);
      };
    });
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-ad-overlay");
    if (overlay) overlay.remove();
    currentProduct = null;

    overlay = document.createElement("div");
    overlay.id = "jolly-ad-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-ad-panel">
        <h2>📣 Reklam Mətni <button onclick="document.getElementById('jolly-ad-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <input id="jad-input" placeholder="Məhsul axtar...">
        <div id="jad-results-zone"></div>
        <div id="jad-report-zone"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#jad-input").oninput = () => handleSearch(overlay.querySelector("#jolly-ad-panel"));
  }

  window.JollyAdGenerator = {
    id: "ad-generator",
    name: "Reklam Mətni",
    version: "1.0.0",
    show
  };

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(window.JollyAdGenerator);
  }
})();
