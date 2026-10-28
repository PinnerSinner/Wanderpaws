// Cast, crowd and critter NPCs. Living creatures are never gobbled: they idle,
// wander, loop paths, sell, react to you (flee, cheer, tut, wave), and Gerald
// hops ahead of you and flaps off when you get close. Marco jogs and throws a ball.
import { EV } from '../core/events.js';
import { angleDelta, wrapAngle } from '../core/math.js';
import { NPC_ANIMS_SET, normPath } from './util.js';
import { hypot } from './util.js';

const HUMAN_KINDS = new Set(['marco', 'kev', 'ze', 'pru', 'packet', 'hologrammarco', 'sunbather', 'jogger', 'cyclist', 'tourist', 'footvolleyer', 'vendor', 'kid', 'commuter', 'queuer', 'sentry', 'birdwatcher', 'hiker', 'piper', 'skier', 'curler', 'techie', 'reader']);
// height, radius (metres) for critters; humans are 1.75 x 0.3
const CRITTER_DIMS = {
  pigeon: [0.3, 0.15], gerald: [0.32, 0.16], nigel: [0.32, 0.16], gull: [0.35, 0.18], toucan: [0.5, 0.2],
  marmoset: [0.3, 0.15], squirrel: [0.25, 0.12], sloth: [0.6, 0.3], highlandcow: [1.5, 1.0], haggis: [0.3, 0.2],
  kitten: [0.25, 0.12], magpenguin: [0.6, 0.25], frog: [0.12, 0.08], duckling: [0.15, 0.08], butterfly: [0.05, 0], fox: [0.5, 0.25],
};
const REACT_ANIM = { flee: 'flee', cheer: 'cheer', tut: 'tut', wave: 'wave' };
export const PROJ_KINDS = ['none', 'ball', 'snowball'];

export function createNpcs(S) {
  const list = [];
  const rng = S.rng.fork('npcs');
  S.rngAI = rng;

  function add(def) {
    const kind = def.mesh || def.kind || 'tourist';
    const human = def.human != null ? !!def.human : (def.kind === 'human' || HUMAN_KINDS.has(kind));
    const dims = human ? [1.75, 0.3] : (CRITTER_DIMS[kind] || [0.4, 0.2]);
    const params = def.params || {};
    const perchY = +(params.perchY || 0);
    const y = S.terrain.heightAt(+def.x || 0, +def.z || 0) + perchY;
    const n = {
      id: def.id || `${kind}${list.length}`,
      kind, human,
      x: +def.x || 0, y, z: +def.z || 0, yaw: +def.yaw || 0,
      px: +def.x || 0, py: y, pz: +def.z || 0, pyaw: +def.yaw || 0,
      anim: 'idle', animT: 0, mood: 'neutral',
      speakerId: def.speaker || null,
      behaviour: def.behaviour || 'idle',
      visible: def.visible !== false,
      speed: 0,
      // internal
      params, hx: +def.x || 0, hz: +def.z || 0, tx: +def.x || 0, tz: +def.z || 0,
      t: 0, wait: rng.range(0.5, 3), pathIdx: 0, pathDir: 1,
      path: normPath(params.path || params.spots || def.path),
      baseAnim: params.anim || (NPC_ANIMS_SET.has(def.behaviour) ? def.behaviour : (def.behaviour === 'vendor' ? 'sell' : 'idle')),
      react: params.react || (def.behaviour === 'react' ? 'wave' : null),
      reactR: +(params.reactR || params.r || 3.5),
      reactT: 0, near: false, fleeT: 0, calm: 0,
      height: dims[0], radius: dims[1], solid: dims[1] > 0 && kind !== 'hologrammarco',
      perchY, fly: 0, flyFrom: null, state: 0, hazard: -1, throwT: +(params.throwEvery || 9),
      holdT: 0, hopT: 0, throwing: 0, rngA: 0, fx: 0, fz: 0, fy: 0, perches: null,
    };
    if (n.behaviour === 'marcoJog') n.behaviour = 'marco';
    if (n.behaviour === 'react' && params.react) n.react = params.react;
    if (perchY > 0.5) n.solid = false;
    if (n.behaviour === 'gerald' || kind === 'gerald') n.behaviour = n.behaviour === 'idle' ? 'gerald' : n.behaviour;
    n.anim = n.baseAnim;
    if (n.path && n.behaviour === 'pathLoop') { n.x = n.px = n.path[0]; n.z = n.pz = n.path[1]; n.pathIdx = 1; }
    list.push(n);
    return n;
  }

  for (const c of S.world.cast || []) add({ ...c, mesh: c.mesh || (c.kind !== 'human' && c.kind !== 'critter' ? c.kind : c.id) , human: c.kind === 'human' ? true : c.kind === 'critter' ? false : undefined });
  for (const c of S.world.crowd || []) add(c);

  const byId = new Map();
  for (const n of list) byId.set(n.id, n);

  // projectiles (Marco's ball, snowballs)
  const PN = 24;
  const P = {
    count: PN, kinds: PROJ_KINDS,
    kind: new Uint8Array(PN), x: new Float32Array(PN), y: new Float32Array(PN), z: new Float32Array(PN),
    px: new Float32Array(PN), py: new Float32Array(PN), pz: new Float32Array(PN),
    vx: new Float32Array(PN), vy: new Float32Array(PN), vz: new Float32Array(PN), t: new Float32Array(PN),
    owner: new Int16Array(PN).fill(-1),
  };

  return { list, byId, add, rng, P, index(id) { return byId.get(id) || null; }, reindex() { byId.clear(); for (const n of list) byId.set(n.id, n); } };
}

export function spawnProjectile(S, kind, x, y, z, vx, vy, vz, owner = -1) {
  const P = S.npcs.P;
  for (let i = 0; i < P.count; i++) {
    if (P.kind[i]) continue;
    P.kind[i] = kind; P.x[i] = P.px[i] = x; P.y[i] = P.py[i] = y; P.z[i] = P.pz[i] = z;
    P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz; P.t[i] = 0; P.owner[i] = owner;
    return i;
  }
  return -1;
}

export function stepProjectiles(S, dt) {
  const P = S.npcs.P, T = S.terrain;
  P.px.set(P.x); P.py.set(P.y); P.pz.set(P.z);
  for (let i = 0; i < P.count; i++) {
    if (!P.kind[i]) continue;
    P.t[i] += dt;
    const g = 9.8 * S.gravityScale;
    const gy = T.heightAt(P.x[i], P.z[i]);
    if (P.y[i] <= gy + 0.06 && P.vy[i] <= 0.01) {
      // resting / rolling
      P.vx[i] *= Math.exp(-3 * dt); P.vz[i] *= Math.exp(-3 * dt); P.vy[i] = 0; P.y[i] = gy + 0.05;
      if (P.kind[i] === 2 || P.t[i] > 12) { P.kind[i] = 0; continue; }
    } else P.vy[i] -= g * dt;
    P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
    if (P.y[i] < gy + 0.05) { P.y[i] = gy + 0.05; if (P.vy[i] < -2) P.vy[i] *= -0.4; else P.vy[i] = 0; }
  }
}

const res = { x: 0, z: 0, support: 0, hit: 0, nx: 0, nz: 0, hitIndex: -1 };

function moveToward(S, n, tx, tz, speed, dt) {
  const dx = tx - n.x, dz = tz - n.z;
  const d = hypot(dx, dz);
  if (d < 1e-4) { n.speed = 0; return 0; }
  const step = Math.min(d, speed * dt);
  const nx = n.x + (dx / d) * step, nz = n.z + (dz / d) * step;
  const ty = Math.atan2(dx, dz);
  n.yaw = wrapAngle(n.yaw + Math.max(-8 * dt, Math.min(8 * dt, angleDelta(n.yaw, ty))));
  if (n.solid && !n.fly) {
    S.col.resolve(nx, nz, n.radius, n.y, n.height, 0.3, 0, res);
    n.x = res.x; n.z = res.z;
  } else { n.x = nx; n.z = nz; }
  n.speed = speed;
  return d - step;
}

function pickWander(S, n, r) {
  const a = n.rngA = S.rngAI.range(0, Math.PI * 2);
  const d = Math.sqrt(S.rngAI.next()) * r;
  n.tx = n.hx + Math.sin(a) * d; n.tz = n.hz + Math.cos(a) * d;
}

function clampBounds(S, n) {
  const b = S.terrain.bounds;
  if (n.x < b.minX) n.x = b.minX; if (n.x > b.maxX) n.x = b.maxX;
  if (n.z < b.minZ) n.z = b.minZ; if (n.z > b.maxZ) n.z = b.maxZ;
}

export function stepNpcs(S, dt) {
  const st = S.state, p = st.player, N = S.npcs, M = S.sigMods;
  const list = N.list;
  const barked = S.run.barked;
  for (let k = 0; k < list.length; k++) {
    const n = list[k];
    n.px = n.x; n.py = n.y; n.pz = n.z; n.pyaw = n.yaw;
    if (!n.visible) continue;
    n.animT += dt; n.t += dt;
    const dx = n.x - p.x, dz = n.z - p.z;
    const dist = hypot(dx, dz);
    // chill aura: everyone relaxes
    n.calm = M.calmR > 0 && hypot(n.x - M.calmX, n.z - M.calmZ) < M.calmR ? 1 : Math.max(0, n.calm - dt);
    if (n.hazard >= 0) { /* hazards.js drives this one */ continue; }
    const B = n.behaviour;
    if (B === 'gerald') { stepGerald(S, n, dist, dt); continue; }
    if (B === 'marco') { stepMarco(S, n, dt); }
    // reactions
    const rr = Math.max(n.reactR, p.size * 1.6 + 1);
    const inside = dist < rr;
    const giant = S.derived.stepUp > n.height * 1.2;
    if (n.reactT > 0) n.reactT -= dt;
    if (n.fleeT > 0) {
      n.fleeT -= dt;
      const fx = dist > 1e-3 ? dx / dist : 1, fz = dist > 1e-3 ? dz / dist : 0;
      moveToward(S, n, n.x + fx * 4, n.z + fz * 4, n.human ? 4.5 : 3, dt);
      clampBounds(S, n);
      setAnim(n, n.human ? 'flee' : 'run');
      if (n.fleeT <= 0) { n.tx = n.x; n.tz = n.z; n.hx = n.x; n.hz = n.z; }
      continue;
    }
    if (inside && !n.near && n.reactT <= 0 && n.calm <= 0) {
      const react = giant && (n.react === null || n.react === 'flee') ? 'flee' : n.react;
      if (react) {
        n.reactT = 4;
        n.mood = react;
        if (react === 'flee') n.fleeT = 1.8;
        else { setAnim(n, REACT_ANIM[react] || 'wave'); n.holdT = 2.2; }
      }
    }
    if (barked && dist < Math.max(8, p.size * 6) && n.reactT <= 0 && !n.fleeT) {
      n.reactT = 3; n.holdT = 1.6;
      setAnim(n, n.react === 'tut' ? 'tut' : n.human ? 'wave' : 'hop');
    }
    n.near = inside;
    if (n.holdT > 0) { n.holdT -= dt; n.speed = 0; continue; }
    if (n.calm > 0) { setAnim(n, n.human ? 'sit' : 'idle'); n.speed = 0; continue; }
    if (B === 'wander') {
      const r = +(n.params.r || 4), spd = +(n.params.speed || (n.human ? 1.2 : 0.8));
      if (n.wait > 0) { n.wait -= dt; setAnim(n, n.baseAnim === 'idle' ? (n.human ? 'idle' : 'peck') : n.baseAnim); n.speed = 0; }
      else {
        const left = moveToward(S, n, n.tx, n.tz, spd, dt);
        setAnim(n, n.human ? 'walk' : 'hop');
        if (left < 0.1 || n.t > 12) { n.wait = S.rngAI.range(1.5, 5); pickWander(S, n, r); n.t = 0; }
      }
    } else if (B === 'pathLoop' || (B === 'marco' && n.path)) {
      if (B === 'marco' && n.throwing > 0) continue;
      stepPath(S, n, +(n.params.speed || (n.kind === 'cyclist' ? 6 : 3)), dt);
      setAnim(n, n.params.anim || (n.speed > 2.2 ? 'run' : 'walk'));
    } else {
      if (n.anim !== n.baseAnim && n.holdT <= 0) setAnim(n, n.baseAnim);
      // idle folk turn to look at a nearby player
      if (dist < rr * 1.6) n.yaw = wrapAngle(n.yaw + angleDelta(n.yaw, Math.atan2(-dx, -dz)) * Math.min(1, 3 * dt));
      n.speed = 0;
    }
  }
}

function setAnim(n, a) { if (n.anim !== a) { n.anim = a; n.animT = 0; } }

function stepPath(S, n, speed, dt) {
  const P = n.path;
  if (!P || P.length < 4) { n.speed = 0; return; }
  const np = P.length / 2;
  const tx = P[n.pathIdx * 2], tz = P[n.pathIdx * 2 + 1];
  const left = moveToward(S, n, tx, tz, speed * (S.assist && n.hazard >= 0 ? 0.5 : 1), dt);
  if (left < 0.05) {
    if (n.params.pingPong) {
      if (n.pathIdx + n.pathDir >= np || n.pathIdx + n.pathDir < 0) n.pathDir = -n.pathDir;
      n.pathIdx += n.pathDir;
    } else n.pathIdx = (n.pathIdx + 1) % np;
  }
}

function stepGerald(S, n, dist, dt) {
  const p = S.state.player;
  const approach = Math.max(+(n.params.approachR || 3), p.size * 2.8);
  if (n.calm > 0 && n.state !== 2) { setAnim(n, 'idle'); n.speed = 0; return; }
  if (n.state === 2) {
    // flying to the next spot
    const fdx = n.tx - n.fx, fdz = n.tz - n.fz;
    const total = hypot(fdx, fdz) || 1;
    const spd = Math.max(7, S.derived.top * 1.4);
    n.fly += (spd * dt) / total;
    const u = Math.min(1, n.fly);
    n.x = n.fx + fdx * u; n.z = n.fz + fdz * u;
    const ground = S.terrain.heightAt(n.x, n.z);
    n.y = ground + Math.sin(u * Math.PI) * Math.min(12, 2 + total * 0.25) + (1 - u) * (n.fy - ground) * 0;
    n.yaw = Math.atan2(fdx, fdz);
    n.speed = spd;
    setAnim(n, 'fly');
    if (u >= 1) { n.state = 0; n.fly = 0; n.y = ground; n.wait = S.rngAI.range(1, 3); setAnim(n, 'peck'); }
    return;
  }
  n.y = S.terrain.heightAt(n.x, n.z);
  if (dist < approach) {
    // flap off
    n.state = 2; n.fly = 0; n.fx = n.x; n.fz = n.z; n.fy = n.y;
    pickGeraldSpot(S, n);
    S.emit({ type: EV.PIGEON_SCARE, count: 1, gerald: true, x: n.x, z: n.z });
    return;
  }
  if (dist < approach * 2.5) {
    // nervous hops ahead
    n.hopT = (n.hopT || 0) - dt;
    if (n.hopT <= 0) {
      n.hopT = S.rngAI.range(0.6, 1.4);
      const dx = n.x - p.x, dz = n.z - p.z, d = hypot(dx, dz) || 1;
      n.tx = n.x + (dx / d) * 0.6 + S.rngAI.range(-0.3, 0.3); n.tz = n.z + (dz / d) * 0.6 + S.rngAI.range(-0.3, 0.3);
    }
    moveToward(S, n, n.tx, n.tz, 1.5, dt);
    setAnim(n, 'hop');
    n.yaw = Math.atan2(p.x - n.x, p.z - n.z); // keeps an eye on you
    return;
  }
  n.speed = 0;
  n.wait -= dt;
  if (n.wait <= 0) { n.wait = S.rngAI.range(1.5, 4); setAnim(n, n.anim === 'peck' ? 'idle' : 'peck'); }
}

function pickGeraldSpot(S, n) {
  const P = n.path;
  const p = S.state.player;
  if (P && P.length >= 2) {
    const np = P.length / 2;
    n.pathIdx = (n.pathIdx + 1) % np;
    n.tx = P[n.pathIdx * 2]; n.tz = P[n.pathIdx * 2 + 1];
    return;
  }
  const away = Math.atan2(n.x - p.x, n.z - p.z);
  for (let a = 0; a < 8; a++) {
    const yaw = away + S.rngAI.range(-1.1, 1.1);
    const d = 8 + p.size * 6 + S.rngAI.range(0, 6);
    const tx = n.x + Math.sin(yaw) * d, tz = n.z + Math.cos(yaw) * d;
    if (!S.terrain.inBounds(tx, tz, -2)) continue;
    if (S.col.containing(tx, tz, 0.3) >= 0) continue;
    if (S.terrain.depthAt(tx, tz) > 0.05) continue;
    n.tx = tx; n.tz = tz; return;
  }
  // fall back: towards the middle of the world
  const b = S.terrain.bounds;
  n.tx = (b.minX + b.maxX) / 2 + S.rngAI.range(-5, 5); n.tz = (b.minZ + b.maxZ) / 2 + S.rngAI.range(-5, 5);
}

function stepMarco(S, n, dt) {
  if (n.throwing > 0) {
    n.throwing -= dt; n.speed = 0;
    if (n.throwing <= 0) setAnim(n, 'run');
    return;
  }
  n.throwT -= dt;
  if (n.throwT <= 0 && !(S.state.activity && S.state.activity.kind === 'fetch')) {
    n.throwT = +(n.params.throwEvery || 9) + S.rngAI.range(-2, 2);
    throwBall(S, n, n.yaw + S.rngAI.range(-0.6, 0.6), 7);
  }
}

export function throwBall(S, n, yaw, dist) {
  n.throwing = 0.8;
  setAnim(n, 'throw');
  const g = 9.8 * S.gravityScale, vy = 6, tf = (2 * vy) / g, hs = dist / tf;
  return spawnProjectile(S, 1, n.x, n.y + 1.6, n.z, Math.sin(yaw) * hs, vy, Math.cos(yaw) * hs, S.npcs.list.indexOf(n));
}

// Living creatures push the player gently; giants just step over them (and they scatter).
export function npcPush(S) {
  const p = S.state.player, D = S.derived, list = S.npcs.list;
  for (let k = 0; k < list.length; k++) {
    const n = list[k];
    if (!n.visible || !n.solid || n.fly || n.state === 2) continue;
    if (n.height <= D.stepUp) continue;
    const dx = p.x - n.x, dz = p.z - n.z;
    const rr = D.radius + n.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) continue;
    if (p.y > n.y + n.height) continue;
    const d = Math.sqrt(d2) || 1e-3;
    const push = rr - d;
    const share = n.hazard >= 0 || n.human || n.kind === 'highlandcow' ? 1 : 0.7;
    p.x += (dx / d) * push * share; p.z += (dz / d) * push * share;
    n.x -= (dx / d) * push * (1 - share); n.z -= (dz / d) * push * (1 - share);
  }
}
