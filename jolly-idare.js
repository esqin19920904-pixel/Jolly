/* ============================================================
   JOLLY İdarə Mərkəzi — jolly-idare.js
   v1.0  (2026-08-15)

   ────────────────────────────────────────────────────────────
   NİYƏ BU FAYL VAR

   İcazə anbarına YEDDİ yerdən toxunulurdu: permission-engine,
   jolly-perms-extra, jolly-perm-bridge, jolly-user-mode
   (syncModulePerms hər hashchange-də açarları yenidən qeyd
   edirdi), jolly-modul-qovlugu (süni ui.card.* açarları),
   module-registry filtri və whitelist qatı. "Təmirçi" fayllar
   `overrides` qabını bərpa edərkən yenidən yazırdı — Esqinin
   qoyduğu qadağa səhifə yenilənəndə itirdi.

   HƏLL: bu ekranın idarə etdiyi HƏR ŞEY TƏK AÇARDA saxlanılır
   və o açara BAŞQA HEÇ BİR FAYL toxunmur:

       jolly_idare = {
         v: 1,
         hidden: ['modul-id', ...],         // ADMIN öz iş masası
         allow:  { 'userId': ['modul-id'] } // hər işçiyə ayrıca
       }

   Nə standart dəyər, nə qlobal override, nə süni açar, nə
   təmirçi. Qadağa qoyulanda qadağa qalır.

   ────────────────────────────────────────────────────────────
   QAYDA
     · Admin — hər şeyi görür; yalnız ÖZÜ söndürdükləri gizlənir
       (söndürülən modul birbaşa ünvanla yenə açılır — heç nə
        itmir, sadəcə gözdən yığışdırılır)
     · İşçi — YALNIZ `allow[userId]` siyahısındakıları görür;
       qalanı nə görünür, nə də açılır

   permission-engine.js-ə TOXUNULMUR — o, başqa yerlərdə
   (məhsul yaratmaq və s.) işini görməyə davam edir.
   ============================================================ */
(function (global) {
  'use strict';

  var KEY   = 'jolly_idare';
  var ROUTE = '#/idare';
  var VER   = 1;

  /* JOLLY-nin əsas modulları `const`-dur və window-a yapışmır —
     onları yalnız belə oxumaq olur (Function qlobal əhatədədir) */
  function peek(name) {
    try {
      return new Function('try{return typeof ' + name + '!=="undefined"?' + name + ':null}catch(e){return null}')();
    } catch (e) { return null; }
  }
  function REG()   { return global.ModuleRegistry || peek('ModuleRegistry'); }
  function USERS() { return global.JollyUsers || peek('JollyUsers'); }

  function toast(msg, kind) {
    var T = global.Toast || peek('Toast');
    try {
      if (T && kind === 'error' && T.error)   return T.error(msg);
      if (T && kind === 'ok'    && T.success) return T.success(msg);
      if (T && T.info) return T.info(msg);
    } catch (e) {}
    console.log('[İdarə]', msg);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ══════════════════════════════════════════════════════════
     Yeganə anbar
     ══════════════════════════════════════════════════════════ */
  function cfg() {
    var c = null;
    try { c = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { c = null; }
    if (!c || typeof c !== 'object') c = {};
    if (!Array.isArray(c.hidden)) c.hidden = [];
    if (!c.allow || typeof c.allow !== 'object') c.allow = {};
    /* İş masası kartları — hədəf üzrə: '__me' = admin, qalanı işçi id-si */
    if (!c.dash || typeof c.dash !== 'object' || Array.isArray(c.dash)) c.dash = {};
    c.v = VER;
    return c;
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); return true; }
    catch (e) { toast('Yaddaşa yazıla bilmədi', 'error'); return false; }
  }

  /* ══════════════════════════════════════════════════════════
     Sessiya
     ══════════════════════════════════════════════════════════ */
  function me() {
    try { return JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); }
    catch (e) { return null; }
  }
  function isAdmin() { var s = me(); return !!(s && s.role === 'admin'); }
  function isUser()  { var s = me(); return !!(s && s.role === 'user'); }
  function myId()    { var s = me(); return (s && s.userId) || ''; }

  /* ══════════════════════════════════════════════════════════
     Modul siyahısı
     ══════════════════════════════════════════════════════════ */
  /* Bu ekranın özü siyahıda göstərilmir */
  var SKIP = { 'idare': 1 };

  /* ══════════════════════════════════════════════════════════
     NÜVƏ MARŞRUTLARI
     ──────────────────────────────────────────────────────────
     Proqramdakı hər şey ModuleRegistry-də qeydiyyatdan keçmir —
     JOLLY Chat, AI Brain, Məhsullar, Skan və s. `app.js`-in və
     digər faylların öz marşrutlarıdır. Ona görə İdarə siyahısında
     görünmürdülər və Esqin onlara icazə verə bilmirdi.
     İndi hamısı buradadır: 53 marşrutun hər biri idarə olunur.
     ══════════════════════════════════════════════════════════ */
  var CORE = [
    ['home',            '#/home',                'Ana səhifə',          '🏠', 'Əsas'],
    ['dashboard',       '#/dashboard',           'İş masası',           '⌂', 'Əsas'],
    ['products',        '#/products',            'Məhsullar',           '📦', 'Əsas'],
    ['scan',            '#/scan',                'Skan',                '▣', 'Əsas'],
    ['drafts',          '#/drafts',              'Qaralamalar',         '📝', 'Əsas'],
    ['notifications',   '#/notifications',       'Bildirişlər',         '🔔', 'Əsas'],
    ['studios',         '#/studios',             'Studio',              '⚙️', 'Əsas'],

    ['chat',            '#/chat',                'JOLLY Chat',          '💬', 'AI'],
    ['brain',           '#/brain',               'AI Brain',            '🧠', 'AI'],
    ['insight',         '#/insight',             'İdrak',               '✨', 'AI'],

    ['barcode-folder',  '#/barcode-folder',      'Barkod Qovluğu',      '🏷', 'Barkod'],
    ['barcode-fix',     '#/barcode-fix',         'Barkod düzəlişi',     '🛠', 'Barkod'],
    ['barcode-view',    '#/barcode-view',        'Barkodu göstər',      '🧾', 'Barkod'],

    ['qovluq',          '#/qovluq',              'Qovluqlar',           '🗂', 'Anbar'],
    ['receiving',       '#/receiving',           'Mal Qəbulu',          '🚚', 'Anbar'],
    ['share-inbox',     '#/share-inbox',         'Gələnlər',            '📥', 'Anbar'],
    ['store-map',       '#/store-map',           'Rəf xəritəsi',        '🗺', 'Anbar'],
    ['map',             '#/map',                 'Xəritə',              '📍', 'Anbar'],
    ['supplier-products','#/supplier-products',  'Tədarükçü Malları',   '🚛', 'Anbar'],

    ['marked-for-deletion','#/marked-for-deletion','Silinəcəklər',      '🗑', 'Alətlər'],
    ['history',         '#/history',             'Tarixçə',             '🕐', 'Alətlər'],
    ['data-doctor',     '#/data-doctor',         'Data Doktoru',        '🩺', 'Alətlər'],
    ['undo',            '#/undo',                'Geri Al Mərkəzi',     '↶', 'Alətlər'],
    ['image-guard',     '#/image-guard',         'Şəkil Qoruyucusu',    '🖼', 'Alətlər'],
    ['health-v2',       '#/health-v2',           'Nüvə Sağlamlığı',     '❤️', 'Alətlər'],
    ['cloud-doctor',    '#/cloud-doctor',        'Bulud Doktoru',       '☁️', 'Alətlər'],
    ['updates',         '#/updates',             'Yeniliklər',          '🆕', 'Alətlər'],
    ['user-mode',       '#/user-mode',           'İşçi Rejimi (köhnə)', '👥', 'Köhnə'],
    ['modules',         '#/modules',             'Modul Qovluğu (köhnə)','📂', 'Köhnə']
  ];

  function modules() {
    var R = REG(), out = [], raw = [];
    try {
      if (R && typeof R._all === 'function') {
        var all = R._all();
        for (var k in all) raw.push(all[k]);
      } else if (R && typeof R.list === 'function') {
        raw = R.list() || [];
      }
    } catch (e) { raw = []; }

    for (var i = 0; i < raw.length; i++) {
      var m = raw[i];
      if (!m || !m.id || SKIP[m.id]) continue;
      out.push({
        id: m.id,
        name: m.name || m.id,
        icon: m.icon || '📦',
        route: String(m.route || ('#/' + m.id)).split('?')[0],
        group: m.group || 'Digər'
      });
    }
    /* Qeydiyyatsız nüvə marşrutlarını əlavə et (təkrar olmasın) */
    var haveRoute = {}, haveId = {};
    for (var q = 0; q < out.length; q++) { haveRoute[out[q].route] = 1; haveId[out[q].id] = 1; }
    for (var c = 0; c < CORE.length; c++) {
      var x = CORE[c];
      if (haveRoute[x[1]] || haveId[x[0]] || SKIP[x[0]]) continue;
      out.push({ id: x[0], name: x[2], icon: x[3], route: x[1], group: x[4] });
    }

    var ORD = { 'Əsas': 1, 'AI': 2, 'Barkod': 3, 'Anbar': 4, 'Alətlər': 5 };
    out.sort(function (a, b) {
      var ga = ORD[a.group] || 8, gb = ORD[b.group] || 8;
      if (a.group === 'Köhnə') ga = 9;
      if (b.group === 'Köhnə') gb = 9;
      if (ga !== gb) return ga - gb;
      if (a.group !== b.group) return String(a.group).localeCompare(String(b.group), 'az');
      return String(a.name).localeCompare(String(b.name), 'az');
    });
    return out;
  }

  function moduleByRoute(route) {
    route = String(route || '').split('?')[0];
    if (!route) return null;
    var list = modules();
    for (var i = 0; i < list.length; i++) if (list[i].route === route) return list[i];
    return null;
  }

  /* ══════════════════════════════════════════════════════════
     Yeganə qərar nöqtəsi
     ══════════════════════════════════════════════════════════ */
  /* ★ Bunlar HEÇ VAXT bağlanmır — işçinin öz iş masası və ana
     səhifəsidir. Əks halda giriş edən kimi "icazən yoxdur" çıxır
     və proqram öz-özünü bloklayır. */
  var ALWAYS = { home: 1, dashboard: 1, scan: 1 };

  function allowed(id) {
    if (!id) return true;
    /* Kassir rejimində qadağa CC-dədir — burada mane olmuruq */
    try {
      var CC3 = global.JollyCC;
      if (CC3 && typeof CC3.isWorker === 'function' && CC3.isWorker()) return true;
    } catch (e) {}
    if (ALWAYS[id]) return true;
    var c = cfg();
    if (isAdmin()) return c.hidden.indexOf(id) === -1;
    if (isUser())  return (c.allow[myId()] || []).indexOf(id) !== -1;
    return true;                       /* giriş edilməyibsə kilidləmirik */
  }

  function setAdminHidden(id, hide) {
    var c = cfg(), i = c.hidden.indexOf(id);
    if (hide && i === -1) c.hidden.push(id);
    if (!hide && i !== -1) c.hidden.splice(i, 1);
    save(c);
  }

  function setUserAllow(uid, id, on) {
    var c = cfg();
    if (!Array.isArray(c.allow[uid])) c.allow[uid] = [];
    var i = c.allow[uid].indexOf(id);
    if (on && i === -1) c.allow[uid].push(id);
    if (!on && i !== -1) c.allow[uid].splice(i, 1);
    save(c);
  }

  /* ══════════════════════════════════════════════════════════
     İŞ MASASI KARTLARI
     Esqin: "mən dashboarda istəyəndə əlavə edib, istəyəndə silim
     — həmin şeyi Zülfüqarda da edə bilim". Ona görə hədəf seçilir:
     '__me' (admin özü) və ya işçinin id-si.
     ══════════════════════════════════════════════════════════ */
  var ME = '__me';

  function dashOf(target) {
    var c = cfg();
    return Array.isArray(c.dash[target]) ? c.dash[target] : [];
  }
  function setDash(target, id, on) {
    var c = cfg();
    if (!Array.isArray(c.dash[target])) c.dash[target] = [];
    var i = c.dash[target].indexOf(id);
    if (on && i === -1) c.dash[target].push(id);
    if (!on && i !== -1) c.dash[target].splice(i, 1);
    save(c);
  }

  /* Bu cihazda kimin iş masası göstərilir */
  function myDashKey() { return isAdmin() ? ME : (myId() || ME); }

  var DASH_ROUTES = { '#/dashboard': 1, '#/home': 1, '': 1, '#/': 1 };

  function onDash() {
    var h = String(global.location.hash || '').split('?')[0];
    return !!DASH_ROUTES[h];
  }

  /* Seçilmiş kartları iş masasına əlavə edir.
     Ekran yenidən çəkiləndə MutationObserver bunu təkrar çağırır. */
  function injectDash() {
    if (!onDash()) return;
    var main = document.getElementById('main');
    if (!main) return;
    if (document.getElementById('id-dash')) return;      /* artıq var */

    var ids = dashOf(myDashKey());
    if (!ids.length) return;

    var all = modules(), pick = [];
    for (var i = 0; i < ids.length; i++) {
      for (var j = 0; j < all.length; j++) {
        if (all[j].id === ids[i] && allowed(all[j].id)) { pick.push(all[j]); break; }
      }
    }
    if (!pick.length) return;

    var box = document.createElement('div');
    box.id = 'id-dash';
    box.innerHTML =
      '<div class="id-dash-t">⌂ Mənim kartlarım</div>' +
      '<div class="id-dash-g">' + pick.map(function (m) {
        return '<div class="id-dash-c" onclick="JollyIdare.open(\'' + esc(m.route) + '\')">' +
               '<div class="i">' + m.icon + '</div>' +
               '<div class="t">' + esc(m.name) + '</div></div>';
      }).join('') + '</div>';

    try { main.insertBefore(box, main.firstChild); }
    catch (e) { try { main.appendChild(box); } catch (e2) {} }
  }

  function bulkUser(uid, on) {
    var c = cfg();
    c.allow[uid] = on ? modules().map(function (m) { return m.id; }) : [];
    save(c);
  }

  /* ══════════════════════════════════════════════════════════
     Ekranda tətbiq
     ══════════════════════════════════════════════════════════ */
  var GO_RE  = /JollyRouter\.go\(\s*['"`](#\/[^'"`]+)['"`]/;
  var ANY_RE = /['"`](#\/[a-zA-Z0-9\-\/_]+)['"`]/;

  function routeOf(el) {
    try {
      if (!el || !el.getAttribute) return null;
      var dr = el.getAttribute('data-route');
      if (dr && dr.charAt(0) === '#') return dr;
      var oc = el.getAttribute('onclick');
      if (oc) {
        var m = oc.match(GO_RE) || oc.match(ANY_RE);
        if (m) return m[1];
      }
      var hf = el.getAttribute('href');
      if (hf && hf.charAt(0) === '#') return hf;
    } catch (e) {}
    return null;
  }

  /* Yalnız TANINAN modul linkləri gizlədilir. Məhsul kartı
     (#/product/xxx) kimi naməlum linklərə toxunulmur — əks
     halda icazə verilən ekranın öz içi də boşalardı. */
  function sweep() {
    /* Kassir rejimində menyunu gizlətmək də CC-nin işidir */
    try {
      var CC2 = global.JollyCC;
      if (CC2 && typeof CC2.isWorker === 'function' && CC2.isWorker()) return;
    } catch (e) {}

    var s = me();
    if (!s) return;                                  /* girişsiz — toxunma */
    var els;
    try { els = document.querySelectorAll('[onclick],[href],[data-route]'); }
    catch (e) { return; }

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var r = routeOf(el);
      if (!r) continue;
      var m = moduleByRoute(r);
      if (!m) continue;

      var ok = allowed(m.id);
      if (ok) {
        if (el.__idHid) { el.style.display = el.__idPrev || ''; el.__idHid = false; }
      } else if (!el.__idHid) {
        el.__idPrev = el.style.display;
        el.style.display = 'none';
        el.__idHid = true;
      }
    }
  }

  /* İşçi ünvanı əl ilə yazsa belə girə bilməsin.
     Admin özü söndürdüyü modulu birbaşa ünvanla AÇA BİLİR. */
  var lastBlock = 0;

  function guard() {
    /* ★ 2026-08-19: kassir rejimində idarə `jolly-cc.js`-dədir.
       Əvvəl bu funksiya orada da işləyirdi və "🔒 Bu bölməyə
       icazən yoxdur" yazısı sönmürdü — çünki `guard` açıq API-də
       deyil, kənardan susdurula bilmirdi. İndi özü çəkilir. */
    try {
      var CC = global.JollyCC;
      if (CC && typeof CC.isWorker === 'function' && CC.isWorker()) return;
    } catch (e) {}

    if (!isUser()) return;
    var h = String(global.location.hash || '').split('?')[0];
    if (!h || h === ROUTE) { if (h === ROUTE) go('#/dashboard'); return; }
    var m = moduleByRoute(h);
    if (!m || ALWAYS[m.id] || allowed(m.id)) return;

    /* Eyni bildiriş dalbadal çıxmasın */
    var now = Date.now();
    if (now - lastBlock > 2500) {
      lastBlock = now;
      toast('🔒 Bu bölməyə icazən yoxdur', 'error');
    }
    go('#/dashboard');
  }

  /* data-perm atributları olan elementlər yenidən hesablansın */
  function syncUI() {
    var P = global.POS || peek('POS');
    try { if (P && typeof P.syncUI === 'function') P.syncUI(); } catch (e) {}
  }

  /* Dəyişiklik dərhal görünsün — köhnə mühərrikin öz yeniləyicisi */
  function syncUI() {
    try {
      var P = global.POS || peek('POS');
      if (P && typeof P.syncUI === 'function') P.syncUI();
    } catch (e) {}
  }

  function go(hash) {
    var R = global.JollyRouter || peek('JollyRouter');
    if (R && R.go) R.go(hash); else global.location.hash = hash;
  }

  /* ══════════════════════════════════════════════════════════
     KÖHNƏ İCAZƏ MÜHƏRRİKİNİ TABE ETMƏK
     ──────────────────────────────────────────────────────────
     Bu faylı ilk versiyada yalnız GÖSTƏR/GİZLƏT üçün yazmışdım.
     Amma `module-registry._allowed()` və `renderPage()` hələ də
     `POS.can(m.perm)` soruşurdu — İdarə "açıq" desə də, köhnə
     mühərrik "bağlı" deyirdi və modul açılmırdı. İki hakim vardı.
     İndi hakim BİRDİR: işçi üçün `POS.can` cavabı İdarə
     Mərkəzindən gəlir.

     Qayda:
       · admin və ya sessiyasız → köhnə davranış (toxunmuruq)
       · açar hansısa MODULA aiddirsə → İdarə qərar verir
       · ümumi əməliyyat açarı (products.create kimi) → açıq,
         çünki modulun özü onsuz da bağlıdır: işçi icazəsiz
         ekrana nə görür, nə də girə bilir
     ══════════════════════════════════════════════════════════ */
  var _pm = null, _pmAt = 0;

  function permMap() {
    var now = Date.now();
    if (_pm && (now - _pmAt) < 3000) return _pm;
    var R = REG(), out = {};
    try {
      var all = (R && typeof R._all === 'function') ? R._all() : {};
      for (var k in all) {
        var m = all[k];
        if (m && m.perm && m.id) out[m.perm] = m.id;
      }
    } catch (e) {}
    _pm = out; _pmAt = now;
    return out;
  }

  function takeOverPOS() {
    var P = global.POS || peek('POS');
    if (!P || typeof P.can !== 'function') return false;
    if (P.can.__idare) return true;

    var orig = P.can.bind(P);
    var wrapped = function (key) {
      try {
        if (!isUser()) return orig(key);        /* admin — köhnə qayda */
        if (!key) return true;
        var mid = permMap()[key];
        if (mid) return allowed(mid);
        return true;
      } catch (e) {
        try { return orig(key); } catch (e2) { return true; }
      }
    };
    wrapped.__idare = true;
    P.can = wrapped;
    try { if (!global.POS) global.POS = P; } catch (e) {}
    try { if (typeof P.syncUI === 'function') P.syncUI(); } catch (e) {}
    console.log('[İdarə] icazə mühərriki tabe edildi — hakim tək');
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     Köhnə qatı susdurmaq
     ──────────────────────────────────────────────────────────
     jolly-user-mode.js öz ağ siyahısını POS icazələri üzərindən
     tətbiq edirdi. İki qat eyni anda işləsə nəticə ziddiyyətli
     olur — ona görə onun süzgəcini söndürürük. Salamlama və
     işçinin sadə iş masası ONDA QALIR, yalnız gizlətmə bizə keçir.
     ══════════════════════════════════════════════════════════ */
  function quietUserMode() {
    try {
      var raw = localStorage.getItem('jolly_user_mode');
      var c = raw ? JSON.parse(raw) : {};
      if (!c || typeof c !== 'object') c = {};
      if (c.whitelist === false && c.permDriven === false && c.pressDebug === false) return;
      c.whitelist = false;
      c.permDriven = false;
      /* Uzun basma diaqnostikası — ekranda qırmızı zolaq çıxarırdı
         ("...sub → route #/studios/ai — kataloqda..."). İdarə Mərkəzi
         gələndən sonra ona ehtiyac qalmadı. */
      c.pressDebug = false;
      localStorage.setItem('jolly_user_mode', JSON.stringify(c));
      console.log('[İdarə] köhnə süzgəc söndürüldü — idarə bu fayldadır');
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     KÖHNƏ MÜHƏRRİKİ SUSDURMAQ — ən vacib hissə
     ──────────────────────────────────────────────────────────
     Gizlətmək kifayət etmir. `module-registry._allowed(m)` modulu
     göstərməzdən əvvəl `POS.can(m.perm)` soruşur; köhnə anbarda
     həmin açar bağlıdırsa modul `list()`-dən düşür və `renderPage()`
     onu bloklayır. Yəni İdarə Mərkəzi "icazə verdim" desə də,
     köhnə mühərrik "yox" deyirdi — Esqinin gördüyü məhz bu idi.

     Həll: modulun icazə açarı ilə modul id-si arasında xəritə
     qurulur və `POS.can()` sarğılanır. Modulla bağlı açarlarda
     cavabı ARTIQ BİZ veririk; qalan açarlara (products.create və s.)
     TOXUNMURUQ — onlar köhnə mühərrikdə qalır.

     Yalnız İŞÇİ üçün tətbiq olunur. Adminin gizlətdiyi modul
     sadəcə gözdən yığışdırılır, birbaşa ünvanla yenə açılır.
     ══════════════════════════════════════════════════════════ */
  function permMap() {
    var R = REG(), map = {};
    try {
      var all = (R && typeof R._all === 'function') ? R._all() : {};
      for (var k in all) {
        var m = all[k];
        if (m && m.perm && m.id && !SKIP[m.id]) map[m.perm] = m.id;
      }
    } catch (e) {}
    return map;
  }

  function wrapCan(obj, name) {
    if (!obj || typeof obj.can !== 'function' || obj.can.__idare) return false;
    var orig = obj.can.bind(obj);
    var wrapped = function (key) {
      try {
        if (isUser() && key) {
          var id = permMap()[key];
          if (id) return allowed(id);          /* modul açarı — cavab bizdən */
          /* ★ Modulla bağlı OLMAYAN açar (products.create və s.):
             İŞÇİYƏ AÇIQDIR. Səbəb — qadağa QAPIDA qoyulur:
             işçi yalnız İdarə Mərkəzindən verilən ekrana girə bilir,
             girdiyi ekranın içində isə işini görə bilməlidir.
             Əks halda Esqinin şikayət etdiyi hal alınır:
             "məhsul əlavə et görünür, amma basanda qoymur". */
          return true;
        }
      } catch (e) {}
      return orig(key);                        /* admin və girişsiz hal */
    };
    wrapped.__idare = true;
    obj.can = wrapped;
    console.log('[İdarə] ' + name + '.can sarğılandı');
    return true;
  }

  var canDone = { pos: false, auth: false };

  function hookPerms() {
    if (!canDone.pos) {
      var P = global.POS || peek('POS');
      if (P) canDone.pos = wrapCan(P, 'POS');
    }
    if (!canDone.auth) {
      var A = global.JollyAuth || peek('JollyAuth');
      if (A) canDone.auth = wrapCan(A, 'JollyAuth');
    }
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  var tab = 'user', pickedUser = '', q = '', dashTarget = '__me';

  function workers() {
    var U = USERS(), out = [];
    try {
      var all = (U && U.list) ? (U.list() || []) : [];
      for (var i = 0; i < all.length; i++) {
        var u = all[i];
        if (!u || u.role === 'admin') continue;
        out.push({ id: u.id, name: u.name || u.username || u.id });
      }
    } catch (e) {}
    return out;
  }

  function css() {
    if (document.getElementById('idare-css')) return;
    var st = document.createElement('style');
    st.id = 'idare-css';
    st.textContent = [
      '.id-tabs{display:flex;gap:8px;margin-bottom:12px}',
      '.id-tab{flex:1;text-align:center;padding:11px;border-radius:13px;cursor:pointer;',
      'font-size:13.5px;font-weight:600;background:rgba(255,255,255,.06);',
      'border:1px solid rgba(255,255,255,.1)}',
      '.id-tab.on{background:rgba(245,196,81,.18);border-color:rgba(245,196,81,.5);color:#f5c451}',
      '.id-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}',
      '.id-chip{padding:8px 14px;border-radius:18px;font-size:13px;cursor:pointer;',
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}',
      '.id-chip.on{background:rgba(74,222,128,.18);border-color:rgba(74,222,128,.5);color:#86efac}',
      '.id-grp{font-size:11px;letter-spacing:.07em;opacity:.45;margin:15px 0 7px;text-transform:uppercase}',
      '.id-row{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:13px;',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:7px}',
      '.id-row .ic{font-size:20px;width:26px;text-align:center;flex:none}',
      '.id-row .nm{flex:1;min-width:0;font-size:13.5px;font-weight:600}',
      '.id-sw{flex:none;width:48px;height:27px;border-radius:14px;cursor:pointer;position:relative;',
      'transition:background .2s}',
      '.id-sw i{position:absolute;top:3px;width:21px;height:21px;border-radius:50%;background:#fff;',
      'transition:left .2s;display:block}',
      '.id-note{font-size:12.5px;line-height:1.6;opacity:.7;margin-bottom:12px}',
      '.id-rt{font-size:10.5px;opacity:.4;font-family:ui-monospace,monospace;margin-top:2px}',
      '#id-dash{margin-bottom:14px}',
      '.id-dash-t{font-size:11px;letter-spacing:.07em;opacity:.5;margin-bottom:8px;',
      'text-transform:uppercase}',
      '.id-dash-g{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}',
      '.id-dash-c{border-radius:15px;padding:12px 5px;text-align:center;cursor:pointer;',
      'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}',
      '.id-dash-c:active{background:rgba(255,255,255,.11);transform:scale(.96)}',
      '.id-dash-c .i{font-size:23px;line-height:1}',
      '.id-dash-c .t{font-size:10.5px;margin-top:6px;line-height:1.25;opacity:.75}',
      '.id-mini{font-size:10.5px;padding:3px 9px;border-radius:9px;cursor:pointer;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);',
      'text-transform:none;letter-spacing:0;opacity:.85}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function searchBox() {
    return '<input class="input" placeholder="Axtar…" value="' + esc(q) + '" ' +
      'oninput="JollyIdare.find(this.value)" ' +
      'style="width:100%;margin-bottom:10px;padding:11px 13px;border-radius:12px;' +
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:inherit">';
  }

  function sw(on) {
    return '<div class="id-sw" style="background:' +
      (on ? 'rgba(74,222,128,.75)' : 'rgba(255,255,255,.14)') + '">' +
      '<i style="left:' + (on ? '24px' : '3px') + '"></i></div>';
  }

  function render() {
    css();
    if (me() && !isAdmin()) {
      return '<div class="empty-state"><div class="big-icon">🔒</div><h3>Yalnız admin</h3></div>';
    }
    quietUserMode();

    var list = modules();
    var ws = workers();
    if (!pickedUser && ws.length) pickedUser = ws[0].id;

    var h = [];
    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
             '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">🛠 İdarə Mərkəzi</h2>' +
             '<div class="muted" style="font-size:12.5px;">v1.6 · ' + list.length + ' bölmə</div>' +
           '</div></div>');

    h.push('<div class="id-tabs">' +
      '<div class="id-tab' + (tab === 'user' ? ' on' : '') + '" onclick="JollyIdare.tab(\'user\')">👤 İcazələr</div>' +
      '<div class="id-tab' + (tab === 'dash' ? ' on' : '') + '" onclick="JollyIdare.tab(\'dash\')">⌂ İş masası</div>' +
      '<div class="id-tab' + (tab === 'me' ? ' on' : '') + '" onclick="JollyIdare.tab(\'me\')">🛠 Gizlət</div>' +
      '</div>');

    if (tab === 'user') {
      if (!ws.length) {
        h.push('<div class="empty-state"><div class="big-icon">👤</div><h3>İşçi hesabı yoxdur</h3>' +
               '<p class="muted" style="font-size:12.5px;">Studio → İstifadəçilər bölməsindən əlavə et</p></div>');
        h.push('</div>');
        return h.join('');
      }

      h.push('<div class="id-chips">');
      for (var i = 0; i < ws.length; i++) {
        h.push('<div class="id-chip' + (ws[i].id === pickedUser ? ' on' : '') + '" ' +
               'onclick="JollyIdare.pick(\'' + esc(ws[i].id) + '\')">👤 ' + esc(ws[i].name) + '</div>');
      }
      h.push('</div>');

      var c = cfg();
      var mine = c.allow[pickedUser] || [];
      var nm = '';
      for (var w = 0; w < ws.length; w++) if (ws[w].id === pickedUser) nm = ws[w].name;

      h.push('<div class="id-note"><b>' + esc(nm) + '</b> yalnız açıq olanları görəcək. ' +
             'Qalanı nə iş masasında görünəcək, nə də linklə açılacaq. ' +
             'Hazırda <b>' + mine.length + ' / ' + list.length + '</b> açıqdır.</div>');

      h.push('<div class="row" style="margin-bottom:12px;display:flex;gap:8px">' +
        '<button class="btn" onclick="JollyIdare.all(1)">✚ Hamısını aç</button>' +
        '<button class="btn" onclick="JollyIdare.all(0)">🗑 Hamısını bağla</button></div>');

      h.push(searchBox());
      h.push('<div id="id-list">' +
        rows(list, function (m) { return mine.indexOf(m.id) !== -1; },
             'JollyIdare.tgU', 'JollyIdare.grpU') + '</div>');
    } else if (tab === 'dash') {
      /* Hədəf: mən, yoxsa hansısa işçi */
      h.push('<div class="id-chips">');
      h.push('<div class="id-chip' + (dashTarget === '__me' ? ' on' : '') + '" ' +
             'onclick="JollyIdare.dashPick(\'__me\')">🛠 Mən</div>');
      for (var d = 0; d < ws.length; d++) {
        h.push('<div class="id-chip' + (ws[d].id === dashTarget ? ' on' : '') + '" ' +
               'onclick="JollyIdare.dashPick(\'' + esc(ws[d].id) + '\')">👤 ' + esc(ws[d].name) + '</div>');
      }
      h.push('</div>');

      var cur = dashOf(dashTarget);
      var who = dashTarget === '__me' ? 'Sənin' : '';
      for (var w2 = 0; w2 < ws.length; w2++) if (ws[w2].id === dashTarget) who = esc(ws[w2].name) + '-un';

      h.push('<div class="id-note">' + who + ' iş masasında hansı kartlar görünsün? ' +
             'Açdığın modul kart kimi iş masasının başında çıxacaq. ' +
             'Hazırda <b>' + cur.length + '</b> kart seçilib.' +
             (dashTarget !== '__me'
               ? ' <br><b>Qeyd:</b> işçiyə icazə verilməyibsə kart görünməyəcək — əvvəl İcazələr bölməsindən aç.'
               : '') + '</div>');

      h.push(searchBox());
      h.push('<div id="id-list">' +
        rows(list, function (m) { return cur.indexOf(m.id) !== -1; },
             'JollyIdare.tgD', 'JollyIdare.grpD') + '</div>');
    } else {
      var c2 = cfg();
      h.push('<div class="id-note">Burada modul HƏR YERDƏN yığışdırılır — iş masası, Studio, menyu. ' +
             'Silinmir — birbaşa ünvanla yenə açılır. İşçilərə təsiri yoxdur.</div>');
      h.push(searchBox());
      h.push('<div id="id-list">' +
        rows(list, function (m) { return c2.hidden.indexOf(m.id) === -1; },
             'JollyIdare.tgA', 'JollyIdare.grpA') + '</div>');
    }

    h.push('<div style="height:28px"></div></div>');
    return h.join('');
  }

  function rows(list, isOn, fn, grpFn) {
    var out = [], last = '';
    var qq = norm(q);
    var shown = list.filter(function (m) {
      return !qq || norm(m.name).indexOf(qq) !== -1 || norm(m.route).indexOf(qq) !== -1;
    });
    if (!shown.length) return '<div class="id-note" style="padding:18px 0;text-align:center">Tapılmadı</div>';

    for (var i = 0; i < shown.length; i++) {
      var m = shown[i];
      if (m.group !== last) {
        out.push('<div class="id-grp" style="display:flex;align-items:center;gap:8px">' +
          '<span style="flex:1">' + esc(m.group) + '</span>' +
          (grpFn ? '<span class="id-mini" onclick="' + grpFn + '(\'' + esc(m.group) + '\',1)">hamısını aç</span>' +
                   '<span class="id-mini" onclick="' + grpFn + '(\'' + esc(m.group) + '\',0)">bağla</span>' : '') +
          '</div>');
        last = m.group;
      }
      out.push('<div class="id-row">' +
        '<span class="ic">' + m.icon + '</span>' +
        '<span class="nm">' + esc(m.name) +
          '<div class="id-rt">' + esc(m.route) + '</div></span>' +
        '<span onclick="' + fn + '(\'' + esc(m.id) + '\')">' + sw(isOn(m)) + '</span>' +
        '</div>');
    }
    return out.join('');
  }

  /* Hərf bərabərləşdirməsi — "corab" da "Çorab"ı tapsın */
  function norm(x) {
    return String(x || '').toLowerCase()
      .replace(/ə/g, 'e').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ğ/g, 'g')
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ı/g, 'i');
  }

  function repaint() {
    var el = document.getElementById('main');
    if (el && String(global.location.hash || '').split('?')[0] === ROUTE) {
      el.innerHTML = render();
      return;
    }
    var A = global.JollyApp || peek('JollyApp');
    try { if (A && A.render) A.render(); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     Açıq API
     ══════════════════════════════════════════════════════════ */
  global.JollyIdare = {
    render: render,

    tab: function (t) { tab = t; repaint(); },
    pick: function (u) { pickedUser = u; repaint(); },

    tgU: function (id) {
      if (!pickedUser) return;
      var on = (cfg().allow[pickedUser] || []).indexOf(id) !== -1;
      setUserAllow(pickedUser, id, !on);
      _pm = null; syncUI();
      repaint(); sweep();
    },
    tgA: function (id) {
      var hidden = cfg().hidden.indexOf(id) !== -1;
      setAdminHidden(id, !hidden);
      _pm = null; syncUI();
      repaint(); sweep();
    },
    find: function (v) {
      q = v;
      var el = document.getElementById('id-list');
      if (!el) { repaint(); return; }
      var list = modules(), c = cfg();
      if (tab === 'user') {
        el.innerHTML = rows(list, function (m) {
          return (c.allow[pickedUser] || []).indexOf(m.id) !== -1;
        }, 'JollyIdare.tgU', 'JollyIdare.grpU');
      } else if (tab === 'dash') {
        var cur = dashOf(dashTarget);
        el.innerHTML = rows(list, function (m) { return cur.indexOf(m.id) !== -1; },
                            'JollyIdare.tgD', 'JollyIdare.grpD');
      } else {
        el.innerHTML = rows(list, function (m) { return c.hidden.indexOf(m.id) === -1; },
                            'JollyIdare.tgA', 'JollyIdare.grpA');
      }
    },

    dashPick: function (t) { dashTarget = t; repaint(); },

    tgD: function (id) {
      var on = dashOf(dashTarget).indexOf(id) !== -1;
      setDash(dashTarget, id, !on);
      repaint();
      var box = document.getElementById('id-dash');
      if (box && box.parentNode) box.parentNode.removeChild(box);
      injectDash();
    },

    grpD: function (group, on) {
      modules().forEach(function (m) {
        if (m.group === group) setDash(dashTarget, m.id, !!on);
      });
      repaint();
      var box = document.getElementById('id-dash');
      if (box && box.parentNode) box.parentNode.removeChild(box);
      injectDash();
    },

    open: function (route) { go(route); },

    grpU: function (group, on) {
      if (!pickedUser) return;
      var c = cfg();
      if (!Array.isArray(c.allow[pickedUser])) c.allow[pickedUser] = [];
      modules().forEach(function (m) {
        if (m.group !== group) return;
        var i = c.allow[pickedUser].indexOf(m.id);
        if (on && i === -1) c.allow[pickedUser].push(m.id);
        if (!on && i !== -1) c.allow[pickedUser].splice(i, 1);
      });
      save(c); repaint(); sweep(); syncUI();
    },

    grpA: function (group, on) {
      var c = cfg();
      modules().forEach(function (m) {
        if (m.group !== group) return;
        var i = c.hidden.indexOf(m.id);
        if (!on && i === -1) c.hidden.push(m.id);
        if (on && i !== -1) c.hidden.splice(i, 1);
      });
      save(c); repaint(); sweep(); syncUI();
    },

    all: function (on) {
      if (!pickedUser) return;
      bulkUser(pickedUser, !!on);
      _pm = null; syncUI();
      toast(on ? '✚ hamısı açıldı' : '🗑 hamısı bağlandı', 'ok');
      repaint(); sweep(); syncUI();
    },

    /* Kənardan istifadə üçün */
    allowed: allowed,
    cfg: cfg,
    injectDash: injectDash,
    dashOf: dashOf,
    modules: modules,
    sweep: sweep,
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      toast('İdarə ayarları sıfırlandı', 'ok');
      repaint(); sweep();
    }
  };

  /* ══════════════════════════════════════════════════════════
     Qeydiyyat və açılış
     ══════════════════════════════════════════════════════════ */
  function registerModule() {
    var R = REG();
    if (!R || typeof R.register !== 'function') return false;
    try {
      /* perm QƏSDƏN verilmir — registry perm-li modulu POS.can
         false qaytaranda tamamilə gizlədir və ekran heç yerdə
         görünmür. Yoxlama render()-in içindədir. */
      R.register({
        id: 'idare', name: 'İdarə Mərkəzi', icon: '🛠',
        route: ROUTE, group: 'JOLLY', render: render
      });
      return true;
    } catch (e) { return false; }
  }

  var obs = null, timer = null, tries = 0;

  function watch() {
    takeOverPOS();          /* POS gec yüklənə bilər — hər dövrədə yoxlanılır */
    sweep();
    if (!obs && document.body) {
      try {
        obs = new MutationObserver(function () { sweep(); injectDash(); });
        obs.observe(document.body, { childList: true, subtree: true });
      } catch (e) { obs = null; }
    }
    if (!timer) timer = setInterval(function () { hookPerms(); sweep(); injectDash(); }, 1500);
  }

  function boot() {
    css();
    quietUserMode();
    hookPerms();
    takeOverPOS();
    var ok = registerModule();
    watch();
    guard();
    if (ok || ++tries > 40) {
      console.log('[İdarə] hazırdır — ' + modules().length + ' modul, tək açar: ' + KEY);
      return;
    }
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 120); });
  } else {
    setTimeout(boot, 120);
  }

  global.addEventListener('hashchange', function () {
    setTimeout(function () { hookPerms(); guard(); sweep(); injectDash(); }, 60);
  });

})(typeof window !== 'undefined' ? window : this);
