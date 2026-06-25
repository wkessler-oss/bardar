// bardar landing, anime.js (v4) animations.
// Loaded as an ES module from the jsDelivr CDN. If the import fails or the
// user prefers reduced motion, nothing runs and all content stays visible
// (we only set "from" states in JS right before animating).
import { animate, stagger } from 'https://cdn.jsdelivr.net/npm/animejs@4.0.0/+esm';

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // --- Hero entrance: stagger the copy up on load ---
  // (CSS .anim-pending pre-hides these to avoid a flash; anime's inline
  //  opacity overrides the class, and the head-script timeout clears it.)
  const heroEls = document.querySelectorAll('.hero__copy > *');
  if (heroEls.length) {
    animate(heroEls, {
      opacity: [0, 1],
      y: [22, 0],
      duration: 760,
      delay: stagger(90, { start: 120 }),
      ease: 'outExpo',
    });
  }

  // --- Rotating headline word (animated-hero style) ---
  const rotator = document.querySelector('.rotator');
  if (rotator) {
    const words = [...rotator.querySelectorAll('.rotator__word')];
    if (words.length > 1) {
      words.forEach((w, i) => {
        w.style.willChange = 'transform, opacity';
        if (i !== 0) { w.style.opacity = '0'; w.style.transform = 'translateY(110%)'; }
      });
      let idx = 0;
      setInterval(() => {
        const out = words[idx];
        idx = (idx + 1) % words.length;
        const incoming = words[idx];
        animate(out, { translateY: ['0%', '-110%'], opacity: [1, 0], duration: 700, ease: 'inOutQuad' });
        animate(incoming, { translateY: ['110%', '0%'], opacity: [0, 1], duration: 800, ease: 'outExpo' });
      }, 2200);
    }
  }

  // --- Live crowd meters fill + percentages count up when in view ---
  const liveSection = document.querySelector('#livenow');
  if (liveSection) {
    const meters = document.querySelectorAll('.live-card__meter span');
    meters.forEach((m) => {
      m.style.transformOrigin = 'left';
      m.style.transform = 'scaleX(0)';
    });

    const counters = [...document.querySelectorAll('.live-card footer span:first-child')];
    const targets = counters.map((c) => parseInt(c.textContent, 10) || 0);

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();

        // bars sweep up to their live crowd level
        animate(meters, {
          scaleX: [0, 1],
          duration: 1100,
          delay: stagger(130),
          ease: 'outExpo',
        });

        // percentages tick up from 0
        counters.forEach((c, i) => {
          const o = { v: 0 };
          animate(o, {
            v: targets[i],
            duration: 1100,
            delay: i * 130,
            ease: 'outExpo',
            onUpdate: () => { c.textContent = Math.round(o.v) + '% full'; },
          });
        });
      });
    }, { threshold: 0.3 });

    io.observe(liveSection);
  }
}
