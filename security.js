/* ============================================================
   JOLLY Security — Sadə yönləndirmə + Security Studio
   Kilid lazım olanda authentication.html-ə yönləndirir,
   auth bitəndə geri qayıdır.
   ============================================================ */

const JollySecurity = (() => {
  const KEY = 'jolly_security_cfg';
  const SESSION_KEY = 'jolly_sec_session';
  const SESSION_DURATION = 8 * 60 * 60 * 1000;

  function getCfg() {
    return JollyDB.read(KEY, { enabled: false, pinHash: null, patternHash: null, biometricCredId: null, recoveryHash: null, viewerPinHash: null, viewerEnabled: false });
  }
  function saveCfg(patch) { JollyDB.write(KEY, { ...getCfg(), ...patch }); }

  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  function genRecoveryCode() {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  }

  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return null;
      if (Date.now() - s.at > SESSION_DURATION) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch (e) { return null; }
  }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }
  function isViewer() { const s = getSession(); return s && s.role === 'viewer'; }
  function isAdmin() { const s = getSession(); return s && s.role === 'admin'; }
  function isUnlocked() { return !!getSession(); }

  function applyViewerMode() {
    if (!isViewer()) return;
    document.querySelectorAll(
      '.btn-primary,.rfab-main,#jbdTab,[onclick*="product/new"],[onclick*="submitForm"],' +
      '[onclick*="deleteProduct"],[onclick*="quickAdd"],[onclick*="addBarcodeField"],.edit-btn,.delete-btn'
    ).forEach(el => { el.style.display = 'none'; });
    if (!document.getElementById('viewerBadge')) {
      const b = document.createElement('div');
      b.id = 'viewerBadge';
      b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(255,184,77,0.15);border:1px solid rgba(255,184,77,0.4);color:#fbbf24;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;pointer-events:none;';
      b.textContent = '👁️ Yalnız baxış rejimi';
      document.body.appendChild(b);
    }
  }

  // Fəaliyyət jurnalı
  const FIREBASE_BASE = 'https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app';
  async function getActivityLog() {
    try {
      const res = await fetch(`${FIREBASE_BASE}/jolly_user_activity.json`);
      const data = await res.json();
      if (!data) return [];
      return Object.values(data).sort((a, b) => b.ts - a.ts).slice(0, 100);
    } catch (e) { return []; }
  }
  async function clearActivityLog() {
    try { await fetch(`${FIREBASE_BASE}/jolly_user_activity.json`, { method: 'DELETE' }); Toast.success('Jurnal təmizləndi'); JollyRouter.go('#/studios/security'); } catch (e) { Toast.error('Silinmədi'); }
  }

  // Kilid lazım olanda authentication.html-ə yönləndir
  function init() {
    const cfg = getCfg();
    if (!cfg.enabled) return;
    const session = getSession();
    if (!session) {
      window.location.href = 'authentication.html';
    } else if (session.role === 'viewer') {
      setTimeout(() => applyViewerMode(), 300);
    }
  }

  window.addEventListener('hashchange', () => {
    if (isViewer()) setTimeout(() => applyViewerMode(), 150);
  });

  // Security Studio UI
  function renderStudio() {
    const cfg = getCfg();
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔐 Security Studio</h2>
      <p class="muted" style="font-size:12px;margin:0 0 16px;">Giriş qorunması — PIN, Nümunə, Barmaq izi</p>

      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>🔐 Giriş qorunması</span>
          <label><input type="checkbox" ${cfg.enabled ? 'checked' : ''} onchange="JollySecurity.toggleEnabled(this.checked)"></label>
        </div>
      </div>

      ${cfg.enabled ? `
      <div class="section-title">Admin giriş metodları</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin(false)">
          <span>🔢 PIN ${cfg.pinHash ? '✅' : '—'}</span><span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPattern()">
          <span>🔷 Nümunə ${cfg.patternHash ? '✅' : '—'}</span><span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupBiometric()">
          <span>👆 Barmaq izi ${cfg.biometricCredId ? '✅' : '—'}</span><span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <div class="section-title">👁️ Viewer (User) rejimi</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>Viewer rejiminə icazə ver</span>
          <label><input type="checkbox" ${cfg.viewerEnabled ? 'checked' : ''} onchange="JollySecurity.toggleViewer(this.checked)"></label>
        </div>
        ${cfg.viewerEnabled ? `
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin(true)">
          <span>Viewer PIN ${cfg.viewerPinHash ? '✅' : '—'}</span><span style="color:var(--accent-1);">›</span>
        </div>` : ''}
      </div>

      <div class="section-title">🗝️ Bərpa</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.genNewRecovery()">
          <span>Yeni bərpa kodu yarat</span><span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <div class="section-title">📊 İstifadəçi Fəaliyyəti</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:10px;" id="activityLogZone">
        <div class="muted" style="padding:12px;font-size:12px;">Yüklənir...</div>
      </div>
      <button class="btn btn-ghost btn-sm btn-block" onclick="JollySecurity.clearActivityLog()">🗑️ Jurnalı təmizlə</button>

      <button class="btn btn-ghost btn-block" style="margin-top:14px;color:var(--accent-danger);" onclick="JollySecurity.disableAll()">🗑️ Bütün qorumanı sil</button>
      ` : `
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">🔓</div>
        <div class="muted" style="font-size:12.5px;">Giriş qorunması bağlıdır — yuxarıdan aktiv edin</div>
      </div>
      `}
    `;
  }

  function afterRenderStudio() {
    const zone = document.getElementById('activityLogZone');
    if (!zone) return;
    getActivityLog().then(logs => {
      if (!zone.isConnected) return;
      if (!logs.length) { zone.innerHTML = '<div class="muted" style="padding:12px;font-size:12px;">Hələ heç bir fəaliyyət yoxdur</div>'; return; }
      zone.innerHTML = logs.map(l => `
        <div class="list-row" style="flex-direction:column;align-items:flex-start;gap:2px;padding:10px 4px;">
          <div style="display:flex;gap:8px;width:100%;align-items:center;">
            <span style="font-size:12px;">${l.role === 'viewer' ? '👁️ User' : '👑 Admin'}</span>
            <span style="font-size:11px;color:var(--accent-1);">${l.action}</span>
            <span class="muted" style="font-size:10px;margin-left:auto;">${l.date}</span>
          </div>
        </div>
      `).join('');
    });
  }

  function toggleEnabled(on) {
    if (on) {
      const code = genRecoveryCode();
      saveCfg({ enabled: true, recoveryHash: simpleHash(code) });
      alert(`✅ Qoruma aktiv edildi!\n\n🗝️ Bərpa kodunuz:\n${code}\n\nBu kodu yazıb saxlayın!`);
    } else {
      if (!confirm('Giriş qorumasını bağlamaq istəyirsiniz?')) return;
      saveCfg({ enabled: false, pinHash: null, patternHash: null, biometricCredId: null });
    }
    JollyRouter.go('#/studios/security');
  }

  function toggleViewer(on) {
    saveCfg({ viewerEnabled: on });
    if (on) setupPin(true);
    else JollyRouter.go('#/studios/security');
  }

  function setupPin(isViewer) {
    const overlay = document.createElement('div');
    overlay.id = 'jollySetupPinOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg-void,#06070d);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
    overlay.innerHTML = `
      <h3 style="font-family:var(--font-display);margin:0 0 6px;color:#fff;">${isViewer ? '👁️ Viewer PIN' : '🔢 Yeni Admin PIN'}</h3>
      <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0 0 20px;" id="pinSetupHint">PIN daxil edin (4-8 rəqəm)</p>
      <div style="width:100%;max-width:280px;">
        <input id="pinSetupInput1" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"
          style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;margin-bottom:10px;">
        <input id="pinSetupInput2" type="password" inputmode="numeric" maxlength="8" placeholder="Təkrar"
          style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;display:none;margin-bottom:10px;">
        <button onclick="JollySecurity.confirmSetupPin(${isViewer})" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#6366f1);border:none;color:#000;font-size:15px;font-weight:700;cursor:pointer;">Davam et</button>
      </div>
      <div id="setupPinMsg" style="margin-top:12px;font-size:12px;color:#ef4444;min-height:18px;text-align:center;"></div>
      <button onclick="document.getElementById('jollySetupPinOverlay').remove();JollyRouter.go('#/studios/security')"
        style="margin-top:14px;background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:13px;">Ləğv et</button>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => { const el = document.getElementById('pinSetupInput1'); if (el) el.focus(); }, 100);
  }

  function confirmSetupPin(isViewer) {
    const inp1 = document.getElementById('pinSetupInput1');
    const inp2 = document.getElementById('pinSetupInput2');
    const msg = document.getElementById('setupPinMsg');
    if (!inp2 || inp2.style.display === 'none') {
      const val = (inp1 && inp1.value) || '';
      if (val.length < 4) { if (msg) msg.textContent = '❌ Ən azı 4 rəqəm'; return; }
      inp1.style.display = 'none';
      if (inp2) { inp2.style.display = 'block'; inp2.focus(); }
      const hint = document.getElementById('pinSetupHint');
      if (hint) hint.textContent = 'PIN-i təkrar daxil edin';
      if (msg) msg.textContent = '';
    } else {
      const val1 = (inp1 && inp1.value) || '';
      const val2 = (inp2 && inp2.value) || '';
      if (val1 !== val2) {
        if (msg) msg.textContent = '❌ PIN uyğun gəlmədi';
        inp1.value = ''; inp2.value = ''; inp1.style.display = 'block'; inp2.style.display = 'none'; inp1.focus();
        const hint = document.getElementById('pinSetupHint');
        if (hint) hint.textContent = 'PIN daxil edin (4-8 rəqəm)';
        return;
      }
      if (isViewer) saveCfg({ viewerPinHash: simpleHash(val1) });
      else saveCfg({ pinHash: simpleHash(val1) });
      document.getElementById('jollySetupPinOverlay').remove();
      Toast.success(isViewer ? 'Viewer PIN saxlanıldı ✓' : 'Admin PIN saxlanıldı ✓');
      JollyRouter.go('#/studios/security');
    }
  }

  function setupViewerPin() { setupPin(true); }

  function setupPattern() {
    Toast.info('Nümunə qurma — tezliklə');
  }

  async function setupBiometric() {
    if (!window.PublicKeyCredential) { Toast.error('Bu cihaz biometrik dəstəkləmir'); return; }
    try {
      const cred = await navigator.credentials.create({
        publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'JOLLY Store', id: location.hostname }, user: { id: new Uint8Array(16), name: 'jolly-admin', displayName: 'JOLLY Admin' }, pubKeyCredParams: [{ alg: -7, type: 'public-key' }], authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' }, timeout: 30000 }
      });
      if (cred) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        saveCfg({ biometricCredId: credId });
        Toast.success('Barmaq izi qeydiyyatdan keçdi ✓');
        JollyRouter.go('#/studios/security');
      }
    } catch (e) { Toast.error('Biometrik qeydiyyat uğursuz'); }
  }

  function genNewRecovery() {
    const code = genRecoveryCode();
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
      id: 'security',
      name: 'Security Studio',
      icon: '🔐',
      route: '#/studios/security',
      group: 'Sistem',
      enabled: true,
      render() { return renderStudio(); },
      afterRender() { afterRenderStudio(); },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  } else {
    setTimeout(init, 300);
  }

  return {
    init, isViewer, isAdmin, isUnlocked, clearSession, applyViewerMode,
    toggleEnabled, toggleViewer, setupPin, setupViewerPin, setupPattern, setupBiometric,
    confirmSetupPin, genNewRecovery, disableAll, clearActivityLog,
  };
})();
