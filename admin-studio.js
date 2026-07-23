/* ============================================================
   JOLLY Admin Studio — Firma, Qrup, Yer, Status, Tədarükçü idarəetməsi

   YENİ (2026-07-21): Kateqoriya (Qrup) ikonu fərdiləşdirmə — hər
   qrupun yanında emoji ikon göstərilir, 🎨 düyməsi ilə dəyişdirilə
   bilər (editIcon).

   YENİ (2026-07-22): Qrup üzrə ortaq barkod + qiymət (editBarcodePrice).
   Bir qrupa (məs. "açkı 545") barkod və qiymət təyin edilir; bu qrup
   seçiləndə products.js formda həmin barkod/qiymət avtomatik dolur
   (boş sahələr üçün — mövcud dəyəri əzmir, istəsə istifadəçi özü
   dəyişə bilir).

   YENİ (2026-07-22): Qrup üçün Sürətli Çəkim (quickCapture). Qrup
   sırasındakı 📸 düyməsi ilə kamera/qalereya açıq qalır — hər şəkil
   dərhal tam məhsul kimi saxlanılır (ad/barkod/qiymət qrupdan
   avtomatik gəlir), "Bitir" basana qədər davam edir.
   ============================================================ */

const JollyAdminStudio = (() => {
  const STORE_MAP = {
    brands: { store: JollyDB.Brands, label: 'Firma', icon: '🏷️' },
    groups: { store: JollyDB.Groups, label: 'Qrup', icon: '📦' },
    locations: { store: JollyDB.Locations, label: 'Yer', icon: '📍' },
    statuses: { store: JollyDB.Statuses, label: 'Status', icon: '🔖' },
    suppliers: { store: JollyDB.Suppliers, label: 'Tədarükçü', icon: '🚚' },
  };

  function renderHome() {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      if (s && s.role !== 'admin') {
        if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
        return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
      }
    } catch (e) {}
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 16px;font-size:19px;">🛠️ Admin Studio</h2>
      <div class="studio-grid">
        ${Object.entries(STORE_MAP).map(([key, cfg]) => `
          <div class="glass studio-card" onclick="JollyRouter.go('#/studios/admin/${key}')">
            <div class="ic">${cfg.icon}</div>
            <div class="title">${cfg.label}lar</div>
            <div class="sub">${cfg.store.all().length} ədəd</div>
          </div>
        `).join('')}
      </div>
      <div class="section-title">Sistem</div>
      <div class="glass" style="padding:4px 14px;">
        <div class="list-row" onclick="JollyRouter.go('#/studios/data')">
          <span>💾 Data Studio (Backup / İdxal-İxrac)</span><span>›</span>
        </div>
        <div class="list-row" onclick="JollyRouter.go('#/studios/security')">
          <span>🔐 Security Studio</span><span>›</span>
        </div>
      </div>
    `;
  }

  function renderList(key) {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      const isAdmin = s && s.role === 'admin';
      const hasGroupsAccess = key === 'groups' && typeof POS !== 'undefined' && POS.can('groups.manage');
      if (s && !isAdmin && !hasGroupsAccess) {
        if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
        return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
      }
    } catch (e) {}
    const cfg = STORE_MAP[key];
    if (!cfg) return `<div class="empty-state"><h3>Tapılmadı</h3></div>`;
    const items = cfg.store.all();
    setTimeout(() => attachListeners(key), 0);
    return `
      <div class="row between" style="margin-bottom:14px;">
        <h2 style="font-family:var(--font-display);margin:0;font-size:19px;">${cfg.icon} ${cfg.label}lar</h2>
        <button class="btn btn-primary btn-sm" onclick="JollyAdminStudio.addItem('${key}')">+ Əlavə et</button>
      </div>
      ${key === 'groups' ? `<button class="btn btn-ghost btn-sm btn-block" style="margin-bottom:12px;" onclick="JollyAdminStudio.cleanEmptyGroups()">🧹 Boş qrupları tap və təmizlə</button>` : ''}
      <div class="glass" style="padding:4px 14px;" id="adminList">
        ${items.length ? items.map(it => renderRow(key, it)).join('') : `<div class="empty-state"><div class="big-icon">📭</div><h3>Hələ boşdur</h3></div>`}
      </div>
    `;
  }

  // ── Boş qrupları tap və təmizlə (2026-07-23) ──
  function cleanEmptyGroups() {
    const groups = JollyDB.Groups.all();
    const empty = groups.filter(g => !JollyDB.Products.filter({ group: g.name }).length);
    if (!empty.length) { Toast.success('Boş qrup yoxdur — hamısında məhsul var'); return; }
    const names = empty.map(g => g.name).join(', ');
    if (!confirm(`${empty.length} boş qrup tapıldı: ${names}\n\nHamısı silinsin?`)) return;
    empty.forEach(g => {
      JollyDB.Groups.remove(g.id);
      if (JollyDB.addTombstone) JollyDB.addTombstone(JollyDB.KEYS.groups, g.id, g);
    });
    Toast.success(`${empty.length} boş qrup silindi`);
    JollyRouter.go('#/studios/admin/groups');
  }

  function renderRow(key, it) {
    const colorDot = it.color ? `<span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${it.color};margin-right:8px;"></span>` : '';
    const codePrefix = it.code ? `<span class="mono muted" style="margin-right:6px;">${JollyProducts.escapeHtml(it.code)} ·</span>` : '';
    const groupIcon = (key === 'groups') ? `<span style="margin-right:6px;">${it.icon ? JollyProducts.escapeHtml(it.icon) : '📦'}</span>` : '';
    const minImagesBadge = (key === 'groups' && it.minImages > 0)
      ? `<span class="mono muted" style="font-size:10.5px;margin-left:6px;">🖼️ min ${it.minImages}</span>` : '';
    const barcodePriceBadge = (key === 'groups' && (it.barcode || it.price))
      ? `<span class="mono muted" style="font-size:10.5px;margin-left:6px;">${it.barcode ? '🏷️ ' + JollyProducts.escapeHtml(it.barcode) : ''}${it.barcode && it.price ? ' · ' : ''}${it.price ? '₼' + JollyProducts.escapeHtml(String(it.price)) : ''}</span>` : '';
    const groupStatsBadge = (key === 'groups') ? (() => {
      const prods = JollyDB.Products.filter({ group: it.name });
      if (!prods.length) return `<span class="mono muted" style="font-size:10.5px;margin-left:6px;color:var(--accent-warn);">boşdur</span>`;
      const priced = prods.filter(p => p.price != null && p.price !== '');
      const avg = priced.length ? (priced.reduce((s, p) => s + parseFloat(p.price), 0) / priced.length) : null;
      return `<span class="mono muted" style="font-size:10.5px;margin-left:6px;">· ${prods.length} məhsul${avg != null ? ` · ort. ${avg.toFixed(2)}₼` : ''}</span>`;
    })() : '';
    return `
      <div class="list-row" draggable="true" data-id="${it.id}">
        <span ${key === 'groups' ? `onclick="JollyRouter.go('#/products?group=${encodeURIComponent(it.name)}')" style="cursor:pointer;"` : ''}>${groupIcon}${colorDot}${codePrefix}${JollyProducts.escapeHtml(it.name)}${minImagesBadge}${barcodePriceBadge}${groupStatsBadge}</span>
        <span class="actions">
          ${key === 'groups' ? `<span onclick="JollyAdminStudio.editIcon('${it.id}')">🎨</span>` : ''}
          ${key === 'groups' ? `<span onclick="JollyAdminStudio.editMinImages('${it.id}')">🖼️</span>` : ''}
          ${key === 'groups' ? `<span onclick="JollyAdminStudio.editBarcodePrice('${it.id}')">🏷️</span>` : ''}
          ${key === 'groups' ? `<span onclick="JollyAdminStudio.quickCapture('${it.id}')">📸</span>` : ''}
          <span onclick="JollyAdminStudio.editItem('${key}','${it.id}')">✏️</span>
          <span onclick="JollyAdminStudio.deleteItem('${key}','${it.id}')">🗑️</span>
        </span>
      </div>
    `;
  }

  // ── Kateqoriya (Qrup) ikonunu fərdiləşdirmə — #35 ──
  function editIcon(id) {
    const item = JollyDB.Groups.get(id);
    if (!item) return;
    const icon = prompt(`"${item.name}" qrupu üçün emoji ikon (məs. 🧦, 🧴, 🧼):`, item.icon || '📦');
    if (icon === null) return;
    JollyDB.Groups.update(id, { icon: icon.trim() || '📦' });
    Toast.success('İkon yeniləndi');
    JollyRouter.go('#/studios/admin/groups');
  }

  // ── Kateqoriya üzrə minimum şəkil sayı qaydası — #26 ──
  // Bu qrupdan olan məhsul saxlanılanda (products.js → submitForm),
  // əgər şəkil sayı buradan az olarsa xəbərdarlıq edir (bloklamır,
  // sadəcə xəbərdar edib təsdiq istəyir).
  function editMinImages(id) {
    const item = JollyDB.Groups.get(id);
    if (!item) return;
    const val = prompt(`"${item.name}" qrupu üçün minimum şəkil sayı (0 = tələb yoxdur):`, item.minImages || 0);
    if (val === null) return;
    const n = parseInt(val, 10);
    JollyDB.Groups.update(id, { minImages: isNaN(n) || n < 0 ? 0 : n });
    Toast.success(n > 0 ? `Minimum ${n} şəkil tələbi qoyuldu` : 'Tələb ləğv edildi');
    JollyRouter.go('#/studios/admin/groups');
  }

  // ── Qrup üzrə ortaq barkod + qiymət (2026-07-22) ──
  // Bir "qovluq" kimi düşün: bütün 545 çeşidi eynəyi eyni barkod +
  // eyni qiymətə bağlamaq üçün. products.js-də bu qrup seçiləndə
  // formadakı boş barkod/qiymət sahələri avtomatik doldurulur.
  function editBarcodePrice(id) {
    const item = JollyDB.Groups.get(id);
    if (!item) return;
    const barcode = prompt(`"${item.name}" qrupu üçün ortaq barkod (boş buraxıla bilər):`, item.barcode || '');
    if (barcode === null) return;
    const price = prompt(`"${item.name}" qrupu üçün ortaq qiymət ₼ (boş buraxıla bilər):`, item.price || '');
    if (price === null) return;
    const cleanPrice = price.trim() === '' ? '' : parseFloat(price);
    JollyDB.Groups.update(id, {
      barcode: barcode.trim(),
      price: (cleanPrice === '' || isNaN(cleanPrice)) ? '' : cleanPrice,
    });
    Toast.success('Qrup üçün barkod/qiymət yeniləndi');
    JollyRouter.go('#/studios/admin/groups');
  }

  // ── Qrup üçün Sürətli Çəkim (2026-07-22) ──
  // "açkı 545" kimi bir qrupda 1000 çeşid varsa: kamera/qalereya
  // düymələri açıq qalır, hər şəkil ANINDA tam məhsul kimi saxlanılır
  // (ad = qrupun adı, barkod/qiymət = qrupun ortaq dəyəri) — istifadəçi
  // heç bir sahə doldurmadan, sadəcə şəkil-şəkil-şəkil çəkib "Bitir"
  // basana qədər davam edir.
  let _quickCapCount = 0;
  let _quickCapGroupId = null;

  function quickCapture(id) {
    const g = JollyDB.Groups.get(id);
    if (!g) return;
    _quickCapCount = 0;
    _quickCapGroupId = id;
    _showCaptureBar(g);
  }

  function _showCaptureBar(g) {
    let bar = document.getElementById('quickCapBar');
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.id = 'quickCapBar';
    bar.style.cssText = `
      position:fixed; left:12px; right:12px; bottom:18px; z-index:80;
      background:linear-gradient(160deg, var(--glass-strong), var(--glass));
      backdrop-filter:blur(20px) saturate(140%); -webkit-backdrop-filter:blur(20px) saturate(140%);
      border:1px solid var(--border-glow); border-radius:var(--radius-md);
      box-shadow:0 8px 32px rgba(0,0,0,0.5); padding:12px 14px;
    `;
    bar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-size:13px;"><b>📸 ${JollyProducts.escapeHtml(g.name)}</b> — <span id="quickCapCount">0</span> əlavə olundu</div>
        <span style="font-size:13px;color:var(--accent-danger,#ff5c6c);cursor:pointer;" onclick="JollyAdminStudio.stopQuickCapture()">Bitir ✕</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="JollyAdminStudio._captureShot('camera')">📷 Kamera</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="JollyAdminStudio._captureShot('gallery')">🖼️ Qalereya</button>
      </div>
    `;
    document.body.appendChild(bar);
  }

  // Şəklin altına, qrupun ortaq barkodunun ƏSL skaner-oxunan şəklini
  // (rəqəmlərlə birlikdə) yapışdırır — kassada telefon ekranındakı
  // şəkli birbaşa skanerlə oxumaq üçün. Barkod yoxdursa şəkli olduğu
  // kimi qaytarır.
  function _stampBarcodeOnPhoto(photoDataUrl, barcodeCode) {
    return new Promise((resolve) => {
      if (!barcodeCode || typeof JollyBarcodeGen === 'undefined') { resolve(photoDataUrl); return; }
      const bcRes = JollyBarcodeGen.generate(barcodeCode, null, { barWidth: 2, height: 70, pad: 14 });
      if (!bcRes) { resolve(photoDataUrl); return; }
      const img = new Image();
      img.onload = () => {
        try {
          const W = img.width;
          const scale = W / bcRes.canvas.width;
          const bcH = bcRes.canvas.height * scale;
          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = img.height + bcH;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, W, img.height);
          ctx.drawImage(bcRes.canvas, 0, img.height, W, bcH);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch (e) { resolve(photoDataUrl); }
      };
      img.onerror = () => resolve(photoDataUrl);
      img.src = photoDataUrl;
    });
  }

  function _captureShot(source) {
    const g = JollyDB.Groups.get(_quickCapGroupId);
    if (!g) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let img = ev.target.result;
        img = await _stampBarcodeOnPhoto(img, g.barcode);
        if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
          try { img = await JollyStorage.compressImage(img); } catch (er) {}
        }
        JollyDB.Products.add({
          name: g.name,
          mainCode: '', extraCodeType: 'No', extraCodeValue: '',
          barcodes: g.barcode ? [g.barcode] : [],
          last4: g.barcode ? g.barcode.slice(-4) : '',
          price: (g.price !== undefined && g.price !== '') ? g.price : '',
          brand: '', group: g.name, location: '', color: '', note: '',
          supplier: '', status: 'Aktiv', images: [img], filterTags: [],
        });
        _quickCapCount++;
        if (typeof JollySound !== 'undefined') JollySound.success();
        const counter = document.getElementById('quickCapCount');
        if (counter) counter.textContent = String(_quickCapCount);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function stopQuickCapture() {
    const bar = document.getElementById('quickCapBar');
    if (bar) bar.remove();
    if (_quickCapCount > 0) Toast.success(`${_quickCapCount} məhsul əlavə olundu`);
    _quickCapGroupId = null;
    _quickCapCount = 0;
    if (window.JollyRouter) JollyRouter.go('#/studios/admin/groups');
  }

  function attachListeners(key) {
    // Simple drag reorder within localStorage list order
    const container = document.getElementById('adminList');
    if (!container) return;
    let dragEl = null;
    container.querySelectorAll('.list-row').forEach(row => {
      row.addEventListener('dragstart', () => { dragEl = row; row.style.opacity = '0.4'; });
      row.addEventListener('dragend', () => { row.style.opacity = '1'; persistOrder(key); });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        const after = getDragAfter(container, e.clientY);
        if (!dragEl) return;
        if (after == null) container.appendChild(dragEl);
        else container.insertBefore(dragEl, after);
      });
    });
  }

  function getDragAfter(container, y) {
    const rows = [...container.querySelectorAll('.list-row:not([style*="opacity: 0.4"])')];
    return rows.reduce((closest, row) => {
      const box = row.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: row };
      return closest;
    }, { offset: -Infinity }).element;
  }

  function persistOrder(key) {
    const cfg = STORE_MAP[key];
    const ids = [...document.querySelectorAll('#adminList .list-row')].map(r => r.dataset.id);
    const items = cfg.store.all();
    const ordered = ids.map(id => items.find(i => i.id === id)).filter(Boolean);
    JollyDB.write(JollyDB.KEYS[key], ordered);
  }

  function addItem(key) {
    const cfg = STORE_MAP[key];
    const name = prompt(`Yeni ${cfg.label.toLowerCase()} adı:`);
    if (!name || !name.trim()) return;
    let extra = {};
    if (key === 'statuses') {
      const color = prompt('Rəng (hex, məs. #22d3ee):', '#7c8aff');
      extra.color = color || '#7c8aff';
    }
    if (key === 'suppliers') {
      const code = prompt('Tədarükçü kodu (məs. 504) — boş buraxıla bilər:');
      if (code && code.trim()) extra.code = code.trim();
    }
    if (key === 'groups') {
      const icon = prompt('Bu qrup üçün emoji ikon (könüllü, məs. 🧦):', '📦');
      extra.icon = (icon || '📦').trim() || '📦';
      if (confirm('Bu qrupdakı bütün məhsullar eyni barkod və/və ya eyni qiymətdədirmi? (məs. "açkı 545" — 1000 model, hamısı 10₼)')) {
        const barcode = prompt('Ortaq barkod (boş buraxıla bilər):', '');
        if (barcode && barcode.trim()) extra.barcode = barcode.trim();
        const price = prompt('Ortaq qiymət ₼ (boş buraxıla bilər):', '');
        const p = parseFloat(price);
        if (price && !isNaN(p)) extra.price = p;
      }
    }
    cfg.store.add({ name: name.trim(), ...extra });
    Toast.success(`"${name}" əlavə olundu`);
    JollyRouter.go(`#/studios/admin/${key}`);
  }

  function editItem(key, id) {
    const cfg = STORE_MAP[key];
    const item = cfg.store.get(id);
    if (!item) return;
    const name = prompt(`${cfg.label} adını dəyiş:`, item.name);
    if (!name || !name.trim()) return;
    const patch = { name: name.trim() };
    if (key === 'suppliers') {
      const code = prompt('Tədarükçü kodu (boş buraxıla bilər):', item.code || '');
      patch.code = (code || '').trim();
    }
    cfg.store.update(id, patch);
    Toast.success('Yeniləndi');
    JollyRouter.go(`#/studios/admin/${key}`);
  }

  function deleteItem(key, id) {
    const cfg = STORE_MAP[key];
    const item = cfg.store.get(id);
    if (!item) return;
    const usageCount = JollyDB.Products.all().filter(p => {
      const field = { brands: 'brand', groups: 'group', locations: 'location', statuses: 'status', suppliers: 'supplier' }[key];
      return p[field] === item.name;
    }).length;
    const warn = usageCount > 0 ? `\n\nDİQQƏT: bu, ${usageCount} məhsulda istifadə olunur.` : '';
    if (confirm(`"${item.name}" silinsin?${warn}`)) {
      cfg.store.remove(id);
      if (JollyDB.KEYS[key]) JollyDB.addTombstone(JollyDB.KEYS[key], id, item);
      Toast.success('Silindi');
      JollyRouter.go(`#/studios/admin/${key}`);
    }
  }

  return { renderHome, renderList, addItem, editItem, deleteItem, editIcon, editMinImages, editBarcodePrice, quickCapture, _captureShot, stopQuickCapture, cleanEmptyGroups, STORE_MAP };
})();
