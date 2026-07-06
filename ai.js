/* ============================================================
   JOLLY AI — yalnız proqramın daxili məlumatları üzərində
   işləyən, sərbəst formada cavab verən köməkçi.
   Xarici/ümumi suallara (hava və s.) cavab vermir.
   ============================================================ */

const JollyAI = (() => {
  const OUT_OF_SCOPE_HINTS = [
    'hava', 'saat neçə', 'kim var', 'dünya', 'siyasət', 'futbol', 'xəbər',
    'gpt', 'chatgpt', 'zarafat', 'lətifə', 'mahnı', 'film',
  ];

  /* ---------- Kontekst yaddaşı ---------- */
  const ctx = {
    lastSearchResults: [],
    lastFoundProductId: null,
    lastVisualSearchResults: [],
    lastSharedProductId: null,
    lastCommand: null,
    currentProductId: null,
  };

  function getContext() { return ctx; }
  function setContext(patch) { Object.assign(ctx, patch); }

  function rememberResults(products) {
    ctx.lastSearchResults = products || [];
    if (products && products.length === 1) ctx.lastFoundProductId = products[0].id;
  }

  function normalize(s) {
    return (s || '').toLowerCase()
      .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
      .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
      .trim();
  }

  function isOutOfScope(text) {
    const n = normalize(text);
    return OUT_OF_SCOPE_HINTS.some(h => n.includes(normalize(h)));
  }

  function fmtPrice(p) { return p != null && p !== '' ? `${p} ₼` : 'qiymət yoxdur'; }

  function describeProduct(p) {
    const parts = [`**${p.name}**`];
    if (p.mainCode) parts.push(`kod: ${p.mainCode}`);
    if (p.extraCodeType && p.extraCodeValue) parts.push(`${p.extraCodeType}: ${p.extraCodeValue}`);
    if (p.brand) parts.push(`firma: ${p.brand}`);
    if (p.group) parts.push(`qrup: ${p.group}`);
    if (p.location) parts.push(`yer: ${p.location}`);
    parts.push(fmtPrice(p.price));
    if (p.barcodes && p.barcodes.length) parts.push(`barkod(lar): ${p.barcodes.join(', ')}`);
    if (p.status) parts.push(`status: ${p.status}`);
    return parts.join(' • ');
  }

  function findProductsByFreeText(text) {
    const results = JollyDB.Products.search(text);
    return results;
  }

  /* ---------- Ana cavab generatoru ---------- */
  function respond(rawText) {
    const text = rawText.trim();
    ctx.lastCommand = text;
    const n = normalize(text);

    if (!text) return { text: 'Nə soruşmaq istəyirsən?', action: null };

    // Visual Search açılışı
    if (n === 'vsearch' || n.includes('visual search') || (n.includes('sekilden') && n.includes('tap')) || (n.includes('şəkildən') && n.includes('tap'))) {
      return { text: 'Visual Search açılır — məhsulu kameraya tut və ya qalereyadan seç.', action: { type: 'openVisualSearch' } };
    }

    // Son tapılanı / bunu WhatsApp-a göndər
    if (n === 'wp' || n.includes('whatsapp') || (n.includes('gonder') && (n.includes('tapdig') || n.includes('son') || n.includes('bunu'))) || (n.includes('göndər') && (n.includes('tapdığ') || n.includes('son') || n.includes('bunu')))) {
      const pid = ctx.lastFoundProductId || ctx.currentProductId;
      if (!pid) return { text: 'Göndəriləcək məhsul yoxdur — əvvəlcə bir məhsul tap və ya aç.', action: null };
      const p = JollyDB.Products.get(pid);
      ctx.lastSharedProductId = pid;
      return { text: p ? `**${p.name}** WhatsApp-a göndərilir.` : 'Göndərilir...', action: { type: 'whatsapp', productId: pid } };
    }

    // Açıq olan məhsulla bağlı əmrlər: "bunu redaktə et", "bunun barkodunu göstər"
    if (n.includes('bunu') || n.includes('bunun') || n.includes('acig') || n.includes('açığ')) {
      const pid = ctx.currentProductId || ctx.lastFoundProductId;
      if (pid) {
        if (n.includes('redakte') || n.includes('redaktə')) return { text: 'Redaktə səhifəsi açılır.', action: { type: 'navigate', route: `#/product/${pid}/edit` } };
        if (n.includes('barkod')) {
          const p = JollyDB.Products.get(pid);
          const bc = p && p.barcodes && p.barcodes[0];
          if (bc) return { text: `Barkod göstərilir: **${bc}**`, action: { type: 'showBarcode', barcode: bc } };
          return { text: 'Bu məhsulun barkodu yoxdur.', action: null };
        }
        if (n.includes('sil')) return { text: 'Silinməsini təsdiqlə.', action: { type: 'confirmDelete', productId: pid } };
      }
    }

    // Studio-lara birbaşa keçid
    if (n.includes('analytics') || n.includes('analitika studio')) return { text: 'Analytics Studio açılır.', action: { type: 'navigate', route: '#/studios/analytics' } };
    if (n.includes('integration') || n.includes('inteqrasiya')) return { text: 'Integration Studio açılır.', action: { type: 'navigate', route: '#/studios/integration' } };
    if (n.includes('voice') && n.includes('vision') || n.includes('voicevision') || (n.includes('sesli') && n.includes('gorme'))) return { text: 'Voice & Vision Studio açılır.', action: { type: 'navigate', route: '#/studios/voicevision' } };
    if (n.includes('silinmis') || n.includes('silinmiş') || n.includes('sebet') || n.includes('səbət')) return { text: 'Silinmişlər qovluğu açılır.', action: { type: 'navigate', route: '#/dashboard/trash' } };
    if (n.includes('data doctor') || n.includes('datadoctor')) return { text: 'Data Doctor açılır — kataloqu yoxlayır.', action: { type: 'navigate', route: '#/data-doctor' } };
    if (n.includes('print') || n.includes('cap et') || n.includes('çap') || (n.includes('barkod') && n.includes('cap'))) return { text: 'Barkod Print Center açılır.', action: { type: 'navigate', route: '#/studios/print' } };

    const result = respondRaw(text, n);
    if (result.action && result.action.type === 'list' && result.action.products) {
      rememberResults(result.action.products);
    }
    return result;
  }

  function respondRaw(text, n) {
    if (isOutOfScope(text)) {
      return {
        text: 'Mən yalnız JOLLY daxilindəki məlumatlarla (məhsullar, firmalar, qruplar, statuslar) kömək edə bilərəm — xarici mövzularda köməkçi deyiləm.',
        action: null,
      };
    }

    // Sayım sualları
    if (/(neçe|nece).*(mehsul|mal)/.test(n) || n.includes('umumi mehsul')) {
      const all = JollyDB.Products.all();
      return { text: `Bazada cəmi **${all.length}** məhsul var.`, action: null };
    }

    if (n.includes('problemli')) {
      const all = JollyDB.Products.all().filter(p => (p.status || '').toLowerCase().includes('problem'));
      if (all.length === 0) return { text: 'Hazırda "Problemli" statuslu məhsul yoxdur. 👍', action: { type: 'list', products: [] } };
      return {
        text: `**${all.length}** problemli məhsul tapıldı:\n\n` + all.slice(0, 8).map(describeProduct).join('\n\n'),
        action: { type: 'list', products: all },
      };
    }

    if (n.includes('barkodsuz') || (n.includes('barkod') && n.includes('yox'))) {
      const all = JollyDB.Products.filter({ hasBarcode: false });
      return {
        text: all.length ? `**${all.length}** barkodsuz məhsul var:\n\n` + all.slice(0, 8).map(describeProduct).join('\n\n') : 'Barkodsuz məhsul yoxdur.',
        action: { type: 'list', products: all },
      };
    }

    if (n.includes('sekilsiz') || n.includes('şəkilsiz')) {
      const all = JollyDB.Products.filter({ hasImage: false });
      return {
        text: all.length ? `**${all.length}** şəkilsiz məhsul var.` : 'Bütün məhsulların şəkli var. 👍',
        action: { type: 'list', products: all },
      };
    }

    // Qaralamalar
    if (n.includes('qaralama')) {
      const drafts = JollyDB.Drafts.all();
      return {
        text: drafts.length ? `**${drafts.length}** qaralama var.` : 'Heç bir qaralama yoxdur.',
        action: { type: 'navigate', route: '#/drafts' },
      };
    }

    // Silmə əmri: "sil <ad>"
    let m = n.match(/^sil (.+)/) || n.match(/(.+) sil$/);
    if (m) {
      const query = m[1].trim();
      const found = findProductsByFreeText(query);
      if (found.length === 0) return { text: `"${query}" üzrə məhsul tapılmadı.`, action: null };
      if (found.length === 1) {
        return {
          text: `**${found[0].name}** məhsulunu silmək istədiyinə əminsən? Təsdiq üçün məhsul kartını aç.`,
          action: { type: 'confirmDelete', productId: found[0].id },
        };
      }
      return {
        text: `"${query}" üzrə ${found.length} nəticə tapıldı, dəqiq hansını nəzərdə tutduğunu deməlisən:\n\n` + found.slice(0, 6).map(describeProduct).join('\n\n'),
        action: { type: 'list', products: found },
      };
    }

    // Yeni məhsul
    if (n.includes('yeni mehsul') || n.includes('mehsul elave')) {
      return { text: 'Yeni məhsul kartını açıram.', action: { type: 'navigate', route: '#/product/new' } };
    }

    // Studio aç
    if (n.includes('brain') || n.includes('beyin') || n.includes('dublikat') || n.includes('temizle') || n.includes('təmizlə')) return { text: 'AI Brain açılır.', action: { type: 'navigate', route: '#/brain' } };
    if (n.includes('admin studio')) return { text: 'Admin Studio açılır.', action: { type: 'navigate', route: '#/studios/admin' } };
    if (n.includes('ai studio')) return { text: 'AI Studio açılır.', action: { type: 'navigate', route: '#/studios/ai' } };
    if (n.includes('theme studio') || n.includes('tema studio')) return { text: 'Theme Studio açılır.', action: { type: 'navigate', route: '#/studios/theme' } };
    if (n.includes('code studio') || n.includes('kod studio')) return { text: 'Code Studio açılır.', action: { type: 'navigate', route: '#/studios/code' } };
    if (n.includes('workflow')) return { text: 'Workflow Studio açılır.', action: { type: 'navigate', route: '#/studios/workflow' } };
    if (n.includes('hesabat') || n.includes('report') || n.includes('statistika')) return { text: 'Report Studio açılır.', action: { type: 'navigate', route: '#/studios/report' } };
    if (n.includes('backup') || n.includes('ehtiyat')) return { text: 'Data Studio açılır — backup orada.', action: { type: 'navigate', route: '#/studios/data' } };
    if (n.includes('bildiris') || n.includes('bildiriş')) return { text: 'Bildirişlər açılır.', action: { type: 'navigate', route: '#/notifications' } };

    // Firma/qrup üzrə sayım
    let bm = n.match(/(.+)\s+firma/) || n.match(/firma\s+(.+)/);
    if (bm) {
      const brandQ = bm[1].trim();
      const brand = JollyDB.Brands.all().find(b => normalize(b.name).includes(brandQ));
      if (brand) {
        const items = JollyDB.Products.filter({ brand: brand.name });
        return {
          text: `**${brand.name}** firmasında **${items.length}** məhsul var.` + (items.length ? '\n\n' + items.slice(0, 6).map(describeProduct).join('\n\n') : ''),
          action: { type: 'list', products: items },
        };
      }
    }

    // Ən bahalı / ən ucuz
    if (n.includes('en baha') || n.includes('bahali')) {
      const withPrice = JollyDB.Products.all().filter(p => p.price != null && p.price !== '').sort((a, b) => b.price - a.price);
      if (withPrice.length) return { text: `Ən bahalı məhsul:\n\n${describeProduct(withPrice[0])}`, action: { type: 'list', products: [withPrice[0]] } };
    }
    if (n.includes('en ucuz') || n.includes('ucuz')) {
      const withPrice = JollyDB.Products.all().filter(p => p.price != null && p.price !== '').sort((a, b) => a.price - b.price);
      if (withPrice.length) return { text: `Ən ucuz məhsul:\n\n${describeProduct(withPrice[0])}`, action: { type: 'list', products: [withPrice[0]] } };
    }

    // Qiymət dəyiş: "<ad> qiymətini <rəqəm> elə"
    m = n.match(/(.+) qiymet.*?(\d+[\.,]?\d*)/);
    if (m) {
      const query = m[1].trim();
      const price = parseFloat(m[2].replace(',', '.'));
      const found = findProductsByFreeText(query);
      if (found.length === 1) {
        JollyDB.Products.update(found[0].id, { price });
        return { text: `**${found[0].name}** məhsulunun qiyməti **${price} ₼** olaraq yeniləndi.`, action: { type: 'refresh' } };
      }
      if (found.length > 1) {
        return { text: `"${query}" üzrə ${found.length} məhsul var, dəqiqləşdir zəhmət olmasa.`, action: { type: 'list', products: found } };
      }
    }

    // Ümumi axtarış — default fallback
    const found = findProductsByFreeText(text);
    if (found.length > 0) {
      return {
        text: `"${text}" üzrə **${found.length}** nəticə:\n\n` + found.slice(0, 8).map(describeProduct).join('\n\n'),
        action: { type: 'list', products: found },
      };
    }

    return {
      text: `"${text}" üzrə heç nə tapmadım. Ad, kod, barkod, firma və ya qrup adı ilə yenidən yoxla.`,
      action: null,
    };
  }

  return { respond, isOutOfScope, describeProduct, getContext, setContext, rememberResults };
})();
