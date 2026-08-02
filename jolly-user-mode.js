/* ============================================================
   JOLLY İşçi Rejimi — jolly-user-mode.js
   (2026-08-02)

   DÖRD İŞ GÖRÜR:

   1) QADAĞALARI İŞLƏK EDİR (ən vacibi)
      Repoda 22 yerdə belə yoxlama var:
          if (window.JollyAuth && !JollyAuth.can('products.create')) ...
      Amma `window.JollyAuth` YALNIZ security.js-də təyin olunur və
      security.js index.html-də ÜMUMİYYƏTLƏ YOXDUR. Ona görə şərtin
      birinci hissəsi həmişə false olurdu → bütün qadağalar səssizcə
      keçirdi. Bu fayl JollyAuth-u POS (permission-engine) üzərində
      qurur. security.js yüklənmir — o, Storage.prototype-ı sarğılayır
      və nüvə qatı ilə toqquşur.
      Əlavə olaraq JollyDB.Products.add() birbaşa bağlanır ki, arxa
      qapılar (sürətli əlavə, skan, qovluq) da qadağaya tabe olsun.

   2) LUPA ↔ EDGE PANEL
      #qs-fab z-index:9990 daşıyırdı, .edge-panel isə 60 → lupa
      panelin üstündə qalırdı. İndi 52-yə salınır və panel açılanda
      bütün üzən düymələr gizlədilir.

   3) SALAMLAMA BAŞLIĞI
      dashboard.js:471-dəki sabit "İş masası" mətni işçinin adı ilə
      əvəzlənir: "Zülfüqar İsmayılov, xoş gəlmisən 👋".
      Mətn şablonunu YALNIZ admin dəyişir.

   4) İŞÇİ ÜÇÜN AYRI İŞ MASASI
      Rolu 'user' olan kəs tamam başqa, sadə ekran görür — Studio,
      AI, backup, modul siyahısı yoxdur. Admin #/user-mode ekranından
      seçir ki, işçidə hansı kartlar olsun.

   GERİ QAYTARMA (hər şey əvvəlki halına qayıdır):
      localStorage.removeItem('jolly_user_mode')
   ============================================================ */
(function (global) {
  'use strict';

  var CFG_KEY = 'jolly_user_mode';
  var PERM_KEY = 'usermode.manage';
  var ROUTE = '#/user-mode';

  /* ── Leksik const-ları oxumaq üçün (JollyDB, JollyDashboard və s.
        `const`-dur, window-a yapışmır) ─────────────────────────── */
  function peek(name) {
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }

  function toast(msg, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error) return T.error(msg);
      if (T && kind === 'ok' && T.success) return T.success(msg);
      if (T && T.info) return T.info(msg);
    } catch (e) {}
    console.log('[UserMode]', msg);
  }

  /* ══════════════════════════════════════════════════════════
     Sessiya və konfiqurasiya
     ══════════════════════════════════════════════════════════ */
  function session() {
    try { return JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); }
    catch (e) { return null; }
  }
  function isAdmin() { var s = session(); return !!(s && s.role === 'admin'); }
  function isUser()  { var s = session(); return !!(s && s.role === 'user'); }
  function userName() {
    var s = session();
    if (s && s.userName) return s.userName;
    if (s && s.role === 'admin') return 'Admin';
    return 'İşçi';
  }

  var DEFAULTS = {
    on: true,                                    // işçi rejimi ümumiyyətlə işləsin?
    greeting: '{ad}, xoş gəlmisən 👋',           // {ad} = işçinin adı
    sub: 'Bu gün nə edirik?',
    greetAdminToo: true,                         // admin də adı ilə salamlansın
    simpleDash: true,                            // işçiyə ayrı sadə iş masası
    hideTop: true,                               // işçidə yuxarı düymələri gizlət
    hideFabs: true,                              // işçidə üzən dairəvi menyuları gizlət
    lockAdminRoutes: true,                       // işçi admin ekranlarına girə bilməsin
    cards: ['home', 'scan', 'share-inbox', 'barcode-view', 'fixmode', 'tasks']
  };

  function cfg() {
    var c;
    try { c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) { c = null; }
    if (!c || typeof c !== 'object') c = {};
    var out = {};
    for (var k in DEFAULTS) out[k] = (c[k] === undefined ? DEFAULTS[k] : c[k]);
    if (!Array.isArray(out.cards)) out.cards = DEFAULTS.cards.slice();
    return out;
  }
  function saveCfg(patch) {
    var c = cfg(), k;
    for (k in patch) c[k] = patch[k];
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
    return c;
  }

  /* ══════════════════════════════════════════════════════════
     1) JollyAuth — 22 mövcud yoxlamanı canlandırır
     ══════════════════════════════════════════════════════════ */
  function can(perm) {
    if (isAdmin()) return true;
    var POS = global.POS || peek('POS');
    if (!POS || typeof POS.can !== 'function') return true;   // mühərrik yoxdursa kilidləmirik
    var allowed = false;
    try { allowed = !!POS.can(perm); } catch (e) { allowed = true; }
    if (!allowed) {
      var JE = global.JollyEvents || peek('JollyEvents');
      if (JE && JE.emit) {
        var s = session();
        try {
          JE.emit('permission.denied', {
            key: perm,
            userId: s ? s.userId : null,
            userName: s ? s.userName : null,
            at: Date.now()
          });
        } catch (e) {}
      }
    }
    return allowed;
  }

  function installAuth() {
    if (global.JollyAuth && global.JollyAuth.__jum) return;
    global.JollyAuth = { can: can, __jum: true };
  }

  /* Arxa qapı: məhsul yaratmağın BÜTÜN yolları JollyDB.Products.add()-dən
     keçir (form, sürətli əlavə, barkod qovluğu, idxal). Onu bağlayırıq. */
  function installAddGuard() {
    var DB = global.JollyDB || peek('JollyDB');
    if (!DB || !DB.Products || typeof DB.Products.add !== 'function') return false;
    if (DB.Products.add.__jum) return true;
    var orig = DB.Products.add.bind(DB.Products);
    var wrapped = function (item) {
      if (!can('products.create')) {
        toast('🔒 Məhsul əlavə etmək icazən yoxdur', 'error');
        try { if (navigator.vibrate) navigator.vibrate([50, 30, 50]); } catch (e) {}
        throw new Error('JOLLY: products.create icazəsi yoxdur');
      }
      return orig(item);
    };
    wrapped.__jum = true;
    DB.Products.add = wrapped;
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     2) Lupa ↔ edge panel + işçi görünüşü üçün CSS
     ══════════════════════════════════════════════════════════ */
  function installCss() {
    if (document.getElementById('jum-css')) return;
    var st = document.createElement('style');
    st.id = 'jum-css';
    st.textContent = [
      /* lupa artıq panelin üstündə deyil (.edge-panel 60, .edge-scrim 55) */
      '#qs-fab{z-index:52!important;}',
      /* edge panel açılanda bütün üzən düymələr yox olur */
      'body.jum-edge-open #qs-fab,',
      'body.jum-edge-open .jfab-wrap,',
      'body.jum-edge-open .quick-fab,',
      'body.jum-edge-open #radialFabRoot,',
      'body.jum-edge-open .fab-scrim2{display:none!important;}',
      /* işçi rejimi — sadə görünüş */
      'body.jum-user #cmdBtn,',
      'body.jum-user #backupPill,',
      'body.jum-user #topAiBtn,',
      'body.jum-user #topStudiosBtn{display:none!important;}',
      'body.jum-user-nofab #radialFabRoot,',
      'body.jum-user-nofab .jfab-wrap,',
      'body.jum-user-nofab .quick-fab{display:none!important;}',
      /* işçi iş masası */
      '.jum-hi{padding:18px 0 6px;}',
      '.jum-hi h2{font-family:var(--font-display);margin:0;font-size:23px;line-height:1.25;}',
      '.jum-hi .jum-sub{font-size:12.5px;opacity:.6;margin-top:4px;}',
      '.jum-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px;}',
      '.jum-card{border-radius:18px;padding:18px 14px;text-align:center;cursor:pointer;',
      'background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);',
      'transition:transform .12s ease,background .2s ease;}',
      '.jum-card:active{transform:scale(.96);background:rgba(255,255,255,0.09);}',
      '.jum-card .jum-ic{font-size:30px;line-height:1;}',
      '.jum-card .jum-lb{margin-top:9px;font-size:13.5px;font-weight:600;}',
      '.jum-empty{padding:26px 16px;text-align:center;opacity:.6;font-size:13px;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function watchEdgePanel() {
    var panel = document.getElementById('edgePanel');
    if (!panel || panel.__jum) return;
    panel.__jum = true;
    var sync = function () {
      try {
        document.body.classList.toggle('jum-edge-open', panel.classList.contains('open'));
      } catch (e) {}
    };
    try {
      new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
    sync();
  }

  /* ══════════════════════════════════════════════════════════
     3+4) İş masası — salamlama və işçi ekranı
     ══════════════════════════════════════════════════════════ */
  var CARDS = [
    { id: 'home',           route: '#/home',                icon: '🔍', label: 'Axtarış',         perm: 'products.view' },
    { id: 'scan',           route: '#/scan',                icon: '📡', label: 'Barkod skan',     perm: 'barcode.scan' },
    { id: 'share-inbox',    route: '#/share-inbox',         icon: '📥', label: 'Şəkillə axtar',   perm: 'share.inbox.view' },
    { id: 'barcode-view',   route: '#/barcode-view',        icon: '🧾', label: 'Kassa Barkodu',   perm: 'barcode.screen.view' },
    { id: 'fixmode',        route: '#/fixmode',             icon: '⚡', label: 'Bu gün 10 mal',   perm: 'fixmode.use' },
    { id: 'tasks',          route: '#/tasks',               icon: '✅', label: 'Tapşırıqlarım',   perm: 'tasks.view' },
    { id: 'new',            route: '#/product/new',         icon: '➕', label: 'Yeni məhsul',     perm: 'products.create' },
    { id: 'photo-session',  route: '#/photo-session',       icon: '📸', label: 'Foto seansı',     perm: 'photo.session' },
    { id: 'barcode-folder', route: '#/barcode-folder',      icon: '📁', label: 'Barkod Qovluğu',  perm: 'barcode.folder.view' },
    { id: 'store-map',      route: '#/store-map',           icon: '🗺️', label: 'Mağaza xəritəsi', perm: 'storemap.view' },
    { id: 'receiving',      route: '#/receiving',           icon: '📦', label: 'Mal qəbulu',      perm: 'receiving.view' },
    { id: 'scan-marathon',  route: '#/scan-marathon',       icon: '🎯', label: 'Skan maratonu',   perm: 'scanmarathon.use' },
    { id: 'favorites',      route: '#/dashboard/favorites', icon: '⭐', label: 'Sevimlilər',      perm: 'favorites.use' },
    { id: 'drafts',         route: '#/drafts',              icon: '📝', label: 'Qaralamalar',     perm: null }
  ];
  function cardById(id) {
    for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i];
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function greetingText() {
    var c = cfg();
    return String(c.greeting || DEFAULTS.greeting).split('{ad}').join(userName());
  }

  /* İşçinin öz iş masası — orijinal dashboard heç çağırılmır */
  function renderUserDash(preview) {
    var c = cfg();
    var ids = c.cards || [];
    var body = '';
    var shown = 0;
    for (var i = 0; i < ids.length; i++) {
      var cd = cardById(ids[i]);
      if (!cd) continue;
      if (!preview && cd.perm && !can(cd.perm)) continue;   // icazəsi yoxdursa kart da yoxdur
      shown++;
      body += '<div class="jum-card" onclick="JollyUserMode.go(\'' + cd.route + '\')">' +
                '<div class="jum-ic">' + cd.icon + '</div>' +
                '<div class="jum-lb">' + esc(cd.label) + '</div>' +
              '</div>';
    }
    if (!shown) {
      body = '<div class="jum-empty">Hələ heç nə açılmayıb.<br>Admin-dən icazə istə.</div>';
      return '<div class="storeos"><div class="jum-hi"><h2>' + esc(greetingText()) + '</h2>' +
             '<div class="jum-sub">' + esc(c.sub || '') + '</div></div>' + body + '</div>';
    }
    return '<div class="storeos">' +
             '<div class="jum-hi"><h2>' + esc(greetingText()) + '</h2>' +
             '<div class="jum-sub">' + esc(c.sub || '') + '</div></div>' +
             '<div class="jum-grid">' + body + '</div>' +
           '</div>';
  }

  /* Admin-in öz iş masası dəyişmir — yalnız başlıq mətni əvəzlənir */
  function applyGreeting(html) {
    try {
      return String(html).replace(
        /(<h2[^>]*>)\s*İş masası\s*(<\/h2>)/,
        '$1' + esc(greetingText()).replace(/\$/g, '$$$$') + '$2'
      );
    } catch (e) { return html; }
  }

  function installDashboardWrap() {
    var D = global.JollyDashboard || peek('JollyDashboard');
    if (!D || typeof D.render !== 'function') return false;
    if (D.render.__jum) return true;
    var orig = D.render.bind(D);
    var wrapped = function () {
      var c = cfg();
      applyBodyFlags();
      if (c.on && c.simpleDash && isUser()) return renderUserDash(false);
      var html = orig();
      if (c.on && (isUser() || (isAdmin() && c.greetAdminToo))) html = applyGreeting(html);
      return html;
    };
    wrapped.__jum = true;
    D.render = wrapped;
    if (!global.JollyDashboard) { try { global.JollyDashboard = D; } catch (e) {} }
    return true;
  }

  /* İşçi admin ekranlarına girməsin */
  var BLOCKED = ['#/studios', '#/dashboard/studio', '#/user-mode', '#/module-cleanup',
                 '#/jolly-settings', '#/testdata', '#/selftest', '#/perm-preview',
                 '#/import', '#/sheet', '#/updates'];
  function guardRoute() {
    var c = cfg();
    if (!c.on || !c.lockAdminRoutes || !isUser()) return;
    var h = String(global.location.hash || '');
    for (var i = 0; i < BLOCKED.length; i++) {
      if (h === BLOCKED[i] || h.indexOf(BLOCKED[i] + '/') === 0) {
        toast('🔒 Bu bölmə admin üçündür', 'error');
        global.location.hash = '#/dashboard';
        return;
      }
    }
  }

  function applyBodyFlags() {
    var c = cfg();
    var u = c.on && isUser();
    try {
      document.body.classList.toggle('jum-user', !!(u && c.hideTop));
      document.body.classList.toggle('jum-user-nofab', !!(u && c.hideFabs));
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     Admin ekranı — #/user-mode
     ══════════════════════════════════════════════════════════ */
  function sw(key, on, label, hint) {
    return '<div class="glass" style="padding:12px 14px;margin-bottom:9px;display:flex;align-items:center;gap:12px;">' +
             '<div style="flex:1;">' +
               '<div style="font-size:13.5px;font-weight:600;">' + label + '</div>' +
               (hint ? '<div class="muted" style="font-size:11.5px;margin-top:2px;">' + hint + '</div>' : '') +
             '</div>' +
             '<div onclick="JollyUserMode.toggle(\'' + key + '\')" style="cursor:pointer;width:46px;height:26px;border-radius:13px;flex:none;' +
               'background:' + (on ? 'rgba(74,222,128,0.75)' : 'rgba(255,255,255,0.14)') + ';position:relative;transition:background .2s;">' +
               '<div style="position:absolute;top:3px;left:' + (on ? '23px' : '3px') + ';width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s;"></div>' +
             '</div>' +
           '</div>';
  }

  function renderAdmin() {
    if (!isAdmin() && !can(PERM_KEY)) {
      return '<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>';
    }
    var c = cfg();
    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
             '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">👥 İşçi Rejimi</h2>' +
             '<div class="muted" style="font-size:12.5px;">İşçi nə görsün — sən seçirsən</div>' +
           '</div></div>');

    /* Salamlama */
    h.push('<div class="section-title" style="margin-top:14px;">Salamlama</div>');
    h.push('<div class="glass" style="padding:14px;margin-bottom:9px;">' +
             '<div class="muted" style="font-size:11.5px;margin-bottom:6px;">{ad} yerinə işçinin adı yazılır</div>' +
             '<input id="jumGreet" class="input" style="width:100%;margin-bottom:8px;" value="' + esc(c.greeting) + '">' +
             '<input id="jumSub" class="input" style="width:100%;margin-bottom:10px;" value="' + esc(c.sub) + '">' +
             '<div style="font-size:12px;opacity:.65;margin-bottom:10px;">Görünüş: <b>' + esc(greetingText()) + '</b></div>' +
             '<button class="btn btn-primary" onclick="JollyUserMode.saveGreeting()">Yadda saxla</button>' +
           '</div>');
    h.push(sw('greetAdminToo', c.greetAdminToo, 'Admin də adı ilə salamlansın', 'Söndürsən, admin ekranında yenə "İş masası" yazılır'));

    /* Kartlar */
    h.push('<div class="section-title" style="margin-top:16px;">İşçinin iş masasındakı kartlar</div>');
    h.push('<div class="muted" style="font-size:11.5px;margin-bottom:8px;">Seçilməyən hər şey işçidə bağlıdır. İcazəsi olmayan kart onsuz da görünmür.</div>');
    for (var i = 0; i < CARDS.length; i++) {
      var cd = CARDS[i];
      var on = c.cards.indexOf(cd.id) !== -1;
      h.push('<div class="glass" onclick="JollyUserMode.toggleCard(\'' + cd.id + '\')" ' +
               'style="padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;cursor:pointer;' +
               'border:1px solid ' + (on ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.07)') + ';">' +
               '<span style="font-size:20px;">' + cd.icon + '</span>' +
               '<span style="flex:1;font-size:13.5px;">' + esc(cd.label) + '</span>' +
               '<span style="font-size:16px;">' + (on ? '✅' : '⬜') + '</span>' +
             '</div>');
    }

    /* Açarlar */
    h.push('<div class="section-title" style="margin-top:16px;">Sadələşdirmə</div>');
    h.push(sw('simpleDash', c.simpleDash, 'İşçiyə ayrı sadə iş masası', 'Söndürsən, işçi də adi iş masasını görür'));
    h.push(sw('hideTop', c.hideTop, 'Yuxarı düymələri gizlət', 'Studio · AI Brain · ⌘ · backup'));
    h.push(sw('hideFabs', c.hideFabs, 'Üzən dairəvi menyuları gizlət', 'Radial menyu və sürətli düymələr'));
    h.push(sw('lockAdminRoutes', c.lockAdminRoutes, 'Admin ekranlarını bağla', 'Linki əl ilə yazsa belə girə bilməz'));
    h.push(sw('on', c.on, 'İşçi rejimi ümumiyyətlə işləsin', 'Söndürsən, hər şey əvvəlki halına qayıdır'));

    h.push('<div style="margin:16px 0 30px;display:flex;gap:8px;flex-wrap:wrap;">' +
             '<button class="btn" onclick="JollyUserMode.preview()">👁️ İşçinin gözü ilə bax</button>' +
             '<button class="btn" onclick="JollyUserMode.reset()">↩ Standart</button>' +
           '</div>');
    h.push('</div>');
    return h.join('');
  }

  function refresh() {
    var A = global.JollyApp || peek('JollyApp');
    try { if (A && A.render) A.render(); } catch (e) {}
  }

  var API = {
    go: function (route) {
      var R = global.JollyRouter || peek('JollyRouter');
      if (R && R.go) R.go(route); else global.location.hash = route;
    },
    toggle: function (key) {
      var c = cfg(), p = {};
      p[key] = !c[key];
      saveCfg(p);
      applyBodyFlags();
      refresh();
    },
    toggleCard: function (id) {
      var c = cfg(), list = c.cards.slice(), i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      saveCfg({ cards: list });
      refresh();
    },
    saveGreeting: function () {
      var g = document.getElementById('jumGreet');
      var s = document.getElementById('jumSub');
      saveCfg({
        greeting: g ? g.value : DEFAULTS.greeting,
        sub: s ? s.value : DEFAULTS.sub
      });
      toast('Salamlama yadda saxlanıldı', 'ok');
      refresh();
    },
    preview: function () {
      var el = document.getElementById('main');
      if (!el) return;
      el.innerHTML = '<div style="padding:10px 0;">' +
        '<div class="glass" style="padding:10px 13px;margin-bottom:12px;font-size:12.5px;">' +
        '👁️ Önbaxış — işçi bunu görür. <span style="opacity:.6;">Geri: aşağıdakı düymə.</span></div>' +
        renderUserDash(true) +
        '<div style="margin-top:14px;"><button class="btn" onclick="JollyUserMode.go(\'' + ROUTE + '\');JollyUserMode._r();">← Geri</button></div>' +
        '</div>';
    },
    _r: refresh,
    reset: function () {
      try { localStorage.removeItem(CFG_KEY); } catch (e) {}
      applyBodyFlags();
      toast('Standart hala qaytarıldı', 'ok');
      refresh();
    },
    render: renderAdmin,
    can: can,
    cfg: cfg,
    isUser: isUser,
    isAdmin: isAdmin,
    greeting: greetingText,
    cards: function () { return CARDS.slice(); },
    _renderUserDash: renderUserDash,
    _applyGreeting: applyGreeting
  };
  global.JollyUserMode = API;

  /* ══════════════════════════════════════════════════════════
     Qeydiyyat
     ══════════════════════════════════════════════════════════ */
  function registerPerm() {
    var POS = global.POS || peek('POS');
    if (!POS || typeof POS.register !== 'function') return false;
    try {
      POS.register({
        id: 'usermode', name: 'İşçi Rejimi', icon: '👥',
        permissions: [{ key: PERM_KEY, label: 'İşçi rejimini idarə et', tag: 'system', default: false }]
      });
      return true;
    } catch (e) { return false; }
  }

  function registerModule() {
    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    if (!MR || typeof MR.register !== 'function') return false;
    try {
      MR.register({
        id: 'user-mode', name: 'İşçi Rejimi', icon: '👥',
        route: ROUTE, group: 'JOLLY', perm: PERM_KEY,
        render: renderAdmin
      });
      return true;
    } catch (e) { return false; }
  }

  /* ══════════════════════════════════════════════════════════
     Açılış
     ══════════════════════════════════════════════════════════ */
  var tries = 0;
  function boot() {
    installAuth();
    installCss();
    watchEdgePanel();
    applyBodyFlags();

    var ok1 = installAddGuard();
    var ok2 = installDashboardWrap();
    var ok3 = registerPerm();
    var ok4 = registerModule();

    var coreOk = ok1 && ok3 && ok4; // add guard + perm + module
    ++tries;
    if (coreOk && ok2) {
      console.log('[UserMode] hazırdır');
      guardRoute();
      return;
    }
    if (tries > 40) {
      // Dashboard sarğısı olmasa da digərləri işləyir — bunu sonra yenidən cəhd edirik
      if (!ok2) {
        console.warn('[UserMode] dashboard sarğısı uğursuz — hər render-də cəhd ediləcək');
        // hashchange-də yenidən cəhd
        global.addEventListener('jolly:rendered', function tryDash() {
          if (installDashboardWrap()) {
            console.log('[UserMode] dashboard sarğısı qoşuldu');
            global.removeEventListener('jolly:rendered', tryDash);
          }
        });
      }
      if (coreOk) { guardRoute(); return; }
      console.warn('[UserMode] tam qoşula bilmədi:', { add: ok1, dashboard: ok2, perm: ok3, module: ok4 });
      guardRoute();
      return;
    }
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 60); });
  } else {
    setTimeout(boot, 60);
  }

  /* Giriş edəndən sonra rol dəyişir — görünüşü ona uyğunlaşdır */
  var _lastRole = null;
  setInterval(function () {
    var s = session();
    var r = s ? s.role : null;
    if (r !== _lastRole) { _lastRole = r; applyBodyFlags(); }
  }, 2000);

  global.addEventListener('hashchange', function () {
    applyBodyFlags();
    guardRoute();
    setTimeout(watchEdgePanel, 100);
  });

})(typeof window !== 'undefined' ? window : this);
