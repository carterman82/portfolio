# Thalass game assets

The OBJ files, MTL files, flashlight cookie, distortion shader/material, and
SampleSceneProfile asset are copies from the supplied Unity project. The OBJ
meshes are loaded unchanged using the locally bundled Three.js OBJLoader; only
their group transforms and browser materials change. The table is rotated to
place its long axis across the viewport. Floating paper uses thin boxes, as in
the game. The existing screenshot remains the no-JavaScript/WebGL fallback.

## Rendering translation

- `Distortion.mat`: strength **0.01**, noise scale **5**, speed **1**. The saved
  intensity is zero because `UnderwaterController` sets it while submerged and
  resets it on disable. The browser uses scroll submersion for this blend.
- `UnderwaterDistortion.shader` is kept as a source reference. At the user's
  request, the browser now uses a simpler, very faint water ripple instead of
  the game's layered noise distortion.
- The supplied `DefaultVolumeProfile.asset` has neutral/default effects. Following
  `SampleScene.unity`'s Underwater Volume (fileID 832575518) resolves its profile
  GUID `10fc4df2da32a41aaa32d77bc913491c` to **SampleSceneProfile.asset**. The browser
  therefore uses that actual underwater profile, rather than inventing a grade.
- Active profile values: exposure -0.3, contrast 13, saturation -30, filter
  (0.8443396, 0.85969305, 1), white balance -20, bloom 0.5/threshold 0.9/scatter 0.7,
  chromatic aberration 0.1, vignette 0.3, grain 0.3/response 0.8, Gaussian depth of
  field start 3/end 20/max radius 1.5. Motion blur and tonemapping are inactive.
- Chromatic aberration is intentionally omitted from the browser rendering at
  the user's request to remove offset edge outlines. The source profile value
  above is retained for reference; water distortion still samples all color
  channels together.
- Browser water movement uses slow sine/cosine ripples, capped at **0.45 render
  pixels per axis**, independent of viewport size. The original layered noise
  distortion is removed. Bloom and depth blur are also omitted to eliminate
  their displaced edge samples. Each output pixel samples the scene once.
- Color adaptation uses LMS white balance. Contrast,
  vignette and grain are lightweight browser equivalents,
  not Unity's exact render passes or grain texture. Their visual result can
  differ from URP even with identical source parameters.
- At the user's request, suit lighting is simplified to two dim blue 70-degree
  spots using the original cookie, with near-identical aim so the soft beams
  overlap. Each uses browser intensity 1.1 and a cool lavender-blue tint, tuned
  against the reference image to reveal the foreground table and beaker while
  keeping distant water black. Lamps follow the camera; mouse movement changes the aim.
  There are no additional ambient/key lights or fabricated tabletop caustics.
- A matte, nearly black floor sits just below the table legs. Very faint emission
  makes it slightly lighter than the black background, with fog fading its depth.
- Suspended particles use a continuously recycled population of **680** motes
  (about 35% fewer than the previous 1,040), with point diameters doubled from
  the original browser version. Opacity samples each actual suit lamp's projected
  cookie, range falloff, distance and submersion fade. Motes fade away outside
  the beams and become more visible in their lit centres, following mouse aim.
- The in-game rapid random startup flicker is replaced with a steady
  scroll-controlled fade. Reduced motion holds the objects and lights still and
  disables animated distortion/grain.

Game settings and asset loading live in `../thalass-game.js`; scroll lifecycle
and composition live in `../thalass-scene.js`. This folder is self-contained:
the website does not fetch from the external Unity project at runtime.

## Rigidbody drift

`Drifting.cs` is preserved here as the source reference. Its force and torque
noise coordinates and offsets are ported in `../thalass-drifting.js`, with the
script's driftForce 0.01, spinTorque 0.0001, noiseSpeed 0.25, disabled gravity,
linear damping 1.5 and angular damping 1.0. The beaker uses the scene's 0.1 kg
mass; paper uses 0.05 kg. The table has no Drifting component in the source scene
and stays fixed. Papers and the beaker are independent bodies, rather than
children inheriting a bobbing table's animation.

For the more noticeable motion requested for the portfolio, presentation
overrides apply driftForce **0.04** (4×), spinTorque **0.003** (30×), and
noiseSpeed **0.35** (1.4×). This preserves the force-driven movement and damping
while making translation and tumbling visible within a few seconds. The heavier
beaker uses spinTorque **0.012** so its rotation also reads clearly. This halves
translation forces and doubles torque compared with the previous presentation.
Papers render without writing depth; the flask renders afterward with depth
testing enabled, keeping it in front of papers while preserving its own surfaces
and its depth relationship with the floor and table.

A fixed 0.02-second force/torque integrator and interpolated position/quaternion
rendering keep motion consistent across frame rates. Simulating pauses when the
scene is hidden, scrolled out of view, or above the reveal. Reduced motion resets
to the initial pose. There is no spring, artificial orbit or sinusoidal bobbing.

This is a small browser translation of the script, not Unity PhysX: Perlin noise
uses Three's ImprovedNoise and stable per-body seeds instead of Unity's random
seeds, and inertia uses a bounding box approximation. Collider contacts and
collision response are not implemented. The independent props begin separated;
this reproduces their free drift, not an interactive collision simulation.
