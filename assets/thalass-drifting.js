import * as THREE from './vendor/three.module.js';
import { ImprovedNoise } from './vendor/ImprovedNoise.js';

const noise = new ImprovedNoise();
const perlin = (x, y) => noise.noise(x, y, 0) * .5 + .5;
const FIXED_STEP = .02; // Unity's default 50 Hz FixedUpdate.

// Port of Drifting.cs's force/torque law, with a small rigid-body integrator.
// No surface buoyancy is needed: Awake disables gravity and sets water damping.
// Meshes have independent position, linear velocity, orientation and angular
// velocity; rendered frames interpolate fixed simulation states.
export class DriftingSimulation {
  constructor() {
    this.bodies = [];
    this.time = 0;
    this.accumulator = 0;
    this.force = new THREE.Vector3();
    this.torque = new THREE.Vector3();
    this.localTorque = new THREE.Vector3();
    this.inverseRotation = new THREE.Quaternion();
    this.rotationStep = new THREE.Quaternion();
    this.axis = new THREE.Vector3();
  }

  add(mesh, { mass, dimensions, seed, driftForce = .01, spinTorque = .0001, noiseSpeed = .25 }) {
    const [x, y, z] = dimensions;
    // Box inertia approximation. The beaker uses its bounding box; paper is a
    // thin box just as in the game. Forces use mass; torques use body inertia.
    const inertia = new THREE.Vector3(
      mass * (y * y + z * z) / 12,
      mass * (x * x + z * z) / 12,
      mass * (x * x + y * y) / 12
    );
    const body = {
      mesh, mass, inertia, seed, driftForce, spinTorque, noiseSpeed,
      position: mesh.position.clone(), previousPosition: mesh.position.clone(),
      rotation: mesh.quaternion.clone(), previousRotation: mesh.quaternion.clone(),
      initialPosition: mesh.position.clone(), initialRotation: mesh.quaternion.clone(),
      velocity: new THREE.Vector3(), angularVelocity: new THREE.Vector3()
    };
    this.bodies.push(body);
    return body;
  }

  step() {
    this.time += FIXED_STEP;
    for (const body of this.bodies) {
      body.previousPosition.copy(body.position);
      body.previousRotation.copy(body.rotation);
      const t = this.time * body.noiseSpeed + body.seed;
      this.force.set(perlin(t, 0) - .5, perlin(0, t) - .5, perlin(t, t + 50) - .5);
      this.torque.set(perlin(t + 10, 0) - .5, perlin(0, t + 20) - .5, perlin(t + 30, t) - .5);
      body.velocity.addScaledVector(this.force, body.driftForce * FIXED_STEP / body.mass);
      body.velocity.multiplyScalar(Math.max(0, 1 - 1.5 * FIXED_STEP));
      body.position.addScaledVector(body.velocity, FIXED_STEP);

      // AddTorque is a world-space torque. Apply the inverse inertia tensor in
      // local space, then rotate acceleration back into the world frame.
      this.inverseRotation.copy(body.rotation).invert();
      this.localTorque.copy(this.torque).multiplyScalar(body.spinTorque)
        .applyQuaternion(this.inverseRotation).divide(body.inertia)
        .applyQuaternion(body.rotation);
      body.angularVelocity.addScaledVector(this.localTorque, FIXED_STEP);
      body.angularVelocity.multiplyScalar(Math.max(0, 1 - FIXED_STEP));
      const speed = body.angularVelocity.length();
      if (speed > 1e-10) {
        this.axis.copy(body.angularVelocity).divideScalar(speed);
        this.rotationStep.setFromAxisAngle(this.axis, speed * FIXED_STEP);
        body.rotation.premultiply(this.rotationStep).normalize();
      }
    }
  }

  update(delta) {
    // Limit resume spikes; paused/background time is never caught up in a burst.
    this.accumulator += Math.min(Math.max(delta, 0), .1);
    while (this.accumulator + 1e-10 >= FIXED_STEP) {
      this.step();
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
    }
    const alpha = this.accumulator / FIXED_STEP;
    for (const body of this.bodies) {
      body.mesh.position.lerpVectors(body.previousPosition, body.position, alpha);
      body.mesh.quaternion.slerpQuaternions(body.previousRotation, body.rotation, alpha);
    }
  }

  reset() {
    this.time = 0; this.accumulator = 0;
    for (const body of this.bodies) {
      body.position.copy(body.initialPosition); body.previousPosition.copy(body.initialPosition);
      body.rotation.copy(body.initialRotation); body.previousRotation.copy(body.initialRotation);
      body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0);
      body.mesh.position.copy(body.initialPosition); body.mesh.quaternion.copy(body.initialRotation);
    }
  }
}
