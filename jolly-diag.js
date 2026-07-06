/* ============================================================
   JOLLY Diaqnostika — xətaları ekranda göstərir
   Bu fayl index.html-də ƏN BİRİNCİ script olmalıdır.
   Problem tapılandan sonra silinə bilər.
   ============================================================ */
(function () {
  const errors = [];
  window.addEventListener('error', function (e) {
    const msg = e.message + (e.filename ? ' @ ' + e.filename.split('/').pop() : '') + (e.lineno ? ':' + e.lineno : '');
    errors.push(msg);
    showBox();
  });

  // Hər modulun yüklənib-yüklənmədiyini yoxla
  window.addEventListener('load', function () {
    setTimeout(function () {
      const check = {
        'JollyDB': typeof JollyDB, 'JollyRouter': typeof JollyRouter, 'JollyApp': typeof JollyApp,
        'JollyDashboard': typeof JollyDashboard, 'JollyProducts': typeof JollyProducts,
        'JollyStudios': typeof JollyStudios, 'JollyChat': typeof JollyChat, 'JollyIcons': typeof JollyIcons,
        'JollyAIDaily': typeof JollyAIDaily, 'JollyProductDNA': typeof JollyProductDNA,
        'JollyStoreMap': typeof JollyStoreMap, 'JollyAICore': typeof JollyAICore,
        'JollyGemini': typeof JollyGemini, 'JollyStorage': typeof JollyStorage,
      };
      const missing = Object.keys(check).filter(k => check[k] === 'undefined');
      if (missing.length) {
        errors.push('YÜKLƏNMƏYƏN MODULLAR: ' + missing.join(', '));
        showBox();
      }
    }, 500);
  });

  function showBox() {
    let box = document.getElementById('jollyDiagBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'jollyDiagBox';
      box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#2a0a0a;color:#ff9999;font:12px monospace;padding:12px;max-height:50vh;overflow:auto;border-bottom:2px solid #ff3b3b;white-space:pre-wrap;';
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:bold;color:#fff;margin-bottom:8px;';
      title.textContent = '🔴 JOLLY Diaqnostika — bu mətni skrinşot at:';
      box.appendChild(title);
      const content = document.createElement('div');
      content.id = 'jollyDiagContent';
      box.appendChild(content);
      const btn = document.createElement('button');
      btn.textContent = 'Bağla';
      btn.style.cssText = 'margin-top:8px;background:#ff3b3b;color:#fff;border:none;padding:6px 14px;border-radius:6px;';
      btn.onclick = function () { box.remove(); };
      box.appendChild(btn);
      document.body.appendChild(box);
    }
    document.getElementById('jollyDiagContent').textContent = errors.join('\n\n');
  }
})();
