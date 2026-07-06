/* ============================================================
   JOLLY Reveal — barmaq/kursoru izləyən işıq (Fluent Reveal tərzi)
   ============================================================ */

(function () {
  const SELECTOR = '.product-card, .studio-card, .dash-card';

  function updatePos(el, x, y) {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (x - r.left) + 'px');
    el.style.setProperty('--my', (y - r.top) + 'px');
  }

  function bind() {
    document.addEventListener('touchstart', (e) => {
      const el = e.target.closest(SELECTOR);
      if (!el) return;
      const t = e.touches[0];
      updatePos(el, t.clientX, t.clientY);
      el.classList.add('reveal-on');
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const el = e.target.closest(SELECTOR);
      if (el) setTimeout(() => el.classList.remove('reveal-on'), 180);
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest(SELECTOR);
      if (!el) return;
      updatePos(el, e.clientX, e.clientY);
      el.classList.add('reveal-on');
    }, { passive: true });

    document.addEventListener('pointerout', (e) => {
      const el = e.target.closest(SELECTOR);
      if (el) el.classList.remove('reveal-on');
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
