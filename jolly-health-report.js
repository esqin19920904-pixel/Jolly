/* ============================================================
   JOLLY Sağlamlıq Hesabatı — "Bu həftə nə düzəldin?"
   İş masasındakı 33% rəqəmi tək başına heç nə demir. Bu modul
   hər gün kataloqun vəziyyətindən bir şəkil çəkir və həftəlik
   fərqi göstərir: neçə problem bağlandı, neçəsi qaldı.

   Marşrut: #/health-report  (ModuleRegistry vasitəsilə)
   Saxlama: jolly_health_history — gündə bir qeyd, 60 gün saxlanılır
   ============================================================ */
const JollyHealthReport = (() => {
  const KEY = 'jolly_health_history';
  const KEEP_DAYS = 60;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _dayKey(d) { return (d || new Date()).toISOString().slice(0, 10); }

  function _history() {
    const h = JollyDB.read(KEY, []);
    return Array.isArray(h) ? h : [];
  }

  /* ---------- Ölçmə ---------- */
  function measure() {
    const all = JollyDB.Products.all().filter(p =>
      !(JollyDB.isMarkedForDeletion && JollyDB.isMarkedForDeletion(p.id))
    );
    const m = {
      date: _dayKey(),
      total: all.length,
      noName: 0, noBarcode: 0, noImage: 0, noPrice: 0,
    };
    all.forEach(p => {
      if (!p.name || !p.name.trim()) m.noName++;
      if (!p.barcodes || !p.barcodes.length) m.noBarcode++;
      if (!p.images || !p.images.length) m.noImage++;
      if (p.price == null || p.price === '') m.noPrice++;
    });
    m.issues = m.noName + m.noBarcode + m.noImage + m.noPrice;
    return m;
  }

  /* Gündə bir dəfə qeyd — proqram açılanda çağırılır */
  function snapshot() {
    try {
      const hist = _history();
      const today = _dayKey();
      const m = measure();
      const idx = hist.findIndex(h => h.date === today);
      if (idx >= 0) hist[idx] = m; else hist.push(m);
      // köhnələri at
      const cut = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
      const trimmed = hist.filter(h => h.date >= cut).sort((a, b) => a.date < b.date ? -1 : 1);
      JollyDB.write(KEY, trimmed);
      return m;
    } catch (e) {
      console.warn('[HealthReport] snapshot:', e);
      return null;
    }
  }

  /* ---------- Hesablama ---------- */
  function weekSummary() {
    snapshot();
    const hist = _history();
    const now = measure();
    const weekAgoKey = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    // 7 gün əvvələ ən yaxın qeyd
    const past = hist.filter(h => h.date <= weekAgoKey).pop() || hist[0] || null;

    const fixed = past ? Math.max(0, past.issues - now.issues) : 0;
    const added = past ? Math.max(0, now.total - past.total) : 0;
    const health = now.total ? Math.round(100 * (1 - now.issues / (now.total * 4))) : 100;

    return { now, past, fixed, added, health, days: hist.length };
  }

  /* Son 7 günün problem sayı — sadə sütun qrafiki */
  function _chart(hist) {
    const last = hist.slice(-7);
    if (last.length < 2) {
      return `<p class="muted" style="font-size:11.5px;">Qrafik üçün ən azı 2 günlük məlumat lazımdır — sabah yenidən bax.</p>`;
    }
    const max = Math.max(...last.map(h => h.issues), 1);
    const W = 280, H = 90, gap = 6;
    const bw = (W - gap * (last.length - 1)) / last.length;
    let bars = '';
    last.forEach((h, i) => {
      const bh = Math.max(2, Math.round((h.issues / max) * (H - 20)));
      const x = i * (bw + gap);
      const y = H - bh - 14;
      const isLast = i === last.length - 1;
      bars += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3"
                 fill="${isLast ? '#4f9fff' : 'rgba(79,159,255,.35)'}"/>
               <text x="${x + bw / 2}" y="${H - 3}" font-size="8" text-anchor="middle"
                 fill="#6c7192">${esc(h.date.slice(8))}</text>
               <text x="${x + bw / 2}" y="${y - 3}" font-size="9" text-anchor="middle"
                 fill="${isLast ? '#4f9fff' : '#6c7192'}" font-weight="700">${h.issues}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow:visible;">${bars}</svg>`;
  }

  function _statRow(label, value, color) {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <span style="font-size:13px;">${label}</span>
        <span style="font-size:15px;font-weight:800;color:${color};">${value}</span>
      </div>`;
  }

  /* ---------- Ekran ---------- */
  function render() {
    const s = weekSummary();
    const hist = _history();
    const n = s.now;

    const trendText = !s.past
      ? 'Bu ilk ölçmədir — müqayisə üçün bir neçə gün lazımdır.'
      : (s.fixed > 0
          ? `Bu həftə <b style="color:#4ade80;">${s.fixed} problem</b> bağlandı.`
          : (n.issues > s.past.issues
              ? `Bu həftə <b style="color:#ff9d5c;">${n.issues - s.past.issues} yeni problem</b> əlavə olundu.`
              : 'Bu həftə dəyişiklik olmayıb.'));

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📈 Sağlamlıq Hesabatı</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">${trendText}</p>

      <div class="glass" style="padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:flex-end;gap:14px;margin-bottom:12px;">
          <div>
            <div style="font-size:34px;font-weight:800;line-height:1;color:${s.health >= 80 ? '#4ade80' : s.health >= 50 ? '#ffc86b' : '#ff5c6c'};">${s.health}%</div>
            <div class="muted" style="font-size:11px;margin-top:3px;">kataloq sağlamlığı</div>
          </div>
          <div style="flex:1;text-align:right;">
            <div style="font-size:20px;font-weight:700;">${n.issues}</div>
            <div class="muted" style="font-size:11px;">açıq problem · ${n.total} mal</div>
          </div>
        </div>
        ${_chart(hist)}
        <div class="muted" style="font-size:10.5px;text-align:center;margin-top:4px;">son ${Math.min(7, hist.length)} gün — açıq problem sayı</div>
      </div>

      <div class="section-title">Nə çatmır</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:12px;">
        ${_statRow('🏷️ Barkodsuz', n.noBarcode, n.noBarcode ? '#ff5c6c' : '#4ade80')}
        ${_statRow('🖼️ Şəkilsiz', n.noImage, n.noImage ? '#ff9d5c' : '#4ade80')}
        ${_statRow('💰 Qiymətsiz', n.noPrice, n.noPrice ? '#ffc86b' : '#4ade80')}
        ${_statRow('📛 Adsız', n.noName, n.noName ? '#ff5c6c' : '#4ade80')}
      </div>

      ${n.issues ? `
        <button class="btn btn-primary btn-block" onclick="JollyRouter.go('#/fixmode')">⚡ İndi düzəltməyə başla</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="JollyRouter.go('#/data-doctor')">🩺 Data Doctor ilə yoxla</button>
      ` : `<div class="empty-state"><div class="big-icon">🎉</div><h3>Açıq problem yoxdur</h3></div>`}
    `;
  }

  /* ---------- Qeydiyyat ---------- */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'health-report',
      perm: 'health.view',
      name: 'Sağlamlıq Hesabatı',
      icon: '📈',
      route: '#/health-report',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
      init() {
        // Proqram açılanda günün ölçməsini götür (bir dəfə)
        setTimeout(() => { try { snapshot(); } catch (e) {} }, 2500);
      },
    });
  }

  return { render, snapshot, measure, weekSummary };
})();
