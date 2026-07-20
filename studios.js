/* ============================================================
   JOLLY Studios — bütün Studio-ların mərkəzi

   YENİLİK: renderHome() indi "JOLLY Store" görünüşündədir —
   1) Statik Studio-lar (əvvəlki kimi) kateqoriyalara bölünüb
   2) ModuleRegistry-ə qeydiyyatdan keçən HƏR modul (Qəbul Studio,
      Skan ilə Qəbul, Sürətli Menyu və s.) AVTOMATİK burada görünür
      — aç/bağla (toggle) düyməsi ilə birlikdə.
   Bundan sonra yeni modul əlavə edəndə heç bir başqa fayla (dashboard.js
   və s.) toxunmağa ehtiyac qalmır, ModuleRegistry.register() kifayətdir.
   ============================================================ */

const JollyStudios = (() => {
  const LIST = [
    { key: 'brain', icon: '🧠', title: 'AI Brain', sub: 'Sistemin ağlı', ready: true, route: '#/brain' },
    { key: 'admin', icon: '🛠️', title: 'Admin Studio', sub: 'Firma, Qrup, Yer, Status', ready: true },
    { key: 'ai', icon: '🤖', title: 'AI Studio', sub: 'JOLLY AI köməkçisi', ready: true },
    { key: 'module', icon: '🧩', title: 'Modul Studio', sub: 'Göstər / gizlət / sırala', ready: true },
    { key: 'theme', icon: '🎨', title: 'Theme Studio', sub: 'Görünüş və rənglər', ready: true },
    { key: 'data', icon: '💾', title: 'Backup Mərkəzi', sub: 'JSON, Drive, Cloud, CSV — hamısı bir yerdə', ready: true },
    { key: 'cloud', icon: '☁️', title: 'Cloud Studio', sub: 'Firebase sinxron', ready: true },
    { key: 'security', icon: '🔐', title: 'Security Studio', sub: 'PIN, giriş qorunması', ready: true },
    { key: 'report', icon: '📊', title: 'Report Studio', sub: 'Statistika və hesabatlar', ready: true },
    { key: 'code', icon: '⌨️', title: 'Code Studio', sub: 'Sahə/funksiya əlavə et', ready: true },
    { key: 'workflow', icon: '⚡', title: 'Workflow Studio', sub: 'Avtomatlaşdırma qaydaları', ready: true },
    { key: 'voicevision', icon: '👁️', title: 'Voice & Vision Studio', sub: 'Səs, kamera, OCR', ready: true },
    { key: 'notification', icon: '🔔', title: 'Bildiriş Studio', sub: 'Xəbərdarlıq mərkəzi', ready: true },
    { key: 'print', icon: '🖨️', title: 'Print / Export Studio', sub: 'Barkod Print Center', ready: true },
    { key: 'integration', icon: '🔗', title: 'İnteqrasiyalar', sub: 'Backup Mərkəzinə keçir', ready: true, route: '#/studios/data' },
    { key: 'updates', icon: '🔄', title: 'Yeniləmələr', sub: 'İçəridən yeni funksiya al', ready: true, route: '#/updates' },
    { key: 'analytics', icon: '🔮', title: 'Analytics Studio', sub: 'Proqnoz və anomaliya', ready: true },
  ];

  // JOLLY Store-da statik Studio-ları qruplaşdırmaq üçün kateqoriya xəritəsi.
  // Yalnız görünüş qruplaşdırmasıdır — LIST-in özünə toxunmur.
  const STORE_CATEGORIES = [
    { label: '🛠️ Əsas İdarəetmə', keys: ['admin', 'module', 'theme', 'security', 'code'] },
    { label: '💾 Backup & Bulud', keys: ['data', 'cloud'] },
    { label: '🧠 AI & Avtomatlaşdırma', keys: ['brain', 'ai', 'workflow'] },
    { label: '📊 Analitika', keys: ['report', 'analytics'] },
    { label: '👁️ Görüntü & Səs', keys: ['voicevision'] },
    { label: '🖨️ Çap & İnteqrasiya', keys: ['print', 'integration'] },
    { label: '🔔 Digər', keys: ['notification', 'updates'] },
  ];

  function storeCardHtml(s) {
    return `
      <div class="glass studio-card" onclick="JollyRouter.go('${s.route || '#/studios/' + s.key}')" style="${s.ready ? '' : 'opacity:.6;'}">
        <div class="ic">${s.icon}</div>
        <div class="title">${s.title}</div>
        <div class="sub">${s.sub}${s.ready ? '' : ' · tezliklə'}</div>
      </div>
    `;
  }

  function renderHome() {
    const staticSections = STORE_CATEGORIES.map(cat => {
      const items = cat.keys.map(k => LIST.find(x => x.key === k)).filter(Boolean);
      if (!items.length) return '';
      return `
        <div class="section-title" style="margin-top:16px;">${cat.label}</div>
        <div class="studio-grid">${items.map(storeCardHtml).join('')}</div>
      `;
    }).join('');

    // ── Dinamik modullar (ModuleRegistry) — Qəbul Studio, Skan ilə Qəbul,
    // Sürətli Menyu Studio və gələcəkdə əlavə olunan HƏR yeni modul burada
    // avtomatik görünür, aç/bağla düyməsi ilə. ──
    let dynamicSections = '';
    if (typeof ModuleRegistry !== 'undefined') {
      const groups = {};
      ModuleRegistry.list().forEach(m => { (groups[m.group] = groups[m.group] || []).push(m); });
      const groupLabel = (g) => {
        if (g === 'Anbar') return '📦 Anbar Modulları';
        if (g === 'Studio') return '⚡ Sürətli Alətlər';
        return '🧩 ' + g;
      };
      dynamicSections = Object.keys(groups).map(g => `
        <div class="section-title" style="margin-top:16px;">${groupLabel(g)}</div>
        <div class="studio-grid">
          ${groups[g].map(m => `
            <div class="glass studio-card" style="position:relative;${m.enabled ? '' : 'opacity:.5;'}">
              <div onclick="JollyRouter.go('${m.route}')" style="cursor:pointer;">
                <div class="ic">${m.icon}</div>
                <div class="title">${escapeAS(m.name)}</div>
                <div class="sub">${m.enabled ? 'Aktiv' : 'Söndürülüb'}</div>
              </div>
              <label style="position:absolute;top:10px;right:10px;display:flex;align-items:center;" onclick="event.stopPropagation();">
                <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="JollyStudios.toggleModuleReg('${m.id}', this.checked)">
              </label>
            </div>
          `).join('')}
        </div>
      `).join('');
    }

    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:20px;">🏛️ JOLLY Store</h2>
      <p class="muted" style="margin:0 0 16px;font-size:13px;">Bütün modulların idarəetmə mərkəzi — kateqoriya üzrə gəz, aç/bağla.</p>
      ${staticSections}
      ${dynamicSections}
    `;
  }

  function toggleModuleReg(id, on) {
    if (typeof ModuleRegistry === 'undefined') return;
    if (on) ModuleRegistry.enable(id); else ModuleRegistry.disable(id);
    Toast.success(on ? 'Modul aktivləşdirildi' : 'Modul söndürüldü');
    // Eyni hash-ə göndərmək hashchange tetiklənmir — bir anlıq başqa
    // hash-ə keçib dərhal geri qayıdıb məcburi yenidən render edirik.
    window.location.hash = '#/dashboard';
    setTimeout(() => { window.location.hash = '#/studios'; }, 30);
  }

  function renderComingSoon(key) {
    if (key === 'notification') { setTimeout(() => JollyRouter.go('#/notifications'), 0); return ''; }
    if (key === 'voicevision') return renderVoiceVision();
    if (key === 'integration') return renderIntegration();
    if (key === 'analytics') return renderAnalyticsStudio();
    if (key === 'print') return renderPrintCenter();
    if (key === 'ai-brain') { setTimeout(() => { if (typeof JollyAIStudio !== 'undefined') { const m = document.getElementById('main'); if (m) m.innerHTML = JollyAIStudio.render(); } }, 0); return ''; }
    setTimeout(() => JollyRouter.go('#/studios'), 0);
    return `<div class="empty-state"><div class="big-icon">🏛️</div><h3>Studios açılır...</h3></div>`;
  }

  function renderVoiceVision() {
    const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">👁️ Voice & Vision Studio</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 16px;">Kamera və səs əsaslı bütün alətlər bir yerdə.</p>
      <div class="studio-grid">
        <div class="glass studio-card" onclick="${typeof JollyLiveLens !== 'undefined' ? 'JollyLiveLens.open()' : "Toast.error('Live Lens yüklənməyib')"}" style="border-color:rgba(41,224,201,0.4);">
          <div class="ic">📡</div><div class="title">Live Lens</div><div class="sub">Canlı kamera tanıma</div>
        </div>
        <div class="glass studio-card" onclick="${hasCamera ? "JollyStudios.startVisualSearchFromStudio()" : "Toast.error('Bu cihazda kamera dəstəklənmir')"}">
          <div class="ic">📷</div><div class="title">Visual Search</div><div class="sub">Şəkillə məhsul tap</div>
        </div>
        <div class="glass studio-card" onclick="${hasCamera ? "JollyProducts.scanSearch()" : "Toast.error('Bu cihazda kamera dəstəklənmir')"}">
          <div class="ic">🧾</div><div class="title">Barkod skan</div><div class="sub">Kamera ilə oxu</div>
        </div>
        <div class="glass studio-card" onclick="${hasCamera && typeof JollyOCR !== 'undefined' ? "JollyStudios.runOcr()" : "Toast.error('OCR bu cihazda mövcud deyil')"}">
          <div class="ic">📝</div><div class="title">OCR</div><div class="sub">Yazını oxu</div>
        </div>
        <div class="glass studio-card" onclick="${hasSpeech ? "JollyProducts.voiceSearch()" : "Toast.error('Bu cihazda səsli axtarış dəstəklənmir')"}">
          <div class="ic">🎙️</div><div class="title">Səsli axtarış</div><div class="sub">${hasSpeech ? 'Danış, axtar' : 'Dəstəklənmir'}</div>
        </div>
      </div>
      ${(!hasCamera || !hasSpeech) ? `<p class="muted" style="font-size:11.5px;margin-top:12px;">${!hasCamera ? '⚠️ Kamera icazəsi/dəstəyi yoxdur. ' : ''}${!hasSpeech ? '⚠️ Bu brauzerdə səsli tanıma yoxdur.' : ''}</p>` : ''}
    `;
  }

  function runOcr() {
    if (typeof JollyOCR === 'undefined') { Toast.error('OCR modulu yoxdur'); return; }
    JollyOCR.captureAndRead((text) => {
      if (!text) { Toast.error('Mətn tapılmadı'); return; }
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); Toast.success('Mətn tapıldı və kopyalandı: ' + text.slice(0, 40)); } catch (e) { Toast.success('Tapıldı: ' + text.slice(0, 60)); }
      ta.remove();
    });
  }

  function startVisualSearchFromStudio() {
    if (typeof JollyVisualSearch === 'undefined') { Toast.error('Visual Search modulu yüklənməyib'); return; }
    JollyVisualSearch.captureAndSearch((results) => {
      if (typeof JollyChat !== 'undefined' && JollyChat.showVisualResults) {
        JollyRouter.go('#/chat');
        setTimeout(() => JollyChat.showVisualResults(results), 300);
      }
    });
  }

  function renderAnalyticsStudio() {
    const all = JollyDB.Products.all();
    const total = all.length;
    const noImage = all.filter(p => !p.images || !p.images.length).length;
    const noBarcode = all.filter(p => !p.barcodes || !p.barcodes.length).length;
    const noPrice = all.filter(p => p.price == null || p.price === '').length;
    const problem = all.filter(p => (p.status || '').toLowerCase().includes('problem')).length;
    const ready = all.filter(p => (p.images && p.images.length) && (p.barcodes && p.barcodes.length) && p.price != null && p.price !== '').length;
    const incomplete = total - ready;
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const addedToday = all.filter(p => p.createdAt >= today0.getTime()).length;
    const editedRecent = all.slice().filter(p => p.updatedAt).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
    const brandCount = {}, groupCount = {};
    all.forEach(p => { if (p.brand) brandCount[p.brand] = (brandCount[p.brand] || 0) + 1; if (p.group) groupCount[p.group] = (groupCount[p.group] || 0) + 1; });
    const topBrand = Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0];
    const topGroup = Object.entries(groupCount).sort((a, b) => b[1] - a[1])[0];
    let dupCount = 0;
    if (typeof JollyBrain !== 'undefined' && JollyBrain.findDuplicates) {
      try { dupCount = JollyBrain.findDuplicates().length; } catch (e) {}
    }
    const health = total ? Math.round((ready / total) * 100) : 0;

    const stat = (label, val, route) => `<div class="glass studio-card" style="min-height:74px;${route ? 'cursor:pointer;' : ''}" ${route ? `onclick="JollyRouter.go('${route}')"` : ''}><div class="title count-up" style="font-size:19px;">${val}</div><div class="sub">${label}</div></div>`;

    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🔮 Analytics Studio</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Kataloqun tam sağlamlıq mənzərəsi.</p>

      <div class="glass" style="padding:20px 16px;text-align:center;margin-bottom:14px;">
        <div class="health-ring" style="--pct:${health};--ring-color:${health >= 80 ? '#29e0c9' : health >= 50 ? '#f5c563' : '#ff5c6c'};">
          <svg viewBox="0 0 120 120">
            <circle class="hr-bg" cx="60" cy="60" r="52"></circle>
            <circle class="hr-fill" cx="60" cy="60" r="52"></circle>
          </svg>
          <div class="hr-center">
            <div class="hr-num" style="color:${health >= 80 ? '#29e0c9' : health >= 50 ? '#f5c563' : '#ff5c6c'};">${health}<span style="font-size:16px;">%</span></div>
            <div class="hr-label">sağlam</div>
          </div>
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px;">Kataloq sağlamlığı · ${ready}/${total} kassaya hazır</div>
      </div>

      <div class="studio-grid">
        ${stat('Ümumi məhsul', total, '#/products')}
        ${stat('Kassaya hazır', ready)}
        ${stat('Yarımçıq', incomplete, '#/data-doctor')}
        ${stat('Şəkilsiz', noImage, '#/products?filter=sekilsiz')}
        ${stat('Barkodsuz', noBarcode, '#/products?filter=barkodsuz')}
        ${stat('Qiymətsiz', noPrice)}
        ${stat('Problemli', problem, '#/products?filter=problemli')}
        ${stat('Dublikat qrupu', dupCount, '#/brain/duplicates')}
        ${stat('Bugün əlavə', addedToday)}
      </div>

      <div class="section-title">Ən çox firma / qrup</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="color-card cc-purple" ${topBrand ? `onclick="JollyRouter.go('#/products')"` : ''}>
          <div class="cc-icon">🏭</div>
          <div><div class="cc-title">${topBrand ? escapeAS(topBrand[0]) : '—'}</div><div class="cc-sub">${topBrand ? topBrand[1] + ' məhsul' : 'firma yoxdur'}</div></div>
        </div>
        <div class="color-card cc-teal" ${topGroup ? `onclick="JollyRouter.go('#/products')"` : ''}>
          <div class="cc-icon">📦</div>
          <div><div class="cc-title">${topGroup ? escapeAS(topGroup[0]) : '—'}</div><div class="cc-sub">${topGroup ? topGroup[1] + ' məhsul' : 'qrup yoxdur'}</div></div>
        </div>
      </div>

      <div class="section-title">Son redaktə olunanlar</div>
      <div class="glass" style="padding:4px 14px;">
        ${editedRecent.length ? editedRecent.map(p => `<div class="list-row" onclick="JollyRouter.go('#/product/${p.id}')" style="cursor:pointer;"><span>${escapeAS(p.name || 'Adsız')}</span><span class="muted" style="font-size:11px;">${new Date(p.updatedAt).toLocaleDateString('az-AZ')}</span></div>`).join('') : '<div class="muted" style="padding:12px;">Məlumat yoxdur</div>'}
      </div>

      <div class="row" style="margin-top:14px;">
        <button class="btn btn-ghost btn-block" onclick="JollyRouter.go('#/data-doctor')">🩺 Data Doctor ilə tam yoxla</button>
      </div>
    `;
  }
  function escapeAS(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s)); }

  function renderIntegration() {
    // Bütün məzmun Backup Mərkəzinə (renderData) köçürülüb — köhnə link qırılmasın deyə yönləndirir.
    setTimeout(() => JollyRouter.go('#/studios/data'), 0);
    return `<div class="empty-state"><div class="big-icon">💾</div><h3>Backup Mərkəzinə yönləndirilir...</h3></div>`;
  }

  function loadStorageEstimate() {
    const el = document.getElementById('storageEstimate');
    if (!el) return;
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(est => {
        const usedMB = (est.usage / 1048576).toFixed(1);
        const quotaMB = (est.quota / 1048576).toFixed(0);
        const pct = est.quota ? Math.round(est.usage / est.quota * 100) : 0;
        el.innerHTML = `💾 İstifadə olunan yaddaş: <b>${usedMB} MB</b> / ${quotaMB} MB (${pct}%)`;
      }).catch(() => { el.textContent = 'Yaddaş məlumatı əlçatan deyil'; });
    } else {
      el.textContent = 'Bu brauzer yaddaş statistikasını dəstəkləmir';
    }
  }

  function loadPersistStatus() {
    const el = document.getElementById('persistStatusZone');
    if (!el || typeof JollyStorage === 'undefined' || !JollyStorage.isPersisted) { if (el) el.textContent = 'Modul yüklənməyib'; return; }
    JollyStorage.isPersisted().then(p => {
      if (!el.isConnected) return;
      if (p === null) { el.textContent = 'Bu brauzer dəstəkləmir'; return; }
      el.innerHTML = p
        ? '🔒 <b style="color:var(--accent-2);">Aktivdir</b> — brauzer bu datanı avtomatik silməyəcək'
        : '⚠️ Hələ aktiv deyil — aşağıdan istə';
    });
  }

  function requestPersist() {
    if (typeof JollyStorage === 'undefined' || !JollyStorage.requestPersistence) { Toast.error('Modul yoxdur'); return; }
    JollyStorage.requestPersistence().then(r => {
      if (!r.supported) { Toast.error('Bu brauzer daimi yaddaşı dəstəkləmir'); return; }
      if (r.granted) Toast.success(r.already ? 'Artıq daimi yaddaş aktivdir ✓' : 'Daimi yaddaş aktivləşdi ✓');
      else Toast.info('Brauzer icazə vermədi — daha çox istifadə etdikcə avtomatik veriləcək');
      loadPersistStatus();
    });
  }

  async function exportAllImages() {
    if (typeof JollyStorage === 'undefined' || !JollyStorage.exportAllImagesToDevice) { Toast.error('Modul yoxdur'); return; }
    const progressEl = document.getElementById('imgExportProgress');
    const total = JollyDB.Products.all().reduce((n, p) => n + (p.images || []).length, 0) + JollyDB.Drafts.all().reduce((n, d) => n + (d.images || []).length, 0);
    if (!total) { Toast.info('Şəkil tapılmadı'); return; }
    Toast.info(`${total} şəkil yüklənir, bir az gözlə...`);
    const result = await JollyStorage.exportAllImagesToDevice((cur, tot) => {
      if (progressEl) progressEl.textContent = `${cur} / ${tot} şəkil yükləndi...`;
    });
    if (progressEl) progressEl.textContent = `✓ ${result} şəkil "Yükləmələr" qovluğuna köçürüldü`;
    Toast.success(`${result} şəkil yükləndi ✓`);
  }

  function toggleWaSetting(key, on) {
    JollyDB.setSettings({ [key]: !!on });
  }

  function renderPrintCenter() {
    const products = JollyDB.Products.all().filter(p => p.barcodes && p.barcodes.length);
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🖨️ Barkod Print Center</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Bir və ya bir neçə məhsulun barkodunu seç, vərəq kimi çap et və ya PNG kimi saxla.</p>

      <div class="row" style="gap:10px;margin-bottom:12px;">
        <span class="chip" onclick="JollyStudios.selectAllPrint(true)">Hamısını seç</span>
        <span class="chip" onclick="JollyStudios.selectAllPrint(false)">Təmizlə</span>
      </div>

      <div class="glass" style="padding:4px 14px;max-height:50vh;overflow-y:auto;">
        ${products.length ? products.map(p => `
          <div class="list-row">
            <label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;">
              <input type="checkbox" class="print-check" value="${p.id}">
              <span>${escapeHtmlPrint(p.name || 'Adsız')} <span class="muted mono" style="font-size:11px;">${escapeHtmlPrint(p.barcodes[0] || '')}</span></span>
            </label>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Barkodlu məhsul yoxdur</div>'}
      </div>

      <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="JollyStudios.printSelectedBarcodes()">🖨️ Seçilənləri çap et</button>
    `;
  }

  function escapeHtmlPrint(s) { return (typeof JollyProducts !== 'undefined' ? JollyProducts.escapeHtml(String(s)) : String(s)); }

  function selectAllPrint(on) {
    document.querySelectorAll('.print-check').forEach(cb => { cb.checked = on; });
  }

  function printSelectedBarcodes() {
    const ids = [...document.querySelectorAll('.print-check:checked')].map(cb => cb.value);
    if (!ids.length) { Toast.error('Heç bir məhsul seçilməyib'); return; }
    const products = ids.map(id => JollyDB.Products.get(id)).filter(Boolean);

    let sheet = document.getElementById('printSheet');
    if (sheet) sheet.remove();
    sheet = document.createElement('div');
    sheet.id = 'printSheet';
    sheet.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:9999;overflow:auto;';
    sheet.innerHTML = `
      <style>
        @media print {
          body > *:not(#printSheet) { display: none !important; }
          #printSheet { position: static !important; }
          .pl-close { display: none !important; }
          .print-label { break-inside: avoid; }
        }
        #printSheet .print-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:70px 20px 20px; }
        #printSheet .print-label { border:1px dashed #999; border-radius:8px; padding:10px; text-align:center; }
        #printSheet .print-label img { max-width:100%; }
        #printSheet .print-label .pl-name { font-weight:700; font-size:13px; margin-bottom:4px; color:#000; font-family:Arial,sans-serif; }
        #printSheet .pl-close { position:fixed; top:14px; right:14px; z-index:2; background:#111;color:#fff;border:none;border-radius:10px;padding:12px 16px;font-size:14px; }
      </style>
      <button class="pl-close" onclick="document.getElementById('printSheet').remove()">✕ Bağla</button>
      <div class="print-grid">
        ${products.map(p => {
          const bc = (p.barcodes || [])[0];
          const url = (bc && typeof JollyBarcodeGen !== 'undefined') ? JollyBarcodeGen.toDataURL(bc, null, { barWidth: 3, height: 120, pad: 14 }) : '';
          return `<div class="print-label"><div class="pl-name">${escapeHtmlPrint(p.name || '')}</div>${url ? `<img src="${url}">` : ''}</div>`;
        }).join('')}
      </div>
    `;
    document.body.appendChild(sheet);
    setTimeout(() => window.print(), 300);
  }

  function exportCsv() {
    const rows = [['ad', 'xususiKod', 'qiymet', 'firma', 'qrup', 'yer', 'barkod']];
    JollyDB.Products.all().forEach(p => {
      rows.push([p.name || '', p.mainCode || '', p.price != null ? p.price : '', p.brand || '', p.group || '', p.location || '', (p.barcodes || [])[0] || '']);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `jolly-mehsullar-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    Toast.success('CSV ixrac olundu');
  }

  function importCsvFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(Boolean);
        const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g);
          if (!cells) continue;
          const vals = cells.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
          const row = {};
          header.forEach((h, idx) => row[h] = vals[idx] || '');
          if (!row.ad) continue;
          JollyDB.Products.add({
            name: row.ad, mainCode: row.xususikod || '', price: row.qiymet ? parseFloat(row.qiymet) : null,
            brand: row.firma || '', group: row.qrup || '', location: row.yer || '',
            barcodes: row.barkod ? [row.barkod] : [], images: [],
          });
          count++;
        }
        Toast.success(`${count} məhsul idxal olundu`);
        JollyApp.render();
      } catch (err) { Toast.error('CSV oxunmadı — format düzgün deyil'); }
    };
    reader.readAsText(file, 'UTF-8');
  }

  const aiHistory = [];

  function renderAI() {
    setTimeout(() => scrollAiBottom(), 0);
    return `
      <div class="row between" style="margin-bottom:12px;">
        <h2 style="font-family:var(--font-display);margin:0;font-size:19px;">🤖 JOLLY AI</h2>
        <span class="chip" onclick="JollyRouter.go('#/chat')">💬 Tam Chat aç</span>
      </div>
      <button class="btn btn-primary btn-block" style="margin-bottom:12px;" onclick="JollyRouter.go('#/studios/ai-brain')">🧠 AI Brain Studio Pro aç</button>
      <div class="ai-panel glass" style="padding:14px;">
        <div class="ai-messages" id="aiMessages">
          ${aiHistory.length === 0 ? `<div class="ai-msg bot">Salam! Mən JOLLY AI-yam. Yalnız bu proqramın daxilindəki məlumatlarla — məhsullar, firmalar, qruplar, statuslar — kömək edə bilərəm. Nə soruşmaq istəyirsən?</div>` : aiHistory.map(m => `<div class="ai-msg ${m.role}">${m.text.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>`).join('')}
        </div>
        <div class="ai-suggestions">
          <span class="chip" onclick="JollyStudios.aiQuick('Neçə məhsul var?')">Neçə məhsul var?</span>
          <span class="chip" onclick="JollyStudios.aiQuick('Problemli məhsullar')">Problemli</span>
          <span class="chip" onclick="JollyStudios.aiQuick('Barkodsuz məhsullar')">Barkodsuz</span>
          <span class="chip" onclick="JollyStudios.aiQuick('Ən bahalı')">Ən bahalı</span>
          <span class="chip" onclick="JollyStudios.aiQuick('Hesabat')">Hesabat</span>
          <span class="chip" onclick="JollyStudios.aiQuick('Yeni məhsul')">Yeni məhsul</span>
        </div>
        <div class="ai-input-row">
          <input id="aiInput" placeholder="Sual yaz..." onkeydown="if(event.key==='Enter')JollyStudios.aiSend()">
          <button class="mic-btn" onclick="JollyStudios.aiVoice()">🎤</button>
          <button class="mic-btn" onclick="JollyStudios.aiSend()">➤</button>
        </div>
      </div>
    `;
  }

  function scrollAiBottom() {
    const el = document.getElementById('aiMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function aiSend() {
    const input = document.getElementById('aiInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    pushAi('user', text);
    handleAiResponse(text);
  }

  function aiQuick(text) { pushAi('user', text); handleAiResponse(text); }

  function aiVoice() {
    JollyVoice.listen((text) => { pushAi('user', text); handleAiResponse(text); });
  }

  function pushAi(role, text) {
    aiHistory.push({ role, text });
    const el = document.getElementById('aiMessages');
    if (el) {
      el.innerHTML = aiHistory.map(m => `<div class="ai-msg ${m.role}">${m.typing ? m.text : m.text.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>`).join('');
      scrollAiBottom();
    }
  }

  function renderInlineProductList(products) {
    return `<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
      ${products.map(p => `
        <div class="list-row" style="border-bottom:none;">
          <span>${JollyProducts.escapeHtml(p.name || 'Adsız')}</span>
          <span class="actions">
            <span onclick="JollyRouter.go('#/product/${p.id}')" style="color:var(--accent-1);">👁</span>
            ${(p.barcodes && p.barcodes.length) ? `<span onclick="JollyProducts.showBarcode('${JollyProducts.escapeHtml(p.barcodes[0])}')" style="color:var(--accent-2);">🧾</span>` : ''}
            <span onclick="JollyProducts.whatsappShare('${p.id}')" style="color:#25D366;">📤</span>
          </span>
        </div>
      `).join('')}
    </div>`;
  }

  function handleAiResponse(text) {
    aiHistory.push({ role: 'bot', text: `<span class="ai-typing"><span></span><span></span><span></span></span>`, typing: true });
    const el = document.getElementById('aiMessages');
    if (el) { el.innerHTML = aiHistory.map(m => `<div class="ai-msg ${m.role}">${m.typing ? m.text : m.text.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>`).join(''); scrollAiBottom(); }

    setTimeout(() => {
      aiHistory.pop();

      function normalizeProducts(list) {
        if (!list) return [];
        return list.map(x => (x && x.product) ? x.product : x).filter(Boolean);
      }

      function finish(resText, products, action) {
        let html = resText;
        if (products && products.length) html += renderInlineProductList(products.slice(0, 8));
        pushAi('bot', html);
        if (action) {
          if (action.type === 'navigate') setTimeout(() => JollyRouter.go(action.route), 700);
          else if (action.type === 'openVisualSearch') setTimeout(() => startVisualSearchFromStudio(), 300);
          else if (action.type === 'whatsapp') setTimeout(() => { if (typeof JollyProducts !== 'undefined') JollyProducts.whatsappShare(action.productId); }, 200);
          else if (action.type === 'showBarcode') setTimeout(() => { if (typeof JollyProducts !== 'undefined') JollyProducts.showBarcode(action.barcode); }, 200);
        }
      }

      if (typeof JollyGemini !== 'undefined') {
        JollyGemini.ask(text).then(r => {
          if (r.source === 'gemini') {
            finish(r.text + `<div class="muted" style="font-size:10px;margin-top:4px;">✨ Gemini</div>`, null, null);
          } else {
            const full = r.full;
            const products = normalizeProducts(full && full.products);
            finish(r.text, products, full && full.action);
          }
        }).catch(() => {
          const res = JollyAI.respond(text);
          finish(res.text, normalizeProducts(res.action && res.action.products), res.action);
        });
      } else {
        const res = JollyAI.respond(text);
        finish(res.text, normalizeProducts(res.action && res.action.products), res.action);
      }
    }, 420);
  }

  const NAV_ITEMS_DEFAULT = [
    { id: 'dashboard', label: 'İş masası', icon: '🎛️' },
    { id: 'products', label: 'Məhsullar', icon: '📦' },
    { id: 'scan', label: 'Skan', icon: '📷' },
    { id: 'ai', label: 'AI', icon: '🤖' },
    { id: 'studios', label: 'Menyu', icon: '☰' },
  ];

  const EDGE_CATALOG = [
    { id: 'scan', label: 'Barkod skan', icon: '📷', action: "JollyEdgePanel.close();JollyProducts.scanSearch();" },
    { id: 'galleryScan', label: 'Şəkildən skan', icon: '🖼️', action: "JollyEdgePanel.close();JollyGalleryScan.scanAndFind();" },
    { id: 'newProduct', label: 'Yeni məhsul', icon: '➕', route: '#/product/new' },
    { id: 'home', label: 'Ana səhifə', icon: '🏠', route: '#/home' },
    { id: 'products', label: 'Məhsullar', icon: '📦', route: '#/products' },
    { id: 'drafts', label: 'Qaralamalar', icon: '📝', route: '#/drafts' },
    { id: 'aiQuick', label: 'JOLLY AI', icon: '🤖', route: '#/studios/ai' },
    { id: 'brain', label: 'AI Brain', icon: '🧠', route: '#/brain' },
    { id: 'lastAdded', label: 'Son əlavələr', icon: '🕓', special: 'lastAdded' },
    { id: 'favorites', label: 'Favorilər', icon: '⭐', route: '#/dashboard/favorites' },
    { id: 'trash', label: 'Səbət', icon: '🗑️', route: '#/dashboard/trash' },
    { id: 'studios', label: 'Studios', icon: '🏛️', route: '#/studios' },
    { id: 'admin', label: 'Admin', icon: '🛠️', route: '#/studios/admin' },
    { id: 'report', label: 'Report', icon: '📊', route: '#/studios/report' },
    { id: 'data', label: 'Backup', icon: '💾', route: '#/studios/data' },
    { id: 'theme', label: 'Theme', icon: '🎨', route: '#/studios/theme' },
    { id: 'workflow', label: 'Workflow', icon: '⚡', route: '#/studios/workflow' },
    { id: 'code', label: 'Code', icon: '⌨️', route: '#/studios/code' },
    { id: 'notifications', label: 'Bildirişlər', icon: '🔔', route: '#/notifications' },
    { id: 'security', label: 'Security', icon: '🔐', route: '#/studios/security' },
  ];

  function getEdgeCatalog() { return EDGE_CATALOG; }
  function getEdgeCatalogItem(id) { return EDGE_CATALOG.find(x => x.id === id) || { id, label: id, icon: '•', route: '#/home' }; }

  function getNavConfig() {
    const settings = JollyDB.getSettings();
    let items = settings.navItems || NAV_ITEMS_DEFAULT.map(n => ({ ...n, visible: true }));
    NAV_ITEMS_DEFAULT.forEach((d, idx) => {
      if (!items.some(n => n.id === d.id)) {
        items.splice(idx, 0, { ...d, visible: true });
      }
    });
    return items;
  }

  function renderModuleStudio() {
    const nav = getNavConfig();
    const edge = JollyDB.getEdgeConfig();
    const inEdge = edge.items;
    const available = EDGE_CATALOG.filter(c => !inEdge.includes(c.id));
    setTimeout(() => attachModuleDrag(), 0);
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 6px;font-size:19px;">🧩 Modul Studio</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 16px;">Edge paneli özün qur — əlavə et, çıxar, sürüşdürüb sırala.</p>

      <div class="section-title">Aşağı menyu — göstər / gizlət / sırala</div>
      <div class="glass" style="padding:4px 14px;" id="navModuleList">
        ${nav.map(n => `
          <div class="list-row" draggable="true" data-id="${n.id}">
            <span>☰ ${n.icon} ${n.label}</span>
            <label style="display:flex;align-items:center;cursor:pointer;">
              <input type="checkbox" ${n.visible !== false ? 'checked' : ''} onchange="JollyStudios.toggleNavItem('${n.id}', this.checked)">
            </label>
          </div>
        `).join('')}
      </div>

      <div class="section-title">Edge paneldə olanlar — sürüşdürüb sırala</div>
      <div class="glass" style="padding:4px 14px;" id="edgeModuleList">
        ${inEdge.length ? inEdge.map(id => {
          const c = getEdgeCatalogItem(id);
          return `
          <div class="list-row" draggable="true" data-id="${id}">
            <span>☰ ${c.icon} ${c.label}</span>
            <span class="actions"><span onclick="JollyStudios.removeEdgeItem('${id}')" style="color:var(--accent-danger);">✕ çıxar</span></span>
          </div>`;
        }).join('') : '<div class="muted" style="padding:14px;">Edge boşdur. Aşağıdan əlavə et.</div>'}
      </div>

      <div class="section-title">Edge-ə əlavə et</div>
      <div class="glass" style="padding:4px 14px;">
        ${available.length ? available.map(c => `
          <div class="list-row">
            <span>${c.icon} ${c.label}</span>
            <span class="actions"><span onclick="JollyStudios.addEdgeItem('${c.id}')" style="color:var(--accent-2);">+ əlavə et</span></span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hamısı Edge-dədir 👍</div>'}
      </div>
      <p class="muted" style="font-size:11.5px;padding:0 4px;margin-top:8px;">☰ işarəsindən tutub sürüşdürərək sıranı dəyiş.</p>
    `;
  }

  function addEdgeItem(id) {
    const cfg = JollyDB.getEdgeConfig();
    if (cfg.items.includes(id)) { Toast.info('Artıq Edge-dədir'); return; }
    cfg.items.push(id);
    JollyDB.setEdgeConfig(cfg);
    Toast.success('Edge-ə əlavə olundu');
    JollyRouter.go('#/studios/module');
  }

  function attachModuleDrag() {
    ['navModuleList', 'edgeModuleList'].forEach(containerId => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const persist = () => { if (containerId === 'navModuleList') persistNavOrder(); else persistEdgeOrder(); };

      let dragEl = null;
      container.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('dragstart', () => { dragEl = row; setTimeout(() => row.style.opacity = '0.3', 0); });
        row.addEventListener('dragend', () => { row.style.opacity = '1'; persist(); });
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          const after = getDragAfterEl(container, e.clientY);
          if (!dragEl) return;
          if (after == null) container.appendChild(dragEl);
          else container.insertBefore(dragEl, after);
        });
      });

      container.querySelectorAll('.list-row').forEach(row => {
        let touchDragging = false;
        row.addEventListener('touchstart', (e) => {
          touchDragging = true;
          row.style.opacity = '0.4';
          row.style.background = 'rgba(124,138,255,0.12)';
        }, { passive: true });
        row.addEventListener('touchmove', (e) => {
          if (!touchDragging) return;
          e.preventDefault();
          const y = e.touches[0].clientY;
          const after = getDragAfterEl(container, y);
          if (after == null) container.appendChild(row);
          else if (after !== row) container.insertBefore(row, after);
        }, { passive: false });
        row.addEventListener('touchend', () => {
          if (!touchDragging) return;
          touchDragging = false;
          row.style.opacity = '1';
          row.style.background = '';
          persist();
        });
      });
    });
  }

  function getDragAfterEl(container, y) {
    const rows = [...container.querySelectorAll('.list-row')].filter(r => r.style.opacity !== '0.3' && r.style.opacity !== '0.4');
    return rows.reduce((closest, row) => {
      const box = row.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: row };
      return closest;
    }, { offset: -Infinity }).element;
  }

  function persistNavOrder() {
    const ids = [...document.querySelectorAll('#navModuleList .list-row')].map(r => r.dataset.id);
    const current = getNavConfig();
    const ordered = ids.map(id => current.find(n => n.id === id)).filter(Boolean);
    JollyDB.setSettings({ navItems: ordered });
    JollyApp.renderBottomNav();
  }

  function persistEdgeOrder() {
    const ids = [...document.querySelectorAll('#edgeModuleList .list-row')].map(r => r.dataset.id);
    JollyDB.setEdgeConfig({ items: ids });
  }

  function toggleNavItem(id, visible) {
    const current = getNavConfig();
    const updated = current.map(n => n.id === id ? { ...n, visible } : n);
    JollyDB.setSettings({ navItems: updated });
    JollyApp.renderBottomNav();
    Toast.success(visible ? 'Göstərilir' : 'Gizlədildi');
  }

  function removeEdgeItem(id) {
    const cfg = JollyDB.getEdgeConfig();
    JollyDB.setEdgeConfig({ items: cfg.items.filter(i => i !== id) });
    JollyRouter.go('#/studios/module');
    Toast.success('Edge Panel-dən çıxarıldı');
  }

  const THEMES = {
    'dark-neon': { name: 'Dark Neon (standart)', a1: '#7c8aff', a2: '#29e0c9', a3: '#ff5fa2' },
    'midnight-gold': { name: 'Midnight Gold', a1: '#f5c563', a2: '#e0a72e', a3: '#ff8a5c' },
    'cyber-magenta': { name: 'Cyber Magenta', a1: '#ff4fd8', a2: '#4fe8ff', a3: '#ffe14f' },
    'deep-forest': { name: 'Deep Emerald', a1: '#34e89e', a2: '#0f3443', a3: '#7ee8fa' },
    'amoled-black': { name: 'AMOLED True-Black', a1: '#7c8aff', a2: '#29e0c9', a3: '#ff5fa2', bg: '#000000', bgDeep: '#000000' },
    'ocean': { name: 'Ocean', a1: '#1e6fa8', a2: '#29c7de', a3: '#7fe9ff' },
    'fire': { name: 'Fire', a1: '#ff4d4d', a2: '#ff9142', a3: '#ffce56' },
    'pastel': { name: 'Pastel', a1: '#ffb3d1', a2: '#c9a7ff', a3: '#ffe1ec' },
    'mono-blue': { name: 'Mono Blue', a1: '#3b82f6', a2: '#60a5fa', a3: '#93c5fd' },
    'auto-smart': { name: 'Auto Smart (gündüz/gecə)', a1: '#7fe9ff', a2: '#7c8aff', a3: '#fbbf24' },
  };

  // Auto Smart üçün: gündüz/gecə hansı əsl temalara uyğunlaşdırılsın
  const AUTO_DAY_THEME = 'ocean';
  const AUTO_NIGHT_THEME = 'dark-neon';
  const AUTO_DAY_START = 7;   // 07:00
  const AUTO_DAY_END = 19;    // 19:00
  let autoSmartWatcherStarted = false;
  function ensureAutoSmartWatcher() {
    if (autoSmartWatcherStarted) return;
    autoSmartWatcherStarted = true;
    setInterval(() => {
      const s = JollyDB.getSettings();
      if (s.theme === 'auto-smart') applySavedTheme();
    }, 15 * 60 * 1000); // hər 15 dəqiqədən bir yoxla, saat dəyişdisə tema da dəyişsin
  }
  function isAutoSmartDaytime() {
    const h = new Date().getHours();
    return h >= AUTO_DAY_START && h < AUTO_DAY_END;
  }
  function resolveThemeKey(rawKey) {
    if (rawKey === 'auto-smart') return isAutoSmartDaytime() ? AUTO_DAY_THEME : AUTO_NIGHT_THEME;
    return rawKey;
  }

  function renderTheme() {
    if (window.JollyAuth && !JollyAuth.can('settings.theme')) {
      if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
      return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
    }
    const settings = JollyDB.getSettings();
    const current = settings.theme || 'dark-neon';
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 16px;font-size:19px;">🎨 Theme Studio</h2>
      <div class="studio-grid">
        ${Object.entries(THEMES).map(([key, t]) => `
          <div class="glass studio-card" onclick="JollyStudios.applyTheme('${key}')" style="${current === key ? 'border-color:var(--accent-1);box-shadow:0 0 20px rgba(124,138,255,.3);' : ''}">
            <div class="row" style="gap:6px;">
              <span style="width:14px;height:14px;border-radius:50%;background:${t.a1};display:inline-block;"></span>
              <span style="width:14px;height:14px;border-radius:50%;background:${t.a2};display:inline-block;"></span>
              <span style="width:14px;height:14px;border-radius:50%;background:${t.a3};display:inline-block;"></span>
            </div>
            <div class="title">${t.name}</div>
            <div class="sub">${key === 'auto-smart'
              ? (current === key ? (isAutoSmartDaytime() ? '🌞 İndi: Gündüz rejimi' : '🌙 İndi: Gecə rejimi') : 'Toxun və tətbiq et')
              : (current === key ? 'Aktiv' : 'Toxun və tətbiq et')}</div>
          </div>
        `).join('')}
      </div>

      <div class="section-title">Effektlər</div>
      <div class="glass" style="padding:4px 14px;">
        <div class="list-row">
          <span>✨ Animasiyalar (keçid, pop, ripple)</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${settings.animEnabled !== false ? 'checked' : ''} onchange="JollyStudios.toggleAnim(this.checked)"></label>
        </div>
        <div class="list-row">
          <span>🔊 Səslər (uğur, xəta, bip)</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${settings.soundEnabled !== false ? 'checked' : ''} onchange="JollyStudios.toggleSound(this.checked)"></label>
        </div>
        <div class="list-row">
          <span>✨ Premium effektlər (neon, konfetti)</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${settings.fxEnabled !== false ? 'checked' : ''} onchange="JollyStudios.toggleFx(this.checked)"></label>
        </div>
        <div class="list-row">
          <span>📳 Titrəmə (haptik)</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${settings.vibrateEnabled !== false ? 'checked' : ''} onchange="JollyStudios.toggleVibrate(this.checked)"></label>
        </div>
      </div>
      <p class="muted" style="font-size:12px;margin-top:14px;">Zəif telefonda animasiyaları söndürsən daha sürətli işləyər.</p>
    `;
  }

  function toggleAnim(on) {
    JollyDB.setSettings({ animEnabled: on });
    document.body.classList.toggle('no-anim', !on);
    Toast.success(on ? 'Animasiyalar açıq' : 'Animasiyalar bağlı');
  }
  function toggleSound(on) {
    JollyDB.setSettings({ soundEnabled: on });
    if (on && typeof JollySound !== 'undefined') JollySound.success();
    Toast.success(on ? 'Səslər açıq' : 'Səslər bağlı');
  }
  function toggleFx(on) {
    JollyDB.setSettings({ fxEnabled: on });
    document.body.classList.toggle('fx-off', !on);
    if (on && typeof JollyApp !== 'undefined' && JollyApp.confetti) JollyApp.confetti();
    Toast.success(on ? 'Premium effektlər açıq ✨' : 'Effektlər bağlı');
  }
  function toggleVibrate(on) {
    JollyDB.setSettings({ vibrateEnabled: on });
    if (on && navigator.vibrate) navigator.vibrate(60);
    Toast.success(on ? 'Titrəmə açıq' : 'Titrəmə bağlı');
  }

  function applyTheme(key) {
    if (!THEMES[key]) return;
    JollyDB.setSettings({ theme: key });
    applySavedTheme();
    Toast.success(`${THEMES[key].name} tətbiq olundu`);
    JollyRouter.go('#/studios/theme');
  }

  function applySavedTheme() {
    ensureAutoSmartWatcher();
    const settings = JollyDB.getSettings();
    const rawKey = settings.theme || 'dark-neon';
    const effectiveKey = resolveThemeKey(rawKey);
    const t = THEMES[effectiveKey];
    if (t) {
      document.documentElement.style.setProperty('--accent-1', t.a1);
      document.documentElement.style.setProperty('--accent-2', t.a2);
      document.documentElement.style.setProperty('--accent-3', t.a3);
      document.documentElement.style.setProperty('--bg-void', t.bg || '#06070d');
      document.documentElement.style.setProperty('--bg-deep', t.bgDeep || '#0b0e1a');
    }
  }

  function renderData() {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      if (s && s.role !== 'admin') {
        if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
        return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
      }
    } catch (e) {}
    const activity = JollyDB.getActivity().slice(0, 8);
    const settings = JollyDB.getSettings();
    const lastBackup = settings.lastBackup;
    const products = JollyDB.Products.all().length;
    const daysSince = lastBackup ? Math.floor((Date.now() - lastBackup) / 864e5) : null;
    const needBackup = daysSince === null || daysSince >= 7;
    const statusColor = needBackup ? 'var(--accent-warn)' : 'var(--accent-2)';
    const statusText = lastBackup
      ? (daysSince === 0 ? 'Bu gün' : `${daysSince} gün əvvəl`)
      : 'Heç vaxt';

    setTimeout(() => {
      if (typeof JollyDrive === 'undefined') return;
      if (JollyDrive.isSignedIn()) JollyDrive.loadAndRenderList();
      else if (JollyDrive.runDiagnostics) JollyDrive.runDiagnostics();
    }, 0);
    setTimeout(() => loadStorageEstimate(), 0);
    setTimeout(() => loadPersistStatus(), 0);

    return `
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">💾 Backup Mərkəzi</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 16px;">Nüsxələmənin BÜTÜN üsulları bir yerdə — JSON, avtomatik nüsxə, Google Drive, Cloud, CSV.</p>

      <div class="glass" style="padding:16px;margin-bottom:14px;">
        <div class="row between" style="margin-bottom:12px;">
          <div>
            <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;">Son backup</div>
            <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:${statusColor};">${statusText}</div>
          </div>
          <div style="text-align:right;">
            <div class="muted" style="font-size:11px;">Məhsul</div>
            <div style="font-family:var(--font-display);font-size:18px;font-weight:700;">${products}</div>
          </div>
        </div>
        ${needBackup ? `<div style="font-size:12px;color:var(--accent-warn);margin-bottom:12px;">⚠️ Backup vaxtıdır — məlumatlarını qoru.</div>` : ''}
        <div class="row" style="gap:10px;">
          <button class="btn btn-primary" style="flex:1;" onclick="JollyStudios.exportBackup()">⬇️ JSON Backup çıxar</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="document.getElementById('importFile').click()">⬆️ Bərpa et</button>
        </div>
        <input type="file" id="importFile" accept="application/json" style="display:none" onchange="JollyStudios.importBackup(event)">
      </div>

      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" onclick="JollyStudios.restoreSnapshot()">
          <span>♻️ Son avtomatik nüsxəyə qayıt</span><span>›</span>
        </div>
        <div class="list-row">
          <span>🔔 Backup xatırlatması (hər girişdə)</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${settings.backupReminder !== false ? 'checked' : ''} onchange="JollyStudios.toggleBackupReminder(this.checked)"></label>
        </div>
      </div>

      <div class="section-title" style="margin-top:0;">📁 Şəkilləri telefona yüklə (əsl fayl kimi)</div>
      <div class="glass" style="padding:14px;">
        <p class="muted" style="font-size:12px;margin:0 0 10px;">Bütün məhsul şəkillərini telefonun öz "Yükləmələr" qovluğuna, adi foto kimi köçürür — brauzer yaddaşı nə olursa olsun, bu şəkillər telefonda qalır.</p>
        <button class="btn btn-primary btn-block" onclick="JollyStudios.exportAllImages()">⬇️ Bütün şəkilləri yüklə</button>
        <div id="imgExportProgress" class="muted" style="font-size:11.5px;margin-top:8px;"></div>
      </div>

      <div class="section-title">🔒 Daimi Yaddaş</div>
      <div class="glass" style="padding:14px;">
        <div id="persistStatusZone" class="muted" style="font-size:12px;">Yoxlanılır...</div>
        <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="JollyStudios.requestPersist()">🔒 Daimi yaddaş istə</button>
        <p class="muted" style="font-size:11px;margin-top:8px;">Brauzerə "bu tətbiqin datasını yaddaş azalanda avtomatik silmə" deyir — şəkillərin təsadüfən silinmə ehtimalını azaldır.</p>
      </div>

      <div class="section-title">☁️ Google Drive Backup</div>
      <div class="glass" style="padding:14px;">
        ${typeof JollyDrive !== 'undefined' ? JollyDrive.renderPanel() : '<p class="muted" style="font-size:12px;">Modul yüklənməyib</p>'}
      </div>

      <div class="section-title">☁️ Firebase Cloud Sync</div>
      <div class="glass" style="padding:14px;">
        <button class="btn btn-ghost btn-block" onclick="JollyRouter.go('#/studios/cloud')">Cloud Studio-nu aç</button>
        <p class="muted" style="font-size:11px;margin-top:8px;">İki cihazdan (məs. telefon + tablet) eyni anda istifadə edəndə, dəyişikliklər avtomatik ötürülür.</p>
      </div>

      <div class="section-title">📊 CSV (Excel-də açıla bilər)</div>
      <div class="glass" style="padding:14px;">
        <div class="row" style="gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="JollyStudios.exportCsv()">⬇️ CSV ixrac et</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="document.getElementById('integCsvFile').click()">⬆️ CSV idxal et</button>
        </div>
        <input type="file" id="integCsvFile" accept=".csv" style="display:none;" onchange="JollyStudios.importCsvFile(this.files[0])">
        <p class="muted" style="font-size:11px;margin-top:8px;">Sütunlar: ad, xüsusiKod, qiymət, firma, qrup, yer, barkod</p>
      </div>

      <div class="section-title">📱 Telefon dəyişmə</div>
      <div class="glass" style="padding:14px;">
        <button class="btn btn-primary btn-block" onclick="JollyStudios.exportBackup()">📱 Bütün məlumatı köçür (tam JSON)</button>
        <p class="muted" style="font-size:11px;margin-top:8px;">Yeni telefonda JOLLY-ni aç → Backup Mərkəzi → "Bərpa et" ilə bu faylı seç.</p>
      </div>

      <div class="section-title">🗜️ Şəkil sıxma (yaddaş qənaəti)</div>
      <div class="glass" style="padding:14px;">
        <div class="list-row" style="padding:6px 0;">
          <span>Şəkilləri avtomatik sıx</span>
          <label><input type="checkbox" ${settings.compressImages !== false ? 'checked' : ''} onchange="JollyStudios.toggleWaSetting('compressImages', this.checked)"></label>
        </div>
        <p class="muted" style="font-size:11px;margin:6px 0 0;">Açıq olanda hər yeni şəkil avtomatik kiçilir (max 1200px) — keyfiyyət gözlə görünmür, yaddaş 5-10 dəfə az tutulur.</p>
        <div id="storageEstimate" class="muted" style="font-size:11.5px;margin-top:10px;">Yaddaş hesablanır...</div>
      </div>

      <div class="section-title">Son fəaliyyət</div>
      <div class="glass" style="padding:4px 14px;">
        ${activity.length ? activity.map(a => `
          <div class="list-row"><span>${iconForAction(a.action)} ${a.entity} — ${JollyProducts.escapeHtml(String(a.details || ''))}</span><span class="muted" style="font-size:11px;">${timeAgo(a.ts)}</span></div>
        `).join('') : '<div class="muted" style="padding:14px;">Fəaliyyət yoxdur</div>'}
      </div>
    `;
  }

  function iconForAction(a) { return { add: '➕', update: '✏️', delete: '🗑️', import: '⬆️' }[a] || '•'; }
  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'indi';
    if (diff < 3600) return Math.floor(diff / 60) + ' dəq';
    if (diff < 86400) return Math.floor(diff / 3600) + ' saat';
    return Math.floor(diff / 86400) + ' gün';
  }

  function exportBackup() {
    if (window.JollyAuth && !JollyAuth.can('backup.export')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Export icazən yoxdur');
      return;
    }
    const data = JollyDB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `jolly-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    JollyDB.setSettings({ lastBackup: Date.now() });
    Toast.success('Backup yükləndi');
    JollyRouter.go('#/studios/data');
  }

  function importBackup(e) {
    if (window.JollyAuth && !JollyAuth.can('backup.import')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Bərpa/Import icazən yoxdur — Admin-dən istə');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const count = (data.jolly_products || []).length;
        if (confirm(`Bu backup-da ${count} məhsul var. Mövcud məlumatlar bununla əvəz olunacaq. Davam edilsin?`)) {
          saveSnapshot();
          JollyDB.importAll(data);
          Toast.success('Bərpa tamamlandı');
          JollyRouter.go('#/home');
        }
      } catch (err) {
        Toast.error('Fayl oxunmadı — düzgün JSON deyil');
      }
    };
    reader.readAsText(file);
  }

  function saveSnapshot() {
    try {
      const data = JollyDB.exportAll();
      JollyDB.write('jolly_snapshot', { data, ts: Date.now() });
    } catch (e) {}
  }
  function restoreSnapshot() {
    if (window.JollyAuth && !JollyAuth.can('backup.restore')) {
      if (typeof Toast !== 'undefined') Toast.error('🔒 Bərpa icazən yoxdur — Admin-dən istə');
      return;
    }
    const snap = JollyDB.read('jolly_snapshot', null);
    if (!snap || !snap.data) { Toast.error('Avtomatik nüsxə yoxdur'); return; }
    const when = new Date(snap.ts).toLocaleString('az-AZ');
    if (confirm(`${when} tarixli avtomatik nüsxəyə qayıdılsın? Hazırkı məlumatlar əvəz olunacaq.`)) {
      JollyDB.importAll(snap.data);
      Toast.success('Geri qaytarıldı');
      JollyRouter.go('#/home');
    }
  }
  function toggleBackupReminder(on) {
    JollyDB.setSettings({ backupReminder: on });
    Toast.success(on ? 'Xatırlatma aktiv' : 'Xatırlatma söndürüldü');
  }

  function renderSecurity() {
    try {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      if (s && s.role !== 'admin') {
        if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
        return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
      }
    } catch (e) {}
    const settings = JollyDB.getSettings();
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 16px;font-size:19px;">🔐 Security Studio</h2>
      <div class="glass" style="padding:4px 14px;">
        <div class="list-row">
          <span>PIN qoruması</span>
          <label style="display:flex;align-items:center;">
            <input type="checkbox" ${settings.pinEnabled ? 'checked' : ''} onchange="JollyStudios.togglePinLock(this.checked)">
          </label>
        </div>
        <div class="list-row" onclick="JollyStudios.viewActivityLog()">
          <span>Tam fəaliyyət jurnalı</span><span>›</span>
        </div>
      </div>
      <p class="muted" style="font-size:12px;margin-top:12px;padding:0 4px;">Barmaq izi girişi cihaz dəstəyi olduqda gələcək yeniləmədə aktivləşəcək.</p>
    `;
  }

  function hashPin(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < String(s).length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  function togglePinLock(enabled) {
    if (enabled) {
      const pin = prompt('7 rəqəmli PIN təyin et:');
      if (!pin || !/^\d{7}$/.test(pin)) { Toast.error('PIN 7 rəqəm olmalıdır'); return; }
      JollyDB.setSettings({ pinEnabled: true, pin: hashPin(pin) });
      Toast.success('PIN qoruması aktivləşdi');
    } else {
      JollyDB.setSettings({ pinEnabled: false });
      Toast.info('PIN qoruması söndürüldü');
    }
  }

  function viewActivityLog() { JollyRouter.go('#/studios/data'); }

  function renderReport() {
    if (window.JollyAuth && !JollyAuth.can('dashboard.reports')) {
      if (window.JollyRouter) setTimeout(() => JollyRouter.go('#/home'), 0);
      return `<div class="empty-state"><div class="big-icon">🔒</div><h3>İcazə yoxdur</h3></div>`;
    }
    const products = JollyDB.Products.all();
    const byBrand = {};
    const byGroup = {};
    const bySupplier = {};
    let totalValue = 0, problemCount = 0, noBarcodeCount = 0;
    products.forEach(p => {
      if (p.brand) byBrand[p.brand] = (byBrand[p.brand] || 0) + 1;
      if (p.group) byGroup[p.group] = (byGroup[p.group] || 0) + 1;
      if (p.supplier) bySupplier[p.supplier] = (bySupplier[p.supplier] || 0) + 1;
      if (p.price) totalValue += parseFloat(p.price) || 0;
      if ((p.status || '').toLowerCase().includes('problem')) problemCount++;
      if (!p.barcodes || !p.barcodes.length) noBarcodeCount++;
    });
    return `
      <h2 style="font-family:var(--font-display);margin:0 0 16px;font-size:19px;">📊 Report Studio</h2>
      <div class="studio-grid" style="margin-bottom:16px;">
        ${statCard('📦', products.length, 'Ümumi məhsul')}
        ${statCard('💰', totalValue.toFixed(0) + ' ₼', 'Ümumi dəyər')}
        ${statCard('⚠️', problemCount, 'Problemli')}
        ${statCard('🏷️', noBarcodeCount, 'Barkodsuz')}
      </div>
      <div class="section-title">Firma üzrə bölgü</div>
      <div class="glass" style="padding:4px 14px;">
        ${Object.entries(byBrand).length ? Object.entries(byBrand).sort((a, b) => b[1] - a[1]).map(([n, c]) => `<div class="list-row"><span>${JollyProducts.escapeHtml(n)}</span><span class="mono">${c}</span></div>`).join('') : '<div class="muted" style="padding:14px;">Məlumat yoxdur</div>'}
      </div>
      <div class="section-title">Qrup üzrə bölgü</div>
      <div class="glass" style="padding:4px 14px;">
        ${Object.entries(byGroup).length ? Object.entries(byGroup).sort((a, b) => b[1] - a[1]).map(([n, c]) => `<div class="list-row"><span>${JollyProducts.escapeHtml(n)}</span><span class="mono">${c}</span></div>`).join('') : '<div class="muted" style="padding:14px;">Məlumat yoxdur</div>'}
      </div>
      <div class="section-title">🚚 Tədarükçü üzrə bölgü</div>
      <div class="glass" style="padding:4px 14px;">
        ${Object.entries(bySupplier).length ? Object.entries(bySupplier).sort((a, b) => b[1] - a[1]).map(([n, c]) => `<div class="list-row" onclick="JollyRouter.go('#/products?supplier=${encodeURIComponent(n)}')" style="cursor:pointer;"><span>${JollyProducts.escapeHtml(n)}</span><span class="mono">${c}</span></div>`).join('') : '<div class="muted" style="padding:14px;">Hələ tədarükçü təyin olunmayıb</div>'}
      </div>
    `;
  }

  function statCard(icon, value, label) {
    return `<div class="glass studio-card" style="min-height:80px;"><div class="ic">${icon}</div><div class="title" style="font-size:18px;">${value}</div><div class="sub">${label}</div></div>`;
  }

  return {
    renderHome, renderComingSoon, toggleModuleReg,
    renderAI, aiSend, aiQuick, aiVoice,
    renderModuleStudio, toggleNavItem, removeEdgeItem, getNavConfig, NAV_ITEMS_DEFAULT,
    addEdgeItem, getEdgeCatalog, getEdgeCatalogItem,
    renderTheme, applyTheme, applySavedTheme, THEMES, toggleAnim, toggleSound, toggleVibrate, toggleFx,
    renderData, exportBackup, importBackup, saveSnapshot, restoreSnapshot, toggleBackupReminder,
    loadPersistStatus, requestPersist, exportAllImages,
    renderSecurity, togglePinLock, viewActivityLog,
    renderReport,
    renderVoiceVision, startVisualSearchFromStudio, runOcr,
    renderAnalyticsStudio,
    renderIntegration, toggleWaSetting, exportCsv, importCsvFile,
    renderPrintCenter, selectAllPrint, printSelectedBarcodes,
  };
})();
