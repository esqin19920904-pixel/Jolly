/* ============================================================
   JOLLY Əlavə İcazələr
   permission-engine.js böyük fayldır (36 KB) və hər yeni modul
   üçün onu bütöv yenidən yükləmək əziyyətdir. Bu kiçik fayl
   yeni modulların icazə açarlarını ayrıca qeydiyyatdan keçirir.

   POS.register() ictimai API-dir — nəticə eyni olur: açarlar
   İcazə Mərkəzində, öz bölmələrində görünür.

   YENİ MODUL ƏLAVƏ EDƏNDƏ: açarı buraya yaz, permission-engine.js-ə
   toxunma. Fayl index.html-də permission-engine.js-dən SONRA olmalıdır.
   ============================================================ */
(function () {

  /* ══════════════════════════════════════════════════════════
     TƏMİR: "Cannot read properties of undefined (reading '...')"
     @ permission-engine.js:83

     getOverride() belə yazılıb:  this.load().overrides[k]
     Əgər yaddaşdakı icazə obyektində `overrides` sahəsi yoxdursa
     (buluddan gələn birləşmə zamanı forma pozulanda belə olur),
     hər icazə yoxlanışı XƏTA verir. Xəta sinxron prosesini də
     yarımçıq dayandırır — ona görə iki cihaz bir-birinin
     məlumatını görmür.

     Aşağıdakı təmir iki şey edir:
       1) yaddaşdakı pozulmuş obyekti düzəldib geri yazır
       2) load()-u sarğılayır ki, bir daha pozula bilməsin
     ══════════════════════════════════════════════════════════ */
  function repairStore() {
    // Store obyekti POS.store-dadır (Engine və Profiles onu .s kimi saxlayır)
    const store = (typeof POS !== 'undefined')
      ? (POS.store || (POS.engine && POS.engine.s) || null) : null;
    if (!store || typeof store.load !== 'function') return false;

    function normalize(d) {
      if (!d || typeof d !== 'object') d = { v: 2, ts: Date.now() };
      if (!d.overrides || typeof d.overrides !== 'object') d.overrides = {};
      if (!d.userOverrides || typeof d.userOverrides !== 'object') d.userOverrides = {};
      if (!d.v) d.v = 2;
      return d;
    }

    // 1) Hazırkı vəziyyəti düzəlt
    let broken = false;
    try {
      const cur = store.load();
      if (!cur || !cur.overrides || !cur.userOverrides) broken = true;
      const fixed = normalize(cur);
      if (broken) {
        store._c = fixed;
        if (typeof store.save === 'function') store.save(fixed);
        console.warn('[JOLLY] İcazə məlumatı pozulmuşdu — təmir edildi');
      }
    } catch (e) {
      // load() özü çökürsə, sıfırdan qur
      try {
        const fresh = normalize(null);
        store._c = fresh;
        if (typeof store.save === 'function') store.save(fresh);
        console.warn('[JOLLY] İcazə məlumatı oxunmadı — yenidən quruldu');
      } catch (e2) {}
    }

    // 2) Bir daha pozulmasın — load() hər çağırışda formanı yoxlasın
    if (!store._jollyPatched) {
      const origLoad = store.load.bind(store);
      store.load = function () {
        let d;
        try { d = origLoad(); } catch (e) { d = null; }
        d = normalize(d);
        store._c = d;
        return d;
      };
      store._jollyPatched = true;
    }
    return true;
  }

  function registerExtras() {
    if (typeof POS === 'undefined' || !POS.register) return false;

    const MODULES = [
      { id: 'fixmode', name: 'Bu gün 10 mal', icon: '⚡', permissions: [
        { key: 'fixmode.use', label: 'Tamamlanmamış malları düzəlt', tag: 'edit', default: true },
      ]},
      { id: 'scanmarathon', name: 'Skan Maratonu', icon: '🎯', permissions: [
        { key: 'scanmarathon.use', label: 'Ardıcıl skan ilə barkod bağla', tag: 'edit', default: true },
      ]},
      { id: 'doctor', name: 'Data Doctor', icon: '🩺', permissions: [
        { key: 'doctor.view', label: 'Problemli məhsulları gör', tag: 'view', default: true },
        { key: 'doctor.fix',  label: 'Barkodu düzəlt / məhsulları birləşdir', tag: 'edit', default: false },
      ]},
      { id: 'health', name: 'Sağlamlıq Hesabatı', icon: '📈', permissions: [
        { key: 'health.view', label: 'Hesabata bax', tag: 'view', default: false },
      ]},
      { id: 'grouphealth', name: 'Qrup Sağlamlığı', icon: '📦', permissions: [
        { key: 'grouphealth.view', label: 'Qrup üzrə sağlamlığa bax', tag: 'view', default: false },
      ]},
      { id: 'importer', name: 'Barkod İdxalı', icon: '📥', permissions: [
        { key: 'import.use', label: 'Fayldan toplu idxal et', tag: 'edit', default: false },
      ]},
      { id: 'sheet', name: 'Cədvəl Körpüsü', icon: '📊', permissions: [
        { key: 'sheet.export', label: 'Kataloqu cədvələ çıxar', tag: 'view', default: false },
      ]},
      { id: 'barcodelog', name: 'Barkod Jurnalı', icon: '📜', permissions: [
        { key: 'barcodelog.view', label: 'Kim nə dəyişdi — jurnala bax', tag: 'view', default: false },
      ]},
      { id: 'bulkedit', name: 'Toplu Dəyişiklik', icon: '✏️', permissions: [
        { key: 'bulk.edit', label: 'Seçilənlərə toplu sahə yaz', tag: 'edit', default: false },
      ]},
      { id: 'photosession', name: 'Foto Seansı', icon: '📸', permissions: [
        { key: 'photo.session', label: 'Şəkilsiz malları ardıcıl çək', tag: 'edit', default: true },
      ]},
      { id: 'tasks', name: 'Tapşırıqlar', icon: '✅', permissions: [
        { key: 'tasks.view',   label: 'Öz tapşırıqlarını gör', tag: 'view', default: true },
        { key: 'tasks.assign', label: 'Tapşırıq ver / sil',    tag: 'edit', default: false },
      ]},
      { id: 'perms', name: 'İcazələr', icon: '👁️', permissions: [
        { key: 'perms.preview', label: 'İcazə önbaxışı (kim nə görür)', tag: 'view', default: false },
      ]},
      { id: 'devtools', name: 'Texniki Alətlər', icon: '🩻', permissions: [
        { key: 'tools.selftest', label: 'JOLLY Yoxlama ekranı', tag: 'view', default: false },
        { key: 'tools.testdata', label: 'Sınaq məlumatı yarat/sil', tag: 'edit', default: false },
        { key: 'tools.guide',    label: 'Bələdçi', tag: 'view', default: true },
      ]},
    ];

    let added = 0;
    MODULES.forEach(m => {
      try {
        // Artıq qeydiyyatdadırsa (köhnə permission-engine.js), təkrar yazmırıq
        // POS.reg.mods bir Map-dir
        const known = POS.reg && POS.reg.mods && POS.reg.mods.has && POS.reg.mods.has(m.id);
        if (known) return;
        POS.register(m);
        added++;
      } catch (e) { console.warn('[PermsExtra]', m.id, e); }
    });

    try { if (POS.reg && POS.reg.refreshCustomModule) POS.reg.refreshCustomModule(); } catch (e) {}
    if (added) console.log('[JOLLY] Əlavə icazə modulu qeydiyyatdan keçdi:', added);
    return true;
  }

  /* permission-engine.js öz açarlarını DOMContentLoaded-da yazır —
     biz ondan sonra işləməliyik, ona görə bir az gecikdiririk. */
  function boot() {
    if (typeof POS === 'undefined') { setTimeout(boot, 300); return; }
    repairStore();          // ƏVVƏL təmir — yoxsa qeydiyyat da çökə bilər
    if (!registerExtras()) setTimeout(boot, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 60));
  } else {
    setTimeout(boot, 60);
  }
})();
