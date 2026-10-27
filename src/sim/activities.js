// Mini-games: fetch, pigeon herding, sniff trail and sit-stay. One at a time,
// each with start, success and fail events and a Biccies reward.
import { EV } from '../core/events.js';
import { CATALOGUE } from '../worlds/catalogue.js';
import { compileRegion, inRegion, normPath } from './util.js';
import { throwBall } from './npcs.js';
import { IS_GONE, IS_GOBBLING } from './items.js';

export const ACTIVITY_KINDS = ['fetch', 'herding', 'sniffTrail', 'sitStay'];

export function createActivities(S) {
  const rng = S.rng.fork('activities');
  const list = [];
  for (const a of S.world.activities || []) {
    if (!a || !ACTIVITY_KINDS.includes(a.kind)) continue;
    const params = a.params || {};
    const A = { kind: a.kind, x: +a.x || 0, z: +a.z || 0, params, cd: 0, pigeons: [], slots: [] };
    if (a.kind === 'herding') {
      const c = Math.max(1, Math.min(10, params.count || 6));
      for (let k = 0; k < c; k++) {
        const n = S.npcs.add({ id: `herd${list.length}_${k}`, mesh: 'pigeon', human: false, x: A.x, z: A.z, behaviour: 'idle', visible: false });
        n.hazard = -2; n.solid = false;
        A.pigeons.push(n);
      }
      A.ring = compileRegion(params.ring || { x: A.x + 6, z: A.z, r: 2.5 }, 2.5);
    }
    list.push(A);
  }
  S.npcs.reindex();
  return { list, rng, cur: null, endT: 0 };
}

function start(S, A, extra) {
  const Ac = S.activities;
  Ac.cur = A;
  S.state.activity = { kind: A.kind, phase: 'active', t: 0, score: 0, x: A.x, z: A.z, target: 0, ...extra };
  S.emit({ type: EV.ACTIVITY, kind: A.kind, phase: 'start', x: A.x, z: A.z });
}

function finish(S, A, ok, reward) {
  const act = S.state.activity;
  act.phase = ok ? 'success' : 'fail';
  if (ok) S.run.biccies += reward;
  S.emit({ type: EV.ACTIVITY, kind: A.kind, phase: ok ? 'success' : 'fail', reward: ok ? reward : 0 });
  A.cd = 20;
  S.activities.cur = null;
  S.activities.endT = 2;
  S.run.activitiesDone += ok ? 1 : 0;
}

export function stepActivities(S, dt) {
  const Ac = S.activities; if (!Ac || !Ac.list.length) return;
  const st = S.state, p = st.player, R = S.run;
  for (let k = 0; k < Ac.list.length; k++) if (Ac.list[k].cd > 0) Ac.list[k].cd -= dt;
  if (!Ac.cur && st.activity && Ac.endT > 0) { Ac.endT -= dt; if (Ac.endT <= 0) st.activity = null; }
  if (st.phase !== 'play') return;
  const playBowNow = p.playBow && !R.playBowWas;
  R.playBowWas = p.playBow;
  if (!Ac.cur) {
    if (st.activity && Ac.endT > 0) return;
    for (let k = 0; k < Ac.list.length; k++) {
      const A = Ac.list[k];
      if (A.cd > 0) continue;
      const d = Math.hypot(p.x - A.x, p.z - A.z);
      const r = +(A.params.r || 3) + p.size;
      if (A.kind === 'fetch') {
        if (A.thrower === undefined) A.thrower = S.npcs.index(A.params.thrower || 'marco') || S.npcs.list.find((n) => n.behaviour === 'marco') || null;
        const thrower = A.thrower;
        const td = thrower ? Math.hypot(p.x - thrower.x, p.z - thrower.z) : Infinity;
        if (playBowNow && (d < r * 2 || td < 5 + p.size * 2)) {
          const from = thrower || { x: A.x, y: S.terrain.heightAt(A.x, A.z), z: A.z, yaw: 0 };
          const yaw = Math.atan2(p.x - from.x, p.z - from.z) + Ac.rng.range(-0.5, 0.5);
          let ball;
          if (thrower) ball = throwBall(S, thrower, yaw, 8 + p.size * 2);
          start(S, A, { ball: ball == null ? -1 : ball, thrower: thrower ? thrower.id : null });
          return;
        }
      } else if (A.kind === 'herding') {
        if (R.barked && d < r * 2) {
          for (let k = 0; k < A.pigeons.length; k++) {
            const n = A.pigeons[k];
            const a = (k / A.pigeons.length) * Math.PI * 2;
            n.x = n.px = A.x + Math.sin(a) * 2.5; n.z = n.pz = A.z + Math.cos(a) * 2.5;
            n.y = S.terrain.heightAt(n.x, n.z); n.visible = true; n.anim = 'peck';
          }
          start(S, A, { target: A.pigeons.length, ring: { x: A.ring.x, z: A.ring.z, r: A.ring.r } });
          return;
        }
      } else if (A.kind === 'sniffTrail') {
        if (d < r) { startTrail(S, A); return; }
      } else if (A.kind === 'sitStay') {
        if (d < r && R.stillT > 1) {
          const n = S.npcs.index(A.params.npc || 'gerald');
          if (n) { n.anim = 'wave'; n.holdT = 99; }
          start(S, A, { target: +(A.params.time || 6) });
          return;
        }
      }
    }
    return;
  }
  const A = Ac.cur, act = st.activity;
  act.t += dt;
  if (A.kind === 'fetch') {
    const P = S.npcs.P, b = act.ball;
    const limit = +(A.params.time || 10);
    if (b >= 0 && P.kind[b] === 1) {
      const dy = P.y[b] - (p.y + S.derived.height * 0.6);
      const dd = Math.hypot(P.x[b] - p.x, dy, P.z[b] - p.z);
      if (dd < S.derived.reachBase + 0.35) {
        const gy = S.terrain.heightAt(P.x[b], P.z[b]);
        const airborne = P.y[b] > gy + 0.3;
        const peak = airborne && Math.abs(P.vy[b]) < 2.5;
        P.kind[b] = 0;
        act.score = peak ? 3 : airborne ? 2 : 1;
        finish(S, A, true, +(A.params.reward || 10) * act.score);
        return;
      }
    } else if (b < 0 && act.t > 0.5) { finish(S, A, false, 0); return; }
    if (act.t > limit) { if (b >= 0) P.kind[b] = 0; finish(S, A, false, 0); }
  } else if (A.kind === 'herding') {
    let inRing = 0;
    const scare = 2.2 + p.size * 1.5;
    for (const n of A.pigeons) {
      const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz) || 1;
      let vx = 0, vz = 0;
      if (d < scare) { vx = dx / d * 2.2; vz = dz / d * 2.2; }
      if (R.barked && d < 7 + p.size * 3) { vx += dx / d * 5; vz += dz / d * 5; }
      const inside = inRegion(A.ring, n.x, n.z);
      if (inside) { vx *= 0.35; vz *= 0.35; inRing++; }
      n.x += vx * dt; n.z += vz * dt;
      const bd = S.terrain.bounds;
      n.x = Math.max(bd.minX, Math.min(bd.maxX, n.x)); n.z = Math.max(bd.minZ, Math.min(bd.maxZ, n.z));
      n.y = S.terrain.heightAt(n.x, n.z);
      if (vx || vz) { n.yaw = Math.atan2(vx, vz); n.anim = 'hop'; } else n.anim = 'peck';
    }
    act.score = inRing;
    if (inRing >= A.pigeons.length) { endHerd(A); finish(S, A, true, +(A.params.reward || 25)); }
    else if (act.t > +(A.params.time || 45)) { endHerd(A); finish(S, A, false, 0); }
  } else if (A.kind === 'sniffTrail') {
    let left = 0;
    for (const i of A.slots) if (S.I.state[i] !== IS_GONE) left++;
    act.score = A.slots.length - left;
    if (left === 0) finish(S, A, true, +(A.params.reward || 20));
    else if (act.t > +(A.params.time || 25)) {
      for (const i of A.slots) if (S.I.state[i] < IS_GOBBLING) { S.I.state[i] = IS_GONE; S.I.scale[i] = 0; S.items.G.dirty = true; }
      finish(S, A, false, 0);
    }
  } else if (A.kind === 'sitStay') {
    const n = S.npcs.index(A.params.npc || 'gerald');
    if (n) n.yaw = Math.atan2(p.x - n.x, p.z - n.z);
    act.score = act.t;
    const moved = R.inputMag > 0.15 || p.speed > 0.2 * p.size;
    if (moved) { if (n) n.holdT = 0; finish(S, A, false, 0); }
    else if (act.t >= act.target) { if (n) n.holdT = 0; finish(S, A, true, +(A.params.reward || 15)); }
  }
}

function endHerd(A) { for (const n of A.pigeons) { n.visible = false; } }

function startTrail(S, A) {
  const p = S.state.player;
  const cnt = Math.max(3, Math.min(16, A.params.count || 8));
  let type = A.params.item && CATALOGUE[A.params.item] ? A.params.item : null;
  if (!type) for (const t of S.I.types) if (CATALOGUE[t].food) { type = t; break; }
  if (!type) type = 'teamug';
  const path = normPath(A.params.path);
  A.slots.length = 0;
  const yaw0 = S.activities.rng.range(0, Math.PI * 2);
  const gap = 1.6 + p.size * 1.6;
  let x = A.x, z = A.z, yaw = yaw0;
  for (let k = 0; k < cnt; k++) {
    if (path) { const j = Math.min(path.length / 2 - 1, Math.floor((k / cnt) * (path.length / 2))); x = path[j * 2]; z = path[j * 2 + 1]; }
    else {
      yaw += S.activities.rng.range(-0.7, 0.7);
      let nx = x + Math.sin(yaw) * gap, nz = z + Math.cos(yaw) * gap;
      if (!S.terrain.inBounds(nx, nz, -2) || S.col.containing(nx, nz, 0.3) >= 0) { yaw += Math.PI * 0.6; nx = x + Math.sin(yaw) * gap; nz = z + Math.cos(yaw) * gap; }
      x = nx; z = nz;
    }
    const i = S.items.spawn(type, x, z, { size: Math.max(0.02, p.size * 0.3), drop: true });
    if (i >= 0) { S.X.flag[i] = 'trail'; A.slots.push(i); }
  }
  start(S, A, { target: A.slots.length });
}
