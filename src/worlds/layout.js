// Layout utilities shared by tests (and offered to the sim): expand a world's
// anchors plus seeded fill into a flat item list, and geometric checks
// against colliders and water. Pure and Node-importable.

import { createRng } from '../core/rng.js';

// Point inside a collider footprint (2D), with an optional margin in metres.
export function insideCollider(c, x, z, margin = 0) {
  if (c.kind === 'cyl') {
    const r = c.r + margin;
    const dx = x - c.x, dz = z - c.z;
    return dx * dx + dz * dz <= r * r;
  }
  // box: transform into local space (rot follows THREE rotation.y)
  const cr = Math.cos(c.rot || 0), sr = Math.sin(c.rot || 0);
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * cr - dz * sr;
  const lz = dx * sr + dz * cr;
  return Math.abs(lx) <= c.w / 2 + margin && Math.abs(lz) <= c.d / 2 + margin;
}

export function insideAnyCollider(world, x, z, margin = 0, minH = 0) {
  for (const c of world.colliders) {
    if ((c.h || 0) < minH) continue;
    if (insideCollider(c, x, z, margin)) return c;
  }
  return null;
}

// Highest water level (at its tidal maximum) covering a point, or -Infinity.
export function maxWaterAt(world, x, z) {
  let best = -Infinity;
  for (const w of world.water) {
    const r = w.rect;
    if (r && (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ)) continue;
    const lv = w.level + (w.tide ? Math.abs(w.tide.amp) : 0);
    if (lv > best) best = lv;
  }
  return best;
}

export function isWet(world, x, z, margin = 0.05) {
  return world.heightAt(x, z) < maxWaterAt(world, x, z) + margin;
}

function regionPoint(rng, region) {
  if (region.r != null) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * region.r;
    return [region.x + Math.cos(a) * d, region.z + Math.sin(a) * d];
  }
  return [region.minX + rng.next() * (region.maxX - region.minX), region.minZ + rng.next() * (region.maxZ - region.minZ)];
}

// Expand anchors and fill into [{type, x, z, rot, golden, hidden, flag, fill}].
// Fill points inside colliders, outside bounds, or in water (avoidWater) are re-rolled.
export function expandItems(world, seed = 1) {
  const out = [];
  for (const a of world.items.anchors) {
    out.push({ type: a.type, x: a.x, z: a.z, rot: a.rot || 0, golden: !!a.golden, hidden: !!a.hidden, flag: a.flag || null, fill: false });
  }
  const rng = createRng(seed).fork('fill');
  const b = world.bounds;
  for (let fi = 0; fi < world.items.fill.length; fi++) {
    const f = world.items.fill[fi];
    const r = rng.fork(`fill${fi}`);
    for (let i = 0; i < f.count; i++) {
      let x = 0, z = 0, ok = false;
      for (let tries = 0; tries < 12 && !ok; tries++) {
        [x, z] = regionPoint(r, f.region);
        ok = x > b.minX + 1 && x < b.maxX - 1 && z > b.minZ + 1 && z < b.maxZ - 1
          && !insideAnyCollider(world, x, z, 0.2)
          && !(f.avoidWater && isWet(world, x, z));
      }
      if (!ok) continue;
      out.push({ type: f.types[i % f.types.length], x, z, rot: r.next() * Math.PI * 2, golden: false, hidden: false, flag: null, fill: true });
    }
  }
  return out;
}

// Rough count of items of size <= maxSize within r of a point (used by tests and tuning).
export function countNear(list, catalogue, x, z, r, maxSize) {
  let n = 0;
  for (const it of list) {
    if (it.hidden) continue;
    const c = catalogue[it.type];
    if (!c || c.size > maxSize) continue;
    if (Math.hypot(it.x - x, it.z - z) <= r) n++;
  }
  return n;
}

// Push hand-placed anchors out of tall colliders (top above maxH), so a cluster
// that spills into a tree trunk or a wall ends up just outside it. Returns the array.
export function settleAnchors(anchors, colliders, maxH = 1.5, margin = 0.25) {
  for (const a of anchors) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const c of colliders) {
        if ((c.h || 0) <= maxH || c.pass) continue;
        if (!insideCollider(c, a.x, a.z, margin * 0.5)) continue;
        if (c.kind === 'cyl') {
          let dx = a.x - c.x, dz = a.z - c.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d < 1e-3) { dx = 1; dz = 0; }
          a.x = c.x + (dx / d) * (c.r + margin);
          a.z = c.z + (dz / d) * (c.r + margin);
        } else {
          const cr = Math.cos(c.rot || 0), sr = Math.sin(c.rot || 0);
          const dx = a.x - c.x, dz = a.z - c.z;
          let lx = dx * cr - dz * sr, lz = dx * sr + dz * cr;
          const ox = c.w / 2 - Math.abs(lx), oz = c.d / 2 - Math.abs(lz);
          if (ox < oz) lx = Math.sign(lx || 1) * (c.w / 2 + margin);
          else lz = Math.sign(lz || 1) * (c.d / 2 + margin);
          a.x = c.x + lx * cr + lz * sr;
          a.z = c.z - lx * sr + lz * cr;
        }
        moved = true;
      }
      if (!moved) break;
    }
  }
  return anchors;
}
