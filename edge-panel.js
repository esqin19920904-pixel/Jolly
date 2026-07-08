/* ============================================================
   JOLLY Edge Panel — sol kənarda sabit tutacaq, Samsung tərzi grid
   Elementlər Modul Studio kataloqundan gəlir
   ============================================================ */

const JollyEdgePanel = (() => {

  function renderItem(id) {
    const c = JollyStudios.getEdgeCatalogItem(id);
    // Xüsusi: son əlavələr (siyahı şəklində)
    if (c.special === 'lastAdded') {
      const items = JollyDB.Products.all().slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
      return `
        <div class="edge-cell edge-cell-wide" style="cursor:default;">
          <div class="ec-icon">🕓</div><div class="ec-label">Son əlavələr</div>
        </div>
        ${items.map(p => `<div class="edge-cell edge-cell-wide" onclick="JollyEdgePanel.close();JollyRouter.go('#/product/${p.id}')"><div class="ec-icon" style="font-size:15px;">•</div><div class="ec-label">${JollyProducts.escapeHtml(p.name)}</div></div>`).join('') || '<div class="edge-cell edge-cell-wide muted"><div class="ec-label">Hələ yoxdur</div></div>'}
      `;
    }
    // Adi: ikon + ad (grid xana), toxunanda action və ya route
    const onclick = c.action
      ? c.action
      : `JollyEdgePanel.close();JollyRouter.go('${c.route}')`;
    return `
      <div class="edge-cell" data-id="${id}" onclick="${onclick}">
        <div class="ec-icon">${c.icon}</div>
        <div class="ec-label">${c.label}</div>
      </div>
    `;
  }

  function render() {
    const cfg = JollyDB.getEdgeConfig();
    const panel = document.getElementById('edgePanel');
    if (!panel) return;
    const gridItems = cfg.items.filter(id => {
      const c = JollyStudios.getEdgeCatalogItem(id);
      return c.special !== 'lastAdded';
    });
    const wideItems = cfg.items.filter(id => {
      const c = JollyStudios.getEdgeCatalogItem(id);
      return c.special === 'lastAdded';
    });
    panel.innerHTML = `
      <div class="row between" style="margin-bottom:14px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:15px;">⚡ Sürətli Panel</span>
        <span class="icon-btn" onclick="JollyEdgePanel.close()" style="width:30px;height:30px;font-size:15px;">✕</span>
      </div>
      <div class="edge-grid">
        ${gridItems.map(renderItem).join('')}
      </div>
      ${wideItems.map(renderItem).join('')}
      <div class="edge-cell edge-cell-wide" onclick="JollyEdgePanel.close();JollyRouter.go('#/studios/module')" style="margin-top:10px;opacity:.6;">
        <div class="ec-icon" style="font-size:16px;">🧩</div><div class="ec-label">Fərdiləşdir</div>
      </div>
    `;
  }

  function open() {
    render();
    document.getElementById('edgePanel').classList.add('open');
    document.getElementById('edgeScrim').classList.add('open');
    if (typeof JollySound !== 'undefined') JollySound.tap();
    initCloseSwipe();
  }

  function initCloseSwipe() {
    const panel = document.getElementById('edgePanel');
    if (!panel || panel._closeSwipeBound) return;
    panel._closeSwipeBound = true;
    let sy = null;
    panel.addEventListener('touchstart', (e) => { sy = e.touches[0].clientY; }, { passive: true });
    panel.addEventListener('touchmove', (e) => {
      if (sy == null) return;
      if (e.touches[0].clientY - sy < -50) { sy = null; close(); }
    }, { passive: true });
    panel.addEventListener('touchend', () => { sy = null; }, { passive: true });
  }
  function close() {
    document.getElementById('edgePanel').classList.remove('open');
    document.getElementById('edgeScrim').classList.remove('open');
  }
  function toggle() {
    const panel = document.getElementById('edgePanel');
    if (panel.classList.contains('open')) close(); else open();
  }

  // Yuxarıdan aşağı çəkmə jesti ilə açılır (Samsung Edge kimi) — görünən düymə yoxdur
  function initDraggableTab() {
    // Köhnə kənar tab-ı gizlət
    const tab = document.getElementById('edgeTab');
    if (tab) tab.style.display = 'none';

    let startY = null, startX = null, tracking = false;
    const TOP_ZONE = 40;   // yalnız ekranın ən yuxarı 40px-dən başlayan çəkmə sayılır
    const TRIGGER = 70;    // bu qədər aşağı çəkilsə açılır

    window.addEventListener('touchstart', (e) => {
      const panel = document.getElementById('edgePanel');
      if (panel && panel.classList.contains('open')) return;
      const t = e.touches[0];
      if (t.clientY <= TOP_ZONE) {
        startY = t.clientY; startX = t.clientX; tracking = true;
      } else {
        tracking = false;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!tracking || startY == null) return;
      const t = e.touches[0];
      const dy = t.clientY - startY;
      const dx = Math.abs(t.clientX - startX);
      if (dy > TRIGGER && dy > dx) {
        tracking = false;
        startY = null;
        open();
      }
    }, { passive: true });

    window.addEventListener('touchend', () => { tracking = false; startY = null; }, { passive: true });
  }

  return { open, close, toggle, render, initDraggableTab };
})();
