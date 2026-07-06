/* ============================================================
   JOLLY Haptic FX — bütün düymələrə avtomatik incə vibrasiya
   Ripple/shine JOLLY-də CSS-də artıq var; bu yalnız haptik əlavə edir.
   ============================================================ */
(function () {
  'use strict';
  function vibeOn() {
    try { return JollyDB.getSettings().vibrateEnabled !== false; } catch (e) { return true; }
  }
  // Hər düymə/interaktiv elementə basılanda incə titrəyiş
  document.addEventListener('pointerdown', (e) => {
    if (!vibeOn()) return;
    const el = e.target.closest('.btn, button, .chip, .nav-item, .studio-card, .qa-item, .list-row');
    if (!el) return;
    try { navigator.vibrate && navigator.vibrate(7); } catch (err) {}
  }, { passive: true });
})();
