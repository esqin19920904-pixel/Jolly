/* ==========================================================================
   JOLLY — jolly-cloud-doctor.js               v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   "Buluda yazıla bilmədi: 400" xətasının SƏBƏBİNİ tapır.

   Problem: 400 iki tamam fərqli şeydən gələ bilər —
     (a) giriş/qaydalar problemi (token, Firebase Rules)
     (b) məlumatın özü (çox böyük payload, yanlış açar, dərin yuva)
   Bunları ayırmadan düzəltmək təxmindir.

   ÜSUL — üç addım, kiçikdən böyüyə:
     1. Token alınırmı?            → giriş işləyirmi
     2. KİÇİK test yazısı keçirmi? → qaydalar və şəbəkə işləyirmi
     3. Əsl payload nə boydadır?   → ölçü problemi varmı

   1 və 2 keçib 3 böyükdürsə → səbəb ÖLÇÜDÜR (thumb-lar).
   2 sınırsa → səbəb QAYDALAR/GİRİŞDİR, ölçünün dəxli yoxdur.

   cloud.js-ə TOXUNMUR — yalnız oxuyur və öz test düyününə yazır.
   İcazə açarı: cloud.doctor.view    Route: #/cloud-doctor
   ========================================================================== */

(function (global) {
  'use strict';

  var PERM  = 'cloud.doctor.view';
  var ROUTE = '#/cloud-doctor';

  var BASE    = 'https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app';
  var API_KEY = 'AIzaSyAhv-ZFTTNeyoXIDjn3VrVcknPKor4kZvw';
  var PING    = 'jolly_ping';          // öz test düyünümüz — əsl məlumata toxunmuruq

  var SAFE_MB = 8;                     // bundan yuxarısı mobil şəbəkədə problemlidir

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function mb(b) { return (b / 1048576).toFixed(2) + ' MB'; }
  function kb(b) { return (b / 1024).toFixed(0) + ' KB'; }

  var last = null;

  /* ----------------------------------------------------------------------
     1. Token
     ---------------------------------------------------------------------- */
  function cachedToken() {
    try {
      var raw = global.localStorage.getItem('jolly_fb_auth');
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && o.idToken && Date.now() < o.expiry) return o.idToken;
    } catch (e) {}
    return null;
  }

  function getToken() {
    var c = cachedToken();
    if (c) return Promise.resolve({ ok: true, token: c, cached: true });

    return fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) return { ok: false, status: r.status, detail: t.slice(0, 200) };
        var d = {};
        try { d = JSON.parse(t); } catch (e) {}
        return { ok: true, token: d.idToken, cached: false };
      });
    }).catch(function (e) {
      return { ok: false, status: 0, detail: (e && e.message) || String(e) };
    });
  }

  /* ----------------------------------------------------------------------
     2. Kiçik test yazısı
     ---------------------------------------------------------------------- */
  function pingWrite(token) {
    var body = JSON.stringify({ at: Date.now(), from: 'cloud-doctor' });
    return fetch(BASE + '/' + PING + '.json?auth=' + token, { method: 'PUT', body: body })
      .then(function (r) {
        return r.text().then(function (t) {
          return { ok: r.ok, status: r.status, detail: r.ok ? '' : t.slice(0, 220), bytes: body.length };
        });
      })
      .catch(function (e) { return { ok: false, status: 0, detail: (e && e.message) || String(e) }; });
  }

  function pingClean(token) {
    return fetch(BASE + '/' + PING + '.json?auth=' + token, { method: 'DELETE' })
      .then(function () { return true; }).catch(function () { return false; });
  }

  /* ----------------------------------------------------------------------
     3. Ölçü hesabı
     ---------------------------------------------------------------------- */
  function measure() {
    var out = { ok: false };
    try {
      if (!global.JollyDB || typeof global.JollyDB.exportAll !== 'function') {
        return Promise.resolve({ ok: false, reason: 'JollyDB.exportAll tapılmadı' });
      }
      var data = global.JollyDB.exportAll();
      var baseBytes = JSON.stringify(data).length;
      var products = Array.isArray(data.products) ? data.products : [];
      var withImg = products.filter(function (p) { return p && p.images && p.images.length; }).length;

      out.ok = true;
      out.baseBytes = baseBytes;
      out.products = products.length;
      out.withImages = withImg;

      // Bir thumb-un orta ölçüsünü ölçmək üçün ilk 3-ünü götürürük
      var sample = products.filter(function (p) { return p && p.images && p.images.length; }).slice(0, 3);
      if (!sample.length || !global.JollyStorage) {
        out.thumbAvg = null;
        out.estimated = baseBytes;
        return Promise.resolve(out);
      }

      return Promise.all(sample.map(function (p) {
        try {
          var r = global.JollyStorage.get ? global.JollyStorage.get(p.images[0]) : null;
          return Promise.resolve(r).then(function (v) {
            return (typeof v === 'string') ? v.length : 0;
          }).catch(function () { return 0; });
        } catch (e) { return Promise.resolve(0); }
      })).then(function (sizes) {
        var real = sizes.filter(function (n) { return n > 0; });
        // thumb əslindən təxminən 8-10 dəfə kiçikdir (240px, sıxılmış)
        var avg = real.length ? Math.round((real.reduce(function (a, b) { return a + b; }, 0) / real.length) / 9) : 0;
        out.thumbAvg = avg;
        out.estimated = baseBytes + (avg * withImg);
        return out;
      }).catch(function () { out.estimated = baseBytes; return out; });
    } catch (e) {
      return Promise.resolve({ ok: false, reason: (e && e.message) || String(e) });
    }
  }

  /* ----------------------------------------------------------------------
     4. Tam yoxlama
     ---------------------------------------------------------------------- */
  function diagnose() {
    var res = { at: Date.now(), online: !!(global.navigator && global.navigator.onLine) };

    if (!res.online) {
      res.verdict = 'offline';
      res.message = 'İnternet yoxdur — yoxlama mümkün deyil.';
      last = res;
      return Promise.resolve(res);
    }

    return getToken().then(function (t) {
      res.auth = t;
      if (!t.ok) {
        res.verdict = 'auth';
        res.message = 'Bulud girişi alınmadı (' + t.status + '). Səbəb Firebase açarı və ya şəbəkədir — ' +
                      'məlumatın ölçüsünün dəxli yoxdur.';
        last = res;
        return res;
      }

      return pingWrite(t.token).then(function (p) {
        res.ping = p;
        return measure().then(function (m) {
          res.size = m;

          if (!p.ok) {
            res.verdict = 'rules';
            res.message = 'Kiçik test yazısı da keçmədi (' + p.status + '). Deməli problem ÖLÇÜDƏ DEYİL — ' +
                          'Firebase Rules və ya token icazəsindədir. Firebase mesajı: ' + (p.detail || '—');
          } else if (m.ok && m.estimated > SAFE_MB * 1048576) {
            res.verdict = 'size';
            res.message = 'Giriş və qaydalar işləyir (kiçik yazı keçdi), amma göndəriləcək məlumat təxminən ' +
                          mb(m.estimated) + '-dır. Bu, mobil şəbəkədə çox böyükdür — 400/timeout səbəbi budur. ' +
                          'Şəkil "thumb"ları payload-un böyük hissəsini tutur.';
          } else if (m.ok) {
            res.verdict = 'ok';
            res.message = 'Giriş, qaydalar və ölçü qaydasındadır (' + mb(m.estimated || m.baseBytes) + '). ' +
                          'Sinxron işləməlidir — indi Cloud Studio-dan "İndi göndər" sına.';
          } else {
            res.verdict = 'unknown';
            res.message = 'Giriş və kiçik yazı keçdi, amma ölçü ölçülə bilmədi: ' + (m.reason || '—');
          }

          return pingClean(t.token).then(function () { last = res; return res; });
        });
      });
    }).catch(function (e) {
      res.verdict = 'error';
      res.message = (e && e.message) || String(e);
      last = res;
      return res;
    });
  }

  /* ----------------------------------------------------------------------
     5. UI
     ---------------------------------------------------------------------- */
  var CSS = [
    '#jcd{padding:14px 12px 90px;max-width:720px;margin:0 auto;color:#e8e8f0}',
    '#jcd h2{font-size:19px;margin:0 0 3px;font-weight:700}',
    '#jcd .sub{font-size:12px;opacity:.6;margin-bottom:14px}',
    '#jcd .card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);',
    'border-radius:16px;padding:13px 14px;margin-bottom:11px}',
    '#jcd .card h3{margin:0 0 9px;font-size:13px;letter-spacing:1.1px;text-transform:uppercase;opacity:.72;font-weight:700}',
    '#jcd .r{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:14px;',
    'border-bottom:1px solid rgba(255,255,255,.05)}',
    '#jcd .r:last-child{border-bottom:0}',
    '#jcd .r span:first-child{opacity:.66}',
    '#jcd .verdict{font-size:14.5px;line-height:1.55}',
    '#jcd .btn{padding:13px;border-radius:14px;text-align:center;font-weight:700;font-size:14.5px;',
    'border:1px solid rgba(245,196,81,.45);background:rgba(245,196,81,.13);color:#f7d98a;cursor:pointer}',
    '#jcd .btn:active{transform:scale(.98)}',
    '#jcd pre{white-space:pre-wrap;word-break:break-word;font-size:11.5px;line-height:1.5;',
    'background:rgba(0,0,0,.3);border-radius:12px;padding:11px;margin:0;max-height:200px;overflow:auto}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('jcd-css')) return;
    var s = document.createElement('style');
    s.id = 'jcd-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function icon(v) {
    return v === 'ok' ? '🟢' : v === 'size' ? '🟡' : v === 'offline' ? '⚪' : '🔴';
  }

  function view(r) {
    if (!r) {
      return '<div id="jcd"><h2>☁️ Bulud Doktoru</h2>' +
             '<div class="sub">400 xətasının səbəbini üç addımda tapır</div>' +
             '<div class="card"><div class="verdict">Yoxlama üç şeyi ayırır: giriş, qaydalar, ölçü. ' +
             'Əsl məlumatına toxunmur — yalnız kiçik test düyününə yazıb silir.</div></div>' +
             '<div class="btn" data-jcd="run">🔍 Yoxlamanı başlat</div></div>';
    }

    var h = ['<div id="jcd"><h2>☁️ Bulud Doktoru</h2>'];
    h.push('<div class="sub">' + new Date(r.at).toLocaleString('az-AZ') + '</div>');
    h.push('<div class="card"><h3>Nəticə</h3><div class="verdict">' + icon(r.verdict) + ' ' + esc(r.message) + '</div></div>');

    h.push('<div class="card"><h3>Addımlar</h3>');
    h.push('<div class="r"><span>1. Bulud girişi</span><span>' +
           (r.auth ? (r.auth.ok ? '✅ alındı' + (r.auth.cached ? ' (keşdən)' : '') : '❌ ' + r.auth.status) : '—') + '</span></div>');
    h.push('<div class="r"><span>2. Kiçik test yazısı</span><span>' +
           (r.ping ? (r.ping.ok ? '✅ keçdi' : '❌ ' + r.ping.status) : '—') + '</span></div>');
    h.push('<div class="r"><span>3. Ölçü</span><span>' +
           (r.size && r.size.ok ? mb(r.size.estimated || r.size.baseBytes) : '—') + '</span></div>');
    h.push('</div>');

    if (r.size && r.size.ok) {
      h.push('<div class="card"><h3>Məlumatın tərkibi</h3>');
      h.push('<div class="r"><span>Şəkilsiz məlumat</span><span>' + kb(r.size.baseBytes) + '</span></div>');
      h.push('<div class="r"><span>Məhsul sayı</span><span>' + r.size.products + '</span></div>');
      h.push('<div class="r"><span>Şəkli olan</span><span>' + r.size.withImages + '</span></div>');
      if (r.size.thumbAvg) {
        h.push('<div class="r"><span>Bir thumb (təxmini)</span><span>' + kb(r.size.thumbAvg) + '</span></div>');
        h.push('<div class="r"><span>Thumb-ların cəmi</span><span>' + mb(r.size.thumbAvg * r.size.withImages) + '</span></div>');
      }
      h.push('</div>');
    }

    if (r.ping && !r.ping.ok && r.ping.detail) {
      h.push('<div class="card"><h3>Firebase-in öz mesajı</h3><pre>' + esc(r.ping.detail) + '</pre></div>');
    }

    h.push('<div class="btn" data-jcd="run">🔄 Yenidən yoxla</div>');
    h.push('</div>');
    return h.join('');
  }

  function bind() {
    var root = document.getElementById('jcd');
    if (!root || root.__b) return;
    root.__b = true;
    root.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-jcd]') : null;
      if (!el) return;
      el.textContent = '⏳ Yoxlanılır…';
      diagnose().then(function () { Doctor.open(); });
    });
  }

  var Doctor = {
    version: '1.0.0',
    diagnose: diagnose,
    last: function () { return last; },

    render: function () { injectCSS(); setTimeout(bind, 0); return view(last); },
    afterRender: function () { injectCSS(); bind(); },
    open: function () {
      injectCSS();
      var main = document.getElementById('main') || document.body;
      main.innerHTML = view(last);
      bind();
    },

    health: function () {
      var problems = [];
      if (last && last.verdict === 'rules') problems.push('Bulud qaydaları/token yazmağa icazə vermir');
      if (last && last.verdict === 'size') problems.push('Bulud payload-u çox böyükdür (' + mb(last.size.estimated) + ')');
      return Promise.resolve({ ok: problems.length === 0, problems: problems, last: last });
    },

    selfTest: function () {
      return Promise.resolve({
        ok: typeof fetch === 'function' && !!global.JollyDB,
        fetch: typeof fetch === 'function',
        db: !!global.JollyDB,
        note: 'Əsl yoxlama internet tələb edir — Bulud Doktoru ekranından başlat'
      });
    }
  };

  global.JollyCloudDoctor = Doctor;

  function registerAll() {
    try {
      if (global.POS && typeof global.POS.register === 'function') {
        global.POS.register({
          id: 'clouddoctor', name: 'Bulud Doktoru', icon: '☁️',
          permissions: [{ key: PERM, label: 'Bulud xətasını yoxla', tag: 'view', default: false }]
        });
      }
    } catch (e) {}
    try {
      if (global.ModuleRegistry && typeof global.ModuleRegistry.register === 'function') {
        global.ModuleRegistry.register({
          id: 'cloud-doctor', name: 'Bulud Doktoru', icon: '☁️',
          route: ROUTE, group: 'Alətlər', perm: PERM,
          render: Doctor.render, afterRender: Doctor.afterRender
        });
        return true;
      }
    } catch (e) {}
    return false;
  }

  function boot() { if (!registerAll()) setTimeout(registerAll, 1500); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }

})(window);
