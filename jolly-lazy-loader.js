/* ============================================================
   JOLLY Lazy Loader (2026-07-27)
   Açılış sürəti üçün: nadir istifadə olunan modullar artıq
   index.html-də deyil. Onlar proqram ekranda göründükdən SONRA,
   arxa planda yüklənir. Nəticə: ilk açılışda brauzer ~300 KB az
   fayl gözləyir, İş masası daha tez görünür.

   Modul əlavə/çıxarmaq: aşağıdakı LAZY siyahısını dəyiş.
   Diqqət: burada YALNIZ istifadəçi basmadan işə düşməyən
   modullar olmalıdır. Açılışda lazım olan bir şey buraya
   qoyulmamalıdır.
   ============================================================ */
(() => {
  const LAZY = [
    'jolly-archive.js',
    'jolly-showcase.js?v=2',
    'jolly-ad-generator.js?v=1',
    'jolly-holocard.js?v=1',
    'jolly-whatif.js?v=1',
    'roadmap.js',
    'gamification.js',
    'voice-notes.js',
    'jolly-drive.js',
    'ocr.js',
    'visual-search.js',
    'jolly-live-lens.js',
    'daily-summary.js',
    'color-search.js',
    'compare.js',
    'audit.js',
    'price-advisor.js',
    'bg-remove.js?v=2',
    'jolly-announce.js?v=2',
    'dead-zone.js',
    'jolly-telegram.js',
    'jolly-diagnostics.js?v=2',
    'jolly-diag-report.js?v=2',
    'jolly-github.js',
    'jolly-studios-carousel.js?v=11',
  ];

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

  // Bir-bir yükləyirik ki, əsas iş (ilk render, skan, axtarış)
  // şəbəkə və CPU uğrunda onlarla yarışmasın.
  function loadNext() {
    if (i >= LAZY.length) {
      try { document.dispatchEvent(new CustomEvent('jolly:lazy-done')); } catch (e) {}
      console.log('[JOLLY] Arxa plan modulları yükləndi:', LAZY.length);
      return;
    }
    inject(LAZY[i++], schedule);
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

  /* Təhlükəsizlik klapanı: bu modullardan birinə vaxtından əvvəl
     ehtiyac olsa, gözləmədən hamısını dərhal yüklə. */
  window.JollyLazy = {
    flush() {
      started = true;
      while (i < LAZY.length) inject(LAZY[i++], null);
    },
    pending() { return Math.max(0, LAZY.length - i); }
  };
})();
