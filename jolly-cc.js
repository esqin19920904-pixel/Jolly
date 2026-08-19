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

  function detect(raw) {
    var t = String(raw || '').trim();
    if (!t) return { kind: 'empty' };

    /* ★ KONTEKST: ad yazılmayıbsa son baxılan mal nəzərdə tutulur */
    var mc = t.match(EDIT_CTX_RE);
    if (mc) return { kind: 'edit', target: '', price: mc[1].replace(',', '.'), ctx: true };

    var me = t.match(EDIT_RE);
    if (me) return { kind: 'edit', target: me[1].trim(), price: me[2].replace(',', '.') };

    var digits = t.replace(/\s/g, '');
    if (/^\d{3,}$/.test(digits)) return { kind: 'barcode', code: digits };

    var mb = t.match(MAKE_BC_RE);
    if (mb) return { kind: 'make_barcode', code: mb[3] };

    var mp = t.match(MAKE_PR_RE);
    if (mp) return { kind: 'create', data: parseProduct(mp[2]), forced: true };

    /* Çatışmayanlar üçün yerli süzgəc — süni zəkaya ehtiyac yoxdur */
    var nt = norm(t);
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

    if (it.kind === 'barcode') return doBarcode(it.code);
    if (it.kind === 'make_barcode') return doMakeBarcode(it.code);
    if (it.kind === 'edit') return doEdit(it.target, it.price, it.ctx);
    if (it.kind === 'create') return doCreate(it.data, text);
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

    if (hits.length === 1) { openProduct(hits[0]); return; }
    if (hits.length > 1) {
      paint('<div class="cc-note">▣ ' + esc(code) + ' — ' + hits.length + ' mal tapıldı</div>' + grid(hits));
      return;
    }

    /* Tapılmadı — nə etmək istədiyini soruşuruq, özbaşına yazmırıq */
    var enc = BC.encode(code);
    paint(
      '<div class="cc-card cc-warn">' +
        '<div class="cc-h">▣ ' + esc(code) + '</div>' +
        '<div class="cc-p">Bu barkod kataloqda yoxdur.</div>' +
        (enc.ok ? '<div class="cc-bc">' + BC.svg(enc.bits) +
          '<div class="cc-bcn">' + esc(code) + '</div></div>' : '') +
        '<div class="cc-row">' +
          '<button class="cc-btn cc-pri" onclick="JollyCC.newWith(\'' + esc(code) + '\')">＋ Məhsul yarat</button>' +
          '<button class="cc-btn" onclick="JollyCC.copy(\'' + esc(code) + '\')">📋 Kopyala</button>' +
        '</div>' +
      '</div>');
  }

  /* ── BARKOD YARAT (kassada vurmaq üçün) ──────────────────── */
  function doMakeBarcode(code) {
    var enc = BC.encode(code);
    if (!enc.ok) { paint('<div class="cc-note">Bu kod çəkilə bilmir: ' + esc(code) + '</div>'); return; }
    paint(
      '<div class="cc-card">' +
        '<div class="cc-h">🧾 Kassa barkodu</div>' +
        '<div class="cc-bc">' + BC.svg(enc.bits) + '<div class="cc-bcn">' + esc(code) + '</div></div>' +
        '<div class="cc-p">' + enc.kind +
          (enc.badSum ? ' · ⚠️ yoxlama rəqəmi uyğun deyil (düzgünü ' + enc.want +
            ') — kassa oxumaya bilər' : ' · kassa ekrandan oxuya bilər') + '</div>' +
        '<div class="cc-row">' +
          '<button class="cc-btn cc-pri" onclick="JollyCC.newWith(\'' + esc(code) + '\')">＋ Bu koda mal yarat</button>' +
        '</div>' +
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
  var editDraft = null;

  function doEdit(target, price, useCtx) {
    if (useCtx) {
      if (!ctxProduct) {
        paint('<div class="cc-card cc-warn"><div class="cc-h">Hansı mal?</div>' +
          '<div class="cc-p">Əvvəl malı tap, sonra "qiyməti ' + esc(price) + ' et" yaz. ' +
          'Yaxud adı ilə yaz: <b>rexona qiyməti ' + esc(price) + '</b></div></div>');
        return;
      }
      return askEdit(ctxProduct, price);
    }
    var hits = /^\d{3,}$/.test(target)
      ? ((DB() || {}).Products.findByBarcode ? (DB().Products.findByBarcode(target) || []) : [])
      : searchProducts(target);

    if (!hits.length) {
      paint('<div class="cc-card cc-warn"><div class="cc-h">Tapılmadı: ' + esc(target) + '</div>' +
        '<div class="cc-p">Qiyməti dəyişmək üçün əvvəl malı tapmaq lazımdır.</div></div>');
      return;
    }
    if (hits.length > 1) {
      paint('<div class="cc-note">' + hits.length + ' mal uyğun gəldi — birini seç, sonra qiyməti yaz</div>' +
        grid(hits.slice(0, 12)));
      return;
    }
    return askEdit(hits[0], price);
  }

  function askEdit(p, price) {
    editDraft = { id: p.id, price: price, old: p.price };
    paint('<div class="cc-card cc-warn">' +
      '<div class="cc-h">✎ ' + esc(p.name || 'Adsız') + '</div>' +
      '<div class="cc-p">Köhnə qiymət: <b>' + (p.price == null ? '—' : p.price) + ' ₼</b><br>' +
        'Yeni qiymət: <b>' + esc(price) + ' ₼</b></div>' +
      '<div class="cc-row">' +
        '<button class="cc-btn cc-pri" onclick="JollyCC.applyEdit()">✓ Təsdiqlə</button>' +
        '<button class="cc-btn" onclick="JollyCC.cancel()">Ləğv et</button>' +
      '</div></div>');
  }

  function applyEdit() {
    if (!editDraft) return;
    var P = (DB() || {}).Products;
    if (!P || !P.update) { toast('Baza əlçatan deyil', 'error'); return; }
    var id = editDraft.id, oldPrice = editDraft.old;
    try { P.update(id, { price: Number(editDraft.price) }); }
    catch (e) { toast('Yazıla bilmədi: ' + (e && e.message), 'error'); return; }
    editDraft = null;
    setInput('');
    toast('✅ qiymət dəyişdi', 'ok');
    var p = findProduct(id);
    /* ★ GERİ QAYTAR — tələsik təsdiqin qarşısını alır */
    setUndo('Qiymət dəyişdi: ' + (p ? p.name : ''), function () {
      try { P.update(id, { price: oldPrice }); } catch (e) {}
    });
    if (p) paint(undoBar() + '<div class="cc-note">✅ ' + esc(p.name) + ' — ' +
      p.price + ' ₼</div>' + grid([p]));
  }

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

  /* ── KATALOQ AXTARIŞI ────────────────────────────────────── */
  function doSearch(q) {
    var hits = searchProducts(q);

    if (!hits.length) {
      var p = parseProduct(q);
      paint('<div class="cc-card cc-warn">' +
        '<div class="cc-h">Tapılmadı: ' + esc(q) + '</div>' +
        '<div class="cc-p">Kataloqda uyğun mal yoxdur.</div>' +
        '<div class="cc-row">' +
          '<button class="cc-btn cc-pri" onclick="JollyCC.createFrom()">＋ Bu adla mal yarat</button>' +
          '<button class="cc-btn" onclick="JollyCC.ask()">🧠 AI-dan soruş</button>' +
        '</div></div>');
      return;
    }
    ctxProduct = hits[0];
    paint('<div class="cc-note">' + hits.length + ' mal tapıldı</div>' + grid(hits.slice(0, 30)));
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
      var img = (ref && I && I.imgAttr) ? '<img ' + I.imgAttr(ref, true) + ' alt="">'
                                        : '<div class="cc-ph">📦</div>';
      var bc = (p.barcodes || [])[0];
      /* ★ Tapdıqdan sonra bir toxunuşla göndərmək — köhnədə bu var idi */
      var miss = [];
      if (!bc) miss.push('▣');
      if (!ref) miss.push('📷');
      if (!p.price) miss.push('₼');
      return '<div class="cc-cell">' +
        '<div onclick="JollyCC.open(\'' + p.id + '\')">' + img +
          (miss.length ? '<div class="cc-miss">' + miss.join(' ') + '</div>' : '') +
          '<div class="cc-nm">' + esc(p.name || 'Adsız') + '</div>' +
          '<div class="cc-pr">' +
            (p.price ? '<b>' + p.price + ' ₼</b>' : '<span style="opacity:.5">qiymətsiz</span>') +
            (bc ? '<span class="cc-bcx">' + esc(String(bc).slice(-6)) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="cc-acts">' +
          '<button class="cc-act" title="Göndər" onclick="JollyCC.share(\'' + p.id + '\')">📤</button>' +
          (bc ? '<button class="cc-act" title="Kassa" onclick="JollyCC.kassa(\'' + esc(bc) + '\')">🧾</button>' : '') +
          '<button class="cc-act" title="Mətn" onclick="JollyCC.text(\'' + p.id + '\')">📋</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     📤 GÖNDƏRMƏ — şəkillə birlikdə
     ══════════════════════════════════════════════════════════ */
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
    showCard(p);
  }

  function field(label, val) {
    if (val == null || val === '') return '';
    return '<div class="cc-kv"><span>' + esc(label) + '</span><b>' + esc(val) + '</b></div>';
  }

  function showCard(p) {
    var I = IMG();
    var imgs = p.images || [];
    var bc = (p.barcodes || [])[0];
    var enc = bc ? BC.encode(bc) : { ok: false };

    var gaps = [];
    if (!bc) gaps.push('barkodsuz');
    if (!imgs.length) gaps.push('şəkilsiz');
    if (!p.price) gaps.push('qiymətsiz');

    paint(
      '<div class="cc-card cc-detail">' +
        (imgs.length && I && I.imgAttr
          ? '<div class="cc-shots">' + imgs.slice(0, 4).map(function (r) {
              return '<img ' + I.imgAttr(r, true) + ' alt="">';
            }).join('') + '</div>'
          : '<div class="cc-noimg">📦 şəkil yoxdur</div>') +

        '<div class="cc-title">' + esc(p.name || 'Adsız') + '</div>' +
        (p.price ? '<div class="cc-big">' + p.price + ' <small>₼</small></div>' : '') +
        (gaps.length ? '<div class="cc-gaps">⚠️ ' + gaps.join(' · ') + '</div>' : '') +

        '<div class="cc-kvs">' +
          field('Barkod', (p.barcodes || []).join(', ')) +
          field('Firma', p.brand) +
          field('Qrup', p.group) +
          field('Tədarükçü', p.supplier) +
          field('Yer', p.location) +
          field('Rəng', p.color) +
          field('Qeyd', p.note) +
        '</div>' +

        (enc.ok ? '<div class="cc-bc">' + BC.svg(enc.bits) +
          '<div class="cc-bcn">' + esc(bc) + '</div></div>' : '') +

        '<div class="cc-row">' +
          '<button class="cc-btn cc-pri" onclick="JollyCC.share(\'' + p.id + '\')">📤 Göndər</button>' +
          '<button class="cc-btn" onclick="JollyCC.photo(\'' + p.id + '\')">📷 Şəkil</button>' +
        '</div>' +
        '<div class="cc-row">' +
          (bc ? '<button class="cc-btn" onclick="JollyCC.kassa(\'' + esc(bc) + '\')">🧾 Kassa</button>' : '') +
          '<button class="cc-btn" onclick="JollyCC.text(\'' + p.id + '\')">📋 Mətn</button>' +
          '<button class="cc-btn" onclick="JollyCC.full(\'' + p.id + '\')">↗ Tam kart</button>' +
        '</div>' +
        '<div class="cc-p" style="margin-top:9px">' +
          'Qiyməti dəyişmək üçün yaz: <b>qiyməti 15 et</b>' +
        '</div>' +
      '</div>');
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
      if (!I || !I.saveImage || !P || !P.update) { toast('Şəkil saxlanıla bilmir', 'error'); return; }
      busy('şəkil yüklənir…');
      var fr = new FileReader();
      fr.onload = function () {
        Promise.resolve(I.saveImage(fr.result)).then(function (ref) {
          if (!ref) throw new Error('boş nəticə');
          var p = findProduct(id);
          var list = ((p && p.images) || []).concat([ref]);
          P.update(id, { images: list });
          toast('📷 şəkil əlavə olundu', 'ok');
          var np = findProduct(id);
          if (np) { ctxProduct = np; showCard(np); }
        }).catch(function (e) {
          paint('<div class="cc-card cc-warn"><div class="cc-h">Şəkil alınmadı</div>' +
            '<div class="cc-p">' + esc(e && e.message) + '</div></div>');
        });
      };
      fr.readAsDataURL(f);
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
      '.cc-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}',
      '.cc-cell{border-radius:14px;padding:10px;cursor:pointer;',
      'background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}',
      '.cc-cell img,.cc-ph{width:100%;height:112px;border-radius:11px;object-fit:cover;',
      'background:rgba(255,255,255,.06);display:block}',
      '.cc-ph{display:flex;align-items:center;justify-content:center;font-size:32px}',
      '.cc-nm{font-size:12.5px;font-weight:600;margin-top:7px;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.cc-pr{font-size:12px;opacity:.6;margin-top:2px}',
      '.cc-acts{display:flex;gap:5px;margin-top:8px}',
      '.cc-act{flex:1;padding:8px 0;border-radius:10px;font-size:14px;cursor:pointer;',
      'color:inherit;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13)}',
      '.cc-act:active{background:rgba(255,255,255,.18)}',
      /* ── daxili məhsul kartı ── */
      '.cc-detail{padding:0;overflow:hidden}',
      '.cc-shots{display:flex;gap:2px;background:rgba(0,0,0,.3)}',
      '.cc-shots img{flex:1;min-width:0;height:170px;object-fit:cover;display:block}',
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
    var cell = function (n, lab, q, warn) {
      return '<div class="cc-stat' + (warn && n ? ' bad' : '') + '" ' +
        (q ? 'onclick="JollyCC.run(\'' + esc(q) + '\')"' : '') + '>' +
        '<b>' + n + '</b><span>' + lab + '</span></div>';
    };
    return '<div class="cc-stats">' +
      cell(l.length, 'mal', '') +
      cell(noBc, 'barkodsuz', 'barkodsuz mallar', true) +
      cell(noImg, 'şəkilsiz', 'şəkilsiz mallar', true) +
      cell(noPrice, 'qiymətsiz', 'qiyməti olmayanlar', true) +
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
    ['Mağazanın vəziyyəti', 'Bu ay nə əlavə etmişəm'].forEach(function (q) {
      pills.push('<span class="cc-pill" onclick="JollyCC.run(\'' + esc(q) + '\')">🧠 ' + esc(q) + '</span>');
    });

    return '<div class="storeos cc-wrap">' +
      '<div class="dash-head"><div>' +
        '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">🧠 JOLLY AI</h2>' +
        '<div class="muted" style="font-size:12.5px;">bir xana — hər şey</div>' +
      '</div></div>' +

      '<div class="cc-bar">' +
        '<input id="ccIn" class="cc-in" autocomplete="off" enterkeyhint="search" ' +
          'placeholder="Barkod, ad, sual və ya yeni mal…" ' +
          'oninput="JollyCC.typing(this.value)" ' +
          'onkeydown="if(event.key===\'Enter\'){event.preventDefault();JollyCC.submit()}">' +
        /* ★ Göndər düyməsi — telefon klaviaturasında Enter həmişə
           işə düşmür, ona görə bu düymə şərtdir */
        '<div class="cc-ic cc-go" id="ccGo" style="opacity:.35" onclick="JollyCC.submit()">➤</div>' +
        '<div class="cc-ic" onclick="JollyCC.scan()">▣</div>' +
        '<div class="cc-ic" onclick="JollyCC.voice()">🎙️</div>' +
      '</div>' +

      '<div class="cc-hint">' +
        '<b>545</b> → barkodu tapır, yoxdursa yaratmağı təklif edir · ' +
        '<b>corab 12 man no.545</b> → mal yazır (təsdiqlə) · ' +
        '<b>corab</b> → kataloqda axtarır · ' +
        '<b>545 qiymət 15</b> → qiyməti dəyişir (təsdiqlə) · ' +
        '<b>neçə mal barkodsuzdur?</b> → süni zəka cavab verir' +
      '</div>' +

      '<div class="cc-pills">' + pills.join('') + '</div>' +
      (out ? '' : snapshot()) +
      '<div id="ccOut">' + out + '</div>' +
      (out ? '' : lastAdded()) +
      '</div>';
  }

  function repaint() {
    var el = document.getElementById('main');
    if (el && onRoute()) {
      el.innerHTML = render();
      focusInput();
    }
  }
  function focusInput() {
    setTimeout(function () {
      var el = document.getElementById('ccIn');
      if (el) { try { el.focus(); } catch (e) {} }
    }, 120);
  }

  /* ══════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════ */
  global.JollyCC = {
    version: '1.3',
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
    applyEdit: applyEdit,
    typing: typing,
    undo: doUndo,
    ctx: function () { return ctxProduct; },
    cancel: function () { draft = null; editDraft = null; paint(''); },
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
    card: function (id) { var p = findProduct(id); if (p) showCard(p); },
    full: function (id) { go('#/product/' + id); },
    open2: null,
    ensure: function () { ensureScreen(); },
    routes: function () { return Object.keys(ALIASES); }
  };

  /* ══════════════════════════════════════════════════════════
     Açılış — ekran registrdən asılı olmadan açılır
     ══════════════════════════════════════════════════════════ */
  var MARK = 'data-cc-screen';

  function onRoute() {
    return !!ALIASES[String(global.location.hash || '').split('?')[0]];
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

  global.addEventListener('hashchange', function () { setTimeout(ensureScreen, 60); });
  setInterval(ensureScreen, 900);

  /* Ctrl+K — istənilən yerdən xanaya */
  document.addEventListener('keydown', function (e) {
    try {
      if (String(e.key) === 'Escape' && onRoute()) {
        setInput(''); updateSend(''); draft = null; editDraft = null; paint('');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        if (!onRoute()) go(ROUTE);
        focusInput();
      }
    } catch (er) {}
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 120); });
  } else {
    setTimeout(boot, 120);
  }
  setTimeout(ensureScreen, 300);

})(typeof window !== 'undefined' ? window : this);
