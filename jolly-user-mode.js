/* ============================================================
   JOLLY İşçi Rejimi — jolly-user-mode.js
   v2.0  (2026-08-03)

   ────────────────────────────────────────────────────────────
   v1.0-DAN FƏRQİ (Esqinin 08-03 istəkləri):

   A) SABİT 14 KART SİLİNDİ.
      Seçim siyahısı artıq ModuleRegistry-dən CANLI gəlir —
      repodakı bütün qeydiyyatlı modullar + app.js-in öz əsas
      marşrutları. İşçi səhifəsində 0 kart da ola bilər, hamısı da.

   B) UZUN BASMA (telefon ana ekranı kimi).
      #/user-mode ekranı artıq işçinin iş masasının CANLI surətidir.
      Karta basıb saxlayanda (≈500 ms) menyu çıxır:
          🔓/🔒 İcazə   ⬅ ➡ yerini dəyiş   👁 Gizlət
      Boş "＋" xanası bütün modul siyahısını açır (axtarışlı).

   C) İCAZƏ PROBLEMİNİN KÖK SƏBƏBİ DÜZƏLDİ.
      permission-engine.js-də resolveFor() belədir:
          userOverride → globalOverride → perm.default → false
      Modul ModuleRegistry-yə perm:'xxx' ilə qeyd olunsa da, həmin
      açar POS.register() ilə qeydiyyatdan keçməyibsə allPerms()
      onu tapmır → HƏMİŞƏ false → işçidə bağlı qalır VƏ İcazə
      Mərkəzində siyahıda olmadığı üçün admin onu AÇA DA BİLMİR.
      İndi syncModulePerms() bütün modul açarlarını avtomatik
      'Modul girişləri' adı altında POS-a yazır — hamısı İcazə
      Mərkəzində görünür və uzun basma menyusundan da açılır.

   D) EDGE PANEL kodu bu fayldan çıxarıldı — onu artıq
      jolly-edge-off.js söndürür. Lupanın z-index-i azaldılmır.

   GERİ QAYTARMA:
      localStorage.removeItem('jolly_user_mode')
   ============================================================ */
(function (global) {
  'use strict';

  var CFG_KEY  = 'jolly_user_mode';
  var PERM_KEY = 'usermode.manage';
  var ROUTE    = '#/user-mode';
  var PERM_MOD = 'jum-modperms';   // avtomatik yaradılan icazə qrupu

  /* ── Leksik const-ları oxumaq (JollyDB, ModuleRegistry və s.
        `const`-dur, window-a yapışmır) ─────────────────────── */
  function peek(name) {
    try {
      return new Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : null; } catch (e) { return null; }')();
    } catch (e) { return null; }
  }

  function toast(msg, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error)   return T.error(msg);
      if (T && kind === 'ok'    && T.success) return T.success(msg);
      if (T && T.info) return T.info(msg);
    } catch (e) {}
    console.log('[UserMode]', msg);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
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
    on: true,                                  // işçi rejimi ümumiyyətlə işləsin?
    greeting: '{ad}, xoş gəlmisən 👋',         // {ad} = işçinin adı
    sub: 'Bu gün nə edirik?',
    greetAdminToo: true,
    simpleDash: true,                          // işçiyə ayrı sadə iş masası
    hideTop: true,
    hideFabs: true,
    lockAdminRoutes: true,
    pressDebug: false,
    cards: ['home', 'scan', 'share-inbox', 'fixmode', 'tasks']
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
     1) JollyAuth — repodakı 22 mövcud yoxlamanı canlandırır
        (window.JollyAuth yalnız security.js-də var, o isə
         index.html-ə qoşulmayıb → bütün qadağalar keçirdi)
     ══════════════════════════════════════════════════════════ */
  function can(perm) {
    if (!perm) return true;
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
            key: perm, userId: s ? s.userId : null,
            userName: s ? s.userName : null, at: Date.now()
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
     2) İcazə körpüsü — açarları oxumaq / yazmaq / qeyd etmək
     ══════════════════════════════════════════════════════════ */
  function permState(key) {
    if (!key) return null;                       // açarsız kart — həmişə açıq
    var POS = global.POS || peek('POS');
    if (!POS) return null;
    try {
      if (POS.store && typeof POS.store.getOverride === 'function') {
        var ov = POS.store.getOverride(key);
        if (typeof ov === 'boolean') return ov;
      }
      if (POS.reg && typeof POS.reg.allPerms === 'function') {
        var all = POS.reg.allPerms();
        for (var i = 0; i < all.length; i++) if (all[i].key === key) return !!all[i]['default'];
      }
    } catch (e) {}
    return false;
  }

  function setPerm(key, val) {
    if (!key) return false;
    var POS = global.POS || peek('POS');
    if (!POS || !POS.store || typeof POS.store.setOverride !== 'function') return false;
    try {
      POS.store.setOverride(key, !!val);
      try { if (typeof POS.syncUI === 'function') POS.syncUI(); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  /* ★ KÖK SƏBƏBİN HƏLLİ ★
     Modulun perm açarı POS-da qeydiyyatdan keçməyibsə,
     resolveFor() onu tapmır və HƏMİŞƏ false qaytarır — üstəlik
     İcazə Mərkəzində də görünmür. Hamısını avtomatik qeyd edirik. */
  function syncModulePerms() {
    var POS = global.POS || peek('POS');
    if (!POS || typeof POS.register !== 'function' || !POS.reg) return false;

    var known = {};
    try {
      POS.reg.allPerms().forEach(function (p) {
        if (p.moduleId !== PERM_MOD) known[p.key] = 1;   // öz qrupumuzu saymırıq
      });
    } catch (e) { return false; }

    var perms = [], seen = {};
    function add(key, label) {
      if (!key || known[key] || seen[key]) return;
      seen[key] = 1;
      perms.push({ key: key, label: label || key, tag: 'view', 'default': false });
    }

    CORE.forEach(function (c) { add(c.perm, (c.icon || '') + ' ' + c.label); });

    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    if (MR && typeof MR._all === 'function') {
      var mods = MR._all();
      for (var id in mods) {
        var m = mods[id];
        if (m && m.perm) add(m.perm, (m.icon || '📦') + ' ' + (m.name || id));
      }
    }

    if (!perms.length) return true;
    try {
      POS.register({ id: PERM_MOD, name: 'Modul girişləri', icon: '🧩', permissions: perms });
      return true;
    } catch (e) { return false; }
  }

  /* ══════════════════════════════════════════════════════════
     3) KART KATALOQU — sabit siyahı YOX, canlı siyahı
     ══════════════════════════════════════════════════════════ */
  /* app.js-in öz marşrutları (ModuleRegistry-də deyillər) */
  var CORE = [
    { id: 'home',      route: '#/home',                icon: '🔍', label: 'Axtarış',      perm: 'products.view' },
    { id: 'scan',      route: '#/scan',                icon: '📡', label: 'Barkod skan',  perm: 'barcode.scan' },
    { id: 'new',       route: '#/product/new',         icon: '➕', label: 'Yeni məhsul',  perm: 'products.create' },
    { id: 'favorites', route: '#/dashboard/favorites', icon: '⭐', label: 'Sevimlilər',   perm: 'favorites.use' },
    { id: 'drafts',    route: '#/drafts',              icon: '📝', label: 'Qaralamalar',  perm: null },
    { id: 'dashboard', route: '#/dashboard',           icon: '🏠', label: 'İş masası',    perm: null }
  ];

  /* İşçiyə verilməyəcək ekranlar — admin alətləridir */
  var NEVER = {
    'user-mode': 1, 'module-cleanup': 1, 'testdata': 1, 'selftest': 1,
    'perm-preview': 1, 'health-v2': 1, 'cloud-doctor': 1, 'diag-report': 1,
    'jolly-diag': 1, 'code-studio': 1, 'jolly-settings': 1, 'updates': 1
  };

  /* Bütün mümkün kartlar: CORE + qeydiyyatdan keçmiş modullar */
  function catalog() {
    var out = [], byRoute = {}, byId = {}, i;

    for (i = 0; i < CORE.length; i++) {
      var c = CORE[i];
      out.push({ id: c.id, route: c.route, icon: c.icon, label: c.label, perm: c.perm, group: 'Əsas' });
      byRoute[c.route] = 1; byId[c.id] = 1;
    }

    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    var mods = [];
    try {
      if (MR && typeof MR.list === 'function') mods = MR.list() || [];
      else if (MR && typeof MR._all === 'function') {
        var all = MR._all();
        for (var k in all) mods.push(all[k]);
      }
    } catch (e) { mods = []; }

    for (i = 0; i < mods.length; i++) {
      var m = mods[i];
      if (!m || !m.id || NEVER[m.id]) continue;
      if (byId[m.id] || byRoute[m.route]) continue;
      byId[m.id] = 1; byRoute[m.route] = 1;
      out.push({
        id: m.id, route: m.route || ('#/' + m.id),
        icon: m.icon || '📦', label: m.name || m.id,
        perm: m.perm || null, group: m.group || 'Digər'
      });
    }
    return out;
  }

  function cardById(id) {
    var list = catalog();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* Marşruta görə kart tap — əsl iş masasında uzun basmaq üçün.
     dashboard.js kartları belədir: onclick="JollyRouter.go('#/xxx')" */
  function cardByRoute(route) {
    if (!route) return null;
    route = String(route).split('?')[0];
    var list = catalog();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].route).split('?')[0] === route) return list[i];
    }
    return null;
  }

  var GO_RE  = /JollyRouter\.go\(\s*['"`](#\/[^'"`]+)['"`]/;
  var ANY_RE = /['"`](#\/[a-zA-Z0-9\-\/_]+)['"`]/;   // location.hash='#/x' və s.
  /* Kart sayılan siniflər — marşrutu olmasa da hədəf kimi tanınır */
  var CARD_CLASSES = ['jum-card', 'big-op', 'more-card', 'qa-card', 'gp-stat'];

  function looksLikeCard(el) {
    if (!el || !el.classList) return false;
    for (var i = 0; i < CARD_CLASSES.length; i++) {
      if (el.classList.contains(CARD_CLASSES[i])) return true;
    }
    return false;
  }

  function routeOfEl(el) {
    try {
      if (el.getAttribute) {
        var dr = el.getAttribute('data-route');
        if (dr && dr.charAt(0) === '#') return dr;
        var oc = el.getAttribute('onclick');
        if (oc) {
          var m = oc.match(GO_RE) || oc.match(ANY_RE);
          if (m) return m[1];
        }
        var hf = el.getAttribute('href');
        if (hf && hf.charAt(0) === '#') return hf;
      }
    } catch (e) {}
    return null;
  }

  /* Basılan yerdən yuxarı qalxıb ya .jum-card, ya da marşrutu olan
     hər hansı kartı tapır. Qaytarır: {el, id} və ya null */
  function findPressTarget(target) {
    var el = target, depth = 0, seen = [];
    while (el && el !== document.body && depth < 10) {
      if (el.classList && el.classList.contains('jum-card')) {
        var jid = el.getAttribute('data-jum-id');
        if (jid) return { el: el, id: jid, why: 'jum-card' };
        return null;
      }
      var r = routeOfEl(el);
      if (r) {
        var cd = cardByRoute(r);
        if (cd) return { el: el, id: cd.id, why: 'route ' + r };
        return { el: el, id: null, why: 'route ' + r + ' — kataloqda yoxdur' };
      }
      if (looksLikeCard(el)) {
        seen.push('kart sinfi, marşrut yoxdur');
        return { el: el, id: null, why: 'kart var, marşrut oxunmadı' };
      }
      el = el.parentNode; depth++;
    }
    return null;
  }

  /* Diaqnostika: hər uzun basmada nə tapıldığını ekranda göstərir.
     #/user-mode ekranındakı açardan yandırılır. */
  function pressDebug() { return !!cfg().pressDebug; }

  function debugToast(hit, target) {
    var tag = '?';
    try {
      tag = (target.tagName || '?').toLowerCase() +
            (target.className ? '.' + String(target.className).split(' ')[0] : '');
    } catch (e) {}
    if (!hit)      toast('🔎 basıldı: ' + tag + ' → kart TAPILMADI', 'error');
    else if (!hit.id) toast('🔎 ' + tag + ' → ' + hit.why, 'error');
    else           toast('🔎 tapıldı: ' + hit.id + ' (' + hit.why + ')', 'ok');
  }

  /* ══════════════════════════════════════════════════════════
     4) CSS
     ══════════════════════════════════════════════════════════ */
  function installCss() {
    if (document.getElementById('jum-css')) return;
    var st = document.createElement('style');
    st.id = 'jum-css';
    st.textContent = [
      /* işçi rejimi — sadə görünüş */
      'body.jum-user #cmdBtn,',
      'body.jum-user #backupPill,',
      'body.jum-user #topAiBtn,',
      'body.jum-user #topStudiosBtn{display:none!important;}',
      'body.jum-user-nofab #radialFabRoot,',
      'body.jum-user-nofab .jfab-wrap,',
      'body.jum-user-nofab .quick-fab{display:none!important;}',
      /* iş masası */
      '.jum-hi{padding:18px 0 6px;}',
      '.jum-hi h2{font-family:var(--font-display);margin:0;font-size:23px;line-height:1.25;}',
      '.jum-hi .jum-sub{font-size:12.5px;opacity:.6;margin-top:4px;}',
      '.jum-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px;}',
      '.jum-card{position:relative;border-radius:18px;padding:18px 14px;text-align:center;cursor:pointer;',
      'background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);',
      '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;',
      'transition:transform .12s ease,background .2s ease;}',
      '.jum-card:active{transform:scale(.96);background:rgba(255,255,255,0.09);}',
      '.jum-card .jum-ic{font-size:30px;line-height:1;}',
      '.jum-card .jum-lb{margin-top:9px;font-size:13.5px;font-weight:600;}',
      '.jum-empty{padding:26px 16px;text-align:center;opacity:.6;font-size:13px;}',
      /* redaktə rejimi */
      '.jum-card.jum-edit{border-style:dashed;border-color:rgba(255,255,255,0.22);}',
      '.jum-card.jum-press{transform:scale(.93);background:rgba(245,196,81,.14);}',
      '.jum-lock{position:absolute;top:7px;right:9px;font-size:12px;opacity:.85;}',
      '.jum-add{display:flex;align-items:center;justify-content:center;font-size:32px;',
      'opacity:.55;border-style:dashed!important;min-height:96px;}',
      /* uzun basma menyusu */
      '.jum-sheet{position:fixed;inset:0;z-index:10050;background:rgba(6,7,13,.72);',
      'display:flex;align-items:flex-end;}',
      '.jum-sheet-in{width:100%;background:#12141c;border-radius:20px 20px 0 0;',
      'padding:14px 14px calc(18px + env(safe-area-inset-bottom));',
      'border-top:1px solid rgba(255,255,255,.12);max-height:82vh;overflow:auto;}',
      '.jum-sh-h{display:flex;align-items:center;gap:11px;padding:4px 4px 12px;',
      'border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px;}',
      '.jum-sh-h .i{font-size:26px;}',
      '.jum-sh-h .t{flex:1;min-width:0;}',
      '.jum-sh-h .t b{font-size:15px;display:block;}',
      '.jum-sh-h .t span{font-size:11px;opacity:.5;font-family:ui-monospace,monospace;}',
      '.jum-mi{display:flex;align-items:center;gap:12px;padding:13px 10px;border-radius:13px;',
      'cursor:pointer;font-size:14px;}',
      '.jum-mi:active{background:rgba(255,255,255,.07);}',
      '.jum-mi .mi-ic{font-size:18px;width:24px;text-align:center;flex:none;}',
      '.jum-mi.danger{color:#fca5a5;}',
      '.jum-pick-s{width:100%;padding:12px 14px;border-radius:13px;font-size:16px;color:#e8e8f0;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);outline:none;margin-bottom:10px;}',
      '.jum-pi{display:flex;align-items:center;gap:11px;padding:11px 10px;border-radius:12px;',
      'cursor:pointer;font-size:13.5px;border:1px solid rgba(255,255,255,.07);margin-bottom:6px;}',
      '.jum-pi:active{background:rgba(255,255,255,.07);}',
      '.jum-pi .pi-g{font-size:10.5px;opacity:.42;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  /* ══════════════════════════════════════════════════════════
     5) İş masası — salamlama və işçi ekranı
     ══════════════════════════════════════════════════════════ */
  function greetingText() {
    var c = cfg();
    return String(c.greeting || DEFAULTS.greeting).split('{ad}').join(userName());
  }

  /* edit=true → admin redaktə edir (uzun basma açıqdır, icazə süzgəci yoxdur) */
  function renderUserDash(edit) {
    var c = cfg();
    var ids = c.cards || [];
    var body = '', shown = 0;

    for (var i = 0; i < ids.length; i++) {
      var cd = cardById(ids[i]);
      if (!cd) continue;
      if (!edit && cd.perm && !can(cd.perm)) continue;   // icazəsi yoxdursa kart da yoxdur
      shown++;
      var st = edit && cd.perm ? permState(cd.perm) : null;
      var badge = (edit && cd.perm) ? '<div class="jum-lock">' + (st ? '🔓' : '🔒') + '</div>' : '';
      body += '<div class="jum-card' + (edit ? ' jum-edit' : '') + '" data-jum-id="' + esc(cd.id) + '"' +
                (edit ? ' data-jum-edit="1"' : '') + '>' +
                badge +
                '<div class="jum-ic">' + cd.icon + '</div>' +
                '<div class="jum-lb">' + esc(cd.label) + '</div>' +
              '</div>';
    }

    if (edit) {
      body += '<div class="jum-card jum-edit jum-add" data-jum-add="1">＋</div>';
    }

    var head = '<div class="jum-hi"><h2>' + esc(greetingText()) + '</h2>' +
               '<div class="jum-sub">' + esc(c.sub || '') + '</div></div>';

    if (!shown && !edit) {
      return '<div class="storeos">' + head +
             '<div class="jum-empty">Hələ heç nə açılmayıb.<br>Admin-dən icazə istə.</div></div>';
    }
    return '<div class="storeos">' + head + '<div class="jum-grid">' + body + '</div></div>';
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

  /* ══════════════════════════════════════════════════════════
     5b) DOM EHTİYATI — sarğıya güvənmirik
     ──────────────────────────────────────────────────────────
     `JollyDashboard.render` sarğısı bəzi cihazlarda oturmur
     (const bağlaması, tənbəl yükləmə, başqa modulun öz sarğısı).
     Ona görə ekran çəkiləndən SONRA DOM-un özünə baxırıq:
     işçidirsə sadə ekranı yazırıq, "İş masası" başlığını
     salamlama ilə əvəzləyirik. Bu yol heç bir bağlamadan asılı
     deyil — nə çəkilibsə, onun üstündən işləyir.
     ══════════════════════════════════════════════════════════ */
  function onDashRoute() {
    var h = String(global.location.hash || '');
    return h === '' || h === '#/' || h === '#/dashboard' || h === '#/home';
  }

  function domFix() {
    try { domFixInner(); } catch (e) {}
  }

  function domFixInner() {
    var c = cfg();
    if (!c.on) return;
    var main = document.getElementById('main');
    if (!main || !onDashRoute()) return;

    /* 1) İşçi üçün sadə ekran */
    if (isUser() && c.simpleDash) {
      if (main.querySelector && main.querySelector('.jum-grid')) return;  // artıq bizimdir
      if (main.querySelector && main.querySelector('.jum-empty')) return;
      try { main.innerHTML = renderUserDash(false); } catch (e) {}
      return;
    }

    /* 2) Salamlama başlığı */
    if (!(isUser() || (isAdmin() && c.greetAdminToo))) return;
    if (typeof main.getElementsByTagName !== 'function') return;
    var hs = main.getElementsByTagName('h2');
    for (var i = 0; i < hs.length; i++) {
      var txt = (hs[i].textContent || '').trim();
      if (txt === 'İş masası') {
        try { hs[i].textContent = greetingText(); } catch (e) {}
      }
    }
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
     6) UZUN BASMA — telefon ana ekranı məntiqi
     ══════════════════════════════════════════════════════════ */
  var pressTimer = null, pressEl = null, pressStart = null, suppressClick = false;

  function clearPress() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (pressEl) { try { pressEl.classList.remove('jum-press'); } catch (e) {} pressEl = null; }
    pressStart = null;
  }

  function findCard(target) {
    var el = target;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('jum-card')) return el;
      el = el.parentNode;
    }
    return null;
  }

  function onPressStart(e) {
    if (pressTimer) return;                       // təkrar hadisələr (pointer+touch)
    var t = (e.touches && e.touches[0]) || e;
    if (session() && !isAdmin() && !can(PERM_KEY)) return;

    var card = findCard(e.target);
    if (card && card.getAttribute('data-jum-add') === '1') return;   // ＋ xanası

    var hit = findPressTarget(e.target);
    var dbg = pressDebug();
    if (!hit && !dbg) return;

    pressEl = (hit && hit.el) || null;
    pressStart = { x: t.clientX, y: t.clientY };
    if (pressEl) { try { pressEl.classList.add('jum-press'); } catch (er) {} }

    var tgt = e.target;
    pressTimer = setTimeout(function () {
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (er) {}
      clearPress();
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 700);
      if (dbg) debugToast(hit, tgt);
      if (hit && hit.id) openCardMenu(hit.id);
    }, 450);
  }

  function onPressMove(e) {
    if (!pressStart) return;
    var t = (e.touches && e.touches[0]) || e;
    if (Math.abs(t.clientX - pressStart.x) > 10 || Math.abs(t.clientY - pressStart.y) > 10) clearPress();
  }

  /* Klik: redaktə rejimində menyu açır (naviqasiya mənasızdır),
     işçidə isə adi keçid edir */
  function onClick(e) {
    if (suppressClick) {               // uzun basma menyunu açdı — keçidi ləğv et
      suppressClick = false;
      e.preventDefault(); e.stopPropagation();
      return;
    }
    var card = findCard(e.target);
    if (!card) return;

    if (card.getAttribute('data-jum-add') === '1') {
      e.preventDefault(); e.stopPropagation();
      openPicker();
      return;
    }
    var id = card.getAttribute('data-jum-id');
    if (!id) return;

    if (card.getAttribute('data-jum-edit') === '1') {
      e.preventDefault(); e.stopPropagation();
      openCardMenu(id);
      return;
    }
    var cd = cardById(id);
    if (cd) API.go(cd.route);
  }

  function installGestures() {
    if (document.__jumGest) return;
    document.__jumGest = true;
    /* CAPTURE fazası (üçüncü arqument true) — hadisə əvvəlcə bizə gəlir.
       Bubble fazasında olsaydı, aşağıdakı hər hansı kodun
       stopPropagation() çağırışı jesti tamamilə öldürə bilərdi. */
    document.addEventListener('touchstart', onPressStart, { passive: true, capture: true });
    document.addEventListener('touchmove',  onPressMove,  { passive: true, capture: true });
    document.addEventListener('touchend',   clearPress,   { passive: true, capture: true });
    document.addEventListener('touchcancel',clearPress,   { passive: true, capture: true });
    document.addEventListener('pointerdown',onPressStart, true);
    document.addEventListener('pointerup',  clearPress,   true);
    document.addEventListener('mousedown',  onPressStart, true);
    document.addEventListener('mousemove',  onPressMove,  true);
    document.addEventListener('mouseup',    clearPress,   true);
    document.addEventListener('click',      onClick, true);
  }

  /* ── alt vərəq (sheet) ─────────────────────────────────── */
  function closeSheet() {
    var s = document.getElementById('jumSheet');
    if (s) s.parentNode.removeChild(s);
  }

  function sheet(innerHtml) {
    closeSheet();
    var d = document.createElement('div');
    d.id = 'jumSheet';
    d.className = 'jum-sheet';
    d.innerHTML = '<div class="jum-sheet-in">' + innerHtml + '</div>';
    d.addEventListener('click', function (ev) { if (ev.target === d) closeSheet(); });
    document.body.appendChild(d);
    return d;
  }

  function openCardMenu(id) {
    var cd = cardById(id);
    if (!cd) { toast('Bu kart artıq mövcud deyil', 'error'); return; }
    var c = cfg();
    var pos = c.cards.indexOf(id);
    var st = cd.perm ? permState(cd.perm) : null;

    var h = [];
    h.push('<div class="jum-sh-h"><span class="i">' + cd.icon + '</span>' +
           '<span class="t"><b>' + esc(cd.label) + '</b><span>' + esc(cd.route) + '</span></span></div>');

    if (cd.perm) {
      h.push('<div class="jum-mi" onclick="JollyUserMode.flipPerm(\'' + esc(id) + '\')">' +
               '<span class="mi-ic">' + (st ? '🔓' : '🔒') + '</span>' +
               '<span>' + (st ? 'İcazə AÇIQDIR — bağla' : 'İcazə BAĞLIDIR — aç') + '</span></div>');
    } else {
      h.push('<div class="jum-mi" style="opacity:.45;"><span class="mi-ic">🔓</span>' +
             '<span>İcazə açarı yoxdur — həmişə açıq</span></div>');
    }

    if (pos > 0) {
      h.push('<div class="jum-mi" onclick="JollyUserMode.move(\'' + esc(id) + '\',-1)">' +
             '<span class="mi-ic">⬅</span><span>Əvvələ çək</span></div>');
    }
    if (pos !== -1 && pos < c.cards.length - 1) {
      h.push('<div class="jum-mi" onclick="JollyUserMode.move(\'' + esc(id) + '\',1)">' +
             '<span class="mi-ic">➡</span><span>Sona çək</span></div>');
    }

    if (pos === -1) {
      h.push('<div class="jum-mi" onclick="JollyUserMode.addCard(\'' + esc(id) + '\')">' +
             '<span class="mi-ic">➕</span><span>İşçinin ekranına əlavə et</span></div>');
    } else {
      h.push('<div class="jum-mi danger" onclick="JollyUserMode.hideCard(\'' + esc(id) + '\')">' +
             '<span class="mi-ic">👁</span><span>İşçidən gizlət (kartı sil)</span></div>');
    }
    h.push('<div class="jum-mi" onclick="JollyUserMode.closeSheet()" style="opacity:.6;">' +
           '<span class="mi-ic">✕</span><span>Bağla</span></div>');

    sheet(h.join(''));
  }

  function openPicker() {
    var c = cfg();
    var list = catalog().filter(function (x) { return c.cards.indexOf(x.id) === -1; });
    var h = [];
    h.push('<div class="jum-sh-h"><span class="i">＋</span>' +
           '<span class="t"><b>Kart əlavə et</b><span>' + list.length + ' modul mövcuddur</span></span></div>');
    h.push('<input class="jum-pick-s" id="jumPickS" placeholder="Axtar…" oninput="JollyUserMode.filterPick(this.value)">');
    h.push('<div id="jumPickL">');
    if (!list.length) {
      h.push('<div class="jum-empty">Hamısı artıq əlavə olunub 👍</div>');
    } else {
      for (var i = 0; i < list.length; i++) {
        var x = list[i];
        h.push('<div class="jum-pi" data-nm="' + esc((x.label + ' ' + x.group).toLowerCase()) + '" ' +
                 'onclick="JollyUserMode.addCard(\'' + esc(x.id) + '\')">' +
                 '<span style="font-size:20px;">' + x.icon + '</span>' +
                 '<span style="flex:1;">' + esc(x.label) +
                   '<div class="pi-g">' + esc(x.group) + (x.perm ? ' · ' + esc(x.perm) : '') + '</div>' +
                 '</span>' +
                 '<span style="font-size:15px;opacity:.6;">＋</span>' +
               '</div>');
      }
    }
    h.push('</div>');
    sheet(h.join(''));
  }

  /* ══════════════════════════════════════════════════════════
     7) Admin ekranı — #/user-mode
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
    /* Sessiya ümumiyyətlə yoxdursa (PIN qurulmayıb / giriş edilməyib)
       proqram kilidsizdir — ekranı bağlamağın mənası yoxdur.
       Yalnız GİRİŞ EDİLMİŞ və admin OLMAYAN halda bağlanır. */
    if (session() && !isAdmin() && !can(PERM_KEY)) {
      return '<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>';
    }
    syncModulePerms();

    var c = cfg();
    var total = catalog().length;
    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
             '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">👥 İşçi Rejimi</h2>' +
             '<div class="muted" style="font-size:12.5px;">v2.6 · Karta basıb saxla — sil, gizlət, icazə ver</div>' +
           '</div></div>');

    h.push('<div class="glass" style="padding:11px 13px;margin:10px 0 4px;font-size:12.5px;line-height:1.5;">' +
             'Aşağıdakı ekran işçinin gördüyünün eynisidir. Uzun basma <b>əsl iş masasında da</b> işləyir. ' +
             '<b>Basıb saxla</b> → menyu. <b>＋</b> → yeni kart. ' +
             '<span style="opacity:.6;">' + c.cards.length + ' / ' + total + ' kart seçilib</span>' +
           '</div>');

    /* CANLI redaktə olunan iş masası */
    h.push(renderUserDash(true));

    /* Vəziyyət paneli — nə quruldu, nə yox */
    function dot(v) { return v ? '<span style="color:#4ade80;">✓</span>' : '<span style="color:#fca5a5;">✗</span>'; }
    h.push('<div class="glass" style="padding:12px 14px;margin-top:14px;font-size:12.5px;line-height:1.9;">' +
             '<div style="font-weight:600;margin-bottom:4px;">Vəziyyət</div>' +
             dot(_state.add)  + ' Məhsul əlavəsi qadağası<br>' +
             dot(_state.perm) + ' İcazə qeydiyyatı<br>' +
             dot(_state.mod)  + ' Modul qeydiyyatı<br>' +
             dot(!!domObs)    + ' Ekran müşahidəçisi (salamlama · işçi ekranı)<br>' +
             dot(!!document.__jumGest) + ' Uzun basma jesti<br>' +
             '<span style="opacity:.55;">' + (_state.wrap ? '✓' : '—') + ' Dashboard sarğısı (lazım deyil, DOM ehtiyatı işləyir)</span>' +
           '</div>');

    /* Uzun basma testi */
    h.push('<div class="glass jum-card" data-jum-id="dashboard" data-jum-edit="1" ' +
             'style="padding:14px;margin-top:14px;border:1px dashed rgba(255,255,255,.25);text-align:center;">' +
             '<div style="font-size:26px;">👆</div>' +
             '<div style="font-size:13px;font-weight:600;margin-top:6px;">Bura basıb saxla — TEST</div>' +
             '<div class="muted" style="font-size:11.5px;margin-top:3px;">Menyu çıxırsa jest işləyir</div>' +
           '</div>');
    h.push(sw('pressDebug', c.pressDebug, '🔎 Uzun basma testi', 'Yandırsan, hər basmada nə tapıldığını yazır'));

    h.push('<div style="margin:16px 0 4px;display:flex;gap:8px;flex-wrap:wrap;">' +
             '<button class="btn" onclick="JollyUserMode.clearAll()">🗑 Hamısını sil</button>' +
             '<button class="btn" onclick="JollyUserMode.addAll()">✚ Hamısını əlavə et</button>' +
             '<button class="btn" onclick="JollyUserMode.reset()">↩ Standart</button>' +
           '</div>');

    /* Salamlama */
    h.push('<div class="section-title" style="margin-top:18px;">Salamlama</div>');
    h.push('<div class="glass" style="padding:14px;margin-bottom:9px;">' +
             '<div class="muted" style="font-size:11.5px;margin-bottom:6px;">{ad} yerinə işçinin adı yazılır</div>' +
             '<input id="jumGreet" class="input" style="width:100%;margin-bottom:8px;" value="' + esc(c.greeting) + '">' +
             '<input id="jumSub" class="input" style="width:100%;margin-bottom:10px;" value="' + esc(c.sub) + '">' +
             '<div style="font-size:12px;opacity:.65;margin-bottom:10px;">Görünüş: <b>' + esc(greetingText()) + '</b></div>' +
             '<button class="btn btn-primary" onclick="JollyUserMode.saveGreeting()">Yadda saxla</button>' +
           '</div>');
    h.push(sw('greetAdminToo', c.greetAdminToo, 'Admin də adı ilə salamlansın', 'Söndürsən, admin ekranında yenə "İş masası" yazılır'));

    /* Açarlar */
    h.push('<div class="section-title" style="margin-top:16px;">Sadələşdirmə</div>');
    h.push(sw('simpleDash', c.simpleDash, 'İşçiyə ayrı sadə iş masası', 'Söndürsən, işçi də adi iş masasını görür'));
    h.push(sw('hideTop', c.hideTop, 'Yuxarı düymələri gizlət', 'Studio · AI Brain · ⌘ · backup'));
    h.push(sw('hideFabs', c.hideFabs, 'Üzən dairəvi menyuları gizlət', 'Radial menyu və sürətli düymələr'));
    h.push(sw('lockAdminRoutes', c.lockAdminRoutes, 'Admin ekranlarını bağla', 'Linki əl ilə yazsa belə girə bilməz'));
    h.push(sw('on', c.on, 'İşçi rejimi ümumiyyətlə işləsin', 'Söndürsən, hər şey əvvəlki halına qayıdır'));

    h.push('<div style="height:30px;"></div>');
    h.push('</div>');
    return h.join('');
  }

  function refresh() {
    var A = global.JollyApp || peek('JollyApp');
    try { if (A && A.render) A.render(); } catch (e) {}
  }
  function reRenderAdmin() {
    closeSheet();
    if (String(global.location.hash || '') === ROUTE) {
      var el = document.getElementById('main');
      if (el) { el.innerHTML = renderAdmin(); return; }
    }
    refresh();
  }

  /* ══════════════════════════════════════════════════════════
     8) Açıq API
     ══════════════════════════════════════════════════════════ */
  var API = {
    go: function (route) {
      var R = global.JollyRouter || peek('JollyRouter');
      if (R && R.go) R.go(route); else global.location.hash = route;
    },
    closeSheet: closeSheet,

    toggle: function (key) {
      var c = cfg(), p = {};
      p[key] = !c[key];
      saveCfg(p);
      applyBodyFlags();
      reRenderAdmin();
    },

    /* uzun basma menyusu */
    flipPerm: function (id) {
      var cd = cardById(id);
      if (!cd || !cd.perm) return;
      var now = permState(cd.perm);
      if (setPerm(cd.perm, !now)) {
        toast(!now ? '🔓 ' + cd.label + ' — icazə verildi' : '🔒 ' + cd.label + ' — icazə bağlandı', 'ok');
      } else {
        toast('İcazə mühərriki tapılmadı', 'error');
      }
      reRenderAdmin();
    },
    hideCard: function (id) {
      var c = cfg(), list = c.cards.slice(), i = list.indexOf(id);
      if (i !== -1) list.splice(i, 1);
      saveCfg({ cards: list });
      reRenderAdmin();
    },
    addCard: function (id) {
      var c = cfg(), list = c.cards.slice();
      if (list.indexOf(id) === -1) list.push(id);
      saveCfg({ cards: list });
      reRenderAdmin();
    },
    move: function (id, dir) {
      var c = cfg(), list = c.cards.slice(), i = list.indexOf(id);
      if (i === -1) return;
      var j = i + dir;
      if (j < 0 || j >= list.length) return;
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      saveCfg({ cards: list });
      reRenderAdmin();
    },
    filterPick: function (q) {
      q = String(q || '').toLowerCase().trim();
      var box = document.getElementById('jumPickL');
      if (!box) return;
      var rows = box.getElementsByClassName('jum-pi');
      for (var i = 0; i < rows.length; i++) {
        var nm = rows[i].getAttribute('data-nm') || '';
        rows[i].style.display = (!q || nm.indexOf(q) !== -1) ? '' : 'none';
      }
    },

    clearAll: function () {
      saveCfg({ cards: [] });
      toast('İşçi ekranı boşaldıldı — indi bir-bir əlavə et', 'ok');
      reRenderAdmin();
    },
    addAll: function () {
      var ids = catalog().map(function (x) { return x.id; });
      saveCfg({ cards: ids });
      toast(ids.length + ' kart əlavə olundu', 'ok');
      reRenderAdmin();
    },

    saveGreeting: function () {
      var g = document.getElementById('jumGreet');
      var s = document.getElementById('jumSub');
      saveCfg({
        greeting: g ? g.value : DEFAULTS.greeting,
        sub: s ? s.value : DEFAULTS.sub
      });
      toast('Salamlama yadda saxlanıldı', 'ok');
      reRenderAdmin();
    },
    reset: function () {
      try { localStorage.removeItem(CFG_KEY); } catch (e) {}
      applyBodyFlags();
      toast('Standart hala qaytarıldı', 'ok');
      reRenderAdmin();
    },

    /* köhnə adlar — uyğunluq üçün saxlanılır */
    toggleCard: function (id) {
      var c = cfg();
      if (c.cards.indexOf(id) === -1) API.addCard(id); else API.hideCard(id);
    },
    preview: function () { API.go(ROUTE); },
    _r: refresh,

    render: renderAdmin,
    can: can,
    cfg: cfg,
    isUser: isUser,
    isAdmin: isAdmin,
    greeting: greetingText,
    cards: catalog,
    catalog: catalog,
    syncPerms: syncModulePerms,
    permState: permState,
    _findPressTarget: findPressTarget,
    _renderUserDash: renderUserDash,
    _applyGreeting: applyGreeting
  };
  global.JollyUserMode = API;

  /* ══════════════════════════════════════════════════════════
     9) Qeydiyyat
     ══════════════════════════════════════════════════════════ */
  function registerPerm() {
    var POS = global.POS || peek('POS');
    if (!POS || typeof POS.register !== 'function') return false;
    try {
      POS.register({
        id: 'usermode', name: 'İşçi Rejimi', icon: '👥',
        permissions: [{ key: PERM_KEY, label: 'İşçi rejimini idarə et', tag: 'system', 'default': false }]
      });
      return true;
    } catch (e) { return false; }
  }

  function registerModule() {
    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    if (!MR || typeof MR.register !== 'function') return false;
    try {
      /* ⚠️ perm: QƏSDƏN VERİLMİR.
         module-registry.js `_allowed()` = POS.can(m.perm); açarın
         standartı false olduğu üçün sessiya yoxdursa modul siyahıdan
         TAMAMİLƏ düşürdü — ekran var idi, amma heç yerdə görünmürdü.
         İcazə yoxlaması indi renderAdmin() içindədir. */
      MR.register({
        id: 'user-mode', name: 'İşçi Rejimi', icon: '👥',
        route: ROUTE, group: 'JOLLY',
        render: renderAdmin
      });
      return true;
    } catch (e) { return false; }
  }

  /* ══════════════════════════════════════════════════════════
     10) Açılış
     ══════════════════════════════════════════════════════════ */
  var tries = 0;
  function boot() {
    installAuth();
    installCss();
    installGestures();
    applyBodyFlags();

    var ok1 = installAddGuard();
    var ok2 = installDashboardWrap();
    var ok3 = registerPerm();
    var ok4 = registerModule();
    _wrapOk = ok2;
    _state = { add: ok1, wrap: ok2, perm: ok3, mod: ok4 };

    var coreOk = ok1 && ok3 && ok4;
    ++tries;
    if (coreOk && ok2) {
      syncModulePerms();
      console.log('[UserMode v2.6] hazırdır — kataloq:', catalog().length, 'kart');
      
      guardRoute();
      schedulePermSync();
      startDomFix();
      return;
    }
    if (tries > 40) {
      if (!ok2) {
        console.warn('[UserMode] dashboard sarğısı uğursuz — hər render-də cəhd ediləcək');
        global.addEventListener('jolly:rendered', function tryDash() {
          if (installDashboardWrap()) {
            console.log('[UserMode] dashboard sarğısı qoşuldu');
            global.removeEventListener('jolly:rendered', tryDash);
          }
        });
      }
      syncModulePerms();
      schedulePermSync();
      if (!coreOk) console.warn('[UserMode] tam qoşula bilmədi:', { add: ok1, dashboard: ok2, perm: ok3, module: ok4 });
      /* dashboard sarğısı ARTIQ ŞƏRT DEYİL — DOM ehtiyatı onu əvəz edir.
         Səbəb (03.08 tapıldı): jolly-toast-compat.js yalnız 13 adı
         window-a bağlayır və JollyDashboard onların arasında deyil. */
      var miss = [];
      if (!ok1) miss.push('qadağa');
      if (!ok3) miss.push('icazə');
      if (!ok4) miss.push('modul');
      if (miss.length) toast('👥 v2.6 — qurulmadı: ' + miss.join(', '), 'error');
      guardRoute();
      startDomFix();
      return;
    }
    setTimeout(boot, 250);
  }

  /* Modullar tənbəl yüklənir (jolly-lazy-loader.js) — sonradan gələn
     modulların icazə açarları da qeydiyyata düşməlidir */
  var domT = null, domObs = null, domBusy = false;
  var _wrapOk = false, _state = { add: false, perm: false, mod: false, wrap: false };

  /* Taymer 700 ms gecikmə ilə işləyirdi — ekran yenidən çəkiləndə
     köhnə başlıq bir anlıq görünüb yox olurdu ("gəlir-gedir").
     MutationObserver dəyişikliyi DƏRHAL tutur, gözlə görünmür.
     Taymer yalnız ehtiyat kimi qalır (observer qurulmayan hallar üçün). */
  function domFixSafe() {
    if (domBusy) return;
    domBusy = true;
    try { domFix(); } catch (e) {}
    domBusy = false;
  }

  function attachObserver() {
    if (domObs) return true;
    var target = document.getElementById('main') || document.body;
    if (!target) return false;
    try {
      domObs = new MutationObserver(function () { domFixSafe(); });
      domObs.observe(target, { childList: true, subtree: true });
      return true;
    } catch (e) { domObs = null; return false; }
  }

  function startDomFix() {
    if (domT) return;
    domFixSafe();
    attachObserver();
    domT = setInterval(function () {
      if (!domObs) attachObserver();
      if (!_wrapOk) _wrapOk = installDashboardWrap();   // gec gəlsə də tutaq
      domFixSafe();
    }, 1200);
    global.addEventListener('hashchange', function () {
      setTimeout(function () { attachObserver(); domFixSafe(); }, 60);
    });
  }

  var syncT = null;
  function schedulePermSync() {
    if (syncT) clearTimeout(syncT);
    syncT = setTimeout(function () { syncModulePerms(); }, 1200);
  }
  setTimeout(syncModulePerms, 4000);
  setTimeout(syncModulePerms, 12000);

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
    closeSheet();
    applyBodyFlags();
    guardRoute();
    schedulePermSync();
  });

})(typeof window !== 'undefined' ? window : this);
