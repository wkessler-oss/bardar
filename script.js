// bardar landing, subtle scroll reveals + meter fill on view
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Rotating headline word (animated-hero style), CSS-transition driven so it
  // works with no external library. Outgoing word slides up and out; incoming
  // is reset below (without transition) then springs up into place.
  const rotator = document.querySelector('.rotator');
  if (rotator && !reduce) {
    const words = [...rotator.querySelectorAll('.rotator__word')];
    if (words.length > 1) {
      let cur = 0;
      setInterval(() => {
        const outgoing = words[cur];
        cur = (cur + 1) % words.length;
        const incoming = words[cur];

        outgoing.classList.remove('is-active');
        outgoing.classList.add('is-up');

        incoming.classList.add('no-transition');
        incoming.classList.remove('is-up', 'is-active'); // -> default (below)
        void incoming.offsetWidth;                       // commit position
        incoming.classList.remove('no-transition');
        void incoming.offsetWidth;
        incoming.classList.add('is-active');             // spring up into view
      }, 2200);
    }
  }

  // Reveal sections as they scroll into view
  const revealables = document.querySelectorAll(
    '.section, .strip, .cta, .step, .card, .live-card'
  );
  revealables.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(18px)';
    el.style.transition = 'opacity .6s ease, transform .6s ease';
  });

  if (reduce || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        setTimeout(() => {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }, Math.min(i * 60, 180));
        io.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  revealables.forEach((el) => io.observe(el));
})();
