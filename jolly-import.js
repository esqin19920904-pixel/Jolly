/* ============================================================
   JOLLY Barkod İdxalı — 1C / Excel faylından kataloqa
   CSV/TSV faylı oxuyur, sütunları özün təyin edirsən, əvvəlcə
   ÖN BAXIŞ göstərir, yalnız təsdiqdən sonra yazır.
   Səhv olsa — "Son idxalı geri al" ilə hamısı geri qaytarılır.

   Marşrut: #/import  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollyImport = (() => {
  const LAST_KEY = 'jolly_last_import';   // {at, createdIds:[], updatedIds:[]}

  let rows = [];        // [[hüceyrə, ...], ...]
  let headerRow = true;
  let map = { id: -1, name: -1, barcode: -1, price: -1, group: -1 };
  let fileName = '';
  let _error = '';
  let _encoding = '';
  let _delimiter = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* ---------- Fayl oxuma ---------- */
  function _detectDelimiter(text) {
    const line = (text.split(/\r?\n/).find(l => l.trim()) || '');
    const counts = { '\t': 0, ';': 0, ',': 0, '|': 0 };
    Object.keys(counts).forEach(d => { counts[d] = line.split(d).length - 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ',';
  }

  /* Sadə CSV oxuyucusu — dırnaq içindəki ayırıcıları nəzərə alır */
  function _parse(text, delim) {
    const out = [];
    let row = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cell += c;
        continue;
      }
      if (c === '"') { inQuotes = true; continue; }
      if (c === delim) { row.push(cell.trim()); cell = ''; continue; }
      if (c === '\n') { row.push(cell.trim()); if (row.some(x => x)) out.push(row); row = []; cell = ''; continue; }
      if (c === '\r') continue;
      cell += c;
    }
    row.push(cell.trim());
    if (row.some(x => x)) out.push(row);
    return out;
  }

  /* Başlıq adlarından sütunları özü tapmağa çalışır */
  function _autoMap() {
    map = { id: -1, name: -1, barcode: -1, price: -1, group: -1 };
    if (!rows.length) return;
    const head = rows[0].map(h => String(h).toLowerCase());
    head.forEach((h, i) => {
      if (map.id < 0 && /^id$/.test(h.trim())) map.id = i;
      if (map.barcode < 0 && /barkod|ştrix|strix|штрих|ean|barcode/.test(h)) map.barcode = i;
      if (map.name < 0 && /ad|nomenkl|наимен|название|name|mal/.test(h)) map.name = i;
      if (map.price < 0 && /qiym|цена|price|məbləğ/.test(h)) map.price = i;
      if (map.group < 0 && /qrup|kateq|группа|group/.test(h)) map.group = i;
    });
    // Tapılmasa: ən çox rəqəmdən ibarət uzun sütun = barkod
    if (map.barcode < 0) {
      const body = rows.slice(headerRow ? 1 : 0, 30);
      let best = -1, bestScore = 0;
      const cols = Math.max(...rows.map(r => r.length));
      for (let c = 0; c < cols; c++) {
        let score = 0;
        body.forEach(r => {
          const v = String(r[c] || '').replace(/\D/g, '');
          if (v.length >= 8 && v.length <= 14) score++;
        });
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (bestScore >= 2) map.barcode = best;
    }
    if (map.name < 0) {
      const cols = Math.max(...rows.map(r => r.length));
      for (let c = 0; c < cols; c++) {
        if (c === map.barcode) continue;
        const body = rows.slice(headerRow ? 1 : 0, 20);
        const textish = body.filter(r => /[a-zəçğıöşüA-ZƏÇĞIÖŞÜ]/.test(String(r[c] || ''))).length;
        if (textish >= 2) { map.name = c; break; }
      }
    }
  }

  /* Kodlaşdırma tapıcısı — 1C/Excel Azərbaycanda faylı çox vaxt
     Windows-1254 və ya Windows-1251 ilə verir. UTF-8 kimi oxusaq
     adlar əcaib simvollara çevrilir. Ona görə üç variantı sınayıb
     ən az pozulmuş olanı seçirik. */
  function _decodeBest(buffer) {
    const tries = ['utf-8', 'windows-1254', 'windows-1251'];
    let best = null, bestScore = -1;
    tries.forEach(enc => {
      let text;
      try { text = new TextDecoder(enc).decode(buffer); } catch (e) { return; }
      const bad = (text.match(/\uFFFD/g) || []).length;          // pozulmuş simvol
      const good = (text.match(/[a-zA-ZəçğıöşüƏÇĞİÖŞÜ]/g) || []).length;
      const score = good - bad * 50;
      if (score > bestScore) { bestScore = score; best = { text, enc, bad }; }
    });
    return best;
  }

  async function onFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    fileName = file.name;

    // Excel faylı birbaşa oxunmur — səssizcə uğursuz olmasın
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      _error = 'Bu Excel faylıdır (' + file.name.split('.').pop() + '). Birbaşa oxuya bilmirəm.\n\nExcel-də faylı aç → Fayl → Farklı saxla → növ olaraq <b>CSV UTF-8 (vergüllə ayrılmış)</b> seç → yenidən bura yüklə.';
      rows = [];
      _paint();
      return;
    }

    try {
      const buf = await file.arrayBuffer();
      const dec = _decodeBest(buf);
      if (!dec) { _error = 'Faylın kodlaşdırmasını tanıya bilmədim.'; _paint(); return; }
      let text = dec.text;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);   // BOM
      const delim = _detectDelimiter(text);
      rows = _parse(text, delim);
      if (!rows.length) {
        _error = 'Faylda oxunacaq sətir tapılmadı. Boş ola bilər, ya da fərqli formatdadır.';
        _paint();
        return;
      }
      _error = '';
      _encoding = dec.enc;
      _delimiter = delim === '\t' ? 'TAB' : delim;
      headerRow = rows[0].some(c => /[a-zəçğıöşüA-ZƏÇĞIÖŞÜ]/.test(String(c)) && String(c).replace(/\D/g, '').length < 5);
      _autoMap();
      _paint();
    } catch (e) {
      console.error('[Import]', e);
      _error = 'Fayl oxunmadı: ' + (e && e.message ? e.message : 'naməlum xəta');
      rows = [];
      _paint();
    }
  }

  /* ---------- Sətirləri məhsullara çevir ---------- */
  function _records() {
    const body = rows.slice(headerRow ? 1 : 0);
    const out = [];
    body.forEach(r => {
      const code = map.barcode >= 0 ? String(r[map.barcode] || '').replace(/\D/g, '') : '';
      const name = map.name >= 0 ? String(r[map.name] || '').trim() : '';
      if (!code && !name) return;
      const rec = { code, name };
      if (map.id >= 0) rec.id = String(r[map.id] || '').trim();
      if (map.price >= 0) {
        const n = parseFloat(String(r[map.price] || '').replace(',', '.').replace(/[^\d.]/g, ''));
        if (!isNaN(n)) rec.price = n;
      }
      if (map.group >= 0) rec.group = String(r[map.group] || '').trim();
      out.push(rec);
    });
    return out;
  }

  function _analyze() {
    const recs = _records();
    const byCode = {};
    JollyDB.Products.all().forEach(p => (p.barcodes || []).forEach(b => { byCode[String(b)] = p; }));
    let willCreate = 0, willUpdate = 0, noCode = 0, byIdCount = 0;
    const seen = new Set();
    recs.forEach(r => {
      if (r.id && JollyDB.Products.get(r.id)) { byIdCount++; willUpdate++; return; }
      if (!r.code) { noCode++; return; }
      if (seen.has(r.code)) return;
      seen.add(r.code);
      if (byCode[r.code]) willUpdate++; else willCreate++;
    });
    return { recs, willCreate, willUpdate, noCode, byIdCount, total: recs.length };
  }

  /* ---------- Ekran ---------- */
  function render() {
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📥 Barkod İdxalı</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">1C və ya Excel faylını CSV kimi saxla, bura yüklə. Yazmazdan əvvəl hər şeyi göstərəcəyəm.</p>
      <div id="importBody"></div>
      <input type="file" id="importFile" accept=".csv,.tsv,.txt" style="display:none" onchange="JollyImport.onFile(event)">
    `;
  }

  function afterRender() { _paint(); }

  function _paint() {
    const el = document.getElementById('importBody');
    if (!el) return;

    if (!rows.length) {
      const last = JollyDB.read(LAST_KEY, null);
      el.innerHTML = `
        ${_error ? `<div class="glass" style="padding:12px;margin-bottom:12px;border-left:3px solid #ff5c6c;font-size:12.5px;line-height:1.5;">${_error.replace(/\n/g, '<br>')}</div>` : ''}
        <div class="glass" style="padding:18px;text-align:center;">
          <div style="font-size:34px;margin-bottom:8px;">📄</div>
          <button class="btn btn-primary btn-block" onclick="document.getElementById('importFile').click()">Fayl seç</button>
          <p class="muted" style="font-size:11.5px;margin:12px 0 0;">CSV, TSV və ya TXT. Excel-də: Fayl → Farklı saxla → CSV UTF-8.</p>
        </div>
        <div class="glass" style="padding:12px;margin-top:12px;">
          <div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">⚠️ Əvvəlcə backup çıxar</div>
          <p class="muted" style="font-size:11.5px;margin:0 0 10px;">İdxal kataloqa toplu yazır. Backup Mərkəzindən bir nüsxə götür, sonra başla.</p>
          <button class="btn btn-ghost btn-block" onclick="JollyRouter.go('#/studios/data')">Backup Mərkəzi</button>
        </div>
        ${last && last.createdIds && last.createdIds.length ? `
          <div class="glass" style="padding:12px;margin-top:12px;border-left:3px solid #ffc86b;">
            <div style="font-size:12.5px;font-weight:600;">Son idxal: ${new Date(last.at).toLocaleString('az-AZ')}</div>
            <p class="muted" style="font-size:11.5px;margin:4px 0 10px;">${last.createdIds.length} yeni məhsul yaradılmışdı.</p>
            <button class="btn btn-ghost btn-block" onclick="JollyImport.undoLast()">↩️ Son idxalı geri al</button>
          </div>` : ''}
      `;
      return;
    }

    const a = _analyze();
    const cols = Math.max(...rows.map(r => r.length));
    const preview = rows.slice(0, 4);

    const colOptions = (sel) => {
      let o = `<option value="-1"${sel === -1 ? ' selected' : ''}>— yoxdur —</option>`;
      for (let c = 0; c < cols; c++) {
        const sample = String((rows[headerRow ? 0 : 0] || [])[c] || '').slice(0, 18);
        o += `<option value="${c}"${sel === c ? ' selected' : ''}>${c + 1}. ${esc(sample) || 'sütun'}</option>`;
      }
      return o;
    };
    const selStyle = 'width:100%;padding:9px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--border-soft);color:var(--text-hi);font-size:13px;';

    el.innerHTML = `
      <div class="glass" style="padding:12px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="flex:1;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📄 ${esc(fileName)}</span>
          <span class="muted" style="font-size:11.5px;">${rows.length} sətir</span>
        </div>
        <div class="muted" style="font-size:11px;margin-top:4px;">Kodlaşdırma: ${esc(_encoding)} · Ayırıcı: ${esc(_delimiter)}</div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12.5px;cursor:pointer;">
          <input type="checkbox" ${headerRow ? 'checked' : ''} onchange="JollyImport.setHeader(this.checked)"> Birinci sətir başlıqdır
        </label>
      </div>

      <div class="section-title">Sütunları uyğunlaşdır</div>
      <div class="glass" style="padding:12px;margin-bottom:12px;">
        <div style="margin-bottom:10px;"><div class="muted" style="font-size:11px;margin-bottom:4px;">🆔 ID (Cədvəl Körpüsündən gələn fayllarda olur)</div>
          <select style="${selStyle}" onchange="JollyImport.setMap('id',this.value)">${colOptions(map.id)}</select></div>
        <div style="margin-bottom:10px;"><div class="muted" style="font-size:11px;margin-bottom:4px;">🏷️ Barkod</div>
          <select style="${selStyle}" onchange="JollyImport.setMap('barcode',this.value)">${colOptions(map.barcode)}</select></div>
        <div style="margin-bottom:10px;"><div class="muted" style="font-size:11px;margin-bottom:4px;">📛 Ad</div>
          <select style="${selStyle}" onchange="JollyImport.setMap('name',this.value)">${colOptions(map.name)}</select></div>
        <div style="margin-bottom:10px;"><div class="muted" style="font-size:11px;margin-bottom:4px;">💰 Qiymət (istəyə bağlı)</div>
          <select style="${selStyle}" onchange="JollyImport.setMap('price',this.value)">${colOptions(map.price)}</select></div>
        <div><div class="muted" style="font-size:11px;margin-bottom:4px;">📦 Qrup (istəyə bağlı)</div>
          <select style="${selStyle}" onchange="JollyImport.setMap('group',this.value)">${colOptions(map.group)}</select></div>
      </div>

      <div class="section-title">Ön baxış</div>
      <div class="glass" style="padding:4px 12px;margin-bottom:12px;overflow-x:auto;">
        ${preview.map((r, i) => `
          <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;">
            <span class="mono" style="color:#4f9fff;">${esc(map.barcode >= 0 ? (r[map.barcode] || '—') : '—')}</span>
            <span style="margin-left:8px;">${esc(map.name >= 0 ? (r[map.name] || '—') : '—')}</span>
            ${i === 0 && headerRow ? '<span class="muted" style="font-size:10px;margin-left:6px;">(başlıq)</span>' : ''}
          </div>`).join('')}
      </div>

      <div class="glass" style="padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
          <span>🆕 Yeni yaradılacaq</span><b style="color:#4ade80;">${a.willCreate}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
          <span>✏️ Mövcud məhsul tamamlanacaq</span><b style="color:#4f9fff;">${a.willUpdate}</b></div>
        ${a.byIdCount ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
          <span>🆔 ID ilə tanınan (cədvəldən qayıdan)</span><b style="color:#ffc86b;">${a.byIdCount}</b></div>` : ''}
        ${a.noCode ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
          <span class="muted">⏭️ Barkodsuz sətir (keçiləcək)</span><b class="muted">${a.noCode}</b></div>` : ''}
      </div>

      ${(map.barcode < 0 && map.id < 0)
        ? `<div class="glass" style="padding:12px;border-left:3px solid #ff5c6c;font-size:12.5px;">Barkod (və ya ID) sütununu seç — onsuz idxal edə bilmərəm.</div>`
        : `<button class="btn btn-primary btn-block" onclick="JollyImport.run()">📥 ${a.willCreate + a.willUpdate} sətri idxal et</button>`}
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="JollyImport.reset()">Ləğv et</button>
    `;
  }

  function setHeader(v) { headerRow = !!v; _autoMap(); _paint(); }
  function setMap(k, v) { map[k] = parseInt(v, 10); _paint(); }
  function reset() { rows = []; fileName = ''; _error = ''; _paint(); }

  /* ---------- İdxal ---------- */
  function run() {
    if (map.barcode < 0 && map.id < 0) { Toast.error('Barkod və ya ID sütununu seç'); return; }
    const a = _analyze();
    if (!confirm(`${a.willCreate} yeni məhsul yaradılacaq, ${a.willUpdate} mövcud məhsul tamamlanacaq. Davam edim?`)) return;

    const byCode = {};
    JollyDB.Products.all().forEach(p => (p.barcodes || []).forEach(b => { byCode[String(b)] = p; }));

    const createdIds = [], updatedIds = [];
    const seen = new Set();
    let skipped = 0;

    a.recs.forEach(r => {
      if (!r.code && !r.id) { skipped++; return; }
      if (r.code) {
        if (seen.has(r.code) && !r.id) { skipped++; return; }
        seen.add(r.code);
      }

      // ID varsa — cədvəldən qayıdan sətirdir, dəqiq həmin məhsulu yenilə
      if (r.id) {
        const byId = JollyDB.Products.get(r.id);
        if (byId) {
          const patch = {};
          if (r.name) patch.name = r.name;
          if (r.price != null) patch.price = r.price;
          if (r.group) patch.group = r.group;
          if (r.code && !(byId.barcodes || []).some(b => String(b) === r.code)) {
            patch.barcodes = (byId.barcodes || []).concat([r.code]);
          }
          if (Object.keys(patch).length) {
            JollyDB.Products.update(byId.id, patch);
            updatedIds.push(byId.id);
          }
          return;
        }
      }

      const existing = byCode[r.code];
      if (existing) {
        // Yalnız BOŞ sahələri doldur — mövcud məlumatın üstündən yazma
        const patch = {};
        if ((!existing.name || !existing.name.trim()) && r.name) patch.name = r.name;
        if ((existing.price == null || existing.price === '') && r.price != null) patch.price = r.price;
        if (!existing.group && r.group) patch.group = r.group;
        if (Object.keys(patch).length) {
          JollyDB.Products.update(existing.id, patch);
          updatedIds.push(existing.id);
        }
        return;
      }

      const payload = { name: r.name || r.code, barcodes: [r.code], images: [] };
      if (r.price != null) payload.price = r.price;
      if (r.group) payload.group = r.group;
      const rec = JollyDB.Products.add(payload);
      if (rec && rec.id) createdIds.push(rec.id);
    });

    JollyDB.write(LAST_KEY, { at: Date.now(), createdIds, updatedIds, file: fileName });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(`${createdIds.length} yeni, ${updatedIds.length} tamamlandı`);
    rows = [];
    _paint();
  }

  function undoLast() {
    const last = JollyDB.read(LAST_KEY, null);
    if (!last || !last.createdIds || !last.createdIds.length) { Toast.error('Geri alınacaq idxal yoxdur'); return; }
    if (!confirm(`Son idxalda yaradılmış ${last.createdIds.length} məhsul silinsin?\n\nQeyd: tamamlanmış köhnə məhsullar geri qaytarılmır.`)) return;
    let n = 0;
    last.createdIds.forEach(id => {
      try { if (JollyDB.Products.get(id)) { JollyDB.Products.remove(id); n++; } } catch (e) {}
    });
    JollyDB.write(LAST_KEY, { ...last, createdIds: [] });
    Toast.success(`${n} məhsul geri alındı`);
    _paint();
  }

  /* ---------- Qeydiyyat ---------- */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'import',
      perm: 'import.use',
      name: 'Barkod İdxalı',
      icon: '📥',
      route: '#/import',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
      afterRender() { afterRender(); },
    });
  }

  return { render, afterRender, onFile, setHeader, setMap, reset, run, undoLast };
})();
