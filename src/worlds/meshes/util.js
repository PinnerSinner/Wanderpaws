// Small shared helpers for mesh builders (pure maths, no three import).
import { noise2, fbm2, mixHex, shadeHex, hexToRgb } from '../../core/math.js';

export { noise2, fbm2, mixHex, shadeHex };

export const PI = Math.PI;
export const TAU = Math.PI * 2;

// Radial crimp/ridges about the Y axis: r *= 1 + amt * cos(n * theta)
export const crimp = (n, amt, minR = 1e-4) => (v) => {
  const r = Math.hypot(v.x, v.z);
  if (r < minR) return;
  const th = Math.atan2(v.z, v.x);
  const k = 1 + amt * Math.cos(n * th);
  v.x *= k; v.z *= k;
};

// Lumpy organic deform by 3D-ish value noise on the direction from the centre.
export const lumpy = (amt, freq = 2, seed = 0) => (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  const n = noise2(v.x * freq + seed, v.z * freq - seed * 0.7) * 0.6 + noise2(v.y * freq + 13.1 + seed, v.x * freq * 0.7) * 0.4;
  const k = 1 + amt * n;
  v.x *= k; v.y *= k; v.z *= k;
};

// RGB array helpers for per-vertex colour functions
const rgbCache = new Map();
export function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) { const c = hexToRgb(hex); v = [srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b)]; rgbCache.set(hex, v); }
  return v;
}
// THREE.Color.set(hex) converts sRGB -> linear when colour management is on (the default),
// so colour functions return linear arrays to match.
export function srgbToLinear(c) { return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4); }

const _o = [0, 0, 0];
// mix two hex colours into a reusable array (callers must consume immediately)
export function mixRgb(a, b, t, out) {
  const A = rgb(a), B = rgb(b);
  const o = out || [0, 0, 0];
  o[0] = A[0] + (B[0] - A[0]) * t; o[1] = A[1] + (B[1] - A[1]) * t; o[2] = A[2] + (B[2] - A[2]) * t;
  return o;
}
export function scaleRgb(hex, k) { const A = rgb(hex); return [A[0] * k, A[1] * k, A[2] * k]; }
export function jitter(hex, x, y, amt = 0.08) {
  const A = rgb(hex); const k = 1 + noise2(x, y) * amt;
  return [A[0] * k, A[1] * k, A[2] * k];
}

export const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Deterministic tiny RNG for build-time variation (mulberry32)
export function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
