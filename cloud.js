/* ============================================================
   JOLLY Cloud — Firebase Realtime Database sinxronizasiyası
   İnternet olanda avtomatik buluda yazır, telefon dəyişəndə
   buluddan bərpa edir. Cloud Studio-dan idarə olunur.

   DÜZƏLİŞ: Hər məhsulun İLK şəklindən KİÇİK, SIXILMIŞ bir
   "thumb" (thumbnail) yaradılıb buluda əlavə olunur ki, Telegram
   botu (/search) məhsulu şəkillə göstərə bilsin. ƏSL, BÖYÜK
   şəkillər YENƏ DƏ buluda getmir (yalnız telefonda qalır) —
   yalnız kiçik "baxış üçün kifayət edən" nüsxə əlavə olunur.

   YENİ (2026-07-21): Cihaz izləmə — hər telefon/tablet özünü
   unikal ID ilə tanıyır, hər sinxronda `/jolly_devices/{id}`-ə
   ad + rol + son görülmə vaxtını yazır. Cloud Studio-da "Qoşulan
   cihazlar" siyahısı bunları göstərir (bu hesaba hansı cihazlar
   qoşulub, hər biri nə vaxt aktiv olub).
   ============================================================ */

const JollyCloud = (() => {
  const firebaseConfig = {
    apiKey: "AIzaSyAhv-ZFTTNeyoXIDjn3VrVcknPKor4kZvw",
    authDomain: "jolly2026-b3c06.firebaseapp.com",
    databaseURL: "https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jolly2026-b3c06",
    storageBucket: "jolly2026-b3c06.firebasestorage.app",
    messagingSenderId: "1007172890128",
    appId: "1:1007172890128:web:f87ec714a9822697dc2495",
  };

  const BASE = firebaseConfig.databaseURL;
  const NODE = 'jolly'; // bulud düyünü: /jolly
  const DEVICES_NODE = 'jolly_devices'; // hər cihaz üçün ayrıca düyün: /jolly_devices/{id}

  // ── Anonim giriş (Firebase Auth) ──────────────────────────
  // Rules "auth != null" tələb etdiyi üçün, hər sorğudan əvvəl
  // etibarlı bir ID token lazımdır. Token 1 saat etibarlıdır,
  // localStorage-da keşlənir ki, hər dəfə yenidən giriş etməsin.
  let _idToken = null;
  let _tokenExpiry = 0;

  async function _getIdToken() {
    if (_idToken && Date.now() < _tokenExpiry) return _idToken;
    try {
      const cached = JollyDB.read('jolly_fb_auth', null);
      if (cached && cached.idToken && Date.now() < cached.expiry) {
        _idToken = cached.idToken; _tokenExpiry = cached.expiry;
        return _idToken;
      }
    } catch (e) {}
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!res.ok) throw new Error('Bulud girişi uğursuz: ' + res.status);
    const data = await res.json();
    _idToken = data.idToken;
    _tokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) * 1000) - 60000;
    try { JollyDB.write('jolly_fb_auth', { idToken: _idToken, expiry: _tokenExpiry }); } catch (e) {}
    return _idToken;
  }

  function enabled() {
    const s = JollyDB.getSettings();
    return s.cloudEnabled !== false; // standart açıq
  }
  function online() { return navigator.onLine; }

  /* ---------- Cihaz izləmə — hər telefon özünü tanıdır ---------- */
  function getDeviceId() {
    let id;
    try { id = localStorage.getItem('jolly_device_id'); } catch (e) {}
    if (!id) {
      id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem('jolly_device_id', id); } catch (e) {}
    }
    return id;
  }

  function guessDeviceName() {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'Android telefon';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Windows/i.test(ua)) return 'Windows kompüter';
    if (/Macintosh/i.test(ua)) return 'Mac';
    return 'Naməlum cihaz';
  }

  function getDeviceName() {
    try {
      const saved = localStorage.getItem('jolly_device_name');
      if (saved && saved.trim()) return saved;
    } catch (e) {}
    return guessDeviceName();
  }

  function setDeviceName(name) {
    try { localStorage.setItem('jolly_device_name', name); } catch (e) {}
  }

  function currentRole() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      if (sess && sess.role) return sess.role;
    } catch (e) {}
    return 'admin';
  }

  async function registerDevice() {
    if (!online()) return;
    try {
      const token = await _getIdToken();
      const body = {
        name: getDeviceName(),
        role: currentRole(),
        lastSeen: Date.now(),
        ua: (navigator.userAgent || '').slice(0, 80),
      };
      await fetch(`${BASE}/${DEVICES_NODE}/${getDeviceId()}.json?auth=${token}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.warn('[JollyCloud] Cihaz qeydiyyatı alınmadı:', e.message);
    }
  }

  async function fetchDevices() {
    if (!online()) return [];
    try {
      const token = await _getIdToken();
      const res = await fetch(`${BASE}/${DEVICES_NODE}.json?auth=${token}`);
      if (!res.ok) return [];
      const obj = await res.json();
      if (!obj) return [];
      const myId = getDeviceId();
      return Object.entries(obj)
        .map(([id, d]) => ({ id, isThis: id === myId, ...(d || {}) }))
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    } catch (e) {
      return [];
    }
  }

  function escDev(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function timeAgoDevice(ts) {
    if (!ts) return 'naməlum';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'indi';
    if (diff < 3600) return Math.floor(diff / 60) + ' dəq əvvəl';
    if (diff < 86400) return Math.floor(diff / 3600) + ' saat əvvəl';
    return Math.floor(diff / 86400) + ' gün əvvəl';
  }

  async function loadDevicesList() {
    const zone = document.getElementById('devicesListZone');
    if (!zone) return;
    const devices = await fetchDevices();
    if (!devices.length) {
      zone.innerHTML = '<div class="muted" style="padding:14px;">Cihaz məlumatı yoxdur (hələ sinxron olmayıb)</div>';
      return;
    }
    zone.innerHTML = devices.map(d => `
      <div class="list-row">
        <span>${d.isThis ? '📍 ' : '📱 '}${escDev(d.name || 'Naməlum cihaz')}${d.isThis ? ' <span class="muted" style="font-size:11px;">(bu cihaz)</span>' : ''}<br>
          <span class="muted" style="font-size:11px;">${d.role === 'admin' ? '👑 Admin' : '👤 User'} · ${timeAgoDevice(d.lastSeen)}</span>
        </span>
      </div>
    `).join('');
  }

  function renameThisDevice() {
    const current = getDeviceName();
    const name = prompt('Bu cihaza ad ver (məs. "Esqinin telefonu"):', current);
    if (!name || !name.trim()) return;
    setDeviceName(name.trim());
    Toast.success('Cihaz adı yeniləndi');
    registerDevice().then(loadDevicesList);
  }

  /* ---------- Kiçik thumbnail yaratmaq (yalnız buluda getmək üçün) ---------- */
  // Nəticələri keşləyirik ki, hər sinxronda eyni şəkli təkrar sıxmayaq
  const thumbCache = new Map(); // ref -> thumbDataUrl

  function compressToThumb(dataUrl, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.5));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function getThumbForRef(ref) {
    if (!ref) return null;
    if (thumbCache.has(ref)) return thumbCache.get(ref);
    try {
      let resolved = ref;
      if (ref.startsWith && ref.startsWith('idb:') && typeof JollyStorage !== 'undefined' && JollyStorage.resolveAll) {
        const arr = await JollyStorage.resolveAll([ref]);
        resolved = (arr && arr[0]) || null;
      }
      if (!resolved) return null;
      const thumb = await compressToThumb(resolved, 300, 0.5); // kiçik: max 300px, keyfiyyət 0.5
      thumbCache.set(ref, thumb);
      return thumb;
    } catch (e) {
      return null;
    }
  }

  async function buildProductsWithThumbs(products) {
    // Paralel, amma həddindən artıq yüklənməsin deyə kiçik "batch"lərlə
    const out = [];
    let successCount = 0;
    let attemptCount = 0;
    const BATCH = 6;
    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH);
      const withThumbs = await Promise.all(batch.map(async (p) => {
        if (!p.images || !p.images.length) return p;
        attemptCount++;
        const thumb = await getThumbForRef(p.images[0]);
        if (thumb) successCount++;
        return thumb ? { ...p, thumb } : p;
      }));
      out.push(...withThumbs);
    }
    console.log(`[JollyCloud] Thumbnail: ${successCount}/${attemptCount} uğurlu (şəkli olan məhsullardan)`);
    return { list: out, successCount, attemptCount };
  }

  /* ---------- REST əsaslı oxu/yaz (SDK-sız, yüngül) ---------- */
  async function push() {
    if (!online()) throw new Error('İnternet yoxdur');
    const data = JollyDB.exportAll();
    // şəkillərin ƏSLİNİ buluda YAZMIRIQ (böyükdür) — yalnız kiçik "thumb"
    // (Telegram botu üçün) əlavə olunur, qalan hər şey əvvəlki kimi
    let thumbStats = { successCount: 0, attemptCount: 0 };
    try {
      if (Array.isArray(data.products) && data.products.length) {
        const result = await buildProductsWithThumbs(data.products);
        data.products = result.list;
        thumbStats = result;
      }
    } catch (e) {
      console.warn('Thumbnail yaradıla bilmədi, adi sinxron davam edir:', e);
    }
    const payload = {
      data,
      device: navigator.userAgent.slice(0, 60),
      syncedAt: Date.now(),
    };
    const token = await _getIdToken();
    const res = await fetch(`${BASE}/${NODE}.json?auth=${token}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Buluda yazıla bilmədi: ' + res.status);
    JollyDB.setSettings({ lastCloudSync: Date.now() });
    registerDevice(); // öz cihazını "aktiv" kimi qeydə al — göndərməyi gözləmə
    return thumbStats;
  }

  async function pull() {
    if (!online()) throw new Error('İnternet yoxdur');
    const token = await _getIdToken();
    const res = await fetch(`${BASE}/${NODE}.json?auth=${token}`);
    if (!res.ok) throw new Error('Buluddan oxuna bilmədi: ' + res.status);
    const payload = await res.json();
    if (!payload || !payload.data) return null;
    return payload;
  }

  async function restoreFromCloud() {
    const payload = await pull();
    if (!payload) { Toast.error('Buludda məlumat yoxdur'); return false; }
    const when = new Date(payload.syncedAt).toLocaleString('az-AZ');
    const count = (payload.data.products || []).length;
    if (!confirm(`Buludda ${count} məhsul var (${when}). Bu cihazdakı məlumatlar əvəz olunsun?`)) return false;
    if (typeof JollyStudios !== 'undefined' && JollyStudios.saveSnapshot) JollyStudios.saveSnapshot();
    // "thumb" sahəsi yalnız Telegram üçündür, bərpa edərkən lazım deyil (əsl images var)
    if (Array.isArray(payload.data.products)) {
      payload.data.products = payload.data.products.map(p => {
        if (p && p.thumb) { const clean = { ...p }; delete clean.thumb; return clean; }
        return p;
      });
    }
    JollyDB.importAll(payload.data);
    JollyDB.setSettings({ lastCloudSync: Date.now() });
    Toast.success('Buluddan bərpa olundu');
    JollyRouter.go('#/home');
    return true;
  }

  /* ---------- Avtomatik sinxron ---------- */
  let syncTimer = null;
  let pendingSync = false;

  function isPendingSync() { return pendingSync; }

  // ── Offline vaxt sayğacı — cihaz nə vaxtdan oflayn olduğunu qeydə
  // alır, Dashboard bunu göstərir. Cloud aç/bağlıdan asılı olmadan
  // işləyir (skript yüklənən kimi bir dəfə qoşulur). ──
  const OFFLINE_SINCE_KEY = 'jolly_offline_since';

  function getOfflineSince() {
    try {
      const v = localStorage.getItem(OFFLINE_SINCE_KEY);
      return v ? parseInt(v, 10) : null;
    } catch (e) { return null; }
  }

  (function initOfflineTracking() {
    if (window._jollyOfflineTrackingInit) return;
    window._jollyOfflineTrackingInit = true;
    if (!navigator.onLine) {
      try { if (!localStorage.getItem(OFFLINE_SINCE_KEY)) localStorage.setItem(OFFLINE_SINCE_KEY, String(Date.now())); } catch (e) {}
    }
    window.addEventListener('offline', () => {
      try { localStorage.setItem(OFFLINE_SINCE_KEY, String(Date.now())); } catch (e) {}
    });
    window.addEventListener('online', () => {
      try { localStorage.removeItem(OFFLINE_SINCE_KEY); } catch (e) {}
    });
  })();

  function scheduleSync() {
    if (!enabled()) return;
    pendingSync = true;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      if (!pendingSync) return;
      pendingSync = false;
      if (!online()) return; // internet gələndə onlayn hadisəsi tutacaq
      try {
        await push();
        console.log('JOLLY Cloud: sinxron edildi');
      } catch (e) { console.warn('Cloud sync alınmadı:', e.message); }
    }, 4000); // dəyişiklikdən 4 san sonra (toplu göndərmə)
  }

  function initAutoSync() {
    if (!enabled()) return;
    registerDevice(); // dəyişiklik olmasa belə, bu cihazı "aktiv" kimi qeydə al
    // hər DB yazısında sinxron planla — JollyDB.write-ı sarıyırıq
    const origWrite = JollyDB.write;
    JollyDB.write = function (key, value) {
      const r = origWrite(key, value);
      // ayarlar/log dəyişikliyində sinxron etmə (döngü olmasın)
      if (key === JollyDB.KEYS.products || key === JollyDB.KEYS.brands ||
          key === JollyDB.KEYS.groups || key === JollyDB.KEYS.locations ||
          key === JollyDB.KEYS.statuses || key === JollyDB.KEYS.drafts ||
          key === JollyDB.KEYS.settings || key === JollyDB.KEYS.users) {
        scheduleSync();
      }
      return r;
    };
    // internet qayıdanda göndər
    window.addEventListener('online', () => { if (pendingSync || enabled()) scheduleSync(); });
  }


  /* ---------- Cloud Studio UI ---------- */
  function renderStudio() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      if (sess && sess.role !== 'admin') {
        if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
        return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
      }
    } catch (e) {}
    const s = JollyDB.getSettings();
    const last = s.lastCloudSync;
    const lastText = last ? new Date(last).toLocaleString('az-AZ') : 'Heç vaxt';
    const isOn = enabled();
    setTimeout(() => loadDevicesList(), 0);
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 6px;font-size:19px;">☁️ Cloud Studio</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Firebase buludu — Jolly2026 layihən. Məlumatlar internet olanda avtomatik buluda yazılır.</p>

      <div class="glass" style="padding:16px;margin-bottom:14px;">
        <div class="row between" style="margin-bottom:10px;">
          <div>
            <div class="muted" style="font-size:11px;text-transform:uppercase;">Son sinxron</div>
            <div style="font-family:var(--font-display);font-weight:700;">${lastText}</div>
          </div>
          <div class="status-pill"><span class="dot" style="background:${online() ? 'var(--accent-2)' : 'var(--accent-danger)'}"></span>${online() ? 'Onlayn' : 'Oflayn'}</div>
        </div>
        <div class="row" style="gap:10px;">
          <button class="btn btn-primary" style="flex:1;" onclick="JollyCloud.manualPush()">⬆️ İndi göndər</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyCloud.restoreFromCloud()">⬇️ Buluddan bərpa</button>
        </div>
      </div>

      <div class="glass" style="padding:4px 14px;">
        <div class="list-row">
          <span>☁️ Avtomatik sinxron</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${isOn ? 'checked' : ''} onchange="JollyCloud.toggle(this.checked)"></label>
        </div>
      </div>

      <div class="section-title">📱 Qoşulan cihazlar</div>
      <div class="glass" style="padding:4px 14px;" id="devicesListZone">
        <div class="muted" style="padding:14px;">Yüklənir...</div>
      </div>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="JollyCloud.renameThisDevice()">✏️ Bu cihazın adını dəyiş</button>

      <p class="muted" style="font-size:11.5px;margin-top:10px;padding:0 4px;">⚠️ Qeyd: şəkillərin ƏSLİ buluda göndərilmir (böyük həcm) — yalnız məhsul məlumatları + kiçik "baxış" nüsxəsi (Telegram botu üçün). Əsl, böyük şəkillər bu telefonda qalır. Yeni telefona keçəndə məlumatlar buluddan gələcək, şəkilləri yenidən çəkərsən və ya JSON backup ilə köçürərsən.</p>
    `;
  }

  async function manualPush() {
    Toast.info('Göndərilir...');
    try {
      const stats = await push();
      Toast.success(`Buluda yazıldı ✓ (şəkil: ${stats.successCount}/${stats.attemptCount})`);
      JollyRouter.go('#/studios/cloud');
    } catch (e) {
      Toast.error(e.message);
    }
  }

  function toggle(on) {
    JollyDB.setSettings({ cloudEnabled: on });
    Toast.success(on ? 'Avtomatik sinxron açıq' : 'Sinxron bağlandı');
    if (on) scheduleSync();
  }

  return {
    push, pull, restoreFromCloud, manualPush, toggle, initAutoSync, renderStudio, scheduleSync, enabled,
    getDeviceId, getDeviceName, renameThisDevice, loadDevicesList, fetchDevices,
    isPendingSync, getOfflineSince,
  };
})();
