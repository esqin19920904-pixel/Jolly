/* ============================================================
   JOLLY Gemini Bridge — hibrid AI
   Məntiq:
   1) Sual JOLLY bazasından cavablanırsa → JOLLY AI Brain (sürətli, dəqiq, offline)
   2) Brain tapmırsa VƏ internet varsa → Gemini (ümumi/mürəkkəb suallar)
   3) İnternet yoxdursa → hər şey Brain-də qalır
   API açarı localStorage-də saxlanılır (jolly_gemini_key).
   ============================================================ */

const JollyGemini = (() => {
  const KEY_STORE = 'jolly_gemini_key';
  const MODEL = 'gemini-2.0-flash'; // sürətli və pulsuz limiti geniş

  function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { localStorage.setItem(KEY_STORE, (k || '').trim()); } catch (e) {} }
  function hasKey() { return !!getKey(); }
  function isOnline() { return navigator.onLine !== false; }
  function isEnabled() { return hasKey() && isOnline(); }

  /* ---------- JOLLY bazası haqqında qısa kontekst ---------- */
  function buildContext() {
    try {
      const all = JollyDB.Products.all();
      const brands = [...new Set(all.map(p => p.brand).filter(Boolean))];
      const groups = [...new Set(all.map(p => p.group).filter(Boolean))];
      const health = (typeof JollyAIHealth !== 'undefined') ? JollyAIHealth.getCatalogScore() : null;
      return `JOLLY mağaza məlumatı:
- Ümumi məhsul: ${all.length}
- Firmalar: ${brands.slice(0, 20).join(', ') || 'yoxdur'}
- Qruplar: ${groups.slice(0, 20).join(', ') || 'yoxdur'}
${health != null ? `- Kataloq sağlamlığı: ${health}%` : ''}`;
    } catch (e) { return 'JOLLY mağaza proqramı.'; }
  }

  const SYSTEM_PROMPT = `Sən JOLLY-nin köməkçi süni intellektisən. JOLLY — offline mağaza məhsul idarəetmə proqramıdır (kodsuz/problemli barkodlu mallar üçün).
Qısa, aydın, Azərbaycan dilində, mağaza işçisinə uyğun cavab ver.
Yalnız mağaza/məhsul/inventar/barkod mövzularında kömək et. Uzun-uzadı danışma.`;

  /* ---------- Gemini API çağırışı ---------- */
  async function askGemini(userText) {
    const key = getKey();
    if (!key) throw new Error('no_key');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT + '\n\n' + buildContext() }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('gemini_http_' + res.status + ': ' + errText.slice(0, 120));
    }
    const data = await res.json();
    const text = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts.map(p => p.text).join('');
    return text || 'Cavab alınmadı.';
  }

  /* ---------- Hibrid cavab: əvvəl Brain, tapmasa Gemini ---------- */
  async function ask(userText) {
    // 1) JOLLY AI Brain-dən soruş
    let brainResult = null;
    if (typeof JollyAICore !== 'undefined') {
      try { brainResult = JollyAICore.ask(userText); } catch (e) {}
    }

    // Brain bazadan konkret nəticə tapıbsa (məhsul, doctor, action) — elə onu qaytar
    const brainSolved = brainResult && brainResult.ok && (
      (brainResult.products && brainResult.products.length) ||
      brainResult.doctor || brainResult.action ||
      (brainResult.intent && brainResult.intent !== 'unknown' && brainResult.intent !== 'search_products')
    );

    if (brainSolved) {
      return { source: 'brain', full: brainResult, text: brainResult.answer };
    }

    // 2) Brain tapmadı — Gemini varsa ona ötür
    if (isEnabled()) {
      try {
        const geminiText = await askGemini(userText);
        return { source: 'gemini', text: geminiText, full: null };
      } catch (e) {
        // Gemini xəta verdi — Brain-in nə deyirdisə onu qaytar
        return { source: 'brain', full: brainResult, text: (brainResult && brainResult.answer) || 'Uyğun nəticə tapılmadı.' };
      }
    }

    // 3) Offline və ya açar yoxdur — Brain nəticəsi
    return { source: 'brain', full: brainResult, text: (brainResult && brainResult.answer) || 'Uyğun nəticə tapılmadı.' };
  }

  /* ---------- Test/diaqnostika ---------- */
  async function testConnection() {
    if (!hasKey()) return { ok: false, msg: 'API açarı yoxdur' };
    if (!isOnline()) return { ok: false, msg: 'İnternet yoxdur' };
    try {
      const t = await askGemini('Salam de (bir söz).');
      return { ok: true, msg: 'İşləyir: ' + t.slice(0, 40) };
    } catch (e) {
      return { ok: false, msg: String(e.message || e).slice(0, 120) };
    }
  }

  return { ask, askGemini, testConnection, getKey, setKey, hasKey, isEnabled, isOnline, MODEL };
})();
