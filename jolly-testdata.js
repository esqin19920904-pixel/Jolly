/* ============================================================
   JOLLY Sınaq Rejimi — saxta məhsullarla yoxlama
   Yeni funksiyanı sınamaq üçün Zülfiqarı və ya əsl malı
   gözləməyə ehtiyac yoxdur. Bu ekran qəsdən "problemli"
   saxta məhsullar yaradır: barkodsuz, şəkilsiz, qiymətsiz,
   bir rəqəm fərqli oxşar barkodlu, qeyri-standart uzunluqlu.

   Hamısı "SINAQ —" ilə başlayır və ayrıca siyahıda izlənir,
   ona görə bir düymə ilə tam təmizlənir (Səbətdən də silinir).

   Marşrut: #/testdata  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollyTestData = (() => {
  const KEY = 'jolly_testdata_ids';
  const GEN_KEY = 'jolly_barcode_folder_generated';
  const PREFIX = 'SINAQ — ';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _ids() { return JollyDB.read(KEY, { products: [], barcodes: [] }) || { products: [], barcodes: [] }; }
  function _saveIds(v) { JollyDB.write(KEY, v); }

  /* Nümunə məhsullar — hər biri konkret bir funksiyanı yoxlamaq üçün */
  function _blueprint() {
    const base = Date.now().toString().slice(-6);
    return [
      // Doktor: bir rəqəm fərqli oxşar barkodlar
      { name: 'Daraq 656 no', barcodes: ['757533330044'], price: 3.2, group: 'Daraq', why: 'Oxşar barkod cütü (Doktor)' },
      { name: 'Daraq 700 no', barcodes: ['7575333300444'], price: 3.2, group: 'Daraq', why: 'Oxşar barkod cütü (Doktor)' },
      // Doktor: qeyri-standart uzunluq
      { name: 'Saç sancağı 12-li', barcodes: ['86976431205'], price: 1.5, group: 'Sancaq', why: 'Uzunluq standart deyil (11 rəqəm)' },
      // Fix Mode: barkodsuz
      { name: 'Şampun Dove 400ml', barcodes: [], price: 8.5, group: 'Şampun', why: 'Barkodsuz (Fix Mode)' },
      { name: 'Duş jeli Palmolive', barcodes: [], price: 6.0, group: 'Şampun', why: 'Barkodsuz (Fix Mode)' },
      // Fix Mode: qiymətsiz
      { name: 'Dırnaq yağı güllü', barcodes: ['48200' + base + '1'], price: null, group: 'Dırnaq', why: 'Qiymətsiz (Fix Mode)' },
      { name: 'Dırnaq əti üçün yağ', barcodes: ['48200' + base + '2'], price: null, group: 'Dırnaq', why: 'Qiymətsiz (Fix Mode)' },
      // Fix Mode: adsız
      { name: '', barcodes: ['48200' + base + '3'], price: 4.0, group: 'Dırnaq', why: 'Adsız (Fix Mode)' },
      // Qrup təklifi: eyni sözlü üçüncü mal
      { name: 'Daraq 812 no', barcodes: ['48200' + base + '4'], price: 3.5, group: '', why: 'Qrup təklifi üçün (qrupu boşdur)' },
      // Axtarış: azərbaycan hərfləri
      { name: 'Çorab pambıq 757', barcodes: ['48200' + base + '5'], price: 2.0, group: 'Çorab', why: 'Hərf axtarışı ("corab" yazıb tap)' },
      { name: 'Çorab uşaq 900', barcodes: ['48200' + base + '6'], price: 2.5, group: 'Çorab', why: 'Hərf axtarışı' },
      // Barkod parça axtarışı: içində 3333 keçən
      { name: 'Krem əl üçün', barcodes: ['4870' + '3333' + base.slice(0, 3)], price: 5.0, group: 'Krem', why: 'Rəqəm-parça axtarışı ("3333")' },
    ];
  }

  /* Barkod Qovluğunda gözləyən saxta kodlar (skanda tapılmayan kimi) */
  function _pendingBlueprint() {
    const base = Date.now().toString().slice(-5);
    return [
      { code: '99900' + base + '1', label: '' },
      { code: '99900' + base + '2', label: '' },
      { code: '5449000000996', label: '' },   // real bir kod — onlayn axtarışı yoxlamaq üçün
    ];
  }

  function generate() {
    if (typeof JollyDB === 'undefined') return;
    const cur = _ids();
    if (cur.products.length) {
      if (!confirm(`Artıq ${cur.products.length} sınaq məhsulu var.\n\nÜstünə yenisi əlavə olunsun?`)) return;
    } else {
      if (!confirm('12 saxta məhsul və 3 gözləyən barkod yaradılacaq.\n\nHamısı "SINAQ —" ilə başlayacaq və bir düymə ilə tam silinə bilər.\n\nDavam edim?')) return;
    }

    const madeP = [];
    _blueprint().forEach(b => {
      try {
        const rec = JollyDB.Products.add({
          name: b.name ? PREFIX + b.name : '',
          barcodes: b.barcodes || [],
          images: [],
          price: b.price,
          group: b.group || '',
          note: 'Sınaq məlumatı — ' + b.why
        });
        if (rec && rec.id) madeP.push(rec.id);
      } catch (e) { console.error('[TestData]', e); }
    });

    const madeB = [];
    try {
      const list = JollyDB.read(GEN_KEY, []) || [];
      _pendingBlueprint().forEach(b => {
        const id = 'bcg_test_' + Math.random().toString(36).slice(2, 8);
        list.unshift({ id, code: b.code, label: '', source: 'scan', createdAt: Date.now(), _test: true });
        madeB.push(id);
      });
      JollyDB.write(GEN_KEY, list);
    } catch (e) { console.error('[TestData]', e); }

    _saveIds({ products: cur.products.concat(madeP), barcodes: cur.barcodes.concat(madeB) });
    if (typeof JollySound !== 'undefined') JollySound.success();
    if (typeof Toast !== 'undefined') Toast.success(`${madeP.length} məhsul, ${madeB.length} barkod yaradıldı`);
    refresh();
  }

  function cleanup() {
    const cur = _ids();
    const n = cur.products.length + cur.barcodes.length;
    if (!n) { if (typeof Toast !== 'undefined') Toast.error('Silinəcək sınaq məlumatı yoxdur'); return; }
    if (!confirm(`${cur.products.length} sınaq məhsulu və ${cur.barcodes.length} sınaq barkodu tamamilə silinəcək.\n\nƏsl məhsullarına TOXUNULMUR.\n\nDavam edim?`)) return;

    let removed = 0;
    cur.products.forEach(id => {
      try {
        if (JollyDB.Products.get(id)) { JollyDB.Products.remove(id); removed++; }
        if (JollyDB.Trash && JollyDB.Trash.purge) JollyDB.Trash.purge(id);   // Səbətdə də qalmasın
      } catch (e) {}
    });

    try {
      const list = JollyDB.read(GEN_KEY, []) || [];
      JollyDB.write(GEN_KEY, list.filter(g => !cur.barcodes.includes(g.id) && !g._test));
    } catch (e) {}

    _saveIds({ products: [], barcodes: [] });
    if (typeof Toast !== 'undefined') Toast.success(`${removed} sınaq məhsulu silindi`);
    refresh();
  }

  function render() {
    const cur = _ids();
    const live = cur.products.filter(id => { try { return !!JollyDB.Products.get(id); } catch (e) { return false; } }).length;

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🧪 Sınaq Rejimi</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Yeni funksiyaları əsl mala toxunmadan yoxla.</p>

      ${live ? `
        <div class="glass" style="padding:14px;margin-bottom:12px;border-left:3px solid #ffc86b;">
          <div style="font-size:13.5px;font-weight:700;">🧪 ${live} sınaq məhsulu kataloqdadır</div>
          <div class="muted" style="font-size:11.5px;margin-top:4px;">Hamısı <b>"SINAQ —"</b> ilə başlayır. İşin bitəndə aşağıdan təmizlə.</div>
        </div>` : ''}

      <div class="section-title">Nə yaradılır</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:12px;">
        ${[
          ['🩺 Doktor', 'bir rəqəm fərqli iki barkod + 11 rəqəmli kod'],
          ['⚡ Fix Mode', '2 barkodsuz, 2 qiymətsiz, 1 adsız məhsul'],
          ['📦 Qrup təklifi', '"Daraq" adlı üçüncü mal, qrupu boş'],
          ['🔍 Axtarış', '"Çorab" (hərf yoxlaması) və içində 3333 keçən barkod'],
          ['🏷️ Barkod Qovluğu', '3 gözləyən kod — biri real, onlayn axtarışı yoxlamaq üçün'],
        ].map(([a, b]) => `
          <div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <div style="font-size:12.5px;font-weight:600;">${a}</div>
            <div class="muted" style="font-size:11.5px;margin-top:2px;">${b}</div>
          </div>`).join('')}
      </div>

      <button class="btn btn-primary btn-block" onclick="JollyTestData.generate()">🧪 Sınaq məlumatı yarat</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;border-color:rgba(255,92,108,.45);color:#ff5c6c;" onclick="JollyTestData.cleanup()">🗑️ Sınaq məlumatını tam sil</button>

      <div class="glass" style="padding:12px;margin-top:12px;font-size:11.5px;line-height:1.6;" >
        <b>Diqqət:</b> saxta məhsullar əsl kataloqa yazılır (ayrı baza yoxdur), amma hamısı izlənir və "tam sil" onları Səbətdən də təmizləyir.
        Buludla sinxronlaşma açıqdırsa, Zülfiqarın cihazında da görünəcəklər — işin bitəndə silməyi unutma.
      </div>
    `;
  }

  function refresh() {
    const main = document.getElementById('main');
    if (main) { main.innerHTML = render(); window.scrollTo(0, 0); }
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'testdata',
      perm: 'tools.testdata',
      name: 'Sınaq Rejimi',
      icon: '🧪',
      route: '#/testdata',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
    });
  }

  return { render, refresh, generate, cleanup };
})();
