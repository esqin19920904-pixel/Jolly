/* ============================================================
   JOLLY AI — COMMAND CENTER · jolly-cc.js
   v1.0  (2026-08-18)

   ────────────────────────────────────────────────────────────
   NİYƏ

   Esqin: "biz əvvəldən səhv modullar yığdıq — lazımlı-lazımsız.
   Jolly AI bizim üçün ən ideal modul idi; içərisində barkod tap,
   barkod yarat etsəydik, bir modul bəs edərdi."

   Rəqəmlər onu təsdiqləyir: 140 skript, 57 ekran — kataloqda isə
   4 mal. Alət mala nisbətdə on dəfə çoxdur.

   ────────────────────────────────────────────────────────────
   PRİNSİP — INTERFACE COLLAPSE

   140 skript SİLİNMİR. Onlar mühərrik kimi qalır. Sadəcə
   istifadəçinin qarşısına çıxan qat tək bir xanaya yığılır.

   ────────────────────────────────────────────────────────────
   ★ ƏSAS TEXNİKİ QAYDA — INTENT ROUTER

   Süni zəka bazaya ÖZBAŞINA toxunmur. O, yalnız niyyəti tanıyır;
   işi mövcud, sınanmış funksiya görür:

       "545"                → BARCODE_SEARCH → Products.findByBarcode
       "corab 12 no.545"    → PRODUCT_CREATE → təsdiq → Products.add
       "corab"              → CATALOG_SEARCH → Products.all + süzgəc
       "statistika"         → AI_QUESTION    → JollyAIBridge.ask
       📷 / 🎙️              → eyni xanaya düşür

   Niyyət tanınması YERLİDİR (qaydalarla) — internetdən asılı deyil.
   Süni zəka yalnız sərbəst suallarda işə düşür.

   ★ HEÇ NƏ TƏSDİQSİZ YAZILMIR. Yaratma həmişə kart göstərir.

   ────────────────────────────────────────────────────────────
   QIZIL QAYDA (bundan sonra)

   Yeni funksiya gələndə ilk sual: "bunu Command Center-in hansı
   əmrinə çevirmək olar?" Çevrilirsə — YENİ EKRAN YARADILMIR.
   ============================================================ */
(function (global) {
  'use strict';

  if (global.JollyCC) return;

  var VER = '7.3';
  var ROUTE = '#/cc';

  /* ★ Alt menyudakı "AI" düyməsi `app.js:404`-də `#/studios/ai`-yə
     bağlıdır. app.js-ə TOXUNMADAN həmin ünvanı da öz üzərimizə
     götürürük — beləcə menyudan basanda birbaşa bura düşür. */
  var ALIASES = { '#/cc': 1, '#/studios/ai': 1, '#/ai': 1 };
  var RECENT_KEY = 'jolly_cc_recent';

  /* ══════════════════════════════════════════════════════════
     Köməkçilər
     ══════════════════════════════════════════════════════════ */
  function peek(n) {
    try {
      return new Function('try{return typeof ' + n + '!=="undefined"?' + n + ':null}catch(e){return null}')();
    } catch (e) { return null; }
  }
  function G(n) { return global[n] || peek(n); }
  function DB() { return G('JollyDB'); }
  function IMG() { return G('JollyStorage'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function toast(m, kind) {
    var T = G('Toast');
    try {
      if (T && kind === 'ok' && T.success) return T.success(m);
      if (T && kind === 'error' && T.error) return T.error(m);
      if (T && T.info) return T.info(m);
    } catch (e) {}
  }
  function go(h) {
    var R = G('JollyRouter');
    if (R && R.go) R.go(h); else global.location.hash = h;
  }
  function norm(x) {
    return String(x || '').toLowerCase()
      .replace(/ə/g, 'e').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ğ/g, 'g')
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ı/g, 'i');
  }
  /* ══════════════════════════════════════════════════════════
     KİM İŞLƏYİR
     ──────────────────────────────────────────────────────────
     Esqin: "user və kassirlər üçün yalnız məhsullar olan bölmə,
     onun içinə JOLLY AI, sonra lupa axtarış, sonra şəkillər
     qovluğu — bunlardan başqa heç nə görməməlidirlər."
     ══════════════════════════════════════════════════════════ */
  function role() {
    try {
      var s2 = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return (s2 && s2.role) || '';
    } catch (e) { return ''; }
  }
  /* ★ ADMİN OLMAYAN HƏR KƏS İŞÇİDİR.
     Əvvəl yalnız 'user' və 'kassir' yazmışdım — proqramda başqa
     rol adı çıxsa (kassa, isci və s.) kilid işə düşmürdü.
     İndi tərsinə: yalnız admin sərbəstdir. */
  function isWorker() {
    var r = String(role() || '').toLowerCase();
    if (!r) return false;                    /* giriş yoxdursa toxunmuruq */
    return r !== 'admin' && r !== 'owner' && r !== 'sahib';
  }

  function products() {
    var d = DB();
    try { return (d && d.Products && d.Products.all) ? (d.Products.all() || []) : []; }
    catch (e) { return []; }
  }

  /* ══════════════════════════════════════════════════════════
     🧠 NİYYƏT TANIMA — yerli, internetsiz işləyir
     ══════════════════════════════════════════════════════════ */
  var ASK_RE = /\?|neç[əe]|nece|hansı|hansi|n[əe]d[əi]r|nedir|göst[əe]r|goster|statistik|hesabat|vəziyy[əe]t|veziyyet|say[ıi]|problem|sağlaml[ıi]q|saglamliq|kim|harada|niy[əe]/i;
  var MAKE_BC_RE = /^(barkod|barcod)\s*(yarat|olu[şs]dur|əlav[əe]|elave)\s*:?\s*(\d{3,})$/i;
  var MAKE_PR_RE = /^(yeni\s*mal|m[əe]hsul\s*yarat|mal\s*yarat)\s*:?\s*(.+)$/i;

  /* "Corab 545 no.12820", "Krem 12.50", "Eynək 8 man no 331" */
  function parseProduct(raw) {
    var t = String(raw || '').trim().replace(/\s+/g, ' ');
    var out = { name: '', price: '', code: '', codeType: '' };
    if (!t) return out;

    /* qiymət — "12 man", "12.50", "12,5 ₼" */
    var pm = t.match(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)\s*(?:manat|man|₼|azn|m)\b\.?/i);
    if (!pm) pm = t.match(/(?:^|\s)(\d+[.,]\d{1,2})(?=\s|$)/);
    if (pm) {
      out.price = pm[1].replace(',', '.');
      t = (t.slice(0, pm.index) + ' ' + t.slice(pm.index + pm[0].length)).trim();
    }

    /* model/kod — ayırıcı ilə, ya da tanınan sözlə */
    var mm = t.match(/([A-Za-zƏĞİÖŞÇÜəğıöşçü]{1,10})\s*[.\-\/]\s*(\d{2,})\s*$/);
    if (mm) { out.codeType = mm[1]; out.code = mm[2]; t = t.slice(0, mm.index).trim(); }
    else {
      var mw = t.match(/(?:^|\s)(no|item|model|art|kod|code|ref)\s+(\d{2,})\s*$/i);
      if (mw) { out.codeType = mw[1]; out.code = mw[2]; t = t.slice(0, mw.index).trim(); }
    }

    out.name = t.replace(/[\-–—.,]+$/, '').trim();
    return out;
  }

  /* "545 qiymət 15" · "rexona qiyməti 8 et" · "545 qiymət 12.5" */
  var EDIT_RE = /^(.+?)\s+qiym[əe]ti?\s*:?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:manat|man|₼)?\s*(?:et|olsun|dəyiş|deyis)?\s*$/i;
  /* Adsız variant — son baxılan mala aiddir: "qiyməti 8 et" */
  var EDIT_CTX_RE = /^qiym[əe]ti?\s*:?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:manat|man|₼)?\s*(?:et|olsun|dəyiş|deyis)?\s*$/i;

  /* ── Sahə adları: "545 elgun" kimi qısa yazılış üçün ──
     Hansı sahəyə yazılacağını sözün özündən tanıyırıq. */
  var FIELDS = {
    tedarukcu: 'supplier', tedarukculu: 'supplier', firma: 'brand', marka: 'brand',
    qrup: 'group', kateqoriya: 'group', yer: 'location', ref: 'location',
    reng: 'color', qeyd: 'note'
  };
  /* ★ Sözlərə bölüb axtarırıq — regex ilə deyil.
     Səbəb: "tədarükçü" diakritik hərflərlə yazılır, sadələşdirilmiş
     "tedarukcu" ilə birbaşa uyğun gəlmir. İndi hər söz ayrıca
     bərabərləşdirilir, yazılış forması fərq etmir. */
  function matchField(t) {
    var w = String(t || '').trim().split(/\s+/);
    for (var i = 1; i < w.length - 1; i++) {     /* birinci və sonuncu ola bilməz */
      var f = FIELDS[norm(w[i])];
      if (!f) continue;
      return {
        target: w.slice(0, i).join(' '),
        field: f, label: w[i],
        value: w.slice(i + 1).join(' ')
      };
    }
    return null;
  }

  /* Bu əmrlər qəsdən yoxdur — istifadəçi yazsa aydın izah alsın,
     səssiz qalmasın */
  function blockedIntent(t) {
    var n = norm(t);
    if (matchField(t)) return 'sahə dəyişmək';
    if (/qiym[əe]ti?\s*:?\s*\d/.test(n) || /\d\s*(manat|man|₼)?\s*(et|olsun)$/.test(n)) {
      if (/qiym/.test(n)) return 'qiymət dəyişmək';
    }
    if (/^\S+\s+sil$|^sil\s/.test(n) || /\bsil(in)?$/.test(n)) return 'silmək';
    if (/^(barkod|barcod)\s*(yarat|olu[şs]dur)/.test(n)) return 'barkod yaratmaq';
    if (/^q[əe]bul\s|mal\s*q[əe]bul/.test(n)) return 'mal qəbulu';
    return '';
  }

  function detect(raw) {
    var t = String(raw || '').trim();
    if (!t) return { kind: 'empty' };

    /* ★ TOPLU YAZMA — bir neçə sətir birdən */
    if (t.indexOf('\n') !== -1) {
      var rows = t.split('\n').map(function (x) { return x.trim(); })
        .filter(function (x) { return x.length > 1; });
      if (rows.length > 1) return { kind: 'bulk', rows: rows };
    }

    /* ── 08-18 QƏRARI: REDAKTƏ ÇIXARILDI ────────────────────
       Esqin: "jolly ai-də mal qəbul, redaktə, silmə olmasın,
       barkod yarada bilməsin". İcazə qatı qurmaqdansa həmin
       əməliyyatlar ümumiyyətlə burada saxlanılmır.
       Səbəb: Command Center bir ekranın içində çoxlu iş görür,
       "ekran ver/vermə" qaydası ona yetmirdi. Dəyişmək və silmək
       öz modullarında qalır — orada icazə onsuz da işləyir.
       Bura YALNIZ tapmaq, yazmaq və göndərmək üçündür. */
    var blocked = blockedIntent(t);
    if (blocked) return { kind: 'blocked', why: blocked };



    var digits = t.replace(/\s/g, '');
    if (/^\d{3,}$/.test(digits)) return { kind: 'barcode', code: digits };



    var mp = t.match(MAKE_PR_RE);
    if (mp) return { kind: 'create', data: parseProduct(mp[2]), forced: true };

    /* ★ BARKOD QOVLUĞU — yaradılmış, hələ malı olmayan kodlar.
       `jolly-barcode-folder.js` ilə EYNİ açardan oxunur
       (`jolly_barcode_folder_generated`), ona görə orada
       yaratdığın kodlar burada dərhal görünür. */
    var nt = norm(t);
    if (/^v[əe]ziyy[əe]t$|^veziyyet$|^diaqnostika$|^diag$/.test(nt)) {
      return { kind: 'diag' };
    }
    if (/^qovluq$|^barkod qovlu|^kodlar$|^yaradilmis/.test(nt)) {
      return { kind: 'folder' };
    }
    /* ★ Köhnə şəkilləri serverə köçürmək */
    if (/^sekil kocur|^şəkil köçür|^sekilleri kocur|^bulud sekil/.test(nt)) {
      return { kind: 'imgmove' };
    }

    /* Çatışmayanlar üçün yerli süzgəc — süni zəkaya ehtiyac yoxdur */
    if (/^barkodsuz/.test(nt)) return { kind: 'gap', gap: 'bc' };
    if (/^sekilsiz|^şəkilsiz/.test(nt) || /^sekli olmayan/.test(nt)) return { kind: 'gap', gap: 'img' };
    if (/^qiymetsiz|^qiym[əe]ti olmayan/.test(nt)) return { kind: 'gap', gap: 'price' };

    /* Sual əlaməti varsa — süni zəkaya */
    if (ASK_RE.test(t)) return { kind: 'ask', q: t };

    /* Ad + qiymət və ya ad + kod → yaratma təklifi */
    var p = parseProduct(t);
    if (p.name && (p.price || p.code)) return { kind: 'create', data: p };

    return { kind: 'search', q: t };
  }

  /* ══════════════════════════════════════════════════════════
     ▣ BARKOD ÇƏKİCİSİ — kassa ekrandan oxusun
     ══════════════════════════════════════════════════════════ */
  var BC = {
    L: ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'],
    G: ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'],
    R: ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'],
    P: ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'],
    C128: ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
           '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
           '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
           '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
           '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
           '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
           '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
           '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
           '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
           '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
           '114131 311141 411131 211412 211214 211232 2331112').split(' '),

    ean13: function (d) {
      var bits = '00000000000' + '101';
      var par = BC.P[+d[0]];
      for (var i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? BC.L : BC.G)[+d[i]];
      bits += '01010';
      for (var j = 7; j <= 12; j++) bits += BC.R[+d[j]];
      return bits + '101' + '00000000000';
    },
    ean8: function (d) {
      var bits = '00000000000' + '101';
      for (var i = 0; i < 4; i++) bits += BC.L[+d[i]];
      bits += '01010';
      for (var j = 4; j < 8; j++) bits += BC.R[+d[j]];
      return bits + '101' + '00000000000';
    },
    code128: function (t) {
      t = String(t || ''); if (!t) return null;
      var vals = [104], i;
      for (i = 0; i < t.length; i++) {
        var c = t.charCodeAt(i);
        if (c < 32 || c > 126) return null;
        vals.push(c - 32);
      }
      var sum = 104;
      for (i = 1; i < vals.length; i++) sum += vals[i] * i;
      vals.push(sum % 103); vals.push(106);
      var bits = '';
      for (i = 0; i < vals.length; i++) {
        var pat = BC.C128[vals[i]]; if (!pat) return null;
        var on = true;
        for (var k = 0; k < pat.length; k++) { bits += (on ? '1' : '0').repeat(+pat[k]); on = !on; }
      }
      return bits;
    },
    /* ★ Yoxlama rəqəmi — 13/8 rəqəm avtomatik EAN sayılırdı,
       amma yoxlama rəqəmi səhvdirsə kassa oxumur. İndi xəbərdarlıq
       verilir, barkod yenə çəkilir (Esqinin öz kodları da ola bilər). */
    checksum: function (d) {
      var sum = 0, n = d.length;
      for (var i = 0; i < n - 1; i++) {
        var v = +d[n - 2 - i];
        sum += (i % 2 === 0) ? v * 3 : v;
      }
      return (10 - (sum % 10)) % 10;
    },
    encode: function (raw) {
      var d = String(raw || '').replace(/\D/g, '');
      if (d.length === 13 || d.length === 8) {
        var want = BC.checksum(d), got = +d[d.length - 1];
        var bad = want !== got;
        return {
          ok: true, bits: d.length === 13 ? BC.ean13(d) : BC.ean8(d),
          kind: d.length === 13 ? 'EAN-13' : 'EAN-8',
          badSum: bad, want: want
        };
      }
      var c = BC.code128(String(raw || '').trim());
      if (c) return { ok: true, bits: c, kind: 'Code-128' };
      return { ok: false };
    },
    svg: function (bits) {
      var w = bits.length, r = [];
      for (var i = 0; i < w; i++) if (bits[i] === '1') r.push('<rect x="' + i + '" y="0" width="1" height="100" fill="#000"/>');
      return '<svg viewBox="0 0 ' + w + ' 100" preserveAspectRatio="none" ' +
             'style="width:100%;height:100%;display:block">' + r.join('') + '</svg>';
    }
  };

  /* ══════════════════════════════════════════════════════════
     Son baxılanlar
     ══════════════════════════════════════════════════════════ */
  /* ★ SKAN TARİXÇƏSİ — kassada müştəri "bunu da götürüm" deyəndə
     geri qayıtmaq lazım olur. Son 10 baxılan mal yan sütunda qalır. */
  var HIST_KEY = 'jolly_cc_hist';
  var histSel = -1;        /* ↑/↓ ilə seçilən sətir */
  var tab = 'mal';         /* mal · sekil · ai — üçü də EYNİ axtarışdan işləyir */

  function hist() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) { return []; }
  }
  function pushHist(p) {
    if (!p || !p.id) return;
    try {
      var l = hist().filter(function (x) { return x.id !== p.id; });
      l.unshift({ id: p.id, name: p.name || 'Adsız', price: p.price,
                  bc: (p.barcodes || [])[0] || '', ts: Date.now() });
      localStorage.setItem(HIST_KEY, JSON.stringify(l.slice(0, 10)));
    } catch (e) {}
  }
  function histHtml() {
    var l = hist();
    if (!l.length) return '';
    return '<div class="cc-sec">Son baxılanlar</div><div class="cc-hist">' +
      l.map(function (x, i) {
        var d = new Date(x.ts || 0);
        var hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' +
                 (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
        return '<div class="cc-hrow' + (i === histSel ? ' on' : '') +
          '" onclick="JollyCC.open(\'' + x.id + '\')">' +
          '<i class="t">' + hm + '</i>' +
          '<span class="n">' + esc(String(x.name).slice(0, 26)) + '</span>' +
          (x.price ? '<b>' + x.price + ' ₼</b>' : '<b class="no">—</b>') +
        '</div>';
      }).join('') + '</div>' +
      '<button class="cc-btn" style="width:100%;margin-top:8px" ' +
        'onclick="JollyCC.clearHist()">Tarixçəni təmizlə</button>';
  }

  function repaintHist() {
    var box = document.getElementById('ccHist');
    if (box) box.innerHTML = histHtml();
  }

  function recent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
  }
  function pushRecent(item) {
    try {
      var l = recent().filter(function (x) { return x.id !== item.id; });
      l.unshift(item);
      localStorage.setItem(RECENT_KEY, JSON.stringify(l.slice(0, 3)));
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     Vəziyyət
     ══════════════════════════════════════════════════════════ */
  var out = '';        /* nəticə sahəsinin HTML-i */
  var side = '';       /* geniş ekranda sağ sütun — seçilən malın kartı */
  var ctxProduct = null;   /* son baxılan/tapılan mal — "qiyməti 8 et" üçün */
  var draft = null;    /* təsdiq gözləyən məhsul */
  var lastInput = '';

  function paint(html) {
    out = html;
    var box = document.getElementById('ccOut');
    if (box) box.innerHTML = html;
  }
  function busy(msg) {
    paint('<div class="cc-note"><span class="cc-spin"></span> ' + esc(msg) + '</div>');
  }

  /* ══════════════════════════════════════════════════════════
     ▶ ƏSAS AXIN
     ══════════════════════════════════════════════════════════ */
  var sending = false;

  function submit(raw) {
    if (sending) return;                       /* ikiqat göndərmə qoruması */
    var text = String(raw == null ? inputValue() : raw).trim();
    if (!text) { toast('Əvvəl nəsə yaz', 'error'); return; }
    sending = true;
    setTimeout(function () { sending = false; }, 600);
    lastInput = text;
    var it = detect(text);

    /* ★ QORUMALAR ƏVVƏLDƏ — sıra vacibdir. Əvvəl işçi yoxlaması
       `create` sətrindən SONRA idi, ona görə heç vaxt işə düşmürdü. */
    if (it.kind === 'blocked') return doBlocked(it.why);
    if (isWorker() && (it.kind === 'create' || it.kind === 'bulk')) {
      return doBlocked('mal yazmaq');
    }

    if (it.kind === 'barcode') return doBarcode(it.code);
    if (it.kind === 'create') return doCreate(it.data, text);
    if (it.kind === 'bulk') return doBulk(it.rows);
    if (it.kind === 'diag') return diag();
    if (it.kind === 'folder') return doFolder();
    if (it.kind === 'imgmove') return doImgMove();
    if (it.kind === 'gap') return doGap(it.gap);
    if (it.kind === 'ask') return doAsk(it.q);
    return doSearch(it.q);
  }

  /* ★ Yazdıqca axtarır — düymə basmaq şərt deyil.
     Yalnız AXTARIŞ üçün; yaratma və AI sualı təsdiq tələb edir,
     ona görə onlar yalnız ➤ və ya Enter ilə işə düşür. */
  var typeTimer = null;

  function typing(v) {
    updateSend(v);
    histSel = -1;
    clearTimeout(typeTimer);
    var t = String(v || '').trim();
    if (t.length < 3) { if (!draft) paint(''); return; }
    typeTimer = setTimeout(function () {
      var it = detect(t);
      if (it.kind === 'search') {
        lastInput = t;
        var hits = searchProducts(t);
        if (hits.length) paint('<div class="cc-note">' + hits.length + ' mal tapıldı</div>' +
          grid(hits.slice(0, 30)));
        else paint('<div class="cc-note">tapılmadı — ➤ bas və ya sual yaz</div>');
      } else if (it.kind === 'barcode') {
        lastInput = t;
        doBarcode(it.code);
      }
    }, 320);
  }

  /* Xana boşdursa göndər düyməsi sönük olur */
  function updateSend(v) {
    var b = document.getElementById('ccGo');
    if (!b) return;
    var has = String(v == null ? inputValue() : v).trim().length > 0;
    b.style.opacity = has ? '1' : '.35';
  }

  function inputValue() {
    var el = document.getElementById('ccIn');
    return el ? String(el.value || '') : '';
  }
  function setInput(v) {
    var el = document.getElementById('ccIn');
    if (el) el.value = v == null ? '' : v;
  }

  /* ── BARKOD AXTARIŞI ─────────────────────────────────────── */
  function doBarcode(code) {
    var d = DB();
    var hits = [];
    try { hits = (d && d.Products && d.Products.findByBarcode) ? (d.Products.findByBarcode(code) || []) : []; }
    catch (e) { hits = []; }

    if (hits.length === 1) {
      /* Skanla gəldi — qiymət nəhəng göstərilsin (kassada uzaqdan oxunsun) */
      var p1 = hits[0];
      ctxProduct = p1;
      pushRecent({ id: p1.id, name: p1.name || 'Adsız' });
      pushHist(p1);
      showCard(p1, true);
      return;
    }
    if (hits.length > 1) {
      paint('<div class="cc-note">▣ ' + esc(code) + ' — ' + hits.length + ' mal tapıldı</div>' + grid(hits));
      return;
    }

    /* ★ TAPILMADI — kassada ən təhlükəli an. Kassir bunu görməzsə
       malı başqa malla qarışdıra bilər. Ona görə ekran BÖYÜK və
       qırmızıdır, barkod isə iri rəqəmlərlə yazılır. */
    var enc = BC.encode(code);
    var bad = enc.ok && enc.badSum;
    (wide() ? paintSide : paint)(
      '<div class="cc-alert' + (bad ? ' bad' : '') + '">' +
        '<div class="cc-atitle">' + (bad ? '❌ ETİBARSIZ BARKOD' : '❌ BARKOD TAPILMADI') + '</div>' +
        '<div class="cc-acode">' + esc(code) + '</div>' +
        '<div class="cc-asub">' +
          (bad
            ? 'Yoxlama rəqəmi uyğun gəlmir — bu, düzgün EAN barkod deyil. ' +
              'Skaner səhv oxuya bilər, yenidən yoxla.'
            : 'Bu barkod kataloqda yoxdur. Malı başqa malla qarışdırma.') +
        '</div>' +
        '<div class="cc-row" style="margin-top:14px">' +
          (isWorker() ? ''
            : '<button class="cc-btn cc-pri" onclick="JollyCC.newWith(\'' + esc(code) + '\')">＋ Məhsul yarat</button>') +
          (isWorker() ? ''
            : '<button class="cc-btn" onclick="JollyCC.folderAdd(\'' + esc(code) + '\')">🗂 Qovluğa at</button>') +
          '<button class="cc-btn" onclick="JollyCC.grabText(\'' + esc(code) + '\')">⧉ Kopyala</button>' +
        '</div>' +
      '</div>' +
      (enc.ok ? '<div class="cc-bc" onclick="JollyCC.zoom(\'' + esc(code) + '\')">' +
        BC.svg(enc.bits) + '<div class="cc-bcn">' + esc(code) + '</div></div>' : ''));
  }

  /* ── BARKOD YARAT (kassada vurmaq üçün) ──────────────────── */
  function doMakeBarcode(code) {
    var enc = BC.encode(code);
    if (!enc.ok) { paint('<div class="cc-note">Bu kod çəkilə bilmir: ' + esc(code) + '</div>'); return; }
    (wide() ? paintSide : paint)(
      '<div class="cc-card">' +
        '<div class="cc-h">🧾 Kassa barkodu</div>' +
        '<div class="cc-bc">' + BC.svg(enc.bits) + '<div class="cc-bcn">' + esc(code) + '</div></div>' +
        '<div class="cc-p">' + enc.kind +
          (enc.badSum ? ' · ⚠️ yoxlama rəqəmi uyğun deyil (düzgünü ' + enc.want +
            ') — kassa oxumaya bilər' : ' · kassa ekrandan oxuya bilər') + '</div>' +
      '</div>');
  }

  /* ── MƏHSUL YARATMA — həmişə TƏSDİQLƏ ────────────────────── */
  function doCreate(p, raw) {
    if (!p || !p.name) { doSearch(raw); return; }
    draft = {
      name: p.name, price: p.price || '', code: p.code || '',
      codeType: p.codeType || '', barcode: ''
    };
    /* Kod uzunsa barkod kimi qəbul edirik */
    if (p.code && p.code.length >= 6) { draft.barcode = p.code; draft.code = ''; }
    paintDraft('Bunu yazım?');
  }

  function newWith(code) {
    draft = { name: '', price: '', code: '', codeType: '', barcode: String(code || '') };
    paintDraft('Yeni məhsul');
    setTimeout(function () {
      var el = document.getElementById('ccName');
      if (el) { try { el.focus(); } catch (e) {} }
    }, 60);
  }

  function paintDraft(title) {
    var d = draft || {};
    paint(
      '<div class="cc-card cc-ok">' +
        '<div class="cc-h">＋ ' + esc(title) + '</div>' +
        '<div class="cc-f"><span>Ad</span><input id="ccName" value="' + esc(d.name) + '" ' +
          'placeholder="malın adı" oninput="JollyCC.edit(\'name\',this.value)"></div>' +
        '<div class="cc-f"><span>Qiymət</span><input id="ccPrice" inputmode="decimal" ' +
          'value="' + esc(d.price) + '" placeholder="₼" oninput="JollyCC.edit(\'price\',this.value)"></div>' +
        '<div class="cc-f"><span>Barkod</span><input id="ccBc" inputmode="numeric" ' +
          'value="' + esc(d.barcode) + '" placeholder="rəqəm" oninput="JollyCC.edit(\'barcode\',this.value)"></div>' +
        (d.code ? '<div class="cc-f"><span>' + esc(d.codeType || 'Kod') + '</span><input value="' +
          esc(d.code) + '" oninput="JollyCC.edit(\'code\',this.value)"></div>' : '') +
        '<div class="cc-row">' +
          '<button class="cc-btn cc-pri" onclick="JollyCC.save()">✓ Yadda saxla</button>' +
          '<button class="cc-btn" onclick="JollyCC.cancel()">Ləğv et</button>' +
        '</div>' +
      '</div>');
  }

  function save() {
    var d = draft;
    if (!d) return;
    if (!String(d.name || '').trim()) { toast('Ad boş ola bilməz', 'error'); return; }

    var bc = String(d.barcode || '').replace(/\D/g, '');
    /* Barkod başqa malda varsa xəbərdarlıq — üstündən yazmırıq */
    if (bc) {
      var dup = [];
      try {
        var P = (DB() || {}).Products;
        dup = (P && P.findByBarcode) ? (P.findByBarcode(bc) || []) : [];
      } catch (e) {}
      if (dup.length) {
        paint('<div class="cc-card cc-warn"><div class="cc-h">⚠️ Barkod məşğuldur</div>' +
          '<div class="cc-p">' + esc(bc) + ' artıq "' + esc(dup[0].name || 'adsız') + '" malındadır.</div>' +
          '<div class="cc-row">' +
            '<button class="cc-btn" onclick="JollyCC.open(\'' + dup[0].id + '\')">Həmin malı aç</button>' +
            '<button class="cc-btn cc-pri" onclick="JollyCC.saveNoBc()">Barkodsuz yaz</button>' +
          '</div></div>');
        return;
      }
    }
    writeProduct(bc);
  }

  function saveNoBc() { writeProduct(''); }

  function writeProduct(bc) {
    var d = draft, P = (DB() || {}).Products;
    if (!P || !P.add) { toast('Baza əlçatan deyil', 'error'); return; }
    var payload = {
      name: String(d.name).trim(),
      price: d.price === '' ? null : Number(String(d.price).replace(',', '.')),
      barcodes: bc ? [bc] : []
    };
    if (d.code) payload.note = (d.codeType || 'kod') + ': ' + d.code;

    var rec = null;
    try { rec = P.add(payload); } catch (e) {
      paint('<div class="cc-card cc-warn"><div class="cc-h">Yazıla bilmədi</div>' +
        '<div class="cc-p">' + esc(e && e.message) + '</div></div>');
      return;
    }
    draft = null;
    setInput('');
    toast('✅ ' + payload.name + ' yazıldı', 'ok');
    if (rec && rec.id) {
      var P2 = P;
      setUndo('Yaradıldı: ' + payload.name, function () {
        try { if (P2.remove) P2.remove(rec.id); else if (P2.delete) P2.delete(rec.id); } catch (e) {}
      });
      pushRecent({ id: rec.id, name: payload.name });
      ctxProduct = rec;
      paint(undoBar() + '<div class="cc-note">✅ yazıldı</div>' + grid([rec]));
    } else paint('<div class="cc-note">✅ yazıldı</div>');
  }

  /* ══════════════════════════════════════════════════════════
     🔎 AXTARIŞ
     ──────────────────────────────────────────────────────────
     Əvvəl sadə hərf-uyğunluğu idi: səhv yazsan tapmırdı, söz
     sırası dəyişsə tapmırdı, nəticələr sıralanmırdı.
     İndi: sözlərə bölünür, hər söz ayrıca axtarılır, bir hərflik
     səhvə dözür və nəticələr uyğunluq balına görə sıralanır.
     ══════════════════════════════════════════════════════════ */

  /* Bir hərflik fərqə dözüm — "corab"/"çorap", "krem"/"kream" */
  function near(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la < 4 || lb < 4) return false;
    var i = 0, j = 0, diff = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else { i++; j++; }
    }
    return true;
  }

  function tokenScore(tok, p) {
    var best = 0;
    var name = norm(p.name);

    if (name.indexOf(tok) === 0) best = Math.max(best, 12);       /* adın başı */
    else if (name.indexOf(tok) !== -1) best = Math.max(best, 8);  /* adın içi */
    else {
      /* söz-söz yaxınlıq — səhv yazılıb ola bilər */
      var words = name.split(/[\s\-_.,/]+/);
      for (var w = 0; w < words.length; w++) {
        if (near(words[w], tok)) { best = Math.max(best, 6); break; }
      }
    }

    var bcs = p.barcodes || [];
    for (var i = 0; i < bcs.length; i++) {
      var c = String(bcs[i]);
      if (c === tok) return Math.max(best, 20);                   /* tam barkod */
      if (c.indexOf(tok) !== -1) best = Math.max(best, 10);
      if (c.slice(-4) === tok) best = Math.max(best, 14);         /* son 4 rəqəm */
    }

    if (norm(p.brand).indexOf(tok) !== -1) best = Math.max(best, 5);
    if (norm(p.supplier).indexOf(tok) !== -1) best = Math.max(best, 4);
    if (norm(p.group).indexOf(tok) !== -1) best = Math.max(best, 3);
    if (norm(p.location).indexOf(tok) !== -1) best = Math.max(best, 3);
    if (norm(p.note).indexOf(tok) !== -1) best = Math.max(best, 2);
    return best;
  }

  function searchProducts(q) {
    var toks = norm(q).split(/\s+/).filter(function (t) { return t.length > 0; });
    if (!toks.length) return [];
    var list = products(), scored = [];

    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      var total = 0, hitAll = true;
      for (var t = 0; t < toks.length; t++) {
        var sc = tokenScore(toks[t], p);
        if (!sc) { hitAll = false; break; }
        total += sc;
      }
      if (!hitAll) continue;
      /* Şəkli və qiyməti olan mal bir az yuxarı — daha faydalıdır */
      if ((p.images || []).length) total += 1;
      if (p.price) total += 1;
      scored.push({ p: p, s: total });
    }

    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.map(function (x) { return x.p; });
  }

  /* ══════════════════════════════════════════════════════════
     ✎ QİYMƏT DƏYİŞMƏ — həmişə TƏSDİQLƏ
     AI bazaya toxunmur: hədəf tapılır, köhnə/yeni qiymət
     göstərilir, yalnız təsdiqdən sonra yazılır.
     ══════════════════════════════════════════════════════════ */




  /* ══════════════════════════════════════════════════════════
     ↩️ GERİ QAYTAR — 10 saniyəlik pəncərə
     ══════════════════════════════════════════════════════════ */
  var undoFn = null, undoMsg = '', undoTimer = null;

  function setUndo(msg, fn) {
    undoFn = fn; undoMsg = msg;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(function () { undoFn = null; undoMsg = ''; }, 10000);
  }

  function undoBar() {
    if (!undoFn) return '';
    return '<div class="cc-undo"><span>' + esc(undoMsg) + '</span>' +
      '<button class="cc-btn" style="flex:none;min-width:0;padding:8px 14px" ' +
      'onclick="JollyCC.undo()">↩️ Qaytar</button></div>';
  }

  function doUndo() {
    if (!undoFn) return;
    try { undoFn(); } catch (e) {}
    undoFn = null; undoMsg = '';
    clearTimeout(undoTimer);
    toast('↩️ geri qaytarıldı', 'ok');
    paint('<div class="cc-note">↩️ əməliyyat ləğv edildi</div>');
  }

  /* ══════════════════════════════════════════════════════════
     🔎 VAHİD AXTARIŞ
     ──────────────────────────────────────────────────────────
     Esqin: "bu saydıqlarımdakı axtarışların hamısını bir yerə
     cəm et — hər birindəki axtarışlar bir fərqlidir."

     Proqramda dörd ayrı axtarış var idi: Məhsullar səhifəsi,
     lupa, barkod qovluğu, Command Center. İndi hamısı BİR
     mühərrikdən işləyir (`searchProducts`) — üç bölmə yalnız
     nəticəni fərqli göstərir.
     ══════════════════════════════════════════════════════════ */
  function tabs() {
    var t = [['mal', '🔎', 'Mallar'], ['sekil', '🖼', 'Şəkillər'], ['ai', '🧠', 'JOLLY AI']];
    return '<div class="cc-tabs">' + t.map(function (x) {
      return '<div class="cc-tab' + (tab === x[0] ? ' on' : '') + '" ' +
        'onclick="JollyCC.tab(\'' + x[0] + '\')">' + x[1] + ' ' + x[2] + '</div>';
    }).join('') + '</div>';
  }

  function setTab(t) {
    tab = t;
    /* Bölmə dəyişəndə klaviatura açılmasın — nəticələri örtür */
    try { if (touch() && document.activeElement && document.activeElement.blur)
            document.activeElement.blur(); } catch (e) {}
    var q = String(inputValue()).trim();
    if (t === 'ai') {
      if (q) doAsk(q);
      else paint('<div class="cc-note">Sual yaz — məsələn "neçə mal barkodsuzdur?"</div>');
    } else if (q) {
      doSearch(q);
    } else if (t === 'sekil') {
      showGallery('');
    } else {
      paint('');
    }
    repaint();
  }

  /* 🖼 ŞƏKİLLƏR QOVLUĞU — yalnız şəkli olanlar, iri kafellərlə */
  function showGallery(q) {
    var l = q ? searchProducts(q) : products();
    var withImg = l.filter(function (p) { return p && (p.images || []).length; });
    if (!withImg.length) {
      paint('<div class="cc-card cc-warn"><div class="cc-h">Şəkil yoxdur</div>' +
        '<div class="cc-p">' + (q ? 'Bu axtarışda şəkilli mal tapılmadı.'
          : 'Kataloqda şəkilli mal yoxdur.') + '</div></div>');
      return;
    }
    ctxProduct = withImg[0];
    var I = IMG();
    paint('<div class="cc-note">🖼 ' + withImg.length + ' şəkilli mal</div>' +
      '<div class="cc-gal">' + withImg.slice(0, 60).map(function (p) {
        var ref = (p.images || [])[0];
        var cloud = String(ref).indexOf('http') === 0;
        return '<div class="cc-gcell" onclick="JollyCC.open(\'' + p.id + '\')">' +
          '<img ' + I.imgAttr(ref, true) + ' alt="">' +
          '<i class="cc-gloc">' + (cloud ? '☁️' : '📱') + '</i>' +
          ((p.images || []).length > 1
            ? '<i class="cc-gn">' + p.images.length + '</i>' : '') +
          '<div class="cc-gt">' + esc(p.name || 'Adsız') +
            (p.price ? ' · ' + p.price + ' ₼' : '') + '</div>' +
        '</div>';
      }).join('') + '</div>');
  }

  /* ── KATALOQ AXTARIŞI ────────────────────────────────────── */
  function doSearch(q) {
    if (tab === 'sekil') { showGallery(q); return; }
    if (tab === 'ai') { doAsk(q); return; }
    var hits = searchProducts(q);

    if (!hits.length) {
      var p = parseProduct(q);
      paint('<div class="cc-card cc-warn">' +
        '<div class="cc-h">Tapılmadı: ' + esc(q) + '</div>' +
        '<div class="cc-p">Kataloqda uyğun mal yoxdur.</div>' +
        '<div class="cc-row">' +
          (isWorker() ? ''
            : '<button class="cc-btn cc-pri" onclick="JollyCC.createFrom()">＋ Bu adla mal yarat</button>') +
          '<button class="cc-btn" onclick="JollyCC.ask()">🧠 AI-dan soruş</button>' +
        '</div></div>');
      return;
    }
    ctxProduct = hits[0];
    paint('<div class="cc-note">' + hits.length + ' mal tapıldı</div>' + grid(hits.slice(0, 30)));
  }

  function doBlocked(why) {
    paint('<div class="cc-card cc-warn">' +
      '<div class="cc-h">Bu burada edilmir</div>' +
      '<div class="cc-p">JOLLY AI ' + esc(why) + ' üçün deyil — o, öz bölməsində edilir. ' +
      'Bura mal tapmaq, yeni mal yazmaq və göndərmək üçündür.</div>' +
      '<div class="cc-row">' +
        '<button class="cc-btn" onclick="JollyCC.cancel()">Bağla</button>' +
      '</div></div>');
  }

  /* ══════════════════════════════════════════════════════════
     📦 TOPLU YAZMA — bir neçə sətri birdən
     Hər sətir ayrıca oxunur, siyahı göstərilir, redaktə oluna
     bilir, YALNIZ təsdiqdən sonra hamısı birdən yazılır.
     ══════════════════════════════════════════════════════════ */
  var bulkRows = null;

  function doBulk(rows) {
    bulkRows = rows.map(function (line) {
      var p = parseProduct(line);
      return {
        name: p.name || line, price: p.price || '',
        barcode: (p.code && p.code.length >= 6) ? p.code : '',
        code: (p.code && p.code.length < 6) ? p.code : '',
        codeType: p.codeType || ''
      };
    }).filter(function (x) { return x.name; });
    paintBulk();
  }

  function paintBulk() {
    if (!bulkRows || !bulkRows.length) { paint(''); return; }
    var ok = bulkRows.filter(function (x) { return String(x.name).trim(); }).length;
    paint('<div class="cc-card cc-ok">' +
      '<div class="cc-h">📦 ' + bulkRows.length + ' sətir oxundu</div>' +
      '<div class="cc-p">Adları yoxla, lazım olanı düzəlt. Sonra hamısı birdən yazılacaq.</div>' +
      bulkRows.map(function (x, i) {
        return '<div class="cc-brow">' +
          '<span class="cc-bn">' + (i + 1) + '</span>' +
          '<input value="' + esc(x.name) + '" placeholder="ad" ' +
            'oninput="JollyCC.bulkEdit(' + i + ',\'name\',this.value)">' +
          '<input class="cc-bp" inputmode="decimal" value="' + esc(x.price) + '" placeholder="₼" ' +
            'oninput="JollyCC.bulkEdit(' + i + ',\'price\',this.value)">' +
          '<button class="cc-act" style="flex:none;width:34px" ' +
            'onclick="JollyCC.bulkDrop(' + i + ')">✕</button>' +
        '</div>';
      }).join('') +
      '<div class="cc-row">' +
        '<button class="cc-btn cc-pri" onclick="JollyCC.bulkSave()">✓ ' + ok + ' malı yaz</button>' +
        '<button class="cc-btn" onclick="JollyCC.cancel()">Ləğv et</button>' +
      '</div></div>');
  }

  function bulkSave() {
    if (!bulkRows || !bulkRows.length) return;
    var P = (DB() || {}).Products;
    if (!P || !P.add) { toast('Baza əlçatan deyil', 'error'); return; }

    var made = [], failed = [];
    for (var i = 0; i < bulkRows.length; i++) {
      var x = bulkRows[i];
      var nm = String(x.name || '').trim();
      if (!nm) continue;
      var bc = String(x.barcode || '').replace(/\D/g, '');
      /* Barkod məşğuldursa o sətri barkodsuz yazırıq — dayandırmırıq */
      if (bc && P.findByBarcode && (P.findByBarcode(bc) || []).length) {
        failed.push(nm + ' (barkod məşğul)');
        bc = '';
      }
      try {
        var rec = P.add({
          name: nm,
          price: x.price === '' ? null : Number(String(x.price).replace(',', '.')),
          barcodes: bc ? [bc] : [],
          note: x.code ? ((x.codeType || 'kod') + ': ' + x.code) : undefined
        });
        if (rec && rec.id) made.push(rec);
      } catch (e) { failed.push(nm + ' — ' + (e && e.message)); }
    }

    bulkRows = null;
    setInput('');
    toast('✅ ' + made.length + ' mal yazıldı', 'ok');

    /* Hamısını birdən geri qaytarmaq mümkündür */
    if (made.length) {
      setUndo(made.length + ' mal yazıldı', function () {
        made.forEach(function (r) {
          try { if (P.remove) P.remove(r.id); else if (P.delete) P.delete(r.id); } catch (e) {}
        });
      });
    }
    paint(undoBar() +
      '<div class="cc-note">✅ ' + made.length + ' mal yazıldı' +
      (failed.length ? ' · ⚠️ ' + failed.length + ' sətirdə problem: ' +
        esc(failed.slice(0, 3).join(', ')) : '') + '</div>' +
      (made.length ? grid(made.slice(0, 20)) : ''));
  }

  /* ══════════════════════════════════════════════════════════
     ✎ SAHƏ YAZMA — "545 tədarükçü elgun"
     ══════════════════════════════════════════════════════════ */




  /* ══════════════════════════════════════════════════════════
     🗂 BARKOD QOVLUĞU — yaradılmış kodlar
     ──────────────────────────────────────────────────────────
     Bu kodların hələ malı yoxdur. Qovluqda saxlanılır ki,
     sonra onlara mal yazılsın. Kassirdə görünmür.
     ══════════════════════════════════════════════════════════ */
  var GEN_KEY = 'jolly_barcode_folder_generated';

  function genList() {
    var d = DB();
    try {
      if (d && d.read) return d.read(GEN_KEY, []) || [];
      return JSON.parse(localStorage.getItem(GEN_KEY) || '[]');
    } catch (e) { return []; }
  }

  function genSave(list) {
    var d = DB();
    try {
      if (d && d.write) { d.write(GEN_KEY, list); return true; }
      localStorage.setItem(GEN_KEY, JSON.stringify(list));
      return true;
    } catch (e) { return false; }
  }

  /* Kodun malı yaranıbmı — kataloqda axtarırıq */
  function usedBy(code) {
    var P = (DB() || {}).Products;
    try {
      var hit = (P && P.findByBarcode) ? (P.findByBarcode(code) || []) : [];
      return hit[0] || null;
    } catch (e) { return null; }
  }

  function doFolder() {
    if (isWorker()) return doBlocked('barkod qovluğu');

    var l = genList();
    if (!l.length) {
      paint('<div class="cc-card cc-warn"><div class="cc-h">🗂 Qovluq boşdur</div>' +
        '<div class="cc-p">Burada hələ malı olmayan barkodlar saxlanılır. ' +
        'Barkod oxudub tapılmayanda "＋ Məhsul yarat" əvəzinə qovluğa da ' +
        'ata bilərsən.</div></div>');
      return;
    }

    var free = [], done = [];
    l.forEach(function (g) {
      var p = usedBy(g.code);
      (p ? done : free).push({ g: g, p: p });
    });

    paint(
      '<div class="cc-note">🗂 ' + l.length + ' yaradılmış barkod · ' +
        free.length + ' boş · ' + done.length + ' malı var</div>' +
      (free.length
        ? '<div class="cc-sec">Malı yoxdur</div>' +
          '<div class="cc-folder">' + free.map(function (x) {
            return '<div class="cc-frow">' +
              '<button class="cc-fcode" draggable="true" data-v="' + esc(x.g.code) + '" ' +
                'onclick="JollyCC.grab(this)" ondragstart="JollyCC.drag(event,this)">⧉ ' +
                esc(x.g.code) + '</button>' +
              (x.g.label ? '<span class="cc-flab">' + esc(x.g.label) + '</span>' : '') +
              '<button class="cc-act" style="flex:none;width:40px" title="Böyüt" ' +
                'onclick="JollyCC.kassa(\'' + esc(x.g.code) + '\')">🧾</button>' +
              '<button class="cc-act cc-fnew" style="flex:none;width:44px" title="Mal yarat" ' +
                'onclick="JollyCC.newWith(\'' + esc(x.g.code) + '\')">＋</button>' +
              '<button class="cc-act" style="flex:none;width:38px" title="Qovluqdan çıxar" ' +
                'onclick="JollyCC.folderDrop(\'' + esc(x.g.code) + '\')">✕</button>' +
            '</div>';
          }).join('') + '</div>'
        : '') +
      (done.length
        ? '<div class="cc-sec">Malı yaradılıb</div>' +
          '<div class="cc-folder">' + done.map(function (x) {
            return '<div class="cc-frow done" onclick="JollyCC.open(\'' + x.p.id + '\')">' +
              '<span class="cc-fcode2">' + esc(x.g.code) + '</span>' +
              '<span class="cc-flab">' + esc(x.p.name || 'Adsız') + '</span>' +
              (x.p.price ? '<b class="cc-py">' + x.p.price + ' ₼</b>' : '') +
            '</div>';
          }).join('') + '</div>'
        : ''));
  }

  /* Tapılmayan barkodu qovluğa atmaq */
  function folderAdd(code, label) {
    code = String(code || '').trim();
    if (!code) return false;
    var l = genList();
    if (l.some(function (g) { return String(g.code) === code; })) return true;
    l.unshift({
      id: 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      code: code, label: label || '', createdAt: Date.now(), source: 'cc'
    });
    return genSave(l);
  }

  /* ══════════════════════════════════════════════════════════
     🖼 ŞƏKİLLƏRİ SERVERƏ KÖÇÜRMƏK
     Köhnə şəkillər telefonun içindədir, ona görə kompüterdə
     görünmür. Bu, onları bir dəfəyə R2-yə yükləyir.
     ══════════════════════════════════════════════════════════ */
  function doImgMove(start) {
    if (isWorker()) return doBlocked('şəkil köçürmə');
    var C2 = G('JollyCloud2');
    if (!C2 || !C2.migrateImages) {
      paint('<div class="cc-card cc-warn"><div class="cc-h">Bulud körpüsü yüklənməyib</div>' +
        '<div class="cc-p">jolly-cloud2.js yüklənməyib və ya köhnə versiyadır. ' +
        'Fayl yeniləndikdən sonra proqramı bağlayıb aç.</div></div>');
      return;
    }

    /* ★ Vəziyyət aydın olsun — hansı şəkil harada saxlanılır */
    var all = 0, cloud = 0, local = 0, none = 0;
    products().forEach(function (p) {
      var im = p.images || [];
      if (!im.length) { none++; return; }
      im.forEach(function (r) {
        all++;
        if (String(r).indexOf('http') === 0) cloud++; else local++;
      });
    });

    var c = C2.localCount();
    if (!c.images) {
      paint('<div class="cc-card cc-ok">' +
        '<div class="cc-h">✅ Hamısı serverdədir</div>' +
        '<div class="cc-p">Cəmi ' + all + ' şəkil · ☁️ ' + cloud + ' serverdə · ' +
        '📷 ' + none + ' mal şəkilsiz.<br><br>' +
        'Kompüterdə görünmürsə internet və ya deploy məsələsidir — ' +
        '<b>/api/ping</b> yoxla.</div></div>');
      return;
    }

    if (!start) {
      paint('<div class="cc-card cc-warn">' +
        '<div class="cc-h">🖼 ' + c.images + ' şəkil hələ cihazdadır</div>' +
        '<div class="cc-p">Cəmi ' + all + ' şəkil · ☁️ ' + cloud + ' serverdə · ' +
        '📱 ' + local + ' bu cihazda.<br>' +
        c.products + ' malın şəkli yalnız burada saxlanılıb — ' +
        'ona görə kompüterdə görünmür.<br><br>' +
        'Köçürmə onları serverə yükləyəcək. Cihazdakı nüsxə SİLİNMİR. ' +
        'Şəkil sayına görə bir neçə dəqiqə çəkə bilər — ekranı bağlama.</div>' +
        '<div class="cc-row">' +
          '<button class="cc-btn cc-pri" onclick="JollyCC.imgMoveGo()">☁️ Köçürməyə başla</button>' +
          '<button class="cc-btn" onclick="JollyCC.cancel()">Sonra</button>' +
        '</div></div>');
      return;
    }

    busy('☁️ köçürülür…');
    C2.migrateImages(function (i, total, name) {
      paint('<div class="cc-card">' +
        '<div class="cc-h"><span class="cc-spin"></span> ' + i + ' / ' + total + '</div>' +
        '<div class="cc-p">' + esc(String(name).slice(0, 40)) + '</div>' +
        '<div class="cc-bar2"><i style="width:' +
          Math.round(i / total * 100) + '%"></i></div></div>');
    }).then(function (r) {
      if (!r || !r.ok) {
        paint('<div class="cc-card cc-warn"><div class="cc-h">Köçürülmədi</div>' +
          '<div class="cc-p">' + esc((r && r.error) || 'səbəb bilinmir') + '</div></div>');
        return;
      }
      var left = C2.localCount();
      paint('<div class="cc-card cc-ok">' +
        '<div class="cc-h">✅ ' + r.moved + ' şəkil serverə köçdü</div>' +
        '<div class="cc-p">' + r.total + ' mal yoxlanıldı' +
        (r.failed ? ' · ' + r.failed + ' malda alınmadı' : '') +
        (left.images ? '<br>' + left.images + ' şəkil hələ cihazdadır — yenidən cəhd et.'
                     : '<br>Hamısı serverdədir. İndi kompüterdə də görünəcək.') +
        '</div></div>');
    });
  }

  /* ══════════════════════════════════════════════════════════
     🩺 VƏZİYYƏT — "yenə düz işləmir" deyəndə TƏXMİN ETMƏMƏK üçün
     ──────────────────────────────────────────────────────────
     Xanaya `vəziyyət` yazanda ekranda dəqiq nə baş verdiyi görünür:
     hansı versiya işləyir, kim kimi sayılır, qabıq tətbiq olunubmu,
     hansı köhnə element HƏLƏ EKRANDA görünür.

     Bir şəkil kifayət edir — səbəb dərhal bilinir.
     ══════════════════════════════════════════════════════════ */
  function visibleLeftovers() {
    var out = [];
    try {
      for (var i = 0; i < HIDE.length; i++) {
        var sel = HIDE[i];
        var els;
        try { els = document.querySelectorAll(sel); } catch (e) { continue; }
        for (var j = 0; j < els.length; j++) {
          var el = els[j], vis = false;
          try {
            var r = el.getBoundingClientRect();
            var cs = global.getComputedStyle ? global.getComputedStyle(el) : null;
            vis = r.width > 0 && r.height > 0 &&
                  (!cs || (cs.display !== 'none' && cs.visibility !== 'hidden'));
          } catch (e) {}
          if (vis) { out.push(sel + ' → ' + (el.className || el.id || el.tagName)); break; }
        }
      }
    } catch (e) {}
    return out;
  }

  function diag() {
    var S = G('JollySpace'), C2 = G('JollyCloud2');
    var shell = !!document.getElementById(SHELL_ID);
    var left = visibleLeftovers();

    var rows = [
      ['Versiya', 'v' + VER],
      ['Rol', role() || '(giriş yoxdur)'],
      ['Kassir sayılır', isWorker() ? 'BƏLİ' : 'xeyr (admin)'],
      ['Kilid', lockOn() ? 'açıq' : 'SÖNDÜRÜLÜB'],
      ['Marşrut', String(global.location.hash || '')],
      ['Qabıq tətbiq olunub', shell ? 'BƏLİ' : 'XEYR'],
      ['Sensor ekran', touch() ? 'bəli' : 'xeyr'],
      ['Ekran eni', String(global.innerWidth || '?') + ' px'],
      ['Kataloq', products().length + ' mal'],
      ['Yaddaş', S && S.mb ? S.mb() + ' MB' : '—'],
      ['Bulud körpüsü', C2 ? 'var (v' + (C2.version || '?') + ')' : 'YOXDUR'],
      ['Şəkil cihazda', C2 && C2.localCount ? String(C2.localCount().images) : '—'],
      ['İdarə Mərkəzi', G('JollyIdare') ? 'yüklənib' : 'yoxdur'],
      ['Köhnə işçi rejimi', G('JollyUserMode') ? '⚠️ HƏLƏ YÜKLƏNİR' : 'yoxdur'],
      ['Alt panel', G('JollyBottomDock') ? 'yüklənib' : 'yoxdur']
    ];

    paint(
      '<div class="cc-card">' +
        '<div class="cc-h">🩺 Vəziyyət</div>' +
        '<div class="cc-kvs">' + rows.map(function (r) {
          return '<div class="cc-kv"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
        }).join('') + '</div>' +
      '</div>' +
      (left.length
        ? '<div class="cc-card cc-warn"><div class="cc-h">⚠️ Hələ görünən köhnə elementlər</div>' +
          '<div class="cc-p">' + left.map(esc).join('<br>') + '</div></div>'
        : '<div class="cc-card cc-ok"><div class="cc-h">✅ Köhnə element görünmür</div></div>'));
  }

  /* ── ÇATIŞMAYANLAR SÜZGƏCİ — yerli, sürətli ─────────────── */
  function doGap(kind) {
    var l = products();
    var lab = { bc: 'barkodsuz', img: 'şəkilsiz', price: 'qiymətsiz' }[kind];
    var hits = l.filter(function (p) {
      if (kind === 'bc') return !(p.barcodes || []).length;
      if (kind === 'img') return !(p.images || []).length;
      return !p.price;
    });
    if (!hits.length) {
      paint('<div class="cc-card cc-ok"><div class="cc-h">✅ ' + lab + ' mal yoxdur</div>' +
        '<div class="cc-p">Hamısı doldurulub.</div></div>');
      return;
    }
    ctxProduct = hits[0];
    paint('<div class="cc-note">' + hits.length + ' ' + lab + ' mal</div>' + grid(hits.slice(0, 40)));
  }

  /* ── AI SUALI ────────────────────────────────────────────── */
  function doAsk(q) {
    var B = G('JollyAIBridge');
    if (!B) {
      paint('<div class="cc-card cc-warn"><div class="cc-h">AI körpüsü yüklənməyib</div>' +
        '<div class="cc-p">jolly-ai-bridge.js yoxdur — sual göndərilə bilmir.</div></div>');
      return;
    }
    busy('soruşulur…');
    B.ask(q).then(function (r) {
      if (r && r.ok && r.text) {
        paint('<div class="cc-card cc-ai"><div class="cc-h">🧠 ' + esc(q) + '</div>' +
          '<div class="cc-ans">' + esc(r.text).replace(/\n/g, '<br>') + '</div>' +
          '<div class="cc-p">☁️ süni zəka · rəqəmlər sənin bazandan</div></div>');
      } else {
        paint('<div class="cc-card cc-warn"><div class="cc-h">Cavab gəlmədi</div>' +
          '<div class="cc-p">' + esc((r && r.error) || 'səbəb bilinmir') + '</div></div>');
      }
    }).catch(function (e) {
      paint('<div class="cc-card cc-warn"><div class="cc-h">Xəta</div>' +
        '<div class="cc-p">' + esc(e && e.message) + '</div></div>');
    });
  }

  /* ── Nəticə şəbəkəsi ─────────────────────────────────────── */
  function grid(list) {
    var I = IMG();
    return '<div class="cc-grid">' + list.map(function (p) {
      var ref = (p.images || [])[0];
      /* ★ Şəkildə boş qara qutular görünürdü: nişan var, şəkil yox.
         Açılmasa yerinə 📦 qoyulur — ekran səliqəli qalır. */
      var img = (ref && I && I.imgAttr)
        ? '<img ' + I.imgAttr(ref, true) + ' alt="" ' +
          'onerror="JollyCC.imgFail(this)">'
        : '<div class="cc-ph" style="' + tintStyle(p) + '">📦</div>';
      var bc = (p.barcodes || [])[0];
      /* ★ Tapdıqdan sonra bir toxunuşla göndərmək — köhnədə bu var idi */
      var miss = [];
      if (!bc) miss.push('▣');
      if (!ref) miss.push('📷');
      if (!p.price) miss.push('₼');
      return '<div class="cc-cell">' +
        '<div onclick="JollyCC.open(\'' + p.id + '\')">' + img +
          (miss.length ? '<div class="cc-miss">' + miss.join(' ') + '</div>' : '') +
          (isNew(p) ? '<i class="cc-newtag">YENİ</i>' : '') +
          '<div class="cc-nm">' + esc(p.name || 'Adsız') + '</div>' +
          '<div class="cc-pr">' +
            (p.price ? '<b class="cc-py">' + p.price + ' ₼</b>'
                     : '<span style="opacity:.5">qiymətsiz</span>') +
            (bc ? '<span class="cc-bcx">' + esc(String(bc).slice(-6)) + '</span>' : '') +
          '</div>' +
        '</div>' +
        (isWorker()
          ? (bc ? '<div class="cc-acts">' +
              '<button class="cc-act" title="Barkodu böyüt" ' +
                'onclick="JollyCC.kassa(\'' + esc(bc) + '\')">🧾</button></div>' : '')
          : '<div class="cc-acts">' +
              '<button class="cc-act" title="Göndər" onclick="JollyCC.share(\'' + p.id + '\')">📤</button>' +
              (bc ? '<button class="cc-act" title="Kassa" onclick="JollyCC.kassa(\'' + esc(bc) + '\')">🧾</button>' : '') +
              '<button class="cc-act" title="Mətn" onclick="JollyCC.text(\'' + p.id + '\')">📋</button>' +
            '</div>') +
      '</div>';
    }).join('') + '</div>';
  }

  /* ★ BARKODU TAM EKRANDA — kassa skaneri və ya müştərinin
     telefonu rahat oxusun */
  function zoom(code) {
    var enc = BC.encode(code);
    if (!enc.ok) return;
    var old = document.getElementById('ccZoom');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var d = document.createElement('div');
    d.id = 'ccZoom';
    d.className = 'cc-zoom';
    d.innerHTML = '<div class="cc-zbox">' + BC.svg(enc.bits) +
      '<div class="cc-zn">' + esc(code) + '</div>' +
      '<div class="cc-zh">bağlamaq üçün toxun</div></div>';
    d.onclick = function () { try { d.parentNode.removeChild(d); } catch (e) {} };
    document.body.appendChild(d);
  }

  /* ══════════════════════════════════════════════════════════
     ⧉ KOPYALA VƏ SÜRÜKLƏ — 1C üçün
     ══════════════════════════════════════════════════════════ */
  function grab(el) {
    var v = '';
    try { v = el.getAttribute('data-v') || el.textContent || ''; } catch (e) {}
    v = String(v).trim();
    if (!v) return;

    var done = function () {
      try {
        el.classList.add('cc-copied');
        setTimeout(function () { el.classList.remove('cc-copied'); }, 900);
      } catch (e) {}
      toast('⧉ ' + (v.length > 24 ? v.slice(0, 24) + '…' : v), 'ok');
    };

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v).then(done).catch(function () { fallbackCopy(v, done); });
        return;
      }
    } catch (e) {}
    fallbackCopy(v, done);
  }

  /* Köhnə brauzerlər və icazə verilməyən hallar üçün */
  function fallbackCopy(v, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = v;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      if (ta.select) ta.select();
      if (ta.setSelectionRange) ta.setSelectionRange(0, v.length);
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (done) done();
    } catch (e) { toast('Kopyalanmadı', 'error'); }
  }

  /* Sürükləmə — 1C və digər proqramlar mətn kimi qəbul edir */
  function drag(ev, el) {
    try {
      var v = el.getAttribute('data-v') || el.textContent || '';
      v = String(v).trim();
      if (!v || !ev.dataTransfer) return;
      ev.dataTransfer.setData('text/plain', v);
      ev.dataTransfer.effectAllowed = 'copy';
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     📤 GÖNDƏRMƏ — şəkillə birlikdə
     ══════════════════════════════════════════════════════════ */
  /* 1C-yə bir sətirdə yapışdırmaq üçün */
  function rowText(p) {
    return [p.name || 'Adsız', (p.barcodes || [])[0] || '',
            (p.price != null && p.price !== '') ? p.price : ''].join(' | ');
  }

  function productText(p) {
    return [
      p.name ? 'Məhsul: ' + p.name : null,
      (p.price != null && p.price !== '') ? 'Qiymət: ' + p.price + ' ₼' : null,
      p.brand ? 'Firma: ' + p.brand : null,
      (p.barcodes || [])[0] ? 'Barkod: ' + p.barcodes[0] : null
    ].filter(Boolean).join('\n');
  }

  function findProduct(id) {
    return products().filter(function (x) { return x && x.id === id; })[0] || null;
  }

  function share(id) {
    var p = findProduct(id);
    if (!p) return;
    var txt = productText(p);
    var ref = (p.images || [])[0];
    var I = IMG();

    /* Şəkli də göndərməyə çalışırıq — WhatsApp-da şəkilli daha faydalıdır */
    if (global.navigator && navigator.share && ref && I && I.getImage) {
      Promise.resolve(I.getImage(ref)).then(function (data) {
        if (!data || String(data).indexOf('data:') !== 0) throw new Error('şəkil yoxdur');
        return fetch(data).then(function (r) { return r.blob(); });
      }).then(function (b) {
        var f = new File([b], 'mehsul.jpg', { type: b.type || 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) {
          return navigator.share({ text: txt, files: [f] });
        }
        return navigator.share({ text: txt });
      }).catch(function () {
        shareTextOnly(txt);
      });
      return;
    }
    shareTextOnly(txt);
  }

  function shareTextOnly(txt) {
    if (global.navigator && navigator.share) {
      navigator.share({ text: txt }).catch(function () {});
      return;
    }
    try { global.location.href = 'https://wa.me/?text=' + encodeURIComponent(txt); }
    catch (e) { toast('Göndərmə açılmadı', 'error'); }
  }

  /* ★ "Bir ekran" prinsipi: mala toxunanda başqa səhifəyə ATMIRIQ.
     Kart elə burada açılır — şəkil, bütün sahələr və əməliyyatlar.
     Tam kart lazımdırsa "Tam kart" düyməsi var. */
  function openProduct(p) {
    if (!p || !p.id) return;
    ctxProduct = p;
    pushRecent({ id: p.id, name: p.name || 'Adsız' });
    pushHist(p);
    showCard(p);
  }

  /* ★ Esqin: "barkodun rəqəmlərini kopyalamaq üçün orda klik
     qoymaq lazımdı... və yaxud sürükləyib 1C proqramına gətirmək
     olsun — həm kopya, həm sürükləmə olsun".
     Ona görə hər dəyər: toxunanda KOPYALANIR, siçanla
     SÜRÜKLƏNƏ də bilir (1C-yə buraxmaq üçün). */
  /* ★ Esqin: "copy etdikdə ancaq məhsulun barkod rəqəmlərin copy
     etmək üçün düymə olsun — ancaq barkod lazım olur".
     Ona görə adi sahələr artıq kopyalanmır (səhvən basılmasın),
     barkod üçün isə ayrıca BÖYÜK düymə var. */
  /* ══════════════════════════════════════════════════════════
     🎨 MALIN RƏNG İZİ
     ──────────────────────────────────────────────────────────
     Esqin: "məhsulların rənginə görə arxa fonlar onlara uyğunlaşsın."

     Kosmetikada rəng malın öz əlamətidir — pomada qırmızı, pudra
     bej, krem yaşımtıl. Kassir rəngə görə malı tanıyır, ona görə
     bu bəzək deyil, məlumatdır.

     Rəng üç mənbədən götürülür, sıra ilə:
       1. malın "Rəng" sahəsi (yazılıbsa)
       2. qrupu (dodaq, dırnaq, saç…)
       3. adından sabit ton (heç nə yazılmayıbsa da eyni mal
          həmişə eyni rəngdə görünür)
     ══════════════════════════════════════════════════════════ */
  var TINTS = [
    ['#FFD9E3', '#F7A8BE'],   /* çəhrayı */
    ['#F6E7D8', '#E8CBA8'],   /* bej */
    ['#DFF1E7', '#B7DDC9'],   /* yaşıl */
    ['#E6E0F2', '#C6B9E0'],   /* bənövşəyi */
    ['#FDE6D3', '#F5C69C'],   /* narıncı */
    ['#DCE9F7', '#AFCCEA'],   /* mavi */
    ['#F7E1E1', '#E9B5B5'],   /* qırmızımtıl */
    ['#EFEAE2', '#D6CCBC'],   /* qum */
  ];

  var COLOR_WORDS = {
    qirmizi: 0, cehrayi: 0, pembe: 0, rose: 0, pink: 0, red: 6, al: 6,
    bej: 1, qum: 7, nude: 1, krem: 1, qehveyi: 1, brown: 1,
    yasil: 2, green: 2, nane: 2,
    benovseyi: 3, lilac: 3, purple: 3, siren: 3,
    narinci: 4, orange: 4, sari: 4, gold: 4, qizil: 4,
    mavi: 5, blue: 5, goy: 5,
    ag: 7, white: 7, boz: 7, gray: 7, qara: 7, black: 7
  };

  var GROUP_WORDS = {
    dodaq: 0, pomada: 0, lipstick: 0, ruj: 0,
    pudra: 1, ton: 1, fondotan: 1, uz: 1,
    krem: 2, bede: 2, el: 2, saglamliq: 2,
    dirnaq: 3, lak: 3, manikur: 3,
    sac: 4, sampun: 4,
    goz: 5, kirpik: 5, tus: 5,
    etir: 6, parfum: 6, deo: 6
  };

  function tintOf(p) {
    var i = null, k;

    var c = norm(p && p.color);
    if (c) for (k in COLOR_WORDS) if (c.indexOf(k) !== -1) { i = COLOR_WORDS[k]; break; }

    if (i === null) {
      var g = norm((p && p.group) || '') + ' ' + norm((p && p.name) || '');
      for (k in GROUP_WORDS) if (g.indexOf(k) !== -1) { i = GROUP_WORDS[k]; break; }
    }

    if (i === null) {
      /* Sabit ton — eyni mal həmişə eyni rəngdə görünsün */
      var t = String((p && p.name) || ''), h = 0;
      for (var j = 0; j < t.length; j++) h = (h * 31 + t.charCodeAt(j)) % 9973;
      i = h % TINTS.length;
    }
    return TINTS[i];
  }

  function tintStyle(p) {
    var t = tintOf(p);
    return 'background:linear-gradient(160deg,' + t[0] + ',' + t[1] + ')';
  }

  /* Son 7 gündə əlavə olunub */
  function isNew(p) {
    var t = p && (p.createdAt || p.created);
    return !!(t && (Date.now() - t) < 7 * 864e5);
  }

  /* Xüsusiyyət kafeli */
  function spec(ic, label, val, mono) {
    if (val == null || val === '') return '';
    return '<div class="cc-spec">' +
      '<div class="l">' + ic + ' ' + esc(label) + '</div>' +
      '<div class="v' + (mono ? ' mono' : '') + '">' + esc(String(val)) + '</div></div>';
  }

  function field(label, val, mono) {
    if (val == null || val === '') return '';
    var v = String(val);
    return '<div class="cc-kv"><span>' + esc(label) + '</span>' +
      '<b' + (mono ? ' class="mono"' : '') + '>' + esc(v) + '</b></div>';
  }

  function wide() {
    try { return global.innerWidth >= 900; } catch (e) { return false; }
  }

  /* Barmaqla idarə olunan cihaz (sensor ekran) */
  function touch() {
    try {
      if (global.matchMedia && global.matchMedia('(pointer:coarse)').matches) return true;
      return (global.navigator && global.navigator.maxTouchPoints > 0);
    } catch (e) { return false; }
  }

  function paintSide(html) {
    side = html;
    var box = document.getElementById('ccSide');
    if (box) { box.innerHTML = html; flash(box); }
  }

  /* Yeni mal gələndə qısa parıltı — kassir dəyişikliyi görsün.
     Səs qəsdən yoxdur: kassada əsəbiləşdirir. */
  function flash(el) {
    try {
      el.classList.remove('cc-flash');
      void el.offsetWidth;
      el.classList.add('cc-flash');
      setTimeout(function () { try { el.classList.remove('cc-flash'); } catch (e) {} }, 450);
    } catch (e) {}
  }

  var bigPrice = false;   /* barkodla tapılanda qiymət nəhəng olur */

  /* Qiymət yoxdur, sıfırdır və ya gülünc kiçikdir — kassir bunu
     mütləq görməlidir */
  function suspectPrice(p) {
    var v = Number(p && p.price);
    return !(v > 0.02);
  }

  function showCard(p, viaScan) {
    bigPrice = !!viaScan;
    var I = IMG();
    var imgs = p.images || [];
    var bc = (p.barcodes || [])[0];
    var enc = bc ? BC.encode(bc) : { ok: false };

    var gaps = [];
    if (!bc) gaps.push('barkodsuz');
    if (!imgs.length) gaps.push('şəkilsiz');
    if (!p.price) gaps.push('qiymətsiz');

    var html =
      '<div class="cc-card cc-detail">' +
        (imgs.length && I && I.imgAttr
          ? '<div class="cc-shots">' + imgs.slice(0, 4).map(function (r) {
              var cloud = String(r).indexOf('http') === 0;
              return '<span class="cc-shot">' + '<img ' + I.imgAttr(r, true) + ' alt="">' +
                '<i class="cc-loc" title="' + (cloud ? 'serverdə saxlanılır' : 'yalnız bu cihazda') +
                '">' + (cloud ? '☁️' : '📱') + '</i></span>';
            }).join('') + '</div>'
          : '<div class="cc-noimg" style="' + tintStyle(p) + '">📦</div>') +

        /* ★ INTEX kataloqundan götürülən görünüş: nişan çipləri,
           sarı işıqlı qiymət, xüsusiyyət kafelləri */
        '<div class="cc-chips">' +
          (isNew(p) ? '<span class="cc-chip new">YENİ</span>' : '') +
          (p.brand ? '<span class="cc-chip">' + esc(p.brand) + '</span>' : '') +
          (p.group ? '<span class="cc-chip">' + esc(p.group) + '</span>' : '') +
          (p.supplier ? '<span class="cc-chip soft">' + esc(p.supplier) + '</span>' : '') +
        '</div>' +
        '<div class="cc-title">' + esc(p.name || 'Adsız') + '</div>' +
        (p.code || (p.barcodes || [])[0]
          ? '<div class="cc-code">Kod: <b>' +
            esc(p.code || String((p.barcodes || [])[0]).slice(-6)) + '</b></div>' : '') +
        /* ★ Kassada ən təhlükəli səhv — qiyməti olmayan malı
           normal kimi göstərmək. Ona görə açıq xəbərdarlıq. */
        (suspectPrice(p)
          ? '<div class="cc-pwarn">⚠️ QİYMƏT TƏYİN EDİLMƏYİB</div>'
          : '<div class="cc-price' + (bigPrice ? ' huge' : '') + '">' +
            esc(String(p.price)) + ' <span>₼</span></div>') +
        (gaps.length && !isWorker()
          ? '<div class="cc-gaps">⚠️ ' + gaps.join(' · ') + '</div>' : '') +

        /* ★ Xüsusiyyət kafelləri — INTEX-dəki Ölçü/Su Tutumu kimi */
        '<div class="cc-specs">' +
          spec('▣', 'Barkod', (p.barcodes || [])[0], true) +
          spec('🏷', 'Firma', p.brand) +
          spec('📦', 'Qrup', p.group) +
          spec('🚚', 'Tədarükçü', p.supplier) +
          spec('📍', 'Yer', p.location) +
          spec('🎨', 'Rəng', p.color) +
        '</div>' +
        (p.note ? '<div class="cc-note-box">' + esc(p.note) + '</div>' : '') +
        ((p.barcodes || []).length > 1
          ? '<div class="cc-specs">' + (p.barcodes || []).slice(1).map(function (b2) {
              return spec('▣', 'Barkod', b2, true);
            }).join('') + '</div>' : '') +

        /* ★ BARKOD DÜYMƏSİ — 1C üçün yeganə lazım olan şey.
           Toxunanda kopyalanır, sürükləyib 1C-yə aparmaq da olur. */
        (bc ? '<div class="cc-copybar">' +
            '<button class="cc-copybtn" draggable="true" data-v="' + esc(bc) + '" ' +
              'onclick="JollyCC.grab(this)" ondragstart="JollyCC.drag(event,this)" ' +
              'title="toxun — kopyalanır · sürüklə — 1C-yə apar">' +
              '<i class="ic">⧉</i>' +
              '<span class="num">' + esc(bc) + '</span>' +
              '<span class="lab">barkodu kopyala</span>' +
            '</button>' +
            /* Esqin əvvəl "ancaq barkod" demişdi, sonra tam sətir
               istədi — ikisini də saxlayırıq, seçim onundur */
            '<button class="cc-copyrow" draggable="true" ' +
              'data-v="' + esc(rowText(p)) + '" ' +
              'onclick="JollyCC.grab(this)" ondragstart="JollyCC.drag(event,this)">' +
              '⧉ ad | barkod | qiymət</button>' +
            ((p.barcodes || []).length > 1
              ? '<div class="cc-more">' + (p.barcodes || []).slice(1).map(function (b2) {
                  return '<button class="cc-copymini" draggable="true" data-v="' + esc(b2) + '" ' +
                    'onclick="JollyCC.grab(this)" ondragstart="JollyCC.drag(event,this)">⧉ ' +
                    esc(b2) + '</button>';
                }).join('') + '</div>' : '') +
          '</div>' : '') +

        (enc.ok ? '<div class="cc-bc" onclick="JollyCC.zoom(\'' + esc(bc) + '\')" ' +
          'title="böyütmək üçün toxun">' + BC.svg(enc.bits) +
          '<div class="cc-bcn">' + esc(bc) + '</div></div>' : '') +

        /* ★ Kassirdə admin əməliyyatları YOXDUR: göndərmə, şəkil,
           mətn, tam kart — heç biri. Yalnız barkodu görmək və
           kopyalamaq. Silmə/redaktə/səbət onsuz da bu faylda yoxdur. */
        (isWorker()
          ? (bc ? '<div class="cc-row">' +
                '<button class="cc-btn cc-pri" onclick="JollyCC.kassa(\'' + esc(bc) + '\')">' +
                  '🧾 Barkodu böyüt</button></div>' : '')
          : '<div class="cc-row">' +
              '<button class="cc-btn cc-pri" onclick="JollyCC.share(\'' + p.id + '\')">📤 Göndər</button>' +
              '<button class="cc-btn" onclick="JollyCC.photo(\'' + p.id + '\')">📷 Şəkil</button>' +
            '</div>' +
            '<div class="cc-row">' +
              (bc ? '<button class="cc-btn" onclick="JollyCC.kassa(\'' + esc(bc) + '\')">🧾 Kassa</button>' : '') +
              '<button class="cc-btn" onclick="JollyCC.text(\'' + p.id + '\')">📋 Mətn</button>' +
              '<button class="cc-btn" onclick="JollyCC.full(\'' + p.id + '\')">↗ Tam kart</button>' +
            '</div>' +
            '<div class="cc-p" style="margin-top:9px">' +
              'Dəyişiklik üçün <b>↗ Tam kart</b> — orada icazə qaydaları işləyir.' +
            '</div>') +
      '</div>';

    /* Geniş ekranda kart SAĞDA açılır — nəticələr solda qalır,
       yəni siyahını itirmədən mala baxmaq olur */
    if (wide()) paintSide(html);
    else paint(html);
  }

  /* ══════════════════════════════════════════════════════════
     ☁️ ŞƏKLİ SERVERƏ QOYMAQ
     ──────────────────────────────────────────────────────────
     Esqin: "şəkillər məsələsi düz deyil... Kodsuz Mehsullar
     bundan daha yaxşı şəkil saxlayır."

     Doğrudur: JOLLY şəkli cihazın öz brauzerində (IndexedDB)
     saxlayır — yaddaş dolanda, brauzer təmizlənəndə, cihaz
     dəyişəndə itir. Kodsuz Mehsullar isə R2-də, serverdə saxlayır.

     İndi JOLLY də ora qoyur. Nəticə `https://…/api/img/<açar>`
     olur; `storage.js:392` belə ünvanı BİRBAŞA göstərir, yəni
     nüvəyə toxunmağa ehtiyac yoxdur.

     Server əlçatan deyilsə köhnə yol işləyir — şəkil itmir.
     ══════════════════════════════════════════════════════════ */
  /* ★ 2026-08-19: JOLLY-nin ÖZ serveri quruldu (D1 + R2).
     Şəkil artıq başqa proqrama yox, öz ünvanımıza gedir. */
  var IMG_URL_KEY = 'jolly_img_url';
  var IMG_DEFAULT = '/api/img';

  function imgEndpoint() {
    try { return localStorage.getItem(IMG_URL_KEY) || IMG_DEFAULT; }
    catch (e) { return IMG_DEFAULT; }
  }

  function uploadToCloud(file) {
    if (!global.fetch || !global.navigator || navigator.onLine === false) {
      return Promise.resolve(null);
    }
    var ctrl = null, timer = null;
    try { ctrl = new AbortController(); } catch (e) {}
    var opt = {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
      body: file
    };
    if (ctrl) {
      opt.signal = ctrl.signal;
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 25000);
    }
    return fetch(imgEndpoint(), opt)
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        if (timer) clearTimeout(timer);
        return (j && j.ok && j.url) ? j.url : null;
      })
      .catch(function () { if (timer) clearTimeout(timer); return null; });
  }

  /* 📷 Tapılmış mala şəkil əlavə etmək — ekrandan çıxmadan */
  function addPhoto(id) {
    var inp = document.getElementById('ccPhoto');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.id = 'ccPhoto'; inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    inp.onchange = function () {
      var f = (inp.files || [])[0];
      inp.value = '';
      if (!f) return;
      var I = IMG(), P = (DB() || {}).Products;
      if (!P || !P.update) { toast('Baza əlçatan deyil', 'error'); return; }
      busy('☁️ şəkil serverə yüklənir…');

      /* ★ ƏSL SƏBƏB (2026-08-19): yaddaş dolanda `db.js write()`
         false qaytarır, amma `Products.update()` yenə də qeyd
         qaytarır — ona görə "şəkil əlavə olundu" yazılırdı,
         əslində isə SAXLANILMIRDI. İndi yazandan sonra bazadan
         GERİ OXUYURUQ və həqiqəti deyirik. */
      var attach = function (ref, where) {
        /* Yer azdırsa əvvəlcədən təmizləyirik */
        var S = G('JollySpace');
        if (S && S.check) { try { S.check(true); } catch (e) {} }

        var p = findProduct(id);
        var list = ((p && p.images) || []).concat([ref]);
        P.update(id, { images: list });

        /* Doğrudan yazıldımı — yoxlayırıq */
        var np = findProduct(id);
        var saved = !!(np && (np.images || []).indexOf(ref) !== -1);

        if (!saved) {
          var mb = (S && S.mb) ? S.mb() : '?';
          paint('<div class="cc-alert">' +
            '<div class="cc-atitle">❌ ŞƏKİL SAXLANILMADI</div>' +
            '<div class="cc-asub">Yaddaş dolub (' + esc(mb) + ' MB). ' +
              'Şəkil ekranda göründü, amma bazaya yazılmadı — ona görə itir.<br><br>' +
              'Diaqnostika → <b>🛠 Təhlükəsiz düzəlt</b> ilə köhnə arxivləri sil, ' +
              'sonra yenidən çək.</div>' +
            '<div class="cc-row" style="margin-top:14px">' +
              '<button class="cc-btn cc-pri" onclick="JollyCC.freeSpace()">🧹 İndi təmizlə</button>' +
              '<button class="cc-btn" onclick="JollyCC.cancel()">Bağla</button>' +
            '</div></div>');
          return;
        }

        toast('📷 şəkil əlavə olundu' + (where ? ' (' + where + ')' : ''), 'ok');
        ctxProduct = np;
        showCard(np);
      };

      /* 1) Əvvəl öz serverimizə — orada itmir və yer tutmur */
      var C2 = G('JollyCloud2');
      var first = (C2 && C2.uploadImage) ? C2.uploadImage(f) : uploadToCloud(f);
      Promise.resolve(first).then(function (url) {
        if (url) return url;
        return uploadToCloud(f);      /* ehtiyat: köhnə körpü */
      }).then(function (url) {
        if (url) { attach(url, 'serverdə'); return; }

        /* 2) Alınmasa cihaza — köhnə yol, şəkil yenə itmir */
        if (!I || !I.saveImage) throw new Error('yaddaş modulu yoxdur');
        busy('şəkil cihaza yazılır…');
        var fr = new FileReader();
        fr.onload = function () {
          Promise.resolve(I.saveImage(fr.result)).then(function (ref) {
            if (!ref) throw new Error('boş nəticə');
            attach(ref, 'cihazda');
          }).catch(function (e) {
            paint('<div class="cc-card cc-warn"><div class="cc-h">Şəkil alınmadı</div>' +
              '<div class="cc-p">' + esc(e && e.message) + '</div></div>');
          });
        };
        fr.readAsDataURL(f);
      }).catch(function (e) {
        paint('<div class="cc-card cc-warn"><div class="cc-h">Şəkil alınmadı</div>' +
          '<div class="cc-p">' + esc(e && e.message) + '</div></div>');
      });
    };
    inp.click();
  }

  /* ══════════════════════════════════════════════════════════
     📷 Skan · 🎙️ Səs
     ══════════════════════════════════════════════════════════ */
  function scan() {
    var S = G('JollyScanner') || G('JollyScan');
    if (S && S.start) { try { S.start(function (code) { setInput(code); submit(code); }); return; } catch (e) {} }
    /* Nüvə skaneri əlçatan deyilsə köhnə ekrana yönləndiririk */
    go('#/scan');
  }

  var rec = null;
  function voice() {
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!SR) { toast('Bu brauzer səsli girişi dəstəkləmir', 'error'); return; }
    try {
      if (rec) { try { rec.stop(); } catch (e) {} rec = null; return; }
      rec = new SR();
      rec.lang = 'az-AZ';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      busy('🎙️ dinlənilir…');
      rec.onresult = function (ev) {
        var t = '';
        try { t = ev.results[0][0].transcript; } catch (e) {}
        rec = null;
        if (t) { setInput(t); submit(t); } else paint('');
      };
      rec.onerror = function () { rec = null; paint('<div class="cc-note">Səs tanınmadı</div>'); };
      rec.onend = function () { rec = null; };
      rec.start();
    } catch (e) { rec = null; toast('Səsli giriş açılmadı', 'error'); }
  }

  /* ══════════════════════════════════════════════════════════
     🖥 KASSAYA QURAŞDIRMAQ (PWA)
     ──────────────────────────────────────────────────────────
     Esqin: "kassada ayrıca proqram kimi açılsın, brauzer
     zolaqları olmasın".

     Brauzer quraşdırma təklifini bir dəfə hazırlayır və onu
     tutmasan itir. Ona görə tutub saxlayırıq, düymə isə yalnız
     həqiqətən mümkün olanda görünür.

     Manifestdə `orientation` "portrait"dən "any"-yə dəyişdirildi —
     əks halda kassa ekranında şaquli rejimə kilidlənirdi.
     ══════════════════════════════════════════════════════════ */
  var installEvt = null;

  function installed() {
    try {
      if (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) return true;
      return !!(global.navigator && global.navigator.standalone);
    } catch (e) { return false; }
  }

  global.addEventListener('beforeinstallprompt', function (e) {
    try { e.preventDefault(); } catch (er) {}
    installEvt = e;
    var b = document.getElementById('ccInstall');
    if (b) b.style.display = '';
  });

  global.addEventListener('appinstalled', function () {
    installEvt = null;
    var b = document.getElementById('ccInstall');
    if (b) b.style.display = 'none';
    toast('✅ JOLLY quraşdırıldı', 'ok');
  });

  function doInstall() {
    if (!installEvt) {
      paint('<div class="cc-card cc-warn">' +
        '<div class="cc-h">Quraşdırma təklifi hazır deyil</div>' +
        '<div class="cc-p">Chrome-da ünvan sətrinin sağındakı <b>⊕</b> nişanına bas, ' +
        'ya da menyu → <b>Quraşdır</b>. Bəzən səhifəni bir neçə dəfə açandan sonra çıxır. ' +
        'Quraşdırıldıqdan sonra JOLLY ayrıca pəncərədə, brauzer zolaqları olmadan açılacaq.</div>' +
        '</div>');
      return;
    }
    try {
      installEvt.prompt();
      Promise.resolve(installEvt.userChoice).then(function (r) {
        if (r && r.outcome === 'accepted') toast('✅ quraşdırılır…', 'ok');
        installEvt = null;
      }).catch(function () { installEvt = null; });
    } catch (e) { installEvt = null; }
  }

  function installBtn() {
    if (installed()) return '';
    return '<button class="cc-btn" id="ccInstall" ' +
      (installEvt ? '' : 'style="display:none" ') +
      'onclick="JollyCC.install()">🖥 Kassaya quraşdır</button>';
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  function css() {
    if (document.getElementById('cc-css')) return;
    var st = document.createElement('style');
    st.id = 'cc-css';
    st.textContent = [
      '.cc-wrap{padding-bottom:30px}',
      '.cc-bar{display:flex;gap:8px;align-items:center;margin-bottom:10px}',
      '.cc-in{flex:1;padding:15px 16px;border-radius:15px;font-size:15px;color:inherit;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16)}',
      '.cc-in:focus{outline:none;border-color:rgba(74,222,128,.5);',
      'background:rgba(255,255,255,.1)}',
      '.cc-ic{width:50px;height:50px;flex:none;border-radius:15px;cursor:pointer;font-size:20px;',
      'display:flex;align-items:center;justify-content:center;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}',
      '.cc-ic:active{background:rgba(255,255,255,.15)}',
      '.cc-ic.cc-go{background:linear-gradient(135deg,#2ee6a8,#3b82f6);color:#04240f;border:none;',
      'font-size:18px}',
      '.cc-hint{font-size:11.5px;opacity:.5;line-height:1.6;margin-bottom:12px}',
      '.cc-pills{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}',
      '.cc-pill{padding:7px 13px;border-radius:16px;font-size:12.5px;cursor:pointer;',
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}',
      '.cc-pill:active{background:rgba(255,255,255,.14)}',
      '.cc-note{font-size:12.5px;opacity:.7;padding:9px 2px}',
      '.cc-undo{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:13px;',
      'margin-bottom:10px;font-size:12.5px;background:rgba(147,197,253,.12);',
      'border:1px solid rgba(147,197,253,.3)}',
      '.cc-undo span{flex:1}',
      '.cc-card{border-radius:16px;padding:15px;margin-bottom:10px;',
      'background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1)}',
      '.cc-card.cc-ok{border-color:rgba(74,222,128,.35);background:rgba(74,222,128,.07)}',
      '.cc-card.cc-warn{border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.06)}',
      '.cc-card.cc-ai{border-color:rgba(147,197,253,.35);background:rgba(147,197,253,.08)}',
      '.cc-h{font-size:15px;font-weight:700;margin-bottom:7px}',
      '.cc-p{font-size:12.5px;opacity:.7;line-height:1.55}',
      '.cc-ans{font-size:14px;line-height:1.6;margin:4px 0 8px}',
      '.cc-f{display:flex;align-items:center;gap:10px;margin:8px 0}',
      '.cc-f span{font-size:12px;opacity:.6;width:62px;flex:none}',
      '.cc-f input{flex:1;padding:11px 13px;border-radius:12px;font-size:14px;color:inherit;',
      'background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.14)}',
      '.cc-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}',
      '.cc-btn{flex:1;min-width:120px;padding:12px;border-radius:13px;font-size:13.5px;',
      'font-weight:600;cursor:pointer;color:inherit;',
      'background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)}',
      '.cc-btn.cc-pri{background:linear-gradient(135deg,#2ee6a8,#3b82f6);color:#04240f;border:none}',
      '.cc-btn:active{transform:scale(.98)}',
      '.cc-bc{background:#fff;border-radius:12px;padding:11px;margin:10px 0}',
      '.cc-bc>svg{height:78px}',
      '.cc-bcn{font-family:ui-monospace,monospace;font-size:12px;color:#000;text-align:center;',
      'letter-spacing:.12em;margin-top:5px}',
      '.cc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '@media (min-width:620px) and (max-width:899px){',
        '.cc-grid,.cc-gal{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '}',
      '.cc-cell{border-radius:14px;padding:10px;cursor:pointer;',
      'background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}',
      '.cc-cell img,.cc-ph{width:100%;height:112px;border-radius:11px;object-fit:cover;',
      'background:rgba(255,255,255,.06);display:block}',
      '.cc-ph{display:flex;align-items:center;justify-content:center;font-size:32px}',
      /* ★ Uzun ad artıq kəsilmir, iki sətirdə yerləşir —
         şəkildə "STRALEKS KUSACKA Professional..." bütün eni tuturdu */
      '.cc-nm{font-size:12.5px;font-weight:600;margin-top:7px;line-height:1.35;',
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;',
      'overflow:hidden;word-break:break-word;min-height:2.7em}',
      '.cc-title{overflow-wrap:anywhere}',
      '.cc-pr{font-size:12px;opacity:.6;margin-top:2px}',
      '.cc-acts{display:flex;gap:5px;margin-top:8px}',
      '.cc-act{flex:1;padding:8px 0;border-radius:10px;font-size:14px;cursor:pointer;',
      'color:inherit;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13)}',
      '.cc-act:active{background:rgba(255,255,255,.18)}',
      /* ── daxili məhsul kartı ── */
      '.cc-detail{padding:0;overflow:hidden}',
      '.cc-shots{display:flex;gap:2px;background:rgba(0,0,0,.3)}',
      '.cc-shot{flex:1;min-width:0;position:relative;display:block}',
      '.cc-worker .cc-shots img{height:120px}',
      '.cc-shots img{width:100%;height:170px;object-fit:cover;display:block}',
      '.cc-loc{position:absolute;left:6px;bottom:6px;font-size:11px;font-style:normal;',
      'background:rgba(0,0,0,.55);border-radius:7px;padding:2px 5px}',
      '.cc-noimg{height:96px;display:flex;align-items:center;justify-content:center;',
      'opacity:.4;font-size:13px;background:rgba(255,255,255,.03)}',
      '.cc-title{font-size:17px;font-weight:800;padding:14px 15px 0;line-height:1.3}',
      '.cc-big{font-size:30px;font-weight:800;color:#2ee6a8;padding:6px 15px 0}',
      '.cc-big small{font-size:14px;opacity:.65}',
      '.cc-gaps{margin:9px 15px 0;padding:7px 11px;border-radius:10px;font-size:11.5px;',
      'background:rgba(251,191,36,.13);border:1px solid rgba(251,191,36,.3);color:#fbbf24}',
      '.cc-kvs{padding:10px 15px 0}',
      '.cc-kv{display:flex;gap:10px;padding:6px 0;font-size:12.5px;',
      'border-bottom:1px solid rgba(255,255,255,.05)}',
      '.cc-kv span{opacity:.55;width:82px;flex:none}',
      '.cc-kv b{flex:1;min-width:0;word-break:break-word;font-weight:600}',
      '.cc-cp{cursor:copy;position:relative;border-radius:7px;padding:2px 5px;margin:-2px -5px;',
      'transition:background .15s}',
      '.cc-cp:hover{background:rgba(255,255,255,.09)}',
      '.cc-cp:active{background:rgba(74,222,128,.2)}',
      '.cc-cp.mono{font-family:ui-monospace,monospace;letter-spacing:.06em}',
      '.cc-cp.cc-copied{background:rgba(74,222,128,.28)}',
      '.cc-cpi{font-style:normal;opacity:.3;font-size:11px;margin-left:6px}',
      '.cc-bcn.cc-cp{cursor:copy}',
      '.cc-bcn.cc-cp:hover{background:rgba(0,0,0,.08)}',
      '.cc-bcn.cc-copied{background:rgba(74,222,128,.35)}',
      '.cc-detail .cc-bc{margin:12px 15px}',
      '.cc-detail .cc-row{padding:0 15px}',
      '.cc-detail .cc-row:last-of-type{padding-bottom:4px}',
      '.cc-detail .cc-p{padding:0 15px 15px}',
      /* ── nəticə xanası ── */
      '.cc-cell{position:relative}',
      '.cc-miss{position:absolute;top:16px;right:16px;font-size:10px;letter-spacing:2px;',
      'background:rgba(0,0,0,.55);padding:3px 7px;border-radius:8px}',
      '.cc-bcx{font-family:ui-monospace,monospace;opacity:.5;margin-left:6px;font-size:11px}',
      /* ── boş ekran ── */
      '.cc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:14px}',
      '.cc-stat{border-radius:13px;padding:11px 4px;text-align:center;cursor:pointer;',
      'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}',
      '.cc-stat.bad{border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.08)}',
      '.cc-stat b{display:block;font-size:19px;font-weight:800}',
      '.cc-stat span{display:block;font-size:10px;opacity:.6;margin-top:3px}',
      '.cc-sec{font-size:11px;letter-spacing:.07em;opacity:.45;margin:16px 0 8px;',
      'text-transform:uppercase}',
      '.cc-brow{display:flex;align-items:center;gap:6px;margin:7px 0}',
      '.cc-bn{font-size:11px;opacity:.45;width:16px;flex:none}',
      '.cc-brow input{flex:1;min-width:0;padding:9px 11px;border-radius:10px;font-size:13px;',
      'color:inherit;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.13)}',
      '.cc-brow input.cc-bp{flex:none;width:70px;text-align:center}',
      /* ══ GENİŞ EKRAN (kassa kompüteri) ══════════════════════
         Esqin: "kassada kompüterdə bir az çətin gəlir işləmək —
         ekranın sağ tərəfi boş qalır". Telefonda heç nə dəyişmir;
         900 pikseldən enli ekranda iki sütun açılır:
         solda axtarış və nəticələr, sağda seçilən malın kartı. */
      /* ★ 2026-08-23: Esqin kompüterdə çəkdiyi şəkildə göründü ki,
         kartlar bərabər deyil — biri bütün eni tutur, sağdakı panel
         kəsilir. Səbəb: sabit 420px sütun və `repeat(4,1fr)` dar
         ekranda sığmırdı. İndi ölçüyə görə özü uyğunlaşır. */
      '@media (min-width:900px){',
        '.cc-wrap{max-width:1500px;margin:0 auto;padding-left:6px;padding-right:6px}',
        '.cc-in{font-size:17px;padding:17px 18px}',
        '.cc-ic{width:54px;height:54px}',
        /* sağ sütun sıxıla bilir — kəsilmir */
        '.cc-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);',
        'gap:16px;align-items:start}',
        '.cc-left{min-width:0}',                 /* uzun ad şəbəkəni dağıtmasın */
        '.cc-right{position:sticky;top:14px;min-width:0}',
        /* kafellər bərabər olur, sayı enə görə özü seçilir */
        /* ★ Esqin: "yana-yana 4 məhsul dursun" — dəqiq dörd sütun */
        '.cc-grid{grid-template-columns:repeat(4,minmax(0,1fr))}',
        '.cc-gal{grid-template-columns:repeat(4,minmax(0,1fr))}',
        '.cc-specs{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}',
        '.cc-stats{grid-template-columns:repeat(4,1fr)}',
        '.cc-cell img,.cc-ph{height:130px}',
        '.cc-shots img{height:210px}',
        '.cc-hint{font-size:12.5px}',
        '.cc-empty{display:flex;align-items:center;justify-content:center;height:260px;',
          'border-radius:16px;opacity:.35;font-size:13px;text-align:center;',
          'border:1px dashed rgba(255,255,255,.15)}',
      '}',
      /* Çox enli ekranda üç sütun — boş yer qalmasın */
      '@media (min-width:1500px){',
        '.cc-split{grid-template-columns:minmax(0,1fr) 400px}',
        '.cc-grid{grid-template-columns:repeat(4,minmax(0,1fr))}',
      '}',
      '@media (max-width:899px){ .cc-right{display:none} .cc-empty{display:none} }',

      /* ══ SENSOR EKRANLI KASSA KOMPÜTERİ ═══════════════════════
         Esqin: kassadakı kompüter SENSOR ekrandır; barmaq,
         klaviatura və skaner — üçü də var.
         Geniş ekranda düymələri kiçiltmək olmaz: barmaq üçün ən
         azı 48 piksel lazımdır. `pointer: coarse` məhz barmaqla
         idarə olunan cihazı bildirir — siçanlı kompüterə təsir
         etmir. */
      '@media (min-width:900px) and (pointer:coarse){',
        '.cc-in{font-size:19px;padding:20px 20px}',
        '.cc-ic{width:64px;height:64px;font-size:24px;border-radius:17px}',
        '.cc-grid{grid-template-columns:repeat(3,1fr);gap:14px}',
        '.cc-cell{padding:13px}',
        '.cc-cell img,.cc-ph{height:150px}',
        '.cc-nm{font-size:14.5px}',
        '.cc-pr{font-size:13.5px}',
        '.cc-act{padding:14px 0;font-size:17px;border-radius:12px}',
        '.cc-btn{padding:16px;font-size:15px;min-width:150px;border-radius:14px}',
        '.cc-pill{padding:12px 18px;font-size:14px;border-radius:20px}',
        '.cc-stat{padding:16px 6px}',
        '.cc-stat b{font-size:23px}',
        '.cc-stat span{font-size:12px}',
        '.cc-kv{padding:10px 0;font-size:14px}',
        '.cc-title{font-size:20px}',
        '.cc-big{font-size:36px}',
        '.cc-brow input{padding:14px 13px;font-size:15px}',
        '.cc-act,.cc-btn,.cc-pill,.cc-cell,.cc-stat{min-height:48px}',
        '.cc-copybtn{padding:19px 18px}',
        '.cc-copybtn .num{font-size:22px}',
        '.cc-hrow{padding:15px 14px;font-size:14.5px}',
        '.cc-big.huge{font-size:62px}',
        '.cc-price{font-size:40px}',
        '.cc-price.huge{font-size:66px}',
        '.cc-spec .v{font-size:16px}',
        '.cc-chip{font-size:13px;padding:7px 15px}',
        '.cc-tab{padding:16px 8px;font-size:15px}',
        '.cc-gcell img{height:180px}',
        '.cc-acode{font-size:36px}',
        '.cc-atitle{font-size:22px}',
        '.cc-pwarn{font-size:20px;padding:18px}',
      '}',
      /* ── barkod kopyalama düyməsi ── */
      '.cc-copybar{padding:12px 15px 0}',
      '.cc-copybtn{width:100%;display:flex;align-items:center;gap:11px;cursor:copy;',
      'padding:15px 16px;border-radius:14px;color:inherit;text-align:left;',
      'background:linear-gradient(135deg,rgba(46,230,168,.18),rgba(59,130,246,.18));',
      'border:1px solid rgba(46,230,168,.4)}',
      '.cc-copybtn:active{background:rgba(46,230,168,.34)}',
      '.cc-copybtn.cc-copied{background:rgba(74,222,128,.4)}',
      '.cc-copybtn .ic{font-style:normal;font-size:20px;flex:none;opacity:.8}',
      '.cc-copybtn .num{flex:1;min-width:0;font-family:ui-monospace,monospace;',
      'font-size:18px;letter-spacing:.09em;font-weight:700;word-break:break-all}',
      '.cc-copybtn .lab{font-size:10.5px;opacity:.55;flex:none;text-align:right;max-width:74px;',
      'line-height:1.3}',
      '.cc-more{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}',
      '.cc-copymini{padding:8px 12px;border-radius:10px;cursor:copy;color:inherit;',
      'font-family:ui-monospace,monospace;font-size:12.5px;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}',
      '.cc-copymini.cc-copied{background:rgba(74,222,128,.35)}',
      /* ── nəhəng qiymət (skanla gələndə) ── */
      '.cc-big.huge{font-size:52px;line-height:1.05}',
      '.cc-big.nop{font-size:15px;color:#fbbf24;opacity:.8}',
      '.cc-bc{cursor:zoom-in}',
      /* ── tam ekran barkod ── */
      '.cc-zoom{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);',
      'display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}',
      '.cc-zbox{background:#fff;border-radius:16px;padding:26px;width:100%;max-width:760px}',
      '.cc-zbox>svg{height:210px}',
      '.cc-zn{font-family:ui-monospace,monospace;font-size:26px;color:#000;text-align:center;',
      'letter-spacing:.2em;margin-top:14px;font-weight:700}',
      '.cc-zh{font-size:11px;color:#666;text-align:center;margin-top:8px}',
      /* ── skan tarixçəsi ── */
      '.cc-hist{border-radius:14px;overflow:hidden;',
      'border:1px solid rgba(255,255,255,.09)}',
      '.cc-hrow{display:flex;align-items:center;gap:9px;padding:11px 13px;cursor:pointer;',
      'font-size:13px;background:rgba(255,255,255,.035);',
      'border-bottom:1px solid rgba(255,255,255,.05)}',
      '.cc-hrow:active{background:rgba(255,255,255,.11)}',
      '.cc-hrow .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cc-hrow b{font-size:13px;color:#2ee6a8;flex:none}',
      '.cc-hrow i{font-family:ui-monospace,monospace;font-size:11px;opacity:.4;flex:none;',
      'font-style:normal}',
      /* ── böyük xəbərdarlıq ekranları ── */
      '.cc-alert{border-radius:18px;padding:24px 20px;margin-bottom:12px;text-align:center;',
      'background:rgba(248,113,113,.14);border:2px solid rgba(248,113,113,.5)}',
      '.cc-alert.bad{background:rgba(251,191,36,.14);border-color:rgba(251,191,36,.55)}',
      '.cc-atitle{font-size:19px;font-weight:800;letter-spacing:.04em;color:#fca5a5}',
      '.cc-alert.bad .cc-atitle{color:#fbbf24}',
      '.cc-acode{font-family:ui-monospace,monospace;font-size:30px;font-weight:800;',
      'letter-spacing:.13em;margin:14px 0 10px;word-break:break-all}',
      '.cc-asub{font-size:13px;opacity:.75;line-height:1.55}',
      '.cc-pwarn{margin:10px 15px 0;padding:14px;border-radius:13px;text-align:center;',
      'font-size:17px;font-weight:800;letter-spacing:.03em;color:#fbbf24;',
      'background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.45)}',
      /* ── yeni nəticə parıltısı ── */
      '.cc-flash{animation:ccflash .45s ease-out}',
      '@keyframes ccflash{0%{box-shadow:0 0 0 3px rgba(46,230,168,.55)}',
      '100%{box-shadow:0 0 0 0 rgba(46,230,168,0)}}',
      /* ── tam sətir kopyalama ── */
      '.cc-copyrow{width:100%;margin-top:7px;padding:11px;border-radius:11px;cursor:copy;',
      'color:inherit;font-size:12.5px;background:rgba(255,255,255,.06);',
      'border:1px solid rgba(255,255,255,.13)}',
      '.cc-copyrow.cc-copied{background:rgba(74,222,128,.32)}',
      /* ── tarixçədə seçilmiş sətir ── */
      '.cc-hrow.on{background:rgba(46,230,168,.18);',
      'box-shadow:inset 3px 0 0 #2ee6a8}',
      '.cc-hrow .t{font-size:10.5px;opacity:.4;font-style:normal;flex:none;',
      'font-family:ui-monospace,monospace}',
      '.cc-hrow b.no{opacity:.35;color:inherit}',
      '.cc-tabs{display:flex;gap:7px;margin-bottom:11px}',
      '.cc-tab{flex:1;text-align:center;padding:12px 6px;border-radius:13px;cursor:pointer;',
      'font-size:13px;font-weight:600;background:rgba(255,255,255,.05);',
      'border:1px solid rgba(255,255,255,.1)}',
      '.cc-tab.on{background:rgba(46,230,168,.16);border-color:rgba(46,230,168,.45);',
      'color:#2ee6a8}',
      '.cc-tab:active{background:rgba(255,255,255,.13)}',
      '.cc-gal{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}',
      '.cc-gcell{position:relative;border-radius:14px;overflow:hidden;cursor:pointer;',
      'background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}',
      '.cc-gcell img{width:100%;height:150px;object-fit:cover;display:block}',
      '.cc-gloc{position:absolute;left:7px;top:7px;font-size:12px;font-style:normal;',
      'background:rgba(0,0,0,.55);border-radius:8px;padding:2px 6px}',
      '.cc-gn{position:absolute;right:7px;top:7px;font-size:11px;font-style:normal;',
      'background:rgba(0,0,0,.6);border-radius:8px;padding:2px 7px}',
      '.cc-gt{padding:9px 10px;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;',
      'white-space:nowrap}',
      /* ══ INTEX kataloqundan götürülən görünüş ══ */
      /* nişan çipləri */
      '.cc-chips{display:flex;gap:6px;flex-wrap:wrap;padding:14px 15px 0}',
      '.cc-chip{font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:14px;',
      'background:rgba(56,189,248,.14);color:#7dd3fc;border:1px solid rgba(56,189,248,.3)}',
      '.cc-chip.new{background:rgba(46,230,168,.18);color:#2ee6a8;',
      'border-color:rgba(46,230,168,.45)}',
      '.cc-chip.soft{background:rgba(255,255,255,.06);color:inherit;opacity:.75;',
      'border-color:rgba(255,255,255,.12);font-weight:600}',
      /* sarı işıqlı qiymət */
      '.cc-price{font-size:34px;font-weight:800;padding:8px 15px 0;line-height:1;',
      'color:#fbbf24;text-shadow:0 0 22px rgba(251,191,36,.5);letter-spacing:-.5px}',
      '.cc-price span{font-size:16px;opacity:.75}',
      '.cc-price.huge{font-size:56px}',
      '.cc-code{font-size:12.5px;opacity:.55;padding:4px 15px 0}',
      '.cc-code b{font-family:ui-monospace,monospace;opacity:.9}',
      /* xüsusiyyət kafelləri */
      '.cc-specs{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:13px 15px 0}',
      '.cc-spec{border-radius:13px;padding:11px 12px;',
      'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}',
      '.cc-spec .l{font-size:11px;opacity:.5;margin-bottom:4px}',
      '.cc-spec .v{font-size:14.5px;font-weight:700;word-break:break-word}',
      '.cc-spec .v.mono{font-family:ui-monospace,monospace;letter-spacing:.04em;font-size:13.5px}',
      '.cc-note-box{margin:11px 15px 0;padding:11px 13px;border-radius:12px;font-size:12.5px;',
      'line-height:1.55;opacity:.75;background:rgba(255,255,255,.04);',
      'border:1px solid rgba(255,255,255,.08)}',
      /* nəticə kafelində sarı qiymət və YENİ nişanı */
      '.cc-py{color:#fbbf24;text-shadow:0 0 12px rgba(251,191,36,.35)}',
      '.cc-newtag{position:absolute;left:16px;top:16px;font-style:normal;font-size:10px;',
      'font-weight:800;letter-spacing:.06em;padding:3px 9px;border-radius:9px;',
      'background:rgba(46,230,168,.9);color:#04240f}',
      /* rəngli statistika kafelləri */
      '.cc-stat i{display:block;font-size:19px;font-style:normal;margin-bottom:2px;opacity:.85}',
      '.cc-stat b{font-size:26px;line-height:1.1}',
      /* ── barkod qovluğu ── */
      '.cc-folder{border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.09)}',
      '.cc-frow{display:flex;align-items:center;gap:7px;padding:9px 10px;',
      'background:rgba(255,255,255,.035);border-bottom:1px solid rgba(255,255,255,.05)}',
      '.cc-frow.done{cursor:pointer;opacity:.62}',
      '.cc-frow.done:active{background:rgba(255,255,255,.1)}',
      '.cc-fcode{flex:1;min-width:0;text-align:left;cursor:copy;padding:9px 11px;',
      'border-radius:10px;color:inherit;font-family:ui-monospace,monospace;',
      'font-size:14px;font-weight:700;letter-spacing:.05em;',
      'background:rgba(46,230,168,.1);border:1px solid rgba(46,230,168,.3)}',
      '.cc-fcode.cc-copied{background:rgba(74,222,128,.4)}',
      '.cc-fcode2{flex:none;font-family:ui-monospace,monospace;font-size:12.5px;opacity:.6}',
      '.cc-flab{flex:1;min-width:0;font-size:12.5px;opacity:.7;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.cc-fnew{background:rgba(46,230,168,.18) !important;',
      'border-color:rgba(46,230,168,.4) !important}',
      '.cc-bar2{height:7px;border-radius:5px;margin-top:10px;overflow:hidden;',
      'background:rgba(255,255,255,.1)}',
      '.cc-bar2 i{display:block;height:100%;background:#2ee6a8;border-radius:5px}',
      /* Klaviatura açıqkən ipucu və çiplər gizlənir — nəticə görünsün */
      '.cc-wrap.cc-kb .cc-hint,.cc-wrap.cc-kb .cc-pills{display:none}',
      '.cc-wrap.cc-kb .cc-tabs{margin-bottom:7px}',
      '.cc-spin{display:inline-block;width:12px;height:12px;border-radius:50%;',
      'border:2px solid rgba(255,255,255,.25);border-top-color:#4ade80;',
      'animation:ccspin .7s linear infinite;vertical-align:-1px;margin-right:6px}',
      '@keyframes ccspin{to{transform:rotate(360deg)}}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  /* ★ Boş ekran daha faydalı: mağazanın vəziyyəti bir baxışda,
     altında son əlavə edilən mallar şəkilləri ilə. Əvvəl burada
     yalnız ipucu yazısı var idi — heç bir dəyər vermirdi. */
  function snapshot() {
    var l = products();
    if (!l.length) return '';
    var noBc = 0, noImg = 0, noPrice = 0;
    for (var i = 0; i < l.length; i++) {
      var p = l[i] || {};
      if (!(p.barcodes || []).length) noBc++;
      if (!(p.images || []).length) noImg++;
      if (!p.price) noPrice++;
    }
    var cell = function (ic, n, lab, q, color) {
      return '<div class="cc-stat" ' +
        (q ? 'onclick="JollyCC.run(\'' + esc(q) + '\')"' : '') + '>' +
        '<i>' + ic + '</i>' +
        '<b style="color:' + color + '">' + n + '</b>' +
        '<span>' + lab + '</span></div>';
    };
    return '<div class="cc-stats">' +
      cell('📊', l.length, 'Ümumi', '', '#38bdf8') +
      cell('▣', noBc, 'Barkodsuz', 'barkodsuz mallar', noBc ? '#fb923c' : '#4ade80') +
      cell('📷', noImg, 'Şəkilsiz', 'şəkilsiz mallar', noImg ? '#f472b6' : '#4ade80') +
      cell('₼', noPrice, 'Qiymətsiz', 'qiyməti olmayanlar', noPrice ? '#fbbf24' : '#4ade80') +
      '</div>';
  }

  function lastAdded() {
    var l = products().slice();
    l.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    l = l.slice(0, 4);
    if (!l.length) return '';
    return '<div class="cc-sec">Son əlavə edilənlər</div>' + grid(l);
  }

  function render() {
    css();
    var r = recent();
    var pills = [];
    r.forEach(function (x) {
      pills.push('<span class="cc-pill" onclick="JollyCC.open(\'' + x.id + '\')">📦 ' +
        esc(String(x.name).slice(0, 22)) + '</span>');
    });
    /* ★ Kassirdə hazır AI sualları göstərilmir — işini yavaşladır.
       Yalnız son baxdığı mallar qalır ki, geri qayıda bilsin. */
    if (isWorker()) {
      pills = pills.slice(0, 3);
    }
    /* Cihazda qalan şəkil varsa xatırladırıq */
    if (!isWorker()) {
      var C3 = G('JollyCloud2');
      try {
        var lc = C3 && C3.localCount ? C3.localCount() : null;
        if (lc && lc.images) {
          pills.push('<span class="cc-pill" onclick="JollyCC.imgMove()">🖼 ' +
            lc.images + ' şəkil cihazdadır — köçür</span>');
        }
      } catch (e) {}
    }
    if (!isWorker() && genList().length) {
      pills.push('<span class="cc-pill" onclick="JollyCC.folder()">🗂 Barkod qovluğu (' +
        genList().length + ')</span>');
    }
    if (!isWorker()) {
      ['Mağazanın vəziyyəti', 'Bu ay nə əlavə etmişəm'].forEach(function (q) {
        pills.push('<span class="cc-pill" onclick="JollyCC.run(\'' + esc(q) + '\')">🧠 ' + esc(q) + '</span>');
      });
    }

    return '<div class="storeos cc-wrap' + (isWorker() ? ' cc-worker' : '') + '">' +
      '<div class="dash-head" style="display:flex;align-items:center;gap:10px"><div style="flex:1">' +
        '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">' +
          (isWorker() ? '📦 Məhsullar' : '🧠 JOLLY AI') + '</h2>' +
        '<div class="muted" style="font-size:12.5px;">' +
          (isWorker() ? 'axtar · şəkillər · sual ver' : 'bir xana — hər şey') +
          ' · v' + VER +
          (installed() ? ' · 🖥 quraşdırılıb' : '') + '</div>' +
      '</div>' +
      '<div style="flex:none;max-width:190px">' + installBtn() + '</div></div>' +

      tabs() +
      '<div class="cc-bar">' +
        '<input id="ccIn" class="cc-in" autocomplete="off" enterkeyhint="search" ' +
          'placeholder="Barkod, ad, sual və ya yeni mal…" ' +
          'oninput="JollyCC.typing(this.value)" ' +
          'onfocus="JollyCC.inFocus(1)" onblur="JollyCC.inFocus(0)" ' +
          'onkeydown="if(event.key===\'Enter\'){event.preventDefault();JollyCC.submit()}">' +
        /* ★ Göndər düyməsi — telefon klaviaturasında Enter həmişə
           işə düşmür, ona görə bu düymə şərtdir */
        '<div class="cc-ic cc-go" id="ccGo" style="opacity:.35" onclick="JollyCC.submit()">➤</div>' +
        '<div class="cc-ic" title="Klaviaturanı aç" onclick="JollyCC.kb()">⌨</div>' +
        '<div class="cc-ic" onclick="JollyCC.scan()">▣</div>' +
        '<div class="cc-ic" onclick="JollyCC.voice()">🎙️</div>' +
      '</div>' +

      '<div class="cc-hint">' +
        (isWorker()
          ? '<b>545</b> → barkodla tap · <b>corab</b> → adla tap · ' +
            '<b>F2</b> barkodu kopyala · <b>F3</b> son mal · <b>F1</b> xana'
          : '<b>545</b> → barkodu tapır, yoxdursa yaratmağı təklif edir · ' +
            '<b>corab 12 man no.545</b> → mal yazır (təsdiqlə) · ' +
            '<b>corab</b> → kataloqda axtarır · ' +
            'bir neçə sətir yapışdır → hamısı birdən yazılır · ' +
            '<b>F2</b> barkodu kopyala · <b>F3</b> son mal · <b>F1</b> xana · ' +
            '<b>neçə mal barkodsuzdur?</b> → süni zəka cavab verir') +
      '</div>' +

      '<div class="cc-pills">' + pills.join('') + '</div>' +
      '<div class="cc-split">' +
        '<div class="cc-left">' +
          (out || isWorker() ? '' : snapshot()) +
          '<div id="ccOut">' + out + '</div>' +
          (out ? '' : lastAdded()) +
        '</div>' +
        /* Sağ sütun yalnız geniş ekranda görünür */
        '<div class="cc-right">' +
          '<div id="ccSide">' + (side ||
            '<div class="cc-empty">Mala toxun —<br>kartı burada açılacaq</div>') + '</div>' +
          '<div id="ccHist">' + histHtml() + '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
  }

  function repaint() {
    var el = document.getElementById('main');
    if (el && onRoute()) {
      el.innerHTML = render();
      focusInput();
    }
  }
  /* ══════════════════════════════════════════════════════════
     ⌨️ SENSOR EKRANDA KLAVİATURA ÖZÜ AÇILMASIN
     ──────────────────────────────────────────────────────────
     Esqin: "axtarış xanası girən kimi aktiv olur, ekran bağlayır;
     şəklə keçən kimi klaviatura açılır, bağlayır, heç nə görünmür".

     SƏBƏB: ekran açılanda xanaya fokus verilirdi. Sensor ekranda
     fokus = ekran klaviaturası açılır və nəticələri örtür.

     İNDİ: sensor ekranda fokus ÖZÜ verilmir. Klaviatura yalnız
     istifadəçi xanaya toxunanda açılır.

     Skaner və fiziki klaviatura İŞLƏYİR — kimsə yazmağa
     başlayanda fokus özü qayıdır (scannerWatch), çünki o yazı
     onsuz da fiziki cihazdan gəlir.
     ══════════════════════════════════════════════════════════ */
  function focusInput(force) {
    if (!force && touch()) return;      /* sensor ekranda toxunmuruq */
    setTimeout(function () {
      var el = document.getElementById('ccIn');
      if (el) { try { el.focus(); } catch (e) {} }
    }, 120);
  }

  /* ══════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════ */
  global.JollyCC = {
    version: VER,
    render: render,
    detect: detect,
    parseProduct: parseProduct,
    submit: function (v) { submit(v); },
    run: function (q) { setInput(q); submit(q); },
    scan: scan,
    voice: voice,
    open: function (id) {
      var p = products().filter(function (x) { return x && x.id === id; })[0];
      if (p) openProduct(p); else go('#/product/' + id);
    },
    newWith: newWith,
    createFrom: function () {
      var p = parseProduct(lastInput);
      if (!p.name) p.name = lastInput;
      doCreate(p, lastInput);
    },
    ask: function () { doAsk(lastInput); },
    edit: function (k, v) { if (draft) draft[k] = v; },
    save: save,
    saveNoBc: saveNoBc,
    typing: typing,
    undo: doUndo,
    ctx: function () { return ctxProduct; },
    cancel: function () { draft = null; bulkRows = null; paint(''); paintSide(''); },
    bulkEdit: function (i, k, v) { if (bulkRows && bulkRows[i]) bulkRows[i][k] = v; },
    bulkDrop: function (i) { if (bulkRows) { bulkRows.splice(i, 1); paintBulk(); } },
    bulkSave: bulkSave,
    copy: function (t) {
      try { navigator.clipboard.writeText(String(t)); toast('📋 kopyalandı', 'ok'); }
      catch (e) { toast('kopyalanmadı', 'error'); }
    },
    barcode: BC,
    recent: recent,
    search: searchProducts,
    share: share,
    text: function (id) {
      var p = findProduct(id);
      if (p) { try { navigator.clipboard.writeText(productText(p)); toast('📋 kopyalandı', 'ok'); }
               catch (e) { toast('kopyalanmadı', 'error'); } }
    },
    kassa: function (code) { doMakeBarcode(code); },
    photo: addPhoto,
    grab: grab,
    drag: drag,
    grabText: function (t) {
      var fake = { getAttribute: function () { return t; },
                   classList: { add: function () {}, remove: function () {} } };
      grab(fake);
    },
    zoom: zoom,
    tint: tintOf,
    diag: diag,
    leftovers: visibleLeftovers,
    /* Klaviatura açılanda ekran daralır — nəticələri yuxarı çəkirik */
    inFocus: function (on) {
      try {
        var w = document.querySelector('.cc-wrap');
        if (!w) return;
        if (on) w.classList.add('cc-kb'); else w.classList.remove('cc-kb');
      } catch (e) {}
    },
    imgFail: function (el) {
      try {
        var d = document.createElement('div');
        d.className = 'cc-ph';
        d.textContent = '📦';
        if (el.parentNode) el.parentNode.replaceChild(d, el);
      } catch (e) {}
    },
    folder: doFolder,
    imgMove: function () { doImgMove(false); },
    imgMoveGo: function () { doImgMove(true); },
    folderAdd: function (c) {
      if (folderAdd(c)) { toast('🗂 qovluğa atıldı', 'ok'); doFolder(); }
      else toast('Qovluğa yazıla bilmədi', 'error');
    },
    folderDrop: function (c) {
      var l = genList().filter(function (g) { return String(g.code) !== String(c); });
      genSave(l); doFolder();
    },
    tab: setTab,
    kb: function () {
      var el = document.getElementById('ccIn');
      if (el) { try { el.focus(); } catch (e) {} }
    },
    copyBarcode: copyBarcode,
    isWorker: isWorker,
    setLock: function (on) {
      try { localStorage.setItem('jolly_cc_lock', on ? '1' : '0'); } catch (e) {}
    },
    takeCommand: takeCommand,
    freeSpace: function () {
      var S = G('JollySpace');
      if (!S) { toast('Yaddaş qoruyucusu yüklənməyib', 'error'); return; }
      var r = S.trimArchives();
      var mb = S.mb();
      if (r.freed) {
        paint('<div class="cc-card cc-ok"><div class="cc-h">🧹 Təmizləndi</div>' +
          '<div class="cc-p">' + Math.round(r.freed / 1024) + ' KB boşaldı · indi ' +
          esc(mb) + ' MB<br>Saxlanılan arxiv: ' + esc(r.kept || '—') +
          '<br><br>İndi şəkli yenidən çək.</div></div>');
      } else {
        paint('<div class="cc-card cc-warn"><div class="cc-h">Təmizləyəcək arxiv yoxdur</div>' +
          '<div class="cc-p">Yaddaş ' + esc(mb) + ' MB. Ən böyük açarları görmək üçün ' +
          'Diaqnostikanı işə sal.</div></div>');
      }
    },
    install: doInstall,
    installed: installed,
    hist: hist,
    clearHist: function () {
      try { localStorage.removeItem(HIST_KEY); } catch (e) {}
      repaint();
    },
    upload: uploadToCloud,
    imgEndpoint: imgEndpoint,
    setImgEndpoint: function (u) {
      try { localStorage.setItem(IMG_URL_KEY, String(u || '').trim() || IMG_DEFAULT); } catch (e) {}
    },
    card: function (id) { var p = findProduct(id); if (p) showCard(p); },
    full: function (id) {
      if (isWorker()) { toast('Bu, kassa rejimində yoxdur', 'error'); return; }
      go('#/product/' + id);
    },
    open2: null,
    ensure: function () { ensureScreen(); },
    wide: wide,
    touch: touch,
    keepFocus: keepFocus,
    routes: function () { return Object.keys(ALIASES); }
  };

  /* ══════════════════════════════════════════════════════════
     Açılış — ekran registrdən asılı olmadan açılır
     ══════════════════════════════════════════════════════════ */
  var MARK = 'data-cc-screen';

  function onRoute() {
    return !!ALIASES[String(global.location.hash || '').split('?')[0]];
  }

  /* ★ İŞÇİ KİLİDİ — "başqa heç nə görməməlidirlər".
     İşçi başqa ekrana getsə bura qaytarılır. Mal kartı istisnadır,
     çünki tapdığı malı açmalıdır. Admin toxunulmur.
     Söndürmək üçün: localStorage jolly_cc_lock = '0' */
  /* Kassir yalnız bu ekranda qalır — mal kartı da elə burada
     açılır, ayrıca səhifəyə keçmir */
  var FREE = /^#\/(cc|studios\/ai|ai)\b/;

  function lockOn() {
    try { return localStorage.getItem('jolly_cc_lock') !== '0'; } catch (e) { return true; }
  }

  /* ══════════════════════════════════════════════════════════
     ★★ TƏK SAHİB QAYDASI
     ──────────────────────────────────────────────────────────
     Esqin: "qarışır — köhnə icazə sistemi ilə yeni qurduğun
     dolaşdırır".

     Cihazda ÜÇ sistem eyni anda işçini idarə etməyə çalışırdı:
       1. `jolly-user-mode.js` — öz sadə iş masasını göstərir
          ("Kassa, xoş gəlmisən" + kartlar)
       2. `jolly-idare.js` — icazəsiz marşrutu bloklayır və
          "🔒 Bu bölməyə icazən yoxdur" yazır
       3. Bu fayl — işçini `#/cc`-yə qaytarır

     Nəticə: sonsuz gedişat və sönməyən qırmızı yazı.

     HƏLL: işçi üçün SAHİB bu fayldır. Digər ikisi susdurulur —
     silinmir, sadəcə işçi rejimində qarışmır. ADMİN-də hər ikisi
     əvvəlki kimi işləyir.
     ══════════════════════════════════════════════════════════ */
  /* ⚠️ Bir dəfəlik bayraq QOYULMUR: `jolly-idare.js` gec yüklənir,
     ilk çağırışda hələ olmaya bilər. Hər addım öz-özünü yoxlayır. */
  /* ══════════════════════════════════════════════════════════
     ★★★ KASSİR REJİMİ — TAM ƏVƏZLƏMƏ
     ──────────────────────────────────────────────────────────
     Esqin haqlı idi: "icazə sistemini təmiz ləğv edib bir rejim
     yaratmalısan... orada da silmə, redaktə, səbətə əlavə, WhatsApp
     göndərmə... admin-ə aid nə varsa olmasın".

     Əvvəl köhnə sistemləri YAMAYIRDIM (funksiyalarını sarğılayırdım)
     — ona görə hər dəfə bir yerdən sızırdı: gah köhnə iş masası
     çıxırdı, gah qırmızı xəbərdarlıq, gah İş masasına keçmək olurdu.

     İNDİ: kassir rejimində proqramın BÜTÜN qabığı gizlədilir —
     üst düymələr, alt menyu, üzən düymələr, yan panel. Ekranda
     yalnız bu fayl qalır. Yamaq yox, əvəzləmə.
     ══════════════════════════════════════════════════════════ */
  var SHELL_ID = 'cc-shell-css';

  /* ★ Şəkillərdə görünürdü ki, ÜST ZOLAĞIN ÖZÜ (`.topbar`) qalır —
     orada Studio düyməsi və toast yeri var. Onu da gizlədirik. */
  var HIDE = [
    '.topbar', '.topbar-pro',             /* bütün üst zolaq */
    '.top-actions', '.top-act',           /* bildiriş · AI Brain · Studio · Alətlər */
    '.brand', '.brand-logo', '.brand-sub',
    '.bottom-nav',                        /* alt menyu */
    /* yaşıl ＋ dairəvi menyu — qabı ilə birlikdə */
    '.radial-fab', '.rfab-main', '.rfab-petals', '.rfab-favs',
    '#rfabMain', '#radialFab',
    /* ★ Sarı lupa: `quick.js` onu `.quick-fab` QABININ içində
       yaradır. Əvvəl yalnız içindəkiləri gizlədirdim, qab qalırdı
       və düymə yenə görünürdü. İndi qabın özü də gizlədilir. */
    '.quick-fab', '.qfab-main', '.qfab-menu', '#qfabMain', '#qfabMenu',
    /* ★ Şəkildə qırağda hələ nəsə qalırdı — bütün yan element
       adlarını əhatə edirik */
    '.edge-tab', '.edge-panel', '.edge-scrim', '.edge-handle', '.edge-btn',
    '[class*="edge-"]', '[id*="edge"]',
    '.backup-dot', '.icon-btn',
    '.fab', '[class*="fab-"]', '.side-tab', '.drawer-tab',

    /* ★ 2026-08-23 — şəkillərdə hələ görünənlər:
       `bottom-dock.js` "Nə axtarırsan?" pəncərəsini `.qa-overlay`
       ilə açır (sol aşağıdakı ^ düyməsi onu çağırır).
       Kassirdə bu pəncərə ümumiyyətlə lazım deyil. */
    '.qa-overlay', '.qa-sheet', '.qa-tab', '.qa-fab',
    '[class*="jbd-"]', '[class*="qa-"]',
    '.command-bar', '.dock', '.bottom-dock', '[class*="dock"]',
    '.scroll-top', '.to-top', '[class*="totop"]', '[class*="scrolltop"]'
  ];

  /* ══════════════════════════════════════════════════════════
     ☀️ KASSİR GÖRÜNÜŞÜ — İŞIQLI VƏ SAKİT
     ──────────────────────────────────────────────────────────
     Esqin: "proqramın içini rəngli etmişik, məhsullar qarışıq
     görsənir — Kodsuz Mallardakı kimi ağ edək, rənglər qarışmasın.
     Kassir üçün işi asanlaşdırmaq, ağır işləyir, yüngülləşdirmək,
     animasiyaları sıfırlamaq, ledləri söndürmək."

     Ona görə kassir rejimində:
       · fon AĞ, mətn qara — mağazanın işığında oxunur
       · parıltı (glow), kölgə, gradient YOXDUR
       · animasiya və keçid effektləri SIFIRDIR — zəif kompüterdə
         proqram yüngülləşir
       · yalnız qiymət və barkod seçilir, qalan hər şey sakitdir

     Admin rejimi TOXUNULMUR — orada köhnə qaranlıq görünüş qalır.
     ══════════════════════════════════════════════════════════ */
  var LIGHT = [
    /* ── fon və mətn: süd-çəhrayı, ağ deyil ── */
    'body,.storeos{background:#FFF7F9 !important;color:#3D1226 !important}',
    '.cc-wrap{color:#3D1226}',
    '.muted,.cc-hint,.cc-p,.cc-note{color:#8A6473 !important;opacity:1 !important}',
    '.cc-sec{color:#A98595 !important;opacity:1 !important}',

    /* ── xana və düymələr ── */
    '.cc-in{background:#fff !important;color:#3D1226 !important;',
    'border:1.5px solid #F3DDE4 !important;box-shadow:none !important}',
    '.cc-in:focus{border-color:#D6246E !important}',
    '.cc-in::placeholder{color:#C2A3AF !important}',
    '.cc-ic{background:#fff !important;color:#3D1226 !important;',
    'border:1.5px solid #F3DDE4 !important;box-shadow:none !important}',
    '.cc-ic.cc-go{background:#D6246E !important;color:#fff !important;border:none !important}',
    '.cc-btn{background:#fff !important;color:#3D1226 !important;',
    'border:1.5px solid #F3DDE4 !important}',
    '.cc-btn.cc-pri{background:#D6246E !important;color:#fff !important;border:none !important}',
    '.cc-act{background:#FFF7F9 !important;color:#3D1226 !important;',
    'border:1.5px solid #F3DDE4 !important}',

    /* ── bölmə zolağı ── */
    '.cc-tabs{gap:8px}',
    '.cc-tab{background:#fff !important;color:#8A6473 !important;',
    'border:1.5px solid #F3DDE4 !important;border-radius:22px !important}',
    '.cc-tab.on{background:#D6246E !important;color:#fff !important;',
    'border-color:#D6246E !important}',

    /* ── kartlar ── */
    '.cc-card,.cc-cell,.cc-gcell,.cc-stat,.cc-folder,.cc-hist{',
    'background:#fff !important;border:1px solid #F3DDE4 !important;',
    'box-shadow:none !important;border-radius:18px !important}',
    '.cc-spec{background:#FFF7F9 !important;border:0 !important;',
    'border-radius:13px !important}',
    '.cc-spec .l{color:#8A6473 !important;opacity:1 !important}',
    '.cc-spec .v{color:#3D1226 !important}',
    '.cc-nm,.cc-title{color:#3D1226 !important}',
    '.cc-hrow{background:#fff !important;border-bottom:1px solid #F7E9EE !important;',
    'color:#3D1226 !important}',
    '.cc-kv,.cc-kv b{color:#3D1226 !important}',
    '.cc-kv span{color:#8A6473 !important;opacity:1 !important}',

    /* ── ★ QİYMƏT: tək güclü rəng ── */
    '.cc-price,.cc-py{color:#D6246E !important;text-shadow:none !important}',
    '.cc-chip{background:#FCE7EF !important;color:#9E1350 !important;border:0 !important}',
    '.cc-chip.new{background:#D6246E !important;color:#fff !important}',
    '.cc-chip.soft{background:#FFF7F9 !important;color:#8A6473 !important}',
    '.cc-newtag{background:rgba(255,255,255,.92) !important;color:#9E1350 !important}',
    '.cc-pill{background:#fff !important;color:#3D1226 !important;',
    'border:1.5px solid #F3DDE4 !important}',
    '.cc-stat b{color:#D6246E !important}',
    '.cc-bcx,.cc-fcode2{color:#B593A1 !important;opacity:1 !important}',

    /* ── xəbərdarlıqlar ── */
    '.cc-card.cc-warn{background:#FFFBEB !important;border-color:#FCD34D !important}',
    '.cc-card.cc-ok{background:#F0FDF4 !important;border-color:#86EFAC !important}',
    '.cc-card.cc-ai{background:#FCE7EF !important;border-color:#F0AFC8 !important}',
    '.cc-alert{background:#FFF5F5 !important;border:2px solid #F5C2C0 !important;',
    'border-radius:18px !important}',
    '.cc-atitle{color:#B3261E !important}',
    '.cc-alert.bad{background:#FFFBEB !important;border-color:#FBBF24 !important}',
    '.cc-alert.bad .cc-atitle{color:#B45309 !important}',
    '.cc-pwarn{background:#FEF3C7 !important;color:#92400E !important;',
    'border:1.5px solid #FBBF24 !important}',
    '.cc-gaps{background:#FEF3C7 !important;color:#92400E !important;border-color:#FCD34D !important}',
    '.cc-miss{background:rgba(61,18,38,.6) !important;color:#fff !important}',

    /* ── barkod düyməsi — kassirin əsas aləti ── */
    '.cc-copybtn{background:#FCE7EF !important;color:#9E1350 !important;',
    'border:2px solid #D6246E !important;border-radius:15px !important}',
    '.cc-copybtn.cc-copied{background:#F7C3D8 !important}',
    '.cc-copybtn .lab{color:#9E1350 !important;opacity:.75 !important}',
    '.cc-copyrow,.cc-copymini,.cc-fcode{background:#FFF7F9 !important;',
    'color:#3D1226 !important;border:1.5px solid #F3DDE4 !important}',
    '.cc-empty{border-color:#F3DDE4 !important;color:#C2A3AF !important;opacity:1 !important}',
    '.cc-note-box{background:#FFF7F9 !important;color:#5C3A4A !important;border:0 !important}',
    '.cc-undo{background:#FCE7EF !important;border-color:#F0AFC8 !important;',
    'color:#9E1350 !important}',
    '.cc-bar2{background:#F7E1E9 !important}',
    '.cc-bar2 i{background:#D6246E !important}',

    /* ── şəkilsiz kafellər malın öz rəngini saxlayır ── */
    '.cc-ph,.cc-noimg{border:0 !important}',
    '.cc-shots{background:#FFF7F9 !important}',

    /* ── ★ ANİMASİYA SIFIR ── */
    '*,*::before,*::after{animation:none !important;transition:none !important}',
    '.cc-flash{animation:none !important;box-shadow:none !important}',
    '.cc-btn:active,.cc-act:active,.cc-cell:active{transform:none !important}',
    '.ambient-bg,.neon,.glow{display:none !important}',
  ];

  /* Pəncərə hər halda açılsa (başqa koddan çağırılsa) bağlayırıq */
  function closeStray() {
    if (!isWorker() || !lockOn()) return;
    try {
      var D = G('JollyBottomDock');
      if (D && D.closeSheet) D.closeSheet();
      var o = document.querySelectorAll('.qa-overlay,.qa-sheet');
      for (var i = 0; i < o.length; i++) {
        if (o[i].parentNode) o[i].parentNode.removeChild(o[i]);
      }
    } catch (e) {}
  }

  function shellOn() {
    if (document.getElementById(SHELL_ID)) return;
    var st = document.createElement('style');
    st.id = SHELL_ID;
    st.setAttribute('data-hide', HIDE.join(','));   /* yoxlama üçün */
    st.textContent = HIDE.join(',') + '{display:none !important}' +
      LIGHT.join('') +
      /* alt menyu getdiyi üçün aşağıdakı boşluq da lazım deyil */
      '#main{padding-bottom:20px !important;padding-top:14px !important}' +
      /* Toast-lar da üst zolaqla birlikdə gedir — kassirə lazım deyil */
      '.toast,.toast-wrap,#toastHost{display:none !important}';
    (document.head || document.documentElement).appendChild(st);
    console.log('[CC] kassir rejimi — proqram qabığı gizlədildi');
  }

  function shellOff() {
    try {
      var st = document.getElementById(SHELL_ID);
      if (st && st.parentNode && st.parentNode.removeChild) st.parentNode.removeChild(st);
      else if (st) st.textContent = '';        /* ehtiyat: boşaldırıq */
    } catch (e) {}
  }

  function takeCommand() {
    if (!isWorker() || !lockOn()) return;

    /* ═══ 2026-08-19: `jolly-user-mode.js` və `permission-engine.js`
       index.html-dən TAM ÇIXARILDI. Onları susdurmağa ehtiyac
       qalmadı — sadəcə yüklənmirlər. Bura yalnız köhnə cihazlarda
       qalmış ayarı təmizləmək üçün saxlanılır. ═══ */
    try {
      var raw = localStorage.getItem('jolly_user_mode');
      if (raw) localStorage.removeItem('jolly_user_mode');
    } catch (e) {}

    /* Ehtiyat: Service Worker keşi köhnə index.html-i verə bilər,
       onda `JollyUserMode` yenə yüklənər. Belə halda susdururuq. */
    try {
      var UM = G('JollyUserMode');
      if (UM && !UM.__ccQuiet) {
        UM.__ccQuiet = true;
        ['render', 'sweep', 'apply', 'renderDash'].forEach(function (k) {
          if (typeof UM[k] === 'function') {
            var o = UM[k];
            UM[k] = function () {
              if (isWorker() && lockOn()) return '';
              return o.apply(UM, arguments);
            };
          }
        });
      }
    } catch (e) {}

    /* 2 — İdarə Mərkəzinin bloklamasını işçi üçün sustur.
       Marşrut məhdudiyyətini onsuz da biz qoyuruq; iki qat
       bir-birini əzirdi. */
    try {
      var I = G('JollyIdare');
      if (I && !I.__ccQuiet) {
        I.__ccQuiet = true;
        console.log('[CC] işçi rejimi — idarə bu fayldadır');
        if (typeof I.allowed === 'function') {
          var origAllowed = I.allowed;
          I.allowed = function (id) {
            if (isWorker() && lockOn()) return true;   /* qadağa CC-dədir */
            return origAllowed.apply(I, arguments);
          };
        }
        /* İdarənin öz xəbərdarlığı işçidə çıxmasın — marşrutu
           onsuz da biz idarə edirik */
        if (typeof I.guard === 'function') {
          var origGuard = I.guard;
          I.guard = function () {
            if (isWorker() && lockOn()) return;
            return origGuard.apply(I, arguments);
          };
        }
        if (typeof I.sweep === 'function') {
          var origSweep = I.sweep;
          I.sweep = function () {
            if (isWorker() && lockOn()) return;        /* menyunu gizlətməsin */
            return origSweep.apply(I, arguments);
          };
        }
      }
    } catch (e) {}

  }

  function guardWorker() {
    takeCommand();
    if (!isWorker() || !lockOn()) { shellOff(); return; }
    shellOn();
    var h = String(global.location.hash || '').split('?')[0];
    if (!h || h === '#/' ) { go(ROUTE); return; }
    if (FREE.test(h)) return;
    go(ROUTE);
  }

  function ensureScreen() {
    if (!onRoute()) return;
    var main = document.getElementById('main');
    if (!main) return;
    try {
      if (String(main.innerHTML).indexOf(MARK) !== -1) return;
      main.innerHTML = '<div ' + MARK + '="1">' + render() + '</div>';
      focusInput();
    } catch (e) {}
  }

  var tries = 0;
  function boot() {
    css();
    var R = G('ModuleRegistry');
    if (R && typeof R.register === 'function') {
      try {
        R.register({ id: 'cc', name: 'JOLLY AI', icon: '🧠', route: ROUTE, group: 'JOLLY', render: render });
        console.log('[CC] hazırdır');
        return;
      } catch (e) {}
    }
    if (++tries > 40) return;
    setTimeout(boot, 250);
  }

  /* ★ Esqin: "səhifəyə girəndə birinci köhnə qara pəncərə, sonra ağ gəlir".
     SƏBƏB: işıqlı üslub `guardWorker()` içində qurulurdu, o isə 300 ms
     sonra işə düşürdü — həmin müddətdə qaranlıq görünüş göz qırpırdı.
     İNDİ: fayl yüklənən kimi, hər şeydən əvvəl tətbiq olunur. */
  (function earlyShell() {
    try {
      if (isWorker() && lockOn() && onRoute()) shellOn();
    } catch (e) {}
  })();

  global.addEventListener('hashchange', function () {
    guardWorker();
    setTimeout(ensureScreen, 60);
  });
  setInterval(function () { guardWorker(); ensureScreen(); keepFocus(); closeStray(); }, 900);
  /* Boş yerə klik — fokus yenə xanaya qayıtsın */
  /* ★ Sensor ekranda boş yerə toxunanda fokusu ZORLAMIRIQ —
     əks halda ekran klaviaturası açılıb nəticələri örtə bilər.
     Fiziki klaviatura ilə işləyəndə isə fokus lazımdır, ona görə
     yazmağa başlayan kimi (aşağıdakı skaner izləyicisi) qayıdır. */
  document.addEventListener('click', function (e) {
    try {
      if (!wide() || !onRoute() || touch()) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                t.tagName === 'BUTTON' || (t.getAttribute && t.getAttribute('onclick')))) return;
      setTimeout(keepFocus, 30);
    } catch (er) {}
  }, true);

  /* Ctrl+K — istənilən yerdən xanaya */
  /* ══════════════════════════════════════════════════════════
     ⌨️ KASSA KOMPÜTERİ ÜÇÜN
     Əl skaneri klaviatura kimi yazır: rəqəmləri çox sürətlə
     "basır". Fokus xanada deyilsə yazı heç yerə düşmür və
     kassir çaşır. Geniş ekranda fokus xanada saxlanılır;
     istifadəçi başqa xanada işləyirsə TOXUNMURUQ.
     ══════════════════════════════════════════════════════════ */
  /* Cari malın barkodunu kopyalayır — kassirin yeganə ehtiyacı */
  function copyBarcode() {
    var bc = ctxProduct && (ctxProduct.barcodes || [])[0];
    if (!bc) { toast('Barkod yoxdur', 'error'); return; }
    var fake = { getAttribute: function () { return bc; },
                 classList: { add: function () {}, remove: function () {} } };
    grab(fake);
  }

  function keepFocus() {
    if (!wide() || !onRoute()) return;
    if (touch()) return;          /* sensor ekranda zorlamırıq */
    try {
      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      var el = document.getElementById('ccIn');
      if (el) el.focus();
    } catch (e) {}
  }

  /* Skaner insandan qat-qat sürətli yazır — bunu tanıyıb
     Enter gözləmədən dərhal axtarırıq */
  var lastKey = 0, fastRun = 0;

  function scannerWatch(e) {
    if (!onRoute()) return;
    var t = Date.now(), gap = t - lastKey;
    lastKey = t;

    /* Kimsə yazmağa başladısa (skaner və ya klaviatura) fokus
       xanaya qayıtsın — sensor ekranda da bu təhlükəsizdir,
       çünki yazı onsuz da fiziki klaviaturadan gəlir */
    if (wide() && /^[0-9a-zA-ZəĞğıİöÖşŞçÇüÜ]$/.test(String(e.key))) {
      try {
        var a = document.activeElement;
        if (!a || (a.tagName !== 'INPUT' && a.tagName !== 'TEXTAREA')) {
          var el = document.getElementById('ccIn');
          if (el) { el.focus(); el.value = (el.value || '') + e.key; updateSend(el.value); }
        }
      } catch (er) {}
    }
    if (/^[0-9]$/.test(String(e.key))) {
      fastRun = (gap < 45) ? fastRun + 1 : 1;
      if (fastRun >= 8) {
        clearTimeout(typeTimer);
        typeTimer = setTimeout(function () {
          var v = inputValue().trim();
          if (/^\d{6,}$/.test(v)) { fastRun = 0; submit(v); }
        }, 90);
      }
    } else fastRun = 0;
  }

  document.addEventListener('keydown', function (e) {
    try {
      scannerWatch(e);
      if (String(e.key) === 'Escape' && onRoute()) {
        setInput(''); updateSend(''); draft = null; bulkRows = null; paint('');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        if (!onRoute()) go(ROUTE);
        focusInput();
        return;
      }

      /* ★ 2026-08-23 — Esqin: "kassir məhsul tapdıqda F2 basıb
         barkodu copy eləsin". Kopyalanan YALNIZ barkoddur —
         ad, qiymət, tam sətir lazım deyil. */
      if (String(e.key) === 'F2' && onRoute()) {
        e.preventDefault();
        copyBarcode();
        return;
      }
      if (String(e.key) === 'F1' && onRoute()) {   /* xanaya qayıt */
        e.preventDefault();
        setInput(''); focusInput();
        return;
      }
      if (String(e.key) === 'F3' && onRoute()) {   /* son malı yenidən aç */
        e.preventDefault();
        var h = hist();
        if (h.length) {
          var p = findProduct(h[0].id);
          if (p) { ctxProduct = p; showCard(p, true); }
        }
        return;
      }
      /* ★ ↑ / ↓ — son 10 arasında gəz, Enter — aç.
         Siçana toxunmadan işləmək üçün. Xanada yazı varsa
         toxunmuruq — orada oxlar mətn üçün lazımdır. */
      if (onRoute() && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        var l = hist();
        if (!l.length) return;
        if (String(inputValue()).trim() && histSel === -1) return;
        e.preventDefault();
        histSel += (e.key === 'ArrowDown' ? 1 : -1);
        if (histSel < 0) histSel = l.length - 1;
        if (histSel >= l.length) histSel = 0;
        var pick = findProduct(l[histSel].id);
        if (pick) { ctxProduct = pick; showCard(pick, true); }
        repaintHist();
        return;
      }
      if (String(e.key) === 'Enter' && onRoute() && histSel >= 0 && !String(inputValue()).trim()) {
        e.preventDefault();
        var lh = hist();
        if (lh[histSel]) {
          var pp = findProduct(lh[histSel].id);
          if (pp) { ctxProduct = pp; showCard(pp, true); }
        }
        return;
      }

      if (String(e.key) === 'F4' && onRoute()) {   /* barkodu kopyala */
        e.preventDefault();
        copyBarcode();
        return;
      }
    } catch (er) {}
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 120); });
  } else {
    setTimeout(boot, 120);
  }
  setTimeout(function () { takeCommand(); guardWorker(); ensureScreen(); }, 300);
  setTimeout(takeCommand, 1200);      /* İdarə gec yüklənə bilər */

})(typeof window !== 'undefined' ? window : this);
