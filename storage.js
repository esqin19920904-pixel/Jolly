/* ============================================================
   JOLLY Storage — IndexedDB şəkil anbarı
   Şəkillər burada saxlanılır (böyük tutum), məlumatlar localStorage-də
   Köhnə (localStorage-dəki) şəkillər ilk açılışda avtomatik köçürülür

   YENİ:
   - requestPersistence()/isPersisted() — brauzerdən "bu saytın
     datasını avtomatik silmə" icazəsi istəyir (Daimi Yaddaş).
   - exportAllImagesToDevice() — bütün məhsul şəkillərini telefonun
     öz Yükləmələr qovluğuna, ƏSL FAYL kimi köçürür (real ehtiyat
     nüsxə — brauzer yaddaşı silinsə belə bu fayllar qalır).
   ============================================================ */

const JollyStorage = (() => {
  const DB_NAME = 'jolly_images_db';
  const STORE = 'images';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function isSupported() { return 'indexedDB' in window; }

  // Şəkil saxla → açar qaytarır (idb:xxxx)
  /* ---------- Şəkil sıxma ----------
     Böyük şəkli avtomatik kiçildir: max ölçü + JPEG keyfiyyət.
     Kataloq şəkilləri üçün 1200px + 0.72 keyfiyyət kifayətdir,
     amma keyfiyyət gözlə görünmür, yaddaş isə 5-10 dəfə azalır.
  */
  function compressImage(dataUrl, opts) {
    opts = opts || {};
    const maxSize = opts.maxSize || 1200;   // ən uzun tərəf
    const quality = opts.quality || 0.72;
    return new Promise((resolve) => {
      // Sıxma ayarı bağlıdırsa və ya şəkil deyilsə, toxunma
      try {
        const s = JollyDB.getSettings();
        if (s.compressImages === false) { resolve(dataUrl); return; }
      } catch (e) {}
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) { resolve(dataUrl); return; }

      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width <= maxSize && height <= maxSize && dataUrl.length < 400000) {
            // Onsuz da kiçikdir — sıxmağa dəyməz
            resolve(dataUrl); return;
          }
          if (width > height && width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
          else if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; // şəffaf PNG-lər üçün ağ fon
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const out = canvas.toDataURL('image/jpeg', quality);
          // Sıxılmış daha böyükdürsə (nadir), orijinalı saxla
          resolve(out.length < dataUrl.length ? out : dataUrl);
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  /* ---------- KİÇİK ŞƏKİL (thumbnail) ----------
     Siyahılarda 1200px şəkil göstərmək israfdır: həm oxumaq, həm
     çəkmək uzun çəkir. Hər şəkil saxlananda ona qoşa olaraq 240px
     kiçik nüsxə də yazılır (açar: <key>_t). Siyahılar bunu, məhsulun
     öz səhifəsi isə tam nüsxəni açır. Kiçik nüsxə adətən 10-20 dəfə
     yüngüldür. */
  const THUMB_SIZE = 240;
  const THUMB_QUALITY = 0.6;

  function _thumbKey(key) { return key + '_t'; }

  async function _makeThumb(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > height) { height = Math.round(height * THUMB_SIZE / width); width = THUMB_SIZE; }
          else { width = Math.round(width * THUMB_SIZE / height); height = THUMB_SIZE; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', THUMB_QUALITY));
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function _putRaw(key, value) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }

  async function _getRaw(key) {
    try {
      const db = await openDB();
      return await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readonly');
        const rq = tx.objectStore(STORE).get(key);
        rq.onsuccess = () => res(rq.result || null);
        rq.onerror = () => rej(rq.error);
      });
    } catch (e) { return null; }
  }

  /* Köhnə şəkillərin kiçik nüsxəsi yoxdur — ilk dəfə göstəriləndə
     arxa planda yaradılır, sonrakı açılışlarda hazır olur. */
  const _thumbBuilding = new Set();
  async function ensureThumb(ref) {
    if (!ref || !ref.startsWith('idb:')) return;
    const key = ref.slice(4);
    if (_thumbBuilding.has(key)) return;
    _thumbBuilding.add(key);
    try {
      const existing = await _getRaw(_thumbKey(key));
      if (existing) return;
      const full = await _getRaw(key);
      if (!full) return;
      const thumb = await _makeThumb(full);
      if (thumb) await _putRaw(_thumbKey(key), thumb);
    } catch (e) {} finally { _thumbBuilding.delete(key); }
  }

  async function saveImage(dataUrl) {
    // Əvvəl sıx
    dataUrl = await compressImage(dataUrl);
    if (!isSupported()) return dataUrl; // fallback: olduğu kimi qaytar
    try {
      const key = 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      await _putRaw(key, dataUrl);
      // Kiçik nüsxə — uğursuz olsa da əsas şəkil saxlanılıb, problem yoxdur
      try {
        const thumb = await _makeThumb(dataUrl);
        if (thumb) await _putRaw(_thumbKey(key), thumb);
      } catch (e) {}
      return 'idb:' + key;
    } catch (e) {
      console.error('IDB save error', e);
      return dataUrl; // xəta olsa köhnə üsulla saxla
    }
  }

  // Açardan şəkli oxu
  async function getImage(ref, preferThumb) {
    if (!ref || !ref.startsWith('idb:')) return ref; // adi dataURL-dır
    const key = ref.slice(4);
    if (preferThumb) {
      const t = await _getRaw(_thumbKey(key));
      if (t) return t;
      // Kiçik nüsxə hələ yoxdur — tam şəkli göstər, fonda kiçiyini yarat
      ensureThumb(ref);
    }
    return await _getRaw(key);
  }

  // Şəkli sil
  async function deleteImage(ref) {
    if (!ref || !ref.startsWith('idb:')) return;
    try {
      const db = await openDB();
      await new Promise((res) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(ref.slice(4));
        tx.objectStore(STORE).delete(_thumbKey(ref.slice(4)));  // kiçik nüsxə də getsin
        tx.oncomplete = res;
        tx.onerror = res;
      });
    } catch (e) {}
  }

  /* DOM-dakı bütün idb: şəkilləri həqiqi şəkillə doldur.
     render-dən sonra çağırılır. <img src="idb:..."> işləmir,
     ona görə data-idb atributu istifadə olunur. */
  async function hydrate(root) {
    const scope = root || document;
    const imgs = Array.from(scope.querySelectorAll('img[data-idb]'));
    if (!imgs.length) return;
    // Paralel — hər şəkli eyni anda sorğula, bir-bir gözləmə.
    // Məhsul sayı çoxaldıqca (məs. Qəbul Studio-nun siyahısında) bu,
    // ardıcıl versiyaya nisbətən dəfələrlə sürətlidir.
    await Promise.all(imgs.map(async (img) => {
      const ref = img.getAttribute('data-idb');
      const wantThumb = img.getAttribute('data-idb-thumb') === '1';
      const data = await getImage(ref, wantThumb);
      if (data) img.src = data;
      img.removeAttribute('data-idb');
      img.removeAttribute('data-idb-thumb');
    }));
  }

  // img tag-i üçün düzgün atribut qaytarır
  function imgAttr(ref, thumb) {
    if (!ref) return '';
    if (ref.startsWith('idb:')) {
      // boz placeholder + data-idb (hydrate dolduracaq)
      // thumb=true → siyahı üçün kiçik nüsxə istənilir
      return `src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect fill='%231b1f36' width='10' height='10'/%3E%3C/svg%3E" data-idb="${ref}"${thumb ? ' data-idb-thumb="1"' : ''}`;
    }
    return `src="${ref}"`;
  }

  /* Köhnə localStorage şəkillərini IndexedDB-yə köçür (bir dəfə).
     Həm də hər açılışda Daimi Yaddaş sorğusunu (sükutla) təkrar edir.

     DÜZƏLİŞ (2026-07-25, "Yaddaş dolub" hər girişdə təkrarlanması):
     Əvvəl bu funksiya HƏR məhsulu ayrı-ayrı `store.update()` ilə
     yazırdı — bu da öz növbəsində HƏM məhsul siyahısını, HƏM DƏ
     activity jurnalını (logActivity) ayrıca yazırdı. Əgər localStorage
     artıq köhnə base64 şəkillərlə dolu idisə, bu ara-yazıların HƏR
     BİRİ quota xətası ilə uğursuz olur və hər uğursuzluqda görünən bir
     "Yaddaş dolub" xəbərdarlığı göstərirdi — bəzən onlarla dəfə arxa-
     arxaya, tətbiq açılan kimi. Daha pisi: yazı uğursuz olduğu üçün
     dəyişiklik həqiqətən localStorage-a yazılmırdı (yalnız IndexedDB
     tərəfi uğurlu olurdu), ona görə də sonrakı hər açılışda EYNİ
     şəkillər YENİDƏN köçürülməyə cəhd olunurdu — problem heç vaxt
     düzəlmirdi, hər girişdə təkrarlanırdı.

     İndi: bütün şəkillər əvvəlcə YADDAŞDA (RAM-da) IndexedDB-yə
     köçürülür, sonra DƏYİŞƏN siyahı BİR DƏFƏYƏ yazılır (activity
     jurnalı olmadan — bu, istifadəçi əməliyyatı deyil, arxa fon
     köçürməsidir). Beləliklə ən pis halda BİR yazı cəhdi olur, BİR
     mümkün xəbərdarlıq — onlarla yox. Əgər bu tək yazı da uğursuz
     olsa belə, artıq bütün şəkillər IndexedDB-də uğurla saxlanıb;
     `idbMigrated` işarələnmir ki, növbəti açılışda YENİDƏN cəhd
     olunsun (bu dəfə localStorage-da daha az yer tutaraq, çünki hər
     `saveImage` çağırışı ayrıca IndexedDB-yə yazır, localStorage-a
     toxunmur) — sonda öz-özünü düzəldir, sonsuz təkrar-uğursuzluq
     yaratmır. */
  async function migrateOldImages() {
    // Daimi yaddaş sorğusu — hər sessiyada, səssiz, ayrıca xəta üçün gözləmir
    try { requestPersistence(); } catch (e) {}

    if (!isSupported()) return;
    const s = JollyDB.getSettings();
    if (s.idbMigrated) return;
    let anyChanged = false;
    let allOk = true;

    async function migrateList(store) {
      const key = store === JollyDB.Products ? JollyDB.KEYS.products : JollyDB.KEYS.drafts;
      const items = JollyDB.read(key, []);
      let listChanged = false;
      for (const item of items) {
        if (!item.images || !item.images.length) continue;
        let itemChanged = false;
        const newImages = [];
        for (const img of item.images) {
          if (img && img.startsWith('data:')) {
            const ref = await saveImage(img); // IndexedDB-yə yazır, localStorage-a toxunmur
            newImages.push(ref);
            itemChanged = true;
          } else newImages.push(img);
        }
        if (itemChanged) {
          item.images = newImages;
          listChanged = true;
        }
      }
      if (listChanged) {
        // Bütün siyahı üçün YALNIZ BİR yazı — ara-yazı yoxdur, ona görə
        // ara-quota-xətası da yoxdur. Activity jurnalına yazılmır (bu,
        // arxa fon köçürməsidir, istifadəçi əməliyyatı deyil).
        const ok = JollyDB.write(key, items);
        anyChanged = true;
        if (!ok) allOk = false;
      }
    }

    try {
      await migrateList(JollyDB.Products);
      await migrateList(JollyDB.Drafts);
      // Yalnız localStorage yazısı da uğurlu olubsa "bitdi" işarələ —
      // əks halda növbəti açılışda (bu dəfə daha yüngül halda) yenidən
      // cəhd olunsun ki, problem özü-özünü düzəltsin.
      if (allOk) JollyDB.setSettings({ idbMigrated: true });
      if (anyChanged) console.log('JOLLY: şəkillər IndexedDB-yə köçürüldü' + (allOk ? '' : ' (qismən — növbəti açılışda davam edəcək)'));
    } catch (e) { console.error('Migration error', e); }
  }

  // Şəkil ref-indən görüntülənə bilən data almaq (viewer üçün)
  async function resolveAll(refs) {
    const out = [];
    for (const r of refs) {
      const d = await getImage(r);
      out.push(d || r);
    }
    return out;
  }

  /* DOM-a yeni əlavə olunan idb şəkilləri avtomatik doldur */
  let hydrateScheduled = false;
  function initAutoHydrate() {
    if (!('MutationObserver' in window)) return;
    const mo = new MutationObserver(() => {
      if (hydrateScheduled) return;
      hydrateScheduled = true;
      setTimeout(() => { hydrateScheduled = false; hydrate(); }, 50);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ============================================================
     DAİMİ YADDAŞ (Persistent Storage)
     Brauzerə "bu saytın datasını yaddaş azalanda avtomatik silmə"
     deyir. Dəstəklənirsə və artıq aktiv deyilsə, icazə istəyir
     (adətən dialoq çıxmadan, sükutla verilir/rədd edilir).
     ============================================================ */
  async function requestPersistence() {
    if (!(navigator.storage && navigator.storage.persist)) return { supported: false };
    try {
      const already = await navigator.storage.persisted();
      if (already) return { supported: true, granted: true, already: true };
      const granted = await navigator.storage.persist();
      return { supported: true, granted, already: false };
    } catch (e) { return { supported: false }; }
  }
  async function isPersisted() {
    if (!(navigator.storage && navigator.storage.persisted)) return null;
    try { return await navigator.storage.persisted(); } catch (e) { return null; }
  }

  /* ============================================================
     ŞƏKİLLƏRİ CİHAZA FAYL KİMİ İXRAC ET
     Bütün məhsul/qaralama şəkillərini telefonun öz Yükləmələr
     qovluğuna, adi foto faylı kimi köçürür. Brauzer yaddaşı
     silinsə belə, bu fayllar telefonun özündə qalır — real
     ehtiyat nüsxə.
     ============================================================ */
  async function exportAllImagesToDevice(onProgress) {
    const items = [];
    JollyDB.Products.all().forEach(p => (p.images || []).forEach((img, i) => items.push({ name: p.name || 'mehsul', ref: img, idx: i })));
    JollyDB.Drafts.all().forEach(d => (d.images || []).forEach((img, i) => items.push({ name: d.name || 'qaralama', ref: img, idx: i })));
    const total = items.length;
    let done = 0;
    for (const it of items) {
      let dataUrl = it.ref;
      if (dataUrl && dataUrl.startsWith && dataUrl.startsWith('idb:')) {
        dataUrl = await getImage(dataUrl);
      }
      if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
        const extMatch = dataUrl.match(/^data:image\/(\w+);/);
        const ext = extMatch ? extMatch[1].replace('jpeg', 'jpg') : 'jpg';
        const safeName = String(it.name).replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'mehsul';
        const filename = `jolly_${safeName}_${it.idx + 1}.${ext}`;
        try {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (e) { console.error('JollyStorage export image error', e); }
        // Brauzer ard-arda çox sürətli endirməni bloklamasın deyə kiçik fasilə
        await new Promise(res => setTimeout(res, 260));
      }
      done++;
      if (onProgress) onProgress(done, total);
    }
    return done;
  }

  return {
    isSupported, saveImage, getImage, deleteImage, hydrate, imgAttr, migrateOldImages, ensureThumb,
    resolveAll, initAutoHydrate, compressImage,
    requestPersistence, isPersisted, exportAllImagesToDevice,
  };
})();
