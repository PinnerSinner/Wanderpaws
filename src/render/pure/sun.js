// Sun position and lighting mood from a time of day. Pure: no three.
// timeOfDay is a 0..1 fraction of a day (0.25 = 6am, 0.5 = noon, 0.75 = 6pm).

import { TAU, clamp01, smoothstep, lerp } from '../../core/math.js';

// Lighting never goes below this elevation in daytime, so play stays readable
// even when the sun disc itself is on the horizon at sunset.
export const MIN_LIGHT_ELEVATION = 0.32;

export function createSunState() {
  return {
    // visual sun direction (unit, towards the sun), for the sky disc
    x: 0, y: 1, z: 0,
    // light direction (unit, towards the light), for shading and shadows
    lx: 0, ly: 1, lz: 0,
    elevation: 0,   // radians, of the visual sun
    day: 1,         // 0 (night) .. 1 (day): sun light strength factor
    night: 0,       // 0..1: stars and moonlight
    warmth: 0,      // 0..1: golden-hour colour push
    moon: false,    // lighting comes from the moon
  };
}

// Run time fraction 0..1 to time of day, using the world's {start, end}.
export function timeOfDayAt(tod, frac) {
  if (!tod) return 0.45;
  const s = typeof tod.start === 'number' ? tod.start : 0.45;
  const e = typeof tod.end === 'number' ? tod.end : s;
  return lerp(s, e, clamp01(frac));
}

export function sunState(tod, out = createSunState()) {
  const a = (tod - 0.25) * TAU; // 0 at sunrise, PI/2 at noon, PI at sunset
  // Arc across the sky from east (-x) to west (+x), tilted south (+z) so shadows have length.
  let x = -Math.cos(a), y = Math.sin(a), z = 0.5;
  let len = Math.hypot(x, y, z);
  out.x = x / len; out.y = y / len; out.z = z / len;
  out.elevation = Math.asin(out.y);

  out.day = smoothstep(-0.08, 0.12, out.y);
  out.night = smoothstep(0.02, -0.16, out.y);
  out.warmth = (1 - smoothstep(0.08, 0.55, out.y)) * smoothstep(-0.2, 0.0, out.y);
  out.moon = out.y < -0.02;

  // Light direction: the sun, or the moon opposite it at night, clamped up.
  let lx = out.moon ? -out.x : out.x;
  let ly = out.moon ? -out.y : out.y;
  let lz = out.z;
  const minY = Math.sin(MIN_LIGHT_ELEVATION);
  if (ly < minY) {
    // keep the azimuth, raise the elevation
    const h = Math.hypot(lx, lz) || 1;
    const k = Math.sqrt(1 - minY * minY) / h;
    lx *= k; lz *= k; ly = minY;
  }
  len = Math.hypot(lx, ly, lz);
  out.lx = lx / len; out.ly = ly / len; out.lz = lz / len;
  return out;
}
