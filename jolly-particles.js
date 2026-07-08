/* ==========================================================================
   JOLLY PARTICLE SYSTEM (jolly-particles.js)
   ==========================================================================
   Sadə, sürətli Canvas 2D hissəcik (particle) sistemi. three.js YOXDUR,
   xarici kitabxana YOXDUR — tam yerli, ~3KB.

   Üç effekt:
   - goldBurst(x, y)   → qızılı toz partlayışı (məhsul saxlananda)
   - confettiGreen()   → yaşıl konfeti (PIN düzgün olanda)
   - sparkleBurst(x,y) → incə parıltılar (edge panel açılanda)

   Avtomatik qoşulma (mövcud fayllara TOXUNMADAN, "monkey patch" ilə):
   - JollyApp.celebrate varsa, ona qızılı partlayış əlavə olunur (yeni məhsul)
   - JollyEdgePanel.open varsa, ona sparkle effekti əlavə olunur
   - PIN yoxlaması harda olduğu bilinmədiyi üçün avtomatik qoşulmayıb —
     lazım olsa JollyParticles.confettiGreen() heç yerdən çağırıla bilər

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də ƏN SONA (app.js-dən sonra) əlavə et:
      <script src="jolly-particles.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  let canvas, ctx;
  let particles = [];
  let rafId = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "jolly-particles-canvas";
    canvas.style.cssText = `
      position: fixed; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 999999;
    `;
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.life -= p.decay;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.shape === "rect") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glow || 0;
        ctx.fill();
      }
      ctx.restore();
    });

    if (particles.length > 0) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  function ensureLoopRunning() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function spawnParticle(opts) {
    particles.push({
      x: opts.x, y: opts.y,
      vx: opts.vx, vy: opts.vy,
      gravity: opts.gravity != null ? opts.gravity : 0.15,
      drag: opts.drag != null ? opts.drag : 0.98,
      size: opts.size || 4,
      color: opts.color,
      life: 1,
      decay: opts.decay || 0.02,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      shape: opts.shape || "circle",
      glow: opts.glow || 0
    });
  }

  // --------------------------------------------------------------------
  // EFFEKT 1: Qızılı toz partlayışı (məhsul saxlananda)
  // --------------------------------------------------------------------
  function goldBurst(x, y, count) {
    ensureCanvas();
    x = x != null ? x : window.innerWidth / 2;
    y = y != null ? y : window.innerHeight / 2;
    count = count || 34;
    const colors = ["#d4af37", "#f4d675", "#fff3c4", "#b8860b"];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 2 + Math.random() * 5;
      spawnParticle({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: 0.015 + Math.random() * 0.015,
        glow: 6
      });
    }
    ensureLoopRunning();
  }

  // --------------------------------------------------------------------
  // EFFEKT 2: Yaşıl konfeti (PIN düzgün olanda)
  // --------------------------------------------------------------------
  function confettiGreen(count) {
    ensureCanvas();
    count = count || 70;
    const colors = ["#4caf50", "#8bc34a", "#a5d6a7", "#2e7d32", "#d4af37"];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * window.innerWidth;
      spawnParticle({
        x, y: -10,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 3,
        size: 5 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.08,
        drag: 0.995,
        decay: 0.006 + Math.random() * 0.008,
        shape: "rect"
      });
    }
    ensureLoopRunning();
  }

  // --------------------------------------------------------------------
  // EFFEKT 3: Neon parıltılar (edge panel açılanda)
  // --------------------------------------------------------------------
  function sparkleBurst(x, y, count) {
    ensureCanvas();
    x = x != null ? x : window.innerWidth - 40;
    y = y != null ? y : 60;
    count = count || 16;
    const colors = ["#d4af37", "#f4d675", "#fff"];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      spawnParticle({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.02,
        drag: 0.96,
        decay: 0.02 + Math.random() * 0.02,
        glow: 8
      });
    }
    ensureLoopRunning();
  }

  // --------------------------------------------------------------------
  // PUBLİK API
  // --------------------------------------------------------------------
  window.JollyParticles = { goldBurst, confettiGreen, sparkleBurst };

  // --------------------------------------------------------------------
  // AVTOMATIK QOŞULMA (monkey patch, mövcud fayllara toxunmadan)
  // --------------------------------------------------------------------
  function attachHooks() {
    if (typeof window.JollyApp !== "undefined" && typeof window.JollyApp.celebrate === "function") {
      const originalCelebrate = window.JollyApp.celebrate;
      window.JollyApp.celebrate = function (...args) {
        originalCelebrate.apply(this, args);
        goldBurst();
      };
      console.log("[JollyParticles] JollyApp.celebrate-ə qoşuldu ✅");
    }

    if (typeof window.JollyEdgePanel !== "undefined" && typeof window.JollyEdgePanel.open === "function") {
      const originalOpen = window.JollyEdgePanel.open;
      window.JollyEdgePanel.open = function (...args) {
        originalOpen.apply(this, args);
        sparkleBurst();
      };
      console.log("[JollyParticles] JollyEdgePanel.open-a qoşuldu ✅");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachHooks);
  } else {
    attachHooks();
  }
})();
