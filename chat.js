/* ============================================================
   JOLLY Chat — davamlı söhbət, Qısa yollar paneli
   Marşrutu özü tutur: #/chat (history.js ilə eyni üsul)
   ============================================================ */

const JollyChat = (() => {
  const MSG_KEY = 'jolly_chat_messages';
  let pendingSuggestion = null; // { command } — "qısa yol kimi saxlayım?" gözləyir

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s)); }
  function fmtText(t) { return esc(t).replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }

  function getMessages() { return JollyDB.read(MSG_KEY, []); }
  function saveMessages(list) {
    if (list.length > 200) list = list.slice(list.length - 200);
    JollyDB.write(MSG_KEY, list);
  }
  function pushMessage(role, html) {
    const list = getMessages();
    list.push({ role, html, ts: Date.now() });
    saveMessages(list);
    return list;
  }

  /* ---------- Səhifə ---------- */
  function render() {
    const messages = getMessages();
    setTimeout(() => { renderShortcuts(); scrollBottom(); attachInputHandlers(); }, 0);
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">💬 JOLLY Chat</h2>
      <p class="muted" style="font-size:12px;margin:0 0 12px;">Qısa yol yaratmaq üçün belə yaz: <span class="mono">corabtap = Corab 545 tap</span></p>

      <div class="chip-row" id="chatShortcutsPanel" style="margin-bottom:10px;"></div>

      <div class="ai-panel glass" style="padding:14px;">
        <div class="ai-messages" id="chatMessages">
          ${messages.length === 0 ? `<div class="ai-msg bot">Salam! Mən JOLLY Chat-am. Qısa yollar yarada bilərsən, Visual Search aça bilərsən ("vsearch"), tapdığın məhsulu WhatsApp-a göndərə bilərsən ("wp").</div>` : messages.map(renderBubble).join('')}
        </div>
        <div class="ai-suggestions">
          <span class="chip" onclick="JollyChat.quick('şəkilsiz məhsullar')">Şəkilsiz</span>
          <span class="chip" onclick="JollyChat.quick('barkodsuz')">Barkodsuz</span>
          <span class="chip" onclick="JollyChat.quick('problemli')">Problemli</span>
          <span class="chip" onclick="JollyChat.quick('vsearch')">📷 Visual Search</span>
        </div>
        <div class="ai-input-row">
          <input id="chatInput" placeholder="Yaz və ya qısayol istifadə et..." onkeydown="if(event.key==='Enter')JollyChat.send()">
          <button class="mic-btn" onclick="JollyChat.voice()">🎤</button>
          <button class="mic-btn" onclick="JollyChat.send()">➤</button>
        </div>
      </div>
    `;
  }

  function attachInputHandlers() {
    const input = document.getElementById('chatInput');
    if (input) input.focus();
  }

  function scrollBottom() {
    const el = document.getElementById('chatMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function renderBubble(m) {
    return `<div class="ai-msg ${m.role}">${m.html}</div>`;
  }

  function appendBubble(role, html) {
    pushMessage(role, html);
    const el = document.getElementById('chatMessages');
    if (el) { el.insertAdjacentHTML('beforeend', renderBubble({ role, html })); scrollBottom(); }
  }

  /* ---------- Qısa yollar paneli ---------- */
  function renderShortcuts() {
    const panel = document.getElementById('chatShortcutsPanel');
    if (!panel) return;
    const list = JollyAIShortcuts.all();
    if (!list.length) { panel.innerHTML = `<span class="muted" style="font-size:11.5px;">Hələ qısayol yoxdur — "ad = əmr" yaz.</span>`; return; }
    panel.innerHTML = list.map(s => `<span class="chip" onclick="JollyChat.runShortcut('${s.id}')">⚡ ${esc(s.shortcut)}</span>`).join('');
  }

  function runShortcut(id) {
    const rec = JollyAIShortcuts.all().find(s => s.id === id);
    if (!rec) return;
    const input = document.getElementById('chatInput');
    if (input) { input.value = rec.shortcut; }
    send();
  }

  /* ---------- Mesaj göndərmə ---------- */
  function quick(text) {
    const input = document.getElementById('chatInput');
    if (input) input.value = text;
    send();
  }

  function voice() {
    if (typeof JollyVoice === 'undefined') return;
    JollyVoice.listen((text) => {
      const input = document.getElementById('chatInput');
      if (input) input.value = text;
      send();
    });
  }

  function send() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    handleUserInput(text);
  }

  function handleUserInput(text) {
    // Əvvəlki "qısa yol saxlayım?" təklifinə cavabdırsa
    if (pendingSuggestion) {
      const n = text.trim().toLowerCase();
      if (n === 'bəli' || n === 'beli' || n === 'bəli saxla') {
        confirmSuggestion(true);
        return;
      }
      if (n === 'yox') {
        confirmSuggestion(false);
        return;
      }
    }

    appendBubble('user', esc(text));

    // 1) "ad = əmr" tərifi
    const def = JollyAIShortcuts.tryDefine(text);
    if (def) {
      JollyAIShortcuts.add(def.shortcut, def.command);
      appendBubble('bot', `✅ Qısa yol saxlanıldı: <b>${esc(def.shortcut)}</b> → "${esc(def.command)}"<br><span class="muted" style="font-size:11px;">İndi sadəcə "${esc(def.shortcut)}" yaz, bu əmr icra olunacaq.</span>`);
      renderShortcuts();
      if (typeof JollySound !== 'undefined') JollySound.success();
      return;
    }

    // 2) Saxlanmış qısayoldursa genişlət
    const rec = JollyAIShortcuts.tryExpand(text);
    const effectiveText = rec ? rec.command : text;
    if (rec) {
      appendBubble('bot', `↳ qısayol: <span class="mono">${esc(rec.command)}</span>`);
      renderShortcuts();
    }

    // 3) İcra et
    executeCommand(effectiveText, !!rec);
  }

  function executeCommand(text, fromShortcut) {
    const typingId = 'typing-' + Date.now();
    appendBubble('bot', `<span id="${typingId}" class="ai-typing"><span></span><span></span><span></span></span>`);
    setTimeout(() => {
      const t = document.getElementById(typingId);
      if (t && t.parentElement) t.parentElement.remove();
      const list = getMessages();
      list.pop(); // typing-dots mesajını yaddaşdan da çıxar
      saveMessages(list);

      // Gemini körpüsü varsa hibrid işlə: Brain tapmasa Gemini
      if (typeof JollyGemini !== 'undefined') {
        JollyGemini.ask(text).then(r => {
          if (r.source === 'gemini') {
            appendBubble('bot', fmtText(r.text) + `<div class="muted" style="font-size:10px;margin-top:4px;">✨ Gemini</div>`);
          } else {
            const full = r.full;
            let action = full && full.action;
            if (!action && full && Array.isArray(full.products) && full.products.length) {
              action = { type: 'list', products: full.products.map(x => x.product) };
            }
            renderAiResult({ text: r.text, action: action || null, _full: full });
          }
        }).catch(() => {
          renderAiResult(JollyAI.respond(text));
        });
      } else {
        const res = JollyAI.respond(text);
        renderAiResult(res);
      }

      if (!fromShortcut) {
        const shouldSuggest = JollyAIShortcuts.trackRepeat(text);
        if (shouldSuggest) {
          pendingSuggestion = { command: text };
          setTimeout(() => {
            appendBubble('bot', `Bu əmri qısa yol kimi yadda saxlayım? <span class="muted" style="font-size:11px;">("Bəli" və ya "Yox" yaz)</span>`);
          }, 250);
        }
      }
    }, 420);
  }

  function confirmSuggestion(yes) {
    const cmd = pendingSuggestion ? pendingSuggestion.command : null;
    pendingSuggestion = null;
    appendBubble('user', esc(yes ? 'Bəli' : 'Yox'));
    if (!yes || !cmd) { appendBubble('bot', 'Yaxşı, saxlamadım.'); return; }
    const shortcut = prompt('Bu əmr üçün qısa ad yaz (məs. "corabtap"):');
    if (!shortcut || !shortcut.trim()) { appendBubble('bot', 'Ləğv edildi.'); return; }
    JollyAIShortcuts.add(shortcut.trim(), cmd);
    JollyAIShortcuts.clearFreq(cmd);
    appendBubble('bot', `✅ Saxlanıldı: <b>${esc(shortcut.trim())}</b> → "${esc(cmd)}"`);
    renderShortcuts();
    if (typeof JollySound !== 'undefined') JollySound.success();
  }

  /* ---------- AI cavabını göstər (mətn + action) ---------- */
  function renderAiResult(res) {
    let html = fmtText(res.text);

    if (res.action && res.action.type === 'list' && res.action.products && res.action.products.length) {
      html += renderProductMiniList(res.action.products.slice(0, 5));
    }

    appendBubble('bot', html);

    if (!res.action) return;
    const a = res.action;

    if (a.type === 'navigate') {
      setTimeout(() => JollyRouter.go(a.route), 600);
    } else if (a.type === 'openVisualSearch') {
      setTimeout(() => openVisualSearch(), 300);
    } else if (a.type === 'whatsapp') {
      setTimeout(() => { if (typeof JollyProducts !== 'undefined') JollyProducts.whatsappShare(a.productId); }, 200);
    } else if (a.type === 'showBarcode') {
      setTimeout(() => { if (typeof JollyProducts !== 'undefined') JollyProducts.showBarcode(a.barcode); }, 200);
    } else if (a.type === 'confirmDelete') {
      appendBubble('bot', `<button class="btn btn-danger btn-sm" onclick="JollyProducts.deleteProduct('${a.productId}')">🗑️ Bəli, sil</button>`);
    }
  }

  function renderProductMiniList(products) {
    return `<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
      ${products.map(p => `
        <div class="list-row" style="border-bottom:none;">
          <span>${esc(p.name || 'Adsız')}</span>
          <span class="actions">
            <span onclick="JollyRouter.go('#/product/${p.id}')" style="color:var(--accent-1);">👁</span>
            ${(p.barcodes && p.barcodes.length) ? `<span onclick="JollyProducts.showBarcode('${esc(p.barcodes[0])}')" style="color:var(--accent-2);">🧾</span>` : ''}
            <span onclick="JollyProducts.whatsappShare('${p.id}')" style="color:#25D366;">📤</span>
          </span>
        </div>
      `).join('')}
    </div>`;
  }

  /* ---------- Visual Search inteqrasiyası ---------- */
  function openVisualSearch() {
    if (typeof JollyVisualSearch === 'undefined') { appendBubble('bot', 'Visual Search modulu yoxdur.'); return; }
    chooseVisualSearchMode();
  }

  function chooseVisualSearchMode() {
    // Kamera və ya qalereya seçimi
    const overlay = document.createElement('div');
    overlay.className = 'qa-overlay on';
    overlay.innerHTML = `
      <div class="glass qa-sheet">
        <div class="qa-title">📷 Visual Search</div>
        <div class="qa-item" id="vsCamera"><span>📸</span><span>Kamera ilə çək</span></div>
        <div class="qa-item" id="vsGallery"><span>🖼️</span><span>Qalereyadan seç</span></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#vsCamera').onclick = () => { overlay.remove(); JollyVisualSearch.captureAndSearch(onVisualResults); };
    overlay.querySelector('#vsGallery').onclick = () => { overlay.remove(); JollyVisualSearch.pickAndSearch(onVisualResults); };
  }

  function onVisualResults(results) {
    JollyAI.setContext({ lastVisualSearchResults: results.map(r => r.product) });
    if (!results.length) { appendBubble('bot', 'Oxşar məhsul tapılmadı. 🔍'); return; }
    JollyAI.rememberResults(results.length === 1 ? [results[0].product] : []);
    const html = `Visual Search nəticələri:<div style="margin-top:8px;display:flex;flex-direction:column;gap:10px;">
      ${results.slice(0, 6).map(r => `
        <div class="glass" style="padding:10px;display:flex;gap:10px;align-items:center;">
          <div class="thumb" style="width:52px;height:52px;flex-shrink:0;border-radius:10px;overflow:hidden;">${(r.product.images && r.product.images[0]) ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(r.product.images[0]) : 'src="' + r.product.images[0] + '"'} style="width:100%;height:100%;object-fit:cover;">` : '🧴'}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13px;">${esc(r.product.name || 'Adsız')}</div>
            <div class="muted mono" style="font-size:11px;">${(r.product.barcodes && r.product.barcodes[0]) ? esc(r.product.barcodes[0]) : 'barkod yoxdur'}</div>
            <div style="font-size:11px;color:var(--accent-2);">${r.similarity}% oxşar</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <span onclick="JollyRouter.go('#/product/${r.product.id}')" style="color:var(--accent-1);cursor:pointer;">👁 Aç</span>
            ${(r.product.barcodes && r.product.barcodes.length) ? `<span onclick="JollyProducts.showBarcode('${esc(r.product.barcodes[0])}')" style="color:var(--accent-2);cursor:pointer;">🧾 Barkod</span>` : ''}
            <span onclick="JollyProducts.whatsappShare('${r.product.id}')" style="color:#25D366;cursor:pointer;">📤 Göndər</span>
          </div>
        </div>
      `).join('')}
    </div>`;
    appendBubble('bot', html);
  }

  /* ---------- Marşrutu özü tutur ---------- */
  function tryRenderRoute() {
    if ((window.location.hash || '') !== '#/chat') return;
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = render();
    if (typeof JollyApp !== 'undefined') JollyApp.renderBottomNav();
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', () => setTimeout(tryRenderRoute, 0));
    setTimeout(tryRenderRoute, 0);
  });

  return { render, send, quick, voice, runShortcut, confirmSuggestion, showVisualResults: onVisualResults };
})();
