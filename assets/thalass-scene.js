import * as THREE from './vendor/three.module.js';
import { createUnderwaterScene, createWaterPass } from './thalass-game.js';

const section = document.querySelector('#thalass');
const stage = section.querySelector('.thalass-stage');
const canvas = section.querySelector('canvas');
const copy = section.querySelector('.thalass-copy');
const descent = section.querySelector('.thalass-descent');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const smooth = THREE.MathUtils.smoothstep;

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const objects = await createUnderwaterScene(renderer);
  const { scene, camera, world, particles, lightRig, suitLights, drifting } = objects;
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const water = createWaterPass(target, camera);
  const uniforms = water.uniforms;
  uniforms.reduce.value = motion.matches ? 1 : 0;
  const post = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), water));
  let visible = false;
  let frame = 0;
  let progress = 0;
  let width = 0, height = 0;
  let lastTime = 0, elapsed = 0;
  const pointer = new THREE.Vector2();
  const aim = new THREE.Vector2();
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const rect = stage.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width - .5) * .16,
      -((event.clientY - rect.top) / rect.height - .5) * .1);
  }, { passive: true });
  stage.addEventListener('pointerleave', () => pointer.set(0, 0));
  function resize() {
    width = stage.clientWidth; height = stage.clientHeight;
    renderer.setSize(width, height, false);
    target.setSize(Math.round(width * renderer.getPixelRatio()), Math.round(height * renderer.getPixelRatio()));
    uniforms.texel.value.set(1 / target.width, 1 / target.height);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    uniforms.aspect.value = camera.aspect;
    const mobile = width < 640;
    camera.position.set(0, mobile ? 3.4 : 3, mobile ? 11.8 : 9);
    camera.lookAt(0, .3, 0);
    world.position.set(mobile ? 0 : 1.3, mobile ? -.85 : -.5, 0);
    world.scale.setScalar(mobile ? .78 : 1);
    draw(performance.now());
  }
  function draw(now) {
    const delta = lastTime && visible && !document.hidden && !motion.matches
      ? Math.min((now - lastTime) / 1000, .1) : 0;
    elapsed += delta;
    lastTime = now;
    const rect = section.getBoundingClientRect();
    progress = motion.matches ? 1 : THREE.MathUtils.clamp(-rect.top / (section.offsetHeight - height), 0, 1);
    uniforms.progress.value = progress;
    uniforms.time.value = elapsed;
    const reveal = motion.matches ? 1 : smooth(progress, .48, .72);
    copy.style.opacity = reveal;
    copy.style.transform = `translateY(${motion.matches ? 0 : (1 - reveal) * 22}px)`;
    copy.inert = reveal < .5;
    descent.style.opacity = motion.matches ? 0 : (1 - smooth(progress, .25, .43));
    const t = motion.matches ? 0 : elapsed;
    if (!motion.matches && progress > .32) drifting.update(delta);
    // Camera-mounted lamps peer into the darkness, never orbit around the props.
    // Soft steady illumination avoids repeatedly flashing the visitor's screen.
    aim.lerp(motion.matches ? new THREE.Vector2() : pointer, .045);
    lightRig.rotation.set(aim.y, -aim.x, 0);
    const lampBlend = motion.matches ? 1 : smooth(progress, .35, .55);
    suitLights.forEach(light => { light.intensity = light.userData.baseIntensity * lampBlend; });
    // Share the actual spot projections/cookie with the motes, so opacity
    // follows both suit lamps rather than a separate screen-centred gradient.
    scene.updateMatrixWorld(true);
    suitLights.forEach((light, i) => {
      light.shadow.updateMatrices(light);
      particles.material.uniforms.lampPositions.value[i].setFromMatrixPosition(light.matrixWorld);
    });
    particles.material.uniforms.lampPower.value.set(lampBlend, lampBlend);
    particles.material.uniforms.time.value = t;
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(post, postCamera);
    section.dataset.progress = progress.toFixed(3);
  }
  // Offscreen and background tabs use no animation frames. Scroll is never captured.
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || rendererGone) return;
    draw(now);
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }
  let rendererGone = false;
  function wake() {
    if (visible && !frame && !document.hidden && !rendererGone) frame = requestAnimationFrame(tick);
  }
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    lastTime = 0;
    if (visible) wake(); else { cancelAnimationFrame(frame); frame = 0; }
  }).observe(section);
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    lastTime = 0;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake();
  });
  motion.addEventListener('change', () => {
    uniforms.reduce.value = motion.matches ? 1 : 0;
    lastTime = 0;
    if (motion.matches) drifting.reset();
    resize(); wake();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); rendererGone = true; cancelAnimationFrame(frame);
    section.dataset.state = 'fallback'; copy.inert = false;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    rendererGone = false; section.dataset.state = 'ready'; resize(); wake();
  });
  section.dataset.state = 'ready';
  section.dataset.models = 'game-originals'; resize();
}

// Do not allocate a second WebGL context until the visitor approaches Thalass.
const loader = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  loader.disconnect();
  start().catch(error => {
    section.dataset.state = 'fallback'; copy.inert = false;
    console.warn('Thalass uses its still-image fallback:', error);
  });
}, { rootMargin: '100% 0px' });
loader.observe(section);
