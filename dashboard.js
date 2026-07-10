/* ============================================================
   JOLLY Dashboard Pro Plus — iş masası
   Toxunulan kartlar, "Bu gün diqqət", tez şəkil çək, qalereya
   Dashboard Studio ilə idarə olunur (əlavə/gizlət/sırala)
   ============================================================ */

// Təhlükəsizlik: jolly-icons.js qoyulmayıbsa belə çökməsin
if (typeof JollyIcons === 'undefined') { window.JollyIcons = { get: function(){ return ''; }, paths: {} }; }

const JollyDashboard = (() => {
  const CFG_KEY = 'jolly_dashboard_config';

  /* Kart kataloqu — Dashboard Studio bunlardan seçir */
  const CATALOG = [
    { id: 'quickPhoto', icon: '📷', label: 'Tez şəkil çək', sub: 'Yeni gələn mal', action: 'JollyDashboard.quickPhoto()', badge: null, neon: 'blue' },
    { id: 'newProduct', icon: '➕', label: 'Yeni məhsul', sub: 'Tam kart', route: '#/product/new', neon: 'blue' },
    { id: 'scan', icon: '📡', label: 'Skan et', sub: 'Barkodla tap', action: 'JollyProducts.scanSearch()', neon: 'teal' },
    { id: 'galleryScan', icon: '🖼️', label: 'Şəkildən skan', sub: 'Fotodan barkod', action: 'JollyGalleryScan.scanAndFind()', neon: 'teal' },
    { id: 'incomplete', icon: '⚠️', label: 'Tamamlanmamış', sub: 'Düzəlt', route: '#/dashboard/incomplete', badgeFn: 'incompleteCount', hideWhenZero: true, neon: 'red' },
    { id: 'gallery', icon: '🖼️', label: 'Şəkil qalereyası', sub: 'Bütün şəkillər', route: '#/dashboard/gallery', neon: 'purple' },
    { id: 'recent', icon: '🕓', label: 'Son əlavələr', sub: 'Axırıncılar', route: '#/dashboard/recent', neon: 'purple' },
    { id: 'drafts', icon: '📥', label: 'Gələn Mallar', sub: 'Tez çəkilənlər — tamamla', route: '#/drafts', badgeFn: 'draftCount', hideWhenZero: false, neon: 'green' },
    { id: 'search', icon: '🔎', label: 'Axtarış', sub: 'Hər şeylə tap', route: '#/home', neon: 'blue' },
    { id: 'brain', icon: '🧠', label: 'AI Brain', sub: 'Sağlamlıq', route: '#/brain', neon: 'pink' },
    { id: 'ai', icon: '🤖', label: 'JOLLY AI', sub: 'Sual ver', route: '#/studios/ai', neon: 'purple' },
    { id: 'favorites', icon: '⭐', label: 'Favorilər', sub: 'Seçilmişlər', route: '#/dashboard/favorites', neon: 'gold' },
    { id: 'trash', icon: '🗑️', label: 'Səbət', sub: 'Silinənlər', route: '#/dashboard/trash', badgeFn: 'trashCount', hideWhenZero: true, neon: 'red' },
    { id: 'backup', icon: '💾', label: 'Backup', sub: 'Qoru', route: '#/studios/data', badgeFn: 'backupDue', hideWhenZero: true, neon: 'teal' },
    { id: 'voice', icon: '🎤', label: 'Səsli axtar', sub: 'Danış', action: 'JollyProducts.voiceSearch()', neon: 'pink' },
    { id: 'report', icon: '📊', label: 'Hesabat', sub: 'Statistika', route: '#/studios/report', neon: 'gold' },
    { id: 'insight', icon: '📈', label: 'Analitika', sub: 'Dərin mənzərə', route: '#/insight', neon: 'green' },
  ];

  const DEFAULT_ITEMS = ['newProduct', 'scan', 'incomplete', 'gallery', 'recent', 'drafts', 'brain'];

  function getConfig() {
    const cfg = JollyDB.read(CFG_KEY, { items: DEFAULT_ITEMS.slice(), attention: true });
    if (cfg.items) cfg.items = cfg.items.filter(id => id !== 'quickPhoto');
    return cfg;
  }
  function setConfig(cfg) { JollyDB.write(CFG_KEY, cfg); }

  const BADGES = {
    incompleteCount() {
      const p = JollyDB.Products.all();
      return p.filter(x => !x.images || !x.images.length || !x.barcodes || !x.barcodes.length || x.price == null || x.price === '').length;
    },
    draftCount() { return JollyDB.Drafts.all().length; },
    trashCount() { return JollyDB.Trash.all().length; },
    backupDue() {
      const s = JollyDB.getSettings();
      if (!JollyDB.Products.all().length) return 0;
      const last = s.lastBackup || 0;
      return (Date.now() - last) > 7 * 864e5 ? 1 : 0;
    },
  };

  function badgeValue(item) {
    if (!item.badgeFn || !BADGES[item.badgeFn]) return null;
    return BADGES[item.badgeFn]();
  }

  function attentionItems() {
    const list = [];
    const inc = BADGES.incompleteCount();
    if (inc > 0) list.push({ text: `⚠️ ${inc} tamamlanmamış mal`, route: '#/dashboard/incomplete' });
    const drafts = BADGES.draftCount();
    if (drafts > 0) list.push({ text: `📝 ${drafts} qaralama gözləyir`, route: '#/drafts' });
    if (BADGES.backupDue()) list.push({ text: '💾 Backup vaxtıdır', route: '#/studios/data' });
    if (typeof JollyBrain !== 'undefined') {
      const dups = JollyBrain.findDuplicates();
      if (dups.length) list.push({ text: `👯 ${dups.length} dublikat qrupu`, route: '#/brain/duplicates' });
    }
    return list;
  }

  const PRIMARY = [
    { icon: 'magic', label: 'Tez əlavə', sub: 'Yeni gələn mal', neon: 'gold', action: "JollyDashboard.quickPhoto()" },
    { icon: 'boxplus', label: 'Məhsul yarat', sub: 'Tam məhsul kartı', neon: 'pink', route: '#/product/new' },
    { icon: 'scancenter', label: 'Skan mərkəzi', sub: 'Barkodla tap', neon: 'teal', action: "JollyProducts.scanSearch()" },
    { icon: 'shield', label: 'Düzəldiləcək', sub: 'Tamamlanmamışlar', neon: 'purple', route: '#/dashboard/incomplete', badgeFn: 'incompleteCount' },
  ];
  const MORE = [
    { icon: 'image', label: 'Qalereya', neon: 'teal', route: '#/dashboard/gallery' },
    { icon: 'clock', label: 'Sonuncular', neon: 'purple', route: '#/dashboard/recent' },
    { icon: 'inbox', label: 'Gələnlər', neon: 'red', route: '#/drafts' },
    { icon: 'brain', label: 'AI Brain', neon: 'purple', route: '#/brain' },
    { icon: 'barcode', label: 'Barkod Doctor', neon: 'blue', route: '#/data-doctor' },
    { icon: 'cloud', label: 'Backup', neon: 'teal', route: '#/studios/integration' },
    { icon: 'map', label: 'Rəf xəritəsi', neon: 'blue', route: '#/store-map' },
    { icon: 'star', label: 'Seçilmişlər', neon: 'gold', route: '#/dashboard/favorites' },
    { icon: 'inbox', label: 'Qəbul Studio', neon: 'green', route: '#/receiving' },
  ];

  function weeklyActivity() {
    const all = JollyDB.Products.all();
    const day = 864e5;
    const now = Date.now();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const buckets = new Array(7).fill(0);
    let thisWeek = 0, lastWeek = 0;
    all.forEach(p => {
      const t = p.createdAt || p.updatedAt;
      if (!t) return;
      const age = now - t;
      if (age < 7 * day) {
        thisWeek++;
        const dayIdx = Math.floor((t - (today0.getTime() - 6 * day)) / day);
        if (dayIdx >= 0 && dayIdx < 7) buckets[dayIdx]++;
      } else if (age < 14 * day) {
        lastWeek++;
      }
    });
    let trendPct = 0;
    if (lastWeek > 0) trendPct = Math.round((thisWeek - lastWeek) / lastWeek * 100);
    else if (thisWeek > 0) trendPct = 100;
    return { buckets, thisWeek, lastWeek, trendPct };
  }

  function buildWavePath(buckets) {
    const max = Math.max(1, ...buckets);
    const w = 600, h = 44, pad = 6;
    const step = w / (buckets.length - 1);
    const pts = buckets.map((v, i) => {
      const x = i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return [x, y];
    });
    let d = `M${pts[0][0]},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const cx = (x0 + x1) / 2;
      d += ` Q${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${((y0 + y1) / 2).toFixed(1)} T${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    return { d, lastY: pts[pts.length - 1][1] };
  }

  function render() {
    const total = JollyDB.Products.all().length;
    const inc = BADGES.incompleteCount();
    const noImg = JollyDB.Products.all().filter(p => !p.images || !p.images.length).length;
    const noBc = JollyDB.Products.all().filter(p => !p.barcodes || !p.barcodes.length).length;
    const health = (typeof JollyAIHealth !== 'undefined') ? JollyAIHealth.getCatalogScore() : (total ? Math.round((total - inc) / total * 100) : 100);
    const s = JollyDB.getSettings();
    const backupOk = s.lastBackup && (Date.now() - s.lastBackup) < 7 * 864e5;
    const wa = weeklyActivity();
    const wave = buildWavePath(wa.buckets);
    const trendUp = wa.trendPct >= 0;
    const trendStr = `${trendUp ? '↑' : '↓'} ${Math.abs(wa.trendPct)}% bu həftə`;
    const trendColor = trendUp ? '#4ade80' : '#ff6b7d';

    const bigCard = (c) => {
      const click = c.action ? c.action : `JollyRouter.go('${c.route}')`;
      const badge = c.badgeFn && BADGES[c.badgeFn] ? BADGES[c.badgeFn]() : 0;
      return `
        <div class="big-op neon-${c.neon}" onclick="${click}">
          ${badge > 0 ? `<span class="bo-badge">${badge}</span>` : ''}
          <div class="bo-icon">${JollyIcons.get(c.icon)}</div>
          <div class="bo-text">
            <div class="bo-label">${c.label}</div>
            <div class="bo-sub">${c.sub}</div>
          </div>
          <div class="bo-chev">${JollyIcons.get('chevron')}</div>
        </div>`;
    };

    const moreCard = (c) => `
      <div class="more-card neon-${c.neon}" onclick="JollyRouter.go('${c.route}')">
        <div class="mc-icon">${JollyIcons.get(c.icon)}</div>
        <div class="mc-label">${c.label}</div>
      </div>`;

    return `
      <div class="storeos">
        <div class="dash-head">
          <div>
            <h2 style="font-family:var(--font-display);margin:0;font-size:22px;">İş masası</h2>
            <div class="muted" style="font-size:12.5px;">JOLLY ilə mağazanı ağıllı idarə et</div>
          </div>
          <span class="icon-btn" style="width:36px;height:36px;" onclick="JollyRouter.go('#/dashboard/studio')" title="Dashboard Studio">${JollyIcons.get('gear')}</span>
        </div>

        ${(typeof JollyAIDaily !== 'undefined' && JollyAIDaily.shouldShow()) ? JollyAIDaily.render() : ''}

        <div class="gold-pulse">
          <div class="gp-head">
            <span class="gp-title">⚡ MAĞAZA VƏZİYYƏTİ</span>
          </div>
          <div class="gp-stats">
            <div class="gp-health">
              <div class="gp-h-label">Kataloq sağlamlığı</div>
              <div class="gp-h-num">${health}%</div>
              <div class="gp-h-trend" style="color:${trendColor};">${trendStr}</div>
            </div>
            <div class="gp-stat" onclick="JollyRouter.go('#/dashboard/incomplete')">
              <div class="gp-s-icon gold">${JollyIcons.get('folder')}</div>
              <div class="gp-s-num">${inc}</div>
              <div class="gp-s-lbl">Tamamlanmamış<br>mal</div>
            </div>
            <div class="gp-stat" onclick="JollyRouter.go('#/data-doctor')">
              <div class="gp-s-icon red">${JollyIcons.get('image')}</div>
              <div class="gp-s-num">${noImg}</div>
              <div class="gp-s-lbl">Şəkilsiz<br>məhsul</div>
            </div>
            <div class="gp-stat" onclick="JollyRouter.go('#/data-doctor')">
              <div class="gp-s-icon">${JollyIcons.get('barcode')}</div>
              <div class="gp-s-num">${noBc}</div>
              <div class="gp-s-lbl">Barkodsuz<br>məhsul</div>
            </div>
            <div class="gp-stat" onclick="JollyRouter.go('#/studios/integration')">
              <div class="gp-s-icon green">${JollyIcons.get('shield')}</div>
              <div class="gp-s-num gp-backup">Backup</div>
              <div class="gp-s-lbl">${backupOk ? 'Hazır' : 'Gözləyir'}</div>
            </div>
          </div>
          <div class="gp-wave">
            <svg viewBox="0 0 600 44" preserveAspectRatio="none">
              <path d="${wave.d}" fill="none" stroke="#f5c563" stroke-width="2.5" opacity="0.85"/>
            </svg>
            <span class="gp-wave-dot" style="top:${(wave.lastY / 44 * 100).toFixed(0)}%;"></span>
          </div>
          <div class="gp-foot">
            <span class="gp-advice"><span style="color:#f5c563;">✨ AI tövsiyə:</span> ${inc > 0 ? 'Əvvəl tamamlanmamış malları düzəltmək məsləhətdir.' : 'Kataloq sağlamdır! ✨'}</span>
            <span class="gp-more" onclick="JollyRouter.go('#/data-doctor')">${JollyIcons.get('chevron')}</span>
          </div>
        </div>

        <div class="dash-section-head">
          <span class="section-title" style="margin:0;">SÜRƏTLİ ƏMƏLİYYATLAR</span>
          <span class="gp-tez-giris" onclick="JollyDashboard.openSmartSearch()">🔍 Smart Axtarış</span>
        </div>
        <div class="big-op-grid gold-ops">
          ${PRIMARY.map(bigCard).join('')}
        </div>

        <div class="dash-section-head">
          <span class="section-title" style="margin:0;">DAHA ÇOX</span>
          <span class="muted" style="font-size:11.5px;cursor:pointer;" onclick="JollyRouter.go('#/dashboard/studio')">Hamısına bax ${'›'}</span>
        </div>
        <div class="more-grid gold-more">
          ${MORE.map(moreCard).join('')}
        </div>

        <div class="ai-advice-card gold-ai">
          <div class="aac-head">${JollyIcons.get('brain', '#c86bff')} <span>JOLLLY AI KÖMƏKÇI</span></div>
          <div class="aac-body">
            <div class="aac-robot aac-sphere">🔮</div>
            <div class="aac-stats">
              <div><span class="sp-dot" style="background:#ff9d5c;"></span> ${inc} tamamlanmamış mal</div>
              <div><span class="sp-dot" style="background:#ff5c6c;"></span> ${noImg} şəkilsiz məhsul</div>
              <div><span class="sp-dot" style="background:#4f9fff;"></span> ${noBc} barkodsuz məhsul</div>
            </div>
            <div class="aac-advice">
              <div style="color:#c86bff;font-weight:700;font-size:12px;margin-bottom:2px;">Tövsiyə:</div>
              <div class="muted" style="font-size:12px;">Əvvəl tamamlanmamış malları düzəlt.</div>
            </div>
          </div>
          <div class="aac-buttons">
            <button class="aac-btn aac-primary" onclick="JollyRouter.go('#/studios/ai-brain')">AI ilə yoxla ✨</button>
            <button class="aac-btn aac-gold" onclick="JollyRouter.go('#/data-doctor')">Smart Fix aç ✨</button>
          </div>
        </div>

        ${recentViewedHtml()}
      </div>
    `;
  }

  let fabOpen = false;
  function toggleFab() { }
  function fabAction(type) {
    if (type === 'newProduct' || type === 'quickadd') JollyRouter.go('#/product/new');
    else if (type === 'photo') quickPhoto();
    else if (type === 'scan') JollyProducts.scanSearch();
    else if (type === 'drafts') JollyRouter.go('#/drafts');
    else if (type === 'backup') JollyRouter.go('#/studios/integration');
    else if (type === 'ai') JollyRouter.go('#/studios/ai');
  }

  function recentViewedHtml() {
    if (typeof JollyQuick === 'undefined') return '';
    const items = JollyQuick.recentViewed().slice(0, 8);
    if (!items.length) return '';
    return `
      <div class="section-title" style="margin-top:18px;">🕘 Son baxdıqların</div>
      <div class="recent-strip">
        ${items.map(p => `
          <div class="recent-cell" onclick="JollyRouter.go('#/product/${p.id}')">
            <div class="rc-thumb">${p.images && p.images[0] ? `<img ${typeof JollyStorage!=='undefined'?JollyStorage.imgAttr(p.images[0]):'src="'+p.images[0]+'"'}>` : '🧴'}</div>
            <div class="rc-name">${JollyProducts.escapeHtml(p.name||'Adsız')}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderCard(c) {
    const badge = badgeValue(c);
    const click = c.action ? c.action : `JollyRouter.go('${c.route}')`;
    return `
      <div class="glass dash-card neon-${c.neon || 'blue'}" onclick="${click}">
        ${badge && badge > 0 ? `<span class="dash-badge">${badge > 99 ? '99+' : badge}</span>` : ''}
        <div class="dc-icon">${c.icon}</div>
        <div class="dc-label">${c.label}</div>
        <div class="dc-sub">${c.sub || ''}</div>
      </div>
    `;
  }

  let _quickPhotoBusy = false;
  function quickPhoto(source) {
    if (_quickPhotoBusy) return;
    if (!source) {
      const choice = confirm('Kameranı aç? (İmtina = Qalereyadan seç)');
      source = choice ? 'camera' : 'gallery';
    }
    _quickPhotoBusy = true;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) { _quickPhotoBusy = false; return; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let img = ev.target.result;
        if (typeof JollyStorage !== 'undefined' && JollyStorage.compressImage) {
          try { img = await JollyStorage.compressImage(img); } catch (er) {}
        }
        JollyDB.Drafts.add({ name: '', images: [img], barcodes: [], price: '', createdAt: Date.now() });
        if (typeof JollySound !== 'undefined') JollySound.success();
        const cnt = JollyDB.Drafts.all().length;
        Toast.success(`Gələn Mallara düşdü (${cnt}) — sonra tamamla`);
        _quickPhotoBusy = false;
        JollyApp.render();
      };
      reader.onerror = () => { _quickPhotoBusy = false; };
      reader.readAsDataURL(file);
    };
    setTimeout(() => { _quickPhotoBusy = false; }, 30000);
    input.click();
  }

  /* ============================================================
     SMART AXTARIŞ — "qırmızı köynək" kimi yazanda, rəngi VƏ adı
     birlikdə tanıyıb süzür. "Tez giriş" düyməsinin yerinə keçdi.
     ============================================================ */
  const COLOR_WORDS = {
    'qırmızı': 'qırmızı', 'qirmizi': 'qırmızı',
    'göy': 'göy', 'goy': 'göy', 'mavi': 'göy',
    'yaşıl': 'yaşıl', 'yasil': 'yaşıl',
    'sarı': 'sarı', 'sari': 'sarı',
    'qara': 'qara',
    'ağ': 'ağ', 'ag': 'ağ',
    'çəhrayı': 'çəhrayı', 'cehrayi': 'çəhrayı', 'pink': 'çəhrayı',
    'bənövşəyi': 'bənövşəyi', 'benovseyi': 'bənövşəyi', 'bənövşə': 'bənövşəyi',
    'narıncı': 'narıncı', 'narinci': 'narıncı',
    'boz': 'boz', 'gri': 'boz',
    'qəhvəyi': 'qəhvəyi', 'qehveyi': 'qəhvəyi',
    'gümüşü': 'gümüşü', 'gumusu': 'gümüşü',
    'qızılı': 'qızılı', 'qizili': 'qızılı', 'qızıl': 'qızılı',
  };

  function smartParseQuery(raw) {
    const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let color = null;
    const rest = [];
    words.forEach(w => {
      const clean = w.replace(/[^\wəıöüğşçİıĞŞÇÖÜ]/gi, '');
      if (!color && COLOR_WORDS[clean]) {
        color = COLOR_WORDS[clean];
      } else {
        rest.push(w);
      }
    });
    return { color, text: rest.join(' ').trim() };
  }

  function smartSearch(raw) {
    const { color, text } = smartParseQuery(raw);
    let list = JollyDB.Products.all();
    if (color) {
      list = list.filter(p => (p.color || '').toLowerCase().includes(color));
    }
    if (text) {
      const nq = text.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(nq) ||
        (p.barcodes || []).some(b => b.includes(text)) ||
        (p.mainCode || '').toLowerCase().includes(nq) ||
        (p.brand || '').toLowerCase().includes(nq) ||
        (p.group || '').toLowerCase().includes(nq)
      );
    }
    return { color, text, results: list.slice(0, 30) };
  }

  function injectSmartSearchStyles() {
    if (document.getElementById('jolly-smartsearch-styles')) return;
    const style = document.createElement('style');
    style.id = 'jolly-smartsearch-styles';
    style.textContent = `
      #jolly-ss-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 99999; display: flex; align-items: flex-start; justify-content: center; padding-top: 60px; }
      #jolly-ss-panel { background: #1a1a1a; width: 92%; max-width: 480px; max-height: 78vh; overflow-y: auto; border-radius: 18px; padding: 16px; border: 1px solid rgba(212,175,55,0.4); font-family: system-ui, sans-serif; color: #f0e6c8; }
      #jolly-ss-panel h3 { margin: 0 0 10px; font-size: 16px; color: #d4af37; display: flex; justify-content: space-between; align-items: center; }
      #jolly-ss-input { width: 100%; background: #232323; color: #f0e6c8; border: 1px solid #444; border-radius: 10px; padding: 12px 14px; font-size: 14px; box-sizing: border-box; margin-bottom: 10px; }
      .jss-hint { font-size: 11px; color: #999; margin-bottom: 12px; }
      .jss-result { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; background: #232323; margin-bottom: 6px; cursor: pointer; }
      .jss-thumb { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #333; }
      .jss-name { font-size: 13px; flex: 1; }
      .jss-meta { font-size: 10.5px; color: #999; }
      .jss-empty { text-align: center; color: #888; padding: 20px 0; font-size: 13px; }
    `;
    document.head.appendChild(style);
  }

  function renderSmartSearchResults(query) {
    const zone = document.getElementById('jolly-ss-results');
    if (!zone) return;
    if (!query.trim()) { zone.innerHTML = ''; return; }
    const { color, text, results } = smartSearch(query);
    const parsedHint = [color ? `rəng: ${color}` : null, text ? `mətn: "${text}"` : null].filter(Boolean).join(' · ');
    zone.innerHTML = `
      ${parsedHint ? `<div class="jss-hint">🔍 Tanındı — ${parsedHint}</div>` : ''}
      ${results.length ? results.map(p => {
        const thumb = (p.images && p.images[0])
          ? `<img class="jss-thumb" ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(p.images[0]) : 'src="' + p.images[0] + '"'}>`
          : `<div class="jss-thumb" style="display:flex;align-items:center;justify-content:center;">🧴</div>`;
        return `
          <div class="jss-result" onclick="JollyDashboard.closeSmartSearch();JollyRouter.go('#/product/${p.id}')">
            ${thumb}
            <div style="flex:1;min-width:0;">
              <div class="jss-name">${JollyProducts.escapeHtml(p.name || 'Adsız')}</div>
              <div class="jss-meta">${[p.color, p.brand].filter(Boolean).map(x => JollyProducts.escapeHtml(x)).join(' · ')}</div>
            </div>
          </div>
        `;
      }).join('') : '<div class="jss-empty">Nəticə tapılmadı</div>'}
    `;
  }

  function openSmartSearch() {
    injectSmartSearchStyles();
    let overlay = document.getElementById('jolly-ss-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'jolly-ss-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-ss-panel">
        <h3>🔍 Smart Axtarış <button onclick="JollyDashboard.closeSmartSearch()" style="background:none;border:none;color:#f0e6c8;font-size:20px;cursor:pointer;">&times;</button></h3>
        <input id="jolly-ss-input" placeholder='Məs: "qırmızı köynək"' autofocus>
        <div class="jss-hint">Rəng sözünü (qırmızı, göy, yaşıl, sarı, qara, ağ və s.) adla birlikdə yaz — ayrıca süzüləcək.</div>
        <div id="jolly-ss-results"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = document.getElementById('jolly-ss-input');
    input.oninput = () => renderSmartSearchResults(input.value);
    setTimeout(() => input.focus(), 50);
  }

  function closeSmartSearch() {
    const overlay = document.getElementById('jolly-ss-overlay');
    if (overlay) overlay.remove();
  }

  function renderIncomplete() {
    const items = JollyDB.Products.all().filter(x => !x.images || !x.images.length || !x.barcodes || !x.barcodes.length || x.price == null || x.price === '');
    return `
      ${backBtn()}
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">⚠️ Tamamlanmamış (${items.length})</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Toxun → düzəlt. Şəkil, barkod və ya qiymət çatışmır.</p>
      ${items.length ? `<div class="glass" style="padding:4px 14px;">
        ${items.map(p => {
          const missing = [];
          if (!p.images || !p.images.length) missing.push('şəkil');
          if (!p.barcodes || !p.barcodes.length) missing.push('barkod');
          if (p.price == null || p.price === '') missing.push('qiymət');
          return `<div class="list-row" onclick="JollyRouter.go('#/product/${p.id}/edit')">
            <span>${JollyProducts.escapeHtml(p.name || 'Adsız')}<br><span class="muted" style="font-size:11px;color:var(--accent-warn);">çatışmır: ${missing.join(', ')}</span></span>
            <span style="color:var(--accent-1);">düzəlt ›</span>
          </div>`;
        }).join('')}
      </div>` : '<div class="empty-state"><div class="big-icon">✅</div><h3>Hamısı tamamdır</h3></div>'}
    `;
  }

  function renderGallery() {
    const products = JollyDB.Products.all().filter(p => p.images && p.images.length);
    const drafts = JollyDB.Drafts.all().filter(d => d.images && d.images.length);
    const cells = [];
    products.forEach(p => p.images.forEach((img, i) => cells.push({ img, name: p.name, route: `#/product/${p.id}`, images: p.images, idx: i })));
    drafts.forEach(d => d.images.forEach((img, i) => cells.push({ img, name: (d.name || 'Qaralama'), route: `#/product/new?draft=${d.id}`, images: d.images, idx: i, draft: true })));
    return `
      ${backBtn()}
      <h2 style="font-family:var(--font-display);margin:0 0 14px;font-size:19px;">🖼️ Şəkil qalereyası (${cells.length})</h2>
      ${cells.length ? `<div class="gallery-grid">
        ${cells.map((c, i) => `
          <div class="gallery-cell anim-pop peekable" data-pki='${JollyProducts.escapeHtml(JSON.stringify(c.images))}' data-pkx="${c.idx}" onclick='JollyDashboard.openGalleryImage(${JollyProducts.escapeHtml(JSON.stringify(c.images))}, ${c.idx})' oncontextmenu="event.preventDefault();JollyRouter.go('${c.route}')">
            <img ${typeof JollyStorage !== 'undefined' ? JollyStorage.imgAttr(c.img) : 'src="' + c.img + '"'} loading="lazy">
            <div class="gc-name">${JollyProducts.escapeHtml(c.name)}${c.draft ? ' 📝' : ''}</div>
          </div>
        `).join('')}
      </div>
      <p class="muted" style="font-size:11.5px;margin-top:10px;">Toxun = böyüt · Şəklin altındakı ada toxun = məhsula keç</p>` :
      '<div class="empty-state"><div class="big-icon">🖼️</div><h3>Şəkil yoxdur</h3><p>Tez şəkil çək ilə başla.</p></div>'}
    `;
  }

  function renderRecent() {
    const items = JollyDB.Products.all().slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    setTimeout(() => {
      const el = document.getElementById('recentList');
      if (el && typeof JollyProducts !== 'undefined') {
        el.innerHTML = items.length ? `<div class="product-grid">${items.map(JollyProducts.renderCard).join('')}</div>` : '<div class="empty-state"><div class="big-icon">🕓</div><h3>Hələ məhsul yoxdur</h3></div>';
      }
    }, 0);
    return `
      ${backBtn()}
      <h2 style="font-family:var(--font-display);margin:0 0 14px;font-size:19px;">🕓 Son əlavələr</h2>
      <div id="recentList"></div>
    `;
  }

  function renderTrash() {
    JollyDB.Trash.purgeOld(30);
    const items = JollyDB.Trash.all();
    return `
      ${backBtn()}
      <h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🗑️ Silinənlər səbəti (${items.length})</h2>
      <p class="muted" style="font-size:12px;margin:0 0 14px;">Silinən məhsullar 30 gün burada qalır, sonra avtomatik təmizlənir.</p>
      ${items.length ? `
        <div class="glass" style="padding:4px 14px;">
          ${items.map(p => {
            const days = Math.max(0, 30 - Math.floor((Date.now() - (p.deletedAt||0)) / 864e5));
            return `<div class="list-row">
              <span>${JollyProducts.escapeHtml(p.name || 'Adsız')}<br><span class="muted" style="font-size:11px;">${days} gün qalıb</span></span>
              <span class="actions">
                <span onclick="JollyDashboard.restoreTrash('${p.id}')" style="color:var(--accent-2);">♻️ bərpa</span>
                <span onclick="JollyDashboard.purgeTrash('${p.id}')" style="color:var(--accent-danger);">✕</span>
              </span>
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:12px;" onclick="JollyDashboard.emptyTrash()">🧹 Səbəti tam boşalt</button>
      ` : '<div class="empty-state"><div class="big-icon">✨</div><h3>Səbət boşdur</h3></div>'}
    `;
  }

  function restoreTrash(id) {
    JollyDB.Trash.restore(id);
    if (typeof JollyApp !== 'undefined' && JollyApp.celebrate) JollyApp.celebrate();
    Toast.success('Məhsul bərpa olundu ♻️');
    JollyRouter.go('#/dashboard/trash');
  }
  function purgeTrash(id) {
    if (!confirm('Birdəfəlik silinsin? Bu geri qaytarıla bilməz!')) return;
    JollyDB.Trash.purge(id);
    Toast.info('Birdəfəlik silindi');
    JollyRouter.go('#/dashboard/trash');
  }
  function emptyTrash() {
    if (!confirm('Səbətdəki HƏR ŞEY birdəfəlik silinsin?')) return;
    JollyDB.Trash.emptyAll();
    Toast.info('Səbət boşaldıldı');
    JollyRouter.go('#/dashboard/trash');
  }

  function renderFavorites() {
    const items = JollyDB.getFavorites();
    setTimeout(() => {
      const el = document.getElementById('favList');
      if (el) el.innerHTML = items.length
        ? `<div class="product-grid">${items.map(JollyProducts.renderCard).join('')}</div>`
        : '<div class="empty-state"><div class="big-icon">⭐</div><h3>Favori yoxdur</h3><p class="muted">Məhsul detalında ☆ işarəsinə bas.</p></div>';
    }, 0);
    return `
      ${backBtn()}
      <h2 style="font-family:var(--font-display);margin:0 0 14px;font-size:19px;">⭐ Favorilər (${items.length})</h2>
      <div id="favList"></div>
    `;
  }

  function renderStudio() {
    const cfg = getConfig();
    const inDash = cfg.items;
    const available = CATALOG.filter(c => !inDash.includes(c.id));
    setTimeout(() => attachDrag(), 0);
    return `
      ${backBtn()}
      <h2 style="font-family:var(--font-display);margin:0 0 6px;font-size:19px;">🎛️ Dashboard Studio</h2>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px;">Kartları idarə et — gizlət (silinmir), əlavə et, sürüşdürüb sırala.</p>

      <div class="glass" style="padding:12px 14px;margin-bottom:14px;">
        <div class="row between">
          <span>💡 "Bu gün diqqət" zolağı</span>
          <label style="display:flex;align-items:center;"><input type="checkbox" ${cfg.attention !== false ? 'checked' : ''} onchange="JollyDashboard.toggleAttention(this.checked)"></label>
        </div>
      </div>

      <div class="section-title">Dashboard-da olanlar — sürüşdür, sırala</div>
      <div class="glass" style="padding:4px 14px;" id="dashStudioList">
        ${inDash.map(id => {
          const c = CATALOG.find(x => x.id === id);
          if (!c) return '';
          return `<div class="list-row" data-id="${id}">
            <span>☰ ${c.icon} ${c.label}</span>
            <span class="actions"><span onclick="JollyDashboard.removeItem('${id}')" style="color:var(--accent-warn);">gizlət</span></span>
          </div>`;
        }).join('')}
      </div>

      <div class="section-title">Əlavə et</div>
      <div class="glass" style="padding:4px 14px;">
        ${available.length ? available.map(c => `
          <div class="list-row">
            <span>${c.icon} ${c.label}</span>
            <span class="actions"><span onclick="JollyDashboard.addItem('${c.id}')" style="color:var(--accent-2);">+ əlavə</span></span>
          </div>
        `).join('') : '<div class="muted" style="padding:14px;">Hamısı Dashboard-dadır</div>'}
      </div>
    `;
  }

  function attachDrag() {
    const container = document.getElementById('dashStudioList');
    if (!container) return;
    container.querySelectorAll('.list-row').forEach(row => {
      let dragging = false;
      row.addEventListener('touchstart', () => { dragging = true; row.style.opacity = '0.4'; }, { passive: true });
      row.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        e.preventDefault();
        const y = e.touches[0].clientY;
        const rows = [...container.querySelectorAll('.list-row')].filter(r => r !== row);
        const after = rows.find(r => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
        if (after) container.insertBefore(row, after); else container.appendChild(row);
      }, { passive: false });
      row.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false; row.style.opacity = '1';
        const ids = [...container.querySelectorAll('.list-row')].map(r => r.dataset.id);
        const cfg = getConfig(); cfg.items = ids; setConfig(cfg);
      });
    });
  }

  function addItem(id) {
    const cfg = getConfig();
    if (!cfg.items.includes(id)) { cfg.items.push(id); setConfig(cfg); }
    Toast.success('Əlavə olundu');
    JollyRouter.go('#/dashboard/studio');
  }
  function removeItem(id) {
    const cfg = getConfig();
    cfg.items = cfg.items.filter(x => x !== id);
    setConfig(cfg);
    Toast.info('Gizlədildi (Əlavə et-dən qaytara bilərsən)');
    JollyRouter.go('#/dashboard/studio');
  }
  function toggleAttention(on) {
    const cfg = getConfig(); cfg.attention = on; setConfig(cfg);
    Toast.success(on ? 'Diqqət zolağı açıq' : 'Diqqət zolağı bağlı');
  }

  function backBtn() {
    return `<div class="back-btn anim-slide" onclick="JollyApp.goBack()">‹ Geri</div>`;
  }

  async function openGalleryImage(images, idx) {
    let resolved = images;
    if (typeof JollyStorage !== 'undefined') resolved = await JollyStorage.resolveAll(images);
    JollyViewer.open(resolved, idx);
  }

  return {
    render, renderIncomplete, renderGallery, renderRecent, renderStudio, openGalleryImage,
    renderTrash, renderFavorites, restoreTrash, purgeTrash, emptyTrash,
    quickPhoto, toggleFab, fabAction, addItem, removeItem, toggleAttention, getConfig, CATALOG,
    openSmartSearch, closeSmartSearch, smartSearch,
  };
})();
