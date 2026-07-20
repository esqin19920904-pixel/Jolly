/* ============================================================
   JOLLY App — router və əsas tətbiq qabığı
   ============================================================ */

const JollyRouter = (() => {
  function go(hash) { window.location.hash = hash; }
  function parseQuery(str) {
    const params = {};
    if (!str) return params;
    str.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return params;
  }
  return { go, parseQuery };
})();

const JollyApp = (() => {
  const mainEl = () => document.getElementById('main');
  let navHistory = [];
  let lastRenderedHash = null;

  function goBack() {
    navHistory.pop(); // hazırkını çıxar
    const prev = navHistory.pop() || '#/dashboard';
    window.location.hash = prev;
  }

  function render() {
    const s = JollyDB.getSettings();
    const wantsMotion = s.animEnabled !== false;
    if (wantsMotion && document.startViewTransition) {
      try {
        const vt = document.startViewTransition(() => renderSafe());
        if (vt && vt.updateCallbackDone && vt.updateCallbackDone.catch) vt.updateCallbackDone.catch(() => {});
        if (vt && vt.finished && vt.finished.catch) vt.finished.catch(() => {});
      } catch (e) {
        renderSafe();
      }
    } else {
      renderSafe();
    }
  }

  function renderSafe() {
    try { renderInner(); } catch (e) {
      console.error('JOLLY render xətası:', e);
      const m = mainEl();
      if (m) m.innerHTML = `
        <div class="empty-state">
          <div class="big-icon">⚠️</div>
          <h3>Xəta baş verdi</h3>
          <p class="muted" style="font-size:12px;">${String(e.message || e).slice(0,120)}</p>
          <button class="btn btn-primary" style="margin-top:14px;" onclick="window.location.hash='#/dashboard';JollyApp.render();">🏠 İş masasına qayıt</button>
        </div>`;
    }
  }

  function renderInner() {
    const hash = window.location.hash || '#/dashboard';
    // tarixçəyə əlavə et (təkrar ard-arda olmasın)
    if (navHistory[navHistory.length - 1] !== hash) {
      navHistory.push(hash);
      if (navHistory.length > 30) navHistory.shift();
    }
    const [pathPart, queryPart] = hash.replace('#', '').split('?');
    const segments = pathPart.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    const params = JollyRouter.parseQuery(queryPart);

    const backBtn = document.getElementById('globalBackBtn');
    if (backBtn) {
      const isRoot = segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard');
      backBtn.style.display = isRoot ? 'none' : 'flex';
    }

    let html = '';
    let afterRender = null;
    let showFab = false;

    // ── YENİ: Modul Registry əvvəl yoxlanır ──
    if (typeof ModuleRegistry !== 'undefined') {
      const reg = ModuleRegistry.renderPage(hash);
      if (reg) {
        // Registry bu route-u tanıdı — modulu göstər
        const main = document.getElementById('main');
        if (main) main.innerHTML = reg.html;
        window.scrollTo(0, 0);
        if (reg.after) { try { reg.after(); } catch (e) {} }
        renderBottomNav();
        return; // köhnə route zəncirinə keçmə
      }
    }
    // ── Köhnə route sistemi (mövcud səhifələr) davam edir ──

    if (segments.length === 0 || segments[0] === 'dashboard' && segments.length === 1) {
      html = JollyDashboard.render();
    } else if (segments[0] === 'dashboard' && segments[1] === 'incomplete') {
      html = JollyDashboard.renderIncomplete();
    } else if (segments[0] === 'dashboard' && segments[1] === 'gallery') {
      html = JollyDashboard.renderGallery();
    } else if (segments[0] === 'dashboard' && segments[1] === 'recent') {
      html = JollyDashboard.renderRecent();
    } else if (segments[0] === 'dashboard' && segments[1] === 'studio') {
      html = JollyDashboard.renderStudio();
    } else if (segments[0] === 'dashboard' && segments[1] === 'trash') {
      html = JollyDashboard.renderTrash();
    } else if (segments[0] === 'dashboard' && segments[1] === 'favorites') {
      html = JollyDashboard.renderFavorites();
    } else if (segments[0] === 'home') {
      html = JollyProducts.renderHomePage();
      afterRender = JollyProducts.afterHomeRender;
      showFab = true;
    } else if (segments[0] === 'products') {
      html = JollyProducts.renderFilteredPage(params);
      showFab = true;
    } else if (segments[0] === 'scan') {
      setTimeout(() => { if (typeof JollyProducts !== 'undefined') JollyProducts.scanSearch(); }, 100);
      html = '<div class="empty-state"><div class="big-icon">📡</div><h3>Skan açılır...</h3><p>Kamera ilə barkod oxu.</p></div>';
    } else if (segments[0] === 'updates') {
      html = (typeof JollyOTA !== 'undefined') ? JollyOTA.render() : '<div class="empty-state"><div class="big-icon">🔄</div><h3>Yeniləmə modulu yüklənməyib</h3></div>';
    } else if (segments[0] === 'store-map') {
      html = (typeof JollyStoreMap !== 'undefined') ? JollyStoreMap.render(null) : '<div class="empty-state"><div class="big-icon">🗺️</div><h3>Xəritə yüklənməyib</h3></div>';
    } else if (segments[0] === 'chat') {
      html = (typeof JollyChat !== 'undefined') ? JollyChat.render() : '<div class="empty-state"><div class="big-icon">💬</div><h3>Chat yüklənməyib</h3></div>';
    } else if (segments[0] === 'data-doctor') {
      html = (typeof JollyDataDoctor !== 'undefined') ? JollyDataDoctor.render() : '<div class="empty-state"><div class="big-icon">🩺</div><h3>Data Doctor yüklənməyib</h3></div>';
    } else if (segments[0] === 'drafts') {
      html = JollyProducts.renderDraftsPage();
    } else if (segments[0] === 'product' && segments[1] === 'new') {
      html = JollyProducts.renderFormPage(null, params.draft || null);
      afterRender = JollyProducts.afterFormRender;
    } else if (segments[0] === 'product' && segments[2] === 'edit') {
      html = JollyProducts.renderFormPage(segments[1], null);
      afterRender = JollyProducts.afterFormRender;
    } else if (segments[0] === 'product') {
      html = JollyProducts.renderDetailPage(segments[1]);
    } else if (segments[0] === 'studios' && segments.length === 1) {
      html = JollyStudios.renderHome();
    } else if (segments[0] === 'studios' && segments[1] === 'admin' && segments.length === 2) {
      html = JollyAdminStudio.renderHome();
    } else if (segments[0] === 'studios' && segments[1] === 'admin' && segments.length === 3) {
      html = JollyAdminStudio.renderList(segments[2]);
    } else if (segments[0] === 'studios' && segments[1] === 'ai') {
      html = JollyStudios.renderAI();
    } else if (segments[0] === 'studios' && segments[1] === 'ai-brain') {
      html = (typeof JollyAIStudio !== 'undefined') ? JollyAIStudio.render() : '<div class="empty-state"><div class="big-icon">🧠</div><h3>AI Brain modulu yüklənməyib</h3></div>';
    } else if (segments[0] === 'studios' && segments[1] === 'module') {
      html = JollyStudios.renderModuleStudio();
    } else if (segments[0] === 'studios' && segments[1] === 'theme') {
      html = JollyStudios.renderTheme();
    } else if (segments[0] === 'studios' && segments[1] === 'data') {
      html = JollyStudios.renderData();
    } else if (segments[0] === 'studios' && segments[1] === 'security') {
      html = JollyStudios.renderSecurity();
    } else if (segments[0] === 'studios' && segments[1] === 'cloud') {
      html = JollyCloud.renderStudio();
    } else if (segments[0] === 'studios' && segments[1] === 'report') {
      html = JollyStudios.renderReport();
    } else if (segments[0] === 'studios' && segments[1] === 'workflow') {
      html = JollyWorkflow.renderStudio();
    } else if (segments[0] === 'studios' && segments[1] === 'code') {
      html = JollyCodeStudio.renderStudio();
    } else if (segments[0] === 'notifications') {
      html = JollyWorkflow.renderNotifications();
      setTimeout(() => renderNotifBell(), 500);
    } else if (segments[0] === 'brain' && segments.length === 1) {
      html = JollyBrain.renderCenter();
    } else if (segments[0] === 'brain' && segments[1] === 'duplicates') {
      html = JollyBrain.renderDuplicates();
    } else if (segments[0] === 'brain' && segments[1] === 'cleanup') {
      html = JollyBrain.renderCleanup();
    } else if (segments[0] === 'brain' && segments[1] === 'stale') {
      html = JollyBrain.renderStale();
    } else if (segments[0] === 'studios' && segments[1] === 'integration') {
      html = JollyStudios.renderIntegration();
    } else if (segments[0] === 'studios' && segments[1] === 'voicevision') {
      html = JollyStudios.renderComingSoon('voicevision');
    } else if (segments[0] === 'studios' && segments[1] === 'analytics') {
      html = JollyStudios.renderComingSoon('analytics');
    } else if (segments[0] === 'studios' && segments[1] === 'print') {
      html = JollyStudios.renderComingSoon('print');
    } else if (segments[0] === 'insight') {
      html = JollyInsight.render();
    } else if (segments[0] === 'studios') {
      html = JollyStudios.renderComingSoon(segments[1]);
    } else {
      html = `<div class="empty-state"><div class="big-icon">🧭</div><h3>Səhifə tapılmadı</h3></div>`;
    }

    mainEl().innerHTML = html;
    const s = JollyDB.getSettings();
    if (s.animEnabled !== false && lastRenderedHash !== hash) {
      mainEl().classList.remove('page-enter');
      void mainEl().offsetWidth;
      mainEl().classList.add('page-enter');
    }
    lastRenderedHash = hash;
    if (afterRender) afterRender();
    if (typeof JollyStorage !== 'undefined') setTimeout(() => JollyStorage.hydrate(), 0);
    if (typeof JollyQuick !== 'undefined') JollyQuick.updateFab(hash);
    // məhsul baxışını izlə
    const pv = hash.match(/#\/product\/([^\/]+)$/);
    if (pv && typeof JollyQuick !== 'undefined') JollyQuick.trackView(decodeURIComponent(pv[1]));
    renderFab(showFab);
    renderBottomNav();
    window.scrollTo(0, 0);
  }

  // Ripple click effekti
  function attachRipple() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('.btn, .icon-btn, .dash-card, .chip, .nav-item');
      if (!t) return;
      const s = JollyDB.getSettings();
      if (s.animEnabled === false) return;
      const r = document.createElement('span');
      r.className = 'ripple';
      const rect = t.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      r.style.width = r.style.height = size + 'px';
      r.style.left = (e.clientX - rect.left - size / 2) + 'px';
      r.style.top = (e.clientY - rect.top - size / 2) + 'px';
      t.appendChild(r);
      setTimeout(() => r.remove(), 500);
    });
  }

  /* --- Premium effektlər --- */
  function fxEnabled() {
    const s = JollyDB.getSettings();
    return s.fxEnabled !== false && s.animEnabled !== false;
  }

  // Konfetti partlayışı (uğurlu saxlamada)
  function confetti() {
    if (!fxEnabled()) return;
    const colors = ['#7c8aff', '#5eeac3', '#ffb84d', '#ff5c78', '#c792ea'];
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.background = colors[i % colors.length];
      p.style.borderRadius = i % 2 ? '50%' : '2px';
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.5;
      const dist = 90 + Math.random() * 110;
      p.style.setProperty('--cx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--cy', (Math.sin(angle) * dist + 120) + 'px');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 950);
    }
  }

  // Böyük yaşıl checkmark
  function checkPop() {
    if (!fxEnabled()) return;
    const el = document.createElement('div');
    el.className = 'check-pop';
    el.innerHTML = '<div class="circle"><div class="mark">✅</div></div>';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 550);
  }

  function celebrate() { confetti(); checkPop(); }

  /* --- Backup göstəricisi: yaşıl=qaydasında, sarı=dəyişiklik var, qırmızı=çoxdan yoxdur --- */
  function renderBackupPill() {
    const dot = document.getElementById('backupDot');
    if (!dot) return;
    const s = JollyDB.getSettings();
    const last = s.lastBackup || 0;
    const lastChange = parseInt(localStorage.getItem('jolly_last_change') || '0', 10);
    const days = (Date.now() - last) / 864e5;
    dot.className = 'backup-dot';
    if (!last || days >= 7) dot.classList.add('danger');       // heç olmayıb / 7+ gün
    else if (lastChange > last) dot.classList.add('warn');      // backup-dan sonra dəyişiklik var
    // əks halda yaşıl qalır
  }

  // Loading göstəricisi
  function showLoader() {
    if (document.getElementById('jollyLoader')) return;
    const l = document.createElement('div');
    l.id = 'jollyLoader';
    l.className = 'jolly-loader';
    l.innerHTML = '<div class="loader-rings"><div class="loader-ring"></div><div class="loader-ring"></div><div class="loader-ring"></div><div class="loader-center">🧠</div></div><div class="jl-logo" style="margin-top:16px;">JOLLY</div>';
    document.body.appendChild(l);
  }
  function hideLoader() {
    const l = document.getElementById('jollyLoader');
    if (l) l.remove();
  }

  function renderFab() { /* Quick FAB istifadə olunur */ }

  function navIconFor(id) {
    const map = { dashboard: 'home', home: 'home', products: 'box', scan: 'scancenter', ai: 'brain', studios: 'grid' };
    const name = map[id] || 'box';
    return (typeof JollyIcons !== 'undefined') ? JollyIcons.get(name) : '';
  }

  function renderBottomNav() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    const hash = window.location.hash || '#/home';
    const items = JollyStudios.getNavConfig().filter(n => n.visible !== false);
    nav.innerHTML = items.map(it => `
      <div class="nav-item ${routeMatches(it.id, hash) ? 'active' : ''}" onclick="JollyRouter.go('${routeFor(it.id)}')">
        <span class="nav-icon">${navIconFor(it.id)}</span>
        <span>${it.label}</span>
      </div>
    `).join('');
  }

  function routeFor(id) {
    return { dashboard: '#/dashboard', home: '#/home', products: '#/products', scan: '#/scan', ai: '#/studios/ai', studios: '#/studios' }[id] || '#/dashboard';
  }
  function routeMatches(id, hash) {
    if (id === 'dashboard') return hash === '#/dashboard' || hash === '' || hash === '#/' || hash.startsWith('#/dashboard');
    if (id === 'home') return hash === '#/home' || hash.startsWith('#/product/');
    if (id === 'products') return hash.startsWith('#/products') || hash === '#/drafts';
    if (id === 'scan') return hash === '#/scan';
    if (id === 'ai') return hash.startsWith('#/studios/ai');
    if (id === 'studios') return hash.startsWith('#/studios') && !hash.startsWith('#/studios/ai');
    return false;
  }

  function checkPinLock() {
    const settings = JollyDB.getSettings();
    if (!settings.pinEnabled || !settings.pin) return true;
    try { if (sessionStorage.getItem('jolly_pin_ok') === '1') return true; } catch (e) {}
    // Gözəl qızıl kilid ekranı
    showLockScreen(settings.pin);
    return false; // init dayanır, PIN düz olanda davam edir
  }

  function showLockScreen(correctPin) {
    let entered = '';
    const overlay = document.createElement('div');
    overlay.id = 'jollyLock';
    overlay.innerHTML = `
      <div class="lock-inner">
        <div class="lock-crown">👑</div>
        <div class="lock-logo">JOLLY</div>
        <div class="lock-sub">Kodsuz Mallar Pro</div>
        <div class="lock-title">PIN daxil et</div>
        <div class="lock-dots" id="lockDots">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="lock-err" id="lockErr"></div>
        <div class="lock-pad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="lock-key" data-n="${n}">${n}</button>`).join('')}
          <button class="lock-key lock-empty"></button>
          <button class="lock-key" data-n="0">0</button>
          <button class="lock-key lock-del" data-del="1">⌫</button>
        </div>
        <div class="lock-forgot" id="lockForgot">PIN-i unutmusan?</div>
      </div>
    `;
    document.body.appendChild(overlay);

    function updateDots() {
      const dots = overlay.querySelectorAll('#lockDots span');
      dots.forEach((d, i) => d.classList.toggle('filled', i < entered.length));
    }
    function check() {
      if (entered.length === correctPin.length) {
        let matchedUser = null;
        let ok = (entered === correctPin);
        if (!ok && window.JollyUsers) {
          matchedUser = JollyUsers.verifyPin(entered);
          if (matchedUser) ok = true;
        }
        if (ok) {
          try {
            sessionStorage.setItem('jolly_sec_session', JSON.stringify({
              role: matchedUser ? 'user' : 'admin',
              at: Date.now(),
              userId: matchedUser ? matchedUser.id : null,
              userName: matchedUser ? matchedUser.name : null,
            }));
          } catch (e) {}
          overlay.classList.add('unlocked');
          setTimeout(() => { overlay.remove(); continueInit(); }, 350);
        } else {
          const err = overlay.querySelector('#lockErr');
          err.textContent = 'PIN yanlışdır';
          overlay.querySelector('.lock-inner').classList.add('shake');
          if (typeof JollySound !== 'undefined') JollySound.error();
          setTimeout(() => { entered = ''; updateDots(); err.textContent = ''; overlay.querySelector('.lock-inner').classList.remove('shake'); }, 700);
        }
      }
    }
    overlay.addEventListener('click', (e) => {
      const forgot = e.target.closest('#lockForgot');
      if (forgot) {
        const settings = JollyDB.getSettings();
        const rec = settings.pinRecovery;
        if (rec && rec.q) {
          const ans = prompt('Təhlükəsizlik sualı:\n' + rec.q);
          if (ans != null && ans.trim().toLowerCase() === String(rec.a).trim().toLowerCase()) {
            const ns = JollyDB.getSettings(); ns.pinEnabled = false; ns.pin = ''; JollyDB.saveSettings ? JollyDB.saveSettings(ns) : JollyDB.write('settings', ns);
            alert('PIN sıfırlandı. Ayarlardan yeni PIN təyin edə bilərsən.');
            try { sessionStorage.setItem('jolly_pin_ok', '1'); } catch (er) {}
            location.reload();
          } else {
            alert('Cavab yanlışdır.');
          }
        } else {
          // Recovery təyin olunmayıbsa: məlumatı qorumaqla sıfırlama üçün xəbərdarlıq
          if (confirm('Bərpa sualı təyin edilməyib. PIN-i sıfırlamaq üçün "OK" bas (məhsullarına toxunulmur, yalnız PIN silinir).')) {
            const ns = JollyDB.getSettings(); ns.pinEnabled = false; ns.pin = ''; JollyDB.saveSettings ? JollyDB.saveSettings(ns) : JollyDB.write('settings', ns);
            try { sessionStorage.setItem('jolly_pin_ok', '1'); } catch (er) {}
            location.reload();
          }
        }
        return;
      }
      const key = e.target.closest('.lock-key');
      if (!key) return;
      if (typeof JollySound !== 'undefined') JollySound.tap();
      if (key.dataset.del) { entered = entered.slice(0, -1); updateDots(); return; }
      if (key.dataset.n == null) return;
      if (entered.length < correctPin.length) { entered += key.dataset.n; updateDots(); check(); }
    });
  }

  function continueInit() {
    // PIN düz oldu — səhifəni yenidən yüklə (init təmiz başlasın, bu dəfə PIN keçiləcək)
    try { sessionStorage.setItem('jolly_pin_ok', '1'); } catch (e) {}
    location.reload();
  }

  function renderNotifBell() {
    const bell = document.getElementById('notifBell');
    if (!bell) return;
    const count = (typeof JollyWorkflow !== 'undefined') ? JollyWorkflow.unreadCount() : 0;
    bell.innerHTML = count > 0
      ? `🔔<span class="badge-pulse" style="position:absolute;top:2px;right:2px;background:var(--accent-danger);color:#fff;font-size:9px;min-width:15px;height:15px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;">${count > 9 ? '9+' : count}</span>`
      : '🔔';
  }

  function init() {
    JollyDB.seedIfEmpty();
    // Topbar konturlu ikonları yerləşdir
    if (typeof JollyIcons !== 'undefined') {
      const bi = document.getElementById('taBellIcon'); if (bi) bi.innerHTML = JollyIcons.get('bell');
      const br = document.getElementById('taBrainIcon'); if (br) br.innerHTML = JollyIcons.get('brain');
      const gr = document.getElementById('taGearIcon'); if (gr) gr.innerHTML = JollyIcons.get('gear');
    }
    const repaired = JollyDB.repairIds();
    if (repaired > 0 && typeof Toast !== 'undefined') {
      setTimeout(() => Toast.success(`${repaired} məhsul bərpa olundu ✓`), 800);
    }
    if (!checkPinLock()) return;
    JollyStudios.applySavedTheme();
    if (typeof JollyCodeStudio !== 'undefined') JollyCodeStudio.runEnabledSnippets();
    if (typeof JollyWorkflow !== 'undefined') JollyWorkflow.runOnStartup();
    // Köhnə şəkilləri IndexedDB-yə köçür (bir dəfə), sonra ekranı yenilə
    if (typeof JollyStorage !== 'undefined') {
      JollyStorage.migrateOldImages().then(() => JollyStorage.hydrate());
    }
    if (typeof JollyCloud !== 'undefined') JollyCloud.initAutoSync();
    if (typeof JollyOTA !== 'undefined') JollyOTA.autoCheck();
    // Avtomatik snapshot (gündə bir dəfə, qəza geri qaytarma üçün)
    try {
      const snap = JollyDB.read('jolly_snapshot', null);
      const dayMs = 864e5;
      if (!snap || (Date.now() - snap.ts) > dayMs) {
        if (typeof JollyStudios !== 'undefined' && JollyStudios.saveSnapshot) JollyStudios.saveSnapshot();
      }
      // Backup xatırlatması
      const s = JollyDB.getSettings();
      if (s.backupReminder !== false && JollyDB.Products.all().length > 0) {
        const last = s.lastBackup || 0;
        if ((Date.now() - last) > 7 * dayMs && typeof JollyWorkflow !== 'undefined') {
          const notifs = JollyDB.read('jolly_notifications', []);
          if (!notifs.some(n => n.text && n.text.includes('Backup vaxtıdır') && !n.read)) {
            notifs.unshift({ id: JollyDB.uid('ntf'), text: '💾 Backup vaxtıdır — məlumatlarını qoru', route: '#/studios/data', ts: Date.now(), read: false });
            JollyDB.write('jolly_notifications', notifs);
          }
        }
      }
    } catch (e) {}
    window.addEventListener('hashchange', render);
    render();
    renderNotifBell();
    if (typeof JollyWorkflow !== 'undefined' && JollyWorkflow.unreadCount() > 0) {
      setTimeout(() => { const b = document.getElementById('notifBell'); if (b) { b.classList.add('bell-shake'); setTimeout(() => b.classList.remove('bell-shake'), 600); } }, 900);
    }

    JollyEdgePanel.initDraggableTab();
    document.getElementById('edgeScrim').addEventListener('click', JollyEdgePanel.close);
    document.getElementById('topAiBtn').addEventListener('click', () => JollyRouter.go('#/studios/ai'));
    document.getElementById('topStudiosBtn').addEventListener('click', () => JollyRouter.go('#/studios'));
    // Animasiya ayarı
    const s0 = JollyDB.getSettings();
    if (s0.animEnabled === false) document.body.classList.add('no-anim');
    if (s0.fxEnabled === false) document.body.classList.add('fx-off');
    attachRipple();

    // Səs kilidini ilk toxunuşda aç (brauzer tələbi)
    document.addEventListener('touchstart', function unlockAudio() {
      if (typeof JollySound !== 'undefined') { try { JollySound.tone(1, 0.01, 'sine', 0.001); } catch (e) {} }
      document.removeEventListener('touchstart', unlockAudio);
    }, { once: true, passive: true });

    const notifBtn = document.getElementById('notifBell');
    if (notifBtn) notifBtn.addEventListener('click', () => JollyRouter.go('#/notifications'));
    const backBtn = document.getElementById('globalBackBtn');
    if (backBtn) backBtn.addEventListener('click', goBack);
    const logoBtn = document.getElementById('logoHome');
    if (logoBtn) logoBtn.addEventListener('click', () => JollyRouter.go('#/dashboard'));

    // Backup pill — bir kliklə yaddaşa yaz
    const cmdB = document.getElementById('cmdBtn');
    if (cmdB) cmdB.addEventListener('click', () => JollyCommand && JollyCommand.show());

    const bPill = document.getElementById('backupPill');
    if (bPill) bPill.addEventListener('click', () => {
      if (typeof JollyStudios !== 'undefined' && JollyStudios.exportBackup) {
        JollyStudios.exportBackup();
        if (typeof JollyApp !== 'undefined' && JollyApp.celebrate) setTimeout(celebrate, 300);
        setTimeout(renderBackupPill, 500);
      }
    });
    renderBackupPill();
    if (typeof JollyStorage !== 'undefined' && JollyStorage.initAutoHydrate) JollyStorage.initAutoHydrate();
    if (typeof JollyViewer !== 'undefined' && JollyViewer.initPeek) JollyViewer.initPeek();
    if (typeof JollyUXPro !== 'undefined' && JollyUXPro.initLongPress) JollyUXPro.initLongPress();
    if (typeof JollyFXEngine !== 'undefined') { JollyFXEngine.initAurora(); JollyFXEngine.initTouchParticles(); }
    if (typeof JollyQuick !== 'undefined') JollyQuick.render();
  }

  return { render, renderBottomNav, renderNotifBell, goBack, showLoader, hideLoader, confetti, checkPop, celebrate, renderBackupPill, init };
})();

document.addEventListener('DOMContentLoaded', () => {
  // Premium splash — sessiyada bir dəfə
  try {
    if (!sessionStorage.getItem('jolly_splash_shown')) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const el = document.createElement('div');
      el.id = 'jollySplash';
      el.innerHTML = `
        <div class="splash-ring"></div>
        <div class="splash-core">
          <div class="splash-crown">👑</div>
          <div class="splash-logo">JOLLY</div>
          <div class="splash-os">STORE OS</div>
          <div class="splash-diamond">◈</div>
        </div>
        <div class="splash-welcome">WELCOME</div>
      `;
      document.body.prepend(el);
      sessionStorage.setItem('jolly_splash_shown', '1');
      setTimeout(() => { el.classList.add('splash-hidden'); setTimeout(() => el.remove(), 550); }, reduced ? 600 : 2600);
    }
  } catch (e) {}
  JollyApp.init();
});
