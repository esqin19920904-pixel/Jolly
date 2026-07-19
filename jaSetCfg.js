  window._jaSetCfg = function(cfg, setSession, applyViewer) {
    _cfg = cfg;
    _setSession = setSession;
    _applyViewer = applyViewer;
    // Barmaq izi düyməsini göstər/gizlət
    const fpBtn = document.getElementById('ja-btn-fp');
    if (fpBtn) fpBtn.style.display = _cfg.biometricCredId ? '' : 'none';

    // User kartını göstər/gizlət
    const uc = document.getElementById('ja-user-card');
    const grid = document.getElementById('ja-role-grid');
    if (uc && grid) {
      if (_cfg.viewerEnabled && _cfg.viewerPinHash) {
        uc.style.display = '';
        grid.style.gridTemplateColumns = '1fr 1fr';
      } else {
        uc.style.display = 'none';
        grid.style.gridTemplateColumns = '1fr';
      }
    }
    // Kart ölçüsü sabit qalsın (User olub-olmamasından asılı olmasın)
    const card = document.getElementById('ja-card');
    if (card) card.style.maxWidth = '400px';
  };
