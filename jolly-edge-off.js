/* ============================================================
   JOLLY — Edge Panel SÖNDÜRÜCÜSÜ   jolly-edge-off.js
   (2026-08-03)

   NƏ EDİR:
   İki şey söndürülür — həm admin, həm işçi üçün:

   1) KƏNAR PANEL (edge panel) — lazım deyil.

   2) ⌃ ALT DOK DÜYMƏSİ (#jbdTab, bottom-dock.js:52)
      ★ ƏSL TOQQUŞMA BUDUR (08-03-də cihazda görüldü):
          #jbdTab   left:14px  bottom:90px   (bottom-dock.js)
          #qs-fab   left:16px  bottom:88px   (üzən lupa)
      İkisi tam eyni yerdə oturur — ekranda qızılı ⌃ görünür,
      lupa isə altında itir. Esqin: "ancaq lupa qalsın".

   Əlavə: lupa səhvən söndürülübsə (üstündə 900 ms basılı saxlamaq
   `jolly_fab_off` açarını yazır) avtomatik geri qaytarılır.

   NİYƏ AYRICA FAYL:
   index.html-dən <div id="edgePanel"> və edge-panel.js SİLİNMİR,
   çünki app.js:915-916 birbaşa onlara müraciət edir:
        JollyEdgePanel.initDraggableTab();
        document.getElementById('edgeScrim').addEventListener(...)
   Silsək app.js açılışda çökər. Ona görə elementlər yerində qalır,
   sadəcə görünmür və heç vaxt açılmır.

   ÜÇ QAT:
   1) CSS — edgeTab / edgeScrim / edgePanel display:none
   2) Müşahidəçi — kimsə 'open' sinfini qoysa, dərhal götürülür
      (dartma jesti edge-panel.js-in ÖZ daxili open() funksiyasını
       çağırır, ona görə yalnız API-ni sarğılamaq kifayət etmir)
   3) API sarğısı — JollyEdgePanel.open/toggle/render boşa çıxır
   Əlavə: lupanın z-index-i 9990-a qaytarılır (artıq rəqib yoxdur).

   GERİ QAYTARMA:
        JollyEdgeOff.off()      → panel yenidən işləyir (reload)
        JollyEdgeOff.on()       → yenidən söndürür
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'jolly_edge_off';

  function peek(name) {
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }

  function enabled() {
    try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; }
  }

  /* ── 1) CSS ─────────────────────────────────────────────── */
  function installCss() {
    if (document.getElementById('jeo-css')) return;
    var st = document.createElement('style');
    st.id = 'jeo-css';
    st.textContent = [
      'body.jeo-off .edge-tab,',
      'body.jeo-off #edgeTab,',
      'body.jeo-off .edge-scrim,',
      'body.jeo-off #edgeScrim,',
      'body.jeo-off .edge-panel,',
      'body.jeo-off #edgePanel{',
      'display:none!important;visibility:hidden!important;opacity:0!important;',
      'pointer-events:none!important;transform:translateY(120%)!important;}',
      /* ⌃ alt dok düyməsi — lupanın düz üstündə otururdu */
      'body.jeo-off #jbdTab,',
      'body.jeo-off #jbdRoot{display:none!important;pointer-events:none!important;}',
      /* lupa yenidən ən üstdə və sərbəst */
      'body.jeo-off #qs-fab{z-index:9990!important;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function applyFlag() {
    try { document.body.classList.toggle('jeo-off', enabled()); } catch (e) {}
  }

  /* ── 2) 'open' sinfini dərhal götür ─────────────────────── */
  function strip(el) {
    if (!el) return;
    try { if (el.classList.contains('open')) el.classList.remove('open'); } catch (e) {}
  }

  function watch(id) {
    var el = document.getElementById(id);
    if (!el || el.__jeo) return;
    el.__jeo = true;
    strip(el);
    try {
      new MutationObserver(function () {
        if (enabled()) strip(el);
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  }

  function watchAll() {
    watch('edgePanel');
    watch('edgeScrim');
    watch('edgeTab');
    /* body-yə də 'edge-open' kimi sinif qoyan kod ola bilər */
    try {
      if (document.body.classList.contains('edge-open')) document.body.classList.remove('edge-open');
    } catch (e) {}
  }

  /* ── 2b) Lupanı geri qaytar (səhvən söndürülübsə) ───────── */
  function restoreLupa() {
    if (!enabled()) return;
    try {
      if (localStorage.getItem('jolly_fab_off') === '1') {
        localStorage.setItem('jolly_fab_off', '0');
        console.log('[EdgeOff] lupa söndürülmüşdü — geri qaytarıldı');
      }
    } catch (e) {}
    try {
      var QS = global.JollyQuickSearch || peek('JollyQuickSearch');
      if (QS && QS.show) QS.show();
    } catch (e) {}
  }

  /* ── 3) API sarğısı ─────────────────────────────────────── */
  function wrapApi() {
    var EP = global.JollyEdgePanel || peek('JollyEdgePanel');
    if (!EP || EP.__jeo) return !!EP;
    var noop = function () { return false; };
    try {
      if (typeof EP.open === 'function') EP.open = function () { if (enabled()) return false; };
      if (typeof EP.toggle === 'function') EP.toggle = function () { if (enabled()) return false; };
      if (typeof EP.render === 'function') {
        var origRender = EP.render;
        EP.render = function () { if (enabled()) return; try { return origRender.apply(EP, arguments); } catch (e) {} };
      }
      EP.__jeo = true;
      if (!global.JollyEdgePanel) { try { global.JollyEdgePanel = EP; } catch (e) {} }
      return true;
    } catch (e) { return false; }
  }

  /* ── Açılış ─────────────────────────────────────────────── */
  var tries = 0;
  function boot() {
    installCss();
    applyFlag();
    watchAll();
    restoreLupa();
    var ok = wrapApi();
    if (ok || ++tries > 40) {
      console.log('[EdgeOff] kənar panel söndürüldü' + (ok ? '' : ' (API tapılmadı — CSS + müşahidəçi işləyir)'));
      return;
    }
    setTimeout(boot, 250);
  }

  global.JollyEdgeOff = {
    on: function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      applyFlag(); watchAll();
      console.log('[EdgeOff] söndürüldü');
    },
    off: function () {
      try { localStorage.setItem(KEY, '0'); } catch (e) {}
      applyFlag();
      console.log('[EdgeOff] geri qaytarıldı — səhifəni yenilə');
    },
    showLupa: restoreLupa,
    status: enabled
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 40); });
  } else {
    setTimeout(boot, 40);
  }

  global.addEventListener('hashchange', function () {
    setTimeout(function () { applyFlag(); watchAll(); restoreLupa(); }, 80);
  });

})(typeof window !== 'undefined' ? window : this);
