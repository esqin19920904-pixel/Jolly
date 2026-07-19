/* ============================================================
   JOLLY Security — RBAC (Role-Based Access Control)
   ============================================================ */
const JollySecurity = (() => {
  const KEY = 'jolly_security_cfg';
  const SESSION_KEY = 'jolly_sec_session';
  const SESSION_DURATION = 8 * 60 * 60 * 1000;

  // ── İcazə sistemi ──
  const PERMISSIONS = {
    'products.view':    'Məhsullara baxış',
    'products.create':  'Məhsul əlavə et',
    'products.edit':    'Məhsul redaktə et',
    'products.delete':  'Məhsul sil',
    'prices.edit':      'Qiymət dəyiş',
    'settings.view':    'Parametrlərə bax',
    'settings.edit':    'Parametrləri dəyiş',
    'users.manage':     'İstifadəçiləri idarə et',
    'backup.manage':    'Backup/Restore',
    'reports.view':     'Hesabatlara bax',
    'reports.export':   'Hesabat ixrac et',
    'ai.use':           'AI istifadə et',
    'barcode.scan':     'Barkod skan et',
    'print':            'Çap et',
  };

  const ROLES = {
    admin: {
      name: 'Administrator',
      icon: '👑',
      permissions: Object.keys(PERMISSIONS), // hamısı
    },
    user: {
      name: 'User',
      icon: '👤',
      permissions: [
        'products.view', 'barcode.scan', 'print', 'reports.view',
      ],
    },
  };

  // ── Yardımçı funksiyalar ──
  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  function genCode() { return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join(''); }

  function getCfg() {
    return JollyDB.read(KEY, {
      enabled: false,
      pinHash: null, biometricCredId: null,
      viewerPinHash: null, viewerEnabled: false,
      recoveryHash: null,
      customRoles: {}, // gələcək üçün
    });
  }
  function saveCfg(p) { JollyDB.write(KEY, { ...getCfg(), ...p }); }

  // ── Session ──
  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return null;
      if (Date.now() - s.at > SESSION_DURATION) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch (e) { return null; }
  }
  function setSession(role) {
    const perms = (ROLES[role] || ROLES.user).permissions;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, permissions: perms, at: Date.now() }));
  }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

  function getRole() { const s = getSession(); return s ? s.role : null; }
  function isAdmin() { return getRole() === 'admin'; }
  function isViewer() { return getRole() === 'user'; }
  function isUnlocked() { return !!getSession(); }

  // ── Əsas icazə yoxlama ──
  function can(permission) {
    const s = getSession();
    if (!s) return false;
    if (s.role === 'admin') return true;
    return (s.permissions || []).includes(permission);
  }
  window.JollyAuth = { can }; // JOLLY-nin hər yerindən çağırıla bilər

  function deny(msg) {
    const m = msg || '❌ İcazəniz yoxdur';
    if (window.Toast) Toast.error(m);
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    return false;
  }

  // ── Məlumat qatını blokla ──
  const BLOCK_FN_KEYWORDS = [
    'delete','remove','edit','update','save','create','add',
    'import','export','backup','restore','clear','reset','bulk',
    'write','put','insert','modify','change','set'
  ];
  const ALLOW_FN_KEYWORDS = ['view','get','read','fetch','search','find','load','list','open'];
  const SAFE_STORAGE_KEYS = ['jolly_security','jolly_sec_session','jolly_theme','jolly_settings_ui','jolly_perm_os_v2','jolly_perm_os_v2_sig','jolly_perm_audit_v2'];

  function applyDataLock() {
    if (window._jollyDataLocked) return;
    window._jollyDataLocked = true;

    // 1. localStorage bloku
    const _origSet = Storage.prototype.setItem;
    const _origRemove = Storage.prototype.removeItem;
    const _origClear = Storage.prototype.clear;

    Storage.prototype.setItem = function(key, val) {
      if (SAFE_STORAGE_KEYS.some(k => (key||'').includes(k))) return _origSet.call(this, key, val);
      if (!isAdmin()) return deny('❌ Yazma icazəniz yoxdur');
      return _origSet.call(this, key, val);
    };
    Storage.prototype.removeItem = function(key) {
      if (SAFE_STORAGE_KEYS.some(k => (key||'').includes(k))) return _origRemove.call(this, key);
      if (!isAdmin()) return deny('❌ Silmə icazəniz yoxdur');
      return _origRemove.call(this, key);
    };
    Storage.prototype.clear = function() {
      if (!isAdmin()) return deny('❌ İcazəniz yoxdur');
      return _origClear.call(this);
    };

    // 2. IndexedDB bloku
    if (!window._jollyIDBLocked) {
      window._jollyIDBLocked = true;
      const _idbDelete = IDBObjectStore.prototype.delete;
      const _idbPut = IDBObjectStore.prototype.put;
      const _idbAdd = IDBObjectStore.prototype.add;
      const _idbClear = IDBObjectStore.prototype.clear;

      IDBObjectStore.prototype.delete = function(...a) {
        if (!isAdmin()) { deny('❌ Silmə icazəniz yoxdur'); const r = Object.create(IDBRequest.prototype); setTimeout(()=>{if(r.onsuccess)r.onsuccess({target:{result:undefined}})},0); return r; }
        return _idbDelete.apply(this, a);
      };
      IDBObjectStore.prototype.put = function(...a) {
        if (!isAdmin()) { deny('❌ Yazma icazəniz yoxdur'); const r = Object.create(IDBRequest.prototype); setTimeout(()=>{if(r.onsuccess)r.onsuccess({target:{result:undefined}})},0); return r; }
        return _idbPut.apply(this, a);
      };
      IDBObjectStore.prototype.add = function(...a) {
        if (!isAdmin()) { deny('❌ Yazma icazəniz yoxdur'); const r = Object.create(IDBRequest.prototype); setTimeout(()=>{if(r.onsuccess)r.onsuccess({target:{result:undefined}})},0); return r; }
        return _idbAdd.apply(this, a);
      };
      IDBObjectStore.prototype.clear = function(...a) {
        if (!isAdmin()) { deny('❌ İcazəniz yoxdur'); const r = Object.create(IDBRequest.prototype); setTimeout(()=>{if(r.onsuccess)r.onsuccess({target:{result:undefined}})},0); return r; }
        return _idbClear.apply(this, a);
      };
    }

    // 3. Window funksiyalarını kütləvi blokla
    setTimeout(() => {
      Object.getOwnPropertyNames(window).forEach(key => {
        try {
          if (typeof window[key] !== 'function') return;
          if (window[key]._viewerBlocked) return;
          const lower = key.toLowerCase();
          const isBlocked = BLOCK_FN_KEYWORDS.some(k => lower.includes(k));
          const isAllowed = ALLOW_FN_KEYWORDS.some(k => lower.includes(k));
          if (isBlocked && !isAllowed) {
            const orig = window[key];
            window[key] = function(...args) {
              deny('❌ İcazəniz yoxdur');
              return false;
            };
            window[key]._viewerBlocked = true;
          }
        } catch(e) {}
      });
    }, 500);
  }

  // ── UI məhdudiyyətləri ──
  const HIDE_SELECTORS = [
    '#topStudiosBtn', '.studios-btn',
    '[data-route*="studio"]',
    '[onclick*="studio"]',
  ].join(',');

  function applyViewerUI() {
    // Studios düyməsini gizlət
    try { document.querySelectorAll(HIDE_SELECTORS).forEach(el => el.style.display = 'none'); } catch(e){}

    // Badge
    if (!document.getElementById('viewerBadge')) {
      const b = document.createElement('div');
      b.id = 'viewerBadge';
      b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9998;background:rgba(255,184,77,0.15);border:1px solid rgba(255,184,77,0.4);color:#fbbf24;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;pointer-events:none;';
      b.textContent = '👁️ ' + (ROLES.user.name) + ' rejimi';
      document.body.appendChild(b);
    }

    // Studio hash-ına giriş bloku
    if ((window.location.hash||'').includes('studio')) {
      if (window.JollyRouter) JollyRouter.go('#/home');
    }
  }

  function applyViewerMode() {
    if (!isViewer()) return;
    applyDataLock();
    applyViewerUI();
    // POS (PermissionOS) UI sinxronizasiyası
    if (window.POS) {
      POS.syncUI();
      POS.startObserver();
    }
  }

  // MutationObserver
  let _obs = null;
  function startViewerObserver() {
    if (_obs) return;
    _obs = new MutationObserver(() => {
      if (isViewer()) {
        applyViewerUI();
        if (window.POS) POS.syncUI();
      }
    });
    _obs.observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  }

  window.addEventListener('hashchange', () => {
    if (isViewer()) {
      setTimeout(() => applyViewerUI(), 100);
      if ((window.location.hash||'').includes('studio')) {
        if (window.JollyRouter) JollyRouter.go('#/home');
      }
    }
  });

  // Firebase log
  const FB = 'https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app';
  async function getActivityLog() {
    try { const r = await fetch(`${FB}/jolly_user_activity.json`); const d = await r.json(); if(!d) return []; return Object.values(d).sort((a,b)=>b.ts-a.ts).slice(0,100); } catch(e){ return []; }
  }
  async function clearActivityLog() {
    try { await fetch(`${FB}/jolly_user_activity.json`,{method:'DELETE'}); Toast.success('Jurnal təmizləndi'); JollyRouter.go('#/studios/security'); } catch(e){ Toast.error('Silinmədi'); }
  }

  // Overlay-ə cfg ötür
  function pushCfgToOverlay() {
    const cfg = getCfg();
    if (window._jaSetCfg) window._jaSetCfg(cfg, setSession, () => { applyViewerMode(); startViewerObserver(); });
  }

  function init() {
    const cfg = getCfg();
    if (!cfg.enabled) return;
    const session = getSession();
    if (session) {
      if (session.role === 'user') setTimeout(() => { applyViewerMode(); startViewerObserver(); }, 300);
      return;
    }
    setTimeout(() => {
      pushCfgToOverlay();
      if (window.jollyAuthShow) window.jollyAuthShow();
    }, 200);
  }

  // ── Security Studio UI ──
  function renderStudio() {
    if (isViewer()) { if (window.JollyRouter) JollyRouter.go('#/home'); return ''; }
    const cfg = getCfg();
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔐 Security Studio</h2>
      <p class="muted" style="font-size:12px;margin:0 0 16px;">Giriş qorunması və RBAC</p>

      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>🔐 Giriş qorunması</span>
          <label><input type="checkbox" ${cfg.enabled?'checked':''} onchange="JollySecurity.toggleEnabled(this.checked)"></label>
        </div>
      </div>

      ${cfg.enabled ? `
      <div class="section-title">👑 Admin</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin(false)">
          <span>🔢 Admin PIN ${cfg.pinHash?'✅':'—'}</span><span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupBiometric()">
          <span>👆 Barmaq izi ${cfg.biometricCredId?'✅':'—'}</span><span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <div class="section-title">👤 User rejimi</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>User rejiminə icazə ver</span>
          <label><input type="checkbox" ${cfg.viewerEnabled?'checked':''} onchange="JollySecurity.toggleViewer(this.checked)"></label>
        </div>
        ${cfg.viewerEnabled?`
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin(true)">
          <span>🔢 User PIN ${cfg.viewerPinHash?'✅':'—'}</span><span style="color:var(--accent-1);">›</span>
        </div>`:``}
      </div>

      <div class="section-title">🛡️ User İcazələri</div>
      <div class="glass" style="padding:8px 14px;margin-bottom:14px;">
        ${Object.entries(PERMISSIONS).map(([k,v]) => {
          const isUserPerm = ROLES.user.permissions.includes(k);
          const isAdminOnly = !isUserPerm;
          return `<div class="list-row" style="font-size:13px;">
            <span>${isAdminOnly?'🔒':'✅'} ${v}</span>
            <span style="font-size:11px;color:${isAdminOnly?'var(--accent-danger)':'var(--accent-1)'};">${isAdminOnly?'Admin':'User+Admin'}</span>
          </div>`;
        }).join('')}
      </div>

      <div class="section-title">🗝️ Bərpa</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.genNewRecovery()">
          <span>Yeni bərpa kodu yarat</span><span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <div class="section-title">📊 Fəaliyyət jurnalı</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:10px;" id="activityLogZone">
        <div class="muted" style="padding:12px;font-size:12px;">Yüklənir...</div>
      </div>
      <button class="btn btn-ghost btn-sm btn-block" onclick="JollySecurity.clearActivityLog()">🗑️ Jurnalı təmizlə</button>
      <button class="btn btn-ghost btn-block" style="margin-top:14px;color:var(--accent-danger);" onclick="JollySecurity.disableAll()">🗑️ Bütün qorumanı sil</button>
      ` : `
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">🔓</div>
        <div class="muted" style="font-size:12.5px;">Giriş qorunması bağlıdır</div>
      </div>`}
    `;
  }

  function afterRenderStudio() {
    const zone = document.getElementById('activityLogZone');
    if (!zone) return;
    getActivityLog().then(logs => {
      if (!zone.isConnected) return;
      if (!logs.length) { zone.innerHTML = '<div class="muted" style="padding:12px;font-size:12px;">Hələ heç bir fəaliyyət yoxdur</div>'; return; }
      zone.innerHTML = logs.map(l=>`<div class="list-row" style="padding:10px 4px;"><div style="display:flex;gap:8px;width:100%;align-items:center;"><span style="font-size:12px;">${l.role==='user'?'👤 User':'👑 Admin'}</span><span style="font-size:11px;color:var(--accent-1);">${l.action}</span><span class="muted" style="font-size:10px;margin-left:auto;">${l.date}</span></div></div>`).join('');
    });
  }

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
      <h3 style="font-family:var(--font-display);margin:0 0 6px;color:#fff;">${isUser?'👤 User PIN':'👑 Admin PIN'}</h3>
      <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0 0 20px;" id="jsPinHint">PIN daxil edin (4-8 rəqəm)</p>
      <div style="width:100%;max-width:280px;">
        <input id="jsPinInp1" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"
          style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;margin-bottom:10px;">
        <input id="jsPinInp2" type="password" inputmode="numeric" maxlength="8" placeholder="Təkrar"
          style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;display:none;margin-bottom:10px;">
        <button onclick="JollySecurity.confirmSetupPin(${isUser})" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#6366f1);border:none;color:#000;font-size:15px;font-weight:700;cursor:pointer;">Davam et</button>
      </div>
      <div id="jsPinMsg" style="margin-top:12px;font-size:12px;color:#ef4444;min-height:18px;text-align:center;"></div>
      <button onclick="document.getElementById('jsPinSetup').remove();JollyRouter.go('#/studios/security')"
        style="margin-top:14px;background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:13px;">Ləğv et</button>
    `;
    document.body.appendChild(ov);
    setTimeout(() => { const el = document.getElementById('jsPinInp1'); if(el) el.focus(); }, 100);
  }

  function confirmSetupPin(isUser) {
    const i1 = document.getElementById('jsPinInp1');
    const i2 = document.getElementById('jsPinInp2');
    const msg = document.getElementById('jsPinMsg');
    if (!i2 || i2.style.display==='none') {
      const v = i1?i1.value:'';
      if (v.length < 4) { if(msg) msg.textContent='❌ Ən azı 4 rəqəm'; return; }
      i1.style.display='none'; i2.style.display='block'; i2.focus();
      const hint=document.getElementById('jsPinHint'); if(hint) hint.textContent='PIN-i təkrar daxil edin';
      if(msg) msg.textContent='';
    } else {
      const v1=i1?i1.value:'', v2=i2?i2.value:'';
      if (v1!==v2) {
        if(msg) msg.textContent='❌ PIN uyğun gəlmədi';
        i1.value=''; i2.value=''; i1.style.display='block'; i2.style.display='none'; i1.focus();
        const hint=document.getElementById('jsPinHint'); if(hint) hint.textContent='PIN daxil edin (4-8 rəqəm)';
        return;
      }
      if (isUser) saveCfg({ viewerPinHash: simpleHash(v1) });
      else saveCfg({ pinHash: simpleHash(v1) });
      document.getElementById('jsPinSetup').remove();
      Toast.success(isUser?'User PIN saxlanıldı ✓':'Admin PIN saxlanıldı ✓');
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
          timeout: 30000
        }
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
    JollyDB.write(KEY, { enabled: false });
    clearSession();
    Toast.success('Qoruma silindi');
    JollyRouter.go('#/studios/security');
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'security', name: 'Security Studio', icon: '🔐',
      route: '#/studios/security', group: 'Sistem', enabled: true,
      render() { return renderStudio(); },
      afterRender() { afterRenderStudio(); },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 400));
  } else {
    setTimeout(init, 400);
  }

  return {
    init, can, isViewer, isAdmin, isUnlocked,
    clearSession, applyViewerMode, startViewerObserver,
    toggleEnabled, toggleViewer, setupPin, confirmSetupPin,
    setupBiometric, genNewRecovery, disableAll, clearActivityLog,
    ROLES, PERMISSIONS,
  };
})();
