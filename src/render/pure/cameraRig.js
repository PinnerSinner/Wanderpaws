// The third-person spring-arm camera, as pure maths (no three, no DOM).
// The renderer feeds it the interpolated player each frame and copies the
// resulting position, look target, fov and roll onto the THREE camera.
//
// Conventions: forward = (sin yaw, 0, cos yaw). The camera yaw is the direction
// the camera faces, so the camera sits behind the focus at -forward(yaw).

import { clamp, springStep, dampAngle, angleDelta, noise1, ease, damp, DEG } from '../../core/math.js';

export const CAM = Object.freeze({
  basePitch: 0.30,        // radians above the horizontal, looking down at the animal
  minPitch: -0.12, maxPitch: 1.15,
  photoMinPitch: -0.35, photoMaxPitch: 1.45,
  baseFov: 52,
  sprintKick: 7,          // degrees at full sprint
  pullFov: 4,
  recentreDelay: 1.6,     // seconds without look input before auto-recentre
  recentreRate: 1.1,
  lookAheadTime: 0.3,     // seconds of velocity
  swayDeg: 0.15,          // handheld sway amplitude (spec: about 0.15 degrees)
  pullRise: 0.8, pullHold: 0.7, pullFall: 1.5, pullAmount: 0.6,
});

// Arm length and focus height for an animal of display size `size` (metres).
// Small animals get a little extra distance so the world still reads around them.
export function armDistance(size) {
  const s = Math.max(0.02, size);
  return 0.45 + s * 4.4 + Math.sqrt(s) * 0.5;
}
export function focusHeight(size) { return Math.max(0.02, size) * 0.55; }

// Pull-back envelope (0..1) at time t seconds after a milestone.
export function pullEnvelope(t) {
  if (t < 0) return 0;
  const { pullRise: r, pullHold: h, pullFall: f } = CAM;
  if (t < r) return ease.outCubic(t / r);
  if (t < r + h) return 1;
  if (t < r + h + f) return 1 - ease.inOutCubic((t - r - h) / f);
  return 0;
}

// March along the arm from focus to camera, return the free fraction (0..1)
// before the terrain gets closer than `margin`.
export function armClearance(heightAt, fx, fy, fz, cx, cy, cz, margin, steps = 8) {
  if (!heightAt) return 1;
  let prev = 0;
  for (let k = 1; k <= steps; k++) {
    const f = k / steps;
    const x = fx + (cx - fx) * f, y = fy + (cy - fy) * f, z = fz + (cz - fz) * f;
    const g = heightAt(x, z) + margin;
    if (y < g) {
      // refine between prev and f with a few bisection steps
      let lo = prev, hi = f;
      for (let j = 0; j < 4; j++) {
        const m = (lo + hi) * 0.5;
        const mx = fx + (cx - fx) * m, my = fy + (cy - fy) * m, mz = fz + (cz - fz) * m;
        if (my < heightAt(mx, mz) + margin) hi = m; else lo = m;
      }
      return Math.max(0.2, lo);
    }
    prev = f;
  }
  return 1;
}

export function createCameraInput() {
  return {
    x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0, size: 1,
    sprinting: false, speedNorm: 0, airborne: false,
    lookDx: 0, lookDy: 0,
    reducedMotion: false, fovKick: true,
    time: 0, heightAt: null, photo: false, zoom: 1, slowMo: 0,
  };
}

export function createCameraRig() {
  const fx = { x: 0, v: 0 }, fy = { x: 0, v: 0 }, fz = { x: 0, v: 0 };
  const distS = { x: 3, v: 0 };
  const fovS = { x: CAM.baseFov, v: 0 };
  const rig = {
    yaw: 0, pitch: CAM.basePitch, idle: 99,
    lookAheadX: 0, lookAheadZ: 0,
    pullT: -1, pull: 0, trauma: 0, collide: 1,
    initialised: false,
    // outputs
    pos: { x: 0, y: 2, z: -3 }, look: { x: 0, y: 0, z: 0 }, fov: CAM.baseFov, roll: 0, dist: 3,

    snap(inp) {
      const h = focusHeight(inp.size);
      fx.x = inp.x; fy.x = inp.y + h; fz.x = inp.z; fx.v = fy.v = fz.v = 0;
      distS.x = armDistance(inp.size); distS.v = 0;
      rig.yaw = inp.yaw; rig.pitch = CAM.basePitch;
      rig.lookAheadX = rig.lookAheadZ = 0;
      rig.collide = 1; rig.trauma = 0; rig.pullT = -1; rig.pull = 0;
      fovS.x = CAM.baseFov; fovS.v = 0;
      rig.initialised = true;
    },

    milestone() { rig.pullT = 0; },
    shake(amount) { rig.trauma = Math.min(1, rig.trauma + amount); },
    addLook(dx, dy) { rig.yaw -= dx; rig.pitch += dy; rig.idle = 0; },

    update(inp, dt) {
      if (!rig.initialised) rig.snap(inp);
      const size = Math.max(0.02, inp.size);
      const reduced = !!inp.reducedMotion;

      // look input
      if (inp.lookDx || inp.lookDy) { rig.addLook(inp.lookDx, inp.lookDy); inp.lookDx = 0; inp.lookDy = 0; }
      else rig.idle += dt;
      const minP = inp.photo ? CAM.photoMinPitch : CAM.minPitch;
      const maxP = inp.photo ? CAM.photoMaxPitch : CAM.maxPitch;
      rig.pitch = clamp(rig.pitch, minP, maxP);

      // auto-recentre behind movement once the player stops steering the camera
      const speed = Math.hypot(inp.vx, inp.vz);
      if (!inp.photo && rig.idle > CAM.recentreDelay && inp.speedNorm > 0.12 && speed > 1e-4) {
        const heading = Math.atan2(inp.vx, inp.vz);
        const d = Math.abs(angleDelta(rig.yaw, heading));
        if (d < 2.3) {
          const k = Math.min(1, (rig.idle - CAM.recentreDelay) / 1.2) * inp.speedNorm;
          rig.yaw = dampAngle(rig.yaw, heading, CAM.recentreRate * k, dt);
        }
        rig.pitch = damp(rig.pitch, CAM.basePitch, 0.8 * k01(rig.idle - CAM.recentreDelay), dt);
      }

      // focus with look-ahead on velocity
      const maxAhead = size * 2.2;
      let ax = inp.photo ? 0 : inp.vx * CAM.lookAheadTime, az = inp.photo ? 0 : inp.vz * CAM.lookAheadTime;
      const al = Math.hypot(ax, az);
      if (al > maxAhead) { ax *= maxAhead / al; az *= maxAhead / al; }
      rig.lookAheadX = damp(rig.lookAheadX, ax, 2.2, dt);
      rig.lookAheadZ = damp(rig.lookAheadZ, az, 2.2, dt);
      const tx = inp.x + rig.lookAheadX, ty = inp.y + focusHeight(size), tz = inp.z + rig.lookAheadZ;
      // teleport guard
      if (Math.hypot(tx - fx.x, tz - fz.x) > size * 25 + 10) rig.snap(inp);
      springStep(fx, tx, 2.4, 1, dt);
      springStep(fz, tz, 2.4, 1, dt);
      springStep(fy, ty, inp.airborne ? 1.1 : 1.8, 1, dt);

      // milestone pull-back (skipped with reduced motion)
      if (rig.pullT >= 0) {
        rig.pullT += dt;
        rig.pull = reduced ? 0 : pullEnvelope(rig.pullT);
        if (rig.pullT > CAM.pullRise + CAM.pullHold + CAM.pullFall) { rig.pullT = -1; rig.pull = 0; }
      }

      // arm
      const targetDist = armDistance(size) * (1 + rig.pull * CAM.pullAmount) * (inp.zoom || 1);
      springStep(distS, targetDist, 1.3, 1, dt);
      const dist = distS.x;
      rig.dist = dist;
      const pitch = rig.pitch + rig.pull * 0.12;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      let cx = fx.x - Math.sin(rig.yaw) * cp * dist;
      let cy = fy.x + sp * dist;
      let cz = fz.x - Math.cos(rig.yaw) * cp * dist;

      // terrain push-in: fast in, slow out
      const margin = size * 0.2 + 0.08;
      const free = armClearance(inp.heightAt, fx.x, fy.x, fz.x, cx, cy, cz, margin);
      rig.collide = free < rig.collide ? damp(rig.collide, free, 14, dt) : damp(rig.collide, free, 2.2, dt);
      cx = fx.x + (cx - fx.x) * rig.collide;
      cy = fy.x + (cy - fy.x) * rig.collide;
      cz = fz.x + (cz - fz.x) * rig.collide;
      if (inp.heightAt) { const g = inp.heightAt(cx, cz) + margin; if (cy < g) cy = g; }

      // fov kick on sprint
      let fovT = CAM.baseFov + rig.pull * CAM.pullFov;
      if (!reduced && inp.fovKick && inp.sprinting) fovT += CAM.sprintKick * clamp(inp.speedNorm, 0, 1);
      springStep(fovS, fovT, 1.4, 1, dt);
      rig.fov = fovS.x;

      // handheld sway (Perlin) and trauma shake, both zeroed by reduced motion
      let sx = 0, sy = 0, roll = 0;
      if (!reduced) {
        const t = inp.time;
        const amp = CAM.swayDeg * DEG * (1 + inp.speedNorm * 0.8) * dist;
        sx = noise1(t * 0.31 + 3.7) * amp;
        sy = noise1(t * 0.27 + 11.1) * amp * 0.7;
        roll = noise1(t * 0.19 + 23.5) * CAM.swayDeg * DEG * 0.6;
        if (rig.trauma > 0) {
          const k = rig.trauma * rig.trauma * size * 0.08;
          sx += noise1(t * 23 + 1.3) * k;
          sy += noise1(t * 27 + 7.9) * k;
          roll += noise1(t * 19 + 4.2) * rig.trauma * rig.trauma * 0.02;
        }
      }
      rig.trauma = Math.max(0, rig.trauma - dt * 1.8);
      if (reduced) rig.trauma = 0;

      rig.pos.x = cx; rig.pos.y = cy; rig.pos.z = cz;
      // sway moves the look target sideways (right = (-cos yaw, 0, sin yaw)) and up
      rig.look.x = fx.x + -Math.cos(rig.yaw) * sx;
      rig.look.y = fy.x + sy;
      rig.look.z = fz.x + Math.sin(rig.yaw) * sx;
      rig.roll = roll;
      return rig;
    },
  };
  return rig;
}

const k01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
