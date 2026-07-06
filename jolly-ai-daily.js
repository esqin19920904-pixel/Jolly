/* ============================================================
   JOLLY AI Daily — Gündəlik Köməkçi
   Hər gün: bugünkü fəaliyyət + görüləsi işlər + fokus tövsiyəsi.
   İş masasında kart kimi göstərilir (ilk açılışda).
   ============================================================ */
const JollyAIDaily = (() => {
  const SEEN_KEY = 'jolly_daily_seen';

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function seenToday() {
    try { return localStorage.getItem(SEEN_KEY) === todayStr(); } catch (e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, todayStr()); } catch (e) {}
  }

  function collectData() {
    const all = JollyDB.Products.all();
    const day = 864e5, now = Date.now();
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const addedToday = all.filter(p => (p.createdAt || 0) >= t0.getTime()).length;
    const drafts = (typeof JollyDB.Drafts !== 'undefined') ? JollyDB.Drafts.all().length : 0;
    const inc = (typeof JollyAIHealth !== 'undefined') ? JollyAIHealth.getNotCashierReady().length : all.filter(p => !p.barcodes || !p.barcodes.length).length;
    const noImg = all.filter(p => !p.images || !p.images.length).length;
    const noBc = all.filter(p => !p.barcodes || !p.barcodes.length).length;
    const dupCount = (typeof JollyAIHealth !== 'undefined') ? JollyAIHealth.getDuplicateBarcodes().length : 0;
    const health = (typeof JollyAIHealth !== 'undefined') ? JollyAIHealth.getCatalogScore() : 0;
    return { total: all.length, addedToday, drafts, inc, noImg, noBc, dupCount, health };
  }

  // Görüləsi işlər (prioritetlə)
  function tasks(d) {
    const list = [];
    if (d.drafts > 0) list.push({ icon: '📥', text: `${d.drafts} gələn malı tamamla`, route: '#/drafts', color: '#f5c563' });
    if (d.noBc > 0) list.push({ icon: '🧾', text: `${d.noBc} barkodsuz məhsulu düzəlt`, route: '#/data-doctor', color: '#ff9d5c' });
    if (d.noImg > 0) list.push({ icon: '🖼️', text: `${d.noImg} şəkilsiz məhsula şəkil əlavə et`, route: '#/data-doctor', color: '#ff5c6c' });
    if (d.dupCount > 0) list.push({ icon: '👯', text: `${d.dupCount} dublikat barkodu birləşdir`, route: '#/brain/duplicates', color: '#c86bff' });
    return list.slice(0, 4);
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return 'Gecən xeyrə';
    if (h < 12) return 'Sabahın xeyir';
    if (h < 18) return 'Günortan xeyir';
    return 'Axşamın xeyir';
  }

  function render() {
    const d = collectData();
    const tk = tasks(d);
    const focus = tk.length ? tk[0].text : 'Hər şey qaydasındadır — kataloq təmizdir! ✨';
    return `
      <div class="daily-card">
        <div class="daily-head">
          <div>
            <div class="daily-greet">${greeting()}! 👋</div>
            <div class="daily-sub">Bugünkü mağaza planın</div>
          </div>
          <button class="daily-close" onclick="JollyAIDaily.dismiss()">✕</button>
        </div>
        <div class="daily-stats">
          <div class="daily-stat"><div class="ds-num">${d.addedToday}</div><div class="ds-lbl">bu gün əlavə</div></div>
          <div class="daily-stat"><div class="ds-num">${d.total}</div><div class="ds-lbl">ümumi məhsul</div></div>
          <div class="daily-stat"><div class="ds-num" style="color:${d.health >= 80 ? '#4ade80' : d.health >= 50 ? '#f5c563' : '#ff6b7d'};">${d.health}%</div><div class="ds-lbl">sağlamlıq</div></div>
        </div>
        ${tk.length ? `
          <div class="daily-tasks-title">📋 Bugün görüləsi:</div>
          <div class="daily-tasks">
            ${tk.map(t => `<div class="daily-task" onclick="JollyAIDaily.go('${t.route}')"><span class="dt-icon" style="background:${t.color}22;color:${t.color};">${t.icon}</span><span class="dt-text">${t.text}</span><span class="dt-arrow">›</span></div>`).join('')}
          </div>
        ` : `<div class="daily-clean">✨ Bütün işlər tamamdır! Kataloq təmiz və hazırdır.</div>`}
        <div class="daily-focus"><span style="color:#f5c563;">🎯 Fokus:</span> ${focus}</div>
      </div>
    `;
  }

  function dismiss() {
    markSeen();
    const el = document.querySelector('.daily-card');
    if (el) { el.style.opacity = '0'; el.style.maxHeight = '0'; setTimeout(() => el.remove(), 300); }
  }
  function go(route) { markSeen(); JollyRouter.go(route); }

  // İş masasında göstərmək üçün (yalnız gündə bir dəfə, açılışda)
  function shouldShow() { return !seenToday(); }

  return { render, dismiss, go, shouldShow, collectData, markSeen };
})();
