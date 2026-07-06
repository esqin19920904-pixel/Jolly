/* ============================================================
   JOLLY AI Typo — səhv yazını düzəldən beyin
   Levenshtein oxşarlığı + öyrədilən düzəlişlər (localStorage)
   ============================================================ */

const JollyAITypo = (() => {
  const KEY = 'jolly_ai_typo_learned';
  const FREQ_KEY = 'jolly_ai_typo_freq';

  const BUILTIN = {
    'cprab': 'corab', 'crab': 'corab', 'corb': 'corab', 'korab': 'corab', 'corap': 'corab', 'cprb': 'corab',
    'drq': 'daraq', 'darq': 'daraq', 'darg': 'daraq', 'darag': 'daraq', 'darqq': 'daraq',
    'barcod': 'barkod', 'barkot': 'barkod', 'barcot': 'barkod',
    'sekil': 'şəkil', 'sekilsiz': 'şəkilsiz', 'səkil': 'şəkil',
    'mehsul': 'məhsul', 'kasa': 'kassa',
    'hazr': 'hazır', 'hazir': 'hazır',
    'hardadi': 'hardadı', 'hardadır': 'hardadı',
  };

  function learned() { return JollyDB.read(KEY, {}); }
  function saveLearned(map) { JollyDB.write(KEY, map); }

  /* ---------- Levenshtein məsafəsi ---------- */
  function levenshtein(a, b) {
    a = String(a); b = String(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const cur = [i + 1];
      for (let j = 0; j < b.length; j++) {
        cur.push(Math.min(prev[j + 1] + 1, cur[j] + 1, prev[j] + (a[i] === b[j] ? 0 : 1)));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    a = String(a).toLowerCase(); b = String(b).toLowerCase();
    const maxLen = Math.max(a.length, b.length);
    if (!maxLen) return 1;
    return 1 - levenshtein(a, b) / maxLen;
  }

  /* ---------- Lüğət mənbələri ---------- */
  function candidateWords() {
    const words = new Set();
    if (typeof JollyAIDictionary !== 'undefined') {
      JollyAIDictionary.vocabulary().forEach(w => words.add(w));
    }
    // Məhsul adları, firmalar, qruplar, yerlər də namizəddir
    try {
      JollyDB.Products.all().forEach(p => {
        if (p.name) String(p.name).toLowerCase().split(/\s+/).forEach(w => { if (w.length > 2 && !/^\d+$/.test(w)) words.add(w); });
        if (p.brand) words.add(String(p.brand).toLowerCase());
        if (p.group) words.add(String(p.group).toLowerCase());
        if (p.location) words.add(String(p.location).toLowerCase());
      });
    } catch (e) {}
    return [...words];
  }

  /* ---------- Bir sözü düzəlt ---------- */
  function correctWord(word) {
    const w = String(word || '').toLowerCase().trim();
    if (!w || w.length < 2 || /^\d+$/.test(w)) return { word: w, corrected: false };

    // 1) Öyrədilmiş düzəlişlər
    const lrn = learned();
    if (lrn[w]) return { word: lrn[w], corrected: true, via: 'learned' };
    // 2) Daxili siyahı
    if (BUILTIN[w]) return { word: BUILTIN[w], corrected: true, via: 'builtin' };
    // 3) Lüğətdə onsuz da varsa, toxunma
    const vocab = candidateWords();
    if (vocab.includes(w)) return { word: w, corrected: false };
    // 4) Oxşarlıqla ən yaxın sözü tap
    let best = null, bestSim = 0;
    for (const cand of vocab) {
      if (Math.abs(cand.length - w.length) > 3) continue;
      const sim = similarity(w, cand);
      if (sim > bestSim) { bestSim = sim; best = cand; }
    }
    if (best && bestSim >= 0.72) return { word: best, corrected: true, via: 'similarity', similarity: Math.round(bestSim * 100) };
    return { word: w, corrected: false };
  }

  /* ---------- Bütöv mətni düzəlt ---------- */
  function correctText(text) {
    const words = String(text || '').toLowerCase().trim().split(/\s+/);
    let anyCorrected = false;
    const out = words.map(w => {
      const r = correctWord(w);
      if (r.corrected) anyCorrected = true;
      return r.word;
    });
    return { text: out.join(' '), corrected: anyCorrected, original: String(text || '') };
  }

  /* ---------- Öyrənmə ---------- */
  function learn(wrong, correct) {
    wrong = String(wrong || '').toLowerCase().trim();
    correct = String(correct || '').toLowerCase().trim();
    if (!wrong || !correct) return false;
    const map = learned();
    map[wrong] = correct;
    saveLearned(map);
    return true;
  }

  function forget(wrong) {
    const map = learned();
    delete map[String(wrong || '').toLowerCase().trim()];
    saveLearned(map);
  }

  function getLearned() { return learned(); }

  /* ---------- Təkrar səhv izləmə (təklif üçün) ---------- */
  function trackWrong(word) {
    const freq = JollyDB.read(FREQ_KEY, {});
    const w = String(word).toLowerCase();
    freq[w] = (freq[w] || 0) + 1;
    JollyDB.write(FREQ_KEY, freq);
    return freq[w];
  }

  return { correctWord, correctText, similarity, levenshtein, learn, forget, getLearned, trackWrong };
})();
