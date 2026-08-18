/* ============================================================
   YENİ İNVENTAR PROQRAMI — SERVER
   _worker.js  ·  repo KÖKÜNDƏ  ·  v1.0 (2026-08-11)

   ────────────────────────────────────────────────────────────
   NİYƏ BELƏ QURULUB

   1) TƏK FAYL, REPO KÖKÜNDƏ.
      Telefondan GitHub-da qovluq yaratmaq əziyyətlidir, ona görə
      `functions/api/[[path]].js` yox, kökdə `_worker.js`.
      Cloudflare Pages kökdə `_worker.js` görəndə BÜTÜN sorğuları
      bura göndərir — /api/ ilə başlamayan hər şeyi biz
      `env.ASSETS.fetch()` ilə saytın özünə qaytarırıq.

   2) CƏDVƏLLƏRİ SERVER QURUR.
      D1 konsolu bir dəfəyə BİR əmr qəbul edir və `--` şərhləri
      qəbul etmir — 14 cədvəli əl ilə yaratmaq telefonda əzabdır.
      Ona görə `POST /api/setup` hamısını özü yaradır və ilk
      admin hesabını açır.

   3) İCAZƏLƏR SERVERDƏDİR.
      Köhnə proqramın ən böyük dərdi: istifadəçi hər cihazda
      ayrıca yaranırdı, ona görə verilən icazə o biri telefona
      düşmürdü. İndi istifadəçi də, icazə də bazadadır —
      hansı cihazdan girsə, eyni nəticə.

   4) ŞƏKİLLƏR R2-DƏ.
      Telefon yaddaşı təmizlənəndə şəkil itmir.

   ────────────────────────────────────────────────────────────
   CLOUDFLARE AYARLARI (bir dəfə, Esqin əl ilə edir)
     Pages → Settings → Functions
       · D1 database binding:  DB    → (yaratdığın baza)
       · R2 bucket binding:    MEDIA → (yaratdığın bucket)
     Pages → Settings → Environment variables → Secret
       · SESSION_SECRET → uzun təsadüfi söz

   İLK AÇILIŞ
     POST /api/setup  { user, pass, name }   → cədvəllər + admin
     GET  /api/setup                          → qurulubmu?
   ============================================================ */

const JSON_H = { 'Content-Type': 'application/json; charset=utf-8' };

function ok(data, status) {
  return new Response(JSON.stringify(Object.assign({ ok: true }, data || {})), {
    status: status || 200, headers: JSON_H,
  });
}
function err(message, status) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: status || 400, headers: JSON_H,
  });
}

/* ══════════════════════════════════════════════════════════
   Mətn normallaşdırma — axtarış üçün
   "Çörək" → "corek",  AZ/RU hərfləri latına
   ══════════════════════════════════════════════════════════ */
const MAP = {
  ə: 'e', ü: 'u', ö: 'o', ğ: 'g', ş: 's', ç: 'c', ı: 'i', İ: 'i',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c',
  ш: 's', щ: 's', ы: 'i', э: 'e', ю: 'u', я: 'a',
};
function norm(s) {
  let out = String(s == null ? '' : s).toLowerCase();
  let r = '';
  for (const ch of out) r += (MAP[ch] !== undefined ? MAP[ch] : ch);
  return r.replace(/\s+/g, ' ').trim();
}

function nowMs() { return Date.now(); }
function newId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ══════════════════════════════════════════════════════════
   Şifrə (PBKDF2-SHA256) və sessiya (HMAC imzalı token)
   ══════════════════════════════════════════════════════════ */
const enc = new TextEncoder();

function b64(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashPass(pass, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return b64(bits);
}

async function sign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function makeToken(userId, secret) {
  const exp = nowMs() + 30 * 24 * 3600 * 1000;       // 30 gün
  const body = userId + '.' + exp;
  return body + '.' + (await sign(body, secret));
}

async function readToken(token, secret) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const body = parts[0] + '.' + parts[1];
  if ((await sign(body, secret)) !== parts[2]) return null;
  if (nowMs() > Number(parts[1] || 0)) return null;
  return parts[0];
}

function cookieOf(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/* ══════════════════════════════════════════════════════════
   Cədvəllər — POST /api/setup bunları yaradır
   ══════════════════════════════════════════════════════════ */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT,
     pass TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
     active INTEGER NOT NULL DEFAULT 1, created_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS user_perms (
     user_id TEXT NOT NULL, perm TEXT NOT NULL, allowed INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, perm))`,

  `CREATE TABLE IF NOT EXISTS suppliers (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, phone TEXT, note TEXT,
     created_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS statuses (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, sort INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
  /* Bir barkod + bir qiymət, içində saysız fərqli mal.
     Məs. "Açkı 10 manat" — 100 mal, hamısının barkodu və qiyməti eyni.
     Barkod QOVLUĞUN üzərindədir, ona görə `barcodes` cədvəlindəki
     UNIQUE məhdudiyyəti pozulmur. */
  `CREATE TABLE IF NOT EXISTS bundles (id TEXT PRIMARY KEY, name TEXT NOT NULL,
     code TEXT, price REAL, note TEXT, created_at INTEGER)`,
  /* Esqinin özünün əlavə etdiyi sahələr — ad və növ burada saxlanılır,
     dəyərlər isə products.custom sütununda JSON kimi */
  `CREATE TABLE IF NOT EXISTS fields (id TEXT PRIMARY KEY, name TEXT NOT NULL,
     type TEXT DEFAULT 'text', sort INTEGER DEFAULT 0)`,

  `CREATE TABLE IF NOT EXISTS products (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, main_code TEXT,
     brand TEXT, grp TEXT, supplier TEXT, location TEXT, status TEXT,
     price REAL, note TEXT, search TEXT,
     created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS barcodes (
     id TEXT PRIMARY KEY, product_id TEXT NOT NULL,
     code TEXT NOT NULL UNIQUE, short TEXT, created_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS images (
     id TEXT PRIMARY KEY, product_id TEXT NOT NULL, key TEXT NOT NULL,
     sort INTEGER DEFAULT 0, cover INTEGER DEFAULT 0, created_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS folder (
     id TEXT PRIMARY KEY, code TEXT NOT NULL, short TEXT, note TEXT,
     product_id TEXT, status TEXT DEFAULT 'new',
     user_id TEXT, created_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS inbox (
     id TEXT PRIMARY KEY, key TEXT NOT NULL, source TEXT,
     product_id TEXT, status TEXT DEFAULT 'new',
     user_id TEXT, created_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS receipts (
     id TEXT PRIMARY KEY, supplier TEXT, note TEXT,
     status TEXT DEFAULT 'open', user_id TEXT,
     created_at INTEGER, closed_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS receipt_items (
     id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL, product_id TEXT,
     name TEXT, code TEXT, qty REAL DEFAULT 1, price REAL, created_at INTEGER)`,

  `CREATE TABLE IF NOT EXISTS log (
     id TEXT PRIMARY KEY, entity TEXT, entity_id TEXT, action TEXT,
     detail TEXT, user_id TEXT, ts INTEGER)`,

  `CREATE INDEX IF NOT EXISTS ix_prod_search ON products(search)`,
  `CREATE INDEX IF NOT EXISTS ix_prod_sup ON products(supplier)`,
  `CREATE INDEX IF NOT EXISTS ix_bc_code ON barcodes(code)`,
  `CREATE INDEX IF NOT EXISTS ix_bc_prod ON barcodes(product_id)`,
  `CREATE INDEX IF NOT EXISTS ix_img_prod ON images(product_id)`,
  `CREATE INDEX IF NOT EXISTS ix_ri_receipt ON receipt_items(receipt_id)`,
];

/* Sonradan əlavə olunan sütunlar.
   `CREATE TABLE IF NOT EXISTS` mövcud cədvələ sütun əlavə etmir,
   ona görə ALTER ilə əlavə edirik. Sütun artıq varsa ALTER xəta
   verir — udulur, çünki bu, nasazlıq deyil. */
const MIGRATIONS = [
  `ALTER TABLE products ADD COLUMN color TEXT`,
  `ALTER TABLE products ADD COLUMN expiry TEXT`,
  `ALTER TABLE products ADD COLUMN extra_type TEXT`,
  `ALTER TABLE products ADD COLUMN extra_code TEXT`,
  `ALTER TABLE products ADD COLUMN tags TEXT`,
  `ALTER TABLE products ADD COLUMN section_note TEXT`,
  `ALTER TABLE products ADD COLUMN alert INTEGER DEFAULT 0`,
  `ALTER TABLE products ADD COLUMN category TEXT`,
  `ALTER TABLE products ADD COLUMN custom TEXT`,
  `ALTER TABLE products ADD COLUMN favorite INTEGER DEFAULT 0`,
  `ALTER TABLE products ADD COLUMN wa_count INTEGER DEFAULT 0`,
  /* Qəbul Studio: səbət rejimi və qəbul edilmə vaxtı */
  `ALTER TABLE receipts ADD COLUMN kind TEXT DEFAULT 'simple'`,
  `ALTER TABLE receipt_items ADD COLUMN received_at INTEGER`,
  `ALTER TABLE products ADD COLUMN bundle_id TEXT`,
];

/* İlk açılışda standart statuslar — köhnə JOLLY-dəki rənglərlə */
const SEED_STATUS = [
  { name: 'Aktiv',      color: '#22d3ee' },
  { name: 'Problemli',  color: '#f87171' },
  { name: 'Yeni gəlib', color: '#a78bfa' },
  { name: 'Endirimdə',  color: '#fbbf24' },
];

async function migrate(env) {
  for (const sql of MIGRATIONS) {
    try { await env.DB.prepare(sql).run(); } catch (e) { /* sütun artıq var */ }
  }
  try {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM statuses').first();
    if (!c || !c.n) {
      let i = 0;
      for (const st of SEED_STATUS) {
        await env.DB.prepare(
          'INSERT INTO statuses (id, name, color, sort) VALUES (?,?,?,?)'
        ).bind(newId('st'), st.name, st.color, i++).run();
      }
    }
  } catch (e) {}
}

/* İcazə açarları — proqramın bütün bölmələri */
const PERMS = [
  { key: 'products.view',   label: 'Məhsullara bax' },
  { key: 'products.create', label: 'Məhsul əlavə et' },
  { key: 'products.edit',   label: 'Məhsulu dəyiş' },
  { key: 'products.delete', label: 'Məhsulu sil' },
  { key: 'barcode.scan',    label: 'Barkod oxut' },
  { key: 'folder.use',      label: 'Barkod qovluğu' },
  { key: 'inbox.use',       label: 'Şəkillə axtarış' },
  { key: 'receipt.view',    label: 'Mal qəbuluna bax' },
  { key: 'receipt.edit',    label: 'Mal qəbulu et' },
  { key: 'supplier.view',   label: 'Tədarükçü malları' },
  { key: 'users.manage',    label: 'İstifadəçiləri idarə et' },
  { key: 'backup.use',      label: 'Ehtiyat nüsxə' },
  { key: 'import.use',      label: 'Köhnədən idxal' },
];

/* ══════════════════════════════════════════════════════════
   Köməkçilər
   ══════════════════════════════════════════════════════════ */
async function currentUser(request, env) {
  const secret = env.SESSION_SECRET || 'dev-secret-deyis';
  const uid = await readToken(cookieOf(request, 'sid'), secret);
  if (!uid) return null;
  const u = await env.DB.prepare(
    'SELECT id, username, name, role, active FROM users WHERE id = ?'
  ).bind(uid).first();
  if (!u || !u.active) return null;
  return u;
}

async function permsOf(env, user) {
  if (!user) return {};
  if (user.role === 'admin') {
    const all = {};
    for (const p of PERMS) all[p.key] = true;
    return all;
  }
  const rs = await env.DB.prepare(
    'SELECT perm, allowed FROM user_perms WHERE user_id = ?'
  ).bind(user.id).all();
  const out = {};
  for (const r of (rs.results || [])) out[r.perm] = !!r.allowed;
  return out;
}

async function need(request, env, perm) {
  const user = await currentUser(request, env);
  if (!user) return { error: err('Giriş edilməyib', 401) };
  if (!perm) return { user };
  const p = await permsOf(env, user);
  if (!p[perm]) return { error: err('İcazə yoxdur: ' + perm, 403) };
  return { user };
}

/* ═══════════════════════════════════════════════════════════
   MODEL ÇAĞIRICISI
   Bir model adına bel bağlamaq risklidir: model siyahıdan çıxa,
   ad dəyişə, ya da gündəlik hədd dola bilər. Ona görə bir neçəsi
   NÖVBƏ İLƏ sınanır və ƏSL xəta mesajı saxlanılır — əvvəl onu
   udurdum, ona görə cihazda yalnız "Model cavab vermədi" görünürdü
   və səbəbi bilmək mümkün deyildi.
   ═══════════════════════════════════════════════════════════ */
const TEXT_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
  '@cf/qwen/qwen1.5-14b-chat-awq',
  '@cf/google/gemma-7b-it',
];

async function askModel(env, sys, user, maxTokens) {
  const tried = [];
  for (const model of TEXT_MODELS) {
    /* Bəzi modellər `messages`, bəziləri yalnız `prompt` qəbul edir */
    const shapes = [
      { messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        max_tokens: maxTokens || 260 },
      { prompt: sys + '\n\n' + user, max_tokens: maxTokens || 260 },
    ];
    for (const input of shapes) {
      try {
        const r = await env.AI.run(model, input);
        const txt = String((r && (r.response || r.result || r.text)) || '').trim();
        if (txt) return { ok: true, text: txt, model };
        tried.push(model + ': boş cavab');
      } catch (e) {
        tried.push(model + ': ' + String((e && e.message) || e).slice(0, 120));
      }
    }
  }
  return { ok: false, tried };
}

/* Hansı sahə dəyişib — köhnə və yeni dəyəri ilə.
   Əvvəl yalnız "update" yazılırdı, kimin nəyi dəyişdiyi bilinmirdi. */
const TRACKED = {
  name: 'Ad', main_code: 'Kod', brand: 'Firma', category: 'Kateqoriya', grp: 'Qrup',
  supplier: 'Tədarükçü', location: 'Yer', status: 'Vəziyyət', price: 'Qiymət',
  color: 'Rəng', expiry: 'Son istifadə', note: 'Qeyd', section_note: 'Bölmə qeydi',
  tags: 'Etiketlər', extra_code: 'Əlavə kod',
};

async function logDiff(env, user, id, before, after) {
  if (!before) return;
  const rows = [];
  for (const k in TRACKED) {
    const a = before[k] == null ? '' : String(before[k]);
    const b = after[k] == null ? '' : String(after[k]);
    if (a !== b) rows.push(TRACKED[k] + ': "' + a + '" → "' + b + '"');
  }
  if (!rows.length) return;
  await writeLog(env, user, 'product', id, 'change', rows.join(' | '));
}

async function writeLog(env, user, entity, entityId, action, detail) {
  try {
    await env.DB.prepare(
      'INSERT INTO log (id, entity, entity_id, action, detail, user_id, ts) VALUES (?,?,?,?,?,?,?)'
    ).bind(newId('log'), entity, entityId || null, action, detail || null,
           user ? user.id : null, nowMs()).run();
  } catch (e) { /* jurnal xətası əsas işi dayandırmasın */ }
}

/* Məhsulun axtarış sətrini yenidən qurur */
async function reindex(env, productId) {
  const p = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first();
  if (!p) return;
  const bc = await env.DB.prepare('SELECT code, short FROM barcodes WHERE product_id = ?')
    .bind(productId).all();
  const bits = [p.name, p.main_code, p.brand, p.grp, p.supplier, p.location, p.note,
                p.color, p.extra_code, p.tags, p.section_note, p.category];
  /* öz sahələrinin dəyərləri də axtarışa düşsün */
  try {
    const c = p.custom ? JSON.parse(p.custom) : null;
    if (c) for (const k in c) bits.push(c[k]);
  } catch (e) {}
  for (const b of (bc.results || [])) { bits.push(b.code); bits.push(b.short); }
  await env.DB.prepare('UPDATE products SET search = ? WHERE id = ?')
    .bind(norm(bits.filter(Boolean).join(' ')), productId).run();
}

async function productFull(env, id) {
  const p = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!p) return null;
  const bc = await env.DB.prepare(
    'SELECT id, code, short FROM barcodes WHERE product_id = ? ORDER BY created_at'
  ).bind(id).all();
  const im = await env.DB.prepare(
    'SELECT id, key, sort, cover FROM images WHERE product_id = ? ORDER BY cover DESC, sort'
  ).bind(id).all();
  p.barcodes = bc.results || [];
  p.images = im.results || [];
  return p;
}

/* ══════════════════════════════════════════════════════════
   ƏSAS
   ══════════════════════════════════════════════════════════ */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* ═══ PAYLAŞILAN ŞƏKİL ═══
       Telefon "Paylaş → Kodsuz Mehsullar" edəndə Android buraya
       multipart POST göndərir. Şəkli R2-yə yazırıq, Şəkil Qutusuna
       sətir əlavə edirik və proqramı qutu ekranında açırıq.
       Service Worker-ə ehtiyac yoxdur — serverin özü qəbul edir. */
    if (path === '/share' && request.method === 'POST') {
      try {
        const form = await request.formData();
        const files = form.getAll('image').filter((f) => f && f.size);
        if (!files.length) return Response.redirect(new URL('/#/inbox', request.url), 303);
        if (!env.MEDIA) return err('R2 bağlantısı yoxdur', 500);

        const user = await currentUser(request, env);
        let n = 0;
        for (const f of files) {
          const key = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          await env.MEDIA.put('images/' + key, f.stream(), {
            httpMetadata: { contentType: f.type || 'image/jpeg' },
          });
          await env.DB.prepare(
            'INSERT INTO inbox (id, key, source, user_id, created_at) VALUES (?,?,?,?,?)'
          ).bind(newId('in'), key, 'paylaşma', user ? user.id : null, nowMs()).run();
          n++;
        }
        return Response.redirect(new URL('/#/inbox?yeni=' + n, request.url), 303);
      } catch (e) {
        return Response.redirect(new URL('/#/inbox?xeta=1', request.url), 303);
      }
    }

    /* ═══════════════════════════════════════════════════════
       🔗 JOLLY KÖRPÜSÜ
       Köhnə JOLLY-nin öz serveri yoxdur, ona görə süni zəka
       sorğusunu bura göndərir. JOLLY malların ÖZÜNÜ yox,
       yalnız YEKUN RƏQƏMLƏRİ göndərir (neçə mal, neçəsi
       barkodsuz, tədarükçü bölgüsü və s.). Model həmin
       rəqəmlərlə cavab yazır — uydurma rəqəm verə bilmir.

       Bu marşrut giriş tələb etmir (JOLLY-nin sessiyası yoxdur),
       amma məlumat QAYTARMIR — yalnız gələn rəqəmləri şərh edir.
       ═══════════════════════════════════════════════════════ */
    if (path === '/api/jolly-ai') {
      const CORS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      };
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ ok: false, error: 'Yalnız POST' }), {
          status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
        });
      }

      const send = (obj, code) => new Response(JSON.stringify(obj), {
        status: code || 200, headers: { 'Content-Type': 'application/json', ...CORS },
      });

      if (!env.AI) return send({ ok: false, error: 'AI bağlantısı qurulmayıb' }, 503);

      let b = {};
      try { b = await request.json(); } catch (e) { b = {}; }
      const q = String(b.q || '').trim();
      if (!q) return send({ ok: false, error: 'Sual boşdur' }, 400);
      if (q.length > 500) return send({ ok: false, error: 'Sual çox uzundur' }, 400);

      /* Gələn rəqəmləri məhdudlaşdırırıq ki, sorğu şişməsin */
      let stats = {};
      try { stats = (b.stats && typeof b.stats === 'object') ? b.stats : {}; } catch (e) {}
      const statText = JSON.stringify(stats).slice(0, 4000);

      const sys =
        'Sən JOLLY adlı mağaza inventar proqramının köməkçisisən. ' +
        'Azərbaycan dilində, QISA və sadə cavab ver — 1-3 cümlə. ' +
        'Cavabda YALNIZ aşağıdakı JSON-dakı rəqəmlərdən istifadə et. ' +
        'JSON-da olmayan bir şey soruşulubsa, açıq de ki, bu məlumat yoxdur — ' +
        'HEÇ VAXT rəqəm uydurma. Emoji işlətmə, siyahı düzəltmə, izahat yazma.\n\n' +
        'MAĞAZANIN VƏZİYYƏTİ:\n' + statText;

      const out = await askModel(env, sys, q, 260);
      if (!out.ok) {
        /* ★ ƏSL səbəbi göndəririk — udmuruq */
        return send({
          ok: false,
          error: 'Heç bir model cavab vermədi',
          detail: (out.tried || []).slice(0, 3).join(' | '),
        }, 502);
      }
      return send({ ok: true, text: out.text, model: out.model });
    }

    /* Bizim olmayan hər şey saytın özünə — bu sətir olmasa proqram açılmaz */
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    /* ⚠️ Vəziyyət yoxlaması D1 nəzarətindən ƏVVƏL olmalıdır.
       Əvvəl aşağıda idi — bağlantı yoxdursa ping heç vaxt işə
       düşmürdü və hansı bağlantının çatdığını görmək mümkün deyildi. */
    if (path === '/api/ping') {
      const keys = [];
      try { for (const k in env) keys.push(k); } catch (e) {}
      return ok({
        db: !!env.DB,
        media: !!env.MEDIA,
        secret: !!env.SESSION_SECRET,
        assets: !!env.ASSETS,
        ai: !!env.AI,
        keys,                       // gələn bağlantıların ADLARI (dəyər yox)
        at: Date.now(),
      });
    }

    if (!env.DB) return err('D1 bağlantısı yoxdur (DB)', 500);

    try {
      return await route(request, env, url, path);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);

      /* Baza köhnə quruluşdadırsa (yeni sütun və ya cədvəl əlavə
         olunub, amma migrasiya işə düşməyib) — ÖZÜMÜZ düzəldirik və
         sorğunu bir dəfə təkrarlayırıq. Əvvəl istifadəçi menyudan
         "Bazanı yenilə" düyməsini basmalı idi; basmayanda
         "table products has no column named category" xətası çıxırdı. */
      if (/no column named|no such table|no such column/i.test(msg)) {
        try {
          for (const sql of SCHEMA) await env.DB.prepare(sql).run();
          await migrate(env);
          return await route(request, env, url, path);
        } catch (e2) {
          return err('Baza yenilənmədi: ' + (e2 && e2.message ? e2.message : String(e2)), 500);
        }
      }
      return err('Server xətası: ' + msg, 500);
    }
  },
};

async function route(request, env, url, path) {
  const M = request.method;
  const secret = env.SESSION_SECRET || 'dev-secret-deyis';
  /* ⚠️ Şəkil yükləməsi (PUT /api/img/...) İKİLİK gövdə göndərir.
     Əvvəl bütün POST/PUT sorğularında gövdə JSON kimi oxunurdu —
     bu, axını boşaldırdı və R2-yə ötürüləndə
     "Response body object should not be disturbed" xətası verirdi.
     Ona görə şəkil yolunda gövdəyə TOXUNMURUQ. */
  const isBinary = path.startsWith('/api/img/');
  const body = (!isBinary && (M === 'POST' || M === 'PUT'))
    ? await request.json().catch(() => ({}))
    : {};

  /* ───────── Qurulum ───────── */
  if (path === '/api/setup') {
    if (M === 'GET') {
      try {
        const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
        return ok({ ready: true, users: c ? c.n : 0 });
      } catch (e) {
        return ok({ ready: false, users: 0 });
      }
    }
    if (M === 'POST') {
      for (const sql of SCHEMA) await env.DB.prepare(sql).run();
      await migrate(env);
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
      if (c && c.n > 0) return ok({ created: true, admin: false, note: 'Cədvəllər hazırdır' });

      const user = String(body.user || '').trim();
      const pass = String(body.pass || '');
      if (user.length < 3 || pass.length < 4) return err('İstifadəçi adı və şifrə qısadır');

      const salt = newId('s');
      const id = newId('u');
      await env.DB.prepare(
        'INSERT INTO users (id, username, name, pass, salt, role, active, created_at) VALUES (?,?,?,?,?,?,1,?)'
      ).bind(id, user, String(body.name || user), await hashPass(pass, salt), salt, 'admin', nowMs()).run();
      return ok({ created: true, admin: true });
    }
  }

  /* ───────── Giriş ───────── */
  if (path === '/api/auth/login' && M === 'POST') {
    const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?')
      .bind(String(body.user || '').trim()).first();
    if (!u || !u.active) return err('İstifadəçi tapılmadı', 401);
    if ((await hashPass(String(body.pass || ''), u.salt)) !== u.pass) return err('Şifrə yanlışdır', 401);

    const token = await makeToken(u.id, secret);
    const res = ok({ user: { id: u.id, username: u.username, name: u.name, role: u.role } });
    res.headers.append('Set-Cookie',
      'sid=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (30 * 24 * 3600));
    await writeLog(env, u, 'auth', u.id, 'login', null);
    return res;
  }

  if (path === '/api/auth/logout') {
    const res = ok({});
    res.headers.append('Set-Cookie', 'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    return res;
  }

  if (path === '/api/auth/me') {
    const user = await currentUser(request, env);
    if (!user) return ok({ user: null, perms: {} });
    return ok({ user, perms: await permsOf(env, user), all: PERMS });
  }

  /* ───────── Şəkillər (R2) ───────── */
  if (path.startsWith('/api/img/')) {
    if (!env.MEDIA) return err('R2 bağlantısı yoxdur (MEDIA)', 500);
    const key = decodeURIComponent(path.slice('/api/img/'.length)).trim();
    if (!key || key.includes('..')) return err('Yanlış açar');

    if (M === 'GET') {
      const obj = await env.MEDIA.get('images/' + key);
      if (!obj) return err('Tapılmadı', 404);
      const h = new Headers();
      h.set('Content-Type', (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg');
      h.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(obj.body, { headers: h });
    }
    if (M === 'PUT') {
      const g = await need(request, env, 'products.edit');
      if (g.error) return g.error;
      await env.MEDIA.put('images/' + key, request.body, {
        httpMetadata: { contentType: request.headers.get('Content-Type') || 'image/jpeg' },
      });
      return ok({ key });
    }
    if (M === 'DELETE') {
      const g = await need(request, env, 'products.delete');
      if (g.error) return g.error;
      await env.MEDIA.delete('images/' + key);
      await env.DB.prepare('DELETE FROM images WHERE key = ?').bind(key).run();
      return ok({ deleted: key });
    }
  }

  /* ───────── Köməkçi siyahılar ───────── */
  if (path === '/api/meta' && M === 'GET') {
    const g = await need(request, env, null);
    if (g.error) return g.error;
    const [b, gr, l, s, st, tg, cat, fl] = await Promise.all([
      env.DB.prepare('SELECT * FROM brands ORDER BY name').all(),
      env.DB.prepare('SELECT * FROM groups ORDER BY name').all(),
      env.DB.prepare('SELECT * FROM locations ORDER BY name').all(),
      env.DB.prepare('SELECT * FROM suppliers ORDER BY name').all(),
      env.DB.prepare('SELECT * FROM statuses ORDER BY sort').all(),
      env.DB.prepare('SELECT * FROM tags ORDER BY name').all(),
      env.DB.prepare('SELECT * FROM categories ORDER BY name').all(),
      env.DB.prepare('SELECT * FROM fields ORDER BY sort, name').all(),
    ]);
    return ok({
      brands: b.results || [], groups: gr.results || [],
      locations: l.results || [], suppliers: s.results || [],
      statuses: st.results || [], tags: tg.results || [],
      categories: cat.results || [], fields: fl.results || [],
    });
  }

  if (path === '/api/meta' && M === 'POST') {
    const g = await need(request, env, 'products.edit');
    if (g.error) return g.error;
    const type = String(body.type || '');
    const name = String(body.name || '').trim();
    const tables = { brand: 'brands', group: 'groups', location: 'locations',
                     supplier: 'suppliers', status: 'statuses', tag: 'tags',
                     category: 'categories', field: 'fields' };
    if (!tables[type] || !name) return err('Növ və ya ad yanlışdır');

    const exist = await env.DB.prepare('SELECT * FROM ' + tables[type] + ' WHERE name = ?')
      .bind(name).first();
    if (exist) return ok({ item: exist, existed: true });

    const id = newId(type);
    if (type === 'supplier') {
      await env.DB.prepare(
        'INSERT INTO suppliers (id, name, code, phone, note, created_at) VALUES (?,?,?,?,?,?)'
      ).bind(id, name, body.code || null, body.phone || null, body.note || null, nowMs()).run();
    } else if (type === 'field') {
      await env.DB.prepare('INSERT INTO fields (id, name, type, sort) VALUES (?,?,?,?)')
        .bind(id, name, body.ftype || 'text', Number(body.sort || 50)).run();
    } else if (type === 'status') {
      await env.DB.prepare('INSERT INTO statuses (id, name, color, sort) VALUES (?,?,?,?)')
        .bind(id, name, body.color || '#9ca3af', 99).run();
    } else {
      await env.DB.prepare('INSERT INTO ' + tables[type] + ' (id, name) VALUES (?,?)')
        .bind(id, name).run();
    }
    return ok({ item: { id, name }, existed: false });
  }

  if (path.startsWith('/api/meta/') && M === 'DELETE') {
    const g = await need(request, env, 'products.edit');
    if (g.error) return g.error;
    const rest = path.slice('/api/meta/'.length);
    const [type, id] = rest.split('/');
    const tables = { brand: 'brands', group: 'groups', location: 'locations',
                     supplier: 'suppliers', status: 'statuses', tag: 'tags',
                     category: 'categories', field: 'fields' };
    if (!tables[type] || !id) return err('Yanlış növ');
    await env.DB.prepare('DELETE FROM ' + tables[type] + ' WHERE id = ?').bind(id).run();
    return ok({});
  }

  /* ───────── Məhsullar ───────── */
  if (path === '/api/products' && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;

    const q = norm(url.searchParams.get('q') || '');
    const sup = url.searchParams.get('supplier') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const per = Math.min(100, parseInt(url.searchParams.get('per') || '30', 10));

    const where = ['deleted_at IS NULL'];
    const args = [];
    if (q) { where.push('search LIKE ?'); args.push('%' + q + '%'); }
    if (sup) { where.push('supplier = ?'); args.push(sup); }
    if (url.searchParams.get('fav') === '1') where.push('favorite = 1');
    const brandQ = url.searchParams.get('brand');
    if (brandQ) { where.push('brand = ?'); args.push(brandQ); }
    const catQ = url.searchParams.get('category');
    if (catQ) { where.push('category = ?'); args.push(catQ); }

    const sql = 'SELECT * FROM products WHERE ' + where.join(' AND ') +
                ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    const rs = await env.DB.prepare(sql).bind(...args, per, (page - 1) * per).all();
    const cnt = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM products WHERE ' + where.join(' AND ')
    ).bind(...args).first();

    /* Hər məhsulun barkodu və üz şəkli — tək-tək sorğu vurmamaq üçün toplu */
    const items = rs.results || [];
    if (items.length) {
      const ids = items.map(() => '?').join(',');
      const vals = items.map((x) => x.id);
      const bc = await env.DB.prepare(
        'SELECT product_id, code, short FROM barcodes WHERE product_id IN (' + ids + ')'
      ).bind(...vals).all();
      const im = await env.DB.prepare(
        'SELECT product_id, key, cover FROM images WHERE product_id IN (' + ids + ') ORDER BY cover DESC, sort'
      ).bind(...vals).all();
      const bmap = {}, imap = {};
      for (const r of (bc.results || [])) (bmap[r.product_id] = bmap[r.product_id] || []).push(r);
      for (const r of (im.results || [])) (imap[r.product_id] = imap[r.product_id] || []).push(r);
      for (const it of items) {
        it.barcodes = bmap[it.id] || [];
        it.images = imap[it.id] || [];
      }
    }
    return ok({ items, total: cnt ? cnt.n : 0, page, per });
  }

  if (path.startsWith('/api/products/') && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const p = await productFull(env, path.slice('/api/products/'.length));
    return p ? ok({ product: p }) : err('Tapılmadı', 404);
  }

  if (path === '/api/products' && M === 'POST') {
    const isNew = !body.id;
    let before = null;
    const g = await need(request, env, isNew ? 'products.create' : 'products.edit');
    if (g.error) return g.error;

    const name = String(body.name || '').trim();
    if (!name) return err('Ad boş ola bilməz');

    const id = body.id || newId('p');

    /* ⚠️ Barkod toqquşması ƏVVƏLCƏ yoxlanılır.
       Əvvəl məhsul yazılır, sonra barkod yoxlanılırdı — toqquşma
       olanda xəta qaytarılırdı, amma boş məhsul artıq bazada
       qalırdı (yoxlama bunu tutdu). İndi əvvəl yoxlayırıq. */
    if (Array.isArray(body.barcodes)) {
      for (const raw of body.barcodes) {
        const code = String(raw || '').trim();
        if (!code) continue;
        const dup = await env.DB.prepare('SELECT product_id FROM barcodes WHERE code = ?')
          .bind(code).first();
        if (dup && dup.product_id !== id) {
          const other = await env.DB.prepare('SELECT name FROM products WHERE id = ?')
            .bind(dup.product_id).first();
          return err('Bu barkod başqa məhsuldadır: ' + (other ? other.name : dup.product_id));
        }
      }
    }

    const f = {
      name,
      main_code: body.main_code || null,
      brand: body.brand || null,
      grp: body.grp || null,
      supplier: body.supplier || null,
      location: body.location || null,
      status: body.status || null,
      price: body.price === '' || body.price == null ? null : Number(body.price),
      note: body.note || null,
      color: body.color || null,
      expiry: body.expiry || null,
      extra_type: body.extra_type || null,
      extra_code: body.extra_code || null,
      tags: Array.isArray(body.tags) ? body.tags.join(', ') : (body.tags || null),
      section_note: body.section_note || null,
      alert: body.alert ? 1 : 0,
      category: body.category || null,
      /* Esqinin öz sahələri — {sahə adı: dəyər} */
      custom: body.custom && typeof body.custom === 'object'
        ? JSON.stringify(body.custom) : (body.custom || null),
    };

    if (isNew) {
      await env.DB.prepare(
        `INSERT INTO products (id, name, main_code, brand, grp, supplier, location, status, price, note,
           color, expiry, extra_type, extra_code, tags, section_note, alert,
           category, custom, search, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(id, f.name, f.main_code, f.brand, f.grp, f.supplier, f.location, f.status,
             f.price, f.note, f.color, f.expiry, f.extra_type, f.extra_code, f.tags,
             f.section_note, f.alert, f.category, f.custom, norm(name), nowMs(), nowMs()).run();
    } else {
      before = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
      await env.DB.prepare(
        `UPDATE products SET name=?, main_code=?, brand=?, grp=?, supplier=?, location=?,
         status=?, price=?, note=?, color=?, expiry=?, extra_type=?, extra_code=?,
         tags=?, section_note=?, alert=?, category=?, custom=?, updated_at=? WHERE id=?`
      ).bind(f.name, f.main_code, f.brand, f.grp, f.supplier, f.location, f.status,
             f.price, f.note, f.color, f.expiry, f.extra_type, f.extra_code, f.tags,
             f.section_note, f.alert, f.category, f.custom, nowMs(), id).run();
    }

    /* Barkodlar — göndərilibsə tam əvəz olunur */
    if (Array.isArray(body.barcodes)) {
      const cur = await env.DB.prepare('SELECT code FROM barcodes WHERE product_id = ?').bind(id).all();
      const have = new Set((cur.results || []).map((r) => r.code));
      const want = new Set(body.barcodes.map((c) => String(c).trim()).filter(Boolean));

      for (const code of want) {
        if (have.has(code)) continue;
        await env.DB.prepare(
          'INSERT INTO barcodes (id, product_id, code, short, created_at) VALUES (?,?,?,?,?)'
        ).bind(newId('bc'), id, code, code.slice(-4), nowMs()).run();
      }
      for (const code of have) {
        if (!want.has(code)) {
          await env.DB.prepare('DELETE FROM barcodes WHERE product_id = ? AND code = ?').bind(id, code).run();
        }
      }
    }

    /* Şəkillər — açar siyahısı göndərilibsə */
    if (Array.isArray(body.images)) {
      await env.DB.prepare('DELETE FROM images WHERE product_id = ?').bind(id).run();
      let i = 0;
      for (const key of body.images) {
        if (!key) continue;
        await env.DB.prepare(
          'INSERT INTO images (id, product_id, key, sort, cover, created_at) VALUES (?,?,?,?,?,?)'
        ).bind(newId('im'), id, String(key), i, i === 0 ? 1 : 0, nowMs()).run();
        i++;
      }
    }

    await reindex(env, id);
    await writeLog(env, g.user, 'product', id, isNew ? 'add' : 'update', name);
    if (!isNew) await logDiff(env, g.user, id, before, f);
    return ok({ product: await productFull(env, id) });
  }

  if (path.startsWith('/api/products/') && M === 'DELETE') {
    const g = await need(request, env, 'products.delete');
    if (g.error) return g.error;
    const id = path.slice('/api/products/'.length);
    const p = await env.DB.prepare('SELECT name FROM products WHERE id = ?').bind(id).first();
    await env.DB.prepare('UPDATE products SET deleted_at = ? WHERE id = ?').bind(nowMs(), id).run();
    await writeLog(env, g.user, 'product', id, 'delete', p ? p.name : null);
    return ok({ deleted: id });
  }

  /* ═══ YÜNGÜL SAYĞACLAR ═══
     Əvvəl iş masası və analitika 1000 malı BÜTÜN barkod və
     şəkilləri ilə çəkirdi — telefonda ağır idi və trafik yeyirdi.
     İndi hesablama SQL-də aparılır, sətirlər ümumiyyətlə gəlmir. */
  if (path === '/api/stats' && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;

    const one = async (sql, ...a) => {
      const r = await env.DB.prepare(sql).bind(...a).first();
      return r ? (r.n || 0) : 0;
    };
    const W = 'FROM products WHERE deleted_at IS NULL';

    const [total, noPrice, noSup, noCat, alert, fav, noBc, noImg, folder] = await Promise.all([
      one('SELECT COUNT(*) AS n ' + W),
      one('SELECT COUNT(*) AS n ' + W + ' AND (price IS NULL OR price = 0)'),
      one('SELECT COUNT(*) AS n ' + W + " AND (supplier IS NULL OR supplier = '')"),
      one('SELECT COUNT(*) AS n ' + W + " AND (category IS NULL OR category = '') AND (grp IS NULL OR grp = '')"),
      one('SELECT COUNT(*) AS n ' + W + ' AND alert = 1'),
      one('SELECT COUNT(*) AS n ' + W + ' AND favorite = 1'),
      one('SELECT COUNT(*) AS n ' + W + ' AND id NOT IN (SELECT product_id FROM barcodes)'),
      one('SELECT COUNT(*) AS n ' + W + ' AND id NOT IN (SELECT product_id FROM images)'),
      one("SELECT COUNT(*) AS n FROM folder WHERE status != 'done'"),
    ]);

    const full = await one(
      'SELECT COUNT(*) AS n ' + W +
      ' AND price > 0 AND supplier IS NOT NULL AND supplier != ""' +
      ' AND (category IS NOT NULL OR grp IS NOT NULL)' +
      ' AND id IN (SELECT product_id FROM barcodes)' +
      ' AND id IN (SELECT product_id FROM images)'
    );

    const grp = async (col) => {
      const r = await env.DB.prepare(
        'SELECT ' + col + ' AS k, COUNT(*) AS n ' + W + ' AND ' + col +
        " IS NOT NULL AND " + col + " != '' GROUP BY " + col + ' ORDER BY n DESC LIMIT 8'
      ).all();
      return r.results || [];
    };

    return ok({
      total, noBc, noImg, noPrice, noSup, noCat, alert, fav, full, folder,
      pct: total ? Math.round(full / total * 100) : 0,
      suppliers: await grp('supplier'), brands: await grp('brand'), groups: await grp('grp'),
    });
  }

  /* ═══ OFLAYN NÜSXƏ ═══
     Yalnız lazım olan sahələr — telefona yığmaq üçün ən yüngül forma */
  if (path === '/api/snapshot' && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const rs = await env.DB.prepare(
      'SELECT id, name, price, brand, supplier, grp, category, status, color, location, alert, favorite' +
      ' FROM products WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 3000'
    ).all();
    const items = rs.results || [];
    const bc = await env.DB.prepare('SELECT product_id, code FROM barcodes').all();
    const im = await env.DB.prepare(
      'SELECT product_id, key FROM images WHERE cover = 1'
    ).all();
    const bm = {}, imap = {};
    for (const r of (bc.results || [])) (bm[r.product_id] = bm[r.product_id] || []).push(r.code);
    for (const r of (im.results || [])) if (!imap[r.product_id]) imap[r.product_id] = r.key;
    for (const p of items) { p.codes = bm[p.id] || []; p.img = imap[p.id] || null; }
    return ok({ items, at: nowMs() });
  }

  /* ═══ BARKODUN BİR HİSSƏSİ İLƏ AXTARIŞ ═══
     Etiketdən yalnız bir neçə rəqəm oxunur — tam kod lazım deyil */
  if (path === '/api/bc' && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const q = String(url.searchParams.get('q') || '').replace(/\D/g, '');
    if (q.length < 2) return ok({ items: [] });

    const rs = await env.DB.prepare(
      `SELECT b.code, b.product_id, p.name, p.price
       FROM barcodes b JOIN products p ON p.id = b.product_id
       WHERE b.code LIKE ? AND p.deleted_at IS NULL
       ORDER BY LENGTH(b.code) LIMIT 12`
    ).bind('%' + q + '%').all();
    const items = rs.results || [];

    if (items.length) {
      const ids = [...new Set(items.map((x) => x.product_id))];
      const im = await env.DB.prepare(
        'SELECT product_id, key FROM images WHERE product_id IN (' +
        ids.map(() => '?').join(',') + ') ORDER BY cover DESC, sort'
      ).bind(...ids).all();
      const map = {};
      for (const r of (im.results || [])) if (!map[r.product_id]) map[r.product_id] = r.key;
      items.forEach((x) => { x.img = map[x.product_id] || null; });
    }
    return ok({ q, items });
  }

  /* ───────── Sevimli · WhatsApp sayğacı · tarixçə · oxşarlar ───────── */
  if (path.startsWith('/api/products/') && path.endsWith('/fav') && M === 'POST') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const id = path.slice('/api/products/'.length, -('/fav'.length));
    await env.DB.prepare('UPDATE products SET favorite = ? WHERE id = ?')
      .bind(body.on ? 1 : 0, id).run();
    return ok({ favorite: !!body.on });
  }

  if (path.startsWith('/api/products/') && path.endsWith('/wa') && M === 'POST') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const id = path.slice('/api/products/'.length, -('/wa'.length));
    await env.DB.prepare(
      'UPDATE products SET wa_count = COALESCE(wa_count,0) + 1 WHERE id = ?'
    ).bind(id).run();
    await writeLog(env, g.user, 'product', id, 'whatsapp', null);
    return ok({});
  }

  if (path.startsWith('/api/products/') && path.endsWith('/history') && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const id = path.slice('/api/products/'.length, -('/history'.length));

    const lg = await env.DB.prepare(
      'SELECT * FROM log WHERE entity_id = ? ORDER BY ts DESC LIMIT 30'
    ).bind(id).all();

    /* Bu mal hansı qəbullarda gəlib */
    const rc = await env.DB.prepare(
      `SELECT ri.qty, ri.price, ri.created_at, r.id AS rid, r.supplier, r.status
       FROM receipt_items ri JOIN receipts r ON r.id = ri.receipt_id
       WHERE ri.product_id = ? ORDER BY ri.created_at DESC LIMIT 20`
    ).bind(id).all();

    /* Kim dəyişib — istifadəçi adları */
    const us = await env.DB.prepare('SELECT id, name, username FROM users').all();
    const who = {};
    for (const u of (us.results || [])) who[u.id] = u.name || u.username;

    return ok({ log: lg.results || [], receipts: rc.results || [], who });
  }

  if (path.startsWith('/api/products/') && path.endsWith('/similar') && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const id = path.slice('/api/products/'.length, -('/similar'.length));
    const p = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    if (!p) return ok({ items: [] });

    /* Sıra: eyni kateqoriya → eyni qrup → eyni firma */
    const seen = {}, out = [];
    for (const [col, val] of [['category', p.category], ['grp', p.grp], ['brand', p.brand]]) {
      if (!val || out.length >= 8) continue;
      const rs = await env.DB.prepare(
        'SELECT id, name, price, brand, grp FROM products WHERE ' + col +
        ' = ? AND id != ? AND deleted_at IS NULL LIMIT 8'
      ).bind(val, id).all();
      for (const r of (rs.results || [])) {
        if (seen[r.id] || out.length >= 8) continue;
        seen[r.id] = 1; out.push(r);
      }
    }
    if (out.length) {
      const ids = out.map(() => '?').join(',');
      const im = await env.DB.prepare(
        'SELECT product_id, key FROM images WHERE product_id IN (' + ids + ') ORDER BY cover DESC, sort'
      ).bind(...out.map(x => x.id)).all();
      const map = {};
      for (const r of (im.results || [])) if (!map[r.product_id]) map[r.product_id] = r.key;
      out.forEach(x => { x.img = map[x.id] || null; });
    }
    return ok({ items: out });
  }

  /* ═══ QOVLUQLAR — bir barkod, bir qiymət, çoxlu mal ═══ */
  if (path === '/api/bundles' && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const rs = await env.DB.prepare('SELECT * FROM bundles ORDER BY created_at DESC').all();
    const items = rs.results || [];
    for (const b of items) {
      const c = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM products WHERE bundle_id = ? AND deleted_at IS NULL'
      ).bind(b.id).first();
      b.n = c ? c.n : 0;
    }
    return ok({ items });
  }

  if (path === '/api/bundles' && M === 'POST') {
    const g = await need(request, env, 'products.create');
    if (g.error) return g.error;
    const name = String(body.name || '').trim();
    if (!name) return err('Ad boş ola bilməz');
    const code = String(body.code || '').replace(/\D/g, '');

    /* Həmin barkod ayrıca məhsulda varsa qarışıqlıq olar */
    if (code) {
      const dup = await env.DB.prepare('SELECT product_id FROM barcodes WHERE code = ?')
        .bind(code).first();
      if (dup) {
        const p = await env.DB.prepare('SELECT name FROM products WHERE id = ?')
          .bind(dup.product_id).first();
        return err('Bu barkod artıq "' + (p ? p.name : '?') + '" malındadır');
      }
      const dup2 = await env.DB.prepare('SELECT id, name FROM bundles WHERE code = ? AND id != ?')
        .bind(code, body.id || '').first();
      if (dup2) return err('Bu barkod "' + dup2.name + '" qovluğundadır');
    }

    const price = (body.price === '' || body.price == null) ? null : Number(body.price);
    if (body.id) {
      await env.DB.prepare('UPDATE bundles SET name=?, code=?, price=?, note=? WHERE id=?')
        .bind(name, code || null, price, body.note || null, body.id).run();
      /* Qiymət dəyişəndə içindəki bütün mallara yayılır */
      await env.DB.prepare('UPDATE products SET price = ? WHERE bundle_id = ?')
        .bind(price, body.id).run();
      return ok({ id: body.id });
    }
    const id = newId('bn');
    await env.DB.prepare(
      'INSERT INTO bundles (id, name, code, price, note, created_at) VALUES (?,?,?,?,?,?)'
    ).bind(id, name, code || null, price, body.note || null, nowMs()).run();
    await writeLog(env, g.user, 'bundle', id, 'add', name);
    return ok({ id });
  }

  if (path.startsWith('/api/bundles/')) {
    const rest = path.slice('/api/bundles/'.length);
    const [bid, sub] = rest.split('/');

    if (M === 'GET' && !sub) {
      const g = await need(request, env, 'products.view');
      if (g.error) return g.error;
      const b = await env.DB.prepare('SELECT * FROM bundles WHERE id = ?').bind(bid).first();
      if (!b) return err('Tapılmadı', 404);
      const rs = await env.DB.prepare(
        'SELECT * FROM products WHERE bundle_id = ? AND deleted_at IS NULL ORDER BY created_at DESC'
      ).bind(bid).all();
      const items = rs.results || [];
      if (items.length) {
        const ids = items.map(() => '?').join(',');
        const im = await env.DB.prepare(
          'SELECT product_id, key FROM images WHERE product_id IN (' + ids + ') ORDER BY cover DESC, sort'
        ).bind(...items.map((x) => x.id)).all();
        const map = {};
        for (const r of (im.results || [])) if (!map[r.product_id]) map[r.product_id] = r.key;
        items.forEach((x) => { x.img = map[x.id] || null; });
      }
      b.items = items;
      return ok({ bundle: b });
    }

    /* Toplu əlavə — hər sətir ayrıca məhsul olur, barkod və qiymət
       qovluqdan gəlir, ona görə hər mala ayrıca yazılmır */
    if (M === 'POST' && sub === 'items') {
      const g = await need(request, env, 'products.create');
      if (g.error) return g.error;
      const b = await env.DB.prepare('SELECT * FROM bundles WHERE id = ?').bind(bid).first();
      if (!b) return err('Qovluq tapılmadı', 404);

      const list = Array.isArray(body.items) ? body.items : [];
      let n = 0;
      for (const it of list) {
        const name = String((it && it.name) || '').trim();
        if (!name) continue;
        const id = newId('p');
        await env.DB.prepare(
          `INSERT INTO products (id, name, brand, grp, supplier, category, price, note,
             bundle_id, search, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(id, name, body.brand || null, body.grp || null, body.supplier || null,
               body.category || null, b.price, it.note || null, bid,
               norm(name + ' ' + b.name + ' ' + (b.code || '')), nowMs(), nowMs()).run();
        if (Array.isArray(it.images)) {
          let k = 0;
          for (const key of it.images) {
            if (!key) continue;
            await env.DB.prepare(
              'INSERT INTO images (id, product_id, key, sort, cover, created_at) VALUES (?,?,?,?,?,?)'
            ).bind(newId('im'), id, String(key), k, k === 0 ? 1 : 0, nowMs()).run();
            k++;
          }
        }
        n++;
      }
      await writeLog(env, g.user, 'bundle', bid, 'items', n + ' mal');
      return ok({ added: n });
    }

    if (M === 'DELETE' && !sub) {
      const g = await need(request, env, 'products.delete');
      if (g.error) return g.error;
      /* Qovluq silinəndə mallar qalır, sadəcə bağlantı qırılır */
      await env.DB.prepare('UPDATE products SET bundle_id = NULL WHERE bundle_id = ?').bind(bid).run();
      await env.DB.prepare('DELETE FROM bundles WHERE id = ?').bind(bid).run();
      return ok({});
    }
  }

  /* ───────── Barkodla tapmaq (skan) ───────── */
  if (path.startsWith('/api/barcode/') && M === 'GET') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    const code = decodeURIComponent(path.slice('/api/barcode/'.length)).trim();
    const row = await env.DB.prepare('SELECT product_id FROM barcodes WHERE code = ?').bind(code).first();
    if (row) return ok({ found: true, code, product: await productFull(env, row.product_id) });

    /* Ayrıca məhsulda yoxdursa, qovluqlarda axtarırıq */
    const bn = await env.DB.prepare('SELECT * FROM bundles WHERE code = ?').bind(code).first();
    if (bn) {
      const c = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM products WHERE bundle_id = ? AND deleted_at IS NULL'
      ).bind(bn.id).first();
      bn.n = c ? c.n : 0;
      return ok({ found: true, code, bundle: bn });
    }
    return ok({ found: false, code });
  }

  /* ───────── Barkod qovluğu ───────── */
  if (path === '/api/folder') {
    const g = await need(request, env, 'folder.use');
    if (g.error) return g.error;

    if (M === 'GET') {
      const rs = await env.DB.prepare(
        "SELECT * FROM folder WHERE status != 'done' ORDER BY created_at DESC LIMIT 300"
      ).all();
      return ok({ items: rs.results || [] });
    }
    if (M === 'POST') {
      const code = String(body.code || '').trim();
      if (!code) return err('Kod boşdur');
      const dup = await env.DB.prepare('SELECT product_id FROM barcodes WHERE code = ?').bind(code).first();
      if (dup) return ok({ known: true, product: await productFull(env, dup.product_id) });

      const exist = await env.DB.prepare("SELECT id FROM folder WHERE code = ? AND status != 'done'")
        .bind(code).first();
      if (exist) return ok({ known: false, added: false, id: exist.id });

      const id = newId('f');
      await env.DB.prepare(
        'INSERT INTO folder (id, code, short, note, user_id, created_at) VALUES (?,?,?,?,?,?)'
      ).bind(id, code, code.slice(-4), body.note || null, g.user.id, nowMs()).run();
      return ok({ known: false, added: true, id });
    }
  }

  if (path.startsWith('/api/folder/') && M === 'DELETE') {
    const g = await need(request, env, 'folder.use');
    if (g.error) return g.error;
    await env.DB.prepare('DELETE FROM folder WHERE id = ?').bind(path.slice('/api/folder/'.length)).run();
    return ok({});
  }

  /* ───────── Şəkil qutusu (şəkillə axtarış) ───────── */
  if (path === '/api/inbox') {
    const g = await need(request, env, 'inbox.use');
    if (g.error) return g.error;

    if (M === 'GET') {
      const rs = await env.DB.prepare(
        "SELECT * FROM inbox WHERE status != 'done' ORDER BY created_at DESC LIMIT 200"
      ).all();
      return ok({ items: rs.results || [] });
    }
    if (M === 'POST') {
      const key = String(body.key || '').trim();
      if (!key) return err('Şəkil açarı boşdur');
      const id = newId('in');
      await env.DB.prepare(
        'INSERT INTO inbox (id, key, source, user_id, created_at) VALUES (?,?,?,?,?)'
      ).bind(id, key, body.source || null, g.user.id, nowMs()).run();
      return ok({ id });
    }
  }

  if (path.startsWith('/api/inbox/') && M === 'POST') {
    const g = await need(request, env, 'inbox.use');
    if (g.error) return g.error;
    const id = path.slice('/api/inbox/'.length);
    await env.DB.prepare('UPDATE inbox SET status = ?, product_id = ? WHERE id = ?')
      .bind(body.status || 'done', body.product_id || null, id).run();
    return ok({});
  }

  /* ───────── Mal qəbulu ───────── */
  if (path === '/api/receipts') {
    if (M === 'GET') {
      const g = await need(request, env, 'receipt.view');
      if (g.error) return g.error;
      const kind = url.searchParams.get('kind');
      const rs = kind
        ? await env.DB.prepare(
            "SELECT * FROM receipts WHERE COALESCE(kind,'simple') = ? ORDER BY created_at DESC LIMIT 100"
          ).bind(kind).all()
        : await env.DB.prepare('SELECT * FROM receipts ORDER BY created_at DESC LIMIT 100').all();
      return ok({ items: rs.results || [] });
    }
    if (M === 'POST') {
      const g = await need(request, env, 'receipt.edit');
      if (g.error) return g.error;
      const id = newId('r');
      await env.DB.prepare(
        'INSERT INTO receipts (id, supplier, note, status, user_id, created_at) VALUES (?,?,?,?,?,?)'
      ).bind(id, body.supplier || null, body.note || null, 'open', g.user.id, nowMs()).run();
      if (body.kind === 'studio') {
        await env.DB.prepare('UPDATE receipts SET kind = ? WHERE id = ?').bind('studio', id).run();
      }
      return ok({ id, kind: body.kind === 'studio' ? 'studio' : 'simple' });
    }
  }

  if (path.startsWith('/api/receipts/')) {
    const rest = path.slice('/api/receipts/'.length);
    const [rid, sub] = rest.split('/');

    if (M === 'GET' && !sub) {
      const g = await need(request, env, 'receipt.view');
      if (g.error) return g.error;
      const head = await env.DB.prepare('SELECT * FROM receipts WHERE id = ?').bind(rid).first();
      if (!head) return err('Tapılmadı', 404);
      const items = await env.DB.prepare(
        'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY created_at'
      ).bind(rid).all();
      head.items = items.results || [];
      return ok({ receipt: head });
    }

    /* Səbətə birdən çox mal — süzgəcdən seçib toplu atmaq üçün */
    if (M === 'POST' && sub === 'fill') {
      const g = await need(request, env, 'receipt.edit');
      if (g.error) return g.error;
      const ids = Array.isArray(body.ids) ? body.ids : [];
      let n = 0;
      for (const pid of ids) {
        const ex = await env.DB.prepare(
          'SELECT id FROM receipt_items WHERE receipt_id = ? AND product_id = ?'
        ).bind(rid, pid).first();
        if (ex) continue;
        const p = await env.DB.prepare('SELECT name FROM products WHERE id = ?').bind(pid).first();
        const bc = await env.DB.prepare(
          'SELECT code FROM barcodes WHERE product_id = ? LIMIT 1'
        ).bind(pid).first();
        await env.DB.prepare(
          'INSERT INTO receipt_items (id, receipt_id, product_id, name, code, qty, created_at) VALUES (?,?,?,?,?,?,?)'
        ).bind(newId('ri'), rid, pid, p ? p.name : null, bc ? bc.code : null, 1, nowMs()).run();
        n++;
      }
      return ok({ added: n });
    }

    if (M === 'POST' && sub === 'items') {
      const g = await need(request, env, 'receipt.edit');
      if (g.error) return g.error;
      const id = newId('ri');
      await env.DB.prepare(
        'INSERT INTO receipt_items (id, receipt_id, product_id, name, code, qty, price, created_at) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(id, rid, body.product_id || null, body.name || null, body.code || null,
             Number(body.qty || 1), body.price == null ? null : Number(body.price), nowMs()).run();
      return ok({ id });
    }

    /* ═══ QƏBUL STUDIO — skan ═══
       Oxunan barkod səbətdəki hansı mala aiddir? Dörd hal var:
         tapılmadı · səbətdə yoxdur · artıq qəbul edilib · qəbul edildi
       Cavabda növbəti hədəf də qaytarılır ki, ekran dərhal keçsin. */
    if (M === 'POST' && sub === 'receive') {
      const g = await need(request, env, 'receipt.edit');
      if (g.error) return g.error;
      const code = String(body.code || '').replace(/\D/g, '');
      if (!code) return err('Barkod boşdur');

      const bc = await env.DB.prepare('SELECT product_id FROM barcodes WHERE code = ?')
        .bind(code).first();
      if (!bc) return ok({ result: 'unknown', code });

      const it = await env.DB.prepare(
        'SELECT * FROM receipt_items WHERE receipt_id = ? AND product_id = ?'
      ).bind(rid, bc.product_id).first();
      if (!it) {
        const p = await env.DB.prepare('SELECT name FROM products WHERE id = ?')
          .bind(bc.product_id).first();
        return ok({ result: 'not_in_basket', code, name: p ? p.name : '' });
      }
      if (it.received_at) return ok({ result: 'already', name: it.name });

      await env.DB.prepare('UPDATE receipt_items SET received_at = ? WHERE id = ?')
        .bind(nowMs(), it.id).run();
      return ok({ result: 'ok', name: it.name, itemId: it.id });
    }

    if (M === 'POST' && sub === 'close') {
      const g = await need(request, env, 'receipt.edit');
      if (g.error) return g.error;
      await env.DB.prepare('UPDATE receipts SET status = ?, closed_at = ? WHERE id = ?')
        .bind('closed', nowMs(), rid).run();
      await writeLog(env, g.user, 'receipt', rid, 'close', null);
      return ok({});
    }

    if (M === 'DELETE' && sub && sub !== 'items') {
      const g = await need(request, env, 'receipt.edit');
      if (g.error) return g.error;
      await env.DB.prepare('DELETE FROM receipt_items WHERE id = ?').bind(sub).run();
      return ok({});
    }
  }

  /* ───────── Tədarükçü malları ───────── */
  if (path === '/api/supplier-goods' && M === 'GET') {
    const g = await need(request, env, 'supplier.view');
    if (g.error) return g.error;
    const name = url.searchParams.get('name') || '';
    if (!name) {
      const rs = await env.DB.prepare(
        'SELECT supplier AS name, COUNT(*) AS n FROM products WHERE deleted_at IS NULL AND supplier IS NOT NULL GROUP BY supplier ORDER BY n DESC'
      ).all();
      return ok({ suppliers: rs.results || [] });
    }
    const rs = await env.DB.prepare(
      'SELECT * FROM products WHERE deleted_at IS NULL AND supplier = ? ORDER BY name'
    ).bind(name).all();
    const items = rs.results || [];
    if (items.length) {
      const ids = items.map(() => '?').join(',');
      const vals = items.map((x) => x.id);
      const bc = await env.DB.prepare(
        'SELECT product_id, code FROM barcodes WHERE product_id IN (' + ids + ')'
      ).bind(...vals).all();
      const im = await env.DB.prepare(
        'SELECT product_id, key FROM images WHERE product_id IN (' + ids + ') ORDER BY cover DESC, sort'
      ).bind(...vals).all();
      const bmap = {}, imap = {};
      for (const r of (bc.results || [])) (bmap[r.product_id] = bmap[r.product_id] || []).push(r.code);
      for (const r of (im.results || [])) (imap[r.product_id] = imap[r.product_id] || []).push(r.key);
      for (const it of items) { it.codes = bmap[it.id] || []; it.imgs = imap[it.id] || []; }
    }
    return ok({ supplier: name, items });
  }

  /* ───────── İstifadəçilər və icazələr ───────── */
  if (path === '/api/users') {
    const g = await need(request, env, 'users.manage');
    if (g.error) return g.error;

    if (M === 'GET') {
      const rs = await env.DB.prepare(
        'SELECT id, username, name, role, active, created_at FROM users ORDER BY created_at'
      ).all();
      const pr = await env.DB.prepare('SELECT * FROM user_perms').all();
      const map = {};
      for (const r of (pr.results || [])) (map[r.user_id] = map[r.user_id] || {})[r.perm] = !!r.allowed;
      return ok({ users: rs.results || [], perms: map, all: PERMS });
    }

    if (M === 'POST') {
      const user = String(body.user || '').trim();
      const pass = String(body.pass || '');
      if (user.length < 3 || pass.length < 4) return err('Ad və şifrə qısadır');
      const dup = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(user).first();
      if (dup) return err('Bu ad artıq var');
      const salt = newId('s'), id = newId('u');
      await env.DB.prepare(
        'INSERT INTO users (id, username, name, pass, salt, role, active, created_at) VALUES (?,?,?,?,?,?,1,?)'
      ).bind(id, user, String(body.name || user), await hashPass(pass, salt), salt,
             body.role === 'admin' ? 'admin' : 'user', nowMs()).run();
      await writeLog(env, g.user, 'user', id, 'add', user);
      return ok({ id });
    }
  }

  if (path.startsWith('/api/users/')) {
    const g = await need(request, env, 'users.manage');
    if (g.error) return g.error;
    const rest = path.slice('/api/users/'.length);
    const [uid, sub] = rest.split('/');

    if (M === 'POST' && sub === 'perm') {
      const perm = String(body.perm || '');
      const allowed = body.allowed ? 1 : 0;
      if (!PERMS.some((p) => p.key === perm)) return err('Belə icazə yoxdur');
      await env.DB.prepare(
        'INSERT INTO user_perms (user_id, perm, allowed) VALUES (?,?,?) ' +
        'ON CONFLICT(user_id, perm) DO UPDATE SET allowed = excluded.allowed'
      ).bind(uid, perm, allowed).run();
      await writeLog(env, g.user, 'user', uid, 'perm', perm + '=' + allowed);
      return ok({});
    }

    if (M === 'POST' && sub === 'pass') {
      const pass = String(body.pass || '');
      if (pass.length < 4) return err('Şifrə qısadır');
      const salt = newId('s');
      await env.DB.prepare('UPDATE users SET pass = ?, salt = ? WHERE id = ?')
        .bind(await hashPass(pass, salt), salt, uid).run();
      return ok({});
    }

    if (M === 'DELETE') {
      if (uid === g.user.id) return err('Öz hesabını silə bilməzsən');
      const admins = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first();
      const target = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(uid).first();
      if (target && target.role === 'admin' && admins && admins.n <= 1) {
        return err('Sonuncu admin silinə bilməz');
      }
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid).run();
      await env.DB.prepare('DELETE FROM user_perms WHERE user_id = ?').bind(uid).run();
      return ok({});
    }
  }

  /* ═══════════════════════════════════════════════════════
     KÖHNƏ JOLLY-DƏN İDXAL
     ───────────────────────────────────────────────────────
     Köhnə proqramın JSON nüsxəsi belədir:
       products[]: name, mainCode, brand, group, supplier,
                   location, status, price, note, barcodes[]
       brands[] / groups[] / locations[] / suppliers[]: {name}
     Şəkillər KÖÇÜRÜLMÜR — köhnədə onlar `idb:` ünvanı ilə
     yalnız telefonun daxilindədir, JSON-da yoxdur.

     Telefon böyük faylı bir dəfəyə göndərə bilmir, ona görə
     müştəri hissə-hissə (20-lik) göndərir.
     ═══════════════════════════════════════════════════════ */
  if (path === '/api/import/meta' && M === 'POST') {
    const g = await need(request, env, 'import.use');
    if (g.error) return g.error;
    const map = { brands: 'brands', groups: 'groups', locations: 'locations',
                  categories: 'categories' };
    let n = 0;

    for (const key in map) {
      const list = Array.isArray(body[key]) ? body[key] : [];
      const seen = {};
      for (const raw of list) {
        const name = String((raw && raw.name) || raw || '').trim();
        if (!name || seen[name]) continue;      // köhnədə adlar 9 dəfə təkrarlanırdı
        seen[name] = 1;
        const ex = await env.DB.prepare('SELECT id FROM ' + map[key] + ' WHERE name = ?')
          .bind(name).first();
        if (ex) continue;
        await env.DB.prepare('INSERT INTO ' + map[key] + ' (id, name) VALUES (?,?)')
          .bind(newId(key), name).run();
        n++;
      }
    }

    /* statuslar rəngi ilə, etiketlər adı ilə */
    for (const raw of (Array.isArray(body.statuses) ? body.statuses : [])) {
      const name = String((raw && raw.name) || raw || '').trim();
      if (!name) continue;
      const ex = await env.DB.prepare('SELECT id FROM statuses WHERE name = ?').bind(name).first();
      if (ex) continue;
      await env.DB.prepare('INSERT INTO statuses (id, name, color, sort) VALUES (?,?,?,?)')
        .bind(newId('st'), name, (raw && raw.color) || '#9ca3af', 50).run();
      n++;
    }
    for (const raw of (Array.isArray(body.tags) ? body.tags : [])) {
      const name = String((raw && raw.name) || raw || '').trim();
      if (!name) continue;
      const ex = await env.DB.prepare('SELECT id FROM tags WHERE name = ?').bind(name).first();
      if (ex) continue;
      await env.DB.prepare('INSERT INTO tags (id, name) VALUES (?,?)').bind(newId('tag'), name).run();
      n++;
    }

    const sup = Array.isArray(body.suppliers) ? body.suppliers : [];
    const seenS = {};
    for (const raw of sup) {
      const name = String((raw && raw.name) || raw || '').trim();
      if (!name || seenS[name]) continue;
      seenS[name] = 1;
      const ex = await env.DB.prepare('SELECT id FROM suppliers WHERE name = ?').bind(name).first();
      if (ex) continue;
      await env.DB.prepare(
        'INSERT INTO suppliers (id, name, code, created_at) VALUES (?,?,?,?)'
      ).bind(newId('sup'), name, (raw && raw.code) || null, nowMs()).run();
      n++;
    }
    return ok({ added: n });
  }

  if (path === '/api/import/products' && M === 'POST') {
    const g = await need(request, env, 'import.use');
    if (g.error) return g.error;
    const items = Array.isArray(body.items) ? body.items : [];
    const res = { added: 0, skipped: 0, codes: 0, conflicts: [] };

    for (const it of items) {
      const name = String((it && it.name) || '').trim();
      if (!name) { res.skipped++; continue; }

      /* Eyni ad + eyni kod varsa təkrar yaratmırıq */
      const dup = await env.DB.prepare(
        'SELECT id FROM products WHERE name = ? AND deleted_at IS NULL'
      ).bind(name).first();
      if (dup) { res.skipped++; continue; }

      const id = newId('p');
      const price = (it.price === '' || it.price == null) ? null : Number(it.price);
      await env.DB.prepare(
        `INSERT INTO products (id, name, main_code, brand, grp, supplier, location, status, price, note,
           color, expiry, extra_type, extra_code, tags, section_note, alert,
           category, custom, search, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(id, name, it.mainCode || it.main_code || null, it.brand || null,
             it.group || it.grp || null, it.supplier || null, it.location || null,
             it.status || null, price, it.note || null,
             it.color || null, it.expiryDate || it.expiry || null,
             it.extraCodeType || null, it.extraCodeValue || null,
             Array.isArray(it.filterTags) ? it.filterTags.join(', ') : (it.tags || null),
             it.sectionNote || null, it.alertFlag ? 1 : 0,
             it.category || null, null,
             norm(name), it.createdAt || nowMs(), nowMs()).run();
      res.added++;

      const codes = Array.isArray(it.barcodes) ? it.barcodes : [];
      for (const raw of codes) {
        const code = String(raw || '').trim();
        if (!code) continue;
        const ex = await env.DB.prepare('SELECT product_id FROM barcodes WHERE code = ?')
          .bind(code).first();
        if (ex) { res.conflicts.push(code + ' (' + name + ')'); continue; }
        await env.DB.prepare(
          'INSERT INTO barcodes (id, product_id, code, short, created_at) VALUES (?,?,?,?,?)'
        ).bind(newId('bc'), id, code, code.slice(-4), nowMs()).run();
        res.codes++;
      }
      await reindex(env, id);
    }
    await writeLog(env, g.user, 'import', null, 'products', res.added + ' mal');
    return ok(res);
  }

  /* ───────── Ehtiyat nüsxə ───────── */
  if (path === '/api/backup' && M === 'GET') {
    const g = await need(request, env, 'backup.use');
    if (g.error) return g.error;
    const tables = ['products', 'barcodes', 'images', 'suppliers', 'brands', 'groups',
                    'locations', 'folder', 'inbox', 'receipts', 'receipt_items'];
    const out = { at: nowMs(), version: 1 };
    for (const t of tables) {
      const rs = await env.DB.prepare('SELECT * FROM ' + t).all();
      out[t] = rs.results || [];
    }
    return new Response(JSON.stringify(out), {
      headers: Object.assign({}, JSON_H, {
        'Content-Disposition': 'attachment; filename="backup-' + new Date().toISOString().slice(0, 10) + '.json"',
      }),
    });
  }

  /* ═══════════════════════════════════════════════════════
     🧠 JOLLY AI
     Model YALNIZ sualı süzgəcə çevirir — cavabın rəqəmləri
     bazadan gəlir. Səbəb: kiçik modellər Azərbaycan dilində
     zəif yazır və uydurma rəqəm verə bilər.
     `AI` bağlantısı yoxdursa müştəri öz qaydaları ilə işləyir.
     ═══════════════════════════════════════════════════════ */
  if (path === '/api/ai' && M === 'POST') {
    const g = await need(request, env, 'products.view');
    if (g.error) return g.error;
    if (!env.AI) return ok({ model: false, note: 'AI bağlantısı qurulmayıb' });

    const q = String(body.q || '').trim();
    if (!q) return err('Sual boşdur');

    const sys = 'Sən mağaza inventar proqramının köməkçisisən. İstifadəçinin sualını ' +
      'YALNIZ JSON obyektinə çevir, başqa heç nə yazma. Format: ' +
      '{"filter":"...","value":"...","limit":25}. ' +
      'filter üçün mümkün dəyərlər: all, no_barcode, no_image, no_price, no_supplier, ' +
      'favorite, alert, by_supplier, by_brand, by_category, search, count. ' +
      'by_ ilə başlayanlarda value sahəsinə ad yaz. search-də value axtarış sözüdür.';

    let plan = null;
    const mo = await askModel(env, sys, q, 160);
    if (mo.ok) {
      try {
        const m = mo.text.match(/\{[\s\S]*\}/);
        if (m) plan = JSON.parse(m[0]);
      } catch (e) { plan = null; }
    }

    if (!plan || !plan.filter) return ok({ model: true, understood: false });

    /* Süzgəci SQL-ə çeviririk — rəqəmlər bazadan gəlir */
    const where = ['deleted_at IS NULL'];
    const args = [];
    const f = String(plan.filter);
    if (f === 'no_price') where.push('(price IS NULL OR price = 0)');
    if (f === 'no_supplier') where.push("(supplier IS NULL OR supplier = '')");
    if (f === 'favorite') where.push('favorite = 1');
    if (f === 'alert') where.push('alert = 1');
    if (f === 'by_supplier') { where.push('supplier = ?'); args.push(String(plan.value || '')); }
    if (f === 'by_brand') { where.push('brand = ?'); args.push(String(plan.value || '')); }
    if (f === 'by_category') { where.push('category = ?'); args.push(String(plan.value || '')); }
    if (f === 'search') { where.push('search LIKE ?'); args.push('%' + norm(plan.value || '') + '%'); }

    const lim = Math.min(50, Number(plan.limit) || 25);
    const rs = await env.DB.prepare(
      'SELECT id, name, price, brand, supplier, grp FROM products WHERE ' +
      where.join(' AND ') + ' ORDER BY updated_at DESC LIMIT ?'
    ).bind(...args, lim + 200).all();

    let items = rs.results || [];

    /* Barkod və şəkil süzgəcləri ayrıca — cədvəllərdən asılıdır */
    if (f === 'no_barcode' || f === 'no_image') {
      const tbl = f === 'no_barcode' ? 'barcodes' : 'images';
      const has = await env.DB.prepare('SELECT DISTINCT product_id FROM ' + tbl).all();
      const set = {};
      for (const r of (has.results || [])) set[r.product_id] = 1;
      items = items.filter((p) => !set[p.id]);
    }

    const total = items.length;
    items = items.slice(0, lim);
    if (items.length) {
      const ids = items.map(() => '?').join(',');
      const im = await env.DB.prepare(
        'SELECT product_id, key FROM images WHERE product_id IN (' + ids + ') ORDER BY cover DESC, sort'
      ).bind(...items.map((x) => x.id)).all();
      const map = {};
      for (const r of (im.results || [])) if (!map[r.product_id]) map[r.product_id] = r.key;
      items.forEach((x) => { x.img = map[x.id] || null; });
    }
    return ok({ model: true, understood: true, filter: f, value: plan.value || '', total, items });
  }

  /* ═══════════════════════════════════════════════════════
     📸 ETİKETDƏN OXUMAQ
     Şəkil artıq R2-dədir — açarı göndərilir, biz oxuyuruq.
     Model YALNIZ mətn çıxarır; barkodu ondan ALMIRIQ, çünki
     xırda rəqəmlərdə səhv sala bilir — barkodu telefon öz
     oxuyucusu ilə şəkildən çıxarır.
     ═══════════════════════════════════════════════════════ */
  if (path === '/api/ai/label' && M === 'POST') {
    const g = await need(request, env, 'products.create');
    if (g.error) return g.error;
    if (!env.AI) return ok({ model: false, note: 'AI bağlantısı qurulmayıb' });
    if (!env.MEDIA) return err('R2 bağlantısı yoxdur', 500);

    const key = String(body.key || '').trim();
    if (!key) return err('Şəkil açarı boşdur');
    const obj = await env.MEDIA.get('images/' + key);
    if (!obj) return err('Şəkil tapılmadı', 404);
    const bytes = [...new Uint8Array(await obj.arrayBuffer())];

    const prompt =
      'Bu, mağazadakı malın ETİKETİDİR. Üzərindəki yazıları oxu və YALNIZ JSON qaytar, ' +
      'başqa heç nə yazma. Format: ' +
      '{"name":"","price":"","code_type":"","code":"","color":"","brand":""}. ' +
      'name = malın adı. price = yalnız rəqəm (manat işarəsi olmadan). ' +
      'code_type = kodun qarşısındakı söz (no, item, art, model kimi). ' +
      'code = həmin kodun rəqəmləri. color = malın rəngi yazılıbsa. ' +
      'brand = firma adı yazılıbsa. Tapmadığın sahəni boş burax.';

    /* Modellər növbə ilə sınanır — biri əlçatan olmasa digəri */
    const MODELS = ['@cf/meta/llama-3.2-11b-vision-instruct', '@cf/llava-1.5-7b-hf'];
    let txt = '', used = null;
    for (const mdl of MODELS) {
      try {
        const r = await env.AI.run(mdl, { image: bytes, prompt, max_tokens: 400 });
        txt = String((r && (r.description || r.response || r.result)) || '');
        if (txt) { used = mdl; break; }
      } catch (e) { /* növbəti model */ }
    }
    if (!txt) return ok({ model: true, read: false, note: 'Şəkil oxunmadı' });

    let d = null;
    try {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) d = JSON.parse(m[0]);
    } catch (e) { d = null; }
    if (!d) return ok({ model: true, read: false, raw: txt.slice(0, 200) });

    /* Mövcud siyahılarla tutuşdurma — "NIVEA" → "Nivea".
       Yoxsa hər dəfə yeni təkrar marka yaranardı. */
    const near = async (table, val) => {
      const v = norm(val || '');
      if (!v) return '';
      const rs = await env.DB.prepare('SELECT name FROM ' + table).all();
      for (const r of (rs.results || [])) if (norm(r.name) === v) return r.name;
      for (const r of (rs.results || [])) {
        const n = norm(r.name);
        if (n && (n.indexOf(v) !== -1 || v.indexOf(n) !== -1)) return r.name;
      }
      return String(val || '').trim();
    };

    const price = String(d.price || '').replace(',', '.').replace(/[^\d.]/g, '');
    return ok({
      model: true, read: true, used,
      name: String(d.name || '').trim(),
      price: price || '',
      extra_type: String(d.code_type || '').trim(),
      extra_code: String(d.code || '').replace(/\D/g, ''),
      color: String(d.color || '').trim(),
      brand: await near('brands', d.brand),
    });
  }

  /* ───────── Jurnal ───────── */
  if (path === '/api/log' && M === 'GET') {
    const g = await need(request, env, null);
    if (g.error) return g.error;
    const rs = await env.DB.prepare('SELECT * FROM log ORDER BY ts DESC LIMIT 200').all();
    return ok({ items: rs.results || [] });
  }

  return err('Belə marşrut yoxdur: ' + path, 404);
}
