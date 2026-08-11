/* ============================================================
   JOLLY Chat əmr körpüsü — jolly-chat-fix.js
   v1.0  (2026-08-05)

   ────────────────────────────────────────────────────────────
   PROBLEM (cihazda göründü):
   Çatda "Wp" yazanda "WhatsApp paylaşımı hazırlanır..." yazılır,
   sonra HEÇ NƏ olmur.

   SƏBƏB — ad uyğunsuzluğu, iki yollu axın:
   `chat.js` (sətir 166) Gemini modulu varsa BU yolu seçir:
        JollyGemini.ask(text) → r.full.action
   `r.full` isə `JollyAICore.ask()`-in XAM nəticəsidir və orada
   əmrin adı `shareProduct`-dır.
   `chat.js` (sətir 225-233) yalnız bunları tanıyır:
        navigate · openVisualSearch · whatsapp · showBarcode · confirmDelete
   `shareProduct` siyahıda yoxdur → əmr sadəcə düşür.

   Gemini olmasaydı `JollyAI.respond()` çağırılardı və o,
   adları düzgün çevirir (jolly-ai-core.js:270-277) — yəni səhv
   yalnız Gemini qoşulu olanda üzə çıxır.

   ────────────────────────────────────────────────────────────
   HƏLL:
   `JollyGemini.ask` kənardan sarğılanır və `full.action`
   chat.js-in başa düşdüyü formaya çevrilir — eynən respond()
   necə edirsə. chat.js-ə də, jolly-ai-core.js-ə də TOXUNULMUR.

        shareProduct   → whatsapp
        cashierBarcode → showBarcode (məhsulun barkodu tapılır)
        editProduct    → navigate #/product/<id>/edit
        backup         → navigate #/studios/data
        liveLens       → birbaşa icra olunur (chat onu tanımır)
   ============================================================ */
(function (global) {
  'use strict';

  function peek(name) {
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }

  function firstBarcode(id) {
    var DB = global.JollyDB || peek('JollyDB');
    try {
      var p = DB && DB.Products && DB.Products.get ? DB.Products.get(id) : null;
      return p && (p.barcodes || [])[0] || null;
    } catch (e) { return null; }
  }

  /* Xam əmri chat.js-in tanıdığı formaya çevirir.
     null qaytarsa — əmr chat üçün yararsızdır (özümüz icra edirik). */
  function normalize(a) {
    if (!a || !a.type) return a || null;
    switch (a.type) {
      case 'shareProduct':
        return { type: 'whatsapp', productId: a.productId };
      case 'cashierBarcode': {
        var bc = firstBarcode(a.productId);
        return bc ? { type: 'showBarcode', barcode: bc } : null;
      }
      case 'editProduct':
        return { type: 'navigate', route: '#/product/' + a.productId + '/edit' };
      case 'backup':
        return { type: 'navigate', route: '#/studios/data' };
      case 'liveLens':
      case 'openLiveLens': {
        var A = global.JollyAIActions || peek('JollyAIActions');
        try { if (A && A.run) A.run({ type: 'liveLens' }); } catch (e) {}
        return null;                       // chat onu tanımır — özümüz açdıq
      }
      default:
        return a;                          // navigate/whatsapp/showBarcode/list — olduğu kimi
    }
  }

  function wrap() {
    var G = global.JollyGemini || peek('JollyGemini');
    if (!G || typeof G.ask !== 'function') return false;
    if (G.ask.__jcf) return true;

    var orig = G.ask.bind(G);
    var wrapped = function (text) {
      var out;
      try { out = orig(text); } catch (e) { return Promise.reject(e); }
      if (!out || typeof out.then !== 'function') return out;
      return out.then(function (r) {
        try {
          if (r && r.source !== 'gemini' && r.full && r.full.action) {
            r.full.action = normalize(r.full.action);
          }
        } catch (e) {}
        return r;
      });
    };
    wrapped.__jcf = true;
    G.ask = wrapped;
    if (!global.JollyGemini) { try { global.JollyGemini = G; } catch (e) {} }
    return true;
  }

  global.JollyChatFix = {
    normalize: normalize,
    status: function () {
      var G = global.JollyGemini || peek('JollyGemini');
      return { wrapped: !!(G && G.ask && G.ask.__jcf) };
    }
  };

  var tries = 0;
  function boot() {
    if (wrap() || ++tries > 40) {
      console.log('[ChatFix] ' + (global.JollyChatFix.status().wrapped
        ? 'çat əmr körpüsü quruldu'
        : 'JollyGemini tapılmadı — körpü lazım deyil'));
      return;
    }
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 120); });
  } else {
    setTimeout(boot, 120);
  }

})(typeof window !== 'undefined' ? window : this);
