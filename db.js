/* ============================================================
   JOLLY DB — LocalStorage əsaslı verilənlər bazası qatı
   Bütün CRUD əməliyyatları, ID generasiyası və aktivlik jurnalı
   ============================================================ */

const JollyDB = (() => {
  const KEYS = {
    products: 'jolly_products',
    brands: 'jolly_brands',
    groups: 'jolly_groups',
    locations: 'jolly_locations',
    statuses: 'jolly_statuses',
    suppliers: 'jolly_suppliers',
    tags: 'jolly_filter_tags',
    settings: 'jolly_settings',
    activity: 'jolly_activity',
    edge: 'jolly_edge_config',
    drafts: 'jolly_drafts',
    trash: 'jolly_trash',
    users: 'jolly_users_v1',
    permissions: 'jolly_perm_os_v2',
  };

  function uid(prefix = 'p') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      // localStorage-da hərfi "null" kimi yazılmış qeydlər (köhnə bug) —
      // fallback-ə qayıt, çökməyə qoyma.
      if (parsed === null || parsed === undefined) return fallback;
      return parsed;
    } catch (e) {
      console.error('JollyDB read error', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (key === 'jolly_products' || key === 'jolly_drafts' || key === 'jolly_brands' || key === 'jolly_groups' || key === 'jolly_locations' || key === 'jolly_statuses' || key === 'jolly_suppliers') {
        try { localStorage.setItem('jolly_last_change', String(Date.now())); } catch (e2) {}
        if (typeof JollyApp !== 'undefined' && JollyApp.renderBackupPill) JollyApp.renderBackupPill();
      }
      return true;
    } catch (e) {
      console.error('JollyDB write error', key, e);
      if (typeof Toast !== 'undefined') {
        Toast.error('⚠️ Yaddaş dolub — məlumat saxlanmadı! Data Studio-dan backup çıxar.');
      }
      return false;
    }
  }

  function logActivity(action, entity, details) {
    const log = read(KEYS.activity, []);
    log.unshift({
      id: uid('log'),
      action, entity, details,
      ts: Date.now(),
    });
    if (log.length > 500) log.length = 500;
    write(KEYS.activity, log);
  }

  /* ---------- Seed defaults on first run ---------- */
  function seedIfEmpty() {
    if (read(KEYS.brands, null) === null) {
      write(KEYS.brands, [
        { id: uid('brand'), name: 'Nivea' },
        { id: uid('brand'), name: 'Dove' },
      ]);
    }
    if (read(KEYS.groups, null) === null) {
      write(KEYS.groups, [
        { id: uid('grp'), name: 'Krem' },
        { id: uid('grp'), name: 'Daraq' },
      ]);
    }
    if (read(KEYS.locations, null) === null) {
      write(KEYS.locations, [
        { id: uid('loc'), name: 'İç geyim rəfi' },
        { id: uid('loc'), name: 'Kassa yanı' },
      ]);
    }
    if (read(KEYS.statuses, null) === null) {
      write(KEYS.statuses, [
        { id: uid('st'), name: 'Aktiv', color: '#22d3ee' },
        { id: uid('st'), name: 'Problemli', color: '#f87171' },
        { id: uid('st'), name: 'Yeni gəlib', color: '#a78bfa' },
        { id: uid('st'), name: 'Endirimdə', color: '#fbbf24' },
      ]);
    }
    if (read(KEYS.suppliers, null) === null) {
      write(KEYS.suppliers, []);
    }
    if (read(KEYS.products, null) === null) {
      write(KEYS.products, []);
    }
    if (read(KEYS.settings, null) === null) {
      write(KEYS.settings, {
        theme: 'dark-neon',
        aiEnabled: true,
        edgePanelEnabled: true,
        firstRun: true,
      });
    }
    if (read(KEYS.edge, null) === null) {
      write(KEYS.edge, {
        items: ['scan', 'lastAdded', 'drafts', 'aiQuick', 'favorites'],
      });
    }
    if (read(KEYS.drafts, null) === null) {
      write(KEYS.drafts, []);
    }
  }

  /* ---------- Generic CRUD factory ---------- */
  function makeStore(key, entityName) {
    const prefix = entityName.slice(0, 3).replace(/[^a-z0-9]/gi, 'x');
    return {
      all() { return read(key, []); },
      get(id) { return read(key, []).find(x => x.id === id) || null; },
      add(item) {
        const list = read(key, []);
        const clean = { ...item };
        if (clean.id == null || clean.id === '') delete clean.id; // boş id yeni id-ni əzməsin
        const record = { id: uid(prefix), createdAt: Date.now(), updatedAt: Date.now(), ...clean };
        list.push(record);
        write(key, list);
        logActivity('add', entityName, record.name || record.id);
        return record;
      },
      update(id, patch) {
        const list = read(key, []);
        const idx = list.findIndex(x => x.id === id);
        if (idx === -1) return null;
        list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
        write(key, list);
        logActivity('update', entityName, list[idx].name || id);
        return list[idx];
      },
      remove(id) {
        const list = read(key, []);
        const item = list.find(x => x.id === id);
        const filtered = list.filter(x => x.id !== id);
        write(key, filtered);
        if (item) logActivity('delete', entityName, item.name || id);
        return true;
      },
    };
  }

  const Brands = makeStore(KEYS.brands, 'firma');
  const Groups = makeStore(KEYS.groups, 'qrup');
  const Locations = makeStore(KEYS.locations, 'yer');
  const Statuses = makeStore(KEYS.statuses, 'status');
  const Suppliers = makeStore(KEYS.suppliers, 'tədarükçü');
  const Tags = makeStore(KEYS.tags, 'etiket');
  const Products = makeStore(KEYS.products, 'məhsul');
  const Drafts = makeStore(KEYS.drafts, 'qaralama');

  /* Products: extra convenience methods */
  Products.search = function (query) {
    const q = (query || '').toLowerCase().trim();
    const list = read(KEYS.products, []);
    if (!q) return list;
    return list.filter(p => {
      const hay = [
        p.name, p.mainCode, p.extraCodeType, p.extraCodeValue, p.last4,
        ...(p.barcodes || []), p.brand, p.group, p.location, p.note, p.color, p.status, p.supplier,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  };

  Products.findByBarcode = function (code) {
    const list = read(KEYS.products, []);
    return list.filter(p => (p.barcodes || []).includes(code));
  };

  Products.filter = function (criteria = {}) {
    let list = read(KEYS.products, []);
    if (criteria.brand) list = list.filter(p => p.brand === criteria.brand);
    if (criteria.group) list = list.filter(p => p.group === criteria.group);
    if (criteria.location) list = list.filter(p => p.location === criteria.location);
    if (criteria.status) list = list.filter(p => p.status === criteria.status);
    if (criteria.supplier) list = list.filter(p => p.supplier === criteria.supplier);
    if (criteria.hasImage === true) list = list.filter(p => (p.images || []).length > 0);
    if (criteria.hasImage === false) list = list.filter(p => (p.images || []).length === 0);
    if (criteria.hasBarcode === true) list = list.filter(p => (p.barcodes || []).length > 0);
    if (criteria.hasBarcode === false) list = list.filter(p => (p.barcodes || []).length === 0);
    return list;
  };

  function exportAll() {
    const data = {};
    Object.entries(KEYS).forEach(([k, v]) => { data[k] = read(v, null); });
    data.exportedAt = new Date().toISOString();
    return data;
  }

  function importAll(data) {
    Object.entries(KEYS).forEach(([k, v]) => {
      if (data[k] !== undefined) write(v, data[k]);
    });
    logActivity('import', 'sistem', 'Tam idxal edildi');
  }

  /* Zədəli (id-siz/null id-li) qeydləri təmir et — açılışda çağırılır */
  function repairIds() {
    let fixed = 0;
    [[KEYS.products, 'pro'], [KEYS.drafts, 'dra']].forEach(([key, prefix]) => {
      const list = read(key, []);
      let changed = false;
      list.forEach(item => {
        if (item.id == null || item.id === '' || item.id === 'null') {
          item.id = uid(prefix);
          if (!item.createdAt) item.createdAt = Date.now();
          if (!item.updatedAt) item.updatedAt = Date.now();
          changed = true; fixed++;
        }
      });
      if (changed) write(key, list);
    });
    if (fixed > 0) console.log(`JOLLY: ${fixed} zədəli qeyd təmir olundu`);
    return fixed;
  }

  /* ---------- Recycle Bin (silinənlər səbəti) ---------- */
  const Trash = {
    all() { return read(KEYS.trash, []); },
    // Məhsulu səbətə at (30 gün qalır)
    moveToTrash(productId) {
      const p = Products.get(productId);
      if (!p) return false;
      const trash = read(KEYS.trash, []);
      trash.unshift({ ...p, deletedAt: Date.now() });
      write(KEYS.trash, trash);
      // əsl siyahıdan çıxar (logActivity ilə)
      const list = read(KEYS.products, []).filter(x => x.id !== productId);
      write(KEYS.products, list);
      logActivity('delete', 'məhsul', (p.name || productId) + ' → səbətə');
      return true;
    },
    restore(productId) {
      const trash = read(KEYS.trash, []);
      const item = trash.find(x => x.id === productId);
      if (!item) return false;
      const clean = { ...item };
      delete clean.deletedAt;
      const list = read(KEYS.products, []);
      list.unshift(clean);
      write(KEYS.products, list);
      write(KEYS.trash, trash.filter(x => x.id !== productId));
      logActivity('add', 'məhsul', (item.name || productId) + ' bərpa olundu');
      return true;
    },
    purge(productId) {
      const trash = read(KEYS.trash, []);
      write(KEYS.trash, trash.filter(x => x.id !== productId));
      return true;
    },
    purgeOld(days = 30) {
      const cutoff = Date.now() - days * 864e5;
      const trash = read(KEYS.trash, []);
      const kept = trash.filter(x => (x.deletedAt || 0) > cutoff);
      if (kept.length !== trash.length) write(KEYS.trash, kept);
      return trash.length - kept.length;
    },
    emptyAll() { write(KEYS.trash, []); return true; },
  };

  /* ---------- Favorilər ---------- */
  function toggleFavorite(productId) {
    const p = Products.get(productId);
    if (!p) return false;
    Products.update(productId, { favorite: !p.favorite });
    return !p.favorite;
  }
  function getFavorites() {
    return read(KEYS.products, []).filter(p => p.favorite);
  }

  /* ---------- Tombstone-lar (2026-07-22) ----------
     Products üçün Trash var, amma Qrup/Firma/Yer/Status/Tədarükçü
     silinəndə heç bir "səbət" yoxdur — bu, silinmiş bir Qrup/Firma-nın
     da eynilə bulud sinxronu ilə geri qayıtma riski daşıdığı deməkdir
     (silentCloudMerge). Buna görə bu ümumi "tombstone" siyahısı: hər
     hansı bir key/id silinəndə burda 7 gün saxlanılır, sinxron bu
     müddətdə həmin ID-ni "yeni/əskik" sanıb geri əlavə etmir. */
  const TOMBSTONE_KEY = 'jolly_tombstones';
  const TOMBSTONE_TTL_MS = 7 * 864e5; // 7 gün

  function addTombstone(storeKey, id) {
    try {
      const list = read(TOMBSTONE_KEY, []);
      list.push({ key: storeKey, id, deletedAt: Date.now() });
      write(TOMBSTONE_KEY, list);
    } catch (e) {}
  }
  function isTombstoned(storeKey, id) {
    try {
      const cutoff = Date.now() - TOMBSTONE_TTL_MS;
      const list = read(TOMBSTONE_KEY, []);
      return list.some(t => t && t.key === storeKey && t.id === id && (t.deletedAt || 0) > cutoff);
    } catch (e) { return false; }
  }

  return {
    KEYS, uid, read, write, logActivity, seedIfEmpty, repairIds,
    Trash, toggleFavorite, getFavorites,
    Brands, Groups, Locations, Statuses, Suppliers, Tags, Products, Drafts,
    exportAll, importAll,
    addTombstone, isTombstoned,
    getActivity: () => read(KEYS.activity, []),
    getSettings: () => read(KEYS.settings, {}) || {},
    setSettings: (patch) => write(KEYS.settings, { ...(read(KEYS.settings, {}) || {}), ...patch }),
    getEdgeConfig: () => read(KEYS.edge, { items: [] }),
    setEdgeConfig: (cfg) => write(KEYS.edge, cfg),
  };
})();
