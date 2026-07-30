/* ==========================================================================
   JOLLY — jolly-share-inbox.js                v3.1.0   (2026-07-30)
   --------------------------------------------------------------------------
   📥 ŞƏKİLLƏ AXTARIŞ (paylaşma ilə)

   AXIN: müştəri WhatsApp-da mal şəkli atır → Paylaş → JOLLY
         → proqram malı tapır → KODU verir

   v3.0-da yeni:
     • Medal sırası:  🥇 96%  🥈 94%  🥉 91%  4️⃣  5️⃣
     • Barkod önə: şəkildə barkod varsa dərhal onunla tapır
     • Bal izahı hər sətirdə: "ön şəkil +10 · marka +10 · rəng +5"
     • "✅ Düzgün mal" düyməsi — proqram öyrənir (v3 maddə 15),
       növbəti dəfə eyni tipli şəkildə həmin mal öndə gəlir
     • "⚡ Barmaq izlərini hazırla" — bütün kataloq əvvəlcədən
       hesablanır, sonraki axtarışlar ~0.8 saniyəyə düşür
     • Diaqnostika bloku: mal / şəkil / oxundu / xəta / vaxt / OCR / barkod
     • Boş ekran YOXDUR — həmişə ən yaxın 5 mal

   v3.1-də yeni:
     • OCR artıq GÖZLƏTMİR — vizual nəticə dərhal çıxır, marka sonra
       gəlsə sıra özü yenilənir (Tesseract 2 MB-dır, ilk dəfə yavaş)
     • Bir neçə şəkil birdən paylaşılsa hamısı qəbul olunur —
       yuxarıda 🖼 1 · 2 · 3 çipləri ilə keçid
     • Güclü uyğunluqda BÖYÜK kod kartı: 📋 Kopyala · ↩ WhatsApp-a göndər
       (kodu müştəriyə birbaşa geri göndərir)
     • 🕐 Son axtarışlar — son 5 sorğu, kod bir toxunuşla kopyalanır
     • 🧠 Öyrənilmiş uyğunluqların sayı + sıfırlama
     • ⚡ düyməsi neçə şəklin hazır olmadığını göstərir

   İcazə açarı: share.inbox.view (axtarış üçün `search.photo`)
   ========================================================================== */

(function (global) {
  'use strict';

  var PERM  = 'share.inbox.view';
  var ROUTE = '#/share-inbox';
  var DB = 'jolly_share', STORE = 'inbox';

  var SHOW = 5, STRONG = 72, MAYBE = 58;
  var MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

  var state = {
    rec: null, url: null, results: null, stats: null, total: 0,
    barcode: null, brand: null, viaBarcode: false,
    searching: false, error: null, source: null, warm: null, confirmed: {},
    items: [], idx: 0, history: [], learned: null, need: null
  };

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

  /* ---------- 1. paylaşılan şəkil (sw.js bura yazır) ---------- */

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

  function allRecords() {
    return open().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        q.onsuccess = function () {
          var all = (q.result || []).filter(function (r) { return r.images && r.images.length; });
          all.sort(function (a, b) { return b.at - a.at; });
          res(all);
        };
        q.onerror = function () { res([]); };
      });
    }).catch(function () { return []; });
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

  /* ---------- 2. motor ---------- */

  function ensureVisual() {
    var vs = lex('JollyVisualSearch');
    if (vs) return Promise.resolve(vs);
    try { var L = lex('JollyLazy'); if (L && L.flush) L.flush(); } catch (e) {}
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

  function progress(done, total) {
    var el = document.getElementById('jsi-prog');
    if (el) el.textContent = '🔍 ' + done + ' / ' + total + ' mal yoxlanıldı…';
  }

  /* ---------- 3. axtarış ---------- */

  function searchDataUrl(dataUrl, sourceLabel) {
    state._dataUrl = dataUrl;
    state.source = sourceLabel || 'paylaşma';
    state.searching = true;
    state.error = null; state.results = null; state.stats = null;
    state.barcode = null; state.brand = null; state.viaBarcode = false;
    state.confirmed = {};
    paint();

    return ensureVisual().then(function (vs) {
      if (typeof vs.findBest === 'function') {
        return vs.findBest(dataUrl, { limit: SHOW, onProgress: progress });
      }
      return vs.findSimilar(dataUrl, 30).then(function (r) {
        return { results: (r || []).slice(0, SHOW), stats: null, total: (r || []).length };
      });
    }).then(function (out) {
      state.results = out.results || [];
      state.total = out.total || state.results.length;
      state.stats = out.stats || null;
      state.barcode = out.barcode || null;
      state.brand = out.brand || null;
      state.viaBarcode = !!out.viaBarcode;
      state.searching = false;
      paint();

      // tarixçəyə yaz
      try {
        var vsx = lex('JollyVisualSearch'), t0 = state.results[0];
        if (vsx && vsx.history && t0) {
          vsx.history.add({
            code: codeOf(t0.product), name: t0.product.name,
            similarity: t0.similarity, via: t0.via, pid: t0.product.id
          }).then(function () { sidebarInfo(); });
        }
      } catch (e) {}

      // OCR gec gəldi — sıranı yenilə
      if (out.ocrPending && typeof out.ocrPending.then === 'function') {
        out.ocrPending.then(function (info) {
          if (!info) { paint(); return; }
          var vsx = lex('JollyVisualSearch');
          if (vsx && typeof vsx.applyText === 'function') {
            state.results = vsx.applyText(info.tokens, info.brand, SHOW);
            state.brand = info.brand || null;
            toast(info.brand ? ('🔤 Marka oxundu: ' + info.brand + ' — sıra yeniləndi')
                             : '🔤 Yazılar oxundu — sıra yeniləndi');
          }
          paint();
        }).catch(function () {});
      }
    }).catch(function (e) {
      state.searching = false;
      state.error = (e && e.message) || String(e);
      paint();
    });
  }

  function run() {
    if (state.searching) return Promise.resolve();
    sidebarInfo();
    return allRecords().then(function (recs) {
      var items = [];
      recs.forEach(function (rec) {
        (rec.images || []).forEach(function (im) { items.push({ at: rec.at, img: im }); });
      });
      state.items = items;
      if (!items.length) { state.rec = null; paint(); return; }
      state.rec = { at: items[0].at };
      return selectItem(0);
    }).catch(function (e) {
      state.error = (e && e.message) || String(e);
      paint();
    });
  }

  /* bir neçə şəkil paylaşılıbsa — birindən birinə keçid */
  function selectItem(i) {
    var it = state.items[i];
    if (!it) return Promise.resolve();
    state.idx = i;
    try {
      state.url = URL.createObjectURL(new Blob([it.img.data], { type: it.img.type || 'image/jpeg' }));
    } catch (e) {}
    paint();
    return toDataUrl(it.img).then(function (dataUrl) {
      return searchDataUrl(dataUrl, 'paylaşma');
    });
  }

  /* tarixçə + öyrənmə sayı + hazır olmayan şəkillər */
  function sidebarInfo() {
    ensureVisual().then(function (vs) {
      if (vs.history && vs.history.list) {
        vs.history.list(5).then(function (rows) { state.history = rows || []; paint(); }).catch(function () {});
      }
      if (typeof vs.learned === 'function') {
        vs.learned().then(function (n) { state.learned = n; paint(); }).catch(function () {});
      }
      if (typeof vs.warmupNeeded === 'function') {
        vs.warmupNeeded().then(function (n) { state.need = n; paint(); }).catch(function () {});
      }
    }).catch(function () {});
  }

  function pickFromGallery() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function (ev) {
        state.rec = { at: Date.now(), manual: true };
        state.url = ev.target.result;
        searchDataUrl(ev.target.result, 'qalereya');
      };
      fr.readAsDataURL(f);
    };
    input.click();
  }

  /* ---------- 12. barmaq izlərini hazırla ---------- */

  function warmup() {
    ensureVisual().then(function (vs) {
      if (typeof vs.warmup !== 'function') { toast('Bu motor warmup dəstəkləmir', 'error'); return; }
      state.warm = { done: 0, total: 0, made: 0, errors: 0, running: true };
      paint();
      return vs.warmup({
        onProgress: function (done, total, made, errors) {
          state.warm = { done: done, total: total, made: made, errors: errors, running: true };
          var el = document.getElementById('jsi-warm');
          if (el) el.textContent = '⚡ ' + done + ' / ' + total + ' şəkil hazırlanır… (yeni: ' + made + ', xəta: ' + errors + ')';
        }
      }).then(function (r) {
        state.warm = { done: r.images, total: r.images, made: r.created, errors: r.errors, running: false, cached: r.cached };
        toast('Hazırdır — ' + r.created + ' yeni barmaq izi, keşdə ' + r.cached, 'ok');
        paint();
      });
    }).catch(function (e) { toast('Alınmadı: ' + ((e && e.message) || e), 'error'); });
  }

  /* ---------- 15. öyrənmə ---------- */

  function confirmMatch(id) {
    ensureVisual().then(function (vs) {
      if (typeof vs.confirm !== 'function') { toast('Bu motor öyrənməni dəstəkləmir', 'error'); return; }
      return vs.confirm(id);
    }).then(function (ok) {
      if (ok) {
        state.confirmed[String(id)] = true;
        toast('Yadda saxlandı — növbəti dəfə bu mal öndə gələcək', 'ok');
        paint();
      } else { toast('Yadda saxlanmadı', 'error'); }
    }).catch(function (e) { toast('Alınmadı: ' + ((e && e.message) || e), 'error'); });
  }

  function copyCode(txt) {
    if (global.navigator && global.navigator.clipboard) {
      global.navigator.clipboard.writeText(txt).then(function () {
        toast('Kod kopyalandı: ' + txt, 'ok');
      }, function () { toast('Kopyalanmadı — ' + txt, 'error'); });
    } else { toast('Kod: ' + txt); }
  }

  function codeOf(p) {
    return p.barcode || p.specialCode || p.code || p.modelNo || '';
  }

  /* kodu birbaşa WhatsApp-a (və ya istənilən proqrama) geri göndər */
  function shareCode(code) {
    try {
      if (global.navigator && global.navigator.share) {
        return global.navigator.share({ text: String(code) }).catch(function () { copyCode(code); });
      }
    } catch (e) {}
    copyCode(code);
  }

  function forgetLearning() {
    ensureVisual().then(function (vs) {
      if (typeof vs.clearLearning !== 'function') return;
      return vs.clearLearning().then(function () {
        state.learned = 0;
        toast('Öyrənilmiş uyğunluqlar silindi', 'ok');
        sidebarInfo();
      });
    }).catch(function () {});
  }

  /* ---------- yeni mal ---------- */

  function createNew() {
    var P = global.Products || (global.JollyDB && global.JollyDB.Products) || lex('Products');
    if (!P || typeof P.add !== 'function') { toast('Məhsul modulu tapılmadı', 'error'); return; }
    var S = lex('JollyStorage');
    var img = state._dataUrl;
    if (!img) { toast('Şəkil yoxdur', 'error'); return; }
    var save = (S && typeof S.saveImage === 'function') ? S.saveImage(img) : Promise.resolve(img);

    Promise.resolve(save).then(function (ref) {
      var fields = { name: '', images: [ref] };
      if (state.barcode) fields.barcode = state.barcode;
      return Promise.resolve(P.add(fields));
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

  /* ---------- UI ---------- */

  var CSS = [
    '#jsi{padding:14px 12px 90px;max-width:720px;margin:0 auto;color:#e8e8f0}',
    '#jsi h2{font-size:19px;margin:0 0 3px;font-weight:700}',
    '#jsi .sub{font-size:12px;opacity:.62;margin-bottom:14px;line-height:1.55}',
    '#jsi .q{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);',
    'border-radius:16px;padding:12px;margin-bottom:12px;text-align:center}',
    '#jsi .q img{width:100%;max-height:220px;object-fit:contain;border-radius:12px;background:#0a0b12}',
    '#jsi .q .lbl{font-size:11.5px;opacity:.5;margin-top:8px;letter-spacing:.6px;text-transform:uppercase}',
    '#jsi .bc{border-radius:13px;padding:11px 13px;margin-bottom:12px;font-size:13px;line-height:1.5;',
    'border:1px solid rgba(55,214,122,.4);background:rgba(55,214,122,.1);color:#a8f0c6}',
    '#jsi .bc b{font-family:ui-monospace,monospace;letter-spacing:.5px}',
    '#jsi .hit{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;',
    'padding:12px;margin-bottom:10px}',
    '#jsi .hit.top{border-color:rgba(55,214,122,.5);background:rgba(55,214,122,.08)}',
    '#jsi .hit.maybe{border-color:rgba(245,196,81,.4)}',
    '#jsi .row{display:flex;gap:11px;align-items:center}',
    '#jsi .th{width:62px;height:62px;flex:none;border-radius:11px;object-fit:cover;background:#0a0b12}',
    '#jsi .m{flex:1;min-width:0}',
    '#jsi .nm{font-size:14.5px;font-weight:600;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#jsi .cd{font-family:ui-monospace,monospace;font-size:16px;font-weight:700;color:#f7d98a;letter-spacing:.6px}',
    '#jsi .pc{font-size:11.5px;opacity:.58;margin-top:2px}',
    '#jsi .bar{height:4px;border-radius:3px;background:rgba(255,255,255,.09);margin-top:6px;overflow:hidden}',
    '#jsi .bar i{display:block;height:100%;background:#37d67a}',
    '#jsi .hit.maybe .bar i{background:#f5c451}',
    '#jsi .hit.weak .bar i{background:#8a8a99}',
    '#jsi .cp{flex:none;padding:10px 12px;border-radius:11px;font-size:12.5px;font-weight:700;',
    'border:1px solid rgba(245,196,81,.45);background:rgba(245,196,81,.14);color:#f7d98a;cursor:pointer}',
    '#jsi .why{margin-top:8px;display:flex;flex-wrap:wrap;gap:5px}',
    '#jsi .chip{font-size:10.5px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.07);',
    'border:1px solid rgba(255,255,255,.1);opacity:.8}',
    '#jsi .ok{margin-top:9px;padding:9px;border-radius:11px;text-align:center;font-size:12.5px;font-weight:700;',
    'border:1px solid rgba(120,180,255,.35);background:rgba(120,180,255,.1);color:#bcd8ff;cursor:pointer}',
    '#jsi .ok.done{border-color:rgba(55,214,122,.45);background:rgba(55,214,122,.14);color:#8ff0b5}',
    '#jsi .btn{display:block;padding:14px;border-radius:13px;text-align:center;font-weight:700;font-size:14.5px;',
    'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e8e8f0;cursor:pointer;margin-bottom:9px}',
    '#jsi .btn.green{border-color:rgba(55,214,122,.45);background:rgba(55,214,122,.13);color:#8ff0b5}',
    '#jsi .btn:active{transform:scale(.98)}',
    '#jsi .note{text-align:center;opacity:.6;font-size:13.5px;line-height:1.6;padding:12px 6px}',
    '#jsi .spin{text-align:center;padding:26px 10px;font-size:14px;opacity:.75}',
    '#jsi .stats{margin-top:14px;padding:11px 12px;border-radius:13px;background:rgba(255,255,255,.03);',
    'border:1px solid rgba(255,255,255,.07);font-size:11.5px;line-height:1.8;opacity:.75;font-family:ui-monospace,monospace}',
    '#jsi .stats b{color:#f7d98a;font-weight:700}',
    '#jsi .warn{color:#ff9d9d}',
    '#jsi .chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}',
    '#jsi .ich{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:700;cursor:pointer;',
    'border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05)}',
    '#jsi .ich.on{border-color:rgba(245,196,81,.5);background:rgba(245,196,81,.14);color:#f7d98a}',
    '#jsi .big{border:1px solid rgba(55,214,122,.45);background:rgba(55,214,122,.09);',
    'border-radius:18px;padding:16px 14px;margin-bottom:13px;text-align:center}',
    '#jsi .big .bc2{font-family:ui-monospace,monospace;font-size:27px;font-weight:800;color:#f7d98a;',
    'letter-spacing:1.5px;word-break:break-all;line-height:1.25}',
    '#jsi .big .bn{font-size:12.5px;opacity:.7;margin-top:5px}',
    '#jsi .big .brow{display:flex;gap:8px;margin-top:12px}',
    '#jsi .big .bb{flex:1;padding:12px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;',
    'border:1px solid rgba(245,196,81,.45);background:rgba(245,196,81,.14);color:#f7d98a}',
    '#jsi .big .bb.send{border-color:rgba(55,214,122,.5);background:rgba(55,214,122,.16);color:#8ff0b5}',
    '#jsi .hbox{margin-top:14px;padding:11px 12px;border-radius:13px;background:rgba(255,255,255,.03);',
    'border:1px solid rgba(255,255,255,.07)}',
    '#jsi .hbox .ht{font-size:11.5px;opacity:.55;letter-spacing:.6px;text-transform:uppercase;margin-bottom:8px}',
    '#jsi .hrow{display:flex;justify-content:space-between;gap:9px;padding:7px 0;font-size:12.5px;',
    'border-top:1px solid rgba(255,255,255,.05);cursor:pointer}',
    '#jsi .hrow b{font-family:ui-monospace,monospace;color:#f7d98a}',
    '#jsi .lrn{display:flex;justify-content:space-between;align-items:center;gap:9px;margin-top:10px;',
    'font-size:12.5px;opacity:.8}',
    '#jsi .lrn span.x{padding:7px 11px;border-radius:10px;cursor:pointer;',
    'border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05)}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('jsi-css')) return;
    var s = document.createElement('style');
    s.id = 'jsi-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function thumbOf(p) {
    var src = (p.images && p.images[0]) || p.image || p.img || '';
    if (typeof src === 'string' && src.indexOf('idb:') === 0) return '';
    return src;
  }

  /* 13 — diaqnostika */
  function statsBlock() {
    var s = state.stats;
    if (!s) return '';
    var h = ['<div class="stats">'];
    h.push('Məhsul: <b>' + s.products + '</b><br>');
    h.push('Şəkil: <b>' + s.images + '</b><br>');
    h.push('Oxundu: <b>' + (s.read + s.fromCache) + '</b> (keşdən ' + s.fromCache + ')<br>');
    h.push('Xəta: <b class="' + (s.errors ? 'warn' : '') + '">' + s.errors + '</b><br>');
    h.push('Axtarış vaxtı: <b>' + (s.ms / 1000).toFixed(2) + ' s</b><br>');
    h.push('Variant: <b>' + (s.variants || 0) + '</b> · OCR: <b>' + esc(s.ocr || '—') + '</b><br>');
    h.push('Barkod: <b>' + esc(s.barcode || '—') + '</b> · mənbə: <b>' + esc(state.source || '') + '</b>');
    if (s.images === 0) {
      h.push('<br><span class="warn">⚠️ Kataloqda şəkil yoxdur — vizual axtarış işləyə bilməz.</span>');
    } else if (s.errors > s.images / 2) {
      h.push('<br><span class="warn">⚠️ Şəkillərin yarısından çoxu açılmadı.</span>');
    }
    if (s.read > 40) {
      h.push('<br>💡 “⚡ Barmaq izlərini hazırla” düyməsi ilə növbəti axtarışlar dəfələrlə sürətlənir.');
    }
    h.push('</div>');
    return h.join('');
  }

  function bigCard(r) {
    var code = codeOf(r.product);
    if (!code) return '';
    var h = ['<div class="big">'];
    h.push('<div class="bc2">' + esc(code) + '</div>');
    h.push('<div class="bn">' + esc(r.product.name || '(adsız)') + ' · ' + r.similarity + '%' +
           (r.via === 'barkod' ? ' · barkodla' : '') + '</div>');
    h.push('<div class="brow">');
    h.push('<div class="bb" data-copy="' + esc(code) + '">📋 Kopyala</div>');
    h.push('<div class="bb send" data-send="' + esc(code) + '">↩ WhatsApp-a göndər</div>');
    h.push('</div></div>');
    return h.join('');
  }

  function chipsBlock() {
    if (!state.items || state.items.length < 2) return '';
    var h = ['<div class="chips">'];
    state.items.forEach(function (it, i) {
      h.push('<div class="ich' + (i === state.idx ? ' on' : '') + '" data-item="' + i + '">🖼 ' + (i + 1) + '</div>');
    });
    h.push('</div>');
    return h.join('');
  }

  function historyBlock() {
    var h = [];
    if (state.history && state.history.length) {
      h.push('<div class="hbox"><div class="ht">🕐 Son axtarışlar</div>');
      state.history.forEach(function (r) {
        h.push('<div class="hrow" data-copy="' + esc(r.code || '') + '">' +
               '<span>' + esc((r.name || '(adsız)')).slice(0, 26) + '</span>' +
               '<span><b>' + esc(r.code || '—') + '</b> · ' + (r.similarity || 0) + '%</span></div>');
      });
      h.push('</div>');
    }
    if (state.learned !== null && state.learned !== undefined) {
      h.push('<div class="lrn"><span>🧠 Öyrənilmiş uyğunluq: <b>' + state.learned + '</b></span>' +
             (state.learned ? '<span class="x" data-forget="1">🧹 Sıfırla</span>' : '') + '</div>');
    }
    return h.join('');
  }

  function warmLabel() {
    if (state.need && state.need.missing) {
      return '⚡ Barmaq izlərini hazırla (' + state.need.missing + ' şəkil hazır deyil)';
    }
    if (state.need && state.need.total) return '⚡ Barmaq izləri hazırdır (' + state.need.total + ' şəkil)';
    return '⚡ Barmaq izlərini hazırla';
  }

  function hitRow(r, i) {
    var p = r.product, code = codeOf(p);
    var cls = r.similarity >= STRONG ? ' top' : (r.similarity >= MAYBE ? ' maybe' : ' weak');
    var done = !!state.confirmed[String(p.id)];
    var h = ['<div class="hit' + cls + '">'];
    h.push('<div class="row" data-open="' + esc(p.id) + '">');
    var t = thumbOf(p);
    h.push(t ? '<img class="th" src="' + esc(t) + '" alt="">' : '<div class="th" data-th="' + esc(p.id) + '"></div>');
    h.push('<div class="m">');
    h.push('<div class="nm">' + (MEDALS[i] || (i + 1) + '.') + ' ' + esc(p.name || '(adsız)') + '</div>');
    h.push(code ? '<div class="cd">' + esc(code) + '</div>' : '<div class="pc">kod yoxdur</div>');
    h.push('<div class="pc">' + r.similarity + '% oxşar' +
           (r.base !== undefined && r.base !== r.similarity ? ' (şəkil ' + r.base + '%)' : '') +
           (p.price ? ' · ' + esc(p.price) + ' ₼' : '') + '</div>');
    h.push('<div class="bar"><i style="width:' + Math.max(3, r.similarity) + '%"></i></div>');
    h.push('</div>');
    if (code) h.push('<div class="cp" data-copy="' + esc(code) + '">📋 Kod</div>');
    h.push('</div>');

    if (r.bonuses && r.bonuses.length) {
      h.push('<div class="why">');
      r.bonuses.forEach(function (b) { h.push('<span class="chip">' + esc(b) + '</span>'); });
      if (r.variant && r.variant !== '—') h.push('<span class="chip">' + esc(r.variant) + '</span>');
      h.push('</div>');
    }
    h.push('<div class="ok' + (done ? ' done' : '') + '" data-ok="' + esc(p.id) + '">' +
           (done ? '✅ Yadda saxlanıldı' : '✅ Düzgün mal — yadda saxla') + '</div>');
    h.push('</div>');
    return h.join('');
  }

  function view() {
    var h = ['<div id="jsi">'];
    h.push('<h2>📥 Şəkillə axtarış</h2>');

    if (!state.rec) {
      h.push('<div class="sub">Şəkil bazadakı mal şəkilləri ilə müqayisə olunur</div>');
      h.push('<div class="note">Paylaşılan şəkil yoxdur.<br><br>' +
             'WhatsApp-da və ya qalereyada şəkli aç → <b>Paylaş</b> → <b>JOLLY</b>.</div>');
      h.push('<div class="btn" data-pick="1">📁 Qalereyadan şəkil seç</div>');
      h.push('<div class="btn" data-warm="1" id="jsi-warmbtn">' + warmLabel() + '</div>');
      if (state.warm) {
        h.push('<div class="stats" id="jsi-warm">⚡ ' + state.warm.done + ' / ' + state.warm.total +
               ' · yeni: ' + state.warm.made + ' · xəta: ' + state.warm.errors +
               (state.warm.running ? '' : ' · bitdi') + '</div>');
      }
      h.push(historyBlock());
      h.push('</div>');
      return h.join('');
    }

    h.push('<div class="sub">Şəkil bazadakı mal şəkilləri ilə müqayisə olunur</div>');
    h.push(chipsBlock());
    h.push('<div class="q">');
    if (state.url) h.push('<img src="' + state.url + '" alt="">');
    h.push('<div class="lbl">Axtarılan şəkil</div></div>');

    if (state.barcode) {
      h.push('<div class="bc">📊 Şəkildə barkod oxundu: <b>' + esc(state.barcode) + '</b>' +
             (state.viaBarcode ? ' — mal barkodla tapıldı, bu ən dəqiq nəticədir.'
                               : ' — bu barkodla bazada mal yoxdur, vizual axtarışa keçildi.') + '</div>');
    }
    if (state.brand) {
      h.push('<div class="sub">🔤 Şəkildə oxunan marka: <b>' + esc(state.brand) + '</b> — bu markanın malları önə keçirilib.</div>');
    }

    if (state.searching) {
      h.push('<div class="spin" id="jsi-prog">🔍 Müqayisə olunur…</div>');
    } else if (state.error) {
      h.push('<div class="note warn">⚠️ Axtarış alınmadı: ' + esc(state.error) + '</div>');
    } else if (state.results && state.results.length) {
      var top = state.results[0];
      if (state.viaBarcode) h.push('<div class="sub">Barkoda görə tapıldı:</div>');
      else if (top.similarity >= STRONG) h.push('<div class="sub">✅ Güclü uyğunluq. Kodu kopyala:</div>');
      else if (top.similarity >= MAYBE) h.push('<div class="sub">🟡 Ehtimal olunan uyğunluq — şəkillərə bax, düzdürsə kodu götür:</div>');
      else h.push('<div class="sub">Dəqiq uyğunluq yoxdur. Ən yaxın ' + state.results.length + ' mal — özün qərar ver:</div>');

      if (state.viaBarcode || top.similarity >= STRONG) h.push(bigCard(top));
      state.results.forEach(function (r, i) { h.push(hitRow(r, i)); });
      h.push('<div class="note">Bu mallardan heç biri deyilsə:</div>');
      h.push('<div class="btn green" data-new="1">🆕 Yeni mal kimi əlavə et</div>');
    } else {
      h.push('<div class="note">Kataloqda şəkli olan mal yoxdur — müqayisə edəcək bir şey tapılmadı.</div>');
      h.push('<div class="btn green" data-new="1">🆕 Yeni mal kimi əlavə et</div>');
    }

    h.push('<div class="btn" data-again="1">🔄 Yenidən axtar</div>');
    h.push('<div class="btn" data-pick="1">📁 Qalereyadan şəkil seç</div>');
    h.push('<div class="btn" data-warm="1">' + warmLabel() + '</div>');
    if (state.warm) {
      h.push('<div class="stats" id="jsi-warm">⚡ ' + state.warm.done + ' / ' + state.warm.total +
             ' · yeni: ' + state.warm.made + ' · xəta: ' + state.warm.errors +
             (state.warm.running ? '' : ' · bitdi') + '</div>');
    }
    h.push('<div class="btn" data-clear="1">🗑 Şəkli sil</div>');
    h.push(statsBlock());
    h.push(historyBlock());
    h.push('</div>');
    return h.join('');
  }

  function paint() {
    var host = document.getElementById('jsi-host');
    if (!host) return;
    host.innerHTML = view();
    hydrateThumbs();
  }

  function hydrateThumbs() {
    var S = lex('JollyStorage');
    if (!S || !state.results) return;
    state.results.forEach(function (r) {
      var p = r.product;
      var src = (p.images && p.images[0]) || p.image || p.img || '';
      if (typeof src !== 'string' || src.indexOf('idb:') !== 0) return;
      var get = S.getImage || S.get;
      if (typeof get !== 'function') return;
      Promise.resolve(get.call(S, src)).then(function (url) {
        if (!url) return;
        var box = document.querySelector('[data-th="' + p.id + '"]');
        if (box) {
          var im = document.createElement('img');
          im.className = 'th'; im.src = url;
          box.parentNode.replaceChild(im, box);
        }
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
      var sd = t.closest && t.closest('[data-send]');
      if (sd) { e.stopPropagation(); return shareCode(sd.getAttribute('data-send')); }
      var it = t.closest && t.closest('[data-item]');
      if (it) { e.stopPropagation(); return selectItem(parseInt(it.getAttribute('data-item'), 10) || 0); }
      var fg = t.closest && t.closest('[data-forget]');
      if (fg) { e.stopPropagation(); return forgetLearning(); }
      var ok = t.closest && t.closest('[data-ok]');
      if (ok) { e.stopPropagation(); return confirmMatch(ok.getAttribute('data-ok')); }
      var nw = t.closest && t.closest('[data-new]');
      if (nw) return createNew();
      var pk = t.closest && t.closest('[data-pick]');
      if (pk) return pickFromGallery();
      var wm = t.closest && t.closest('[data-warm]');
      if (wm) return warmup();
      var ag = t.closest && t.closest('[data-again]');
      if (ag) {
        if (state._dataUrl) return searchDataUrl(state._dataUrl, state.source);
        return run();
      }
      var cl = t.closest && t.closest('[data-clear]');
      if (cl) {
        return clearAll().then(function () {
          state.rec = null; state.results = null; state.stats = null;
          state._dataUrl = null; state.barcode = null; state.brand = null;
          paint();
        });
      }
      var op = t.closest && t.closest('[data-open]');
      if (op) return openProduct(op.getAttribute('data-open'));
    });
  }

  /* ---------- API ---------- */

  var Inbox = {
    version: '3.1.0',

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
    pick: pickFromGallery,
    warmup: warmup,
    clear: clearAll,
    stats: function () { return state.stats; },
    history: function (n) {
      return ensureVisual().then(function (vs) {
        return (vs.history && vs.history.list) ? vs.history.list(n || 20) : [];
      });
    },
    pending: function () { return latest().then(function (r) { return !!r; }); },

    health: function () {
      return latest().then(function (rec) {
        var problems = [];
        if (!global.indexedDB) problems.push('IndexedDB yoxdur — paylaşma işləməz');
        var vs = lex('JollyVisualSearch');
        if (vs && vs.version !== '3.1.0') problems.push('visual-search.js köhnədir (v3.1.0 lazımdır)');
        if (!vs && !document.querySelector('script[src*="visual-search.js"]')) {
          problems.push('visual-search.js hələ yüklənməyib (tənbəl yüklənir — normaldır)');
        }
        if (typeof BarcodeDetector === 'undefined') problems.push('Barkod aşkarlanması bu brauzerdə yoxdur (vizual axtarış işləyir)');
        return { ok: problems.length === 0, problems: problems, pending: !!rec, lastAt: rec ? rec.at : null };
      });
    },

    selfTest: function () {
      var out = { ok: false, idb: !!global.indexedDB, store: false, products: false, engine: null };
      var P = global.Products || lex('Products');
      out.products = !!(P && typeof P.add === 'function');
      var vs = lex('JollyVisualSearch');
      out.engine = vs ? (vs.version || 'v1') : null;
      return open().then(function () { out.store = true; }, function () { out.store = false; })
        .then(function () {
          if (vs && typeof vs.selfTest === 'function') {
            return vs.selfTest().then(function (r) { out.visual = r; });
          }
        })
        .then(function () { out.ok = out.idb && out.store; return out; });
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
