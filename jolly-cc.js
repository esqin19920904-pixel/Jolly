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

  function detect(raw) {
    var t = String(raw || '').trim();
    if (!t) return { kind: 'empty' };

    var digits = t.replace(/\s/g, '');
    if (/^\d{3,}$/.test(digits)) return { kind: 'barcode', code: digits };

    var mb = t.match(MAKE_BC_RE);
    if (mb) return { kind: 'make_barcode', code: mb[3] };

    var mp = t.match(MAKE_PR_RE);
    if (mp) return { kind: 'create', data: parseProduct(mp[2]), forced: true };

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
    encode: function (raw) {
      var d = String(raw || '').replace(/\D/g, '');
      if (d.length === 13) return { ok: true, bits: BC.ean13(d), kind: 'EAN-13' };
      if (d.length === 8) return { ok: true, bits: BC.ean8(d), kind: 'EAN-8' };
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
  function submit(raw) {
    var text = String(raw == null ? inputValue() : raw).trim();
    if (!text) return;
    lastInput = text;
    var it = detect(text);

    if (it.kind === 'barcode') return doBarcode(it.code);
    if (it.kind === 'make_barcode') return doMakeBarcode(it.code);
    if (it.kind === 'create') return doCreate(it.data, text);
    if (it.kind === 'ask') return doAsk(it.q);
    return doSearch(it.q);
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
        '<div class="cc-p">' + enc.kind + ' · kassa ekrandan oxuya bilər</div>' +
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
      pushRecent({ id: rec.id, name: payload.name });
      openProduct(rec);
    } else paint('<div class="cc-note">✅ yazıldı</div>');
  }

  /* ── KATALOQ AXTARIŞI ────────────────────────────────────── */
  function doSearch(q) {
    var nq = norm(q);
    var hits = products().filter(function (p) {
      if (!p) return false;
      if (norm(p.name).indexOf(nq) !== -1) return true;
      if (norm(p.brand).indexOf(nq) !== -1) return true;
      if (norm(p.supplier).indexOf(nq) !== -1) return true;
      return (p.barcodes || []).some(function (b) { return String(b).indexOf(q) !== -1; });
    });

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
    paint('<div class="cc-note">' + hits.length + ' mal tapıldı</div>' + grid(hits.slice(0, 30)));
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
      return '<div class="cc-cell" onclick="JollyCC.open(\'' + p.id + '\')">' + img +
        '<div class="cc-nm">' + esc(p.name || 'Adsız') + '</div>' +
        (p.price ? '<div class="cc-pr">' + p.price + ' ₼</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function openProduct(p) {
    if (!p || !p.id) return;
    pushRecent({ id: p.id, name: p.name || 'Adsız' });
    go('#/product/' + p.id);
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
      '.cc-hint{font-size:11.5px;opacity:.5;line-height:1.6;margin-bottom:12px}',
      '.cc-pills{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}',
      '.cc-pill{padding:7px 13px;border-radius:16px;font-size:12.5px;cursor:pointer;',
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}',
      '.cc-pill:active{background:rgba(255,255,255,.14)}',
      '.cc-note{font-size:12.5px;opacity:.7;padding:9px 2px}',
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
      '.cc-spin{display:inline-block;width:12px;height:12px;border-radius:50%;',
      'border:2px solid rgba(255,255,255,.25);border-top-color:#4ade80;',
      'animation:ccspin .7s linear infinite;vertical-align:-1px;margin-right:6px}',
      '@keyframes ccspin{to{transform:rotate(360deg)}}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function render() {
    css();
    var r = recent();
    var pills = [];
    r.forEach(function (x) {
      pills.push('<span class="cc-pill" onclick="JollyCC.open(\'' + x.id + '\')">📦 ' +
        esc(String(x.name).slice(0, 22)) + '</span>');
    });
    ['Mağazanın vəziyyəti', 'Barkodsuz mallar', 'Bu ay nə əlavə etmişəm'].forEach(function (q) {
      pills.push('<span class="cc-pill" onclick="JollyCC.run(\'' + esc(q) + '\')">🧠 ' + esc(q) + '</span>');
    });

    return '<div class="storeos cc-wrap">' +
      '<div class="dash-head"><div>' +
        '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">🧠 JOLLY AI</h2>' +
        '<div class="muted" style="font-size:12.5px;">bir xana — hər şey</div>' +
      '</div></div>' +

      '<div class="cc-bar">' +
        '<input id="ccIn" class="cc-in" autocomplete="off" placeholder="Barkod, ad, sual və ya yeni mal…" ' +
          'onkeydown="if(event.key===\'Enter\'){event.preventDefault();JollyCC.submit()}">' +
        '<div class="cc-ic" onclick="JollyCC.scan()">▣</div>' +
        '<div class="cc-ic" onclick="JollyCC.voice()">🎙️</div>' +
      '</div>' +

      '<div class="cc-hint">' +
        '<b>545</b> → barkodu tapır, yoxdursa yaratmağı təklif edir · ' +
        '<b>corab 12 man no.545</b> → mal yazır (təsdiqlə) · ' +
        '<b>corab</b> → kataloqda axtarır · ' +
        '<b>neçə mal barkodsuzdur?</b> → süni zəka cavab verir' +
      '</div>' +

      '<div class="cc-pills">' + pills.join('') + '</div>' +
      '<div id="ccOut">' + out + '</div>' +
      '</div>';
  }

  function repaint() {
    var el = document.getElementById('main');
    if (el && String(global.location.hash || '').split('?')[0] === ROUTE) {
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
    version: '1.0',
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
    cancel: function () { draft = null; paint(''); },
    copy: function (t) {
      try { navigator.clipboard.writeText(String(t)); toast('📋 kopyalandı', 'ok'); }
      catch (e) { toast('kopyalanmadı', 'error'); }
    },
    barcode: BC,
    recent: recent
  };

  /* ══════════════════════════════════════════════════════════
     Açılış — ekran registrdən asılı olmadan açılır
     ══════════════════════════════════════════════════════════ */
  var MARK = 'data-cc-screen';

  function ensureScreen() {
    if (String(global.location.hash || '').split('?')[0] !== ROUTE) return;
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
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        if (String(global.location.hash || '').split('?')[0] !== ROUTE) go(ROUTE);
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
