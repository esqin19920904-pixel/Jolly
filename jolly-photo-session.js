/* ============================================================
   JOLLY Foto Seansı — şəkilsiz malları ardıcıl çək
   Skan Maratonunun şəkil variantı: bir qrup seçirsən, kamera
   dövrədə açılır, hər şəkil dərhal növbəti şəkilsiz mala yapışır.

   Admin Studio-dakı "Sürətli Çəkim"dən fərqi: o YENİ məhsul yaradır,
   bu isə ARTIQ MÖVCUD, amma şəkli olmayan malları tamamlayır.

   Marşrut: #/photo-session
   İcazə: photo.session
   ============================================================ */
const JollyPhotoSession = (() => {
  let scope = null;      // qrup adı, '' = bütün kataloq, null = hələ seçilməyib
  let queue = [];        // məhsul id-ləri
  let pos = 0;
  let doneCount = 0;
  let busy = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _noImage(scopeName) {
    return JollyDB.Products.all()
      .filter(p => !(JollyDB.isMarkedForDeletion && JollyDB.isMarkedForDeletion(p.id)))
      .filter(p => !p.images || !p.images.length)
      .filter(p => !scopeName || (p.group || '') === scopeName);
  }

  function _groups() {
    const map = {};
    _noImage(null).forEach(p => {
      const g = (p.group || '').trim() || '— qrupsuz —';
      map[g] = (map[g] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  /* ---------- Ekran ---------- */
  function render() {
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📸 Foto Seansı</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Şəkilsiz malları ardıcıl çək — kamera hər dəfə özü açılır.</p>
      <div id="psBody"></div>
      <input type="file" id="psPhoto" accept="image/*" capture="environment" style="display:none" onchange="JollyPhotoSession.onPhoto(event)">
    `;
  }

  function afterRender() { paint(); }

  function paint() {
    const body = document.getElementById('psBody');
    if (!body) return;

    /* 1) Qrup seçimi */
    if (scope === null) {
      const gs = _groups();
      const total = _noImage(null).length;
      if (!total) {
        body.innerHTML = `<div class="empty-state"><div class="big-icon">✨</div><h3>Şəkilsiz mal yoxdur</h3><p class="muted" style="font-size:12px;">Kataloqun bütün şəkilləri yerindədir.</p></div>`;
        return;
      }
      body.innerHTML = `
        <div class="glass" style="padding:13px;margin-bottom:12px;">
          <div style="font-size:13.5px;font-weight:700;">Ümumi ${total} mal şəkilsizdir</div>
          <div class="muted" style="font-size:11.5px;margin-top:3px;">Bir qrup seç — eyni tip mallar yan-yana olanda daha tez gedir.</div>
          <button class="btn btn-primary btn-block" style="margin-top:11px;" onclick="JollyPhotoSession.pick('')">📸 Hamısını çək (${total})</button>
        </div>
        <div class="section-title">Qrup üzrə</div>
        <div class="glass" style="padding:4px 14px;">
          ${gs.map(([name, n]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer;"
                 onclick="JollyPhotoSession.pick('${esc(name === '— qrupsuz —' ? '' : name).replace(/'/g, "\\\\'")}')">
              <span style="flex:1;font-size:13px;">${esc(name)}</span>
              <span style="font-size:14px;font-weight:800;color:var(--accent-1);">${n}</span>
              <span style="color:var(--accent-1);">›</span>
            </div>`).join('')}
        </div>`;
      return;
    }

    /* 2) Seans bitdi */
    if (pos >= queue.length) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="big-icon">🎉</div>
          <h3>Seans bitdi</h3>
          <p class="muted" style="font-size:12.5px;">${doneCount} şəkil əlavə olundu.</p>
          <button class="btn btn-primary" style="margin-top:12px;" onclick="JollyPhotoSession.restart()">Yenidən başla</button>
        </div>`;
      return;
    }

    /* 3) Cari mal */
    const p = JollyDB.Products.get(queue[pos]);
    if (!p) { next(); return; }
    const pct = Math.round(pos / queue.length * 100);

    body.innerHTML = `
      <div class="muted" style="font-size:11.5px;margin-bottom:6px;">${pos + 1} / ${queue.length}${doneCount ? ` · ${doneCount} çəkildi` : ''}</div>
      <div style="height:4px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:14px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#5b7cfa,#4f9fff);transition:width .3s;"></div>
      </div>

      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">📷</div>
        <div style="font-size:16px;font-weight:700;">${esc(p.name || 'Adsız məhsul')}</div>
        <div class="muted mono" style="font-size:12px;margin-top:4px;">${esc((p.barcodes && p.barcodes[0]) || p.mainCode || '—')}</div>
        ${p.group ? `<div class="muted" style="font-size:11.5px;margin-top:3px;">📦 ${esc(p.group)}</div>` : ''}
        ${p.location ? `<div class="muted" style="font-size:11.5px;margin-top:2px;">📍 ${esc(p.location)}</div>` : ''}
        <button class="btn btn-primary btn-block" style="margin-top:14px;" ${busy ? 'disabled' : ''}
                onclick="document.getElementById('psPhoto').click()">
          ${busy ? '⏳ Saxlanılır...' : '📷 Şəkil çək'}
        </button>
      </div>

      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="JollyPhotoSession.skip()">Keç →</button>
        <button class="btn btn-ghost" style="flex:1;" onclick="JollyPhotoSession.stop()">Dayan</button>
      </div>
    `;
  }

  /* ---------- Əməliyyatlar ---------- */
  function pick(group) {
    scope = group;
    queue = _noImage(group).map(p => p.id);
    pos = 0; doneCount = 0;
    paint();
  }

  function restart() { pick(scope); }
  function stop() { scope = null; queue = []; pos = 0; paint(); }
  function skip() { next(); }
  function next() { pos++; paint(); }

  async function onPhoto(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const p = JollyDB.Products.get(queue[pos]);
    if (!p) { next(); return; }

    busy = true; paint();
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const ref = (typeof JollyStorage !== 'undefined')
        ? await JollyStorage.saveImage(dataUrl) : dataUrl;
      JollyDB.Products.update(p.id, { images: (p.images || []).concat([ref]) });
      doneCount++;
      if (typeof JollySound !== 'undefined') JollySound.success();
      if (navigator.vibrate) navigator.vibrate(12);
      if (typeof Toast !== 'undefined') Toast.success('✓ ' + (p.name || 'Şəkil') + ' — hazır');
      busy = false;
      pos++;
      paint();
      // Kamera dərhal növbəti mal üçün açılsın — dayanmadan işləyəsən
      if (pos < queue.length) {
        setTimeout(() => {
          const inp = document.getElementById('psPhoto');
          if (inp) inp.click();
        }, 400);
      }
    } catch (e) {
      console.error('[PhotoSession]', e);
      busy = false;
      paint();
      if (typeof Toast !== 'undefined') Toast.error('Şəkil saxlanmadı');
    }
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'photo-session',
      perm: 'photo.session',
      name: 'Foto Seansı',
      icon: '📸',
      route: '#/photo-session',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
      afterRender() { afterRender(); },
    });
  }

  return { render, afterRender, pick, restart, stop, skip, onPhoto };
})();
