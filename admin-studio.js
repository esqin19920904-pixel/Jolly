/* ============================================================
   JOLLY Admin Studio — Firma, Qrup, Yer, Status, Tədarükçü idarəetməsi

   YENİ (2026-07-21): Kateqoriya (Qrup) ikonu fərdiləşdirmə — hər
   qrupun yanında emoji ikon göstərilir, 🎨 düyməsi ilə dəyişdirilə
   bilər (editIcon).
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
      if (s && s.role !== 'admin') {
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
      <div class="glass" style="padding:4px 14px;" id="adminList">
        ${items.length ? items.map(it => renderRow(key, it)).join('') : `<div class="empty-state"><div class="big-icon">📭</div><h3>Hələ boşdur</h3></div>`}
      </div>
    `;
  }

  function renderRow(key, it) {
    const colorDot = it.color ? `<span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${it.color};margin-right:8px;"></span>` : '';
    const codePrefix = it.code ? `<span class="mono muted" style="margin-right:6px;">${JollyProducts.escapeHtml(it.code)} ·</span>` : '';
    const groupIcon = (key === 'groups') ? `<span style="margin-right:6px;">${it.icon ? JollyProducts.escapeHtml(it.icon) : '📦'}</span>` : '';
    const minImagesBadge = (key === 'groups' && it.minImages > 0)
      ? `<span class="mono muted" style="font-size:10.5px;margin-left:6px;">🖼️ min ${it.minImages}</span>` : '';
    return `
      <div class="list-row" draggable="true" data-id="${it.id}">
        <span>${groupIcon}${colorDot}${codePrefix}${JollyProducts.escapeHtml(it.name)}${minImagesBadge}</span>
        <span class="actions">
          ${key === 'groups' ? `<span onclick="JollyAdminStudio.editIcon('${it.id}')">🎨</span>` : ''}
          ${key === 'groups' ? `<span onclick="JollyAdminStudio.editMinImages('${it.id}')">🖼️</span>` : ''}
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
      Toast.success('Silindi');
      JollyRouter.go(`#/studios/admin/${key}`);
    }
  }

  return { renderHome, renderList, addItem, editItem, deleteItem, editIcon, editMinImages, STORE_MAP };
})();
