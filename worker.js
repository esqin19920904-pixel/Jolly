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

    // 3) TELEGRAM BOT WEBHOOK — YALNIZ OXUMA (Firebase-i dəyişmir, təhlükəsiz)
    // Telegram bu ünvana POST edir: https://<worker-domenin>/telegram-webhook
    if (url.pathname === "/telegram-webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    // 4) Qalan hər şey — normal statik fayllar (index.html, app.js və s.)
    return env.ASSETS.fetch(request);
  }
};

/* ==========================================================================
   TELEGRAM BOT MƏNTİQİ
   ==========================================================================
   env.TELEGRAM_BOT_TOKEN — Cloudflare Dashboard-da "Environment Variables"
   (Secret) bölməsindən əlavə olunmalıdır.

   Dəstəklənən əmrlər: /start, /help, /search <söz>, /report
   /add, /stock, /voice BİLƏRƏKDƏN YOXDUR (stok/satış JOLLY-də mövcud deyil,
   /add isə Firebase-ə təhlükəsiz yazmaq üçün əlavə diqqət tələb edir).
   ========================================================================== */

const FIREBASE_URL = "https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app/jolly.json";

async function fetchJollyData() {
  const res = await fetch(FIREBASE_URL);
  if (!res.ok) throw new Error("Firebase oxuna bilmədi: " + res.status);
  const payload = await res.json();
  if (!payload || !payload.data) return null;
  return payload.data;
}

async function sendTelegramMessage(env, chatId, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
  });
}

// Base64 data URL-i Telegram-a "photo" kimi göndərir (multipart/form-data)
async function sendTelegramPhoto(env, chatId, caption, dataUrl) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token || !dataUrl) return false;
  try {
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/jpeg" });

    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", blob, "photo.jpg");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form
    });
    const data = await res.json();
    return !!data.ok;
  } catch (e) {
    return false;
  }
}

function escHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handleTelegramWebhook(request, env) {
  let update;
  try {
    update = await request.json();
  } catch (e) {
    return new Response("ok"); // Telegram-a hər halda 200 qaytarırıq
  }

  const message = update.message;
  if (!message || !message.text) return new Response("ok");

  const chatId = message.chat.id;
  const text = message.text.trim();

  try {
    if (text === "/start") {
      await sendTelegramMessage(env, chatId,
        "Salam! 👋 Mən JOLLY Assistant.\n\n" +
        "🔍 /search [ad və ya barkod] — Məhsul axtar\n" +
        "📊 /report — Ümumi vəziyyət\n" +
        "🆔 /myid — Chat ID-ni göstər\n" +
        "❓ /help — Kömək"
      );
    } else if (text === "/myid") {
      await sendTelegramMessage(env, chatId, `🆔 Sənin Chat ID-n: <code>${chatId}</code>`);
    } else if (text === "/help") {
      await sendTelegramMessage(env, chatId,
        "📋 <b>Əmrlər:</b>\n" +
        "/search corab — adına görə axtar\n" +
        "/search 1234567890123 — barkoda görə axtar\n" +
        "/report — ümumi say, şəkilsiz, barkodsuz say"
      );
    } else if (text.startsWith("/search")) {
      const query = text.replace("/search", "").trim().toLowerCase();
      if (!query) {
        await sendTelegramMessage(env, chatId, "Axtarmaq üçün: /search corab");
        return new Response("ok");
      }
      const data = await fetchJollyData();
      if (!data || !Array.isArray(data.products)) {
        await sendTelegramMessage(env, chatId, "⚠️ Bulud məlumatı tapılmadı — Cloud Studio-dan bir dəfə sinxron et.");
        return new Response("ok");
      }
      const matches = data.products.filter(p => {
        const hay = [p.name, p.mainCode, ...(p.barcodes || [])].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(query);
      }).slice(0, 5);

      if (!matches.length) {
        await sendTelegramMessage(env, chatId, `❌ "${escHtml(query)}" üçün nəticə tapılmadı.`);
      } else {
        for (const p of matches) {
          const parts = [
            "📦 <b>" + escHtml(p.name || "Adsız") + "</b>",
            (p.price != null && p.price !== "") ? "💰 " + p.price + " ₼" : null,
            p.location ? "📍 " + escHtml(p.location) : null,
            (p.barcodes && p.barcodes[0]) ? "🏷️ " + escHtml(p.barcodes[0]) : null,
          ].filter(Boolean).join("\n");

          let sentAsPhoto = false;
          if (p.thumb) {
            sentAsPhoto = await sendTelegramPhoto(env, chatId, parts, p.thumb);
          }
          if (!sentAsPhoto) {
            await sendTelegramMessage(env, chatId, parts);
          }
        }
      }
    } else if (text === "/report") {
      const data = await fetchJollyData();
      if (!data || !Array.isArray(data.products)) {
        await sendTelegramMessage(env, chatId, "⚠️ Bulud məlumatı tapılmadı — Cloud Studio-dan bir dəfə sinxron et.");
        return new Response("ok");
      }
      const products = data.products;
      const total = products.length;
      const noImage = products.filter(p => !p.images || !p.images.length).length;
      const noBarcode = products.filter(p => !p.barcodes || !p.barcodes.length).length;
      const todayStr = new Date().toDateString();
      const addedToday = products.filter(p => p.createdAt && new Date(p.createdAt).toDateString() === todayStr).length;

      await sendTelegramMessage(env, chatId,
        `📊 <b>Ümumi vəziyyət</b>\n` +
        `📦 Ümumi məhsul: ${total}\n` +
        `➕ Bu gün əlavə: ${addedToday}\n` +
        `🖼️ Şəkli yoxdur: ${noImage}\n` +
        `🏷️ Barkodsuz: ${noBarcode}`
      );
    } else {
      await sendTelegramMessage(env, chatId, "Naməlum əmr. /help yaz.");
    }
  } catch (e) {
    await sendTelegramMessage(env, chatId, "⚠️ Xəta baş verdi: " + String(e.message || e));
  }

  return new Response("ok");
}
