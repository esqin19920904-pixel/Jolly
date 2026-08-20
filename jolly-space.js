/* ============================================================
   JOLLY Yaddaş Qoruyucusu — jolly-space.js
   v1.0  (2026-08-19)

   ────────────────────────────────────────────────────────────
   NİYƏ BU FAYL VAR

   Esqin aylardır deyir: "məhsula şəkil əlavə edirəm, yaddaşda
   qalmır, silinir."

   Diaqnostika səbəbi göstərdi: localStorage 4.41 MB idi (hədd
   təxminən 5 MB). Yeri tutanlar:

       jolly_archive_snap_2026-08-18   794 KB
       jolly_archive_snap_2026-08-14   755 KB
       jolly_archive_snap_2026-08-13   755 KB
       jolly_archive_snap_2026-08-12   755 KB

   Yəni dörd arxiv nüsxəsi ~3 MB. Kataloqda isə cəmi 4 mal.

   ★ ƏSAS TAPINTI: `db.js:120 emergencyFreeSpace()` yaddaş
   dolanda səbəti və tombstone-ları budayır, AMMA ARXİVLƏRƏ
   TOXUNMUR. Ona görə yer açılmır, `write()` false qaytarır və
   şəkil əlavə olunmuş kimi görünüb əslində SAXLANILMIR.

   ────────────────────────────────────────────────────────────
   BU FAYL NƏ EDİR

   1. Açılışda yaddaşı ölçür.
   2. Hədd keçilibsə köhnə arxiv nüsxələrini silir —
      ★ ƏN YENİSİ HƏMİŞƏ QALIR.
   3. Nə etdiyini açıq deyir, gizlətmir.
   4. `JollySpace.check()` ilə istənilən vaxt çağırıla bilər.

   db.js-ə TOXUNULMUR.
   ============================================================ */
(function (global) {
  'use strict';

  if (global.JollySpace) return;

  var LIMIT = 5 * 1024 * 1024;          /* brauzerin təxmini həddi */
  var DANGER = 3.6 * 1024 * 1024;       /* bu həddən sonra təmizləyirik */
  var LOG_KEY = 'jolly_space_log';

  function peek(n) {
    try {
      return new Function('try{return typeof ' + n + '!=="undefined"?' + n + ':null}catch(e){return null}')();
    } catch (e) { return null; }
  }
  function toast(m, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error) return T.error(m);
      if (T && kind === 'ok' && T.success) return T.success(m);
      if (T && T.info) return T.info(m);
    } catch (e) {}
    console.log('[Yaddaş]', m);
  }

  /* ══════════════════════════════════════════════════════════
     Ölçmə
     ══════════════════════════════════════════════════════════ */
  function scan() {
    var total = 0, items = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var n = (localStorage.getItem(k) || '').length + k.length;
        total += n;
        items.push({ k: k, n: n });
      }
    } catch (e) {}
    items.sort(function (a, b) { return b.n - a.n; });
    return { total: total, items: items, pct: Math.round(total / LIMIT * 100) };
  }

  function archives() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/^jolly_archive_snap/.test(k)) continue;
        out.push({ k: k, n: (localStorage.getItem(k) || '').length });
      }
    } catch (e) {}
    /* Ad tarixlə bitir — tərsinə sıralasaq ən yenisi birinci olur */
    out.sort(function (a, b) { return a.k < b.k ? 1 : -1; });
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     Təmizləmə — ən yeni arxiv HƏMİŞƏ qalır
     ══════════════════════════════════════════════════════════ */
  function trimArchives(force) {
    var arr = archives();
    if (arr.length < 2) return { freed: 0, removed: [] };

    var keep = arr[0];
    var old = arr.slice(1);
    var freed = 0, removed = [];

    for (var i = 0; i < old.length; i++) {
      try {
        localStorage.removeItem(old[i].k);
        freed += old[i].n;
        removed.push(old[i].k);
      } catch (e) {}
    }
    if (removed.length) {
      log('köhnə arxiv silindi: ' + removed.length + ' ədəd, ' +
          Math.round(freed / 1024) + ' KB · saxlanılan: ' + keep.k);
    }
    return { freed: freed, removed: removed, kept: keep.k };
  }

  function log(msg) {
    try {
      var l = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      l.unshift({ ts: Date.now(), msg: msg });
      localStorage.setItem(LOG_KEY, JSON.stringify(l.slice(0, 20)));
    } catch (e) {}
    console.log('[Yaddaş]', msg);
  }

  /* ══════════════════════════════════════════════════════════
     Yoxlama
     ══════════════════════════════════════════════════════════ */
  function check(silent) {
    var s = scan();
    if (s.total < DANGER) return { ok: true, mb: (s.total / 1048576).toFixed(2), pct: s.pct };

    var r = trimArchives();
    var after = scan();

    if (r.freed) {
      if (!silent) {
        toast('🧹 Yaddaş təmizləndi: ' + Math.round(r.freed / 1024) + ' KB boşaldı', 'ok');
      }
      return {
        ok: true, cleaned: true, freed: r.freed, removed: r.removed,
        mb: (after.total / 1048576).toFixed(2), pct: after.pct
      };
    }

    /* Təmizləyəcək arxiv yoxdursa — açıq xəbərdarlıq */
    if (!silent && after.total > 4.3 * 1024 * 1024) {
      var big = after.items.slice(0, 3).map(function (x) {
        return x.k + ' (' + Math.round(x.n / 1024) + ' KB)';
      }).join(', ');
      toast('⚠️ Yaddaş dolub (' + (after.total / 1048576).toFixed(2) +
            ' MB) — şəkil və dəyişikliklər saxlanmaya bilər. Ən böyükləri: ' + big, 'error');
    }
    return { ok: false, mb: (after.total / 1048576).toFixed(2), pct: after.pct,
             items: after.items.slice(0, 6) };
  }

  /* ══════════════════════════════════════════════════════════
     ★ YAZMANIN DOĞRUDAN BAŞ TUTDUĞUNU YOXLAMAQ
     `db.js write()` uğursuz olanda false qaytarır, amma
     `Products.update()` yenə də qeyd qaytarır — ona görə
     çağıran tərəf "yazıldı" sanır. Bu funksiya həqiqəti deyir.
     ══════════════════════════════════════════════════════════ */
  function verify(productId, expectImage) {
    var d = global.JollyDB || peek('JollyDB');
    try {
      var list = (d && d.Products && d.Products.all) ? d.Products.all() : [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === productId) {
          if (!expectImage) return true;
          return (list[i].images || []).indexOf(expectImage) !== -1;
        }
      }
    } catch (e) {}
    return false;
  }

  /* Yer varmı — yazmazdan əvvəl soruşmaq üçün */
  function room(bytes) {
    var s = scan();
    return (s.total + (bytes || 0)) < DANGER;
  }

  global.JollySpace = {
    version: '1.0',
    scan: scan,
    check: check,
    archives: archives,
    trimArchives: trimArchives,
    verify: verify,
    room: room,
    log: function () {
      try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; }
    },
    mb: function () { return (scan().total / 1048576).toFixed(2); }
  };

  /* Açılışda bir dəfə — səssiz, amma iş görür */
  function boot() {
    var r = check(false);
    console.log('[Yaddaş] ' + r.mb + ' MB · ' + r.pct + '%' +
                (r.cleaned ? ' · təmizləndi' : ''));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 900); });
  } else {
    setTimeout(boot, 900);
  }

})(typeof window !== 'undefined' ? window : this);
