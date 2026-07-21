/* ============================================================
   JOLLY Diag Report — Diaqnostika Hesabatı
   Tam müstəqil modul. Admin kiçik "🩺" düyməsinə basanda tətbiqin
   cari vəziyyətini (versiyalar, xətalar, yaddaş, şəbəkə və s.)
   mətn şəklində toplayır, ekranda göstərir, "Kopyala" düyməsi ilə
   bir toxunuşla panoya köçürür — sən onu birbaşa Claude-a yapışdıra
   bilərsən.
   ============================================================ */
const JollyDiagReport = (() => {
  const MAX_ERRORS = 25;
  const _errors = [];

  // Skriptin yükləndiyi andan etibarən xətaları tut
  window.addEventListener('error', (e) => {
    _push('JS xəta', `${e.message} (${e.filename || '?'}:${e.lineno || '?'})`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    _push('Promise xəta', String((e.reason && e.reason.message) || e.reason || 'naməlum'));
  });

  function _push(type, msg) {
    _errors.push({ t: Date.now(), type, msg });
    if (_errors.length > MAX_ERRORS) _errors.shift();
  }

  function _isAdminSession() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return !sess || sess.role === 'admin';
    } catch (e) { return true; }
  }

  function _checkModule(name) {
    try { return typeof window[name] !== 'undefined' ? '✓' : '✗'; } catch (e) { return '✗'; }
  }

  function _localStorageSizeKb() {
    try {
      let total = 0;
      for (const k in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, k)) {
          total += (localStorage[k] || '').length + k.length;
        }
      }
      return (total / 1024).toFixed(1);
    } catch (e) { return '?'; }
  }

  function _getOtaVersion() {
    try { return localStorage.getItem('jolly_ota_version') || '0'; } catch (e) { return '?'; }
  }

  function _getLastCloudSync() {
    try {
      if (typeof JollyDB === 'undefined' || !JollyDB.getSettings) return 'naməlum';
      const s = JollyDB.getSettings();
      return s && s.lastCloudSync ? new Date(s.lastCloudSync).toLocaleString('az-AZ') : 'heç vaxt';
    } catch (e) { return 'naməlum'; }
  }

  function _getRole() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return sess && sess.role ? sess.role : 'naməlum';
    } catch (e) { return 'naməlum'; }
  }

  async function _getSwStatus() {
    try {
      if (!('serviceWorker' in navigator)) return 'dəstəklənmir';
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return 'qeydiyyatsız';
      const active = reg.active ? 'aktiv' : 'yox';
      const controller = navigator.serviceWorker.controller ? 'nəzarətdə' : 'nəzarətsiz';
      return `${active}, ${controller}`;
    } catch (e) { return 'xəta: ' + e.message; }
  }

  async function _getCacheKeys() {
    try {
      if (!('caches' in window)) return 'dəstəklənmir';
      const keys = await caches.keys();
      return keys.length ? keys.join(', ') : 'boş';
    } catch (e) { return 'xəta: ' + e.message; }
  }

  async function buildReport() {
    const lines = [];
    lines.push('=== JOLLY Diaqnostika Hesabatı ===');
    lines.push('Tarix: ' + new Date().toLocaleString('az-AZ'));
    lines.push('URL: ' + location.href);
    lines.push('Rol: ' + _getRole());
    lines.push('Online: ' + (navigator.onLine ? 'bəli' : 'xeyr'));
    lines.push('User-Agent: ' + navigator.userAgent);
    lines.push('');
    lines.push('--- Versiyalar ---');
    lines.push('OTA versiya (v): ' + _getOtaVersion());
    lines.push('Son bulud sinxronu: ' + _getLastCloudSync());
    lines.push('');
    lines.push('--- Xidmət işçisi (Service Worker) ---');
    lines.push('Vəziyyət: ' + await _getSwStatus());
    lines.push('Keş açarları: ' + await _getCacheKeys());
    lines.push('');
    lines.push('--- Yüklənmiş modullar ---');
    ['JollyDB', 'JollyCloud', 'JollyOTA', 'JollyAnnounce', 'Toast', 'JollyRouter', 'JollyApp'].forEach(m => {
      lines.push(`${_checkModule(m)} ${m}`);
    });
    lines.push('');
    lines.push('--- Yaddaş ---');
    lines.push('localStorage həcmi: ~' + _localStorageSizeKb() + ' KB');
    lines.push('');
    lines.push(`--- Son xətalar (${_errors.length}/${MAX_ERRORS}, skript yükləndikdən sonra) ---`);
    if (!_errors.length) {
      lines.push('(xəta qeydə alınmayıb)');
    } else {
      _errors.forEach(er => {
        lines.push(`[${new Date(er.t).toLocaleTimeString('az-AZ')}] ${er.type}: ${er.msg}`);
      });
    }
    lines.push('');
    lines.push('=== Hesabat sonu ===');
    return lines.join('\n');
  }

  /* ---------------- UI ---------------- */
  function ensureStyles() {
    if (document.getElementById('jollyDiagStyle')) return;
    const style = document.createElement('style');
    style.id = 'jollyDiagStyle';
    style.textContent = `
      #jollyDiagBtn{
        position:fixed;top:14px;right:14px;z-index:9997;
        width:40px;height:40px;border-radius:50%;border:1px solid rgba(212,175,55,.35);
        background:rgba(18,22,42,.85);color:#f4d777;font-size:18px;
        display:flex;align-items:center;justify-content:center;cursor:pointer;
        box-shadow:0 4px 14px rgba(0,0,0,.4);opacity:.55;
      }
      #jollyDiagBtn:active{ opacity:1; transform:scale(.94); }
      #jollyDiagModal{
        position:fixed;inset:0;z-index:999998;background:rgba(5,6,12,.9);
        display:flex;align-items:center;justify-content:center;padding:18px;
        opacity:0;pointer-events:none;transition:opacity .25s ease;
      }
      #jollyDiagModal.show{ opacity:1; pointer-events:auto; }
      #jollyDiagPanel{
        width:100%;max-width:480px;max-height:82vh;background:#12162a;
        border:1px solid rgba(212,175,55,.35);border-radius:18px;
        display:flex;flex-direction:column;overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,.6);
      }
      #jollyDiagPanel h3{ margin:0;padding:14px 16px;font-size:14px;color:#f4d777;
        border-bottom:1px solid rgba(212,175,55,.2); }
      #jollyDiagText{
        flex:1;overflow:auto;margin:0;padding:14px 16px;font-family:monospace;
        font-size:11px;line-height:1.5;color:#c9cdea;white-space:pre-wrap;word-break:break-word;
      }
      #jollyDiagActions{ display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(212,175,55,.2); }
      #jollyDiagActions button{
        flex:1;padding:10px;border-radius:12px;border:none;font-weight:700;font-size:13px;cursor:pointer;
      }
      #jollyDiagCopyBtn{ background:linear-gradient(135deg,#d4af37,#b8912b);color:#1a1206; }
      #jollyDiagCloseBtn{ background:#1c2140;color:#c9cdea;border:1px solid #2c325a !important; }
    `;
    document.head.appendChild(style);
  }

  function injectButton() {
    if (!_isAdminSession()) return;
    if (document.getElementById('jollyDiagBtn')) return;
    ensureStyles();
    const btn = document.createElement('button');
    btn.id = 'jollyDiagBtn';
    btn.textContent = '🩺';
    btn.title = 'Diaqnostika';
    btn.onclick = openModal;
    document.body.appendChild(btn);
  }

  async function openModal() {
    ensureStyles();
    let modal = document.getElementById('jollyDiagModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'jollyDiagModal';
      modal.innerHTML = `
        <div id="jollyDiagPanel">
          <h3>🩺 Diaqnostika Hesabatı</h3>
          <pre id="jollyDiagText">Hazırlanır…</pre>
          <div id="jollyDiagActions">
            <button id="jollyDiagCopyBtn">📋 Kopyala</button>
            <button id="jollyDiagCloseBtn">Bağla</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#jollyDiagCloseBtn').onclick = closeModal;
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }
    requestAnimationFrame(() => modal.classList.add('show'));

    const text = await buildReport();
    modal.querySelector('#jollyDiagText').textContent = text;
    modal.querySelector('#jollyDiagCopyBtn').onclick = () => copyText(text);
  }

  function closeModal() {
    const modal = document.getElementById('jollyDiagModal');
    if (modal) modal.classList.remove('show');
  }

  function copyText(text) {
    const done = () => { if (typeof Toast !== 'undefined') Toast.success('Kopyalandı ✓'); };
    const fail = () => { if (typeof Toast !== 'undefined') Toast.error('Kopyalanmadı, əl ilə seç'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => _fallbackCopy(text, done, fail));
      } else {
        _fallbackCopy(text, done, fail);
      }
    } catch (e) { _fallbackCopy(text, done, fail); }
  }

  function _fallbackCopy(text, done, fail) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? done() : fail();
    } catch (e) { fail(); }
  }

  /* ---------------- Başlat ---------------- */
  function init() { setTimeout(injectButton, 1500); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }

  return { buildReport, openModal };
})();
