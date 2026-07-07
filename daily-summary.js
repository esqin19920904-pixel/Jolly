/* ==========================================================================
   JOLLY GÜNDƏLİK XÜLASƏ MODULU (daily-summary.js)
   ==========================================================================
   Roadmap #17: Səhər tətbiqi açanda mini status kartı — bu gün neçə məhsul
   əlavə olunub, şəkli olmayanlar, uzun müddət toxunulmayanlar.

   Necə işləyir:
   - Gündə BİR DƏFƏ (ilk açılışda) avtomatik açılır
   - Sonra istənilən vaxt topbar-dakı 📊 düyməsi ilə yenidən baxıla bilər
   - Heç bir mövcud fayla toxunmur, JollyDB-dən oxuyur

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də db.js-dən SONRA əlavə et:
      <script src="daily-summary.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  const LAST_SHOWN_KEY = "jolly_daily_summary_last_shown";
  const STALE_THRESHOLD_DAYS = 60;

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function isSameDay(ts, dayStr) {
    if (!ts) return false;
    return new Date(ts).toISOString().slice(0, 10) === dayStr;
  }

  function computeSummary() {
    if (typeof JollyDB === "undefined") {
      return { addedToday: 0, noImage: 0, stale: 0, total: 0 };
    }
    const all = JollyDB.Products.all();
    const today = todayKey();
    const cutoffMs = STALE_THRESHOLD_DAYS * 86400000;
    const now = Date.now();

    let addedToday = 0, noImage = 0, stale = 0;
    all.forEach(p => {
      if (isSameDay(p.createdAt, today)) addedToday++;
      if (!p.images || !p.images.length) noImage++;
      const last = p.updatedAt || p.createdAt || 0;
      if (now - last >= cutoffMs) stale++;
    });

    return { addedToday, noImage, stale, total: all.length };
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-ds-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-ds-styles";
    style.textContent = `
      #jolly-ds-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-ds-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-ds-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-ds-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
      }
      #jolly-ds-panel {
        background: #1a1a1a; width: 90%; max-width: 400px;
        border-radius: 18px; padding: 20px;
        border: 1px solid rgba(212,175,55,0.4); box-shadow: 0 0 30px rgba(212,175,55,0.2);
        font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-ds-panel h2 {
        margin: 0 0 4px; font-size: 18px; color: #d4af37; text-align: center;
      }
      .jds-date { text-align: center; font-size: 11px; color: #999; margin-bottom: 16px; }
      .jds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
      .jds-stat {
        background: #232323; border: 1px solid #333; border-radius: 12px;
        padding: 14px; text-align: center;
      }
      .jds-stat .num { font-size: 24px; font-weight: 700; color: #d4af37; }
      .jds-stat .lbl { font-size: 11px; color: #ccc; margin-top: 4px; }
      .jds-close-btn {
        width: 100%; padding: 10px; border-radius: 10px; border: none;
        background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a;
        font-weight: 600; cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-ds-overlay");
    if (overlay) overlay.remove();

    const s = computeSummary();
    const dateStr = new Date().toLocaleDateString("az-AZ", { weekday: "long", day: "2-digit", month: "long" });

    overlay = document.createElement("div");
    overlay.id = "jolly-ds-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-ds-panel">
        <h2>📊 Gündəlik Xülasə</h2>
        <div class="jds-date">${dateStr}</div>
        <div class="jds-grid">
          <div class="jds-stat"><div class="num">${s.addedToday}</div><div class="lbl">Bu gün əlavə</div></div>
          <div class="jds-stat"><div class="num">${s.total}</div><div class="lbl">Ümumi məhsul</div></div>
          <div class="jds-stat"><div class="num">${s.noImage}</div><div class="lbl">Şəkli yoxdur</div></div>
          <div class="jds-stat"><div class="num">${s.stale}</div><div class="lbl">60+ gün toxunulmayıb</div></div>
        </div>
        <button class="jds-close-btn" onclick="document.getElementById('jolly-ds-overlay').remove()">Bağla</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function maybeAutoShow() {
    let lastShown = null;
    try { lastShown = localStorage.getItem(LAST_SHOWN_KEY); } catch (e) {}
    const today = todayKey();
    if (lastShown === today) return;
    try { localStorage.setItem(LAST_SHOWN_KEY, today); } catch (e) {}
    // App tam yüklənsin deyə kiçik gecikmə
    setTimeout(show, 900);
  }

  function injectButton() {
    if (document.getElementById("jolly-ds-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-ds-toggle";
    btn.className = "top-act";
    btn.title = "Gündəlik Xülasə";
    btn.innerHTML = `<span class="ta-icon">📊</span><span class="ta-label">Xülasə</span>`;
    btn.onclick = show;
    container.appendChild(btn);
  }

  function init() {
    injectStyles();
    injectButton();
    maybeAutoShow();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  const JollyDailySummary = {
    id: "daily-summary",
    name: "Gündəlik Xülasə",
    version: "1.0.0",
    show,
    computeSummary
  };

  window.JollyDailySummary = JollyDailySummary;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyDailySummary);
    console.log("[JollyDailySummary] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyDailySummary] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyDailySummary.show()).");
  }
})();
