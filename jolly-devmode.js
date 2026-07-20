/* ============================================================
   JOLLY Developer Mode — loglar, performans, modul yüklənmə
   vaxtı və sazlama alətləri. Yalnız Admin-ə görünür.
   ============================================================ */
(function () {
  if (typeof ModuleRegistry === 'undefined') return;

  function _isAdmin() {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return s && s.role === 'admin';
    } catch (e) { return false; }
  }

  function _fmtMs(ms) {
    if (ms == null) return '—';
    return ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(2) + ' s';
  }

  function _navTiming() {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        return {
          domReady: nav.domContentLoadedEventEnd - nav.startTime,
          fullLoad: nav.loadEventEnd - nav.startTime,
          ttfb: nav.responseStart - nav.startTime,
        };
      }
    } catch (e) {}
    return { domReady: null, fullLoad: null, ttfb: null };
  }

  function _moduleTimings() {
    try {
      return performance.getEntriesByType('resource')
        .filter(r => r.initiatorType === 'script' && r.name.endsWith('.js'))
        .map(r => ({ name: r.name.split('/').pop(), duration: r.duration }))
        .sort((a, b) => b.duration - a.duration);
    } catch (e) { return []; }
  }

  function _draw() {
    const wrap = document.getElementById('jdev-wrap');
    if (!wrap) return;

    const timing = _navTiming();
    const modules = _moduleTimings();
    const slowest = modules.slice(0, 15);
    const eventLog = (window.JollyEvents ? JollyEvents.history() : []).slice(0, 30);
    const activity = (window.JollyDB ? JollyDB.getActivity() : []).slice(0, 20);

    wrap.innerHTML = `
      <style>
        .jdev-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; margin-bottom:14px; }
        .jdev-row { display:flex; justify-content:space-between; padding:6px 0; font-size:12.5px; border-bottom:1px solid rgba(255,255,255,0.05); }
        .jdev-row:last-child { border-bottom:none; }
        .jdev-mono { font-family:monospace; font-size:11.5px; color:rgba(255,255,255,0.6); }
        .jdev-btn { padding:9px 14px; border-radius:9px; background:rgba(0,212,255,0.08); border:1px solid rgba(0,212,255,0.25); color:#00d4ff; font-size:12px; margin-right:8px; margin-bottom:8px; }
      </style>

      <h2 style="font-size:18px;margin:0 0 4px;">🛠️ Developer Mode</h2>
      <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0 0 16px;">Yalnız Admin görür — loglar, performans, modul yüklənmə vaxtı</p>

      <div class="jdev-card">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">⏱️ Açılış performansı</div>
        <div class="jdev-row"><span>Serverdən ilk cavab (TTFB)</span><span>${_fmtMs(timing.ttfb)}</span></div>
        <div class="jdev-row"><span>DOM hazır</span><span>${_fmtMs(timing.domReady)}</span></div>
        <div class="jdev-row"><span>Tam yüklənmə</span><span>${_fmtMs(timing.fullLoad)}</span></div>
        <div class="jdev-row"><span>Ümumi skript sayı</span><span>${document.scripts.length}</span></div>
      </div>

      <div class="jdev-card">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">📦 Ən yavaş 15 modul (yüklənmə vaxtına görə)</div>
        ${slowest.length ? slowest.map(m => `
          <div class="jdev-row"><span class="jdev-mono">${m.name}</span><span>${_fmtMs(m.duration)}</span></div>
        `).join('') : '<div style="font-size:12px;color:rgba(255,255,255,0.4);">Məlumat yoxdur (brauzer dəstəkləmir)</div>'}
      </div>

      <div class="jdev-card">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">🔔 Event Bus tarixçəsi (son 30)</div>
        <div style="max-height:260px;overflow-y:auto;">
          ${eventLog.length ? eventLog.map(e => `
            <div class="jdev-row" style="flex-direction:column;align-items:flex-start;">
              <div><b>${e.event}</b> <span class="jdev-mono">${new Date(e.time).toLocaleTimeString('az-AZ')}</span></div>
              <div class="jdev-mono" style="word-break:break-all;">${JSON.stringify(e.payload)}</div>
            </div>
          `).join('') : '<div style="font-size:12px;color:rgba(255,255,255,0.4);">Hələ hadisə yoxdur</div>'}
        </div>
      </div>

      <div class="jdev-card">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">📋 Fəaliyyət jurnalı (son 20)</div>
        <div style="max-height:220px;overflow-y:auto;">
          ${activity.length ? activity.map(a => `
            <div class="jdev-row"><span>${a.text || a.action || JSON.stringify(a)}</span><span class="jdev-mono">${a.ts ? new Date(a.ts).toLocaleTimeString('az-AZ') : ''}</span></div>
          `).join('') : '<div style="font-size:12px;color:rgba(255,255,255,0.4);">Hələ fəaliyyət yoxdur</div>'}
        </div>
      </div>

      <div class="jdev-card">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">🔧 Sazlama alətləri</div>
        <button class="jdev-btn" onclick="JollyDevMode.toggleEventDebug()">${window.JollyEvents && window._jdevDebugOn ? '🔴 Event konsolu bağla' : '🟢 Event konsolu aç'}</button>
        <button class="jdev-btn" onclick="JollyDevMode.copyReport()">📋 Hesabatı kopyala</button>
        <button class="jdev-btn" onclick="JollyDevMode.refresh()">🔄 Yenilə</button>
      </div>
    `;
  }

  window.JollyDevMode = {
    toggleEventDebug() {
      if (!window.JollyEvents) return;
      window._jdevDebugOn = !window._jdevDebugOn;
      if (window._jdevDebugOn) JollyEvents.enableDebug();
      else JollyEvents.disableDebug();
      _draw();
      if (window.Toast) Toast.info(window._jdevDebugOn ? 'Event konsolu açıldı (brauzer konsoluna baxın)' : 'Event konsolu bağlandı');
    },
    copyReport() {
      const timing = _navTiming();
      const modules = _moduleTimings().slice(0, 15);
      const events = window.JollyEvents ? JollyEvents.history().slice(0, 20) : [];
      const report = [
        '=== JOLLY Developer Report ===',
        `Tarix: ${new Date().toLocaleString('az-AZ')}`,
        `DOM hazır: ${_fmtMs(timing.domReady)} | Tam yüklənmə: ${_fmtMs(timing.fullLoad)}`,
        '',
        '--- Ən yavaş modullar ---',
        ...modules.map(m => `${m.name}: ${_fmtMs(m.duration)}`),
        '',
        '--- Son hadisələr ---',
        ...events.map(e => `${new Date(e.time).toLocaleTimeString('az-AZ')} ${e.event} ${JSON.stringify(e.payload)}`),
      ].join('\n');

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report).then(() => {
          if (window.Toast) Toast.success('Hesabat kopyalandı — Claude-a yapışdıra bilərsən');
        }).catch(() => {
          if (window.Toast) Toast.error('Kopyalama alınmadı');
        });
      }
    },
    refresh() { _draw(); },
  };

  ModuleRegistry.register({
    id: 'devmode',
    name: 'Developer Mode',
    icon: '🛠️',
    route: '#/studios/devmode',
    group: 'Sistem',
    enabled: true,

    render() {
      if (!_isAdmin()) {
        if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
        return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
      }
      return `
        <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
        <div id="jdev-wrap"></div>
      `;
    },

    afterRender() { _draw(); },
  });
})();
