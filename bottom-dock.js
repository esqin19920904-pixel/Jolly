/* ============================================================
   JOLLY Bottom Dock — Aşağıdan Qalxan Sürətli Keçid Paneli
   Ekranın sol-alt küncündə kiçik ⌃ tab. Basanda aşağıdan yuxarı
   sürüşən panel açılır:
   - Sənin PİN etdiyin qısayollar (toxun = get, ✕ = çıxar)
   - Axtarışlı tam KATALOQ (proqramdakı HƏR ŞEY): köhnə statik
     marşrutlar (Ana səhifə, Yeni məhsul, Skan və s. — Edge Panel-in
     kataloqundan) + ModuleRegistry-ə qeydiyyatdan keçən HƏR modul
     (Qəbul Studio, Skan ilə Qəbul, Filtrləmə, Tədarükçü Sifarişi
     və s.) AVTOMATİK daxildir — yeni modul əlavə olunanda bu
     kataloq özü yenilənir, heç nə əl ilə redaktə etməyə ehtiyac yox.

   Tamamilə müstəqil, yan Edge Panel-ə toxunmur (ayrı parametr
   açarı istifadə edir).
   ============================================================ */

const JollyBottomDock = (() => {
  const CFG_KEY = 'jolly_bottom_dock_config';
  const DEFAULT_ITEMS = ['home', 'newProduct', 'products', 'drafts', 'scan'];

  let searchTerm = '';

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function getConfig() { return JollyDB.read(CFG_KEY, { items: DEFAULT_ITEMS.slice() }); }
  function setConfig(c) { JollyDB.write(CFG_KEY, c); }

  // Köhnə statik marşrutlar (Edge Panel kataloqundan) + ModuleRegistry-dəki
  // BÜTÜN modullar — birləşdirilmiş, HƏMİŞƏ tam kataloq.
  function fullCatalog() {
    const core = (typeof JollyStudios !== 'undefined' && JollyStudios.getEdgeCatalog) ? JollyStudios.getEdgeCatalog() : [];
    const dynamic = (typeof ModuleRegistry !== 'undefined') ? ModuleRegistry.list().map(m => ({ id: 'mod_' + m.id, label: m.name, icon: m.icon, route: m.route })) : [];
    return [...core, ...dynamic];
  }

  function catalogItem(id) {
    return fullCatalog().find(x => x.id === id) || null;
  }

  function clickAttr(item) {
    return item.action ? esc(item.action).replace(/&quot;/g, '"').replace(/&#39;/g, "'") : `JollyRouter.go('${item.route}')`;
  }

  /* ============================================================
     DOM — tab + panel
     ============================================================ */
  function ensureDom() {
    let root = document.getElementById('jbdRoot');
    if (root) return root;
    injectStyles();
    root = document.createElement('div');
    root.id = 'jbdRoot';
    root.innerHTML = `<button id="jbdTab" title="Sürətli keçidlər">⌃</button>`;
    document.body.appendChild(root);
    document.getElementById('jbdTab').addEventListener('click', openSheet);
    return root;
  }

  function injectStyles() {
    if (document.getElementById('jbd-styles')) return;
    const style = document.createElement('style');
    style.id = 'jbd-styles';
    style.textContent = `
      #jbdTab { position: fixed; left: 14px; bottom: 90px; z-index: 480;
        width: 46px; height: 46px; border-radius: 16px; border: none;
        background: rgba(255,255,255,0.08);
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.16);
        box-shadow: 0 6px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12);
        display: flex; align-items: center; justify-content: center;
        font-size: 19px; color: #fff; }
      .jbd-row { display: flex; align-items: center; gap: 10px; padding: 10px 4px;
        border-bottom: 1px solid rgba(255,255,255,0.06); }
      .jbd-row:last-child { border-bottom: none; }
      .jbd-ic { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }
      .jbd-lbl { flex: 1; min-width: 0; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }

  function openSheet() {
    searchTerm = '';
    let overlay = document.getElementById('jbdOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'jbdOverlay';
    overlay.className = 'qa-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });
    overlay.innerHTML = `
      <div class="glass qa-sheet" style="max-height:85vh;overflow-y:auto;">
        <div class="row between" style="margin-bottom:14px;">
          <div style="font-weight:700;font-size:16px;">🗂️ Sürətli Keçidlər</div>
          <button class="icon-btn" onclick="JollyBottomDock.closeSheet()">✕</button>
        </div>

        <div class="section-title" style="margin-top:0;">📌 Sənin keçidlərin</div>
        <div class="glass" style="padding:4px 10px;margin-bottom:16px;" id="jbdPinnedList">
          ${renderPinnedRows()}
        </div>

        <div class="section-title">➕ Əlavə et</div>
        <div class="glass command-bar" style="margin-bottom:10px;">
          <span style="opacity:.6">🔎</span>
          <input id="jbdSearch" placeholder="Axtar..." oninput="JollyBottomDock.setSearch(this.value)">
        </div>
        <div class="glass" style="padding:4px 10px;" id="jbdCatalogList">
          ${renderCatalogRows()}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function closeSheet() {
    const overlay = document.getElementById('jbdOverlay');
    if (overlay) { overlay.classList.remove('on'); setTimeout(() => overlay.remove(), 200); }
  }

  function renderPinnedRows() {
    const cfg = getConfig();
    const items = cfg.items.map(id => catalogItem(id)).filter(Boolean);
    if (!items.length) return '<div class="muted" style="padding:12px;font-size:12px;">Hələ heç nə əlavə etməmisən — aşağıdan seç</div>';
    return items.map(it => `
      <div class="jbd-row">
        <span class="jbd-ic">${it.icon}</span>
        <span class="jbd-lbl" style="cursor:pointer;" onclick="JollyBottomDock.go('${it.id}')">${esc(it.label)}</span>
        <span onclick="JollyBottomDock.unpin('${it.id}')" style="color:var(--accent-danger);cursor:pointer;padding:0 6px;flex-shrink:0;">✕</span>
      </div>
    `).join('');
  }

  function renderCatalogRows() {
    const cfg = getConfig();
    const q = searchTerm.trim().toLowerCase();
    let items = fullCatalog().filter(it => !cfg.items.includes(it.id));
    if (q) items = items.filter(it => it.label.toLowerCase().includes(q));
    if (!items.length) return '<div class="muted" style="padding:12px;font-size:12px;">Nəticə yoxdur</div>';
    return items.map(it => `
      <div class="jbd-row">
        <span class="jbd-ic">${it.icon}</span>
        <span class="jbd-lbl">${esc(it.label)}</span>
        <span onclick="JollyBottomDock.pin('${it.id}')" style="color:var(--accent-2);cursor:pointer;padding:0 6px;flex-shrink:0;">+ əlavə</span>
      </div>
    `).join('');
  }

  function refresh() {
    const p = document.getElementById('jbdPinnedList');
    const c = document.getElementById('jbdCatalogList');
    if (p) p.innerHTML = renderPinnedRows();
    if (c) c.innerHTML = renderCatalogRows();
  }

  function setSearch(v) { searchTerm = v; const c = document.getElementById('jbdCatalogList'); if (c) c.innerHTML = renderCatalogRows(); }

  function pin(id) {
    const cfg = getConfig();
    if (!cfg.items.includes(id)) cfg.items.push(id);
    setConfig(cfg);
    if (typeof JollySound !== 'undefined') JollySound.tap();
    refresh();
  }
  function unpin(id) {
    const cfg = getConfig();
    cfg.items = cfg.items.filter(x => x !== id);
    setConfig(cfg);
    refresh();
  }

  function go(id) {
    const it = catalogItem(id);
    closeSheet();
    if (!it) return;
    if (it.action) {
      try { new Function(it.action)(); } catch (e) { console.error('JollyBottomDock action error', e); }
    } else if (it.route) {
      JollyRouter.go(it.route);
    }
  }

  function init() { ensureDom(); }
  document.addEventListener('DOMContentLoaded', () => { setTimeout(init, 200); });

  return { openSheet, closeSheet, pin, unpin, go, setSearch };
})();
