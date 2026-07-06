/* ============================================================
   JOLLY AI Voice — danışan və dinləyən beyin
   speechSynthesis (offline TTS) + mövcud JollyVoice (STT)
   ============================================================ */

const JollyAIVoice = (() => {
  const LANG_MAP = { az: 'az-AZ', tr: 'tr-TR', ru: 'ru-RU', en: 'en-US' };

  function settings() { return JollyDB.getSettings(); }
  function isEnabled() { return settings().aiVoiceEnabled === true; } // defolt: bağlı
  function setEnabled(on) { JollyDB.setSettings({ aiVoiceEnabled: !!on }); }
  function setLang(code) { JollyDB.setSettings({ aiVoiceLang: code }); }
  function setRate(rate) { JollyDB.setSettings({ aiVoiceRate: rate }); }

  function isSupported() { return 'speechSynthesis' in window; }

  function getVoices() {
    if (!isSupported()) return [];
    return speechSynthesis.getVoices();
  }

  function pickVoice(langCode) {
    const voices = getVoices();
    let v = voices.find(x => x.lang === langCode);
    if (!v) v = voices.find(x => x.lang && x.lang.startsWith(langCode.split('-')[0]));
    if (!v && langCode !== 'tr-TR') v = voices.find(x => x.lang === 'tr-TR'); // AZ yoxdursa TR ən yaxındır
    return v || voices[0] || null;
  }

  function speak(text) {
    if (!isEnabled() || !isSupported() || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#`]/g, ''));
      const s = settings();
      const lang = LANG_MAP[s.aiVoiceLang || 'az'] || 'az-AZ';
      const voice = pickVoice(lang);
      if (voice) u.voice = voice;
      u.lang = lang;
      u.rate = s.aiVoiceRate === 'slow' ? 0.8 : s.aiVoiceRate === 'fast' ? 1.25 : 1;
      speechSynthesis.speak(u);
    } catch (e) { /* səssiz keç */ }
  }

  function stop() {
    if (isSupported()) try { speechSynthesis.cancel(); } catch (e) {}
  }

  function listen(callback) {
    if (typeof JollyVoice !== 'undefined' && JollyVoice.listen) {
      JollyVoice.listen(callback);
    } else {
      Toast.error('Bu telefonda səsli yazı dəstəklənmir, yazı ilə davam edə bilərsən.');
    }
  }

  function listenSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  return { speak, stop, listen, isSupported, listenSupported, getVoices, isEnabled, setEnabled, setLang, setRate };
})();
