const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll('.web-intro').forEach(intro => {
  const stage = intro.querySelector('.web-intro-stage');
  const cursor = intro.querySelector('.web-intro-cursor');
  const dot = intro.querySelector('.web-title-dot');
  const copy = intro.querySelector('.web-intro-copy');
  const rule = intro.querySelector('.web-intro-rule');
  const clamp = value => Math.min(1, Math.max(0, value));
  let frame = 0;
  let active = false;
  let geometry;

  const measure = () => {
    const stageRect = stage.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    // Align the arrow tip with the actual glyph, including responsive font changes.
    const cursorWidth = cursor.getBoundingClientRect().width;
    geometry = {
      width: stage.clientWidth,
      height: stage.clientHeight,
      targetX: dotRect.left - stageRect.left + dotRect.width / 2 - cursorWidth / 12,
      // Ignore the text group's entrance translation when locating the resting glyph.
      targetY: dotRect.bottom - copyRect.top + copy.offsetTop - dotRect.height * .17 - cursorWidth / 16,
    };
    schedule();
  };
  const render = () => {
    frame = 0;
    if (!geometry) return;
    const { width, height, targetX, targetY } = geometry;
    const top = intro.getBoundingClientRect().top;
    const travel = Math.max(1, intro.offsetHeight - height);
    const progress = reducedMotion.matches ? 1 : clamp((innerHeight * .12 - top) / (travel + innerHeight * .12));
    const t = clamp(progress / .72);
    const inverse = 1 - t;
    // A shallow arc that settles precisely on the cyan full stop.
    const x = inverse * inverse * width * .87 + 2 * inverse * t * width * .77 + t * t * targetX;
    const y = inverse * inverse * height * .76 + 2 * inverse * t * height * .38 + t * t * targetY;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    cursor.style.opacity = reducedMotion.matches ? '0' : String(clamp(progress / .12) * (1 - clamp((progress - .72) / .12)) * .9);
    // The line grows from the full stop after the cursor lands.
    rule.style.transform = `scaleX(${reducedMotion.matches ? 1 : clamp((progress - .68) / .27)})`;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  const configure = () => {
    intro.toggleAttribute('data-animated', !reducedMotion.matches);
    measure();
  };
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
});
