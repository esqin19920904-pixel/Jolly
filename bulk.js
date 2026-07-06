/* ============================================================
   JOLLY Bulk — toplu seçim və toplu əməllər
   Məhsul grid-i olan hər səhifədə özünü tapıb aktivləşdirir
   ============================================================ */

const JollyBulk = (() => {
  let selecting = false;
  const selected = new Set();

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s)); }

  /* ---------- Toggle düyməsi ---------- */
  function ensureToggleBtn() {
    let btn = document.getElementById('bulkToggleBtn');
    const grid = document.querySelector('.product-grid');
    if (!grid) { if (btn) btn.remove(); return; }
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'bulkToggleBtn';
    btn.className = 'icon-btn';
    btn.title = 'Toplu seç';
    btn.textContent = '☑️';
    btn.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top) + 62px);right:14px;z-index:70;';
    btn.addEventListener('click', toggleMode);
    document.body.appendChild(btn);
    return btn;
  }

  function toggleMode() {
    selecting = !selecting;
    selected.clear();
    if (typeof JollySound !== 'undefined') JollySound.tap();
    refreshCards();
    renderBar();
    const btn = document.getElementById('bulkToggleBtn');
    if (btn) btn.style.background = selecting ? 'var(--accent-1)' : '';
  }

  function refreshCards() {
    document.querySelectorAll('.product-card').forEach(card => {
      let check = card.querySelector('.bulk-check');
      if (selecting) {
        card.style.position = 'relative';
        if (!check) {
          check = document.createElement('div');
          check.className = 'bulk-check';
          card.appendChild(check);
        }
        const id = card.dataset.id;
        check.textContent = selected.has(id) ? '✓' : '';
        check.classList.toggle('on', selected.has(id));
        card.classList.toggle('bulk-selected', selected.has(id));
      } else {
        if (check) check.remove();
        card.classList.remove('bulk-selected');
      }
    });
  }

  function renderBar() {
    let bar = document.getElementById('bulkBar');
    if (!selecting || !selected.size) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulkBar';
      bar.className = 'glass bulk-bar';
      document.body.appendChild(bar);
    }
    bar.innerHTML = `
      <span class="bulk-count">${selected.size} seçildi</span>
      <div class="bulk-actions">
        <button onclick="JollyBulk.bulkFavorite()">⭐</button>
        <button onclick="JollyBulk.bulkStatus()">🔖</button>
        <button onclick="JollyBulk.bulkExport()">⬇️</button>
        <button class="danger" onclick="JollyBulk.bulkDelete()">🗑️</button>
      </div>
    `;
  }

  /* ---------- Klik ələ salma (capture mərhələsi) ---------- */
  function bindClickCapture() {
    if (window.__jollyBulkBound) return;
    window.__jollyBulkBound = true;
    document.addEventListener('click', (e) => {
      if (!selecting) return;
      const card = e.target.closest('.product-card');
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      const id = card.dataset.id;
      if (!id) return;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      if (typeof JollySound !== 'undefined') JollySound.tap();
      refreshCards();
      renderBar();
    }, true);
  }

  /* ---------- Toplu əməllər ---------- */
  function bulkDelete() {
    if (!confirm(`${selected.size} məhsul silinsin? (Səbətə düşəcək)`)) return;
    selected.forEach(id => JollyDB.Trash.moveToTrash(id));
    if (typeof JollySound !== 'undefined') JollySound.warn();
    Toast.success(`${selected.size} məhsul səbətə atıldı`);
    toggleMode();
    JollyApp.render();
  }

  function bulkFavorite() {
    selected.forEach(id => {
      const p = JollyDB.Products.get(id);
      if (p && !p.favorite) JollyDB.toggleFavorite(id);
    });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('Favorilərə əlavə olundu');
    toggleMode();
    JollyApp.render();
  }

  function bulkStatus() {
    const statuses = JollyDB.Statuses.all();
    const names = statuses.map(s => s.name).join(', ');
    const val = prompt(`Yeni status təyin et (${names}):`);
    if (!val) return;
    const match = statuses.find(s => s.name.toLowerCase() === val.trim().toLowerCase());
    if (!match) { Toast.error('Belə status tapılmadı'); return; }
    selected.forEach(id => JollyDB.Products.update(id, { status: match.name }));
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(`${selected.size} məhsula "${match.name}" tətbiq olundu`);
    toggleMode();
    JollyApp.render();
  }

  function bulkExport() {
    const items = [...selected].map(id => JollyDB.Products.get(id)).filter(Boolean);
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `jolly-secilmis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('İxrac edildi');
  }

  /* ---------- Route hook ---------- */
  function onRouteSettled() {
    ensureToggleBtn();
    if (selecting) { refreshCards(); renderBar(); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindClickCapture();
    window.addEventListener('hashchange', () => { selecting = false; selected.clear(); setTimeout(onRouteSettled, 40); });
    setTimeout(onRouteSettled, 60);
  });

  return { bulkDelete, bulkFavorite, bulkStatus, bulkExport };
})();
