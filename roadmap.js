/* ==========================================================================
   JOLLY ROADMAP MODULU (roadmap.js)
   ==========================================================================
   Məqsəd: Gələcəkdə görüləcək 26 fikri strukturlaşdırılmış şəkildə saxlamaq,
   status izləmək, kateqoriyaya görə filtrləmək və JOLLY-nin ModuleRegistry
   sisteminə self-register olunmaq.

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at (subfolder YOX).
   2. index.html-də <script src="roadmap.js"></script> əlavə et
      (module-registry.js-dən SONRA yüklənməlidir).
   3. Hazır - modul avtomatik qeydiyyatdan keçir.

   Açmaq üçün konsolda: JollyRoadmap.show()
   Yeni fikir üçün:      JollyRoadmap.addIdea("Başlıq", "Kateqoriya")
   Status dəyişmək üçün: JollyRoadmap.setStatus(7, "done")
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "jolly_roadmap_ideas_v1";

  // ------------------------------------------------------------------------
  // 1) BAŞLANĞIC 26 FİKİR (id sırası ilə, sənin seçdiyin ardıcıllıqla)
  // ------------------------------------------------------------------------
  const DEFAULT_IDEAS = [
    { id: 1,  title: "Gecə rejimi",                         desc: "Gold temaya uyğun tünd fon variantı, axşam işləmək üçün göz rahatlığı",             category: "Vizual/UI",        status: "pending" },
    { id: 2,  title: "AMOLED tam qara rejim",                desc: "Gecə rejimindən əlavə, tam qara fon ilə ekstra batareya qənaəti",                    category: "Vizual/UI",        status: "pending" },
    { id: 3,  title: "Şəkil fonu avtomatik təmizləmə",        desc: "Məhsul şəklinin arxa fonunu AI ilə silib ağ/şəffaf fona keçirmək",                   category: "Vizual/UI",        status: "pending" },
    { id: 4,  title: "AI foto keyfiyyət yoxlaması",           desc: "Şəkil qaranlıq/bulanıqdırsa xəbərdarlıq, 'yenidən çək' təklifi",                      category: "Vizual/UI",        status: "pending" },
    { id: 5,  title: "Rəngə görə axtarış",                    desc: "'Qırmızı olanları göstər' - AI dominant rəngə görə məhsul tapır",                    category: "Vizual/UI",        status: "pending" },

    { id: 6,  title: "Rəqəmsal əkiz (Digital Twin)",          desc: "Mağazanın 2D xəritəsi, hər məhsulun virtual yerləşdiyi rəf",                          category: "Anbar/İdarəetmə",  status: "pending" },
    { id: 7,  title: "Sürətli audit rejimi",                  desc: "Kamera davamlı skan edir, sağa/sola sürüşdürərək təsdiq/yoxla/sil",                  category: "Anbar/İdarəetmə",  status: "pending" },
    { id: 8,  title: "Ölü zona analiz raportu",                desc: "Heç axtarılmayan/uzun müddət toxunulmayan malların siyahısı",                        category: "Anbar/İdarəetmə",  status: "pending" },
    { id: 9,  title: "Sürətli müqayisə rejimi",               desc: "İki oxşar məhsulu yan-yana (qiymət, tədarükçü, son satış tarixi)",                    category: "Anbar/İdarəetmə",  status: "pending" },
    { id: 10, title: "Əl yazısı OCR",                          desc: "Kağız qeydin şəklini çək, AI strukturlaşdırılmış JOLLY qeydinə çevirsin",             category: "Anbar/İdarəetmə",  status: "pending" },

    { id: 11, title: "Generativ 3D məhsul modeli",            desc: "Bir şəkildən AI ilə sadə 3D model, kataloqda 360° fırlanan görünüş",                  category: "AI/Analitik",      status: "pending" },
    { id: 12, title: "Holoqrafik məhsul kartı (AR)",           desc: "Kameranı masaya tutanda 3D modelin fiziki oradaymış kimi görünməsi",                  category: "AI/Analitik",      status: "pending" },
    { id: 13, title: "AI qiymət tövsiyəsi",                    desc: "Tarixçə + oxşar mallara baxıb qiymət artır/azalt tövsiyəsi",                          category: "AI/Analitik",      status: "pending" },
    { id: 14, title: "Avtomatik teq/kateqoriya təyini",        desc: "Şəkil+ad əsasında AI özü kateqoriya və açar sözləri təyin edir",                     category: "AI/Analitik",      status: "pending" },
    { id: 15, title: "'Nə olardı' simulyator söhbəti",         desc: "Gemini bridge-ə 'bu malı 20% ucuzlatsam?' desən fərziyyəli cavab",                    category: "AI/Analitik",      status: "pending" },
    { id: 16, title: "Çoxdilli avtomatik tərcümə",             desc: "Məhsul adı/təsvirini AI ilə rus/ingilis dilinə avtomatik tərcümə",                    category: "AI/Analitik",      status: "pending" },

    { id: 17, title: "Gündəlik xülasə bildirişi",             desc: "Səhər açılışda: neçə məhsul əlavə olunub, şəkli yoxdur, unudulub",                    category: "Bildiriş/Xatırlatma", status: "pending" },
    { id: 18, title: "Mövsümi xatırlatma bildirişi",           desc: "'Keçən il bu vaxt bu qrup çox axtarılırdı, hazırlaş' tipli bildiriş",                 category: "Bildiriş/Xatırlatma", status: "pending" },
    { id: 19, title: "Səsli sürətli qeyd → mətn",              desc: "'Bu rəf qarışıqdır' de, avtomatik qeyd kimi yadda saxlanılsın",                       category: "Bildiriş/Xatırlatma", status: "pending" },

    { id: 20, title: "Avtomatik paylaşım linki (QR kataloq)",  desc: "Bir kliklə 'bu ay kataloqu' linki yaradıb göndərmək",                                 category: "Marketinq/Paylaşım", status: "pending" },
    { id: 21, title: "AI reklam mətni generatoru",             desc: "Məhsul şəklindən avtomatik İnstagram başlıq + haştəq təklifi",                        category: "Marketinq/Paylaşım", status: "pending" },
    { id: 22, title: "Rəqəmsal sərgi otağı (swipe-galeriya)",  desc: "Premium malları tam-ekran story tərzi sürüşdürərək baxmaq",                           category: "Marketinq/Paylaşım", status: "pending" },

    { id: 23, title: "Blokçeyn əsaslı tədarük izi",            desc: "Hər məhsulun tədarükçüdən sənə qədər yolunun dəyişməz (log) qeydi",                  category: "Jurnal/Tarixçə",   status: "pending" },
    { id: 24, title: "Time-lapse anbar videosu",               desc: "Aylıq snapshot-lardan avtomatik qısa video - mağazanın böyüməsi",                    category: "Jurnal/Tarixçə",   status: "pending" },
    { id: 25, title: "Xatirə kapsulu / illik geriyə baxış",    desc: "İl sonunda avtomatik hesabat: neçə məhsul, neçə dəyişiklik oldu",                     category: "Jurnal/Tarixçə",   status: "pending" },

    { id: 26, title: "Gamifikasiya - nişanlar",                desc: "'100 məhsul əlavə etdin', '7 gün ardıcıl' kimi motivasiya nişanları",                 category: "Motivasiya",       status: "pending" }
  ];

  // ------------------------------------------------------------------------
  // 2) YADDAŞ (localStorage) - status dəyişiklikləri saxlanılır
  // ------------------------------------------------------------------------
  function loadIdeas() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("[JollyRoadmap] localStorage oxuna bilmədi, default istifadə olunur:", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_IDEAS));
  }

  function saveIdeas(ideas) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
    } catch (e) {
      console.warn("[JollyRoadmap] localStorage yazıla bilmədi:", e);
    }
  }

  let ideas = loadIdeas();

  // ------------------------------------------------------------------------
  // 3) STATUS RƏNGLƏRİ
  // ------------------------------------------------------------------------
  const STATUS_META = {
    pending:     { label: "Gözləyir",     color: "#9e9e9e" },
    in_progress: { label: "İşlənir",      color: "#d4af37" }, // gold
    done:        { label: "Tamamlandı",   color: "#4caf50" },
    skipped:     { label: "Ləğv edildi",  color: "#e53935" }
  };

  // ------------------------------------------------------------------------
  // 4) UI QURMA
  // ------------------------------------------------------------------------
  function buildStyles() {
    if (document.getElementById("jolly-roadmap-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-roadmap-styles";
    style.textContent = `
      #jolly-roadmap-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-roadmap-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 88vh;
        border-radius: 20px 20px 0 0; overflow-y: auto; padding: 16px;
        border-top: 2px solid #d4af37; box-shadow: 0 -4px 24px rgba(212,175,55,0.25);
        font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-roadmap-panel h2 {
        margin: 0 0 12px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      #jolly-roadmap-close {
        background: none; border: none; color: #f0e6c8; font-size: 22px; cursor: pointer;
      }
      .jr-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
      .jr-filter-btn {
        background: #2a2a2a; border: 1px solid #444; color: #ccc; font-size: 12px;
        padding: 5px 10px; border-radius: 999px; cursor: pointer;
      }
      .jr-filter-btn.active { background: #d4af37; color: #1a1a1a; border-color: #d4af37; }
      .jr-card {
        background: #232323; border: 1px solid #333; border-radius: 12px;
        padding: 10px 12px; margin-bottom: 8px;
      }
      .jr-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .jr-card-title { font-weight: 600; font-size: 14px; }
      .jr-card-desc { font-size: 12px; color: #aaa; margin-top: 4px; line-height: 1.4; }
      .jr-badge {
        font-size: 10px; padding: 2px 8px; border-radius: 999px; color: #111; font-weight: 600;
        white-space: nowrap;
      }
      .jr-status-select {
        margin-top: 8px; width: 100%; background: #1a1a1a; color: #f0e6c8;
        border: 1px solid #444; border-radius: 8px; padding: 4px 6px; font-size: 12px;
      }
      .jr-cat-label { font-size: 10px; color: #d4af37; text-transform: uppercase; letter-spacing: 0.5px; }
    `;
    document.head.appendChild(style);
  }

  function render() {
    const panel = document.getElementById("jolly-roadmap-panel");
    if (!panel) return;

    const activeFilter = panel.dataset.filter || "Hamısı";
    const categories = ["Hamısı", ...new Set(ideas.map(i => i.category))];

    const filtered = activeFilter === "Hamısı"
      ? ideas
      : ideas.filter(i => i.category === activeFilter);

    panel.innerHTML = `
      <h2>Gələcək Fikirlər (${ideas.length})
        <button id="jolly-roadmap-close">&times;</button>
      </h2>
      <div class="jr-filters">
        ${categories.map(c => `
          <button class="jr-filter-btn ${c === activeFilter ? "active" : ""}" data-cat="${c}">${c}</button>
        `).join("")}
      </div>
      <div id="jr-list">
        ${filtered.map(idea => {
          const meta = STATUS_META[idea.status] || STATUS_META.pending;
          return `
            <div class="jr-card">
              <div class="jr-card-top">
                <div>
                  <div class="jr-cat-label">${idea.category}</div>
                  <div class="jr-card-title">#${idea.id} ${idea.title}</div>
                </div>
                <span class="jr-badge" style="background:${meta.color}">${meta.label}</span>
              </div>
              <div class="jr-card-desc">${idea.desc}</div>
              <select class="jr-status-select" data-id="${idea.id}">
                ${Object.keys(STATUS_META).map(s => `
                  <option value="${s}" ${s === idea.status ? "selected" : ""}>${STATUS_META[s].label}</option>
                `).join("")}
              </select>
            </div>
          `;
        }).join("")}
      </div>
    `;

    panel.querySelector("#jolly-roadmap-close").onclick = closeRoadmap;

    panel.querySelectorAll(".jr-filter-btn").forEach(btn => {
      btn.onclick = () => {
        panel.dataset.filter = btn.dataset.cat;
        render();
      };
    });

    panel.querySelectorAll(".jr-status-select").forEach(sel => {
      sel.onchange = () => {
        setStatus(Number(sel.dataset.id), sel.value);
      };
    });
  }

  function closeRoadmap() {
    const overlay = document.getElementById("jolly-roadmap-overlay");
    if (overlay) overlay.remove();
  }

  function show() {
    buildStyles();
    let overlay = document.getElementById("jolly-roadmap-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "jolly-roadmap-overlay";
    overlay.innerHTML = `<div id="jolly-roadmap-panel" data-filter="Hamısı"></div>`;
    overlay.onclick = (e) => { if (e.target === overlay) closeRoadmap(); };
    document.body.appendChild(overlay);
    render();
  }

  // ------------------------------------------------------------------------
  // 5) PUBLİK METODLAR
  // ------------------------------------------------------------------------
  function setStatus(id, status) {
    const idea = ideas.find(i => i.id === id);
    if (!idea) {
      console.warn(`[JollyRoadmap] #${id} tapılmadı`);
      return;
    }
    if (!STATUS_META[status]) {
      console.warn(`[JollyRoadmap] Naməlum status: ${status}`);
      return;
    }
    idea.status = status;
    saveIdeas(ideas);
    render();
  }

  function addIdea(title, category, desc) {
    const nextId = ideas.length ? Math.max(...ideas.map(i => i.id)) + 1 : 1;
    ideas.push({
      id: nextId,
      title: title || "Adsız fikir",
      desc: desc || "",
      category: category || "Digər",
      status: "pending"
    });
    saveIdeas(ideas);
    render();
    return nextId;
  }

  function getIdeas() {
    return JSON.parse(JSON.stringify(ideas));
  }

  function resetToDefault() {
    ideas = JSON.parse(JSON.stringify(DEFAULT_IDEAS));
    saveIdeas(ideas);
    render();
  }

  // ------------------------------------------------------------------------
  // 6) MODULE REGISTRY-YƏ SELF-REGISTER
  // ------------------------------------------------------------------------
  const JollyRoadmap = {
    id: "roadmap",
    name: "Gələcək Fikirlər",
    version: "1.0.0",
    show,
    setStatus,
    addIdea,
    getIdeas,
    resetToDefault
  };

  window.JollyRoadmap = JollyRoadmap;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyRoadmap);
    console.log("[JollyRoadmap] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyRoadmap] ModuleRegistry tapılmadı, JollyRoadmap qlobal olaraq mövcuddur (window.JollyRoadmap.show()).");
  }

  // FAB silindi — indi bütün alətlər vahid "🧰 Alətlər" menyusunda (tools-menu.js)
})();
