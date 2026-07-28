/* ============================================================
   JOLLY İcazə Önbaxışı — "Zülfiqar nə görür?"
   İcazə Mərkəzində onlarla açar var. Hansının nəyi gizlətdiyini
   yadda saxlamaq çətindir və səhv qurulan icazə yalnız işçi
   şikayət edəndə üzə çıxır.

   Bu ekran işçini seçib ONUN gözü ilə göstərir: hansı ekranlar
   açıqdır, hansı bağlıdır, nə edə bilir, nə edə bilmir.
   HEÇ NƏYİ DƏYİŞMİR — yalnız göstərir.

   Marşrut: #/perm-preview  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollyPermPreview = (() => {
  let _uid = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _users() {
    try { return (window.JollyUsers && JollyUsers.all && JollyUsers.all()) || []; }
    catch (e) { return []; }
  }

  /* Seçilmiş istifadəçi üçün açarın vəziyyəti — POS.can() cari
     istifadəçiyə baxdığı üçün burada resolveFor() işlədilir. */
  function _has(key) {
    try {
      const u = _users().find(x => x.id === _uid);
      if (u && (u.role === 'admin' || u.isAdmin)) return true;   // Admin hər şeyi görür
      return POS.engine.resolveFor(_uid, key);
    } catch (e) { return false; }
  }

  function _modulesOf() {
    try { return POS.reg.mods || []; } catch (e) { return []; }
  }

  function render() {
    if (typeof POS === 'undefined') {
      return `<div class="empty-state"><div class="big-icon">⚠️</div><h3>İcazə sistemi yüklənməyib</h3></div>`;
    }
    const users = _users();
    if (!users.length) {
      return `
        <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
        <div class="empty-state">
          <div class="big-icon">👥</div><h3>Hələ işçi yoxdur</h3>
          <p class="muted" style="font-size:12px;">Security Studio-dan işçi əlavə et.</p>
        </div>`;
    }
    if (!_uid) _uid = (users.find(u => u.role !== 'admin') || users[0]).id;
    const user = users.find(u => u.id === _uid) || users[0];

    /* Ekranlar (ModuleRegistry) */
    const mods = (typeof ModuleRegistry !== 'undefined') ? ModuleRegistry.list() : [];
    const screens = mods.map(m => ({
      icon: m.icon, name: m.name,
      ok: !m.perm ? true : _has(m.perm),
      perm: m.perm || ''
    }));
    const openCount = screens.filter(s => s.ok).length;

    /* Açarlar — modul üzrə */
    let allPerms = [];
    try { allPerms = POS.reg.allPerms(); } catch (e) {}
    const byModule = {};
    _modulesOf().forEach(m => {
      const rows = (m.perms || []).map(p => ({ key: p.key, label: p.label, ok: _has(p.key), tag: p.tag }));
      if (rows.length) byModule[m.name] = { icon: m.icon, rows };
    });
    const okCount = allPerms.filter(p => _has(p.key)).length;

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">👁️ İcazə Önbaxışı</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 12px;">İşçini seç — onun gözü ilə nə göründüyünü gör. Heç nə dəyişmir.</p>

      <div class="glass" style="padding:12px;margin-bottom:12px;">
        <div class="muted" style="font-size:11px;margin-bottom:5px;">İşçi</div>
        <select onchange="JollyPermPreview.pick(this.value)"
                style="width:100%;padding:11px 13px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border-soft);color:var(--text-hi);font-size:14px;">
          ${users.map(u => `<option value="${esc(u.id)}" ${u.id === _uid ? 'selected' : ''}>${esc(u.name)}${(u.role === 'admin' || u.isAdmin) ? ' (Admin)' : ''}</option>`).join('')}
        </select>
        ${(user.role === 'admin' || user.isAdmin)
          ? `<div style="font-size:12px;color:#ffc86b;margin-top:9px;">👑 Admin — bütün ekranlar və əməliyyatlar açıqdır, icazə yoxlanışı tətbiq olunmur.</div>`
          : `<div style="font-size:12.5px;margin-top:9px;">${openCount}/${screens.length} ekran açıq · ${okCount}/${allPerms.length} icazə verilib</div>`}
      </div>

      <div class="section-title">🖥️ Ekranlar</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:12px;">
        ${screens.map(s => `
          <div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);${s.ok ? '' : 'opacity:.55;'}">
            <span style="font-size:14px;">${s.ok ? '✅' : '🔒'}</span>
            <span style="font-size:15px;">${s.icon}</span>
            <span style="flex:1;font-size:12.5px;">${esc(s.name)}</span>
            ${s.perm ? `<span class="muted mono" style="font-size:10px;">${esc(s.perm)}</span>` : `<span class="muted" style="font-size:10px;">hamıya açıq</span>`}
          </div>`).join('')}
      </div>

      <div class="section-title">🔑 Əməliyyatlar</div>
      ${Object.keys(byModule).map(name => {
        const m = byModule[name];
        const on = m.rows.filter(r => r.ok).length;
        return `
          <div class="glass" style="padding:10px 14px;margin-bottom:8px;">
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
              <span>${m.icon}</span>
              <span style="flex:1;font-size:13px;font-weight:700;">${esc(name)}</span>
              <span class="muted" style="font-size:11px;">${on}/${m.rows.length}</span>
            </div>
            ${m.rows.map(r => `
              <div style="display:flex;align-items:center;gap:8px;padding:5px 0;${r.ok ? '' : 'opacity:.55;'}">
                <span style="font-size:12px;">${r.ok ? '✅' : '🔒'}</span>
                <span style="flex:1;font-size:12px;">${esc(r.label)}</span>
              </div>`).join('')}
          </div>`;
      }).join('')}

      <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="JollyRouter.go('#/studios/security')">🔐 İcazə Mərkəzini aç</button>
      <p class="muted" style="font-size:11px;margin-top:10px;">Bu ekran yalnız oxuyur — dəyişiklik İcazə Mərkəzində edilir.</p>
    `;
  }

  function pick(uid) {
    _uid = uid;
    const main = document.getElementById('main');
    if (main) { main.innerHTML = render(); window.scrollTo(0, 0); }
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'perm-preview',
      perm: 'perms.preview',
      name: 'İcazə Önbaxışı',
      icon: '👁️',
      route: '#/perm-preview',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
    });
  }

  return { render, pick };
})();
