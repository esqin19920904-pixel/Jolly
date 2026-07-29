/* ==========================================================================
   JOLLY vNext — jolly-idb-backend.js          v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   localStorage-dan IndexedDB-yə HİSSƏ-HİSSƏ köçürmə.

   ⚠️ ƏSAS TƏHLÜKƏ — açıq deyim:
   Köhnə kod (db.js və s.) məlumatı BİRBAŞA və SİNXRON oxuyur:
   `localStorage.getItem('jolly_...')`. IndexedDB isə ASİNXRONDUR.
   Bir açarı sadəcə köçürüb localStorage-dan silsək, köhnə kod həmin
   açarı oxuyanda `null` alar — və məlumat "yox olub" kimi görünər.
   Bu, itki deyil, amma proqramı boş kataloqla açar. Buna yol vermirik.

   ONA GÖRƏ KÖÇÜRMƏ İKİ MƏRHƏLƏLİDİR:

   MƏRHƏLƏ A — güzgüləmə (RİSKSİZ)
     Açar HƏM localStorage-da qalır, HƏM IndexedDB-yə yazılır.
     Yer qazanılmır, amma boru xətti sınaqdan keçir və hər açılışda
     ölçülür: "bu açarı kimsə erkən (preload bitməmiş) oxuyurmu?"

   MƏRHƏLƏ B — boşaltma (yalnız sübutdan sonra)
     Bir açar ÜÇ təmiz açılış boyunca erkən oxunmayıbsa, o zaman
     localStorage nüsxəsi silinir. Oxular RAM güzgüsündən verilir
     (`getItem` sarğısı). İlk problemdə açar avtomatik geri qaytarılır.

   Yəni: heç bir açar sən "olar" deməmiş və proqram özü üç dəfə sübut
   etməmiş localStorage-dan silinmir.

   Yükləmə yeri: memory-mirror.js-dən sonra, db.js-dən ƏVVƏL.
   ========================================================================== */

(function (global) {
  'use strict';

  var DB_NAME = 'jolly_kv';
  var DB_VER  = 1;
  var STORE   = 'kv';
  var K_STATE = '__jolly_idb_state__';     // "__jolly_" → körpü tutmur
  var CLEAN_BOOTS_REQUIRED = 3;

  /* ----------------------------------------------------------------------
     0. Vəziyyət
     ---------------------------------------------------------------------- */
  var state = {
    supported: !!global.indexedDB,
    db: null,
    opening: null,
    ram: {},              // boşaldılmış açarların RAM nüsxəsi
    preloaded: false,
    keys: {},             // key -> {mirrored, verified, offloaded, cleanBoots, earlyReads, bytes, at}
    earlyThisBoot: {},    // bu açılışda preload-dan əvvəl oxunanlar
    nativeGet: null,
    stats: { reads: 0, ramHits: 0, misses: 0, mirrored: 0, offloaded: 0, restored: 0, errors: 0 },
    lastError: null
  };

  function rawGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { global.localStorage.removeItem(k); } catch (e) {} }

  function loadState() {
    var raw = rawGet(K_STATE);
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      state.keys = (o && o.keys) || {};
    } catch (e) {}
  }
  function saveState() {
    rawSet(K_STATE, JSON.stringify({ at: Date.now(), keys: state.keys }));
  }

  function rec(key) {
    if (!state.keys[key]) {
      state.keys[key] = { mirrored: false, verified: false, offloaded: false,
                          cleanBoots: 0, earlyReads: 0, bytes: 0, at: 0 };
    }
    return state.keys[key];
  }

  function hash(str) {
    if (str === null || str === undefined) return 'null';
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16) + ':' + str.length;
  }

  function toast(msg, kind) {
    try {
      if (global.Toast) {
        if (kind === 'error' && global.Toast.error) return global.Toast.error(msg);
        if (global.Toast.info) return global.Toast.info(msg);
      }
    } catch (e) {}
    console.log('[IDB] ' + msg);
  }

  /* ----------------------------------------------------------------------
     1. IndexedDB
     ---------------------------------------------------------------------- */
  function open() {
    if (state.db) return Promise.resolve(state.db);
    if (state.opening) return state.opening;
    if (!state.supported) return Promise.reject(new Error('IndexedDB dəstəklənmir'));

    state.opening = new Promise(function (res, rej) {
      var req;
      try { req = global.indexedDB.open(DB_NAME, DB_VER); }
      catch (e) { return rej(e); }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'k' });
      };
      req.onsuccess = function () { state.db = req.result; res(state.db); };
      req.onerror = function () { rej(req.error || new Error('IndexedDB açılmadı')); };
    });
    return state.opening;
  }

  function tx(mode) {
    return open().then(function (db) {
      return db.transaction(STORE, mode).objectStore(STORE);
    });
  }

  function idbGet(key) {
    return tx('readonly').then(function (st) {
      return new Promise(function (res, rej) {
        var r = st.get(key);
        r.onsuccess = function () { res(r.result ? r.result.v : null); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }

  function idbSet(key, val) {
    return tx('readwrite').then(function (st) {
      return new Promise(function (res, rej) {
        var r = st.put({ k: key, v: val, at: Date.now() });
        r.onsuccess = function () { res(true); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }

  function idbDel(key) {
    return tx('readwrite').then(function (st) {
      return new Promise(function (res, rej) {
        var r = st.delete(key);
        r.onsuccess = function () { res(true); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }

  function idbKeys() {
    return tx('readonly').then(function (st) {
      return new Promise(function (res, rej) {
        var r = st.getAllKeys ? st.getAllKeys() : null;
        if (!r) return res([]);
        r.onsuccess = function () { res(r.result || []); };
        r.onerror = function () { rej(r.error); };
      });
    }).catch(function () { return []; });
  }

  /* ----------------------------------------------------------------------
     2. StorageAdapter üçün backend interfeysi
        StorageAdapter.route('<açar>', JollyIDB.backend) ilə qoşulur
     ---------------------------------------------------------------------- */
  var backend = {
    id: 'idb',
    label: 'IndexedDB',
    available: function () { return state.supported; },
    getRaw: function (key) {
      if (key in state.ram) return Promise.resolve(state.ram[key]);
      return idbGet(key).then(function (v) { if (v !== null) state.ram[key] = v; return v; });
    },
    setRaw: function (key, str) {
      state.ram[key] = str;
      return idbSet(key, str);
    },
    delRaw: function (key) { delete state.ram[key]; return idbDel(key); },
    listKeys: idbKeys,
    bytes: function () {
      var t = 0;
      for (var k in state.ram) t += (k.length + String(state.ram[k]).length) * 2;
      return Promise.resolve(t);
    }
  };

  /* ----------------------------------------------------------------------
     3. getItem sarğısı — boşaldılmış açarları RAM-dan verir
     ---------------------------------------------------------------------- */
  function installShim() {
    if (state.nativeGet) return true;
    var ls;
    try { ls = global.localStorage; } catch (e) { return false; }
    state.nativeGet = ls.getItem.bind(ls);

    ls.getItem = function (key) {
      var r = state.keys[key];
      if (!r || (!r.offloaded && !r.mirrored)) return state.nativeGet(key);

      state.stats.reads++;

      // Preload bitməyibsə bunu qeyd edirik — bu açar boşaldıla bilməz
      if (!state.preloaded) {
        state.earlyThisBoot[key] = (state.earlyThisBoot[key] || 0) + 1;
      }

      if (r.offloaded) {
        if (key in state.ram) { state.stats.ramHits++; return state.ram[key]; }
        // RAM-da yoxdur — bu olmamalıdır. Təcili geri qaytarma başlat.
        state.stats.misses++;
        state.lastError = { key: key, at: Date.now(), msg: 'boşaldılmış açar RAM-da tapılmadı' };
        console.error('[IDB] ⚠️ "' + key + '" RAM-da yoxdur — geri qaytarılır');
        setTimeout(function () { JollyIDB.restoreLocal(key); }, 0);
        return null;
      }

      return state.nativeGet(key);   // güzgü mərhələsi: əsl nüsxə hələ yerindədir
    };
    return true;
  }

  /* ----------------------------------------------------------------------
     4. Preload — boşaldılmış açarları RAM-a çək
     ---------------------------------------------------------------------- */
  function preload() {
    var need = Object.keys(state.keys).filter(function (k) { return state.keys[k].offloaded; });
    if (!need.length) { state.preloaded = true; return Promise.resolve({ loaded: 0 }); }

    return Promise.all(need.map(function (k) {
      return idbGet(k).then(function (v) {
        if (v !== null) state.ram[k] = v;
        else console.error('[IDB] "' + k + '" IndexedDB-də tapılmadı!');
      }).catch(function () {});
    })).then(function () {
      state.preloaded = true;
      return { loaded: Object.keys(state.ram).length };
    });
  }

  /* ----------------------------------------------------------------------
     5. Mərhələ A — güzgüləmə
     ---------------------------------------------------------------------- */
  function mirrorKey(key) {
    var raw = state.nativeGet ? state.nativeGet(key) : rawGet(key);
    if (raw === null) return Promise.resolve({ key: key, ok: false, reason: 'açar yoxdur' });

    return idbSet(key, raw).then(function () {
      return idbGet(key);
    }).then(function (back) {
      var ok = hash(back) === hash(raw);
      var r = rec(key);
      r.mirrored = true;
      r.verified = ok;
      r.bytes = (key.length + raw.length) * 2;
      r.at = Date.now();
      saveState();
      state.stats.mirrored++;
      return { key: key, ok: ok, kb: +(r.bytes / 1024).toFixed(1) };
    }).catch(function (e) {
      state.stats.errors++;
      return { key: key, ok: false, reason: (e && e.message) || String(e) };
    });
  }

  /* ----------------------------------------------------------------------
     6. Mərhələ B — boşaltma / geri qaytarma
     ---------------------------------------------------------------------- */
  function eligible(key) {
    var r = state.keys[key];
    if (!r) return { ok: false, why: 'izlənmir' };
    if (!r.mirrored || !r.verified) return { ok: false, why: 'güzgülənməyib və ya yoxlamadan keçməyib' };
    if (r.offloaded) return { ok: false, why: 'onsuz da boşaldılıb' };
    if (r.earlyReads > 0) return { ok: false, why: r.earlyReads + ' dəfə erkən oxunub — köhnə kod ona sinxron baxır' };
    if (r.cleanBoots < CLEAN_BOOTS_REQUIRED)
      return { ok: false, why: r.cleanBoots + '/' + CLEAN_BOOTS_REQUIRED + ' təmiz açılış' };
    return { ok: true };
  }

  function offload(key, force) {
    var e = eligible(key);
    if (!e.ok && !force) return Promise.resolve({ key: key, ok: false, reason: e.why });

    var raw = state.nativeGet ? state.nativeGet(key) : rawGet(key);
    if (raw === null) return Promise.resolve({ key: key, ok: false, reason: 'açar yoxdur' });

    // Surət çıxar (geri qaytarma imkanı üçün)
    try { if (global.JollyCloudBridge) global.JollyCloudBridge.snapshot('IDB boşaltma: ' + key); } catch (e2) {}

    return idbSet(key, raw).then(function () { return idbGet(key); }).then(function (back) {
      if (hash(back) !== hash(raw)) throw new Error('yoxlama uyğun gəlmədi');
      state.ram[key] = raw;
      rawDel(key);
      var r = rec(key);
      r.offloaded = true;
      r.at = Date.now();
      saveState();
      state.stats.offloaded++;
      try { if (global.StorageAdapter) { global.StorageAdapter.route(key, backend); global.StorageAdapter.invalidate(key); } } catch (e3) {}
      return { key: key, ok: true, freedKb: +(r.bytes / 1024).toFixed(1) };
    }).catch(function (err) {
      state.stats.errors++;
      return { key: key, ok: false, reason: (err && err.message) || String(err) };
    });
  }

  function restoreLocal(key) {
    var r = state.keys[key];
    var val = (key in state.ram) ? state.ram[key] : null;
    var p = (val !== null) ? Promise.resolve(val) : idbGet(key);

    return p.then(function (v) {
      if (v === null) { toast('"' + key + '" bərpa edilə bilmədi — IndexedDB-də yoxdur', 'error'); return false; }
      var ok = rawSet(key, v);
      if (!ok) { toast('"' + key + '" geri yazılmadı — localStorage doludur', 'error'); return false; }
      if (r) { r.offloaded = false; r.cleanBoots = 0; saveState(); }
      try { if (global.StorageAdapter) { global.StorageAdapter.route(key, null); global.StorageAdapter.invalidate(key); } } catch (e) {}
      state.stats.restored++;
      console.log('[IDB] "' + key + '" localStorage-a geri qaytarıldı');
      return true;
    });
  }

  /* ----------------------------------------------------------------------
     7. Namizədlər və açılış qeydiyyatı
     ---------------------------------------------------------------------- */
  function candidates(minKb) {
    minKb = minKb || 100;
    var out = [];
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (!k || k.indexOf('__jolly_') === 0 || k.indexOf('jolly_journal') === 0) continue;
        var v = (state.nativeGet ? state.nativeGet(k) : rawGet(k)) || '';
        var kb = ((k.length + v.length) * 2) / 1024;
        if (kb < minKb) continue;
        var r = state.keys[k];
        out.push({
          key: k, kb: +kb.toFixed(1),
          cls: (global.MemoryMirror ? global.MemoryMirror.classOf(k) : '?'),
          mirrored: !!(r && r.mirrored), offloaded: !!(r && r.offloaded),
          cleanBoots: r ? r.cleanBoots : 0, earlyReads: r ? r.earlyReads : 0,
          eligible: eligible(k)
        });
      }
    } catch (e) {}
    return out.sort(function (a, b) { return b.kb - a.kb; });
  }

  // Açılış sonunda: bu açılışda erkən oxunmayan güzgülənmiş açarlara +1 təmiz açılış
  function closeBoot() {
    Object.keys(state.keys).forEach(function (k) {
      var r = state.keys[k];
      if (!r.mirrored || r.offloaded) return;
      var early = state.earlyThisBoot[k] || 0;
      if (early > 0) { r.earlyReads += early; r.cleanBoots = 0; }
      else r.cleanBoots++;
    });
    saveState();
  }

  /* ----------------------------------------------------------------------
     8. API
     ---------------------------------------------------------------------- */
  var JollyIDB = {
    version: '1.0.0',
    backend: backend,

    initialize: function () {
      loadState();
      installShim();
      if (!state.supported) {
        console.warn('[IDB] IndexedDB dəstəklənmir — köçürmə mümkün deyil');
        state.preloaded = true;
        return Promise.resolve({ supported: false });
      }
      return preload().then(function (p) {
        // açılışın sonunu gözlə, sonra təmiz açılış sayğaclarını yenilə
        var done = function () { setTimeout(closeBoot, 3000); };
        if (document.readyState === 'complete') done();
        else global.addEventListener('load', done, { once: true });
        return { supported: true, preloaded: p.loaded, tracked: Object.keys(state.keys).length };
      }).catch(function (e) {
        state.preloaded = true;
        state.lastError = { at: Date.now(), msg: (e && e.message) || String(e) };
        return { supported: true, error: state.lastError.msg };
      });
    },

    candidates: candidates,
    status: function () {
      return Object.keys(state.keys).map(function (k) {
        var r = state.keys[k];
        return { key: k, kb: +(r.bytes / 1024).toFixed(1), mirrored: r.mirrored,
                 verified: r.verified, offloaded: r.offloaded,
                 cleanBoots: r.cleanBoots, earlyReads: r.earlyReads,
                 eligible: eligible(k) };
      }).sort(function (a, b) { return b.kb - a.kb; });
    },

    // Mərhələ A — risksiz
    mirror: function (keys) {
      if (typeof keys === 'string') keys = [keys];
      if (!keys) keys = candidates(100).map(function (c) { return c.key; });
      return keys.reduce(function (chain, k) {
        return chain.then(function (acc) {
          return mirrorKey(k).then(function (r) { acc.push(r); return acc; });
        });
      }, Promise.resolve([])).then(function (res) {
        var ok = res.filter(function (r) { return r.ok; }).length;
        toast(ok + '/' + res.length + ' açar IndexedDB-yə güzgüləndi (localStorage nüsxəsi yerindədir)');
        return res;
      });
    },

    // Mərhələ B — yalnız sübutdan sonra
    offload: offload,
    offloadEligible: function () {
      var list = Object.keys(state.keys).filter(function (k) { return eligible(k).ok; });
      if (!list.length) { toast('Hazırda boşaldıla bilən açar yoxdur'); return Promise.resolve([]); }
      return list.reduce(function (chain, k) {
        return chain.then(function (acc) { return offload(k).then(function (r) { acc.push(r); return acc; }); });
      }, Promise.resolve([])).then(function (res) {
        var freed = res.reduce(function (s, r) { return s + (r.freedKb || 0); }, 0);
        toast('~' + freed.toFixed(0) + ' KB localStorage boşaldıldı');
        return res;
      });
    },
    restoreLocal: restoreLocal,
    restoreAll: function () {
      var list = Object.keys(state.keys).filter(function (k) { return state.keys[k].offloaded; });
      return list.reduce(function (chain, k) {
        return chain.then(function () { return restoreLocal(k); });
      }, Promise.resolve()).then(function () { return list.length; });
    },

    /* ---- Sağlamlıq ---- */
    health: function () {
      var problems = [];
      var st = this.status();
      var offloaded = st.filter(function (s) { return s.offloaded; });
      if (!state.supported) problems.push('IndexedDB dəstəklənmir');
      if (state.stats.misses > 0) problems.push(state.stats.misses + ' dəfə boşaldılmış açar RAM-da tapılmadı');
      if (state.lastError) problems.push('Son xəta: ' + state.lastError.msg);
      var risky = st.filter(function (s) { return s.mirrored && s.earlyReads > 0; });

      return Promise.resolve({
        ok: problems.length === 0,
        problems: problems,
        supported: state.supported,
        preloaded: state.preloaded,
        tracked: st.length,
        mirrored: st.filter(function (s) { return s.mirrored; }).length,
        offloaded: offloaded.length,
        freedKb: +offloaded.reduce(function (s, r) { return s + r.kb; }, 0).toFixed(1),
        earlyReadKeys: risky.map(function (r) { return { key: r.key, reads: r.earlyReads }; }),
        candidates: candidates(100).slice(0, 8),
        stats: JSON.parse(JSON.stringify(state.stats))
      });
    },

    /* ---- Özünü yoxlama ---- */
    selfTest: function () {
      var k = 'jolly_idb_probe';
      var out = { ok: false, write: false, read: false, verify: false, shim: !!state.nativeGet };
      var payload = JSON.stringify({ a: 1, s: 'əçğışöü', t: Date.now() });
      return Promise.resolve()
        .then(function () { rawSet(k, payload); return mirrorKey(k); })
        .then(function (r) { out.write = r.ok; return idbGet(k); })
        .then(function (v) {
          out.read = v === payload;
          out.verify = hash(v) === hash(payload);
          return idbDel(k);
        })
        .then(function () {
          rawDel(k);
          delete state.keys[k];
          saveState();
          out.ok = out.write && out.read && out.verify && out.shim;
          return out;
        })
        .catch(function (e) { out.error = (e && e.message) || String(e); return out; });
    },

    _internals: function () { return state; }
  };

  global.JollyIDB = JollyIDB;

  // Sarğı DƏRHAL — db.js-in ilk oxusundan əvvəl yerində olmalıdır
  try { loadState(); installShim(); } catch (e) {}
  JollyIDB.initialize();

})(window);
