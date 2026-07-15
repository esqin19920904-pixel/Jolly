/* ============================================================
   JOLLY Radial FAB — Dairəvi "+" Sürətli Menyu
   Ekranın küncündə üzən "+" düyməsi. Basanda ətrafına yarım-dairə
   şəklində düymələr açılır (JOLLY-nin REAL mövcud əməliyyatları
   ilə — kassa/satış YOXDUR, yalnız inventar əməliyyatları).

   UZUN BAS: düyməni basılı saxlasan, ⭐ işarələdiyin "sevimli"
   əməliyyatlar ayrıca kiçik zolaqda çıxır — sürətli çatmaq üçün.

   HAMISI STUDİODAN İDARƏ OLUNUR (#/studios/fabmenu):
   - Hansı düymələr menyuda olsun (əlavə et / çıxar)
   - Sıra (☰ tutub sürüşdür)
   - Hansıları "sevimli" (uzun-bas zolağında) olsun (⭐)
   - "+" düyməsi ümumiyyətlə göstərilsin, ya yox

   Tamamilə müstəqil modul — quick.js (köhnə, artıq deaktiv FAB)
   və quick-menu.js (skan-sonrası panel) ilə ziddiyyət təşkil etmir.
   ============================================================ */

const JollyRadialFab = (() => {
  const CFG_KEY = 'jolly_fabmenu_config';

  const CATALOG = [
    { id: 'newProduct',     icon: '➕', label: 'Yeni məhsul',      run: () => JollyRouter.go('#/product/new') },
    { id: 'scan',           icon: '📡', label: 'Barkod skan',      run: () => { if (typeof JollyProducts !== 'undefined') JollyProducts.scanSearch(); } },
    { id: 'photo',          icon: '📸', label: 'Tez şəkil',        run: () => { if (typeof JollyDashboard !== 'undefined') JollyDashboard.quickPhoto(); } },
    { id: 'voice',          icon: '🎤', label: 'Səsli axtar',      run: () => { if (typeof JollyProducts !== 'undefined') JollyProducts.voiceSearch(); } },
    { id: 'scanReceiving',  icon: '📥', label: 'Skan ilə Qəbul',   run: () => JollyRouter.go('#/scan-receiving') },
    { id: 'receiving',      icon: '🚚', label: 'Qəbul Studio',     run: () => JollyRouter.go('#/receiving') },
    { id: 'ai',             icon: '🧠', label: 'AI-dan soruş',     run: () => JollyRouter.go('#/studios/ai') },
    { id: 'dashboard',      icon: '🎛️', label: 'İş masası',        run: () => JollyRouter.go('#/dashboard') },
    { id: 'dataDoctor',     icon: '🩺', label: 'Data Doctor',      run: () => JollyRouter.go('#/data-doctor') },
    { id: 'backup',         icon: '💾', label: 'Backup',           run: () => JollyRouter.go('#/studios/data') },
  ];
  const DEFAULT_ITEMS = ['newProduct', 'scan', 'photo', 'voice', 'scanReceiving', 'ai'];
  const DEFAULT_FAVORITES = ['newProduct', 'scan'];

  let openState = false;

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function getConfig() {
    return JollyDB.read(CFG_KEY, { items: DEFAULT_ITEMS.slice(), favorites: DEFAULT_FAVORITES.slice(), enabled: true });
  }
  function setConfig(c) { JollyDB.write(CFG_KEY, c); }

  /* ============================================================
     DOM QURULUŞU
     ============================================================ */
  function ensureDom() {
    let root = document.getElementById('radialFabRoot');
    if (root) return root;
    injectStyles();
    root = document.createElement('div');
    root.id = 'radialFabRoot';
    root.innerHTML = `
      <div class="rfab-favs" id="rfabFavs" style="display:none;"></div>
      <div class="rfab-petals" id="rfabPetals"></div>
      <button class="rfab-main" id="rfabMain">＋</button>
    `;
    document.body.appendChild(root);

    const btn = root.querySelector('#rfabMain');
    let pressTimer = null;
    let longFired = false;
    const startPress = () => {
      longFired = false;
      pressTimer = setTimeout(() => { longFired = true; showFavorites(); }, 480);
    };
    const endPress = () => {
      clearTimeout(pressTimer);
      if (!longFired) toggle();
    };
    btn.addEventListener('touchstart', startPress, { passive: true });
    btn.addEventListener('touchend', endPress);
    btn.addEventListener('mousedown', startPress);
    btn.addEventListener('mouseup', endPress);

    document.addEventListener('click', (e) => {
      const r = document.getElementById('radialFabRoot');
      if (r && openState && !r.contains(e.target)) closeMenu();
    });

    return root;
  }

  function injectStyles() {
    if (document.getElementById('rfab-styles')) return;
    const style = document.createElement('style');
    style.id = 'rfab-styles';
    style.textContent = `
      #radialFabRoot { position: fixed; right: 20px; bottom: 86px; z-index: 500; }
      .rfab-main { width: 58px; height: 58px; border-radius: 50%; border: none; font-size: 26px; color: #fff;
        background: linear-gradient(135deg, var(--accent-1, #7c8aff), var(--accent-2, #29e0c9));
        box-shadow: 0 8px 24px rgba(124,138,255,0.45);
        display: flex; align-items: center; justify-content: center;
        transition: transform .25s; position: relative; z-index: 2; }
      #radialFabRoot.open .rfab-main { transform: rotate(45deg); }
      .rfab-petals { position: absolute; right: 0; bottom: 0; width: 0; height: 0; }
      .rfab-petal { position: absolute; width: 50px; height: 50px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: rgba(22,22,32,0.94); border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 6px 18px rgba(0,0,0,0.45); font-size: 19px; color: #fff;
        opacity: 0; transform: scale(0.3); pointer-events: none;
        transition: transform .28s cubic-bezier(.34,1.56,.64,1), opacity .2s; }
      #radialFabRoot.open .rfab-petal { opacity: 1; transform: scale(1); pointer-events: auto; }
      .rfab-favs { position: absolute; bottom: 70px; right: 0; display: flex; gap: 8px;
        background: rgba(22,22,32,0.94); padding: 8px; border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 6px 18px rgba(0,0,0,0.45); }
      .rfab-fav-btn { width: 44px; height: 44px; border-radius: 50%; border: none;
        background: rgba(255,255,255,0.07); color: #fff; font-size: 18px; }
    `;
    document.head.appendChild(style);
  }

  /* ============================================================
     AÇ / BAĞLA / İŞLƏT
     ============================================================ */
  function toggle() { openState ? closeMenu() : openMenu(); }

  function openMenu() {
    const c = getConfig();
    if (c.enabled === false) return;
    const items = c.items.map(id => CATALOG.find(x => x.id === id)).filter(Boolean);
    if (!items.length) { Toast.info('Sürətli menyuda düymə yoxdur — Studio-dan əlavə et'); return; }

    hideFavorites();
    const root = ensureDom();
    const petals = root.querySelector('#rfabPetals');
    const n = items.length;
    const radius = 92;
    const startAngle = 180, endAngle = 270; // sol üfüqi → yuxarı üfüqi, yarım-dairə
    petals.innerHTML = items.map((it, i) => {
      const angle = n === 1 ? (startAngle + endAngle) / 2 : startAngle + (endAngle - startAngle) * (i / (n - 1));
      const rad = angle * Math.PI / 180;
      const x = Math.cos(rad) * radius;
      const y = Math.sin(rad) * radius;
      return `<button class="rfab-petal" style="right:${-x - 25}px;bottom:${-y - 25}px;" title="${esc(it.label)}" onclick="JollyRadialFab.run('${it.id}')">${it.icon}</button>`;
    }).join('');
    root.classList.add('open');
    openState = true;
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }

  function closeMenu() {
    const root = document.getElementById('radialFabRoot');
    if (root) root.classList.remove('open');
    openState = false;
  }

  function run(id) {
    closeMenu();
    const item = CATALOG.find(x => x.id === id);
    if (item && item.run) item.run();
  }

  function showFavorites() {
    const c = getConfig();
    const favs = (c.favorites || []).map(id => CATALOG.find(x => x.id === id)).filter(Boolean);
    if (!favs.length) return;
    const root = ensureDom();
    const zone = root.querySelector('#rfabFavs');
    zone.innerHTML = favs.map(it => `<button class="rfab-fav-btn" title="${esc(it.label)}" onclick="JollyRadialFab.run('${it.id}')">${it.icon}</button>`).join('');
    zone.style.display = 'flex';
    if (typeof JollySound !== 'undefined') JollySound.tap();
    if (navigator.vibrate) navigator.vibrate(30);
  }
  function hideFavorites() {
    const root = document.getElementById('radialFabRoot');
    if (root) { const z = root.querySelector('#rfabFavs'); if (z) z.style.display = 'none'; }
  }

  /* ============================================================
     STUDİO — düymələri əlavə et / çıxar / sırala / sevimli et
     ============================================================ */
  function renderStudio() {
    const c = getConfig();
    const inMenu = c.items;
    const available = CATALOG.filter(x => !inMenu.includes(x.id));
    setTimeout(() => attachDrag(), 0);
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 6px;font-size:19px;">➕ Sürətli "+" Menyu Studio</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Ekranın küncündəki "+" düyməsinə basanda açılan dairəvi menyunu burda idarə et.</p>

      <div class="glass" style="padding:12px 14px;margin-bottom:14px;">
        <div class="row between">
          <span>"+" düyməsi göstərilsin</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${c.enabled !== false ? 'checked' : ''} onchange="JollyRadialFab.toggleEnabled(this.checked)"></label>
        </div>
      </div>

      <div class="section-title" style="margin-top:0;">Menyuda olanlar — ☰ sürüşdür, ⭐ = uzun-bas sevimlisi</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;" id="rfabStudioList">
        ${inMenu.map(id => {
          const it = CATALOG.find(x => x.id === id);
          if (!it) return '';
          const isFav = (c.favorites || []).includes(id);
          return `<div class="list-row" data-id="${id}">
            <span>☰ ${it.icon} ${esc(it.label)}</span>
            <span class="actions">
              <span onclick="JollyRadialFab.toggleFavorite('${id}')" style="color:${isFav ? '#fbbf24' : 'var(--muted,#888)'};cursor:pointer;margin-right:10px;">${isFav ? '⭐' : '☆'}</span>
              <span onclick="JollyRadialFab.removeItem('${id}')" style="color:var(--accent-warn);cursor:pointer;">çıxar</span>
            </span>
          </div>`;
        }).join('')}
      </div>

      <div class="section-title">Əlavə et</div>
      <div class="glass" style="padding:4px 14px;">
        ${available.length ? available.map(it => `
          <div class="list-row">
            <span>${it.icon} ${esc(it.label)}</span>
            <span class="actions"><span onclick="JollyRadialFab.addItem('${it.id}')" style="color:var(--accent-2);cursor:pointer;">+ əlavə</span></span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hamısı menyudadır</div>'}
      </div>
      <p class="muted" style="font-size:11px;margin-top:10px;">⭐ işarələdiyin düymələr — "+" düyməsini basılı saxlayanda (uzun bas) ayrıca zolaqda çıxır.</p>
    `;
  }

  function attachDrag() {
    const container = document.getElementById('rfabStudioList');
    if (!container) return;
    container.querySelectorAll('.list-row').forEach(row => {
      let dragging = false;
      row.addEventListener('touchstart', (e) => {
        if (e.target.closest('.actions')) return;
        dragging = true; row.style.opacity = '0.4';
      }, { passive: true });
      row.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        e.preventDefault();
        const y = e.touches[0].clientY;
        const rows = [...container.querySelectorAll('.list-row')].filter(r => r !== row);
        const after = rows.find(r => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
        if (after) container.insertBefore(row, after); else container.appendChild(row);
      }, { passive: false });
      row.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false; row.style.opacity = '1';
        const ids = [...container.querySelectorAll('.list-row')].map(r => r.dataset.id);
        const c = getConfig(); c.items = ids; setConfig(c);
      });
    });
  }

  function addItem(id) {
    const c = getConfig();
    if (!c.items.includes(id)) c.items.push(id);
    setConfig(c);
    Toast.success('Əlavə olundu');
    JollyRouter.go('#/studios/fabmenu');
  }
  function removeItem(id) {
    const c = getConfig();
    c.items = c.items.filter(x => x !== id);
    c.favorites = (c.favorites || []).filter(x => x !== id);
    setConfig(c);
    Toast.info('Çıxarıldı');
    JollyRouter.go('#/studios/fabmenu');
  }
  function toggleFavorite(id) {
    const c = getConfig();
    c.favorites = c.favorites || [];
    if (c.favorites.includes(id)) c.favorites = c.favorites.filter(x => x !== id);
    else c.favorites.push(id);
    setConfig(c);
    JollyRouter.go('#/studios/fabmenu');
  }
  function toggleEnabled(on) {
    const c = getConfig(); c.enabled = on; setConfig(c);
    const root = document.getElementById('radialFabRoot');
    if (root) root.style.display = on ? '' : 'none';
    Toast.success(on ? '"+" düyməsi göstəriləcək' : '"+" düyməsi gizlədildi');
  }

  /* ============================================================
     Registrasiya
     ============================================================ */
  function init() {
    ensureDom();
    const c = getConfig();
    if (c.enabled === false) { const r = document.getElementById('radialFabRoot'); if (r) r.style.display = 'none'; }
    window.addEventListener('hashchange', () => { closeMenu(); hideFavorites(); });
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'fabmenu-studio',
      name: 'Sürətli "+" Menyu Studio',
      icon: '➕',
      route: '#/studios/fabmenu',
      group: 'Studio',
      enabled: true,
      render() { return renderStudio(); },
      init,
    });
  }

  document.addEventListener('DOMContentLoaded', () => { setTimeout(init, 200); });

  return { toggle, run, showFavorites, renderStudio, addItem, removeItem, toggleFavorite, toggleEnabled, getConfig };
})();
