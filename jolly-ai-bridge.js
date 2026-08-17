/* ============================================================
   JOLLY AI Körpüsü — jolly-ai-bridge.js
   v1.0  (2026-08-17)

   ────────────────────────────────────────────────────────────
   PROBLEM

   "JOLLY AI" əslində süni zəka deyildi — içində 18 hazır qayda
   var idi (barkodsuz, şəkilsiz, harada yerləşir və s.). Həmin
   siyahıdan kənar hər sual "başa düşmədim" ilə bitirdi.
   Chat-dəki Gemini körpüsü isə əl ilə API açarı tələb edirdi və
   işləmirdi.

   ────────────────────────────────────────────────────────────
   HƏLL

   Esqinin ikinci proqramında (Kodsuz Mehsullar) Cloudflare
   Workers AI onsuz da qurulub və işləyir — açar da, ödəniş də
   tələb etmir. JOLLY sualı ora göndərir.

   ★ VACİB: malların ÖZÜ göndərilmir. Yalnız YEKUN RƏQƏMLƏR
   gedir — neçə mal var, neçəsi barkodsuz, tədarükçü bölgüsü,
   bu ay neçə əlavə olunub. Model cavabı MƏHZ həmin rəqəmlərlə
   yazır, ona görə uydurma rəqəm verə bilmir.

   Qayda sırası dəyişmir: əvvəl JOLLY-nin öz Brain-i cavab
   verməyə çalışır (o, dəqiqdir və oflayn işləyir), yalnız
   tapmayanda körpü işə düşür.
   ============================================================ */
(function (global) {
  'use strict';

  if (global.JollyAIBridge) return;

  var URL_KEY = 'jolly_ai_url';
  var OFF_KEY = 'jolly_ai_off';
  var DEFAULT_URL = 'https://kodsuz-mehsullar.pages.dev/api/jolly-ai';

  function peek(name) {
    try {
      return new Function('try{return typeof ' + name + '!=="undefined"?' + name + ':null}catch(e){return null}')();
    } catch (e) { return null; }
  }
  function DB() { return global.JollyDB || peek('JollyDB'); }

  function endpoint() {
    try { return localStorage.getItem(URL_KEY) || DEFAULT_URL; } catch (e) { return DEFAULT_URL; }
  }
  function enabled() {
    try { return localStorage.getItem(OFF_KEY) !== '1'; } catch (e) { return true; }
  }

  /* ══════════════════════════════════════════════════════════
     MAĞAZANIN RƏQƏMLƏRİ
     Modelə göndərilən yeganə məlumat budur. Mal adları,
     barkodlar, şəkillər — heç biri getmir.
     ══════════════════════════════════════════════════════════ */
  function stats() {
    var d = DB();
    var list = [];
    try { list = (d && d.Products && d.Products.all) ? (d.Products.all() || []) : []; } catch (e) {}

    var s = {
      cemi_mal: list.length,
      barkodsuz: 0, sekilsiz: 0, qiymetsiz: 0,
      tedarukcusuz: 0, yersiz: 0, qrupsuz: 0
    };
    var sup = {}, brand = {}, grp = {}, loc = {};
    var now = Date.now();
    var ay = 0, hefte = 0;

    for (var i = 0; i < list.length; i++) {
      var p = list[i] || {};
      if (!(p.barcodes || []).length) s.barkodsuz++;
      if (!(p.images || []).length) s.sekilsiz++;
      if (!p.price) s.qiymetsiz++;
      if (!p.supplier) s.tedarukcusuz++; else sup[p.supplier] = (sup[p.supplier] || 0) + 1;
      if (!p.location) s.yersiz++; else loc[p.location] = (loc[p.location] || 0) + 1;
      if (!p.group) s.qrupsuz++; else grp[p.group] = (grp[p.group] || 0) + 1;
      if (p.brand) brand[p.brand] = (brand[p.brand] || 0) + 1;

      var t = p.createdAt || p.created || 0;
      if (t) {
        if (now - t < 31 * 864e5) ay++;
        if (now - t < 7 * 864e5) hefte++;
      }
    }
    s.bu_ay_elave = ay;
    s.bu_hefte_elave = hefte;

    var top = function (o, n) {
      return Object.keys(o).map(function (k) { return { ad: k, say: o[k] }; })
        .sort(function (a, b) { return b.say - a.say; }).slice(0, n || 8);
    };
    s.tedarukculer = top(sup);
    s.firmalar = top(brand);
    s.qruplar = top(grp);
    s.yerler = top(loc, 6);

    /* Tam doldurulmuş malların payı */
    var tam = 0;
    for (var j = 0; j < list.length; j++) {
      var x = list[j] || {};
      if ((x.barcodes || []).length && (x.images || []).length && x.price &&
          x.supplier && (x.group || x.category)) tam++;
    }
    s.tam_doldurulmus = tam;
    s.saglamliq_faizi = list.length ? Math.round(tam / list.length * 100) : 0;
    return s;
  }

  /* ══════════════════════════════════════════════════════════
     Soruş
     ══════════════════════════════════════════════════════════ */
  function ask(q) {
    q = String(q || '').trim();
    if (!q) return Promise.resolve({ ok: false, error: 'Sual boşdur' });
    if (!enabled()) return Promise.resolve({ ok: false, error: 'Körpü söndürülüb' });
    if (!global.navigator || global.navigator.onLine === false) {
      return Promise.resolve({ ok: false, error: 'İnternet yoxdur', offline: true });
    }

    var body;
    try { body = JSON.stringify({ q: q, stats: stats() }); }
    catch (e) { return Promise.resolve({ ok: false, error: 'Məlumat hazırlanmadı' }); }

    /* 20 saniyədən çox gözlətmirik */
    var ctrl = null, timer = null;
    try { ctrl = new AbortController(); } catch (e) { ctrl = null; }
    var opt = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body };
    if (ctrl) { opt.signal = ctrl.signal; timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 20000); }

    return fetch(endpoint(), opt)
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }); })
      .then(function (j) {
        if (timer) clearTimeout(timer);
        if (!j || !j.ok) return { ok: false, error: (j && j.error) || 'Cavab alınmadı' };
        return { ok: true, text: String(j.text || '').trim() };
      })
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        var m = (e && e.name === 'AbortError') ? 'Cavab gecikdi' : 'Bağlantı alınmadı';
        return { ok: false, error: m };
      });
  }

  /* Bağlantını yoxlamaq — Studio-dan çağırıla bilər */
  function test() {
    return ask('Salam, neçə malım var?').then(function (r) {
      var T = global.Toast || peek('Toast');
      try {
        if (r.ok) { if (T && T.success) T.success('✅ AI körpüsü işləyir'); }
        else if (T && T.error) T.error('❌ ' + r.error);
      } catch (e) {}
      return r;
    });
  }

  /* ══════════════════════════════════════════════════════════
     CHAT-Ə QOŞULMA
     `JollyChat` Brain tapmayanda "başa düşmədim" yazırdı.
     Həmin anı tutub körpüyə veririk. chat.js-ə TOXUNULMUR.
     ══════════════════════════════════════════════════════════ */
  var UNKNOWN_RE = /(başa düşmədim|basa dusmedim|anlamadım|anlamadim|bilmirəm|bilmirem|tapa bilmədim)/i;

  function hookChat() {
    var C = global.JollyChat || peek('JollyChat');
    if (!C || C.__bridged) return false;

    /* Chat mesajı ekrana yazan funksiyanı sarğılayırıq */
    var names = ['appendBubble', 'addBubble', 'push', 'reply'];
    var hooked = false;

    for (var i = 0; i < names.length; i++) {
      var fn = C[names[i]];
      if (typeof fn !== 'function') continue;
      (function (key, orig) {
        C[key] = function (role, html) {
          var out = orig.apply(C, arguments);
          try {
            if (role === 'bot' && UNKNOWN_RE.test(String(html || '')) && lastQ) {
              var q = lastQ; lastQ = '';
              ask(q).then(function (r) {
                if (!r.ok) return;
                try {
                  orig.call(C, 'bot', esc(r.text).replace(/\n/g, '<br>') +
                    '<div class="muted" style="font-size:10px;margin-top:4px;">☁️ AI</div>');
                } catch (e) {}
              });
            }
          } catch (e) {}
          return out;
        };
        hooked = true;
      })(names[i], fn);
    }

    if (hooked) { C.__bridged = true; console.log('[AI körpüsü] Chat-ə qoşuldu'); }
    return hooked;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* İstifadəçinin son sualını yadda saxlayırıq ki, Brain
     tapmayanda onu körpüyə göndərə bilək */
  var lastQ = '';

  function watchInput() {
    document.addEventListener('keydown', function (e) {
      try {
        if (e.key !== 'Enter') return;
        var t = e.target;
        if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA')) return;
        var v = String(t.value || '').trim();
        if (v) lastQ = v;
      } catch (er) {}
    }, true);

    document.addEventListener('click', function (e) {
      try {
        var t = e.target;
        if (!t) return;
        var box = document.querySelector('#chatInput, #chat-input, .chat-input input, .chat-input textarea');
        if (box && String(box.value || '').trim()) lastQ = String(box.value).trim();
      } catch (er) {}
    }, true);
  }

  /* ══════════════════════════════════════════════════════════
     Açıq API
     ══════════════════════════════════════════════════════════ */
  global.JollyAIBridge = {
    ask: ask,
    test: test,
    stats: stats,
    endpoint: endpoint,
    setEndpoint: function (u) {
      try { localStorage.setItem(URL_KEY, String(u || '').trim() || DEFAULT_URL); } catch (e) {}
    },
    enabled: enabled,
    setEnabled: function (on) {
      try { localStorage.setItem(OFF_KEY, on ? '0' : '1'); } catch (e) {}
    }
  };

  var tries = 0;
  function boot() {
    watchInput();
    if (hookChat() || ++tries > 60) return;
    setTimeout(boot, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }

  global.addEventListener('hashchange', function () {
    if (String(global.location.hash || '').indexOf('#/chat') === 0) setTimeout(hookChat, 300);
  });

})(typeof window !== 'undefined' ? window : this);
