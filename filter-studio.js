/* ============================================================
   JOLLY Filtrləmə — hamısı bir yerdə süzgəc mərkəzi
   Tədarükçü + Qiymət aralığı + Rəng + Status + Etiket — birlikdə
   kombinə oluna bilən süzgəclər. Nəticə siyahısı canlı yenilənir.

   ETİKETLƏR (yeni, sərbəst sahə — Firma/Qrup-dan fərqli):
   JollyDB.Tags-da saxlanılır (Firma/Qrup kimi eyni makeStore
   sistemi). Bu səhifədən özün əlavə et / adını dəyiş / sil edə
   bilərsən — məhsul formasında çoxseçimli chip kimi görünür.

   Tamamilə müstəqil modul — ModuleRegistry-ə qeydiyyatdan keçir,
   "JOLLY Store"da (studios.js) avtomatik görünür.
   Route: #/filters
   ============================================================ */

const JollyFilterStudio = (() => {
  let state = {
    suppliers: [], statuses: [], tags: [],
    color: '', priceMin: '', priceMax: '',
  };

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  /* ============================================================
     ƏSAS SƏHİFƏ
     ============================================================ */
  function render() {
    state = { suppliers: [], statuses: [], tags: [], color: '', priceMin: '', priceMax: '' };
    const suppliers = JollyDB.Suppliers.all();
    const statuses = JollyDB.Statuses.all();
    const tags = JollyDB.Tags.all();

    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔍 Filtrləmə</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Tədarükçü, qiymət, rəng, status və etiketə görə — hamısı birlikdə süzülə bilər.</p>

      <div class="section-title" style="margin-top:0;">🏷️ Etiketləri idarə et</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:6px;" id="tagManageList">
        ${renderTagManageRows(tags)}
      </div>
      <button class="btn btn-ghost btn-sm btn-block" style="margin-bottom:16px;" onclick="JollyFilterStudio.addTag()">+ Yeni etiket yarat</button>

      ${suppliers.length ? `
      <div class="section-title">🚚 Tədarükçü</div>
      <div class="chip-row" id="fsSupplierChips" style="margin-bottom:12px;">
        ${suppliers.map(s => `<span class="chip" data-v="${esc(s.name)}" onclick="JollyFilterStudio.toggle('suppliers','${esc(s.name)}',this)">${esc(s.name)}</span>`).join('')}
      </div>` : ''}

      ${statuses.length ? `
      <div class="section-title">🔖 Status</div>
      <div class="chip-row" id="fsStatusChips" style="margin-bottom:12px;">
        ${statuses.map(s => `<span class="chip" data-v="${esc(s.name)}" onclick="JollyFilterStudio.toggle('statuses','${esc(s.name)}',this)">${esc(s.name)}</span>`).join('')}
      </div>` : ''}

      ${tags.length ? `
      <div class="section-title">🏷️ Etiket</div>
      <div class="chip-row" id="fsTagChips" style="margin-bottom:12px;">
        ${tags.map(t => `<span class="chip" data-v="${esc(t.name)}" onclick="JollyFilterStudio.toggle('tags','${esc(t.name)}',this)">${esc(t.name)}</span>`).join('')}
      </div>` : ''}

      <div class="section-title">🎨 Rəng</div>
      <div class="glass command-bar" style="margin-bottom:12px;">
        <span style="opacity:.6">🎨</span>
        <input id="fsColorInput" placeholder="məs. qırmızı" oninput="JollyFilterStudio.setColor(this.value)">
      </div>

      <div class="section-title">💰 Qiymət aralığı (₼)</div>
      <div class="row" style="gap:10px;margin-bottom:14px;">
        <input id="fsPriceMin" type="number" inputmode="decimal" placeholder="min." style="flex:1;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" oninput="JollyFilterStudio.setPrice('min', this.value)">
        <input id="fsPriceMax" type="number" inputmode="decimal" placeholder="maks." style="flex:1;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" oninput="JollyFilterStudio.setPrice('max', this.value)">
      </div>

      <button class="btn btn-ghost btn-block" style="margin-bottom:14px;" onclick="JollyFilterStudio.clearAll()">🗑️ Süzgəcləri təmizlə</button>

      <div class="row between" style="margin-bottom:10px;">
        <span class="section-title" style="margin:0;">Nəticə</span>
        <span class="muted mono" id="fsResultCount">${JollyDB.Products.all().length}</span>
      </div>
      <div id="fsResultGrid"></div>
    `;
  }

  function afterRender() {
    applyFilters();
  }

  /* ============================================================
     ETİKET İDARƏETMƏSİ (add/rename/delete) — Starface üslubu,
     böyük sətirlər, hər birinin yanında sadə emoji önizləmə.
     ============================================================ */
  function renderTagManageRows(tags) {
    if (!tags.length) return '<div class="muted" style="padding:12px;">Hələ etiket yoxdur — aşağıdan yarat</div>';
    return tags.map(t => `
      <div class="list-row" style="align-items:center;">
        <span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <span style="font-size:20px;">🏷️</span>
          <span style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.name)}</span>
        </span>
        <span class="actions" style="flex-shrink:0;">
          <span onclick="JollyFilterStudio.renameTag('${t.id}')" style="color:var(--accent-1);cursor:pointer;padding:0 8px;">✏️</span>
          <span onclick="JollyFilterStudio.deleteTag('${t.id}')" style="color:var(--accent-danger);cursor:pointer;padding:0 8px;">🗑️</span>
        </span>
      </div>
    `).join('');
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
    forceRerender();
  }

  function renameTag(id) {
    const t = JollyDB.Tags.get(id);
    if (!t) return;
    const name = prompt('Yeni ad:', t.name);
    if (!name || !name.trim() || name.trim() === t.name) return;
    const trimmed = name.trim();
    JollyDB.Tags.update(id, { name: trimmed });
    // Bu etiketi işlədən bütün məhsullarda da adı yenilə
    JollyDB.Products.all().forEach(p => {
      if (p.filterTags && p.filterTags.includes(t.name)) {
        const updated = p.filterTags.map(x => x === t.name ? trimmed : x);
        JollyDB.Products.update(p.id, { filterTags: updated });
      }
    });
    Toast.success('Etiket adı yeniləndi');
    forceRerender();
  }

  function deleteTag(id) {
    const t = JollyDB.Tags.get(id);
    if (!t) return;
    if (!confirm(`"${t.name}" etiketi silinsin? (Məhsullardan da çıxarılacaq, məhsulun özü silinmir)`)) return;
    JollyDB.Tags.remove(id);
    JollyDB.Products.all().forEach(p => {
      if (p.filterTags && p.filterTags.includes(t.name)) {
        const updated = p.filterTags.filter(x => x !== t.name);
        JollyDB.Products.update(p.id, { filterTags: updated });
      }
    });
    Toast.info('Etiket silindi');
    forceRerender();
  }

  function forceRerender() {
    window.location.hash = '#/home';
    setTimeout(() => { window.location.hash = '#/filters'; }, 30);
  }

  /* ============================================================
     SÜZGƏC MƏNTİQİ
     ============================================================ */
  function toggle(dim, value, chipEl) {
    const arr = state[dim];
    const idx = arr.indexOf(value);
    if (idx >= 0) { arr.splice(idx, 1); chipEl.classList.remove('chip-active'); }
    else { arr.push(value); chipEl.classList.add('chip-active'); }
    if (typeof JollySound !== 'undefined') JollySound.tap();
    applyFilters();
  }

  function setColor(v) { state.color = v; applyFilters(); }
  function setPrice(kind, v) { if (kind === 'min') state.priceMin = v; else state.priceMax = v; applyFilters(); }

  function clearAll() {
    state = { suppliers: [], statuses: [], tags: [], color: '', priceMin: '', priceMax: '' };
    document.querySelectorAll('#fsSupplierChips .chip, #fsStatusChips .chip, #fsTagChips .chip').forEach(c => c.classList.remove('chip-active'));
    const colorInput = document.getElementById('fsColorInput'); if (colorInput) colorInput.value = '';
    const minInput = document.getElementById('fsPriceMin'); if (minInput) minInput.value = '';
    const maxInput = document.getElementById('fsPriceMax'); if (maxInput) maxInput.value = '';
    applyFilters();
    Toast.info('Süzgəclər təmizləndi');
  }

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

  return { toggle, setColor, setPrice, clearAll, addTag, renameTag, deleteTag };
})();
