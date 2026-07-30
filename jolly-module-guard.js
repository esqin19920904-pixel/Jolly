/* ==========================================================================
   JOLLY — jolly-module-guard.js               v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   "found.render is not a function" xətasının həlli.

   SƏBƏB (repo oxunandan sonra tapıldı):
   Bəzi modullar öz API obyektini olduğu kimi qeyd edir, məsələn
   jolly-telegram.js:
       window.ModuleRegistry.register(window.JollyTelegram);
       // { id, name, version, show, sendMessage, isConfigured }

   Orada `render()` yoxdur. ModuleRegistry isə route-u avtomatik `#/telegram`
   edir və istifadəçi kartа toxunanda `found.render(rest)` çağırır → çökmə.
   Eyni vəziyyət ikonu ⬛📦 olan bütün modullardadır (📦 registry-nin
   "ikon verilməyib" defoltudur).

   HƏLL — üç qat, heç bir modula toxunmadan:
     1. `register()` sarğılanır: manifestdə `render` yoxdursa, amma
        `show()` / `open()` varsa, avtomatik render qurulur — panel açılır
        və modul öz üsulu ilə göstərilir.
     2. Onsuz da qeyd olunmuş modullar da eyni şəkildə düzəldilir.
     3. `renderPage()` sarğılanır: nə olursa olsun, çökmə əvəzinə
        anlaşılan mesaj göstərilir.

   Yükləmə yeri: module-registry.js-dən DƏRHAL SONRA.
   ========================================================================== */

(function (global) {
  'use strict';

  var state = { patched: 0, wrapped: false, fixed: [], failures: [], found: false };

  /* ⚠️ 07-29 ikinci düzəliş — NİYƏ İLK CƏHD İŞLƏMƏDİ:
     `ModuleRegistry` də `const`-dur, yəni `window.ModuleRegistry` boşdur.
     Bu fayl module-registry.js-dən sonra, amma `const` körpüsündən ƏVVƏL
     yüklənir — ona görə işə düşəndə registry-ni tapa bilmirdi.
     İndi registry-ni ÖZÜ oxuyur (Function konstruktoru qlobal əhatədə
     işlədiyi üçün leksik const-ları görür) — yükləmə sırasından asılı deyil. */
  function MR() {
    if (global.ModuleRegistry) return global.ModuleRegistry;
    try {
      var v = new Function('try { return typeof ModuleRegistry !== "undefined" ? ModuleRegistry : null; } catch (e) { return null; }')();
      if (v) { try { global.ModuleRegistry = v; } catch (e) {} }
      return v;
    } catch (e) { return null; }
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Modulun öz açma üsulunu tap */
  function opener(mod) {
    var names = ['show', 'open', 'render', 'renderPage', 'panel', 'view'];
    for (var i = 0; i < names.length; i++) {
      if (names[i] !== 'render' && typeof mod[names[i]] === 'function') return names[i];
    }
    return null;
  }

  /* render() olmayan modula render qur */
  function attachRender(mod) {
    if (!mod || typeof mod.render === 'function') return false;
    var fn = opener(mod);
    if (!fn) {
      // Heç bir açma üsulu yoxdur — ən azı çökməsin
      mod.render = function () {
        return '<div style="padding:30px 16px;text-align:center;color:#e8e8f0;">' +
               '<div style="font-size:34px;margin-bottom:10px;">📦</div>' +
               '<div style="font-size:16px;font-weight:600;margin-bottom:6px;">' + esc(mod.name || mod.id) + '</div>' +
               '<div style="font-size:13px;opacity:.6;line-height:1.5;">Bu modulun ayrıca ekranı yoxdur — ' +
               'o, Alətlər menyusundan və ya başqa ekranın içindən işləyir.</div></div>';
      };
      state.fixed.push({ id: mod.id, via: 'placeholder' });
      state.patched++;
      return true;
    }

    mod.render = function () {
      return '<div id="jmg-' + esc(mod.id) + '" style="padding:26px 16px;text-align:center;color:#e8e8f0;">' +
             '<div style="font-size:32px;margin-bottom:8px;">' + esc(mod.icon || '📦') + '</div>' +
             '<div style="font-size:16px;font-weight:600;">' + esc(mod.name || mod.id) + '</div>' +
             '<div style="font-size:12.5px;opacity:.55;margin-top:6px;">açılır…</div></div>';
    };

    var prevAfter = mod.afterRender;
    mod.afterRender = function () {
      if (typeof prevAfter === 'function') { try { prevAfter.apply(mod, arguments); } catch (e) {} }
      setTimeout(function () {
        try { mod[fn](); }
        catch (e) {
          state.failures.push({ id: mod.id, error: (e && e.message) || String(e) });
          console.warn('[Module guard] "' + mod.id + '" açılmadı:', e);
        }
      }, 60);
    };

    state.fixed.push({ id: mod.id, via: fn + '()' });
    state.patched++;
    return true;
  }

  /* ----------------------------------------------------------------------
     1. register() sarğısı — bundan sonra qeyd olunanlar
     ---------------------------------------------------------------------- */
  function wrapRegister() {
    var reg = MR();
    if (!reg || typeof reg.register !== 'function' || reg.register.__guarded) return false;
    var orig = reg.register;
    reg.register = function (mod) {
      try { if (mod && typeof mod === 'object') attachRender(mod); } catch (e) {}
      return orig.apply(this, arguments);
    };
    reg.register.__guarded = true;
    state.found = true;
    return true;
  }

  /* ----------------------------------------------------------------------
     2. Artıq qeyd olunmuşları düzəlt
     ---------------------------------------------------------------------- */
  function fixExisting() {
    var reg = MR();
    if (!reg) return 0;
    var n = 0;
    /* `_all()` BÜTÜN modulları verir — `list()` isə icazə filtrindən keçirir,
       yəni icazəsi olmayan modul kənarda qalardı və yenə çökərdi. */
    try {
      if (typeof reg._all === 'function') {
        var all = reg._all() || {};
        Object.keys(all).forEach(function (id) { if (attachRender(all[id])) n++; });
      } else if (typeof reg.list === 'function') {
        reg.list().forEach(function (m) { if (attachRender(m)) n++; });
      }
    } catch (e) {}
    if (n) state.found = true;
    return n;
  }

  /* ----------------------------------------------------------------------
     3. renderPage() sarğısı — son qoruma
     ---------------------------------------------------------------------- */
  /* Qeyd: renderPage-in ÖZ try/catch-i var, ona görə xəta bizim sarğıya
     çatmır — əsl həll yuxarıdaki attachRender-dir. Bu sarğı yalnız
     registry-nin özündən kənar xətalar üçün son qorumadır. */
  function wrapRenderPage() {
    var reg = MR();
    if (!reg || typeof reg.renderPage !== 'function' || reg.renderPage.__guarded) return false;
    var orig = reg.renderPage;
    reg.renderPage = function (hash) {
      try { return orig.apply(this, arguments); }
      catch (e) {
        state.failures.push({ hash: hash, error: (e && e.message) || String(e) });
        console.warn('[Module guard] renderPage xətası:', e);
        return '<div style="padding:34px 16px;text-align:center;color:#e8e8f0;">' +
               '<div style="font-size:34px;margin-bottom:10px;">⚠️</div>' +
               '<div style="font-size:15.5px;font-weight:600;margin-bottom:6px;">Bu ekran açılmadı</div>' +
               '<div style="font-size:12.5px;opacity:.6;line-height:1.5;">' + esc((e && e.message) || '') + '</div>' +
               '<div style="font-size:12px;opacity:.45;margin-top:10px;">Proqramın qalan hissəsi işləyir.</div></div>';
      }
    };
    reg.renderPage.__guarded = true;
    return true;
  }

  /* ----------------------------------------------------------------------
     4. API
     ---------------------------------------------------------------------- */
  var Guard = {
    version: '1.0.0',

    initialize: function () {
      var w = wrapRegister();
      var r = wrapRenderPage();
      var n = fixExisting();
      state.wrapped = !!(w || r);
      // Modullar tənbəl yüklənir — bir neçə dəfə təkrar bax
      var tries = 0;
      var t = setInterval(function () {
        wrapRegister(); wrapRenderPage(); fixExisting();
        if (++tries > 60) clearInterval(t);
      }, 300);
      // Modul tənbəl yüklənib route dəyişəndə gələ bilər — girişdən əvvəl bax
      global.addEventListener('hashchange', function () {
        wrapRegister(); fixExisting();
      });
      return Promise.resolve({ wrapped: state.wrapped, fixedNow: n });
    },

    fixed: function () { return state.fixed.slice(); },
    failures: function () { return state.failures.slice(); },

    health: function () {
      var problems = [];
      if (!state.wrapped) problems.push('ModuleRegistry sarğılanmayıb');
      if (state.failures.length) problems.push(state.failures.length + ' modul açılarkən xəta verdi');
      return Promise.resolve({
        ok: problems.length === 0, problems: problems,
        patched: state.patched, fixed: state.fixed, failures: state.failures
      });
    },

    selfTest: function () {
      var fake = { id: '__guard_probe__', name: 'Sınaq', show: function () { fake._opened = true; } };
      var before = state.patched;
      attachRender(fake);
      var out = {
        ok: false,
        attached: typeof fake.render === 'function',
        counted: state.patched === before + 1,
        html: typeof fake.render() === 'string'
      };
      // qeydi geri al
      state.fixed = state.fixed.filter(function (f) { return f.id !== '__guard_probe__'; });
      state.patched = before;
      out.ok = out.attached && out.counted && out.html && state.found;
      return Promise.resolve(out);
    },

    _internals: function () { return state; }
  };

  global.JollyModuleGuard = Guard;
  Guard.initialize();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { fixExisting(); }, { once: true });
  }
  global.addEventListener('load', function () { fixExisting(); }, { once: true });

})(window);
