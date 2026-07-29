/* ==========================================================================
   JOLLY vNext — operation-journal.js          v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   Qat sırası:  UI → Modules → Engines → StorageAdapter → [OperationJournal]
                → Storage (localStorage / IndexedDB / Cloud)

   NİYƏ "Transaction" YOX, "Journal"?
   Brauzerdə localStorage və IndexedDB arasında əsl ACID mümkün deyil.
   Ona görə biz NİYYƏT JURNALI saxlayırıq:

        BEGIN → niyyəti yaz → icra et → yoxla → tamamla → niyyəti sil

   Əgər telefon ortada sönsə, brauzer öldürsə və ya yazma yarımçıq qalsa —
   açılışda yarımçıq niyyət qalır və recover() onu ya geri qaytarır
   (rollback), ya da tamamlayır. Məlumat yarı-yazılmış qalmır.

   RESURSİYA XƏBƏRDARLIĞI: bu fayl ÖZ qeydlərini birbaşa localStorage-a
   yazır — StorageAdapter-dən keçmir. Əks halda hər jurnal yazısı yeni
   jurnal yazısı yaradardı (sonsuz döngə).

   Yükləmə yeri: index.html-də storage-adapter.js-dən DƏRHAL SONRA,
   db.js-dən ƏVVƏL. (index.html-də artıq oturub.)
   ========================================================================== */

(function (global) {
  'use strict';

  /* ----------------------------------------------------------------------
     0. Sabitlər
     ---------------------------------------------------------------------- */
  var K_OPEN   = 'jolly_journal_open';    // açıq (yarımçıq) əməliyyatlar
  var K_RECENT = 'jolly_journal_recent';  // son tamamlananlar (diaqnostika)
  var K_REPAIR = 'jolly_journal_repairs'; // bərpa hesabatları

  var MAX_SNAPSHOT = 128 * 1024;  // 128 KB-dan böyük dəyərin surəti saxlanmır
  var MAX_RECENT   = 30;          // son N əməliyyat yadda qalır
  var MAX_REPAIRS  = 20;

  // Bu açarlar avtomatik jurnala düşür (adında bu sözlərdən biri varsa)
  var WATCH = ['product', 'user', 'perm', 'group', 'qrup', 'setting', 'ayar',
               'supplier', 'tedaruk', 'location', 'yer', 'status', 'firma',
               'company', 'brand', 'tombstone', 'changelog', 'receiving',
               'qebul', 'task', 'tapsiriq', 'barcode', 'barkod'];

  // Bunlar HEÇ VAXT jurnala düşmür (skip watch-dan üstündür)
  var SKIP  = ['journal', 'blackbox', 'log', 'jurnal', 'cache', 'kes',
               'thumb', 'img', 'image', 'sekil', 'photo', 'session', 'sess',
               'heartbeat', 'online', 'draft_auto', 'temp', 'tmp', 'probe',
               'jolly_fb_auth', 'backup'];

  /* ----------------------------------------------------------------------
     1. Xam localStorage (StorageAdapter-dən KEÇMİR)
     ---------------------------------------------------------------------- */
  function rawGet(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function rawSet(key, str) {
    try { global.localStorage.setItem(key, str); return true; }
    catch (e) { return false; }
  }
  function rawDel(key) {
    try { global.localStorage.removeItem(key); return true; } catch (e) { return false; }
  }
  function readJSON(key, fallback) {
    var raw = rawGet(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }
  function writeJSON(key, obj) {
    var ok;
    try { ok = rawSet(key, JSON.stringify(obj)); }
    catch (e) { ok = false; }
    if (!ok) state.degraded = true;
    return ok;
  }

  // FNV-1a — yoxlama üçün yüngül barmaq izi (backup checksum ilə eyni üsul)
  function hash(str) {
    if (str === null || str === undefined) return 'null';
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16) + ':' + str.length;
  }

  function newId() {
    return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function whoAmI() {
    try {
      var s = global.sessionStorage.getItem('jolly_sec_session');
      if (s) { var o = JSON.parse(s); return (o && (o.name || o.userId)) || 'bilinməyən'; }
    } catch (e) {}
    return 'bilinməyən';
  }

  /* ----------------------------------------------------------------------
     2. Vəziyyət
     ---------------------------------------------------------------------- */
  var state = {
    enabled: true,
    attached: false,
    ready: false,
    degraded: false,       // jurnalın özü yazıla bilmirsə (yaddaş dolu)
    active: null,          // hazırda açıq transaction (tx obyekti)
    lastRecovery: null,
    watch: WATCH.slice(),
    skip: SKIP.slice(),
    stats: { logged: 0, committed: 0, rolledBack: 0, recovered: 0, skipped: 0, failures: 0 }
  };

  /* ----------------------------------------------------------------------
     3. Açıq əməliyyatlar üzərində əməliyyatlar
     ---------------------------------------------------------------------- */
  function loadOpen()      { return readJSON(K_OPEN, {}) || {}; }
  function saveOpen(map)   { return writeJSON(K_OPEN, map); }

  function putEntry(entry) {
    var map = loadOpen();
    map[entry.id] = entry;
    return saveOpen(map);
  }
  function dropEntry(id) {
    var map = loadOpen();
    if (!map[id]) return true;
    delete map[id];
    return saveOpen(map);
  }

  function pushRecent(entry, outcome) {
    var list = readJSON(K_RECENT, []) || [];
    list.unshift({
      id: entry.id,
      name: entry.name,
      at: entry.at,
      endedAt: Date.now(),
      ms: Date.now() - entry.at,
      outcome: outcome,                    // commit | rollback | repair
      user: entry.user,
      keys: (entry.ops || []).map(function (o) { return o.type[0] + ':' + o.key; })
    });
    if (list.length > MAX_RECENT) list.length = MAX_RECENT;
    writeJSON(K_RECENT, list);
  }

  function pushRepair(report) {
    var list = readJSON(K_REPAIR, []) || [];
    list.unshift(report);
    if (list.length > MAX_REPAIRS) list.length = MAX_REPAIRS;
    writeJSON(K_REPAIR, list);
  }

  function snapshot(raw) {
    if (raw === null || raw === undefined) return { v: null, rollbackable: true };
    if (raw.length > MAX_SNAPSHOT) {
      return { v: null, rollbackable: false, tooBig: true, bytes: raw.length, h: hash(raw) };
    }
    return { v: raw, rollbackable: true, h: hash(raw) };
  }

  function shouldJournal(key) {
    if (!key) return false;
    var k = String(key).toLowerCase();
    for (var i = 0; i < state.skip.length; i++) if (k.indexOf(state.skip[i]) !== -1) return false;
    for (var j = 0; j < state.watch.length; j++) if (k.indexOf(state.watch[j]) !== -1) return true;
    return false;
  }

  /* ----------------------------------------------------------------------
     4. Bərpa (recover) — açılışda çağırılır
     ---------------------------------------------------------------------- */
  function applyRollback(op) {
    // Geri qaytarma: əvvəlki dəyəri yerinə qoy
    if (!op.prev || op.prev.rollbackable === false) return false;
    var ok;
    if (op.prev.v === null) ok = rawDel(op.key);
    else ok = rawSet(op.key, op.prev.v);
    if (ok) {
      try {
        if (global.StorageAdapter) global.StorageAdapter.invalidate(op.key);
        global.dispatchEvent(new CustomEvent('storage.changed', {
          detail: { key: op.key, value: null, action: 'rollback', source: 'journal' }
        }));
      } catch (e) {}
    }
    return ok;
  }

  function verifyOp(op) {
    var cur = rawGet(op.key);
    if (op.type === 'remove') return cur === null;
    if (!op.next) return true;
    if (op.next.h) return hash(cur) === op.next.h;
    return cur !== null;
  }

  function recoverEntry(entry) {
    var res = { id: entry.id, name: entry.name, at: entry.at, user: entry.user,
                status: entry.status, action: null, ops: [], ok: true };
    var ops = entry.ops || [];

    // Bütün addımlar icra olunub və yoxlanışdan keçirsə — sadəcə bağla
    var allDone = ops.length > 0 && ops.every(function (o) { return o.done; });
    var allVerified = allDone && ops.every(function (o) { return verifyOp(o); });

    if (allVerified) {
      res.action = 'tamamlandı';
      ops.forEach(function (o) { res.ops.push({ key: o.key, result: 'ok' }); });
      dropEntry(entry.id);
      pushRecent(entry, 'repair');
      return res;
    }

    // Yarımçıqdır → icra olunmuş addımları TƏRS sıra ilə geri qaytar
    res.action = 'geri qaytarıldı';
    for (var i = ops.length - 1; i >= 0; i--) {
      var op = ops[i];
      if (!op.done) { res.ops.push({ key: op.key, result: 'icra olunmayıb' }); continue; }
      if (op.prev && op.prev.rollbackable === false) {
        res.ops.push({ key: op.key, result: 'surət çox böyük — geri qaytarılmadı' });
        res.ok = false;
        continue;
      }
      res.ops.push({ key: op.key, result: applyRollback(op) ? 'geri qaytarıldı' : 'ALINMADI' });
      if (res.ops[res.ops.length - 1].result === 'ALINMADI') res.ok = false;
    }
    dropEntry(entry.id);
    pushRecent(entry, 'rollback');
    return res;
  }

  /* ----------------------------------------------------------------------
     5. Transaction obyekti
     ---------------------------------------------------------------------- */
  function Transaction(name, opts) {
    this.id = newId();
    this.name = name || 'əməliyyat';
    this.at = Date.now();
    this.user = whoAmI();
    this.status = 'open';
    this.ops = [];
    this.opts = opts || {};
    this._closed = false;
  }

  Transaction.prototype._entry = function () {
    return { id: this.id, name: this.name, at: this.at, user: this.user,
             status: this.status, ops: this.ops };
  };

  Transaction.prototype._save = function () { return putEntry(this._entry()); };

  // Niyyəti qeyd et — İCRADAN ƏVVƏL
  Transaction.prototype.declare = function (type, key, nextRaw) {
    var op = {
      type: type,                       // put | remove
      key: key,
      prev: snapshot(rawGet(key)),
      next: type === 'remove' ? null : snapshot(nextRaw),
      done: false,
      at: Date.now()
    };
    this.ops.push(op);
    this.status = 'executing';
    this._save();
    state.stats.logged++;
    return op;
  };

  Transaction.prototype.markDone = function (op) {
    op.done = true;
    op.doneAt = Date.now();
    this._save();
  };

  // Transaction daxilində yazma — StorageAdapter-dən keçir, jurnal avtomatik
  Transaction.prototype.put = function (key, value, options) {
    var self = this;
    if (!global.StorageAdapter) return Promise.reject(new Error('StorageAdapter yoxdur'));
    self._claim = key;
    return global.StorageAdapter.put(key, value, options).then(function (r) {
      self._claim = null; return r;
    }, function (e) { self._claim = null; throw e; });
  };

  Transaction.prototype.remove = function (key, options) {
    var self = this;
    if (!global.StorageAdapter) return Promise.reject(new Error('StorageAdapter yoxdur'));
    self._claim = key;
    return global.StorageAdapter.remove(key, options).then(function (r) {
      self._claim = null; return r;
    }, function (e) { self._claim = null; throw e; });
  };

  Transaction.prototype.get = function (key, fallback) {
    if (!global.StorageAdapter) return Promise.resolve(fallback);
    return global.StorageAdapter.get(key, fallback, { fresh: true });
  };

  // Yoxla və bağla
  Transaction.prototype.commit = function () {
    if (this._closed) return Promise.resolve({ ok: true, already: true });
    this._closed = true;
    this.status = 'verifying';
    this._save();

    var bad = [];
    for (var i = 0; i < this.ops.length; i++) {
      if (!this.ops[i].done) { bad.push(this.ops[i].key + ' (icra olunmayıb)'); continue; }
      if (!verifyOp(this.ops[i])) bad.push(this.ops[i].key + ' (yoxlama uğursuz)');
    }

    if (bad.length) {
      var self = this;
      return this.rollback('yoxlama uğursuz: ' + bad.join(', ')).then(function () {
        state.stats.failures++;
        if (state.active === self) state.active = null;
        return { ok: false, problems: bad };
      });
    }

    this.status = 'complete';
    dropEntry(this.id);
    pushRecent(this._entry(), 'commit');
    state.stats.committed++;
    if (state.active === this) state.active = null;
    return Promise.resolve({ ok: true, id: this.id, ops: this.ops.length });
  };

  Transaction.prototype.rollback = function (reason) {
    this._closed = true;
    this.status = 'rollback';
    this._save();
    var done = [];
    for (var i = this.ops.length - 1; i >= 0; i--) {
      var op = this.ops[i];
      if (!op.done) continue;
      done.push({ key: op.key, ok: applyRollback(op) });
    }
    dropEntry(this.id);
    pushRecent(this._entry(), 'rollback');
    state.stats.rolledBack++;
    if (state.active === this) state.active = null;
    if (reason) console.warn('[Journal] "' + this.name + '" geri qaytarıldı — ' + reason);
    return Promise.resolve({ ok: true, reason: reason || null, reverted: done });
  };

  /* ----------------------------------------------------------------------
     6. Middleware — StorageAdapter-ə qoşulur
     ---------------------------------------------------------------------- */
  var middleware = {
    name: 'journal',
    critical: false,   // jurnal yazıla bilməsə belə ƏSAS YAZMA DAYANMIR (degraded olur)
    needsPrev: false,  // öz surətimizi özümüz götürürük (xam, JSON-suz)

    before: function (op) {
      if (!state.enabled) return;
      var tx = state.active;

      // Açıq transaction varsa və bu yazma ona aiddirsə — ona bağla.
      // ⚠️ 07-29 audit: əvvəl HƏR yazma açıq transaction-a yapışırdı.
      // Yəni bulud bərpası gedərkən başqa modulun etdiyi əlaqəsiz yazma da
      // eyni əməliyyatın bir hissəsi sayılır və xəta olsa O DA geri
      // qaytarılırdı. İndi yalnız transaction-un öz yazması (tx.put/remove)
      // və ya onsuz da izlənən açarlar bağlanır.
      if (tx && !tx._closed && (tx._claim === op.key || shouldJournal(op.key))) {
        op._journalOp = tx.declare(op.type, op.key, op.type === 'remove' ? null : op.raw);
        op._journalTx = tx;
        return;
      }

      // Avtomatik (tək addımlı) jurnal — yalnız izlənən açarlar üçün
      if (!shouldJournal(op.key)) { state.stats.skipped++; return; }
      var auto = new Transaction('avto: ' + op.key, { auto: true });
      op._journalOp = auto.declare(op.type, op.key, op.type === 'remove' ? null : op.raw);
      op._journalTx = auto;
    },

    after: function (op) {
      var tx = op._journalTx;
      if (!tx) return;
      tx.markDone(op._journalOp);
      if (tx.opts && tx.opts.auto) {
        // Tək addım idi — dərhal yoxla və bağla
        if (verifyOp(op._journalOp)) {
          tx.status = 'complete';
          dropEntry(tx.id);
          state.stats.committed++;
        } else {
          tx.rollback('avto-yoxlama uğursuz: ' + op.key);
        }
      }
    },

    error: function (op, err) {
      var tx = op._journalTx;
      if (!tx) return;
      state.stats.failures++;
      if (tx.opts && tx.opts.auto) {
        // Yazma alınmadı — niyyəti təmizlə, əvvəlki dəyər onsuz da yerindədir
        if (op._journalOp && op._journalOp.done) applyRollback(op._journalOp);
        dropEntry(tx.id);
      }
      // Çoxaddımlı transaction-da qərarı run() verir — burada toxunmuruq
    }
  };

  /* ----------------------------------------------------------------------
     7. Açıq API
     ---------------------------------------------------------------------- */
  var OperationJournal = {

    version: '1.0.0',

    initialize: function () {
      if (state.ready) return Promise.resolve({ ready: true });
      this.attach();
      state.ready = true;
      return Promise.resolve({ ready: true, attached: state.attached });
    },

    attach: function () {
      if (state.attached) return this;
      if (!global.StorageAdapter || typeof global.StorageAdapter.use !== 'function') {
        console.warn('[Journal] StorageAdapter tapılmadı — jurnal passiv qaldı');
        return this;
      }
      global.StorageAdapter.use(middleware);
      state.attached = true;
      return this;
    },

    detach: function () {
      if (global.StorageAdapter && global.StorageAdapter.unuse) global.StorageAdapter.unuse('journal');
      state.attached = false;
      return this;
    },

    setEnabled: function (v) { state.enabled = !!v; return this; },
    isEnabled: function () { return state.enabled; },

    /* ---- 7a. Bərpa — app.js boot-da StorageAdapter.initialize()-dən sonra ---- */
    recover: function () {
      var self = this;
      return Promise.resolve().then(function () {
        self.initialize();
        var map = loadOpen();
        var ids = Object.keys(map);
        var report = { at: Date.now(), found: ids.length, repaired: 0, rolledBack: 0,
                       failed: 0, details: [] };

        ids.forEach(function (id) {
          var r;
          try { r = recoverEntry(map[id]); }
          catch (e) { r = { id: id, action: 'XƏTA', ok: false, error: String(e) }; }
          report.details.push(r);
          if (!r.ok) report.failed++;
          else if (r.action === 'tamamlandı') report.repaired++;
          else report.rolledBack++;
          state.stats.recovered++;
        });

        if (ids.length) {
          pushRepair(report);
          console.warn('[Journal] ' + ids.length + ' yarımçıq əməliyyat tapıldı və təmizləndi', report);
        }
        state.lastRecovery = report;
        state.ready = true;
        return report;
      });
    },

    /* ---- 7b. Çoxaddımlı əməliyyat ----
       await OperationJournal.run('məhsul silinməsi', async (tx) => {
         await tx.put('jolly_products', list);
         await tx.put('jolly_tombstones', tombs);
       });
       Hər hansı addım xəta versə — əvvəlki addımlar avtomatik geri qaytarılır.
    */
    run: function (name, fn, opts) {
      var tx = new Transaction(name, opts || {});
      if (state.active && !state.active._closed) {
        // İç-içə əməliyyat: eyni transaction-a qoşulur
        return Promise.resolve(fn(state.active)).then(function (r) { return { ok: true, nested: true, result: r }; });
      }
      state.active = tx;
      tx.status = 'open';
      tx._save();

      return Promise.resolve()
        .then(function () { return fn(tx); })
        .then(function (result) {
          return tx.commit().then(function (c) {
            return { ok: c.ok, id: tx.id, result: result, problems: c.problems || null };
          });
        })
        .catch(function (err) {
          return tx.rollback((err && err.message) || String(err)).then(function () {
            return { ok: false, id: tx.id, error: (err && err.message) || String(err) };
          });
        });
    },

    begin: function (name, opts) {
      var tx = new Transaction(name, opts || {});
      state.active = tx;
      tx._save();
      return tx;
    },

    active: function () { return state.active; },

    /* ---- 7c. Baxış / diaqnostika ---- */
    open: function () {
      var map = loadOpen(), out = [];
      Object.keys(map).forEach(function (id) {
        var e = map[id];
        out.push({ id: id, name: e.name, at: e.at, user: e.user, status: e.status,
                   ops: (e.ops || []).length, age: Date.now() - e.at });
      });
      return out.sort(function (a, b) { return a.at - b.at; });
    },

    recent: function (limit) {
      var list = readJSON(K_RECENT, []) || [];
      return limit ? list.slice(0, limit) : list;
    },

    repairs: function () { return readJSON(K_REPAIR, []) || []; },
    lastRecovery: function () { return state.lastRecovery; },
    stats: function () { return JSON.parse(JSON.stringify(state.stats)); },

    watchKey: function (word)   { if (word) state.watch.push(String(word).toLowerCase()); return this; },
    skipKey: function (word)    { if (word) state.skip.push(String(word).toLowerCase()); return this; },
    watchList: function ()      { return { watch: state.watch.slice(), skip: state.skip.slice() }; },
    willJournal: function (key) { return shouldJournal(key); },

    clear: function () {
      rawDel(K_OPEN); rawDel(K_RECENT); rawDel(K_REPAIR);
      state.degraded = false;
      return true;
    },

    /* ---- 7d. Sağlamlıq — jolly-selftest.js (HealthMonitor v2) oxuyacaq ---- */
    health: function () {
      var open = this.open();
      var stale = open.filter(function (o) { return o.age > 60000; });
      var problems = [];
      if (!state.attached) problems.push('Jurnal StorageAdapter-ə qoşulmayıb');
      if (!state.enabled)  problems.push('Jurnal söndürülüb');
      if (state.degraded)  problems.push('Jurnalın özü yazıla bilmir — yaddaş dolu ola bilər');
      if (stale.length)    problems.push(stale.length + ' əməliyyat 1 dəqiqədən çoxdur açıq qalıb');
      if (state.lastRecovery && state.lastRecovery.failed)
        problems.push('Son bərpada ' + state.lastRecovery.failed + ' əməliyyat düzəldilə bilmədi');

      var bytes = 0;
      [K_OPEN, K_RECENT, K_REPAIR].forEach(function (k) {
        var v = rawGet(k); if (v) bytes += (k.length + v.length) * 2;
      });

      return Promise.resolve({
        ok: problems.length === 0,
        problems: problems,
        attached: state.attached,
        enabled: state.enabled,
        degraded: state.degraded,
        openCount: open.length,
        openList: open,
        staleCount: stale.length,
        lastRecovery: state.lastRecovery,
        recentCount: this.recent().length,
        bytes: bytes,
        kb: +(bytes / 1024).toFixed(1),
        stats: this.stats()
      });
    },

    /* ---- 7e. Özünü yoxlama ---- */
    selfTest: function () {
      var self = this;
      var k1 = '__jolly_jrn_a__', k2 = '__jolly_jrn_b__';
      var out = { ok: false, commit: false, rollback: false, recover: false };

      // Bu açarlar izlənən siyahıda deyil — sınaq üçün müvəqqəti əlavə edirik
      state.watch.push('__jolly_jrn_');

      return Promise.resolve()
        // 1) uğurlu commit
        .then(function () {
          return self.run('test-commit', function (tx) {
            return tx.put(k1, { a: 1 }).then(function () { return tx.put(k2, { b: 2 }); });
          });
        })
        .then(function (r) { out.commit = !!(r && r.ok); })
        // 2) ortada xəta → geri qaytarma
        .then(function () {
          return self.run('test-rollback', function (tx) {
            return tx.put(k1, { a: 999 }).then(function () { throw new Error('qəsdən xəta'); });
          });
        })
        .then(function () {
          return global.StorageAdapter.get(k1, null, { fresh: true });
        })
        .then(function (v) { out.rollback = !!(v && v.a === 1); })   // köhnə dəyər qayıtmalıdır
        // 3) süni yarımçıq niyyət → recover onu təmizləməlidir
        .then(function () {
          var fake = new Transaction('test-recover');
          fake.declare('put', k2, JSON.stringify({ b: 777 }));
          rawSet(k2, JSON.stringify({ b: 777 }));
          fake.ops[0].done = true;
          fake._save();
          return self.recover();
        })
        .then(function (rep) {
          out.recover = rep.found >= 1;
          return global.StorageAdapter.get(k2, null, { fresh: true });
        })
        .then(function (v) { out.restoredB = v && v.b; })
        // təmizlik
        .then(function () {
          return Promise.all([
            global.StorageAdapter.remove(k1, { silent: true, soft: true }),
            global.StorageAdapter.remove(k2, { silent: true, soft: true })
          ]);
        })
        .then(function () {
          state.watch = state.watch.filter(function (w) { return w !== '__jolly_jrn_'; });
          out.ok = out.commit && out.rollback && out.recover;
          return out;
        })
        .catch(function (e) {
          state.watch = state.watch.filter(function (w) { return w !== '__jolly_jrn_'; });
          out.error = (e && e.message) || String(e);
          return out;
        });
    },

    _internals: function () { return state; },
    Transaction: Transaction
  };

  global.OperationJournal = OperationJournal;

  // StorageAdapter yüklənibsə dərhal qoşul (app.js yenə də recover() çağıracaq)
  try { OperationJournal.attach(); } catch (e) {}

})(window);
