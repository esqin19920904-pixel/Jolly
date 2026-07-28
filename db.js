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
    changelog: 'jolly_changelog',
    changelogReads: 'jolly_changelog_reads',
    permAudit: 'jolly_perm_audit_v2',
    tombstones: 'jolly_tombstones',
    markedForDeletion: 'jolly_marked_for_deletion',
    storeMap: 'jolly_store_map_sections',
  };

  function uid(prefix = 'p') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /* ── SÜRƏT KEŞİ (2026-07-27) ────────────────────────────────
     Bir render zamanı Products.all() onlarla dəfə çağırılırdı və hər
     dəfə bütün məhsul cədvəli localStorage-dan oxunub JSON.parse
     edilirdi. Aşağıdakı keş cəmi 150 ms yaşayır: eyni render
     daxilindəki təkrar oxumaları kəsir, amma məlumat köhnəlmir —
     hər yazıda dərhal təmizlənir. */
  const _rcache = new Map();
  const RCACHE_MS = 150;
  function _cacheInvalidate(key) {
    if (key) _rcache.delete(key); else _rcache.clear();
  }
  try {
    window.addEventListener('storage', () => _cacheInvalidate());
  } catch (e) {}

  function read(key, fallback) {
    const hit = _rcache.get(key);
    if (hit && (Date.now() - hit.t) < RCACHE_MS) {
      return hit.missing ? fallback : hit.v;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { _rcache.set(key, { t: Date.now(), missing: true }); return fallback; }
      const parsed = JSON.parse(raw);
      // localStorage-da hərfi "null" kimi yazılmış qeydlər (köhnə bug) —
      // fallback-ə qayıt, çökməyə qoyma.
      if (parsed === null || parsed === undefined) { _rcache.set(key, { t: Date.now(), missing: true }); return fallback; }
      _rcache.set(key, { t: Date.now(), v: parsed });
      return parsed;
    } catch (e) {
      console.error('JollyDB read error', key, e);
      return fallback;
    }
  }

  /* DÜZƏLİŞ (2026-07-23, yaddaş kvotası — 2-ci tur):
     "Yaddaş dolub" xətası snapshot-u yüngülləşdirdikdən SONRA da təkrar
     olundu — səbəb köhnədən yığılmış ağır massivlər idi (aşağıya bax:
     runHousekeeping). İndi write() özü də özünü qoruyur: kvota xətası
     tutulanda, PANİKƏ ETMƏDƏN əvvəl bir dəfə avtomatik yer boşaldıb
     (ən köhnə/ağır massivləri qısaldıb) YENİDƏN yazmağa cəhd edir.
     Yalnız bu təkrar cəhd də uğursuz olarsa, istifadəçiyə xəbərdarlıq
     göstərilir. `retrying` bayrağı sonsuz dövrənin qarşısını alır. */
  /* DÜZƏLİŞ (2026-07-23, yaddaş kvotası — 3-cü tur):
     Xəbərdarlıq çox az məhsulla (2-3 ədəd) belə təkrarlanır — bu, əsl
     kvota dolması ola bilməz (localStorage adətən 5MB+ tutur). Deməli
     `catch` bloku başqa bir xətanı da "Yaddaş dolub" kimi göstərir və
     bizi yanlış istiqamətə aparır. İndi əsl xəta növünü (`e.name`)
     ayırd edirik: yalnız həqiqi QuotaExceededError-da köhnə "təmizlə+
     yenidən cəhd et" məntiqi işə düşür və "Yaddaş dolub" mesajı
     göstərilir. Başqa hər hansı xəta (SecurityError — inkoqnito/
     data-saver rejimində storage tam bağlıdır, və s.) fərqli, addım
     göstərən mesajla bildirilir ki, əsl səbəb aydın olsun. */
  function write(key, value, _retrying) {
    _cacheInvalidate(key);
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (key === 'jolly_products' || key === 'jolly_drafts' || key === 'jolly_brands' || key === 'jolly_groups' || key === 'jolly_locations' || key === 'jolly_statuses' || key === 'jolly_suppliers') {
        try { localStorage.setItem('jolly_last_change', String(Date.now())); } catch (e2) {}
        if (typeof JollyApp !== 'undefined' && JollyApp.renderBackupPill) JollyApp.renderBackupPill();
      }
      return true;
    } catch (e) {
      console.error('JollyDB write error', key, e.name, e.message, e);
      const isQuota = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
      if (isQuota && !_retrying) {
        const freed = emergencyFreeSpace();
        if (freed) {
          console.log('JOLLY: yaddaş kvotası doldu, avtomatik təmizləndi, yenidən yazılır...');
          return write(key, value, true);
        }
      }
      if (typeof Toast !== 'undefined') {
        if (isQuota) {
          Toast.error('⚠️ Yaddaş dolub — məlumat saxlanmadı! Data Studio-dan backup çıxar.');
        } else {
          Toast.error(`⚠️ Saxlama xətası (${e && e.name ? e.name : 'naməlum'}) — brauzer storage-ı bloklayır. Detallar konsolda.`);
        }
      }
      return false;
    }
  }

  // Kvota dolanda çağırılır — ən köhnə/ağır məlumatları budayır (silinmir,
  // sadəcə qısaldılır) ki, təzə yazı üçün yer açılsın. Trash-in özü
  // 30 gündən köhnə qeydləri silir, digərləri ölçü limitinə salınır.
  function emergencyFreeSpace() {
    _cacheInvalidate();
    let didSomething = false;
    try {
      const trash = read(KEYS.trash, []);
      if (trash.length > 20) {
        const cutoff = Date.now() - 30 * 864e5;
        let kept = trash.filter(x => (x.deletedAt || 0) > cutoff);
        if (kept.length > 50) kept = kept.slice(0, 50);
        if (kept.length !== trash.length) {
          localStorage.setItem(KEYS.trash, JSON.stringify(kept));
          didSomething = true;
        }
      }
    } catch (e) {}
    try {
      const tomb = read(KEYS.tombstones, []);
      if (tomb.length > 50) {
        localStorage.setItem(KEYS.tombstones, JSON.stringify(tomb.slice(0, 50)));
        didSomething = true;
      }
    } catch (e) {}
    try {
      const act = read(KEYS.activity, []);
      if (act.length > 100) {
        localStorage.setItem(KEYS.activity, JSON.stringify(act.slice(0, 100)));
        didSomething = true;
      }
    } catch (e) {}
    try {
      localStorage.removeItem('jolly_snapshot');
      didSomething = true;
    } catch (e) {}
    return didSomething;
  }

  /* ---------- İşarələ-sonra-Admin-təsdiqləsin silmə axını (2026-07-25, #2) ----------
     İşçi bir məhsulu "silinməli" kimi işarələyir — məhsul özü SİLİNMİR,
     yalnız bu ayrıca siyahıya düşür. Yalnız Admin bu siyahını görüb,
     yanlış işarələməni geri ala, yaxud əsl silməni (Trash-ə köçürərək)
     təsdiqləyə bilər. */
  function markForDeletion(productId, actorName) {
    const list = read(KEYS.markedForDeletion, []);
    if (list.some(m => m.productId === productId)) return false; // artıq işarəli
    list.unshift({ productId, markedAt: Date.now(), markedBy: actorName || 'Naməlum' });
    write(KEYS.markedForDeletion, list);
    return true;
  }
  function unmarkForDeletion(productId) {
    const list = read(KEYS.markedForDeletion, []);
    const kept = list.filter(m => m.productId !== productId);
    if (kept.length === list.length) return false;
    write(KEYS.markedForDeletion, kept);
    return true;
  }
  function isMarkedForDeletion(productId) {
    return read(KEYS.markedForDeletion, []).some(m => m.productId === productId);
  }
  function getMarkedForDeletion() {
    return read(KEYS.markedForDeletion, []);
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
    // Hər açılışda 30 gündən köhnə silinmiş məhsulları avtomatik təmizlə —
    // əvvəllər bu heç yerdən çağırılmırdı, Trash sonsuza qədər böyüyürdü
    // və bu, "Yaddaş dolub" xətasının əsl səbəblərindən biri idi.
    try {
      const trash = read(KEYS.trash, []);
      const cutoff = Date.now() - 30 * 864e5;
      const kept = trash.filter(x => (x && x.deletedAt || 0) > cutoff);
      if (kept.length !== trash.length) write(KEYS.trash, kept);
    } catch (e) {}
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
  /* ── HƏRF BƏRABƏRLƏŞDİRMƏSİ (2026-07-27) ────────────────────
     "Çorab" yazan da, "corab" yazan da eyni malı tapmalıdır.
     Azərbaycan hərflərinin latın qarşılığına çevrilir, həm axtarış
     sözü, həm də məhsulun mətni eyni qaydadan keçir.
     Diqqət: rəqəmlərə toxunmur, barkodlar olduğu kimi qalır. */
  const _FOLD = {
    'ə': 'e', 'ç': 'c', 'ş': 's', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ü': 'u',
    'Ə': 'e', 'Ç': 'c', 'Ş': 's', 'Ğ': 'g', 'I': 'i', 'İ': 'i', 'Ö': 'o', 'Ü': 'u',
    'â': 'a', 'î': 'i', 'û': 'u'
  };
  function foldText(str) {
    let out = '';
    const s2 = String(str == null ? '' : str);
    for (let i = 0; i < s2.length; i++) {
      const ch = s2[i];
      out += (_FOLD[ch] !== undefined) ? _FOLD[ch] : ch.toLowerCase();
    }
    return out;
  }

  Products.search = function (query) {
    const raw = (query || '').trim();
    const list = read(KEYS.products, []);
    if (!raw) return list;
    const q = foldText(raw);
    return list.filter(p => {
      const hay = foldText([
        p.name, p.mainCode, p.extraCodeType, p.extraCodeValue, p.last4,
        ...(p.barcodes || []), p.brand, p.group, p.location, p.note, p.color, p.status, p.supplier,
      ].filter(Boolean).join(' '));
      return hay.includes(q);
    });
  };

  Products.findByBarcode = function (code) {
    const list = read(KEYS.products, []);
    return list.filter(p => (p.barcodes || []).includes(code));
  };

  /* Eyni barkod başqa məhsulda varmı? (products.js submitForm çağırır)
     Tapılsa həmin məhsulu, tapılmasa null qaytarır. */
  Products.checkBarcodeConflict = function (code, excludeId) {
    const c = String(code || '').trim();
    if (!c) return null;
    const hit = read(KEYS.products, []).find(p =>
      p && p.id !== excludeId && (p.barcodes || []).some(b => String(b).trim() === c)
    );
    return hit || null;
  };

  /* ── BARKOD ETİBARLILIĞI ──────────────────────────────────
     Əldən yazılan barkod səhv olur, skanerlə oxunan olmur.
     Barkod skanerdə tanınanda həmin məhsulda "təsdiqləndi" damğası
     qoyulur. Damğa məhsulun içində saxlanılır: barcodeMeta[kod]. */
  /* ── BARKOD DƏYİŞİKLİK JURNALI ────────────────────────────
     Barkod hansı yoldan dəyişirsə dəyişsin (forma, Fix Mode,
     Doktor, idxal, qovluq), hamısı Products.update()-dən keçir.
     Ona görə jurnalı burada tuturuq — hər çağırış yerinə ayrıca
     kod yazmağa ehtiyac qalmır. */
  const BARCODE_LOG_KEY = 'jolly_barcode_log';
  const BARCODE_LOG_MAX = 400;

  function _actorName() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return (sess && (sess.name || sess.userName)) || 'Admin';
    } catch (e) { return 'Admin'; }
  }

  function logBarcodeChange(entry) {
    try {
      const log = read(BARCODE_LOG_KEY, []) || [];
      log.unshift({ at: Date.now(), by: _actorName(), ...entry });
      write(BARCODE_LOG_KEY, log.slice(0, BARCODE_LOG_MAX));
    } catch (e) {}
  }

  function getBarcodeLog() { return read(BARCODE_LOG_KEY, []) || []; }

  /* ── MƏHSUL DƏYİŞİKLİK TARİXÇƏSİ (2026-07-27) ────────────────
     Barkod jurnalı yalnız barkodlara baxırdı. İndi eyni sarğı
     bütün vacib sahələri izləyir: ad, qiymət, qrup, firma, yer,
     status, tədarükçü, qeyd. Hansı ekrandan dəyişməsindən asılı
     deyil — hamısı Products.update()-dən keçir.
     Şəkillər izlənmir (böyükdür və faydası azdır). */
  const CHANGE_LOG_KEY = 'jolly_change_log';
  const CHANGE_LOG_MAX = 600;

  const TRACKED = {
    name: 'Ad', price: 'Qiymət', group: 'Qrup', brand: 'Firma',
    location: 'Yer', status: 'Status', supplier: 'Tədarükçü',
    note: 'Qeyd', mainCode: 'Kod'
  };

  function logChange(entry) {
    try {
      const log = read(CHANGE_LOG_KEY, []) || [];
      log.unshift({ at: Date.now(), by: _actorName(), ...entry });
      write(CHANGE_LOG_KEY, log.slice(0, CHANGE_LOG_MAX));
    } catch (e) {}
  }

  function getChangeLog(productId) {
    const log = read(CHANGE_LOG_KEY, []) || [];
    return productId ? log.filter(e => e.productId === productId) : log;
  }

  const _origProductsUpdate = Products.update.bind(Products);
  Products.update = function (id, patch) {
    try {
      const before = Products.get(id);
      if (before && patch) {
        // Barkodlar — köhnə jurnal formatında
        if (Object.prototype.hasOwnProperty.call(patch, 'barcodes')) {
          const oldList = (before.barcodes || []).map(String);
          const newList = (patch.barcodes || []).map(String);
          const added = newList.filter(b => !oldList.includes(b));
          const removed = oldList.filter(b => !newList.includes(b));
          if (added.length || removed.length) {
            logBarcodeChange({ productId: id, name: before.name || 'Adsız', added, removed });
            logChange({ productId: id, name: before.name || 'Adsız', field: 'barcodes',
                        label: 'Barkod',
                        from: oldList.join(', '), to: newList.join(', ') });
          }
        }
        // Digər sahələr
        Object.keys(TRACKED).forEach(f => {
          if (!Object.prototype.hasOwnProperty.call(patch, f)) return;
          const oldV = before[f] == null ? '' : String(before[f]);
          const newV = patch[f] == null ? '' : String(patch[f]);
          if (oldV === newV) return;
          logChange({ productId: id, name: before.name || 'Adsız',
                      field: f, label: TRACKED[f], from: oldV, to: newV });
        });
      }
    } catch (e) {}
    return _origProductsUpdate(id, patch);
  };

  const _origProductsAdd = Products.add.bind(Products);
  Products.add = function (payload) {
    const rec = _origProductsAdd(payload);
    try {
      const codes = ((payload && payload.barcodes) || []).map(String).filter(Boolean);
      if (rec && rec.id && codes.length) {
        logBarcodeChange({ productId: rec.id, name: rec.name || 'Adsız', added: codes, removed: [], created: true });
      }
      if (rec && rec.id) {
        logChange({ productId: rec.id, name: rec.name || 'Adsız', field: '_created',
                    label: 'Yaradıldı', from: '', to: rec.name || 'Adsız', created: true });
      }
    } catch (e) {}
    return rec;
  };

  Products.markBarcodeVerified = function (productId, code, by) {
    const c = String(code || '').trim();
    if (!c) return false;
    const p = Products.get(productId);
    if (!p) return false;
    const meta = { ...(p.barcodeMeta || {}) };
    if (meta[c] && meta[c].verified) return false;   // artıq təsdiqlənib
    meta[c] = { verified: true, at: Date.now(), by: by || '' };
    Products.update(productId, { barcodeMeta: meta });
    return true;
  };

  Products.isBarcodeVerified = function (p, code) {
    if (!p || !p.barcodeMeta) return false;
    const m = p.barcodeMeta[String(code || '').trim()];
    return !!(m && m.verified);
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

  /* ---------- Tombstone-lar (2026-07-22, snapshot+bərpa ilə genişləndirildi) ----------
     Products üçün Trash var, amma Qrup/Firma/Yer/Status/Tədarükçü/
     Yeniliklər silinəndə heç bir "səbət" yoxdur — bu, silinmiş bir
     Qrup/Firma-nın da eynilə bulud sinxronu ilə geri qayıtma riski
     daşıdığı deməkdir (silentCloudMerge). Bu ümumi "tombstone" siyahısı:
     hər hansı bir key/id silinəndə burda 7 gün saxlanılır, sinxron bu
     müddətdə həmin ID-ni "yeni/əskik" sanıb geri əlavə etmir.
     İndi HƏM DƏ silinən qeydin özünü (ad + tam snapshot) saxlayır ki,
     Backup Mərkəzində "Son silinənlər" siyahısı göstərilə bilsin və
     "♻️ Bərpa et" ilə geri qaytarıla bilsin.
     DÜZƏLİŞ (2026-07-23, yaddaş kvotası problemi): siyahı 500-dən
     150-yə endirildi — hər qeyd tam snapshot daşıdığı üçün 500 ədəd
     localStorage-da lazımsız yerə çox yer tuturdu. 7 günlük TTL onsuz
     da köhnələri təmizləyir, 150 son silinən kifayətdir. */
  const TOMBSTONE_TTL_MS = 7 * 864e5; // 7 gün
  const TOMBSTONE_MAX = 150;

  function addTombstone(storeKey, id, snapshot) {
    try {
      const list = read(KEYS.tombstones, []);
      list.unshift({
        id, key: storeKey, deletedAt: Date.now(),
        name: (snapshot && (snapshot.name || snapshot.version)) || null,
        snapshot: snapshot || null,
      });
      write(KEYS.tombstones, list.slice(0, TOMBSTONE_MAX));
    } catch (e) {}
  }
  function isTombstoned(storeKey, id) {
    try {
      const cutoff = Date.now() - TOMBSTONE_TTL_MS;
      const list = read(KEYS.tombstones, []);
      return list.some(t => t && t.key === storeKey && t.id === id && (t.deletedAt || 0) > cutoff);
    } catch (e) { return false; }
  }
  // Backup Mərkəzi → "Son silinənlər" siyahısı üçün — TTL-dən köhnə olanları göstərmir
  function getTombstones() {
    try {
      const cutoff = Date.now() - TOMBSTONE_TTL_MS;
      return read(KEYS.tombstones, []).filter(t => t && (t.deletedAt || 0) > cutoff);
    } catch (e) { return []; }
  }
  // Snapshot-dan geri qaytarır (əgər snapshot yoxdursa — köhnə tombstone,
  // bərpa mümkün deyil, sadəcə false qaytarır)
  function restoreTombstone(storeKey, id) {
    try {
      const list = read(KEYS.tombstones, []);
      const idx = list.findIndex(t => t && t.key === storeKey && t.id === id);
      if (idx === -1) return false;
      const t = list[idx];
      if (t.snapshot) {
        const arr = read(storeKey, []);
        if (!arr.some(x => x && x.id === id)) {
          arr.push(t.snapshot);
          write(storeKey, arr);
        }
      }
      list.splice(idx, 1);
      write(KEYS.tombstones, list);
      return !!t.snapshot;
    } catch (e) { return false; }
  }

  return {
    KEYS, uid, read, write, logActivity, seedIfEmpty, repairIds,
    Trash, toggleFavorite, getFavorites,
    Brands, Groups, Locations, Statuses, Suppliers, Tags, Products, Drafts,
    exportAll, importAll,
    addTombstone, isTombstoned, getTombstones, restoreTombstone,
    markForDeletion, unmarkForDeletion, isMarkedForDeletion, getMarkedForDeletion,
    getBarcodeLog, logBarcodeChange, getChangeLog, logChange, foldText,
    getActivity: () => read(KEYS.activity, []),
    getSettings: () => read(KEYS.settings, {}) || {},
    setSettings: (patch) => write(KEYS.settings, { ...(read(KEYS.settings, {}) || {}), ...patch }),
    /* Bütün settings obyektini olduğu kimi yazır. app.js və jolly-ota.js
       bunu çağırırdı, amma funksiya yox idi. */
    saveSettings: (obj) => write(KEYS.settings, obj || {}),
    getEdgeConfig: () => read(KEYS.edge, { items: [] }),
    setEdgeConfig: (cfg) => write(KEYS.edge, cfg),
  };
})();
