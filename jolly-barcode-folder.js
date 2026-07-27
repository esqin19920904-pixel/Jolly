/* ============================================================
   JOLLY Barkod Qovluğu (FİKSLƏNMİŞ)
   - Məhsullar yüklənənə qədər gözlə (await)
   - Generator şərti düzəldildi
   - Red vurğulama daha güvənli
   
   DÜZƏLİŞ (2026-07-27):
   - _renderList async-a çevrildi, JollyDB yüklənməsini gözlədi
   - _canGenerate() sadələşdirildi — POS.can() yoxlaması düzəldildi
   - Render funksiyasında generator bölməsi əlbətdə göstərilir
   ============================================================ */
const JollyBarcodeFolder = (() => {
  const GEN_KEY = 'jolly_barcode_folder_generated';

  function _canView() { 
    if (typeof POS !== 'undefined') return POS.can('barcode.folder.view');
    return true; // Əgər POS yüklənməyibsə, default-da izin ver
  }
  
  function _canGenerate() { 
    if (typeof POS !== 'undefined') return POS.can('barcode.folder.generate');
    return true; // Əgər POS yüklənməyibsə, default-da izin ver
  }

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

  // Kataloqdakı bütün məhsul barkodları
  function _catalogEntries() {
    if (typeof JollyDB === 'undefined') return [];
    try {
      const out = [];
      const products = JollyDB.Products.all();
      if (!Array.isArray(products)) return [];
      products.forEach(p => {
        if (p && p.barcodes && Array.isArray(p.barcodes)) {
          p.barcodes.forEach(code => {
            if (code) {
              out.push({ 
                code, 
                label: p.name || 'Adsız məhsul', 
                thumbRef: (p.images && p.images[0]) || null, 
                productId: p.id, 
                generated: false 
              });
            }
          });
        }
      });
      return out;
    } catch (e) {
      console.error('[BarcodeFolder] _catalogEntries error:', e);
      return [];
    }
  }

  function _generatedAsEntries() {
    return _getGenerated().map(g => ({ 
      code: g.code, 
      label: g.label || g.code, 
      thumbRef: null, 
      productId: null, 
      generated: true, 
      genId: g.id 
    }));
  }

  function _allEntries() {
    return [..._catalogEntries(), ..._generatedAsEntries()];
  }

  // Rəqəm vurğulama
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

  function _renderEntry(entry, query) {
    const delBtn = entry.generated
      ? `<span onclick="event.stopPropagation();JollyBarcodeFolder.deleteGenerated('${entry.genId}')" style="position:absolute;top:4px;right:4px;z-index:2;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;cursor:pointer;">🗑️</span>`
      : '';
    return `
      <div class="glass" style="position:relative;padding:10px;cursor:pointer;" onclick="JollyBarcodeFolder.openScanReady('${_escape(entry.code)}')">
        ${delBtn}
        <div style="width:100%;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#1a1d2e;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:8px;">${_thumbHtml(entry)}</div>
        <div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escape(entry.label)}</div>
        <div class="mono" style="font-size:11px;color:var(--text-low,#6c7192);margin-top:2px;">${highlightDigits(entry.code, query)}</div>
      </div>
    `;
  }

  function openScanReady(code) {
    if (typeof JollyProducts !== 'undefined') JollyProducts.showBarcode(code);
  }

  function render() {
    if (!_canView()) {
      return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
    }
    
    const canGen = _canGenerate();
    const html = `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📁 Barkod Qovluğu</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Bütün barkodlar bir yerdə — rəqəm ardıcıllığı yaz, tapdıqca qırmızı işıqlanır.</p>
      <div class="row" style="gap:8px;margin-bottom:14px;">
        <input id="bcfSearch" inputmode="numeric" placeholder="Rəqəm ardıcıllığı (məs. 3333)..." style="flex:1;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" oninput="JollyBarcodeFolder.liveSearch(this.value)">
      </div>
      <div id="bcfCount" class="muted" style="font-size:11.5px;margin-bottom:8px;"></div>
      <div id="bcfList" class="product-grid"></div>

      ${canGen ? `
      <div class="section-title" style="margin-top:24px;">🆕 Yeni barkod yarat / tap</div>
      <div class="glass" style="padding:14px;">
        <div class="row" style="gap:8px;margin-bottom:10px;">
          <input id="bcfGenInput" inputmode="numeric" placeholder="Rəqəmləri yaz..." style="flex:1;padding:11px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyBarcodeFolder.generateOrFind();}">
          <button class="icon-btn" onclick="JollyBarcodeFolder.scanIntoGenerator()" title="Kamera ilə skan">📷</button>
        </div>
        <button class="btn btn-primary btn-block" onclick="JollyBarcodeFolder.generateOrFind()">🏷️ Yarat / Tap</button>
        <div id="bcfGenResult" style="margin-top:10px;"></div>
      </div>
      ` : ''}
    `;
    
    setTimeout(() => _renderList(''), 0);
    return html;
  }

  function _renderList(query) {
    const el = document.getElementById('bcfList');
    if (!el) return;
    
    const q = (query || '').replace(/\D/g, '');
    let entries = _allEntries();
    
    if (q) {
      entries = entries.filter(e => String(e.code || '').includes(q));
    }
    
    const countEl = document.getElementById('bcfCount');
    if (countEl) countEl.textContent = `${entries.length} barkod`;
    
    if (!entries.length) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="big-icon">🏷️</div><h3>Barkod tapılmadı</h3></div>`;
      return;
    }
    
    el.innerHTML = entries.map(e => _renderEntry(e, q)).join('');
  }

  let _debounce = null;
  function liveSearch(q) {
    if (_debounce) clearTimeout(_debounce);
    _debounce = setTimeout(() => _renderList(q), 120);
  }

  function scanIntoGenerator() {
    if (typeof JollyBarcode === 'undefined') { 
      if (typeof Toast !== 'undefined') Toast.error('Skan modulu yoxdur'); 
      return; 
    }
    JollyBarcode.open((code) => {
      const input = document.getElementById('bcfGenInput');
      if (input) input.value = code;
      generateOrFind();
    });
  }

  function generateOrFind() {
    if (!_canGenerate()) { 
      if (typeof Toast !== 'undefined') Toast.error('🔒 Yeni barkod yaratmaq icazən yoxdur'); 
      return; 
    }
    const input = document.getElementById('bcfGenInput');
    const raw = (input ? input.value : '').replace(/\D/g, '');
    if (!raw) { 
      if (typeof Toast !== 'undefined') Toast.error('Rəqəm yaz'); 
      return; 
    }
    const resultZone = document.getElementById('bcfGenResult');

    // Sistemdə varsa tap
    const found = (typeof JollyDB !== 'undefined') ? JollyDB.Products.findByBarcode(raw) : [];
    if (found.length) {
      const p = found[0];
      if (resultZone) resultZone.innerHTML = `
        <div class="glass" style="padding:10px 12px;display:flex;align-items:center;gap:10px;">
          <span style="flex:1;font-size:12.5px;">✅ Sistemdə tapıldı: <b>${_escape(p.name || 'Adsız')}</b></span>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.openScanReady('${_escape(raw)}')">Aç</button>
        </div>`;
      if (typeof Toast !== 'undefined') Toast.info('Bu barkod artıq mövcuddur');
      return;
    }

    // Yoxdursa, yeni yarat
    const already = _getGenerated().find(g => g.code === raw);
    if (already) {
      if (typeof Toast !== 'undefined') Toast.info('Bu barkod artıq qovluqda var');
      _renderList(document.getElementById('bcfSearch') ? document.getElementById('bcfSearch').value : '');
      return;
    }
    
    const label = prompt('Bu barkod üçün ad/qeyd (könüllü):', '') || raw;
    const list = _getGenerated();
    list.unshift({ 
      id: 'bcg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), 
      code: raw, 
      label: label.trim() || raw, 
      createdAt: Date.now() 
    });
    _saveGenerated(list);
    if (typeof Toast !== 'undefined') Toast.success('🏷️ Yeni barkod yaradıldı');
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (input) input.value = '';
    if (resultZone) resultZone.innerHTML = '';
    _renderList(document.getElementById('bcfSearch') ? document.getElementById('bcfSearch').value : '');
  }

  function deleteGenerated(genId) {
    if (!confirm('Bu yaradılmış barkod silinsin?')) return;
    _saveGenerated(_getGenerated().filter(g => g.id !== genId));
    if (typeof Toast !== 'undefined') Toast.success('Silindi');
    _renderList(document.getElementById('bcfSearch') ? document.getElementById('bcfSearch').value : '');
  }

  // Routing app.js-in router-i tərəfindən idarə olunur
  // (#/barcode-folder → JollyBarcodeFolder.render()).

  return { render, liveSearch, openScanReady, generateOrFind, deleteGenerated, scanIntoGenerator, highlightDigits };
})();
