/* ============================================================
   JOLLY Products — məhsul siyahısı, kartı, detalı və forması

   YENİ: renderCard-a "+" düyməsi əlavə olundu — kartın üstündən,
   Qəbul Studio-ya girmədən, birbaşa "Mal Qəbul" səbətinə əlavə
   etmək üçün (JollyReceiving.quickAddToBasket çağırır).

   YENİ (2026-07-21):
   1) Zəncirvari sərbəst-mətn filtri — axtarış qutusuna istənilən
      söz yazıb Enter basırsan, o "zəncirə" əlavə olunur, nəticə
      daralır; üstünə YENİ söz yazıb yenə Enter — daha da daralır,
      sonsuz dərinlikdə ("Pink House" → "Dırnaq əti üçün güllü yağ").
      Aşağıda o an nəticələrin içindəki firmalar da təklif kimi çıxır,
      toxunmaqla zəncirə əlavə olunur.
   2) "⚙️ Ətraflı Axtarış" paneli — bütün axtarış üsullarını (ad,
      rəng, etiket, firma, qrup, yer, tədarükçü, status, barkod,
      barkodun son 4 rəqəmi, xüsusi kod, model/no kodu, qiymət
      aralığı, YARADILMA TARİXİ ARALIĞI, QEYD mətnində axtarış,
      şəklə görə, səslə) TEK bir yerdə birləşdirir.
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
    const isSelected = bulkSelectMode && bulkSelectedIds.has(p.id);
    const quickAddBtn = (typeof JollyReceiving !== 'undefined' && !bulkSelectMode)
      ? `<button class="icon-btn" title="Qəbul səbətinə əlavə et" onclick="event.stopPropagation();JollyProducts.quickAddToReceiving('${p.id}', this)" style="position:absolute;top:6px;right:6px;z-index:5;width:30px;height:30px;min-width:30px;padding:0;border-radius:50%;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;color:#fff;border:1px solid rgba(255,255,255,0.15);">+</button>`
      : '';
    const bulkCheck = bulkSelectMode
      ? `<div style="position:absolute;top:6px;left:6px;z-index:6;width:26px;height:26px;border-radius:50%;background:${isSelected ? 'var(--accent-1,#7c8aff)' : 'rgba(0,0,0,0.5)'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;border:1px solid rgba(255,255,255,0.3);">${isSelected ? '✓' : ''}</div>`
      : '';
    const cardClick = bulkSelectMode ? `JollyProducts.toggleBulkSelect('${p.id}')` : `JollyRouter.go('#/product/${p.id}')`;
    return `
      <div class="glass product-card ${glowClass}" data-id="${p.id}" onclick="${cardClick}" style="position:relative;${isSelected ? 'border-color:var(--accent-1,#7c8aff);box-shadow:0 0 0 2px var(--accent-1,#7c8aff);' : ''}">
        ${bulkCheck}
        ${quickAddBtn}
        <div class="thumb peekable" data-pki='${pki}' data-pkx="0">${thumb}</div>
        <div class="p-name">${escapeHtml(p.name || 'Adsız məhsul')}</div>
        <div class="p-meta">${escapeHtml(p.mainCode || '')}${p.extraCodeValue ? ' · ' + escapeHtml(p.extraCodeType || '') + ' ' + escapeHtml(p.extraCodeValue) : ''}</div>
        ${(p.barcodes && p.barcodes.length) ? `<div class="mono" style="font-size:10.5px;color:var(--accent-2);letter-spacing:0.3px;opacity:.85;">🏷️ ${escapeHtml(p.barcodes[0])}${p.barcodes.length > 1 ? ` +${p.barcodes.length - 1}` : ''}</div>` : ''}
        <div class="row between">
          <span class="p-price">${p.price != null && p.price !== '' ? p.price + ' ₼' : '—'}</span>
          ${p.status ? `<span class="status-pill"><span class="dot" style="background:${statusColor(p.status)}"></span>${escapeHtml(p.status)}</span>` : ''}
        </div>
        ${p.group ? `<div class="p-related" onclick="event.stopPropagation();JollyRouter.go('#/products?group=${encodeURIComponent(p.group)}')" style="font-size:10px;color:var(--accent-1);margin-top:5px;opacity:.85;">📦 ${escapeHtml(p.group)} qrupundan daha çox ›</div>` : ''}
        ${p.brand ? `<div class="p-related" onclick="event.stopPropagation();JollyProducts.filterByBrandChain('${escapeHtml(p.brand)}')" style="font-size:10px;color:var(--accent-1);margin-top:3px;opacity:.85;">🏭 ${escapeHtml(p.brand)} firmasının bütün məhsulları ›</div>` : ''}
        ${expiryBadgeHtml(p)}
      </div>
    `;
  }

  // "+" düyməsindən çağırılır — Qəbul Studio-ya girmədən tək kliklə
  // "Mal Qəbul" səbətinə əlavə edir, düymənin özünü təsdiq işarəsinə çevirir.
  function quickAddToReceiving(id, btnEl) {
    if (typeof JollyReceiving === 'undefined') { Toast.error('Qəbul Studio modulu yüklənməyib'); return; }
    const added = JollyReceiving.quickAddToBasket(id);
    if (btnEl) {
      if (added) {
        btnEl.textContent = '✓';
        btnEl.style.background = 'rgba(41,224,201,0.85)';
        btnEl.style.borderColor = 'rgba(41,224,201,0.9)';
      } else {
        btnEl.textContent = '✓';
        btnEl.style.background = 'rgba(255,184,77,0.75)';
      }
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  function renderList(container, products) {
    if (!container) return;
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

  function renderHomePage() {
    const all = JollyDB.Products.all();
    const drafts = JollyDB.Drafts.all();
    return `
      <div class="glass command-bar" onclick="if(event.target.tagName!=='INPUT'){}">
        <span style="opacity:.6">🔎</span>
        <input id="homeSearch" placeholder="Ad, kod, barkod, firma ilə axtar... (Enter = zəncirə əlavə et)" oninput="JollyProducts.liveSearch(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.commitChainTerm(this.value);}">
        <button class="mic-btn" onclick="JollyProducts.voiceSearch()">🎤</button>
        <button class="scan-btn" onclick="JollyProducts.scanSearch()">▦</button>
        <button class="scan-btn" title="Şəkillə axtar" onclick="JollyProducts.photoSearch()">📷</button>
        <button class="scan-btn" title="Ətraflı Axtarış" onclick="JollyProducts.openAdvancedSearch()">⚙️</button>
        <button class="scan-btn" title="Axtarış tarixçəsi" onclick="JollyProducts.openSearchHistory()">🕓</button>
        <button class="scan-btn" title="Saxlanan filtrlər" onclick="JollyProducts.openSavedFilters()">⭐</button>
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
        <span class="chip" id="bulkModeChip" onclick="JollyProducts.toggleBulkSelectMode()">☑️ Seç</span>
      </div>

      <div class="section-title">Son əlavə edilənlər</div>
      <div id="homeProductList"></div>
    `;
  }

  function afterHomeRender() {
    applyHomeView();
    if (homeState.filter) {
      const chip = document.querySelector(`#homeFilterChips .chip[data-hf="${homeState.filter}"]`);
      if (chip) chip.classList.add('chip-active');
    }
    const sc = document.getElementById('sortChip');
    if (sc) { const s = SORTS.find(x => x.key === homeState.sort); if (s) sc.textContent = s.label; }
  }

  let homeState = { filter: null, sort: 'new', chain: [] };

  // ── Kütləvi seçim + WhatsApp paylaşımı ──
  let bulkSelectMode = false;
  let bulkSelectedIds = new Set();

  function redrawCurrentHomeList() {
    if (homeState.chain.length) { applyChainSearch(''); return; }
    const input = document.getElementById('homeSearch');
    if (input && input.value) { applyChainSearch(input.value); return; }
    applyHomeView();
  }

  function toggleBulkSelectMode() {
    bulkSelectMode = !bulkSelectMode;
    if (!bulkSelectMode) bulkSelectedIds.clear();
    redrawCurrentHomeList();
    refreshBulkUI();
  }

  function toggleBulkSelect(id) {
    if (bulkSelectedIds.has(id)) bulkSelectedIds.delete(id); else bulkSelectedIds.add(id);
    redrawCurrentHomeList();
    refreshBulkUI();
  }

  function refreshBulkUI() {
    const chip = document.getElementById('bulkModeChip');
    if (chip) {
      chip.classList.toggle('chip-active', bulkSelectMode);
      chip.textContent = bulkSelectMode ? '✕ Seçimi bitir' : '☑️ Seç';
    }
    let bar = document.getElementById('bulkActionBar');
    if (bulkSelectMode && bulkSelectedIds.size > 0) {
      const html = `
        <div id="bulkActionBar" style="position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99997;background:#1a1a1a;color:#fff;padding:10px 14px;border-radius:14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12);font-size:13px;">
          <span>${bulkSelectedIds.size} seçildi</span>
          <button style="background:#25D366;border:none;color:#fff;padding:7px 12px;border-radius:8px;font-weight:700;cursor:pointer;" onclick="JollyProducts.shareSelectedViaWhatsApp()">📤 WhatsApp</button>
        </div>`;
      if (bar) { bar.outerHTML = html; } else { document.body.insertAdjacentHTML('beforeend', html); }
    } else if (bar) {
      bar.remove();
    }
  }

  function shareSelectedViaWhatsApp() {
    if (!bulkSelectedIds.size) return;
    const products = [...bulkSelectedIds].map(id => JollyDB.Products.get(id)).filter(Boolean);
    if (!products.length) return;
    const lines = products.map(p => {
      const parts = [p.name || 'Adsız'];
      if (p.price != null && p.price !== '') parts.push(p.price + ' ₼');
      if (p.barcodes && p.barcodes[0]) parts.push('🏷️' + p.barcodes[0]);
      return '• ' + parts.join(' — ');
    });
    const text = `📦 Məhsullar (${products.length}):\n\n` + lines.join('\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  const SORTS = [
    { key: 'new', label: '↕️ Sıra: Yeni', fn: (a,b) => (b.createdAt||0)-(a.createdAt||0) },
    { key: 'name', label: '↕️ Sıra: Ad (A-Z)', fn: (a,b) => String(a.name||'').localeCompare(String(b.name||''), 'az') },
    { key: 'priceUp', label: '↕️ Sıra: Ucuzdan', fn: (a,b) => (a.price||0)-(b.price||0) },
    { key: 'priceDown', label: '↕️ Sıra: Bahadan', fn: (a,b) => (b.price||0)-(a.price||0) },
  ];

  function brandChips() {
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
    if (!f) items = items.slice(0, 12);
    const titleEl = document.querySelector('.section-title');
    if (titleEl) titleEl.textContent = f ? `Nəticə: ${items.length} məhsul` : 'Son əlavə edilənlər';
    renderList(document.getElementById('homeProductList'), items);
  }

  function homeFilter(f, chipEl) {
    homeState.filter = (homeState.filter === f) ? null : f;
    resetChain();
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
    _searchDebounce = setTimeout(() => {
      if (!q && !homeState.chain.length) {
        removeChainBar(); removeSuggestBar();
        afterHomeRender();
        return;
      }
      applyChainSearch(q);
    }, 250);
  }

  // ────────────────────────────────────────────────────────────
  // ZƏNCİRVARİ SƏRBƏST-MƏTN FİLTRİ
  // homeState.chain = ["Pink House", "Dırnaq əti üçün güllü yağ", ...]
  // Hər söz JollyDB.Products.search() ilə axtarılır, nəticələr
  // KƏSİŞMƏ (AND) ilə birləşdirilir — hər yeni söz daha da daraldır.
  // ────────────────────────────────────────────────────────────
  function chainedProducts(liveTerm) {
    let base = JollyDB.Products.all();
    const terms = homeState.chain.slice();
    if (liveTerm && liveTerm.trim()) terms.push(liveTerm.trim());
    terms.forEach(term => {
      const matches = JollyDB.Products.search(term);
      const idSet = new Set(matches.map(p => p.id));
      base = base.filter(p => idSet.has(p.id));
    });
    return base;
  }

  function applyChainSearch(liveTerm) {
    const results = chainedProducts(liveTerm);
    renderChainSuggestChips(results);
    const titleEl = document.querySelector('.section-title');
    if (titleEl) {
      if (titleEl.firstChild && titleEl.firstChild.nodeType === 3) titleEl.firstChild.textContent = `Nəticələr (${results.length}) `;
      else titleEl.textContent = `Nəticələr (${results.length})`;
    }
    renderList(document.getElementById('homeProductList'), results);
    renderDidYouMean(results, liveTerm);
  }

  // ── "Bunu demək istədin?" — nəticə 0 olanda, kataloqdakı əsl sözlərə
  // görə ən yaxın uyğunluğu tapıb təklif edir (yazı səhvi ehtimalı). ──
  function _levenshtein(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0]; dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  }

  function _catalogWordPool() {
    const words = new Set();
    JollyDB.Products.all().forEach(p => {
      if (p.brand) words.add(p.brand);
      if (p.group) words.add(p.group);
      (String(p.name || '').split(/\s+/)).forEach(w => { if (w.length >= 3) words.add(w); });
    });
    return [...words];
  }

  function renderDidYouMean(results, lastTerm) {
    const existing = document.getElementById('didYouMeanBar');
    const term = (homeState.chain.length ? homeState.chain[homeState.chain.length - 1] : lastTerm) || '';
    if (results.length !== 0 || !term || term.trim().length < 3) { if (existing) existing.remove(); return; }
    const pool = _catalogWordPool();
    let best = null, bestDist = Infinity;
    pool.forEach(w => {
      if (w.toLowerCase() === term.toLowerCase()) return;
      const d = _levenshtein(term, w);
      if (d < bestDist) { bestDist = d; best = w; }
    });
    const threshold = term.length <= 5 ? 2 : 3;
    if (!best || bestDist === 0 || bestDist > threshold) { if (existing) existing.remove(); return; }
    const html = `
      <div class="chip-row" id="didYouMeanBar" style="margin-bottom:6px;">
        <span class="chip" style="background:rgba(255,184,77,0.14);border-color:rgba(255,184,77,0.4);" onclick="JollyProducts.applyDidYouMean('${escapeHtml(best).replace(/'/g, "\\'")}')">🤔 Bunu demək istədin: <b style="margin-left:4px;">${escapeHtml(best)}</b>?</span>
      </div>`;
    if (existing) { existing.outerHTML = html; }
    else {
      const suggestBar = document.getElementById('suggestFilterBar');
      const chainBar = document.getElementById('chainFilterBar');
      const searchBar = document.querySelector('.command-bar');
      const anchor = suggestBar || chainBar || searchBar;
      if (anchor) anchor.insertAdjacentHTML('afterend', html);
    }
  }

  function applyDidYouMean(word) {
    if (homeState.chain.length) homeState.chain[homeState.chain.length - 1] = word;
    else homeState.chain.push(word);
    recordSearchHistory(word);
    renderChainChips();
    applyChainSearch('');
  }

  function commitChainTerm(term) {
    if (!term || !term.trim()) return;
    homeState.chain.push(term.trim());
    recordSearchHistory(term.trim());
    const input = document.getElementById('homeSearch');
    if (input) input.value = '';
    if (typeof JollySound !== 'undefined') JollySound.tap();
    renderChainChips();
    applyChainSearch('');
  }

  // ── Axtarış tarixçəsi — son axtarılan sözləri yadda saxlayır ──
  const SEARCH_HISTORY_KEY = 'jolly_search_history';
  const SEARCH_HISTORY_MAX = 10;

  function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); } catch (e) { return []; }
  }

  function recordSearchHistory(term) {
    try {
      let hist = getSearchHistory();
      hist = hist.filter(t => t.toLowerCase() !== term.toLowerCase());
      hist.unshift(term);
      hist = hist.slice(0, SEARCH_HISTORY_MAX);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(hist));
    } catch (e) {}
  }

  function clearSearchHistory() {
    try { localStorage.removeItem(SEARCH_HISTORY_KEY); } catch (e) {}
    openSearchHistory();
  }

  // ── Yadda saxlanan filtr dəstləri — zəncirin özünü ad verib saxla,
  // sonra bir toxunuşla eyni zənciri yenidən tətbiq et. ──
  const SAVED_FILTERS_KEY = 'jolly_saved_filters';

  function getSavedFilters() {
    try { return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]'); } catch (e) { return []; }
  }
  function setSavedFilters(list) {
    try { localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function saveCurrentFilterSet() {
    if (!homeState.chain.length) { Toast.error('Əvvəlcə bir neçə söz zəncirə əlavə et'); return; }
    const name = prompt('Bu filtr dəstinə ad ver:', homeState.chain.join(' + '));
    if (!name || !name.trim()) return;
    const list = getSavedFilters();
    const idx = list.findIndex(f => f.name.toLowerCase() === name.trim().toLowerCase());
    const entry = { name: name.trim(), terms: homeState.chain.slice() };
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    setSavedFilters(list);
    Toast.success(`"${name.trim()}" saxlanıldı`);
  }

  function openSavedFilters() {
    let overlay = document.getElementById('savedFiltersOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'savedFiltersOverlay';
    overlay.className = 'qa-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('on'); });
    const list = getSavedFilters();
    overlay.innerHTML = `
      <div class="glass qa-sheet">
        <div class="row between" style="margin-bottom:10px;">
          <div class="qa-title" style="margin:0;">⭐ Saxlanan Filtrlər</div>
          <button class="icon-btn" onclick="document.getElementById('savedFiltersOverlay').classList.remove('on')">✕</button>
        </div>
        ${list.length ? list.map((f, i) => `
          <div class="qa-item" style="justify-content:space-between;">
            <span onclick="document.getElementById('savedFiltersOverlay').classList.remove('on');JollyProducts.applySavedFilter(${i})" style="flex:1;cursor:pointer;">⭐ ${escapeHtml(f.name)} <span class="muted" style="font-size:11px;">(${f.terms.length} söz)</span></span>
            <span onclick="event.stopPropagation();JollyProducts.deleteSavedFilter(${i})" style="color:var(--accent-danger);cursor:pointer;padding-left:10px;">✕</span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hələ saxlanan filtr yoxdur — zəncir qurub "💾 Saxla" ilə yadda saxla</div>'}
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function applySavedFilter(idx) {
    const list = getSavedFilters();
    const f = list[idx];
    if (!f) return;
    homeState.filter = null;
    homeState.chain = f.terms.slice();
    renderChainChips();
    applyChainSearch('');
    Toast.success(`"${f.name}" tətbiq olundu`);
  }

  function deleteSavedFilter(idx) {
    const list = getSavedFilters();
    if (!list[idx]) return;
    if (!confirm(`"${list[idx].name}" silinsin?`)) return;
    list.splice(idx, 1);
    setSavedFilters(list);
    openSavedFilters();
  }

  function openSearchHistory() {
    let overlay = document.getElementById('searchHistoryOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'searchHistoryOverlay';
    overlay.className = 'qa-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('on'); });
    const hist = getSearchHistory();
    overlay.innerHTML = `
      <div class="glass qa-sheet">
        <div class="row between" style="margin-bottom:10px;">
          <div class="qa-title" style="margin:0;">🕓 Axtarış tarixçəsi</div>
          <button class="icon-btn" onclick="document.getElementById('searchHistoryOverlay').classList.remove('on')">✕</button>
        </div>
        ${hist.length ? hist.map(term => `
          <div class="qa-item" onclick="document.getElementById('searchHistoryOverlay').classList.remove('on');JollyProducts.commitChainTerm('${escapeHtml(term).replace(/'/g, "\\'")}')">
            <span>🔎</span><span>${escapeHtml(term)}</span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hələ axtarış edilməyib</div>'}
        ${hist.length ? `<button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="JollyProducts.clearSearchHistory()">🗑 Tarixçəni təmizlə</button>` : ''}
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function removeChainTerm(idx) {
    homeState.chain.splice(idx, 1);
    renderChainChips();
    const input = document.getElementById('homeSearch');
    applyChainSearch(input ? input.value : '');
  }

  function clearChain() {
    homeState.chain = [];
    removeChainBar();
    removeSuggestBar();
    const input = document.getElementById('homeSearch');
    if (input) input.value = '';
    afterHomeRender();
  }

  function resetChain() {
    homeState.chain = [];
    removeChainBar();
    removeSuggestBar();
  }

  function renderChainChips() {
    const existing = document.getElementById('chainFilterBar');
    if (!homeState.chain.length) { if (existing) existing.remove(); return; }
    const html = `
      <div class="chip-row" id="chainFilterBar" style="margin-bottom:6px;align-items:center;">
        <span class="muted" style="font-size:11px;margin-right:2px;">Zəncir:</span>
        ${homeState.chain.map((term, i) => `<span class="chip chip-active">${escapeHtml(term)} <span onclick="JollyProducts.removeChainTerm(${i})" style="margin-left:5px;cursor:pointer;">✕</span></span>`).join('')}
        <span class="chip" style="opacity:.75;" onclick="JollyProducts.saveCurrentFilterSet()">💾 Saxla</span>
        <span class="chip" style="opacity:.75;" onclick="JollyProducts.clearChain()">🗑 Təmizlə</span>
      </div>`;
    if (existing) { existing.outerHTML = html; }
    else {
      const searchBar = document.querySelector('.command-bar');
      if (searchBar) searchBar.insertAdjacentHTML('afterend', html);
    }
  }

  // Cari (zəncirlə daralmış) nəticələrin içindəki firmaları təklif kimi göstər —
  // toxunmaqla birbaşa zəncirə əlavə olunur (bir addım da daralt).
  function renderChainSuggestChips(results) {
    const counts = {};
    (results || []).forEach(p => { if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1; });
    const brands = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const existing = document.getElementById('suggestFilterBar');
    const allCount = JollyDB.Products.all().length;
    if (!brands.length || results.length === allCount) { if (existing) existing.remove(); return; }
    const html = `
      <div class="chip-row" id="suggestFilterBar" style="margin-bottom:6px;">
        <span class="muted" style="font-size:11px;margin-right:2px;">Daxilində:</span>
        ${brands.map(([b, c]) => `<span class="chip" onclick="JollyProducts.commitChainTerm('${escapeHtml(b)}')">🏭 ${escapeHtml(b)} (${c})</span>`).join('')}
      </div>`;
    if (existing) { existing.outerHTML = html; }
    else {
      const chainBar = document.getElementById('chainFilterBar');
      const searchBar = document.querySelector('.command-bar');
      const anchor = chainBar || searchBar;
      if (anchor) anchor.insertAdjacentHTML('afterend', html);
    }
  }

  function removeChainBar() { const b = document.getElementById('chainFilterBar'); if (b) b.remove(); }
  function removeSuggestBar() { const b = document.getElementById('suggestFilterBar'); if (b) b.remove(); }

  // ────────────────────────────────────────────────────────────
  // ƏTRAFLI AXTARIŞ PANELİ — bütün axtarış üsulları tək yerdə
  // ────────────────────────────────────────────────────────────
  function openAdvancedSearch() {
    let overlay = document.getElementById('advSearchOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'advSearchOverlay';
    overlay.className = 'qa-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAdvancedSearch(); });

    const opts = (list) => list.map(x => `<option>${escapeHtml(x.name)}</option>`).join('');

    overlay.innerHTML = `
      <div class="glass qa-sheet" style="max-height:85vh;overflow-y:auto;">
        <div class="row between" style="margin-bottom:12px;">
          <div class="qa-title" style="margin:0;">⚙️ Ətraflı Axtarış</div>
          <button class="icon-btn" onclick="JollyProducts.closeAdvancedSearch()">✕</button>
        </div>

        <div class="row" style="gap:8px;margin-bottom:16px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyProducts.closeAdvancedSearch();JollyProducts.photoSearch();">📷 Şəklə görə</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyProducts.closeAdvancedSearch();JollyProducts.voiceSearch();">🎤 Səslə</button>
        </div>

        <div class="field"><label>İçindəki hərflərə görə (ümumi)</label><input id="adv_text" placeholder="istənilən sahədə axtar..."></div>
        <div class="field"><label>Ad</label><input id="adv_name" placeholder="məhsul adı..."></div>
        <div class="field"><label>Rəng</label><input id="adv_color" placeholder="məs. qara"></div>
        <div class="field"><label>Qeyd mətnində axtarış</label><input id="adv_note" placeholder="qeyddə keçən söz..."></div>

        <div class="field"><label>Etiket</label><select id="adv_tag"><option value="">— hamısı —</option>${opts(JollyDB.Tags.all())}</select></div>
        <div class="field"><label>Firma</label><select id="adv_brand"><option value="">— hamısı —</option>${opts(JollyDB.Brands.all())}</select></div>
        <div class="field"><label>Qrup</label><select id="adv_group"><option value="">— hamısı —</option>${opts(JollyDB.Groups.all())}</select></div>
        <div class="field"><label>Ref yeri</label><select id="adv_location"><option value="">— hamısı —</option>${opts(JollyDB.Locations.all())}</select></div>
        <div class="field"><label>Tədarükçü</label><select id="adv_supplier"><option value="">— hamısı —</option>${opts(JollyDB.Suppliers.all())}</select></div>
        <div class="field"><label>Status</label><select id="adv_status"><option value="">— hamısı —</option>${opts(JollyDB.Statuses.all())}</select></div>

        <div class="field"><label>Barkod (tam və ya hissə)</label><input id="adv_barcode" inputmode="numeric" placeholder="barkod..."></div>
        <div class="field"><label>Barkodun son 4 rəqəmi</label><input id="adv_last4" inputmode="numeric" maxlength="4" placeholder="0000"></div>
        <div class="field"><label>Xüsusi kod</label><input id="adv_mainCode" placeholder="məs. 545"></div>
        <div class="field"><label>Model / No kodu</label><input id="adv_extraCodeValue" placeholder="məs. 128128"></div>

        <div class="field-row">
          <div class="field"><label>Qiymət (min)</label><input id="adv_priceMin" type="number" step="0.01" placeholder="0"></div>
          <div class="field"><label>Qiymət (max)</label><input id="adv_priceMax" type="number" step="0.01" placeholder="999"></div>
        </div>

        <div class="field-row">
          <div class="field"><label>Yaradılma tarixi (bu tarixdən)</label><input id="adv_dateFrom" type="date"></div>
          <div class="field"><label>Yaradılma tarixi (bu tarixə qədər)</label><input id="adv_dateTo" type="date"></div>
        </div>

        <div class="row" style="gap:8px;margin-top:8px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyProducts.clearAdvancedFields()">🗑 Təmizlə</button>
          <button class="btn btn-primary" style="flex:1;" onclick="JollyProducts.applyAdvancedSearch()">🔍 Axtar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  function closeAdvancedSearch() {
    const overlay = document.getElementById('advSearchOverlay');
    if (overlay) { overlay.classList.remove('on'); setTimeout(() => overlay.remove(), 200); }
  }

  function clearAdvancedFields() {
    ['adv_text', 'adv_name', 'adv_color', 'adv_note', 'adv_barcode', 'adv_last4', 'adv_mainCode', 'adv_extraCodeValue', 'adv_priceMin', 'adv_priceMax', 'adv_dateFrom', 'adv_dateTo']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['adv_tag', 'adv_brand', 'adv_group', 'adv_location', 'adv_supplier', 'adv_status']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }

  function applyAdvancedSearch() {
    const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const f = {
      text: val('adv_text').toLowerCase(),
      name: val('adv_name').toLowerCase(),
      color: val('adv_color').toLowerCase(),
      note: val('adv_note').toLowerCase(),
      tag: val('adv_tag'),
      brand: val('adv_brand'),
      group: val('adv_group'),
      location: val('adv_location'),
      supplier: val('adv_supplier'),
      status: val('adv_status'),
      barcode: val('adv_barcode'),
      last4: val('adv_last4'),
      mainCode: val('adv_mainCode').toLowerCase(),
      extraCodeValue: val('adv_extraCodeValue').toLowerCase(),
      priceMin: val('adv_priceMin'),
      priceMax: val('adv_priceMax'),
      dateFrom: val('adv_dateFrom'),
      dateTo: val('adv_dateTo'),
    };

    let items = JollyDB.Products.all();
    if (f.text) items = items.filter(p => JSON.stringify(p).toLowerCase().includes(f.text));
    if (f.name) items = items.filter(p => (p.name || '').toLowerCase().includes(f.name));
    if (f.color) items = items.filter(p => (p.color || '').toLowerCase().includes(f.color));
    if (f.note) items = items.filter(p => (p.note || '').toLowerCase().includes(f.note));
    if (f.tag) items = items.filter(p => (p.filterTags || []).includes(f.tag));
    if (f.brand) items = items.filter(p => p.brand === f.brand);
    if (f.group) items = items.filter(p => p.group === f.group);
    if (f.location) items = items.filter(p => p.location === f.location);
    if (f.supplier) items = items.filter(p => p.supplier === f.supplier);
    if (f.status) items = items.filter(p => p.status === f.status);
    if (f.barcode) items = items.filter(p => (p.barcodes || []).some(b => b.includes(f.barcode)));
    if (f.last4) items = items.filter(p => (p.last4 || '') === f.last4 || (p.barcodes || []).some(b => b.slice(-4) === f.last4));
    if (f.mainCode) items = items.filter(p => (p.mainCode || '').toLowerCase().includes(f.mainCode));
    if (f.extraCodeValue) items = items.filter(p => (p.extraCodeValue || '').toLowerCase().includes(f.extraCodeValue));
    if (f.priceMin) items = items.filter(p => p.price != null && p.price !== '' && parseFloat(p.price) >= parseFloat(f.priceMin));
    if (f.priceMax) items = items.filter(p => p.price != null && p.price !== '' && parseFloat(p.price) <= parseFloat(f.priceMax));
    if (f.dateFrom) {
      const fromTs = new Date(f.dateFrom + 'T00:00:00').getTime();
      items = items.filter(p => p.createdAt && p.createdAt >= fromTs);
    }
    if (f.dateTo) {
      const toTs = new Date(f.dateTo + 'T23:59:59').getTime();
      items = items.filter(p => p.createdAt && p.createdAt <= toTs);
    }

    closeAdvancedSearch();
    homeState.filter = null;
    resetChain();

    // Panel istənilən səhifədən (Dashboard daxil) açıla bilər, amma nəticə
    // yalnız Axtarış (#/home) səhifəsindəki #homeProductList konteynerinə
    // yazıla bilər. titleEl-i də YALNIZ container tapılanda toxunuruq —
    // əks halda Dashboard-un öz başlığını səhvən üzərinə yazırdıq.
    const writeResults = () => {
      const container = document.getElementById('homeProductList');
      if (!container) return false;
      const input = document.getElementById('homeSearch');
      if (input) input.value = '';
      const titleEl = document.querySelector('.section-title');
      if (titleEl) titleEl.textContent = `Ətraflı axtarış: ${items.length} məhsul`;
      renderList(container, items);
      return true;
    };

    if (writeResults()) {
      // artıq Home səhifəsindəydik, dərhal yazıldı
    } else {
      JollyRouter.go('#/home');
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if (writeResults() || tries >= 15) clearInterval(poll);
      }, 80);
    }
    if (typeof Toast !== 'undefined') Toast.success(`${items.length} nəticə tapıldı`);
  }

  // "Bu firmanın bütün məhsulları" — kart/detal səhifəsindən bir toxunuşla
  // zəncirvari axtarışa (Home) keçir, firmanı ilk zəncir sözü kimi əlavə edir.
  // Sonra istəyən "corab", "qara" kimi sözlərlə davam edib daralda bilər.
  function filterByBrandChain(brand) {
    homeState.filter = null;
    resetChain();
    const tryCommit = () => {
      if (!document.getElementById('homeProductList')) return false;
      commitChainTerm(brand);
      return true;
    };
    if (tryCommit()) return;
    JollyRouter.go('#/home');
    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      if (tryCommit() || tries >= 15) clearInterval(poll);
    }, 80);
  }

  function voiceSearch() {
    JollyVoice.listen((text) => {
      document.getElementById('homeSearch').value = text;
      liveSearch(text);
      Toast.success(`"${text}" axtarılır`);
    });
  }

  function photoSearch() {
    if (window.JollyAuth && !JollyAuth.can('search.photo')) {
      Toast.error('İcazə yoxdur');
      return;
    }
    if (typeof JollyVisualSearch === 'undefined') { Toast.error('Bu modul yüklənməyib'); return; }
    Toast.info('📷 Şəkil çək — bazadan oxşarını axtaracam');
    JollyVisualSearch.captureAndSearch((results) => {
      if (!results || results.length === 0) {
        Toast.error('Oxşar məhsul tapılmadı');
        return;
      }
      if (typeof JollyChat !== 'undefined' && JollyChat.showVisualResults) {
        JollyRouter.go('#/chat');
        setTimeout(() => JollyChat.showVisualResults(results), 300);
      } else if (results.length === 1) {
        JollyRouter.go(`#/product/${results[0].id}`);
      }
    });
  }

  function scanSearch() {
    JollyBarcode.open((code) => {
      const found = JollyDB.Products.findByBarcode(code);
      if (found.length === 1) {
        const cfg = (typeof JollyQuickMenu !== 'undefined') ? JollyQuickMenu.getConfig() : null;
        if (cfg && cfg.enabledOnScan !== false) {
          JollyQuickMenu.open(found[0].id);
        } else {
          JollyRouter.go(`#/product/${found[0].id}`);
        }
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

  // ── Qrup daxili axtarış + qalereya görünüşü (2026-07-22) ──
  // Qrup böyük olanda (məs. "açkı 545" — 1000 çeşid), sadə siyahı
  // əvəzinə axtarış qutusu + istəyə görə şəkil-əsaslı qalereya grid-i.
  let _groupViewState = { all: [], mode: 'list', query: '' };

  function renderFilteredPage(params) {
    let products = [];
    let title = 'Bütün məhsullar';
    if (params.filter === 'expiring') { products = expiringProducts(30); title = '⏰ SKT-si yaxınlaşan məhsullar'; }
    else if (params.filter === 'problemli') { products = JollyDB.Products.all().filter(p => (p.status || '').toLowerCase().includes('problem')); title = 'Problemli məhsullar'; }
    else if (params.filter === 'barkodsuz') { products = JollyDB.Products.filter({ hasBarcode: false }); title = 'Barkodsuz məhsullar'; }
    else if (params.filter === 'sekilsiz') { products = JollyDB.Products.filter({ hasImage: false }); title = 'Şəkilsiz məhsullar'; }
    else if (params.brand) { products = JollyDB.Products.filter({ brand: params.brand }); title = `Firma: ${params.brand}`; }
    else if (params.group) { products = JollyDB.Products.filter({ group: params.group }); title = `Qrup: ${params.group}`; }
    else if (params.supplier) { products = JollyDB.Products.filter({ supplier: params.supplier }); title = `Tədarükçü: ${params.supplier}`; }
    else { products = JollyDB.Products.all(); }

    const isGroupView = !!params.group;

    if (isGroupView) {
      _groupViewState = { all: products, mode: 'list', query: '' };
      setTimeout(() => _renderGroupFilteredList(), 0);
    } else {
      setTimeout(() => renderList(document.getElementById('filteredList'), products), 0);
    }

    return `
      <div class="row between" style="margin-bottom:14px;">
        <h2 style="font-family:var(--font-display);margin:0;font-size:19px;">${escapeHtml(title)}</h2>
        <span class="muted mono" id="filteredCount">${products.length}</span>
      </div>
      ${isGroupView ? `
      <div class="row" style="gap:8px;margin-bottom:12px;">
        <input id="filteredSearch" placeholder="Bu qrupda axtar (ad, kod, barkod...)" style="flex:1;padding:11px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);color:var(--text-hi);" oninput="JollyProducts.filterGroupSearch(this.value)">
        <button class="icon-btn" id="galleryToggleBtn" onclick="JollyProducts.toggleGroupView()" title="Qalereya görünüşü">🖼️</button>
      </div>` : ''}
      <div id="filteredList"></div>
    `;
  }

  function _renderGroupFilteredList() {
    const el = document.getElementById('filteredList');
    if (!el) return;
    const q = (_groupViewState.query || '').toLowerCase().trim();
    let list = _groupViewState.all;
    if (q) {
      list = list.filter(p => {
        const hay = [p.name, p.mainCode, p.extraCodeValue, p.color, p.note, ...(p.barcodes || [])].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    const countEl = document.getElementById('filteredCount');
    if (countEl) countEl.textContent = String(list.length);

    if (_groupViewState.mode === 'gallery') {
      const cells = [];
      list.forEach(p => (p.images || []).forEach((img, i) => cells.push({ img, name: p.name, images: p.images, idx: i, route: `#/product/${p.id}` })));
      el.innerHTML = cells.length ? `<div class="gallery-grid">
        ${cells.map(c => `
          <div class="gallery-cell anim-pop peekable" onclick='JollyDashboard.openGalleryImage(${escapeHtml(JSON.stringify(c.images))}, ${c.idx})' oncontextmenu="event.preventDefault();JollyRouter.go('${c.route}')">
            <img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(c.img) : 'src="' + c.img + '"'} loading="lazy">
            <div class="gc-name">${escapeHtml(c.name)}</div>
          </div>
        `).join('')}
      </div>` : `<div class="empty-state"><div class="big-icon">🖼️</div><h3>Şəkil yoxdur</h3></div>`;
    } else {
      renderList(el, list);
    }
  }

  function filterGroupSearch(q) {
    _groupViewState.query = q;
    _renderGroupFilteredList();
  }

  function toggleGroupView() {
    _groupViewState.mode = _groupViewState.mode === 'gallery' ? 'list' : 'gallery';
    const btn = document.getElementById('galleryToggleBtn');
    if (btn) btn.textContent = _groupViewState.mode === 'gallery' ? '📋' : '🖼️';
    _renderGroupFilteredList();
  }

  function deleteDraft(id) {
    if (!confirm('Bu gələn malı silmək istəyirsən?')) return;
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

  function readiness(p) {
    const missing = [];
    if (!p.images || !p.images.length) missing.push('Şəkil yoxdur');
    if (!p.barcodes || !p.barcodes.length) missing.push('Barkod yoxdur');
    if (p.price == null || p.price === '') missing.push('Qiymət yoxdur');
    return { ready: missing.length === 0, missing };
  }

  // ── SKT (Son İstifadə Tarixi) izləmə ──
  function expiryInfo(p) {
    if (!p.expiryDate) return null;
    const exp = new Date(p.expiryDate + 'T00:00:00');
    if (isNaN(exp.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((exp.getTime() - today.getTime()) / 864e5);
    let level = 'ok';
    if (daysLeft < 0) level = 'expired';
    else if (daysLeft <= 7) level = 'urgent';
    else if (daysLeft <= 30) level = 'soon';
    return { daysLeft, level, dateStr: exp.toLocaleDateString('az-AZ') };
  }
  function expiryBadgeHtml(p) {
    const info = expiryInfo(p);
    if (!info || info.level === 'ok') return '';
    const map = {
      expired: { color: '#ff5c6c', text: `⏰ Bitib (${Math.abs(info.daysLeft)} gün əvvəl)` },
      urgent:  { color: '#ff5c6c', text: `⏰ ${info.daysLeft} gün qalıb!` },
      soon:    { color: '#fbbf24', text: `⏰ ${info.daysLeft} gün qalıb` },
    };
    const m = map[info.level];
    return `<div class="status-pill" style="background:${m.color}22;color:${m.color};margin-top:4px;">${m.text}</div>`;
  }
  function expiringProducts(days) {
    return JollyDB.Products.all().filter(p => {
      const info = expiryInfo(p);
      return info && info.level !== 'ok' && info.daysLeft <= (days || 30);
    }).sort((a, b) => expiryInfo(a).daysLeft - expiryInfo(b).daysLeft);
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
          ${p.brand ? `<div class="list-row" style="cursor:pointer;" onclick="JollyProducts.filterByBrandChain('${escapeHtml(p.brand)}')"><span>Firma</span><span class="mono" style="color:var(--accent-1);">${escapeHtml(p.brand)} — bütün məhsullar ›</span></div>` : infoRow('Firma', p.brand)}
          ${infoRow('Qrup', p.group)}
          ${infoRow('Yer / Rəf', p.location)}
          ${infoRow('Tədarükçü', p.supplier)}
          ${(() => {
            const info = expiryInfo(p);
            if (!info) return infoRow('SKT (Son istifadə tarixi)', null);
            const colorMap = { expired: 'var(--accent-danger)', urgent: 'var(--accent-danger)', soon: 'var(--accent-warn)', ok: 'var(--accent-2)' };
            const labelMap = { expired: `Bitib (${Math.abs(info.daysLeft)} gün əvvəl)`, urgent: `${info.daysLeft} gün qalıb ⚠️`, soon: `${info.daysLeft} gün qalıb`, ok: `${info.daysLeft} gün qalıb` };
            return `<div class="list-row"><span>SKT (Son istifadə tarixi)</span><span class="mono" style="color:${colorMap[info.level]};">${info.dateStr} · ${labelMap[info.level]}</span></div>`;
          })()}
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

        ${(() => {
          if (typeof JollyReceiving === 'undefined' || !JollyReceiving.docsForProduct) return '';
          const batches = JollyReceiving.docsForProduct(p.id);
          if (!batches.length) return '';
          return `
            <div class="section-title">📦 Partiya tarixçəsi</div>
            <div class="glass" style="padding:4px 14px;">
              ${batches.map(b => `
                <div class="list-row" style="cursor:pointer;" onclick="JollyRouter.go('#/receiving/docs/${b.id}')">
                  <span>Sənəd #${b.number}</span>
                  <span class="muted" style="font-size:11px;">${new Date(b.receivedAt).toLocaleDateString('az-AZ')} ›</span>
                </div>
              `).join('')}
            </div>
          `;
        })()}
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

  function showBarcode(code) {
    if (typeof JollyViewer === 'undefined') return;
    let dataUrl;
    if (typeof JollyBarcodeGen !== 'undefined') {
      dataUrl = JollyBarcodeGen.toDataURL(code);
    }
    if (!dataUrl) dataUrl = generateBarcodeImage(code);
    JollyViewer.open([dataUrl], 0, code);
  }

  function generateBarcodeImage(code) {
    const canvas = document.createElement('canvas');
    const W = 700, H = 320;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    const digits = code.replace(/\D/g, '') || '0';
    let x = 40;
    const barAreaW = W - 80;
    const unit = Math.max(2, Math.floor(barAreaW / (digits.length * 7)));
    for (const d of digits) {
      const val = parseInt(d, 10);
      for (let i = 0; i < 4; i++) {
        const w = unit * ((i + val % 3) % 3 + 1);
        if (i % 2 === 0) { ctx.fillRect(x, 30, w, 200); }
        x += w + unit;
      }
    }
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
    if (window.JollyAuth && !JollyAuth.can('favorites.use')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Sevimlilər icazən yoxdur');
      return;
    }
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

  // ── UNDO (son əməliyyatı geri al) — 10 saniyəlik pəncərə ──
  function showUndoSnackbar(message, onUndo) {
    let bar = document.getElementById('undoSnackbar');
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.id = 'undoSnackbar';
    bar.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99998;background:#1a1a1a;color:#fff;padding:12px 16px;border-radius:14px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 24px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12);font-size:13px;max-width:92vw;';
    let secondsLeft = 10;
    bar.innerHTML = `
      <span style="flex:1;">${message}</span>
      <span id="undoCountdown" style="color:#ffb84d;font-weight:700;min-width:22px;">${secondsLeft}s</span>
      <button id="undoBtn" style="background:#7c8aff;border:none;color:#fff;padding:7px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Geri al</button>
    `;
    document.body.appendChild(bar);
    const countdownEl = bar.querySelector('#undoCountdown');
    const btn = bar.querySelector('#undoBtn');
    let done = false;
    const interval = setInterval(() => {
      secondsLeft--;
      if (countdownEl) countdownEl.textContent = secondsLeft + 's';
      if (secondsLeft <= 0) finish();
    }, 1000);
    function finish() {
      if (done) return;
      done = true;
      clearInterval(interval);
      if (bar && bar.parentNode) bar.remove();
    }
    btn.onclick = () => {
      if (done) return;
      finish();
      onUndo();
    };
  }

  function deleteProduct(id) {
    if (!confirm('Məhsul silinsin? (Silinənlər səbətinə düşəcək, 30 gün ərzində bərpa edə bilərsən)')) return;
    if (!checkPinForDelete()) return;
    const p = JollyDB.Products.get(id);
    const name = (p && p.name) ? p.name : 'Məhsul';
    JollyDB.Trash.moveToTrash(id);
    if (typeof JollySound !== 'undefined') JollySound.warn();
    if (window.JollyEvents) JollyEvents.emit('product.deleted', { id });
    JollyRouter.go('#/home');
    showUndoSnackbar(`"${escapeHtml(name)}" silindi`, () => {
      JollyDB.Trash.restore(id);
      if (typeof JollySound !== 'undefined') JollySound.success();
      Toast.success('Bərpa olundu ♻️');
      if (typeof JollyApp !== 'undefined') JollyApp.render();
    });
  }

  function whatsappShare(id) {
    if (typeof JollyShare === 'undefined') { Toast.error('Paylaşım modulu yüklənməyib'); return; }
    JollyShare.shareCurrentProduct(id);
  }

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

  let formState = null;

  function smartProductParse(text) {
    text = String(text || '').trim();
    const result = { name: '', specialCode: '', modelNo: '' };
    if (!text) return result;
    const hasSlash = text.includes('/');
    const parts = text.split('/');
    const leftPart = (parts[0] || '').trim();
    const explicitModel = hasSlash ? parts.slice(1).join('/').trim() : '';

    const match = leftPart.match(/^(.+?)\s+(\d{1,5})(?:[\s\-]+(.+))?$/);
    if (match) {
      result.name = match[1].trim();
      result.specialCode = match[2].trim();
      result.modelNo = explicitModel || (match[3] ? match[3].trim() : '');
    } else {
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
      supplier: '', status: 'Aktiv', images: [], expiryDate: '', filterTags: [],
    };
    if (formState.supplier === undefined) formState.supplier = '';
    if (formState.last4 === undefined) formState.last4 = '';
    if (formState.expiryDate === undefined) formState.expiryDate = '';
    if (formState.filterTags === undefined) formState.filterTags = [];
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
          <input id="f_quickFill" placeholder="Məsələn: Corab 545 / ai-120" oninput="JollyProducts.smartFill(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.focusNext(this);}" enterkeyhint="next" style="border:1px solid var(--border-glow);">
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
          <input id="f_name" value="${escapeHtml(formState.name)}" placeholder="məs. Daraq" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.focusNext(this);}" enterkeyhint="next">
        </div>
        ${typeof JollyOCR !== 'undefined' ? `<button class="btn btn-ghost btn-sm" style="margin:-6px 0 12px;" onclick="JollyProducts.ocrFill()">📷 Şəkildən oxu (OCR)</button>` : ''}
        <div id="brainSuggestZone" style="margin:-6px 0 12px;"></div>

        <div class="field-row">
          <div class="field">
            <label>Xüsusi kod</label>
            <input id="f_mainCode" inputmode="numeric" value="${escapeHtml(formState.mainCode)}" placeholder="məs. 545" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.focusNext(this);}" enterkeyhint="next">
          </div>
          <div class="field">
            <label>Qiymət (₼)</label>
            <input id="f_price" type="number" inputmode="decimal" step="0.01" value="${formState.price}" placeholder="0.00" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.focusNext(this);}" enterkeyhint="next">
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
            <input id="f_extraCodeValue" inputmode="numeric" value="${escapeHtml(formState.extraCodeValue)}" placeholder="məs. 180" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.focusNext(this);}" enterkeyhint="next">
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
          <input id="f_last4" inputmode="numeric" maxlength="4" value="${escapeHtml(formState.last4 || '')}" placeholder="avtomatik dolur" style="letter-spacing:2px;font-family:var(--font-mono);" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.focusNext(this);}" enterkeyhint="next">
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
          <select id="f_supplier" onchange="JollyProducts.handleInlineAdd(this,'supplier')">
            <option value="">— seçin —</option>
            ${suppliers.map(s => `<option value="${escapeHtml(s.name)}" ${formState.supplier === s.name ? 'selected' : ''}>${escapeHtml(s.code ? s.code + ' - ' + s.name : s.name)}</option>`).join('')}
            <option value="__new__">+ Yeni tədarükçü əlavə et</option>
          </select>
        </div>

        <div class="field">
          <label>Status</label>
          <div class="chip-row" id="statusChips">
            ${statuses.map(s => `<span class="chip ${formState.status === s.name ? 'selected' : ''}" data-status="${escapeHtml(s.name)}" onclick="JollyProducts.selectStatus('${escapeHtml(s.name)}')">${escapeHtml(s.name)}</span>`).join('')}
          </div>
        </div>

        <div class="field">
          <label>🏷️ Etiketlər (bir neçəsini seçə bilərsən)</label>
          <div class="chip-row" id="filterTagChips">
            ${renderFilterTagChips()}
          </div>
          <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="JollyProducts.addNewFilterTagInline()">+ Yeni etiket yarat</button>
        </div>

        <div class="field">
          <label>Rəng</label>
          <input id="f_color" value="${escapeHtml(formState.color || '')}" placeholder="məs. qara" onkeydown="if(event.key==='Enter'){event.preventDefault();JollyProducts.focusNext(this);}" enterkeyhint="done">
        </div>

        <div class="field">
          <label>⏰ SKT — Son istifadə tarixi (könüllü)</label>
          <input id="f_expiryDate" type="date" value="${escapeHtml(formState.expiryDate || '')}">
          <div class="muted" style="font-size:11px;margin-top:5px;">Doldursan, bitməsinə 30 gündən az qalanda Dashboard-da xəbərdarlıq göstəriləcək.</div>
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

  const ENTER_FIELD_ORDER = ['f_quickFill', 'f_name', 'f_mainCode', 'f_price', 'f_extraCodeValue', 'f_last4', 'f_color', 'f_note'];
  function focusNext(el) {
    const idx = ENTER_FIELD_ORDER.indexOf(el.id);
    if (idx === -1 || idx === ENTER_FIELD_ORDER.length - 1) { el.blur(); return; }
    for (let i = idx + 1; i < ENTER_FIELD_ORDER.length; i++) {
      const nextEl = document.getElementById(ENTER_FIELD_ORDER[i]);
      if (nextEl) { nextEl.focus(); if (nextEl.select) nextEl.select(); return; }
    }
    el.blur();
  }

  function afterFormRender() {
    renderImageStrip();
    renderBarcodeTags();
    ['name', 'mainCode', 'price', 'extraCodeType', 'extraCodeValue', 'color', 'note', 'last4', 'expiryDate'].forEach(f => {
      const el = document.getElementById('f_' + f);
      if (el) {
        el.addEventListener('input', () => { formState[f] = el.value; });
        el.addEventListener('change', () => { formState[f] = el.value; });
      }
    });
    const nameEl = document.getElementById('f_name');
    if (nameEl && typeof JollyBrain !== 'undefined') {
      nameEl.addEventListener('blur', () => { showBrainSuggestions(); checkSimilarWarning(); });
    }
  }

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
      <div class="image-slot" id="imgSlot${i}">
        <img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(src) : 'src="' + src + '"'}>
        <div class="rm" onclick="JollyProducts.removeImage(${i})">✕</div>
        <div class="clean-ico" title="Arxa fonu təmizlə" onclick="JollyProducts.cleanImageAt(${i})" style="position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,0.55);border-radius:6px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1;">🧹</div>
        <div class="clean-ico" title="90° döndər" onclick="JollyProducts.rotateImageAt(${i})" style="position:absolute;bottom:2px;left:28px;background:rgba(0,0,0,0.55);border-radius:6px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1;">🔄</div>
      </div>
    `).join('');
    html += `
      <div class="image-slot" onclick="document.getElementById('imgFileInput').click()">🖼️+</div>
      <input type="file" id="imgFileInput" accept="image/*" multiple style="display:none" onchange="JollyProducts.handleImageUpload(event)">
      <input type="file" id="imgCameraInput" accept="image/*" capture="environment" style="display:none" onchange="JollyProducts.handleImageUpload(event)">
    `;
    strip.innerHTML = html;
    attachImageDrag();
  }

  // ── Şəkilləri sürüşdürərək sıralamaq — bir şəklin üstünə basıb yana
  // çəkəndə, sıra dəyişir. ✕/🧹/🔄 ikonlarına toxunma sürükləmə başlatmır. ──
  function attachImageDrag() {
    const strip = document.getElementById('imgStrip');
    if (!strip) return;
    let dragEl = null;
    let dragging = false;
    const imgSlots = () => [...strip.querySelectorAll('.image-slot[id^="imgSlot"]')];

    imgSlots().forEach(slot => {
      slot.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('rm') || e.target.classList.contains('clean-ico')) return;
        dragEl = slot; dragging = true;
        slot.style.opacity = '0.4';
      }, { passive: true });

      slot.addEventListener('touchmove', (e) => {
        if (!dragging || !dragEl) return;
        e.preventDefault();
        const x = e.touches[0].clientX;
        const others = imgSlots().filter(s => s !== dragEl);
        const after = others.find(s => {
          const box = s.getBoundingClientRect();
          return x < box.left + box.width / 2;
        });
        if (after) strip.insertBefore(dragEl, after);
        else {
          const addSlot = [...strip.children].find(c => !c.id || !c.id.startsWith('imgSlot'));
          if (addSlot) strip.insertBefore(dragEl, addSlot); else strip.appendChild(dragEl);
        }
      }, { passive: false });

      slot.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        if (dragEl) dragEl.style.opacity = '1';
        persistImageOrder();
        dragEl = null;
      });
    });
  }

  function persistImageOrder() {
    const strip = document.getElementById('imgStrip');
    if (!strip) return;
    const oldIdxOrder = [...strip.querySelectorAll('.image-slot[id^="imgSlot"]')]
      .map(s => parseInt(s.id.replace('imgSlot', ''), 10));
    const reordered = oldIdxOrder.map(idx => formState.images[idx]);
    // Yalnız reallıqda sıra dəyişibsə yenilə (lazımsız re-render etməsin)
    const changed = reordered.some((v, i) => v !== formState.images[i]);
    if (!changed) return;
    formState.images = reordered;
    if (typeof JollySound !== 'undefined') JollySound.tap();
    renderImageStrip();
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

  // ------------------------------------------------------------------------
  // ŞƏKİL DÖNDƏRMƏ — hər şəklin altındakı 🔄 düyməsi ilə, 90° saat
  // əqrəbi istiqamətində döndərib YERİNƏ QOYUR. Kamera bəzən şəkli
  // yan çəkəndə faydalıdır.
  // ------------------------------------------------------------------------
  async function rotateImageAt(i) {
    const ref = formState.images[i];
    if (!ref) return;
    let sourceDataUrl = ref;
    if (typeof JollyStorage !== 'undefined' && ref.startsWith && ref.startsWith('idb:')) {
      const resolved = await JollyStorage.resolveAll([ref]);
      sourceDataUrl = resolved && resolved[0];
    }
    if (!sourceDataUrl) { Toast.error('Şəkil oxunmadı'); return; }

    const slot = document.getElementById('imgSlot' + i);
    const originalHtml = slot ? slot.innerHTML : null;
    if (slot) slot.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:11px;">⏳</div>`;

    try {
      const rotatedDataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.height; canvas.height = img.width;
          const ctx = canvas.getContext('2d');
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = sourceDataUrl;
      });

      let newRef = rotatedDataUrl;
      if (typeof JollyStorage !== 'undefined') newRef = await JollyStorage.saveImage(rotatedDataUrl);
      if (typeof JollyStorage !== 'undefined' && ref.startsWith && ref.startsWith('idb:')) {
        JollyStorage.deleteImage(ref);
      }
      formState.images[i] = newRef;
      renderImageStrip();
      if (typeof JollySound !== 'undefined') JollySound.tap();
    } catch (err) {
      console.error('[rotateImageAt]', err);
      if (slot && originalHtml) slot.innerHTML = originalHtml;
      Toast.error('Şəkil döndərilmədi');
    }
  }

  // ------------------------------------------------------------------------
  // ARXA FON TƏMİZLƏMƏ — hər şəklin altındakı 🧹 düyməsi ilə, bg-remove.js
  // faylının əsas məntiqini (cleanDataUrl) çağırır. Yükləmə axınına
  // TOXUNMUR — yalnız artıq əlavə olunmuş bir şəkli, istəyəndə, əl ilə
  // təmizləyib YERİNƏ QOYUR.
  // ------------------------------------------------------------------------
  async function cleanImageAt(i) {
    if (typeof window.JollyBgRemove === 'undefined' || !window.JollyBgRemove.cleanDataUrl) {
      Toast.error('Şəkil Təmizləyici modulu yüklənməyib (bg-remove.js)');
      return;
    }
    const ref = formState.images[i];
    if (!ref) return;

    const wantsWhite = confirm('Ağ fonlu et? (İmtina = şəffaf fon)');

    let sourceDataUrl = ref;
    if (typeof JollyStorage !== 'undefined' && ref.startsWith && ref.startsWith('idb:')) {
      const resolved = await JollyStorage.resolveAll([ref]);
      sourceDataUrl = resolved && resolved[0];
    }
    if (!sourceDataUrl) { Toast.error('Şəkil oxunmadı'); return; }

    const slot = document.getElementById('imgSlot' + i);
    const originalHtml = slot ? slot.innerHTML : null;
    if (slot) slot.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:11px;text-align:center;padding:4px;">⏳ Təmizlənir...</div>`;

    try {
      const cleanedDataUrl = await window.JollyBgRemove.cleanDataUrl(sourceDataUrl, wantsWhite ? 'white' : 'transparent', (pct) => {
        if (slot) slot.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:11px;text-align:center;padding:4px;">⏳ ${pct != null ? pct + '%' : '...'}</div>`;
      });
      let newRef = cleanedDataUrl;
      if (typeof JollyStorage !== 'undefined') newRef = await JollyStorage.saveImage(cleanedDataUrl);

      if (typeof JollyStorage !== 'undefined' && ref.startsWith && ref.startsWith('idb:')) {
        JollyStorage.deleteImage(ref);
      }
      formState.images[i] = newRef;
      renderImageStrip();
      if (typeof JollySound !== 'undefined') JollySound.success();
      Toast.success('Şəkil təmizləndi ✓');
    } catch (err) {
      console.error('[cleanImageAt]', err);
      if (slot && originalHtml) slot.innerHTML = originalHtml;
      const isTimeout = /timeout|bitmədi/i.test(String(err && err.message));
      Toast.error(isTimeout ? 'Vaxt bitdi — internet zəif ola bilər' : 'Fon silinmədi');
    }
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
    if (!formState.last4) {
      formState.last4 = val.slice(-4);
      const l4 = document.getElementById('f_last4');
      if (l4) l4.value = formState.last4;
    }
    input.value = '';
    renderBarcodeTags();

    if (!formState.name || !formState.name.trim()) {
      lookupBarcodeOnline(val);
    }
  }

  function lookupBarcodeOnline(code) {
    const zone = document.getElementById('brainSuggestZone');
    if (zone) zone.innerHTML = `<div class="muted" style="font-size:11px;">🌐 İnternetdə axtarılır...</div>`;
    // Server yavaş/cavabsız olsa əbədi "axtarılır..." yazısında donmasın —
    // 6 saniyədən sonra özü ləğv edib sakitcə imtina etsin.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    fetch(`/api/barcode-lookup?upc=${encodeURIComponent(code)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        clearTimeout(timeoutId);
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
        clearTimeout(timeoutId);
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

  // ── Etiketlər (Filter Tags) — çoxseçimli, JollyDB.Tags master siyahısından ──
  function renderFilterTagChips() {
    const all = JollyDB.Tags.all();
    if (!all.length) return '<span class="muted" style="font-size:12px;">Hələ etiket yoxdur — aşağıdan yeni yarat</span>';
    return all.map(t => `<span class="chip ${(formState.filterTags || []).includes(t.name) ? 'selected' : ''}" data-tag="${escapeHtml(t.name)}" onclick="JollyProducts.toggleFilterTag('${escapeHtml(t.name)}')">${escapeHtml(t.name)}</span>`).join('');
  }

  function toggleFilterTag(name) {
    formState.filterTags = formState.filterTags || [];
    if (formState.filterTags.includes(name)) {
      formState.filterTags = formState.filterTags.filter(x => x !== name);
    } else {
      formState.filterTags.push(name);
    }
    const zone = document.getElementById('filterTagChips');
    if (zone) zone.innerHTML = renderFilterTagChips();
  }

  function addNewFilterTagInline() {
    const name = prompt('Yeni etiket adı (məs. "Salon malları", "Xırdavat"):');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const existing = JollyDB.Tags.all().find(t => t.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      JollyDB.Tags.add({ name: trimmed });
      Toast.success(`"${trimmed}" etiketi yaradıldı`);
    }
    formState.filterTags = formState.filterTags || [];
    if (!formState.filterTags.includes(trimmed)) formState.filterTags.push(trimmed);
    const zone = document.getElementById('filterTagChips');
    if (zone) zone.innerHTML = renderFilterTagChips();
  }

  // ── Qrupun ortaq barkod/qiymətini formaya köçürmə (2026-07-22) ──
  // Qrupda (JollyDB.Groups) "barcode"/"price" təyin olunubsa, YALNIZ
  // hazırda boş olan sahələri doldurur — istifadəçinin özü artıq
  // yazdığı dəyəri əzmir, sonra istəsə yenə əl ilə dəyişə bilər.
  function applyGroupDefaults(groupName) {
    if (!groupName || typeof JollyDB === 'undefined' || !JollyDB.Groups) return;
    const g = JollyDB.Groups.all().find(x => x.name === groupName);
    if (!g) return;
    if (g.barcode && !formState.barcodes.includes(g.barcode)) {
      const dupe = JollyDB.Products.findByBarcode(g.barcode).filter(p => !formState.id || p.id !== formState.id);
      if (!dupe.length || dupe.every(p => p.group === groupName)) {
        formState.barcodes.push(g.barcode);
        if (!formState.last4) {
          formState.last4 = g.barcode.slice(-4);
          const l4 = document.getElementById('f_last4');
          if (l4) l4.value = formState.last4;
        }
        renderBarcodeTags();
      }
    }
    if (g.price !== undefined && g.price !== '' && (!formState.price && formState.price !== 0)) {
      formState.price = g.price;
      const priceEl = document.getElementById('f_price');
      if (priceEl) priceEl.value = g.price;
    }
  }

  function handleInlineAdd(selectEl, kind) {
    if (selectEl.value !== '__new__') {
      formState[kind] = selectEl.value;
      if (kind === 'group') applyGroupDefaults(selectEl.value);
      return;
    }
    const label = { brand: 'firma', group: 'qrup', location: 'yer', supplier: 'tədarükçü' }[kind];
    const name = prompt(`Yeni ${label} adı:`);
    if (!name || !name.trim()) { selectEl.value = formState[kind] || ''; return; }
    const store = { brand: JollyDB.Brands, group: JollyDB.Groups, location: JollyDB.Locations, supplier: JollyDB.Suppliers }[kind];
    let extra = {};
    if (kind === 'supplier') {
      const code = prompt('Tədarükçü kodu (məs. 504) — boş buraxıla bilər:');
      if (code && code.trim()) extra.code = code.trim();
    }
    if (kind === 'group' && confirm('Bu qrupdakı bütün məhsullar eyni barkod və/və ya eyni qiymətdədirmi? (məs. "açkı 545" — 1000 model, hamısı 10₼)')) {
      const barcode = prompt('Ortaq barkod (boş buraxıla bilər):', '');
      if (barcode && barcode.trim()) extra.barcode = barcode.trim();
      const price = prompt('Ortaq qiymət ₼ (boş buraxıla bilər):', '');
      const p = parseFloat(price);
      if (price && !isNaN(p)) extra.price = p;
    }
    const rec = store.add({ name: name.trim(), ...extra });
    formState[kind] = rec.name;
    const opt = document.createElement('option');
    opt.value = rec.name; opt.textContent = extra.code ? `${extra.code} - ${rec.name}` : rec.name; opt.selected = true;
    selectEl.insertBefore(opt, selectEl.lastElementChild);
    Toast.success(`"${rec.name}" əlavə olundu`);
    if (kind === 'group') applyGroupDefaults(rec.name);
  }

  function validate() {
    if (!formState.name || !formState.name.trim()) { Toast.error('Məhsulun adı vacibdir'); return false; }
    return true;
  }

  // ── Kateqoriya üzrə minimum şəkil sayı qaydası (#26) — bloklamır,
  // sadəcə xəbərdar edib təsdiq istəyir (admin-studio.js-də təyin olunur). ──
  function checkMinImagesRule() {
    if (!formState.group) return true;
    const groups = (typeof JollyDB !== 'undefined' && JollyDB.Groups) ? JollyDB.Groups.all() : [];
    const g = groups.find(x => x.name === formState.group);
    const min = g && g.minImages ? g.minImages : 0;
    if (min <= 0) return true;
    const have = (formState.images || []).length;
    if (have >= min) return true;
    return confirm(`"${formState.group}" qrupu üçün minimum ${min} şəkil tələb olunur, hazırda ${have} var.\n\nYenə də saxlanılsın?`);
  }

  function submitForm(keepOpen) {
    if (!validate()) return false;
    if (!checkMinImagesRule()) return false;
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
      if (window.JollyEvents) JollyEvents.emit('product.saved', { id: formState.id, product: payload, isNew: false });
    } else {
      JollyDB.Products.add(payload);
      Toast.success('Məhsul əlavə olundu');
      if (typeof JollyApp !== 'undefined' && JollyApp.celebrate) JollyApp.celebrate();
      if (window.JollyEvents) JollyEvents.emit('product.saved', { id: payload.id, product: payload, isNew: true });
    }
    if (formState._draftId) JollyDB.Drafts.remove(formState._draftId);
    if (!keepOpen) JollyRouter.go('#/home');
    return true;
  }

  function submitAndNew() {
    const carry = {
      brand: formState.brand, group: formState.group,
      location: formState.location, status: formState.status,
    };
    if (!submitForm(true)) return;
    sessionStorage.setItem('jolly_carry', JSON.stringify(carry));
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

  // ────────────────────────────────────────────────────────────
  // UZUN-BAS İLƏ SÜRƏTLİ ÖNİZLƏMƏ — məhsul kartına ~0.5s basıb
  // saxlayanda, kartı açmadan kiçik popup-da əsas məlumat göstərilir.
  // Toxunuş/siçan hər ikisi dəstəklənir; adi (qısa) toxunuş normal
  // kimi kartı açır — heç nə pozulmur.
  // ────────────────────────────────────────────────────────────
  let _lpTimer = null;
  let _lpTriggered = false;
  let _lpStartX = 0, _lpStartY = 0;
  const LP_DELAY = 480;
  const LP_MOVE_TOLERANCE = 12;

  function _lpFindCard(target) {
    return target && target.closest ? target.closest('.product-card') : null;
  }

  function _lpStart(e) {
    const card = _lpFindCard(e.target);
    if (!card) return;
    const point = e.touches ? e.touches[0] : e;
    _lpStartX = point.clientX; _lpStartY = point.clientY;
    clearTimeout(_lpTimer);
    _lpTimer = setTimeout(() => {
      _lpTriggered = true;
      if (navigator.vibrate) navigator.vibrate(15);
      showQuickPreview(card.dataset.id);
    }, LP_DELAY);
  }

  function _lpMove(e) {
    if (!_lpTimer) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = Math.abs(point.clientX - _lpStartX);
    const dy = Math.abs(point.clientY - _lpStartY);
    if (dx > LP_MOVE_TOLERANCE || dy > LP_MOVE_TOLERANCE) { clearTimeout(_lpTimer); _lpTimer = null; }
  }

  function _lpEnd() { clearTimeout(_lpTimer); _lpTimer = null; }

  // Uzun-bas tetiklənəndə, kartın öz onclick-i (kartı açma) işə düşməsin
  // deyə capture mərhələsində click-i tutub dayandırırıq.
  function _lpClickGuard(e) {
    if (_lpTriggered) {
      e.stopPropagation();
      e.preventDefault();
      _lpTriggered = false;
    }
  }

  function initLongPressPreview() {
    if (document.body.dataset.lpInit) return;
    document.body.dataset.lpInit = '1';
    document.addEventListener('touchstart', _lpStart, { passive: true });
    document.addEventListener('touchmove', _lpMove, { passive: true });
    document.addEventListener('touchend', _lpEnd, { passive: true });
    document.addEventListener('touchcancel', _lpEnd, { passive: true });
    document.addEventListener('mousedown', _lpStart);
    document.addEventListener('mousemove', _lpMove);
    document.addEventListener('mouseup', _lpEnd);
    document.addEventListener('click', _lpClickGuard, true);
  }

  function showQuickPreview(id) {
    const p = JollyDB.Products.get(id);
    if (!p) return;
    let overlay = document.getElementById('quickPreviewOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'quickPreviewOverlay';
    overlay.className = 'qa-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('on'); });
    const thumb = (p.images && p.images[0])
      ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:100%;height:180px;object-fit:cover;border-radius:12px;">`
      : `<div style="width:100%;height:180px;display:flex;align-items:center;justify-content:center;font-size:44px;background:rgba(255,255,255,0.05);border-radius:12px;">🧴</div>`;
    overlay.innerHTML = `
      <div class="glass qa-sheet" style="max-width:340px;">
        ${thumb}
        <div style="font-family:var(--font-display);font-size:17px;font-weight:700;margin-top:12px;">${escapeHtml(p.name || 'Adsız məhsul')}</div>
        <div class="row between" style="margin-top:6px;">
          <span style="font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--accent-2);">${p.price != null && p.price !== '' ? p.price + ' ₼' : '—'}</span>
          ${p.status ? `<span class="status-pill"><span class="dot" style="background:${statusColor(p.status)}"></span>${escapeHtml(p.status)}</span>` : ''}
        </div>
        ${(p.barcodes && p.barcodes[0]) ? `<div class="mono" style="font-size:12px;color:var(--accent-2);margin-top:6px;">🏷️ ${escapeHtml(p.barcodes[0])}</div>` : ''}
        ${p.brand ? `<div class="muted" style="font-size:12px;margin-top:4px;">🏭 ${escapeHtml(p.brand)}</div>` : ''}
        <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="document.getElementById('quickPreviewOverlay').classList.remove('on');JollyRouter.go('#/product/${p.id}')">Tam kartı aç ›</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  // ────────────────────────────────────────────────────────────
  // KLAVİATURA QISAYOLLARI — fiziki/Bluetooth klaviaturası olan
  // cihazlar üçün (nadir, amma pulsuz). Yazı sahəsindəykən (input,
  // textarea) qısayollar söndürülür ki, adi yazmağa mane olmasın —
  // Esc istisnadır, o həmişə işləyir.
  // ────────────────────────────────────────────────────────────
  function initKeyboardShortcuts() {
    if (document.body.dataset.kbInit) return;
    document.body.dataset.kbInit = '1';
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);

      if (e.key === 'Escape') {
        closeAdvancedSearch();
        const qp = document.getElementById('quickPreviewOverlay'); if (qp) qp.classList.remove('on');
        const mm = document.getElementById('moreMenuOverlay'); if (mm) mm.classList.remove('on');
        return;
      }

      if (typing) return;

      if (e.key === '/' || e.key === 'f') {
        const input = document.getElementById('homeSearch');
        if (input) { e.preventDefault(); input.focus(); }
      } else if (e.key === 'n') {
        e.preventDefault();
        JollyRouter.go('#/product/new');
      } else if (e.key === 'b') {
        e.preventDefault();
        scanSearch();
      } else if (e.key === 'a') {
        e.preventDefault();
        openAdvancedSearch();
      } else if (e.key === '?') {
        e.preventDefault();
        alert('⌨️ Klaviatura qısayolları:\n\n/ və ya f  —  axtarışa fokuslan\nn  —  yeni məhsul\nb  —  barkod skan\na  —  ətraflı axtarış\nEsc  —  pəncərəni bağla\n?  —  bu siyahı');
      }
    });
  }

  initLongPressPreview();
  initKeyboardShortcuts();

  return {
    renderHomePage, afterHomeRender, liveSearch, voiceSearch, scanSearch, photoSearch,
    renderFilteredPage, renderDraftsPage, deleteDraft, renderDetailPage, deleteProduct,
    renderFormPage, afterFormRender, handleImageUpload, removeImage, cleanImageAt,
    addBarcodeField, removeBarcode, scanIntoForm, galleryScanIntoForm, selectStatus, handleInlineAdd,
    rotateImageAt,
    applySuggestion, ocrFill, toggleFav, homeFilter, cycleSort,
    commitChainTerm, removeChainTerm, clearChain, filterByBrandChain,
    openSearchHistory, clearSearchHistory, applyDidYouMean,
    saveCurrentFilterSet, openSavedFilters, applySavedFilter, deleteSavedFilter,
    toggleBulkSelectMode, toggleBulkSelect, shareSelectedViaWhatsApp,
    openAdvancedSearch, closeAdvancedSearch, clearAdvancedFields, applyAdvancedSearch,
    submitForm, submitAndNew, saveDraft, escapeHtml, renderCard, statusColor,
    openViewer, showBarcode, generateBarcodeImage,
    smartProductParse, smartFill, aiCameraFill, whatsappShare, moreMenu, copyProductText,
    lookupBarcodeOnline, applyOnlineLookup, focusNext,
    quickAddToReceiving,
    expiryInfo, expiringProducts,
    renderFilterTagChips, toggleFilterTag, addNewFilterTagInline,
    filterGroupSearch, toggleGroupView,
  };
})();
