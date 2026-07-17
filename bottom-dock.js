/* ============================================================
   JOLLY Bottom Dock — "Nə axtarırsan?" + Sürətli Keçidlər
   Ekranın sol-alt küncündə kiçik ⌃ tab. Basanda aşağıdan yuxarı
   axtarış paneli açılır: proqramdakı HƏR ŞEYİ (köhnə statik
   səhifələr + ModuleRegistry-ə qeydiyyatdan keçən HƏR yeni modul —
   Qəbul Studio, Skan ilə Qəbul, Filtrləmə, Tədarükçü Sifarişi və s.)
   TEK bir siyahıda göstərir, yazdıqca canlı süzülür.

   - Sətrə toxun → birbaşa o səhifəyə keçir
   - ⭐/☆ → "sürətli keçid" kimi qeyd et (qeyd olunanlar yuxarıda
     görünür), heç nə etməsən də axtarış öz-özünə kifayət edir

   Yeni modul əlavə olunanda bu siyahı AVTOMATİK yenilənir (heç bir
   əl işi lazım deyil), çünki ModuleRegistry-dən canlı oxunur.

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

  /* ============================================================
     DOM — tab + panel
     ============================================================ */
  function ensureDom() {
    let root = document.getElementById('jbdRoot');
    if (root) return root;
    injectStyles();
    root = document.createElement('div');
    root.id = 'jbdRoot';
    root.innerHTML = `<button id="jbdTab" title="Nə axtarırsan?">⌃</button>`;
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
      .jbd-row { display: flex; align-items: center; gap: 10px; padding: 11px 4px;
        border-bottom: 1px solid rgba(255,255,255,0.06); }
      .jbd-row:last-child { border-bottom: none; }
      .jbd-ic { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }
      .jbd-lbl { flex: 1; min-width: 0; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
      .jbd-star { flex-shrink: 0; padding: 0 6px; cursor: pointer; font-size: 16px; }
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
          <div style="font-weight:700;font-size:16px;">🔎 Nə axtarırsan?</div>
          <button class="icon-btn" onclick="JollyBottomDock.closeSheet()">✕</button>
        </div>
        <div class="glass command-bar" style="margin-bottom:10px;">
          <span style="opacity:.6">🔎</span>
          <input id="jbdSearch" placeholder="məs. sifariş, filtr, skan..." oninput="JollyBottomDock.setSearch(this.value)">
        </div>
        <p class="muted" style="font-size:11px;margin:0 0 10px;">⭐ = sürətli keçid kimi qeyd et (yuxarıda görünər)</p>
        <div id="jbdList">${renderRows()}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));
    setTimeout(() => { const inp = document.getElementById('jbdSearch'); if (inp) inp.focus(); }, 280);
  }

  function closeSheet() {
    const overlay = document.getElementById('jbdOverlay');
    if (overlay) { overlay.classList.remove('on'); setTimeout(() => overlay.remove(), 200); }
  }

  function renderRows() {
    const cfg = getConfig();
    const q = searchTerm.trim().toLowerCase();
    let items = fullCatalog().slice();
    // Qeyd olunanlar (⭐) yuxarıda
    items.sort((a, b) => {
      const ap = cfg.items.includes(a.id) ? 0 : 1;
      const bp = cfg.items.includes(b.id) ? 0 : 1;
      return ap - bp;
    });
    if (q) items = items.filter(it => it.label.toLowerCase().includes(q));
    if (!items.length) return '<div class="muted" style="padding:16px;font-size:12px;text-align:center;">Nəticə tapılmadı</div>';
    return items.map(it => {
      const pinned = cfg.items.includes(it.id);
      return `
        <div class="jbd-row">
          <span class="jbd-ic">${it.icon}</span>
          <span class="jbd-lbl" onclick="JollyBottomDock.go('${it.id}')">${esc(it.label)}</span>
          <span class="jbd-star" onclick="JollyBottomDock.togglePin('${it.id}')" style="color:${pinned ? '#fbbf24' : 'var(--muted,#888)'};">${pinned ? '⭐' : '☆'}</span>
        </div>
      `;
    }).join('');
  }

  function refresh() {
    const list = document.getElementById('jbdList');
    if (list) list.innerHTML = renderRows();
  }

  function setSearch(v) { searchTerm = v; refresh(); }

  function togglePin(id) {
    const cfg = getConfig();
    if (cfg.items.includes(id)) cfg.items = cfg.items.filter(x => x !== id);
    else cfg.items.push(id);
    setConfig(cfg);
    if (typeof JollySound !== 'undefined') JollySound.tap();
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

  return { openSheet, closeSheet, togglePin, go, setSearch };
})();
