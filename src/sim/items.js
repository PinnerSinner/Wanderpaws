// Items: seeded placement (anchors plus fill), structure-of-arrays state, a
// dynamic spatial grid, and the cheap faked physics: spring wobbles, ballistic
// tumbles with damped bounces, domino knocks and a hard velocity cap.
import { CATALOGUE } from '../worlds/catalogue.js';
import { TUNE } from './tune.js';

export const IS_IDLE = 0, IS_WOBBLE = 1, IS_TUMBLE = 2, IS_GOBBLING = 3, IS_GONE = 4, IS_HIDDEN = 5;

const typeIdOf = (t) => (typeof t === 'string' ? t : t && (t.type || t.id)) || null;

export function createItems(S) {
  const { world, terrain, col, rng } = S;
  const prng = rng.fork('items');
  const tiny = !!S.modifiers.tiny;
  const anchors = (world.items && world.items.anchors) || [];
  const fills = (world.items && world.items.fill) || [];

  // Types: everything the world mentions, plus golden and daily items.
  const types = [];
  const typeMap = new Map();
  const addType = (id) => {
    if (!id || !CATALOGUE[id]) return -1;
    if (typeMap.has(id)) return typeMap.get(id);
    typeMap.set(id, types.length); types.push(id); return types.length - 1;
  };
  for (const a of anchors) addType(typeIdOf(a.type || a));
  for (const f of fills) for (const t of f.types || []) addType(typeIdOf(t));
  if (world.golden && world.golden.type) addType(world.golden.type);
  if (S.daily && S.daily.specialItem) addType(S.daily.specialItem);
  for (const e of world.eggs || []) if (e && e.golden) addType(e.golden);

  let base = 0;
  for (const a of anchors) if (CATALOGUE[typeIdOf(a.type || a)]) base++;
  for (const f of fills) base += Math.max(0, f.count | 0);
  const spare = Math.max(64, Math.ceil(base * 0.12));
  const cap = base + spare;

  const I = {
    count: cap, types, version: 0,
    typeIndex: new Uint16Array(cap),
    x: new Float32Array(cap), y: new Float32Array(cap), z: new Float32Array(cap),
    px: new Float32Array(cap), py: new Float32Array(cap), pz: new Float32Array(cap),
    rotY: new Float32Array(cap), tilt: new Float32Array(cap), tiltAxis: new Float32Array(cap),
    scale: new Float32Array(cap).fill(1),
    state: new Uint8Array(cap).fill(IS_GONE),
    anim: new Float32Array(cap),
    golden: new Uint8Array(cap),
    size: new Float32Array(cap),
    gobbleable: new Uint8Array(cap),
    almost: new Uint8Array(cap),
  };
  // Internal (not part of the contract, but harmless to read)
  const X = {
    vx: new Float32Array(cap), vy: new Float32Array(cap), vz: new Float32Array(cap),
    spin: new Float32Array(cap), tiltVel: new Float32Array(cap),
    height: new Float32Array(cap), radius: new Float32Array(cap), mass: new Float32Array(cap),
    baseY: new Float32Array(cap), ox: new Float32Array(cap), oz: new Float32Array(cap),
    sx: new Float32Array(cap), sy: new Float32Array(cap), sz: new Float32Array(cap),
    wet: new Uint8Array(cap), grace: new Float32Array(cap), food: new Uint8Array(cap),
    flag: new Array(cap).fill(null), used: 0, spareStart: base,
  };

  const setType = (i, id) => {
    const ti = addType(id);
    const ty = CATALOGUE[id];
    I.typeIndex[i] = ti;
    const sz = ty.size * (tiny ? 0.5 : 1);
    I.size[i] = sz;
    X.height[i] = ty.height * (tiny ? 0.5 : 1);
    X.radius[i] = sz * TUNE.itemRadiusK;
    X.mass[i] = ty.mass || 1;
    X.food[i] = ty.food ? 1 : 0;
  };

  const groundFor = (x, z, r) => {
    let y = terrain.heightAt(x, z);
    const ci = col.containing(x, z, 0);
    if (ci >= 0 && col.top[ci] - y < 1.5) y = Math.max(y, col.top[ci]);
    return y;
  };

  const place = (i, id, x, z, rot, golden, hidden, flag) => {
    setType(i, id);
    I.x[i] = I.px[i] = X.ox[i] = x;
    I.z[i] = I.pz[i] = X.oz[i] = z;
    const gy = groundFor(x, z, X.radius[i]);
    X.baseY[i] = gy;
    I.y[i] = I.py[i] = gy;
    I.rotY[i] = rot;
    I.golden[i] = golden ? 1 : 0;
    I.state[i] = hidden ? IS_HIDDEN : IS_IDLE;
    I.scale[i] = 1;
    X.flag[i] = flag || null;
    X.wet[i] = terrain.hasWater && gy < terrain.maxLevel ? 1 : 0;
  };

  let k = 0;
  for (const a of anchors) {
    const id = typeIdOf(a.type || a);
    if (!CATALOGUE[id]) { S.warn(`unknown anchor item type '${id}'`); continue; }
    place(k++, id, +a.x || 0, +a.z || 0, a.rot != null ? +a.rot : prng.range(0, Math.PI * 2), !!a.golden, !!a.hidden, a.flag);
  }
  const b = terrain.bounds;
  for (const f of fills) {
    const ids = (f.types || []).map(typeIdOf).filter((id) => CATALOGUE[id]);
    const cnt = Math.max(0, f.count | 0);
    if (!ids.length) { S.warn(`fill with no known types`); continue; }
    const reg = f.region || { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
    const isCircle = reg.r != null;
    for (let c = 0; c < cnt; c++) {
      const id = prng.pick(ids);
      const ty = CATALOGUE[id];
      const r = ty.size * TUNE.itemRadiusK * (tiny ? 0.5 : 1);
      let x = 0, z = 0, ok = false;
      for (let attempt = 0; attempt < 14 && !ok; attempt++) {
        if (isCircle) {
          const a = prng.range(0, Math.PI * 2), d = Math.sqrt(prng.next()) * reg.r;
          x = reg.x + Math.sin(a) * d; z = reg.z + Math.cos(a) * d;
        } else { x = prng.range(reg.minX, reg.maxX); z = prng.range(reg.minZ, reg.maxZ); }
        if (!terrain.inBounds(x, z, -r)) continue;
        if (col.containing(x, z, r * 0.8) >= 0) continue;
        if (f.avoidWater && terrain.hasWater && terrain.heightAt(x, z) < terrain.maxLevel + 0.02) continue;
        // keep a little personal space from earlier items (soft: last attempts accept)
        if (attempt < 10) {
          let clash = false;
          for (let j = Math.max(0, k - 400); j < k; j++) {
            const dx = I.x[j] - x, dz = I.z[j] - z, rr = (X.radius[j] + r) * 0.75;
            if (dx * dx + dz * dz < rr * rr) { clash = true; break; }
          }
          if (clash) continue;
        }
        ok = true;
      }
      if (!ok) S.debug.fillRejects++;
      place(k++, id, x, z, prng.range(0, Math.PI * 2), false, false, null);
    }
  }
  X.used = k;
  // Spare slots: gone, typed as the first type so render buckets stay valid.
  for (let i = k; i < cap; i++) { I.typeIndex[i] = 0; I.state[i] = IS_GONE; I.scale[i] = 0; }

  // ---- dynamic grid ----
  const area = (b.maxX - b.minX + 40) * (b.maxZ - b.minZ + 40);
  const cell = Math.min(64, Math.max(1, Math.sqrt(area / 4096)));
  const gx0 = b.minX - 20, gz0 = b.minZ - 20;
  const gw = Math.max(1, Math.ceil((b.maxX - b.minX + 40) / cell));
  const gh = Math.max(1, Math.ceil((b.maxZ - b.minZ + 40) / cell));
  const cStart = new Int32Array(gw * gh + 1);
  const cFill = new Int32Array(gw * gh + 1);
  const cList = new Int32Array(cap);
  const cellOf = new Int32Array(cap);
  const big = new Int32Array(cap);
  let nBig = 0;
  const hits = new Int32Array(cap);
  const G = { cell, dirty: true, hits, nHits: 0 };

  const cx = (x) => { const v = Math.floor((x - gx0) / cell); return v < 0 ? 0 : v >= gw ? gw - 1 : v; };
  const cz = (z) => { const v = Math.floor((z - gz0) / cell); return v < 0 ? 0 : v >= gh ? gh - 1 : v; };

  function rebuild() {
    cStart.fill(0);
    nBig = 0;
    const st = I.state;
    for (let i = 0; i < cap; i++) {
      const s = st[i];
      if (s >= IS_GOBBLING) { cellOf[i] = -1; continue; }
      if (X.radius[i] > cell) { big[nBig++] = i; cellOf[i] = -1; continue; }
      const c = cz(I.z[i]) * gw + cx(I.x[i]);
      cellOf[i] = c; cStart[c + 1]++;
    }
    for (let c = 0; c < gw * gh; c++) cStart[c + 1] += cStart[c];
    cFill.set(cStart);
    for (let i = 0; i < cap; i++) { const c = cellOf[i]; if (c >= 0) cList[cFill[c]++] = i; }
    G.dirty = false;
  }

  // Items whose footprint may lie within r of (x, z): small ones from the grid,
  // big ones by brute force. Results in G.hits[0..n).
  function query(x, z, r) {
    if (G.dirty) rebuild();
    let n = 0;
    const rr = r + cell;
    const x0 = cx(x - rr), x1 = cx(x + rr), z0 = cz(z - rr), z1 = cz(z + rr);
    for (let gz = z0; gz <= z1; gz++) {
      const row = gz * gw;
      for (let gxx = x0; gxx <= x1; gxx++) {
        const c = row + gxx;
        for (let j = cStart[c], e = cStart[c + 1]; j < e; j++) hits[n++] = cList[j];
      }
    }
    for (let j = 0; j < nBig; j++) {
      const i = big[j];
      if (I.state[i] >= IS_GOBBLING) continue;
      const dx = I.x[i] - x, dz = I.z[i] - z, lim = r + X.radius[i];
      if (dx * dx + dz * dz <= lim * lim) hits[n++] = i;
    }
    G.nHits = n;
    return n;
  }

  // ---- interactions ----
  function wobble(i, amount, dirX, dirZ) {
    const s = I.state[i];
    if (s !== IS_IDLE && s !== IS_WOBBLE) return;
    I.state[i] = IS_WOBBLE;
    if (dirX !== 0 || dirZ !== 0) I.tiltAxis[i] = Math.atan2(dirX, dirZ);
    const v = X.tiltVel[i] + amount / Math.sqrt(Math.max(0.2, X.mass[i]));
    X.tiltVel[i] = v > 6 ? 6 : v < -6 ? -6 : v;
  }

  function knock(i, vx, vy, vz) {
    const s = I.state[i];
    if (s >= IS_GOBBLING) return;
    I.state[i] = IS_TUMBLE;
    I.anim[i] = 0;
    X.vx[i] = vx; X.vy[i] = vy; X.vz[i] = vz;
    const sp = Math.hypot(vx, vz);
    if (sp > 1e-4) I.tiltAxis[i] = Math.atan2(vx, vz);
    X.spin[i] = (S.rngFx.next() - 0.5) * 8;
    X.tiltVel[i] = 2 + sp / Math.max(0.1, I.size[i]) * 0.6;
    G.dirty = true;
  }

  function vcap(i) { return TUNE.itemVcapK * Math.pow(Math.max(0.03, I.size[i]), 0.85) + 2; }

  // Grab a spare slot (or a gone non-anchor) for a new item of this type.
  function spawn(id, x, z, opts) {
    if (!CATALOGUE[id]) return -1;
    let slot = -1;
    for (let i = X.spareStart; i < cap; i++) if (I.state[i] === IS_GONE) { slot = i; break; }
    if (slot < 0) return -1;
    const prevType = I.typeIndex[slot];
    place(slot, id, x, z, S.rngFx.range(0, Math.PI * 2), opts && opts.golden, false, null);
    if (opts && opts.size) { I.size[slot] = opts.size; X.radius[slot] = opts.size * TUNE.itemRadiusK; X.height[slot] = opts.size * 0.6; }
    if (prevType !== I.typeIndex[slot] || (opts && opts.size)) I.version++;
    if (opts && opts.drop) {
      I.y[slot] = I.py[slot] = I.y[slot] + Math.max(0.5, I.size[slot] * 2);
      knock(slot, 0, 0, 0);
    }
    I.anim[slot] = 0;
    G.dirty = true;
    return slot;
  }

  const res = { x: 0, z: 0, support: 0, hit: 0, nx: 0, nz: 0, hitIndex: -1 };

  function step(dt) {
    I.px.set(I.x); I.py.set(I.y); I.pz.set(I.z);
    const st = I.state;
    const p = S.state.player;
    const t = S.state.time;
    const wobK = TUNE.wobbleFreq * Math.PI * 2;
    for (let i = 0; i < cap; i++) {
      const s = st[i];
      if (s === IS_IDLE) {
        if (X.wet[i]) {
          const wl = terrain.waterAt(I.x[i], I.z[i]);
          const fy = wl - X.height[i] * 0.3 + Math.sin(t * 2 + i) * 0.02 * Math.min(1, I.size[i] * 4);
          I.y[i] = fy > X.baseY[i] ? fy : X.baseY[i];
        }
        continue;
      }
      if (s === IS_WOBBLE) {
        I.anim[i] += dt;
        const f = wobK / Math.sqrt(Math.max(0.3, Math.sqrt(X.mass[i])));
        X.tiltVel[i] += (-f * f * I.tilt[i] - 2 * 0.22 * f * X.tiltVel[i]) * dt;
        I.tilt[i] += X.tiltVel[i] * dt;
        if (I.tilt[i] > 1.2) { I.tilt[i] = 1.2; X.tiltVel[i] *= -0.3; }
        if (I.tilt[i] < -1.2) { I.tilt[i] = -1.2; X.tiltVel[i] *= -0.3; }
        if (Math.abs(I.tilt[i]) < 0.003 && Math.abs(X.tiltVel[i]) < 0.02) { I.tilt[i] = 0; X.tiltVel[i] = 0; st[i] = IS_IDLE; I.anim[i] = 0; }
        continue;
      }
      if (s === IS_TUMBLE) { stepTumble(i, dt); continue; }
      if (s === IS_GOBBLING) {
        I.anim[i] += dt / TUNE.pullTime;
        let u = I.anim[i];
        if (u >= 1) {
          st[i] = IS_GONE; I.scale[i] = 0; I.anim[i] = 0;
          S.completed[S.nCompleted++] = i;
          continue;
        }
        const e = u * u * (3 - 2 * u);
        const eff = p.size;
        const mx = p.x + Math.sin(p.yaw) * eff * 0.38, mz = p.z + Math.cos(p.yaw) * eff * 0.38;
        const my = p.y + eff * 0.3;
        const ctrlY = Math.max(X.sy[i], my) + eff * 0.35 + I.size[i] * 0.5;
        const v = 1 - e;
        I.x[i] = v * v * X.sx[i] + 2 * v * e * ((X.sx[i] + mx) * 0.5) + e * e * mx;
        I.z[i] = v * v * X.sz[i] + 2 * v * e * ((X.sz[i] + mz) * 0.5) + e * e * mz;
        I.y[i] = v * v * X.sy[i] + 2 * v * e * ctrlY + e * e * my;
        // squish: a little overshoot, then shrink to nothing
        I.scale[i] = u < 0.2 ? 1 + u * 0.75 : 1.15 * (1 - (u - 0.2) / 0.8) * (1 - (u - 0.2) / 0.8) + 0.0;
        I.rotY[i] += dt * 14;
        I.tilt[i] = u * 1.2;
      }
    }
  }

  function stepTumble(i, dt) {
    I.anim[i] += dt;
    if (X.grace[i] > 0) X.grace[i] -= dt;
    const size = Math.max(0.03, I.size[i]);
    const g = TUNE.itemGravityK * Math.sqrt(size) * S.gravityScale;
    X.vy[i] -= g * dt;
    let vx = X.vx[i], vy = X.vy[i], vz = X.vz[i];
    // velocity cap (and launch detection for the bots)
    const sp = Math.hypot(vx, vy, vz);
    const cap_ = vcap(i);
    if (sp > cap_) {
      if (sp > cap_ * 1.5) S.debug.launches++;
      if (sp > S.debug.maxItemSpeedRatio * cap_) S.debug.maxItemSpeedRatio = sp / cap_;
      const k = cap_ / sp; vx *= k; vy *= k; vz *= k;
    }
    let x = I.x[i] + vx * dt, z = I.z[i] + vz * dt, y = I.y[i] + vy * dt;
    const r = X.radius[i], h = X.height[i];
    // static colliders
    col.resolve(x, z, r * 0.8, y, h, h * 0.4 + 0.02, 0, res);
    if (res.hit) {
      x = res.x; z = res.z;
      const vn = vx * res.nx + vz * res.nz;
      if (vn < 0) { vx -= 1.4 * vn * res.nx; vz -= 1.4 * vn * res.nz; }
    }
    // bounds
    const bd = terrain.bounds;
    if (x < bd.minX) { x = bd.minX; vx = Math.abs(vx) * 0.4; }
    if (x > bd.maxX) { x = bd.maxX; vx = -Math.abs(vx) * 0.4; }
    if (z < bd.minZ) { z = bd.minZ; vz = Math.abs(vz) * 0.4; }
    if (z > bd.maxZ) { z = bd.maxZ; vz = -Math.abs(vz) * 0.4; }
    let ground = terrain.heightAt(x, z);
    if (res.support > ground) ground = res.support;
    let floating = false;
    if (X.wet[i] || terrain.hasWater) {
      const wl = terrain.waterAt(x, z);
      if (wl - h * 0.3 > ground) { ground = wl - h * 0.3; floating = true; }
    }
    let onGround = false;
    if (y <= ground) {
      y = ground;
      if (vy < -1.2 * Math.sqrt(size)) {
        vy = -vy * (floating ? 0.1 : TUNE.itemRestitution);
        X.spin[i] *= 0.7;
      } else { vy = 0; onGround = true; }
      const fr = Math.exp(-(floating ? 2.5 : TUNE.itemFriction) * dt);
      vx *= fr; vz *= fr;
    }
    X.vx[i] = vx; X.vy[i] = vy; X.vz[i] = vz;
    if (I.x[i] !== x || I.z[i] !== z) G.dirty = true;
    I.x[i] = x; I.y[i] = y; I.z[i] = z;
    I.rotY[i] += X.spin[i] * dt;
    // tilt rolls with the motion, then the spring takes over when settled
    const hs = Math.hypot(vx, vz);
    I.tilt[i] += X.tiltVel[i] * dt * (onGround ? Math.min(1, hs / (size * 2 + 0.1)) : 1);
    if (I.tilt[i] > Math.PI) I.tilt[i] -= Math.PI * 2;
    if (I.tilt[i] < -Math.PI) I.tilt[i] += Math.PI * 2;
    // domino knocks
    if (hs > 0.6 * Math.sqrt(size)) {
      const n = query(x, z, r * 1.2);
      for (let j = 0; j < n; j++) {
        const o = hits[j];
        if (o === i) continue;
        const so = I.state[o];
        if (so !== IS_IDLE && so !== IS_WOBBLE) continue;
        const dx = I.x[o] - x, dz = I.z[o] - z;
        const rr = X.radius[o] + r;
        const d2 = dx * dx + dz * dz;
        if (d2 > rr * rr) continue;
        if (Math.abs(I.y[o] - y) > Math.max(h, X.height[o]) + 0.1) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const nx = dx / d, nz = dz / d;
        const along = vx * nx + vz * nz;
        if (along <= 0) continue;
        if (I.size[o] <= size * 1.6 && X.mass[o] <= X.mass[i] * 3) {
          const tr = 0.55 * Math.min(1, X.mass[i] / Math.max(0.1, X.mass[o]));
          knock(o, nx * along * tr + vx * 0.15, along * tr * 0.4, nz * along * tr + vz * 0.15);
          X.grace[o] = 0;
          vx -= nx * along * 0.5; vz -= nz * along * 0.5;
          S.debug.dominoes++;
        } else {
          wobble(o, along * 0.6 / Math.max(0.2, I.size[o]), nx, nz);
          vx -= nx * along * 1.3; vz -= nz * along * 1.3;
        }
        X.vx[i] = vx; X.vz[i] = vz;
      }
    }
    // settle
    if (onGround && hs < 0.08 * Math.sqrt(size) + 0.02 && I.anim[i] > 0.15) {
      X.vx[i] = X.vy[i] = X.vz[i] = 0;
      X.baseY[i] = ground;
      X.wet[i] = terrain.hasWater && ground < terrain.maxLevel ? 1 : 0;
      // fall back upright through a wobble
      let tl = I.tilt[i] % (Math.PI * 2);
      if (tl > Math.PI) tl -= Math.PI * 2;
      if (tl < -Math.PI) tl += Math.PI * 2;
      I.tilt[i] = tl > 1 ? 1 : tl < -1 ? -1 : tl;
      X.tiltVel[i] = 0;
      I.state[i] = IS_WOBBLE; I.anim[i] = 0;
      G.dirty = true;
    }
  }

  // Put an item back in the world (zoomies waves, hidden reveals).
  function reveal(i, pop) {
    if (I.state[i] !== IS_GONE && I.state[i] !== IS_HIDDEN) return;
    I.x[i] = I.px[i] = X.ox[i]; I.z[i] = I.pz[i] = X.oz[i];
    I.y[i] = I.py[i] = X.baseY[i] + (pop ? Math.max(0.3, I.size[i] * 1.5) : 0);
    I.scale[i] = 1; I.tilt[i] = 0; X.tiltVel[i] = 0;
    I.state[i] = IS_IDLE;
    if (pop) knock(i, 0, 0, 0);
    G.dirty = true;
  }

  return { I, X, G, query, rebuild, wobble, knock, spawn, step, reveal, vcap, addType, cap, get nBig() { return nBig; } };
}
