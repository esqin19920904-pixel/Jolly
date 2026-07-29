/* ==========================================================================
   JOLLY vNext — jolly-repair-log.js           v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   Rule #9 — No Silent Repair.

   Heç bir bərpa səssiz olmamalıdır. Bu fayl bütün özü-özünü təmir edən
   hadisələri BİR yerə yığır ki, "niyə məlumat dəyişdi?" sualının cavabı
   həmişə tapıla bilsin.

   ⚠️ MÜŞAHİDƏÇİDİR — heç bir nüvə faylına toxunmur, heç birinin işinə
   qarışmır, heç birini dəyişmir. Yalnız iki yolla eşidir:
     1) HADİSƏ ilə — modul özü elan edirsə (Core v1.1 hədəfi)
     2) SARĞI ilə — modul hələ elan etmirsə, funksiyası kənardan sarğılanır

   Və məhz buna görə `coverage()` metodu var: hansı hadisənin əsl emit ilə,
   hansının sarğı ilə tutulduğunu göstərir. Core v1.1-də `emit()` sətirlərini
   təxmin etməklə yox, bu xəritəyə baxaraq qoyacağıq.

   PRİORİTET (Esqin qaydası) — yer dolanda hansı qeyd ilk silinir:
     HIGH   rollback · undo · repair      ← sonuncu silinir
     MEDIUM cloud merge
     LOW    cleanup · cache · health      ← birinci silinir

   ⚠️ HƏLƏ YÜKLƏMƏ. Bu fayl Core v1.0 selfTest-ləri yaşıl olandan sonra
   index.html-ə əlavə olunacaq. Sınmış nüvənin üstünə yeni fayl qoysaq,
   günahkarı tapmaq çətinləşər.
   ========================================================================== */

(function (global) {
  'use strict';

  var K_LOG = '__jolly_repair_log__';    // "__jolly_" → db-bridge tutmur, jurnala düşmür
  var MAX   = 100;

  var LEVELS = { high: 3, medium: 2, low: 1 };

  /* Gözlənilən hadisələr — Core v1.1-də emit ediləcəklərin siyahısı */
  var EXPECTED = [
    { event: 'repair.completed',   level: 'high',   owner: 'OperationJournal' },
    { event: 'rollback.done',      level: 'high',   owner: 'OperationJournal' },
    { event: 'cloud.undo',         level: 'high',   owner: 'JollyCloudBridge' },
    { event: 'mirror.rollback',    level: 'high',   owner: 'MemoryMirror' },
    { event: 'mirror.rolledback',  level: 'high',   owner: 'MemoryMirror' },   // hazırda mövcuddur
    { event: 'permission.repaired', level: 'high',  owner: 'JollyPermBridge' },
    { event: 'identity.merged',    level: 'high',   owner: 'JollyPermBridge' },
    { event: 'idb.restored',       level: 'high',   owner: 'JollyIDB' },
    { event: 'cloud.merged',       level: 'medium', owner: 'JollyCloudBridge' },
    { event: 'storage.reclaimed',  level: 'low',    owner: 'JollyDBBridge' },
    { event: 'cache.dropped',      level: 'low',    owner: 'StorageAdapter' }
  ];

  function rawGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { global.localStorage.removeItem(k); } catch (e) {} }

  var state = {
    entries: [],
    seen: {},          // event adı -> {via:'event'|'wrap', count, last}
    wrapped: [],
    ready: false,
    dropped: { low: 0, medium: 0, high: 0 },
    writeFailed: false
  };

  /* ----------------------------------------------------------------------
     1. Yaddaş
     ---------------------------------------------------------------------- */
  function load() {
    var raw = rawGet(K_LOG);
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      state.entries = (o && o.entries) || [];
      state.seen = (o && o.seen) || {};
      state.dropped = (o && o.dropped) || state.dropped;
    } catch (e) {}
  }

  function trim() {
    if (state.entries.length <= MAX) return;
    // Əvvəlcə LOW, sonra MEDIUM, ən axırda ən köhnə HIGH
    ['low', 'medium', 'high'].forEach(function (lv) {
      while (state.entries.length > MAX) {
        var idx = -1;
        for (var i = state.entries.length - 1; i >= 0; i--) {
          if (state.entries[i].level === lv) { idx = i; break; }
        }
        if (idx === -1) break;
        state.entries.splice(idx, 1);
        state.dropped[lv]++;
      }
    });
  }

  function save() {
    trim();
    var ok = rawSet(K_LOG, JSON.stringify({
      at: Date.now(), entries: state.entries, seen: state.seen, dropped: state.dropped
    }));
    if (!ok) {
      // Yer yoxdur — LOW-ları at, bir daha cəhd et. Bərpa qeydi məhsul
      // məlumatının yerini tutmamalıdır.
      var before = state.entries.length;
      state.entries = state.entries.filter(function (e) { return e.level !== 'low'; });
      state.dropped.low += (before - state.entries.length);
      ok = rawSet(K_LOG, JSON.stringify({ at: Date.now(), entries: state.entries, seen: state.seen, dropped: state.dropped }));
      if (!ok) {
        state.entries = state.entries.filter(function (e) { return e.level === 'high'; }).slice(0, 30);
        ok = rawSet(K_LOG, JSON.stringify({ at: Date.now(), entries: state.entries, seen: state.seen, dropped: state.dropped }));
      }
    }
    state.writeFailed = !ok;
    return ok;
  }

  /* ----------------------------------------------------------------------
     2. Qeyd
     ---------------------------------------------------------------------- */
  function record(o) {
    o = o || {};
    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: Date.now(),
      level: LEVELS[o.level] ? o.level : 'medium',
      source: o.source || 'naməlum',
      action: o.action || 'bərpa',
      via: o.via || 'event',
      detail: o.detail === undefined ? null : o.detail,
      user: (function () {
        try {
          var s = global.sessionStorage.getItem('jolly_sec_session');
          if (s) { var p = JSON.parse(s); return p && (p.name || p.userId) || null; }
        } catch (e) {}
        return null;
      })()
    };
    state.entries.unshift(entry);
    save();

    var mark = entry.level === 'high' ? '🔴' : entry.level === 'medium' ? '🟡' : '⚪';
    console.log('[Repair] ' + mark + ' ' + entry.source + ' → ' + entry.action, entry.detail || '');
    return entry;
  }

  function markSeen(evt, via) {
    var s = state.seen[evt] || { via: via, count: 0, last: 0 };
    // əsl emit sarğıdan üstündür
    if (via === 'event') s.via = 'event';
    s.count++;
    s.last = Date.now();
    state.seen[evt] = s;
  }

  /* ----------------------------------------------------------------------
     3. Hadisə dinləyiciləri (Core v1.1 hazırlığı)
     ---------------------------------------------------------------------- */
  function listen() {
    EXPECTED.forEach(function (spec) {
      global.addEventListener(spec.event, function (e) {
        markSeen(spec.event, 'event');
        record({ level: spec.level, source: spec.owner, action: spec.event,
                 via: 'event', detail: (e && e.detail) || null });
      });
    });

    // JollyEvents şinində də eyni adlar gələ bilər
    try {
      if (global.JollyEvents && typeof global.JollyEvents.on === 'function') {
        EXPECTED.forEach(function (spec) {
          global.JollyEvents.on(spec.event, function (d) {
            markSeen(spec.event, 'event');
            record({ level: spec.level, source: spec.owner, action: spec.event, via: 'event', detail: d || null });
          });
        });
      }
    } catch (e) {}
  }

  /* ----------------------------------------------------------------------
     4. Sarğılar — modul hələ elan etmirsə
     ---------------------------------------------------------------------- */
  function wrap(obj, name, spec) {
    if (!obj || typeof obj[name] !== 'function' || obj[name].__rlWrapped) return false;
    var orig = obj[name];
    obj[name] = function () {
      var args = arguments, self = this, out;
      try { out = orig.apply(self, args); }
      catch (err) {
        markSeen(spec.event, 'wrap');
        record({ level: spec.level, source: spec.owner, action: spec.action,
                 via: 'wrap', detail: { error: (err && err.message) || String(err) } });
        throw err;
      }
      var finish = function (r) {
        if (spec.onlyIf && !spec.onlyIf(r)) return r;
        markSeen(spec.event, 'wrap');
        record({ level: spec.level, source: spec.owner, action: spec.action,
                 via: 'wrap', detail: spec.detail ? spec.detail(r, args) : null });
        return r;
      };
      if (out && typeof out.then === 'function') return out.then(finish);
      return finish(out);
    };
    obj[name].__rlWrapped = true;
    state.wrapped.push(spec.owner + '.' + name);
    return true;
  }

  function installWraps() {
    var n = 0;

    // OperationJournal — bərpa və geri qaytarma
    if (global.OperationJournal) {
      n += wrap(global.OperationJournal, 'recover', {
        event: 'repair.completed', level: 'high', owner: 'OperationJournal', action: 'açılış bərpası',
        onlyIf: function (r) { return r && r.found > 0; },
        detail: function (r) { return { tapılan: r.found, geriQaytarılan: r.rolledBack, tamamlanan: r.repaired, uğursuz: r.failed }; }
      }) ? 1 : 0;

      if (global.OperationJournal.Transaction && global.OperationJournal.Transaction.prototype) {
        n += wrap(global.OperationJournal.Transaction.prototype, 'rollback', {
          event: 'rollback.done', level: 'high', owner: 'OperationJournal', action: 'əməliyyat geri qaytarıldı',
          detail: function (r) { return { səbəb: r && r.reason, sayı: r && r.reverted && r.reverted.length }; }
        }) ? 1 : 0;
      }
    }

    // CloudBridge — bərpanın geri qaytarılması
    if (global.JollyCloudBridge) {
      n += wrap(global.JollyCloudBridge, 'undoLastRestore', {
        event: 'cloud.undo', level: 'high', owner: 'JollyCloudBridge', action: 'bulud bərpası geri qaytarıldı',
        onlyIf: function (r) { return r !== false; },
        detail: function (r) { return (r && r.result) || null; }
      }) ? 1 : 0;
    }

    // PermBridge — icazə anbarı və kimlik
    if (global.JollyPermBridge) {
      n += wrap(global.JollyPermBridge, 'repairStore', {
        event: 'permission.repaired', level: 'high', owner: 'JollyPermBridge', action: 'icazə anbarı təmir edildi',
        onlyIf: function (r) { return r && r.length; },
        detail: function (r) { return { açarlar: r.map(function (x) { return x.key; }) }; }
      }) ? 1 : 0;
      n += wrap(global.JollyPermBridge, 'merge', {
        event: 'identity.merged', level: 'high', owner: 'JollyPermBridge', action: 'kimlik birləşdirildi',
        onlyIf: function (r) { return r && r.ok; },
        detail: function (r) { return (r && r.result) || null; }
      }) ? 1 : 0;
      n += wrap(global.JollyPermBridge, 'reconcile', {
        event: 'permission.repaired', level: 'high', owner: 'JollyPermBridge', action: 'sessiya kimliyi uyğunlaşdırıldı',
        onlyIf: function (r) { return r && r.changed; },
        detail: function (r) { return { köhnə: r.from, yeni: r.to, ad: r.name }; }
      }) ? 1 : 0;
    }

    // IDB — geri qaytarma (freeze-dən kənar fayl, amma bərpa edir)
    if (global.JollyIDB) {
      n += wrap(global.JollyIDB, 'restoreLocal', {
        event: 'idb.restored', level: 'high', owner: 'JollyIDB', action: 'açar localStorage-a qaytarıldı',
        onlyIf: function (r) { return r === true; }
      }) ? 1 : 0;
    }

    // DB Bridge — yer açma (LOW)
    if (global.JollyDBBridge) {
      n += wrap(global.JollyDBBridge, 'reclaim', {
        event: 'storage.reclaimed', level: 'low', owner: 'JollyDBBridge', action: 'yaddaşda yer açıldı',
        onlyIf: function (r) { return r > 0; },
        detail: function (r) { return { kb: +(r / 1024).toFixed(1) }; }
      }) ? 1 : 0;
    }

    return state.wrapped.length;
  }

  /* ----------------------------------------------------------------------
     5. API
     ---------------------------------------------------------------------- */
  var RepairLog = {
    version: '1.0.0',

    initialize: function () {
      if (state.ready) return Promise.resolve({ ready: true });
      load();
      listen();
      installWraps();
      // Nüvə faylları gec yüklənə bilər — bir dəfə də cəhd
      setTimeout(function () { installWraps(); }, 2500);
      state.ready = true;
      return Promise.resolve({ ready: true, wrapped: state.wrapped.length, entries: state.entries.length });
    },

    record: record,
    list: function (limit) { return limit ? state.entries.slice(0, limit) : state.entries.slice(); },
    byLevel: function (lv) { return state.entries.filter(function (e) { return e.level === lv; }); },
    since: function (ts) { return state.entries.filter(function (e) { return e.at >= ts; }); },
    clear: function () { state.entries = []; state.dropped = { low: 0, medium: 0, high: 0 }; rawDel(K_LOG); return true; },

    /* Core v1.1 üçün hadisə xəritəsi:
       hansı hadisə əsl emit ilə gəlir, hansı hələ sarğı ilə tutulur */
    coverage: function () {
      return EXPECTED.map(function (spec) {
        var s = state.seen[spec.event];
        return {
          event: spec.event, owner: spec.owner, level: spec.level,
          seen: !!s, via: s ? s.via : null, count: s ? s.count : 0,
          needsEmit: !s || s.via !== 'event'
        };
      });
    },

    wrapped: function () { return state.wrapped.slice(); },

    /* Mətn hesabatı — admin üçün */
    report: function () {
      var L = ['=== BƏRPA JURNALI ==='];
      L.push('Qeyd sayı: ' + state.entries.length + '  (atılan: LOW ' + state.dropped.low +
             ', MEDIUM ' + state.dropped.medium + ', HIGH ' + state.dropped.high + ')');
      L.push('');
      if (!state.entries.length) L.push('Heç bir bərpa qeydə alınmayıb.');
      state.entries.slice(0, 40).forEach(function (e) {
        var mark = e.level === 'high' ? '🔴' : e.level === 'medium' ? '🟡' : '⚪';
        L.push(mark + ' ' + new Date(e.at).toLocaleString('az-AZ') + '  [' + e.source + '] ' + e.action +
               (e.detail ? '  ' + JSON.stringify(e.detail) : '') + '  (' + e.via + ')');
      });
      return L.join('\n');
    },

    /* ---- Sağlamlıq ---- */
    health: function () {
      var problems = [];
      var high = this.byLevel('high');
      var recentHigh = high.filter(function (e) { return Date.now() - e.at < 86400000; });
      if (state.writeFailed) problems.push('Bərpa jurnalı yazıla bilmir — yaddaş dolu');
      if (recentHigh.length) problems.push('Son 24 saatda ' + recentHigh.length + ' ciddi bərpa baş verib');
      if (state.dropped.high) problems.push(state.dropped.high + ' ciddi qeyd yer çatmadığı üçün silinib');
      var missing = this.coverage().filter(function (c) { return c.needsEmit; });

      return Promise.resolve({
        ok: problems.length === 0,
        problems: problems,
        total: state.entries.length,
        high: high.length,
        recentHigh: recentHigh.length,
        dropped: state.dropped,
        wrapped: state.wrapped,
        coverage: this.coverage(),
        needsEmit: missing.map(function (m) { return m.event; }),
        latest: state.entries.slice(0, 5)
      });
    },

    /* ---- Özünü yoxlama ---- */
    selfTest: function () {
      var out = { ok: false, write: false, priority: false, persist: false, wraps: state.wrapped.length };
      var before = state.entries.length;
      try {
        record({ level: 'low', source: 'selftest', action: 'sınaq qeydi', detail: { x: 1 } });
        out.write = state.entries.length === before + 1;

        // prioritet sınağı: 120 LOW qeyd + 1 HIGH → HIGH sağ qalmalıdır
        record({ level: 'high', source: 'selftest', action: 'ciddi sınaq' });
        for (var i = 0; i < 120; i++) record({ level: 'low', source: 'selftest', action: 'doldurma ' + i });
        out.priority = state.entries.some(function (e) { return e.action === 'ciddi sınaq'; }) &&
                       state.entries.length <= MAX;

        var raw = rawGet(K_LOG);
        out.persist = !!raw && raw.indexOf('ciddi sınaq') !== -1;

        // təmizlik
        state.entries = state.entries.filter(function (e) { return e.source !== 'selftest'; });
        save();

        out.ok = out.write && out.priority && out.persist;
      } catch (e) {
        out.error = (e && e.message) || String(e);
      }
      return Promise.resolve(out);
    },

    _internals: function () { return state; }
  };

  global.JollyRepairLog = RepairLog;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { RepairLog.initialize(); }, { once: true });
  } else {
    RepairLog.initialize();
  }

})(window);
