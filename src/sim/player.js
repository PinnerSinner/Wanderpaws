// Player movement with weight: size-scaled speeds, ramped acceleration, a turn
// cap that tightens with speed, zoomies that build over a second, size-scaled
// gravity and jumps with coyote time and a buffer, water, bark and play-bow,
// footsteps and the shake-off.
import { EV } from '../core/events.js';
import { angleDelta, wrapAngle, clamp01 } from '../core/math.js';
import { TUNE, SURFACES } from './tune.js';
import { playerItemContacts, nearestGobbleable } from './gobble.js';
import { hypot } from './util.js';

export function topSpeedFor(size, speedStat = 1) {
  return TUNE.speedK * Math.pow(size, TUNE.speedExp) * speedStat;
}
export function gravityFor(size, lowGravity = false) {
  return TUNE.gravityK * Math.sqrt(size) * (lowGravity ? TUNE.lowGravity : 1);
}
export function jumpVelocityFor(size, jumpStat = 1, lowGravity = false) {
  return Math.sqrt(2 * gravityFor(size, lowGravity) * TUNE.jumpK * size * jumpStat);
}

const res = { x: 0, z: 0, support: 0, hit: 0, nx: 0, nz: 0, hitIndex: -1 };
const up = { x: 0, z: 0 };

export function updateDerived(S) {
  const p = S.state.player, D = S.derived, sp = S.species;
  const size = p.size;
  D.radius = sp.hitbox.radius * size;
  D.height = sp.hitbox.height * size;
  D.stepUp = TUNE.stepUp * size;
  D.gravity = TUNE.gravityK * Math.sqrt(size) * S.gravityScale * S.sigMods.gravityMult;
}

export function stepPlayer(S, inp, dt) {
  const st = S.state, p = st.player, R = S.run, D = S.derived, sp = S.species, M = S.sigMods, T = S.terrain, H = S.hazMods;
  const size = p.size;
  const playing = st.phase === 'play';
  updateDerived(S);

  // ---- surface, water and speed ----
  const tY0 = T.heightAt(p.x, p.z);
  const wl0 = T.hasWater ? T.waterAt(p.x, p.z) : -Infinity;
  const depth0 = wl0 > tY0 ? wl0 - tY0 : 0;
  const swimmer = sp.swims || sp.floats;
  const swimming = depth0 > D.height * 0.55 && swimmer && p.y <= wl0 + 0.05 * size;
  R.swimming = swimming;
  const wetSurf = depth0 > D.height * 0.15 && p.y <= wl0 + 0.05 * size;
  p.surface = wetSurf ? 'water' : T.surfaceAt(p.x, p.z);
  const surf = SURFACES[p.surface] || SURFACES.grass;
  const aff = (sp.affinity && sp.affinity.surfaces) || {};
  let speedMult = surf.speed * (aff[p.surface] || 1);
  let grip = surf.grip;
  if (p.surface === 'water') {
    if (swimming) {
      speedMult = (sp.stats.waterSpeed || 0.7) * (aff.water || 1);
      if (sp.floats) speedMult = Math.max(1, speedMult);
      grip = 0.45;
    } else {
      const wade = clamp01(depth0 / Math.max(0.01, D.height));
      speedMult *= swimmer ? 1 - 0.2 * wade : 1 - 0.5 * wade;
      grip = 0.7;
    }
  }
  speedMult *= H.speed;
  grip *= H.grip;
  if (p.buffs.speed > 0) speedMult *= 1.35;
  if (S.modifiers.speedy) speedMult *= 1.3;
  if (st.weather.kind === 'rain' || st.weather.kind === 'snow') grip *= 1 - 0.12 * st.weather.intensity;
  const top = topSpeedFor(size, sp.stats.speed) * speedMult;
  D.top = top;
  D.topSprint = top * TUNE.sprintMult;

  // ---- input ----
  let mx = inp.mx || 0, mz = inp.mz || 0;
  let mag = hypot(mx, mz);
  if (mag > 1) { mx /= mag; mz /= mag; mag = 1; }
  if (mag < 0.08) mag = 0;
  const control = playing && p.stagger <= 0.2 && !M.lockMove && !p.playBow;
  if (!control) mag = 0;
  let inYaw = mag > 0 ? Math.atan2(mx, mz) : p.yaw;
  if (p.buffs.wobble > 0 && mag > 0) inYaw += Math.sin(st.time * 3.1) * 0.55 + Math.sin(st.time * 7.3) * 0.2;
  R.inputMag = mag; R.inputYaw = inYaw;

  // ---- zoomies ----
  if (inp.sprint && mag > 0.25 && control) R.zoom = Math.min(1, R.zoom + dt / TUNE.sprintBuild);
  else R.zoom = Math.max(0, R.zoom - dt / TUNE.sprintFade);
  const ze = R.zoom * R.zoom * (3 - 2 * R.zoom);
  p.sprinting = R.zoom > 0.5;
  let target = mag * top * (1 + (TUNE.sprintMult - 1) * ze) * M.speedMult;

  // ---- turning ----
  const air = !p.grounded && !swimming;
  const sn = clamp01(R.moveSpeed / Math.max(1e-6, top * TUNE.sprintMult));
  let turnCap = (TUNE.turnSlow + (TUNE.turnFast - TUNE.turnSlow) * sn) * (sp.stats.turn || 1) * M.steerMult * (air ? TUNE.airControl : 1);
  let yawStep = 0;
  if (M.steerYaw === M.steerYaw) { // not NaN: a move is steering for us
    const dl = angleDelta(p.yaw, M.steerYaw);
    const cap = M.steerRate * dt;
    yawStep = dl < -cap ? -cap : dl > cap ? cap : dl;
  } else if (mag > 0) {
    const dl = angleDelta(p.yaw, inYaw);
    const adl = Math.abs(dl);
    if (adl > TUNE.pivotAngle && R.moveSpeed < 0.3 * top && !air) { turnCap *= 2.4; R.moveSpeed *= 0.85; }
    const cap = turnCap * dt;
    yawStep = dl < -cap ? -cap : dl > cap ? cap : dl;
    target *= 1 - 0.45 * clamp01((adl - 0.5) / 2.0);
  }
  p.yaw = wrapAngle(p.yaw + yawStep);
  const tr = yawStep / dt;
  p.turnRate += (tr - p.turnRate) * (1 - Math.exp(-18 * dt));

  // ---- speed intent ----
  if (M.forceSpeed >= 0) R.moveSpeed = M.forceSpeed;
  else {
    const g1 = Math.min(1, grip * 1.4 + 0.25);
    const accel = top * TUNE.accelK * (sp.stats.accel || 1) * (1 + TUNE.accelRamp * (1 - Math.min(1, R.moveSpeed / Math.max(1e-6, top)))) * g1;
    const decel = top * TUNE.decelK * Math.min(1, grip + 0.3);
    if (R.moveSpeed < target) R.moveSpeed = Math.min(target, R.moveSpeed + accel * dt * (air ? TUNE.airControl : 1));
    else R.moveSpeed = Math.max(target, R.moveSpeed - decel * dt * (air ? 0.3 : 1));
  }

  // ---- horizontal velocity ----
  if (!M.directVel) {
    const dvx = Math.sin(p.yaw) * R.moveSpeed, dvz = Math.cos(p.yaw) * R.moveSpeed;
    const g = TUNE.grip * grip * M.gripMult * (air ? 0.25 : 1) * (p.stagger > 0 ? 0.12 : 1);
    const k = 1 - Math.exp(-g * dt);
    p.vx += (dvx - p.vx) * k;
    p.vz += (dvz - p.vz) * k;
  }

  // ---- jumping ----
  const canJump = sp.canJump !== false && !M.noJump;
  if (inp.jump && control && canJump) R.jumpBuf = TUNE.jumpBuffer; else R.jumpBuf -= dt;
  if (p.grounded || swimming) R.coyote = TUNE.coyote; else R.coyote -= dt;
  if (R.jumpBuf > 0 && R.coyote > 0 && control && canJump) {
    const h = TUNE.jumpK * size * (sp.stats.jump || 1) * (swimming ? 0.55 : 1);
    p.vy = Math.sqrt(2 * D.gravity * h);
    p.grounded = false; R.coyote = 0; R.jumpBuf = 0; R.jumping = true; R.airT = 0; R.swimJump = swimming;
    S.emit({ type: EV.JUMP, x: p.x, z: p.z });
  }
  if (R.jumping && !inp.jumpHeld && p.vy > 0) { p.vy *= TUNE.jumpCut; R.jumping = false; }
  if (p.vy <= 0) R.jumping = false;
  if (!p.grounded) {
    p.vy -= D.gravity * dt;
    if (M.maxFall > 0 && p.vy < -M.maxFall) p.vy = -M.maxFall;
  }

  // ---- integrate horizontal ----
  let nx = p.x + (p.vx + H.pushX) * dt, nz = p.z + (p.vz + H.pushZ) * dt;
  if (p.grounded && !swimming) {
    const h1 = T.heightAt(nx, nz);
    const run = hypot(nx - p.x, nz - p.z);
    if (run > 1e-7 && (h1 - tY0) / run > TUNE.maxSlope && h1 > p.y + D.stepUp * 0.25) {
      nx = p.x; nz = p.z; R.moveSpeed *= 0.5; R.blockedT += dt;
    }
  }
  p.x = nx; p.z = nz;

  // ---- bodies: items, NPCs, then static colliders last ----
  playerItemContacts(S, dt);
  if (S.npcPush) S.npcPush(S);
  S.col.resolve(p.x, p.z, D.radius, p.y, D.height, D.stepUp, S.passMask, res);
  R.wallHit = res.hit;
  if (res.hit) {
    p.x = res.x; p.z = res.z;
    const vn = p.vx * res.nx + p.vz * res.nz;
    if (vn < 0) {
      p.vx -= vn * res.nx; p.vz -= vn * res.nz;
      const f = Math.min(1, -vn / Math.max(1e-6, R.moveSpeed + 1e-6));
      R.moveSpeed *= 1 - 0.7 * f;
    }
    if (S.onWall) S.onWall(res.hitIndex, vn);
  }

  // ---- soft world bounds ----
  const b = T.bounds;
  const hard = Math.max(1.5, size * 1.2);
  if (p.x < b.minX) { p.x += (b.minX - p.x) * Math.min(1, 8 * dt); if (p.vx < 0) p.vx *= 0.6; if (p.x < b.minX - hard) p.x = b.minX - hard; }
  if (p.x > b.maxX) { p.x += (b.maxX - p.x) * Math.min(1, 8 * dt); if (p.vx > 0) p.vx *= 0.6; if (p.x > b.maxX + hard) p.x = b.maxX + hard; }
  if (p.z < b.minZ) { p.z += (b.minZ - p.z) * Math.min(1, 8 * dt); if (p.vz < 0) p.vz *= 0.6; if (p.z < b.minZ - hard) p.z = b.minZ - hard; }
  if (p.z > b.maxZ) { p.z += (b.maxZ - p.z) * Math.min(1, 8 * dt); if (p.vz > 0) p.vz *= 0.6; if (p.z > b.maxZ + hard) p.z = b.maxZ + hard; }

  // ---- vertical: ground, water, landing ----
  const tY = T.heightAt(p.x, p.z);
  let ground = res.support > tY ? res.support : tY;
  const wl = T.hasWater ? T.waterAt(p.x, p.z) : -Infinity;
  const depth = wl > tY ? wl - tY : 0;
  let swimNow = false;
  if (depth > D.height * 0.55 && swimmer && ground < wl) {
    const sy = wl - D.height * (sp.floats ? 0.3 : 0.5);
    if (sy > ground) { ground = sy; swimNow = true; }
  }
  const hs = hypot(p.vx, p.vz);
  let ny = p.y + p.vy * dt;
  const wasGrounded = p.grounded;
  if (p.grounded) {
    const snap = TUNE.stepDown * size + hs * dt * 1.5;
    if (ground >= p.y - snap) { ny = ground; p.vy = 0; }
    else { p.grounded = false; R.airT = 0; R.coyote = TUNE.coyote; }
  } else if (ny <= ground && p.vy <= 0) {
    const vImpact = -p.vy;
    const ref = Math.sqrt(2 * D.gravity * size * 2.0);
    const impact = clamp01(vImpact / Math.max(1e-6, ref));
    ny = ground; p.vy = 0; p.grounded = true;
    if (R.airT > 0.08) {
      p.landImpact = Math.max(p.landImpact, impact);
      S.emit({ type: EV.LAND, impact, x: p.x, z: p.z });
      if (depth > 0.05 * size) S.emit({ type: EV.SPLASH, x: p.x, z: p.z, size: p.size });
    }
    R.landedThisTick = true;
  }
  if (ny < tY) { ny = tY; if (p.vy < 0) p.vy = 0; }
  p.y = ny;
  if (!p.grounded) R.airT += dt; else R.airT = 0;
  p.airborne = !p.grounded && !swimNow;
  if (wasGrounded && !p.grounded && !R.jumping) R.airT = 0.0001;

  // ---- water state ----
  const inWater = depth > 0.02 * size && p.y <= wl + 0.08 * size;
  p.inWater = inWater;
  p.waterDepth = inWater ? depth : 0;
  R.swimming = swimNow;
  if (inWater && !swimmer && depth > D.height * 0.45) {
    // non-swimmers get nudged back to the shallows
    T.uphill(p.x, p.z, Math.max(0.5, size), up);
    const push = top * 1.6 * clamp01((depth - D.height * 0.45) / D.height + 0.3);
    p.x += up.x * push * dt; p.z += up.z * push * dt;
  }
  if (inWater && !R.wasInWater && (hs > 0.25 * top || R.airT > 0)) S.emit({ type: EV.SPLASH, x: p.x, z: p.z, size: p.size });
  if (inWater) { R.wetT = Math.min(R.wetT + dt, 4); R.dryT = 0; }
  else if (R.wetT > 0.5) {
    R.dryT += dt;
    if (R.dryT > 0.35 && p.grounded && playing) {
      p.shakeT = TUNE.shakeTime;
      S.emit({ type: EV.SHAKE, x: p.x, z: p.z });
      R.wetT = 0;
      if (sp.id === 'oli' || sp.signature.kind === 'sniffBoost') sprayItems(S);
    }
  } else R.wetT = Math.max(0, R.wetT - dt * 0.2);
  R.wasInWater = inWater;
  if (p.shakeT > 0) p.shakeT = Math.max(0, p.shakeT - dt);

  // ---- outputs ----
  p.speed = hs;
  p.speedNorm = clamp01(hs / Math.max(1e-6, topSpeedFor(size, sp.stats.speed) * TUNE.sprintMult));
  const moved = hypot(p.x - p.px, p.z - p.pz);
  R.distance += moved;
  if (hs < 0.06 * size && mag === 0 && p.grounded) R.stillT += dt; else R.stillT = 0;

  // ---- footsteps ----
  if (p.grounded && !swimNow && hs > 0.1 * size) {
    const stride = size * (0.9 + 0.6 * p.speedNorm);
    R.footDist += hs * dt;
    if (R.footDist >= stride) {
      R.footDist -= stride;
      R.footSide ^= 1;
      S.emit({ type: EV.FOOTSTEP, surface: p.surface, x: p.x, z: p.z, side: R.footSide, size: p.size });
    }
  } else if (swimNow && hs > 0.1 * size) {
    R.footDist += hs * dt;
    if (R.footDist >= size * 1.6) { R.footDist = 0; R.footSide ^= 1; S.emit({ type: EV.FOOTSTEP, surface: 'water', x: p.x, z: p.z, side: R.footSide, size: p.size }); }
  }

  // ---- bark and play-bow ----
  R.barked = false;
  p.barkT += dt;
  const canBark = st.phase !== 'intro';
  if (inp.bark && canBark) {
    if (inp.barkHeld) { R.barkHolding = true; R.barkHoldT = 0; }
    else doBark(S);
  }
  if (R.barkHolding) {
    if (inp.barkHeld) {
      R.barkHoldT += dt;
      if (R.barkHoldT >= TUNE.barkHold && !p.playBow) {
        p.playBow = true;
        S.emit({ type: EV.PLAY_BOW, x: p.x, z: p.z });
      }
    } else {
      if (!p.playBow) doBark(S);
      p.playBow = false; R.barkHolding = false;
    }
  }
}

export function doBark(S) {
  const p = S.state.player;
  p.barkT = 0;
  S.run.barked = true;
  S.run.barks++;
  S.emit({ type: EV.BARK, x: p.x, z: p.z });
}

// Oli's shake-off sprays loose small items towards him.
function sprayItems(S) {
  const p = S.state.player, I = S.I;
  const r = S.derived.reachBase * 3.5 + p.size * 2;
  const n = nearestGobbleable(S, p.x, p.z, r, 0, Math.PI, 10, p.size);
  for (let j = 0; j < n; j++) {
    const i = S.scratchIdx[j];
    const dx = p.x - I.x[i], dz = p.z - I.z[i];
    const d = hypot(dx, dz) || 1;
    const v = Math.min(d * 2.2, p.size * 8 + 1);
    S.items.knock(i, (dx / d) * v, v * 0.5, (dz / d) * v);
    S.X.grace[i] = 0;
  }
}
