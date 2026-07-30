/* ==========================================================================
   JOLLY — jolly-share-inbox.js                v1.0.0   (2026-07-30)
   --------------------------------------------------------------------------
   📥 Paylaşılan Şəkillər (`#/share-inbox`)

   Telefonun paylaşma menyusundan JOLLY-yə göndərilən şəkilləri qəbul edir
   və məhsula bağlayır.

   AXIN:
     Qalereya → Paylaş → JOLLY
        → sw.js POST-u tutur, şəkli IndexedDB-yə yazır (`jolly_share`/`inbox`)
        → share-target.html önbaxış göstərir
        → "JOLLY-də aç" → bu ekran

   NİYƏ ƏVVƏL İŞLƏMİRDİ (2026-07-30 tapıldı):
     manifest paylaşmanı POST + multipart ilə göndərir (şəkil üçün yeganə yol),
     amma sw.js POST-u birbaşa serverə ötürürdü — Cloudflare statik fayla POST
     qəbul etmir və HTTP 405 verirdi. Üstəlik share-target.html məlumatı ünvan
     sətrindən oxuyurdu, POST-da isə orada heç nə olmur.

   İcazə açarı: share.inbox.view
   Yükləmə yeri: index.html-də jolly-undo.js-dən sonra
   ========================================================================== */

(function (global) {
  'use strict';

  var PERM  = 'share.inbox.view';
  var ROUTE = '#/share-inbox';

  var DB = 'jolly_share', STORE = 'inbox';

  var state = { items: [], selected: null, busy: false };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function kb(n) { return !n ? '—' : (n < 1024 ? n + ' B' : (n / 1024).toFixed(0) + ' KB'); }
  function ago(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + ' saniyə əvvəl';
    if (s < 3600) return Math.floor(s / 60) + ' dəqiqə əvvəl';
    if (s < 86400) return Math.floor(s / 3600) + ' saat əvvəl';
    return Math.floor(s / 86400) + ' gün əvvəl';
  }
  function toast(msg, kind) {
    try {
      if (global.Toast) {
        if (kind === 'error' && global.Toast.error) return global.Toast.error(msg);
        if (kind === 'ok' && global.Toast.success) return global.Toast.success(msg);
        if (global.Toast.info) return global.Toast.info(msg);
      }
    } catch (e) {}
    console.log('[Share inbox] ' + msg);
  }

  /* ----------------------------------------------------------------------
     1. IndexedDB
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

  function loadAll() {
    return open().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        q.onsuccess = function () {
          var all = (q.result || []).filter(function (r) { return !r.handled; });
          all.sort(function (a, b) { return b.at - a.at; });
          res(all);
        };
        q.onerror = function () { res([]); };
      });
    }).catch(function () { return []; });
  }

  function markHandled(id) {
    return open().then(function (db) {
      return new Promise(function (res) {
        var st = db.transaction(STORE, 'readwrite').objectStore(STORE);
        var g = st.get(id);
        g.onsuccess = function () {
          var rec = g.result;
          if (!rec) return res(false);
          rec.handled = true;
          rec.handledAt = Date.now();
          var p = st.put(rec);
          p.onsuccess = function () { res(true); };
          p.onerror = function () { res(false); };
        };
        g.onerror = function () { res(false); };
      });
    }).catch(function () { return false; });
  }

  function dropAll() {
    return open().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
        q.onsuccess = function () { res(true); };
        q.onerror = function () { res(false); };
      });
    }).catch(function () { return false; });
  }

  /* ----------------------------------------------------------------------
     2. Şəkli məhsula bağlamaq
     ---------------------------------------------------------------------- */
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

  // Şəkli JollyStorage-a (IndexedDB) yazır və açarı qaytarır
  function storeImage(dataUrl) {
    var S = global.JollyStorage;
    if (!S) return Promise.resolve(dataUrl);      // storage yoxdursa birbaşa data URL
    var key = 'share_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var tries = ['put', 'set', 'save', 'add'];
    for (var i = 0; i < tries.length; i++) {
      if (typeof S[tries[i]] === 'function') {
        try {
          var r = S[tries[i]](key, dataUrl);
          return Promise.resolve(r).then(function () { return key; }).catch(function () { return dataUrl; });
        } catch (e) {}
      }
    }
    return Promise.resolve(dataUrl);
  }

  function newProduct(rec) {
    if (state.busy) return;
    state.busy = true;

    var img = rec.images && rec.images[0];
    var p = img ? toDataUrl(img).then(storeImage) : Promise.resolve(null);

    p.then(function (imgKey) {
      var name = (rec.title || rec.text || '').trim().slice(0, 60);
      var data = { name: name || 'Paylaşılan şəkil', images: imgKey ? [imgKey] : [] };
      if (rec.text && rec.text !== name) data.note = String(rec.text).slice(0, 300);

      var P = global.Products || (global.JollyDB && global.JollyDB.Products);
      if (!P || typeof P.add !== 'function') {
        toast('Məhsul modulu tapılmadı', 'error');
        state.busy = false;
        return;
      }
      var created = P.add(data);
      return Promise.resolve(created).then(function (res) {
        var id = (res && (res.id || res)) || null;
        return markHandled(rec.id).then(function () {
          toast('Məhsul yaradıldı', 'ok');
          state.busy = false;
          if (id && global.Products && typeof global.Products.openEdit === 'function') {
            global.Products.openEdit(id);
          } else if (id) {
            global.location.hash = '#/products';
          } else {
            Inbox.open();
          }
        });
      });
    }).catch(function (e) {
      state.busy = false;
      toast('Alınmadı: ' + ((e && e.message) || e), 'error');
    });
  }

  function attachToExisting(rec) {
    var code = global.prompt('Hansı məhsula əlavə olunsun?\nBarkodu və ya adın bir hissəsini yaz:');
    if (!code) return;

    var P = global.Products || (global.JollyDB && global.JollyDB.Products);
    var list = [];
    try {
      if (P && typeof P.search === 'function') list = P.search(code) || [];
      else if (P && typeof P.all === 'function') {
        var q = String(code).toLowerCase();
        list = (P.all() || []).filter(function (x) {
          return String(x.barcode || '').indexOf(code) !== -1 ||
                 String(x.name || '').toLowerCase().indexOf(q) !== -1;
        });
      }
    } catch (e) {}

    if (!list.length) { toast('Uyğun məhsul tapılmadı', 'error'); return; }
    if (list.length > 1) {
      toast(list.length + ' məhsul tapıldı — daha dəqiq yaz (barkod ən yaxşısıdır)', 'error');
      return;
    }

    var target = list[0];
    var img = rec.images && rec.images[0];
    if (!img) { toast('Şəkil yoxdur', 'error'); return; }

    toDataUrl(img).then(storeImage).then(function (key) {
      var imgs = (target.images || []).slice();
      imgs.push(key);
      if (typeof P.update === 'function') P.update(target.id, { images: imgs });
      return markHandled(rec.id);
    }).then(function () {
      toast('Şəkil "' + (target.name || target.barcode) + '" məhsuluna əlavə olundu', 'ok');
      Inbox.open();
    }).catch(function (e) {
      toast('Alınmadı: ' + ((e && e.message) || e), 'error');
    });
  }

  /* ----------------------------------------------------------------------
     3. UI
     ---------------------------------------------------------------------- */
  var CSS = [
    '#jsi{padding:14px 12px 90px;max-width:720px;margin:0 auto;color:#e8e8f0}',
    '#jsi h2{font-size:19px;margin:0 0 3px;font-weight:700}',
    '#jsi .sub{font-size:12px;opacity:.6;margin-bottom:14px}',
    '#jsi .item{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);',
    'border-radius:16px;padding:12px;margin-bottom:12px}',
    '#jsi img{width:100%;max-height:260px;object-fit:contain;border-radius:12px;background:#0a0b12;',
    'border:1px solid rgba(255,255,255,.08);margin-bottom:10px}',
    '#jsi .meta{font-size:12px;opacity:.6;margin-bottom:10px;line-height:1.5}',
    '#jsi .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '#jsi .btn{padding:12px 10px;border-radius:12px;text-align:center;font-weight:600;font-size:13.5px;',
    'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e8e8f0;cursor:pointer}',
    '#jsi .btn.gold{border-color:rgba(245,196,81,.45);background:rgba(245,196,81,.13);color:#f7d98a}',
    '#jsi .btn:active{transform:scale(.97)}',
    '#jsi .empty{text-align:center;opacity:.55;padding:38px 12px;font-size:14px;line-height:1.6}',
    '#jsi .clear{margin-top:14px;font-size:12.5px;opacity:.5;text-align:center;cursor:pointer}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('jsi-css')) return;
    var s = document.createElement('style');
    s.id = 'jsi-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function view() {
    var h = ['<div id="jsi">'];
    h.push('<h2>📥 Paylaşılan Şəkillər</h2>');
    h.push('<div class="sub">Qalereyadan JOLLY-yə göndərilənlər</div>');

    if (!state.items.length) {
      h.push('<div class="empty">Gözləyən şəkil yoxdur.<br><br>' +
             'Qalereyada şəkli aç → <b>Paylaş</b> → <b>JOLLY</b> seç. ' +
             'Şəkil burada görünəcək.</div>');
    } else {
      state.items.forEach(function (rec, i) {
        h.push('<div class="item">');
        if (rec._url) h.push('<img src="' + rec._url + '" alt="">');
        h.push('<div class="meta">' + ago(rec.at) +
               (rec.images && rec.images[0] ? ' · ' + kb(rec.images[0].size) : '') +
               (rec.title ? '<br>Başlıq: ' + esc(rec.title) : '') +
               (rec.text ? '<br>Mətn: ' + esc(String(rec.text).slice(0, 120)) : '') +
               '</div>');
        h.push('<div class="row">' +
               '<div class="btn gold" data-new="' + i + '">🆕 Yeni məhsul</div>' +
               '<div class="btn" data-att="' + i + '">🔗 Mövcuda əlavə</div>' +
               '</div>');
        h.push('</div>');
      });
      h.push('<div class="clear" data-clear="1">🗑 Hamısını təmizlə</div>');
    }

    h.push('</div>');
    return h.join('');
  }

  function bind() {
    var root = document.getElementById('jsi');
    if (!root || root.__b) return;
    root.__b = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      var n = t.closest('[data-new]'), a = t.closest('[data-att]'), c = t.closest('[data-clear]');
      if (n) return newProduct(state.items[+n.getAttribute('data-new')]);
      if (a) return attachToExisting(state.items[+a.getAttribute('data-att')]);
      if (c) {
        if (!global.confirm('Bütün paylaşılan şəkillər silinsin?')) return;
        dropAll().then(function () { toast('Təmizləndi', 'ok'); Inbox.open(); });
      }
    });
  }

  function prepare() {
    return loadAll().then(function (items) {
      items.forEach(function (rec) {
        var img = rec.images && rec.images[0];
        if (!img) return;
        try {
          rec._url = URL.createObjectURL(new Blob([img.data], { type: img.type || 'image/jpeg' }));
        } catch (e) {}
      });
      state.items = items;
      return items;
    });
  }

  /* ----------------------------------------------------------------------
     4. API
     ---------------------------------------------------------------------- */
  var Inbox = {
    version: '1.0.0',

    render: function () {
      injectCSS();
      prepare().then(function () {
        var host = document.getElementById('jsi-host');
        if (host) { host.innerHTML = view(); bind(); }
      });
      return '<div id="jsi-host"><div id="jsi"><h2>📥 Paylaşılan Şəkillər</h2>' +
             '<div class="sub">yüklənir…</div></div></div>';
    },
    afterRender: function () { injectCSS(); bind(); },

    open: function () {
      injectCSS();
      var main = document.getElementById('main') || document.body;
      return prepare().then(function () {
        main.innerHTML = '<div id="jsi-host">' + view() + '</div>';
        bind();
      });
    },

    count: function () { return loadAll().then(function (a) { return a.length; }); },
    clear: dropAll,

    health: function () {
      return loadAll().then(function (items) {
        var problems = [];
        if (!global.indexedDB) problems.push('IndexedDB yoxdur — paylaşma işləməyəcək');
        if (items.length > 10) problems.push(items.length + ' paylaşılan şəkil gözləyir');
        return { ok: problems.length === 0, problems: problems, pending: items.length };
      });
    },

    selfTest: function () {
      var out = { ok: false, idb: !!global.indexedDB, store: false, products: false };
      out.products = !!(global.Products && typeof global.Products.add === 'function');
      return open().then(function () { out.store = true; })
        .catch(function () { out.store = false; })
        .then(function () {
          out.ok = out.idb && out.store;
          out.note = out.products ? '' : 'Products modulu tapılmadı — şəkil məhsula bağlanmayacaq';
          return out;
        });
    }
  };

  global.JollyShareInbox = Inbox;

  function registerAll() {
    try {
      if (global.POS && typeof global.POS.register === 'function') {
        global.POS.register({
          id: 'shareinbox', name: 'Paylaşılan Şəkillər', icon: '📥',
          permissions: [{ key: PERM, label: 'Paylaşılan şəkilləri məhsula bağla', tag: 'edit', default: true }]
        });
      }
    } catch (e) {}
    try {
      var MR = global.ModuleRegistry ||
        new Function('try{return typeof ModuleRegistry!=="undefined"?ModuleRegistry:null}catch(e){return null}')();
      if (MR && typeof MR.register === 'function') {
        MR.register({
          id: 'share-inbox', name: 'Paylaşılan Şəkillər', icon: '📥',
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
