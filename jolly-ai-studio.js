/* ============================================================
   JOLLY AI Brain Studio Pro — idarə paneli
   Route: #/studios/ai-brain (özü tutur)
   Bölmələr: Overview · Test Lab · Typo Trainer · Unknown · Settings
   ============================================================ */

const JollyAIStudio = (() => {
  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function moduleStatus() {
    const mods = [
      ['Dictionary', 'JollyAIDictionary'], ['Typo', 'JollyAITypo'], ['Search', 'JollyAISearch'],
      ['Intent', 'JollyAIIntent'], ['Health', 'JollyAIHealth'], ['Actions', 'JollyAIActions'],
      ['Voice', 'JollyAIVoice'], ['UI', 'JollyAIUI'], ['Core', 'JollyAICore'],
    ];
    return mods.map(([label, g]) => ({ label, ok: typeof window[g] !== 'undefined' }));
  }

  function render() {
    const s = JollyDB.getSettings();
    const mods = moduleStatus();
    const okCount = mods.filter(m => m.ok).length;
    const unknowns = (typeof JollyAICore !== 'undefined') ? JollyAICore.getUnknownQueries() : [];
    const learned = (typeof JollyAITypo !== 'undefined') ? JollyAITypo.getLearned() : {};

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:20px;">🧠 AI Brain Studio Pro</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 16px;">${okCount}/${mods.length} modul aktiv · offline ağıllı köməkçi</p>

      <!-- Test Lab -->
      <div class="section-title" style="margin-top:0;">🧪 AI Test Lab</div>
      <div class="glass" style="padding:14px;">
        <input id="aiLabInput" placeholder="Sual yaz: cprab hardadı" style="width:100%;box-sizing:border-box;margin-bottom:8px;">
        <button class="btn btn-primary btn-block" onclick="JollyAIStudio.runTest()">Yoxla</button>
        <div id="aiLabResult" style="margin-top:10px;"></div>
      </div>

      <!-- Modul statusu -->
      <div class="section-title">🧩 Modullar</div>
      <div class="glass" style="padding:4px 14px;">
        ${mods.map(m => `<div class="list-row"><span>${m.label}</span><span>${m.ok ? '✅' : '❌'}</span></div>`).join('')}
      </div>

      <!-- Typo Trainer -->
      <div class="section-title">✍️ Typo Trainer</div>
      <div class="glass" style="padding:14px;">
        <div class="row" style="gap:8px;">
          <input id="aiTypoWrong" placeholder="səhv (cprab)" style="flex:1;">
          <input id="aiTypoRight" placeholder="düz (corab)" style="flex:1;">
        </div>
        <button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px;" onclick="JollyAIStudio.addTypo()">Yadda saxla</button>
        <div style="margin-top:10px;">
          ${Object.keys(learned).length ? Object.entries(learned).map(([w, c]) => `<div class="list-row"><span class="mono">${esc(w)} → ${esc(c)}</span><span onclick="JollyAIStudio.removeTypo('${esc(w)}')" style="cursor:pointer;color:var(--accent-danger);">✕</span></div>`).join('') : '<div class="muted" style="font-size:11.5px;padding:6px;">Hələ öyrədilmiş söz yoxdur</div>'}
        </div>
      </div>

      <!-- Unknown queries -->
      <div class="section-title">❓ Başa düşülməyən suallar (${unknowns.length})</div>
      <div class="glass" style="padding:4px 14px;">
        ${unknowns.length ? unknowns.slice(0, 15).map(u => `<div class="list-row"><span>${esc(u.text)}</span><span onclick="JollyAIStudio.dismissUnknown('${u.id}')" style="cursor:pointer;color:var(--muted);">✕</span></div>`).join('') : '<div class="muted" style="font-size:11.5px;padding:10px;">Hər şey aydındır ✨</div>'}
      </div>

      <!-- Gemini Bridge -->
      <div class="section-title">✨ Gemini AI (online güc)</div>
      <div class="glass" style="padding:14px;">
        <p class="muted" style="font-size:11.5px;margin:0 0 8px;">Açar əlavə et — online olanda mürəkkəb sualları Gemini cavablayır, bazadan tapılanları isə JOLLY AI. Offline olanda hər şey JOLLY AI-də qalır.</p>
        <input id="geminiKeyInput" placeholder="Gemini API açarı (AIza...)" value="${(typeof JollyGemini!=='undefined' && JollyGemini.getKey())? '••••••••••••' : ''}" style="width:100%;box-sizing:border-box;margin-bottom:8px;">
        <div class="row" style="gap:8px;">
          <button class="btn btn-primary" style="flex:1;" onclick="JollyAIStudio.saveGeminiKey()">Yadda saxla</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyAIStudio.testGemini()">Yoxla</button>
        </div>
        <div id="geminiStatus" class="muted" style="font-size:11.5px;margin-top:8px;">
          ${(typeof JollyGemini!=='undefined' && JollyGemini.hasKey()) ? (JollyGemini.isOnline() ? '🟢 Açar var · online — Gemini aktiv' : '🟡 Açar var · offline — JOLLY AI işləyir') : '⚪ Açar yoxdur — yalnız JOLLY AI'}
        </div>
      </div>

      <!-- Settings -->
      <div class="section-title">⚙️ AI Ayarları</div>
      <div class="glass" style="padding:4px 14px;">
        <div class="list-row">
          <span>Səsli cavab</span>
          <label><input type="checkbox" ${s.aiVoiceEnabled ? 'checked' : ''} onchange="JollyAIStudio.toggleVoice(this.checked)"></label>
        </div>
        <div class="list-row">
          <span>Səs dili</span>
          <select onchange="JollyAIVoice.setLang(this.value)" style="background:transparent;color:var(--text-hi);border:1px solid var(--border-soft);border-radius:8px;padding:4px;">
            <option value="az" ${(s.aiVoiceLang||'az')==='az'?'selected':''}>Azərbaycan</option>
            <option value="tr" ${s.aiVoiceLang==='tr'?'selected':''}>Türk</option>
            <option value="ru" ${s.aiVoiceLang==='ru'?'selected':''}>Rus</option>
            <option value="en" ${s.aiVoiceLang==='en'?'selected':''}>İngilis</option>
          </select>
        </div>
        <div class="list-row">
          <span>Səs sürəti</span>
          <select onchange="JollyAIVoice.setRate(this.value)" style="background:transparent;color:var(--text-hi);border:1px solid var(--border-soft);border-radius:8px;padding:4px;">
            <option value="slow" ${s.aiVoiceRate==='slow'?'selected':''}>Yavaş</option>
            <option value="normal" ${(s.aiVoiceRate||'normal')==='normal'?'selected':''}>Normal</option>
            <option value="fast" ${s.aiVoiceRate==='fast'?'selected':''}>Sürətli</option>
          </select>
        </div>
      </div>

      <div style="height:30px;"></div>
    `;
  }

  function saveGeminiKey() {
    const el = document.getElementById('geminiKeyInput');
    if (!el || typeof JollyGemini === 'undefined') return;
    const v = el.value.trim();
    if (v && v !== '••••••••••••') {
      JollyGemini.setKey(v);
      Toast.success('Gemini açarı saxlanıldı');
      JollyApp.render();
    }
  }

  async function testGemini() {
    const st = document.getElementById('geminiStatus');
    if (!st || typeof JollyGemini === 'undefined') return;
    st.textContent = '🔍 Yoxlanılır...';
    const r = await JollyGemini.testConnection();
    st.textContent = (r.ok ? '🟢 ' : '❌ ') + r.msg;
    st.style.color = r.ok ? 'var(--accent-2)' : 'var(--accent-danger)';
  }

  function runTest() {
    const input = document.getElementById('aiLabInput');
    const out = document.getElementById('aiLabResult');
    if (!input || !out || !input.value.trim()) return;
    if (typeof JollyAICore === 'undefined') { out.innerHTML = '<div class="muted">Core modulu yoxdur</div>'; return; }
    const r = JollyAICore.ask(input.value);
    let html = '';
    if (typeof JollyAIUI !== 'undefined') {
      html += JollyAIUI.renderTestDebug({
        originalText: r.originalText, correctedText: r.correctedText,
        intent: r.intent, confidence: r.confidence, entities: (JollyAIIntent ? JollyAIIntent.extractEntities(r.correctedText) : {}),
        actionType: r.action ? r.action.type : null,
      });
      html += JollyAIUI.renderAnswer(r);
    } else {
      html = `<div>${esc(r.answer)}</div>`;
    }
    out.innerHTML = html;
  }

  function addTypo() {
    const w = document.getElementById('aiTypoWrong'), c = document.getElementById('aiTypoRight');
    if (!w || !c || !w.value.trim() || !c.value.trim()) return;
    JollyAITypo.learn(w.value.trim(), c.value.trim());
    Toast.success('Öyrədildi: ' + w.value.trim() + ' → ' + c.value.trim());
    JollyApp.render();
  }

  function removeTypo(wrong) { JollyAITypo.forget(wrong); JollyApp.render(); }
  function dismissUnknown(id) { JollyAICore.clearUnknownQuery(id); JollyApp.render(); }
  function toggleVoice(on) {
    JollyAIVoice.setEnabled(on);
    if (on) JollyAIVoice.speak('Səsli cavab aktivdir.');
  }

  /* ---------- Marşrutu özü tut ---------- */
  function tryRenderRoute() {
    if ((window.location.hash || '') !== '#/studios/ai-brain') return;
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = render();
    if (typeof JollyApp !== 'undefined' && JollyApp.renderBottomNav) JollyApp.renderBottomNav();
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', () => setTimeout(tryRenderRoute, 0));
    setTimeout(tryRenderRoute, 0);
  });

  return { render, runTest, addTypo, removeTypo, dismissUnknown, toggleVoice, saveGeminiKey, testGemini };
})();
