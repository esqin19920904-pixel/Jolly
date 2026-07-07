/* ==========================================================================
   JOLLY SÜRƏTLİ AUDİT MODULU (audit.js)
   ==========================================================================
   Roadmap #7: Kart-kart sürüşdürərək (sağa=yoxlanıldı, sola=keç) anbar
   yoxlaması aparmaq.

   Necə işləyir:
   - Bütün məhsulları (və ya seçilmiş filtri) növbə ilə göstərir
   - Sağa sürüşdür / "✅ Yoxlandı" düyməsi → p.lastAudited = indiki tarix
     (JollyDB.Products.update ilə, mövcud sxemi pozmadan yeni sahə əlavə edir)
   - Sola sürüşdür / "⏭️ Keç" düyməsi → sadəcə növbətiyə keçir
   - "🗑️ Sil" düyməsi → mövcud JollyProducts.deleteProduct axınından istifadə edir

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də products.js-dən SONRA əlavə et:
      <script src="audit.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  let queue = [];
  let idx = 0;
  let reviewedCount = 0;

  function buildQueue(filterFn) {
    if (typeof JollyDB === "undefined") return [];
    let all = JollyDB.Products.all();
    if (typeof filterFn === "function") all = all.filter(filterFn);
    // ən köhnə yoxlanılanlar əvvəldə
    return all.slice().sort((a, b) => (a.lastAudited || 0) - (b.lastAudited || 0));
  }

  function markReviewed(product) {
    if (typeof JollyDB !== "undefined") {
      JollyDB.Products.update(product.id, { lastAudited: Date.now() });
    }
    reviewedCount++;
    next();
  }

  function skip() {
    next();
  }

  function next() {
    idx++;
    renderCurrent();
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-audit-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-audit-styles";
    style.textContent = `
      #jolly-audit-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-audit-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-audit-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-audit-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.9);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
      }
      #jolly-audit-panel {
        background: #1a1a1a; width: 92%; max-width: 420px;
        border-radius: 20px; padding: 18px; border: 1px solid rgba(212,175,55,0.4);
        font-family: system-ui, sans-serif; color: #f0e6c8; text-align: center;
      }
      .jaud-progress { font-size: 12px; color: #999; margin-bottom: 10px; }
      .jaud-card-img {
        width: 100%; height: 200px; background: #232323; border-radius: 14px;
        display: flex; align-items: center; justify-content: center; font-size: 50px;
        margin-bottom: 12px; overflow: hidden;
      }
      .jaud-card-img img { width: 100%; height: 100%; object-fit: cover; }
      .jaud-name { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
      .jaud-meta { font-size: 12px; color: #aaa; margin-bottom: 16px; }
      .jaud-actions { display: flex; gap: 8px; }
      .jaud-btn {
        flex: 1; padding: 12px 0; border-radius: 12px; border: none;
        font-size: 13px; font-weight: 600; cursor: pointer;
      }
      .jaud-skip { background: #333; color: #eee; }
      .jaud-ok { background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a; }
      .jaud-del { background: #3a1414; color: #e57373; flex: 0 0 46px; }
      .jaud-done { padding: 30px 0; }
      .jaud-close-btn {
        width: 100%; padding: 10px; border-radius: 10px; border: none;
        background: #333; color: #eee; margin-top: 14px; cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function renderCurrent() {
    const panel = document.getElementById("jolly-audit-panel");
    if (!panel) return;

    if (idx >= queue.length) {
      panel.innerHTML = `
        <div class="jaud-done">
          <div style="font-size:40px;">🎉</div>
          <div style="font-size:16px;margin-top:10px;">Audit bitdi!</div>
          <div class="jaud-meta">${reviewedCount} məhsul yoxlanıldı</div>
        </div>
        <button class="jaud-close-btn" onclick="document.getElementById('jolly-audit-overlay').remove()">Bağla</button>
      `;
      return;
    }

    const p = queue[idx];
    const thumb = (p.images && p.images[0])
      ? `<img src="${p.images[0].startsWith("idb:") ? "" : p.images[0]}" onerror="this.style.display='none'">`
      : "🧴";

    panel.innerHTML = `
      <div class="jaud-progress">${idx + 1} / ${queue.length}</div>
      <div class="jaud-card-img">${thumb}</div>
      <div class="jaud-name">${escapeHtml(p.name || "Adsız məhsul")}</div>
      <div class="jaud-meta">${p.price != null && p.price !== "" ? p.price + " ₼ · " : ""}${escapeHtml(p.brand || "")} ${escapeHtml(p.location || "")}</div>
      <div class="jaud-actions">
        <button class="jaud-btn jaud-del" id="jaud-del">🗑️</button>
        <button class="jaud-btn jaud-skip" id="jaud-skip">⏭️ Keç</button>
        <button class="jaud-btn jaud-ok" id="jaud-ok">✅ Yoxlandı</button>
      </div>
      <button class="jaud-close-btn" onclick="document.getElementById('jolly-audit-overlay').remove()">Bağla</button>
    `;

    panel.querySelector("#jaud-ok").onclick = () => markReviewed(p);
    panel.querySelector("#jaud-skip").onclick = skip;
    panel.querySelector("#jaud-del").onclick = () => {
      if (typeof JollyProducts !== "undefined") {
        JollyProducts.deleteProduct(p.id);
      }
      next();
    };
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-audit-overlay");
    if (overlay) overlay.remove();

    queue = buildQueue();
    idx = 0;
    reviewedCount = 0;

    overlay = document.createElement("div");
    overlay.id = "jolly-audit-overlay";
    overlay.innerHTML = `<div id="jolly-audit-panel"></div>`;
    document.body.appendChild(overlay);
    renderCurrent();
  }

  function injectButton() {
    if (document.getElementById("jolly-audit-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-audit-toggle";
    btn.className = "top-act";
    btn.title = "Sürətli Audit";
    btn.innerHTML = `<span class="ta-icon">🔍</span><span class="ta-label">Audit</span>`;
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

  const JollyAudit = {
    id: "audit",
    name: "Sürətli Audit",
    version: "1.0.0",
    show
  };

  window.JollyAudit = JollyAudit;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyAudit);
    console.log("[JollyAudit] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyAudit] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyAudit.show()).");
  }
})();
