/* ============================================================
   JOLLY FX Engine — Aurora canlı fon + toxunuş zərrəcikləri
   Ayarlar: settings.fxEnabled (Theme Studio-dan idarə olunur)
   ============================================================ */

const JollyFXEngine = (() => {
  function fxOn() {
    try { return JollyDB.getSettings().fxEnabled !== false; } catch (e) { return true; }
  }

  /* ---------- Aurora fon ---------- */
  function initAurora() {
    if (document.getElementById('auroraBg')) return;
    const wrap = document.createElement('div');
    wrap.id = 'auroraBg';
    wrap.className = 'aurora-bg';
    wrap.innerHTML = `
      <div class="aurora-blob a1"></div>
      <div class="aurora-blob a2"></div>
      <div class="aurora-blob a3"></div>
    `;
    document.body.insertBefore(wrap, document.body.firstChild);
  }

  /* ---------- Toxunuş zərrəcikləri ---------- */
  function spawnParticles(x, y, color) {
    if (!fxOn()) return;
    const colors = color ? [color] : ['#7c8aff', '#29e0c9', '#ff5fa2'];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'fx-particle';
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 26 + Math.random() * 24;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--px', (Math.cos(angle) * dist) + 'px');
      p.style.setProperty('--py', (Math.sin(angle) * dist) + 'px');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 650);
    }
  }

  function initTouchParticles() {
    if (window.__jollyFxTouchBound) return;
    window.__jollyFxTouchBound = true;
    document.addEventListener('click', (e) => {
      if (!fxOn()) return;
      const t = e.target.closest('.btn-primary, .fab, .qfab-main, .dash-card, .status-pill, .variant-chip');
      if (!t) return;
      spawnParticles(e.clientX, e.clientY);
    });
  }

  return { initAurora, initTouchParticles, spawnParticles, fxOn };
})();
