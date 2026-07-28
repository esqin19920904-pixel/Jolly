/* ============================================================
   JOLLY Data Doctor — kataloqu avtomatik yoxlayır
   Marşrutu özü tutur: #/data-doctor
   ============================================================ */

const JollyDataDoctor = (() => {
  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s)); }

  /* Yaxın-dublikat barkodlar üçün (bir rəqəm fərqi) */
  let _nearPairs = [];

  const OK_LENGTHS = [8, 12, 13, 14];   // EAN-8, UPC-A, EAN-13, ITF-14

  /* Bir simvol silinmiş bütün variantlar. İki kod bir-birindən
     yalnız bir rəqəmlə fərqlənirsə (əlavə/əskik/dəyişik), onların
     ən azı bir variantı üst-üstə düşür. */
  function _dropVariants(code) {
    const out = [code];
    for (let i = 0; i < code.length; i++) out.push(code.slice(0, i) + code.slice(i + 1));
    return out;
  }

  const IGNORE_KEY = 'jolly_doctor_ignored_pairs';
  function _ignored() { const v = JollyDB.read(IGNORE_KEY, []); return Array.isArray(v) ? v : []; }
  function _pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  function _findNearDuplicates(byBarcode) {
    const codes = Object.keys(byBarcode);
    const index = {};
    codes.forEach(c => _dropVariants(c).forEach(v => { (index[v] = index[v] || []).push(c); }));
    const seen = new Set(_ignored());
    const pairs = [];
    Object.values(index).forEach(group => {
      if (group.length < 2) return;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i], b = group[j];
          if (a === b) continue;
          const key = a < b ? a + '|' + b : b + '|' + a;
          if (seen.has(key)) continue;
          seen.add(key);
          pairs.push({
            a, b,
            aProducts: byBarcode[a] || [],
            bProducts: byBarcode[b] || []
          });
        }
      }
    });
    return pairs;
  }

  /* İki kodun fərqli hissəsini qırmızı göstər */
  function _diffHtml(code, other) {
    let i = 0;
    while (i < code.length && i < other.length && code[i] === other[i]) i++;
    let j = 0;
    while (j < code.length - i && j < other.length - i &&
           code[code.length - 1 - j] === other[other.length - 1 - j]) j++;
    const head = code.slice(0, i);
    const mid = code.slice(i, code.length - j);
    const tail = code.slice(code.length - j);
    return esc(head) +
      (mid ? '<span style="color:#ff5c6c;font-weight:800;">' + esc(mid) + '</span>' : '') +
      esc(tail);
  }

  function scan() {
    const all = JollyDB.Products.all();
    const issues = []; // { icon, label, products: [] }
    const byBarcode = {}, byModel = {};

    all.forEach(p => {
      if (!p.name || !p.name.trim()) push('emptyName', '📛 Adı boş', p);
      if (!p.images || !p.images.length) push('noImage', '🖼️ Şəkilsiz', p);
      if (!p.barcodes || !p.barcodes.length) push('noBarcode', '🧾 Barkodsuz', p);
      if (p.price == null || p.price === '') push('noPrice', '💰 Qiymətsiz', p);
      if (!p.brand) push('noBrand', '🏭 Firmasız', p);
      if (!p.group) push('noGroup', '📦 Qrupsuz', p);
      if (!p.location) push('noLocation', '📍 Yersiz', p);
      if (!p.status) push('noStatus', '🔖 Statussuz', p);
      if (p.last4 && p.barcodes && p.barcodes.length && !p.barcodes.some(b => b.endsWith(p.last4))) push('last4Mismatch', '⚠️ Son 4 rəqəm uyğun gəlmir', p);
      if (p.barcodes && p.barcodes.some(b => !OK_LENGTHS.includes(String(b).replace(/\D/g, '').length))) {
        push('badLength', '📏 Barkodun uzunluğu standart deyil (8/12/13/14 olmalıdır)', p);
      }
      // Heç vaxt skanerdə oxunmamış barkodlar — səhv yazılma ehtimalı yüksəkdir
      if (p.barcodes && p.barcodes.length && JollyDB.Products.isBarcodeVerified &&
          !p.barcodes.some(b => JollyDB.Products.isBarcodeVerified(p, b))) {
        push('unverified', '✎ Barkod heç vaxt skanerdə oxunmayıb', p);
      }
      if (p.barcodes && p.barcodes.length && typeof JollyBarcodeGen !== 'undefined') {
        const badChecksum = p.barcodes.some(b => !JollyBarcodeGen.validate(b).checksumOk);
        if (badChecksum) push('badChecksum', '🧮 Barkod checksum-u səhvdir (skaner oxumaya bilər)', p);
      }
      (p.barcodes || []).forEach(b => { (byBarcode[b] = byBarcode[b] || []).push(p); });
      if (p.extraCodeValue) { (byModel[p.extraCodeValue] = byModel[p.extraCodeValue] || []).push(p); }
    });

    function push(key, label, p) {
      let bucket = issues.find(i => i.key === key);
      if (!bucket) { bucket = { key, label, products: [] }; issues.push(bucket); }
      bucket.products.push(p);
    }

    Object.entries(byBarcode).forEach(([bc, list]) => {
      if (list.length > 1) {
        let bucket = issues.find(i => i.key === 'dupBarcode');
        if (!bucket) { bucket = { key: 'dupBarcode', label: '👯 Eyni barkod', products: [] }; issues.push(bucket); }
        list.forEach(p => bucket.products.push(p));
      }
    });
    Object.entries(byModel).forEach(([m, list]) => {
      if (list.length > 1) {
        let bucket = issues.find(i => i.key === 'dupModel');
        if (!bucket) { bucket = { key: 'dupModel', label: '🧬 Eyni model', products: [] }; issues.push(bucket); }
        list.forEach(p => bucket.products.push(p));
      }
    });

    _nearPairs = _findNearDuplicates(byBarcode);

    return issues.filter(i => i.products.length > 0);
  }

  /* Səhv yazılmış barkodu yerindəcə düzəlt — forma açmadan */
  function fixBarcode(productId, oldCode) {
    if (typeof POS !== 'undefined' && !POS.can('doctor.fix')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Düzəliş icazən yoxdur — Admin-dən istə');
      return;
    }
    const p = JollyDB.Products.get(productId);
    if (!p) return;
    const val = prompt(`"${p.name || 'Adsız'}" üçün düzgün barkod:`, oldCode);
    if (val === null) return;
    const code = String(val).replace(/\D/g, '');
    if (!code) { Toast.error('Rəqəm yaz'); return; }
    if (code === oldCode) return;
    const clash = JollyDB.Products.checkBarcodeConflict
      ? JollyDB.Products.checkBarcodeConflict(code, productId) : null;
    if (clash) { Toast.error('Bu barkod artıq "' + (clash.name || 'başqa məhsul') + '"-dədir'); return; }
    const list = (p.barcodes || []).map(b => String(b) === String(oldCode) ? code : b);
    JollyDB.Products.update(productId, { barcodes: list });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('Barkod düzəldildi');
    _rerender();
  }

  /* İki qeyd əslində EYNİ maldırsa — birləşdir (brain.js-in mövcud
     birləşdirmə məntiqi işlədilir: barkodlar və şəkillər toplanır,
     ikincisi Səbətə atılır, silinmir). */
  function mergePair(idA, idB) {
    if (typeof POS !== 'undefined' && !POS.can('doctor.fix')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Düzəliş icazən yoxdur — Admin-dən istə');
      return;
    }
    const a = JollyDB.Products.get(idA), b = JollyDB.Products.get(idB);
    if (!a || !b) return;
    const keep = confirm(`Hansı saxlanılsın?\n\nOK = "${a.name || 'Adsız'}"\nLəğv = "${b.name || 'Adsız'}"`);
    const primary = keep ? a : b;
    const other = keep ? b : a;
    if (!confirm(`"${other.name || 'Adsız'}" qeydinin barkodu və şəkilləri "${primary.name || 'Adsız'}"-a köçəcək, özü Səbətə atılacaq. Davam?`)) return;
    if (typeof JollyBrain !== 'undefined' && JollyBrain.mergeGroup) {
      JollyBrain.mergeGroup([primary, other], 0);
      return;   // brain.js özü yönləndirir
    }
    // Ehtiyat variant
    const barcodes = [...new Set([...(primary.barcodes || []), ...(other.barcodes || [])])];
    const images = [...(primary.images || [])];
    (other.images || []).forEach(i => { if (!images.includes(i)) images.push(i); });
    JollyDB.Products.update(primary.id, { barcodes, images });
    JollyDB.Trash.moveToTrash(other.id);
    Toast.success('Birləşdirildi');
    _rerender();
  }

  /* "Fərqlidir" — bu cüt bir daha xəbərdarlıqda görünməsin */
  function ignorePair(a, b) {
    if (typeof POS !== 'undefined' && !POS.can('doctor.fix')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Düzəliş icazən yoxdur — Admin-dən istə');
      return;
    }
    const list = _ignored();
    const k = _pairKey(a, b);
    if (!list.includes(k)) list.push(k);
    JollyDB.write(IGNORE_KEY, list);
    Toast.success('Bu cüt artıq xəbərdarlıq vermir');
    _rerender();
  }

  function _rerender() {
    const main = document.getElementById('main');
    if (main) main.innerHTML = render();
    window.scrollTo(0, 0);
  }

  function render() {
    const issues = scan();
    const totalFlags = issues.reduce((s, i) => s + i.products.length, 0);
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🩺 Data Doctor</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 16px;">${(totalFlags || _nearPairs.length) ? `${totalFlags} problem, ${issues.length} kateqoriya${_nearPairs.length ? ` · ${_nearPairs.length} oxşar barkod cütü` : ''}.` : 'Kataloqda problem tapılmadı ✨'}</p>

      ${_nearPairs.length ? `
        <div class="section-title">🔍 Bir rəqəm fərqi ilə oxşar barkodlar <span class="muted">(${_nearPairs.length})</span></div>
        <p class="muted" style="font-size:11.5px;margin:0 0 8px;">Bunlar çox güman ki, səhv yazılıb — fərqli hissə qırmızıdır.</p>
        ${_nearPairs.slice(0, 12).map(pair => `
          <div class="glass" style="padding:12px;margin-bottom:8px;">
            ${[[pair.a, pair.b, pair.aProducts], [pair.b, pair.a, pair.bProducts]].map(([code, other, prods]) => `
              <div style="display:flex;align-items:center;gap:10px;padding:4px 0;">
                <span class="mono" style="font-size:13px;">${_diffHtml(code, other)}</span>
                <span class="muted" style="flex:1;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc((prods[0] && prods[0].name) || 'Adsız')}</span>
                ${prods[0] ? `<span onclick="JollyDataDoctor.fixBarcode('${prods[0].id}','${esc(code)}')" style="color:var(--accent-2);cursor:pointer;font-size:12px;">✏️ Kodu düzəlt</span>` : ''}
              </div>`).join('')}
            ${(pair.aProducts[0] && pair.bProducts[0] && pair.aProducts[0].id !== pair.bProducts[0].id) ? `
              <div style="display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);">
                <button class="btn btn-ghost btn-sm" style="flex:1;font-size:11.5px;" onclick="JollyDataDoctor.mergePair('${pair.aProducts[0].id}','${pair.bProducts[0].id}')">🔀 Eyni maldır — birləşdir</button>
                <button class="btn btn-ghost btn-sm" style="font-size:11.5px;" onclick="JollyDataDoctor.ignorePair('${esc(pair.a)}','${esc(pair.b)}')">Fərqlidir</button>
              </div>` : ''}
          </div>`).join('')}
        ${_nearPairs.length > 12 ? `<div class="muted" style="font-size:11.5px;margin-bottom:10px;">+${_nearPairs.length - 12} cüt daha...</div>` : ''}
      ` : ''}

      ${(!issues.length && !_nearPairs.length) ? `<div class="empty-state"><div class="big-icon">✅</div><h3>Hər şey qaydasındadır!</h3></div>` : issues.map(i => `
        <div class="section-title">${esc(i.label)} <span class="muted">(${i.products.length})</span></div>
        <div class="glass" style="padding:4px 14px;margin-bottom:6px;">
          ${i.products.slice(0, 8).map(p => `
            <div class="list-row">
              <span>${esc(p.name || 'Adsız məhsul')}</span>
              <span class="actions" style="display:flex;gap:10px;">
                <span onclick="JollyRouter.go('#/product/${p.id}')" style="color:var(--accent-1);cursor:pointer;">👁 Aç</span>
                <span onclick="JollyRouter.go('#/product/${p.id}/edit')" style="color:var(--accent-2);cursor:pointer;">✏️ Düzəlt</span>
              </span>
            </div>
          `).join('')}
          ${i.products.length > 8 ? `<div class="muted" style="padding:8px;font-size:11.5px;">+${i.products.length - 8} daha...</div>` : ''}
        </div>
      `).join('')}
    `;
  }

  function tryRenderRoute() {
    if ((window.location.hash || '') !== '#/data-doctor') return;
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = render();
    if (typeof JollyApp !== 'undefined') JollyApp.renderBottomNav();
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', () => setTimeout(tryRenderRoute, 0));
    setTimeout(tryRenderRoute, 0);
  });

  return { render, scan, fixBarcode, mergePair, ignorePair };
})();
