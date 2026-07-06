/* ============================================================
   JOLLY Workflow Studio — "şərt olsa, bunu et" avtomatik qaydalar
   Qaydalar hər tətbiq açılışında və məhsul dəyişikliyində yoxlanılır
   ============================================================ */

const JollyWorkflow = (() => {
  const KEY = 'jolly_workflows';
  const NOTIF_KEY = 'jolly_notifications';

  const CONDITIONS = {
    no_barcode: { label: 'Barkodu yoxdursa', test: (p) => !p.barcodes || p.barcodes.length === 0 },
    no_image: { label: 'Şəkli yoxdursa', test: (p) => !p.images || p.images.length === 0 },
    is_problem: { label: 'Statusu "Problemli"dirsə', test: (p) => (p.status || '').toLowerCase().includes('problem') },
    no_price: { label: 'Qiyməti yoxdursa', test: (p) => p.price == null || p.price === '' },
    old_30d: { label: '30 gündən köhnədirsə', test: (p) => (Date.now() - (p.createdAt || Date.now())) > 30 * 864e5 },
    incomplete: { label: 'Yarımçıqdırsa (şəkil/barkod/qiymət)', test: (p) => (!p.images || !p.images.length) || (!p.barcodes || !p.barcodes.length) || (p.price == null || p.price === '') },
  };

  function read() { return JollyDB.read(KEY, defaultRules()); }
  function write(rules) { JollyDB.write(KEY, rules); }

  function defaultRules() {
    return [
      { id: 'wf1', name: 'Barkodsuz məhsulları izlə', condition: 'no_barcode', enabled: true },
      { id: 'wf2', name: 'Problemli məhsulları izlə', condition: 'is_problem', enabled: true },
      { id: 'wf3', name: 'Qiymətsiz məhsulları izlə', condition: 'no_price', enabled: true },
      { id: 'wf4', name: 'Yarımçıq məhsulları izlə', condition: 'incomplete', enabled: true },
    ];
  }

  function readNotifications() { return JollyDB.read(NOTIF_KEY, []); }
  function writeNotifications(n) { JollyDB.write(NOTIF_KEY, n); }

  function pushNotification(text, route) {
    const list = readNotifications();
    // eyni mətnli təzə bildiriş varsa təkrarlama
    if (list.some(n => n.text === text && !n.read)) return;
    list.unshift({ id: JollyDB.uid('ntf'), text, route, ts: Date.now(), read: false });
    if (list.length > 100) list.length = 100;
    writeNotifications(list);
  }

  /* Bütün qaydaları bütün məhsullara qarşı yoxla, xəbərdarlıq yığ */
  function evaluateAll() {
    const rules = read().filter(r => r.enabled);
    const products = JollyDB.Products.all();
    const summary = [];
    rules.forEach(rule => {
      const cond = CONDITIONS[rule.condition];
      if (!cond) return;
      const matched = products.filter(cond.test);
      if (matched.length > 0) {
        summary.push({ rule, count: matched.length });
      }
    });
    return summary;
  }

  /* Tətbiq açılanda çağırılır — xəbərdarlıqları bildirişlərə çevirir */
  function runOnStartup() {
    const summary = evaluateAll();
    summary.forEach(s => {
      let route = '#/home';
      if (s.rule.condition === 'no_barcode') route = '#/products?filter=barkodsuz';
      else if (s.rule.condition === 'is_problem') route = '#/products?filter=problemli';
      else if (s.rule.condition === 'no_image') route = '#/products?filter=sekilsiz';
      else if (s.rule.condition === 'no_price' || s.rule.condition === 'incomplete') route = '#/data-doctor';
      pushNotification(`${s.rule.name}: ${s.count} məhsul`, route);
    });

    // Dublikat riski
    try {
      if (typeof JollyBrain !== 'undefined' && JollyBrain.findDuplicates) {
        const dups = JollyBrain.findDuplicates();
        if (dups && dups.length) pushNotification(`👯 ${dups.length} dublikat qrupu tapıldı`, '#/brain/duplicates');
      }
    } catch (e) {}

    // Backup edilməyib
    try {
      const s0 = JollyDB.getSettings();
      const last = s0.lastBackup || 0;
      if (JollyDB.Products.all().length > 0 && (Date.now() - last) > 7 * 864e5) {
        pushNotification('💾 Backup vaxtıdır — məlumatlarını qoru', '#/studios/integration');
      }
    } catch (e) {}
  }

  function unreadCount() { return readNotifications().filter(n => !n.read).length; }

  function markAllRead() {
    const list = readNotifications().map(n => ({ ...n, read: true }));
    writeNotifications(list);
  }

  /* ---------- UI ---------- */
  function renderStudio() {
    const rules = read();
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 16px;font-size:19px;">⚡ Workflow Studio</h2>
      <p class="muted" style="font-size:13px;margin:0 0 14px;">Avtomatik qaydalar — şərt ödənəndə JOLLY səni xəbərdar edir.</p>

      <div class="row between" style="margin-bottom:10px;">
        <span class="section-title" style="margin:0;">Qaydalar</span>
        <button class="btn btn-primary btn-sm" onclick="JollyWorkflow.addRule()">+ Qayda</button>
      </div>
      <div class="glass" style="padding:4px 14px;">
        ${rules.length ? rules.map(renderRuleRow).join('') : '<div class="muted" style="padding:14px;">Qayda yoxdur</div>'}
      </div>

      <div class="section-title">Hazırkı vəziyyət</div>
      <div class="glass" style="padding:4px 14px;">
        ${renderLiveSummary()}
      </div>
    `;
  }

  function renderRuleRow(r) {
    const cond = CONDITIONS[r.condition];
    return `
      <div class="list-row">
        <span>${JollyProducts.escapeHtml(r.name)}<br><span class="muted" style="font-size:11px;">${cond ? cond.label : r.condition}</span></span>
        <span class="actions">
          <label style="display:flex;align-items:center;"><input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="JollyWorkflow.toggleRule('${r.id}',this.checked)"></label>
          <span onclick="JollyWorkflow.deleteRule('${r.id}')">🗑️</span>
        </span>
      </div>
    `;
  }

  function renderLiveSummary() {
    const summary = evaluateAll();
    if (!summary.length) return '<div class="muted" style="padding:14px;">Hər şey qaydasındadır 👍</div>';
    return summary.map(s => `
      <div class="list-row"><span>${JollyProducts.escapeHtml(s.rule.name)}</span><span class="status-pill"><span class="dot" style="background:var(--accent-warn)"></span>${s.count}</span></div>
    `).join('');
  }

  function addRule() {
    const name = prompt('Qayda adı:');
    if (!name || !name.trim()) return;
    const condKeys = Object.keys(CONDITIONS);
    const condList = condKeys.map((k, i) => `${i + 1}. ${CONDITIONS[k].label}`).join('\n');
    const choice = prompt(`Şərti seç (nömrə yaz):\n\n${condList}`);
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= condKeys.length) { Toast.error('Yanlış seçim'); return; }
    const rules = read();
    rules.push({ id: JollyDB.uid('wf'), name: name.trim(), condition: condKeys[idx], enabled: true });
    write(rules);
    Toast.success('Qayda əlavə olundu');
    JollyRouter.go('#/studios/workflow');
  }

  function toggleRule(id, enabled) {
    const rules = read().map(r => r.id === id ? { ...r, enabled } : r);
    write(rules);
  }

  function deleteRule(id) {
    if (!confirm('Qayda silinsin?')) return;
    write(read().filter(r => r.id !== id));
    Toast.success('Silindi');
    JollyRouter.go('#/studios/workflow');
  }

  /* ---------- Notifications page ---------- */
  function renderNotifications() {
    const list = readNotifications();
    setTimeout(() => markAllRead(), 400);
    return `
      <div class="row between" style="margin-bottom:14px;">
        <h2 style="font-family:var(--font-display);margin:0;font-size:19px;">🔔 Bildirişlər</h2>
        ${list.length ? `<button class="btn btn-ghost btn-sm" onclick="JollyWorkflow.clearNotifications()">Təmizlə</button>` : ''}
      </div>
      <div class="glass" style="padding:4px 14px;">
        ${list.length ? list.map(n => `
          <div class="list-row" onclick="JollyRouter.go('${n.route || '#/home'}')">
            <span>${n.read ? '' : '🔵 '}${JollyProducts.escapeHtml(n.text)}</span>
            <span class="muted" style="font-size:11px;">${timeAgo(n.ts)}</span>
          </div>
        `).join('') : '<div class="empty-state"><div class="big-icon">🔔</div><h3>Bildiriş yoxdur</h3></div>'}
      </div>
    `;
  }

  function clearNotifications() {
    writeNotifications([]);
    JollyRouter.go('#/notifications');
  }

  function timeAgo(ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return 'indi';
    if (d < 3600) return Math.floor(d / 60) + ' dəq';
    if (d < 86400) return Math.floor(d / 3600) + ' saat';
    return Math.floor(d / 86400) + ' gün';
  }

  return {
    runOnStartup, unreadCount, markAllRead, evaluateAll,
    renderStudio, addRule, toggleRule, deleteRule,
    renderNotifications, clearNotifications, CONDITIONS,
  };
})();
