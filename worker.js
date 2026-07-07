export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
    return env.ASSETS.fetch(request);
  }
}
