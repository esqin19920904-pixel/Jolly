/* ============================================================
   JOLLY Offline Diagnostic
   Service Worker keşini yoxla, offline-ə keçən zaman nə baş
   verdiyini izlə, xəbərdarlıq ver
   
   YENİ (2026-07-27, #4): Offline rejim diaqnozu
   ============================================================ */

const JollyOfflineDiagnostic = (() => {
  const LOG_KEY = 'jolly_offline_log';

  function _log(msg, level = 'info') {
    try {
      const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      logs.push({
        ts: Date.now(),
        level,
        msg,
      });
      if (logs.length > 100) logs.shift(); // Maksimum 100 qeyd saxla
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e) {}
  }

  async function checkCacheStatus() {
    try {
      const caches_list = await caches.keys();
      const cache_info = {};
      
      for (const cache_name of caches_list) {
        const cache = await caches.open(cache_name);
        const requests = await cache.keys();
        cache_info[cache_name] = {
          size: requests.length,
          files: requests.map(r => r.url.split('/').pop()).slice(0, 10),
        };
      }
      
      return cache_info;
    } catch (e) {
      _log('Cache kontrol xətası: ' + e.message, 'error');
      return { error: e.message };
    }
  }

  async function checkServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) {
        return { status: 'unavailable', reason: 'Service Worker dəstəklənmir' };
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return { status: 'not_registered', reason: 'Service Worker qeyd edilməyib' };
      }
      return {
        status: 'registered',
        scope: registration.scope,
        active: !!registration.active,
        waiting: !!registration.waiting,
      };
    } catch (e) {
      _log('SW kontrol xətası: ' + e.message, 'error');
      return { status: 'error', reason: e.message };
    }
  }

  async function diagnose() {
    const report = {
      timestamp: new Date().toLocaleString('az-AZ'),
      online: navigator.onLine,
      sw: await checkServiceWorker(),
      cache: await checkCacheStatus(),
      storage: {
        localStorage_available: (() => { try { localStorage.getItem('test'); return true; } catch (e) { return false; } })(),
        indexedDB_available: !!window.indexedDB,
      },
      db: {
        products: typeof JollyDB !== 'undefined' ? (JollyDB.Products.all().length + ' ədəd') : 'yüklənməyib',
        hasSettings: typeof JollyDB !== 'undefined' ? !!JollyDB.getSettings() : false,
      },
    };
    
    _log('Offline diaqnozu: ' + JSON.stringify(report), 'info');
    return report;
  }

  function showDiagnosticUI() {
    return `
      <div style="padding:16px;background:rgba(124,138,255,0.1);border-radius:10px;border:1px solid rgba(124,138,255,0.3);margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;">🔍 Offline Diaqnozu</h3>
        <div id="diagnostic-report" style="font-size:12px;font-family:monospace;line-height:1.6;">
          <div>⏳ Yoxlanılır...</div>
        </div>
      </div>
    `;
  }

  async function renderDiagnosticPanel() {
    const report = await diagnose();
    const html = `
      <h3 style="margin-top:0;">🔍 Offline Diaqnozu</h3>
      <div style="font-size:12px;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;margin-bottom:12px;font-family:monospace;line-height:1.8;">
        <div><strong>Onlayn status:</strong> ${report.online ? '✅ ONLAYN' : '🔴 OFFLINE'}</div>
        <div><strong>Service Worker:</strong> ${report.sw.status === 'registered' ? '✅ Qeyd edilib' : '❌ ' + report.sw.status}</div>
        <div><strong>Cache sistem:</strong> ${report.cache.error ? '❌ ' + report.cache.error : Object.keys(report.cache).length + ' keş'}</div>
        <div><strong>localStorage:</strong> ${report.storage.localStorage_available ? '✅' : '❌'}</div>
        <div><strong>IndexedDB:</strong> ${report.storage.indexedDB_available ? '✅' : '❌'}</div>
        <div><strong>Məhsul sayı:</strong> ${report.db.products}</div>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:8px 0;">
        <details>
          <summary style="cursor:pointer;">📋 Tam Report</summary>
          <div style="margin-top:8px;white-space:pre-wrap;word-break:break-word;font-size:10px;">
${JSON.stringify(report, null, 2)}
          </div>
        </details>
      </div>
    `;
    return html;
  }

  function getLogs() {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function clearLogs() {
    try {
      localStorage.removeItem(LOG_KEY);
    } catch (e) {}
  }

  // Offline-ə keçən zaman xəbərdarlıq
  window.addEventListener('offline', () => {
    _log('Offline moda keçildi', 'warning');
    if (typeof Toast !== 'undefined') {
      Toast.warn('📡 İnternet əlaqəsi kəsildi — offline rejim aktiv');
    }
  });

  window.addEventListener('online', () => {
    _log('Online moda keçildi', 'info');
    if (typeof Toast !== 'undefined') {
      Toast.success('📡 İnternet bağlandı');
    }
  });

  // Başlanğıçda diaqnoz
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (!navigator.onLine) {
        diagnose();
      }
    }, 1000);
  });

  return { diagnose, renderDiagnosticPanel, getLogs, clearLogs };
})();
