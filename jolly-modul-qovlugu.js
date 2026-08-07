/* ============================================================
   JOLLY Modul Qovluğu — jolly-modul-qovlugu.js
   v1.0  (2026-08-05)

   ────────────────────────────────────────────────────────────
   NƏ ÜÇÜNDÜR (Esqinin istəyi):
   Proqramdakı BÜTÜN modullar tək bir qovluqda toplanır.
   Hər modulun yanında ⋮ menyusu var — oradan işçiyə icazə verilir.
   İcazə HƏR İŞÇİ ÜÇÜN AYRIDIR: Zülfüqara verilən İsaxa verilmir.

   ────────────────────────────────────────────────────────────
   NECƏ İŞLƏYİR:
   permission-engine.js icazəni bu sıra ilə həll edir
   (`Engine.resolveFor`, sətir 157):
        istifadəçi override → qlobal override → açarın standartı → false

   Yəni hər işçi üçün ayrıca dəyər saxlamaq onsuz da mümkündür:
        POS.store.setUserOverrides(userId, { 'açar': true })
        POS.store.getUserOverride(userId, 'açar')
        POS.engine.resolveFor(userId, 'açar')
   Bu ekran məhz həmin API-nin üstündə qurulub — yeni anbar
   yaradılmır, mövcud icazə sistemi işlədilir.

   İşçi siyahısı `JollyUsers.list()`-dən gəlir (window-a bağlıdır).
   Modul siyahısı `JollyUserMode.catalog()`-dan, o yoxdursa
   birbaşa ModuleRegistry-dən qurulur.

   Marşrut: #/modules   ·   Açar: modules.grant
   ============================================================ */
(function (global) {
  'use strict';

  var ROUTE    = '#/modules';
  var PERM_KEY = 'modules.grant';
  var SEL_KEY  = 'jolly_grant_user';   // seçilmiş işçi yadda qalır

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
    console.log('[ModulQovluğu]', msg);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function POS() { return global.POS || peek('POS'); }

  function session() {
    try { return JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null'); }
    catch (e) { return null; }
  }
  function isAdmin() { var s = session(); return !!(s && s.role === 'admin'); }

  /* ══════════════════════════════════════════════════════════
     İşçilər
     ══════════════════════════════════════════════════════════ */
  function users() {
    var U = global.JollyUsers || peek('JollyUsers');
    var out = [];
    try {
      var all = (U && U.list) ? (U.list() || []) : [];
      for (var i = 0; i < all.length; i++) {
        var u = all[i];
        if (!u || u.role === 'admin') continue;     // admin-ə icazə lazım deyil
        out.push({ id: u.id, name: u.name || u.id, status: u.status });
      }
    } catch (e) {}
    return out;
  }

  function selectedUser() {
    var id = null;
    try { id = localStorage.getItem(SEL_KEY); } catch (e) {}
    var list = users();
    if (id === '*') return { id: '*', name: 'Hamısı (ümumi)' };
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list.length ? list[0] : { id: '*', name: 'Hamısı (ümumi)' };
  }
  function selectUser(id) {
    try { localStorage.setItem(SEL_KEY, id); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     Modullar
     ══════════════════════════════════════════════════════════ */
  function catalog() {
    var UM = global.JollyUserMode;
    if (UM && typeof UM.catalog === 'function') {
      try { return UM.catalog() || []; } catch (e) {}
    }
    /* Ehtiyat yol — İşçi Rejimi faylı yoxdursa */
    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    var out = [];
    try {
      var mods = (MR && MR.list) ? (MR.list() || []) : [];
      for (var i = 0; i < mods.length; i++) {
        var m = mods[i];
        if (!m || !m.id) continue;
        out.push({ id: m.id, route: m.route || ('#/' + m.id), icon: m.icon || '📦',
                   label: m.name || m.id, perm: m.perm || null, group: m.group || 'Digər' });
      }
    } catch (e) {}
    return out;
  }

  /* Açarı olmayan modul üçün süni açar — belə modul da idarə oluna bilsin */
  function keyOf(cd) { return cd.perm || ('ui.card.' + cd.id); }

  /* Süni açarları da POS-a qeyd edirik ki, resolveFor onları tapsın */
  function registerSynthetic() {
    var P = POS();
    if (!P || typeof P.register !== 'function' || !P.reg) return false;
    var known = {};
    try {
      P.reg.allPerms().forEach(function (p) {
        if (p.moduleId !== 'jmq-cards') known[p.key] = 1;
      });
    } catch (e) { return false; }

    var list = catalog(), perms = [], seen = {};
    for (var i = 0; i < list.length; i++) {
      var cd = list[i];
      if (cd.perm) continue;                       // öz açarı var
      var k = keyOf(cd);
      if (known[k] || seen[k]) continue;
      seen[k] = 1;
      perms.push({ key: k, label: (cd.icon || '📦') + ' ' + cd.label, tag: 'view', 'default': false });
    }
    if (!perms.length) return true;
    try {
      P.register({ id: 'jmq-cards', name: 'Ekran girişləri', icon: '🗂', permissions: perms });
      return true;
    } catch (e) { return false; }
  }

  /* ══════════════════════════════════════════════════════════
     İcazə oxu / yaz
     ══════════════════════════════════════════════════════════ */
  function stateFor(uid, key) {
    var P = POS();
    if (!P) return false;
    try {
      if (uid && uid !== '*' && P.engine && P.engine.resolveFor) return !!P.engine.resolveFor(uid, key);
      if (P.store && P.store.getOverride) {
        var ov = P.store.getOverride(key);
        if (typeof ov === 'boolean') return ov;
      }
      if (P.reg && P.reg.allPerms) {
        var all = P.reg.allPerms();
        for (var i = 0; i < all.length; i++) if (all[i].key === key) return !!all[i]['default'];
      }
    } catch (e) {}
    return false;
  }

  /* Fərdi ayar var, yoxsa ümumidən gəlir? */
  function isPersonal(uid, key) {
    if (!uid || uid === '*') return false;
    var P = POS();
    try {
      return typeof P.store.getUserOverride(uid, key) === 'boolean';
    } catch (e) { return false; }
  }

  function setFor(uid, key, val) {
    var P = POS();
    if (!P || !P.store) return false;
    try {
      if (uid && uid !== '*') {
        var o = {}; o[key] = !!val;
        P.store.setUserOverrides(uid, o);
      } else {
        P.store.setOverride(key, !!val);
      }
      try { if (P.syncUI) P.syncUI(); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  function clearPersonal(uid, key) {
    var P = POS();
    if (!P || !P.store || !uid || uid === '*') return false;
    try {
      var d = P.store.load();
      if (d.userOverrides && d.userOverrides[uid]) {
        delete d.userOverrides[uid][key];
        P.store.save(d);
      }
      return true;
    } catch (e) { return false; }
  }

  /* ══════════════════════════════════════════════════════════
     CSS
     ══════════════════════════════════════════════════════════ */
  function installCss() {
    if (document.getElementById('jmq-css')) return;
    var st = document.createElement('style');
    st.id = 'jmq-css';
    st.textContent = [
      '.jmq-chips{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;-webkit-overflow-scrolling:touch;}',
      '.jmq-chip{flex:none;padding:8px 14px;border-radius:20px;font-size:13px;cursor:pointer;',
      'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);white-space:nowrap;}',
      '.jmq-chip.on{background:rgba(74,222,128,.18);border-color:rgba(74,222,128,.5);font-weight:600;}',
      '.jmq-search{width:100%;padding:12px 14px;border-radius:13px;font-size:16px;color:#e8e8f0;',
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);outline:none;margin-bottom:12px;}',
      '.jmq-grp{font-size:11px;letter-spacing:.08em;opacity:.45;margin:16px 0 7px;text-transform:uppercase;}',
      '.jmq-row{display:flex;align-items:center;gap:11px;padding:12px 12px;border-radius:14px;',
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:7px;}',
      '.jmq-row .ic{font-size:22px;width:28px;text-align:center;flex:none;}',
      '.jmq-row .tx{flex:1;min-width:0;}',
      '.jmq-row .tx b{font-size:13.5px;font-weight:600;display:block;}',
      '.jmq-row .tx span{font-size:10.5px;opacity:.45;font-family:ui-monospace,monospace;}',
      '.jmq-st{font-size:15px;flex:none;margin-right:2px;}',
      '.jmq-dot{flex:none;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:17px;',
      'display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);}',
      '.jmq-dot:active{background:rgba(255,255,255,.14);}',
      '.jmq-per{font-size:9.5px;color:#4ade80;margin-left:5px;}',
      '.jmq-sheet{position:fixed;inset:0;z-index:10060;background:rgba(6,7,13,.72);display:flex;align-items:flex-end;}',
      '.jmq-in{width:100%;background:#12141c;border-radius:20px 20px 0 0;max-height:82vh;overflow:auto;',
      'padding:14px 14px calc(18px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.12);}',
      '.jmq-h{display:flex;align-items:center;gap:11px;padding:4px 4px 12px;margin-bottom:8px;',
      'border-bottom:1px solid rgba(255,255,255,.08);}',
      '.jmq-mi{display:flex;align-items:center;gap:12px;padding:13px 10px;border-radius:13px;font-size:14px;cursor:pointer;}',
      '.jmq-mi:active{background:rgba(255,255,255,.07);}',
      '.jmq-mi .mi{font-size:18px;width:24px;text-align:center;flex:none;}',
      '.jmq-mi.danger{color:#fca5a5;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  /* ══════════════════════════════════════════════════════════
     Ekran
     ══════════════════════════════════════════════════════════ */
  function can(perm) {
    var UM = global.JollyUserMode;
    if (UM && UM.can) { try { return UM.can(perm); } catch (e) {} }
    var P = POS();
    if (!P || !P.can) return true;
    try { return !!P.can(perm); } catch (e) { return true; }
  }

  function render() {
    installCss();
    if (session() && !isAdmin() && !can(PERM_KEY)) {
      return '<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>';
    }
    registerSynthetic();

    var list = catalog();
    var ulist = users();
    var sel = selectedUser();
    var h = [];

    h.push('<div class="storeos">');
    h.push('<div class="dash-head"><div>' +
             '<h2 style="font-family:var(--font-display);margin:0;font-size:22px;">📂 Modul Qovluğu</h2>' +
             '<div class="muted" style="font-size:12.5px;">v1.0 · ' + list.length + ' modul · ⋮ ilə icazə ver</div>' +
           '</div></div>');

    /* İşçi seçimi */
    h.push('<div class="jmq-grp" style="margin-top:12px;">Kimə icazə verirsən</div>');
    h.push('<div class="jmq-chips">');
    for (var i = 0; i < ulist.length; i++) {
      h.push('<div class="jmq-chip' + (ulist[i].id === sel.id ? ' on' : '') + '" ' +
             'onclick="JollyModulQovlugu.pick(\'' + esc(ulist[i].id) + '\')">👤 ' + esc(ulist[i].name) + '</div>');
    }
    h.push('<div class="jmq-chip' + (sel.id === '*' ? ' on' : '') + '" ' +
           'onclick="JollyModulQovlugu.pick(\'*\')">🌐 Hamısı (ümumi)</div>');
    h.push('</div>');

    if (!ulist.length) {
      h.push('<div class="glass" style="padding:12px 14px;margin-bottom:10px;font-size:12.5px;line-height:1.6;">' +
               'Hələ işçi hesabı yoxdur. Studio → İstifadəçilər bölməsindən əlavə et, ' +
               'sonra buradan hərəsinə ayrıca icazə verərsən.' +
             '</div>');
    } else {
      h.push('<div class="glass" style="padding:11px 13px;margin-bottom:12px;font-size:12.5px;line-height:1.55;">' +
               'Aşağıdakı siyahı <b>' + esc(sel.name) + '</b> üçün göstərilir. ' +
               '🔓 açıq · 🔒 bağlı · <span style="color:#4ade80;">fərdi</span> = yalnız bu işçiyə aiddir.' +
             '</div>');
    }

    h.push('<input class="jmq-search" placeholder="Modul axtar…" oninput="JollyModulQovlugu.filter(this.value)">');

    /* Qruplara bölərək siyahı */
    var groups = {}, order = [];
    for (i = 0; i < list.length; i++) {
      var g = list[i].group || 'Digər';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(list[i]);
    }
    h.push('<div id="jmqList">');
    for (var gi = 0; gi < order.length; gi++) {
      var gname = order[gi], rows = groups[gname];
      h.push('<div class="jmq-grp jmq-gh" data-g="' + esc(gname.toLowerCase()) + '">' + esc(gname) + ' · ' + rows.length + '</div>');
      for (i = 0; i < rows.length; i++) {
        var cd = rows[i], k = keyOf(cd);
        var on = stateFor(sel.id, k);
        var per = isPersonal(sel.id, k);
        h.push('<div class="jmq-row" data-nm="' + esc((cd.label + ' ' + cd.route + ' ' + gname).toLowerCase()) + '">' +
                 '<span class="ic">' + cd.icon + '</span>' +
                 '<span class="tx"><b>' + esc(cd.label) +
                   (per ? '<span class="jmq-per">fərdi</span>' : '') + '</b>' +
                   '<span>' + esc(cd.route) + '</span></span>' +
                 '<span class="jmq-st">' + (on ? '🔓' : '🔒') + '</span>' +
                 '<div class="jmq-dot" onclick="JollyModulQovlugu.menu(\'' + esc(cd.id) + '\')">⋮</div>' +
               '</div>');
      }
    }
    h.push('</div>');

    h.push('<div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;">' +
             '<button class="btn" onclick="JollyModulQovlugu.allOn()">🔓 Hamısını aç</button>' +
             '<button class="btn" onclick="JollyModulQovlugu.allOff()">🔒 Hamısını bağla</button>' +
             '<button class="btn" onclick="JollyModulQovlugu.clearAllPersonal()">↩ Fərdi ayarları sil</button>' +
           '</div>');

    h.push('<div style="height:30px;"></div></div>');
    return h.join('');
  }

  function refresh() {
    var el = document.getElementById('main');
    if (el && String(global.location.hash || '').split('?')[0] === ROUTE) {
      el.innerHTML = render();
      return;
    }
    var A = global.JollyApp || peek('JollyApp');
    try { if (A && A.render) A.render(); } catch (e) {}
  }

  function closeSheet() {
    var s = document.getElementById('jmqSheet');
    if (s && s.parentNode) s.parentNode.removeChild(s);
  }

  function sheet(inner) {
    closeSheet();
    var d = document.createElement('div');
    d.id = 'jmqSheet';
    d.className = 'jmq-sheet';
    d.innerHTML = '<div class="jmq-in">' + inner + '</div>';
    d.addEventListener('click', function (ev) { if (ev.target === d) closeSheet(); });
    document.body.appendChild(d);
  }

  function findCard(id) {
    var list = catalog();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ══════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════ */
  var API = {
    render: render,

    pick: function (id) { selectUser(id); refresh(); },

    filter: function (q) {
      q = String(q || '').toLowerCase().trim();
      var box = document.getElementById('jmqList');
      if (!box) return;
      var rows = box.getElementsByClassName('jmq-row'), i;
      for (i = 0; i < rows.length; i++) {
        var nm = rows[i].getAttribute('data-nm') || '';
        rows[i].style.display = (!q || nm.indexOf(q) !== -1) ? '' : 'none';
      }
      var heads = box.getElementsByClassName('jmq-gh');
      for (i = 0; i < heads.length; i++) heads[i].style.display = q ? 'none' : '';
    },

    menu: function (id) {
      var cd = findCard(id);
      if (!cd) { toast('Modul tapılmadı', 'error'); return; }
      var sel = selectedUser(), k = keyOf(cd);
      var on = stateFor(sel.id, k);
      var per = isPersonal(sel.id, k);
      var h = [];

      h.push('<div class="jmq-h"><span style="font-size:26px;">' + cd.icon + '</span>' +
             '<span style="flex:1;min-width:0;"><b style="font-size:15px;display:block;">' + esc(cd.label) + '</b>' +
             '<span style="font-size:11px;opacity:.5;font-family:ui-monospace,monospace;">' + esc(k) + '</span></span></div>');

      h.push('<div style="font-size:12px;opacity:.6;padding:0 10px 8px;">Seçilmiş: <b>' + esc(sel.name) + '</b></div>');

      h.push('<div class="jmq-mi" onclick="JollyModulQovlugu.set(\'' + esc(id) + '\',' + (on ? 'false' : 'true') + ')">' +
               '<span class="mi">' + (on ? '🚫' : '✅') + '</span>' +
               '<span>' + (on ? 'İcazəni BAĞLA' : 'İcazə VER') + '</span></div>');

      if (sel.id !== '*') {
        if (per) {
          h.push('<div class="jmq-mi" onclick="JollyModulQovlugu.clearOne(\'' + esc(id) + '\')">' +
                 '<span class="mi">↩</span><span>Fərdi ayarı sil (ümumidən gəlsin)</span></div>');
        }
        h.push('<div class="jmq-mi" onclick="JollyModulQovlugu.setGlobal(\'' + esc(id) + '\',true)">' +
               '<span class="mi">🌐</span><span>HAMIYA ver</span></div>');
        h.push('<div class="jmq-mi danger" onclick="JollyModulQovlugu.setGlobal(\'' + esc(id) + '\',false)">' +
               '<span class="mi">🌐</span><span>HAMIDAN al</span></div>');
      }

      h.push('<div class="jmq-mi" style="opacity:.6;" onclick="JollyModulQovlugu.close()">' +
             '<span class="mi">✕</span><span>Bağla</span></div>');
      sheet(h.join(''));
    },

    close: closeSheet,

    set: function (id, val) {
      var cd = findCard(id); if (!cd) return;
      var sel = selectedUser();
      if (setFor(sel.id, keyOf(cd), val)) {
        toast((val ? '✅ ' : '🚫 ') + cd.label + ' — ' + esc(sel.name), 'ok');
      } else {
        toast('İcazə mühərriki tapılmadı', 'error');
      }
      closeSheet(); refresh();
    },

    setGlobal: function (id, val) {
      var cd = findCard(id); if (!cd) return;
      if (setFor('*', keyOf(cd), val)) toast((val ? '🌐 Hamıya verildi: ' : '🌐 Hamıdan alındı: ') + cd.label, 'ok');
      closeSheet(); refresh();
    },

    clearOne: function (id) {
      var cd = findCard(id); if (!cd) return;
      var sel = selectedUser();
      clearPersonal(sel.id, keyOf(cd));
      toast('Fərdi ayar silindi — ümumi ayardan gələcək', 'ok');
      closeSheet(); refresh();
    },

    allOn:  function () { API._bulk(true); },
    allOff: function () { API._bulk(false); },
    _bulk: function (val) {
      var sel = selectedUser(), list = catalog(), P = POS();
      if (!P || !P.store) { toast('İcazə mühərriki tapılmadı', 'error'); return; }
      try {
        if (sel.id !== '*') {
          var o = {};
          for (var i = 0; i < list.length; i++) o[keyOf(list[i])] = !!val;
          P.store.setUserOverrides(sel.id, o);
        } else {
          for (var j = 0; j < list.length; j++) P.store.setOverride(keyOf(list[j]), !!val);
        }
        toast((val ? '🔓 Hamısı açıldı — ' : '🔒 Hamısı bağlandı — ') + sel.name, 'ok');
      } catch (e) { toast('Alınmadı', 'error'); }
      refresh();
    },

    clearAllPersonal: function () {
      var sel = selectedUser(), P = POS();
      if (sel.id === '*' || !P || !P.store) return;
      try {
        if (P.store.resetUserOverrides) P.store.resetUserOverrides(sel.id);
        toast(sel.name + ' — bütün fərdi ayarlar silindi', 'ok');
      } catch (e) {}
      refresh();
    },

    users: users,
    catalog: catalog,
    stateFor: stateFor,
    keyOf: keyOf,
    _selected: selectedUser
  };
  global.JollyModulQovlugu = API;

  /* ══════════════════════════════════════════════════════════
     Qeydiyyat
     ══════════════════════════════════════════════════════════ */
  function registerPerm() {
    var P = POS();
    if (!P || typeof P.register !== 'function') return false;
    try {
      P.register({
        id: 'modulqovlugu', name: 'Modul Qovluğu', icon: '📂',
        permissions: [{ key: PERM_KEY, label: 'Modul icazələrini idarə et', tag: 'system', 'default': false }]
      });
      return true;
    } catch (e) { return false; }
  }

  function registerModule() {
    var MR = global.ModuleRegistry || peek('ModuleRegistry');
    if (!MR || typeof MR.register !== 'function') return false;
    try {
      /* perm QƏSDƏN verilmir — registry perm-li modulu POS.can false
         qaytaranda tam gizlədir və ekran heç yerdə görünmür.
         Yoxlama render()-in içindədir. */
      MR.register({
        id: 'modules', name: 'Modul Qovluğu', icon: '📂',
        route: ROUTE, group: 'JOLLY', render: render
      });
      return true;
    } catch (e) { return false; }
  }

  var tries = 0;
  function boot() {
    installCss();
    var a = registerPerm(), b = registerModule();
    ++tries;
    if ((a && b) || tries > 40) {
      registerSynthetic();
      setTimeout(registerSynthetic, 5000);
      setTimeout(registerSynthetic, 14000);
      if (!(a && b)) console.warn('[ModulQovluğu] tam qoşulmadı', { perm: a, modul: b });
      else console.log('[ModulQovluğu] hazırdır —', catalog().length, 'modul,', users().length, 'işçi');
      return;
    }
    setTimeout(boot, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 90); });
  } else {
    setTimeout(boot, 90);
  }

  global.addEventListener('hashchange', function () { closeSheet(); });

})(typeof window !== 'undefined' ? window : this);
