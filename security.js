/* ============================================================
   JOLLY Security — Giriş Qorunması
   ============================================================
   3 giriş üsulu (istədiyin birini və ya hamısını aktiv et):
   1. 🔐 Barmaq izi / Üz tanıma (WebAuthn Biometrics)
   2. 🔢 PIN (4-8 rəqəm)
   3. 🔷 Nümunə (3×3 nöqtə, Android kilidi kimi)

   + 🗝️ Bərpa kodu (unudulduqda — 12 rəqəmli, ilk quraşdırmada verilir)
   + 👁️ Viewer rejimi (ayrı PIN — yalnız baxış, dəyişiklik yoxdur)

   Akitv olduqda hər tətbiq açılışında kilit ekranı çıxır.
   Admin girişindən sonra tam funksiya, Viewer girişindən sonra
   yalnız oxuma rejimi (əlavə/redaktə/silmə düymələri gizlənir).
   ============================================================ */

const JollySecurity = (() => {
  const KEY = 'jolly_security_cfg';
  const SESSION_KEY = 'jolly_sec_session';
  const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 saat

  // ── Konfiqurasiya oxu/yaz ──
  function getCfg() {
    return JollyDB.read(KEY, {
      enabled: false,
      method: null,        // 'pin' | 'pattern' | 'biometric'
      pinHash: null,
      patternHash: null,
      biometricCredId: null,
      recoveryHash: null,
      viewerPinHash: null,
      viewerEnabled: false,
    });
  }
  function saveCfg(patch) {
    const c = getCfg();
    JollyDB.write(KEY, { ...c, ...patch });
  }

  // ── Sadə hash (PIN/nümunə üçün — şifrə deyil, sadə gizlətmə) ──
  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  // ── 12 rəqəmli bərpa kodu ──
  function genRecoveryCode() {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  }

  // ── Session (bir dəfə girdikdən sonra 8 saat açıq qalsın) ──
  function setSession(role) {
    // role: 'admin' | 'viewer'
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

  // ── Viewer rejimi aktiv mi? ──
  function isViewer() {
    const s = getSession();
    return s && s.role === 'viewer';
  }
  function isAdmin() {
    const s = getSession();
    return s && s.role === 'admin';
  }
  function isUnlocked() { return !!getSession(); }

  // ── Viewer kilidini tətbiqə tətbiq et ──
  function applyViewerMode() {
    if (!isViewer()) return;
    // Admin-a aid bütün düymələri gizlət/deaktiv et
    document.querySelectorAll(
      '.btn-primary, .rfab-main, #jbdTab, .fab-btn, ' +
      '[onclick*="product/new"], [onclick*="submitForm"], [onclick*="deleteProduct"], ' +
      '[onclick*="quickAdd"], [onclick*="addBarcodeField"], .edit-btn, .delete-btn'
    ).forEach(el => { el.style.display = 'none'; });
    // "Viewer rejimi" nişanı göstər
    const badge = document.getElementById('viewerBadge');
    if (!badge) {
      const b = document.createElement('div');
      b.id = 'viewerBadge';
      b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(255,184,77,0.15);border:1px solid rgba(255,184,77,0.4);color:#fbbf24;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;';
      b.textContent = '👁️ Yalnız baxış rejimi';
      document.body.appendChild(b);
    }
  }

  /* ============================================================
     KİLİT EKRANI
     ============================================================ */
  function showLockScreen() {
    return new Promise((resolve) => {
      const cfg = getCfg();
      if (!cfg.enabled) { resolve('admin'); return; }

      // Overlay
      let overlay = document.getElementById('jollySecOverlay');
      if (overlay) overlay.remove();
      overlay = document.createElement('div');
      overlay.id = 'jollySecOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg-void,#06070d);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
      overlay.innerHTML = `
        <div style="font-size:48px;margin-bottom:12px;">🔐</div>
        <h2 style="font-family:var(--font-display,sans-serif);font-size:22px;margin:0 0 4px;">JOLLY</h2>
        <p class="muted" style="font-size:13px;margin:0 0 28px;">Daxil olmaq üçün özünüzü təsdiqləyin</p>
        <div id="secMethodArea" style="width:100%;max-width:320px;"></div>
        <div id="secMsg" style="margin-top:14px;font-size:12px;color:var(--accent-danger,#ff5fa2);min-height:18px;text-align:center;"></div>
        <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
          ${cfg.viewerEnabled ? `<button onclick="JollySecurity.startViewerLogin()" style="background:none;border:none;color:var(--accent-1,#7c8aff);font-size:13px;cursor:pointer;">👁️ Baxış rejimi ilə gir</button>` : ''}
          <button onclick="JollySecurity.showRecovery()" style="background:none;border:none;color:var(--muted,#888);font-size:12px;cursor:pointer;">🗝️ Parolu unutmuşam</button>
        </div>
      `;
      document.body.appendChild(overlay);

      // Əsas giriş metodunu göstər
      renderMethod(cfg, overlay, resolve);
    });
  }

  function renderMethod(cfg, overlay, resolve) {
    const area = document.getElementById('secMethodArea');
    if (!area) return;

    if (cfg.method === 'biometric') {
      area.innerHTML = `
        <button class="btn btn-primary btn-block" style="font-size:16px;padding:16px;" onclick="JollySecurity.tryBiometric()">
          👆 Barmaq izi / Üz tanıma
        </button>
        <p class="muted" style="font-size:11px;text-align:center;margin-top:10px;">İşləməsə, aşağıda PIN ilə daxil olun</p>
        <div id="secBioPinFallback" style="margin-top:10px;">${pinPadHtml()}</div>
      `;
    } else if (cfg.method === 'pattern') {
      area.innerHTML = patternHtml();
      initPattern(resolve, false);
    } else {
      // PIN (standart)
      area.innerHTML = pinPadHtml();
    }
  }

  // ── PIN ──
  function pinPadHtml() {
    return `
      <div id="pinDisplay" style="display:flex;gap:10px;justify-content:center;margin-bottom:16px;">
        ${Array(4).fill('<div style="width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);"></div>').join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;" id="pinPad">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k => `
          <button onclick="JollySecurity.pinKey('${k}')" style="padding:18px;font-size:20px;font-weight:700;border-radius:14px;border:none;background:rgba(255,255,255,0.07);color:#fff;cursor:pointer;${k===''?'visibility:hidden;':''}">${k}</button>
        `).join('')}
      </div>
    `;
  }

  let pinBuffer = '';
  function pinKey(k) {
    if (k === '') return;
    if (k === '⌫') { pinBuffer = pinBuffer.slice(0, -1); }
    else if (pinBuffer.length < 8) { pinBuffer += k; }
    updatePinDisplay();
    if (pinBuffer.length >= 4) setTimeout(() => checkPin(), 200);
  }

  function updatePinDisplay() {
    const disp = document.getElementById('pinDisplay');
    if (!disp) return;
    const len = pinBuffer.length || 4;
    disp.innerHTML = Array.from({ length: len }, (_, i) => `
      <div style="width:14px;height:14px;border-radius:50%;background:${i < pinBuffer.length ? 'var(--accent-1,#7c8aff)' : 'transparent'};border:2px solid ${i < pinBuffer.length ? 'var(--accent-1,#7c8aff)' : 'rgba(255,255,255,0.3)'};"></div>
    `).join('');
  }

  function checkPin() {
    const cfg = getCfg();
    const h = simpleHash(pinBuffer);
    pinBuffer = '';
    updatePinDisplay();
    if (h === cfg.pinHash) {
      unlock('admin');
    } else if (cfg.viewerEnabled && h === cfg.viewerPinHash) {
      unlock('viewer');
    } else {
      showSecMsg('❌ PIN səhvdir');
    }
  }

  // ── Nümunə (Pattern) ──
  function patternHtml() {
    return `
      <canvas id="patternCanvas" width="260" height="260"
        style="display:block;margin:0 auto;border-radius:16px;background:rgba(255,255,255,0.04);touch-action:none;"></canvas>
      <p class="muted" style="font-size:11px;text-align:center;margin-top:8px;">Nümunəni çəkin</p>
    `;
  }

  function initPattern(resolve, isSetup) {
    setTimeout(() => {
      const canvas = document.getElementById('patternCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const SIZE = 3;
      const pts = [];
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        pts.push({ x: 40 + c * 90, y: 40 + r * 90, idx: r * SIZE + c });
      }
      let active = [];
      let drawing = false;

      function draw(mx, my) {
        ctx.clearRect(0, 0, 260, 260);
        // Nöqtələr
        pts.forEach(p => {
          const hit = active.includes(p.idx);
          ctx.beginPath(); ctx.arc(p.x, p.y, hit ? 14 : 10, 0, Math.PI * 2);
          ctx.fillStyle = hit ? 'var(--accent-1,#7c8aff)' : 'rgba(255,255,255,0.2)';
          ctx.fill();
        });
        // Xətlər
        if (active.length > 1) {
          ctx.beginPath(); ctx.strokeStyle = 'var(--accent-1,#7c8aff)'; ctx.lineWidth = 3;
          active.forEach((idx, i) => {
            const p = pts[idx];
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          });
          if (drawing && mx !== undefined) ctx.lineTo(mx, my);
          ctx.stroke();
        }
      }

      function getPoint(x, y) {
        const r = canvas.getBoundingClientRect();
        const rx = x - r.left, ry = y - r.top;
        return pts.find(p => Math.hypot(p.x - rx, p.y - ry) < 30) || null;
      }

      function start(e) {
        e.preventDefault(); drawing = true; active = [];
        const { clientX: x, clientY: y } = e.touches ? e.touches[0] : e;
        const p = getPoint(x, y);
        if (p) active.push(p.idx);
        draw(x, y);
      }
      function move(e) {
        e.preventDefault(); if (!drawing) return;
        const { clientX: x, clientY: y } = e.touches ? e.touches[0] : e;
        const p = getPoint(x, y);
        if (p && !active.includes(p.idx)) active.push(p.idx);
        draw(x, y);
      }
      function end(e) {
        e.preventDefault(); drawing = false;
        if (active.length < 4) { showSecMsg('Ən azı 4 nöqtə seçin'); active = []; draw(); return; }
        if (isSetup) {
          resolve(active.join('-'));
        } else {
          const cfg = getCfg();
          const h = simpleHash(active.join('-'));
          if (h === cfg.patternHash) { unlock('admin'); }
          else { showSecMsg('❌ Nümunə səhvdir'); active = []; draw(); }
        }
      }

      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end, { passive: false });
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      canvas.addEventListener('mouseup', end);
      draw();
    }, 50);
  }

  // ── Biometrik (WebAuthn) ──
  async function tryBiometric() {
    const cfg = getCfg();
    if (!cfg.biometricCredId) { showSecMsg('Barmaq izi qeydiyyatı yoxdur'); return; }
    try {
      const credId = Uint8Array.from(atob(cfg.biometricCredId), c => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: credId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 30000,
        }
      });
      if (assertion) unlock('admin');
    } catch (e) {
      showSecMsg('Biometrik uğursuz oldu — PIN ilə cəhd edin');
    }
  }

  // ── Bərpa kodu ──
  function showRecovery() {
    const area = document.getElementById('secMethodArea');
    if (!area) return;
    area.innerHTML = `
      <p class="muted" style="font-size:12px;margin:0 0 10px;">12 rəqəmli bərpa kodunu daxil edin:</p>
      <input id="recoveryInput" type="number" inputmode="numeric" placeholder="123456789012"
        style="width:100%;padding:14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid var(--border-soft,rgba(255,255,255,0.1));color:#fff;font-size:18px;text-align:center;box-sizing:border-box;">
      <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="JollySecurity.checkRecovery()">Daxil ol</button>
    `;
  }

  function checkRecovery() {
    const val = (document.getElementById('recoveryInput') || {}).value || '';
    const cfg = getCfg();
    if (simpleHash(val.trim()) === cfg.recoveryHash) {
      unlock('admin');
      Toast.info('Bərpa kodu ilə daxil oldunuz. Parolu yeniləyin!');
    } else {
      showSecMsg('❌ Bərpa kodu səhvdir');
    }
  }

  // ── Viewer giriş ──
  function startViewerLogin() {
    const area = document.getElementById('secMethodArea');
    if (!area) return;
    area.innerHTML = `
      <p class="muted" style="font-size:12px;margin:0 0 10px;text-align:center;">👁️ Baxış rejimi PIN-i:</p>
      ${pinPadHtml()}
    `;
    pinBuffer = '';
    // checkPin-i Viewer üçün yönləndir
  }

  // ── Kilidi aç ──
  function unlock(role) {
    setSession(role);
    const overlay = document.getElementById('jollySecOverlay');
    if (overlay) overlay.remove();
    if (role === 'viewer') {
      setTimeout(() => applyViewerMode(), 100);
    }
  }

  function showSecMsg(msg) {
    const el = document.getElementById('secMsg');
    if (el) { el.textContent = msg; setTimeout(() => { if (el) el.textContent = ''; }, 2000); }
  }

  /* ============================================================
     QURAŞDIRMA (Security Studio)
     ============================================================ */
  function renderStudio() {
    const cfg = getCfg();
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔐 Security Studio</h2>
      <p class="muted" style="font-size:12px;margin:0 0 16px;">Tətbiqə giriş qorunması — PIN, Nümunə, Barmaq izi</p>

      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>🔐 Giriş qorunması</span>
          <label><input type="checkbox" ${cfg.enabled ? 'checked' : ''} onchange="JollySecurity.toggleEnabled(this.checked)"></label>
        </div>
        ${cfg.enabled ? `
        <div class="list-row">
          <span>Aktiv metod</span>
          <span class="muted">${cfg.method === 'pin' ? '🔢 PIN' : cfg.method === 'pattern' ? '🔷 Nümunə' : cfg.method === 'biometric' ? '👆 Barmaq izi' : 'Seçilməyib'}</span>
        </div>` : ''}
      </div>

      ${cfg.enabled ? `
      <div class="section-title">Giriş metodu seç</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPin()">
          <span>🔢 PIN ilə qur</span><span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupPattern()">
          <span>🔷 Nümunə ilə qur</span><span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupBiometric()">
          <span>👆 Barmaq izi / Üz tanıma ilə qur</span><span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <div class="section-title">👁️ Viewer rejimi (yalnız baxış)</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row">
          <span>Viewer rejiminə icazə ver</span>
          <label><input type="checkbox" ${cfg.viewerEnabled ? 'checked' : ''} onchange="JollySecurity.toggleViewer(this.checked)"></label>
        </div>
        ${cfg.viewerEnabled ? `
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.setupViewerPin()">
          <span>Viewer PIN-i dəyiş</span><span style="color:var(--accent-1);">›</span>
        </div>` : ''}
      </div>

      <div class="section-title">🗝️ Bərpa</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.showRecoveryCode()">
          <span>Bərpa kodunu göstər</span><span style="color:var(--accent-1);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="JollySecurity.genNewRecovery()">
          <span>Yeni bərpa kodu yarat</span><span style="color:var(--accent-1);">›</span>
        </div>
      </div>

      <button class="btn btn-ghost btn-block" style="margin-top:8px;color:var(--accent-danger);" onclick="JollySecurity.disableAll()">🗑️ Bütün qorumanı sil</button>
      ` : `
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">🔓</div>
        <div class="muted" style="font-size:12.5px;">Giriş qorunması bağlıdır — yuxarıdan aktiv edin</div>
      </div>
      `}
    `;
  }

  function toggleEnabled(on) {
    if (on) {
      const code = genRecoveryCode();
      saveCfg({ enabled: true, recoveryHash: simpleHash(code) });
      alert(`✅ Qoruma aktiv edildi!\n\n🗝️ Bərpa kodunuz:\n${code}\n\nBu kodu yazıb saxlayın — parolu unutduqda bu kod lazım olacaq!`);
    } else {
      if (!confirm('Giriş qorumasını bağlamaq istəyirsiniz?')) { return; }
      saveCfg({ enabled: false, method: null, pinHash: null, patternHash: null, biometricCredId: null });
    }
    JollyRouter.go('#/studios/security');
  }

  function toggleViewer(on) {
    saveCfg({ viewerEnabled: on });
    if (on) setupViewerPin();
    else JollyRouter.go('#/studios/security');
  }

  // ── PIN qurma ──
  function setupPin(isViewer) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg-void,#06070d);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
    overlay.innerHTML = `
      <h3 style="font-family:var(--font-display);margin:0 0 6px;">${isViewer ? '👁️ Viewer PIN' : '🔢 Yeni PIN'}</h3>
      <p class="muted" style="font-size:12px;margin:0 0 20px;" id="pinSetupHint">PIN daxil edin (4-8 rəqəm)</p>
      <div style="width:100%;max-width:280px;">
        <input id="pinSetupInput1" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"
          style="width:100%;padding:16px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid var(--border-soft);color:#fff;font-size:22px;text-align:center;letter-spacing:8px;box-sizing:border-box;margin-bottom:12px;">
        <input id="pinSetupInput2" type="password" inputmode="numeric" maxlength="8" placeholder="Təkrar"
          style="width:100%;padding:16px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid var(--border-soft);color:#fff;font-size:22px;text-align:center;letter-spacing:8px;box-sizing:border-box;display:none;margin-bottom:12px;">
        <button class="btn btn-primary btn-block" onclick="JollySecurity.confirmSetupPin(${isViewer})">Davam et</button>
      </div>
      <div id="secMsg" style="margin-top:12px;font-size:12px;color:var(--accent-danger);min-height:18px;text-align:center;"></div>
      <button onclick="document.getElementById('jollySetupPinOverlay').remove();JollyRouter.go('#/studios/security')"
        style="margin-top:16px;background:none;border:none;color:var(--muted,#888);cursor:pointer;font-size:13px;">Ləğv et</button>
    `;
    overlay.id = 'jollySetupPinOverlay';
    document.body.appendChild(overlay);
    setTimeout(() => { const el = document.getElementById('pinSetupInput1'); if (el) el.focus(); }, 100);
  }

  function confirmSetupPin(isViewer) {
    const inp1 = document.getElementById('pinSetupInput1');
    const inp2 = document.getElementById('pinSetupInput2');
    const msg = document.getElementById('secMsg');

    if (!inp2 || inp2.style.display === 'none') {
      // Birinci addım
      const val = (inp1 && inp1.value) || '';
      if (val.length < 4) { if (msg) msg.textContent = '❌ Ən azı 4 rəqəm daxil edin'; return; }
      inp1.style.display = 'none';
      if (inp2) { inp2.style.display = 'block'; inp2.focus(); }
      const hint = document.getElementById('pinSetupHint');
      if (hint) hint.textContent = 'PIN-i təkrar daxil edin';
      if (msg) msg.textContent = '';
    } else {
      // İkinci addım — müqayisə
      const val1 = (inp1 && inp1.value) || '';
      const val2 = (inp2 && inp2.value) || '';
      if (val1 !== val2) {
        if (msg) msg.textContent = '❌ PIN uyğun gəlmədi — yenidən cəhd edin';
        inp1.value = ''; inp2.value = ''; inp1.style.display = 'block'; inp2.style.display = 'none'; inp1.focus();
        const hint = document.getElementById('pinSetupHint');
        if (hint) hint.textContent = 'PIN daxil edin (4-8 rəqəm)';
        return;
      }
      if (isViewer) saveCfg({ viewerPinHash: simpleHash(val1) });
      else saveCfg({ pinHash: simpleHash(val1), method: 'pin' });
      document.getElementById('jollySetupPinOverlay').remove();
      Toast.success(isViewer ? 'Viewer PIN saxlanıldı ✓' : 'PIN saxlanıldı ✓');
      JollyRouter.go('#/studios/security');
    }
  }

  // ── Nümunə qurma ──
  function setupPattern() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg-void,#06070d);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
    overlay.innerHTML = `
      <h3 style="font-family:var(--font-display);margin:0 0 6px;">🔷 Nümunə çəkin</h3>
      <p class="muted" style="font-size:12px;margin:0 0 20px;" id="patSetupHint">İlk nümunənizi çəkin (ən azı 4 nöqtə)</p>
      <div>${patternHtml()}</div>
      <div id="secMsg" style="margin-top:12px;font-size:12px;color:var(--accent-danger);min-height:18px;"></div>
      <button onclick="this.parentElement.remove();JollyRouter.go('#/studios/security')" style="margin-top:16px;background:none;border:none;color:var(--muted,#888);cursor:pointer;font-size:13px;">Ləğv et</button>
    `;
    document.body.appendChild(overlay);
    let first = null;
    initPattern((seq) => {
      if (!first) {
        first = seq;
        const hint = overlay.querySelector('#patSetupHint');
        if (hint) hint.textContent = 'Nümunəni təkrar çəkin';
        initPattern((seq2) => {
          if (seq2 === seq) {
            saveCfg({ patternHash: simpleHash(seq), method: 'pattern' });
            overlay.remove();
            Toast.success('Nümunə saxlanıldı ✓');
            JollyRouter.go('#/studios/security');
          } else {
            showSecMsgInEl(overlay, '❌ Nümunə uyğun gəlmədi');
            first = null;
            const hint = overlay.querySelector('#patSetupHint');
            if (hint) hint.textContent = 'İlk nümunənizi çəkin (ən azı 4 nöqtə)';
          }
        }, true);
      }
    }, true);
  }

  // ── Biometrik qurma ──
  async function setupBiometric() {
    if (!window.PublicKeyCredential) { Toast.error('Bu cihaz biometrik dəstəkləmir'); return; }
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'JOLLY Store', id: location.hostname },
          user: { id: new Uint8Array(16), name: 'jolly-user', displayName: 'JOLLY' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' },
          timeout: 30000,
        }
      });
      if (cred) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        saveCfg({ biometricCredId: credId, method: 'biometric' });
        Toast.success('Barmaq izi / Üz tanıma qeydiyyatdan keçdi ✓');
        JollyRouter.go('#/studios/security');
      }
    } catch (e) {
      Toast.error('Biometrik qeydiyyat uğursuz: ' + (e.message || e));
    }
  }

  // ── Bərpa kodu ──
  function showRecoveryCode() {
    const cfg = getCfg();
    if (!cfg.recoveryHash) { Toast.info('Bərpa kodu yoxdur — "Yeni bərpa kodu yarat"a bas'); return; }
    alert('Bərpa kodunuz artıq göstərilə bilməz (hash kimi saxlanılıb).\nUnudubsunuzsa, "Yeni bərpa kodu yarat"a basın.');
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

  // ── Köməkçi ──
  function showSecMsgInEl(overlay, msg) {
    const el = overlay.querySelector('#secMsg');
    if (el) { el.textContent = msg; setTimeout(() => { if (el) el.textContent = ''; }, 2500); }
  }

  /* ============================================================
     Tətbiq başlayanda yoxla
     ============================================================ */
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

  // Viewer modunu route dəyişəndə də tətbiq et
  window.addEventListener('hashchange', () => {
    if (isViewer()) setTimeout(() => applyViewerMode(), 150);
  });

  /* ============================================================
     Registrasiya
     ============================================================ */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'security',
      name: 'Security Studio',
      icon: '🔐',
      route: '#/studios/security',
      group: 'Sistem',
      enabled: true,
      render() { return renderStudio(); },
    });
  }

  return {
    init, isViewer, isAdmin, isUnlocked, clearSession, applyViewerMode,
    toggleEnabled, toggleViewer, setupPin, setupViewerPin, setupPattern, setupBiometric,
    confirmSetupPin,
    pinKey, checkRecovery, tryBiometric, showRecovery, startViewerLogin,
    showRecoveryCode, genNewRecovery, disableAll,
  };
})();
