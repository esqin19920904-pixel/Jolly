/* ==========================================================================
   JOLLY vNext — jolly-cloud-bridge.js         v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   MƏQSƏD: cloud.js-i nüvə qatına bağlamaq — cloud.js-ə TOXUNMADAN.

   ƏSAS PROBLEM: buluddan bərpa (restore/merge) ən təhlükəli əməliyyatdır.
   O yarımçıq qalsa, məlumat "yarı köhnə / yarı yeni" olur — 07-28-də
   Zülfü ilə yaşadığın vəziyyətin əsl mənbəyi budur. Bir dəfə qarışandan
   sonra hansının doğru olduğunu bilmək mümkün olmur.

   NƏ EDİR?
   1) BƏRPADAN ƏVVƏL TAM SURƏT — bulud bərpası başlamazdan əvvəl bütün
      əsas açarların surətini çıxarır. Nəticə xoşuna gəlməsə:
      JollyCloudBridge.undoLastRestore()  → hər şey geri qayıdır.
   2) Bərpanı niyyət jurnalına salır — ortada sınsa, addımlar geri qaytarılır.
   3) Dəyişən açarları sayır — "nə göndərilməmiş qalıb" sualına dəqiq cavab.
   4) İstəsən avtomatik göndərmə (standart: SÖNDÜRÜLÜB).

   cloud.js-in funksiya adlarını bilmədən işləyir — adlara görə tapır və
   kənardan sarğı qoyur. Tapmasa, sadəcə passiv qalır, heç nə sınmır.

   Yükləmə yeri: cloud.js-dən SONRA (index.html-də app.js-dən əvvəl).
   ========================================================================== */

(function (global) {
  'use strict';

  var K_SNAP    = '__jolly_prerestore__';      // "__jolly_" → körpü tutmur
  var K_PENDING = '__jolly_pending_keys__';
  var MAX_SNAP_BYTES = 1.5 * 1024 * 1024;      // 1.5 MB-dan böyük surət çıxarılmır

  /* ⚠️ 07-29 audit (cloud.js real kodu oxunandan sonra):
     Əvvəlki variant `pull` adlı hər şeyi "bərpa" sayırdı. Amma cloud.js-də
     `pull()` sadəcə ŞƏBƏKƏ OXUMASIDIR — heç nə yazmır, üstəlik avtomatik
     sinxronda təkrar-təkrar çağırılır. Onu bərpa saymaq hər dəfə BÜTÜN
     localStorage-ın surətini çıxarmaq demək idi → 5 MB limiti dərhal
     dolardı. Üstəlik `restoreFromCloud()` daxildə `pull()` çağırır, yəni
     bir bərpada İKİ surət çıxardı.
     İndi adlar açıq siyahı ilə idarə olunur. */
  var READONLY = ['pull', 'fetchDevices', 'loadDevicesList', 'enabled',
                  'getDeviceId', 'getDeviceName', 'isPendingSync',
                  'getOfflineSince', 'renderStudio', 'initAutoSync', 'scheduleSync'];
  var RESTORE_RE = /restoreFromCloud|cloudRestore|applyCloudSnapshot|importFromCloud|silentCloudMerge|cloudMerge|^merge|^apply|^import|^restore/i;
  var PUSH_RE    = /push|send|upload|publish|göndər/i;

  var MIN_SNAP_GAP = 5 * 60 * 1000;   // iki surət arasında ən azı 5 dəqiqə

  function rawGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { global.localStorage.removeItem(k); } catch (e) {} }

  var state = {
    ready: false,
    cloudObj: null,
    cloudName: null,
    guarded: [],          // [{name, kind}]
    autoPush: false,
    pending: {},          // key -> {n, last}
    lastRestore: null,    // {at, keys, bytes, fn}
    lastPush: null,
    stats: { guardedCalls: 0, restores: 0, rollbacks: 0, undos: 0, pushes: 0, failures: 0 }
  };

  function toast(msg, kind) {
    try {
      if (global.Toast) {
        if (kind === 'error' && global.Toast.error) return global.Toast.error(msg);
        if (kind === 'ok' && global.Toast.success) return global.Toast.success(msg);
        if (global.Toast.info) return global.Toast.info(msg);
      }
    } catch (e) {}
    console.log('[Cloud Bridge] ' + msg);
  }

  /* ----------------------------------------------------------------------
     1. Dəyişən açarların izlənməsi
     ---------------------------------------------------------------------- */
  function loadPending() {
    var raw = rawGet(K_PENDING);
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function savePending() { rawSet(K_PENDING, JSON.stringify(state.pending)); }

  function trackChange(key, action) {
    if (!key || key.indexOf('__jolly_') === 0 || key.indexOf('jolly_journal') === 0) return;
    if (global.JollyDBBridge && global.JollyDBBridge._internals) {
      // keçici açarları saymırıq
      var k = String(key).toLowerCase();
      if (/log|jurnal|cache|kes|heartbeat|recent|diag|blackbox/.test(k)) return;
    }
    var e = state.pending[key] || { n: 0, last: 0 };
    e.n++; e.last = Date.now(); e.action = action;
    state.pending[key] = e;
    savePending();
  }

  function clearPending() { state.pending = {}; rawDel(K_PENDING); }

  /* ----------------------------------------------------------------------
     2. Bərpadan əvvəlki tam surət
     ---------------------------------------------------------------------- */
  function collectSnapshot() {
    var snap = {}, bytes = 0, skipped = [];
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (!k || k.indexOf('__jolly_') === 0 || k.indexOf('jolly_journal') === 0) continue;
        var v = global.localStorage.getItem(k);
        if (v === null) continue;
        if (v.length > 400000) { skipped.push(k); continue; }   // çox ağır — surətə düşmür
        snap[k] = v;
        bytes += (k.length + v.length) * 2;
        if (bytes > MAX_SNAP_BYTES) { skipped.push(k); break; }
      }
    } catch (e) {}
    return { snap: snap, bytes: bytes, skipped: skipped };
  }

  function saveSnapshot(reason, force) {
    // Tez-tez surət çıxarmaq yaddaşı doldurur — aralıq qoyuruq
    var last = snapshotInfo();
    if (!force && last && (Date.now() - last.at) < MIN_SNAP_GAP) {
      console.log('[Cloud Bridge] surət atlandı — sonuncusu ' +
                  Math.round((Date.now() - last.at) / 1000) + ' saniyə əvvəl çıxarılıb');
      return true;
    }
    var c = collectSnapshot();
    var payload = { at: Date.now(), reason: reason || null,
                    keys: Object.keys(c.snap).length, bytes: c.bytes,
                    skipped: c.skipped, data: c.snap };
    var ok = rawSet(K_SNAP, JSON.stringify(payload));
    if (!ok) {
      // Yer yoxdur — körpüdən yer açmağı xahiş et, bir dəfə təkrar cəhd
      try { if (global.JollyDBBridge) global.JollyDBBridge.reclaim(); } catch (e) {}
      ok = rawSet(K_SNAP, JSON.stringify(payload));
    }
    state.lastRestore = { at: payload.at, keys: payload.keys, bytes: payload.bytes,
                          fn: reason || null, saved: ok };
    if (!ok) console.warn('[Cloud Bridge] ⚠️ Bərpadan əvvəlki surət SAXLANMADI — yaddaşda yer yoxdur');
    return ok;
  }

  function snapshotInfo() {
    var raw = rawGet(K_SNAP);
    if (!raw) return null;
    try {
      var p = JSON.parse(raw);
      return { at: p.at, reason: p.reason, keys: p.keys, bytes: p.bytes,
               skipped: (p.skipped || []).length, ageMs: Date.now() - p.at };
    } catch (e) { return null; }
  }

  function undoLastRestore(silent) {
    var raw = rawGet(K_SNAP);
    if (!raw) { toast('Geri qaytarılacaq surət yoxdur', 'error'); return Promise.resolve(false); }
    var p;
    try { p = JSON.parse(raw); } catch (e) { toast('Surət oxunmadı', 'error'); return Promise.resolve(false); }

    if (!silent) {
      var when = new Date(p.at).toLocaleString('az-AZ');
      if (!global.confirm('Bərpadan əvvəlki vəziyyətə (' + when + ') qaytarılsın?\n' +
                          p.keys + ' açar geri yazılacaq.')) return Promise.resolve(false);
    }

    var name = 'bərpanı geri qaytar';
    var run = function () {
      var keys = Object.keys(p.data), done = 0;
      keys.forEach(function (k) {
        // localStorage üzərindən yazırıq ki, körpü tutsun və jurnala düşsün
        try { global.localStorage.setItem(k, p.data[k]); done++; } catch (e) {}
      });
      state.stats.undos++;
      try { if (global.StorageAdapter) global.StorageAdapter.invalidate(); } catch (e) {}
      return { restored: done, of: keys.length };
    };

    var p2;
    if (global.OperationJournal) p2 = global.OperationJournal.run(name, function () { return run(); });
    else p2 = Promise.resolve({ ok: true, result: run() });

    return p2.then(function (r) {
      toast('Geri qaytarıldı — proqram yenilənir', 'ok');
      setTimeout(function () { try { global.location.reload(); } catch (e) {} }, 900);
      return r;
    });
  }

  /* ----------------------------------------------------------------------
     3. cloud.js funksiyalarını tapıb sarğı qoymaq
     ---------------------------------------------------------------------- */
  function findCloud() {
    var cands = ['JollyCloud', 'Cloud', 'CloudSync', 'JollySync', 'CloudStudio'];
    for (var i = 0; i < cands.length; i++) {
      var o = global[cands[i]];
      if (o && typeof o === 'object') { state.cloudObj = o; state.cloudName = cands[i]; return o; }
    }
    return null;
  }

  function wrap(host, name, kind) {
    var orig = host[name];
    if (typeof orig !== 'function' || orig.__cbWrapped) return false;

    host[name] = function () {
      var args = arguments, self = this;
      state.stats.guardedCalls++;

      if (kind === 'restore') {
        saveSnapshot(name);
        state.stats.restores++;
        var call = function () { return orig.apply(self, args); };
        if (global.OperationJournal) {
          return global.OperationJournal.run('bulud bərpası: ' + name, function () {
            var r = call();
            return (r && typeof r.then === 'function') ? r : Promise.resolve(r);
          }).then(function (res) {
            if (!res.ok) {
              state.stats.rollbacks++;
              toast('⚠️ Bərpa yarımçıq qaldı və geri qaytarıldı', 'error');
            }
            return res.result !== undefined ? res.result : res;
          });
        }
        return call();
      }

      // push / göndər — manualPush() daxildə push() çağırır, iki dəfə saymırıq
      var nested = state._pushing;
      state._pushing = true;
      var out;
      try { out = orig.apply(self, args); }
      catch (e) { state.stats.failures++; state._pushing = nested; throw e; }
      if (!nested) { state.stats.pushes++; state.lastPush = { at: Date.now(), fn: name }; }
      if (!nested) state._pushing = false;
      if (out && typeof out.then === 'function') {
        return out.then(function (r) { clearPending(); return r; },
                        function (e) { state.stats.failures++; throw e; });
      }
      clearPending();
      return out;
    };
    host[name].__cbWrapped = true;
    state.guarded.push({ name: (host === global ? '' : state.cloudName + '.') + name, kind: kind });
    return true;
  }

  function guard() {
    var found = 0;
    var host = findCloud();

    if (host) {
      Object.keys(host).forEach(function (n) {
        if (typeof host[n] !== 'function') return;
        if (READONLY.indexOf(n) !== -1) return;      // yalnız oxuyur — toxunmuruq
        if (RESTORE_RE.test(n)) { if (wrap(host, n, 'restore')) found++; }
        else if (PUSH_RE.test(n)) { if (wrap(host, n, 'push')) found++; }
      });
    }

    // Qlobal funksiyalar — yalnız dəqiq adlar (təsadüfi funksiyaya toxunmamaq üçün)
    ['silentCloudMerge', 'cloudMerge', 'restoreFromCloud', 'cloudRestore', 'applyCloudSnapshot',
     'importFromCloud'].forEach(function (n) {
      if (typeof global[n] === 'function' && wrap(global, n, 'restore')) found++;
    });
    ['sendToCloud', 'pushToCloud', 'cloudSend', 'uploadToCloud'].forEach(function (n) {
      if (typeof global[n] === 'function' && wrap(global, n, 'push')) found++;
    });

    return found;
  }

  /* ----------------------------------------------------------------------
     4. Avtomatik göndərmə (standart: söndürülüb)
     ---------------------------------------------------------------------- */
  var pushTimer = null;
  function schedulePush() {
    if (!state.autoPush) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      if (!global.navigator || global.navigator.onLine === false) return;
      var host = state.cloudObj;
      if (!host) return;
      var fn = null;
      ['pushAll', 'sendAll', 'syncNow', 'push', 'send', 'upload'].forEach(function (n) {
        if (!fn && typeof host[n] === 'function') fn = n;
      });
      if (!fn) return;
      try { host[fn](); } catch (e) { console.warn('[Cloud Bridge] avto-göndərmə alınmadı:', e); }
    }, 45000);   // 45 saniyə sükutdan sonra
  }

  /* ----------------------------------------------------------------------
     5. API
     ---------------------------------------------------------------------- */
  var Bridge = {
    version: '1.0.0',

    initialize: function () {
      if (state.ready) return Promise.resolve({ ready: true, guarded: state.guarded.length });
      state.pending = loadPending();

      global.addEventListener('storage.changed', function (e) {
        var d = e && e.detail;
        if (!d || !d.key) return;
        if (d.source === 'journal') return;         // geri qaytarma dəyişiklik sayılmır
        trackChange(d.key, d.action);
        schedulePush();
      });

      var n = guard();
      if (!n) {
        // cloud.js sonra yüklənə bilər — bir dəfə də cəhd et
        setTimeout(function () { guard(); }, 2500);
      }
      state.ready = true;
      return Promise.resolve({ ready: true, guarded: state.guarded.length, cloud: state.cloudName });
    },

    guard: guard,
    guardedList: function () { return state.guarded.slice(); },

    pending: function () {
      var keys = Object.keys(state.pending);
      return {
        count: keys.length,
        keys: keys.map(function (k) {
          return { key: k, changes: state.pending[k].n, last: state.pending[k].last };
        }).sort(function (a, b) { return b.last - a.last; })
      };
    },
    clearPending: clearPending,

    snapshot: function (reason) { return Promise.resolve(saveSnapshot(reason || 'əl ilə', true)); },
    snapshotInfo: snapshotInfo,
    undoLastRestore: undoLastRestore,

    setAutoPush: function (v) {
      state.autoPush = !!v;
      toast(state.autoPush ? 'Avtomatik göndərmə AÇILDI (45 s sükutdan sonra)' : 'Avtomatik göndərmə söndürüldü', 'ok');
      return this;
    },
    isAutoPush: function () { return state.autoPush; },

    /* ---- Sağlamlıq — Nüvə Sağlamlığı ekranı oxuyacaq ---- */
    health: function () {
      var problems = [];
      var snap = snapshotInfo();
      var pend = this.pending();

      if (!state.cloudObj && !state.guarded.length)
        problems.push('cloud.js tapılmadı — bulud əməliyyatları qorunmur');
      if (state.guarded.length === 0 && state.cloudObj)
        problems.push('Qorunacaq bulud funksiyası tapılmadı — adlar fərqli ola bilər');
      if (pend.count > 50)
        problems.push(pend.count + ' açar dəyişib, hələ göndərilməyib');
      if (state.stats.rollbacks)
        problems.push(state.stats.rollbacks + ' bərpa yarımçıq qalıb və geri qaytarılıb');
      if (state.lastRestore && state.lastRestore.saved === false)
        problems.push('Son bərpada surət saxlanmadı — geri qaytarma mümkün deyil');

      return Promise.resolve({
        ok: problems.length === 0,
        problems: problems,
        cloud: state.cloudName,
        guarded: state.guarded,
        pendingCount: pend.count,
        pendingTop: pend.keys.slice(0, 8),
        snapshot: snap,
        autoPush: state.autoPush,
        lastPush: state.lastPush,
        stats: JSON.parse(JSON.stringify(state.stats))
      });
    },

    /* ---- Özünü yoxlama ---- */
    selfTest: function () {
      var out = { ok: false, snapshot: false, undoReady: false, tracking: false, guarded: state.guarded.length };
      var probe = 'jolly_cb_probe';
      return Promise.resolve()
        .then(function () {
          try { global.localStorage.setItem(probe, 'köhnə'); } catch (e) {}
          return saveSnapshot('selftest');
        })
        .then(function (ok) {
          out.snapshot = !!ok;
          var info = snapshotInfo();
          out.undoReady = !!(info && info.keys > 0);
          // izləmə işləyirmi?
          var before = Object.keys(state.pending).length;
          try { global.localStorage.setItem(probe, 'yeni'); } catch (e) {}
          out.tracking = Object.keys(state.pending).length >= before && !!state.pending[probe];
          try { global.localStorage.removeItem(probe); } catch (e) {}
          delete state.pending[probe];
          savePending();
          out.ok = out.snapshot && out.undoReady && out.tracking;
          return out;
        })
        .catch(function (e) { out.error = (e && e.message) || String(e); return out; });
    },

    _internals: function () { return state; }
  };

  global.JollyCloudBridge = Bridge;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Bridge.initialize(); }, { once: true });
  } else {
    Bridge.initialize();
  }

})(window);
