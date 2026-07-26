/* ============================================================
   JOLLY Barkod Qovluğu (2026-07-25, #1)
   - Kataloqdakı BÜTÜN məhsul barkodları + əl ilə yaradılmış
     (məhsula bağlı olmayan) barkodlar bir yerdə
   - Axtarış: rəqəm ardıcıllığı yazdıqca, uyğun hissə HƏR yerdə
     QIRMIZI vurğulanır (tapdıqca qırmızı et)
   - Tapılan barkoda toxunanda skanerlə "bip" vurula bilən
     (skan-hazır) böyük görünüş açılır (JollyProducts.showBarcode)
   - Generator: rəqəm yaz → sistemdə varsa tapır, yoxdursa yeni
     barkod yaradır, nəticə bu qovluğa (aşağıdakı "Yaradılmışlar"
     siyahısına) düşür, 🗑️ ilə silinə bilər
   - "barcode.folder.view" / "barcode.folder.generate" icazələri
     ilə işçiyə ayrıca aç/bağla edilə bilər
   ============================================================ */
const JollyBarcodeFolder = (() => {
  const GEN_KEY = 'jolly_barcode_folder_generated';

  function _canView() { return !(window.JollyAuth && !JollyAuth.can('barcode.folder.view')) && !(typeof POS !== 'undefined' && !POS.can('barcode.folder.view')); }
  function _canGenerate() { return !(typeof POS !== 'undefined' && !POS.can('barcode.folder.generate')); }

  function _getGenerated() {
    return (typeof JollyDB !== 'undefined') ? JollyDB.read(GEN_KEY, []) : [];
  }
  function _saveGenerated(list) {
    if (typeof JollyDB !== 'undefined') JollyDB.write(GEN_KEY, list);
  }

  function _escape(s) {
    return (typeof JollyProducts !== 'undefined') ? JollyProducts.escapeHtml(String(s)) : String(s);
  }

  // Kataloqdakı bütün məhsul barkodları — hər biri {code, label, thumbRef, productId}
  function _catalogEntries() {
    if (typeof JollyDB === 'undefined') return [];
    const out = [];
    JollyDB.Products.all().forEach(p => {
      (p.barcodes || []).forEach(code => {
        out.push({ code, label: p.name || 'Adsız məhsul', thumbRef: (p.images && p.images[0]) || null, productId: p.id, generated: false });
      });
    });
    return out;
  }

  function _generatedAsEntries() {
    return _getGenerated().map(g => ({ code: g.code, label: g.label || g.code, thumbRef: null, productId: null, generated: true, genId: g.id }));
  }

  function _allEntries() {
    return [..._catalogEntries(), ..._generatedAsEntries()];
  }

  // Rəqəm ardıcıllığını qırmızı vurğulayaraq göstərir — "tapdıqca qırmızı et"
  function highlightDigits(code, query) {
    const c = String(code || '');
    const q = String(query || '').replace(/\D/g, '');
    if (!q) return _escape(c);
    const idx = c.indexOf(q);
    if (idx === -1) return _escape(c);
    return _escape(c.slice(0, idx)) + `<span style="color:#ff5c6c;font-weight:800;">${_escape(c.slice(idx, idx + q.length))}</span>` + _escape(c.slice(idx + q.length));
  }

  function _thumbHtml(entry) {
    if (entry.thumbRef) {
      return `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(entry.thumbRef) : 'src="' + entry.thumbRef + '"'} style="width:100%;height:100%;object-fit:cover;">`;
    }
    // Məhsula bağlı olmayan (yaradılmış) barkod — barkodun öz şəklini göstər
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
    setTimeout(() => _renderList(''), 0);
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📁 Barkod Qovluğu</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Bütün barkodlar bir yerdə — rəqəm ardıcıllığı yaz, tapdıqca qırmızı işıqlanır.</p>
      <div class="row" style="gap:8px;margin-bottom:14px;">
        <input id="bcfSearch" inputmode="numeric" placeholder="Rəqəm ardıcıllığı (məs. 3333)..." style="flex:1;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" oninput="JollyBarcodeFolder.liveSearch(this.value)">
      </div>
      <div id="bcfCount" class="muted" style="font-size:11.5px;margin-bottom:8px;"></div>
      <div id="bcfList" class="product-grid"></div>

      ${_canGenerate() ? `
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
  }

  function _renderList(query) {
    const el = document.getElementById('bcfList');
    if (!el) return;
    const q = (query || '').replace(/\D/g, '');
    let entries = _allEntries();
    if (q) entries = entries.filter(e => String(e.code || '').includes(q));
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
    if (typeof JollyBarcode === 'undefined') { Toast.error('Skan modulu yoxdur'); return; }
    JollyBarcode.open((code) => {
      const input = document.getElementById('bcfGenInput');
      if (input) input.value = code;
      generateOrFind();
    });
  }

  function generateOrFind() {
    if (!_canGenerate()) { Toast.error('🔒 Yeni barkod yaratmaq icazən yoxdur'); return; }
    const input = document.getElementById('bcfGenInput');
    const raw = (input ? input.value : '').replace(/\D/g, '');
    if (!raw) { Toast.error('Rəqəm yaz'); return; }
    const resultZone = document.getElementById('bcfGenResult');

    // Əvvəl sistemdə (kataloqda) varmı yoxla
    const found = (typeof JollyDB !== 'undefined') ? JollyDB.Products.findByBarcode(raw) : [];
    if (found.length) {
      const p = found[0];
      if (resultZone) resultZone.innerHTML = `
        <div class="glass" style="padding:10px 12px;display:flex;align-items:center;gap:10px;">
          <span style="flex:1;font-size:12.5px;">✅ Sistemdə tapıldı: <b>${_escape(p.name || 'Adsız')}</b></span>
          <button class="btn btn-ghost btn-sm" onclick="JollyBarcodeFolder.openScanReady('${_escape(raw)}')">Aç</button>
        </div>`;
      Toast.info('Bu barkod artıq mövcuddur — yeni yaradılmadı');
      return;
    }

    // Yoxdursa — yeni yarat
    const already = _getGenerated().find(g => g.code === raw);
    if (already) {
      Toast.info('Bu barkod artıq qovluqda var');
      _renderList(document.getElementById('bcfSearch') ? document.getElementById('bcfSearch').value : '');
      return;
    }
    const label = prompt('Bu barkod üçün ad/qeyd (könüllü):', '') || raw;
    const list = _getGenerated();
    list.unshift({ id: 'bcg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), code: raw, label: label.trim() || raw, createdAt: Date.now() });
    _saveGenerated(list);
    Toast.success('🏷️ Yeni barkod yaradıldı');
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (input) input.value = '';
    if (resultZone) resultZone.innerHTML = '';
    _renderList(document.getElementById('bcfSearch') ? document.getElementById('bcfSearch').value : '');
  }

  function deleteGenerated(genId) {
    if (!confirm('Bu yaradılmış barkod silinsin?')) return;
    _saveGenerated(_getGenerated().filter(g => g.id !== genId));
    Toast.success('Silindi');
    _renderList(document.getElementById('bcfSearch') ? document.getElementById('bcfSearch').value : '');
  }

  /* ---------- Marşrut (#/barcode-folder) ---------- */
  function tryRoute() {
    if ((window.location.hash || '') !== '#/barcode-folder') return;
    const main = document.getElementById('main');
    if (main) main.innerHTML = render();
  }
  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', () => setTimeout(tryRoute, 0));
    setTimeout(tryRoute, 0);
  });

  return { render, liveSearch, openScanReady, generateOrFind, deleteGenerated, scanIntoGenerator, highlightDigits };
})();
