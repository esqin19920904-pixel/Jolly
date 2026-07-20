/* ============================================================
   JOLLY Barcode Generator — real, skaner-oxunan barkodlar
   EAN-13, EAN-8, Code128, QR — canvas-da PNG şəkil kimi
   Kassir telefondakı şəkildən birbaşa skan edə bilir
   ============================================================ */

const JollyBarcodeGen = (() => {

  /* ============ EAN-13 ============ */
  const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  const EAN_FIRST = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

  function ean13Checksum(digits12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(digits12[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10;
  }

  function ean13Bits(code) {
    let d = code.replace(/\D/g, '');
    if (d.length === 12) {
      d += ean13Checksum(d);
    } else if (d.length === 13) {
      const correctChk = ean13Checksum(d.slice(0, 12));
      if (String(correctChk) !== d[12]) return null;
    }
    if (d.length !== 13) return null;
    const first = parseInt(d[0], 10);
    const pattern = EAN_FIRST[first];
    let bits = '101';
    for (let i = 1; i <= 6; i++) {
      const digit = parseInt(d[i], 10);
      bits += (pattern[i - 1] === 'L') ? EAN_L[digit] : EAN_G[digit];
    }
    bits += '01010';
    for (let i = 7; i <= 12; i++) {
      bits += EAN_R[parseInt(d[i], 10)];
    }
    bits += '101';
    return { bits, full: d };
  }

  /* ============ EAN-8 ============ */
  function ean8Checksum(d7) {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += parseInt(d7[i], 10) * (i % 2 === 0 ? 3 : 1);
    return (10 - (sum % 10)) % 10;
  }
  function ean8Bits(code) {
    let d = code.replace(/\D/g, '');
    if (d.length === 7) {
      d += ean8Checksum(d);
    } else if (d.length === 8) {
      const correctChk = ean8Checksum(d.slice(0, 7));
      if (String(correctChk) !== d[7]) return null;
    }
    if (d.length !== 8) return null;
    let bits = '101';
    for (let i = 0; i < 4; i++) bits += EAN_L[parseInt(d[i], 10)];
    bits += '01010';
    for (let i = 4; i < 8; i++) bits += EAN_R[parseInt(d[i], 10)];
    bits += '101';
    return { bits, full: d };
  }

  /* ============ Code128 (B) ============ */
  const C128B = [' ','!','"','#','$','%','&',"'",'(',')','*','+',',','-','.','/','0','1','2','3','4','5','6','7','8','9',':',';','<','=','>','?','@','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','[','\\',']','^','_','`','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','{','|','}','~'];
  const C128_PATTERNS = ['11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000','11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100','11001001110','11011100100','11001110100','11101101110','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010','11011011000','11011000110','11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000','11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110','11101110110','11010001110','11000101110','11011101000','11011100010','11011101110','11101011000','11101000110','11100010110','11101101000','11101100010','11100011010','11101111010','11001000010','11110001010','10100110000','10100001100','10010110000','10010000110','10000101100','10000100110','10110010000','10110000100','10011010000','10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010','10100111100','10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100','11110010010','11011011110','11011110110','11110110110','10101111000','10100011110','10001011110','10111101000','10111100010','11110101000','11110100010','10111011110','10111101110','11101011110','11110101110','11010000100','11010010000','11010011100','1100011101011'];
  function code128Bits(text) {
    const codes = [104];
    let sum = 104;
    for (let i = 0; i < text.length; i++) {
      const idx = C128B.indexOf(text[i]);
      const val = idx >= 0 ? idx : 0;
      codes.push(val);
      sum += val * (i + 1);
    }
    codes.push(sum % 103);
    codes.push(106);
    let bits = '';
    codes.forEach(c => { bits += C128_PATTERNS[c]; });
    return { bits, full: text };
  }

  /* ============ Bit sətrini canvas-a çək ============ */
  function bitsToCanvas(bits, humanText, opts = {}) {
    const barWidth = opts.barWidth || 3;
    const height = opts.height || 220;
    const pad = opts.pad || 30;
    const textH = 46;
    const W = bits.length * barWidth + pad * 2;
    const H = height + textH + pad;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    let x = pad;
    for (const bit of bits) {
      if (bit === '1') ctx.fillRect(x, pad, barWidth, height);
      x += barWidth;
    }
    if (humanText) {
      ctx.fillStyle = '#000';
      ctx.font = `bold 38px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(humanText, W / 2, height + pad + 38);
    }
    return canvas;
  }

  /* ============ Avtomatik tip seçimi ============ */
  function detectType(code) {
    const d = code.replace(/\D/g, '');
    if (/^\d{12,13}$/.test(d)) return 'ean13';
    if (/^\d{7,8}$/.test(d)) return 'ean8';
    return 'code128';
  }

  function generate(code, type, opts) {
    type = type || detectType(code);
    let res = null;
    if (type === 'ean13') res = ean13Bits(code);
    else if (type === 'ean8') res = ean8Bits(code);
    if (!res) {
      type = 'code128';
      res = code128Bits(code);
    }
    if (!res) return null;
    const defaultBarWidth = type === 'code128' ? 2 : 3;
    const canvas = bitsToCanvas(res.bits, res.full, Object.assign({ barWidth: defaultBarWidth }, opts || {}));
    return { canvas, type, full: res.full };
  }

  function toDataURL(code, type, opts) {
    const g = generate(code, type, opts);
    return g ? g.canvas.toDataURL('image/png') : null;
  }

  // Yüklə (PNG) — istifadəçi əməliyyatı, "Barkod yarat" icazəsi ilə örtülür
  function download(code, type) {
    if (window.JollyAuth && !JollyAuth.can('barcode.generate')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Barkod yaratmaq icazən yoxdur');
      return;
    }
    const g = generate(code, type);
    if (!g) { Toast.error('Barkod yaradılmadı'); return; }
    const a = document.createElement('a');
    a.href = g.canvas.toDataURL('image/png');
    a.download = `barcode-${g.full}.png`;
    a.click();
    Toast.success('Barkod yükləndi');
  }

  // Çap — istifadəçi əməliyyatı, "Barkod çap et" icazəsi ilə örtülür
  function print(code, type) {
    if (window.JollyAuth && !JollyAuth.can('barcode.print')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Barkod çap etmək icazən yoxdur');
      return;
    }
    const url = toDataURL(code, type);
    if (!url) return;
    const w = window.open('');
    if (w) {
      w.document.write(`<img src="${url}" style="width:100%;max-width:500px;" onload="window.print()">`);
    }
  }

  function validate(code) {
    const d = String(code || '').replace(/\D/g, '');
    if (d.length === 13) {
      const ok = String(ean13Checksum(d.slice(0, 12))) === d[12];
      return { length: 13, expectedType: 'ean13', checksumOk: ok, correctChecksum: ean13Checksum(d.slice(0, 12)) };
    }
    if (d.length === 8) {
      const ok = String(ean8Checksum(d.slice(0, 7))) === d[7];
      return { length: 8, expectedType: 'ean8', checksumOk: ok, correctChecksum: ean8Checksum(d.slice(0, 7)) };
    }
    return { length: d.length, expectedType: 'code128', checksumOk: true };
  }

  return { generate, toDataURL, download, print, detectType, ean13Checksum, ean8Checksum, validate };
})();
