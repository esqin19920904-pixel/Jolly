/* ==========================================================================
   JOLLY — jolly-share-inbox.js                v6.0.0   (2026-07-30)
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

   v4.2 — 12 RƏQƏMLİ KOD MƏSƏLƏSİ (Esqinin ekran şəklindən çıxdı):
     Məhsul kartındaki kod 025532000007 (12 rəqəm), amma proqramın
     köhnə generatoru altında 0255320000074 yazır — yəni 12 rəqəmi
     "yoxlama rəqəmi yazılmamış EAN-13" sayıb sonuna 4 əlavə edir.
     Halbuki 025532000007 həm də DÜZGÜN UPC-A-dır (yoxlama rəqəmi 7).
     İki variant skanerdən kassaya FƏRQLİ rəqəm göndərir:
        EAN-13 →  0255320000074
        UPC-A  →  025532000007   (bazadaki kodun eynisi)
     Hansının düzgün olduğunu yalnız kassa proqramı bilir, ona görə
     hər ikisi verilir: 🔁 düyməsi ilə keçid, seçim yadda saxlanılır
     (`jolly_bc_12`), ekranda "skaner bu rəqəmi verəcək" yazılır.
     Standart: EAN-13 — məhsul kartındaki köhnə davranışla eyni.

   v4.3 — İKİNCİ MODUL: 🧾 Kassa Barkodu  (#/barcode-view)
     Şəkil olmadan barkod tapmaq üçün. Müştəri malı əlində gətirir
     və ya adını deyir → adı/kodu yazırsan → mal çıxır → toxunursan
     → barkod ekranda, kassada vurursan.
     • Ad, barkod, xüsusi kod, model, qeyd üzrə axtarış; hərf
       bərabərləşdirməsi ilə ("corab" → "Çorab")
     • ➕ növbə: bir neçə malı sıraya yığıb kassada ardıcıl vurmaq
       ("Növbəti 2/3 →" düyməsi barkoddan barkoda keçir)
     • Eyni barkod ekranı, eyni 🔁 EAN/UPC keçidi
     İcazə açarı: barcode.screen.view (standart AÇIQ)

   v4.4 — KASSA BARKODU EKRANINA KAMERA:
     Müştəri malı əlində gətirir → 📷 basıb çəkirsən → proqram
     Vision AI v4 ilə tapır → barkod ÖZÜ açılır (əlavə toxunuş yox).
     • Barkod/QR şəkildə görünürsə birinci o oxunur (ən dəqiq yol)
     • 🟢 dəqiq uyğunluqda barkod avtomatik açılır; 🟡/🔴 olanda
       ən yaxın 5 mal confidence ilə çıxır, seçimi sən edirsən
     • "🎯 Avtomatik aç" açarı ilə söndürmək olar (jolly_bc_auto)
     • 📁 Qalereyadan da olur (əvvəl çəkilmiş şəkil üçün)
     Kamera icazəsi: search.photo (visual-search.js ilə eyni açar)

   v4.5 — 🩺 YOXLAMA VƏ HESABAT (Kassa Barkodu ekranının altında):
     Proqram özünü ölçür, Esqinin əlini gözləmir.
     • Sistem yoxlaması: motor versiyası, barmaq izləri, IndexedDB,
       BarcodeDetector, OCR vəziyyəti
     • BARKOD ÖRTÜYÜ: kataloqdaki bütün kodlar yoxlanır və sayılır —
       13 rəqəm (təmiz EAN-13) / 12 rəqəm (EAN↔UPC qeyri-müəyyənliyi)
       / 8 rəqəm / EAN olmayan / kodsuz. Yəni kassada NEÇƏ malı
       skanerlə vurmaq mümkündür — dəqiq rəqəmlə
     • DƏQİQLİK TESTİ: 8 mal seçilir, şəkilləri WhatsApp kimi
       korlanır, axtarışa verilir və həmin malın hansı yerdə
       çıxdığı sayılır → "8/8 birinci yerdə, orta 0.9 s,
       düzgün nəticələrin orta confidence-i 128"
       (optimist ölçüdür — başqa bucaqdan çəkilmiş şəkil çətindir)
     • 📋 Hesabatı kopyala — Claude-a göndərmək üçün

   v4.6 — ÜÇÜNCÜ MODUL: 🔧 Barkod Düzəldici  (#/barcode-fix)
     Örtük hesabatı problemi SAYIRDI, düzəltmək üçün yol yox idi.
     Bu ekran hər problemli kodu ayrı-ayrı göstərir və düzgün
     variantı hesablayır (riyaziyyat dəqiqdir, təxmin yoxdur):
       • 13 rəqəm, çek rəqəmi səhv → düzgün rəqəm hesablanır
       • 12 rəqəm → EAN-13 forması (sonuna çek rəqəmi)
       • 7 rəqəm → EAN-8 forması
       • qısa/hərfli daxili kodlar → düzəldilə bilmir, ayrı siyahı
     TƏHLÜKƏSİZLİK QAYDASI (vacib): standart əməliyyat ƏLAVƏ
     ETMƏKDİR, əvəz etmək deyil. Səbəb: kassa proqramının bazasında
     mal köhnə kodla yazılıbsa, kodu dəyişmək əlaqəni qırar. Köhnə
     kod yerində qalır, düzgün variant ikinci kod kimi yazılır.
     "Əvəz et" ayrı düymədir və xəbərdarlıq göstərir.
     Toqquşma yoxlanışı: düzəldilmiş kod başqa malda varsa
     əməliyyat bloklanır.
     Yazma JollyDB.Products.update ilə gedir → dəyişiklik tarixçəsi
     və Geri Al Mərkəzi işləyir.
     İcazə açarı: barcode.fix.run (standart AÇIQ)

   v4.7 — STUDIO AXTARIŞI (Esqin: "modullar 61 oldu, tapmaq çətindir")
     studios.js-ə TOXUNULMUR. Studio ekranı açılanda bu fayl kart
     siyahısının üstünə axtarış qutusu yerləşdirir və yazdıqca
     kartları süzür (ad + təsvir üzrə, hərf bərabərləşdirməsi ilə:
     "tema" → "Theme Studio"). Sıra dəyişdirmə (⠿) və görünüş
     keçidi işləməyə davam edir — yalnız display dəyişir.
     Ekran yenidən çəkilsə qutu özünü təkrar qoyur (MutationObserver).

   v4.8 — CANLI AXTARIŞ QOŞMASI (Esqin: "Ətraflı Axtarış da Kassa
   Barkodundaki kimi 2 hərfdən sonra tapsın, amma öz forması qalsın")
     Həmin ekranı çəkən fayla TOXUNULMUR. Ekranda axtarış xanası
     tapılırsa yanında ⚡ çipi çıxır; açılanda yazdıqca xananın
     altında canlı nəticə paneli görünür (ad/kod/marka/model/qeyd
     üzrə, hərf bərabərləşdirməsi ilə). Nəticəyə toxunanda barkod
     açılır, ⓘ ilə pasport. Formanın öz düymələri toxunulmaz qalır
     — panel yalnız ƏLAVƏDİR, heç nəyi əvəz etmir.
     Hansı ekranda açıq olduğu yadda saxlanılır (jolly_live_search).

   v4.9 — İŞ MASASI TƏNZİMLƏYİCİSİ (Esqin: "axtarış elə Kassa
   Barkodundakı kimi dashboardda olsun; xəritə düzgün işləmir və
   təkrarlanır; xoşuma gəlməyən panelləri söndürək, lazım olanda
   yandıraq; istədiyim ekranı özüm iş masasına sala bilim")
     dashboard.js-ə TOXUNULMUR — hər şey DOM səviyyəsindədir:
     • 🔎 AXTARIŞ — iş masasının başında, Kassa Barkodundakı motorun
       eynisi: 2 hərf/rəqəm yazan kimi tapır, 📊 barkod, ⓘ pasport
     • 📌 QISA YOLLAR — istədiyin ekranları iş masasına sancırsan;
       siyahı ModuleRegistry-dən gəlir, yəni bütün 61 ekran seçimdədir
     • ⚙️ PANELLƏR — iş masasındaki blokları tapır və hər birini
       söndürüb-yandırmaq olur. TƏKRARLANAN bloklar ayrıca işarələnir
       ("2 dəfə görünür") — xəritənin təkrarını belə susdurmaq olar.
       Söndürülənlər `jolly_dash_hidden`, sancılanlar `jolly_dash_pins`
     QEYD: xəritənin ÖZ daxili problemi bununla düzəlmir — onun faylı
     lazımdır. Bu, yalnız görünüşü idarə etməyə imkan verir.

   v5.0 — 🔍 QLOBAL AXTARIŞ MÜHƏRRİKİ  (window.JollySearch)
     Esqinin istəyi: "bir axtarış mühərriki bütün proqramda işləsin,
     bir dəfə təkmilləşdirəsən, hər yerdə eyni keyfiyyət olsun".
     Bir mühərrik — dörd yerdə işlədilir (Kassa Barkodu, iş masası,
     canlı axtarış qoşması, şəkil nəticələri) və başqa modullar da
     `JollySearch.query('...')` ilə çağıra bilər.
       • Sahələr: ad, barkod, əlavə kodlar, marka, model, qeyd,
         qrup/yer/status/tədarükçü (id-lər adlara çevrilir), rəng, qiymət
       • Parçalı kod: 8691234567890 malını "1234" yazanda tapır
       • Çoxsözlü: "elidor 350 mavi" — hamısı birlikdə axtarılır
       • Səhv yazı (fuzzy): "sobrani"/"sbra" → Sobranie
         (Levenshtein + ardıcıl hərf uyğunluğu)
       • Bal ilə sıralama: tam kod 100 · kod başlanğıcı 92 ·
         ad tam 96 · ad başlanğıcı 88 · içində 76 · sahə 60 · fuzzy ≤58
       • 🕒 Son axtarışlar (jolly_search_recent, son 8)
       • 🎤 Səslə axtarış — brauzer dəstəkləyirsə (az-AZ, olmasa tr-TR)
     Nə YOXDUR (dürüst): "qara maska" kimi məna axtarışı — malın
     rəngi ayrıca sahədə yazılmayıbsa proqram onu bilə bilməz.

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

      /* v5.1 — Esqin: "şəkil atanda barkod çıxmır, kassada vurmaq üçün".
         Mal tapılan kimi barkodu ÖZÜ aç: barkod/QR ilə tapılıbsa və ya
         güvən 🟢-dirsə. 🎯 açarı sönülü olsa açılmır. */
      try {
        var t0 = state.results && state.results[0];
        if (t0) {
          var c0 = codeOf(t0.product);
          var sure0 = (t0.via === 'barkod' || t0.via === 'QR' || t0.label === 'green');
          if (c0 && sure0 && autoOpenPref()) showBarcode(c0, t0.product.name || '');
        }
      } catch (e) {}
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
    if (!perm('vision.warmup.run')) { toast('Bu əməliyyat üçün icazəniz yoxdur', 'error'); return; }
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
    if (!perm('vision.learn.use')) { toast('Öyrətmək üçün icazəniz yoxdur', 'error'); return; }
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
    if (!perm('vision.learn.use')) { toast('Öyrətmək üçün icazəniz yoxdur', 'error'); return; }
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

  function encodeBarcode(raw, mode) {
    mode = mode || mode12();
    var d = String(raw || '').replace(/\D/g, '');
    if (!d) return { ok: false, why: 'rəqəm yoxdur' };

    var warn = null, kind = null;

    var alt = null;      // ikinci mümkün variant (12 rəqəmli kodlar üçün)

    /* 12 rəqəm İKİ şey ola bilər:
         a) tam UPC-A          → başına 0 → skaner 12 rəqəm verir
         b) çek rəqəmi yazılmamış EAN-13 → sonuna çek → skaner 13 rəqəm
       Kassa proqramının hansını gözlədiyini bilmirik, ona görə
       istifadəçi seçir (mode). Standart: 'ean' (məhsul kartı ilə eyni) */
    if (d.length === 12) {
      var u = 0;
      for (var k = 0; k < 11; k++) u += (+d[k]) * (k % 2 === 0 ? 3 : 1);
      var upcValid = ((10 - u % 10) % 10 === +d[11]);
      var eanForm = d + sum13(d);
      var upcForm = '0' + d;

      if (mode === 'upc' && upcValid) {
        d = upcForm;
        warn = 'UPC-A rejimi — skaner kassaya ' + upcForm.slice(1) + ' göndərəcək';
        alt = { mode: 'ean', label: 'EAN-13 (kart kimi)', reports: eanForm };
      } else {
        d = eanForm;
        warn = 'sonuna yoxlama rəqəmi (' + eanForm[12] + ') əlavə edildi — məhsul kartı ilə eyni';
        if (upcValid) alt = { mode: 'upc', label: 'UPC-A', reports: upcForm.slice(1) };
      }
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
      return { ok: true, bits: bits, kind: kind, digits: d, warn: warn, alt: alt,
               reports: (kind === 'EAN-13' && d[0] === '0' && mode === 'upc') ? d.slice(1) : d };
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
      return { ok: true, bits: b, kind: kind, digits: d, warn: warn, alt: null, reports: d };
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

  /* ======================================================================
     KOD TAPICISI  (v5.3)  — Esqin: "mal tapılır, amma barkod çıxmır"
     Səbəb: kod hər malda eyni sahədə durmur. Məhsul səhifəsi barkodu
     göstərirdi, mənim siyahım isə "kod yoxdur" deyirdi, çünki yalnız
     4 sahəyə baxırdım. İndi bütün sahələr gəzilir:
       • adında kod/code/barcode/barkod/ean/upc/gtin/sku/artikul olan
         HƏR sahə kod namizədidir
       • bunlardan başqa, dəyəri tam 8-14 rəqəmdən ibarət olan hər
         sahə də namizəddir (id, qiymət, say, tarix sahələri istisna)
     Sıralama: skanerlə oxuna bilən (EAN-13/EAN-8) kodlar ƏVVƏL.
     ====================================================================== */

  var CODE_KEYS = /(barcode|barkod|bar_code|ean|upc|gtin|sku|artikul|artikul|kod|code)/i;
  var SKIP_KEYS = /(^id$|_id$|price|qiymet|qty|quantity|stock|say$|count|date|time|created|updated|order|index|version|width|height|weight)/i;

  function scanCodes(p) {
    var out = [];
    if (!p || typeof p !== 'object') return out;

    function push(v) {
      if (v === null || v === undefined) return;
      var s = String(v).trim();
      if (!s || s.length > 24) return;
      if (out.indexOf(s) < 0) out.push(s);
    }

    /* TARİX DAMĞASI TƏLƏSİ: adı bilinməyən sahədə 13 rəqəm epoch
       ola bilər (1753… = 2025-ci il) — onu barkod kimi göstərsək
       kassaya uydurma kod verərdik. Belə dəyərlər atılır. */
    function epochLike(s) {
      return (s.length === 13 && /^1[5-9]\d{11}$/.test(s)) ||
             (s.length === 10 && /^1[5-9]\d{8}$/.test(s));
    }

    var named = [], loose = [];
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v === null || v === undefined) return;
      if (typeof v === 'object' && !Array.isArray(v)) return;
      var isNamed = CODE_KEYS.test(k);
      if (SKIP_KEYS.test(k) && !isNamed) return;

      var vals = Array.isArray(v) ? v : [v];
      vals.forEach(function (x) {
        if (x === null || x === undefined || typeof x === 'object') return;
        var sv = String(x).trim();
        if (!sv || sv.length > 24) return;
        if (isNamed) { named.push(sv); return; }
        if (/^\d{8,14}$/.test(sv) && !epochLike(sv)) loose.push(sv);
      });
    });

    /* adı kodla bağlı sahələr əsasdır; adsız sahələrdən gələnlər
       yalnız heç bir adlı kod yoxdursa işlədilir */
    (named.length ? named : loose).forEach(push);
    if (named.length) loose.forEach(function (sv) {
      if (encodeBarcode(sv).ok) push(sv);       // skan olunan əlavə kod faydalıdır
    });

    // skanerlə oxunanlar öndə
    out.sort(function (a, b) {
      var ea = encodeBarcode(a).ok ? 0 : 1;
      var eb = encodeBarcode(b).ok ? 0 : 1;
      if (ea !== eb) return ea - eb;
      return String(b).length - String(a).length;
    });
    return out;
  }

  function allCodes(p) { return scanCodes(p); }

  function codeOf(p) {
    var list = scanCodes(p);
    if (!list.length) return '';
    return list[0];
  }

  /* kod var, amma barkod kimi çəkilə bilmirsə — istifadəçiyə deyilsin */
  function codeScannable(p) {
    var c = codeOf(p);
    return c ? encodeBarcode(c).ok : false;
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

  function mode12(v) {
    try {
      if (v === undefined) return localStorage.getItem('jolly_bc_12') || 'ean';
      localStorage.setItem('jolly_bc_12', v);
    } catch (e) {}
    return v || 'ean';
  }

  function rotPref(v) {
    try {
      if (v === undefined) return localStorage.getItem('jolly_bc_rot') === '1';
      localStorage.setItem('jolly_bc_rot', v ? '1' : '0');
    } catch (e) {}
    return !!v;
  }

  /* ======================================================================
     v6.0 — ƏSAS AÇAR (Esqin: "qatmısan bir-birinə")
     Ekranlara kənardan qoşulan HƏR ŞEY standart olaraq SÖNÜLÜDÜR:
       • iş masası blokları
       • canlı axtarış qoşması
       • Studio ekran axtarışı
     Proqram öz normal görünüşündə işləyir. İstədiyini Kassa Barkodu →
     🩺 paneldəki açarlardan bir-bir yandırırsan. Üç ekran (Şəkillə
     axtarış, Kassa Barkodu, Barkod Düzəldici) toxunulmazdır — onlar
     ayrıca ekranlardır, heç nəyin üstünə qoyulmur.
     ====================================================================== */
  var ADDON_KEYS = { live: 'jolly_addon_live', dash: 'jolly_addon_dash', studio: 'jolly_addon_studio' };

  /* v5.8: standartlar — canlı axtarış və Studio axtarışı AÇIQ
     (Esqin onları bəyəndi), iş masası blokları isə SÖNÜLÜ, çünki
     dashboard.js-in öz Dashboard Studio-su var və o, əsasdır.
     Açarlar Dashboard Studio-dan da idarə olunur. */
  var ADDON_DEFAULT = { live: false, studio: true, dash: false }; // canlı axtarış standart SÖNÜLÜ — yalnız #/home, #/products-da mənalıdır

  function addonOn(which) {
    try {
      var v = localStorage.getItem(ADDON_KEYS[which]);
      return v === null ? !!ADDON_DEFAULT[which] : v === '1';
    } catch (e) { return !!ADDON_DEFAULT[which]; }
  }
  function addonSet(which, on) {
    try { localStorage.setItem(ADDON_KEYS[which], on ? '1' : '0'); } catch (e) {}
  }

  function perm(key) {
    try {
      if (!global.POS || typeof global.POS.can !== 'function') return true;
      return global.POS.can(key);
    } catch (e) { return true; }
  }

  function showBarcode(code, name, inQueue) {
    if (!perm('barcode.show.use')) { toast('Barkodu göstərmək üçün icazəniz yoxdur', 'error'); return; }
    /* v5.7 XƏTA DÜZƏLİŞİ: barkod ekranının stilləri yalnız "Şəkillə
       axtarış" ekranı açılanda yüklənirdi. Kassa Barkodundan, canlı
       axtarışdan və ya düzəldicidən açanda CSS səhifədə OLMURDU —
       ona görə ağ kart, düymələr və ölçülər itirdi (Esqinin şəkli).
       İndi ekran öz stilini özü yükləyir. */
    injectCSS();
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
      h.push('<div class="bccard">');
      h.push('<div class="bcimg" id="jsi-bcimg">' + barcodeSVG(enc.bits, rotated) + '</div>');
      h.push('<div class="bcnum">' + esc(enc.digits) + '</div>');
      h.push('</div>');
      h.push('<div class="bcinf">' + enc.kind + ' · skaner kassaya bunu göndərəcək: <b>' +
             esc(enc.reports || enc.digits) + '</b></div>');
      if (enc.warn) h.push('<div class="bcwarn">ℹ️ ' + esc(enc.warn) + '</div>');
      h.push('<div class="bcrow">');
      h.push('<div class="bcb big2" data-bcrot="1">⟲ ' + (rotated ? 'Portret' : 'Yan çevir (daha enli)') + '</div>');
      h.push('<div class="bcb" data-copy="' + esc(enc.reports || enc.digits) + '">📋 Kopyala</div>');
      h.push('</div>');
      if (enc.alt) {
        h.push('<div class="bcrow"><div class="bcb alt" data-bcmode="' + esc(enc.alt.mode) + '">' +
               '🔁 ' + esc(enc.alt.label) + ' variantı → ' + esc(enc.alt.reports) + '</div></div>');
        h.push('<div class="bctip">Kassa "mal tapılmadı" deyirsə 🔁 basıb digər variantı sına — ' +
               'ikisi skanerə fərqli rəqəm verir. Düzgün olan yadda qalır.</div>');
      }
      if (inQueue && L.queue.length) {
        h.push('<div class="bcrow"><div class="bcb big2" data-bcnext="1" style="font-size:15px;padding:15px">' +
               'Növbəti ' + (L.qi + 2 > L.queue.length ? '(bitir)' : (L.qi + 2) + '/' + L.queue.length) + ' →</div></div>');
      }
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
      if (t.closest && t.closest('[data-bcnext]')) { e.stopPropagation(); return lqueueNext(); }
      var md = t.closest && t.closest('[data-bcmode]');
      if (md) {
        e.stopPropagation();
        mode12(md.getAttribute('data-bcmode'));
        keepAwake(false);
        box.remove();
        return showBarcode(code, name);
      }
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
    injectCSS();
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
    '#jsi-pp *{box-sizing:border-box!important;text-transform:none!important;letter-spacing:normal!important}',
    '#jsi-pp{position:fixed!important;inset:0!important;z-index:99998!important;background:rgba(6,7,12,.96);overflow:auto;',
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
    '#jsi-bc{position:fixed!important;inset:0!important;z-index:99999!important;background:#fff!important;',
    'color:#111!important;overflow:auto!important;display:flex!important;align-items:center!important;',
    'justify-content:center!important;padding:18px 12px!important;font-size:14px!important;',
    'line-height:1.45!important;text-align:center!important}',
    '#jsi-bc *{box-sizing:border-box!important;color:inherit;text-transform:none!important;',
    'letter-spacing:normal!important;max-width:none!important;float:none!important}',
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
    '#jsi-bc .bcb.alt{flex:1;background:#eef3fb;border-color:#c6d6ee;color:#24405e;font-size:12.5px}',
    '#jsi-bc .bccard{background:#fff;border-radius:18px;padding:14px 12px 10px;',
    'box-shadow:0 2px 14px rgba(0,0,0,.13)}',
    '#jsi-bc .bcnum{font-family:ui-monospace,monospace;font-size:30px;font-weight:800;letter-spacing:3px;',
    'margin-top:6px;color:#000}',
    '#jsi-bc .bcnum.big{font-size:26px;letter-spacing:1px;word-break:break-all;margin:30px 0}',
    '#jsi-bc .bcinf{font-size:12.5px;opacity:.7;margin-top:10px;line-height:1.5}',
    '#jsi-bc .bcinf b{font-family:ui-monospace,monospace}',
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
    h.push('</div><div class="brow">');
    h.push('<div class="bb" data-auto="1">' + (autoOpenPref()
             ? '🎯 barkod avtomatik açılır — söndür'
             : '🚫 avtomatik açılma sönülü — yandır') + '</div>');
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
      var lb = r.label || (r.confidence >= 95 ? 'green' : (r.confidence >= 72 ? 'yellow' : 'red'));
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
      /* v6.3: Analitika/Dublikat/Performans buradan çıxarıldı —
         indi Studio-da müstəqil ekranlardır (JOLLY qovluğu). */
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

      /* v5.1: barkod düyməsi yalnız güclü uyğunluqda yox, kodu olan
         hər birinci nəticədə görünsün — kassada vurmaq üçün lazımdır */
      if (codeOf(top.product)) h.push(bigCard(top));
      else {
        /* v5.3: mal tapıldı, amma kodu yoxdur — barkod çəkiləcək rəqəm
           yoxdur. Əvvəl ekran sadəcə susurdu, indi səbəbi deyir. */
        h.push('<div class="bc" style="border-color:rgba(255,138,138,.4);background:rgba(255,138,138,.09);color:#ffbcbc">' +
               '⚠️ <b>' + esc(top.product.name || 'Bu mal') + '</b> tapıldı, amma <b>kodu yoxdur</b> — ' +
               'barkod çəkmək üçün rəqəm lazımdır. Kodu yazandan sonra kassada vurmaq olacaq.</div>');
        h.push('<div class="btn" data-open="' + esc(top.product.id) + '">ⓘ Malın pasportunu aç</div>');
        h.push('<div class="btn" data-gofix="1">🔧 Barkod Düzəldicini aç</div>');
      }
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
      if (t.closest && t.closest('[data-gofix]')) {
        e.stopPropagation();
        global.location.hash = '#/barcode-fix';
        return;
      }
      if (t.closest && t.closest('[data-auto]')) {
        e.stopPropagation();
        autoOpenPref(!autoOpenPref());
        toast(autoOpenPref() ? '🎯 Barkod avtomatik açılacaq' : '🚫 Avtomatik açılma söndürüldü');
        paint(); return;
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


  /* ======================================================================
     🧾 KASSA BARKODU — #/barcode-view   (v4.3)
     Şəkil olmadan: ad/kod yaz → mal tap → barkodu ekranda göstər
     ====================================================================== */

  var LPERM = 'barcode.screen.view', LROUTE = '#/barcode-view';
  var L = { q: '', rows: [], queue: [], qi: 0, vs: null, vsSource: null, vsStage: null, vsMs: null,
            diag: null, bench: null };

  function foldTxt(v) {
    v = String(v === null || v === undefined ? '' : v).toLowerCase();
    try {
      var DB = global.JollyDB || lex('JollyDB');
      if (DB && typeof DB.foldText === 'function') return DB.foldText(v);
    } catch (e) {}
    return v.replace(/ə/g, 'e').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u');
  }

  function allProducts() {
    try {
      var P = (global.JollyDB && global.JollyDB.Products) || null;
      if (P) {
        if (typeof P.all === 'function') return P.all() || [];
        if (typeof P.getAll === 'function') return P.getAll() || [];
        if (typeof P.list === 'function') return P.list() || [];
      }
    } catch (e) {}
    try { return JSON.parse(localStorage.getItem('jolly_products') || '[]') || []; }
    catch (e) { return []; }
  }

  /* v5.2: nəticə ilə birlikdə NİYƏ tapıldığını da saxlayırıq —
     "Si" yazanda "Corab" çıxırsa, altında "qeyddə tapıldı" yazılsın ki,
     səhv kimi görünməsin. Səbəb LMETA-da id → {why, score}. */
  var LMETA = {};

  function lsearch(q) {
    try {
      var res = Search.query(q, { limit: 30 });
      LMETA = {};
      res.forEach(function (r) { LMETA[String(r.product.id)] = { why: r.why, score: r.score }; });
      return res.map(function (r) { return r.product; });
    } catch (e) { LMETA = {}; return []; }
  }

  function whyLabel(p) {
    var m = LMETA[String(p.id)];
    if (!m || m.score >= 78) return '';        // ad uyğunluğu — izah lazım deyil
    return '<div class="whyx">↳ ' + esc(m.why) + '</div>';
  }

  function lqueueAdd(p) {
    var code = codeOf(p);
    if (!code) { toast('Bu malın kodu yoxdur', 'error'); return; }
    if (L.queue.some(function (x) { return String(x.id) === String(p.id); })) {
      toast('Artıq növbədədir');
      return;
    }
    L.queue.push({ id: p.id, name: p.name || '', code: code });
    lpaint();
  }

  function lqueueStart() {
    if (!perm('barcode.queue.use')) { toast('Növbə üçün icazəniz yoxdur', 'error'); return; }
    if (!L.queue.length) return;
    L.qi = 0;
    showBarcode(L.queue[0].code, L.queue[0].name, true);
  }

  function lqueueNext() {
    L.qi++;
    if (L.qi >= L.queue.length) {
      toast('Növbə bitdi — ' + L.queue.length + ' mal', 'ok');
      L.queue = []; L.qi = 0;
      var b = document.getElementById('jsi-bc');
      if (b) { keepAwake(false); b.remove(); }
      lpaint();
      return;
    }
    var it = L.queue[L.qi];
    showBarcode(it.code, it.name, true);
  }


  /* ---------------- v4.4 · kamera ilə tap → barkod ---------------- */

  function autoOpenPref(v) {
    try {
      if (v === undefined) return localStorage.getItem('jolly_bc_auto') !== '0';
      localStorage.setItem('jolly_bc_auto', v ? '1' : '0');
    } catch (e) {}
    return v !== false;
  }

  function lcamera() {
    try {
      if (global.POS && typeof global.POS.can === 'function' && !global.POS.can('search.photo')) {
        toast('Şəkillə axtarış üçün icazəniz yoxdur', 'error');
        return;
      }
    } catch (e) {}
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Kamera yoxdur — qalereyadan seç', 'error');
      return lgallery();
    }

    var ov = document.createElement('div');
    ov.id = 'jlk-cam';
    ov.innerHTML =
      '<video id="jlk-v" autoplay playsinline muted></video>' +
      '<div class="frame"></div>' +
      '<div class="hint">Malı çərçivəyə tut · barkod görünürsə onu kadra sal</div>' +
      '<div class="bar"><span class="x" data-camx="1">✕</span>' +
      '<span class="shot" data-camshot="1">📸</span>' +
      '<span class="g" data-camgal="1">📁</span></div>';
    document.body.appendChild(ov);

    var stream = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (st) {
        stream = st;
        var v = document.getElementById('jlk-v');
        if (v) v.srcObject = st;
      })
      .catch(function () {
        toast('Kameraya giriş alınmadı', 'error');
        stop();
        lgallery();
      });

    function stop() {
      if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
      var n = document.getElementById('jlk-cam');
      if (n) n.remove();
    }

    ov.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-camx]')) return stop();
      if (t.closest && t.closest('[data-camgal]')) { stop(); return lgallery(); }
      if (t.closest && t.closest('[data-camshot]')) {
        var v = document.getElementById('jlk-v');
        if (!v || !v.videoWidth) { toast('Kamera hazır deyil'); return; }
        var cv = document.createElement('canvas');
        cv.width = v.videoWidth; cv.height = v.videoHeight;
        cv.getContext('2d').drawImage(v, 0, 0);
        var url = cv.toDataURL('image/jpeg', 0.88);
        stop();
        lvisual(url, 'kamera');
      }
    });
  }

  function lgallery() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function (ev) { lvisual(ev.target.result, 'qalereya'); };
      fr.readAsDataURL(f);
    };
    input.click();
  }

  /* şəkildən tap → 🟢 olsa barkodu ÖZÜ aç */
  function lvisual(dataUrl, source) {
    L.vs = 'loading'; L.vsSource = source; L.vsStage = null;
    lpaint();
    ensureVisual().then(function (vs) {
      if (typeof vs.findBest !== 'function') {
        L.vs = null; lpaint();
        toast('Motor köhnədir — visual-search.js v4 lazımdır', 'error');
        return;
      }
      return vs.findBest(dataUrl, {
        limit: 5,
        onProgress: function (done, total) {
          var el = document.getElementById('jlk-prog');
          if (el) el.textContent = '🔍 ' + done + ' / ' + total + ' mal yoxlanılır…';
        }
      }).then(function (out) {
        L.vs = out.results || [];
        L.vsStage = out.stage || null;
        L.vsMs = out.stats ? out.stats.ms : null;
        lpaint();

        var top = L.vs[0];
        if (!top) { toast('Mal tapılmadı'); return; }
        var code = codeOf(top.product);
        var sure = (top.via === 'barkod' || top.via === 'QR' || top.label === 'green');
        if (code && sure && autoOpenPref()) showBarcode(code, top.product.name || '');
      });
    }).catch(function (e) {
      L.vs = null; lpaint();
      toast('Alınmadı: ' + ((e && e.message) || e), 'error');
    });
  }

  function lvsHTML() {
    if (!L.vs) return '';
    if (L.vs === 'loading') {
      return '<div class="empty" id="jlk-prog">🔍 Şəkil müqayisə olunur…</div>';
    }
    var h = ['<div class="vsh"><span>📷 ' + esc(L.vsSource || '') + ' ilə tapılanlar' +
             (L.vsStage ? ' · ' + esc(L.vsStage) : '') +
             (L.vsMs ? ' · ' + (L.vsMs / 1000).toFixed(1) + ' s' : '') +
             '</span><span class="vx" data-vsclear="1">✕</span></div>'];
    if (!L.vs.length) {
      h.push('<div class="empty">Uyğun mal tapılmadı.</div>');
      return h.join('');
    }
    L.vs.forEach(function (r, i) {
      var p = r.product, code = codeOf(p);
      var lb = r.label || 'red';
      h.push('<div class="r ' + lb + '">');
      var t = thumbOf(p);
      h.push(t ? '<img class="th" src="' + esc(t) + '">' : '<div class="th" data-vth="' + esc(p.id) + '"></div>');
      h.push('<div class="m" data-vopen="' + esc(p.id) + '">');
      h.push('<div class="nm">' + (MEDALS[i] || (i + 1) + '.') + ' ' + esc(p.name || '(adsız)') + '</div>');
      h.push(code ? '<div class="cd">' + esc(code) + '</div>' : '<div class="no">kod yoxdur</div>');
      h.push('<div class="no">' + (r.via === 'vizual' ? (r.similarity + '% oxşar · confidence ' + r.confidence)
                                                      : esc(r.via) + ' ilə tapıldı') + '</div>');
      h.push('</div>');
      if (code) h.push('<div class="b" data-bar="' + esc(code) + '" data-bname="' + esc(p.name || '') + '">📊</div>');
      h.push('</div>');
    });
    return h.join('');
  }


  /* ---------------- v4.5 · yoxlama və hesabat ---------------- */

  function codeCoverage() {
    var out = { total: 0, ean13: 0, twelve: 0, ean8: 0, notEan: 0, noCode: 0, badCheck: 0, samples: [] };
    allProducts().forEach(function (p) {
      out.total++;
      var codes = allCodes(p);
      if (!codes.length) { out.noCode++; return; }
      var c = codes[0], d = String(c).replace(/\D/g, '');
      if (d.length === 13) {
        out.ean13++;
        var e = encodeBarcode(c);
        if (e.ok && e.warn && e.warn.indexOf('uyğun deyil') >= 0) out.badCheck++;
      } else if (d.length === 12) {
        out.twelve++;
        if (out.samples.length < 3) out.samples.push(c);
      } else if (d.length === 8 || d.length === 7) out.ean8++;
      else out.notEan++;
    });
    return out;
  }

  function runDiag() {
    L.diag = 'loading'; lpaint();
    ensureVisual().then(function (vs) {
      var d = { cov: codeCoverage(), engine: vs.version || '?', inbox: '4.5.0' };
      d.barcodeApi = (typeof BarcodeDetector !== 'undefined');
      d.mode12 = mode12();
      d.rot = rotPref() ? 'yan' : 'portret';
      var jobs = [];
      if (typeof vs.selfTest === 'function') jobs.push(vs.selfTest().then(function (r) { d.vs = r; }));
      if (typeof vs.perf === 'function') jobs.push(vs.perf().then(function (r) { d.perf = r; }));
      return Promise.all(jobs).then(function () { L.diag = d; lpaint(); });
    }).catch(function (e) { L.diag = { error: String(e && e.message || e) }; lpaint(); });
  }

  function runBench() {
    L.bench = 'loading'; lpaint();
    ensureVisual().then(function (vs) {
      if (typeof vs.benchmark !== 'function') {
        L.bench = { error: 'visual-search.js v4.1 lazımdır' }; lpaint(); return;
      }
      return vs.benchmark({
        n: 8,
        onProgress: function (done, total) {
          var el = document.getElementById('jlk-bp');
          if (el) el.textContent = '⏱ ' + done + ' / ' + total + ' mal yoxlanılır…';
        }
      }).then(function (r) { L.bench = r; lpaint(); });
    }).catch(function (e) { L.bench = { error: String(e && e.message || e) }; lpaint(); });
  }

  function reportText() {
    var d = (L.diag && L.diag !== 'loading') ? L.diag : null;
    var b = (L.bench && L.bench !== 'loading') ? L.bench : null;
    var t = ['JOLLY şəkillə axtarış — hesabat', new Date().toLocaleString(), ''];
    if (d) {
      t.push('motor: v' + d.engine + ' · inbox: v' + d.inbox);
      t.push('BarcodeDetector: ' + (d.barcodeApi ? 'var' : 'YOX'));
      t.push('12 rəqəm rejimi: ' + d.mode12 + ' · barkod görünüşü: ' + d.rot);
      if (d.vs) {
        t.push('mal: ' + d.vs.products + ' · şəkli olan: ' + d.vs.withImages + ' · şəkil: ' + d.vs.images);
        t.push('barmaq izi: ' + (d.vs.fingerprints || 0) + ' · öz-özünə test: ' + d.vs.sample + ' (100 olmalı)');
        if (d.vs.autoCrop) t.push('auto-crop nümunə: ' + JSON.stringify(d.vs.autoCrop));
        if (d.vs.error) t.push('xəta: ' + d.vs.error);
      }
      if (d.perf) {
        t.push('hazır deyil: ' + (d.perf.warm ? d.perf.warm.missing : '?') + ' şəkil · OCR: ' + d.perf.ocr);
        t.push('RAM: ' + (d.perf.ram ? d.perf.ram.usedMB + '/' + d.perf.ram.limitMB + ' MB' : 'yox'));
        t.push('orta axtarış: ' + (d.perf.avgSearchMs !== null ? d.perf.avgSearchMs + ' ms' : '—'));
      }
      var c = d.cov;
      t.push('');
      t.push('BARKOD ÖRTÜYÜ (' + c.total + ' mal):');
      t.push('  13 rəqəm EAN-13: ' + c.ean13 + (c.badCheck ? ' (çek rəqəmi səhv: ' + c.badCheck + ')' : ''));
      t.push('  12 rəqəm (EAN/UPC qeyri-müəyyən): ' + c.twelve + (c.samples.length ? ' — məs. ' + c.samples.join(', ') : ''));
      t.push('  8 rəqəm EAN-8: ' + c.ean8);
      t.push('  EAN formatı deyil: ' + c.notEan);
      t.push('  kodsuz: ' + c.noCode);
      var scan = c.ean13 + c.twelve + c.ean8;
      t.push('  → skanerlə vurula bilər: ' + scan + ' (' + Math.round(scan / (c.total || 1) * 100) + '%)');
    }
    if (b && !b.error) {
      t.push('');
      t.push('DƏQİQLİK TESTİ (' + b.tested + ' mal, optimist ölçü):');
      t.push('  birinci yerdə: ' + b.first + ' (' + b.firstRate + '%) · ilk 5-də: ' + b.top5 + ' · itən: ' + b.missed);
      t.push('  orta vaxt: ' + b.avgMs + ' ms');
      t.push('  düzgün nəticənin orta confidence-i: ' + b.avgConfidenceCorrect);
      if (b.avgConfidenceWrongTop) t.push('  səhv birinci gələnin confidence-i: ' + b.avgConfidenceWrongTop);
      (b.rows || []).forEach(function (r) {
        t.push('   · ' + String(r.name).slice(0, 24) + ' → ' +
               (r.rank > 0 ? ('yer ' + r.rank + ' · conf ' + r.confidence + ' · ' + r.ms + ' ms')
                           : (r.note || 'tapılmadı · birinci: ' + String(r.topName).slice(0, 20))));
      });
    }
    return t.join('\n');
  }

  function diagHTML() {
    var h = ['<div class="dgbox">'];
    h.push('<div class="dgh">🩺 Yoxlama və hesabat</div>');
    h.push('<div class="tools" style="margin-top:0">');
    h.push('<div class="t small" data-dgrun="1">🔍 Sistem</div>');
    h.push('<div class="t small" data-dgbench="1">⏱ Dəqiqlik</div>');
    h.push('<div class="t small" data-dgcopy="1">📋</div>');
    h.push('</div>');
    h.push('<div class="tools" style="margin-top:8px"><div class="t" data-dgfab="1">' +
           (qsFabOn() ? '🔎 Üzən axtarışı söndür' : '🔎 Üzən axtarışı AÇ') + '</div></div>');
    var bound = '';
    try { bound = localStorage.getItem('jolly_dash_hash') || ''; } catch (e) {}
    h.push('<div class="dgs">🔌 ƏLAVƏLƏR — hansını istəyirsən</div>');
    h.push('<div class="dgl">Bunlar proqramın mövcud ekranlarına kənardan qoşulur. ' +
           'Standart: hamısı SÖNÜLÜ. Yalnız istədiyini yandır.</div>');
    [['live', '⚡ Canlı axtarış (yazdıqca tapır)'],
     ['dash', '🏠 İş masası blokları'],
     ['studio', '🔎 Studio ekran axtarışı']].forEach(function (a) {
      var on = addonOn(a[0]);
      h.push('<div class="k" data-dgaddon="' + a[0] + '" style="cursor:pointer"><span>' + a[1] +
             '</span><b>' + (on ? '✅ açıq' : '🚫 sönülü') + '</b></div>');
    });
    h.push('<div class="dgs">🏠 BLOKLAR HANSI EKRANDA ÇIXSIN</div>');
    h.push('<div class="dgl">Hazırda: <b>' + esc(bound || 'avtomatik (iş masası)') + '</b><br>' +
           'Aşağıdakılar son açdığın ekranlardır — iş masasının ünvanına toxun:</div>');
    h.push('<div class="chips" style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px">');
    hashLog().forEach(function (x) {
      h.push('<span class="t small" style="padding:8px 12px;font-size:11.5px" data-dgbind="' + esc(x) + '">' +
             esc(x) + '</span>');
    });
    h.push('<span class="t small" style="padding:8px 12px;font-size:11.5px" data-dgbind="__auto__">↩ avtomatik</span>');
    h.push('</div>');
    h.push('<div class="tools" style="margin-top:8px"><div class="t" data-dgblocks="1">' +
           (dsRead('jolly_dash_blocks_off', 0) ? '🏠 İş masası bloklarını GÖSTƏR' : '🏠 İş masası bloklarını gizlət') +
           '</div></div>');

    var d = L.diag;
    if (d === 'loading') h.push('<div class="dgl">Yoxlanılır…</div>');
    else if (d && d.error) h.push('<div class="dgl warn">' + esc(d.error) + '</div>');
    else if (d) {
      var c = d.cov, scan = c.ean13 + c.twelve + c.ean8;
      h.push('<div class="dgl">');
      h.push('<div class="k"><span>Motor</span><b>v' + esc(d.engine) + '</b></div>');
      if (d.vs) {
        h.push('<div class="k"><span>Mal / şəkli olan</span><b>' + d.vs.products + ' / ' + d.vs.withImages + '</b></div>');
        h.push('<div class="k"><span>Barmaq izi</span><b>' + (d.vs.fingerprints || 0) + '</b></div>');
        h.push('<div class="k"><span>Öz-özünə test</span><b>' + (d.vs.sample === 100 ? '✅ 100' : '⚠️ ' + d.vs.sample) + '</b></div>');
      }
      h.push('<div class="k"><span>Barkod oxuyucusu</span><b>' + (d.barcodeApi ? '✅ var' : '⚠️ yox') + '</b></div>');
      h.push('<div class="k"><span>12 rəqəm rejimi</span><b>' + esc(d.mode12) + '</b></div>');
      h.push('<div class="dgs">BARKOD ÖRTÜYÜ · ' + c.total + ' mal</div>');
      h.push('<div class="k"><span>EAN-13 (13 rəqəm)</span><b>' + c.ean13 + '</b></div>');
      if (c.badCheck) h.push('<div class="k"><span>— çek rəqəmi səhv</span><b class="warn">' + c.badCheck + '</b></div>');
      h.push('<div class="k"><span>12 rəqəm (EAN/UPC)</span><b>' + c.twelve + '</b></div>');
      h.push('<div class="k"><span>EAN-8</span><b>' + c.ean8 + '</b></div>');
      h.push('<div class="k"><span>EAN deyil</span><b>' + c.notEan + '</b></div>');
      h.push('<div class="k"><span>Kodsuz</span><b>' + c.noCode + '</b></div>');
      h.push('<div class="k"><span>Skanerlə vurula bilər</span><b>' + scan + ' · ' +
             Math.round(scan / (c.total || 1) * 100) + '%</b></div>');
      h.push('</div>');
    }

    var b = L.bench;
    if (b === 'loading') h.push('<div class="dgl" id="jlk-bp">⏱ Test başlayır…</div>');
    else if (b && b.error) h.push('<div class="dgl warn">' + esc(b.error) + '</div>');
    else if (b) {
      h.push('<div class="dgl">');
      h.push('<div class="dgs">DƏQİQLİK · ' + b.tested + ' mal</div>');
      h.push('<div class="k"><span>Birinci yerdə</span><b>' + b.first + ' / ' + b.tested + ' · ' + b.firstRate + '%</b></div>');
      h.push('<div class="k"><span>İlk 5-də</span><b>' + b.top5 + '</b></div>');
      h.push('<div class="k"><span>Orta vaxt</span><b>' + (b.avgMs / 1000).toFixed(2) + ' s</b></div>');
      h.push('<div class="k"><span>Düzgünün confidence-i</span><b>' + b.avgConfidenceCorrect + '</b></div>');
      if (b.avgConfidenceWrongTop) {
        h.push('<div class="k"><span>Səhv birincinin conf.</span><b class="warn">' + b.avgConfidenceWrongTop + '</b></div>');
      }
      h.push('<div class="dgn">ℹ️ ' + esc(b.note || '') + '</div>');
      h.push('</div>');
    }
    h.push('</div>');
    return h.join('');
  }

  var LCSS = [
    '#jlk{padding:14px 12px 90px;max-width:720px;margin:0 auto;color:#e8e8f0}',
    '#jlk h2{font-size:19px;margin:0 0 3px;font-weight:700}',
    '#jlk .sub{font-size:12px;opacity:.6;margin-bottom:13px;line-height:1.5}',
    '#jlk input{width:100%;padding:14px 15px;border-radius:14px;font-size:16px;color:#e8e8f0;',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.13);outline:none}',
    '#jlk input:focus{border-color:rgba(245,196,81,.45)}',
    '#jlk .qbar{display:flex;align-items:center;gap:8px;margin-top:11px;padding:11px 12px;border-radius:13px;',
    'background:rgba(245,196,81,.11);border:1px solid rgba(245,196,81,.35);font-size:12.5px;color:#f7d98a}',
    '#jlk .qbar .go{margin-left:auto;padding:9px 13px;border-radius:11px;font-weight:700;cursor:pointer;',
    'background:rgba(55,214,122,.18);border:1px solid rgba(55,214,122,.45);color:#8ff0b5}',
    '#jlk .qbar .cl{padding:9px 11px;border-radius:11px;cursor:pointer;background:rgba(255,255,255,.07);',
    'border:1px solid rgba(255,255,255,.12);color:#e8e8f0}',
    '#jlk .r{display:flex;align-items:center;gap:11px;padding:12px;margin-top:9px;border-radius:15px;',
    'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}',
    '#jlk .r .th{width:54px;height:54px;flex:none;border-radius:11px;object-fit:cover;background:#0a0b12}',
    '#jlk .r .m{flex:1;min-width:0;cursor:pointer}',
    '#jlk .r .nm{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#jlk .r .cd{font-family:ui-monospace,monospace;font-size:15.5px;font-weight:700;color:#f7d98a;margin-top:3px}',
    '#jlk .r .no{font-size:11.5px;opacity:.5;margin-top:3px}',
    '#jlk .r .b{flex:none;padding:11px 12px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;',
    'border:1px solid rgba(245,196,81,.45);background:rgba(245,196,81,.15);color:#f7d98a}',
    '#jlk .r .plus{flex:none;padding:11px;border-radius:12px;font-size:14px;cursor:pointer;',
    'border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05)}',
    '#jlk .empty{text-align:center;opacity:.55;font-size:13.5px;padding:26px 8px;line-height:1.6}',
    '#jlk .whyx{font-size:11px;opacity:.5;margin-top:3px}',
    '#jlk .recent{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:13px}',
    '#jlk .recent .rt{font-size:11px;opacity:.5;letter-spacing:.5px;width:100%}',
    '#jlk .recent .rc{padding:8px 12px;border-radius:999px;font-size:12.5px;cursor:pointer;',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}',
    '#jlk .recent .rc.x{opacity:.6}',
    '#jlk .jgo{margin-top:14px;padding:12px;border-radius:13px;text-align:center;font-size:12.5px;',
    'cursor:pointer;opacity:.7;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)}',
    '#jlk .tools{display:flex;gap:8px;margin-top:11px}',
    '#jlk .tools .t{flex:1;padding:14px 8px;border-radius:13px;text-align:center;font-size:13.5px;',
    'font-weight:700;cursor:pointer;border:1px solid rgba(120,180,255,.35);',
    'background:rgba(120,180,255,.12);color:#bcd8ff}',
    '#jlk .tools .t.small{flex:none;min-width:52px;border-color:rgba(255,255,255,.13);',
    'background:rgba(255,255,255,.05);color:#e8e8f0}',
    '#jlk .vsh{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:11.5px;opacity:.65;',
    'letter-spacing:.4px;font-family:ui-monospace,monospace}',
    '#jlk .vsh .vx{margin-left:auto;padding:6px 10px;border-radius:9px;cursor:pointer;',
    'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);opacity:1}',
    '#jlk .r.green{border-color:rgba(55,214,122,.5);background:rgba(55,214,122,.08)}',
    '#jlk .r.yellow{border-color:rgba(245,196,81,.4)}',
    '#jlk-cam{position:fixed;inset:0;z-index:9997;background:#000}',
    '#jlk-cam video{width:100%;height:100%;object-fit:cover}',
    '#jlk-cam .frame{position:absolute;left:8%;right:8%;top:26%;height:34%;border-radius:18px;',
    'border:2px solid rgba(255,255,255,.75);box-shadow:0 0 0 100vmax rgba(0,0,0,.35)}',
    '#jlk-cam .hint{position:absolute;left:0;right:0;top:64%;text-align:center;color:#fff;',
    'font-size:13px;opacity:.9;padding:0 20px;line-height:1.5}',
    '#jlk-cam .bar{position:absolute;left:0;right:0;bottom:34px;display:flex;align-items:center;',
    'justify-content:center;gap:26px}',
    '#jlk-cam .bar span{display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff}',
    '#jlk-cam .shot{width:74px;height:74px;border-radius:50%;background:#fff;color:#111;font-size:28px}',
    '#jlk-cam .x,#jlk-cam .g{width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.18);font-size:19px}',
    '#jlk .dgbox{margin-top:22px;padding:12px;border-radius:15px;background:rgba(255,255,255,.03);',
    'border:1px solid rgba(255,255,255,.08)}',
    '#jlk .dgh{font-size:12px;letter-spacing:.7px;opacity:.6;text-transform:uppercase;margin-bottom:9px}',
    '#jlk .dgl{margin-top:11px;font-size:12.5px;line-height:1.7;font-family:ui-monospace,monospace;opacity:.85}',
    '#jlk .dgl .k{display:flex;justify-content:space-between;gap:10px;padding:4px 0;',
    'border-bottom:1px solid rgba(255,255,255,.05)}',
    '#jlk .dgl .k b{color:#f7d98a}',
    '#jlk .dgl .k b.warn{color:#ff9d9d}',
    '#jlk .dgs{margin-top:11px;font-size:11px;letter-spacing:.7px;opacity:.55}',
    '#jlk .dgn{margin-top:9px;font-size:11px;opacity:.55;line-height:1.5;font-family:inherit}',
    '#jlk .warn{color:#ff9d9d}'
  ].join('');

  function linjectCSS() {
    if (document.getElementById('jlk-css')) return;
    var st = document.createElement('style');
    st.id = 'jlk-css'; st.textContent = LCSS;
    document.head.appendChild(st);
  }

  function lrowsHTML() {
    var h = [];
    if (L.queue.length) {
      h.push('<div class="qbar"><span>🧾 Növbə: <b>' + L.queue.length + ' mal</b></span>');
      h.push('<span class="cl" data-lclear="1">🗑</span>');
      h.push('<span class="go" data-lstart="1">▶ Başla</span></div>');
    }
    if (!L.q || L.q.length < 2) {
      var rec = Search.recent();
      if (rec.length) {
        h.push('<div class="recent"><span class="rt">🕒 Son axtarışlar</span>');
        rec.forEach(function (t) { h.push('<span class="rc" data-lrec="' + esc(t) + '">' + esc(t) + '</span>'); });
        h.push('<span class="rc x" data-lrecx="1">🗑</span></div>');
      }
      h.push('<div class="empty">Malın adını və ya kodunu yaz.<br>' +
             'Ən azı 2 hərf — kod yazsan dəqiq uyğunluq öndə çıxır.<br>' +
             'Səhv yazsan da tapır: “sobrani” → Sobranie.</div>');
      return h.join('');
    }
    if (!L.rows.length) {
      h.push('<div class="empty">“' + esc(L.q) + '” üzrə mal tapılmadı.</div>');
      return h.join('');
    }
    L.rows.forEach(function (p) {
      var code = codeOf(p);
      h.push('<div class="r">');
      var t = thumbOf(p);
      h.push(t ? '<img class="th" src="' + esc(t) + '">' : '<div class="th" data-lth="' + esc(p.id) + '"></div>');
      h.push('<div class="m" data-lopen="' + esc(p.id) + '">');
      h.push('<div class="nm">' + esc(p.name || '(adsız)') + '</div>');
      h.push(code ? ('<div class="cd">' + esc(code) + '</div>' +
                     (codeScannable(p) ? '' : '<div class="no">⚠️ bu kod barkod kimi çəkilmir</div>'))
                  : '<div class="no">kod yoxdur</div>');
      if (p.price) h.push('<div class="no">' + esc(p.price) + ' ₼</div>');
      h.push(whyLabel(p));
      h.push('</div>');
      if (code) {
        h.push('<div class="plus" data-ladd="' + esc(p.id) + '">➕</div>');
        h.push('<div class="b" data-bar="' + esc(code) + '" data-bname="' + esc(p.name || '') + '">📊</div>');
      }
      h.push('</div>');
    });
    return h.join('');
  }

  function lpaint() {
    var host = document.getElementById('jlk-list');
    if (!host) return;
    host.innerHTML = lvsHTML() + lrowsHTML() +
      '<div class="jgo" data-lgodiag="1">🩺 Yoxlama və hesabat →</div>';
    var a = document.getElementById('jlk-auto');
    if (a) a.textContent = autoOpenPref() ? '🎯' : '🚫';
    lhydrate();
  }

  function lhydrate() {
    var S = lex('JollyStorage');
    if (!S) return;
    var get = S.getImage || S.get;
    if (typeof get !== 'function') return;
    Array.prototype.forEach.call(document.querySelectorAll('#jlk-list [data-lth],#jlk-list [data-vth]'), function (el) {
      var key = el.getAttribute('data-lth') || el.getAttribute('data-vth');
      var p = null;
      L.rows.forEach(function (x) { if (String(x.id) === key) p = x; });
      if (!p && L.vs && L.vs.length) L.vs.forEach(function (r) { if (String(r.product.id) === key) p = r.product; });
      if (!p) return;
      var src = (p.images && p.images[0]) || p.image || p.img || '';
      if (typeof src !== 'string' || src.indexOf('idb:') !== 0) return;
      Promise.resolve(get.call(S, src)).then(function (url) {
        if (!url) return;
        var im = document.createElement('img');
        im.className = 'th'; im.src = url;
        if (el.parentNode) el.parentNode.replaceChild(im, el);
      }).catch(function () {});
    });
  }

  var _ltimer = null;
  function lbind() {
    var root = document.getElementById('jlk-host');
    if (!root || root.__lb) return;
    root.__lb = true;

    root.addEventListener('input', function (e) {
      if (!e.target || e.target.id !== 'jlk-q') return;
      L.q = e.target.value || '';
      if (_ltimer) clearTimeout(_ltimer);
      _ltimer = setTimeout(function () {
        L.rows = lsearch(L.q);
        lpaint();
      }, 180);
    });

    root.addEventListener('click', function (e) {
      var t = e.target;
      var br = t.closest && t.closest('[data-bar]');
      if (br) {
        e.stopPropagation();
        return showBarcode(br.getAttribute('data-bar'), br.getAttribute('data-bname') || '');
      }
      if (L.q && L.q.length >= 2 && t.closest && t.closest('[data-bar],[data-lopen],[data-vopen]')) {
        Search.remember(L.q);
      }
      if (t.closest && t.closest('[data-lmic]')) {
        e.stopPropagation();
        return voiceSearch(function (txt) {
          var i = document.getElementById('jlk-q');
          if (i) i.value = txt;
          L.q = txt; L.rows = lsearch(txt); Search.remember(txt); lpaint();
        });
      }
      var rcx = t.closest && t.closest('[data-lrec]');
      if (rcx) {
        e.stopPropagation();
        var rtxt = rcx.getAttribute('data-lrec');
        var rin = document.getElementById('jlk-q');
        if (rin) rin.value = rtxt;
        L.q = rtxt; L.rows = lsearch(rtxt); lpaint(); return;
      }
      if (t.closest && t.closest('[data-lrecx]')) { e.stopPropagation(); Search.forget(); lpaint(); return; }
      if (t.closest && t.closest('[data-dgfab]')) {
        e.stopPropagation();
        var fon = qsFabOn();
        if (!fon) { global.JollyQuickSearch.show(); toast('Üzən axtarış açıldı', 'ok'); }
        else { global.JollyQuickSearch.hide(); toast('Üzən axtarış söndürüldü', 'ok'); }
        lpaint(); return;
      }
      var ad = t.closest && t.closest('[data-dgaddon]');
      if (ad) {
        e.stopPropagation();
        var which = ad.getAttribute('data-dgaddon');
        var now = !addonOn(which);
        addonSet(which, now);
        if (which === 'live' && !now) lsClose();
        if (which === 'dash' && !now) dsOff();
        if (which === 'studio' && !now) ssOff();
        toast(now ? 'Yandırıldı — ekranı yenilə' : 'Söndürüldü', 'ok');
        lpaint(); return;
      }
      var bind = t.closest && t.closest('[data-dgbind]');
      if (bind) {
        e.stopPropagation();
        var hv = bind.getAttribute('data-dgbind');
        try {
          if (hv === '__auto__') localStorage.removeItem('jolly_dash_hash');
          else localStorage.setItem('jolly_dash_hash', hv);
        } catch (x) {}
        dsWrite('jolly_dash_blocks_off', 0);
        toast(hv === '__auto__' ? 'Avtomatik rejim' : 'Bloklar ' + hv + ' ekranına bağlandı', 'ok');
        lpaint(); return;
      }
      if (t.closest && t.closest('[data-dgblocks]')) {
        e.stopPropagation();
        var off = dsRead('jolly_dash_blocks_off', 0);
        dsWrite('jolly_dash_blocks_off', off ? 0 : 1);
        toast(off ? 'İş masası blokları açıldı' : 'İş masası blokları gizləndi', 'ok');
        lpaint(); return;
      }
      if (t.closest && t.closest('[data-lgodiag]')) { e.stopPropagation(); global.location.hash = '#/jolly-diag'; return; }
      if (t.closest && t.closest('[data-dgrun]')) { e.stopPropagation(); return runDiag(); }
      if (t.closest && t.closest('[data-dgbench]')) { e.stopPropagation(); return runBench(); }
      if (t.closest && t.closest('[data-dgcopy]')) {
        e.stopPropagation();
        var rep = reportText();
        if (global.navigator && global.navigator.clipboard) {
          global.navigator.clipboard.writeText(rep).then(function () { toast('Hesabat kopyalandı', 'ok'); },
                                                        function () { toast('Kopyalanmadı', 'error'); });
        } else { console.log(rep); toast('Hesabat konsola yazıldı'); }
        return;
      }
      if (t.closest && t.closest('[data-lcam]')) { e.stopPropagation(); return lcamera(); }
      if (t.closest && t.closest('[data-lgal]')) { e.stopPropagation(); return lgallery(); }
      if (t.closest && t.closest('[data-lauto]')) {
        e.stopPropagation();
        autoOpenPref(!autoOpenPref());
        toast(autoOpenPref() ? '🎯 Barkod avtomatik açılacaq' : '🚫 Avtomatik açılma söndürüldü');
        lpaint(); return;
      }
      if (t.closest && t.closest('[data-vsclear]')) {
        e.stopPropagation(); L.vs = null; lpaint(); return;
      }
      var vo = t.closest && t.closest('[data-vopen]');
      if (vo) {
        e.stopPropagation();
        var vid = vo.getAttribute('data-vopen'), vp = null;
        if (L.vs && L.vs.length) L.vs.forEach(function (r) { if (String(r.product.id) === vid) vp = r.product; });
        var vc = vp ? codeOf(vp) : '';
        if (vc) return showBarcode(vc, vp.name || '');
        return openPassport(vid);
      }
      var ad = t.closest && t.closest('[data-ladd]');
      if (ad) {
        e.stopPropagation();
        var id1 = ad.getAttribute('data-ladd'), p1 = null;
        L.rows.forEach(function (x) { if (String(x.id) === id1) p1 = x; });
        if (p1) lqueueAdd(p1);
        return;
      }
      if (t.closest && t.closest('[data-lstart]')) { e.stopPropagation(); return lqueueStart(); }
      if (t.closest && t.closest('[data-lclear]')) {
        e.stopPropagation(); L.queue = []; L.qi = 0; lpaint(); return;
      }
      var op = t.closest && t.closest('[data-lopen]');
      if (op) {
        e.stopPropagation();
        var id2 = op.getAttribute('data-lopen'), p2 = null;
        L.rows.forEach(function (x) { if (String(x.id) === id2) p2 = x; });
        var c2 = p2 ? codeOf(p2) : '';
        if (c2) return showBarcode(c2, p2.name || '');
        return openPassport(id2);
      }
    });
  }

  var Lookup = {
    version: '6.3.0',
    render: function () {
      linjectCSS();
      setTimeout(function () {
        lbind();
        var i = document.getElementById('jlk-q');
        if (i) { i.value = L.q || ''; }
        L.rows = L.q ? lsearch(L.q) : [];
        lpaint();
        if (DS.wantCam) { DS.wantCam = false; setTimeout(lcamera, 250); }   // iş masasındaki 📷
      }, 0);
      return '<div id="jlk-host"><div id="jlk">' +
             '<h2>🧾 Kassa Barkodu</h2>' +
             '<div class="sub">Malın adını və ya kodunu yaz → barkodu ekranda göstər → kassada vur. ' +
             '➕ ilə bir neçə malı növbəyə yığıb ardıcıl vurmaq olar.</div>' +
             '<input id="jlk-q" type="search" inputmode="search" placeholder="Ad və ya kod…" autocomplete="off">' +
             '<div class="tools">' +
               '<div class="t" data-lcam="1">📷 Kamera ilə tap</div>' +
               '<div class="t small" data-lmic="1">🎤</div>' +
               '<div class="t small" data-lgal="1">📁</div>' +
               '<div class="t small" data-lauto="1" id="jlk-auto"></div>' +
             '</div>' +
             '<div id="jlk-list"></div></div></div>';
    },
    afterRender: function () { linjectCSS(); lbind(); },
    search: function (q) { L.q = q || ''; L.rows = lsearch(L.q); lpaint(); return L.rows.length; },
    camera: lcamera,
    gallery: lgallery,
    diag: runDiag,
    bench: runBench,
    report: reportText,
    coverage: codeCoverage,
    show: showBarcode,
    queue: function () { return L.queue.slice(); }
  };

  global.JollyBarcodeView = Lookup;


  /* ======================================================================
     🔧 BARKOD DÜZƏLDİCİ — #/barcode-fix   (v4.6)
     ====================================================================== */

  var FPERM = 'barcode.fix.run', FROUTE = '#/barcode-fix';
  var F = { rows: null, bad: null, busy: false, tab: 'fix', done: {} };

  function analyzeCode(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    var orig = String(raw || '').trim();

    if (!d) return { kind: 'nocode', why: 'rəqəm yoxdur' };

    if (d.length === 13) {
      var c = sum13(d.slice(0, 12));
      if (c === +d[12]) return { kind: 'ok', value: d };
      return { kind: 'checkfix', from: orig, to: d.slice(0, 12) + c,
               why: 'çek rəqəmi ' + d[12] + ' olmalıdır ' + c };
    }
    if (d.length === 12) {
      var u = 0;
      for (var k = 0; k < 11; k++) u += (+d[k]) * (k % 2 === 0 ? 3 : 1);
      var upcValid = ((10 - u % 10) % 10 === +d[11]);
      return { kind: 'twelve', from: orig, to: d + sum13(d),
               why: upcValid ? 'həm UPC-A kimi düzgündür — əlavə etmək daha təhlükəsizdir'
                             : 'çek rəqəmi yoxdur, EAN-13 forması hesablandı' };
    }
    if (d.length === 7) {
      return { kind: 'ean8', from: orig, to: d + sum8(d), why: 'EAN-8 çek rəqəmi hesablandı' };
    }
    if (d.length === 8) {
      var c8 = sum8(d.slice(0, 7));
      if (c8 === +d[7]) return { kind: 'ok', value: d };
      return { kind: 'checkfix', from: orig, to: d.slice(0, 7) + c8,
               why: 'EAN-8 çek rəqəmi ' + d[7] + ' olmalıdır ' + c8 };
    }
    return { kind: 'nofix', from: orig, why: d.length + ' rəqəm — EAN formatına uyğun gəlmir' };
  }

  function fscan() {
    F.busy = true; fpaint();
    var list = allProducts();
    var used = {};
    list.forEach(function (p) { allCodes(p).forEach(function (c) { used[String(c).replace(/\D/g, '')] = p.id; }); });

    var rows = [], bad = [];
    list.forEach(function (p) {
      var codes = allCodes(p);
      if (!codes.length) return;
      var a = analyzeCode(codes[0]);
      if (a.kind === 'ok') return;
      if (a.kind === 'nocode' || a.kind === 'nofix') {
        bad.push({ id: p.id, name: p.name || '(adsız)', code: codes[0], why: a.why });
        return;
      }
      var clash = used[a.to] && String(used[a.to]) !== String(p.id);
      rows.push({
        id: p.id, name: p.name || '(adsız)', kind: a.kind,
        from: a.from, to: a.to, why: a.why,
        clash: clash ? String(used[a.to]) : null,
        already: codes.some(function (c) { return String(c).replace(/\D/g, '') === a.to; })
      });
    });
    F.rows = rows; F.bad = bad; F.busy = false;
    fpaint();
  }

  /* yazma: əlavə et (təhlükəsiz) və ya əvəz et */
  function fwrite(row, mode) {
    var P = (global.JollyDB && global.JollyDB.Products) || lex('Products');
    var list = allProducts();
    var p = null;
    list.forEach(function (x) { if (String(x.id) === String(row.id)) p = x; });
    if (!p) { toast('Mal tapılmadı', 'error'); return; }

    var patch = {};
    if (mode === 'replace') {
      patch.barcode = row.to;
      if (!p.barcode2 && p.barcode) patch.barcode2 = p.barcode;   // köhnə kod itmir
    } else {
      if (Array.isArray(p.barcodes)) {
        var arr = p.barcodes.slice();
        if (arr.indexOf(row.to) < 0) arr.push(row.to);
        patch.barcodes = arr;
      } else if (!p.barcode2) {
        patch.barcode2 = row.to;
      } else {
        patch.barcodes = [row.to];
      }
    }

    var okDone = function () {
      F.done[String(row.id)] = mode;
      toast(mode === 'replace' ? 'Əvəz edildi: ' + row.to : 'Əlavə kod yazıldı: ' + row.to, 'ok');
      fpaint();
    };

    try {
      if (P && typeof P.update === 'function') {
        var res = P.update(row.id, patch);
        return Promise.resolve(res).then(okDone, function (e) {
          toast('Yazılmadı: ' + ((e && e.message) || e), 'error');
        });
      }
    } catch (e) {}

    // ehtiyat yol: localStorage — körpüdən keçir, jurnala və Geri Al-a düşür
    try {
      var all = JSON.parse(localStorage.getItem('jolly_products') || '[]');
      var hit = false;
      all.forEach(function (x) {
        if (String(x.id) === String(row.id)) {
          hit = true;
          Object.keys(patch).forEach(function (k) { x[k] = patch[k]; });
        }
      });
      if (!hit) { toast('Mal siyahıda tapılmadı', 'error'); return; }
      localStorage.setItem('jolly_products', JSON.stringify(all));
      okDone();
    } catch (e2) {
      toast('Yazılmadı: ' + ((e2 && e2.message) || e2), 'error');
    }
  }

  function fbulk() {
    var todo = (F.rows || []).filter(function (r) { return !r.clash && !r.already && !F.done[String(r.id)]; });
    if (!todo.length) { toast('Düzəldiləsi qalmadı'); return; }
    if (!global.confirm(todo.length + ' mala düzgün kod ƏLAVƏ edilsin? Köhnə kodlar yerində qalır.')) return;
    todo.forEach(function (r) { fwrite(r, 'add'); });
  }

  var FCSS = [
    '#jbf{padding:14px 12px 90px;max-width:720px;margin:0 auto;color:#e8e8f0}',
    '#jbf h2{font-size:19px;margin:0 0 3px;font-weight:700}',
    '#jbf .sub{font-size:12px;opacity:.62;margin-bottom:13px;line-height:1.55}',
    '#jbf .safe{padding:11px 12px;border-radius:13px;margin-bottom:13px;font-size:12px;line-height:1.6;',
    'border:1px solid rgba(120,180,255,.3);background:rgba(120,180,255,.09);color:#c8dcf5}',
    '#jbf .tabs{display:flex;gap:7px;margin-bottom:12px}',
    '#jbf .tab{flex:1;padding:11px 6px;border-radius:12px;text-align:center;font-size:12.5px;font-weight:700;',
    'cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}',
    '#jbf .tab.on{border-color:rgba(245,196,81,.5);background:rgba(245,196,81,.13);color:#f7d98a}',
    '#jbf .btn{display:block;padding:13px;border-radius:13px;text-align:center;font-weight:700;font-size:14px;',
    'cursor:pointer;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);margin-bottom:10px}',
    '#jbf .btn.go{border-color:rgba(55,214,122,.45);background:rgba(55,214,122,.13);color:#8ff0b5}',
    '#jbf .row{padding:12px;border-radius:15px;margin-bottom:10px;',
    'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}',
    '#jbf .row.clash{border-color:rgba(255,138,138,.4);background:rgba(255,138,138,.07)}',
    '#jbf .row.done{border-color:rgba(55,214,122,.45);background:rgba(55,214,122,.08)}',
    '#jbf .nm{font-size:14px;font-weight:600;margin-bottom:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#jbf .codes{font-family:ui-monospace,monospace;font-size:15px;line-height:1.6}',
    '#jbf .codes .o{opacity:.6;text-decoration:line-through}',
    '#jbf .codes .n{color:#8ff0b5;font-weight:700}',
    '#jbf .why{font-size:11.5px;opacity:.6;margin-top:5px;line-height:1.5}',
    '#jbf .acts{display:flex;gap:7px;margin-top:10px}',
    '#jbf .a{flex:1;padding:10px;border-radius:11px;text-align:center;font-size:12.5px;font-weight:700;',
    'cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}',
    '#jbf .a.add{border-color:rgba(55,214,122,.45);background:rgba(55,214,122,.13);color:#8ff0b5}',
    '#jbf .a.rep{border-color:rgba(255,138,138,.35);background:rgba(255,138,138,.09);color:#ffbcbc}',
    '#jbf .a.bar{flex:none;min-width:48px;border-color:rgba(245,196,81,.45);',
    'background:rgba(245,196,81,.14);color:#f7d98a}',
    '#jbf .empty{text-align:center;opacity:.55;font-size:13.5px;padding:26px 8px;line-height:1.6}',
    '#jbf .warn{color:#ff9d9d}'
  ].join('');

  function finject() {
    if (document.getElementById('jbf-css')) return;
    var st = document.createElement('style');
    st.id = 'jbf-css'; st.textContent = FCSS;
    document.head.appendChild(st);
  }

  function frowHTML(r) {
    var done = F.done[String(r.id)];
    var cls = done ? ' done' : (r.clash ? ' clash' : '');
    var h = ['<div class="row' + cls + '">'];
    h.push('<div class="nm">' + esc(r.name) + '</div>');
    h.push('<div class="codes"><span class="' + (r.kind === 'twelve' ? '' : 'o') + '">' + esc(r.from) +
           '</span> → <span class="n">' + esc(r.to) + '</span></div>');
    h.push('<div class="why">' + esc(r.why) +
           (r.clash ? ' · <span class="warn">⚠️ bu kod başqa malda var — bloklandı</span>' : '') +
           (r.already ? ' · artıq mövcuddur' : '') +
           (done ? ' · <b>' + (done === 'replace' ? 'əvəz edildi' : 'əlavə edildi') + '</b>' : '') + '</div>');
    h.push('<div class="acts">');
    h.push('<div class="a bar" data-bar="' + esc(r.to) + '" data-bname="' + esc(r.name) + '">📊</div>');
    if (!done && !r.clash && !r.already) {
      h.push('<div class="a add" data-fadd="' + esc(r.id) + '">➕ Əlavə kod yaz</div>');
      h.push('<div class="a rep" data-frep="' + esc(r.id) + '">🔁 Əvəz et</div>');
    }
    h.push('</div></div>');
    return h.join('');
  }

  function fbodyHTML() {
    if (F.busy) return '<div class="empty">Kataloq yoxlanılır…</div>';
    if (!F.rows) return '<div class="empty">Kataloqu yoxlamaq üçün düyməyə bas.</div>';

    var h = [];
    h.push('<div class="tabs">');
    h.push('<div class="tab' + (F.tab === 'fix' ? ' on' : '') + '" data-ftab="fix">🔧 Düzəldilə bilər (' + F.rows.length + ')</div>');
    h.push('<div class="tab' + (F.tab === 'bad' ? ' on' : '') + '" data-ftab="bad">🚫 Düzəldilmir (' + (F.bad || []).length + ')</div>');
    h.push('</div>');

    if (F.tab === 'fix') {
      if (!F.rows.length) {
        h.push('<div class="empty">✅ Düzəldiləsi kod yoxdur — bütün EAN kodları qaydasındadır.</div>');
        return h.join('');
      }
      var left = F.rows.filter(function (r) { return !r.clash && !r.already && !F.done[String(r.id)]; }).length;
      if (left) h.push('<div class="btn go" data-fbulk="1">➕ Hamısına əlavə et (' + left + ' mal)</div>');
      F.rows.forEach(function (r) { h.push(frowHTML(r)); });
      return h.join('');
    }

    if (!F.bad || !F.bad.length) {
      h.push('<div class="empty">Düzəldilə bilməyən kod yoxdur.</div>');
      return h.join('');
    }
    h.push('<div class="sub">Bu kodlar EAN formatına uyğun deyil — riyazi düzəliş mümkün deyil. ' +
           'Belə mallara ya real barkod yazılmalı, ya kassada kod əl ilə daxil edilməlidir.</div>');
    F.bad.forEach(function (b) {
      h.push('<div class="row"><div class="nm">' + esc(b.name) + '</div>' +
             '<div class="codes">' + esc(b.code) + '</div>' +
             '<div class="why">' + esc(b.why) + '</div></div>');
    });
    return h.join('');
  }

  function fpaint() {
    var host = document.getElementById('jbf-body');
    if (!host) return;
    host.innerHTML = fbodyHTML();
  }

  function fbind() {
    var root = document.getElementById('jbf-host');
    if (!root || root.__fb) return;
    root.__fb = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-fscan]')) { e.stopPropagation(); return fscan(); }
      if (t.closest && t.closest('[data-fbulk]')) { e.stopPropagation(); return fbulk(); }
      var tb = t.closest && t.closest('[data-ftab]');
      if (tb) { e.stopPropagation(); F.tab = tb.getAttribute('data-ftab'); fpaint(); return; }
      var br = t.closest && t.closest('[data-bar]');
      if (br) {
        e.stopPropagation();
        return showBarcode(br.getAttribute('data-bar'), br.getAttribute('data-bname') || '');
      }
      var ad = t.closest && t.closest('[data-fadd]');
      if (ad) {
        e.stopPropagation();
        var r1 = null, id1 = ad.getAttribute('data-fadd');
        (F.rows || []).forEach(function (x) { if (String(x.id) === id1) r1 = x; });
        if (r1) fwrite(r1, 'add');
        return;
      }
      var rp = t.closest && t.closest('[data-frep]');
      if (rp) {
        e.stopPropagation();
        if (!perm('barcode.fix.replace')) {
          toast('Əsas kodu əvəz etmək üçün icazə lazımdır (İcazə Mərkəzi)', 'error');
          return;
        }
        var r2 = null, id2 = rp.getAttribute('data-frep');
        (F.rows || []).forEach(function (x) { if (String(x.id) === id2) r2 = x; });
        if (!r2) return;
        if (!global.confirm('Malın əsas kodu dəyişdirilsin?\n\n' + r2.from + ' → ' + r2.to +
                            '\n\nDİQQƏT: kassa proqramında mal köhnə kodla yazılıbsa, əlaqə qırıla bilər. ' +
                            'Köhnə kod ikinci kod sahəsində saxlanılacaq.')) return;
        fwrite(r2, 'replace');
        return;
      }
    });
  }

  var Fixer = {
    version: '6.3.0',
    render: function () {
      finject();
      setTimeout(function () { fbind(); fpaint(); }, 0);
      return '<div id="jbf-host"><div id="jbf">' +
             '<h2>🔧 Barkod Düzəldici</h2>' +
             '<div class="sub">Kassada rədd olunan kodları tapır və düzgün variantı hesablayır. ' +
             'Riyaziyyat dəqiqdir — təxmin yoxdur.</div>' +
             '<div class="safe">🛡 Standart əməliyyat <b>əlavə etməkdir</b>, əvəz etmək deyil. ' +
             'Səbəb: kassa proqramında mal köhnə kodla yazılıbsa, kodu dəyişmək əlaqəni qırar. ' +
             'Köhnə kod yerində qalır, düzgün variant ikinci kod kimi yazılır. ' +
             'Hər dəyişiklik Geri Al Mərkəzinə düşür.</div>' +
             '<div class="btn" data-fscan="1">🔍 Kataloqu yoxla</div>' +
             '<div id="jbf-body"></div></div></div>';
    },
    afterRender: function () { finject(); fbind(); },
    scan: fscan,
    rows: function () { return F.rows; }
  };

  global.JollyBarcodeFix = Fixer;
  global.JollyDashboard = { show: function () { dsWrite('jolly_dash_blocks_off', 0); try { dsInject(); } catch (e) {} },
                            hide: function () { dsWrite('jolly_dash_blocks_off', 1); dsOff(); },
                            refresh: function () { try { dsInject(); } catch (e) {} },
                            off: dsOff,
                            pins: function () { return dsRead('jolly_dash_pins', []); },
                            hidden: function () { return dsRead('jolly_dash_hidden', {}); },
                            reset: function () { dsWrite('jolly_dash_hidden', {}); dsPaint(); } };
  global.JollyAddons = {
    status: function () { return { live: addonOn('live'), dash: addonOn('dash'), studio: addonOn('studio') }; },
    on: function (w) { addonSet(w, true); },
    off: function (w) { addonSet(w, false); if (w === 'live') lsClose(); if (w === 'dash') dsOff(); if (w === 'studio') ssOff(); },
    allOff: function () { ['live', 'dash', 'studio'].forEach(function (w) { addonSet(w, false); }); lsClose(); dsOff(); ssOff(); }
  };
  global.JollyLiveSearch = { close: lsClose, rows: function () { return LS.rows; },
                             on: function (hash) { lsSet(hash || String(global.location.hash || ''), true); },
                             off: function (hash) { lsSet(hash || String(global.location.hash || ''), false); } };
  global.JollyStudioSearch = { refresh: function () { try { ssInject(); } catch (e) {} },
                               off: ssOff, active: function () { return SS.on; } };


  /* ======================================================================
     🔎 STUDIO AXTARIŞI  (v4.7)
     studios.js-ə toxunmadan, DOM səviyyəsində: kart şəbəkəsini tapır,
     üstünə axtarış qutusu qoyur, yazdıqca kartları süzür.
     ====================================================================== */

  var SS = { on: false, obs: null, timer: null, q: '' };

  function ssActive() {
    var h = String(global.location.hash || '');
    return /^#\/studios(\/)?$/.test(h) || /^#\/studios\?/.test(h) || /^#\/store/.test(h);
  }

  /* kart şəbəkəsini tap: ən çox "kart görünüşlü" uşağı olan konteyner */
  function ssGrid() {
    var root = document.getElementById('main') || document.body;
    var els = root.querySelectorAll('div,ul,section');
    var best = null, bestN = 0;
    for (var i = 0; i < els.length && i < 600; i++) {
      var el = els[i];
      if (el.id === 'jss-wrap') continue;
      var kids = el.children;
      if (!kids || kids.length < 6) continue;
      var n = 0;
      for (var j = 0; j < kids.length; j++) {
        var k = kids[j];
        var txt = (k.textContent || '').trim();
        if (txt.length > 2 && txt.length < 160 && k.offsetHeight > 26) n++;
      }
      if (n >= 6 && n > bestN) { bestN = n; best = el; }
    }
    return best;
  }

  function ssFilter() {
    var grid = SS.grid;
    if (!grid) return;
    var f = foldTxt(SS.q).trim();
    var shown = 0, total = 0;
    Array.prototype.forEach.call(grid.children, function (k) {
      var txt = (k.textContent || '').trim();
      if (!txt) return;
      total++;
      var hit = !f || foldTxt(txt).indexOf(f) >= 0;
      if (hit) { k.style.display = k.__jssD || ''; shown++; }
      else {
        if (k.__jssD === undefined) k.__jssD = k.style.display || '';
        k.style.display = 'none';
      }
    });
    var c = document.getElementById('jss-count');
    if (c) c.textContent = f ? (shown + ' / ' + total) : (total + ' ekran');
  }

  function ssInject() {
    if (!addonOn('studio')) return ssOff();
    if (!perm('studio.search.use')) return ssOff();
    if (!ssActive()) return ssOff();
    var grid = ssGrid();
    if (!grid) return;
    SS.grid = grid;

    var old = document.getElementById('jss-wrap');
    if (old && old.parentNode === grid.parentNode && old.nextSibling === grid) { ssFilter(); return; }
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.id = 'jss-wrap';
    wrap.innerHTML =
      '<div class="jss-row">' +
        '<input id="jss-input" type="search" inputmode="search" autocomplete="off" ' +
        'placeholder="🔎 Ekran axtar — ad və ya təsvir…">' +
        '<span id="jss-count"></span>' +
      '</div>';
    grid.parentNode.insertBefore(wrap, grid);

    var inp = wrap.querySelector('#jss-input');
    inp.value = SS.q || '';
    inp.addEventListener('input', function () {
      SS.q = inp.value || '';
      if (SS.timer) clearTimeout(SS.timer);
      SS.timer = setTimeout(ssFilter, 90);
    });
    // Studio-nun öz sürükləmə/klik işləyiciləri ilə toqquşmasın
    ['click', 'touchstart', 'pointerdown', 'mousedown'].forEach(function (ev) {
      wrap.addEventListener(ev, function (e) { e.stopPropagation(); }, true);
    });

    ssFilter();
    SS.on = true;
  }

  function ssOff() {
    var old = document.getElementById('jss-wrap');
    if (old) old.remove();
    if (SS.grid) {
      Array.prototype.forEach.call(SS.grid.children, function (k) {
        if (k.__jssD !== undefined) { k.style.display = k.__jssD; delete k.__jssD; }
      });
    }
    SS.grid = null; SS.on = false; SS.q = '';
  }

  var SSCSS = [
    '#jss-wrap{margin:10px 0 12px}',
    '#jss-wrap .jss-row{display:flex;align-items:center;gap:9px}',
    '#jss-wrap input{flex:1;padding:13px 15px;border-radius:14px;font-size:15.5px;color:#e8e8f0;',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);outline:none}',
    '#jss-wrap input:focus{border-color:rgba(245,196,81,.5)}',
    '#jss-wrap #jss-count{font-size:12px;opacity:.6;white-space:nowrap;font-family:ui-monospace,monospace}'
  ].join('');

  function ssStart() {
    if (!document.getElementById('jss-css')) {
      var st = document.createElement('style');
      st.id = 'jss-css'; st.textContent = SSCSS;
      document.head.appendChild(st);
    }

    var retry = null;
    function schedule() {
      if (retry) clearInterval(retry);
      if (!ssActive()) { ssOff(); return; }
      var tries = 0;
      retry = setInterval(function () {
        tries++;
        try { ssInject(); } catch (e) {}
        if (SS.on || tries > 14) clearInterval(retry);
      }, 260);
    }

    global.addEventListener('hashchange', function () { SS.q = ''; schedule(); });
    schedule();

    // ekran yenidən çəkilsə qutunu təkrar qoy
    try {
      var host = document.getElementById('main') || document.body;
      SS.obs = new MutationObserver(function () {
        if (!ssActive()) return;
        if (!document.getElementById('jss-input')) {
          if (SS.timer) clearTimeout(SS.timer);
          SS.timer = setTimeout(function () { try { ssInject(); } catch (e) {} }, 220);
        }
      });
      SS.obs.observe(host, { childList: true, subtree: true });
    } catch (e) {}
  }



  /* ======================================================================
     ⚡ CANLI AXTARIŞ — v5.6: SƏNƏD SƏVİYYƏSİNDƏ
     Əvvəlki versiya ekrandaki axtarış xanasını "tanımağa" çalışırdı və
     Ətraflı Axtarışda tanıya bilmirdi. İndi tanımaq lazım deyil:
     bütün proqram boyu hər 'input' hadisəsi dinlənilir və nəticə
     yazdığın xananın ALTINDA açılır. Heç bir ekranın koduna toxunulmur.
     ====================================================================== */

  var LS = { input: null, panel: null, timer: null, rows: [], q: '' };

  function lsKey() { return 'jolly_live_search_off'; }
  function lsOnFor(hash) {
    try { return !(JSON.parse(localStorage.getItem(lsKey()) || '{}')[hash]); }
    catch (e) { return true; }
  }
  function lsSet(hash, on) {
    try {
      var m = JSON.parse(localStorage.getItem(lsKey()) || '{}');
      if (on) delete m[hash]; else m[hash] = 1;
      localStorage.setItem(lsKey(), JSON.stringify(m));
    } catch (e) {}
  }
  function lsMine(hash) {
    var h = String(hash || '');
    // Öz ekranları + canlı axtarışın mənasız olduğu ekranlar
    return /^#\/(share-inbox|barcode-view|barcode-fix)/.test(h) ||
           /^#\/(studios|product\/|product$|dashboard\/studio|chat|brain|guide|selftest|testdata|perm|user-mode|module-cleanup|jolly-settings|jolly-diag|health|import|sheet|tasks|scan-marathon|photo-session|store-map|receiving|supplier-order|barcode-folder|fixmode|data-doctor|group-health|cloud-doctor|updates|undo)/.test(h);
  }

  function lsOwn(el) {
    if (!el || !el.closest) return false;
    return !!(el.closest('#jds-wrap') || el.closest('#jlk-host') || el.closest('#jbf-host') ||
              el.closest('#jsi-host') || el.closest('#ls-panel') || el.id === 'jss-input');
  }

  function lsEligible(el) {
    if (!addonOn('live')) return false;
    if (!el || el.tagName !== 'INPUT') return false;
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type !== 'text' && type !== 'search') return false;
    if (lsOwn(el)) return false;
    var hash = String(global.location.hash || '');
    if (lsMine(hash) || !lsOnFor(hash)) return false;
    return perm('search.live.use');
  }

  function lsPanelFor(input) {
    var host = input.parentNode;
    if (!host) return null;
    if (LS.panel && LS.input === input && LS.panel.parentNode) return LS.panel;

    if (LS.panel && LS.panel.parentNode) LS.panel.parentNode.removeChild(LS.panel);
    var panel = document.createElement('div');
    panel.id = 'ls-panel';
    panel.className = 'ls-panel';
    panel.addEventListener('click', function (e) {
      var t = e.target;
      var br = t.closest && t.closest('[data-bar]');
      if (br) {
        e.stopPropagation(); e.preventDefault();
        if (LS.q) Search.remember(LS.q);
        return showBarcode(br.getAttribute('data-bar'), br.getAttribute('data-bname') || '');
      }
      var info = t.closest && t.closest('[data-lsinfo]');
      if (info) { e.stopPropagation(); return openPassport(info.getAttribute('data-lsinfo')); }
      if (t.closest && t.closest('[data-lsoff]')) {
        e.stopPropagation();
        lsSet(String(global.location.hash || ''), false);
        lsClose();
        toast('Bu ekranda canlı axtarış söndürüldü');
        return;
      }
      var op = t.closest && t.closest('[data-lsopen]');
      if (op) {
        e.stopPropagation();
        var id = op.getAttribute('data-lsopen'), p = null;
        LS.rows.forEach(function (x) { if (String(x.id) === id) p = x; });
        var c = p ? codeOf(p) : '';
        if (LS.q) Search.remember(LS.q);
        if (c) return showBarcode(c, p.name || '');
        return openPassport(id);
      }
    });

    try {
      if (input.nextSibling) host.insertBefore(panel, input.nextSibling);
      else host.appendChild(panel);
    } catch (e) { return null; }

    LS.panel = panel; LS.input = input;
    return panel;
  }

  function lsRowsHTML() {
    if (!LS.rows.length) return '<div class="ls-empty">Uyğun mal yoxdur</div>';
    var h = ['<div class="ls-head"><span>⚡ ' + LS.rows.length + ' nəticə</span>' +
             '<span class="ls-x" data-lsoff="1">söndür</span></div>'];
    LS.rows.forEach(function (p) {
      var code = codeOf(p);
      h.push('<div class="ls-row">');
      h.push('<div class="ls-m" data-lsopen="' + esc(p.id) + '">');
      h.push('<div class="ls-nm">' + esc(p.name || '(adsız)') + '</div>');
      h.push('<div class="ls-cd">' + (code ? esc(code) : 'kod yoxdur') +
             (p.price ? ' · ' + esc(p.price) + ' ₼' : '') + '</div>');
      h.push(whyLabel(p));
      h.push('</div>');
      if (code) h.push('<div class="ls-b" data-bar="' + esc(code) + '" data-bname="' + esc(p.name || '') + '">📊</div>');
      h.push('<div class="ls-i" data-lsinfo="' + esc(p.id) + '">ⓘ</div>');
      h.push('</div>');
    });
    return h.join('');
  }

  function lsClose() {
    try { if (LS.panel && LS.panel.parentNode) LS.panel.parentNode.removeChild(LS.panel); } catch (e) {}
    LS.panel = null; LS.input = null; LS.rows = [];
  }

  function lsHandle(el) {
    var q = String(el.value || '');
    LS.q = q;
    if (q.trim().length < 2) { lsClose(); return; }
    LS.rows = lsearch(q).slice(0, 12);
    var panel = lsPanelFor(el);
    if (panel) panel.innerHTML = lsRowsHTML();
  }

  var LSCSS = [
    '#ls-panel{margin-top:9px!important;border-radius:15px!important;overflow:hidden!important;',
    'background:rgba(12,14,22,.95)!important;border:1px solid rgba(255,255,255,.12)!important;',
    'display:block!important;width:100%!important;box-sizing:border-box!important;',
    'position:static!important;transform:none!important;text-align:left!important;',
    'font-size:13px!important;color:#e8e8f0!important;z-index:50}',
    '#ls-panel *{box-sizing:border-box!important;text-transform:none!important;',
    'letter-spacing:normal!important;position:static!important;transform:none!important;',
    'width:auto;height:auto!important;aspect-ratio:auto!important;border-radius:0}',
    '#ls-panel .ls-head{display:flex!important;justify-content:space-between;padding:9px 12px;',
    'font-size:11px;opacity:.6}',
    '#ls-panel .ls-x{padding:5px 10px;border-radius:999px!important;cursor:pointer;opacity:1;',
    'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13)}',
    '#ls-panel .ls-row{display:flex!important;align-items:center;gap:8px;padding:10px 12px;',
    'border-top:1px solid rgba(255,255,255,.06)}',
    '#ls-panel .ls-m{flex:1!important;min-width:0;cursor:pointer}',
    '#ls-panel .ls-nm{font-size:13.5px!important;font-weight:600;overflow:hidden;',
    'text-overflow:ellipsis;white-space:nowrap}',
    '#ls-panel .ls-cd{font-family:ui-monospace,monospace;font-size:12.5px!important;color:#f7d98a;margin-top:2px}',
    '#ls-panel .whyx{font-size:11px!important;opacity:.5;margin-top:3px}',
    '#ls-panel .ls-b,#ls-panel .ls-i{flex:none!important;padding:9px 11px;border-radius:10px!important;',
    'cursor:pointer;font-size:13px!important;border:1px solid rgba(255,255,255,.12);',
    'background:rgba(255,255,255,.05)}',
    '#ls-panel .ls-b{border-color:rgba(245,196,81,.45);background:rgba(245,196,81,.14);color:#f7d98a}',
    '#ls-panel .ls-empty{padding:14px 12px;font-size:12.5px;opacity:.5;text-align:center}'
  ].join('');

  function lsStart() {
    if (!document.getElementById('ls-css')) {
      var st = document.createElement('style');
      st.id = 'ls-css'; st.textContent = LSCSS;
      document.head.appendChild(st);
    }
    /* bütün proqram boyu bir dinləyici — ekranların koduna toxunulmur */
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!lsEligible(el)) return;
      if (LS.timer) clearTimeout(LS.timer);
      LS.timer = setTimeout(function () { try { lsHandle(el); } catch (x) {} }, 160);
    }, true);

    global.addEventListener('hashchange', lsClose);
  }

  /* ======================================================================
     🏠 İŞ MASASI TƏNZİMLƏYİCİSİ  (v4.9)
     dashboard.js-ə toxunmadan: axtarış + qısa yollar + panel idarəsi
     ====================================================================== */

  var DS = { grid: null, obs: null, timer: null, rows: [], q: '', open: null, panels: [] };

  /* v5.6: iş masasının ünvanını təxmin etmək əvəzinə Esqin özü bağlayır.
     🩺 paneldə son ziyarət edilən ekranlar siyahısı var; birinə toxunanda
     həmin ünvan `jolly_dash_hash`-ə yazılır və bloklar orada çıxır. */
  var HASHLOG = [];
  function hashRemember() {
    var h = String(global.location.hash || '');
    if (!h) h = '#/';
    if (/^#\/(share-inbox|barcode-view|barcode-fix)/.test(h)) return;
    HASHLOG = HASHLOG.filter(function (x) { return x !== h; });
    HASHLOG.unshift(h);
    HASHLOG = HASHLOG.slice(0, 8);
    try { localStorage.setItem('jolly_hash_log', JSON.stringify(HASHLOG)); } catch (e) {}
  }
  function hashLog() {
    if (HASHLOG.length) return HASHLOG;
    try { HASHLOG = JSON.parse(localStorage.getItem('jolly_hash_log') || '[]') || []; } catch (e) {}
    return HASHLOG;
  }

  function dsActive() {
    var h = String(global.location.hash || '');
    var bound = '';
    try { bound = localStorage.getItem('jolly_dash_hash') || ''; } catch (e) {}
    if (bound) return h === bound || (bound === '#/' && (h === '' || h === '#'));
    return h === '' || h === '#' || h === '#/' || /^#\/(dashboard|home|desk|main|isMasasi)/i.test(h);
  }

  function dsRead(key, def) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || def; } catch (e) { return def; }
  }
  function dsWrite(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function dsGrid() {
    var root = document.getElementById('main') || document.body;
    var els = root.querySelectorAll('div,section,main');
    var best = null, bestN = 0;
    for (var i = 0; i < els.length && i < 600; i++) {
      var el = els[i];
      if (el.id === 'jds-wrap' || (el.closest && el.closest('#jds-wrap'))) continue;
      var kids = el.children;
      if (!kids || kids.length < 3) continue;
      var n = 0;
      for (var j = 0; j < kids.length; j++) {
        var k = kids[j];
        if (k.id === 'jds-wrap') continue;
        var txt = (k.textContent || '').trim();
        if (txt.length > 4 && k.offsetHeight > 40) n++;
      }
      if (n >= 3 && n > bestN) { bestN = n; best = el; }
    }
    return best;
  }

  /* panelin sabit açarı — başlıq mətnindən */
  function dsKey(el) {
    var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return foldTxt(txt).slice(0, 36) || 'panel';
  }

  function dsScanPanels() {
    var g = DS.grid;
    DS.panels = [];
    if (!g) return;
    var seen = {};
    Array.prototype.forEach.call(g.children, function (k) {
      if (k.id === 'jds-wrap') return;
      var txt = (k.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt || k.offsetHeight < 30) return;
      var key = dsKey(k);
      seen[key] = (seen[key] || 0) + 1;
      DS.panels.push({ key: key, el: k, label: txt.slice(0, 34), dup: seen[key] });
    });
    DS.panels.forEach(function (p) {
      p.count = DS.panels.filter(function (x) { return x.key === p.key; }).length;
    });
  }

  function dsApplyHidden() {
    if (!perm('dash.panels.hide')) return;
    var hid = dsRead('jolly_dash_hidden', {});
    DS.panels.forEach(function (p) {
      var id = p.key + (p.count > 1 ? '#' + p.dup : '');
      if (hid[id]) {
        if (p.el.__dsD === undefined) p.el.__dsD = p.el.style.display || '';
        p.el.style.display = 'none';
      } else if (p.el.__dsD !== undefined) {
        p.el.style.display = p.el.__dsD;
      }
    });
  }

  function dsModules() {
    var MR = lex('ModuleRegistry');
    if (!MR) return [];
    var list = [];
    try {
      if (typeof MR._all === 'function') list = MR._all() || [];
      else if (typeof MR.list === 'function') list = MR.list() || [];
    } catch (e) {}
    return list.filter(function (m) { return m && m.route; });
  }

  /* ---- axtarış ---- */
  function dsSearchHTML() {
    var h = ['<div class="jds-sec">'];
    h.push('<div class="jds-qrow">');
    h.push('<input id="jds-q" type="search" inputmode="search" autocomplete="off" placeholder="🔎 Mal axtar — ad və ya kod…">');
    h.push('<div class="jds-mic" data-dsmic="1">🎤</div>');
    h.push('</div>');
    var rec = Search.recent();
    if (rec.length && (!DS.q || DS.q.length < 2)) {
      h.push('<div class="jds-rec">');
      rec.slice(0, 6).forEach(function (t) {
        h.push('<span class="rc" data-dsrec="' + esc(t) + '">' + esc(t) + '</span>');
      });
      h.push('</div>');
    }
    h.push('<div id="jds-res"></div></div>');
    return h.join('');
  }

  function dsResHTML() {
    if (!DS.q || DS.q.trim().length < 2) return '';
    if (!DS.rows.length) return '<div class="jds-empty">Uyğun mal yoxdur</div>';
    var h = ['<div class="jds-list">'];
    DS.rows.forEach(function (p) {
      var code = codeOf(p);
      h.push('<div class="jds-row">');
      h.push('<div class="jds-m" data-dsopen="' + esc(p.id) + '">');
      h.push('<div class="jds-nm">' + esc(p.name || '(adsız)') + '</div>');
      h.push('<div class="jds-cd">' + (code ? esc(code) : 'kod yoxdur') +
             (p.price ? ' · ' + esc(p.price) + ' ₼' : '') + '</div>');
      h.push(whyLabel(p));
      h.push('</div>');
      if (code) h.push('<div class="jds-b" data-bar="' + esc(code) + '" data-bname="' + esc(p.name || '') + '">📊</div>');
      h.push('<div class="jds-i" data-dsinfo="' + esc(p.id) + '">ⓘ</div>');
      h.push('</div>');
    });
    h.push('</div>');
    return h.join('');
  }

  /* ---- qısa yollar ---- */
  function dsPinsHTML() {
    var pins = dsRead('jolly_dash_pins', []);
    var mods = dsModules();
    var h = ['<div class="jds-sec">'];
    h.push('<div class="jds-h"><span>📌 Qısa yollar</span>' +
           '<span class="jds-x" data-dstab="pins">' + (DS.open === 'pins' ? 'bitir' : 'seç') + '</span></div>');

    if (pins.length) {
      h.push('<div class="jds-pins">');
      pins.forEach(function (r) {
        var m = mods.filter(function (x) { return x.route === r; })[0];
        h.push('<div class="jds-pin" data-dsgo="' + esc(r) + '">' +
               '<span class="ic">' + esc((m && m.icon) || '▪️') + '</span>' +
               '<span>' + esc((m && m.name) || r) + '</span></div>');
      });
      h.push('</div>');
    } else if (DS.open !== 'pins') {
      h.push('<div class="jds-empty">Hələ qısa yol yoxdur — “seç” ilə istədiyin ekranları bura sanc.</div>');
    }

    if (DS.open === 'pins') {
      h.push('<div class="jds-picker">');
      if (!mods.length) h.push('<div class="jds-empty">Modul siyahısı oxunmadı.</div>');
      mods.forEach(function (m) {
        var on = pins.indexOf(m.route) >= 0;
        h.push('<div class="jds-p' + (on ? ' on' : '') + '" data-dspin="' + esc(m.route) + '">' +
               esc(m.icon || '▪️') + ' ' + esc(m.name || m.route) + (on ? ' ✓' : '') + '</div>');
      });
      h.push('</div>');
    }
    h.push('</div>');
    return h.join('');
  }

  /* ---- panel idarəsi ---- */
  function dsPanelsHTML() {
    var h = ['<div class="jds-sec">'];
    h.push('<div class="jds-h"><span>⚙️ Panellər</span>' +
           '<span class="jds-x" data-dstab="panels">' + (DS.open === 'panels' ? 'bitir' : 'aç') + '</span></div>');
    if (DS.open === 'panels') {
      var hid = dsRead('jolly_dash_hidden', {});
      if (!DS.panels.length) h.push('<div class="jds-empty">Panel tapılmadı.</div>');
      DS.panels.forEach(function (p) {
        var id = p.key + (p.count > 1 ? '#' + p.dup : '');
        var off = !!hid[id];
        h.push('<div class="jds-pr' + (off ? ' off' : '') + '" data-dstog="' + esc(id) + '">' +
               '<span class="e">' + (off ? '🚫' : '👁') + '</span>' +
               '<span class="l">' + esc(p.label) + '</span>' +
               (p.count > 1 ? '<span class="d">' + p.count + ' dəfə görünür</span>' : '') +
               '</div>');
      });
      var n = Object.keys(hid).length;
      if (n) h.push('<div class="jds-all" data-dsreset="1">↩ Hamısını yandır (' + n + ' söndürülüb)</div>');
    }
    h.push('</div>');
    return h.join('');
  }


  /* ---------------- v5.4 · İŞ MASASI BLOKLARI (widget) ----------------
     Esqin: "modul qısa yolu yox — proqramın öz hissələrini iş masasına
     əlavə edim, məsələn canlı axtarışı; hamısını söndürüb-yandıra bilim".
     Hər blok ayrıca açılıb-bağlanır və sırası dəyişir.
     Yaddaş: jolly_dash_widgets = {order:[...], off:{id:1}}
     -------------------------------------------------------------------- */

  function dsCfg() {
    var c = dsRead('jolly_dash_widgets', null);
    if (!c || !c.order) c = { order: ['search', 'pins', 'panels'], off: {} };
    return c;
  }
  function dsCfgSave(c) { dsWrite('jolly_dash_widgets', c); }

  function dsCameraHTML() {
    var h = ['<div class="jds-sec">'];
    h.push('<div class="jds-h"><span>📷 Kamera ilə tap</span></div>');
    h.push('<div class="jds-cam" data-dscam="1">📷 Malı çək → tap → barkod</div>');
    h.push('</div>');
    return h.join('');
  }

  function dsCoverageHTML() {
    var c;
    try { c = codeCoverage(); } catch (e) { return ''; }
    var scan = c.ean13 + c.twelve + c.ean8;
    var pct = Math.round(scan / (c.total || 1) * 100);
    var h = ['<div class="jds-sec">'];
    h.push('<div class="jds-h"><span>🏷 Barkod örtüyü</span></div>');
    h.push('<div class="jds-cov" data-dsgo="#/barcode-fix">');
    h.push('<div class="big">' + scan + ' / ' + c.total + ' <span>· ' + pct + '%</span></div>');
    h.push('<div class="sm">kassada skanerlə vurula bilər' +
           (c.noCode ? ' · <b>' + c.noCode + '</b> kodsuz' : '') +
           (c.badCheck ? ' · <b>' + c.badCheck + '</b> səhv çek rəqəmi' : '') + '</div>');
    h.push('<div class="sm">🔧 düzəltmək üçün toxun</div>');
    h.push('</div></div>');
    return h.join('');
  }

  function dsQueueHTML() {
    var h = ['<div class="jds-sec">'];
    h.push('<div class="jds-h"><span>🧾 Kassa növbəsi</span></div>');
    if (!L.queue.length) {
      h.push('<div class="jds-empty">Növbə boşdur — Kassa Barkodu ekranında ➕ ilə mal yığ.</div>');
    } else {
      h.push('<div class="jds-cov" data-dsqstart="1"><div class="big">' + L.queue.length + ' mal</div>' +
             '<div class="sm">▶ ardıcıl barkod göstərməyə başla</div></div>');
    }
    h.push('</div>');
    return h.join('');
  }

  function dsRecentHTML() {
    var rec = Search.recent();
    if (!rec.length) return '';
    var h = ['<div class="jds-sec"><div class="jds-h"><span>🕒 Son axtarışlar</span></div><div class="jds-rec">'];
    rec.forEach(function (t) { h.push('<span class="rc" data-dsrec="' + esc(t) + '">' + esc(t) + '</span>'); });
    h.push('</div></div>');
    return h.join('');
  }

  function dsWidgets() {
    return [
      { id: 'search',   name: '🔎 Canlı axtarış',   fn: dsSearchHTML },
      { id: 'camera',   name: '📷 Kamera ilə tap',  fn: dsCameraHTML },
      { id: 'recent',   name: '🕒 Son axtarışlar',  fn: dsRecentHTML },
      { id: 'pins',     name: '📌 Qısa yollar',     fn: dsPinsHTML },
      { id: 'coverage', name: '🏷 Barkod örtüyü',   fn: dsCoverageHTML },
      { id: 'queue',    name: '🧾 Kassa növbəsi',   fn: dsQueueHTML },
      { id: 'panels',   name: '⚙️ Panel idarəsi',   fn: dsPanelsHTML }
    ];
  }

  function dsBuilderHTML() {
    var c = dsCfg(), all = dsWidgets();
    var h = ['<div class="jds-sec">'];
    h.push('<div class="jds-h"><span>🧩 İş masasını yığ</span>' +
           '<span class="jds-x" data-dstab="build">' + (DS.open === 'build' ? 'bitir' : 'aç') + '</span></div>');
    if (DS.open === 'build') {
      var order = c.order.slice();
      all.forEach(function (w) { if (order.indexOf(w.id) < 0) order.push(w.id); });
      order.forEach(function (id, i) {
        var w = all.filter(function (x) { return x.id === id; })[0];
        if (!w) return;
        var off = !!c.off[id];
        h.push('<div class="jds-wrow' + (off ? ' off' : '') + '">');
        h.push('<span class="e" data-dswtog="' + esc(id) + '">' + (off ? '🚫' : '✅') + '</span>');
        h.push('<span class="l">' + esc(w.name) + '</span>');
        h.push('<span class="u" data-dswup="' + esc(id) + '">↑</span>');
        h.push('<span class="u" data-dswdn="' + esc(id) + '">↓</span>');
        h.push('</div>');
      });
      h.push('<div class="jds-all" data-dswreset="1">↩ Standart görünüşə qaytar</div>');
    }
    h.push('</div>');
    return h.join('');
  }

  function dsPaint() {
    var wrap = document.getElementById('jds-wrap');
    if (!wrap) return;
    var q = document.getElementById('jds-q');
    var val = q ? q.value : DS.q;
    var cfg = dsCfg(), all = dsWidgets(), html = '';
    var order = cfg.order.slice();
    all.forEach(function (w) { if (order.indexOf(w.id) < 0) order.push(w.id); });
    order.forEach(function (id) {
      if (cfg.off[id]) return;
      var w = all.filter(function (x) { return x.id === id; })[0];
      if (!w) return;
      try { html += w.fn(); } catch (e) {}
    });
    wrap.innerHTML =
      '<div class="jds-top"><span>🏠 JOLLY blokları</span>' +
      '<span class="jds-off" data-dshideall="1">✕ gizlət</span></div>' +
      html + dsBuilderHTML();
    var q2 = document.getElementById('jds-q');
    if (q2) q2.value = val || '';
    var res = document.getElementById('jds-res');
    if (res) res.innerHTML = dsResHTML();
    dsApplyHidden();
  }

  function dsPaintRes() {
    var res = document.getElementById('jds-res');
    if (res) res.innerHTML = dsResHTML();
  }

  function dsInject() {
    if (!addonOn('dash')) return dsOff();
    if (!perm('dash.builder.use')) return dsOff();
    if (dsRead('jolly_dash_blocks_off', 0)) return dsOff();
    if (!dsActive()) return dsOff();
    var grid = dsGrid();
    if (!grid) return;
    DS.grid = grid;
    dsScanPanels();

    var wrap = document.getElementById('jds-wrap');
    if (!wrap) {
      /* v5.5 DÜZƏLİŞ: əvvəl blok tapılan kart şəbəkəsinin İÇİNƏ
         qoyulurdu — o şəbəkə üfüqi sürüşən kart lenti olanda bloklar
         dairəyə düşüb yekəlirdi (Esqinin ekran şəkli). İndi blok
         səhifənin ƏN BAŞINA, əsas konteynerə qoyulur, yəni heç bir
         kart stilini miras almır. Kart şəbəkəsi yalnız panelləri
         gizlətmək üçün istifadə olunur. */
      var host = document.getElementById('main') ||
                 document.querySelector('#content,.content,.app-content,main') ||
                 document.body;
      wrap = document.createElement('div');
      wrap.id = 'jds-wrap';
      if (host.firstChild) host.insertBefore(wrap, host.firstChild); else host.appendChild(wrap);

      wrap.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'jds-q') return;
        DS.q = e.target.value || '';
        if (DS.timer) clearTimeout(DS.timer);
        DS.timer = setTimeout(function () {
          DS.rows = (DS.q.trim().length >= 2) ? lsearch(DS.q).slice(0, 12) : [];
          dsPaintRes();
        }, 170);
      });

      wrap.addEventListener('click', function (e) {
        var t = e.target;
        var br = t.closest && t.closest('[data-bar]');
        if (br) { e.stopPropagation(); return showBarcode(br.getAttribute('data-bar'), br.getAttribute('data-bname') || ''); }
        var inf = t.closest && t.closest('[data-dsinfo]');
        if (inf) { e.stopPropagation(); return openPassport(inf.getAttribute('data-dsinfo')); }
        var op = t.closest && t.closest('[data-dsopen]');
        if (op) {
          e.stopPropagation();
          if (DS.q) Search.remember(DS.q);
          var id = op.getAttribute('data-dsopen'), p = null;
          DS.rows.forEach(function (x) { if (String(x.id) === id) p = x; });
          var c = p ? codeOf(p) : '';
          if (c) return showBarcode(c, p.name || '');
          return openPassport(id);
        }
        if (t.closest && t.closest('[data-dsmic]')) {
          e.stopPropagation();
          return voiceSearch(function (txt) {
            DS.q = txt; DS.rows = lsearch(txt).slice(0, 12); Search.remember(txt); dsPaint();
          });
        }
        var drc = t.closest && t.closest('[data-dsrec]');
        if (drc) {
          e.stopPropagation();
          DS.q = drc.getAttribute('data-dsrec');
          DS.rows = lsearch(DS.q).slice(0, 12);
          dsPaint(); return;
        }
        if (t.closest && t.closest('[data-dshideall]')) {
          e.stopPropagation();
          dsWrite('jolly_dash_blocks_off', 1);
          dsOff();
          toast('Bloklar gizləndi — Alətlər → Kassa Barkodu → 🩺 paneldən geri qaytarmaq olar');
          return;
        }
        if (t.closest && t.closest('[data-dscam]')) {
          e.stopPropagation();
          DS.wantCam = true;
          global.location.hash = '#/barcode-view';
          return;
        }
        if (t.closest && t.closest('[data-dsqstart]')) { e.stopPropagation(); return lqueueStart(); }
        var wt = t.closest && t.closest('[data-dswtog]');
        if (wt) {
          e.stopPropagation();
          var cfg1 = dsCfg(), wid = wt.getAttribute('data-dswtog');
          if (cfg1.off[wid]) delete cfg1.off[wid]; else cfg1.off[wid] = 1;
          dsCfgSave(cfg1); dsPaint(); return;
        }
        var wu = t.closest && t.closest('[data-dswup]');
        var wd = t.closest && t.closest('[data-dswdn]');
        if (wu || wd) {
          e.stopPropagation();
          var cfg2 = dsCfg(), all2 = dsWidgets();
          var ord = cfg2.order.slice();
          all2.forEach(function (x) { if (ord.indexOf(x.id) < 0) ord.push(x.id); });
          var wid2 = (wu || wd).getAttribute(wu ? 'data-dswup' : 'data-dswdn');
          var ix = ord.indexOf(wid2);
          var to = wu ? ix - 1 : ix + 1;
          if (ix >= 0 && to >= 0 && to < ord.length) {
            ord.splice(to, 0, ord.splice(ix, 1)[0]);
            cfg2.order = ord; dsCfgSave(cfg2); dsPaint();
          }
          return;
        }
        if (t.closest && t.closest('[data-dswreset]')) {
          e.stopPropagation();
          dsCfgSave({ order: ['search', 'pins', 'panels'], off: {} });
          dsPaint(); return;
        }
        var tab = t.closest && t.closest('[data-dstab]');
        if (tab) {
          e.stopPropagation();
          var which = tab.getAttribute('data-dstab');
          DS.open = (DS.open === which) ? null : which;
          if (DS.open === 'panels') dsScanPanels();
          dsPaint(); return;
        }
        var go = t.closest && t.closest('[data-dsgo]');
        if (go) { e.stopPropagation(); global.location.hash = go.getAttribute('data-dsgo'); return; }
        var pin = t.closest && t.closest('[data-dspin]');
        if (pin) {
          e.stopPropagation();
          var r = pin.getAttribute('data-dspin');
          var pins = dsRead('jolly_dash_pins', []);
          var i = pins.indexOf(r);
          if (i >= 0) pins.splice(i, 1); else pins.push(r);
          dsWrite('jolly_dash_pins', pins);
          dsPaint(); return;
        }
        var tg = t.closest && t.closest('[data-dstog]');
        if (tg) {
          e.stopPropagation();
          var key = tg.getAttribute('data-dstog');
          var hid = dsRead('jolly_dash_hidden', {});
          if (hid[key]) delete hid[key]; else hid[key] = 1;
          dsWrite('jolly_dash_hidden', hid);
          dsPaint(); return;
        }
        if (t.closest && t.closest('[data-dsreset]')) {
          e.stopPropagation();
          dsWrite('jolly_dash_hidden', {});
          dsPaint(); return;
        }
      });
    }

    dsPaint();
  }

  function dsOff() {
    var w = document.getElementById('jds-wrap');
    if (w) w.remove();
    if (DS.panels && DS.panels.length) {
      DS.panels.forEach(function (p) {
        if (p.el && p.el.__dsD !== undefined) { p.el.style.display = p.el.__dsD; delete p.el.__dsD; }
      });
    }
    DS.grid = null; DS.panels = []; DS.open = null;
  }

  var DSCSS = [
    /* TƏCRİD: iş masasının öz CSS-i bu blokların içinə keçməsin */
    '#jds-wrap{display:block!important;width:100%!important;max-width:720px;margin:0 auto 14px!important;',
    'padding:12px!important;box-sizing:border-box!important;text-align:left!important;',
    'float:none!important;position:static!important;transform:none!important;',
    'font-size:14px!important;line-height:1.45!important;color:#e8e8f0}',
    '#jds-wrap *{box-sizing:border-box!important;text-transform:none!important;',
    'letter-spacing:normal!important;font-family:inherit!important;float:none!important;',
    'position:static!important;transform:none!important;max-width:none!important;',
    'min-width:0!important;width:auto;height:auto!important;aspect-ratio:auto!important}',
    '#jds-wrap input{width:100%!important;font-size:15.5px!important;border-radius:14px!important}',
    '#jds-wrap .jds-sec{display:block!important;margin-bottom:11px}',
    '#jds-wrap .jds-sec{margin-bottom:11px}',
    '#jds-wrap input{width:100%;padding:13px 15px;border-radius:14px;font-size:15.5px;color:#e8e8f0;',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);outline:none}',
    '#jds-wrap input:focus{border-color:rgba(245,196,81,.5)}',
    '#jds-wrap .jds-top{display:flex!important;justify-content:space-between;align-items:center;',
    'font-size:11px;opacity:.5;letter-spacing:.7px;text-transform:uppercase!important;margin-bottom:10px}',
    '#jds-wrap .jds-off{padding:6px 11px;border-radius:999px;cursor:pointer;opacity:1;',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.13)}',
    '#jds-wrap .jds-qrow{display:flex!important;gap:8px;align-items:center}',
    '#jds-wrap .jds-mic{flex:none;padding:13px 15px;border-radius:14px;cursor:pointer;font-size:15px;',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14)}',
    '#jds-wrap .whyx{font-size:11px;opacity:.5;margin-top:3px}',
    '#jds-wrap .jds-rec{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}',
    '#jds-wrap .jds-rec .rc{padding:7px 12px;border-radius:999px;font-size:12px;cursor:pointer;',
    'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11)}',
    '#jds-wrap .jds-h{display:flex;justify-content:space-between;align-items:center;font-size:12px;',
    'opacity:.7;margin-bottom:7px;letter-spacing:.4px}',
    '#jds-wrap .jds-x{padding:6px 12px;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;',
    'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);opacity:1}',
    '#jds-wrap .jds-empty{font-size:12px;opacity:.5;padding:9px 2px;line-height:1.5}',
    '#jds-wrap .jds-list{margin-top:9px;border-radius:14px;overflow:hidden;',
    'background:rgba(12,14,22,.8);border:1px solid rgba(255,255,255,.1)}',
    '#jds-wrap .jds-row{display:flex;align-items:center;gap:8px;padding:10px 12px;',
    'border-top:1px solid rgba(255,255,255,.06)}',
    '#jds-wrap .jds-m{flex:1;min-width:0;cursor:pointer}',
    '#jds-wrap .jds-nm{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#jds-wrap .jds-cd{font-family:ui-monospace,monospace;font-size:12.5px;color:#f7d98a;margin-top:2px}',
    '#jds-wrap .jds-b,#jds-wrap .jds-i{flex:none;padding:9px 11px;border-radius:10px;cursor:pointer;font-size:13px;',
    'border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}',
    '#jds-wrap .jds-b{border-color:rgba(245,196,81,.45);background:rgba(245,196,81,.14);color:#f7d98a}',
    '#jds-wrap .jds-pins{display:flex;flex-wrap:wrap;gap:8px}',
    '#jds-wrap .jds-pin{display:flex;align-items:center;gap:7px;padding:11px 13px;border-radius:13px;',
    'cursor:pointer;font-size:13px;font-weight:600;background:rgba(255,255,255,.05);',
    'border:1px solid rgba(255,255,255,.12)}',
    '#jds-wrap .jds-pin .ic{font-size:15px}',
    '#jds-wrap .jds-picker{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px;max-height:280px;overflow:auto;',
    'padding:10px;border-radius:13px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}',
    '#jds-wrap .jds-p{padding:8px 11px;border-radius:999px;font-size:12px;cursor:pointer;',
    'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11)}',
    '#jds-wrap .jds-p.on{border-color:rgba(245,196,81,.5);background:rgba(245,196,81,.14);color:#f7d98a}',
    '#jds-wrap .jds-pr{display:flex;align-items:center;gap:9px;padding:11px;margin-bottom:7px;border-radius:12px;',
    'cursor:pointer;font-size:12.5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}',
    '#jds-wrap .jds-pr.off{opacity:.5}',
    '#jds-wrap .jds-pr .l{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#jds-wrap .jds-pr .d{font-size:10.5px;color:#ffbcbc;white-space:nowrap}',
    '#jds-wrap .jds-cam{padding:14px;border-radius:14px;text-align:center;font-size:14px;font-weight:700;',
    'cursor:pointer;border:1px solid rgba(120,180,255,.35);background:rgba(120,180,255,.12);color:#bcd8ff}',
    '#jds-wrap .jds-cov{padding:13px;border-radius:14px;cursor:pointer;',
    'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}',
    '#jds-wrap .jds-cov .big{font-size:19px;font-weight:800;color:#f7d98a;font-family:ui-monospace,monospace}',
    '#jds-wrap .jds-cov .big span{font-size:13px;opacity:.7}',
    '#jds-wrap .jds-cov .sm{font-size:11.5px;opacity:.65;margin-top:4px;line-height:1.5}',
    '#jds-wrap .jds-wrow{display:flex;align-items:center;gap:9px;padding:10px;margin-bottom:6px;',
    'border-radius:12px;font-size:12.5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}',
    '#jds-wrap .jds-wrow.off{opacity:.5}',
    '#jds-wrap .jds-wrow .l{flex:1;min-width:0}',
    '#jds-wrap .jds-wrow .e,#jds-wrap .jds-wrow .u{padding:6px 9px;border-radius:9px;cursor:pointer;',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.11)}',
    '#jds-wrap .jds-all{margin-top:6px;padding:11px;border-radius:12px;text-align:center;font-size:12.5px;',
    'font-weight:700;cursor:pointer;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}'
  ].join('');

  function dsStart() {
    if (!document.getElementById('jds-css')) {
      var st = document.createElement('style');
      st.id = 'jds-css'; st.textContent = DSCSS;
      document.head.appendChild(st);
    }
    var tries = null;
    function schedule() {
      if (tries) clearInterval(tries);
      if (!dsActive()) { dsOff(); return; }
      var n = 0;
      tries = setInterval(function () {
        n++;
        try { dsInject(); } catch (e) {}
        if (document.getElementById('jds-wrap') || n > 14) clearInterval(tries);
      }, 280);
    }
    hashRemember();
    global.addEventListener('hashchange', function () { hashRemember(); dsOff(); schedule(); });
    schedule();
    try {
      var host = document.getElementById('main') || document.body;
      DS.obs = new MutationObserver(function () {
        if (!dsActive()) return;
        if (!document.getElementById('jds-wrap')) {
          if (DS.timer) clearTimeout(DS.timer);
          DS.timer = setTimeout(function () { try { dsInject(); } catch (e) {} }, 240);
        } else { try { dsApplyHidden(); } catch (e) {} }
      });
      DS.obs.observe(host, { childList: true, subtree: true });
    } catch (e) {}
  }


  /* ======================================================================
     🔍 QLOBAL AXTARIŞ MÜHƏRRİKİ — window.JollySearch   (v5.0)
     Bütün ekranlar bu mühərrikdən istifadə edir.
     ====================================================================== */

  var SE = { idx: null, at: 0, sig: '' };

  function seLists() {
    return {
      jolly_groups: dsRead('jolly_groups', []),
      jolly_brands: dsRead('jolly_brands', []),
      jolly_locations: dsRead('jolly_locations', []),
      jolly_statuses: dsRead('jolly_statuses', []),
      jolly_suppliers: dsRead('jolly_suppliers', [])
    };
  }

  function seName(lists, storeKey, val) {
    if (val === null || val === undefined || val === '') return '';
    var v = String(val), arr = lists[storeKey] || [];
    for (var i = 0; i < arr.length; i++) {
      var x = arr[i];
      if (x && (String(x.id) === v || String(x.name) === v)) return x.name || x.title || v;
    }
    return v;
  }

  /* səhv yazıya dözümlü oxşarlıq: 0..1 */
  function seLev(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    if (Math.abs(a.length - b.length) > 4) return 0;
    var m = a.length, n = b.length, prev = [], cur = [], prev2 = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        // hərf yerdəyişməsi: "tset" → "test" bir səhv sayılsın
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && prev2[j - 2] !== undefined) {
          cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
        }
      }
      for (j = 0; j <= n; j++) { prev2[j] = prev[j]; prev[j] = cur[j]; }
    }
    return 1 - prev[n] / Math.max(m, n);
  }

  /* "sbra" → "sobranie": hərflər ardıcıl gəlirmi */
  function seSubseq(short, long) {
    if (!short || short.length < 3) return false;
    var i = 0;
    for (var j = 0; j < long.length && i < short.length; j++) {
      if (long[j] === short[i]) i++;
    }
    return i === short.length;
  }

  function seBuild() {
    var list = allProducts();
    var sig = list.length + ':' + (list[0] ? list[0].id : '') + ':' + (list[list.length - 1] ? list[list.length - 1].id : '');
    if (SE.idx && SE.sig === sig && (Date.now() - SE.at) < 4000) return SE.idx;

    var lists = seLists();
    /* v6.2 (Esqinin qaydası) — sahələr AYRI-AYRI saxlanılır ki, sorğunun
       uzunluğuna görə hansı sahələrdə axtarılacağı dəqiq idarə olunsun:
         2 hərf → yalnız ad + kod
         3 hərf → + marka, model
         4+     → + qeyd, təsvir və qalan sahələr                     */
    SE.idx = list.map(function (p) {
      var codes = allCodes(p).map(function (c) { return String(c).replace(/\s+/g, ''); });
      var brand = [p.brand, p.firma, p.company, seName(lists, 'jolly_brands', p.brandId)]
                    .filter(Boolean).join(' ');
      var model = [p.model, p.modelNo].filter(Boolean).join(' ');
      var extra = [
        p.note, p.notes, p.qeyd, p.description, p.color, p.reng, p.tags,
        seName(lists, 'jolly_groups', p.group || p.groupId || p.category),
        seName(lists, 'jolly_locations', p.location || p.locationId || p.yer),
        seName(lists, 'jolly_statuses', p.status || p.statusId),
        seName(lists, 'jolly_suppliers', p.supplier || p.supplierId)
      ].filter(function (v) { return v !== null && v !== undefined && v !== ''; })
       .map(function (v) { return Array.isArray(v) ? v.join(' ') : String(v); }).join(' ');

      return {
        p: p,
        name: foldTxt(p.name || ''),
        brand: foldTxt(brand),
        model: foldTxt(model),
        extra: foldTxt(extra),
        codes: codes,
        digits: codes.join(' ')
      };
    });
    SE.sig = sig; SE.at = Date.now();
    return SE.idx;
  }

  /* BAL CƏDVƏLİ (Esqinin təyin etdiyi):
       ad tam uyğun        100
       kod tam uyğun        95
       ad başlanğıcı        90
       kodun içində         85
       adın içində          75
       marka / model        60   (3 hərfdən sonra)
       digər sahələr    max 40   (4 hərfdən sonra)
       səhv yazı        max 35
     Beləliklə qeydində "siqaret" olan Corab heç vaxt adı "Siqaret..."
     olan malı keçə bilmir. */
  function seScoreOne(rec, q, qd, words, tier) {
    var best = 0, why = '';

    // 1) KOD — bütün mərhələlərdə
    if (qd.length >= 2) {
      for (var i = 0; i < rec.codes.length; i++) {
        var c = rec.codes[i];
        if (c === qd) return { s: 95, why: 'kod tam uyğun' };
        if (c.indexOf(qd) === 0 && best < 92) { best = 92; why = 'kod başlanğıcı'; }
        else if (c.indexOf(qd) > 0 && best < 85) { best = 85; why = 'kodun içində'; }
      }
    }

    // 2) AD — bütün mərhələlərdə
    if (q) {
      if (rec.name === q) return { s: 100, why: 'ad tam uyğun' };
      if (rec.name.indexOf(q) === 0 && best < 90) { best = 90; why = 'ad başlanğıcı'; }
      else if (rec.name.indexOf(q) > 0 && best < 75) { best = 75; why = 'adın içində'; }
      else if (words.length > 1 && best < 70 &&
               words.every(function (w) { return rec.name.indexOf(w) >= 0; })) {
        best = 70; why = words.length + ' söz adda';
      }
    }

    // 3) MARKA / MODEL — 3 hərfdən sonra
    if (tier >= 3 && q && best < 60) {
      if (rec.brand.indexOf(q) >= 0) { best = 60; why = 'marka'; }
      else if (rec.model.indexOf(q) >= 0) { best = 58; why = 'model'; }
    }

    // 4) QEYD və digər mətn sahələri — yalnız 4 hərfdən sonra, maksimum 40
    if (tier >= 4 && q && best < 40) {
      if (rec.extra.indexOf(q) >= 0) { best = 40; why = 'qeyd / digər sahə'; }
      else if (words.length > 1 &&
               words.every(function (w) { return (rec.extra + ' ' + rec.name).indexOf(w) >= 0; })) {
        best = 36; why = 'sözlər müxtəlif sahələrdə';
      }
    }

    // 5) SƏHV YAZI — yalnız 4 hərfdən sonra, ən aşağı çəki
    if (tier >= 4 && best < 35 && q.length >= 4) {
      var parts = rec.name.split(/\s+/).slice(0, 4);
      for (var k = 0; k < parts.length; k++) {
        var sim = seLev(q, parts[k]);
        if (sim >= 0.72) {
          var v = Math.round(20 + sim * 15);
          if (v > best) { best = v; why = 'səhv yazı (' + Math.round(sim * 100) + '%)'; }
        } else if (seSubseq(q, parts[k]) && best < 28) { best = 28; why = 'qısaldılmış yazı'; }
      }
    }

    return best ? { s: best, why: why } : null;
  }

  var Search = {
    version: '6.3.0',

    query: function (text, opts) {
      opts = opts || {};
      var limit = opts.limit || 30;
      var q = foldTxt(String(text || '')).trim();
      if (q.length < (opts.min || 2)) return [];      // 0-1 hərf → heç nə
      var qd = q.replace(/\D/g, '');
      var words = q.split(/\s+/).filter(function (w) { return w.length > 1; });

      /* MƏRHƏLƏ: 2 → ad+kod · 3 → +marka/model · 4+ → +qeyd və digərləri */
      var tier = q.length >= 4 ? 4 : (q.length === 3 ? 3 : 2);

      var out = [];
      seBuild().forEach(function (rec) {
        var r = seScoreOne(rec, q, qd, words, tier);
        if (r) out.push({ product: rec.p, score: r.s, why: r.why });
      });
      out.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.product.name || '').localeCompare(String(b.product.name || ''));
      });

      return out.slice(0, limit);
    },

    products: function (text, opts) {
      return Search.query(text, opts).map(function (r) { return r.product; });
    },

    recent: function () { return dsRead('jolly_search_recent', []); },

    remember: function (text) {
      var t = String(text || '').trim();
      if (t.length < 2) return;
      var r = dsRead('jolly_search_recent', []).filter(function (x) { return x !== t; });
      r.unshift(t);
      dsWrite('jolly_search_recent', r.slice(0, 8));
    },

    forget: function () { dsWrite('jolly_search_recent', []); },
    rebuild: function () { SE.idx = null; return seBuild().length; },
    size: function () { return seBuild().length; }
  };

  global.JollySearch = Search;

  /* 🎤 səslə axtarış — brauzer dəstəkləyirsə */
  function voiceSearch(cb) {
    if (!perm('search.voice.use')) { toast('Səslə axtarış üçün icazəniz yoxdur', 'error'); return; }
    var R = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!R) { toast('Bu brauzerdə səslə axtarış yoxdur', 'error'); return; }
    try {
      var r = new R();
      r.lang = 'az-AZ';
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = function (e) {
        var txt = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '';
        if (txt) cb(txt);
      };
      r.onerror = function (ev) {
        if (ev && ev.error === 'language-not-supported') {
          try { r.lang = 'tr-TR'; r.start(); return; } catch (e) {}
        }
        toast('Səs oxunmadı', 'error');
      };
      r.start();
      toast('🎤 Danış…');
    } catch (e) { toast('Səslə axtarış açılmadı', 'error'); }
  }


  /* ======================================================================
     🔎 ÜZƏN AXTARIŞ  (v5.6)
     Esqin: "axtar düyməsi gözləyir, iş masasında canlı axtarış yoxdur".
     SƏBƏB: ekranın içindən axtarış xanası tapmaq etibarsızdır — hər
     ekran fərqli qurulub. HƏLL: heç bir ekranın quruluşundan asılı
     olmayan üzən düymə. İstənilən yerdə basırsan → tam ekran axtarış
     açılır → 2 hərf/rəqəm yazan kimi mallar gəlir → toxunanda barkod.
     Söndürmək: uzun bas, və ya JollyQuickSearch.hide()
     Yaddaş: jolly_fab_off · icazə: search.live.use
     ====================================================================== */

  var QS = { open: false, q: '', rows: [] };

  function qsRowsHTML() {
    if (!QS.q || QS.q.trim().length < 2) {
      var rec = Search.recent();
      if (!rec.length) return '<div class="qs-empty">Ad və ya kod yaz — 2 hərfdən sonra özü tapır.</div>';
      var r = ['<div class="qs-rec">'];
      rec.forEach(function (t) { r.push('<span data-qsrec="' + esc(t) + '">' + esc(t) + '</span>'); });
      r.push('</div>');
      return r.join('');
    }
    if (!QS.rows.length) return '<div class="qs-empty">“' + esc(QS.q) + '” üzrə mal tapılmadı.</div>';
    var h = [];
    QS.rows.forEach(function (p) {
      var code = codeOf(p);
      h.push('<div class="qs-row">');
      var t = thumbOf(p);
      h.push(t ? '<img class="qs-th" src="' + esc(t) + '">' : '<div class="qs-th" data-qsth="' + esc(p.id) + '"></div>');
      h.push('<div class="qs-m" data-qsopen="' + esc(p.id) + '">');
      h.push('<div class="qs-nm">' + esc(p.name || '(adsız)') + '</div>');
      h.push('<div class="qs-cd">' + (code ? esc(code) : 'kod yoxdur') +
             (p.price ? ' · ' + esc(p.price) + ' ₼' : '') + '</div>');
      h.push(whyLabel(p));
      h.push('</div>');
      if (code) h.push('<div class="qs-b" data-bar="' + esc(code) + '" data-bname="' + esc(p.name || '') + '">📊</div>');
      h.push('<div class="qs-i" data-qsinfo="' + esc(p.id) + '">ⓘ</div>');
      h.push('</div>');
    });
    return h.join('');
  }

  function qsPaint() {
    var b = document.getElementById('qs-body');
    if (b) b.innerHTML = qsRowsHTML();
    var s = document.getElementById('qs-sub');
    if (s) s.textContent = QS.q.length >= 2 ? (QS.rows.length + ' nəticə') : '';
    // idb: şəkilləri doldur
    var S = lex('JollyStorage');
    if (!S) return;
    var get = S.getImage || S.get;
    if (typeof get !== 'function') return;
    Array.prototype.forEach.call(document.querySelectorAll('#qs [data-qsth]'), function (el) {
      var p = null;
      QS.rows.forEach(function (x) { if (String(x.id) === el.getAttribute('data-qsth')) p = x; });
      if (!p) return;
      var src = (p.images && p.images[0]) || p.image || p.img || '';
      if (typeof src !== 'string' || src.indexOf('idb:') !== 0) return;
      Promise.resolve(get.call(S, src)).then(function (url) {
        if (!url || !el.parentNode) return;
        var im = document.createElement('img');
        im.className = 'qs-th'; im.src = url;
        el.parentNode.replaceChild(im, el);
      }).catch(function () {});
    });
  }

  var _qsTimer = null;
  function qsOpen() {
    if (document.getElementById('qs')) return;
    var box = document.createElement('div');
    box.id = 'qs';
    box.innerHTML =
      '<div class="qs-head">' +
        '<input id="qs-q" type="search" inputmode="search" autocomplete="off" placeholder="🔎 Ad və ya kod…">' +
        '<span class="qs-mic" data-qsmic="1">🎤</span>' +
        '<span class="qs-x" data-qsclose="1">✕</span>' +
      '</div>' +
      '<div class="qs-sub" id="qs-sub"></div>' +
      '<div class="qs-body" id="qs-body"></div>';
    document.body.appendChild(box);
    QS.open = true;
    qsPaint();

    var inp = document.getElementById('qs-q');
    if (inp) {
      inp.value = QS.q || '';
      try { setTimeout(function () { inp.focus(); }, 60); } catch (e) {}
      inp.addEventListener('input', function () {
        QS.q = inp.value || '';
        if (_qsTimer) clearTimeout(_qsTimer);
        _qsTimer = setTimeout(function () {
          QS.rows = (QS.q.trim().length >= 2) ? lsearch(QS.q).slice(0, 20) : [];
          qsPaint();
        }, 150);
      });
    }

    box.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-qsclose]')) return qsClose();
      if (t.closest && t.closest('[data-qsmic]')) {
        e.stopPropagation();
        return voiceSearch(function (txt) {
          var i = document.getElementById('qs-q');
          if (i) i.value = txt;
          QS.q = txt; QS.rows = lsearch(txt).slice(0, 20); Search.remember(txt); qsPaint();
        });
      }
      var rc = t.closest && t.closest('[data-qsrec]');
      if (rc) {
        e.stopPropagation();
        var txt2 = rc.getAttribute('data-qsrec');
        var i2 = document.getElementById('qs-q');
        if (i2) i2.value = txt2;
        QS.q = txt2; QS.rows = lsearch(txt2).slice(0, 20); qsPaint(); return;
      }
      var br = t.closest && t.closest('[data-bar]');
      if (br) {
        e.stopPropagation();
        if (QS.q) Search.remember(QS.q);
        return showBarcode(br.getAttribute('data-bar'), br.getAttribute('data-bname') || '');
      }
      var inf = t.closest && t.closest('[data-qsinfo]');
      if (inf) { e.stopPropagation(); qsClose(); return openPassport(inf.getAttribute('data-qsinfo')); }
      var op = t.closest && t.closest('[data-qsopen]');
      if (op) {
        e.stopPropagation();
        var id = op.getAttribute('data-qsopen'), p = null;
        QS.rows.forEach(function (x) { if (String(x.id) === id) p = x; });
        var c = p ? codeOf(p) : '';
        if (QS.q) Search.remember(QS.q);
        if (c) return showBarcode(c, p.name || '');
        qsClose(); return openPassport(id);
      }
    });
  }

  function qsClose() {
    var b = document.getElementById('qs');
    if (b) b.remove();
    QS.open = false;
  }

  /* v5.9: üzən 🔍 düyməsi artıq STANDART SÖNÜLÜDÜR.
     Səbəb: proqramın öz sarı düymələri ilə eyni küncdə oturub onların
     üstünə düşürdü (Esqinin ekran şəkilləri). Dashboard Studio-dan
     və ya 🩺 paneldən yandırılır: jolly_fab_off = '0'. */
  function qsFabOn() {
    try {
      var v = localStorage.getItem('jolly_fab_off');
      return v !== null && String(v) === '0';
    } catch (e) { return false; }
  }

  function qsFab() {
    if (!perm('search.live.use')) return;
    if (!qsFabOn()) return;
    if (document.getElementById('qs-fab')) return;
    var f = document.createElement('div');
    f.id = 'qs-fab';
    f.textContent = '🔎';
    var press = null;
    f.addEventListener('click', function (e) { e.stopPropagation(); qsOpen(); });
    f.addEventListener('touchstart', function () {
      press = setTimeout(function () {
        dsWrite('jolly_fab_off', 1);
        var n = document.getElementById('qs-fab'); if (n) n.remove();
        toast('Üzən axtarış söndürüldü — 🩺 paneldən geri qaytarmaq olar');
      }, 900);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
      f.addEventListener(ev, function () { if (press) clearTimeout(press); }, { passive: true });
    });
    document.body.appendChild(f);
  }

  var QSCSS = [
    '#qs-fab{position:fixed!important;left:16px;bottom:88px;z-index:9990;width:58px;height:58px;',
    'border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:23px;cursor:pointer;',
    'background:linear-gradient(145deg,#f5c451,#e0a52f);color:#241a05;',
    'box-shadow:0 6px 18px rgba(0,0,0,.45);border:none}',
    '#qs{position:fixed!important;inset:0;z-index:9991;background:rgba(8,9,14,.97);color:#e8e8f0;',
    'display:flex;flex-direction:column;padding:14px 12px calc(14px + env(safe-area-inset-bottom));',
    'font-size:14px;line-height:1.45;box-sizing:border-box}',
    '#qs *{box-sizing:border-box}',
    '#qs .qs-head{display:flex;gap:8px;align-items:center}',
    '#qs input{flex:1;padding:14px 15px;border-radius:14px;font-size:16px;color:#e8e8f0;',
    'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);outline:none}',
    '#qs input:focus{border-color:rgba(245,196,81,.55)}',
    '#qs .qs-mic,#qs .qs-x{flex:none;width:46px;height:46px;border-radius:14px;display:flex;',
    'align-items:center;justify-content:center;font-size:17px;cursor:pointer;',
    'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}',
    '#qs .qs-sub{font-size:11.5px;opacity:.5;margin:9px 2px 4px;font-family:ui-monospace,monospace}',
    '#qs .qs-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch}',
    '#qs .qs-row{display:flex;align-items:center;gap:9px;padding:11px;margin-bottom:8px;border-radius:14px;',
    'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}',
    '#qs .qs-th{width:50px;height:50px;flex:none;border-radius:11px;object-fit:cover;background:#0a0b12}',
    '#qs .qs-m{flex:1;min-width:0;cursor:pointer}',
    '#qs .qs-nm{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#qs .qs-cd{font-family:ui-monospace,monospace;font-size:13px;color:#f7d98a;margin-top:2px}',
    '#qs .whyx{font-size:11px;opacity:.5;margin-top:3px}',
    '#qs .qs-b,#qs .qs-i{flex:none;padding:11px 12px;border-radius:11px;cursor:pointer;font-size:14px;',
    'border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}',
    '#qs .qs-b{border-color:rgba(245,196,81,.45);background:rgba(245,196,81,.15);color:#f7d98a}',
    '#qs .qs-empty{text-align:center;opacity:.5;font-size:13px;padding:30px 10px;line-height:1.6}',
    '#qs .qs-rec{display:flex;flex-wrap:wrap;gap:7px;padding:6px 2px}',
    '#qs .qs-rec span{padding:8px 13px;border-radius:999px;font-size:12.5px;cursor:pointer;',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}'
  ].join('');

  function qsStart() {
    if (!document.getElementById('qs-css')) {
      var st = document.createElement('style');
      st.id = 'qs-css'; st.textContent = QSCSS;
      document.head.appendChild(st);
    }
    qsFab();
    setInterval(function () { try { qsFab(); } catch (e) {} }, 3000);   // ekran dəyişəndə itməsin
    global.addEventListener('hashchange', function () { qsClose(); setTimeout(qsFab, 200); });
  }

  global.JollyQuickSearch = {
    open: qsOpen, close: qsClose,
    show: function () { try { localStorage.setItem('jolly_fab_off', '0'); } catch (e) {} qsFab(); },
    hide: function () { dsWrite('jolly_fab_off', 1); var n = document.getElementById('qs-fab'); if (n) n.remove(); }
  };


  /* ======================================================================
     ⚙️ JOLLY AYARLARI — #/jolly-settings   (v6.3)
     Bütün JOLLY aç/söndür açarları BİR ekranda. Əvvəl bunlar Dashboard
     Studio-da, 🩺 paneldə və bir neçə yerdə səpələnmişdi — Esqin
     "qatmısan, çox qarışıq" dedi, haqlı idi. İndi tək ünvan buradır.
     ====================================================================== */

  var SCSS = [
    '#jja{padding:14px 12px 90px;max-width:640px;margin:0 auto;color:#e8e8f0}',
    '#jja h2{font-size:19px;margin:0 0 4px;font-weight:700}',
    '#jja .sub{font-size:12px;opacity:.6;margin-bottom:16px;line-height:1.55}',
    '#jja .sec{font-size:11px;letter-spacing:.7px;opacity:.5;text-transform:uppercase;margin:18px 0 8px}',
    '#jja .row{display:flex;align-items:center;gap:11px;padding:13px;margin-bottom:8px;border-radius:14px;',
    'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);cursor:pointer}',
    '#jja .row .t{flex:1;min-width:0}',
    '#jja .row .l{font-size:14px;font-weight:600}',
    '#jja .row .h{font-size:11.5px;opacity:.55;margin-top:2px;line-height:1.4}',
    '#jja .sw{flex:none;width:46px;height:27px;border-radius:999px;position:relative;',
    'background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);transition:background .15s}',
    '#jja .sw i{position:absolute;top:2px;left:2px;width:21px;height:21px;border-radius:50%;',
    'background:#8a8f9c;transition:transform .15s}',
    '#jja .sw.on{background:rgba(55,214,122,.35);border-color:rgba(55,214,122,.55)}',
    '#jja .sw.on i{transform:translateX(19px);background:#37d67a}',
    '#jja .seg{display:flex;gap:7px;margin-top:9px}',
    '#jja .seg span{flex:1;padding:10px;border-radius:11px;text-align:center;font-size:12.5px;font-weight:700;',
    'cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}',
    '#jja .seg span.on{border-color:rgba(245,196,81,.5);background:rgba(245,196,81,.14);color:#f7d98a}',
    '#jja .link{display:flex;align-items:center;gap:10px;padding:13px;margin-bottom:8px;border-radius:14px;',
    'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);cursor:pointer;font-size:13.5px}',
    '#jja .link .a{margin-left:auto;opacity:.5}',
    '#jja .note{margin-top:18px;padding:12px;border-radius:13px;font-size:11.5px;opacity:.6;line-height:1.6;',
    'background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.2)}'
  ].join('');

  function jjaCSS() {
    if (document.getElementById('jja-css')) return;
    var st = document.createElement('style');
    st.id = 'jja-css'; st.textContent = SCSS;
    document.head.appendChild(st);
  }

  function jjaSwitch(key, on, label, hint) {
    return '<div class="row" data-jja="' + esc(key) + '">' +
           '<div class="t"><div class="l">' + label + '</div><div class="h">' + hint + '</div></div>' +
           '<div class="sw' + (on ? ' on' : '') + '"><i></i></div></div>';
  }

  function jjaView() {
    var h = ['<div id="jja">'];
    h.push('<h2>⚙️ JOLLY Ayarları</h2>');
    h.push('<div class="sub">Bütün JOLLY funksiyaları bir yerdə. Kartların iş masasında yeri üçün ' +
           'Dashboard Studio-ya bax — bura yalnız aç/söndürdür.</div>');

    h.push('<div class="sec">Axtarış</div>');
    h.push(jjaSwitch('live', addonOn('live'), '⚡ Canlı axtarış',
      'Hər ekranda 2 hərfdən sonra yazdıqca mal tapır'));
    h.push(jjaSwitch('studio', addonOn('studio'), '🔎 Studio ekran axtarışı',
      'Studio-da bütün ekranları (61+) süzür'));
    h.push(jjaSwitch('voice', perm('search.voice.use'), '🎤 Səslə axtarış',
      '(İcazə Mərkəzindən idarə olunur)'));

    h.push('<div class="sec">Barkod</div>');
    h.push(jjaSwitch('auto', autoOpenPref(), '🎯 Barkod avtomatik açılsın',
      'Mal dəqiq tapılanda (🟢) barkod özü ekrana çıxır'));
    h.push(jjaSwitch('fab', qsFabOn(), '🔍 Üzən axtarış düyməsi',
      'Ekranın küncündə həmişə görünən dairə'));
    h.push('<div class="row" style="cursor:default"><div class="t"><div class="l">🔁 12 rəqəmli kodun forması</div>' +
           '<div class="h">Skanerin hansı rəqəmi göndərəcəyini seçir</div>' +
           '<div class="seg">' +
           '<span class="' + (mode12() === 'ean' ? 'on' : '') + '" data-jjamode="ean">EAN-13 (kart kimi)</span>' +
           '<span class="' + (mode12() === 'upc' ? 'on' : '') + '" data-jjamode="upc">UPC-A</span>' +
           '</div></div></div>');

    h.push('<div class="sec">Digər JOLLY ekranları</div>');
    h.push('<div class="link" data-jjago="#/jolly-analytics"><span>📈 Analitika — son 30 gün</span><span class="a">→</span></div>');
    h.push('<div class="link" data-jjago="#/jolly-duplicates"><span>📦 Dublikatlar</span><span class="a">→</span></div>');
    h.push('<div class="link" data-jjago="#/jolly-diag"><span>🩺 Sistem yoxlaması</span><span class="a">→</span></div>');
    h.push('<div class="link" data-jjago="#/barcode-fix"><span>🔧 Barkod Düzəldici</span><span class="a">→</span></div>');

    h.push('<div class="note">ℹ️ Kartların iş masasında görünüb-görünməməsi burada deyil, ' +
           '<b>Dashboard Studio</b>-dadır (Studio → Dashboard Studio).</div>');
    h.push('</div>');
    return h.join('');
  }

  function jjaPaint() {
    var host = document.getElementById('jja-host');
    if (host) host.innerHTML = jjaView();
  }

  function jjaBind() {
    var root = document.getElementById('jja-host');
    if (!root || root.__b) return;
    root.__b = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      var sw = t.closest && t.closest('[data-jja]');
      if (sw) {
        var key = sw.getAttribute('data-jja');
        if (key === 'live' || key === 'studio') { addonSet(key, !addonOn(key)); jjaPaint(); return; }
        if (key === 'auto') { autoOpenPref(!autoOpenPref()); jjaPaint(); return; }
        if (key === 'fab') {
          var on = !qsFabOn();
          try { localStorage.setItem('jolly_fab_off', on ? '0' : '1'); } catch (e2) {}
          if (on) qsFab(); else { var n = document.getElementById('qs-fab'); if (n) n.remove(); }
          jjaPaint(); return;
        }
      }
      var md = t.closest && t.closest('[data-jjamode]');
      if (md) { mode12(md.getAttribute('data-jjamode')); jjaPaint(); toast('Yadda saxlanıldı', 'ok'); return; }
      var go = t.closest && t.closest('[data-jjago]');
      if (go) { global.location.hash = go.getAttribute('data-jjago'); return; }
    });
  }

  var Settings = {
    version: '6.3.0',
    render: function () { jjaCSS(); setTimeout(function () { jjaBind(); jjaPaint(); }, 0); return '<div id="jja-host">' + jjaView() + '</div>'; },
    afterRender: function () { jjaCSS(); jjaBind(); jjaPaint(); }
  };


  /* ======================================================================
     📈 JOLLY ANALİTİKA — #/jolly-analytics   (v6.3, əvvəl Şəkillə axtarış
     ekranının altında basdırılmışdı, indi müstəqil ekran)
     ====================================================================== */
  var AN = { data: null };

  function anCSS() {
    if (document.getElementById('jan-css')) return;
    var st = document.createElement('style');
    st.id = 'jan-css';
    st.textContent = [
      '#jan{padding:14px 12px 90px;max-width:640px;margin:0 auto;color:#e8e8f0}',
      '#jan h2{font-size:19px;margin:0 0 4px;font-weight:700}',
      '#jan .sub{font-size:12px;opacity:.6;margin-bottom:16px}',
      '#jan .k{display:flex;justify-content:space-between;gap:10px;padding:12px 13px;margin-bottom:8px;',
      'border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);font-size:13px}',
      '#jan .k b{font-family:ui-monospace,monospace;color:#f7d98a;font-size:15px}',
      '#jan .grp{margin-top:14px;padding:12px 13px;border-radius:13px;background:rgba(255,255,255,.03);',
      'border:1px solid rgba(255,255,255,.08);font-size:12.5px;line-height:1.9}',
      '#jan .grp b{opacity:.7;display:block;margin-bottom:6px;font-size:11px;letter-spacing:.5px;text-transform:uppercase}',
      '#jan .empty{text-align:center;opacity:.55;padding:30px 10px;font-size:13.5px}'
    ].join('');
    document.head.appendChild(st);
  }

  function anLoad() {
    AN.data = 'loading'; anPaint();
    ensureVisual().then(function (vs) {
      if (typeof vs.analytics !== 'function') { AN.data = { error: 'Motor dəstəkləmir' }; anPaint(); return; }
      return vs.analytics(30).then(function (a) { AN.data = a; anPaint(); });
    }).catch(function (e) { AN.data = { error: String(e && e.message || e) }; anPaint(); });
  }

  function anView() {
    var h = ['<div id="jan">'];
    h.push('<h2>📈 JOLLY Analitika</h2><div class="sub">Şəkillə axtarışın son 30 günü</div>');
    var a = AN.data;
    if (a === 'loading') h.push('<div class="empty">Hesablanır…</div>');
    else if (!a || a.error) h.push('<div class="empty">' + esc((a && a.error) || 'Məlumat yoxdur') + '</div>');
    else if (!a.searches) h.push('<div class="empty">Hələ heç bir şəkillə axtarış edilməyib.</div>');
    else {
      h.push('<div class="k"><span>Axtarış sayı</span><b>' + a.searches + '</b></div>');
      h.push('<div class="k"><span>Tapıldı</span><b>' + a.found + ' · ' + a.foundRate + '%</b></div>');
      h.push('<div class="k"><span>Tapılmadı</span><b>' + a.notFound + '</b></div>');
      h.push('<div class="k"><span>Barkodla bitən</span><b>' + a.barcodeRate + '%</b></div>');
      h.push('<div class="k"><span>OCR qısa yolu</span><b>' + a.ocrRate + '%</b></div>');
      h.push('<div class="k"><span>Orta vaxt</span><b>' + (a.avgMs / 1000).toFixed(2) + ' s</b></div>');
      if (a.top && a.top.length) {
        h.push('<div class="grp"><b>Ən çox axtarılan</b>' +
               a.top.map(function (t) { return esc(t.name) + ' ×' + t.count; }).join('<br>') + '</div>');
      }
      if (a.stages && a.stages.length) {
        h.push('<div class="grp"><b>Necə tapıldı</b>' +
               a.stages.map(function (t) { return esc(t.stage) + ' ×' + t.count; }).join('<br>') + '</div>');
      }
    }
    h.push('</div>');
    return h.join('');
  }

  function anPaint() { var host = document.getElementById('jan-host'); if (host) host.innerHTML = anView(); }

  var Analytics = {
    version: '6.3.0',
    render: function () { anCSS(); setTimeout(anLoad, 0); return '<div id="jan-host">' + anView() + '</div>'; },
    afterRender: function () { anCSS(); anLoad(); }
  };

  /* ======================================================================
     📦 JOLLY DUBLİKATLAR — #/jolly-duplicates   (v6.3)
     ====================================================================== */
  var DU = { data: null };

  function duCSS() {
    if (document.getElementById('jdp-css')) return;
    var st = document.createElement('style');
    st.id = 'jdp-css';
    st.textContent = [
      '#jdp{padding:14px 12px 90px;max-width:640px;margin:0 auto;color:#e8e8f0}',
      '#jdp h2{font-size:19px;margin:0 0 4px;font-weight:700}',
      '#jdp .sub{font-size:12px;opacity:.6;margin-bottom:16px}',
      '#jdp .sec{font-size:11.5px;opacity:.55;letter-spacing:.5px;text-transform:uppercase;margin:16px 0 8px}',
      '#jdp .grp{padding:12px 13px;margin-bottom:8px;border-radius:13px;font-size:12.5px;line-height:1.6;',
      'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}',
      '#jdp .grp b{color:#f7d98a;display:block;margin-bottom:3px}',
      '#jdp .empty{text-align:center;opacity:.55;padding:30px 10px;font-size:13.5px}',
      '#jdp .note{margin-top:10px;font-size:11.5px;opacity:.55}'
    ].join('');
    document.head.appendChild(st);
  }

  function duLoad() {
    DU.data = 'loading'; duPaint();
    ensureVisual().then(function (vs) {
      if (typeof vs.duplicates !== 'function') { DU.data = { error: 'Motor dəstəkləmir' }; duPaint(); return; }
      return vs.duplicates().then(function (d) { DU.data = d; duPaint(); });
    }).catch(function (e) { DU.data = { error: String(e && e.message || e) }; duPaint(); });
  }

  function duSection(title, arr) {
    if (!arr || !arr.length) return '';
    var h = ['<div class="sec">' + title + ' (' + arr.length + ' qrup)</div>'];
    arr.slice(0, 12).forEach(function (g) {
      h.push('<div class="grp"><b>' + esc(g.key).slice(0, 30) + '</b>' +
             g.items.map(function (i) { return esc(i.name || i.id); }).join(' · ') + '</div>');
    });
    return h.join('');
  }

  function duView() {
    var h = ['<div id="jdp">'];
    h.push('<h2>📦 JOLLY Dublikatlar</h2><div class="sub">Eyni barkod / kod / şəkil / görünüş</div>');
    var d = DU.data;
    if (d === 'loading') h.push('<div class="empty">Yoxlanılır…</div>');
    else if (!d || d.error) h.push('<div class="empty">' + esc((d && d.error) || 'Məlumat yoxdur') + '</div>');
    else {
      var any = (d.barcode||[]).length || (d.code||[]).length || (d.image||[]).length || (d.visual||[]).length;
      if (!any) h.push('<div class="empty">✅ Dublikat tapılmadı.</div>');
      else {
        h.push(duSection('Eyni barkod', d.barcode));
        h.push(duSection('Eyni xüsusi kod', d.code));
        h.push(duSection('Eyni şəkil', d.image));
        h.push(duSection('Eyni görünüş (barmaq izi)', d.visual));
      }
      if (d.note) h.push('<div class="note">ℹ️ ' + esc(d.note) + '</div>');
    }
    h.push('</div>');
    return h.join('');
  }

  function duPaint() { var host = document.getElementById('jdp-host'); if (host) host.innerHTML = duView(); }

  var Duplicates = {
    version: '6.3.0',
    render: function () { duCSS(); setTimeout(duLoad, 0); return '<div id="jdp-host">' + duView() + '</div>'; },
    afterRender: function () { duCSS(); duLoad(); }
  };

  /* ======================================================================
     🩺 JOLLY YOXLAMA — #/jolly-diag   (v6.3, əvvəl Kassa Barkodu ekranının
     altında basdırılmışdı, indi müstəqil ekran)
     ====================================================================== */
  var DG = { diag: null, bench: null };

  function dgCSS() {
    if (document.getElementById('jdg-css')) return;
    var st = document.createElement('style');
    st.id = 'jdg-css';
    st.textContent = [
      '#jdg{padding:14px 12px 90px;max-width:640px;margin:0 auto;color:#e8e8f0}',
      '#jdg h2{font-size:19px;margin:0 0 4px;font-weight:700}',
      '#jdg .sub{font-size:12px;opacity:.6;margin-bottom:14px}',
      '#jdg .tools{display:flex;gap:8px;margin-bottom:14px}',
      '#jdg .t{flex:1;padding:13px 6px;border-radius:13px;text-align:center;font-size:12.5px;font-weight:700;',
      'cursor:pointer;border:1px solid rgba(120,180,255,.35);background:rgba(120,180,255,.12);color:#bcd8ff}',
      '#jdg .dgl{font-size:12.5px;line-height:1.8;font-family:ui-monospace,monospace;opacity:.85;margin-bottom:8px}',
      '#jdg .dgl .k{display:flex;justify-content:space-between;gap:10px;padding:4px 0;',
      'border-bottom:1px solid rgba(255,255,255,.05)}',
      '#jdg .dgl .k b{color:#f7d98a}',
      '#jdg .dgl .k b.warn{color:#ff9d9d}',
      '#jdg .dgs{margin-top:10px;font-size:11px;opacity:.55;letter-spacing:.5px}',
      '#jdg .sec{font-size:11px;opacity:.55;letter-spacing:.5px;text-transform:uppercase;margin:16px 0 8px}',
      '#jdg .jgo2{display:flex;justify-content:space-between;align-items:center;padding:12px 13px;',
      'margin-bottom:8px;border-radius:13px;cursor:pointer;font-size:13px;',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09)}',
      '#jdg .jgo2 span:last-child{opacity:.4}'
    ].join('');
    document.head.appendChild(st);
  }

  function dgRun() {
    DG.diag = 'loading'; dgPaint();
    ensureVisual().then(function (vs) {
      var d = { cov: codeCoverage(), engine: vs.version || '?' };
      d.barcodeApi = (typeof BarcodeDetector !== 'undefined');
      d.mode12 = mode12();
      var jobs = [];
      if (typeof vs.selfTest === 'function') jobs.push(vs.selfTest().then(function (r) { d.vs = r; }));
      if (typeof vs.perf === 'function') jobs.push(vs.perf().then(function (r) { d.perf = r; }));
      return Promise.all(jobs).then(function () { DG.diag = d; dgPaint(); });
    }).catch(function (e) { DG.diag = { error: String(e && e.message || e) }; dgPaint(); });
  }

  function dgBench() {
    DG.bench = 'loading'; dgPaint();
    ensureVisual().then(function (vs) {
      if (typeof vs.benchmark !== 'function') { DG.bench = { error: 'Motor dəstəkləmir' }; dgPaint(); return; }
      return vs.benchmark({ n: 8 }).then(function (r) { DG.bench = r; dgPaint(); });
    }).catch(function (e) { DG.bench = { error: String(e && e.message || e) }; dgPaint(); });
  }

  function dgReport() {
    var d = (DG.diag && DG.diag !== 'loading') ? DG.diag : null;
    var b = (DG.bench && DG.bench !== 'loading') ? DG.bench : null;
    var t = ['JOLLY — sistem hesabatı', new Date().toLocaleString(), ''];
    if (d && !d.error) {
      t.push('motor: v' + d.engine + ' · barkod oxuyucu: ' + (d.barcodeApi ? 'var' : 'yox') + ' · 12-rəqəm: ' + d.mode12);
      if (d.vs) t.push('mal: ' + d.vs.products + ' · şəkli olan: ' + d.vs.withImages + ' · barmaq izi: ' + (d.vs.fingerprints || 0));
      var c = d.cov, scan = c.ean13 + c.twelve + c.ean8;
      t.push('barkod örtüyü: ' + scan + '/' + c.total + ' (' + Math.round(scan/(c.total||1)*100) + '%) · kodsuz: ' + c.noCode);
    }
    if (b && !b.error) {
      t.push('dəqiqlik testi: ' + b.first + '/' + b.tested + ' birinci yerdə (' + b.firstRate + '%) · orta ' + b.avgMs + ' ms');
    }
    return t.join('\n');
  }

  function dgView() {
    var h = ['<div id="jdg">'];
    h.push('<h2>🩺 Sistem Yoxlaması</h2>' +
           '<div class="sub">Bütün yoxlama alətlərinin giriş qapısı. Aşağıda ' +
           'köhnə alətlərə keçid, sonra Vision AI (şəkillə axtarış) yoxlaması.</div>');
    h.push('<div class="sec">DİGƏR YOXLAMA ALƏTLƏRİ</div>');
    h.push('<div class="jgo2" data-lgo="#/selftest"><span>🧪 Modul Testi (ümumi)</span><span>→</span></div>');
    h.push('<div class="jgo2" data-lgo="#/health-report"><span>📈 Data Hesabatı (7 gün)</span><span>→</span></div>');
    h.push('<div class="jgo2" data-lgo="#/health-v2"><span>🩺 Nüvə Sağlamlığı (təmir alətləri)</span><span>→</span></div>');
    h.push('<div class="jgo2" data-diag="1"><span>🔍 Developer Diaqnostika</span><span>→</span></div>');
    h.push('<div class="sec">VISION AI (ŞƏKİLLƏ AXTARIŞ) YOXLAMASI</div>');
    h.push('<div class="tools"><div class="t" data-dgr="1">🔍 Sistem</div>' +
           '<div class="t" data-dgb="1">⏱ Dəqiqlik</div><div class="t" data-dgc="1">📋 Kopyala</div></div>');

    var d = DG.diag;
    if (d === 'loading') h.push('<div class="dgl">Yoxlanılır…</div>');
    else if (d && d.error) h.push('<div class="dgl warn">' + esc(d.error) + '</div>');
    else if (d) {
      var c = d.cov, scan = c.ean13 + c.twelve + c.ean8;
      h.push('<div class="dgl">');
      h.push('<div class="k"><span>Motor</span><b>v' + esc(d.engine) + '</b></div>');
      if (d.vs) {
        h.push('<div class="k"><span>Mal / şəkli olan</span><b>' + d.vs.products + ' / ' + d.vs.withImages + '</b></div>');
        h.push('<div class="k"><span>Barmaq izi</span><b>' + (d.vs.fingerprints || 0) + '</b></div>');
        h.push('<div class="k"><span>Öz-özünə test</span><b class="' + (d.vs.sample === 100 ? '' : 'warn') + '">' +
               (d.vs.sample === 100 ? '✅ 100' : '⚠️ ' + d.vs.sample) + '</b></div>');
      }
      h.push('<div class="k"><span>Barkod oxuyucusu</span><b>' + (d.barcodeApi ? '✅ var' : '⚠️ yox') + '</b></div>');
      h.push('<div class="dgs">BARKOD ÖRTÜYÜ · ' + c.total + ' mal</div>');
      h.push('<div class="k"><span>Skanerlə vurula bilər</span><b>' + scan + ' · ' + Math.round(scan/(c.total||1)*100) + '%</b></div>');
      h.push('<div class="k"><span>Kodsuz</span><b>' + c.noCode + '</b></div>');
      if (c.badCheck) h.push('<div class="k"><span>Çek rəqəmi səhv</span><b class="warn">' + c.badCheck + '</b></div>');
      h.push('</div>');
    }

    var b = DG.bench;
    if (b === 'loading') h.push('<div class="dgl">⏱ Test aparılır…</div>');
    else if (b && b.error) h.push('<div class="dgl warn">' + esc(b.error) + '</div>');
    else if (b) {
      h.push('<div class="dgl"><div class="dgs">DƏQİQLİK · ' + b.tested + ' mal (optimist ölçü)</div>');
      h.push('<div class="k"><span>Birinci yerdə</span><b>' + b.first + ' / ' + b.tested + ' · ' + b.firstRate + '%</b></div>');
      h.push('<div class="k"><span>Orta vaxt</span><b>' + (b.avgMs/1000).toFixed(2) + ' s</b></div>');
      h.push('</div>');
    }
    h.push('</div>');
    return h.join('');
  }

  function dgPaint() { var host = document.getElementById('jdg-host'); if (host) host.innerHTML = dgView(); }

  function dgBind() {
    var root = document.getElementById('jdg-host');
    if (!root || root.__b) return;
    root.__b = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      var jgo = t.closest && t.closest('[data-lgo]');
      if (jgo) { e.stopPropagation(); global.location.hash = jgo.getAttribute('data-lgo'); return; }
      if (t.closest && t.closest('[data-diag]')) {
        e.stopPropagation();
        try {
          if (global.JollyDiagnostics && typeof global.JollyDiagnostics.show === 'function') {
            global.JollyDiagnostics.show();
          } else { toast('Developer Diaqnostika tapılmadı', 'error'); }
        } catch (e2) { toast('Açılmadı', 'error'); }
        return;
      }
      if (t.closest && t.closest('[data-dgr]')) { e.stopPropagation(); return dgRun(); }
      if (t.closest && t.closest('[data-dgb]')) { e.stopPropagation(); return dgBench(); }
      if (t.closest && t.closest('[data-dgc]')) {
        e.stopPropagation();
        var rep = dgReport();
        if (global.navigator && global.navigator.clipboard) {
          global.navigator.clipboard.writeText(rep).then(function () { toast('Hesabat kopyalandı', 'ok'); });
        }
        return;
      }
    });
  }

  var Diagnostics = {
    version: '6.3.0',
    render: function () { dgCSS(); setTimeout(function () { dgBind(); dgRun(); }, 0); return '<div id="jdg-host">' + dgView() + '</div>'; },
    afterRender: function () { dgCSS(); dgBind(); dgRun(); }
  };

  /* ---------- API ---------- */

  var Inbox = {
    version: '6.3.0',

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
        if (vs && vs.version !== '4.2.0') problems.push('visual-search.js köhnədir (v4.2.0 lazımdır)');
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
      if (global.POS && typeof global.POS.register === 'function') {
        global.POS.register({
          id: 'barcodeview', name: 'Kassa Barkodu', icon: '🧾',
          permissions: [{ key: LPERM, label: 'Barkodu ekranda göstər (kassa)', tag: 'view', default: true }]
        });
        global.POS.register({
          id: 'barcodefix', name: 'Barkod Düzəldici', icon: '🔧',
          permissions: [
            { key: FPERM, label: 'Səhv barkodları düzəlt', tag: 'edit', default: true },
            { key: 'barcode.fix.replace', label: 'Malın əsas kodunu ƏVƏZ et (riskli)', tag: 'edit', default: false }
          ]
        });
        /* v5.4 — STANDING RULE: hər yeni funksiya icazə sisteminə yazılır.
           Bu ekranlara aid deyil, ayrı-ayrı imkanlardır. */
        global.POS.register({
          id: 'jollytools', name: 'JOLLY Alətləri', icon: '🧰',
          permissions: [
            { key: 'search.global.use',  label: 'Qlobal axtarış mühərriki',        tag: 'view', default: true },
            { key: 'search.live.use',    label: 'Canlı axtarış (yazdıqca tapır)',  tag: 'view', default: true },
            { key: 'search.voice.use',   label: 'Səslə axtarış (🎤)',              tag: 'view', default: true },
            { key: 'barcode.show.use',   label: 'Barkodu ekranda göstərmək',       tag: 'view', default: true },
            { key: 'barcode.queue.use',  label: 'Kassa növbəsi (ardıcıl barkod)',  tag: 'view', default: true },
            { key: 'studio.search.use',  label: 'Studio ekran axtarışı',           tag: 'view', default: true },
            { key: 'dash.builder.use',   label: 'İş masasını yığmaq/söndürmək',    tag: 'edit', default: true },
            { key: 'dash.panels.hide',   label: 'İş masası panellərini gizlətmək', tag: 'edit', default: true },
            { key: 'vision.learn.use',   label: 'Şəkil axtarışını öyrətmək (✅/❌)', tag: 'edit', default: true },
            { key: 'vision.warmup.run',  label: 'Barmaq izlərini hazırlamaq (⚡)',  tag: 'edit', default: true },
            { key: 'vision.report.view', label: 'Yoxlama və hesabat paneli',       tag: 'view', default: true },
            { key: 'vision.duplicates.view', label: 'Dublikat siyahısı',           tag: 'view', default: true },
            { key: 'jolly.settings.view', label: 'JOLLY Ayarları ekranı',           tag: 'view', default: true }
          ]
        });
      }
    } catch (e) {}
    try {
      var MR = lex('ModuleRegistry');
      if (MR && typeof MR.register === 'function') {
        var JG = 'JOLLY';   // v6.3: hamısı bir qovluqda (Studio axtarışında "jolly" yazsan hamısı çıxır)
        MR.register({
          id: 'share-inbox', name: 'Şəkillə axtarış', icon: '📥',
          route: ROUTE, group: JG, perm: PERM,
          render: Inbox.render, afterRender: Inbox.afterRender
        });
        MR.register({
          id: 'barcode-view', name: 'Kassa Barkodu', icon: '🧾',
          route: LROUTE, group: JG, perm: LPERM,
          render: Lookup.render, afterRender: Lookup.afterRender
        });
        MR.register({
          id: 'barcode-fix', name: 'Barkod Düzəldici', icon: '🔧',
          route: FROUTE, group: JG, perm: FPERM,
          render: Fixer.render, afterRender: Fixer.afterRender
        });
        MR.register({
          id: 'jolly-settings', name: 'JOLLY Ayarları', icon: '⚙️',
          route: '#/jolly-settings', group: JG, perm: 'jolly.settings.view',
          render: Settings.render, afterRender: Settings.afterRender
        });
        MR.register({
          id: 'jolly-analytics', name: 'JOLLY Analitika', icon: '📈',
          route: '#/jolly-analytics', group: JG, perm: 'vision.report.view',
          render: Analytics.render, afterRender: Analytics.afterRender
        });
        MR.register({
          id: 'jolly-duplicates', name: 'JOLLY Dublikatlar', icon: '📦',
          route: '#/jolly-duplicates', group: JG, perm: 'vision.duplicates.view',
          render: Duplicates.render, afterRender: Duplicates.afterRender
        });
        MR.register({
          id: 'jolly-diag', name: '🩺 Sistem Yoxlaması (hər şey)', icon: '🩺',
          route: '#/jolly-diag', group: JG, perm: 'vision.report.view',
          render: Diagnostics.render, afterRender: Diagnostics.afterRender
        });
        return true;
      }
    } catch (e) {}
    return false;
  }

  function boot() {
    if (!registerAll()) setTimeout(registerAll, 1500);
    try { ssStart(); } catch (e) {}
    try { lsStart(); } catch (e) {}
    /* v5.8: İŞ MASASI BLOKLARI ARTIQ QURULMUR.
       Səbəb: dashboard.js-in ÖZ "Dashboard Studio"su var (#/dashboard/studio)
       və mən onun yanında ikinci, paralel sistem qurmuşdum — ekran qarışırdı.
       İndi bütün idarəetmə Dashboard Studio-dadır; bu fayl yalnız onun
       açarlarını oxuyur. dsStart() qəsdən çağırılmır. */
    try { qsStart(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }

})(window);
