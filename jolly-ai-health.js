/* ============================================================
   JOLLY AI Health — kataloqun sağlamlıq beyni
   "Kassaya hazır" qaydası (qiymət DAXİL DEYİL):
   ad + şəkil + barkod + barkod yaranabilir + son4 + firma + qrup
   ============================================================ */

const JollyAIHealth = (() => {
  function f(p, names) { for (const n of names) { if (p[n] != null && p[n] !== '') return p[n]; } return null; }
  function imgs(p) { return p.images || (p.image ? [p.image] : (p.photo ? [p.photo] : [])); }
  function bcs(p) { return p.barcodes || (p.barcode ? [p.barcode] : []); }

  function canGenerateBarcode(p) {
    const b = bcs(p)[0];
    if (!b) return false;
    if (typeof JollyBarcodeGen === 'undefined') return true; // yoxlaya bilmiriksə, qırma
    try {
      const g = JollyBarcodeGen.generate(b);
      return !!(g && g.canvas);
    } catch (e) { return false; }
  }

  function last4Ok(p) {
    const b = bcs(p)[0];
    if (!b) return false;
    return String(b).length >= 4;
  }

  function isCashierReady(p) {
    return !!(
      f(p, ['name', 'title']) &&
      imgs(p).length &&
      bcs(p).length &&
      canGenerateBarcode(p) &&
      last4Ok(p) &&
      f(p, ['brand', 'firma']) &&
      f(p, ['group', 'qrup', 'category'])
    );
  }

  function productDNA(p) {
    const checks = [
      { key: 'name', label: 'Ad', ok: !!f(p, ['name', 'title']) },
      { key: 'image', label: 'Şəkil', ok: imgs(p).length > 0 },
      { key: 'barcode', label: 'Barkod', ok: bcs(p).length > 0 },
      { key: 'barcodeGen', label: 'Barkod çap oluna bilir', ok: canGenerateBarcode(p) },
      { key: 'brand', label: 'Firma', ok: !!f(p, ['brand', 'firma']) },
      { key: 'group', label: 'Qrup', ok: !!f(p, ['group', 'qrup', 'category']) },
      { key: 'location', label: 'Yer / Rəf', ok: !!f(p, ['location', 'place', 'shelf']) },
    ];
    const okCount = checks.filter(c => c.ok).length;
    return { checks, score: Math.round((okCount / checks.length) * 100), missing: checks.filter(c => !c.ok).map(c => c.label) };
  }

  /* ---------- Kataloq üzrə siyahılar ---------- */
  function all() { return JollyDB.Products.all(); }
  function getMissingImages() { return all().filter(p => !imgs(p).length); }
  function getMissingBarcodes() { return all().filter(p => !bcs(p).length); }
  function getMissingBrands() { return all().filter(p => !f(p, ['brand', 'firma'])); }
  function getMissingGroups() { return all().filter(p => !f(p, ['group', 'qrup', 'category'])); }
  function getMissingLocations() { return all().filter(p => !f(p, ['location', 'place', 'shelf'])); }
  function getNotCashierReady() { return all().filter(p => !isCashierReady(p)); }
  function getProblemStatus() { return all().filter(p => (p.status || '').toLowerCase().includes('problem')); }

  function getDuplicateBarcodes() {
    const map = {};
    all().forEach(p => bcs(p).forEach(b => { (map[b] = map[b] || []).push(p); }));
    return Object.entries(map).filter(([, list]) => list.length > 1).map(([code, products]) => ({ code, products }));
  }

  function getInvalidEAN() {
    if (typeof JollyBarcodeGen === 'undefined' || !JollyBarcodeGen.validate) return [];
    return all().filter(p => bcs(p).some(b => !JollyBarcodeGen.validate(b).checksumOk));
  }

  function getNoDate() { return all().filter(p => !p.createdAt); }

  /* ---------- Tam hesabat ---------- */
  function scanCatalog() {
    const total = all().length;
    const report = {
      total,
      missingImages: getMissingImages().length,
      missingBarcodes: getMissingBarcodes().length,
      missingBrands: getMissingBrands().length,
      missingGroups: getMissingGroups().length,
      missingLocations: getMissingLocations().length,
      duplicateBarcodes: getDuplicateBarcodes().length,
      invalidEAN: getInvalidEAN().length,
      notCashierReady: getNotCashierReady().length,
      problemStatus: getProblemStatus().length,
      noDate: getNoDate().length,
      score: getCatalogScore(),
    };
    report.biggestProblem = biggestProblem(report);
    report.recommendation = recommendation(report);
    return report;
  }

  function getCatalogScore() {
    const total = all().length;
    if (!total) return 100;
    const ready = all().filter(isCashierReady).length;
    return Math.round((ready / total) * 100);
  }

  function biggestProblem(r) {
    const items = [
      ['barkodsuz məhsullar', r.missingBarcodes],
      ['şəkilsiz məhsullar', r.missingImages],
      ['firması boş məhsullar', r.missingBrands],
      ['qrupu boş məhsullar', r.missingGroups],
      ['dublikat barkodlar', r.duplicateBarcodes],
      ['səhv EAN barkodlar', r.invalidEAN],
    ].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    return items.length ? items[0][0] : null;
  }

  function recommendation(r) {
    if (!r.total) return 'Hələ məhsul yoxdur — əvvəl bir neçə məhsul əlavə et.';
    if (!r.biggestProblem) return 'Kataloq tam sağlamdır! ✨';
    return `Ən böyük problem: ${r.biggestProblem}. Əvvəl oradan başlamağı tövsiyə edirəm.`;
  }

  return {
    isCashierReady, productDNA, scanCatalog, getCatalogScore,
    getMissingImages, getMissingBarcodes, getMissingBrands, getMissingGroups, getMissingLocations,
    getDuplicateBarcodes, getInvalidEAN, getNotCashierReady, getProblemStatus, getNoDate,
  };
})();
