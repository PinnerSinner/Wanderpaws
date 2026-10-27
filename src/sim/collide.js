// Static collision: rotated boxes and cylinders in a uniform spatial hash.
// Circles (player, NPCs, tumbling items) are pushed out of anything taller than
// their step-up height and can stand on anything lower. Pass flags let some
// species through: 'squeeze' (cat-flaps, fence gaps) and 'under' (fences).

export const PASS_SQUEEZE = 1;
export const PASS_UNDER = 2;
const PASS_CODES = { squeeze: PASS_SQUEEZE, under: PASS_UNDER };

export function passMaskFor(species) {
  const tr = (species && species.traits) || {};
  return (tr.squeezeGaps ? PASS_SQUEEZE : 0) | (tr.underFences ? PASS_UNDER : 0);
}

export function createColliders(world, terrain, extra = []) {
  const src = (world.colliders || []).concat(extra);
  const n = src.length;
  const kind = new Uint8Array(n);       // 0 box, 1 cyl
  const cx = new Float64Array(n), cz = new Float64Array(n);
  const hw = new Float64Array(n), hd = new Float64Array(n), rad = new Float64Array(n);
  const cs = new Float64Array(n), sn = new Float64Array(n);
  const base = new Float64Array(n), top = new Float64Array(n), bound = new Float64Array(n);
  const pass = new Uint8Array(n);
  const enabled = new Uint8Array(n).fill(1);
  const tag = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const c = src[i];
    cx[i] = +c.x || 0; cz[i] = +c.z || 0;
    const isCyl = c.kind === 'cyl' || c.kind === 'cylinder';
    kind[i] = isCyl ? 1 : 0;
    if (isCyl) { rad[i] = Math.max(0.01, +c.r || 0.5); bound[i] = rad[i]; }
    else {
      hw[i] = Math.max(0.005, (+c.w || 1) / 2); hd[i] = Math.max(0.005, (+c.d || 1) / 2);
      const rot = +c.rot || 0; cs[i] = Math.cos(rot); sn[i] = Math.sin(rot);
      bound[i] = Math.hypot(hw[i], hd[i]);
    }
    const b0 = c.y != null ? +c.y : terrain.heightAt(cx[i], cz[i]);
    base[i] = c.y != null ? b0 : b0 - 50; // grounded colliders extend down so slopes never open a gap
    top[i] = b0 + Math.max(0.01, +c.h || 1);
    pass[i] = PASS_CODES[c.pass] || 0;
    tag[i] = c.tag || c.id || null;
  }

  // Grid
  const bd = terrain.bounds;
  const margin = 20;
  const minX = bd.minX - margin, minZ = bd.minZ - margin;
  const spanX = bd.maxX - bd.minX + margin * 2, spanZ = bd.maxZ - bd.minZ + margin * 2;
  const cell = Math.min(128, Math.max(2, Math.sqrt((spanX * spanZ) / 3000)));
  const gw = Math.max(1, Math.ceil(spanX / cell)), gh = Math.max(1, Math.ceil(spanZ / cell));
  const counts = new Int32Array(gw * gh + 1);
  const cellOf = (v, m, g) => { const k = Math.floor((v - m) / cell); return k < 0 ? 0 : k >= g ? g - 1 : k; };
  const forCells = (i, fn) => {
    const x0 = cellOf(cx[i] - bound[i], minX, gw), x1 = cellOf(cx[i] + bound[i], minX, gw);
    const z0 = cellOf(cz[i] - bound[i], minZ, gh), z1 = cellOf(cz[i] + bound[i], minZ, gh);
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) fn(gz * gw + gx);
  };
  for (let i = 0; i < n; i++) forCells(i, (c) => { counts[c + 1]++; });
  for (let c = 0; c < gw * gh; c++) counts[c + 1] += counts[c];
  const start = counts.slice();
  const list = new Int32Array(Math.max(1, counts[gw * gh]));
  const fill = start.slice();
  for (let i = 0; i < n; i++) forCells(i, (c) => { list[fill[c]++] = i; });

  const stamp = new Uint32Array(n);
  let qid = 0;
  const hits = new Int32Array(Math.max(16, n));
  let maxBound = 0;
  for (let i = 0; i < n; i++) if (bound[i] > maxBound) maxBound = bound[i];

  // Writes collider indices near (x, z) within radius into C.hits; returns the count.
  function query(x, z, r) {
    if (!n) return 0;
    qid = (qid + 1) >>> 0;
    if (qid === 0) { stamp.fill(0); qid = 1; }
    const x0 = cellOf(x - r, minX, gw), x1 = cellOf(x + r, minX, gw);
    const z0 = cellOf(z - r, minZ, gh), z1 = cellOf(z + r, minZ, gh);
    let k = 0;
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        const c = gz * gw + gx;
        for (let j = start[c], e = start[c + 1]; j < e; j++) {
          const id = list[j];
          if (stamp[id] === qid) continue;
          stamp[id] = qid;
          if (k < hits.length) hits[k++] = id;
        }
      }
    }
    return k;
  }

  // Closest-point maths. Writes into cp {dx, dz, dist, inside, px, pz} where (dx, dz)
  // is the vector from the collider surface to the point and (px, pz) the
  // push direction when the centre is inside.
  const cp = { dx: 0, dz: 0, dist: 0, inside: false };
  function closest(i, x, z) {
    const ox = x - cx[i], oz = z - cz[i];
    if (kind[i] === 1) {
      const d = Math.hypot(ox, oz);
      const r = rad[i];
      if (d >= r) { const s = (d - r) / (d || 1); cp.dx = ox * s; cp.dz = oz * s; cp.dist = d - r; cp.inside = false; }
      else {
        const s = d > 1e-9 ? 1 / d : 0;
        cp.dx = d > 1e-9 ? ox * s : 1; cp.dz = d > 1e-9 ? oz * s : 0;
        cp.dist = -(r - d); cp.inside = true;
      }
      return cp;
    }
    const c = cs[i], s = sn[i];
    const lx = c * ox - s * oz, lz = s * ox + c * oz;
    const w = hw[i], d = hd[i];
    const qx = lx < -w ? -w : lx > w ? w : lx;
    const qz = lz < -d ? -d : lz > d ? d : lz;
    let ex = lx - qx, ez = lz - qz;
    if (ex !== 0 || ez !== 0) {
      cp.dist = Math.hypot(ex, ez); cp.inside = false;
    } else {
      // inside: push along the axis of least penetration
      const px = w - Math.abs(lx), pz = d - Math.abs(lz);
      if (px < pz) { ex = lx >= 0 ? 1 : -1; ez = 0; cp.dist = -px; } else { ex = 0; ez = lz >= 0 ? 1 : -1; cp.dist = -pz; }
      cp.inside = true;
      // ex, ez now a unit local direction
    }
    // local -> world: x = c*lx + s*lz, z = -s*lx + c*lz
    cp.dx = c * ex + s * ez; cp.dz = -s * ex + c * ez;
    return cp;
  }

  // Resolve a vertical cylinder (feet at y) against blocking colliders.
  // out: {x, z, support, hit, nx, nz, hitIndex}
  function resolve(x, z, r, y, height, stepUp, passMask, out) {
    out.x = x; out.z = z; out.support = -Infinity; out.hit = 0; out.nx = 0; out.nz = 0; out.hitIndex = -1;
    if (!n) return out;
    for (let iter = 0; iter < 3; iter++) {
      const k = query(out.x, out.z, r + 0.01);
      let moved = false;
      for (let j = 0; j < k; j++) {
        const i = hits[j];
        if (!enabled[i] || (pass[i] & passMask)) continue;
        if (base[i] >= y + height) continue;          // we're fully underneath (bridge)
        if (top[i] <= y + stepUp) continue;           // low enough to step onto
        const q = closest(i, out.x, out.z);
        if (q.dist >= r) continue;
        let push, nx, nz;
        if (q.inside) { push = r - q.dist; nx = q.dx; nz = q.dz; }
        else { push = r - q.dist; const inv = 1 / (q.dist || 1); nx = q.dx * inv; nz = q.dz * inv; }
        out.x += nx * push; out.z += nz * push;
        out.hit = 1; out.nx = nx; out.nz = nz; out.hitIndex = i;
        moved = true;
      }
      if (!moved) break;
    }
    out.support = supportAt(out.x, out.z, r * 0.35, y, stepUp, passMask);
    return out;
  }

  // Highest collider top under the footprint that we can stand on.
  function supportAt(x, z, r, y, stepUp, passMask) {
    let best = -Infinity;
    if (!n) return best;
    const k = query(x, z, r + 0.01);
    for (let j = 0; j < k; j++) {
      const i = hits[j];
      if (!enabled[i] || (pass[i] & passMask)) continue;
      if (top[i] > y + stepUp) continue;
      if (top[i] <= best) continue;
      const q = closest(i, x, z);
      if (q.dist <= r) best = top[i];
    }
    return best;
  }

  // Collider containing a point (for placement). Returns index or -1.
  function containing(x, z, pad = 0) {
    const k = query(x, z, pad + 0.01);
    for (let j = 0; j < k; j++) {
      const i = hits[j];
      if (!enabled[i]) continue;
      const q = closest(i, x, z);
      if (q.dist <= pad) return i;
    }
    return -1;
  }

  return {
    count: n, kind, cx, cz, hw, hd, rad, cs, sn, base, top, pass, enabled, tag, bound, maxBound,
    cell, query, hits, closest, resolve, supportAt, containing,
    setEnabledByTag(t, on) { for (let i = 0; i < n; i++) if (tag[i] === t) enabled[i] = on ? 1 : 0; },
  };
}
