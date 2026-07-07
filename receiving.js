/* ============================================================
   JOLLY Receiving Studio — Qəbul Studio
   Yeni gələn malları seç → səbətə at → skanerlə Turbo Qəbul Rejimi
   Özü-özünü ModuleRegistry-ə qeydiyyatdan keçirir (#/receiving).
   ============================================================ */

const JollyReceiving = (() => {
  const BASKET_KEY = 'jolly_receiving_basket';

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function getBasket() {
    return JollyDB.read(BASKET_KEY, { productIds: [], received: {}, startedAt: null });
  }
  function setBasket(b) { JollyDB.write(BASKET_KEY, b); }

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
      </div>` : ''}

      <div class="section-title" style="margin-top:0;">Filtrlə</div>
      <div class="chip-row" id="recvFilterChips" style="margin-bottom:8px;">
        <span class="chip chip-active" data-f="all" onclick="JollyReceiving.setFilter('all', this)">Hamısı</span>
        ${suppliers.map(s => `<span class="chip" data-f="supplier:${esc(s)}" onclick="JollyReceiving.setFilter('supplier:${esc(s)}', this)">🚚 ${esc(s)}</span>`).join('')}
        ${brands.map(b => `<span class="chip" data-f="brand:${esc(b)}" onclick="JollyReceiving.setFilter('brand:${esc(b)}', this)">🏷️ ${esc(b)}</span>`).join('')}
        ${groups.map(g => `<span class="chip" data-f="group:${esc(g)}" onclick="JollyReceiving.setFilter('group:${esc(g)}', this)">📦 ${esc(g)}</span>`).join('')}
      </div>

      <div class="glass command-bar" style="margin-bottom:10px;">
        <span style="opacity:.6">🔎</span>
        <input id="recvSearch" placeholder="Ad, barkod, kod ilə axtar..." oninput="JollyReceiving.applyFilter()">
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

  function addSelectedToBasket() {
    if (!selectedSet.size) return;
    const basket = getBasket();
    basket.productIds = [...new Set([...basket.productIds, ...selectedSet])];
    setBasket(basket);
    Toast.success(`${selectedSet.size} məhsul səbətə əlavə olundu`);
    if (typeof JollySound !== 'undefined') JollySound.success();
    JollyRouter.go('#/receiving');
  }

  function clearBasket() {
    if (!confirm('Bütün qəbul səbəti təmizlənsin? (Qəbul edilməmiş məhsullar da silinəcək siyahıdan)')) return;
    setBasket({ productIds: [], received: {}, startedAt: null });
    Toast.info('Səbət təmizləndi');
    JollyRouter.go('#/receiving');
  }

  function attachPickerHandlers() {
    applyFilter();
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
        <div class="row" style="gap:10px;margin-top:16px;">
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
    let barcodeImg = null;
    if (barcode) {
      barcodeImg = (typeof JollyBarcodeGen !== 'undefined' && JollyBarcodeGen.toDataURL(barcode)) || (typeof JollyProducts !== 'undefined' && JollyProducts.generateBarcodeImage(barcode));
    }
    const img = (p.images && p.images[0])
      ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:100%;max-height:34vh;object-fit:contain;border-radius:14px;">`
      : '<div style="font-size:70px;text-align:center;padding:20px;">🧴</div>';
    zone.innerHTML = `
      <div class="glass" style="padding:18px;text-align:center;">
        ${img}
        <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-top:12px;">${esc(p.name || 'Adsız')}</div>
        ${p.location ? `<div class="muted" style="font-size:12px;margin-top:2px;">📍 ${esc(p.location)}</div>` : ''}
        ${barcodeImg ? `<div style="background:#fff;border-radius:10px;padding:12px;margin-top:14px;">
            <img src="${barcodeImg}" style="width:100%;max-width:320px;">
            <div class="mono" style="color:#000;font-size:17px;font-weight:700;margin-top:6px;">${esc(barcode)}</div>
          </div>` : '<div class="muted" style="margin-top:14px;">Bu məhsulun barkodu yoxdur</div>'}
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

  function processScan(raw) {
    const code = (raw || '').replace(/\D/g, '');
    if (!code) return;
    const basket = getBasket();
    const matches = JollyDB.Products.findByBarcode(code);
    if (!matches.length) { flash('wrong', '❌ Bu barkod bazada tapılmadı'); return; }
    const product = matches.find(p => basket.productIds.includes(p.id));
    if (!product) { flash('wrong', '⚠️ Bu barkod səbətdə yoxdur'); return; }
    if (basket.received[product.id]) { flash('dup', `🔴 "${product.name}" artıq qəbul edilib`); return; }

    if (!basket.startedAt) basket.startedAt = Date.now();
    basket.received[product.id] = Date.now();
    setBasket(basket);
    flash('ok', `✔️ "${product.name}" qəbul edildi`);
    updateCounter(basket);

    // Smart Queue + Turbo: 0.5 saniyə sonra avtomatik növbəti məhsula keç
    setTimeout(() => { renderCardZoneNow(); }, 500);
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
    return `
      <div class="glass" style="padding:22px;text-align:center;">
        <div style="font-size:46px;">${missing.length ? '⚠️' : '🎉'}</div>
        <div style="font-family:var(--font-display);font-size:19px;font-weight:700;margin:10px 0 4px;">${missing.length ? missing.length + ' məhsul çatışmır' : 'Hamısı qəbul edildi!'}</div>
        <div class="muted" style="font-size:12.5px;">⏱️ ${fmtDuration(elapsed)} · ⚡ ${speed} məhsul/saat</div>
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
    setBasket({ productIds: [], received: {}, startedAt: null });
    Toast.info('Sessiya bitdi, səbət təmizləndi');
    JollyRouter.go('#/receiving');
  }

  function attachScanMode() {
    renderCardZoneNow();
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
      render(rest) { return rest === 'scan' ? renderScanMode() : renderPicker(); },
      afterRender: afterRenderDispatch,
      init,
    });
  }

  return {
    setFilter, applyFilter, toggleSelect, selectAllVisible, addSelectedToBasket, clearBasket,
    finishSession, clearBasketAndExit,
  };
})();
