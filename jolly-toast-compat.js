/* ==========================================================================
   JOLLY — jolly-toast-compat.js               v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   `Toast.warn is not a function` xətasının həlli.

   offline-diagnostic.js (və bəlkə başqa fayllar) `Toast.warn()` çağırır,
   amma toast.js-də yalnız bir hissə metod var. Nə toast.js-ə, nə də
   offline-diagnostic.js-ə toxunmuruq — sadəcə çatışmayan adları
   mövcud olanlara yönləndiririk.

   Yükləmə yeri: toast.js-dən DƏRHAL SONRA.
   ========================================================================== */

(function (global) {
  'use strict';

  function patch() {
    var T = global.Toast;
    if (!T) return false;

    // Mövcud olan ilk metodu tap — hamısını ona yönləndirəcəyik
    var base = null;
    ['show', 'info', 'msg', 'message', 'success', 'error'].forEach(function (m) {
      if (!base && typeof T[m] === 'function') base = m;
    });
    if (!base) return false;

    var aliases = {
      warn:    ['warning', 'error', 'show', 'info'],
      warning: ['warn', 'error', 'show', 'info'],
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
      aliases[name].forEach(function (alt) {
        if (!target && typeof T[alt] === 'function') target = alt;
      });
      if (!target) target = base;
      T[name] = function () { return T[target].apply(T, arguments); };
      added.push(name + '→' + target);
    });

    if (added.length) console.log('[Toast compat] əlavə edildi: ' + added.join(', '));
    return true;
  }

  if (!patch()) {
    // toast.js hələ yüklənməyibsə bir neçə dəfə cəhd et
    var tries = 0;
    var t = setInterval(function () {
      if (patch() || ++tries > 40) clearInterval(t);
    }, 100);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', patch, { once: true });
    }
    global.addEventListener('load', patch, { once: true });
  }

})(window);
