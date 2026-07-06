/* ============================================================
   JOLLY Mağaza Xəritəsi — real, interaktiv plan
   Plan: Giriş yuxarı-sol; sol divar Kosmetika→Krem→Fenlər;
   mərkəzdə 3 kasa; pilləkən ortada; Oyuncaqlar mərkəz;
   Corablar solda, Party sağda, Xırdavat aşağı.
   Marşrut: #/store-map (özü tutur)
   ============================================================ */
const JollyStoreMap = (() => {
  // Hər bölmə: id, ad, grid mövqe (col/row/span), rəng, açar sözlər
  const SECTIONS = [
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

  function findSection(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return null;
    // Sinonimlə genişləndir
    let expanded = q;
    if (typeof JollyAIDictionary !== 'undefined') expanded = JollyAIDictionary.expandText(q);
    for (const s of SECTIONS) {
      if (s.keys.some(k => q.includes(k) || expanded.includes(k))) return s;
    }
    // Məhsul qrupuna görə tap
    if (typeof JollyDB !== 'undefined') {
      const prods = JollyDB.Products.all().filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.group && p.group.toLowerCase().includes(q)));
      if (prods.length && prods[0].group) {
        const g = prods[0].group.toLowerCase();
        for (const s of SECTIONS) if (s.keys.some(k => g.includes(k))) return s;
      }
    }
    return null;
  }

  function render(highlightId) {
    const cells = SECTIONS.map(s => `
      <div class="sm-cell ${highlightId === s.id ? 'sm-hi' : ''}"
           style="grid-column:${s.col} / span ${s.cw}; grid-row:${s.row} / span ${s.ch}; --sc:${s.color};"
           onclick="JollyStoreMap.tapSection('${s.id}')">
        <span class="sm-name">${s.name}</span>
      </div>
    `).join('');
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🗺️ Mağaza Xəritəsi</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Məhsul və ya bölmə yaz — xəritədə yerini işıqlandırım.</p>
      <div class="row" style="gap:8px;margin-bottom:16px;">
        <input id="smSearch" placeholder="Məs: corab, kosmetika, party..." style="flex:1;" onkeydown="if(event.key==='Enter')JollyStoreMap.search()">
        <button class="btn btn-primary" onclick="JollyStoreMap.search()">Tap</button>
      </div>
      <div class="store-map">${cells}</div>
      <div id="smInfo" class="muted" style="font-size:12.5px;margin-top:14px;text-align:center;"></div>
    `;
  }

  function search() {
    const inp = document.getElementById('smSearch');
    if (!inp) return;
    const sec = findSection(inp.value);
    const main = document.getElementById('main');
    if (sec) {
      if (main) main.innerHTML = render(sec.id);
      const info = document.getElementById('smInfo');
      if (info) info.innerHTML = `📍 <b style="color:${sec.color};">${sec.name}</b> bölməsi işıqlandırıldı.`;
      if (typeof JollySound !== 'undefined') JollySound.success();
    } else {
      Toast.error('Bu bölmə tapılmadı');
    }
  }

  function tapSection(id) {
    const sec = SECTIONS.find(s => s.id === id);
    if (!sec) return;
    const main = document.getElementById('main');
    if (main) main.innerHTML = render(id);
    const info = document.getElementById('smInfo');
    if (info) info.innerHTML = `📍 <b style="color:${sec.color};">${sec.name}</b>`;
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }

  /* ---------- Marşrut ---------- */
  function tryRoute() {
    if ((window.location.hash || '') !== '#/store-map') return;
    const main = document.getElementById('main');
    if (main) main.innerHTML = render(null);
  }
  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', () => setTimeout(tryRoute, 0));
    setTimeout(tryRoute, 0);
  });

  return { render, search, tapSection, findSection };
})();
