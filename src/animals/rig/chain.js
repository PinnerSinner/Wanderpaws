// Spring chains for ears, tails, trunks, tentacles, wings and necks.
//
// Each link has two relative angles (pitch and yaw) relative to its parent
// link. Every link is a damped spring towards its target angle, and it resists
// changes in its parent's world rotation (inertia), which is what makes a wag
// at the base roll down the chain as a whip-like wave. Linear accelerations
// push the links (more at the tip) and an optional gravity term keeps floppy
// bits hanging as the head tilts. Integration is semi-implicit Euler with
// fixed substeps, so any frame dt is stable. Everything is preallocated.

import { TAU } from '../../core/math.js';

const MAX_SUB = 1 / 120;
const LIMIT = 2.6; // radians, hard clamp per link so nothing can explode

export function createChain(spec) {
  const n = spec.links;
  const ch = {
    n,
    stiff: spec.stiff || 8, // Hz-ish
    damp: spec.damp ?? 0.5,
    inertia: spec.inertia ?? 0.6,
    gravity: spec.gravity || 0,
    p: new Float64Array(n), pv: new Float64Array(n),
    y: new Float64Array(n), yv: new Float64Array(n),
    restP: new Float64Array(n), restY: new Float64Array(n),
    tgtP: new Float64Array(n), tgtY: new Float64Array(n), // extra targets set per frame
    prevWp: new Float64Array(n), prevWy: new Float64Array(n),
    first: true,
  };
  const rest = spec.rest || [];
  for (let i = 0; i < n; i++) { ch.restP[i] = rest[i] || 0; ch.p[i] = ch.restP[i]; }
  return ch;
}

// drive: { wP, wY  (anchor world angular velocity, rad/s, pitch and yaw axes)
//          fP, fY  (pseudo-force from linear acceleration, rad/s^2 at the tip)
//          gP      (anchor world pitch, for gravity)
//          stiffMul, dampMul }
// The per-frame extra targets live in ch.tgtP / ch.tgtY (caller fills them).
export function stepChain(ch, dt, drive) {
  if (!(dt > 0)) return;
  const n = ch.n;
  const sm = drive.stiffMul || 1;
  const w = TAU * ch.stiff * sm;
  const k = w * w;
  const c = 2 * ch.damp * (drive.dampMul || 1) * w;
  const steps = Math.min(8, Math.max(1, Math.ceil(dt / MAX_SUB)));
  const h = dt / steps;
  const g = ch.gravity * (drive.gP || 0) / n;
  for (let s = 0; s < steps; s++) {
    let wp = drive.wP || 0, wy = drive.wY || 0;
    for (let i = 0; i < n; i++) {
      // parent world angular velocity for this link
      const ap = ch.first ? 0 : (wp - ch.prevWp[i]) / h;
      const ay = ch.first ? 0 : (wy - ch.prevWy[i]) / h;
      ch.prevWp[i] = wp; ch.prevWy[i] = wy;
      const tip = (i + 1) / n;
      const tp = ch.restP[i] + ch.tgtP[i] - g;
      const ty = ch.restY[i] + ch.tgtY[i];
      let accP = -k * (ch.p[i] - tp) - c * ch.pv[i] - ch.inertia * ap + (drive.fP || 0) * tip;
      let accY = -k * (ch.y[i] - ty) - c * ch.yv[i] - ch.inertia * ay + (drive.fY || 0) * tip;
      // clamp absurd accelerations (teleports, first frames)
      if (accP > 4000) accP = 4000; else if (accP < -4000) accP = -4000;
      if (accY > 4000) accY = 4000; else if (accY < -4000) accY = -4000;
      ch.pv[i] += accP * h; ch.yv[i] += accY * h;
      ch.p[i] += ch.pv[i] * h; ch.y[i] += ch.yv[i] * h;
      if (ch.p[i] > LIMIT) { ch.p[i] = LIMIT; ch.pv[i] = 0; } else if (ch.p[i] < -LIMIT) { ch.p[i] = -LIMIT; ch.pv[i] = 0; }
      if (ch.y[i] > LIMIT) { ch.y[i] = LIMIT; ch.yv[i] = 0; } else if (ch.y[i] < -LIMIT) { ch.y[i] = -LIMIT; ch.yv[i] = 0; }
      if (ch.p[i] !== ch.p[i] || ch.y[i] !== ch.y[i]) { ch.p[i] = tp; ch.y[i] = ty; ch.pv[i] = 0; ch.yv[i] = 0; }
      wp += ch.pv[i]; wy += ch.yv[i];
    }
    ch.first = false;
  }
}

export function resetChain(ch) {
  for (let i = 0; i < ch.n; i++) { ch.p[i] = ch.restP[i]; ch.y[i] = ch.restY[i]; ch.pv[i] = 0; ch.yv[i] = 0; ch.tgtP[i] = 0; ch.tgtY[i] = 0; }
  ch.first = true;
}
