/* ==========================================================================
   JOLLY vNext — storage-adapter.js            v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   Qat sırası:  UI → Modules → Engines → [StorageAdapter] → OperationJournal
                → Storage (localStorage / IndexedDB / Cloud)

   QAYDA #1: Bu fayl İLK GÜNDƏN async imzalıdır.
             await StorageAdapter.get(key)
             await StorageAdapter.put(key, value)
             await StorageAdapter.remove(key)
             İçəridə hələ localStorage oxuyur — amma imza async olduğu üçün
             sabah IndexedDB-yə keçəndə ÇAĞIRAN KODA HEÇ NƏ DƏYİŞMİR.

   QAYDA #2: Köhnə API sınmır. db.js hələ də birbaşa localStorage oxuya bilər.
             Adapter EYNİ açarları, EYNİ formatda saxlayır — prefiks əlavə
             etmir, açar adını dəyişmir.

   QAYDA #3: Bu fayl UI modulu deyil — ModuleRegistry-yə yazılmır, icazə
             açarı tələb etmir. O, modulların ALTINDAKI qatdır.

   Yükləmə yeri: index.html-də ƏN ƏVVƏL — db.js-dən də ƏVVƏL.
   <script src="storage-adapter.js"></script>
   ========================================================================== */

(function (global) {
  'use strict';

  /* ----------------------------------------------------------------------
     0. Xəta tipləri
     ---------------------------------------------------------------------- */
  function StorageError(message, code, cause) {
    this.name = 'StorageError';
    this.message = message;
    this.code = code || 'unknown';      // quota | unavailable | serialize | backend
    this.cause = cause || null;
  }
  StorageError.prototype = Object.create(Error.prototype);
  StorageError.prototype.constructor = StorageError;

  /* ----------------------------------------------------------------------
     1. Backend interfeysi
     Hər backend eyni 5 metodu verir. IndexedDB backend-i sabah bura
     əlavə olunacaq — yuxarıdakı kodun xəbəri belə olmayacaq.
        getRaw(key)      -> Promise<string|null>
        setRaw(key, str) -> Promise<void>
        delRaw(key)      -> Promise<void>
        listKeys()       -> Promise<string[]>
        bytes()          -> Promise<number>
     ---------------------------------------------------------------------- */

  /* --- 1a. localStorage backend (hazırkı əsas) --- */
  var LocalBackend = {
    id: 'local',
    label: 'localStorage',
    available: function () {
      try {
        var t = '__jolly_probe__';
        global.localStorage.setItem(t, '1');
        global.localStorage.removeItem(t);
        return true;
      } catch (e) { return false; }
    },
    getRaw: function (key) {
      try { return Promise.resolve(global.localStorage.getItem(key)); }
      catch (e) { return Promise.reject(new StorageError('Oxuma alınmadı: ' + key, 'backend', e)); }
    },
    setRaw: function (key, str) {
      try {
        global.localStorage.setItem(key, str);
        return Promise.resolve();
      } catch (e) {
        var quota = (e && (e.name === 'QuotaExceededError' ||
                           e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                           e.code === 22 || e.code === 1014));
        return Promise.reject(new StorageError(
          quota ? 'Yaddaş doludur (' + key + ')' : 'Yazma alınmadı: ' + key,
          quota ? 'quota' : 'backend', e));
      }
    },
    delRaw: function (key) {
      try { global.localStorage.removeItem(key); return Promise.resolve(); }
      catch (e) { return Promise.reject(new StorageError('Silmə alınmadı: ' + key, 'backend', e)); }
    },
    listKeys: function () {
      var out = [];
      try {
        for (var i = 0; i < global.localStorage.length; i++) out.push(global.localStorage.key(i));
      } catch (e) {}
      return Promise.resolve(out);
    },
    bytes: function () {
      var total = 0;
      try {
        for (var i = 0; i < global.localStorage.length; i++) {
          var k = global.localStorage.key(i);
          var v = global.localStorage.getItem(k) || '';
          total += (k.length + v.length) * 2;   // UTF-16
        }
      } catch (e) {}
      return Promise.resolve(total);
    }
  };

  /* --- 1b. Yaddaş (RAM) backend — localStorage bağlı olanda avarageçid --- */
  function MemoryBackend() {
    var map = {};
    return {
      id: 'memory',
      label: 'RAM (müvəqqəti)',
      available: function () { return true; },
      getRaw: function (k) { return Promise.resolve(Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null); },
      setRaw: function (k, s) { map[k] = s; return Promise.resolve(); },
      delRaw: function (k) { delete map[k]; return Promise.resolve(); },
      listKeys: function () { return Promise.resolve(Object.keys(map)); },
      bytes: function () {
        var t = 0; for (var k in map) t += (k.length + String(map[k]).length) * 2;
        return Promise.resolve(t);
      }
    };
  }

  /* ----------------------------------------------------------------------
     2. Daxili vəziyyət
     ---------------------------------------------------------------------- */
  var state = {
    ready: false,
    initPromise: null,
    initMs: 0,
    backend: null,
    backendId: null,
    fallbackUsed: false,
    routes: [],        // [{prefix:'jolly_img_', backend:<obj>}] — gələcək hibrid saxlama
    cache: {},         // key -> {v: parsed, t: timestamp}
    cacheTtl: 200,     // ms — db.js-in 150ms keşi ilə uyğun, təhlükəsiz qısa
    locks: {},         // key -> Promise (yazıların ardıcıllığı)
    middleware: [],    // OperationJournal buraya qoşulacaq
    reclaimers: [],    // yaddaş dolanda yer açan funksiyalar
    listeners: [],
    stats: { reads: 0, writes: 0, removes: 0, cacheHits: 0, errors: 0, quotaHits: 0 },
    lastError: null,
    lastWriteAt: 0
  };

  /* ----------------------------------------------------------------------
     3. Köməkçilər
     ---------------------------------------------------------------------- */

  // Sətir isə olduğu kimi saxlayırıq (köhnə kod uyğunluğu üçün),
  // əks halda JSON. Beləliklə 'grid' → grid, {a:1} → {"a":1}
  function encode(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); }
    catch (e) { throw new StorageError('Dəyəri JSON-a çevirmək olmadı', 'serialize', e); }
  }

  function decode(raw, fallback) {
    if (raw === null || raw === undefined) return (fallback === undefined ? null : fallback);
    if (raw === '') return (fallback === undefined ? null : fallback);
    try { return JSON.parse(raw); }
    catch (e) { return raw; }   // adi mətn idi
  }

  function backendFor(key) {
    for (var i = 0; i < state.routes.length; i++) {
      if (key.indexOf(state.routes[i].prefix) === 0) return state.routes[i].backend;
    }
    return state.backend;
  }

  function cacheGet(key) {
    var c = state.cache[key];
    if (!c) return undefined;
    if (Date.now() - c.t > state.cacheTtl) { delete state.cache[key]; return undefined; }
    state.stats.cacheHits++;
    return c.v;
  }
  function cacheSet(key, v) { state.cache[key] = { v: v, t: Date.now() }; }
  function cacheDrop(key) { if (key) delete state.cache[key]; else state.cache = {}; }

  // Eyni açara paralel yazıların bir-birini əzməməsi üçün növbə
  function withLock(key, fn) {
    var prev = state.locks[key] || Promise.resolve();
    var next = prev.then(fn, fn);
    state.locks[key] = next.catch(function () {}).then(function () {
      if (state.locks[key] === next) delete state.locks[key];
    });
    return next;
  }

  function notify(key, value, action, source) {
    var detail = { key: key, value: value, action: action, source: source || 'local' };
    // 1) daxili abunəçilər
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i](detail); } catch (e) {}
    }
    // 2) JOLLY Event Bus (varsa)
    try {
      if (global.JollyEvents && typeof global.JollyEvents.emit === 'function') {
        global.JollyEvents.emit('storage.changed', detail);
      }
    } catch (e) {}
    // 3) DOM hadisəsi — cloud.js və MemoryMirror bunu dinləyəcək
    try {
      global.dispatchEvent(new CustomEvent('storage.changed', { detail: detail }));
    } catch (e) {}
  }

  function runMiddleware(phase, op, err) {
    var chain = Promise.resolve();
    state.middleware.forEach(function (mw) {
      var fn = mw[phase];
      if (typeof fn !== 'function') return;
      chain = chain.then(function () { return fn(op, err); })
                   .catch(function (e) {
                     // Middleware xətası əsas əməliyyatı dayandırmır (jurnaldan başqa)
                     if (mw.critical) throw e;
                     console.warn('[StorageAdapter] middleware "' + (mw.name || '?') + '" xətası:', e);
                   });
    });
    return chain;
  }

  function needsPrev() {
    for (var i = 0; i < state.middleware.length; i++) if (state.middleware[i].needsPrev) return true;
    return false;
  }

  function recordError(e) {
    state.stats.errors++;
    if (e && e.code === 'quota') state.stats.quotaHits++;
    state.lastError = {
      message: (e && e.message) || String(e),
      code: (e && e.code) || 'unknown',
      at: Date.now()
    };
  }

  /* ----------------------------------------------------------------------
     4. Əsas API
     ---------------------------------------------------------------------- */
  var StorageAdapter = {

    version: '1.0.0',

    /* ---- 4a. Başlatma — app.js boot sırasında BİRİNCİ çağırılır ---- */
    initialize: function (opts) {
      if (state.initPromise) return state.initPromise;
      var t0 = Date.now();
      opts = opts || {};

      state.initPromise = new Promise(function (resolve) {
        if (LocalBackend.available()) {
          state.backend = LocalBackend;
          state.backendId = 'local';
        } else {
          state.backend = MemoryBackend();
          state.backendId = 'memory';
          state.fallbackUsed = true;
          console.warn('[StorageAdapter] localStorage əlçatmazdır — RAM rejiminə keçildi. Məlumat SAXLANILMAYACAQ.');
        }
        if (typeof opts.cacheTtl === 'number') state.cacheTtl = opts.cacheTtl;

        // Başqa tab/pəncərədə dəyişiklik olsa keşi at və xəbər ver
        try {
          global.addEventListener('storage', function (e) {
            if (!e || !e.key) { cacheDrop(); return; }
            cacheDrop(e.key);
            notify(e.key, decode(e.newValue), e.newValue === null ? 'remove' : 'put', 'external');
          });
        } catch (e) {}

        state.ready = true;
        state.initMs = Date.now() - t0;
        resolve({ backend: state.backendId, ms: state.initMs, fallback: state.fallbackUsed });
      });

      return state.initPromise;
    },

    whenReady: function () { return state.initPromise || this.initialize(); },
    isReady: function () { return state.ready; },
    backendId: function () { return state.backendId; },

    /* ---- 4b. Oxuma ---- */
    get: function (key, fallback, options) {
      options = options || {};
      var self = this;
      return this.whenReady().then(function () {
        if (!options.raw && !options.fresh) {
          var hit = cacheGet(key);
          if (hit !== undefined) return hit;
        }
        state.stats.reads++;
        return backendFor(key).getRaw(key).then(function (raw) {
          if (options.raw) return raw;
          var val = decode(raw, fallback);
          cacheSet(key, val);
          return val;
        }).catch(function (e) {
          recordError(e);
          return (fallback === undefined ? null : fallback);
        });
      });
    },

    getRaw: function (key) { return this.get(key, null, { raw: true }); },

    getMany: function (keys) {
      var self = this;
      return Promise.all(keys.map(function (k) { return self.get(k); }))
        .then(function (vals) {
          var out = {};
          keys.forEach(function (k, i) { out[k] = vals[i]; });
          return out;
        });
    },

    has: function (key) {
      return this.getRaw(key).then(function (raw) { return raw !== null && raw !== undefined; });
    },

    /* ---- 4c. Yazma ---- */
    put: function (key, value, options) {
      options = options || {};
      var self = this;
      return this.whenReady().then(function () {
        return withLock(key, function () {
          var str;
          try { str = options.raw ? String(value) : encode(value); }
          catch (e) { recordError(e); return Promise.reject(e); }

          var op = { type: 'put', key: key, value: value, raw: str, prev: undefined, at: Date.now() };
          var pre = needsPrev()
            ? backendFor(key).getRaw(key).then(function (p) { op.prev = p; })
            : Promise.resolve();

          return pre
            .then(function () { return runMiddleware('before', op); })
            .then(function () { return backendFor(key).setRaw(key, str); })
            .catch(function (e) {
              // Yaddaş dolubsa: yer açanları işə sal, BİR dəfə təkrar cəhd et
              if (e && e.code === 'quota' && state.reclaimers.length && !options._retried) {
                recordError(e);
                return self._reclaim(key).then(function () {
                  return backendFor(key).setRaw(key, str);
                });
              }
              throw e;
            })
            .then(function () {
              state.stats.writes++;
              state.lastWriteAt = Date.now();
              cacheSet(key, options.raw ? str : value);
              return runMiddleware('after', op);
            })
            .then(function () {
              if (!options.silent) notify(key, value, 'put', 'local');
              return true;
            })
            .catch(function (e) {
              recordError(e);
              cacheDrop(key);
              return runMiddleware('error', op, e).then(function () {
                if (options.soft) return false;   // soft: xəta atma, false qaytar
                throw e;
              });
            });
        });
      });
    },

    putMany: function (entries, options) {
      var self = this, keys = Object.keys(entries || {});
      return keys.reduce(function (chain, k) {
        return chain.then(function () { return self.put(k, entries[k], options); });
      }, Promise.resolve()).then(function () { return true; });
    },

    /* ---- 4d. Silmə ---- */
    remove: function (key, options) {
      options = options || {};
      var self = this;
      return this.whenReady().then(function () {
        return withLock(key, function () {
          var op = { type: 'remove', key: key, prev: undefined, at: Date.now() };
          var pre = needsPrev()
            ? backendFor(key).getRaw(key).then(function (p) { op.prev = p; })
            : Promise.resolve();

          return pre
            .then(function () { return runMiddleware('before', op); })
            .then(function () { return backendFor(key).delRaw(key); })
            .then(function () {
              state.stats.removes++;
              cacheDrop(key);
              return runMiddleware('after', op);
            })
            .then(function () {
              if (!options.silent) notify(key, null, 'remove', 'local');
              return true;
            })
            .catch(function (e) {
              recordError(e);
              return runMiddleware('error', op, e).then(function () {
                if (options.soft) return false;
                throw e;
              });
            });
        });
      });
    },

    /* ---- 4e. Açarlar ---- */
    keys: function (prefix) {
      return this.whenReady().then(function () {
        return state.backend.listKeys().then(function (all) {
          if (!prefix) return all;
          return all.filter(function (k) { return k && k.indexOf(prefix) === 0; });
        });
      });
    },

    /* ----------------------------------------------------------------------
       5. SİNXRON KÖRPÜ — yalnız köçid dövrü üçün
       db.js-in bütün oxuları bir gecədə async ola bilməz. Bu üç metod
       eyni keşdən və eyni hadisə axınından keçir, ona görə köhnə kod
       adapterlə ZİDDİYYƏT yaratmır.
       ⚠️ Bunlar YALNIZ localStorage backend-i ilə işləyir. IndexedDB-yə
       keçəndə bu metodları çağıran hər yer əvvəlcədən async-ə keçirilməlidir
       — ona görə YENİ kodda İSTİFADƏ ETMƏ.
       ---------------------------------------------------------------------- */
    getSync: function (key, fallback) {
      var hit = cacheGet(key);
      if (hit !== undefined) return hit;
      try {
        var raw = global.localStorage.getItem(key);
        var val = decode(raw, fallback);
        cacheSet(key, val);
        state.stats.reads++;
        return val;
      } catch (e) {
        recordError(e);
        return (fallback === undefined ? null : fallback);
      }
    },

    putSync: function (key, value) {
      try {
        global.localStorage.setItem(key, encode(value));
        state.stats.writes++;
        state.lastWriteAt = Date.now();
        cacheSet(key, value);
        notify(key, value, 'put', 'local-sync');
        return true;
      } catch (e) {
        recordError(new StorageError('Sinxron yazma alınmadı: ' + key,
          (e && e.name === 'QuotaExceededError') ? 'quota' : 'backend', e));
        cacheDrop(key);
        return false;
      }
    },

    removeSync: function (key) {
      try {
        global.localStorage.removeItem(key);
        state.stats.removes++;
        cacheDrop(key);
        notify(key, null, 'remove', 'local-sync');
        return true;
      } catch (e) { recordError(e); return false; }
    },

    /* ----------------------------------------------------------------------
       6. Genişləndirmə nöqtələri
       ---------------------------------------------------------------------- */

    // OperationJournal bura qoşulacaq:
    // StorageAdapter.use({name:'journal', critical:true, needsPrev:true,
    //                     before(op){...}, after(op){...}, error(op,err){...}})
    use: function (mw) {
      if (!mw || typeof mw !== 'object') return this;
      state.middleware = state.middleware.filter(function (m) { return m.name !== mw.name; });
      state.middleware.push(mw);
      return this;
    },
    unuse: function (name) {
      state.middleware = state.middleware.filter(function (m) { return m.name !== name; });
      return this;
    },
    middlewareNames: function () {
      return state.middleware.map(function (m) { return m.name || '(adsız)'; });
    },

    // Yaddaş dolanda yer açan funksiyalar (db.js arxiv təmizləyicisi buraya).
    // fn() → Promise ; nə qədər bayt azad etdiyini qaytarsa daha yaxşı.
    onQuota: function (fn, name) {
      if (typeof fn === 'function') state.reclaimers.push({ fn: fn, name: name || 'reclaimer' });
      return this;
    },
    _reclaim: function (forKey) {
      var chain = Promise.resolve();
      state.reclaimers.forEach(function (r) {
        chain = chain.then(function () { return r.fn(forKey); })
                     .catch(function (e) { console.warn('[StorageAdapter] reclaimer "' + r.name + '":', e); });
      });
      return chain.then(function () { cacheDrop(); });
    },

    // Gələcək hibrid saxlama: müəyyən prefiksli açarları başqa backend-ə yönləndir
    // StorageAdapter.route('jolly_img_', IndexedDBBackend)
    route: function (prefix, backend) {
      state.routes = state.routes.filter(function (r) { return r.prefix !== prefix; });
      if (backend) state.routes.push({ prefix: prefix, backend: backend });
      state.routes.sort(function (a, b) { return b.prefix.length - a.prefix.length; });
      cacheDrop();
      return this;
    },
    routes: function () {
      return state.routes.map(function (r) { return { prefix: r.prefix, backend: r.backend.id }; });
    },

    // Dəyişiklik abunəliyi (MemoryMirror bunu istifadə edəcək)
    onChange: function (fn) {
      if (typeof fn === 'function') state.listeners.push(fn);
      var self = this;
      return function () { self.offChange(fn); };
    },
    offChange: function (fn) {
      state.listeners = state.listeners.filter(function (f) { return f !== fn; });
    },

    invalidate: function (key) { cacheDrop(key); return this; },
    setCacheTtl: function (ms) { state.cacheTtl = Math.max(0, ms | 0); return this; },

    /* ----------------------------------------------------------------------
       7. Sağlamlıq — jolly-selftest.js (HealthMonitor v2) bunu oxuyacaq
       ---------------------------------------------------------------------- */
    health: function () {
      var self = this;
      return this.whenReady().then(function () {
        return Promise.all([
          state.backend.bytes().catch(function () { return -1; }),
          state.backend.listKeys().catch(function () { return []; }),
          (global.navigator && global.navigator.storage && global.navigator.storage.estimate)
            ? global.navigator.storage.estimate().catch(function () { return null; })
            : Promise.resolve(null)
        ]).then(function (r) {
          var bytes = r[0], keys = r[1], est = r[2];
          var pending = Object.keys(state.locks).length;
          var problems = [];
          if (state.fallbackUsed) problems.push('localStorage bağlıdır — məlumat saxlanılmır');
          if (state.stats.quotaHits > 0) problems.push('Yaddaş dolma xətası: ' + state.stats.quotaHits + ' dəfə');
          if (bytes > 4.5 * 1024 * 1024) problems.push('localStorage 4.5 MB-ı keçib — təmizlik lazımdır');
          if (state.lastError && Date.now() - state.lastError.at < 60000) problems.push('Son 1 dəqiqədə xəta: ' + state.lastError.message);

          return {
            ok: problems.length === 0,
            problems: problems,
            backend: state.backendId,
            fallback: state.fallbackUsed,
            ready: state.ready,
            initMs: state.initMs,
            keyCount: keys.length,
            bytes: bytes,
            mb: bytes >= 0 ? +(bytes / 1048576).toFixed(2) : null,
            quotaUsage: est && est.quota ? +((est.usage / est.quota) * 100).toFixed(1) : null,
            quotaMb: est && est.quota ? +(est.quota / 1048576).toFixed(0) : null,
            usageMb: est && est.usage ? +(est.usage / 1048576).toFixed(2) : null,
            pendingWrites: pending,
            middleware: self.middlewareNames(),
            routes: self.routes(),
            reclaimers: state.reclaimers.length,
            lastWriteAt: state.lastWriteAt,
            lastError: state.lastError,
            stats: JSON.parse(JSON.stringify(state.stats))
          };
        });
      });
    },

    // Ən böyük açarlar — "yaddaşı kim yeyir?" sualına cavab
    topKeys: function (limit) {
      limit = limit || 15;
      return this.whenReady().then(function () {
        return state.backend.listKeys().then(function (keys) {
          var rows = [];
          keys.forEach(function (k) {
            var v = '';
            try { v = global.localStorage.getItem(k) || ''; } catch (e) {}
            rows.push({ key: k, bytes: (k.length + v.length) * 2 });
          });
          rows.sort(function (a, b) { return b.bytes - a.bytes; });
          return rows.slice(0, limit).map(function (r) {
            return { key: r.key, bytes: r.bytes, kb: +(r.bytes / 1024).toFixed(1) };
          });
        });
      });
    },

    stats: function () { return JSON.parse(JSON.stringify(state.stats)); },
    resetStats: function () {
      state.stats = { reads: 0, writes: 0, removes: 0, cacheHits: 0, errors: 0, quotaHits: 0 };
      state.lastError = null;
      return this;
    },

    /* ---- 8. Özünü yoxlama — selftest bunu birbaşa çağıra bilər ---- */
    selfTest: function () {
      var self = this, k = '__jolly_adapter_test__';
      var sample = { n: 1, s: 'əçğışöü', d: [1, 2, 3], t: Date.now() };
      return this.initialize()
        .then(function () { return self.put(k, sample, { silent: true }); })
        .then(function () { return self.get(k, null, { fresh: true }); })
        .then(function (back) {
          var ok = back && back.n === 1 && back.s === 'əçğışöü' && back.d.length === 3;
          return self.remove(k, { silent: true }).then(function () {
            return self.get(k, '__yox__', { fresh: true });
          }).then(function (after) {
            return {
              ok: ok && after === '__yox__',
              write: true,
              read: ok,
              del: after === '__yox__',
              backend: state.backendId
            };
          });
        })
        .catch(function (e) {
          return { ok: false, error: (e && e.message) || String(e), backend: state.backendId };
        });
    },

    // Xam giriş — yalnız diaqnostika üçün
    _internals: function () { return state; },
    Error: StorageError,
    LocalBackend: LocalBackend,
    MemoryBackend: MemoryBackend
  };

  global.StorageAdapter = StorageAdapter;

  // Skript yüklənən kimi hazırlıq başlasın — app.js yenə də await edəcək,
  // amma bu erkən start açılışdan bir neçə ms qazandırır.
  try { StorageAdapter.initialize(); } catch (e) {}

})(window);
