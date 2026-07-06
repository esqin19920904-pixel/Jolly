/* ============================================================
   JOLLY AI Shortcuts — Command Memory / Əmr yaddaşı
   İstifadəçi "qısayol = əmr" yazaraq JOLLY AI-yə qısa yollar öyrədir
   ============================================================ */

const JollyAIShortcuts = (() => {
  const KEY = 'jolly_ai_shortcuts';
  const FREQ_KEY = 'jolly_ai_cmdfreq';
  const REPEAT_THRESHOLD = 3;

  function all() { return JollyDB.read(KEY, []); }
  function save(list) { JollyDB.write(KEY, list); }

  function normalize(s) { return String(s || '').trim().toLowerCase(); }

  /* ---------- CRUD ---------- */
  function add(shortcut, command, extra = {}) {
    const list = all();
    const key = normalize(shortcut);
    const existing = list.find(s => normalize(s.shortcut) === key);
    if (existing) {
      existing.command = command;
      existing.updatedAt = Date.now();
      save(list);
      return existing;
    }
    const rec = {
      id: JollyDB.uid('shc'),
      shortcut: shortcut.trim(),
      command: command.trim(),
      type: extra.type || 'text',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usedCount: 0,
      lastUsedAt: null,
      productId: extra.productId || null,
      moduleId: extra.moduleId || null,
    };
    list.unshift(rec);
    save(list);
    return rec;
  }

  function remove(id) {
    save(all().filter(s => s.id !== id));
  }

  function find(shortcutText) {
    const key = normalize(shortcutText);
    if (!key) return null;
    return all().find(s => normalize(s.shortcut) === key) || null;
  }

  function recordUse(id) {
    const list = all();
    const rec = list.find(s => s.id === id);
    if (!rec) return;
    rec.usedCount = (rec.usedCount || 0) + 1;
    rec.lastUsedAt = Date.now();
    save(list);
  }

  /* ---------- "qısayol = əmr" tərifini tanı ---------- */
  function tryDefine(text) {
    const m = String(text || '').match(/^([^=]{1,30})=(.{1,300})$/);
    if (!m) return null;
    const shortcut = m[1].trim();
    const command = m[2].trim();
    if (!shortcut || !command) return null;
    return { shortcut, command };
  }

  /* ---------- Yazılan mətn saxlanmış qısayoldursa, əmri geri qaytar ---------- */
  function tryExpand(text) {
    const rec = find(text);
    if (!rec) return null;
    recordUse(rec.id);
    return rec;
  }

  /* ---------- Təkrar əmr aşkarlama: eyni mətn N dəfə yazılıbsa təklif et ---------- */
  function trackRepeat(commandText) {
    const key = normalize(commandText);
    if (!key || key.length < 3) return false;
    if (find(commandText)) return false; // artıq qısayolu var
    const freq = JollyDB.read(FREQ_KEY, {});
    freq[key] = (freq[key] || 0) + 1;
    JollyDB.write(FREQ_KEY, freq);
    return freq[key] >= REPEAT_THRESHOLD && freq[key] % REPEAT_THRESHOLD === 0;
  }

  function clearFreq(commandText) {
    const key = normalize(commandText);
    const freq = JollyDB.read(FREQ_KEY, {});
    delete freq[key];
    JollyDB.write(FREQ_KEY, freq);
  }

  return { all, add, remove, find, recordUse, tryDefine, tryExpand, trackRepeat, clearFreq };
})();
