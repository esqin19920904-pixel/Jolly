/* ============================================================
   JOLLY UX Pro — basılı-saxla Quick Actions menyusu
   app.js artıq çağırır: JollyUXPro.initLongPress()
   ============================================================ */

const JollyUXPro = (() => {
  let overlay = null;
  const PRESS_MS = 420;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'qa-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    return overlay;
  }

  function actionsFor(id) {
    const p = JollyDB.Products.get(id);
    if (!p) return [];
    const list = [
      { icon: '👁️', label: 'Aç', run: () => JollyRouter.go('#/product/' + id) },
      { icon: '✏️', label: 'Redaktə et', run: () => JollyRouter.go('#/product/' + id + '/edit') },
      { icon: p.favorite ? '⭐' : '☆', label: p.favorite ? 'Favoridən çıxar' : 'Favoriyə əlavə et', run: () => { JollyDB.toggleFavorite(id); if (typeof JollySound !== 'undefined') JollySound.tap(); JollyApp.render(); } },
    ];
    if (typeof JollyProductPro !== 'undefined') {
      list.push({ icon: '📋', label: 'Klonla', run: () => JollyProductPro.clone(id) });
    }
    if (p.barcodes && p.barcodes.length) {
      list.push({ icon: '🏷️', label: 'Barkodu göstər', run: () => { if (typeof JollyProducts !== 'undefined') JollyProducts.showBarcode(p.barcodes[0]); } });
    }
    list.push({ icon: '🗑️', label: 'Sil', danger: true, run: () => { if (typeof JollyProducts !== 'undefined') JollyProducts.deleteProduct(id); } });
    return list;
  }

  function open(id) {
    const p = JollyDB.Products.get(id);
    if (!p) return;
    ensureOverlay();
    const items = actionsFor(id);
    overlay.innerHTML = `
      <div class="glass qa-sheet">
        <div class="qa-title">${(typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(p.name || 'Məhsul') : p.name)}</div>
        ${items.map((it, i) => `<div class="qa-item ${it.danger ? 'danger' : ''}" data-i="${i}"><span>${it.icon}</span><span>${it.label}</span></div>`).join('')}
      </div>
    `;
    [...overlay.querySelectorAll('.qa-item')].forEach((el, i) => {
      el.addEventListener('click', () => { close(); items[i].run(); });
    });
    requestAnimationFrame(() => overlay.classList.add('on'));
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
  }

  function close() {
    if (overlay) overlay.classList.remove('on');
  }

  /* ---------- Basılı-saxla təyini ---------- */
  function initLongPress() {
    if (window.__jollyUxLongPressBound) return;
    window.__jollyUxLongPressBound = true;
    let timer = null, targetId = null, moved = false;

    function start(e, target) {
      const card = target.closest('.product-card');
      if (!card) return;
      targetId = card.dataset.id;
      moved = false;
      timer = setTimeout(() => {
        if (!moved && targetId) open(targetId);
        timer = null;
      }, PRESS_MS);
    }
    function cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
    }
    function move() { moved = true; cancel(); }

    document.addEventListener('touchstart', (e) => start(e, e.target), { passive: true });
    document.addEventListener('touchend', cancel, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('mousedown', (e) => start(e, e.target));
    document.addEventListener('mouseup', cancel);
  }

  function skeletonHtml(n = 6) {
    return `<div class="product-grid">${Array.from({ length: n }).map(() => `
      <div class="glass product-card skel-card">
        <div class="thumb shimmer" style="background:rgba(255,255,255,0.05);"></div>
        <div class="shimmer" style="height:12px;border-radius:6px;background:rgba(255,255,255,0.05);"></div>
        <div class="shimmer" style="height:10px;width:60%;border-radius:6px;background:rgba(255,255,255,0.05);"></div>
      </div>
    `).join('')}</div>`;
  }

  return { initLongPress, open, close, skeletonHtml };
})();
