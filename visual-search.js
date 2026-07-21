/* ============================================================
   JOLLY Visual Search — kamera şəkli ilə bazadakı şəkilləri
   perceptual-hash (average hash) əsasında müqayisə edir
   ============================================================ */

const JollyVisualSearch = (() => {
  const HASH_SIZE = 8; // 8x8 = 64-bit hash

  function _denied() {
    if (window.Toast) Toast.error('❌ Şəkillə axtarış üçün icazəniz yoxdur');
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  }

  function computeHashFromImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = HASH_SIZE; canvas.height = HASH_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, HASH_SIZE, HASH_SIZE);
    const data = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE).data;
    const gray = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }
    const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
    return gray.map(v => (v > avg ? 1 : 0)).join('');
  }

  function hammingDistance(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function findSimilar(capturedDataUrl, maxDistance = 20) {
    const capturedImg = await loadImage(capturedDataUrl);
    const capturedHash = computeHashFromImage(capturedImg);

    const products = JollyDB.Products.all();
    const results = [];
    const totalBits = HASH_SIZE * HASH_SIZE;

    for (const p of products) {
      if (!p.images || p.images.length === 0) continue;
      for (let imgSrc of p.images) {
        try {
          if (typeof JollyStorage !== 'undefined' && imgSrc && imgSrc.startsWith('idb:')) {
            imgSrc = await JollyStorage.getImage(imgSrc);
            if (!imgSrc) continue;
          }
          const img = await loadImage(imgSrc);
          const hash = computeHashFromImage(img);
          const dist = hammingDistance(capturedHash, hash);
          if (dist <= maxDistance) {
            results.push({ product: p, distance: dist, similarity: Math.round((1 - dist / totalBits) * 100) });
            break;
          }
        } catch (e) { /* skip broken image */ }
      }
    }
    results.sort((a, b) => a.distance - b.distance);
    return results; // [{ product, distance, similarity }]
  }

  async function captureAndSearch(onResults) {
    // İcazə yoxlaması — search.photo
    if (typeof POS !== 'undefined' && !POS.can('search.photo')) { _denied(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'scan-overlay vs-scanning';
    overlay.id = 'visualScanOverlay';
    overlay.innerHTML = `
      <button class="icon-btn scan-close" id="visualScanClose">✕</button>
      <video id="visualScanVideo" autoplay playsinline muted></video>
      <div class="scan-frame" style="height:220px;"></div>
      <div style="position:absolute;bottom:100px;left:0;right:0;text-align:center;">
        <button class="btn btn-primary" id="visualCaptureBtn" style="border-radius:999px;width:70px;height:70px;padding:0;font-size:26px;">📸</button>
      </div>
      <div style="position:absolute;bottom:40px;left:0;right:0;text-align:center;color:#fff;font-size:13px;opacity:.85;">
        Məhsulu çərçivəyə tutub şəkil çəkin
      </div>
    `;
    document.body.appendChild(overlay);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      document.getElementById('visualScanVideo').srcObject = stream;
    } catch (e) {
      Toast.error('Kameraya giriş alınmadı.');
      overlay.remove();
      return;
    }

    function cleanup() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      overlay.remove();
    }

    document.getElementById('visualScanClose').onclick = cleanup;
    document.getElementById('visualCaptureBtn').onclick = async () => {
      const video = document.getElementById('visualScanVideo');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      cleanup();
      Toast.info('Axtarılır...');
      const results = await findSimilar(dataUrl);
      onResults(results, dataUrl);
    };
  }

  /* ---------- Qalereyadan şəkil seçib müqayisə et ---------- */
  function pickAndSearch(onResults) {
    // İcazə yoxlaması — search.photo
    if (typeof POS !== 'undefined' && !POS.can('search.photo')) { _denied(); return; }

    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        Toast.info('Axtarılır...');
        const results = await findSimilar(ev.target.result);
        onResults(results, ev.target.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return { captureAndSearch, pickAndSearch, findSimilar, computeHashFromImage, loadImage };
})();
