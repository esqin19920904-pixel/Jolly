/* ╔══════════════════════════════════════════════════════════════════╗
   ║  JOLLY NEON EDGE PULSE — Quick Actions + Animations + FX        ║
   ║  Edge panel-ə neon işıqlı, funksional quick actions əlavə edir  ║
   ║  DÜZƏLİŞ: AXTAR/SKAN → #/home (axtarış qutusu və skan düyməsi   ║
   ║  yalnız burdadır), AI/STUDIO → real topbar düymələrinə klik      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

const JollyNeonEdge = {
  id: 'neon-edge',
  name: 'Neon Edge',
  icon: '⚡',
  route: '#/neon-edge',
  group: 'System',
  enabled: true,
  inMenu: false,
  inEdge: true,

  neonColors: {
    gold: '#f5c563',
    goldGlow: 'rgba(245, 197, 99, 0.6)',
    cyan: '#00f5ff',
    cyanGlow: 'rgba(0, 245, 255, 0.5)',
    pink: '#ff00aa',
    pinkGlow: 'rgba(255, 0, 170, 0.5)',
    green: '#00ff88',
    greenGlow: 'rgba(0, 255, 136, 0.5)',
    purple: '#b829f7',
    purpleGlow: 'rgba(184, 41, 247, 0.5)',
    orange: '#ff6b35',
    orangeGlow: 'rgba(255, 107, 53, 0.5)',
    red: '#ff3366',
    redGlow: 'rgba(255, 51, 102, 0.5)'
  },

  quickActions: [
    {
      id: 'quick-products',
      label: 'MƏHSULLAR',
      icon: '📦',
      color: 'gold',
      shortcut: 'Swipe ↑',
      action: () => {
        JollyNeonEdge._playSound('tap');
        JollyNeonEdge._haptic([50, 30, 50]);
        location.hash = '#/products';
      }
    },
    {
      id: 'quick-search',
      label: 'AXTAR',
      icon: '🔍',
      color: 'cyan',
      shortcut: 'Swipe ↓',
      action: () => {
        JollyNeonEdge._playSound('search');
        JollyNeonEdge._haptic([30, 50, 30]);
        // Axtarış qutusu YALNIZ ana səhifədədir (#/home), #/products deyil
        location.hash = '#/home';
        setTimeout(() => {
          const searchInput = document.getElementById('homeSearch');
          if (searchInput) {
            searchInput.focus();
            searchInput.click();
          }
        }, 400);
      }
    },
    {
      id: 'quick-scan',
      label: 'SKAN',
      icon: '📷',
      color: 'green',
      shortcut: 'Long tap',
      action: () => {
        JollyNeonEdge._playSound('scan');
        JollyNeonEdge._haptic([20, 20, 20, 20, 20]);
        // Skan düyməsi YALNIZ ana səhifədədir (#/home), #/products deyil
        location.hash = '#/home';
        setTimeout(() => {
          const scanBtn = document.querySelector('.scan-btn');
          if (scanBtn) scanBtn.click();
        }, 400);
      }
    },
    {
      id: 'quick-ai',
      label: 'JOLLY AI',
      icon: '🧠',
      color: 'purple',
      shortcut: 'Double tap',
      action: () => {
        JollyNeonEdge._playSound('ai');
        JollyNeonEdge._haptic([100]);
        // Hash-ə güvənmək əvəzinə real topbar düyməsinə klik simulyasiyası —
        // "#/ai" adlı route-un mövcudluğu təsdiqlənməyib, bu yol daha etibarlıdır
        const aiBtn = document.getElementById('topAiBtn');
        if (aiBtn) aiBtn.click();
      }
    },
    {
      id: 'quick-drafts',
      label: 'GƏLƏN MALLAR',
      icon: '📸',
      color: 'pink',
      shortcut: 'Swipe →',
      action: () => {
        JollyNeonEdge._playSound('camera');
        JollyNeonEdge._haptic([40, 40]);
        location.hash = '#/drafts';
      }
    },
    {
      id: 'quick-studio',
      label: 'STUDIO',
      icon: '🎨',
      color: 'orange',
      shortcut: 'Swipe ←',
      action: () => {
        JollyNeonEdge._playSound('success');
        JollyNeonEdge._haptic([60, 20, 60]);
        // Hash-ə güvənmək əvəzinə real topbar düyməsinə klik simulyasiyası —
        // "#/studio" adlı route-un mövcudluğu təsdiqlənməyib, bu yol daha etibarlıdır
        const studiosBtn = document.getElementById('topStudiosBtn');
        if (studiosBtn) studiosBtn.click();
      }
    }
  ],

  liveStats: {
    items: 0,
    todayAdded: 0,
    imageless: 0,
    barcodeless: 0,
    lastUpdate: null
  },

  render(sub) {
    const c = this.neonColors;
    const actions = this.quickActions;
    this._refreshStats();

    return `
    <div class="neon-edge-container">
      <div class="neon-edge-header">
        <div class="neon-pulse-ring"></div>
        <div class="neon-edge-title">
          <span class="neon-icon">⚡</span>
          <span class="neon-text">QUICK ACTIONS</span>
        </div>
        <div class="neon-edge-subtitle">Sürətli əməliyyatlar</div>
      </div>

      <div class="neon-ticker-wrap">
        <div class="neon-ticker">
          <span class="ticker-item">📦 ${this.liveStats.items} məhsul</span>
          <span class="ticker-dot">•</span>
          <span class="ticker-item">➕ ${this.liveStats.todayAdded} bu gün</span>
          <span class="ticker-dot">•</span>
          <span class="ticker-item">🖼️ ${this.liveStats.imageless} şəkilsiz</span>
          <span class="ticker-dot">•</span>
          <span class="ticker-item">🏷️ ${this.liveStats.barcodeless} barkodsuz</span>
          <span class="ticker-dot">•</span>
          <span class="ticker-item">🕐 ${this.liveStats.lastUpdate || 'İndi'}</span>
        </div>
      </div>

      <div class="neon-actions-grid">
        ${actions.map(a => `
          <button class="neon-action-btn" 
                  data-action="${a.id}"
                  style="--neon-color: ${c[a.color]}; --neon-glow: ${c[a.color + 'Glow']}"
                  onclick="JollyNeonEdge._triggerAction('${a.id}', event)">
            <div class="neon-btn-glow"></div>
            <div class="neon-btn-icon">${a.icon}</div>
            <div class="neon-btn-label">${a.label}</div>
            <div class="neon-btn-shortcut">${a.shortcut}</div>
          </button>
        `).join('')}
      </div>

      <div class="neon-edge-footer">
        <div class="neon-glow-bar"></div>
        <div class="neon-hint">Edge-dən sürüşdürün ↕️↔️</div>
      </div>
    </div>

    <style>
    .neon-edge-container {
      padding: 16px 12px;
      background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 50%, #0d0d0d 100%);
      min-height: 100%;
      position: relative;
      overflow: hidden;
    }

    .neon-edge-container::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(ellipse at 30% 20%, rgba(245,197,99,0.08) 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 80%, rgba(0,245,255,0.05) 0%, transparent 50%);
      animation: neonAmbient 8s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes neonAmbient {
      0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.6; }
      33% { transform: translate(5%, 5%) rotate(2deg); opacity: 1; }
      66% { transform: translate(-3%, -5%) rotate(-1deg); opacity: 0.8; }
    }

    .neon-edge-header {
      text-align: center;
      padding: 20px 0 16px;
      position: relative;
    }

    .neon-pulse-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 2px solid rgba(245,197,99,0.3);
      animation: neonPulse 2s ease-out infinite;
    }

    .neon-pulse-ring::before {
      content: '';
      position: absolute;
      inset: -10px;
      border-radius: 50%;
      border: 1px solid rgba(245,197,99,0.15);
      animation: neonPulse 2s ease-out infinite 0.5s;
    }

    @keyframes neonPulse {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .neon-edge-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      position: relative;
      z-index: 1;
    }

    .neon-icon {
      font-size: 24px;
      filter: drop-shadow(0 0 8px rgba(245,197,99,0.8));
      animation: neonFlicker 3s ease-in-out infinite;
    }

    @keyframes neonFlicker {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
      52% { opacity: 1; }
      54% { opacity: 0.5; }
      56% { opacity: 1; }
    }

    .neon-text {
      font-size: 18px;
      font-weight: 800;
      color: #f5c563;
      text-shadow: 0 0 10px rgba(245,197,99,0.5),
                   0 0 20px rgba(245,197,99,0.3),
                   0 0 40px rgba(245,197,99,0.1);
      letter-spacing: 3px;
    }

    .neon-edge-subtitle {
      font-size: 11px;
      color: rgba(245,197,99,0.6);
      margin-top: 4px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .neon-ticker-wrap {
      overflow: hidden;
      background: rgba(0,0,0,0.4);
      border-radius: 20px;
      margin: 12px 0 16px;
      border: 1px solid rgba(245,197,99,0.15);
      position: relative;
    }

    .neon-ticker-wrap::before,
    .neon-ticker-wrap::after {
      content: '';
      position: absolute;
      top: 0;
      width: 40px;
      height: 100%;
      z-index: 2;
      pointer-events: none;
    }

    .neon-ticker-wrap::before {
      left: 0;
      background: linear-gradient(90deg, #0a0a0a, transparent);
    }

    .neon-ticker-wrap::after {
      right: 0;
      background: linear-gradient(-90deg, #0a0a0a, transparent);
    }

    .neon-ticker {
      display: flex;
      gap: 16px;
      padding: 10px 0;
      animation: neonTicker 15s linear infinite;
      white-space: nowrap;
      width: max-content;
    }

    @keyframes neonTicker {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .ticker-item {
      font-size: 12px;
      color: rgba(255,255,255,0.8);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ticker-dot {
      color: #f5c563;
      font-size: 20px;
      line-height: 1;
      text-shadow: 0 0 10px rgba(245,197,99,0.8);
    }

    .neon-actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      position: relative;
      z-index: 1;
    }

    .neon-action-btn {
      position: relative;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 20px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      overflow: hidden;
      transition: all 0.3s ease;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }

    .neon-action-btn:active {
      transform: scale(0.95);
    }

    .neon-btn-glow {
      position: absolute;
      inset: 0;
      border-radius: 16px;
      opacity: 0;
      transition: opacity 0.3s ease;
      background: radial-gradient(ellipse at center, var(--neon-glow) 0%, transparent 70%);
    }

    .neon-action-btn:hover .neon-btn-glow,
    .neon-action-btn.active .neon-btn-glow {
      opacity: 1;
    }

    .neon-action-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 16px;
      padding: 1.5px;
      background: linear-gradient(135deg, var(--neon-color), transparent 50%, var(--neon-color));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      opacity: 0.5;
      transition: opacity 0.3s ease;
    }

    .neon-action-btn:hover::before,
    .neon-action-btn.active::before {
      opacity: 1;
    }

    .neon-btn-icon {
      font-size: 32px;
      filter: drop-shadow(0 0 8px var(--neon-glow));
      transition: transform 0.3s ease;
    }

    .neon-action-btn:hover .neon-btn-icon,
    .neon-action-btn.active .neon-btn-icon {
      transform: scale(1.15) translateY(-2px);
    }

    .neon-btn-label {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 1px;
    }

    .neon-btn-shortcut {
      font-size: 9px;
      color: rgba(255,255,255,0.4);
      letter-spacing: 1px;
    }

    .neon-edge-footer {
      margin-top: 20px;
      text-align: center;
      position: relative;
      z-index: 1;
    }

    .neon-glow-bar {
      height: 2px;
      background: linear-gradient(90deg, transparent, #f5c563, #00f5ff, #f5c563, transparent);
      border-radius: 2px;
      margin-bottom: 10px;
      animation: neonGlowBar 3s ease-in-out infinite;
    }

    @keyframes neonGlowBar {
      0%, 100% { opacity: 0.5; filter: blur(0px); }
      50% { opacity: 1; filter: blur(1px); }
    }

    .neon-hint {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      letter-spacing: 1px;
    }

    .neon-ripple {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, var(--neon-color) 0%, transparent 70%);
      transform: scale(0);
      animation: neonRipple 0.6s ease-out;
      pointer-events: none;
    }

    @keyframes neonRipple {
      to { transform: scale(4); opacity: 0; }
    }
    </style>
    `;
  },

  init() {
    this._setupGestures();
    this._startStatsRefresh();
    console.log('⚡ JOLLY Neon Edge Pulse aktivləşdi!');
  },

  _triggerAction(actionId, event) {
    event.preventDefault();
    event.stopPropagation();
    const action = this.quickActions.find(a => a.id === actionId);
    if (action) {
      this._createRipple(event);
      action.action();
    }
  },

  _createRipple(e) {
    const btn = e.currentTarget || e.target.closest('.neon-action-btn');
    if (!btn) return;
    const ripple = document.createElement('div');
    ripple.className = 'neon-ripple';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const touch = e.touches && e.touches[0] ? e.touches[0] : e;
    const x = (touch.clientX || e.clientX || rect.left + rect.width/2) - rect.left;
    const y = (touch.clientY || e.clientY || rect.top + rect.height/2) - rect.top;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (x - size/2) + 'px';
    ripple.style.top = (y - size/2) + 'px';
    ripple.style.setProperty('--neon-color', getComputedStyle(btn).getPropertyValue('--neon-color'));
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  },

  _playSound(type) {
    if (typeof JollySound !== 'undefined') {
      const sounds = {
        tap: 'tap',
        search: 'tap',
        scan: 'beep',
        ai: 'success',
        camera: 'tap',
        success: 'success'
      };
      const soundName = sounds[type] || 'tap';
      if (typeof JollySound[soundName] === 'function') {
        JollySound[soundName]();
      }
    }
  },

  _haptic(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  },

  _refreshStats() {
    try {
      const products = JSON.parse(localStorage.getItem('jolly_products') || '[]');
      this.liveStats.items = products.length;

      const today = new Date().toDateString();
      this.liveStats.todayAdded = products.filter(p => {
        const date = p.createdAt || p.date || p.addedAt;
        return date && new Date(date).toDateString() === today;
      }).length;

      this.liveStats.imageless = products.filter(p => {
        return !p.images || p.images.length === 0;
      }).length;

      this.liveStats.barcodeless = products.filter(p => {
        return !p.barcodes || p.barcodes.length === 0;
      }).length;

      this.liveStats.lastUpdate = new Date().toLocaleTimeString('az-AZ', {hour: '2-digit', minute:'2-digit'});
    } catch(e) {
      console.log('Stats refresh error:', e);
    }
  },

  _startStatsRefresh() {
    setInterval(() => this._refreshStats(), 30000);
  },

  _setupGestures() {
    let startY = 0, startX = 0;
    let edgeTriggered = false;

    document.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      edgeTriggered = false;
    }, {passive: true});

    document.addEventListener('touchmove', (e) => {
      if (edgeTriggered) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = startX - currentX;
      const diffY = startY - currentY;

      const edgeSelectors = [
        '.edge-panel.open',
        '.edge-panel-active',
        '.edge-open',
        '[class*="edge-open"]',
        '.edge-visible',
        '#edge-panel.active',
        '.jolly-edge.active'
      ];
      const edgeOpen = edgeSelectors.some(sel => document.querySelector(sel));
      if (!edgeOpen) return;

      if (diffY > 60 && Math.abs(diffX) < 40) {
        edgeTriggered = true;
        this._haptic([30, 30, 30]);
        location.hash = '#/products';
      }
      else if (diffY < -60 && Math.abs(diffX) < 40) {
        edgeTriggered = true;
        this._haptic([30, 30, 30]);
        location.hash = '#/home';
        setTimeout(() => {
          const searchInput = document.getElementById('homeSearch');
          if (searchInput) searchInput.focus();
        }, 400);
      }
      else if (diffX < -60 && Math.abs(diffY) < 40) {
        edgeTriggered = true;
        this._haptic([30, 30, 30]);
        location.hash = '#/drafts';
      }
      else if (diffX > 60 && Math.abs(diffY) < 40) {
        edgeTriggered = true;
        this._haptic([30, 30, 30]);
        const studiosBtn = document.getElementById('topStudiosBtn');
        if (studiosBtn) studiosBtn.click();
      }
    }, {passive: true});
  }
};

if (typeof ModuleRegistry !== 'undefined') {
  ModuleRegistry.register(JollyNeonEdge);
}
