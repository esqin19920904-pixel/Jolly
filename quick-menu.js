/* ============================================================
   JOLLY Quick Menu — Sürətli Əməliyyat Menyusu
   Barkod skan edib TƏK məhsul tapılanda, tam detal səhifəsinə
   keçmədən, aşağıdan sürüşən kiçik panel açılır: məhsulun şəkli/
   adı/qiyməti + seçdiyin sürətli düymələr (Yer, Şəkil, Barkod,
   Düzəlt, Oxşar, Kopyala, WhatsApp, Qəbulə at, Favori, Sil).

   HAMISI STUDİODAN İDARƏ OLUNUR (#/studios/quickmenu):
   - Hansı düymələr görünsün, hansı yox (əlavə et / çıxar)
   - Sıra (sürüşdürüb dəyiş)
   - Skan edəndə avtomatik açılsın, yoxsa yox (aç/bağla)

   Real JOLLY bazasına (JollyDB) bağlıdır — mock deyil.
   ============================================================ */

const JollyQuickMenu = (() => {
  const CFG_KEY = 'jolly_quickmenu_config';

  const CATALOG = [
    { id: 'location', icon: '📍', label: 'Yer' },
    { id: 'photo',     icon: '📸', label: 'Şəkil' },
    { id: 'barcode',   icon: '🏷️', label: 'Barkod' },
    { id: 'edit',      icon: '✏️', label: 'Düzəlt' },
    { id: 'similar',   icon: '🔍', label: 'Oxşar' },
    { id: 'copy',      icon: '📋', label: 'Kopyala' },
    { id: 'whatsapp',  icon: '📤', label: 'WhatsApp' },
    { id: 'receiving', icon: '📥', label: 'Qəbulə at' },
    { id: 'favorite',  icon: '⭐', label: 'Favori' },
    { id: 'delete',    icon: '🗑️', label: 'Sil' },
  ];
  const DEFAULT_ITEMS = ['location', 'photo', 'barcode', 'edit', 'similar', 'copy'];

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function getConfig() {
    return JollyDB.read(CFG_KEY, { items: DEFAULT_ITEMS.slice(), enabledOnScan: true });
  }
  function setConfig(cfg) { JollyDB.write(CFG_KEY, cfg); }

  let currentId = null;

  /* ============================================================
     PANELİ AÇMAQ / BAĞLAMAQ
     ============================================================ */
  function open(productId) {
    const p = JollyDB.Products.get(productId);
    if (!p) { Toast.error('Məhsul tapılmadı'); return; }
    currentId = productId;
    const cfg = getConfig();
    const items = cfg.items.map(id => CATALOG.find(c => c.id === id)).filter(Boolean);

    let overlay = document.getElementById('qmQuickOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'qmQuickOverlay';
    overlay.className = 'qa-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const thumb = (p.images && p.images[0])
      ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:100%;height:100%;object-fit:cover;">`
      : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;">🧴</div>`;

    overlay.innerHTML = `
      <div class="glass qa-sheet" style="max-height:80vh;overflow-y:auto;">
        <div class="row" style="gap:12px;align-items:center;margin-bottom:16px;">
          <div style="width:60px;height:60px;border-radius:12px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.05);">${thumb}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.name || 'Adsız')}</div>
            <div class="muted" style="font-size:13px;">${p.price != null && p.price !== '' ? p.price + ' ₼' : 'Qiymət yoxdur'}</div>
          </div>
          <button class="icon-btn" onclick="JollyQuickMenu.close()">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${items.map(it => `
            <button class="btn btn-ghost" style="flex-direction:column;height:72px;gap:4px;" onclick="JollyQuickMenu.run('${it.id}')">
              <span style="font-size:23px;">${it.icon}</span>
              <span style="font-size:12px;">${esc(it.label)}</span>
            </button>
          `).join('')}
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="JollyQuickMenu.openFull()">📄 Tam məhsul səhifəsi</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function close() {
    const overlay = document.getElementById('qmQuickOverlay');
    if (overlay) {
      overlay.classList.remove('on');
      setTimeout(() => overlay.remove(), 200);
    }
  }

  function openFull() {
    const id = currentId;
    close();
    if (id) JollyRouter.go('#/product/' + id);
  }

  /* ============================================================
     DÜYMƏ ƏMƏLİYYATLARI
     ============================================================ */
  function run(actionId) {
    const id = currentId;
    close();
    if (!id) return;
    const p = JollyDB.Products.get(id);
    if (!p) return;

    switch (actionId) {
      case 'location':
        Toast.info(p.location ? `📍 ${p.location}` : 'Bu məhsul üçün yer təyin olunmayıb');
        break;
      case 'photo':
        quickAddPhoto(id);
        break;
      case 'barcode':
        if (p.barcodes && p.barcodes[0] && typeof JollyProducts !== 'undefined') JollyProducts.showBarcode(p.barcodes[0]);
        else Toast.error('Bu məhsulda barkod yoxdur');
        break;
      case 'edit':
        JollyRouter.go('#/product/' + id + '/edit');
        break;
      case 'similar':
        JollyRouter.go('#/product/' + id);
        break;
      case 'copy':
        if (typeof JollyProducts !== 'undefined') JollyProducts.copyProductText(id);
        break;
      case 'whatsapp':
        if (typeof JollyProducts !== 'undefined') JollyProducts.whatsappShare(id);
        break;
      case 'receiving':
        if (typeof JollyReceiving !== 'undefined') JollyReceiving.quickAddToBasket(id);
        else Toast.error('Qəbul Studio modulu yüklənməyib');
        break;
      case 'favorite':
        if (typeof JollyProducts !== 'undefined') JollyProducts.toggleFav(id);
        break;
      case 'delete':
        if (typeof JollyProducts !== 'undefined') JollyProducts.deleteProduct(id);
        break;
    }
  }

  function quickAddPhoto(id) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let img = ev.target.result;
        if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
          try { img = await JollyStorage.compressImage(img); } catch (er) {}
        }
        const p = JollyDB.Products.get(id);
        if (!p) return;
        const images = [...(p.images || []), img];
        JollyDB.Products.update(id, { images });
        if (typeof JollySound !== 'undefined') JollySound.success();
        Toast.success('Şəkil əlavə olundu');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  /* ============================================================
     STUDİO — düymələri əlavə et / çıxar / sırala
     ============================================================ */
  function renderStudio() {
    const cfg = getConfig();
    const inMenu = cfg.items;
    const available = CATALOG.filter(c => !inMenu.includes(c.id));
    setTimeout(() => attachDrag(), 0);
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 6px;font-size:19px;">⚡ Sürətli Menyu Studio</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Barkod skan edəndə çıxan sürətli menyunun düymələrini burada idarə et.</p>

      <div class="glass" style="padding:12px 14px;margin-bottom:14px;">
        <div class="row between">
          <span>Skan edəndə avtomatik açılsın</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${cfg.enabledOnScan !== false ? 'checked' : ''} onchange="JollyQuickMenu.toggleEnabled(this.checked)"></label>
        </div>
        <p class="muted" style="font-size:11px;margin:8px 0 0;">Söndürsən, skan edəndə birbaşa tam məhsul səhifəsi açılır (əvvəlki kimi).</p>
      </div>

      <div class="section-title" style="margin-top:0;">Menyuda olanlar — ☰ tutub sürüşdür, sırala</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;" id="qmStudioList">
        ${inMenu.map(id => {
          const c = CATALOG.find(x => x.id === id);
          if (!c) return '';
          return `<div class="list-row" data-id="${id}">
            <span>☰ ${c.icon} ${esc(c.label)}</span>
            <span class="actions"><span onclick="JollyQuickMenu.removeItem('${id}')" style="color:var(--accent-warn);cursor:pointer;">çıxar</span></span>
          </div>`;
        }).join('')}
      </div>

      <div class="section-title">Əlavə et</div>
      <div class="glass" style="padding:4px 14px;">
        ${available.length ? available.map(c => `
          <div class="list-row">
            <span>${c.icon} ${esc(c.label)}</span>
            <span class="actions"><span onclick="JollyQuickMenu.addItem('${c.id}')" style="color:var(--accent-2);cursor:pointer;">+ əlavə</span></span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hamısı menyudadır</div>'}
      </div>
      <p class="muted" style="font-size:11px;margin-top:10px;">Tövsiyə: 4-6 düymə — 2 sütunlu şəbəkədə ən rahat görünən say budur.</p>
    `;
  }

  function attachDrag() {
    const container = document.getElementById('qmStudioList');
    if (!container) return;
    container.querySelectorAll('.list-row').forEach(row => {
      let dragging = false;
      row.addEventListener('touchstart', () => { dragging = true; row.style.opacity = '0.4'; }, { passive: true });
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
        const cfg = getConfig(); cfg.items = ids; setConfig(cfg);
      });
    });
  }

  function addItem(id) {
    const cfg = getConfig();
    if (!cfg.items.includes(id)) cfg.items.push(id);
    setConfig(cfg);
    Toast.success('Əlavə olundu');
    JollyRouter.go('#/studios/quickmenu');
  }
  function removeItem(id) {
    const cfg = getConfig();
    cfg.items = cfg.items.filter(x => x !== id);
    setConfig(cfg);
    Toast.info('Çıxarıldı');
    JollyRouter.go('#/studios/quickmenu');
  }
  function toggleEnabled(on) {
    const cfg = getConfig(); cfg.enabledOnScan = on; setConfig(cfg);
    Toast.success(on ? 'Skan edəndə sürətli menyu açılacaq' : 'Skan edəndə tam səhifə açılacaq');
  }

  /* ============================================================
     Registrasiya
     ============================================================ */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'quickmenu-studio',
      name: 'Sürətli Menyu Studio',
      icon: '⚡',
      route: '#/studios/quickmenu',
      group: 'Studio',
      enabled: true,
      render() { return renderStudio(); },
    });
  }

  return { open, close, openFull, run, renderStudio, addItem, removeItem, toggleEnabled, getConfig };
})();
