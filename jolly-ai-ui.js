/* ============================================================
   JOLLY AI UI — cavabları kart kimi göstərir
   Məhsul kartı, siyahı, doctor kartı, insight kartı, test debug
   HTML string qaytarır (chat/panel içinə yerləşir).
   ============================================================ */

const JollyAIUI = (() => {
  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }
  function f(p, names) { for (const n of names) { if (p[n] != null && p[n] !== '') return p[n]; } return null; }
  function imgRef(p) {
    const img = (p.images && p.images[0]) || p.image || p.photo;
    if (!img) return null;
    return img;
  }

  function renderProductCard(p) {
    const img = imgRef(p);
    const name = esc(f(p, ['name', 'title']) || 'Adsız məhsul');
    const brand = f(p, ['brand', 'firma']);
    const group = f(p, ['group', 'qrup', 'category']);
    const location = f(p, ['location', 'place', 'shelf']);
    const barcode = (p.barcodes || [])[0] || p.barcode || '';
    const thumb = img
      ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(img) : `src="${esc(img)}"`} style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex-shrink:0;">`
      : `<div style="width:56px;height:56px;border-radius:12px;background:var(--glass);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">🧴</div>`;
    return `
      <div class="glass ai-product-card" style="padding:12px;margin:8px 0;">
        <div style="display:flex;gap:12px;align-items:center;">
          ${thumb}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;">${name}</div>
            <div class="muted" style="font-size:11.5px;line-height:1.5;">
              ${brand ? `🏷️ ${esc(brand)}　` : ''}${group ? `📦 ${esc(group)}　` : ''}${location ? `📍 ${esc(location)}` : ''}
              ${barcode ? `<br><span class="mono">🧾 ${esc(barcode)}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;">
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="JollyRouter.go('#/product/${p.id}')">Aç</button>
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="JollyAIActions.shareProduct('${p.id}')">📲</button>
          ${barcode ? `<button class="btn btn-ghost btn-sm" style="flex:1;" onclick="JollyProducts.showBarcode('${esc(barcode)}')">🧾</button>` : ''}
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="JollyRouter.go('#/product/${p.id}/edit')">✏️</button>
        </div>
      </div>
    `;
  }

  function renderProductList(products, title) {
    if (!products || !products.length) return `<div class="muted" style="padding:10px;">Nəticə tapılmadı.</div>`;
    const shown = products.slice(0, 8);
    const head = title ? `<div class="section-title" style="margin-top:4px;">${esc(title)} <span class="muted">(${products.length})</span></div>` : '';
    const more = products.length > shown.length ? `<div class="muted" style="font-size:11.5px;padding:6px;">+${products.length - shown.length} daha... <a onclick="JollyRouter.go('#/products')" style="color:var(--accent-1);cursor:pointer;">Hamısına bax</a></div>` : '';
    return head + shown.map(x => renderProductCard(x.product || x)).join('') + more;
  }

  function renderDoctorCard(report) {
    const color = report.score >= 80 ? 'var(--accent-2)' : report.score >= 50 ? 'var(--accent-warn)' : 'var(--accent-danger)';
    const row = (label, val, route) => val > 0 ? `<div class="list-row" ${route ? `onclick="JollyRouter.go('${route}')" style="cursor:pointer;"` : ''}><span>${label}</span><span class="mono">${val}</span></div>` : '';
    return `
      <div class="glass" style="padding:14px;margin:8px 0;">
        <div style="text-align:center;margin-bottom:8px;">
          <div style="font-family:var(--font-display);font-size:30px;font-weight:700;color:${color};">${report.score}%</div>
          <div class="muted" style="font-size:11.5px;">Kataloq sağlamlığı</div>
        </div>
        ${row('Şəkilsiz', report.missingImages, '#/products?filter=sekilsiz')}
        ${row('Barkodsuz', report.missingBarcodes, '#/products?filter=barkodsuz')}
        ${row('Firması boş', report.missingBrands)}
        ${row('Qrupu boş', report.missingGroups)}
        ${row('Dublikat barkod', report.duplicateBarcodes, '#/brain/duplicates')}
        ${row('Səhv EAN', report.invalidEAN)}
        ${row('Kassaya hazır deyil', report.notCashierReady, '#/data-doctor')}
        <button class="btn btn-primary btn-block btn-sm" style="margin-top:10px;" onclick="JollyRouter.go('#/data-doctor')">🩺 Data Doctor ilə düzəlt</button>
      </div>
    `;
  }

  function renderInsightCard(insight) {
    return `
      <div class="glass" style="padding:14px;margin:8px 0;border-left:3px solid var(--accent-1);">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px;">💡 Tövsiyə</div>
        <div class="muted" style="font-size:12.5px;line-height:1.5;">${esc(insight)}</div>
      </div>
    `;
  }

  function renderTestDebug(debug) {
    const line = (k, v) => `<div class="list-row"><span class="muted">${k}</span><span class="mono" style="font-size:11.5px;">${esc(v)}</span></div>`;
    return `
      <div class="glass" style="padding:4px 14px;margin:8px 0;">
        ${line('Original', debug.originalText)}
        ${line('Corrected', debug.correctedText)}
        ${line('Intent', debug.intent)}
        ${line('Confidence', Math.round((debug.confidence || 0) * 100) + '%')}
        ${line('Entity', JSON.stringify(debug.entities || {}))}
        ${line('Action', debug.actionType || '—')}
      </div>
    `;
  }

  // Core-dan gələn tam nəticəni HTML-ə çevir
  function renderAnswer(result) {
    let html = '';
    if (result.answer) html += `<div style="margin:4px 0;line-height:1.5;">${esc(result.answer).replace(/\n/g, '<br>')}</div>`;
    if (result.doctor) html += renderDoctorCard(result.doctor);
    if (result.insight) html += renderInsightCard(result.insight);
    if (result.products && result.products.length) html += renderProductList(result.products, result.listTitle);
    return html;
  }

  return { renderProductCard, renderProductList, renderDoctorCard, renderInsightCard, renderTestDebug, renderAnswer };
})();
