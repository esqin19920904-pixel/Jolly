/**
 * JOLLY Store OS — UI Utilities
 */
const JollyUI = {
  theme: {
    current: 'dark',
    init() {
      const saved = localStorage.getItem('jolly-theme');
      this.set(saved || 'dark');
    },
    set(mode) {
      this.current = mode;
      document.documentElement.setAttribute('data-theme', mode);
      localStorage.setItem('jolly-theme', mode);
      document.body.style.background = mode === 'amoled' ? '#000000' : '';
    },
    toggle() { this.set(this.current === 'dark' ? 'amoled' : 'dark'); }
  },
  isMobile() { return window.innerWidth < 768; },
  isTouch() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; },
  vibrate(pattern = [50]) { if (navigator.vibrate) navigator.vibrate(pattern); },
  toast(message, type = 'info', duration = 3000) {
    const colors = { info: 'rgba(0,212,255,0.9)', success: 'rgba(34,197,94,0.9)', error: 'rgba(239,68,68,0.9)', warning: 'rgba(249,115,22,0.9)' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(20px);background:${colors[type]||colors.info};color:#000;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;z-index:9999;opacity:0;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);box-shadow:0 8px 32px rgba(0,0,0,0.3);`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(() => toast.remove(), 300); }, duration);
  },
  initMouseGlow() {
    document.querySelectorAll('.role-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
        card.style.setProperty('--mouse-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
      });
    });
  },
  initKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { const btn = document.querySelector('.screen.active .back-btn'); if (btn) btn.click(); }
      if (e.key === 'Enter') { const f = document.activeElement; if (f && f.tagName !== 'INPUT') f.click(); }
    });
  },
  initOrientationHandler() {
    window.addEventListener('orientationchange', () => setTimeout(() => window.dispatchEvent(new Event('resize')), 300));
  },
  init() { this.theme.init(); this.initMouseGlow(); this.initKeyboardNav(); this.initOrientationHandler(); }
};
if (typeof module !== 'undefined' && module.exports) module.exports = JollyUI;
