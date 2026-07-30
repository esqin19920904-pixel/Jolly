/* ==========================================================================
   JOLLY — jolly-share-inbox.js                v4.1.0   (2026-07-30)
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

   v3.2 (Esqin: "mal tapılandan sonra barkod çıxmır, məhsul məlumatı
   açılmır") — İKİ YENİ ŞEY:
     • MALIN PASPORTU — nəticəyə toxunanda elə həmin ekranda tam
       məlumat açılır: bütün kodlar, qiymət, qrup, firma, yer, status,
       tədarükçü, say, qeyd + şəkillər. Qrup/yer/status/tədarükçü
       id-ləri adlara çevrilir (jolly_groups/locations/statuses/...).
     • EKRANDAN SKAN — şəklin (və ya 📊 düyməsinin) üstünə basanda
       ağ fonda böyük barkod açılır, kassada skanerlə "bip" vurmaq üçün.
       EAN-13 / EAN-8 SVG kimi çəkilir (kassa skanerinin gözlədiyi
       format), 12 rəqəmli UPC başına 0 alır, yoxlama rəqəmi səhv
       olsa xəbərdarlıq çıxır. Rəqəm olmayan daxili kod üçün UYDURMA
       barkod ÇƏKİLMİR — kod iri rəqəmlərlə göstərilir.
       ⟲ düyməsi barkodu yan çevirir (dar telefonda zolaqlar enlənir),
       ekran söndürülməsin deyə wake-lock istənilir.
     ÇAP YOXDUR — bu, yalnız ekran göstərişidir.

   v4.0 — Vision AI v4 motoru ilə birlikdə:
     • CONFIDENCE göstəricisi: 🟢 dəqiq · 🟡 çox güman · 🔴 əl ilə yoxla
       və bal cədvəli (Vizual 81 · OCR 14 · Marka 10 · Rəng 5 …)
     • ❌ Səhv nəticə düyməsi — həmin uyğunluğun balını AZALDIR
     • 🔍 Oxşar mallar — tapılan malın ailəsi (Fino Maska / Premium / Repair)
     • 📦 Dublikatlar — eyni barkod / kod / şəkil / hash
     • 📈 Statistika — son 30 gün: ən çox axtarılan, tapılmayan,
       mərhələ uğuru, orta vaxt
     • 📊 Performans — RAM (yalnız Chrome), keş, OCR, orta axtarış
       (CPU brauzerdən oxunmur)
     • Mərhələ göstəricisi: axtarışın hansı yolla bitdiyi
       (barkod / QR / OCR qısa yolu / tam vizual)

   v4.1 (Esqin: "barkodu görmək olmur, bir kliklə çıxsın, kassada
   vurmaq olsun") — BARKOD AXINI YENİDƏN:
     • Nəticə sətrinin ÜSTÜNƏ toxunmaq = barkod dərhal ekranda.
       Bir klik, aralıq ekran yoxdur.
     • 📊 düyməsi sətrin içindən çıxarıldı — dar telefonda kənara
       düşüb görünmürdü. İndi hər nəticənin altında tam enli
       düymələr sırası: 📊 Barkod · 📋 Kod · ↩ Göndər · ⓘ Pasport
     • Barkod ekranı yenidən ölçüləndi: portret və YAN rejim
       düzgün işləyir (əvvəl yan rejimdə svg ölçüsü itirdi),
       seçim yadda saxlanılır, tam ekran istənilir, zolaqlar
       ekranın bütün enini tutur — skaner üçün ən yaxşı hal.

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
    items: [], idx: 0, history: [], learned: null, need: null,
    stage: null, similar: null, dups: null, ana: null, perf: null, panel: null,
    rejected: {}
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
      state.stage = out.stage || (out.stats && out.stats.stage) || null;
      state.searching = false;
      state.similar = null;
      loadSimilar();
      paint();

      // tarixçəni motor özü yazır (v4) — sadəcə yeniləyirik
      sidebarInfo();

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

  /* 8 — oxşar mallar */
  function loadSimilar() {
    var top = state.results && state.results[0];
    if (!top) return;
    ensureVisual().then(function (vs) {
      if (typeof vs.similarTo !== 'function') return;
      return vs.similarTo(top.product.id, 4).then(function (rows) {
        state.similar = rows || [];
        paint();
      });
    }).catch(function () {});
  }

  /* 5 — dublikatlar */
  function loadDuplicates() {
    state.panel = 'dups'; state.dups = 'loading'; paint();
    ensureVisual().then(function (vs) {
      if (typeof vs.duplicates !== 'function') { state.dups = null; paint(); return; }
      return vs.duplicates().then(function (d) { state.dups = d; paint(); });
    }).catch(function (e) { state.dups = { error: String(e && e.message || e) }; paint(); });
  }

  /* 10 — statistika */
  function loadAnalytics() {
    state.panel = 'ana'; state.ana = 'loading'; paint();
    ensureVisual().then(function (vs) {
      if (typeof vs.analytics !== 'function') { state.ana = null; paint(); return; }
      return vs.analytics(30).then(function (a) { state.ana = a; paint(); });
    }).catch(function (e) { state.ana = { error: String(e && e.message || e) }; paint(); });
  }

  /* 9 — performans */
  function loadPerf() {
    state.panel = 'perf'; state.perf = 'loading'; paint();
    ensureVisual().then(function (vs) {
      if (typeof vs.perf !== 'function') { state.perf = null; paint(); return; }
      return vs.perf().then(function (x) { state.perf = x; paint(); });
    }).catch(function (e) { state.perf = { error: String(e && e.message || e) }; paint(); });
  }

  /* 4 — öyrənmə v2: səhv nəticə */
  function rejectMatch(id) {
    ensureVisual().then(function (vs) {
      if (typeof vs.reject !== 'function') { toast('Bu motor dəstəkləmir', 'error'); return; }
      return vs.reject(id);
    }).then(function (ok) {
      if (ok) {
        state.rejected[String(id)] = true;
        delete state.confirmed[String(id)];
        toast('Qeyd olundu — bu mal bir daha bu şəkildə önə çıxmayacaq', 'ok');
        sidebarInfo(); paint();
      }
    }).catch(function () {});
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


  /* ======================================================================
     PASPORT + EKRANDAN SKAN (v3.2)
     ====================================================================== */

  var FIELDS = [
    ['Qiymət',    ['price', 'salePrice', 'qiymet'], null],
    ['Qrup',      ['group', 'groupId', 'category', 'categoryId'], 'jolly_groups'],
    ['Firma',     ['brand', 'brandId', 'firma', 'company'], 'jolly_brands'],
    ['Yer',       ['location', 'locationId', 'yer'], 'jolly_locations'],
    ['Status',    ['status', 'statusId'], 'jolly_statuses'],
    ['Tədarükçü', ['supplier', 'supplierId', 'tedarukcu'], 'jolly_suppliers'],
    ['Say',       ['qty', 'quantity', 'stock', 'count'], null],
    ['Model',     ['model', 'modelNo'], null],
    ['Qeyd',      ['note', 'notes', 'qeyd', 'description'], null]
  ];

  function lsList(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { return []; }
  }

  function resolveName(storeKey, val) {
    if (val === null || val === undefined || val === '') return '';
    if (!storeKey) return val;
    var v = String(val);
    var hit = lsList(storeKey).filter(function (x) {
      return x && (String(x.id) === v || String(x.name) === v || String(x.title) === v);
    })[0];
    return hit ? (hit.name || hit.title || v) : v;
  }

  function firstOf(p, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = p[keys[i]];
      if (v !== null && v !== undefined && v !== '' && typeof v !== 'object') return v;
    }
    return '';
  }

  function allCodes(p) {
    var out = [];
    var push = function (v) {
      if (v === null || v === undefined || v === '') return;
      v = String(v).trim();
      if (v && out.indexOf(v) < 0) out.push(v);
    };
    push(p.barcode); push(p.barcode2);
    if (Array.isArray(p.barcodes)) p.barcodes.forEach(push);
    push(p.specialCode); push(p.code); push(p.extraCode);
    return out;
  }

  /* ---------------- EAN-13 / EAN-8 kodlayıcı ---------------- */

  var EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  var EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  var EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  var PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

  function sum13(d) {
    var s = 0;
    for (var i = 0; i < 12; i++) s += (+d[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - s % 10) % 10;
  }
  function sum8(d) {
    var s = 0;
    for (var i = 0; i < 7; i++) s += (+d[i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - s % 10) % 10;
  }

  function encodeBarcode(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (!d) return { ok: false, why: 'rəqəm yoxdur' };

    var warn = null, kind = null;

    /* 12 rəqəm iki şey ola bilər: tam UPC-A, ya da yoxlama rəqəmi
       yazılmamış EAN-13. UPC yoxlaması keçirsə UPC sayılır. */
    if (d.length === 12) {
      var u = 0;
      for (var k = 0; k < 11; k++) u += (+d[k]) * (k % 2 === 0 ? 3 : 1);
      if ((10 - u % 10) % 10 === +d[11]) { d = '0' + d; warn = 'UPC-A kodu — başına 0 əlavə edildi'; }
      else { d = d + sum13(d); warn = 'yoxlama rəqəmi yox idi — hesablandı (' + d[12] + ')'; }
    }
    if (d.length === 7) { d = d + sum8(d); warn = 'yoxlama rəqəmi hesablandı'; }

    if (d.length === 13) {
      kind = 'EAN-13';
      var c = sum13(d);
      if (c !== +d[12]) warn = 'yoxlama rəqəmi uyğun deyil (' + d[12] + ' yerinə ' + c + ') — skaner qəbul etməyə bilər';
      var bits = '101', par = PARITY[+d[0]], i;
      for (i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? EAN_L : EAN_G)[+d[i]];
      bits += '01010';
      for (i = 7; i <= 12; i++) bits += EAN_R[+d[i]];
      bits += '101';
      return { ok: true, bits: bits, kind: kind, digits: d, warn: warn };
    }

    if (d.length === 8) {
      kind = 'EAN-8';
      var c8 = sum8(d.slice(0, 7));
      if (c8 !== +d[7]) warn = 'yoxlama rəqəmi uyğun deyil (' + d[7] + ' yerinə ' + c8 + ')';
      var b = '101', j;
      for (j = 0; j < 4; j++) b += EAN_L[+d[j]];
      b += '01010';
      for (j = 4; j < 8; j++) b += EAN_R[+d[j]];
      b += '101';
      return { ok: true, bits: b, kind: kind, digits: d, warn: warn };
    }

    return { ok: false, why: d.length + ' rəqəmli kod EAN formatı deyil', digits: d };
  }

  function barcodeSVG(bits, rotated) {
    var quiet = 11;                       // sakit zona — skaner üçün vacibdir
    var total = bits.length + quiet * 2;
    var h = 100, x = quiet, out = [];
    for (var i = 0; i < bits.length; i++) {
      if (bits[i] === '1') {
        var run = 1;
        while (bits[i + run] === '1') run++;
        out.push('<rect x="' + x + '" y="0" width="' + run + '" height="' + h + '" fill="#000"/>');
        x += run; i += run - 1;
      } else { x++; }
    }
    var svg = '<svg viewBox="0 0 ' + total + ' ' + h + '" preserveAspectRatio="none" ' +
              'xmlns="http://www.w3.org/2000/svg">' + out.join('') + '</svg>';
    /* Yan rejimdə svg-ni sadəcə rotate etmək ölçüsünü itirirdi.
       Ona görə ölçülər sarğının içində mütləq mövqe ilə verilir. */
    return rotated ? '<div class="rotwrap">' + svg + '</div>'
                   : '<div class="portwrap">' + svg + '</div>';
  }

  /* ---------------- barkod ekranı ---------------- */

  var _wake = null;
  function keepAwake(on) {
    try {
      if (on && navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (w) { _wake = w; }).catch(function () {});
      } else if (!on && _wake) { try { _wake.release(); } catch (e) {} _wake = null; }
    } catch (e) {}
  }

  function rotPref(v) {
    try {
      if (v === undefined) return localStorage.getItem('jolly_bc_rot') === '1';
      localStorage.setItem('jolly_bc_rot', v ? '1' : '0');
    } catch (e) {}
    return !!v;
  }

  function showBarcode(code, name) {
    var enc = encodeBarcode(code);
    var old = document.getElementById('jsi-bc');
    if (old) old.remove();
    var rotated = rotPref();

    var box = document.createElement('div');
    box.id = 'jsi-bc';
    box.setAttribute('data-code', String(code));
    box.setAttribute('data-name', String(name || ''));
    box.setAttribute('data-rot', rotated ? '1' : '0');
    try { if (box.requestFullscreen) setTimeout(function () { box.requestFullscreen().catch(function () {}); }, 50); } catch (e) {}

    var h = ['<div class="bcw">'];
    h.push('<div class="bch"><span>' + esc(name || '') + '</span>' +
           '<span class="bcx" data-bcclose="1">✕</span></div>');

    if (enc.ok) {
      h.push('<div class="bcimg" id="jsi-bcimg">' + barcodeSVG(enc.bits, rotated) + '</div>');
      h.push('<div class="bcnum">' + esc(enc.digits.split('').join(' ')) + '</div>');
      h.push('<div class="bcinf">' + enc.kind + ' · kassa skaneri ilə oxunur</div>');
      if (enc.warn) h.push('<div class="bcwarn">⚠️ ' + esc(enc.warn) + '</div>');
      h.push('<div class="bcrow">');
      h.push('<div class="bcb big2" data-bcrot="1">⟲ ' + (rotated ? 'Portret' : 'Yan çevir (daha enli)') + '</div>');
      h.push('<div class="bcb" data-copy="' + esc(enc.digits) + '">📋 Kopyala</div>');
      h.push('</div>');
      h.push('<div class="bctip">Ekranın işığını maksimuma qaldır. Skaner oxumursa əvvəlcə ⟲ yan rejimi sına — zolaqlar iki dəfə enlənir.</div>');
    } else {
      h.push('<div class="bcnum big">' + esc(code) + '</div>');
      h.push('<div class="bcwarn">Bu kod barkod kimi çəkilə bilmir: ' + esc(enc.why) + '.<br>' +
             'Skanerlə oxutmaq üçün mala EAN-13 barkod yazılmalıdır — kodu əl ilə kassaya daxil et.</div>');
      h.push('<div class="bcrow"><div class="bcb" data-copy="' + esc(code) + '">📋 Kopyala</div></div>');
    }
    h.push('</div>');
    box.innerHTML = h.join('');
    document.body.appendChild(box);
    keepAwake(true);

    box.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-bcclose]')) {
        keepAwake(false);
        try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e2) {}
        box.remove(); return;
      }
      var cp = t.closest && t.closest('[data-copy]');
      if (cp) { e.stopPropagation(); return copyCode(cp.getAttribute('data-copy')); }
      var rt = t.closest && t.closest('[data-bcrot]');
      if (rt && enc.ok) {
        e.stopPropagation();
        var cur = box.getAttribute('data-rot') === '1';
        box.setAttribute('data-rot', cur ? '0' : '1');
        rotPref(!cur);
        var img = document.getElementById('jsi-bcimg');
        if (img) img.innerHTML = barcodeSVG(enc.bits, !cur);
        var lbl = box.querySelector('[data-bcrot]');
        if (lbl) lbl.textContent = '⟲ ' + (!cur ? 'Portret' : 'Yan çevir (daha enli)');
        return;
      }
      if (t === box) { keepAwake(false); box.remove(); }
    });
  }

  /* ---------------- pasport ---------------- */

  function passport(p) {
    var codes = allCodes(p);
    var h = ['<div class="pp">'];
    h.push('<div class="pph"><span>' + esc(p.name || '(adsız)') + '</span>' +
           '<span class="ppx" data-ppclose="1">✕</span></div>');

    h.push('<div class="ppimgs" id="pp-imgs">');
    var imgs = (Array.isArray(p.images) ? p.images : []).concat(
      [p.image, p.img, p.photo].filter(function (v) { return typeof v === 'string' && v; })
    ).slice(0, 6);
    if (!imgs.length) h.push('<div class="ppim empty">şəkil yoxdur</div>');
    imgs.forEach(function (src, i) {
      if (typeof src !== 'string') return;
      if (src.indexOf('idb:') === 0) h.push('<div class="ppim" data-ppidb="' + esc(src) + '" data-bar="' + esc(codes[0] || '') + '"></div>');
      else h.push('<img class="ppim" src="' + esc(src) + '" data-bar="' + esc(codes[0] || '') + '">');
    });
    h.push('</div>');
    h.push('<div class="pptap">☝️ Şəklin üstünə bas → barkod ekrana çıxır</div>');

    if (codes.length) {
      h.push('<div class="ppsec">KODLAR</div>');
      codes.forEach(function (c, i) {
        h.push('<div class="ppcode">');
        h.push('<span class="c">' + esc(c) + '</span>');
        h.push('<span class="cb" data-bar="' + esc(c) + '">📊</span>');
        h.push('<span class="cb" data-copy="' + esc(c) + '">📋</span>');
        h.push('<span class="cb" data-send="' + esc(c) + '">↩</span>');
        h.push('</div>');
      });
    } else {
      h.push('<div class="ppsec">KODLAR</div><div class="ppwarn">Bu malın kodu yoxdur.</div>');
    }

    h.push('<div class="ppsec">MƏLUMAT</div>');
    var rows = 0;
    FIELDS.forEach(function (f) {
      var raw = firstOf(p, f[1]);
      var val = resolveName(f[2], raw);
      if (val === '' || val === null || val === undefined) return;
      rows++;
      h.push('<div class="pprow"><span>' + f[0] + '</span><b>' + esc(val) + '</b></div>');
    });
    if (!rows) h.push('<div class="ppwarn">Əlavə məlumat boşdur.</div>');

    h.push('<div class="ppbtn" data-openreal="' + esc(p.id) + '">📄 Tam məhsul kartını aç</div>');
    h.push('</div>');
    return h.join('');
  }

  function openPassport(id) {
    var list = [];
    try {
      var P = (global.JollyDB && global.JollyDB.Products) || null;
      if (P) list = (P.all && P.all()) || (P.getAll && P.getAll()) || [];
      if (!list.length) list = JSON.parse(localStorage.getItem('jolly_products') || '[]');
    } catch (e) {}
    var p = null;
    (state.results || []).forEach(function (r) { if (String(r.product.id) === String(id)) p = r.product; });
    if (!p) list.forEach(function (x) { if (String(x.id) === String(id)) p = x; });
    if (!p) { toast('Mal tapılmadı', 'error'); return; }

    var old = document.getElementById('jsi-pp');
    if (old) old.remove();
    var box = document.createElement('div');
    box.id = 'jsi-pp';
    box.innerHTML = passport(p);
    document.body.appendChild(box);

    // idb: şəkilləri doldur
    var S = lex('JollyStorage');
    if (S) {
      var get = S.getImage || S.get;
      if (typeof get === 'function') {
        Array.prototype.forEach.call(box.querySelectorAll('[data-ppidb]'), function (el) {
          Promise.resolve(get.call(S, el.getAttribute('data-ppidb'))).then(function (url) {
            if (!url) { el.className = 'ppim empty'; el.textContent = 'açılmadı'; return; }
            var im = document.createElement('img');
            im.className = 'ppim'; im.src = url;
            im.setAttribute('data-bar', el.getAttribute('data-bar') || '');
            el.parentNode.replaceChild(im, el);
          }).catch(function () {});
        });
      }
    }

    box.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-ppclose]')) { box.remove(); return; }
      var cp = t.closest && t.closest('[data-copy]');
      if (cp) { e.stopPropagation(); return copyCode(cp.getAttribute('data-copy')); }
      var sd = t.closest && t.closest('[data-send]');
      if (sd) { e.stopPropagation(); return shareCode(sd.getAttribute('data-send')); }
      var br = t.closest && t.closest('[data-bar]');
      if (br) {
        e.stopPropagation();
        return showBarcode(br.getAttribute('data-bar'), br.getAttribute('data-bname') || '');
      }
      var br = t.closest && t.closest('[data-bar]');
      if (br) {
        e.stopPropagation();
        var c = br.getAttribute('data-bar');
        if (!c) { toast('Bu malın barkodu yoxdur', 'error'); return; }
        return showBarcode(c, p.name || '');
      }
      var or = t.closest && t.closest('[data-openreal]');
      if (or) { box.remove(); return openProduct(or.getAttribute('data-openreal')); }
      if (t === box) box.remove();
    });
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
    'border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05)}',
    '#jsi .conf{display:flex;align-items:center;gap:7px;margin-top:7px;font-size:11.5px}',
    '#jsi .dot{width:9px;height:9px;border-radius:50%;flex:none}',
    '#jsi .dot.green{background:#37d67a}#jsi .dot.yellow{background:#f5c451}#jsi .dot.red{background:#ff8a8a}',
    '#jsi .bd{margin-top:7px;font-family:ui-monospace,monospace;font-size:10.5px;opacity:.66;line-height:1.6}',
    '#jsi .acts{display:flex;gap:7px;margin-top:9px}',
    '#jsi .act{flex:1;padding:9px;border-radius:11px;text-align:center;font-size:12px;font-weight:700;cursor:pointer;',
    'border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}',
    '#jsi .act.y{border-color:rgba(55,214,122,.45);background:rgba(55,214,122,.13);color:#8ff0b5}',
    '#jsi .act.n{border-color:rgba(255,138,138,.4);background:rgba(255,138,138,.1);color:#ffbcbc}',
    '#jsi .stage{font-size:11.5px;opacity:.6;margin-bottom:11px;font-family:ui-monospace,monospace}',
    '#jsi .simbox{margin-top:16px;padding:12px;border-radius:14px;background:rgba(255,255,255,.03);',
    'border:1px solid rgba(255,255,255,.07)}',
    '#jsi .simrow{display:flex;justify-content:space-between;gap:9px;padding:8px 0;font-size:12.5px;',
    'border-top:1px solid rgba(255,255,255,.05);cursor:pointer}',
    '#jsi .simrow b{font-family:ui-monospace,monospace;color:#f7d98a}',
    '#jsi .pnl{margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.035);',
    'border:1px solid rgba(255,255,255,.08);font-size:12.5px;line-height:1.75}',
    '#jsi .pnl h4{margin:0 0 8px;font-size:13px}',
    '#jsi .pnl .k{display:flex;justify-content:space-between;gap:10px;padding:5px 0;',
    'border-bottom:1px solid rgba(255,255,255,.05)}',
    '#jsi .pnl .k b{font-family:ui-monospace,monospace;color:#f7d98a}',
    '#jsi .pnl .grp{margin-top:9px;padding:9px;border-radius:11px;background:rgba(255,255,255,.04);font-size:12px}',
    '#jsi .trio{display:flex;gap:7px;margin-bottom:9px}',
    '#jsi .trio .t{flex:1;padding:11px 6px;border-radius:12px;text-align:center;font-size:12px;font-weight:700;',
    'cursor:pointer;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05)}',
    '#jsi .trio .t.on{border-color:rgba(245,196,81,.5);background:rgba(245,196,81,.13);color:#f7d98a}',
    '#jsi .rowacts{display:flex;gap:6px;margin-top:10px}',
    '#jsi .ra{padding:11px 8px;border-radius:11px;text-align:center;font-size:12.5px;font-weight:700;',
    'cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);flex:none;min-width:46px}',
    '#jsi .ra.wide{flex:1;border-color:rgba(245,196,81,.5);background:rgba(245,196,81,.16);color:#f7d98a}',
    '#jsi .tapnote{font-size:11px;opacity:.45;margin-top:6px;text-align:center}',
    /* pasport */
    '#jsi-pp{position:fixed;inset:0;z-index:9998;background:rgba(6,7,12,.93);overflow:auto;',
    '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:14px 12px 40px;color:#e8e8f0;',
    'font-family:inherit}',
    '#jsi-pp .pp{max-width:640px;margin:0 auto}',
    '#jsi-pp .pph{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:17px;',
    'font-weight:700;margin-bottom:12px;line-height:1.3}',
    '#jsi-pp .ppx{flex:none;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;',
    'justify-content:center;background:rgba(255,255,255,.08);cursor:pointer;font-size:15px}',
    '#jsi-pp .ppimgs{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}',
    '#jsi-pp .ppim{width:120px;height:120px;flex:none;border-radius:13px;object-fit:cover;background:#0a0b12;',
    'border:1px solid rgba(255,255,255,.09);cursor:pointer}',
    '#jsi-pp .ppim.empty{display:flex;align-items:center;justify-content:center;font-size:11px;opacity:.45}',
    '#jsi-pp .pptap{font-size:11.5px;opacity:.55;margin:7px 0 14px;text-align:center}',
    '#jsi-pp .ppsec{font-size:11px;letter-spacing:.9px;opacity:.5;margin:14px 0 7px}',
    '#jsi-pp .ppcode{display:flex;align-items:center;gap:6px;padding:10px 12px;margin-bottom:7px;',
    'border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}',
    '#jsi-pp .ppcode .c{flex:1;font-family:ui-monospace,monospace;font-size:16.5px;font-weight:700;',
    'color:#f7d98a;letter-spacing:.7px;word-break:break-all}',
    '#jsi-pp .ppcode .cb{flex:none;width:38px;height:38px;border-radius:11px;display:flex;align-items:center;',
    'justify-content:center;font-size:15px;cursor:pointer;background:rgba(255,255,255,.07);',
    'border:1px solid rgba(255,255,255,.11)}',
    '#jsi-pp .pprow{display:flex;justify-content:space-between;gap:10px;padding:9px 2px;font-size:13.5px;',
    'border-bottom:1px solid rgba(255,255,255,.06)}',
    '#jsi-pp .pprow span{opacity:.6}',
    '#jsi-pp .ppwarn{font-size:12.5px;opacity:.6;padding:8px 2px}',
    '#jsi-pp .ppbtn{margin-top:16px;padding:14px;border-radius:13px;text-align:center;font-weight:700;',
    'font-size:14px;cursor:pointer;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06)}',
    /* barkod ekranı */
    '#jsi-bc{position:fixed;inset:0;z-index:9999;background:#fff;color:#111;overflow:auto;',
    'display:flex;align-items:center;justify-content:center;padding:18px 12px}',
    '#jsi-bc .bcw{width:100%;max-width:560px;text-align:center}',
    '#jsi-bc .bch{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:15px;',
    'font-weight:700;margin-bottom:16px;text-align:left}',
    '#jsi-bc .bcx{flex:none;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;',
    'justify-content:center;background:#eee;cursor:pointer}',
    '#jsi-bc .bcimg{background:#fff;padding:6px 0}',
    '#jsi-bc .portwrap{width:100%;height:38vh;min-height:170px}',
    '#jsi-bc .portwrap svg{width:100%;height:100%;display:block;background:#fff}',
    '#jsi-bc .rotwrap{position:relative;width:100%;height:74vh}',
    '#jsi-bc .rotwrap svg{position:absolute;top:50%;left:50%;width:72vh;height:76vw;',
    'transform:translate(-50%,-50%) rotate(90deg);background:#fff;display:block}',
    '#jsi-bc .bcb.big2{flex:1.4;background:#e9f6ee;border-color:#bcdcc8}',
    '#jsi-bc .bcnum{font-family:ui-monospace,monospace;font-size:19px;font-weight:700;letter-spacing:2px;',
    'margin-top:8px}',
    '#jsi-bc .bcnum.big{font-size:26px;letter-spacing:1px;word-break:break-all;margin:30px 0}',
    '#jsi-bc .bcinf{font-size:12px;opacity:.6;margin-top:6px}',
    '#jsi-bc .bcwarn{font-size:12.5px;color:#a33;margin-top:10px;line-height:1.5}',
    '#jsi-bc .bcrow{display:flex;gap:9px;margin-top:18px}',
    '#jsi-bc .bcb{flex:1;padding:13px;border-radius:12px;font-size:13.5px;font-weight:700;cursor:pointer;',
    'background:#f2f2f4;border:1px solid #ddd;color:#222}',
    '#jsi-bc .bctip{font-size:11.5px;opacity:.55;margin-top:14px;line-height:1.5}'
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
    h.push('<div class="bb send" data-bar="' + esc(code) + '" data-bname="' + esc(r.product.name || '') +
           '" style="font-size:15px;padding:16px">📊 BARKODU EKRANDA GÖSTƏR</div>');
    h.push('</div><div class="brow">');
    h.push('<div class="bb" data-copy="' + esc(code) + '">📋 Kopyala</div>');
    h.push('<div class="bb" data-send="' + esc(code) + '">↩ Göndər</div>');
    h.push('<div class="bb" data-open="' + esc(r.product.id) + '">ⓘ Pasport</div>');
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
    // BİR KLİK: sətrin üstünə toxunmaq = barkod ekranda
    h.push('<div class="row"' + (code ? ' data-bar="' + esc(code) + '" data-bname="' + esc(p.name || '') + '"'
                                     : ' data-open="' + esc(p.id) + '"') + '>');
    var t = thumbOf(p);
    h.push(t ? '<img class="th" src="' + esc(t) + '" alt="">' : '<div class="th" data-th="' + esc(p.id) + '"></div>');
    h.push('<div class="m">');
    h.push('<div class="nm">' + (MEDALS[i] || (i + 1) + '.') + ' ' + esc(p.name || '(adsız)') + '</div>');
    h.push(code ? '<div class="cd">' + esc(code) + '</div>' : '<div class="pc">kod yoxdur</div>');
    h.push('<div class="pc">' + r.similarity + '% oxşar' +
           (p.price ? ' · ' + esc(p.price) + ' ₼' : '') + '</div>');
    h.push('<div class="bar"><i style="width:' + Math.max(3, r.similarity) + '%"></i></div>');
    h.push('</div>');
    h.push('</div>');   // .row bitdi — düymələr aşağıda, sətrə sığmadığı üçün

    h.push('<div class="rowacts">');
    if (code) {
      h.push('<div class="ra wide" data-bar="' + esc(code) + '" data-bname="' + esc(p.name || '') + '">📊 Barkod</div>');
      h.push('<div class="ra" data-copy="' + esc(code) + '">📋</div>');
      h.push('<div class="ra" data-send="' + esc(code) + '">↩</div>');
    }
    h.push('<div class="ra" data-open="' + esc(p.id) + '">ⓘ</div>');
    h.push('</div>');
    if (code) h.push('<div class="tapnote">☝️ sətrə toxun → barkod dərhal açılır · ⓘ = tam pasport</div>');

    if (r.bonuses && r.bonuses.length) {
      h.push('<div class="why">');
      r.bonuses.forEach(function (b) { h.push('<span class="chip">' + esc(b) + '</span>'); });
      if (r.variant && r.variant !== '—') h.push('<span class="chip">' + esc(r.variant) + '</span>');
      h.push('</div>');
    }
    // 3 — CONFIDENCE
    if (r.confidence !== undefined) {
      var lb = r.label || (r.confidence >= 105 ? 'green' : (r.confidence >= 78 ? 'yellow' : 'red'));
      var txt = lb === 'green' ? '🟢 Dəqiq tapıldı' : (lb === 'yellow' ? '🟡 Çox güman' : '🔴 Əl ilə yoxla');
      h.push('<div class="conf"><span class="dot ' + lb + '"></span><span>' + txt +
             ' · confidence <b>' + r.confidence + '</b></span></div>');
    }
    if (r.breakdown) {
      var bd = r.breakdown, keys = Object.keys(bd).filter(function (k) { return bd[k]; });
      h.push('<div class="bd">' + keys.map(function (k) {
        return k + ' ' + (bd[k] > 0 ? '+' : '') + bd[k];
      }).join(' · ') + (r.variant && r.variant !== '—' ? ' · ' + esc(r.variant) : '') + '</div>');
    } else if (r.bonuses && r.bonuses.length) {
      h.push('<div class="why">');
      r.bonuses.forEach(function (b) { h.push('<span class="chip">' + esc(b) + '</span>'); });
      h.push('</div>');
    }

    var bad = !!state.rejected[String(p.id)];
    h.push('<div class="acts">');
    h.push('<div class="act' + (done ? ' y' : '') + '" data-ok="' + esc(p.id) + '">' +
           (done ? '✅ Yadda saxlanıldı' : '✅ Düzgün mal') + '</div>');
    h.push('<div class="act' + (bad ? ' n' : '') + '" data-no="' + esc(p.id) + '">' +
           (bad ? '❌ Qeyd olundu' : '❌ Səhv nəticə') + '</div>');
    h.push('</div>');
    h.push('</div>');
    return h.join('');
  }

  /* 8 — oxşar mallar bloku */
  function similarBlock() {
    if (!state.similar || !state.similar.length) return '';
    var h = ['<div class="simbox"><div class="ht" style="font-size:11.5px;opacity:.55;letter-spacing:.6px;' +
             'text-transform:uppercase;margin-bottom:6px">🔍 Oxşar mallar</div>'];
    state.similar.forEach(function (r) {
      var c = codeOf(r.product);
      h.push('<div class="simrow" data-open="' + esc(r.product.id) + '">' +
             '<span>' + esc((r.product.name || '(adsız)')).slice(0, 28) + '</span>' +
             '<span><b>' + esc(c || '—') + '</b></span></div>');
    });
    h.push('</div>');
    return h.join('');
  }

  /* 5 · 9 · 10 — panellər */
  function panelBlock() {
    if (!state.panel) return '';
    var h = ['<div class="pnl">'];

    if (state.panel === 'dups') {
      h.push('<h4>📦 Dublikatlar</h4>');
      var d = state.dups;
      if (d === 'loading') h.push('Yoxlanılır…');
      else if (!d) h.push('Motor dəstəkləmir.');
      else if (d.error) h.push('<span class="warn">' + esc(d.error) + '</span>');
      else {
        var sets = [['Eyni barkod', d.barcode], ['Eyni xüsusi kod', d.code],
                    ['Eyni şəkil', d.image], ['Eyni görünüş (hash)', d.visual]];
        var any = false;
        sets.forEach(function (pair) {
          var name = pair[0], arr = pair[1] || [];
          h.push('<div class="k"><span>' + name + '</span><b>' + arr.length + ' qrup</b></div>');
          arr.slice(0, 6).forEach(function (g) {
            any = true;
            h.push('<div class="grp"><b>' + esc(g.key).slice(0, 30) + '</b><br>' +
                   g.items.map(function (i) { return esc(i.name || i.id); }).join(' · ') + '</div>');
          });
        });
        if (!any) h.push('<div style="opacity:.6;margin-top:8px">Dublikat tapılmadı.</div>');
        if (d.note) h.push('<div style="opacity:.6;margin-top:8px">ℹ️ ' + esc(d.note) + '</div>');
      }
    }

    if (state.panel === 'ana') {
      h.push('<h4>📈 Statistika — son 30 gün</h4>');
      var a = state.ana;
      if (a === 'loading') h.push('Hesablanır…');
      else if (!a) h.push('Motor dəstəkləmir.');
      else if (a.error) h.push('<span class="warn">' + esc(a.error) + '</span>');
      else {
        h.push('<div class="k"><span>Axtarış sayı</span><b>' + a.searches + '</b></div>');
        h.push('<div class="k"><span>Tapıldı</span><b>' + a.found + ' (' + a.foundRate + '%)</b></div>');
        h.push('<div class="k"><span>Tapılmadı</span><b>' + a.notFound + '</b></div>');
        h.push('<div class="k"><span>Barkodla bitən</span><b>' + a.barcodeRate + '%</b></div>');
        h.push('<div class="k"><span>OCR qısa yolu</span><b>' + a.ocrRate + '%</b></div>');
        h.push('<div class="k"><span>Orta vaxt</span><b>' + (a.avgMs / 1000).toFixed(2) + ' s</b></div>');
        if (a.top && a.top.length) {
          h.push('<div class="grp"><b>Ən çox axtarılan</b><br>' +
                 a.top.map(function (t) { return esc(t.name).slice(0, 24) + ' ×' + t.count; }).join('<br>') + '</div>');
        }
        if (a.stages && a.stages.length) {
          h.push('<div class="grp"><b>Mərhələlər</b><br>' +
                 a.stages.map(function (t) { return esc(t.stage) + ' ×' + t.count; }).join('<br>') + '</div>');
        }
      }
    }

    if (state.panel === 'perf') {
      h.push('<h4>📊 Performans</h4>');
      var x = state.perf;
      if (x === 'loading') h.push('Ölçülür…');
      else if (!x) h.push('Motor dəstəkləmir.');
      else if (x.error) h.push('<span class="warn">' + esc(x.error) + '</span>');
      else {
        h.push('<div class="k"><span>Motor</span><b>v' + esc(x.version) + '</b></div>');
        h.push('<div class="k"><span>RAM</span><b>' +
               (x.ram ? (x.ram.usedMB + ' / ' + x.ram.limitMB + ' MB') : 'brauzer vermir') + '</b></div>');
        h.push('<div class="k"><span>CPU</span><b>' + (x.cores ? x.cores + ' nüvə' : '—') + '</b></div>');
        h.push('<div class="k"><span>Yaddaş</span><b>' +
               (x.storage ? (x.storage.usedMB + ' / ' + x.storage.quotaMB + ' MB') : '—') + '</b></div>');
        h.push('<div class="k"><span>Barmaq izi</span><b>' + x.fingerprints + '</b></div>');
        h.push('<div class="k"><span>Hazır deyil</span><b>' + (x.warm ? x.warm.missing : '—') + '</b></div>');
        h.push('<div class="k"><span>OCR</span><b>' + esc(x.ocr) + '</b></div>');
        h.push('<div class="k"><span>Öyrənilmiş</span><b>' + x.learned + '</b></div>');
        h.push('<div class="k"><span>Orta axtarış</span><b>' +
               (x.avgSearchMs !== null ? (x.avgSearchMs / 1000).toFixed(2) + ' s' : '—') + '</b></div>');
        h.push('<div style="opacity:.6;margin-top:8px">ℹ️ ' + esc(x.cpuNote) + '</div>');
      }
    }

    h.push('</div>');
    return h.join('');
  }

  function trioBlock() {
    var h = ['<div class="trio">'];
    h.push('<div class="t' + (state.panel === 'dups' ? ' on' : '') + '" data-panel="dups">📦 Dublikat</div>');
    h.push('<div class="t' + (state.panel === 'ana' ? ' on' : '') + '" data-panel="ana">📈 Statistika</div>');
    h.push('<div class="t' + (state.panel === 'perf' ? ' on' : '') + '" data-panel="perf">📊 Performans</div>');
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
      h.push(trioBlock());
      h.push(panelBlock());
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
      if (state.stage) h.push('<div class="stage">⚙️ mərhələ: ' + esc(state.stage) + '</div>');
      state.results.forEach(function (r, i) { h.push(hitRow(r, i)); });
      h.push(similarBlock());
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
    h.push(trioBlock());
    h.push(panelBlock());
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
      var no = t.closest && t.closest('[data-no]');
      if (no) { e.stopPropagation(); return rejectMatch(no.getAttribute('data-no')); }
      var pn = t.closest && t.closest('[data-panel]');
      if (pn) {
        e.stopPropagation();
        var which = pn.getAttribute('data-panel');
        if (state.panel === which) { state.panel = null; paint(); return; }
        if (which === 'dups') return loadDuplicates();
        if (which === 'ana') return loadAnalytics();
        if (which === 'perf') return loadPerf();
        return;
      }
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
      if (op) return openPassport(op.getAttribute('data-open'));
    });
  }

  /* ---------- API ---------- */

  var Inbox = {
    version: '4.1.0',

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
    passport: openPassport,
    duplicates: loadDuplicates,
    analytics: loadAnalytics,
    perf: loadPerf,
    barcode: showBarcode,
    encodeBarcode: encodeBarcode,
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
        if (vs && vs.version !== '4.0.0') problems.push('visual-search.js köhnədir (v4.0.0 lazımdır)');
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
