/* ============================================================
   JOLLY AI Dictionary — çoxdilli sinonim bazası
   AZ / TR / EN / RU qarışıq sözləri bir kök sözə bağlayır.
   İstifadəçi Brain Studio-dan yeni sinonim əlavə edə bilər.
   ============================================================ */

const JollyAIDictionary = (() => {
  const KEY = 'jolly_ai_synonyms';

  // base: [sinonimlər...] — hamısı kiçik hərflə
  const BUILTIN = {
    'corab': ['sock', 'socks', 'noski', 'носки', 'corap', 'korab', 'çorab'],
    'daraq': ['comb', 'tarak', 'darag'],
    'ətir': ['perfume', 'parfum', 'etir'],
    'şəkil': ['photo', 'image', 'resim', 'sekil', 'şekil', 'foto'],
    'firma': ['brand', 'marka'],
    'qrup': ['category', 'kateqoriya', 'kategori', 'grup'],
    'yer': ['location', 'rəf', 'ref', 'shelf', 'raf'],
    'barkod': ['barcode', 'barcod', 'barkot', 'bar kod', 'штрихкод'],
    'qiymət': ['price', 'qiymet', 'fiyat'],
    'məhsul': ['product', 'mehsul', 'mal', 'ürün'],
    'kassa': ['cashier', 'kasa', 'касса'],
    'hazır': ['ready', 'hazir'],
    'problemli': ['problem', 'səhv', 'sehv', 'xarab'],
    'backup': ['ehtiyat', 'yedək', 'yedek', 'bekap'],
    'whatsapp': ['wp', 'göndər', 'gonder', 'paylaş', 'paylas', 'vatsap', 'whatsapa', 'whatsap'],
    'sil': ['delete', 'remove'],
    'aç': ['open', 'ac', 'göstər', 'goster'],
    'tap': ['find', 'axtar', 'search'],
    'dünən': ['dunen', 'yesterday', 'dünen'],
    'bugün': ['bugun', 'bu gün', 'bu gun', 'today'],
  };

  function custom() { return JollyDB.read(KEY, {}); }
  function saveCustom(map) { JollyDB.write(KEY, map); }

  function allMap() {
    const merged = {};
    Object.entries(BUILTIN).forEach(([base, syns]) => { merged[base] = [...syns]; });
    Object.entries(custom()).forEach(([base, syns]) => {
      merged[base] = merged[base] ? [...new Set([...merged[base], ...syns])] : [...syns];
    });
    return merged;
  }

  // Hər sinonimdən kök sözə əks-xəritə
  function reverseMap() {
    const rev = {};
    Object.entries(allMap()).forEach(([base, syns]) => {
      rev[base] = base;
      syns.forEach(s => { rev[s.toLowerCase()] = base; });
    });
    return rev;
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/i̇/g, 'i')
      .trim();
  }

  // Bir sözü kökə çevir ("socks" → "corab")
  function expandWord(word) {
    const w = normalize(word);
    const rev = reverseMap();
    return rev[w] || w;
  }

  // Mətndəki hər sözü kökə çevir
  function expandText(text) {
    return normalize(text).split(/\s+/).map(expandWord).join(' ');
  }

  function addSynonym(base, word) {
    base = normalize(base); word = normalize(word);
    if (!base || !word) return false;
    const map = custom();
    (map[base] = map[base] || []).includes(word) || map[base].push(word);
    saveCustom(map);
    return true;
  }

  function removeSynonym(base, word) {
    const map = custom();
    if (map[base]) {
      map[base] = map[base].filter(w => w !== word);
      if (!map[base].length) delete map[base];
      saveCustom(map);
    }
  }

  // Bütün tanınan sözlərin siyahısı (typo düzəlişi üçün lüğət)
  function vocabulary() {
    const vocab = new Set();
    Object.entries(allMap()).forEach(([base, syns]) => {
      vocab.add(base);
      syns.forEach(s => vocab.add(s.toLowerCase()));
    });
    return [...vocab];
  }

  function all() { return allMap(); }
  function customOnly() { return custom(); }

  return { normalize, expandWord, expandText, addSynonym, removeSynonym, vocabulary, all, customOnly };
})();
