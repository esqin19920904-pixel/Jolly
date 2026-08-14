/* ============================================================
   JOLLY Lazy Loader + Modul Təmizliyi  (v2.0 — 2026-08-02)
   ------------------------------------------------------------
   ƏVVƏL: bu fayl yalnız arxa plan yükləyicisi idi (LAZY siyahısı).
   İNDİ: eyni zamanda "hansı modul ümumiyyətlə mövcud olsun?"
   sualının cavab yeridir.

   NİYƏ BİR FAYLDA:
   - Bir modulu əsl mənada yox etməyin yeganə təmiz yolu onun
     faylını YÜKLƏMƏMƏKDİR. LAZY siyahısı elə buradadır.
   - Ayrı fayl yaratsaydıq index.html-ə yeni sətir lazım olardı.
     Bu fayl artıq index.html-dədir — başqa heç nəyə toxunmaq lazım deyil.

   İKİ SƏVİYYƏ:
   1) FAYL səviyyəsi — arxa planda yüklənən alət faylı bağlanır.
      Nəticə: skript yüklənmir, ModuleRegistry-də qeyd olunmur,
      Studio siyahısında YOXDUR, Alətlər menyusunda YOXDUR,
      açılış bir az yüngülləşir.
   2) QEYDİYYAT səviyyəsi — index.html-dən yüklənən modul Studio
      siyahısından və marşrutdan gizlədilir. Fayl yüklənir, görünmür.

   HEÇ NƏ SİLİNMİR. Bütün fayllar repoda qalır, hər şey geri qaytarılır:
   #/module-cleanup → "↩ Hamısını geri qaytar".
   Təcili hal üçün konsol: localStorage.removeItem('jolly_module_off')

   AD TOQQUŞMASI DÜZƏLİŞİ: repoda İKİ modul eyni adı daşıyırdı
   ("JOLLY Yoxlama" — jolly-selftest.js və jolly-share-inbox.js-dəki
   #/jolly-diag). Adlar burada, qeydiyyat səviyyəsində dəqiqləşdirilir —
   həmin faylların koduna TOXUNULMUR.
   ============================================================ */
(() => {
  'use strict';

  /* ---------- Arxa planda yüklənən fayllar ----------
     key   : fayl adı (versiyasız) — açar kimi işlənir
     src   : real yüklənmə ünvanı (keş üçün ?v= saxlanılır)
     label : ekranda görünən ad
     mod   : həmin faylın qeyd etdiyi modul adı (dərhal gizlətmək üçün)
     lock  : true → bağlanmasına icazə yoxdur (başqa ekran ondan asılıdır)
     junk  : true → "roadmap qalığı" təklif siyahısında
  */
  const LAZY = [
    { key: 'jolly-archive.js',          src: 'jolly-archive.js',               label: 'Arxiv',                 icon: '🗄️', mod: 'Arxiv' },
    { key: 'jolly-showcase.js',         src: 'jolly-showcase.js?v=2',          label: 'Rəqəmsal Sərgi',        icon: '🎬', mod: 'Rəqəmsal Sərgi',     junk: true },
    { key: 'jolly-ad-generator.js',     src: 'jolly-ad-generator.js?v=1',      label: 'Reklam Mətni',          icon: '📣', mod: 'Reklam Mətni',       junk: true },
    { key: 'jolly-holocard.js',         src: 'jolly-holocard.js?v=1',          label: 'Holoqrafik Kart',       icon: '🌈', mod: 'Holoqrafik Kart',    junk: true },
    { key: 'jolly-whatif.js',           src: 'jolly-whatif.js?v=1',            label: 'Nə Olardı?',            icon: '🔮', mod: 'Nə Olardı?',         junk: true },
    { key: 'roadmap.js',                src: 'roadmap.js',                     label: 'Gələcək Fikirlər',      icon: '🗺️', mod: 'Gələcək Fikirlər',   junk: true },
    { key: 'gamification.js',           src: 'gamification.js',                label: 'Nişanlar',              icon: '🏅', mod: 'Nişanlar',           junk: true },
    { key: 'voice-notes.js',            src: 'voice-notes.js',                 label: 'Səsli Qeydlər',         icon: '🎙️', mod: 'Səsli Qeydlər' },
    { key: 'jolly-drive.js',            src: 'jolly-drive.js',                 label: 'Google Drive backup',   icon: '☁️', lock: true },
    { key: 'ocr.js',                    src: 'ocr.js',                         label: 'OCR (mətn oxuma)',      icon: '🔤', lock: true },
    { key: 'visual-search.js',          src: 'visual-search.js',               label: 'Vision AI motoru',      icon: '👁️', lock: true },
    { key: 'jolly-live-lens.js',        src: 'jolly-live-lens.js',             label: 'Canlı Linza',           icon: '🔎' },
    { key: 'daily-summary.js',          src: 'daily-summary.js',               label: 'Gündəlik Xülasə',       icon: '📊', mod: 'Gündəlik Xülasə' },
    { key: 'color-search.js',           src: 'color-search.js',                label: 'Rəngə görə axtarış',    icon: '🎨', mod: 'Rəngə görə axtarış', junk: true },
    { key: 'compare.js',                src: 'compare.js',                     label: 'Müqayisə',              icon: '⚖️', mod: 'Müqayisə',           junk: true },
    { key: 'audit.js',                  src: 'audit.js',                       label: 'Sürətli Audit',         icon: '🔍', mod: 'Sürətli Audit' },
    { key: 'price-advisor.js',          src: 'price-advisor.js',               label: 'Qiymət Tövsiyəsi',      icon: '💰', mod: 'Qiymət Tövsiyəsi',   junk: true },
    { key: 'bg-remove.js',              src: 'bg-remove.js?v=2',               label: 'Şəkil Təmizləyici',     icon: '🧹', mod: 'Şəkil Təmizləyici' },
    { key: 'jolly-announce.js',         src: 'jolly-announce.js?v=2',          label: 'Elan yayımı',           icon: '📢', lock: true },
    { key: 'dead-zone.js',              src: 'dead-zone.js',                   label: 'Unudulmuş Mallar',      icon: '🕸️', mod: 'Unudulmuş Mallar' },
    { key: 'jolly-telegram.js',         src: 'jolly-telegram.js',              label: 'Telegram Bildirişləri', icon: '📨', mod: 'Telegram Bildirişləri' },
    { key: 'jolly-diagnostics.js',      src: 'jolly-diagnostics.js?v=2',       label: 'Developer Diaqnostika', icon: '🩺', lock: true },
    { key: 'jolly-diag-report.js',      src: 'jolly-diag-report.js?v=2',       label: 'Xəta Hesabatı',         icon: '📋', lock: true },
    { key: 'jolly-github.js',           src: 'jolly-github.js',                label: 'GitHub göndərişi',      icon: '🐙', lock: true },
    { key: 'jolly-studios-carousel.js', src: 'jolly-studios-carousel.js?v=11', label: 'Studio karuseli',       icon: '🎠', lock: true },

    /* ── 08-13 GERİ QAYTARILDI ──────────────────────────────
       08-03 təmizliyində index.html-dən çıxarılmışdı. İndi
       buradan ARXA PLANDA yüklənirlər: modullar geri qayıdır,
       amma açılış ağırlaşmır (index.html-ə sətir əlavə olunmur).
       Bağlamaq istəsən: #/module-cleanup ekranından. */
    { key: 'filter-studio.js',       src: 'filter-studio.js',       label: 'Filtrləmə',          icon: '🔎', mod: 'Filtrləmə' },
    { key: 'jolly-import.js',        src: 'jolly-import.js',        label: 'Barkod İdxalı',      icon: '📥', mod: 'Barkod İdxalı' },
    { key: 'jolly-fix-mode.js',      src: 'jolly-fix-mode.js',      label: 'Bu gün 10 mal',      icon: '⚡', mod: 'Bu gün 10 mal' },
    { key: 'jolly-photo-session.js', src: 'jolly-photo-session.js', label: 'Foto Seansı',        icon: '📸', mod: 'Foto Seansı' },
    { key: 'jolly-scan-marathon.js', src: 'jolly-scan-marathon.js', label: 'Skan Maratonu',      icon: '🏃', mod: 'Skan Maratonu' },
    { key: 'jolly-tasks.js',         src: 'jolly-tasks.js',         label: 'Tapşırıqlar',        icon: '✅', mod: 'Tapşırıqlar' },
    { key: 'jolly-sheet-bridge.js',  src: 'jolly-sheet-bridge.js',  label: 'Cədvəl Körpüsü',     icon: '📗', mod: 'Cədvəl Körpüsü' },
    { key: 'jolly-health-report.js', src: 'jolly-health-report.js', label: 'Data Hesabatı',      icon: '📊', mod: 'Data Hesabatı (7 gün)' },
    { key: 'jolly-barcode-log.js',   src: 'jolly-barcode-log.js',   label: 'Barkod Jurnalı',     icon: '📒', mod: 'Barkod Jurnalı' },
  ];

  /* ---------- Qeydiyyat səviyyəsində ad dəqiqləşdirmələri ---------- */
  const RENAME = {
    'selftest':      'Modul Testi (ümumi)',
    'health-report': 'Data Hesabatı (7 gün)',
    'jolly-diag':    'Barkod Yoxlaması (Vision)',
  };

  const OFF_KEY = 'jolly_module_off';

  function loadOff() {
    try {
      const v = JSON.parse(localStorage.getItem(OFF_KEY) || '{}');
      return { files: Array.isArray(v.files) ? v.files : [], mods: Array.isArray(v.mods) ? v.mods : [] };
    } catch (e) { return { files: [], mods: [] }; }
  }
  function saveOff(o) {
    try { localStorage.setItem(OFF_KEY, JSON.stringify({ files: o.files, mods: o.mods })); } catch (e) {}
  }
  let OFF = loadOff();

  function fileOff(key) { return OFF.files.indexOf(key) >= 0; }
  function modOff(m) {
    if (!m) return false;
    return OFF.mods.indexOf(m.id) >= 0 || OFF.mods.indexOf(m.name) >= 0;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================
     1) YÜKLƏYİCİ — bağlı fayllar siyahıdan çıxarılır
     ============================================================ */
  const QUEUE = LAZY.filter(x => x.lock || !fileOff(x.key)).map(x => x.src);
  const SKIPPED = LAZY.filter(x => !x.lock && fileOff(x.key)).length;

  let started = false;
  let i = 0;

  function inject(src, onDone) {
    const el = document.createElement('script');
    el.src = src;
    el.async = false;          // icra sırası qorunsun
    el.onload = () => { if (onDone) onDone(); };
    el.onerror = () => { console.warn('[JOLLY] Lazy yüklənmədi:', src); if (onDone) onDone(); };
    document.head.appendChild(el);
  }

  function loadNext() {
    if (i >= QUEUE.length) {
      try { document.dispatchEvent(new CustomEvent('jolly:lazy-done')); } catch (e) {}
      console.log('[JOLLY] Arxa plan modulları yükləndi:', QUEUE.length, SKIPPED ? ('· bağlı: ' + SKIPPED) : '');
      return;
    }
    inject(QUEUE[i++], schedule);
  }

  function schedule() {
    if (window.requestIdleCallback) requestIdleCallback(() => loadNext(), { timeout: 800 });
    else setTimeout(loadNext, 30);
  }

  function start() {
    if (started) return;
    started = true;
    setTimeout(loadNext, 600);   // ilk ekran çəkilsin, sonra başla
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);

  window.JollyLazy = {
    flush() {
      started = true;
      let waiting = 0;
      const done = () => {
        waiting--;
        if (waiting <= 0) {
          try { document.dispatchEvent(new CustomEvent('jolly:lazy-done')); } catch (e) {}
        }
      };
      while (i < QUEUE.length) { waiting++; inject(QUEUE[i++], done); }
      if (!waiting) {
        try { document.dispatchEvent(new CustomEvent('jolly:lazy-done')); } catch (e) {}
      }
    },
    pending() { return Math.max(0, QUEUE.length - i); },
    skipped() { return SKIPPED; }
  };

  /* ============================================================
     2) REGISTRY SARĞISI — gizlətmə + ad düzəlişi
     ModuleRegistry `const`-dur, window-a yapışmaya bilər —
     dashboard.js-dəki üsulun eynisi ilə oxuyuruq.
     ============================================================ */
  function MR() {
    if (window.ModuleRegistry) return window.ModuleRegistry;
    try { return (new Function('try{return ModuleRegistry}catch(e){return null}'))(); }
    catch (e) { return null; }
  }

  function applyRenames(reg) {
    if (!reg || typeof reg._all !== 'function') return;
    let all;
    try { all = reg._all(); } catch (e) { return; }
    Object.keys(RENAME).forEach(id => {
      if (all[id] && all[id].name !== RENAME[id]) all[id].name = RENAME[id];
    });
  }

  let wrapped = false;
  function wrapRegistry() {
    const reg = MR();
    if (!reg) return false;
    if (wrapped) return true;
    if (typeof reg.list !== 'function' || typeof reg.renderPage !== 'function') return false;
    wrapped = true;

    const _list = reg.list.bind(reg);
    reg.list = function (opts) {
      applyRenames(reg);
      return _list(opts).filter(m => !modOff(m));
    };

    const _renderPage = reg.renderPage.bind(reg);
    reg.renderPage = function (hash) {
      hash = hash || window.location.hash || '';
      try {
        const all = reg._all();
        for (const id in all) {
          const m = all[id];
          if (!m || !m.route || !modOff(m)) continue;
          if (hash === m.route || hash.indexOf(m.route + '/') === 0) {
            return {
              html: '<div class="empty-state"><div class="big-icon">🧹</div>' +
                    '<h3>Bu ekran gizlədilib</h3>' +
                    '<p class="muted" style="font-size:12.5px;">' + esc(m.name) +
                    ' — Modul Təmizliyində bağlanıb.</p>' +
                    '<button class="btn btn-primary" style="margin-top:14px;" ' +
                    'onclick="JollyRouter.go(\'#/module-cleanup\')">🧹 Modul Təmizliyi</button></div>',
              module: m, after: null
            };
          }
        }
      } catch (e) {}
      return _renderPage(hash);
    };

    applyRenames(reg);
    return true;
  }

  /* ============================================================
     3) TƏMİZLİK EKRANI — #/module-cleanup
     ============================================================ */
  function regModules() {
    const reg = MR();
    if (!reg || typeof reg._all !== 'function') return [];
    let all;
    try { all = reg._all(); } catch (e) { return []; }
    return Object.keys(all).map(k => all[k]).filter(Boolean);
  }

  function lazyModNames() {
    const s = {};
    LAZY.forEach(x => { if (x.mod) s[x.mod] = true; });
    return s;
  }

  function render() {
    const fromLazy = lazyModNames();
    const mods = regModules().filter(m => !fromLazy[m.name]);
    const junkOn = LAZY.filter(x => x.junk && !fileOff(x.key)).length;
    const visible = mods.filter(m => !modOff(m)).length;
    const hiddenTotal = OFF.files.length + OFF.mods.length;

    const sw = (on, fn) =>
      '<input type="checkbox" ' + (on ? 'checked' : '') +
      ' onclick="event.stopPropagation();" onchange="' + fn + '">';

    const row = (icon, title, sub, right, dim) =>
      '<div class="jmc-row" data-q="' + esc((title + ' ' + (sub || '')).toLowerCase()) + '" ' +
      'style="display:flex;align-items:center;gap:10px;padding:10px 0;' +
      'border-bottom:1px solid rgba(255,255,255,.05);' + (dim ? 'opacity:.45;' : '') + '">' +
        '<span style="font-size:17px;width:22px;text-align:center;">' + icon + '</span>' +
        '<span style="flex:1;min-width:0;">' +
          '<span style="font-size:13px;font-weight:600;display:block;">' + esc(title) + '</span>' +
          '<span class="muted" style="font-size:10.5px;">' + esc(sub || '') + '</span>' +
        '</span>' + right +
      '</div>';

    let h = '';
    h += '<h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🧹 Modul Təmizliyi</h2>';
    h += '<p class="muted" style="font-size:12px;margin:0 0 12px;">' +
         'Heç nə silinmir — bağlanan modul sadəcə yüklənmir və görünmür. İstədiyin an geri açırsan.</p>';

    h += '<div class="glass" style="padding:12px 14px;margin-bottom:12px;">' +
         '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;">' +
         '<span>👁️ Görünən ekran: <b>' + visible + '</b></span>' +
         '<span>🚫 Bağlı: <b>' + hiddenTotal + '</b></span>' +
         '<span>📦 Yüklənməyən fayl: <b>' + OFF.files.length + '</b></span>' +
         '</div></div>';

    h += '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px;">';
    if (junkOn) {
      h += '<button class="btn btn-primary" onclick="JollyModClean.applySuggested()">' +
           '🔴 Təklif olunan ' + junkOn + '-ni bağla</button>';
    }
    h += '<button class="btn" onclick="JollyModClean.resetAll()">↩ Hamısını geri qaytar</button>';
    h += '<button class="btn" onclick="location.reload()">🔄 Yenilə</button>';
    h += '</div>';

    h += '<input id="jmcSearch" type="search" placeholder="Axtar..." ' +
         'oninput="JollyModClean.filter(this.value)" ' +
         'style="width:100%;padding:10px 12px;margin-bottom:14px;border-radius:12px;' +
         'border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);' +
         'color:inherit;font-size:13px;">';

    h += '<div class="section-title">📦 Arxa planda yüklənən alətlər</div>';
    h += '<p class="muted" style="font-size:11px;margin:0 0 6px;">' +
         'Bağlasan fayl ümumiyyətlə yüklənmir: nə Studio siyahısında, nə Alətlər menyusunda qalır. ' +
         'Tam nəticə səhifə yeniləndikdən sonra görünür.</p>';
    h += '<div class="glass" style="padding:4px 14px;margin-bottom:16px;">';
    LAZY.forEach(x => {
      const isOff = fileOff(x.key);
      const right = x.lock
        ? '<span class="muted" style="font-size:10.5px;">🔒 lazımdır</span>'
        : sw(!isOff, "JollyModClean.toggleFile('" + x.key + "', this.checked)");
      const sub = x.lock ? 'başqa ekranlar bundan asılıdır'
                         : (x.junk ? 'roadmap qalığı · təklif: bağla' : x.key);
      h += row(x.icon, x.label, sub, right, isOff);
    });
    h += '</div>';

    h += '<div class="section-title">🧩 Açılışda yüklənən ekranlar (' + mods.length + ')</div>';
    h += '<p class="muted" style="font-size:11px;margin:0 0 6px;">' +
         'Bunlar index.html-dən gəlir — faylları yüklənməyə davam edir, sadəcə Studio siyahısından ' +
         'və marşrutdan gizlədilir.</p>';
    h += '<div class="glass" style="padding:4px 14px;margin-bottom:20px;">';
    mods.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'az')).forEach(m => {
      const isOff = modOff(m);
      const right = (m.id === 'module-cleanup')
        ? '<span class="muted" style="font-size:10.5px;">🔒</span>'
        : sw(!isOff, "JollyModClean.toggleMod('" + String(m.id).replace(/'/g, "\\'") + "', this.checked)");
      h += row(m.icon || '📦', m.name, m.route, right, isOff);
    });
    h += '</div>';

    h += '<p class="muted" style="font-size:11px;margin-bottom:24px;">' +
         'Təcili hal: brauzer konsolunda <code>localStorage.removeItem(\'jolly_module_off\')</code> ' +
         'yazıb səhifəni yenilə — hər şey qayıdır.</p>';

    return h;
  }

  function repaint() {
    const main = document.getElementById('main');
    if (main) { main.innerHTML = render(); window.scrollTo(0, 0); }
  }

  window.JollyModClean = {
    render,
    filter(q) {
      q = String(q || '').toLowerCase().trim();
      const rows = document.querySelectorAll('.jmc-row');
      for (let k = 0; k < rows.length; k++) {
        const el = rows[k];
        el.style.display = (!q || (el.getAttribute('data-q') || '').indexOf(q) >= 0) ? '' : 'none';
      }
    },
    toggleFile(key, on) {
      const item = LAZY.filter(x => x.key === key)[0];
      if (!item || item.lock) return;
      OFF.files = OFF.files.filter(k => k !== key);
      if (item.mod) OFF.mods = OFF.mods.filter(k => k !== item.mod);
      if (!on) {
        OFF.files.push(key);
        if (item.mod) OFF.mods.push(item.mod);   // yenilənməni gözləmədən dərhal gizlət
      }
      saveOff(OFF);
      if (typeof Toast !== 'undefined') Toast.success(item.label + (on ? ' açıldı' : ' bağlandı'));
      repaint();
    },
    toggleMod(id, on) {
      OFF.mods = OFF.mods.filter(k => k !== id);
      if (!on) OFF.mods.push(id);
      saveOff(OFF);
      if (typeof Toast !== 'undefined') Toast.success(on ? 'Açıldı' : 'Gizlədildi');
      repaint();
    },
    applySuggested() {
      LAZY.forEach(x => {
        if (!x.junk || x.lock) return;
        if (OFF.files.indexOf(x.key) < 0) OFF.files.push(x.key);
        if (x.mod && OFF.mods.indexOf(x.mod) < 0) OFF.mods.push(x.mod);
      });
      saveOff(OFF);
      if (typeof Toast !== 'undefined') Toast.success('Təklif olunanlar bağlandı');
      repaint();
    },
    resetAll() {
      OFF = { files: [], mods: [] };
      saveOff(OFF);
      if (typeof Toast !== 'undefined') Toast.success('Hamısı geri qaytarıldı');
      repaint();
    },
    status() { return { off: OFF, skippedFiles: SKIPPED, queued: QUEUE.length, renamed: RENAME }; }
  };

  /* ---------- İcazə açarı + modul qeydiyyatı ---------- */
  let screenDone = false;
  function registerScreen() {
    if (screenDone) return;
    const reg = MR();
    if (!reg || typeof reg.register !== 'function') return;
    screenDone = true;

    (function regPerm(n) {
      try {
        if (typeof POS !== 'undefined' && POS && typeof POS.register === 'function') {
          POS.register({
            id: 'modclean', name: 'Modul Təmizliyi', icon: '🧹',
            permissions: [
              { key: 'modules.cleanup.manage', label: 'Modulları gizlət / geri qaytar', tag: 'admin', default: false }
            ]
          });
          return;
        }
      } catch (e) {}
      if (n < 40) setTimeout(() => regPerm(n + 1), 200);
    })(0);

    reg.register({
      id: 'module-cleanup',
      name: 'Modul Təmizliyi',
      icon: '🧹',
      route: '#/module-cleanup',
      group: 'JOLLY',
      perm: 'modules.cleanup.manage',
      enabled: true,
      render() { return render(); }
    });
  }

  /* Registry gec gələ bilər — bir neçə dəfə cəhd edirik. */
  (function tryWrap(n) {
    if (wrapRegistry()) { registerScreen(); return; }
    if (n > 40) return;
    setTimeout(() => tryWrap(n + 1), 150);
  })(0);
})();
