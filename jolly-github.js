/* ==========================================================================
   JOLLY GITHUB (jolly-github.js)
   ==========================================================================
   Kimi Agent-in konsepsiyasından (backend olmadan, birbaşa brauzerdən) —
   GitHub-un öz REST API-sinə birbaşa fetch() ilə yazır. Server lazım deyil.

   NƏ EDİR:
   - Personal Access Token (PAT) + repo məlumatını telefonda saxlayır
   - Code Studio-dakı istənilən snippet-i seçib, fayl yolu + commit mesajı
     yazıb, birbaşa GitHub-a "push" edir (yeni fayl və ya mövcud faylın
     yenilənməsi — GitHub Contents API)
   - Push tarixçəsini saxlayır (nə vaxt, hansı fayl, uğurlu oldumu)

   TƏHLÜKƏSİZLİK: Token yalnız BU telefonda (localStorage) saxlanılır,
   heç yerə göndərilmir (Anthropic-ə, başqa serverə YOX) — yalnız
   birbaşa api.github.com-a.
   ========================================================================== */

(function () {
  "use strict";

  const CONFIG_KEY = "jolly_gh_config";
  const HISTORY_KEY = "jolly_gh_history";

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); } catch (e) { return null; }
  }
  function setConfig(cfg) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }
  function clearConfig() {
    try { localStorage.removeItem(CONFIG_KEY); } catch (e) {}
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch (e) { return []; }
  }
  function addHistory(entry) {
    const h = getHistory();
    h.unshift(entry);
    if (h.length > 30) h.length = 30;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) {}
  }

  // ------------------------------------------------------------------------
  // GitHub REST API — birbaşa fetch, backend yoxdur
  // ------------------------------------------------------------------------
  async function githubApi(token, endpoint, method, body) {
    const res = await fetch(`https://api.github.com${endpoint}`, {
      method: method || "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub xətası (${res.status}): ${errText.slice(0, 200)}`);
    }
    return res.json();
  }

  function b64EncodeUtf8(str) {
    // Azərbaycan hərfləri düzgün kodlaşsın deyə (əvvəlki mojibake problemi
    // olmasın) — UTF-8 baytlarına çevirib sonra base64 edirik.
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function verifyToken(token) {
    return githubApi(token, "/user");
  }

  async function getFileSha(cfg, path) {
    try {
      const result = await githubApi(cfg.token, `/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch}`);
      return result.sha;
    } catch (e) {
      return null; // fayl yoxdur, yeni yaradılacaq
    }
  }

  async function pushFile(path, content, commitMessage) {
    const cfg = getConfig();
    if (!cfg) throw new Error("GitHub qurulmayıb — əvvəlcə token/repo yaz");

    const existingSha = await getFileSha(cfg, path);
    const body = {
      message: commitMessage,
      content: b64EncodeUtf8(content),
      branch: cfg.branch,
    };
    if (existingSha) body.sha = existingSha;

    const result = await githubApi(cfg.token, `/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, "PUT", body);

    addHistory({
      path, commitMessage, ts: Date.now(),
      commitSha: result.commit && result.commit.sha,
      url: result.content && result.content.html_url,
      status: "ok",
    });
    return result;
  }

  // ------------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-gh-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-gh-styles";
    style.textContent = `
      #jolly-gh-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-gh-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 88vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-gh-panel h2 {
        margin: 0 0 4px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jgh-sub { font-size: 11px; color: #999; margin-bottom: 14px; line-height: 1.5; }
      .jgh-field label { font-size: 12px; color: #ccc; display: block; margin-bottom: 4px; }
      .jgh-field input, .jgh-field select {
        width: 100%; background: #232323; color: #f0e6c8; border: 1px solid #444;
        border-radius: 10px; padding: 10px 12px; font-size: 13px; box-sizing: border-box; margin-bottom: 10px;
      }
      .jgh-btn { padding: 11px; border-radius: 10px; border: none; font-size: 13px; cursor: pointer; }
      .jgh-btn.primary { background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a; font-weight: 600; width: 100%; }
      .jgh-btn.ghost { background: #333; color: #eee; }
      .jgh-status-box { background: #232323; border: 1px solid #333; border-radius: 10px; padding: 12px; margin-bottom: 14px; font-size: 12.5px; }
      .jgh-item { background: #232323; border: 1px solid #333; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; font-size: 12px; }
    `;
    document.head.appendChild(style);
  }

  function renderConfigForm() {
    const cfg = getConfig();
    return `
      <div class="jgh-status-box">
        ${cfg ? `✅ Qurulub: <b>${cfg.owner}/${cfg.repo}</b> (${cfg.branch})` : "⚠️ Hələ qurulmayıb"}
      </div>
      <div class="jgh-field"><label>Repo sahibi (username)</label><input id="jgh-owner" value="${cfg ? cfg.owner : ''}" placeholder="esqin19920904-pixel"></div>
      <div class="jgh-field"><label>Repo adı</label><input id="jgh-repo" value="${cfg ? cfg.repo : ''}" placeholder="Jolly"></div>
      <div class="jgh-field"><label>Branch</label><input id="jgh-branch" value="${cfg ? cfg.branch : 'main'}" placeholder="main"></div>
      <div class="jgh-field"><label>Personal Access Token</label><input id="jgh-token" type="password" placeholder="ghp_..."></div>
      <button class="jgh-btn primary" onclick="JollyGitHub.saveConfig()">💾 Yoxla və Saxla</button>
      <div id="jgh-config-status" style="font-size:12px;margin-top:8px;text-align:center;"></div>
      <p class="jgh-sub" style="margin-top:12px;">Token yaratmaq: GitHub → Settings → Developer settings → Personal access tokens → "repo" icazəsi ver. Token yalnız bu telefonda saxlanılır.</p>
    `;
  }

  function renderPushForm() {
    const cfg = getConfig();
    if (!cfg) return `<div class="jgh-sub">Əvvəlcə "Ayarlar" tab-ından GitHub-ı qur.</div>`;
    const snippets = (typeof JollyCodeStudio !== "undefined") ? JollyCodeStudio.getSnippets() : [];
    return `
      <div class="jgh-field">
        <label>Snippet seç</label>
        <select id="jgh-snippet-select">
          <option value="">— seç —</option>
          ${snippets.map((s, i) => `<option value="${i}">${escHtml(s.name)}</option>`).join("")}
        </select>
      </div>
      <div class="jgh-field"><label>Fayl yolu (repo-da)</label><input id="jgh-filepath" placeholder="məsələn: jolly-yeni-modul.js"></div>
      <div class="jgh-field"><label>Commit mesajı</label><input id="jgh-commitmsg" placeholder="JOLLY: yeni modul əlavə edildi"></div>
      <button class="jgh-btn primary" onclick="JollyGitHub.doPush()">📤 GitHub-a göndər</button>
      <div id="jgh-push-status" style="font-size:12px;margin-top:8px;text-align:center;"></div>
    `;
  }

  function renderHistory() {
    const h = getHistory();
    if (!h.length) return `<div class="jgh-sub">Hələ push edilməyib.</div>`;
    return h.map(item => `
      <div class="jgh-item">
        <b>${escHtml(item.path)}</b><br>
        <span style="color:#999;">${escHtml(item.commitMessage)}</span><br>
        <span style="color:#666;">${new Date(item.ts).toLocaleString("az-AZ")}</span>
      </div>
    `).join("");
  }

  function escHtml(s) {
    const div = document.createElement("div");
    div.textContent = String(s == null ? "" : s);
    return div.innerHTML;
  }

  let activeTab = "config";

  function renderPanel() {
    const panel = document.getElementById("jolly-gh-panel");
    if (!panel) return;
    let body;
    if (activeTab === "config") body = renderConfigForm();
    else if (activeTab === "push") body = renderPushForm();
    else body = renderHistory();

    panel.innerHTML = `
      <h2>🐙 GitHub <button onclick="document.getElementById('jolly-gh-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
      <div class="jgh-sub">Snippet-ləri birbaşa reponuza göndər — kopyala-yapışdır lazım deyil.</div>
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <div class="jgh-btn ghost" style="flex:1;text-align:center;${activeTab==='config'?'background:#d4af37;color:#1a1a1a;':''}" onclick="JollyGitHub.setTab('config')">⚙️ Ayarlar</div>
        <div class="jgh-btn ghost" style="flex:1;text-align:center;${activeTab==='push'?'background:#d4af37;color:#1a1a1a;':''}" onclick="JollyGitHub.setTab('push')">📤 Push et</div>
        <div class="jgh-btn ghost" style="flex:1;text-align:center;${activeTab==='history'?'background:#d4af37;color:#1a1a1a;':''}" onclick="JollyGitHub.setTab('history')">📜 Tarixçə</div>
      </div>
      <div id="jgh-body">${body}</div>
    `;
  }

  function setTab(tab) { activeTab = tab; renderPanel(); }

  async function saveConfig() {
    const owner = document.getElementById("jgh-owner").value.trim();
    const repo = document.getElementById("jgh-repo").value.trim();
    const branch = document.getElementById("jgh-branch").value.trim() || "main";
    const token = document.getElementById("jgh-token").value.trim();
    const statusEl = document.getElementById("jgh-config-status");
    if (!owner || !repo || !token) { statusEl.textContent = "❌ Hamısını doldur"; return; }
    statusEl.textContent = "⏳ Yoxlanılır...";
    try {
      await verifyToken(token);
      setConfig({ owner, repo, branch, token });
      statusEl.textContent = "✅ Yadda saxlandı";
      renderPanel();
    } catch (e) {
      statusEl.textContent = "❌ " + e.message;
    }
  }

  async function doPush() {
    const idx = document.getElementById("jgh-snippet-select").value;
    const filePath = document.getElementById("jgh-filepath").value.trim();
    const commitMsg = document.getElementById("jgh-commitmsg").value.trim() || "JOLLY snippet update";
    const statusEl = document.getElementById("jgh-push-status");
    if (idx === "" || !filePath) { statusEl.textContent = "❌ Snippet və fayl yolu seç"; return; }
    const snippets = JollyCodeStudio.getSnippets();
    const snippet = snippets[parseInt(idx)];
    if (!snippet) { statusEl.textContent = "❌ Snippet tapılmadı"; return; }
    statusEl.textContent = "⏳ Göndərilir...";
    try {
      await pushFile(filePath, snippet.code, commitMsg);
      statusEl.textContent = "✅ Göndərildi!";
      if (typeof Toast !== "undefined") Toast.success("GitHub-a göndərildi ✓");
    } catch (e) {
      statusEl.textContent = "❌ " + e.message;
    }
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-gh-overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "jolly-gh-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `<div id="jolly-gh-panel"></div>`;
    document.body.appendChild(overlay);
    renderPanel();
  }

  window.JollyGitHub = {
    id: "github",
    name: "GitHub",
    version: "1.0.0",
    show, setTab, saveConfig, doPush,
    pushFile, isConfigured: () => !!getConfig(),
  };

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(window.JollyGitHub);
  }
})();
