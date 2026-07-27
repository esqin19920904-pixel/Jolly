/* ============================================================
   JOLLY Samsung-style Swipe Up Menü (FİKSLƏNMİŞ)
   - Accidental swipe-lər azaldıldı
   - Yalnız BOŞDA çalışır
   
   DÜZƏLİŞ (2026-07-27): 
   - SWIPE_THRESHOLD artırıldı (80px → 120px)
   - Horizontal offset tələbi (deltaX < 30 → < 50)
   - Swipe ən aşağıdan başlayıb yuxarı getsə çalışır
   ============================================================ */

const JollySamsungSwipe = (() => {
  let touchStartY = 0;
  let touchStartX = 0;
  const SWIPE_THRESHOLD = 120; // Minimum 120px yuxarı sürüşdürmə (əvvəl 80)
  const MAX_HORIZONTAL_DELTA = 50; // 50px-dən çox sağa/sola keçməsin (əvvəl 30)
  const BOTTOM_ZONE_HEIGHT = 200; // Ekranın alt 200px-ində başlamalı

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
      if (navigator.vibrate) navigator.vibrate([30]);
    }
  }

  function _renderMenu() {
    if (document.getElementById('samsung-swipe-menu')) return;

    const menuHtml = `
      <div id="samsung-swipe-scrim" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9000;display:none;"></div>
      <div id="samsung-swipe-menu" style="position:fixed;bottom:0;left:0;right:0;background:var(--bg-hi,#0f1219);border-top:1px solid var(--border-soft);z-index:9001;display:none;flex-direction:column;max-height:70vh;overflow-y:auto;animation:slideUpSamsung 0.3s ease-out;">
        <div style="padding:16px 16px 12px;border-bottom:1px solid var(--border-soft);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:700;font-size:15px;">📋 JOLLY Menyu</span>
          <span onclick="JollySamsungSwipe.close()" style="font-size:20px;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">✕</span>
        </div>

        <div style="padding:12px;">
          <div class="samsung-menu-item" onclick="JollyRouter.go('#/dashboard'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">📊</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Dashboard</div>
              <div class="muted" style="font-size:11px;">İş masası</div>
            </div>
          </div>

          <div class="samsung-menu-item" onclick="JollyRouter.go('#/home'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">📦</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Məhsullar</div>
              <div class="muted" style="font-size:11px;">Kataloq</div>
            </div>
          </div>

          <div class="samsung-menu-item" onclick="JollyRouter.go('#/barcode-folder'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">📁</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Barkod Qovluğu</div>
              <div class="muted" style="font-size:11px;">Bütün barkodlar</div>
            </div>
          </div>

          <div class="samsung-menu-item" onclick="JollyRouter.go('#/store-map'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">🗺️</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Xəritə</div>
              <div class="muted" style="font-size:11px;">Rəflər</div>
            </div>
          </div>

          <div class="samsung-menu-item" data-perm="products.delete" onclick="JollyRouter.go('#/marked-for-deletion'); JollySamsungSwipe.close();" style="border-top:1px solid var(--border-soft);margin-top:8px;padding-top:12px;">
            <span style="font-size:24px;">✕</span>
            <div style="flex:1;">
              <div style="font-weight:600;color:#ff5c6c;">İşarəli Məhsullar</div>
              <div class="muted" style="font-size:11px;">Admin panel</div>
            </div>
          </div>

          <div class="samsung-menu-item" onclick="JollyRouter.go('#/studios'); JollySamsungSwipe.close();">
            <span style="font-size:24px;">⚙️</span>
            <div style="flex:1;">
              <div style="font-weight:600;">Studio</div>
              <div class="muted" style="font-size:11px;">Parametrlər</div>
            </div>
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
    const scrim = document.getElementById('samsung-swipe-scrim');
    if (scrim) scrim.addEventListener('click', () => _closeMenu());
    if (typeof POS !== 'undefined') POS.syncUI();
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
      
      // Yalnız ekranın ALT bölməsindən başlasa
      const startedAtBottom = touchStartY > window.innerHeight - BOTTOM_ZONE_HEIGHT;
      
      // Yuxarı sürüşdürmə, çox üfüqi deyil, alt bölmədən
      if (deltaY > SWIPE_THRESHOLD && deltaX < MAX_HORIZONTAL_DELTA && startedAtBottom) {
        // Heç bir element clicked deyil
        const target = e.target.closest('.product-card, .prow, .qcard, input, button, [role="button"], .dash-card');
        if (!target) {
          open();
        }
      }
    }, { passive: true });
  }

  return { open, close, initSwipeDetection };
})();

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => JollySamsungSwipe.initSwipeDetection(), 500);
});
