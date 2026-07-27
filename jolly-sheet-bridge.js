/* ============================================================
   JOLLY Cədvəl Körpüsü — kataloqu cədvəldə redaktə et
   Telefonda 500 sətri düzəltmək əzabdır, cədvəldə 10 dəqiqəlik işdir.

   Axın:
   1) Burada CSV çıxarırsan (hər sətirdə gizli ID sütunu olur)
   2) Google Sheets / Excel-də açıb rahat redaktə edirsən
   3) Yenidən CSV kimi saxlayıb "📥 Barkod İdxalı"na yükləyirsən
   4) İdxal ID-yə görə tanıyır və həmin məhsulu YENİLƏYİR

   ID sütununu silmə — onsuz sətir yeni məhsul kimi qəbul olunur.
   Marşrut: #/sheet  (ModuleRegistry vasitəsilə)
   ============================================================ */
const JollySheetBridge = (() => {
  const COLS = ['id', 'ad', 'barkod', 'qiymet', 'qrup', 'firma', 'yer', 'qeyd'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _cell(v) {
    const s = String(v == null ? '' : v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function _rowsFor(scope) {
    let list = JollyDB.Products.all()
      .filter(p => !JollyDB.isMarkedForDeletion || !JollyDB.isMarkedForDeletion(p.id));
    if (scope === 'incomplete') {
      list = list.filter(p =>
        !p.name || !p.name.trim() ||
        !(p.barcodes || []).length ||
        p.price == null || p.price === ''
      );
    } else if (scope === 'nobarcode') {
      list = list.filter(p => !(p.barcodes || []).length);
    }
    return list;
  }

  function buildCsv(scope) {
    const list = _rowsFor(scope);
    const lines = [COLS.join(';')];
    list.forEach(p => {
      lines.push([
        p.id,
        p.name || '',
        (p.barcodes || [])[0] || '',
        p.price != null ? p.price : '',
        p.group || '',
        p.brand || '',
        p.location || '',
        p.note || ''
      ].map(_cell).join(';'));
    });
    return { csv: lines.join('\n'), count: list.length };
  }

  function download(scope) {
    const { csv, count } = buildCsv(scope);
    if (!count) { if (typeof Toast !== 'undefined') Toast.error('Bu seçimdə məhsul yoxdur'); return; }
    // BOM — Excel Azərbaycan hərflərini düzgün açsın
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jolly-kataloq-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    if (typeof Toast !== 'undefined') Toast.success(count + ' sətir çıxarıldı');
  }

  function render() {
    const all = _rowsFor('all').length;
    const inc = _rowsFor('incomplete').length;
    const nob = _rowsFor('nobarcode').length;

    const btn = (scope, label, n, note) => `
      <div class="glass" style="padding:12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="flex:1;">
            <div style="font-size:13.5px;font-weight:600;">${label}</div>
            <div class="muted" style="font-size:11.5px;margin-top:2px;">${note}</div>
          </div>
          <span style="font-size:17px;font-weight:800;color:var(--accent-1);">${n}</span>
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;" onclick="JollySheetBridge.download('${scope}')">⬇️ CSV çıxar</button>
      </div>`;

    return `
      <div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">📊 Cədvəl Körpüsü</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Kataloqu cədvələ çıxar, kompüterdə rahat redaktə et, geri qaytar.</p>

      <div class="section-title">1. Nəyi çıxaraq?</div>
      ${btn('all', 'Bütün kataloq', all, 'Hər şey — ad, barkod, qiymət, qrup, firma, yer, qeyd')}
      ${btn('incomplete', 'Yalnız tamamlanmamışlar', inc, 'Adı, barkodu və ya qiyməti çatmayanlar')}
      ${btn('nobarcode', 'Yalnız barkodsuzlar', nob, 'Barkod sütununu cədvəldə doldurmaq üçün')}

      <div class="section-title">2. Necə işləyir</div>
      <div class="glass" style="padding:14px;font-size:12.5px;line-height:1.7;">
        <div style="margin-bottom:8px;"><b>1.</b> CSV-ni çıxar və Google Sheets-də aç (Fayl → İdxal et → Yüklə).</div>
        <div style="margin-bottom:8px;"><b>2.</b> Sütunları rahat doldur. Klaviatura ilə 500 sətir 10 dəqiqədir.</div>
        <div style="margin-bottom:8px;"><b>3.</b> Fayl → Yüklə → <b>CSV</b> seç.</div>
        <div style="margin-bottom:8px;"><b>4.</b> JOLLY-də <b>📥 Barkod İdxalı</b>na gir və həmin faylı yüklə.</div>
        <div><b>5.</b> İdxal <b>id</b> sütununa baxıb həmin məhsulu tapır və yeniləyir.</div>
      </div>

      <div class="glass" style="padding:12px;margin-top:12px;border-left:3px solid #ffc86b;font-size:12.5px;line-height:1.6;">
        <b>Vacib:</b> <span class="mono">id</span> sütununa toxunma və silmə. O olmasa, hər sətir yeni məhsul kimi qəbul olunacaq və kataloq ikiləşəcək.
        Sətri tam silsən, məhsul JOLLY-dən silinmir — sadəcə yenilənmir.
      </div>

      <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="JollyRouter.go('#/import')">📥 İdxal ekranına keç</button>
    `;
  }

  if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register({
      id: 'sheet',
      name: 'Cədvəl Körpüsü',
      icon: '📊',
      route: '#/sheet',
      group: 'Alətlər',
      enabled: true,
      render() { return render(); },
    });
  }

  return { render, download, buildCsv };
})();
