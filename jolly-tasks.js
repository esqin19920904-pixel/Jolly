/* ============================================================
   JOLLY Tapşırıqlar — işçiyə konkret iş ver
   İndiyə qədər hər şey özün-götür idi: Zülfiqar Fix Mode-u açıb
   nə istəsə onu edirdi. Bu ekran ona konkret iş verir:
   "Daraq qrupunun şəkillərini çək" — və irəliləyiş ÖZÜ hesablanır.

   Vacib fərq: tapşırıq əl ilə "bitdi" işarələnmir. İrəliləyiş canlı
   məlumatdan gəlir — neçə mal hələ də həmin sahəsi boşdur. Yalan
   hesabat mümkün deyil.

   Marşrut: #/tasks
   İcazələr: tasks.view (öz tapşırıqlarını gör) · tasks.assign (tapşırıq ver)
   ============================================================ */
const JollyTasks = (() => {
  const KEY = 'jolly_tasks';

  const TYPES = {
    image:   { icon: '🖼️', label: 'Şəkil çək',    field: 'images' },
    barcode: { icon: '🏷️', label: 'Barkod bağla', field: 'barcodes' },
    price:   { icon: '💰', label: 'Qiymət yaz',   field: 'price' },
    name:    { icon: '📛', label: 'Ad yaz',       field: 'name' },
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _all() { const v = JollyDB.read(KEY, []); return Array.isArray(v) ? v : []; }
  function _save(v) { JollyDB.write(KEY, v); }

  function _canAssign() {
    try { return (typeof POS === 'undefined') ? true : POS.can('tasks.assign'); }
    catch (e) { return false; }
  }

  function _me() {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return s ? { id: s.userId || s.id || '', name: s.name || s.userName || '', role: s.role || '' } : null;
    } catch (e) { return null; }
  }

  function _users() {
    try { return (window.JollyUsers && JollyUsers.all && JollyUsers.all()) || []; }
    catch (e) { return []; }
  }

  /* Tapşırığın əhatəsindəki məhsullar */
  function _scopeProducts(t) {
    let list = JollyDB.Products.all()
      .filter(p => !(JollyDB.isMarkedForDeletion && JollyDB.isMarkedForDeletion(p.id)));
    if (t.group) list = list.filter(p => (p.group || '') === t.group);
    return list;
  }

  function _isMissing(p, type) {
    if (type === 'image') return !p.images || !p.images.length;
    if (type === 'barcode') return !p.barcodes || !p.barcodes.length;
    if (type === 'price') return p.price == null || p.price === '';
    if (type === 'name') return !p.name || !p.name.trim();
    return false;
  }

  /* İrəliləyiş canlı hesablanır — əl ilə işarələmə yoxdur */
  function _progress(t) {
    const list = _scopeProducts(t);
    const total = list.length;
    const left = list.filter(p => _isMissing(p, t.type)).length;
    const done = total - left;
    return { total, left, done, pct: total ? Math.round(done / total * 100) : 100 };
  }

  /* ---------- Ekran ---------- */
  function render() {
    const me = _me();
    const canAssign = _canAssign();
    const tasks = _all().filter(t => !t.archived);
    const mine = me ? tasks.filter(t => t.assignee === me.id) : [];
    const others = tasks.filter(t => !me || t.assignee !== me.id);

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">✅ Tapşırıqlar</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">İrəliləyiş özü hesablanır — nə qədər mal hələ də natamamdırsa, o qədər qalıb.</p>

      ${canAssign ? `<button class="btn btn-primary btn-block" style="margin-bottom:14px;" onclick="JollyTasks.create()">➕ Yeni tapşırıq ver</button>` : ''}

      ${mine.length ? `
        <div class="section-title">👤 Sənin tapşırıqların</div>
        ${mine.map(t => _card(t, true)).join('')}` : ''}

      ${canAssign && others.length ? `
        <div class="section-title">👥 Digərləri</div>
        ${others.map(t => _card(t, false)).join('')}` : ''}

      ${!tasks.length ? `
        <div class="empty-state">
          <div class="big-icon">✅</div>
          <h3>Tapşırıq yoxdur</h3>
          <p class="muted" style="font-size:12px;">${canAssign ? 'Yuxarıdakı düymə ilə birinci tapşırığı ver.' : 'Sənə hələ tapşırıq verilməyib.'}</p>
        </div>` : ''}
    `;
  }

  function _card(t, isMine) {
    const meta = TYPES[t.type] || TYPES.image;
    const pr = _progress(t);
    const who = (_users().find(u => u.id === t.assignee) || {}).name || '—';
    const col = pr.pct >= 100 ? '#4ade80' : pr.pct >= 50 ? '#ffc86b' : '#ff5c6c';
    const canAssign = _canAssign();

    return `
      <div class="glass" style="padding:13px;margin-bottom:9px;${pr.pct >= 100 ? 'border-left:3px solid #4ade80;' : ''}">
        <div style="display:flex;align-items:baseline;gap:9px;">
          <span style="font-size:17px;">${meta.icon}</span>
          <span style="flex:1;font-size:13.5px;font-weight:700;">${esc(meta.label)}${t.group ? ' — ' + esc(t.group) : ' — bütün kataloq'}</span>
          <span style="font-size:15px;font-weight:800;color:${col};">${pr.pct}%</span>
        </div>
        <div class="muted" style="font-size:11px;margin-top:3px;">
          ${pr.left ? `${pr.left} mal qalıb` : 'Tamamlandı 🎉'} · ${pr.total} maldan${isMine ? '' : ' · 👤 ' + esc(who)}
        </div>
        <div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-top:8px;">
          <div style="height:100%;width:${pr.pct}%;background:${col};"></div>
        </div>
        ${t.note ? `<div class="muted" style="font-size:11.5px;margin-top:8px;">📝 ${esc(t.note)}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          ${pr.left ? `<button class="btn btn-primary btn-sm" style="flex:1;min-width:130px;" onclick="JollyTasks.start('${t.id}')">▶️ Başla</button>` : ''}
          ${t.group ? `<button class="btn btn-ghost btn-sm" onclick="JollyRouter.go('#/products?group=${encodeURIComponent(t.group)}')">📦 Siyahı</button>` : ''}
          ${canAssign ? `<button class="btn btn-ghost btn-sm" onclick="JollyTasks.remove('${t.id}')">🗑️</button>` : ''}
        </div>
      </div>`;
  }

  /* Tapşırığa başla — uyğun ekrana aparır */
  function start(id) {
    const t = _all().find(x => x.id === id);
    if (!t) return;
    if (t.group) JollyRouter.go('#/products?group=' + encodeURIComponent(t.group));
    else JollyRouter.go('#/fixmode');
  }

  /* ---------- Yaratma ---------- */
  function create() {
    if (!_canAssign()) { if (typeof Toast !== 'undefined') Toast.error('🔒 Tapşırıq vermək icazən yoxdur'); return; }

    const typeKeys = Object.keys(TYPES);
    const tAns = prompt('Hansı iş?\n\n' + typeKeys.map((k, i) => `${i + 1}. ${TYPES[k].icon} ${TYPES[k].label}`).join('\n') + '\n\nRəqəmi yaz:');
    if (tAns === null) return;
    const type = typeKeys[parseInt(tAns, 10) - 1];
    if (!type) { Toast.error('Düzgün rəqəm yazılmadı'); return; }

    const groups = JollyDB.Groups.all();
    let group = '';
    if (groups.length) {
      const gAns = prompt('Hansı qrup?\n\n0. Bütün kataloq\n' + groups.map((g, i) => `${i + 1}. ${g.name}`).join('\n') + '\n\nRəqəmi yaz:');
      if (gAns === null) return;
      const n = parseInt(gAns, 10);
      if (n > 0) {
        const g = groups[n - 1];
        if (!g) { Toast.error('Düzgün rəqəm yazılmadı'); return; }
        group = g.name;
      }
    }

    const users = _users();
    if (!users.length) { Toast.error('İşçi yoxdur — Security Studio-dan əlavə et'); return; }
    const uAns = prompt('Kimə?\n\n' + users.map((u, i) => `${i + 1}. ${u.name}`).join('\n') + '\n\nRəqəmi yaz:');
    if (uAns === null) return;
    const user = users[parseInt(uAns, 10) - 1];
    if (!user) { Toast.error('Düzgün rəqəm yazılmadı'); return; }

    const note = prompt('Qeyd (istəyə bağlı):', '');
    if (note === null) return;

    const me = _me();
    const list = _all();
    list.unshift({
      id: 'tsk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type, group,
      assignee: user.id,
      note: (note || '').trim(),
      createdAt: Date.now(),
      createdBy: (me && me.name) || 'Admin'
    });
    _save(list);
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(`Tapşırıq verildi: ${user.name}`);
    refresh();
  }

  function remove(id) {
    if (!_canAssign()) return;
    if (!confirm('Bu tapşırıq silinsin?')) return;
    _save(_all().filter(t => t.id !== id));
    Toast.success('Silindi');
    refresh();
  }

  function refresh() {
    const main = document.getElementById('main');
    if (main) { main.innerHTML = render(); window.scrollTo(0, 0); }
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'tasks',
      perm: 'tasks.view',
      name: 'Tapşırıqlar',
      icon: '✅',
      route: '#/tasks',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
    });
  }

  return { render, refresh, create, remove, start };
})();
