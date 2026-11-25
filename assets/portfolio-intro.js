const intro = document.querySelector('#portfolio-intro');
const beats = intro?.querySelectorAll('.intro-beat');
const sequence = document.querySelector('#drats-scroll-anim');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const chapterMarks = intro?.querySelectorAll('.intro-chapters i');
const gamesUnderline = intro?.querySelector('.intro-games-underline');

if (intro && beats.length) {
  let frame = 0;
  const clamp = value => Math.min(1, Math.max(0, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  let spacing = innerHeight * .6;
  const measure = () => {
    const tallest = Math.max(...Array.from(beats, beat => beat.offsetHeight));
    spacing = Math.max(intro.offsetHeight * .55, tallest + 64);
    schedule();
  };

  const update = () => {
    frame = 0;
    const rect = sequence.getBoundingClientRect();
    const travel = Math.max(1, sequence.offsetHeight - intro.offsetHeight);
    const progress = clamp(-rect.top / travel);
    const introEnd = reducedMotion.matches ? .8 : .64;
    const chapter = progress / (introEnd / beats.length);
    // Keep adjacent messages vertically separated while both are visible.
    beats.forEach((beat, index) => {
      const local = chapter - index;
      // Both sides of each handoff share exactly the same fade interval.
      const enter = index === 0 ? 1 : smooth((local + .6) / .7);
      const exit = index === beats.length - 1 ? 0 : smooth((local - .4) / .7);
      const opacity = enter * (1 - exit);
      beat.style.opacity = String(opacity);
      beat.style.visibility = opacity > 0 ? 'visible' : 'hidden';
      const offset = (index - Math.min(chapter, beats.length - 1)) * spacing;
      const side = index === beats.length - 1 || reducedMotion.matches ? 0 : (index % 2 === 0 ? -1 : 1) * 24 * (1 - enter);
      // Scrolling carries the whole message; the final introduction settles centrally.
      beat.style.transform = `translate(${side}px, calc(-50% + ${offset}px))`;
      chapterMarks[index].style.transform = `scaleX(${clamp(chapter - index + .5)})`;
    });
    gamesUnderline.style.transform = `scaleX(${reducedMotion.matches ? 1 : smooth((chapter - 2.8) / .4)})`;
    const exit = smooth((chapter - 3.65) / .35);

    intro.style.opacity = String(1 - exit);
    intro.style.visibility = exit === 1 ? 'hidden' : 'visible';
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  addEventListener('scroll', schedule, {passive: true});
  addEventListener('resize', measure, {passive: true});
  reducedMotion.addEventListener('change', schedule);
  document.fonts.ready.then(measure);
  measure();
}
