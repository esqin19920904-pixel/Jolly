/* ============================================================
   JOLLY Barkod Qovluğu
   YENİLƏNDİ (2026-07-27):
   - Axtarış və "yarat/tap" TƏK PANELDƏ birləşdirildi.
     Rəqəm yaz → sistemdə varsa tapır və qırmızı vurğulayır;
     yoxdursa "tapılmadı" deyib avtomatik BOŞ barkod yaradır.
   - Yaradılan barkodlar əsas siyahıya qarışmır — ayrıca
     "🆕 Yaradılanlar" qovluğuna düşür. Oradan adını redaktə
     edib "Məhsul kartına çevir" ilə real məhsula çevirmək olur.
   - Routing app.js-in router-i tərəfindən idarə olunur
     (#/barcode-folder → JollyBarcodeFolder.render()).
   ============================================================ */
const JollyBarcodeFolder = (() => {
  const GEN_KEY = 'jolly_barcode_folder_generated';
  let _tab = 'catalog';   // 'catalog' | 'new'
  let _query = '';

  /* ---------- İcazələr ---------- */
  function _canView() {
    if (typeof POS !== 'undefined') return POS.can('barcode.folder.view');
    return true;
  }
  function _canGenerate() {
    if (typeof POS !== 'undefined') return POS.can('barcode.folder.generate');
    return true;
  }
  function _canCreateProduct() {
    if (typeof POS !== 'undefined') return POS.can('products.create');
    return true;
  }

  /* ---------- Saxlama ---------- */
  function _getGenerated() {
    return (typeof JollyDB !== 'undefined') ? JollyDB.read(GEN_KEY, []) : [];
  }
  function _saveGenerated(list) {
    if (typeof JollyDB !== 'undefined') JollyDB.write(GEN_KEY, list);
  }

  function _escape(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  /* ---------- Məlumat mənbələri ---------- */
  function _catalogEntries() {
    if (typeof JollyDB === 'undefined') return [];
    try {
      const out = [];
      const products = JollyDB.Products.all();
      if (!Array.isArray(products)) return [];
      products.forEach(p => {
        if (p && Array.isArray(p.barcodes)) {
          p.barcodes.forEach(code => {
            if (code) out.push({
              code,
              label: p.name || 'Adsız məhsul',
              thumbRef: (p.images && p.images[0]) || null,
              productId: p.id,
              generated: false
            });
          });
        }
      });
      return out;
    } catch (e) {
      console.error('[BarcodeFolder] _catalogEntries error:', e);
      return [];
    }
  }

  function _generatedEntries() {
    return _getGenerated().map(g => ({
      code: g.code,
      label: g.label || '',
      thumbRef: null,
      productId: null,
      generated: true,
      genId: g.id,
      createdAt: g.createdAt
    }));
  }

  /* ---------- Rəqəm vurğulama ---------- */
  function highlightDigits(text, query) {
    const c = String(text || '');
    const q = String(query || '').replace(/\D/g, '');
    if (!q) return _escape(c);
    const idx = c.indexOf(q);
    if (idx === -1) return _escape(c);
    return _escape(c.slice(0, idx)) +
      `<span style="color:#ff5c6c;font-weight:800;">${_escape(c.slice(idx, idx + q.length))}</span>` +
      _escape(c.slice(idx + q.length));
  }

  function _thumbHtml(entry) {
    if (entry.thumbRef) {
      return `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(entry.thumbRef) : 'src="' + entry.thumbRef + '"'} style="width:100%;height:100%;object-fit:cover;">`;
    }
    const url = (typeof JollyBarcodeGen !== 'undefined') ? JollyBarcodeGen.toDataURL(entry.code) : null;
    return url ? `<img src="${url}" style="width:100%;height:100%;object-fit:contain;background:#fff;">` : '🏷️';
  }

  function openScanReady(code) {
    if (typeof JollyProducts !== 'undefined') JollyProducts.showBarcode(code);
  }

  /* ---------- Kartlar ---------- */
  function _catalogCard(entry, query) {
    return `
      <div class="glass" style="position:relative;padding:10px;cursor:pointer;" onclick="JollyBarcodeFolder.openScanReady('${_escape(entry.code)}')">
        <div style="width:100%;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#1a1d2e;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:8px;">${_thumbHtml(entry)}</div>
        <div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escape(entry.label)}</div>
        <div class="mono" style="font-size:11px;color:var(--text-low,#6c7192);margin-top:2px;">${highlightDigits(entry.code, query)}</div>
      </div>`;
  }

  function _generatedRow(entry, query) {
    const name = entry.label
      ? _escape(entry.label)
      : '<span class="muted" style="font-style:italic;">Adsız — boş barkod</span>';
    const when = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('az-AZ') : '';
    return `
      <div class="glass" style="padding:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:64px;height:48px;flex-shrink:0;border-radius:8px;overflow:hidden;background:#1a1d2e;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="JollyBarcodeFolder.openScanReady('${_escape(entry.code)}')">${_thumbHtml(entry)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13.5px;font-weight:600;">${name}</div>
            <div class="mono" style="font-size:11.5px;color:var(--text-low,#6c7192);margin-top:2px;">${highlightDigits(entry.code, query)}</div>
            ${when ? `<div class="muted" style="font-size:10.5px;margin-top:2px;">🆕 ${when}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" style="flex:1;min-width:150px;" onclick="JollyBarcodeFolder.convertToProduct('${entry.genId}')">➕ Məhsul kartına çevir</button>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.renameGenerated('${entry.genId}')">✏️ Ad</button>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.openScanReady('${_escape(entry.code)}')">⛶ Skan</button>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.deleteGenerated('${entry.genId}')">🗑️</button>
        </div>
      </div>`;
  }

  /* ---------- Əsas render ---------- */
  function render() {
    if (!_canView()) {
      return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
    }
    _query = '';
    const html = `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📁 Barkod Qovluğu</h2>
      <p class="muted" style="font-size:12px;margin:0 0 12px;">Rəqəm yaz — sistemdə varsa tapır, yoxdursa yeni boş barkod yaradır.</p>

      <div class="glass" style="padding:12px;margin-bottom:14px;">
        <div class="row" style="gap:8px;">
          <input id="bcfSearch" inputmode="numeric" autocomplete="off"
                 placeholder="Barkod rəqəmləri (məs. 3333)..."
                 style="flex:1;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);"
                 oninput="JollyBarcodeFolder.liveSearch(this.value)"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();JollyBarcodeFolder.searchOrCreate();}">
          <button class="icon-btn" title="Kamera ilə skan" onclick="JollyBarcodeFolder.scanIntoSearch()">📷</button>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="JollyBarcodeFolder.searchOrCreate()">🔍 Tap / Yarat</button>
        <div id="bcfGenResult" style="margin-top:10px;"></div>
      </div>

      <div class="row" id="bcfTabs" style="gap:8px;margin-bottom:12px;">
        <span class="chip" id="bcfTabCatalog" onclick="JollyBarcodeFolder.setTab('catalog')">📦 Kataloq</span>
        <span class="chip" id="bcfTabNew" onclick="JollyBarcodeFolder.setTab('new')">🆕 Yaradılanlar</span>
      </div>

      <div id="bcfCount" class="muted" style="font-size:11.5px;margin-bottom:8px;"></div>
      <div id="bcfList"></div>
    `;
    setTimeout(() => _renderList(), 0);
    return html;
  }

  function setTab(t) {
    _tab = t;
    _renderList();
  }

  function _renderList() {
    const el = document.getElementById('bcfList');
    if (!el) return;
    const q = String(_query || '').replace(/\D/g, '');

    const catalog = _catalogEntries().filter(e => !q || String(e.code).includes(q));
    const created = _generatedEntries().filter(e => !q || String(e.code).includes(q));

    const tabCat = document.getElementById('bcfTabCatalog');
    const tabNew = document.getElementById('bcfTabNew');
    if (tabCat) {
      tabCat.textContent = `📦 Kataloq (${catalog.length})`;
      tabCat.style.borderColor = _tab === 'catalog' ? 'var(--accent-1,#7c8aff)' : '';
      tabCat.style.color = _tab === 'catalog' ? 'var(--accent-1,#7c8aff)' : '';
    }
    if (tabNew) {
      tabNew.textContent = `🆕 Yaradılanlar (${created.length})`;
      tabNew.style.borderColor = _tab === 'new' ? '#ffc86b' : '';
      tabNew.style.color = _tab === 'new' ? '#ffc86b' : '';
    }

    const countEl = document.getElementById('bcfCount');

    if (_tab === 'new') {
      if (countEl) countEl.textContent = `${created.length} yaradılmış barkod — adını yaz və məhsul kartına çevir`;
      el.className = '';
      el.innerHTML = created.length
        ? created.map(e => _generatedRow(e, q)).join('')
        : `<div class="empty-state"><div class="big-icon">🆕</div><h3>Hələ yaradılmış barkod yoxdur</h3><p class="muted" style="font-size:12px;">Yuxarıda sistemdə olmayan bir rəqəm yaz — avtomatik bura düşəcək.</p></div>`;
      return;
    }

    if (countEl) countEl.textContent = `${catalog.length} barkod`;
    el.className = 'product-grid';
    el.innerHTML = catalog.length
      ? catalog.map(e => _catalogCard(e, q)).join('')
      : `<div class="empty-state" style="grid-column:1/-1;"><div class="big-icon">🏷️</div><h3>Barkod tapılmadı</h3><p class="muted" style="font-size:12px;">"Tap / Yarat" düyməsi ilə bu barkodu yarada bilərsən.</p></div>`;
  }

  let _debounce = null;
  function liveSearch(q) {
    _query = q;
    if (_debounce) clearTimeout(_debounce);
    _debounce = setTimeout(() => _renderList(), 120);
  }

  function scanIntoSearch() {
    if (typeof JollyBarcode === 'undefined') {
      if (typeof Toast !== 'undefined') Toast.error('Skan modulu yoxdur');
      return;
    }
    JollyBarcode.open((code) => {
      const input = document.getElementById('bcfSearch');
      if (input) input.value = code;
      _query = code;
      searchOrCreate();
    });
  }

  /* ---------- Tək əməliyyat: tap, yoxdursa yarat ---------- */
  function searchOrCreate() {
    const input = document.getElementById('bcfSearch');
    const raw = (input ? input.value : _query || '').replace(/\D/g, '');
    const resultZone = document.getElementById('bcfGenResult');
    if (!raw) {
      if (typeof Toast !== 'undefined') Toast.error('Rəqəm yaz');
      return;
    }
    _query = raw;

    // 1) Kataloqda tam uyğun barkod varmı?
    const found = (typeof JollyDB !== 'undefined') ? JollyDB.Products.findByBarcode(raw) : [];
    if (found.length) {
      const p = found[0];
      if (resultZone) resultZone.innerHTML = `
        <div class="glass" style="padding:10px 12px;display:flex;align-items:center;gap:10px;">
          <span style="flex:1;font-size:12.5px;">✅ Sistemdə var: <b>${_escape(p.name || 'Adsız')}</b></span>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.openScanReady('${_escape(raw)}')">⛶ Aç</button>
        </div>`;
      _tab = 'catalog';
      _renderList();
      return;
    }

    // 2) Artıq "Yaradılanlar" qovluğundadırmı?
    const already = _getGenerated().find(g => g.code === raw);
    if (already) {
      if (resultZone) resultZone.innerHTML = `
        <div class="glass" style="padding:10px 12px;font-size:12.5px;">🆕 Bu barkod artıq "Yaradılanlar" qovluğundadır.</div>`;
      _tab = 'new';
      _renderList();
      return;
    }

    // 3) Yoxdur — avtomatik boş barkod yarat
    if (!_canGenerate()) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Yeni barkod yaratmaq icazən yoxdur');
      return;
    }
    const list = _getGenerated();
    list.unshift({
      id: 'bcg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      code: raw,
      label: '',
      createdAt: Date.now()
    });
    _saveGenerated(list);
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (typeof Toast !== 'undefined') Toast.success('Tapılmadı — yeni boş barkod yaradıldı');
    if (resultZone) resultZone.innerHTML = `
      <div class="glass" style="padding:10px 12px;font-size:12.5px;border-left:3px solid #ffc86b;">
        ❌ Sistemdə tapılmadı → 🆕 boş barkod yaradıldı. Aşağıda <b>"Yaradılanlar"</b> qovluğundan adını yazıb məhsul kartına çevir.
      </div>`;
    _tab = 'new';
    _renderList();
  }

  /* ---------- Yaradılanlar üzərində əməliyyatlar ---------- */
  function renameGenerated(genId) {
    const list = _getGenerated();
    const g = list.find(x => x.id === genId);
    if (!g) return;
    const val = prompt('Bu barkod üçün ad/qeyd:', g.label || '');
    if (val === null) return;
    g.label = val.trim();
    _saveGenerated(list);
    if (typeof Toast !== 'undefined') Toast.success('Ad yeniləndi');
    _renderList();
  }

  function deleteGenerated(genId) {
    if (!confirm('Bu yaradılmış barkod silinsin?')) return;
    _saveGenerated(_getGenerated().filter(g => g.id !== genId));
    if (typeof Toast !== 'undefined') Toast.success('Silindi');
    _renderList();
  }

  /* Yaradılmış barkodu real məhsul kartına çevirir və redaktə formasını açır */
  function convertToProduct(genId) {
    if (!_canCreateProduct()) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Məhsul yaratmaq icazən yoxdur');
      return;
    }
    const list = _getGenerated();
    const g = list.find(x => x.id === genId);
    if (!g) return;

    const name = prompt('Məhsulun adı:', g.label || '');
    if (name === null) return;

    let rec = null;
    try {
      rec = JollyDB.Products.add({
        name: (name || '').trim() || g.code,
        barcodes: [g.code],
        images: []
      });
    } catch (e) {
      console.error('[BarcodeFolder] convertToProduct:', e);
    }
    if (!rec || !rec.id) {
      if (typeof Toast !== 'undefined') Toast.error('Məhsul yaradıla bilmədi');
      return;
    }

    // Qovluqdan çıxar — artıq real məhsuldur
    _saveGenerated(list.filter(x => x.id !== genId));
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (typeof Toast !== 'undefined') Toast.success('📦 Məhsul yaradıldı — şəkil və detalları əlavə et');
    if (window.JollyRouter) JollyRouter.go('#/product/' + rec.id + '/edit');
  }

  return {
    render, setTab, liveSearch, searchOrCreate, scanIntoSearch,
    openScanReady, renameGenerated, deleteGenerated, convertToProduct,
    highlightDigits
  };
})();
