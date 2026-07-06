/* ============================================================
   JOLLY Code Studio — kod yazmadan/az kodla proqrama əlavə
   1) Custom Fields: məhsul kartına yeni sahə əlavə et (No-Code)
   2) Snippets: mənim verdiyim JS kod parçasını yapışdır və icra et (OTA)
   ============================================================ */

const JollyCodeStudio = (() => {
  const FIELDS_KEY = 'jolly_custom_fields';
  const SNIPPETS_KEY = 'jolly_snippets';

  /* ---------- Custom Fields ---------- */
  function getFields() { return JollyDB.read(FIELDS_KEY, []); }
  function setFields(f) { JollyDB.write(FIELDS_KEY, f); }

  const FIELD_TYPES = {
    text: 'Mətn', number: 'Rəqəm', date: 'Tarix',
    dropdown: 'Seçim (dropdown)', checkbox: 'Bəli/Xeyr',
  };

  function addField() {
    const label = prompt('Yeni sahənin adı (məs. "Tədarükçü"):');
    if (!label || !label.trim()) return;
    const typeKeys = Object.keys(FIELD_TYPES);
    const typeList = typeKeys.map((k, i) => `${i + 1}. ${FIELD_TYPES[k]}`).join('\n');
    const choice = prompt(`Sahə tipini seç:\n\n${typeList}`);
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= typeKeys.length) { Toast.error('Yanlış tip'); return; }
    const type = typeKeys[idx];
    let options = [];
    if (type === 'dropdown') {
      const raw = prompt('Seçimləri vergüllə ayır (məs. "kiçik, orta, böyük"):');
      options = (raw || '').split(',').map(s => s.trim()).filter(Boolean);
    }
    const fields = getFields();
    fields.push({ id: JollyDB.uid('fld'), key: 'cf_' + Date.now().toString(36), label: label.trim(), type, options });
    setFields(fields);
    Toast.success(`"${label}" sahəsi əlavə olundu — məhsul formasında görünəcək`);
    JollyRouter.go('#/studios/code');
  }

  function deleteField(id) {
    if (!confirm('Bu sahə silinsin? (mövcud məhsullardakı dəyərlər qalır)')) return;
    setFields(getFields().filter(f => f.id !== id));
    Toast.success('Sahə silindi');
    JollyRouter.go('#/studios/code');
  }

  function editField(id) {
    const fields = getFields();
    const f = fields.find(x => x.id === id);
    if (!f) return;
    const label = prompt('Sahənin adını dəyiş:', f.label);
    if (!label || !label.trim()) return;
    let options = f.options || [];
    if (f.type === 'dropdown') {
      const raw = prompt('Seçimləri vergüllə ayır:', options.join(', '));
      if (raw !== null) options = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    const updated = fields.map(x => x.id === id ? { ...x, label: label.trim(), options } : x);
    setFields(updated);
    Toast.success('Sahə yeniləndi');
    JollyRouter.go('#/studios/code');
  }

  /* Məhsul formasına əlavə HTML — products.js buradan çağırır */
  function renderCustomFieldsHtml(product) {
    const fields = getFields();
    if (!fields.length) return '';
    return fields.map(f => {
      const val = (product && product.custom && product.custom[f.key] != null) ? product.custom[f.key] : '';
      let input = '';
      if (f.type === 'text') input = `<input data-cf="${f.key}" value="${escapeAttr(val)}" placeholder="${escapeAttr(f.label)}">`;
      else if (f.type === 'number') input = `<input data-cf="${f.key}" type="number" value="${escapeAttr(val)}">`;
      else if (f.type === 'date') input = `<input data-cf="${f.key}" type="date" value="${escapeAttr(val)}">`;
      else if (f.type === 'checkbox') input = `<label style="display:flex;align-items:center;gap:8px;"><input data-cf="${f.key}" type="checkbox" ${val ? 'checked' : ''}> Bəli</label>`;
      else if (f.type === 'dropdown') input = `<select data-cf="${f.key}"><option value="">— seçin —</option>${f.options.map(o => `<option ${val === o ? 'selected' : ''}>${escapeAttr(o)}</option>`).join('')}</select>`;
      return `<div class="field"><label>${escapeAttr(f.label)}</label>${input}</div>`;
    }).join('');
  }

  /* Formadan custom dəyərləri oxu */
  function collectCustomValues(container) {
    const fields = getFields();
    const result = {};
    fields.forEach(f => {
      const el = container.querySelector(`[data-cf="${f.key}"]`);
      if (!el) return;
      result[f.key] = f.type === 'checkbox' ? el.checked : el.value;
    });
    return result;
  }

  function escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  /* ---------- Snippets (OTA / advanced) ---------- */
  function getSnippets() { return JollyDB.read(SNIPPETS_KEY, []); }
  function setSnippets(s) { JollyDB.write(SNIPPETS_KEY, s); }

  function addSnippet() {
    const name = prompt('Snippet adı (məs. "QR kod modulu"):');
    if (!name || !name.trim()) return;
    const code = prompt('JS kodu yapışdır (mən sənə verəcəyəm):');
    if (!code || !code.trim()) return;
    const snippets = getSnippets();
    snippets.push({ id: JollyDB.uid('snp'), name: name.trim(), code, enabled: false, createdAt: Date.now() });
    setSnippets(snippets);
    Toast.success('Snippet saxlanıldı — aktivləşdirmək üçün toggle et');
    JollyRouter.go('#/studios/code');
  }

  function toggleSnippet(id, enabled) {
    const snippets = getSnippets().map(s => s.id === id ? { ...s, enabled } : s);
    setSnippets(snippets);
    if (enabled) runSnippet(id);
    else Toast.info('Snippet növbəti açılışda söndürüləcək');
  }

  function deleteSnippet(id) {
    if (!confirm('Snippet silinsin?')) return;
    setSnippets(getSnippets().filter(s => s.id !== id));
    JollyRouter.go('#/studios/code');
  }

  function editSnippet(id) {
    const snippets = getSnippets();
    const s = snippets.find(x => x.id === id);
    if (!s) return;
    const name = prompt('Snippet adını dəyiş:', s.name);
    if (name === null) return;
    const code = prompt('Kodu dəyiş:', s.code);
    if (code === null) return;
    const updated = snippets.map(x => x.id === id ? { ...x, name: name.trim() || x.name, code, lastStatus: null, lastError: null } : x);
    setSnippets(updated);
    Toast.success('Snippet yeniləndi');
    JollyRouter.go('#/studios/code');
  }

  // Snippet-ə açılan bütün JOLLY API-ləri
  function snippetContext() {
    const api = {
      DB: JollyDB,
      Router: JollyRouter,
      Products: JollyProducts,
      Toast: Toast,
      Studios: (typeof JollyStudios !== 'undefined') ? JollyStudios : null,
      Brain: (typeof JollyBrain !== 'undefined') ? JollyBrain : null,
      Workflow: (typeof JollyWorkflow !== 'undefined') ? JollyWorkflow : null,
      Edge: (typeof JollyEdgePanel !== 'undefined') ? JollyEdgePanel : null,
      AI: (typeof JollyAI !== 'undefined') ? JollyAI : null,
    };
    return api;
  }

  function executeCode(code) {
    // JOLLY = bütün API-lərə çıxış obyekti
    const JOLLY = snippetContext();
    const fn = new Function(
      'JOLLY', 'JollyDB', 'JollyRouter', 'JollyProducts', 'Toast', 'JollyStudios',
      '"use strict";\n' + code
    );
    return fn(JOLLY, JollyDB, JollyRouter, JollyProducts, Toast,
      (typeof JollyStudios !== 'undefined') ? JollyStudios : null);
  }

  function runSnippet(id) {
    const snippet = getSnippets().find(s => s.id === id);
    if (!snippet) return;
    try {
      executeCode(snippet.code);
      updateSnippetStatus(id, 'ok', null);
      Toast.success(`"${snippet.name}" işə salındı`);
    } catch (e) {
      console.error('Snippet xətası:', e);
      updateSnippetStatus(id, 'error', e.message);
      Toast.error(`Xəta: ${e.message}`);
    }
    JollyRouter.go('#/studios/code');
  }

  function runEnabledSnippets() {
    getSnippets().filter(s => s.enabled).forEach(s => {
      try {
        executeCode(s.code);
        updateSnippetStatus(s.id, 'ok', null);
      } catch (e) {
        console.error('Snippet açılış xətası:', s.name, e);
        updateSnippetStatus(s.id, 'error', e.message);
      }
    });
  }

  function updateSnippetStatus(id, status, error) {
    const snippets = getSnippets().map(s => s.id === id ? { ...s, lastStatus: status, lastError: error, lastRun: Date.now() } : s);
    setSnippets(snippets);
  }

  /* ---------- UI ---------- */
  function renderStudio() {
    const fields = getFields();
    const snippets = getSnippets();
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 8px;font-size:19px;">⌨️ Code Studio</h2>
      <p class="muted" style="font-size:13px;margin:0 0 16px;">Çatışmayan bir şey varsa — burdan əlavə et. Kiçik şeylər kod yazmadan, böyüklər mənim verdiyim snippet ilə.</p>

      <div class="row between" style="margin-bottom:10px;">
        <span class="section-title" style="margin:0;">Əlavə sahələr (kodsuz)</span>
        <button class="btn btn-primary btn-sm" onclick="JollyCodeStudio.addField()">+ Sahə</button>
      </div>
      <div class="glass" style="padding:4px 14px;">
        ${fields.length ? fields.map(f => `
          <div class="list-row">
            <span>${escapeAttr(f.label)} <span class="muted" style="font-size:11px;">(${FIELD_TYPES[f.type]})</span></span>
            <span class="actions"><span onclick="JollyCodeStudio.editField('${f.id}')">✏️</span><span onclick="JollyCodeStudio.deleteField('${f.id}')">🗑️</span></span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hələ əlavə sahə yoxdur. "+ Sahə" ilə məhsul kartına yeni sahə əlavə et.</div>'}
      </div>

      <div class="row between" style="margin-bottom:10px;margin-top:8px;">
        <span class="section-title" style="margin:0;">Snippet-lər (OTA)</span>
        <button class="btn btn-ghost btn-sm" onclick="JollyCodeStudio.addSnippet()">+ Snippet</button>
      </div>
      <div class="glass" style="padding:4px 14px;">
        ${snippets.length ? snippets.map(s => `
          <div class="list-row">
            <span>${escapeAttr(s.name)}${s.lastStatus === 'error' ? '<br><span style="font-size:10.5px;color:var(--accent-danger);">⚠️ ' + escapeAttr(s.lastError || 'xəta') + '</span>' : s.lastStatus === 'ok' ? '<br><span style="font-size:10.5px;color:var(--accent-2);">✓ işlədi</span>' : ''}</span>
            <span class="actions">
              <label style="display:flex;align-items:center;"><input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="JollyCodeStudio.toggleSnippet('${s.id}',this.checked)"></label>
              <span onclick="JollyCodeStudio.runSnippet('${s.id}')">▶️</span>
              <span onclick="JollyCodeStudio.editSnippet('${s.id}')">✏️</span>
              <span onclick="JollyCodeStudio.deleteSnippet('${s.id}')">🗑️</span>
            </span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Snippet yoxdur. Yeni funksiya (məs. QR kod) lazım olanda mən sənə kod verəcəyəm, buraya yapışdıracaqsan.</div>'}
      </div>
      <p class="muted" style="font-size:11px;margin-top:10px;padding:0 4px;">⚠️ Snippet-lər yalnız mənim (JOLLY dəstəyi) verdiyim kodları yapışdırmaq üçündür. Naməlum kod yapışdırma.</p>
    `;
  }

  return {
    getFields, renderCustomFieldsHtml, collectCustomValues,
    addField, editField, deleteField, FIELD_TYPES,
    getSnippets, addSnippet, editSnippet, toggleSnippet, deleteSnippet, runSnippet, runEnabledSnippets,
    renderStudio,
  };
})();
