/* ============================================================
   JOLLY Security — Overlay əsaslı, döngüsüz
   ============================================================ */
const JollySecurity = (() => {
  const KEY = 'jolly_security_cfg';
  const SESSION_KEY = 'jolly_sec_session';
  const SESSION_DURATION = 8 * 60 * 60 * 1000;

  function getCfg() {
    return JollyDB.read(KEY, { enabled: false, pinHash: null, viewerPinHash: null, viewerEnabled: false, recoveryHash: null });
  }
  function saveCfg(p) { JollyDB.write(KEY, { ...getCfg(), ...p }); }

  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  function genCode() { return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join(''); }

  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return null;
      if (Date.now() - s.at > SESSION_DURATION) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch (e) { return null; }
  }
  function setSession(role) { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, at: Date.now() })); }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }
  function isViewer() { const s = getSession(); return !!(s && s.role === 'viewer'); }
  function isAdmin() { const s = getSession(); return !!(s && s.role === 'admin'); }
  function isUnlocked() { return !!getSession(); }

  const VIEWER_HIDE = [
    // Düymələr
    '.btn-primary','.rfab-main','#jbdTab',
    // onclick ilə
    '[onclick*="deleteProduct"]','[onclick*="product/new"]',
    '[onclick*="submitForm"]','[onclick*="quickAdd"]',
    '[onclick*="addBarcodeField"]','[onclick*="editProduct"]',
    '[onclick*="copyProduct"]','[onclick*="duplicateProduct"]',
    '[onclick*="removeProduct"]','[onclick*="studios"]',
    '[onclick*="bulkDelete"]','[onclick*="bulkEdit"]',
    // Siniflər
    '.edit-btn','.delete-btn','.copy-btn','.duplicate-btn',
    '.btn-edit','.btn-delete','.btn-danger',
    '.product-actions','.item-actions',
    // Studio düyməsi
    '#topStudiosBtn',
    // Alt nav studio
    '[data-route*="studio"]','[href*="studio"]',
  ].join(',');

  function applyViewerMode() {
    if (!isViewer()) return;

    // Elementləri gizlət
    try {
      document.querySelectorAll(VIEWER_HIDE).forEach(el => {
        el.style.display = 'none';
        el.setAttribute('data-viewer-hidden','1');
      });
    } catch(e) {}

    // Badge
    if (!document.getElementById('viewerBadge')) {
      const b = document.createElement('div');
      b.id = 'viewerBadge';
      b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9998;background:rgba(255,184,77,0.15);border:1px solid rgba(255,184,77,0.4);color:#fbbf24;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;pointer-events:none;';
      b.textContent = '👁️ Yalnız baxış rejimi';
      document.body.appendChild(b);
    }

    // JollyDB-ni blokla — ən etibarlı
    blockJollyDB();
    // Funksiyaları blokla
    blockViewerFunctions();

    // Studio-ya birbaşa giriş bloku
    if (window.location.hash && window.location.hash.includes('studio')) {
      JollyRouter.go('#/home');
    }
  }

  // JollyDB-ni viewer üçün blokla — ən etibarlı yol
  function blockJollyDB() {
    if (!window.JollyDB || window.JollyDB._viewerBlocked) return;

    const _origWrite = JollyDB.write.bind(JollyDB);
    const _origDelete = JollyDB.delete ? JollyDB.delete.bind(JollyDB) : null;
    const _origRemove = JollyDB.remove ? JollyDB.remove.bind(JollyDB) : null;

    const ALLOWED_KEYS = ['jolly_security_cfg','jolly_sec_session'];

    JollyDB.write = function(key, ...args) {
      if (ALLOWED_KEYS.some(k => (key||'').includes(k))) return _origWrite(key, ...args);
      Toast.error('❌ İcazəniz yoxdur');
      if (navigator.vibrate) navigator.vibrate([50,30,50]);
      return false;
    };

    if (_origDelete) {
      JollyDB.delete = function(key, ...args) {
        Toast.error('❌ İcazəniz yoxdur');
        if (navigator.vibrate) navigator.vibrate([50,30,50]);
        return false;
      };
    }

    if (_origRemove) {
      JollyDB.remove = function(key, ...args) {
        Toast.error('❌ İcazəniz yoxdur');
        if (navigator.vibrate) navigator.vibrate([50,30,50]);
        return false;
      };
    }

    // localStorage.setItem-i də blokla
    const _origSetItem = localStorage.setItem.bind(localStorage);
    const _origRemoveItem = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function(key, ...args) {
      if (ALLOWED_KEYS.some(k => (key||'').includes(k))) return _origSetItem(key, ...args);
      // Məhsul açarlarını blokla
      if ((key||'').includes('product') || (key||'').includes('jolly_prod')) {
        Toast.error('❌ İcazəniz yoxdur');
        return false;
      }
      return _origSetItem(key, ...args);
    };
    localStorage.removeItem = function(key, ...args) {
      if (ALLOWED_KEYS.some(k => (key||'').includes(k))) return _origRemoveItem(key, ...args);
      if ((key||'').includes('product') || (key||'').includes('jolly_prod')) {
        Toast.error('❌ İcazəniz yoxdur');
        return false;
      }
      return _origRemoveItem(key, ...args);
    };

    JollyDB._viewerBlocked = true;
  }

  // Viewer üçün funksiyaları blokla
  function blockViewerFunctions() {
    const BLOCKED = [
      'deleteProduct','removeProduct','editProduct','saveProduct',
      'submitForm','quickAdd','addProduct','updateProduct',
      'bulkDelete','bulkEdit','copyProduct','duplicateProduct',
      'clearAllData','resetData','importData','deleteAll',
    ];
    BLOCKED.forEach(fn => {
      if (window[fn] && !window[fn]._viewerBlocked) {
        const orig = window[fn];
        window[fn] = function() {
          Toast.error('❌ İcazəniz yoxdur');
          if (navigator.vibrate) navigator.vibrate([50,30,50]);
          return false;
        };
        window[fn]._viewerBlocked = true;
      }
    });

    // onclick-ləri blokla
    document.addEventListener('click', function(e) {
      if (!isViewer()) return;
      const el = e.target.closest('button, a, [onclick], [data-action]');
      if (!el) return;
      const danger = ['sil','delete','remove','edit','redakt','yenilə','əlavə','add','copy','kopyala','saxla','save','submit','clear','təmizlə'];
      const text = (el.textContent||'').toLowerCase() + (el.getAttribute('onclick')||'').toLowerCase() + (el.getAttribute('data-action')||'').toLowerCase();
      if (danger.some(d => text.includes(d))) {
        e.preventDefault();
        e.stopPropagation();
        Toast.error('❌ İcazəniz yoxdur');
        if (navigator.vibrate) navigator.vibrate([50,30,50]);
      }
    }, true);
  }

  // MutationObserver — DOM dəyişəndə avtomatik tətbiq et
  let _viewerObserver = null;
  function startViewerObserver() {
    if (_viewerObserver) return;
    _viewerObserver = new MutationObserver(() => {
      if (isViewer()) applyViewerMode();
    });
    _viewerObserver.observe(document.getElementById('main') || document.body, {
      childList: true, subtree: true
    });
  }

  // Viewer session qurulandan sonra observer başlat
  // (authentication.js jollyAuthHide-dan sonra applyViewer çağırır, o da buraya gəlir)
  const _origApplyViewer = applyViewerMode;

  // Overlay-ə cfg ötür
  function pushCfgToOverlay() {
    const cfg = getCfg();
    if (window._jaSetCfg) window._jaSetCfg(cfg, setSession, applyViewerMode);
  }

  function init() {
    const cfg = getCfg();
    if (!cfg.enabled) return;
    const session = getSession();
    if (session) {
      if (session.role === 'viewer') {
        setTimeout(() => { applyViewerMode(); startViewerObserver(); }, 300);
      }
      return;
    }
    // Kilid lazımdır
    setTimeout(() => {
      pushCfgToOverlay();
      if (window.jollyAuthShow) window.jollyAuthShow();
    }, 200);
  }

  window.addEventListener('hashchange', () => {
    if (isViewer()) {
      setTimeout(() => applyViewerMode(), 150);
      // Studio-ya giriş bloku
      if (window.location.hash.includes('studio')) JollyRouter.go('#/home');
    }
  });

  // Firebase log
  const FB = 'https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app';
  async function getActivityLog() {
    try { const r = await fetch(`${FB}/jolly_user_activity.json`); const d = await r.json(); if (!d) return []; return Object.values(d).sort((a,b)=>b.ts-a.ts).slice(0,100); } catch(e) { return []; }
  }
  async function clearActivityLog() {
    try { await fetch(`${FB}/jolly_user_activity.json`,{method:'DELETE'}); Toast.success('Jurnal təmizləndi'); JollyRouter.go('#/studios/security'); } catch(e) { Toast.error('Silinmədi'); }
  }

  // Security Studio
  function renderStudio() {
    const cfg = getCfg();
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔐 Security Studio</h2>
      <p class="muted" style="font-size:12px;margin:0 0 16px;">Giriş qorunması</p>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>🔐 Giriş qorunması</span>
          <label><input type="checkbox" ${cfg.enabled?'checked':''} onchange="JollySecurity.toggleEnabled(this.checked)"></label>
        </div>
      </div>
      ${cfg.enabled ? `
      <div class="section-title">Admin</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin(false)">
          <span>🔢 Admin PIN ${cfg.pinHash?'✅':'—'}</span><span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupBiometric()">
          <span>👆 Barmaq izi ${cfg.biometricCredId?'✅':'—'}</span><span style="color:var(--accent-1);">›</span>
        </div>
      </div>
      <div class="section-title">👁️ Viewer rejimi</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>Viewer rejiminə icazə ver</span>
          <label><input type="checkbox" ${cfg.viewerEnabled?'checked':''} onchange="JollySecurity.toggleViewer(this.checked)"></label>
        </div>
        ${cfg.viewerEnabled?`
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin(true)">
          <span>👁️ Viewer PIN ${cfg.viewerPinHash?'✅':'—'}</span><span style="color:var(--accent-1);">›</span>
        </div>`:''}
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
      zone.innerHTML = logs.map(l=>`<div class="list-row" style="flex-direction:column;align-items:flex-start;gap:2px;padding:10px 4px;"><div style="display:flex;gap:8px;width:100%;align-items:center;"><span style="font-size:12px;">${l.role==='viewer'?'👁️ User':'👑 Admin'}</span><span style="font-size:11px;color:var(--accent-1);">${l.action}</span><span class="muted" style="font-size:10px;margin-left:auto;">${l.date}</span></div></div>`).join('');
    });
  }

  function toggleEnabled(on) {
    if (on) {
      const code = genCode();
      saveCfg({ enabled: true, recoveryHash: simpleHash(code) });
      alert(`✅ Qoruma aktiv edildi!\n\n🗝️ Bərpa kodunuz:\n${code}\n\nBu kodu yazıb saxlayın!`);
    } else {
      if (!confirm('Giriş qorumasını bağlamaq istəyirsiniz?')) return;
      saveCfg({ enabled: false, pinHash: null, viewerPinHash: null });
    }
    JollyRouter.go('#/studios/security');
  }

  function toggleViewer(on) {
    saveCfg({ viewerEnabled: on });
    if (on) setupPin(true);
    else JollyRouter.go('#/studios/security');
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
    } catch(e) {
      Toast.error('Barmaq izi qeydiyyat uğursuz oldu');
    }
  }

  function setupPin(isViewer) {
    const ov = document.createElement('div');
    ov.id = 'jsPinSetup';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg-void,#06070d);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
    ov.innerHTML = `
      <h3 style="font-family:var(--font-display);margin:0 0 6px;color:#fff;">${isViewer?'👁️ Viewer PIN':'🔢 Admin PIN'}</h3>
      <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0 0 20px;" id="jsPinHint">PIN daxil edin (4-8 rəqəm)</p>
      <div style="width:100%;max-width:280px;">
        <input id="jsPinInp1" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"
          style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;margin-bottom:10px;">
        <input id="jsPinInp2" type="password" inputmode="numeric" maxlength="8" placeholder="Təkrar"
          style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;display:none;margin-bottom:10px;">
        <button onclick="JollySecurity.confirmSetupPin(${isViewer})" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#6366f1);border:none;color:#000;font-size:15px;font-weight:700;cursor:pointer;">Davam et</button>
      </div>
      <div id="jsPinMsg" style="margin-top:12px;font-size:12px;color:#ef4444;min-height:18px;text-align:center;"></div>
      <button onclick="document.getElementById('jsPinSetup').remove();JollyRouter.go('#/studios/security')"
        style="margin-top:14px;background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:13px;">Ləğv et</button>
    `;
    document.body.appendChild(ov);
    setTimeout(() => { const el = document.getElementById('jsPinInp1'); if (el) el.focus(); }, 100);
  }

  function confirmSetupPin(isViewer) {
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
        i1.value = ''; i2.value = ''; i1.style.display = 'block'; i2.style.display = 'none'; i1.focus();
        const hint = document.getElementById('jsPinHint');
        if (hint) hint.textContent = 'PIN daxil edin (4-8 rəqəm)';
        return;
      }
      if (isViewer) saveCfg({ viewerPinHash: simpleHash(v1) });
      else saveCfg({ pinHash: simpleHash(v1) });
      document.getElementById('jsPinSetup').remove();
      Toast.success(isViewer ? 'Viewer PIN saxlanıldı ✓' : 'Admin PIN saxlanıldı ✓');
      JollyRouter.go('#/studios/security');
    }
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
      render() {
        if (JollySecurity.isViewer()) {
          JollyRouter.go('#/home');
          return '';
        }
        return renderStudio();
      },
      afterRender() { afterRenderStudio(); },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 400));
  } else {
    setTimeout(init, 400);
  }

  return {
    init, isViewer, isAdmin, isUnlocked, clearSession, applyViewerMode, setupBiometric,
    toggleEnabled, toggleViewer, setupPin, confirmSetupPin, genNewRecovery, disableAll, clearActivityLog,
  };
})();
