export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1) assetlinks.json — Cloudflare-in dot-folder upload xətasını keçmək üçün birbaşa kod içindən qaytarırıq
    if (url.pathname === "/.well-known/assetlinks.json") {
      const body = JSON.stringify([{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "app.netlify.splendid_puppy_d61fec.twa",
          sha256_cert_fingerprints: ["FD:BF:43:41:F2:BE:68:39:D2:E1:F9:FB:E4:E1:CF:0E:20:8B:C7:BF:E4:12:DD:1C:E8:3C:47:1B:C6:6E:83:19"]
        }
      }], null, 2);
      return new Response(body, {
        headers: { "content-type": "application/json" }
      });
    }

    // 2) Barkod-ilə avtomatik məhsul adı axtarışı (UPCitemdb pulsuz trial, key tələb etmir)
    if (url.pathname === "/api/barcode-lookup") {
      const upc = (url.searchParams.get("upc") || "").replace(/\D/g, "");
      if (!upc) {
        return new Response(JSON.stringify({ found: false, reason: "no_upc" }), {
          headers: { "content-type": "application/json" }
        });
      }
      try {
        const upstream = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`, {
          headers: { "accept": "application/json" }
        });
        if (!upstream.ok) {
          return new Response(JSON.stringify({ found: false, reason: "upstream_" + upstream.status }), {
            headers: { "content-type": "application/json" }
          });
        }
        const data = await upstream.json();
        if (data && data.code === "OK" && Array.isArray(data.items) && data.items.length) {
          const item = data.items[0];
          return new Response(JSON.stringify({
            found: true,
            title: item.title || "",
            brand: item.brand || "",
            image: (item.images && item.images[0]) || null
          }), { headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ found: false, reason: "not_in_db" }), {
          headers: { "content-type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ found: false, reason: "error" }), {
          headers: { "content-type": "application/json" }
        });
      }
    }

    // 3) Qalan hər şey — normal statik fayllar (index.html, app.js və s.)
    return env.ASSETS.fetch(request);
  }
}
