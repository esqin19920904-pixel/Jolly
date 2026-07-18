/**
 * JOLLY Store OS — Animation Engine
 */
const JollyAnimations = {
  easing: { outExpo: 'cubic-bezier(0.16,1,0.3,1)', spring: 'cubic-bezier(0.34,1.56,0.64,1)', smooth: 'cubic-bezier(0.4,0,0.2,1)' },
  animate(el, kf, opts = {}) {
    if (!el) return null;
    return el.animate(kf, { duration: 400, easing: this.easing.outExpo, fill: 'forwards', ...opts });
  },
  fadeIn(el, dur = 400, delay = 0) {
    return this.animate(el, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: dur, delay });
  },
  scaleIn(el, dur = 500, delay = 0) {
    return this.animate(el, [{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1)' }], { duration: dur, delay, easing: this.easing.spring });
  },
  shake(el, dur = 400) {
    return this.animate(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)', offset: 0.2 }, { transform: 'translateX(10px)', offset: 0.4 }, { transform: 'translateX(-8px)', offset: 0.6 }, { transform: 'translateX(8px)', offset: 0.8 }, { transform: 'translateX(0)' }], { duration: dur, easing: 'ease-in-out' });
  },
  createRipple(event, container) {
    const rect = container.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(0,212,255,0.3);width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px;pointer-events:none;transform:scale(0);opacity:0.6;`;
    container.appendChild(ripple);
    const anim = ripple.animate([{ transform: 'scale(0)', opacity: 0.6 }, { transform: 'scale(2.5)', opacity: 0 }], { duration: 600, easing: this.easing.outExpo });
    anim.onfinish = () => ripple.remove();
  },
  particleBurst(el, color = '0,212,255', count = 12) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;';
    document.body.appendChild(container);
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const angle = (Math.PI * 2 / count) * i;
      const dist = 50 + Math.random() * 60;
      const size = 3 + Math.random() * 3;
      p.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;border-radius:50%;background:rgb(${color});`;
      container.appendChild(p);
      p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) scale(0)`, opacity: 0 }], { duration: 600, easing: this.easing.outExpo });
    }
    setTimeout(() => container.remove(), 800);
  },
  transitionScreens(from, to, dir = 'forward') {
    return new Promise(resolve => {
      if (from) {
        const exit = from.animate([{ opacity: 1, transform: 'translateX(0) scale(1)' }, { opacity: 0, transform: dir === 'forward' ? 'translateX(-30px) scale(0.95)' : 'translateX(30px) scale(0.95)' }], { duration: 300, easing: this.easing.smooth });
        exit.onfinish = () => {
          from.classList.remove('active');
          to.classList.add('active');
          const enter = to.animate([{ opacity: 0, transform: dir === 'forward' ? 'translateX(30px) scale(0.95)' : 'translateX(-30px) scale(0.95)' }, { opacity: 1, transform: 'translateX(0) scale(1)' }], { duration: 400, easing: this.easing.outExpo });
          enter.onfinish = resolve;
        };
      } else {
        to.classList.add('active');
        this.fadeIn(to, 500).onfinish = resolve;
      }
    });
  },
  async unlockSequence(card, onComplete) {
    await card.animate([{ transform: 'scale(1)', filter: 'blur(0px)', opacity: 1 }, { transform: 'scale(0.9)', filter: 'blur(4px)', opacity: 0.8 }], { duration: 300, easing: this.easing.smooth }).finished;
    const wave = document.createElement('div');
    wave.className = 'jauth-unlock-wave';
    document.body.appendChild(wave);
    await card.animate([{ opacity: 0.8, transform: 'scale(0.9)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 500, easing: this.easing.outExpo }).finished;
    setTimeout(() => { wave.remove(); if (onComplete) onComplete(); }, 600);
  },
  stagger(children, fn, delay = 50, base = 0) {
    Array.from(children).forEach((child, i) => setTimeout(() => fn(child), base + i * delay));
  }
};
