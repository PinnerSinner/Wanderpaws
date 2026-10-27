// The gobble rule, growth, combos, milestones, bumps and drops, and how the
// player touches items (walk over, brush past, knock, or bonk into).
import { EV } from '../core/events.js';
import { TUNE } from './tune.js';
import { IS_IDLE, IS_WOBBLE, IS_TUMBLE, IS_GOBBLING, IS_GONE } from './items.js';

// ---- pure maths (exported for tests) ----
export function gobbleThreshold(size, assist) { return size * (assist ? TUNE.gobbleRatioAssist : TUNE.gobbleRatio); }
export function almostThreshold(size, assist) { return size * ((assist ? TUNE.gobbleRatioAssist : TUNE.gobbleRatio) + TUNE.almostBand); }
export function canGobbleSize(itemSize, playerSize, assist) { return itemSize <= gobbleThreshold(playerSize, assist); }
export function grow(size, itemSize, k, comboMult = 1, foodMult = 1) {
  return Math.cbrt(size * size * size + k * itemSize * itemSize * itemSize * comboMult * foodMult);
}
export function comboMultFor(count) { return Math.min(TUNE.comboMax, 1 + TUNE.comboStep * Math.max(0, count - 1)); }
export function reachFor(size, reachStat, itemSize, bonus = 0) { return size * TUNE.reachK * reachStat * (1 + bonus) + itemSize * 0.5; }
export function dropCount(roll /* 1..3 */, dropMult) { return Math.ceil(roll * dropMult); }

// ---- per tick ----
export function updateGobbleFlags(S) {
  const p = S.state.player;
  const D = S.derived;
  const I = S.I;
  const eff = p.size * S.sigMods.effSizeMult;
  D.effSize = eff;
  D.T = gobbleThreshold(eff, S.assist);
  D.almostT = almostThreshold(eff, S.assist);
  const teaBonus = p.buffs.tea > 0 ? TUNE.teaReach : 0;
  D.reachBase = eff * TUNE.reachK * S.species.stats.reach * (1 + teaBonus) * (S.assist ? TUNE.assistReach : 1) + S.sigMods.extraReach;
  p.reach = D.reachBase + D.T * 0.25; // a representative radius for the UI and render (typical item)
  // per-type blocks from flags (nogobble:<type>)
  const flags = S.state.flags;
  const nt = I.types.length;
  if (S.typeBlocked.length < nt) growTypeArrays(S, nt);
  for (let t = 0; t < nt; t++) S.typeBlocked[t] = flags[S.noGobbleKey[t]] ? 1 : 0;
  const n = I.count, st = I.state, sz = I.size, gb = I.gobbleable, al = I.almost, ti = I.typeIndex;
  const T = D.T, A = D.almostT;
  for (let i = 0; i < n; i++) {
    const s = st[i];
    if (s >= IS_GOBBLING) { gb[i] = 0; al[i] = 0; continue; }
    const v = sz[i];
    const ok = v <= T && !S.typeBlocked[ti[i]];
    gb[i] = ok ? 1 : 0;
    al[i] = !ok && v <= A ? 1 : 0;
  }
}

export function growTypeArrays(S, nt) {
  const I = S.I;
  const nb = new Uint8Array(nt + 16), ns = new Uint8Array(nt + 16);
  nb.set(S.typeBlocked); ns.set(S.run.typeSeen);
  S.typeBlocked = nb; S.run.typeSeen = ns;
  for (let t = S.noGobbleKey.length; t < I.types.length; t++) S.noGobbleKey.push('nogobble:' + I.types[t]);
}

export function canGobble(S, i) {
  const s = S.I.state[i];
  if (s > IS_TUMBLE) return false;
  if (s === IS_TUMBLE && S.X.grace[i] > 0) return false;
  return S.I.gobbleable[i] === 1;
}

export function startGobble(S, i) {
  const I = S.I, X = S.X;
  I.state[i] = IS_GOBBLING;
  I.anim[i] = 0;
  X.sx[i] = I.x[i]; X.sy[i] = I.y[i]; X.sz[i] = I.z[i];
  I.gobbleable[i] = 0;
  S.items.G.dirty = true;
  S.debug.gobbleStarts++;
}

// Vertical overlap between an item and the player's gobble volume.
function verticalOk(S, i, extra) {
  const p = S.state.player, I = S.I;
  const eff = S.derived.effSize;
  const iy = I.y[i];
  return iy <= p.y + S.derived.height + eff * 0.5 + extra && iy + S.X.height[i] >= p.y - eff * 0.3 - extra;
}

// Normal gobbling: anything gobble-able inside reach.
export function tryGobble(S) {
  if (S.state.phase === 'intro') return;
  const p = S.state.player, I = S.I;
  const D = S.derived;
  const qr = D.reachBase + D.T * 0.5;
  const n = S.items.query(p.x, p.z, qr);
  const hits = S.items.G.hits;
  for (let j = 0; j < n; j++) {
    const i = hits[j];
    if (!canGobble(S, i)) continue;
    const dx = I.x[i] - p.x, dz = I.z[i] - p.z;
    const lim = D.reachBase + I.size[i] * 0.5;
    if (dx * dx + dz * dz > lim * lim) continue;
    if (!verticalOk(S, i, 0)) continue;
    startGobble(S, i);
  }
}

// Gobble everything gobble-able within r of (x, z), up to max. Returns how many.
export function gobbleInRadius(S, x, z, r, max = 9999, extraV = 0) {
  const I = S.I;
  const n = S.items.query(x, z, r);
  const hits = S.items.G.hits;
  let c = 0;
  // copy candidates out first: startGobble dirties the grid
  const buf = S.scratchIdx;
  let m = 0;
  for (let j = 0; j < n && m < buf.length; j++) buf[m++] = hits[j];
  for (let j = 0; j < m && c < max; j++) {
    const i = buf[j];
    if (!canGobble(S, i)) continue;
    const dx = I.x[i] - x, dz = I.z[i] - z;
    const lim = r + I.size[i] * 0.5;
    if (dx * dx + dz * dz > lim * lim) continue;
    if (!verticalOk(S, i, extraV)) continue;
    startGobble(S, i); c++;
  }
  return c;
}

// Nearest gobble-able items within range, optionally inside a cone. Fills
// S.scratchIdx sorted by distance (insertion) and returns how many (<= max).
export function nearestGobbleable(S, x, z, range, yaw, halfAngle, max, extraV = 0) {
  const I = S.I;
  const n = S.items.query(x, z, range);
  const hits = S.items.G.hits;
  const out = S.scratchIdx, dist = S.scratchD;
  let m = 0;
  const cosH = Math.cos(halfAngle);
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  for (let j = 0; j < n; j++) {
    const i = hits[j];
    if (!canGobble(S, i)) continue;
    const dx = I.x[i] - x, dz = I.z[i] - z;
    const d = Math.hypot(dx, dz);
    if (d > range + I.size[i] * 0.5) continue;
    if (halfAngle < Math.PI && d > 1e-4 && (dx * fx + dz * fz) / d < cosH) continue;
    if (!verticalOk(S, i, extraV)) continue;
    // insertion into a sorted top-max list
    let k;
    if (m < max) k = m++;
    else { if (d >= dist[max - 1]) continue; k = max - 1; }
    while (k > 0 && dist[k - 1] > d) { out[k] = out[k - 1]; dist[k] = dist[k - 1]; k--; }
    out[k] = i; dist[k] = d;
  }
  return m;
}

// Items that finished their pull-in this tick: growth, combo, events.
export function processCompleted(S) {
  const n = S.nCompleted;
  if (!n) return;
  S.nCompleted = 0;
  for (let j = 0; j < n; j++) completeGobble(S, S.completed[j]);
}

export function completeGobble(S, i) {
  const st = S.state, p = st.player, I = S.I, X = S.X, R = S.run;
  const ti = I.typeIndex[i];
  const type = I.types[ti];
  if (S.typeBlocked.length < I.types.length) growTypeArrays(S, I.types.length);
  // combo first, so this gobble counts
  const c = p.combo;
  c.count = c.timer > 0 ? c.count + 1 : 1;
  c.timer = TUNE.comboWindow;
  c.mult = comboMultFor(c.count);
  if (c.count > st.starProgress.maxCombo) st.starProgress.maxCombo = c.count;
  const food = X.food[i] === 1;
  const foodMult = food ? 1 + (S.species.traits.foodBonus || 0) : 1;
  const k = S.growthK;
  const s0 = p.size;
  const s1 = grow(s0, I.size[i], k, c.mult, foodMult);
  p.size = s1;
  const vol = s1 * s1 * s1 - s0 * s0 * s0;
  // remember for drops (never golden or activity treats)
  if (!I.golden[i] && !X.flag[i]) {
    R.ringIdx[R.ringHead] = i; R.ringVol[R.ringHead] = vol;
    R.ringHead = (R.ringHead + 1) % R.ringIdx.length;
    if (R.ringLen < R.ringIdx.length) R.ringLen++;
  }
  p.gulp = 1;
  R.gobbled++;
  const col = st.starProgress.collected;
  col[type] = (col[type] || 0) + 1;
  const first = R.typeSeen[ti] === 0;
  R.typeSeen[ti] = 1;
  const special = !!(S.daily && S.daily.specialItem === type);
  const golden = I.golden[i] === 1;
  const ty = S.catalogue[type];
  const value = (ty ? ty.value : 1) * (special ? 3 : 1) * (golden ? 5 : 1);
  R.biccies += value;
  if (S.mode === 'zoomies') R.score += Math.round(10 * c.count * c.mult);
  S.emit({ type: EV.GOBBLE, itemType: type, size: I.size[i], x: I.x[i], y: I.y[i], z: I.z[i], combo: c.count, golden, food, first, special, value, index: i });
  if (c.count >= 2) S.emit({ type: EV.COMBO, count: c.count, mult: c.mult });
  if (golden) {
    if (R.goldenFound.indexOf(type) < 0) R.goldenFound.push(type);
    S.emit({ type: EV.GOLDEN, itemType: type });
  }
  if (type === 'teamug' || type === 'teaurn') S.buff('tea', TUNE.teaTime);
  if (S.onGobble) S.onGobble(i, type);
  checkMilestones(S);
}

export function checkMilestones(S) {
  const st = S.state, p = st.player, R = S.run;
  const ms = S.milestones;
  while (R.nextMilestone < ms.length && p.size >= ms[R.nextMilestone]) {
    const idx = R.nextMilestone++;
    S.emit({ type: EV.MILESTONE, index: idx, size: ms[idx] });
    R.slowMoT = TUNE.slowMoTime;
    st.slowMo = 1;
    S.setCamHint('milestone', 1.0);
    R.proudT = 2.2;
  }
}

export function tickCombo(S, dt) {
  const c = S.state.player.combo;
  if (c.timer > 0) {
    c.timer -= dt;
    if (c.timer <= 0) endCombo(S);
  }
}

export function endCombo(S) {
  const c = S.state.player.combo;
  if (c.count >= 2) {
    S.emit({ type: EV.COMBO_END, count: c.count });
    S.run.biccies += Math.floor(c.count / 5);
  }
  c.count = 0; c.mult = 1; c.timer = 0;
}

// Knock loose recent gobbles. Returns how many actually dropped.
export function dropItems(S, n) {
  const st = S.state, p = st.player, I = S.I, X = S.X, R = S.run;
  let dropped = 0;
  const start = S.startSize;
  for (let k = 0; k < n && R.ringLen > 0; k++) {
    R.ringHead = (R.ringHead - 1 + R.ringIdx.length) % R.ringIdx.length;
    R.ringLen--;
    const i = R.ringIdx[R.ringHead];
    const vol = R.ringVol[R.ringHead];
    if (I.state[i] !== IS_GONE) continue;
    const s3 = p.size * p.size * p.size - vol;
    p.size = Math.max(start, Math.cbrt(Math.max(0, s3)));
    const a = S.rngFx.range(0, Math.PI * 2);
    const r = S.derived.radius + I.size[i] * 0.6;
    const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
    I.x[i] = I.px[i] = x; I.z[i] = I.pz[i] = z;
    I.y[i] = I.py[i] = p.y + S.derived.height * 0.6;
    I.scale[i] = 1; I.tilt[i] = 0;
    I.state[i] = IS_IDLE;
    const sp = Math.max(1, p.size * 3.2);
    S.items.knock(i, Math.sin(a) * sp, sp * 0.9, Math.cos(a) * sp);
    X.grace[i] = TUNE.dropGrace;
    const type = I.types[I.typeIndex[i]];
    const col = st.starProgress.collected;
    if (col[type]) col[type]--;
    dropped++;
  }
  return dropped;
}

// A bump from an item or hazard. Returns true if it landed.
export function bump(S, by, hazardKind, fromX, fromZ, strength = 1) {
  const st = S.state, p = st.player, R = S.run;
  if (S.sigMods.immune) return false;
  if (R.bumpCd > 0) return false;
  R.bumpCd = TUNE.bumpCooldown;
  const tr = S.species.traits;
  let n = 0;
  if (!S.assist && !tr.noDrops && S.mode !== 'chill') n = dropCount(S.rngFx.int(1, 3), tr.dropMult == null ? 1 : tr.dropMult);
  const dropped = dropItems(S, n);
  let dx = p.x - fromX, dz = p.z - fromZ;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); } else { dx /= d; dz /= d; }
  const kb = S.derived.top * 0.9 * strength;
  p.vx = dx * kb; p.vz = dz * kb;
  if (p.grounded) { p.vy = Math.sqrt(2 * S.derived.gravity * p.size * 0.15 * strength); p.grounded = false; p.airborne = true; R.airT = 0.0001; }
  R.moveSpeed = 0;
  p.stagger = TUNE.stagger * (0.6 + 0.4 * strength);
  endCombo(S);
  R.scaredT = 1.6;
  S.emit({ type: EV.BUMP, dropped, by, hazardKind: hazardKind || undefined, x: p.x, z: p.z });
  return true;
}

// The player's body against items: walk over low ones, brush and wobble near
// ones, knock almost-sized ones about, and bonk into the big ones.
export function playerItemContacts(S, dt) {
  const st = S.state, p = st.player, I = S.I, X = S.X, R = S.run, D = S.derived;
  if (st.phase === 'intro') return;
  const r = D.radius;
  const n = S.items.query(p.x, p.z, r * 1.4);
  const buf = S.scratchIdx;
  let m = 0;
  const hits = S.items.G.hits;
  for (let j = 0; j < n && m < buf.length; j++) buf[m++] = hits[j];
  const top = D.top;
  const speed = Math.hypot(p.vx, p.vz);
  const heavy = S.species.signature && S.species.signature.kind === 'trunkHoover';
  const rolling = S.sigMods.rolling;
  for (let j = 0; j < m; j++) {
    const i = buf[j];
    const s = I.state[i];
    if (s >= IS_GOBBLING) continue;
    if (s === IS_TUMBLE && X.grace[i] > 0) continue;
    if (I.gobbleable[i]) continue;
    const ir = X.radius[i];
    const dx = I.x[i] - p.x, dz = I.z[i] - p.z;
    const rr = r + ir;
    const d2 = dx * dx + dz * dz;
    if (d2 > rr * rr * 1.69) continue;
    const itop = I.y[i] + X.height[i];
    if (itop < p.y - 0.02 || I.y[i] > p.y + D.height) continue;
    const d = Math.sqrt(d2) || 1e-4;
    const nx = dx / d, nz = dz / d;
    const vrel = p.vx * nx + p.vz * nz;
    if (itop - p.y <= D.stepUp) {
      // low: walk over it with a little wobble
      if (d < rr && speed > p.size * 0.3 && s === IS_IDLE) S.items.wobble(i, 0.8 + speed / Math.max(0.2, p.size) * 0.15, p.vx, p.vz);
      continue;
    }
    if (d >= rr) {
      if (speed > top * 0.3 && s === IS_IDLE) S.items.wobble(i, 0.35, nx, nz);
      continue;
    }
    const big = I.size[i];
    const knockable = I.almost[i] || (heavy && big <= p.size * 1.2) || (rolling && big <= p.size * 1.1) || (S.sigMods.immune && big <= p.size * 0.9);
    if (knockable) {
      if (vrel > 0.05 * top) {
        const k = Math.min(1.4, p.size / Math.max(0.05, big)) * (heavy || rolling ? 1.5 : 1);
        S.items.knock(i, p.vx * 0.8 * k + nx * vrel * 0.4, vrel * 0.35 * k, p.vz * 0.8 * k + nz * vrel * 0.4);
        X.grace[i] = 0;
        R.moveSpeed *= heavy || rolling ? 0.97 : 0.8;
      }
      const push = (rr - d) * 0.5;
      p.x -= nx * push; p.z -= nz * push;
      if (I.almost[i] && R.almostCd <= 0) {
        R.almostCd = 1.6;
        S.emit({ type: EV.ALMOST, itemType: I.types[I.typeIndex[i]], index: i });
      }
      continue;
    }
    // solid
    const push = rr - d;
    p.x -= nx * push; p.z -= nz * push;
    if (vrel > 0) { p.vx -= nx * vrel; p.vz -= nz * vrel; R.moveSpeed *= 0.6; }
    if (vrel > TUNE.bumpSpeed * top && R.bumpCd <= 0) {
      S.items.wobble(i, 2.5 + vrel / Math.max(0.2, p.size), nx, nz);
      bump(S, 'item', null, I.x[i], I.z[i], 0.8);
    } else if (vrel > 0.08 * top && s === IS_IDLE) {
      S.items.wobble(i, 0.6 + vrel / Math.max(0.2, big), nx, nz);
    }
  }
}
