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
  let _sel = new Set();   // "Yaradılanlar"da toplu seçim

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
      createdAt: g.createdAt,
      source: g.source || 'manual'
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
          <span style="font-size:17px;cursor:pointer;user-select:none;" onclick="JollyBarcodeFolder.toggleSel('${entry.genId}')">${_sel.has(entry.genId) ? '☑️' : '⬜'}</span>
          <div style="width:64px;height:48px;flex-shrink:0;border-radius:8px;overflow:hidden;background:#1a1d2e;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="JollyBarcodeFolder.openScanReady('${_escape(entry.code)}')">${_thumbHtml(entry)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13.5px;font-weight:600;">${name}</div>
            <div class="mono" style="font-size:11.5px;color:var(--text-low,#6c7192);margin-top:2px;">${highlightDigits(entry.code, query)}</div>
            ${when ? `<div class="muted" style="font-size:10.5px;margin-top:2px;">${entry.source === 'scan' ? '📷 Skanda tapılmadı' : '🆕'} · ${when}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" style="flex:1;min-width:150px;" onclick="JollyBarcodeFolder.convertToProduct('${entry.genId}')">➕ Məhsul kartına çevir</button>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.renameGenerated('${entry.genId}')">✏️ Ad</button>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.lookupName('${entry.genId}')">🌐 Adını tap</button>
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
        <div id="bcfSuggest" style="margin-top:8px;"></div>
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
      const bulkBar = created.length ? `
        <div class="glass" style="padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:12.5px;flex:1;">${_sel.size ? `${_sel.size} seçilib` : 'Toplu iş üçün seç'}</span>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.selectAll()">☑️ Hamısı</button>
          ${_sel.size ? `
            <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.clearSel()">Təmizlə</button>
            <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.bulkLookup()">🌐 Adları tap</button>
            <button class="btn btn-primary btn-sm" onclick="JollyBarcodeFolder.bulkConvert()">➕ Məhsula çevir</button>
          ` : ''}
          <div id="bcfBulkProgress" style="width:100%;font-size:11.5px;"></div>
        </div>` : '';
      el.innerHTML = created.length
        ? bulkBar + created.map(e => _generatedRow(e, q)).join('')
        : `<div class="empty-state"><div class="big-icon">🆕</div><h3>Hələ yaradılmış barkod yoxdur</h3><p class="muted" style="font-size:12px;">Yuxarıda sistemdə olmayan bir rəqəm yaz — və ya kassada tanınmayan bir kod skan et — avtomatik bura düşəcək.</p></div>`;
      return;
    }

    if (countEl) countEl.textContent = `${catalog.length} barkod`;
    el.className = 'product-grid';
    el.innerHTML = catalog.length
      ? catalog.map(e => _catalogCard(e, q)).join('')
      : `<div class="empty-state" style="grid-column:1/-1;"><div class="big-icon">🏷️</div><h3>Barkod tapılmadı</h3><p class="muted" style="font-size:12px;">"Tap / Yarat" düyməsi ilə bu barkodu yarada bilərsən.</p></div>`;
  }

  /* ── AXTARIŞ TƏKLİFİ (2026-07-27) ───────────────────────────
     "333" yazan kimi bu rəqəmləri ehtiva edən mövcud barkodlar
     düymə kimi çıxır. Toxunanda dərhal həmin barkoda keçir —
     tam nömrəni yazmağa ehtiyac qalmır. */
  const SUGGEST_MAX = 8;

  function _suggestions(q) {
    if (!q || q.length < 2) return [];
    const seen = new Set();
    const out = [];
    const push = (code, label, isNew) => {
      if (seen.has(code)) return;
      seen.add(code);
      out.push({ code, label, isNew });
    };
    _catalogEntries().forEach(e => {
      const i = String(e.code).indexOf(q);
      if (i !== -1) push(e.code, e.label, false);
    });
    _generatedEntries().forEach(e => {
      if (String(e.code).indexOf(q) !== -1) push(e.code, e.label, true);
    });
    // Uyğunluq nə qədər əvvəldədirsə, o qədər yuxarıda olsun
    out.sort((a, b) => String(a.code).indexOf(q) - String(b.code).indexOf(q));
    return out.slice(0, SUGGEST_MAX);
  }

  function _renderSuggest(q) {
    const zone = document.getElementById('bcfSuggest');
    if (!zone) return;
    const list = _suggestions(q);
    if (!list.length) { zone.innerHTML = ''; return; }
    zone.innerHTML = `
      <div class="muted" style="font-size:10.5px;margin-bottom:5px;">Təkliflər — toxun və aç:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${list.map(e => `
          <span class="chip" style="cursor:pointer;font-size:11.5px;${e.isNew ? 'border-color:#ffc86b;' : ''}"
                onclick="JollyBarcodeFolder.pickSuggestion('${_escape(e.code)}')"
                title="${_escape(e.label || '')}">
            ${e.isNew ? '🆕 ' : ''}<span class="mono">${highlightDigits(e.code, q)}</span>
          </span>`).join('')}
      </div>`;
  }

  function pickSuggestion(code) {
    const input = document.getElementById('bcfSearch');
    if (input) input.value = code;
    _query = code;
    const zone = document.getElementById('bcfSuggest');
    if (zone) zone.innerHTML = '';
    searchOrCreate();
  }

  let _debounce = null;
  function liveSearch(q) {
    _query = q;
    if (_debounce) clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      _renderSuggest(String(_query || '').replace(/\D/g, ''));
      _renderList();
    }, 120);
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
    const sz = document.getElementById('bcfSuggest');
    if (sz) sz.innerHTML = '';

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

  /* ── TOPLU İŞ (2026-07-27) ───────────────────────────────────
     Gözləyən barkodlar onlarla yığılanda bir-bir açmaq əziyyətdir.
     Seçirsən → adları internetdən birdən tapılır → hamısı birdən
     məhsula çevrilir. */
  function toggleSel(genId) {
    _sel.has(genId) ? _sel.delete(genId) : _sel.add(genId);
    _renderList();
  }
  function clearSel() { _sel.clear(); _renderList(); }
  function selectAll() {
    const q = String(_query || '').replace(/\D/g, '');
    _generatedEntries().filter(e => !q || String(e.code).includes(q))
      .forEach(e => _sel.add(e.genId));
    _renderList();
  }

  function _progress(text) {
    const el = document.getElementById('bcfBulkProgress');
    if (el) el.innerHTML = text ? `<span class="muted">${text}</span>` : '';
  }

  /* Seçilənlərin adlarını bir-bir internetdən tapır */
  async function bulkLookup() {
    if (!_sel.size) return;
    if (!navigator.onLine) {
      if (typeof Toast !== 'undefined') Toast.error('Oflaynsan — internet lazımdır');
      return;
    }
    const ids = [..._sel];
    let found = 0, done = 0;
    for (const genId of ids) {
      done++;
      _progress(`🌐 ${done}/${ids.length} yoxlanılır — ${found} tapıldı`);
      const list = _getGenerated();
      const g = list.find(x => x.id === genId);
      if (!g || g.label) continue;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch('/api/barcode-lookup?upc=' + encodeURIComponent(g.code), { signal: ctrl.signal });
        clearTimeout(t);
        const data = await r.json();
        if (data && data.found && data.title) {
          const cur = _getGenerated();
          const item = cur.find(x => x.id === genId);
          if (item) {
            item.label = data.brand ? (data.title + ' · ' + data.brand) : data.title;
            _saveGenerated(cur);
            found++;
          }
        }
      } catch (e) { /* keç */ }
    }
    _progress('');
    if (typeof JollySound !== 'undefined' && found) JollySound.success();
    if (typeof Toast !== 'undefined') {
      Toast.success(`${found} ad tapıldı, ${ids.length - found} tapılmadı`);
    }
    _renderList();
  }

  /* Seçilənləri birdən real məhsula çevirir */
  function bulkConvert() {
    if (!_sel.size) return;
    if (!_canCreateProduct()) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Məhsul yaratmaq icazən yoxdur');
      return;
    }
    const list = _getGenerated();
    const chosen = list.filter(g => _sel.has(g.id));
    const unnamed = chosen.filter(g => !g.label).length;

    let msg = `${chosen.length} barkod məhsula çevriləcək.`;
    if (unnamed) msg += `\n\n${unnamed} ədədinin adı yoxdur — onların adı barkod nömrəsi olacaq (sonra dəyişə bilərsən).`;
    if (!confirm(msg + '\n\nDavam edim?')) return;

    let ok = 0;
    const keep = [];
    list.forEach(g => {
      if (!_sel.has(g.id)) { keep.push(g); return; }
      try {
        const rec = JollyDB.Products.add({
          name: (g.label || '').trim() || g.code,
          barcodes: [g.code],
          images: []
        });
        if (rec && rec.id) { ok++; return; }
      } catch (e) { console.error('[BarcodeFolder] bulkConvert:', e); }
      keep.push(g);   // alınmadı — qovluqda qalsın
    });

    _saveGenerated(keep);
    _sel.clear();
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (typeof Toast !== 'undefined') Toast.success(`📦 ${ok} məhsul yaradıldı`);
    _tab = 'new';
    _renderList();
  }

  /* Naməlum barkodun adını dünya bazasından tapmağa çalışır */
  function lookupName(genId) {
    const list = _getGenerated();
    const g = list.find(x => x.id === genId);
    if (!g) return;
    if (!navigator.onLine) {
      if (typeof Toast !== 'undefined') Toast.error('Oflaynsan — internet lazımdır');
      return;
    }
    if (typeof Toast !== 'undefined') Toast.info('🌐 Axtarılır...');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    fetch('/api/barcode-lookup?upc=' + encodeURIComponent(g.code), { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        clearTimeout(t);
        if (data && data.found && data.title) {
          const cur = _getGenerated();
          const item = cur.find(x => x.id === genId);
          if (!item) return;
          item.label = data.brand ? (data.title + ' · ' + data.brand) : data.title;
          _saveGenerated(cur);
          if (typeof JollySound !== 'undefined') JollySound.success();
          if (typeof Toast !== 'undefined') Toast.success('Tapıldı: ' + data.title);
          _renderList();
        } else {
          if (typeof Toast !== 'undefined') Toast.error('Bu barkod bazada tapılmadı');
        }
      })
      .catch(() => {
        clearTimeout(t);
        if (typeof Toast !== 'undefined') Toast.error('Axtarış alınmadı');
      });
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
    render, setTab, liveSearch, searchOrCreate, scanIntoSearch, pickSuggestion,
    openScanReady, renameGenerated, deleteGenerated, convertToProduct, lookupName,
    toggleSel, clearSel, selectAll, bulkLookup, bulkConvert,
    highlightDigits
  };
})();
