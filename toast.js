/* JOLLY Toast — Dynamic Island tərzi bildiriş kapsulu */

const Toast = (() => {
  let wrap, edgeFrame;
  function ensureWrap() {
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    if (!edgeFrame) {
      edgeFrame = document.createElement('div');
      edgeFrame.id = 'edgeLightFrame';
      document.body.appendChild(edgeFrame);
    }
  }
  function flashEdge(type) {
    if (!edgeFrame) return;
    edgeFrame.className = '';
    void edgeFrame.offsetWidth;
    edgeFrame.className = `edge-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}`;
    setTimeout(() => { edgeFrame.className = ''; }, 900);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function show(message, type = 'default', duration = 2400) {
    ensureWrap();
    flashEdge(type);
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '🔔';
    const el = document.createElement('div');
    el.className = `toast ${type} di-capsule`;
    el.innerHTML = `<span class="di-icon">${icon}</span><span class="di-text">${esc(message)}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('di-open')));
    setTimeout(() => {
      el.classList.remove('di-open');
      el.classList.add('di-closing');
      setTimeout(() => el.remove(), 400);
    }, duration);
  }
  return {
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m),
  };
})();
