import * as THREE from './vendor/three.module.js';

const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const phase = (p, start, end) => THREE.MathUtils.smoothstep(p, start, end);

// Cover-inspired hues, brightened into a saturated four-band cartoon palette.
// Yellow shifts toward orange in shadow instead of becoming dark brown.
const players = [
  {name: 'blue', color: 0x6287ed, shadow: 0x3659b8, deep: 0x263e83, highlight: 0xa1bcff, x: -2.2, y: -1.15, z: 0, size: 5.2, tilt: .4, enter: [.025, .385], launch: {x: -3.6, lift: 6.5, bend: -.45, spin: [-.6, -1.7, 1.1]}},
  {name: 'red', color: 0xf34848, shadow: 0xc52648, deep: 0x841f43, highlight: 0xff9290, x: 2.2, y: -.91, z: .8, size: 5.2, tilt: -.4, enter: [.035, .4], launch: {x: 3.4, lift: 7.1, bend: .55, spin: [1.3, 1.1, -1.8]}},
  {name: 'yellow', color: 0xffdf42, shadow: 0xf6ac26, deep: 0xdf741f, highlight: 0xfff19a, x: -4.75, y: -.65, z: -3.5, size: 5.2, tilt: -.48, enter: [.02, .39], launch: {x: -6.8, lift: 7.5, bend: .8, spin: [.9, 2.5, -1.3]}},
  {name: 'green', color: 0x50c77c, shadow: 0x238d62, deep: 0x16604c, highlight: 0x98e7ad, x: 5.1, y: -1.35, z: -3.8, size: 5.2, tilt: .48, enter: [.04, .405], launch: {x: 7.2, lift: 6.8, bend: -.7, spin: [-1.2, -2.1, 1.7]}}
];

function cartoonMaterial(player) {
  return new THREE.ShaderMaterial({
    name: `Drats! Unity toon — ${player.name}`,
    uniforms: {
      baseColor: {value: new THREE.Color(player.color)},
      shadowColor: {value: new THREE.Color(player.shadow)},
      highlightColor: {value: new THREE.Color(player.highlight)},
      lightDirection: {value: new THREE.Vector3(-6, 7, 5).normalize()},
      shadeStep: {value: .3},
      deepShadow: {value: new THREE.Color(player.deep)}
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // Keep the game's quantized lighting with individually tuned color bands.
    // Darkest shadows retain each pawn's hue instead of turning neutral gray.
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 shadowColor;
      uniform vec3 highlightColor;
      uniform vec3 lightDirection;
      uniform float shadeStep;
      uniform vec3 deepShadow;
      varying vec3 vNormal;
      void main() {
        vec3 light = normalize(mat3(viewMatrix) * lightDirection);
        float diffuse = max(dot(normalize(vNormal), light), 0.0);
        float band = floor(diffuse / shadeStep);
        vec3 color = deepShadow;
        if (band >= 1.0) color = shadowColor;
        if (band >= 2.0) color = baseColor;
        if (band >= 3.0) color = highlightColor;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
}

class DratsAnimation {
  constructor() {
    this.section = document.querySelector('#drats-scroll-anim');
    this.poster = this.section.querySelector('.drats-poster');
    this.canvas = document.querySelector('#dratsCanvas');
    this.tagline = this.section.querySelector('.drats-tagline');
    this.bar = this.section.querySelector('.drats-progress span');
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.currentProgress = 0;
    this.pendingFrame = 0;
    this.ready = false;
    // Scroll is the clock; schedule one render only when something changes.
    this.schedule = () => {
      if (!this.pendingFrame) this.pendingFrame = requestAnimationFrame(() => {
        this.pendingFrame = 0;
        this.update();
      });
    };
    this.init().catch(error => {
      this.section.dataset.state = 'fallback';
      console.warn('Drats! cover fallback:', error);
    });
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer({canvas: this.canvas, alpha: true, antialias: true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0xffffff, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 100);
    this.camera.position.set(0, 0, 20);
    const [geometry, texture] = await Promise.all([
      new THREE.BufferGeometryLoader().loadAsync('assets/drats/pawn.json'),
      new THREE.TextureLoader().loadAsync('assets/drats/logo.png')
    ]);
    this.pieces = players.map(player => {
      const group = new THREE.Group();
      group.name = player.name;
      const mesh = new THREE.Mesh(geometry, cartoonMaterial(player));
      // Expanded back-face shells reproduce the game's bold sticker edges.
      const white = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.BackSide}));
      white.scale.setScalar(1.028);
      const black = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color: 0x111111, side: THREE.BackSide}));
      black.scale.setScalar(1.055);
      group.add(black, white, mesh);
      this.scene.add(group);
      return group;
    });
    // Crop transparent padding while preserving every pixel of the supplied logo.
    const source = texture.image;
    const buffer = document.createElement('canvas');
    buffer.width = source.width; buffer.height = source.height;
    const ctx = buffer.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, buffer.width, buffer.height).data;
    let left = buffer.width, top = buffer.height, right = 0, bottom = 0;
    for (let y = 0; y < buffer.height; y++) for (let x = 0; x < buffer.width; x++) {
      if (data[(y * buffer.width + x) * 4 + 3] > 16) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    const cropped = document.createElement('canvas');
    cropped.width = right - left + 1; cropped.height = bottom - top + 1;
    cropped.getContext('2d').drawImage(source, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    const logoTexture = new THREE.CanvasTexture(cropped);
    logoTexture.colorSpace = THREE.SRGBColorSpace;
    this.logo = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5 * cropped.height / cropped.width),
      new THREE.MeshBasicMaterial({map: logoTexture, transparent: true, depthWrite: false}));
    this.logo.renderOrder = 5;
    this.scene.add(this.logo);
    texture.dispose();
    this.ready = true;
    this.section.dataset.state = 'ready';
    this.resize = () => {
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      // Preserve the approved cover scale/position while rendering to the whole
      // viewport, so flying pawns aren't clipped at the inner poster's edges.
      const poster = this.poster.getBoundingClientRect();
      const canvas = this.canvas.getBoundingClientRect();
      const units = 10 / Math.max(1, poster.height);
      const centerX = (canvas.left + width / 2 - poster.left - poster.width / 2) * units;
      const centerY = (poster.top + poster.height / 2 - canvas.top - height / 2) * units;
      this.camera.left = centerX - width * units / 2;
      this.camera.right = centerX + width * units / 2;
      this.camera.top = centerY + height * units / 2;
      this.camera.bottom = centerY - height * units / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
      this.schedule();
    };
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.poster);
    window.addEventListener('scroll', this.schedule, {passive: true});
    window.addEventListener('resize', this.resize, {passive: true});
    this.motion.addEventListener('change', this.schedule);
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.section.dataset.state = 'fallback';
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.section.dataset.state = 'ready';
      this.schedule();
    });
    this.schedule();
  }

  update() {
    if (!this.ready) return;
    const rect = this.section.getBoundingClientRect();
    const stage = this.section.querySelector('.drats-stage');
    const scrollProgress = clamp(-rect.top / Math.max(1, rect.height - stage.clientHeight), 0, 1);
    // Reserve the opening beat for the title crossfade, then play the cover sequence.
    const p = this.motion.matches ? 1 : clamp((scrollProgress - .64) / .36, 0, 1);
    this.currentProgress = p;
    this.phase = this.motion.matches || p >= .405 ? 'completed' : p < .23 ? 'arrival' : 'title';
    // The title descends as the pawns fall from their apex, overlapping their landing.
    // Hold the finished cover pose as the section scrolls away.
    // Reduced motion holds the assembled four-player pose, skipping the travel.
    const sceneProgress = this.motion.matches ? .75 : p;
    const title = phase(sceneProgress, .23, .405);
    const launchY = Math.min(-12, this.camera.bottom - 6);
    this.pieces.forEach((piece, i) => {
      const player = players[i];
      const sign = Math.sign(player.x);
      const t = phase(sceneProgress, ...player.enter);
      const arc = 4 * t * (1 - t);
      const launch = player.launch;
      piece.position.set(
        mix(launch.x, player.x, t) + launch.bend * arc,
        mix(launchY, player.y, t) + launch.lift * arc,
        player.z
      );
      piece.rotation.set(
        mix(launch.spin[0], .95, t),
        mix(launch.spin[1], sign * .1, t),
        mix(launch.spin[2], player.tilt, t)
      );
      piece.scale.setScalar(player.size);
    });
    this.logo.position.set(0, mix(6.8, 2.17, title), 5);
    this.logo.rotation.z = mix(-.48, 0, title);
    this.logo.rotation.y = mix(-.28, 0, title);
    this.logo.scale.setScalar(mix(.94, 1, title));
    this.logo.material.opacity = phase(sceneProgress, .23, .27);
    this.tagline.style.opacity = String(phase(sceneProgress, .35, .405));
    this.tagline.style.transform = `translateY(${mix(8, 0, phase(sceneProgress, .35, .405))}px) rotate(-5deg)`;
    this.bar.style.transform = `scaleX(${p})`;
    this.renderer.render(this.scene, this.camera);
  }
}

window.dratsAnimation = new DratsAnimation();




