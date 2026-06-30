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
      duration: 1200,
      delay: stagger(90, { start: 120 }),
      ease: 'outExpo',
    });
  }
}
