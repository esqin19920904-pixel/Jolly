/* ============================================================
   JOLLY Command — Sürətli əmr paləti (yaz-tap)
   Topbar-dakı ⌘ düyməsi ilə açılır (app.js artıq bağlayıb)
   ============================================================ */

const JollyCommand = (() => {
  let overlay = null;

  const STATIC_ITEMS = [
    { icon: '🎛️', label: 'İş masası', route: '#/dashboard', group: 'Naviqasiya' },
    { icon: '🏠', label: 'Ana səhifə / Axtarış', route: '#/home', group: 'Naviqasiya' },
    { icon: '📦', label: 'Bütün məhsullar', route: '#/products', group: 'Naviqasiya' },
    { icon: '📝', label: 'Qaralamalar', route: '#/drafts', group: 'Naviqasiya' },
    { icon: '⭐', label: 'Favorilər', route: '#/dashboard/favorites', group: 'Naviqasiya' },
    { icon: '🗑️', label: 'Səbət', route: '#/dashboard/trash', group: 'Naviqasiya' },
    { icon: '🧠', label: 'AI Brain', route: '#/brain', group: 'Naviqasiya' },
    { icon: '🤖', label: 'JOLLY AI', route: '#/studios/ai', group: 'Naviqasiya' },
    { icon: '📈', label: 'Analitika', route: '#/insight', group: 'Naviqasiya' },
    { icon: '💬', label: 'JOLLY Chat', route: '#/chat', group: 'Naviqasiya' },
    { icon: '📡', label: 'Live Lens (canlı kamera)', route: null, action: () => { if (typeof JollyLiveLens !== 'undefined') JollyLiveLens.open(); }, group: 'Naviqasiya' },
    { icon: '🧠', label: 'AI Brain Studio Pro', route: '#/studios/ai-brain', group: 'Naviqasiya' },
    { icon: '🏛️', label: 'Studios', route: '#/studios', group: 'Naviqasiya' },
    { icon: '➕', label: 'Yeni məhsul əlavə et', route: '#/product/new', group: 'Əməllər' },
    { icon: '🛠️', label: 'Admin Studio', route: '#/studios/admin', group: 'Studios' },
    { icon: '🎨', label: 'Theme Studio', route: '#/studios/theme', group: 'Studios' },
    { icon: '💾', label: 'Data Studio (backup)', route: '#/studios/data', group: 'Studios' },
    { icon: '☁️', label: 'Cloud Studio', route: '#/studios/cloud', group: 'Studios' },
    { icon: '🔐', label: 'Security Studio', route: '#/studios/security', group: 'Studios' },
    { icon: '📊', label: 'Report Studio', route: '#/studios/report', group: 'Studios' },
    { icon: '⚡', label: 'Workflow Studio', route: '#/studios/workflow', group: 'Studios' },
    { icon: '⌨️', label: 'Code Studio', route: '#/studios/code', group: 'Studios' },
    { icon: '🧩', label: 'Modul Studio', route: '#/studios/module', group: 'Studios' },
  ];

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'cmd-overlay';
    overlay.innerHTML = `
      <div class="glass cmd-box">
        <div class="cmd-input-row">
          <span style="opacity:.6;">⌘</span>
          <input id="cmdInput" placeholder="Yaz və tap — məhsul, barkod, studio..." autocomplete="off">
          <span class="cmd-esc" id="cmdEsc">bağla ✕</span>
        </div>
        <div class="cmd-results" id="cmdResults"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hide(); });
    overlay.querySelector('#cmdEsc').addEventListener('click', hide);
    overlay.querySelector('#cmdInput').addEventListener('input', (e) => search(e.target.value));
    overlay.querySelector('#cmdInput').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hide();
    });
    return overlay;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function search(q) {
    const results = document.getElementById('cmdResults');
    const query = (q || '').toLowerCase().trim();
    let productItems = [];
    if (query) {
      productItems = JollyDB.Products.search(query).slice(0, 6).map(p => ({
        icon: '📦', label: p.name || 'Adsız məhsul', sub: p.mainCode || (p.barcodes || [])[0] || '',
        action: () => JollyRouter.go('#/product/' + p.id), group: 'Məhsullar',
      }));
    }
    const staticMatches = STATIC_ITEMS
      .filter(i => !query || i.label.toLowerCase().includes(query))
      .map(i => ({ icon: i.icon, label: i.label, action: i.action || (() => JollyRouter.go(i.route)), group: i.group }));

    const all = [...productItems, ...staticMatches];
    if (!all.length) {
      results.innerHTML = `<div class="cmd-empty">Heç nə tapılmadı 🔍</div>`;
      return;
    }
    const groups = {};
    all.forEach(i => { (groups[i.group] = groups[i.group] || []).push(i); });
    let idx = 0;
    results.innerHTML = Object.entries(groups).map(([g, items]) => `
      <div class="cmd-group">${esc(g)}</div>
      ${items.map(i => {
        const myIdx = idx++;
        return `<div class="cmd-item" data-idx="${myIdx}">
          <span class="ci-ic">${i.icon}</span>
          <span>${esc(i.label)}${i.sub ? `<br><span class="muted mono" style="font-size:11px;">${esc(i.sub)}</span>` : ''}</span>
        </div>`;
      }).join('')}
    `).join('');
    [...results.querySelectorAll('.cmd-item')].forEach((el, i) => {
      el.addEventListener('click', () => { all[i].action(); hide(); });
    });
  }

  function show() {
    ensureOverlay();
    search('');
    overlay.classList.add('on');
    setTimeout(() => {
      const input = document.getElementById('cmdInput');
      if (input) { input.value = ''; input.focus(); }
    }, 50);
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }

  function hide() {
    if (overlay) overlay.classList.remove('on');
  }

  return { show, hide };
})();
