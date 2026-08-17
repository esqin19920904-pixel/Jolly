/* ============================================================
   JOLLY Qovluqlar — jolly-qovluq.js
   v1.0  (2026-08-17)

   ────────────────────────────────────────────────────────────
   NƏ ÜÇÜNDÜR (Esqinin sözü ilə)

   "Açkı 545 etmişdik, onun içinə məsələn 100 dənə eynək
    yığmaq istəyirdim — qiymət 10 manat, kodu 545, barkodlar
    da eyni idi."

   Yəni: BİR barkod, BİR qiymət, içində saysız FƏRQLİ mal.
   Kassa 545-i oxuyanda qiymət düz gəlir; Esqin isə içində
   nə olduğunu görür və toplu şəkildə mal əlavə edir.

   ────────────────────────────────────────────────────────────
   NECƏ QURULUB

   Qovluq: `jolly_qovluqlar` açarında — {id, name, code, price}.
   Mal: adi JOLLY məhsuludur, üzərində `qovluqId` sahəsi var;
   barkodu və qiyməti QOVLUQDAN gəlir və hər mala yazılır.

   Niyə barkod hər mala yazılır: köhnə JOLLY-də axtarış
   `Products.findByBarcode(code)` ilə gedir və o, məhsulun öz
   `barcodes` massivinə baxır. Kod hər mala yazılanda 545-i
   skan edəndə həmin 100 mal siyahı kimi çıxır — istənilən
   davranış elə budur.

   Qovluğun qiyməti dəyişəndə içindəki BÜTÜN mallara yayılır.

   Marşrut: #/qovluq   ·   İcazə: İdarə Mərkəzindən (id `qovluq`)
   ============================================================ */
(function (global) {
  'use strict';

  if (global.JollyQovluq) return;          /* iki dəfə yüklənsə zərərsiz */

  var KEY = 'jolly_qovluqlar';
  var ROUTE = '#/qovluq';

  /* JOLLY-nin nüvə modulları `const`-dur və window-a yapışmır */
  function peek(name) {
    try {
      return new Function('try{return typeof ' + name + '!=="undefined"?' + name + ':null}catch(e){return null}')();
    } catch (e) { return null; }
  }
  function DB()  { return global.JollyDB || peek('JollyDB'); }
  function IMG() { return global.JollyStorage || peek('JollyStorage'); }
  function REG() { return global.ModuleRegistry || peek('ModuleRegistry'); }

  function toast(msg, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error)   return T.error(msg);
      if (T && kind === 'ok'    && T.success) return T.success(msg);
      if (T && T.info) return T.info(msg);
    } catch (e) {}
    console.log('[Qovluq]', msg);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function go(hash) {
    var R = global.JollyRouter || peek('JollyRouter');
    if (R && R.go) R.go(hash); else global.location.hash = hash;
  }

  /* ══════════════════════════════════════════════════════════
     Anbar
     ══════════════════════════════════════════════════════════ */
  function all() {
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { toast('Yaddaşa yazıla bilmədi', 'error'); return false; }
  }
  function get(id) {
    var l = all();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function newId() {
    return 'qov_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function items(qid) {
    var d = DB();
    try {
      var list = (d && d.Products && d.Products.all) ? (d.Products.all() || []) : [];
      return list.filter(function (p) { return p && p.qovluqId === qid; });
    } catch (e) { return []; }
  }

  /* ══════════════════════════════════════════════════════════
     Əməliyyatlar
     ══════════════════════════════════════════════════════════ */
  function create(name, code, price) {
    name = String(name || '').trim();
    if (!name) { toast('Ad boş ola bilməz', 'error'); return null; }
    code = String(code || '').replace(/\D/g, '');

    /* Eyni kod başqa qovluqda varsa qarışıqlıq olar */
    var l = all();
    for (var i = 0; i < l.length; i++) {
      if (code && l[i].code === code) {
        toast('Bu barkod "' + l[i].name + '" qovluğundadır', 'error');
        return null;
      }
    }
    var q = {
      id: newId(), name: name, code: code,
      price: (price === '' || price == null) ? null : Number(price),
      createdAt: Date.now()
    };
    l.unshift(q);
    save(l);
    return q;
  }

  /* Qovluğun üz şəkli — siyahıda və kartda görünür */
  function setCover(id, ref) {
    var l = all();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) { l[i].image = ref; save(l); return true; }
    return false;
  }

  function edit(id, name, code, price) {
    var l = all(), q = null;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) q = l[i];
    if (!q) return false;

    code = String(code || '').replace(/\D/g, '');
    for (var j = 0; j < l.length; j++) {
      if (l[j].id !== id && code && l[j].code === code) {
        toast('Bu barkod "' + l[j].name + '" qovluğundadır', 'error');
        return false;
      }
    }

    var newPrice = (price === '' || price == null) ? null : Number(price);
    var codeChanged = q.code !== code;
    var priceChanged = q.price !== newPrice;

    q.name = String(name || q.name).trim();
    q.code = code;
    q.price = newPrice;
    save(l);

    /* Dəyişiklik içindəki BÜTÜN mallara yayılır — 100 malı
       bir-bir düzəltmək lazım gəlmir */
    if (codeChanged || priceChanged) {
      var d = DB(), n = 0;
      items(id).forEach(function (p) {
        var patch = {};
        if (priceChanged) patch.price = newPrice;
        if (codeChanged) patch.barcodes = code ? [code] : [];
        try { d.Products.update(p.id, patch); n++; } catch (e) {}
      });
      if (n) toast('✅ ' + n + ' mala tətbiq olundu', 'ok');
    }
    return true;
  }

  function remove(id) {
    /* Qovluq silinəndə mallar QALIR — yalnız bağlantı qırılır */
    var d = DB();
    items(id).forEach(function (p) {
      try { d.Products.update(p.id, { qovluqId: '' }); } catch (e) {}
    });
    save(all().filter(function (x) { return x.id !== id; }));
  }

  /* Qovluğun öz üz şəkli */
  function setCover(id, ref) {
    var l = all();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) l[i].cover = ref;
    save(l);
  }

  /* Mövcud (artıq yaradılmış) malı qovluğa salmaq —
     barkod və qiymət ona da tətbiq olunur */
  function attach(qid, pid) {
    var q = get(qid), d = DB();
    if (!q) return false;
    try {
      d.Products.update(pid, {
        qovluqId: qid,
        price: q.price,
        barcodes: q.code ? [q.code] : []
      });
      return true;
    } catch (e) { return false; }
  }

  function detach(pid) {
    var d = DB();
    try { d.Products.update(pid, { qovluqId: '' }); return true; }
    catch (e) { return false; }
  }

  /* İş masasına kart kimi qoymaq — İdarə Mərkəzi varsa ondan keçir */
  function onDash() {
    var I = global.JollyIdare;
    if (!I || !I.dashOf) return false;
    try { return (I.dashOf('__me') || []).indexOf('qovluq') !== -1; }
    catch (e) { return false; }
  }
  function toggleDash() {
    var I = global.JollyIdare;
    if (!I || !I.tgD) {
      toast('İdarə Mərkəzi yüklənməyib — bir az sonra yenidən yoxla', 'error');
      return;
    }
    try {
      /* İdarə hədəf kimi "Mən"i seçsin, sonra açsın/bağlasın */
      if (I.dashPick) I.dashPick('__me');
      I.tgD('qovluq');
      toast(onDash() ? '⌂ İş masasına əlavə olundu' : 'İş masasından götürüldü', 'ok');
      repaint();
    } catch (e) { toast('Alınmadı', 'error'); }
  }

  /* Toplu mal əlavəsi — barkod və qiymət qovluqdan gəlir */
  function addItems(qid, rows) {
    var q = get(qid);
    if (!q) return 0;
    var d = DB(), n = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var name = String((r && r.name) || '').trim();
      if (!name) continue;
      try {
        d.Products.add({
          name: name,
          price: q.price,
          barcodes: q.code ? [q.code] : [],
          images: (r.images && r.images.length) ? r.images : [],
          group: q.group || '',
          qovluqId: qid
        });
        n++;
      } catch (e) {}
    }
    return n;
  }

  /* Kataloqda hazır olan malı qovluğa salmaq — barkod və qiymət
     qovluqdan yazılır, yəni mal avtomatik qovluğun qaydasına düşür */
  function attach(qid, productId) {
    var q = get(qid), d = DB();
    if (!q) return false;
    try {
      d.Products.update(productId, {
        qovluqId: qid,
        price: q.price,
        barcodes: q.code ? [q.code] : []
      });
      return true;
    } catch (e) { return false; }
  }

  function detachProduct(productId) {
    try { DB().Products.update(productId, { qovluqId: '' }); return true; }
    catch (e) { return false; }
  }

  /* Ad artıq qovluqdadırsa xəbərdarlıq — 100 mal yazarkən
     təsadüfən eynisini iki dəfə yazmaq asandır */
  function dupNames(qid, rows) {
    var have = {}, out = [];
    items(qid).forEach(function (p) { have[String(p.name || '').toLowerCase().trim()] = 1; });
    rows.forEach(function (r) {
      var k = String(r.name || '').toLowerCase().trim();
      if (have[k]) out.push(r.name);
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  var openId = null, draft = [];

  function css() {
    if (document.getElementById('qov-css')) return;
    var st = document.createElement('style');
    st.id = 'qov-css';
    st.textContent = [
      '.qv-row{display:flex;align-items:center;gap:11px;padding:13px;border-radius:15px;',
      'background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);',
      'margin-bottom:9px;cursor:pointer}',
      '.qv-row:active{background:rgba(255,255,255,.09)}',
      '.qv-row .ic{font-size:26px;flex:none}',
      '.qv-row .b{flex:1;min-width:0}',
      '.qv-row .nm{font-size:14.5px;font-weight:700}',
      '.qv-row .mt{font-size:12px;opacity:.6;margin-top:3px}',
      '.qv-cnt{font-size:13px;padding:4px 11px;border-radius:11px;',
      'background:rgba(147,197,253,.16);color:#93c5fd;font-weight:700}',
      '.qv-hero{border-radius:18px;padding:16px;margin-bottom:12px;',
      'background:linear-gradient(150deg,rgba(147,197,253,.13),rgba(255,255,255,.02));',
      'border:1px solid rgba(147,197,253,.3)}',
      '.qv-price{font-size:30px;font-weight:800;color:#93c5fd;line-height:1}',
      '.qv-code{font-family:ui-monospace,monospace;font-size:15px;letter-spacing:.09em;opacity:.85}',
      '.qv-in{width:100%;padding:12px 14px;border-radius:12px;margin-bottom:9px;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:inherit}',
      '.qv-line{display:flex;align-items:center;gap:9px;padding:8px 0;',
      'border-bottom:1px solid rgba(255,255,255,.06);font-size:13.5px}',
      '.qv-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}',
      '.qv-cell{border-radius:14px;padding:10px;background:rgba(255,255,255,.045);',
      'border:1px solid rgba(255,255,255,.09);cursor:pointer}',
      '.qv-cell img,.qv-cell .ph{width:100%;height:110px;border-radius:10px;object-fit:cover;',
      'background:rgba(255,255,255,.06);display:block}',
      '.qv-cell .ph{display:flex;align-items:center;justify-content:center;font-size:30px}',
      '.qv-cov{width:44px;height:44px;border-radius:11px;object-fit:cover;flex:none}',
      '.qv-cell .t{font-size:12.5px;font-weight:600;margin-top:7px;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function render() {
    css();
    return openId ? one(openId) : list();
  }

  function list() {
    var l = all();
    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
             '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">🗂 Qovluqlar</h2>' +
             '<div class="muted" style="font-size:12.5px;">bir barkod · bir qiymət · çoxlu mal</div>' +
           '</div></div>');

    h.push('<div class="card" style="font-size:12.5px;opacity:.75;line-height:1.6">' +
           'Məsələn <b>Açkı 545</b> — barkod 545, qiymət 10 ₼, içində 100 fərqli mal. ' +
           'Kassa barkodu oxuyanda qiymət düz gəlir.</div>');

    h.push('<div class="row" style="display:flex;gap:8px">' +
             '<button class="btn btn-primary" style="flex:1" onclick="JollyQovluq.newQ()">' +
               '＋ Yeni qovluq</button>' +
             '<button class="btn btn-ghost" style="flex:none;padding:0 14px" ' +
               'onclick="JollyQovluq.dash()">' + (onDash() ? '⌂ ✓' : '⌂ +') + '</button>' +
           '</div>');
    h.push('<div class="muted" style="font-size:11.5px;margin-top:6px">' +
           '⌂ düyməsi — Qovluqları iş masasına kart kimi qoyur</div>');

    h.push('<div class="mt" style="margin-top:12px">');
    if (!l.length) {
      h.push('<div class="empty-state"><div class="big-icon">🗂</div><h3>Hələ qovluq yoxdur</h3></div>');
    } else {
      for (var i = 0; i < l.length; i++) {
        var q = l[i], n = items(q.id).length;
        var I0 = IMG();
        var cov = (q.cover && I0 && I0.imgAttr)
          ? '<img class="ic" ' + I0.imgAttr(q.cover, true) +
            ' style="width:44px;height:44px;border-radius:11px;object-fit:cover" alt="">'
          : '<span class="ic">🗂</span>';
        h.push('<div class="qv-row" onclick="JollyQovluq.open(\'' + q.id + '\')">' +
                 cov +
                 '<span class="b"><div class="nm">' + esc(q.name) + '</div>' +
                   '<div class="mt">' + (q.code ? '▣ ' + esc(q.code) : 'barkodsuz') +
                   (q.price != null ? ' · ' + q.price + ' ₼' : '') + '</div></span>' +
                 '<span class="qv-cnt">' + n + '</span>' +
               '</div>');
      }
    }
    h.push('</div><div style="height:26px"></div></div>');
    return h.join('');
  }

  function one(id) {
    var q = get(id);
    if (!q) { openId = null; return list(); }
    var its = items(id);

    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="qv-hero">' +
             '<div style="display:flex;align-items:center;gap:11px">' +
               '<span style="font-size:30px">🗂</span>' +
               '<span style="flex:1;min-width:0">' +
                 '<div style="font-size:17px;font-weight:800">' + esc(q.name) + '</div>' +
                 '<div class="muted" style="font-size:12px">' + its.length +
                   ' mal · hamısının barkodu və qiyməti eynidir</div>' +
               '</span>' +
               '<button class="btn btn-ghost btn-sm" onclick="JollyQovluq.back()">Geri</button>' +
             '</div>' +
             '<div style="display:flex;align-items:flex-end;gap:14px;margin-top:13px">' +
               (q.price != null ? '<div class="qv-price">' + q.price +
                 '<span style="font-size:14px;opacity:.6">₼</span></div>' : '') +
               '<div class="qv-code" style="flex:1">' + (q.code ? esc(q.code) : '—') + '</div>' +
             '</div>' +
             '<div class="row" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
               '<button class="btn btn-ghost btn-sm" onclick="JollyQovluq.editQ()">✎ Dəyiş</button>' +
               '<button class="btn btn-ghost btn-sm" onclick="JollyQovluq.cover()">🖼 Üz şəkli</button>' +
               '<button class="btn btn-ghost btn-sm" onclick="JollyQovluq.delQ()">🗑 Sil</button>' +
             '</div>' +
           '</div>');

    /* Mövcud malı qovluğa salmaq */
    h.push('<div class="card">' +
             '<div style="font-weight:700;margin-bottom:4px">Mövcud malı qovluğa sal</div>' +
             '<div class="muted" style="font-size:12px;margin-bottom:9px">' +
               'Artıq yazılmış mal varsa adını axtar və seç — barkod və qiymət ona da tətbiq olunacaq.</div>' +
             '<input id="qvFind" class="qv-in" placeholder="Mal adı ilə axtar…" ' +
               'autocomplete="off" oninput="JollyQovluq.find(this.value)">' +
             '<div id="qvHits"></div>' +
           '</div>');

    /* Toplu əlavə */
    h.push('<div class="card">' +
             '<div style="font-weight:700;margin-bottom:4px">Toplu mal əlavə et</div>' +
             '<div class="muted" style="font-size:12px;margin-bottom:10px">' +
               'Adı yaz və Enter bas — siyahıya düşür. Barkod və qiymət qovluqdan gələcək.</div>' +
             '<div style="display:flex;gap:8px">' +
               '<input id="qvName" class="qv-in" style="flex:1;margin:0" placeholder="Malın adı…" ' +
                 'autocomplete="off" onkeydown="if(event.key===\'Enter\'){event.preventDefault();JollyQovluq.push()}">' +
               '<button class="btn btn-primary" style="width:auto;padding:0 16px" ' +
                 'onclick="JollyQovluq.push()">＋</button>' +
             '</div>' +
             '<div id="qvDraft" style="margin-top:10px">' + draftHtml() + '</div>' +
             (draft.length ? '<button class="btn btn-primary" style="width:100%;margin-top:10px" ' +
               'onclick="JollyQovluq.commit()">💾 ' + draft.length + ' malı qovluğa yaz</button>' : '') +
           '</div>');

    h.push('<div class="section-title">Qovluqdakı mallar</div>');
    if (!its.length) {
      h.push('<div class="empty-state"><div class="big-icon">📦</div><h3>Hələ mal yoxdur</h3></div>');
    } else {
      var I = IMG();
      h.push('<div class="qv-grid">');
      for (var i = 0; i < its.length; i++) {
        var p = its[i];
        var ref = (p.images || [])[0];
        var img = (ref && I && I.imgAttr) ? '<img ' + I.imgAttr(ref, true) + ' alt="">'
                                          : '<div class="ph">📦</div>';
        h.push('<div class="qv-cell">' +
                 '<div onclick="JollyQovluq.openProduct(\'' + p.id + '\')">' + img +
                   '<div class="t">' + esc(p.name || 'Adsız') + '</div></div>' +
                 '<div style="display:flex;gap:6px;margin-top:7px">' +
                   '<button class="btn btn-ghost btn-sm" style="flex:1;padding:5px" ' +
                     'onclick="JollyQovluq.itemPhoto(\'' + p.id + '\')">📷</button>' +
                   '<button class="btn btn-ghost btn-sm" style="flex:1;padding:5px" ' +
                     'onclick="JollyQovluq.detach(\'' + p.id + '\')">✕</button>' +
                 '</div></div>');
      }
      h.push('</div>');
    }

    h.push('<div style="height:26px"></div></div>');
    setTimeout(hydrate, 60);
    return h.join('');
  }

  function draftHtml() {
    if (!draft.length) return '<div class="muted" style="font-size:12px">siyahı boşdur</div>';
    return draft.map(function (x, i) {
      return '<div class="qv-line">' +
               '<span class="muted" style="font-size:11.5px">' + (i + 1) + '</span>' +
               '<span style="flex:1">' + esc(x.name) + '</span>' +
               (x.images.length ? '<span style="color:#4ade80">📷</span>' : '') +
               '<button class="btn btn-ghost btn-sm" onclick="JollyQovluq.photo(' + i + ')">📷</button>' +
               '<button class="btn btn-ghost btn-sm" onclick="JollyQovluq.drop(' + i + ')">✕</button>' +
             '</div>';
    }).join('');
  }

  function hydrate() {
    var I = IMG();
    try { if (I && I.hydrate) I.hydrate(document.getElementById('main') || document); } catch (e) {}
  }

  function repaint() {
    var el = document.getElementById('main');
    if (el && String(global.location.hash || '').split('?')[0] === ROUTE) {
      el.innerHTML = render();
      return;
    }
    var A = global.JollyApp || peek('JollyApp');
    try { if (A && A.render) A.render(); } catch (e) {}
  }

  /* Kameradan/qalereyadan şəkil götürüb IndexedDB-yə yazır,
     sonra ünvanını (ref) geri verir. Üç yerdə işlədilir:
     qovluğun üz şəkli, qaralama sətri, mövcud mal. */
  function pickPhoto(done) {
    var inp = document.getElementById('qvPhoto');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.id = 'qvPhoto'; inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    inp.onchange = function () {
      var f = (inp.files || [])[0];
      inp.value = '';
      if (!f) return;
      var I = IMG();
      if (!I || !I.saveImage) return toast('Şəkil saxlanıla bilmədi', 'error');
      toast('☁️ şəkil yüklənir…');
      var fr = new FileReader();
      fr.onload = function () {
        Promise.resolve(I.saveImage(fr.result)).then(function (ref) {
          if (ref) done(ref);
        }).catch(function (e) { toast('Alınmadı: ' + (e && e.message), 'error'); });
      };
      fr.readAsDataURL(f);
    };
    inp.click();
  }

  /* ══════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════ */
  global.JollyQovluq = {
    render: render,
    afterRender: hydrate,

    newQ: function () {
      var name = (prompt('Qovluğun adı (məs. "Açkı 545"):') || '').trim();
      if (!name) return;
      var code = (prompt('Ortaq barkod (rəqəm):') || '').replace(/\D/g, '');
      var price = (prompt('Ortaq qiymət (₼):') || '').replace(',', '.');
      var q = create(name, code, price);
      if (!q) return;
      openId = q.id; draft = [];
      toast('✅ Qovluq yarandı — indi mal əlavə et', 'ok');
      repaint();
    },

    open: function (id) { openId = id; draft = []; repaint(); },
    back: function () { openId = null; draft = []; repaint(); },

    editQ: function () {
      var q = get(openId);
      if (!q) return;
      var name = (prompt('Ad:', q.name) || '').trim();
      if (!name) return;
      var code = (prompt('Ortaq barkod:', q.code || '') || '').replace(/\D/g, '');
      var price = (prompt('Ortaq qiymət (₼):', q.price == null ? '' : q.price) || '').replace(',', '.');
      if (edit(openId, name, code, price)) { toast('✅ Yeniləndi', 'ok'); repaint(); }
    },

    delQ: function () {
      var q = get(openId);
      if (!q) return;
      var n = items(openId).length;
      if (!confirm('"' + q.name + '" qovluğu silinsin?\n\n' + n +
                   ' mal SİLİNMİR — sadəcə qovluqdan çıxır.')) return;
      remove(openId);
      openId = null;
      toast('Qovluq silindi', 'ok');
      repaint();
    },

    push: function () {
      var el = document.getElementById('qvName');
      if (!el) return;
      var name = String(el.value || '').trim();
      if (!name) return;
      draft.push({ name: name, images: [] });
      el.value = '';
      try { el.focus(); } catch (e) {}
      repaint();
      var el2 = document.getElementById('qvName');
      if (el2) { try { el2.focus(); } catch (e) {} }
    },

    drop: function (i) { draft.splice(i, 1); repaint(); },

    dash: function () { toggleDash(); },

    cover: function () {
      pickPhoto(function (ref) {
        setCover(openId, ref);
        toast('🖼 Üz şəkli qoyuldu', 'ok');
        repaint();
      });
    },

    itemPhoto: function (pid) {
      pickPhoto(function (ref) {
        var d = DB();
        try {
          var p = d.Products.get ? d.Products.get(pid) : null;
          var imgs = (p && p.images) ? p.images.slice() : [];
          imgs.push(ref);
          d.Products.update(pid, { images: imgs });
          toast('📷 Şəkil əlavə olundu', 'ok');
          repaint();
        } catch (e) { toast('Alınmadı', 'error'); }
      });
    },

    detach: function (pid) {
      if (!confirm('Bu mal qovluqdan çıxarılsın?\n\nMal SİLİNMİR.')) return;
      detachProduct(pid);
      toast('Qovluqdan çıxarıldı', 'ok');
      repaint();
    },

    /* Mövcud malı axtarıb qovluğa salmaq */
    find: function (q) {
      var box = document.getElementById('qvHits');
      if (!box) return;
      q = String(q || '').trim().toLowerCase();
      if (q.length < 2) { box.innerHTML = ''; return; }
      var d = DB(), list = [];
      try { list = (d && d.Products && d.Products.all) ? (d.Products.all() || []) : []; } catch (e) {}
      var fold = function (x) {
        return String(x || '').toLowerCase()
          .replace(/ə/g, 'e').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ğ/g, 'g')
          .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ı/g, 'i');
      };
      var qq = fold(q);
      var hits = list.filter(function (p) {
        return p && p.qovluqId !== openId && fold(p.name).indexOf(qq) !== -1;
      }).slice(0, 8);

      box.innerHTML = hits.length
        ? hits.map(function (p) {
            return '<div class="qv-line"><span style="flex:1">' + esc(p.name || 'Adsız') + '</span>' +
              '<button class="btn btn-primary btn-sm" onclick="JollyQovluq.take(\'' + p.id + '\')">' +
              '＋ Sal</button></div>';
          }).join('')
        : '<div class="muted" style="font-size:12px;padding:6px 0">Tapılmadı</div>';
    },

    take: function (pid) {
      if (attach(openId, pid)) {
        toast('✅ Qovluğa salındı', 'ok');
        var el = document.getElementById('qvFind');
        if (el) el.value = '';
        repaint();
      }
    },

    photo: function (i) {
      pickPhoto(function (ref) {
        if (!draft[i]) return;
        draft[i].images.push(ref);
        repaint();
        toast('✅ şəkil əlavə olundu', 'ok');
      });
    },

    commit: function () {
      if (!draft.length) return;
      /* 100 mal yazarkən eyni adı iki dəfə yazmaq asandır */
      var dup = dupNames(openId, draft);
      if (dup.length && !confirm('Bu adlar qovluqda artıq var:\n\n' +
          dup.slice(0, 6).join(', ') + (dup.length > 6 ? '…' : '') +
          '\n\nYenə də yazılsın?')) return;
      var n = addItems(openId, draft);
      draft = [];
      toast('✅ ' + n + ' mal qovluğa yazıldı', 'ok');
      repaint();
    },

    openProduct: function (pid) { go('#/product/' + pid); },

    /* Kənardan istifadə üçün */
    all: all, get: get, items: items, create: create, edit: edit, addItems: addItems,
    attach: attach, setCover: setCover, onDash: onDash
  };

  /* ══════════════════════════════════════════════════════════
     Qeydiyyat
     ══════════════════════════════════════════════════════════ */
  var tries = 0;
  function boot() {
    css();
    var R = REG();
    if (R && typeof R.register === 'function') {
      try {
        /* perm QƏSDƏN verilmir — registry perm-li modulu gizlədir.
           İcazə İdarə Mərkəzindən (`qovluq` id-si ilə) idarə olunur. */
        R.register({
          id: 'qovluq', name: 'Qovluqlar', icon: '🗂',
          route: ROUTE, group: 'JOLLY', render: render, afterRender: hydrate
        });
        console.log('[Qovluq] hazırdır — ' + all().length + ' qovluq');
        return;
      } catch (e) {}
    }
    if (++tries > 40) return;
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 120); });
  } else {
    setTimeout(boot, 120);
  }

  global.addEventListener('hashchange', function () {
    if (String(global.location.hash || '').split('?')[0] === ROUTE) setTimeout(hydrate, 150);
  });

})(typeof window !== 'undefined' ? window : this);
