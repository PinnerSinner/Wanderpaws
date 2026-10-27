// The pose: one preallocated transform per skeleton bone, plain numbers only.
// px,py,pz are offsets from the rest position (parent frame), rx,ry,rz are
// added to the bone's rest rotation (Euler, the bone's own order), sx,sy,sz
// scale. pose.fx carries non-bone values for the view (glow, LEDs, colour
// shift, droplet burst intensity and so on).

import { mat3FromEuler, mat3Apply, mat3ApplyT } from './math3.js';

export function createPose(skel) {
  const list = skel.bones.map(() => ({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }));
  const bones = {};
  skel.bones.forEach((b, i) => { bones[b.name] = list[i]; });
  return {
    list, bones,
    fx: { glow: 0, led: 0, ledRate: 1, colour: 0, shake: 0, aura: 0, tongue: 0, blink: 0, eyeScale: 1, puff: 0, cheeks: 0, signal: 0, sparkle: 0 },
  };
}

export function resetPose(pose) {
  const l = pose.list;
  for (let i = 0; i < l.length; i++) {
    const x = l[i];
    x.px = 0; x.py = 0; x.pz = 0; x.rx = 0; x.ry = 0; x.rz = 0; x.sx = 1; x.sy = 1; x.sz = 1;
  }
}

// Scratch space for frame transforms (module-level, reused).
const TMP = [0, 0, 0];

// A rigid frame: rotation matrix R and position P in root space.
export function createFrame() { return { R: new Float64Array(9), P: new Float64Array(3) }; }

// out = parent ∘ (local bone transform) for a bone with rest position `rest`
// (parent frame) and pose entry x. Rest rotation must be zero (all bones that
// use frames have zero rest rotation).
export function composeFrame(out, parent, rest, x, order, tmpR) {
  mat3FromEuler(tmpR, x.rx, x.ry, x.rz, order);
  TMP[0] = rest[0] + x.px; TMP[1] = rest[1] + x.py; TMP[2] = rest[2] + x.pz;
  if (parent) {
    mat3Apply(parent.R, TMP);
    out.P[0] = parent.P[0] + TMP[0]; out.P[1] = parent.P[1] + TMP[1]; out.P[2] = parent.P[2] + TMP[2];
    // out.R = parent.R * tmpR
    const A = parent.R, B = tmpR, o = out.R;
    const a0 = A[0], a1 = A[1], a2 = A[2], a3 = A[3], a4 = A[4], a5 = A[5], a6 = A[6], a7 = A[7], a8 = A[8];
    o[0] = a0 * B[0] + a1 * B[3] + a2 * B[6]; o[1] = a0 * B[1] + a1 * B[4] + a2 * B[7]; o[2] = a0 * B[2] + a1 * B[5] + a2 * B[8];
    o[3] = a3 * B[0] + a4 * B[3] + a5 * B[6]; o[4] = a3 * B[1] + a4 * B[4] + a5 * B[7]; o[5] = a3 * B[2] + a4 * B[5] + a5 * B[8];
    o[6] = a6 * B[0] + a7 * B[3] + a8 * B[6]; o[7] = a6 * B[1] + a7 * B[4] + a8 * B[7]; o[8] = a6 * B[2] + a7 * B[5] + a8 * B[8];
  } else {
    out.P[0] = TMP[0]; out.P[1] = TMP[1]; out.P[2] = TMP[2];
    for (let i = 0; i < 9; i++) out.R[i] = tmpR[i];
  }
  return out;
}

// Express a root-space point in a frame: v = R^T (p - P). Writes into v.
export function toFrame(frame, x, y, z, v) {
  v[0] = x - frame.P[0]; v[1] = y - frame.P[1]; v[2] = z - frame.P[2];
  return mat3ApplyT(frame.R, v);
}
