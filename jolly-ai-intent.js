/* ============================================================
   JOLLY AI Intent — istifadəçinin nə istədiyini tapan beyin
   Intent + entity (firma, qrup, barkod, tarix aralığı) çıxarır.
   ============================================================ */

const JollyAIIntent = (() => {
  function norm(s) { return String(s || '').toLowerCase().trim(); }

  /* ---------- Entity çıxarma ---------- */
  function extractBarcode(text) {
    const m = String(text).match(/\b(\d{8,14})\b/);
    return m ? m[1] : null;
  }

  function extractLast4(text) {
    const m = String(text).trim().match(/^(\d{4})$/);
    return m ? m[1] : null;
  }

  function extractBrand(text) {
    const t = norm(text);
    try {
      const brands = JollyDB.Brands.all().map(b => b.name);
      for (const b of brands) {
        if (b && t.includes(norm(b))) return b;
      }
      // Bazada olmayan, amma məhsullarda keçən firmalar
      const productBrands = [...new Set(JollyDB.Products.all().map(p => p.brand).filter(Boolean))];
      for (const b of productBrands) {
        if (t.includes(norm(b))) return b;
      }
    } catch (e) {}
    return null;
  }

  function extractGroup(text) {
    const t = norm(text);
    try {
      const groups = [...new Set(JollyDB.Products.all().map(p => p.group).filter(Boolean))];
      for (const g of groups) {
        if (t.includes(norm(g))) return g;
      }
    } catch (e) {}
    return null;
  }

  function extractDateRange(text) {
    const t = norm(text);
    const day = 864e5;
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const t0 = today0.getTime();
    if (/dünən|dunen/.test(t)) return { from: t0 - day, to: t0, label: 'dünən' };
    if (/bu ?gün|bu ?gun|bugün|bugun/.test(t)) return { from: t0, to: t0 + day, label: 'bu gün' };
    if (/bu həftə|bu hefte|son 7/.test(t)) return { from: t0 - 7 * day, to: Date.now(), label: 'son 7 gün' };
    if (/son 30|bu ay/.test(t)) return { from: t0 - 30 * day, to: Date.now(), label: 'son 30 gün' };
    if (/köhnə|kohne|yenilənməyən|yenilenmeyen/.test(t)) return { from: 0, to: Date.now() - 60 * day, label: 'köhnə (60+ gün)' };
    return null;
  }

  /* ---------- Intent aşkarlama ---------- */
  // Sıra vacibdir — daha spesifik olanlar əvvəl yoxlanır
  const RULES = [
    { intent: 'check_barcode', test: t => /\d{8,14}/.test(t) && /(yoxla|çek|check)/.test(t), conf: 0.95 },
    { intent: 'share_product', test: t => /(whatsapp|whatsapa|wp\b|göndər|gonder|paylaş|paylas)/.test(t), conf: 0.92 },
    { intent: 'cashier_barcode', test: t => /kassa.*(barkod|bar kod)|barkod.*kassa|kassa barkodu/.test(t), conf: 0.92 },
    { intent: 'show_current_barcode', test: t => /(bunun|bunu|son).*(barkod)/.test(t), conf: 0.9 },
    { intent: 'edit_current_product', test: t => /(bunu|bunun|son tapılanı).*(düzəlt|duzelt|redaktə|redakte)/.test(t), conf: 0.9 },
    { intent: 'missing_images', test: t => /(şəkil|sekil|şəkli|sekli|şəkili).*(olmayan|yox|siz)|şəkilsiz|sekilsiz/.test(t), conf: 0.93 },
    { intent: 'missing_barcodes', test: t => /(barkod|barcode).*(olmayan|yox|suz)|barkodsuz/.test(t), conf: 0.93 },
    { intent: 'filter_not_cashier_ready', test: t => /hazır deyil|hazir deyil|hazır olmayan|hazir olmayan/.test(t), conf: 0.9 },
    { intent: 'health_report', test: t => /kataloqu yoxla|kataloq.*(yoxla|sağlamlıq|saglamliq)|problemləri tap|problemleri tap|sağlamlıq|saglamliq/.test(t), conf: 0.9 },
    { intent: 'recommendation', test: t => /nədən başlayım|neden baslayim|nə məsləhət|ne meslehet|tövsiyə|tovsiye/.test(t), conf: 0.88 },
    { intent: 'date_filter', test: t => /(dünən|dunen|bu ?gün|bu ?gun|bugün|bugun|bu həftə|bu hefte|son \d+|köhnə|kohne).*(əlavə|elave|dəyiş|deyis|yenilən|yenilen|nə etmişəm|ne etmisem)|((əlavə|elave).*(etmişəm|etmisem|olunan))/.test(t), conf: 0.88 },
    { intent: 'find_location', test: t => /(hardadı|hardadi|haradadır|haradadir|harda\b|yeri hara|yerində|hansı rəf|hansi ref)/.test(t), conf: 0.9 },
    { intent: 'open_backup', test: t => /backup|ehtiyat|yedək|yedek/.test(t), conf: 0.88 },
    { intent: 'open_live_lens', test: t => /live lens|lens aç|lens ac/.test(t), conf: 0.9 },
    { intent: 'open_studio', test: t => /studio aç|studio ac|studios/.test(t), conf: 0.8 },
    { intent: 'problem_products', test: t => /problemli/.test(t), conf: 0.88 },
    { intent: 'search_products', test: t => t.length > 0, conf: 0.5 },
  ];

  function detect(text, context) {
    const t = norm(text);
    const entities = {
      brand: extractBrand(t),
      group: extractGroup(t),
      barcode: extractBarcode(t),
      last4: extractLast4(t),
      dateRange: extractDateRange(t),
    };
    for (const rule of RULES) {
      if (rule.test(t)) {
        let conf = rule.conf;
        // entity varsa inam artır
        if (entities.brand || entities.group || entities.barcode) conf = Math.min(0.98, conf + 0.05);
        return { intent: rule.intent, confidence: conf, entities };
      }
    }
    return { intent: 'unknown', confidence: 0.2, entities };
  }

  function extractEntities(text) {
    return {
      brand: extractBrand(text),
      group: extractGroup(text),
      barcode: extractBarcode(text),
      last4: extractLast4(text),
      dateRange: extractDateRange(text),
    };
  }

  return { detect, extractEntities, extractDateRange, extractBrand, extractGroup, extractBarcode, extractLast4 };
})();
