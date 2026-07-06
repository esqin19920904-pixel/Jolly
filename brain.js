/* ============================================================
   JOLLY AI Brain — sistemin daxili ağlı (API'siz, pulsuz)
   Təkliflər, dublikat aşkarlama, kataloq təmizləmə, analiz
   ============================================================ */

const JollyBrain = (() => {

  function norm(s) {
    return (s || '').toString().toLowerCase()
      .replace(/ə/g,'e').replace(/ı/g,'i').replace(/ö/g,'o')
      .replace(/ü/g,'u').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ğ/g,'g').trim();
  }

  /* ---------- Təkliflər (məhsul formasında istifadə olunur) ---------- */

  // Ada görə firma təklif et: keçmişdə bu adla/oxşar məhsullarda hansı firma çox işlənib
  function suggestBrand(name) {
    const n = norm(name);
    if (!n) return null;
    const products = JollyDB.Products.all();
    const counts = {};
    products.forEach(p => {
      if (!p.brand) return;
      // ad oxşarlığı: sözlərdən biri uyğun gəlirsə
      if (norm(p.name).split(' ').some(w => w && n.includes(w)) || n.split(' ').some(w => w && norm(p.name).includes(w))) {
        counts[p.brand] = (counts[p.brand] || 0) + 1;
      }
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    return sorted.length ? sorted[0][0] : null;
  }

  // Firma/ada görə qrup təklif et
  function suggestGroup(name, brand) {
    const n = norm(name);
    const products = JollyDB.Products.all();
    const counts = {};
    products.forEach(p => {
      if (!p.group) return;
      const nameMatch = n && (norm(p.name).split(' ').some(w => w && n.includes(w)));
      const brandMatch = brand && p.brand === brand;
      if (nameMatch || brandMatch) counts[p.group] = (counts[p.group] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    return sorted.length ? sorted[0][0] : null;
  }

  // Firma/qrupa görə rəf təklif et
  function suggestLocation(brand, group) {
    const products = JollyDB.Products.all();
    const counts = {};
    products.forEach(p => {
      if (!p.location) return;
      if ((brand && p.brand === brand) || (group && p.group === group)) {
        counts[p.location] = (counts[p.location] || 0) + 1;
      }
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    return sorted.length ? sorted[0][0] : null;
  }

  // Ada/firmaya görə status təklif et
  function suggestStatus(name, brand) {
    const n = norm(name);
    const products = JollyDB.Products.all();
    const counts = {};
    products.forEach(p => {
      if (!p.status) return;
      const nameMatch = n && norm(p.name).split(' ').some(w => w && n.includes(w));
      const brandMatch = brand && p.brand === brand;
      if (nameMatch || brandMatch) counts[p.status] = (counts[p.status] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    return sorted.length ? sorted[0][0] : null;
  }

  // Bütün təklifləri bir yerdə (forma üçün)
  function suggestAll({ name, brand, group }) {
    return {
      brand: suggestBrand(name),
      group: suggestGroup(name, brand),
      location: suggestLocation(brand, group),
      status: suggestStatus(name, brand),
    };
  }

  /* ---------- OCR mətnindən ağıllı məlumat çıxarma ---------- */
  function parseOcrText(rawText) {
    const text = (rawText || '').trim();
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const result = { name: '', mainCode: '', barcode: '', price: '', raw: text };

    const barcodeMatch = text.match(/\b\d{8,13}\b/);
    if (barcodeMatch) result.barcode = barcodeMatch[0];

    const priceMatch = text.match(/(\d+[.,]?\d{0,2})\s*(₼|azn|man|manat)\b/i)
      || text.match(/\b(\d{1,4}[.,]\d{2})\b/);
    if (priceMatch) result.price = priceMatch[1].replace(',', '.');

    const codeMatch = text.match(/(?:kod|code|no|model|art|item)[\s:.#-]*(\d{1,6})/i);
    if (codeMatch) result.mainCode = codeMatch[1];

    let bestName = '';
    for (const line of lines) {
      const letters = (line.match(/[a-zA-ZəöüışçğƏÖÜİŞÇĞ]/g) || []).length;
      const digits = (line.match(/\d/g) || []).length;
      if (letters >= 3 && letters > digits && line.length > bestName.length && line.length < 40) {
        bestName = line;
      }
    }
    result.name = bestName;
    return result;
  }

  /* ---------- Oxşar məhsul tapma (mətn + vizual) ---------- */
  function findSimilar(product, limit = 6) {
    const all = JollyDB.Products.all().filter(p => p.id !== product.id);
    const scored = all.map(p => {
      let score = 0;
      // eyni firma
      if (product.brand && p.brand === product.brand) score += 3;
      // eyni qrup
      if (product.group && p.group === product.group) score += 3;
      // ad oxşarlığı (ortaq sözlər)
      const aw = norm(product.name).split(' ').filter(Boolean);
      const bw = norm(p.name).split(' ').filter(Boolean);
      const common = aw.filter(w => bw.includes(w)).length;
      score += common * 2;
      // eyni rəng
      if (product.color && p.color === product.color) score += 1;
      // eyni yer
      if (product.location && p.location === product.location) score += 1;
      return { product: p, score };
    }).filter(x => x.score > 0);
    scored.sort((a,b) => b.score - a.score);
    return scored.slice(0, limit).map(x => x.product);
  }

  /* ---------- Ölü stok / diqqət tələb edən ---------- */
  function findStale(days = 60) {
    const cutoff = Date.now() - days * 864e5;
    return JollyDB.Products.all()
      .filter(p => (p.updatedAt || p.createdAt || Date.now()) < cutoff)
      .sort((a,b) => (a.updatedAt||a.createdAt||0) - (b.updatedAt||b.createdAt||0));
  }

  /* ---------- Dublikat aşkarlama ---------- */
  function findDuplicates() {
    const products = JollyDB.Products.all();
    const groups = [];
    const seen = new Set();

    for (let i = 0; i < products.length; i++) {
      if (seen.has(products[i].id)) continue;
      const cluster = [products[i]];
      for (let j = i + 1; j < products.length; j++) {
        if (seen.has(products[j].id)) continue;
        const a = products[i], b = products[j];
        let dup = false;
        // eyni barkod
        if ((a.barcodes||[]).some(bc => (b.barcodes||[]).includes(bc))) dup = true;
        // eyni əsas kod
        if (a.mainCode && a.mainCode === b.mainCode) dup = true;
        // eyni ad + eyni firma
        if (norm(a.name) === norm(b.name) && a.brand === b.brand && a.name) dup = true;
        if (dup) { cluster.push(b); seen.add(b.id); }
      }
      if (cluster.length > 1) { cluster.forEach(c => seen.add(c.id)); groups.push(cluster); }
    }
    return groups;
  }

  /* ---------- Kataloq təmizləmə (natamam məhsullar) ---------- */
  function findIncomplete() {
    const products = JollyDB.Products.all();
    return {
      noImage: products.filter(p => !p.images || p.images.length === 0),
      noBarcode: products.filter(p => !p.barcodes || p.barcodes.length === 0),
      noPrice: products.filter(p => p.price == null || p.price === ''),
      noBrand: products.filter(p => !p.brand),
      noLocation: products.filter(p => !p.location),
    };
  }

  /* ---------- Ümumi analiz ---------- */
  function analyze() {
    const products = JollyDB.Products.all();
    const dups = findDuplicates();
    const inc = findIncomplete();
    const stale = findStale();
    const health = products.length === 0 ? 100 :
      Math.round(100 - (
        (inc.noImage.length + inc.noBarcode.length + inc.noPrice.length) /
        (products.length * 3) * 100
      ));
    return {
      total: products.length,
      duplicateGroups: dups.length,
      duplicateItems: dups.reduce((s,g)=>s+g.length,0),
      incomplete: inc,
      staleCount: stale.length,
      health: Math.max(0, health),
    };
  }

  /* ---------- Brain Center səhifəsi ---------- */
  function renderCenter() {
    const a = analyze();
    const inc = a.incomplete;
    const healthColor = a.health >= 75 ? 'var(--accent-2)' : a.health >= 45 ? 'var(--accent-warn)' : 'var(--accent-danger)';
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:20px;">🧠 AI Brain</h2>
      <p class="muted" style="font-size:13px;margin:0 0 16px;">Sistemin ağlı — analiz edir, təkliflər verir, təmizləyir.</p>

      <div class="glass" style="padding:18px;margin-bottom:16px;text-align:center;">
        <div style="font-size:13px;color:var(--text-low);text-transform:uppercase;letter-spacing:1px;">Kataloq sağlamlığı</div>
        <div style="font-family:var(--font-display);font-size:46px;font-weight:700;color:${healthColor};line-height:1.1;">${a.health}%</div>
        <div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.08);overflow:hidden;margin-top:8px;">
          <div style="height:100%;width:${a.health}%;background:${healthColor};transition:width .5s ease;"></div>
        </div>
      </div>

      <div class="studio-grid" style="margin-bottom:16px;">
        ${statCard('📦', a.total, 'Məhsul')}
        ${statCard('👯', a.duplicateItems, 'Dublikat', a.duplicateItems ? '#/brain/duplicates' : null)}
        ${statCard('🖼️', inc.noImage.length, 'Şəkilsiz', '#/products?filter=sekilsiz')}
        ${statCard('🏷️', inc.noBarcode.length, 'Barkodsuz', '#/products?filter=barkodsuz')}
      </div>

      <div class="section-title">Ağıllı əməliyyatlar</div>
      <div class="glass" style="padding:4px 14px;">
        <div class="list-row" onclick="JollyRouter.go('#/brain/duplicates')">
          <span>👯 Dublikatları tap</span><span class="status-pill"><span class="dot" style="background:${a.duplicateGroups?'var(--accent-warn)':'var(--accent-2)'}"></span>${a.duplicateGroups}</span>
        </div>
        <div class="list-row" onclick="JollyRouter.go('#/brain/cleanup')">
          <span>🧹 Kataloqu təmizlə</span><span>›</span>
        </div>
        <div class="list-row" onclick="JollyRouter.go('#/brain/stale')">
          <span>💤 Ölü stok (${a.staleCount})</span><span>›</span>
        </div>
        <div class="list-row" onclick="JollyRouter.go('#/studios/ai')">
          <span>💬 JOLLY AI ilə danış</span><span>›</span>
        </div>
        <div class="list-row" onclick="JollyRouter.go('#/studios/report')">
          <span>📊 Hesabatlar</span><span>›</span>
        </div>
      </div>

      <div class="section-title">Daha çox alət</div>
      <div class="glass" style="padding:4px 14px;">
        <div class="list-row" onclick="JollyRouter.go('#/data-doctor')"><span>🩺 Data Doctor</span><span>›</span></div>
        <div class="list-row" onclick="JollyRouter.go('#/studios/analytics')"><span>🔮 Analytics Studio</span><span>›</span></div>
        <div class="list-row" onclick="JollyRouter.go('#/studios/print')"><span>🖨️ Barkod Print Center</span><span>›</span></div>
        <div class="list-row" onclick="JollyRouter.go('#/chat')"><span>💬 JOLLY Chat</span><span>›</span></div>
      </div>
    `;
  }

  function statCard(icon, value, label, route) {
    const click = route ? `onclick="JollyRouter.go('${route}')"` : '';
    return `<div class="glass studio-card" ${click} style="min-height:80px;align-items:center;text-align:center;justify-content:center;">
      <div class="ic">${icon}</div>
      <div class="title" style="font-size:20px;">${value}</div>
      <div class="sub">${label}</div>
    </div>`;
  }

  /* ---------- Dublikatlar səhifəsi ---------- */
  function renderDuplicates() {
    const groups = findDuplicates();
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 14px;font-size:19px;">👯 Dublikatlar</h2>
      ${groups.length === 0 ? '<div class="empty-state"><div class="big-icon">✨</div><h3>Dublikat yoxdur</h3><p>Kataloqun təmizdir.</p></div>' :
        groups.map((g, i) => `
          <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>Qrup ${i+1} — ${g.length} oxşar</span>
            <span class="chip" onclick="JollyBrain.openMergeChooser(${i})" style="cursor:pointer;">🔀 Birləşdir</span>
          </div>
          <div class="glass" style="padding:4px 14px;">
            ${g.map(p => `
              <div class="list-row" onclick="JollyRouter.go('#/product/${p.id}')">
                <span>${JollyProducts.escapeHtml(p.name)}<br><span class="muted mono" style="font-size:11px;">${p.mainCode||''} ${(p.barcodes||[]).join(',')}</span></span>
                <span>›</span>
              </div>
            `).join('')}
          </div>
        `).join('')
      }
    `;
  }

  /* ---------- Dublikat Merge (PIN qorumalı) ---------- */
  function checkPinForMerge() {
    const s = JollyDB.getSettings();
    if (!s.pinEnabled || !s.pin) return true;
    const entered = prompt('Birləşdirmək üçün PIN daxil et:');
    if (entered === s.pin) return true;
    Toast.error('PIN yanlışdır — əməliyyat ləğv edildi');
    return false;
  }

  function openMergeChooser(groupIndex) {
    const groups = findDuplicates();
    const g = groups[groupIndex];
    if (!g) return;
    let overlay = document.getElementById('mergeOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mergeOverlay';
      overlay.className = 'qa-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('on'); });
    }
    overlay.innerHTML = `
      <div class="glass qa-sheet">
        <div class="qa-title">🔀 Hansını əsas saxlayaq?</div>
        <p class="muted" style="font-size:11.5px;padding:0 4px 8px;">Digərlərinin məlumatı bunun üzərinə köçəcək, özləri Səbətə atılacaq.</p>
        ${g.map((p, i) => `<div class="qa-item" data-i="${i}"><span>📦</span><span>${JollyProducts.escapeHtml(p.name || 'Adsız')} ${(p.images && p.images.length) ? '🖼️' : ''} ${(p.barcodes && p.barcodes.length) ? '🏷️' : ''}</span></div>`).join('')}
      </div>
    `;
    [...overlay.querySelectorAll('.qa-item')].forEach((el, i) => {
      el.addEventListener('click', () => { overlay.classList.remove('on'); mergeGroup(g, i); });
    });
    requestAnimationFrame(() => overlay.classList.add('on'));
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }

  function mergeGroup(group, primaryIdx) {
    if (!checkPinForMerge()) return;
    const primary = group[primaryIdx];
    const others = group.filter((_, i) => i !== primaryIdx);
    const patch = {};
    const fieldsToFill = ['brand', 'group', 'location', 'status', 'mainCode', 'extraCodeValue', 'extraCodeType', 'note', 'color'];
    fieldsToFill.forEach(f => {
      if (!primary[f]) {
        const src = others.find(o => o[f]);
        if (src) patch[f] = src[f];
      }
    });
    if (primary.price == null || primary.price === '') {
      const src = others.find(o => o.price != null && o.price !== '');
      if (src) patch.price = src.price;
    }
    const allBarcodes = new Set(primary.barcodes || []);
    others.forEach(o => (o.barcodes || []).forEach(b => allBarcodes.add(b)));
    patch.barcodes = [...allBarcodes];
    const allImages = [...(primary.images || [])];
    others.forEach(o => (o.images || []).forEach(img => { if (!allImages.includes(img)) allImages.push(img); }));
    patch.images = allImages;

    JollyDB.Products.update(primary.id, patch);
    others.forEach(o => JollyDB.Trash.moveToTrash(o.id));

    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(`Birləşdirildi — ${others.length} dublikat səbətə atıldı`);
    JollyRouter.go('#/brain/duplicates');
  }

  /* ---------- Kataloq təmizləmə səhifəsi ---------- */
  function renderCleanup() {
    const inc = findIncomplete();
    const section = (icon, label, list, route) => `
      <div class="section-title">${icon} ${label} (${list.length})</div>
      <div class="glass" style="padding:4px 14px;">
        ${list.length ? list.slice(0,10).map(p => `
          <div class="list-row" onclick="JollyRouter.go('#/product/${p.id}/edit')">
            <span>${JollyProducts.escapeHtml(p.name)}</span><span style="color:var(--accent-1);">düzəlt ›</span>
          </div>
        `).join('') + (list.length>10?`<div class="muted" style="padding:10px;font-size:12px;">və daha ${list.length-10}...</div>`:'') : '<div class="muted" style="padding:12px;">Hamısı tamam 👍</div>'}
      </div>
    `;
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 14px;font-size:19px;">🧹 Kataloq təmizləmə</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 8px;">Natamam məhsulları düzəlt — hər birinə toxunub tamamla.</p>
      ${section('🖼️', 'Şəkilsiz', inc.noImage)}
      ${section('🏷️', 'Barkodsuz', inc.noBarcode)}
      ${section('💰', 'Qiymətsiz', inc.noPrice)}
      ${section('🏭', 'Firmasız', inc.noBrand)}
      ${section('📍', 'Yersiz', inc.noLocation)}
    `;
  }

  /* ---------- Ölü stok səhifəsi ---------- */
  function renderStale() {
    const stale = findStale();
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 6px;font-size:19px;">💤 Ölü stok</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">60 gündən çox toxunulmayan məhsullar. Yoxla — bəlkə qiymət yenilə, ya arxivlə.</p>
      ${stale.length === 0 ? '<div class="empty-state"><div class="big-icon">✅</div><h3>Ölü stok yoxdur</h3></div>' : `
        <div class="glass" style="padding:4px 14px;">
          ${stale.slice(0,30).map(p => {
            const days = Math.floor((Date.now() - (p.updatedAt||p.createdAt||Date.now()))/864e5);
            return `<div class="list-row" onclick="JollyRouter.go('#/product/${p.id}')">
              <span>${JollyProducts.escapeHtml(p.name)}<br><span class="muted" style="font-size:11px;">${days} gün toxunulmayıb</span></span>
              <span>›</span>
            </div>`;
          }).join('')}
        </div>`}
    `;
  }

  /* ---------- Oxşar məhsul HTML (məhsul detalı üçün) ---------- */
  function renderSimilarHtml(product) {
    const similar = findSimilar(product, 6);
    if (!similar.length) return '';
    return `
      <div class="section-title">🧠 Oxşar məhsullar</div>
      <div class="image-strip" style="gap:10px;">
        ${similar.map(p => `
          <div onclick="JollyRouter.go('#/product/${p.id}')" style="flex-shrink:0;width:100px;cursor:pointer;">
            <div style="width:100px;height:100px;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#1b1f36,#0e1120);display:flex;align-items:center;justify-content:center;font-size:26px;">
              ${p.images && p.images[0] ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:100%;height:100%;object-fit:cover;">` : '🧴'}
            </div>
            <div style="font-size:11.5px;margin-top:5px;line-height:1.2;">${JollyProducts.escapeHtml(p.name)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return {
    suggestBrand, suggestGroup, suggestLocation, suggestStatus, suggestAll,
    findDuplicates, findIncomplete, findSimilar, findStale, analyze, parseOcrText,
    renderCenter, renderDuplicates, renderCleanup, renderStale, renderSimilarHtml,
    openMergeChooser, mergeGroup,
  };
})();
