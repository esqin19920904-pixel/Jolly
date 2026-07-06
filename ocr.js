/* ============================================================
   JOLLY OCR — şəkildən mətn oxuma (Tesseract.js)
   Kitabxana internetdən lazım olanda yüklənir (lazy load)
   ============================================================ */

const JollyOCR = (() => {
  let tesseractLoaded = false;
  let loading = false;

  const CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  function loadLibrary() {
    return new Promise((resolve, reject) => {
      if (tesseractLoaded && window.Tesseract) return resolve();
      if (loading) {
        // artıq yüklənir — gözlə
        const check = setInterval(() => {
          if (window.Tesseract) { clearInterval(check); resolve(); }
        }, 200);
        setTimeout(() => { clearInterval(check); if (!window.Tesseract) reject(new Error('OCR yüklənmədi')); }, 20000);
        return;
      }
      loading = true;
      const script = document.createElement('script');
      script.src = CDN;
      script.onload = () => { tesseractLoaded = true; loading = false; resolve(); };
      script.onerror = () => { loading = false; reject(new Error('OCR kitabxanası yüklənmədi — internet lazımdır')); };
      document.head.appendChild(script);
    });
  }

  function isSupported() { return true; } // internet olduqda işləyir

  /* Şəkildən (dataURL) mətn oxu */
  async function recognize(imageDataUrl, onProgress) {
    await loadLibrary();
    if (!window.Tesseract) throw new Error('OCR hazır deyil');
    const worker = await window.Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (onProgress && m.status === 'recognizing text') onProgress(Math.round(m.progress * 100));
      },
    });
    try {
      const { data } = await worker.recognize(imageDataUrl);
      await worker.terminate();
      return data.text || '';
    } catch (e) {
      try { await worker.terminate(); } catch (_) {}
      throw e;
    }
  }

  /* Kamera aç, şəkil çək, OCR et */
  async function captureAndRead(onResult) {
    const overlay = document.createElement('div');
    overlay.className = 'scan-overlay';
    overlay.id = 'ocrOverlay';
    overlay.innerHTML = `
      <button class="icon-btn scan-close" id="ocrClose">✕</button>
      <video id="ocrVideo" autoplay playsinline muted></video>
      <div class="scan-frame" style="height:200px;"></div>
      <div style="position:absolute;bottom:100px;left:0;right:0;text-align:center;">
        <button class="btn btn-primary" id="ocrCapture" style="border-radius:999px;width:70px;height:70px;padding:0;font-size:26px;">📸</button>
      </div>
      <div id="ocrHint" style="position:absolute;bottom:40px;left:0;right:0;text-align:center;color:#fff;font-size:13px;opacity:.85;">
        Yazını çərçivəyə tutub şəkil çək
      </div>
    `;
    document.body.appendChild(overlay);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      document.getElementById('ocrVideo').srcObject = stream;
    } catch (e) {
      Toast.error('Kameraya giriş alınmadı.');
      overlay.remove();
      return;
    }

    function cleanup() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      overlay.remove();
    }
    document.getElementById('ocrClose').onclick = cleanup;

    document.getElementById('ocrCapture').onclick = async () => {
      const video = document.getElementById('ocrVideo');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      if (stream) stream.getTracks().forEach(t => t.stop());
      const hint = document.getElementById('ocrHint');
      if (hint) hint.textContent = 'Oxunur... 0%';
      try {
        const text = await recognize(dataUrl, (p) => { if (hint) hint.textContent = `Oxunur... ${p}%`; });
        overlay.remove();
        onResult(text, dataUrl);
      } catch (e) {
        overlay.remove();
        Toast.error(e.message || 'OCR alınmadı');
      }
    };
  }

  /* Qalereyadan şəkil seçib OCR et */
  function pickAndRead(onResult) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        Toast.info('Oxunur...');
        try {
          const text = await recognize(ev.target.result);
          onResult(text, ev.target.result);
        } catch (err) {
          Toast.error(err.message || 'OCR alınmadı');
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return { recognize, captureAndRead, pickAndRead, isSupported, loadLibrary };
})();
