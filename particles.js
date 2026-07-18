/**
 * JOLLY Store OS — Particle System
 */
class ParticleSystem {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.particles = [];
    this.orbs = [];
    this.mouse = { x: -1000, y: -1000, active: false };
    this.frameCount = 0;
    this.isRunning = false;
    this.config = { particleCount: options.particleCount || 60, connectionDistance: options.connectionDistance || 120, mouseRadius: options.mouseRadius || 150, orbCount: options.orbCount || 4, ...options };
    this.resize();
    this.initParticles();
    this.initOrbs();
    this.bindEvents();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(dpr, dpr);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }
  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.config.particleCount; i++) this.particles.push(this.createParticle());
  }
  createParticle() {
    return { x: Math.random() * this.width, y: Math.random() * this.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, radius: Math.random() * 2 + 1, opacity: Math.random() * 0.5 + 0.2, color: ['0,212,255','99,102,241','168,85,247','236,72,153'][Math.floor(Math.random() * 4)], phase: Math.random() * Math.PI * 2 };
  }
  initOrbs() {
    this.orbs = [];
    for (let i = 0; i < this.config.orbCount; i++) this.orbs.push({ x: Math.random() * this.width, y: Math.random() * this.height, radius: Math.random() * 100 + 60, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, color: ['0,212,255','99,102,241','168,85,247'][Math.floor(Math.random() * 3)], opacity: Math.random() * 0.08 + 0.02 });
  }
  bindEvents() {
    window.addEventListener('resize', () => { this.resize(); this.initParticles(); this.initOrbs(); });
    window.addEventListener('touchmove', (e) => { if (e.touches.length > 0) { this.mouse.x = e.touches[0].clientX; this.mouse.y = e.touches[0].clientY; this.mouse.active = true; } }, { passive: true });
    window.addEventListener('touchend', () => { this.mouse.active = false; });
  }
  updateParticles() {
    const time = Date.now() * 0.001;
    for (const p of this.particles) {
      p.x += p.vx + Math.sin(time + p.phase) * 0.2;
      p.y += p.vy + Math.cos(time + p.phase * 0.7) * 0.2;
      p.vx *= 0.99; p.vy *= 0.99;
      if (p.x < -10) p.x = this.width + 10;
      if (p.x > this.width + 10) p.x = -10;
      if (p.y < -10) p.y = this.height + 10;
      if (p.y > this.height + 10) p.y = -10;
    }
  }
  updateOrbs() {
    for (const orb of this.orbs) {
      orb.x += orb.vx; orb.y += orb.vy;
      if (orb.x < -orb.radius) orb.x = this.width + orb.radius;
      if (orb.x > this.width + orb.radius) orb.x = -orb.radius;
      if (orb.y < -orb.radius) orb.y = this.height + orb.radius;
      if (orb.y > this.height + orb.radius) orb.y = -orb.radius;
    }
  }
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (const orb of this.orbs) {
      const g = this.ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
      g.addColorStop(0, `rgba(${orb.color},${orb.opacity})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = g;
      this.ctx.fillRect(orb.x - orb.radius, orb.y - orb.radius, orb.radius * 2, orb.radius * 2);
    }
    for (const p of this.particles) {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
      this.ctx.fill();
    }
  }
  animate() {
    if (!this.isRunning) return;
    this.frameCount++;
    this.updateParticles();
    this.updateOrbs();
    if (this.frameCount % 2 === 0) this.render();
    requestAnimationFrame(() => this.animate());
  }
  start() { if (this.isRunning) return; this.isRunning = true; this.animate(); }
  stop() { this.isRunning = false; }
}
