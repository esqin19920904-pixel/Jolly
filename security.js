/* ============================================================
   JOLLY Security — Premium Giriş Sistemi
   AMOLED + Glassmorphism + Neon UI
   Admin (tam giriş) + User/Viewer (yalnız baxış)
   ============================================================ */

const JollySecurity = (() => {

  /* ── Konfiqurasiya ── */
  const KEY = 'jolly_security_cfg';
  const SESSION_KEY = 'jolly_sec_session';
  const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 saat

  function getCfg() {
    return JollyDB.read(KEY, {
      enabled: false,
      method: 'pin',
      pinHash: null,
      patternHash: null,
      biometricCredId: null,
      recoveryHash: null,
      viewerPinHash: null,
      viewerEnabled: false,
    });
  }
  function saveCfg(patch) {
    JollyDB.write(KEY, { ...getCfg(), ...patch });
  }

  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  function genRecoveryCode() {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  }

  /* ── Session ── */
  function setSession(role) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, at: Date.now() }));
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

  /* ── Viewer rejimi ── */
  function applyViewerMode() {
    if (!isViewer()) return;
    document.querySelectorAll(
      '.btn-primary,.rfab-main,#jbdTab,.fab-btn,[onclick*="product/new"],[onclick*="submitForm"],' +
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

  /* ── Fəaliyyət jurnalı ── */
  const FIREBASE_BASE = 'https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app';
  async function logActivity(action, detail) {
    try {
      const s = getSession();
      await fetch(`${FIREBASE_BASE}/jolly_user_activity.json`, {
        method: 'POST',
        body: JSON.stringify({ role: s ? s.role : 'unknown', action, detail: detail || '', ts: Date.now(), date: new Date().toLocaleString('az-AZ'), ua: navigator.userAgent.slice(0, 80) }),
      });
    } catch (e) {}
  }
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
  async function notifyAdmin(action) {
    try { await fetch('/api/notify-admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, detail: '', ts: new Date().toLocaleString('az-AZ') }) }); } catch (e) {}
  }

  /* ================================================================
     PREMİUM KİLİD EKRANI — AMOLED + Glassmorphism
     ================================================================ */

  let _particleSystem = null;
  let _fingerprintScanner = null;
  let _lockResolve = null;
  let _currentLockRole = null; // 'admin' | 'viewer'
  let _pinBuffer = '';

  function showLockScreen() {
    return new Promise((resolve) => {
      _lockResolve = resolve;
      const cfg = getCfg();
      if (!cfg.enabled) { resolve('admin'); return; }

      // Overlay HTML
      const overlay = document.createElement('div');
      overlay.id = 'jollyAuthOverlay';
      overlay.innerHTML = `
        <style>
          #jollyAuthOverlay {
            position:fixed;inset:0;z-index:99999;background:#050505;
            display:flex;align-items:center;justify-content:center;padding:20px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          }
          #jollyAuthOverlay canvas { position:fixed;inset:0;pointer-events:none;z-index:0; }
          #jauth-mesh { position:fixed;inset:0;z-index:0;
            background:radial-gradient(ellipse 80% 50% at 20% 40%,rgba(99,102,241,0.15) 0%,transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%,rgba(0,212,255,0.1) 0%,transparent 50%);
            animation:jauthMesh 8s ease-in-out infinite; }
          @keyframes jauthMesh { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.05)} }
          #jauth-card {
            position:relative;z-index:10;width:100%;max-width:380px;
            background:rgba(10,10,15,0.65);backdrop-filter:blur(40px) saturate(180%);
            -webkit-backdrop-filter:blur(40px) saturate(180%);
            border:1px solid rgba(255,255,255,0.12);border-radius:24px;padding:36px 28px;
            box-shadow:0 8px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.05);
            overflow:hidden;animation:jauthFloat 6s ease-in-out infinite;
          }
          @keyframes jauthFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
          #jauth-card::before {
            content:'';position:absolute;inset:0;border-radius:inherit;padding:1.5px;
            background:linear-gradient(135deg,rgba(0,212,255,0.3),rgba(168,85,247,0.2),transparent 60%);
            -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
            -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:0.6;
          }
          .jauth-screen { display:none; }
          .jauth-screen.active { display:block; }
          .jauth-title { font-size:1.6rem;font-weight:600;text-align:center;margin-bottom:6px;
            background:linear-gradient(135deg,#fff,#00d4ff);-webkit-background-clip:text;
            -webkit-text-fill-color:transparent;background-clip:text; }
          .jauth-subtitle { font-size:14px;color:rgba(255,255,255,0.6);text-align:center;margin-bottom:28px; }
          .jauth-role-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px; }
          .jauth-role-card { background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.08);
            border-radius:16px;padding:24px 14px;text-align:center;cursor:pointer;
            transition:all 0.3s cubic-bezier(0.16,1,0.3,1);overflow:hidden;position:relative; }
          .jauth-role-card:hover { border-color:rgba(0,212,255,0.3);transform:translateY(-4px) scale(1.02);
            box-shadow:0 12px 40px rgba(0,212,255,0.1); }
          .jauth-role-card:active { transform:scale(0.97); }
          .jauth-role-icon { width:44px;height:44px;margin:0 auto 12px;color:rgba(255,255,255,0.6); }
          .jauth-role-icon svg { width:100%;height:100%; }
          .jauth-role-label { font-size:15px;font-weight:600;color:#fff;margin-bottom:4px; }
          .jauth-role-desc { font-size:11px;color:rgba(255,255,255,0.4);line-height:1.4; }
          .jauth-back-btn { display:inline-flex;align-items:center;gap:6px;font-size:13px;
            color:rgba(255,255,255,0.4);background:none;border:none;cursor:pointer;margin-bottom:20px;padding:6px 0;
            transition:color 0.2s; }
          .jauth-back-btn:hover { color:#fff; }
          .jauth-back-btn svg { width:16px;height:16px; }
          .jauth-method-list { display:flex;flex-direction:column;gap:10px; }
          .jauth-method-btn { display:flex;align-items:center;gap:14px;width:100%;padding:14px 18px;
            background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.08);border-radius:16px;
            color:#fff;font-size:14px;font-weight:500;cursor:pointer;text-align:left;position:relative;overflow:hidden;
            transition:all 0.25s cubic-bezier(0.16,1,0.3,1); }
          .jauth-method-btn:hover { border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.05);transform:translateX(4px); }
          .jauth-method-icon { width:22px;height:22px;color:#00d4ff;flex-shrink:0; }
          .jauth-method-icon svg { width:100%;height:100%; }
          .jauth-method-arrow { margin-left:auto;width:16px;height:16px;color:rgba(255,255,255,0.3); }
          .jauth-method-arrow svg { width:100%;height:100%; }
          .jauth-pin-display { display:flex;justify-content:center;gap:20px;margin:28px 0; }
          .jauth-pin-dot { width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,0.2);
            background:transparent;transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
          .jauth-pin-dot.filled { background:#00d4ff;border-color:#00d4ff;
            box-shadow:0 0 14px rgba(0,212,255,0.5);transform:scale(1.2); }
          .jauth-pin-dot.error { background:#ef4444;border-color:#ef4444;box-shadow:0 0 14px rgba(239,68,68,0.5); }
          .jauth-pin-dot.success { background:#22c55e;border-color:#22c55e;box-shadow:0 0 14px rgba(34,197,94,0.5); }
          .jauth-pin-pad { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:260px;margin:0 auto; }
          .jauth-pin-key { aspect-ratio:1;border-radius:50%;border:1.5px solid rgba(255,255,255,0.08);
            background:rgba(255,255,255,0.03);color:#fff;font-size:22px;font-weight:500;cursor:pointer;
            display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;
            transition:all 0.15s cubic-bezier(0.16,1,0.3,1); }
          .jauth-pin-key:hover { border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.08); }
          .jauth-pin-key:active { transform:scale(0.88);background:rgba(0,212,255,0.15); }
          .jauth-pin-action { font-size:13px !important;color:rgba(255,255,255,0.4); }
          .jauth-hint { font-size:11px;color:rgba(255,255,255,0.25);text-align:center;margin-top:16px; }
          .jauth-msg { font-size:12px;color:#ef4444;text-align:center;min-height:18px;margin-top:10px; }
          /* Fingerprint */
          .jauth-fp-container { display:flex;flex-direction:column;align-items:center;padding:24px 0; }
          .jauth-fp-ring { position:relative;width:130px;height:130px;border-radius:50%;
            border:2px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;
            cursor:pointer;transition:all 0.3s; }
          .jauth-fp-ring.scanning { border-color:#00d4ff;box-shadow:0 0 40px rgba(0,212,255,0.4); }
          .jauth-fp-ring.success { border-color:#22c55e;box-shadow:0 0 40px rgba(34,197,94,0.4); }
          .jauth-fp-svg { width:66px;height:66px;color:rgba(255,255,255,0.5);transition:color 0.3s; }
          .jauth-fp-ring.scanning .jauth-fp-svg { color:#00d4ff; }
          .jauth-fp-ring.success .jauth-fp-svg { color:#22c55e; }
          .jauth-scan-line { position:absolute;left:10%;right:10%;height:2px;
            background:linear-gradient(90deg,transparent,#00d4ff,transparent);opacity:0;box-shadow:0 0 8px rgba(0,212,255,0.6); }
          .jauth-scan-line.active { opacity:1;animation:jauthScan 1.5s ease-in-out infinite; }
          @keyframes jauthScan { 0%{top:15%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:85%;opacity:0} }
          .jauth-fp-hint { margin-top:20px;font-size:13px;color:rgba(255,255,255,0.4);text-align:center; }
          .jauth-fp-hint.scanning { color:#00d4ff; }
          .jauth-fp-hint.success { color:#22c55e; }
          /* Unlock wave */
          .jauth-unlock-wave { position:fixed;inset:0;z-index:99998;pointer-events:none; }
          .jauth-unlock-wave::before { content:'';position:absolute;top:50%;left:50%;width:0;height:0;
            border-radius:50%;background:radial-gradient(circle,rgba(0,212,255,0.2),transparent 70%);
            transform:translate(-50%,-50%);animation:jauthWave 1s cubic-bezier(0.16,1,0.3,1) forwards; }
          @keyframes jauthWave { to{width:200vmax;height:200vmax;opacity:0} }
          /* Success */
          .jauth-success-container { display:flex;flex-direction:column;align-items:center;padding:32px 0;text-align:center; }
          .jauth-success-ring { width:72px;height:72px;border-radius:50%;border:3px solid #22c55e;
            display:flex;align-items:center;justify-content:center;margin-bottom:20px;
            box-shadow:0 0 30px rgba(34,197,94,0.4);animation:jauthSuccessPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
          @keyframes jauthSuccessPop { 0%{transform:scale(0)} 60%{transform:scale(1.1)} 100%{transform:scale(1)} }
          .jauth-success-ring svg { width:36px;height:36px;color:#22c55e; }
          .jauth-success-title { font-size:22px;font-weight:600;color:#fff;margin-bottom:8px; }
          .jauth-success-sub { font-size:14px;color:rgba(255,255,255,0.6); }
          /* Pattern */
          .jauth-pattern-canvas { display:block;margin:0 auto;border-radius:16px;
            background:rgba(255,255,255,0.04);touch-action:none;cursor:pointer; }
          /* Recovery */
          .jauth-recovery-input { width:100%;padding:14px;border-radius:12px;
            background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
            color:#fff;font-size:20px;text-align:center;letter-spacing:6px;box-sizing:border-box;margin-bottom:12px; }
        </style>

        <!-- Arxa fon -->
        <div id="jauth-mesh"></div>
        <canvas id="jauth-canvas"></canvas>

        <!-- Şüşə kart -->
        <div id="jauth-card">

          <!-- Ekran 1: Rol seçimi -->
          <div class="jauth-screen active" id="jauth-screen-role">
            <h1 class="jauth-title">Xoş gəlmisiniz</h1>
            <p class="jauth-subtitle">Rolunuzu seçin</p>
            <div class="jauth-role-grid">
              <div class="jauth-role-card" id="jauth-role-admin">
                <div class="jauth-role-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div class="jauth-role-label">Administrator</div>
                <div class="jauth-role-desc">Tam idarəetmə girişi</div>
              </div>
              ${getCfg().viewerEnabled ? `
              <div class="jauth-role-card" id="jauth-role-user">
                <div class="jauth-role-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div class="jauth-role-label">User</div>
                <div class="jauth-role-desc">Yalnız baxış rejimi</div>
              </div>` : ''}
            </div>
            <div class="jauth-hint">Rol seçimi tələb olunur</div>
          </div>

          <!-- Ekran 2: Metod seçimi -->
          <div class="jauth-screen" id="jauth-screen-method">
            <button class="jauth-back-btn" id="jauth-back-method">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Geri
            </button>
            <h1 class="jauth-title" id="jauth-method-title">Administrator</h1>
            <p class="jauth-subtitle">Giriş üsulunu seçin</p>
            <div class="jauth-method-list" id="jauth-method-list"></div>
          </div>

          <!-- Ekran 3: PIN -->
          <div class="jauth-screen" id="jauth-screen-pin">
            <button class="jauth-back-btn" id="jauth-back-pin">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Geri
            </button>
            <h1 class="jauth-title">PIN kodu</h1>
            <p class="jauth-subtitle">PIN-i daxil edin</p>
            <div class="jauth-pin-display" id="jauth-pin-display">
              <div class="jauth-pin-dot"></div><div class="jauth-pin-dot"></div>
              <div class="jauth-pin-dot"></div><div class="jauth-pin-dot"></div>
            </div>
            <div class="jauth-pin-pad">
              ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
                <button class="jauth-pin-key${k===''?' jauth-pin-action':''}" data-digit="${k}" style="${k===''?'visibility:hidden;':''}">${k}</button>
              `).join('')}
            </div>
            <div class="jauth-msg" id="jauth-pin-msg"></div>
            <button id="jauth-recovery-link" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:12px;cursor:pointer;margin-top:12px;display:block;width:100%;text-align:center;">🗝️ Parolu unutmuşam</button>
          </div>

          <!-- Ekran 4: Barmaq izi -->
          <div class="jauth-screen" id="jauth-screen-fp">
            <button class="jauth-back-btn" id="jauth-back-fp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Geri
            </button>
            <h1 class="jauth-title">Barmaq izi</h1>
            <p class="jauth-subtitle">Barmağınızı sensora toxundurun</p>
            <div class="jauth-fp-container" id="jauth-fp-container"></div>
            <div class="jauth-msg" id="jauth-fp-msg"></div>
          </div>

          <!-- Ekran 5: Nümunə -->
          <div class="jauth-screen" id="jauth-screen-pattern">
            <button class="jauth-back-btn" id="jauth-back-pattern">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Geri
            </button>
            <h1 class="jauth-title">Nümunə</h1>
            <p class="jauth-subtitle">Nümunəni çəkin</p>
            <canvas id="jauth-pattern-canvas" class="jauth-pattern-canvas" width="240" height="240"></canvas>
            <div class="jauth-msg" id="jauth-pattern-msg"></div>
          </div>

          <!-- Ekran 6: Bərpa kodu -->
          <div class="jauth-screen" id="jauth-screen-recovery">
            <button class="jauth-back-btn" id="jauth-back-recovery">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Geri
            </button>
            <h1 class="jauth-title">🗝️ Bərpa</h1>
            <p class="jauth-subtitle">12 rəqəmli bərpa kodunu daxil edin</p>
            <input type="number" inputmode="numeric" class="jauth-recovery-input" id="jauth-recovery-input" placeholder="123456789012">
            <button class="jauth-method-btn" id="jauth-recovery-submit" style="justify-content:center;">Daxil ol</button>
            <div class="jauth-msg" id="jauth-recovery-msg"></div>
          </div>

          <!-- Ekran 7: Uğurlu giriş -->
          <div class="jauth-screen" id="jauth-screen-success">
            <div class="jauth-success-container">
              <div class="jauth-success-ring">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div class="jauth-success-title">Uğurlu giriş!</div>
              <div class="jauth-success-sub" id="jauth-success-sub">Daxil oldunuz</div>
            </div>
          </div>

        </div>
      `;
      document.body.appendChild(overlay);

      // Particle sistemi
      try {
        if (typeof ParticleSystem !== 'undefined') {
          _particleSystem = new ParticleSystem('jauth-canvas', { particleCount: 50, orbCount: 3 });
          _particleSystem.start();
        }
      } catch (e) {}

      _bindLockEvents(overlay);
    });
  }

  function _showJauthScreen(name) {
    document.querySelectorAll('.jauth-screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`jauth-screen-${name}`);
    if (el) el.classList.add('active');
  }

  function _buildMethodList(role) {
    const cfg = getCfg();
    const list = document.getElementById('jauth-method-list');
    if (!list) return;
    const methods = [];
    if (role === 'admin') {
      if (cfg.pinHash) methods.push({ id: 'pin', label: 'PIN kodu ilə daxil ol', icon: '🔢' });
      if (cfg.patternHash) methods.push({ id: 'pattern', label: 'Nümunə ilə daxil ol', icon: '🔷' });
      if (cfg.biometricCredId) methods.push({ id: 'biometric', label: 'Barmaq izi / Üz tanıma', icon: '👆' });
    } else {
      if (cfg.viewerPinHash) methods.push({ id: 'pin', label: 'PIN kodu ilə daxil ol', icon: '🔢' });
    }
    if (!methods.length) {
      // Heç bir metod qurulmayıb — birbaşa admin kimi burax
      _unlock('admin');
      return;
    }
    list.innerHTML = methods.map(m => `
      <button class="jauth-method-btn" data-method="${m.id}">
        <span class="jauth-method-icon" style="font-size:20px;">${m.icon}</span>
        <span>${m.label}</span>
        <span class="jauth-method-arrow">›</span>
      </button>
    `).join('');
    list.querySelectorAll('.jauth-method-btn').forEach(btn => {
      btn.addEventListener('click', () => _selectMethod(btn.dataset.method));
    });
    // Yalnız bir metod varsa, birbaşa ora keç
    if (methods.length === 1) {
      setTimeout(() => _selectMethod(methods[0].id), 100);
    }
  }

  function _selectMethod(method) {
    if (method === 'pin') {
      _pinBuffer = '';
      _updatePinDisplay();
      _showJauthScreen('pin');
    } else if (method === 'pattern') {
      _showJauthScreen('pattern');
      setTimeout(() => _initPatternLogin(), 100);
    } else if (method === 'biometric') {
      _showJauthScreen('fp');
      setTimeout(() => {
        const container = document.getElementById('jauth-fp-container');
        if (container) {
          _fingerprintScanner = new FingerprintScanner('jauth-fp-container', {
            scanDuration: 2000,
            onSuccess: () => _tryBiometric(),
          });
        }
      }, 100);
    }
  }

  function _bindLockEvents(overlay) {
    // Rol seçimi
    overlay.querySelector('#jauth-role-admin')?.addEventListener('click', (e) => {
      _currentLockRole = 'admin';
      if (typeof JollyAnimations !== 'undefined') JollyAnimations.createRipple(e, e.currentTarget);
      document.getElementById('jauth-method-title').textContent = 'Administrator';
      _buildMethodList('admin');
      _showJauthScreen('method');
    });
    overlay.querySelector('#jauth-role-user')?.addEventListener('click', (e) => {
      _currentLockRole = 'viewer';
      if (typeof JollyAnimations !== 'undefined') JollyAnimations.createRipple(e, e.currentTarget);
      document.getElementById('jauth-method-title').textContent = 'User';
      _buildMethodList('viewer');
      _showJauthScreen('method');
    });

    // Geri düymələri
    overlay.querySelector('#jauth-back-method')?.addEventListener('click', () => _showJauthScreen('role'));
    overlay.querySelector('#jauth-back-pin')?.addEventListener('click', () => _showJauthScreen('method'));
    overlay.querySelector('#jauth-back-fp')?.addEventListener('click', () => _showJauthScreen('method'));
    overlay.querySelector('#jauth-back-pattern')?.addEventListener('click', () => _showJauthScreen('method'));
    overlay.querySelector('#jauth-back-recovery')?.addEventListener('click', () => _showJauthScreen('pin'));

    // PIN düymələri
    overlay.querySelectorAll('.jauth-pin-key').forEach(key => {
      key.addEventListener('click', () => _pinKeyPress(key.dataset.digit));
    });

    // Bərpa
    overlay.querySelector('#jauth-recovery-link')?.addEventListener('click', () => _showJauthScreen('recovery'));
    overlay.querySelector('#jauth-recovery-submit')?.addEventListener('click', () => _checkRecovery());

    // Klaviatura PIN
    document.addEventListener('keydown', _keydownHandler);
  }

  function _keydownHandler(e) {
    const pinScreen = document.querySelector('#jauth-screen-pin.active');
    if (!pinScreen) return;
    if (e.key >= '0' && e.key <= '9') _pinKeyPress(e.key);
    if (e.key === 'Backspace') _pinKeyPress('⌫');
  }

  function _pinKeyPress(k) {
    if (k === '' || k === undefined) return;
    if (k === '⌫') {
      _pinBuffer = _pinBuffer.slice(0, -1);
    } else if (_pinBuffer.length < 8 && k !== '⌫') {
      _pinBuffer += k;
    }
    _updatePinDisplay();
    if (_pinBuffer.length >= 4) {
      setTimeout(() => _validatePin(), 200);
    }
  }

  function _updatePinDisplay() {
    const dots = document.querySelectorAll('#jauth-pin-display .jauth-pin-dot');
    const len = Math.max(_pinBuffer.length, 4);
    // Göstərmə üçün həmişə 4 nöqtə
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < _pinBuffer.length);
      dot.classList.remove('error', 'success');
    });
  }

  function _validatePin() {
    const cfg = getCfg();
    const h = simpleHash(_pinBuffer);
    _pinBuffer = '';
    const dots = document.querySelectorAll('#jauth-pin-display .jauth-pin-dot');

    let role = null;
    if (h === cfg.pinHash && _currentLockRole === 'admin') role = 'admin';
    else if (cfg.viewerEnabled && h === cfg.viewerPinHash && _currentLockRole === 'viewer') role = 'viewer';

    if (role) {
      dots.forEach(d => d.classList.add('success'));
      setTimeout(() => _onAuthSuccess(role), 400);
    } else {
      dots.forEach(d => d.classList.add('error'));
      const card = document.getElementById('jauth-card');
      if (card && typeof JollyAnimations !== 'undefined') JollyAnimations.shake(card);
      const msg = document.getElementById('jauth-pin-msg');
      if (msg) { msg.textContent = '❌ PIN səhvdir'; setTimeout(() => { msg.textContent = ''; _updatePinDisplay(); }, 1500); }
      else setTimeout(() => _updatePinDisplay(), 600);
    }
  }

  function _checkRecovery() {
    const val = (document.getElementById('jauth-recovery-input') || {}).value || '';
    const cfg = getCfg();
    if (simpleHash(val.trim()) === cfg.recoveryHash) {
      _onAuthSuccess('admin');
    } else {
      const msg = document.getElementById('jauth-recovery-msg');
      if (msg) msg.textContent = '❌ Bərpa kodu səhvdir';
    }
  }

  function _initPatternLogin() {
    const canvas = document.getElementById('jauth-pattern-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const SIZE = 3;
    const pts = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) pts.push({ x: 40 + c * 80, y: 40 + r * 80, idx: r * SIZE + c });
    let active = [], drawing = false;
    function draw(mx, my) {
      ctx.clearRect(0, 0, 240, 240);
      pts.forEach(p => {
        const hit = active.includes(p.idx);
        ctx.beginPath(); ctx.arc(p.x, p.y, hit ? 12 : 8, 0, Math.PI * 2);
        ctx.fillStyle = hit ? '#00d4ff' : 'rgba(255,255,255,0.2)'; ctx.fill();
      });
      if (active.length > 1) {
        ctx.beginPath(); ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2.5;
        active.forEach((idx, i) => { const p = pts[idx]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        if (drawing && mx !== undefined) ctx.lineTo(mx, my);
        ctx.stroke();
      }
    }
    function getPoint(x, y) {
      const r = canvas.getBoundingClientRect();
      return pts.find(p => Math.hypot(p.x - (x - r.left), p.y - (y - r.top)) < 28) || null;
    }
    function start(e) { e.preventDefault(); drawing = true; active = []; const { clientX: x, clientY: y } = e.touches ? e.touches[0] : e; const p = getPoint(x, y); if (p) active.push(p.idx); draw(x, y); }
    function move(e) { e.preventDefault(); if (!drawing) return; const { clientX: x, clientY: y } = e.touches ? e.touches[0] : e; const p = getPoint(x, y); if (p && !active.includes(p.idx)) active.push(p.idx); draw(x, y); }
    function end(e) {
      e.preventDefault(); drawing = false;
      const cfg = getCfg();
      if (active.length < 4) { const msg = document.getElementById('jauth-pattern-msg'); if (msg) msg.textContent = 'Ən azı 4 nöqtə seçin'; active = []; draw(); return; }
      const h = simpleHash(active.join('-'));
      if (h === cfg.patternHash) { _onAuthSuccess('admin'); }
      else { const msg = document.getElementById('jauth-pattern-msg'); if (msg) { msg.textContent = '❌ Nümunə səhvdir'; setTimeout(() => { msg.textContent = ''; active = []; draw(); }, 1200); } }
    }
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    draw();
  }

  async function _tryBiometric() {
    const cfg = getCfg();
    if (!cfg.biometricCredId) { _onAuthSuccess('admin'); return; } // Demo
    try {
      const credId = Uint8Array.from(atob(cfg.biometricCredId), c => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ id: credId, type: 'public-key' }], userVerification: 'required', timeout: 30000 }
      });
      if (assertion) _onAuthSuccess('admin');
    } catch (e) {
      const msg = document.getElementById('jauth-fp-msg');
      if (msg) msg.textContent = 'Biometrik uğursuz oldu';
    }
  }

  async function _onAuthSuccess(role) {
    const sub = document.getElementById('jauth-success-sub');
    if (sub) sub.textContent = role === 'admin' ? 'Administrator olaraq daxil oldunuz' : 'User olaraq daxil oldunuz';
    _showJauthScreen('success');

    if (typeof JollyAnimations !== 'undefined') {
      JollyAnimations.particleBurst(document.getElementById('jauth-card'), '34,197,94', 20);
    }

    await new Promise(r => setTimeout(r, 1000));
    _closeLockScreen(role);
  }

  function _closeLockScreen(role) {
    document.removeEventListener('keydown', _keydownHandler);
    if (_particleSystem) { _particleSystem.stop(); _particleSystem = null; }
    const overlay = document.getElementById('jollyAuthOverlay');
    if (overlay) overlay.remove();
    setSession(role);
    logActivity('login', role === 'admin' ? 'Admin girişi' : 'Viewer girişi');
    if (role === 'viewer') notifyAdmin('👁️ Viewer (Zülfü) daxil oldu');
    if (_lockResolve) { _lockResolve(role); _lockResolve = null; }
    if (role === 'viewer') setTimeout(() => applyViewerMode(), 100);
  }

  function _unlock(role) { _closeLockScreen(role); }

  /* ================================================================
     SECURİTY STUDİO — Ayarlar paneli
     ================================================================ */

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
      saveCfg({ enabled: false, method: null, pinHash: null, patternHash: null, biometricCredId: null });
    }
    JollyRouter.go('#/studios/security');
  }

  function toggleViewer(on) {
    saveCfg({ viewerEnabled: on });
    if (on) setupPin(true);
    else JollyRouter.go('#/studios/security');
  }

  /* ── PIN qurma ── */
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
      else saveCfg({ pinHash: simpleHash(val1), method: 'pin' });
      document.getElementById('jollySetupPinOverlay').remove();
      Toast.success(isViewer ? 'Viewer PIN saxlanıldı ✓' : 'Admin PIN saxlanıldı ✓');
      JollyRouter.go('#/studios/security');
    }
  }

  function setupViewerPin() { setupPin(true); }

  /* ── Nümunə qurma ── */
  function setupPattern() {
    const overlay = document.createElement('div');
    overlay.id = 'jollySetupPatternOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg-void,#06070d);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
    overlay.innerHTML = `
      <h3 style="font-family:var(--font-display);margin:0 0 6px;color:#fff;">🔷 Nümunə çəkin</h3>
      <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0 0 16px;" id="patSetupHint">İlk nümunəni çəkin (ən azı 4 nöqtə)</p>
      <canvas id="setupPatternCanvas" width="240" height="240" style="display:block;border-radius:14px;background:rgba(255,255,255,0.04);touch-action:none;cursor:pointer;"></canvas>
      <div id="setupPatternMsg" style="margin-top:12px;font-size:12px;color:#ef4444;min-height:18px;text-align:center;"></div>
      <button onclick="document.getElementById('jollySetupPatternOverlay').remove();JollyRouter.go('#/studios/security')"
        style="margin-top:14px;background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:13px;">Ləğv et</button>
    `;
    document.body.appendChild(overlay);

    let first = null;
    _initPatternSetup('setupPatternCanvas', (seq) => {
      if (!first) {
        first = seq;
        const hint = document.getElementById('patSetupHint');
        if (hint) hint.textContent = 'Nümunəni təkrar çəkin';
        _initPatternSetup('setupPatternCanvas', (seq2) => {
          if (seq2 === seq) {
            saveCfg({ patternHash: simpleHash(seq), method: 'pattern' });
            overlay.remove();
            Toast.success('Nümunə saxlanıldı ✓');
            JollyRouter.go('#/studios/security');
          } else {
            first = null;
            const msg = document.getElementById('setupPatternMsg');
            if (msg) { msg.textContent = '❌ Nümunə uyğun gəlmədi'; }
            const hint = document.getElementById('patSetupHint');
            if (hint) hint.textContent = 'İlk nümunəni çəkin (ən azı 4 nöqtə)';
          }
        });
      }
    });
  }

  function _initPatternSetup(canvasId, onComplete) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const SIZE = 3;
    const pts = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) pts.push({ x: 40 + c * 80, y: 40 + r * 80, idx: r * SIZE + c });
    let active = [], drawing = false;
    function draw(mx, my) {
      ctx.clearRect(0, 0, 240, 240);
      pts.forEach(p => { const hit = active.includes(p.idx); ctx.beginPath(); ctx.arc(p.x, p.y, hit ? 12 : 8, 0, Math.PI * 2); ctx.fillStyle = hit ? '#00d4ff' : 'rgba(255,255,255,0.2)'; ctx.fill(); });
      if (active.length > 1) { ctx.beginPath(); ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2.5; active.forEach((idx, i) => { const p = pts[idx]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); if (drawing && mx !== undefined) ctx.lineTo(mx, my); ctx.stroke(); }
    }
    function getPoint(x, y) { const r = canvas.getBoundingClientRect(); return pts.find(p => Math.hypot(p.x - (x - r.left), p.y - (y - r.top)) < 28) || null; }
    // Əvvəlki event dinləyicilərini təmizlə
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    const c = document.getElementById(canvasId);
    const ctx2 = c.getContext('2d');
    function draw2(mx, my) {
      ctx2.clearRect(0, 0, 240, 240);
      pts.forEach(p => { const hit = active.includes(p.idx); ctx2.beginPath(); ctx2.arc(p.x, p.y, hit ? 12 : 8, 0, Math.PI * 2); ctx2.fillStyle = hit ? '#00d4ff' : 'rgba(255,255,255,0.2)'; ctx2.fill(); });
      if (active.length > 1) { ctx2.beginPath(); ctx2.strokeStyle = '#00d4ff'; ctx2.lineWidth = 2.5; active.forEach((idx, i) => { const p = pts[idx]; if (i === 0) ctx2.moveTo(p.x, p.y); else ctx2.lineTo(p.x, p.y); }); if (drawing && mx !== undefined) ctx2.lineTo(mx, my); ctx2.stroke(); }
    }
    function start(e) { e.preventDefault(); drawing = true; active = []; const { clientX: x, clientY: y } = e.touches ? e.touches[0] : e; const r = c.getBoundingClientRect(); const p = pts.find(pp => Math.hypot(pp.x - (x - r.left), pp.y - (y - r.top)) < 28); if (p) active.push(p.idx); draw2(x, y); }
    function move(e) { e.preventDefault(); if (!drawing) return; const { clientX: x, clientY: y } = e.touches ? e.touches[0] : e; const r = c.getBoundingClientRect(); const p = pts.find(pp => Math.hypot(pp.x - (x - r.left), pp.y - (y - r.top)) < 28); if (p && !active.includes(p.idx)) active.push(p.idx); draw2(x, y); }
    function end(e) { e.preventDefault(); drawing = false; if (active.length < 4) { active = []; draw2(); return; } onComplete(active.join('-')); }
    c.addEventListener('touchstart', start, { passive: false });
    c.addEventListener('touchmove', move, { passive: false });
    c.addEventListener('touchend', end, { passive: false });
    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', move);
    c.addEventListener('mouseup', end);
    draw2();
  }

  /* ── Biometrik qurma ── */
  async function setupBiometric() {
    if (!window.PublicKeyCredential) { Toast.error('Bu cihaz biometrik dəstəkləmir'); return; }
    try {
      const cred = await navigator.credentials.create({
        publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'JOLLY Store', id: location.hostname }, user: { id: new Uint8Array(16), name: 'jolly-admin', displayName: 'JOLLY Admin' }, pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }], authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' }, timeout: 30000 }
      });
      if (cred) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        saveCfg({ biometricCredId: credId, method: 'biometric' });
        Toast.success('Barmaq izi qeydiyyatdan keçdi ✓');
        JollyRouter.go('#/studios/security');
      }
    } catch (e) { Toast.error('Biometrik qeydiyyat uğursuz: ' + (e.message || e)); }
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

  /* ── Avtomatik kilid ── */
  function init() {
    const cfg = getCfg();
    if (!cfg.enabled) return;
    const session = getSession();
    if (!session) {
      showLockScreen();
    } else if (session.role === 'viewer') {
      setTimeout(() => applyViewerMode(), 300);
    }
  }

  window.addEventListener('hashchange', () => {
    if (isViewer()) setTimeout(() => applyViewerMode(), 150);
  });

  /* ── ModuleRegistry ── */
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

  // Avtomatik init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  } else {
    setTimeout(init, 300);
  }

  return {
    init, isViewer, isAdmin, isUnlocked, clearSession, applyViewerMode,
    toggleEnabled, toggleViewer, setupPin, setupViewerPin, setupPattern, setupBiometric,
    confirmSetupPin, genNewRecovery, disableAll,
    logActivity, getActivityLog, clearActivityLog,
  };
})();
