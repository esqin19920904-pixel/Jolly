/* ============================================================
   JOLLY Product DNA — Məhsul Sağlamlıq Pasportu
   Hər məhsul üçün: tamlıq faizi, hansı sahələr var/yox,
   kassaya hazırdırmı, barkod statusu, tövsiyələr.
   ============================================================ */
const JollyProductDNA = (() => {
  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function open(productId) {
    const p = JollyDB.Products.get(productId);
    if (!p) { Toast.error('Məhsul tapılmadı'); return; }
    const dna = (typeof JollyAIHealth !== 'undefined') ? JollyAIHealth.productDNA(p) : null;
    if (!dna) { Toast.error('DNA modulu yüklənməyib'); return; }

    const ready = (typeof JollyAIHealth !== 'undefined') ? JollyAIHealth.isCashierReady(p) : false;
    const scoreColor = dna.score >= 80 ? '#4ade80' : dna.score >= 50 ? '#f5c563' : '#ff6b7d';
    const bc = (p.barcodes || [])[0];
    let bcStatus = 'Barkod yoxdur';
    let bcColor = '#8a8f9c';
    if (bc) {
      if (typeof JollyBarcodeGen !== 'undefined' && JollyBarcodeGen.validate) {
        const v = JollyBarcodeGen.validate(bc);
        if (v.checksumOk) { bcStatus = 'Skan üçün hazır ✓'; bcColor = '#4ade80'; }
        else { bcStatus = 'EAN səhv — Code128 ilə işləyir'; bcColor = '#f5c563'; }
      } else { bcStatus = 'Barkod var'; bcColor = '#4ade80'; }
    }

    const overlay = document.createElement('div');
    overlay.className = 'dna-overlay';
    overlay.innerHTML = `
      <div class="dna-sheet">
        <div class="dna-handle"></div>
        <button class="dna-close" onclick="JollyProductDNA.close()">✕</button>
        <div class="dna-title">🧬 Məhsul Pasportu</div>
        <div class="dna-name">${esc(p.name || 'Adsız məhsul')}</div>

        <div class="dna-ring-wrap">
          <div class="health-ring dna-ring" style="--pct:${dna.score};--ring-color:${scoreColor};">
            <svg viewBox="0 0 120 120">
              <circle class="hr-bg" cx="60" cy="60" r="52"></circle>
              <circle class="hr-fill" cx="60" cy="60" r="52" style="stroke:${scoreColor};"></circle>
            </svg>
            <div class="hr-center">
              <div class="hr-num" style="color:${scoreColor};font-size:30px;">${dna.score}<span style="font-size:14px;">%</span></div>
              <div class="hr-label">tamlıq</div>
            </div>
          </div>
          <div class="dna-ready ${ready ? 'ok' : 'no'}">${ready ? '✓ Kassaya hazır' : '○ Kassaya hazır deyil'}</div>
        </div>

        <div class="dna-checks">
          ${dna.checks.map(c => `
            <div class="dna-check ${c.ok ? 'ok' : 'no'}">
              <span class="dc-tick">${c.ok ? '✓' : '○'}</span>
              <span class="dc-label">${c.label}</span>
            </div>
          `).join('')}
        </div>

        <div class="dna-barcode">
          <span class="dna-bc-dot" style="background:${bcColor};"></span>
          <span>Barkod: ${bcStatus}</span>
          ${p.last4 ? `<span class="dna-last4">Son 4: ${esc(p.last4)}</span>` : ''}
        </div>

        ${dna.missing.length ? `<div class="dna-advice">💡 Əlavə et: ${dna.missing.map(esc).join(', ')}</div>` : '<div class="dna-advice ok">✨ Bu məhsul tamdır!</div>'}

        <div class="dna-actions">
          <button class="btn btn-primary" style="flex:1;" onclick="JollyProductDNA.close();JollyRouter.go('#/product/${p.id}/edit')">✏️ Düzəlt</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyProductDNA.close();JollyProducts.whatsappShare('${p.id}')">📲 Paylaş</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }

  function close() {
    const ov = document.querySelector('.dna-overlay');
    if (ov) { ov.classList.remove('open'); setTimeout(() => ov.remove(), 250); }
  }

  return { open, close };
})();
