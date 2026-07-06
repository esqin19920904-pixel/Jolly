/* ============================================================
   JOLLY Cleanup — donma qarşısı: route dəyişəndə məcburi təmizlik
   + qlobal xəta jurnalı (window.onerror / unhandledrejection)
   ============================================================ */

const JollyCleanup = (() => {
  const LOG_KEY = 'jolly_error_log';

  /* ---------- Arxada qalan kamera axınlarını dayandır ---------- */
  function stopOrphanStreams() {
    document.querySelectorAll('video').forEach(v => {
      if (v.srcObject) {
        try { v.srcObject.getTracks().forEach(t => t.stop()); } catch (e) {}
        v.srcObject = null;
      }
    });
  }

  /* ---------- Görünməz/asılı qalan overlay-ları təmizlə ---------- */
  function forceCloseOverlays() {
    document.querySelectorAll('.cmd-overlay, .qa-overlay').forEach(el => el.classList.remove('on'));
    document.querySelectorAll('.scan-overlay, .viewer-overlay').forEach(el => el.remove());
    const more = document.getElementById('moreMenuOverlay');
    if (more) more.classList.remove('on');
    if (typeof JollyEdgePanel !== 'undefined') { try { JollyEdgePanel.close(); } catch (e) {} }
    if (typeof JollyCommand !== 'undefined') { try { JollyCommand.hide(); } catch (e) {} }
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }

  function cleanupOnRouteChange() {
    stopOrphanStreams();
    forceCloseOverlays();
  }

  /* ---------- Xəta jurnalı ---------- */
  function logError(source, message, extra) {
    try {
      const list = JollyDB.read(LOG_KEY, []);
      list.unshift({ ts: Date.now(), source, message: String(message || '').slice(0, 500), extra: extra ? String(extra).slice(0, 300) : '', hash: window.location.hash || '' });
      if (list.length > 80) list.length = 80;
      JollyDB.write(LOG_KEY, list);
    } catch (e) { /* JollyDB özü xarab olubsa jurnal saxlanmaz — sükutla keç */ }
  }

  function getLog() { return JollyDB.read(LOG_KEY, []); }
  function clearLog() { JollyDB.write(LOG_KEY, []); }

  function bind() {
    window.addEventListener('hashchange', cleanupOnRouteChange);
    window.addEventListener('error', (e) => {
      logError('window.onerror', e.message, e.filename + ':' + e.lineno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      logError('unhandledrejection', (e.reason && e.reason.message) || e.reason);
    });
    // Səhifə ilk açılışda da bir dəfə təmizlə (reload zamanı asılı qalmış state olmasın)
    setTimeout(cleanupOnRouteChange, 200);
  }

  document.addEventListener('DOMContentLoaded', bind);

  return { cleanupOnRouteChange, forceCloseOverlays, stopOrphanStreams, logError, getLog, clearLog };
})();
