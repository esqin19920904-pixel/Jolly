/* ============================================================
   JOLLY Cloud — Firebase Realtime Database sinxronizasiyası
   İnternet olanda avtomatik buluda yazır, telefon dəyişəndə
   buluddan bərpa edir. Cloud Studio-dan idarə olunur.
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

  function enabled() {
    const s = JollyDB.getSettings();
    return s.cloudEnabled !== false; // standart açıq
  }
  function online() { return navigator.onLine; }

  /* ---------- REST əsaslı oxu/yaz (SDK-sız, yüngül) ---------- */
  async function push() {
    if (!online()) throw new Error('İnternet yoxdur');
    const data = JollyDB.exportAll();
    // şəkilləri buluda YAZMIRIQ (böyükdür) — yalnız məlumatlar
    // şəkil ref-ləri (idb:) qalır, onlar lokal cihazdadır
    const payload = {
      data,
      device: navigator.userAgent.slice(0, 60),
      syncedAt: Date.now(),
    };
    const res = await fetch(`${BASE}/${NODE}.json`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Buluda yazıla bilmədi: ' + res.status);
    JollyDB.setSettings({ lastCloudSync: Date.now() });
    return true;
  }

  async function pull() {
    if (!online()) throw new Error('İnternet yoxdur');
    const res = await fetch(`${BASE}/${NODE}.json`);
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
    JollyDB.importAll(payload.data);
    JollyDB.setSettings({ lastCloudSync: Date.now() });
    Toast.success('Buluddan bərpa olundu');
    JollyRouter.go('#/home');
    return true;
  }

  /* ---------- Avtomatik sinxron ---------- */
  let syncTimer = null;
  let pendingSync = false;

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
    // hər DB yazısında sinxron planla — JollyDB.write-ı sarıyırıq
    const origWrite = JollyDB.write;
    JollyDB.write = function (key, value) {
      const r = origWrite(key, value);
      // ayarlar/log dəyişikliyində sinxron etmə (döngü olmasın)
      if (key === JollyDB.KEYS.products || key === JollyDB.KEYS.brands ||
          key === JollyDB.KEYS.groups || key === JollyDB.KEYS.locations ||
          key === JollyDB.KEYS.statuses || key === JollyDB.KEYS.drafts) {
        scheduleSync();
      }
      return r;
    };
    // internet qayıdanda göndər
    window.addEventListener('online', () => { if (pendingSync || enabled()) scheduleSync(); });
  }

  /* ---------- Cloud Studio UI ---------- */
  function renderStudio() {
    const s = JollyDB.getSettings();
    const last = s.lastCloudSync;
    const lastText = last ? new Date(last).toLocaleString('az-AZ') : 'Heç vaxt';
    const isOn = enabled();
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
      <p class="muted" style="font-size:11.5px;margin-top:10px;padding:0 4px;">⚠️ Qeyd: şəkillər buluda göndərilmir (böyük həcm) — yalnız məhsul məlumatları. Şəkillər bu telefonda qalır. Yeni telefona keçəndə məlumatlar buluddan gələcək, şəkilləri yenidən çəkərsən və ya JSON backup ilə köçürərsən.</p>
    `;
  }

  async function manualPush() {
    Toast.info('Göndərilir...');
    try {
      await push();
      Toast.success('Buluda yazıldı ✓');
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

  return { push, pull, restoreFromCloud, manualPush, toggle, initAutoSync, renderStudio, scheduleSync, enabled };
})();
