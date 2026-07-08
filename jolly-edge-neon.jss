/* ╔══════════════════════════════════════════════════════════════════╗
   ║  JOLLY EDGE NEON FX — Ripple + Haptic + Sound                   ║
   ║  Mövcud edge cell-lərə toxunma effektləri əlavə edir            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

(function() {
  'use strict';

  // Haptic helper
  function haptic(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // Sound helper
  function playSound(type) {
    if (typeof JollySound === 'undefined') return;
    const sounds = { tap: 'tap', success: 'success' };
    const name = sounds[type] || 'tap';
    if (typeof JollySound.play === 'function') {
      JollySound.play(name);
    } else if (typeof JollySound[name] === 'function') {
      JollySound[name]();
    }
  }

  // Ripple effekti
  function createRipple(e) {
    const cell = e.currentTarget;
    if (!cell) return;

    const ripple = document.createElement('div');
    ripple.className = 'edge-ripple';
    
    const rect = cell.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (x - size/2) + 'px';
    ripple.style.top = (y - size/2) + 'px';
    
    // Rəngi cell-dən al
    const color = getComputedStyle(cell).getPropertyValue('--cell-color').trim() || '#f5c563';
    ripple.style.setProperty('--cell-color', color);

    cell.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }

  // Edge cell-ləri tap və event listener əlavə et
  function initEdgeNeon() {
    const selectors = [
      '.edge-cell',
      '.ec-cell',
      '[class*="edge-cell"]',
      '[class*="ec-cell"]'
    ];

    const cells = document.querySelectorAll(selectors.join(', '));
    
    cells.forEach(cell => {
      // Təkrar əlavə etmə
      if (cell.dataset.neonInit === 'true') return;
      cell.dataset.neonInit = 'true';

      // Touch events
      cell.addEventListener('touchstart', function(e) {
        haptic([15]);
        this.classList.add('neon-active');
      }, {passive: true});

      cell.addEventListener('touchend', function(e) {
        createRipple(e);
        playSound('tap');
        haptic([20, 10]);
        this.classList.remove('neon-active');
      }, {passive: true});

      // Mouse events (desktop test üçün)
      cell.addEventListener('mousedown', function(e) {
        this.classList.add('neon-active');
      });

      cell.addEventListener('mouseup', function(e) {
        createRipple(e);
        playSound('tap');
        this.classList.remove('neon-active');
      });
    });

    console.log('⚡ JOLLY Edge Neon FX aktivləşdi:', cells.length, 'cell');
  }

  // İlk yüklənmədə
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEdgeNeon);
  } else {
    initEdgeNeon();
  }

  // Edge panel açılanda yenidən yoxla (lazy loaded ola bilər)
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        setTimeout(initEdgeNeon, 100);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
