/* ============================================================
   JOLLY Announce — Əyləncəli Anlıq Elan Sistemi
   OTA-dan asılı deyil (ayrıca Firebase node), amma düyməsi
   Studio → Yeniləmələr panelinin içindədir (jolly-ota.js-də).
   Admin göndərəndə bütün açıq telefonlarda tam ekran animasiya
   açılır: Matrix yağışı arxa planda + mətn yazı maşını effekti,
   üstünə "jolly-nagarajax.mp4" faylının səsi çalınır.
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

  /* ---------------- Göndər ---------------- */
  async function send() {
    try {
      const token = await _getToken();
      const res = await fetch(`${DB_URL}/${SIGNAL_NODE}.json?auth=${token}`, {
        method: 'PUT',
        body: JSON.stringify({ ts: Date.now() }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (typeof Toast !== 'undefined') Toast.success('Elan göndərildi 📢');
      playOverlay(); // admin özündə də görsün (toxunma ilə başladığı üçün səs bloklanmır)
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

  /* ---------------- Səs ---------------- */
  function playSound() {
    try {
      const audio = new Audio(SOUND_URL);
      audio.volume = 1.0;
      const p = audio.play();
      if (p && p.catch) {
        p.catch(() => {
          // brauzer avtomatik çalmağı bloklayıb (toxunma olmadan gələn siqnal) —
          // sakit keç, animasiya səssiz davam edir
        });
      }
    } catch (e) {}
  }

  /* ---------------- Tam ekran animasiya: Matrix + Yazı maşını ---------------- */
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

      #jaRain{ position:absolute; inset:0; z-index:4; overflow:hidden; }
      .ja-rain-col{ position:absolute; top:-100vh; font-family:monospace; font-size:15px; color:#8fffb0; line-height:1.15;
        text-shadow:0 0 6px rgba(143,255,176,.6); white-space:pre; animation: jaRainFall linear infinite; }
      @keyframes jaRainFall{ to{ transform:translateY(200vh); } }

      #jaTyped{
        position:relative;z-index:5;text-align:center;padding:0 24px;
        font-size:clamp(24px,7vw,44px);font-weight:900;line-height:1.35;white-space:pre-wrap;
        color:#f4d777;text-shadow:0 0 22px rgba(212,175,55,.5), 0 0 6px rgba(143,255,176,.3);
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

  const _RAIN_CHARS = 'アカサタナ01ﾊﾏﾔﾗﾜ京都愛金運夢火水木';

  function spawnRain(container) {
    container.innerHTML = '';
    const cols = Math.ceil(window.innerWidth / 20);
    for (let i = 0; i < cols; i++) {
      const col = document.createElement('div');
      col.className = 'ja-rain-col';
      let str = '';
      const len = 20 + Math.floor(Math.random() * 14);
      for (let j = 0; j < len; j++) str += _RAIN_CHARS[Math.floor(Math.random() * _RAIN_CHARS.length)] + '\n';
      col.textContent = str;
      col.style.left = (i * 20) + 'px';
      col.style.animationDuration = (2.4 + Math.random() * 1.8) + 's';
      col.style.animationDelay = (Math.random() * -2.5) + 's';
      col.style.opacity = 0.3 + Math.random() * 0.4;
      container.appendChild(col);
    }
  }

  function playOverlay() {
    ensureStyles();
    let old = document.getElementById('jollyAnnounceOverlay');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'jollyAnnounceOverlay';
    el.innerHTML = `
      <div id="jaRain"></div>
      <div id="jaTyped"></div>
      <div class="ja-hint">✦ ekrana toxun, bağla ✦</div>
    `;
    document.body.appendChild(el);

    for (let s = 0; s < 40; s++) {
      const st = document.createElement('div');
      st.className = 'ja-star';
      st.style.left = Math.random() * 100 + 'vw';
      st.style.top = Math.random() * 100 + 'vh';
      st.style.animationDelay = (Math.random() * 2.2) + 's';
      el.insertBefore(st, el.firstChild);
    }

    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    playSound();

    spawnRain(el.querySelector('#jaRain'));
    const rainRefresh = setInterval(() => {
      if (!document.getElementById('jollyAnnounceOverlay')) { clearInterval(rainRefresh); return; }
      if (Math.random() < 0.4) spawnRain(el.querySelector('#jaRain'));
    }, 3000);

    const typed = el.querySelector('#jaTyped');
    const full = 'Gör indi qaqan\nnağarajax 😅😅😅';
    typed.innerHTML = '<span class="ja-cursor">&nbsp;</span>';
    let i = 0;
    const typeIv = setInterval(() => {
      i++;
      typed.innerHTML = full.slice(0, i).replace(/\n/g, '<br>') + '<span class="ja-cursor">&nbsp;</span>';
      if (i >= full.length) clearInterval(typeIv);
    }, 60);

    el.addEventListener('click', () => close(el, rainRefresh));
    setTimeout(() => close(el, rainRefresh), 9000);
  }

  function close(el, rainRefresh) {
    if (rainRefresh) clearInterval(rainRefresh);
    if (!el || !el.parentNode) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }

  /* ---------------- Başlat (yalnız siqnal dinləyicisi — düymə OTA panelindədir) ---------------- */
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
