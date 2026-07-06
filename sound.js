/* ============================================================
   JOLLY Sound + Haptic Engine — Web Audio API (MP3-siz, offline)
   Defolt: səs bağlı, vibrasiya açıq. İlk toxunuşda audio açılır.
   Köhnə JollySound API-si ilə tam uyğun (tap/beep/success/error/warn).
   ============================================================ */
(function () {
  'use strict';
  let _ctx = null, _unlocked = false;

  function enabled() {
    try { return JollyDB.getSettings().soundEnabled === true; } catch (e) { return false; }
  }
  function vibrateOn() {
    try { return JollyDB.getSettings().vibrateEnabled !== false; } catch (e) { return true; }
  }

  function _getCtx() {
    if (_ctx) return _ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      _ctx = new Ctx();
    } catch (e) { return null; }
    return _ctx;
  }

  function _unlock() {
    if (_unlocked) return;
    const ctx = _getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(ctx.destination); src.start(0);
    } catch (e) {}
    _unlocked = true;
  }
  function _unlockOnce() {
    _unlock();
    document.removeEventListener('touchstart', _unlockOnce);
    document.removeEventListener('pointerdown', _unlockOnce);
  }
  document.addEventListener('touchstart', _unlockOnce, { passive: true });
  document.addEventListener('pointerdown', _unlockOnce, { passive: true });

  function _beep({ freq = 440, type = 'sine', duration = 0.12, gain = 0.16, attack = 0.005, ramp = 0, delay = 0 }) {
    if (!enabled()) return;
    const ctx = _getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      if (ramp) osc.frequency.exponentialRampToValueAtTime(ramp, ctx.currentTime + delay + duration * 0.8);
      g.gain.setValueAtTime(0, ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + attack);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.01);
    } catch (e) {}
  }

  function _vibe(pattern) {
    if (!vibrateOn()) return;
    try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {}
  }

  // ── Səs + haptik təriflər (köhnə adlarla uyğun) ──
  function tap()  { _beep({ freq: 1050, type: 'sine', duration: 0.05, gain: 0.1, attack: 0.002 }); _vibe(8); }
  function beep() { _beep({ freq: 800, type: 'sine', duration: 0.09, gain: 0.14, ramp: 1400 }); _vibe(6); }
  function scan() { beep(); }
  function success() {
    _beep({ freq: 600, duration: 0.12, gain: 0.14 });
    _beep({ freq: 900, duration: 0.16, gain: 0.13, delay: 0.1 });
    _beep({ freq: 1200, duration: 0.2, gain: 0.1, delay: 0.2 });
    _vibe([10, 30, 10]);
  }
  function error() {
    _beep({ freq: 220, type: 'square', duration: 0.14, gain: 0.12 });
    _beep({ freq: 180, type: 'square', duration: 0.14, gain: 0.1, delay: 0.16 });
    _vibe([30, 20, 30]);
  }
  function warn() { _beep({ freq: 400, type: 'triangle', duration: 0.12, gain: 0.12 }); _vibe(15); }
  function notify() {
    _beep({ freq: 520, duration: 0.2, gain: 0.13 });
    _beep({ freq: 660, duration: 0.2, gain: 0.11, delay: 0.18 });
    _vibe(15);
  }
  function ai() {
    _beep({ freq: 300, duration: 0.25, gain: 0.1, ramp: 600 });
    _beep({ freq: 600, duration: 0.2, gain: 0.09, ramp: 900, delay: 0.18 });
    _vibe(10);
  }

  window.JollySound = { tap, beep, scan, success, error, warn, notify, ai, unlock: _unlock };
})();
