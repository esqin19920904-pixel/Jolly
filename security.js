/* ============================================================
   JOLLY Security v3 — Auth + Session + Data Lock
   ============================================================ */
const JollySecurity = (() => {
  const CFG_KEY      = 'jolly_security_cfg';
  const SESSION_KEY  = 'jolly_sec_session';
  const SESSION_TTL  = 8 * 60 * 60 * 1000; // 8 saat

  const SAFE_KEYS = [
    'jolly_security_cfg', 'jolly_sec_session',
    'jolly_theme', 'jolly_settings_ui',
    'jolly_perm_os_v2', 'jolly_perm_os_v2_sig', 'jolly_perm_audit_v2',
  ];

  // ── Konfiqurasiya ─────────────────────────────────────────
  function getCfg() {
    return JollyDB.read(CFG_KEY, {
      enabled: false,
      pinHash: null,
      biometricCredId: null,
      viewerEnabled: false,
      viewerPinHash: null,
      recoveryHash: null,
    });
  }
  function saveCfg(patch) { JollyDB.write(CFG_KEY, { ...getCfg(), ...patch }); }

  // ── PIN hash ──────────────────────────────────────────────
  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  function genCode() {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  }

  // ── Session ───────────────────────────────────────────────
  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return null;
      if (Date.now() - s.at > SESSION_TTL) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch(e) { return null; }
  }
  function setSession(role, user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      role, at: Date.now(),
      userId: user ? user.id : null,
      userName: user ? user.name : null,
    }));
  }
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getRole()    { const s = getSession(); return s ? s.role : null; }
  function isAdmin()    { return getRole() === 'admin'; }
  function isViewer()   { return getRole() === 'user'; }
  function isUnlocked() { return !!getSession(); }

  function can(perm) {
    if (isAdmin()) return true;
    if (window.POS) return POS.can(perm);
    return false;
  }
  window.JollyAuth = { can };

  // ── Badge ─────────────────────────────────────────────────
  function _removeBadges() {
    ['adminBadge','viewerBadge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function _showBadge(role, user) {
    _removeBadges();
    const b = document.createElement('div');
    b.id = role === 'admin' ? 'adminBadge' : 'viewerBadge';
    const isAdm = role === 'admin';
    const label = isAdm ? 'Admin' : (user ? user.name : 'User');
    b.style.cssText = `position:fixed;top:10px;left:12px;z-index:9998;
      background:rgba(10,10,20,0.88);
      border:1px solid ${isAdm ? 'rgba(0,212,255,0.5)' : 'rgba(255,184,77,0.5)'};
      color:${isAdm ? '#00d4ff' : '#fbbf24'};
      padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;
      cursor:pointer;display:flex;align-items:center;gap:6px;
      backdrop-filter:blur(8px);box-shadow:0 2px 12px rgba(0,0,0,0.3);`;
    b.innerHTML = isAdm
      ? '👑 Admin <span style="opacity:0.55;font-size:10px;">| 🔒</span>'
      : `👤 ${label} <span style="opacity:0.55;font-size:10px;">| 🔄</span>`;
    b.title = isAdm ? 'Kilid' : 'İstifadəçi dəyiş';
    b.onclick = () => switchUser();
    document.body.appendChild(b);
  }

  // ── Data lock (User üçün yazma bloku) ─────────────────────
  function _applyDataLock() {
    if (window._jollyDataLocked) return;
    window._jollyDataLocked = true;

    // localStorage bloku
    const _set    = Storage.prototype.setItem;
    const _remove = Storage.prototype.removeItem;
    const _clear  = Storage.prototype.clear;

    function _isSafe(key) { return SAFE_KEYS.some(k => (key||'').startsWith(k)); }

    Storage.prototype.setItem = function(key, val) {
      if (_isSafe(key)) return _set.call(this, key, val);
      if (!isAdmin()) { _deny(); return; }
      return _set.call(this, key, val);
    };
    Storage.prototype.removeItem = function(key) {
      if (_isSafe(key)) return _remove.call(this, key);
      if (!isAdmin()) { _deny(); return; }
      return _remove.call(this, key);
    };
    Storage.prototype.clear = function() {
      if (!isAdmin()) { _deny(); return; }
      return _clear.call(this);
    };

    // IndexedDB bloku
    if (!window._jollyIDBLocked) {
      window._jollyIDBLocked = true;
      const proto = IDBObjectStore.prototype;
      ['delete','put','add','clear'].forEach(method => {
        const orig = proto[method];
        proto[method] = function(...args) {
          if (!isAdmin()) {
            _deny();
            // Boş IDBRequest qaytar ki uygulama çöküşün qarşısı alınsın
            const req = Object.create(IDBRequest.prototype);
            req.readyState = 'done';
            req.result = undefined;
            setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
            return req;
          }
          return orig.apply(this, args);
        };
      });
    }
  }

  function _deny() {
    if (window.Toast) Toast.error('❌ İcazəniz yoxdur');
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  }

  // ── UI gizlətmə (User üçün) ───────────────────────────────
  function _applyViewerUI() {
    // Studios düyməsini gizlət
    try {
      ['#topStudiosBtn','.studios-btn','[onclick*="studios"]','[data-route*="studio"]']
        .forEach(sel => {
          document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
        });
    } catch(e) {}

    // Studio hash-ına giriş bloku
    if ((window.location.hash||'').includes('studio')) {
      if (window.JollyRouter) JollyRouter.go('#/home');
    }

    // POS UI sinxronizasiya
    if (window.POS) POS.syncUI();
  }

  // ── Viewer mode ───────────────────────────────────────────
  function applyViewerMode() {
    if (!isViewer()) return;
    _applyDataLock();
    _applyViewerUI();
    _startObserver();
  }

  let _obs = null;
  function _startObserver() {
    if (_obs) return;
    _obs = new MutationObserver(() => {
      if (isViewer()) _applyViewerUI();
    });
    _obs.observe(document.getElementById('main') || document.body, {
      childList: true, subtree: true,
    });
  }

  window.addEventListener('hashchange', () => {
    if (isViewer()) {
      setTimeout(_applyViewerUI, 100);
    }
  });

  // ── Overlay ilə əlaqə ────────────────────────────────────
  function _pushToOverlay() {
    const cfg = getCfg();
    if (window._jaSetCfg) {
      window._jaSetCfg(cfg, (role, user) => {
        setSession(role, user);
        _showBadge(role, user);
        if (role === 'user') {
          applyViewerMode();
        } else {
          // Admin girdi — POS sync
          if (window.POS) POS.syncUI();
        }
      }, () => {});
    }
  }

  // ── İnit ─────────────────────────────────────────────────
  function init() {
    const cfg = getCfg();
    if (!cfg.enabled) return;

    const session = getSession();
    if (session) {
      const u = (session.userId && window.JollyUsers) ? JollyUsers.get(session.userId) : null;
      _showBadge(session.role, u);
      if (session.role === 'user') {
        setTimeout(() => applyViewerMode(), 300);
      } else if (window.POS) {
        setTimeout(() => POS.syncUI(), 300);
      }
      return;
    }

    // Kilid ekranı göstər
    setTimeout(() => {
      _pushToOverlay();
      if (window.jollyAuthShow) jollyAuthShow();
    }, 200);
  }

  // ── İstifadəçi dəyiş / Kilid ─────────────────────────────
  function switchUser() {
    clearSession();
    _removeBadges();
    if (window._jollyDataLocked) {
      // Data lock-u sıfırla (yenidən admin giriş üçün)
      window._jollyDataLocked = false;
    }
    setTimeout(() => {
      _pushToOverlay();
      if (window.jollyAuthShow) jollyAuthShow();
    }, 100);
  }
  const lockNow = switchUser;

  // ── Security Studio ───────────────────────────────────────
  function renderStudio() {
    if (isViewer()) { if (window.JollyRouter) JollyRouter.go('#/home'); return ''; }
    const cfg = getCfg();
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔐 Security Studio</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Giriş qorunması</p>

      <!-- Aktivləşdirmə -->
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>🔐 Giriş qorunması</span>
          <label><input type="checkbox" ${cfg.enabled ? 'checked' : ''}
            onchange="JollySecurity.toggleEnabled(this.checked)"></label>
        </div>
      </div>

      ${cfg.enabled ? `
      <!-- Admin -->
      <div class="section-title">👑 Admin giriş</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin(false)">
          <span>🔢 Admin PIN ${cfg.pinHash ? '✅' : '—'}</span>
          <span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupBiometric()">
          <span>👆 Barmaq izi ${cfg.biometricCredId ? '✅' : '—'}</span>
          <span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <!-- User -->
      <div class="section-title">👤 User giriş</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>User girişinə icazə ver</span>
          <label><input type="checkbox" ${cfg.viewerEnabled ? 'checked' : ''}
            onchange="JollySecurity.toggleViewer(this.checked)"></label>
        </div>
        ${cfg.viewerEnabled ? `
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin(true)">
          <span>🔢 User PIN ${cfg.viewerPinHash ? '✅' : '—'}</span>
          <span style="color:var(--accent-1);">›</span>
        </div>` : ''}
      </div>

      <!-- Sessiya -->
      <div class="section-title">🔄 Sessiya</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.switchUser()">
          <span>🔄 İstifadəçi dəyiş</span>
          <span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.lockNow()">
          <span>🔒 Kilid</span>
          <span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <!-- Bərpa -->
      <div class="section-title">🗝️ Bərpa</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.genNewRecovery()">
          <span>Yeni bərpa kodu yarat</span>
          <span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <!-- Fəaliyyət jurnalı -->
      <div class="section-title">📊 Fəaliyyət jurnalı</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:10px;" id="activityLogZone">
        <div class="muted" style="padding:12px;font-size:12px;">Yüklənir...</div>
      </div>
      <button class="btn btn-ghost btn-sm btn-block"
        onclick="JollySecurity.clearActivityLog()">🗑️ Jurnalı təmizlə</button>

      <button class="btn btn-ghost btn-block"
        style="margin-top:14px;color:var(--accent-danger);"
        onclick="JollySecurity.disableAll()">🗑️ Bütün qorumanı sil</button>

      ` : `
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">🔓</div>
        <div class="muted" style="font-size:13px;">Giriş qorunması bağlıdır — yuxarıdan aktiv edin</div>
      </div>`}
    `;
  }

  function afterRenderStudio() {
    const zone = document.getElementById('activityLogZone');
    if (!zone) return;
    const FB = 'https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app';
    fetch(`${FB}/jolly_user_activity.json`)
      .then(r => r.json())
      .then(data => {
        if (!zone.isConnected) return;
        if (!data) { zone.innerHTML = '<div class="muted" style="padding:12px;font-size:12px;">Hələ heç bir fəaliyyət yoxdur</div>'; return; }
        const logs = Object.values(data).sort((a,b) => b.ts - a.ts).slice(0, 50);
        zone.innerHTML = logs.map(l => `
          <div class="list-row" style="padding:8px 4px;">
            <span style="font-size:12px;">${l.role === 'user' ? '👤 User' : '👑 Admin'}</span>
            <span style="font-size:11px;color:var(--accent-1);margin-left:8px;">${l.action}</span>
            <span class="muted" style="font-size:10px;margin-left:auto;">${l.date}</span>
          </div>
        `).join('');
      })
      .catch(() => {
        if (zone.isConnected) zone.innerHTML = '<div class="muted" style="padding:12px;font-size:12px;">Jurnal yüklənmədi</div>';
      });
  }

  // ── Qurulma funksiyaları ──────────────────────────────────
  function toggleEnabled(on) {
    if (on) {
      const code = genCode();
      saveCfg({ enabled: true, recoveryHash: simpleHash(code) });
      alert(`✅ Qoruma aktiv edildi!\n\n🗝️ Bərpa kodunuz:\n${code}\n\nBu kodu yazıb saxlayın!`);
    } else {
      if (!confirm('Giriş qorumasını bağlamaq istəyirsiniz?')) return;
      saveCfg({ enabled: false, pinHash: null, viewerPinHash: null, biometricCredId: null });
    }
    JollyRouter.go('#/studios/security');
  }

  function toggleViewer(on) {
    saveCfg({ viewerEnabled: on });
    if (on) setupPin(true);
    else JollyRouter.go('#/studios/security');
  }

  function setupPin(isUser) {
    const ov = document.createElement('div');
    ov.id = 'jsPinSetup';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg-void,#06070d);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
    ov.innerHTML = `
      <h3 style="font-family:var(--font-display);margin:0 0 6px;color:#fff;">
        ${isUser ? '👤 User PIN' : '👑 Admin PIN'}
      </h3>
      <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0 0 20px;" id="jsPinHint">
        PIN daxil edin (4–8 rəqəm)
      </p>
      <div style="width:100%;max-width:280px;">
        <input id="jsPinInp1" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"
          style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;margin-bottom:10px;">
        <input id="jsPinInp2" type="password" inputmode="numeric" maxlength="8" placeholder="Təkrar"
          style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;display:none;margin-bottom:10px;">
        <button onclick="JollySecurity.confirmSetupPin(${isUser})"
          style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#6366f1);border:none;color:#000;font-size:15px;font-weight:700;cursor:pointer;">
          Davam et
        </button>
      </div>
      <div id="jsPinMsg" style="margin-top:12px;font-size:12px;color:#ef4444;min-height:18px;text-align:center;"></div>
      <button onclick="document.getElementById('jsPinSetup').remove();JollyRouter.go('#/studios/security')"
        style="margin-top:14px;background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:13px;">
        Ləğv et
      </button>
    `;
    document.body.appendChild(ov);
    setTimeout(() => { const el = document.getElementById('jsPinInp1'); if (el) el.focus(); }, 100);
  }

  function confirmSetupPin(isUser) {
    const i1 = document.getElementById('jsPinInp1');
    const i2 = document.getElementById('jsPinInp2');
    const msg = document.getElementById('jsPinMsg');
    if (!i2 || i2.style.display === 'none') {
      const v = i1 ? i1.value : '';
      if (v.length < 4) { if (msg) msg.textContent = '❌ Ən azı 4 rəqəm'; return; }
      i1.style.display = 'none';
      i2.style.display = 'block'; i2.focus();
      const hint = document.getElementById('jsPinHint');
      if (hint) hint.textContent = 'PIN-i təkrar daxil edin';
      if (msg) msg.textContent = '';
    } else {
      const v1 = i1 ? i1.value : '', v2 = i2 ? i2.value : '';
      if (v1 !== v2) {
        if (msg) msg.textContent = '❌ PIN uyğun gəlmədi';
        i1.value = ''; i2.value = '';
        i1.style.display = 'block'; i2.style.display = 'none'; i1.focus();
        const hint = document.getElementById('jsPinHint');
        if (hint) hint.textContent = 'PIN daxil edin (4–8 rəqəm)';
        return;
      }
      if (isUser) saveCfg({ viewerPinHash: simpleHash(v1) });
      else saveCfg({ pinHash: simpleHash(v1) });
      document.getElementById('jsPinSetup').remove();
      Toast.success(isUser ? 'User PIN saxlanıldı ✓' : 'Admin PIN saxlanıldı ✓');
      JollyRouter.go('#/studios/security');
    }
  }

  async function setupBiometric() {
    if (!window.PublicKeyCredential) { Toast.error('Bu cihaz biometrik dəstəkləmir'); return; }
    try {
      Toast.info('Barmağınızı sensora toxundurun...');
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'JOLLY Store', id: location.hostname },
          user: { id: new Uint8Array(16), name: 'jolly-admin', displayName: 'JOLLY Admin' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' },
          timeout: 30000,
        },
      });
      if (cred) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        saveCfg({ biometricCredId: credId });
        Toast.success('Barmaq izi qeydiyyatdan keçdi ✓');
        JollyRouter.go('#/studios/security');
      }
    } catch(e) { Toast.error('Barmaq izi qeydiyyat uğursuz oldu'); }
  }

  function genNewRecovery() {
    const code = genCode();
    saveCfg({ recoveryHash: simpleHash(code) });
    alert(`🗝️ Yeni bərpa kodunuz:\n\n${code}\n\nBu kodu yazıb saxlayın!`);
  }

  function disableAll() {
    if (!confirm('Bütün giriş qorumasını silmək istəyirsiniz?')) return;
    JollyDB.write(CFG_KEY, { enabled: false });
    clearSession();
    _removeBadges();
    Toast.success('Qoruma silindi');
    JollyRouter.go('#/studios/security');
  }

  async function clearActivityLog() {
    try {
      const FB = 'https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app';
      await fetch(`${FB}/jolly_user_activity.json`, { method: 'DELETE' });
      Toast.success('Jurnal təmizləndi');
      JollyRouter.go('#/studios/security');
    } catch(e) { Toast.error('Silinmədi'); }
  }

  // ── Modul qeydiyyatı ──────────────────────────────────────
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'security',
      name: 'Security Studio',
      icon: '🔐',
      route: '#/studios/security',
      group: 'Sistem',
      enabled: true,
      render()      { return renderStudio(); },
      afterRender() { afterRenderStudio(); },
    });
  }

  // ── Başlanğıc ─────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 400));
  } else {
    setTimeout(init, 400);
  }

  return {
    init, can,
    isAdmin, isViewer, isUnlocked,
    getRole, getSession, setSession, clearSession,
    applyViewerMode, switchUser, lockNow,
    toggleEnabled, toggleViewer,
    setupPin, confirmSetupPin, setupBiometric,
    genNewRecovery, disableAll, clearActivityLog,
  };
})();
