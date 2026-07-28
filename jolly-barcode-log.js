/* ============================================================
   JOLLY Barkod Jurnalı — kim, nə vaxt, hansı barkodu dəyişdi
   Jurnal db.js-də avtomatik yazılır (Products.update/add üzərindən),
   ona görə hansı ekrandan dəyişilməsindən asılı olmayaraq hər şey
   düşür: forma, Fix Mode, Doktor, idxal, Barkod Qovluğu.

   Marşrut: #/barcode-log  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollyBarcodeLog = (() => {
  let filter = 'all';   // all | added | removed | today

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _ago(ts) {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return 'indicə';
    if (m < 60) return m + ' dəq əvvəl';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' saat əvvəl';
    const days = Math.floor(h / 24);
    if (days < 7) return days + ' gün əvvəl';
    return new Date(ts).toLocaleDateString('az-AZ');
  }

  function _entries() {
    let list = (typeof JollyDB !== 'undefined' && JollyDB.getBarcodeLog) ? JollyDB.getBarcodeLog() : [];
    if (filter === 'added') list = list.filter(e => (e.added || []).length);
    if (filter === 'removed') list = list.filter(e => (e.removed || []).length);
    if (filter === 'today') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      list = list.filter(e => e.at >= start.getTime());
    }
    return list;
  }

  function _row(e) {
    const parts = [];
    (e.added || []).forEach(b => parts.push(`<span style="color:#4ade80;">+ <span class="mono">${esc(b)}</span></span>`));
    (e.removed || []).forEach(b => parts.push(`<span style="color:#ff5c6c;">− <span class="mono">${esc(b)}</span></span>`));
    return `
      <div style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <div style="display:flex;align-items:baseline;gap:8px;">
          <span style="flex:1;font-size:13px;font-weight:600;cursor:pointer;"
                onclick="JollyRouter.go('#/product/${e.productId}')">${esc(e.name)}</span>
          <span class="muted" style="font-size:10.5px;white-space:nowrap;">${_ago(e.at)}</span>
        </div>
        <div style="font-size:12px;margin-top:3px;display:flex;flex-wrap:wrap;gap:10px;">${parts.join('')}</div>
        <div class="muted" style="font-size:10.5px;margin-top:3px;">
          ${e.created ? '🆕 yeni məhsul · ' : ''}${esc(e.by || '—')}
        </div>
      </div>`;
  }

  function render() {
    const list = _entries();
    const total = (typeof JollyDB !== 'undefined' && JollyDB.getBarcodeLog) ? JollyDB.getBarcodeLog().length : 0;
    const chip = (k, label) => `<span class="chip" style="cursor:pointer;${filter === k ? 'border-color:var(--accent-1);color:var(--accent-1);' : ''}" onclick="JollyBarcodeLog.setFilter('${k}')">${label}</span>`;

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📜 Barkod Jurnalı</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 12px;">Kim, nə vaxt, hansı barkodu əlavə etdi və ya sildi.</p>

      <div class="row" style="gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        ${chip('all', 'Hamısı')}
        ${chip('today', 'Bu gün')}
        ${chip('added', 'Əlavə olunan')}
        ${chip('removed', 'Silinən')}
      </div>

      ${list.length ? `
        <div class="muted" style="font-size:11.5px;margin-bottom:6px;">${list.length} qeyd</div>
        <div class="glass" style="padding:2px 14px;">${list.slice(0, 150).map(_row).join('')}</div>
        ${list.length > 150 ? `<div class="muted" style="font-size:11px;margin-top:8px;">+${list.length - 150} qeyd daha</div>` : ''}
      ` : `
        <div class="empty-state">
          <div class="big-icon">📜</div>
          <h3>${total ? 'Bu süzgəcdə qeyd yoxdur' : 'Hələ qeyd yoxdur'}</h3>
          <p class="muted" style="font-size:12px;">${total ? 'Başqa süzgəci sına.' : 'Barkod dəyişdikcə burada görünəcək.'}</p>
        </div>`}

      <p class="muted" style="font-size:11px;margin-top:14px;">Son 400 dəyişiklik saxlanılır. Backup-a da düşür.</p>
    `;
  }

  function setFilter(k) {
    filter = k;
    const main = document.getElementById('main');
    if (main) main.innerHTML = render();
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'barcode-log',
      perm: 'barcodelog.view',
      name: 'Barkod Jurnalı',
      icon: '📜',
      route: '#/barcode-log',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
    });
  }

  return { render, setFilter };
})();
