/* ==========================================================================
   JOLLY vNext — jolly-health-v2.js            v1.0.0   (2026-07-29)
   --------------------------------------------------------------------------
   HealthMonitor v2 — nüvə qatının vəziyyətini bir ekranda göstərir:
     • StorageAdapter  — hansı backend, neçə MB, ən ağır açarlar
     • OperationJournal— açıq niyyətlər, son bərpa, degraded vəziyyət
     • DB Bridge       — sarğı işləyir?, bloklanmış yazmalar
     • Boot            — hansı mərhələ nə qədər çəkdi, açılış döngəsi
     • IndexedDB       — şəkillərin tutduğu həcm, kvota faizi
     • Sinxron         — son sinxronizasiyadan nə qədər keçdi

   + təmir alətləri: bərpa et, yer aç, jurnalı təmizlə, keşi at, tam test

   NİYƏ jolly-selftest.js YENİDƏN YAZILMADI?
   Yazılmadı — o öz işini görür və toxunulmadı. Bu modul ONUN YANINDA
   dayanır və yalnız YENİ nüvə qatını izləyir. İkisi bir-birini əvəz etmir:
   Yoxlama (#/selftest) = modul/funksiya yoxlaması,
   Nüvə Sağlamlığı (#/health-v2) = məlumat qatının vəziyyəti.

   İcazə açarı: health.core.view
   Route: #/health-v2
   ========================================================================== */

(function (global) {
  'use strict';

  var PERM = 'health.core.view';
  var ROUTE = '#/health-v2';

  /* ----------------------------------------------------------------------
     0. Köməkçilər
     ---------------------------------------------------------------------- */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function mb(bytes) {
    if (bytes === null || bytes === undefined || bytes < 0) return '—';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }
  function ago(ts) {
    if (!ts) return 'heç vaxt';
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + ' saniyə əvvəl';
    if (s < 3600) return Math.floor(s / 60) + ' dəqiqə əvvəl';
    if (s < 86400) return Math.floor(s / 3600) + ' saat əvvəl';
    return Math.floor(s / 86400) + ' gün əvvəl';
  }
  function safe(fn, fallback) {
    try { var r = fn(); return (r === undefined ? fallback : r); } catch (e) { return fallback; }
  }
  function toast(msg, kind) {
    try {
      if (global.Toast) {
        if (kind === 'error' && global.Toast.error) return global.Toast.error(msg);
        if (kind === 'ok' && global.Toast.success) return global.Toast.success(msg);
        if (global.Toast.info) return global.Toast.info(msg);
      }
    } catch (e) {}
    console.log('[Health] ' + msg);
  }

  /* ----------------------------------------------------------------------
     1. Sinxron yaşı — cloud.js-in adını bilmədən tapmağa çalışırıq
     ---------------------------------------------------------------------- */
  function syncInfo() {
    var out = { lastSync: null, pending: null, source: null };

    // 1) cloud.js açıq API verirsə
    var C = global.JollyCloud || global.Cloud || null;
    if (C) {
      out.lastSync = safe(function () {
        if (typeof C.lastSync === 'function') return C.lastSync();
        if (typeof C.getLastSync === 'function') return C.getLastSync();
        return C.lastSyncAt || null;
      }, null);
      out.pending = safe(function () {
        if (typeof C.isPendingSync === 'function') return !!C.isPendingSync();
        return null;
      }, null);
      if (out.lastSync) out.source = 'cloud.js';
    }

    // 2) yoxsa localStorage-da tarix kimi görünən sync açarını axtar
    if (!out.lastSync) {
      safe(function () {
        for (var i = 0; i < global.localStorage.length; i++) {
          var k = global.localStorage.key(i);
          if (!k || k.toLowerCase().indexOf('sync') === -1) continue;
          var v = global.localStorage.getItem(k);
          if (!v) continue;
          var n = parseInt(String(v).replace(/[^0-9]/g, '').slice(0, 13), 10);
          if (n > 1500000000000 && n < Date.now() + 86400000) {
            if (!out.lastSync || n > out.lastSync) { out.lastSync = n; out.source = k; }
          }
        }
      });
    }
    return out;
  }

  /* ----------------------------------------------------------------------
     2. IndexedDB / şəkil həcmi
     ---------------------------------------------------------------------- */
  function idbInfo() {
    var est = (global.navigator && global.navigator.storage && global.navigator.storage.estimate)
      ? global.navigator.storage.estimate().catch(function () { return null; })
      : Promise.resolve(null);

    var imgCount = new Promise(function (res) {
      var S = global.JollyStorage;
      if (!S) return res(null);
      try {
        if (typeof S.count === 'function') { var r = S.count(); return res(r && r.then ? r : Promise.resolve(r)); }
        if (typeof S.keys === 'function') {
          var k = S.keys();
          return res(k && k.then ? k.then(function (a) { return a && a.length; }) : (k && k.length));
        }
      } catch (e) {}
      res(null);
    }).then(function (v) { return v; }).catch(function () { return null; });

    return Promise.all([est, imgCount]).then(function (r) {
      var e = r[0];
      return {
        usage: e ? e.usage : null,
        quota: e ? e.quota : null,
        percent: (e && e.quota) ? +((e.usage / e.quota) * 100).toFixed(1) : null,
        images: r[1]
      };
    });
  }

  /* ----------------------------------------------------------------------
     3. Əsas yoxlama
     ---------------------------------------------------------------------- */
  function check(opts) {
    opts = opts || {};
    var jobs = {
      adapter: global.StorageAdapter ? global.StorageAdapter.health().catch(errObj) : Promise.resolve(null),
      journal: global.OperationJournal ? global.OperationJournal.health().catch(errObj) : Promise.resolve(null),
      bridge:  global.JollyDBBridge ? global.JollyDBBridge.health().catch(errObj) : Promise.resolve(null),
      boot:    global.JollyBoot ? global.JollyBoot.health().catch(errObj) : Promise.resolve(null),
      idb:     idbInfo().catch(errObj)
    };
    function errObj(e) { return { ok: false, problems: ['yoxlama xətası: ' + ((e && e.message) || e)] }; }

    var names = Object.keys(jobs);
    return Promise.all(names.map(function (n) { return jobs[n]; })).then(function (vals) {
      var res = {};
      names.forEach(function (n, i) { res[n] = vals[i]; });
      res.sync = syncInfo();

      // Problemləri bir yerə yığ
      var problems = [];
      ['adapter', 'journal', 'bridge', 'boot'].forEach(function (n) {
        var part = res[n];
        if (!part) { problems.push({ level: 'warn', part: n, text: n + ' modulu yüklənməyib' }); return; }
        (part.problems || []).forEach(function (p) {
          var level = /dolu|4\.5|çökmə|itib|bloklandı|düzəldilə bilmədi|yazıla bilmir/i.test(p) ? 'bad' : 'warn';
          problems.push({ level: level, part: n, text: p });
        });
      });
      if (res.idb && res.idb.percent !== null && res.idb.percent > 80) {
        problems.push({ level: 'bad', part: 'idb', text: 'Cihaz yaddaşı ' + res.idb.percent + '% doludur' });
      }
      if (res.sync.lastSync && Date.now() - res.sync.lastSync > 3 * 86400000) {
        problems.push({ level: 'warn', part: 'sync', text: 'Son sinxron 3 gündən çoxdur — buluda göndər' });
      }
      if (res.sync.pending === true) {
        problems.push({ level: 'warn', part: 'sync', text: 'Göndərilməmiş dəyişiklik var' });
      }

      res.problems = problems;
      res.bad = problems.filter(function (p) { return p.level === 'bad'; }).length;
      res.warn = problems.filter(function (p) { return p.level === 'warn'; }).length;
      res.status = res.bad ? 'bad' : (res.warn ? 'warn' : 'ok');
      res.at = Date.now();

      lastResult = res;
      if (!opts.quiet) console.log('[Health v2]', res);
      return res;
    });
  }

  var lastResult = null;

  /* ----------------------------------------------------------------------
     4. Təmir alətləri
     ---------------------------------------------------------------------- */
  var Actions = {
    recover: function () {
      if (!global.OperationJournal) return Promise.resolve(toast('Jurnal yoxdur', 'error'));
      return global.OperationJournal.recover().then(function (r) {
        toast(r.found ? (r.found + ' yarımçıq əməliyyat təmizləndi') : 'Yarımçıq əməliyyat yoxdur', 'ok');
        return r;
      });
    },
    reclaim: function () {
      if (!global.JollyDBBridge) return Promise.resolve(toast('Körpü yoxdur', 'error'));
      return global.JollyDBBridge.reclaim().then(function (freed) {
        toast(freed ? ('~' + (freed / 1024).toFixed(0) + ' KB yer açıldı') : 'Kəsiləcək nəsə tapılmadı', 'ok');
        return freed;
      });
    },
    clearJournal: function () {
      if (!global.OperationJournal) return Promise.resolve();
      if (!global.confirm('Jurnal qeydləri silinsin? (Məhsul məlumatına toxunulmur)')) return Promise.resolve();
      global.OperationJournal.clear();
      toast('Jurnal təmizləndi', 'ok');
      return Promise.resolve();
    },
    dropCache: function () {
      if (global.StorageAdapter) global.StorageAdapter.invalidate();
      toast('Keş atıldı', 'ok');
      return Promise.resolve();
    },
    fullTest: function () {
      if (!global.JollyBoot) return Promise.resolve(toast('Boot modulu yoxdur', 'error'));
      toast('Test işə düşdü…');
      return global.JollyBoot.selfTest().then(function (r) {
        toast(r.ok ? '✅ Nüvə testləri keçdi' : '⚠️ Bəzi testlər keçmədi — hesabata bax',
              r.ok ? 'ok' : 'error');
        return r;
      });
    },
    copyReport: function () {
      return check({ quiet: true }).then(function (res) {
        var txt = Reporter.text(res);
        var done = function () { toast('Hesabat kopyalandı', 'ok'); };
        if (global.navigator && global.navigator.clipboard) {
          return global.navigator.clipboard.writeText(txt).then(done, function () {
            console.log(txt); toast('Kopyalanmadı — konsola yazıldı', 'error');
          });
        }
        console.log(txt); toast('Konsola yazıldı', 'ok');
      });
    }
  };

  /* ----------------------------------------------------------------------
     5. Mətn hesabatı (kopyalamaq üçün)
     ---------------------------------------------------------------------- */
  var Reporter = {
    text: function (r) {
      var L = [];
      L.push('=== JOLLY NÜVƏ SAĞLAMLIĞI ===');
      L.push('Tarix: ' + new Date(r.at).toLocaleString('az-AZ'));
      L.push('Vəziyyət: ' + (r.status === 'ok' ? 'TƏMİZ' : r.status === 'warn' ? 'XƏBƏRDARLIQ' : 'PROBLEM'));
      L.push('');
      if (r.adapter) {
        L.push('[Yaddaş] backend=' + r.adapter.backend + '  ' + mb(r.adapter.bytes) +
               '  açar=' + r.adapter.keyCount + '  yazma=' + r.adapter.stats.writes +
               '  oxu=' + r.adapter.stats.reads + '  xəta=' + r.adapter.stats.errors);
      }
      if (r.journal) {
        L.push('[Jurnal] qoşulu=' + r.journal.attached + '  açıq=' + r.journal.openCount +
               '  degraded=' + r.journal.degraded + '  commit=' + r.journal.stats.committed +
               '  rollback=' + r.journal.stats.rolledBack + '  bərpa=' + r.journal.stats.recovered);
      }
      if (r.bridge) {
        L.push('[Körpü] quraşdırılıb=' + r.bridge.installed + '  tutulan=' + r.bridge.stats.intercepted +
               '  jurnalda=' + r.bridge.stats.journaled + '  bloklanan=' + r.bridge.stats.blocked);
        (r.bridge.heavy || []).forEach(function (h) { L.push('   ağır açar: ' + h.key + ' — ' + h.kb + ' KB'); });
      }
      if (r.boot) {
        L.push('[Açılış] ' + r.boot.totalMs + ' ms  cəhd=' + r.boot.attempts);
        (r.boot.phases || []).forEach(function (p) {
          L.push('   ' + p.name + ': ' + p.ms + ' ms' + (p.ok ? '' : ' ✗ ' + p.error));
        });
      }
      if (r.idb) {
        L.push('[Cihaz yaddaşı] ' + mb(r.idb.usage) + ' / ' + mb(r.idb.quota) +
               (r.idb.percent !== null ? ' (' + r.idb.percent + '%)' : '') +
               (r.idb.images !== null && r.idb.images !== undefined ? '  şəkil=' + r.idb.images : ''));
      }
      L.push('[Sinxron] ' + ago(r.sync.lastSync) + (r.sync.pending === true ? ' — gözləyən var' : ''));
      L.push('');
      if (!r.problems.length) L.push('Problem tapılmadı.');
      else r.problems.forEach(function (p) {
        L.push((p.level === 'bad' ? '🔴 ' : '🟡 ') + '[' + p.part + '] ' + p.text);
      });
      return L.join('\n');
    }
  };

  /* ----------------------------------------------------------------------
     6. UI
     ---------------------------------------------------------------------- */
  var CSS = [
    '#jhv2{padding:14px 12px 90px;max-width:760px;margin:0 auto;color:#e8e8f0}',
    '#jhv2 .jh-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}',
    '#jhv2 .jh-dot{width:14px;height:14px;border-radius:50%;flex:none;box-shadow:0 0 12px currentColor}',
    '#jhv2 .jh-ok{color:#37d67a;background:#37d67a}',
    '#jhv2 .jh-warn{color:#f5c451;background:#f5c451}',
    '#jhv2 .jh-bad{color:#ff5470;background:#ff5470}',
    '#jhv2 h2{font-size:19px;margin:0;font-weight:700;letter-spacing:.3px}',
    '#jhv2 .jh-sub{font-size:12px;opacity:.6;margin-top:2px}',
    '#jhv2 .jh-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);',
    'border-radius:16px;padding:13px 14px;margin-bottom:11px}',
    '#jhv2 .jh-card h3{margin:0 0 9px;font-size:13px;letter-spacing:1.1px;text-transform:uppercase;opacity:.72;font-weight:700}',
    '#jhv2 .jh-row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:14px;',
    'border-bottom:1px solid rgba(255,255,255,.05)}',
    '#jhv2 .jh-row:last-child{border-bottom:0}',
    '#jhv2 .jh-row span:first-child{opacity:.66}',
    '#jhv2 .jh-row span:last-child{font-variant-numeric:tabular-nums;text-align:right}',
    '#jhv2 .jh-bar{height:7px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:9px}',
    '#jhv2 .jh-bar i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#37d67a,#f5c451)}',
    '#jhv2 .jh-prob{display:flex;gap:9px;padding:8px 0;font-size:13.5px;line-height:1.45;',
    'border-bottom:1px solid rgba(255,255,255,.05)}',
    '#jhv2 .jh-prob:last-child{border-bottom:0}',
    '#jhv2 .jh-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '#jhv2 .jh-btn{padding:12px 10px;border-radius:13px;border:1px solid rgba(255,255,255,.14);',
    'background:rgba(255,255,255,.06);color:#e8e8f0;font-size:13.5px;font-weight:600;text-align:center;',
    'cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '#jhv2 .jh-btn:active{transform:scale(.97)}',
    '#jhv2 .jh-btn.wide{grid-column:1/-1}',
    '#jhv2 .jh-gold{border-color:rgba(245,196,81,.45);background:rgba(245,196,81,.12);color:#f7d98a}',
    '#jhv2 pre{white-space:pre-wrap;word-break:break-word;font-size:11.5px;line-height:1.5;',
    'background:rgba(0,0,0,.3);border-radius:12px;padding:11px;margin:0;max-height:260px;overflow:auto}',
    '#jhv2 .jh-mini{font-size:11.5px;opacity:.55;margin-top:6px}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('jhv2-css')) return;
    var s = document.createElement('style');
    s.id = 'jhv2-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function rows(list) {
    return list.map(function (r) {
      return '<div class="jh-row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>';
    }).join('');
  }

  function view(r) {
    var h = [];
    var label = r.status === 'ok' ? 'Nüvə təmizdir' : r.status === 'warn' ? 'Diqqət lazımdır' : 'Problem var';

    h.push('<div id="jhv2">');
    h.push('<div class="jh-head"><div class="jh-dot jh-' + r.status + '"></div>' +
           '<div><h2>Nüvə Sağlamlığı</h2><div class="jh-sub">' + esc(label) + ' · ' +
           new Date(r.at).toLocaleTimeString('az-AZ') + '</div></div></div>');

    // Problemlər
    h.push('<div class="jh-card"><h3>Tapılanlar</h3>');
    if (!r.problems.length) h.push('<div class="jh-prob">✅ <div>Hər şey qaydasındadır.</div></div>');
    else r.problems.forEach(function (p) {
      h.push('<div class="jh-prob">' + (p.level === 'bad' ? '🔴' : '🟡') +
             '<div><b>' + esc(p.part) + '</b> — ' + esc(p.text) + '</div></div>');
    });
    h.push('</div>');

    // Yaddaş
    if (r.adapter) {
      h.push('<div class="jh-card"><h3>Yerli yaddaş</h3>' + rows([
        ['Backend', r.adapter.backend + (r.adapter.fallback ? ' ⚠️ müvəqqəti' : '')],
        ['Tutulan həcm', mb(r.adapter.bytes)],
        ['Açar sayı', r.adapter.keyCount],
        ['Oxu / yazma', r.adapter.stats.reads + ' / ' + r.adapter.stats.writes],
        ['Keş uğuru', r.adapter.stats.cacheHits],
        ['Xəta / kvota', r.adapter.stats.errors + ' / ' + r.adapter.stats.quotaHits],
        ['Gözləyən yazma', r.adapter.pendingWrites]
      ]));
      var pct = Math.min(100, ((r.adapter.bytes || 0) / (5 * 1048576)) * 100);
      h.push('<div class="jh-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>');
      h.push('<div class="jh-mini">5 MB-lıq localStorage limitinin ' + pct.toFixed(0) + '%-i</div>');
      h.push('</div>');
    }

    // Jurnal
    if (r.journal) {
      h.push('<div class="jh-card"><h3>Niyyət jurnalı</h3>' + rows([
        ['Qoşulub', r.journal.attached ? 'bəli' : 'XEYR'],
        ['Açıq əməliyyat', r.journal.openCount + (r.journal.staleCount ? ' (' + r.journal.staleCount + ' köhnə)' : '')],
        ['Tamamlanan', r.journal.stats.committed],
        ['Geri qaytarılan', r.journal.stats.rolledBack],
        ['Bərpa olunan', r.journal.stats.recovered],
        ['Jurnal ölçüsü', r.journal.kb + ' KB']
      ]) + '</div>');
    }

    // Körpü
    if (r.bridge) {
      h.push('<div class="jh-card"><h3>Köhnə kod körpüsü</h3>' + rows([
        ['Quraşdırılıb', r.bridge.installed ? 'bəli' : 'XEYR'],
        ['Tutulan yazma', r.bridge.stats.intercepted],
        ['Jurnala düşən', r.bridge.stats.journaled],
        ['Bloklanan', r.bridge.stats.blocked],
        ['Yer açma', r.bridge.stats.reclaims]
      ]));
      if (r.bridge.top && r.bridge.top.length) {
        h.push('<div class="jh-mini">Ən ağır açarlar:</div>');
        h.push(rows(r.bridge.top.slice(0, 6).map(function (t) { return [t.key, t.kb + ' KB']; })));
      }
      h.push('</div>');
    }

    // Cihaz yaddaşı
    if (r.idb) {
      h.push('<div class="jh-card"><h3>Cihaz yaddaşı (şəkillər)</h3>' + rows([
        ['İstifadə', mb(r.idb.usage)],
        ['Kvota', mb(r.idb.quota)],
        ['Faiz', r.idb.percent !== null ? r.idb.percent + '%' : '—'],
        ['Şəkil sayı', (r.idb.images === null || r.idb.images === undefined) ? '—' : r.idb.images]
      ]));
      if (r.idb.percent !== null) {
        h.push('<div class="jh-bar"><i style="width:' + r.idb.percent + '%"></i></div>');
      }
      h.push('</div>');
    }

    // Açılış + sinxron
    if (r.boot) {
      var ph = (r.boot.phases || []).map(function (p) {
        return [p.name, p.ms + ' ms' + (p.ok ? '' : ' ✗')];
      });
      h.push('<div class="jh-card"><h3>Açılış</h3>' + rows(
        [['Ümumi', r.boot.totalMs + ' ms'], ['Cəhd sayğacı', r.boot.attempts]].concat(ph)
      ) + '</div>');
    }
    h.push('<div class="jh-card"><h3>Sinxron</h3>' + rows([
      ['Son sinxron', ago(r.sync.lastSync)],
      ['Gözləyən', r.sync.pending === true ? 'var' : r.sync.pending === false ? 'yox' : '—']
    ]) + '</div>');

    // Alətlər
    h.push('<div class="jh-card"><h3>Təmir alətləri</h3><div class="jh-tools">' +
      '<div class="jh-btn" data-jh="recover">🔧 Bərpa et</div>' +
      '<div class="jh-btn" data-jh="reclaim">🧹 Yer aç</div>' +
      '<div class="jh-btn" data-jh="dropCache">♻️ Keşi at</div>' +
      '<div class="jh-btn" data-jh="clearJournal">🗑 Jurnalı təmizlə</div>' +
      '<div class="jh-btn wide jh-gold" data-jh="fullTest">🧪 Tam nüvə testi</div>' +
      '<div class="jh-btn wide" data-jh="copyReport">📋 Hesabatı kopyala</div>' +
      '<div class="jh-btn wide" data-jh="refresh">🔄 Yenidən yoxla</div>' +
      '</div></div>');

    h.push('<div class="jh-card"><h3>Mətn hesabatı</h3><pre id="jhv2-text">' +
           esc(Reporter.text(r)) + '</pre></div>');

    h.push('</div>');
    return h.join('');
  }

  function bind() {
    var root = document.getElementById('jhv2');
    if (!root || root.__bound) return;
    root.__bound = true;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-jh]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-jh');
      if (act === 'refresh') return Health.open();
      var fn = Actions[act];
      if (!fn) return;
      btn.style.opacity = '.5';
      Promise.resolve(fn()).then(function () {
        btn.style.opacity = '';
        if (act !== 'copyReport') setTimeout(function () { Health.open(); }, 350);
      }, function () { btn.style.opacity = ''; });
    });
  }

  /* ----------------------------------------------------------------------
     7. Modul API
     ---------------------------------------------------------------------- */
  var Health = {
    version: '1.0.0',
    check: check,
    last: function () { return lastResult; },
    report: function () { return check({ quiet: true }).then(Reporter.text); },
    actions: Actions,

    render: function () {
      injectCSS();
      // Sinxron render lazımdır — məlumat gələndə içi yenilənir
      check({ quiet: true }).then(function (r) {
        var host = document.getElementById('jhv2-host');
        if (host) { host.innerHTML = view(r); bind(); }
      });
      return '<div id="jhv2-host"><div id="jhv2">' +
             '<div class="jh-head"><div class="jh-dot jh-warn"></div><div><h2>Nüvə Sağlamlığı</h2>' +
             '<div class="jh-sub">yoxlanılır…</div></div></div></div></div>';
    },

    afterRender: function () { injectCSS(); bind(); },

    // Route işləməsə birbaşa açmaq üçün: JollyHealth.open()
    open: function () {
      injectCSS();
      var main = document.getElementById('main') || document.body;
      return check({ quiet: true }).then(function (r) {
        main.innerHTML = '<div id="jhv2-host">' + view(r) + '</div>';
        bind();
        return r;
      });
    }
  };

  global.JollyHealth = Health;

  /* ----------------------------------------------------------------------
     8. İcazə açarı + modul qeydiyyatı (STANDART QAYDA)
     ---------------------------------------------------------------------- */
  function registerPerm() {
    var P = global.PermissionEngine || global.JollyPermissions || global.POS || null;
    var meta = { key: PERM, name: 'Nüvə Sağlamlığı', group: 'Alətlər',
                 desc: 'Yaddaş, jurnal və açılış vəziyyətini görmək' };
    var tried = false;
    ['registerKey', 'register', 'addKey', 'defineKey', 'addPermission'].forEach(function (m) {
      if (tried || !P || typeof P[m] !== 'function') return;
      try { P[m](PERM, meta); tried = true; } catch (e) {
        try { P[m](meta); tried = true; } catch (e2) {}
      }
    });
    if (!tried) {
      try {
        if (Array.isArray(global.PERMISSION_KEYS)) { global.PERMISSION_KEYS.push(meta); tried = true; }
      } catch (e) {}
    }
    if (!tried) console.log('[Health v2] İcazə açarı avtomatik qeydə alınmadı — modul yalnız Admin-də görünəcək.');
    return tried;
  }

  function registerModule() {
    if (!global.ModuleRegistry || typeof global.ModuleRegistry.register !== 'function') return false;
    try {
      global.ModuleRegistry.register({
        id: 'health-core',
        name: 'Nüvə Sağlamlığı',
        icon: '🩺',
        route: ROUTE,
        group: 'Alətlər',
        perm: PERM,
        render: Health.render,
        afterRender: Health.afterRender
      });
      return true;
    } catch (e) { console.warn('[Health v2] modul qeydiyyatı alınmadı:', e); return false; }
  }

  function boot() {
    registerPerm();
    if (!registerModule()) {
      // ModuleRegistry hələ yüklənməyibsə — bir dəfə gözlə
      setTimeout(function () { registerPerm(); registerModule(); }, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})(window);
