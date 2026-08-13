/* ============================================================
   JOLLY İşçi Rejimi  (jolly-user-mode.js — v1.0, 2026-08-02)
   ------------------------------------------------------------
   DÖRD İŞ GÖRÜR:

   1) İCAZƏLƏRİ HƏQİQƏTƏN İŞƏ SALIR  ⚠️ ƏSAS DÜZƏLİŞ
      Repoda 22 yerdə belə yoxlama var:
          if (window.JollyAuth && !JollyAuth.can('products.create')) { ... }
      `window.JollyAuth` YALNIZ security.js-də təyin olunur, security.js isə
      index.html-də YOXDUR. Yəni şərtin birinci hissəsi həmişə false idi və
      BÜTÜN bu yoxlamalar səssizcə keçirdi — məhz ona görə istifadəçiyə
      "məhsul əlavə etmə" qadağası qoyula bilmirdi.
      Burada JollyAuth POS (permission-engine) üzərində qurulur:
      admin → həmişə icazəli, işçi → İcazə Mərkəzindəki açara baxılır.

   2) ÜZƏN AXTARIŞ DÜYMƏSİ (🔎 #qs-fab) ARTIQ EDGE PANELİ ÖRTMÜR
      #qs-fab-in z-index-i 9990 idi, edge panel isə 60 — ona görə lupa
      panelin üstündə qalırdı. İndi: z-index aşağı salınır və panel
      açılan kimi düymə tam gizlədilir.

   3) "İş masası" YERİNƏ AD İLƏ SALAMLAMA
      "Zülfüqar İsmayılov, xoş gəlmisən 👋" — mətni və emojini yalnız
      ADMİN dəyişir (#/user-mode).

   4) İŞÇİLƏR ÜÇÜN AYRICA, SADƏ İŞ MASASI
      Admin öz mürəkkəb ekranını görür; işçi yalnız admin-in seçdiyi
      4-8 böyük düyməni görür. Qalan hər şey bağlıdır.

   HEÇ BİR KÖHNƏ FAYLA TOXUNULMUR — hamısı kənardan sarğıdır.
   Geri qaytarmaq: localStorage.removeItem('jolly_user_mode')
   ============================================================ */
(() => {
  'use strict';

  const CFG_KEY = 'jolly_user_mode';

  const DEFAULTS = {
    authOn: true,          // icazə mühərriki işə düşsün
    greetOn: true,         // "İş masası" → ad ilə salamlama
    greetText: '{ad}, xoş gəlmisən',
    greetEmoji: '👋',
    simpleOn: true,        // işçiyə sadə iş masası
    hideTopBtns: true,     // işçidə yuxarı düymələr (Studio, AI, ⌘, 💾) gizlənsin
    hideFab: true,         // işçidə üzən dairəvi menyu gizlənsin
    cards: ['search', 'scan', 'newProduct', 'photo', 'tasks', 'fixmode']
  };

  /* İşçi iş masasında göstərilə bilən kartlar.
     perm: boşdursa həmişə görünür. */
  const CARDS = [
    { id: 'search',     icon: '🔍', label: 'Axtar',          sub: 'Malı tap',            perm: 'search.use',       go: "JollyRouter.go('#/products')" },
    { id: 'scan',       icon: '📡', label: 'Barkod skan',    sub: 'Kamera ilə oxu',      perm: 'barcode.scan',     go: "JollyProducts.scanSearch()" },
    { id: 'newProduct', icon: '➕', label: 'Yeni məhsul',    sub: 'Tam kart',            perm: 'products.create',  go: "JollyRouter.go('#/product/new')" },
    { id: 'photo',      icon: '📸', label: 'Tez şəkil',      sub: 'Sonra tamamlanacaq',  perm: 'products.capture', go: "JollyDashboard.quickPhoto()" },
    { id: 'drafts',     icon: '📥', label: 'Gələnlər',       sub: 'Yarımçıq şəkillər',   perm: 'products.create',  go: "JollyRouter.go('#/drafts')" },
    { id: 'catalog',    icon: '📦', label: 'Kataloq',        sub: 'Bütün mallar',        perm: 'products.view',    go: "JollyRouter.go('#/products')" },
    { id: 'tasks',      icon: '✅', label: 'Tapşırıqlar',    sub: 'Sənə verilənlər',     perm: 'tasks.view',       go: "JollyRouter.go('#/tasks')" },
    { id: 'fixmode',    icon: '🎯', label: 'Bu gün 10 mal',  sub: 'Bir mal, bir sual',   perm: 'fixmode.use',      go: "JollyRouter.go('#/fixmode')" },
    { id: 'storemap',   icon: '🗺️', label: 'Mağaza xəritəsi', sub: 'Rəflər',             perm: 'storemap.view',    go: "JollyRouter.go('#/store-map')" },
    { id: 'barcodefld', icon: '🏷️', label: 'Barkod Qovluğu', sub: 'Kodsuz mallar',       perm: 'barcode.folder.view', go: "JollyRouter.go('#/barcode-folder')" },
    { id: 'receiving',  icon: '🚚', label: 'Qəbul',          sub: 'Gələn mal',           perm: 'receiving.view',   go: "JollyRouter.go('#/receiving')" },
    { id: 'supplier',   icon: '📋', label: 'Sifariş',        sub: 'Tədarükçüyə',         perm: 'supplier.order',   go: "JollyRouter.go('#/supplier-order')" }
  ];

  function loadCfg() {
    let c;
    try { c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { c = {}; }
    const out = {};
    Object.keys(DEFAULTS).forEach(k => { out[k] = (c && c[k] !== undefined) ? c[k] : DEFAULTS[k]; });
    if (!Array.isArray(out.cards)) out.cards = DEFAULTS.cards.slice();
    return out;
  }
  function saveCfg(c) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
  }
  let CFG = loadCfg();

  function session() {
    try { return JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); }
    catch (e) { return null; }
  }
  function isAdmin() {
    const s = session();
    return !s || s.role === 'admin';   // sessiya yoxdursa kilidlənməmiş rejimdir
  }
  function userName() {
    const s = session();
    return (s && s.userName) ? s.userName : 'Admin';
  }
  function esc(x) {
    return String(x == null ? '' : x)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================
     1) window.JollyAuth — 22 yoxlama nöqtəsini işə salır
     ============================================================ */
  function installAuth() {
    if (!CFG.authOn) return;
    if (window.JollyAuth && window.JollyAuth.__jolly_um) return;

    const can = function (perm) {
      if (isAdmin()) return true;
      let allowed;
      try {
        allowed = (typeof POS !== 'undefined' && POS && typeof POS.can === 'function')
          ? !!POS.can(perm) : true;      // mühərrik yoxdursa kilidləmirik
      } catch (e) { allowed = true; }
      if (!allowed) {
        try {
          if (window.JollyEvents) {
            const s = session();
            JollyEvents.emit('permission.denied', {
              key: perm, userId: s ? s.userId : null,
              userName: s ? s.userName : null, at: Date.now()
            });
          }
        } catch (e) {}
      }
      return allowed;
    };

    window.JollyAuth = { can: can, __jolly_um: true };
  }

  /* ============================================================
     2) Üzən axtarış düyməsi ↔ Edge panel qatlaşması
     ============================================================ */
  function installLayerFix() {
    if (document.getElementById('jum-layer-css')) return;
    const st = document.createElement('style');
    st.id = 'jum-layer-css';
    st.textContent =
      /* lupa artıq edge panelin (z-index 60) və FAB pərdəsinin altında qalır */
      '#qs-fab{z-index:52!important;}' +
      /* panel açılanda ümumiyyətlə görünməsin */
      'body.jum-edge-open #qs-fab{display:none!important;opacity:0!important;pointer-events:none!important;}' +
      /* işçidə yuxarı düymələr */
      'body.jum-simple #topStudiosBtn,body.jum-simple #topAiBtn,' +
      'body.jum-simple #cmdBtn,body.jum-simple #backupPill{display:none!important;}' +
      'body.jum-nofab .jolly-fab,body.jum-nofab .fab-menu,body.jum-nofab .fab-scrim{display:none!important;}';
    document.head.appendChild(st);

    // Edge panel açılıb-bağlandığını izlə
    function watch(n) {
      n = n || 0;
      const panel = document.getElementById('edgePanel');
      if (!panel) { if (n < 40) setTimeout(() => watch(n + 1), 500); return; }
      const sync = () => {
        const open = panel.classList.contains('open');
        document.body.classList.toggle('jum-edge-open', open);
      };
      try {
        new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
      } catch (e) {}
      sync();
    }
    watch(0);
  }

  /* İşçi üçün ekran sadələşdirmə sinifləri */
  function applyBodyFlags() {
    const simple = CFG.simpleOn && !isAdmin();
    document.body.classList.toggle('jum-simple', !!(simple && CFG.hideTopBtns));
    document.body.classList.toggle('jum-nofab', !!(simple && CFG.hideFab));
  }

  /* ============================================================
     3+4) Dashboard sarğısı — salamlama və sadə iş masası
     ============================================================ */
  function DASH() {
    if (window.JollyDashboard) return window.JollyDashboard;
    try { return (new Function('try{return JollyDashboard}catch(e){return null}'))(); }
    catch (e) { return null; }
  }

  function greeting() {
    const txt = String(CFG.greetText || '{ad}').replace(/\{ad\}/g, userName());
    return esc(txt) + (CFG.greetEmoji ? ' ' + CFG.greetEmoji : '');
  }

  function allowedCard(c) {
    if (!c.perm) return true;
    try {
      if (window.JollyAuth && typeof window.JollyAuth.can === 'function') {
        return !!window.JollyAuth.can(c.perm);
      }
      if (typeof POS !== 'undefined' && POS) return !!POS.can(c.perm);
    } catch (e) {}
    return true;
  }

  function renderSimple() {
    const picked = CARDS.filter(c => CFG.cards.indexOf(c.id) >= 0 && allowedCard(c));
    let count = 0;
    try { count = JollyDB.Products.all().length; } catch (e) {}

    let h = '<div class="storeos">';
    h += '<div class="dash-head" style="margin-bottom:14px;"><div>' +
         '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">' + greeting() + '</h2>' +
         '<div class="muted" style="font-size:12.5px;">' +
         (count ? count + ' mal kataloqda' : 'JOLLY') + '</div>' +
         '</div></div>';

    if (!picked.length) {
      h += '<div class="empty-state"><div class="big-icon">🙌</div><h3>Hazırdır</h3>' +
           '<p class="muted" style="font-size:12.5px;">Admin sənin üçün hələ heç bir bölmə açmayıb.</p></div>';
      return h + '</div>';
    }

    h += '<div class="studio-grid">';
    picked.forEach(c => {
      h += '<div class="glass studio-card" style="cursor:pointer;" onclick="' + c.go + '">' +
             '<div class="ic" style="font-size:30px;">' + c.icon + '</div>' +
             '<div class="title">' + esc(c.label) + '</div>' +
             '<div class="sub">' + esc(c.sub) + '</div>' +
           '</div>';
    });
    h += '</div>';
    h += '<p class="muted" style="font-size:11px;margin:18px 0 24px;text-align:center;">' +
         'Nəsə lazımdırsa admin-ə de — o, sənə əlavə edə bilər.</p>';
    return h + '</div>';
  }

  let dashWrapped = false;
  function wrapDashboard() {
    const d = DASH();
    if (!d || dashWrapped || typeof d.render !== 'function') return !!d;
    dashWrapped = true;

    const _render = d.render.bind(d);
    d.render = function () {
      applyBodyFlags();
      if (CFG.simpleOn && !isAdmin()) return renderSimple();
      let html = _render.apply(null, arguments);
      if (CFG.greetOn && typeof html === 'string' && html.indexOf('>İş masası</h2>') > 0) {
        html = html.replace('>İş masası</h2>', '>' + greeting() + '</h2>');
      }
      return html;
    };
    return true;
  }

  /* ============================================================
     ADMİN EKRANI — #/user-mode
     ============================================================ */
  function renderAdmin() {
    if (!isAdmin()) {
      return '<div class="empty-state"><div class="big-icon">🔒</div><h3>Yalnız Admin</h3></div>';
    }
    const sw = (on, fn) => '<input type="checkbox" ' + (on ? 'checked' : '') +
      ' onclick="event.stopPropagation();" onchange="' + fn + '">';

    const row = (icon, title, sub, right) =>
      '<div style="display:flex;align-items:center;gap:10px;padding:11px 0;' +
      'border-bottom:1px solid rgba(255,255,255,.05);">' +
        '<span style="font-size:17px;width:22px;text-align:center;">' + icon + '</span>' +
        '<span style="flex:1;min-width:0;">' +
          '<span style="font-size:13px;font-weight:600;display:block;">' + esc(title) + '</span>' +
          '<span class="muted" style="font-size:10.5px;">' + esc(sub) + '</span>' +
        '</span>' + right + '</div>';

    let h = '';
    h += '<h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">👥 İşçi Rejimi</h2>';
    h += '<p class="muted" style="font-size:12px;margin:0 0 14px;">' +
         'İşçilər nə görsün, nə görməsin — hamısı buradan. Admin ekranı dəyişmir.</p>';

    /* İcazə mühərriki */
    h += '<div class="section-title">🔐 İcazələr</div>';
    h += '<div class="glass" style="padding:4px 14px;margin-bottom:8px;">';
    h += row('🔐', 'İcazə yoxlamalarını işə sal',
             'Repodakı 22 yoxlama nöqtəsi (məhsul əlavə/redaktə/sil, qəbul, backup...)',
             sw(CFG.authOn, "JollyUserMode.set('authOn', this.checked)"));
    h += '</div>';
    h += '<p class="muted" style="font-size:11px;margin:0 0 16px;">' +
         'Söndürülsə hər şey yenidən hamıya açıq olur. Kimə nə icazə veriləcəyini ' +
         '<b>İcazə Mərkəzi</b>ndən seçirsən — bu açar sadəcə həmin qərarların işləməsini təmin edir.</p>';

    /* Salamlama */
    h += '<div class="section-title">👋 Salamlama</div>';
    h += '<div class="glass" style="padding:10px 14px;margin-bottom:16px;">';
    h += row('👋', '"İş masası" yerinə ad yazılsın', 'Həm sənin, həm işçilərin ekranında',
             sw(CFG.greetOn, "JollyUserMode.set('greetOn', this.checked)"));
    h += '<div style="padding:12px 0 4px;">' +
         '<div class="muted" style="font-size:11px;margin-bottom:6px;">Mətn — <code>{ad}</code> işçinin adı ilə əvəzlənir</div>' +
         '<input id="jumText" type="text" value="' + esc(CFG.greetText) + '" ' +
         'style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);' +
         'background:rgba(255,255,255,.04);color:inherit;font-size:13px;margin-bottom:8px;">' +
         '<div class="row" style="gap:6px;flex-wrap:wrap;">';
    ['👋', '😊', '🙌', '👑', '🌟', '💪', ''].forEach(e => {
      const on = CFG.greetEmoji === e;
      h += '<span class="chip" style="cursor:pointer;' + (on ? 'border-color:var(--accent-1);color:var(--accent-1);' : '') +
           '" onclick="JollyUserMode.setEmoji(\'' + e + '\')">' + (e || 'emojisiz') + '</span>';
    });
    h += '</div>' +
         '<button class="btn btn-primary" style="margin-top:10px;" ' +
         'onclick="JollyUserMode.saveText()">Yadda saxla</button>' +
         '<div class="muted" style="font-size:11.5px;margin-top:10px;">Nümunə: <b>' + greeting() + '</b></div>' +
         '</div></div>';

    /* Sadə iş masası */
    h += '<div class="section-title">🪟 İşçinin iş masası</div>';
    h += '<div class="glass" style="padding:4px 14px;margin-bottom:8px;">';
    h += row('🪟', 'Sadə iş masası', 'İşçi mürəkkəb ekranı yox, yalnız seçdiyin kartları görür',
             sw(CFG.simpleOn, "JollyUserMode.set('simpleOn', this.checked)"));
    h += row('🔝', 'Yuxarı düymələri gizlət', 'Studio, AI Brain, ⌘, backup',
             sw(CFG.hideTopBtns, "JollyUserMode.set('hideTopBtns', this.checked)"));
    h += row('⭕', 'Üzən dairəvi menyunu gizlət', 'Sağ aşağıdakı böyük düymə',
             sw(CFG.hideFab, "JollyUserMode.set('hideFab', this.checked)"));
    h += '</div>';

    h += '<div class="section-title">İşçidə görünəcək kartlar (' + CFG.cards.length + ')</div>';
    h += '<div class="glass" style="padding:4px 14px;margin-bottom:20px;">';
    CARDS.forEach(c => {
      const on = CFG.cards.indexOf(c.id) >= 0;
      h += row(c.icon, c.label, c.sub + (c.perm ? ' · ' + c.perm : ''),
               sw(on, "JollyUserMode.toggleCard('" + c.id + "', this.checked)"));
    });
    h += '</div>';
    h += '<p class="muted" style="font-size:11px;margin-bottom:8px;">' +
         'Kart seçilsə belə, işçinin həmin icazəsi yoxdursa görünmür — İcazə Mərkəzi son sözü deyir.</p>';

    h += '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:24px;">' +
         '<button class="btn" onclick="JollyUserMode.preview()">👁️ İşçinin gözü ilə bax</button>' +
         '<button class="btn" onclick="JollyUserMode.reset()">↩ Standart ayarlar</button>' +
         '</div>';
    return h;
  }

  function repaint() {
    const m = document.getElementById('main');
    if (m) { m.innerHTML = renderAdmin(); window.scrollTo(0, 0); }
  }

  window.JollyUserMode = {
    render: renderAdmin,
    renderUserDashboard: renderSimple,
    config: () => CFG,
    set(k, v) {
      CFG[k] = v; saveCfg(CFG); applyBodyFlags();
      if (typeof Toast !== 'undefined') Toast.success('Yadda saxlanıldı');
      if (k === 'authOn') {
        if (v) installAuth();
        else { try { if (window.JollyAuth && window.JollyAuth.__jolly_um) delete window.JollyAuth; } catch (e) {} }
      }
      repaint();
    },
    setEmoji(e) { CFG.greetEmoji = e; saveCfg(CFG); repaint(); },
    saveText() {
      const el = document.getElementById('jumText');
      if (el) { CFG.greetText = el.value || '{ad}'; saveCfg(CFG); }
      if (typeof Toast !== 'undefined') Toast.success('Salamlama yeniləndi');
      repaint();
    },
    toggleCard(id, on) {
      CFG.cards = CFG.cards.filter(x => x !== id);
      if (on) CFG.cards.push(id);
      saveCfg(CFG); repaint();
    },
    preview() {
      const m = document.getElementById('main');
      if (!m) return;
      m.innerHTML =
        '<div class="glass" style="padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">' +
        '<span style="font-size:18px;">👁️</span><span style="flex:1;font-size:12.5px;">' +
        'İşçinin görəcəyi ekran (nümunə — düymələr işləmir)</span>' +
        '<span class="btn" onclick="JollyRouter.go(\'#/user-mode\')">Bağla</span></div>' +
        '<div style="pointer-events:none;opacity:.95;">' + renderSimple() + '</div>';
      window.scrollTo(0, 0);
    },
    reset() {
      CFG = JSON.parse(JSON.stringify(DEFAULTS));
      saveCfg(CFG); applyBodyFlags();
      if (typeof Toast !== 'undefined') Toast.success('Standart ayarlar qaytarıldı');
      repaint();
    }
  };

  /* ============================================================
     Qeydiyyat
     ============================================================ */
  function MR() {
    if (window.ModuleRegistry) return window.ModuleRegistry;
    try { return (new Function('try{return ModuleRegistry}catch(e){return null}'))(); }
    catch (e) { return null; }
  }

  let registered = false;
  function registerScreen() {
    if (registered) return;
    const reg = MR();
    if (!reg || typeof reg.register !== 'function') return;
    registered = true;

    (function regPerm(n) {
      try {
        if (typeof POS !== 'undefined' && POS && typeof POS.register === 'function') {
          POS.register({
            id: 'usermode', name: 'İşçi Rejimi', icon: '👥',
            permissions: [
              { key: 'usermode.manage', label: 'İşçi rejimini idarə et', tag: 'admin', default: false }
            ]
          });
          return;
        }
      } catch (e) {}
      if (n < 40) setTimeout(() => regPerm(n + 1), 200);
    })(0);

    reg.register({
      id: 'user-mode',
      name: 'İşçi Rejimi',
      icon: '👥',
      route: '#/user-mode',
      group: 'JOLLY',
      perm: 'usermode.manage',
      enabled: true,
      render() { return renderAdmin(); }
    });
  }

  /* ---------- Başlanğıc ---------- */
  installAuth();
  installLayerFix();

  (function boot(n) {
    const okDash = wrapDashboard();
    registerScreen();
    applyBodyFlags();
    if (okDash && registered) return;
    if (n > 60) return;
    setTimeout(() => boot(n + 1), 150);
  })(0);

  // Sessiya dəyişəndə (giriş/çıxış) sinifləri yenilə
  window.addEventListener('hashchange', () => { CFG = loadCfg(); applyBodyFlags(); });
})();
