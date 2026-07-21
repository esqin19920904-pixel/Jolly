/* ============================================================
   JOLLY Live Lens — canlı kamera ilə məhsul tanıma
   Kamera açılır → barkodu canlı oxuyur → tapılan məhsulu
   üzən kart kimi göstərir → tapılmasa "Gələn Mallara əlavə et"
   Magic Command: sadə mətn əmrləri ilə tapılan məhsula əməl et
   ============================================================ */

const JollyLiveLens = (() => {
  let overlay = null, stream = null, video = null, detector = null;
  let loopTimer = null, lastCode = null, currentProduct = null;
  let lastSnapshotDataUrl = null;

  function esc(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s)); }

  /* ---------- Aç / bağla ---------- */
  async function open() {
    if (overlay) return;

    // İcazə yoxlaması — livelens.use
    if (typeof POS !== 'undefined' && !POS.can('livelens.use')) {
      if (window.Toast) Toast.error('❌ Live Lens üçün icazəniz yoxdur');
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      return;
    }

    overlay = document.createElement('div');
    overlay.className = 'scan-overlay vs-scanning ll-overlay';
    overlay.innerHTML = `
      <div class="ll-header">📡 JOLLY Live Lens</div>
      <button class="icon-btn scan-close" id="llClose">✕</button>
      <video id="llVideo" autoplay playsinline muted></video>
      <div class="scan-frame" id="llFrame" style="height:200px;"></div>
      <div class="ll-status" id="llStatus">Məhsula tut...</div>
      <div id="llCardZone"></div>
      <div class="ll-bottom">
        <input id="llCommand" class="ll-cmd-input" placeholder="Əmr yaz: 'whatsapp göndər', 'düzəlt'...">
        <button class="icon-btn" id="llCmdSend">➤</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('llClose').onclick = close;
    document.getElementById('llCmdSend').onclick = () => runMagicCommand();
    document.getElementById('llCommand').addEventListener('keydown', (e) => { if (e.key === 'Enter') runMagicCommand(); });

    video = document.getElementById('llVideo');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
    } catch (e) {
      setStatus('❌ Kameraya giriş alınmadı');
      showManualFallback();
      return;
    }

    if ('BarcodeDetector' in window) {
      try {
        detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'] });
        setStatus('Barkod axtarılır...');
        startDetectLoop();
      } catch (e) {
        setStatus('Barkod detektoru yoxdur');
        showManualFallback();
      }
    } else {
      setStatus('Bu brauzerdə avtomatik barkod oxuma yoxdur');
      showManualFallback();
    }
  }

  function close() {
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (overlay) { overlay.remove(); overlay = null; }
    detector = null; lastCode = null; currentProduct = null;
  }

  function setStatus(text) {
    const el = document.getElementById('llStatus');
    if (el) el.textContent = text;
  }

  /* ---------- Barkod aşkarlama dövrü ---------- */
  function startDetectLoop() {
    async function tick() {
      if (!overlay || !video || video.readyState < 2) { loopTimer = setTimeout(tick, 400); return; }
      try {
        const codes = await detector.detect(video);
        if (codes && codes.length) {
          const val = codes[0].rawValue;
          if (val && val !== lastCode) {
            lastCode = val;
            handleBarcode(val);
          }
        }
      } catch (e) { /* frame keçin, davam et */ }
      loopTimer = setTimeout(tick, 500);
    }
    tick();
  }

  /* ---------- Manual daxiletmə (BarcodeDetector yoxdursa) ---------- */
  function showManualFallback() {
    const zone = document.getElementById('llCardZone');
    if (!zone) return;
    zone.innerHTML = `
      <div class="glass ll-card">
        <div class="ll-card-title">Manual barkod daxil et</div>
        <input id="llManualBarcode" class="ll-cmd-input" placeholder="Barkod nömrəsini yaz..." style="margin-bottom:10px;">
        <button class="btn btn-primary btn-block" id="llManualGo">🔍 Axtar</button>
      </div>
    `;
    document.getElementById('llManualGo').onclick = () => {
      const val = document.getElementById('llManualBarcode').value.trim();
      if (val) handleBarcode(val);
    };
  }

  /* ---------- Tapılan barkodu emal et ---------- */
  function handleBarcode(code) {
    if (typeof JollySound !== 'undefined') JollySound.beep();
    const all = JollyDB.Products.all();
    const product = all.find(p => (p.barcodes || []).includes(code));
    if (product) {
      currentProduct = product;
      setStatus('✅ Məhsul tapıldı');
      renderFoundCard(product);
    } else {
      currentProduct = null;
      setStatus('⚠️ Bu barkod bazada yoxdur');
      renderNotFoundCard(code);
    }
  }

  function renderFoundCard(p) {
    const zone = document.getElementById('llCardZone');
    if (!zone) return;
    zone.innerHTML = `
      <div class="glass ll-card anim-pop">
        <div class="ll-card-title">${esc(p.name || 'Adsız məhsul')}</div>
        <div class="ll-card-row">${p.brand ? `🏷️ ${esc(p.brand)}` : ''}${p.group ? `　📦 ${esc(p.group)}` : ''}</div>
        ${p.location ? `<div class="ll-card-row">📍 ${esc(p.location)}</div>` : ''}
        <div class="ll-card-row mono">🧾 ${esc((p.barcodes && p.barcodes[0]) || '')}${p.last4 ? `　Son 4: ${esc(p.last4)}` : ''}</div>
        <div class="ll-card-actions">
          <button onclick="JollyLiveLens.action('whatsapp')">📲</button>
          <button onclick="JollyLiveLens.action('barcode')">🧾</button>
          <button onclick="JollyLiveLens.action('edit')">✏️</button>
          <button onclick="JollyLiveLens.action('open')">👁️</button>
        </div>
      </div>
    `;
  }

  function renderNotFoundCard(code) {
    // snapshot çək
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      lastSnapshotDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) { lastSnapshotDataUrl = null; }

    const zone = document.getElementById('llCardZone');
    if (!zone) return;
    zone.innerHTML = `
      <div class="glass ll-card anim-pop">
        <div class="ll-card-title">Bu məhsul bazada yoxdur</div>
        <div class="ll-card-row mono">🧾 ${esc(code)}</div>
        <button class="btn btn-primary btn-block" style="margin-top:8px;" onclick="JollyLiveLens.addAsDraft('${esc(code)}')">➕ Gələn Mallara əlavə et</button>
      </div>
    `;
  }

  function addAsDraft(code) {
    const payload = { name: '', barcodes: [code], images: lastSnapshotDataUrl ? [lastSnapshotDataUrl] : [] };
    JollyDB.Drafts.add(payload);
    if (typeof JollySound !== 'undefined') JollySound.success();
    Toast.success('Qaralamalara əlavə olundu — sonra tamamla');
    lastCode = null;
    setStatus('Növbəti məhsula tut...');
    const zone = document.getElementById('llCardZone');
    if (zone) zone.innerHTML = '';
  }

  /* ---------- Kart düymələri ---------- */
  function action(type) {
    if (!currentProduct) return;
    const id = currentProduct.id;
    if (type === 'whatsapp') { if (typeof JollyProducts !== 'undefined') JollyProducts.whatsappShare(id); }
    else if (type === 'barcode') { const bc = (currentProduct.barcodes || [])[0]; if (bc && typeof JollyProducts !== 'undefined') JollyProducts.showBarcode(bc); }
    else if (type === 'edit') { close(); JollyRouter.go('#/product/' + id + '/edit'); }
    else if (type === 'open') { close(); JollyRouter.go('#/product/' + id); }
  }

  /* ---------- Magic Command ---------- */
  function runMagicCommand() {
    const input = document.getElementById('llCommand');
    if (!input) return;
    const text = input.value.trim().toLowerCase();
    input.value = '';
    if (!text) return;

    if (!currentProduct) {
      // Ad/firma/qrup üzrə sadə axtarış
      const results = JollyDB.Products.search(text);
      if (results.length === 1) {
        currentProduct = results[0];
        setStatus('✅ Məhsul tapıldı');
        renderFoundCard(results[0]);
      } else if (results.length > 1) {
        Toast.info(`${results.length} nəticə tapıldı — daha dəqiq yaz`);
      } else {
        Toast.error('Tapılmadı');
      }
      return;
    }

    if (text.includes('whatsapp') || text.includes('göndər') || text.includes('gonder')) action('whatsapp');
    else if (text.includes('kassa') || text.includes('barkod')) action('barcode');
    else if (text.includes('düzəlt') || text.includes('duzelt') || text.includes('redakt')) action('edit');
    else if (text.includes('xəritə') || text.includes('yer')) {
      Toast.info(currentProduct.location ? `📍 ${currentProduct.location}` : 'Yer təyin olunmayıb');
    } else if (text.includes('yeni məhsul') || text.includes('yeni mehsul')) {
      close(); JollyRouter.go('#/product/new');
    } else {
      Toast.info('Bu əmri tanımadım');
    }
  }

  return { open, close, action, addAsDraft, runMagicCommand };
})();
