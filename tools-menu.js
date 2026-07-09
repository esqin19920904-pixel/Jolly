/* ==========================================================================
   JOLLY ALƏTLƏR MENYUSU (tools-menu.js)
   ==========================================================================
   Bütün əlavə modulları (roadmap, gecə rejimi, gamifikasiya, səsli qeydlər,
   unudulan mallar, gündəlik xülasə, rəng axtarışı, müqayisə, audit,
   qiymət tövsiyəsi) TEK bir topbar düyməsinin arxasına yığır ki, topbar
   qarışmasın, sürüşdürmə lazım olmasın.

   Necə işləyir:
   - Topbar-da YALNIZ bir düymə: 🧰 Alətlər
   - Basanda grid şəklində bütün alətlər açılır (ikon + ad)
   - Hər alətə toxunanda öz overlay-i açılır (əvvəlki kimi işləyir)

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də ƏN SONUNCU modul kimi əlavə et (bütün digər
      jolly-* modullardan SONRA), çünki hamısına istinad edir:
      <script src="tools-menu.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  function getTools() {
    const tools = [];

    if (typeof window.JollyRoadmap !== "undefined") {
      tools.push({ icon: "🗺️", label: "Gələcək Fikirlər", run: () => window.JollyRoadmap.show() });
    }
    if (typeof window.JollyNightMode !== "undefined") {
      tools.push({
        icon: window.JollyNightMode.isOn() ? "☀️" : "🌙",
        label: window.JollyNightMode.isOn() ? "Gündüz rejimi" : "Gecə rejimi",
        run: () => { window.JollyNightMode.toggle(); refreshGrid(); }
      });
      tools.push({
        icon: window.JollyNightMode.isAmoledOn() ? "◐" : "⚫",
        label: window.JollyNightMode.isAmoledOn() ? "AMOLED bağla" : "AMOLED (tam qara)",
        run: () => { window.JollyNightMode.toggleAmoled(); refreshGrid(); }
      });
    }
    if (typeof window.JollyGamification !== "undefined") {
      tools.push({ icon: "🏅", label: "Nişanların", run: () => window.JollyGamification.show() });
    }
    if (typeof window.JollyVoiceNotes !== "undefined") {
      tools.push({ icon: "🎙️", label: "Səsli Qeydlər", run: () => window.JollyVoiceNotes.show() });
    }
    if (typeof window.JollyDeadZone !== "undefined") {
      tools.push({ icon: "🕸️", label: "Unudulmuş Mallar", run: () => window.JollyDeadZone.show() });
    }
    if (typeof window.JollyDailySummary !== "undefined") {
      tools.push({ icon: "📊", label: "Gündəlik Xülasə", run: () => window.JollyDailySummary.show() });
    }
    if (typeof window.JollyColorSearch !== "undefined") {
      tools.push({ icon: "🎨", label: "Rəngə görə axtarış", run: () => window.JollyColorSearch.show() });
    }
    if (typeof window.JollyCompare !== "undefined") {
      tools.push({ icon: "⚖️", label: "Müqayisə", run: () => window.JollyCompare.show() });
    }
    if (typeof window.JollyAudit !== "undefined") {
      tools.push({ icon: "🔍", label: "Sürətli Audit", run: () => window.JollyAudit.show() });
    }
    if (typeof window.JollyPriceAdvisor !== "undefined") {
      tools.push({ icon: "💰", label: "Qiymət Tövsiyəsi", run: () => window.JollyPriceAdvisor.show() });
    }
    if (typeof window.JollyBgRemove !== "undefined") {
      tools.push({ icon: "🧹", label: "Şəkil Təmizləyici", run: () => window.JollyBgRemove.show() });
    }
    if (typeof window.JollyImageCleaner !== "undefined") {
      tools.push({ icon: "🧼", label: "Şəkil Təmizləyici", run: () => window.JollyImageCleaner.show() });
    }
    if (typeof window.JollyArchive !== "undefined") {
      tools.push({ icon: "🗄️", label: "Arxiv", run: () => window.JollyArchive.show() });
    }
    if (typeof window.JollyShowcase !== "undefined") {
      tools.push({ icon: "🎬", label: "Rəqəmsal Sərgi", run: () => window.JollyShowcase.show() });
    }
    if (typeof window.JollyAdGenerator !== "undefined") {
      tools.push({ icon: "📣", label: "Reklam Mətni", run: () => window.JollyAdGenerator.show() });
    }
    if (typeof window.JollyHoloCard !== "undefined") {
      tools.push({ icon: "🌈", label: "Holoqrafik Kart", run: () => window.JollyHoloCard.show() });
    }
    if (typeof window.JollyWhatIf !== "undefined") {
      tools.push({ icon: "🔮", label: "Nə Olardı?", run: () => window.JollyWhatIf.show() });
    }
    if (typeof window.JollyTelegram !== "undefined") {
      tools.push({ icon: "📨", label: "Telegram Bildirişləri", run: () => window.JollyTelegram.show() });
    }

    return tools;
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-tm-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-tm-styles";
    style.textContent = `
      #jolly-tm-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-tm-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-tm-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-tm-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-tm-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 82vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-tm-panel h2 {
        margin: 0 0 14px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jtm-grid {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      }
      .jtm-item {
        background: #232323; border: 1px solid #333; border-radius: 14px;
        padding: 14px 6px; text-align: center; cursor: pointer;
      }
      .jtm-item:active { background: #2a2a2a; border-color: #d4af37; }
      .jtm-item .jtm-icon { font-size: 26px; }
      .jtm-item .jtm-label { font-size: 11px; margin-top: 6px; color: #e6d9b0; line-height: 1.3; }
      .jtm-empty { text-align: center; color: #888; font-size: 13px; padding: 20px 0; }
    `;
    document.head.appendChild(style);
  }

  function refreshGrid() {
    const grid = document.querySelector("#jolly-tm-panel .jtm-grid");
    if (!grid) return;
    renderGrid(grid);
  }

  function renderGrid(grid) {
    const tools = getTools();
    if (!tools.length) {
      grid.outerHTML = `<div class="jtm-empty">Hələ heç bir əlavə alət qoşulmayıb.</div>`;
      return;
    }
    grid.innerHTML = tools.map((t, i) => `
      <div class="jtm-item" data-i="${i}">
        <div class="jtm-icon">${t.icon}</div>
        <div class="jtm-label">${t.label}</div>
      </div>
    `).join("");
    grid.querySelectorAll(".jtm-item").forEach(el => {
      el.onclick = () => {
        const tool = tools[Number(el.dataset.i)];
        document.getElementById("jolly-tm-overlay").remove();
        if (tool && typeof tool.run === "function") tool.run();
      };
    });
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-tm-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "jolly-tm-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-tm-panel">
        <h2>🧰 Alətlər <button onclick="document.getElementById('jolly-tm-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <div class="jtm-grid"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    renderGrid(overlay.querySelector(".jtm-grid"));
  }

  function injectButton() {
    if (document.getElementById("jolly-tm-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-tm-toggle";
    btn.className = "top-act";
    btn.title = "Alətlər";
    btn.innerHTML = `<span class="ta-icon">🧰</span><span class="ta-label">Alətlər</span>`;
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

  window.JollyToolsMenu = { show };
})();
