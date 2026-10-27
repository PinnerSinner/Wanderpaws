// Ghost run decoding. Samples are a flat Int32 array of
// [x, y, z (cm), yaw (mrad), size (mm)] recorded every 2 sim ticks by main.js
// (after the step, when tick is even, so sample i belongs to tick 2 * (i + 1)).
// Pure: no three.

import { wrapAngle } from '../../core/math.js';

export const GHOST_STRIDE = 5;
export const GHOST_TICKS_PER_SAMPLE = 2;

export function ghostLength(samples) {
  if (!samples || typeof samples.length !== 'number') return 0;
  return Math.floor(samples.length / GHOST_STRIDE);
}

export function isGhost(samples) {
  return ghostLength(samples) >= 2;
}

// Fractional sample index for a sim tick (may be fractional for interpolation).
export function ghostIndexForTick(tick) {
  return tick / GHOST_TICKS_PER_SAMPLE - 1;
}

// Decode one raw sample into `out` ({x, y, z, yaw, size}).
export function decodeSample(samples, i, out) {
  const o = i * GHOST_STRIDE;
  out.x = samples[o] / 100;
  out.y = samples[o + 1] / 100;
  out.z = samples[o + 2] / 100;
  out.yaw = samples[o + 3] / 1000;
  out.size = samples[o + 4] / 1000;
  return out;
}

const A = { x: 0, y: 0, z: 0, yaw: 0, size: 0 };
const B = { x: 0, y: 0, z: 0, yaw: 0, size: 0 };

// Interpolated ghost pose at a (fractional) sim tick. Writes {x, y, z, yaw, size,
// speed, done} into `out`. speed is metres per second, from neighbouring samples.
export function sampleGhost(samples, tick, out) {
  const n = ghostLength(samples);
  out.done = false;
  if (n === 0) { out.x = out.y = out.z = out.yaw = out.speed = 0; out.size = 0; out.done = true; return out; }
  let f = ghostIndexForTick(tick);
  if (f <= 0) f = 0;
  if (f >= n - 1) { f = n - 1; out.done = tick > 0 && ghostIndexForTick(tick) > n - 1; }
  const i = Math.min(n - 2, Math.floor(f));
  const t = n === 1 ? 0 : f - i;
  decodeSample(samples, Math.max(0, i), A);
  decodeSample(samples, Math.min(n - 1, i + 1), B);
  out.x = A.x + (B.x - A.x) * t;
  out.y = A.y + (B.y - A.y) * t;
  out.z = A.z + (B.z - A.z) * t;
  out.yaw = A.yaw + wrapAngle(B.yaw - A.yaw) * t;
  out.size = A.size + (B.size - A.size) * t;
  const dt = GHOST_TICKS_PER_SAMPLE / 60;
  out.speed = Math.hypot(B.x - A.x, B.z - A.z) / dt;
  return out;
}
