/* ============================================================
   JOLLY Modul Nümunəsi — map.js (Store Map)
   BU FAYLI ÖRNƏK GÖTÜR. Yeni modul yaratmaq üçün:
   1) Yeni fayl yarat (məs: stock.js)
   2) Bu strukturu kopyala, id/name/icon/route dəyiş
   3) render() içində öz səhifəni yaz
   4) index.html-ə əlavə et: <script src="stock.js"></script>
   5) App-da avtomatik görünəcək!
   ============================================================ */
const JollyMapModule = {
  // ---- Modul məlumatı (məcburi) ----
  id: 'map',
  name: 'Mağaza Xəritəsi',
  icon: '🗺️',
  route: '#/map',
  group: 'Mağaza',        // qruplaşdırma (Studios-da başlıq)
  enabled: true,
  inMenu: false,          // alt naviqasiyada görünsün?
  inEdge: false,          // edge panel-də görünsün?

  // ---- Səhifə (məcburi) ----
  render(sub) {
    // sub = route-un qalan hissəsi (#/map/xxx → "xxx")
    const sections = this._sections();
    const cells = sections.map(s => `
      <div class="mapx-cell" style="grid-column:${s.col}/span ${s.cw};grid-row:${s.row}/span ${s.ch};--mc:${s.color};"
           onclick="JollyMapModule.tap('${s.id}')">
        <span>${s.name}</span>
      </div>
    `).join('');
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🗺️ Mağaza Xəritəsi</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Məhsul və ya bölmə yaz — yerini göstərim.</p>
      <div class="row" style="gap:8px;margin-bottom:14px;">
        <input id="mapxSearch" placeholder="corab, kosmetika, party..." style="flex:1;" onkeydown="if(event.key==='Enter')JollyMapModule.search()">
        <button class="btn btn-primary" onclick="JollyMapModule.search()">Tap</button>
      </div>
      <div class="mapx-grid">${cells}</div>
      <div id="mapxInfo" class="muted" style="font-size:12.5px;margin-top:14px;text-align:center;"></div>
    `;
  },

  // ---- Başlanğıc (məcburi, boş ola bilər) ----
  init() {
    // Modul yüklənəndə bir dəfə işləyir (CSS əlavə etmək və s.)
    if (document.getElementById('mapxStyle')) return;
    const st = document.createElement('style');
    st.id = 'mapxStyle';
    st.textContent = `
      .mapx-grid{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:70px;gap:8px;padding:14px;border-radius:16px;background:rgba(15,18,32,.6);border:1px solid rgba(255,255,255,.08);}
      .mapx-cell{border-radius:12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px;cursor:pointer;font-size:11.5px;font-weight:600;color:#e0e6f2;background:color-mix(in srgb,var(--mc) 12%,transparent);border:1.5px solid color-mix(in srgb,var(--mc) 40%,transparent);transition:all .2s;}
      .mapx-cell:active{transform:scale(.96);}
      .mapx-cell.hi{background:var(--mc);border-color:#fff;box-shadow:0 0 24px var(--mc);animation:mapxPulse 1.2s ease-in-out infinite;}
      .mapx-cell.hi span{color:#05060a;font-weight:800;}
      @keyframes mapxPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.05);}}
    `;
    document.head.appendChild(st);
  },

  // ---- Öz köməkçi funksiyaları ----
  _sections() {
    return [
      { id: 'giris', name: 'Giriş', col: 1, row: 1, cw: 1, ch: 1, color: '#8a8f9c', keys: ['giriş', 'giris'] },
      { id: 'kosmetika', name: 'Kosmetika', col: 1, row: 2, cw: 1, ch: 1, color: '#ff6bb3', keys: ['kosmetika', 'kosmetik'] },
      { id: 'krem', name: 'Krem', col: 1, row: 3, cw: 1, ch: 1, color: '#ff9d5c', keys: ['krem'] },
      { id: 'fen', name: 'Fenlər', col: 1, row: 4, cw: 1, ch: 1, color: '#a855f7', keys: ['fen', 'fenlər'] },
      { id: 'corab', name: 'Corablar', col: 2, row: 3, cw: 1, ch: 1, color: '#29e0c9', keys: ['corab', 'corablar'] },
      { id: 'oyuncaq', name: 'Oyuncaqlar', col: 3, row: 3, cw: 1, ch: 1, color: '#4f9fff', keys: ['oyuncaq'] },
      { id: 'party', name: 'Party', col: 4, row: 3, cw: 1, ch: 1, color: '#f5c563', keys: ['party', 'şar'] },
      { id: 'kassa', name: '3 Kassa', col: 2, row: 2, cw: 2, ch: 1, color: '#4ade80', keys: ['kassa', 'kasa'] },
      { id: 'pillek', name: 'Pilləkən', col: 3, row: 4, cw: 1, ch: 1, color: '#8a8f9c', keys: ['pilləkən'] },
      { id: 'xirdavat', name: 'Xırdavat', col: 2, row: 4, cw: 1, ch: 1, color: '#ff5c6c', keys: ['xırdavat'] },
    ];
  },
  _find(q) {
    q = String(q || '').toLowerCase().trim();
    if (!q) return null;
    for (const s of this._sections()) if (s.keys.some(k => q.includes(k))) return s;
    // məhsul qrupuna görə
    if (typeof JollyDB !== 'undefined') {
      const p = JollyDB.Products.all().find(x => (x.name && x.name.toLowerCase().includes(q)) || (x.group && x.group.toLowerCase().includes(q)));
      if (p && p.group) { const g = p.group.toLowerCase(); for (const s of this._sections()) if (s.keys.some(k => g.includes(k))) return s; }
    }
    return null;
  },
  search() {
    const inp = document.getElementById('mapxSearch');
    if (!inp) return;
    const sec = this._find(inp.value);
    const main = document.getElementById('main');
    if (sec && main) {
      main.innerHTML = this.render();
      setTimeout(() => {
        const cell = [...document.querySelectorAll('.mapx-cell')].find(c => c.textContent.trim() === sec.name);
        if (cell) cell.classList.add('hi');
        const info = document.getElementById('mapxInfo');
        if (info) info.innerHTML = '📍 <b style="color:' + sec.color + '">' + sec.name + '</b> tapıldı';
      }, 30);
      if (typeof JollySound !== 'undefined') JollySound.success();
    } else if (typeof Toast !== 'undefined') Toast.error('Tapılmadı');
  },
  tap(id) {
    const sec = this._sections().find(s => s.id === id);
    if (!sec) return;
    document.querySelectorAll('.mapx-cell').forEach(c => c.classList.remove('hi'));
    const cell = [...document.querySelectorAll('.mapx-cell')].find(c => c.textContent.trim() === sec.name);
    if (cell) cell.classList.add('hi');
    const info = document.getElementById('mapxInfo');
    if (info) info.innerHTML = '📍 <b style="color:' + sec.color + '">' + sec.name + '</b>';
    if (typeof JollySound !== 'undefined') JollySound.tap();
  },
};

// ---- Qeydiyyat (məcburi, ən sonda) ----
if (typeof ModuleRegistry !== 'undefined') ModuleRegistry.register(JollyMapModule);
