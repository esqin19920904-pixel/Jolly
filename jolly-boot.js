/* ==========================================================================
   JOLLY vNext — jolly-boot.js                 v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   MƏQSƏD: təsdiqlənmiş açılış ardıcıllığını icra etmək —

     StorageAdapter.initialize()
        → OperationJournal.recover()
        → JollyDBBridge (açar kəşfiyyatı)
        → MemoryMirror.initialize()      (varsa)
        → HealthMonitor.check()          (varsa)
        → Modules.start() / UI.render()  ← bunu app.js özü edir, TOXUNMURUQ

   NİYƏ app.js-ə TOXUNMADIQ?
   Çünki app.js-də router, kilid ekranı və avtokilid var — orada bir səhv
   proqramı açılmaz edir. Bizə lazım olan yeganə şey İCRA SIRASIDIR, onu
   isə skript sırası ilə həll etmək olar: bu fayl db.js-dən ƏVVƏL yüklənir,
   deməli bərpa (recover) app.js işə başlamamışdan ƏVVƏL bitir.

   ⚠️ VACİB: bərpa yalnız sinxron localStorage əməliyyatlarından ibarətdir,
   ona görə defer skriptləri arasında tam yerinə düşür — app.js məlumatı
   oxuyanda o, artıq təmizlənmiş olur.

   Yükləmə yeri: jolly-db-bridge.js-dən SONRA, db.js-dən ƏVVƏL.
   ========================================================================== */

(function (global) {
  'use strict';

  var K_ATTEMPT = '__jolly_boot_attempts__';   // "__jolly_" prefiksi → körpü tutmur
  var K_REPORT  = '__jolly_boot_report__';
  var MAX_ATTEMPTS = 3;

  function rawGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { global.localStorage.removeItem(k); } catch (e) {} }

  var t0 = Date.now();

  var state = {
    startedAt: t0,
    phases: [],           // [{name, ok, ms, info, error}]
    done: false,
    completedAt: 0,
    attempts: 0,
    suspectLoop: false,   // dalbadal yarımçıq açılış → nəsə proqramı öldürür
    warnings: [],
    resolve: null
  };

  var readyPromise = new Promise(function (res) { state.resolve = res; });

  function phase(name, fn) {
    var s = Date.now();
    var rec = { name: name, ok: false, ms: 0, info: null, error: null };
    var finish = function (info) {
      rec.ok = true; rec.info = info || null; rec.ms = Date.now() - s;
      state.phases.push(rec); return rec;
    };
    var fail = function (e) {
      rec.ok = false; rec.error = (e && e.message) || String(e); rec.ms = Date.now() - s;
      state.phases.push(rec);
      state.warnings.push(name + ': ' + rec.error);
      console.warn('[Boot] "' + name + '" mərhələsi alınmadı:', e);
      return rec;
    };
    try {
      var r = fn();
      if (r && typeof r.then === 'function') {
        return r.then(finish, fail);
      }
      return Promise.resolve(finish(r));
    } catch (e) {
      return Promise.resolve(fail(e));
    }
  }

  function skipped(name, why) {
    state.phases.push({ name: name, ok: true, ms: 0, info: 'atlandı — ' + why, error: null });
  }

  /* ----------------------------------------------------------------------
     1. Açılış döngəsi qoruyucusu
     ---------------------------------------------------------------------- */
  function countAttempt() {
    var n = parseInt(rawGet(K_ATTEMPT) || '0', 10);
    if (isNaN(n)) n = 0;
    n++;
    state.attempts = n;
    rawSet(K_ATTEMPT, String(n));
    if (n >= MAX_ATTEMPTS) {
      state.suspectLoop = true;
      console.warn('[Boot] ⚠️ ' + n + ' dəfə dalbadal açılış tamamlanmadı — proqram açılışda ölür ola bilər.');
    }
  }
  function clearAttempts() { rawDel(K_ATTEMPT); state.attempts = 0; }

  /* ----------------------------------------------------------------------
     2. Erkən mərhələlər — db.js-dən ƏVVƏL icra olunur
     ---------------------------------------------------------------------- */
  function runEarly() {
    countAttempt();

    var chain = Promise.resolve();

    // 2a. StorageAdapter
    chain = chain.then(function () {
      if (!global.StorageAdapter) {
        state.warnings.push('storage-adapter.js yüklənməyib — nüvə qatı passivdir');
        skipped('StorageAdapter', 'fayl yoxdur');
        return;
      }
      return phase('StorageAdapter', function () {
        return global.StorageAdapter.initialize().then(function (r) { return r; });
      });
    });

    // 2b. Körpü (localStorage sarğısı) — idempotentdir
    chain = chain.then(function () {
      if (!global.JollyDBBridge) { skipped('DB Bridge', 'fayl yoxdur'); return; }
      return phase('DB Bridge', function () {
        var ok = global.JollyDBBridge.install();
        return { installed: ok };
      });
    });

    // 2c. BƏRPA — ən vacib mərhələ. app.js məlumatı oxumamışdan əvvəl bitir.
    chain = chain.then(function () {
      if (!global.OperationJournal) { skipped('Bərpa', 'operation-journal.js yoxdur'); return; }
      return phase('Bərpa (recover)', function () {
        return global.OperationJournal.recover().then(function (rep) {
          if (rep && rep.found) {
            console.warn('[Boot] ' + rep.found + ' yarımçıq əməliyyat bərpa olundu ' +
                         '(' + rep.rolledBack + ' geri qaytarıldı, ' + rep.repaired + ' tamamlandı)');
          }
          return rep ? { found: rep.found, rolledBack: rep.rolledBack,
                         repaired: rep.repaired, failed: rep.failed } : null;
        });
      });
    });

    return chain;
  }

  /* ----------------------------------------------------------------------
     3. Gec mərhələlər — səhifə yükləndikdən sonra (UI-ni gecikdirməsin)
     ---------------------------------------------------------------------- */
  function runLate() {
    var chain = Promise.resolve();

    // 3a. Açar kəşfiyyatı — db.js açarları yaratdıqdan SONRA mənalıdır
    chain = chain.then(function () {
      if (!global.JollyDBBridge) return;
      return phase('Açar kəşfiyyatı', function () {
        var scan = global.JollyDBBridge.scan();
        var taught = global.JollyDBBridge.teachJournal();
        return { keys: scan.rows.length, mb: scan.mb,
                 jurnalda: taught.taught, kənarda: taught.skipped };
      });
    });

    // 3b. MemoryMirror — hələ qurulmayıb, gələndə avtomatik işə düşəcək
    chain = chain.then(function () {
      if (!global.MemoryMirror || typeof global.MemoryMirror.initialize !== 'function') {
        skipped('MemoryMirror', 'hələ qurulmayıb');
        return;
      }
      return phase('MemoryMirror', function () { return global.MemoryMirror.initialize(); });
    });

    // 3c. Sağlamlıq yoxlaması (HealthMonitor v2 gələndə buradan çağırılacaq)
    chain = chain.then(function () {
      var H = global.JollyHealth;
      if (!H || typeof H.check !== 'function') { skipped('Sağlamlıq', 'HealthMonitor v2 hələ yoxdur'); return; }
      return phase('Sağlamlıq', function () { return H.check({ quiet: true }); });
    });

    // 3d. Açılış tamamlandı — döngə sayğacını sıfırla
    chain = chain.then(function () {
      state.done = true;
      state.completedAt = Date.now();
      clearAttempts();
      var rep = JollyBoot.report();
      rawSet(K_REPORT, JSON.stringify({
        at: rep.completedAt, ms: rep.totalMs, warnings: rep.warnings,
        phases: rep.phases.map(function (p) { return p.name + ':' + p.ms + (p.ok ? '' : '✗'); })
      }));
      if (state.warnings.length) {
        console.warn('[Boot] açılış ' + rep.totalMs + ' ms — ' + state.warnings.length + ' xəbərdarlıq:', state.warnings);
      } else {
        console.log('[Boot] açılış təmiz bitdi — ' + rep.totalMs + ' ms');
      }
      if (state.resolve) state.resolve(rep);
      return rep;
    });

    return chain;
  }

  /* ----------------------------------------------------------------------
     4. API
     ---------------------------------------------------------------------- */
  var JollyBoot = {
    version: '1.0.0',

    whenReady: function () { return readyPromise; },
    isDone: function () { return state.done; },

    report: function () {
      return {
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        totalMs: (state.completedAt || Date.now()) - state.startedAt,
        done: state.done,
        attempts: state.attempts,
        suspectLoop: state.suspectLoop,
        warnings: state.warnings.slice(),
        phases: state.phases.map(function (p) {
          return { name: p.name, ok: p.ok, ms: p.ms, info: p.info, error: p.error };
        })
      };
    },

    lastReport: function () {
      var raw = rawGet(K_REPORT);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },

    // Boot döngəsi şübhəsi varsa — istifadəçiyə/selftest-ə xəbər
    suspectLoop: function () { return state.suspectLoop; },
    clearLoopFlag: function () { clearAttempts(); state.suspectLoop = false; return true; },

    // Əl ilə yenidən bərpa (Yoxlama ekranındaki düymə üçün)
    recoverNow: function () {
      if (!global.OperationJournal) return Promise.resolve({ error: 'jurnal yoxdur' });
      return global.OperationJournal.recover();
    },

    /* ---- Sağlamlıq — HealthMonitor v2 oxuyacaq ---- */
    health: function () {
      var rep = this.report();
      var problems = [];
      if (state.suspectLoop) problems.push(state.attempts + ' dəfə açılış tamamlanmadı — açılışda çökmə şübhəsi');
      if (!global.StorageAdapter) problems.push('storage-adapter.js yüklənməyib');
      if (!global.OperationJournal) problems.push('operation-journal.js yüklənməyib');
      if (!global.JollyDBBridge) problems.push('jolly-db-bridge.js yüklənməyib');
      rep.phases.forEach(function (p) { if (!p.ok) problems.push('Mərhələ "' + p.name + '": ' + p.error); });
      if (rep.done && rep.totalMs > 6000) problems.push('Açılış ' + rep.totalMs + ' ms sürdü — yavaşdır');

      return Promise.resolve({
        ok: problems.length === 0,
        problems: problems,
        booted: rep.done,
        totalMs: rep.totalMs,
        phases: rep.phases,
        warnings: rep.warnings,
        attempts: rep.attempts,
        previous: this.lastReport()
      });
    },

    /* ---- Bütün nüvəni bir yerdə yoxla ---- */
    selfTest: function () {
      var out = { ok: false, parts: {} };
      var jobs = [];

      function add(name, obj) {
        if (!obj || typeof obj.selfTest !== 'function') { out.parts[name] = { ok: false, missing: true }; return; }
        jobs.push(obj.selfTest().then(function (r) { out.parts[name] = r; },
                                      function (e) { out.parts[name] = { ok: false, error: String(e) }; }));
      }
      add('adapter', global.StorageAdapter);
      add('journal', global.OperationJournal);
      add('bridge', global.JollyDBBridge);

      return Promise.all(jobs).then(function () {
        out.boot = { done: state.done, ms: (state.completedAt || Date.now()) - state.startedAt,
                     warnings: state.warnings.length, phases: state.phases.length };
        out.ok = Object.keys(out.parts).every(function (k) { return out.parts[k] && out.parts[k].ok; });
        return out;
      });
    },

    _internals: function () { return state; }
  };

  global.JollyBoot = JollyBoot;

  /* ----------------------------------------------------------------------
     5. İcra
     ---------------------------------------------------------------------- */
  // Erkən mərhələlər DƏRHAL — db.js hələ yüklənməmişdir
  try { runEarly(); } catch (e) { console.warn('[Boot] erkən mərhələ xətası:', e); }

  // Gec mərhələlər səhifə yükləndikdən 400 ms sonra — UI-ni gözlətməsin
  function scheduleLate() { setTimeout(function () { runLate(); }, 400); }
  if (document.readyState === 'complete') scheduleLate();
  else global.addEventListener('load', scheduleLate, { once: true });

})(window);
