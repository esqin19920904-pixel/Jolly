/* JOLLY Voice — səsli əmr / axtarış (Web Speech API) */

const JollyVoice = (() => {
  function isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  function listen(onText, onError) {
    // İcazə yoxlaması — search.voice
    if (typeof POS !== 'undefined' && !POS.can('search.voice')) {
      if (window.Toast) Toast.error('❌ Səsli axtarış üçün icazəniz yoxdur');
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      return;
    }

    if (!isSupported()) {
      Toast.error('Bu cihazda səsli tanıma dəstəklənmir.');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'az-AZ';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    const indicator = document.createElement('div');
    indicator.className = 'scan-overlay';
    indicator.style.background = 'rgba(6,7,13,0.88)';
    indicator.style.alignItems = 'center';
    indicator.style.justifyContent = 'center';
    indicator.innerHTML = `
      <div style="text-align:center;">
        <div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,var(--accent-1),var(--accent-3));
          display:flex;align-items:center;justify-content:center;font-size:34px;margin:0 auto 18px;animation:pulseMic 1.2s ease-in-out infinite;">🎤</div>
        <div style="color:#fff;font-size:15px;">Dinləyirəm...</div>
      </div>
      <style>@keyframes pulseMic{0%,100%{transform:scale(1);}50%{transform:scale(1.1);}}</style>
    `;
    document.body.appendChild(indicator);
    indicator.onclick = () => { rec.stop(); indicator.remove(); };

    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      indicator.remove();
      onText(text);
    };
    rec.onerror = (e) => {
      indicator.remove();
      if (onError) onError(e);
      else Toast.error('Səs tanınmadı, yenidən cəhd edin.');
    };
    rec.onend = () => { if (indicator.parentNode) indicator.remove(); };

    try { rec.start(); } catch (e) { indicator.remove(); }
  }

  return { isSupported, listen };
})();
