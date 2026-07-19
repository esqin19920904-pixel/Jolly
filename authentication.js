/**
 * JOLLY Store OS — Authentication Center
 * Orijinal premium UI + JOLLY-nin real PIN sistemi
 */

// ── JOLLY konfiqurasiyasını oxu ──
const CFG_KEY = 'jolly_security_cfg';

function getSecCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function simpleHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

function setSession(role) {
  sessionStorage.setItem('jolly_sec_session', JSON.stringify({ role, at: Date.now() }));
}

async function logActivity(action, role) {
  try {
    await fetch('https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app/jolly_user_activity.json', {
      method: 'POST',
      body: JSON.stringify({ role, action, detail: '', ts: Date.now(), date: new Date().toLocaleString('az-AZ'), ua: navigator.userAgent.slice(0, 80) }),
    });
  } catch (e) {}
}

async function notifyAdmin() {
  try {
    await fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: '👁️ User (Zülfü) daxil oldu', detail: '', ts: new Date().toLocaleString('az-AZ') }),
    });
  } catch (e) {}
}

// ── Rol seçimini konfiqurasiyaya görə tənzimlə ──
function setupRoleCards() {
  const cfg = getSecCfg();
  const userCard = document.querySelector('[data-role="user"]');
  if (userCard) {
    // User kartını yalnız viewerEnabled olduqda göstər
    if (!cfg.viewerEnabled || !cfg.viewerPinHash) {
      userCard.style.display = 'none';
      // Yalnız Admin kartı varsa, tam genişlikdə göstər
      const grid = document.querySelector('.role-grid');
      if (grid) grid.style.gridTemplateColumns = '1fr';
    }
  }
}

class JollyAuth {
  constructor() {
    const cfg = getSecCfg();

    this.state = {
      currentScreen: 'splash',
      selectedRole: null,
      selectedMethod: null,
      pin: '',
      isAuthenticated: false,
      splashComplete: false
    };

    this.cfg = cfg;
    this.particleSystem = null;
    this.fingerprintScanner = null;

    this.screens = {
      role: document.getElementById('screen-role'),
      method: document.getElementById('screen-method'),
      pin: document.getElementById('screen-pin'),
      fingerprint: document.getElementById('screen-fingerprint'),
      faceid: document.getElementById('screen-faceid'),
      pattern: document.getElementById('screen-pattern'),
      success: document.getElementById('screen-success')
    };

    this.elements = {
      glassCard: document.getElementById('glass-card'),
      pinDisplay: document.getElementById('pin-display'),
      methodTitle: document.getElementById('method-title'),
      successRole: document.getElementById('success-role'),
      splashScreen: document.getElementById('splash-screen')
    };

    this.init();
  }

  init() {
    setupRoleCards();
    this.initParticles();
    this.initFingerprint();
    this.bindEvents();
    this.startSplashSequence();
    JollyUI.init();
  }

  initParticles() {
    this.particleSystem = new ParticleSystem('bg-canvas', {
      particleCount: window.innerWidth < 768 ? 40 : 80,
      connectionDistance: 100,
      mouseRadius: 120,
      orbCount: 4
    });
    this.particleSystem.start();
  }

  initFingerprint() {
    this.fingerprintScanner = new FingerprintScanner('fingerprint-container', {
      scanDuration: 2000,
      onSuccess: () => this.onAuthSuccess(),
      onError: () => this.onAuthError()
    });
  }

  bindEvents() {
    // Rol seçimi
    document.querySelectorAll('.role-card').forEach(card => {
      card.addEventListener('click', (e) => this.selectRole(e, card.dataset.role));
    });

    // Metod seçimi
    document.querySelectorAll('.method-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.selectMethod(e, btn.dataset.method));
    });

    // PIN klaviatura
    document.querySelectorAll('.pin-key[data-digit]').forEach(key => {
      key.addEventListener('click', () => this.pinPress(key.dataset.digit));
    });

    document.getElementById('pin-back')?.addEventListener('click', () => this.pinBack());
    document.getElementById('pin-clear')?.addEventListener('click', () => this.pinClear());

    // Geri düymələri
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => this.goBack());
    });

    // Klaviatura PIN
    document.addEventListener('keydown', (e) => {
      if (this.state.currentScreen === 'pin') {
        if (e.key >= '0' && e.key <= '9') this.pinPress(e.key);
        if (e.key === 'Backspace') this.pinBack();
        if (e.key === 'Escape') this.goBack();
      }
    });
  }

  // ── Splash ──
  async startSplashSequence() {
    const splash = this.elements.splashScreen;
    const logo = splash.querySelector('.splash-logo');
    const tagline = splash.querySelector('.splash-tagline');
    const lock = splash.querySelector('.splash-lock');

    await this.delay(400);
    logo.classList.add('visible');
    await this.delay(600);
    tagline.classList.add('visible');
    await this.delay(400);
    lock.classList.add('visible');
    await this.delay(600);

    lock.animate([
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(1.1) rotate(10deg)', offset: 0.3 },
      { transform: 'scale(0.8) rotate(-5deg)', offset: 0.6 },
      { transform: 'scale(1) rotate(0deg)' }
    ], { duration: 500, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });

    await this.delay(500);
    splash.classList.add('hidden');
    this.state.splashComplete = true;
    await this.delay(300);
    this.navigateTo('role');

    const cards = document.querySelectorAll('.role-card');
    JollyAnimations.stagger(cards, (card) => JollyAnimations.scaleIn(card, 500), 100, 200);
  }

  // ── Naviqasiya ──
  navigateTo(screenName, direction = 'forward') {
    const fromScreen = this.screens[this.state.currentScreen];
    const toScreen = this.screens[screenName];
    if (!toScreen) return;
    this.state.currentScreen = screenName;
    if (fromScreen && fromScreen !== toScreen) {
      JollyAnimations.transitionScreens(fromScreen, toScreen, direction);
    } else {
      toScreen.classList.add('active');
      JollyAnimations.fadeIn(toScreen, 500);
    }
  }

  goBack() {
    const backMap = { method: 'role', pin: 'method', fingerprint: 'method', faceid: 'method', pattern: 'method' };
    const prev = backMap[this.state.currentScreen];
    if (prev) {
      if (this.state.currentScreen === 'pin') this.pinClear();
      if (this.state.currentScreen === 'fingerprint') this.fingerprintScanner.reset();
      this.navigateTo(prev, 'back');
    }
  }

  // ── Rol seçimi ──
  selectRole(event, role) {
    this.state.selectedRole = role;
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    JollyAnimations.createRipple(event, event.currentTarget);
    JollyAnimations.particleBurst(event.currentTarget, '0, 212, 255', 12);
    JollyUI.vibrate([30, 50, 30]);

    setTimeout(() => {
      this.elements.methodTitle.textContent = role === 'admin' ? 'Administrator' : 'User';
      this._buildMethodList(role);
      this.navigateTo('method');
      const methods = document.querySelectorAll('.method-btn');
      JollyAnimations.stagger(methods, (m) => JollyAnimations.fadeIn(m, 400), 80, 200);
    }, 400);
  }

  // Rola görə mövcud metodları göstər
  _buildMethodList(role) {
    const cfg = this.cfg;
    const list = document.querySelector('.method-list');
    if (!list) return;

    // Bütün düymələri gizlə
    list.querySelectorAll('.method-btn').forEach(btn => {
      btn.style.display = 'none';
    });

    if (role === 'admin') {
      // PIN
      if (cfg.pinHash) list.querySelector('[data-method="pin"]').style.display = '';
      // Pattern
      if (cfg.patternHash) list.querySelector('[data-method="pattern"]').style.display = '';
      // Biometric
      if (cfg.biometricCredId) list.querySelector('[data-method="fingerprint"]').style.display = '';
    } else {
      // Viewer — yalnız PIN
      if (cfg.viewerPinHash) list.querySelector('[data-method="pin"]').style.display = '';
    }

    // Heç bir metod qurulmayıbsa
    const visible = [...list.querySelectorAll('.method-btn')].filter(b => b.style.display !== 'none');
    if (!visible.length) {
      // Birbaşa keç
      this.onAuthSuccess();
    }
  }

  // ── Metod seçimi ──
  selectMethod(event, method) {
    this.state.selectedMethod = method;
    JollyAnimations.createRipple(event, event.currentTarget);
    JollyUI.vibrate(20);
    setTimeout(() => {
      this.navigateTo(method === 'fingerprint' ? 'fingerprint' : method === 'pattern' ? 'pattern' : method);
      if (method === 'fingerprint') this.fingerprintScanner.reset();
    }, 200);
  }

  // ── PIN ──
  pinPress(digit) {
    if (this.state.pin.length >= 8) return;
    this.state.pin += digit;
    this.updatePinDisplay();
    const key = document.querySelector(`.pin-key[data-digit="${digit}"]`);
    if (key) { key.classList.add('pressed'); setTimeout(() => key.classList.remove('pressed'), 200); }
    JollyUI.vibrate(15);
    if (this.state.pin.length >= 4) setTimeout(() => this.validatePin(), 300);
  }

  pinBack() { this.state.pin = this.state.pin.slice(0, -1); this.updatePinDisplay(); JollyUI.vibrate(10); }
  pinClear() { this.state.pin = ''; this.updatePinDisplay(); }

  updatePinDisplay() {
    const dots = document.querySelectorAll('#pin-display .pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < this.state.pin.length);
      dot.classList.remove('error', 'success');
    });
  }

  validatePin() {
    const cfg = this.cfg;
    const h = simpleHash(this.state.pin);
    const dots = document.querySelectorAll('#pin-display .pin-dot');

    let role = null;
    if (this.state.selectedRole === 'admin' && h === cfg.pinHash) {
      role = 'admin';
    } else if (this.state.selectedRole === 'user' && cfg.viewerEnabled && h === cfg.viewerPinHash) {
      role = 'viewer';
    }

    if (role) {
      this.state.selectedRole = role; // faktiki rol
      dots.forEach(d => d.classList.add('success'));
      JollyUI.vibrate([50, 30, 50]);
      setTimeout(() => this.onAuthSuccess(), 400);
    } else {
      dots.forEach(d => d.classList.add('error'));
      JollyUI.vibrate([50, 100, 50, 100, 50]);
      JollyAnimations.shake(this.elements.glassCard);
      setTimeout(() => { this.state.pin = ''; this.updatePinDisplay(); }, 600);
    }
  }

  // ── Uğurlu giriş ──
  async onAuthSuccess() {
    this.state.isAuthenticated = true;
    const role = this.state.selectedRole === 'viewer' ? 'viewer' : 'admin';
    const roleName = role === 'admin' ? 'Administrator' : 'User';
    this.elements.successRole.textContent = `${roleName} olaraq daxil oldunuz`;

    JollyAnimations.particleBurst(this.elements.glassCard, '34, 197, 94', 24);

    // Session saxla
    setSession(role);
    logActivity('login', role);
    if (role === 'viewer') notifyAdmin();

    await JollyAnimations.unlockSequence(this.elements.glassCard, () => {
      this.navigateTo('success');
      setTimeout(() => {
        JollyAnimations.particleBurst(document.querySelector('.success-ring'), '34, 197, 94', 20);
      }, 300);
    });

    // JOLLY-yə qayıt
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
  }

  onAuthError() {
    JollyUI.toast('Giriş uğursuz oldu', 'error');
  }

  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

document.addEventListener('DOMContentLoaded', () => {
  window.jollyAuth = new JollyAuth();
});
