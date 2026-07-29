/* ==========================================================================
   JOLLY vNext — jolly-perm-bridge.js          v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   MƏQSƏD: icazə sisteminin üç açıq problemini bağlamaq —
           permission-engine.js-ə TOXUNMADAN.

   PROBLEM 1 — `overrides` itir
   permission-engine.js:83 təkrar-təkrar "Cannot read properties of undefined"
   verirdi, çünki yaddaşdakı icazə obyektində `overrides` sahəsi yox olur
   (buluddan gələn köhnə formatlı obyektdə o sahə heç vaxt olmayıb).
   Bu xəta sinxronu da yarımçıq dayandırırdı — Esqin və Zülfü bir-birinin
   məlumatını ona görə görmürdü.
   HƏLLİ: icazə anbarını hər dəyişiklikdən sonra "formaya salırıq" —
   itmiş qablar (overrides, roles, users) geri qoyulur. Heç nə silinmir.

   PROBLEM 2 — istifadəçi ID-ləri təsadüfi yaranır
   Hər cihazda ayrıca yaradılmış "Zülfü" başqa ID daşıyır, ona görə
   Esqinin verdiyi icazələr o biri cihazda tətbiq olunmur.
   HƏLLİ: (a) sessiya avtomatik uyğunlaşdırılır — cihazdakı sessiya ID-si
   siyahıda yoxdursa, eyni adlı istifadəçi tapılıb sessiya ona bağlanır;
   (b) `mergeIdentity()` ilə iki ID birləşdirilir — bütün yaddaşda köhnə ID
   yenisi ilə əvəzlənir, əvvəlcə tam surət çıxarılır və jurnala yazılır.

   PROBLEM 3 — yeni modulların icazə açarı qeydə düşmür
   HƏLLİ: açarlar bir neçə mümkün API adı ilə qeyd olunur; heç biri
   tutmasa, öz siyahımızda saxlanılır və `POS.can` sarğısı onları tanıyır.

   Yükləmə yeri: permission-engine.js və jolly-perms-extra.js-dən SONRA.
   ========================================================================== */

(function (global) {
  'use strict';

  var K_ALIAS = '__jolly_identity_alias__';   // "__jolly_" → körpü tutmur
  var K_KEYS  = '__jolly_extra_perm_keys__';

  function rawGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  function J(v, fb) { try { return JSON.parse(v); } catch (e) { return fb; } }

  function fold(s) {
    if (global.JollyDB && typeof global.JollyDB.foldText === 'function') {
      try { return String(global.JollyDB.foldText(s) || '').toLowerCase().trim(); } catch (e) {}
    }
    return String(s || '').toLowerCase()
      .replace(/ə/g, 'e').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/\s+/g, ' ').trim();
  }

  function toast(msg, kind) {
    try {
      if (global.Toast) {
        if (kind === 'error' && global.Toast.error) return global.Toast.error(msg);
        if (kind === 'ok' && global.Toast.success) return global.Toast.success(msg);
        if (global.Toast.info) return global.Toast.info(msg);
      }
    } catch (e) {}
    console.log('[Perm Bridge] ' + msg);
  }

  var state = {
    ready: false,
    engine: null,
    engineName: null,
    repairs: 0,
    repairedKeys: [],
    extraKeys: [],
    sessionFixed: null,
    lastReport: null,
    stats: { repairs: 0, containersAdded: 0, sessionFixes: 0, merges: 0, canCalls: 0 }
  };

  /* ----------------------------------------------------------------------
     1. İcazə mühərrikini tap
     ---------------------------------------------------------------------- */
  function findEngine() {
    var cands = ['POS', 'PermissionEngine', 'JollyPermissions', 'Perms'];
    for (var i = 0; i < cands.length; i++) {
      var o = global[cands[i]];
      if (o && (typeof o === 'object' || typeof o === 'function')) {
        state.engine = o; state.engineName = cands[i]; return o;
      }
    }
    return null;
  }

  /* ----------------------------------------------------------------------
     2. PROBLEM 1 — icazə anbarını formaya sal
     ---------------------------------------------------------------------- */
  function permKeys() {
    var out = [];
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (!k || k.indexOf('__jolly_') === 0) continue;
        // Əsl anbar: jolly_perm_os_v2 (imza: jolly_perm_os_v2_sig — ona toxunmuruq)
        if (/_sig$/.test(k)) continue;
        if (/perm|icaze|icazə|rol|role/i.test(k)) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  // ⚠️ 07-29 audit (repo kodu oxunandan sonra tam yenidən yazıldı):
  //
  // Əsl anbar forması permission-engine.js-də belədir:
  //     { v: 2, overrides: {}, userOverrides: {}, ts: ... }
  // Yəni `roles`/`users` sahələri YOXDUR — mənim əvvəlki yoxlamam onları
  // axtarırdı və ƏSL POZULMUŞ ANBARI TANIMIRDI.
  //
  // Daha vacibi: `jolly-perms-extra.js` bu təmiri ARTIQ DÜZGÜN EDİR
  // (normalize + load() sarğısı). Ona görə burada anbarı özümüz
  // düzəltmirik — yalnız vəziyyəti yoxlayır və perms-extra yoxdursa
  // minimal təmiri edirik. İki fayl eyni obyekti fərqli cür düzəltsə,
  // bir-birinin işini pozar.
  function repairObject(obj) {
    var added = 0;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return added;
    var looksLikeStore = (obj.overrides !== undefined) || (obj.userOverrides !== undefined) ||
                         (obj.v === 2) || (obj.perms !== undefined);
    if (!looksLikeStore) return added;
    if (!obj.overrides || typeof obj.overrides !== 'object') { obj.overrides = {}; added++; }
    if (!obj.userOverrides || typeof obj.userOverrides !== 'object') { obj.userOverrides = {}; added++; }
    if (!obj.v) obj.v = 2;
    return added;
  }

  // perms-extra öz təmirini qurubsa, biz qarışmırıq
  function extraHandlesIt() {
    try {
      var P = global.POS;
      var store = P && (P.store || (P.engine && P.engine.s));
      return !!(store && store.load && store.load.__permsExtraWrapped);
    } catch (e) { return false; }
  }

  function repairStore(silentWrite) {
    if (extraHandlesIt()) return [];        // jolly-perms-extra öz işini görür
    var keys = permKeys(), fixed = [];
    keys.forEach(function (k) {
      var raw = rawGet(k);
      if (!raw || raw.charAt(0) !== '{') return;
      var obj = J(raw, null);
      if (!obj) return;
      var added = repairObject(obj);
      if (added > 0) {
        var ok = silentWrite ? rawSet(k, JSON.stringify(obj))
                             : (function () { try { global.localStorage.setItem(k, JSON.stringify(obj)); return true; } catch (e) { return false; } })();
        if (ok) { fixed.push({ key: k, added: added }); state.stats.containersAdded += added; }
      }
    });
    if (fixed.length) {
      state.repairs++;
      state.stats.repairs++;
      state.repairedKeys = fixed;
      console.log('[Perm Bridge] icazə anbarı formaya salındı:', fixed);
      // mühərrikin daxili keşini boşalt — yoxsa köhnə pozuq obyekt qalır
      try {
        var P = global.POS;
        var st = P && (P.store || (P.engine && P.engine.s));
        if (st && st._c !== undefined) st._c = null;
      } catch (e) {}
      // mühərrik yenidən oxusun
      ['load', 'reload', 'refresh', 'init'].forEach(function (m) {
        try { if (state.engine && typeof state.engine[m] === 'function') state.engine[m](); } catch (e) {}
      });
      try { if (state.engine && typeof state.engine.syncUI === 'function') state.engine.syncUI(); } catch (e) {}
    }
    return fixed;
  }

  /* ----------------------------------------------------------------------
     3. PROBLEM 2 — kimlik uyğunlaşdırma
     ---------------------------------------------------------------------- */
  function findUsersStore() {
    var best = null;
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (!k || k.indexOf('__jolly_') === 0) continue;
        // Əsl açar: jolly_users_v1
        if (!/user|isci|işçi|employee/i.test(k)) continue;
        if (k.indexOf('__jolly_') === 0 || /perm|override/i.test(k)) continue;
        var v = rawGet(k);
        if (!v || v.charAt(0) !== '[') continue;
        var arr = J(v, null);
        if (!Array.isArray(arr) || !arr.length) continue;
        var ok = arr.filter(function (u) { return u && typeof u === 'object' && (u.name || u.ad); }).length;
        if (ok >= Math.max(1, Math.floor(arr.length * 0.6))) {
          if (!best || arr.length > best.list.length) best = { key: k, list: arr };
        }
      }
    } catch (e) {}
    return best;
  }

  function session() {
    try {
      var raw = global.sessionStorage.getItem('jolly_sec_session');
      if (!raw) return null;
      return J(raw, null);
    } catch (e) { return null; }
  }

  function setSession(obj) {
    try { global.sessionStorage.setItem('jolly_sec_session', JSON.stringify(obj)); return true; }
    catch (e) { return false; }
  }

  function aliasMap() { return J(rawGet(K_ALIAS), {}) || {}; }
  function saveAlias(map) { rawSet(K_ALIAS, JSON.stringify(map)); }

  function identityReport() {
    var store = findUsersStore();
    var s = session();
    var rep = { storeKey: store && store.key, users: [], duplicates: [], session: null,
                matched: null, alias: aliasMap() };

    if (store) {
      rep.users = store.list.map(function (u) {
        return { id: u.id || u.userId || u.uid || null, name: u.name || u.ad || '(adsız)',
                 role: u.role || u.rol || null };
      });
      var byName = {};
      rep.users.forEach(function (u) {
        var n = fold(u.name);
        (byName[n] = byName[n] || []).push(u.id);
      });
      Object.keys(byName).forEach(function (n) {
        if (byName[n].length > 1) rep.duplicates.push({ name: n, ids: byName[n] });
      });
    }

    if (s) {
      var sid = s.userId || s.id || s.uid || null;
      rep.session = { userId: sid, name: s.name || s.ad || null };
      rep.matched = !!(sid && rep.users.some(function (u) { return u.id === sid; }));
    }
    state.lastReport = rep;
    return rep;
  }

  // Sessiya ID-si siyahıda yoxdursa, eyni adlı YEGANƏ istifadəçiyə bağla
  function reconcileSession(force) {
    var rep = identityReport();
    if (!rep.session || rep.matched) return { changed: false, reason: rep.matched ? 'onsuz da uyğundur' : 'sessiya yoxdur' };
    var name = fold(rep.session.name);
    if (!name) return { changed: false, reason: 'sessiyada ad yoxdur' };

    var cands = rep.users.filter(function (u) { return fold(u.name) === name && u.id; });
    if (cands.length !== 1 && !force) {
      return { changed: false, reason: cands.length ? 'eyni adda ' + cands.length + ' qeyd var — əl ilə seçim lazımdır' : 'uyğun ad tapılmadı', candidates: cands };
    }

    var target = cands[0];
    var s = session();
    var oldId = rep.session.userId;
    if (s) {
      if (s.userId !== undefined) s.userId = target.id;
      if (s.id !== undefined) s.id = target.id;
      if (s.uid !== undefined) s.uid = target.id;
      if (s.userId === undefined && s.id === undefined && s.uid === undefined) s.userId = target.id;
      setSession(s);
    }
    var map = aliasMap();
    if (oldId) map[oldId] = target.id;
    saveAlias(map);
    state.sessionFixed = { from: oldId, to: target.id, name: target.name, at: Date.now() };
    state.stats.sessionFixes++;

    ['load', 'reload', 'refresh'].forEach(function (m) {
      try { if (state.engine && typeof state.engine[m] === 'function') state.engine[m](); } catch (e) {}
    });
    try { if (state.engine && typeof state.engine.syncUI === 'function') state.engine.syncUI(); } catch (e) {}

    console.log('[Perm Bridge] sessiya kimliyi uyğunlaşdırıldı: ' + oldId + ' → ' + target.id);
    return { changed: true, from: oldId, to: target.id, name: target.name };
  }

  // İki kimliyi tam birləşdir — BÜTÜN yaddaşda köhnə ID yenisi ilə əvəzlənir
  function mergeIdentity(fromId, toId, silent) {
    if (!fromId || !toId || fromId === toId) return Promise.resolve({ ok: false, reason: 'ID-lər yanlışdır' });
    if (!silent && !global.confirm('DİQQƏT!\n"' + fromId + '" kimliyi "' + toId + '" ilə birləşdirilsin?\n\n' +
        'Bütün yaddaşda köhnə ID yenisi ilə əvəzlənəcək.\nƏvvəlcə tam surət çıxarılacaq — geri qaytara bilərsən.')) {
      return Promise.resolve({ ok: false, reason: 'ləğv edildi' });
    }

    // 1) Bulud körpüsü varsa tam surət çıxart (geri qaytarma imkanı üçün)
    try { if (global.JollyCloudBridge) global.JollyCloudBridge.snapshot('kimlik birləşdirmə'); } catch (e) {}

    var work = function () {
      var touched = [], count = 0;
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (!k || k.indexOf('__jolly_') === 0 || k.indexOf('jolly_journal') === 0) continue;
        var v = rawGet(k);
        if (!v || v.indexOf(fromId) === -1) continue;
        var parts = v.split(fromId);
        var next = parts.join(toId);
        count += parts.length - 1;
        try { global.localStorage.setItem(k, next); touched.push(k); } catch (e) {}
      }
      var map = aliasMap(); map[fromId] = toId; saveAlias(map);
      state.stats.merges++;
      return { keys: touched, replacements: count };
    };

    var run = global.OperationJournal
      ? global.OperationJournal.run('kimlik birləşdirmə', function () { return work(); })
      : Promise.resolve({ ok: true, result: work() });

    return run.then(function (r) {
      var res = r.result || r;
      try { if (global.StorageAdapter) global.StorageAdapter.invalidate(); } catch (e) {}
      toast((res.replacements || 0) + ' yerdə kimlik birləşdirildi — proqram yenilənir', 'ok');
      setTimeout(function () { try { global.location.reload(); } catch (e) {} }, 1000);
      return { ok: true, result: res };
    });
  }

  /* ----------------------------------------------------------------------
     4. PROBLEM 3 — açar qeydiyyatı
     ---------------------------------------------------------------------- */
  function loadExtraKeys() { state.extraKeys = J(rawGet(K_KEYS), []) || []; return state.extraKeys; }
  function saveExtraKeys() { rawSet(K_KEYS, JSON.stringify(state.extraKeys)); }

  function registerKey(key, meta) {
    meta = meta || {};
    var rec = { key: key, name: meta.name || key, group: meta.group || 'Alətlər',
                desc: meta.desc || '', at: Date.now() };
    var E = state.engine || findEngine();
    var done = false;

    // ⚠️ 07-29 audit: əsl API `POS.register(manifest)`-dir, manifest forması:
    //   { id, name, icon, permissions: [{ key, label, tag, default }] }
    // jolly-perms-extra.js məhz bunu işlədir. Təxmin etmirik, eynisini edirik.
    if (E && typeof E.register === 'function') {
      try {
        E.register({
          id: meta.moduleId || 'healthcore',
          name: meta.name || 'Nüvə Sağlamlığı',
          icon: meta.icon || '🩺',
          permissions: [{ key: key, label: meta.desc || meta.name || key,
                          tag: meta.tag || 'view', default: meta.def !== false }]
        });
        try { if (E.reg && E.reg.refreshCustomModule) E.reg.refreshCustomModule(); } catch (e) {}
        done = true;
      } catch (e) { console.warn('[Perm Bridge] POS.register alınmadı:', e); }
    }

    if (!state.extraKeys.some(function (r) { return r.key === key; })) {
      state.extraKeys.push(rec);
      saveExtraKeys();
    }
    return done;
  }

  // POS.can naməlum açar üçün "false" qaytarırsa, Admin-ə icazə ver
  function wrapCan() {
    var E = state.engine;
    if (!E || typeof E.can !== 'function' || E.can.__pbWrapped) return false;
    var orig = E.can;
    E.can = function (key) {
      state.stats.canCalls++;
      var out;
      try { out = orig.apply(this, arguments); }
      catch (e) {
        // Mühərrik xəta atsa proqram dayanmasın
        console.warn('[Perm Bridge] can("' + key + '") xəta verdi, təmir cəhdi:', e && e.message);
        repairStore(true);
        try { out = orig.apply(this, arguments); } catch (e2) { out = isAdmin(); }
      }
      if (out === false && isOurKey(key) && isAdmin()) return true;
      return out;
    };
    E.can.__pbWrapped = true;
    return true;
  }

  function isOurKey(key) {
    return state.extraKeys.some(function (r) { return r.key === key; });
  }
  function isAdmin() {
    var s = session();
    var role = s && (s.role || s.rol);
    return String(role || '').toLowerCase().indexOf('admin') !== -1;
  }

  /* ----------------------------------------------------------------------
     5. API
     ---------------------------------------------------------------------- */
  var PermBridge = {
    version: '1.0.0',

    initialize: function () {
      if (state.ready) return Promise.resolve({ ready: true });
      findEngine();
      loadExtraKeys();

      // 5a. anbarı formaya sal
      repairStore(true);

      // 5b. bu sessiyanın nüvə modulu açarı
      registerKey('health.core.view', {
        moduleId: 'healthcore', name: 'Nüvə Sağlamlığı', icon: '🩺', tag: 'view', def: true,
        desc: 'Yaddaş, jurnal və açılış vəziyyətini görmək'
      });

      // 5c. can() sarğısı
      wrapCan();

      // 5d. kimlik uyğunlaşdırma (yalnız şübhəsiz halda)
      try { reconcileSession(false); } catch (e) {}

      // 5e. icazə açarları buluddan gələndə yenidən formaya sal
      var t = null;
      global.addEventListener('storage.changed', function (e) {
        var d = e && e.detail;
        if (!d || !d.key || !/perm|icaze|icazə|rol|role|user/i.test(d.key)) return;
        if (t) clearTimeout(t);
        t = setTimeout(function () { t = null; repairStore(true); }, 800);
      });

      state.ready = true;
      return Promise.resolve({ ready: true, engine: state.engineName,
                               repaired: state.repairedKeys.length,
                               sessionFixed: state.sessionFixed });
    },

    repairStore: function () { return Promise.resolve(repairStore(false)); },
    registerKey: registerKey,
    extraKeys: function () { return state.extraKeys.slice(); },

    identity: identityReport,
    reconcile: function (force) { return Promise.resolve(reconcileSession(!!force)); },
    merge: mergeIdentity,
    alias: aliasMap,

    // Zülfünün cihazında işlətmək üçün qısayol:
    // JollyPermBridge.linkMeTo('<Esqinin cihazındakı ID>')
    linkMeTo: function (targetId) {
      var s = session();
      var cur = s && (s.userId || s.id || s.uid);
      if (!cur) return Promise.resolve({ ok: false, reason: 'aktiv sessiya yoxdur' });
      return mergeIdentity(cur, targetId);
    },

    /* ---- Sağlamlıq ---- */
    health: function () {
      var rep = identityReport();
      var problems = [];
      if (!state.engine) problems.push('İcazə mühərriki tapılmadı');
      if (!rep.storeKey) problems.push('İstifadəçi siyahısı tapılmadı');
      if (rep.session && rep.matched === false)
        problems.push('Sessiya kimliyi siyahıda yoxdur — icazələr tətbiq olunmur');
      if (rep.duplicates.length)
        problems.push(rep.duplicates.length + ' istifadəçi adı təkrarlanır (fərqli ID) — birləşdirmə lazımdır');
      if (state.stats.containersAdded > 0 && state.repairs > 3)
        problems.push('İcazə anbarı təkrar-təkrar pozulur (' + state.repairs + ' dəfə təmir olundu)');

      return Promise.resolve({
        ok: problems.length === 0,
        problems: problems,
        engine: state.engineName,
        storeKey: rep.storeKey,
        userCount: rep.users.length,
        duplicates: rep.duplicates,
        session: rep.session,
        matched: rep.matched,
        sessionFixed: state.sessionFixed,
        repairedKeys: state.repairedKeys,
        extraKeys: state.extraKeys.map(function (r) { return r.key; }),
        alias: rep.alias,
        stats: JSON.parse(JSON.stringify(state.stats))
      });
    },

    /* ---- Özünü yoxlama ---- */
    selfTest: function () {
      var out = { ok: false, engine: !!state.engine, repair: false, keys: false, identity: false };
      try {
        // qəsdən pozulmuş obyekt düzəlirmi?
        var probe = { roles: {}, users: {} };
        var added = repairObject(probe);
        out.repair = added > 0 && !!probe.overrides;

        out.keys = state.extraKeys.some(function (r) { return r.key === 'health.core.view'; });

        var rep = identityReport();
        out.identity = !!rep.storeKey || rep.users.length === 0;
        out.detail = { users: rep.users.length, duplicates: rep.duplicates.length, matched: rep.matched };

        out.ok = out.repair && out.keys;
      } catch (e) {
        out.error = (e && e.message) || String(e);
      }
      return Promise.resolve(out);
    },

    _internals: function () { return state; }
  };

  global.JollyPermBridge = PermBridge;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { PermBridge.initialize(); }, { once: true });
  } else {
    PermBridge.initialize();
  }

})(window);
