/* ==========================================================================
   JOLLY ŞƏKİL TƏMİZLƏYİCİ MODULU (bg-remove.js)
   ==========================================================================
   Roadmap #3: Məhsul şəklinin arxa fonunu silib ağ/şəffaf fona keçirmək.

   Necə işləyir:
   - @imgly/background-removal kitabxanasından istifadə edir (CDN-dən yüklənir)
   - Bu kitabxana TAMAMILƏ BRAUZERDƏ işləyir (WebAssembly/ML modeli),
     heç bir API açarı, heç bir server tələb etmir, şəkil heç yerə göndərilmir
   - İlk istifadədə modeli yükləmək üçün internet lazımdır (bir neçə MB),
     bir dəfə yükləndikdən sonra brauzer keşləyir
   - Nəticə: şəffaf PNG (istəsən ağ fonlu versiya da yaradıla bilər)
   - Hazır şəkli "Yüklə" düyməsi ilə telefonun qalereyasına saxlaya bilərsən,
     sonra məhsul formasında "Qalereyadan seç" ilə əlavə edərsən

   Qeyd: Bu, birbaşa məhsul formasına inteqrasiya EDİLMİR (products.js-ə
   toxunmur, risk olmasın deyə) — ayrıca alət kimi işləyir.

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də əlavə et: <script src="bg-remove.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  const CDN_URL = "https://esm.sh/@imgly/background-removal@1.5.7";
  const REMOVE_OPTS = { model: "isnet_quint8", device: "cpu" };
  const TIMEOUT_MS = 40000;
  let libPromise = null;

  function loadLib() {
    if (!libPromise) {
      libPromise = import(CDN_URL).catch(err => {
        libPromise = null;
        throw err;
      });
    }
    return libPromise;
  }

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error((label || "Əməliyyat") + " " + (ms / 1000) + " saniyədə bitmədi (timeout)")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-bg-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-bg-styles";
    style.textContent = `
      #jolly-bg-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.8);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-bg-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 88vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-bg-panel h2 {
        margin: 0 0 12px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jbg-drop {
        border: 2px dashed #444; border-radius: 14px; padding: 30px 12px;
        text-align: center; cursor: pointer; color: #999; font-size: 13px;
      }
      .jbg-preview-row { display: flex; gap: 10px; margin: 14px 0; }
      .jbg-preview-col { flex: 1; text-align: center; }
      .jbg-preview-col img {
        width: 100%; max-height: 200px; object-fit: contain; border-radius: 10px;
        background:
          linear-gradient(45deg,#333 25%,transparent 25%),
          linear-gradient(-45deg,#333 25%,transparent 25%),
          linear-gradient(45deg,transparent 75%,#333 75%),
          linear-gradient(-45deg,transparent 75%,#333 75%);
        background-size: 16px 16px;
        background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
        background-color: #222;
      }
      .jbg-preview-label { font-size: 11px; color: #999; margin-top: 6px; }
      .jbg-status { text-align: center; font-size: 13px; color: #d4af37; padding: 20px 0; }
      .jbg-btn-row { display: flex; gap: 8px; margin-top: 14px; }
      .jbg-btn {
        flex: 1; padding: 11px 0; border-radius: 10px; border: none;
        font-size: 12.5px; font-weight: 600; cursor: pointer; text-align: center;
        text-decoration: none; display: block; color: #1a1a1a;
      }
      .jbg-btn.transparent { background: linear-gradient(135deg,#d4af37,#f4d675); }
      .jbg-btn.white { background: #e6e6e6; }
      .jbg-retry-btn {
        width: 100%; padding: 10px; border-radius: 10px; border: none;
        background: #333; color: #eee; margin-top: 10px; cursor: pointer; font-size: 13px;
      }
      .jbg-error { color: #e57373; font-size: 12.5px; text-align: center; padding: 10px 0; }
    `;
    document.head.appendChild(style);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function whitenBackground(transparentBlobUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), "image/jpeg", 0.92);
      };
      img.onerror = reject;
      img.src = transparentBlobUrl;
    });
  }

  async function processFile(panel, file) {
    const body = panel.querySelector("#jbg-body");
    const setStatus = (msg) => {
      const el = body.querySelector("#jbg-status-text");
      if (el) el.innerHTML = msg;
    };
    body.innerHTML = `<div class="jbg-status" id="jbg-status-text">⏳ Model yüklənir...<br><span style="font-size:11px;color:#999;">İlk dəfədirsə bir az çəkə bilər</span></div>`;

    try {
      const originalUrl = await fileToDataUrl(file);
      const lib = await withTimeout(loadLib(), TIMEOUT_MS, "Model yüklənməsi");
      setStatus("⏳ Fon silinir... 0%");
      const opts = { ...REMOVE_OPTS, progress: (key, current, total) => {
        const pct = total ? Math.round((current / total) * 100) : null;
        setStatus(`⏳ Fon silinir...${pct != null ? " " + pct + "%" : ""}`);
      }};
      const resultBlob = await withTimeout(lib.removeBackground(file, opts), TIMEOUT_MS, "Fon silmə");
      const transparentUrl = URL.createObjectURL(resultBlob);
      const whiteUrl = await whitenBackground(transparentUrl);

      body.innerHTML = `
        <div class="jbg-preview-row">
          <div class="jbg-preview-col">
            <img src="${originalUrl}">
            <div class="jbg-preview-label">Əvvəl</div>
          </div>
          <div class="jbg-preview-col">
            <img src="${transparentUrl}">
            <div class="jbg-preview-label">Sonra (şəffaf)</div>
          </div>
        </div>
        <div class="jbg-btn-row">
          <a class="jbg-btn transparent" download="temiz-sekil.png" href="${transparentUrl}">⬇️ Şəffaf PNG yüklə</a>
          <a class="jbg-btn white" download="temiz-sekil-ag.jpg" href="${whiteUrl}">⬇️ Ağ fonlu yüklə</a>
        </div>
        <button class="jbg-retry-btn" id="jbg-retry">↩️ Başqa şəkil seç</button>
      `;
      body.querySelector("#jbg-retry").onclick = () => renderPicker(panel);
    } catch (err) {
      console.error("[JollyBgRemove]", err);
      const isTimeout = /timeout|bitmədi/i.test(String(err && err.message));
      body.innerHTML = `
        <div class="jbg-error">⚠️ ${isTimeout ? "Vaxt bitdi — internet zəif ola bilər." : "Fon silinmədi."} İnternet bağlantını yoxla və yenidən cəhd et.</div>
        <button class="jbg-retry-btn" id="jbg-retry">↩️ Yenidən cəhd et</button>
      `;
      body.querySelector("#jbg-retry").onclick = () => renderPicker(panel);
    }
  }

  function renderPicker(panel) {
    const body = panel.querySelector("#jbg-body");
    body.innerHTML = `
      <div class="jbg-drop" id="jbg-drop">
        📷<br>Şəkil seçmək üçün toxun<br>
        <span style="font-size:11px;">(qalereyadan və ya kameradan)</span>
      </div>
      <input type="file" id="jbg-file-input" accept="image/*" style="display:none">
    `;
    const drop = body.querySelector("#jbg-drop");
    const input = body.querySelector("#jbg-file-input");
    drop.onclick = () => input.click();
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) processFile(panel, file);
    };
  }

  function blobUrlToDataUrl(blobUrl) {
    return fetch(blobUrl).then(r => r.blob()).then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));
  }

  // Başqa modullardan (məs. products.js-dəki tək-şəkil təmizləmə düyməsi)
  // çağırıla bilən, UI-sız versiya. Mövcud show()/renderPicker() axınına
  // TOXUNMUR — eyni əsas məntiqi (loadLib, removeBackground, whitenBackground)
  // təkrar istifadə edir.
  async function cleanDataUrl(dataUrl, mode, onProgress) {
    const lib = await withTimeout(loadLib(), TIMEOUT_MS, "Model yüklənməsi");
    const opts = { ...REMOVE_OPTS };
    if (onProgress) {
      opts.progress = (key, current, total) => {
        const pct = total ? Math.round((current / total) * 100) : null;
        onProgress(pct);
      };
    }
    const resultBlob = await withTimeout(lib.removeBackground(dataUrl, opts), TIMEOUT_MS, "Fon silmə");
    const transparentUrl = URL.createObjectURL(resultBlob);
    if (mode === "white") {
      const whiteUrl = await whitenBackground(transparentUrl);
      return blobUrlToDataUrl(whiteUrl);
    }
    return blobUrlToDataUrl(transparentUrl);
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-bg-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "jolly-bg-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-bg-panel">
        <h2>🧹 Şəkil Təmizləyici <button onclick="document.getElementById('jolly-bg-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <div id="jbg-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    renderPicker(overlay.querySelector("#jolly-bg-panel"));
  }

  const JollyBgRemove = {
    id: "bg-remove",
    name: "Şəkil Təmizləyici",
    version: "1.1.0",
    show,
    cleanDataUrl
  };

  window.JollyBgRemove = JollyBgRemove;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyBgRemove);
    console.log("[JollyBgRemove] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyBgRemove] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyBgRemove.show()).");
  }

  // ------------------------------------------------------------------------
  // QEYD: Məhsul formasına avtomatik qoşulma (hook) ÇIXARILDI.
  // Səbəb: Bu hook məhsul əlavə edərkən şəkil yükləməni poza bilirdi (əsas
  // funksiya). "Şəkil Təmizləyici" indi YALNIZ Alətlər menyusundan əl ilə
  // açılan ayrıca alət kimi işləyir, məhsul formasına toxunmur.
  // ------------------------------------------------------------------------
})();
