/* ============================================================
   JOLLY Samsung-style Swipe Up Menü
   Boş ekranda yuxarı sürüşdürəndə əsas menyu açılır
   
   YENİ (2026-07-27, #5): Sürüşdürmə jestini tanı və menyu göstər
   ============================================================ */

const JollySamsungSwipe = (() => {
  let touchStartY = 0;
  let touchStartX = 0;
  const SWIPE_THRESHOLD = 80; // minimum 80px yuxarı sürüşdürmə

  function _isMenuOpen() {
    return !!document.getElementById('samsung-swipe-menu') && 
           document.getElementById('samsung-swipe-menu').style.display !== 'none';
  }

  function _closeMenu() {
    const menu = document.getElementById('samsung-swipe-menu');
    if (menu) {
      menu.style.display = 'none';
      const scrim = document.getElementById('samsung-swipe-scrim');
      if (scrim) scrim.style.display = 'none';
    }
  }

  function _openMenu() {
    const menu = document.getElementById('samsung-swipe-menu');
    const scrim = document.getElementById('samsung-swipe-scrim');
    if (menu && scrim) {
      scrim.style.display = 'block';
      menu.style.display = 'flex';
      // Micro haptic
      if (navigator.vibrate) navigator.vibrate([30]);
    }
  }

  function _renderMenu() {
    // Əgər artıq renderlənibsə çıx
    if (document.getElementById('samsung-swipe-menu')) return;

    const menuHtml = `
      <div id="samsung-swipe-scrim" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9000;display:none;"></div>
      <div id="samsung-swipe-menu" style="position:fixed;bottom:0;left:0;right:0;background:var(--bg-hi,#0f1219);border-top:1px solid var(--border-soft);z-index:9001;display:none;flex-direction:column;max-height:70vh;overflow-y:auto;animation:slideUpSamsung 0.3s ease-out;">
        <div style="padding:16px 16px 12px;border-bottom:1px solid var(--border-soft);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:700;font-size:15px;">📋 JOLLY Menyu</span>
          <span onclick="JollySamsungSwipe.close()" style="font-size:20px;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">✕</span>
        </div>

        <div style="padding:12px;">
          <!-- Ana Səhifə -->
          <div class="samsung-menu-item" onclick="JollyRouter.go('#/dashboard'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">📊</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Dashboard</div>
              <div class="muted" style="font-size:11px;">İş masası və qısa əməliyyatlar</div>
            </div>
            <span style="color:var(--text-low);">›</span>
          </div>

          <!-- Məhsullar -->
          <div class="samsung-menu-item" onclick="JollyRouter.go('#/home'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">📦</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Məhsullar</div>
              <div class="muted" style="font-size:11px;">Kataloq və axtarış</div>
            </div>
            <span style="color:var(--text-low);">›</span>
          </div>

          <!-- Barkod Qovluğu -->
          <div class="samsung-menu-item" onclick="JollyRouter.go('#/barcode-folder'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">📁</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Barkod Qovluğu</div>
              <div class="muted" style="font-size:11px;">Bütün barkodlar bir yerdə</div>
            </div>
            <span style="color:var(--text-low);">›</span>
          </div>

          <!-- Mağaza Xəritəsi -->
          <div class="samsung-menu-item" onclick="JollyRouter.go('#/store-map'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">🗺️</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Mağaza Xəritəsi</div>
              <div class="muted" style="font-size:11px;">Rəflərin yerləşim planı</div>
            </div>
            <span style="color:var(--text-low);">›</span>
          </div>

          <!-- İşarəli Məhsullar (Admin-only) -->
          <div class="samsung-menu-item" data-perm="products.delete" onclick="JollyRouter.go('#/marked-for-deletion'); JollySamsungSwipe.close();" style="border-top:1px solid var(--border-soft);margin-top:8px;padding-top:12px;">
            <span style="font-size:24px;">✕</span>
            <div style="flex:1;">
              <div style="font-weight:600;color:#ff5c6c;">İşarəli Məhsullar</div>
              <div class="muted" style="font-size:11px;">Silinmə üçün işarələnmiş</div>
            </div>
            <span style="color:var(--text-low);">›</span>
          </div>

          <!-- Məlumat -->
          <div class="samsung-menu-item" onclick="JollyRouter.go('#/studios'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">⚙️</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Parametrlər</div>
              <div class="muted" style="font-size:11px;">Quraşdırma, backup, tema</div>
            </div>
            <span style="color:var(--text-low);">›</span>
          </div>
        </div>
      </div>

      <style>
        .samsung-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 12px;
          border-radius: 12px;
          cursor: pointer;
          margin-bottom: 8px;
          transition: background 0.2s;
        }
        .samsung-menu-item:active {
          background: rgba(255, 255, 255, 0.08);
        }
        @keyframes slideUpSamsung {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', menuHtml);

    // Scrim toxuduğu zaman bağla
    const scrim = document.getElementById('samsung-swipe-scrim');
    if (scrim) scrim.addEventListener('click', () => _closeMenu());

    // Permission sync — Admin-only elementi göstər/gizlət
    if (typeof POS !== 'undefined') {
      POS.syncUI();
    }
  }

  function open() {
    _renderMenu();
    _openMenu();
  }

  function close() {
    _closeMenu();
  }

  function initSwipeDetection() {
    _renderMenu();

    document.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndX = e.changedTouches[0].clientX;
      const deltaY = touchStartY - touchEndY;
      const deltaX = Math.abs(touchEndX - touchStartX);

      // Yuxarı sürüşdürmə: touchStartY > touchEndY
      // Dikey sürüşdürmə: deltaX < 30 (çox üfüqi deyil)
      // Yalnız boş yerdə (main məhsul kartında deyil)
      if (deltaY > SWIPE_THRESHOLD && deltaX < 30) {
        const target = e.target.closest('.product-card, .prow, .qcard, input, button, [role="button"]');
        if (!target) {
          open();
        }
      }
    }, { passive: true });
  }

  return { open, close, initSwipeDetection };
})();

// App yükləndikdən sonra menyu başlatıla bilər
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => JollySamsungSwipe.initSwipeDetection(), 500);
});
