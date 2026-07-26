/* ============================================================
   JOLLY Mağaza Xəritəsi — real, interaktiv plan

   DÜZƏLİŞ (2026-07-25, #3): Xəritə əvvəllər kodda SABİT (hardcoded)
   idi — heç bir dəyişiklik saxlanmırdı. İndi bölmələr
   localStorage-da (JollyDB.KEYS.storeMap) saxlanılır və Admin
   üçün REDAKTƏ REJİMİ əlavə olundu:
   - İki xənəyə ard-arda toxunmaqla YERLƏRİNİ DƏYİŞ (swap) —
     sərbəst sürükləmə deyil, sadə "yerini dəyiş" məntiqi
   - ✏️ — adını dəyiş
   - 🔳 — ölçüsünü dəyiş (en/hündürlük, xana sayı ilə)
   - 🗑️ — bölməni sil
   - + Yeni bölmə — boş bir xanaya yeni bölmə əlavə et
   Adi işçi yalnız BAXIŞ+AXTARIŞ rejimini görür, redaktə düymələri
   yalnız Admin sessiyasında görünür.
   ============================================================ */
const JollyStoreMap = (() => {
  const DEFAULT_SECTIONS = [
    { id: 'giris', name: 'Giriş', col: 1, row: 1, cw: 1, ch: 1, color: '#8a8f9c', keys: ['giriş', 'giris', 'qapı'] },
    { id: 'kosmetika', name: 'Kosmetika', col: 1, row: 2, cw: 1, ch: 1, color: '#ff6bb3', keys: ['kosmetika', 'kosmetik', 'makiyaj'] },
    { id: 'krem', name: 'Krem', col: 1, row: 3, cw: 1, ch: 1, color: '#ff9d5c', keys: ['krem', 'losyon'] },
    { id: 'fenler', name: 'Fenlər', col: 1, row: 4, cw: 1, ch: 1, color: '#a855f7', keys: ['fen', 'fenlər', 'saç quruducu'] },
    { id: 'corab', name: 'Corablar', col: 2, row: 3, cw: 1, ch: 1, color: '#29e0c9', keys: ['corab', 'corablar', 'sock', 'носки'] },
    { id: 'oyuncaq', name: 'Oyuncaqlar', col: 3, row: 3, cw: 1, ch: 1, color: '#4f9fff', keys: ['oyuncaq', 'oyuncaqlar', 'toy'] },
    { id: 'party', name: 'Party malları', col: 4, row: 3, cw: 1, ch: 1, color: '#f5c563', keys: ['party', 'şar', 'bayram'] },
    { id: 'kassa', name: '3 Kassa', col: 2, row: 2, cw: 2, ch: 1, color: '#4ade80', keys: ['kassa', 'kasa', 'касса', 'ödəniş'] },
    { id: 'pillekchen', name: 'Pilləkən', col: 3, row: 4, cw: 1, ch: 1, color: '#8a8f9c', keys: ['pilləkən', 'pillekan', 'merdiven'] },
    { id: 'xirdavat', name: 'Xırdavat', col: 2, row: 4, cw: 1, ch: 1, color: '#ff5c6c', keys: ['xırdavat', 'xirdavat', 'dəmir', 'alət'] },
  ];

  const PALETTE = ['#8a8f9c', '#ff6bb3', '#ff9d5c', '#a855f7', '#29e0c9', '#4f9fff', '#f5c563', '#4ade80', '#ff5c6c', '#e879f9', '#38bdf8', '#fb923c'];

  let _editMode = false;
  let _swapSelId = null; // redaktə rejimində "swap üçün seçilmiş" xana

  function _isAdmin() {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return !s || s.role === 'admin'; // sessiya yoxdursa (PIN söndürülüb) admin kimi davran
    } catch (e) { return true; }
  }

  function getSections() {
    const stored = (typeof JollyDB !== 'undefined') ? JollyDB.read(JollyDB.KEYS.storeMap, null) : null;
    if (Array.isArray(stored) && stored.length) return stored;
    const seeded = DEFAULT_SECTIONS.map(s => ({ ...s }));
    saveSections(seeded);
    return seeded;
  }
  function saveSections(list) {
    if (typeof JollyDB !== 'undefined') JollyDB.write(JollyDB.KEYS.storeMap, list);
  }

  function findSection(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return null;
    let expanded = q;
    if (typeof JollyAIDictionary !== 'undefined') expanded = JollyAIDictionary.expandText(q);
    const sections = getSections();
    for (const s of sections) {
      if ((s.keys || []).some(k => q.includes(k) || expanded.includes(k))) return s;
    }
    if (typeof JollyDB !== 'undefined') {
      const prods = JollyDB.Products.all().filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.group && p.group.toLowerCase().includes(q)));
      if (prods.length && prods[0].group) {
        const g = prods[0].group.toLowerCase();
        for (const s of sections) if ((s.keys || []).some(k => g.includes(k))) return s;
      }
    }
    return null;
  }

  function render(highlightId) {
    if (window.JollyAuth && !JollyAuth.can('storemap.view')) {
      if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
      return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
    }
    const sections = getSections();
    const isAdmin = _isAdmin();
    const cells = sections.map(s => {
      const editBtns = (_editMode && isAdmin) ? `
        <div style="position:absolute;top:2px;right:2px;display:flex;gap:2px;z-index:2;">
          <span onclick="event.stopPropagation();JollyStoreMap.renameSection('${s.id}')" style="width:18px;height:18px;border-radius:4px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;cursor:pointer;">✏️</span>
          <span onclick="event.stopPropagation();JollyStoreMap.resizeSection('${s.id}')" style="width:18px;height:18px;border-radius:4px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;cursor:pointer;">🔳</span>
          <span onclick="event.stopPropagation();JollyStoreMap.deleteSection('${s.id}')" style="width:18px;height:18px;border-radius:4px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;cursor:pointer;">🗑️</span>
        </div>` : '';
      const swapSel = (_editMode && _swapSelId === s.id) ? 'outline:3px solid #fff;' : '';
      return `
      <div class="sm-cell ${highlightId === s.id ? 'sm-hi' : ''}" style="position:relative;grid-column:${s.col} / span ${s.cw}; grid-row:${s.row} / span ${s.ch}; --sc:${s.color};${swapSel}"
           onclick="JollyStoreMap.tapSection('${s.id}')">
        ${editBtns}
        <span class="sm-name">${escapeMapHtml(s.name)}</span>
      </div>
    `;
    }).join('');
    const editToggle = isAdmin ? `
      <div class="row" style="gap:8px;margin-bottom:12px;">
        <button class="btn ${_editMode ? 'btn-primary' : 'btn-ghost'}" style="flex:1;" onclick="JollyStoreMap.toggleEditMode()">${_editMode ? '✅ Redaktəni bitir' : '✏️ Xəritəni redaktə et'}</button>
        ${_editMode ? `<button class="btn btn-ghost" onclick="JollyStoreMap.addSection()">+ Yeni bölmə</button>` : ''}
      </div>
      ${_editMode ? `<p class="muted" style="font-size:11px;margin:-6px 0 12px;">İki xənəyə ard-arda toxun — yerlərini dəyişəcək. ✏️ ad, 🔳 ölçü, 🗑️ sil.</p>` : ''}
    ` : '';
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🗺️ Mağaza Xəritəsi</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Məhsul və ya bölmə yaz — xəritədə yerini işıqlandırım.</p>
      ${editToggle}
      <div class="row" style="gap:8px;margin-bottom:16px;">
        <input id="smSearch" placeholder="Məs: corab, kosmetika, party..." style="flex:1;" onkeydown="if(event.key==='Enter')JollyStoreMap.search()">
        <button class="btn btn-primary" onclick="JollyStoreMap.search()">Tap</button>
      </div>
      <div class="store-map">${cells}</div>
      <div id="smInfo" class="muted" style="font-size:12.5px;margin-top:14px;text-align:center;"></div>
    `;
  }

  function escapeMapHtml(s) {
    return (typeof JollyProducts !== 'undefined') ? JollyProducts.escapeHtml(String(s)) : String(s);
  }

  function _rerender(highlightId) {
    const main = document.getElementById('main');
    if (main) main.innerHTML = render(highlightId || null);
  }

  function toggleEditMode() {
    if (!_isAdmin()) { Toast.error('🔒 Yalnız Admin redaktə edə bilər'); return; }
    _editMode = !_editMode;
    _swapSelId = null;
    _rerender();
  }

  function tapSection(id) {
    if (_editMode && _isAdmin()) {
      if (!_swapSelId) {
        _swapSelId = id;
        _rerender();
        return;
      }
      if (_swapSelId === id) { _swapSelId = null; _rerender(); return; }
      _swapPositions(_swapSelId, id);
      _swapSelId = null;
      return;
    }
    const sections = getSections();
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    _rerender(id);
    const info = document.getElementById('smInfo');
    if (info) info.innerHTML = `📍 <b style="color:${sec.color};">${escapeMapHtml(sec.name)}</b>`;
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }

  function _swapPositions(idA, idB) {
    const sections = getSections();
    const a = sections.find(s => s.id === idA);
    const b = sections.find(s => s.id === idB);
    if (!a || !b) return;
    const tmp = { col: a.col, row: a.row, cw: a.cw, ch: a.ch };
    a.col = b.col; a.row = b.row; a.cw = b.cw; a.ch = b.ch;
    b.col = tmp.col; b.row = tmp.row; b.cw = tmp.cw; b.ch = tmp.ch;
    saveSections(sections);
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('Yerləri dəyişdirildi');
    _rerender();
  }

  function renameSection(id) {
    const sections = getSections();
    const s = sections.find(x => x.id === id);
    if (!s) return;
    const name = prompt('Yeni ad:', s.name);
    if (!name || !name.trim()) return;
    s.name = name.trim();
    saveSections(sections);
    Toast.success('Ad yeniləndi');
    _rerender();
  }

  function resizeSection(id) {
    const sections = getSections();
    const s = sections.find(x => x.id === id);
    if (!s) return;
    const wRaw = prompt('En (neçə xana enində olsun, məs. 1 və ya 2):', String(s.cw || 1));
    if (wRaw === null) return;
    const hRaw = prompt('Hündürlük (neçə xana hündürlüyündə olsun):', String(s.ch || 1));
    if (hRaw === null) return;
    const w = Math.max(1, Math.min(4, parseInt(wRaw, 10) || 1));
    const h = Math.max(1, Math.min(4, parseInt(hRaw, 10) || 1));
    s.cw = w; s.ch = h;
    saveSections(sections);
    Toast.success('Ölçü yeniləndi');
    _rerender();
  }

  function deleteSection(id) {
    const sections = getSections();
    const s = sections.find(x => x.id === id);
    if (!s) return;
    if (!confirm(`"${s.name}" bölməsi xəritədən silinsin?`)) return;
    saveSections(sections.filter(x => x.id !== id));
    Toast.success('Silindi');
    _rerender();
  }

  function addSection() {
    const name = prompt('Yeni bölmənin adı:');
    if (!name || !name.trim()) return;
    const sections = getSections();
    // Boş (məşğul olmayan) ilk 1x1 xananı 4 sütunluq grid-də tap (8 sətrə qədər axtar)
    const occupied = new Set();
    sections.forEach(s => {
      for (let c = s.col; c < s.col + s.cw; c++) {
        for (let r = s.row; r < s.row + s.ch; r++) occupied.add(c + ':' + r);
      }
    });
    let col = 1, row = 1, found = false;
    outer:
    for (row = 1; row <= 8; row++) {
      for (col = 1; col <= 4; col++) {
        if (!occupied.has(col + ':' + row)) { found = true; break outer; }
      }
    }
    if (!found) { Toast.error('Boş xana tapılmadı — əvvəlcə yer aç'); return; }
    const color = PALETTE[sections.length % PALETTE.length];
    const id = 'sec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sections.push({ id, name: name.trim(), col, row, cw: 1, ch: 1, color, keys: [name.trim().toLowerCase()] });
    saveSections(sections);
    Toast.success(`"${name.trim()}" əlavə olundu`);
    _rerender();
  }

  function search() {
    const inp = document.getElementById('smSearch');
    if (!inp) return;
    const sec = findSection(inp.value);
    if (sec) {
      _rerender(sec.id);
      const info = document.getElementById('smInfo');
      if (info) info.innerHTML = `📍 <b style="color:${sec.color};">${escapeMapHtml(sec.name)}</b> bölməsi işıqlandırıldı.`;
      if (typeof JollySound !== 'undefined') JollySound.success();
    } else {
      Toast.error('Bu bölmə tapılmadı');
    }
  }

  /* ---------- Marşrut ---------- */
  function tryRoute() {
    if ((window.location.hash || '') !== '#/store-map') return;
    _rerender();
  }
  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', () => setTimeout(tryRoute, 0));
    setTimeout(tryRoute, 0);
  });

  return { render, search, tapSection, findSection, toggleEditMode, renameSection, resizeSection, deleteSection, addSection };
})();
