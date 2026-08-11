/* ============================================================
   JOLLY R2 Şəkil Anbarı — jolly-r2.js
   v1.0  (2026-08-06)

   ────────────────────────────────────────────────────────────
   NİYƏ: Esqin — "o biri jolly-də (katalog) heç bir şəkil silinmir,
   burda da elə edək". Orada şəkillər Cloudflare R2-də, serverdə
   saxlanılır; JOLLY-də isə yalnız telefonun IndexedDB-sində idi.

   ────────────────────────────────────────────────────────────
   NECƏ QURULUB (minimum müdaxilə ilə):
   `storage.js`-in cüt-ünvan mexanizmi onsuz da var:
        "idb:<açar>|<bulud hissəsi>"
   `imgAttr()` (sətir 388) `|` olan hər ünvanı tanıyır və
   `data-idb` atributu qoyur; `hydrate()` (369) hər şəkil üçün
   `getImage(ref)` çağırır. Deməli YALNIZ `getImage`-i sarğılamaq
   kifayətdir ki, `r2:` ünvanı hər ekranda işləsin.
   storage.js-ə TOXUNULMUR.

   AXIN:
     • Yeni şəkil → saveImage() yerli yazır → biz R2-yə də yükləyirik
       → ünvan "idb:<açar>|r2:<açar>" olur
     • Göstərmə → əvvəl yerli IndexedDB (sürətli, oflayn işləyir)
       → yerli tapılmasa R2-dən gətirilir
     • Silmə → jolly-image-guard.js onsuz da fiziki silməni
       təxirə salır; R2 nüsxəsi toxunulmadan qalır

   SERVER: repo kökündəki `_worker.js`
        GET/PUT/DELETE /api/img/<açar>

   Marşrut: #/r2   ·   Açar: images.r2.manage
   ============================================================ */
(function (global) {
  'use strict';

  var ROUTE     = '#/r2';
  var PERM_KEY  = 'images.r2.manage';
  var TOKEN_KEY = 'jolly_r2_token';
  var API       = '/api/img';

  function peek(name) {
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }
  function DB() { return global.JollyDB || peek('JollyDB'); }
  function ST() { return global.JollyStorage || peek('JollyStorage'); }

  function toast(msg, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error)   return T.error(msg);
      if (T && kind === 'ok'    && T.success) return T.success(msg);
      if (T && T.info) return T.info(msg);
    } catch (e) {}
    console.log('[R2]', msg);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function session() {
    try { return JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); }
    catch (e) { return null; }
  }
  function can() {
    var s = session();
    if (!s) return true;
    if (s.role === 'admin') return true;
    var P = global.POS || peek('POS');
    if (!P || !P.can) return true;
    try { return !!P.can(PERM_KEY); } catch (e) { return true; }
  }

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try { localStorage.setItem(TOKEN_KEY, String(t || '')); } catch (e) {}
  }

  /* ── Ünvan köməkçiləri ──────────────────────────────────── */
  function partOf(ref, prefix) {
    var parts = String(ref || '').split('|');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].indexOf(prefix) === 0) return parts[i].slice(prefix.length);
    }
    return null;
  }
  function idbKeyOf(ref) { return partOf(ref, 'idb:'); }
  function r2KeyOf(ref)  { return partOf(ref, 'r2:'); }
  function urlFor(key)   { return API + '/' + encodeURIComponent(key); }

  /* ── Server ─────────────────────────────────────────────── */
  function ping() {
    return fetch(API + '-ping', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: e.message }; });
  }

  function dataUrlToBlob(dataUrl) {
    var parts = String(dataUrl).split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(parts[1] || '');
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function put(key, dataUrl) {
    var t = token();
    if (!t) return Promise.reject(new Error('Token yazılmayıb'));
    var blob = dataUrlToBlob(dataUrl);
    return fetch(urlFor(key), {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-Jolly-Token': t },
      body: blob
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.ok) throw new Error('HTTP ' + r.status + ' — ' + (j.error || ''));
        return 'r2:' + key;
      });
    });
  }

  function get(key) {
    return fetch(urlFor(key)).then(function (r) {
      if (!r.ok) return null;
      return r.blob().then(function (b) {
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.onerror = function () { res(null); };
          fr.readAsDataURL(b);
        });
      });
    }).catch(function () { return null; });
  }

  /* ══════════════════════════════════════════════════════════
     ★ getImage sarğısı — bütün ekranlarda R2-ni işə salan yer
     ══════════════════════════════════════════════════════════ */
  function wrapGetImage() {
    var s = ST();
    if (!s || typeof s.getImage !== 'function') return false;
    if (s.getImage.__jr2) return true;

    var orig = s.getImage.bind(s);
    var wrapped = function (ref, preferThumb) {
      return Promise.resolve()
        .then(function () { return orig(ref, preferThumb); })
        .catch(function () { return null; })
        .then(function (data) {
          if (data) return data;                       // yerli nüsxə var — dəyişmirik
          var k = r2KeyOf(ref);
          if (!k) return null;
          return get(k);                               // yerli yoxdur → R2-dən
        });
    };
    wrapped.__jr2 = true;
    s.getImage = wrapped;
    if (!global.JollyStorage) { try { global.JollyStorage = s; } catch (e) {} }
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     saveImage sarğısı — yeni şəkil avtomatik R2-yə
     ══════════════════════════════════════════════════════════ */
  function wrapSaveImage() {
    var s = ST();
    if (!s || typeof s.saveImage !== 'function') return false;
    if (s.saveImage.__jr2) return true;

    var orig = s.saveImage.bind(s);
    var wrapped = function (dataUrl) {
      return Promise.resolve(orig(dataUrl)).then(function (ref) {
        if (!ref || !token()) return ref;
        var key = idbKeyOf(ref);
        if (!key || r2KeyOf(ref)) return ref;
        return put(key, dataUrl).then(function (r2ref) {
          return ref + '|' + r2ref;
        }).catch(function (e) {
          console.warn('[R2] yükləmə uğursuz (yerli nüsxə var):', e.message);
          return ref;
        });
      });
    };
    wrapped.__jr2 = true;
    s.saveImage = wrapped;
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     Sayım və doldurma
     ══════════════════════════════════════════════════════════ */
  function scan() {
    var d = DB(), out = { total: 0, cloud: 0, localOnly: 0, items: [] };
    var prods = [];
    try { prods = (d && d.Products && d.Products.all) ? (d.Products.all() || []) : []; } catch (e) {}
    for (var i = 0; i < prods.length; i++) {
      var p = prods[i], imgs = p.images || [];
      for (var j = 0; j < imgs.length; j++) {
        var r = imgs[j];
        if (typeof r !== 'string' || !r) continue;
        out.total++;
        if (r2KeyOf(r)) out.cloud++;
        else { out.localOnly++; out.items.push({ pid: p.id, name: p.name || p.id, idx: j, ref: r, key: idbKeyOf(r) }); }
      }
    }
    return out;
  }

  var busy = false, lastRun = null;
  function backfill(onStep) {
    if (busy) return Promise.resolve(lastRun || {});
    busy = true;
    var s = ST(), d = DB();
    var list = scan().items;
    var res = { done: 0, fail: 0, skip: 0, total: list.length, lastError: null };

    function step(i) {
      if (i >= list.length) { busy = false; lastRun = res; return res; }
      var it = list[i];
      if (onStep) { try { onStep(i + 1, list.length, it.name); } catch (e) {} }
      if (!it.key || !s || !s.getImage) { res.skip++; return step(i + 1); }

      return Promise.resolve(s.getImage(it.ref)).then(function (dataUrl) {
        if (!dataUrl || String(dataUrl).indexOf('data:') !== 0) { res.skip++; return step(i + 1); }
        return put(it.key, dataUrl).then(function (r2ref) {
          try {
            var p = d.Products.get(it.pid);
            if (p && p.images && p.images[it.idx] === it.ref) {
              var imgs = p.images.slice();
              imgs[it.idx] = it.ref + '|' + r2ref;
              d.Products.update(it.pid, { images: imgs });
              res.done++;
            } else res.skip++;
          } catch (e) { res.fail++; res.lastError = e.message; }
          return step(i + 1);
        }).catch(function (e) {
          res.fail++; res.lastError = e.message;
          return step(i + 1);
        });
      }).catch(function () { res.skip++; return step(i + 1); });
    }
    return Promise.resolve(step(0)).catch(function (e) {
      busy = false; res.lastError = e.message; return res;
    });
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  var lastPing = null;

  function render() {
    if (session() && !can()) {
      return '<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>';
    }
    var s = scan();
    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
             '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">☁️ R2 Şəkil Anbarı</h2>' +
             '<div class="muted" style="font-size:12.5px;">v1.0 · şəkillər serverdə saxlanılır</div>' +
           '</div></div>');

    h.push('<div class="glass" style="padding:13px 14px;margin:12px 0;font-size:12.5px;line-height:1.6;">' +
             'Şəkil əvvəlcə telefona yazılır (oflayn işləsin deyə), sonra Cloudflare R2-yə yüklənir. ' +
             'Telefondakı nüsxə itsə, şəkil serverdən gəlir.' +
           '</div>');

    h.push('<div class="glass" style="padding:14px;margin-bottom:10px;">' +
             '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;">' +
               '<span>Ümumi şəkil</span><b>' + s.total + '</b></div>' +
             '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;">' +
               '<span>☁️ R2-də</span><b style="color:#4ade80;">' + s.cloud + '</b></div>' +
             '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;border-top:1px solid rgba(255,255,255,.08);margin-top:4px;">' +
               '<span>📱 Yalnız telefonda</span><b style="color:' + (s.localOnly ? '#fbbf24' : 'inherit') + ';">' + s.localOnly + '</b></div>' +
           '</div>');

    h.push('<div class="glass" style="padding:14px;margin-bottom:10px;">' +
             '<div class="muted" style="font-size:11.5px;margin-bottom:6px;">Yükləmə açarı (Cloudflare-də UPLOAD_TOKEN)</div>' +
             '<input id="jr2Tok" class="input" style="width:100%;margin-bottom:9px;" value="' + esc(token()) + '" placeholder="açarı yaz">' +
             '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
               '<button class="btn btn-primary" onclick="JollyR2.saveToken()">Yadda saxla</button>' +
               '<button class="btn" onclick="JollyR2.check()">🧪 Serveri yoxla</button>' +
             '</div>' +
           '</div>');

    if (lastPing) {
      h.push('<div class="glass" style="padding:12px 14px;margin-bottom:12px;font-size:12.5px;line-height:1.7;">' +
             esc(lastPing) + '</div>');
    }

    if (s.localOnly) {
      h.push('<button class="btn btn-primary" style="width:100%;padding:14px;font-size:14px;" ' +
             'onclick="JollyR2.run()">☁️ ' + s.localOnly + ' şəkli R2-yə yüklə</button>');
      h.push('<div class="muted" style="font-size:11.5px;margin:8px 0 12px;">Wi-Fi ilə etmək daha yaxşıdır.</div>');
    } else if (s.total) {
      h.push('<div class="glass" style="padding:14px;text-align:center;font-size:13px;color:#4ade80;">' +
             '✅ Bütün şəkillərin server nüsxəsi var</div>');
    }

    h.push('<div id="jr2Prog" class="muted" style="font-size:12px;margin:10px 0;"></div>');

    if (lastRun) {
      h.push('<div class="glass" style="padding:12px 14px;margin-top:10px;font-size:12.5px;line-height:1.7;">' +
               '<b>Son yükləmə:</b><br>✅ ' + lastRun.done + ' · ⏭ ' + lastRun.skip + ' · ❌ ' + lastRun.fail +
               (lastRun.lastError ? '<br><span style="color:#fca5a5;font-size:11.5px;">' + esc(lastRun.lastError) + '</span>' : '') +
             '</div>');
    }

    h.push('<div style="height:30px;"></div></div>');
    return h.join('');
  }

  function refresh() {
    var el = document.getElementById('main');
    if (el && String(global.location.hash || '').split('?')[0] === ROUTE) { el.innerHTML = render(); return; }
    var A = global.JollyApp || peek('JollyApp');
    try { if (A && A.render) A.render(); } catch (e) {}
  }
  function progress(t) {
    var el = document.getElementById('jr2Prog');
    if (el) el.textContent = t;
  }

  /* ── API ────────────────────────────────────────────────── */
  global.JollyR2 = {
    render: render,
    scan: scan,

    saveToken: function () {
      var el = document.getElementById('jr2Tok');
      setToken(el ? el.value.trim() : '');
      toast(token() ? '🔑 Açar yadda saxlanıldı' : 'Açar silindi', 'ok');
      refresh();
    },

    check: function () {
      toast('Server yoxlanılır…');
      ping().then(function (j) {
        if (j && j.ok) {
          lastPing = '✅ Server cavab verir.\n' +
                     'R2 bağlantısı: ' + (j.bucket ? 'VAR' : 'YOXDUR — Pages ayarlarında MEDIA bağlantısı qurulmalıdır') + '\n' +
                     'Açar (UPLOAD_TOKEN): ' + (j.token ? 'qurulub' : 'QURULMAYIB');
        } else {
          lastPing = '❌ Server cavab vermir — ' + (j && j.error ? j.error : 'naməlum') +
                     '\n_worker.js repo kökünə yüklənibmi və deploy bitibmi?';
        }
        refresh();
      });
    },

    run: function () {
      if (!token()) { toast('Əvvəlcə açarı yaz', 'error'); return; }
      var s = scan();
      if (!s.localOnly) { toast('Yüklənəcək şəkil yoxdur', 'ok'); return; }
      toast('☁️ ' + s.localOnly + ' şəkil yüklənir…');
      backfill(function (i, n, nm) { progress('☁️ ' + i + ' / ' + n + ' — ' + nm); })
        .then(function (r) {
          progress('');
          toast('☁️ ' + r.done + ' yükləndi · ' + r.fail + ' xəta', r.fail ? 'error' : 'ok');
          refresh();
        });
    },

    ping: ping,
    _put: put,
    _get: get,
    _backfill: backfill,
    _r2KeyOf: r2KeyOf
  };

  /* ── Qeydiyyat ──────────────────────────────────────────── */
  function registerPerm() {
    var P = global.POS || peek('POS');
    if (!P || typeof P.register !== 'function') return false;
    try {
      P.register({
        id: 'imager2', name: 'R2 Şəkil Anbarı', icon: '☁️',
        permissions: [{ key: PERM_KEY, label: 'R2 şəkil anbarını idarə et', tag: 'system', 'default': false }]
      });
      return true;
    } catch (e) { return false; }
  }
  function registerModule() {
    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    if (!MR || typeof MR.register !== 'function') return false;
    try {
      MR.register({ id: 'r2', name: 'R2 Şəkil Anbarı', icon: '☁️', route: ROUTE, group: 'JOLLY', render: render });
      return true;
    } catch (e) { return false; }
  }

  var tries = 0;
  function boot() {
    var a = registerPerm(), b = registerModule();
    var c = wrapGetImage(), d2 = wrapSaveImage();
    if ((a && b && c && d2) || ++tries > 40) {
      console.log('[R2] hazırdır', { perm: a, modul: b, getImage: c, saveImage: d2 });
      return;
    }
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 150); });
  } else {
    setTimeout(boot, 150);
  }

})(typeof window !== 'undefined' ? window : this);
