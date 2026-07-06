/* ============================================================
   JOLLY Quick — üzən sürətli-əməllər düyməsi (FAB) + son baxılanlar
   ============================================================ */

const JollyQuick = (() => {
  const RECENT_KEY = 'jolly_recent_views';
  let open = false;

  const MENU = [
    { icon: '➕', label: 'Yeni məhsul', action: () => JollyRouter.go('#/product/new') },
    { icon: '📡', label: 'Skan et', action: () => { if (typeof JollyProducts !== 'undefined') JollyProducts.scanSearch(); } },
    { icon: '📷', label: 'Tez şəkil', action: () => { if (typeof JollyDashboard !== 'undefined') JollyDashboard.quickPhoto(); } },
    { icon: '🎤', label: 'Səsli axtar', action: () => { if (typeof JollyProducts !== 'undefined') JollyProducts.voiceSearch(); } },
    { icon: '🎛️', label: 'İş masası', action: () => JollyRouter.go('#/dashboard') },
  ];

  function ensureFab() {
    let fab = document.getElementById('quickFab');
    if (fab) return fab;
    fab = document.createElement('div');
    fab.id = 'quickFab';
    fab.className = 'quick-fab';
    fab.innerHTML = `
      <div class="qfab-menu" id="qfabMenu" style="display:none;"></div>
      <button class="qfab-main" id="qfabMain">＋</button>
    `;
    document.body.appendChild(fab);
    fab.querySelector('#qfabMain').addEventListener('click', toggle);
    return fab;
  }

  function render() {
    // Köhnə Quick FAB ləğv edildi — dashboard.js-dəki yeni FAB istifadə olunur.
    const old = document.getElementById('quickFab');
    if (old) old.remove();
  }

  function toggle() {
    open ? close() : openMenu();
  }
  function openMenu() {
    open = true;
    const fab = document.getElementById('quickFab');
    if (!fab) return;
    fab.classList.add('open');
    fab.querySelector('#qfabMenu').style.display = 'flex';
    if (typeof JollySound !== 'undefined') JollySound.tap();
  }
  function close() {
    open = false;
    const fab = document.getElementById('quickFab');
    if (!fab) return;
    fab.classList.remove('open');
    fab.querySelector('#qfabMenu').style.display = 'none';
  }

  /* Bəzi səhifələrdə FAB-ı gizlət (forma, studio və s. — artıq öz FAB-ları var) */
  function updateFab(hash) {
    const fab = document.getElementById('quickFab');
    if (fab) fab.remove(); // köhnə FAB istifadə olunmur
  }

  /* ---------- Son baxılanlar ---------- */
  function trackView(id) {
    if (!id) return;
    let list = JollyDB.read(RECENT_KEY, []);
    list = list.filter(x => x !== id);
    list.unshift(id);
    if (list.length > 20) list.length = 20;
    JollyDB.write(RECENT_KEY, list);
  }

  function recentViewed() {
    const ids = JollyDB.read(RECENT_KEY, []);
    return ids.map(id => JollyDB.Products.get(id)).filter(Boolean);
  }

  return { render, updateFab, trackView, recentViewed };
})();
