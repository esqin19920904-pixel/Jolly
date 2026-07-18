/**
 * JOLLY Store OS — Fingerprint Scanner (SVG animasiya)
 */
class FingerprintScanner {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.options = { onSuccess: options.onSuccess || (() => {}), onError: options.onError || (() => {}), scanDuration: options.scanDuration || 2000, ...options };
    this.isScanning = false;
    this.animationId = null;
    this.init();
  }
  init() { this.render(); this.bindEvents(); }
  render() {
    this.container.innerHTML = `
      <div class="jauth-fp-ring" id="jauth-fp-ring">
        <svg class="jauth-fp-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" opacity="0.3"/>
          <path d="M12 5c-3.87 0-7 3.13-7 7" opacity="0.6"/>
          <path d="M12 7c-2.76 0-5 2.24-5 5" opacity="0.6"/>
          <path d="M12 9c-1.66 0-3 1.34-3 3" opacity="0.6"/>
          <path d="M8 5.5C9.5 4.5 11 4 12 4c3.5 0 6.5 2.5 7.5 6" opacity="0.4"/>
          <path d="M19 12c0 3.87-3.13 7-7 7" opacity="0.5"/>
          <path d="M17 12c0 2.76-2.24 5-5 5" opacity="0.5"/>
          <path d="M15 12c0 1.66-1.34 3-3 3" opacity="0.5"/>
          <circle cx="12" cy="12" r="1.5" opacity="0.8"/>
        </svg>
        <div class="jauth-scan-line" id="jauth-scan-line"></div>
      </div>
      <p class="jauth-fp-hint" id="jauth-fp-hint">Barmağınızı toxundurun</p>
    `;
    this.ring = this.container.querySelector('#jauth-fp-ring');
    this.scanLine = this.container.querySelector('#jauth-scan-line');
    this.hint = this.container.querySelector('#jauth-fp-hint');
  }
  bindEvents() {
    if (this.ring) {
      this.ring.addEventListener('click', () => this.startScan());
      this.ring.addEventListener('touchstart', (e) => { e.preventDefault(); this.startScan(); }, { passive: false });
    }
  }
  startScan() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.ring.classList.add('scanning');
    this.scanLine.classList.add('active');
    this.hint.textContent = 'Skan edilir...';
    this.hint.className = 'jauth-fp-hint scanning';
    const start = Date.now();
    const tick = () => {
      if (!this.isScanning) return;
      if (Date.now() - start >= this.options.scanDuration) { this.completeScan(); return; }
      this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
  }
  completeScan() {
    this.isScanning = false;
    this.scanLine.classList.remove('active');
    this.ring.classList.remove('scanning');
    this.ring.classList.add('success');
    this.hint.textContent = 'Tanındı!';
    this.hint.className = 'jauth-fp-hint success';
    setTimeout(() => this.options.onSuccess(), 800);
  }
  reset() {
    this.isScanning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.ring) { this.ring.classList.remove('scanning', 'success'); }
    if (this.scanLine) this.scanLine.classList.remove('active');
    if (this.hint) { this.hint.textContent = 'Barmağınızı toxundurun'; this.hint.className = 'jauth-fp-hint'; }
  }
}
