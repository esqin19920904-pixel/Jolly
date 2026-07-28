/* ============================================================
   JOLLY Yoxlama — özünü yoxlama ekranı
   Son günlərdə çox yeni modul əlavə olundu. Nəyin həqiqətən
   yükləndiyini bilmək üçün hər dəfə mənə yazmaq lazım gəlirdi.
   Bu ekran onu bir baxışda göstərir: yaşıl = işləyir,
   qırmızı = yüklənməyib və nə etmək lazımdır.

   Marşrut: #/selftest  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollySelfTest = (() => {

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* DİQQƏT: JOLLY modulları `const JollyXxx = ...` kimi elan olunur.
     Belə elanlar window-un üzərinə DÜŞMÜR, ona görə window['JollyXxx']
     həmişə undefined qaytarır. Aşağıdakı xəritə hər dəfə render
     zamanı birbaşa identifikatorla qurulur — CSP-yə də toxunmur. */
  function _refs() {
    const R = {};
    const put = (k, v) => { R[k] = v; };
    try { put('JollyBarcodeFolder', typeof JollyBarcodeFolder !== 'undefined' ? JollyBarcodeFolder : undefined); } catch (e) {}
    try { put('JollyFixMode', typeof JollyFixMode !== 'undefined' ? JollyFixMode : undefined); } catch (e) {}
    try { put('JollyHealthReport', typeof JollyHealthReport !== 'undefined' ? JollyHealthReport : undefined); } catch (e) {}
    try { put('JollyImport', typeof JollyImport !== 'undefined' ? JollyImport : undefined); } catch (e) {}
    try { put('JollySheetBridge', typeof JollySheetBridge !== 'undefined' ? JollySheetBridge : undefined); } catch (e) {}
    try { put('JollyBarcodeLog', typeof JollyBarcodeLog !== 'undefined' ? JollyBarcodeLog : undefined); } catch (e) {}
    try { put('JollyScanMarathon', typeof JollyScanMarathon !== 'undefined' ? JollyScanMarathon : undefined); } catch (e) {}
    try { put('JollyStoreMap', typeof JollyStoreMap !== 'undefined' ? JollyStoreMap : undefined); } catch (e) {}
    try { put('JollyDB', typeof JollyDB !== 'undefined' ? JollyDB : undefined); } catch (e) {}
    try { put('JollyProducts', typeof JollyProducts !== 'undefined' ? JollyProducts : undefined); } catch (e) {}
    try { put('JollyStorage', typeof JollyStorage !== 'undefined' ? JollyStorage : undefined); } catch (e) {}
    try { put('JollyAdminStudio', typeof JollyAdminStudio !== 'undefined' ? JollyAdminStudio : undefined); } catch (e) {}
    try { put('JollyDataDoctor', typeof JollyDataDoctor !== 'undefined' ? JollyDataDoctor : undefined); } catch (e) {}
    try { put('JollyLazy', typeof JollyLazy !== 'undefined' ? JollyLazy : (window.JollyLazy || undefined)); } catch (e) {}
    try { put('JollyLabels', typeof JollyLabels !== 'undefined' ? JollyLabels : undefined); } catch (e) {}
    try { put('JollySwipeMenu', typeof JollySwipeMenu !== 'undefined' ? JollySwipeMenu : undefined); } catch (e) {}
    return R;
  }

  let _R = {};
  const _g = (name) => _R[name];

  /* Modul qlobalı var? */
  function modCheck(global, label, file) {
    const ok = typeof _g(global) !== 'undefined';
    return { ok, label, fix: ok ? '' : `index.html-də <b>${file}</b> sətri yoxdur, ya da fayl repoda yoxdur` };
  }

  /* Obyektin içində funksiya var? */
  function fnCheck(objName, fnName, label, file) {
    const obj = _g(objName);
    if (!obj) return { ok: false, label, fix: `${objName} ümumiyyətlə yüklənməyib (${file})` };
    const ok = typeof obj[fnName] === 'function';
    return { ok, label, fix: ok ? '' : `<b>${file}</b> köhnə versiyadır — yenidən yüklə` };
  }

  function routeCheck(id, label) {
    if (typeof ModuleRegistry === 'undefined') return { ok: false, label, fix: 'module-registry.js yüklənməyib' };
    const list = (ModuleRegistry.list && ModuleRegistry.list()) || [];
    const ok = list.some(m => m && m.id === id);
    return { ok, label, fix: ok ? '' : `Modul qeydiyyatdan keçməyib — faylı yenidən yüklə` };
  }

  function buildGroups() {
    _R = _refs();
    return [
      {
        title: '📦 Yeni ekranlar',
        items: [
          modCheck('JollyBarcodeFolder', 'Barkod Qovluğu', 'jolly-barcode-folder.js'),
          modCheck('JollyFixMode', 'Bu gün 10 mal', 'jolly-fix-mode.js'),
          modCheck('JollyHealthReport', 'Sağlamlıq Hesabatı', 'jolly-health-report.js'),
          modCheck('JollyImport', 'Barkod İdxalı', 'jolly-import.js'),
          modCheck('JollySheetBridge', 'Cədvəl Körpüsü', 'jolly-sheet-bridge.js'),
          modCheck('JollyBarcodeLog', 'Barkod Jurnalı', 'jolly-barcode-log.js'),
          modCheck('JollyScanMarathon', 'Skan Maratonu', 'jolly-scan-marathon.js'),
          modCheck('JollyStoreMap', 'Mağaza Xəritəsi', 'jolly-store-map.js'),
        ]
      },
      {
        title: '🔗 Marşrutlar (Studios-da görünür?)',
        items: [
          routeCheck('fixmode', '#/fixmode'),
          routeCheck('health-report', '#/health-report'),
          routeCheck('import', '#/import'),
          routeCheck('sheet', '#/sheet'),
          routeCheck('barcode-log', '#/barcode-log'),
          routeCheck('selftest', '#/selftest'),
        ]
      },
      {
        title: '🧩 db.js funksiyaları',
        items: [
          fnCheck('JollyDB', 'foldText', 'Hərf bərabərləşdirməsi (corab = Çorab)', 'db.js'),
          fnCheck('JollyDB', 'saveSettings', 'Ayarların saxlanması (PIN sıfırlama)', 'db.js'),
          fnCheck('JollyDB', 'getBarcodeLog', 'Barkod jurnalı', 'db.js'),
          fnCheck('JollyDB', 'getChangeLog', 'Dəyişiklik tarixçəsi', 'db.js'),
          fnCheck('JollyDB', 'markForDeletion', 'Silinmə üçün işarələmə', 'db.js'),
          (() => {
            const P = _g('JollyDB') && JollyDB.Products;
            const ok = !!(P && typeof P.checkBarcodeConflict === 'function');
            return { ok, label: 'Barkod münaqişə yoxlaması (məhsul saxlanması!)', fix: ok ? '' : '<b>db.js</b> köhnədir — bu olmadan barkodlu məhsul YADDA SAXLANMIR' };
          })(),
          (() => {
            const P = _g('JollyDB') && JollyDB.Products;
            const ok = !!(P && typeof P.markBarcodeVerified === 'function');
            return { ok, label: 'Barkod etibarlılıq nişanı (✓/✎)', fix: ok ? '' : '<b>db.js</b> köhnədir' };
          })(),
        ]
      },
      {
        title: '🛒 products.js funksiyaları',
        items: [
          fnCheck('JollyProducts', 'hl', 'Axtarışda qırmızı vurğulama', 'products.js'),
          fnCheck('JollyProducts', 'renderMatchSuggestChips', 'Axtarış təklifi zolağı', 'products.js'),
          fnCheck('JollyProducts', 'bulkEdit', 'Toplu dəyişiklik', 'products.js'),
          fnCheck('JollyProducts', 'showDeviceBridge', 'Kompüter ↔ telefon körpüsü', 'products.js'),
          fnCheck('JollyProducts', 'suggestGroupFromName', 'Ağıllı qrup təklifi', 'products.js'),
          fnCheck('JollyProducts', 'renderMarkedForDeletionPage', 'İşarəli məhsullar ekranı', 'products.js'),
        ]
      },
      {
        title: '🗂️ Digər',
        items: [
          fnCheck('JollyStorage', 'ensureThumb', 'Kiçik şəkil (thumbnail)', 'storage.js'),
          fnCheck('JollyAdminStudio', 'editGroupTemplate', 'Qrup şablonu (📋)', 'admin-studio.js'),
          fnCheck('JollyDataDoctor', 'mergePair', 'Doktorda birləşdirmə', 'data-doctor.js'),
          modCheck('JollyLazy', 'Lazy yükləyici (açılış sürəti)', 'jolly-lazy-loader.js'),
          (() => {
            const ok = typeof _g('JollyLabels') === 'undefined';
            return { ok, label: 'Etiket modulu silinib (çap yoxdur)', fix: ok ? '' : '<b>jolly-labels.js</b> hələ repodadır — sil' };
          })(),
          (() => {
            const ok = typeof _g('JollySwipeMenu') === 'undefined';
            return { ok, label: 'Sürüşdürmə menyusu silinib', fix: ok ? '' : '<b>samsung-swipe-menu.js</b> hələ yüklənir — sil' };
          })(),
        ]
      }
    ];
  }

  function render() {
    const groups = buildGroups();
    let total = 0, bad = 0;
    groups.forEach(g => g.items.forEach(i => { total++; if (!i.ok) bad++; }));

    const sw = ('serviceWorker' in navigator) ? 'var' : 'yoxdur';
    const pending = (typeof JollyLazy !== 'undefined' && JollyLazy.pending) ? JollyLazy.pending() : '—';

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🩻 JOLLY Yoxlama</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Hansı fayl həqiqətən yüklənib? Qırmızı sətir varsa, altında nə etmək lazım olduğu yazılıb.</p>

      <div class="glass" style="padding:16px;margin-bottom:14px;text-align:center;">
        <div style="font-size:34px;font-weight:800;line-height:1;color:${bad ? (bad > 3 ? '#ff5c6c' : '#ffc86b') : '#4ade80'};">
          ${total - bad}/${total}
        </div>
        <div class="muted" style="font-size:12px;margin-top:4px;">
          ${bad ? `${bad} problem tapıldı` : 'Hər şey yerindədir ✨'}
        </div>
      </div>

      ${groups.map(g => `
        <div class="section-title">${g.title}</div>
        <div class="glass" style="padding:4px 14px;margin-bottom:12px;">
          ${g.items.map(i => `
            <div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);">
              <div style="display:flex;align-items:center;gap:9px;">
                <span style="font-size:14px;">${i.ok ? '✅' : '❌'}</span>
                <span style="flex:1;font-size:12.5px;${i.ok ? '' : 'font-weight:600;'}">${esc(i.label)}</span>
              </div>
              ${!i.ok && i.fix ? `<div class="muted" style="font-size:11px;margin-top:3px;margin-left:23px;">${i.fix}</div>` : ''}
            </div>`).join('')}
        </div>`).join('')}

      <div class="section-title">ℹ️ Mühit</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:12px;">
        <div class="list-row"><span style="font-size:12.5px;">Servis işçisi</span><span class="mono" style="font-size:12px;">${sw}</span></div>
        <div class="list-row"><span style="font-size:12.5px;">Onlayn</span><span class="mono" style="font-size:12px;">${navigator.onLine ? 'bəli' : 'xeyr'}</span></div>
        <div class="list-row"><span style="font-size:12.5px;">Arxa planda yüklənməmiş modul</span><span class="mono" style="font-size:12px;">${pending}</span></div>
        <div class="list-row"><span style="font-size:12.5px;">Məhsul sayı</span><span class="mono" style="font-size:12px;">${typeof JollyDB !== 'undefined' ? JollyDB.Products.all().length : '—'}</span></div>
      </div>

      ${_storageHtml()}

      ${_errorsHtml()}

      <button class="btn btn-primary btn-block" onclick="JollySelfTest.copyReport()">📋 Vəziyyət hesabatını kopyala</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="JollySelfTest.refresh()">🔄 Yenidən yoxla</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;border-color:rgba(255,92,108,.45);color:#ff5c6c;" onclick="JollySelfTest.hardRefresh()">🧹 Tam yenilə (keşi sil)</button>
      <p class="muted" style="font-size:11px;margin-top:10px;">Qırmızı sətir varsa, orada adı çəkilən faylı GitHub-da silib yenidən yüklə, sonra tətbiqi tam bağlayıb aç.</p>
    `;
  }

  /* ── YADDAŞ ─────────────────────────────────────────────────
     localStorage ~5 MB-dır. Arxiv snapshot-ları və jurnallar onu
     doldura bilir — dolanda buluda yazma da, arxiv də dayanır.
     Burada nəyin nə qədər yer tutduğu görünür və təmizlənir. */
  function _storageStats() {
    const rows = [];
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || '';
        const bytes = k.length + v.length;
        total += bytes;
        rows.push({ key: k, bytes });
      }
    } catch (e) {}
    rows.sort((a, b) => b.bytes - a.bytes);
    return { rows, total };
  }

  function _kb(n) { return (n / 1024).toFixed(n > 102400 ? 0 : 1) + ' KB'; }

  function _storageHtml() {
    const st = _storageStats();
    const limit = 5 * 1024 * 1024;            // təxmini
    const pct = Math.min(100, Math.round(st.total / limit * 100));
    const snaps = st.rows.filter(r => r.key.indexOf('jolly_archive_snap_') === 0);
    const snapBytes = snaps.reduce((n, r) => n + r.bytes, 0);
    const col = pct > 85 ? '#ff5c6c' : pct > 60 ? '#ffc86b' : '#4ade80';

    return `
      <div class="section-title">💾 Yaddaş</div>
      <div class="glass" style="padding:14px;margin-bottom:12px;">
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span style="font-size:24px;font-weight:800;color:${col};">${pct}%</span>
          <span class="muted" style="font-size:12px;flex:1;">${_kb(st.total)} istifadə olunub (təxmini limit 5 MB)</span>
        </div>
        <div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;margin:10px 0;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${col};"></div>
        </div>
        ${pct > 85 ? `<div style="font-size:12px;color:#ff5c6c;margin-bottom:8px;">Yaddaş dolmaq üzrədir — buluda yazma və arxiv dayana bilər.</div>` : ''}
        <div style="font-size:11.5px;">
          ${st.rows.slice(0, 6).map(r => `
            <div style="display:flex;justify-content:space-between;padding:3px 0;">
              <span class="muted mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:66%;">${esc(r.key)}</span>
              <span class="mono">${_kb(r.bytes)}</span>
            </div>`).join('')}
        </div>
        ${snaps.length ? `
          <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;" onclick="JollySelfTest.clearSnapshots()">
            🗄️ ${snaps.length} arxiv nüsxəsini sil (${_kb(snapBytes)})
          </button>` : ''}
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;" onclick="JollySelfTest.clearLogs()">
          📜 Jurnalları təmizlə (xəta, barkod, dəyişiklik)
        </button>
      </div>`;
  }

  function clearSnapshots() {
    if (!confirm('Arxiv nüsxələri silinsin?\n\nƏsl məhsullara TOXUNULMUR — bunlar yalnız gündəlik ehtiyat surətləridir.')) return;
    let n = 0;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('jolly_archive_snap_') === 0) keys.push(k);
      }
      keys.forEach(k => { localStorage.removeItem(k); n++; });
      localStorage.removeItem('jolly_archive_index');
    } catch (e) {}
    if (typeof Toast !== 'undefined') Toast.success(n + ' arxiv silindi');
    refresh();
  }

  function clearLogs() {
    if (!confirm('Xəta, barkod və dəyişiklik jurnalları silinsin?\n\nMəhsullara TOXUNULMUR.')) return;
    ['jolly_error_log', 'jolly_barcode_log', 'jolly_change_log'].forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    if (typeof Toast !== 'undefined') Toast.success('Jurnallar təmizləndi');
    refresh();
  }

  /* ── XƏTALAR ────────────────────────────────────────────────
     jolly-blackbox.js hər xətanı localStorage-a yazır, ona görə
     ağ ekrandan sonra yenidən açanda da burada görünür. */
  function _errors() {
    try { return (window.JollyErrors && JollyErrors.list()) || []; } catch (e) { return []; }
  }

  function _fmtTime(ts) {
    try { return new Date(ts).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }

  function _errorsHtml() {
    const list = _errors();
    if (typeof window.JollyErrors === 'undefined') {
      return `
        <div class="section-title">🐞 Xətalar</div>
        <div class="glass" style="padding:12px;margin-bottom:12px;font-size:12.5px;">
          <b>jolly-blackbox.js</b> köhnə versiyadır — xətalar yadda saxlanmır. Faylı yenidən yüklə.
        </div>`;
    }
    if (!list.length) {
      return `
        <div class="section-title">🐞 Xətalar</div>
        <div class="glass" style="padding:12px;margin-bottom:12px;font-size:12.5px;color:#4ade80;">
          ✅ Qeydə alınmış xəta yoxdur
        </div>`;
    }
    return `
      <div class="section-title">🐞 Xətalar <span class="muted">(${list.length})</span></div>
      <div class="glass" style="padding:4px 14px;margin-bottom:8px;">
        ${list.slice(0, 10).map(e => `
          <div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <div style="font-size:12.5px;color:#ff5c6c;font-weight:600;">${esc(e.msg)}</div>
            <div class="muted mono" style="font-size:10.5px;margin-top:3px;">
              ${esc(e.file || '?')}${e.line ? ':' + e.line : ''} · ${esc(e.route || '')} · ${_fmtTime(e.at)}
            </div>
          </div>`).join('')}
        ${list.length > 10 ? `<div class="muted" style="padding:8px 0;font-size:11px;">+${list.length - 10} xəta daha</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:12px;" onclick="JollySelfTest.clearErrors()">🗑️ Xəta jurnalını təmizlə</button>`;
  }

  function clearErrors() {
    if (window.JollyErrors) JollyErrors.clear();
    if (typeof Toast !== 'undefined') Toast.success('Təmizləndi');
    refresh();
  }

  /* ── HESABATI KOPYALA ───────────────────────────────────────
     Ekran şəkli əvəzinə hazır mətn — birbaşa göndərilə bilir. */
  function _reportText() {
    const groups = buildGroups();
    const lines = [];
    lines.push('=== JOLLY VƏZİYYƏT HESABATI ===');
    lines.push('Tarix: ' + new Date().toLocaleString('az-AZ'));
    lines.push('Onlayn: ' + (navigator.onLine ? 'bəli' : 'xeyr'));
    try { lines.push('Məhsul sayı: ' + JollyDB.Products.all().length); } catch (e) {}
    try {
      if (typeof JollyLazy !== 'undefined' && JollyLazy.pending) lines.push('Yüklənməmiş arxa plan modulu: ' + JollyLazy.pending());
    } catch (e) {}
    try {
      const st = _storageStats();
      lines.push('Yaddaş: ' + _kb(st.total) + ' / ~5 MB');
    } catch (e) {}
    lines.push('');

    let bad = 0;
    groups.forEach(g => {
      const fails = g.items.filter(i => !i.ok);
      if (!fails.length) return;
      bad += fails.length;
      lines.push('--- ' + g.title + ' ---');
      fails.forEach(i => lines.push('  ❌ ' + i.label));
    });
    if (!bad) lines.push('✅ Bütün yoxlamalar keçdi');

    const errs = _errors();
    if (errs.length) {
      lines.push('');
      lines.push('--- SON XƏTALAR (' + errs.length + ') ---');
      errs.slice(0, 8).forEach(e => {
        lines.push('  • ' + e.msg + ' @ ' + (e.file || '?') + (e.line ? ':' + e.line : '') + ' [' + (e.route || '') + ']');
      });
    }
    return lines.join('\n');
  }

  function copyReport() {
    const text = _reportText();
    const done = () => { if (typeof Toast !== 'undefined') Toast.success('📋 Kopyalandı — mesaja yapışdır'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => _fallbackCopy(text, done));
    } else {
      _fallbackCopy(text, done);
    }
  }

  function _fallbackCopy(text, done) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-1000px;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    } catch (e) {
      alert(text);   // heç olmasa görsün və əl ilə kopyalasın
    }
  }

  /* ── TAM YENİLƏ ─────────────────────────────────────────────
     Problemlərin çoxu köhnə keşdəndir. Bu, servis işçisini
     söndürür, bütün keşi silir və səhifəni təzədən açır.
     MƏLUMATA TOXUNMUR — məhsullar, şəkillər, ayarlar qalır. */
  async function hardRefresh() {
    if (!confirm('Keş tamamilə silinəcək və tətbiq yenidən yüklənəcək.\n\nMəhsullara, şəkillərə və ayarlara TOXUNULMUR.\n\nDavam edim?')) return;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch (e) { console.warn('[SelfTest] sw:', e); }
    try {
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { console.warn('[SelfTest] cache:', e); }
    location.reload(true);
  }

  function refresh() {
    const main = document.getElementById('main');
    if (main) { main.innerHTML = render(); window.scrollTo(0, 0); }
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'selftest',
      perm: 'tools.selftest',
      name: 'JOLLY Yoxlama',
      icon: '🩻',
      route: '#/selftest',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
    });
  }

  return { render, refresh, buildGroups, copyReport, hardRefresh, clearErrors, clearSnapshots, clearLogs };
})();
