/* ╔══════════════════════════════════════════════════════════════════╗
   ║  JOLLY EDGE NEON FX v2.0                                       ║
   ║  Ripple + Haptic + Sound + Pointer Support                     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

(function () {
  "use strict";

  // --------------------------------------------------
  // Haptic
  // --------------------------------------------------
  function haptic(pattern) {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // --------------------------------------------------
  // Sound
  // --------------------------------------------------
  function playSound(type) {
    if (typeof JollySound === "undefined") return;

    const sound = type || "tap";

    try {
      if (typeof JollySound.play === "function") {
        JollySound.play(sound);
      } else if (typeof JollySound[sound] === "function") {
        JollySound[sound]();
      }
    } catch (e) {}
  }

  // --------------------------------------------------
  // Ripple
  // --------------------------------------------------
  function createRipple(event) {

    if (!event) return;

    const cell = event.currentTarget;

    if (!cell) return;

    const rect = cell.getBoundingClientRect();

    let clientX = null;
    let clientY = null;

    // Touch End
    if (event.changedTouches && event.changedTouches.length) {

      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;

    }

    // Touch Start
    else if (event.touches && event.touches.length) {

      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;

    }

    // Mouse / Pointer
    else if (
      typeof event.clientX === "number" &&
      typeof event.clientY === "number"
    ) {

      clientX = event.clientX;
      clientY = event.clientY;

    }

    // Koordinat tapılmadı
    else {

      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;

    }

    const size = Math.max(rect.width, rect.height) * 1.6;

    const ripple = document.createElement("div");
    ripple.className = "edge-ripple";

    ripple.style.width = size + "px";
    ripple.style.height = size + "px";

    ripple.style.left = (clientX - rect.left - size / 2) + "px";
    ripple.style.top = (clientY - rect.top - size / 2) + "px";

    const color =
      getComputedStyle(cell)
        .getPropertyValue("--cell-color")
        .trim() || "#f5c563";

    ripple.style.setProperty("--cell-color", color);

    cell.appendChild(ripple);

    ripple.addEventListener("animationend", function () {
      ripple.remove();
    });

    setTimeout(function () {
      ripple.remove();
    }, 600);
  }

  // --------------------------------------------------
  // Init
  // --------------------------------------------------
  function initEdgeNeon() {

    const cells = document.querySelectorAll(
      ".edge-cell,.ec-cell,[class*='edge-cell'],[class*='ec-cell']"
    );

    cells.forEach(function (cell) {

      if (cell.dataset.neonInit === "1") return;

      cell.dataset.neonInit = "1";

      // Pointer Events (ən yaxşı seçim)

      if (window.PointerEvent) {

        cell.addEventListener("pointerdown", function () {

          this.classList.add("neon-active");
          haptic(15);

        });

        cell.addEventListener("pointerup", function (e) {

          createRipple(e);
          playSound("tap");
          haptic([20,10]);

          this.classList.remove("neon-active");

        });

        cell.addEventListener("pointercancel", function () {

          this.classList.remove("neon-active");

        });

      }

      // Köhnə brauzerlər

      else {

        cell.addEventListener("touchstart", function () {

          this.classList.add("neon-active");
          haptic(15);

        }, { passive:true });

        cell.addEventListener("touchend", function (e) {

          createRipple(e);
          playSound("tap");
          haptic([20,10]);

          this.classList.remove("neon-active");

        }, { passive:true });

        cell.addEventListener("mousedown", function () {

          this.classList.add("neon-active");

        });

        cell.addEventListener("mouseup", function (e) {

          createRipple(e);
          playSound("tap");

          this.classList.remove("neon-active");

        });

      }

    });

    console.log("⚡ JOLLY Edge Neon FX v2 aktivdir. Cell sayı:", cells.length);

  }

  // --------------------------------------------------
  // Start
  // --------------------------------------------------

  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", initEdgeNeon);

  } else {

    initEdgeNeon();

  }

  // --------------------------------------------------
  // Dynamic DOM
  // --------------------------------------------------

  const observer = new MutationObserver(function () {

    clearTimeout(observer._timer);

    observer._timer = setTimeout(initEdgeNeon, 80);

  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();