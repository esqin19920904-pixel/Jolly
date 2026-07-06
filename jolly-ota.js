/* ============================================================
   JOLLY OTA — İçəridən Yeniləmə Sistemi
   Uzaqdakı bir JSON faylından yeni kod/snippet/ayar çəkir.
   Studios → "Yeniləmələr" bölməsindən idarə olunur.
   ============================================================ */
const JollyOTA = (() => {
  // Yeniləmə mənbəyi — Netlify-da bir jolly-update.json faylı
  // Sən öz linkini bura yazırsan (Ayarlardan da dəyişmək olar)
  const DEFAULT_URL = 'https://jolly-store.esqin19920904.workers.dev/jolly-update.json';

  function getUrl() {
    try { return localStorage.getItem('jolly_ota_url') || DEFAULT_URL; } catch (e) { return DEFAULT_URL; }
  }
  function setUrl(u) { try { localStorage.setItem('jolly_ota_url', u.trim()); } catch (e) {} }
  function getInstalledVersion() {
    try { return parseInt(localStorage.getItem('jolly_ota_version') || '0', 10); } catch (e) { return 0; }
  }
  function setInstalledVersion(v) { try { localStorage.setItem('jolly_ota_version', String(v)); } catch (e) {} }

  // Yeniləməni yoxla və tətbiq et
  async function checkAndApply(silent) {
    const url = getUrl();
    try {
      const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const remoteV = data.version || 0;
      const localV = getInstalledVersion();

      if (remoteV <= localV) {
        if (!silent) Toast.info('Ən son versiyadasan (v' + localV + ')');
        return { updated: false, version: localV };
      }

      // Yeniləmələri tətbiq et
      let applied = [];

      // 1) Snippetlər (JavaScript kod parçaları) — Code Studio-ya əlavə
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

      // 2) Custom Fields (məhsul sahələri)
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

      // 3) Ayarlar (məsələn yeni tema, bayraq)
      if (data.settings && typeof data.settings === 'object') {
        const s = JollyDB.getSettings();
        Object.assign(s, data.settings);
        if (JollyDB.saveSettings) JollyDB.saveSettings(s); else JollyDB.write('settings', s);
        applied.push('ayarlar');
      }

      // 4) Xüsusi mesaj / elan
      if (data.message) {
        try { localStorage.setItem('jolly_ota_message', data.message); } catch (e) {}
      }

      setInstalledVersion(remoteV);

      if (!silent) {
        alert('✓ Yeniləndi (v' + remoteV + ')!\n\n' + (applied.length ? applied.join('\n') : 'Dəyişikliklər tətbiq edildi') + '\n\nProqram yenidən başladılacaq.');
        location.reload();
      }
      return { updated: true, version: remoteV, applied };
    } catch (e) {
      if (!silent) Toast.error('Yoxlama alınmadı: ' + (e.message || e));
      return { updated: false, error: String(e.message || e) };
    }
  }

  // Studios səhifəsi
  function render() {
    const localV = getInstalledVersion();
    const url = getUrl();
    const msg = (() => { try { return localStorage.getItem('jolly_ota_message') || ''; } catch (e) { return ''; } })();
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔄 Yeniləmələr</h2>
      <p class="muted" style="font-size:12px;margin:0 0 16px;">İçəridən yeni funksiyalar əlavə et — APK yenidən qurmadan.</p>

      ${msg ? `<div class="glass" style="padding:14px;margin-bottom:14px;border-left:3px solid var(--accent-1);"><b>📢 Elan:</b> ${escapeOTA(msg)}</div>` : ''}

      <div class="glass" style="padding:16px;margin-bottom:14px;text-align:center;">
        <div style="font-size:34px;font-family:var(--font-display);font-weight:800;color:#f5c563;">v${localV}</div>
        <div class="muted" style="font-size:12px;margin-bottom:14px;">Quraşdırılmış versiya</div>
        <button class="btn btn-primary btn-block" onclick="JollyOTA.check()">🔄 Yeniləmələri yoxla</button>
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

  // Başlanğıcda sakit yoxlama (gündə bir dəfə)
  function autoCheck() {
    try {
      const last = parseInt(localStorage.getItem('jolly_ota_last') || '0', 10);
      if (Date.now() - last > 864e5) {
        localStorage.setItem('jolly_ota_last', String(Date.now()));
        setTimeout(() => checkAndApply(true), 3000);
      }
    } catch (e) {}
  }

  return { render, check, checkAndApply, saveUrlFromInput, getInstalledVersion, autoCheck };
})();
