/* ==========================================================================
   JOLLY — jolly-undo.js                       v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   UNİVERSAL "↶ GERİ AL"

   Bütün proqramda tək düymə: hansı ekranda olursan ol, sonuncu məlumat
   dəyişikliyi geri qaytarılır. Məhsul redaktəsi, toplu dəyişiklik, silmə
   işarəsi, qrup şablonu, CSV idxalı, icazə dəyişikliyi — hamısı.

   NİYƏ MÜMKÜNDÜR?
   Çünki `OperationJournal` onsuz da HƏR yazmadan əvvəl köhnə dəyəri
   `op.prev` kimi saxlayır. Geri qaytarma məlumatı artıq mövcuddur —
   biz sadəcə onu tutub istifadəçiyə düymə şəklində veririk.

   HARADAN TUTURUQ?
   `Transaction.prototype.declare()` — bütün yazma yollarının keçdiyi
   YEGANƏ nöqtə (həm köhnə kodun localStorage yazmaları, həm yeni
   adapter yazmaları, həm bulud bərpası). Nüvə fayllarının heç birinə
   toxunmuruq — kənardan sarğı.

   ⚠️ NƏYİ GERİ QAYTARA BİLMİR (əvvəlcədən açıq deyilir):
     1) 2 MB-dan böyük açarlar — surəti saxlanmır (yaddaş çatmazdı)
     2) Şəkillər — IndexedDB-dədir, jurnaldan kənardadır
     3) Buluda ARTIQ göndərilmiş dəyişiklik — yerli geri qaytarılır,
        amma növbəti sinxronda buluddan yenidən qayıda bilər

   Surətlər RAM-da saxlanılır, arxa planda IndexedDB-yə yazılır
   (localStorage-a YOX — 5 MB limiti onları qaldırmazdı).

   İcazə açarı: undo.center.view      Route: #/undo
   Yükləmə yeri: jolly-repair-log.js-dən sonra, app.js-dən əvvəl.
   ========================================================================== */

(function (global) {
  'use strict';

  var PERM  = 'undo.center.view';
  var ROUTE = '#/undo';

  var GROUP_MS      = 900;                  // bu qədər ara ilə gələn yazmalar bir addım sayılır
  var MAX_ENTRIES   = 30;
  var MAX_PREV      = 5 * 1024 * 1024;      // 5 MB-a qədər surət saxlanır (RAM+IDB, localStorage YOX)
  var MAX_TOTAL     = 24 * 1024 * 1024;     // RAM büdcəsi
  var TOAST_MS      = 10000;

  /* ⚠️ 07-29 Esqin qərarı: üzən zolaq SÖNDÜRÜLDÜ.
     Səbəb: gündəlik işdə lazım deyil və ekranı örtürdü. Məlumatda HEÇ NƏ
     dəyişmir — son 30 addım yenə RAM+IndexedDB-də saxlanılır, proqram
     bağlanıb açılsa da qalır. Sadəcə ekranın altında görünmür.
     Yenidən açmaq: JollyUndo.setBar(true)  (bu sessiya üçün) */
  var SHOW_BAR = false;

  var IDB_DB = 'jolly_undo', IDB_VER = 1, IDB_STORE = 'steps';

  /* Açar → insan dilində ad */
  var LABELS = {
    jolly_products: 'Məhsullar', jolly_users_v1: 'İşçilər',
    jolly_perm_os_v2: 'İcazələr', jolly_perm_audit_v2: 'İcazə auditi',
    jolly_groups: 'Qruplar', jolly_statuses: 'Statuslar',
    jolly_locations: 'Yerlər', jolly_suppliers: 'Tədarükçülər',
    jolly_brands: 'Firmalar', jolly_settings: 'Parametrlər',
    jolly_tombstones: 'Silinmə izləri', jolly_marked_for_deletion: 'Silinmə üçün işarələnənlər',
    jolly_trash: 'Zibil qutusu', jolly_drafts: 'Qaralamalar',
    jolly_store_map_sections: 'Mağaza xəritəsi', jolly_filter_tags: 'Filtr etiketləri',
    jolly_edge_config: 'Kənar panel', jolly_module_order: 'Modul sırası'
  };
  function label(key) { return LABELS[key] || key.replace(/^jolly_/, ''); }

  /* ----------------------------------------------------------------------
     0. Vəziyyət
     ---------------------------------------------------------------------- */
  var state = {
    ready: false,
    stack: [],            // [{id, at, title, user, ops:[{key,prev,next,bytes}], undone, source}]
    open: null,           // qruplaşdırma üçün açıq addım
    timer: null,
    busy: false,          // geri qaytarma gedir — yeni qeyd yazma
    bytes: 0,
    db: null,
    wrapped: false,
    stats: { recorded: 0, undone: 0, skipped: 0, tooBig: 0, persisted: 0 }
  };

  function now() { return Date.now(); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ago(ts) {
    var s = Math.floor((now() - ts) / 1000);
    if (s < 60) return s + ' saniyə əvvəl';
    if (s < 3600) return Math.floor(s / 60) + ' dəqiqə əvvəl';
    if (s < 86400) return Math.floor(s / 3600) + ' saat əvvəl';
    return Math.floor(s / 86400) + ' gün əvvəl';
  }
  function whoAmI() {
    try {
      var s = global.sessionStorage.getItem('jolly_sec_session');
      if (s) { var o = JSON.parse(s); return (o && (o.name || o.userId)) || null; }
    } catch (e) {}
    return null;
  }
  function toast(msg, kind) {
    try {
      if (global.Toast) {
        if (kind === 'error' && global.Toast.error) return global.Toast.error(msg);
        if (global.Toast.success && kind === 'ok') return global.Toast.success(msg);
        if (global.Toast.info) return global.Toast.info(msg);
      }
    } catch (e) {}
    console.log('[Undo] ' + msg);
  }

  function skipKey(key) {
    if (!key) return true;
    var k = String(key);
    if (k.indexOf('__jolly_') === 0) return true;
    if (k.indexOf('jolly_journal') === 0) return true;
    if (/_sig$/.test(k)) return true;
    if (/log|jurnal|blackbox|diag|heartbeat|session|cache|kes|archive|arxiv|recent|activity|last_change/i.test(k)) return true;
    // ⚠️ 07-29 cihaz testi: bunlar MƏLUMAT deyil, ekran görünüşüdür — geri
    // alınacaq bir şey yoxdur, sadəcə zolaq lazımsız yerdə çıxırdı.
    if (/^jolly_(module_view|module_order|view_mode|edge_config|device_id|device_name|ota_[a-z_]*|announce_[a-z_]*|changelog_reads|snapshot)$/.test(k)) return true;
    return false;
  }

  /* ----------------------------------------------------------------------
     1. IndexedDB — surətlər localStorage-a SIĞMAZ, ona görə IDB
     ---------------------------------------------------------------------- */
  function openDb() {
    if (state.db) return Promise.resolve(state.db);
    if (!global.indexedDB) return Promise.reject(new Error('IndexedDB yoxdur'));
    return new Promise(function (res, rej) {
      var r;
      try { r = global.indexedDB.open(IDB_DB, IDB_VER); } catch (e) { return rej(e); }
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      };
      r.onsuccess = function () { state.db = r.result; res(state.db); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function persist(step) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) {
        var st = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE);
        var q = st.put(step);
        q.onsuccess = function () { state.stats.persisted++; res(true); };
        q.onerror = function () { rej(q.error); };
      });
    }).catch(function () { return false; });
  }

  function unpersist(id) {
    return openDb().then(function (db) {
      return new Promise(function (res) {
        var st = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE);
        var q = st.delete(id);
        q.onsuccess = function () { res(true); };
        q.onerror = function () { res(false); };
      });
    }).catch(function () { return false; });
  }

  function loadPersisted() {
    return openDb().then(function (db) {
      return new Promise(function (res) {
        var st = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE);
        var q = st.getAll ? st.getAll() : null;
        if (!q) return res([]);
        q.onsuccess = function () { res(q.result || []); };
        q.onerror = function () { res([]); };
      });
    }).catch(function () { return []; });
  }

  /* ----------------------------------------------------------------------
     2. Qeyd — Transaction.declare() sarğısı
     ---------------------------------------------------------------------- */
  function pushOp(txName, op) {
    if (state.busy) return;                       // geri qaytarmanın özünü yazmırıq
    if (skipKey(op.key)) { state.stats.skipped++; return; }

    /* ⚠️ 07-29 cihaz testi — ƏSAS DÜZƏLİŞ:
       Jurnal köhnə surəti yalnız 128 KB-a qədər saxlayır, çünki o, surətləri
       localStorage-a yazır və 5 MB limitini qorumalıdır. Amma `jolly_products`
       946 KB-dır → jurnalda `prev` yoxdur → məhsul dəyişikliyi geri alına
       bilmirdi. Yəni Geri Al-ın ƏSAS İŞİ işləmirdi.
       Həll: surəti ÖZÜMÜZ oxuyuruq. declare() yazmadan ƏVVƏL çağırıldığı üçün
       localStorage-da hələ köhnə dəyər durur. Bizim surətlərimiz RAM və
       IndexedDB-yə gedir, localStorage-a yox — ona görə həcm problemi yoxdur. */
    var prev = (op.prev && op.prev.rollbackable !== false) ? op.prev.v : null;
    if (prev === null || prev === undefined) {
      try { prev = global.localStorage.getItem(op.key); } catch (e) { prev = null; }
    }
    var bytes = prev ? prev.length * 2 : 0;
    if (bytes > MAX_PREV) { state.stats.tooBig++; return; }

    var t = now();
    if (!state.open || (t - state.open.at) > GROUP_MS) {
      state.open = { id: 'u' + t.toString(36) + Math.random().toString(36).slice(2, 5),
                     at: t, user: whoAmI(), ops: [], undone: false,
                     source: txName || 'dəyişiklik' };
      state.stack.unshift(state.open);
      if (state.stack.length > MAX_ENTRIES) {
        var dropped = state.stack.pop();
        state.bytes -= (dropped._bytes || 0);
        unpersist(dropped.id);
      }
    }

    // Eyni açar bir addımda təkrarlanırsa, İLK surəti saxlayırıq
    var exists = null;
    for (var i = 0; i < state.open.ops.length; i++) {
      if (state.open.ops[i].key === op.key) { exists = state.open.ops[i]; break; }
    }
    if (exists) { exists.type = op.type; return; }

    state.open.ops.push({ key: op.key, prev: prev, type: op.type, bytes: bytes });
    state.open._bytes = (state.open._bytes || 0) + bytes;
    state.bytes += bytes;
    state.stats.recorded++;

    // Büdcə aşılıbsa ən köhnələri at
    while (state.bytes > MAX_TOTAL && state.stack.length > 1) {
      var d = state.stack.pop();
      state.bytes -= (d._bytes || 0);
      unpersist(d.id);
    }

    // Addımı bağlamaq və istifadəçiyə düymə göstərmək
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(function () {
      var step = state.open;
      state.open = null;
      state.timer = null;
      if (!step || !step.ops.length) return;
      step.title = titleOf(step);
      persist(step);
      if (SHOW_BAR) showBar(step);
      try {
        global.dispatchEvent(new CustomEvent('undo.recorded', { detail: { id: step.id, title: step.title } }));
      } catch (e) {}
    }, GROUP_MS);
  }

  function titleOf(step) {
    var names = step.ops.map(function (o) { return label(o.key); });
    var uniq = names.filter(function (v, i) { return names.indexOf(v) === i; });
    if (uniq.length === 1) return uniq[0] + ' dəyişdi';
    if (uniq.length === 2) return uniq.join(' və ') + ' dəyişdi';
    return uniq.slice(0, 2).join(', ') + ' və daha ' + (uniq.length - 2) + ' bölmə dəyişdi';
  }

  function installWrap() {
    if (state.wrapped) return true;
    var OJ = global.OperationJournal;
    if (!OJ || !OJ.Transaction || !OJ.Transaction.prototype) return false;
    var P = OJ.Transaction.prototype;
    if (P.declare.__undoWrapped) { state.wrapped = true; return true; }

    var origDeclare = P.declare;
    P.declare = function (type, key, nextRaw) {
      var op = origDeclare.call(this, type, key, nextRaw);
      try { pushOp(this.name, op); } catch (e) {}
      return op;
    };
    P.declare.__undoWrapped = true;
    state.wrapped = true;
    return true;
  }

  /* ----------------------------------------------------------------------
     3. Geri qaytarma
     ---------------------------------------------------------------------- */
  function applyStep(step) {
    if (!step || step.undone) return Promise.resolve({ ok: false, reason: 'onsuz da geri qaytarılıb' });

    state.busy = true;
    var done = 0, failed = [];
    try {
      step.ops.forEach(function (o) {
        try {
          if (o.prev === null || o.prev === undefined) global.localStorage.removeItem(o.key);
          else global.localStorage.setItem(o.key, o.prev);
          done++;
        } catch (e) { failed.push(o.key); }
      });
    } finally {
      setTimeout(function () { state.busy = false; }, 50);
    }

    step.undone = true;
    step.undoneAt = now();
    persist(step);

    try { if (global.StorageAdapter) global.StorageAdapter.invalidate(); } catch (e) {}
    try { if (global.MemoryMirror) step.ops.forEach(function (o) { global.MemoryMirror.reload(o.key); }); } catch (e) {}
    try {
      global.dispatchEvent(new CustomEvent('undo.applied', {
        detail: { id: step.id, title: step.title, keys: step.ops.length }
      }));
    } catch (e) {}

    state.stats.undone++;
    return Promise.resolve({ ok: failed.length === 0, restored: done, failed: failed });
  }

  function undoLatest() {
    var step = null;
    for (var i = 0; i < state.stack.length; i++) {
      if (!state.stack[i].undone) { step = state.stack[i]; break; }
    }
    if (!step) { toast('Geri qaytarılacaq dəyişiklik yoxdur'); return Promise.resolve({ ok: false }); }
    return undoById(step.id);
  }

  function undoById(id) {
    var step = null;
    for (var i = 0; i < state.stack.length; i++) if (state.stack[i].id === id) step = state.stack[i];
    if (!step) return Promise.resolve({ ok: false, reason: 'tapılmadı' });

    return applyStep(step).then(function (r) {
      hideBar();
      if (r.ok) {
        toast('↶ Geri qaytarıldı: ' + step.title, 'ok');
        setTimeout(function () { try { global.location.reload(); } catch (e) {} }, 700);
      } else {
        toast('Bəziləri geri qaytarılmadı: ' + (r.failed || []).join(', '), 'error');
      }
      return r;
    });
  }

  /* ----------------------------------------------------------------------
     4. Üzən zolaq (Gmail üsulu)
     ---------------------------------------------------------------------- */
  var CSS = [
    '#jundo-bar{position:fixed;left:12px;right:12px;bottom:92px;z-index:9998;',
    'display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:15px;',
    'background:rgba(22,24,30,.96);border:1px solid rgba(255,255,255,.14);',
    'box-shadow:0 10px 30px rgba(0,0,0,.45);color:#e8e8f0;font-size:14px;',
    'transform:translateY(140%);transition:transform .28s cubic-bezier(.2,.9,.3,1);',
    'backdrop-filter:blur(10px)}',
    '#jundo-bar.on{transform:translateY(0)}',
    '#jundo-bar .jt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#jundo-bar .jb{flex:none;padding:8px 14px;border-radius:11px;font-weight:700;font-size:13.5px;',
    'background:rgba(245,196,81,.16);border:1px solid rgba(245,196,81,.45);color:#f7d98a;',
    'cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '#jundo-bar .jb:active{transform:scale(.95)}',
    '#jundo-bar .jx{flex:none;opacity:.5;padding:6px 4px;cursor:pointer;font-size:17px}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('jundo-css')) return;
    var s = document.createElement('style');
    s.id = 'jundo-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  var barTimer = null;
  function showBar(step) {
    injectCSS();
    var bar = document.getElementById('jundo-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'jundo-bar';
      bar.innerHTML = '<div class="jt"></div><div class="jb">↶ Geri al</div><div class="jx">✕</div>';
      document.body.appendChild(bar);
      bar.querySelector('.jb').addEventListener('click', function () {
        var id = bar.getAttribute('data-step');
        if (id) undoById(id);
      });
      bar.querySelector('.jx').addEventListener('click', hideBar);
    }
    bar.setAttribute('data-step', step.id);
    bar.querySelector('.jt').textContent = step.title;
    requestAnimationFrame(function () { bar.classList.add('on'); });
    if (barTimer) clearTimeout(barTimer);
    barTimer = setTimeout(hideBar, TOAST_MS);
  }

  function hideBar() {
    var bar = document.getElementById('jundo-bar');
    if (bar) bar.classList.remove('on');
    if (barTimer) { clearTimeout(barTimer); barTimer = null; }
  }

  /* ----------------------------------------------------------------------
     5. Geri Al Mərkəzi (modul)
     ---------------------------------------------------------------------- */
  var PCSS = [
    '#jundoc{padding:14px 12px 90px;max-width:720px;margin:0 auto;color:#e8e8f0}',
    '#jundoc h2{font-size:19px;margin:0 0 3px;font-weight:700}',
    '#jundoc .sub{font-size:12px;opacity:.6;margin-bottom:14px}',
    '#jundoc .row{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);',
    'border-radius:15px;padding:12px 13px;margin-bottom:9px;display:flex;gap:11px;align-items:center}',
    '#jundoc .row.done{opacity:.45}',
    '#jundoc .row .m{flex:1;min-width:0}',
    '#jundoc .row .t{font-size:14.5px;font-weight:600;margin-bottom:3px}',
    '#jundoc .row .d{font-size:11.5px;opacity:.6}',
    '#jundoc .row .u{flex:none;padding:9px 13px;border-radius:11px;font-size:13px;font-weight:700;',
    'background:rgba(245,196,81,.14);border:1px solid rgba(245,196,81,.42);color:#f7d98a;cursor:pointer}',
    '#jundoc .empty{text-align:center;opacity:.55;padding:40px 10px;font-size:14px}',
    '#jundoc .note{font-size:11.5px;opacity:.5;line-height:1.6;margin-top:16px;',
    'border-top:1px solid rgba(255,255,255,.08);padding-top:12px}'
  ].join('');

  function view() {
    var h = ['<div id="jundoc">'];
    h.push('<h2>↶ Geri Al Mərkəzi</h2>');
    h.push('<div class="sub">Son ' + state.stack.length + ' dəyişiklik · ' +
           (state.bytes / 1048576).toFixed(1) + ' MB surət</div>');

    if (!state.stack.length) {
      h.push('<div class="empty">Hələ geri qaytarılacaq dəyişiklik yoxdur.</div>');
    } else {
      state.stack.forEach(function (s) {
        h.push('<div class="row' + (s.undone ? ' done' : '') + '">');
        h.push('<div class="m"><div class="t">' + esc(s.title || titleOf(s)) + '</div>');
        h.push('<div class="d">' + ago(s.at) + (s.user ? ' · ' + esc(s.user) : '') +
               ' · ' + s.ops.length + ' bölmə' + (s.undone ? ' · geri qaytarılıb' : '') + '</div></div>');
        if (!s.undone) h.push('<div class="u" data-undo="' + s.id + '">↶ Geri al</div>');
        h.push('</div>');
      });
    }

    h.push('<div class="note">⚠️ Geri qaytarıla bilməyənlər: 2 MB-dan böyük bölmələr, ' +
           'şəkillər (IndexedDB-dədir), və buluda artıq göndərilmiş dəyişikliklər — ' +
           'onlar növbəti sinxronda buluddan yenidən qayıda bilər.</div>');
    h.push('</div>');
    return h.join('');
  }

  function bindPanel() {
    var root = document.getElementById('jundoc');
    if (!root || root.__b) return;
    root.__b = true;
    root.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-undo]') : null;
      if (!el) return;
      undoById(el.getAttribute('data-undo'));
    });
  }

  /* ----------------------------------------------------------------------
     6. API
     ---------------------------------------------------------------------- */
  var Undo = {
    version: '1.0.0',

    initialize: function () {
      if (state.ready) return Promise.resolve({ ready: true });
      var ok = installWrap();
      if (!ok) setTimeout(installWrap, 2000);

      // Keçən sessiyanın addımlarını geri gətir
      loadPersisted().then(function (list) {
        if (!list || !list.length) return;
        list.sort(function (a, b) { return b.at - a.at; });
        var known = {};
        state.stack.forEach(function (s) { known[s.id] = true; });
        list.slice(0, MAX_ENTRIES).forEach(function (s) {
          if (!known[s.id]) { state.stack.push(s); state.bytes += (s._bytes || 0); }
        });
        state.stack.sort(function (a, b) { return b.at - a.at; });
      });

      state.ready = true;
      return Promise.resolve({ ready: true, wrapped: state.wrapped });
    },

    setBar: function (v) { SHOW_BAR = !!v; if (!SHOW_BAR) hideBar(); return SHOW_BAR; },
    barEnabled: function () { return SHOW_BAR; },

    undo: undoLatest,
    undoById: undoById,
    list: function () {
      return state.stack.map(function (s) {
        return { id: s.id, at: s.at, title: s.title || titleOf(s), user: s.user,
                 keys: s.ops.map(function (o) { return o.key; }), undone: !!s.undone };
      });
    },
    canUndo: function () { return state.stack.some(function (s) { return !s.undone; }); },
    clear: function () {
      state.stack.forEach(function (s) { unpersist(s.id); });
      state.stack = []; state.bytes = 0; state.open = null;
      return true;
    },
    stats: function () { return JSON.parse(JSON.stringify(state.stats)); },

    render: function () { injectCSS(); setTimeout(bindPanel, 0); return view(); },
    afterRender: function () { injectCSS(); bindPanel(); },
    open: function () {
      injectCSS();
      var main = document.getElementById('main') || document.body;
      main.innerHTML = view();
      bindPanel();
    },

    health: function () {
      var problems = [];
      if (!state.wrapped) problems.push('OperationJournal tapılmadı — geri al işləmir');
      if (state.stats.tooBig) problems.push(state.stats.tooBig + ' dəyişiklik çox böyük olduğu üçün geri qaytarıla bilməz');
      if (!global.indexedDB) problems.push('IndexedDB yoxdur — geri al yalnız bu sessiyada işləyir');
      return Promise.resolve({
        ok: problems.length === 0, problems: problems,
        wrapped: state.wrapped, steps: state.stack.length,
        undoable: state.stack.filter(function (s) { return !s.undone; }).length,
        mb: +(state.bytes / 1048576).toFixed(2),
        stats: this.stats(), latest: this.list().slice(0, 5)
      });
    },

    selfTest: function () {
      var k = 'jolly_undo_probe';
      var out = { ok: false, wrapped: state.wrapped, recorded: false, restored: false };
      try {
        global.localStorage.setItem(k, 'KOHNE');
      } catch (e) { out.error = 'yazma alınmadı'; return Promise.resolve(out); }

      // Bu açar skipKey-ə düşməsin deyə müvəqqəti LABELS-ə salırıq (skip siyahısında yoxdur)
      var before = state.stats.recorded;
      try { global.localStorage.setItem(k, 'YENI'); } catch (e) {}

      var self = this;
      return new Promise(function (res) { setTimeout(res, GROUP_MS + 250); }).then(function () {
        out.recorded = state.stats.recorded > before;
        var step = null;
        for (var i = 0; i < state.stack.length; i++) {
          if (!state.stack[i].undone && state.stack[i].ops.some(function (o) { return o.key === k; })) {
            step = state.stack[i]; break;
          }
        }
        if (!step) { out.ok = false; return out; }
        return applyStep(step).then(function () {
          out.restored = global.localStorage.getItem(k) === 'KOHNE';
          try { global.localStorage.removeItem(k); } catch (e) {}
          state.stack = state.stack.filter(function (s) { return s !== step; });
          unpersist(step.id);
          out.ok = out.wrapped && out.recorded && out.restored;
          return out;
        });
      }).catch(function (e) { out.error = (e && e.message) || String(e); return out; });
    },

    _internals: function () { return state; }
  };

  global.JollyUndo = Undo;

  /* ----------------------------------------------------------------------
     7. İcazə açarı + modul qeydiyyatı
     ---------------------------------------------------------------------- */
  function registerAll() {
    try {
      if (global.POS && typeof global.POS.register === 'function') {
        global.POS.register({
          id: 'undocenter', name: 'Geri Al', icon: '↶',
          permissions: [{ key: PERM, label: 'Dəyişikliyi geri qaytar', tag: 'edit', default: true }]
        });
        try { if (global.POS.reg && global.POS.reg.refreshCustomModule) global.POS.reg.refreshCustomModule(); } catch (e) {}
      }
    } catch (e) {}
    try {
      if (global.ModuleRegistry && typeof global.ModuleRegistry.register === 'function') {
        global.ModuleRegistry.register({
          id: 'undo-center', name: 'Geri Al Mərkəzi', icon: '↶',
          route: ROUTE, group: 'Alətlər', perm: PERM,
          render: Undo.render, afterRender: Undo.afterRender
        });
        return true;
      }
    } catch (e) { console.warn('[Undo] modul qeydiyyatı:', e); }
    return false;
  }

  function boot() {
    Undo.initialize();
    if (!registerAll()) setTimeout(registerAll, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }

})(window);
