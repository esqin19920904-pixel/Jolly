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
  /* Bu ekranın özü və nüvə alətləri siyahıda göstərilmir */
  var SKIP = { 'idare': 1, 'user-mode': 1, 'modules': 1, 'module-cleanup': 1 };

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
    out.sort(function (a, b) {
      if (a.group === b.group) return String(a.name).localeCompare(String(b.name), 'az');
      return String(a.group).localeCompare(String(b.group), 'az');
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
  function allowed(id) {
    if (!id) return true;
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
  function guard() {
    if (!isUser()) return;
    var h = String(global.location.hash || '').split('?')[0];
    if (!h || h === ROUTE) { if (h === ROUTE) go('#/dashboard'); return; }
    var m = moduleByRoute(h);
    if (m && !allowed(m.id)) {
      toast('🔒 Bu bölməyə icazən yoxdur', 'error');
      go('#/dashboard');
    }
  }

  function go(hash) {
    var R = global.JollyRouter || peek('JollyRouter');
    if (R && R.go) R.go(hash); else global.location.hash = hash;
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
      if (c.whitelist === false && c.permDriven === false) return;
      c.whitelist = false;
      c.permDriven = false;
      localStorage.setItem('jolly_user_mode', JSON.stringify(c));
      console.log('[İdarə] köhnə süzgəc söndürüldü — idarə bu fayldadır');
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  var tab = 'user', pickedUser = '';

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
      '.id-note{font-size:12.5px;line-height:1.6;opacity:.7;margin-bottom:12px}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
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
             '<div class="muted" style="font-size:12.5px;">v1.0 · ' + list.length + ' modul</div>' +
           '</div></div>');

    h.push('<div class="id-tabs">' +
      '<div class="id-tab' + (tab === 'user' ? ' on' : '') + '" onclick="JollyIdare.tab(\'user\')">👤 İşçi icazələri</div>' +
      '<div class="id-tab' + (tab === 'me' ? ' on' : '') + '" onclick="JollyIdare.tab(\'me\')">🛠 Mənim iş masam</div>' +
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

      h.push(rows(list, function (m) { return mine.indexOf(m.id) !== -1; },
                  'JollyIdare.tgU'));
    } else {
      var c2 = cfg();
      h.push('<div class="id-note">Burada YALNIZ sənin öz iş masan idarə olunur. ' +
             'Söndürdüyün modul iş masasından, Studio-dan və menyudan yığışdırılır — ' +
             'silinmir, birbaşa ünvanla yenə açılır. İşçilərə təsiri yoxdur.</div>');
      h.push(rows(list, function (m) { return c2.hidden.indexOf(m.id) === -1; },
                  'JollyIdare.tgA'));
    }

    h.push('<div style="height:28px"></div></div>');
    return h.join('');
  }

  function rows(list, isOn, fn) {
    var out = [], last = '';
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.group !== last) { out.push('<div class="id-grp">' + esc(m.group) + '</div>'); last = m.group; }
      out.push('<div class="id-row">' +
        '<span class="ic">' + m.icon + '</span>' +
        '<span class="nm">' + esc(m.name) + '</span>' +
        '<span onclick="' + fn + '(\'' + esc(m.id) + '\')">' + sw(isOn(m)) + '</span>' +
        '</div>');
    }
    return out.join('');
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
      repaint(); sweep();
    },
    tgA: function (id) {
      var hidden = cfg().hidden.indexOf(id) !== -1;
      setAdminHidden(id, !hidden);
      repaint(); sweep();
    },
    all: function (on) {
      if (!pickedUser) return;
      bulkUser(pickedUser, !!on);
      toast(on ? '✚ hamısı açıldı' : '🗑 hamısı bağlandı', 'ok');
      repaint(); sweep();
    },

    /* Kənardan istifadə üçün */
    allowed: allowed,
    cfg: cfg,
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
    sweep();
    if (!obs && document.body) {
      try {
        obs = new MutationObserver(function () { sweep(); });
        obs.observe(document.body, { childList: true, subtree: true });
      } catch (e) { obs = null; }
    }
    if (!timer) timer = setInterval(function () { sweep(); }, 1500);
  }

  function boot() {
    css();
    quietUserMode();
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
    setTimeout(function () { guard(); sweep(); }, 60);
  });

})(typeof window !== 'undefined' ? window : this);
