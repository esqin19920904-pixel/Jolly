/* ============================================================
   JOLLY Skan ilə Qəbul — Scan Receiving
   Əvvəlcədən bazada mövcud olan, barkodsuz TƏKRAR gələn 
   üçün: kamera ilə ardıcıl şəkil çək → JollyVisualSearch ilə
   bazadakı məhsulu tap → təsdiqlə → şəkli məhsulun kartına
   avtomatik əlavə et → növbəti şəkli çək.

   Tapılmazsa: əl ilə axtar, ya da "Yeni məhsul" kimi Gələn
   Mallar-a (Draft) at.

   TAMAMİLƏ MÜSTƏQİL MODUL — receiving.js-ə toxunmur.
   Route: #/scan-receiving
   Asılılıq: JollyVisualSearch (visual-search.js) mütləq lazımdır.
   ============================================================ */

const JollyScanReceiving = (() => {
  const MAX_DISTANCE = 20;          // JollyVisualSearch.findSimilar-dəki maxDistance
  const CONFIDENT_SIMILARITY = 65;  // bundan yuxarı → "uyğun tapıldı" kartı göstərilir

  let session = { count: 0, matched: 0, newCount: 0, log: [] };
  let stream = null;
  let busy = false;          // bir şəkil emal olunarkən yeni çəkilişin qarşısını alır
  let pendingImage = null;   // hazırkı çəkilmiş şəklin dataUrl-i (böyük olduğu üçün HTML-ə yazılmır)

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  /* ============================================================
     ƏSAS EKRAN
     ============================================================ */
  function renderMain() {
    session = { count: 0, matched: 0, newCount: 0, log: [] };
    pendingImage = null;
    return `
      <div class="back-btn anim-slide" onclick="JollyScanReceiving.exit()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📸 Skan ilə Qəbul</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">
        Barkodsuz təkrar gələn məhsulları kamera ilə ardıcıl çək — sistem bazadan tapıb şəklini məhsulun kartına özü əlavə edəcək.
      </p>

      <div class="glass" style="padding:14px;margin-bottom:14px;">
        <div class="row between">
          <div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:700;" id="srCounter">0</div>
            <div class="muted" style="font-size:11px;">şəkil işləndi</div>
          </div>
          <button class="btn btn-primary" id="srStartBtn" onclick="JollyScanReceiving.startSession()">🚀 Skana başla</button>
        </div>
      </div>

      <div id="srSessionZone"></div>
      <div style="height:40px;"></div>
    `;
  }

  /* ============================================================
     KAMERA SESSİYASI
     ============================================================ */
  async function startSession() {
    const zone = document.getElementById('srSessionZone');
    const startBtn = document.getElementById('srStartBtn');

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (e) {
      Toast.error('Kameraya giriş alınmadı.');
      return;
    }

    if (startBtn) startBtn.style.display = 'none';
    zone.innerHTML = `
      <div class="glass" style="padding:10px;text-align:center;">
        <video id="srVideo" autoplay playsinline muted style="width:100%;border-radius:14px;max-height:300px;object-fit:cover;background:#000;"></video>
        <button class="btn btn-primary" id="srCaptureBtn" style="margin-top:12px;border-radius:999px;width:70px;height:70px;padding:0;font-size:26px;" onclick="JollyScanReceiving.captureOne()">📸</button>
        <div class="muted" style="font-size:11.5px;margin-top:8px;">Məhsulu çərçivəyə tut, çək, təsdiqlə — sıra ilə davam et</div>
      </div>
      <div id="srResultZone" style="margin-top:12px;"></div>
      <button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="JollyScanReceiving.endSession()">🏁 Sessiyanı bitir</button>
      <div class="section-title">Bu sessiyada</div>
      <div class="glass" id="srLogList" style="padding:4px 14px;max-height:220px;overflow-y:auto;">
        <div class="muted" style="padding:10px;font-size:12px;">Hələ heç nə yoxdur</div>
      </div>
    `;
    document.getElementById('srVideo').srcObject = stream;
  }

  function stopStream() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  async function captureOne() {
    if (busy) return;
    const video = document.getElementById('srVideo');
    if (!video || !video.videoWidth) return;
    busy = true;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    pendingImage = canvas.toDataURL('image/jpeg', 0.85);

    const resultZone = document.getElementById('srResultZone');
    if (resultZone) resultZone.innerHTML = '<div class="muted" style="text-align:center;padding:12px;">🔎 Axtarılır...</div>';

    let results = [];
    try {
      results = await JollyVisualSearch.findSimilar(pendingImage, MAX_DISTANCE);
    } catch (e) {
      console.error('JollyScanReceiving: axtarış xətası', e);
    }
    renderResult(results);
    busy = false;
  }

  function renderResult(results) {
    const resultZone = document.getElementById('srResultZone');
    if (!resultZone) return;
    const top = results && results[0];

    if (top && top.similarity >= CONFIDENT_SIMILARITY) {
      const p = top.product;
      const thumb = (p.images && p.images[0])
        ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:56px;height:56px;object-fit:cover;border-radius:10px;">`
        : `<div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:26px;">🧴</div>`;
      resultZone.innerHTML = `
        <div class="glass anim-pop" style="padding:14px;">
          <div class="row" style="gap:12px;align-items:center;">
            ${thumb}
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.name || 'Adsız')}</div>
              <div class="muted" style="font-size:11.5px;">${top.similarity}% uyğunluq</div>
            </div>
          </div>
          <div class="row" style="gap:8px;margin-top:12px;">
            <button class="btn btn-primary" style="flex:1;" onclick="JollyScanReceiving.confirmMatch('${p.id}')">✅ Bu məhsuldur</button>
            <button class="btn btn-ghost" style="flex:1;" onclick="JollyScanReceiving.rejectMatch()">❌ Səhvdir</button>
          </div>
        </div>
      `;
    } else {
      resultZone.innerHTML = `
        <div class="glass anim-pop" style="padding:14px;text-align:center;">
          <div style="font-size:30px;">🤔</div>
          <div class="muted" style="font-size:12.5px;margin:6px 0 10px;">Bazada uyğun məhsul tapılmadı</div>
          <div class="row" style="gap:8px;">
            <button class="btn btn-ghost" style="flex:1;" onclick="JollyScanReceiving.manualSearch()">🔎 Özüm tapım</button>
            <button class="btn btn-primary" style="flex:1;" onclick="JollyScanReceiving.markNew()">🆕 Yeni məhsul</button>
          </div>
        </div>
      `;
    }
  }

  /* ---------- Təsdiq: şəkli məhsulun kartına əlavə et ---------- */
  async function confirmMatch(productId) {
    if (!pendingImage) return;
    const p = JollyDB.Products.get(productId);
    if (!p) { Toast.error('Məhsul tapılmadı'); return; }

    let img = pendingImage;
    if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
      try { img = await JollyStorage.compressImage(img); } catch (e) {}
    }
    const images = [...(p.images || []), img];
    JollyDB.Products.update(productId, { images });

    session.count++; session.matched++;
    session.log.unshift({ type: 'match', name: p.name || 'Adsız' });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(`✅ "${p.name || 'Adsız'}" — şəkil əlavə olundu`);
    afterOutcome();
  }

  function rejectMatch() {
    manualSearch();
  }

  /* ---------- Əl ilə axtarış ---------- */
  function manualSearch() {
    const resultZone = document.getElementById('srResultZone');
    if (!resultZone) return;
    resultZone.innerHTML = `
      <div class="glass anim-pop" style="padding:14px;">
        <div class="glass command-bar" style="margin-bottom:10px;">
          <span style="opacity:.6">🔎</span>
          <input id="srManualSearchInput" placeholder="Məhsul adı ilə axtar..." oninput="JollyScanReceiving.filterManual()">
        </div>
        <div id="srManualList" style="max-height:240px;overflow-y:auto;"></div>
        <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="JollyScanReceiving.markNew()">🆕 Bu barədə — Yeni məhsuldur</button>
      </div>
    `;
    document.getElementById('srManualSearchInput').focus();
  }

  function filterManual() {
    const q = (document.getElementById('srManualSearchInput') || {}).value || '';
    const list = document.getElementById('srManualList');
    if (!list) return;
    if (!q.trim()) { list.innerHTML = ''; return; }
    const matches = JollyDB.Products.search(q).slice(0, 15);
    list.innerHTML = matches.length
      ? matches.map(p => `
          <div class="list-row" style="cursor:pointer;" onclick="JollyScanReceiving.confirmMatch('${p.id}')">
            <span>${esc(p.name || 'Adsız')}</span>
            <span class="mono muted" style="font-size:11px;">${(p.barcodes && p.barcodes[0]) || ''}</span>
          </div>
        `).join('')
      : '<div class="muted" style="padding:10px;font-size:12px;">Nəticə yoxdur</div>';
  }

  /* ---------- Yeni məhsul → Gələn Mallar draftına at ---------- */
  async function markNew() {
    if (!pendingImage) return;
    let img = pendingImage;
    if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
      try { img = await JollyStorage.compressImage(img); } catch (e) {}
    }
    JollyDB.Drafts.add({ name: '', images: [img], barcodes: [], price: '', createdAt: Date.now() });

    session.count++; session.newCount++;
    session.log.unshift({ type: 'new', name: 'Yeni məhsul (Gələn Mallar)' });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('🆕 "Gələn Mallar"a əlavə olundu');
    afterOutcome();
  }

  function afterOutcome() {
    pendingImage = null;
    const counter = document.getElementById('srCounter');
    if (counter) counter.textContent = session.count;
    const resultZone = document.getElementById('srResultZone');
    if (resultZone) resultZone.innerHTML = '';
    renderLog();
  }

  function renderLog() {
    const el = document.getElementById('srLogList');
    if (!el) return;
    if (!session.log.length) { el.innerHTML = '<div class="muted" style="padding:10px;font-size:12px;">Hələ heç nə yoxdur</div>'; return; }
    el.innerHTML = session.log.map(item => `
      <div class="list-row">
        <span>${item.type === 'match' ? '✅' : '🆕'} ${esc(item.name)}</span>
      </div>
    `).join('');
  }

  /* ---------- Sessiyanı bitir / çıxış ---------- */
  function endSession() {
    stopStream();
    const zone = document.getElementById('srSessionZone');
    if (!zone) return;
    zone.innerHTML = `
      <div class="glass" style="padding:22px;text-align:center;">
        <div style="font-size:46px;">🎉</div>
        <div style="font-family:var(--font-display);font-size:19px;font-weight:700;margin:10px 0 4px;">Sessiya bitdi</div>
        <div class="muted" style="font-size:12.5px;">${session.count} şəkil işləndi — ${session.matched} uyğun tapıldı, ${session.newCount} yeni</div>
        <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="JollyRouter.go('#/scan-receiving')">‹ Bağla</button>
      </div>
    `;
  }

  function exit() {
    stopStream();
    JollyRouter.go('#/home');
  }

  /* ============================================================
     Registrasiya
     ============================================================ */
  function init() {
    window.addEventListener('hashchange', () => {
      if ((window.location.hash || '').indexOf('/scan-receiving') < 0) stopStream();
    });
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'scan-receiving',
      name: 'Skan ilə Qəbul',
      icon: '📸',
      route: '#/scan-receiving',
      group: 'Anbar',
      enabled: true,
      render() { return renderMain(); },
      init,
    });
  }

  return {
    startSession, captureOne, confirmMatch, rejectMatch,
    manualSearch, filterManual, markNew, endSession, exit,
  };
})();
