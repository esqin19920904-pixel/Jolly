/* ============================================================
   JOLLY — R2 şəkil serveri   (_worker.js, repo KÖKÜNDƏ)
   v1.0  (2026-08-06)

   Cloudflare Pages repo kökündə `_worker.js` görsə, BÜTÜN sorğular
   əvvəlcə buraya gəlir. Ona görə qayda sadədir:
        /api/img/... bizimdir → qalan HƏR ŞEY env.ASSETS.fetch()
   Bu sətir olmasa proqram tamamilə açılmaz.

   MARŞRUTLAR
     GET  /api/img/<key>   → R2-dən şəkli verir (1 il keşlənir)
     PUT  /api/img/<key>   → şəkli R2-yə yazır   (token tələb olunur)
     DELETE /api/img/<key> → silir                (token tələb olunur)
     GET  /api/img-ping    → bağlantı yoxlaması

   CLOUDFLARE AYARLARI (Esqin əl ilə edir, bir dəfə):
     1) R2 → Create bucket → ad: jolly-app-media
     2) Pages layihəsi → Settings → Functions → R2 bucket bindings
        Variable name: MEDIA      Bucket: jolly-app-media
     3) Settings → Environment variables → Secret
        Name: UPLOAD_TOKEN        Value: özün uzun bir söz seç
     Sonra proqramda ☁️ R2 ekranına həmin sözü yazırsan.
   ============================================================ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Jolly-Token',
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function authed(request, env) {
  const t = request.headers.get('X-Jolly-Token') || '';
  return !!env.UPLOAD_TOKEN && t === env.UPLOAD_TOKEN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* ── Bizim olmayan hər şey saytın özünə gedir ── */
    if (!path.startsWith('/api/img')) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (path === '/api/img-ping') {
      return json({
        ok: true,
        bucket: !!env.MEDIA,
        token: !!env.UPLOAD_TOKEN,
        at: Date.now(),
      });
    }

    if (!env.MEDIA) {
      return json({ ok: false, error: 'R2 bağlantısı yoxdur (MEDIA)' }, 500);
    }

    const key = decodeURIComponent(path.replace('/api/img/', '')).trim();
    if (!key || key.indexOf('..') !== -1) {
      return json({ ok: false, error: 'Yanlış açar' }, 400);
    }
    const objKey = 'images/' + key;

    try {
      if (request.method === 'GET') {
        const obj = await env.MEDIA.get(objKey);
        if (!obj) return json({ ok: false, error: 'Tapılmadı' }, 404);
        const h = new Headers(CORS);
        h.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg');
        h.set('Cache-Control', 'public, max-age=31536000, immutable');
        if (obj.httpEtag) h.set('ETag', obj.httpEtag);
        return new Response(obj.body, { headers: h });
      }

      if (request.method === 'PUT') {
        if (!authed(request, env)) return json({ ok: false, error: 'Token yanlışdır' }, 403);
        const ct = request.headers.get('Content-Type') || 'image/jpeg';
        await env.MEDIA.put(objKey, request.body, { httpMetadata: { contentType: ct } });
        return json({ ok: true, key: key });
      }

      if (request.method === 'DELETE') {
        if (!authed(request, env)) return json({ ok: false, error: 'Token yanlışdır' }, 403);
        await env.MEDIA.delete(objKey);
        return json({ ok: true, deleted: key });
      }
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 500);
    }

    return json({ ok: false, error: 'Dəstəklənmir' }, 405);
  },
};
