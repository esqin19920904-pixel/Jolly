/* ==========================================================================
   JOLLY — jolly-schema.js                     v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   Rule #8 (Freeze Edition): "Metadata never changes user data format."

   Məqsəd: hər saxlanılan bölmənin VERSİYASINI bilmək ki, gələcəkdə köhnə
   formatlar avtomatik çevrilə bilsin — amma məlumatın özünə TOXUNMADAN.

   NİYƏ ZƏRF DEYİL?
   `{version, updatedAt, data}` zərfi texniki cəhətdən daha səliqəlidir,
   amma db.js `jolly_products`-ı oxuyanda MASSİV gözləyir. Zərfə keçsək
   kataloq həmin an boşalar. Zərf yalnız bütün oxuyucular async olandan
   sonra mümkündür.

   ONA GÖRƏ YAN-REGİSTR:

       jolly_products  →  [ ...mövcud massiv, toxunulmayıb... ]
       __jolly_schema__ →  { "jolly_products": { v: 1, at: ..., bytes: ... } }

   Versiya kənarda saxlanılır. Köhnə kod heç nə hiss etmir.

   MİQRASİYA AXINI (açılışda):
       schema.load() → qeyd olunmuş v < cari v ? → migration(fn) → schema.update()
   Miqrasiya OperationJournal.run() içində gedir — yəni yarımçıq qalsa
   geri qaytarılır və Geri Al Mərkəzində görünür.

   Yükləmə yeri: memory-mirror.js-dən sonra, jolly-boot.js-dən əvvəl.
   ========================================================================== */

(function (global) {
  'use strict';

  var K_SCHEMA = '__jolly_schema__';    // "__jolly_" → db-bridge tutmur, jurnala düşmür
  var SAVE_DEBOUNCE = 1500;

  /* Bu açarların cari versiyaları. Format dəyişəndə rəqəm artırılır və
     aşağıda migration() yazılır. Hamısı 1 — hələ heç nə dəyişməyib. */
  var CURRENT = {
    jolly_products: 1,
    jolly_users_v1: 1,
    jolly_perm_os_v2: 1,
    jolly_groups: 1,
    jolly_statuses: 1,
    jolly_locations: 1,
    jolly_suppliers: 1,
    jolly_brands: 1,
    jolly_settings: 1,
    jolly_tombstones: 1,
    jolly_marked_for_deletion: 1,
    jolly_store_map_sections: 1
  };

  function rawGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  var state = {
    reg: {},            // key -> {v, at, bytes}
    migrations: [],     // [{key, from, to, fn, name}]
    ready: false,
    dirty: false,
    timer: null,
    lastRun: null,
    stats: { tracked: 0, updates: 0, migrated: 0, failed: 0, skipped: 0 }
  };

  /* ----------------------------------------------------------------------
     1. Registr
     ---------------------------------------------------------------------- */
  function load() {
    var raw = rawGet(K_SCHEMA);
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      state.reg = (o && o.keys) || {};
    } catch (e) { state.reg = {}; }
  }

  function save() {
    state.dirty = false;
    return rawSet(K_SCHEMA, JSON.stringify({ at: Date.now(), keys: state.reg }));
  }

  function scheduleSave() {
    state.dirty = true;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(function () { state.timer = null; save(); }, SAVE_DEBOUNCE);
  }

  function currentOf(key) {
    return CURRENT[key] || 1;
  }

  // Açarı registrə sal. İLK GÖRÜŞDƏ versiya CARİ sayılır —
  // əks halda mövcud düzgün məlumat üzərində yalançı miqrasiya işləyərdi.
  function track(key, opts) {
    opts = opts || {};
    var raw = rawGet(key);
    if (raw === null && !opts.keepMissing) return null;

    var rec = state.reg[key];
    if (!rec) {
      rec = { v: opts.assume || currentOf(key), at: Date.now(), bytes: raw ? raw.length * 2 : 0 };
      state.reg[key] = rec;
      state.stats.tracked++;
      scheduleSave();
      return rec;
    }
    rec.at = Date.now();
    rec.bytes = raw ? raw.length * 2 : 0;
    state.stats.updates++;
    scheduleSave();
    return rec;
  }

  /* ----------------------------------------------------------------------
     2. Miqrasiya
     ---------------------------------------------------------------------- */
  function migration(key, from, to, fn, name) {
    state.migrations.push({ key: key, from: from, to: to, fn: fn, name: name || (key + ' v' + from + '→v' + to) });
    return API;
  }

  function pathFor(key, from, to) {
    // from → to arasında addım-addım zəncir qur
    var chain = [], cur = from, guard = 0;
    while (cur < to && guard++ < 20) {
      var step = null;
      for (var i = 0; i < state.migrations.length; i++) {
        var m = state.migrations[i];
        if (m.key === key && m.from === cur) { step = m; break; }
      }
      if (!step) return null;          // zəncir qırıqdır
      chain.push(step);
      cur = step.to;
    }
    return cur === to ? chain : null;
  }

  function runOne(key) {
    var rec = state.reg[key];
    var target = currentOf(key);
    if (!rec || rec.v >= target) return Promise.resolve({ key: key, skipped: true });

    var chain = pathFor(key, rec.v, target);
    if (!chain) {
      state.stats.skipped++;
      console.warn('[Schema] "' + key + '" v' + rec.v + ' → v' + target + ': miqrasiya yolu yoxdur');
      return Promise.resolve({ key: key, ok: false, reason: 'yol yoxdur', from: rec.v, to: target });
    }

    var raw = rawGet(key);
    if (raw === null) return Promise.resolve({ key: key, skipped: true, reason: 'açar yoxdur' });

    var data;
    try { data = JSON.parse(raw); } catch (e) { data = raw; }

    var work = function () {
      chain.forEach(function (m) { data = m.fn(data); });
      var out = (typeof data === 'string') ? data : JSON.stringify(data);
      // localStorage üzərindən yazırıq → körpü tutur → jurnala və Geri Al-a düşür
      global.localStorage.setItem(key, out);
      rec.v = target;
      rec.at = Date.now();
      save();
      return { steps: chain.length };
    };

    var runner = global.OperationJournal
      ? global.OperationJournal.run('miqrasiya: ' + key + ' v' + rec.v + '→v' + target, function () { return work(); })
      : Promise.resolve({ ok: true, result: work() });

    return runner.then(function (r) {
      if (r && r.ok === false) {
        state.stats.failed++;
        return { key: key, ok: false, reason: r.error || 'geri qaytarıldı' };
      }
      state.stats.migrated++;
      console.log('[Schema] "' + key + '" v' + target + '-ə çevrildi (' + chain.length + ' addım)');
      return { key: key, ok: true, to: target, steps: chain.length };
    }).catch(function (e) {
      state.stats.failed++;
      return { key: key, ok: false, reason: (e && e.message) || String(e) };
    });
  }

  function runAll() {
    var keys = Object.keys(CURRENT);
    return keys.reduce(function (chain, k) {
      return chain.then(function (acc) {
        if (rawGet(k) === null) return acc;
        track(k);
        return runOne(k).then(function (r) { if (!r.skipped) acc.push(r); return acc; });
      });
    }, Promise.resolve([])).then(function (res) {
      state.lastRun = { at: Date.now(), results: res };
      if (res.length) console.log('[Schema] miqrasiya nəticəsi:', res);
      return res;
    });
  }

  /* ----------------------------------------------------------------------
     3. API
     ---------------------------------------------------------------------- */
  var API = {
    version: '1.0.0',

    initialize: function () {
      if (state.ready) return Promise.resolve({ ready: true });
      load();

      // Mövcud açarları registrə sal (ilk görüşdə cari versiya sayılır)
      Object.keys(CURRENT).forEach(function (k) { if (rawGet(k) !== null) track(k); });

      // Dəyişiklikləri izlə — `updatedAt` və `bytes` təzələnsin
      global.addEventListener('storage.changed', function (e) {
        var d = e && e.detail;
        if (!d || !d.key) return;
        if (d.key.indexOf('__jolly_') === 0) return;
        if (!(d.key in CURRENT) && !(d.key in state.reg)) return;   // tanımadığımızı izləmirik
        track(d.key, { keepMissing: true });
      });

      // Səhifə bağlananda gözləyən yazını itirməyək
      global.addEventListener('pagehide', function () { if (state.dirty) save(); });

      state.ready = true;
      return runAll().then(function (res) {
        return { ready: true, tracked: Object.keys(state.reg).length, migrated: res.length };
      });
    },

    // Modul öz açarının cari versiyasını elan edir
    define: function (key, version) {
      CURRENT[key] = version || 1;
      if (rawGet(key) !== null) track(key);
      return API;
    },

    migration: migration,
    migrate: runAll,
    versionOf: function (key) { return state.reg[key] ? state.reg[key].v : null; },
    currentOf: currentOf,
    registry: function () {
      return Object.keys(state.reg).map(function (k) {
        return { key: k, version: state.reg[k].v, current: currentOf(k),
                 updatedAt: state.reg[k].at, kb: +(state.reg[k].bytes / 1024).toFixed(1),
                 behind: state.reg[k].v < currentOf(k) };
      }).sort(function (a, b) { return b.kb - a.kb; });
    },
    migrations: function () {
      return state.migrations.map(function (m) { return { key: m.key, from: m.from, to: m.to, name: m.name }; });
    },
    stats: function () { return JSON.parse(JSON.stringify(state.stats)); },

    health: function () {
      var reg = this.registry();
      var behind = reg.filter(function (r) { return r.behind; });
      var problems = [];
      if (behind.length) problems.push(behind.length + ' bölmə köhnə formatdadır və çevrilə bilmədi');
      if (state.stats.failed) problems.push(state.stats.failed + ' miqrasiya uğursuz oldu');
      if (state.stats.skipped) problems.push(state.stats.skipped + ' bölmə üçün miqrasiya yolu yoxdur');
      return Promise.resolve({
        ok: problems.length === 0, problems: problems,
        tracked: reg.length, behind: behind,
        registry: reg.slice(0, 12), migrations: this.migrations(),
        lastRun: state.lastRun, stats: this.stats()
      });
    },

    selfTest: function () {
      var k = 'jolly_schema_probe';
      var out = { ok: false, track: false, migrate: false, untouched: false };
      try {
        global.localStorage.setItem(k, JSON.stringify({ a: 1 }));
        CURRENT[k] = 2;
        state.reg[k] = { v: 1, at: Date.now(), bytes: 0 };
        migration(k, 1, 2, function (d) { d.b = 2; return d; }, 'sınaq');

        // əsl məlumat formatına toxunulmurmu?
        var before = rawGet('jolly_products');

        return runOne(k).then(function (r) {
          out.migrate = !!(r && r.ok);
          out.track = API.versionOf(k) === 2;
          var v = JSON.parse(rawGet(k) || '{}');
          out.migrate = out.migrate && v.a === 1 && v.b === 2;
          out.untouched = rawGet('jolly_products') === before;   // başqa açara toxunmayıb
          // təmizlik
          try { global.localStorage.removeItem(k); } catch (e) {}
          delete CURRENT[k]; delete state.reg[k];
          state.migrations = state.migrations.filter(function (m) { return m.key !== k; });
          save();
          out.ok = out.track && out.migrate && out.untouched;
          return out;
        });
      } catch (e) {
        out.error = (e && e.message) || String(e);
        return Promise.resolve(out);
      }
    },

    _internals: function () { return state; }
  };

  global.JollySchema = API;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { API.initialize(); }, { once: true });
  } else { API.initialize(); }

})(window);
