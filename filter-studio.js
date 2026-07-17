/* ============================================================
   JOLLY Filtrləmə — 2 sütunlu grid giriş (Sephora/Starface üslubu)
   Giriş ekranında 5 böyük kart: Tədarükçü, Qiymət, Rəng, Status,
   Etiket. Hər kartına toxunanda AŞAĞIDAN YUXARI sürüşən öz seçim
   paneli (bottom-sheet) açılır. Bağlayanda əsas grid-ə qayıdır,
   kartın üstündə neçə seçim etdiyini göstərən nişan (badge) çıxır.
   Süzgəclər HAMISI BİRLİKDƏ (AND) tətbiq olunur, nəticə grid-in
   altında canlı görünür.

   ETİKETLƏR (yeni, sərbəst sahə): JollyDB.Tags-da saxlanılır,
   Etiket panelinin özündən əlavə et / adını dəyiş / sil edilir.

   Tamamilə müstəqil modul — ModuleRegistry-ə qeydiyyatdan keçir,
   "JOLLY Store"da avtomatik görünür. Route: #/filters
   ============================================================ */

const JollyFilterStudio = (() => {
  let state = {
    suppliers: [], statuses: [], tags: [],
    color: '', priceMin: '', priceMax: '',
  };

  const CARDS = [
    { id: 'supplier', icon: '🚚', label: 'Tədarükçü' },
    { id: 'price', icon: '💰', label: 'Qiymət' },
    { id: 'color', icon: '🎨', label: 'Rəng' },
    { id: 'status', icon: '🔖', label: 'Status' },
    { id: 'tag', icon: '🏷️', label: 'Etiket' },
  ];

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  /* ============================================================
     ƏSAS SƏHİFƏ — 2 sütunlu grid giriş
     ============================================================ */
  function render() {
    state = { suppliers: [], statuses: [], tags: [], color: '', priceMin: '', priceMax: '' };
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔍 Filtrləmə</h2>
      <p class="muted" style="font-size:12px;margin:0 0 16px;">Bir karta toxun, seçimini et — hamısı birlikdə süzülür.</p>

      <div id="fsCardGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
        ${CARDS.map(cardHtml).join('')}
      </div>

      <button class="btn btn-ghost btn-block" style="margin-bottom:16px;" onclick="JollyFilterStudio.clearAll()">🗑️ Süzgəcləri təmizlə</button>

      <div class="row between" style="margin-bottom:10px;">
        <span class="section-title" style="margin:0;">Nəticə</span>
        <span class="muted mono" id="fsResultCount">${JollyDB.Products.all().length}</span>
      </div>
      <div id="fsResultGrid"></div>
    `;
  }

  function afterRender() { applyFilters(); }

  function badgeCount(id) {
    if (id === 'supplier') return state.suppliers.length;
    if (id === 'status') return state.statuses.length;
    if (id === 'tag') return state.tags.length;
    if (id === 'color') return state.color.trim() ? 1 : 0;
    if (id === 'price') return (state.priceMin !== '' || state.priceMax !== '') ? 1 : 0;
    return 0;
  }

  function cardHtml(c) {
    const n = badgeCount(c.id);
    return `
      <div class="glass" id="fsCard_${c.id}" style="padding:18px 12px;text-align:center;cursor:pointer;position:relative;" onclick="JollyFilterStudio.openSheet('${c.id}')">
        ${n > 0 ? `<span style="position:absolute;top:8px;right:8px;background:var(--accent-1);color:#fff;font-size:11px;font-weight:700;min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 5px;">${n}</span>` : ''}
        <div style="font-size:30px;margin-bottom:6px;">${c.icon}</div>
        <div style="font-weight:700;font-size:14px;">${c.label}</div>
      </div>
    `;
  }

  function updateCardBadges() {
    CARDS.forEach(c => {
      const el = document.getElementById('fsCard_' + c.id);
      if (el) el.outerHTML = cardHtml(c);
    });
  }

  /* ============================================================
     AŞAĞIDAN YUXARI SÜRÜŞƏN PANEL (bottom-sheet)
     ============================================================ */
  function openSheet(id) {
    let overlay = document.getElementById('fsSheetOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'fsSheetOverlay';
    overlay.className = 'qa-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });
    overlay.innerHTML = `
      <div class="glass qa-sheet" style="max-height:82vh;overflow-y:auto;">
        <div class="row between" style="margin-bottom:14px;">
          <div style="font-weight:700;font-size:16px;">${sheetTitle(id)}</div>
          <button class="icon-btn" onclick="JollyFilterStudio.closeSheet()">✕</button>
        </div>
        <div id="fsSheetBody">${sheetBody(id)}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function closeSheet() {
    const overlay = document.getElementById('fsSheetOverlay');
    if (overlay) { overlay.classList.remove('on'); setTimeout(() => overlay.remove(), 200); }
    updateCardBadges();
    applyFilters();
  }

  function sheetTitle(id) {
    const c = CARDS.find(x => x.id === id);
    return c ? `${c.icon} ${c.label}` : '';
  }

  function sheetBody(id) {
    if (id === 'supplier') {
      const suppliers = JollyDB.Suppliers.all();
      if (!suppliers.length) return '<div class="muted" style="padding:12px;">Hələ tədarükçü yoxdur</div>';
      return `<div class="chip-row">${suppliers.map(s => `<span class="chip ${state.suppliers.includes(s.name) ? 'chip-active' : ''}" onclick="JollyFilterStudio.toggle('suppliers','${esc(s.name)}',this)">${esc(s.name)}</span>`).join('')}</div>`;
    }
    if (id === 'status') {
      const statuses = JollyDB.Statuses.all();
      if (!statuses.length) return '<div class="muted" style="padding:12px;">Hələ status yoxdur</div>';
      return `<div class="chip-row">${statuses.map(s => `<span class="chip ${state.statuses.includes(s.name) ? 'chip-active' : ''}" onclick="JollyFilterStudio.toggle('statuses','${esc(s.name)}',this)">${esc(s.name)}</span>`).join('')}</div>`;
    }
    if (id === 'color') {
      return `
        <div class="glass command-bar">
          <span style="opacity:.6">🎨</span>
          <input id="fsColorInput" placeholder="məs. qırmızı" value="${esc(state.color)}" oninput="JollyFilterStudio.setColor(this.value)">
        </div>
      `;
    }
    if (id === 'price') {
      return `
        <div class="row" style="gap:10px;">
          <input id="fsPriceMin" type="number" inputmode="decimal" placeholder="min." value="${esc(state.priceMin)}" style="flex:1;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" oninput="JollyFilterStudio.setPrice('min', this.value)">
          <input id="fsPriceMax" type="number" inputmode="decimal" placeholder="maks." value="${esc(state.priceMax)}" style="flex:1;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" oninput="JollyFilterStudio.setPrice('max', this.value)">
        </div>
      `;
    }
    if (id === 'tag') {
      return renderTagSheetBody();
    }
    return '';
  }

  function setColor(v) { state.color = v; }
  function setPrice(kind, v) { if (kind === 'min') state.priceMin = v; else state.priceMax = v; }

  function toggle(dim, value, chipEl) {
    const arr = state[dim];
    const idx = arr.indexOf(value);
    if (idx >= 0) { arr.splice(idx, 1); chipEl.classList.remove('chip-active'); }
    else { arr.push(value); chipEl.classList.add('chip-active'); }
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }

  function clearAll() {
    state = { suppliers: [], statuses: [], tags: [], color: '', priceMin: '', priceMax: '' };
    updateCardBadges();
    applyFilters();
    Toast.info('Süzgəclər təmizləndi');
  }

  /* ============================================================
     ETİKET PANELİ — seçim + idarəetmə (əlavə et/adını dəyiş/sil)
     ============================================================ */
  function renderTagSheetBody() {
    const tags = JollyDB.Tags.all();
    return `
      <div class="chip-row" style="margin-bottom:16px;">
        ${tags.length ? tags.map(t => `<span class="chip ${state.tags.includes(t.name) ? 'chip-active' : ''}" onclick="JollyFilterStudio.toggle('tags','${esc(t.name)}',this)">${esc(t.name)}</span>`).join('') : '<span class="muted" style="font-size:12px;">Hələ etiket yoxdur</span>'}
      </div>
      <div class="section-title" style="margin-top:0;">Etiketləri idarə et</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:10px;" id="fsTagManageList">
        ${renderTagManageRows(tags)}
      </div>
      <button class="btn btn-ghost btn-sm btn-block" onclick="JollyFilterStudio.addTag()">+ Yeni etiket yarat</button>
    `;
  }

  function renderTagManageRows(tags) {
    if (!tags.length) return '<div class="muted" style="padding:10px;font-size:12px;">Hələ etiket yoxdur</div>';
    return tags.map(t => `
      <div class="list-row" style="align-items:center;">
        <span style="font-size:13px;flex:1;">${esc(t.name)}</span>
        <span class="actions">
          <span onclick="JollyFilterStudio.renameTag('${t.id}')" style="color:var(--accent-1);cursor:pointer;padding:0 8px;">✏️</span>
          <span onclick="JollyFilterStudio.deleteTag('${t.id}')" style="color:var(--accent-danger);cursor:pointer;padding:0 8px;">🗑️</span>
        </span>
      </div>
    `).join('');
  }

  function refreshTagSheet() {
    const body = document.getElementById('fsSheetBody');
    if (body) body.innerHTML = renderTagSheetBody();
  }

  function addTag() {
    const name = prompt('Yeni etiket adı (məs. "Salon malları", "Xırdavat"):');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (JollyDB.Tags.all().some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      Toast.error('Bu etiket artıq var'); return;
    }
    JollyDB.Tags.add({ name: trimmed });
    Toast.success(`"${trimmed}" yaradıldı`);
    refreshTagSheet();
  }

  function renameTag(id) {
    const t = JollyDB.Tags.get(id);
    if (!t) return;
    const name = prompt('Yeni ad:', t.name);
    if (!name || !name.trim() || name.trim() === t.name) return;
    const trimmed = name.trim();
    JollyDB.Tags.update(id, { name: trimmed });
    JollyDB.Products.all().forEach(p => {
      if (p.filterTags && p.filterTags.includes(t.name)) {
        JollyDB.Products.update(p.id, { filterTags: p.filterTags.map(x => x === t.name ? trimmed : x) });
      }
    });
    state.tags = state.tags.map(x => x === t.name ? trimmed : x);
    Toast.success('Etiket adı yeniləndi');
    refreshTagSheet();
  }

  function deleteTag(id) {
    const t = JollyDB.Tags.get(id);
    if (!t) return;
    if (!confirm(`"${t.name}" etiketi silinsin? (Məhsullardan da çıxarılacaq, məhsulun özü silinmir)`)) return;
    JollyDB.Tags.remove(id);
    JollyDB.Products.all().forEach(p => {
      if (p.filterTags && p.filterTags.includes(t.name)) {
        JollyDB.Products.update(p.id, { filterTags: p.filterTags.filter(x => x !== t.name) });
      }
    });
    state.tags = state.tags.filter(x => x !== t.name);
    Toast.info('Etiket silindi');
    refreshTagSheet();
  }

  /* ============================================================
     SÜZGƏC TƏTBİQİ
     ============================================================ */
  function applyFilters() {
    let list = JollyDB.Products.all();
    if (state.suppliers.length) list = list.filter(p => state.suppliers.includes(p.supplier));
    if (state.statuses.length) list = list.filter(p => state.statuses.includes(p.status));
    if (state.tags.length) list = list.filter(p => (p.filterTags || []).some(t => state.tags.includes(t)));
    if (state.color.trim()) {
      const c = state.color.trim().toLowerCase();
      list = list.filter(p => (p.color || '').toLowerCase().includes(c));
    }
    if (state.priceMin !== '' && !isNaN(parseFloat(state.priceMin))) {
      const min = parseFloat(state.priceMin);
      list = list.filter(p => p.price != null && p.price !== '' && parseFloat(p.price) >= min);
    }
    if (state.priceMax !== '' && !isNaN(parseFloat(state.priceMax))) {
      const max = parseFloat(state.priceMax);
      list = list.filter(p => p.price != null && p.price !== '' && parseFloat(p.price) <= max);
    }

    const countEl = document.getElementById('fsResultCount');
    if (countEl) countEl.textContent = list.length;
    const grid = document.getElementById('fsResultGrid');
    if (grid) {
      grid.innerHTML = list.length
        ? `<div class="product-grid">${list.map(JollyProducts.renderCard).join('')}</div>`
        : '<div class="empty-state"><div class="big-icon">📦</div><h3>Nəticə tapılmadı</h3></div>';
      if (typeof JollyStorage !== 'undefined') setTimeout(() => JollyStorage.hydrate(), 0);
    }
  }

  /* ============================================================
     Registrasiya
     ============================================================ */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'filter-studio',
      name: 'Filtrləmə',
      icon: '🔍',
      route: '#/filters',
      group: 'Kataloq',
      enabled: true,
      render() { return render(); },
      afterRender,
    });
  }

  return {
    openSheet, closeSheet, toggle, setColor, setPrice, clearAll,
    addTag, renameTag, deleteTag,
  };
})();
