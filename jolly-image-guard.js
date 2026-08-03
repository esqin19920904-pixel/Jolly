/* ============================================================
   JOLLY Şəkil Qoruyucusu — jolly-image-guard.js
   (2026-08-03)

   ────────────────────────────────────────────────────────────
   PROBLEM ("şəkillər silinir"):

   products.js-də şəkil YADDA SAXLAMADAN ƏVVƏL fiziki silinir:

     • removeImage(i)        (sətir ~2815)
         Redaktə formasında şəklin ✕ düyməsinə basan kimi
         JollyStorage.deleteImage(ref) çağırılır — həm IndexedDB-dən,
         həm Firebase Storage-dan DƏRHAL silinir. Sonra "Geri" desən
         və ya proqram yenilənsə, məhsulun qeydində həmin ref hələ də
         durur, amma faylın özü artıq yoxdur → şəkil itir.

     • rotateImageAt(i)      (sətir ~2862)
     • cleanImageAt(i)       (sətir ~2909)
         Döndərilmiş / təmizlənmiş yeni nüsxə yaradılır, KÖHNƏSİ
         dərhal silinir. Formanı saxlamasan — köhnə ref qeyddə qalır,
         faylı isə yoxdur.

     • deleteDraft(id)       (sətir ~1681)
         Qaralamanın şəkillərini silir. Həmin ref başqa yerə
         köçürülübsə, orada da şəkil ölür.

   ────────────────────────────────────────────────────────────
   HƏLL — GECİKMİŞ SİLMƏ (products.js-ə TOXUNULMUR):

   JollyStorage.deleteImage() sarğılanır. Artıq dərhal silmir:
     1) ref "gözləmə siyahısına" (jolly_img_trash) tarixlə yazılır
     2) hər açılışda süpürgə işləyir:
          • ref hələ də hansısa məhsulda / qaralamada / səbətdə
            istifadə olunursa → siyahıdan çıxarılır (XİLAS OLUNUR)
          • istifadə olunmursa və 7 gün keçibsə → ƏSL silmə
   Yəni səhv basma, yarımçıq redaktə, ləğv edilmiş döndərmə —
   heç biri artıq şəkli öldürmür.

   Ekran: 🖼 Şəkil Qoruyucusu  (#/image-guard)
   İcazə açarı: images.guard.manage

   GERİ QAYTARMA:  JollyImageGuard.disable()
   ============================================================ */
(function (global) {
  'use strict';

  var TRASH_KEY = 'jolly_img_trash';
  var OFF_KEY   = 'jolly_img_guard_off';
  var PERM_KEY  = 'images.guard.manage';
  var ROUTE     = '#/image-guard';
  var GRACE_MS  = 7 * 24 * 60 * 60 * 1000;   // 7 gün

  function peek(name) {
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }
  function toast(msg, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error)   return T.error(msg);
      if (T && kind === 'ok'    && T.success) return T.success(msg);
      if (T && T.info) return T.info(msg);
    } catch (e) {}
    console.log('[ImageGuard]', msg);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function on() {
    try { return localStorage.getItem(OFF_KEY) !== '1'; } catch (e) { return true; }
  }

  /* ── gözləmə siyahısı: { ref: timestamp } ───────────────── */
  function trash() {
    try {
      var v = JSON.parse(localStorage.getItem(TRASH_KEY) || '{}');
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    } catch (e) { return {}; }
  }
  function saveTrash(t) {
    try { localStorage.setItem(TRASH_KEY, JSON.stringify(t)); } catch (e) {}
  }

  /* ── hansı ref-lər HƏLƏ İSTİFADƏDƏDİR ───────────────────── */
  function usedRefs() {
    var set = {};
    var DB = global.JollyDB || peek('JollyDB');
    if (!DB) return set;

    function eat(list) {
      if (!list || !list.length) return;
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!it || !it.images || !it.images.length) continue;
        for (var j = 0; j < it.images.length; j++) {
          var r = it.images[j];
          if (typeof r === 'string' && r) set[r] = 1;
        }
      }
    }
    try { if (DB.Products && DB.Products.all) eat(DB.Products.all()); } catch (e) {}
    try { if (DB.Drafts   && DB.Drafts.all)   eat(DB.Drafts.all()); }   catch (e) {}
    try { if (DB.Trash    && DB.Trash.all)    eat(DB.Trash.all()); }    catch (e) {}
    return set;
  }

  /* Eyni şəkil "idb:key" və "idb:key|fbs:path" kimi iki formada
     yazıla bilər — müqayisəni idb açarına görə də aparırıq */
  function idbKeyOf(ref) {
    if (!ref || typeof ref !== 'string') return null;
    var parts = ref.split('|');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].indexOf('idb:') === 0) return parts[i].slice(4);
    }
    return null;
  }
  function isUsed(ref, used) {
    if (used[ref]) return true;
    var k = idbKeyOf(ref);
    if (!k) return false;
    for (var u in used) { if (idbKeyOf(u) === k) return true; }
    return false;
  }

  /* ── sarğı ──────────────────────────────────────────────── */
  var _origDelete = null;

  function installWrap() {
    var S = global.JollyStorage || peek('JollyStorage');
    if (!S || typeof S.deleteImage !== 'function') return false;
    if (S.deleteImage.__jig) return true;

    _origDelete = S.deleteImage.bind(S);
    var wrapped = function (ref) {
      if (!on()) return _origDelete(ref);
      if (!ref) return Promise.resolve();
      var t = trash();
      if (!t[ref]) { t[ref] = Date.now(); saveTrash(t); }
      console.log('[ImageGuard] silmə təxirə salındı:', ref);
      return Promise.resolve();
    };
    wrapped.__jig = true;
    S.deleteImage = wrapped;
    if (!global.JollyStorage) { try { global.JollyStorage = S; } catch (e) {} }
    return true;
  }

  /* ── süpürgə ────────────────────────────────────────────── */
  function sweep(force) {
    var t = trash();
    var refs = Object.keys(t);
    var res = { rescued: 0, deleted: 0, waiting: 0 };
    if (!refs.length) return Promise.resolve(res);

    var used = usedRefs();
    var now = Date.now();
    var jobs = [];

    for (var i = 0; i < refs.length; i++) {
      var ref = refs[i];
      if (isUsed(ref, used)) {          // hələ istifadədədir → XİLAS
        delete t[ref]; res.rescued++;
        continue;
      }
      var age = now - (t[ref] || now);
      if (force || age > GRACE_MS) {    // sahibsizdir və vaxtı keçib → əsl silmə
        (function (r) {
          jobs.push(Promise.resolve().then(function () {
            if (_origDelete) return _origDelete(r);
          }).catch(function () {}));
        })(ref);
        delete t[ref]; res.deleted++;
      } else {
        res.waiting++;
      }
    }
    saveTrash(t);
    return Promise.all(jobs).then(function () { return res; });
  }

  /* ══════════════════════════════════════════════════════════
     YOXLAMA — qeyddəki ref-ləri IndexedDB-nin ƏSL məzmunu ilə
     tutuşdurur. Cavab verir: şəkillər tək-tək itir, yoxsa hamısı
     birdən gedib (yəni IndexedDB-nin özü boşalıb)?
     ══════════════════════════════════════════════════════════ */
  var AUDIT = null;   // son nəticə

  function openImagesDB() {
    return new Promise(function (res, rej) {
      try {
        var req = indexedDB.open('jolly_images_db', 1);
        req.onsuccess = function () { res(req.result); };
        req.onerror = function () { rej(req.error); };
        req.onupgradeneeded = function () { /* anbar yoxdursa boş qalır */ };
      } catch (e) { rej(e); }
    });
  }

  function idbAllKeys() {
    return openImagesDB().then(function (db) {
      return new Promise(function (res) {
        try {
          if (!db.objectStoreNames.contains('images')) { res([]); return; }
          var tx = db.transaction('images', 'readonly');
          var rq = tx.objectStore('images').getAllKeys();
          rq.onsuccess = function () { res(rq.result || []); };
          rq.onerror = function () { res([]); };
        } catch (e) { res([]); }
      });
    }).catch(function () { return []; });
  }

  function audit() {
    var DB = global.JollyDB || peek('JollyDB');
    var rows = [];
    function eat(list, kind) {
      if (!list || !list.length) return;
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!it || !it.images || !it.images.length) continue;
        for (var j = 0; j < it.images.length; j++) {
          var r = it.images[j];
          if (typeof r === 'string' && r) {
            rows.push({ ref: r, name: it.name || it.id || '?', kind: kind, key: idbKeyOf(r), fbs: r.indexOf('fbs:') !== -1 });
          }
        }
      }
    }
    try { if (DB && DB.Products && DB.Products.all) eat(DB.Products.all(), 'məhsul'); } catch (e) {}
    try { if (DB && DB.Drafts   && DB.Drafts.all)   eat(DB.Drafts.all(),   'qaralama'); } catch (e) {}
    try { if (DB && DB.Trash    && DB.Trash.all)    eat(DB.Trash.all(),    'səbət'); } catch (e) {}

    return idbAllKeys().then(function (keys) {
      var have = {}, i;
      for (i = 0; i < keys.length; i++) have[String(keys[i])] = 1;

      var okCount = 0, missing = [], cloudOnly = [], plain = 0;
      for (i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r.key) {                       // data: və ya yalnız fbs:
          if (r.fbs) cloudOnly.push(r); else plain++;
          continue;
        }
        if (have[r.key]) okCount++;
        else if (r.fbs) cloudOnly.push(r);  // yerli yoxdur, buludda var
        else missing.push(r);               // ƏSL İTKİ
      }

      /* IDB-də olan, amma heç bir qeyddə istifadə olunmayan açarlar */
      var used = {};
      for (i = 0; i < rows.length; i++) if (rows[i].key) used[rows[i].key] = 1;
      var orphan = 0;
      for (i = 0; i < keys.length; i++) {
        var k = String(keys[i]);
        if (k.indexOf('_thumb') !== -1) continue;   // kiçik nüsxələr
        if (!used[k]) orphan++;
      }

      AUDIT = {
        at: Date.now(),
        refs: rows.length, ok: okCount, plain: plain,
        missing: missing, cloudOnly: cloudOnly,
        idbKeys: keys.length, orphan: orphan
      };
      return AUDIT;
    });
  }

  /* ── ekran ──────────────────────────────────────────────── */
  function can(perm) {
    var UM = global.JollyUserMode;
    if (UM && UM.can) return UM.can(perm);
    var POS = global.POS || peek('POS');
    if (!POS || !POS.can) return true;
    try { return !!POS.can(perm); } catch (e) { return true; }
  }

  function render() {
    var sess = null;
    try { sess = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); } catch (e) {}
    if (sess && sess.role !== 'admin' && !can(PERM_KEY)) {
      return '<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>';
    }
    var t = trash();
    var refs = Object.keys(t);
    var used = usedRefs();
    var now = Date.now();
    var rescue = 0, ready = 0, wait = 0, i;
    for (i = 0; i < refs.length; i++) {
      if (isUsed(refs[i], used)) rescue++;
      else if (now - t[refs[i]] > GRACE_MS) ready++;
      else wait++;
    }

    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
             '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">🖼 Şəkil Qoruyucusu</h2>' +
             '<div class="muted" style="font-size:12.5px;">Şəkil dərhal silinmir — 7 gün gözləyir</div>' +
           '</div></div>');

    h.push('<div class="glass" style="padding:14px;margin:12px 0;font-size:13px;line-height:1.6;">' +
             'Redaktə formasında ✕, döndərmə və fon təmizləmə əvvəllər şəkli <b>yadda saxlamadan əvvəl</b> silirdi. ' +
             'İndi silmə təxirə salınır: şəkil hələ hansısa məhsulda istifadə olunursa, avtomatik <b>xilas edilir</b>.' +
           '</div>');

    h.push('<div class="glass" style="padding:14px;margin-bottom:10px;">' +
             '<div style="display:flex;justify-content:space-between;padding:6px 0;"><span>🛟 Xilas ediləcək (hələ istifadədə)</span><b>' + rescue + '</b></div>' +
             '<div style="display:flex;justify-content:space-between;padding:6px 0;"><span>⏳ Gözləyir (7 gün dolmayıb)</span><b>' + wait + '</b></div>' +
             '<div style="display:flex;justify-content:space-between;padding:6px 0;"><span>🗑 Silinməyə hazır (sahibsiz)</span><b>' + ready + '</b></div>' +
             '<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,.08);margin-top:4px;"><span>Cəmi</span><b>' + refs.length + '</b></div>' +
           '</div>');

    /* ── yoxlama nəticəsi ── */
    h.push('<div class="section-title" style="margin-top:6px;">Şəkil yoxlaması</div>');
    if (!AUDIT) {
      h.push('<div class="glass" style="padding:14px;margin-bottom:10px;font-size:12.5px;line-height:1.6;">' +
               'Qeyddəki şəkil ünvanlarını IndexedDB-nin əsl məzmunu ilə tutuşdurur — ' +
               'şəkillərin tək-tək itdiyini, yoxsa anbarın bütöv boşaldığını göstərir.' +
               '<div style="margin-top:10px;"><button class="btn btn-primary" onclick="JollyImageGuard.auditNow()">🔍 İndi yoxla</button></div>' +
             '</div>');
    } else {
      var verdict, vcolor;
      if (AUDIT.refs === 0) { verdict = 'Heç bir şəkil qeydi yoxdur'; vcolor = '#9ca3af'; }
      else if (AUDIT.missing.length === 0) { verdict = '✅ Bütün şəkillər yerindədir'; vcolor = '#4ade80'; }
      else if (AUDIT.ok === 0 && AUDIT.idbKeys === 0) { verdict = '⚠️ ANBAR TAM BOŞDUR — hamısı birdən gedib'; vcolor = '#fca5a5'; }
      else { verdict = '⚠️ ' + AUDIT.missing.length + ' şəkil itib (tək-tək)'; vcolor = '#fbbf24'; }

      h.push('<div class="glass" style="padding:14px;margin-bottom:10px;">' +
               '<div style="font-size:14px;font-weight:600;color:' + vcolor + ';margin-bottom:10px;">' + verdict + '</div>' +
               '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;"><span>Qeyddəki şəkil ünvanı</span><b>' + AUDIT.refs + '</b></div>' +
               '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;"><span>Yerli anbarda tapıldı</span><b>' + AUDIT.ok + '</b></div>' +
               '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;"><span>☁️ Yalnız buludda (bərpa oluna bilər)</span><b>' + AUDIT.cloudOnly.length + '</b></div>' +
               '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;"><span>❌ Tapılmadı</span><b style="color:#fca5a5;">' + AUDIT.missing.length + '</b></div>' +
               '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;border-top:1px solid rgba(255,255,255,.08);margin-top:4px;"><span>IndexedDB-dəki fayl sayı</span><b>' + AUDIT.idbKeys + '</b></div>' +
               '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;"><span>Sahibsiz fayl (yer yeyir)</span><b>' + AUDIT.orphan + '</b></div>' +
               '<div style="margin-top:10px;"><button class="btn" onclick="JollyImageGuard.auditNow()">🔄 Yenidən yoxla</button></div>' +
             '</div>');

      if (AUDIT.missing.length) {
        h.push('<div class="glass" style="padding:10px 14px;margin-bottom:10px;">' +
               '<div class="muted" style="font-size:11.5px;margin-bottom:6px;">İtən şəkillərin sahibləri:</div>');
        for (i = 0; i < Math.min(AUDIT.missing.length, 25); i++) {
          h.push('<div style="font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);">' +
                 '❌ ' + esc(AUDIT.missing[i].name) + ' <span style="opacity:.45;">(' + AUDIT.missing[i].kind + ')</span></div>');
        }
        if (AUDIT.missing.length > 25) h.push('<div style="font-size:11.5px;opacity:.5;padding-top:6px;">… və daha ' + (AUDIT.missing.length - 25) + '</div>');
        h.push('</div>');
      }
    }

    h.push('<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' +
             '<button class="btn btn-primary" onclick="JollyImageGuard.rescueNow()">🛟 İstifadədə olanları xilas et</button>' +
             '<button class="btn" onclick="JollyImageGuard.sweepNow()">🧹 Süpür (7 gün qaydası ilə)</button>' +
             '<button class="btn" onclick="JollyImageGuard.clearList()">↩ Siyahını boşalt</button>' +
           '</div>');

    h.push('<div class="glass" style="padding:12px 14px;font-size:12px;line-height:1.6;opacity:.75;">' +
             'Qoruyucu ' + (on() ? '<b style="color:#4ade80;">AÇIQDIR</b>' : '<b style="color:#fca5a5;">SÖNÜLÜDÜR</b>') + '. ' +
             'Konsoldan: <code>JollyImageGuard.disable()</code> / <code>JollyImageGuard.enable()</code>' +
           '</div>');

    if (refs.length) {
      h.push('<div class="section-title" style="margin-top:16px;">Siyahı</div>');
      h.push('<div class="glass" style="padding:6px 12px;">');
      for (i = 0; i < Math.min(refs.length, 60); i++) {
        var r = refs[i];
        var st = isUsed(r, used) ? '🛟' : (now - t[r] > GRACE_MS ? '🗑' : '⏳');
        var days = Math.floor((now - t[r]) / 86400000);
        h.push('<div style="display:flex;gap:9px;align-items:center;padding:8px 0;font-size:11.5px;' +
                 'border-bottom:1px solid rgba(255,255,255,.05);">' +
                 '<span>' + st + '</span>' +
                 '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
                 'font-family:ui-monospace,monospace;opacity:.7;">' + esc(r) + '</span>' +
                 '<span style="opacity:.5;">' + days + ' gün</span>' +
               '</div>');
      }
      if (refs.length > 60) h.push('<div style="padding:8px 0;font-size:11.5px;opacity:.5;">… və daha ' + (refs.length - 60) + '</div>');
      h.push('</div>');
    }

    h.push('<div style="height:30px;"></div></div>');
    return h.join('');
  }

  function refresh() {
    var el = document.getElementById('main');
    if (el && String(global.location.hash || '') === ROUTE) { el.innerHTML = render(); return; }
    var A = global.JollyApp || peek('JollyApp');
    try { if (A && A.render) A.render(); } catch (e) {}
  }

  /* ── API ────────────────────────────────────────────────── */
  global.JollyImageGuard = {
    render: render,
    sweep: sweep,
    audit: audit,
    auditNow: function () {
      toast('Yoxlanılır…');
      audit().then(function (a) {
        console.log('[ImageGuard] yoxlama:', a);
        refresh();
      }).catch(function (e) {
        toast('Yoxlama alınmadı: ' + (e && e.message), 'error');
      });
    },
    status: function () {
      var t = trash();
      return { on: on(), pending: Object.keys(t).length };
    },
    rescueNow: function () {
      sweep(false).then(function (r) {
        toast('🛟 ' + r.rescued + ' şəkil xilas edildi · ' + r.waiting + ' gözləyir', 'ok');
        refresh();
      });
    },
    sweepNow: function () {
      sweep(false).then(function (r) {
        toast('🧹 ' + r.rescued + ' xilas · ' + r.deleted + ' silindi · ' + r.waiting + ' gözləyir', 'ok');
        refresh();
      });
    },
    clearList: function () {
      saveTrash({});
      toast('Siyahı boşaldıldı — heç bir şəkil silinmədi', 'ok');
      refresh();
    },
    enable: function () {
      try { localStorage.removeItem(OFF_KEY); } catch (e) {}
      toast('Şəkil qoruyucusu açıldı', 'ok'); refresh();
    },
    disable: function () {
      try { localStorage.setItem(OFF_KEY, '1'); } catch (e) {}
      toast('Şəkil qoruyucusu söndürüldü — silmələr dərhal işləyəcək', 'ok'); refresh();
    }
  };

  /* ── qeydiyyat (STANDING RULE: hər yeni modul icazə ilə) ── */
  function registerPerm() {
    var POS = global.POS || peek('POS');
    if (!POS || typeof POS.register !== 'function') return false;
    try {
      POS.register({
        id: 'imageguard', name: 'Şəkil Qoruyucusu', icon: '🖼',
        permissions: [{ key: PERM_KEY, label: 'Şəkil qoruyucusunu idarə et', tag: 'system', 'default': false }]
      });
      return true;
    } catch (e) { return false; }
  }
  function registerModule() {
    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    if (!MR || typeof MR.register !== 'function') return false;
    try {
      /* ⚠️ perm: QƏSDƏN VERİLMİR — bax jolly-user-mode.js-dəki izah.
         Registry perm-i olan modulu POS.can() false qaytaranda tam
         gizlədir; icazə yoxlaması render() içindədir. */
      MR.register({
        id: 'image-guard', name: 'Şəkil Qoruyucusu', icon: '🖼',
        route: ROUTE, group: 'JOLLY', render: render
      });
      return true;
    } catch (e) { return false; }
  }

  /* ── açılış ─────────────────────────────────────────────── */
  var tries = 0;
  function boot() {
    var ok1 = installWrap();
    var ok2 = registerPerm();
    var ok3 = registerModule();
    ++tries;
    if ((ok1 && ok2 && ok3) || tries > 40) {
      if (!ok1) console.warn('[ImageGuard] JollyStorage tapılmadı — sarğı qurulmadı');
      /* açılışda dərhal xilasetmə: yarımçıq qalmış silmələri geri qaytarır */
      setTimeout(function () {
        sweep(false).then(function (r) {
          if (r.rescued) console.log('[ImageGuard] ' + r.rescued + ' şəkil xilas edildi');
          if (r.deleted) console.log('[ImageGuard] ' + r.deleted + ' sahibsiz şəkil silindi');
        });
      }, 3000);
      return;
    }
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 80); });
  } else {
    setTimeout(boot, 80);
  }

})(typeof window !== 'undefined' ? window : this);
