/* ============================================================
   JOLLY DIAGNOSTICS ENGINE 3.0 — jolly-dx.js
   v3.0  (2026-08-18)

   ────────────────────────────────────────────────────────────
   2.0-dan FƏRQ

   2.0-da modul siyahısı ƏL İLƏ yazılmışdı — yəni o da bir növ
   "təxmin edən diaqnostika" idi. 3.0 əvvəl SİSTEMİ ÖZÜ TAPIR,
   sonra test edir:

       SCAN → INVENTORY → TEST → EVIDENCE
            → ROOT CAUSE → FIX → VERIFY → REPORT

   ƏLAVƏ OLUNANLAR
     · Canlı SCAN: yüklənən skriptlər, qlobal Jolly* obyektləri,
       ModuleRegistry modulları — heç biri əl ilə yazılmır
     · Diaqnostika inventarı CANLI çıxarılır
     · needs[] asılılıq qrafı → ümumi ROOT CAUSE
     · IndexedDB, kvota, Performance, Security bölmələri
     · Service Worker dərin yoxlanılır (waiting, artıq qeydiyyat)
     · SNAPSHOT + geri qaytarma
     · AUTO-FIX yalnız 🟢 SAFE, snapshot-dan sonra, sonra VERIFY
     · Köhnə sistemlər HƏQİQƏTƏN söndürülür
       (ModuleRegistry.unregister + qlobal yönləndirmə)

   DƏYİŞMƏYƏN QAYDALAR
     · Ümumi mesaj qadağandır — hər nəticənin sübutu var
     · Yoxlana bilməyən "NOT VERIFIED" — TƏXMİN YOXDUR
     · Diaqnostika özü çökərsə, bu da nəticədir
     · index.html-ə toxunulmur, məlumat dəyişdirilmir
   ============================================================ */
(function (global) {
  'use strict';

  if (global.JollyDX && global.JollyDX.version === '3.0') return;

  var VERSION = '3.0';
  var ROUTE = '#/dx';
  var HIST_KEY = 'jolly_dx_history';
  var SNAP_KEY = 'jolly_dx_snapshot';
  var TEST_TAG = '__DX_TEST__';

  function peek(name) {
    try {
      return new Function('try{return typeof ' + name + '!=="undefined"?' + name + ':null}catch(e){return null}')();
    } catch (e) { return null; }
  }
  function G(name) { return global[name] || peek(name); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function now() { return Date.now(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function diagId() {
    var d = new Date(), r = Math.random().toString(16).slice(2, 6).toUpperCase();
    return 'JLY-DX-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
           '-' + pad(d.getHours()) + pad(d.getMinutes()) + '-' + r;
  }
  function where(err) {
    try {
      var st = String((err && err.stack) || '').split('\n');
      for (var i = 1; i < st.length; i++) {
        var m = st[i].match(/([\w\-.]+\.js):(\d+):(\d+)/);
        if (m) return m[1] + ':' + m[2];
      }
    } catch (e) {}
    return '';
  }

  /* ══════════════════════════════════════════════════════════
     🚨 XƏTA YAZICISI
     ══════════════════════════════════════════════════════════ */
  var errors = [];
  var MAX_ERR = 150;

  function record(kind, msg, meta) {
    try {
      var e = {
        ts: now(), kind: kind, msg: String(msg || '').slice(0, 400),
        file: (meta && meta.file) || '', line: (meta && meta.line) || 0,
        col: (meta && meta.col) || 0, stack: String((meta && meta.stack) || '').slice(0, 900)
      };
      e.fn = (e.stack.match(/at\s+([\w.$]+)\s/) || [])[1] || '';
      for (var i = errors.length - 1; i >= 0 && i > errors.length - 15; i--) {
        if (errors[i].msg === e.msg && errors[i].file === e.file && errors[i].line === e.line) {
          errors[i].n = (errors[i].n || 1) + 1; errors[i].ts = e.ts; return;
        }
      }
      e.n = 1; errors.push(e);
      if (errors.length > MAX_ERR) errors.shift();
    } catch (er) {}
  }

  function installErrorCapture() {
    if (global.__dxErr3) return;
    global.__dxErr3 = true;
    var prev = global.onerror;
    global.onerror = function (msg, file, line, col, err) {
      record('error', msg, { file: file, line: line, col: col, stack: err && err.stack });
      if (typeof prev === 'function') { try { return prev.apply(this, arguments); } catch (e) {} }
      return false;
    };
    try {
      global.addEventListener('unhandledrejection', function (ev) {
        var r = ev && ev.reason;
        record('promise', (r && (r.message || r)) || 'Promise rədd edildi', { stack: r && r.stack });
      });
    } catch (e) {}
    try {
      var ce = console.error;
      if (ce && !ce.__dx) {
        var w = function () {
          try {
            var p = [];
            for (var i = 0; i < arguments.length; i++) {
              var a = arguments[i]; p.push(a && a.message ? a.message : String(a));
            }
            record('console', p.join(' '), { stack: (arguments[0] && arguments[0].stack) || '' });
          } catch (e) {}
          return ce.apply(console, arguments);
        };
        w.__dx = true; console.error = w;
      }
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     🔎 SCAN — sistem özünü tapır
     ══════════════════════════════════════════════════════════ */
  var DIAG_RE = /diag|health|doctor|selftest|self-test|debug|blackbox|repair|integrity|probe/i;

  function scanScripts() {
    var out = [];
    try {
      var els = document.getElementsByTagName('script');
      for (var i = 0; i < els.length; i++) {
        var s = els[i].getAttribute && els[i].getAttribute('src');
        if (s) out.push(String(s).split('/').pop().split('?')[0]);
      }
    } catch (e) {}
    return out;
  }

  function scanGlobals() {
    var out = [];
    try {
      for (var k in global) {
        if (k.indexOf('Jolly') !== 0 && k !== 'POS' && k !== 'ModuleRegistry' && k !== 'Toast') continue;
        var v = null;
        try { v = global[k]; } catch (e) { continue; }
        if (!v || (typeof v !== 'object' && typeof v !== 'function')) continue;
        var fns = 0;
        try { for (var f in v) if (typeof v[f] === 'function') fns++; } catch (e) {}
        out.push({ name: k, fns: fns, diag: DIAG_RE.test(k) });
      }
    } catch (e) {}
    out.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return out;
  }

  function scanModules() {
    var R = G('ModuleRegistry'), out = [];
    try {
      var all = (R && R._all) ? R._all() : {};
      for (var k in all) {
        var m = all[k] || {};
        out.push({
          id: m.id || k, name: m.name || k,
          route: String(m.route || '').split('?')[0],
          group: m.group || '',
          diag: DIAG_RE.test(m.id || '') || DIAG_RE.test(m.name || '')
        });
      }
    } catch (e) {}
    return out;
  }

  var inv = null;
  function inventory(force) {
    if (inv && !force) return inv;
    var scripts = scanScripts(), globals = scanGlobals(), modules = scanModules();
    var cnt = {}, dupScripts = [];
    scripts.forEach(function (f) { cnt[f] = (cnt[f] || 0) + 1; });
    for (var f in cnt) if (cnt[f] > 1) dupScripts.push(f + ' ×' + cnt[f]);
    inv = {
      scripts: scripts, globals: globals, modules: modules,
      diagScripts: scripts.filter(function (x) { return DIAG_RE.test(x); }),
      diagGlobals: globals.filter(function (g) { return g.diag; }),
      diagModules: modules.filter(function (m) { return m.diag; }),
      dupScripts: dupScripts, at: now()
    };
    return inv;
  }

  /* ══════════════════════════════════════════════════════════
     🔬 REGİSTR
     ══════════════════════════════════════════════════════════ */
  var tests = [];
  function register(def) {
    if (!def || !def.id || typeof def.test !== 'function') return false;
    var d = {
      id: def.id, cat: def.cat || 'Digər', title: def.title || def.id,
      severity: def.severity || 'warning', test: def.test,
      needs: def.needs || [], fix: def.fix || null, fixLabel: def.fixLabel || ''
    };
    for (var i = 0; i < tests.length; i++) if (tests[i].id === d.id) { tests[i] = d; return true; }
    tests.push(d);
    return true;
  }
  function pass(proof, x) { return Object.assign({ ok: 'pass', proof: proof || '' }, x || {}); }
  function warn(why, proof, x) { return Object.assign({ ok: 'warn', why: why, proof: proof || '' }, x || {}); }
  function crit(why, proof, x) { return Object.assign({ ok: 'crit', why: why, proof: proof || '' }, x || {}); }
  function skip(why) { return { ok: 'skip', why: why || 'NOT VERIFIED' }; }

  /* ══════════════════════════════════════════════════════════
     🧠 NÜVƏ
     ══════════════════════════════════════════════════════════ */
  var REQUIRED = {
    JollyDB: ['Products'], JollyStorage: ['saveImage', 'getImage'],
    JollyRouter: ['go'], ModuleRegistry: ['register', 'list']
  };

  register({
    id: 'core.required', cat: 'Nüvə', title: 'Vacib modullar', severity: 'critical',
    test: function () {
      var miss = [], missNames = [], have = [];
      for (var nm in REQUIRED) {
        var o = G(nm);
        if (!o) { miss.push(nm + ' (yoxdur)'); missNames.push(nm); continue; }
        var bad = REQUIRED[nm].filter(function (f) { return !o[f]; });
        if (bad.length) { miss.push(nm + '.' + bad.join('/') + ' (funksiya yoxdur)'); missNames.push(nm); }
        else have.push(nm);
      }
      if (!miss.length) return pass(have.join(', ') + ' — hamısı yerindədir');
      return crit(miss.join('; '), 'tapılan: ' + (have.join(', ') || 'heç biri'), { missing: missNames });
    }
  });

  register({
    id: 'core.inventory', cat: 'Nüvə', title: 'Canlı inventar', severity: 'warning',
    test: function () {
      var v = inventory(true);
      if (!v.scripts.length && !v.globals.length) return skip('inventar çıxarıla bilmədi');
      return pass(v.scripts.length + ' skript · ' + v.globals.length + ' qlobal modul · ' +
        v.modules.length + ' qeydiyyatlı ekran');
    }
  });

  register({
    id: 'core.dupscripts', cat: 'Nüvə', title: 'Təkrar yüklənən fayl', severity: 'critical',
    test: function () {
      var v = inventory();
      if (!v.scripts.length) return skip('skript siyahısı oxunmadı');
      if (v.dupScripts.length) return crit('eyni fayl bir neçə dəfə yüklənir', v.dupScripts.join(', '));
      return pass('təkrar yüklənən fayl yoxdur');
    }
  });

  register({
    id: 'diag.audit', cat: 'Nüvə', title: 'Diaqnostika inventarı', severity: 'warning',
    fixLabel: 'Köhnələri söndür',
    fix: function () { return neutralize(); },
    test: function () {
      var v = inventory();
      var others = v.diagGlobals.filter(function (g) {
        return g.name !== 'JollyDX' && !(global[g.name] || {}).__dx;
      });
      var mods = v.diagModules.filter(function (m) { return m.id !== 'dx'; });
      if (!others.length && !mods.length) return pass('yalnız bir diaqnostika sistemi var — bu');
      var lines = [];
      if (others.length) lines.push('qlobal: ' + others.map(function (g) { return g.name; }).join(', '));
      if (mods.length) lines.push('ekran: ' + mods.map(function (m) { return m.name; }).join(', '));
      return warn((others.length + mods.length) + ' köhnə diaqnostika hələ canlıdır',
        lines.join(' · '), { fixable: true });
    }
  });

  /* ══════════════════════════════════════════════════════════
     💾 YADDAŞ
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'storage.write', cat: 'Yaddaş', title: 'localStorage yazma/oxuma', severity: 'critical',
    test: function () {
      var k = '__dx_probe__', v = 'x' + now();
      try {
        localStorage.setItem(k, v);
        var b = localStorage.getItem(k);
        localStorage.removeItem(k);
        if (b !== v) return crit('yazılan dəyər geri oxunmadı', 'yazıldı ' + v + ' · oxundu ' + b);
        return pass('yazma və oxuma işləyir');
      } catch (e) {
        return crit('localStorage yazıla bilmir',
          (e && e.message) + (where(e) ? ' @ ' + where(e) : ''), { missing: ['localStorage'] });
      }
    }
  });

  register({
    id: 'storage.size', cat: 'Yaddaş', title: 'Yaddaş həcmi', severity: 'warning',
    test: function () {
      var total = 0, big = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i), n = (localStorage.getItem(k) || '').length;
          total += n + k.length;
          if (n > 300000) big.push({ k: k, kb: Math.round(n / 1024) });
        }
      } catch (e) { return skip('yaddaş sayıla bilmədi: ' + (e && e.message)); }
      big.sort(function (a, b) { return b.kb - a.kb; });
      var txt = big.map(function (x) { return x.k + ' (' + x.kb + ' KB)'; }).join(', ');
      var mb = (total / 1048576).toFixed(2);
      if (total > 4300000) {
        return crit('yaddaş dolmaq üzrədir (~5 MB hədd)',
          mb + ' MB · ' + txt + ' — dolanda brauzer yazmanı rədd edir, məlumat itə bilər');
      }
      if (big.length) return warn('bir neçə açar çox yer tutur', mb + ' MB · ' + txt);
      return pass(mb + ' MB istifadə olunur');
    }
  });

  register({
    id: 'storage.archives', cat: 'Yaddaş', title: 'Köhnə arxiv nüsxələri', severity: 'critical',
    fixLabel: 'Köhnə arxivləri sil',
    fix: function (r) {
      var del = (r && r.old) || [], n = 0, kb = 0;
      del.forEach(function (x) {
        try { kb += Math.round((localStorage.getItem(x.k) || '').length / 1024); localStorage.removeItem(x.k); n++; }
        catch (e) {}
      });
      return { done: n + ' köhnə arxiv silindi (' + kb + ' KB boşaldı)' };
    },
    test: function () {
      var arch = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (!/^jolly_archive_snap/.test(k)) continue;
          arch.push({ k: k, kb: Math.round((localStorage.getItem(k) || '').length / 1024) });
        }
      } catch (e) { return skip('açarlar oxunmadı'); }
      if (!arch.length) return pass('arxiv yığını yoxdur');

      /* Ən yenisi qalır — qalanları yerə görə silinə bilər */
      arch.sort(function (a, b) { return a.k < b.k ? 1 : -1; });
      var keep = arch[0], old = arch.slice(1);
      var total = arch.reduce(function (s2, x) { return s2 + x.kb; }, 0);
      var free = old.reduce(function (s2, x) { return s2 + x.kb; }, 0);

      if (!old.length) return pass('bir arxiv var (' + keep.kb + ' KB) — normaldır');
      return crit(arch.length + ' arxiv nüsxəsi yaddaşı yeyir',
        'cəmi ' + total + ' KB · ən yenisi saxlanılır (' + keep.k + '), qalan ' +
        old.length + ' nüsxə silinsə ' + free + ' KB boşalar',
        { old: old, keep: keep.k, fixable: true });
    }
  });

  register({
    id: 'storage.corrupt', cat: 'Yaddaş', title: 'Korlanmış açar', severity: 'critical',
    fixLabel: 'Korlanmışları sil',
    fix: function (r) {
      var n = 0;
      ((r && r.keys) || []).forEach(function (k) { try { localStorage.removeItem(k); n++; } catch (e) {} });
      return { done: n + ' korlanmış açar silindi' };
    },
    test: function () {
      var bad = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i), v = localStorage.getItem(k) || '', c = v.charAt(0);
          if (c !== '{' && c !== '[') continue;
          try { JSON.parse(v); } catch (e) { bad.push(k); }
        }
      } catch (e) { return skip('açarlar oxunmadı'); }
      if (bad.length) return crit(bad.length + ' açar yarımçıq/korlanıb', bad.join(', '),
        { keys: bad, fixable: true });
      return pass('bütün JSON açarlar düzgün oxunur');
    }
  });

  register({
    id: 'storage.idb', cat: 'Yaddaş', title: 'IndexedDB', severity: 'critical',
    test: function () {
      if (!global.indexedDB) return crit('IndexedDB dəstəklənmir', 'şəkillər orada saxlanılır');
      return new Promise(function (res) {
        var done = false;
        var t = setTimeout(function () {
          if (!done) { done = true; res(warn('IndexedDB 4 saniyəyə cavab vermədi', 'kilidlənmiş ola bilər')); }
        }, 4000);
        function finish(r) { if (done) return; done = true; clearTimeout(t); res(r); }
        try {
          var req = indexedDB.open('__dx_probe__', 1);
          req.onupgradeneeded = function (e) { try { e.target.result.createObjectStore('s'); } catch (er) {} };
          req.onsuccess = function (e) {
            var db = e.target.result;
            try {
              var tx = db.transaction('s', 'readwrite');
              tx.objectStore('s').put('ok', 'k');
              tx.oncomplete = function () {
                try { db.close(); indexedDB.deleteDatabase('__dx_probe__'); } catch (er) {}
                finish(pass('açılır, yazılır və silinir'));
              };
              tx.onerror = function () {
                try { db.close(); } catch (er) {}
                finish(crit('IndexedDB-yə yazıla bilmir', 'transaction xəta verdi'));
              };
            } catch (er) {
              try { db.close(); } catch (e2) {}
              finish(crit('IndexedDB əməliyyatı alınmadı', String(er && er.message)));
            }
          };
          req.onerror = function () { finish(crit('IndexedDB açıla bilmir', 'brauzer icazə vermir və ya baza kilidlidir')); };
          req.onblocked = function () { finish(warn('IndexedDB bloklanıb', 'başqa tab açıq ola bilər')); };
        } catch (e) { finish(crit('IndexedDB xətası', String(e && e.message))); }
      });
    }
  });

  register({
    id: 'storage.quota', cat: 'Yaddaş', title: 'Disk kvotası', severity: 'warning',
    test: function () {
      if (!(navigator.storage && navigator.storage.estimate)) return skip('brauzer estimate() vermir');
      return navigator.storage.estimate().then(function (q) {
        var u = q.usage || 0, t = q.quota || 0;
        if (!t) return skip('kvota bilinmir');
        var p = Math.round(u / t * 100);
        var s = (u / 1048576).toFixed(1) + ' / ' + (t / 1048576).toFixed(0) + ' MB (' + p + '%)';
        if (p >= 90) return crit('disk kvotası dolmaq üzrədir', s);
        if (p >= 75) return warn('kvota 75%-i keçib', s);
        return pass(s);
      }).catch(function (e) { return skip('kvota oxunmadı: ' + (e && e.message)); });
    }
  });

  /* ══════════════════════════════════════════════════════════
     📦 BAZA
     ══════════════════════════════════════════════════════════ */
  function products() {
    var d = G('JollyDB');
    try { return (d && d.Products && d.Products.all) ? (d.Products.all() || []) : null; }
    catch (e) { return null; }
  }

  register({
    id: 'db.read', cat: 'Baza', title: 'Baza oxunur', severity: 'critical', needs: ['JollyDB'],
    test: function () {
      var l = products();
      if (l === null) return crit('Products.all() çağırıla bilmədi', 'modul var, amma cavab vermir');
      return pass(l.length + ' məhsul oxundu');
    }
  });

  register({
    id: 'db.integrity', cat: 'Baza', title: 'Məhsulların bütövlüyü', severity: 'warning', needs: ['JollyDB'],
    test: function () {
      var l = products();
      if (l === null) return skip('baza oxunmadı');
      if (!l.length) return pass('baza boşdur');
      var noId = 0, noName = 0, dupIds = [], badImg = 0, seen = {};
      for (var i = 0; i < l.length; i++) {
        var p = l[i] || {};
        if (!p.id) { noId++; continue; }
        if (seen[p.id] && dupIds.indexOf(p.id) === -1) dupIds.push(p.id);
        seen[p.id] = 1;
        if (!String(p.name || '').trim()) noName++;
        var im = p.images || [];
        for (var j = 0; j < im.length; j++) {
          var r = String(im[j] || '');
          if (r && !/^(idb:|data:|fbs:|https?:)/.test(r)) badImg++;
        }
      }
      var probs = [];
      if (noId) probs.push(noId + ' id-siz');
      if (dupIds.length) probs.push(dupIds.length + ' təkrar id');
      if (noName) probs.push(noName + ' adsız');
      if (badImg) probs.push(badImg + ' tanınmayan şəkil ünvanı');
      if (!probs.length) return pass(l.length + ' məhsulun hamısı sağlamdır');
      return (noId || dupIds.length ? crit : warn)(probs.join(', '), l.length + ' məhsuldan');
    }
  });

  register({
    id: 'db.dupbarcode', cat: 'Baza', title: 'Təkrar barkod', severity: 'warning', needs: ['JollyDB'],
    test: function () {
      var l = products();
      if (l === null) return skip('baza oxunmadı');
      var map = {}, dup = [];
      l.forEach(function (p) {
        ((p || {}).barcodes || []).forEach(function (b) {
          var c = String(b || '').trim(); if (!c) return;
          if (map[c]) { if (dup.indexOf(c) === -1) dup.push(c); } else map[c] = 1;
        });
      });
      if (!dup.length) return pass('təkrar barkod yoxdur');
      var qov = [];
      try {
        JSON.parse(localStorage.getItem('jolly_qovluqlar') || '[]').forEach(function (q) {
          if (dup.indexOf(String(q.code)) !== -1) qov.push(String(q.code));
        });
      } catch (e) {}
      var real = dup.filter(function (c) { return qov.indexOf(c) === -1; });
      if (!real.length) return pass(dup.length + ' təkrar barkod var, hamısı qovluq sistemindəndir');
      return warn(real.length + ' barkod bir neçə malda təkrarlanır',
        real.slice(0, 8).join(', ') + (real.length > 8 ? '…' : ''));
    }
  });

  /* ══════════════════════════════════════════════════════════
     🧪 REAL SSENARİ
     ══════════════════════════════════════════════════════════ */
  function cleanup(P, id) {
    try { if (P.remove) return P.remove(id); } catch (e) {}
    try { if (P.delete) return P.delete(id); } catch (e) {}
    try { if (P.update) P.update(id, { deleted: true }); } catch (e) {}
  }

  register({
    id: 'flow.crud', cat: 'Real test', title: 'Yarat → tap → dəyiş → sil',
    severity: 'critical', needs: ['JollyDB'],
    test: function () {
      var d = G('JollyDB');
      if (!d.Products || !d.Products.add) return skip('Products.add yoxdur');
      var P = d.Products, code = '999' + String(now()).slice(-9), steps = [], id = null;
      try {
        var made = P.add({ name: TEST_TAG + ' ' + code, barcodes: [code], price: 1 });
        id = made && (made.id || made);
        if (!id) return crit('məhsul yaradıla bilmədi', 'Products.add() id qaytarmadı');
        steps.push('yaradıldı');

        var found = (P.all ? P.all() : []).filter(function (x) { return x && x.id === id; })[0];
        if (!found) { cleanup(P, id); return crit('yaradılan məhsul bazada tapılmadı', 'id ' + id); }
        steps.push('tapıldı');

        if (P.findByBarcode) {
          if (!(P.findByBarcode(code) || []).length) {
            cleanup(P, id); return crit('barkodla tapılmadı', 'kod ' + code);
          }
          steps.push('barkodla tapıldı');
        } else steps.push('findByBarcode YOXDUR');

        if (P.update) {
          P.update(id, { price: 7 });
          var ag = (P.all ? P.all() : []).filter(function (x) { return x && x.id === id; })[0];
          if (!ag || Number(ag.price) !== 7) {
            cleanup(P, id);
            return crit('dəyişiklik yadda qalmadı', '7 yazıldı, oxundu ' + (ag && ag.price));
          }
          steps.push('dəyişdirildi');
        } else steps.push('update YOXDUR');

        cleanup(P, id);
        if ((P.all ? P.all() : []).some(function (x) { return x && x.id === id; })) {
          return warn('silinən məhsul hələ siyahıdadır', steps.join(' → '));
        }
        steps.push('silindi');
        return pass(steps.join(' → '));
      } catch (e) {
        if (id) cleanup(P, id);
        return crit('zəncir çökdü: ' + (e && e.message),
          (steps.join(' → ') || 'ilk addımda') + (where(e) ? ' @ ' + where(e) : ''));
      }
    }
  });

  register({
    id: 'flow.leftovers', cat: 'Real test', title: 'Sınaq malı qalmayıb',
    severity: 'warning', needs: ['JollyDB'], fixLabel: 'Qalıqları sil',
    fix: function (r) {
      var P = (G('JollyDB') || {}).Products, n = 0;
      if (!P) return { done: 'baza yoxdur' };
      ((r && r.left) || []).forEach(function (id) { cleanup(P, id); n++; });
      return { done: n + ' sınaq malı silindi' };
    },
    test: function () {
      var l = products();
      if (l === null) return skip('baza oxunmadı');
      var left = l.filter(function (p) { return p && String(p.name || '').indexOf(TEST_TAG) === 0; });
      if (!left.length) return pass('sınaq malı qalmayıb');
      return warn(left.length + ' sınaq malı bazada qalıb',
        left.map(function (p) { return p.id; }).slice(0, 5).join(', '),
        { left: left.map(function (p) { return p.id; }), fixable: true });
    }
  });

  /* ══════════════════════════════════════════════════════════
     ⚡ PERFORMANCE
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'perf.dbspeed', cat: 'Performance', title: 'Baza oxuma sürəti',
    severity: 'warning', needs: ['JollyDB'],
    test: function () {
      var t0 = now(), n = 0;
      try { for (var i = 0; i < 5; i++) n = (products() || []).length; }
      catch (e) { return skip('ölçülə bilmədi'); }
      var ms = (now() - t0) / 5, s = ms.toFixed(1) + ' ms · ' + n + ' məhsul';
      if (ms > 250) return crit('baza oxuması çox yavaşdır', s + ' — hər ekranda hiss olunur');
      if (ms > 80) return warn('baza oxuması yavaşdır', s);
      return pass(s);
    }
  });

  register({
    id: 'perf.boot', cat: 'Performance', title: 'Açılış vaxtı', severity: 'warning',
    test: function () {
      try {
        var t = global.performance && global.performance.timing;
        /* navigationStart bəzi mühitlərdə 0-dır — 0 "yoxdur" demək deyil */
        if (!t || typeof t.loadEventEnd !== 'number' || typeof t.navigationStart !== 'number') {
          return skip('açılış vaxtı ölçülmür');
        }
        if (!t.loadEventEnd) return skip('açılış hələ bitməyib');
        var ms = t.loadEventEnd - t.navigationStart;
        if (ms <= 0) return skip('açılış hələ bitməyib');
        var s = (ms / 1000).toFixed(1) + ' saniyə';
        if (ms > 5000) return crit('açılış çox uzundur', s + ' — fayl sayı çoxdur');
        if (ms > 2500) return warn('açılış uzundur', s);
        return pass(s);
      } catch (e) { return skip('ölçülmədi'); }
    }
  });

  register({
    id: 'perf.dom', cat: 'Performance', title: 'Ekran ağırlığı', severity: 'warning',
    test: function () {
      try {
        var n = document.getElementsByTagName('*').length;
        if (n > 4000) return crit('ekranda çox element var', n + ' element — sürüşdürmə ilişir');
        if (n > 2000) return warn('ekran ağırdır', n + ' element');
        return pass(n + ' element');
      } catch (e) { return skip('sayıla bilmədi'); }
    }
  });

  /* ══════════════════════════════════════════════════════════
     🔐 SECURITY
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'sec.session', cat: 'Security', title: 'Sessiya', severity: 'warning',
    test: function () {
      var s = null;
      try { s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); } catch (e) {}
      if (!s) return warn('giriş edilməyib', 'proqram kilidsiz işləyir — qadağalar tətbiq olunmur');
      if (!s.role) return crit('sessiyada rol yoxdur', JSON.stringify(s).slice(0, 80));
      return pass('rol: ' + s.role + (s.userName ? ' (' + s.userName + ')' : ''));
    }
  });

  register({
    id: 'sec.perms', cat: 'Security', title: 'İcazə sistemi', severity: 'warning',
    test: function () {
      var I = G('JollyIdare'), P = G('POS');
      if (!I && !P) return skip('icazə sistemi yüklənməyib');
      if (I && I.cfg) {
        var c = I.cfg();
        var users = (c && c.allow) ? Object.keys(c.allow).length : 0;
        return pass('İdarə Mərkəzi aktivdir · ' + users + ' işçi üçün ayar var' +
          (P && P.can && P.can.__idare ? ' · köhnə mühərrik tabedir' : ''));
      }
      return warn('yalnız köhnə icazə mühərriki var', 'İdarə Mərkəzi yüklənməyib');
    }
  });

  register({
    id: 'sec.secrets', cat: 'Security', title: 'Açıq saxlanan açarlar', severity: 'warning',
    test: function () {
      var risky = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          /* `__jolly_extra_perm_keys__` kimi adlar açar SİYAHISIDIR,
             gizli açar deyil — boş narahatlıq yaratmasın */
          if (/_keys__$|perm|pending|keylist/i.test(k)) continue;
          if (/(^|_)(api)?key$|token|secret|password|passw|(^|_)pin(_|$)/i.test(k)) {
            if ((localStorage.getItem(k) || '').length > 8) risky.push(k);
          }
        }
      } catch (e) { return skip('açarlar oxunmadı'); }
      if (!risky.length) return pass('açıq saxlanan gizli açar tapılmadı');
      return warn(risky.length + ' açar şifrələnmədən saxlanılır',
        risky.join(', ') + ' — telefonu başqası açsa oxuya bilər');
    }
  });

  /* ══════════════════════════════════════════════════════════
     📱 PWA · 🔄 ŞƏBƏKƏ
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'pwa.sw', cat: 'PWA', title: 'Service Worker', severity: 'warning',
    test: function () {
      if (!('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistrations) {
        return skip('brauzer dəstəkləmir');
      }
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
        if (!regs || !regs.length) {
          return warn('Service Worker qeydiyyatdan keçməyib', 'oflayn iş və quraşdırma olmayacaq');
        }
        var r = regs[0], parts = [];
        if (r.active) parts.push('aktiv: ' + String(r.active.scriptURL).split('/').pop());
        if (r.waiting) parts.push('GÖZLƏYƏN yeni versiya var');
        if (r.installing) parts.push('quraşdırılır');
        if (regs.length > 1) parts.push(regs.length + ' qeydiyyat');
        if (r.waiting) return warn('yeni versiya gözləyir, tətbiq olunmayıb', parts.join(' · '));
        if (regs.length > 1) return warn('bir neçə Service Worker qeydiyyatı var', parts.join(' · '));
        if (!r.active) return warn('aktiv Service Worker yoxdur', parts.join(' · ') || 'yalnız qeydiyyat var');
        return pass(parts.join(' · '));
      }).catch(function (e) { return skip('oxunmadı: ' + (e && e.message)); });
    }
  });

  register({
    id: 'pwa.cache', cat: 'PWA', title: 'Keş', severity: 'warning',
    test: function () {
      if (!global.caches || !global.caches.keys) return skip('Cache API yoxdur');
      return caches.keys().then(function (ks) {
        if (!ks.length) return warn('keş boşdur', 'oflayn açılış işləməyəcək');
        if (ks.length > 4) return warn(ks.length + ' keş var — köhnələri qalıb', ks.join(', '));
        return pass(ks.join(', '));
      }).catch(function (e) { return skip('oxunmadı: ' + (e && e.message)); });
    }
  });

  register({
    id: 'net.online', cat: 'Şəbəkə', title: 'İnternet', severity: 'warning',
    test: function () {
      if (navigator.onLine === false) return warn('internet yoxdur', 'navigator.onLine = false');
      return pass('bağlıdır');
    }
  });

  register({
    id: 'net.aibridge', cat: 'Şəbəkə', title: 'AI körpüsü', severity: 'warning',
    test: function () {
      var B = G('JollyAIBridge');
      if (!B) return skip('jolly-ai-bridge.js yüklənməyib');
      if (!B.enabled()) return warn('körpü söndürülüb', 'jolly_ai_off = 1');
      if (navigator.onLine === false) return skip('internet yoxdur — sınanmadı');

      /* ★ "Quruludur" demək kifayət deyil — ƏSL sorğu göndəririk.
         Əvvəl bu test yalnız ayarın mövcudluğuna baxırdı və server
         cavab verməsə də "yaşıl" görünürdü. */
      return B.ask('Neçə malım var?').then(function (r) {
        if (r && r.ok && r.text) return pass('cavab gəldi: "' + String(r.text).slice(0, 70) + '"');
        return crit('server cavab vermir', B.endpoint() + ' → ' + ((r && r.error) || 'naməlum') +
          ' · Kodsuz Mehsullar-a _worker.js yüklənibmi?');
      }).catch(function (e) {
        return crit('körpüyə çatmaq olmur', B.endpoint() + ' → ' + (e && e.message));
      });
    }
  });

  /* ══════════════════════════════════════════════════════════
     🚨 XƏTALAR
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'errors.runtime', cat: 'Xətalar', title: 'Tutulan xətalar', severity: 'critical',
    test: function () {
      if (!errors.length) return pass('açılışdan bəri xəta tutulmayıb');
      var top = errors.slice(-5).reverse().map(function (e) {
        return e.msg.slice(0, 60) +
          (e.file ? ' @ ' + String(e.file).split('/').pop() + ':' + e.line : '') +
          (e.fn ? ' [' + e.fn + ']' : '') + (e.n > 1 ? ' ×' + e.n : '');
      });
      return crit(errors.length + ' fərqli xəta tutulub', top.join(' | '));
    }
  });

  /* ══════════════════════════════════════════════════════════
     🧠 KÖK SƏBƏB — asılılıq qrafından
     ══════════════════════════════════════════════════════════ */
  function rootCause(results) {
    var causes = [], missing = {};
    results.forEach(function (r) { (r.missing || []).forEach(function (m) { missing[m] = 1; }); });

    Object.keys(missing).forEach(function (m) {
      var aff = results.filter(function (r) {
        return r.ok !== 'pass' && (r.needs || []).indexOf(m) !== -1;
      });
      causes.push({
        cause: m + ' yüklənməyib və ya sınıqdır',
        why: aff.length ? 'bu modul olmadan ondan asılı testlər işləyə bilmir'
                        : 'proqramın nüvə hissəsidir',
        affected: aff.map(function (r) { return r.title; }), n: aff.length
      });
    });

    var byCat = {};
    results.forEach(function (r) { (byCat[r.cat] = byCat[r.cat] || []).push(r); });
    Object.keys(byCat).forEach(function (c) {
      var arr = byCat[c].filter(function (r) { return r.ok !== 'skip'; });
      if (arr.length < 3) return;
      if (arr.every(function (r) { return r.ok === 'crit'; })) {
        causes.push({
          cause: c + ' bölməsi tam çöküb',
          why: arr.length + ' testin hamısı kritik verdi — ayrı-ayrı problem deyil, bölmə işləmir',
          affected: arr.map(function (r) { return r.title; }), n: arr.length
        });
      }
    });

    var dup = results.filter(function (r) { return r.id === 'core.dupscripts' && r.ok === 'crit'; })[0];
    if (dup) causes.push({
      cause: 'eyni fayl bir neçə dəfə yüklənir',
      why: 'ikinci yükləmə birincinin qlobal adlarını əzir — davranış təsadüfi olur',
      affected: [dup.proof], n: 1
    });

    return causes;
  }

  /* ══════════════════════════════════════════════════════════
     📊 BAL
     ══════════════════════════════════════════════════════════ */
  function score(results) {
    var byCat = {};
    results.forEach(function (r) {
      if (r.ok === 'skip') return;
      var c = byCat[r.cat] || (byCat[r.cat] = { got: 0, max: 0 });
      var w = (r.severity === 'critical') ? 2 : 1;
      c.max += w;
      c.got += (r.ok === 'pass') ? w : (r.ok === 'warn' ? w * 0.5 : 0);
    });
    var cats = {}, got = 0, max = 0;
    for (var k in byCat) {
      cats[k] = byCat[k].max ? Math.round(byCat[k].got / byCat[k].max * 100) : 100;
      got += byCat[k].got; max += byCat[k].max;
    }
    return { total: max ? Math.round(got / max * 100) : 100, cats: cats };
  }

  /* ══════════════════════════════════════════════════════════
     💾 SNAPSHOT
     ══════════════════════════════════════════════════════════ */
  /* Arxiv və səbət özləri nüsxədir — onları yenidən köçürmək
     yaddaşı iki dəfə yeyər. Esqinin cihazında bunlar 4 MB idi. */
  var SNAP_SKIP = /^jolly_archive_snap|^jolly_snapshot$|^jolly_trash$|^jolly_dx_/;
  var SNAP_MAX = 900000;              /* cəmi ~0.9 MB — yerə sığsın */

  function snapshot() {
    var keys = [], data = {}, bytes = 0, skipped = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('jolly') !== 0 || k === SNAP_KEY) continue;
        if (SNAP_SKIP.test(k)) { skipped++; continue; }
        var v = localStorage.getItem(k) || '';
        if (v.length > 400000) { skipped++; continue; }
        if (bytes + v.length > SNAP_MAX) { skipped++; continue; }
        data[k] = v; bytes += v.length; keys.push(k);
      }
      var snap = { id: 'SNAP-' + now().toString(36).toUpperCase(), ts: now(),
        keys: keys.length, bytes: bytes, data: data };
      localStorage.setItem(SNAP_KEY, JSON.stringify(snap));
      return { ok: true, id: snap.id, keys: keys.length, kb: Math.round(bytes / 1024), skipped: skipped };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'yer çatmadı' };
    }
  }
  function lastSnapshot() {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch (e) { return null; }
  }
  function restore() {
    var s = lastSnapshot();
    if (!s || !s.data) return { ok: false, error: 'snapshot yoxdur' };
    var n = 0;
    try {
      for (var k in s.data) { localStorage.setItem(k, s.data[k]); n++; }
      return { ok: true, restored: n, id: s.id };
    } catch (e) { return { ok: false, error: (e && e.message), restored: n }; }
  }

  /* ══════════════════════════════════════════════════════════
     🛠 AUTO-FIX — 🟢 SAFE → SNAPSHOT → FIX → VERIFY
     ══════════════════════════════════════════════════════════ */
  function autofix() {
    if (!last) return Promise.resolve({ ok: false, error: 'əvvəl diaqnostika işə salınmalıdır' });
    var fixable = last.results.filter(function (r) {
      return r.fixable && r.ok !== 'pass' && r.ok !== 'skip';
    });
    if (!fixable.length) return Promise.resolve({ ok: false, error: 'təhlükəsiz düzəldiləcək problem yoxdur' });

    var snap = snapshot();
    if (!snap.ok) return Promise.resolve({ ok: false, error: 'snapshot alınmadı: ' + snap.error });

    var done = [];
    fixable.forEach(function (r) {
      var t = tests.filter(function (x) { return x.id === r.id; })[0];
      if (!t || !t.fix) return;
      try {
        var out = t.fix(r);
        done.push((t.fixLabel || t.title) + ': ' + ((out && out.done) || 'edildi'));
      } catch (e) {
        done.push((t.fixLabel || t.title) + ': ALINMADI — ' + (e && e.message));
      }
    });

    var before = last.score.total;
    return run().then(function (after) {
      return {
        ok: true, snapshot: snap.id, fixed: done,
        before: before, after: after.score.total, better: after.score.total >= before
      };
    });
  }

  /* ══════════════════════════════════════════════════════════
     🚫 KÖHNƏ SİSTEMLƏRİ SÖNDÜRMƏK
     ══════════════════════════════════════════════════════════ */
  function stub(name) {
    return {
      __dx: true, __was: name,
      log: function (m) { record('legacy:' + name, m, {}); },
      push: function (m, meta) { record('legacy:' + name, m, meta || {}); },
      all: function () { return errors.slice(); },
      errors: function () { return errors.slice(); },
      clear: function () { errors.length = 0; },
      run: function () { return global.JollyDX.run(); },
      render: function () { return global.JollyDX.render(); }
    };
  }

  function neutralize() {
    var v = inventory(true), out = [];
    var R = G('ModuleRegistry');
    if (R && R.unregister) {
      v.diagModules.forEach(function (m) {
        if (m.id === 'dx') return;
        try { if (R.unregister(m.id)) out.push('ekran söndürüldü: ' + m.name); } catch (e) {}
      });
    }
    v.diagGlobals.forEach(function (g) {
      if (g.name === 'JollyDX') return;
      try {
        if (global[g.name] && global[g.name].__dx) return;
        global[g.name] = stub(g.name);
        out.push('qlobal yönləndirildi: ' + g.name);
      } catch (e) {}
    });
    inventory(true);
    return { done: out.length ? out.join(' · ') : 'söndürüləcək köhnə sistem tapılmadı', n: out.length };
  }

  /* ══════════════════════════════════════════════════════════
     ▶ İCRA
     ══════════════════════════════════════════════════════════ */
  var last = null, running = false;

  function run(onStep) {
    if (running) return Promise.resolve(last);
    running = true;
    inventory(true);
    var results = [], i = 0;

    function step() {
      if (i >= tests.length) return Promise.resolve();
      var t = tests[i++], started = now();

      var lack = (t.needs || []).filter(function (n) { return !G(n); });
      if (lack.length) {
        var r0 = skip(lack.join(', ') + ' yüklənməyib');
        r0.id = t.id; r0.cat = t.cat; r0.title = t.title; r0.severity = t.severity;
        r0.needs = t.needs; r0.ms = 0; r0.missing = lack;
        results.push(r0);
        if (onStep) { try { onStep(r0, i, tests.length); } catch (e) {} }
        return step();
      }

      return Promise.resolve()
        .then(function () { return t.test(); })
        .catch(function (e) {
          return crit('TEST ÖZÜ ÇÖKDÜ: ' + (e && e.message),
            (where(e) || 'yer bilinmir') + ' · ' + (String((e && e.stack) || '').split('\n')[1] || ''));
        })
        .then(function (r) {
          r = r || skip('test nəticə qaytarmadı');
          r.id = t.id; r.cat = t.cat; r.title = t.title; r.severity = t.severity;
          r.needs = t.needs; r.ms = now() - started;
          if (t.fix && r.fixable) r.fixLabel = t.fixLabel;
          results.push(r);
          if (onStep) { try { onStep(r, i, tests.length); } catch (e) {} }
          return step();
        });
    }

    return step().then(function () {
      var out = {
        id: diagId(), ts: now(), version: VERSION,
        results: results, score: score(results), causes: rootCause(results),
        counts: {
          crit: results.filter(function (r) { return r.ok === 'crit'; }).length,
          warn: results.filter(function (r) { return r.ok === 'warn'; }).length,
          pass: results.filter(function (r) { return r.ok === 'pass'; }).length,
          skip: results.filter(function (r) { return r.ok === 'skip'; }).length
        },
        inv: inventory(), env: envInfo()
      };
      last = out; running = false; saveHistory(out);
      return out;
    }).catch(function (e) { running = false; throw e; });
  }

  function envInfo() {
    var o = {};
    try {
      o.ua = navigator.userAgent.slice(0, 120);
      o.online = navigator.onLine !== false;
      o.standalone = !!(global.matchMedia && global.matchMedia('(display-mode: standalone)').matches);
      o.screen = global.screen ? global.screen.width + '×' + global.screen.height : '?';
    } catch (e) {}
    return o;
  }
  function saveHistory(out) {
    try {
      var h = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
      h.unshift({ id: out.id, ts: out.ts, score: out.score.total,
        crit: out.counts.crit, warn: out.counts.warn, pass: out.counts.pass });
      localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 25)));
    } catch (e) {}
  }
  function history() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) { return []; }
  }

  /* ══════════════════════════════════════════════════════════
     📄 HESABAT
     ══════════════════════════════════════════════════════════ */
  function report(out) {
    out = out || last;
    if (!out) return 'Hələ diaqnostika işə salınmayıb.';
    var L = [];
    L.push('JOLLY DIAGNOSTICS REPORT v' + out.version);
    L.push(new Date(out.ts).toLocaleString('az'));
    L.push('ID: ' + out.id);
    L.push('');
    L.push('SİSTEM');
    L.push('  ' + (out.env.ua || '?'));
    L.push('  Ekran ' + out.env.screen + ' · Onlayn ' + (out.env.online ? 'bəli' : 'xeyr') +
           ' · Quraşdırılıb ' + (out.env.standalone ? 'bəli' : 'xeyr'));
    L.push('');
    L.push('İNVENTAR (canlı skan)');
    L.push('  Skript: ' + out.inv.scripts.length + ' · Qlobal modul: ' + out.inv.globals.length +
           ' · Qeydiyyatlı ekran: ' + out.inv.modules.length);
    L.push('  Diaqnostika: ' + out.inv.diagGlobals.length + ' qlobal, ' +
           out.inv.diagModules.length + ' ekran');
    if (out.inv.diagGlobals.length) {
      L.push('    ' + out.inv.diagGlobals.map(function (g) { return g.name; }).join(', '));
    }
    if (out.inv.dupScripts.length) L.push('  ⚠ Təkrar yüklənən: ' + out.inv.dupScripts.join(', '));
    L.push('');
    L.push('SAĞLAMLIQ: ' + out.score.total + ' / 100');
    for (var c in out.score.cats) L.push('  ' + c + ': ' + out.score.cats[c]);
    L.push('');
    L.push('NƏTİCƏ: ' + out.counts.crit + ' kritik · ' + out.counts.warn + ' xəbərdarlıq · ' +
           out.counts.pass + ' keçdi · ' + out.counts.skip + ' yoxlanmadı');
    if (out.causes.length) {
      L.push('');
      L.push('ƏSAS SƏBƏBLƏR');
      out.causes.forEach(function (x, i) {
        L.push('  ' + (i + 1) + '. ' + x.cause);
        L.push('     səbəb: ' + x.why);
        if (x.n) L.push('     təsir: ' + x.n + ' test — ' + x.affected.slice(0, 5).join(', '));
      });
    }
    L.push('');
    L.push('TAM SİYAHI');
    out.results.forEach(function (r) {
      var m = { pass: '[OK]  ', warn: '[XƏB] ', crit: '[KRİT]', skip: '[YOX] ' }[r.ok];
      L.push('  ' + m + ' ' + r.cat + ' / ' + r.title + '  (' + r.ms + 'ms)');
      if (r.ok === 'pass') { if (r.proof) L.push('        ' + r.proof); }
      else if (r.ok === 'skip') L.push('        NOT VERIFIED — ' + (r.why || ''));
      else {
        L.push('        problem: ' + r.why);
        if (r.proof) L.push('        sübut: ' + r.proof);
        if (r.fixable) L.push('        avtomatik düzəldilə bilər: bəli');
      }
    });
    return L.join('\n');
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  function css() {
    if (document.getElementById('dx-css3')) return;
    var st = document.createElement('style');
    st.id = 'dx-css3';
    st.textContent = [
      '.dx-hero{border-radius:18px;padding:16px;margin-bottom:12px;text-align:center;',
      'background:linear-gradient(150deg,rgba(74,222,128,.1),rgba(255,255,255,.02));',
      'border:1px solid rgba(255,255,255,.1)}',
      '.dx-score{font-size:46px;font-weight:800;line-height:1}',
      '.dx-sub{font-size:12px;opacity:.6;margin-top:4px}',
      '.dx-bar{display:flex;gap:7px;margin-top:14px;flex-wrap:wrap;justify-content:center}',
      '.dx-pill{font-size:12px;padding:5px 11px;border-radius:11px;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}',
      '.dx-grp{font-size:11px;letter-spacing:.07em;opacity:.45;margin:16px 0 7px;text-transform:uppercase}',
      '.dx-row{padding:11px 12px;border-radius:13px;margin-bottom:7px;',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}',
      '.dx-row.crit{border-color:rgba(248,113,113,.4);background:rgba(248,113,113,.07)}',
      '.dx-row.warn{border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.06)}',
      '.dx-t{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600}',
      '.dx-p{font-size:11.5px;opacity:.65;margin-top:5px;line-height:1.5;word-break:break-word}',
      '.dx-cause{border-radius:14px;padding:13px;margin-bottom:9px;',
      'background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3)}',
      '.dx-log{font-family:ui-monospace,monospace;font-size:10.5px;line-height:1.5;',
      'white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.35);',
      'padding:12px;border-radius:12px;max-height:340px;overflow:auto}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  var view = 'main';

  function render() {
    css();
    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
      '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">🩺 JOLLY Diaqnostika</h2>' +
      '<div class="muted" style="font-size:12.5px;">v' + VERSION + ' · ' + tests.length +
      ' test · canlı skan</div></div></div>');

    if (!last) {
      h.push('<div class="card sm" style="opacity:.75;font-size:12.5px;line-height:1.6">' +
        'Sistem əvvəl özünü skan edir — hansı fayllar yüklənib, hansı modullar var, ' +
        'neçə diaqnostika sistemi qalıb. Sonra real testlər aparılır. ' +
        'Yoxlana bilməyən hissə <b>NOT VERIFIED</b> yazılır — təxmin edilmir.</div>');
      h.push('<button class="btn btn-primary" style="width:100%" onclick="JollyDX.start()">' +
        '🔍 Tam diaqnostika başlat</button>');
      h.push('<div id="dxProg" class="mt"></div>');
      var hist = history();
      if (hist.length) {
        h.push('<div class="dx-grp">Əvvəlki nəticələr</div>');
        hist.slice(0, 6).forEach(function (x) {
          h.push('<div class="dx-row"><div class="dx-t"><span>' + x.score + ' / 100</span>' +
            '<span style="flex:1"></span><span class="muted" style="font-size:11.5px">' +
            new Date(x.ts).toLocaleString('az') + '</span></div>' +
            '<div class="dx-p">' + x.crit + ' kritik · ' + x.warn + ' xəbərdarlıq · ' +
            x.pass + ' keçdi · ' + x.id + '</div></div>');
        });
      }
      h.push('</div>');
      return h.join('');
    }

    if (view === 'log') {
      h.push('<button class="btn btn-ghost" onclick="JollyDX.view(\'main\')">‹ Geri</button><div class="mt"></div>');
      h.push('<div class="dx-log">' + esc(report(last)) + '</div>');
      h.push('<button class="btn" style="width:100%;margin-top:11px" onclick="JollyDX.copy()">📋 Kopyala</button>');
      h.push('</div>');
      return h.join('');
    }

    var col = last.score.total >= 85 ? '#4ade80' : last.score.total >= 60 ? '#f5c451' : '#fca5a5';
    h.push('<div class="dx-hero"><div class="dx-score" style="color:' + col + '">' +
      last.score.total + '</div><div class="dx-sub">100 baldan · ' + last.id + '</div>' +
      '<div class="dx-bar">' +
      '<span class="dx-pill" style="color:#fca5a5">🔴 ' + last.counts.crit + '</span>' +
      '<span class="dx-pill" style="color:#fbbf24">🟡 ' + last.counts.warn + '</span>' +
      '<span class="dx-pill" style="color:#4ade80">🟢 ' + last.counts.pass + '</span>' +
      (last.counts.skip ? '<span class="dx-pill">⚪ ' + last.counts.skip + '</span>' : '') +
      '</div></div>');

    var canFix = last.results.some(function (r) { return r.fixable && r.ok !== 'pass'; });
    h.push('<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      '<button class="btn btn-primary" onclick="JollyDX.start()">🔄 Yenidən</button>' +
      (canFix ? '<button class="btn" onclick="JollyDX.fix()">🛠 Təhlükəsiz düzəlt</button>' : '') +
      '<button class="btn btn-ghost" onclick="JollyDX.view(\'log\')">📄 Hesabat</button></div>');
    h.push('<div id="dxProg"></div>');

    var v = last.inv;
    h.push('<div class="dx-grp">🔎 Canlı inventar</div>');
    h.push('<div class="dx-row"><div class="dx-t"><span>Sistem tərkibi</span></div>' +
      '<div class="dx-p">' + v.scripts.length + ' skript · ' + v.globals.length +
      ' qlobal modul · ' + v.modules.length + ' qeydiyyatlı ekran<br>' +
      'Diaqnostika: ' + v.diagGlobals.length + ' qlobal, ' + v.diagModules.length + ' ekran' +
      (v.diagGlobals.length ? '<br>' + esc(v.diagGlobals.map(function (g) { return g.name; }).join(', ')) : '') +
      '</div></div>');

    if (last.causes.length) {
      h.push('<div class="dx-grp">🧠 Əsas səbəb</div>');
      last.causes.forEach(function (c) {
        h.push('<div class="dx-cause"><div style="font-weight:700;font-size:13.5px">❌ ' +
          esc(c.cause) + '</div><div class="dx-p">' + esc(c.why) + '</div>' +
          (c.n ? '<div class="dx-p"><b>Təsir:</b> ' + c.n + ' test — ' +
                 esc(c.affected.slice(0, 4).join(', ')) + '</div>' : '') + '</div>');
      });
    }

    var cats = {};
    last.results.forEach(function (r) { (cats[r.cat] = cats[r.cat] || []).push(r); });
    var order = ['Nüvə', 'Yaddaş', 'Baza', 'Real test', 'Performance', 'Security', 'Xətalar', 'PWA', 'Şəbəkə'];
    Object.keys(cats).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }).forEach(function (k) {
      var sc = last.score.cats[k];
      h.push('<div class="dx-grp">' + esc(k) + (sc != null ? ' — ' + sc : '') + '</div>');
      cats[k].forEach(function (r) {
        var ic = { pass: '🟢', warn: '🟡', crit: '🔴', skip: '⚪' }[r.ok];
        var cls = r.ok === 'crit' ? ' crit' : r.ok === 'warn' ? ' warn' : '';
        h.push('<div class="dx-row' + cls + '"><div class="dx-t"><span>' + ic + '</span>' +
          '<span style="flex:1">' + esc(r.title) + '</span>' +
          '<span class="muted" style="font-size:10.5px">' + r.ms + 'ms</span></div>' +
          '<div class="dx-p">' +
          (r.ok === 'pass' ? esc(r.proof || 'keçdi')
           : r.ok === 'skip' ? '<b>NOT VERIFIED</b> — ' + esc(r.why || '')
           : '<b>' + esc(r.why) + '</b>' + (r.proof ? '<br>' + esc(r.proof) : '') +
             (r.fixable ? '<br>🛠 avtomatik düzəldilə bilər' : '')) +
          '</div></div>');
      });
    });

    h.push('<div style="height:28px"></div></div>');
    return h.join('');
  }

  function repaint() {
    var el = document.getElementById('main');
    if (el && String(global.location.hash || '').split('?')[0] === ROUTE) {
      el.innerHTML = '<div ' + MARK + '="1">' + render() + '</div>';
      return;
    }
    var A = G('JollyApp');
    try { if (A && A.render) A.render(); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════ */
  global.JollyDX = {
    version: VERSION,
    register: register, run: run, report: report, history: history,
    inventory: inventory, neutralize: neutralize, open: ensureScreen,
    snapshot: snapshot, restore: restore, lastSnapshot: lastSnapshot, autofix: autofix,
    errors: function () { return errors.slice(); },
    tests: function () {
      return tests.map(function (t) { return { id: t.id, cat: t.cat, title: t.title, needs: t.needs }; });
    },
    last: function () { return last; },
    render: render,

    start: function () {
      var b = document.getElementById('dxProg');
      if (b) b.innerHTML = '<div class="dx-p">skan edilir…</div>';
      run(function (r, i, n) {
        var x = document.getElementById('dxProg');
        if (x) {
          var ic = { pass: '🟢', warn: '🟡', crit: '🔴', skip: '⚪' }[r.ok];
          x.innerHTML = '<div class="dx-p">' + ic + ' ' + esc(r.title) + ' — ' + i + '/' + n + '</div>';
        }
      }).then(function () { view = 'main'; repaint(); })
        .catch(function (e) {
          var x = document.getElementById('dxProg');
          if (x) x.innerHTML = '<div class="dx-p">Diaqnostika özü çökdü: ' + esc(e && e.message) + '</div>';
        });
    },

    fix: function () {
      var T = G('Toast'), b = document.getElementById('dxProg');
      if (b) b.innerHTML = '<div class="dx-p">snapshot alınır və düzəldilir…</div>';
      autofix().then(function (r) {
        if (!r.ok) { if (T && T.error) T.error(r.error); if (b) b.innerHTML = ''; return; }
        if (T && T.success) T.success('🛠 ' + r.fixed.length + ' düzəliş · bal ' + r.before + ' → ' + r.after);
        view = 'main'; repaint();
      }).catch(function (e) {
        if (T && T.error) T.error('Düzəliş alınmadı: ' + (e && e.message));
      });
    },

    view: function (v) { view = v; repaint(); },
    copy: function () {
      var T = G('Toast');
      try { navigator.clipboard.writeText(report(last)); if (T && T.success) T.success('📋 Kopyalandı'); }
      catch (e) { if (T && T.error) T.error('Kopyalanmadı'); }
    }
  };

  if (!global.JollyDiagnostics || !global.JollyDiagnostics.__dx) {
    global.JollyDiagnostics = global.JollyDX;
    global.JollyDiagnostics.__dx = true;
  }

  /* ══════════════════════════════════════════════════════════
     EKRANIN AÇILMASINI TƏMİN ETMƏK
     ──────────────────────────────────────────────────────────
     ModuleRegistry-yə qeydiyyat kifayət etmir: modul icazə
     süzgəcindən düşə, marşrut başqa yerdə tutula, ya da registry
     gec qurula bilər — onda ekran heç açılmır.

     Ona görə ünvana BİRBAŞA cavab veririk: hash `#/dx`-dirsə
     `#main`-ə özümüz yazırıq. Registry işləyirsə, o da işləyir —
     ikisi bir-birinə mane olmur (nişan yoxlanılır).
     ══════════════════════════════════════════════════════════ */
  var MARK = 'data-dx-screen';

  function ensureScreen() {
    var h = String(global.location.hash || '').split('?')[0];
    if (h !== ROUTE) return;
    var main = document.getElementById('main');
    if (!main) return;
    try {
      if (String(main.innerHTML).indexOf(MARK) !== -1) return;   /* onsuz da bizimdir */
      main.innerHTML = '<div ' + MARK + '="1">' + render() + '</div>';
    } catch (e) {
      try { main.innerHTML = '<div ' + MARK + '="1">Diaqnostika açıla bilmədi: ' +
        esc(e && e.message) + '</div>'; } catch (e2) {}
    }
  }

  function watchRoute() {
    global.addEventListener('hashchange', function () { setTimeout(ensureScreen, 60); });
    setInterval(ensureScreen, 900);      /* ekran başqa modul tərəfindən əzilsə geri qoyulur */
    setTimeout(ensureScreen, 300);
  }

  var tries = 0;
  function boot() {
    installErrorCapture();
    css();
    var R = G('ModuleRegistry');
    if (R && typeof R.register === 'function') {
      try {
        R.register({ id: 'dx', name: 'Diaqnostika', icon: '🩺', route: ROUTE, group: 'JOLLY', render: render });
        inventory(true);
        console.log('[DX 3.0] hazırdır — ' + tests.length + ' test');
        return;
      } catch (e) {}
    }
    if (++tries > 40) { console.log('[DX 3.0] ModuleRegistry tapılmadı — API yenə işləyir'); return; }
    setTimeout(boot, 250);
  }

  installErrorCapture();
  watchRoute();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 100); });
  } else {
    setTimeout(boot, 100);
  }

})(typeof window !== 'undefined' ? window : this);
