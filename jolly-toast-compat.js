/* ==========================================================================
   JOLLY — jolly-toast-compat.js               v2.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   ⚠️ BU FAYL ARTIQ TƏKCƏ TOAST ÜÇÜN DEYİL — NÜVƏNİN HƏYAT XƏTTİDİR.

   07-29 audit tapıntısı (repo kodu oxunandan sonra):

   JOLLY-nin əsas modulları belə yazılıb:
       const Toast          = (() => { ... })();
       const JollyDB        = (() => { ... })();
       const ModuleRegistry = (() => { ... })();
       const JollyStorage   = (() => { ... })();
       const JollyCloud     = (() => { ... })();

   `const` ilə elan olunan qlobal DƏYİŞƏN `window`-a YAPIŞMIR.
   Yəni `window.ModuleRegistry` → undefined, `window.Toast` → undefined.

   Bütün yeni nüvə fayllarım isə `window.X` üzərindən baxır. Nəticə:
     • Nüvə Sağlamlığı modulu ModuleRegistry-ni tapmır → MENYUDA GÖRÜNMÜR
     • Cloud körpüsü JollyCloud-u tapmır → bulud bərpası QORUNMUR
     • Bütün toast mesajları yalnız konsola düşür

   Bu fayl həmin körpünü qurur: `const` qloballarını window-a bağlayır.
   Function konstruktoru qlobal əhatədə işlədiyi üçün leksik `const`
   bağlamalarını görə bilir — `window.X` isə görə bilmir.

   Yükləmə yeri: toast.js-dən sonra (index.html-də artıq oradadır).
   O nöqtədə db.js, storage.js, module-registry.js, cloud.js, toast.js —
   hamısı yüklənib.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ----------------------------------------------------------------------
     1. Leksik qlobalları window-a bağla
     ---------------------------------------------------------------------- */
  var NAMES = [
    'Toast', 'JollyDB', 'JollyStorage', 'ModuleRegistry', 'JollyCloud',
    'JollyCleanup', 'JollyEvents', 'JollyStudios', 'Products', 'JollyUsers',
    'JollyLazy', 'JollyBlackbox', 'JollySelfTest'
  ];

  function peek(name) {
    // Function konstruktoru qlobal əhatədə icra olunur → const-ları görür
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }

  function bindGlobals() {
    var bound = [];
    NAMES.forEach(function (n) {
      if (global[n]) return;                 // onsuz da yerindədir
      var v = peek(n);
      if (v === null || v === undefined) return;
      try { global[n] = v; bound.push(n); } catch (e) {}
    });
    if (bound.length) console.log('[Global bridge] window-a bağlandı: ' + bound.join(', '));
    return bound.length;
  }

  /* ----------------------------------------------------------------------
     2. Toast-un çatışmayan metodları
     toast.js-də yalnız show(), info, success, error var — `warn` yoxdur,
     amma offline-diagnostic.js onu çağırır.
     ---------------------------------------------------------------------- */
  function patchToast() {
    var T = global.Toast || peek('Toast');
    if (!T) return false;
    if (!global.Toast) { try { global.Toast = T; } catch (e) {} }

    var base = null;
    ['info', 'show', 'success', 'error', 'msg', 'message'].forEach(function (m) {
      if (!base && typeof T[m] === 'function') base = m;
    });
    if (!base) return false;

    var aliases = {
      warn:    ['warning', 'info', 'show'],
      warning: ['warn', 'info', 'show'],
      info:    ['show', 'msg', 'message', 'success'],
      success: ['ok', 'show', 'info'],
      error:   ['fail', 'danger', 'show', 'info'],
      show:    ['info', 'msg', 'message'],
      ok:      ['success', 'show', 'info'],
      hide:    ['close', 'dismiss']
    };

    var added = [];
    Object.keys(aliases).forEach(function (name) {
      if (typeof T[name] === 'function') return;
      var target = null;
      aliases[name].forEach(function (alt) { if (!target && typeof T[alt] === 'function') target = alt; });
      if (!target) target = base;
      T[name] = function () { return T[target].apply(T, arguments); };
      added.push(name + '→' + target);
    });

    if (added.length) console.log('[Toast compat] əlavə edildi: ' + added.join(', '));
    return true;
  }

  /* ----------------------------------------------------------------------
     3. İcra — bir neçə dəfə, çünki bəzi fayllar gec yüklənir (lazy loader)
     ---------------------------------------------------------------------- */
  function run() { bindGlobals(); patchToast(); }

  run();

  var tries = 0;
  var timer = setInterval(function () {
    run();
    if (++tries > 60) clearInterval(timer);     // ~12 saniyə
  }, 200);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
  global.addEventListener('load', run, { once: true });

  global.JollyGlobalBridge = {
    version: '2.0.0',
    run: run,
    check: function () {
      var out = {};
      NAMES.forEach(function (n) { out[n] = !!global[n]; });
      return out;
    }
  };

})(window);
