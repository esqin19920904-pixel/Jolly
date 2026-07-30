/* ============================================================
   JOLLY Vision AI  —  visual-search.js  v4.0.0   (2026-07-30)
   ------------------------------------------------------------
   1  HYBRID SEARCH — 5 mərhələ, sıra ilə:
        1) Barkod   → tapılsa dərhal bitir
        2) QR       → JLY kodu / rəqəm / mətn
        3) OCR qapısı → marka tapılsa yalnız o markanın malları
                         müqayisə olunur (min mal → 30 mal)
        4) Vizual profil müqayisəsi
        5) Öyrənilmiş uyğunluqlar (müsbət və MƏNFİ)
   2  ULTRA CACHE — hər şəkil üçün profil IndexedDB-də (`fp4`):
        hash · qradient · rəng · dominant rəng · tekstura ·
        16 lokal blok · en/uzunluq · avtomatik kəsim çərçivəsi
   3  CONFIDENCE ENGINE — tək faiz yox, bal cədvəli:
        Vizual / OCR / Marka / Rəng / Forma / Variant / Tarixçə /
        Öyrənmə  →  🟢 dəqiq · 🟡 çox güman · 🔴 əl ilə yoxla
   4  SELF LEARNING v2 — "✅ düzgün" ARTIRIR, "❌ səhv" AZALDIR
   5  DUPLICATE DETECTOR — eyni barkod / kod / şəkil / hash
   6  AUTO CROP — malın konturu tapılır, fon kəsilir
   7  FON TƏSİRİNİN AZALDILMASI — mərkəz çəkili müqayisə
      (əsl seqmentasiya DEYİL — brauzerdə model yoxdur)
   8  SIMILAR PRODUCTS — tapılan malın ailəsi
   9  PERFORMANCE — RAM (yalnız Chrome), keş, növbə, orta vaxt
      (CPU brauzerdən oxunmur)
   10 SEARCH ANALYTICS — son 30 gün: ən çox axtarılan, tapılmayan,
      mərhələ uğuru, orta vaxt

   VISION PROFİLİ (hər şəkil üçün, maddə 11):
     a    aHash 8×8         — ümumi forma
     d    dHash 9×8         — işıqdan asılı olmayan kontur
     c    4×4 rəng          — normalizə olunmuş RGB
     dom  dominant rənglər  — 12 sektorlu hue histoqramı
     tex  tekstura          — 16 hüceyrədə kənar sıxlığı
     loc  16 lokal blok     — qismən örtülü şəkil üçün
     ar   ölçü nisbəti      — qablaşdırma forması
     box  avtomatik kəsim   — malın konturu
   Ön/yan/arxa görünüşü avtomatik AYIRMAQ mümkün deyil (model
   lazımdır) — malın hər şəkli ayrıca profil kimi saxlanılır və
   müqayisədə ən yaxşısı seçilir. Praktikada nəticə eynidir.
   ============================================================ */

const JollyVisualSearch = (() => {
  const V = '4.1.0';
  const GRID = 8, WORK = 32, BOXW = 48;
  const MAX_IMG = 6, YIELD_EVERY = 15;
  const CACHE_DB = 'jolly_vs', FP = 'fp4', LEARN = 'learn', HIST = 'hist';

  // vizual çəkilər (cəmi 1.0)
  const W_HASH = 0.30, W_GRAD = 0.30, W_COLOR = 0.20, W_TEX = 0.08, W_LOCAL = 0.12;

  // confidence balları
  const B_OCR = 14, B_BRAND = 10, B_COLOR = 5, B_SHAPE = 5, B_VARIANT = 8, B_HIST = 4, B_LEARN = 25;
  const CONF_GREEN = 105, CONF_YELLOW = 78;

  const CROPS = [
    ['tam',  [0.00, 0.00, 1.00, 1.00]],
    ['orta', [0.15, 0.15, 0.70, 0.70]],
    ['sol',  [0.00, 0.00, 0.55, 1.00]],
    ['sağ',  [0.45, 0.00, 0.55, 1.00]],
    ['üst',  [0.00, 0.00, 1.00, 0.55]],
    ['alt',  [0.00, 0.45, 1.00, 0.55]]
  ];
  const ROTS = [0, 90, 180, 270];

  let _stats = null, _cache = null, _dirty = [], _learn = null;
  let _lastQ = null, _lastResults = null, _times = [];

  /* ================== köməkçilər ================== */

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
    return h.toString(36) + '-' + str.length + '-v4';
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
    try { if (typeof JollyDB !== 'undefined' && JollyDB.foldText) return JollyDB.foldText(s); } catch (e) {}
    return s.replace(/ə/g, 'e').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
            .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function codesOf(p) {
    const out = [];
    const push = v => { if (v !== null && v !== undefined && v !== '') out.push(String(v).replace(/\s+/g, '')); };
    push(p.barcode); push(p.barcode2); push(p.specialCode); push(p.code); push(p.extraCode);
    if (Array.isArray(p.barcodes)) p.barcodes.forEach(push);
    return out;
  }

  /* ================== 6 · auto crop ================== */

  const _cb = document.createElement('canvas');

  function autoBox(img) {
    try {
      _cb.width = BOXW; _cb.height = BOXW;
      const ctx = _cb.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, BOXW, BOXW);
      ctx.drawImage(img, 0, 0, BOXW, BOXW);
      const d = ctx.getImageData(0, 0, BOXW, BOXW).data;

      // kənar rəngi = 4 kənarın ortası (fon ehtimalı)
      let br = 0, bg = 0, bb = 0, n = 0;
      const at = (x, y) => ((y * BOXW + x) * 4);
      for (let i = 0; i < BOXW; i++) {
        [at(i, 0), at(i, BOXW - 1), at(0, i), at(BOXW - 1, i)].forEach(k => {
          br += d[k]; bg += d[k + 1]; bb += d[k + 2]; n++;
        });
      }
      br /= n; bg /= n; bb /= n;

      let x0 = BOXW, y0 = BOXW, x1 = -1, y1 = -1;
      for (let y = 0; y < BOXW; y++) {
        for (let x = 0; x < BOXW; x++) {
          const k = at(x, y);
          const diff = Math.abs(d[k] - br) + Math.abs(d[k + 1] - bg) + Math.abs(d[k + 2] - bb);
          if (diff > 54) {
            if (x < x0) x0 = x; if (y < y0) y0 = y;
            if (x > x1) x1 = x; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return [0, 0, 1, 1];
      const pad = 2;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
      x1 = Math.min(BOXW - 1, x1 + pad); y1 = Math.min(BOXW - 1, y1 + pad);
      const w = (x1 - x0 + 1) / BOXW, h = (y1 - y0 + 1) / BOXW;
      if (w * h < 0.10 || w * h > 0.94) return [0, 0, 1, 1];   // şübhəlidir — tam şəkil
      return [x0 / BOXW, y0 / BOXW, w, h];
    } catch (e) { return [0, 0, 1, 1]; }
  }

  /* ================== profil ================== */

  const _tmp = document.createElement('canvas');
  const _sm = document.createElement('canvas');

  function pixels(img, rect, rot, soft) {
    _tmp.width = WORK; _tmp.height = WORK;
    const ctx = _tmp.getContext('2d', { willReadFrequently: true });
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, WORK, WORK);

    const w = img.naturalWidth || img.width || WORK;
    const h = img.naturalHeight || img.height || WORK;
    const sx = Math.floor(w * rect[0]), sy = Math.floor(h * rect[1]);
    const sw = Math.max(1, Math.floor(w * rect[2])), sh = Math.max(1, Math.floor(h * rect[3]));

    let src = img, a = sx, b = sy, c = sw, e = sh;
    if (soft) {                       // WhatsApp sıxılması
      _sm.width = 12; _sm.height = 12;
      _sm.getContext('2d', { willReadFrequently: true }).drawImage(img, sx, sy, sw, sh, 0, 0, 12, 12);
      src = _sm; a = 0; b = 0; c = 12; e = 12;
    }
    ctx.translate(WORK / 2, WORK / 2);
    if (rot) ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(src, a, b, c, e, -WORK / 2, -WORK / 2, WORK, WORK);
    ctx.restore();
    return ctx.getImageData(0, 0, WORK, WORK).data;
  }

  function blockAvg(gray, size, cols, rows) {
    const out = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const y0 = Math.floor(r * size / rows), y1 = Math.max(y0 + 1, Math.floor((r + 1) * size / rows));
      for (let c = 0; c < cols; c++) {
        const x0 = Math.floor(c * size / cols), x1 = Math.max(x0 + 1, Math.floor((c + 1) * size / cols));
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
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) {
      s += (arr[r * cols + c] > arr[r * cols + c + 1] ? '1' : '0');
    }
    return s;
  }

  function rgbToHue(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 12) return -1;
    let h;
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return Math.round(h);
  }

  function dominant(data) {
    const bins = new Float32Array(12);
    let gray = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const h = rgbToHue(data[i], data[i + 1], data[i + 2]);
      n++;
      if (h < 0) { gray++; continue; }
      bins[Math.floor(h / 30) % 12]++;
    }
    const order = [];
    for (let i = 0; i < 12; i++) order.push([i, bins[i]]);
    order.sort((a, b) => b[1] - a[1]);
    return {
      top: order.slice(0, 3).filter(o => o[1] > n * 0.04).map(o => o[0]),
      grayRatio: Math.round(gray / (n || 1) * 100)
    };
  }

  // 16 hüceyrədə kənar sıxlığı — tekstura
  function texture(gray) {
    const tex = new Float32Array(16);
    for (let y = 1; y < WORK - 1; y++) {
      const cy = Math.floor(y * 4 / WORK);
      for (let x = 1; x < WORK - 1; x++) {
        const cx = Math.floor(x * 4 / WORK), i = y * WORK + x;
        const gx = Math.abs(gray[i + 1] - gray[i - 1]);
        const gy = Math.abs(gray[i + WORK] - gray[i - WORK]);
        tex[cy * 4 + cx] += (gx + gy);
      }
    }
    const out = [];
    for (let i = 0; i < 16; i++) out.push(Math.min(100, Math.round(tex[i] / 900)));
    return out;
  }

  // 16 lokal blok — hər biri 16 bit; qismən örtülü şəkil üçün
  function localBlocks(gray) {
    const out = [];
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const cell = new Float32Array(16);
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            let s = 0, n = 0;
            for (let y = cy * 8 + r * 2; y < cy * 8 + r * 2 + 2; y++) {
              for (let x = cx * 8 + c * 2; x < cx * 8 + c * 2 + 2; x++) { s += gray[y * WORK + x]; n++; }
            }
            cell[r * 4 + c] = n ? s / n : 0;
          }
        }
        out.push(bitsAbove(cell));
      }
    }
    return out;
  }

  function fromPixels(data, ar, box) {
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
      a: bitsAbove(a8), d: bitsGradient(d9, GRID + 1, GRID), c: colN,
      dom: dominant(data), tex: texture(gray), loc: localBlocks(gray),
      ar: ar || 1, box: box || null
    };
  }

  function describe(img, rect, rot, soft) {
    const w = img.naturalWidth || img.width || 1, h = img.naturalHeight || img.height || 1;
    return fromPixels(pixels(img, rect || [0, 0, 1, 1], rot || 0, !!soft),
                      Math.round((w / h) * 100) / 100, rect || null);
  }

  /* profil = auto-crop edilmiş görünüş (fon kəsilir) */
  function profileOf(img) {
    const box = autoBox(img);
    const d = describe(img, box, 0, false);
    d.box = box;
    return d;
  }

  /* ================== müqayisə ================== */

  function bitSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let same = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
    return same / a.length;
  }

  // 7 — mərkəz çəkili rəng müqayisəsi (fonun payı azalır)
  const CENTER = [5, 6, 9, 10];
  function colorSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let sum = 0, wsum = 0;
    for (let cell = 0; cell < 16; cell++) {
      const w = CENTER.indexOf(cell) >= 0 ? 2 : 1;
      let d = 0;
      for (let k = 0; k < 3; k++) d += Math.abs(a[cell * 3 + k] - b[cell * 3 + k]);
      sum += (d / 3) * w; wsum += w;
    }
    return Math.max(0, 1 - (sum / wsum) / 55);
  }

  function numSim(a, b, scale) {
    if (!a || !b || a.length !== b.length) return 0;
    let d = 0;
    for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
    return Math.max(0, 1 - (d / a.length) / (scale || 40));
  }

  // lokal bloklar: neçə blok güclü uyğun gəlir (örtülü şəkil üçün)
  function localSim(a, b) {
    if (!a || !b || !a.length || a.length !== b.length) return 0;
    let good = 0, sum = 0;
    for (let i = 0; i < a.length; i++) {
      const s = bitSim(a[i], b[i]);
      sum += s;
      if (s >= 0.80) good++;
    }
    // yarısı güclü uyğun gəlirsə bu, qismən örtülü eyni maldır
    return Math.max(sum / a.length, good / a.length);
  }

  function visualScore(q, t) {
    const parts = {
      hash: bitSim(q.a, t.a),
      grad: bitSim(q.d, t.d),
      color: colorSim(q.c, t.c),
      tex: numSim(q.tex, t.tex, 30),
      local: localSim(q.loc, t.loc)
    };
    const s = W_HASH * parts.hash + W_GRAD * parts.grad + W_COLOR * parts.color +
              W_TEX * parts.tex + W_LOCAL * parts.local;
    return { score: Math.max(0, Math.min(100, Math.round(s * 100))), parts: parts };
  }

  function sameColor(q, t) {
    if (!q.dom || !t.dom) return false;
    if (!q.dom.top.length && !t.dom.top.length) return Math.abs(q.dom.grayRatio - t.dom.grayRatio) < 15;
    for (const x of q.dom.top) for (const y of t.dom.top) {
      const d = Math.min(Math.abs(x - y), 12 - Math.abs(x - y));
      if (d <= 1) return true;
    }
    return false;
  }

  function sameShape(q, t) {
    if (!q.ar || !t.ar) return false;
    const r = q.ar > t.ar ? q.ar / t.ar : t.ar / q.ar;
    return r <= 1.18;
  }

  /* ================== 2 · keş ================== */

  function openDB() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open(CACHE_DB, 5);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(FP)) db.createObjectStore(FP, { keyPath: 'k' });
        if (!db.objectStoreNames.contains(LEARN)) db.createObjectStore(LEARN, { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains(HIST)) db.createObjectStore(HIST, { keyPath: 'id', autoIncrement: true });
        ['fp', 'fp3'].forEach(old => {
          if (db.objectStoreNames.contains(old)) { try { db.deleteObjectStore(old); } catch (e) {} }
        });
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

  /* ================== 4 · öyrənmə v2 ================== */

  function loadLearn() {
    if (_learn) return Promise.resolve(_learn);
    return readAll(LEARN).then(rows => { _learn = rows || []; return _learn; });
  }

  function teach(productId, sign) {
    if (!_lastQ || !_lastQ.main) return Promise.resolve(false);
    const rec = {
      pid: String(productId), w: (sign < 0 ? -1 : 1),
      a: _lastQ.main.a, d: _lastQ.main.d, c: _lastQ.main.c, at: Date.now()
    };
    return openDB().then(db => new Promise(res => {
      const tx = db.transaction(LEARN, 'readwrite');
      try { tx.objectStore(LEARN).add(rec); } catch (e) {}
      tx.oncomplete = () => { if (_learn) _learn.push(rec); res(true); };
      tx.onerror = () => res(false);
    })).catch(() => false);
  }

  function learnedMap(main, learn) {
    const map = {};
    (learn || []).forEach(r => {
      const s = 0.34 * bitSim(main.a, r.a) + 0.36 * bitSim(main.d, r.d) + 0.30 * colorSim(main.c, r.c);
      if (s < 0.82) return;
      const v = Math.round(B_LEARN * s) * (r.w === -1 ? -1 : 1);
      map[r.pid] = (map[r.pid] || 0) + v;
    });
    // hədd: ±B_LEARN
    Object.keys(map).forEach(k => {
      map[k] = Math.max(-B_LEARN, Math.min(B_LEARN, map[k]));
    });
    return map;
  }

  /* ================== 1 · barkod + QR ================== */

  async function detectCodes(dataUrl) {
    try {
      if (typeof BarcodeDetector === 'undefined') return { ok: false, why: 'brauzer dəstəkləmir', codes: [] };
      let det;
      try {
        det = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix']
        });
      } catch (e) { det = new BarcodeDetector(); }
      const img = await loadImage(dataUrl);
      const found = await det.detect(img);
      return {
        ok: true,
        codes: (found || []).map(f => ({ value: String(f.rawValue || '').trim(), format: f.format || '' }))
                            .filter(c => c.value)
      };
    } catch (e) { return { ok: false, why: String(e && e.message || e), codes: [] }; }
  }

  function byCode(code) {
    const c = String(code).replace(/\s+/g, '');
    return products().filter(p => codesOf(p).indexOf(c) >= 0);
  }

  /* QR: JLY+id (cihaz körpüsü), URL içində id, ya da sadə kod */
  function byQR(value) {
    const v = String(value).trim();
    const m = v.match(/JLY[-_]?([A-Za-z0-9]+)/);
    if (m) {
      const hit = products().filter(p => String(p.id) === m[1]);
      if (hit.length) return hit;
    }
    const idm = v.match(/(?:id=|\/)([A-Za-z0-9]{6,})\s*$/);
    if (idm) {
      const hit = products().filter(p => String(p.id) === idm[1]);
      if (hit.length) return hit;
    }
    return byCode(v);
  }

  /* ================== 3 · OCR + marka ================== */

  const OCR_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let _ocrState = 'idle';

  function ensureOCR() {
    if (window.Tesseract) { _ocrState = 'ready'; return Promise.resolve(window.Tesseract); }
    if (_ocrState === 'none') return Promise.resolve(null);
    _ocrState = 'loading';
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = OCR_CDN;
      s.onload = () => { _ocrState = window.Tesseract ? 'ready' : 'none'; res(window.Tesseract || null); };
      s.onerror = () => { _ocrState = 'none'; res(null); };
      document.head.appendChild(s);
      setTimeout(() => { if (_ocrState !== 'ready') { _ocrState = 'none'; res(window.Tesseract || null); } }, 15000);
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
    for (const t of tokens) for (const b of index.keys()) {
      if (b.length >= 4 && (b.indexOf(t) === 0 || t.indexOf(b) === 0)) return b;
    }
    return null;
  }

  function textHit(p, tokens, brand) {
    const hay = fold([p.name, p.brand, p.firma, p.model, p.note].filter(Boolean).join(' '));
    if (brand && hay.indexOf(brand) >= 0) return { brand: true, words: 1 };
    let words = 0;
    for (const t of tokens) if (t.length >= 4 && hay.indexOf(t) >= 0) words++;
    return words ? { brand: false, words: words } : null;
  }

  /* ================== axtarış ================== */

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
    ROTS.forEach(rot => CROPS.forEach(([name, rect]) => {
      out.push({ tag: name + '/' + rot + '°', d: describe(img, rect, rot, false) });
    }));
    out.push({ tag: 'whatsapp', d: describe(img, [0, 0, 1, 1], 0, true) });
    const box = autoBox(img);
    out.push({ tag: 'auto-crop', d: describe(img, box, 0, false) });
    return { variants: out, main: out[0].d, box: box, img: img };
  }

  async function profileFor(raw, cache, stats) {
    const key = fnv(raw);
    let d = cache.get(key);
    if (d) { stats.fromCache++; return d; }
    let src = null;
    try { src = await resolveSrc(raw); } catch (e) { src = null; }
    if (!src) { stats.errors++; return null; }
    try {
      const im = await loadImage(src);
      d = profileOf(im);
      stats.read++;
      cache.set(key, d); _dirty.push({ k: key, v: d });
      return d;
    } catch (e) { stats.errors++; return null; }
  }

  /* bir dəstə malı müqayisə edir */
  async function scanSet(list, q, ctx) {
    const { cache, stats, tokens, brand, boost, histPids, onProgress, totalHint } = ctx;
    const out = [];
    let seen = 0;

    for (const p of list) {
      seen++;
      if (seen % YIELD_EVERY === 0) {
        if (typeof onProgress === 'function') { try { onProgress(ctx.done + seen, totalHint); } catch (e) {} }
        await new Promise(r => setTimeout(r, 0));
      }
      const imgs = imagesOf(p);
      if (!imgs.length) continue;

      let best = null;
      for (let idx = 0; idx < imgs.length; idx++) {
        stats.images++;
        const prof = await profileFor(imgs[idx], cache, stats);
        if (!prof) continue;

        /* SÜRƏT: 26 variantın hamısını tam ballamaq telefonu yükləyir.
           Əvvəlcə ucuz aHash müqayisəsi ilə ən yaxın 3 variant seçilir,
           tam profil müqayisəsi yalnız onlara tətbiq olunur. */
        const ranked = q.variants
          .map(v => ({ v: v, s: bitSim(v.d.a, prof.a) }))
          .sort((x, y) => y.s - x.s)
          .slice(0, 3);

        for (const rk of ranked) {
          const r = visualScore(rk.v.d, prof);
          if (!best || r.score > best.score) {
            best = { score: r.score, parts: r.parts, prof: prof, idx: idx, tag: rk.v.tag };
          }
        }
      }
      if (!best) continue;

      // 3 — CONFIDENCE ENGINE
      const conf = { vizual: best.score, ocr: 0, marka: 0, rəng: 0, forma: 0, variant: 0, tarixçə: 0, öyrənmə: 0 };

      const th = textHit(p, tokens, brand);
      if (th) {
        if (th.brand) conf.marka = B_BRAND;
        else conf.ocr = Math.min(B_OCR, th.words * 5);
      }
      if (sameColor(q.main, best.prof)) conf.rəng = B_COLOR;
      if (sameShape(q.main, best.prof)) conf.forma = B_SHAPE;

      // variant razılığı yalnız ən yaxşı nəticələr üçün hesablanır (aşağıda)
      conf.variant = 0;

      if (histPids && histPids[String(p.id)]) conf.tarixçə = B_HIST;
      if (boost && boost[String(p.id)]) conf.öyrənmə = boost[String(p.id)];
      if (best.idx === 0) conf.vizual += 0;   // ön şəkil artıq profilə daxildir

      let total = 0;
      Object.keys(conf).forEach(k => { total += conf[k]; });

      out.push({
        product: p,
        similarity: best.score,
        confidence: Math.max(0, total),
        label: total >= CONF_GREEN ? 'green' : (total >= CONF_YELLOW ? 'yellow' : 'red'),
        breakdown: conf,
        parts: best.parts,
        _prof: best.prof,
        imageIndex: best.idx,
        variant: best.tag,
        via: 'vizual',
        bonuses: Object.keys(conf).filter(k => k !== 'vizual' && conf[k])
                       .map(k => k + ' ' + (conf[k] > 0 ? '+' : '') + conf[k])
      });
    }
    ctx.done += list.length;
    return out;
  }

  async function scan(dataUrl, opts) {
    opts = opts || {};
    const t0 = Date.now();
    const list = products();
    const cache = await loadCache();
    const learn = await loadLearn();

    const stats = {
      products: list.length, images: 0, read: 0, fromCache: 0, errors: 0,
      ms: 0, variants: 0, stage: '—', ocr: 'yoxlanmadı', barcode: 'yoxdur',
      scanned: 0, skippedByOCR: 0
    };

    /* MƏRHƏLƏ 1-2: barkod / QR */
    let codeInfo = null;
    if (opts.barcode !== false) {
      codeInfo = await detectCodes(dataUrl);
      if (!codeInfo.ok) stats.barcode = codeInfo.why;
      else if (!codeInfo.codes.length) stats.barcode = 'şəkildə yoxdur';
      else {
        for (const c of codeInfo.codes) {
          const isQR = /qr|matrix/i.test(c.format);
          const hits = isQR ? byQR(c.value) : byCode(c.value);
          stats.barcode = c.value + (c.format ? ' (' + c.format + ')' : '');
          if (hits.length) {
            stats.stage = isQR ? 'QR' : 'barkod';
            stats.ms = Date.now() - t0;
            _stats = stats;
            _lastQ = await queryVariants(dataUrl);
            const results = hits.map(p => ({
              product: p, similarity: 100, confidence: 100,
              label: 'green', breakdown: { vizual: 100 }, via: stats.stage,
              bonuses: [stats.stage + ' oxundu'], variant: '—'
            }));
            _lastResults = results;
            return { results, stats, barcode: c.value, text: '', brand: null,
                     viaBarcode: true, stage: stats.stage, ocrPending: null };
          }
        }
      }
    }

    const q = await queryVariants(dataUrl);
    _lastQ = q;
    stats.variants = q.variants.length;

    /* MƏRHƏLƏ 3: OCR qapısı */
    let tokens = [], brand = null, text = '', ocrPending = null;
    if (opts.ocr !== false) {
      const job = ocr(dataUrl).then(res => {
        if (!res.ok) { stats.ocr = res.reason || 'işləmədi'; return null; }
        const t = res.tokens, b = brandFromTokens(t, brandIndex(list));
        stats.ocr = b ? ('marka: ' + b) : (t.length ? (t.length + ' söz') : 'yazı tapılmadı');
        return { tokens: t, brand: b, text: res.text };
      }).catch(() => null);

      const wait = (typeof opts.ocrWait === 'number') ? opts.ocrWait : 2500;
      const early = await Promise.race([job, new Promise(r => setTimeout(() => r('__late__'), wait))]);
      if (early && early !== '__late__') { tokens = early.tokens; brand = early.brand; text = early.text; }
      else if (early === '__late__') { stats.ocr = 'gecikdi — fonda davam edir'; ocrPending = job; }
    }

    const boost = learnedMap(q.main, learn);
    const histPids = {};
    try {
      const rows = await history.list(40);
      rows.forEach(r => { if (r.pid) histPids[String(r.pid)] = true; });
    } catch (e) {}

    const ctx = {
      cache, stats, tokens, brand, boost, histPids,
      onProgress: opts.onProgress, totalHint: list.length, done: 0
    };

    /* MƏRHƏLƏ 4: vizual — marka tapılıbsa əvvəl yalnız o ailə */
    let results = [];
    if (brand) {
      const inFamily = list.filter(p => {
        const th = textHit(p, tokens, brand);
        return th && th.brand;
      });
      if (inFamily.length && inFamily.length < list.length * 0.6) {
        ctx.totalHint = inFamily.length;
        results = await scanSet(inFamily, q, ctx);
        results.sort((a, b) => b.confidence - a.confidence);
        stats.scanned = inFamily.length;
        if (results.length && results[0].confidence >= CONF_GREEN) {
          stats.stage = 'OCR + vizual (qısa yol)';
          stats.skippedByOCR = list.length - inFamily.length;
        } else {
          // qapı bəs etmədi — qalanlarını da yoxla
          const rest = list.filter(p => inFamily.indexOf(p) < 0);
          ctx.totalHint = list.length;
          const more = await scanSet(rest, q, ctx);
          results = results.concat(more);
          stats.scanned = list.length;
          stats.stage = 'OCR qapısı + tam vizual';
        }
      }
    }
    if (!results.length) {
      ctx.totalHint = list.length;
      results = await scanSet(list, q, ctx);
      stats.scanned = list.length;
      stats.stage = brand ? 'tam vizual (marka kömək etmədi)' : 'tam vizual';
    }

    // dublikat filtri
    const uniq = new Map();
    results.forEach(r => {
      const k = String(r.product.id || r.product.barcode || r.product.name);
      const old = uniq.get(k);
      if (!old || old.confidence < r.confidence) uniq.set(k, r);
    });
    let final = Array.from(uniq.values()).sort((a, b) => b.confidence - a.confidence);

    /* VARİANT RAZILIĞI — yalnız ilk 12 nəticə üçün.
       Bir neçə bucaq/kəsim eyni malı göstərirsə bu, təsadüfi
       oxşarlıq deyil; güvən balı artır. */
    final.slice(0, 12).forEach(r => {
      if (!r._prof || r.via !== 'vizual') return;
      let agree = 0;
      q.variants.forEach(v => {
        if (visualScore(v.d, r._prof).score >= r.similarity - 5) agree++;
      });
      const add = Math.min(B_VARIANT, Math.round(agree / q.variants.length * B_VARIANT * 2));
      r.breakdown.variant = add;
      r.confidence = Math.max(0, r.confidence + add);
      r.label = r.confidence >= CONF_GREEN ? 'green' : (r.confidence >= CONF_YELLOW ? 'yellow' : 'red');
      r.bonuses = Object.keys(r.breakdown).filter(k => k !== 'vizual' && r.breakdown[k])
        .map(k => k + ' ' + (r.breakdown[k] > 0 ? '+' : '') + r.breakdown[k]);
    });
    final.sort((a, b) => b.confidence - a.confidence);
    final.forEach(r => { delete r._prof; });

    stats.ms = Date.now() - t0;
    stats.compared = final.length;
    _stats = stats;
    _lastResults = final;
    _times.push(stats.ms); if (_times.length > 30) _times.shift();
    flushCache();
    if (typeof opts.onProgress === 'function') { try { opts.onProgress(list.length, list.length); } catch (e) {} }

    return { results: final, stats, barcode: (codeInfo && codeInfo.codes[0]) ? codeInfo.codes[0].value : null,
             text, brand, viaBarcode: false, stage: stats.stage, ocrPending };
  }

  function applyText(tokens, brand, limit) {
    const src = _lastResults || [];
    const out = src.map(r => {
      if (r.via !== 'vizual') return r;
      const th = textHit(r.product, tokens || [], brand);
      if (!th) return r;
      const bd = Object.assign({}, r.breakdown || {});
      if (th.brand && !bd.marka) bd.marka = B_BRAND;
      else if (!th.brand && !bd.ocr) bd.ocr = Math.min(B_OCR, th.words * 5);
      else return r;
      let total = 0; Object.keys(bd).forEach(k => { total += bd[k]; });
      return Object.assign({}, r, {
        breakdown: bd, confidence: Math.max(0, total),
        label: total >= CONF_GREEN ? 'green' : (total >= CONF_YELLOW ? 'yellow' : 'red'),
        bonuses: Object.keys(bd).filter(k => k !== 'vizual' && bd[k])
                       .map(k => k + ' ' + (bd[k] > 0 ? '+' : '') + bd[k])
      });
    });
    out.sort((a, b) => b.confidence - a.confidence);
    _lastResults = out;
    return limit ? out.slice(0, limit) : out;
  }

  async function findBest(dataUrl, opts) {
    opts = opts || {};
    const limit = opts.limit || 5;
    const out = await scan(dataUrl, opts);
    const top = out.results[0] || null;
    try {
      await history.add({
        code: top ? (codesOf(top.product)[0] || '') : '',
        name: top ? top.product.name : '',
        pid: top ? top.product.id : '',
        similarity: top ? top.similarity : 0,
        confidence: top ? top.confidence : 0,
        label: top ? top.label : 'red',
        stage: out.stats.stage, ms: out.stats.ms,
        found: !!(top && top.label !== 'red')
      });
    } catch (e) {}
    return {
      results: out.results.slice(0, limit), total: out.results.length,
      stats: out.stats, barcode: out.barcode, text: out.text, brand: out.brand,
      viaBarcode: out.viaBarcode, stage: out.stage, ocrPending: out.ocrPending
    };
  }

  async function findSimilar(dataUrl, maxDistance) {
    const md = (typeof maxDistance === 'number' && maxDistance > 0) ? maxDistance : 26;
    const minSim = (1 - md / (GRID * GRID)) * 100;
    const out = await scan(dataUrl, { ocr: false });
    return out.results.filter(r => r.similarity >= minSim);
  }

  /* ================== 8 · oxşar mallar ================== */

  async function similarTo(productId, n) {
    const list = products();
    const me = list.filter(p => String(p.id) === String(productId))[0];
    if (!me) return [];
    const cache = await loadCache();
    const stats = { images: 0, read: 0, fromCache: 0, errors: 0 };
    const mine = imagesOf(me)[0] ? await profileFor(imagesOf(me)[0], cache, stats) : null;
    const myBrand = fold(me.brand || me.firma || fold(me.name).split(' ')[0]);

    const out = [];
    for (const p of list) {
      if (String(p.id) === String(productId)) continue;
      const theirBrand = fold(p.brand || p.firma || fold(p.name).split(' ')[0]);
      let s = 0;
      if (myBrand && theirBrand && myBrand === theirBrand) s += 40;
      if (mine) {
        const raw = imagesOf(p)[0];
        if (raw) {
          const prof = cache.get(fnv(raw));      // yalnız keşdə olanlar — sürət üçün
          if (prof) s += Math.round(visualScore(mine, prof).score * 0.6);
        }
      }
      if (s > 0) out.push({ product: p, score: s });
    }
    out.sort((a, b) => b.score - a.score);
    flushCache();
    return out.slice(0, n || 5);
  }

  /* ================== 5 · dublikatlar ================== */

  async function duplicates(opts) {
    opts = opts || {};
    const list = products();
    const cache = await loadCache();
    const byBar = {}, byExtra = {}, byImg = {}, byHash = {};

    list.forEach(p => {
      const bar = String(p.barcode || '').replace(/\s+/g, '');
      if (bar) (byBar[bar] = byBar[bar] || []).push(p);
      const ex = String(p.specialCode || p.code || '').replace(/\s+/g, '');
      if (ex) (byExtra[ex] = byExtra[ex] || []).push(p);
      imagesOf(p).forEach(raw => { (byImg[raw] = byImg[raw] || []).push(p); });
      const first = imagesOf(p)[0];
      if (first) {
        const prof = cache.get(fnv(first));
        if (prof) (byHash[prof.a] = byHash[prof.a] || []).push(p);
      }
    });

    const pack = obj => Object.keys(obj)
      .filter(k => obj[k].length > 1)
      .map(k => ({ key: k, items: obj[k].map(p => ({ id: p.id, name: p.name, barcode: p.barcode })) }));

    return {
      barcode: pack(byBar), code: pack(byExtra), image: pack(byImg), visual: pack(byHash),
      note: cache.size ? null : 'Barmaq izləri hazır deyil — “eyni şəkil/hash” qrupları üçün əvvəlcə ⚡ warmup lazımdır'
    };
  }

  /* ================== tarixçə + analitika ================== */

  const history = {
    add: function (entry) {
      const rec = {
        at: Date.now(), code: entry.code || '', name: entry.name || '',
        pid: entry.pid ? String(entry.pid) : '', similarity: entry.similarity || 0,
        confidence: entry.confidence || 0, label: entry.label || '',
        stage: entry.stage || '', ms: entry.ms || 0, found: !!entry.found
      };
      return openDB().then(db => new Promise(res => {
        const tx = db.transaction(HIST, 'readwrite');
        try { tx.objectStore(HIST).add(rec); } catch (e) {}
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
      })).catch(() => false);
    },
    list: function (n) {
      return readAll(HIST).then(rows => {
        rows.sort((a, b) => b.at - a.at);
        return n ? rows.slice(0, n) : rows;
      });
    },
    clear: function () { return clearStore(HIST); }
  };

  async function analytics(days) {
    const d = days || 30;
    const since = Date.now() - d * 86400000;
    const rows = (await history.list()).filter(r => r.at >= since);

    const byName = {}, stages = {}, notFound = [];
    let ms = 0, found = 0;
    rows.forEach(r => {
      ms += (r.ms || 0);
      if (r.found) {
        found++;
        const k = r.name || r.code || '(adsız)';
        byName[k] = (byName[k] || 0) + 1;
      } else notFound.push({ at: r.at, confidence: r.confidence, stage: r.stage });
      const st = r.stage || '—';
      stages[st] = (stages[st] || 0) + 1;
    });

    const top = Object.keys(byName).map(k => ({ name: k, count: byName[k] }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const stageRows = Object.keys(stages).map(k => ({ stage: k, count: stages[k] }))
      .sort((a, b) => b.count - a.count);

    return {
      days: d, searches: rows.length, found: found,
      notFound: notFound.length, foundRate: rows.length ? Math.round(found / rows.length * 100) : 0,
      avgMs: rows.length ? Math.round(ms / rows.length) : 0,
      barcodeRate: rows.length ? Math.round(rows.filter(r => /barkod|QR/.test(r.stage)).length / rows.length * 100) : 0,
      ocrRate: rows.length ? Math.round(rows.filter(r => /OCR/.test(r.stage)).length / rows.length * 100) : 0,
      top: top, stages: stageRows
    };
  }

  /* ================== 9 · performans ================== */

  async function perf() {
    let mem = null;
    try {
      if (performance && performance.memory) {
        mem = {
          usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
          limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
        };
      }
    } catch (e) {}
    let quota = null;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const q = await navigator.storage.estimate();
        quota = { usedMB: Math.round((q.usage || 0) / 1048576), quotaMB: Math.round((q.quota || 0) / 1048576) };
      }
    } catch (e) {}
    const need = await warmupNeeded();
    return {
      version: V,
      ram: mem, cpu: null, cpuNote: 'CPU brauzerdən oxunmur',
      cores: (navigator.hardwareConcurrency || null),
      storage: quota,
      fingerprints: (await loadCache()).size,
      warm: need,
      ocr: _ocrState,
      learned: (await loadLearn()).length,
      history: (await history.list()).length,
      avgSearchMs: _times.length ? Math.round(_times.reduce((a, b) => a + b, 0) / _times.length) : null,
      lastSearchMs: _times.length ? _times[_times.length - 1] : null
    };
  }

  /* ================== warmup ================== */

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
          const d = profileOf(im);
          cache.set(key, d); _dirty.push({ k: key, v: d }); made++;
          if (_dirty.length >= 50) await flushCache();
        } catch (e) { errors++; }
      }
    }
    await flushCache();
    if (typeof opts.onProgress === 'function') { try { opts.onProgress(total, total, made, errors); } catch (e) {} }
    return { images: total, created: made, errors: errors, cached: cache.size };
  }

  async function warmupNeeded() {
    const cache = await loadCache();
    let total = 0, missing = 0;
    products().forEach(p => imagesOf(p).forEach(raw => {
      total++; if (!cache.has(fnv(raw))) missing++;
    }));
    return { total, missing, ready: total - missing };
  }

  /* ================== kamera / qalereya ================== */

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

  /* ================== yoxlama ================== */

  async function selfTest() {
    const out = { ok: false, version: V, products: 0, withImages: 0, images: 0, sample: null };
    const list = products();
    out.products = list.length;
    list.forEach(p => { const n = imagesOf(p).length; if (n) { out.withImages++; out.images += n; } });
    try { out.fingerprints = (await loadCache()).size; } catch (e) {}
    try { out.learned = (await loadLearn()).length; } catch (e) {}
    out.barcodeApi = (typeof BarcodeDetector !== 'undefined');
    try {
      const first = list.find(p => imagesOf(p).length);
      if (first) {
        const src = await resolveSrc(imagesOf(first)[0]);
        if (src) {
          const im = await loadImage(src);
          const d = profileOf(im);
          out.sample = visualScore(d, d).score;      // 100 olmalıdır
          out.autoCrop = d.box;
        }
      }
    } catch (e) { out.error = String(e && e.message || e); }
    out.ok = out.products > 0 && out.withImages > 0 && out.sample === 100;
    return out;
  }

  return {
    version: V,
    captureAndSearch, pickAndSearch,
    findSimilar, findBest, scan, applyText,
    warmup, warmupNeeded,
    confirm: id => teach(id, +1),
    reject: id => teach(id, -1),
    detectCodes, detectBarcode: dataUrl => detectCodes(dataUrl).then(r => r.codes.map(c => c.value)),
    ocr, byCode, byQR,
    similarTo, duplicates, analytics, perf, benchmark, degrade,
    describe, profileOf, autoBox, visualScore,
    loadImage, computeHashFromImage: img => describe(img, [0, 0, 1, 1], 0, false).a,
    clearCache, clearLearning, flushCache,
    history,
    lastStats: () => _stats,
    learned: () => loadLearn().then(l => l.length),
    selfTest
  };
})();

try { window.JollyVisualSearch = JollyVisualSearch; } catch (e) {}
