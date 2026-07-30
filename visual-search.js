/* ============================================================
   JOLLY Visual Search  v3.0.0   (2026-07-30)
   ------------------------------------------------------------
   ŞƏKİLLƏ AXTARIŞ MOTORU — peşəkar versiya

   1  Çoxşəkilli müqayisə — malın BÜTÜN şəkilləri yoxlanılır,
      ən yüksək bal saxlanılır
   2  Həmişə ən yaxın 5 nəticə — boş ekran YOXDUR
   3  Ağıllı bal: ön şəkil +10, marka +10, rəng +5, forma +5
   4  Çevirmə: 0° / 90° / 180° / 270°
   5  Kəsmə: tam / orta / sol / sağ / üst / alt
   6  WhatsApp rejimi — sıxılmış şəkil üçün ayrı müqayisə
   7  OCR — şəkildəki yazılar (marka, həcm, kod) da axtarılır
   8  Barkod — şəkildə barkod varsa ƏVVƏL onunla axtarır
   9  Marka tanıma — OCR mətnindən marka çıxarılır və o markanın
      malları yuxarı qalxır (əsl loqo modeli oflayn mümkün deyil)
   10 Rəng analizi — əsas rənglər çıxarılır, uyğun rəng önə keçir
   11 Dublikat filtri — bir mal yalnız bir dəfə
   12 Sürətli keş — barmaq izləri IndexedDB-də, warmup() ilə
      əvvəlcədən hesablanır
   13 Diaqnostika — mal / şəkil / oxundu / xəta / vaxt
   14 Nəticə: medal sırası (UI tərəfdə)
   15 Öyrənmə — "bu düzgün maldır" seçimi yadda saxlanılır və
      növbəti dəfə həmin mal öndə gəlir

   ÖLÇÜLƏR (hər şəkil üçün):
     aHash 8×8   — işıq-kölgə forması
     dHash 9×8   — qonşu fərqlər (işıqdan asılı deyil)
     rəng 4×4    — normalizə olunmuş RGB
     ar          — en/uzunluq nisbəti (qablaşdırma forması)
     dom         — 3 əsas rəng

   SORĞU VARİANTLARI: 4 bucaq × 6 kəsim + WhatsApp rejimi = 25
   Variantlar yalnız BİR dəfə (sorğu şəkli üçün) hesablanır,
   kataloq tərəfində müqayisə ucuz bit əməliyyatıdır.

   API:
     findBest(dataUrl, {limit, onProgress})
        → {results, stats, barcode, text, brand}
     findSimilar(dataUrl, maxDistance)     — v1/v2 uyğunluğu
     captureAndSearch(cb) / pickAndSearch(cb)
     warmup({onProgress})                  — barmaq izlərini hazırla
     confirm(productId)                     — öyrənmə (15)
     detectBarcode(dataUrl) / ocr(dataUrl)
     clearCache() / clearLearning() / lastStats() / selfTest()
   ============================================================ */

const JollyVisualSearch = (() => {
  const V = '3.0.0';
  const GRID = 8;          // 8×8 = 64 bit
  const WORK = 32;         // işçi kətan
  const MAX_IMG = 6;       // bir maldan ən çox 6 şəkil (1: hamısı, praktik hədd)
  const YIELD_EVERY = 15;
  const CACHE_DB = 'jolly_vs', FP = 'fp3', LEARN = 'learn';

  const W_A = 0.34, W_D = 0.36, W_C = 0.30;
  const B_FRONT = 10, B_BRAND = 10, B_COLOR = 5, B_SHAPE = 5, B_LEARN = 25;

  // 5 — kəsimlər  [x, y, w, h] nisbətlə
  const CROPS = [
    ['tam',  [0.00, 0.00, 1.00, 1.00]],
    ['orta', [0.15, 0.15, 0.70, 0.70]],
    ['sol',  [0.00, 0.00, 0.55, 1.00]],
    ['sağ',  [0.45, 0.00, 0.55, 1.00]],
    ['üst',  [0.00, 0.00, 1.00, 0.55]],
    ['alt',  [0.00, 0.45, 1.00, 0.55]]
  ];
  const ROTS = [0, 90, 180, 270];          // 4

  let _stats = null, _cache = null, _dirty = [], _learn = null, _lastQ = null;

  /* ================= köməkçilər ================= */

  function _denied() {
    if (window.Toast) Toast.error('❌ Şəkillə axtarış üçün icazəniz yoxdur');
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h.toString(36) + '-' + str.length + '-v3';
  }

  function products() {
    try {
      const P = (typeof JollyDB !== 'undefined' && JollyDB.Products) ? JollyDB.Products : null;
      if (P) {
        if (typeof P.all === 'function') return P.all() || [];
        if (typeof P.getAll === 'function') return P.getAll() || [];
        if (typeof P.list === 'function') return P.list() || [];
      }
    } catch (e) {}
    try { return JSON.parse(localStorage.getItem('jolly_products') || '[]') || []; }
    catch (e) { return []; }
  }

  function imagesOf(p) {
    const out = [];
    const push = v => { if (typeof v === 'string' && v && out.indexOf(v) < 0) out.push(v); };
    if (Array.isArray(p.images)) p.images.forEach(push);
    ['image', 'img', 'photo', 'thumb', 'thumbnail'].forEach(k => push(p[k]));
    return out.slice(0, MAX_IMG);
  }

  function fold(s) {
    s = String(s || '').toLowerCase();
    try {
      if (typeof JollyDB !== 'undefined' && JollyDB.foldText) return JollyDB.foldText(s);
    } catch (e) {}
    return s.replace(/ə/g, 'e').replace(/ç/g, 'c').replace(/ş/g, 's')
            .replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o')
            .replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* ================= 10 · rəng + deskriptor ================= */

  function blockAvg(gray, size, cols, rows) {
    const out = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const y0 = Math.floor(r * size / rows);
      const y1 = Math.max(y0 + 1, Math.floor((r + 1) * size / rows));
      for (let c = 0; c < cols; c++) {
        const x0 = Math.floor(c * size / cols);
        const x1 = Math.max(x0 + 1, Math.floor((c + 1) * size / cols));
        let s = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += gray[y * size + x]; n++; }
        out[r * cols + c] = n ? s / n : 0;
      }
    }
    return out;
  }

  function bitsAbove(arr) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    const avg = sum / arr.length;
    let s = '';
    for (let i = 0; i < arr.length; i++) s += (arr[i] > avg ? '1' : '0');
    return s;
  }

  function bitsGradient(arr, cols, rows) {
    let s = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) s += (arr[r * cols + c] > arr[r * cols + c + 1] ? '1' : '0');
    }
    return s;
  }

  function rgbToHue(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 12) return -1;                       // boz/ağ/qara — rəngsiz
    let h;
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return Math.round(h);
  }

  // 3 əsas rəng (12 sektorlu hue histoqramı)
  function dominant(data) {
    const bins = new Float32Array(12), sat = new Float32Array(12);
    let gray = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const h = rgbToHue(data[i], data[i + 1], data[i + 2]);
      n++;
      if (h < 0) { gray++; continue; }
      const b = Math.floor(h / 30) % 12;
      bins[b]++; sat[b] += Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    }
    const order = [];
    for (let i = 0; i < 12; i++) order.push([i, bins[i]]);
    order.sort((a, b) => b[1] - a[1]);
    return {
      top: order.slice(0, 3).filter(o => o[1] > n * 0.04).map(o => o[0]),
      grayRatio: Math.round(gray / (n || 1) * 100),
      hist: Array.from(bins).map(v => Math.round(v / (n || 1) * 100))
    };
  }

  const _tmp = document.createElement('canvas');
  const _small = document.createElement('canvas');

  // 4 + 5 + 6 — bucaq, kəsim, WhatsApp yumşaltması
  function pixels(img, rect, rot, soft) {
    _tmp.width = WORK; _tmp.height = WORK;
    const ctx = _tmp.getContext('2d', { willReadFrequently: true });
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, WORK, WORK);

    const w = img.naturalWidth || img.width || WORK;
    const h = img.naturalHeight || img.height || WORK;
    const sx = Math.floor(w * rect[0]), sy = Math.floor(h * rect[1]);
    const sw = Math.max(1, Math.floor(w * rect[2])), sh = Math.max(1, Math.floor(h * rect[3]));

    let src = img, ssx = sx, ssy = sy, ssw = sw, ssh = sh;
    if (soft) {                       // 6 — sıxılma imitasiyası: 12px-ə düşür, geri qalxır
      _small.width = 12; _small.height = 12;
      const sc = _small.getContext('2d', { willReadFrequently: true });
      sc.drawImage(img, sx, sy, sw, sh, 0, 0, 12, 12);
      src = _small; ssx = 0; ssy = 0; ssw = 12; ssh = 12;
    }

    ctx.translate(WORK / 2, WORK / 2);
    if (rot) ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(src, ssx, ssy, ssw, ssh, -WORK / 2, -WORK / 2, WORK, WORK);
    ctx.restore();
    return ctx.getImageData(0, 0, WORK, WORK).data;
  }

  function fromPixels(data, ar) {
    const gray = new Float32Array(WORK * WORK);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    const a8 = blockAvg(gray, WORK, GRID, GRID);
    const d9 = blockAvg(gray, WORK, GRID + 1, GRID);

    const col = new Float32Array(48), cnt = new Float32Array(16);
    for (let y = 0; y < WORK; y++) {
      const gy = Math.floor(y * 4 / WORK);
      for (let x = 0; x < WORK; x++) {
        const gx = Math.floor(x * 4 / WORK), cell = gy * 4 + gx, i = (y * WORK + x) * 4;
        col[cell * 3] += data[i]; col[cell * 3 + 1] += data[i + 1]; col[cell * 3 + 2] += data[i + 2];
        cnt[cell]++;
      }
    }
    let mean = 0;
    for (let c = 0; c < 16; c++) {
      const n = cnt[c] || 1;
      col[c * 3] /= n; col[c * 3 + 1] /= n; col[c * 3 + 2] /= n;
      mean += (col[c * 3] + col[c * 3 + 1] + col[c * 3 + 2]) / 3;
    }
    mean = (mean / 16) || 1;
    const colN = [];
    for (let i = 0; i < 48; i++) colN.push(Math.round((col[i] / mean) * 100));

    return {
      a: bitsAbove(a8),
      d: bitsGradient(d9, GRID + 1, GRID),
      c: colN,
      dom: dominant(data),
      ar: ar || 1
    };
  }

  function describe(img, rect, rot, soft) {
    const w = img.naturalWidth || img.width || 1, h = img.naturalHeight || img.height || 1;
    return fromPixels(pixels(img, rect || [0, 0, 1, 1], rot || 0, !!soft),
                      Math.round((w / h) * 100) / 100);
  }

  /* ================= müqayisə ================= */

  function bitSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let same = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
    return same / a.length;
  }

  function colorSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
    return Math.max(0, 1 - (diff / a.length) / 55);
  }

  function base(q, t) {
    return Math.max(0, Math.min(100, Math.round(
      (W_A * bitSim(q.a, t.a) + W_D * bitSim(q.d, t.d) + W_C * colorSim(q.c, t.c)) * 100
    )));
  }

  // 10 — əsas rənglər üst-üstə düşürmü
  function sameColor(q, t) {
    if (!q.dom || !t.dom || !q.dom.top || !t.dom.top) return false;
    if (!q.dom.top.length && !t.dom.top.length) return Math.abs(q.dom.grayRatio - t.dom.grayRatio) < 15;
    for (const x of q.dom.top) {
      for (const y of t.dom.top) {
        const d = Math.min(Math.abs(x - y), 12 - Math.abs(x - y));
        if (d <= 1) return true;
      }
    }
    return false;
  }

  // 3 — qablaşdırma forması (en/uzunluq)
  function sameShape(q, t) {
    if (!q.ar || !t.ar) return false;
    const r = q.ar > t.ar ? q.ar / t.ar : t.ar / q.ar;
    return r <= 1.18;
  }

  /* ================= 12 · keş ================= */

  function openDB() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open(CACHE_DB, 3);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(FP)) db.createObjectStore(FP, { keyPath: 'k' });
        if (!db.objectStoreNames.contains(LEARN)) db.createObjectStore(LEARN, { keyPath: 'id', autoIncrement: true });
        if (db.objectStoreNames.contains('fp')) { try { db.deleteObjectStore('fp'); } catch (e) {} }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  function readAll(store) {
    return openDB().then(db => new Promise(res => {
      const q = db.transaction(store, 'readonly').objectStore(store).getAll();
      q.onsuccess = () => res(q.result || []);
      q.onerror = () => res([]);
    })).catch(() => []);
  }

  function loadCache() {
    if (_cache) return Promise.resolve(_cache);
    return readAll(FP).then(rows => {
      _cache = new Map();
      rows.forEach(r => { if (r && r.k && r.v) _cache.set(r.k, r.v); });
      return _cache;
    });
  }

  function flushCache() {
    if (!_dirty.length) return Promise.resolve(0);
    const rows = _dirty.slice(); _dirty = [];
    return openDB().then(db => new Promise(res => {
      const tx = db.transaction(FP, 'readwrite'), st = tx.objectStore(FP);
      rows.forEach(r => { try { st.put(r); } catch (e) {} });
      tx.oncomplete = () => res(rows.length);
      tx.onerror = () => res(0);
    })).catch(() => 0);
  }

  function clearStore(name) {
    return openDB().then(db => new Promise(res => {
      const q = db.transaction(name, 'readwrite').objectStore(name).clear();
      q.onsuccess = () => res(true);
      q.onerror = () => res(false);
    })).catch(() => false);
  }

  function clearCache() { _cache = null; _dirty = []; return clearStore(FP); }
  function clearLearning() { _learn = null; return clearStore(LEARN); }

  /* ================= 15 · öyrənmə ================= */

  function loadLearn() {
    if (_learn) return Promise.resolve(_learn);
    return readAll(LEARN).then(rows => { _learn = rows || []; return _learn; });
  }

  function confirmMatch(productId) {
    if (!_lastQ || !_lastQ.main) return Promise.resolve(false);
    const rec = { pid: String(productId), a: _lastQ.main.a, d: _lastQ.main.d, c: _lastQ.main.c, at: Date.now() };
    return openDB().then(db => new Promise(res => {
      const tx = db.transaction(LEARN, 'readwrite');
      try { tx.objectStore(LEARN).add(rec); } catch (e) {}
      tx.oncomplete = () => { if (_learn) _learn.push(rec); res(true); };
      tx.onerror = () => res(false);
    })).catch(() => false);
  }

  function learnedBoost(main, learn) {
    const map = {};
    (learn || []).forEach(r => {
      const s = W_A * bitSim(main.a, r.a) + W_D * bitSim(main.d, r.d) + W_C * colorSim(main.c, r.c);
      if (s >= 0.82) {
        const v = Math.round(B_LEARN * s);
        if (!map[r.pid] || map[r.pid] < v) map[r.pid] = v;
      }
    });
    return map;
  }

  /* ================= 8 · barkod ================= */

  async function detectBarcode(dataUrl) {
    try {
      if (typeof BarcodeDetector === 'undefined') return null;
      const det = new BarcodeDetector();
      const img = await loadImage(dataUrl);
      const found = await det.detect(img);
      if (found && found.length) {
        return found.map(f => String(f.rawValue || '').trim()).filter(Boolean);
      }
    } catch (e) {}
    return null;
  }

  function byBarcode(code) {
    const c = String(code).replace(/\s+/g, '');
    return products().filter(p => {
      const list = [p.barcode, p.barcode2, p.code, p.specialCode].filter(Boolean).map(String);
      if (Array.isArray(p.barcodes)) p.barcodes.forEach(b => list.push(String(b)));
      return list.some(b => b.replace(/\s+/g, '') === c);
    });
  }

  /* ================= 7 + 9 · OCR və marka ================= */

  const OCR_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let _ocrState = 'idle';   // idle | ready | none

  function ensureOCR() {
    if (window.Tesseract) { _ocrState = 'ready'; return Promise.resolve(window.Tesseract); }
    if (_ocrState === 'none') return Promise.resolve(null);
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = OCR_CDN;
      s.onload = () => { _ocrState = window.Tesseract ? 'ready' : 'none'; res(window.Tesseract || null); };
      s.onerror = () => { _ocrState = 'none'; res(null); };
      document.head.appendChild(s);
      setTimeout(() => { if (_ocrState !== 'ready') { _ocrState = 'none'; res(window.Tesseract || null); } }, 12000);
    });
  }

  async function ocr(dataUrl) {
    const T = await ensureOCR();
    if (!T) return { ok: false, text: '', tokens: [], reason: 'OCR kitabxanası yoxdur (oflayn)' };
    try {
      const r = await T.recognize(dataUrl, 'eng');
      const text = (r && r.data && r.data.text) || '';
      return { ok: true, text: text, tokens: tokensOf(text) };
    } catch (e) {
      return { ok: false, text: '', tokens: [], reason: String(e && e.message || e) };
    }
  }

  function tokensOf(text) {
    const t = [];
    fold(text).split(/\s+/).forEach(w => { if (w.length >= 3) t.push(w); });
    const vol = String(text).toLowerCase().match(/\d+\s?(ml|gr|g|kg|l|lt)\b/g);
    if (vol) vol.forEach(v => t.push(v.replace(/\s+/g, '')));
    const nums = String(text).match(/\d{2,}/g);
    if (nums) nums.forEach(n => t.push(n));
    return t.filter((v, i, a) => a.indexOf(v) === i).slice(0, 40);
  }

  // Kataloqdaki markaları toplayır → OCR mətnindəki marka tapılır
  function brandIndex(list) {
    const set = new Map();
    list.forEach(p => {
      [p.brand, p.firma, p.company].forEach(b => {
        const f = fold(b); if (f && f.length >= 3) set.set(f, (set.get(f) || 0) + 1);
      });
      const first = fold(p.name).split(' ')[0];
      if (first && first.length >= 3) set.set(first, (set.get(first) || 0) + 1);
    });
    return set;
  }

  function brandFromTokens(tokens, index) {
    for (const t of tokens) if (index.has(t)) return t;
    for (const t of tokens) {
      for (const b of index.keys()) {
        if (b.length >= 4 && (b.indexOf(t) === 0 || t.indexOf(b) === 0)) return b;
      }
    }
    return null;
  }

  function productHasText(p, tokens, brand) {
    const hay = fold([p.name, p.brand, p.firma, p.model, p.note].filter(Boolean).join(' '));
    if (brand && hay.indexOf(brand) >= 0) return 'brand';
    for (const t of tokens) if (t.length >= 4 && hay.indexOf(t) >= 0) return 'text';
    return null;
  }

  /* ================= əsas axtarış ================= */

  async function resolveSrc(src) {
    if (typeof JollyStorage !== 'undefined' && src && src.indexOf('idb:') === 0) {
      const get = JollyStorage.getImage || JollyStorage.get;
      if (typeof get !== 'function') return null;
      const url = await get.call(JollyStorage, src);
      return url || null;
    }
    return src;
  }

  async function queryVariants(dataUrl) {
    const img = await loadImage(dataUrl);
    const out = [];
    ROTS.forEach(rot => {
      CROPS.forEach(([name, rect]) => {
        out.push({ tag: name + '/' + rot + '°', d: describe(img, rect, rot, false) });
      });
    });
    out.push({ tag: 'whatsapp', d: describe(img, [0, 0, 1, 1], 0, true) });   // 6
    return { variants: out, main: out[0].d, img: img };
  }

  async function scan(dataUrl, opts) {
    opts = opts || {};
    const t0 = Date.now();
    const list = products();
    const cache = await loadCache();
    const learn = await loadLearn();

    const stats = {
      products: list.length, images: 0, read: 0, fromCache: 0,
      errors: 0, ms: 0, variants: 0, ocr: 'yoxlanmadı', barcode: 'yoxdur'
    };

    // 8 — əvvəl barkod
    let barcode = null, barcodeHits = [];
    if (opts.barcode !== false) {
      const codes = await detectBarcode(dataUrl);
      if (codes && codes.length) {
        barcode = codes[0];
        stats.barcode = barcode;
        barcodeHits = byBarcode(barcode);
      } else {
        stats.barcode = (typeof BarcodeDetector === 'undefined') ? 'brauzer dəstəkləmir' : 'şəkildə yoxdur';
      }
    }

    if (barcodeHits.length) {
      stats.ms = Date.now() - t0;
      _stats = stats;
      const results = barcodeHits.map(p => ({
        product: p, similarity: 100, base: 100, distance: 0,
        via: 'barkod', bonuses: ['barkod oxundu'], variant: '—'
      }));
      _lastQ = await queryVariants(dataUrl);      // öyrənmə üçün lazımdır
      return { results: results, stats: stats, barcode: barcode, text: '', brand: null, viaBarcode: true };
    }

    const q = await queryVariants(dataUrl);
    _lastQ = q;
    stats.variants = q.variants.length;

    // 7 + 9 — OCR fon işi (axtarışı gecikdirmir, nəticəni gözləyirik ancaq qısa)
    let tokens = [], brand = null, text = '';
    if (opts.ocr !== false) {
      const res = await ocr(dataUrl);
      if (res.ok) {
        tokens = res.tokens; text = res.text;
        brand = brandFromTokens(tokens, brandIndex(list));
        stats.ocr = brand ? ('marka: ' + brand) : (tokens.length ? (tokens.length + ' söz') : 'yazı tapılmadı');
      } else {
        stats.ocr = res.reason || 'işləmədi';
      }
    }

    const boost = learnedBoost(q.main, learn);
    const scored = [];
    let seen = 0;

    for (const p of list) {
      seen++;
      if (seen % YIELD_EVERY === 0) {
        if (typeof opts.onProgress === 'function') { try { opts.onProgress(seen, list.length); } catch (e) {} }
        await new Promise(r => setTimeout(r, 0));
      }

      const imgs = imagesOf(p);
      if (!imgs.length) continue;

      let bestBase = -1, bestDesc = null, bestIdx = -1, bestTag = '';

      for (let idx = 0; idx < imgs.length; idx++) {      // 1 — bütün şəkillər
        const raw = imgs[idx], key = fnv(raw);
        let desc = cache.get(key);
        stats.images++;

        if (desc) { stats.fromCache++; }
        else {
          let src = null;
          try { src = await resolveSrc(raw); } catch (e) { src = null; }
          if (!src) { stats.errors++; continue; }
          try {
            const im = await loadImage(src);
            desc = describe(im, [0, 0, 1, 1], 0, false);
            stats.read++;
            cache.set(key, desc); _dirty.push({ k: key, v: desc });
          } catch (e) { stats.errors++; continue; }
        }

        for (const v of q.variants) {
          const s = base(v.d, desc);
          if (s > bestBase) { bestBase = s; bestDesc = desc; bestIdx = idx; bestTag = v.tag; }
        }
      }

      if (bestBase < 0) continue;

      // 3 — ağıllı bal
      const bonuses = [];
      let total = bestBase;
      if (bestIdx === 0) { total += B_FRONT; bonuses.push('ön şəkil +' + B_FRONT); }
      const txt = productHasText(p, tokens, brand);
      if (txt === 'brand') { total += B_BRAND; bonuses.push('marka +' + B_BRAND); }
      else if (txt === 'text') { total += Math.round(B_BRAND / 2); bonuses.push('yazı +' + Math.round(B_BRAND / 2)); }
      if (sameColor(q.main, bestDesc)) { total += B_COLOR; bonuses.push('rəng +' + B_COLOR); }
      if (sameShape(q.main, bestDesc)) { total += B_SHAPE; bonuses.push('forma +' + B_SHAPE); }
      const lb = boost[String(p.id)];
      if (lb) { total += lb; bonuses.push('öyrənilmiş +' + lb); }

      scored.push({
        product: p,
        base: bestBase,
        similarity: Math.max(0, Math.min(100, total)),
        distance: Math.round((1 - bestBase / 100) * (GRID * GRID)),
        imageIndex: bestIdx,
        variant: bestTag,
        bonuses: bonuses,
        via: 'vizual'
      });
    }

    // 11 — dublikat filtri (bir mal = bir sətir; id-si eyni olanlar birləşir)
    const uniq = new Map();
    scored.forEach(r => {
      const k = String(r.product.id || r.product.barcode || r.product.name);
      const old = uniq.get(k);
      if (!old || old.similarity < r.similarity) uniq.set(k, r);
    });
    const final = Array.from(uniq.values()).sort((a, b) => b.similarity - a.similarity);

    stats.ms = Date.now() - t0;
    stats.compared = final.length;
    _stats = stats;
    flushCache();
    if (typeof opts.onProgress === 'function') { try { opts.onProgress(list.length, list.length); } catch (e) {} }

    return { results: final, stats: stats, barcode: barcode, text: text, brand: brand, viaBarcode: false };
  }

  /* 2 — həmişə ən yaxın nəticələr */
  async function findBest(dataUrl, opts) {
    opts = opts || {};
    const limit = opts.limit || 5;
    const out = await scan(dataUrl, opts);
    return {
      results: out.results.slice(0, limit), total: out.results.length,
      stats: out.stats, barcode: out.barcode, text: out.text,
      brand: out.brand, viaBarcode: out.viaBarcode
    };
  }

  /* v1/v2 uyğunluğu */
  async function findSimilar(dataUrl, maxDistance) {
    const md = (typeof maxDistance === 'number' && maxDistance > 0) ? maxDistance : 26;
    const minSim = (1 - md / (GRID * GRID)) * 100;
    const out = await scan(dataUrl, { ocr: false });
    return out.results.filter(r => r.base >= minSim);
  }

  /* ================= 12 · warmup ================= */

  async function warmup(opts) {
    opts = opts || {};
    const list = products();
    const cache = await loadCache();
    let done = 0, made = 0, errors = 0, total = 0;
    list.forEach(p => { total += imagesOf(p).length; });

    for (const p of list) {
      for (const raw of imagesOf(p)) {
        done++;
        if (done % 10 === 0) {
          if (typeof opts.onProgress === 'function') { try { opts.onProgress(done, total, made, errors); } catch (e) {} }
          await new Promise(r => setTimeout(r, 0));
        }
        const key = fnv(raw);
        if (cache.has(key)) continue;
        let src = null;
        try { src = await resolveSrc(raw); } catch (e) { src = null; }
        if (!src) { errors++; continue; }
        try {
          const im = await loadImage(src);
          const d = describe(im, [0, 0, 1, 1], 0, false);
          cache.set(key, d); _dirty.push({ k: key, v: d }); made++;
          if (_dirty.length >= 60) await flushCache();
        } catch (e) { errors++; }
      }
    }
    await flushCache();
    if (typeof opts.onProgress === 'function') { try { opts.onProgress(total, total, made, errors); } catch (e) {} }
    return { images: total, created: made, errors: errors, cached: cache.size };
  }

  /* ================= kamera / qalereya ================= */

  async function captureAndSearch(onResults) {
    if (typeof POS !== 'undefined' && !POS.can('search.photo')) { _denied(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'scan-overlay vs-scanning';
    overlay.id = 'visualScanOverlay';
    overlay.innerHTML = `
      <button class="icon-btn scan-close" id="visualScanClose">✕</button>
      <video id="visualScanVideo" autoplay playsinline muted></video>
      <div class="scan-frame" style="height:220px;"></div>
      <div style="position:absolute;bottom:100px;left:0;right:0;text-align:center;">
        <button class="btn btn-primary" id="visualCaptureBtn" style="border-radius:999px;width:70px;height:70px;padding:0;font-size:26px;">📸</button>
      </div>
      <div style="position:absolute;bottom:40px;left:0;right:0;text-align:center;color:#fff;font-size:13px;opacity:.85;">
        Məhsulu çərçivəyə tutub şəkil çəkin
      </div>
    `;
    document.body.appendChild(overlay);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      document.getElementById('visualScanVideo').srcObject = stream;
    } catch (e) {
      if (window.Toast) Toast.error('Kameraya giriş alınmadı.');
      overlay.remove();
      return;
    }

    function cleanup() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      overlay.remove();
    }

    document.getElementById('visualScanClose').onclick = cleanup;
    document.getElementById('visualCaptureBtn').onclick = async () => {
      const video = document.getElementById('visualScanVideo');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      cleanup();
      if (window.Toast) Toast.info('Axtarılır...');
      const results = await findSimilar(dataUrl);
      onResults(results, dataUrl);
    };
  }

  function pickAndSearch(onResults) {
    if (typeof POS !== 'undefined' && !POS.can('search.photo')) { _denied(); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (window.Toast) Toast.info('Axtarılır...');
        const results = await findSimilar(ev.target.result);
        onResults(results, ev.target.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  /* ================= 13 · yoxlama ================= */

  async function selfTest() {
    const out = { ok: false, version: V, products: 0, withImages: 0, images: 0, sample: null, cache: 0, learned: 0 };
    const list = products();
    out.products = list.length;
    list.forEach(p => { const n = imagesOf(p).length; if (n) { out.withImages++; out.images += n; } });
    try { out.cache = (await loadCache()).size; } catch (e) {}
    try { out.learned = (await loadLearn()).length; } catch (e) {}
    out.barcodeApi = (typeof BarcodeDetector !== 'undefined');
    try {
      const first = list.find(p => imagesOf(p).length);
      if (first) {
        const src = await resolveSrc(imagesOf(first)[0]);
        if (src) {
          const im = await loadImage(src);
          const d = describe(im, [0, 0, 1, 1], 0, false);
          out.sample = base(d, d);      // 100 olmalıdır
        }
      }
    } catch (e) { out.error = String(e && e.message || e); }
    out.ok = out.products > 0 && out.withImages > 0 && out.sample === 100;
    return out;
  }

  return {
    version: V,
    captureAndSearch, pickAndSearch,
    findSimilar, findBest, scan,
    warmup, confirm: confirmMatch,
    detectBarcode, ocr, byBarcode,
    describe, base, loadImage, computeHashFromImage: img => describe(img, [0, 0, 1, 1], 0, false).a,
    clearCache, clearLearning, flushCache,
    lastStats: () => _stats,
    learned: () => loadLearn().then(l => l.length),
    selfTest
  };
})();

try { window.JollyVisualSearch = JollyVisualSearch; } catch (e) {}
