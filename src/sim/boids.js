// Pigeon and gull flocks: they peck about on the ground, scatter as boids when
// you come close or bark (PIGEON_SCARE), wheel about, then settle back home.
// The capybara's chill aura freezes them mid-strut. Grumpy pigeon squads
// (hazard 'pigeons') swoop at you now and then.
import { EV } from '../core/events.js';

export const BIRD_KINDS = ['pigeon', 'gull'];
export const BIRD_GROUND = 0, BIRD_FLY = 1, BIRD_FROZEN = 2, BIRD_LAND = 3, BIRD_SWOOP = 4;
const MAX_BIRDS = 64;

export function createBirds(S) {
  const flocks = [];
  const defs = (S.world.flocks || []).slice();
  for (const h of S.world.hazards || []) if (h && h.kind === 'pigeons') defs.push({ kind: 'pigeon', count: h.count || 5, x: h.x, z: h.z, r: h.r || 3, squad: true, hazard: h });
  let total = 0;
  for (const f of defs) total += Math.max(0, f.count | 0);
  const cap = Math.min(MAX_BIRDS, total);
  const B = {
    count: cap, kinds: BIRD_KINDS,
    x: new Float32Array(cap), y: new Float32Array(cap), z: new Float32Array(cap),
    px: new Float32Array(cap), py: new Float32Array(cap), pz: new Float32Array(cap),
    vx: new Float32Array(cap), vy: new Float32Array(cap), vz: new Float32Array(cap),
    yaw: new Float32Array(cap), kind: new Uint8Array(cap), state: new Uint8Array(cap),
  };
  const X = { flock: new Uint8Array(cap), t: new Float32Array(cap), tx: new Float32Array(cap), tz: new Float32Array(cap) };
  const rng = S.rng.fork('birds');
  let k = 0;
  for (let fi = 0; fi < defs.length && k < cap; fi++) {
    const f = defs[fi];
    const fl = { kind: f.kind === 'gull' ? 1 : 0, x: +f.x || 0, z: +f.z || 0, r: +f.r || 4, squad: !!f.squad, hazardDef: f.hazard || null, swoopT: rng.range(4, 9), first: k, n: 0, hazardIndex: -1 };
    flocks.push(fl);
    for (let j = 0; j < (f.count | 0) && k < cap; j++, k++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * fl.r;
      B.x[k] = B.px[k] = fl.x + Math.sin(a) * d; B.z[k] = B.pz[k] = fl.z + Math.cos(a) * d;
      B.y[k] = B.py[k] = S.terrain.heightAt(B.x[k], B.z[k]);
      B.kind[k] = fl.kind; B.yaw[k] = rng.range(-Math.PI, Math.PI);
      X.flock[k] = fi; X.t[k] = rng.range(0, 3);
      fl.n++;
    }
  }
  return { B, X, flocks, rng };
}

export function stepBirds(S, dt) {
  const Bd = S.birds; if (!Bd) return;
  const { B, X, flocks, rng } = Bd;
  const n = B.count;
  if (!n) return;
  const p = S.state.player, M = S.sigMods, T = S.terrain;
  B.px.set(B.x); B.py.set(B.y); B.pz.set(B.z);
  const sprintK = p.sprinting ? 1.5 : 1;
  const scareR = (1.4 + p.size * 2.6) * sprintK;
  const barkR = 6 + p.size * 7;
  const barked = S.run.barked;
  let scared = 0;
  for (let fi = 0; fi < flocks.length; fi++) {
    const fl = flocks[fi];
    // flock centre and mean velocity (flying birds only)
    let cx = 0, cy = 0, cz = 0, ax = 0, az = 0, nf = 0;
    for (let i = fl.first; i < fl.first + fl.n; i++) {
      if (B.state[i] !== BIRD_FLY) continue;
      cx += B.x[i]; cy += B.y[i]; cz += B.z[i]; ax += B.vx[i]; az += B.vz[i]; nf++;
    }
    if (nf) { cx /= nf; cy /= nf; cz /= nf; ax /= nf; az /= nf; }
    // squad swoops
    if (fl.squad) {
      fl.swoopT -= dt;
      const pd = Math.hypot(p.x - fl.x, p.z - fl.z);
      const calm = M.calmR > 0 && Math.hypot(fl.x - M.calmX, fl.z - M.calmZ) < M.calmR + fl.r;
      if (fl.swoopT <= 0 && pd < 12 + p.size * 4 && !calm && S.state.phase === 'play') {
        fl.swoopT = rng.range(6, 11) * (S.assist ? 2 : 1);
        for (let i = fl.first; i < fl.first + fl.n; i++) {
          if (B.state[i] === BIRD_FROZEN) continue;
          B.state[i] = BIRD_SWOOP; X.t[i] = 2.2;
          B.vy[i] = 3;
        }
      }
    }
    const homeY = T.heightAt(fl.x, fl.z);
    const cruise = homeY + 4 + p.size * 1.5 + (fl.kind === 1 ? 4 : 0);
    for (let i = fl.first; i < fl.first + fl.n; i++) {
      const s = B.state[i];
      const dx = B.x[i] - p.x, dz = B.z[i] - p.z;
      const d = Math.hypot(dx, dz);
      const inCalm = M.calmR > 0 && Math.hypot(B.x[i] - M.calmX, B.z[i] - M.calmZ) < M.calmR;
      if (s === BIRD_GROUND || s === BIRD_FROZEN) {
        if (inCalm) { B.state[i] = BIRD_FROZEN; B.vx[i] = B.vz[i] = 0; continue; }
        if (s === BIRD_FROZEN) B.state[i] = BIRD_GROUND;
        if (d < scareR || (barked && d < barkR)) {
          B.state[i] = BIRD_FLY; scared++;
          const inv = 1 / (d || 1);
          const sp = 4 + rng.next() * 3 + p.size;
          B.vx[i] = dx * inv * sp + rng.range(-1, 1); B.vz[i] = dz * inv * sp + rng.range(-1, 1);
          B.vy[i] = 3 + rng.next() * 3 + p.size * 0.5;
          X.t[i] = rng.range(4, 8);
          continue;
        }
        // pecking about
        X.t[i] -= dt;
        if (X.t[i] <= 0) {
          X.t[i] = rng.range(0.8, 3);
          const a = rng.range(0, Math.PI * 2);
          const hx = fl.x - B.x[i], hz = fl.z - B.z[i];
          const back = Math.hypot(hx, hz) > fl.r ? 0.6 : 0;
          const sp = rng.chance(0.4) ? 0 : 0.35;
          B.vx[i] = (Math.sin(a) + hx * back) * sp; B.vz[i] = (Math.cos(a) + hz * back) * sp;
        }
        B.x[i] += B.vx[i] * dt; B.z[i] += B.vz[i] * dt;
        B.y[i] = T.heightAt(B.x[i], B.z[i]);
        if (B.vx[i] || B.vz[i]) B.yaw[i] = Math.atan2(B.vx[i], B.vz[i]);
        continue;
      }
      if (s === BIRD_SWOOP) {
        X.t[i] -= dt;
        // dive at the player, then peel away
        const tx = p.x - B.x[i], ty = p.y + S.derived.height * 0.7 - B.y[i], tz = p.z - B.z[i];
        const tl = Math.hypot(tx, ty, tz) || 1;
        const sp = 7 + p.size * 2;
        B.vx[i] += (tx / tl * sp - B.vx[i]) * Math.min(1, 3 * dt);
        B.vy[i] += (ty / tl * sp - B.vy[i]) * Math.min(1, 3 * dt);
        B.vz[i] += (tz / tl * sp - B.vz[i]) * Math.min(1, 3 * dt);
        if (tl < S.derived.radius + 0.3 && S.touchHazard && fl.hazardIndex >= 0) {
          S.touchHazard(fl.hazardIndex, B.x[i], B.z[i], 0.5);
          X.t[i] = 0;
        }
        if (X.t[i] <= 0 || (inCalm)) { B.state[i] = BIRD_FLY; X.t[i] = rng.range(2, 4); B.vy[i] = 4; }
      } else if (s === BIRD_FLY) {
        X.t[i] -= dt;
        // boids: cohesion, alignment, separation, plus a pull home at cruise height
        let sx = 0, sz = 0, sy = 0;
        for (let j = fl.first; j < fl.first + fl.n; j++) {
          if (j === i || B.state[j] !== BIRD_FLY) continue;
          const ox = B.x[i] - B.x[j], oy = B.y[i] - B.y[j], oz = B.z[i] - B.z[j];
          const o2 = ox * ox + oy * oy + oz * oz;
          if (o2 < 1.2 && o2 > 1e-6) { sx += ox / o2; sy += oy / o2; sz += oz / o2; }
        }
        const k = Math.min(1, dt * 1.5);
        let fx = 0, fy = 0, fz = 0;
        if (nf > 1) { fx += (cx - B.x[i]) * 0.6 + (ax - B.vx[i]) * 0.8; fz += (cz - B.z[i]) * 0.6 + (az - B.vz[i]) * 0.8; fy += (cy - B.y[i]) * 0.4; }
        fx += sx * 1.5; fy += sy * 1.5; fz += sz * 1.5;
        // orbit home
        const hx = fl.x - B.x[i], hz = fl.z - B.z[i];
        const hd = Math.hypot(hx, hz) || 1;
        fx += hx / hd * Math.min(4, hd * 0.25) + (-hz / hd) * 2.5;
        fz += hz / hd * Math.min(4, hd * 0.25) + (hx / hd) * 2.5;
        fy += (cruise - B.y[i]) * 1.2;
        // keep away from the player
        if (d < scareR * 1.5) { fx += dx / (d || 1) * 6; fz += dz / (d || 1) * 6; }
        B.vx[i] += fx * k; B.vy[i] += fy * k; B.vz[i] += fz * k;
        const v = Math.hypot(B.vx[i], B.vy[i], B.vz[i]);
        const vmax = 8 + p.size * 0.8;
        if (v > vmax) { B.vx[i] *= vmax / v; B.vy[i] *= vmax / v; B.vz[i] *= vmax / v; }
        if (X.t[i] <= 0 && d > scareR * 2) {
          B.state[i] = BIRD_LAND;
          const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * fl.r;
          X.tx[i] = fl.x + Math.sin(a) * r; X.tz[i] = fl.z + Math.cos(a) * r;
        }
      } else if (s === BIRD_LAND) {
        const tx = X.tx[i] - B.x[i], tz = X.tz[i] - B.z[i];
        const gy = T.heightAt(B.x[i], B.z[i]);
        const td = Math.hypot(tx, tz) || 1;
        const sp = Math.min(6, td * 1.5 + 0.5);
        B.vx[i] += (tx / td * sp - B.vx[i]) * Math.min(1, 3 * dt);
        B.vz[i] += (tz / td * sp - B.vz[i]) * Math.min(1, 3 * dt);
        B.vy[i] = (gy - B.y[i]) * (td < 2 ? 3 : 0.6);
        if (d < scareR) { B.state[i] = BIRD_FLY; X.t[i] = rng.range(3, 6); B.vy[i] = 4; }
        if (td < 0.3 && B.y[i] - gy < 0.15) { B.state[i] = BIRD_GROUND; B.y[i] = gy; B.vx[i] = B.vy[i] = B.vz[i] = 0; X.t[i] = rng.range(0.5, 2); continue; }
      }
      B.x[i] += B.vx[i] * dt; B.y[i] += B.vy[i] * dt; B.z[i] += B.vz[i] * dt;
      const gy = T.heightAt(B.x[i], B.z[i]);
      if (B.y[i] < gy) { B.y[i] = gy; if (B.vy[i] < 0) B.vy[i] = 0; }
      const bd = T.bounds, m = 30;
      if (B.x[i] < bd.minX - m) B.vx[i] = Math.abs(B.vx[i]); if (B.x[i] > bd.maxX + m) B.vx[i] = -Math.abs(B.vx[i]);
      if (B.z[i] < bd.minZ - m) B.vz[i] = Math.abs(B.vz[i]); if (B.z[i] > bd.maxZ + m) B.vz[i] = -Math.abs(B.vz[i]);
      if (B.vx[i] || B.vz[i]) B.yaw[i] = Math.atan2(B.vx[i], B.vz[i]);
    }
  }
  if (scared > 0) {
    S.run.pigeonsScared += scared;
    S.emit({ type: EV.PIGEON_SCARE, count: scared, x: p.x, z: p.z });
  }
}
