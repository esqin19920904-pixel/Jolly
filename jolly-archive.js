/* ==========================================================================
   JOLLY ARXİV SİSTEMİ (jolly-archive.js)
   ==========================================================================
   Məqsəd: A-dan Z-ə HAMISINI (məhsullar, firmalar, qruplar, yerlər,
   statuslar, tədarükçülər, ayarlar) HƏR GÜN AVTOMATİK yaddaşa alır.
   Heç nə sənin təsdiqin olmadan həmişəlik itmir.

   NECƏ İŞLƏYİR:
   1) GÜNDƏLİK SNAPSHOT — hər gün ilk açılışda (avtomatik, sənsiz) bütün
      sistemin tam köçürməsini (JollyDB.exportAll()) ayrıca yerdə saxlayır.
      Son 21 gün saxlanılır, köhnələr avtomatik silinir (yer tutmasın).
   2) FİRMA/QRUP/YER/STATUS/TƏDARÜKÇÜ QORUNMASI — bunlar əvvəllər silinəndə
      HEÇ BİR SƏBƏTƏ düşmürdü, birbaşa itirdi. İndi silinəndə əvvəlcə
      arxivə köçürülür, "Arxiv" düyməsindən İSTƏNİLƏN VAXT bərpa oluna bilər.
      (Məhsulların özü artıq JollyDB.Trash ilə qorunur — buna toxunulmayıb.)
   3) ƏL İLƏ ARXİVLƏMƏ — "İndi arxivlə" düyməsi ilə istənilən an əlavə
      snapshot ala bilərsən (gündəlik avtomatikdən asılı olmadan).
   4) SIĞORTA ÜÇÜN ENDİRMƏ — istənilən snapshot-u JSON fayl kimi telefona
      endirə bilərsən (tətbiqdən/telefondan asılı olmayan əlavə nüsxə).

   Quraşdırma: fayl JOLLY-nin flat qovluğuna atılır, index.html-də
   db.js-dən SONRA əlavə olunur: <script defer src="jolly-archive.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  const ARCHIVE_INDEX_KEY = "jolly_archive_index";
  const SNAP_PREFIX = "jolly_archive_snap_";
  const META_TRASH_KEY = "jolly_meta_trash";
  const MAX_SNAPSHOTS = 21; // ~3 həftə gündəlik

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function waitForDB(cb) {
    if (typeof JollyDB !== "undefined") { cb(); return; }
    setTimeout(() => waitForDB(cb), 300);
  }

  // ------------------------------------------------------------------------
  // GÜNDƏLİK TAM SNAPSHOT
  // ------------------------------------------------------------------------
  function getIndex() {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_INDEX_KEY) || "[]"); } catch (e) { return []; }
  }
  function setIndex(list) {
    try { localStorage.setItem(ARCHIVE_INDEX_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function takeSnapshotNow(manual) {
    if (typeof JollyDB === "undefined") return false;
    const date = todayKey();
    const data = JollyDB.exportAll();
    const key = SNAP_PREFIX + date + (manual ? "_" + Date.now() : "");
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn("[JollyArchive] snapshot yazıla bilmədi:", e);
      if (typeof Toast !== "undefined") Toast.error("Arxiv yaddaşı dolu ola bilər");
      return false;
    }
    let idx = getIndex();
    if (!manual) idx = idx.filter(x => x.date !== date); // gündəlik: eyni günü təkrarlama
    idx.unshift({ date, key, ts: Date.now(), manual: !!manual });
    // Yalnız avtomatik (gündəlik) olanları limitə tabe tut, əl ilə alınanlar toxunulmasın
    const autoOnes = idx.filter(x => !x.manual);
    if (autoOnes.length > MAX_SNAPSHOTS) {
      const toRemove = autoOnes.slice(MAX_SNAPSHOTS);
      toRemove.forEach(r => { try { localStorage.removeItem(r.key); } catch (e) {} });
      idx = idx.filter(x => !toRemove.includes(x));
    }
    setIndex(idx);
    return true;
  }

  function autoDailySnapshot() {
    const idx = getIndex();
    const today = todayKey();
    if (idx.some(x => x.date === today && !x.manual)) return; // bu gün artıq alınıb
    takeSnapshotNow(false);
    console.log("[JollyArchive] Gündəlik snapshot alındı ✅");
  }

  function restoreSnapshot(key) {
    const raw = localStorage.getItem(key);
    if (!raw) { if (typeof Toast !== "undefined") Toast.error("Arxiv tapılmadı"); return; }
    if (!confirm("Bu arxivə qayıdılsın? Hazırkı bütün məlumatlar bununla ƏVƏZ OLUNACAQ.")) return;
    try {
      const data = JSON.parse(raw);
      JollyDB.importAll(data);
      if (typeof Toast !== "undefined") Toast.success("Bərpa olundu — səhifə yenilənir...");
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      if (typeof Toast !== "undefined") Toast.error("Bərpa alınmadı — fayl korlanıb ola bilər");
    }
  }

  function downloadSnapshot(key, label) {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jolly-arxiv-${label}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ------------------------------------------------------------------------
  // FİRMA/QRUP/YER/STATUS/TƏDARÜKÇÜ QORUNMASI (meta trash)
  // ------------------------------------------------------------------------
  function getMetaTrash() {
    try { return JSON.parse(localStorage.getItem(META_TRASH_KEY) || "[]"); } catch (e) { return []; }
  }
  function setMetaTrash(list) {
    try { localStorage.setItem(META_TRASH_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function archiveMetaItem(type, record) {
    const list = getMetaTrash();
    list.unshift({ uid: "mt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), type, name: record.name || record.id, data: record, deletedAt: Date.now() });
    if (list.length > 300) list.length = 300;
    setMetaTrash(list);
  }

  const META_LABELS = { brand: "🏭 Firma", group: "📦 Qrup", location: "📍 Yer", status: "🔖 Status", supplier: "🚚 Tədarükçü" };
  const META_STORE_MAP = { brand: "Brands", group: "Groups", location: "Locations", status: "Statuses", supplier: "Suppliers" };

  function restoreMetaItem(uid) {
    const list = getMetaTrash();
    const item = list.find(x => x.uid === uid);
    if (!item) return;
    const store = JollyDB[META_STORE_MAP[item.type]];
    if (!store) return;
    const clean = { ...item.data };
    delete clean.id; // yeni id versin (təkrar toqquşma olmasın)
    store.add(clean);
    setMetaTrash(list.filter(x => x.uid !== uid));
    if (typeof Toast !== "undefined") Toast.success(`${item.name} bərpa olundu`);
    renderArchivePanel();
  }

  function purgeMetaItem(uid) {
    setMetaTrash(getMetaTrash().filter(x => x.uid !== uid));
    renderArchivePanel();
  }

  // Brands/Groups/Locations/Statuses/Suppliers .remove()-lərini "arxivləyən"
  // versiya ilə əvəz edir — db.js-in özünə TOXUNMUR, runtime-da bükür.
  function wrapMetaStores() {
    Object.keys(META_STORE_MAP).forEach(type => {
      const store = JollyDB[META_STORE_MAP[type]];
      if (!store || store._archiveWrapped) return;
      const originalRemove = store.remove;
      store.remove = function (id) {
        const record = store.get(id);
        if (record) archiveMetaItem(type, record);
        return originalRemove.call(store, id);
      };
      store._archiveWrapped = true;
    });
  }

  // ------------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-archive-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-archive-styles";
    style.textContent = `
      #jolly-archive-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-archive-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 86vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-archive-panel h2 {
        margin: 0 0 4px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jarc-sub { font-size: 11.5px; color: #999; margin-bottom: 14px; }
      .jarc-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
      .jarc-tab {
        flex: 1; text-align: center; padding: 8px; border-radius: 10px;
        background: #232323; font-size: 12.5px; cursor: pointer; border: 1px solid #333;
      }
      .jarc-tab.active { background: #d4af37; color: #1a1a1a; font-weight: 600; border-color: #d4af37; }
      .jarc-manual-btn {
        width: 100%; padding: 11px; border-radius: 10px; border: none;
        background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a;
        font-weight: 600; font-size: 13px; margin-bottom: 14px;
      }
      .jarc-item {
        background: #232323; border: 1px solid #333; border-radius: 12px;
        padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;
      }
      .jarc-item-info { flex: 1; min-width: 0; }
      .jarc-item-title { font-size: 13px; font-weight: 600; }
      .jarc-item-sub { font-size: 10.5px; color: #999; margin-top: 2px; }
      .jarc-btn-row { display: flex; gap: 6px; flex-shrink: 0; }
      .jarc-mini-btn {
        background: #333; border: none; color: #eee; font-size: 11px;
        padding: 6px 9px; border-radius: 8px; cursor: pointer; white-space: nowrap;
      }
      .jarc-mini-btn.primary { background: #d4af37; color: #1a1a1a; font-weight: 600; }
      .jarc-mini-btn.danger { background: #3a1414; color: #e57373; }
      .jarc-empty { text-align: center; color: #888; font-size: 13px; padding: 24px 0; }
    `;
    document.head.appendChild(style);
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleString("az-AZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  let activeTab = "snapshots";

  function renderArchivePanel() {
    const panel = document.getElementById("jolly-archive-panel");
    if (!panel) return;

    const snapshots = getIndex().sort((a, b) => b.ts - a.ts);
    const metaTrash = getMetaTrash();

    let bodyHtml;
    if (activeTab === "snapshots") {
      bodyHtml = snapshots.length ? snapshots.map(s => `
        <div class="jarc-item">
          <div class="jarc-item-info">
            <div class="jarc-item-title">${s.date}${s.manual ? " (əl ilə)" : ""}</div>
            <div class="jarc-item-sub">${fmtDate(s.ts)}</div>
          </div>
          <div class="jarc-btn-row">
            <button class="jarc-mini-btn" onclick="JollyArchive.download('${s.key}','${s.date}')">⬇️</button>
            <button class="jarc-mini-btn primary" onclick="JollyArchive.restore('${s.key}')">Bərpa</button>
          </div>
        </div>
      `).join("") : `<div class="jarc-empty">Hələ snapshot yoxdur — bir azdan avtomatik alınacaq, ya da "İndi arxivlə" bas.</div>`;
    } else {
      bodyHtml = metaTrash.length ? metaTrash.map(item => `
        <div class="jarc-item">
          <div class="jarc-item-info">
            <div class="jarc-item-title">${META_LABELS[item.type] || item.type}: ${escHtml(item.name)}</div>
            <div class="jarc-item-sub">Silindi: ${fmtDate(item.deletedAt)}</div>
          </div>
          <div class="jarc-btn-row">
            <button class="jarc-mini-btn danger" onclick="JollyArchive.purgeMeta('${item.uid}')">Sil</button>
            <button class="jarc-mini-btn primary" onclick="JollyArchive.restoreMeta('${item.uid}')">Bərpa</button>
          </div>
        </div>
      `).join("") : `<div class="jarc-empty">Silinən firma/qrup/yer/status/tədarükçü yoxdur.</div>`;
    }

    panel.innerHTML = `
      <h2>🗄️ Arxiv <button onclick="document.getElementById('jolly-archive-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
      <div class="jarc-sub">Hər gün avtomatik, tam köçürmə. Heç nə sənsiz həmişəlik silinmir.</div>
      <button class="jarc-manual-btn" onclick="JollyArchive.manualSnapshot()">📸 İndi arxivlə</button>
      <div class="jarc-tabs">
        <div class="jarc-tab ${activeTab === 'snapshots' ? 'active' : ''}" onclick="JollyArchive.setTab('snapshots')">📅 Gündəlik nüsxələr</div>
        <div class="jarc-tab ${activeTab === 'meta' ? 'active' : ''}" onclick="JollyArchive.setTab('meta')">🗑️ Silinən firma/qrup/s.</div>
      </div>
      <div id="jarc-body">${bodyHtml}</div>
    `;
  }

  function escHtml(s) {
    const div = document.createElement("div");
    div.textContent = String(s == null ? "" : s);
    return div.innerHTML;
  }

  function setTab(tab) {
    activeTab = tab;
    renderArchivePanel();
  }

  function manualSnapshot() {
    const ok = takeSnapshotNow(true);
    if (ok && typeof Toast !== "undefined") Toast.success("Arxivləndi ✅");
    renderArchivePanel();
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-archive-overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "jolly-archive-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `<div id="jolly-archive-panel"></div>`;
    document.body.appendChild(overlay);
    renderArchivePanel();
  }

  function init() {
    waitForDB(() => {
      wrapMetaStores();
      autoDailySnapshot();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.JollyArchive = {
    id: "archive",
    name: "Arxiv",
    version: "1.0.0",
    show,
    setTab,
    manualSnapshot,
    restore: restoreSnapshot,
    download: downloadSnapshot,
    restoreMeta: restoreMetaItem,
    purgeMeta: purgeMetaItem,
  };

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(window.JollyArchive);
  }
})();
