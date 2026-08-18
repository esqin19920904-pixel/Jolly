/* ============================================================
   JOLLY DIAGNOSTICS ENGINE 2.0 — jolly-dx.js
   v2.0  (2026-08-18)

   ────────────────────────────────────────────────────────────
   NİYƏ BU FAYL VAR

   Auditdə tapıldı: JOLLY-də 13 ayrı diaqnostika faylı var
   (145 KB). Onlardan yalnız 5-i yüklənir, 8-i ÖLÜDÜR — repoda
   var, amma heç yerdən çağırılmır.

   Daha pisi — İKİ AD TOQQUŞMASI:
     · JollyBlackBox → jolly-blackbox.js VƏ jolly-diagnostics.js
     · JollyErrors   → jolly-blackbox.js VƏ jolly-selftest.js
   Hansı sonra yüklənirsə o birini əzir, ona görə xəta tutucusu
   təsadüfi işləyirdi.

   Üstəlik 24 başqa faylın içində dağınıq `selfTest` və
   `window.onerror` var — heç biri bir mərkəzə hesabat vermir.

   ────────────────────────────────────────────────────────────
   QAYDALAR (Esqinin tələbi)

   · "Diaqnostika uğursuz oldu" kimi ümumi mesaj QADAĞANDIR.
     Hər nəticənin konkret sübutu olmalıdır.
   · Yoxlaya bilmədiyimi "NOT VERIFIED" kimi göstərirəm —
     TƏXMİN ETMİRƏM.
   · Diaqnostika özü xəta versə, bu da tutulur:
     DIAGNOSTICS ERROR ≠ SYSTEM HEALTHY.
   · index.html-ə TOXUNULMUR. Köhnə sistemlər iş zamanı
     zərərsizləşdirilir (adlar üzərimizə götürülür).
   · Məlumata TOXUNULMUR. Real testlər öz sınaq malını yaradır
     və sonda onu təmizləyir.
   ============================================================ */
(function (global) {
  'use strict';

  if (global.JollyDX) return;

  var VERSION = '2.0';
  var ROUTE = '#/dx';
  var HIST_KEY = 'jolly_dx_history';
  var TEST_TAG = '__DX_TEST__';

  /* ══════════════════════════════════════════════════════════
     Köməkçilər
     ══════════════════════════════════════════════════════════ */
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
    var d = new Date();
    var r = Math.random().toString(16).slice(2, 6).toUpperCase();
    return 'JLY-DX-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
           '-' + pad(d.getHours()) + pad(d.getMinutes()) + '-' + r;
  }

  /* ══════════════════════════════════════════════════════════
     🚨 XƏTA YAZICISI
     Xəta baş verən ANDA tutulur — sonradan axtarmırıq.
     ══════════════════════════════════════════════════════════ */
  var errors = [];
  var MAX_ERR = 120;

  function record(kind, msg, meta) {
    try {
      var e = {
        ts: now(), kind: kind,
        msg: String(msg || '').slice(0, 400),
        file: (meta && meta.file) || '', line: (meta && meta.line) || 0,
        col: (meta && meta.col) || 0, stack: String((meta && meta.stack) || '').slice(0, 900)
      };
      /* Eyni xəta təkrarlanırsa sayğacı artırırıq, siyahını şişirtmirik */
      for (var i = errors.length - 1; i >= 0 && i > errors.length - 12; i--) {
        if (errors[i].msg === e.msg && errors[i].file === e.file && errors[i].line === e.line) {
          errors[i].n = (errors[i].n || 1) + 1;
          errors[i].ts = e.ts;
          return;
        }
      }
      e.n = 1;
      errors.push(e);
      if (errors.length > MAX_ERR) errors.shift();
    } catch (er) {}
  }

  function installErrorCapture() {
    if (global.__dxErr) return;
    global.__dxErr = true;

    var prevErr = global.onerror;
    global.onerror = function (msg, file, line, col, err) {
      record('error', msg, { file: file, line: line, col: col, stack: err && err.stack });
      if (typeof prevErr === 'function') { try { return prevErr.apply(this, arguments); } catch (e) {} }
      return false;
    };

    global.addEventListener('unhandledrejection', function (ev) {
      var r = ev && ev.reason;
      record('promise', (r && (r.message || r)) || 'Promise rədd edildi', { stack: r && r.stack });
    });

    /* console.error sarğısı — köhnə fayllar ora yazır */
    try {
      var ce = console.error;
      if (ce && !ce.__dx) {
        var wrapped = function () {
          try {
            var parts = [];
            for (var i = 0; i < arguments.length; i++) {
              var a = arguments[i];
              parts.push(a && a.message ? a.message : String(a));
            }
            record('console', parts.join(' '), { stack: (arguments[0] && arguments[0].stack) || '' });
          } catch (e) {}
          return ce.apply(console, arguments);
        };
        wrapped.__dx = true;
        console.error = wrapped;
      }
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     🔬 REGİSTR — hər modul öz testini bura qeyd edir
     ══════════════════════════════════════════════════════════ */
  var tests = [];

  function register(def) {
    if (!def || !def.id || typeof def.test !== 'function') return false;
    for (var i = 0; i < tests.length; i++) if (tests[i].id === def.id) { tests[i] = def; return true; }
    tests.push({
      id: def.id, cat: def.cat || 'Digər', title: def.title || def.id,
      severity: def.severity || 'warning', test: def.test, needs: def.needs || null
    });
    return true;
  }

  /* Nəticə qurucuları — hər biri SÜBUT tələb edir */
  function pass(proof, extra) { return Object.assign({ ok: 'pass', proof: proof || '' }, extra || {}); }
  function warn(why, proof, extra) { return Object.assign({ ok: 'warn', why: why, proof: proof || '' }, extra || {}); }
  function crit(why, proof, extra) { return Object.assign({ ok: 'crit', why: why, proof: proof || '' }, extra || {}); }
  function skip(why) { return { ok: 'skip', why: why || 'NOT VERIFIED' }; }

  /* ══════════════════════════════════════════════════════════
     TESTLƏR — 🧠 NÜVƏ / MODULLAR
     ══════════════════════════════════════════════════════════ */
  var CORE_MODULES = [
    ['JollyDB', ['Products']],
    ['JollyStorage', ['saveImage', 'getImage']],
    ['JollyRouter', ['go']],
    ['ModuleRegistry', ['register']],
    ['Toast', []],
    ['POS', []]
  ];

  register({
    id: 'core.modules', cat: 'Nüvə', title: 'Əsas modullar yüklənib', severity: 'critical',
    test: function () {
      var miss = [], have = [];
      for (var i = 0; i < CORE_MODULES.length; i++) {
        var nm = CORE_MODULES[i][0], fns = CORE_MODULES[i][1];
        var o = G(nm);
        if (!o) { miss.push(nm); continue; }
        var badFn = [];
        for (var j = 0; j < fns.length; j++) if (!o[fns[j]]) badFn.push(fns[j]);
        if (badFn.length) miss.push(nm + '.' + badFn.join('/'));
        else have.push(nm);
      }
      if (!miss.length) return pass(have.length + ' modul: ' + have.join(', '));
      return crit(miss.join(', ') + ' tapılmadı',
        'tapılan: ' + (have.join(', ') || 'heç biri'), { missing: miss });
    }
  });

  register({
    id: 'core.duplicates', cat: 'Nüvə', title: 'Ad toqquşması', severity: 'critical',
    test: function () {
      /* Auditdə tapılan bilinən toqquşmalar — canlı vəziyyəti yoxlayırıq */
      var known = {
        JollyBlackBox: ['jolly-blackbox.js', 'jolly-diagnostics.js'],
        JollyErrors: ['jolly-blackbox.js', 'jolly-selftest.js']
      };
      var hit = [];
      for (var k in known) if (G(k)) hit.push(k + ' (' + known[k].join(' + ') + ')');
      if (!hit.length) return pass('köhnə toqquşan adlar yüklü deyil');
      return warn('köhnə diaqnostika adları hələ canlıdır',
        hit.join('; ') + ' — hansı sonra yüklənsə o biri əzilir', { dupes: hit });
    }
  });

  register({
    id: 'core.scripts', cat: 'Nüvə', title: 'Yüklənən skriptlər', severity: 'warning',
    test: function () {
      var list = [];
      try {
        var els = document.getElementsByTagName('script');
        for (var i = 0; i < els.length; i++) {
          var s = els[i].getAttribute('src');
          if (s) list.push(String(s).split('/').pop().split('?')[0]);
        }
      } catch (e) { return skip('skript siyahısı oxunmadı'); }
      var dup = {}, dd = [];
      list.forEach(function (f) { dup[f] = (dup[f] || 0) + 1; });
      for (var f in dup) if (dup[f] > 1) dd.push(f + ' ×' + dup[f]);
      if (dd.length) return crit('eyni fayl iki dəfə yüklənir', dd.join(', '), { files: list });
      return pass(list.length + ' skript yüklənib', { files: list });
    }
  });

  /* ══════════════════════════════════════════════════════════
     TESTLƏR — 💾 YADDAŞ
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'storage.write', cat: 'Yaddaş', title: 'localStorage yazma/oxuma', severity: 'critical',
    test: function () {
      var k = '__dx_probe__', v = 'x' + now();
      try {
        localStorage.setItem(k, v);
        var back = localStorage.getItem(k);
        localStorage.removeItem(k);
        if (back !== v) return crit('yazılan dəyər geri oxunmadı', 'yazıldı: ' + v + ' · oxundu: ' + back);
        return pass('yazma və oxuma işləyir');
      } catch (e) {
        return crit('localStorage yazıla bilmir', String(e && e.message || e));
      }
    }
  });

  register({
    id: 'storage.size', cat: 'Yaddaş', title: 'Yaddaş həcmi', severity: 'warning',
    test: function () {
      var total = 0, big = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          var n = (localStorage.getItem(k) || '').length;
          total += n + k.length;
          if (n > 300000) big.push(k + ' (' + Math.round(n / 1024) + ' KB)');
        }
      } catch (e) { return skip('yaddaş sayıla bilmədi: ' + (e && e.message)); }
      var mb = (total / 1048576).toFixed(2);
      big.sort();
      if (total > 4300000) return crit('yaddaş dolmaq üzrədir (~5 MB hədd)', mb + ' MB · ən böyüklər: ' + big.join(', '), { big: big });
      if (big.length) return warn('bir neçə açar çox yer tutur', mb + ' MB · ' + big.join(', '), { big: big });
      return pass(mb + ' MB istifadə olunur');
    }
  });

  register({
    id: 'storage.corrupt', cat: 'Yaddaş', title: 'Korlanmış açar', severity: 'critical',
    test: function () {
      var bad = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          var v = localStorage.getItem(k) || '';
          var t = v.charAt(0);
          if (t !== '{' && t !== '[') continue;          /* JSON olmayanı yoxlamırıq */
          try { JSON.parse(v); } catch (e) { bad.push(k + ' (' + Math.round(v.length / 1024) + ' KB)'); }
        }
      } catch (e) { return skip('açarlar oxunmadı'); }
      if (bad.length) return crit(bad.length + ' açar yarımçıq/korlanıb', bad.join(', '), { keys: bad });
      return pass('bütün JSON açarlar düzgün oxunur');
    }
  });

  /* ══════════════════════════════════════════════════════════
     TESTLƏR — 📦 MƏHSUL BAZASI
     ══════════════════════════════════════════════════════════ */
  function products() {
    var d = G('JollyDB');
    try { return (d && d.Products && d.Products.all) ? (d.Products.all() || []) : null; }
    catch (e) { return null; }
  }

  register({
    id: 'db.read', cat: 'Baza', title: 'Baza oxunur', severity: 'critical',
    test: function () {
      var l = products();
      if (l === null) return crit('JollyDB.Products.all() çağırıla bilmədi', 'modul yoxdur və ya xəta verdi');
      return pass(l.length + ' məhsul oxundu');
    }
  });

  register({
    id: 'db.integrity', cat: 'Baza', title: 'Məhsulların bütövlüyü', severity: 'warning',
    test: function () {
      var l = products();
      if (l === null) return skip('baza oxunmadı');
      if (!l.length) return pass('baza boşdur — yoxlanacaq bir şey yoxdur');

      var noId = 0, noName = 0, dupId = {}, dupIdList = [], badImg = 0;
      var seen = {};
      for (var i = 0; i < l.length; i++) {
        var p = l[i] || {};
        if (!p.id) { noId++; continue; }
        if (seen[p.id]) { if (!dupId[p.id]) { dupId[p.id] = 1; dupIdList.push(p.id); } }
        seen[p.id] = 1;
        if (!String(p.name || '').trim()) noName++;
        var imgs = p.images || [];
        for (var j = 0; j < imgs.length; j++) {
          var r = String(imgs[j] || '');
          if (r && r.indexOf('idb:') !== 0 && r.indexOf('data:') !== 0 && r.indexOf('fbs:') !== 0 &&
              r.indexOf('http') !== 0) badImg++;
        }
      }
      var probs = [];
      if (noId) probs.push(noId + ' id-siz');
      if (dupIdList.length) probs.push(dupIdList.length + ' təkrar id');
      if (noName) probs.push(noName + ' adsız');
      if (badImg) probs.push(badImg + ' tanınmayan şəkil ünvanı');
      if (!probs.length) return pass(l.length + ' məhsulun hamısı sağlamdır');
      var sev = (noId || dupIdList.length) ? crit : warn;
      return sev(probs.join(', '), l.length + ' məhsuldan', { noId: noId, dup: dupIdList, noName: noName });
    }
  });

  register({
    id: 'db.dupbarcode', cat: 'Baza', title: 'Təkrar barkod', severity: 'warning',
    test: function () {
      var l = products();
      if (l === null) return skip('baza oxunmadı');
      var map = {}, dup = [];
      for (var i = 0; i < l.length; i++) {
        var bcs = (l[i] || {}).barcodes || [];
        for (var j = 0; j < bcs.length; j++) {
          var c = String(bcs[j] || '').trim();
          if (!c) continue;
          if (map[c]) { if (dup.indexOf(c) === -1) dup.push(c); }
          else map[c] = l[i].name || l[i].id;
        }
      }
      if (!dup.length) return pass('təkrar barkod yoxdur');
      /* Qovluq sistemi qəsdən eyni barkodu paylaşır — bunu ayırırıq */
      var qov = 0;
      try {
        var qs = JSON.parse(localStorage.getItem('jolly_qovluqlar') || '[]');
        for (var q = 0; q < qs.length; q++) if (dup.indexOf(String(qs[q].code)) !== -1) qov++;
      } catch (e) {}
      var real = dup.length - qov;
      if (real <= 0) return pass(dup.length + ' təkrar barkod var, hamısı qovluq sistemindəndir (normaldır)');
      return warn(real + ' barkod bir neçə malda təkrarlanır',
        dup.slice(0, 8).join(', ') + (dup.length > 8 ? '…' : ''), { dup: dup });
    }
  });

  /* ══════════════════════════════════════════════════════════
     🧪 REAL SSENARİ TESTİ
     Modulun "var" olması işlədiyini SÜBUT ETMİR. Ona görə
     əsl mal yaradıb bütün zənciri keçirik və sonda təmizləyirik.
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'flow.crud', cat: 'Real test', title: 'Yarat → tap → dəyiş → sil', severity: 'critical',
    test: function () {
      var d = G('JollyDB');
      if (!d || !d.Products || !d.Products.add) return skip('JollyDB.Products.add yoxdur');
      var P = d.Products;
      var code = '999' + String(now()).slice(-9);
      var name = TEST_TAG + ' ' + code;
      var steps = [], id = null;

      try {
        /* 1 — yarat */
        var made = P.add({ name: name, barcodes: [code], price: 1 });
        id = made && (made.id || made);
        if (!id) return crit('məhsul yaradıla bilmədi', 'Products.add() id qaytarmadı');
        steps.push('yaradıldı (' + id + ')');

        /* 2 — oxu */
        var all = P.all ? P.all() : [];
        var found = null;
        for (var i = 0; i < all.length; i++) if (all[i] && all[i].id === id) found = all[i];
        if (!found) { cleanup(P, id); return crit('yaradılan məhsul bazada tapılmadı', 'id: ' + id); }
        steps.push('bazada tapıldı');

        /* 3 — barkodla tap */
        if (P.findByBarcode) {
          var byBc = P.findByBarcode(code) || [];
          if (!byBc.length) { cleanup(P, id); return crit('barkodla tapılmadı', 'kod: ' + code); }
          steps.push('barkodla tapıldı');
        } else steps.push('findByBarcode yoxdur — NOT VERIFIED');

        /* 4 — dəyiş */
        if (P.update) {
          P.update(id, { price: 7 });
          var again = null, all2 = P.all ? P.all() : [];
          for (var j = 0; j < all2.length; j++) if (all2[j] && all2[j].id === id) again = all2[j];
          if (!again || Number(again.price) !== 7) {
            cleanup(P, id);
            return crit('dəyişiklik yadda qalmadı', 'qiymət 7 yazıldı, oxundu: ' + (again && again.price));
          }
          steps.push('dəyişdirildi');
        } else steps.push('update yoxdur — NOT VERIFIED');

        /* 5 — sil */
        cleanup(P, id);
        var all3 = P.all ? P.all() : [], still = false;
        for (var k = 0; k < all3.length; k++) if (all3[k] && all3[k].id === id) still = true;
        if (still) return warn('silinən məhsul hələ siyahıdadır', 'id: ' + id + ' — ' + steps.join(' → '));
        steps.push('silindi');

        return pass(steps.join(' → '));
      } catch (e) {
        if (id) cleanup(P, id);
        return crit('zəncir xəta verdi: ' + (e && e.message), steps.join(' → ') || 'ilk addımda');
      }
    }
  });

  function cleanup(P, id) {
    try { if (P.remove) return P.remove(id); } catch (e) {}
    try { if (P.delete) return P.delete(id); } catch (e) {}
    try { if (P.update) P.update(id, { deleted: true, name: TEST_TAG + ' (silinmiş)' }); } catch (e) {}
  }

  register({
    id: 'flow.leftovers', cat: 'Real test', title: 'Sınaq malı qalmayıb', severity: 'warning',
    test: function () {
      var l = products();
      if (l === null) return skip('baza oxunmadı');
      var left = l.filter(function (p) { return p && String(p.name || '').indexOf(TEST_TAG) === 0; });
      if (!left.length) return pass('sınaq malı qalmayıb');
      return warn(left.length + ' sınaq malı bazada qalıb',
        left.map(function (p) { return p.id; }).slice(0, 5).join(', '), { left: left.map(function (p) { return p.id; }) });
    }
  });

  /* ══════════════════════════════════════════════════════════
     TESTLƏR — 📱 PWA · 🔄 ŞƏBƏKƏ
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'pwa.sw', cat: 'PWA', title: 'Service Worker', severity: 'warning',
    test: function () {
      if (!('serviceWorker' in navigator)) return skip('brauzer dəstəkləmir');
      var c = navigator.serviceWorker.controller;
      if (!c) return warn('Service Worker idarəni almayıb', 'proqram quraşdırılmayıb və ya yenidir');
      return pass('aktivdir: ' + String(c.scriptURL || '').split('/').pop());
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
      return pass('quruludur: ' + B.endpoint());
    }
  });

  /* ══════════════════════════════════════════════════════════
     TESTLƏR — 🚨 XƏTALAR
     ══════════════════════════════════════════════════════════ */
  register({
    id: 'errors.runtime', cat: 'Xətalar', title: 'Tutulan xətalar', severity: 'critical',
    test: function () {
      if (!errors.length) return pass('açılışdan bəri xəta tutulmayıb');
      var top = errors.slice(-5).reverse().map(function (e) {
        return e.msg.slice(0, 70) + (e.file ? ' @ ' + String(e.file).split('/').pop() + ':' + e.line : '') +
               (e.n > 1 ? ' ×' + e.n : '');
      });
      return crit(errors.length + ' xəta tutulub', top.join(' | '), { errors: errors.slice(-20) });
    }
  });

  /* ══════════════════════════════════════════════════════════
     🧠 KÖK SƏBƏB
     15 xəta bir səbəbdən yaranırsa, onu 15 problem kimi
     göstərmirik.
     ══════════════════════════════════════════════════════════ */
  function rootCause(results) {
    var causes = [];
    var byId = {};
    results.forEach(function (r) { byId[r.id] = r; });

    var core = byId['core.modules'];
    if (core && core.ok === 'crit' && core.missing) {
      var affected = results.filter(function (r) {
        return r.ok !== 'pass' && r.id !== 'core.modules' &&
               (r.cat === 'Baza' || r.cat === 'Real test' || r.cat === 'Yaddaş');
      });
      causes.push({
        cause: core.missing.join(', ') + ' yüklənməyib',
        why: 'bu modullar olmadan baza və real testlər işləyə bilməz',
        affected: affected.map(function (r) { return r.title; }),
        n: affected.length
      });
    }

    var st = byId['storage.write'];
    if (st && st.ok === 'crit') {
      var aff2 = results.filter(function (r) {
        return r.ok !== 'pass' && (r.cat === 'Baza' || r.cat === 'Real test');
      });
      causes.push({
        cause: 'localStorage yazıla bilmir',
        why: 'bütün məlumat oraya yazılır — baza əməliyyatları da bundan asılıdır',
        affected: aff2.map(function (r) { return r.title; }), n: aff2.length
      });
    }

    var sz = byId['storage.size'];
    if (sz && sz.ok === 'crit') {
      causes.push({
        cause: 'yaddaş dolmaq üzrədir',
        why: 'brauzer yeni yazmanı rədd edə bilər — məlumat itkisi riski var',
        affected: (sz.big || []).slice(0, 4), n: (sz.big || []).length
      });
    }
    return causes;
  }

  /* ══════════════════════════════════════════════════════════
     📊 SAĞLAMLIQ BALI — real nəticələrdən
     ══════════════════════════════════════════════════════════ */
  function score(results) {
    var byCat = {};
    results.forEach(function (r) {
      if (r.ok === 'skip') return;                     /* yoxlanmayan bala təsir etmir */
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
     ▶ İCRA
     ══════════════════════════════════════════════════════════ */
  var last = null, running = false;

  function run(onStep) {
    if (running) return Promise.resolve(last);
    running = true;
    var results = [];
    var i = 0;

    function step() {
      if (i >= tests.length) return Promise.resolve();
      var t = tests[i++];
      var started = now();
      return Promise.resolve()
        .then(function () { return t.test(); })
        .catch(function (e) {
          /* ★ Diaqnostikanın ÖZÜ xəta versə — bu da nəticədir */
          return crit('TEST ÖZÜ ÇÖKDÜ: ' + (e && e.message), String(e && e.stack || '').slice(0, 300));
        })
        .then(function (r) {
          r = r || skip('test nəticə qaytarmadı');
          r.id = t.id; r.cat = t.cat; r.title = t.title; r.severity = t.severity;
          r.ms = now() - started;
          results.push(r);
          if (onStep) { try { onStep(r, i, tests.length); } catch (e) {} }
          return step();
        });
    }

    return step().then(function () {
      var s = score(results);
      var out = {
        id: diagId(), ts: now(), version: VERSION,
        results: results, score: s, causes: rootCause(results),
        counts: {
          crit: results.filter(function (r) { return r.ok === 'crit'; }).length,
          warn: results.filter(function (r) { return r.ok === 'warn'; }).length,
          pass: results.filter(function (r) { return r.ok === 'pass'; }).length,
          skip: results.filter(function (r) { return r.ok === 'skip'; }).length
        },
        env: envInfo()
      };
      last = out;
      running = false;
      saveHistory(out);
      return out;
    }).catch(function (e) {
      running = false;
      throw e;
    });
  }

  function envInfo() {
    var o = {};
    try {
      o.ua = navigator.userAgent.slice(0, 120);
      o.online = navigator.onLine !== false;
      o.standalone = !!(global.matchMedia && global.matchMedia('(display-mode: standalone)').matches);
      o.lang = navigator.language;
      o.screen = (global.screen ? global.screen.width + '×' + global.screen.height : '?');
    } catch (e) {}
    return o;
  }

  function saveHistory(out) {
    try {
      var h = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
      h.unshift({
        id: out.id, ts: out.ts, score: out.score.total,
        crit: out.counts.crit, warn: out.counts.warn, pass: out.counts.pass
      });
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
    var d = new Date(out.ts);
    var L = [];
    L.push('JOLLY DIAGNOSTICS REPORT v' + out.version);
    L.push(d.toLocaleString('az'));
    L.push('ID: ' + out.id);
    L.push('');
    L.push('SİSTEM');
    L.push('  ' + (out.env.ua || '?'));
    L.push('  Ekran: ' + (out.env.screen || '?') + ' · Onlayn: ' + (out.env.online ? 'bəli' : 'xeyr') +
           ' · Quraşdırılıb: ' + (out.env.standalone ? 'bəli' : 'xeyr'));
    L.push('');
    L.push('SAĞLAMLIQ: ' + out.score.total + ' / 100');
    for (var c in out.score.cats) L.push('  ' + c + ': ' + out.score.cats[c]);
    L.push('');
    L.push('NƏTİCƏ: ' + out.counts.crit + ' kritik · ' + out.counts.warn + ' xəbərdarlıq · ' +
           out.counts.pass + ' keçdi · ' + out.counts.skip + ' yoxlanmadı');
    if (out.causes.length) {
      L.push('');
      L.push('ƏSAS SƏBƏBLƏR');
      out.causes.forEach(function (c, i) {
        L.push('  ' + (i + 1) + '. ' + c.cause);
        L.push('     səbəb: ' + c.why);
        if (c.n) L.push('     təsir: ' + c.n + ' test — ' + c.affected.slice(0, 5).join(', '));
      });
    }
    L.push('');
    L.push('TAM SİYAHI');
    out.results.forEach(function (r) {
      var m = { pass: '[OK]  ', warn: '[XƏB] ', crit: '[KRİT]', skip: '[YOX] ' }[r.ok];
      L.push('  ' + m + ' ' + r.cat + ' / ' + r.title);
      if (r.ok === 'pass') { if (r.proof) L.push('        ' + r.proof); }
      else if (r.ok === 'skip') L.push('        NOT VERIFIED — ' + (r.why || ''));
      else {
        L.push('        problem: ' + r.why);
        if (r.proof) L.push('        sübut: ' + r.proof);
      }
    });
    return L.join('\n');
  }

  /* ══════════════════════════════════════════════════════════
     Köhnə sistemləri zərərsizləşdirmək
     index.html-ə toxunmadan: adları öz üzərimizə götürürük ki,
     iki fayl bir-birini əzməsin.
     ══════════════════════════════════════════════════════════ */
  function takeOver() {
    try {
      global.JollyErrors = {
        all: function () { return errors.slice(); },
        push: function (m, meta) { record('legacy', m, meta || {}); },
        clear: function () { errors.length = 0; },
        __dx: true
      };
      global.JollyBlackBox = {
        log: function (m) { record('legacy', m, {}); },
        errors: function () { return errors.slice(); },
        __dx: true
      };
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  function css() {
    if (document.getElementById('dx-css')) return;
    var st = document.createElement('style');
    st.id = 'dx-css';
    st.textContent = [
      '.dx-hero{border-radius:18px;padding:16px;margin-bottom:12px;text-align:center;',
      'background:linear-gradient(150deg,rgba(74,222,128,.1),rgba(255,255,255,.02));',
      'border:1px solid rgba(255,255,255,.1)}',
      '.dx-score{font-size:46px;font-weight:800;line-height:1}',
      '.dx-sub{font-size:12px;opacity:.6;margin-top:4px}',
      '.dx-bar{display:flex;gap:7px;margin:14px 0 0;flex-wrap:wrap;justify-content:center}',
      '.dx-pill{font-size:12px;padding:5px 11px;border-radius:11px;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}',
      '.dx-grp{font-size:11px;letter-spacing:.07em;opacity:.45;margin:16px 0 7px;text-transform:uppercase}',
      '.dx-row{padding:11px 12px;border-radius:13px;margin-bottom:7px;',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}',
      '.dx-row.crit{border-color:rgba(248,113,113,.4);background:rgba(248,113,113,.07)}',
      '.dx-row.warn{border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.06)}',
      '.dx-t{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600}',
      '.dx-t .ic{flex:none}',
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
      '<div class="muted" style="font-size:12.5px;">v' + VERSION + ' · ' + tests.length + ' test</div>' +
      '</div></div>');

    if (!last) {
      h.push('<div class="card sm" style="opacity:.75;font-size:12.5px;line-height:1.6">' +
        'Bütün yoxlamalar real məlumat üzərində aparılır. Sınaq malı yaradılır və sonda silinir. ' +
        'Yoxlana bilməyən hissə "NOT VERIFIED" kimi göstərilir — təxmin edilmir.</div>');
      h.push('<button class="btn btn-primary" style="width:100%" onclick="JollyDX.start()">' +
        '🔍 Tam diaqnostika başlat</button>');
      h.push('<div id="dxProg" class="mt"></div>');
      var hist = history();
      if (hist.length) {
        h.push('<div class="dx-grp">Əvvəlki nəticələr</div>');
        hist.slice(0, 6).forEach(function (x) {
          h.push('<div class="dx-row"><div class="dx-t">' +
            '<span>' + x.score + ' / 100</span>' +
            '<span style="flex:1"></span>' +
            '<span class="muted" style="font-size:11.5px">' +
              new Date(x.ts).toLocaleString('az') + '</span></div>' +
            '<div class="dx-p">' + x.crit + ' kritik · ' + x.warn + ' xəbərdarlıq · ' +
              x.pass + ' keçdi · ' + x.id + '</div></div>');
        });
      }
      h.push('</div>');
      return h.join('');
    }

    if (view === 'log') {
      h.push('<button class="btn btn-ghost" onclick="JollyDX.view(\'main\')">‹ Geri</button>');
      h.push('<div class="mt"></div>');
      h.push('<div class="dx-log">' + esc(report(last)) + '</div>');
      h.push('<button class="btn" style="width:100%;margin-top:11px" onclick="JollyDX.copy()">📋 Kopyala</button>');
      h.push('</div>');
      return h.join('');
    }

    var col = last.score.total >= 85 ? '#4ade80' : last.score.total >= 60 ? '#f5c451' : '#fca5a5';
    h.push('<div class="dx-hero">' +
      '<div class="dx-score" style="color:' + col + '">' + last.score.total + '</div>' +
      '<div class="dx-sub">100 baldan · ' + last.id + '</div>' +
      '<div class="dx-bar">' +
        '<span class="dx-pill" style="color:#fca5a5">🔴 ' + last.counts.crit + '</span>' +
        '<span class="dx-pill" style="color:#fbbf24">🟡 ' + last.counts.warn + '</span>' +
        '<span class="dx-pill" style="color:#4ade80">🟢 ' + last.counts.pass + '</span>' +
        (last.counts.skip ? '<span class="dx-pill">⚪ ' + last.counts.skip + '</span>' : '') +
      '</div></div>');

    h.push('<div class="row" style="display:flex;gap:8px;margin-bottom:12px">' +
      '<button class="btn btn-primary" onclick="JollyDX.start()">🔄 Yenidən</button>' +
      '<button class="btn btn-ghost" onclick="JollyDX.view(\'log\')">📄 Hesabat</button></div>');

    if (last.causes.length) {
      h.push('<div class="dx-grp">🧠 Əsas səbəb</div>');
      last.causes.forEach(function (c) {
        h.push('<div class="dx-cause"><div style="font-weight:700;font-size:13.5px">❌ ' + esc(c.cause) + '</div>' +
          '<div class="dx-p">' + esc(c.why) + '</div>' +
          (c.n ? '<div class="dx-p"><b>Təsir:</b> ' + c.n + ' test — ' +
                 esc(c.affected.slice(0, 4).join(', ')) + '</div>' : '') + '</div>');
      });
    }

    var cats = {};
    last.results.forEach(function (r) { (cats[r.cat] = cats[r.cat] || []).push(r); });
    var order = ['Nüvə', 'Yaddaş', 'Baza', 'Real test', 'Xətalar', 'PWA', 'Şəbəkə'];
    var keys = Object.keys(cats).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    keys.forEach(function (k) {
      var sc = last.score.cats[k];
      h.push('<div class="dx-grp">' + esc(k) + (sc != null ? ' — ' + sc : '') + '</div>');
      cats[k].forEach(function (r) {
        var ic = { pass: '🟢', warn: '🟡', crit: '🔴', skip: '⚪' }[r.ok];
        var cls = r.ok === 'crit' ? ' crit' : r.ok === 'warn' ? ' warn' : '';
        h.push('<div class="dx-row' + cls + '">' +
          '<div class="dx-t"><span class="ic">' + ic + '</span>' +
            '<span style="flex:1">' + esc(r.title) + '</span>' +
            '<span class="muted" style="font-size:10.5px">' + r.ms + 'ms</span></div>' +
          '<div class="dx-p">' +
            (r.ok === 'pass' ? esc(r.proof || 'keçdi')
             : r.ok === 'skip' ? '<b>NOT VERIFIED</b> — ' + esc(r.why || '')
             : '<b>' + esc(r.why) + '</b>' + (r.proof ? '<br>' + esc(r.proof) : '')) +
          '</div></div>');
      });
    });

    h.push('<div style="height:28px"></div></div>');
    return h.join('');
  }

  function repaint() {
    var el = document.getElementById('main');
    if (el && String(global.location.hash || '').split('?')[0] === ROUTE) {
      el.innerHTML = render();
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
    register: register,
    run: run,
    report: report,
    history: history,
    errors: function () { return errors.slice(); },
    tests: function () { return tests.map(function (t) { return { id: t.id, cat: t.cat, title: t.title }; }); },
    last: function () { return last; },
    render: render,

    start: function () {
      var box = document.getElementById('dxProg');
      if (box) box.innerHTML = '<div class="dx-p">başlayır…</div>';
      run(function (r, i, n) {
        var b = document.getElementById('dxProg');
        if (b) {
          var ic = { pass: '🟢', warn: '🟡', crit: '🔴', skip: '⚪' }[r.ok];
          b.innerHTML = '<div class="dx-p">' + ic + ' ' + esc(r.title) + ' — ' + i + '/' + n + '</div>';
        }
      }).then(function () { view = 'main'; repaint(); })
        .catch(function (e) {
          var b = document.getElementById('dxProg');
          if (b) b.innerHTML = '<div class="dx-p">Diaqnostika özü çökdü: ' + esc(e && e.message) + '</div>';
        });
    },

    view: function (v) { view = v; repaint(); },

    copy: function () {
      var txt = report(last);
      try {
        navigator.clipboard.writeText(txt);
        var T = G('Toast'); if (T && T.success) T.success('📋 Hesabat kopyalandı');
      } catch (e) {
        var T2 = G('Toast'); if (T2 && T2.error) T2.error('Kopyalanmadı');
      }
    }
  };

  /* Köhnə ada da cavab veririk — başqa fayllar onu çağıra bilər */
  if (!global.JollyDiagnostics || !global.JollyDiagnostics.__dx) {
    global.JollyDiagnostics = global.JollyDX;
    global.JollyDiagnostics.__dx = true;
  }

  /* ══════════════════════════════════════════════════════════
     Açılış
     ══════════════════════════════════════════════════════════ */
  var tries = 0;
  function boot() {
    installErrorCapture();
    takeOver();
    css();
    var R = G('ModuleRegistry');
    if (R && typeof R.register === 'function') {
      try {
        R.register({
          id: 'dx', name: 'Diaqnostika', icon: '🩺',
          route: ROUTE, group: 'JOLLY', render: render
        });
        console.log('[DX] hazırdır — ' + tests.length + ' test');
        return;
      } catch (e) {}
    }
    if (++tries > 40) { console.log('[DX] ModuleRegistry tapılmadı — API yenə işləyir'); return; }
    setTimeout(boot, 250);
  }

  installErrorCapture();     /* dərhal — açılış xətalarını da tutaq */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 100); });
  } else {
    setTimeout(boot, 100);
  }

})(typeof window !== 'undefined' ? window : this);
