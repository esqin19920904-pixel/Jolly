/* ============================================================
   JOLLY Announce — Əyləncəli Anlıq Elan Sistemi
   OTA-dan asılı deyil (ayrıca Firebase node), amma düyməsi
   Studio → Yeniləmələr panelinin içindədir (jolly-ota.js-də).
   Admin göndərəndə bütün açıq telefonlarda tam ekran animasiya
   açılır: Matrix yağışı (canvas, yüngül) + mətn yazı maşını
   effekti, üstünə "jolly-nagarajax.mp4" faylının səsi çalınır.

   DÜZƏLİŞ (performans): Matrix yağışı əvvəllər hər 3 saniyədə
   onlarla DOM elementini (text-shadow ilə) yenidən yaradırdı —
   bu, zəif telefonlarda bütün proqramı dondururdu. İndi tək bir
   <canvas> üzərində, DOM-a toxunmadan çəkilir — qat-qat yüngül.

   DÜZƏLİŞ: səs toxunma anında, şəbəkə sorğusundan ƏVVƏL çalınır.
   ============================================================ */
const JollyAnnounce = (() => {
  const DB_URL = "https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app";
  const API_KEY = "AIzaSyAhv-ZFTTNeyoXIDjn3VrVcknPKor4kZvw";
  const SIGNAL_NODE = 'jolly_announce_signal';
  const POLL_MS = 8000;
  const SOUND_URL = 'jolly-nagarajax.mp4';

  let _token = null, _tokenExpiry = 0;
  async function _getToken() {
    if (_token && Date.now() < _tokenExpiry) return _token;
    try {
      const cached = JollyDB.read('jolly_fb_auth', null);
      if (cached && cached.idToken && Date.now() < cached.expiry) {
        _token = cached.idToken; _tokenExpiry = cached.expiry;
        return _token;
      }
    } catch (e) {}
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!res.ok) throw new Error('Bulud girişi uğursuz: ' + res.status);
    const data = await res.json();
    _token = data.idToken;
    _tokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) * 1000) - 60000;
    try { JollyDB.write('jolly_fb_auth', { idToken: _token, expiry: _tokenExpiry }); } catch (e) {}
    return _token;
  }

  function getLastSignal() {
    try { return parseInt(localStorage.getItem('jolly_announce_last') || '0', 10); } catch (e) { return 0; }
  }
  function setLastSignal(ts) { try { localStorage.setItem('jolly_announce_last', String(ts)); } catch (e) {} }

  /* ---------------- Səs ---------------- */
  let _audioUnlocked = false;
  function _unlockAudioOnce() {
    if (_audioUnlocked) return;
    _audioUnlocked = true;
    try {
      const a = new Audio(SOUND_URL);
      a.volume = 0;
      const p = a.play();
      if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
    } catch (e) {}
  }
  ['touchstart', 'click'].forEach(ev => {
    document.addEventListener(ev, _unlockAudioOnce, { once: true, passive: true });
  });

  function playSound() {
    try {
      const audio = new Audio(SOUND_URL);
      audio.volume = 1.0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  /* ---------------- Göndər ---------------- */
  async function send() {
    playOverlay(); // ƏVVƏLCƏ — toxunma anında, gözləmə olmadan
    try {
      const token = await _getToken();
      const res = await fetch(`${DB_URL}/${SIGNAL_NODE}.json?auth=${token}`, {
        method: 'PUT',
        body: JSON.stringify({ ts: Date.now() }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (typeof Toast !== 'undefined') Toast.success('Elan göndərildi 📢');
    } catch (e) {
      if (typeof Toast !== 'undefined') Toast.error('Göndərilmədi: ' + (e.message || e));
    }
  }

  /* ---------------- Dinlə ---------------- */
  let _pollTimer = null;
  async function poll() {
    try {
      const token = await _getToken();
      const res = await fetch(`${DB_URL}/${SIGNAL_NODE}.json?auth=${token}`);
      if (!res.ok) return;
      const val = await res.json();
      if (!val || !val.ts) return;
      if (val.ts > getLastSignal()) {
        setLastSignal(val.ts);
        playOverlay();
      }
    } catch (e) {}
  }

  function listen() {
    if (_pollTimer) return;
    (async () => {
      try {
        const token = await _getToken();
        const res = await fetch(`${DB_URL}/${SIGNAL_NODE}.json?auth=${token}`);
        if (res.ok) {
          const val = await res.json();
          if (val && val.ts && getLastSignal() === 0) setLastSignal(val.ts);
        }
      } catch (e) {}
      _pollTimer = setInterval(poll, POLL_MS);
    })();
  }

  /* ---------------- Stillər ---------------- */
  function ensureStyles() {
    if (document.getElementById('jollyAnnounceStyle')) return;
    const style = document.createElement('style');
    style.id = 'jollyAnnounceStyle';
    style.textContent = `
      #jollyAnnounceOverlay{
        position:fixed;inset:0;z-index:999999;
        background: radial-gradient(ellipse at 50% 30%, #1a1f3a 0%, #05060c 70%);
        display:flex;align-items:center;justify-content:center;
        opacity:0;transition:opacity .35s ease;
      }
      #jollyAnnounceOverlay.show{ opacity:1; }
      #jollyAnnounceOverlay .ja-star{ position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;
        animation: jaTwinkle 2.2s ease-in-out infinite; }
      @keyframes jaTwinkle{ 0%,100%{opacity:.15;} 50%{opacity:.85;} }

      #jaRainCanvas{ position:absolute; inset:0; z-index:4; }

      #jaTyped{
        position:relative;z-index:5;text-align:center;padding:0 24px;
        font-size:clamp(24px,7vw,44px);font-weight:900;line-height:1.35;white-space:pre-wrap;
        color:#f4d777;text-shadow:0 0 18px rgba(212,175,55,.45);
        min-height:1em;
      }
      #jaTyped .ja-cursor{ display:inline-block;width:3px;background:#f4d777;margin-left:2px;animation: jaBlink .9s steps(1) infinite; }
      @keyframes jaBlink{ 0%,49%{opacity:1;} 50%,100%{opacity:0;} }

      #jollyAnnounceOverlay .ja-hint{
        position:fixed;bottom:26px;left:0;right:0;text-align:center;color:#6b7094;font-size:12px;z-index:9;
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------------- Matrix yağışı — canvas (yüngül) ---------------- */
  const _RAIN_CHARS = 'アカサタナ01ﾊﾏﾔﾗﾜ京都愛金運夢火水木';
  let _rainRAF = null;

  function startCanvasRain(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fontSize = 16;
    const colCount = Math.floor(w / fontSize);
    const drops = new Array(colCount).fill(0).map(() => Math.random() * -30);

    let lastTime = 0;
    const frameInterval = 60; // ~16fps — kifayət qədər axıcı, yüngül

    function frame(ts) {
      _rainRAF = requestAnimationFrame(frame);
      if (ts - lastTime < frameInterval) return;
      lastTime = ts;

      ctx.fillStyle = 'rgba(5,6,12,0.18)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#8fffb0';
      ctx.font = fontSize + 'px monospace';
      for (let i = 0; i < colCount; i++) {
        const ch = _RAIN_CHARS[Math.floor(Math.random() * _RAIN_CHARS.length)];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    _rainRAF = requestAnimationFrame(frame);
  }

  function stopCanvasRain() {
    if (_rainRAF) { cancelAnimationFrame(_rainRAF); _rainRAF = null; }
  }

  /* ---------------- Tam ekran overlay ---------------- */
  function playOverlay() {
    ensureStyles();
    let old = document.getElementById('jollyAnnounceOverlay');
    if (old) { stopCanvasRain(); old.remove(); }

    const el = document.createElement('div');
    el.id = 'jollyAnnounceOverlay';
    el.innerHTML = `
      <canvas id="jaRainCanvas"></canvas>
      <div id="jaTyped"></div>
      <div class="ja-hint">✦ ekrana toxun, bağla ✦</div>
    `;
    document.body.appendChild(el);

    for (let s = 0; s < 20; s++) {
      const st = document.createElement('div');
      st.className = 'ja-star';
      st.style.left = Math.random() * 100 + 'vw';
      st.style.top = Math.random() * 100 + 'vh';
      st.style.animationDelay = (Math.random() * 2.2) + 's';
      el.insertBefore(st, el.firstChild);
    }

    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    playSound();
    startCanvasRain(el.querySelector('#jaRainCanvas'));

    const typed = el.querySelector('#jaTyped');
    const full = 'Gör indi qaqan\nnağarajax 😅😅😅';
    typed.innerHTML = '<span class="ja-cursor">&nbsp;</span>';
    let i = 0;
    const typeIv = setInterval(() => {
      i++;
      typed.innerHTML = full.slice(0, i).replace(/\n/g, '<br>') + '<span class="ja-cursor">&nbsp;</span>';
      if (i >= full.length) clearInterval(typeIv);
    }, 60);

    el.addEventListener('click', () => close(el));
    setTimeout(() => close(el), 9000);
  }

  function close(el) {
    stopCanvasRain();
    if (!el || !el.parentNode) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }

  /* ---------------- Başlat ---------------- */
  function init() {
    setTimeout(listen, 1500);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }

  return { send, listen, playOverlay };
})();
