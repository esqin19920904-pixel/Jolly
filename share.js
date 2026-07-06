/* ============================================================
   JOLLY Share — Smart Share Preview
   - 3 tema: Premium Dark / Clean White / Gold Luxury
   - Kassa Mode: yalnız böyük təmiz ağ barkod kartı, heç bir effekt yox
   - Barcode Doctor: skan statusu (checksum, dublikat) göstərir
   - Magic Share: göndərmədən əvvəl qısa "yığılma" animasiyası
   - Barkod HEÇ VAXT scale edilmir — birbaşa lazımi ölçüdə yaranır
   - Kitabxanasız, tam offline, canvas 2D
   ============================================================ */

const JollyShare = (() => {
  const W = 1080;

  const THEMES = {
    dark: {
      key: 'dark', label: 'Premium Dark',
      bg: ['#0b0a1f', '#171232', '#0a0a16'],
      glow: true,
      panelBg: '#ffffff',
      text: '#ffffff', textMuted: 'rgba(255,255,255,0.55)',
      accent: '#9b7bff', headerAccent: '#6a4fd6',
      logoGrad: ['#5ad2ff', '#9b7bff'],
      chipBorder: 'rgba(155,123,255,0.7)',
    },
    white: {
      key: 'white', label: 'Clean White',
      bg: ['#eef0f6', '#f7f8fb', '#e9ebf2'],
      glow: false,
      panelBg: '#ffffff',
      text: '#181822', textMuted: 'rgba(24,24,34,0.55)',
      accent: '#5c3fd6', headerAccent: '#5c3fd6',
      logoGrad: ['#5c3fd6', '#2f8fe0'],
      chipBorder: 'rgba(92,63,214,0.4)',
    },
    gold: {
      key: 'gold', label: 'Gold Luxury',
      bg: ['#1a1206', '#2b1d08', '#120c04'],
      glow: true,
      panelBg: '#fffdf6',
      text: '#fff6df', textMuted: 'rgba(255,246,223,0.55)',
      accent: '#e5b04d', headerAccent: '#8a6a1f',
      logoGrad: ['#ffd77a', '#e5b04d'],
      chipBorder: 'rgba(229,176,77,0.6)',
    },
  };
  let currentTheme = 'dark';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function wrapTextLines(ctx, text, maxWidth, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let cur = '';
    let i = 0;
    for (; i < words.length; i++) {
      const test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = words[i];
        if (lines.length === maxLines) break;
      } else {
        cur = test;
      }
    }
    if (lines.length < maxLines && cur) { lines.push(cur); i = words.length; }
    if (i < words.length) {
      let last = lines[maxLines - 1] || '';
      while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) {
        last = last.slice(0, -1).trimEnd();
      }
      lines[maxLines - 1] = last.trimEnd() + '…';
    }
    return lines.length ? lines : [''];
  }

  /* ---------- Barkodu BİRBAŞA lazımi ölçüdə yarat (scale YOXDUR) ---------- */
  function buildNativeBarcode(barcode, targetWidth, barHeight) {
    if (!barcode || typeof JollyBarcodeGen === 'undefined') return null;
    const probe = JollyBarcodeGen.generate(barcode, null, { barWidth: 1, height: 10, pad: 10 });
    if (!probe || !probe.canvas) return null;
    const modules = probe.canvas.width - 20;
    let barWidth = Math.floor((targetWidth - 40) / modules);
    barWidth = Math.max(3, Math.min(barWidth, 16));
    return JollyBarcodeGen.generate(barcode, probe.type, { barWidth, height: barHeight, pad: 20 });
  }

  async function loadProductImage(p) {
    if (!p.images || !p.images[0]) return null;
    try {
      let src = p.images[0];
      if (typeof JollyStorage !== 'undefined' && String(src).startsWith('idb:')) {
        src = await JollyStorage.getImage(src);
      }
      if (!src) return null;
      return await loadImage(src);
    } catch (e) { return null; }
  }

  /* ---------- Barcode Doctor: skan statusu ---------- */
  function barcodeDoctorStatus(p) {
    const barcode = (p.barcodes && p.barcodes[0]) || '';
    if (!barcode) return { icon: '❌', text: 'Barkod yoxdur', ok: false };
    let dupCount = 0;
    try {
      dupCount = JollyDB.Products.all().filter(x => x.id !== p.id && (x.barcodes || []).includes(barcode)).length;
    } catch (e) {}
    if (dupCount > 0) return { icon: '❌', text: `Dublikat barkod var (${dupCount} başqa məhsulda)`, ok: false };
    if (typeof JollyBarcodeGen !== 'undefined' && JollyBarcodeGen.validate) {
      const v = JollyBarcodeGen.validate(barcode);
      if (!v.checksumOk) return { icon: '⚠️', text: `${v.expectedType.toUpperCase()} checksum səhvdir — Code128 ilə yaradılır`, ok: 'warn' };
    }
    return { icon: '✅', text: 'Skan üçün hazır', ok: true };
  }

  /* ============================================================
     Premium Share Kart (temalı)
     ============================================================ */
  async function buildCard(p, themeKey) {
    const T = THEMES[themeKey] || THEMES.dark;
    const measure = document.createElement('canvas').getContext('2d');
    const M = 60;

    const img = await loadProductImage(p);
    const barcode = (p.barcodes && p.barcodes[0]) || '';
    const barcodeGen = buildNativeBarcode(barcode, W - M * 2 - 40, 300);

    measure.font = '800 52px Arial, sans-serif';
    const nameMaxW = p.mainCode ? (W - M * 2 - 260) : (W - M * 2);
    const nameLines = wrapTextLines(measure, p.name || 'Adsız məhsul', nameMaxW, 2);

    const fields = [];
    if (p.brand) fields.push({ icon: '🏷️', label: 'Marka', value: p.brand });
    if (p.group) fields.push({ icon: '📦', label: 'Qrup', value: p.group });
    if (p.location) fields.push({ icon: '📍', label: 'Yer / Rəf', value: p.location });
    if (p.extraCodeValue) fields.push({ icon: '🔖', label: p.extraCodeType || 'Model', value: p.extraCodeValue });
    if (p.status) fields.push({ icon: '🔘', label: 'Status', value: p.status });
    if (p.color) fields.push({ icon: '🎨', label: 'Rəng', value: p.color });

    measure.font = '500 25px Arial, sans-serif';
    const noteLines = p.note ? wrapTextLines(measure, p.note, W - M * 2, 3) : [];

    const doctor = barcodeDoctorStatus(p);

    /* ---------- Hündürlüyü hesabla ---------- */
    let y = 0;
    y += 170;
    const imgPanelY = y;
    const imgPanelH = 560;
    y += imgPanelH;
    y += 66;
    const nameY = y;
    y += nameLines.length * 60 + 28;
    const fieldsY = y;
    const fieldRowH = 86;
    if (fields.length) { y += fields.length * fieldRowH + 18; }
    const noteY = y;
    if (noteLines.length) { y += 34 + noteLines.length * 34 + 28; }
    const bpY = y;
    const bpPad = 44;
    const bpH = (barcodeGen ? barcodeGen.canvas.height : 200) + bpPad * 2 + 58;
    y += bpH;
    y += 34;
    const doctorY = y;
    y += 40;
    const numberY = y;
    if (barcode) y += 90;
    y += 60;
    const footerY = y;
    const H = footerY + 30;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, T.bg[0]); bg.addColorStop(0.5, T.bg[1]); bg.addColorStop(1, T.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (T.glow) {
      function glow(cx, cy, r, color) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      glow(90, 80, 380, T.key === 'gold' ? 'rgba(229,176,77,0.20)' : 'rgba(124,92,252,0.24)');
      glow(W - 90, 260, 340, T.key === 'gold' ? 'rgba(255,215,122,0.12)' : 'rgba(0,190,255,0.14)');
    }

    ctx.textAlign = 'center';
    ctx.font = '800 70px Arial, sans-serif';
    const logoGrad = ctx.createLinearGradient(W / 2 - 170, 0, W / 2 + 170, 0);
    logoGrad.addColorStop(0, T.logoGrad[0]); logoGrad.addColorStop(1, T.logoGrad[1]);
    ctx.fillStyle = logoGrad;
    ctx.fillText('JOLLY', W / 2, 104);
    ctx.font = '600 23px Arial, sans-serif';
    ctx.fillStyle = T.textMuted;
    ctx.fillText('K A S S A   Ü Ç Ü N   M Ə H S U L', W / 2, 142);

    ctx.fillStyle = T.panelBg;
    roundRect(ctx, M, imgPanelY, W - M * 2, imgPanelH, 26);
    ctx.fill();
    if (img) {
      const pad = 24;
      const availW = (W - M * 2) - pad * 2, availH = imgPanelH - pad * 2;
      const scale = Math.min(availW / img.width, availH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, M + ((W - M * 2) - dw) / 2, imgPanelY + (imgPanelH - dh) / 2, dw, dh);
    } else {
      ctx.font = '90px Arial, sans-serif';
      ctx.fillStyle = '#c7c7d6';
      ctx.fillText('🧴', W / 2, imgPanelY + imgPanelH / 2 + 30);
    }

    ctx.textAlign = 'left';
    ctx.font = '800 52px Arial, sans-serif';
    ctx.fillStyle = T.text;
    nameLines.forEach((line, i) => ctx.fillText(line, M, nameY + i * 60));
    if (p.mainCode) {
      ctx.font = '700 21px Arial, sans-serif';
      const label = 'MƏHSUL KODU';
      const val = String(p.mainCode);
      const chipW = Math.max(ctx.measureText(label).width, ctx.measureText(val).width) + 42;
      const chipX = W - M - chipW, chipY = imgPanelY + imgPanelH + 26, chipH = 70;
      ctx.strokeStyle = T.chipBorder;
      ctx.lineWidth = 2;
      roundRect(ctx, chipX, chipY, chipW, chipH, 15);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '600 14px Arial, sans-serif';
      ctx.fillStyle = T.accent;
      ctx.fillText(label, chipX + chipW / 2, chipY + 26);
      ctx.font = '700 22px Arial, sans-serif';
      ctx.fillStyle = T.text;
      ctx.fillText(val, chipX + chipW / 2, chipY + 52);
    }

    fields.forEach((f, i) => {
      const ry = fieldsY + i * fieldRowH;
      ctx.textAlign = 'left';
      ctx.font = '29px Arial, sans-serif';
      ctx.fillStyle = T.accent;
      ctx.fillText(f.icon, M, ry + 30);
      ctx.font = '600 17px Arial, sans-serif';
      ctx.fillStyle = T.textMuted;
      ctx.fillText(f.label.toUpperCase(), M + 52, ry + 14);
      ctx.font = '700 27px Arial, sans-serif';
      ctx.fillStyle = T.text;
      ctx.fillText(String(f.value), M + 52, ry + 43);
      if (i < fields.length - 1) {
        ctx.strokeStyle = T.key === 'white' ? 'rgba(20,20,30,0.1)' : 'rgba(255,255,255,0.10)';
        ctx.beginPath();
        ctx.moveTo(M, ry + fieldRowH - 12);
        ctx.lineTo(W - M, ry + fieldRowH - 12);
        ctx.stroke();
      }
    });

    if (noteLines.length) {
      ctx.textAlign = 'left';
      ctx.font = '600 19px Arial, sans-serif';
      ctx.fillStyle = T.accent;
      ctx.fillText('📝  QEYD', M, noteY + 16);
      ctx.font = '500 25px Arial, sans-serif';
      ctx.fillStyle = T.textMuted;
      noteLines.forEach((line, i) => ctx.fillText(line, M, noteY + 52 + i * 34));
    }

    // Barkod paneli — HƏMİŞƏ ağ fon, kontrast maksimal (skan üçün)
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, M, bpY, W - M * 2, bpH, 26);
    ctx.fill();
    ctx.fillStyle = T.headerAccent;
    ctx.font = '700 25px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KASSA ÜÇÜN BARKOD', W / 2, bpY + 44);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(M + 50, bpY + 58); ctx.lineTo(W / 2 - 180, bpY + 58); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 180, bpY + 58); ctx.lineTo(W - M - 50, bpY + 58); ctx.stroke();

    if (barcodeGen && barcodeGen.canvas) {
      ctx.drawImage(barcodeGen.canvas, W / 2 - barcodeGen.canvas.width / 2, bpY + 78);
    } else {
      ctx.font = '26px Arial, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('Barkod yoxdur', W / 2, bpY + bpH / 2);
    }

    // Barcode Doctor status
    ctx.textAlign = 'center';
    ctx.font = '600 21px Arial, sans-serif';
    ctx.fillStyle = doctor.ok === true ? '#1fae7a' : doctor.ok === 'warn' ? '#c78a1f' : '#d84545';
    ctx.fillText(`${doctor.icon}  ${doctor.text}`, W / 2, doctorY);

    if (barcode) {
      ctx.textAlign = 'left';
      ctx.font = '600 19px Arial, sans-serif';
      ctx.fillStyle = T.accent;
      ctx.fillText('⌗  BARKOD NÖMRƏSİ', M, numberY);
      ctx.font = '800 40px Courier New, monospace';
      ctx.fillStyle = T.text;
      ctx.fillText(barcode, M, numberY + 46);
      if (p.last4) {
        const pillText = String(p.last4);
        ctx.font = '700 25px Arial, sans-serif';
        const tw = ctx.measureText(pillText).width;
        const pillW = tw + 44, pillH = 44, pillX = W - M - pillW, pillY = numberY - 4;
        ctx.textAlign = 'right';
        ctx.font = '600 17px Arial, sans-serif';
        ctx.fillStyle = T.textMuted;
        ctx.fillText('SON 4 RƏQƏM', W - M, numberY - 12);
        ctx.fillStyle = T.headerAccent;
        roundRect(ctx, pillX, pillY + 14, pillW, pillH, 22);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = '700 25px Arial, sans-serif';
        ctx.fillText(pillText, pillX + pillW / 2, pillY + 14 + 30);
      }
    }

    ctx.strokeStyle = T.key === 'white' ? 'rgba(20,20,30,0.12)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(M, footerY - 6); ctx.lineTo(W - M, footerY - 6); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '500 18px Arial, sans-serif';
    ctx.fillStyle = T.textMuted;
    ctx.fillText('🛡️  JOLLY KASSA SİSTEMİ', M, footerY + 22);
    const now = new Date();
    ctx.textAlign = 'right';
    ctx.fillText(`📅  ${now.toLocaleDateString('az-AZ')}  |  Saat: ${now.toTimeString().slice(0, 5)}`, W - M, footerY + 22);

    return canvas;
  }

  /* ============================================================
     Kassa Mode — sadə, effektsiz, maksimal kontrastlı ağ kart
     Yalnız: ad, firma, qrup, böyük barkod, nömrə, son 4. Qiymət YOX.
     ============================================================ */
  async function buildCashierCard(p) {
    const measure = document.createElement('canvas').getContext('2d');
    const M = 56, W2 = 1000;
    const barcode = (p.barcodes && p.barcodes[0]) || '';
    const barcodeGen = buildNativeBarcode(barcode, W2 - M * 2, 340);

    measure.font = '800 46px Arial, sans-serif';
    const nameLines = wrapTextLines(measure, p.name || 'Adsız məhsul', W2 - M * 2, 2);

    let y = 50;
    const nameY = y; y += nameLines.length * 54 + 10;
    const metaY = y; if (p.brand || p.group) y += 40;
    y += 20;
    const bpY = y;
    const bpH = (barcodeGen ? barcodeGen.canvas.height : 200) + 40;
    y += bpH + 30;
    const numberY = y; y += 60;
    const H = y + 30;

    const canvas = document.createElement('canvas');
    canvas.width = W2; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W2, H);

    ctx.textAlign = 'left';
    ctx.font = '800 46px Arial, sans-serif';
    ctx.fillStyle = '#000000';
    nameLines.forEach((line, i) => ctx.fillText(line, M, nameY + i * 54));

    if (p.brand || p.group) {
      ctx.font = '500 26px Arial, sans-serif';
      ctx.fillStyle = '#555555';
      const metaText = [p.brand, p.group].filter(Boolean).join('   ·   ');
      ctx.fillText(metaText, M, metaY + 30);
    }

    if (barcodeGen && barcodeGen.canvas) {
      ctx.drawImage(barcodeGen.canvas, W2 / 2 - barcodeGen.canvas.width / 2, bpY);
    } else {
      ctx.textAlign = 'center';
      ctx.font = '28px Arial, sans-serif';
      ctx.fillStyle = '#999';
      ctx.fillText('Barkod yoxdur', W2 / 2, bpY + 60);
    }

    if (barcode) {
      ctx.textAlign = 'left';
      ctx.font = '800 34px Courier New, monospace';
      ctx.fillStyle = '#000000';
      ctx.fillText(barcode, M, numberY);
      if (p.last4) {
        ctx.textAlign = 'right';
        ctx.font = '600 24px Arial, sans-serif';
        ctx.fillStyle = '#666666';
        ctx.fillText('Son 4: ' + p.last4, W2 - M, numberY);
      }
    }

    return canvas;
  }

  /* ---------- Fayl/paylaşım köməkçiləri ---------- */
  function canvasToFile(canvas, name) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], name, { type: 'image/png' }) : null);
      }, 'image/png', 0.95);
    });
  }

  function shareText(p) {
    const fullName = [p.name, p.mainCode, p.extraCodeValue].filter(Boolean).join(' ');
    const barcode = (p.barcodes && p.barcodes[0]) || '';
    return `JOLLY\n\nMəhsul: ${fullName}${barcode ? `\nBarkod: ${barcode}` : ''}`;
  }

  async function shareCanvasFile(canvas, p) {
    const file = await canvasToFile(canvas, `jolly-${p.id}.png`);
    if (!file) { Toast.error('Kart yaradıla bilmədi'); return; }
    const text = shareText(p);
    try { JollyDB.Products.update(p.id, { whatsappCount: (p.whatsappCount || 0) + 1 }); } catch (e) {}

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        if (typeof JollySound !== 'undefined') JollySound.success();
        Toast.success('Göndərildi');
        return;
      } catch (e) { /* fallback-a keç */ }
    }
    saveCanvasFile(canvas, p);
    Toast.info('Şəkil endirildi — WhatsApp açılır, şəkli əl ilə əlavə et');
    setTimeout(() => window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'), 500);
  }

  function saveCanvasFile(canvas, p) {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `jolly-${p.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('Şəkil yadda saxlanıldı');
    }, 'image/png', 0.95);
  }

  /* ============================================================
     Share Preview Bottom Sheet — "Magic Share"
     ============================================================ */
  let previewCanvas = null;

  function ensureOverlay() {
    let overlay = document.getElementById('sharePreviewOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sharePreviewOverlay';
      overlay.className = 'qa-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('on'); });
    }
    return overlay;
  }

  async function showSharePreview(productId) {
    const p = JollyDB.Products.get(productId);
    if (!p) { Toast.error('Məhsul tapılmadı'); return; }
    const overlay = ensureOverlay();

    // "Magic Share" — qısa yığılma animasiyası
    overlay.innerHTML = `
      <div class="glass qa-sheet" style="text-align:center;padding:36px 20px;">
        <div style="font-size:40px;margin-bottom:10px;animation:aiDot 1s ease-in-out infinite;">✨</div>
        <div class="qa-title" style="margin:0;">Kart hazırlanır...</div>
      </div>
    `;
    requestAnimationFrame(() => overlay.classList.add('on'));

    const [canvas] = await Promise.all([
      buildCard(p, currentTheme),
      new Promise(r => setTimeout(r, 550)), // "yığılma" hissi üçün minimum gecikmə
    ]);
    previewCanvas = canvas;
    renderPreviewSheet(p);
  }

  function renderPreviewSheet(p) {
    const overlay = ensureOverlay();
    const doctor = barcodeDoctorStatus(p);
    const doctorColor = doctor.ok === true ? '#29e0c9' : doctor.ok === 'warn' ? '#ffb84d' : '#ff5c6c';

    overlay.innerHTML = `
      <div class="glass qa-sheet" style="max-height:88vh;overflow-y:auto;">
        <div class="qa-title">📤 JOLLY Share Preview</div>

        <div style="text-align:center;margin:6px 0 12px;">
          <img src="${previewCanvas.toDataURL('image/png')}" style="width:100%;max-width:260px;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,0.4);">
        </div>

        <div style="text-align:center;font-size:12.5px;color:${doctorColor};margin-bottom:14px;">${doctor.icon} ${doctor.text}</div>

        <div class="chip-row" style="justify-content:center;margin-bottom:14px;" id="shareThemeChips">
          ${Object.values(THEMES).map(t => `<span class="chip ${t.key === currentTheme ? 'selected' : ''}" data-theme="${t.key}">${t.label}</span>`).join('')}
        </div>

        <button class="btn btn-primary btn-block" id="shareSendBtn" style="margin-bottom:8px;">📲 WhatsApp-a göndər</button>
        <button class="btn btn-ghost btn-block" id="shareSaveBtn" style="margin-bottom:8px;">💾 Şəkli yadda saxla</button>
        <button class="btn btn-ghost btn-block" id="shareCashierBtn">🧾 Kassa Mode (sadə, effektsiz)</button>
      </div>
    `;

    overlay.querySelectorAll('#shareThemeChips .chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const theme = chip.getAttribute('data-theme');
        if (theme === currentTheme) return;
        currentTheme = theme;
        overlay.querySelectorAll('#shareThemeChips .chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        if (typeof JollySound !== 'undefined') JollySound.tap();
        previewCanvas = await buildCard(p, currentTheme);
        const imgEl = overlay.querySelector('img');
        if (imgEl) imgEl.src = previewCanvas.toDataURL('image/png');
      });
    });

    overlay.querySelector('#shareSendBtn').addEventListener('click', () => shareCanvasFile(previewCanvas, p));
    overlay.querySelector('#shareSaveBtn').addEventListener('click', () => saveCanvasFile(previewCanvas, p));
    overlay.querySelector('#shareCashierBtn').addEventListener('click', async () => {
      overlay.classList.remove('on');
      Toast.info('Kassa kartı hazırlanır...');
      const cashierCanvas = await buildCashierCard(p);
      shareCanvasFile(cashierCanvas, p);
    });

    requestAnimationFrame(() => overlay.classList.add('on'));
  }

  /* ---------- Köhnə çağırışlarla uyğunluq üçün ---------- */
  async function shareCurrentProduct(productId) {
    return showSharePreview(productId);
  }

  return { showSharePreview, shareCurrentProduct, buildCard, buildCashierCard, barcodeDoctorStatus };
})();
