/* ==========================================================================
   JOLLY vNext — memory-mirror.js              v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   RAM güzgüsü. JollyDB-nin İÇİNDƏ deyil — AYRICA komponent (07-28 qərarı).

   NƏ ÜÇÜN?
   Hər oxuda localStorage-dan sətir çəkib JSON.parse etmək telefonda bahalıdır.
   3000 məhsullu kataloqda bu, hər axtarış hərfində təkrarlanır. Güzgü onları
   bir dəfə açıb RAM-da saxlayır — sonrakı oxular anidir.

   ÜÇ SİNİF (07-28-də razılaşdırılıb):
     • güzgüdə saxlanılanlar — products, settings, users, permissions,
       modules, themes, groups, firma, status
     • lazy (istəndikdə açılanlar) — categories, brands, suppliers, locations
     • heç vaxt güzgüyə düşməyənlər — images, logs, backups, OCR, history,
       thumbnails, exports, arxiv

   YAZMA — write-through:
     MemoryMirror.update() → güzgü dərhal yenilənir (UI ləngimir)
        → StorageAdapter.put()
        → uğurlu olsa hadisə yayımlanır
        → UĞURSUZ OLSA güzgü geri qaytarılır + istifadəçiyə xəbərdarlıq
     Yəni ekranda görünən heç vaxt yaddaşda olmayan bir şey qalmır.

   API adı `initialize()`-dir (`loadAll()` yox) — böyük kataloqda daxildə
   hissə-hissə yükləməyə keçmək üçün ad dəyişməsin.

   jolly-boot.js bu faylı avtomatik tapıb açılışda işə salır.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ----------------------------------------------------------------------
     0. Sinif təyini
     ---------------------------------------------------------------------- */
  var NEVER = ['image', 'img', 'sekil', 'şəkil', 'photo', 'thumb', 'foto',
               'log', 'jurnal', 'journal', 'blackbox', 'diag', 'audit',
               'backup', 'ehtiyat', 'export', 'idxal_ham', 'ocr',
               'history', 'tarixce', 'tarixçə', 'archive', 'arxiv',
               'cache', 'kes', 'session', 'sess', 'heartbeat', 'prerestore'];

  var LAZY  = ['categor', 'kateqoriya', 'brand', 'marka', 'supplier', 'tedaruk',
               'tədarük', 'location', 'yer', 'shelf', 'ref', 'rəf', 'map'];

  var MIRROR = ['product', 'mehsul', 'məhsul', 'setting', 'ayar', 'config',
                'user', 'isci', 'işçi', 'perm', 'icaze', 'icazə', 'role', 'rol',
                'module', 'modul', 'theme', 'tema', 'group', 'qrup',
                'firma', 'company', 'status', 'barcode', 'barkod', 'tombstone'];

  /* ⚠️ 07-29 cihaz testi: hədd 600 KB idi, `jolly_products` isə 946 KB —
     yəni güzgü ƏN VACİB açarı atırdı və faydası demək olar sıfır idi.
     RAM-da 5 MB saxlamaq telefon üçün problem deyil (cihaz kvotası 10 GB),
     localStorage limiti ilə heç bir əlaqəsi yoxdur. */
  var MAX_ITEM_BYTES  = 5 * 1024 * 1024;    // bundan böyük açar güzgüyə düşmür
  var MAX_TOTAL_BYTES = 24 * 1024 * 1024;   // güzgünün ümumi büdcəsi

  function has(list, k) {
    k = String(k || '').toLowerCase();
    for (var i = 0; i < list.length; i++) if (k.indexOf(list[i]) !== -1) return true;
    return false;
  }

  // ⚠️ 07-29 audit: 'log' sözü 'catalog'/'kataloq'/'dialog' içində də tapılır.
  // İstisna olmasaydı `jolly_catalog` güzgüdən kənarda qalardı.
  var NOT_NEVER = ['catalog', 'kataloq', 'dialog', 'analog', 'logo', 'login'];

  function classify(key) {
    var k = String(key || '');
    if (k.indexOf('__jolly_') === 0 || k.indexOf('jolly_journal') === 0) return 'never';
    if (has(NEVER, k) && !has(NOT_NEVER, k)) return 'never';
    if (has(LAZY, k)) return 'lazy';
    if (has(MIRROR, k)) return 'mirror';
    return 'lazy';   // tanımadığımızı zorla RAM-a yığmırıq
  }

  /* ----------------------------------------------------------------------
     1. Vəziyyət
     ---------------------------------------------------------------------- */
  var mirror = {};          // key -> parsed dəyər
  var meta   = {};          // key -> {cls, bytes, at, loads}
  var state = {
    ready: false,
    initPromise: null,
    initMs: 0,
    bytes: 0,
    overBudget: [],
    stats: { hits: 0, misses: 0, loads: 0, writes: 0, rollbacks: 0, refreshes: 0, evictions: 0 }
  };

  function SA() { return global.StorageAdapter || null; }

  function rawOf(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function bytesOf(key, raw) { return (key.length + (raw ? raw.length : 0)) * 2; }

  function decode(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  function emit(name, detail) {
    try {
      if (global.JollyEvents && global.JollyEvents.emit) global.JollyEvents.emit(name, detail);
    } catch (e) {}
    try { global.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  function toast(msg, kind) {
    try {
      if (global.Toast) {
        if (kind === 'error' && global.Toast.error) return global.Toast.error(msg);
        if (global.Toast.info) return global.Toast.info(msg);
      }
    } catch (e) {}
    console.warn('[Mirror] ' + msg);
  }

  /* ----------------------------------------------------------------------
     2. Yükləmə
     ---------------------------------------------------------------------- */
  function loadKey(key, force) {
    var raw = rawOf(key);
    var b = bytesOf(key, raw);
    var cls = classify(key);

    if (!force) {
      if (cls === 'never') return false;
      if (b > MAX_ITEM_BYTES) {
        state.overBudget.push({ key: key, kb: +(b / 1024).toFixed(0) });
        return false;
      }
      if (state.bytes + b > MAX_TOTAL_BYTES) {
        state.overBudget.push({ key: key, kb: +(b / 1024).toFixed(0), reason: 'büdcə' });
        return false;
      }
    }

    var old = meta[key] ? meta[key].bytes : 0;
    mirror[key] = decode(raw);
    meta[key] = { cls: cls, bytes: b, at: Date.now(), loads: (meta[key] ? meta[key].loads : 0) + 1 };
    state.bytes += (b - old);
    state.stats.loads++;
    return true;
  }

  function initialize(opts) {
    if (state.initPromise) return state.initPromise;
    opts = opts || {};
    var t0 = Date.now();

    state.initPromise = Promise.resolve().then(function () {
      var keys = [];
      try {
        for (var i = 0; i < global.localStorage.length; i++) keys.push(global.localStorage.key(i));
      } catch (e) {}

      var loaded = 0, skipped = 0, lazy = 0;
      keys.forEach(function (k) {
        if (!k) return;
        var cls = classify(k);
        if (cls === 'mirror') { if (loadKey(k)) loaded++; else skipped++; }
        else if (cls === 'lazy') { lazy++; meta[k] = meta[k] || { cls: 'lazy', bytes: 0, at: 0, loads: 0 }; }
        else skipped++;
      });

      // Kənardan (köhnə kod, başqa tab, bulud) gələn dəyişiklikləri izlə
      global.addEventListener('storage.changed', function (e) {
        var d = e && e.detail;
        if (!d || !d.key) return;
        if (!(d.key in mirror)) return;               // güzgüdə deyilsə maraqlanmırıq
        if (d.source === 'mirror') return;            // özümüz yazmışıq
        loadKey(d.key, true);
        state.stats.refreshes++;
        emit('mirror.refreshed', { key: d.key, source: d.source });
      });

      state.ready = true;
      state.initMs = Date.now() - t0;
      var out = { loaded: loaded, lazy: lazy, skipped: skipped,
                  mb: +(state.bytes / 1048576).toFixed(2), ms: state.initMs };
      console.log('[Mirror] güzgü hazırdır — ' + loaded + ' açar, ' + out.mb + ' MB, ' + out.ms + ' ms');
      emit('mirror.ready', out);
      return out;
    });

    return state.initPromise;
  }

  /* ----------------------------------------------------------------------
     3. Oxuma
     ---------------------------------------------------------------------- */
  function get(key, fallback) {
    if (key in mirror) { state.stats.hits++; return mirror[key]; }
    state.stats.misses++;

    var cls = classify(key);
    if (cls === 'never') {
      // Güzgüdən keçmir — birbaşa yaddaşdan
      var raw = rawOf(key);
      return raw === null ? (fallback === undefined ? null : fallback) : decode(raw);
    }

    // lazy: ilk istəkdə açılır və artıq güzgüdə qalır
    if (loadKey(key)) return mirror[key];
    var r = rawOf(key);
    return r === null ? (fallback === undefined ? null : fallback) : decode(r);
  }

  /* ----------------------------------------------------------------------
     4. Yazma — write-through
     ---------------------------------------------------------------------- */
  function update(key, value, options) {
    options = options || {};
    var had = (key in mirror);
    var prev = had ? mirror[key] : undefined;

    // 1) güzgü dərhal — ekran gözləmir
    mirror[key] = value;
    if (!meta[key]) meta[key] = { cls: classify(key), bytes: 0, at: Date.now(), loads: 0 };
    meta[key].at = Date.now();
    state.stats.writes++;
    if (!options.silent) emit('mirror.changed', { key: key, value: value, source: 'mirror' });

    var adapter = SA();
    if (!adapter) {
      // Adapter yoxdursa köhnə yolla yaz
      try { global.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); return Promise.resolve(true); }
      catch (e) { rollback(); return Promise.reject(e); }
    }

    function rollback() {
      if (had) mirror[key] = prev; else delete mirror[key];
      state.stats.rollbacks++;
      emit('mirror.rolledback', { key: key });
    }

    // 2) yaddaşa — jurnal və hadisələr adapterin içində baş verir
    return adapter.put(key, value).then(function (r) {
      var raw = rawOf(key);
      var old = meta[key].bytes;
      meta[key].bytes = bytesOf(key, raw);
      state.bytes += (meta[key].bytes - old);
      return r;
    }, function (err) {
      // 3) alınmadı → güzgünü geri qaytar, istifadəçiyə de
      rollback();
      var quota = err && err.code === 'quota';
      toast(quota ? '⚠️ Yaddaş doludur — dəyişiklik saxlanmadı'
                  : '⚠️ Dəyişiklik saxlanmadı: ' + ((err && err.message) || 'naməlum xəta'), 'error');
      throw err;
    });
  }

  function remove(key) {
    var had = (key in mirror), prev = mirror[key];
    delete mirror[key];
    if (meta[key]) { state.bytes -= meta[key].bytes; delete meta[key]; }
    emit('mirror.changed', { key: key, value: null, source: 'mirror' });

    var adapter = SA();
    if (!adapter) {
      try { global.localStorage.removeItem(key); return Promise.resolve(true); } catch (e) { return Promise.reject(e); }
    }
    return adapter.remove(key).catch(function (err) {
      if (had) mirror[key] = prev;
      state.stats.rollbacks++;
      toast('⚠️ Silinmə saxlanmadı', 'error');
      throw err;
    });
  }

  /* ----------------------------------------------------------------------
     5. API
     ---------------------------------------------------------------------- */
  var MemoryMirror = {
    version: '1.0.0',

    initialize: initialize,
    isReady: function () { return state.ready; },
    whenReady: function () { return state.initPromise || initialize(); },

    get: get,
    has: function (key) { return key in mirror; },
    update: update,
    remove: remove,

    // Bir açarı yaddaşdan yenidən oxu (kənar dəyişiklikdən sonra)
    reload: function (key) { var ok = loadKey(key, true); state.stats.refreshes++; return ok; },

    // Güzgüdən çıxar (RAM boşaltmaq üçün) — yaddaşa toxunmur
    evict: function (key) {
      if (!(key in mirror)) return false;
      delete mirror[key];
      if (meta[key]) { state.bytes -= meta[key].bytes; meta[key].bytes = 0; }
      state.stats.evictions++;
      return true;
    },

    classOf: classify,
    keys: function (cls) {
      return Object.keys(meta).filter(function (k) { return !cls || meta[k].cls === cls; });
    },

    list: function () {
      return Object.keys(meta).map(function (k) {
        return { key: k, cls: meta[k].cls, kb: +(meta[k].bytes / 1024).toFixed(1),
                 inRam: (k in mirror), loads: meta[k].loads };
      }).sort(function (a, b) { return b.kb - a.kb; });
    },

    stats: function () {
      var s = JSON.parse(JSON.stringify(state.stats));
      var total = s.hits + s.misses;
      s.hitRate = total ? +((s.hits / total) * 100).toFixed(1) : null;
      return s;
    },

    /* ---- Sağlamlıq — Nüvə Sağlamlığı ekranı oxuyacaq ---- */
    health: function () {
      var problems = [];
      var st = this.stats();
      if (!state.ready) problems.push('Güzgü hələ hazır deyil');
      if (state.overBudget.length) {
        problems.push(state.overBudget.length + ' açar güzgüyə sığmadı (çox böyük) — IndexedDB-yə köçürülməlidir');
      }
      if (st.rollbacks > 0) problems.push(st.rollbacks + ' yazma geri qaytarıldı — yaddaş problemi ola bilər');
      if (st.hitRate !== null && st.hitRate < 50 && st.hits + st.misses > 50) {
        problems.push('Güzgü faydası aşağıdır (' + st.hitRate + '%) — siniflər yenidən baxılmalıdır');
      }

      return Promise.resolve({
        ok: problems.length === 0,
        problems: problems,
        ready: state.ready,
        initMs: state.initMs,
        mb: +(state.bytes / 1048576).toFixed(2),
        mirrored: Object.keys(mirror).length,
        tracked: Object.keys(meta).length,
        overBudget: state.overBudget,
        top: this.list().slice(0, 8),
        stats: st
      });
    },

    /* ---- Özünü yoxlama ---- */
    selfTest: function () {
      var k = 'jolly_mirror_probe';   // "product/setting" deyil → lazy sinif
      var out = { ok: false, write: false, read: false, rollback: false, classes: false };

      out.classes = classify('jolly_products') === 'mirror' &&
                    classify('jolly_thumbnails') === 'never' &&
                    classify('jolly_suppliers') === 'lazy';

      return initialize()
        .then(function () { return update(k, { a: 1, ə: 'çğışöü' }); })
        .then(function () {
          out.write = true;
          out.read = get(k) && get(k).a === 1;
          // geri qaytarma yolu: adapter xəta atsa güzgü köhnəyə dönməlidir
          var adapter = SA();
          if (!adapter) return;
          var orig = adapter.put;
          adapter.put = function () { return Promise.reject({ code: 'quota', message: 'sınaq' }); };
          return update(k, { a: 999 }).catch(function () {}).then(function () {
            adapter.put = orig;
            out.rollback = get(k) && get(k).a === 1;   // köhnə dəyər qalmalıdır
          });
        })
        .then(function () { return remove(k).catch(function () {}); })
        .then(function () {
          out.ok = out.write && out.read && out.rollback && out.classes;
          return out;
        })
        .catch(function (e) { out.error = (e && e.message) || String(e); return out; });
    },

    _internals: function () { return { mirror: mirror, meta: meta, state: state }; }
  };

  global.MemoryMirror = MemoryMirror;

})(window);
