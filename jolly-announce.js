/* ============================================================
   JOLLY Announce — Əyləncəli Anlıq Elan Sistemi
   OTA-dan TAM ASILI DEYİL — ayrıca Firebase node, ayrıca
   admin düyməsi. Admin basanda bütün açıq telefonlarda tam
   ekran animasiyalı bir "elan" açılır: mətn → bomba → partlayış.
   ============================================================ */
const JollyAnnounce = (() => {
  const DB_URL = "https://jolly2026-b3c06-default-rtdb.europe-west1.firebasedatabase.app";
  const API_KEY = "AIzaSyAhv-ZFTTNeyoXIDjn3VrVcknPKor4kZvw";
  const SIGNAL_NODE = 'jolly_announce_signal';
  const POLL_MS = 8000; // bu sadəcə əyləncə üçündür, tez cavab versin deyə OTA-dan sürətli

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

  function _isAdminSession() {
    try {
      const sess = JSON.parse(sessionStorage.getItem('jolly_sec_session') || 'null');
      return !sess || sess.role === 'admin';
    } catch (e) { return true; }
  }

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
      // admin özündə də görsün
      playOverlay();
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
          // ilk açılışda köhnə siqnala reaksiya vermə, "görülmüş" say
          if (val && val.ts && getLastSignal() === 0) setLastSignal(val.ts);
        }
      } catch (e) {}
      _pollTimer = setInterval(poll, POLL_MS);
    })();
  }

  /* ---------------- Tam ekran animasiya ---------------- */
  function ensureStyles() {
    if (document.getElementById('jollyAnnounceStyle')) return;
    const style = document.createElement('style');
    style.id = 'jollyAnnounceStyle';
    style.textContent = `
      #jollyAnnounceOverlay{
        position:fixed;inset:0;z-index:999999;
        background: radial-gradient(ellipse at 50% 30%, #1a1f3a 0%, #05060c 70%);
        display:flex;align-items:center;justify-content:center;flex-direction:column;
        opacity:0;transition:opacity .35s ease;
      }
      #jollyAnnounceOverlay.show{ opacity:1; }
      #jollyAnnounceOverlay .ja-star{ position:absolute;width:3px;height:3px;background:#fff;border-radius:50%;
        animation: jaTwinkle 2.4s ease-in-out infinite; }
      @keyframes jaTwinkle{ 0%,100%{opacity:.15;} 50%{opacity:.9;} }
      #jollyAnnounceOverlay .ja-text{
        position:relative;z-index:5;text-align:center;
        font-size:clamp(26px,8vw,54px);font-weight:900;line-height:1.3;padding:0 24px;
        background:linear-gradient(90deg,#d4af37,#f4d777,#fff5cc,#f4d777,#d4af37);
        background-size:300% auto;-webkit-background-clip:text;background-clip:text;color:transparent;
        animation: jaShine 2.2s linear infinite, jaEntrance 800ms cubic-bezier(.2,1.4,.4,1) both;
        text-shadow:0 0 40px rgba(212,175,55,.25);
      }
      @keyframes jaShine{ to{ background-position:-300% center; } }
      @keyframes jaEntrance{
        0%{transform:scale(.2) rotate(-8deg);opacity:0;}
        60%{transform:scale(1.15) rotate(3deg);opacity:1;}
        80%{transform:scale(.95) rotate(-2deg);}
        100%{transform:scale(1) rotate(0deg);}
      }
      #jollyAnnounceOverlay .ja-emojis{
        position:relative;z-index:5;text-align:center;font-size:clamp(28px,9vw,50px);margin-top:12px;
        animation: jaEntrance 800ms 150ms cubic-bezier(.2,1.4,.4,1) both;
      }
      #jollyAnnounceOverlay .ja-emojis span{ display:inline-block;animation: jaBob 1.1s ease-in-out infinite; }
      #jollyAnnounceOverlay .ja-emojis span:nth-child(2){ animation-delay:.15s; }
      #jollyAnnounceOverlay .ja-emojis span:nth-child(3){ animation-delay:.3s; }
      @keyframes jaBob{ 0%,100%{transform:translateY(0) rotate(0deg);} 50%{transform:translateY(-14px) rotate(8deg);} }

      #jollyAnnounceOverlay .ja-bomb{
        position:absolute;top:50%;left:50%;font-size:60px;
        transform:translate(-50%,-160%);opacity:0;z-index:6;
      }
      #jollyAnnounceOverlay .ja-bomb.drop{ animation: jaDrop 700ms cubic-bezier(.5,0,.5,1) forwards; }
      @keyframes jaDrop{
        0%{ transform:translate(-50%,-260%) rotate(-20deg); opacity:0; }
        70%{ transform:translate(-50%,-40%) rotate(10deg); opacity:1; }
        85%{ transform:translate(-50%,-55%) rotate(-6deg); }
        100%{ transform:translate(-50%,-48%) rotate(0deg); opacity:1; }
      }
      #jollyAnnounceOverlay .ja-bomb.fuse{ animation: jaDrop 700ms cubic-bezier(.5,0,.5,1) forwards, jaFuse .35s ease-in-out .7s 4; }
      @keyframes jaFuse{ 0%,100%{ transform:translate(-50%,-48%) scale(1); } 50%{ transform:translate(-50%,-48%) scale(1.12); } }

      #jollyAnnounceOverlay .ja-flash{
        position:fixed;inset:0;background:#fff;opacity:0;z-index:20;pointer-events:none;
      }
      #jollyAnnounceOverlay .ja-flash.go{ animation: jaFlash .5s ease-out forwards; }
      @keyframes jaFlash{ 0%{opacity:0;} 12%{opacity:1;} 100%{opacity:0;} }

      #jollyAnnounceOverlay.shake{ animation: jaShake .5s; }
      @keyframes jaShake{
        0%,100%{transform:translate(0,0);}
        20%{transform:translate(-10px,5px);}
        40%{transform:translate(10px,-5px);}
        60%{transform:translate(-7px,-3px);}
        80%{transform:translate(7px,3px);}
      }
      #jollyAnnounceOverlay .ja-boom-text{
        position:relative;z-index:8;margin-top:18px;font-size:clamp(22px,7vw,40px);font-weight:900;
        color:#ffb84d;text-shadow:0 0 20px rgba(255,140,0,.6);opacity:0;
      }
      #jollyAnnounceOverlay .ja-boom-text.go{ animation: jaEntrance 500ms cubic-bezier(.2,1.4,.4,1) forwards; }

      #jollyAnnounceOverlay .ja-particle{
        position:absolute;top:50%;left:50%;font-size:24px;pointer-events:none;z-index:7;
        animation: jaFly 1.4s ease-out forwards;
      }
      @keyframes jaFly{
        0%{ transform:translate(-50%,-50%) scale(.6); opacity:1; }
        100%{ transform:translate(var(--dx),var(--dy)) scale(1.3) rotate(180deg); opacity:0; }
      }
      #jollyAnnounceOverlay .ja-hint{
        position:fixed;bottom:26px;left:0;right:0;text-align:center;color:#6b7094;font-size:12px;z-index:9;
      }
    `;
    document.head.appendChild(style);
  }

  function playOverlay() {
    ensureStyles();
    let old = document.getElementById('jollyAnnounceOverlay');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'jollyAnnounceOverlay';
    el.innerHTML = `
      <div class="ja-text">Gör indi qaqan<br>nağarajax</div>
      <div class="ja-emojis"><span>😅</span><span>😅</span><span>😅</span></div>
      <div class="ja-bomb">💣</div>
      <div class="ja-boom-text">HƏR ŞEY DAĞILDI 😅💥</div>
      <div class="ja-flash"></div>
      <div class="ja-hint">✦ ekrana toxun, bağla ✦</div>
    `;
    document.body.appendChild(el);

    for (let i = 0; i < 40; i++) {
      const s = document.createElement('div');
      s.className = 'ja-star';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.top = Math.random() * 100 + 'vh';
      s.style.animationDelay = (Math.random() * 2.4) + 's';
      el.insertBefore(s, el.firstChild);
    }

    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));

    // 1) mətn + emoji görünür (ilk 2.4san)
    // 2) bomba düşür və fitil yanır
    setTimeout(() => {
      const bomb = el.querySelector('.ja-bomb');
      bomb.classList.add('drop', 'fuse');
    }, 2400);

    // 3) partlayış
    setTimeout(() => {
      boom(el);
    }, 4200);

    // toxunanda bağla
    el.addEventListener('click', () => close(el));
    // özü sönsün
    setTimeout(() => close(el), 9000);
  }

  function boom(el) {
    const bomb = el.querySelector('.ja-bomb');
    if (bomb) bomb.style.opacity = '0';
    el.querySelector('.ja-flash').classList.add('go');
    el.classList.add('shake');
    if (navigator.vibrate) navigator.vibrate([40, 30, 40, 30, 80]);

    const boomText = el.querySelector('.ja-boom-text');
    boomText.classList.add('go');

    const parts = ['💥','🔥','💨','✨','😅','⭐'];
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      p.className = 'ja-particle';
      p.textContent = parts[Math.floor(Math.random() * parts.length)];
      const angle = Math.random() * Math.PI * 2;
      const dist = 140 + Math.random() * 260;
      p.style.setProperty('--dx', `calc(-50% + ${Math.cos(angle) * dist}px)`);
      p.style.setProperty('--dy', `calc(-50% + ${Math.sin(angle) * dist}px)`);
      el.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  }

  function close(el) {
    if (!el || !el.parentNode) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }

  /* ---------------- Admin düyməsi (özü inject edir) ---------------- */
  function injectButton() {
    if (!_isAdminSession()) return;
    if (document.getElementById('jollyAnnounceBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'jollyAnnounceBtn';
    btn.textContent = '📢';
    btn.title = 'Elan Göndər';
    btn.style.cssText = `
      position:fixed;left:16px;bottom:100px;z-index:9998;
      width:52px;height:52px;border-radius:50%;border:none;
      background:linear-gradient(135deg,#d4af37,#b8912b);
      color:#1a1206;font-size:22px;
      box-shadow:0 6px 18px rgba(0,0,0,.4),0 0 14px rgba(212,175,55,.35);
      cursor:pointer;
    `;
    btn.onclick = send;
    document.body.appendChild(btn);
  }

  /* ---------------- Başlat ---------------- */
  function init() {
    setTimeout(() => { injectButton(); listen(); }, 1500);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }

  return { send, listen, playOverlay };
})();
