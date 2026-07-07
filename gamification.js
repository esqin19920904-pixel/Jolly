/* ==========================================================================
   JOLLY GAMİFİKASİYA MODULU (gamification.js)
   ==========================================================================
   Roadmap #26: "100 məhsul əlavə etdin", "7 gün ardıcıl" kimi kiçik
   motivasiya nişanları.

   Qeyd: Bu versiya YALNIZ "tətbiqə giriş seriyası" (streak) izləyir, çünki
   məhsul sayı kimi datalar products.js/db.js-in daxili strukturuna bağlıdır
   və mən onu görmədən yazsam səhv ola bilər. Məhsul-əsaslı nişanlar üçün
   products.js-i göndər, üzərinə əlavə edərəm.

   Necə işləyir:
   - Hər gün tətbiq açılanda bir dəfə qeyd olunur (gün fərqinə görə)
   - Ardıcıl gün sayı hesablanır (1 gün ara verilsə sıfırlanır)
   - Nişanlar: 3, 7, 14, 30, 60, 100 günlük seriyalar
   - Topbar-da bell düyməsinin yanında kiçik 🏅 sayğac görünür,
     basanda qazanılan nişanlar siyahısı açılır
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "jolly_gamification_v1";

  const BADGE_THRESHOLDS = [
    { days: 3,   label: "3 gün ardıcıl",   icon: "🔥" },
    { days: 7,   label: "7 gün ardıcıl",   icon: "🏅" },
    { days: 14,  label: "14 gün ardıcıl",  icon: "🥈" },
    { days: 30,  label: "30 gün ardıcıl",  icon: "🥇" },
    { days: 60,  label: "60 gün ardıcıl",  icon: "💎" },
    { days: 100, label: "100 gün ardıcıl", icon: "👑" }
  ];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("[JollyGamification] oxuna bilmədi:", e);
    }
    return { lastVisit: null, streak: 0, earnedBadges: [] };
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("[JollyGamification] yazıla bilmədi:", e);
    }
  }

  function dayKey(date) {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function daysBetween(a, b) {
    const ms = new Date(b) - new Date(a);
    return Math.round(ms / 86400000);
  }

  let state = loadState();
  let newlyEarned = [];

  function recordVisit() {
    const today = dayKey(new Date());
    if (state.lastVisit === today) return; // bu gün artıq qeyd olunub

    if (state.lastVisit) {
      const diff = daysBetween(state.lastVisit, today);
      state.streak = diff === 1 ? state.streak + 1 : 1;
    } else {
      state.streak = 1;
    }
    state.lastVisit = today;

    newlyEarned = [];
    BADGE_THRESHOLDS.forEach(b => {
      if (state.streak >= b.days && !state.earnedBadges.includes(b.days)) {
        state.earnedBadges.push(b.days);
        newlyEarned.push(b);
      }
    });

    saveState(state);
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-gami-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-gami-styles";
    style.textContent = `
      #jolly-gami-toggle {
        background: none; border: none; cursor: pointer; position: relative;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-gami-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-gami-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-gami-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-gami-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 80vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-gami-panel h2 {
        margin: 0 0 4px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      .jg-streak { font-size: 13px; color: #ccc; margin-bottom: 14px; }
      .jg-badge-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .jg-badge {
        background: #232323; border: 1px solid #333; border-radius: 12px;
        padding: 12px 6px; text-align: center; opacity: 0.35;
      }
      .jg-badge.earned { opacity: 1; border-color: #d4af37; }
      .jg-badge .jg-icon { font-size: 26px; }
      .jg-badge .jg-label { font-size: 11px; margin-top: 6px; color: #e6d9b0; }
    `;
    document.head.appendChild(style);
  }

  function updateButton() {
    const btn = document.getElementById("jolly-gami-toggle");
    if (!btn) return;
    btn.querySelector(".ta-icon").textContent = "🏅";
    btn.querySelector(".ta-label").textContent = state.streak + " gün";
  }

  function injectButton() {
    if (document.getElementById("jolly-gami-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-gami-toggle";
    btn.className = "top-act";
    btn.title = "Nişanların";
    btn.innerHTML = `<span class="ta-icon"></span><span class="ta-label"></span>`;
    btn.onclick = show;
    container.appendChild(btn);
    updateButton();
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-gami-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "jolly-gami-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const badgesHtml = BADGE_THRESHOLDS.map(b => {
      const earned = state.earnedBadges.includes(b.days);
      return `
        <div class="jg-badge ${earned ? "earned" : ""}">
          <div class="jg-icon">${b.icon}</div>
          <div class="jg-label">${b.label}</div>
        </div>
      `;
    }).join("");

    overlay.innerHTML = `
      <div id="jolly-gami-panel">
        <h2>Nişanların <button onclick="document.getElementById('jolly-gami-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <div class="jg-streak">🔥 Hazırkı seriya: <b>${state.streak} gün</b></div>
        <div class="jg-badge-grid">${badgesHtml}</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function maybeToastNewBadges() {
    if (!newlyEarned.length) return;
    newlyEarned.forEach(b => {
      if (window.Toast && typeof window.Toast.show === "function") {
        window.Toast.show(`${b.icon} Yeni nişan: ${b.label}!`);
      } else {
        console.log(`[JollyGamification] Yeni nişan: ${b.icon} ${b.label}`);
      }
    });
    newlyEarned = [];
  }

  function init() {
    recordVisit();
    injectStyles();
    // Düymə artıq topbar-a inject olunmur — "🧰 Alətlər" menyusundan çağırılır
    maybeToastNewBadges();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // --------------------------------------------------------------------
  // PUBLİK API + MODULE REGISTRY
  // --------------------------------------------------------------------
  const JollyGamification = {
    id: "gamification",
    name: "Nişanlar",
    version: "1.0.0",
    show,
    getStreak: () => state.streak,
    getBadges: () => state.earnedBadges.slice()
  };

  window.JollyGamification = JollyGamification;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyGamification);
    console.log("[JollyGamification] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyGamification] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyGamification.show()).");
  }
})();
