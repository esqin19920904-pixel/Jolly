/* ============================================================
   JOLLY App — router və əsas tətbiq qabığı

   YENİ (2026-07-21): Fəaliyyətsizlikdən sonra avtomatik kilid —
   toxunma/klik/klaviatura/sürüşdürmə "fəaliyyət" sayılır. Security
   Studio-da seçilmiş dəqiqə (settings.autoLockMinutes) ərzində heç
   bir fəaliyyət olmasa və PIN qoruması aktivdirsə, sessiya özü
   sıfırlanır və kilid ekranı yenidən göstərilir.
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
      if (window.JollyAuth && !JollyAuth.can('products.create')) {
        html = `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3><p class="muted" style="font-size:12px;">Məhsul əlavə etmək icazən yoxdur. Admin-dən soruş.</p></div>`;
      } else {
        html = JollyProducts.renderFormPage(null, params.draft || null);
        afterRender = JollyProducts.afterFormRender;
      }
    } else if (segments[0] === 'product' && segments[2] === 'edit') {
      if (window.JollyAuth && !JollyAuth.can('products.edit')) {
        html = `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3><p class="muted" style="font-size:12px;">Məhsul redaktə etmək icazən yoxdur. Admin-dən soruş.</p></div>`;
      } else {
        html = JollyProducts.renderFormPage(segments[1], null);
        afterRender = JollyProducts.afterFormRender;
      }
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
    } else if (segments[0] === 'studios' && segments[1] === 'changelog') {
      html = JollyDashboard.renderChangelogStudio();
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
  /* --- Arxa plan sinxronu: başqa cihazlarda əlavə olunan yeni qeydləri
     sakitcə çəkir, mövcud lokal datanı əvəz etmir ---
     DÜZƏLİŞ (2026-07-22): silinmiş (Trash-dəki) məhsulları TƏKRAR
     əlavə ETMİR — əvvəl bu, silinən kimi məhsulu "yeni/əskik" sanıb
     geri qaytarırdı, çünki bulud silinməni hələ görməmiş olur (push
     4 saniyəlik gecikmə ilə gedir). İndi Trash-də olan ID-lər həmişə
     istisna edilir, silinmə bulud tərəfə çatana qədər. */
  function silentCloudMerge() {
    if (typeof JollyCloud === 'undefined' || !JollyCloud.enabled() || !navigator.onLine) return;
    JollyCloud.pull().then(payload => {
      if (!payload || !payload.data) return;
      let addedProducts = 0;
      const trashIds = new Set((JollyDB.read(JollyDB.KEYS.trash, []) || []).map(x => x && x.id));
      const mergeArray = (key, cloudArr) => {
        if (!Array.isArray(cloudArr)) return;
        const local = JollyDB.read(key, []);
        const localIds = new Set(local.map(x => x && x.id));
        const missing = cloudArr.filter(x => {
          if (!x || !x.id || localIds.has(x.id)) return false;
          if (key === JollyDB.KEYS.products && trashIds.has(x.id)) return false;
          if (JollyDB.isTombstoned && JollyDB.isTombstoned(key, x.id)) return false;
          return true;
        });
        if (missing.length) {
          JollyDB.write(key, [...local, ...missing]);
          if (key === JollyDB.KEYS.products) addedProducts += missing.length;
        }
      };
      mergeArray(JollyDB.KEYS.products, payload.data.products);
      mergeArray(JollyDB.KEYS.brands, payload.data.brands);
      mergeArray(JollyDB.KEYS.groups, payload.data.groups);
      mergeArray(JollyDB.KEYS.locations, payload.data.locations);
      mergeArray(JollyDB.KEYS.statuses, payload.data.statuses);
      mergeArray(JollyDB.KEYS.changelog, payload.data.changelog);
      mergeArray(JollyDB.KEYS.changelogReads, payload.data.changelogReads);
      // İcazələr — Admin mənbədir, birbaşa yenisi ilə əvəz edilir (əlavə
      // deyil), ona görə ayrıca (ID əsaslı deyil). AMMA: lokalda hələ
      // buluda göndərilməmiş (pending) dəyişiklik varsa, ÜSTÜNƏ YAZMA —
      // yoxsa indicə verilmiş icazə dəyişikliyi köhnə bulud versiyası
      // ilə səssizcə geri qayıdar.
      const pending = typeof JollyCloud.isPendingSync === 'function' && JollyCloud.isPendingSync();
      if (payload.data.permissions && !pending) {
        try { JollyDB.write(JollyDB.KEYS.permissions, payload.data.permissions); } catch (e) {}
      }
      if (addedProducts > 0) {
        if (typeof Toast !== 'undefined') Toast.info(`🔄 ${addedProducts} yeni məhsul sinxronlaşdı`);
        render();
      }
    }).catch(() => {});
  }

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
    let identity = null; // { type:'admin' } və ya { type:'user', id, name }
    const overlay = document.createElement('div');
    overlay.id = 'jollyLock';
    document.body.appendChild(overlay);

    // Cosmic Galaxy — ulduzlar + kometa (bir dəfə yaradılır, ekranlar arası qalır)
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('div');
      s.className = 'lock-star';
      const size = Math.random() * 2 + 0.5;
      s.style.width = s.style.height = size + 'px';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.top = Math.random() * 100 + 'vh';
      s.style.animationDelay = (Math.random() * 2.5) + 's';
      overlay.appendChild(s);
    }
    const comet = document.createElement('div');
    comet.className = 'lock-comet';
    overlay.appendChild(comet);

    const contentEl = document.createElement('div');
    contentEl.className = 'lock-content-layer';
    overlay.appendChild(contentEl);

    function initials(name) { return (name || '?').trim().charAt(0).toUpperCase(); }

    function renderNameScreen() {
      const users = (window.JollyUsers ? JollyUsers.list() : []).filter(u => u.status === 'active');
      contentEl.innerHTML = `
        <div class="lock-inner">
          <div class="lock-crown-zone"><div class="lock-ring"></div><div class="lock-crown">👑</div></div>
          <div class="lock-logo" data-text="JOLLY">JOLLY</div>
          <div class="lock-sub">Kodsuz Mallar Pro</div>
          <div class="lock-title" style="margin-bottom:18px;">Kimsən?</div>
          <div id="lockUserList" style="display:flex;flex-direction:column;gap:10px;max-width:320px;margin:0 auto;">
            <div class="lock-user-card" data-type="admin" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,184,77,0.25);cursor:pointer;">
              <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f97316);display:flex;align-items:center;justify-content:center;font-weight:700;color:#000;">👑</div>
              <div style="font-weight:600;color:#fff;">Admin</div>
            </div>
            ${users.map(u => `
              <div class="lock-user-card" data-type="user" data-id="${u.id}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;">
                <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#6366f1);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;">${initials(u.name)}</div>
                <div style="font-weight:600;color:#fff;">${u.name}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      overlay.querySelectorAll('.lock-user-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (typeof JollySound !== 'undefined') JollySound.tap();
          const rect = card.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height) * 1.4;
          const ripple = document.createElement('span');
          ripple.className = 'lock-ripple';
          ripple.style.width = ripple.style.height = size + 'px';
          const rx = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
          const ry = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
          ripple.style.left = rx + 'px';
          ripple.style.top = ry + 'px';
          card.appendChild(ripple);
          setTimeout(() => ripple.remove(), 650);

          const type = card.dataset.type;
          if (type === 'admin') {
            identity = { type: 'admin' };
          } else {
            const u = JollyUsers.get(card.dataset.id);
            identity = { type: 'user', id: card.dataset.id, name: u ? u.name : 'İstifadəçi' };
          }
          entered = '';
          setTimeout(() => renderPinScreen(), 140);
        });
      });
    }

    function bioKey() { return identity.type === 'admin' ? 'admin' : ('user:' + identity.id); }

    function renderPinScreen() {
      const isAdmin = identity.type === 'admin';
      const bioAvailable = window.JollyBiometric && JollyBiometric.isRegistered(bioKey());
      contentEl.innerHTML = `
        <div class="lock-inner">
          <div class="lock-back" id="lockBackBtn" style="text-align:left;color:rgba(255,255,255,0.4);font-size:13px;cursor:pointer;margin-bottom:10px;">‹ Geri</div>
          <div style="width:56px;height:56px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.3rem;color:${isAdmin ? '#000' : '#fff'};background:${isAdmin ? 'linear-gradient(135deg,#fbbf24,#f97316)' : 'linear-gradient(135deg,#00d4ff,#6366f1)'};">${isAdmin ? '👑' : initials(identity.name)}</div>
          <div class="lock-logo" style="font-size:1.1rem;">${isAdmin ? 'Admin' : identity.name}</div>
          <div class="lock-title">PIN daxil et</div>
          <div class="lock-dots" id="lockDots">
            ${Array(isAdmin ? (isHashedPin(correctPin) ? 7 : correctPin.length) : 7).fill('<span></span>').join('')}
          </div>
          <div class="lock-err" id="lockErr"></div>
          <div class="lock-pad">
            ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="lock-key" data-n="${n}">${n}</button>`).join('')}
            <button class="lock-key lock-empty"></button>
            <button class="lock-key" data-n="0">0</button>
            <button class="lock-key lock-del" data-del="1">⌫</button>
          </div>
          ${bioAvailable ? `
          <div class="lock-bio-zone" id="lockBioBtn">
            <div class="lock-bio-ripples"><span></span><span></span><span></span></div>
            <div class="lock-bio-beam"></div>
            <svg class="lock-bio-svg" viewBox="0 0 100 100">
              <path d="M50 20 C 30 20, 20 35, 20 50 C 20 68, 32 78, 45 80"/>
              <path d="M50 26 C 34 26, 26 38, 26 50 C 26 64, 36 72, 48 74"/>
              <path d="M50 32 C 38 32, 32 41, 32 50 C 32 60, 40 66, 50 68"/>
              <path d="M50 38 C 42 38, 38 44, 38 50 C 38 57, 44 61, 50 62"/>
              <path d="M50 20 C 70 20, 80 35, 80 50 C 80 62, 73 71, 63 76"/>
              <path d="M50 26 C 66 26, 74 38, 74 50 C 74 60, 68 67, 60 71"/>
              <path d="M50 32 C 62 32, 68 41, 68 50 C 68 57, 63 63, 56 66"/>
              <path d="M50 12 L50 18"/>
            </svg>
          </div>
          <div class="lock-bio-caption">BARMAQ İZİ İLƏ AÇ</div>` : ''}
          ${isAdmin ? `<div class="lock-forgot" id="lockForgot">PIN-i unutmusan?</div>` : `<div class="lock-forgot" style="opacity:0.5;cursor:default;">PIN-i unutmusansa, Admin-dən istə</div>`}
        </div>
      `;
      const backBtn = document.getElementById('lockBackBtn');
      if (backBtn) backBtn.addEventListener('click', renderNameScreen);
      const bioBtn = document.getElementById('lockBioBtn');
      if (bioBtn) {
        bioBtn.addEventListener('click', async () => {
          bioBtn.classList.add('scanning');
          const matchedUser = identity.type === 'user' ? (window.JollyUsers ? JollyUsers.get(identity.id) : null) : null;
          const okBio = await JollyBiometric.authenticate(bioKey());
          if (okBio) {
            unlockSuccess(matchedUser);
          } else {
            bioBtn.classList.remove('scanning');
            const err = overlay.querySelector('#lockErr');
            if (err) err.textContent = 'Barmaq izi tanınmadı';
          }
        });
      }
      bindPinEvents();
    }

    function updateDots() {
      const dots = overlay.querySelectorAll('#lockDots span');
      dots.forEach((d, i) => d.classList.toggle('filled', i < entered.length));
    }

    function hashPin(s) {
      let h = 0x811c9dc5;
      for (let i = 0; i < String(s).length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
      return h.toString(16).padStart(8, '0');
    }
    function isHashedPin(v) { return /^[0-9a-f]{8}$/.test(String(v)); }

    function unlockSuccess(matchedUser) {
      try {
        sessionStorage.setItem('jolly_sec_session', JSON.stringify({
          role: matchedUser ? 'user' : 'admin',
          at: Date.now(),
          userId: matchedUser ? matchedUser.id : null,
          userName: matchedUser ? matchedUser.name : null,
        }));
      } catch (e) {}
      if (window.JollyEvents) {
        JollyEvents.emit('user.login', {
          role: matchedUser ? 'user' : 'admin',
          name: matchedUser ? matchedUser.name : 'Admin',
          userId: matchedUser ? matchedUser.id : null,
        });
      }
      overlay.classList.add('unlocked');
      setTimeout(() => { overlay.remove(); continueInit(); }, 350);
    }

    function check() {
      const adminIsHashed = identity.type === 'admin' && isHashedPin(correctPin);
      const expectedLen = identity.type === 'admin' ? (adminIsHashed ? 7 : correctPin.length) : 7;
      if (entered.length !== expectedLen) return;

      let matchedUser = null;
      let ok = false;
      let needsMigration = false;
      if (identity.type === 'admin') {
        if (adminIsHashed) {
          ok = (hashPin(entered) === correctPin);
        } else {
          // Köhnə, hash-lənməmiş PIN — uyğun gəlirsə keçir və dərhal hash-a köçür
          ok = (entered === correctPin);
          needsMigration = ok;
        }
      } else if (window.JollyUsers) {
        matchedUser = JollyUsers.verifyUserPin(identity.id, entered);
        ok = !!matchedUser;
      }

      if (ok && needsMigration) {
        try {
          const ns = JollyDB.getSettings();
          ns.pin = hashPin(entered);
          JollyDB.saveSettings ? JollyDB.saveSettings(ns) : JollyDB.write('settings', ns);
        } catch (e) {}
      }

      if (ok) {
        if (window.JollyBiometric && JollyBiometric.isSupported() && !JollyBiometric.isRegistered(bioKey())) {
          JollyBiometric.offerRegister(bioKey(), () => unlockSuccess(matchedUser));
        } else {
          unlockSuccess(matchedUser);
        }
      } else {
        const err = overlay.querySelector('#lockErr');
        err.textContent = 'PIN yanlışdır';
        overlay.querySelector('.lock-inner').classList.add('shake');
        if (typeof JollySound !== 'undefined') JollySound.error();
        setTimeout(() => { entered = ''; updateDots(); if (err) err.textContent = ''; const li = overlay.querySelector('.lock-inner'); if (li) li.classList.remove('shake'); }, 700);
      }
    }

    function bindPinEvents() {
      overlay.onclick = function(e) {
        const forgot = e.target.closest('#lockForgot');
        if (forgot && identity && identity.type === 'admin') {
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
        const maxLen2 = identity.type === 'admin' ? (isHashedPin(correctPin) ? 7 : correctPin.length) : 7;
        if (key.dataset.del) { entered = entered.slice(0, -1); updateDots(); return; }
        if (key.dataset.n == null) return;
        if (entered.length < maxLen2) { entered += key.dataset.n; updateDots(); check(); }
      };
    }

    renderNameScreen();
  }

  function renderIdentityBadge() {
    const old = document.getElementById('jollyIdBadge');
    if (old) old.remove();
    let session = null;
    try { session = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); } catch (e) {}
    if (!session) return; // PIN kilidi söndürülübsə, sessiya yoxdur — nişan göstərilmir

    const isAdmin = session.role === 'admin';
    const label = isAdmin ? 'Admin' : (session.userName || 'User');
    const b = document.createElement('div');
    b.id = 'jollyIdBadge';
    b.style.cssText = `position:fixed;top:10px;left:12px;z-index:9998;
      background:rgba(10,10,20,0.88);
      border:1px solid ${isAdmin ? 'rgba(255,184,77,0.5)' : 'rgba(0,212,255,0.5)'};
      color:${isAdmin ? '#fbbf24' : '#00d4ff'};
      padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;
      cursor:pointer;display:flex;align-items:center;gap:6px;
      backdrop-filter:blur(8px);box-shadow:0 2px 12px rgba(0,0,0,0.3);`;
    b.innerHTML = isAdmin
      ? `👑 ${label} <span style="opacity:0.55;font-size:10px;">| 🔄</span>`
      : `👤 ${label} <span style="opacity:0.55;font-size:10px;">| 🔄</span>`;
    b.title = 'İstifadəçi dəyiş';
    b.onclick = () => {
      if (!confirm('Çıxış edib başqa istifadəçi ilə girmək istəyirsən?')) return;
      try { sessionStorage.removeItem('jolly_sec_session'); sessionStorage.removeItem('jolly_pin_ok'); } catch (e) {}
      location.reload();
    };
    document.body.appendChild(b);
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

  // ── FƏALİYYƏTSİZLİKDƏN SONRA AVTOMATİK KİLİD (#23) ──────────
  // Toxunma/klik/klaviatura/sürüşdürmə hər hansı biri fəaliyyət sayılır.
  // Security Studio-dakı seçimə (settings.autoLockMinutes) görə, PIN
  // qoruması aktivdirsə və seçilmiş müddət ərzində heç bir fəaliyyət
  // olmasa, sessiya sıfırlanır və səhifə yenidən yüklənir — bu, growth
  // checkPinLock()-un yenidən kilid ekranını göstərməsinə səbəb olur.
  let _lastActivityTs = Date.now();
  function _markActivity() { _lastActivityTs = Date.now(); }

  function initAutoLockWatcher() {
    if (window._jollyAutoLockInit) return;
    window._jollyAutoLockInit = true;
    ['touchstart', 'mousedown', 'keydown', 'scroll'].forEach(evt => {
      document.addEventListener(evt, _markActivity, { passive: true });
    });
    setInterval(() => {
      const settings = JollyDB.getSettings();
      const minutes = settings.autoLockMinutes || 0;
      if (minutes <= 0) return; // söndürülüb
      if (!settings.pinEnabled || !settings.pin) return; // PIN aktiv deyil
      let hasSession = false;
      try { hasSession = sessionStorage.getItem('jolly_pin_ok') === '1'; } catch (e) {}
      if (!hasSession) return; // artıq kilidli
      if (Date.now() - _lastActivityTs >= minutes * 60 * 1000) {
        try {
          sessionStorage.removeItem('jolly_pin_ok');
          sessionStorage.removeItem('jolly_sec_session');
        } catch (e) {}
        location.reload();
      }
    }, 20000); // hər 20 saniyədə bir yoxla
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

    // ── Yeni cihaz kilidi problemi ──
    // İşçi siyahısı yalnız GİRİŞDƏN SONRA buluddan gəlir — toyuq-yumurta.
    // Cihazda artıq başqa məlumat (PIN, məhsul) ola bilər, amma İstifadəçilər
    // siyahısı hələ heç sinxronlaşmayıbsa, "Kimsən?" ekranında yalnız Admin
    // görünür. Ona görə, kilid ekranını göstərməzdən əvvəl, YALNIZ işçi
    // siyahısı boşdursa, onu (təhlükəsiz şəkildə, başqa heç nəyə toxunmadan)
    // buluddan çəkirik.
    const noUsers = !(window.JollyUsers && JollyUsers.list().length > 0);
    const noPin = !(JollyDB.getSettings().pin);
    if ((noUsers || noPin) && typeof JollyCloud !== 'undefined' && JollyCloud.enabled() && navigator.onLine) {
      JollyCloud.pull().then(payload => {
        if (!payload || !payload.data) return;
        if (noUsers && Array.isArray(payload.data.users) && payload.data.users.length > 0) {
          try { JollyDB.write('jolly_users_v1', payload.data.users); } catch (e) {}
        }
        if (noPin && payload.data.settings && payload.data.settings.pin) {
          try {
            const local = JollyDB.getSettings();
            local.pin = payload.data.settings.pin;
            local.pinEnabled = payload.data.settings.pinEnabled;
            local.pinRecovery = payload.data.settings.pinRecovery;
            JollyDB.saveSettings ? JollyDB.saveSettings(local) : JollyDB.write('jolly_settings', local);
          } catch (e) {}
        }
        if (payload.data.permissions) {
          try { JollyDB.write('jolly_perm_os_v2', payload.data.permissions); } catch (e) {}
        }
      }).catch(() => {}).finally(() => {
        continueBoot();
      });
      return;
    }
    continueBoot();
  }

  function continueBoot() {
    if (!checkPinLock()) return;
    renderIdentityBadge();
    initAutoLockWatcher();
    JollyStudios.applySavedTheme();
    if (typeof JollyCodeStudio !== 'undefined') JollyCodeStudio.runEnabledSnippets();
    if (typeof JollyWorkflow !== 'undefined') JollyWorkflow.runOnStartup();
    // Köhnə şəkilləri IndexedDB-yə köçür (bir dəfə), sonra ekranı yenilə
    if (typeof JollyStorage !== 'undefined') {
      JollyStorage.migrateOldImages().then(() => JollyStorage.hydrate());
    }
    if (typeof JollyCloud !== 'undefined') {
      JollyCloud.initAutoSync();
      // Möhkəmləndirmə: lokal yaddaş boşdursa (keş/storage təmizlənibsə),
      // buludda məlumat varmı yoxla və bərpa təklif et.
      try {
        const localCount = JollyDB.Products.all().length;
        if (localCount === 0 && JollyCloud.enabled() && navigator.onLine) {
          setTimeout(() => {
            JollyCloud.pull().then(payload => {
              const cloudCount = payload && payload.data && Array.isArray(payload.data.products) ? payload.data.products.length : 0;
              if (cloudCount > 0) {
                JollyCloud.restoreFromCloud();
              }
            }).catch(() => {});
          }, 1500);
        }
      } catch (e) {}

      // Arxa plan sinxronu — bir cihazda əlavə olunan məhsul başqa
      // cihazlarda da (əl ilə "Buluddan bərpa" basmadan) görünsün deyə,
      // hər 45 saniyədən bir sakitcə buludu yoxlayır və YALNIZ yeni
      // olan qeydləri (mövcud lokal məlumata toxunmadan) əlavə edir.
      setInterval(silentCloudMerge, 45000);
      setTimeout(silentCloudMerge, 12000);
    }
    if (typeof JollyOTA !== 'undefined') JollyOTA.autoCheck();
    // Avtomatik snapshot (gündə bir dəfə, qəza geri qaytarma üçün)
    try {
      const snap = JollyDB.read('jolly_snapshot', null);
      const dayMs = 864e5;
      if (!snap || (Date.now() - snap.ts) > dayMs) {
        if (typeof JollyStudios !== 'undefined' && JollyStudios.saveSnapshot) JollyStudios.saveSnapshot();
      }
      // Backup xatırlatması — həm əl ilə export, həm avtomatik bulud sinxronu nəzərə alınır
      const s = JollyDB.getSettings();
      if (s.backupReminder !== false && JollyDB.Products.all().length > 0) {
        const lastManual = s.lastBackup || 0;
        const lastCloud = s.lastCloudSync || 0;
        const lastProtected = Math.max(lastManual, lastCloud);
        if ((Date.now() - lastProtected) > 7 * dayMs && typeof JollyWorkflow !== 'undefined') {
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
