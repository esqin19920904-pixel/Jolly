/* ==========================================================
   JOLLY KATALOQ - server
   Cloudflare Pages + _worker.js
   Baglantilar:  DB (D1) , BUCKET (R2) , SESSION_SECRET (secret)
   Cedveller "k_" ile baslayir - kohne cedvellere toxunmur.
   ========================================================== */

const BUILD = '20260830-0900';

const JSONH = { 'content-type': 'application/json; charset=utf-8' };

function J(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSONH, ...extra } });
}
function bad(msg, status = 400) { return J({ ok: false, error: msg }, status); }

/* ---------- kicik komekciler ---------- */

const te = new TextEncoder();

function b64(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function nowSec() { return Math.floor(Date.now() / 1000); }

/* AZ herflerini sadelesdirir: axtarisda "ə" ile "e" eyni sayilsin */
function fold(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(s) {
  return fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* telefon nomresini wa.me ucun 994... formasina salir */
function waPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('994')) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return '994' + d;
}

/* ---------- sifre + sessiya ---------- */

async function pbkdf2(pw, salt) {
  const key = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: te.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return b64(bits);
}

function randHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(msg));
  return b64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makeSession(env, uid) {
  const exp = nowSec() + 60 * 60 * 24 * 30;
  const body = `${uid}.${exp}`;
  const sig = await hmac(env.SESSION_SECRET, body);
  return `${body}.${sig}`;
}

async function readSession(env, req) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)ks=([^;]+)/);
  if (!m) return null;
  const parts = decodeURIComponent(m[1]).split('.');
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  if (Number(exp) < nowSec()) return null;
  const good = await hmac(env.SESSION_SECRET, `${uid}.${exp}`);
  if (good !== sig) return null;
  const u = await env.DB.prepare('SELECT id,username,role FROM k_users WHERE id=?').bind(Number(uid)).first();
  if (!u) return null;
  if (!u.role) u.role = 'admin';        // ilk hesab hemise sahibdir
  return u;
}

function setCookie(val, days) {
  const age = days * 86400;
  return `ks=${encodeURIComponent(val)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}

/* ---------- baza qurulusu ---------- */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS k_users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT UNIQUE NOT NULL,
     salt TEXT NOT NULL,
     hash TEXT NOT NULL,
     created INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS k_settings (
     k TEXT PRIMARY KEY,
     v TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS k_cats (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     slug TEXT,
     parent_id INTEGER,
     icon TEXT,
     color TEXT,
     sort INTEGER DEFAULT 0,
     active INTEGER DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS k_brands (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     slug TEXT,
     sort INTEGER DEFAULT 0,
     active INTEGER DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS k_products (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     code TEXT,
     short TEXT,
     brand_id INTEGER,
     cat_id INTEGER,
     tone TEXT,
     price REAL,
     old_price REAL,
     show_price INTEGER DEFAULT 1,
     in_stock INTEGER DEFAULT 1,
     hidden INTEGER DEFAULT 0,
     badge TEXT,
     descr TEXT,
     usage TEXT,
     ingr TEXT,
     cover TEXT,
     sindex TEXT,
     views INTEGER DEFAULT 0,
     created INTEGER,
     updated INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS k_media (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     product_id INTEGER,
     kkey TEXT NOT NULL,
     sort INTEGER DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS k_branches (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     phone TEXT,
     phone2 TEXT,
     instagram TEXT,
     address TEXT,
     hours TEXT,
     map_url TEXT,
     sort INTEGER DEFAULT 0,
     active INTEGER DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS k_events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     type TEXT,
     ref TEXT,
     meta TEXT,
     ts INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS k_missing (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     code TEXT NOT NULL,
     note TEXT,
     who TEXT,
     done INTEGER DEFAULT 0,
     ts INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS k_ms_done ON k_missing(done)`,
  `CREATE TABLE IF NOT EXISTS k_suppliers (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT UNIQUE NOT NULL,
     phone TEXT,
     note TEXT,
     sort INTEGER DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS k_price_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     product_id INTEGER NOT NULL,
     old_price REAL,
     new_price REAL,
     who TEXT,
     ts INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS k_pl_prod ON k_price_log(product_id)`,
  `CREATE TABLE IF NOT EXISTS k_codes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     product_id INTEGER NOT NULL,
     code TEXT NOT NULL UNIQUE,
     created INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS k_c_prod ON k_codes(product_id)`,
  `CREATE TABLE IF NOT EXISTS k_tags (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT UNIQUE NOT NULL,
     slug TEXT,
     sort INTEGER DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS k_ptags (
     product_id INTEGER NOT NULL,
     tag_id INTEGER NOT NULL,
     PRIMARY KEY (product_id, tag_id)
   )`,
  `CREATE INDEX IF NOT EXISTS k_pt_tag ON k_ptags(tag_id)`,
  `CREATE INDEX IF NOT EXISTS k_p_cat ON k_products(cat_id)`,
  `CREATE INDEX IF NOT EXISTS k_p_brand ON k_products(brand_id)`,
  `CREATE INDEX IF NOT EXISTS k_p_code ON k_products(code)`,
  `CREATE INDEX IF NOT EXISTS k_p_short ON k_products(short)`,
  `CREATE INDEX IF NOT EXISTS k_m_prod ON k_media(product_id)`,
  `CREATE INDEX IF NOT EXISTS k_e_ts ON k_events(ts)`
];

/* Sonradan elave olunan sutunlar.
   Sutun artiq varsa ALTER xeta verir — onu udub davam edirik. */
const MIGRATIONS = [
  `ALTER TABLE k_products ADD COLUMN ucode TEXT`,
  `ALTER TABLE k_products ADD COLUMN model TEXT`,
  `ALTER TABLE k_products ADD COLUMN model_no TEXT`,
  `ALTER TABLE k_products ADD COLUMN color TEXT`,
  `ALTER TABLE k_products ADD COLUMN variant_of INTEGER`,
  `ALTER TABLE k_products ADD COLUMN variant_label TEXT`,
  `ALTER TABLE k_users ADD COLUMN role TEXT`,
  `ALTER TABLE k_products ADD COLUMN supplier_id INTEGER`,
  `ALTER TABLE k_products ADD COLUMN note TEXT`,
  `ALTER TABLE k_products ADD COLUMN ptype TEXT`,
  `ALTER TABLE k_products ADD COLUMN pno TEXT`,
  `ALTER TABLE k_codes ADD COLUMN label TEXT`,
  `ALTER TABLE k_codes ADD COLUMN warn INTEGER DEFAULT 0`,
  `ALTER TABLE k_codes ADD COLUMN warn_note TEXT`,
  `ALTER TABLE k_missing ADD COLUMN price REAL`,
  `ALTER TABLE k_missing ADD COLUMN made_id INTEGER`
];

async function ensureSchema(env) {
  for (const sql of SCHEMA) await env.DB.prepare(sql).run();
  for (const sql of MIGRATIONS) {
    try { await env.DB.prepare(sql).run(); } catch (e) { /* sutun onsuz da var */ }
  }
}

/* ---------- barkodlar ---------- */

async function codesOf(env, productId) {
  const r = await env.DB.prepare(
    'SELECT id, code, label, warn, warn_note FROM k_codes WHERE product_id=? ORDER BY id'
  ).bind(productId).all();
  return r.results || [];
}

/* Barkodu kim tutub? Bos qayidirsa — sərbəstdir. */
async function codeOwner(env, code) {
  const c = await env.DB.prepare(
    `SELECT k.product_id, p.name, p.cover
       FROM k_codes k JOIN k_products p ON p.id = k.product_id
      WHERE k.code = ?`
  ).bind(code).first();
  if (c) return c;
  /* kohne tek-barkod sutununda da axtaririq */
  const p = await env.DB.prepare(
    'SELECT id AS product_id, name, cover FROM k_products WHERE code=? LIMIT 1'
  ).bind(code).first();
  return p || null;
}

/* ---------- etiketler ---------- */

async function tagsOf(env, productId) {
  const r = await env.DB.prepare(
    `SELECT t.id, t.name FROM k_tags t
       JOIN k_ptags pt ON pt.tag_id = t.id
      WHERE pt.product_id = ? ORDER BY t.sort, t.name`
  ).bind(productId).all();
  return r.results || [];
}

/* Adlarin siyahisini alir, olmayanlari yaradir, mehsula baglayir. */
async function setTags(env, productId, names) {
  await env.DB.prepare('DELETE FROM k_ptags WHERE product_id=?').bind(productId).run();
  const list = (names || []).map(n => String(n).trim()).filter(Boolean).slice(0, 20);
  for (const name of list) {
    let t = await env.DB.prepare('SELECT id FROM k_tags WHERE name=?').bind(name).first();
    if (!t) {
      const r = await env.DB.prepare('INSERT INTO k_tags (name,slug,sort) VALUES (?,?,0)')
        .bind(name, slugify(name)).run();
      t = { id: r.meta.last_row_id };
    }
    await env.DB.prepare('INSERT OR IGNORE INTO k_ptags (product_id,tag_id) VALUES (?,?)')
      .bind(productId, t.id).run();
  }
}

const DEF_SETTINGS = {
  store_name: 'JOLLY',
  tagline: 'Kosmetika kataloqu',
  about: '',
  primary: '#6B2039',
  accent: '#C4425F'
};

async function getSettings(env) {
  const r = await env.DB.prepare('SELECT k,v FROM k_settings').all();
  const out = { ...DEF_SETTINGS };
  /* Bos deyer defolti ezmemelidir — reng xanasi bos qalanda sayt agarirdi */
  for (const row of (r.results || [])) {
    if (row.v !== null && String(row.v).trim() !== '') out[row.k] = row.v;
  }
  return out;
}


/* ==========================================================
   AI — Cloudflare Workers AI
   ⚠️ Model adlari YADDASDAN yazilmir. Bu siyahi 2026-08-28-de
   canli kataloqdan goturulub. Cavab vermeyen model olsa
   novbetiye kecir, hamisi cokerse ƏSL xetani qaytarir.
   ========================================================== */

const TEXT_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.2-3b-instruct'
];

const VISION_MODELS = [
  '@cf/meta/llama-3.2-11b-vision-instruct',
  '@cf/moondream/moondream3.1-9B-A2B',
  '@cf/llava-hf/llava-1.5-7b-hf'
];

function textOf(res) {
  if (!res) return '';
  if (typeof res === 'string') return res.trim();
  return String(res.response || res.result || res.text ||
    (res.choices && res.choices[0] && res.choices[0].message &&
     res.choices[0].message.content) || '').trim();
}

/* Modelleri novbe ile sinayir, her biri ucun iki format */
async function askModel(env, sys, user, maxTokens) {
  if (!env.AI) return { ok: false, error: 'AI baglantisi qurulmayib' };

  const errs = [];
  for (const model of TEXT_MODELS) {
    const tries = [
      { messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        max_tokens: maxTokens || 300 },
      { prompt: sys + '\n\n' + user, max_tokens: maxTokens || 300 }
    ];
    for (const body of tries) {
      try {
        const out = textOf(await env.AI.run(model, body));
        if (out) return { ok: true, text: out, model };
      } catch (e) {
        errs.push(model + ': ' + String(e && e.message || e).slice(0, 120));
      }
    }
  }
  return { ok: false, error: 'Model cavab vermedi', detail: errs.slice(0, 3) };
}

/* Sekilden metn oxuyur */
async function askVision(env, bytes, prompt) {
  if (!env.AI) return { ok: false, error: 'AI baglantisi qurulmayib' };

  const arr = Array.from(bytes);
  const b64img = b64(bytes);
  const errs = [];

  for (const model of VISION_MODELS) {
    const tries = [
      { messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64img } }
        ] }], max_tokens: 400 },
      { image: arr, prompt: prompt, max_tokens: 400 }
    ];
    for (const body of tries) {
      try {
        const out = textOf(await env.AI.run(model, body));
        if (out) return { ok: true, text: out, model };
      } catch (e) {
        errs.push(model + ': ' + String(e && e.message || e).slice(0, 120));
      }
    }
  }
  return { ok: false, error: 'Gorme modeli cavab vermedi', detail: errs.slice(0, 3) };
}

/* Magazanin YEKUN reqemleri — mal adlari GONDERILMIR */
async function storeStats(env) {
  const one = async (sql, ...a) => {
    const r = await env.DB.prepare(sql).bind(...a).first();
    return r ? r.n : 0;
  };

  const monthAgo = nowSec() - 30 * 86400;
  const weekAgo = nowSec() - 7 * 86400;

  return {
    cemi_mal: await one('SELECT COUNT(*) AS n FROM k_products'),
    gizli: await one('SELECT COUNT(*) AS n FROM k_products WHERE hidden=1'),
    bitmis: await one('SELECT COUNT(*) AS n FROM k_products WHERE in_stock=0'),
    barkodsuz: await one("SELECT COUNT(*) AS n FROM k_products WHERE code IS NULL OR code=''"),
    sekilsiz: await one("SELECT COUNT(*) AS n FROM k_products WHERE cover IS NULL OR cover=''"),
    qiymetsiz: await one('SELECT COUNT(*) AS n FROM k_products WHERE price IS NULL OR price=0'),
    bolmesiz: await one('SELECT COUNT(*) AS n FROM k_products WHERE cat_id IS NULL'),
    markasiz: await one('SELECT COUNT(*) AS n FROM k_products WHERE brand_id IS NULL'),
    tedarukcusuz: await one('SELECT COUNT(*) AS n FROM k_products WHERE supplier_id IS NULL'),
    bu_ay_elave: await one('SELECT COUNT(*) AS n FROM k_products WHERE created >= ?', monthAgo),
    bu_hefte_elave: await one('SELECT COUNT(*) AS n FROM k_products WHERE created >= ?', weekAgo),
    bolme_sayi: await one('SELECT COUNT(*) AS n FROM k_cats'),
    marka_sayi: await one('SELECT COUNT(*) AS n FROM k_brands'),
    tedarukcu_sayi: await one('SELECT COUNT(*) AS n FROM k_suppliers'),
    barkod_sayi: await one('SELECT COUNT(*) AS n FROM k_codes'),
    tapilmayan_barkod: await one('SELECT COUNT(*) AS n FROM k_missing WHERE done=0'),
    baxis_7gun: await one("SELECT COUNT(*) AS n FROM k_events WHERE type='view' AND ts >= ?", weekAgo),
    axtaris_7gun: await one("SELECT COUNT(*) AS n FROM k_events WHERE type='search' AND ts >= ?", weekAgo),
    neticesiz_axtaris_7gun: await one("SELECT COUNT(*) AS n FROM k_events WHERE type='noresult' AND ts >= ?", weekAgo)
  };
}


/* ==========================================================
   ICTIMAI AI AXTARIS
   Model sualdan suzgecleri cixarir, axtarisi BAZA ozu edir.
   Model cokerse sual duz axtaris kimi islenir — sistem dayanmir.
   ========================================================== */

async function aiFilters(env, q) {
  const sys =
    'Convert the shopping question to JSON filters. Reply ONLY with JSON, nothing else.\n' +
    '{"intent":"search","words":["keyword"],"max_price":null,"min_price":null,"in_stock":false,"color":"","sort":""}\n' +
    'intent = "count" if the question asks HOW MANY / totals / statistics; otherwise "search".\n' +
    'Rules: words = product keywords in the SAME language as the question, lowercase, max 4.\n' +
    'max_price/min_price = numbers only if the question mentions a price limit.\n' +
    'sort = "price_asc" for cheapest, "price_desc" for most expensive, "new" for newest, else "".\n' +
    'in_stock = true only if the question asks for available/in-stock items.\n' +
    'Azerbaijani hints: ucuz=cheap, baha=expensive, yeni=new, var=in stock, manat/AZN=price.';

  const r = await askModel(env, sys, q, 200);
  if (!r.ok) return { ok: false, error: r.error, detail: r.detail };

  const m = r.text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'Model suzgec qaytarmadi' };
  try {
    const f = JSON.parse(m[0]);
    return { ok: true, f, model: r.model };
  } catch (e) {
    return { ok: false, error: 'Suzgec oxunmadi' };
  }
}

/* Musteriye getmeli olan yekun reqemler — daxili hec ne yoxdur */
async function publicSummary(env) {
  const one = async (sql) => {
    const r = await env.DB.prepare(sql).first();
    return r ? r.n : 0;
  };
  const pr = await env.DB.prepare(
    'SELECT MIN(price) AS lo, MAX(price) AS hi FROM k_products WHERE hidden=0 AND show_price=1 AND price>0'
  ).first();

  return {
    mal: await one('SELECT COUNT(*) AS n FROM k_products WHERE hidden=0'),
    var_: await one('SELECT COUNT(*) AS n FROM k_products WHERE hidden=0 AND in_stock=1'),
    bitib: await one('SELECT COUNT(*) AS n FROM k_products WHERE hidden=0 AND in_stock=0'),
    bolme: await one('SELECT COUNT(*) AS n FROM k_cats WHERE active=1'),
    marka: await one('SELECT COUNT(*) AS n FROM k_brands WHERE active=1'),
    barkod: await one('SELECT COUNT(*) AS n FROM k_codes'),
    lo: pr && pr.lo != null ? pr.lo : null,
    hi: pr && pr.hi != null ? pr.hi : null
  };
}

const COUNT_RE = /neç[əe]|sayı|say[ıi]|cəmi|cemi|nə q[əe]d[əe]r|ne qeder|toplam|statistik/i;
function isCountQ(q) { return COUNT_RE.test(String(q || '')); }

function azMoney(v) {
  const n = Number(v || 0);
  return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
}

/* ---------- axtaris indeksi ---------- */

async function reindex(env, id) {
  const p = await env.DB.prepare(
    `SELECT p.*, b.name AS bname, c.name AS cname
       FROM k_products p
       LEFT JOIN k_brands b ON b.id = p.brand_id
       LEFT JOIN k_cats   c ON c.id = p.cat_id
      WHERE p.id = ?`
  ).bind(id).first();
  if (!p) return;
  const tg = await tagsOf(env, id);
  const cd = await codesOf(env, id);
  const bits = [p.name, p.code, p.short, p.ucode, p.model, p.model_no, p.color,
                p.ptype, p.pno, (p.ptype || '') + (p.pno || ''),
                cd.map(c => c.code + ' ' + (c.label || '')).join(' '),
                p.note,
                p.tone, p.bname, p.cname, p.descr, p.usage, p.ingr, p.badge,
                tg.map(t => t.name).join(' ')];
  const sindex = fold(bits.filter(Boolean).join(' '));
  await env.DB.prepare('UPDATE k_products SET sindex=? WHERE id=?').bind(sindex, id).run();
}

async function reindexAll(env) {
  const r = await env.DB.prepare('SELECT id FROM k_products').all();
  for (const row of (r.results || [])) await reindex(env, row.id);
  return (r.results || []).length;
}

/* sinonimler: AZ / RU / EN qarisigini tutmaq ucun */
const SYN = [
  ['ruj', 'pomada', 'lipstick', 'помада'],
  ['maskara', 'tus', 'mascara', 'тушь'],
  ['tonal', 'foundation', 'tonalnik', 'тональный'],
  ['enlik', 'blush', 'румяна'],
  ['kirpik', 'lash', 'ресницы'],
  ['qas', 'brow', 'брови'],
  ['dirnaq', 'nail', 'ногти'],
  ['lak', 'polish', 'лак'],
  ['etir', 'parfum', 'perfume', 'духи'],
  ['krem', 'cream', 'крем'],
  ['sac', 'hair', 'волосы'],
  ['pudra', 'powder', 'пудра'],
  ['serum', 'сыворотка'],
  ['maska', 'mask', 'маска'],
  ['sampun', 'shampoo', 'шампунь'],
  ['firca', 'brush', 'кисть'],
  ['sabun', 'soap', 'мыло'],
  ['gunes', 'spf', 'sunscreen'],
  ['dodaq', 'lip', 'губы'],
  ['goz', 'eye', 'глаза'],
  ['uz', 'face', 'лицо'],
  ['kolge', 'shadow', 'тени'],
  ['ayna', 'mirror', 'зеркало']
];

function expandQuery(q) {
  const base = fold(q);
  const words = base.split(' ').filter(Boolean);
  const out = new Set(words);
  for (const w of words) {
    for (const grp of SYN) {
      if (grp.includes(w)) grp.forEach(g => out.add(g));
    }
  }
  return Array.from(out);
}

/* ---------- hadise yazma ---------- */

async function track(env, type, ref, meta) {
  try {
    await env.DB.prepare('INSERT INTO k_events (type,ref,meta,ts) VALUES (?,?,?,?)')
      .bind(type, String(ref || ''), meta ? JSON.stringify(meta) : null, nowSec()).run();
  } catch (e) { /* izleme cokerse sayt dayanmamalidir */ }
}

/* ---------- mehsul JSON-u ---------- */

/* DIQQET: bu funksiya musteriye gedir.
   supplier_id, note, price_log — burada ASLA olmamalidir. */
function pubProduct(p, imgs) {
  const showPrice = p.show_price === null || p.show_price === undefined ? 1 : p.show_price;
  const o = {
    id: p.id,
    name: p.name,
    code: p.code || '',
    short: p.short || '',
    brand: p.bname || '',
    brand_id: p.brand_id || null,
    cat: p.cname || '',
    cat_id: p.cat_id || null,
    tone: p.tone || '',
    color: p.color || '',
    badge: p.badge || '',
    in_stock: p.in_stock ? 1 : 0,
    show_price: showPrice ? 1 : 0,
    cover: p.cover || '',
    images: imgs || []
  };
  if (showPrice) {
    o.price = p.price || 0;
    o.old_price = p.old_price || 0;
  }
  return o;
}

/* ==========================================================
   API
   ========================================================== */

async function api(req, env, url) {
  const path = url.pathname;
  const method = req.method;

  /* ---- ping: baglantilari yoxla ---- */
  if (path === '/api/ping') {
    const out = { ok: true, build: BUILD, DB: !!env.DB, BUCKET: !!env.BUCKET,
                  SECRET: !!env.SESSION_SECRET, ASSETS: !!env.ASSETS, AI: !!env.AI,
                  models: TEXT_MODELS.length + '+' + VISION_MODELS.length };
    try {
      await env.DB.prepare('SELECT 1').first();
      out.db_read = true;
    } catch (e) { out.db_read = false; out.db_error = String(e); }
    return J(out);
  }

  /* ---- setup ---- */
  if (path === '/api/setup') {
    if (!env.DB) return bad('DB baglantisi yoxdur', 500);
    if (!env.SESSION_SECRET) return bad('SESSION_SECRET yoxdur', 500);
    await ensureSchema(env);
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM k_users').first();
    const needed = !c || c.n === 0;

    if (method === 'GET') return J({ ok: true, needed, tables: 'hazir' });

    if (method === 'POST') {
      if (!needed) return bad('Hesab artiq var', 403);
      const b = await req.json().catch(() => ({}));
      const username = String(b.username || '').trim();
      const password = String(b.password || '');
      if (username.length < 3) return bad('Istifadeci adi en az 3 herf');
      if (password.length < 6) return bad('Sifre en az 6 simvol');
      const salt = randHex(16);
      const hash = await pbkdf2(password, salt);
      await env.DB.prepare('INSERT INTO k_users (username,salt,hash,created,role) VALUES (?,?,?,?,?)')
        .bind(username, salt, hash, nowSec(), 'admin').run();
      for (const [k, v] of Object.entries(DEF_SETTINGS)) {
        await env.DB.prepare('INSERT OR IGNORE INTO k_settings (k,v) VALUES (?,?)').bind(k, v).run();
      }
      const u = await env.DB.prepare('SELECT id FROM k_users WHERE username=?').bind(username).first();
      const s = await makeSession(env, u.id);
      return J({ ok: true }, 200, { 'set-cookie': setCookie(s, 30) });
    }
    return bad('Metod yanlisdir', 405);
  }

  /* ---- auth ---- */
  if (path === '/api/auth/login' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const u = await env.DB.prepare('SELECT * FROM k_users WHERE username=?')
      .bind(String(b.username || '').trim()).first();
    if (!u) return bad('Istifadeci adi ve ya sifre yanlisdir', 401);
    const h = await pbkdf2(String(b.password || ''), u.salt);
    if (h !== u.hash) return bad('Istifadeci adi ve ya sifre yanlisdir', 401);
    const s = await makeSession(env, u.id);
    return J({ ok: true, user: { id: u.id, username: u.username, role: u.role || 'admin' } },
             200, { 'set-cookie': setCookie(s, 30) });
  }

  if (path === '/api/auth/logout') {
    return J({ ok: true }, 200, { 'set-cookie': 'ks=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
  }

  if (path === '/api/auth/me') {
    const u = await readSession(env, req);
    return J({ ok: true, user: u ? { id: u.id, username: u.username, role: u.role } : null });
  }

  /* ---- ictimai: kataloq ---- */
  if (path === '/api/catalog' && method === 'GET') {
    const st = await getSettings(env);

    const cats = await env.DB.prepare(
      `SELECT c.id, c.name, c.slug, c.parent_id, c.icon, c.color, c.sort,
              (SELECT COUNT(*) FROM k_products p WHERE p.cat_id = c.id AND p.hidden = 0) AS n
         FROM k_cats c
        WHERE c.active = 1
        ORDER BY c.sort, c.name`
    ).all();

    const list = cats.results || [];
    /* valideynin sayina usaqlarin sayi da elave olunur */
    const byId = {};
    for (const row of list) byId[row.id] = row;
    for (const row of list) {
      if (row.parent_id && byId[row.parent_id]) byId[row.parent_id].n += row.n;
    }
    const tree = list.filter(r => !r.parent_id).map(r => ({
      ...r,
      children: list.filter(x => x.parent_id === r.id)
    }));

    const brands = await env.DB.prepare(
      `SELECT b.id, b.name, b.slug,
              (SELECT COUNT(*) FROM k_products p WHERE p.brand_id = b.id AND p.hidden = 0) AS n
         FROM k_brands b
        WHERE b.active = 1
        ORDER BY b.sort, b.name`
    ).all();

    const branches = await env.DB.prepare(
      'SELECT id,name,phone,phone2,instagram,address,hours,map_url FROM k_branches WHERE active=1 ORDER BY sort,id'
    ).all();

    const bl = (branches.results || []).map(row => ({ ...row, wa: waPhone(row.phone) }));

    const tones = await env.DB.prepare(
      `SELECT DISTINCT tone FROM k_products WHERE hidden=0 AND tone IS NOT NULL AND tone<>'' ORDER BY tone`
    ).all();

    const tags = await env.DB.prepare(
      `SELECT t.id, t.name,
              (SELECT COUNT(*) FROM k_ptags pt
                 JOIN k_products p ON p.id = pt.product_id
                WHERE pt.tag_id = t.id AND p.hidden = 0) AS n
         FROM k_tags t ORDER BY t.sort, t.name`
    ).all();

    const colors = await env.DB.prepare(
      `SELECT DISTINCT color FROM k_products WHERE hidden=0 AND color IS NOT NULL AND color<>'' ORDER BY color`
    ).all();

    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM k_products WHERE hidden=0').first();

    return J({
      ok: true,
      build: BUILD,
      store: st,
      cats: tree,
      brands: brands.results || [],
      branches: bl,
      tones: (tones.results || []).map(r => r.tone),
      colors: (colors.results || []).map(r => r.color),
      tags: (tags.results || []).filter(t => t.n > 0),
      badges: ['Yeni gəlib', 'Endirimdə', 'Hit'],
      total: total ? total.n : 0
    });
  }

  /* ---- ictimai: mehsul siyahisi ---- */
  if (path === '/api/products' && method === 'GET') {
    const q = url.searchParams.get('q') || '';
    const cat = url.searchParams.get('cat') || '';
    const brand = url.searchParams.get('brand') || '';
    const tone = url.searchParams.get('tone') || '';
    const color = url.searchParams.get('color') || '';
    const tag = url.searchParams.get('tag') || '';
    const badge = url.searchParams.get('badge') || '';
    const stock = url.searchParams.get('stock') || '';
    const sale = url.searchParams.get('sale') || '';
    const sort = url.searchParams.get('sort') || 'new';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const per = Math.min(48, Math.max(1, Number(url.searchParams.get('per') || 24)));

    const where = ['p.hidden = 0'];
    const args = [];

    if (cat) {
      /* valideyn secilibse usaqlar da daxildir */
      where.push('(p.cat_id = ? OR p.cat_id IN (SELECT id FROM k_cats WHERE parent_id = ?))');
      args.push(Number(cat), Number(cat));
    }
    if (brand) { where.push('p.brand_id = ?'); args.push(Number(brand)); }
    if (tone) { where.push('p.tone = ?'); args.push(tone); }
    if (color) { where.push('p.color = ?'); args.push(color); }
    if (tag) {
      where.push('p.id IN (SELECT product_id FROM k_ptags WHERE tag_id = ?)');
      args.push(Number(tag));
    }
    if (badge) { where.push('p.badge = ?'); args.push(badge); }
    if (stock === '1') where.push('p.in_stock = 1');
    if (sale === '1') where.push('(p.old_price IS NOT NULL AND p.old_price > p.price AND p.show_price = 1)');

    if (q) {
      const words = expandQuery(q);
      if (words.length) {
        const ors = words.map(() => 'p.sindex LIKE ?');
        where.push('(' + ors.join(' OR ') + ')');
        words.forEach(w => args.push('%' + w + '%'));
      }
      track(env, 'search', q, null);
    }

    let order = 'p.created DESC';
    if (sort === 'old') order = 'p.created ASC';
    if (sort === 'name') order = 'p.name ASC';
    if (sort === 'price_asc') order = 'CASE WHEN p.show_price=1 THEN p.price ELSE 999999 END ASC';
    if (sort === 'price_desc') order = 'CASE WHEN p.show_price=1 THEN p.price ELSE -1 END DESC';
    if (sort === 'popular') order = 'p.views DESC';

    const wsql = where.join(' AND ');

    const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM k_products p WHERE ${wsql}`)
      .bind(...args).first();

    const rows = await env.DB.prepare(
      `SELECT p.*, b.name AS bname, c.name AS cname,
              COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
         FROM k_products p
         LEFT JOIN k_brands b ON b.id = p.brand_id
         LEFT JOIN k_cats   c ON c.id = p.cat_id
        WHERE ${wsql}
        ORDER BY ${order}
        LIMIT ? OFFSET ?`
    ).bind(...args, per, (page - 1) * per).all();

    const items = (rows.results || []).map(row => pubProduct(row, null));
    const total = cnt ? cnt.n : 0;

    /* Barkodlari bir sorgu ile yigib kartlara paylayiriq —
       her kart ucun ayri sorgu telefonu yavaslatirdi. */
    if (items.length) {
      const ids = items.map(x => x.id);
      const qs2 = ids.map(() => '?').join(',');
      const cr = await env.DB.prepare(
        `SELECT product_id, code, label FROM k_codes
          WHERE product_id IN (${qs2}) ORDER BY id`
      ).bind(...ids).all();

      const byProd = {};
      for (const row of (cr.results || [])) {
        if (!byProd[row.product_id]) byProd[row.product_id] = [];
        byProd[row.product_id].push({ code: row.code, label: row.label || '' });
      }
      items.forEach(it => {
        const list = byProd[it.id] || [];
        /* esas barkod cedvelde yoxdursa onu da elave edirik */
        if (it.code && !list.some(c => c.code === it.code)) {
          list.unshift({ code: it.code, label: '' });
        }
        it.codes = list;
      });
    }

    if (q && total === 0) track(env, 'noresult', q, null);

    return J({ ok: true, items, total, page, per, more: page * per < total });
  }

  /* ---- ictimai: tek mehsul ---- */
  const mProd = path.match(/^\/api\/products\/(\d+)$/);
  if (mProd && method === 'GET') {
    const id = Number(mProd[1]);
    const p = await env.DB.prepare(
      `SELECT p.*, b.name AS bname, c.name AS cname,
              COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
         FROM k_products p
         LEFT JOIN k_brands b ON b.id = p.brand_id
         LEFT JOIN k_cats   c ON c.id = p.cat_id
        WHERE p.id = ? AND p.hidden = 0`
    ).bind(id).first();
    if (!p) return bad('Mehsul tapilmadi', 404);

    const im = await env.DB.prepare('SELECT kkey FROM k_media WHERE product_id=? ORDER BY sort,id').bind(id).all();
    const imgs = (im.results || []).map(r => r.kkey);

    const out = pubProduct(p, imgs);
    out.descr = p.descr || '';
    out.usage = p.usage || '';
    out.ingr = p.ingr || '';
    out.model = p.model || '';
    out.model_no = p.model_no || '';
    out.tags = (await tagsOf(env, id)).map(t => t.name);
    out.variant_label = p.variant_label || '';

    if (p.variant_of) {
      const vr = await env.DB.prepare(
        `SELECT p.id, p.name, p.variant_label, p.tone, p.color, p.in_stock,
                COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
           FROM k_products p
          WHERE p.hidden=0 AND p.variant_of=?
          ORDER BY p.variant_label, p.id`
      ).bind(p.variant_of).all();
      out.variants = (vr.results || []).map(v => ({
        id: v.id,
        label: v.variant_label || v.tone || v.color || v.name,
        cover: v.cover || '',
        in_stock: v.in_stock ? 1 : 0,
        current: v.id === id ? 1 : 0
      }));
      if (out.variants.length < 2) out.variants = [];
    }
    const cds = (await codesOf(env, id)).map(c => c.code);
    if (p.code && cds.indexOf(p.code) < 0) cds.unshift(p.code);
    out.codes = cds;

    /* oxsar: 1) eyni alt bolme 2) qonsu bolmeler 3) eyni marka */
    let sim = [];
    if (p.cat_id) {
      const r1 = await env.DB.prepare(
        `SELECT p.*, b.name AS bname, c.name AS cname,
                COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
           FROM k_products p
           LEFT JOIN k_brands b ON b.id=p.brand_id
           LEFT JOIN k_cats c ON c.id=p.cat_id
          WHERE p.hidden=0 AND p.cat_id=? AND p.id<>? ORDER BY p.views DESC LIMIT 8`
      ).bind(p.cat_id, id).all();
      sim = r1.results || [];
    }
    if (sim.length < 4 && p.brand_id) {
      const r2 = await env.DB.prepare(
        `SELECT p.*, b.name AS bname, c.name AS cname,
                COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
           FROM k_products p
           LEFT JOIN k_brands b ON b.id=p.brand_id
           LEFT JOIN k_cats c ON c.id=p.cat_id
          WHERE p.hidden=0 AND p.brand_id=? AND p.id<>? ORDER BY p.views DESC LIMIT 8`
      ).bind(p.brand_id, id).all();
      const have = new Set(sim.map(x => x.id));
      for (const row of (r2.results || [])) if (!have.has(row.id)) sim.push(row);
    }
    out.similar = sim.slice(0, 8).map(row => pubProduct(row, null));

    await env.DB.prepare('UPDATE k_products SET views = COALESCE(views,0)+1 WHERE id=?').bind(id).run();
    track(env, 'view', id, null);

    return J({ ok: true, item: out });
  }

  /* ---- KASSA: bir barkod, bir mal, dərhal ---- */
  if (path === '/api/scan' && method === 'GET') {
    const code = String(url.searchParams.get('code') || '').replace(/\s/g, '');
    if (!code) return bad('Barkod bos ola bilmez');

    const p = await env.DB.prepare(
      `SELECT p.*, b.name AS bname, c.name AS cname,
              COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
         FROM k_products p
         LEFT JOIN k_brands b ON b.id = p.brand_id
         LEFT JOIN k_cats   c ON c.id = p.cat_id
        WHERE p.hidden = 0 AND (
              p.code = ?
              OR p.id IN (SELECT product_id FROM k_codes WHERE code = ?)
            )
        LIMIT 1`
    ).bind(code, code).first();

    track(env, 'scan', code, null);

    if (!p) {
      const pend = await env.DB.prepare(
        'SELECT note, price, who, ts FROM k_missing WHERE code=? AND done=0'
      ).bind(code).first();
      return J({ ok: true, found: false, code, pending: pend || null });
    }

    const out = pubProduct(p, null);
    out.descr = p.descr || '';

    /* bu barkodun oz adi ve xeberdarligi */
    const c = await env.DB.prepare(
      'SELECT label, warn, warn_note FROM k_codes WHERE product_id=? AND code=?'
    ).bind(p.id, code).first();
    out.scanned = {
      code: code,
      label: c ? (c.label || '') : '',
      warn: c && c.warn ? 1 : 0,
      warn_note: c && c.warn ? (c.warn_note || '') : ''
    };

    const all = await codesOf(env, p.id);
    out.codes = all.map(x => ({ code: x.code, label: x.label || '' }));
    if (p.code && !out.codes.some(x => x.code === p.code)) {
      out.codes.unshift({ code: p.code, label: '' });
    }

    await env.DB.prepare('UPDATE k_products SET views = COALESCE(views,0)+1 WHERE id=?')
      .bind(p.id).run();

    return J({ ok: true, found: true, item: out });
  }

  /* ---- ICTIMAI AI AXTARIS ---- */
  if (path === '/api/ai' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const q = String(b.q || '').trim();
    if (!q) return bad('Sual bos ola bilmez');
    if (q.length > 300) return bad('Sual cox uzundur');

    /* Əvvəlki sual — "bunlardan ucuzu?" kimi davam sualları üçün */
    const prev = b.prev && typeof b.prev === 'object' ? b.prev : null;

    let f = null, model = '', aiErr = '';
    const got = await aiFilters(env, prev ? ('Əvvəlki sual: ' + String(prev.q || '') + '\nYeni sual: ' + q) : q);
    if (got.ok) { f = got.f; model = got.model; }
    else { aiErr = got.error || 'AI cavab vermedi'; }

    /* SAYMA sualidirsa reqemlerle cavab veririk */
    const isCount = (f && f.intent === 'count') ||
                    (!f && isCountQ(q)) ||
                    (f && (!f.words || !f.words.length) && isCountQ(q));

    if (isCount) {
      const sm = await publicSummary(env);
      let a = 'Kataloqda ' + sm.mal + ' mal var';
      if (sm.bitib) a += ', ' + sm.bitib + '-i hazırda bitib';
      a += '. ' + sm.bolme + ' bölmə, ' + sm.marka + ' marka';
      if (sm.barkod) a += ', ' + sm.barkod + ' barkod';
      a += '.';
      if (sm.lo != null && sm.hi != null && sm.lo !== sm.hi) {
        a += ' Qiymətlər ' + azMoney(sm.lo) + ' – ' + azMoney(sm.hi) + ' ₼ arasındadır.';
      }

      const nw = await env.DB.prepare(
        `SELECT p.*, b.name AS bname, c.name AS cname,
                COALESCE(NULLIF(p.cover,''),
                  (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
           FROM k_products p
           LEFT JOIN k_brands b ON b.id=p.brand_id
           LEFT JOIN k_cats c ON c.id=p.cat_id
          WHERE p.hidden=0 ORDER BY p.created DESC LIMIT 6`
      ).all();

      track(env, 'aisearch', q, null);
      return J({
        ok: true, answer: a, kind: 'count',
        items: (nw.results || []).map(row => pubProduct(row, null)),
        summary: sm, model: model || null, ai_error: aiErr || null
      });
    }

    /* Davam sualı sözsüz gəlirsə əvvəlki sözləri saxlayırıq */
    if (f && (!f.words || !f.words.length) && prev && Array.isArray(prev.words) && prev.words.length
        && !isCountQ(q)) {
      f.words = prev.words;
    }

    /* Model cokerse sualin ozu axtaris sozudur */
    let words = (f && Array.isArray(f.words) && f.words.length)
      ? f.words.map(w => fold(String(w))).filter(Boolean).slice(0, 4)
      : expandQuery(q).slice(0, 6);

    /* sinonimleri de acaq */
    const wide = new Set();
    words.forEach(w => expandQuery(w).forEach(x => wide.add(x)));
    words = Array.from(wide).slice(0, 10);

    const where = ['p.hidden = 0'];
    const args = [];

    if (words.length) {
      where.push('(' + words.map(() => 'p.sindex LIKE ?').join(' OR ') + ')');
      words.forEach(w => args.push('%' + w + '%'));
    }
    if (f && f.max_price != null && !isNaN(Number(f.max_price))) {
      where.push('p.show_price = 1 AND p.price IS NOT NULL AND p.price <= ?');
      args.push(Number(f.max_price));
    }
    if (f && f.min_price != null && !isNaN(Number(f.min_price))) {
      where.push('p.show_price = 1 AND p.price >= ?');
      args.push(Number(f.min_price));
    }
    if (f && f.in_stock) where.push('p.in_stock = 1');
    if (f && f.color) { where.push('p.color = ?'); args.push(String(f.color)); }

    let order = 'p.views DESC, p.created DESC';
    if (f && f.sort === 'price_asc') order = 'CASE WHEN p.show_price=1 THEN p.price ELSE 999999 END ASC';
    if (f && f.sort === 'price_desc') order = 'CASE WHEN p.show_price=1 THEN p.price ELSE -1 END DESC';
    if (f && f.sort === 'new') order = 'p.created DESC';

    const wsql = where.join(' AND ');
    const rows = await env.DB.prepare(
      `SELECT p.*, b.name AS bname, c.name AS cname,
              COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
         FROM k_products p
         LEFT JOIN k_brands b ON b.id = p.brand_id
         LEFT JOIN k_cats   c ON c.id = p.cat_id
        WHERE ${wsql}
        ORDER BY ${order}
        LIMIT 24`
    ).bind(...args).all();

    const items = (rows.results || []).map(row => pubProduct(row, null));

    /* Barkodlari da elave edek — kartlarda zolaq cixsin */
    if (items.length) {
      const ids = items.map(x => x.id);
      const qs3 = ids.map(() => '?').join(',');
      const cr = await env.DB.prepare(
        `SELECT product_id, code, label FROM k_codes WHERE product_id IN (${qs3}) ORDER BY id`
      ).bind(...ids).all();
      const by = {};
      for (const row of (cr.results || [])) {
        if (!by[row.product_id]) by[row.product_id] = [];
        by[row.product_id].push({ code: row.code, label: row.label || '' });
      }
      items.forEach(it => {
        const l = by[it.id] || [];
        if (it.code && !l.some(c => c.code === it.code)) l.unshift({ code: it.code, label: '' });
        it.codes = l;
      });
    }

    /* Cavab cumlesi BURADA qurulur — model uydura bilmesin */
    let answer;
    if (!items.length) {
      answer = 'Uyğun mal tapılmadı.';
      track(env, 'noresult', q, null);
    } else {
      const priced = items.filter(x => x.price);
      let extra = '';
      if (priced.length) {
        const min = Math.min.apply(null, priced.map(x => x.price));
        const max = Math.max.apply(null, priced.map(x => x.price));
        extra = min === max
          ? ' Qiyməti ' + azMoney(min) + ' ₼.'
          : ' Qiymətlər ' + azMoney(min) + ' – ' + azMoney(max) + ' ₼ arasındadır.';
      }
      const out = items.filter(x => !x.in_stock).length;
      const outTxt = out ? ' ' + out + '-i hazırda bitib.' : '';

      /* hansi bolmelerde oldugunu da deyek */
      const cats = [];
      items.forEach(x => { if (x.cat && cats.indexOf(x.cat) < 0) cats.push(x.cat); });
      const catTxt = cats.length && cats.length <= 3
        ? ' Bölmə: ' + cats.join(', ') + '.' : '';

      answer = items.length + ' mal tapıldı.' + extra + outTxt + catTxt;
    }

    track(env, 'aisearch', q, null);

    return J({
      ok: true, answer, items,
      filters: f || null,
      used_words: words,
      model: model || null,
      ai_error: aiErr || null
    });
  }

  /* ---- ICTIMAI barkod qovlugu ----
     Kassirler panele girmeden istifade edir.
     Daxili saheler (tedarukcu, qeyd, qiymet tarixcesi) BURADAN GETMIR. */

  if (path === '/api/codesearch' && method === 'GET') {
    const q = String(url.searchParams.get('q') || '').replace(/\s/g, '');
    if (q.length < 2) return J({ ok: true, items: [], q });

    const like = '%' + q + '%';
    const r = await env.DB.prepare(
      `SELECT k.code, k.label, k.warn, k.warn_note,
              p.id AS product_id, p.name, p.price, p.show_price, p.in_stock,
              COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
         FROM k_codes k JOIN k_products p ON p.id = k.product_id
        WHERE k.code LIKE ? AND p.hidden = 0
        ORDER BY CASE WHEN k.code = ? THEN 0
                      WHEN k.code LIKE ? THEN 1 ELSE 2 END, k.code
        LIMIT 30`
    ).bind(like, q, q + '%').all();

    const items = (r.results || []).map(x => ({
      code: x.code, label: x.label || '',
      warn: x.warn ? 1 : 0, warn_note: x.warn ? (x.warn_note || '') : '',
      id: x.product_id, name: x.name, cover: x.cover || '',
      price: x.show_price ? x.price : null,
      in_stock: x.in_stock ? 1 : 0
    }));

    const r2 = await env.DB.prepare(
      `SELECT p.id, p.name, p.code, p.price, p.show_price, p.in_stock,
              COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
         FROM k_products p
        WHERE p.code LIKE ? AND p.hidden = 0
          AND p.id NOT IN (SELECT product_id FROM k_codes WHERE code LIKE ?)
        LIMIT 15`
    ).bind(like, like).all();

    for (const x of (r2.results || [])) {
      if (items.some(i => i.code === x.code)) continue;
      items.push({
        code: x.code, label: '', warn: 0, warn_note: '',
        id: x.id, name: x.name, cover: x.cover || '',
        price: x.show_price ? x.price : null,
        in_stock: x.in_stock ? 1 : 0
      });
    }

    if (!items.length) track(env, 'nocode', q, null);
    return J({ ok: true, items, q });
  }

  /* Tap / Yarat — tapilmayan barkod DERHAL yaranir, forma yoxdur */
  if (path === '/api/missing/quick' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const code = String(b.code || '').replace(/\D/g, '');
    if (!/^[0-9]{4,20}$/.test(code)) return bad('Barkod 4-20 reqem olmalidir');

    const owner = await codeOwner(env, code);
    if (owner) {
      return J({ ok: true, exists: true, id: owner.product_id, name: owner.name });
    }

    const ex = await env.DB.prepare(
      'SELECT id FROM k_missing WHERE code=? AND done=0'
    ).bind(code).first();
    if (ex) return J({ ok: true, already: true, id: ex.id });

    const r = await env.DB.prepare(
      'INSERT INTO k_missing (code,note,price,who,done,ts) VALUES (?,?,?,?,0,?)'
    ).bind(code, '', null,
           String(b.who || '').slice(0, 40) || (b.source === 'scan' ? 'skan' : 'kassa'),
           nowSec()).run();

    return J({ ok: true, created: true, id: r.meta.last_row_id, code });
  }

  /* Yaradilanin adini yaz — girissiz, cunki kassir yazacaq */
  if (path === '/api/missing/rename' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const id = Number(b.id || 0);
    if (!id) return bad('Secilmeyib');
    await env.DB.prepare('UPDATE k_missing SET note=?, price=? WHERE id=? AND done=0')
      .bind(String(b.note || '').slice(0, 200),
            b.price === '' || b.price == null ? null : Number(b.price), id).run();
    return J({ ok: true });
  }

  if (path === '/api/missing' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const code = String(b.code || '').replace(/\s/g, '');
    if (!/^[0-9]{4,20}$/.test(code)) return bad('Barkod 4-20 reqem olmalidir');

    const note = String(b.note || '').slice(0, 200);
    const who = String(b.who || '').slice(0, 40) || 'kassa';
    const price = b.price === '' || b.price == null ? null : Number(b.price);

    const owner = await codeOwner(env, code);
    if (owner) return J({ ok: true, exists: true, name: owner.name, id: owner.product_id });

    const ex = await env.DB.prepare(
      'SELECT id FROM k_missing WHERE code=? AND done=0'
    ).bind(code).first();
    if (ex) {
      if (note || price != null) {
        await env.DB.prepare('UPDATE k_missing SET note=?, price=?, ts=? WHERE id=?')
          .bind(note, price, nowSec(), ex.id).run();
      }
      return J({ ok: true, id: ex.id, already: true });
    }

    const r = await env.DB.prepare(
      'INSERT INTO k_missing (code,note,price,who,done,ts) VALUES (?,?,?,?,0,?)'
    ).bind(code, note, price, who, nowSec()).run();
    return J({ ok: true, id: r.meta.last_row_id });
  }

  if (path === '/api/missing' && method === 'GET') {
    const r = await env.DB.prepare(
      'SELECT id, code, note, price, who, ts FROM k_missing WHERE done=0 ORDER BY ts DESC LIMIT 60'
    ).all();
    return J({ ok: true, items: r.results || [] });
  }

  /* ---- sekil ---- */
  const mImg = path.match(/^\/api\/img\/(.+)$/);
  if (mImg && method === 'GET') {
    if (!env.BUCKET) return new Response('BUCKET yoxdur', { status: 500 });

    /* Acar hem duz (k/123.jpg), hem de kodlanmis (k%2F123.jpg) gele biler */
    const raw = mImg[1];
    let obj = await env.BUCKET.get(raw);
    if (!obj) {
      try {
        const dec = decodeURIComponent(raw);
        if (dec !== raw) obj = await env.BUCKET.get(dec);
      } catch (e) { /* yanlis kodlasma */ }
    }
    if (!obj) return new Response('Tapilmadi', { status: 404 });

    return new Response(obj.body, {
      headers: {
        'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
        'cache-control': 'public, max-age=31536000, immutable',
        'etag': obj.httpEtag || ''
      }
    });
  }

  /* ---- izleme ---- */
  if (path === '/api/track' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    await track(env, String(b.type || 'x'), b.ref, b.meta || null);
    return J({ ok: true });
  }

  /* ================= ADMIN ================= */
  if (path.startsWith('/api/admin/')) {
    const me = await readSession(env, req);
    if (!me) return bad('Giris lazimdir', 401);

    const boss = me.role === 'admin';

    /* Isciye baglidir: ayarlar, istifadeciler, silme, ehtiyat nusxe */
    const bossOnly =
      (path === '/api/admin/store' && method === 'POST') ||
      path.startsWith('/api/admin/users') ||
      path === '/api/admin/backup' ||
      (path === '/api/admin/product' && method === 'DELETE') ||
      (path === '/api/admin/cat' && method === 'DELETE') ||
      (path === '/api/admin/brand' && method === 'DELETE') ||
      (path === '/api/admin/branch' && method === 'DELETE');

    if (bossOnly && !boss) return bad('Bu emeliyyat ucun icaze yoxdur', 403);

    /* --- statistika --- */
    if (path === '/api/admin/stats' && method === 'GET') {
      const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 7)));
      const from = nowSec() - days * 86400;
      const p = await env.DB.prepare('SELECT COUNT(*) AS n FROM k_products').first();
      const ph = await env.DB.prepare('SELECT COUNT(*) AS n FROM k_products WHERE hidden=1').first();
      const noimg = await env.DB.prepare("SELECT COUNT(*) AS n FROM k_products WHERE cover IS NULL OR cover=''").first();
      const nocat = await env.DB.prepare('SELECT COUNT(*) AS n FROM k_products WHERE cat_id IS NULL').first();
      const ev = await env.DB.prepare(
        'SELECT type, COUNT(*) AS n FROM k_events WHERE ts>=? GROUP BY type'
      ).bind(from).all();
      const nores = await env.DB.prepare(
        "SELECT ref, COUNT(*) AS n FROM k_events WHERE type='noresult' AND ts>=? GROUP BY ref ORDER BY n DESC LIMIT 15"
      ).bind(from).all();
      const miss = await env.DB.prepare('SELECT COUNT(*) AS n FROM k_missing WHERE done=0').first();

      const top = await env.DB.prepare(
        'SELECT id,name,views FROM k_products WHERE hidden=0 ORDER BY views DESC LIMIT 10'
      ).all();
      return J({
        ok: true,
        products: p ? p.n : 0,
        hidden: ph ? ph.n : 0,
        no_image: noimg ? noimg.n : 0,
        no_cat: nocat ? nocat.n : 0,
        missing: miss ? miss.n : 0,
        last_backup: Number((await getSettings(env)).last_backup || 0),
        events: ev.results || [],
        noresult: nores.results || [],
        top: top.results || []
      });
    }

    /* --- taksonomiya (kateqoriya + marka) --- */
    if (path === '/api/admin/taxonomy' && method === 'GET') {
      const c = await env.DB.prepare('SELECT * FROM k_cats ORDER BY sort,name').all();
      const b = await env.DB.prepare('SELECT * FROM k_brands ORDER BY sort,name').all();
      const t = await env.DB.prepare('SELECT * FROM k_tags ORDER BY sort,name').all();
      const sp = await env.DB.prepare('SELECT * FROM k_suppliers ORDER BY sort,name').all();
      return J({ ok: true, cats: c.results || [], brands: b.results || [],
                 tags: t.results || [], suppliers: sp.results || [] });
    }

    if (path === '/api/admin/cat' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const name = String(b.name || '').trim();
      if (!name) return bad('Ad bos ola bilmez');
      if (b.id) {
        await env.DB.prepare('UPDATE k_cats SET name=?,slug=?,parent_id=?,icon=?,color=?,sort=?,active=? WHERE id=?')
          .bind(name, slugify(name), b.parent_id || null, b.icon || null, b.color || null,
                Number(b.sort || 0), b.active === 0 ? 0 : 1, Number(b.id)).run();
        return J({ ok: true, id: Number(b.id) });
      }
      const r = await env.DB.prepare(
        'INSERT INTO k_cats (name,slug,parent_id,icon,color,sort,active) VALUES (?,?,?,?,?,?,1)'
      ).bind(name, slugify(name), b.parent_id || null, b.icon || null, b.color || null, Number(b.sort || 0)).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }

    if (path === '/api/admin/cat' && method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      await env.DB.prepare('UPDATE k_products SET cat_id=NULL WHERE cat_id=?').bind(id).run();
      await env.DB.prepare('UPDATE k_cats SET parent_id=NULL WHERE parent_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM k_cats WHERE id=?').bind(id).run();
      return J({ ok: true });
    }

    if (path === '/api/admin/brand' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const name = String(b.name || '').trim();
      if (!name) return bad('Ad bos ola bilmez');
      if (b.id) {
        await env.DB.prepare('UPDATE k_brands SET name=?,slug=?,sort=?,active=? WHERE id=?')
          .bind(name, slugify(name), Number(b.sort || 0), b.active === 0 ? 0 : 1, Number(b.id)).run();
        return J({ ok: true, id: Number(b.id) });
      }
      const ex = await env.DB.prepare('SELECT id FROM k_brands WHERE name=?').bind(name).first();
      if (ex) return J({ ok: true, id: ex.id });
      const r = await env.DB.prepare('INSERT INTO k_brands (name,slug,sort,active) VALUES (?,?,?,1)')
        .bind(name, slugify(name), Number(b.sort || 0)).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }

    if (path === '/api/admin/brand' && method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      await env.DB.prepare('UPDATE k_products SET brand_id=NULL WHERE brand_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM k_brands WHERE id=?').bind(id).run();
      return J({ ok: true });
    }

    /* --- itmis sekil baglantilarini berpa edir --- */
    if (path === '/api/admin/repair-covers' && method === 'POST') {
      const rb = await req.json().catch(() => ({}));
      const b_reset_colors = rb.reset_colors ? 1 : 0;

      const rows = await env.DB.prepare(
        `SELECT p.id, (SELECT m.kkey FROM k_media m
                        WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1) AS first_key
           FROM k_products p
          WHERE (p.cover IS NULL OR p.cover = '')`
      ).all();

      let fixed = 0;
      for (const row of (rows.results || [])) {
        if (!row.first_key) continue;
        await env.DB.prepare('UPDATE k_products SET cover=? WHERE id=?')
          .bind(row.first_key, row.id).run();
        fixed++;
      }

      /* eyni sekilde itmis barkodu da geri qoyuruq */
      const cr = await env.DB.prepare(
        `SELECT p.id, (SELECT k.code FROM k_codes k
                        WHERE k.product_id = p.id ORDER BY k.id LIMIT 1) AS first_code
           FROM k_products p
          WHERE (p.code IS NULL OR p.code = '')`
      ).all();

      let codes = 0;
      for (const row of (cr.results || [])) {
        if (!row.first_code) continue;
        await env.DB.prepare('UPDATE k_products SET code=?, short=? WHERE id=?')
          .bind(row.first_code, String(row.first_code).slice(-4), row.id).run();
        codes++;
      }

      /* sehv teyin olunmus rengleri defolta qaytaririq */
      let colors = 0;
      if (b_reset_colors) {
        await env.DB.prepare("DELETE FROM k_settings WHERE k IN ('primary','accent')").run();
        colors = 1;
      }

      return J({ ok: true, fixed, codes, colors });
    }

    /* --- oxsar mal axtarisi: eyni seyi iki defe yazmamaq ucun --- */
    if (path === '/api/admin/similar' && method === 'GET') {
      const name = String(url.searchParams.get('name') || '').trim();
      const skip = Number(url.searchParams.get('skip') || 0);
      if (name.length < 3) return J({ ok: true, items: [] });

      const f = fold(name);
      const words = f.split(' ').filter(w => w.length >= 3);
      if (!words.length) return J({ ok: true, items: [] });

      const where = ['(' + words.map(() => 'p.sindex LIKE ?').join(' OR ') + ')'];
      const args = words.map(w => '%' + w + '%');
      if (skip) { where.push('p.id <> ?'); args.push(skip); }

      const r = await env.DB.prepare(
        `SELECT p.id, p.name, p.price, p.show_price, p.code, p.ucode, p.hidden,
                b.name AS bname,
                COALESCE(NULLIF(p.cover,''),
                  (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
           FROM k_products p LEFT JOIN k_brands b ON b.id = p.brand_id
          WHERE ${where.join(' AND ')}
          LIMIT 12`
      ).bind(...args).all();

      /* Ne qeder oxsardir — sozlerin uygunlugu ile olculur */
      const items = (r.results || []).map(x => {
        const of = fold(x.name);
        const ow = of.split(' ').filter(Boolean);
        let hit = 0;
        words.forEach(w => { if (of.indexOf(w) > -1) hit++; });
        const score = Math.round((hit / Math.max(words.length, ow.length)) * 100);
        return {
          id: x.id, name: x.name, brand: x.bname || '',
          price: x.show_price ? x.price : null,
          code: x.code || '', ucode: x.ucode || '',
          cover: x.cover || '', hidden: x.hidden ? 1 : 0,
          score: score
        };
      }).filter(x => x.score >= 50).sort((a, b) => b.score - a.score).slice(0, 6);

      return J({ ok: true, items });
    }

    /* --- eyni adli mallari tapir (toplu yoxlama) --- */
    if (path === '/api/admin/dupes' && method === 'GET') {
      const r = await env.DB.prepare(
        `SELECT LOWER(TRIM(name)) AS k, COUNT(*) AS n, GROUP_CONCAT(id) AS ids
           FROM k_products
          GROUP BY LOWER(TRIM(name))
         HAVING COUNT(*) > 1
          ORDER BY n DESC LIMIT 50`
      ).all();

      const groups = [];
      for (const g of (r.results || [])) {
        const ids = String(g.ids).split(',').map(Number);
        const qs4 = ids.map(() => '?').join(',');
        const rows = await env.DB.prepare(
          `SELECT p.id, p.name, p.price, p.show_price, p.code, p.created,
                  COALESCE(NULLIF(p.cover,''),
                    (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
             FROM k_products p WHERE p.id IN (${qs4}) ORDER BY p.created`
        ).bind(...ids).all();
        groups.push({ name: g.k, n: g.n, items: rows.results || [] });
      }

      /* eyni daxili kodu olanlar */
      const uc = await env.DB.prepare(
        `SELECT ucode, COUNT(*) AS n, GROUP_CONCAT(id) AS ids
           FROM k_products
          WHERE ucode IS NOT NULL AND ucode <> ''
          GROUP BY ucode HAVING COUNT(*) > 1 LIMIT 30`
      ).all();

      return J({
        ok: true,
        by_name: groups,
        by_ucode: (uc.results || []).map(x => ({
          ucode: x.ucode, n: x.n, ids: String(x.ids).split(',').map(Number)
        }))
      });
    }

    /* --- mehsulun sureti --- */
    if (path === '/api/admin/duplicate' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const src = Number(b.id || 0);
      if (!src) return bad('Mehsul secilmeyib');

      const p = await env.DB.prepare('SELECT * FROM k_products WHERE id=?').bind(src).first();
      if (!p) return bad('Mehsul tapilmadi', 404);

      const n = Number(b.count || 1);
      const count = Math.min(20, Math.max(1, n));
      const ts = nowSec();
      const made = [];

      /* Ayni qrupa baglanir: menbe ozu qrup basi olur */
      const group = p.variant_of || p.id;

      for (let i = 0; i < count; i++) {
        const label = Array.isArray(b.labels) ? String(b.labels[i] || '') : '';
        const name = String(b.name || p.name).trim() || p.name;

        const r = await env.DB.prepare(
          `INSERT INTO k_products
             (name,code,short,ucode,model,model_no,color,brand_id,cat_id,tone,price,old_price,
              show_price,in_stock,hidden,badge,descr,usage,ingr,cover,
              variant_of,variant_label,created,updated)
           VALUES (?,'','',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          name, p.ucode || '', p.model || '', p.model_no || '', label || p.color || '',
          p.brand_id, p.cat_id, label || p.tone || '',
          p.price, p.old_price, p.show_price, p.in_stock, p.hidden, p.badge || '',
          p.descr || '', p.usage || '', p.ingr || '', p.cover || '',
          group, label, ts, ts
        ).run();

        const nid = r.meta.last_row_id;
        const tg = await tagsOf(env, src);
        if (tg.length) await setTags(env, nid, tg.map(t => t.name));
        await reindex(env, nid);
        made.push({ id: nid, label: label });
      }

      /* menbe de qrupa yazilir ki, bir-birini gorsunler */
      if (!p.variant_of) {
        await env.DB.prepare('UPDATE k_products SET variant_of=? WHERE id=?').bind(group, src).run();
      }

      return J({ ok: true, made, group });
    }

    /* --- variant qrupunu qir --- */
    if (path === '/api/admin/unvariant' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      await env.DB.prepare('UPDATE k_products SET variant_of=NULL, variant_label=NULL WHERE id=?')
        .bind(Number(b.id)).run();
      return J({ ok: true });
    }

    /* --- istifadeciler --- */
    if (path === '/api/admin/users' && method === 'GET') {
      const r = await env.DB.prepare('SELECT id,username,role,created FROM k_users ORDER BY id').all();
      return J({ ok: true, items: (r.results || []).map(u => ({ ...u, role: u.role || 'admin' })) });
    }

    if (path === '/api/admin/users' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const username = String(b.username || '').trim();
      const password = String(b.password || '');
      const role = b.role === 'admin' ? 'admin' : 'isci';
      if (username.length < 3) return bad('Istifadeci adi en az 3 herf');
      if (password.length < 6) return bad('Sifre en az 6 simvol');
      const ex = await env.DB.prepare('SELECT id FROM k_users WHERE username=?').bind(username).first();
      if (ex) return bad('Bu ad artiq isledilib');
      const salt = randHex(16);
      const hash = await pbkdf2(password, salt);
      const r = await env.DB.prepare(
        'INSERT INTO k_users (username,salt,hash,created,role) VALUES (?,?,?,?,?)'
      ).bind(username, salt, hash, nowSec(), role).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }

    if (path === '/api/admin/users' && method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      if (id === me.id) return bad('Oz hesabini sile bilmezsen');
      const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM k_users WHERE role='admin' OR role IS NULL").first();
      const t = await env.DB.prepare('SELECT role FROM k_users WHERE id=?').bind(id).first();
      if (t && (!t.role || t.role === 'admin') && c && c.n <= 1) {
        return bad('Son sahib hesabi silinmez');
      }
      await env.DB.prepare('DELETE FROM k_users WHERE id=?').bind(id).run();
      return J({ ok: true });
    }

    /* --- barkodlar --- */

    /* Barkodu axtarir: kimdedir, yoxsa serbestdir. */
    if (path === '/api/admin/code/lookup' && method === 'GET') {
      const code = String(url.searchParams.get('code') || '').trim();
      if (!code) return bad('Barkod bos ola bilmez');
      const owner = await codeOwner(env, code);
      if (!owner) return J({ ok: true, found: false, code });

      /* eyni barkod bir nece malda isarelenibse hamisini gosterek */
      const all = await env.DB.prepare(
        `SELECT k.product_id, k.label, k.warn, k.warn_note, p.name, p.cover
           FROM k_codes k JOIN k_products p ON p.id = k.product_id
          WHERE k.code = ?`
      ).bind(code).all();

      return J({
        ok: true, found: true, code,
        product: { id: owner.product_id, name: owner.name, cover: owner.cover || '' },
        all: all.results || []
      });
    }

    if (path === '/api/admin/code' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const pid = Number(b.product_id || 0);
      const code = String(b.code || '').replace(/\s/g, '');
      if (!pid) return bad('Mehsul secilmeyib');
      if (!code) return bad('Barkod bos ola bilmez');
      if (!/^[0-9]{4,20}$/.test(code)) return bad('Barkod yalniz reqem olmalidir (4-20)');

      const owner = await codeOwner(env, code);
      if (owner && Number(owner.product_id) !== pid) {
        return J({
          ok: false,
          error: 'Bu barkod başqa malda var',
          taken_by: { id: owner.product_id, name: owner.name }
        }, 409);
      }

      if (owner && Number(owner.product_id) === pid) {
        return J({ ok: true, already: true });
      }

      const r = await env.DB.prepare(
        'INSERT INTO k_codes (product_id,code,label,warn,warn_note,created) VALUES (?,?,?,?,?,?)'
      ).bind(pid, code, String(b.label || ''), b.warn ? 1 : 0,
             String(b.warn_note || ''), nowSec()).run();

      /* ilk barkoddursa esas sutuna da yazilir — /p/ linki ondan islerir */
      const p = await env.DB.prepare('SELECT code FROM k_products WHERE id=?').bind(pid).first();
      if (p && !p.code) {
        await env.DB.prepare('UPDATE k_products SET code=?, short=? WHERE id=?')
          .bind(code, code.slice(-4), pid).run();
      }
      await reindex(env, pid);
      return J({ ok: true, id: r.meta.last_row_id, code });
    }

    if (path === '/api/admin/code/edit' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const cid = Number(b.id || 0);
      if (!cid) return bad('Barkod secilmeyib');
      await env.DB.prepare(
        'UPDATE k_codes SET label=?, warn=?, warn_note=? WHERE id=?'
      ).bind(String(b.label || ''), b.warn ? 1 : 0, String(b.warn_note || ''), cid).run();
      const c = await env.DB.prepare('SELECT product_id FROM k_codes WHERE id=?').bind(cid).first();
      if (c) await reindex(env, c.product_id);
      return J({ ok: true });
    }

    if (path === '/api/admin/code' && method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      const c = await env.DB.prepare('SELECT * FROM k_codes WHERE id=?').bind(id).first();
      if (!c) return bad('Tapilmadi', 404);
      await env.DB.prepare('DELETE FROM k_codes WHERE id=?').bind(id).run();

      const p = await env.DB.prepare('SELECT code FROM k_products WHERE id=?').bind(c.product_id).first();
      if (p && p.code === c.code) {
        const nx = await env.DB.prepare(
          'SELECT code FROM k_codes WHERE product_id=? ORDER BY id LIMIT 1'
        ).bind(c.product_id).first();
        await env.DB.prepare('UPDATE k_products SET code=?, short=? WHERE id=?')
          .bind(nx ? nx.code : '', nx ? nx.code.slice(-4) : '', c.product_id).run();
      }
      await reindex(env, c.product_id);
      return J({ ok: true });
    }

    /* --- AI: anbar haqqinda sual-cavab --- */
    if (path === '/api/admin/ai/ask' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const q = String(b.q || '').trim();
      if (!q) return bad('Sual bos ola bilmez');
      if (q.length > 400) return bad('Sual cox uzundur');

      const st = await storeStats(env);
      const health = st.cemi_mal
        ? Math.round(((st.cemi_mal - st.sekilsiz) / st.cemi_mal) * 100) : 0;

      const sys =
        'Sen JOLLY adli magaza kataloqunun komekcisen. Azerbaycan dilinde cavab ver.\n' +
        'QAYDALAR:\n' +
        '1. YALNIZ asagidaki JSON-dakı reqemlerden istifade et.\n' +
        '2. Her cavabda en azi bir reqem olsun.\n' +
        '3. Yer, mal, firma adi UYDURMA — JSON-da yoxdursa deme.\n' +
        '4. Ozunu teqdim etme, salamlasma.\n' +
        '5. En coxu 3 cumle.\n' +
        '6. Cavablandirila bilmirse yalniz bunu yaz: Bu melumat sistemde yoxdur.\n\n' +
        'SAHELERIN MENASI: cemi_mal butun mallar; sekilsiz sekli olmayan; barkodsuz barkodu olmayan; ' +
        'tapilmayan_barkod kassada vurulub tapilmayan; baxis_7gun son 7 gunde mehsul baxisi.\n' +
        'NUMUNE: "Kataloqda 40 mal var, 3-u sekilsizdir. Son heftede 12 baxis olub."';

      const user = 'MAGAZA REQEMLERI:\n' +
        JSON.stringify({ ...st, sekil_faizi: health }) +
        '\n\nSUAL: ' + q;

      const r = await askModel(env, sys, user, 260);
      if (!r.ok) return J({ ok: false, error: r.error, detail: r.detail || [] }, 502);

      return J({ ok: true, answer: r.text, model: r.model, stats: st });
    }

    /* --- AI: NƏ SİFARİŞ EDİM ---
       Baxis, skan ve neticesiz axtarislari birlesdirir. */
    if (path === '/api/admin/ai/insights' && method === 'GET') {
      const days = Math.min(90, Math.max(7, Number(url.searchParams.get('days') || 30)));
      const from = nowSec() - days * 86400;

      /* Bitib, amma soruşulur */
      const wanted = await env.DB.prepare(
        `SELECT p.id, p.name, p.price, p.show_price, p.views,
                (SELECT COUNT(*) FROM k_events e
                  WHERE e.type IN ('view','scan') AND e.ts >= ?
                    AND (e.ref = CAST(p.id AS TEXT) OR e.ref = p.code)) AS soruldu
           FROM k_products p
          WHERE p.hidden = 0 AND p.in_stock = 0
          ORDER BY soruldu DESC, p.views DESC
          LIMIT 12`
      ).bind(from).all();

      /* Axtarilib tapilmayan sozler */
      const nores = await env.DB.prepare(
        `SELECT ref AS soz, COUNT(*) AS n FROM k_events
          WHERE type = 'noresult' AND ts >= ?
          GROUP BY ref ORDER BY n DESC LIMIT 15`
      ).bind(from).all();

      /* Oxudulub tapilmayan barkodlar */
      const nocode = await env.DB.prepare(
        `SELECT code, note, price, who, ts FROM k_missing
          WHERE done = 0 ORDER BY ts DESC LIMIT 15`
      ).all();

      /* Hec baxilmayan mallar — vitrinde itib qalanlar */
      const cold = await env.DB.prepare(
        `SELECT id, name, created FROM k_products
          WHERE hidden = 0 AND COALESCE(views,0) = 0 AND created < ?
          ORDER BY created LIMIT 10`
      ).bind(nowSec() - 14 * 86400).all();

      /* En cox baxilanlar — nesi isleyir */
      const hot = await env.DB.prepare(
        `SELECT id, name, views, in_stock FROM k_products
          WHERE hidden = 0 AND COALESCE(views,0) > 0
          ORDER BY views DESC LIMIT 8`
      ).all();

      const data = {
        gun: days,
        bitib_amma_sorulur: (wanted.results || []).filter(x => x.soruldu > 0 || x.views > 0),
        tapilmayan_sozler: nores.results || [],
        tapilmayan_barkodlar: nocode.results || [],
        hec_baxilmayan: cold.results || [],
        en_cox_baxilan: hot.results || []
      };

      /* Model yalniz serh yazir — reqemleri biz veririk */
      const sys =
        'Sen magaza sahibinin komekcisisen. Azerbaycan dilinde yaz.\n' +
        'QAYDALAR: 1) Yalniz verilen JSON-dakı adlar ve reqemlerden istifade et. ' +
        '2) UYDURMA ad yazma. 3) 4 cumleden cox yazma. ' +
        '4) Konkret tovsiye ver: neyi sifaris etsin, neyi duzeltsin. ' +
        '5) Ozunu teqdim etme.\n' +
        'JSON izahi: bitib_amma_sorulur = stokda yoxdur amma musteri soruşub; ' +
        'tapilmayan_sozler = axtarilib netice cixmayib; ' +
        'tapilmayan_barkodlar = kassada vurulub bazada yoxdur; ' +
        'hec_baxilmayan = 2 hefteden coxdur, heç kim baxmayib.';

      const r = await askModel(env, sys, JSON.stringify(data), 320);

      return J({
        ok: true,
        data,
        comment: r.ok ? r.text : null,
        model: r.ok ? r.model : null,
        ai_error: r.ok ? null : (r.error || 'AI cavab vermedi')
      });
    }

    /* --- AI: etiketden metn oxumaq --- */
    if (path === '/api/admin/ai/ocr' && method === 'POST') {
      const ct = req.headers.get('content-type') || '';
      let bytes;
      try {
        if (ct.includes('application/json')) {
          const b = await req.json().catch(() => ({}));
          const m = String(b.data || '').match(/^data:([^;]+);base64,(.*)$/);
          if (!m) return bad('Sekil formati yanlisdir');
          const bin = atob(m[2]);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else {
          bytes = new Uint8Array(await req.arrayBuffer());
        }
      } catch (e) {
        return bad('Sekil oxunmadi: ' + String(e && e.message || e));
      }
      if (!bytes || !bytes.length) return bad('Sekil bosdur');
      if (bytes.length > 4 * 1024 * 1024) return bad('Sekil cox boyukdur (4 MB)');

      const prompt =
        'Read this product label. Reply ONLY with JSON, no other text:\n' +
        '{"name":"product name","brand":"brand name","code":"barcode digits or empty",' +
        '"color":"colour or empty","size":"size or empty"}\n' +
        'If a field is not visible use empty string.';

      const r = await askVision(env, bytes, prompt);
      if (!r.ok) return J({ ok: false, error: r.error, detail: r.detail || [] }, 502);

      /* Model bezen JSON-un etrafina metn yazir — icini cixaririq */
      let parsed = null;
      const m2 = r.text.match(/\{[\s\S]*\}/);
      if (m2) { try { parsed = JSON.parse(m2[0]); } catch (e) {} }

      return J({ ok: true, raw: r.text, fields: parsed, model: r.model });
    }

    /* --- AI: SEKILDEN MALI TANI ---
       Etiket deyil, malin ozunun sekli. Mövcud bölmələrdən birini secir. */
    if (path === '/api/admin/ai/identify' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const m3 = String(b.data || '').match(/^data:([^;]+);base64,(.*)$/);
      if (!m3) return bad('Sekil formati yanlisdir');

      let bytes;
      try {
        const bin = atob(m3[2]);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch (e) { return bad('Sekil oxunmadi'); }
      if (!bytes.length) return bad('Sekil bosdur');
      if (bytes.length > 4 * 1024 * 1024) return bad('Sekil cox boyukdur (4 MB)');

      /* Mövcud bölmə və markaları modelə veririk ki, uydurmasın */
      const cs = await env.DB.prepare('SELECT name FROM k_cats WHERE active=1 LIMIT 40').all();
      const bs = await env.DB.prepare('SELECT name FROM k_brands WHERE active=1 LIMIT 40').all();
      const catList = (cs.results || []).map(x => x.name);
      const brandList = (bs.results || []).map(x => x.name);

      const prompt =
        'Look at this product photo. Reply ONLY with JSON:\n' +
        '{"name":"short product name in Azerbaijani","kind":"what it is in Azerbaijani",' +
        '"category":"one from the list or empty","brand":"one from the list or empty",' +
        '"color":"colour in Azerbaijani or empty","confidence":"high|medium|low"}\n' +
        (catList.length ? 'Category list: ' + catList.join(', ') + '\n' : '') +
        (brandList.length ? 'Brand list: ' + brandList.join(', ') + '\n' : '') +
        'Use ONLY names from the lists. If unsure, use empty string. Do not invent brands.';

      const r = await askVision(env, bytes, prompt);
      if (!r.ok) return J({ ok: false, error: r.error, detail: r.detail || [] }, 502);

      let parsed = null;
      const jm = r.text.match(/\{[\s\S]*\}/);
      if (jm) { try { parsed = JSON.parse(jm[0]); } catch (e) {} }

      /* Model siyahidan kenar ad yazibsa atiriq */
      if (parsed) {
        if (parsed.category && catList.indexOf(parsed.category) < 0) parsed.category = '';
        if (parsed.brand && brandList.indexOf(parsed.brand) < 0) parsed.brand = '';
      }

      return J({ ok: true, raw: r.text, fields: parsed, model: r.model });
    }

    /* --- barkod qovlugu: yazdiqca axtarir --- */
    if (path === '/api/admin/codesearch' && method === 'GET') {
      const q = String(url.searchParams.get('q') || '').replace(/\s/g, '');
      if (q.length < 2) return J({ ok: true, items: [], q });

      const like = '%' + q + '%';
      const r = await env.DB.prepare(
        `SELECT k.id, k.code, k.label, k.warn, k.warn_note,
                p.id AS product_id, p.name, p.cover, p.price, p.show_price, p.in_stock
           FROM k_codes k JOIN k_products p ON p.id = k.product_id
          WHERE k.code LIKE ?
          ORDER BY CASE WHEN k.code = ? THEN 0
                        WHEN k.code LIKE ? THEN 1
                        ELSE 2 END, k.code
          LIMIT 40`
      ).bind(like, q, q + '%').all();

      /* esas sutunda olub cedvelde olmayanlar */
      const r2 = await env.DB.prepare(
        `SELECT id AS product_id, name, cover, code, price, show_price, in_stock
           FROM k_products
          WHERE code LIKE ? AND id NOT IN (SELECT product_id FROM k_codes WHERE code LIKE ?)
          LIMIT 20`
      ).bind(like, like).all();

      const items = (r.results || []).map(x => ({
        code: x.code, label: x.label || '', warn: x.warn ? 1 : 0, warn_note: x.warn_note || '',
        product_id: x.product_id, name: x.name, cover: x.cover || '',
        price: x.show_price ? x.price : null, in_stock: x.in_stock ? 1 : 0
      }));

      for (const x of (r2.results || [])) {
        if (items.some(i => i.code === x.code)) continue;
        items.push({
          code: x.code, label: '', warn: 0, warn_note: '',
          product_id: x.product_id, name: x.name, cover: x.cover || '',
          price: x.show_price ? x.price : null, in_stock: x.in_stock ? 1 : 0
        });
      }

      return J({ ok: true, items, q });
    }

    /* --- kassirin qeyd etdiyi tapilmayan barkodlar --- */
    if (path === '/api/admin/missing' && method === 'GET') {
      const done = url.searchParams.get('done') === '1' ? 1 : 0;
      const r = await env.DB.prepare(
        'SELECT * FROM k_missing WHERE done=? ORDER BY ts DESC LIMIT 200'
      ).bind(done).all();
      return J({ ok: true, items: r.results || [] });
    }

    if (path === '/api/admin/missing' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const code = String(b.code || '').replace(/\s/g, '');
      if (!code) return bad('Barkod bos ola bilmez');

      /* eyni barkod artiq gozleyirse tekrar yazmiriq */
      const ex = await env.DB.prepare(
        'SELECT id FROM k_missing WHERE code=? AND done=0'
      ).bind(code).first();
      if (ex) {
        if (b.note || b.price != null) {
          await env.DB.prepare('UPDATE k_missing SET note=?, price=?, ts=? WHERE id=?')
            .bind(String(b.note || ''),
                  b.price === '' || b.price == null ? null : Number(b.price),
                  nowSec(), ex.id).run();
        }
        return J({ ok: true, id: ex.id, already: true });
      }

      const r = await env.DB.prepare(
        'INSERT INTO k_missing (code,note,price,who,done,ts) VALUES (?,?,?,?,0,?)'
      ).bind(code, String(b.note || ''),
             b.price === '' || b.price == null ? null : Number(b.price),
             me.username, nowSec()).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }

    /* Qeyddən birbaşa mal yaradir */
    if (path === '/api/admin/missing/make' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const mid = Number(b.id || 0);
      const row = await env.DB.prepare('SELECT * FROM k_missing WHERE id=?').bind(mid).first();
      if (!row) return bad('Qeyd tapilmadi', 404);

      const ts = nowSec();
      const name = String(b.name || row.note || ('Barkod ' + row.code)).trim();
      const price = b.price != null ? Number(b.price) : (row.price != null ? row.price : null);

      const ins = await env.DB.prepare(
        `INSERT INTO k_products (name,code,short,price,show_price,in_stock,hidden,note,created,updated)
         VALUES (?,?,?,?,1,1,0,?,?,?)`
      ).bind(name, row.code, String(row.code).slice(-4), price,
             String(row.note || ''), ts, ts).run();

      const nid = ins.meta.last_row_id;
      try {
        await env.DB.prepare('INSERT INTO k_codes (product_id,code,created) VALUES (?,?,?)')
          .bind(nid, row.code, ts).run();
      } catch (e) { /* barkod basqasinda ola biler */ }

      await reindex(env, nid);
      await env.DB.prepare('UPDATE k_missing SET done=1, made_id=? WHERE id=?').bind(nid, mid).run();

      return J({ ok: true, id: nid });
    }

    /* Secilenlerin hamisini birden mehsula cevirir */
    if (path === '/api/admin/missing/bulkmake' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const ids = (b.ids || []).map(Number).filter(Boolean).slice(0, 100);
      if (!ids.length) return bad('Secim bosdur');

      const ts = nowSec();
      const made = [];
      for (const mid of ids) {
        const row = await env.DB.prepare('SELECT * FROM k_missing WHERE id=? AND done=0')
          .bind(mid).first();
        if (!row) continue;

        const name = String(row.note || '').trim() || ('Barkod ' + row.code);
        const ins = await env.DB.prepare(
          `INSERT INTO k_products (name,code,short,price,show_price,in_stock,hidden,created,updated)
           VALUES (?,?,?,?,1,1,0,?,?)`
        ).bind(name, row.code, String(row.code).slice(-4),
               row.price != null ? row.price : null, ts, ts).run();

        const nid = ins.meta.last_row_id;
        try {
          await env.DB.prepare('INSERT INTO k_codes (product_id,code,created) VALUES (?,?,?)')
            .bind(nid, row.code, ts).run();
        } catch (e) {}
        await reindex(env, nid);
        await env.DB.prepare('UPDATE k_missing SET done=1, made_id=? WHERE id=?')
          .bind(nid, mid).run();
        made.push({ id: nid, name: name, code: row.code });
      }
      return J({ ok: true, made, n: made.length });
    }

    /* Barkodun adini internetden tapmaga calisir */
    if (path === '/api/admin/barcode-lookup' && method === 'GET') {
      const code = String(url.searchParams.get('code') || '').replace(/\D/g, '');
      if (!code) return bad('Barkod bos ola bilmez');

      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 7000);
      try {
        const res = await fetch(
          'https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=product_name,brands',
          { signal: ctl.signal, headers: { 'user-agent': 'JOLLY-Vitrin/1.0' } }
        );
        clearTimeout(tm);
        if (!res.ok) return J({ ok: true, found: false, code });
        const d = await res.json();
        const pr = d && d.product;
        const title = pr && (pr.product_name || '').trim();
        if (!title) return J({ ok: true, found: false, code });
        return J({
          ok: true, found: true, code,
          title, brand: pr.brands ? String(pr.brands).split(',')[0].trim() : ''
        });
      } catch (e) {
        clearTimeout(tm);
        return J({ ok: true, found: false, code, error: String(e && e.message || e).slice(0, 80) });
      }
    }

    if (path === '/api/admin/missing/done' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      await env.DB.prepare('UPDATE k_missing SET done=1 WHERE id=?').bind(Number(b.id)).run();
      return J({ ok: true });
    }

    if (path === '/api/admin/missing' && method === 'DELETE') {
      if (!boss) return bad('Icaze yoxdur', 403);
      await env.DB.prepare('DELETE FROM k_missing WHERE id=?')
        .bind(Number(url.searchParams.get('id'))).run();
      return J({ ok: true });
    }

    /* --- tedarukculer --- */
    if (path === '/api/admin/suppliers' && method === 'GET') {
      const r = await env.DB.prepare('SELECT * FROM k_suppliers ORDER BY sort,name').all();
      return J({ ok: true, items: r.results || [] });
    }

    if (path === '/api/admin/supplier' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const name = String(b.name || '').trim();
      if (!name) return bad('Ad bos ola bilmez');
      if (b.id) {
        await env.DB.prepare('UPDATE k_suppliers SET name=?,phone=?,note=? WHERE id=?')
          .bind(name, String(b.phone || ''), String(b.note || ''), Number(b.id)).run();
        return J({ ok: true, id: Number(b.id) });
      }
      const ex = await env.DB.prepare('SELECT id FROM k_suppliers WHERE name=?').bind(name).first();
      if (ex) return J({ ok: true, id: ex.id });
      const r = await env.DB.prepare(
        'INSERT INTO k_suppliers (name,phone,note,sort) VALUES (?,?,?,0)'
      ).bind(name, String(b.phone || ''), String(b.note || '')).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }

    if (path === '/api/admin/supplier' && method === 'DELETE') {
      if (!boss) return bad('Icaze yoxdur', 403);
      const id = Number(url.searchParams.get('id'));
      await env.DB.prepare('UPDATE k_products SET supplier_id=NULL WHERE supplier_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM k_suppliers WHERE id=?').bind(id).run();
      return J({ ok: true });
    }

    /* --- qiymet tarixcesi --- */
    if (path.match(/^\/api\/admin\/pricelog\/\d+$/) && method === 'GET') {
      const pid = Number(path.split('/').pop());
      const r = await env.DB.prepare(
        'SELECT * FROM k_price_log WHERE product_id=? ORDER BY ts DESC, id DESC LIMIT 40'
      ).bind(pid).all();
      return J({ ok: true, items: r.results || [] });
    }

    /* --- etiketler --- */
    if (path === '/api/admin/tag' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const name = String(b.name || '').trim();
      if (!name) return bad('Ad bos ola bilmez');
      const ex = await env.DB.prepare('SELECT id FROM k_tags WHERE name=?').bind(name).first();
      if (ex) return J({ ok: true, id: ex.id });
      const r = await env.DB.prepare('INSERT INTO k_tags (name,slug,sort) VALUES (?,?,0)')
        .bind(name, slugify(name)).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }

    if (path === '/api/admin/tag' && method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      await env.DB.prepare('DELETE FROM k_ptags WHERE tag_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM k_tags WHERE id=?').bind(id).run();
      return J({ ok: true });
    }

    /* --- filiallar --- */
    if (path === '/api/admin/branches' && method === 'GET') {
      const r = await env.DB.prepare('SELECT * FROM k_branches ORDER BY sort,id').all();
      return J({ ok: true, items: r.results || [] });
    }

    if (path === '/api/admin/branch' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const name = String(b.name || '').trim();
      if (!name) return bad('Ad bos ola bilmez');
      const vals = [name, b.phone || '', b.phone2 || '', b.instagram || '', b.address || '',
                    b.hours || '', b.map_url || '', Number(b.sort || 0), b.active === 0 ? 0 : 1];
      if (b.id) {
        await env.DB.prepare(
          'UPDATE k_branches SET name=?,phone=?,phone2=?,instagram=?,address=?,hours=?,map_url=?,sort=?,active=? WHERE id=?'
        ).bind(...vals, Number(b.id)).run();
        return J({ ok: true, id: Number(b.id) });
      }
      const r = await env.DB.prepare(
        'INSERT INTO k_branches (name,phone,phone2,instagram,address,hours,map_url,sort,active) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(...vals).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }

    if (path === '/api/admin/branch' && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM k_branches WHERE id=?').bind(Number(url.searchParams.get('id'))).run();
      return J({ ok: true });
    }

    /* --- magaza ayarlari --- */
    if (path === '/api/admin/store' && method === 'GET') {
      return J({ ok: true, store: await getSettings(env) });
    }
    if (path === '/api/admin/store' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      for (const [k, v] of Object.entries(b)) {
        await env.DB.prepare('INSERT INTO k_settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?')
          .bind(k, String(v), String(v)).run();
      }
      return J({ ok: true });
    }

    /* --- mehsul siyahisi (panel) --- */
    if (path === '/api/admin/products' && method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const miss = url.searchParams.get('miss') || '';
      const page = Math.max(1, Number(url.searchParams.get('page') || 1));
      const per = 30;
      const where = ['1=1'];
      const args = [];
      if (q) {
        const words = expandQuery(q);
        where.push('(' + words.map(() => 'p.sindex LIKE ?').join(' OR ') + ')');
        words.forEach(w => args.push('%' + w + '%'));
      }
      if (miss === 'image') where.push("(p.cover IS NULL OR p.cover='')");
      if (miss === 'code') where.push("(p.code IS NULL OR p.code='')");
      if (miss === 'cat') where.push('p.cat_id IS NULL');
      if (miss === 'brand') where.push('p.brand_id IS NULL');
      if (miss === 'price') where.push('(p.price IS NULL OR p.price=0)');
      if (miss === 'descr') where.push("(p.descr IS NULL OR p.descr='')");
      if (miss === 'hidden') where.push('p.hidden=1');
      const wsql = where.join(' AND ');
      const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM k_products p WHERE ${wsql}`).bind(...args).first();
      const rows = await env.DB.prepare(
        `SELECT p.*, b.name AS bname, c.name AS cname,
                COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
           FROM k_products p
           LEFT JOIN k_brands b ON b.id=p.brand_id
           LEFT JOIN k_cats c ON c.id=p.cat_id
          WHERE ${wsql} ORDER BY p.updated DESC LIMIT ? OFFSET ?`
      ).bind(...args, per, (page - 1) * per).all();
      return J({ ok: true, items: rows.results || [], total: cnt ? cnt.n : 0, page, per });
    }

    /* --- tek mehsul (panel, gizlilere de baxir) --- */
    const mA = path.match(/^\/api\/admin\/product\/(\d+)$/);
    if (mA && method === 'GET') {
      const id = Number(mA[1]);
      const p = await env.DB.prepare(
        `SELECT p.*, s.name AS supplier_name,
                COALESCE(NULLIF(p.cover,''),
                (SELECT m.kkey FROM k_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)) AS cover
           FROM k_products p LEFT JOIN k_suppliers s ON s.id = p.supplier_id
          WHERE p.id = ?`
      ).bind(id).first();
      if (!p) return bad('Tapilmadi', 404);
      const im = await env.DB.prepare('SELECT id,kkey,sort FROM k_media WHERE product_id=? ORDER BY sort,id').bind(id).all();
      const tg = await tagsOf(env, id);
      const cd = await codesOf(env, id);

      /* Karti bir defeye doldururuq — ayri-ayri sorgular telefonu yavaslatir */
      const sup = await env.DB.prepare('SELECT id,name FROM k_suppliers ORDER BY sort,name').all();
      const plog = await env.DB.prepare(
        'SELECT old_price,new_price,who,ts FROM k_price_log WHERE product_id=? ORDER BY ts DESC, id DESC LIMIT 20'
      ).bind(id).all();

      let variants = [];
      if (p.variant_of) {
        const vr = await env.DB.prepare(
          `SELECT id, name, variant_label, tone, color FROM k_products
            WHERE variant_of=? ORDER BY variant_label, id`
        ).bind(p.variant_of).all();
        variants = (vr.results || []).map(x => ({
          id: x.id,
          label: x.variant_label || x.tone || x.color || x.name,
          current: x.id === id ? 1 : 0
        }));
      }

      return J({
        ok: true, item: p, media: im.results || [],
        tags: tg.map(t => t.name), codes: cd,
        suppliers: sup.results || [],
        pricelog: plog.results || [],
        variants: variants
      });
    }

    /* --- mehsul yaz --- */
    if (path === '/api/admin/product' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const name = String(b.name || '').trim();
      if (!name) return bad('Ad bos ola bilmez');
      const code = String(b.code || '').trim();
      const short = code ? code.slice(-4) : '';
      const ts = nowSec();
      const vals = [
        name, code, short,
        String(b.ucode || ''),
        String(b.model || ''),
        String(b.model_no || ''),
        String(b.color || ''),
        b.brand_id ? Number(b.brand_id) : null,
        b.cat_id ? Number(b.cat_id) : null,
        String(b.tone || ''),
        b.price === '' || b.price == null ? null : Number(b.price),
        b.old_price === '' || b.old_price == null ? null : Number(b.old_price),
        b.show_price === 0 ? 0 : 1,
        b.in_stock === 0 ? 0 : 1,
        b.hidden === 1 ? 1 : 0,
        String(b.badge || ''),
        String(b.descr || ''),
        String(b.usage || ''),
        String(b.ingr || ''),
        String(b.cover || ''),
        b.variant_of ? Number(b.variant_of) : null,
        String(b.variant_label || ''),
        b.supplier_id ? Number(b.supplier_id) : null,
        String(b.note || ''),
        String(b.ptype || ''),
        String(b.pno || '')
      ];
      let id;
      if (b.id) {
        id = Number(b.id);
        const before = await env.DB.prepare('SELECT price FROM k_products WHERE id=?').bind(id).first();
        const np = b.price === '' || b.price == null ? null : Number(b.price);
        if (before && Number(before.price || 0) !== Number(np || 0)) {
          await env.DB.prepare(
            'INSERT INTO k_price_log (product_id,old_price,new_price,who,ts) VALUES (?,?,?,?,?)'
          ).bind(id, before.price, np, me.username, ts).run();
        }
        /* DIQQET: cover, code ve short bu formadan idare olunmur.
           Bos gelirse KOHNESI QALIR — evvel silinirdi. */
        await env.DB.prepare(
          `UPDATE k_products SET name=?,
                 code=COALESCE(NULLIF(?,''), code),
                 short=COALESCE(NULLIF(?,''), short),
                 ucode=?,model=?,model_no=?,color=?,
                 brand_id=?,cat_id=?,tone=?,price=?,old_price=?,
                 show_price=?,in_stock=?,hidden=?,badge=?,descr=?,usage=?,ingr=?,
                 cover=COALESCE(NULLIF(?,''), cover),
                 variant_of=?,variant_label=?,supplier_id=?,note=?,ptype=?,pno=?,updated=?
             WHERE id=?`
        ).bind(...vals, ts, id).run();
      } else {
        const r = await env.DB.prepare(
          `INSERT INTO k_products
             (name,code,short,ucode,model,model_no,color,brand_id,cat_id,tone,price,old_price,
              show_price,in_stock,hidden,badge,descr,usage,ingr,cover,
              variant_of,variant_label,supplier_id,note,ptype,pno,created,updated)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(...vals, ts, ts).run();
        id = r.meta.last_row_id;
      }
      if (Array.isArray(b.tags)) await setTags(env, id, b.tags);
      if (code) {
        try {
          await env.DB.prepare('INSERT OR IGNORE INTO k_codes (product_id,code,created) VALUES (?,?,?)')
            .bind(id, code, ts).run();
        } catch (e) { /* barkod basqasindadir — esas sutunda qalir */ }
      }
      await reindex(env, id);
      return J({ ok: true, id });
    }

    if (path === '/api/admin/product' && method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      const im = await env.DB.prepare('SELECT kkey FROM k_media WHERE product_id=?').bind(id).all();
      for (const row of (im.results || [])) {
        try { await env.BUCKET.delete(row.kkey); } catch (e) {}
      }
      await env.DB.prepare('DELETE FROM k_media WHERE product_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM k_ptags WHERE product_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM k_codes WHERE product_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM k_products WHERE id=?').bind(id).run();
      return J({ ok: true });
    }

    /* --- toplu emeliyyat --- */
    if (path === '/api/admin/bulk' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const ids = (b.ids || []).map(Number).filter(Boolean).slice(0, 200);
      if (!ids.length) return bad('Secim bosdur');
      const qs = ids.map(() => '?').join(',');
      const act = String(b.action || '');
      const ts = nowSec();
      if (act === 'price_show') await env.DB.prepare(`UPDATE k_products SET show_price=1,updated=? WHERE id IN (${qs})`).bind(ts, ...ids).run();
      else if (act === 'price_hide') await env.DB.prepare(`UPDATE k_products SET show_price=0,updated=? WHERE id IN (${qs})`).bind(ts, ...ids).run();
      else if (act === 'show') await env.DB.prepare(`UPDATE k_products SET hidden=0,updated=? WHERE id IN (${qs})`).bind(ts, ...ids).run();
      else if (act === 'hide') await env.DB.prepare(`UPDATE k_products SET hidden=1,updated=? WHERE id IN (${qs})`).bind(ts, ...ids).run();
      else if (act === 'stock_in') await env.DB.prepare(`UPDATE k_products SET in_stock=1,updated=? WHERE id IN (${qs})`).bind(ts, ...ids).run();
      else if (act === 'stock_out') await env.DB.prepare(`UPDATE k_products SET in_stock=0,updated=? WHERE id IN (${qs})`).bind(ts, ...ids).run();
      else if (act === 'set_cat') {
        await env.DB.prepare(`UPDATE k_products SET cat_id=?,updated=? WHERE id IN (${qs})`).bind(Number(b.value) || null, ts, ...ids).run();
        for (const id of ids) await reindex(env, id);
      } else if (act === 'set_brand') {
        await env.DB.prepare(`UPDATE k_products SET brand_id=?,updated=? WHERE id IN (${qs})`).bind(Number(b.value) || null, ts, ...ids).run();
        for (const id of ids) await reindex(env, id);
      } else if (act === 'delete') {
        if (!boss) return bad('Silmek ucun icaze yoxdur', 403);
        for (const id of ids) {
          const im = await env.DB.prepare('SELECT kkey FROM k_media WHERE product_id=?').bind(id).all();
          for (const row of (im.results || [])) { try { await env.BUCKET.delete(row.kkey); } catch (e) {} }
        }
        await env.DB.prepare(`DELETE FROM k_media WHERE product_id IN (${qs})`).bind(...ids).run();
        await env.DB.prepare(`DELETE FROM k_ptags WHERE product_id IN (${qs})`).bind(...ids).run();
        await env.DB.prepare(`DELETE FROM k_codes WHERE product_id IN (${qs})`).bind(...ids).run();
        await env.DB.prepare(`DELETE FROM k_products WHERE id IN (${qs})`).bind(...ids).run();
      } else return bad('Bilinmeyen emeliyyat');
      return J({ ok: true, n: ids.length });
    }

    /* --- sekil yukle --- */
    if (path === '/api/admin/upload' && method === 'POST') {
      if (!env.BUCKET) return bad('R2 baglantisi (BUCKET) yoxdur', 500);

      const ct = req.headers.get('content-type') || '';
      let bytes, type = 'image/jpeg', pid = 0;

      try {
        if (ct.includes('application/json')) {
          const b = await req.json().catch(() => ({}));
          const d = String(b.data || '');
          const m = d.match(/^data:([^;]+);base64,(.*)$/);
          if (!m) return bad('Sekil formati yanlisdir');
          type = m[1];
          const bin = atob(m[2]);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          pid = Number(b.product_id || 0);
        } else if (ct.includes('multipart/form-data')) {
          const fd = await req.formData();
          const f = fd.get('file');
          if (!f || typeof f.arrayBuffer !== 'function') return bad('Fayl yoxdur');
          bytes = new Uint8Array(await f.arrayBuffer());
          type = f.type || 'image/jpeg';
          pid = Number(fd.get('product_id') || 0);
        } else {
          /* XAM BAYT — en sade ve en etibarli yol.
             Faylin ozu govdede gelir, mehsul ?product= ile. */
          const buf = await req.arrayBuffer();
          bytes = new Uint8Array(buf);
          type = ct || 'image/jpeg';
          pid = Number(url.searchParams.get('product') || 0);
        }
      } catch (e) {
        return bad('Fayl oxunmadi: ' + String(e && e.message || e), 400);
      }

      if (!bytes || !bytes.length) return bad('Fayl bosdur');
      if (bytes.length > 12 * 1024 * 1024) return bad('Sekil cox boyukdur (12 MB limiti)');

      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      const key = `k/${nowSec()}-${randHex(6)}.${ext}`;

      try {
        await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
      } catch (e) {
        return bad('R2-ye yazilmadi: ' + String(e && e.message || e), 500);
      }

      if (pid) {
        try {
          await env.DB.prepare('INSERT INTO k_media (product_id,kkey,sort) VALUES (?,?,?)')
            .bind(pid, key, nowSec()).run();
          const p = await env.DB.prepare('SELECT cover FROM k_products WHERE id=?').bind(pid).first();
          if (p && !p.cover) {
            await env.DB.prepare('UPDATE k_products SET cover=? WHERE id=?').bind(key, pid).run();
          }
        } catch (e) {
          return bad('Baza yazilmadi: ' + String(e && e.message || e), 500);
        }
      }

      return J({ ok: true, key, size: bytes.length });
    }

    /* --- sekil sisteminin sagligini yoxlayir --- */
    if (path === '/api/admin/diag' && method === 'GET') {
      const out = { ok: true, bucket_bound: !!env.BUCKET };
      const key = `k/diag-${randHex(5)}.txt`;
      try {
        await env.BUCKET.put(key, new TextEncoder().encode('sinaq'));
        out.write = true;
        const got = await env.BUCKET.get(key);
        out.read = !!got;
        await env.BUCKET.delete(key);
        out.delete = true;
      } catch (e) {
        out.ok = false;
        out.error = String(e && e.message || e);
      }
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM k_media').first();
      out.media_rows = n ? n.n : 0;

      /* Sekil hansi mala baglidir, cover teyin olunubmu? */
      const rows = await env.DB.prepare(
        `SELECT m.id, m.product_id, m.kkey, p.name, p.cover
           FROM k_media m LEFT JOIN k_products p ON p.id = m.product_id
          ORDER BY m.id DESC LIMIT 10`
      ).all();
      out.media = (rows.results || []).map(r => ({
        product_id: r.product_id,
        product: r.name || '(mal tapilmadi)',
        key: r.kkey,
        is_cover: r.cover === r.kkey ? 1 : 0,
        cover_set: r.cover ? 1 : 0
      }));

      const noCover = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM k_products WHERE cover IS NULL OR cover=''"
      ).first();
      out.products_without_cover = noCover ? noCover.n : 0;

      const orphan = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM k_media WHERE product_id NOT IN (SELECT id FROM k_products)'
      ).first();
      out.orphan_media = orphan ? orphan.n : 0;

      return J(out);
    }

    /* --- sekil sil / esas sekil sec --- */
    if (path === '/api/admin/media' && method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      const m = await env.DB.prepare('SELECT * FROM k_media WHERE id=?').bind(id).first();
      if (!m) return bad('Tapilmadi', 404);
      try { await env.BUCKET.delete(m.kkey); } catch (e) {}
      await env.DB.prepare('DELETE FROM k_media WHERE id=?').bind(id).run();
      const p = await env.DB.prepare('SELECT cover FROM k_products WHERE id=?').bind(m.product_id).first();
      if (p && p.cover === m.kkey) {
        const nx = await env.DB.prepare('SELECT kkey FROM k_media WHERE product_id=? ORDER BY sort,id LIMIT 1')
          .bind(m.product_id).first();
        await env.DB.prepare('UPDATE k_products SET cover=? WHERE id=?')
          .bind(nx ? nx.kkey : '', m.product_id).run();
      }
      return J({ ok: true });
    }

    if (path === '/api/admin/cover' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      await env.DB.prepare('UPDATE k_products SET cover=? WHERE id=?')
        .bind(String(b.key || ''), Number(b.product_id)).run();
      return J({ ok: true });
    }

    /* --- CSV idxali --- */
    if (path === '/api/admin/import' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const rows = b.rows || [];
      if (!Array.isArray(rows) || !rows.length) return bad('Setir yoxdur');
      let added = 0, skipped = 0;
      const ts = nowSec();
      for (const r of rows.slice(0, 500)) {
        const name = String(r.ad || r.name || '').trim();
        if (!name) { skipped++; continue; }
        let brandId = null;
        const bn = String(r.marka || '').trim();
        if (bn) {
          const ex = await env.DB.prepare('SELECT id FROM k_brands WHERE name=?').bind(bn).first();
          if (ex) brandId = ex.id;
          else {
            const nr = await env.DB.prepare('INSERT INTO k_brands (name,slug,sort,active) VALUES (?,?,0,1)')
              .bind(bn, slugify(bn)).run();
            brandId = nr.meta.last_row_id;
          }
        }
        let catId = null;
        const cn = String(r.kateqoriya || '').trim();
        if (cn) {
          const ex = await env.DB.prepare('SELECT id FROM k_cats WHERE name=?').bind(cn).first();
          if (ex) catId = ex.id;
        }
        const code = String(r.kod || '').trim();
        const ins = await env.DB.prepare(
          `INSERT INTO k_products (name,code,short,brand_id,cat_id,tone,price,old_price,show_price,in_stock,hidden,descr,created,updated)
           VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?)`
        ).bind(
          name, code, code ? code.slice(-4) : '', brandId, catId,
          String(r.ton || ''),
          r.qiymet ? Number(r.qiymet) : null,
          r.kohne ? Number(r.kohne) : null,
          String(r.qiymet_gizli || '') === '1' ? 0 : 1,
          String(r.stok || '1') === '0' ? 0 : 1,
          String(r.tesvir || ''),
          ts, ts
        ).run();
        await reindex(env, ins.meta.last_row_id);
        added++;
      }
      return J({ ok: true, added, skipped });
    }

    /* --- axtaris indeksini yenile --- */
    if (path === '/api/admin/reindex' && method === 'POST') {
      const n = await reindexAll(env);
      return J({ ok: true, n });
    }

    /* --- ehtiyat nusxe --- */
    if (path === '/api/admin/backup' && method === 'GET') {
      const out = { v: 1, ts: nowSec() };
      for (const t of ['k_settings', 'k_cats', 'k_brands', 'k_products', 'k_media',
                       'k_branches', 'k_tags', 'k_ptags', 'k_codes',
                       'k_suppliers', 'k_missing']) {
        const r = await env.DB.prepare(`SELECT * FROM ${t}`).all();
        out[t] = r.results || [];
      }

      await env.DB.prepare(
        "INSERT INTO k_settings (k,v) VALUES ('last_backup',?) ON CONFLICT(k) DO UPDATE SET v=?"
      ).bind(String(nowSec()), String(nowSec())).run();
      return J(out, 200, { 'content-disposition': `attachment; filename="katalog-${nowSec()}.json"` });
    }

    /* --- nusxeni geri yukle --- */
    if (path === '/api/admin/restore' && method === 'POST') {
      if (!boss) return bad('Icaze yoxdur', 403);

      const b = await req.json().catch(() => ({}));
      if (!b || b.v !== 1) return bad('Fayl JOLLY nusxesi deyil');
      if (b.confirm !== 'SIL') return bad('Tesdiq sozu yanlisdir');

      const TABLES = ['k_settings','k_cats','k_brands','k_products','k_media',
                      'k_branches','k_tags','k_ptags','k_codes','k_suppliers','k_missing'];

      /* Nusxede ne varsa onu yaziriq; olmayan cedvele toxunmuruq */
      const report = {};
      for (const t of TABLES) {
        const rows = b[t];
        if (!Array.isArray(rows)) { report[t] = 'nusxede yoxdur'; continue; }

        try {
          await env.DB.prepare('DELETE FROM ' + t).run();
        } catch (e) {
          report[t] = 'temizlenmedi: ' + String(e && e.message || e).slice(0, 80);
          continue;
        }

        let n = 0;
        for (const row of rows) {
          const cols = Object.keys(row);
          if (!cols.length) continue;
          const qs = cols.map(() => '?').join(',');
          try {
            await env.DB.prepare(
              'INSERT OR REPLACE INTO ' + t + ' (' + cols.join(',') + ') VALUES (' + qs + ')'
            ).bind(...cols.map(c => row[c])).run();
            n++;
          } catch (e) { /* sutun uygun gelmeyen setir buraxilir */ }
        }
        report[t] = n + ' setir';
      }

      /* Hesablar nusxede yoxdur — girisi itirmemek ucun toxunulmur */
      await reindexAll(env);

      return J({ ok: true, report });
    }

    /* --- sifre deyis --- */
    if (path === '/api/admin/password' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const u = await env.DB.prepare('SELECT * FROM k_users WHERE id=?').bind(me.id).first();
      const old = await pbkdf2(String(b.old || ''), u.salt);
      if (old !== u.hash) return bad('Kohne sifre yanlisdir', 403);
      const np = String(b.pass || '');
      if (np.length < 6) return bad('Yeni sifre en az 6 simvol');
      const salt = randHex(16);
      const hash = await pbkdf2(np, salt);
      await env.DB.prepare('UPDATE k_users SET salt=?,hash=? WHERE id=?').bind(salt, hash, me.id).run();
      return J({ ok: true });
    }

    return bad('Marsrut tapilmadi', 404);
  }

  return bad('Marsrut tapilmadi', 404);
}

/* ==========================================================
   /p/<kod>  -> paylasma linki (WhatsApp-da sekilli gorunur)
   ========================================================== */

async function sharePage(req, env, url, code) {
  const c = decodeURIComponent(code).trim();
  const p = await env.DB.prepare(
    `SELECT p.*, b.name AS bname FROM k_products p
       LEFT JOIN k_brands b ON b.id=p.brand_id
      WHERE p.hidden=0 AND (
            p.code=? OR p.short=? OR CAST(p.id AS TEXT)=?
            OR p.id IN (SELECT product_id FROM k_codes WHERE code=?)
          )
      LIMIT 1`
  ).bind(c, c, c, c).first();

  if (!p) return Response.redirect(url.origin + '/', 302);

  const st = await getSettings(env);
  const title = `${p.name}${p.bname ? ' - ' + p.bname : ''}`;
  const desc = (p.descr || st.tagline || '').slice(0, 160);
  const img = p.cover ? `${url.origin}/api/img/${encodeURIComponent(p.cover)}` : '';
  const to = `${url.origin}/#/m/${p.id}`;

  const html = `<!doctype html><html lang="az"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ''}
<meta property="og:site_name" content="${esc(st.store_name)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(to)}">
</head><body style="font-family:system-ui;padding:24px;text-align:center">
<p>${esc(title)}</p>
<p><a href="${esc(to)}">Acilmirsa buraya toxun</a></p>
<script>location.replace(${JSON.stringify(to)});</script>
</body></html>`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/* ==========================================================
   giris noqtesi
   ========================================================== */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    try {
      if (url.pathname.startsWith('/api/')) {
        const res = await api(req, env, url);
        /* Sekiller uzun muddet kesde qalmalidir — no-store onlara aid deyil */
        if (!url.pathname.startsWith('/api/img/')) {
          res.headers.set('cache-control', 'no-store');
        }
        return res;
      }

      const mp = url.pathname.match(/^\/p\/(.+)$/);
      if (mp) return await sharePage(req, env, url, mp[1]);

      return env.ASSETS.fetch(req);
    } catch (e) {
      if (url.pathname.startsWith('/api/')) {
        return J({ ok: false, error: String(e && e.message || e) }, 500);
      }
      return new Response('Xeta: ' + String(e), { status: 500 });
    }
  }
};
