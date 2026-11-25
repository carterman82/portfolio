import * as THREE from './vendor/three.module.js';
import { OBJLoader } from './vendor/OBJLoader.js';
import { DriftingSimulation } from './thalass-drifting.js';

// Imported from Distortion.mat and SampleSceneProfile.asset. The latter is the
// profile referenced by SampleScene.unity's Underwater Volume; DefaultVolumeProfile
// contains neutral defaults. Keep game settings separate from browser lighting units.
export const gameSettings = {
  distortion: { strength: .01, scale: 5, speed: 1 },
  volume: {
    exposure: -.3, contrast: 13, saturation: -30,
    filter: [ .8443396, .85969305, 1 ], temperature: -20,
    bloom: { intensity: .5, threshold: .9, scatter: .7 },
    chromaticAberration: .1, vignette: .3, vignetteSmoothness: .2,
    grain: .3, grainResponse: .8,
    depthOfField: { start: 3, end: 20, radius: 1.5 }
  },
  suit: { blueIntensity: .4, whiteIntensity: .1, range: 5, blueAngle: 70, whiteAngle: 25 },
  // Stronger presentation drift requested for the portfolio; script defaults
  // and masses remain preserved in the simulation and source reference.
  presentationDrift: { driftForce: .04, spinTorque: .003, noiseSpeed: .35 }
};

export async function createUnderwaterScene(renderer) {
  const loader = new OBJLoader();
  const [tableModel, flaskModel, cookie] = await Promise.all([
    loader.loadAsync('assets/thalass/Table_Large_Rectangular_01.obj'),
    loader.loadAsync('assets/thalass/Beaker_01.obj'),
    new THREE.TextureLoader().loadAsync('assets/thalass/flashlight-cookie.png')
  ]);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, .038);
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 60);
  scene.add(camera);
  const world = new THREE.Group(); scene.add(world);
  // No ambient, studio key, rim light, or invented caustic texture: the suit
  // lamps are the only source of illumination in the otherwise black water.
  const material = color => new THREE.MeshPhongMaterial({
    color, shininess: 12, specular: 0x111111, flatShading: true
  });
  const table = new THREE.Group();
  table.name = 'Thalass floating objects';
  world.add(table);

  // Preserve the actual mesh topology. Rotate the table's long Z axis across
  // the viewport, and move its tabletop to Y=0 without rebuilding any parts.
  tableModel.rotation.y = Math.PI / 2;
  tableModel.scale.setScalar(4.7 / 19.799353);
  tableModel.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(tableModel);
  const center = bounds.getCenter(new THREE.Vector3());
  tableModel.position.set(-center.x, -bounds.max.y, -center.z);
  tableModel.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.material = material(0x795548); // original MTL diffuse color
    mesh.castShadow = mesh.receiveShadow = true;
  });
  table.add(tableModel); table.rotation.y = -.33;

  // A nearly black floor anchors the table without lighting the water itself.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshPhongMaterial({
    color: 0x242936, specular: 0x000000, shininess: 0,
    emissive: 0x10141c, emissiveIntensity: .2
  }));
  floor.name = 'Dim underwater floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -bounds.getSize(new THREE.Vector3()).y - .035;
  floor.receiveShadow = true;
  world.add(floor);

  const papers = [];
  const paperMaterial = material(0xd9d9d9);
  // Paper is drawn over the environment but leaves its depth buffer intact,
  // allowing the flask's later pass to stay in front at every overlap.
  paperMaterial.depthWrite = false;
  [[-.8, 1.25, .2, -.7, .2, -.3], [.5, 2.35, -.8, -.25, .3, .55],
    [1.8, 1.1, -.4, -1.1, -.4, .3], [-1.6, .45, -.5, -1.4, .1, -.2]].forEach(p => {
    // The game's paper props are thin scaled cubes, with no invented text.
    const paper = new THREE.Mesh(new THREE.BoxGeometry(.63, .88, .008), paperMaterial);
    paper.position.set(...p.slice(0, 3)); paper.rotation.set(...p.slice(3));
    paper.renderOrder = 1;
    paper.castShadow = paper.receiveShadow = true;
    papers.push(paper); table.add(paper);
  });

  const flask = new THREE.Group();
  flaskModel.scale.setScalar(1.08 / 19.19153);
  flaskModel.updateMatrixWorld(true);
  const flaskBounds = new THREE.Box3().setFromObject(flaskModel);
  const flaskCenter = flaskBounds.getCenter(new THREE.Vector3());
  flaskModel.position.set(-flaskCenter.x, -flaskBounds.min.y, -flaskCenter.z);
  const palette = { FFFFFF: 0xffffff, '1A1A1A': 0x1a1a1a, '00BCD4': 0x00bcd4 };
  flaskModel.traverse(mesh => {
    if (!mesh.isMesh) return;
    const convert = original => material(palette[original.name] ?? 0xffffff);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    mesh.renderOrder = 2;
    mesh.castShadow = mesh.receiveShadow = true;
  });
  flaskModel.renderOrder = 2;
  flask.add(flaskModel);
  flask.position.set(-1, .85, .65); flask.rotation.set(.25, .2, -1.05);
  table.add(flask);

  const drifting = new DriftingSimulation();
  // Detach while preserving the initial composition. Each Rigidbody drifts
  // independently; the table has no Drifting component in SampleScene.unity.
  for (const [i, paper] of papers.entries()) {
    world.attach(paper);
    drifting.add(paper, { ...gameSettings.presentationDrift, mass: .05,
      dimensions: [.63, .88, .008], seed: 19.173 + i * 17.231 });
  }
  world.attach(flask);
  drifting.add(flask, { ...gameSettings.presentationDrift, spinTorque: .012, mass: .1,
    dimensions: [.563, 1.08, .563], seed: 82.719 });

  const lightRig = new THREE.Group(); camera.add(lightRig);
  const suitLights = [];
  for (const side of [-1, 1]) {
      // Overlapping cool suit lamps: enough foreground fill to reveal the
      // beaker facets and table rim, while the reference's depths stay black.
      const light = new THREE.SpotLight(
        0xa0afff, 1.1,
        18, THREE.MathUtils.degToRad(35), 1, 0
      );
      light.position.set(side * .22, -.55, -.25);
      light.target.position.set(side * .06, -.85, -8);
      light.map = cookie;
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -.001;
      light.shadow.normalBias = .025;
      light.shadow.camera.near = .1;
      light.userData.baseIntensity = light.intensity;
      lightRig.add(light, light.target); suitLights.push(light);
  }

  // About 35% fewer motes than the previous 1,040-particle field.
  const count = 680;
  const positions = new Float32Array(count * 3);
  let seed = 37;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < count; i++) positions.set([(random() - .5) * 19, (random() - .5) * 12, (random() - .5) * 14], i * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(geometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 }, pixelRatio: { value: renderer.getPixelRatio() },
      lampCookie: { value: cookie }, lampMatrices: { value: suitLights.map(light => light.shadow.matrix) },
      lampPositions: { value: suitLights.map(() => new THREE.Vector3()) },
      lampPower: { value: new THREE.Vector2() }
    },
    vertexShader: `uniform float time; uniform float pixelRatio;
      uniform mat4 lampMatrices[2]; uniform vec3 lampPositions[2];
      varying vec4 lampUvA; varying vec4 lampUvB; varying vec2 lampDistance;
      void main(){vec3 p=position;p.y=mod(p.y+6.+time*.045,12.)-6.;p.x+=sin(time*.23+p.y)*.06;
      vec4 world=modelMatrix*vec4(p,1.);
      lampUvA=lampMatrices[0]*world;lampUvB=lampMatrices[1]*world;
      lampDistance=vec2(distance(world.xyz,lampPositions[0]),distance(world.xyz,lampPositions[1]));
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(52./-mv.z,2.,12.)*pixelRatio;}`,
    fragmentShader: `uniform sampler2D lampCookie; uniform vec2 lampPower;
      varying vec4 lampUvA; varying vec4 lampUvB; varying vec2 lampDistance;
      float illumination(vec4 projected,float distanceToLight){
        if(projected.w<=0.)return 0.;
        vec3 uv=projected.xyz/projected.w;
        if(any(lessThan(uv,vec3(0.)))||any(greaterThan(uv,vec3(1.))))return 0.;
        float reach=clamp(1.-pow(distanceToLight/18.,4.),0.,1.);
        return texture2D(lampCookie,uv.xy).r*reach*reach*exp(-distanceToLight*.045);
      }
      void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;
      float alpha=clamp((illumination(lampUvA,lampDistance.x)*lampPower.x
        +illumination(lampUvB,lampDistance.y)*lampPower.y)*.55,0.,.7);
      gl_FragColor=vec4(.25,.34,.65,alpha*(1.-smoothstep(.12,.5,d)));}`
  }));
  scene.add(particles);
  return { scene, camera, world, table, papers, flask, particles, lightRig, suitLights, drifting };
}

function whiteBalance(temperature) {
  const t = temperature / 65;
  const x = .31271 - t * (t < 0 ? .1 : .05);
  const y = 2.87 * x - 3 * x * x - .27509507;
  const X = x / y, Z = (1 - x - y) / y;
  return new THREE.Vector3(
    .949237 / (.7328 * X + .4296 - .1624 * Z),
    1.03542 / (-.7036 * X + 1.6975 + .0061 * Z),
    1.08728 / (.003 * X + .0136 + .9834 * Z)
  );
}

export function createWaterPass(target, camera) {
  const v = gameSettings.volume;
  const uniforms = {
    image: { value: target.texture }, depthImage: { value: target.depthTexture },
    time: { value: 0 }, progress: { value: 0 }, aspect: { value: 1 }, reduce: { value: 0 },
    texel: { value: new THREE.Vector2(1, 1) },
    nearFar: { value: new THREE.Vector2(camera.near, camera.far) },
    balance: { value: whiteBalance(v.temperature) },
    colorFilter: { value: new THREE.Color(...v.filter).convertSRGBToLinear() },
    exposure: { value: Math.pow(2, v.exposure) }, contrast: { value: 1 + v.contrast / 100 },
    saturation: { value: 1 + v.saturation / 100 },
    vignette: { value: v.vignette },
    grain: { value: v.grain }, grainResponse: { value: v.grainResponse }
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      uniform sampler2D image; uniform sampler2D depthImage;
      uniform float time; uniform float progress; uniform float aspect; uniform float reduce;
      uniform vec2 texel; uniform vec2 nearFar;
      uniform vec3 balance; uniform vec3 colorFilter; uniform float exposure; uniform float contrast;
      uniform float saturation;
      uniform float vignette; uniform float grain; uniform float grainResponse;
      varying vec2 vUv;
      #include <packing>
      // Hash is retained only for film grain, not for water displacement.
      float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      vec3 sampleScene(vec2 uv){return texture2D(image,clamp(uv,vec2(.001),vec2(.999))).rgb;}
      vec3 grade(vec3 color){
        color*=exposure;
        mat3 toLMS=mat3(.390405,.0708416,.0231082,.549941,.963172,.128021,.00892632,.00135775,.936245);
        mat3 fromLMS=mat3(2.85847,-.210182,-.041812,-1.62879,1.1582,-.118169,-.024891,.000324281,1.06867);
        color=fromLMS*(toLMS*color*balance);
        color=exp2((log2(max(color,vec3(.00001)))-log2(.18))*contrast+log2(.18));
        color*=colorFilter;
        float luminance=dot(color,vec3(.2126,.7152,.0722));
        return max(vec3(0.),mix(vec3(luminance),color,saturation));
      }
      void main(){
        vec2 uv=vUv; float t=time*(1.-reduce);
        float level=mix(-.08,1.16,smoothstep(0.,.46,progress));
        float wave=(sin(uv.x*11.+t*.6)*.009+sin(uv.x*26.-t*.9)*.003)*(1.-reduce);
        float d=uv.y-level-wave;
        float submerged=1.-smoothstep(-.003,.003,d);
        // A broad, slow ripple, capped below half a render pixel per axis.
        // Pixel-relative strength stays gentle on large screens as well.
        vec2 ripple=vec2(sin(uv.y*8.+t*.25),cos(uv.x*6.-t*.2));
        vec2 sampleUv=uv+ripple*texel*.45*submerged*(1.-reduce);
        // Sample once for all channels. Displaced blur/glow taps can leave
        // parallel edge silhouettes while the water moves.
        vec3 color=grade(sampleScene(sampleUv));
        vec2 v=abs(uv-.5)*vignette*2.;
        float vig=pow(clamp(1.-dot(v,v),0.,1.),3.);
        color*=vig;
        // Grain is multiplicative, so the unlit depths stay truly black.
        float noise=hash21(floor(gl_FragCoord.xy/1.4)+floor(t*24.))-.5;
        color*=1.+noise*grain*(1.-clamp(dot(color,vec3(.2126,.7152,.0722)),0.,1.)*grainResponse);
        color*=smoothstep(.32,.64,progress)*submerged;
        float edge=exp(-abs(d)*400.);float reflection=exp(-abs(d+.018)*65.);
        color+=vec3(.09,.20,.30)*edge+vec3(.009,.035,.06)*reflection;
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  });
}
