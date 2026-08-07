/* ============================================================
   JOLLY Sifariş "Doldur" — jolly-sifaris-doldur.js
   v1.0  (2026-08-05)

   ────────────────────────────────────────────────────────────
   NƏ EDİR:
   Tədarükçü Sifarişi ekranına (#/supplier-order) yeni bir panel
   əlavə edir. Tədarükçünü seçəndən sonra:

        ⚡ HAMISINI DOLDUR   [ 1 ]   🧹 Təmizlə

   "Doldur" basanda həmin tədarükçünün BÜTÜN məhsullarının
   miqdar xanası yazılan rəqəmlə dolur — bir-bir yazmağa
   ehtiyac qalmır. Sonra istədiyini əl ilə dəyişə bilərsən.

   ────────────────────────────────────────────────────────────
   NİYƏ AYRICA FAYL:
   supplier-order.js-in `renderOrderForm()` funksiyası daxilidir
   (ixrac olunmur), ona görə onu sarğılamaq mümkün deyil.
   Bunun əvəzinə ekran çəkiləndən sonra DOM-a baxırıq:
   `#soProductList` görünəndə panel onun üstünə yerləşdirilir.
   supplier-order.js-ə TOXUNULMUR.

   Miqdar yazmaq üçün modulun öz API-si işlədilir:
        JollySupplierOrder.setQty(productId, value)
   Məhsulun id-si sətirdəki input-un `oninput` atributundan
   oxunur — modul onu məhz orada saxlayır.

   İcazə açarı: supplier.order.fill
   ============================================================ */
(function (global) {
  'use strict';

  var PERM_KEY = 'supplier.order.fill';
  var DEF_QTY  = 1;
  var QTY_KEY  = 'jolly_order_fill_qty';

  function peek(name) {
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }
  function toast(msg, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error)   return T.error(msg);
      if (T && kind === 'ok'    && T.success) return T.success(msg);
      if (T && T.info) return T.info(msg);
    } catch (e) {}
    console.log('[SifarişDoldur]', msg);
  }

  function session() {
    try { return JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); }
    catch (e) { return null; }
  }
  function allowed() {
    var s = session();
    if (!s) return true;                       // kilid qurulmayıbsa açıq
    if (s.role === 'admin') return true;
    var P = global.POS || peek('POS');
    if (!P || !P.can) return true;
    try { return !!P.can(PERM_KEY); } catch (e) { return true; }
  }

  function lastQty() {
    var v = DEF_QTY;
    try { v = parseInt(localStorage.getItem(QTY_KEY), 10) || DEF_QTY; } catch (e) {}
    return v > 0 ? v : DEF_QTY;
  }
  function saveQty(v) {
    try { localStorage.setItem(QTY_KEY, String(v)); } catch (e) {}
  }

  /* ── CSS ────────────────────────────────────────────────── */
  function installCss() {
    if (document.getElementById('jsd-css')) return;
    var st = document.createElement('style');
    st.id = 'jsd-css';
    st.textContent = [
      '.jsd-bar{display:flex;align-items:center;gap:9px;padding:12px 14px;margin-bottom:12px;',
      'border-radius:14px;background:rgba(245,196,81,.08);border:1px solid rgba(245,196,81,.28);}',
      '.jsd-bar .jsd-fill{flex:1;padding:11px 12px;border-radius:11px;font-size:13.5px;font-weight:700;',
      'cursor:pointer;border:none;background:rgba(245,196,81,.85);color:#1a1400;}',
      '.jsd-bar .jsd-fill:active{transform:scale(.97);}',
      '.jsd-bar input{width:58px;flex:none;text-align:center;padding:10px 6px;border-radius:11px;font-size:15px;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);color:#e8e8f0;outline:none;}',
      '.jsd-bar .jsd-clr{flex:none;padding:11px 12px;border-radius:11px;font-size:13px;cursor:pointer;',
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#e8e8f0;}',
      '.jsd-note{font-size:11.5px;opacity:.55;margin:-6px 0 12px;padding:0 4px;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  /* ── Miqdar xanaları ────────────────────────────────────── */
  function rows() {
    var box = document.getElementById('soProductList');
    if (!box) return [];
    var out = [];
    try {
      var ins = box.getElementsByTagName('input');
      for (var i = 0; i < ins.length; i++) {
        var el = ins[i];
        if (String(el.type).toLowerCase() !== 'number') continue;
        var oc = el.getAttribute('oninput') || '';
        var m = oc.match(/setQty\(\s*['"]([^'"]+)['"]/);
        out.push({ el: el, id: m ? m[1] : null });
      }
    } catch (e) {}
    return out;
  }

  function apply(val) {
    var list = rows();
    if (!list.length) { toast('Məhsul siyahısı tapılmadı', 'error'); return 0; }
    var SO = global.JollySupplierOrder || peek('JollySupplierOrder');
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      r.el.value = (val === '' ? '' : String(val));
      if (r.id && SO && typeof SO.setQty === 'function') {
        try { SO.setQty(r.id, r.el.value); n++; } catch (e) {}
      }
    }
    return n;
  }

  /* ── Panel ──────────────────────────────────────────────── */
  function inject() {
    if (!allowed()) return;
    var box = document.getElementById('soProductList');
    if (!box || !box.parentNode) return;
    if (document.getElementById('jsdBar')) return;      // artıq var

    installCss();
    var q = lastQty();
    var bar = document.createElement('div');
    bar.id = 'jsdBar';
    bar.className = 'jsd-bar';
    bar.innerHTML =
      '<button class="jsd-fill" onclick="JollySifarisDoldur.fill()">⚡ Hamısını doldur</button>' +
      '<input id="jsdQty" type="number" inputmode="numeric" min="1" value="' + q + '">' +
      '<button class="jsd-clr" onclick="JollySifarisDoldur.clear()">🧹</button>';

    var note = document.createElement('div');
    note.id = 'jsdNote';
    note.className = 'jsd-note';
    note.textContent = 'Bütün məhsullara eyni miqdar yazılır — sonra tək-tək dəyişə bilərsən.';

    box.parentNode.insertBefore(bar, box);
    box.parentNode.insertBefore(note, box);
  }

  /* ── İzləmə: ekran çəkiləndən sonra paneli qoy ──────────── */
  var obs = null;
  function watch() {
    inject();
    if (obs || !document.body) return;
    try {
      obs = new MutationObserver(function () {
        try { inject(); } catch (e) {}
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  /* ── API ────────────────────────────────────────────────── */
  global.JollySifarisDoldur = {
    fill: function () {
      var inp = document.getElementById('jsdQty');
      var v = parseInt(inp && inp.value, 10);
      if (!v || v < 1) { toast('Miqdar 1-dən böyük olmalıdır', 'error'); return; }
      saveQty(v);
      var n = apply(v);
      if (n) toast('⚡ ' + n + ' məhsul dolduruldu (' + v + ' ədəd)', 'ok');
    },
    clear: function () {
      apply('');
      toast('🧹 Miqdarlar təmizləndi', 'ok');
    },
    count: function () { return rows().length; },
    _inject: inject,
    _apply: apply
  };

  /* ── Qeydiyyat ──────────────────────────────────────────── */
  function registerPerm() {
    var P = global.POS || peek('POS');
    if (!P || typeof P.register !== 'function') return false;
    try {
      P.register({
        id: 'supplierfill', name: 'Sifarişi doldur', icon: '⚡',
        permissions: [{ key: PERM_KEY, label: 'Sifarişi bir toxunuşla doldur', tag: 'action', 'default': false }]
      });
      return true;
    } catch (e) { return false; }
  }

  var tries = 0;
  function boot() {
    installCss();
    var ok = registerPerm();
    watch();
    if (ok || ++tries > 40) return;
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 100); });
  } else {
    setTimeout(boot, 100);
  }

  global.addEventListener('hashchange', function () { setTimeout(inject, 150); });

})(typeof window !== 'undefined' ? window : this);
