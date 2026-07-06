/* ============================================================
   JOLLY Module Registry — Modul Əməliyyat Sistemi
   Bütün modulları qeydiyyatdan keçirir, idarə edir, göstərir.
   Yeni modul əlavə etmək: fayl yarat → ModuleRegistry.register(obj) → index.html-ə qoş.
   ============================================================ */
const ModuleRegistry = (() => {
  const _modules = {};          // id → module obyekti
  const _order = [];            // qeydiyyat sırası
  const STATE_KEY = 'jolly_module_state'; // enabled/disabled saxlanılır

  function _loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function _saveState(s) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* ---------- Qeydiyyat ---------- */
  function register(mod) {
    if (!mod || !mod.id) { console.warn('ModuleRegistry: id olmayan modul'); return false; }
    if (_modules[mod.id]) { console.warn('ModuleRegistry: təkrar id →', mod.id); return false; }
    // Defolt sahələr
    mod.name = mod.name || mod.id;
    mod.icon = mod.icon || '📦';
    mod.route = mod.route || ('#/' + mod.id);
    mod.group = mod.group || 'Digər';
    mod.enabled = mod.enabled !== false;
    mod.inMenu = mod.inMenu === true;   // bottom nav-da görünsün?
    mod.inEdge = mod.inEdge === true;   // edge panel-də görünsün?
    // Yadda saxlanmış enabled/disabled vəziyyətini tətbiq et
    const st = _loadState();
    if (st[mod.id] && typeof st[mod.id].enabled === 'boolean') mod.enabled = st[mod.id].enabled;
    _modules[mod.id] = mod;
    _order.push(mod.id);
    // init() çağır (əgər varsa və enabled-dirsə)
    if (mod.enabled && typeof mod.init === 'function') {
      try { mod.init(); } catch (e) { console.error('Modul init xətası (' + mod.id + '):', e); }
    }
    return true;
  }

  function unregister(id) {
    if (!_modules[id]) return false;
    if (typeof _modules[id].destroy === 'function') { try { _modules[id].destroy(); } catch (e) {} }
    delete _modules[id];
    const i = _order.indexOf(id);
    if (i >= 0) _order.splice(i, 1);
    return true;
  }

  /* ---------- Sorğu ---------- */
  function get(id) { return _modules[id] || null; }
  function list(opts) {
    opts = opts || {};
    let arr = _order.map(id => _modules[id]).filter(Boolean);
    if (opts.enabledOnly) arr = arr.filter(m => m.enabled);
    if (opts.group) arr = arr.filter(m => m.group === opts.group);
    if (opts.inMenu) arr = arr.filter(m => m.inMenu);
    if (opts.inEdge) arr = arr.filter(m => m.inEdge);
    return arr;
  }
  function groups() {
    const g = {};
    list({ enabledOnly: true }).forEach(m => { (g[m.group] = g[m.group] || []).push(m); });
    return g;
  }

  /* ---------- Aç / bağla ---------- */
  function enable(id) {
    const m = _modules[id]; if (!m) return false;
    m.enabled = true;
    const st = _loadState(); st[id] = st[id] || {}; st[id].enabled = true; _saveState(st);
    if (typeof m.init === 'function') { try { m.init(); } catch (e) {} }
    return true;
  }
  function disable(id) {
    const m = _modules[id]; if (!m) return false;
    m.enabled = false;
    const st = _loadState(); st[id] = st[id] || {}; st[id].enabled = false; _saveState(st);
    return true;
  }
  function toggle(id) {
    const m = _modules[id]; if (!m) return false;
    return m.enabled ? disable(id) : enable(id);
  }

  /* ---------- Menyu / Edge ---------- */
  function addToMenu(id) { const m = _modules[id]; if (m) { m.inMenu = true; return true; } return false; }
  function removeFromMenu(id) { const m = _modules[id]; if (m) { m.inMenu = false; return true; } return false; }
  function addToEdge(id) { const m = _modules[id]; if (m) { m.inEdge = true; return true; } return false; }
  function removeFromEdge(id) { const m = _modules[id]; if (m) { m.inEdge = false; return true; } return false; }

  /* ---------- Route → səhifə render ---------- */
  // hash "#/map" və ya "#/map/alt" → uyğun modulu tapıb render() çağırır
  function renderPage(hash) {
    hash = hash || window.location.hash || '';
    // Route uyğunluğu: modul.route ilə başlayırsa
    let found = null, rest = '';
    for (const id of _order) {
      const m = _modules[id];
      if (!m || !m.enabled) continue;
      const base = m.route; // məs "#/map"
      if (hash === base) { found = m; rest = ''; break; }
      if (hash.startsWith(base + '/')) { found = m; rest = hash.slice(base.length + 1); break; }
    }
    if (!found) return null; // registry bu route-u tanımır (app.js öz köhnə route-larına baxsın)
    try {
      const html = found.render(rest);
      // afterRender varsa app.js çağıracaq üçün qaytar
      return { html: html, module: found, after: found.afterRender || null };
    } catch (e) {
      console.error('Modul render xətası (' + found.id + '):', e);
      return { html: '<div class="empty-state"><div class="big-icon">⚠️</div><h3>' + found.name + ' xətası</h3><p>' + (e.message || '') + '</p></div>', module: found, after: null };
    }
  }

  /* ---------- Studios/menyu üçün görünüş ---------- */
  function renderModuleManager() {
    const gs = groups();
    let html = '<h2 style="font-family:var(--font-display);margin:0 0 4px;font-size:19px;">🧩 Modullar</h2>';
    html += '<p class="muted" style="font-size:12px;margin:0 0 16px;">Bütün modulları burada aç/bağla, menyuya əlavə et.</p>';
    Object.keys(gs).sort().forEach(group => {
      html += '<div class="section-title">' + group + '</div>';
      html += '<div class="glass" style="padding:6px 14px;margin-bottom:12px;">';
      gs[group].forEach(m => {
        html += '<div class="list-row" style="cursor:pointer;" onclick="JollyRouter.go(\'' + m.route + '\')">' +
          '<span>' + m.icon + ' ' + m.name + '</span>' +
          '<span class="muted" style="font-size:11px;">' + m.route + '</span>' +
          '</div>';
      });
      html += '</div>';
    });
    return html;
  }

  return {
    register, unregister, get, list, groups,
    enable, disable, toggle,
    addToMenu, removeFromMenu, addToEdge, removeFromEdge,
    renderPage, renderModuleManager,
    _all: () => _modules,
  };
})();
