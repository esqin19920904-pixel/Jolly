/* ============================================================
   JOLLY Viewer — Instagram tərzi şəkil/barkod böyük baxış
   Toxun/basılı-saxla açılır, zoom, sürüşdürmə, kopyala, bağla
   ============================================================ */

const JollyViewer = (() => {
  let current = { images: [], index: 0, barcodeText: null };

  function open(images, startIndex = 0, barcodeText = null, opts = {}) {
    if (!images || !images.length) return;
    current = { images, index: startIndex, barcodeText, peek: !!opts.peek };
    render();
  }

  function render() {
    let overlay = document.getElementById('viewerOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'viewerOverlay';
      overlay.className = 'viewer-overlay';
      document.body.appendChild(overlay);
    }
    const img = current.images[current.index];
    const multi = current.images.length > 1;
    overlay.innerHTML = `
      <div class="viewer-close" onclick="JollyViewer.close()">✕</div>
      <div class="viewer-stage${current.barcodeText ? ' barcode-scanbox' : ''}" id="viewerStage">
        <img src="${img}" id="viewerImg" class="viewer-img" alt="">
      </div>
      ${multi ? `
        <div class="viewer-nav viewer-prev" onclick="JollyViewer.prev()">‹</div>
        <div class="viewer-nav viewer-next" onclick="JollyViewer.next()">›</div>
        <div class="viewer-dots">
          ${current.images.map((_, i) => `<span class="vdot ${i === current.index ? 'on' : ''}"></span>`).join('')}
        </div>
      ` : ''}
      ${current.barcodeText ? `
        <div class="viewer-barcode">
          <span class="mono" style="font-size:16px;">${escapeHtml(current.barcodeText)}</span>
          <div class="row" style="gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="JollyViewer.copyBarcode()">📋 Kopyala</button>
            <button class="btn btn-ghost btn-sm" onclick="JollyViewer.downloadBarcode()">⬇️ PNG</button>
            <button class="btn btn-ghost btn-sm" onclick="JollyViewer.printBarcode()">🖨️</button>
          </div>
        </div>
      ` : ''}
    `;
    overlay.classList.toggle('peek', !!current.peek);
    requestAnimationFrame(() => overlay.classList.add('open'));
    if (!current.peek) attachGestures();
  }

  function attachGestures() {
    const overlay = document.getElementById('viewerOverlay');
    const stage = document.getElementById('viewerStage');
    const imgEl = document.getElementById('viewerImg');
    if (!overlay || !stage) return;

    // 2 dəfə toxunma = bağla; qırağa toxunma = bağla
    let lastTap = 0;
    stage.addEventListener('click', (e) => {
      if (e.target !== imgEl) { close(); return; } // qıraq
      const now = Date.now();
      if (now - lastTap < 300) { close(); } // 2 dəfə
      lastTap = now;
    });

    // Pinch zoom (iki barmaq) + sürüşdürmə (bir barmaq, çox şəkil olanda)
    let scale = 1, startDist = 0, startScale = 1;
    let panX = 0, panY = 0, startX = 0, startY = 0, panning = false;
    let swipeStartX = 0;

    imgEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startScale = scale;
      } else if (e.touches.length === 1) {
        if (scale > 1) { panning = true; startX = e.touches[0].clientX - panX; startY = e.touches[0].clientY - panY; }
        swipeStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    imgEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        scale = Math.min(4, Math.max(1, startScale * (dist(e.touches) / startDist)));
        applyTransform(imgEl, scale, panX, panY);
      } else if (e.touches.length === 1 && panning && scale > 1) {
        e.preventDefault();
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        applyTransform(imgEl, scale, panX, panY);
      }
    }, { passive: false });

    imgEl.addEventListener('touchend', (e) => {
      panning = false;
      // zoom yoxdursa və çox şəkil varsa — sürüşdür (swipe)
      if (scale <= 1 && current.images.length > 1 && e.changedTouches.length) {
        const dx = e.changedTouches[0].clientX - swipeStartX;
        if (dx < -50) next();
        else if (dx > 50) prev();
      }
      if (scale <= 1) { panX = 0; panY = 0; applyTransform(imgEl, 1, 0, 0); }
    });
  }

  function applyTransform(el, s, x, y) {
    el.style.transform = `translate(${x}px,${y}px) scale(${s})`;
  }
  function dist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function next() { current.index = (current.index + 1) % current.images.length; render(); }
  function prev() { current.index = (current.index - 1 + current.images.length) % current.images.length; render(); }

  function copyBarcode() {
    if (!current.barcodeText) return;
    const t = current.barcodeText;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(t).then(() => Toast.success('Barkod kopyalandı')).catch(() => fallbackCopy(t));
    } else fallbackCopy(t);
  }
  function fallbackCopy(t) {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); Toast.success('Barkod kopyalandı'); } catch (e) { Toast.error('Kopyalanmadı'); }
    ta.remove();
  }

  function close() {
    const overlay = document.getElementById('viewerOverlay');
    if (overlay) { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 200); }
  }

  /* ---------- Peek: basılı saxla = önizləmə, burax = bağla ---------- */
  let peekTimer = null;
  let peeking = false;
  let suppressClick = false;

  function initPeek() {
    let pressStart = null;

    function startPeek(target, clientX) {
      const el = target.closest('.peekable');
      if (!el) return;
      const raw = el.getAttribute('data-pki');
      if (!raw) return;
      let imgs;
      try { imgs = JSON.parse(raw); } catch (err) { return; }
      if (!imgs || !imgs.length) return; // şəkilsizsə peek yoxdur
      peekTimer = setTimeout(async () => {
        peekTimer = null;
        const idx = parseInt(el.getAttribute('data-pkx') || '0', 10);
        if (typeof JollyStorage !== 'undefined') imgs = await JollyStorage.resolveAll(imgs);
        peeking = true;
        suppressClick = true;
        if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e2) {} }
        open(imgs, idx, null, { peek: true });
      }, 330);
    }
    function endPeek() {
      if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; }
      if (peeking) {
        peeking = false;
        close();
        setTimeout(() => { suppressClick = false; }, 350);
      }
    }
    function cancelPeek() {
      if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; }
    }

    // Touch (telefon)
    document.addEventListener('touchstart', (e) => startPeek(e.target, 0), { passive: true });
    document.addEventListener('touchend', endPeek, { passive: true });
    document.addEventListener('touchmove', cancelPeek, { passive: true });
    // Mouse (localhost/desktop test)
    document.addEventListener('mousedown', (e) => startPeek(e.target, e.clientX));
    document.addEventListener('mouseup', endPeek);
    document.addEventListener('mouseleave', cancelPeek);

    document.addEventListener('click', (e) => {
      if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
    }, true);
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function downloadBarcode() {
    if (!current.barcodeText || typeof JollyBarcodeGen === 'undefined') return;
    JollyBarcodeGen.download(current.barcodeText);
  }
  function printBarcode() {
    if (!current.barcodeText || typeof JollyBarcodeGen === 'undefined') return;
    JollyBarcodeGen.print(current.barcodeText);
  }

  return { open, close, next, prev, copyBarcode, downloadBarcode, printBarcode, initPeek };
})();
