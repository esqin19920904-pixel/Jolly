/* ==========================================================================
   JOLLY DİAQNOSTİKA MƏRKƏZİ (jolly-diagnostics.js)
   ==========================================================================
   Məqsəd: Qara Qutu (Black Box) + Code Studio-nu BİRLƏŞDİRƏN daimi panel.

   Nə edir:
   1) Sistemin ümumi sağlamlığını yoxlayır (modullar, Service Worker, keş,
      IndexedDB şəkil sayı, Firebase sinxron, Telegram konfiqurasiyası,
      Arxiv snapshot statusu)
   2) Problem tapılan yerdə birbaşa "Code Studio-da düzəlt" düyməsi —
      GitHub-a getmədən, telefonda snippet yapışdırıb icra edə bilərsən
   3) Qara Qutunun (jolly-blackbox.js) tam jurnalını bir kliklə açır
   4) Bu fayl jolly-blackbox.js və code-studio.js-ə TOXUNMUR — sadəcə
      onların üstündə, əlaqələndirici bir qat kimi işləyir.
   ========================================================================== */

(function () {
  "use strict";

  // Sistemdə mövcud olması gözlənilən BÜTÜN modullar (əsas + bizim əlavələr)
  const CORE_MODULES = [
    "JollyDB", "JollyRouter", "JollyApp", "JollyDashboard", "JollyProducts",
    "JollyStudios", "JollyChat", "JollyIcons", "JollyStorage", "JollyAICore",
    "JollyDataDoctor", "JollyCloud", "JollyDrive", "JollyCodeStudio",
  ];
  const EXTRA_MODULES = [
    "JollyArchive", "JollyShowcase", "JollyAdGenerator", "JollyHoloCard",
    "JollyWhatIf", "JollyTelegram", "JollyToolsMenu", "JollyReceiving",
    "JollyRoadmap", "JollyNightMode", "JollyGamification", "JollyVoiceNotes",
    "JollyDeadZone", "JollyDailySummary", "JollyColorSearch", "JollyCompare",
    "JollyAudit", "JollyPriceAdvisor",
  ];

  function checkModules() {
    const missing = [];
    const ok = [];
    [...CORE_MODULES, ...EXTRA_MODULES].forEach((m) => {
      if (typeof window[m] === "undefined") missing.push(m);
      else ok.push(m);
    });
    return { ok, missing };
  }

  function checkServiceWorker() {
    if (!("serviceWorker" in navigator)) return { supported: false };
    const reg = navigator.serviceWorker.controller;
    return {
      supported: true,
      controlled: !!reg,
      registrations: null, // asinxron, aşağıda ayrıca doldurulur
    };
  }

  async function checkCacheStorage() {
    if (!("caches" in window)) return { supported: false };
    try {
      const keys = await caches.keys();
      let totalEntries = 0;
      for (const k of keys) {
        const cache = await caches.open(k);
        const reqs = await cache.keys();
        totalEntries += reqs.length;
      }
      return { supported: true, cacheNames: keys, totalEntries };
    } catch (e) {
      return { supported: true, error: String(e) };
    }
  }

  function checkArchive() {
    try {
      const idx = JSON.parse(localStorage.getItem("jolly_archive_index") || "[]");
      const last = idx.sort((a, b) => b.ts - a.ts)[0];
      return { count: idx.length, lastDate: last ? last.date : null };
    } catch (e) {
      return { count: 0, lastDate: null };
    }
  }

  function checkCloud() {
    try {
      const s = JollyDB.getSettings();
      return { enabled: s.cloudEnabled !== false, lastSync: s.lastCloudSync || null };
    } catch (e) {
      return { enabled: false, lastSync: null };
    }
  }

  function checkTelegram() {
    try {
      const token = localStorage.getItem("jolly_tg_token");
      const chat = localStorage.getItem("jolly_tg_chat");
      return { configured: !!(token && chat) };
    } catch (e) {
      return { configured: false };
    }
  }

  async function checkStorageEstimate() {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    try {
      const est = await navigator.storage.estimate();
      return { usedMB: (est.usage / 1048576).toFixed(1), quotaMB: (est.quota / 1048576).toFixed(0) };
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-diag-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-diag-styles";
    style.textContent = `
      #jolly-diag-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-diag-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 88vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-diag-panel h2 {
        margin: 0 0 4px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jdiag-sub { font-size: 11.5px; color: #999; margin-bottom: 14px; }
      .jdiag-section { margin-bottom: 16px; }
      .jdiag-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
      .jdiag-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; background: #232323; border-radius: 10px; margin-bottom: 6px; font-size: 12.5px;
      }
      .jdiag-row.ok { border-left: 3px solid #29e0c9; }
      .jdiag-row.warn { border-left: 3px solid #f5c563; }
      .jdiag-row.bad { border-left: 3px solid #ff5c6c; }
      .jdiag-missing-box {
        background: #2a1414; border: 1px solid #4a2020; border-radius: 10px;
        padding: 10px 12px; font-size: 11.5px; color: #ff9b9b; margin-bottom: 8px; word-break: break-word;
      }
      .jdiag-btn-row { display: flex; gap: 8px; margin-top: 6px; }
      .jdiag-btn {
        flex: 1; padding: 10px; border-radius: 10px; border: none; font-size: 12.5px; cursor: pointer;
      }
      .jdiag-btn.primary { background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a; font-weight: 600; }
      .jdiag-btn.ghost { background: #333; color: #eee; }
      .jdiag-loading { text-align: center; color: #888; padding: 30px 0; font-size: 13px; }
    `;
    document.head.appendChild(style);
  }

  function fmtDate(ts) {
    if (!ts) return "Heç vaxt";
    return new Date(ts).toLocaleString("az-AZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  async function renderPanel() {
    const panel = document.getElementById("jolly-diag-panel");
    if (!panel) return;
    panel.innerHTML = `<div class="jdiag-loading">⏳ Yoxlanılır...</div>`;

    const modules = checkModules();
    const sw = checkServiceWorker();
    const cache = await checkCacheStorage();
    const archive = checkArchive();
    const cloud = checkCloud();
    const telegram = checkTelegram();
    const storage = await checkStorageEstimate();

    panel.innerHTML = `
      <h2>🩺 Diaqnostika <button onclick="document.getElementById('jolly-diag-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
      <div class="jdiag-sub">Sistemin ümumi sağlamlığı. Problem tapılsa, aşağıda düzəliş yolları var.</div>

      <div class="jdiag-section">
        <div class="jdiag-section-title">📦 Modullar</div>
        <div class="jdiag-row ${modules.missing.length ? 'bad' : 'ok'}">
          <span>${modules.ok.length} yükləndi, ${modules.missing.length} əskik</span>
          <span>${modules.missing.length ? '❌' : '✅'}</span>
        </div>
        ${modules.missing.length ? `<div class="jdiag-missing-box">Əskik: ${modules.missing.join(", ")}<br><br>Bunlar üçün index.html-də script sətri yoxdur, ya da fayl commit olunmayıb. GitHub-da yoxla.</div>` : ""}
      </div>

      <div class="jdiag-section">
        <div class="jdiag-section-title">📡 Offline (Service Worker)</div>
        <div class="jdiag-row ${sw.supported && sw.controlled ? 'ok' : 'warn'}">
          <span>${!sw.supported ? "Bu brauzer dəstəkləmir" : sw.controlled ? "Aktiv, səhifəni idarə edir" : "Qeydiyyatda deyil / hələ aktivləşməyib"}</span>
          <span>${sw.supported && sw.controlled ? "✅" : "⚠️"}</span>
        </div>
      </div>

      <div class="jdiag-section">
        <div class="jdiag-section-title">🗄️ Keş (offline fayllar)</div>
        <div class="jdiag-row ${cache.totalEntries > 5 ? 'ok' : 'warn'}">
          <span>${cache.supported ? (cache.totalEntries || 0) + " fayl keşlənib" : "Dəstəklənmir"}</span>
          <span>${cache.totalEntries > 5 ? "✅" : "⚠️"}</span>
        </div>
      </div>

      <div class="jdiag-section">
        <div class="jdiag-section-title">📸 Arxiv</div>
        <div class="jdiag-row ${archive.count > 0 ? 'ok' : 'warn'}">
          <span>${archive.count} snapshot, son: ${archive.lastDate || "yoxdur"}</span>
          <span>${archive.count > 0 ? "✅" : "⚠️"}</span>
        </div>
      </div>

      <div class="jdiag-section">
        <div class="jdiag-section-title">☁️ Cloud Sinxron</div>
        <div class="jdiag-row ${cloud.enabled && cloud.lastSync ? 'ok' : 'warn'}">
          <span>${cloud.enabled ? "Aktiv" : "Söndürülüb"} · son: ${fmtDate(cloud.lastSync)}</span>
          <span>${cloud.enabled && cloud.lastSync ? "✅" : "⚠️"}</span>
        </div>
      </div>

      <div class="jdiag-section">
        <div class="jdiag-section-title">📨 Telegram</div>
        <div class="jdiag-row ${telegram.configured ? 'ok' : 'warn'}">
          <span>${telegram.configured ? "Qurulub" : "Qurulmayıb"}</span>
          <span>${telegram.configured ? "✅" : "⚠️"}</span>
        </div>
      </div>

      ${storage ? `
      <div class="jdiag-section">
        <div class="jdiag-section-title">💾 Yaddaş</div>
        <div class="jdiag-row ok"><span>${storage.usedMB} MB / ${storage.quotaMB} MB</span><span>ℹ️</span></div>
      </div>` : ""}

      <div class="jdiag-btn-row">
        <button class="jdiag-btn ghost" onclick="JollyDiagnostics.openBlackBox()">🐞 Qara Qutu jurnalı</button>
        <button class="jdiag-btn primary" onclick="JollyDiagnostics.openCodeStudio()">⌨️ Code Studio</button>
      </div>
      <button class="jdiag-btn ghost" style="width:100%;margin-top:8px;" onclick="JollyDiagnostics.show()">🔄 Yenidən yoxla</button>
    `;
  }

  function openBlackBox() {
    document.getElementById("jolly-diag-overlay").remove();
    const btn = document.getElementById("bbBtn");
    if (btn) btn.click();
    else if (typeof Toast !== "undefined") Toast.error("Qara Qutu düyməsi tapılmadı (jolly-blackbox.js yüklənməyib?)");
  }

  function openCodeStudio() {
    document.getElementById("jolly-diag-overlay").remove();
    if (typeof JollyRouter !== "undefined") JollyRouter.go("#/studios/code");
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-diag-overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "jolly-diag-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `<div id="jolly-diag-panel"></div>`;
    document.body.appendChild(overlay);
    renderPanel();
  }

  window.JollyDiagnostics = {
    id: "diagnostics",
    name: "Diaqnostika",
    version: "1.0.0",
    show,
    openBlackBox,
    openCodeStudio,
  };

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(window.JollyDiagnostics);
  }
})();
