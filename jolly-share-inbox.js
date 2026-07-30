/* ==========================================================================
   JOLLY — jolly-share-inbox.js                v2.0.0   (2026-07-30)
   --------------------------------------------------------------------------
   📥 ŞƏKİLLƏ AXTARIŞ (paylaşma ilə)

   ƏSL İŞ AXINI (Esqin izah etdi):
     Müştəri WhatsApp-da mal şəkli atır və "kodu lazımdır" deyir
       → Esqin həmin şəkli WhatsApp-dan (və ya qalereyadan) PAYLAŞ edir
       → JOLLY seçir
       → proqram şəkildən malı TAPIR və KODU göstərir
       → tapmasa: "yeni maldır — əlavə edək?"

   Yəni paylaşılan şəkil məhsulun şəkli DEYİL — o, AXTARIŞ SORĞUSUDUR.
   (v1.0-da bunu səhv anlamışdım və şəkli yeni məhsula yapışdırırdım.)

   TEXNİKİ AXIN:
     Paylaş → POST → sw.js tutur → şəkil IndexedDB-yə (`jolly_share`/`inbox`)
       → share-target.html → `#/share-inbox`
       → burada `JollyVisualSearch.findSimilar()` işə düşür
       → 8×8 perceptual hash müqayisəsi ilə oxşar mallar sıralanır

   NİYƏ ƏVVƏL DAYANDI: manifest paylaşmanı POST ilə göndərir, sw.js isə onu
   birbaşa serverə ötürürdü — Cloudflare statik fayla POST qəbul etmir və
   HTTP 405 verirdi ("Bu səhifə işləmir").

   İcazə açarı: share.inbox.view (axtarışın özü `search.photo` tələb edir)
   ========================================================================== */

(function (global) {
  'use strict';

  var PERM  = 'share.inbox.view';
  var ROUTE = '#/share-inbox';
  var DB = 'jolly_share', STORE = 'inbox';

  var MAX_DIST  = 20;    // 64 bitdən — visual-search.js-in öz standartı
  var GOOD      = 70;    // bundan yuxarı oxşarlıq "tapıldı" sayılır

  var state = { rec: null, url: null, results: null, searching: false, error: null };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, kind) {
    try {
      if (global.Toast) {
        if (kind === 'error' && global.Toast.error) return global.Toast.error(msg);
        if (kind === 'ok' && global.Toast.success) return global.Toast.success(msg);
        if (global.Toast.info) return global.Toast.info(msg);
      }
    } catch (e) {}
    console.log('[Şəkillə axtarış] ' + msg);
  }
  function lex(name) {
    if (global[name]) return global[name];
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }

  /* ----------------------------------------------------------------------
     1. Paylaşılan şəkli oxu
     ---------------------------------------------------------------------- */
  function open() {
    return new Promise(function (res, rej) {
      if (!global.indexedDB) return rej(new Error('IndexedDB yoxdur'));
      var r = global.indexedDB.open(DB, 1);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function latest() {
    return open().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        q.onsuccess = function () {
          var all = (q.result || []).filter(function (r) { return r.images && r.images.length; });
          all.sort(function (a, b) { return b.at - a.at; });
          res(all[0] || null);
        };
        q.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }

  function clearAll() {
    return open().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
        q.onsuccess = function () { res(true); };
        q.onerror = function () { res(false); };
      });
    }).catch(function () { return false; });
  }

  function toDataUrl(img) {
    return new Promise(function (res, rej) {
      try {
        var blob = new Blob([img.data], { type: img.type || 'image/jpeg' });
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = function () { rej(fr.error); };
        fr.readAsDataURL(blob);
      } catch (e) { rej(e); }
    });
  }

  /* ----------------------------------------------------------------------
     2. visual-search.js tənbəl yüklənir — gəlməsini gözləyirik
     ---------------------------------------------------------------------- */
  function ensureVisual() {
    var vs = lex('JollyVisualSearch');
    if (vs) return Promise.resolve(vs);

    try { var L = lex('JollyLazy'); if (L && L.flush) L.flush(); } catch (e) {}

    // Yenə yoxdursa özümüz yükləyirik
    if (!document.querySelector('script[src*="visual-search.js"]')) {
      try {
        var s = document.createElement('script');
        s.src = 'visual-search.js';
        document.head.appendChild(s);
      } catch (e) {}
    }

    return new Promise(function (res, rej) {
      var tries = 0;
      var t = setInterval(function () {
        var v = lex('JollyVisualSearch');
        if (v) { clearInterval(t); res(v); return; }
        if (++tries > 50) { clearInterval(t); rej(new Error('visual-search.js yüklənmədi')); }
      }, 120);
    });
  }

  /* ----------------------------------------------------------------------
     3. Axtarış
     ---------------------------------------------------------------------- */
  function run() {
    if (state.searching) return Promise.resolve();
    state.searching = true;
    state.error = null;
    state.results = null;

    return latest().then(function (rec) {
      if (!rec) {
        state.searching = false;
        return;
      }
      state.rec = rec;
      try {
        state.url = URL.createObjectURL(new Blob([rec.images[0].data], { type: rec.images[0].type || 'image/jpeg' }));
      } catch (e) {}
      paint();

      return toDataUrl(rec.images[0]).then(function (dataUrl) {
        state._dataUrl = dataUrl;
        return ensureVisual();
      }).then(function (vs) {
        return vs.findSimilar(state._dataUrl, MAX_DIST);
      }).then(function (results) {
        state.results = results || [];
        state.searching = false;
        paint();
      });
    }).catch(function (e) {
      state.searching = false;
      state.error = (e && e.message) || String(e);
      paint();
    });
  }

  function copyCode(txt) {
    if (global.navigator && global.navigator.clipboard) {
      global.navigator.clipboard.writeText(txt).then(function () {
        toast('Kod kopyalandı: ' + txt, 'ok');
      }, function () { toast('Kopyalanmadı — ' + txt, 'error'); });
    } else {
      toast('Kod: ' + txt);
    }
  }

  function codeOf(p) {
    return p.barcode || p.specialCode || p.code || p.modelNo || '';
  }

  /* ----------------------------------------------------------------------
     4. Yeni məhsul (tapılmayanda)
     ---------------------------------------------------------------------- */
  function createNew() {
    var P = global.Products || (global.JollyDB && global.JollyDB.Products) || lex('Products');
    if (!P || typeof P.add !== 'function') { toast('Məhsul modulu tapılmadı', 'error'); return; }

    var S = lex('JollyStorage');
    var img = state._dataUrl;
    var save = (S && typeof S.saveImage === 'function') ? S.saveImage(img) : Promise.resolve(img);

    Promise.resolve(save).then(function (ref) {
      var created = P.add({ name: '', images: [ref] });
      return Promise.resolve(created);
    }).then(function (res) {
      var id = (res && (res.id || res)) || null;
      toast('Yeni məhsul yaradıldı — adını və kodunu yaz', 'ok');
      clearAll();
      if (id && global.Products && typeof global.Products.openEdit === 'function') global.Products.openEdit(id);
      else global.location.hash = '#/products';
    }).catch(function (e) {
      toast('Alınmadı: ' + ((e && e.message) || e), 'error');
    });
  }

  function openProduct(id) {
    var P = global.Products || lex('Products');
    if (P && typeof P.openDetail === 'function') return P.openDetail(id);
    if (P && typeof P.open === 'function') return P.open(id);
    if (P && typeof P.showDetail === 'function') return P.showDetail(id);
    global.location.hash = '#/products?id=' + encodeURIComponent(id);
  }

  /* ----------------------------------------------------------------------
     5. UI
     ---------------------------------------------------------------------- */
  var CSS = [
    '#jsi{padding:14px 12px 90px;max-width:720px;margin:0 auto;color:#e8e8f0}',
    '#jsi h2{font-size:19px;margin:0 0 3px;font-weight:700}',
    '#jsi .sub{font-size:12px;opacity:.6;margin-bottom:14px}',
    '#jsi .q{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);',
    'border-radius:16px;padding:12px;margin-bottom:14px;text-align:center}',
    '#jsi .q img{width:100%;max-height:220px;object-fit:contain;border-radius:12px;background:#0a0b12}',
    '#jsi .q .lbl{font-size:11.5px;opacity:.5;margin-top:8px;letter-spacing:.6px;text-transform:uppercase}',
    '#jsi .hit{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;',
    'padding:12px;margin-bottom:10px;display:flex;gap:11px;align-items:center}',
    '#jsi .hit.top{border-color:rgba(55,214,122,.5);background:rgba(55,214,122,.08)}',
    '#jsi .hit .th{width:62px;height:62px;flex:none;border-radius:11px;object-fit:cover;background:#0a0b12}',
    '#jsi .hit .m{flex:1;min-width:0}',
    '#jsi .hit .nm{font-size:14.5px;font-weight:600;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#jsi .hit .cd{font-family:ui-monospace,monospace;font-size:16px;font-weight:700;color:#f7d98a;letter-spacing:.6px}',
    '#jsi .hit .pc{font-size:11.5px;opacity:.55;margin-top:2px}',
    '#jsi .hit .cp{flex:none;padding:10px 12px;border-radius:11px;font-size:12.5px;font-weight:700;',
    'border:1px solid rgba(245,196,81,.45);background:rgba(245,196,81,.14);color:#f7d98a;cursor:pointer}',
    '#jsi .btn{display:block;padding:14px;border-radius:13px;text-align:center;font-weight:700;font-size:14.5px;',
    'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e8e8f0;cursor:pointer;margin-bottom:9px}',
    '#jsi .btn.green{border-color:rgba(55,214,122,.45);background:rgba(55,214,122,.13);color:#8ff0b5}',
    '#jsi .btn:active{transform:scale(.98)}',
    '#jsi .note{text-align:center;opacity:.55;font-size:13.5px;line-height:1.6;padding:14px 6px}',
    '#jsi .spin{text-align:center;padding:26px 10px;font-size:14px;opacity:.7}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('jsi-css')) return;
    var s = document.createElement('style');
    s.id = 'jsi-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function thumbOf(p) {
    var src = (p.images && p.images[0]) || '';
    if (typeof src === 'string' && src.indexOf('idb:') === 0) return '';   // sonra doldurulur
    return src;
  }

  function view() {
    var h = ['<div id="jsi">'];
    h.push('<h2>📥 Şəkillə axtarış</h2>');
    h.push('<div class="sub">Paylaşılan şəkil bazadaki mallarla müqayisə olunur</div>');

    if (!state.rec) {
      h.push('<div class="note">Paylaşılan şəkil yoxdur.<br><br>' +
             'WhatsApp-da və ya qalereyada şəkli aç → <b>Paylaş</b> → <b>JOLLY</b>.<br>' +
             'Şəkil buraya düşəcək və mal avtomatik axtarılacaq.</div>');
      h.push('</div>');
      return h.join('');
    }

    h.push('<div class="q">');
    if (state.url) h.push('<img src="' + state.url + '" alt="">');
    h.push('<div class="lbl">Axtarılan şəkil</div></div>');

    if (state.searching) {
      h.push('<div class="spin">🔍 Bazadakı şəkillərlə müqayisə olunur…</div>');
    } else if (state.error) {
      h.push('<div class="note">⚠️ Axtarış alınmadı: ' + esc(state.error) + '</div>');
    } else if (state.results && state.results.length) {
      var top = state.results[0];
      h.push('<div class="sub">' + state.results.length + ' oxşar mal tapıldı</div>');
      state.results.slice(0, 8).forEach(function (r, i) {
        var p = r.product, code = codeOf(p);
        h.push('<div class="hit' + (i === 0 && r.similarity >= GOOD ? ' top' : '') + '" data-open="' + esc(p.id) + '">');
        var t = thumbOf(p);
        h.push(t ? '<img class="th" src="' + esc(t) + '" alt="">' : '<div class="th"></div>');
        h.push('<div class="m"><div class="nm">' + esc(p.name || '(adsız)') + '</div>');
        h.push(code ? '<div class="cd">' + esc(code) + '</div>' : '<div class="pc">kod yoxdur</div>');
        h.push('<div class="pc">' + r.similarity + '% oxşar' +
               (p.price ? ' · ' + esc(p.price) + ' ₼' : '') + '</div></div>');
        if (code) h.push('<div class="cp" data-copy="' + esc(code) + '">📋 Kod</div>');
        h.push('</div>');
      });
      if (top.similarity < GOOD) {
        h.push('<div class="note">Oxşarlıq zəifdir (' + top.similarity + '%). ' +
               'Bu mal bazada yoxdursa, yenisini yarat.</div>');
        h.push('<div class="btn green" data-new="1">🆕 Yeni mal kimi əlavə et</div>');
      }
    } else {
      h.push('<div class="note">❌ Bu şəkilə uyğun mal tapılmadı.<br>' +
             'Deməli bu, bazada olmayan yeni maldır.</div>');
      h.push('<div class="btn green" data-new="1">🆕 Yeni mal kimi əlavə et</div>');
    }

    h.push('<div class="btn" data-again="1">🔄 Yenidən axtar</div>');
    h.push('<div class="btn" data-clear="1">🗑 Şəkli sil</div>');
    h.push('</div>');
    return h.join('');
  }

  function paint() {
    var host = document.getElementById('jsi-host');
    if (!host) return;
    host.innerHTML = view();
    hydrateThumbs();
  }

  // idb: şəkilləri sonradan doldurur (kartlarda boş qalmasın)
  function hydrateThumbs() {
    var S = lex('JollyStorage');
    if (!S || !state.results) return;
    state.results.slice(0, 8).forEach(function (r) {
      var p = r.product;
      var src = (p.images && p.images[0]) || '';
      if (typeof src !== 'string' || src.indexOf('idb:') !== 0) return;
      var get = S.getImage || S.get;
      if (typeof get !== 'function') return;
      Promise.resolve(get.call(S, src)).then(function (url) {
        if (!url) return;
        var row = document.querySelector('[data-open="' + p.id + '"] .th');
        if (row && row.tagName !== 'IMG') {
          var im = document.createElement('img');
          im.className = 'th'; im.src = url;
          row.parentNode.replaceChild(im, row);
        } else if (row) { row.src = url; }
      }).catch(function () {});
    });
  }

  function bind() {
    var root = document.getElementById('jsi-host');
    if (!root || root.__b) return;
    root.__b = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      var cp = t.closest && t.closest('[data-copy]');
      if (cp) { e.stopPropagation(); return copyCode(cp.getAttribute('data-copy')); }
      var nw = t.closest && t.closest('[data-new]');
      if (nw) return createNew();
      var ag = t.closest && t.closest('[data-again]');
      if (ag) { run(); return paint(); }
      var cl = t.closest && t.closest('[data-clear]');
      if (cl) { clearAll().then(function () { state.rec = null; state.results = null; paint(); }); return; }
      var op = t.closest && t.closest('[data-open]');
      if (op) return openProduct(op.getAttribute('data-open'));
    });
  }

  /* ----------------------------------------------------------------------
     6. API
     ---------------------------------------------------------------------- */
  var Inbox = {
    version: '2.0.0',

    render: function () {
      injectCSS();
      setTimeout(function () { bind(); run(); }, 0);
      return '<div id="jsi-host"><div id="jsi"><h2>📥 Şəkillə axtarış</h2>' +
             '<div class="spin">🔍 Paylaşılan şəkil oxunur…</div></div></div>';
    },
    afterRender: function () { injectCSS(); bind(); },

    open: function () {
      injectCSS();
      var main = document.getElementById('main') || document.body;
      main.innerHTML = '<div id="jsi-host"></div>';
      bind();
      return run();
    },

    search: run,
    clear: clearAll,
    pending: function () { return latest().then(function (r) { return !!r; }); },

    health: function () {
      return latest().then(function (rec) {
        var problems = [];
        if (!global.indexedDB) problems.push('IndexedDB yoxdur — paylaşma işləməz');
        if (!lex('JollyVisualSearch') && !document.querySelector('script[src*="visual-search.js"]')) {
          problems.push('visual-search.js hələ yüklənməyib (tənbəl yüklənir — normaldır)');
        }
        return { ok: problems.length === 0, problems: problems, pending: !!rec,
                 lastAt: rec ? rec.at : null };
      });
    },

    selfTest: function () {
      var out = { ok: false, idb: !!global.indexedDB, store: false, products: false };
      var P = global.Products || lex('Products');
      out.products = !!(P && typeof P.add === 'function');
      return open().then(function () { out.store = true; }, function () { out.store = false; })
        .then(function () {
          out.ok = out.idb && out.store;
          return out;
        });
    }
  };

  global.JollyShareInbox = Inbox;

  function registerAll() {
    try {
      if (global.POS && typeof global.POS.register === 'function') {
        global.POS.register({
          id: 'shareinbox', name: 'Şəkillə axtarış', icon: '📥',
          permissions: [{ key: PERM, label: 'Paylaşılan şəkillə mal axtar', tag: 'view', default: true }]
        });
      }
    } catch (e) {}
    try {
      var MR = lex('ModuleRegistry');
      if (MR && typeof MR.register === 'function') {
        MR.register({
          id: 'share-inbox', name: 'Şəkillə axtarış', icon: '📥',
          route: ROUTE, group: 'Alətlər', perm: PERM,
          render: Inbox.render, afterRender: Inbox.afterRender
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
