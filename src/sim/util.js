// Small shared helpers for the sim (init-time only; nothing here allocates per tick).
import { NPC_ANIMS } from '../worlds/ids.js';

export const NPC_ANIMS_SET = new Set(NPC_ANIMS);

// Paths may be [{x, z}, ...] or [[x, z], ...]. Returns a flat Float64Array or null.
export function normPath(path) {
  if (!Array.isArray(path) || !path.length) return null;
  const out = new Float64Array(path.length * 2);
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (Array.isArray(p)) { out[i * 2] = +p[0] || 0; out[i * 2 + 1] = +p[1] || 0; }
    else { out[i * 2] = +p.x || 0; out[i * 2 + 1] = +p.z || 0; }
  }
  return out;
}

// Regions: {x, z, r} or {minX, maxX, minZ, maxZ}. Compiled to a test function's data.
export function compileRegion(o, fallbackR = 3) {
  if (o && o.minX != null) return { rect: true, minX: +o.minX, maxX: +o.maxX, minZ: +o.minZ, maxZ: +o.maxZ, x: (+o.minX + +o.maxX) / 2, z: (+o.minZ + +o.maxZ) / 2, r: hypot(o.maxX - o.minX, o.maxZ - o.minZ) / 2 };
  if (o && o.rect && o.rect.minX != null) return compileRegion(o.rect, fallbackR);
  return { rect: false, x: +(o && o.x) || 0, z: +(o && o.z) || 0, r: +(o && o.r) || fallbackR };
}

export function inRegion(g, x, z, pad = 0) {
  if (g.rect) return x >= g.minX - pad && x <= g.maxX + pad && z >= g.minZ - pad && z <= g.maxZ + pad;
  const dx = x - g.x, dz = z - g.z, r = g.r + pad;
  return dx * dx + dz * dz <= r * r;
}

// FNV-1a over numbers, for determinism tests and ghosts.
export function hashNumbers(h, v) {
  const f = Math.round(v * 1000) | 0;
  h ^= f & 255; h = Math.imul(h, 0x01000193);
  h ^= (f >>> 8) & 255; h = Math.imul(h, 0x01000193);
  h ^= (f >>> 16) & 255; h = Math.imul(h, 0x01000193);
  h ^= (f >>> 24) & 255; h = Math.imul(h, 0x01000193);
  return h >>> 0;
}

// Math.hypot allocates an argument array in V8; this does not.
export function hypot(a, b, c) {
  return c === undefined ? Math.sqrt(a * a + b * b) : Math.sqrt(a * a + b * b + c * c);
}
