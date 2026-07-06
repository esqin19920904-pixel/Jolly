/* ============================================================
   JOLLY Insight — Dərin analitika (Dashboard-dan "Analitika" açır)
   Router birbaşa çağırır: JollyInsight.render() → #/insight
   ============================================================ */

const JollyInsight = (() => {
  const esc = (s) => (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(s) : String(s));

  function bars(entries, colorFn) {
    const max = Math.max(1, ...entries.map(e => e[1]));
    return entries.map(([label, val], i) => `
      <div class="ins-bar-row">
        <div class="ins-bar-label">${esc(label)}</div>
        <div class="ins-bar-track"><div class="ins-bar-fill" style="width:${Math.round((val / max) * 100)}%;background:${colorFn ? colorFn(i) : 'var(--accent-1)'};"></div></div>
        <div class="ins-bar-val">${val}</div>
      </div>
    `).join('');
  }

  const PALETTE = ['#7c8aff', '#29e0c9', '#ff5fa2', '#ffb84d', '#a78bfa', '#5eead4', '#f472b6', '#facc15'];
  const colorOf = (i) => PALETTE[i % PALETTE.length];

  function render() {
    const products = JollyDB.Products.all();
    if (!products.length) {
      return `
        <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
        <div class="empty-state"><div class="big-icon">📈</div><h3>Hələ analiz üçün məlumat yoxdur</h3><p class="muted">Bir neçə məhsul əlavə et, sonra bura qayıt.</p></div>
      `;
    }

    const byBrand = {}, byGroup = {}, byLocation = {}, byStatus = {};
    let totalValue = 0, withImage = 0, withBarcode = 0, favCount = 0;
    let priceMin = Infinity, priceMax = 0, priceSum = 0, priceCount = 0;

    products.forEach(p => {
      if (p.brand) byBrand[p.brand] = (byBrand[p.brand] || 0) + 1;
      if (p.group) byGroup[p.group] = (byGroup[p.group] || 0) + 1;
      if (p.location) byLocation[p.location] = (byLocation[p.location] || 0) + 1;
      if (p.status) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      if (p.images && p.images.length) withImage++;
      if (p.barcodes && p.barcodes.length) withBarcode++;
      if (p.favorite) favCount++;
      const price = parseFloat(p.price);
      if (!isNaN(price)) {
        totalValue += price; priceSum += price; priceCount++;
        if (price < priceMin) priceMin = price;
        if (price > priceMax) priceMax = price;
      }
    });

    const top = (obj, n = 6) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
    const avgPrice = priceCount ? (priceSum / priceCount) : 0;
    const completeness = Math.round(((withImage + withBarcode) / (products.length * 2)) * 100);

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:20px;">📈 Analitika</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 16px;">Mağazanın dərin mənzərəsi — rəqəmlərlə.</p>

      <div class="studio-grid" style="margin-bottom:18px;">
        <div class="glass studio-card" style="min-height:78px;"><div class="ic">📦</div><div class="title" style="font-size:18px;">${products.length}</div><div class="sub">Ümumi məhsul</div></div>
        <div class="glass studio-card" style="min-height:78px;"><div class="ic">💰</div><div class="title" style="font-size:18px;">${totalValue.toFixed(0)} ₼</div><div class="sub">Ümumi dəyər</div></div>
        <div class="glass studio-card" style="min-height:78px;"><div class="ic">📊</div><div class="title" style="font-size:18px;">${avgPrice.toFixed(1)} ₼</div><div class="sub">Orta qiymət</div></div>
        <div class="glass studio-card" style="min-height:78px;"><div class="ic">✅</div><div class="title" style="font-size:18px;">${completeness}%</div><div class="sub">Kart tamlığı</div></div>
      </div>

      ${priceCount ? `
      <div class="section-title">Qiymət diapazonu</div>
      <div class="glass" style="padding:14px 16px;margin-bottom:6px;">
        <div class="row between"><span class="muted" style="font-size:12px;">Ən ucuz</span><span class="mono">${priceMin.toFixed(2)} ₼</span></div>
        <div class="row between"><span class="muted" style="font-size:12px;">Ən bahalı</span><span class="mono">${priceMax.toFixed(2)} ₼</span></div>
      </div>` : ''}

      <div class="section-title">🏭 Firma üzrə (top ${Math.min(6, Object.keys(byBrand).length)})</div>
      <div class="glass" style="padding:10px 14px;">
        ${Object.keys(byBrand).length ? bars(top(byBrand), colorOf) : '<div class="muted" style="padding:10px;">Məlumat yoxdur</div>'}
      </div>

      <div class="section-title">📦 Qrup üzrə</div>
      <div class="glass" style="padding:10px 14px;">
        ${Object.keys(byGroup).length ? bars(top(byGroup), colorOf) : '<div class="muted" style="padding:10px;">Məlumat yoxdur</div>'}
      </div>

      <div class="section-title">📍 Ref yeri üzrə</div>
      <div class="glass" style="padding:10px 14px;">
        ${Object.keys(byLocation).length ? bars(top(byLocation), colorOf) : '<div class="muted" style="padding:10px;">Məlumat yoxdur</div>'}
      </div>

      <div class="section-title">🔖 Status üzrə</div>
      <div class="glass" style="padding:10px 14px;">
        ${Object.keys(byStatus).length ? bars(top(byStatus), colorOf) : '<div class="muted" style="padding:10px;">Məlumat yoxdur</div>'}
      </div>

      <div class="section-title">Sağlamlıq</div>
      <div class="glass" style="padding:4px 14px;">
        <div class="list-row"><span>🖼️ Şəkli olan</span><span class="mono">${withImage}/${products.length}</span></div>
        <div class="list-row"><span>🏷️ Barkodu olan</span><span class="mono">${withBarcode}/${products.length}</span></div>
        <div class="list-row"><span>⭐ Favori</span><span class="mono">${favCount}</span></div>
      </div>
    `;
  }

  return { render };
})();
