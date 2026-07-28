/* ============================================================
   JOLLY Bələdçi — hansı alət nə üçündür
   İki günə 10-dan çox yeni ekran əlavə olundu. Onların harada
   olduğunu və nə vaxt lazım olduğunu yadda saxlamaq çətindir.
   Bu ekran hamısını bir yerə yığır: nə üçündür, nə vaxt aç,
   birbaşa keçid düyməsi ilə.

   Marşrut: #/guide  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollyGuide = (() => {

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* Gündəlik iş axını — sıra ilə oxunur */
  const ROUTINE = [
    { t: 'Səhər', d: 'Gün xülasəsi özü açılır — dünən nə oldu, bu gün nə gözləyir.' },
    { t: 'Gün ərzində', d: 'Kassada tanınmayan kod skan edilsə, avtomatik Barkod Qovluğuna düşür. Sən heç nə etmirsən.' },
    { t: 'Axşam', d: 'Barkod Qovluğu → "Hamısı" → "🌐 Adları tap" → "➕ Məhsula çevir". Sonra Fix Mode-da şəkillərini çək.' },
    { t: 'Həftədə bir', d: 'Data Doctor ilə səhv barkodları təmizlə, Sağlamlıq Hesabatına bax, backup çıxar.' },
  ];

  const TOOLS = [
    {
      icon: '🏷️', name: 'Barkod Qovluğu', route: '#/barcode-folder',
      what: 'Bütün barkodlar bir ekranda + tapılmayan kodları yaratmaq',
      when: 'Barkod axtaranda; axşam gün ərzində yığılan naməlum kodları tamamlayanda',
      tip: 'Rəqəm yaz — varsa tapır, yoxdursa özü yaradır. Toplu seçib adları internetdən tapa bilərsən.'
    },
    {
      icon: '⚡', name: 'Bu gün 10 mal', route: '#/fixmode',
      what: 'Tamamlanmamış malları bir-bir, hər dəfə bir sualla bitirmək',
      when: 'Boş 10 dəqiqən olanda',
      tip: 'Yalnız çatışmayan sahə soruşulur. Barkodun adını internet özü təklif edir.'
    },
    {
      icon: '🩺', name: 'Data Doctor', route: '#/data-doctor',
      what: 'Səhv və oxşar barkodları tapmaq',
      when: 'Həftədə bir; skaner bir malı oxumayanda',
      tip: 'Bir rəqəm fərqli cütləri özü tapır. "Kodu düzəlt" və "Birləşdir" yerindəcə işləyir.'
    },
    {
      icon: '📈', name: 'Sağlamlıq Hesabatı', route: '#/health-report',
      what: 'Kataloqun vəziyyəti və 7 günlük irəliləyiş qrafiki',
      when: 'Həftədə bir — irəliləyirsənmi, görmək üçün',
      tip: 'Rəqəmə baxıb dayanma — altdakı düymə birbaşa işə aparır.'
    },
    {
      icon: '📥', name: 'Barkod İdxalı', route: '#/import',
      what: '1C və ya Excel faylından minlərlə barkodu birdən gətirmək',
      when: 'Mühasibat faylı yeniləndikcə',
      tip: 'Əvvəl backup çıxar, sonra 10-20 sətirlik kiçik hissə ilə sına. Səhv olsa "geri al" var.'
    },
    {
      icon: '📊', name: 'Cədvəl Körpüsü', route: '#/sheet',
      what: 'Kataloqu cədvələ çıxarıb kompüterdə redaktə etmək',
      when: 'Yüzlərlə sətri düzəltmək lazım olanda',
      tip: 'id sütununa toxunma — onsuz geri qayıdanda kataloq ikiləşər.'
    },
    {
      icon: '🎯', name: 'Skan Maratonu', route: '#/scan-marathon',
      what: 'Rəfin qarşısında ardıcıl skan edərək barkodları bağlamaq',
      when: 'Anbarda və ya rəfdə işləyəndə',
      tip: 'Telefonu əlində saxla, dayanmadan skan et.'
    },
    {
      icon: '📜', name: 'Barkod Jurnalı', route: '#/barcode-log',
      what: 'Kim nə vaxt hansı barkodu dəyişdi',
      when: '"Bu kod niyə belə oldu?" sualı yarananda',
      tip: 'Məhsulun öz səhifəsində də "🕐 Dəyişikliklər" bölməsi var.'
    },
    {
      icon: '🗺️', name: 'Rəf Xəritəsi', route: '#/store-map',
      what: 'Mağazanın planı — hansı mal hansı rəfdə',
      when: 'Malı axtaranda; rəfləri yenidən düzəndə',
      tip: 'Redaktə rejimində rəfi barmaqla sürüklə, küncdəki ◢ ilə ölçüsünü dəyiş.'
    },
    {
      icon: '🩻', name: 'JOLLY Yoxlama', route: '#/selftest',
      what: 'Hansı fayl yüklənib, hansı xəta baş verib',
      when: 'Nəsə işləməyəndə — BİRİNCİ bura bax',
      tip: '"📋 Hesabatı kopyala" ilə vəziyyəti mətn kimi göndərə bilərsən.'
    },
    {
      icon: '🧪', name: 'Sınaq Rejimi', route: '#/testdata',
      what: 'Saxta məhsullarla yoxlamaq',
      when: 'Yeni funksiyanı əsl mala toxunmadan sınamaq istəyəndə',
      tip: 'İşin bitəndə "tam sil" basmağı unutma.'
    },
  ];

  function render() {
    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🧭 Bələdçi</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Hansı alət nə üçündür və nə vaxt açmaq lazımdır.</p>

      <div class="section-title">📅 Gündəlik axın</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        ${ROUTINE.map(r => `
          <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <div style="font-size:12.5px;font-weight:700;color:var(--accent-1);">${esc(r.t)}</div>
            <div class="muted" style="font-size:12px;margin-top:3px;line-height:1.5;">${esc(r.d)}</div>
          </div>`).join('')}
      </div>

      <div class="section-title">🧰 Alətlər</div>
      ${TOOLS.map(t => `
        <div class="glass" style="padding:13px;margin-bottom:9px;">
          <div style="display:flex;align-items:center;gap:9px;">
            <span style="font-size:19px;">${t.icon}</span>
            <span style="flex:1;font-size:14px;font-weight:700;">${esc(t.name)}</span>
          </div>
          <div style="font-size:12.5px;margin-top:7px;">${esc(t.what)}</div>
          <div class="muted" style="font-size:11.5px;margin-top:5px;line-height:1.5;">
            <b>Nə vaxt:</b> ${esc(t.when)}<br>
            <b>Məsləhət:</b> ${esc(t.tip)}
          </div>
          <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:9px;" onclick="JollyRouter.go('${t.route}')">Aç →</button>
        </div>`).join('')}

      <div class="glass" style="padding:13px;margin-top:6px;font-size:12px;line-height:1.6;">
        <b>Bir qayda:</b> nəsə gözlədiyin kimi işləməsə, əvvəl <b>🩻 JOLLY Yoxlama</b>ya bax.
        Problemlərin çoxu faylın yüklənməməsindən və ya köhnə keşdən olur — orada hər ikisi görünür və düzəltmə düyməsi var.
      </div>
    `;
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'guide',
      perm: 'tools.guide',
      name: 'Bələdçi',
      icon: '🧭',
      route: '#/guide',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
    });
  }

  return { render };
})();
