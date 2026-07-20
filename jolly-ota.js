/* ============================================================
   JOLLY OTA — İçəridən Yeniləmə Sistemi
   Uzaqdakı bir JSON faylından yeni kod/snippet/ayar çəkir.
   Studios → "Yeniləmələr" bölməsindən idarə olunur.

   YENİ: admin "Hamıya Göndər"ə basanda Firebase-ə anlıq siqnal
   yazılır, açıq olan bütün tətbiqlər dərhal (24 saat gözləmədən)
   yoxlayıb tətbiq edir — çirkin alert() yerinə qızılı toast göstərir.

   DÜZƏLİŞ (2026-07-21): DEFAULT_URL artıq workers.dev yox, öz
   saytının içindəki fayldır — Bakcell workers.dev-i blokladığı
   üçün Zülfiqarın telefonunda "Failed to fetch" verirdi.
   ============================================================ */
const JollyOTA = (() => {
  const DEFAULT_URL = '/jolly-update.json';

  // ---- Siqnal REST-lə "jolly" node-un yanında ayrıca node-da
  // saxlanır (cloud.js-dəki eyni Firebase layihəsi, eyni REST üsulu,
  // SDK yoxdur — ona görə firebase.database() işləmir)
  const OTA_DB_URL = "https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app";
  const OTA_API_KEY = "AIzaSyAhv-ZFTTNeyoXIDjn3VrVcknPKor4kZvw";
  const SIGNAL_NODE = 'jolly_ota_signal';
  const POLL_MS = 20000; // 20 saniyədə bir yoxla (SDK olmadığı üçün real-time push əvəzi)

  let _otaToken = null, _otaTokenExpiry = 0;
  async function _getOtaToken() {
    if (_otaToken && Date.now() < _otaTokenExpiry) return _otaToken;
    try {
      const cached = JollyDB.read('jolly_fb_auth', null);
      if (cached && cached.idToken && Date.now() < cached.expiry) {
        _otaToken = cached.idToken; _otaTokenExpiry = cached.expiry;
        return _otaToken;
      }
    } catch (e) {}
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${OTA_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!res.ok) throw new Error('Bulud girişi uğursuz: ' + res.status);
    const data = await res.json();
    _otaToken = data.idToken;
    _otaTokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) * 1000) - 60000;
    try { JollyDB.write('jolly_fb_auth', { idToken: _otaToken, expiry: _otaTokenExpiry }); } catch (e) {}
    return _otaToken;
  }

  function getUrl() {
    try { return localStorage.getItem('jolly_ota_url') || DEFAULT_URL; } catch (e) { return DEFAULT_URL; }
  }
  function setUrl(u) { try { localStorage.setItem('jolly_ota_url', u.trim()); } catch (e) {} }
  function getInstalledVersion() {
    try { return parseInt(localStorage.getItem('jolly_ota_version') || '0', 10); } catch (e) { return 0; }
  }
  function setInstalledVersion(v) { try { localStorage.setItem('jolly_ota_version', String(v)); } catch (e) {} }
  function getLastSignal() {
    try { return parseInt(localStorage.getItem('jolly_ota_last_signal') || '0', 10); } catch (e) { return 0; }
  }
  function setLastSignal(ts) { try { localStorage.setItem('jolly_ota_last_signal', String(ts)); } catch (e) {} }

  /* ---------------- Qızılı toast UI ---------------- */
  function ensureToastStyles() {
    if (document.getElementById('jollyOtaToastStyle')) return;
    const style = document.createElement('style');
    style.id = 'jollyOtaToastStyle';
    style.textContent = `
      #jollyOtaToast{position:fixed;left:14px;right:14px;bottom:22px;z-index:99999;
        display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;
        background:linear-gradient(135deg, rgba(18,22,42,.97), rgba(11,13,23,.97));
        border:1px solid rgba(212,175,55,.45);
        box-shadow:0 8px 24px rgba(0,0,0,.5), 0 0 18px rgba(212,175,55,.12);
        backdrop-filter:blur(6px);transform:translateY(140%);opacity:0;
        transition:transform .45s cubic-bezier(.2,.9,.25,1),opacity .35s ease;
        font-family:inherit;max-width:420px;margin:0 auto;}
      #jollyOtaToast.show{transform:translateY(0);opacity:1;}
      #jollyOtaToast.done{border-color:rgba(53,208,127,.5);box-shadow:0 8px 24px rgba(0,0,0,.5),0 0 18px rgba(53,208,127,.18);}
      #jollyOtaToast .ota-spin{width:22px;height:22px;border-radius:50%;flex-shrink:0;
        border:2.5px solid rgba(212,175,55,.25);border-top-color:#f4d777;animation:jollyOtaSpin .8s linear infinite;
        display:flex;align-items:center;justify-content:center;font-size:14px;}
      #jollyOtaToast.done .ota-spin{border:none;animation:none;}
      @keyframes jollyOtaSpin{to{transform:rotate(360deg);}}
      #jollyOtaToast .ota-text{flex:1;min-width:0;}
      #jollyOtaToast .ota-title{font-size:13px;font-weight:600;color:#f2e9c9;}
      #jollyOtaToast .ota-sub{font-size:11px;color:#8a8fb0;margin-top:2px;}
      #jollyOtaToast .ota-track{height:4px;border-radius:4px;background:rgba(255,255,255,.06);margin-top:7px;overflow:hidden;}
      #jollyOtaToast .ota-fill{height:100%;width:0%;border-radius:4px;background:linear-gradient(90deg,#d4af37,#f4d777);transition:width .25s ease;}
    `;
    document.head.appendChild(style);
  }

  function showOtaToast() {
    ensureToastStyles();
    let el = document.getElementById('jollyOtaToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jollyOtaToast';
      el.innerHTML = `
        <div class="ota-spin" id="jollyOtaSpin"></div>
        <div class="ota-text">
          <div class="ota-title" id="jollyOtaTitle">Gör indi qaqan nağarajax 😅😅😅</div>
          <div class="ota-sub" id="jollyOtaSub">Yüklənir, bağlamayın</div>
          <div class="ota-track"><div class="ota-fill" id="jollyOtaFill"></div></div>
        </div>`;
      document.body.appendChild(el);
    }
    el.classList.remove('done');
    document.getElementById('jollyOtaFill').style.width = '0%';
    document.getElementById('jollyOtaTitle').textContent = 'Gör indi qaqan nağarajax 😅😅😅';
    document.getElementById('jollyOtaSub').textContent = 'Yüklənir, bağlamayın';
    document.getElementById('jollyOtaSpin').innerHTML = '';
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    return el;
  }

  function bumpOtaToast(pct) {
    const fill = document.getElementById('jollyOtaFill');
    if (fill) fill.style.width = Math.min(pct, 100) + '%';
  }

  function finishOtaToast(appliedList) {
    const el = document.getElementById('jollyOtaToast');
    if (!el) return;
    bumpOtaToast(100);
    setTimeout(() => {
      el.classList.add('done');
      document.getElementById('jollyOtaSpin').innerHTML = '✅';
      document.getElementById('jollyOtaTitle').textContent = 'Yeniləndi';
      document.getElementById('jollyOtaSub').textContent = appliedList && appliedList.length ? appliedList.join(', ') : 'Tətbiq güncəlləndi, davam edin';
    }, 200);
  }

  /* ---------------- Əsas yoxlama/tətbiq məntiqi ---------------- */
  async function checkAndApply(silent) {
    const url = getUrl();
    const toast = !silent ? showOtaToast() : null;
    try {
      if (toast) bumpOtaToast(15);
      const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (toast) bumpOtaToast(45);
      const data = await res.json();
      const remoteV = data.version || 0;
      const localV = getInstalledVersion();

      if (remoteV <= localV) {
        if (toast) toast.remove();
        if (!silent) Toast.info('Ən son versiyadasan (v' + localV + ')');
        return { updated: false, version: localV };
      }

      let applied = [];

      if (Array.isArray(data.snippets) && typeof JollyCodeStudio !== 'undefined') {
        data.snippets.forEach(sn => {
          try {
            const list = JollyDB.read('jolly_snippets', []);
            if (!list.some(x => x.id === sn.id)) {
              list.push({ id: sn.id, name: sn.name, code: sn.code, enabled: true });
              JollyDB.write('jolly_snippets', list);
              applied.push('kod: ' + sn.name);
            }
          } catch (e) {}
        });
      }
      if (toast) bumpOtaToast(65);

      if (Array.isArray(data.fields) && typeof JollyCodeStudio !== 'undefined') {
        data.fields.forEach(f => {
          try {
            const list = JollyDB.read('jolly_custom_fields', []);
            if (!list.some(x => x.id === f.id)) {
              list.push(f);
              JollyDB.write('jolly_custom_fields', list);
              applied.push('sahə: ' + f.label);
            }
          } catch (e) {}
        });
      }

      if (data.settings && typeof data.settings === 'object') {
        const s = JollyDB.getSettings();
        Object.assign(s, data.settings);
        if (JollyDB.saveSettings) JollyDB.saveSettings(s); else JollyDB.write('settings', s);
        applied.push('ayarlar');
      }

      if (data.message) {
        try { localStorage.setItem('jolly_ota_message', data.message); } catch (e) {}
      }

      setInstalledVersion(remoteV);
      if (toast) bumpOtaToast(90);

      finishOtaToast(applied);
      setTimeout(() => location.reload(), 5000);

      return { updated: true, version: remoteV, applied };
    } catch (e) {
      if (toast) toast.remove();
      if (!silent) Toast.error('Yoxlama alınmadı: ' + (e.message || e));
      return { updated: false, error: String(e.message || e) };
    }
  }

  /* ---------------- Admin: Hamıya Göndər ---------------- */
  function _isAdminSession() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return !sess || sess.role === 'admin';
    } catch (e) { return true; }
  }

  async function broadcastUpdate() {
    try {
      const ts = Date.now();
      const token = await _getOtaToken();
      const res = await fetch(`${OTA_DB_URL}/${SIGNAL_NODE}.json?auth=${token}`, {
        method: 'PUT',
        body: JSON.stringify({ ts: ts, by: 'admin' }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      Toast.success('Yeniləmə siqnalı göndərildi');
    } catch (e) {
      Toast.error('Göndərilmədi: ' + (e.message || e));
    }
  }

  /* ---------------- Hər dəfə göndərilə bilən toast (versiyadan asılı deyil) ---------------- */
  async function runBroadcastToast() {
    const toast = showOtaToast();
    bumpOtaToast(20);
    // arxa planda əsl yeniləməni sakit yoxla/tətbiq et (versiya artıbsa) —
    // amma toast-un görünməsi bundan asılı deyil, hər halda göstərilir
    try { await checkAndApply(true); } catch (e) {}
    bumpOtaToast(100);
    finishOtaToast();
    setTimeout(() => location.reload(), 5000);
  }

  let _pollTimer = null;
  async function pollForBroadcast() {
    try {
      const token = await _getOtaToken();
      const res = await fetch(`${OTA_DB_URL}/${SIGNAL_NODE}.json?auth=${token}`);
      if (!res.ok) return;
      const val = await res.json();
      if (!val || !val.ts) return;
      if (val.ts > getLastSignal()) {
        setLastSignal(val.ts);
        runBroadcastToast();
      }
    } catch (e) {}
  }

  function listenForBroadcast() {
    if (_pollTimer) return;
    // ilk açılışda köhnə siqnala görə özünü yeniləməsin — cari
    // siqnalı "görülmüş" kimi qeyd et, sonrakı YENİ siqnallara reaksiya versin
    (async () => {
      try {
        const token = await _getOtaToken();
        const res = await fetch(`${OTA_DB_URL}/${SIGNAL_NODE}.json?auth=${token}`);
        if (res.ok) {
          const val = await res.json();
          if (val && val.ts && getLastSignal() === 0) setLastSignal(val.ts);
        }
      } catch (e) {}
      _pollTimer = setInterval(pollForBroadcast, POLL_MS);
    })();
  }

  /* ---------------- Studios səhifəsi ---------------- */
  function render() {
    const localV = getInstalledVersion();
    const url = getUrl();
    const msg = (() => { try { return localStorage.getItem('jolly_ota_message') || ''; } catch (e) { return ''; } })();
    // Admin yoxlaması — cloud.js-dəki eyni "jolly_sec_session" məntiqi
    const isAdmin = _isAdminSession();

    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔄 Yeniləmələr</h2>
      <p class="muted" style="font-size:12px;margin:0 0 16px;">İçəridən yeni funksiyalar əlavə et — APK yenidən qurmadan.</p>

      ${msg ? `<div class="glass" style="padding:14px;margin-bottom:14px;border-left:3px solid var(--accent-1);"><b>📢 Elan:</b> ${escapeOTA(msg)}</div>` : ''}

      <div class="glass" style="padding:16px;margin-bottom:14px;text-align:center;">
        <div style="font-size:34px;font-family:var(--font-display);font-weight:800;color:#f5c563;">v${localV}</div>
        <div class="muted" style="font-size:12px;margin-bottom:14px;">Quraşdırılmış versiya</div>
        <button class="btn btn-primary btn-block" onclick="JollyOTA.check()">🔄 Yeniləmələri yoxla</button>
        ${isAdmin ? `<button class="btn btn-block" style="margin-top:8px;background:linear-gradient(135deg,#d4af37,#b8912b);color:#1a1206;font-weight:700;" onclick="JollyOTA.broadcastUpdate()">📤 Hamıya Göndər</button>` : ''}
      </div>

      <div class="section-title">Mənbə linki</div>
      <div class="glass" style="padding:14px;">
        <p class="muted" style="font-size:11px;margin:0 0 8px;">Yeniləmə faylının (jolly-update.json) ünvanı:</p>
        <input id="otaUrl" value="${escapeOTA(url)}" style="width:100%;box-sizing:border-box;margin-bottom:8px;font-size:11px;">
        <button class="btn btn-ghost btn-block" onclick="JollyOTA.saveUrlFromInput()">Yadda saxla</button>
      </div>
    `;
  }

  function escapeOTA(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function check() { checkAndApply(false); }
  function saveUrlFromInput() {
    const el = document.getElementById('otaUrl');
    if (el && el.value.trim()) { setUrl(el.value); Toast.success('Link saxlanıldı'); }
  }

  function autoCheck() {
    try {
      const last = parseInt(localStorage.getItem('jolly_ota_last') || '0', 10);
      if (Date.now() - last > 864e5) {
        localStorage.setItem('jolly_ota_last', String(Date.now()));
        setTimeout(() => checkAndApply(true), 3000);
      }
    } catch (e) {}
    // siqnal dinləyicisini də başlat
    setTimeout(listenForBroadcast, 2000);
  }

  return { render, check, checkAndApply, saveUrlFromInput, getInstalledVersion, autoCheck, broadcastUpdate, listenForBroadcast };
})();
