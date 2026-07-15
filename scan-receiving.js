/* ============================================================
   JOLLY Skan ilə Qəbul — Scan Receiving (v2)
   Əvvəlcədən bazada mövcud olan, barkodsuz TƏKRAR gələn məhsullar
   üçün: kamera ilə ardıcıl şəkil çək → JollyVisualSearch ilə
   bazadakı ən uyğun namizədləri tap → düzgününü seç → şəkil
   avtomatik məhsulun kartına əlavə olunur → növbəti şəkli çək.

   YENİLİKLƏR (v2):
   - Bir yox, EN YAXIN 3 NAMİZƏD göstərilir — səhv uyğunlaşmanın qarşısını alır
   - Sessiya sonunda hər maddənin ŞƏKLİ + ADI ilə xülasə (təkcə say yox)
   - Sessiya başlamazdan əvvəl HƏSSASLIQ SEÇİMİ (Az / Orta / Çox)

   Tapılmazsa: əl ilə axtar, ya da "Yeni məhsul" kimi Gələn
   Mallar-a (Draft) at.

   TAMAMİLƏ MÜSTƏQİL MODUL — receiving.js-ə toxunmur.
   Route: #/scan-receiving
   Asılılıq: JollyVisualSearch (visual-search.js) mütləq lazımdır.
   ============================================================ */

const JollyScanReceiving = (() => {
  const MAX_DISTANCE = 26;              // ən geniş axtarış radiusu (namizədləri toplamaq üçün)
  const SENSITIVITY_KEY = 'jolly_scan_receiving_sensitivity';
  const SENSITIVITY_PRESETS = {
    low:    { label: 'Az həssas',  minSimilarity: 75 },
    medium: { label: 'Orta',       minSimilarity: 60 },
    high:   { label: 'Çox həssas', minSimilarity: 45 },
  };
  const CANDIDATE_COUNT = 3; // ən çox neçə namizəd göstərilsin

  let session = { count: 0, matched: 0, newCount: 0, log: [] };
  let stream = null;
  let busy = false;
  let pendingImage = null; // hazırkı çəkilmiş şəklin dataUrl-i

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s)); }

  function getSensitivity() {
    try { return localStorage.getItem(SENSITIVITY_KEY) || 'medium'; } catch (e) { return 'medium'; }
  }
  function setSensitivity(key) {
    try { localStorage.setItem(SENSITIVITY_KEY, key); } catch (e) {}
    renderMainInto();
  }
  function currentMinSimilarity() {
    return (SENSITIVITY_PRESETS[getSensitivity()] || SENSITIVITY_PRESETS.medium).minSimilarity;
  }

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
        <div class="row between" style="margin-bottom:12px;">
          <div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:700;" id="srCounter">0</div>
            <div class="muted" style="font-size:11px;">şəkil işləndi</div>
          </div>
          <button class="btn btn-primary" id="srStartBtn" onclick="JollyScanReceiving.startSession()">🚀 Skana başla</button>
        </div>
        <div class="muted" style="font-size:11px;margin-bottom:6px;">🎯 Tanınma həssaslığı</div>
        <div class="row" id="srSensitivityRow" style="gap:6px;">
          ${Object.entries(SENSITIVITY_PRESETS).map(([key, p]) => `
            <span class="chip ${getSensitivity() === key ? 'chip-active' : ''}" style="flex:1;text-align:center;" onclick="JollyScanReceiving.setSensitivity('${key}')">${esc(p.label)}</span>
          `).join('')}
        </div>
        <div class="muted" style="font-size:10.5px;margin-top:6px;">"Çox həssas" daha çox namizəd göstərir amma səhv uyğunlaşma riski artır.</div>
      </div>

      <div id="srSessionZone"></div>
      <div style="height:40px;"></div>
    `;
  }

  function renderMainInto() {
    const main = document.getElementById('main');
    if (main && (window.location.hash || '').indexOf('/scan-receiving') >= 0) {
      main.innerHTML = renderMain();
    }
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
        <div class="muted" style="font-size:11.5px;margin-top:8px;">Məhsulu çərçivəyə tut, çək, düzgününü seç — sıra ilə davam et</div>
      </div>
      <div id="srResultZone" style="margin-top:12px;"></div>
      <button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="JollyScanReceiving.endSession()">🏁 Sessiyanı bitir</button>
      <div class="section-title">Bu sessiyada</div>
      <div class="glass" id="srLogList" style="padding:4px 14px;max-height:280px;overflow-y:auto;">
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

  /* ---------- Nəticə: TOP namizədlər siyahısı ---------- */
  function renderResult(results) {
    const resultZone = document.getElementById('srResultZone');
    if (!resultZone) return;
    const minSim = currentMinSimilarity();
    const candidates = (results || []).filter(r => r.similarity >= minSim).slice(0, CANDIDATE_COUNT);

    if (candidates.length) {
      resultZone.innerHTML = `
        <div class="glass anim-pop" style="padding:14px;">
          <div class="muted" style="font-size:11px;margin-bottom:8px;">Uyğun ola biləcək məhsullar — düzgününə toxun:</div>
          ${candidates.map(c => {
            const p = c.product;
            const thumb = (p.images && p.images[0])
              ? `<img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'} style="width:52px;height:52px;object-fit:cover;border-radius:10px;">`
              : `<div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:24px;background:rgba(255,255,255,0.05);border-radius:10px;">🧴</div>`;
            return `
              <div class="list-row" style="cursor:pointer;padding:8px 4px;align-items:center;" onclick="JollyScanReceiving.confirmMatch('${p.id}')">
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
            <button class="btn btn-ghost" style="flex:1;" onclick="JollyScanReceiving.manualSearch()">🔎 Bunların heç biri</button>
            <button class="btn btn-primary" style="flex:1;" onclick="JollyScanReceiving.markNew()">🆕 Yeni məhsul</button>
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

    const capturedThumb = pendingImage; // sessiya jurnalı üçün çəkilmiş şəklin özü
    let img = pendingImage;
    if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
      try { img = await JollyStorage.compressImage(img); } catch (e) {}
    }
    const images = [...(p.images || []), img];
    JollyDB.Products.update(productId, { images });

    session.count++; session.matched++;
    session.log.unshift({ type: 'match', name: p.name || 'Adsız', thumb: capturedThumb });
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(`✅ "${p.name || 'Adsız'}" — şəkil əlavə olundu`);
    afterOutcome();
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
    const capturedThumb = pendingImage;
    let img = pendingImage;
    if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
      try { img = await JollyStorage.compressImage(img); } catch (e) {}
    }
    JollyDB.Drafts.add({ name: '', images: [img], barcodes: [], price: '', createdAt: Date.now() });

    session.count++; session.newCount++;
    session.log.unshift({ type: 'new', name: 'Yeni məhsul (Gələn Mallar)', thumb: capturedThumb });
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
      <div class="list-row" style="align-items:center;">
        <span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          <img src="${item.thumb}" style="width:38px;height:38px;object-fit:cover;border-radius:8px;flex-shrink:0;">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">${item.type === 'match' ? '✅' : '🆕'} ${esc(item.name)}</span>
        </span>
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
      </div>
      ${session.log.length ? `
        <div class="section-title">Bu sessiyada edilənlər</div>
        <div class="glass" style="padding:4px 14px;max-height:340px;overflow-y:auto;">
          ${session.log.map(item => `
            <div class="list-row" style="align-items:center;">
              <span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                <img src="${item.thumb}" style="width:42px;height:42px;object-fit:cover;border-radius:9px;flex-shrink:0;">
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px;">${item.type === 'match' ? '✅' : '🆕'} ${esc(item.name)}</span>
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="JollyRouter.go('#/scan-receiving')">‹ Bağla</button>
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
    startSession, captureOne, confirmMatch,
    manualSearch, filterManual, markNew, endSession, exit,
    setSensitivity,
  };
})();
