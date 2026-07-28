/* ============================================================
   JOLLY Qrup Sağlamlığı — hansı qrupdan başlamaq lazımdır
   İş masasındakı ümumi faiz ("33%") nə edəcəyini demir.
   Bu ekran həmin faizi qruplara bölür: hansı qrup ən pisdir,
   orada nə çatmır, və bir toxunuşla həmin qrupu açır.

   Marşrut: #/group-health  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollyGroupHealth = (() => {
  let sortBy = 'worst';   // worst | name | size

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _stats() {
    if (typeof JollyDB === 'undefined') return [];
    const map = {};
    JollyDB.Products.all().forEach(p => {
      if (JollyDB.isMarkedForDeletion && JollyDB.isMarkedForDeletion(p.id)) return;
      const g = (p.group || '').trim() || '— qrupsuz —';
      const s = map[g] || (map[g] = { name: g, total: 0, noBarcode: 0, noImage: 0, noPrice: 0, noName: 0 });
      s.total++;
      if (!p.barcodes || !p.barcodes.length) s.noBarcode++;
      if (!p.images || !p.images.length) s.noImage++;
      if (p.price == null || p.price === '') s.noPrice++;
      if (!p.name || !p.name.trim()) s.noName++;
    });

    const list = Object.values(map);
    list.forEach(s => {
      s.gaps = s.noBarcode + s.noImage + s.noPrice + s.noName;
      // hər məhsulda 4 sahə yoxlanılır
      s.pct = s.total ? Math.round(100 * (1 - s.gaps / (s.total * 4))) : 100;
    });

    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'az'));
    else if (sortBy === 'size') list.sort((a, b) => b.total - a.total);
    else list.sort((a, b) => a.pct - b.pct || b.gaps - a.gaps);
    return list;
  }

  function _bar(pct) {
    const col = pct >= 85 ? '#4ade80' : pct >= 55 ? '#ffc86b' : '#ff5c6c';
    return `
      <div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-top:7px;">
        <div style="height:100%;width:${pct}%;background:${col};"></div>
      </div>`;
  }

  function _row(s) {
    const col = s.pct >= 85 ? '#4ade80' : s.pct >= 55 ? '#ffc86b' : '#ff5c6c';
    const gapChip = (n, label, c) => n
      ? `<span class="chip" style="font-size:10.5px;border-color:${c}55;color:${c};">${label} ${n}</span>` : '';
    const isReal = s.name !== '— qrupsuz —';

    return `
      <div class="glass" style="padding:13px;margin-bottom:9px;">
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span style="flex:1;font-size:13.5px;font-weight:700;">${esc(s.name)}</span>
          <span style="font-size:16px;font-weight:800;color:${col};">${s.pct}%</span>
        </div>
        <div class="muted" style="font-size:11px;margin-top:2px;">${s.total} məhsul${s.gaps ? ` · ${s.gaps} çatışmazlıq` : ' · tam'}</div>
        ${_bar(s.pct)}
        ${s.gaps ? `
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px;">
            ${gapChip(s.noBarcode, '🏷️ barkodsuz', '#ff5c6c')}
            ${gapChip(s.noImage, '🖼️ şəkilsiz', '#ff9d5c')}
            ${gapChip(s.noPrice, '💰 qiymətsiz', '#ffc86b')}
            ${gapChip(s.noName, '📛 adsız', '#ff5c6c')}
          </div>` : ''}
        ${isReal ? `
          <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:9px;"
                  onclick="JollyRouter.go('#/products?group=${encodeURIComponent(s.name)}')">
            📦 Bu qrupu aç
          </button>` : ''}
      </div>`;
  }

  function render() {
    const list = _stats();
    const chip = (k, label) => `<span class="chip" style="cursor:pointer;${sortBy === k ? 'border-color:var(--accent-1);color:var(--accent-1);' : ''}" onclick="JollyGroupHealth.setSort('${k}')">${label}</span>`;

    if (!list.length) {
      return `
        <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
        <div class="empty-state"><div class="big-icon">📦</div><h3>Hələ məhsul yoxdur</h3></div>`;
    }

    const worst = list.filter(s => s.pct < 85).length;

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📦 Qrup Sağlamlığı</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 12px;">
        ${worst ? `${worst} qrup diqqət istəyir — ən pisindən başla.` : 'Bütün qruplar qaydasındadır ✨'}
      </p>

      <div class="row" style="gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        ${chip('worst', '⚠️ Ən pis')}
        ${chip('size', '📊 Ən böyük')}
        ${chip('name', '🔤 Ada görə')}
      </div>

      ${list.map(_row).join('')}

      <div class="glass" style="padding:12px;margin-top:6px;font-size:11.5px;line-height:1.6;">
        Faiz hər məhsulun dörd sahəsinə baxır: barkod, şəkil, qiymət, ad.
        Bir qrupu açıb düzəltmək ümumi siyahıda gəzməkdən sürətlidir —
        eyni tip mallar yan-yana olur.
      </div>
    `;
  }

  function setSort(k) {
    sortBy = k;
    const main = document.getElementById('main');
    if (main) { main.innerHTML = render(); window.scrollTo(0, 0); }
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'group-health',
      perm: 'health.view',
      name: 'Qrup Sağlamlığı',
      icon: '📦',
      route: '#/group-health',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
    });
  }

  return { render, setSort };
})();
