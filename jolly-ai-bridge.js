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
     EKRANA QOŞULMA
     ──────────────────────────────────────────────────────────
     JOLLY-də süni zəka İKİ ayrı yerdə görünür: "JOLLY AI"
     paneli (jolly-ai-ui.js) və "Tam Chat" (chat.js). Hər ikisi
     cavab tapmayanda fərqli cümlə yazır:
       · "Uyğun məhsul tapılmadı."   (jolly-ai-core.js:216)
       · "Oxşar məhsul tapılmadı. 🔍" (chat.js:278)
       · "Nəticə tapılmadı."          (jolly-ai-ui.js:49)

     Ona görə konkret funksiyanı sarğılamaq əvəzinə EKRANA
     baxırıq: həmin cümlə DOM-a düşən kimi tuturuq və altına
     modelin cavabını əlavə edirik. Beləcə hansı ekranda
     olmağının fərqi yoxdur, heç bir köhnə fayla toxunulmur.
     ══════════════════════════════════════════════════════════ */
  var UNKNOWN_RE = /(uyğun məhsul tapılmadı|oxşar məhsul tapılmadı|nəticə tapılmadı|başa düşmədim|basa dusmedim|anlamadım|anlamadim|başa düşmürəm|tapa bilmədim)/i;

  var busy = false;

  function textOf(el) {
    try { return String(el.textContent || '').trim(); } catch (e) { return ''; }
  }

  /* Cavabı "tapılmadı" baloncuğunun ardınca qoyur */
  function appendAnswer(afterEl, text) {
    try {
      var box = document.createElement('div');
      box.setAttribute('data-aib-out', '1');
      box.style.cssText = 'margin:8px 0;padding:11px 13px;border-radius:14px;' +
        'background:rgba(147,197,253,.12);border:1px solid rgba(147,197,253,.28);' +
        'font-size:13.5px;line-height:1.55';
      box.innerHTML = esc(text).replace(/\n/g, '<br>') +
        '<div style="font-size:10px;opacity:.55;margin-top:5px">☁️ AI</div>';
      if (afterEl.parentNode) afterEl.parentNode.insertBefore(box, afterEl.nextSibling);
      else document.body.appendChild(box);
      try { box.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    } catch (e) {}
  }

  function handleNode(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.getAttribute && el.getAttribute('data-aib')) return;
    if (el.getAttribute && el.getAttribute('data-aib-out')) return;

    var t = textOf(el);
    if (!t || t.length > 120 || !UNKNOWN_RE.test(t)) return;

    /* Ən dərin uyğun elementi seçirik ki, bütün pəncərəni tutmayaq */
    try {
      var kids = el.children || [];
      for (var i = 0; i < kids.length; i++) {
        if (UNKNOWN_RE.test(textOf(kids[i]))) return;   // uşaq daha dəqiqdir
      }
    } catch (e) {}

    el.setAttribute('data-aib', '1');
    if (!lastQ || busy) return;

    var q = lastQ;
    busy = true;
    ask(q).then(function (r) {
      busy = false;
      if (r && r.ok && r.text) appendAnswer(el, r.text);
    }).catch(function () { busy = false; });
  }

  function scan(root) {
    try {
      var nodes = (root || document).querySelectorAll('div,p,span,li');
      for (var i = 0; i < nodes.length; i++) handleNode(nodes[i]);
    } catch (e) {}
  }

  var obs = null;
  function watchScreen() {
    if (obs || !document.body) return;
    try {
      obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes || [];
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n && n.nodeType === 1) { handleNode(n); scan(n); }
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) { obs = null; }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Son sual — cavabsız qalanda onu modelə göndəririk */
  var lastQ = '';

  function grabInputs() {
    var vals = [];
    try {
      var ins = document.querySelectorAll('input,textarea');
      for (var i = 0; i < ins.length; i++) {
        var v = String(ins[i].value || '').trim();
        if (v.length > 1) vals.push(v);
      }
    } catch (e) {}
    return vals;
  }

  function watchInput() {
    /* Enter ilə göndərmə */
    document.addEventListener('keydown', function (e) {
      try {
        if (e.key !== 'Enter') return;
        var t = e.target;
        if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA')) return;
        var v = String(t.value || '').trim();
        if (v.length > 1) lastQ = v;
      } catch (er) {}
    }, true);

    /* ➤ düyməsi ilə göndərmə — xana təmizlənməzdən ƏVVƏL oxuyuruq */
    document.addEventListener('click', function () {
      try {
        var vals = grabInputs();
        if (vals.length) lastQ = vals[vals.length - 1];
      } catch (er) {}
    }, true);

    /* Hazır sual çipləri */
    document.addEventListener('click', function (e) {
      try {
        var t = e.target;
        for (var i = 0; i < 3 && t; i++) {
          var s = String(t.textContent || '').trim();
          if (s && s.length > 3 && s.length < 60 && !/^\d+$/.test(s)) { lastQ = s; break; }
          t = t.parentNode;
        }
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

  function boot() {
    watchInput();
    watchScreen();
    scan(document);
    console.log('[AI körpüsü] ekrana qoşuldu — ' + endpoint());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }

  global.addEventListener('hashchange', function () {
    setTimeout(function () { watchScreen(); scan(document); }, 300);
  });

})(typeof window !== 'undefined' ? window : this);
