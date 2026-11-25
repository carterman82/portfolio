// Two light streaks sweep in opposite directions, tracking scroll reversibly.
const intro = document.querySelector('.experience-intro');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (intro) {
  const stage = intro.querySelector('.experience-intro-stage');
  const streaks = [...intro.querySelectorAll('.experience-streak')];
  const clamp = value => Math.max(0, Math.min(1, value));
  let frame = 0;
  let active = false;
  let geometry;

  function render() {
    frame = 0;
    if (!geometry) return;
    const { width } = geometry;
    const progress = reducedMotion.matches ? 1 : clamp(-intro.getBoundingClientRect().top / Math.max(1, intro.offsetHeight - stage.offsetHeight));
    streaks.forEach((streak, index) => {
      const t = clamp((progress - index * .08) / .88);
      const x = width * (index ? 1.2 - 3 * t : -1.1 + 3 * t);
      streak.style.transform = `translateX(${x}px) rotate(-12deg)`;
      streak.style.opacity = reducedMotion.matches ? '0' : String(clamp(t / .14) * clamp((1 - t) / .18));
    });
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function measure() {
    geometry = { width: stage.clientWidth };
    schedule();
  }
  function configure() {
    intro.toggleAttribute('data-animated', !reducedMotion.matches);
    measure();
  }
  new IntersectionObserver(entries => {
    active = entries[0].isIntersecting;
    if (active) schedule();
  }, { rootMargin: '100px' }).observe(intro);
  addEventListener('scroll', () => { if (active && !reducedMotion.matches) schedule(); }, { passive: true });
  addEventListener('resize', measure, { passive: true });
  addEventListener('pageshow', measure);
  reducedMotion.addEventListener('change', configure);
  document.fonts.ready.then(measure);
  configure();
}
