// bardar landing — subtle scroll reveals + meter fill on view
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
