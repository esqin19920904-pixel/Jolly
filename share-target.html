<!DOCTYPE html>
<html lang="az">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Paylaşım — JOLLY</title>
<meta name="theme-color" content="#06070d">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#06070d;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#12131c;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px 24px;width:100%;max-width:420px;text-align:center}
  .logo{font-size:1.5rem;font-weight:700;margin-bottom:8px;color:#00d4ff}
  .sub{color:rgba(255,255,255,0.5);font-size:0.875rem;margin-bottom:24px}
  .preview{width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.1);display:none}
  .info{background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.15);border-radius:12px;padding:16px;margin-bottom:16px;text-align:left}
  .info-row{display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:6px;color:rgba(255,255,255,0.6)}
  .info-row:last-child{margin-bottom:0}
  .info-label{color:rgba(255,255,255,0.35)}
  .btn{width:100%;padding:14px;border-radius:12px;border:none;font-size:0.95rem;font-weight:600;cursor:pointer;margin-bottom:10px}
  .btn-primary{background:#00d4ff;color:#06070d}
  .btn-secondary{background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.15)}
  .btn:disabled{opacity:0.4;cursor:not-allowed}
  .status{font-size:0.8rem;color:rgba(255,255,255,0.4);margin-top:8px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">👑 JOLLY</div>
  <div class="sub">Paylaşılan məhsul şəkli</div>
  <img class="preview" id="preview" alt="Preview">
  <div class="info" id="info" style="display:none">
    <div class="info-row"><span class="info-label">Başlıq:</span><span id="titleText">—</span></div>
    <div class="info-row"><span class="info-label">Mətn:</span><span id="textText">—</span></div>
    <div class="info-row"><span class="info-label">Fayl:</span><span id="fileText">—</span></div>
  </div>
  <button class="btn btn-primary" id="saveBtn" disabled onclick="saveProduct()">Məhsul olaraq saxla</button>
  <button class="btn btn-secondary" onclick="goHome()">Ana səhifəyə qayıt</button>
  <div class="status" id="status">Şəkil qəbul edilir...</div>
</div>

<script>
  // QEYD: bu səhifə hələ JollyDB-yə birbaşa yazmır — yalnız qəbul edib göstərir.
  // Real inteqrasiya üçün: window.opener/BroadcastChannel və ya localStorage
  // vasitəsilə app.js-ə ötürüb JollyDB.addProduct(...) çağırmaq lazımdır.

  let sharedImage = null;
  let sharedData = { title: '', text: '' };

  async function init() {
    const params = new URLSearchParams(window.location.search);
    sharedData.title = params.get('title') || '';
    sharedData.text = params.get('text') || '';

    if (sharedData.title || sharedData.text) {
      document.getElementById('info').style.display = 'block';
      document.getElementById('titleText').textContent = sharedData.title || '—';
      document.getElementById('textText').textContent = sharedData.text || '—';
      document.getElementById('saveBtn').disabled = false;
      document.getElementById('status').textContent = 'Məlumat hazırdır';
    } else {
      document.getElementById('status').textContent = 'Paylaşılan məlumat tapılmadı';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function saveProduct() {
    const status = document.getElementById('status');
    status.textContent = 'Ana səhifəyə yönləndirilir...';
    window.location.href = './index.html?action=add-product&shared=1&title=' +
      encodeURIComponent(sharedData.title) + '&text=' + encodeURIComponent(sharedData.text);
  }

  function goHome() {
    window.location.href = './index.html';
  }
</script>
</body>
</html>
