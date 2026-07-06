/* ============================================================
   JOLLY Data Doctor — kataloqu avtomatik yoxlayır
   Marşrutu özü tutur: #/data-doctor
   ============================================================ */

const JollyDataDoctor = (() => {
  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s)); }

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

    return issues.filter(i => i.products.length > 0);
  }

  function render() {
    const issues = scan();
    const totalFlags = issues.reduce((s, i) => s + i.products.length, 0);
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🩺 Data Doctor</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 16px;">${totalFlags ? `${totalFlags} problem tapıldı, ${issues.length} kateqoriyada.` : 'Kataloqda problem tapılmadı ✨'}</p>

      ${!issues.length ? `<div class="empty-state"><div class="big-icon">✅</div><h3>Hər şey qaydasındadır!</h3></div>` : issues.map(i => `
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

  return { render, scan };
})();
