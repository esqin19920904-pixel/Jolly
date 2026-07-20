/* ============================================================
   JOLLY Users — Fərdi İstifadəçi Sistemi (v1)
   Addım 1: hər işçi üçün ayrıca Ad + PIN + Status.
   "User" artıq ümumi rol deyil — hər kəsin öz kartıdır.
   ============================================================ */
const JollyUsers = (() => {

  const STORE_KEY = 'jolly_users_v1';
  const AUDIT_KEY = 'jolly_perm_audit_v2'; // İcazə Mərkəzi ilə eyni jurnal

  // ── PIN hash (security.js ilə eyni alqoritm — FNV-1a) ─────
  function hashPin(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < String(s).length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  function genId() {
    return 'U' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  // ── Storage ─────────────────────────────────────────────
  function _read() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function _write(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
      if (window.JollyCloud && JollyCloud.scheduleSync) JollyCloud.scheduleSync();
      return true;
    }
    catch (e) { return false; }
  }

  // ── Audit (İcazə Mərkəzi-dəki eyni jurnala yazır) ─────────
  function _audit(action, details, actorName) {
    try {
      const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      logs.unshift({
        action, details,
        actor: actorName || 'admin',
        ts: Date.now(),
        date: new Date().toLocaleString('az-AZ'),
      });
      localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 500)));
    } catch (e) {}
  }

  // ── CRUD ────────────────────────────────────────────────
  function list() { return _read(); }

  function get(id) { return _read().find(u => u.id === id) || null; }

  function getByName(name) {
    const n = String(name).trim().toLowerCase();
    return _read().find(u => u.name.toLowerCase() === n) || null;
  }

  // add({ name, pin, phone, avatar })
  function add({ name, pin, phone = '', avatar = '' }) {
    if (!name || !String(name).trim()) return { ok: false, error: 'Ad boş ola bilməz' };
    if (!pin || !/^\d{7}$/.test(String(pin))) return { ok: false, error: 'PIN düz 7 rəqəm olmalıdır' };
    const list = _read();
    if (list.some(u => u.name.toLowerCase() === name.trim().toLowerCase())) {
      return { ok: false, error: 'Bu adda istifadəçi artıq var' };
    }
    const user = {
      id: genId(),
      name: name.trim(),
      pinHash: hashPin(pin),
      phone,
      avatar,
      role: 'user',
      status: 'active', // active | blocked
      createdAt: Date.now(),
      lastLogin: null,
      lastActivity: null,
    };
    list.push(user);
    _write(list);
    _audit('user_created', { id: user.id, name: user.name });
    return { ok: true, user };
  }

  function update(id, patch) {
    const list = _read();
    const idx = list.findIndex(u => u.id === id);
    if (idx === -1) return { ok: false, error: 'İstifadəçi tapılmadı' };

    // PIN dəyişirsə, formatı yoxla və hash-lə
    if (patch.pin) {
      if (!/^\d{7}$/.test(String(patch.pin))) return { ok: false, error: 'PIN düz 7 rəqəm olmalıdır' };
      patch = { ...patch, pinHash: hashPin(patch.pin) };
      delete patch.pin;
    }
    list[idx] = { ...list[idx], ...patch };
    _write(list);
    _audit('user_updated', { id, changed: Object.keys(patch) });
    return { ok: true, user: list[idx] };
  }

  function setStatus(id, status) {
    const r = update(id, { status });
    if (r.ok) _audit(status === 'blocked' ? 'user_blocked' : 'user_unblocked', { id, name: r.user.name });
    return r;
  }

  function remove(id) {
    const list = _read();
    const user = list.find(u => u.id === id);
    const next = list.filter(u => u.id !== id);
    _write(next);
    if (user) _audit('user_deleted', { id, name: user.name });
    return { ok: true };
  }

  // ── Giriş: PIN-ə görə aktiv istifadəçi tap ───────────────
  function verifyPin(pin) {
    const h = hashPin(pin);
    const user = _read().find(u => u.pinHash === h && u.status === 'active');
    if (!user) return null;
    touchLogin(user.id);
    return user;
  }

  // Ad artıq seçilibsə — yalnız həmin şəxsin PIN-inə uyğun gəlirmi yoxla
  function verifyUserPin(id, pin) {
    const h = hashPin(pin);
    const user = _read().find(u => u.id === id && u.status === 'active');
    if (!user || user.pinHash !== h) return null;
    touchLogin(user.id);
    return user;
  }

  function touchLogin(id) {
    update(id, { lastLogin: Date.now() });
    const u = get(id);
    if (u) _audit('login', { id, name: u.name }, u.name);
  }

  function touchActivity(id) {
    const list = _read();
    const idx = list.findIndex(u => u.id === id);
    if (idx === -1) return;
    list[idx].lastActivity = Date.now();
    _write(list);
  }

  return {
    list, get, getByName,
    add, update, setStatus, remove,
    verifyPin, verifyUserPin, touchLogin, touchActivity,
  };
})();

window.JollyUsers = JollyUsers;
