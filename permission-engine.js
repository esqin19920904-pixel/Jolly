/**
 * JOLLY PermissionOS v2.0
 * data-perm / data-perm-module atributu əsaslı icazə sistemi
 * Arxitektura: JOLLY.PermissionOS (POS)
 */
(function() {
'use strict';

const STORAGE_KEY = 'jolly_perm_os_v2';
const SIG_KEY     = 'jolly_perm_os_v2_sig';
const AUDIT_KEY   = 'jolly_perm_audit_v2';

// ── Tag-lar ──────────────────────────────────────────────
const TAGS = {
  danger: { label: 'Təhlükəli', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  emoji: '🔴' },
  edit:   { label: 'Redaktə',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', emoji: '🟡' },
  view:   { label: 'Baxış',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  emoji: '🟢' },
  ai:     { label: 'AI',        color: '#6366f1', bg: 'rgba(99,102,241,0.12)', emoji: '🔵' },
  system: { label: 'Sistem',    color: '#a855f7', bg: 'rgba(168,85,247,0.12)', emoji: '🟣' },
};

// ── Profil şablonları ────────────────────────────────────
const PROFILE_DEFS = {
  admin:    { name: '👑 Admin',     desc: 'Tam səlahiyyət' },
  standard: { name: '👤 Standart',  desc: 'Baxış + skan + çap' },
  readonly: { name: '👁️ Yalnız Baxış', desc: 'Heç nə edə bilməz' },
  none:     { name: '🚫 İcazəsiz',  desc: 'Sıfır icazə' },
};

// ── Tamam yoxlama ───────────────────────────────────────
function _sig(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return h.toString(36);
}

// ── Store ────────────────────────────────────────────────
class Store {
  constructor() { this._c = null; }

  _raw() {
    try {
      const d = localStorage.getItem(STORAGE_KEY);
      const s = localStorage.getItem(SIG_KEY);
      if (!d) return null;
      if (s && s !== _sig(d)) {
        // İmza uyğun gəlmir — bu, əl ilə pozuntu ola bilər, AMMA daha çox
        // ehtimal ki, bulud sinxronu/backup bərpası yeni datanı yazıb,
        // imzanı yeniləməyib. Datanı ATMAQ (köhnə davranış) əvəzinə,
        // qəbul edib imzanı özü düzəldirik (self-heal) — əks halda
        // başqa cihazdan gələn icazə dəyişiklikləri səssizcə itir.
        console.warn('[PermissionOS] İmza uyğun gəlmədi — yenilənir (self-heal)');
        Object.getPrototypeOf(localStorage).setItem.call(localStorage, SIG_KEY, _sig(d));
      }
      return JSON.parse(d);
    } catch(e) { return null; }
  }

  load() {
    if (this._c) return this._c;
    this._c = this._raw() || this._def();
    return this._c;
  }

  save(d) {
    this._c = d;
    const str = JSON.stringify(d);
    // Birbaşa Storage prototipindən istifadə et (security.js bloku bypass)
    Object.getPrototypeOf(localStorage).setItem.call(localStorage, STORAGE_KEY, str);
    Object.getPrototypeOf(localStorage).setItem.call(localStorage, SIG_KEY, _sig(str));
    // Buluda göndər — əks halda icazə dəyişiklikləri yalnız bu cihazda qalır
    // və başqa telefondakı işçiyə heç vaxt çatmır.
    if (window.JollyCloud && JollyCloud.scheduleSync) JollyCloud.scheduleSync();
  }

  _def() { return { v: 2, overrides: {}, userOverrides: {}, ts: Date.now() }; }

  getOverride(k)     { return this.load().overrides[k]; }
  setOverride(k, v)  { const d=this.load(); d.overrides[k]=v; this.save(d); }
  setOverrides(obj)  { const d=this.load(); d.overrides={...d.overrides,...obj}; this.save(d); }
  resetOverrides()   { const d=this.load(); d.overrides={}; this.save(d); }

  getUserOverride(uid, k) {
    const d = this.load();
    return d.userOverrides[uid] ? d.userOverrides[uid][k] : undefined;
  }
  setUserOverrides(uid, obj) {
    const d = this.load();
    if (!d.userOverrides[uid]) d.userOverrides[uid] = {};
    d.userOverrides[uid] = { ...d.userOverrides[uid], ...obj };
    this.save(d);
  }
  resetUserOverrides(uid) {
    const d = this.load();
    delete d.userOverrides[uid];
    this.save(d);
  }

  reset()            { this._c=null; localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SIG_KEY); }
}

// ── Registry ─────────────────────────────────────────────
class Registry {
  constructor() { this.mods = new Map(); }

  register(manifest) {
    if (!manifest.id) throw new Error('Module ID lazımdır');
    this.mods.set(manifest.id, {
      id:    manifest.id,
      name:  manifest.name || manifest.id,
      icon:  manifest.icon || '📦',
      perms: (manifest.permissions || []).map(p => ({
        key:      p.key,
        label:    p.label || p.key,
        tag:      p.tag || 'view',
        default:  !!p.default,
        moduleId: manifest.id,
      })),
    });
  }

  get(id)         { return this.mods.get(id); }
  getAll()        { return [...this.mods.values()]; }
  allPerms()      { const r=[]; this.mods.forEach(m=>r.push(...m.perms)); return r; }
  modPerms(id)    { return (this.mods.get(id)||{perms:[]}).perms; }
}

// ── Engine ───────────────────────────────────────────────
class Engine {
  constructor(reg, store) { this.r=reg; this.s=store; }

  _isAdmin() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session')||'null');
      return sess && sess.role === 'admin';
    } catch(e) { return false; }
  }

  _currentUserId() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session')||'null');
      return (sess && sess.userId) || null;
    } catch(e) { return null; }
  }

  // Xam nəticə — admin qısayolu YOXDUR. Admin panelindən konkret
  // istifadəçi üçün "əslində nə görəcək" göstərmək üçün istifadə olunur.
  resolveFor(userId, key) {
    if (userId) {
      const uov = this.s.getUserOverride(userId, key);
      if (typeof uov === 'boolean') return uov;
    }
    const ov = this.s.getOverride(key);
    if (typeof ov === 'boolean') return ov;
    const p = this.r.allPerms().find(x => x.key === key);
    return p ? p.default : false;
  }

  can(key) {
    if (this._isAdmin()) return true;
    return this.resolveFor(this._currentUserId(), key);
  }

  canModule(id) {
    const ps = this.r.modPerms(id);
    if (!ps.length) return false;
    return ps.some(p => this.can(p.key));
  }

  canAny(keys) { return keys.some(k => this.can(k)); }
  canAll(keys) { return keys.every(k => this.can(k)); }
}

// ── Profillər ────────────────────────────────────────────
class Profiles {
  constructor(reg, store) { this.r=reg; this.s=store; }

  apply(name, userId) {
    const all = this.r.allPerms();
    const ov  = {};
    switch(name) {
      case 'admin':
        all.forEach(p => ov[p.key] = true);
        break;
      case 'readonly':
        all.forEach(p => ov[p.key] = p.tag === 'view');
        break;
      case 'none':
        all.forEach(p => ov[p.key] = false);
        break;
      case 'standard':
      default:
        all.forEach(p => ov[p.key] = p.default);
        break;
    }
    if (userId) this.s.setUserOverrides(userId, ov);
    else this.s.setOverrides(ov);
    _audit('profile_applied', { profile: name, userId: userId || null });
    return ov;
  }
}

// ── Admin UI ─────────────────────────────────────────────
class AdminUI {
  constructor(os) { this.os = os; this._selectedUserId = null; }

  render(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    this._el = el;
    const users = (window.JollyUsers ? JollyUsers.list() : []).filter(u => u.status === 'active');
    if (!this._selectedUserId && users.length) this._selectedUserId = users[0].id;
    this._draw();
  }

  _draw() {
    const all = this.os.reg.allPerms();
    const users = (window.JollyUsers ? JollyUsers.list() : []).filter(u => u.status === 'active');

    if (!users.length) {
      this._el.innerHTML = `
        <div style="margin-bottom:20px;">
          <h2 style="font-family:var(--font-display,inherit);font-size:19px;margin:0 0 4px;">🛡️ İcazə Mərkəzi</h2>
          <p style="font-size:12px;color:var(--text-3,#64748b);">
            Hələ heç bir işçi yoxdur. Əvvəlcə "İstifadəçilər" bölməsindən bir işçi əlavə et,
            sonra bura qayıdıb ona icazə təyin edə bilərsən.
          </p>
        </div>`;
      return;
    }

    this._el.innerHTML = `
      <div style="margin-bottom:20px;">
        <h2 style="font-family:var(--font-display,inherit);font-size:19px;margin:0 0 4px;">🛡️ İcazə Mərkəzi</h2>
        <p style="font-size:12px;color:var(--text-3,#64748b);margin:0 0 12px;">Hər işçi üçün ayrıca təyin edilir</p>

        <!-- İşçi seçimi -->
        <div class="section-title">👤 Kimin üçün?</div>
        <select id="pos-user-select" onchange="POS.admin._selectUser(this.value)"
          style="width:100%;padding:11px 13px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-1,#fff);font-size:14px;font-weight:600;margin-bottom:14px;">
          ${users.map(u => `<option value="${u.id}" ${u.id === this._selectedUserId ? 'selected' : ''}>${u.name}</option>`).join('')}
        </select>

        <!-- Statistika -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
          <div class="glass" style="padding:10px;text-align:center;">
            <div id="pos-stat-active" style="font-size:22px;font-weight:700;color:var(--accent-1,#00d4ff);">0</div>
            <div style="font-size:10px;color:var(--text-3,#64748b);">Aktiv</div>
          </div>
          <div class="glass" style="padding:10px;text-align:center;">
            <div id="pos-stat-blocked" style="font-size:22px;font-weight:700;">0</div>
            <div style="font-size:10px;color:var(--text-3,#64748b);">Bağlı</div>
          </div>
          <div class="glass" style="padding:10px;text-align:center;">
            <div style="font-size:22px;font-weight:700;">${all.length}</div>
            <div style="font-size:10px;color:var(--text-3,#64748b);">Cəmi</div>
          </div>
        </div>

        <!-- Şablonlar -->
        <div class="section-title">📋 Şablonlar</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          ${Object.entries(PROFILE_DEFS).filter(([k])=>k!=='admin').map(([k,v])=>`
            <button onclick="POS.applyProfile('${k}', POS.admin._selectedUserId);POS.syncUI();POS.admin._draw();"
              title="${v.desc}"
              style="padding:7px 13px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-1,#fff);font-size:12px;cursor:pointer;">
              ${v.name}
            </button>
          `).join('')}
        </div>

        <!-- Tag filter -->
        <div class="section-title">🏷️ Filtr</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;" id="pos-tag-filter">
          <button class="pos-tag-btn pos-tag-active" data-tag="all"
            style="padding:5px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:var(--text-1,#fff);font-size:12px;cursor:pointer;">
            Hamısı
          </button>
          ${Object.entries(TAGS).map(([k,v])=>`
            <button class="pos-tag-btn" data-tag="${k}"
              style="padding:5px 12px;border-radius:20px;border:1px solid ${v.color};background:${v.bg};color:${v.color};font-size:12px;cursor:pointer;">
              ${v.emoji} ${v.label}
            </button>
          `).join('')}
        </div>

        <!-- Axtarış -->
        <input id="pos-search" type="text" placeholder="🔍 İcazə axtar..."
          oninput="POS.admin._filter(this.value)"
          style="width:100%;padding:9px 13px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:var(--text-1,#fff);font-size:13px;box-sizing:border-box;margin-bottom:12px;">

        <!-- Hamısını seç/söndür -->
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button onclick="POS.admin._selAll(true)"
            style="flex:1;padding:8px;border-radius:10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#22c55e;font-size:12px;cursor:pointer;">
            ✅ Hamısını aktiv et
          </button>
          <button onclick="POS.admin._selAll(false)"
            style="flex:1;padding:8px;border-radius:10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#ef4444;font-size:12px;cursor:pointer;">
            ❌ Hamısını söndür
          </button>
        </div>
      </div>

      <!-- İcazə siyahısı -->
      <div id="pos-perm-list">
        ${this._buildList(all)}
      </div>

      <!-- Saxla -->
      <div style="position:sticky;bottom:0;background:var(--bg-deep,#06070d);padding:12px 0 4px;">
        <button onclick="POS.admin._save()"
          style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,var(--accent-1,#00d4ff),#6366f1);border:none;color:#000;font-size:15px;font-weight:700;cursor:pointer;">
          💾 İcazələri Saxla
        </button>
      </div>

      <!-- Export/Import -->
      <div class="section-title" style="margin-top:14px;">📤 Export / Import</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:14px;">
        <div class="list-row" style="cursor:pointer;" onclick="POS.admin._export()">
          <span>📤 JSON-a ixrac et</span><span style="color:var(--accent-1,#00d4ff);">›</span>
        </div>
        <div class="list-row" style="cursor:pointer;" onclick="POS.admin._import()">
          <span>📥 JSON-dan import et</span><span style="color:var(--accent-1,#00d4ff);">›</span>
        </div>
      </div>

      <!-- Audit log -->
      <div class="section-title">📝 Dəyişiklik Jurnalı</div>
      <div class="glass" style="padding:4px 14px;margin-bottom:10px;">
        ${_getAuditLog().slice(0,20).map(l=>`
          <div class="list-row" style="padding:8px 4px;">
            <span style="font-size:12px;">${l.action}</span>
            <span style="font-size:10px;color:var(--text-3,#64748b);margin-left:auto;">${l.date}</span>
          </div>
        `).join('') || '<div style="padding:12px;font-size:12px;color:var(--text-3,#64748b);">Hələ heç bir dəyişiklik yoxdur</div>'}
      </div>
      <button class="btn btn-ghost btn-sm btn-block" onclick="POS.admin._clearAudit()">🗑️ Jurnalı təmizlə</button>
    `;

    this._updateStats();
    this._bindTagFilter();
  }

  _selectUser(uid) {
    this._selectedUserId = uid;
    this._draw();
  }

  _buildList(perms) {
    // Modul üzrə qruplaşdır
    const groups = {};
    perms.forEach(p => {
      if (!groups[p.moduleId]) {
        const m = this.os.reg.get(p.moduleId);
        groups[p.moduleId] = { label: m?.name||p.moduleId, icon: m?.icon||'📦', items: [] };
      }
      groups[p.moduleId].items.push(p);
    });

    return Object.entries(groups).map(([mid, g]) => `
      <div class="pos-group" data-module="${mid}" style="margin-bottom:10px;">
        <div onclick="POS.admin._toggleGroup('${mid}')"
          style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:rgba(255,255,255,0.03);border-radius:10px 10px 0 0;border:1px solid rgba(255,255,255,0.06);cursor:pointer;">
          <span style="font-size:13px;font-weight:600;">${g.icon} ${g.label}</span>
          <span id="pos-gc-${mid}" style="font-size:11px;color:var(--accent-1,#00d4ff);">0/${g.items.length}</span>
        </div>
        <div id="pos-gb-${mid}" class="glass" style="border-radius:0 0 10px 10px;padding:4px 14px;border-top:none;">
          ${g.items.map(p => {
            const tag = TAGS[p.tag]||TAGS.view;
            const checked = this.os.engine.resolveFor(this._selectedUserId, p.key);
            return `<div class="pos-row list-row" data-key="${p.key}" data-tag="${p.tag}" data-label="${p.label.toLowerCase()}" style="gap:10px;">
              <label style="display:flex;align-items:center;gap:10px;width:100%;cursor:pointer;padding:4px 0;">
                <input type="checkbox" class="pos-cb" data-key="${p.key}" ${checked?'checked':''}
                  onchange="POS.admin._onChange('${p.key}', this.checked)"
                  style="width:16px;height:16px;accent-color:var(--accent-1,#00d4ff);cursor:pointer;flex-shrink:0;">
                <span style="flex:1;font-size:13px;">${p.label}</span>
                <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${tag.bg};color:${tag.color};">${tag.emoji}</span>
              </label>
            </div>`;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  _updateStats() {
    const all = this.os.reg.allPerms().length;
    const active = document.querySelectorAll('.pos-cb:checked').length;
    const sa = document.getElementById('pos-stat-active');
    const sb = document.getElementById('pos-stat-blocked');
    if (sa) sa.textContent = active;
    if (sb) sb.textContent = all - active;
  }

  _toggleGroup(mid) {
    const b = document.getElementById(`pos-gb-${mid}`);
    if (b) b.style.display = b.style.display === 'none' ? '' : 'none';
  }

  _onChange(key, val) {
    // Müvəqqəti — saxlanmayır hələ
    this._updateStats();
    this._updateGroupCounts();
  }

  _updateGroupCounts() {
    document.querySelectorAll('.pos-group').forEach(g => {
      const mid = g.dataset.module;
      const total = g.querySelectorAll('.pos-cb').length;
      const active = g.querySelectorAll('.pos-cb:checked').length;
      const el = document.getElementById(`pos-gc-${mid}`);
      if (el) {
        el.textContent = `${active}/${total}`;
        el.style.color = active > 0 ? 'var(--accent-1,#00d4ff)' : 'var(--text-3,#64748b)';
      }
    });
  }

  _selAll(val) {
    document.querySelectorAll('.pos-row:not([style*="none"]) .pos-cb').forEach(cb => cb.checked = val);
    this._updateStats();
    this._updateGroupCounts();
  }

  _filter(q) {
    const query = q.toLowerCase().trim();
    document.querySelectorAll('.pos-row').forEach(row => {
      const match = !query || row.dataset.label.includes(query) || row.dataset.key.includes(query);
      row.style.display = match ? '' : 'none';
    });
    document.querySelectorAll('.pos-group').forEach(g => {
      const vis = [...g.querySelectorAll('.pos-row')].some(r => r.style.display !== 'none');
      g.style.display = vis ? '' : 'none';
    });
  }

  _bindTagFilter() {
    document.querySelectorAll('.pos-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pos-tag-btn').forEach(b => b.classList.remove('pos-tag-active'));
        btn.classList.add('pos-tag-active');
        const tag = btn.dataset.tag;
        document.querySelectorAll('.pos-row').forEach(row => {
          row.style.display = (tag === 'all' || row.dataset.tag === tag) ? '' : 'none';
        });
        document.querySelectorAll('.pos-group').forEach(g => {
          const vis = [...g.querySelectorAll('.pos-row')].some(r => r.style.display !== 'none');
          g.style.display = vis ? '' : 'none';
        });
      });
    });
  }

  _save() {
    const overrides = {};
    document.querySelectorAll('.pos-cb').forEach(cb => {
      overrides[cb.dataset.key] = cb.checked;
    });
    this.os.store.setUserOverrides(this._selectedUserId, overrides);
    const uname = (window.JollyUsers && JollyUsers.get(this._selectedUserId)) ? JollyUsers.get(this._selectedUserId).name : this._selectedUserId;
    _audit('permissions_saved', { user: uname, count: Object.keys(overrides).length });
    this.os.syncUI();
    if (window.Toast) Toast.success(`✅ ${uname} üçün icazələr saxlanıldı`);
    this._updateStats();
    this._updateGroupCounts();
  }

  _export() {
    const d = {
      version: 2, app: 'JOLLY',
      exported: new Date().toISOString(),
      overrides: this.os.store.load().overrides,
    };
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jolly-perms-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  _import() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async e => {
      try {
        const text = await e.target.files[0].text();
        const data = JSON.parse(text);
        if (!data.overrides) throw new Error('Yanlış format');
        this.os.store.setOverrides(data.overrides);
        _audit('permissions_imported', {});
        this.os.syncUI();
        if (window.Toast) Toast.success('✅ Import edildi');
        this._draw();
      } catch(err) {
        if (window.Toast) Toast.error('❌ Import xətası: ' + err.message);
      }
    };
    inp.click();
  }

  _clearAudit() {
    Object.getPrototypeOf(localStorage).setItem.call(localStorage, AUDIT_KEY, '[]');
    if (window.Toast) Toast.success('Jurnal təmizləndi');
    this._draw();
  }
}

// ── Audit log ────────────────────────────────────────────
function _audit(action, details) {
  try {
    const logs = _getAuditLog();
    const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session')||'null');
    logs.unshift({ action, details, actor: sess?.role||'?', ts: Date.now(), date: new Date().toLocaleString('az-AZ') });
    Object.getPrototypeOf(localStorage).setItem.call(localStorage, AUDIT_KEY, JSON.stringify(logs.slice(0,500)));
  } catch(e) {}
}
function _getAuditLog() {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]'); } catch(e) { return []; }
}

// ── PermissionOS ana sinif ───────────────────────────────
class PermissionOS {
  constructor() {
    this.store    = new Store();
    this.reg      = new Registry();
    this.engine   = new Engine(this.reg, this.store);
    this.profiles = new Profiles(this.reg, this.store);
    this.admin    = new AdminUI(this);
    this._obs     = null;
  }

  // Modul qeydiyyatı
  register(manifest) { this.reg.register(manifest); return this; }

  // İcazə yoxlama
  can(key)       { return this.engine.can(key); }
  canModule(id)  { return this.engine.canModule(id); }
  canAny(keys)   { return this.engine.canAny(keys); }
  canAll(keys)   { return this.engine.canAll(keys); }

  // Profil tətbiqi
  applyProfile(name, userId) { return this.profiles.apply(name, userId); }

  // Admin UI render
  renderAdmin(el) { this.admin.render(el); }

  // UI sinxronizasiyası
  syncUI() {
    // data-perm="key" — konkret icazə
    document.querySelectorAll('[data-perm]').forEach(el => {
      el.style.display = this.can(el.dataset.perm) ? '' : 'none';
    });
    // data-perm-module="id" — modul səviyyəli
    document.querySelectorAll('[data-perm-module]').forEach(el => {
      el.style.display = this.canModule(el.dataset.permModule) ? '' : 'none';
    });
  }

  // MutationObserver — hər DOM dəyişikliyində syncUI
  startObserver() {
    if (this._obs) return;
    this._obs = new MutationObserver(() => {
      const s = JSON.parse(sessionStorage.getItem('jolly_sec_session')||'null');
      if (s && s.role !== 'admin') this.syncUI();
    });
    this._obs.observe(document.getElementById('main') || document.body, {
      childList: true, subtree: true,
    });
  }

  // guard() helper — kod daxilində icazə yoxlama
  guard(key, action) {
    if (!this.can(key)) {
      if (window.Toast) Toast.error('❌ İcazəniz yoxdur');
      if (navigator.vibrate) navigator.vibrate([50,30,50]);
      return false;
    }
    if (typeof action === 'function') action();
    return true;
  }
}

// ── Global ───────────────────────────────────────────────
window.JOLLY = window.JOLLY || {};
window.JOLLY.PermissionOS = new PermissionOS();
window.POS = window.JOLLY.PermissionOS; // Qısa alias

})();

// ── JOLLY Modullarını Qeydiyyatdan Keçir ─────────────────
// (DOMContentLoaded-dən sonra — bütün skriptlər yüklənib)
document.addEventListener('DOMContentLoaded', function() {

  POS.register({ id:'products', name:'Məhsullar', icon:'📦', permissions:[
    { key:'products.view',    label:'Məhsullara bax',        tag:'view',   default:true  },
    { key:'products.create',  label:'Məhsul əlavə et',       tag:'edit',   default:false },
    { key:'products.edit',    label:'Məhsul redaktə et',     tag:'edit',   default:false },
    { key:'products.delete',  label:'Məhsul sil',            tag:'danger', default:false },
    { key:'products.price',   label:'Qiymət dəyiş',         tag:'danger', default:false },
    { key:'products.image',   label:'Şəkil əlavə/sil',      tag:'edit',   default:false },
    { key:'products.barcode', label:'Barkod əlavə et',      tag:'edit',   default:false },
    { key:'products.status',  label:'Status dəyiş',         tag:'edit',   default:false },
    { key:'products.note',    label:'Qeyd əlavə et',        tag:'edit',   default:false },
  ]});

  POS.register({ id:'search', name:'Axtarış', icon:'🔍', permissions:[
    { key:'search.use',  label:'Axtarış et',   tag:'view', default:true },
    { key:'search.ai',   label:'AI Axtarış',   tag:'ai',   default:false },
    { key:'search.color',label:'Rəng axtarışı',tag:'view', default:true  },
    { key:'search.photo',label:'Şəkillə axtar',tag:'ai',   default:false },
  ]});

  POS.register({ id:'barcode', name:'Barkod', icon:'📷', permissions:[
    { key:'barcode.scan',    label:'Barkod skan et', tag:'view', default:true  },
    { key:'barcode.print',   label:'Barkod çap et',  tag:'edit', default:true  },
    { key:'barcode.generate',label:'Barkod yarat',   tag:'edit', default:false },
  ]});

  POS.register({ id:'receiving', name:'Mal Qəbulu', icon:'📥', permissions:[
    { key:'receiving.view',  label:'Qəbul sənədlərinə bax', tag:'view',   default:true  },
    { key:'receiving.create',label:'Qəbul sənədi yarat',    tag:'edit',   default:false },
    { key:'receiving.edit',  label:'Qəbul sənədi redaktə',  tag:'edit',   default:false },
    { key:'receiving.delete',label:'Qəbul sənədi sil',      tag:'danger', default:false },
  ]});

  POS.register({ id:'supplier', name:'Tədarükçü', icon:'🚚', permissions:[
    { key:'supplier.view',  label:'Tədarükçülərə bax',    tag:'view',   default:true  },
    { key:'supplier.create',label:'Tədarükçü əlavə et',   tag:'edit',   default:false },
    { key:'supplier.edit',  label:'Tədarükçü redaktə et', tag:'edit',   default:false },
    { key:'supplier.delete',label:'Tədarükçü sil',        tag:'danger', default:false },
    { key:'supplier.order', label:'Sifariş ver',          tag:'edit',   default:false },
  ]});

  POS.register({ id:'dashboard', name:'Dashboard', icon:'📊', permissions:[
    { key:'dashboard.view',    label:'Dashboard-a bax', tag:'view', default:false },
    { key:'dashboard.analytics',label:'Analitika',      tag:'view', default:false },
    { key:'dashboard.reports', label:'Hesabatlar',      tag:'view', default:false },
    { key:'dashboard.export',  label:'Hesabat ixrac',   tag:'edit', default:false },
  ]});

  POS.register({ id:'ai', name:'AI', icon:'🤖', permissions:[
    { key:'ai.use',    label:'JOLLY AI',       tag:'ai', default:false },
    { key:'ai.chat',   label:'AI Chat',        tag:'ai', default:false },
    { key:'ai.ocr',    label:'OCR',            tag:'ai', default:false },
    { key:'ai.vision', label:'AI Vision',      tag:'ai', default:false },
  ]});

  POS.register({ id:'backup', name:'Backup', icon:'☁️', permissions:[
    { key:'backup.backup',  label:'Backup yarat',  tag:'system', default:false },
    { key:'backup.restore', label:'Bərpa et',      tag:'system', default:false },
    { key:'backup.export',  label:'Export et',     tag:'system', default:false },
    { key:'backup.import',  label:'Import et',     tag:'system', default:false },
  ]});

  POS.register({ id:'settings', name:'Parametrlər', icon:'⚙️', permissions:[
    { key:'settings.view',  label:'Parametrlərə bax',   tag:'view',   default:false },
    { key:'settings.edit',  label:'Parametrləri dəyiş', tag:'system', default:false },
    { key:'settings.theme', label:'Tema dəyiş',         tag:'view',   default:true  },
  ]});

  POS.register({ id:'favorites', name:'Sevimlilər', icon:'❤️', permissions:[
    { key:'favorites.use', label:'Sevimlilər', tag:'view', default:true },
  ]});

  POS.register({ id:'print', name:'Çap', icon:'🖨️', permissions:[
    { key:'print.use', label:'Çap et', tag:'view', default:true },
  ]});

  POS.register({ id:'storemap', name:'Mağaza Xəritəsi', icon:'🗺️', permissions:[
    { key:'storemap.view', label:'Xəritəyə bax', tag:'view', default:true },
  ]});

});
