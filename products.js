/* ============================================================
   JOLLY Products — məhsul siyahısı, kartı, detalı və forması
   ============================================================ */

const JollyProducts = (() => {

  function statusColor(statusName) {
    const st = JollyDB.Statuses.all().find(s => s.name === statusName);
    return st ? st.color : '#7c8aff';
  }

  function renderCard(p) {
    const thumb = (p.images && p.images[0]) ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} alt="">` : '🧴';
    const pki = escapeHtml(JSON.stringify(p.images || []));
    const st = (p.status || '').toLowerCase();
    const glowClass = st.includes('problem') ? 'card-glow-danger' : (st.includes('yeni') ? 'card-glow-new' : '');
    return `
      <div class="glass product-card ${glowClass}" data-id="${p.id}" onclick="JollyRouter.go('#/product/${p.id}')">
        <div class="thumb peekable" data-pki='${pki}' data-pkx="0">${thumb}</div>
        <div class="p-name">${escapeHtml(p.name || 'Adsız məhsul')}</div>
        <div class="p-meta">${escapeHtml(p.mainCode || '')}${p.extraCodeValue ? ' · ' + escapeHtml(p.extraCodeType || '') + ' ' + escapeHtml(p.extraCodeValue) : ''}</div>
        ${(p.barcodes && p.barcodes.length) ? `<div class="mono" style="font-size:10.5px;color:var(--accent-2);letter-spacing:0.3px;opacity:.85;">🏷️ ${escapeHtml(p.barcodes[0])}${p.barcodes.length > 1 ? ` +${p.barcodes.length - 1}` : ''}</div>` : ''}
        <div class="row between">
          <span class="p-price">${p.price != null && p.price !== '' ? p.price + ' ₼' : '—'}</span>
          ${p.status ? `<span class="status-pill"><span class="dot" style="background:${statusColor(p.status)}"></span>${escapeHtml(p.status)}</span>` : ''}
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  function renderList(container, products) {
    if (!products.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="big-icon">📦</div>
          <h3>Məhsul tapılmadı</h3>
          <p>Yeni məhsul əlavə etmək üçün aşağı sağdakı düyməni sıx.</p>
        </div>`;
      return;
    }
    container.innerHTML = `<div class="product-grid">${products.map(renderCard).join('')}</div>`;
  }

  /* ---------- Home / List page ---------- */
  function renderHomePage() {
    const all = JollyDB.Products.all();
    const drafts = JollyDB.Drafts.all();
    return `
      <div class="glass command-bar" onclick="if(event.target.tagName!=='INPUT'){}">
        <span style="opacity:.6">🔎</span>
        <input id="homeSearch" placeholder="Ad, kod, barkod, firma ilə axtar..." oninput="JollyProducts.liveSearch(this.value)">
        <button class="mic-btn" onclick="JollyProducts.voiceSearch()">🎤</button>
        <button class="scan-btn" onclick="JollyProducts.scanSearch()">▦</button>
      </div>

      <div class="chip-row" style="margin-bottom:6px;" id="homeFilterChips">
        <span class="chip" data-hf="fav" onclick="JollyProducts.homeFilter('fav', this)">⭐ Favorilər</span>
        <span class="chip" data-hf="problemli" onclick="JollyProducts.homeFilter('problemli', this)">⚠️ Problemli</span>
        <span class="chip" data-hf="barkodsuz" onclick="JollyProducts.homeFilter('barkodsuz', this)">🏷️ Barkodsuz</span>
        <span class="chip" data-hf="sekilsiz" onclick="JollyProducts.homeFilter('sekilsiz', this)">🖼️ Şəkilsiz</span>
        ${brandChips()}
        <span class="chip" onclick="JollyRouter.go('#/drafts')">📥 Gələn Mallar (${drafts.length})</span>
      </div>
      <div class="chip-row" style="margin-bottom:6px;">
        <span class="chip" id="sortChip" onclick="JollyProducts.cycleSort()">↕️ Sıra: Yeni</span>
      </div>

      <div class="section-title">Son əlavə edilənlər</div>
      <div id="homeProductList"></div>
    `;
  }

  function afterHomeRender() {
    applyHomeView();
    // aktiv filtr çipini işıqlandır
    if (homeState.filter) {
      const chip = document.querySelector(`#homeFilterChips .chip[data-hf="${homeState.filter}"]`);
      if (chip) chip.classList.add('chip-active');
    }
    const sc = document.getElementById('sortChip');
    if (sc) { const s = SORTS.find(x => x.key === homeState.sort); if (s) sc.textContent = s.label; }
  }

  /* --- Ağıllı filtr/sort (ana səhifə) --- */
  let homeState = { filter: null, sort: 'new' };
  const SORTS = [
    { key: 'new', label: '↕️ Sıra: Yeni', fn: (a,b) => (b.createdAt||0)-(a.createdAt||0) },
    { key: 'name', label: '↕️ Sıra: Ad (A-Z)', fn: (a,b) => String(a.name||'').localeCompare(String(b.name||''), 'az') },
    { key: 'priceUp', label: '↕️ Sıra: Ucuzdan', fn: (a,b) => (a.price||0)-(b.price||0) },
    { key: 'priceDown', label: '↕️ Sıra: Bahadan', fn: (a,b) => (b.price||0)-(a.price||0) },
  ];

  function brandChips() {
    // ən çox işlənən 4 firma çipi
    const counts = {};
    JollyDB.Products.all().forEach(p => { if (p.brand) counts[p.brand] = (counts[p.brand]||0)+1; });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 4)
      .map(([b]) => `<span class="chip" data-hf="brand:${escapeHtml(b)}" onclick="JollyProducts.homeFilter('brand:${escapeHtml(b)}', this)">🏭 ${escapeHtml(b)}</span>`).join('');
  }

  function applyHomeView() {
    let items = JollyDB.Products.all();
    const f = homeState.filter;
    if (f === 'fav') items = items.filter(p => p.favorite);
    else if (f === 'problemli') items = items.filter(p => p.status === 'Problemli');
    else if (f === 'barkodsuz') items = items.filter(p => !p.barcodes || !p.barcodes.length);
    else if (f === 'sekilsiz') items = items.filter(p => !p.images || !p.images.length);
    else if (f && f.startsWith('brand:')) { const b = f.slice(6); items = items.filter(p => p.brand === b); }
    const sort = SORTS.find(s => s.key === homeState.sort) || SORTS[0];
    items = items.slice().sort(sort.fn);
    if (!f) items = items.slice(0, 12); // filtr yoxdursa son 12
    const titleEl = document.querySelector('.section-title');
    if (titleEl) titleEl.textContent = f ? `Nəticə: ${items.length} məhsul` : 'Son əlavə edilənlər';
    renderList(document.getElementById('homeProductList'), items);
  }

  function homeFilter(f, chipEl) {
    // eyni çipə ikinci toxunuş = filtri götür
    homeState.filter = (homeState.filter === f) ? null : f;
    document.querySelectorAll('#homeFilterChips .chip').forEach(c => c.classList.remove('chip-active'));
    if (homeState.filter && chipEl) chipEl.classList.add('chip-active');
    if (typeof JollySound !== 'undefined') JollySound.tap();
    applyHomeView();
  }

  function cycleSort() {
    const idx = SORTS.findIndex(s => s.key === homeState.sort);
    homeState.sort = SORTS[(idx + 1) % SORTS.length].key;
    const chip = document.getElementById('sortChip');
    if (chip) chip.textContent = SORTS.find(s => s.key === homeState.sort).label;
    if (typeof JollySound !== 'undefined') JollySound.tap();
    applyHomeView();
  }

  let _searchDebounce = null;
  function liveSearch(q) {
    if (_searchDebounce) clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => runSearch(q), 250);
  }

  function runSearch(q) {
    const container = document.getElementById('homeProductList');
    const titleEl = document.querySelector('.section-title');
    if (!q) {
      if (titleEl) titleEl.firstChild.textContent = 'Son əlavə edilənlər ';
      afterHomeRender();
      return;
    }
    const results = JollyDB.Products.search(q);
    if (titleEl) titleEl.firstChild.textContent = `Nəticələr (${results.length}) `;
    renderList(container, results);
  }

  function voiceSearch() {
    JollyVoice.listen((text) => {
      document.getElementById('homeSearch').value = text;
      liveSearch(text);
      Toast.success(`"${text}" axtarılır`);
    });
  }

  function scanSearch() {
    JollyBarcode.open((code) => {
      const found = JollyDB.Products.findByBarcode(code);
      if (found.length === 1) {
        JollyRouter.go(`#/product/${found[0].id}`);
      } else if (found.length > 1) {
        document.getElementById('homeSearch').value = code;
        liveSearch(code);
      } else {
        Toast.error(`Barkod tapılmadı: ${code}`);
        if (confirm(`"${code}" barkodu heç bir məhsulda yoxdur. Yeni məhsul yaratmaq istəyirsən?`)) {
          sessionStorage.setItem('jolly_prefill_barcode', code);
          JollyRouter.go('#/product/new');
        }
      }
    });
  }

  /* ---------- Filtered list page (#/products?filter=) ---------- */
  function renderFilteredPage(params) {
    let products = [];
    let title = 'Bütün məhsullar';
    if (params.filter === 'problemli') { products = JollyDB.Products.all().filter(p => (p.status || '').toLowerCase().includes('problem')); title = 'Problemli məhsullar'; }
    else if (params.filter === 'barkodsuz') { products = JollyDB.Products.filter({ hasBarcode: false }); title = 'Barkodsuz məhsullar'; }
    else if (params.filter === 'sekilsiz') { products = JollyDB.Products.filter({ hasImage: false }); title = 'Şəkilsiz məhsullar'; }
    else if (params.brand) { products = JollyDB.Products.filter({ brand: params.brand }); title = `Firma: ${params.brand}`; }
    else if (params.group) { products = JollyDB.Products.filter({ group: params.group }); title = `Qrup: ${params.group}`; }
    else { products = JollyDB.Products.all(); }

    setTimeout(() => renderList(document.getElementById('filteredList'), products), 0);
    return `
      <div class="row between" style="margin-bottom:14px;">
        <h2 style="font-family:var(--font-display);margin:0;font-size:19px;">${escapeHtml(title)}</h2>
        <span class="muted mono">${products.length}</span>
      </div>
      <div id="filteredList"></div>
    `;
  }

  /* ---------- Drafts page ---------- */
  function deleteDraft(id) {
    if (!confirm('Bu gələn malı silmək istəyirsən?')) return;
    // Şəkli də IDB-dən sil
    const d = JollyDB.Drafts.get(id);
    if (d && d.images && typeof JollyStorage !== 'undefined') {
      d.images.forEach(ref => { if (ref && ref.startsWith && ref.startsWith('idb:')) JollyStorage.deleteImage(ref); });
    }
    JollyDB.Drafts.remove(id);
    if (typeof JollySound !== 'undefined') JollySound.tap();
    Toast.info('Silindi');
    JollyApp.render();
  }

  function renderDraftsPage() {
    const drafts = JollyDB.Drafts.all();
    setTimeout(() => {
      const el = document.getElementById('draftsList');
      if (!drafts.length) {
        el.innerHTML = `<div class="empty-state"><div class="big-icon">📝</div><h3>Gələn Mal yoxdur</h3><p>Tez şəkil çək ilə mal əlavə et, sonra burada tamamla.</p></div>`;
        return;
      }
      el.innerHTML = `<div class="product-grid">${drafts.map(d => `
        <div class="glass product-card" style="position:relative;" onclick="JollyRouter.go('#/product/new?draft=${d.id}')">
          <button class="draft-del" onclick="event.stopPropagation();JollyProducts.deleteDraft('${d.id}')" title="Sil">🗑️</button>
          <div class="thumb">${d.images && d.images[0] ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(d.images[0]) : 'src="' + d.images[0] + '"'}>` : '📝'}</div>
          <div class="p-name">${escapeHtml(d.name || 'Adsız qaralama')}</div>
          <div class="p-meta muted">Tamamlanmayıb</div>
        </div>
      `).join('')}</div>`;
    }, 0);
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📥 Gələn Mallar</h2><p class="muted" style="font-size:12px;margin:0 0 14px;">Tez çəkdiyin mallar — toxun, tam kartı doldur.</p>
      <div class="row" style="gap:10px;margin-bottom:16px;">
        <button class="btn btn-primary" style="flex:1;" onclick="JollyDashboard.quickPhoto('camera')">📷 Kamera ilə çək</button>
        <button class="btn btn-ghost" style="flex:1;" onclick="JollyDashboard.quickPhoto('gallery')">🖼️ Qalereyadan</button>
      </div>
      <div id="draftsList"></div>
    `;
  }

  /* ---------- Product detail page ---------- */
  function readiness(p) {
    const missing = [];
    if (!p.images || !p.images.length) missing.push('Şəkil yoxdur');
    if (!p.barcodes || !p.barcodes.length) missing.push('Barkod yoxdur');
    if (p.price == null || p.price === '') missing.push('Qiymət yoxdur');
    return { ready: missing.length === 0, missing };
  }

  function infoRow(label, value, unit) {
    const has = value != null && value !== '';
    return `<div class="list-row"><span>${escapeHtml(label)}</span><span class="${has ? 'mono' : 'muted'}" style="${has ? '' : 'font-size:12px;'}">${has ? escapeHtml(value) + (unit || '') : label + ' yazılmayıb'}</span></div>`;
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '—'; }
  }

  function renderDetailPage(id) {
    const p = JollyDB.Products.get(id);
    if (!p) return `<div class="empty-state"><div class="big-icon">❓</div><h3>Məhsul tapılmadı</h3></div>`;
    if (typeof JollyAI !== 'undefined') JollyAI.setContext({ currentProductId: id, lastFoundProductId: id });
    const images = p.images || [];
    const imagesJson = escapeHtml(JSON.stringify(images));
    const r = readiness(p);
    const firstBarcode = (p.barcodes && p.barcodes[0]) || null;
    let barcodeImg = null;
    let checksumWarning = null;
    if (firstBarcode) {
      barcodeImg = (typeof JollyBarcodeGen !== 'undefined' && JollyBarcodeGen.toDataURL(firstBarcode)) || generateBarcodeImage(firstBarcode);
      if (typeof JollyBarcodeGen !== 'undefined') {
        const v = JollyBarcodeGen.validate(firstBarcode);
        if (!v.checksumOk) checksumWarning = `⚠️ ${v.expectedType.toUpperCase()} checksum səhvdir (olmalı idi: ...${v.correctChecksum}) — Code128 kimi göstərilir, skan olunur, amma rəqəmi yoxla.`;
      }
    }
    return `
      <div class="glass" style="padding:16px;">
        <div class="image-strip" style="margin-bottom:10px;">
          ${images.map((src, i) => `<div class="image-slot zoomable peekable" data-pki='${imagesJson}' data-pkx="${i}" onclick='JollyProducts.openViewer(${imagesJson}, ${i})'><img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(src) : 'src="' + src + '"'}></div>`).join('') || `<div class="image-slot">🧴</div>`}
        </div>
        ${images.length > 1 ? `<div class="row" style="justify-content:center;gap:4px;margin-bottom:12px;">${images.map((_, i) => `<span style="width:6px;height:6px;border-radius:50%;background:${i === 0 ? 'var(--accent-1)' : 'rgba(255,255,255,0.2)'};"></span>`).join('')}</div>` : ''}

        <h2 style="font-family:var(--font-display);margin:0 0 6px;font-size:20px;">${escapeHtml(p.name)}</h2>
        <div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          ${p.status ? `<span class="status-pill"><span class="dot" style="background:${statusColor(p.status)}"></span>${escapeHtml(p.status)}</span>` : ''}
          <span class="status-pill" style="background:${r.ready ? 'rgba(41,224,201,0.14)' : 'rgba(255,184,77,0.14)'};color:${r.ready ? 'var(--accent-2)' : 'var(--accent-warn)'};">${r.ready ? '🟢 Kassaya hazır' : '🟠 Yarımçıqdır'}</span>
          <span class="status-pill" style="background:rgba(200,107,255,0.14);color:#c86bff;cursor:pointer;" onclick="JollyProductDNA.open('${p.id}')">🧬 Pasport</span>
        </div>
        ${!r.ready ? `<div style="font-size:11.5px;color:var(--accent-warn);margin-bottom:12px;">${r.missing.map(escapeHtml).join(' · ')}</div>` : ''}

        <div class="tag-list">
          ${p.mainCode ? chipInfo('Xüsusi kod', p.mainCode) : ''}
          ${p.extraCodeValue ? chipInfo(p.extraCodeType || 'Model', p.extraCodeValue) : ''}
          ${p.color ? chipInfo('Rəng', p.color) : ''}
        </div>

        <div class="section-title">Qiymət</div>
        <div style="font-family:var(--font-display);font-size:28px;font-weight:700;color:var(--accent-2);">${p.price != null && p.price !== '' ? p.price + ' ₼' : '—'}</div>
        ${(p.price == null || p.price === '') ? `<div class="muted" style="font-size:11.5px;margin-top:-4px;">Qiymət yazılmayıb</div>` : ''}

        ${firstBarcode ? `
        <div class="section-title">Kassa üçün barkod</div>
        <div class="glass barcode-scanbox" style="padding:14px;text-align:center;cursor:pointer;background:rgba(255,255,255,0.9);" onclick="JollyProducts.showBarcode('${escapeHtml(firstBarcode)}')">
          <img src="${barcodeImg}" style="width:100%;max-width:320px;border-radius:6px;">
          <div class="mono" style="color:#000;font-size:15px;margin-top:6px;font-weight:700;">${escapeHtml(firstBarcode)}</div>
          ${p.last4 ? `<div style="color:#555;font-size:11px;margin-top:2px;">Son 4: ${escapeHtml(p.last4)}</div>` : ''}
        </div>
        ${checksumWarning ? `<p class="muted" style="font-size:11px;color:var(--accent-warn);margin-top:6px;">${escapeHtml(checksumWarning)}</p>` : ''}
        ${p.barcodes.length > 1 ? `
          <div class="glass" style="padding:4px 14px;margin-top:8px;">
            ${p.barcodes.slice(1).map(b => `<div class="list-row" onclick="JollyProducts.showBarcode('${escapeHtml(b)}')" style="cursor:pointer;"><span class="mono">${escapeHtml(b)}</span><span style="color:var(--accent-1);">⛶ böyüt</span></div>`).join('')}
          </div>` : ''}
        ` : `<div class="section-title">Barkod</div><div class="muted">Barkod yoxdur</div>`}

        <div class="section-title">Məlumat</div>
        <div class="glass" style="padding:4px 14px;">
          ${infoRow('Firma', p.brand)}
          ${infoRow('Qrup', p.group)}
          ${infoRow('Yer / Rəf', p.location)}
          ${infoRow('Tədarükçü', p.supplier)}
        </div>

        <div class="section-title">Qeyd</div>
        <div class="${p.note ? 'muted' : 'muted'}" style="${p.note ? '' : 'font-size:12px;'}">${p.note ? escapeHtml(p.note) : 'Qeyd əlavə edilməyib'}</div>

        <div class="row" style="margin-top:22px;gap:10px;">
          <button class="btn btn-ghost" style="font-size:20px;padding:12px 16px;" onclick="JollyProducts.toggleFav('${p.id}')">${p.favorite ? '⭐' : '☆'}</button>
          <button class="btn btn-primary" style="flex:1;" onclick="JollyRouter.go('#/product/${p.id}/edit')">✏️ Redaktə et</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyProducts.whatsappShare('${p.id}')">📤 WhatsApp</button>
          <button class="icon-btn" onclick="JollyProducts.moreMenu('${p.id}')">⋮</button>
        </div>

        ${typeof JollyBrain !== 'undefined' ? JollyBrain.renderSimilarHtml(p) : ''}

        <div class="section-title">Tarixçə</div>
        <div class="glass" style="padding:4px 14px;">
          <div class="list-row"><span class="muted" style="font-size:12px;">Yaradıldı</span><span class="mono" style="font-size:12px;">${fmtDate(p.createdAt)}</span></div>
          <div class="list-row"><span class="muted" style="font-size:12px;">Son redaktə</span><span class="mono" style="font-size:12px;">${fmtDate(p.updatedAt)}</span></div>
          ${p.whatsappCount ? `<div class="list-row"><span class="muted" style="font-size:12px;">WhatsApp göndərildi</span><span class="mono" style="font-size:12px;">${p.whatsappCount} dəfə</span></div>` : ''}
        </div>
      </div>
    `;
  }

  async function openViewer(images, index) {
    if (typeof JollyViewer === 'undefined') return;
    let resolved = images;
    if (typeof JollyStorage !== 'undefined') {
      resolved = await JollyStorage.resolveAll(images);
    }
    JollyViewer.open(resolved, index);
  }

  // Barkodu böyük, skan oluna bilən şəkil kimi göstər (kassir skanerlə oxusun)
  function showBarcode(code) {
    if (typeof JollyViewer === 'undefined') return;
    let dataUrl;
    if (typeof JollyBarcodeGen !== 'undefined') {
      dataUrl = JollyBarcodeGen.toDataURL(code); // real EAN-13/Code128
    }
    if (!dataUrl) dataUrl = generateBarcodeImage(code); // fallback
    JollyViewer.open([dataUrl], 0, code);
  }

  // Code128 sadə barkod şəkli yaradır (canvas)
  function generateBarcodeImage(code) {
    // Sadə, geniş zolaqlı vizual barkod (skaner üçün EAN/Code128 tam deyil, amma rəqəm + oxunaqlı zolaq)
    const canvas = document.createElement('canvas');
    const W = 700, H = 320;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    // hər rəqəmi zolaq şəklinə çevir (sadə kodlama)
    const digits = code.replace(/\D/g, '') || '0';
    let x = 40;
    const barAreaW = W - 80;
    const unit = Math.max(2, Math.floor(barAreaW / (digits.length * 7)));
    for (const d of digits) {
      const val = parseInt(d, 10);
      // hər rəqəm üçün dəyişən enli zolaq nümunəsi
      for (let i = 0; i < 4; i++) {
        const w = unit * ((i + val % 3) % 3 + 1);
        if (i % 2 === 0) { ctx.fillRect(x, 30, w, 200); }
        x += w + unit;
      }
    }
    // rəqəmi altında yaz
    ctx.fillStyle = '#000';
    ctx.font = 'bold 44px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(digits, W / 2, 290);
    return canvas.toDataURL('image/png');
  }

  function chipInfo(label, value) {
    return `<span class="chip">${escapeHtml(label)}: <b style="margin-left:4px;">${escapeHtml(value)}</b></span>`;
  }

  function toggleFav(id) {
    const on = JollyDB.toggleFavorite(id);
    if (typeof JollySound !== 'undefined') JollySound.tap();
    Toast.success(on ? '⭐ Favorilərə əlavə olundu' : 'Favorilərdən çıxarıldı');
    JollyApp.render();
  }

  function checkPinForDelete() {
    const s = JollyDB.getSettings();
    if (!s.pinEnabled || !s.pin) return true;
    const entered = prompt('Silmək üçün PIN daxil et:');
    if (entered === s.pin) return true;
    Toast.error('PIN yanlışdır — silinmədi');
    return false;
  }

  function deleteProduct(id) {
    if (!confirm('Məhsul silinsin? (Silinənlər səbətinə düşəcək, 30 gün ərzində bərpa edə bilərsən)')) return;
    if (!checkPinForDelete()) return;
    JollyDB.Trash.moveToTrash(id);
    if (typeof JollySound !== 'undefined') JollySound.warn();
    Toast.success('Səbətə atıldı — Dashboard → Səbətdən bərpa edə bilərsən');
    JollyRouter.go('#/home');
  }

  /* ---------- WhatsApp-a göndər: premium PNG kart (JollyShare) ---------- */
  function whatsappShare(id) {
    if (typeof JollyShare === 'undefined') { Toast.error('Paylaşım modulu yüklənməyib'); return; }
    JollyShare.shareCurrentProduct(id);
  }

  /* ---------- ⋮ Daha çox menyusu ---------- */
  function copyProductText(id) {
    const p = JollyDB.Products.get(id);
    if (!p) return;
    const lines = [
      p.name ? `Məhsul: ${p.name}` : null,
      p.mainCode ? `Xüsusi kod: ${p.mainCode}` : null,
      p.extraCodeValue ? `${p.extraCodeType || 'Model'}: ${p.extraCodeValue}` : null,
      p.price != null && p.price !== '' ? `Qiymət: ${p.price} ₼` : null,
      p.brand ? `Firma: ${p.brand}` : null,
      (p.barcodes && p.barcodes[0]) ? `Barkod: ${p.barcodes[0]}` : null,
    ].filter(Boolean).join('\n');
    const ta = document.createElement('textarea');
    ta.value = lines; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); Toast.success('Kopyalandı'); } catch (e) { Toast.error('Kopyalanmadı'); }
    ta.remove();
  }

  function moreMenu(id) {
    const p = JollyDB.Products.get(id);
    if (!p) return;
    let overlay = document.getElementById('moreMenuOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'moreMenuOverlay';
      overlay.className = 'qa-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('on'); });
    }
    const items = [
      { icon: '📋', label: 'Mətni kopyala', run: () => copyProductText(id) },
      { icon: '🧬', label: 'Dublikat yarat', run: () => { if (typeof JollyProductPro !== 'undefined') JollyProductPro.clone(id); else Toast.error('Modul yoxdur'); } },
      { icon: p.favorite ? '⭐' : '☆', label: p.favorite ? 'Favoridən çıxar' : 'Seçilmiş et', run: () => toggleFav(id) },
      { icon: '🗑️', label: 'Sil (PIN tələb oluna bilər)', danger: true, run: () => deleteProduct(id) },
    ];
    overlay.innerHTML = `
      <div class="glass qa-sheet">
        <div class="qa-title">${escapeHtml(p.name || 'Məhsul')}</div>
        ${items.map((it, i) => `<div class="qa-item ${it.danger ? 'danger' : ''}" data-i="${i}"><span>${it.icon}</span><span>${it.label}</span></div>`).join('')}
      </div>
    `;
    [...overlay.querySelectorAll('.qa-item')].forEach((el, i) => {
      el.addEventListener('click', () => { overlay.classList.remove('on'); items[i].run(); });
    });
    requestAnimationFrame(() => overlay.classList.add('on'));
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }

  /* ---------- Product Form (Add / Edit) ---------- */
  let formState = null;

  /* ---------- Smart Auto Fill: "Corab 545 / ai-120" → ad+kod+model ---------- */
  function smartProductParse(text) {
    text = String(text || '').trim();
    const result = { name: '', specialCode: '', modelNo: '' };
    if (!text) return result;
    const hasSlash = text.includes('/');
    const parts = text.split('/');
    const leftPart = (parts[0] || '').trim();
    const explicitModel = hasSlash ? parts.slice(1).join('/').trim() : '';

    // "Ad + qısa rəqəmli kod (+ qalan mətn = model)" nümunəsi.
    // Kod 1-5 rəqəm ola bilər (məs. "18", "545", "19") — sabit uzunluq tələb olunmur.
    // Koddan sonra gələn HƏR ŞEY (məs. "no.456098") ayrıca model kimi götürülür,
    // özü rəqəmli olsa belə (əvvəlki versiya bunu səhvən yenidən "kod" sanırdı).
    const match = leftPart.match(/^(.+?)\s+(\d{1,5})(?:[\s\-]+(.+))?$/);
    if (match) {
      result.name = match[1].trim();
      result.specialCode = match[2].trim();
      result.modelNo = explicitModel || (match[3] ? match[3].trim() : '');
    } else {
      // Rəqəm-kod nümunəsi tapılmadı — mətni bölmədən olduğu kimi ad kimi saxla
      result.name = leftPart;
      result.modelNo = explicitModel;
    }
    return result;
  }

  function smartFill(text) {
    const data = smartProductParse(text);
    formState.name = data.name;
    formState.mainCode = data.specialCode;
    formState.extraCodeValue = data.modelNo;
    const nameEl = document.getElementById('f_name');
    const codeEl = document.getElementById('f_mainCode');
    const modelEl = document.getElementById('f_extraCodeValue');
    if (nameEl) nameEl.value = data.name;
    if (codeEl) codeEl.value = data.specialCode;
    if (modelEl) modelEl.value = data.modelNo;
  }

  /* ---------- AI Product Camera: Visual Search ilə bənzər məhsulu tap, sahələri təklif et ---------- */
  function aiCameraFill() {
    if (typeof JollyVisualSearch === 'undefined') { Toast.error('Bu modul yüklənməyib'); return; }
    JollyVisualSearch.captureAndSearch((results, capturedDataUrl) => {
      handleAiCameraResults(results, capturedDataUrl);
    });
  }

  async function handleAiCameraResults(results, capturedDataUrl) {
    if (capturedDataUrl) {
      let ref = capturedDataUrl;
      if (typeof JollyStorage !== 'undefined') ref = await JollyStorage.saveImage(capturedDataUrl);
      formState.images.push(ref);
      renderImageStrip();
    }
    if (results && results.length && results[0].similarity >= 55) {
      const match = results[0].product;
      const proceed = confirm(`Bu, "${match.name || 'bir məhsul'}" məhsuluna bənzəyir (${results[0].similarity}% oxşar).\nFirma/Qrup/Yer/Status məlumatlarını oradan köçürüm?`);
      if (proceed) applyFieldsFromMatch(match);
      else Toast.info('Şəkil əlavə olundu — məlumatları əl ilə doldur');
    } else {
      Toast.info('Oxşar məhsul tapılmadı — şəkil əlavə olundu, məlumatları əl ilə doldur');
    }
  }

  function applyFieldsFromMatch(match) {
    ['brand', 'group', 'location'].forEach(f => {
      if (match[f]) {
        formState[f] = match[f];
        const el = document.getElementById('f_' + f);
        if (el) el.value = match[f];
      }
    });
    if (match.status) selectStatus(match.status);
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('Sahələr dolduruldu — yoxla və düzəlt');
  }

  function initFormState(existing) {
    formState = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: null, name: '', mainCode: '', extraCodeType: 'No', extraCodeValue: '',
      barcodes: [], last4: '', price: '', brand: '', group: '', location: '', color: '', note: '',
      supplier: '', status: 'Aktiv', images: [],
    };
    if (formState.supplier === undefined) formState.supplier = '';
    if (formState.last4 === undefined) formState.last4 = '';
    // "Saxla və yenisi"-dən gələn firma/qrup/rəf
    if (!existing) {
      const carryRaw = sessionStorage.getItem('jolly_carry');
      if (carryRaw) {
        try {
          const carry = JSON.parse(carryRaw);
          formState.brand = carry.brand || '';
          formState.group = carry.group || '';
          formState.location = carry.location || '';
          formState.status = carry.status || 'Aktiv';
        } catch (e) {}
        sessionStorage.removeItem('jolly_carry');
      }
    }
    const prefillBarcode = sessionStorage.getItem('jolly_prefill_barcode');
    if (prefillBarcode && !existing) {
      formState.barcodes.push(prefillBarcode);
      formState.last4 = prefillBarcode.slice(-4);
      sessionStorage.removeItem('jolly_prefill_barcode');
    }
  }

  function renderFormPage(id, draftId) {
    let existing = null;
    if (id) existing = JollyDB.Products.get(id);
    else if (draftId) existing = JollyDB.Drafts.get(draftId);
    initFormState(existing);
    formState._draftId = draftId || null;

    const brands = JollyDB.Brands.all();
    const groups = JollyDB.Groups.all();
    const locations = JollyDB.Locations.all();
    const statuses = JollyDB.Statuses.all();
    const suppliers = JollyDB.Suppliers.all();

    return `
      <h2 style="font-family:var(--font-display);margin:0 0 16px;font-size:19px;">${id ? 'Məhsulu redaktə et' : 'Yeni məhsul'}</h2>

      <div class="glass" style="padding:16px;">
        <div class="field">
          <label>⚡ Sürətli doldur — bir sətrə yaz</label>
          <input id="f_quickFill" placeholder="Məsələn: Corab 545 / ai-120" oninput="JollyProducts.smartFill(this.value)" style="border:1px solid var(--border-glow);">
          <div class="muted" style="font-size:11px;margin-top:5px;">Ad + kod / model — "/" işarəsindən əvvəl ad və kod, sonra model gəlir</div>
          <button type="button" class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="JollyProducts.aiCameraFill()">📷 AI ilə şəkildən doldur</button>
        </div>

        <div class="field">
          <label>Şəkillər</label>
          <div class="image-strip" id="imgStrip"></div>
          <div class="row" style="gap:8px;margin-top:8px;">
            <button class="btn btn-primary btn-sm" style="flex:1;" onclick="document.getElementById('imgFileInput').click()">🖼️ Qalereyadan seç</button>
            <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="document.getElementById('imgCameraInput').click()">📷 Kamera</button>
          </div>
        </div>

        <div class="field">
          <label>Məhsulun adı *</label>
          <input id="f_name" value="${escapeHtml(formState.name)}" placeholder="məs. Daraq">
        </div>
        ${typeof JollyOCR !== 'undefined' ? `<button class="btn btn-ghost btn-sm" style="margin:-6px 0 12px;" onclick="JollyProducts.ocrFill()">📷 Şəkildən oxu (OCR)</button>` : ''}
        <div id="brainSuggestZone" style="margin:-6px 0 12px;"></div>

        <div class="field-row">
          <div class="field">
            <label>Xüsusi kod</label>
            <input id="f_mainCode" inputmode="numeric" value="${escapeHtml(formState.mainCode)}" placeholder="məs. 545">
          </div>
          <div class="field">
            <label>Qiymət (₼)</label>
            <input id="f_price" type="number" inputmode="decimal" step="0.01" value="${formState.price}" placeholder="0.00">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Model / No / Item</label>
            <select id="f_extraCodeType">
              ${['No', 'Model', 'Item', 'AI'].map(t => `<option ${formState.extraCodeType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Model nömrəsi</label>
            <input id="f_extraCodeValue" inputmode="numeric" value="${escapeHtml(formState.extraCodeValue)}" placeholder="məs. 180">
          </div>
        </div>

        <div class="field">
          <label>Barkod(lar) — rəqəm, təkrarlanmaz</label>
          <div class="row" style="gap:8px;margin-bottom:8px;">
            <input id="f_barcodeInput" inputmode="numeric" pattern="[0-9]*" placeholder="Barkod rəqəmi..." style="flex:1;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.addBarcodeField();}">
            <button class="icon-btn" onclick="JollyProducts.scanIntoForm()" title="Kamera ilə skan">📷</button>
            <button class="icon-btn" onclick="JollyProducts.galleryScanIntoForm()" title="Şəkildən oxu">🖼️</button>
          </div>
          <button class="btn btn-primary btn-sm btn-block" style="margin-bottom:10px;" onclick="JollyProducts.addBarcodeField()">💾 Barkodu saxla</button>
          <div class="tag-list" id="barcodeTags"></div>
        </div>

        <div class="field">
          <label>Son 4 rəqəm (barkoddan avtomatik)</label>
          <input id="f_last4" inputmode="numeric" maxlength="4" value="${escapeHtml(formState.last4 || '')}" placeholder="avtomatik dolur" style="letter-spacing:2px;font-family:var(--font-mono);">
        </div>

        <div class="field">
          <label>Firma</label>
          <select id="f_brand" onchange="JollyProducts.handleInlineAdd(this,'brand')">
            <option value="">— seçin —</option>
            ${brands.map(b => `<option ${formState.brand === b.name ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
            <option value="__new__">+ Yeni firma əlavə et</option>
          </select>
        </div>

        <div class="field">
          <label>Qrup</label>
          <select id="f_group" onchange="JollyProducts.handleInlineAdd(this,'group')">
            <option value="">— seçin —</option>
            ${groups.map(g => `<option ${formState.group === g.name ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
            <option value="__new__">+ Yeni qrup əlavə et</option>
          </select>
        </div>

        <div class="field">
          <label>Ref yeri</label>
          <select id="f_location" onchange="JollyProducts.handleInlineAdd(this,'location')">
            <option value="">— seçin —</option>
            ${locations.map(l => `<option ${formState.location === l.name ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
            <option value="__new__">+ Yeni yer əlavə et</option>
          </select>
        </div>

        <div class="field">
          <label>🚚 Tədarükçü</label>
          <input id="f_supplierSearch" list="supplierDatalist" value="${escapeHtml(formState.supplier || '')}" placeholder="Yaz və ya seç..." oninput="JollyProducts.handleSupplierInput(this.value)">
          <datalist id="supplierDatalist">
            ${suppliers.map(s => `<option value="${escapeHtml(s.code ? s.code + ' - ' + s.name : s.name)}">`).join('')}
          </datalist>
        </div>

        <div class="field">
          <label>Status</label>
          <div class="chip-row" id="statusChips">
            ${statuses.map(s => `<span class="chip ${formState.status === s.name ? 'selected' : ''}" data-status="${escapeHtml(s.name)}" onclick="JollyProducts.selectStatus('${escapeHtml(s.name)}')">${escapeHtml(s.name)}</span>`).join('')}
          </div>
        </div>

        <div class="field">
          <label>Rəng</label>
          <input id="f_color" value="${escapeHtml(formState.color || '')}" placeholder="məs. qara">
        </div>

        <div class="field">
          <label>Əlavə qeyd</label>
          <textarea id="f_note" placeholder="sərbəst qeyd...">${escapeHtml(formState.note || '')}</textarea>
        </div>

        <div id="customFieldsZone">${typeof JollyCodeStudio !== 'undefined' ? JollyCodeStudio.renderCustomFieldsHtml(formState) : ''}</div>

        <div class="row" style="gap:10px;margin-top:8px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyProducts.saveDraft()">📝 Qaralama</button>
          <button class="btn btn-primary" style="flex:1;" onclick="JollyProducts.submitForm()">✅ Saxla</button>
        </div>
        ${!id ? `<button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="JollyProducts.submitAndNew()">➕ Saxla və yenisini əlavə et</button>` : ''}
      </div>
    `;
  }

  function afterFormRender() {
    renderImageStrip();
    renderBarcodeTags();
    ['name', 'mainCode', 'price', 'extraCodeType', 'extraCodeValue', 'color', 'note', 'last4'].forEach(f => {
      const el = document.getElementById('f_' + f);
      if (el) {
        el.addEventListener('input', () => { formState[f] = el.value; });
        el.addEventListener('change', () => { formState[f] = el.value; });
      }
    });
    // AI Brain: ad yazılıb bitəndə firma/qrup/yer/status təklif et
    const nameEl = document.getElementById('f_name');
    if (nameEl && typeof JollyBrain !== 'undefined') {
      nameEl.addEventListener('blur', () => { showBrainSuggestions(); checkSimilarWarning(); });
    }
  }

  // Ad yazılanda oxşar/dublikat xəbərdarlığı
  function checkSimilarWarning() {
    if (typeof JollyBrain === 'undefined' || !formState.name || !formState.name.trim()) return;
    const zone = document.getElementById('brainSuggestZone');
    if (!zone) return;
    const fake = { id: formState.id, name: formState.name, brand: formState.brand, group: formState.group, color: formState.color, location: formState.location };
    const similar = JollyBrain.findSimilar(fake, 3).filter(p => escapeHtml(p.name).toLowerCase() === formState.name.toLowerCase().trim());
    if (similar.length) {
      const extra = `<div style="font-size:11.5px;color:var(--accent-warn);margin-top:6px;">⚠️ Bu adla ${similar.length} məhsul artıq var — dublikat olmasın deyə yoxla.</div>`;
      zone.insertAdjacentHTML('beforeend', extra);
    }
  }

  function showBrainSuggestions() {
    if (typeof JollyBrain === 'undefined') return;
    if (!formState.name || !formState.name.trim()) return;
    const s = JollyBrain.suggestAll({ name: formState.name, brand: formState.brand, group: formState.group });
    const zone = document.getElementById('brainSuggestZone');
    if (!zone) return;
    const chips = [];
    if (s.brand && s.brand !== formState.brand) chips.push(`<span class="chip" onclick="JollyProducts.applySuggestion('brand','${escapeHtml(s.brand)}')">🏭 ${escapeHtml(s.brand)}</span>`);
    if (s.group && s.group !== formState.group) chips.push(`<span class="chip" onclick="JollyProducts.applySuggestion('group','${escapeHtml(s.group)}')">📦 ${escapeHtml(s.group)}</span>`);
    if (s.location && s.location !== formState.location) chips.push(`<span class="chip" onclick="JollyProducts.applySuggestion('location','${escapeHtml(s.location)}')">📍 ${escapeHtml(s.location)}</span>`);
    if (s.status && s.status !== formState.status) chips.push(`<span class="chip" onclick="JollyProducts.applySuggestion('status','${escapeHtml(s.status)}')">🔖 ${escapeHtml(s.status)}</span>`);
    if (chips.length) {
      zone.innerHTML = `<div style="font-size:11px;color:var(--accent-1);margin-bottom:6px;">🧠 AI Brain təklif edir (toxun):</div><div class="chip-row">${chips.join('')}</div>`;
    } else {
      zone.innerHTML = '';
    }
  }

  // OCR: şəkildən oxu, sahələri doldur
  function ocrFill() {
    if (typeof JollyOCR === 'undefined') { Toast.error('OCR mövcud deyil'); return; }
    const choice = confirm('Kamera ilə şəkil çək?\n(İmtina = qalereyadan seç)');
    const handle = (text) => {
      if (!text || !text.trim()) { Toast.error('Mətn oxunmadı, yenidən cəhd et'); return; }
      const parsed = (typeof JollyBrain !== 'undefined') ? JollyBrain.parseOcrText(text) : { name: text.split('\n')[0] };
      if (parsed.name && !formState.name) { formState.name = parsed.name; const el = document.getElementById('f_name'); if (el) el.value = parsed.name; }
      if (parsed.mainCode && !formState.mainCode) { formState.mainCode = parsed.mainCode; const el = document.getElementById('f_mainCode'); if (el) el.value = parsed.mainCode; }
      if (parsed.price && !formState.price) { formState.price = parsed.price; const el = document.getElementById('f_price'); if (el) el.value = parsed.price; }
      if (parsed.barcode) {
        const dupe = JollyDB.Products.findByBarcode(parsed.barcode).filter(p => p.id !== formState.id);
        if (!formState.barcodes.includes(parsed.barcode) && !dupe.length) {
          formState.barcodes.push(parsed.barcode);
          if (!formState.last4) formState.last4 = parsed.barcode.slice(-4);
          renderBarcodeTags();
          const l4 = document.getElementById('f_last4'); if (l4) l4.value = formState.last4;
        }
      }
      Toast.success('OCR doldurdu — yoxla və düzəlt');
      showBrainSuggestions();
    };
    if (choice) JollyOCR.captureAndRead(handle);
    else JollyOCR.pickAndRead(handle);
  }

  function applySuggestion(kind, value) {
    formState[kind] = value;
    if (kind === 'status') {
      selectStatus(value);
      Toast.success(`${value} tətbiq olundu`);
      showBrainSuggestions();
      return;
    }
    const el = document.getElementById('f_' + kind);
    if (el) {
      if (![...el.options].some(o => o.value === value)) {
        const opt = document.createElement('option');
        opt.value = value; opt.textContent = value;
        el.insertBefore(opt, el.lastElementChild);
      }
      el.value = value;
    }
    Toast.success(`${value} tətbiq olundu`);
    showBrainSuggestions();
  }

  function renderImageStrip() {
    const strip = document.getElementById('imgStrip');
    if (!strip) return;
    let html = formState.images.map((src, i) => `
      <div class="image-slot"><img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(src) : 'src="' + src + '"'}><div class="rm" onclick="JollyProducts.removeImage(${i})">✕</div></div>
    `).join('');
    html += `
      <div class="image-slot" onclick="document.getElementById('imgFileInput').click()">🖼️+</div>
      <input type="file" id="imgFileInput" accept="image/*" multiple style="display:none" onchange="JollyProducts.handleImageUpload(event)">
      <input type="file" id="imgCameraInput" accept="image/*" capture="environment" style="display:none" onchange="JollyProducts.handleImageUpload(event)">
    `;
    strip.innerHTML = html;
  }

  function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let ref = ev.target.result;
        if (typeof JollyStorage !== 'undefined') {
          ref = await JollyStorage.saveImage(ev.target.result);
        }
        formState.images.push(ref);
        renderImageStrip();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removeImage(i) {
    const ref = formState.images[i];
    if (typeof JollyStorage !== 'undefined' && ref && ref.startsWith && ref.startsWith('idb:')) {
      JollyStorage.deleteImage(ref);
    }
    formState.images.splice(i, 1);
    renderImageStrip();
  }

  function renderBarcodeTags() {
    const el = document.getElementById('barcodeTags');
    if (!el) return;
    el.innerHTML = formState.barcodes.map((b, i) => `
      <span class="chip mono">${escapeHtml(b)} <span onclick="JollyProducts.removeBarcode(${i})" style="margin-left:6px;cursor:pointer;">✕</span></span>
    `).join('');
  }

  function addBarcodeField() {
    const input = document.getElementById('f_barcodeInput');
    let val = input.value.trim();
    if (!val) return;
    // yalnız rəqəm saxla
    val = val.replace(/\D/g, '');
    if (!val) { Toast.error('Barkod yalnız rəqəm olmalıdır'); return; }
    if (formState.barcodes.includes(val)) {
      Toast.error('Bu barkod artıq bu məhsulda var');
      if (typeof JollySound !== 'undefined') JollySound.duplicate();
      return;
    }
    const dupe = JollyDB.Products.findByBarcode(val).filter(p => !formState.id || p.id !== formState.id);
    if (dupe.length) {
      Toast.error(`Bu barkod artıq "${dupe[0].name}" məhsulundadır!`);
      if (typeof JollySound !== 'undefined') JollySound.duplicate();
      return;
    }
    formState.barcodes.push(val);
    if (typeof JollySound !== 'undefined') JollySound.success();
    // Son 4 rəqəmi avtomatik yaz (ilk barkoddan, əgər boşdursa)
    if (!formState.last4) {
      formState.last4 = val.slice(-4);
      const l4 = document.getElementById('f_last4');
      if (l4) l4.value = formState.last4;
    }
    input.value = '';
    renderBarcodeTags();

    // Yeni: əgər ad hələ boşdursa, barkodu internetdə (açıq baza) axtar
    if (!formState.name || !formState.name.trim()) {
      lookupBarcodeOnline(val);
    }
  }

  /* ---------- Avtomatik etiket təklifi: barkodu internetdə axtar ---------- */
  function lookupBarcodeOnline(code) {
    const zone = document.getElementById('brainSuggestZone');
    if (zone) zone.innerHTML = `<div class="muted" style="font-size:11px;">🌐 İnternetdə axtarılır...</div>`;
    fetch(`/api/barcode-lookup?upc=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(data => {
        const z = document.getElementById('brainSuggestZone');
        if (!z) return;
        if (data && data.found && data.title) {
          const safeTitle = escapeHtml(data.title).replace(/'/g, "\\'");
          const safeBrand = escapeHtml(data.brand || '').replace(/'/g, "\\'");
          z.innerHTML = `
            <div style="font-size:11px;color:var(--accent-1);margin-bottom:6px;">🌐 İnternetdə tapıldı (toxun, tətbiq et):</div>
            <div class="chip" onclick="JollyProducts.applyOnlineLookup('${safeTitle}','${safeBrand}')">${escapeHtml(data.title)}${data.brand ? ' · ' + escapeHtml(data.brand) : ''}</div>
          `;
        } else {
          z.innerHTML = '';
        }
      })
      .catch(() => {
        const z = document.getElementById('brainSuggestZone');
        if (z) z.innerHTML = '';
      });
  }

  function applyOnlineLookup(title, brand) {
    formState.name = title;
    const nameEl = document.getElementById('f_name');
    if (nameEl) nameEl.value = title;
    if (brand) {
      formState.brand = brand;
      const brandEl = document.getElementById('f_brand');
      if (brandEl) {
        if (![...brandEl.options].some(o => o.value === brand)) {
          const opt = document.createElement('option');
          opt.value = brand; opt.textContent = brand;
          brandEl.insertBefore(opt, brandEl.lastElementChild);
        }
        brandEl.value = brand;
      }
    }
    const zone = document.getElementById('brainSuggestZone');
    if (zone) zone.innerHTML = '';
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('Tətbiq olundu — yoxla və düzəlt');
    showBrainSuggestions();
  }

  function removeBarcode(i) {
    formState.barcodes.splice(i, 1);
    renderBarcodeTags();
  }

  function scanIntoForm() {
    JollyBarcode.open((code) => {
      if (typeof JollySound !== 'undefined') JollySound.beep();
      document.getElementById('f_barcodeInput').value = code;
      addBarcodeField();
    });
  }

  function galleryScanIntoForm() {
    if (typeof JollyGalleryScan === 'undefined') { Toast.error('Modul yoxdur'); return; }
    JollyGalleryScan.pickAndScan((code) => {
      document.getElementById('f_barcodeInput').value = code;
      addBarcodeField();
    });
  }

  function selectStatus(name) {
    formState.status = name;
    document.querySelectorAll('#statusChips .chip').forEach(c => {
      c.classList.toggle('selected', c.dataset.status === name);
    });
  }

  // Tədarükçü — yazılan mətni saxla, forma göndəriləndə (submitForm) siyahıya yeni isə əlavə olunacaq
  function handleSupplierInput(val) {
    formState.supplier = (val || '').trim();
  }

  // Əgər yazılan tədarükçü adı siyahıda yoxdursa, avtomatik siyahıya əlavə et.
  // "504 - Fəzail Kosmetika" formatını da tanıyır (kodu ayırır).
  function ensureSupplierSaved() {
    const raw = (formState.supplier || '').trim();
    if (!raw) return;
    const m = raw.match(/^(\d+)\s*-\s*(.+)$/);
    const code = m ? m[1].trim() : null;
    const name = m ? m[2].trim() : raw;
    const list = JollyDB.Suppliers.all();
    const exists = list.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      JollyDB.Suppliers.add(code ? { name, code } : { name });
    }
    // Məhsulda təmiz ad saxlanılır (kod prefiksi olmadan)
    formState.supplier = name;
  }

  function handleInlineAdd(selectEl, kind) {
    if (selectEl.value !== '__new__') {
      formState[kind] = selectEl.value;
      return;
    }
    const label = { brand: 'firma', group: 'qrup', location: 'yer' }[kind];
    const name = prompt(`Yeni ${label} adı:`);
    if (!name || !name.trim()) { selectEl.value = formState[kind] || ''; return; }
    const store = { brand: JollyDB.Brands, group: JollyDB.Groups, location: JollyDB.Locations }[kind];
    const rec = store.add({ name: name.trim() });
    formState[kind] = rec.name;
    const opt = document.createElement('option');
    opt.value = rec.name; opt.textContent = rec.name; opt.selected = true;
    selectEl.insertBefore(opt, selectEl.lastElementChild);
    Toast.success(`"${rec.name}" əlavə olundu`);
  }

  function validate() {
    if (!formState.name || !formState.name.trim()) { Toast.error('Məhsulun adı vacibdir'); return false; }
    return true;
  }

  function submitForm(keepOpen) {
    if (!validate()) return false;
    ensureSupplierSaved();
    const payload = { ...formState };
    delete payload._draftId;
    if (formState.price !== '' && formState.price != null) payload.price = parseFloat(formState.price);

    if (typeof JollyCodeStudio !== 'undefined') {
      const zone = document.getElementById('customFieldsZone');
      if (zone) payload.custom = JollyCodeStudio.collectCustomValues(zone);
    }

    if (formState.id) {
      JollyDB.Products.update(formState.id, payload);
      Toast.success('Məhsul yeniləndi');
    } else {
      JollyDB.Products.add(payload);
      Toast.success('Məhsul əlavə olundu');
      if (typeof JollyApp !== 'undefined' && JollyApp.celebrate) JollyApp.celebrate();
    }
    if (formState._draftId) JollyDB.Drafts.remove(formState._draftId);
    if (!keepOpen) JollyRouter.go('#/home');
    return true;
  }

  // Saxla və dərhal yeni boş kart aç (firma/qrup/rəf/status saxlanır)
  function submitAndNew() {
    const carry = {
      brand: formState.brand, group: formState.group,
      location: formState.location, status: formState.status,
    };
    if (!submitForm(true)) return;
    sessionStorage.setItem('jolly_carry', JSON.stringify(carry));
    // routerı yeniləmək üçün əvvəlcə home, sonra yeni məhsul
    window.location.hash = '#/home';
    setTimeout(() => { window.location.hash = '#/product/new'; }, 30);
    Toast.info('Növbəti məhsul — firma/qrup saxlanıldı');
  }

  function saveDraft() {
    const payload = { ...formState };
    const draftId = payload._draftId;
    delete payload._draftId;
    delete payload.id;
    if (draftId) {
      JollyDB.Drafts.update(draftId, payload);
    } else {
      JollyDB.Drafts.add(payload);
    }
    Toast.success('Qaralama saxlanıldı');
    JollyRouter.go('#/home');
  }

  return {
    renderHomePage, afterHomeRender, liveSearch, voiceSearch, scanSearch,
    renderFilteredPage, renderDraftsPage, deleteDraft, renderDetailPage, deleteProduct,
    renderFormPage, afterFormRender, handleImageUpload, removeImage,
    addBarcodeField, removeBarcode, scanIntoForm, galleryScanIntoForm, selectStatus, handleInlineAdd,
    applySuggestion, ocrFill, toggleFav, homeFilter, cycleSort,
    submitForm, submitAndNew, saveDraft, escapeHtml, renderCard, statusColor,
    openViewer, showBarcode, generateBarcodeImage,
    smartProductParse, smartFill, aiCameraFill, whatsappShare, moreMenu, copyProductText,
    lookupBarcodeOnline, applyOnlineLookup,
    handleSupplierInput,
  };
})();
