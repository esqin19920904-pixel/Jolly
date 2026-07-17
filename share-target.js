/* ============================================================
   JOLLY Share Target — Android "Paylaş"dan gələn şəkli qəbul et
   WhatsApp (və ya istənilən tətbiq) içində şəklə uzun-bas →
   "Paylaş" → "JOLLY" seçəndə, bu səhifə açılır: şəkli
   JollyVisualSearch ilə bazada axtarır, ən yaxın 3 namizədi
   göstərir (Skan ilə Qəbul ilə eyni məntiq) — təsdiqləsən şəkil
   həmin məhsula əlavə olunur, tapılmasa "Yeni məhsul" kimi
   Gələn Mallar-a atılır.

   TEXNİKİ: Şəkli buraya "sw.js" (Service Worker) gətirir —
   manifest.json-dakı "share_target" qeydiyyatı vasitəsilə Android
   JOLLY-ni Paylaş siyahısında göstərir, POST sorğusunu sw.js tutub
   Cache Storage-a ('jolly-share-cache' adlı, '/shared-image' açarı
   ilə) qoyur, sonra bu səhifəyə yönləndirir. Bu fayl həmin keşdən
   şəkli oxuyub təmizləyir.

   Tamamilə müstəqil modul — ModuleRegistry-ə qeydiyyatdan keçir.
   Route: #/share-received
   ============================================================ */

const JollyShareTarget = (() => {
  const CACHE_NAME = 'jolly-share-cache';
  const CACHE_KEY = '/shared-image';
  const MAX_DISTANCE = 26;
  const CONFIDENT_SIMILARITY = 55;

  let pendingImage = null;

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  /* ============================================================
     ƏSAS SƏHİFƏ
     ============================================================ */
  function render() {
    setTimeout(() => loadSharedImage(), 0);
    return `
      <div class="back-btn anim-slide" onclick="JollyRouter.go('#/home')">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📥 Paylaşılan Şəkil</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">WhatsApp-dan (və ya başqa tətbiqdən) "Paylaş → JOLLY" ilə gələn şəkil.</p>
      <div id="stContent">
        <div class="empty-state"><div class="big-icon">⏳</div><h3>Şəkil axtarılır...</h3></div>
      </div>
    `;
  }

  async function loadSharedImage() {
    const zone = document.getElementById('stContent');
    if (!zone) return;

    if (!('caches' in window)) {
      zone.innerHTML = emptyStateHtml('Bu brauzer paylaşım qəbulunu dəstəkləmir.');
      return;
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(CACHE_KEY);
      if (!res) {
        zone.innerHTML = emptyStateHtml('Paylaşılan şəkil tapılmadı — bu səhifə WhatsApp-dan (və ya başqa tətbiqdən) "Paylaş → JOLLY" seçəndə avtomatik açılır.');
        return;
      }
      const blob = await res.blob();
      await cache.delete(CACHE_KEY); // bir dəfə istifadə, sonra təmizlə

      const dataUrl = await blobToDataUrl(blob);
      pendingImage = dataUrl;

      zone.innerHTML = `
        <div class="glass" style="padding:10px;text-align:center;margin-bottom:14px;">
          <img src="${dataUrl}" style="width:100%;max-height:32vh;object-fit:contain;border-radius:14px;">
        </div>
        <div id="stResultZone"><div class="muted" style="text-align:center;padding:12px;">🔎 Bazada axtarılır...</div></div>
      `;

      let results = [];
      if (typeof JollyVisualSearch !== 'undefined') {
        try { results = await JollyVisualSearch.findSimilar(dataUrl, MAX_DISTANCE); } catch (e) { console.error(e); }
      }
      renderResult(results);
    } catch (e) {
      console.error('JollyShareTarget load error', e);
      zone.innerHTML = emptyStateHtml('Şəkil oxunmadı, yenidən paylaşmağı sına.');
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function emptyStateHtml(msg) {
    return `<div class="empty-state"><div class="big-icon">📭</div><h3>${esc(msg)}</h3></div>`;
  }

  /* ---------- Nəticə: TOP namizədlər ---------- */
  function renderResult(results) {
    const zone = document.getElementById('stResultZone');
    if (!zone) return;
    const candidates = (results || []).filter(r => r.similarity >= CONFIDENT_SIMILARITY).slice(0, 3);

    if (candidates.length) {
      zone.innerHTML = `
        <div class="muted" style="font-size:11px;margin-bottom:8px;">Uyğun ola biləcək məhsullar — düzgününə toxun:</div>
        ${candidates.map(c => {
          const p = c.product;
          const thumb = (p.images && p.images[0])
            ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:52px;height:52px;object-fit:cover;border-radius:10px;">`
            : `<div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:24px;background:rgba(255,255,255,0.05);border-radius:10px;">🧴</div>`;
          return `
            <div class="list-row" style="cursor:pointer;padding:8px 4px;align-items:center;" onclick="JollyShareTarget.confirmMatch('${p.id}')">
              <span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                ${thumb}
                <span style="flex:1;min-width:0;">
                  <span style="display:block;font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.name || 'Adsız')}</span>
                  <span class="muted" style="font-size:11px;">${c.similarity}% uyğunluq</span>
                </span>
              </span>
              <span style="color:var(--accent-2);font-size:18px;">✓</span>
            </div>
          `;
        }).join('')}
        <div class="row" style="gap:8px;margin-top:10px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyShareTarget.manualSearch()">🔎 Bunların heç biri</button>
          <button class="btn btn-primary" style="flex:1;" onclick="JollyShareTarget.markNew()">🆕 Yeni məhsul</button>
        </div>
      `;
    } else {
      zone.innerHTML = `
        <div style="text-align:center;">
          <div class="muted" style="font-size:12.5px;margin:6px 0 10px;">🤔 Bazada uyğun məhsul tapılmadı</div>
          <div class="row" style="gap:8px;">
            <button class="btn btn-ghost" style="flex:1;" onclick="JollyShareTarget.manualSearch()">🔎 Özüm tapım</button>
            <button class="btn btn-primary" style="flex:1;" onclick="JollyShareTarget.markNew()">🆕 Yeni məhsul</button>
          </div>
        </div>
      `;
    }
  }

  async function confirmMatch(productId) {
    if (!pendingImage) return;
    const p = JollyDB.Products.get(productId);
    if (!p) { Toast.error('Məhsul tapılmadı'); return; }
    let img = pendingImage;
    if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
      try { img = await JollyStorage.compressImage(img); } catch (e) {}
    }
    JollyDB.Products.update(productId, { images: [...(p.images || []), img] });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(`✅ "${p.name || 'Adsız'}" — şəkil əlavə olundu`);
    JollyRouter.go('#/product/' + productId);
  }

  function manualSearch() {
    const zone = document.getElementById('stResultZone');
    if (!zone) return;
    zone.innerHTML = `
      <div class="glass command-bar" style="margin-bottom:10px;">
        <span style="opacity:.6">🔎</span>
        <input id="stManualSearchInput" placeholder="Məhsul adı ilə axtar..." oninput="JollyShareTarget.filterManual()">
      </div>
      <div id="stManualList" style="max-height:240px;overflow-y:auto;"></div>
      <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="JollyShareTarget.markNew()">🆕 Yeni məhsuldur</button>
    `;
    document.getElementById('stManualSearchInput').focus();
  }

  function filterManual() {
    const q = (document.getElementById('stManualSearchInput') || {}).value || '';
    const list = document.getElementById('stManualList');
    if (!list) return;
    if (!q.trim()) { list.innerHTML = ''; return; }
    const matches = JollyDB.Products.search(q).slice(0, 15);
    list.innerHTML = matches.length
      ? matches.map(p => `
          <div class="list-row" style="cursor:pointer;" onclick="JollyShareTarget.confirmMatch('${p.id}')">
            <span>${esc(p.name || 'Adsız')}</span>
            <span class="mono muted" style="font-size:11px;">${(p.barcodes && p.barcodes[0]) || ''}</span>
          </div>
        `).join('')
      : '<div class="muted" style="padding:10px;font-size:12px;">Nəticə yoxdur</div>';
  }

  async function markNew() {
    if (!pendingImage) return;
    let img = pendingImage;
    if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
      try { img = await JollyStorage.compressImage(img); } catch (e) {}
    }
    const draft = JollyDB.Drafts.add({ name: '', images: [img], barcodes: [], price: '', createdAt: Date.now() });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('🆕 "Gələn Mallar"a əlavə olundu');
    JollyRouter.go('#/product/new?draft=' + draft.id);
  }

  /* ============================================================
     Registrasiya
     ============================================================ */
  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'share-target',
      name: 'Paylaşılan Şəkil',
      icon: '📥',
      route: '#/share-received',
      group: 'Anbar',
      enabled: true,
      render() { return render(); },
    });
  }

  return { confirmMatch, manualSearch, filterManual, markNew };
})();
