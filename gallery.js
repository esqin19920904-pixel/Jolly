/* ============================================================
   JOLLY Gallery Scan — şəkildən barkod oxuma
   Qalereyadan şəkil seç → BarcodeDetector ilə oxu
   ============================================================ */

const JollyGalleryScan = (() => {

  function isSupported() { return 'BarcodeDetector' in window; }

  // Şəkil faylından barkod oxu
  async function readFromImage(imgSrc) {
    if (!isSupported()) throw new Error('Bu cihazda şəkildən barkod oxuma dəstəklənmir');
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc; });
    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
    });
    const codes = await detector.detect(img);
    return codes.length ? codes[0].rawValue : null;
  }

  // Qalereyadan seç və oxu
  function pickAndScan(onResult) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        Toast.info('Barkod axtarılır...');
        try {
          const code = await readFromImage(ev.target.result);
          if (code) {
            if (typeof JollySound !== 'undefined') JollySound.beep();
            onResult(code, ev.target.result);
          } else {
            if (typeof JollySound !== 'undefined') JollySound.error();
            Toast.error('Şəkildə barkod tapılmadı — daha aydın şəkil sına');
          }
        } catch (err) {
          Toast.error(err.message || 'Oxuma alınmadı');
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // Şəkildən oxu → məhsul tap (axtarış üçün)
  function scanAndFind() {
    pickAndScan((code) => {
      const found = JollyDB.Products.findByBarcode(code);
      if (found.length === 1) {
        JollyRouter.go(`#/product/${found[0].id}`);
      } else if (found.length > 1) {
        Toast.info(`${found.length} məhsul tapıldı`);
        JollyRouter.go('#/home');
        setTimeout(() => {
          const inp = document.getElementById('homeSearch');
          if (inp) { inp.value = code; JollyProducts.liveSearch(code); }
        }, 100);
      } else {
        Toast.error(`Barkod tapıldı (${code}) amma məhsul yoxdur`);
        if (confirm(`"${code}" barkodu ilə yeni məhsul yaradılsın?`)) {
          sessionStorage.setItem('jolly_prefill_barcode', code);
          JollyRouter.go('#/product/new');
        }
      }
    });
  }

  return { isSupported, readFromImage, pickAndScan, scanAndFind };
})();
