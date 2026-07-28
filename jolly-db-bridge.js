/* ==========================================================================
   JOLLY vNext — jolly-db-bridge.js            v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   MƏQSƏD: db.js-i (və bütün köhnə kodu) yeni nüvə qatına bağlamaq —
           db.js-in BİR SƏTRİNƏ BELƏ toxunmadan.

   NİYƏ BELƏ?
   db.js minlərlə sətirdir və bütün proqram ondan asılıdır. Onu yenidən
   yazmaq = hər şeyi bir gecədə riskə atmaq. Əvəzinə eyni üsuldan istifadə
   edirik ki, jolly-perms-extra.js permission-engine.js-i düzəldəndə
   istifadə olunub: KƏNARDAN SARĞI.

   NƏ EDİR?
   1) localStorage.setItem / removeItem üzərinə sarğı qoyur. Beləliklə
      db.js-in HƏR köhnə yazması avtomatik olaraq:
         • OperationJournal-a niyyət kimi düşür (yalnız vacib açarlar)
         • StorageAdapter keşini təzələyir (köhnə dəyər ilişib qalmır)
         • `storage.changed` hadisəsi yayımlayır (cloud.js / MemoryMirror üçün)
      Köhnə kod bundan XƏBƏRSİZDİR — heç nə sınmır.
   2) Real açar adlarını tapır (jolly_* skan edir) və jurnalın izləmə
      siyahısını təxmini sözlərlə yox, ƏSL açar adları ilə doldurur.
   3) Yaddaş dolanda yer açan təmizləyicini StorageAdapter-ə qeydiyyatdan
      keçirir (arxiv/jurnal/log açarlarını kəsir).
   4) Yeni kod üçün təmiz giriş nöqtəsi verir: JDB.read / JDB.write / JDB.tx

   Yükləmə yeri: operation-journal.js-dən SONRA, db.js-dən ƏVVƏL.
   ========================================================================== */

(function (global) {
  'use strict';

  var SA = null, OJ = null;   // StorageAdapter, OperationJournal (gec bağlanır)

  /* ----------------------------------------------------------------------
     0. Vəziyyət
     ---------------------------------------------------------------------- */
  var state = {
    installed: false,
    intercept: true,
    depth: 0,                 // resursiya qoruyucusu
    native: null,             // {set, del, clear}
    keys: null,               // son skan nəticəsi
    stats: { intercepted: 0, journaled: 0, passthrough: 0, blocked: 0, reclaims: 0 },
    lastReclaim: null
  };

  // Bu açarlara HEÇ VAXT qarışmırıq (nüvənin öz qeydləri)
  var INTERNAL = ['jolly_journal', '__jolly_', 'jolly_adapter_'];

  // Yaddaş dolanda ilk kəsiləcəklər (dəyərli məlumat deyil)
  var VOLATILE = ['log', 'jurnal', 'history', 'tarixce', 'archive', 'arxiv',
                  'blackbox', 'diag', 'recent', 'cache', 'kes', 'stat',
                  'heartbeat', 'audit'];

  function isInternal(key) {
    var k = String(key || '');
    for (var i = 0; i < INTERNAL.length; i++) if (k.indexOf(INTERNAL[i]) === 0) return true;
    return false;
  }
  function isVolatile(key) {
    var k = String(key || '').toLowerCase();
    for (var i = 0; i < VOLATILE.length; i++) if (k.indexOf(VOLATILE[i]) !== -1) return true;
    return false;
  }

  function bind() {
    SA = global.StorageAdapter || null;
    OJ = global.OperationJournal || null;
    return !!SA;
  }

  function notifyChanged(key, action, source) {
    try { if (SA) SA.invalidate(key); } catch (e) {}
    try {
      if (global.JollyEvents && global.JollyEvents.emit) {
        global.JollyEvents.emit('storage.changed', { key: key, action: action, source: source });
      }
    } catch (e) {}
    try {
      global.dispatchEvent(new CustomEvent('storage.changed', {
        detail: { key: key, value: null, action: action, source: source }
      }));
    } catch (e) {}
  }

  /* ----------------------------------------------------------------------
     1. localStorage sarğısı
     ---------------------------------------------------------------------- */
  function install() {
    if (state.installed) return true;
    bind();
    var ls;
    try { ls = global.localStorage; } catch (e) { return false; }
    if (!ls) return false;

    state.native = {
      set: ls.setItem.bind(ls),
      del: ls.removeItem.bind(ls),
      clear: ls.clear.bind(ls)
    };

    ls.setItem = function (key, value) {
      // Resursiya, söndürülmüş rejim və nüvə açarları — birbaşa keç
      if (state.depth > 0 || !state.intercept || isInternal(key)) {
        state.stats.passthrough++;
        return state.native.set(key, value);
      }
      state.depth++;
      var tx = null, op = null;
      try {
        var str = String(value);
        if (OJ && OJ.isEnabled && OJ.isEnabled() && OJ.willJournal(key)) {
          try {
            tx = new OJ.Transaction('köhnə kod: ' + key, { auto: true });
            op = tx.declare('put', key, str);
            state.stats.journaled++;
          } catch (e) { tx = null; op = null; }
        }

        state.native.set(key, str);      // əsl yazma
        state.stats.intercepted++;

        if (tx && op) { try { tx.markDone(op); tx.commit(); } catch (e) {} }
        notifyChanged(key, 'put', 'legacy');
        return undefined;

      } catch (err) {
        // Yaddaş dolub və ya yazma alınmadı
        if (tx) { try { tx.rollback('köhnə yazma alınmadı: ' + key); } catch (e) {} }
        state.stats.blocked++;
        var quota = err && (err.name === 'QuotaExceededError' ||
                            err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                            err.code === 22 || err.code === 1014);
        if (quota) {
          // Yer aç və BİR dəfə təkrar cəhd et — köhnə kod bunu özü bacarmır
          try {
            reclaimSync();
            state.native.set(key, String(value));
            state.stats.intercepted++;
            notifyChanged(key, 'put', 'legacy-retry');
            return undefined;
          } catch (e2) { /* aşağıda atılacaq */ }
        }
        throw err;   // köhnə kodun öz try/catch-i işləsin
      } finally {
        state.depth--;
      }
    };

    ls.removeItem = function (key) {
      if (state.depth > 0 || !state.intercept || isInternal(key)) {
        state.stats.passthrough++;
        return state.native.del(key);
      }
      state.depth++;
      var tx = null, op = null;
      try {
        if (OJ && OJ.isEnabled && OJ.isEnabled() && OJ.willJournal(key)) {
          try {
            tx = new OJ.Transaction('köhnə silmə: ' + key, { auto: true });
            op = tx.declare('remove', key, null);
            state.stats.journaled++;
          } catch (e) { tx = null; op = null; }
        }
        state.native.del(key);
        state.stats.intercepted++;
        if (tx && op) { try { tx.markDone(op); tx.commit(); } catch (e) {} }
        notifyChanged(key, 'remove', 'legacy');
        return undefined;
      } finally {
        state.depth--;
      }
    };

    // clear() bütün məlumatı silir — buraxırıq, amma qeyd edirik
    ls.clear = function () {
      console.warn('[DB Bridge] localStorage.clear() çağırıldı — BÜTÜN yerli məlumat silinir!');
      try { if (SA) SA.invalidate(); } catch (e) {}
      return state.native.clear();
    };

    // StorageAdapter-in öz backend-i də bu sarğıdan keçməsin
    try {
      var LB = SA && SA.LocalBackend;
      if (LB && !LB.__bridged) {
        var oSet = LB.setRaw, oDel = LB.delRaw;
        LB.setRaw = function (k, s) { state.depth++; try { return oSet.call(LB, k, s); } finally { state.depth--; } };
        LB.delRaw = function (k)    { state.depth++; try { return oDel.call(LB, k); }    finally { state.depth--; } };
        LB.__bridged = true;
      }
    } catch (e) {}

    state.installed = true;
    return true;
  }

  function uninstall() {
    if (!state.installed || !state.native) return false;
    try {
      var ls = global.localStorage;
      ls.setItem = state.native.set;
      ls.removeItem = state.native.del;
      ls.clear = state.native.clear;
    } catch (e) { return false; }
    state.installed = false;
    return true;
  }

  /* ----------------------------------------------------------------------
     2. Açar kəşfiyyatı — real adları tapıb jurnala öyrətmək
     ---------------------------------------------------------------------- */
  function scanKeys() {
    var rows = [], total = 0;
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        var v = global.localStorage.getItem(k) || '';
        var bytes = (k.length + v.length) * 2;
        total += bytes;
        var kind = 'digər';
        if (isInternal(k)) kind = 'nüvə';
        else if (isVolatile(k)) kind = 'keçici';
        else if (v.length > 200000) kind = 'ağır';
        else if (k.indexOf('jolly_') === 0) kind = 'əsas';
        var count = null;
        if (v.charAt(0) === '[') { try { count = JSON.parse(v).length; } catch (e) {} }
        rows.push({ key: k, bytes: bytes, kb: +(bytes / 1024).toFixed(1), kind: kind, items: count });
      }
    } catch (e) {}
    rows.sort(function (a, b) { return b.bytes - a.bytes; });
    state.keys = { at: Date.now(), total: total, mb: +(total / 1048576).toFixed(2), rows: rows };
    return state.keys;
  }

  // Skan nəticəsinə görə jurnalın izləmə siyahısını REAL adlarla doldur
  function teachJournal() {
    if (!OJ) bind();
    if (!OJ || !OJ.watchKey) return { taught: 0 };
    var scan = state.keys || scanKeys();
    var taught = 0, skipped = 0;
    scan.rows.forEach(function (r) {
      if (r.kind === 'nüvə') return;
      if (r.kind === 'keçici' || r.kind === 'ağır') { OJ.skipKey(r.key); skipped++; return; }
      if (r.kind === 'əsas') {
        // Yalnız məqbul ölçülü əsas açarlar jurnala düşsün
        if (r.bytes <= 256 * 1024) { OJ.watchKey(r.key); taught++; }
        else { OJ.skipKey(r.key); skipped++; }
      }
    });
    return { taught: taught, skipped: skipped };
  }

  /* ----------------------------------------------------------------------
     3. Yaddaş təmizləyicisi (yer açan)
     ---------------------------------------------------------------------- */
  function reclaimSync(forKey) {
    var freed = 0;
    state.depth++;   // təmizlik özü jurnala düşməsin
    try {
      // 1) Layihənin öz təmizləyiciləri varsa — əvvəl onlar
      try { if (global.JollyDB && typeof global.JollyDB.trimArchive === 'function') global.JollyDB.trimArchive(); } catch (e) {}
      try { if (global.Cleanup && typeof global.Cleanup.run === 'function') global.Cleanup.run(); } catch (e) {}

      // 2) Keçici açarları yarıya kəs (massivdirsə), tam sil (deyilsə)
      var scan = scanKeys();
      for (var i = 0; i < scan.rows.length; i++) {
        var r = scan.rows[i];
        if (r.key === forKey || r.kind === 'nüvə' || !isVolatile(r.key)) continue;
        var raw = global.localStorage.getItem(r.key);
        if (!raw) continue;
        if (raw.charAt(0) === '[') {
          try {
            var arr = JSON.parse(raw);
            if (arr.length > 4) {
              var cut = arr.slice(0, Math.floor(arr.length / 2));
              state.native.set(r.key, JSON.stringify(cut));
              freed += r.bytes / 2;
              continue;
            }
          } catch (e) {}
        }
        if (r.bytes > 20 * 1024) { state.native.del(r.key); freed += r.bytes; }
        if (freed > 512 * 1024) break;   // 0.5 MB kifayətdir
      }
    } catch (e) {
    } finally {
      state.depth--;
    }
    state.stats.reclaims++;
    state.lastReclaim = { at: Date.now(), freedKb: +(freed / 1024).toFixed(1), forKey: forKey || null };
    if (freed) console.warn('[DB Bridge] Yaddaşda yer açıldı: ~' + state.lastReclaim.freedKb + ' KB');
    return freed;
  }

  /* ----------------------------------------------------------------------
     4. Yeni kod üçün təmiz giriş nöqtəsi
     ---------------------------------------------------------------------- */
  var JDB = {
    read: function (key, fallback) {
      if (!bind()) return Promise.resolve(fallback);
      return SA.get(key, fallback);
    },
    write: function (key, value) {
      if (!bind()) return Promise.reject(new Error('StorageAdapter yoxdur'));
      return SA.put(key, value);
    },
    drop: function (key) {
      if (!bind()) return Promise.reject(new Error('StorageAdapter yoxdur'));
      return SA.remove(key);
    },
    // Çoxaddımlı, geri qaytarıla bilən əməliyyat
    tx: function (name, fn) {
      if (!bind() || !OJ) return Promise.reject(new Error('OperationJournal yoxdur'));
      return OJ.run(name, fn);
    },
    // Köhnə sinxron kod üçün (yalnız köçid dövründə)
    readSync: function (key, fallback) {
      if (!bind()) return fallback;
      return SA.getSync(key, fallback);
    }
  };

  /* ----------------------------------------------------------------------
     5. Bridge API
     ---------------------------------------------------------------------- */
  var Bridge = {
    version: '1.0.0',

    initialize: function () {
      bind();
      var ok = install();
      var taught = teachJournal();
      try {
        if (SA && SA.onQuota) SA.onQuota(function (k) { return reclaimSync(k); }, 'db-bridge');
      } catch (e) {}
      return Promise.resolve({
        installed: ok,
        intercept: state.intercept,
        journalKeys: taught,
        storageMb: (state.keys && state.keys.mb) || null
      });
    },

    install: install,
    uninstall: uninstall,
    setIntercept: function (v) { state.intercept = !!v; return this; },
    isInstalled: function () { return state.installed; },

    scan: scanKeys,
    keys: function () { return state.keys || scanKeys(); },
    teachJournal: teachJournal,
    reclaim: function (forKey) { return Promise.resolve(reclaimSync(forKey)); },
    stats: function () { return JSON.parse(JSON.stringify(state.stats)); },

    /* ---- Sağlamlıq — jolly-selftest.js oxuyacaq ---- */
    health: function () {
      var scan = scanKeys();
      var problems = [];
      if (!state.installed) problems.push('Körpü quraşdırılmayıb — köhnə yazmalar jurnaldan kənardadır');
      if (!state.intercept) problems.push('Tutma söndürülüb');
      if (scan.total > 4.5 * 1024 * 1024) problems.push('Yerli yaddaş 4.5 MB-ı keçib');
      if (state.stats.blocked > 0) problems.push(state.stats.blocked + ' yazma bloklandı (yaddaş dolu?)');

      var heavy = scan.rows.filter(function (r) { return r.kind === 'ağır'; });
      if (heavy.length) problems.push(heavy.length + ' açar 200 KB-dan böyükdür — IndexedDB-yə köçürülməlidir');

      return Promise.resolve({
        ok: problems.length === 0,
        problems: problems,
        installed: state.installed,
        intercept: state.intercept,
        totalMb: scan.mb,
        keyCount: scan.rows.length,
        top: scan.rows.slice(0, 10),
        heavy: heavy.map(function (r) { return { key: r.key, kb: r.kb }; }),
        lastReclaim: state.lastReclaim,
        stats: this.stats()
      });
    },

    /* ---- Özünü yoxlama ---- */
    selfTest: function () {
      var k = '__jolly_bridge_test__';   // "__jolly_" nüvə prefiksidir → tutulmur
      var k2 = 'jolly_bridge_probe';     // adi açar → tutulmalıdır
      var out = { ok: false, installed: state.installed, intercept: false, event: false, passthrough: false };
      var got = null;
      var onEvt = function (e) { if (e.detail && e.detail.key === k2) got = e.detail; };

      try {
        global.addEventListener('storage.changed', onEvt);
        var before = state.stats.intercepted;

        global.localStorage.setItem(k2, 'salam');       // tutulmalıdır
        out.intercept = state.stats.intercepted > before;
        out.event = !!got;

        var beforeP = state.stats.passthrough;
        global.localStorage.setItem(k, '1');            // tutulmamalıdır
        out.passthrough = state.stats.passthrough > beforeP;

        global.localStorage.removeItem(k2);
        global.localStorage.removeItem(k);
        out.ok = out.installed && out.intercept && out.event && out.passthrough;
      } catch (e) {
        out.error = (e && e.message) || String(e);
      } finally {
        try { global.removeEventListener('storage.changed', onEvt); } catch (e) {}
      }
      return Promise.resolve(out);
    },

    _internals: function () { return state; }
  };

  global.JollyDBBridge = Bridge;
  global.JDB = JDB;

  // Sarğını DƏRHAL qur — db.js-in ilk yazması da tutulsun
  try { Bridge.install(); } catch (e) {}

})(window);
