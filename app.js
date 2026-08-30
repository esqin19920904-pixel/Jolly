/* ==========================================================
   JOLLY VITRIN — mustericin gordugu terefin mentiqi
   ========================================================== */

(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var view = $('#view');
  var sheet = $('#sheet');
  var sheetBody = $('#sheetBody');

  var PAGE_BUILD = '20260830-0900';

  var CAT = null;          // kataloq (bolmeler, markalar, filiallar)
  var state = {
    q: '', cat: '', brand: '', tone: '', color: '', tag: '', badge: '',
    sale: '', stock: '', sort: 'new', page: 1, mode: 'home'
  };
  var loading = false;
  var lastTotal = 0;
  var SEEN = {};           // id -> mehsul (tez baxis ucun)

  /* ---------- kicik komekciler ---------- */

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function img(key) { return '/api/img/' + key; }

  /* ---------- zolaqli barkod ---------- */

  function drawBarcodes(root) {
    if (typeof JBC === 'undefined') return;
    JBC.render(root, { module: 1.7, height: 44, font: 12 });
  }
  function money(v) {
    var n = Number(v || 0);
    return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function api(path) {
    return fetch(path, { headers: { 'accept': 'application/json' } })
      .then(function (r) { return r.json(); });
  }

  /* ---------- sevimliler ---------- */

  var FAV_KEY = 'jolly_fav';
  function favs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function isFav(id) { return favs().indexOf(Number(id)) > -1; }
  function toggleFav(id) {
    id = Number(id);
    var list = favs();
    var i = list.indexOf(id);
    if (i > -1) list.splice(i, 1); else list.unshift(id);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 200))); } catch (e) {}
    $('#favDot').hidden = list.length === 0;
    return i === -1;
  }

  /* ---------- mehsul karti ---------- */

  var HEART = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7-.7c0 4.9-7 12.7-7 12.7z"/></svg>';

  function card(p) {
    SEEN[p.id] = p;
    var b = el('button', 'card');
    b.type = 'button';
    b.dataset.id = p.id;

    var badge = '';
    if (!p.in_stock) badge = '<span class="badge out">Bitib</span>';
    else if (p.badge) badge = '<span class="badge">' + esc(p.badge) + '</span>';

    var pic = p.cover
      ? '<img src="' + img(p.cover) + '" alt="' + esc(p.name) + '" loading="lazy">'
      : '<span class="noimg">J</span>';

    var priceHtml = '';
    if (p.show_price && p.price) {
      priceHtml = '<span class="price">' + money(p.price) + '<span class="cur"> ₼</span></span>';
    }

    /* Kartin altinda barkod — mehsulu acmadan kassada oxutmaq ucun */
    var first = (p.codes && p.codes.length) ? p.codes[0] : null;
    var codeHtml = '';
    if (first) {
      codeHtml =
        '<div class="card-bc">' +
          '<div class="bc" data-bc="' + esc(first.code) + '" data-zoom="' + esc(first.code) + '"></div>' +
          '<div class="card-bc-row">' +
            '<span class="num">' + esc(first.code) + '</span>' +
            '<button class="cbtn" type="button" data-copy="' + esc(first.code) + '" title="Kopyala">⧉</button>' +
          '</div>' +
          ((p.codes.length > 1) ? '<span class="more-bc">+' + (p.codes.length - 1) + '</span>' : '') +
        '</div>';
    }

    var EYE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7">' +
      '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/>' +
      '<circle cx="12" cy="12" r="2.6"/></svg>';

    b.innerHTML =
      '<div class="thumb">' + pic + badge +
        '<span class="eye" data-eye="' + p.id + '" title="Tez bax">' + EYE + '</span>' +
        '<span class="fav' + (isFav(p.id) ? ' on' : '') + '" data-fav="' + p.id + '">' + HEART + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        (p.brand ? '<div class="brand">' + esc(p.brand) + '</div>' : '') +
        '<div class="name">' + esc(p.name) + '</div>' +
        (priceHtml ? '<div class="price-row">' + priceHtml + '</div>' : '') +
        codeHtml +
      '</div>';

    return b;
  }

  function grid(items) {
    var g = el('div', 'grid');
    items.forEach(function (p) { g.appendChild(card(p)); });
    setTimeout(function () { drawCardCodes(g); }, 0);
    return g;
  }

  /* Kartdaki barkodlar kicik cizilir — yer tutmasin */
  function drawCardCodes(root) {
    if (typeof JBC === 'undefined') return;
    JBC.render(root, { module: 1.15, height: 30, text: false });
  }

  /* ---------- bolme lentleri ---------- */

  function renderChips() {
    var box = $('#chips');
    box.innerHTML = '';

    function chip(label, n, active, on) {
      var c = el('button', 'chip');
      c.type = 'button';
      c.setAttribute('aria-pressed', active ? 'true' : 'false');
      c.innerHTML = esc(label) + (n != null ? '<span class="n">' + n + '</span>' : '');
      c.onclick = on;
      box.appendChild(c);
    }

    var nothing = !state.cat && !state.brand && !state.sale && !state.tag && !state.badge;

    chip('Hamısı', CAT.total, nothing, function () {
      clearFilters(); go();
    });

    (CAT.cats || []).forEach(function (c) {
      if (!c.n) return;
      chip(c.name, c.n, String(state.cat) === String(c.id), function () {
        var was = String(state.cat) === String(c.id);
        clearFilters();
        state.cat = was ? '' : c.id;
        go();
      });
    });

    (CAT.tags || []).forEach(function (t) {
      chip(t.name, t.n, String(state.tag) === String(t.id), function () {
        var was = String(state.tag) === String(t.id);
        clearFilters();
        state.tag = was ? '' : t.id;
        go();
      });
    });
  }

  /* ---------- KASSA REJIMI ---------- */

  var KASSA = { on: false, last: '', hist: [], buf: '', t0: 0 };

  var HIST_KEY = 'jolly_kassa_hist';
  function loadHist() {
    try { KASSA.hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
    catch (e) { KASSA.hist = []; }
  }
  function saveHist() {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(KASSA.hist.slice(0, 30))); } catch (e) {}
  }

  /* Qisa səs — kassir ekrana baxmadan da bilsin */
  var actx = null;
  function beep(ok) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime;
      function tone(f, at, dur, vol) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + at);
        g.gain.linearRampToValueAtTime(vol, t + at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(t + at); o.stop(t + at + dur + 0.02);
      }
      if (ok) tone(1180, 0, 0.09, 0.16);
      else { tone(320, 0, 0.13, 0.18); tone(240, 0.16, 0.2, 0.18); }
    } catch (e) {}
  }

  /* ƏL SKANERİ: hər hansı yerdə sürətlə yazılan rəqəmlər tutulur.
     Skaner insandan qat-qat sürətli yazır — fərqi ona görə bilirik. */
  window.addEventListener('keydown', function (e) {
    if (!KASSA.on) return;

    var now = Date.now();
    var el2 = document.activeElement;
    var inField = el2 && el2.id === 'kq';

    if (e.key === 'Escape') {
      var q3 = $('#kq');
      if (q3) { q3.value = ''; q3.focus(); }
      var b3 = $('#kres');
      if (b3) b3.innerHTML = '<div class="kempty"><div class="kicon">▥</div><p>Barkodu oxut və ya yaz</p></div>';
      return;
    }

    if (e.key === 'Enter') {
      if (KASSA.buf.length >= 4 && !inField) {
        e.preventDefault();
        doScan(KASSA.buf);
      }
      KASSA.buf = '';
      return;
    }

    if (!/^[0-9]$/.test(e.key)) { KASSA.buf = ''; return; }

    /* 60 ms-dən uzun fasilə — insan yazır, skaner yox */
    if (now - KASSA.t0 > 60) KASSA.buf = '';
    KASSA.t0 = now;
    KASSA.buf += e.key;

    if (!inField) {
      var q4 = $('#kq');
      if (q4) { q4.value = KASSA.buf; q4.focus(); }
    }
  }, true);

  function viewKassa() {
    state.mode = 'kassa';
    KASSA.on = true;
    if (document.body.classList) document.body.classList.add('kassa-on');

    loadHist();

    view.innerHTML =
      '<div class="kwrap">' +
        '<div class="ktop">' +
          '<span class="klabel">KASSA</span>' +
          '<span class="khint">skaneri oxut · <b>Esc</b> təmizlə</span>' +
          '<button class="kexit" type="button" id="kExit">Çıx</button>' +
        '</div>' +
        '<div class="kmain">' +
          '<div class="kleft">' +
            '<div id="kres" class="kres">' +
              '<div class="kempty">' +
                '<div class="kicon">▥</div>' +
                '<p>Barkodu oxut və ya yaz</p>' +
              '</div>' +
            '</div>' +
            '<div class="kbar">' +
              '<input id="kq" inputmode="numeric" pattern="[0-9]*" placeholder="barkod…" autocomplete="off">' +
              '<button class="btn kbig" type="button" id="kScan">📷 Oxut</button>' +
            '</div>' +
          '</div>' +
          '<aside class="kside">' +
            '<div class="ksh">Son oxunanlar</div>' +
            '<div id="khist"></div>' +
          '</aside>' +
        '</div>' +
      '</div>';

    drawHist();

    var inp = $('#kq');
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doScan(inp.value.trim()); }
    });
    /* skaner cihazi Enter atmasa da uzunluga gore tutulur */
    inp.addEventListener('input', function () {
      var v2 = inp.value.replace(/\s/g, '');
      if (v2.length >= 8) {
        clearTimeout(inp._t);
        inp._t = setTimeout(function () { doScan(v2); }, 220);
      }
    });

    $('#kScan').onclick = function () {
      camScan(function (c) { inp.value = c; doScan(c); });
    };
    $('#kExit').onclick = function () { exitKassa(); };

    inp.focus();

    /* fokus itsə də geri qaytarırıq — skaner həmişə xanaya yazsın */
    KASSA.refocus = setInterval(function () {
      if (!KASSA.on) { clearInterval(KASSA.refocus); return; }
      var a = document.activeElement;
      if (!a || (a.tagName !== 'INPUT' && a.tagName !== 'TEXTAREA')) {
        var q5 = $('#kq');
        if (q5) q5.focus();
      }
    }, 1500);
  }

  function drawHist() {
    var box = $('#khist');
    if (!box) return;
    if (!KASSA.hist.length) {
      box.innerHTML = '<p class="kmuted">hələ boşdur</p>';
      return;
    }
    box.innerHTML = KASSA.hist.map(function (x) {
      return '<button class="khrow" type="button" data-kh="' + esc(x.code) + '">' +
        (x.cover ? '<img src="' + img(x.cover) + '" alt="">' : '<span class="khph">' + (x.ok ? 'J' : '?') + '</span>') +
        '<span class="kht"><b>' + esc(x.name) + '</b>' +
          '<small>' + esc(x.code) + (x.price != null ? ' · ' + money(x.price) + ' ₼' : '') + '</small>' +
        '</span></button>';
    }).join('');
  }

  function pushHist(rec) {
    KASSA.hist = KASSA.hist.filter(function (x) { return x.code !== rec.code; });
    KASSA.hist.unshift(rec);
    KASSA.hist = KASSA.hist.slice(0, 30);
    saveHist();
    drawHist();
  }

  function exitKassa() {
    if (KASSA.refocus) clearInterval(KASSA.refocus);
    KASSA.on = false;
    if (document.body.classList) document.body.classList.remove('kassa-on');
    go();
  }

  function doScan(code) {
    code = String(code || '').replace(/\s/g, '');
    if (!code) return;
    KASSA.last = code;

    var box = $('#kres');
    if (!box) return;
    box.innerHTML = '<div class="kempty"><p>axtarılır…</p></div>';

    api('/api/scan?code=' + encodeURIComponent(code)).then(function (r) {
      if (!r.ok) { box.innerHTML = '<div class="kempty"><p>Alınmadı</p></div>'; return; }

      if (!r.found) {
        var pend = r.pending;
        box.innerHTML =
          '<div class="knot">' +
            '<div class="kicon">?</div>' +
            '<h2>Tapılmadı</h2>' +
            '<p class="kcode">' + esc(code) + '</p>' +
            (pend
              ? '<p class="kpend">Artıq qeyd olunub: <b>' + esc(pend.note || '') + '</b>' +
                (pend.price != null ? ' · ' + money(pend.price) + ' ₼' : '') + '</p>'
              : '<button class="btn w" type="button" id="kMiss">Qeyd et</button>') +
          '</div>';

        if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
        beep(false);
        pushHist({ code: code, name: 'Tapılmadı', price: null, cover: '', ok: 0 });

        var mb = $('#kMiss');
        if (mb) mb.onclick = function () {
          api2('/api/missing/quick', { code: code, source: 'scan' }).then(function (x) {
            if (x.already) toast('Onsuz da qeyd olunub');
            else toast('Yaradıldı — sonra adını yaz');
            mb.textContent = '✓ Qeyd olundu';
            mb.disabled = true;
          });
        };
        return;
      }

      var p = r.item;
      if (navigator.vibrate) navigator.vibrate(50);
      beep(true);
      pushHist({
        code: (p.scanned ? p.scanned.code : code),
        name: p.name,
        price: (p.show_price && p.price) ? p.price : null,
        cover: p.cover || '', ok: 1
      });

      var h = '<div class="kcard">';
      h += '<div class="kpic">' +
        (p.cover ? '<img src="' + img(p.cover) + '" alt="">' : '<span class="noimg">J</span>') +
        '</div>';

      h += '<div class="kinfo">';
      if (p.brand) h += '<span class="kbrand">' + esc(p.brand) + '</span>';
      h += '<h2>' + esc(p.name) + '</h2>';

      if (p.show_price && p.price) {
        h += '<div class="kprice">' + money(p.price) + '<span>₼</span></div>';
      } else {
        h += '<div class="kprice none">qiymət yoxdur</div>';
      }

      h += '<div class="kpills">';
      h += p.in_stock ? '<span class="ok">var</span>' : '<span class="no">bitib</span>';
      if (p.scanned && p.scanned.label) h += '<span>' + esc(p.scanned.label) + '</span>';
      if (p.color) h += '<span>' + esc(p.color) + '</span>';
      if (p.cat) h += '<span>' + esc(p.cat) + '</span>';
      h += '</div>';

      if (p.scanned && p.scanned.warn) {
        h += '<div class="kwarn">⚠️ ' + esc(p.scanned.warn_note || 'Bu barkod başqa malda da var') + '</div>';
      }

      h += '<p class="kcode">' + esc(p.scanned ? p.scanned.code : '') + '</p>';
      h += '</div></div>';

      box.innerHTML = h;
      var q2 = $('#kq');
      if (q2) { q2.value = ''; q2.focus(); }
    }).catch(function () {
      box.innerHTML = '<div class="kempty"><p>Bağlantı yoxdur</p></div>';
    });
  }

  /* ---------- AI AXTARIS ---------- */

  var AI_TIPS = [
    'neçə mal var?',
    'pudra var?',
    '10 manata qədər nə var?',
    'ən ucuz corab',
    'qara rəngdə nə var?',
    'yeni gələnlər',
    'qayçı'
  ];

  function viewAI(preset) {
    state.mode = 'ai';
    if (document.body.classList) document.body.classList.add('ai-open');
    view.innerHTML =
      '<div class="aihead">' +
        '<h2>Nə axtarırsan?</h2>' +
        '<p>Adi dildə yaz — «10 manata qədər pudra», «ən ucuz corab», «Aysel üçün olan»</p>' +
      '</div>' +
      '<div class="cbar">' +
        '<input id="aq" type="search" placeholder="sualını yaz…" autocomplete="off">' +
        '<button class="btn" type="button" id="aqGo">Soruş</button>' +
      '</div>' +
      '<div class="aitips">' + AI_TIPS.map(function (t) {
        return '<button type="button" data-tip="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>' +
      '<div id="ares"></div>';

    var inp = $('#aq');
    $('#aqGo').onclick = function () { askAI(inp.value.trim()); };
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); askAI(inp.value.trim()); }
    });

    AI_PREV = null;
    if (preset) { inp.value = preset; askAI(preset); }
    else inp.focus();
  }

  var AI_PREV = null;

  function askAI(q) {
    if (!q) return;
    var box = $('#ares');
    if (!box) return;
    var inp = $('#aq');
    if (inp) inp.value = q;

    box.innerHTML = '<div class="aians">☁️ baxılır…</div>';

    fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: q, prev: AI_PREV })
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r.ok) {
        box.innerHTML = '<div class="aians err">' + esc(r.error || 'Alınmadı') + '</div>';
        return;
      }

      /* növbəti sual bunun davamı ola bilər */
      AI_PREV = { q: q, words: r.used_words || [] };

      var h = '<div class="aians">' + esc(r.answer);
      if (r.filters) {
        var bits = [];
        if (r.filters.max_price != null) bits.push('≤ ' + r.filters.max_price + ' ₼');
        if (r.filters.min_price != null) bits.push('≥ ' + r.filters.min_price + ' ₼');
        if (r.filters.color) bits.push(esc(r.filters.color));
        if (r.filters.in_stock) bits.push('yalnız mövcud');
        if (bits.length) h += '<span class="afil">' + bits.join(' · ') + '</span>';
      }
      h += '</div>';
      box.innerHTML = h;

      /* nəticə varsa davam sualları təklif edirik */
      if (r.items && r.items.length && r.kind !== 'count') {
        var follow = el('div', 'aitips follow');
        [['bunlardan ucuzu?', 'ucuz'], ['bunlardan bahası?', 'baha'],
         ['yalnız mövcud olanlar', 'var']].forEach(function (pair) {
          var b2 = el('button', null, pair[0]);
          b2.type = 'button';
          b2.onclick = function () { askAI(pair[0]); };
          follow.appendChild(b2);
        });
        box.appendChild(follow);
      }

      if (r.items && r.items.length) {
        if (r.kind === 'count') {
          var hd = el('div', 'section-head');
          hd.appendChild(el('h2', null, 'Son əlavələr'));
          box.appendChild(hd);
        }
        box.appendChild(grid(r.items));
      }
    }).catch(function () {
      box.innerHTML = '<div class="aians err">Bağlantı qurulmadı</div>';
    });
  }

  /* ---------- BARKOD QOVLUGU (kassir ucun) ---------- */

  var WHO_KEY = 'jolly_who';
  function who() { try { return localStorage.getItem(WHO_KEY) || ''; } catch (e) { return ''; } }
  function setWho(v) { try { localStorage.setItem(WHO_KEY, v); } catch (e) {} }

  function hiLite(code, q) {
    var i = code.indexOf(q);
    if (i < 0) return esc(code);
    return esc(code.slice(0, i)) + '<b class="hit">' + esc(code.slice(i, i + q.length)) +
      '</b>' + esc(code.slice(i + q.length));
  }

  var BCF = { tab: 'catalog', q: '', sel: [], cat: [], gen: [] };

  function viewCodes() {
    state.mode = 'codes';
    view.innerHTML =
      '<div class="bcf-head">' +
        '<h2>📁 Barkod qovluğu</h2>' +
        '<p>Rəqəm yaz — sistemdə varsa tapır, yoxdursa yeni boş barkod yaradır.</p>' +
      '</div>' +
      '<div class="cbar">' +
        '<input id="cq" type="search" inputmode="numeric" pattern="[0-9]*" ' +
          'placeholder="Barkod rəqəmləri…" autocomplete="off">' +
        '<button class="btn" type="button" id="cqCam">📷</button>' +
      '</div>' +
      '<button class="btn w" type="button" id="findOrMake">🔍 Tap / Yarat</button>' +
      '<div id="bcfMsg"></div>' +
      '<button class="btn ghost w kgo" type="button" id="goKassa">▥ Kassa rejimi</button>' +
      '<div class="bcf-tabs">' +
        '<button type="button" id="tabCat" data-bcftab="catalog">📦 Kataloq</button>' +
        '<button type="button" id="tabNew" data-bcftab="new">🆕 Yaradılanlar</button>' +
      '</div>' +
      '<div id="bcfSel"></div>' +
      '<div id="cres"></div>';

    var inp = $('#cq');
    inp.focus();
    var t = null;
    inp.addEventListener('input', function () {
      clearTimeout(t);
      BCF.q = inp.value.replace(/\D/g, '');
      t = setTimeout(function () { loadFolder(); }, 220);
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); findOrMake(); }
    });

    $('#cqCam').onclick = function () {
      camScan(function (c) { inp.value = c; BCF.q = c.replace(/\D/g, ''); findOrMake('scan'); });
    };
    $('#findOrMake').onclick = function () { findOrMake(); };
    $('#goKassa').onclick = function () { viewKassa(); };

    loadFolder();
  }

  function setBcfTab(t) { BCF.tab = t; BCF.sel = []; drawFolder(); }

  /* Tək düymə: varsa tapır, yoxdursa dərhal yaradır — heç nə soruşmur */
  function findOrMake(src) {
    var code = String(BCF.q || '').replace(/\D/g, '');
    var msg = $('#bcfMsg');
    if (!code) { toast('Rəqəm yaz'); return; }

    api2('/api/missing/quick', { code: code, source: src || 'manual' }).then(function (r) {
      if (!r.ok) { msg.innerHTML = '<div class="bcf-note err">' + esc(r.error || '') + '</div>'; return; }

      if (r.exists) {
        msg.innerHTML = '<div class="bcf-note ok">✅ Sistemdə var: <b>' + esc(r.name) + '</b></div>';
        BCF.tab = 'catalog';
        beep(true);
        loadFolder();
        return;
      }
      if (r.already) {
        msg.innerHTML = '<div class="bcf-note">🆕 Bu barkod artıq «Yaradılanlar» qovluğundadır.</div>';
        BCF.tab = 'new';
        loadFolder();
        return;
      }
      msg.innerHTML = '<div class="bcf-note warn">❌ Tapılmadı → 🆕 boş barkod yaradıldı.<br>' +
        'Aşağıda adını yaz, sonra məhsula çevir.</div>';
      beep(false);
      BCF.tab = 'new';
      $('#cq').value = '';
      BCF.q = '';
      loadFolder();
    });
  }

  function loadFolder() {
    var q = BCF.q;
    var jobs = [
      q.length >= 2 ? api('/api/codesearch?q=' + encodeURIComponent(q)) : Promise.resolve({ ok: true, items: [] }),
      api('/api/missing')
    ];
    Promise.all(jobs).then(function (res) {
      BCF.cat = (res[0] && res[0].items) || [];
      BCF.gen = (res[1] && res[1].items) || [];
      if (q) BCF.gen = BCF.gen.filter(function (x) { return String(x.code).indexOf(q) > -1; });
      drawFolder();
    });
  }

  function drawFolder() {
    var tc = $('#tabCat'), tn = $('#tabNew');
    if (tc) {
      tc.textContent = '📦 Kataloq (' + BCF.cat.length + ')';
      tc.className = BCF.tab === 'catalog' ? 'on' : '';
    }
    if (tn) {
      tn.textContent = '🆕 Yaradılanlar (' + BCF.gen.length + ')';
      tn.className = BCF.tab === 'new' ? 'on' : '';
    }

    var box = $('#cres');
    var selBox = $('#bcfSel');
    if (!box) return;

    if (BCF.tab === 'catalog') {
      if (selBox) selBox.innerHTML = '';
      if (!BCF.cat.length) {
        box.innerHTML = '<p class="ql-hint">' +
          (BCF.q.length >= 2 ? 'Bu rəqəmlərlə mal tapılmadı.' : 'Axtarmaq üçün rəqəm yaz.') + '</p>';
        return;
      }
      box.innerHTML = '<div class="bcf-grid">' + BCF.cat.map(function (x) {
        return '<button class="bcard" type="button" data-openp="' + x.id + '">' +
          '<span class="bpic">' +
            (x.cover ? '<img src="' + img(x.cover) + '" alt="">'
                     : '<span class="bbc" data-bc="' + esc(x.code) + '"></span>') +
          '</span>' +
          '<span class="bname">' + esc(x.name) + '</span>' +
          '<span class="bnum">' + hiLite(x.code, BCF.q) + '</span>' +
          (x.price != null ? '<span class="bprice">' + money(x.price) + ' ₼</span>' : '') +
        '</button>';
      }).join('') + '</div>';
      drawBarcodes(box);
      return;
    }

    /* Yaradılanlar */
    if (selBox) {
      selBox.innerHTML = BCF.sel.length
        ? '<div class="bcf-bulk"><span>' + BCF.sel.length + ' seçildi</span>' +
          '<button class="btn sm" type="button" id="bulkMake">Məhsula çevir</button>' +
          '<button class="btn ghost sm" type="button" id="bulkClear">Ləğv</button></div>'
        : '';
      if (BCF.sel.length) {
        $('#bulkMake').onclick = function () {
          if (!confirm(BCF.sel.length + ' barkod məhsula çevrilsin?')) return;
          api2('/api/admin/missing/bulkmake', { ids: BCF.sel }).then(function (r) {
            if (!r.ok) { toast(r.error || 'Alınmadı'); return; }
            toast(r.n + ' məhsul yaradıldı');
            BCF.sel = [];
            loadFolder();
          });
        };
        $('#bulkClear').onclick = function () { BCF.sel = []; drawFolder(); };
      }
    }

    if (!BCF.gen.length) {
      box.innerHTML = '<p class="ql-hint">Gözləyən boş barkod yoxdur.</p>';
      return;
    }

    box.innerHTML = BCF.gen.map(function (x) {
      var d = new Date(x.ts * 1000);
      var dd = ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2);
      var on = BCF.sel.indexOf(x.id) > -1;
      return '<div class="grow' + (on ? ' on' : '') + '">' +
        '<button class="gsel" type="button" data-gsel="' + x.id + '">' + (on ? '☑' : '☐') + '</button>' +
        '<span class="gpic"><span class="bbc" data-bc="' + esc(x.code) + '"></span></span>' +
        '<span class="gt">' +
          (x.note ? '<b>' + esc(x.note) + '</b>' : '<b class="empty">Adsız — boş barkod</b>') +
          '<span class="gnum">' + hiLite(x.code, BCF.q) + '</span>' +
          '<small>' + (x.who === 'skan' ? '📷 skanda tapılmadı' : '🆕') + ' · ' + dd +
            (x.price != null ? ' · ' + money(x.price) + ' ₼' : '') + '</small>' +
        '</span>' +
        '<span class="gacts">' +
          '<button type="button" data-gname="' + x.id + '" title="Ad">✏️</button>' +
          '<button type="button" data-glook="' + x.id + '" title="Adını tap">🌐</button>' +
          '<button type="button" data-gmake="' + x.id + '" title="Məhsula çevir">➕</button>' +
        '</span>' +
      '</div>';
    }).join('');
    drawBarcodes(box);
  }

  function bcfName(id) {
    var g = BCF.gen.filter(function (x) { return x.id === Number(id); })[0];
    if (!g) return;
    var nm = prompt('Bu barkod nədir?', g.note || '');
    if (nm === null) return;
    var pv = prompt('Qiyməti (bilmirsənsə boş burax):', g.price != null ? g.price : '');
    api2('/api/missing/rename', {
      id: g.id, note: nm.trim(),
      price: (pv === null || pv.trim() === '') ? null : Number(pv)
    }).then(function () { toast('Yazıldı'); loadFolder(); });
  }

  function bcfLookup(id) {
    var g = BCF.gen.filter(function (x) { return x.id === Number(id); })[0];
    if (!g) return;
    toast('🌐 axtarılır…');
    api('/api/admin/barcode-lookup?code=' + encodeURIComponent(g.code)).then(function (r) {
      if (!r.ok || !r.found) { toast('İnternetdə tapılmadı'); return; }
      var nm = r.brand ? (r.title + ' · ' + r.brand) : r.title;
      api2('/api/missing/rename', { id: g.id, note: nm, price: g.price }).then(function () {
        toast('Tapıldı: ' + r.title);
        loadFolder();
      });
    });
  }

  function bcfMake(id) {
    api2('/api/admin/missing/bulkmake', { ids: [Number(id)] }).then(function (r) {
      if (!r.ok) { toast(r.error || 'Alınmadı'); return; }
      toast('Məhsul yaradıldı');
      loadFolder();
    });
  }

  function api2(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: 'Bağlantı yoxdur' }; });
  }

  /* kamera ile oxuma */
  function camScan(cb) {
    if (!('BarcodeDetector' in window)) { toast('Bu brauzer kamera oxumasını dəstəkləmir'); return; }
    var w = document.createElement('div');
    w.className = 'camwrap';
    w.innerHTML = '<video playsinline muted></video><div class="camframe"></div>' +
      '<p>Barkodu çərçivəyə tut</p><button class="btn" type="button">Bağla</button>';
    document.body.appendChild(w);

    var v = w.querySelector('video'), st = null, tm = null;
    function stop() {
      if (tm) clearInterval(tm);
      if (st) st.getTracks().forEach(function (t) { t.stop(); });
      w.remove();
    }
    w.querySelector('button').onclick = stop;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then(function (stream) {
        st = stream; v.srcObject = stream; v.play();
        var det = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']
        });
        tm = setInterval(function () {
          det.detect(v).then(function (cs) {
            if (cs && cs.length) {
              var val = String(cs[0].rawValue || '').trim();
              if (val) { if (navigator.vibrate) navigator.vibrate(60); stop(); cb(val); }
            }
          }).catch(function () {});
        }, 320);
      }).catch(function () { toast('Kameraya icazə verilmədi'); stop(); });
  }

  /* ---------- qovluqlar ---------- */

  function folders() {
    var cats = (CAT.cats || []).filter(function (c) { return c.n; });
    var tags = (CAT.tags || []).filter(function (t) { return t.n; });
    if (!cats.length && !tags.length) return null;

    var wrap = el('div', 'folders');

    var head = el('div', 'section-head');
    head.appendChild(el('h2', null, 'Bölmələr'));
    wrap.appendChild(head);

    var g = el('div', 'fgrid');

    cats.forEach(function (c) {
      var b = el('button', 'folder');
      b.type = 'button';
      var kids = (c.children || []).filter(function (x) { return x.n; });
      b.innerHTML =
        '<span class="fico">' + esc(c.icon || '▤') + '</span>' +
        '<span class="fname">' + esc(c.name) + '</span>' +
        '<span class="fnum">' + c.n + ' mal' +
          (kids.length ? ' · ' + kids.length + ' alt bölmə' : '') + '</span>';
      b.onclick = function () {
        clearFilters();
        state.cat = c.id;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        go();
      };
      g.appendChild(b);
    });

    tags.forEach(function (t) {
      var b = el('button', 'folder tag');
      b.type = 'button';
      b.innerHTML =
        '<span class="fico">◇</span>' +
        '<span class="fname">' + esc(t.name) + '</span>' +
        '<span class="fnum">' + t.n + ' mal</span>';
      b.onclick = function () {
        clearFilters();
        state.tag = t.id;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        go();
      };
      g.appendChild(b);
    });

    wrap.appendChild(g);
    return wrap;
  }

  /* ---------- marka / reng / siralama paneli ---------- */

  function filterBar() {
    var bar = el('div', 'fbar');

    function sel(label, opts, cur, on) {
      var w = el('label', 'fsel');
      w.appendChild(el('span', null, label));
      var s = document.createElement('select');
      opts.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o[0];
        op.textContent = o[1];
        if (String(cur) === String(o[0])) op.selected = true;
        s.appendChild(op);
      });
      s.onchange = function () { on(s.value); };
      w.appendChild(s);
      bar.appendChild(w);
    }

    var brands = [['', 'Bütün markalar']];
    (CAT.brands || []).forEach(function (b) { if (b.n) brands.push([b.id, b.name]); });
    if (brands.length > 1) {
      sel('Marka', brands, state.brand, function (v2) { state.brand = v2; go(); });
    }

    var colors = [['', 'Bütün rənglər']];
    (CAT.colors || []).forEach(function (c) { colors.push([c, c]); });
    if (colors.length > 1) {
      sel('Rəng', colors, state.color, function (v2) { state.color = v2; go(); });
    }

    sel('Sıralama', [
      ['new', 'Əvvəlcə yenilər'],
      ['popular', 'Ən çox baxılan'],
      ['price_asc', 'Ucuzdan bahaya'],
      ['price_desc', 'Bahadan ucuza'],
      ['name', 'Ada görə']
    ], state.sort, function (v2) { state.sort = v2; go(); });

    return bar;
  }

  /* ---------- alt bolme lenti ---------- */

  function subChips(parentId) {
    var parent = (CAT.cats || []).filter(function (c) { return String(c.id) === String(parentId); })[0];
    if (!parent || !parent.children || !parent.children.length) return null;

    var box = el('nav', 'chips');
    parent.children.forEach(function (c) {
      if (!c.n) return;
      var b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.cat) === String(c.id) ? 'true' : 'false');
      b.innerHTML = esc(c.name) + '<span class="n">' + c.n + '</span>';
      b.onclick = function () {
        state.cat = String(state.cat) === String(c.id) ? parent.id : c.id;
        state.page = 1;
        go();
      };
      box.appendChild(b);
    });
    return box.children.length ? box : null;
  }

  /* ---------- siyahi yukle ---------- */

  function query() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat) p.set('cat', state.cat);
    if (state.brand) p.set('brand', state.brand);
    if (state.tone) p.set('tone', state.tone);
    if (state.color) p.set('color', state.color);
    if (state.tag) p.set('tag', state.tag);
    if (state.badge) p.set('badge', state.badge);
    if (state.sale) p.set('sale', state.sale);
    if (state.stock) p.set('stock', state.stock);
    p.set('sort', state.sort);
    p.set('page', state.page);
    return '/api/products?' + p.toString();
  }

  function clearFilters() {
    state.cat = ''; state.brand = ''; state.tag = '';
    state.color = ''; state.tone = ''; state.sale = ''; state.badge = '';
  }

  function go(keepPage) {
    if (!keepPage) state.page = 1;
    state.mode = 'home';
    if (document.body.classList) document.body.classList.remove('ai-open');
    renderChips();
    load();
  }

  function load() {
    if (loading) return;
    loading = true;

    if (state.page === 1) {
      view.innerHTML = '<div class="skeleton-grid"><div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
    }

    api(query()).then(function (r) {
      loading = false;
      if (!r.ok) { view.innerHTML = ''; view.appendChild(errorBox()); return; }
      lastTotal = r.total;

      if (state.page > 1) {
        var g = view.querySelector('.grid');
        r.items.forEach(function (p) { g.appendChild(card(p)); });
        drawCardCodes(g);
        var mb = view.querySelector('.more-btn');
        if (mb) { if (r.more) { mb.textContent = 'Daha çox'; mb.disabled = false; } else mb.remove(); }
        return;
      }

      view.innerHTML = '';

      /* Heç bir süzgəc yoxdursa əvvəlcə qovluqları göstəririk */
      if (!state.q && !state.cat && !state.brand && !state.tag) {
        var fold = folders();
        if (fold) view.appendChild(fold);
      }

      var sub = state.cat ? subChips(topOf(state.cat)) : null;
      if (sub) view.appendChild(sub);

      view.appendChild(filterBar());

      if (!r.items.length) { view.appendChild(emptyBox()); return; }

      var head = el('div', 'section-head');
      if (state.cat || state.tag || state.brand) {
        var back = el('button', 'backb', '‹ Bölmələr');
        back.type = 'button';
        back.onclick = function () {
          clearFilters();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          go();
        };
        view.appendChild(back);
      }
      var h = el('h2', null, headTitle());
      head.appendChild(h);
      var cnt = el('span', 'more', r.total + ' məhsul');
      head.appendChild(cnt);
      view.appendChild(head);

      view.appendChild(grid(r.items));

      if (r.more) {
        var b = el('button', 'more-btn', 'Daha çox');
        b.type = 'button';
        b.onclick = function () {
          b.textContent = 'Yüklənir…';
          b.disabled = true;
          state.page++;
          load();
        };
        view.appendChild(b);
      }
    }).catch(function () {
      loading = false;
      view.innerHTML = '';
      view.appendChild(errorBox());
    });
  }

  function topOf(catId) {
    var list = CAT.cats || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(catId)) return list[i].id;
      var ch = list[i].children || [];
      for (var j = 0; j < ch.length; j++) {
        if (String(ch[j].id) === String(catId)) return list[i].id;
      }
    }
    return catId;
  }

  function nameOfCat(id) {
    var list = CAT.cats || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i].name;
      var ch = list[i].children || [];
      for (var j = 0; j < ch.length; j++) {
        if (String(ch[j].id) === String(id)) return ch[j].name;
      }
    }
    return '';
  }

  function headTitle() {
    if (state.q) return '“' + state.q + '”';
    if (state.tag) {
      var t = (CAT.tags || []).filter(function (x) { return String(x.id) === String(state.tag); })[0];
      return t ? t.name : 'Etiket';
    }
    if (state.brand) {
      var b = (CAT.brands || []).filter(function (x) { return String(x.id) === String(state.brand); })[0];
      return b ? b.name : 'Marka';
    }
    if (state.cat) return nameOfCat(state.cat);
    return 'Kataloq';
  }

  function emptyBox() {
    var d = el('div', 'empty');
    var msg = state.q
      ? 'Bu ada uyğun məhsul tapılmadı. Başqa söz yazıb yoxlayın — ya da bizə yazın, anbarda ola bilər.'
      : 'Bu bölmədə hələ məhsul yoxdur.';
    d.innerHTML =
      '<div class="mark2">J</div>' +
      '<h3>Nəticə yoxdur</h3>' +
      '<p>' + esc(msg) + '</p>';
    var wa = waLink('Salam! Axtardığım: ' + (state.q || '…'));
    if (wa) {
      var a = el('a', 'btn wa', 'WhatsApp-da soruş');
      a.href = wa; a.target = '_blank'; a.rel = 'noopener';
      d.appendChild(a);
    }
    if (state.q) {
      var ab = el('button', 'btn', '🤖 AI-dan soruş');
      ab.type = 'button';
      ab.onclick = function () { viewAI(state.q); };
      d.appendChild(ab);
    }
    var b = el('button', 'btn ghost', 'Hamısına bax');
    b.type = 'button';
    b.style.marginLeft = '8px';
    b.onclick = function () { state.q = ''; $('#q').value = ''; clearFilters(); go(); };
    d.appendChild(b);
    return d;
  }

  function errorBox() {
    var d = el('div', 'empty');
    d.innerHTML =
      '<div class="mark2">J</div>' +
      '<h3>Bağlantı qurulmadı</h3>' +
      '<p>İnternetinizi yoxlayın və yenidən cəhd edin.</p>';
    var b = el('button', 'btn', 'Yenidən yüklə');
    b.type = 'button';
    b.onclick = function () { location.reload(); };
    d.appendChild(b);
    return d;
  }

  /* ---------- WhatsApp ---------- */

  function firstBranch() {
    var list = (CAT && CAT.branches) || [];
    return list.length ? list[0] : null;
  }

  function waLink(text) {
    var b = firstBranch();
    if (!b || !b.wa) return '';
    return 'https://wa.me/' + b.wa + '?text=' + encodeURIComponent(text);
  }

  /* ---------- tez baxis: sekil + barkod ---------- */

  var QL = { id: null, idx: 0 };

  function quickLook(id) {
    var p = SEEN[id];
    if (!p) {
      api('/api/products/' + id).then(function (r) {
        if (!r.ok) { toast('Tapılmadı'); return; }
        SEEN[id] = r.item;
        quickLook(id);
      });
      return;
    }

    QL.id = id; QL.idx = 0;
    var codes = p.codes || [];

    var h = '<div class="ql-card">';

    h += '<div class="ql-top">' +
      (p.cover ? '<img src="' + img(p.cover) + '" alt="">' : '<span class="noimg">J</span>') +
      '<div class="ql-t">' +
        (p.brand ? '<span class="brand">' + esc(p.brand) + '</span>' : '') +
        '<b>' + esc(p.name) + '</b>' +
        (p.show_price && p.price
          ? '<span class="ql-price">' + money(p.price) + ' ₼</span>'
          : '') +
      '</div></div>';

    if (codes.length) {
      h += '<div class="ql-codes" id="qlCodes">';
      codes.forEach(function (c, i) {
        h += '<div class="ql-bc" data-i="' + i + '">' +
          (c.label ? '<span class="ql-lab">' + esc(c.label) + '</span>' : '') +
          '<div class="bc" data-bc="' + esc(c.code) + '" data-zoom="' + esc(c.code) + '"></div>' +
          '<p class="ql-tap">toxun — böyüsün</p>' +
          '<button class="ql-copy" type="button" data-copy="' + esc(c.code) + '">Kopyala</button>' +
          '</div>';
      });
      h += '</div>';
      if (codes.length > 1) {
        h += '<p class="ql-hint">' + codes.length + ' barkod — yana sürüşdür</p>';
      }
    } else {
      h += '<p class="ql-hint">Bu malın barkodu yoxdur</p>';
    }

    h += '<div class="ql-acts">';
    h += '<button class="btn wa" type="button" data-wp="' + p.id + '">WP göndər</button>';
    h += '<button class="btn" type="button" data-shar="' + p.id + '">Paylaş</button>';
    if (codes.length) {
      h += '<button class="btn ghost" type="button" data-copy="' + esc(codes[0].code) + '">Barkodu kopyala</button>';
    }
    h += '</div>';

    h += '<p class="ql-hint kb">Kompüterdə <b>F6</b> — barkodu kopyalayır</p>';
    h += '</div>';

    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    sheetBody.innerHTML = '<div class="grab"></div>' +
      '<button class="sheet-close" type="button" data-close>×</button>' + h;
    sheetBody.scrollTop = 0;
    drawBarcodes(sheetBody);

    var row = sheetBody.querySelector('#qlCodes');
    if (row) {
      row.addEventListener('scroll', function () {
        QL.idx = Math.round(row.scrollLeft / Math.max(1, row.clientWidth));
      }, { passive: true });
    }
  }

  /* ---------- paylasma sekli ---------- */

  /* Mehsulun fotosu, adi, barkod zolaqlari ve reqemi — hamisi bir seklde.
     WhatsApp-da acmadan da skanerle oxuna bilir. */
  function shareCard(p, code) {
    var W = 900;
    var cv = document.createElement('canvas');
    var cx = cv.getContext('2d');

    var hasPic = !!p.cover;
    var picH = hasPic ? 640 : 0;
    var barH = 260;
    var textH = 190;
    cv.width = W;
    cv.height = picH + textH + (code ? barH : 0) + 40;

    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, cv.width, cv.height);

    function drawRest(y) {
      /* ad */
      cx.fillStyle = '#2B1A22';
      cx.font = '600 40px system-ui, sans-serif';
      cx.textAlign = 'center';
      var words = String(p.name || '').split(' ');
      var line = '', lines = [];
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (cx.measureText(t).width > W - 80 && line) { lines.push(line); line = w; }
        else line = t;
      });
      if (line) lines.push(line);
      lines = lines.slice(0, 2);
      lines.forEach(function (l, i) { cx.fillText(l, W / 2, y + 46 + i * 48); });

      var y2 = y + 46 + lines.length * 48 + 14;

      if (p.brand) {
        cx.fillStyle = '#8A7078';
        cx.font = '26px system-ui, sans-serif';
        cx.fillText(p.brand, W / 2, y2);
        y2 += 34;
      }

      if (p.show_price && p.price) {
        cx.fillStyle = '#6B2039';
        cx.font = '600 38px Georgia, serif';
        cx.fillText(money(p.price) + ' AZN', W / 2, y2 + 8);
      }

      /* barkod */
      if (code && typeof JBC !== 'undefined') {
        var enc = JBC.encode(code);
        if (enc) {
          var bits = enc.bits;
          var quiet = 60;
          var mw = (W - quiet * 2) / bits.length;
          var by = cv.height - barH + 30;
          var bh = 150;

          cx.fillStyle = '#111111';
          var run = 0;
          for (var i = 0; i <= bits.length; i++) {
            if (bits[i] === '1') { run++; continue; }
            if (run) {
              cx.fillRect(quiet + (i - run) * mw, by, run * mw, bh);
              run = 0;
            }
          }
          cx.fillStyle = '#111111';
          cx.font = '38px ui-monospace, monospace';
          cx.fillText(code, W / 2, by + bh + 46);
        }
      }
    }

    return new Promise(function (res) {
      function finish() {
        drawRest(picH + 10);
        cv.toBlob(function (b) { res(b); }, 'image/png');
      }
      if (!hasPic) { finish(); return; }

      var im = new Image();
      im.onload = function () {
        /* sekli kvadrata sigdiririq */
        var s2 = Math.min(im.width / W, im.height / picH);
        var sw = W * s2, sh = picH * s2;
        var sx = (im.width - sw) / 2, sy = (im.height - sh) / 2;
        cx.fillStyle = '#F3EBEC';
        cx.fillRect(0, 0, W, picH);
        try { cx.drawImage(im, sx, sy, sw, sh, 0, 0, W, picH); } catch (e) {}
        finish();
      };
      im.onerror = function () { picH = 0; cv.height = textH + (code ? barH : 0) + 40;
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); finish(); };
      im.src = img(p.cover);
    });
  }

  function sendWhatsApp(p, code) {
    var txt = p.name + (p.brand ? ' · ' + p.brand : '') +
      (code ? '\nBarkod: ' + code : '') +
      (p.show_price && p.price ? '\nQiymət: ' + money(p.price) + ' ₼' : '');

    toast('Şəkil hazırlanır…');

    shareCard(p, code).then(function (blob) {
      if (!blob) throw new Error('sekil');
      var file = new File([blob], 'jolly-' + (code || p.id) + '.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: txt });
      }

      /* Paylasma dəstəklənmirsə: şəkli endir, sonra WhatsApp-ı mətnlə aç */
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);

      var wa = waLink(txt);
      if (wa) window.open(wa, '_blank');
      else toast('Şəkil endirildi — WhatsApp-a özün göndər');
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      toast('Paylaşılmadı');
    });
  }

  /* ---------- barkodu boyutmek ---------- */

  function zoomCode(code) {
    var w = document.createElement('div');
    w.className = 'bczoom';
    w.innerHTML = '<div class="bczoom-in">' +
      '<p>Kassada oxutmaq üçün — ekranın işığını artırın</p>' +
      '<div class="bcbig" data-bc="' + esc(code) + '"></div>' +
      '<button class="btn" type="button">Bağla</button></div>';
    document.body.appendChild(w);
    if (typeof JBC !== 'undefined') {
      JBC.render(w, { module: 4.2, height: 150, font: 26 });
    }
    w.addEventListener('click', function () { w.remove(); });
  }

  function copyCode(code) {
    if (!code) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(
        function () { toast('Kopyalandı: ' + code); },
        function () { fallbackCopy(code); }
      );
    } else fallbackCopy(code);
  }

  function fallbackCopy(code) {
    var t = document.createElement('textarea');
    t.value = code;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); toast('Kopyalandı: ' + code); }
    catch (e) { toast('Kopyalanmadı'); }
    document.body.removeChild(t);
  }

  /* Kompüterdə F6 — açıq olan barkodu kopyalayır */
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'F6') return;
    if (sheet.hidden) return;
    var list = sheetBody.querySelectorAll('[data-copy]');
    if (!list.length) return;
    e.preventDefault();
    var n = Math.min(QL.idx, list.length - 1);
    copyCode(list[n].dataset.copy);
  });

  /* ---------- mehsul veregi ---------- */

  function openProduct(id) {
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    sheetBody.innerHTML = '<div class="grab"></div><div class="skeleton-grid" style="padding:16px"><div class="sk"></div></div>';

    api('/api/products/' + id).then(function (r) {
      if (!r.ok) { closeSheet(); toast('Məhsul tapılmadı'); return; }
      renderProduct(r.item);
      if (location.hash !== '#/m/' + id) history.pushState({ m: id }, '', '#/m/' + id);
    }).catch(function () {
      closeSheet();
      toast('Bağlantı qurulmadı');
    });
  }

  function renderProduct(p) {
    var imgs = p.images && p.images.length ? p.images : (p.cover ? [p.cover] : []);
    var h = '<div class="grab"></div><button class="sheet-close" type="button" data-close>×</button>';

    h += '<div class="hero">' +
      (imgs.length
        ? '<img id="heroImg" src="' + img(imgs[0]) + '" alt="' + esc(p.name) + '">'
        : '<span class="noimg">J</span>') +
      '</div>';

    if (imgs.length > 1) {
      h += '<div class="strip">';
      imgs.forEach(function (k, i) {
        h += '<img src="' + img(k) + '" data-src="' + img(k) + '" class="' + (i === 0 ? 'on' : '') + '" alt="">';
      });
      h += '</div>';
    }

    h += '<div class="detail">';
    if (p.brand) h += '<div class="brand">' + esc(p.brand) + '</div>';
    h += '<h1>' + esc(p.name) + '</h1>';

    if (p.show_price && p.price) {
      h += '<div class="price-big"><span class="price">' + money(p.price) + '<span class="cur"> ₼</span></span></div>';
    }

    h += '<div class="meta">';
    if (p.cat) h += '<span class="tag">' + esc(p.cat) + '</span>';
    if (p.color) h += '<span class="tag">' + esc(p.color) + '</span>';
    if (p.tone) h += '<span class="tag">Ton ' + esc(p.tone) + '</span>';
    if (p.model) h += '<span class="tag">Model ' + esc(p.model) + '</span>';
    (p.tags || []).forEach(function (t) { h += '<span class="tag">' + esc(t) + '</span>'; });
    if (!(p.codes || []).length && p.short) h += '<span class="tag">Kod ' + esc(p.short) + '</span>';
    h += p.in_stock
      ? '<span class="tag stock-in">Mağazada var</span>'
      : '<span class="tag stock-out">Hazırda bitib</span>';
    h += '</div>';

    if ((p.variants || []).length) {
      h += '<div class="vpick"><p class="eyebrow">Tonlar</p><div class="vrow">';
      p.variants.forEach(function (v) {
        h += '<button class="vchip' + (v.current ? ' on' : '') + (v.in_stock ? '' : ' out') +
          '" type="button" data-vgo="' + v.id + '">' +
          (v.cover ? '<img src="' + img(v.cover) + '" alt="">' : '') +
          '<span>' + esc(v.label) + '</span></button>';
      });
      h += '</div></div>';
    }

    if ((p.codes || []).length) {
      h += '<div class="bc-box"><p class="bc-hint">Kassada oxutmaq üçün göstərin</p>';
      p.codes.forEach(function (c) {
        h += '<div class="bc" data-bc="' + esc(c) + '" data-zoom="' + esc(c) + '"></div>';
      });
      h += '</div>';
    }

    if (p.descr) h += '<div class="block"><h3>Haqqında</h3><p>' + esc(p.descr) + '</p></div>';
    if (p.usage) h += '<div class="block"><h3>İstifadəsi</h3><p>' + esc(p.usage) + '</p></div>';
    if (p.ingr) h += '<div class="block"><h3>Tərkibi</h3><p>' + esc(p.ingr) + '</p></div>';

    h += '<div class="actions">';
    var wa2 = waLink('Salam! Bu məhsulla maraqlanıram: ' + p.name +
      (p.short ? ' (kod ' + p.short + ')' : '') + ' — ' + location.origin + '/p/' + (p.short || p.id));
    if (wa2) h += '<a class="btn wa" href="' + wa2 + '" target="_blank" rel="noopener">WhatsApp-da soruş</a>';
    h += '<button class="btn ghost" type="button" data-share="' + (p.short || p.id) + '">Paylaş</button>';
    h += '<button class="btn ghost" type="button" data-fav2="' + p.id + '">' +
      (isFav(p.id) ? 'Seçilmişdə ✓' : 'Seçilmişə at') + '</button>';
    h += '</div></div>';

    if (p.similar && p.similar.length) {
      h += '<div class="similar"><div class="section-head"><h2>Bunlara da baxın</h2></div><div class="grid" id="simGrid"></div></div>';
    }

    sheetBody.innerHTML = h;
    sheetBody.scrollTop = 0;
    drawBarcodes(sheetBody);

    if (p.similar && p.similar.length) {
      var sg = sheetBody.querySelector('#simGrid');
      p.similar.forEach(function (s) { sg.appendChild(card(s)); });
      drawCardCodes(sg);
    }

    var strip = sheetBody.querySelector('.strip');
    if (strip) {
      strip.addEventListener('click', function (e) {
        var t = e.target.closest('img');
        if (!t) return;
        sheetBody.querySelector('#heroImg').src = t.dataset.src;
        strip.querySelectorAll('img').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
      });
    }
  }

  function closeSheet() {
    sheet.hidden = true;
    sheetBody.innerHTML = '';
    document.body.style.overflow = '';
    if (location.hash.indexOf('#/m/') === 0) history.replaceState({}, '', location.pathname);
  }

  /* ---------- elaqe zolagi ---------- */

  function renderContact() {
    var f = $('#contact');
    var list = (CAT.branches || []);
    var h = '';

    if (list.length) {
      h += '<p class="eyebrow">Bizə yazın</p>';
      list.forEach(function (b) {
        h += '<div class="branch"><h4>' + esc(b.name) + '</h4>';
        if (b.address) h += '<p class="addr">' + esc(b.address) + (b.hours ? ' · ' + esc(b.hours) : '') + '</p>';
        h += '<div class="links">';
        if (b.wa) h += '<a href="https://wa.me/' + b.wa + '" target="_blank" rel="noopener">WhatsApp</a>';
        if (b.phone) h += '<a href="tel:' + esc(b.phone.replace(/\s/g, '')) + '">Zəng et</a>';
        if (b.instagram) h += '<a href="' + esc(b.instagram) + '" target="_blank" rel="noopener">Instagram</a>';
        if (b.map_url) h += '<a href="' + esc(b.map_url) + '" target="_blank" rel="noopener">Xəritədə</a>';
        h += '</div></div>';
      });
    }

    h += '<div class="install" id="installBox" hidden>' +
      '<p>Kataloqu telefonunuza qurun — hər dəfə axtarmadan açılsın.</p>' +
      '<button class="btn" type="button" id="installBtn">Telefona qur</button></div>';

    h += '<div class="sig">' + esc(CAT.store.store_name || 'JOLLY') +
      '<br><small style="opacity:.55">server ' + esc(CAT.build || '?') +
      ' · səhifə ' + PAGE_BUILD + '</small></div>';

    f.innerHTML = h;
    f.hidden = false;
  }

  /* ---------- PWA ---------- */

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    var box = $('#installBox');
    if (box) box.hidden = false;
  });

  document.addEventListener('click', function (e) {
    if (e.target.id === 'installBtn' && deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; $('#installBox').hidden = true; });
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  /* ---------- hadiseler ---------- */

  document.addEventListener('click', function (e) {
    var fv = e.target.closest('[data-fav]');
    if (fv) {
      e.stopPropagation();
      var on = toggleFav(fv.dataset.fav);
      fv.classList.toggle('on', on);
      toast(on ? 'Seçilmişə atıldı' : 'Seçilmişdən çıxarıldı');
      return;
    }

    var fv2 = e.target.closest('[data-fav2]');
    if (fv2) {
      var on2 = toggleFav(fv2.dataset.fav2);
      fv2.textContent = on2 ? 'Seçilmişdə ✓' : 'Seçilmişə at';
      toast(on2 ? 'Seçilmişə atıldı' : 'Seçilmişdən çıxarıldı');
      return;
    }

    var sh = e.target.closest('[data-share]');
    if (sh) {
      var url = location.origin + '/p/' + sh.dataset.share;
      if (navigator.share) navigator.share({ url: url }).catch(function () {});
      else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast('Link kopyalandı'); });
      }
      return;
    }

    var ey = e.target.closest('[data-eye]');
    if (ey) { e.stopPropagation(); quickLook(ey.dataset.eye); return; }

    var zm = e.target.closest('[data-zoom]');
    if (zm) { e.stopPropagation(); zoomCode(zm.dataset.zoom); return; }

    var wp = e.target.closest('[data-wp]');
    if (wp) {
      var pw = SEEN[wp.dataset.wp];
      if (pw) sendWhatsApp(pw, (pw.codes && pw.codes[0]) ? pw.codes[QL.idx] ? pw.codes[QL.idx].code : pw.codes[0].code : '');
      return;
    }

    var shb = e.target.closest('[data-shar]');
    if (shb) {
      var ps = SEEN[shb.dataset.shar];
      if (ps) sendWhatsApp(ps, (ps.codes && ps.codes.length) ? (ps.codes[QL.idx] || ps.codes[0]).code : '');
      return;
    }

    var bt = e.target.closest('[data-bcftab]');
    if (bt) { setBcfTab(bt.dataset.bcftab); return; }

    var gs = e.target.closest('[data-gsel]');
    if (gs) {
      var gid = Number(gs.dataset.gsel);
      var ix = BCF.sel.indexOf(gid);
      if (ix > -1) BCF.sel.splice(ix, 1); else BCF.sel.push(gid);
      drawFolder();
      return;
    }

    var gn = e.target.closest('[data-gname]');
    if (gn) { bcfName(gn.dataset.gname); return; }
    var gl = e.target.closest('[data-glook]');
    if (gl) { bcfLookup(gl.dataset.glook); return; }
    var gm = e.target.closest('[data-gmake]');
    if (gm) { bcfMake(gm.dataset.gmake); return; }

    var kh = e.target.closest('[data-kh]');
    if (kh) { doScan(kh.dataset.kh); return; }

    var tp = e.target.closest('[data-tip]');
    if (tp) { askAI(tp.dataset.tip); return; }

    var opn = e.target.closest('[data-openp]');
    if (opn && !e.target.closest('[data-copy]')) { quickLook(opn.dataset.openp); return; }

    var cp = e.target.closest('[data-copy]');
    if (cp) { e.stopPropagation(); copyCode(cp.dataset.copy); return; }

    var op = e.target.closest('[data-open]');
    if (op) { openProduct(op.dataset.open); return; }

    var vg = e.target.closest('[data-vgo]');
    if (vg) { openProduct(vg.dataset.vgo); return; }

    if (e.target.closest('[data-close]')) { closeSheet(); return; }

    var c = e.target.closest('.card');
    if (c) { quickLook(c.dataset.id); return; }
  });

  var qEl = $('#q');
  var qTimer = null;
  qEl.addEventListener('input', function () {
    $('#qClear').hidden = !qEl.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(function () {
      state.q = qEl.value.trim();
      clearFilters();
      go();
    }, 320);
  });

  $('#qClear').onclick = function () {
    qEl.value = ''; $('#qClear').hidden = true;
    state.q = ''; go(); qEl.focus();
  };

  $('#homeBtn').onclick = function () {
    state.q = ''; qEl.value = ''; $('#qClear').hidden = true;
    clearFilters();
    state.sort = 'new';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    go();
  };

  /* üzən nişan */
  var fab = $('#fab');
  if (fab) {
    fab.onclick = function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      viewAI('');
    };
    /* ilk açılışda özünü tanıtsın, sonra sussun */
    setTimeout(function () {
      var tip = $('#fabTip');
      if (!tip) return;
      tip.classList.add('show');
      setTimeout(function () { tip.classList.remove('show'); }, 3400);
    }, 1800);
  }

  $('#aiBtn').onclick = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (state.mode === 'ai') { go(); return; }
    viewAI('');
  };

  $('#codeBtn').onclick = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (state.mode === 'codes') { go(); return; }
    viewCodes();
  };

  $('#favBtn').onclick = function () {
    var list = favs();
    if (!list.length) { toast('Hələ seçilmiş məhsul yoxdur'); return; }
    view.innerHTML = '';
    var head = el('div', 'section-head');
    head.appendChild(el('h2', null, 'Seçdiklərim'));
    view.appendChild(head);
    var g = el('div', 'grid');
    view.appendChild(g);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    list.forEach(function (id) {
      api('/api/products/' + id).then(function (r) {
        if (r.ok) { g.appendChild(card(r.item)); drawCardCodes(g); }
      }).catch(function () {});
    });
  };

  window.addEventListener('popstate', function () {
    if (location.hash.indexOf('#/m/') === 0) {
      openProduct(location.hash.slice(4));
    } else if (!sheet.hidden) {
      closeSheet();
    }
  });

  window.addEventListener('scroll', function () {
    $('#top').classList.toggle('stuck', window.scrollY > 6);
  }, { passive: true });

  /* ---------- baslangic ---------- */

  api('/api/catalog').then(function (r) {
    if (!r.ok) throw new Error('catalog');
    CAT = r;

    if (r.store && r.store.store_name) {
      document.title = r.store.store_name;
      $('#homeBtn').textContent = r.store.store_name;
      $('.splash-mark').textContent = r.store.store_name;
    }
    if (r.store && r.store.primary) {
      document.documentElement.style.setProperty('--plum', r.store.primary);
      var m = document.querySelector('meta[name=theme-color]');
      if (m) m.content = r.store.primary;
    }
    if (r.store && r.store.accent) {
      document.documentElement.style.setProperty('--rose', r.store.accent);
    }

    $('#favDot').hidden = favs().length === 0;

    renderChips();
    renderContact();

    setTimeout(function () { $('#splash').classList.add('gone'); }, 260);

    if (location.hash.indexOf('#/m/') === 0) {
      go();
      openProduct(location.hash.slice(4));
    } else if (location.hash === '#/kassa') {
      viewKassa();
    } else if (location.hash === '#/ai') {
      viewAI('');
    } else {
      go();
    }
  }).catch(function () {
    $('#splash').classList.add('gone');
    view.innerHTML = '';
    view.appendChild(errorBox());
  });

})();
