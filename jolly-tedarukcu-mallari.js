/* ============================================================
   JOLLY Tədarükçü Malları — jolly-tedarukcu-mallari.js
   v1.0  (2026-08-05)

   ────────────────────────────────────────────────────────────
   NƏ ÜÇÜNDÜR (Esqinin izahı):
   "Qayçının Baki Kosmetika Elgundən gəldiyini bilirəm — DOLDUR
    verirəm, ondan gələnlər çıxsın ki, barkodunu tapa bilim."

   Yəni bu, SİFARİŞ ekranı DEYİL. Miqdar yoxdur, sifariş yoxdur.
   Tədarükçünü seçirsən → DOLDUR → o tədarükçüyə aid bütün mallar
   şəkli, adı, BARKODU və məlumatı ilə siyahıya düzülür.

   Barkod ən görünən yerdədir və üstünə basanda kopyalanır —
   ekranın əsas məqsədi elə odur.

   ────────────────────────────────────────────────────────────
   Marşrut: #/supplier-products   ·   Açar: supplier.products.view
   Məlumat: JollyDB.Suppliers.all() + JollyDB.Products.filter({supplier})
   supplier-order.js-dən TAMAMİLƏ ASILI DEYİL — ayrı ekrandır.
   ============================================================ */
(function (global) {
  'use strict';

  var ROUTE    = '#/supplier-products';
  var PERM_KEY = 'supplier.products.view';
  var SEL_KEY  = 'jolly_supplier_view';

  var selected = null;
  var filled   = false;

  function peek(name) {
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }
  function DB() { return global.JollyDB || peek('JollyDB'); }
  function ST() { return global.JollyStorage || peek('JollyStorage'); }

  function toast(msg, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error)   return T.error(msg);
      if (T && kind === 'ok'    && T.success) return T.success(msg);
      if (T && T.info) return T.info(msg);
    } catch (e) {}
    console.log('[TədarükçüMalları]', msg);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function session() {
    try { return JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); }
    catch (e) { return null; }
  }
  function allowed() {
    var s = session();
    if (!s) return true;
    if (s.role === 'admin') return true;
    var P = global.POS || peek('POS');
    if (!P || !P.can) return true;
    try { return !!P.can(PERM_KEY); } catch (e) { return true; }
  }

  /* ══════════════════════════════════════════════════════════
     Məlumat
     ══════════════════════════════════════════════════════════ */
  function allProducts() {
    var d = DB();
    try { return (d && d.Products && d.Products.all) ? (d.Products.all() || []) : []; }
    catch (e) { return []; }
  }

  function productsOf(name) {
    var d = DB();
    if (name === '__none__') {
      return allProducts().filter(function (p) { return !p.supplier; });
    }
    try {
      if (d && d.Products && d.Products.filter) return d.Products.filter({ supplier: name }) || [];
    } catch (e) {}
    return allProducts().filter(function (p) { return p.supplier === name; });
  }

  /* Tədarükçü siyahısı — həm qeyd olunanlar, həm məhsullarda görünənlər */
  function suppliers() {
    var d = DB(), out = [], seen = {}, i;
    try {
      var reg = (d && d.Suppliers && d.Suppliers.all) ? (d.Suppliers.all() || []) : [];
      for (i = 0; i < reg.length; i++) {
        var nm = reg[i] && (reg[i].name || reg[i]);
        if (!nm || seen[nm]) continue;
        seen[nm] = 1;
        out.push({ name: nm, code: reg[i].code || '' });
      }
    } catch (e) {}

    var prods = allProducts(), none = 0;
    for (i = 0; i < prods.length; i++) {
      var s = prods[i] && prods[i].supplier;
      if (!s) { none++; continue; }
      if (!seen[s]) { seen[s] = 1; out.push({ name: s, code: '' }); }
    }
    for (i = 0; i < out.length; i++) out[i].count = productsOf(out[i].name).length;
    out.sort(function (a, b) { return b.count - a.count; });
    if (none) out.push({ name: '__none__', label: 'Tədarükçüsüz mallar', code: '', count: none });
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     CSS
     ══════════════════════════════════════════════════════════ */
  function installCss() {
    if (document.getElementById('jtm-css')) return;
    var st = document.createElement('style');
    st.id = 'jtm-css';
    st.textContent = [
      '.jtm-sup{display:flex;align-items:center;gap:11px;padding:13px 14px;border-radius:14px;cursor:pointer;',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:8px;}',
      '.jtm-sup:active{background:rgba(255,255,255,.09);}',
      '.jtm-sup .nm{flex:1;min-width:0;font-size:14px;font-weight:600;}',
      '.jtm-sup .cd{font-size:11px;opacity:.45;font-family:ui-monospace,monospace;}',
      '.jtm-sup .cnt{flex:none;font-size:12px;padding:4px 10px;border-radius:11px;',
      'background:rgba(245,196,81,.16);color:#f5c451;font-weight:700;}',
      '.jtm-fill{width:100%;padding:15px;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;',
      'border:none;background:linear-gradient(135deg,#f5c451,#e0a92e);color:#1a1400;margin:6px 0 14px;}',
      '.jtm-fill:active{transform:scale(.98);}',
      '.jtm-search{width:100%;padding:12px 14px;border-radius:13px;font-size:16px;color:#e8e8f0;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);outline:none;margin-bottom:12px;}',
      '.jtm-card{display:flex;gap:12px;padding:12px;border-radius:15px;margin-bottom:9px;',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);}',
      '.jtm-card .ph{width:62px;height:62px;flex:none;border-radius:12px;overflow:hidden;',
      'background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;font-size:26px;}',
      '.jtm-card .ph img{width:100%;height:100%;object-fit:cover;}',
      '.jtm-card .bd{flex:1;min-width:0;}',
      '.jtm-nm{font-size:14px;font-weight:700;margin-bottom:5px;line-height:1.3;}',
      '.jtm-bc{display:inline-block;font-family:ui-monospace,monospace;font-size:13px;letter-spacing:.04em;',
      'padding:5px 10px;border-radius:8px;margin:0 6px 5px 0;cursor:pointer;',
      'background:rgba(245,196,81,.14);border:1px solid rgba(245,196,81,.3);color:#f5c451;}',
      '.jtm-bc:active{background:rgba(245,196,81,.3);}',
      '.jtm-nobc{font-size:12px;color:#fca5a5;margin-bottom:5px;}',
      '.jtm-meta{font-size:11.5px;opacity:.55;line-height:1.6;}',
      '.jtm-open{font-size:11.5px;color:#7dd3fc;cursor:pointer;margin-top:4px;display:inline-block;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  function supName(n) {
    if (n === '__none__') return 'Tədarükçüsüz mallar';
    return n;
  }

  function renderPicker() {
    var list = suppliers();
    var h = [];
    h.push('<div class="section-title" style="margin-top:4px;">Tədarükçünü seç</div>');
    if (!list.length) {
      h.push('<div class="empty-state"><div class="big-icon">🚚</div><h3>Tədarükçü yoxdur</h3>' +
             '<p class="muted" style="font-size:12.5px;">Studio → Admin Studio → 🚚 Tədarükçü</p></div>');
      return h.join('');
    }
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      h.push('<div class="jtm-sup" onclick="JollyTedarukcuMallari.pick(\'' + esc(s.name) + '\')">' +
               '<span style="font-size:20px;">🚚</span>' +
               '<span class="nm">' + esc(supName(s.name)) +
                 (s.code ? '<div class="cd">kod ' + esc(s.code) + '</div>' : '') + '</span>' +
               '<span class="cnt">' + s.count + '</span>' +
             '</div>');
    }
    return h.join('');
  }

  function renderProduct(p) {
    var s = ST();
    var ref = (p.images && p.images[0]) || null;
    var ph = '🧴';
    if (ref) {
      try {
        ph = '<img ' + (s && s.imgAttr ? s.imgAttr(ref) : 'src="' + esc(ref) + '"') + ' alt="">';
      } catch (e) { ph = '🧴'; }
    }

    var codes = (p.barcodes || []).filter(Boolean);
    var bc = '';
    if (codes.length) {
      for (var i = 0; i < codes.length; i++) {
        bc += '<span class="jtm-bc" onclick="JollyTedarukcuMallari.copy(\'' + esc(codes[i]) + '\')">' +
              esc(codes[i]) + '</span>';
      }
    } else {
      bc = '<div class="jtm-nobc">⚠️ Barkod yoxdur</div>';
    }

    var meta = [];
    if (p.mainCode) meta.push('kod ' + esc(p.mainCode));
    if (p.price) meta.push(esc(p.price) + ' ₼');
    if (p.group) meta.push(esc(p.group));
    if (p.location) meta.push('📍 ' + esc(p.location));
    if (p.brand) meta.push(esc(p.brand));

    var nm = (p.name || 'Adsız') + '';
    return '<div class="jtm-card" data-nm="' +
             esc((nm + ' ' + codes.join(' ') + ' ' + (p.mainCode || '') + ' ' + (p.group || '')).toLowerCase()) + '">' +
             '<div class="ph">' + ph + '</div>' +
             '<div class="bd">' +
               '<div class="jtm-nm">' + esc(nm) + '</div>' +
               bc +
               (meta.length ? '<div class="jtm-meta">' + meta.join(' · ') + '</div>' : '') +
               '<span class="jtm-open" onclick="JollyTedarukcuMallari.open(\'' + esc(p.id) + '\')">Məhsulu aç →</span>' +
             '</div>' +
           '</div>';
  }

  function renderList() {
    var prods = productsOf(selected);
    var h = [];

    h.push('<div class="glass" style="padding:13px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">' +
             '<span style="font-size:20px;">🚚</span>' +
             '<span style="flex:1;min-width:0;">' +
               '<div class="muted" style="font-size:10.5px;text-transform:uppercase;">Tədarükçü</div>' +
               '<div style="font-family:var(--font-display);font-size:16px;font-weight:700;">' + esc(supName(selected)) + '</div>' +
             '</span>' +
             '<button class="btn btn-ghost btn-sm" onclick="JollyTedarukcuMallari.change()">Dəyiş</button>' +
           '</div>');

    if (!filled) {
      h.push('<button class="jtm-fill" onclick="JollyTedarukcuMallari.fill()">⚡ DOLDUR — ' + prods.length + ' mal</button>');
      h.push('<div class="muted" style="font-size:12px;text-align:center;">Basanda bu tədarükçünün bütün malları şəkli və barkodu ilə çıxacaq</div>');
      return h.join('');
    }

    if (!prods.length) {
      h.push('<div class="empty-state"><div class="big-icon">📦</div><h3>Bu tədarükçüdən mal yoxdur</h3></div>');
      return h.join('');
    }

    var withBc = 0;
    for (var i = 0; i < prods.length; i++) if ((prods[i].barcodes || []).length) withBc++;

    h.push('<div class="glass" style="padding:10px 13px;margin-bottom:11px;font-size:12px;opacity:.75;">' +
             prods.length + ' mal · ' + withBc + ' barkodlu · ' + (prods.length - withBc) + ' barkodsuz' +
             ' <span style="opacity:.6;">— barkoda toxun, kopyalanır</span>' +
           '</div>');
    h.push('<input class="jtm-search" placeholder="Ad və ya barkod axtar…" oninput="JollyTedarukcuMallari.filter(this.value)">');
    h.push('<div id="jtmList">');
    for (i = 0; i < prods.length; i++) h.push(renderProduct(prods[i]));
    h.push('</div>');
    return h.join('');
  }

  function render() {
    installCss();
    if (!allowed()) {
      return '<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>';
    }
    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
             '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">🚚 Tədarükçü Malları</h2>' +
             '<div class="muted" style="font-size:12.5px;">v1.0 · hansı mal kimdən gəlir — barkodu ilə</div>' +
           '</div></div>');
    h.push('<div id="jtmZone">' + (selected ? renderList() : renderPicker()) + '</div>');
    h.push('<div style="height:30px;"></div></div>');
    return h.join('');
  }

  function paint() {
    var zone = document.getElementById('jtmZone');
    if (zone) zone.innerHTML = selected ? renderList() : renderPicker();
    hydrate();
  }

  /* Şəkillər IndexedDB-dədir — çəkildikdən sonra doldurulmalıdır */
  function hydrate() {
    var s = ST();
    try { if (s && s.hydrate) s.hydrate(); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════ */
  global.JollyTedarukcuMallari = {
    render: render,
    afterRender: hydrate,

    pick: function (name) {
      selected = name;
      filled = false;
      try { localStorage.setItem(SEL_KEY, name); } catch (e) {}
      paint();
    },

    change: function () {
      selected = null; filled = false;
      try { localStorage.removeItem(SEL_KEY); } catch (e) {}
      paint();
    },

    fill: function () {
      filled = true;
      paint();
      var n = productsOf(selected).length;
      toast('⚡ ' + n + ' mal göstərildi', 'ok');
    },

    filter: function (q) {
      q = String(q || '').toLowerCase().trim();
      var box = document.getElementById('jtmList');
      if (!box) return;
      var rows = box.getElementsByClassName('jtm-card');
      for (var i = 0; i < rows.length; i++) {
        var nm = rows[i].getAttribute('data-nm') || '';
        rows[i].style.display = (!q || nm.indexOf(q) !== -1) ? '' : 'none';
      }
    },

    copy: function (code) {
      try {
        var ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.parentNode.removeChild(ta);
        toast('📋 ' + code + ' kopyalandı', 'ok');
      } catch (e) { toast('Kopyalanmadı', 'error'); }
    },

    open: function (id) {
      var R = global.JollyRouter || peek('JollyRouter');
      var r = '#/product/' + id;
      if (R && R.go) R.go(r); else global.location.hash = r;
    },

    suppliers: suppliers,
    productsOf: productsOf,
    _state: function () { return { selected: selected, filled: filled }; }
  };

  /* ══════════════════════════════════════════════════════════
     Qeydiyyat
     ══════════════════════════════════════════════════════════ */
  function registerPerm() {
    var P = global.POS || peek('POS');
    if (!P || typeof P.register !== 'function') return false;
    try {
      P.register({
        id: 'supplierproducts', name: 'Tədarükçü Malları', icon: '🚚',
        permissions: [{ key: PERM_KEY, label: 'Tədarükçüyə görə malları gör', tag: 'view', 'default': false }]
      });
      return true;
    } catch (e) { return false; }
  }

  function registerModule() {
    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    if (!MR || typeof MR.register !== 'function') return false;
    try {
      /* perm QƏSDƏN verilmir — registry perm-li modulu gizlədir.
         Yoxlama render()-in içindədir (📂 Modul Qovluğundan idarə olunur). */
      MR.register({
        id: 'supplier-products', name: 'Tədarükçü Malları', icon: '🚚',
        route: ROUTE, group: 'JOLLY',
        render: render, afterRender: hydrate
      });
      return true;
    } catch (e) { return false; }
  }

  var tries = 0;
  function boot() {
    installCss();
    try { selected = localStorage.getItem(SEL_KEY) || null; } catch (e) {}
    var a = registerPerm(), b = registerModule();
    if ((a && b) || ++tries > 40) {
      if (!(a && b)) console.warn('[TədarükçüMalları] tam qoşulmadı', { perm: a, modul: b });
      else console.log('[TədarükçüMalları] hazırdır —', suppliers().length, 'tədarükçü');
      return;
    }
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 100); });
  } else {
    setTimeout(boot, 100);
  }

  global.addEventListener('hashchange', function () {
    if (String(global.location.hash || '').split('?')[0] === ROUTE) setTimeout(hydrate, 200);
  });

})(typeof window !== 'undefined' ? window : this);
