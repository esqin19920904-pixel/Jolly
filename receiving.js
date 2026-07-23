/* ============================================================
   JOLLY Receiving Studio — Qəbul Studio
   Yeni gələn malları seç → səbətə at → skanerlə Turbo Qəbul Rejimi
   Özü-özünü ModuleRegistry-ə qeydiyyatdan keçirir (#/receiving).

   DÜZƏLİŞ: Səbətdəki məhsullar indi SEÇİLMƏ SIRASI ilə, nömrələnmiş
   siyahı kimi göstərilir (renderBasketList) — hər birinin yanında
   "çıxar" düyməsi var (removeFromBasket).

   YENİ: quickAddToBasket(id) — məhsul kartındakı "+" düyməsindən
   Qəbul Studio-ya girmədən, birbaşa səbətə tək kliklə əlavə etmək.
   ============================================================ */

const JollyReceiving = (() => {
  const BASKET_KEY = 'jolly_receiving_basket';
  const DOCS_KEY = 'jolly_receiving_docs';

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function getBasket() {
    return JollyDB.read(BASKET_KEY, { productIds: [], received: {}, startedAt: null });
  }
  function setBasket(b) { JollyDB.write(BASKET_KEY, b); }

  /* ============================================================
     MAL QƏBULU SƏNƏDLƏRİ (PARTİYALAR) — 1C-dəki "Mal hərəkəti
     sənədi" konsepsiyasının sadə JOLLY versiyası. Hər "Qəbul
     Rejimi" sessiyası bitəndə (clearBasketAndExit) avtomatik
     bir sənəd yaranır: nömrə, tarix, hansı məhsullar, nə vaxt
     qəbul edilib. Məhsulun öz səhifəsindən bu sənədlərə keçid
     edilə bilər (bax: products.js → renderDetailPage).
     ============================================================ */
  function getDocs() { return JollyDB.read(DOCS_KEY, []); }
  function saveDoc(doc) {
    if (window.JollyAuth && !JollyAuth.can('receiving.create')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Qəbul sənədi yaratmaq icazən yoxdur');
      return;
    }
    const docs = getDocs();
    docs.unshift(doc);
    JollyDB.write(DOCS_KEY, docs);
  }
  function nextDocNumber() { return getDocs().length + 1; }

  // Verilən məhsulun hansı sənədlərdə (partiyalarda) olduğunu tapır —
  // products.js-də "Partiya tarixçəsi" bölməsi bunu çağırır.
  function docsForProduct(productId) {
    return getDocs()
      .filter(d => d.items.some(it => it.productId === productId))
      .map(d => {
        const item = d.items.find(it => it.productId === productId);
        return { id: d.id, number: d.number, date: d.date, receivedAt: item ? item.receivedAt : d.date };
      });
  }

  function renderDocsList() {
    const docs = getDocs();
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/receiving')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📦 Mal Qəbulu Sənədləri</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">${docs.length} sənəd — hər "Qəbul Rejimi" sessiyası bitəndə avtomatik yaranır.</p>
      <div class="glass" style="padding:4px 14px;">
        ${docs.length ? docs.map(d => `
          <div class="list-row" style="cursor:pointer;" onclick="JollyRouter.go('#/receiving/docs/${d.id}')">
            <span>📄 Sənəd #${d.number} <span class="muted" style="font-size:11px;">— ${new Date(d.date).toLocaleDateString('az-AZ')}</span></span>
            <span class="muted" style="font-size:11px;">${d.items.length} məhsul ›</span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hələ sənəd yoxdur — bir "Qəbul Rejimi" sessiyasını tamamla.</div>'}
      </div>
    `;
  }

  function renderDocDetail(id) {
    const doc = getDocs().find(d => d.id === id);
    if (!doc) return `<div class="back-btn anim-slide" onclick="JollyRouter.go('#/receiving/docs')">‹ Geri</div><div class="empty-state"><div class="big-icon">📭</div><h3>Sənəd tapılmadı</h3></div>`;
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/receiving/docs')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📄 Sənəd #${doc.number}</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">${new Date(doc.date).toLocaleString('az-AZ')} · ${doc.items.length} məhsul</p>
      <div class="glass" style="padding:4px 14px;">
        ${doc.items.map(it => `
          <div class="list-row" ${it.productId ? `onclick="JollyRouter.go('#/product/${it.productId}')" style="cursor:pointer;"` : ''}>
            <span>${esc(it.name)}</span>
            <span class="muted" style="font-size:11px;">${new Date(it.receivedAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })} ${it.productId ? '›' : ''}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ============================================================
     PICKER (toplu seçim ekranı)
     ============================================================ */
  let selectedSet = new Set();
  let currentFilter = 'all';

  function renderPicker() {
    selectedSet = new Set();
    currentFilter = 'all';
    const basket = getBasket();
    const total = basket.productIds.length;
    const done = Object.keys(basket.received).length;
    const all = JollyDB.Products.all();
    const suppliers = [...new Set(all.map(p => p.supplier).filter(Boolean))];
    const brands = [...new Set(all.map(p => p.brand).filter(Boolean))];
    const groups = [...new Set(all.map(p => p.group).filter(Boolean))];

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🚚 Qəbul Studio</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Yeni gələn malları seç, sonra skanerlə sürətli qəbul et.</p>

      ${total ? `
      <div class="glass" style="padding:14px;margin-bottom:14px;">
        <div class="row between">
          <div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:700;">${done} / ${total}</div>
            <div class="muted" style="font-size:11px;">səbətdə qəbul vəziyyəti ${done < total ? '— sessiya davam edir' : ''}</div>
          </div>
          <div class="row" style="gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="JollyRouter.go('#/receiving/scan')">🚀 Qəbul Rejimi</button>
            <button class="btn btn-ghost btn-sm" onclick="JollyReceiving.clearBasket()">🗑️</button>
          </div>
        </div>
      </div>
      <div class="section-title" style="margin-top:0;">📋 Səbətdəkilər (seçdiyin sıra ilə)</div>
      <div class="glass" id="recvBasketList" style="padding:4px 14px;margin-bottom:14px;max-height:260px;overflow-y:auto;">
        ${renderBasketListRows(basket)}
      </div>
      ` : ''}

      <div class="row" style="margin-bottom:14px;">
        <button class="btn btn-ghost btn-block" onclick="JollyRouter.go('#/receiving/docs')">📦 Mal Qəbulu Sənədləri (partiyalar)</button>
      </div>

      <div class="section-title" style="margin-top:0;">Filtrlə</div>
      <div class="chip-row" id="recvFilterChips" style="margin-bottom:8px;">
        <span class="chip chip-active" data-f="all" onclick="JollyReceiving.setFilter('all', this)">Hamısı</span>
        ${suppliers.map(s => `<span class="chip" data-f="supplier:${esc(s)}" onclick="JollyReceiving.setFilter('supplier:${esc(s)}', this)">🚚 ${esc(s)}</span>`).join('')}
        ${brands.map(b => `<span class="chip" data-f="brand:${esc(b)}" onclick="JollyReceiving.setFilter('brand:${esc(b)}', this)">🏷️ ${esc(b)}</span>`).join('')}
        ${groups.map(g => `<span class="chip" data-f="group:${esc(g)}" onclick="JollyReceiving.setFilter('group:${esc(g)}', this)">📦 ${esc(g)}</span>`).join('')}
      </div>

      <div class="glass command-bar" style="margin-bottom:10px;">
        <span style="opacity:.6">🔎</span>
        <input id="recvSearch" placeholder="Ad, barkod, kod ilə axtar..." oninput="JollyReceiving.debouncedApplyFilter()">
      </div>

      <div class="row" style="gap:8px;margin-bottom:12px;">
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="JollyReceiving.selectAllVisible(true)">☑️ Görünənləri seç</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="JollyReceiving.selectAllVisible(false)">Seçimi təmizlə</button>
      </div>

      <div id="recvGrid" class="product-grid"></div>
      <div style="height:70px;"></div>

      <div id="recvAddBar" style="display:none;position:fixed;bottom:70px;left:14px;right:14px;z-index:60;">
        <button class="btn btn-primary btn-block" style="box-shadow:0 6px 20px rgba(0,0,0,0.4);" onclick="JollyReceiving.addSelectedToBasket()">➕ Səbətə əlavə et (<span id="recvSelCount">0</span>)</button>
      </div>
    `;
  }

  // Səbətdəki məhsulları, əlavə olunma SIRASI ilə, SADƏ tək-sətirli siyahı
  // kimi göstərir. Barkodun ŞƏKLİ burda YOXDUR — o, tam başqa yerdə,
  // "Qəbul Rejimi" (skan) kartında göstərilir. Burda yalnız: sıra nömrəsi,
  // kiçik şəkil, ad, son 4 rəqəm. Hər sətir sürüşdürülə bilər (☰ tutacağı).
  function renderBasketListRows(basket) {
    if (!basket.productIds.length) {
      return '<div class="muted" style="padding:12px;">Səbət boşdur</div>';
    }
    return basket.productIds.map((id, i) => {
      const p = JollyDB.Products.get(id);
      if (!p) return '';
      const isDone = !!basket.received[id];
      const barcode = (p.barcodes && p.barcodes[0]) || '';
      const last4 = p.last4 || (barcode ? barcode.slice(-4) : '');
      const thumb = (p.images && p.images[0])
        ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:34px;height:34px;object-fit:cover;border-radius:8px;">`
        : `<div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;">🧴</div>`;

      return `
        <div class="list-row recv-basket-row" draggable="true" data-basket-id="${id}" style="align-items:center;flex-wrap:nowrap;">
          <span style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <span class="recv-drag-handle" style="cursor:grab;padding:4px 2px;color:var(--muted,#888);flex-shrink:0;">☰</span>
            <span class="mono muted" style="font-size:11px;width:16px;flex-shrink:0;">${i + 1}.</span>
            <span style="flex-shrink:0;">${thumb}</span>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">${esc(p.name || 'Adsız məhsul')}</span>
            ${isDone ? '<span style="font-size:10px;color:var(--accent-2);flex-shrink:0;">✓</span>' : ''}
          </span>
          ${barcode ? `<span class="mono muted" style="font-size:10.5px;flex-shrink:0;margin-left:6px;">son4: ${esc(last4)}</span>` : ''}
          <span class="actions" style="flex-shrink:0;">
            <span onclick="JollyReceiving.removeFromBasket('${id}')" style="color:var(--accent-danger);cursor:pointer;padding-left:8px;">✕</span>
          </span>
        </div>
      `;
    }).join('');
  }

  function removeFromBasket(id) {
    const basket = getBasket();
    basket.productIds = basket.productIds.filter(x => x !== id);
    delete basket.received[id];
    setBasket(basket);
    if (typeof JollySound !== 'undefined') JollySound.tap();
    forceReceivingRerender();
  }

  // ── Səbət sırasını sürüşdürərək dəyişmək (drag & drop, mouse + touch) ──
  function getBasketDragAfterEl(container, y) {
    const rows = [...container.querySelectorAll('.list-row[data-basket-id]')].filter(
      r => r.style.opacity !== '0.3' && r.style.opacity !== '0.4'
    );
    return rows.reduce((closest, row) => {
      const box = row.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: row };
      return closest;
    }, { offset: -Infinity }).element;
  }

  function persistBasketOrder() {
    const container = document.getElementById('recvBasketList');
    if (!container) return;
    const ids = [...container.querySelectorAll('.list-row[data-basket-id]')].map(r => r.dataset.basketId);
    const basket = getBasket();
    basket.productIds = ids;
    setBasket(basket);
    // Nömrələri yenilə (1,2,3...) — tam yenidən render etmədən sadəcə say sütununu düzəlt
    container.querySelectorAll('.list-row[data-basket-id]').forEach((row, i) => {
      const numEl = row.querySelector('.mono.muted');
      if (numEl) numEl.textContent = (i + 1) + '.';
    });
  }

  function attachBasketDrag() {
    const container = document.getElementById('recvBasketList');
    if (!container) return;
    let dragEl = null;

    container.querySelectorAll('.list-row[data-basket-id]').forEach(row => {
      row.addEventListener('dragstart', () => { dragEl = row; setTimeout(() => { row.style.opacity = '0.3'; }, 0); });
      row.addEventListener('dragend', () => { row.style.opacity = '1'; persistBasketOrder(); });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        const after = getBasketDragAfterEl(container, e.clientY);
        if (!dragEl) return;
        if (after == null) container.appendChild(dragEl);
        else container.insertBefore(dragEl, after);
      });

      let touchDragging = false;
      const handle = row.querySelector('.recv-drag-handle');
      const startTouch = () => {
        touchDragging = true;
        row.style.opacity = '0.4';
        row.style.background = 'rgba(124,138,255,0.12)';
      };
      if (handle) handle.addEventListener('touchstart', startTouch, { passive: true });
      row.addEventListener('touchmove', (e) => {
        if (!touchDragging) return;
        e.preventDefault();
        const y = e.touches[0].clientY;
        const after = getBasketDragAfterEl(container, y);
        if (after == null) container.appendChild(row);
        else if (after !== row) container.insertBefore(row, after);
      }, { passive: false });
      row.addEventListener('touchend', () => {
        if (!touchDragging) return;
        touchDragging = false;
        row.style.opacity = '1';
        row.style.background = '';
        persistBasketOrder();
      });
    });
  }

  function pickerCard(p, basket) {
    const img = (p.images && p.images[0]) ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'}>` : '🧴';
    const inBasket = basket.productIds.includes(p.id);
    const style = selectedSet.has(p.id)
      ? 'border:2px solid var(--accent-1);box-shadow:0 0 14px rgba(124,138,255,.35);'
      : (inBasket ? 'opacity:0.55;' : '');
    return `
      <div class="glass product-card recv-card" data-id="${p.id}" style="${style}cursor:pointer;" onclick="JollyReceiving.toggleSelect('${p.id}')">
        <div class="thumb">${img}</div>
        <div class="p-name">${esc(p.name || 'Adsız məhsul')}</div>
        <div class="mono muted" style="font-size:10.5px;">${(p.barcodes && p.barcodes[0]) || 'barkod yoxdur'}</div>
        ${inBasket ? '<div class="muted" style="font-size:10px;color:var(--accent-2);margin-top:2px;">✓ səbətdə</div>' : ''}
      </div>
    `;
  }

  function setFilter(f, chipEl) {
    currentFilter = f;
    document.querySelectorAll('#recvFilterChips .chip').forEach(c => c.classList.remove('chip-active'));
    if (chipEl) chipEl.classList.add('chip-active');
    if (typeof JollySound !== 'undefined') JollySound.tap();
    applyFilter();
  }

  // Hər hərfdə deyil, yazmağı dayandırandan ~220ms sonra süzülsün —
  // böyük kataloqlarda hər klikdə tam grid+şəkil yenidən qurulmasının
  // qarşısını alır (donma/gecikmə hissini azaldır).
  let searchDebounceTimer = null;
  function debouncedApplyFilter() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => applyFilter(), 220);
  }

  function applyFilter() {
    const basket = getBasket();
    const q = (document.getElementById('recvSearch') || {}).value || '';
    let list = JollyDB.Products.all();
    if (currentFilter && currentFilter !== 'all') {
      const idx = currentFilter.indexOf(':');
      const key = currentFilter.slice(0, idx);
      const val = currentFilter.slice(idx + 1);
      list = list.filter(p => p[key] === val);
    }
    if (q.trim()) {
      const nq = q.trim().toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(nq) ||
        (p.barcodes || []).some(b => b.includes(q.trim())) ||
        (p.mainCode || '').toLowerCase().includes(nq)
      );
    }
    const grid = document.getElementById('recvGrid');
    if (grid) grid.innerHTML = list.length ? list.map(p => pickerCard(p, basket)).join('') : '<div class="empty-state"><div class="big-icon">📦</div><h3>Nəticə tapılmadı</h3></div>';
    updateAddBar();
  }

  function toggleSelect(id) {
    if (selectedSet.has(id)) selectedSet.delete(id); else selectedSet.add(id);
    const card = document.querySelector(`.recv-card[data-id="${id}"]`);
    if (card) {
      if (selectedSet.has(id)) {
        card.style.border = '2px solid var(--accent-1)';
        card.style.boxShadow = '0 0 14px rgba(124,138,255,.35)';
        card.style.opacity = '1';
      } else {
        card.style.border = '';
        card.style.boxShadow = '';
      }
    }
    if (typeof JollySound !== 'undefined') JollySound.tap();
    updateAddBar();
  }

  function selectAllVisible(on) {
    const cards = [...document.querySelectorAll('#recvGrid .recv-card')];
    cards.forEach(c => {
      const id = c.dataset.id;
      if (on) selectedSet.add(id); else selectedSet.delete(id);
      if (on) { c.style.border = '2px solid var(--accent-1)'; c.style.boxShadow = '0 0 14px rgba(124,138,255,.35)'; }
      else { c.style.border = ''; c.style.boxShadow = ''; }
    });
    updateAddBar();
  }

  function updateAddBar() {
    const bar = document.getElementById('recvAddBar');
    const cnt = document.getElementById('recvSelCount');
    if (cnt) cnt.textContent = selectedSet.size;
    if (bar) bar.style.display = selectedSet.size ? 'block' : 'none';
  }

  function forceReceivingRerender() {
    // JollyRouter eyni hash-ə göndəriləndə səhifəni yeniləmir (hashchange
    // tetiklənmir) — ona görə products.js-də olduğu kimi, bir anlıq başqa
    // hash-ə keçib dərhal geri qayıdırıq ki, məcburi yenidən render olsun.
    window.location.hash = '#/home';
    setTimeout(() => { window.location.hash = '#/receiving'; }, 30);
  }

  function addSelectedToBasket() {
    if (!selectedSet.size) return;
    const basket = getBasket();
    // Seçilmə sırasını qorumaq üçün: köhnə ID-lər + yeni seçilənlər (Set-in
    // öz daxili sırası ilə, seçim ardıcıllığına uyğun) əlavə olunur.
    const newIds = [...selectedSet].filter(id => !basket.productIds.includes(id));
    basket.productIds = [...basket.productIds, ...newIds];
    setBasket(basket);
    Toast.success(`${selectedSet.size} məhsul səbətə əlavə olundu`);
    if (typeof JollySound !== 'undefined') JollySound.success();
    // Təsdiqdən sonra TAM BOŞ, böyük ölçülü vərəqə keçir
    window.location.hash = '#/receiving/sheet';
  }

  /* ============================================================
     TƏSDİQ VƏRƏQİ (Confirmation Sheet) — tam boş səhifə, bütün
     səbətdəki məhsullar sıra ilə, HAMISI BÖYÜK: şəkil, ad, barkod
     nömrəsi+son4, barkodun şəkli. Həm oxumaq, həm skanerlə birbaşa
     vurmaq üçün nəzərdə tutulub.
     ============================================================ */
  function renderConfirmSheet() {
    const basket = getBasket();
    if (!basket.productIds.length) {
      return `<div class="empty-state"><div class="big-icon">📭</div><h3>Səbət boşdur</h3><button class="btn btn-primary" onclick="JollyRouter.go('#/receiving')">‹ Qəbul Studio-ya qayıt</button></div>`;
    }
    const rows = basket.productIds.map((id, i) => {
      const p = JollyDB.Products.get(id);
      if (!p) return '';
      const barcode = (p.barcodes && p.barcodes[0]) || '';
      const last4 = p.last4 || (barcode ? barcode.slice(-4) : '');
      let barcodeImg = null;
      if (barcode) {
        barcodeImg = (typeof JollyBarcodeGen !== 'undefined' && JollyBarcodeGen.toDataURL(barcode)) || (typeof JollyProducts !== 'undefined' && JollyProducts.generateBarcodeImage(barcode));
      }
      const img = (p.images && p.images[0])
        ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:100%;max-height:22vh;object-fit:contain;border-radius:14px;">`
        : '<div style="font-size:60px;text-align:center;padding:16px;">🧴</div>';

      return `
        <div class="glass" style="padding:20px;margin-bottom:16px;text-align:center;">
          <div class="mono muted" style="font-size:12px;margin-bottom:8px;">#${i + 1}</div>
          ${img}
          <div style="font-family:var(--font-display);font-size:22px;font-weight:700;margin-top:14px;">${esc(p.name || 'Adsız')}</div>
          ${p.location ? `<div class="muted" style="font-size:13px;margin-top:2px;">📍 ${esc(p.location)}</div>` : ''}

          ${barcode ? `
            <div style="margin-top:16px;">
              <div class="mono" style="font-size:20px;font-weight:700;">${esc(barcode)}</div>
              <div class="mono" style="font-size:15px;color:var(--accent-2);margin-top:2px;">son 4: ${esc(last4)}</div>
            </div>
            ${barcodeImg ? `
              <div style="background:#fff;border-radius:12px;padding:16px;margin-top:14px;">
                <img src="${barcodeImg}" style="width:100%;max-width:400px;">
              </div>
            ` : ''}
          ` : '<div class="muted" style="margin-top:14px;">Barkod yoxdur</div>'}
        </div>
      `;
    }).join('');

    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/receiving')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📋 Təsdiq Vərəqi</h2>
      <p class="muted" style="font-size:12px;margin:0 0 16px;">${basket.productIds.length} məhsul, seçdiyin sıra ilə. Barkodları birbaşa skanerlə vur.</p>
      ${rows}
      <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="JollyRouter.go('#/receiving/scan')">🚀 Qəbul Rejiminə keç</button>
      <div style="height:30px;"></div>
    `;
  }

  function clearBasket() {
    if (!confirm('Bütün qəbul səbəti təmizlənsin? (Qəbul edilməmiş məhsullar da silinəcək siyahıdan)')) return;
    setBasket({ productIds: [], received: {}, startedAt: null });
    Toast.info('Səbət təmizləndi');
    forceReceivingRerender();
  }

  function attachPickerHandlers() {
    applyFilter();
    attachBasketDrag();
  }

  /* ============================================================
     TURBO RECEIVING MODE (skan rejimi)
     ============================================================ */
  function renderScanMode() {
    const basket = getBasket();
    if (!basket.productIds.length) {
      return `<div class="back-btn anim-slide" onclick="JollyRouter.go('#/receiving')">‹ Geri</div><div class="empty-state"><div class="big-icon">📭</div><h3>Səbət boşdur</h3><p>Əvvəlcə "Qəbul Studio"da məhsul seç.</p></div>`;
    }
    return `
      <div id="recvScanRoot">
        <div class="row between" style="margin-bottom:10px;">
          <span class="back-btn" style="position:static;" onclick="JollyRouter.go('#/receiving')">‹ Geri</span>
          <span id="recvCounter" class="mono" style="font-weight:700;font-size:16px;"></span>
        </div>
        <div id="recvFlash" class="recv-flash" style="text-align:center;font-weight:700;padding:10px;border-radius:12px;margin-bottom:10px;min-height:20px;transition:background .2s;"></div>
        <div id="recvCardZone"></div>

        <div id="recvUnknownHint" class="muted mono" style="display:none;text-align:center;font-size:11.5px;margin-top:8px;"></div>
        <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="JollyReceiving.captureUnknown()">📷 Yeni/kodsuz mal — şəklini çək (<span id="recvNewCount">0</span>)</button>

        <div class="row" style="gap:10px;margin-top:10px;">
          <button class="btn btn-ghost btn-block" onclick="JollyReceiving.finishSession()">🏁 Sessiyanı bitir</button>
        </div>
        <input id="recvCapture" inputmode="numeric" autocomplete="off" style="position:fixed;opacity:0;height:1px;width:1px;top:0;left:0;pointer-events:none;">
      </div>
    `;
  }

  function currentTargetId(basket) {
    return basket.productIds.find(id => !basket.received[id]);
  }

  function renderCardZoneNow() {
    const basket = getBasket();
    const zone = document.getElementById('recvCardZone');
    if (!zone) return;
    updateCounter(basket);
    const targetId = currentTargetId(basket);
    if (!targetId) {
      zone.innerHTML = renderCompletionHtml(basket);
      return;
    }
    const p = JollyDB.Products.get(targetId);
    if (!p) { zone.innerHTML = '<div class="empty-state"><h3>Məhsul tapılmadı</h3></div>'; return; }
    const barcode = (p.barcodes && p.barcodes[0]) || '';
    const last4 = p.last4 || (barcode ? barcode.slice(-4) : '');
    let barcodeImg = null;
    if (barcode) {
      barcodeImg = (typeof JollyBarcodeGen !== 'undefined' && JollyBarcodeGen.toDataURL(barcode)) || (typeof JollyProducts !== 'undefined' && JollyProducts.generateBarcodeImage(barcode));
    }
    const img = (p.images && p.images[0])
      ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:100%;max-height:26vh;object-fit:contain;border-radius:14px;">`
      : '<div style="font-size:60px;text-align:center;padding:16px;">🧴</div>';
    zone.innerHTML = `
      <div class="glass" style="padding:18px;text-align:center;">

        <div class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">1. Məhsulun şəkli</div>
        ${img}

        <div class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;margin-top:16px;margin-bottom:4px;">2. Məhsulun adı</div>
        <div style="font-family:var(--font-display);font-size:20px;font-weight:700;">${esc(p.name || 'Adsız')}</div>
        ${p.location ? `<div class="muted" style="font-size:12px;margin-top:2px;">📍 ${esc(p.location)}</div>` : ''}

        <div class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;margin-top:16px;margin-bottom:4px;">3. Barkodun nömrələri</div>
        ${barcode ? `
          <div class="row" style="justify-content:center;gap:14px;align-items:baseline;">
            <div class="mono" style="font-size:16px;font-weight:700;">${esc(barcode)}</div>
            <div class="mono" style="font-size:13px;color:var(--accent-2);background:rgba(41,224,201,0.12);padding:2px 10px;border-radius:8px;">son 4: ${esc(last4)}</div>
          </div>
        ` : '<div class="muted">Barkod yoxdur</div>'}

        ${barcodeImg ? `
        <div class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;margin-top:16px;margin-bottom:4px;">4. Barkodun şəkli (skaner üçün)</div>
        <div style="background:#fff;border-radius:10px;padding:12px;">
            <img src="${barcodeImg}" style="width:100%;max-width:320px;">
          </div>` : ''}
      </div>
    `;
  }

  function updateCounter(basket) {
    const el = document.getElementById('recvCounter');
    if (!el) return;
    const total = basket.productIds.length;
    const done = Object.keys(basket.received).length;
    el.textContent = `${done} / ${total}`;
  }

  function flash(type, msg) {
    const el = document.getElementById('recvFlash');
    if (!el) return;
    const colors = { ok: 'rgba(41,224,201,0.25)', wrong: 'rgba(255,92,108,0.35)', dup: 'rgba(255,184,77,0.3)' };
    el.style.background = colors[type] || '';
    el.textContent = msg;
    const settings = JollyDB.getSettings();
    if (navigator.vibrate && settings.vibrateEnabled !== false) {
      navigator.vibrate(type === 'ok' ? 60 : [80, 50, 80]);
    }
    if (typeof JollySound !== 'undefined') {
      if (type === 'ok' && JollySound.success) JollySound.success();
      else if (JollySound.error) JollySound.error();
    }
    setTimeout(() => { if (el) { el.style.background = ''; el.textContent = ''; } }, 900);
  }

  let lastUnknownBarcode = null;

  function processScan(raw) {
    const code = (raw || '').replace(/\D/g, '');
    if (!code) return;
    const basket = getBasket();
    const matches = JollyDB.Products.findByBarcode(code);
    if (!matches.length) {
      lastUnknownBarcode = code;
      flash('wrong', '❌ Bu barkod bazada tapılmadı — 📷 ilə tez qeyd et');
      updateUnknownHint();
      return;
    }
    const product = matches.find(p => basket.productIds.includes(p.id));
    if (!product) { flash('wrong', '⚠️ Bu barkod səbətdə yoxdur'); return; }
    if (basket.received[product.id]) { flash('dup', `🔴 "${product.name}" artıq qəbul edilib`); return; }

    lastUnknownBarcode = null;
    updateUnknownHint();
    if (!basket.startedAt) basket.startedAt = Date.now();
    basket.received[product.id] = Date.now();
    setBasket(basket);
    flash('ok', `✔️ "${product.name}" qəbul edildi`);
    updateCounter(basket);

    // Smart Queue + Turbo: 0.5 saniyə sonra avtomatik növbəti məhsula keç
    setTimeout(() => { renderCardZoneNow(); }, 500);
  }

  function updateUnknownHint() {
    const el = document.getElementById('recvUnknownHint');
    if (!el) return;
    el.style.display = lastUnknownBarcode ? 'block' : 'none';
    if (lastUnknownBarcode) el.textContent = `Naməlum barkod: ${lastUnknownBarcode}`;
  }

  // Sistemdə olmayan yeni malın şəklini çək → "Gələn Mallar"a (qaralama) at
  function captureUnknown() {
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
        const draft = JollyDB.Drafts.add({
          name: '', images: [img],
          barcodes: lastUnknownBarcode ? [lastUnknownBarcode] : [],
          price: '', createdAt: Date.now(),
        });
        const basket = getBasket();
        basket.newDrafts = basket.newDrafts || [];
        basket.newDrafts.push(draft.id);
        setBasket(basket);
        if (typeof JollySound !== 'undefined') JollySound.success();
        Toast.success('Şəkil çəkildi — "Gələn Mallar"a düşdü, sonra tamamla');
        lastUnknownBarcode = null;
        updateUnknownHint();
        updateNewCounter(basket);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function updateNewCounter(basket) {
    const el = document.getElementById('recvNewCount');
    if (el) el.textContent = (basket.newDrafts || []).length;
  }

  function fmtDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min} dəq ${sec} san`;
  }

  function renderCompletionHtml(basket) {
    const elapsed = basket.startedAt ? (Date.now() - basket.startedAt) : 0;
    const hours = elapsed / 3.6e6;
    const doneCount = Object.keys(basket.received).length;
    const speed = hours > 0.001 ? Math.round(doneCount / hours) : 0;
    const missing = basket.productIds.filter(id => !basket.received[id]).map(id => JollyDB.Products.get(id)).filter(Boolean);
    const newCount = (basket.newDrafts || []).length;
    return `
      <div class="glass" style="padding:22px;text-align:center;">
        <div style="font-size:46px;">${missing.length ? '⚠️' : '🎉'}</div>
        <div style="font-family:var(--font-display);font-size:19px;font-weight:700;margin:10px 0 4px;">${missing.length ? missing.length + ' məhsul çatışmır' : 'Hamısı qəbul edildi!'}</div>
        <div class="muted" style="font-size:12.5px;">⏱️ ${fmtDuration(elapsed)} · ⚡ ${speed} məhsul/saat</div>
        ${newCount ? `<div class="muted" style="font-size:12px;margin-top:4px;color:var(--accent-2);">📷 ${newCount} yeni mal "Gələn Mallar"da tamamlanmağı gözləyir</div>` : ''}
        ${missing.length ? `
          <div class="section-title" style="text-align:left;">Çatışmayan məhsullar</div>
          <div class="glass" style="padding:4px 14px;text-align:left;">
            ${missing.map(m => `<div class="list-row"><span>${esc(m.name || 'Adsız')}</span><span class="muted" style="font-size:11px;">çatışmır</span></div>`).join('')}
          </div>
        ` : ''}
        <div class="row" style="gap:10px;margin-top:18px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyReceiving.clearBasketAndExit()">🗑️ Sessiyanı bitir və təmizlə</button>
          <button class="btn btn-primary" style="flex:1;" onclick="JollyRouter.go('#/receiving')">‹ Geri</button>
        </div>
      </div>
    `;
  }

  function finishSession() {
    const zone = document.getElementById('recvCardZone');
    if (zone) zone.innerHTML = renderCompletionHtml(getBasket());
  }

  function clearBasketAndExit() {
    const basket = getBasket();
    const receivedIds = Object.keys(basket.received || {});
    if (receivedIds.length) {
      if (window.JollyAuth && !JollyAuth.can('receiving.create')) {
        if (typeof Toast !== 'undefined') Toast.error('🔒 Qəbul sənədi yaratmaq icazən yoxdur');
        JollyRouter.go('#/receiving');
        return;
      }
      const items = receivedIds.map(id => {
        const p = JollyDB.Products.get(id);
        return { productId: id, name: p ? (p.name || 'Adsız') : 'Silinmiş məhsul', receivedAt: basket.received[id] };
      }).sort((a, b) => a.receivedAt - b.receivedAt);
      const doc = {
        id: JollyDB.uid('snd'),
        number: nextDocNumber(),
        date: basket.startedAt || Date.now(),
        finishedAt: Date.now(),
        items,
      };
      saveDoc(doc);
      Toast.success(`📄 Sənəd #${doc.number} yaradıldı — ${items.length} məhsul`);
    } else {
      Toast.info('Sessiya bitdi, səbət təmizləndi');
    }
    setBasket({ productIds: [], received: {}, startedAt: null });
    JollyRouter.go('#/receiving');
  }

  function attachScanMode() {
    renderCardZoneNow();
    updateNewCounter(getBasket());
    const input = document.getElementById('recvCapture');
    if (!input) return;
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value;
        input.value = '';
        processScan(val);
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => { const i = document.getElementById('recvCapture'); if (i) i.focus(); }, 60);
    });
    if (window.__recvFocusInterval) clearInterval(window.__recvFocusInterval);
    window.__recvFocusInterval = setInterval(() => {
      const i = document.getElementById('recvCapture');
      if (i && document.activeElement !== i) i.focus();
    }, 1500);
  }

  /* ============================================================
     Registrasiya
     ============================================================ */
  function afterRenderDispatch() {
    const hash = window.location.hash || '';
    if (hash.indexOf('/receiving/scan') >= 0) attachScanMode();
    else attachPickerHandlers();
  }

  function init() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash || '';
      if (hash.indexOf('/receiving/scan') < 0 && window.__recvFocusInterval) {
        clearInterval(window.__recvFocusInterval);
        window.__recvFocusInterval = null;
      }
    });
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'receiving',
      name: 'Qəbul Studio',
      icon: '🚚',
      route: '#/receiving',
      group: 'Anbar',
      enabled: true,
      render(rest) {
        if (window.JollyAuth && !JollyAuth.can('receiving.view')) {
          if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
          return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
        }
        if (rest === 'scan') return renderScanMode();
        if (rest === 'sheet') return renderConfirmSheet();
        if (rest === 'docs') return renderDocsList();
        if (rest && rest.indexOf('docs/') === 0) return renderDocDetail(rest.slice(5));
        return renderPicker();
      },
      afterRender: afterRenderDispatch,
      init,
    });
  }

  // ── Tək kliklə birbaşa səbətə at (məhsul kartındakı "+" düyməsindən) ──
  // Qəbul Studio-ya girib seçmədən, istənilən yerdən (Ana səhifə, Axtarış və s.)
  // bir toxunuşla məhsulu "Mal Qəbul" səbətinə əlavə edir.
  function quickAddToBasket(id) {
    const basket = getBasket();
    if (basket.productIds.includes(id)) {
      Toast.info('Bu məhsul artıq Qəbul səbətindədir');
      return false;
    }
    basket.productIds.push(id);
    setBasket(basket);
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('📥 Qəbul səbətinə əlavə olundu');
    return true;
  }

  return {
    setFilter, applyFilter, debouncedApplyFilter, toggleSelect, selectAllVisible, addSelectedToBasket, clearBasket,
    removeFromBasket, quickAddToBasket, getBasket,
    finishSession, clearBasketAndExit, captureUnknown,
    docsForProduct,
  };
})();
