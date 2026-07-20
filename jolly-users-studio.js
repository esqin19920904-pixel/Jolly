/**
 * JOLLY — İstifadəçilər Studio (v2, yığcam dizayn)
 * Admin bu ekrandan hər işçini (Ad + PIN + Status) idarə edir.
 * Fərdi istifadəçi sisteminin admin tərəfi (jolly-users.js — data qatı).
 */
(function() {
  if (typeof ModuleRegistry === 'undefined') return;

  let _menuOpenId = null; // hansı istifadəçinin ••• menyusu açıqdır

  function _isAdmin() {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return s && s.role === 'admin';
    } catch (e) { return false; }
  }

  function _fmt(ts) {
    if (!ts) return 'Hələ giriş yoxdur';
    const d = new Date(ts);
    return d.toLocaleDateString('az-AZ') + ' ' + d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
  }

  function _initials(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  function _row(u) {
    const active = u.status === 'active';
    const menuOpen = _menuOpenId === u.id;
    return `
      <div class="ju-row">
        <div class="ju-avatar" style="background:${active ? 'linear-gradient(135deg,#00d4ff,#6366f1)' : 'rgba(255,255,255,0.08)'};">
          ${_initials(u.name)}
        </div>
        <div class="ju-info">
          <div class="ju-name">${u.name}</div>
          <div class="ju-meta">
            <span class="ju-dot" style="background:${active ? '#22c55e' : '#ef4444'};"></span>
            ${active ? 'Aktiv' : 'Bloklu'} · ${_fmt(u.lastLogin)}
          </div>
        </div>
        <div class="ju-menu-wrap">
          <button class="ju-more-btn" onclick="JollyUsersUI.toggleMenu('${u.id}')">⋯</button>
          ${menuOpen ? `
            <div class="ju-menu">
              <div class="ju-menu-item" onclick="JollyUsersUI.editPin('${u.id}')">🔑 PIN dəyiş</div>
              <div class="ju-menu-item" onclick="JollyRouter.go('#/studios/permissions')">🛡️ İcazələr</div>
              <div class="ju-menu-item" onclick="JollyUsersUI.toggleStatus('${u.id}')">${active ? '🚫 Blokla' : '✅ Aktiv et'}</div>
              <div class="ju-menu-item ju-danger" onclick="JollyUsersUI.remove('${u.id}')">🗑️ Sil</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function _draw() {
    const wrap = document.getElementById('jolly-users-wrap');
    if (!wrap) return;
    const users = JollyUsers.list();

    wrap.innerHTML = `
      <style>
        .ju-row { display:flex; align-items:center; gap:12px; padding:10px 4px; border-bottom:1px solid rgba(255,255,255,0.06); position:relative; }
        .ju-row:last-child { border-bottom:none; }
        .ju-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; color:#fff; flex-shrink:0; }
        .ju-info { flex:1; min-width:0; }
        .ju-name { font-size:14px; font-weight:600; color:#fff; }
        .ju-meta { font-size:11px; color:rgba(255,255,255,0.4); display:flex; align-items:center; gap:5px; margin-top:1px; }
        .ju-dot { width:6px; height:6px; border-radius:50%; display:inline-block; }
        .ju-more-btn { width:30px; height:30px; border-radius:8px; background:rgba(255,255,255,0.05); border:none; color:rgba(255,255,255,0.6); font-size:16px; line-height:1; }
        .ju-menu-wrap { position:relative; }
        .ju-menu { position:absolute; right:0; top:34px; z-index:20; background:#181924; border:1px solid rgba(255,255,255,0.1); border-radius:12px; overflow:hidden; min-width:160px; box-shadow:0 8px 24px rgba(0,0,0,0.4); }
        .ju-menu-item { padding:11px 14px; font-size:13px; color:#fff; white-space:nowrap; }
        .ju-menu-item:active { background:rgba(255,255,255,0.06); }
        .ju-danger { color:#ef4444; }
        .ju-add-toggle { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:11px; border-radius:10px; background:rgba(0,212,255,0.08); border:1px dashed rgba(0,212,255,0.3); color:#00d4ff; font-size:13px; font-weight:600; margin-bottom:14px; }
        .ju-add-form { background:rgba(255,255,255,0.03); border-radius:12px; padding:14px; margin-bottom:16px; }
        .ju-add-form input { width:100%; padding:9px 12px; border-radius:9px; margin-bottom:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); color:#fff; font-size:13px; box-sizing:border-box; }
      </style>

      <h2 style="font-size:18px;margin:0 0 2px;">👥 İstifadəçilər</h2>
      <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0 0 14px;">
        İcazələri "İcazə Mərkəzi"ndən təyin edərsən
      </p>

      <div id="ju-add-toggle-wrap">
        <button class="ju-add-toggle" onclick="JollyUsersUI.toggleAddForm()">+ Yeni işçi</button>
      </div>
      <div id="ju-add-form-wrap" style="display:none;"></div>

      <div id="ju-list">
        ${users.length ? users.map(_row).join('') : `<div style="text-align:center;color:rgba(255,255,255,0.35);padding:28px 0;font-size:13px;">Hələ işçi əlavə olunmayıb</div>`}
      </div>
    `;
  }

  function _drawAddForm() {
    const formWrap = document.getElementById('ju-add-form-wrap');
    formWrap.innerHTML = `
      <div class="ju-add-form">
        <input id="ju-name" type="text" placeholder="Ad (məs. Zülfü)">
        <input id="ju-pin" type="tel" inputmode="numeric" maxlength="4" placeholder="PIN (4 rəqəm)">
        <button onclick="JollyUsersUI.create()"
          style="width:100%;padding:10px;border-radius:9px;background:var(--accent-1,#00d4ff);color:#06070d;font-weight:600;font-size:13px;border:none;">
          Əlavə et
        </button>
        <div id="ju-error" style="color:#ef4444;font-size:12px;margin-top:6px;"></div>
      </div>
    `;
  }

  window.JollyUsersUI = {
    toggleAddForm() {
      const wrap = document.getElementById('ju-add-form-wrap');
      const isHidden = wrap.style.display === 'none';
      if (isHidden) { _drawAddForm(); wrap.style.display = 'block'; }
      else { wrap.style.display = 'none'; }
    },
    toggleMenu(id) {
      _menuOpenId = (_menuOpenId === id) ? null : id;
      _draw();
    },
    create() {
      const name = document.getElementById('ju-name').value;
      const pin = document.getElementById('ju-pin').value;
      const errEl = document.getElementById('ju-error');
      const r = JollyUsers.add({ name, pin });
      if (!r.ok) { errEl.textContent = r.error; return; }
      document.getElementById('ju-add-form-wrap').style.display = 'none';
      _draw();
    },
    editPin(id) {
      _menuOpenId = null;
      const pin = prompt('Yeni PIN daxil et (4 rəqəm):');
      if (!pin) { _draw(); return; }
      if (!/^\d{4}$/.test(pin)) { alert('PIN düz 4 rəqəm olmalıdır'); _draw(); return; }
      JollyUsers.update(id, { pin });
      _draw();
    },
    toggleStatus(id) {
      _menuOpenId = null;
      const u = JollyUsers.get(id);
      if (!u) return;
      JollyUsers.setStatus(id, u.status === 'active' ? 'blocked' : 'active');
      _draw();
    },
    remove(id) {
      _menuOpenId = null;
      const u = JollyUsers.get(id);
      if (!u) return;
      if (!confirm(`${u.name} silinsin? Bu geri qaytarılmır.`)) { _draw(); return; }
      JollyUsers.remove(id);
      _draw();
    },
  };

  ModuleRegistry.register({
    id: 'users-studio',
    name: 'İstifadəçilər',
    icon: '👥',
    route: '#/studios/users',
    group: 'Sistem',
    enabled: true,

    render() {
      if (!_isAdmin()) {
        if (window.JollyRouter) JollyRouter.go('#/home');
        return '';
      }
      return `
        <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
        <div id="jolly-users-wrap"></div>
      `;
    },

    afterRender() { _menuOpenId = null; _draw(); },
  });

})();
