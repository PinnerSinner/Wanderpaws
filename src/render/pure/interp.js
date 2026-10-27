// Interpolation and motion helpers for the render side. Pure: no three.

import { wrapAngle, clamp01 } from '../../core/math.js';

export const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;

// Interpolate a sim entity with x/px fields. Writes {x, y, z, yaw} into out.
export function interpEntity(e, alpha, out) {
  const a = clamp01(alpha);
  const px = e.px ?? e.x, py = e.py ?? e.y, pz = e.pz ?? e.z;
  out.x = px + (e.x - px) * a;
  out.y = (py ?? 0) + ((e.y ?? 0) - (py ?? 0)) * a;
  out.z = pz + (e.z - pz) * a;
  out.yaw = e.pyaw !== undefined ? lerpAngle(e.pyaw, e.yaw || 0, a) : (e.yaw || 0);
  return out;
}

// Interpolate one item of the structure-of-arrays items state.
export function interpItem(items, i, alpha, out) {
  const a = clamp01(alpha);
  out.x = items.px[i] + (items.x[i] - items.px[i]) * a;
  out.y = items.py[i] + (items.y[i] - items.py[i]) * a;
  out.z = items.pz[i] + (items.z[i] - items.pz[i]) * a;
  return out;
}

// The gobble flight: a quadratic Bezier from the item to the mouth with a lift
// and a sideways swerve, so items arc in rather than slide. t in 0..1.
// start/end are {x,y,z}; lift is in metres; side is -1..1.
export function gobblePath(t, sx, sy, sz, ex, ey, ez, lift, side, out) {
  const u = clamp01(t);
  // accelerate into the mouth
  const k = u * u * (3 - 2 * u) * 0.35 + u * u * 0.65;
  const dx = ex - sx, dz = ez - sz;
  const len = Math.hypot(dx, dz) || 1;
  // control point: midpoint raised, pushed sideways
  const cx = (sx + ex) * 0.5 + (-dz / len) * side * len * 0.35;
  const cy = Math.max(sy, ey) + lift;
  const cz = (sz + ez) * 0.5 + (dx / len) * side * len * 0.35;
  const v = 1 - k;
  out.x = v * v * sx + 2 * v * k * cx + k * k * ex;
  out.y = v * v * sy + 2 * v * k * cy + k * k * ey;
  out.z = v * v * sz + 2 * v * k * cz + k * k * ez;
  return out;
}

// Scale through a gobble: a little anticipation swell, then a squish to zero.
// Returns {s (uniform), sy (vertical stretch multiplier)} into out.
export function gobbleScale(t, out) {
  const u = clamp01(t);
  let s;
  if (u < 0.15) s = 1 + 0.18 * Math.sin((u / 0.15) * Math.PI * 0.5);
  else { const w = (u - 0.15) / 0.85; s = 1.18 * (1 - w * w * (3 - 2 * w)); }
  out.s = Math.max(0, s);
  // stretch along the flight, squash at the end
  out.sy = 1 + 0.35 * Math.sin(u * Math.PI) - 0.25 * u * u;
  return out;
}

// A damped spring wobble for a knocked item, from its state timer (seconds).
export function wobble(t, amp = 1, freq = 7, decay = 3.2) {
  if (t < 0) return 0;
  return amp * Math.exp(-decay * t) * Math.sin(t * freq * Math.PI * 2);
}

// Gentle pulse used by the 'almost' shimmer: smooth, about 0.7 Hz, never a flash.
export function shimmerPulse(time) {
  return 0.6 + 0.4 * Math.sin(time * Math.PI * 2 * 0.7);
}

// Exponential approach that's frame-rate independent.
export const approach = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
