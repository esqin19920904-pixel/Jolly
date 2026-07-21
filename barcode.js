/* JOLLY Barcode — kamera ilə barkod skan (BarcodeDetector API) */

const JollyBarcode = (() => {
  let stream = null;
  let detector = null;
  let scanning = false;
  let onResult = null;
  let rafId = null;

  function isSupported() {
    return 'BarcodeDetector' in window;
  }

  async function open(callback) {
    // İcazə yoxlaması — barcode.scan
    if (typeof POS !== 'undefined' && !POS.can('barcode.scan')) {
      if (window.Toast) Toast.error('❌ Barkod skan üçün icazəniz yoxdur');
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      return;
    }

    onResult = callback;
    const overlay = document.createElement('div');
    overlay.className = 'scan-overlay';
    overlay.id = 'scanOverlay';
    overlay.innerHTML = `
      <button class="icon-btn scan-close" id="scanCloseBtn">✕</button>
      <video id="scanVideo" autoplay playsinline muted></video>
      <div class="scan-frame"></div>
      <div style="position:absolute;bottom:40px;left:0;right:0;text-align:center;color:#fff;font-size:13px;opacity:.85;">
        Barkodu çərçivə içinə tutun
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('scanCloseBtn').onclick = close;

    if (!isSupported()) {
      Toast.error('Bu cihazda avtomatik barkod tanıma dəstəklənmir. Əl ilə daxil edin.');
      close();
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = document.getElementById('scanVideo');
      video.srcObject = stream;
      detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
      });
      scanning = true;
      loop(video);
    } catch (e) {
      console.error(e);
      Toast.error('Kameraya giriş alınmadı. İcazələri yoxlayın.');
      close();
    }
  }

  async function loop(video) {
    if (!scanning) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length > 0) {
        const value = codes[0].rawValue;
        scanning = false;
        if (navigator.vibrate) navigator.vibrate(80);
        if (onResult) onResult(value);
        close();
        return;
      }
    } catch (e) { /* frame not ready */ }
    rafId = requestAnimationFrame(() => loop(video));
  }

  function close() {
    scanning = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    const overlay = document.getElementById('scanOverlay');
    if (overlay) overlay.remove();
  }

  return { open, close, isSupported };
})();
