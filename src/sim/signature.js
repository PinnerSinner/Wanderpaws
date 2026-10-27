// The 13 signature moves. Each one sets S.sigMods (read by the player, the gobble
// rule, hazards and boids) and can gobble directly. All are deterministic.
import { EV } from '../core/events.js';
import { TAU, clamp01, angleDelta } from '../core/math.js';
import { TUNE } from './tune.js';
import { gobbleInRadius, nearestGobbleable, startGobble } from './gobble.js';
import { IS_GONE, IS_GOBBLING, IS_HIDDEN } from './items.js';

export function resetSigMods(M) {
  M.effSizeMult = 1; M.extraReach = 0; M.speedMult = 1; M.steerMult = 1; M.gripMult = 1;
  M.gravityMult = 1; M.immune = false; M.rolling = false; M.lockMove = false; M.noJump = false;
  M.steerYaw = NaN; M.steerRate = 0; M.forceSpeed = -1; M.maxFall = 0; M.directVel = false;
  M.calmR = 0; M.calmX = 0; M.calmZ = 0;
  return M;
}

export function createSigMods() { return resetSigMods({}); }

const CHARGED = { sniffBoost: 1, superHop: 1 };

export function stepSignature(S, inp, dt) {
  const st = S.state, p = st.player, sg = p.sig, sp = S.species, M = S.sigMods, R = S.run;
  const def = sp.signature || {};
  const kind = sg.kind;
  const playing = st.phase === 'play';
  if (sg.cooldownLeft > 0) sg.cooldownLeft = Math.max(0, sg.cooldownLeft - dt);
  // router-cat signal bars, live so render can blink the LEDs
  if (kind === 'wifiPurr') sg.bars = st.worldId === 'w5' ? 4 : Math.max(1, Math.min(4, 1 + Math.floor(p.combo.count / 3)));
  sg.ready = playing && !sg.active && sg.phase !== 'charge' && sg.cooldownLeft <= 0 && p.stagger <= 0;
  if (inp.sigHeld || inp.sig) sg.aimYaw = R.inputMag > 0 ? R.inputYaw : p.yaw;

  // ---- start ----
  if (inp.sig && sg.ready) {
    if (CHARGED[kind]) { sg.phase = 'charge'; sg.power = 0; sg.chargeT = 0; if (kind === 'sniffBoost') findScent(S); }
    else activate(S, def);
  }
  // ---- charging ----
  if (sg.phase === 'charge') {
    sg.chargeT += dt;
    sg.power = clamp01(sg.chargeT / (kind === 'superHop' ? 0.6 : 0.8));
    if (kind === 'sniffBoost') {
      M.speedMult = 0.35;
      if ((S.state.tick & 15) === 0) findScent(S);
    } else { M.speedMult = 0.45; M.noJump = true; }
    if (!inp.sigHeld || sg.chargeT > 2.5 || !playing) activate(S, def);
  }
  // ---- active ----
  if (sg.active) {
    sg.t += dt;
    const done = UPDATE[kind] ? UPDATE[kind](S, dt) : sg.t >= (def.duration || 1);
    if (done || st.phase === 'intro') end(S, def);
  }
}

function activate(S, def) {
  const p = S.state.player, sg = p.sig;
  sg.phase = 'active';
  sg.active = true;
  sg.t = 0;
  sg.count = 0;
  const fn = START[sg.kind];
  if (fn) fn(S);
  S.run.sigUses++;
  S.emit({ type: EV.SIG, kind: sg.kind, phase: 'start', power: sg.power, x: p.x, z: p.z });
}

function end(S, def) {
  const p = S.state.player, sg = p.sig;
  sg.active = false;
  sg.phase = null;
  sg.cooldownLeft = (def.cooldown || 4) * (S.assist ? 0.7 : 1);
  sg.radius = 0;
  S.emit({ type: EV.SIG, kind: sg.kind, phase: 'end', count: sg.count, x: p.x, z: p.z });
}

// ---- helpers ----
function aimDir(S) { return S.state.player.sig.aimYaw; }

function launch(S, yaw, height, dist) {
  const p = S.state.player, D = S.derived;
  const g = D.gravity;
  const vy = Math.sqrt(2 * g * height);
  const tf = (2 * vy) / g;
  const hs = dist / tf;
  p.yaw = yaw;
  p.vy = vy; p.vx = Math.sin(yaw) * hs; p.vz = Math.cos(yaw) * hs;
  p.grounded = false; p.airborne = true;
  S.run.moveSpeed = hs; S.run.airT = 0.0001; S.run.jumping = false;
  S.emit({ type: EV.JUMP, x: p.x, z: p.z, sig: true });
  return hs;
}

function shockwave(S, r, strength) {
  const p = S.state.player, I = S.I;
  const n = S.items.query(p.x, p.z, r);
  const hits = S.items.G.hits;
  for (let j = 0; j < n; j++) {
    const i = hits[j];
    if (I.gobbleable[i] || I.state[i] >= IS_GOBBLING) continue;
    const dx = I.x[i] - p.x, dz = I.z[i] - p.z;
    const d = Math.hypot(dx, dz);
    if (d > r + S.X.radius[i]) continue;
    S.items.wobble(i, strength * (1 - d / (r + S.X.radius[i] + 1e-3)) * 3, dx, dz);
  }
}

// Scent target for the sniff: a golden item in range, else the densest nearby
// gobble-able cluster.
export function findScent(S) {
  const p = S.state.player, I = S.I, sg = p.sig;
  const range = Math.max(8, p.size * 30);
  let best = -1, bestScore = -1;
  for (let i = 0; i < I.count; i++) {
    if (!I.golden[i] || I.state[i] >= IS_GOBBLING) continue;
    const d = Math.hypot(I.x[i] - p.x, I.z[i] - p.z);
    if (d < range && (best < 0 || d < bestScore)) { best = i; bestScore = d; }
  }
  if (best < 0) {
    const n = nearestGobbleable(S, p.x, p.z, range, 0, Math.PI, 24, p.size * 3);
    // score = neighbours within a few body lengths, minus a distance penalty
    const cand = S.scratchIdx2;
    for (let j = 0; j < n; j++) cand[j] = S.scratchIdx[j];
    const cl = p.size * 3;
    for (let a = 0; a < n; a++) {
      const i = cand[a];
      let c = 0;
      for (let b = 0; b < n; b++) {
        const o = cand[b];
        const dx = I.x[o] - I.x[i], dz = I.z[o] - I.z[i];
        if (dx * dx + dz * dz < cl * cl) c++;
      }
      const d = Math.hypot(I.x[i] - p.x, I.z[i] - p.z);
      const score = c - d / (range * 0.25);
      if (score > bestScore) { bestScore = score; best = i; }
    }
  }
  if (best >= 0) { sg.tx = I.x[best]; sg.tz = I.z[best]; sg.target = best; }
  else { sg.tx = p.x + Math.sin(p.yaw) * p.size * 4; sg.tz = p.z + Math.cos(p.yaw) * p.size * 4; sg.target = -1; }
}

// ---- per-kind start ----
const START = {
  sniffBoost(S) {
    const p = S.state.player, sg = p.sig;
    if (sg.tx == null) findScent(S);
    sg.dur = 0.55 + 0.65 * sg.power;
    sg.speed = S.derived.top * (1.9 + 0.6 * sg.power);
  },
  pounce(S) {
    const p = S.state.player, sp = S.species;
    const yaw = aimDir(S);
    p.sig.hs = launch(S, yaw, p.size * 0.8 * (sp.stats.jump || 1), p.size * 3.4 * (sp.stats.jump || 1));
    p.sig.tx = p.x + Math.sin(yaw) * p.size * 3.4; p.sig.tz = p.z + Math.cos(yaw) * p.size * 3.4;
  },
  chillAura(S) {
    const p = S.state.player;
    p.sig.radius = 3 + p.size * 7;
  },
  bellySlide(S) {
    const p = S.state.player, sp = S.species, R = S.run;
    const icy = p.surface === 'snow' || p.surface === 'ice';
    p.sig.dur = (S.species.signature.duration || 1.8) * (icy ? 2 : 1);
    R.slideV = Math.max(R.moveSpeed, S.derived.top * 1.75 * (sp.stats.slideSpeed || 1));
    p.sig.icy = icy;
  },
  superHop(S) {
    const p = S.state.player, sp = S.species, pw = p.sig.power;
    const yaw = aimDir(S);
    p.sig.hs = launch(S, yaw, p.size * (sp.stats.jump || 1) * (1.1 + 1.9 * pw), p.size * (2.5 + 3.5 * pw));
  },
  flapGlide(S) {
    const p = S.state.player;
    if (p.grounded || S.run.swimming) {
      p.vy = Math.sqrt(2 * S.derived.gravity * p.size * 0.7);
      p.grounded = false; p.airborne = true; S.run.airT = 0.0001;
    } else if (p.vy < 0) p.vy *= 0.3;
  },
  shellUp(S) {
    const p = S.state.player;
    p.vx *= 1.1; p.vz *= 1.1;
  },
  tongueSnap(S) {
    const p = S.state.player, sg = p.sig, D = S.derived;
    const range = D.reachBase * 3;
    const yaw = sg.aimYaw;
    const n = nearestGobbleable(S, p.x, p.z, range, yaw, 0.9, 1, p.size * 1.5);
    if (n > 0) {
      const i = S.scratchIdx[0];
      sg.tx = S.I.x[i]; sg.tz = S.I.z[i]; sg.target = i;
      startGobble(S, i); sg.count = 1;
      p.yaw = Math.atan2(sg.tx - p.x, sg.tz - p.z);
    } else {
      sg.tx = p.x + Math.sin(yaw) * range; sg.tz = p.z + Math.cos(yaw) * range; sg.target = -1;
    }
  },
  standTall() {},
  eightArmGrab(S) {
    const p = S.state.player, sg = p.sig;
    const n = nearestGobbleable(S, p.x, p.z, S.derived.reachBase * 2.3, 0, Math.PI, 8, p.size);
    for (let j = 0; j < n; j++) startGobble(S, S.scratchIdx[j]);
    sg.count = n;
  },
  coilPull(S) {
    const p = S.state.player, sg = p.sig, D = S.derived;
    const rc = D.reachBase * 1.3 + p.size * 0.3;
    sg.radius = rc;
    sg.tx = p.x + Math.sin(p.yaw) * rc; sg.tz = p.z + Math.cos(p.yaw) * rc;
    sg.theta0 = Math.atan2(p.x - sg.tx, p.z - sg.tz);
  },
  trunkHoover(S) { S.state.player.sig.radius = S.derived.reachBase * 3.2; },
  wifiPurr(S) { const p = S.state.player; p.sig.radius = S.derived.reachBase * (1 + 0.75 * p.sig.bars); },
};

// ---- per-kind update; return true when finished ----
const UPDATE = {
  sniffBoost(S, dt) {
    const p = S.state.player, sg = p.sig, M = S.sigMods;
    const dx = sg.tx - p.x, dz = sg.tz - p.z;
    const d = Math.hypot(dx, dz);
    M.steerYaw = Math.atan2(dx, dz); M.steerRate = 9;
    M.forceSpeed = sg.speed;
    M.extraReach = p.size * 0.3;
    M.gripMult = 1.5;
    return sg.t >= sg.dur || d < S.derived.reachBase * 0.6;
  },
  pounce(S) {
    const p = S.state.player, M = S.sigMods;
    M.steerMult = 0.2;
    M.noJump = true;
    if (!p.grounded) M.forceSpeed = p.sig.hs;
    if (p.sig.t > 0.08 && p.grounded) {
      const r = S.derived.reachBase * 1.9 + p.size * 0.5;
      p.sig.count = gobbleInRadius(S, p.x, p.z, r, 9999, p.size);
      shockwave(S, r * 1.4, 1);
      p.landImpact = Math.max(p.landImpact, 0.6);
      return true;
    }
    return p.sig.t > 2.5;
  },
  chillAura(S) {
    const p = S.state.player, M = S.sigMods;
    M.calmR = p.sig.radius; M.calmX = p.x; M.calmZ = p.z;
    return p.sig.t >= (S.species.signature.duration || 5);
  },
  bellySlide(S, dt) {
    const p = S.state.player, R = S.run, M = S.sigMods, sg = p.sig;
    const fr = sg.icy ? 0.12 : 0.45;
    R.slideV *= Math.exp(-fr * dt);
    // downhill helps, uphill hurts
    const T = S.terrain;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const ahead = T.heightAt(p.x + fx * p.size, p.z + fz * p.size) - T.heightAt(p.x, p.z);
    R.slideV -= (ahead / p.size) * S.derived.gravity * 0.5 * dt;
    if (R.slideV < 0) R.slideV = 0;
    M.forceSpeed = R.slideV;
    M.steerMult = 0.5;
    M.gripMult = 0.3;
    M.noJump = true;
    M.extraReach = p.size * 0.35;
    // the line: an extra gobble disc ahead of the beak
    const r = S.derived.reachBase * 0.9;
    sg.count += gobbleInRadius(S, p.x + fx * r, p.z + fz * r, r, 4, p.size * 0.5);
    return sg.t >= sg.dur || (sg.t > 0.3 && R.slideV < S.derived.top * 0.45);
  },
  superHop(S) {
    const p = S.state.player, M = S.sigMods;
    M.steerMult = 0.35; M.noJump = true;
    if (!p.grounded) M.forceSpeed = p.sig.hs;
    if (p.sig.t > 0.08 && p.grounded) {
      const r = S.derived.reachBase * (1.5 + 0.9 * p.sig.power) + p.size * 0.4;
      p.sig.count = gobbleInRadius(S, p.x, p.z, r, 9999, p.size);
      shockwave(S, r * 1.5, 0.6 + p.sig.power);
      p.landImpact = Math.max(p.landImpact, 0.5 + 0.5 * p.sig.power);
      return true;
    }
    return p.sig.t > 3;
  },
  flapGlide(S) {
    const p = S.state.player, M = S.sigMods;
    if (p.vy > 0) M.gravityMult = 0.6;
    M.maxFall = 0.8 * Math.sqrt(p.size) + 0.2;
    M.speedMult = 1.2; M.steerMult = 1.6; M.gripMult = 2.5;
    M.noJump = true;
    return p.sig.t >= (S.species.signature.duration || 1.5) || (p.sig.t > 0.2 && p.grounded);
  },
  shellUp(S, dt) {
    const p = S.state.player, M = S.sigMods, R = S.run, T = S.terrain, D = S.derived;
    M.immune = true; M.rolling = true; M.directVel = true; M.noJump = true;
    M.steerMult = 0.3;
    // roll downhill like a bowling ball
    const e = Math.max(0.2, p.size * 0.5);
    const gx = (T.heightAt(p.x + e, p.z) - T.heightAt(p.x - e, p.z)) / (2 * e);
    const gz = (T.heightAt(p.x, p.z + e) - T.heightAt(p.x, p.z - e)) / (2 * e);
    if (p.grounded) {
      p.vx -= gx * D.gravity * 1.2 * dt; p.vz -= gz * D.gravity * 1.2 * dt;
      const fr = Math.exp(-0.35 * dt);
      p.vx *= fr; p.vz *= fr;
      if (R.inputMag > 0) { p.vx += Math.sin(R.inputYaw) * D.top * 0.8 * dt; p.vz += Math.cos(R.inputYaw) * D.top * 0.8 * dt; }
    }
    const s = Math.hypot(p.vx, p.vz), cap = D.top * 2.4;
    if (s > cap) { p.vx *= cap / s; p.vz *= cap / s; }
    if (s > 0.05 * p.size) M.steerYaw = Math.atan2(p.vx, p.vz), M.steerRate = 20;
    R.moveSpeed = s;
    return p.sig.t >= (S.species.signature.duration || 3);
  },
  tongueSnap(S) {
    S.sigMods.speedMult = 0.6;
    return S.state.player.sig.t >= (S.species.signature.duration || 0.35);
  },
  standTall(S) {
    const M = S.sigMods;
    M.effSizeMult = 1.25; M.speedMult = 0.45; M.noJump = true;
    return S.state.player.sig.t >= (S.species.signature.duration || 3);
  },
  eightArmGrab(S) {
    const M = S.sigMods;
    if (S.state.player.sig.t < 0.3) M.lockMove = true;
    return S.state.player.sig.t >= (S.species.signature.duration || 0.8);
  },
  coilPull(S, dt) {
    const p = S.state.player, sg = p.sig, M = S.sigMods;
    const dur = S.species.signature.duration || 1.2;
    const th = sg.theta0 + (TAU * sg.t) / dur;
    const rc = sg.radius;
    const wx = sg.tx + Math.sin(th) * rc, wz = sg.tz + Math.cos(th) * rc;
    M.directVel = true; M.noJump = true;
    const vx = (wx - p.x) / Math.max(dt, 1e-4), vz = (wz - p.z) / Math.max(dt, 1e-4);
    const v = Math.hypot(vx, vz), cap = S.derived.top * 4;
    const k = v > cap ? cap / v : 1;
    p.vx = vx * k; p.vz = vz * k;
    M.steerYaw = Math.atan2(p.vx, p.vz); M.steerRate = 30;
    S.run.moveSpeed = Math.min(v, cap);
    // drag in the lot inside the coil
    sg.count += gobbleInRadius(S, sg.tx, sg.tz, rc * 1.05, 4, p.size);
    return sg.t >= dur;
  },
  trunkHoover(S, dt) {
    const p = S.state.player, sg = p.sig, M = S.sigMods, I = S.I, X = S.X;
    M.speedMult = 0.5;
    const range = sg.radius;
    const n = nearestGobbleable(S, p.x, p.z, range, p.yaw, 0.62, 4, p.size);
    for (let j = 0; j < n; j++) startGobble(S, S.scratchIdx[j]);
    sg.count += n;
    // drag almost-sized things closer
    const m = S.items.query(p.x, p.z, range);
    const hits = S.items.G.hits;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    for (let j = 0; j < m; j++) {
      const i = hits[j];
      if (!I.almost[i] || I.state[i] >= IS_GOBBLING) continue;
      const dx = p.x - I.x[i], dz = p.z - I.z[i];
      const d = Math.hypot(dx, dz);
      if (d > range || d < S.derived.radius + X.radius[i]) continue;
      if ((-dx * fx - dz * fz) / (d || 1) < 0.8) continue;
      const v = Math.min(d, p.size * 2.5) * dt;
      I.x[i] += (dx / d) * v; I.z[i] += (dz / d) * v;
      S.items.wobble(i, 0.4, dx, dz);
      S.items.G.dirty = true;
    }
    return sg.t >= (S.species.signature.duration || 1.6);
  },
  wifiPurr(S) {
    const p = S.state.player, sg = p.sig;
    sg.radius = S.derived.reachBase * (1 + 0.75 * sg.bars);
    sg.count += gobbleInRadius(S, p.x, p.z, sg.radius, 3, p.size);
    return sg.t >= (S.species.signature.duration || 2.5);
  },
};

export const SIG_IMPLEMENTED = Object.keys(UPDATE);
// silence unused import lint in some tools
void angleDelta; void IS_GONE; void IS_HIDDEN; void TUNE;
