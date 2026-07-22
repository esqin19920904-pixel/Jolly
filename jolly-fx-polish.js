/* ============================================================
   JOLLY FX Polish — kiçik, müstəqil bir "qrafika cilası" modulu.
   Heç bir mövcud fayla toxunmur — sadəcə bir <style> əlavə edir və
   mövcud class-ları (product-card, dash-card, studio-card, page-enter,
   product-grid, gold-pulse, check-pop) zənginləşdirir, üstəlik
   məhsul kartlarına toxunma əsaslı 3D əyilmə effekti qoşur.

   YENİ (2026-07-21, "3D effektlər" turu): toxunma-əsaslı 3D tilt,
   3D qatlanaraq açılan grid, süzülən dashboard kartı, fiziki 3D
   düymə basması, sikkə kimi fırlanan uğur işarəsi.

   Söndürmək istəsən, index.html-dən bu faylın <script> sətrini sil.
   Animasiyalar Theme Studio-dakı "Animasiyalar" ayarına hörmət edir —
   söndürülübsə (body.no-anim), bu modul da avtomatik keçilir.
   ============================================================ */

(function () {
  if (!document.getElementById('jolly-fx-polish-styles')) {
    const style = document.createElement('style');
    style.id = 'jolly-fx-polish-styles';
    style.textContent = `
      /* ── 1) Kart basma effekti — toxunanda yüngül kiçilmə ── */
      body:not(.no-anim) .product-card,
      body:not(.no-anim) .dash-card,
      body:not(.no-anim) .glass.studio-card,
      body:not(.no-anim) .big-op,
      body:not(.no-anim) .more-card {
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      body:not(.no-anim) .dash-card:active,
      body:not(.no-anim) .glass.studio-card:active,
      body:not(.no-anim) .big-op:active,
      body:not(.no-anim) .more-card:active {
        transform: scale(0.96);
      }

      /* ── 2) Şəkillərin incə fade-in görünüşü ── */
      body:not(.no-anim) .product-card img,
      body:not(.no-anim) .thumb img,
      body:not(.no-anim) .image-slot img {
        animation: jollyFxImgIn 0.35s ease both;
      }
      @keyframes jollyFxImgIn {
        from { opacity: 0; transform: scale(1.04); }
        to   { opacity: 1; transform: scale(1); }
      }

      /* ── 3) Kataloq grid-i — kartlar 3D QATLANARAQ açılır ── */
      body:not(.no-anim) .product-grid > .product-card {
        animation: jollyFxCardIn3D 0.38s ease both;
        transform-style: preserve-3d;
      }
      .product-grid > .product-card:nth-child(1)  { animation-delay: 0.02s; }
      .product-grid > .product-card:nth-child(2)  { animation-delay: 0.05s; }
      .product-grid > .product-card:nth-child(3)  { animation-delay: 0.08s; }
      .product-grid > .product-card:nth-child(4)  { animation-delay: 0.11s; }
      .product-grid > .product-card:nth-child(5)  { animation-delay: 0.14s; }
      .product-grid > .product-card:nth-child(6)  { animation-delay: 0.17s; }
      .product-grid > .product-card:nth-child(7)  { animation-delay: 0.20s; }
      .product-grid > .product-card:nth-child(8)  { animation-delay: 0.23s; }
      .product-grid > .product-card:nth-child(n+9) { animation-delay: 0.25s; }
      @keyframes jollyFxCardIn3D {
        from { opacity: 0; transform: perspective(600px) rotateX(-14deg) translateY(10px); }
        to   { opacity: 1; transform: perspective(600px) rotateX(0deg) translateY(0); }
      }

      /* ── 4) Səhifə keçidi — yumşaq, yuxarıdan sürüşərək gəlir ── */
      body:not(.no-anim) #main.page-enter {
        animation: jollyFxPageIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes jollyFxPageIn {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* ── 5) Çiplər (chip) toxunanda yüngül "pop" ── */
      body:not(.no-anim) .chip { transition: transform 0.12s ease; }
      body:not(.no-anim) .chip:active { transform: scale(0.93); }

      /* ── 6) Düymələr — adi (.btn) yüngül basma ── */
      body:not(.no-anim) .btn { transition: transform 0.12s ease, filter 0.12s ease; }
      body:not(.no-anim) .btn:active { transform: scale(0.97); filter: brightness(0.94); }

      /* ── 7) Əsas düymələr (.btn-primary) — FİZİKİ 3D basma hissi ── */
      body:not(.no-anim) .btn.btn-primary {
        box-shadow: 0 5px 0 rgba(0,0,0,0.35), 0 7px 14px rgba(0,0,0,0.28);
        transform: translateY(0) scale(1);
        transition: transform 0.09s ease, box-shadow 0.09s ease, filter 0.12s ease;
      }
      body:not(.no-anim) .btn.btn-primary:active {
        transform: translateY(5px) scale(1);
        box-shadow: 0 0 0 rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.28);
        filter: brightness(0.96);
      }

      /* ── 8) "Mağaza Vəziyyəti" (gold-pulse) kartı — yüngülcə süzülür ── */
      body:not(.no-anim) .gold-pulse {
        animation: jollyFxFloatIdle 3.6s ease-in-out infinite;
        transform-style: preserve-3d;
      }
      @keyframes jollyFxFloatIdle {
        0%, 100% { transform: translateY(0) rotateX(0.6deg); }
        50%      { transform: translateY(-6px) rotateX(-0.6deg); }
      }

      /* ── 9) Uğur işarəsi (✅) — sikkə kimi fırlanaraq görünür ── */
      body:not(.no-anim) .check-pop .mark {
        animation: jollyFxCoinIn 0.5s ease both;
      }
      @keyframes jollyFxCoinIn {
        from { transform: rotateY(180deg) scale(0.4); opacity: 0; }
        to   { transform: rotateY(0deg) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── 10) Toxunma-əsaslı 3D əyilmə (tilt) — məhsul kartına barmağınla
  // toxunub sürüşdürəndə kart real 3D perspektivdə əyilir. Delegated
  // listener istifadə olunur (kartlar daim yenidən render olunduğu üçün). ──
  if (!window._jollyFxTiltInit) {
    window._jollyFxTiltInit = true;
    let tiltCard = null;

    function animOff() { return document.body.classList.contains('no-anim'); }

    document.addEventListener('touchstart', (e) => {
      if (animOff()) return;
      const card = e.target.closest && e.target.closest('.product-card');
      if (card) tiltCard = card;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!tiltCard || animOff()) return;
      const rect = tiltCard.getBoundingClientRect();
      const t = e.touches[0];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      const rotX = ((y / rect.height) - 0.5) * -9;
      const rotY = ((x / rect.width) - 0.5) * 9;
      tiltCard.style.transform = `perspective(500px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.98)`;
    }, { passive: true });

    function releaseTilt() {
      if (tiltCard) { tiltCard.style.transform = ''; tiltCard = null; }
    }
    document.addEventListener('touchend', releaseTilt, { passive: true });
    document.addEventListener('touchcancel', releaseTilt, { passive: true });
  }
})();
