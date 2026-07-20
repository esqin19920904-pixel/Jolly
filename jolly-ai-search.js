/* ============================================================
   JOLLY AI Search — ağıllı, çoxsahəli, ballı axtarış
   Ad, firma, qrup, yer, status, barkod, son4, kod, model,
   qeyd, teq, rəng üzrə axtarır; hər nəticəyə score + səbəb verir.
   ============================================================ */

const JollyAISearch = (() => {
  function norm(s) { return String(s || '').toLowerCase().trim(); }

  function fieldOf(p, names) {
    for (const n of names) { if (p[n] != null && p[n] !== '') return p[n]; }
    return null;
  }

  /* ---------- Bir məhsulu sorğuya görə balla ---------- */
  function scoreProduct(p, query) {
    const q = norm(query);
    if (!q) return { score: 0, reason: '' };
    let score = 0;
    const reasons = [];

    const name = norm(fieldOf(p, ['name', 'title']));
    const brand = norm(fieldOf(p, ['brand', 'firma']));
    const group = norm(fieldOf(p, ['group', 'qrup', 'category']));
    const location = norm(fieldOf(p, ['location', 'place', 'shelf']));
    const status = norm(p.status);
    const note = norm(p.note);
    const color = norm(p.color);
    const mainCode = norm(p.mainCode);
    const model = norm(p.extraCodeValue);
    const barcodes = (p.barcodes || (p.barcode ? [p.barcode] : [])).map(norm);
    const tags = (p.tags || []).map(norm);

    const words = q.split(/\s+/).filter(Boolean);

    words.forEach(w => {
      if (name === w) { score += 50; reasons.push('ad tam uyğun'); }
      else if (name.includes(w)) { score += 30; reasons.push('ad uyğun'); }
      if (brand === w) { score += 35; reasons.push('firma uyğun'); }
      else if (brand && brand.includes(w)) { score += 20; reasons.push('firma qismən'); }
      if (group === w || (group && group.includes(w))) { score += 22; reasons.push('qrup uyğun'); }
      if (location && location.includes(w)) { score += 15; reasons.push('yer uyğun'); }
      if (status && status.includes(w)) { score += 12; reasons.push('status uyğun'); }
      if (mainCode === w) { score += 40; reasons.push('kod uyğun'); }
      if (model && model.includes(w)) { score += 25; reasons.push('model uyğun'); }
      if (note && note.includes(w)) { score += 8; reasons.push('qeyddə tapıldı'); }
      if (color && color.includes(w)) { score += 10; reasons.push('rəng uyğun'); }
      if (tags.some(t => t.includes(w))) { score += 12; reasons.push('teq uyğun'); }
      barcodes.forEach(b => {
        if (b === w) { score += 60; reasons.push('barkod tam uyğun'); }
        else if (w.length >= 4 && b.endsWith(w)) { score += 45; reasons.push('son rəqəmlər uyğun'); }
        else if (w.length >= 5 && b.includes(w)) { score += 25; reasons.push('barkod qismən'); }
      });
      if (p.last4 && norm(p.last4) === w) { score += 45; reasons.push('son 4 uyğun'); }
    });

    return { score, reason: [...new Set(reasons)].join(', ') };
  }

  /* ---------- Əsas axtarış ---------- */
  function searchProducts(query, opts = {}) {
    const all = JollyDB.Products.all();
    const results = [];
    all.forEach(p => {
      const { score, reason } = scoreProduct(p, query);
      if (score > 0) results.push({ product: p, score, reason });
    });
    results.sort((a, b) => b.score - a.score);
    return opts.limit ? results.slice(0, opts.limit) : results;
  }

  // Girişdə icazə yoxlanılır — "AI Axtarış" bağlıdırsa, boş nəticə qaytarır
  function search(query, opts = {}) {
    if (window.JollyAuth && !JollyAuth.can('search.ai')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 AI Axtarış icazən yoxdur');
      return [];
    }
    const q = norm(query);
    if (/^\d{4}$/.test(q)) {
      const byLast4 = searchByLast4(q);
      if (byLast4.length) return byLast4;
    }
    if (/^\d{8,14}$/.test(q)) {
      const byBc = searchByBarcode(q);
      if (byBc.length) return byBc;
    }
    return searchProducts(q, opts);
  }

  function searchByBarcode(code) {
    const c = norm(code);
    return JollyDB.Products.all()
      .filter(p => (p.barcodes || []).some(b => norm(b) === c))
      .map(p => ({ product: p, score: 100, reason: 'barkod tam uyğun' }));
  }

  function searchByLast4(last4) {
    const l = norm(last4);
    return JollyDB.Products.all()
      .filter(p => (p.last4 && norm(p.last4) === l) || (p.barcodes || []).some(b => norm(b).endsWith(l)))
      .map(p => ({ product: p, score: 90, reason: 'son 4 rəqəm uyğun' }));
  }

  function searchByBrand(brand) {
    const b = norm(brand);
    return JollyDB.Products.all()
      .filter(p => norm(fieldOf(p, ['brand', 'firma'])).includes(b))
      .map(p => ({ product: p, score: 80, reason: 'firma uyğun' }));
  }

  function searchByGroup(group) {
    const g = norm(group);
    return JollyDB.Products.all()
      .filter(p => norm(fieldOf(p, ['group', 'qrup', 'category'])).includes(g))
      .map(p => ({ product: p, score: 80, reason: 'qrup uyğun' }));
  }

  function searchByLocation(location) {
    const l = norm(location);
    return JollyDB.Products.all()
      .filter(p => norm(fieldOf(p, ['location', 'place', 'shelf'])).includes(l))
      .map(p => ({ product: p, score: 80, reason: 'yer uyğun' }));
  }

  function suggest(query) {
    return searchProducts(query, { limit: 5 });
  }

  return { search, searchProducts, searchByBarcode, searchByLast4, searchByBrand, searchByGroup, searchByLocation, suggest, scoreProduct };
})();
