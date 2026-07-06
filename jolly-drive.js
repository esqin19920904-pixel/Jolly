/* ============================================================
   JOLLY Google Drive — həqiqi bulud backup
   OAuth: Google Identity Services (rəsmi Google skripti, kitabxana deyil)
   Scope: drive.file — YALNIZ JOLLY-nin özü yaratdığı faylları görür,
   sənin şəxsi Drive-ındakı digər fayllara toxunmur.
   ============================================================ */

const JollyDrive = (() => {
  const CLIENT_ID = '1007172890128-dr5f9ih3g6dv33qg546hvr8547dsngm1.apps.googleusercontent.com';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER_NAME = 'JOLLY Backups';

  let accessToken = null;
  let tokenClient = null;
  let folderId = null;
  let gsiLoadState = 'idle'; // idle | loading | loaded | failed
  let gsiLoadError = '';

  function isSignedIn() { return !!accessToken; }

  /* ---------- Google skriptini özümüz yükləyirik (HTML-dən asılı deyil) ---------- */
  function loadGsiScript() {
    return new Promise((resolve) => {
      if (window.google && google.accounts && google.accounts.oauth2) {
        gsiLoadState = 'loaded';
        resolve(true);
        return;
      }
      if (gsiLoadState === 'loading') {
        // artıq yüklənir — hazır olana qədər gözlə
        const iv = setInterval(() => {
          if (gsiLoadState === 'loaded') { clearInterval(iv); resolve(true); }
          if (gsiLoadState === 'failed') { clearInterval(iv); resolve(false); }
        }, 200);
        return;
      }
      gsiLoadState = 'loading';
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => {
        // skript yüklənib, amma qlobal obyekt bir az gec hazır ola bilər
        const start = Date.now();
        const iv = setInterval(() => {
          if (window.google && google.accounts && google.accounts.oauth2) {
            clearInterval(iv);
            gsiLoadState = 'loaded';
            resolve(true);
          } else if (Date.now() - start > 4000) {
            clearInterval(iv);
            gsiLoadState = 'failed';
            gsiLoadError = 'Skript yükləndi amma google.accounts obyekti yaranmadı';
            resolve(false);
          }
        }, 150);
      };
      s.onerror = () => {
        gsiLoadState = 'failed';
        gsiLoadError = 'Skript faylı şəbəkədən endirilə bilmədi (onload=error)';
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  function ensureTokenClient() {
    if (tokenClient) return true;
    if (!window.google || !google.accounts || !google.accounts.oauth2) return false;
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: () => {}, // hər çağırışda override olunur
      });
      return true;
    } catch (e) {
      gsiLoadError = 'initTokenClient xətası: ' + (e.message || e);
      return false;
    }
  }

  async function signIn(onDone) {
    Toast.info('Google ilə əlaqə qurulur...');
    const ready = await loadGsiScript();
    if (!ready || !ensureTokenClient()) {
      Toast.error('Google giriş alınmadı: ' + (gsiLoadError || 'naməlum səbəb'));
      const dbg = document.getElementById('driveDebugStatus');
      if (dbg) { dbg.textContent = '❌ ' + (gsiLoadError || 'naməlum xəta'); dbg.style.color = 'var(--accent-danger)'; }
      return;
    }
    tokenClient.callback = async (resp) => {
      if (resp.error) { Toast.error('Google girişi alınmadı'); return; }
      accessToken = resp.access_token;
      if (typeof JollySound !== 'undefined') JollySound.success();
      Toast.success('Google Drive-a qoşuldu');
      if (onDone) onDone();
    };
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  }

  function signOut() {
    if (accessToken && window.google && google.accounts) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    folderId = null;
    Toast.info('Google Drive bağlantısı kəsildi');
  }

  async function apiFetch(url, opts = {}) {
    if (!accessToken) throw new Error('signed_out');
    const headers = Object.assign({ Authorization: 'Bearer ' + accessToken }, opts.headers || {});
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if (res.status === 401) { accessToken = null; throw new Error('token_expired'); }
    return res;
  }

  /* ---------- "JOLLY Backups" qovluğunu tap və ya yarat ---------- */
  async function ensureFolder() {
    if (folderId) return folderId;
    const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const res = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    const data = await res.json();
    if (data.files && data.files.length) {
      folderId = data.files[0].id;
      return folderId;
    }
    const createRes = await apiFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    const created = await createRes.json();
    folderId = created.id;
    return folderId;
  }

  /* ---------- Backup-u Drive-a yüklə ---------- */
  async function uploadBackup() {
    if (!isSignedIn()) { signIn(() => uploadBackup()); return; }
    try {
      Toast.info('Drive-a yüklənir...');
      const fid = await ensureFolder();
      const payload = JollyDB.exportAll();
      const json = JSON.stringify(payload, null, 2);
      const fileName = `jolly-backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`;

      const boundary = 'jolly_boundary_' + Date.now();
      const metadata = { name: fileName, parents: [fid], mimeType: 'application/json' };
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n` +
        `--${boundary}--`;

      const res = await apiFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      if (!res.ok) throw new Error('upload_failed');
      JollyDB.setSettings({ lastBackup: Date.now(), lastDriveBackup: Date.now() });
      if (typeof JollySound !== 'undefined') JollySound.success();
      Toast.success('Backup Google Drive-a yükləndi ☁️');
    } catch (e) {
      if (e.message === 'token_expired' || e.message === 'signed_out') {
        Toast.info('Yenidən daxil ol...');
        signIn(() => uploadBackup());
      } else {
        console.error('JollyDrive upload xətası:', e);
        Toast.error('Backup yüklənmədi');
      }
    }
  }

  /* ---------- Drive-dakı backup-ları siyahıla ---------- */
  async function listBackups() {
    if (!isSignedIn()) { signIn(() => listBackups().then(renderBackupList)); return []; }
    try {
      const fid = await ensureFolder();
      const q = encodeURIComponent(`'${fid}' in parents and trashed=false`);
      const res = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)`);
      const data = await res.json();
      return data.files || [];
    } catch (e) {
      console.error('JollyDrive list xətası:', e);
      return [];
    }
  }

  /* ---------- Drive-dan bərpa et ---------- */
  async function restoreFromDrive(fileId) {
    if (!confirm('Hazırkı bütün məlumat bu backup ilə ƏVƏZ olunacaq. Davam edilsin?')) return;
    try {
      Toast.info('Endirilir...');
      const res = await apiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
      const payload = await res.json();
      JollyDB.importAll(payload);
      if (typeof JollySound !== 'undefined') JollySound.success();
      Toast.success('Bərpa olundu — səhifə yenilənir');
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      console.error('JollyDrive restore xətası:', e);
      Toast.error('Bərpa alınmadı');
    }
  }

  /* ---------- UI: Integration Studio-ya inteqrasiya ---------- */
  function renderPanel() {
    const s = JollyDB.getSettings();
    return `
      <div id="driveBackupZone">
        ${!isSignedIn() ? `
          <button class="btn btn-primary btn-block" onclick="JollyDrive.signIn(() => JollyDrive.refreshPanel())">🔐 Google ilə daxil ol</button>
          <p class="muted" style="font-size:11px;margin-top:8px;">Yalnız JOLLY-nin öz yaratdığı fayllara icazə istənir — şəxsi Drive-ına toxunulmur.</p>
          <p class="muted" id="driveDebugStatus" style="font-size:10.5px;margin-top:10px;padding:8px;background:rgba(255,255,255,0.05);border-radius:8px;">🔍 Google skript statusu yoxlanılır...</p>
        ` : `
          <div class="row" style="gap:10px;margin-bottom:10px;">
            <button class="btn btn-primary" style="flex:1;" onclick="JollyDrive.uploadBackup()">☁️ İndi backup et</button>
            <button class="btn btn-ghost" onclick="JollyDrive.signOut()">Çıxış</button>
          </div>
          ${s.lastDriveBackup ? `<p class="muted" style="font-size:11px;">Son backup: ${new Date(s.lastDriveBackup).toLocaleString('az-AZ')}</p>` : ''}
          <div id="driveBackupList" class="glass" style="padding:4px 14px;margin-top:10px;">
            <div class="muted" style="padding:12px;font-size:12px;">Yüklənir...</div>
          </div>
        `}
      </div>
    `;
  }

  function refreshPanel() {
    const zone = document.getElementById('driveBackupZone');
    if (zone) zone.outerHTML = renderPanel();
    if (isSignedIn()) loadAndRenderList();
    else runDiagnostics();
  }

  function runDiagnostics() {
    const el = document.getElementById('driveDebugStatus');
    if (!el) return;
    el.textContent = '🔍 Google skripti yüklənir...';
    loadGsiScript().then(ok => {
      const el2 = document.getElementById('driveDebugStatus');
      if (!el2) return;
      if (ok) {
        el2.textContent = '✅ Google skripti hazırdır — "daxil ol" düyməsinə bas';
        el2.style.color = 'var(--accent-2)';
      } else {
        el2.textContent = '❌ ' + (gsiLoadError || 'Yüklənmədi (naməlum səbəb)');
        el2.style.color = 'var(--accent-danger)';
      }
    });
  }

  async function loadAndRenderList() {
    const files = await listBackups();
    renderBackupList(files);
  }

  function renderBackupList(files) {
    const el = document.getElementById('driveBackupList');
    if (!el) return;
    if (!files.length) { el.innerHTML = '<div class="muted" style="padding:12px;font-size:12px;">Hələ backup yoxdur</div>'; return; }
    el.innerHTML = files.slice(0, 10).map(f => `
      <div class="list-row">
        <span style="font-size:12px;">${new Date(f.createdTime).toLocaleString('az-AZ')}</span>
        <span onclick="JollyDrive.restoreFromDrive('${f.id}')" style="color:var(--accent-1);cursor:pointer;">♻️ Bərpa et</span>
      </div>
    `).join('');
  }

  return { isSignedIn, signIn, signOut, uploadBackup, listBackups, restoreFromDrive, renderPanel, refreshPanel, loadAndRenderList, runDiagnostics };
})();
