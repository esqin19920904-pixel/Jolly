/* ============================================================
   JOLLY Fix Mode — "Bu gün 10 mal"
   Tamamlanmamış malları bir-bir göstərir və YALNIZ çatışmayan
   sahəni soruşur. Məqsəd: "8 tamamlanmamış mal" rəqəmini
   10 dəqiqəlik konkret işə çevirmək.

   Marşrut: #/fixmode  (ModuleRegistry vasitəsilə — app.js-ə
   toxunmağa ehtiyac yoxdur)
   ============================================================ */
const JollyFixMode = (() => {
  const BATCH = 10;               // bir seansda neçə mal
  const DONE_KEY = 'jolly_fixmode_done';   // bu gün bitirilənlər

  let queue = [];                 // məhsul id-ləri
  let pos = 0;
  let fixedCount = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _today() { return new Date().toISOString().slice(0, 10); }

  function _doneToday() {
    const d = JollyDB.read(DONE_KEY, {}) || {};
    return (d.date === _today()) ? (d.ids || []) : [];
  }
  function _markDone(id) {
    const d = JollyDB.read(DONE_KEY, {}) || {};
    const ids = (d.date === _today()) ? (d.ids || []) : [];
    if (!ids.includes(id)) ids.push(id);
    JollyDB.write(DONE_KEY, { date: _today(), ids });
  }

  /* Bu məhsulda nə çatmır? Sıra vacibdir — ən kritik əvvəl. */
  function missingOf(p) {
    const out = [];
    if (!p.name || !p.name.trim()) out.push('name');
    if (!p.barcodes || !p.barcodes.length) out.push('barcode');
    if (!p.images || !p.images.length) out.push('image');
    if (p.price == null || p.price === '') out.push('price');
    return out;
  }

  function buildQueue() {
    const done = _doneToday();
    queue = JollyDB.Products.all()
      .filter(p => !JollyDB.isMarkedForDeletion || !JollyDB.isMarkedForDeletion(p.id))
      .filter(p => missingOf(p).length > 0)
      .filter(p => !done.includes(p.id))
      .slice(0, BATCH)
      .map(p => p.id);
    pos = 0;
    fixedCount = 0;
  }

  /* ---------- Ekran ---------- */
  function render() {
    buildQueue();
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">⚡ Bu gün ${BATCH} mal</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Hər malda yalnız çatışmayan bir şey soruşulur. Bitirdikcə növbətisi gəlir.</p>
      <div id="fixModeBody"></div>
      <input type="file" id="fixModePhoto" accept="image/*" capture="environment" style="display:none"
             onchange="JollyFixMode.onPhoto(event)">
    `;
  }

  function afterRender() { paint(); }

  function paint() {
    const body = document.getElementById('fixModeBody');
    if (!body) return;

    if (!queue.length) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="big-icon">✨</div>
          <h3>Tamamlanmamış mal yoxdur</h3>
          <p class="muted" style="font-size:12px;">Bu gün üçün hamısı bitib. Sabah yenidən yoxla.</p>
        </div>`;
      return;
    }

    if (pos >= queue.length) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="big-icon">🎉</div>
          <h3>Bu dəstə bitdi</h3>
          <p class="muted" style="font-size:12.5px;">${fixedCount} mal düzəldildi.</p>
          <button class="btn btn-primary" style="margin-top:12px;" onclick="JollyFixMode.restart()">Növbəti ${BATCH} mal</button>
        </div>`;
      return;
    }

    const p = JollyDB.Products.get(queue[pos]);
    if (!p) { next(); return; }
    const miss = missingOf(p);
    if (!miss.length) { next(); return; }

    const field = miss[0];
    const progress = Math.round((pos / queue.length) * 100);

    body.innerHTML = `
      <div class="muted" style="font-size:11.5px;margin-bottom:6px;">${pos + 1} / ${queue.length}${fixedCount ? ` · ${fixedCount} düzəldildi` : ''}</div>
      <div style="height:4px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:14px;overflow:hidden;">
        <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#5b7cfa,#4f9fff);transition:width .3s;"></div>
      </div>

      <div class="glass" style="padding:14px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <div style="width:56px;height:56px;border-radius:10px;overflow:hidden;background:#1a1d2e;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
            ${(p.images && p.images[0] && typeof JollyStorage !== 'undefined')
              ? `<img ${JollyStorage.imgAttr(p.images[0], true)} style="width:100%;height:100%;object-fit:cover;">`
              : '🧴'}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14.5px;">${esc(p.name || 'Adsız məhsul')}</div>
            <div class="muted mono" style="font-size:11.5px;margin-top:2px;">${esc((p.barcodes && p.barcodes[0]) || p.mainCode || '—')}</div>
          </div>
        </div>

        ${_fieldHtml(field, p)}

        ${miss.length > 1 ? `<div class="muted" style="font-size:11px;margin-top:10px;">Bunda daha ${miss.length - 1} şey çatmır — sonraya qalacaq.</div>` : ''}
      </div>

      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="JollyFixMode.skip()">Keç →</button>
        <button class="btn btn-ghost" style="flex:1;" onclick="JollyRouter.go('#/product/${p.id}/edit')">Tam formada aç</button>
      </div>
    `;

    if (typeof JollyStorage !== 'undefined' && JollyStorage.hydrate) JollyStorage.hydrate();
    const inp = document.getElementById('fixModeInput');
    if (inp) setTimeout(() => inp.focus(), 120);
  }

  function _fieldHtml(field, p) {
    const inputStyle = 'width:100%;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border-soft);color:var(--text-hi);font-size:15px;';

    if (field === 'image') {
      return `
        <div style="color:#ff5c6c;font-weight:700;font-size:13px;margin-bottom:8px;">🖼️ Şəkil çatmır</div>
        <button class="btn btn-primary btn-block" onclick="document.getElementById('fixModePhoto').click()">📷 Şəkil çək</button>`;
    }
    if (field === 'barcode') {
      return `
        <div style="color:#ff5c6c;font-weight:700;font-size:13px;margin-bottom:8px;">🏷️ Barkod çatmır</div>
        <input id="fixModeInput" inputmode="numeric" placeholder="Barkod rəqəmləri..." style="${inputStyle}"
               onkeydown="if(event.key==='Enter'){event.preventDefault();JollyFixMode.save();}">
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyFixMode.scan()">📷 Skan et</button>
          <button class="btn btn-primary" style="flex:1;" onclick="JollyFixMode.save()">Yadda saxla</button>
        </div>`;
    }
    if (field === 'price') {
      return `
        <div style="color:#ff9d5c;font-weight:700;font-size:13px;margin-bottom:8px;">💰 Qiymət çatmır</div>
        <input id="fixModeInput" inputmode="decimal" placeholder="Məsələn 4.50" style="${inputStyle}"
               onkeydown="if(event.key==='Enter'){event.preventDefault();JollyFixMode.save();}">
        <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="JollyFixMode.save()">Yadda saxla</button>`;
    }
    // name
    return `
      <div style="color:#ff5c6c;font-weight:700;font-size:13px;margin-bottom:8px;">📛 Ad çatmır</div>
      <input id="fixModeInput" placeholder="Məhsulun adı..." style="${inputStyle}"
             onkeydown="if(event.key==='Enter'){event.preventDefault();JollyFixMode.save();}">
      <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="JollyFixMode.save()">Yadda saxla</button>`;
  }

  /* ---------- Əməliyyatlar ---------- */
  function _current() { return JollyDB.Products.get(queue[pos]); }

  function save() {
    const p = _current();
    if (!p) return next();
    const field = missingOf(p)[0];
    const el = document.getElementById('fixModeInput');
    const val = el ? el.value.trim() : '';
    if (!val) { if (typeof Toast !== 'undefined') Toast.error('Boşdur'); return; }

    const patch = {};
    if (field === 'barcode') {
      const code = val.replace(/\D/g, '');
      if (!code) { if (typeof Toast !== 'undefined') Toast.error('Rəqəm yaz'); return; }
      const clash = JollyDB.Products.checkBarcodeConflict
        ? JollyDB.Products.checkBarcodeConflict(code, p.id) : null;
      if (clash) {
        if (typeof Toast !== 'undefined') Toast.error('Bu barkod artıq "' + (clash.name || 'başqa məhsul') + '"-dədir');
        return;
      }
      patch.barcodes = (p.barcodes || []).concat([code]);
    } else if (field === 'price') {
      const n = parseFloat(val.replace(',', '.'));
      if (isNaN(n)) { if (typeof Toast !== 'undefined') Toast.error('Rəqəm yaz'); return; }
      patch.price = n;
    } else {
      patch.name = val;
    }

    JollyDB.Products.update(p.id, patch);
    fixedCount++;
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (typeof Toast !== 'undefined') Toast.success('Yadda saxlanıldı');
    _afterFix(p.id);
  }

  function scan() {
    if (typeof JollyBarcode === 'undefined') {
      if (typeof Toast !== 'undefined') Toast.error('Skan modulu yoxdur');
      return;
    }
    JollyBarcode.open((code) => {
      const el = document.getElementById('fixModeInput');
      if (el) el.value = code;
      save();
    });
  }

  async function onPhoto(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const p = _current();
    if (!p) return next();
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
      fixedCount++;
      if (typeof JollySound !== 'undefined') JollySound.success();
      if (typeof Toast !== 'undefined') Toast.success('Şəkil əlavə olundu');
      _afterFix(p.id);
    } catch (e) {
      console.error('[FixMode] şəkil:', e);
      if (typeof Toast !== 'undefined') Toast.error('Şəkil saxlanmadı');
    }
  }

  /* Düzəldikdən sonra: hələ nəsə çatmırsa eyni malda qal, yoxsa növbətiyə keç */
  function _afterFix(id) {
    const fresh = JollyDB.Products.get(id);
    if (fresh && missingOf(fresh).length) { paint(); return; }
    _markDone(id);
    next();
  }

  function skip() { next(); }

  function next() {
    pos++;
    paint();
  }

  function restart() {
    buildQueue();
    paint();
  }

  /* ---------- Qeydiyyat ---------- */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'fixmode',
      name: 'Bu gün 10 mal',
      icon: '⚡',
      route: '#/fixmode',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
      afterRender() { afterRender(); },
    });
  }

  return { render, afterRender, save, scan, onPhoto, skip, restart, buildQueue };
})();
