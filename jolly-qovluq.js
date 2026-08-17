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

    h.push('<button class="btn btn-primary" style="width:100%" onclick="JollyQovluq.newQ()">' +
           '＋ Yeni qovluq</button>');

    h.push('<div class="mt" style="margin-top:12px">');
    if (!l.length) {
      h.push('<div class="empty-state"><div class="big-icon">🗂</div><h3>Hələ qovluq yoxdur</h3></div>');
    } else {
      for (var i = 0; i < l.length; i++) {
        var q = l[i], n = items(q.id).length;
        h.push('<div class="qv-row" onclick="JollyQovluq.open(\'' + q.id + '\')">' +
                 '<span class="ic">🗂</span>' +
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
             '<div class="row" style="margin-top:12px;display:flex;gap:8px">' +
               '<button class="btn btn-ghost btn-sm" onclick="JollyQovluq.editQ()">✎ Dəyiş</button>' +
               '<button class="btn btn-ghost btn-sm" onclick="JollyQovluq.delQ()">🗑 Sil</button>' +
             '</div>' +
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
        h.push('<div class="qv-cell" onclick="JollyQovluq.openProduct(\'' + p.id + '\')">' +
                 img + '<div class="t">' + esc(p.name || 'Adsız') + '</div></div>');
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

    photo: function (i) {
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
        if (!f || !draft[i]) return;
        var I = IMG();
        if (!I || !I.saveImage) return toast('Şəkil saxlanıla bilmədi', 'error');
        toast('☁️ şəkil yüklənir…');
        var fr = new FileReader();
        fr.onload = function () {
          Promise.resolve(I.saveImage(fr.result)).then(function (ref) {
            if (ref && draft[i]) { draft[i].images.push(ref); repaint(); toast('✅ şəkil əlavə olundu', 'ok'); }
          }).catch(function (e) { toast('Alınmadı: ' + (e && e.message), 'error'); });
        };
        fr.readAsDataURL(f);
      };
      inp.click();
    },

    commit: function () {
      if (!draft.length) return;
      var n = addItems(openId, draft);
      draft = [];
      toast('✅ ' + n + ' mal qovluğa yazıldı', 'ok');
      repaint();
    },

    openProduct: function (pid) { go('#/product/' + pid); },

    /* Kənardan istifadə üçün */
    all: all, get: get, items: items, create: create, edit: edit, addItems: addItems
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
