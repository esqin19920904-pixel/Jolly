/* ============================================================
   JOLLY SERVER — _worker.js
   v1.0  (2026-08-19)

   ────────────────────────────────────────────────────────────
   NİYƏ

   Esqin: "JOLLY-də D1, R2 yaradaq da."

   İndiyə qədər JOLLY-də bütün məlumat CİHAZDA saxlanılırdı
   (localStorage + IndexedDB). Nəticələri:
     · şəkil itirdi — yaddaş 5 MB həddinə dəyəndə yazma alınmırdı
     · kassir hesabı kompüterdə görünmürdü — istifadəçilər
       hər cihazda ayrıca saxlanılırdı
     · telefonla kompüter arasında məlumat ayrı-ayrı idi

   İndi JOLLY-nin ÖZ SERVERİ var:
     D1 — SQL bazası (məhsullar, istifadəçilər)
     R2 — fayl anbarı (şəkillər)

   ────────────────────────────────────────────────────────────
   ★★ ƏN VACİB QAYDA — SAYT SINMAMALIDIR

   Cloudflare Pages-də `_worker.js` BÜTÜN sorğuları tutur.
   Səhv olsa JOLLY ümumiyyətlə açılmır.

   Ona görə: bizim marşrutumuz olmayan HƏR sorğu dərhal
   `env.ASSETS.fetch(request)` ilə saytın özünə ötürülür.
   Serverdə xəta olsa belə sayt açılmağa davam edir.

   ────────────────────────────────────────────────────────────
   MƏLUMAT KÖÇÜRÜLMÜR, ƏLAVƏ OLUNUR

   Cihazdakı məlumata TOXUNULMUR. Server ikinci nüsxədir:
   JOLLY yenə cihazdan oxuyur, əlavə olaraq serverə göndərir.
   Beləcə internet kəsilsə də proqram işləyir.
   ============================================================ */

/* ── Cavab köməkçiləri ─────────────────────────────────────── */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(obj, code) {
  return new Response(JSON.stringify(obj), {
    status: code || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function bad(msg, code) {
  return json({ ok: false, error: msg }, code || 400);
}

/* ── SQL sxemi ─────────────────────────────────────────────────
   D1 SQLite-dır. `IF NOT EXISTS` sayəsində hər açılışda təhlükəsiz
   çağırıla bilər — mövcud cədvələ toxunmur.
   ─────────────────────────────────────────────────────────── */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS products (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL DEFAULT '',
     price       REAL,
     brand       TEXT,
     grp         TEXT,
     supplier    TEXT,
     location    TEXT,
     color       TEXT,
     note        TEXT,
     barcodes    TEXT NOT NULL DEFAULT '[]',   -- JSON massiv
     images      TEXT NOT NULL DEFAULT '[]',   -- JSON massiv (ünvanlar)
     extra       TEXT,                          -- qalan sahələr, JSON
     created_at  INTEGER,
     updated_at  INTEGER NOT NULL,
     deleted     INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS ix_products_updated ON products(updated_at)`,
  `CREATE INDEX IF NOT EXISTS ix_products_name    ON products(name)`,

  /* Barkod üzrə sürətli axtarış üçün ayrıca cədvəl.
     Bir malın bir neçə barkodu ola bilər. */
  `CREATE TABLE IF NOT EXISTS barcodes (
     code       TEXT NOT NULL,
     product_id TEXT NOT NULL,
     PRIMARY KEY (code, product_id)
   )`,
  `CREATE INDEX IF NOT EXISTS ix_barcodes_pid ON barcodes(product_id)`,

  `CREATE TABLE IF NOT EXISTS users (
     id         TEXT PRIMARY KEY,
     name       TEXT NOT NULL,
     role       TEXT NOT NULL DEFAULT 'user',
     pin        TEXT,
     extra      TEXT,
     updated_at INTEGER NOT NULL,
     deleted    INTEGER NOT NULL DEFAULT 0
   )`,

  `CREATE TABLE IF NOT EXISTS meta (
     k TEXT PRIMARY KEY,
     v TEXT
   )`,
];

async function ensureSchema(env) {
  for (const sql of SCHEMA) {
    await env.DB.prepare(sql).run();
  }
}

/* Sxem yalnız bir dəfə qurulur — hər sorğuda yox */
let schemaReady = false;
async function withSchema(env) {
  if (schemaReady) return;
  await ensureSchema(env);
  schemaReady = true;
}

/* ── Sətir → JOLLY formatı ─────────────────────────────────── */
function rowToProduct(r) {
  let extra = {};
  try { extra = r.extra ? JSON.parse(r.extra) : {}; } catch (e) {}
  return {
    ...extra,
    id: r.id,
    name: r.name || '',
    price: r.price == null ? null : r.price,
    brand: r.brand || '',
    group: r.grp || '',
    supplier: r.supplier || '',
    location: r.location || '',
    color: r.color || '',
    note: r.note || '',
    barcodes: safeArr(r.barcodes),
    images: safeArr(r.images),
    createdAt: r.created_at || undefined,
    updatedAt: r.updated_at,
    deleted: !!r.deleted,
  };
}

function safeArr(s) {
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}

/* JOLLY-nin bilinən sahələri — qalanı `extra`-ya yığılır ki,
   heç bir məlumat itməsin */
const KNOWN = new Set(['id', 'name', 'price', 'brand', 'group', 'supplier',
  'location', 'color', 'note', 'barcodes', 'images',
  'createdAt', 'updatedAt', 'deleted']);

async function upsertProduct(env, p) {
  const id = String(p.id || '').trim();
  if (!id) return { ok: false, error: 'id yoxdur' };

  const extra = {};
  for (const k of Object.keys(p)) if (!KNOWN.has(k)) extra[k] = p[k];

  const bc = Array.isArray(p.barcodes) ? p.barcodes.map(String).filter(Boolean) : [];
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO products
       (id,name,price,brand,grp,supplier,location,color,note,
        barcodes,images,extra,created_at,updated_at,deleted)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, price=excluded.price, brand=excluded.brand,
       grp=excluded.grp, supplier=excluded.supplier, location=excluded.location,
       color=excluded.color, note=excluded.note, barcodes=excluded.barcodes,
       images=excluded.images, extra=excluded.extra,
       updated_at=excluded.updated_at, deleted=excluded.deleted`
  ).bind(
    id, String(p.name || ''),
    (p.price === '' || p.price == null) ? null : Number(p.price),
    p.brand || null, p.group || null, p.supplier || null,
    p.location || null, p.color || null, p.note || null,
    JSON.stringify(bc),
    JSON.stringify(Array.isArray(p.images) ? p.images : []),
    Object.keys(extra).length ? JSON.stringify(extra) : null,
    p.createdAt || now,
    Number(p.updatedAt) || now,
    p.deleted ? 1 : 0
  ).run();

  /* Barkod cədvəlini yenidən qururuq — sadə və etibarlıdır */
  await env.DB.prepare(`DELETE FROM barcodes WHERE product_id = ?`).bind(id).run();
  for (const code of bc) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO barcodes (code, product_id) VALUES (?,?)`
    ).bind(code, id).run();
  }
  return { ok: true, id };
}

/* ══════════════════════════════════════════════════════════════
   MARŞRUTLAR
   ══════════════════════════════════════════════════════════════ */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const M = request.method;

    /* ★ Bizim olmayan hər şey dərhal saytın özünə.
       Bu sətir olmasa JOLLY açılmaz. */
    if (!path.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('OK');
    }

    if (M === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {
      /* ── Vəziyyət ─────────────────────────────────────────── */
      if (path === '/api/ping') {
        let count = null;
        try {
          if (env.DB) {
            await withSchema(env);
            const r = await env.DB.prepare(
              `SELECT COUNT(*) AS n FROM products WHERE deleted = 0`).first();
            count = r ? r.n : null;
          }
        } catch (e) { count = 'xəta: ' + String(e && e.message).slice(0, 80); }

        return json({
          ok: true, app: 'JOLLY', wv: '2026-08-19-jolly-server',
          db: !!env.DB, media: !!env.MEDIA, assets: !!env.ASSETS,
          products: count, at: Date.now(),
        });
      }

      /* ── 🖼 ŞƏKİL YÜKLƏMƏ ──────────────────────────────────
         Açarı SERVER yaradır → mövcud şəkil əzilə bilmir. */
      if (path === '/api/img' && M === 'POST') {
        if (!env.MEDIA) return bad('R2 bağlantısı yoxdur (MEDIA)', 503);
        const ct = (request.headers.get('Content-Type') || '').toLowerCase();
        if (!ct.startsWith('image/')) return bad('Yalnız şəkil qəbul olunur', 415);
        const len = Number(request.headers.get('Content-Length') || 0);
        if (len && len > 5 * 1024 * 1024) return bad('Şəkil 5 MB-dan böyükdür', 413);

        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
        const key = 'p_' + Date.now().toString(36) + '_' +
                    Math.random().toString(36).slice(2, 10) + '.' + ext;
        await env.MEDIA.put('images/' + key, request.body, {
          httpMetadata: { contentType: ct, cacheControl: 'public, max-age=31536000' },
        });
        return json({ ok: true, key, url: url.origin + '/api/img/' + key });
      }

      /* ── 🖼 ŞƏKİL GÖSTƏRMƏ ─────────────────────────────────── */
      if (path.startsWith('/api/img/') && (M === 'GET' || M === 'HEAD')) {
        if (!env.MEDIA) return bad('R2 yoxdur', 503);
        const key = decodeURIComponent(path.slice('/api/img/'.length)).trim();
        if (!key || key.includes('..')) return bad('Yanlış açar', 400);
        const obj = await env.MEDIA.get('images/' + key);
        if (!obj) return new Response('Tapılmadı', { status: 404, headers: CORS });
        return new Response(obj.body, {
          headers: {
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
            ...CORS,
          },
        });
      }

      /* ── 📦 MƏHSULLAR: GÖNDƏR (cihaz → server) ────────────── */
      if (path === '/api/products/push' && M === 'POST') {
        if (!env.DB) return bad('D1 bağlantısı yoxdur (DB)', 503);
        await withSchema(env);

        let body = {};
        try { body = await request.json(); } catch (e) { return bad('JSON oxunmadı'); }
        const list = Array.isArray(body.products) ? body.products : [];
        if (!list.length) return json({ ok: true, saved: 0 });
        if (list.length > 500) return bad('Bir dəfəyə ən çox 500 mal', 413);

        let saved = 0; const errors = [];
        for (const p of list) {
          const r = await upsertProduct(env, p);
          if (r.ok) saved++; else errors.push(r.error);
        }
        return json({ ok: true, saved, errors: errors.slice(0, 5) });
      }

      /* ── 📦 MƏHSULLAR: AL (server → cihaz) ────────────────── */
      if (path === '/api/products' && M === 'GET') {
        if (!env.DB) return bad('D1 yoxdur', 503);
        await withSchema(env);
        const since = Number(url.searchParams.get('since') || 0);
        const limit = Math.min(Number(url.searchParams.get('limit') || 500), 1000);
        const rows = await env.DB.prepare(
          `SELECT * FROM products WHERE updated_at > ? ORDER BY updated_at ASC LIMIT ?`
        ).bind(since, limit).all();
        const items = (rows.results || []).map(rowToProduct);
        const last = items.length ? items[items.length - 1].updatedAt : since;
        return json({ ok: true, products: items, count: items.length, since: last });
      }

      /* ── 🔍 BARKODLA TAP ──────────────────────────────────── */
      if (path === '/api/bc' && M === 'GET') {
        if (!env.DB) return bad('D1 yoxdur', 503);
        await withSchema(env);
        const q = String(url.searchParams.get('q') || '').trim();
        if (!q) return bad('q boşdur');
        const rows = await env.DB.prepare(
          `SELECT p.* FROM products p
             JOIN barcodes b ON b.product_id = p.id
            WHERE b.code LIKE ? AND p.deleted = 0
            LIMIT 50`
        ).bind('%' + q + '%').all();
        return json({ ok: true, products: (rows.results || []).map(rowToProduct) });
      }

      /* ── 👥 İSTİFADƏÇİLƏR ─────────────────────────────────── */
      if (path === '/api/users' && M === 'GET') {
        if (!env.DB) return bad('D1 yoxdur', 503);
        await withSchema(env);
        const rows = await env.DB.prepare(
          `SELECT * FROM users WHERE deleted = 0 ORDER BY name`).all();
        return json({
          ok: true,
          users: (rows.results || []).map(u => {
            let ex = {};
            try { ex = u.extra ? JSON.parse(u.extra) : {}; } catch (e) {}
            return { ...ex, id: u.id, name: u.name, role: u.role,
                     pin: u.pin || '', updatedAt: u.updated_at };
          }),
        });
      }

      if (path === '/api/users/push' && M === 'POST') {
        if (!env.DB) return bad('D1 yoxdur', 503);
        await withSchema(env);
        let body = {};
        try { body = await request.json(); } catch (e) { return bad('JSON oxunmadı'); }
        const list = Array.isArray(body.users) ? body.users : [];
        let saved = 0;
        for (const u of list) {
          const id = String(u.id || '').trim();
          if (!id) continue;
          const ex = {};
          for (const k of Object.keys(u)) {
            if (!['id', 'name', 'role', 'pin', 'updatedAt', 'deleted'].includes(k)) ex[k] = u[k];
          }
          await env.DB.prepare(
            `INSERT INTO users (id,name,role,pin,extra,updated_at,deleted)
             VALUES (?,?,?,?,?,?,?)
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, role=excluded.role, pin=excluded.pin,
               extra=excluded.extra, updated_at=excluded.updated_at,
               deleted=excluded.deleted`
          ).bind(id, String(u.name || 'Adsız'), String(u.role || 'user'),
                 u.pin ? String(u.pin) : null,
                 Object.keys(ex).length ? JSON.stringify(ex) : null,
                 Number(u.updatedAt) || Date.now(), u.deleted ? 1 : 0).run();
          saved++;
        }
        return json({ ok: true, saved });
      }

      /* ── 📊 SAYLAR ────────────────────────────────────────── */
      if (path === '/api/stats' && M === 'GET') {
        if (!env.DB) return bad('D1 yoxdur', 503);
        await withSchema(env);
        const r = await env.DB.prepare(
          `SELECT
             COUNT(*)                                       AS cemi,
             SUM(CASE WHEN barcodes='[]' THEN 1 ELSE 0 END) AS barkodsuz,
             SUM(CASE WHEN images='[]'   THEN 1 ELSE 0 END) AS sekilsiz,
             SUM(CASE WHEN price IS NULL OR price=0 THEN 1 ELSE 0 END) AS qiymetsiz
           FROM products WHERE deleted = 0`
        ).first();
        return json({ ok: true, stats: r || {} });
      }

      return bad('Belə marşrut yoxdur: ' + path, 404);

    } catch (e) {
      /* Server xətası saytı sındırmamalıdır */
      return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500);
    }
  },
};
