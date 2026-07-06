/* ============================================================
   JOLLY AI Core — əsas beyin (bütün modulları idarə edir)
   Axın: normalize → shortcut → typo → intent → analiz →
          health → action → kart → səs
   Köhnə JollyAI.respond() ilə uyğunluq üçün adapter də verir.
   ============================================================ */

const JollyAICore = (() => {
  const MEM_KEY = 'jolly_ai_memory_lite';
  const UNKNOWN_KEY = 'jolly_ai_unknown';

  const ctx = {
    lastFoundProductId: null,
    currentProductId: null,
    lastResults: [],
  };

  function getContext() { return { ...ctx }; }
  function setContext(patch) { Object.assign(ctx, patch || {}); }

  function saveUnknown(text) {
    try {
      const list = JollyDB.read(UNKNOWN_KEY, []);
      if (!list.some(x => x.text === text)) {
        list.unshift({ id: 'unk_' + Date.now(), text, ts: Date.now() });
        if (list.length > 100) list.length = 100;
        JollyDB.write(UNKNOWN_KEY, list);
      }
    } catch (e) {}
  }
  function getUnknownQueries() { return JollyDB.read(UNKNOWN_KEY, []); }
  function clearUnknownQuery(id) {
    JollyDB.write(UNKNOWN_KEY, getUnknownQueries().filter(x => x.id !== id));
  }

  /* ---------- Mağaza xəritəsi (stage-1 shim) ---------- */
  const STORE_MAP = [
    { keys: ['corab', 'носки', 'sock'], answer: 'Corablar bölməsi oyuncaqların sol tərəfindədir.' },
    { keys: ['party', 'parti'], answer: 'Party malları oyuncaqların sağ tərəfindədir.' },
    { keys: ['oyuncaq'], answer: 'Oyuncaqlar pilləkənə yaxın, mərkəzi hissədədir.' },
    { keys: ['fen'], answer: 'Fenlər sol divarda, krem bölməsindən sonradır.' },
    { keys: ['krem'], answer: 'Kremlər sol divarda, kosmetikadan sonradır.' },
    { keys: ['kosmetik'], answer: 'Kosmetika sol divarın yuxarısında, girişə yaxındır.' },
    { keys: ['xırdavat', 'xirdavat'], answer: 'Xırdavat oyuncaqların aşağı hissəsindədir.' },
    { keys: ['kassa'], answer: 'Kassalar mərkəzdədir — 3 kasa yan-yana.' },
  ];

  function mapLookup(text) {
    const t = text.toLowerCase();
    for (const m of STORE_MAP) { if (m.keys.some(k => t.includes(k))) return m.answer; }
    return null;
  }

  /* ---------- Əsas emal ---------- */
  function analyze(text) {
    const original = String(text || '');
    let working = original;

    // 1) Qısayol genişləndir
    if (typeof JollyAIShortcuts !== 'undefined' && JollyAIShortcuts.expand) {
      try { working = JollyAIShortcuts.expand(working) || working; } catch (e) {}
    }
    // 2) Typo düzəlt
    let corrected = working, typoFixed = false;
    if (typeof JollyAITypo !== 'undefined') {
      const r = JollyAITypo.correctText(working);
      corrected = r.text; typoFixed = r.corrected;
    }
    // 3) Sinonimləri kökə çevir (intent üçün köməkçi; göstərişdə original saxlanılır)
    let expanded = corrected;
    if (typeof JollyAIDictionary !== 'undefined') {
      expanded = JollyAIDictionary.expandText(corrected);
    }
    // 4) Intent
    let intent = { intent: 'search_products', confidence: 0.5, entities: {} };
    if (typeof JollyAIIntent !== 'undefined') {
      intent = JollyAIIntent.detect(corrected, ctx);
    }
    return { original, corrected, expanded, typoFixed, intent };
  }

  function ask(text) {
    const a = analyze(text);
    const result = {
      ok: true,
      answer: '',
      intent: a.intent.intent,
      confidence: a.intent.confidence,
      correctedText: a.corrected,
      originalText: a.original,
      products: [],
      doctor: null,
      insight: null,
      listTitle: '',
      action: null,
      speak: false,
    };

    const typoNote = (a.typoFixed && a.corrected !== a.original.toLowerCase())
      ? `"${a.original.trim()}" sözünü "${a.corrected}" kimi başa düşdüm. ` : '';

    const H = (typeof JollyAIHealth !== 'undefined') ? JollyAIHealth : null;
    const S = (typeof JollyAISearch !== 'undefined') ? JollyAISearch : null;
    const ent = a.intent.entities || {};

    switch (a.intent.intent) {
      case 'check_barcode': {
        const code = ent.barcode;
        result.answer = typoNote + checkBarcodeAnswer(code);
        break;
      }
      case 'missing_images': {
        const list = H ? H.getMissingImages() : [];
        result.products = list.map(p => ({ product: p }));
        result.listTitle = 'Şəkilsiz məhsullar';
        result.answer = typoNote + `${list.length} şəkilsiz məhsul tapdım.`;
        break;
      }
      case 'missing_barcodes': {
        const list = H ? H.getMissingBarcodes() : [];
        result.products = list.map(p => ({ product: p }));
        result.listTitle = 'Barkodsuz məhsullar';
        result.answer = typoNote + `${list.length} barkodsuz məhsul tapdım.`;
        break;
      }
      case 'filter_not_cashier_ready': {
        let list = H ? H.getNotCashierReady() : [];
        if (ent.brand) list = list.filter(p => (p.brand || p.firma || '').toLowerCase().includes(ent.brand.toLowerCase()));
        result.products = list.map(p => ({ product: p }));
        result.listTitle = (ent.brand ? ent.brand + ' — ' : '') + 'kassaya hazır olmayanlar';
        result.answer = typoNote + `${ent.brand ? ent.brand + ' firmasından ' : ''}${list.length} məhsul kassaya hazır deyil.`;
        break;
      }
      case 'problem_products': {
        const list = H ? H.getProblemStatus() : [];
        result.products = list.map(p => ({ product: p }));
        result.listTitle = 'Problemli məhsullar';
        result.answer = typoNote + `${list.length} problemli məhsul tapdım.`;
        break;
      }
      case 'health_report': {
        if (H) {
          const rep = H.scanCatalog();
          result.doctor = rep;
          result.insight = rep.recommendation;
          result.answer = typoNote + `Kataloq sağlamlığı: ${rep.score}%.`;
        }
        break;
      }
      case 'recommendation': {
        if (H) {
          const rep = H.scanCatalog();
          result.insight = rep.recommendation;
          result.answer = typoNote + rep.recommendation;
        }
        break;
      }
      case 'date_filter': {
        const range = ent.dateRange || (typeof JollyAIIntent !== 'undefined' ? JollyAIIntent.extractDateRange(a.corrected) : null);
        const list = filterByDate(range);
        result.products = list.map(p => ({ product: p }));
        result.listTitle = (range ? range.label : 'seçilmiş dövr') + ' əlavə olunanlar';
        result.answer = typoNote + `${range ? range.label + ' ' : ''}${list.length} məhsul tapdım.`;
        break;
      }
      case 'find_location': {
        const loc = mapLookup(a.expanded);
        if (loc) { result.answer = typoNote + loc; }
        else if (S) {
          const res = S.search(a.corrected, { limit: 5 });
          if (res.length && res[0].product.location) result.answer = typoNote + `"${res[0].product.name}" burada saxlanılır: ${res[0].product.location}`;
          else { result.answer = typoNote + 'Bu məhsulun yeri qeyd olunmayıb.'; result.products = res.map(x => ({ product: x.product })); }
        }
        break;
      }
      case 'share_product': {
        const pid = resolveContextProduct(a.corrected, S);
        if (pid) { result.action = { type: 'shareProduct', productId: pid }; result.answer = 'WhatsApp paylaşımı hazırlanır...'; }
        else result.answer = 'Göndəriləcək məhsul tapılmadı — əvvəl bir məhsul tap.';
        break;
      }
      case 'cashier_barcode': {
        const pid = resolveContextProduct(a.corrected, S);
        if (pid) { result.action = { type: 'cashierBarcode', productId: pid }; result.answer = 'Kassa barkodu açılır...'; }
        else result.answer = 'Barkod göstəriləcək məhsul tapılmadı.';
        break;
      }
      case 'show_current_barcode': {
        const pid = ctx.currentProductId || ctx.lastFoundProductId;
        const p = pid && JollyDB.Products.get(pid);
        const bc = p && (p.barcodes || [])[0];
        if (bc) { result.action = { type: 'showBarcode', barcode: bc }; result.answer = `Barkod: ${bc}`; }
        else result.answer = 'Açıq məhsul yoxdur və ya barkodu yoxdur.';
        break;
      }
      case 'edit_current_product': {
        const pid = ctx.currentProductId || ctx.lastFoundProductId;
        if (pid) { result.action = { type: 'editProduct', productId: pid }; result.answer = 'Redaktə açılır...'; }
        else result.answer = 'Redaktə üçün açıq məhsul yoxdur.';
        break;
      }
      case 'open_backup': result.action = { type: 'backup' }; result.answer = 'Backup səhifəsi açılır...'; break;
      case 'open_live_lens': result.action = { type: 'liveLens' }; result.answer = 'Live Lens açılır...'; break;
      case 'search_products':
      default: {
        if (S) {
          const res = S.search(a.corrected, { limit: 10 });
          if (res.length) {
            ctx.lastFoundProductId = res[0].product.id;
            ctx.lastResults = res.map(x => x.product.id);
            result.products = res.map(x => ({ product: x.product }));
            result.listTitle = 'Tapılan məhsullar';
            result.answer = typoNote + `${res.length} məhsul tapdım.`;
          } else {
            result.ok = false;
            result.answer = typoNote + 'Uyğun məhsul tapılmadı.';
            saveUnknown(a.original);
          }
        }
        break;
      }
    }

    result.speak = result.ok && !!result.answer;
    return result;
  }

  /* ---------- Köməkçilər ---------- */
  function resolveContextProduct(text, S) {
    // "bunu / son tapılanı" → kontekst; əks halda mətndən axtar
    if (/bunu|bunun|son tapıl|açdığım|acdigim/.test(text)) {
      return ctx.currentProductId || ctx.lastFoundProductId;
    }
    if (S) {
      const res = S.search(text, { limit: 1 });
      if (res.length) { ctx.lastFoundProductId = res[0].product.id; return res[0].product.id; }
    }
    return ctx.lastFoundProductId || ctx.currentProductId;
  }

  function filterByDate(range) {
    if (!range) return [];
    return JollyDB.Products.all().filter(p => {
      const t = p.createdAt || 0;
      return t >= range.from && t < range.to;
    });
  }

  function checkBarcodeAnswer(code) {
    if (!code) return 'Yoxlanacaq barkod tapmadım.';
    const d = String(code).replace(/\D/g, '');
    if (typeof JollyBarcodeGen === 'undefined' || !JollyBarcodeGen.validate) return `Barkod: ${d}`;
    const v = JollyBarcodeGen.validate(d);
    const dupCount = JollyDB.Products.all().filter(p => (p.barcodes || []).includes(d)).length;
    let msg = '';
    if (v.length === 13 || v.length === 8) {
      if (v.checksumOk) msg = `Bu ${v.expectedType.toUpperCase()} barkodu düzgündür ✅ — skanerdə oxunmalıdır.`;
      else msg = `Bu kod ${v.length} rəqəmlidir, amma ${v.expectedType.toUpperCase()} yoxlama rəqəmi səhvdir. Düz sonluq: ...${v.correctChecksum}. Rəqəmi dəyişmək istəmirsənsə, Code128 kimi yaradılmalıdır (JOLLY bunu avtomatik edir).`;
    } else {
      msg = `Bu kod ${d.length} rəqəmlidir — Code128 kimi yaradılır, hər zaman skan olunur.`;
    }
    if (dupCount > 1) msg += ` ⚠️ Bu barkod ${dupCount} məhsulda təkrarlanır.`;
    return msg;
  }

  /* ---------- Köhnə JollyAI.respond ilə uyğunluq ---------- */
  function respond(text) {
    const r = ask(text);
    // köhnə format: { text, action }
    let action = null;
    if (r.action) {
      if (r.action.type === 'shareProduct') action = { type: 'whatsapp', productId: r.action.productId };
      else if (r.action.type === 'cashierBarcode') { const p = JollyDB.Products.get(r.action.productId); const bc = p && (p.barcodes || [])[0]; action = bc ? { type: 'showBarcode', barcode: bc } : null; }
      else if (r.action.type === 'showBarcode') action = { type: 'showBarcode', barcode: r.action.barcode };
      else if (r.action.type === 'editProduct') action = { type: 'navigate', route: '#/product/' + r.action.productId + '/edit' };
      else if (r.action.type === 'backup') action = { type: 'navigate', route: '#/studios/integration' };
      else if (r.action.type === 'liveLens') action = { type: 'openLiveLens' };
    }
    // Səsli cavab (ayar açıqdırsa)
    if (r.speak && typeof JollyAIVoice !== 'undefined') JollyAIVoice.speak(r.answer);
    return { text: r.answer, action, _full: r };
  }

  function runAction(action) { if (typeof JollyAIActions !== 'undefined') JollyAIActions.run(action); }

  return { ask, analyze, respond, runAction, setContext, getContext, getUnknownQueries, clearUnknownQuery };
})();

/* ---------- Köhnə JollyAI-ni core-a bağla (chat.js/studios.js dəyişmədən işləsin) ---------- */
(function () {
  if (typeof JollyAI !== 'undefined' && JollyAI.respond) {
    const originalRespond = JollyAI.respond.bind(JollyAI);
    JollyAI.respondRaw = originalRespond;
    JollyAI.respond = function (text) {
      try {
        return JollyAICore.respond(text);
      } catch (e) {
        console.error('JollyAICore xətası, köhnə respond-a keçildi:', e);
        return originalRespond(text);
      }
    };
    // kontekst körpüsü
    if (JollyAI.setContext) {
      const origSet = JollyAI.setContext.bind(JollyAI);
      JollyAI.setContext = function (patch) { origSet(patch); JollyAICore.setContext(patch); };
    } else {
      JollyAI.setContext = JollyAICore.setContext;
    }
  }
})();
