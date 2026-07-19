  window.jollyAuthShow = function() {
    // State tam sıfırla
    S.pin = '';
    S.role = null;
    S.screen = 'role';
    for(let i=0;i<4;i++){
      const d=document.getElementById('ja-pd'+i);
      if(d) d.className='ja-pin-dot';
    }
    document.querySelectorAll('#jolly-auth-overlay .ja-role-card').forEach(c=>c.classList.remove('pick'));
    // Overlay göstər — width/height əlavə etmirik, inset:0 ilə fixed onsuz da tam ekranı tutur
    const ov = document.getElementById('jolly-auth-overlay');
    ov.style.display = 'block';
    setTimeout(resizeC, 50);
    jaGo('role');
    jaStartParticles();
  };
