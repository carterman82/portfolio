// Reveal whole text groups or individual panels, never both a parent and its children.
const targets = [...document.querySelectorAll([
  '.drats-about-heading', '.drats-about-copy', '.other-games > .wrap',
  '.web-intro-copy', '.web-mini-copy', '.article-preview',
  '.project-story', '.server-visual',
  '.experience-row', '.about-layout > div', '.hero-copy', '.hero-index',
  '.site-footer > .wrap', '.photo-credits',
].join(','))];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if ('IntersectionObserver' in window) {
  const reveal = element => {
    element.dataset.revealState = 'visible';
    observer.unobserve(element);
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) reveal(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

  const revealDestination = () => {
    // Anchor links should land on readable content immediately, including skipped sections.
    let destination;
    try { destination = document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch { return; }
    if (!destination) return;
    targets.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (element.contains(destination) || (destination.contains(element) && rect.top < innerHeight && rect.bottom > 0)) reveal(element);
    });
  };

  targets.forEach(element => {
    element.classList.add('scroll-reveal');
    const rect = element.getBoundingClientRect();
    // Preserve restored scroll positions and any content already on screen.
    if (reducedMotion.matches || rect.top < innerHeight * .92) {
      reveal(element);
    } else {
      element.dataset.revealState = 'pending';
      observer.observe(element);
    }
  });

  document.addEventListener('focusin', event => {
    targets.forEach(element => {
      if (element.contains(event.target)) reveal(element);
    });
  });
  addEventListener('hashchange', revealDestination);
  addEventListener('pageshow', event => {
    if (event.persisted) targets.forEach(reveal);
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) targets.forEach(reveal);
  });
  revealDestination();
}
