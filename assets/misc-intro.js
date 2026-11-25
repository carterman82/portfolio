const intro = document.querySelector('.misc-projects-intro');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (intro) {
  const stage = intro.querySelector('.misc-projects-stage');
  const tools = [...intro.querySelectorAll('.misc-tool')];
  const clamp = value => Math.max(0, Math.min(1, value));
  // Opposing throws overlap, with different heights and releases, like juggling.
  const throws = [
    { start: .03, height: .40, from: .18, to: .76, spin: 210 },
    { start: .10, height: .46, from: .80, to: .26, spin: -165 },
    { start: .19, height: .36, from: .26, to: .84, spin: 135 },
    { start: .25, height: .49, from: .72, to: .18, spin: -230 },
    { start: .30, height: .43, from: .14, to: .68, spin: 185 },
    { start: .36, height: .38, from: .84, to: .34, spin: -150 },
  ];
  let frame = 0;
  let active = false;
  let width = 0;
  let height = 0;
  let travel = 1;

  function render() {
    frame = 0;
    if (reducedMotion.matches) return;
    const progress = clamp(-intro.getBoundingClientRect().top / travel);
    tools.forEach((tool, index) => {
      const flight = throws[index];
      const t = clamp((progress - flight.start) / .54);
      const x = width * (flight.from + (flight.to - flight.from) * t);
      const y = height * (.61 - 4 * flight.height * t * (1 - t));
      tool.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${(t - .5) * flight.spin}deg)`;
      tool.style.opacity = String(clamp(t / .08) * clamp((1 - t) / .12));
    });
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function measure() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    travel = Math.max(1, intro.offsetHeight - height);
    schedule();
  }

  function configure() {
    intro.toggleAttribute('data-animated', !reducedMotion.matches);
    tools.forEach(tool => { tool.style.transform = ''; tool.style.opacity = ''; });
    measure();
  }

  new IntersectionObserver(entries => {
    active = entries[0].isIntersecting;
    if (active) schedule();
  }, { rootMargin: '100px' }).observe(intro);
  addEventListener('scroll', () => { if (active) schedule(); }, { passive: true });
  addEventListener('resize', measure, { passive: true });
  addEventListener('pageshow', measure);
  reducedMotion.addEventListener('change', configure);
  document.fonts.ready.then(measure);
  configure();
}
