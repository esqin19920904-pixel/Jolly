/* ============================================================
   JOLLY History — tam fəaliyyət jurnalı (Security Studio-dan açılır)
   Router-də yer olmadığı üçün özü #/history marşrutunu tutur
   ============================================================ */

const JollyHistory = (() => {
  const esc = (s) => (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s));

  function iconFor(action) {
    return { add: '➕', update: '✏️', delete: '🗑️', import: '⬆️' }[action] || '•';
  }
  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'indi';
    if (diff < 3600) return Math.floor(diff / 60) + ' dəq əvvəl';
    if (diff < 86400) return Math.floor(diff / 3600) + ' saat əvvəl';
    return Math.floor(diff / 86400) + ' gün əvvəl';
  }

  let filter = 'all';

  function render() {
    const all = JollyDB.getActivity();
    const items = filter === 'all' ? all : all.filter(a => a.action === filter);
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🕘 Fəaliyyət jurnalı</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Son ${all.length} qeyd. Bütün əlavə, dəyişiklik və silmələr.</p>

      <div class="chip-row" style="margin-bottom:14px;" id="histFilterChips">
        ${[['all', 'Hamısı'], ['add', '➕ Əlavə'], ['update', '✏️ Dəyişiklik'], ['delete', '🗑️ Silmə'], ['import', '⬆️ İdxal']].map(([k, l]) =>
          `<span class="chip ${filter === k ? 'selected' : ''}" onclick="JollyHistory.setFilter('${k}')">${l}</span>`
        ).join('')}
      </div>

      <div class="glass" style="padding:6px 16px;">
        ${items.length ? items.map(a => `
          <div class="hist-row">
            <div class="h-ic">${iconFor(a.action)}</div>
            <div class="h-txt">
              <b>${esc(a.entity || '')}</b> — ${esc(a.details || '')}
              <br><span class="muted" style="font-size:11px;">${timeAgo(a.ts)}</span>
            </div>
          </div>
        `).join('') : '<div class="empty-state"><div class="big-icon">🗂️</div><h3>Qeyd yoxdur</h3></div>'}
      </div>
    `;
  }

  function setFilter(f) {
    filter = f;
    JollyRouter.go('#/history');
  }

  /* ---------- Marşrutu özü tutur (router-i "səhifə tapılmadı"-dan qabaqlayır) ---------- */
  function tryRenderRoute() {
    if ((window.location.hash || '') !== '#/history') return;
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = render();
    if (typeof JollyApp !== 'undefined') JollyApp.renderBottomNav();
    window.scrollTo(0, 0);
  }

  function bindRouteHook() {
    window.addEventListener('hashchange', () => setTimeout(tryRenderRoute, 0));
    setTimeout(tryRenderRoute, 0);
  }

  /* Security Studio-dakı "Tam fəaliyyət jurnalı" düyməsini bura yönləndir */
  function patchSecurityLink() {
    if (typeof JollyStudios === 'undefined') return;
    JollyStudios.viewActivityLog = function () { JollyRouter.go('#/history'); };
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindRouteHook();
    setTimeout(patchSecurityLink, 0);
  });

  return { render, setFilter };
})();
