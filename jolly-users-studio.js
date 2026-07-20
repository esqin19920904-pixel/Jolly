/**
 * JOLLY — İstifadəçilər Studio
 * Admin bu ekrandan hər işçini (Ad + PIN + Status) idarə edir.
 * Fərdi istifadəçi sisteminin admin tərəfi (jolly-users.js — data qatı).
 */
(function() {
  if (typeof ModuleRegistry === 'undefined') return;

  function _isAdmin() {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return s && s.role === 'admin';
    } catch (e) { return false; }
  }

  function _fmt(ts) {
    return ts ? new Date(ts).toLocaleString('az-AZ') : '—';
  }

  function _row(u) {
    const statusBadge = u.status === 'active'
      ? `<span style="color:#22c55e;font-size:11px;">● Aktiv</span>`
      : `<span style="color:#ef4444;font-size:11px;">● Bloklu</span>`;

    return `
      <div class="glass" style="padding:12px;margin-bottom:8px;border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:600;">${u.name}</div>
            <div style="font-size:11px;color:var(--text-3,#64748b);">
              Son giriş: ${_fmt(u.lastLogin)} &nbsp;•&nbsp; ${statusBadge}
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button onclick="JollyUsersUI.editPin('${u.id}')"
              style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:11px;">
              🔑 PIN
            </button>
            <button onclick="JollyUsersUI.toggleStatus('${u.id}')"
              style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:11px;">
              ${u.status === 'active' ? '🚫 Blokla' : '✅ Aç'}
            </button>
            <button onclick="JollyUsersUI.remove('${u.id}')"
              style="padding:6px 10px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#ef4444;font-size:11px;">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function _draw() {
    const wrap = document.getElementById('jolly-users-wrap');
    if (!wrap) return;
    const users = JollyUsers.list();

    wrap.innerHTML = `
      <h2 style="font-size:19px;margin:0 0 4px;">👥 İstifadəçilər</h2>
      <p style="font-size:12px;color:var(--text-3,#64748b);margin:0 0 16px;">
        Hər işçi üçün ayrıca Ad + PIN. İcazələri "İcazə Mərkəzi"ndən təyin edərsən.
      </p>

      <div class="glass" style="padding:12px;border-radius:12px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">➕ Yeni işçi əlavə et</div>
        <input id="ju-name" type="text" placeholder="Ad (məs. Zülfü)"
          style="width:100%;padding:9px 12px;border-radius:9px;margin-bottom:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;box-sizing:border-box;">
        <input id="ju-pin" type="tel" inputmode="numeric" maxlength="6" placeholder="PIN (min. 4 rəqəm)"
          style="width:100%;padding:9px 12px;border-radius:9px;margin-bottom:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px;box-sizing:border-box;">
        <button onclick="JollyUsersUI.create()"
          style="width:100%;padding:10px;border-radius:9px;background:var(--accent-1,#00d4ff);color:#06070d;font-weight:600;font-size:13px;">
          Əlavə et
        </button>
        <div id="ju-error" style="color:#ef4444;font-size:12px;margin-top:6px;"></div>
      </div>

      <div id="ju-list">
        ${users.length ? users.map(_row).join('') : `<div style="text-align:center;color:var(--text-3,#64748b);padding:24px 0;">Hələ işçi əlavə olunmayıb</div>`}
      </div>
    `;
  }

  window.JollyUsersUI = {
    create() {
      const name = document.getElementById('ju-name').value;
      const pin = document.getElementById('ju-pin').value;
      const errEl = document.getElementById('ju-error');
      const r = JollyUsers.add({ name, pin });
      if (!r.ok) { errEl.textContent = r.error; return; }
      errEl.textContent = '';
      document.getElementById('ju-name').value = '';
      document.getElementById('ju-pin').value = '';
      _draw();
    },
    editPin(id) {
      const pin = prompt('Yeni PIN daxil et (min. 4 rəqəm):');
      if (!pin) return;
      if (pin.length < 4) { alert('PIN ən azı 4 rəqəm olmalıdır'); return; }
      JollyUsers.update(id, { pin });
      _draw();
    },
    toggleStatus(id) {
      const u = JollyUsers.get(id);
      if (!u) return;
      JollyUsers.setStatus(id, u.status === 'active' ? 'blocked' : 'active');
      _draw();
    },
    remove(id) {
      const u = JollyUsers.get(id);
      if (!u) return;
      if (!confirm(`${u.name} silinsin? Bu geri qaytarılmır.`)) return;
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

    afterRender() { _draw(); },
  });

})();
