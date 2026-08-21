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
          try { P.add(r); added++; } catch (e) {}
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
    version: '1.0',
    uploadImage: uploadImage,
    push: push, pull: pull, sync: sync, status: status,
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
