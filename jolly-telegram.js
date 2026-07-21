/* ==========================================================================
   JOLLY TELEGRAM BİLDİRİŞLƏRİ (jolly-telegram.js)
   ==========================================================================
   Sadə, etibarlı yanaşma: JOLLY-nin özü (client) BİRBAŞA Telegram Bot
   API-sinə mesaj göndərir. Heç bir backend/server, heç bir Firebase-oxuma
   lazım deyil — yalnız bot token + chat ID kifayətdir.

   NƏ EDİR:
   1) Yeni məhsul əlavə olunanda → Telegram-a bildiriş
   2) Gündəlik snapshot (Arxiv) alınanda → "Arxiv hazırdır" bildirişi
   3) Gündə bir dəfə → Gündəlik Xülasə mesajı (real JollyDailySummary datası)
   4) "Test göndər" düyməsi ilə qurulmanı yoxlamaq

   YENİ (2026-07-21):
   5) 🔕 Səssiz bildirişlər — açılsa, bütün mesajlar Telegram-ın
      disable_notification=true parametri ilə göndərilir (cihazda səs/
      vibrasiya olmadan, sadəcə siyahıda görünür).
   6) 👤 İşçi bildirişləri üçün AYRI Chat ID (könüllü) — işçi girişi və
      icazə rədd edilməsi bildirişləri, doldurulubsa bu ayrı chat-a,
      doldurulmayıbsa əsas Chat ID-yə gedir (məs. sahibkarın öz Telegramı
      "yeni məhsul" kimi sakit bildirişlərlə, işçi ilə bağlı xəbərdarlıqlar
      isə fərqli/ayrı bir Telegram söhbətinə getsin deyə).

   NƏ ETMİR (bilərəkdən):
   - Stok/satış bildirişi YOXDUR (JOLLY-də belə məlumat yoxdur)
   - Uzaqdan sual-cavab (/search və s.) YOXDUR — bu, backend + Firebase
     strukturunun bilinməsini tələb edir, hazırda mövcud deyil
   - Səsli mesaj transkripsiyası YOXDUR — ödənişli API (Whisper) tələb edir

   QURAŞDIRMA (istifadəçi üçün):
   1. Telegram-da @BotFather-ə yaz, /newbot ilə bot yarat, TOKEN al
   2. Öz bot-unla söhbətə "Salam" yaz (bu vacibdir!)
   3. Bu linki aç (TOKEN-i öz tokeninlə əvəz et):
      https://api.telegram.org/botTOKEN/getUpdates
      Cavabda "chat":{"id": RƏQƏM} — həmin RƏQƏM sənin Chat ID-ndir
   4. JOLLY-də Alətlər → 📨 Telegram Bildirişləri → TOKEN və Chat ID-ni yaz, saxla
   ========================================================================== */

(function () {
  "use strict";

  const TOKEN_KEY = "jolly_tg_token";
  const CHAT_KEY = "jolly_tg_chat";
  const CHAT_EMPLOYEE_KEY = "jolly_tg_chat_employee";
  const SETTINGS_KEY = "jolly_tg_settings";
  const LAST_DAILY_KEY = "jolly_tg_last_daily";

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function getChat() { try { return localStorage.getItem(CHAT_KEY) || ""; } catch (e) { return ""; } }
  function getChatEmployee() { try { return localStorage.getItem(CHAT_EMPLOYEE_KEY) || ""; } catch (e) { return ""; } }
  function setToken(v) { try { localStorage.setItem(TOKEN_KEY, v.trim()); } catch (e) {} }
  function setChat(v) { try { localStorage.setItem(CHAT_KEY, v.trim()); } catch (e) {} }
  function setChatEmployee(v) { try { localStorage.setItem(CHAT_EMPLOYEE_KEY, v.trim()); } catch (e) {} }

  function getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch (e) { return {}; }
  }
  function setSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function isConfigured() {
    return !!(getToken() && getChat());
  }

  // targetChat: hansı Chat ID-yə göndərilsin (verilməzsə əsas Chat ID).
  // Səssiz rejim aktivdirsə, hər mesaj disable_notification=true ilə gedir.
  async function sendMessage(text, targetChat) {
    const token = getToken();
    const chat = targetChat || getChat();
    if (!token || !chat) return { ok: false, error: "Token/Chat ID yoxdur" };
    const settings = getSettings();
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat, text, parse_mode: "HTML",
          disable_notification: !!settings.silentMode,
        })
      });
      const data = await res.json();
      if (!data.ok) return { ok: false, error: data.description || "Naməlum xəta" };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  // İşçi ilə bağlı bildirişlər (giriş, icazə rədd) üçün — ayrı chat
  // ayarlanıbsa ora, ayarlanmayıbsa əsas Chat ID-yə göndərir.
  function sendEmployeeMessage(text) {
    const target = getChatEmployee() || getChat();
    return sendMessage(text, target);
  }

  // ------------------------------------------------------------------------
  // ŞƏKİL SIXMA — canvas ilə kiçik, sıxılmış versiya (Telegram üçün kifayət)
  // ------------------------------------------------------------------------
  function compressDataUrl(dataUrl, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality || 0.6));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  // "idb:" referansını əsl data URL-ə çevirir (JollyStorage varsa), yoxsa
  // olduğu kimi qaytarır (artıq data: URL-dirsə)
  async function resolveImageRef(ref) {
    if (!ref) return null;
    if (ref.startsWith && ref.startsWith("idb:") && typeof JollyStorage !== "undefined" && JollyStorage.resolveAll) {
      try {
        const resolved = await JollyStorage.resolveAll([ref]);
        return (resolved && resolved[0]) || null;
      } catch (e) { return null; }
    }
    return ref;
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(meta)[1];
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function sendPhoto(caption, dataUrl, targetChat) {
    const token = getToken();
    const chat = targetChat || getChat();
    if (!token || !chat) return { ok: false, error: "Token/Chat ID yoxdur" };
    const settings = getSettings();
    try {
      const blob = dataUrlToBlob(dataUrl);
      const form = new FormData();
      form.append("chat_id", chat);
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      form.append("disable_notification", settings.silentMode ? "true" : "false");
      form.append("photo", blob, "photo.jpg");
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form
      });
      const data = await res.json();
      if (!data.ok) return { ok: false, error: data.description || "Naməlum xəta" };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  // ------------------------------------------------------------------------
  // 1) YENİ MƏHSUL BİLDİRİŞİ — JollyDB.Products.add-ı bükür
  // ------------------------------------------------------------------------
  function wrapProductAdd() {
    if (typeof JollyDB === "undefined" || !JollyDB.Products || JollyDB.Products._tgWrapped) return;
    const originalAdd = JollyDB.Products.add;
    JollyDB.Products.add = function (item) {
      const record = originalAdd.call(this, item);
      const settings = getSettings();
      if (settings.newProduct !== false && isConfigured()) {
        const caption = [
          "➕ <b>Yeni məhsul əlavə edildi</b>",
          record.name ? "📦 " + escHtml(record.name) : null,
          (record.price != null && record.price !== "") ? "💰 " + record.price + " ₼" : null,
          record.brand ? "🏭 " + escHtml(record.brand) : null,
        ].filter(Boolean).join("\n");

        const firstImage = record.images && record.images[0];
        if (firstImage) {
          resolveImageRef(firstImage)
            .then(resolved => resolved ? compressDataUrl(resolved, 700, 0.6) : null)
            .then(compressed => {
              if (compressed) return sendPhoto(caption, compressed);
              return sendMessage(caption);
            })
            .catch(() => sendMessage(caption)); // şəkil alınmasa, heç olmasa mətni göndər
        } else {
          sendMessage(caption);
        }
      }
      return record;
    };
    JollyDB.Products._tgWrapped = true;
  }

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ------------------------------------------------------------------------
  // 2) ARXİV HAZIRDIR BİLDİRİŞİ — jolly-archive.js-in gündəlik indeksini yoxlayır
  // ------------------------------------------------------------------------
  function checkArchiveNotify() {
    const settings = getSettings();
    if (settings.archiveAlert === false || !isConfigured()) return;
    let idx = [];
    try { idx = JSON.parse(localStorage.getItem("jolly_archive_index") || "[]"); } catch (e) { return; }
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = idx.find(x => x.date === today && !x.manual);
    if (!todayEntry) return;
    const notifiedKey = "jolly_tg_archive_notified_" + today;
    try {
      if (localStorage.getItem(notifiedKey)) return;
      localStorage.setItem(notifiedKey, "1");
    } catch (e) {}
    sendMessage(`✅ <b>${today}</b> arxivi hazırdır (avtomatik gündəlik nüsxə alındı).`);
  }

  // ------------------------------------------------------------------------
  // 3) GÜNDƏLİK XÜLASƏ — JollyDailySummary.computeSummary()-dən istifadə edir
  // ------------------------------------------------------------------------
  function checkDailySummaryNotify() {
    const settings = getSettings();
    if (settings.dailySummary === false || !isConfigured()) return;
    if (typeof window.JollyDailySummary === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    let last = null;
    try { last = localStorage.getItem(LAST_DAILY_KEY); } catch (e) {}
    if (last === today) return;
    try { localStorage.setItem(LAST_DAILY_KEY, today); } catch (e) {}

    const s = window.JollyDailySummary.computeSummary();
    const lines = [
      `📊 <b>Gündəlik Xülasə — ${today}</b>`,
      `➕ Bu gün əlavə: ${s.addedToday}`,
      `📦 Ümumi məhsul: ${s.total}`,
      `🖼️ Şəkli yoxdur: ${s.noImage}`,
      `🕸️ 60+ gün toxunulmayıb: ${s.stale}`
    ].join("\n");
    sendMessage(lines);
  }

  // ------------------------------------------------------------------------
  // UI — Alətlər menyusundan açılan ayar paneli
  // ------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-tg-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-tg-styles";
    style.textContent = `
      #jolly-tg-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-tg-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 86vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-tg-panel h2 {
        margin: 0 0 4px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jtg-note { font-size: 11px; color: #999; margin-bottom: 14px; line-height: 1.5; }
      .jtg-field label { font-size: 12px; color: #ccc; display: block; margin-bottom: 4px; }
      .jtg-field input {
        width: 100%; background: #232323; color: #f0e6c8; border: 1px solid #444;
        border-radius: 10px; padding: 10px 12px; font-size: 13px; box-sizing: border-box; margin-bottom: 12px;
      }
      .jtg-toggle-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 0; border-bottom: 1px solid #2a2a2a; font-size: 13px;
      }
      .jtg-btn-row { display: flex; gap: 8px; margin-top: 16px; }
      .jtg-btn { flex: 1; padding: 11px; border-radius: 10px; border: none; font-size: 13px; cursor: pointer; }
      .jtg-btn.primary { background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a; font-weight: 600; }
      .jtg-btn.ghost { background: #333; color: #eee; }
      .jtg-status { margin-top: 12px; font-size: 12px; text-align: center; min-height: 16px; }
    `;
    document.head.appendChild(style);
  }

  function renderPanel() {
    const panel = document.getElementById("jolly-tg-panel");
    if (!panel) return;
    const settings = getSettings();
    panel.innerHTML = `
      <h2>📨 Telegram Bildirişləri <button onclick="document.getElementById('jolly-tg-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
      <div class="jtg-note">
        1) Telegram-da @BotFather-ə yaz, /newbot ilə bot yarat, TOKEN al.<br>
        2) Öz botunla söhbətə "Salam" yaz.<br>
        3) Brauzerdə aç: https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates — "chat":{"id": RƏQƏM} tap.<br>
        4) Aşağıya TOKEN və Chat ID-ni yaz.
      </div>
      <div class="jtg-field">
        <label>Bot Token</label>
        <input id="jtg-token" placeholder="123456789:ABC..." value="${getToken()}">
      </div>
      <div class="jtg-field">
        <label>Chat ID (əsas — sənin üçün: yeni məhsul, xülasə və s.)</label>
        <input id="jtg-chat" placeholder="123456789" value="${getChat()}">
      </div>
      <div class="jtg-field">
        <label>👤 İşçi bildirişləri üçün AYRI Chat ID (könüllü)</label>
        <input id="jtg-chat-employee" placeholder="Boş qalsa, əsas Chat ID istifadə olunur" value="${getChatEmployee()}">
      </div>
      <div class="jtg-toggle-row">
        <span>➕ Yeni məhsul bildirişi</span>
        <input type="checkbox" id="jtg-t-new" ${settings.newProduct !== false ? "checked" : ""}>
      </div>
      <div class="jtg-toggle-row">
        <span>🗄️ Arxiv hazırdır bildirişi</span>
        <input type="checkbox" id="jtg-t-archive" ${settings.archiveAlert !== false ? "checked" : ""}>
      </div>
      <div class="jtg-toggle-row">
        <span>📊 Gündəlik Xülasə bildirişi</span>
        <input type="checkbox" id="jtg-t-daily" ${settings.dailySummary !== false ? "checked" : ""}>
      </div>
      <div class="jtg-toggle-row">
        <span>👤 İşçi girişi / icazə rədd bildirişi</span>
        <input type="checkbox" id="jtg-t-denied" ${settings.deniedAlert !== false ? "checked" : ""}>
      </div>
      <div class="jtg-toggle-row">
        <span>🔕 Səssiz bildirişlər (səs/vibrasiya olmadan)</span>
        <input type="checkbox" id="jtg-t-silent" ${settings.silentMode === true ? "checked" : ""}>
      </div>
      <div class="jtg-btn-row">
        <button class="jtg-btn ghost" id="jtg-save">💾 Saxla</button>
        <button class="jtg-btn primary" id="jtg-test">📤 Test göndər</button>
      </div>
      <div class="jtg-status" id="jtg-status"></div>
    `;

    panel.querySelector("#jtg-save").onclick = () => {
      setToken(panel.querySelector("#jtg-token").value);
      setChat(panel.querySelector("#jtg-chat").value);
      setChatEmployee(panel.querySelector("#jtg-chat-employee").value);
      setSettings({
        newProduct: panel.querySelector("#jtg-t-new").checked,
        archiveAlert: panel.querySelector("#jtg-t-archive").checked,
        dailySummary: panel.querySelector("#jtg-t-daily").checked,
        deniedAlert: panel.querySelector("#jtg-t-denied").checked,
        silentMode: panel.querySelector("#jtg-t-silent").checked,
      });
      panel.querySelector("#jtg-status").textContent = "✅ Saxlanıldı";
    };

    panel.querySelector("#jtg-test").onclick = async () => {
      setToken(panel.querySelector("#jtg-token").value);
      setChat(panel.querySelector("#jtg-chat").value);
      const statusEl = panel.querySelector("#jtg-status");
      statusEl.textContent = "⏳ Göndərilir...";
      const result = await sendMessage("👋 JOLLY-dən test mesajı — hər şey işləyir!");
      statusEl.textContent = result.ok ? "✅ Göndərildi — Telegram-a bax" : "❌ Xəta: " + result.error;
    };
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-tg-overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "jolly-tg-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `<div id="jolly-tg-panel"></div>`;
    document.body.appendChild(overlay);
    renderPanel();
  }

  function init() {
    if (typeof JollyDB === "undefined") {
      setTimeout(init, 300);
      return;
    }
    wrapProductAdd();
    setTimeout(checkArchiveNotify, 4000);
    setTimeout(checkDailySummaryNotify, 4500);

    // İşçi girişi bildirişi — yalnız User daxil olanda (Admin özünə bildiriş almır)
    // JollyEvents hələ yüklənməyibsə, hazır olana qədər gözlə (skript sırası fərq etməsin)
    registerLoginListener();
  }

  const _deniedThrottle = new Map(); // "userId:key" -> son göndərmə vaxtı

  function registerLoginListener(attempt) {
    attempt = attempt || 0;
    if (window.JollyEvents) {
      JollyEvents.on('user.login', (payload) => {
        if (!payload || payload.role !== 'user') return;
        if (!isConfigured()) return;
        const time = new Date().toLocaleString('az-AZ');
        sendEmployeeMessage(`👤 <b>${payload.name}</b> daxil oldu\n🕐 ${time}`);
      });

      JollyEvents.on('permission.denied', (payload) => {
        if (!payload || !payload.userId) return; // Admin-in özü üçün deyil
        if (!isConfigured()) return;
        const settings = getSettings();
        if (settings.deniedAlert === false) return; // istəsə söndürə bilər
        const throttleKey = payload.userId + ':' + payload.key;
        const last = _deniedThrottle.get(throttleKey) || 0;
        if (Date.now() - last < 60000) return; // eyni cəhd 1 dəqiqədə bir dəfə
        _deniedThrottle.set(throttleKey, Date.now());
        const time = new Date().toLocaleString('az-AZ');
        const name = payload.userName || 'Naməlum';
        sendEmployeeMessage(`⚠️ <b>${name}</b> icazəsiz əməliyyata cəhd etdi\n🔒 ${payload.key}\n🕐 ${time}`);
      });
      return;
    }
    if (attempt > 20) return; // ~10 saniyədən sonra vaz keç (JollyEvents ümumiyyətlə yoxdursa)
    setTimeout(() => registerLoginListener(attempt + 1), 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.JollyTelegram = {
    id: "telegram",
    name: "Telegram Bildirişləri",
    version: "1.1.0",
    show,
    sendMessage,
    sendEmployeeMessage,
    isConfigured
  };

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(window.JollyTelegram);
  }
})();
