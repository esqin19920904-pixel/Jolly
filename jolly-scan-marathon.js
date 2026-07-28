/* ============================================================
   JOLLY Skan Maratonu
   Rəfin qarşısında dayanıb ardıcıl skan edirsən — hər skan
   növbəti barkodsuz məhsula yapışır. Skaner arada bağlanmır,
   dərhal növbətisi üçün yenidən açılır.

   Marşrut: #/scan-marathon  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollyScanMarathon = (() => {
  let queue = [];      // barkodsuz məhsulların id-ləri
  let pos = 0;
  let done = 0;
  let running = false;
  let scope = '';      // '' = hamısı, əks halda qrup adı

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _candidates() {
    return JollyDB.Products.all()
      .filter(p => !(JollyDB.isMarkedForDeletion && JollyDB.isMarkedForDeletion(p.id)))
      .filter(p => !p.barcodes || !p.barcodes.length)
      .filter(p => !scope || p.group === scope);
  }

  function _groups() {
    const counts = {};
    JollyDB.Products.all()
      .filter(p => !p.barcodes || !p.barcodes.length)
      .forEach(p => { if (p.group) counts[p.group] = (counts[p.group] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  function buildQueue() {
    queue = _candidates().map(p => p.id);
    pos = 0; done = 0;
  }

  /* ---------- Ekran ---------- */
  function render() {
    buildQueue();
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🎯 Skan Maratonu</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Rəfin qarşısında dayan və ardıcıl skan et. Hər skan növbəti barkodsuz mala yapışır.</p>
      <div id="marathonBody"></div>
    `;
  }

  function afterRender() { paint(); }

  function paint() {
    const el = document.getElementById('marathonBody');
    if (!el) return;

    if (!queue.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="big-icon">✅</div>
          <h3>Barkodsuz mal yoxdur</h3>
          <p class="muted" style="font-size:12px;">${scope ? `"${esc(scope)}" qrupunda hamısının barkodu var.` : 'Bütün kataloqda hamısının barkodu var.'}</p>
          ${scope ? `<button class="btn btn-ghost" style="margin-top:12px;" onclick="JollyScanMarathon.setScope('')">Bütün kataloqa bax</button>` : ''}
        </div>`;
      return;
    }

    if (pos >= queue.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="big-icon">🎉</div>
          <h3>Maraton bitdi</h3>
          <p class="muted" style="font-size:12.5px;">${done} mala barkod yapışdırıldı.</p>
          <button class="btn btn-primary" style="margin-top:12px;" onclick="JollyScanMarathon.restart()">Yenidən yoxla</button>
        </div>`;
      return;
    }

    const p = JollyDB.Products.get(queue[pos]);
    if (!p) { pos++; paint(); return; }
    const progress = Math.round((pos / queue.length) * 100);
    const groups = _groups();

    el.innerHTML = `
      ${!running ? `
        <div class="section-title">Hansı rəfdən başlayaq?</div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:14px;">
          <span class="chip" style="${!scope ? 'border-color:var(--accent-1);color:var(--accent-1);' : ''}"
                onclick="JollyScanMarathon.setScope('')">Hamısı (${_candidates().length + (scope ? 0 : 0)})</span>
          ${groups.map(([g, n]) => `<span class="chip" style="${scope === g ? 'border-color:var(--accent-1);color:var(--accent-1);' : ''}"
                onclick="JollyScanMarathon.setScope('${esc(g)}')">${esc(g)} (${n})</span>`).join('')}
        </div>` : ''}

      <div class="muted" style="font-size:11.5px;margin-bottom:6px;">${pos + 1} / ${queue.length}${done ? ` · ${done} bağlandı` : ''}</div>
      <div style="height:4px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:14px;overflow:hidden;">
        <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#5b7cfa,#4f9fff);transition:width .3s;"></div>
      </div>

      <div class="glass" style="padding:16px;text-align:center;">
        <div style="width:88px;height:88px;margin:0 auto 12px;border-radius:14px;overflow:hidden;background:#1a1d2e;display:flex;align-items:center;justify-content:center;font-size:34px;">
          ${(p.images && p.images[0] && typeof JollyStorage !== 'undefined')
            ? `<img ${JollyStorage.imgAttr(p.images[0], true)} style="width:100%;height:100%;object-fit:cover;">`
            : '🧴'}
        </div>
        <div style="font-weight:700;font-size:15px;">${esc(p.name || 'Adsız məhsul')}</div>
        <div class="muted" style="font-size:12px;margin-top:3px;">${esc(p.group || 'Qrupsuz')}${p.location ? ' · 📍 ' + esc(p.location) : ''}</div>
        <p class="muted" style="font-size:11.5px;margin:12px 0 0;">Bu malın barkodunu skan et</p>
      </div>

      <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="JollyScanMarathon.scanNext()">📷 ${running ? 'Davam et' : 'Skan et'}</button>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="JollyScanMarathon.manual()">⌨️ Əl ilə yaz</button>
        <button class="btn btn-ghost" style="flex:1;" onclick="JollyScanMarathon.skip()">Keç →</button>
      </div>
    `;
    if (typeof JollyStorage !== 'undefined' && JollyStorage.hydrate) JollyStorage.hydrate();
  }

  /* ---------- Əməliyyatlar ---------- */
  function setScope(g) { scope = g || ''; buildQueue(); paint(); }

  function _assign(code) {
    const p = JollyDB.Products.get(queue[pos]);
    if (!p) { pos++; paint(); return false; }
    const clean = String(code).replace(/\D/g, '');
    if (!clean) { Toast.error('Kod oxunmadı'); return false; }
    const clash = JollyDB.Products.checkBarcodeConflict
      ? JollyDB.Products.checkBarcodeConflict(clean, p.id) : null;
    if (clash) {
      if (typeof JollySound !== 'undefined') JollySound.error && JollySound.error();
      Toast.error('Bu barkod artıq "' + (clash.name || 'başqa məhsul') + '"-dədir — keçilmədi');
      return false;
    }
    JollyDB.Products.update(p.id, { barcodes: [clean] });
    done++;
    pos++;
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (navigator.vibrate) navigator.vibrate(40);
    Toast.success('✅ ' + (p.name || 'Mal') + ' — ' + clean);
    return true;
  }

  /* Skaner ardıcıl açılır: bir kod → yaz → dərhal növbətisi üçün yenidən aç */
  function scanNext() {
    if (typeof JollyBarcode === 'undefined') { Toast.error('Skan modulu yoxdur'); return; }
    running = true;
    JollyBarcode.open((code) => {
      _assign(code);
      paint();
      // Növbədə mal qalıbsa, skaneri yenidən aç
      if (pos < queue.length) {
        setTimeout(() => {
          if (running && (window.location.hash || '').indexOf('scan-marathon') !== -1) scanNext();
        }, 450);
      } else {
        running = false;
        paint();
      }
    });
  }

  function manual() {
    const p = JollyDB.Products.get(queue[pos]);
    if (!p) return;
    const v = prompt(`"${p.name || 'Adsız'}" üçün barkod:`);
    if (v === null) return;
    _assign(v);
    paint();
  }

  function skip() { running = false; pos++; paint(); }

  function restart() { buildQueue(); running = false; paint(); }

  /* ---------- Qeydiyyat ---------- */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'scan-marathon',
      perm: 'scanmarathon.use',
      name: 'Skan Maratonu',
      icon: '🎯',
      route: '#/scan-marathon',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
      afterRender() { afterRender(); },
    });
  }

  return { render, afterRender, setScope, scanNext, manual, skip, restart };
})();
