/* ============================================================
   JOLLY Qara Qutu (Black Box) — gizli diaqnostika jurnalı
   Hər klik, xəta, route dəyişməsi, funksiya çağırışını yazır.

   DƏYİŞİKLİK: Ekranda üzən 🐞 düyməsi ARTIQ YOXDUR — panel indi
   "🧰 Alətlər" menyusundan açılır (bax: tools-menu.js). Jurnalın
   özü (LOG) və yığılması eynən davam edir, dəyişməyib.
   ============================================================ */
(function () {
  const LOG = [];
  const MAX = 300;
  const t0 = Date.now();

  function ts() { return '+' + ((Date.now() - t0) / 1000).toFixed(1) + 's'; }
  function push(type, msg) {
    LOG.push(`[${ts()}] ${type}: ${msg}`);
    if (LOG.length > MAX) LOG.shift();
    updatePanel();
  }

  // 1) Bütün xətaları tut
  window.addEventListener('error', function (e) {
    push('❌XƏTA', (e.message || '') + ' @ ' + (e.filename ? e.filename.split('/').pop() : '?') + ':' + (e.lineno || '?'));
  });
  window.addEventListener('unhandledrejection', function (e) {
    push('❌PROMISE', (e.reason && e.reason.message) || String(e.reason));
  });

  // 2) Route dəyişmələri
  window.addEventListener('hashchange', function () {
    push('🔀ROUTE', window.location.hash);
    // Route dəyişəndən sonra main boşdursa xəbər ver
    setTimeout(function () {
      const m = document.getElementById('main');
      if (m && m.innerHTML.trim().length < 30) push('⚠️BOŞ', 'main boş qaldı (render işləmədi) route=' + window.location.hash);
    }, 200);
  });

  // 3) Bütün kliklər (hansı elementə basıldı, hansı onclick var)
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[onclick],button,.dash-card,.big-op,.more-card,.gp-stat,.nav-item,.chip,.list-row,a');
    if (!el) { push('👆TAP', 'boş yerə (' + (e.target.className || e.target.tagName) + ')'); return; }
    const oc = el.getAttribute('onclick');
    const cls = (el.className || '').toString().slice(0, 40);
    const txt = (el.textContent || '').trim().slice(0, 25);
    push('👆TAP', `<${el.tagName.toLowerCase()} class="${cls}"> "${txt}"` + (oc ? ' onclick=' + oc.slice(0, 60) : ' (onclick YOX)'));
  }, true);

  // 4) JollyRouter.go izləmə (əgər varsa)
  window.addEventListener('load', function () {
    setTimeout(function () {
      // Modul yoxlaması
      const mods = ['JollyDB','JollyRouter','JollyApp','JollyDashboard','JollyProducts','JollyStudios','JollyChat','JollyIcons','JollyStorage','JollyAICore','JollyDataDoctor'];
      const missing = mods.filter(m => typeof window[m] === 'undefined');
      push('📦MODUL', missing.length ? ('ƏSKİK: ' + missing.join(',')) : 'hamısı yükləndi ✓');

      // JollyRouter.go-nu sar ki, hər çağırışı görək
      if (window.JollyRouter && typeof JollyRouter.go === 'function') {
        const orig = JollyRouter.go;
        JollyRouter.go = function (h) {
          push('🚀GO', 'JollyRouter.go("' + h + '") çağırıldı');
          try { return orig.apply(this, arguments); }
          catch (err) { push('❌GO-XƏTA', err.message); throw err; }
        };
        push('🔧', 'JollyRouter.go izlənir');
      } else {
        push('❌', 'JollyRouter.go TAPILMADI');
      }
    }, 600);
  });

  push('🟢', 'Qara qutu başladı');

  /* ---------- Görünən panel (indi "Alətlər"dən açılır, üzən düymə yoxdur) ---------- */
  let open = false;
  function togglePanel() {
    open = !open;
    let p = document.getElementById('bbPanel');
    if (open) {
      if (!p) {
        p = document.createElement('div');
        p.id = 'bbPanel';
        p.style.cssText = 'position:fixed;inset:0;z-index:999998;background:#080810;color:#c8d0e8;font:11px monospace;padding:12px;overflow:auto;white-space:pre-wrap;';
        const bar = document.createElement('div');
        bar.style.cssText = 'position:sticky;top:0;background:#080810;padding-bottom:8px;display:flex;gap:8px;';
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Kopyala';
        copyBtn.style.cssText = 'flex:1;background:#7c5cff;color:#fff;border:none;padding:10px;border-radius:8px;font-size:13px;';
        copyBtn.onclick = function () {
          const txt = LOG.join('\n');
          if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function(){ copyBtn.textContent = '✓ Kopyalandı!'; setTimeout(function(){copyBtn.textContent='📋 Kopyala';},1500); });
          else { const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); copyBtn.textContent='✓ Kopyalandı!'; }
        };
        const clrBtn = document.createElement('button');
        clrBtn.textContent = '🗑 Təmizlə';
        clrBtn.style.cssText = 'background:#33334d;color:#fff;border:none;padding:10px 14px;border-radius:8px;font-size:13px;';
        clrBtn.onclick = function () { LOG.length = 0; updatePanel(); };
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:#33334d;color:#fff;border:none;padding:10px 14px;border-radius:8px;font-size:13px;';
        closeBtn.onclick = togglePanel;
        bar.appendChild(copyBtn); bar.appendChild(clrBtn); bar.appendChild(closeBtn);
        p.appendChild(bar);
        const content = document.createElement('div');
        content.id = 'bbContent';
        p.appendChild(content);
        document.body.appendChild(p);
      }
      p.style.display = 'block';
      updatePanel();
    } else if (p) {
      p.style.display = 'none';
    }
  }
  function updatePanel() {
    const c = document.getElementById('bbContent');
    if (c && open) c.textContent = LOG.join('\n');
  }

  // Diaqnostika mərkəzi (jolly-diagnostics.js) LOG-u oxuya bilsin deyə,
  // yalnız-oxu bir "pəncərə" açırıq — LOG-un özünə birbaşa toxunulmur.
  // "show" — tools-menu.js buradan çağırır (əvvəlki üzən 🐞 düyməsinin yerinə).
  window.JollyBlackBox = {
    getLog: function () { return LOG.slice(); },
    show: togglePanel,
  };
})();
