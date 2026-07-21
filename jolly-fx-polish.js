/* ============================================================
   JOLLY FX Polish — kiçik, müstəqil bir "qrafika cilası" modulu.
   Heç bir mövcud fayla toxunmur — sadəcə bir <style> əlavə edir və
   mövcud class-ları (product-card, dash-card, studio-card, page-enter,
   product-grid) zənginləşdirir. Söndürmək istəsən, index.html-dən bu
   faylın <script> sətrini sil, kifayətdir.

   NƏ EDİR:
   1) Kartlara (məhsul/dashboard/studio) toxunanda yüngül "bas" effekti
   2) Şəkillər görünəndə incə fade-in
   3) Kataloq grid-i açılanda kartlar kaskad (bir-bir, sıra ilə) görünür
   4) Səhifə keçidləri (page-enter) daha yumşaq — yuxarıdan sürüşərək gəlir
   5) Animasiyalar Theme Studio-dakı "Animasiyalar" ayarına hörmət edir —
      söndürülübsə (body.no-anim), bu modul da avtomatik keçilir
   ============================================================ */

(function () {
  if (document.getElementById('jolly-fx-polish-styles')) return;

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
    body:not(.no-anim) .product-card:active,
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

    /* ── 3) Kataloq grid-i — kartlar kaskad (bir-bir) görünür ── */
    body:not(.no-anim) .product-grid > .product-card {
      animation: jollyFxCardIn 0.32s ease both;
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
    @keyframes jollyFxCardIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
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
    body:not(.no-anim) .chip {
      transition: transform 0.12s ease;
    }
    body:not(.no-anim) .chip:active {
      transform: scale(0.93);
    }

    /* ── 6) Düymələr (btn) toxunanda yüngül basma ── */
    body:not(.no-anim) .btn {
      transition: transform 0.12s ease, filter 0.12s ease;
    }
    body:not(.no-anim) .btn:active {
      transform: scale(0.97);
      filter: brightness(0.94);
    }
  `;
  document.head.appendChild(style);
})();
