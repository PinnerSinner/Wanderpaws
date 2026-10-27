// Small, pure helpers for writing world layouts by hand: collider and scenery
// shorthands, deterministic clusters for anchors, and cheap terrain shapes.
// Node-importable, no randomness outside createRng.

import { createRng } from '../core/rng.js';

export const PI = Math.PI;
export const HALF_PI = Math.PI / 2;

// ---- colliders and scenery ----------------------------------------------

export const box = (x, z, w, d, h, rot = 0, extra) => ({ kind: 'box', x, z, w, d, h, rot, ...(extra || {}) });
export const cyl = (x, z, r, h, extra) => ({ kind: 'cyl', x, z, r, h, ...(extra || {}) });
export const scen = (mesh, x, z, rot = 0, scale = 1, extra) => ({ mesh, x, z, rot, scale, ...(extra || {}) });

// A flat strip scenery mesh (wavepavement, road...) centred on a rect.
export const strip = (mesh, minX, maxX, minZ, maxZ, extra) => ({
  mesh, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, rot: 0, scale: [maxX - minX, 1, maxZ - minZ], ...(extra || {}),
});

// A mesh that runs between two points along local X (bunting, rope bridge, ski-lift cable).
export function span(mesh, x0, z0, x1, z1, dimsX = 1, extra) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  // rot follows THREE rotation.y: local +X maps to (cos r, 0, -sin r)
  const rot = Math.atan2(-(z1 - z0), x1 - x0);
  return { mesh, x: (x0 + x1) / 2, z: (z0 + z1) / 2, rot, scale: [len / dimsX, 1, 1], ...(extra || {}) };
}

// A thin wall of box colliders from point to point (railings, dykes, cliff faces).
export function wall(x0, z0, x1, z1, h, thick = 0.4, extra) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const rot = Math.atan2(-(z1 - z0), x1 - x0);
  return box((x0 + x1) / 2, (z0 + z1) / 2, len, thick, h, rot, extra);
}

// A wall with a gap in the middle (width gap, centred at fraction t along it).
export function gappedWall(x0, z0, x1, z1, h, gap, t = 0.5, thick = 0.4, extra) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  const c = len * t;
  const a = c - gap / 2, b = c + gap / 2;
  return [
    wall(x0, z0, x0 + ux * a, z0 + uz * a, h, thick, extra),
    wall(x0 + ux * b, z0 + uz * b, x1, z1, h, thick, extra),
  ];
}

// ---- anchors ------------------------------------------------------------

export const at = (type, x, z, o) => ({ type, x, z, ...(o || {}) });

export function row(type, x0, z0, x1, z1, n, o) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    out.push({ type, x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, ...(o || {}) });
  }
  return out;
}

export function ring(type, cx, cz, r, n, phase = 0, o) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    out.push({ type, x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, rot: -a, ...(o || {}) });
  }
  return out;
}

// A deterministic little cluster: types picked in turn, positions in a disc.
// Uses its own seeded stream so layouts never change between runs.
export function cluster(types, cx, cz, r, n, seed, o) {
  const rng = createRng(`cluster:${seed}`);
  const list = Array.isArray(types) ? types : [types];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * r;
    out.push({ type: list[i % list.length], x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, rot: rng.next() * Math.PI * 2, ...(o || {}) });
  }
  return out;
}

// A table setting: a kiosk table with chairs/snacks round it.
export function tableSet(cx, cz, snacks, seed, tableType = 'kiosktable') {
  return [at(tableType, cx, cz), ...cluster(snacks, cx, cz, 1.6, snacks.length, seed)];
}

// ---- terrain shapes (cheap, smooth) -------------------------------------

export const sstep = (a, b, v) => {
  let t = (v - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Smooth round hill: h at the centre, 0 at radius r (cosine-ish profile).
export function hill(x, z, cx, cz, r, h) {
  const dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return 0;
  const t = 1 - Math.sqrt(d2) / r;
  return h * t * t * (3 - 2 * t);
}

// Elliptical basin (negative) or mound with a flat floor: returns 0..1 inside factor.
export function ellipse01(x, z, cx, cz, rx, rz, soft = 0.2) {
  const dx = (x - cx) / rx, dz = (z - cz) / rz;
  const d = Math.sqrt(dx * dx + dz * dz);
  return 1 - sstep(1 - soft, 1, d);
}

// Rect inside factor with soft edges (metres of falloff).
export function rect01(x, z, minX, maxX, minZ, maxZ, soft = 1) {
  const fx = Math.min(sstep(minX - soft, minX, x), 1 - sstep(maxX, maxX + soft, x));
  const fz = Math.min(sstep(minZ - soft, minZ, z), 1 - sstep(maxZ, maxZ + soft, z));
  return Math.min(fx, fz);
}

export const inRect = (x, z, r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

// Distance from point to segment (for paths and roads in surfaceAt).
export function segDist(x, z, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const l2 = vx * vx + vz * vz;
  let t = l2 > 0 ? ((x - ax) * vx + (z - az) * vz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + vx * t - x, pz = az + vz * t - z;
  return Math.sqrt(px * px + pz * pz);
}

// Distance to a polyline [[x, z], ...]
export function pathDist(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
}

// Gentle deterministic ripple (sum of two sines), amplitude a.
export const ripple = (x, z, a, f = 0.3) => a * Math.sin(x * f + Math.sin(z * f * 0.7) * 1.3) * Math.sin(z * f * 1.1 + 0.7);
