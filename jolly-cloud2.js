/* ============================================================
   JOLLY Bulud Körpüsü — jolly-cloud.js
   v1.0  (2026-08-19)

   ────────────────────────────────────────────────────────────
   NƏ EDİR

   JOLLY-nin öz serveri ilə (D1 + R2) danışır:
     · şəkli R2-yə yükləyir → ünvan qaytarır (itmir, yer tutmur)
     · məhsulları D1-ə göndərir və oradan alır
     · istifadəçiləri sinxronlaşdırır (kassir hesabı hər cihazda)

   ────────────────────────────────────────────────────────────
   ★ ƏSAS QAYDA — CİHAZ HƏMİŞƏ BİRİNCİDİR

   JOLLY yenə cihazdan oxuyur və cihaza yazır. Server İKİNCİ
   nüsxədir. İnternet kəsilsə proqram tam işləyir; internet
   gələndə fərq göndərilir.

   Bu, qəsdən belədir: kassada internet kəsiləndə iş dayanmamalıdır.

   ────────────────────────────────────────────────────────────
   ★ HEÇ NƏ SİLİNMİR

   Serverdən gələn mal cihazdakından YENİDİRSƏ yenilənir.
   Köhnədirsə toxunulmur. Silmə sinxronlaşdırılmır — səhvən
   silinmiş mal başqa cihazda qalır.
   ============================================================ */
(function (global) {
  'use strict';

  if (global.JollyCloud2) return;

  var PULLED_KEY = 'jolly_cloud_pulled';   /* buluddan gələn malların id-si */
  var LAST_PULL = 'jolly_cloud_since';
  var LAST_PUSH = 'jolly_cloud_pushed';
  var OFF_KEY = 'jolly_cloud_off';

  function peek(n) {
    try {
      return new Function('try{return typeof ' + n + '!=="undefined"?' + n + ':null}catch(e){return null}')();
    } catch (e) { return null; }
  }
  function G(n) { return global[n] || peek(n); }
  function DB() { return G('JollyDB'); }

  function toast(m, kind) {
    var T = G('Toast');
    try {
      if (T && kind === 'ok' && T.success) return T.success(m);
      if (T && kind === 'error' && T.error) return T.error(m);
      if (T && T.info) return T.info(m);
    } catch (e) {}
    console.log('[Bulud]', m);
  }

  function enabled() {
    try { return localStorage.getItem(OFF_KEY) !== '1'; } catch (e) { return true; }
  }
  function online() {
    try { return !global.navigator || global.navigator.onLine !== false; } catch (e) { return true; }
  }

  /* Server elə bu saytdadır — ünvan yazmağa ehtiyac yoxdur */
  function api(path) { return path; }

  function req(path, opt) {
    if (!enabled()) return Promise.resolve({ ok: false, error: 'bulud söndürülüb' });
    if (!online()) return Promise.resolve({ ok: false, error: 'internet yoxdur', offline: true });

    var ctrl = null, timer = null;
    opt = opt || {};
    try { ctrl = new AbortController(); } catch (e) {}
    if (ctrl) {
      opt.signal = ctrl.signal;
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 25000);
    }
    return fetch(api(path), opt)
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }); })
      .then(function (j) { if (timer) clearTimeout(timer); return j || { ok: false }; })
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        return { ok: false, error: (e && e.name === 'AbortError') ? 'gecikdi' : 'bağlantı yoxdur' };
      });
  }

  /* ══════════════════════════════════════════════════════════
     🖼 ŞƏKİL
     ══════════════════════════════════════════════════════════ */
  function uploadImage(file) {
    if (!file) return Promise.resolve(null);
    return req('/api/img', {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
      body: file
    }).then(function (j) { return (j && j.ok && j.url) ? j.url : null; });
  }

  /* ══════════════════════════════════════════════════════════
     📦 MƏHSULLAR
     ══════════════════════════════════════════════════════════ */
  function products() {
    var d = DB();
    try { return (d && d.Products && d.Products.all) ? (d.Products.all() || []) : []; }
    catch (e) { return []; }
  }

  function lastPush() {
    try { return Number(localStorage.getItem(LAST_PUSH) || 0); } catch (e) { return 0; }
  }
  function lastPull() {
    try { return Number(localStorage.getItem(LAST_PULL) || 0); } catch (e) { return 0; }
  }

  /* Cihazdan serverə — yalnız dəyişənlər */
  function push(all) {
    var since = all ? 0 : lastPush();
    var list = products().filter(function (p) {
      if (!p || !p.id) return false;
      var t = p.updatedAt || p.createdAt || 0;
      return all || t > since;
    });
    if (!list.length) return Promise.resolve({ ok: true, saved: 0, skipped: true });

    /* Böyük kataloq üçün hissə-hissə */
    var chunks = [];
    for (var i = 0; i < list.length; i += 200) chunks.push(list.slice(i, i + 200));

    var saved = 0;
    var run = function (n) {
      if (n >= chunks.length) {
        try { localStorage.setItem(LAST_PUSH, String(Date.now())); } catch (e) {}
        return { ok: true, saved: saved };
      }
      return req('/api/products/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: chunks[n].map(clean) })
      }).then(function (j) {
        if (!j || !j.ok) return { ok: false, error: (j && j.error) || 'göndərilmədi', saved: saved };
        saved += j.saved || 0;
        return run(n + 1);
      });
    };
    return Promise.resolve(run(0));
  }

  /* Serverə göndərməzdən əvvəl təmizləyirik — cihaza xas
     müvəqqəti sahələr getməsin */
  function clean(p) {
    var o = {};
    for (var k in p) {
      if (k.charAt(0) === '_') continue;
      o[k] = p[k];
    }
    if (!o.updatedAt) o.updatedAt = o.createdAt || Date.now();
    return o;
  }

  /* Serverdən cihaza — yalnız yenilər */
  function pull() {
    return req('/api/products?since=' + lastPull()).then(function (j) {
      if (!j || !j.ok) return { ok: false, error: (j && j.error) || 'alınmadı' };
      var list = j.products || [];
      if (!list.length) return { ok: true, added: 0, updated: 0 };

      var d = DB(), P = d && d.Products;
      if (!P) return { ok: false, error: 'baza yoxdur' };

      var have = {};
      products().forEach(function (p) { if (p && p.id) have[p.id] = p; });

      var added = 0, updated = 0;
      list.forEach(function (r) {
        if (r.deleted) return;                 /* silmə sinxronlaşdırılmır */
        var cur = have[r.id];
        if (!cur) {
          try {
            P.add(r); added++;
            markPulled(r.id);      /* ★ lazım olsa geri qaytarmaq üçün */
          } catch (e) {}
          return;
        }
        /* Yalnız server nüsxəsi YENİDİRSƏ */
        var mine = cur.updatedAt || cur.createdAt || 0;
        if ((r.updatedAt || 0) > mine) {
          try { P.update(r.id, r); updated++; } catch (e) {}
        }
      });

      try { localStorage.setItem(LAST_PULL, String(j.since || Date.now())); } catch (e) {}
      return { ok: true, added: added, updated: updated };
    });
  }

  /* ★ Buluddan gələn mallar nişanlanır.
     2026-08-20-də JOLLY səhvən Kodsuz Mehsullar-ın cədvəlindən
     mal çəkmişdi. Belə hal təkrarlansa, `undoPull()` ilə YALNIZ
     buluddan gələnləri geri qaytarmaq olur — öz malların qalır. */
  function pulledIds() {
    try { return JSON.parse(localStorage.getItem(PULLED_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function markPulled(id) {
    try {
      var l = pulledIds();
      if (l.indexOf(id) === -1) l.push(id);
      localStorage.setItem(PULLED_KEY, JSON.stringify(l.slice(-2000)));
    } catch (e) {}
  }

  /* Buluddan gələn malları cihazdan çıxarır */
  function undoPull() {
    var ids = pulledIds();
    if (!ids.length) return { ok: true, removed: 0, note: 'buluddan gələn mal yoxdur' };
    var P = (DB() || {}).Products;
    if (!P) return { ok: false, error: 'baza yoxdur' };

    var removed = 0;
    ids.forEach(function (id) {
      try {
        if (P.remove) P.remove(id);
        else if (P.delete) P.delete(id);
        else return;
        removed++;
      } catch (e) {}
    });
    try { localStorage.setItem(PULLED_KEY, '[]'); } catch (e) {}
    return { ok: true, removed: removed };
  }

  /* ══════════════════════════════════════════════════════════
     🖼 KÖHNƏ ŞƏKİLLƏRİ SERVERƏ KÖÇÜRMƏK
     ──────────────────────────────────────────────────────────
     Esqin: "Kodsuz Mallarda nə gözəldi, gör işləyir, burda isə yox."

     SƏBƏB: JOLLY köhnə şəkilləri telefonun IndexedDB-sində
     saxlayır və məhsulda `idb:xxx` kimi NİŞAN qalır. Serverə
     malın adı, qiyməti, barkodu gedir — şəklin ÖZÜ getmir,
     yalnız o nişan gedir. Kompüter nişanı açır, orada isə heç
     nə yoxdur. Ona görə şəkil görünmür.

     Kodsuz Mallarda isə şəkil elə əvvəldən R2-də saxlanılır —
     ünvan hər cihazda işləyir.

     HƏLL: bu funksiya cihazdakı hər şəkli oxuyur, R2-yə yükləyir
     və məhsuldakı nişanı ünvanla əvəz edir. Bir dəfə işlədilir,
     sonra hər şey serverdə olur.

     ★ TƏHLÜKƏSİZLİK: cihazdakı şəkil SİLİNMİR. Yükləmə alınmasa
     köhnə nişan olduğu kimi qalır — heç nə itmir.
     ══════════════════════════════════════════════════════════ */
  function isLocalRef(r) {
    var t = String(r || '');
    return t.indexOf('idb:') === 0 || t.indexOf('fbs:') === 0 || t.indexOf('data:') === 0;
  }

  function dataUrlToBlob(d) {
    return fetch(d).then(function (r) { return r.blob(); });
  }

  /* Bir malın şəkillərini köçürür */
  function migrateOne(p, I) {
    var imgs = (p.images || []).slice();
    var jobs = [];

    imgs.forEach(function (ref, i) {
      if (!isLocalRef(ref)) return;                 /* onsuz da ünvandır */
      jobs.push(
        Promise.resolve(I.getImage(ref))
          .then(function (data) {
            if (!data || String(data).indexOf('data:') !== 0) return null;
            return dataUrlToBlob(data);
          })
          .then(function (blob) {
            if (!blob) return null;
            return uploadImage(blob);
          })
          .then(function (url) {
            if (url) imgs[i] = url;                 /* nişan → ünvan */
            return url;
          })
          .catch(function () { return null; })      /* alınmasa köhnə qalır */
      );
    });

    if (!jobs.length) return Promise.resolve({ changed: 0 });

    return Promise.all(jobs).then(function (res) {
      var done = res.filter(Boolean).length;
      if (!done) return { changed: 0 };
      var P = (DB() || {}).Products;
      try { P.update(p.id, { images: imgs, updatedAt: Date.now() }); }
      catch (e) { return { changed: 0, error: 'yazıla bilmədi' }; }
      return { changed: done };
    });
  }

  var migRunning = false;

  /* Bütün kataloq — bir-bir, serveri yükləməmək üçün */
  function migrateImages(onStep) {
    if (migRunning) return Promise.resolve({ ok: false, error: 'artıq gedir' });
    var I = G('JollyStorage');
    if (!I || !I.getImage) {
      return Promise.resolve({ ok: false, error: 'şəkil modulu yoxdur' });
    }

    var list = products().filter(function (p) {
      return p && (p.images || []).some(isLocalRef);
    });
    if (!list.length) {
      return Promise.resolve({ ok: true, total: 0, moved: 0,
                               note: 'köçürüləcək şəkil yoxdur' });
    }

    migRunning = true;
    var moved = 0, failed = 0, i = 0;

    var step = function () {
      if (i >= list.length) {
        migRunning = false;
        /* Yeni ünvanları dərhal serverə göndəririk */
        return push(true).then(function () {
          return { ok: true, total: list.length, moved: moved, failed: failed };
        });
      }
      var p = list[i++];
      if (onStep) { try { onStep(i, list.length, p.name || ''); } catch (e) {} }
      return migrateOne(p, I).then(function (r) {
        if (r.changed) moved += r.changed; else failed++;
        /* Serveri boğmamaq üçün kiçik ara */
        return new Promise(function (res) { setTimeout(res, 120); }).then(step);
      });
    };

    return Promise.resolve(step()).catch(function (e) {
      migRunning = false;
      return { ok: false, error: (e && e.message) || 'xəta', moved: moved };
    });
  }

  /* Neçə şəkil hələ cihazdadır */
  function localCount() {
    var n = 0, mal = 0;
    products().forEach(function (p) {
      var c = (p.images || []).filter(isLocalRef).length;
      if (c) { n += c; mal++; }
    });
    return { images: n, products: mal };
  }

  /* ══════════════════════════════════════════════════════════
     👥 İSTİFADƏÇİLƏR — kassir hesabı hər cihazda görünsün
     ══════════════════════════════════════════════════════════ */
  function pushUsers() {
    var U = G('JollyUsers');
    var list = [];
    try { list = (U && U.list) ? (U.list() || []) : []; } catch (e) {}
    if (!list.length) return Promise.resolve({ ok: true, saved: 0 });
    return req('/api/users/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: list.map(function (u) {
          return Object.assign({}, u, { updatedAt: u.updatedAt || Date.now() });
        })
      })
    });
  }

  function pullUsers() {
    return req('/api/users').then(function (j) {
      if (!j || !j.ok) return { ok: false, error: (j && j.error) || 'alınmadı' };
      var U = G('JollyUsers');
      if (!U) return { ok: false, error: 'istifadəçi modulu yoxdur' };

      var have = {};
      try { (U.list() || []).forEach(function (u) { if (u && u.id) have[u.id] = u; }); }
      catch (e) {}

      var added = 0;
      (j.users || []).forEach(function (u) {
        if (!u || !u.id || have[u.id]) return;
        try {
          if (U.add) { U.add(u); added++; }
          else if (U.save) { U.save(u); added++; }
        } catch (e) {}
      });
      return { ok: true, added: added, total: (j.users || []).length };
    });
  }

  /* ══════════════════════════════════════════════════════════
     Tam sinxron
     ══════════════════════════════════════════════════════════ */
  var busy = false;

  function sync(loud) {
    if (busy) return Promise.resolve({ ok: false, error: 'artıq gedir' });
    busy = true;
    if (loud) toast('☁️ sinxronlaşır…');

    return push()
      .then(function (a) { return pull().then(function (b) { return { a: a, b: b }; }); })
      .then(function (r) {
        return pushUsers().then(function () {
          return pullUsers().then(function (u) {
            busy = false;
            var msg = '☁️ ' + ((r.a && r.a.saved) || 0) + ' göndərildi · ' +
                      ((r.b && r.b.added) || 0) + ' yeni · ' +
                      ((r.b && r.b.updated) || 0) + ' yeniləndi';
            if (loud) toast(msg, 'ok');
            return { ok: true, push: r.a, pull: r.b, users: u };
          });
        });
      })
      .catch(function (e) {
        busy = false;
        if (loud) toast('☁️ alınmadı: ' + (e && e.message), 'error');
        return { ok: false, error: (e && e.message) || 'xəta' };
      });
  }

  function status() {
    return req('/api/ping');
  }

  global.JollyCloud2 = {
    version: '1.2',
    uploadImage: uploadImage,
    push: push, pull: pull, sync: sync, status: status,
    pulledIds: pulledIds, undoPull: undoPull,
    migrateImages: migrateImages, localCount: localCount,
    pushUsers: pushUsers, pullUsers: pullUsers,
    enabled: enabled,
    setEnabled: function (on) {
      try { localStorage.setItem(OFF_KEY, on ? '0' : '1'); } catch (e) {}
    },
    reset: function () {
      try { localStorage.removeItem(LAST_PULL); localStorage.removeItem(LAST_PUSH); } catch (e) {}
    }
  };

  /* Açılışdan 6 saniyə sonra bir dəfə — proqramın açılışını
     yavaşlatmasın. Sonra hər 5 dəqiqədən bir. */
  setTimeout(function () { sync(false); }, 6000);
  setInterval(function () { if (online()) sync(false); }, 5 * 60 * 1000);

  /* İnternet qayıdanda dərhal */
  global.addEventListener('online', function () { setTimeout(function () { sync(false); }, 1500); });

})(typeof window !== 'undefined' ? window : this);
