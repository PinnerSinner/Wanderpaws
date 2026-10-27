// Hazards: gentle tension, never fatal. A generic engine (regions, touch with a
// cooldown, near misses, calm from the chill aura, half speed in assist) plus
// one small behaviour per kind.
import { EV } from '../core/events.js';
import { TAU, clamp01 } from '../core/math.js';
import { bump, dropItems } from './gobble.js';
import { compileRegion, inRegion, normPath } from './util.js';
import { spawnProjectile } from './npcs.js';
import { hypot } from './util.js';

export const HAZARD_KINDS = ['tide', 'cyclist', 'pigeons', 'puddle', 'hose', 'jogger', 'slipperyRock', 'toucan', 'marmoset', 'thinIce', 'snowballKids', 'highlandCow', 'firewall', 'lagZone', 'packetLoss'];

const MOVING = { cyclist: 1, jogger: 1, toucan: 1, marmoset: 1, snowballKids: 1, highlandCow: 1 };

export function resetHazMods(H) { H.speed = 1; H.grip = 1; H.pushX = 0; H.pushZ = 0; H.lag = 0; return H; }

// Firewalls become real colliders so they block like walls.
export function hazardColliders(world) {
  const out = [];
  (world.hazards || []).forEach((h, i) => {
    if (h && h.kind === 'firewall') out.push({ kind: 'box', x: +h.x || 0, z: +h.z || 0, w: +h.w || 10, d: +h.d || 1.5, h: +h.h || 6, rot: +h.rot || 0, tag: `hz:${i}` });
  });
  return out;
}

export function createHazards(S) {
  const rng = S.rng.fork('hazards');
  const list = [];
  const pub = [];
  const defs = S.world.hazards || [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i] || {};
    const kind = d.kind;
    const h = {
      kind, def: d, region: compileRegion(d.region || d, d.r || 3),
      touchCd: 0, nearCd: 0, inside: false, near: false, t: rng.range(0, 5), level: 0, calm: 0,
      npcs: [], colliders: [], state: 0, timer: rng.range(3, 8), angle: +d.yaw || 0, active: true,
      sx: 0, sy: 0, sz: 0, tx: 0, tz: 0, u: 0, grace: 0,
    };
    const P = { kind, x: h.region.x, z: h.region.z, r: h.region.r, active: true, calm: 0, t: 0, level: 0, yaw: h.angle, npc: null };
    if (kind === 'cyclist' || kind === 'jogger') {
      const n = S.npcs.add({ id: d.id || `${kind}${i}`, mesh: d.mesh || kind, human: true, x: d.x || 0, z: d.z || 0, behaviour: 'pathLoop', params: { path: d.path, speed: d.speed || (kind === 'cyclist' ? 6.5 : 3.2), pingPong: d.pingPong } });
      if (!n.path) { n.path = normPath([{ x: (d.x || 0) - 15, z: d.z || 0 }, { x: (d.x || 0) + 15, z: d.z || 0 }]); n.params.pingPong = true; }
      n.x = n.path[0]; n.z = n.path[1]; n.pathIdx = 1;
      n.hazard = i; n.radius = kind === 'cyclist' ? 0.6 : 0.35; h.npcs.push(n); P.npc = n.id;
    } else if (kind === 'toucan' || kind === 'marmoset' || kind === 'highlandCow') {
      const mesh = kind === 'highlandCow' ? 'highlandcow' : kind;
      const n = S.npcs.add({ id: d.id || `${kind}${i}`, mesh, human: false, x: d.x || 0, z: d.z || 0, yaw: d.yaw || 0, behaviour: 'idle' });
      n.hazard = i; h.npcs.push(n); P.npc = n.id;
      if (kind === 'marmoset') h.timer = 1;
      n.perches = normPath(d.perches) || null;
      if (kind === 'highlandCow') n.radius = +(d.r || 1.1);
    } else if (kind === 'snowballKids') {
      const c = Math.max(1, Math.min(4, d.count || 2));
      for (let k = 0; k < c; k++) {
        const a = (k / c) * TAU;
        const n = S.npcs.add({ id: `${d.id || 'kid'}${i}_${k}`, mesh: 'kid', human: true, x: (d.x || 0) + Math.sin(a) * 1.5, z: (d.z || 0) + Math.cos(a) * 1.5, behaviour: 'idle' });
        n.hazard = i; n.throwT = rng.range(1, 4); h.npcs.push(n);
      }
      P.npc = h.npcs[0].id;
    }
    list.push(h); pub.push(P);
  }
  // link pigeon squads
  if (S.birds) for (const fl of S.birds.flocks) if (fl.squad && fl.hazardDef) fl.hazardIndex = defs.indexOf(fl.hazardDef);
  // firewall collider indices
  for (let c = 0; c < S.col.count; c++) {
    const tg = S.col.tag[c];
    if (typeof tg === 'string' && tg.startsWith('hz:')) { const hi = +tg.slice(3); if (list[hi]) list[hi].colliders.push(c); }
  }
  S.npcs.reindex();
  return { list, pub, rng };
}

function lovesWater(S) {
  const sp = S.species;
  return sp.floats || ((sp.affinity && sp.affinity.surfaces && sp.affinity.surfaces.water) || 0) > 1;
}

// A touch: counts against "touch no hazards", emits HAZARD, and bumps unless soft.
export function touchHazard(S, hi, x, z, strength) {
  const Hz = S.hazards; if (!Hz) return false;
  const h = Hz.list[hi]; if (!h) return false;
  if (h.calm > 0 || S.sigMods.immune || h.touchCd > 0 || S.state.phase !== 'play') return false;
  h.touchCd = 1.5;
  S.state.starProgress.hazardsTouched++;
  S.run.hazardsTouched++;
  S.emit({ type: EV.HAZARD, kind: h.kind, x, z });
  if (strength > 0) bump(S, 'hazard', h.kind, x, z, strength);
  else S.run.scaredT = Math.max(S.run.scaredT, 0.6);
  return true;
}

export function stepHazards(S, dt) {
  const Hz = S.hazards; if (!Hz) return;
  const st = S.state, p = st.player, M = S.sigMods, H = S.hazMods, D = S.derived;
  const assistK = S.assist ? 0.5 : 1;
  const P = S.npcs.P;
  if (st.phase === 'intro') return;
  for (let i = 0; i < Hz.list.length; i++) {
    const h = Hz.list[i], pb = Hz.pub[i], d = h.def, g = h.region;
    h.t += dt; if (h.touchCd > 0) h.touchCd -= dt; if (h.nearCd > 0) h.nearCd -= dt;
    // position for moving ones
    if (h.npcs.length) { pb.x = h.npcs[0].x; pb.z = h.npcs[0].z; }
    h.calm = M.calmR > 0 && hypot(pb.x - M.calmX, pb.z - M.calmZ) < M.calmR + pb.r ? 1 : Math.max(0, h.calm - dt * 0.5);
    pb.calm = h.calm; pb.t = h.t;
    const calm = h.calm > 0;
    switch (h.kind) {
      case 'tide': {
        if (S.species.swims || S.species.floats) break;
        const wet = p.inWater && p.waterDepth > D.height * 0.15;
        if (wet && !h.inside) touchHazard(S, i, p.x, p.z, 0);
        h.inside = wet;
        break;
      }
      case 'cyclist': case 'jogger': {
        const n = h.npcs[0];
        const spd = +(d.speed || (h.kind === 'cyclist' ? 6.5 : 3.2)) * assistK;
        if (calm) { n.speed = 0; n.anim = 'idle'; break; }
        movePath(S, n, spd, dt);
        n.anim = h.kind === 'cyclist' ? 'run' : 'run';
        pb.yaw = n.yaw;
        contactNpc(S, h, i, n, 1);
        break;
      }
      case 'pigeons': break; // boids squad
      case 'puddle': case 'packetLoss': case 'lagZone': case 'slipperyRock': {
        const grow = h.kind === 'puddle' && st.weather.kind === 'rain' ? 1 + 0.3 * st.weather.intensity : 1;
        const inside = p.grounded && inRegion(g, p.x, p.z, -D.radius * 0.3 + (grow - 1) * g.r) && p.size < g.r * 4;
        pb.level = grow;
        if (h.kind === 'puddle') {
          if (inside) {
            if (lovesWater(S)) { H.speed *= 1.1; S.run.happyT = 1; }
            else { H.speed *= 0.6; if (!h.inside) touchHazard(S, i, p.x, p.z, 0); }
            if (!h.inside) S.emit({ type: EV.SPLASH, x: p.x, z: p.z, size: p.size, puddle: true });
          }
        } else if (h.kind === 'slipperyRock') {
          if (inside) { H.grip *= 0.18; if (!h.inside && p.speed > D.top * 0.5) touchHazard(S, i, p.x, p.z, 0); }
        } else if (h.kind === 'lagZone') {
          if (inside) H.lag = 1;
        } else {
          if (inside) {
            H.speed *= 0.7;
            if (!h.inside && touchHazard(S, i, p.x, p.z, 0) && !S.assist && !S.species.traits.noDrops && S.mode !== 'chill') {
              const n = dropItems(S, 1);
              if (n) S.emit({ type: EV.BUMP, dropped: n, by: 'hazard', hazardKind: 'packetLoss', x: p.x, z: p.z });
            }
          }
        }
        h.inside = inside;
        break;
      }
      case 'hose': {
        const len = +(d.len || 6), arc = +(d.arc || 1.2), per = +(d.period || 4) / assistK;
        if (!calm) h.angle = (+d.yaw || 0) + Math.sin((TAU * h.t) / per) * arc * 0.5;
        pb.yaw = h.angle; pb.active = !calm; pb.r = len;
        if (calm) break;
        const fx = Math.sin(h.angle), fz = Math.cos(h.angle);
        const ox = p.x - g.x, oz = p.z - g.z;
        const along = ox * fx + oz * fz;
        if (along < 0 || along > len) { h.near = false; break; }
        const perp = Math.abs(ox * fz - oz * fx);
        if (perp < D.radius + 0.35) {
          if (lovesWater(S)) { S.run.happyT = 1; H.pushX += fx * 1.5; H.pushZ += fz * 1.5; }
          else if (touchHazard(S, i, g.x, g.z, 0.7)) S.emit({ type: EV.SPLASH, x: p.x, z: p.z, size: p.size });
        } else nearMiss(S, h, perp < D.radius + 1.6);
        break;
      }
      case 'toucan': stepToucan(S, h, i, dt, calm); break;
      case 'marmoset': stepMarmoset(S, h, i, dt, calm); break;
      case 'thinIce': {
        const inside = p.grounded && inRegion(g, p.x, p.z, -D.radius * 0.5);
        if (inside && !calm) {
          h.level += dt * (0.12 + p.speedNorm * 0.6 + (p.size > g.r ? 1.5 : 0)) + (S.run.landedThisTick ? 0.35 * p.landImpact + 0.15 : 0);
          H.grip *= 0.3;
          if (h.level >= 1) {
            h.level = 0.35;
            if (touchHazard(S, i, g.x, g.z, 0.6)) { p.vy = Math.sqrt(2 * D.gravity * p.size * 0.6); p.grounded = false; S.run.airT = 0.0001; }
            S.emit({ type: EV.SPLASH, x: p.x, z: p.z, size: p.size, ice: true });
          }
        } else h.level = Math.max(0, h.level - dt * 0.15);
        pb.level = h.level;
        break;
      }
      case 'snowballKids': {
        const range = +(d.range || 14) + p.size * 2;
        for (let q = 0; q < h.npcs.length; q++) { const n = h.npcs[q];
          const dx = p.x - n.x, dz = p.z - n.z, dd = hypot(dx, dz);
          n.yaw = Math.atan2(dx, dz);
          if (calm) { n.anim = 'sit'; continue; }
          n.throwT -= dt * assistK;
          if (n.throwT < 0.4 && n.throwT + dt * assistK >= 0.4) n.anim = 'throw';
          if (n.throwT <= 0) {
            n.throwT = Hz.rng.range(2.5, 4.5);
            n.anim = 'idle';
            if (dd < range && st.phase === 'play') {
              const tf = 0.9 + dd * 0.03;
              const lead = 0.5;
              const tx = p.x + p.vx * tf * lead, tz = p.z + p.vz * tf * lead;
              const g2 = 9.8 * S.gravityScale;
              const sy = n.y + 1.3, ty = p.y + D.height * 0.5;
              const vy = (ty - sy + 0.5 * g2 * tf * tf) / tf;
              const pi = spawnProjectile(S, 2, n.x, sy, n.z, (tx - n.x) / tf, vy, (tz - n.z) / tf, i);
              if (pi >= 0) S.emit({ type: EV.HAZARD, kind: 'snowballThrow', x: n.x, z: n.z });
            }
          }
        }
        // snowball hits
        for (let k = 0; k < P.count; k++) {
          if (P.kind[k] !== 2 || P.owner[k] !== i) continue;
          const dx = P.x[k] - p.x, dy = P.y[k] - (p.y + D.height * 0.5), dz = P.z[k] - p.z;
          const dd = hypot(dx, dy, dz);
          if (dd < D.radius + Math.max(0.25, D.height * 0.5)) { touchHazard(S, i, P.x[k], P.z[k], 0.5); P.kind[k] = 0; }
          else nearMiss(S, h, dd < D.radius + 1.2);
        }
        break;
      }
      case 'highlandCow': {
        const n = h.npcs[0];
        n.solid = !calm || true;
        if (S.run.barked && hypot(p.x - n.x, p.z - n.z) < 6 + p.size * 3 && h.state === 0) {
          h.state = 1; const a = Math.atan2(n.x - p.x, n.z - p.z) + (Hz.rng.chance(0.5) ? 1.2 : -1.2);
          n.tx = n.x + Math.sin(a) * 4; n.tz = n.z + Math.cos(a) * 4; h.timer = 4;
        }
        if (h.state === 1) {
          h.timer -= dt;
          const dx = n.tx - n.x, dz = n.tz - n.z, dd = hypot(dx, dz);
          if (dd > 0.05) { const s = Math.min(dd, 0.9 * dt); n.x += dx / dd * s; n.z += dz / dd * s; n.yaw = Math.atan2(dx, dz); n.anim = 'walk'; n.speed = 0.9; }
          if (dd <= 0.05 || h.timer <= 0) { h.state = 0; n.anim = 'idle'; n.speed = 0; }
        } else {
          h.timer -= dt;
          if (h.timer <= 0) { h.timer = Hz.rng.range(4, 9); n.anim = n.anim === 'peck' ? 'idle' : 'peck'; n.yaw += Hz.rng.range(-0.5, 0.5); }
        }
        n.y = S.terrain.heightAt(n.x, n.z);
        // bumping into the cow at speed: a gentle, stubborn shove
        const dx = p.x - n.x, dz = p.z - n.z, dd = hypot(dx, dz);
        if (dd < D.radius + n.radius + 0.05 && n.height > D.stepUp) {
          const into = -(p.vx * dx + p.vz * dz) / (dd || 1);
          if (into > D.top * 0.35) touchHazard(S, i, n.x, n.z, 0.4);
        }
        break;
      }
      case 'firewall': {
        const open = d.openFlag ? !!st.flags[d.openFlag] : false;
        pb.active = !open;
        for (const c of h.colliders) S.col.enabled[c] = open ? 0 : 1;
        break;
      }
      default: break;
    }
  }
}

// Called by the player when it hits a static collider.
export function onWall(S, ci, vn) {
  const Hz = S.hazards; if (!Hz || ci < 0) return;
  const tg = S.col.tag[ci];
  if (typeof tg !== 'string' || !tg.startsWith('hz:')) return;
  const hi = +tg.slice(3);
  const h = Hz.list[hi];
  if (h && h.kind === 'firewall') touchHazard(S, hi, S.col.cx[ci], S.col.cz[ci], 1.1);
}

function nearMiss(S, h, isNear) {
  if (isNear && !h.near && h.nearCd <= 0 && h.touchCd <= 0 && S.state.phase === 'play') {
    h.nearCd = 3;
    S.emit({ type: EV.NEAR_MISS, hazardKind: h.kind });
  }
  h.near = isNear;
}

function contactNpc(S, h, i, n, strength) {
  const p = S.state.player, D = S.derived;
  if (D.stepUp > n.height * 1.1) { h.near = false; return; } // you're a giant now: they ride between your paws
  const dx = p.x - n.x, dz = p.z - n.z;
  const dd = hypot(dx, dz);
  if (dd < D.radius + n.radius + 0.1 && p.y < n.y + n.height) touchHazard(S, i, n.x, n.z, strength);
  else nearMiss(S, h, dd < D.radius + n.radius + 1.4);
}

function movePath(S, n, spd, dt) {
  const Pth = n.path; if (!Pth) return;
  const np = Pth.length / 2;
  const tx = Pth[n.pathIdx * 2], tz = Pth[n.pathIdx * 2 + 1];
  const dx = tx - n.x, dz = tz - n.z, d = hypot(dx, dz);
  if (d < 0.05) {
    if (n.params.pingPong) { if (n.pathIdx + n.pathDir >= np || n.pathIdx + n.pathDir < 0) n.pathDir = -n.pathDir; n.pathIdx += n.pathDir; }
    else n.pathIdx = (n.pathIdx + 1) % np;
    return;
  }
  const s = Math.min(d, spd * dt);
  n.x += dx / d * s; n.z += dz / d * s;
  n.yaw = Math.atan2(dx, dz); n.speed = spd;
  n.y = S.terrain.heightAt(n.x, n.z);
}

function stepToucan(S, h, i, dt, calm) {
  const n = h.npcs[0], p = S.state.player, d = h.def;
  const ground = S.terrain.heightAt(n.x, n.z);
  if (h.state === 0) {
    n.y = ground + (n.perches ? 2.5 : 1.2);
    n.anim = 'idle'; n.speed = 0;
    n.yaw = Math.atan2(p.x - n.x, p.z - n.z);
    h.timer -= dt * (S.assist ? 0.5 : 1);
    const dd = hypot(p.x - n.x, p.z - n.z);
    if (h.timer <= 0 && !calm && dd < 12 + p.size * 3 && S.state.phase === 'play' && S.derived.stepUp < 2) {
      h.state = 1; h.sx = n.x; h.sz = n.z; h.sy = n.y; h.u = 0; h.tx = p.x; h.tz = p.z;
      S.emit({ type: EV.HAZARD, kind: 'toucanSwoop', x: n.x, z: n.z });
    } else if (h.timer <= 0) h.timer = 2;
  } else {
    // swoop to where you were, then back to a perch
    h.u += dt * (S.assist ? 0.5 : 1) / 1.6;
    const u = Math.min(1, h.u);
    const out = u < 0.5 ? u * 2 : (1 - u) * 2;
    const ex = h.state === 1 ? h.tx : h.sx, ez = h.state === 1 ? h.tz : h.sz;
    n.x = h.sx + (ex - h.sx) * out; n.z = h.sz + (ez - h.sz) * out;
    n.y = ground + 0.5 + (1 - out) * 2;
    n.anim = 'fly'; n.speed = 6;
    if (h.state === 1 && !calm) {
      const dd = hypot(p.x - n.x, p.z - n.z);
      if (dd < S.derived.radius + 0.4 && n.y < p.y + S.derived.height + 0.3) touchHazard(S, i, n.x, n.z, 0.5);
      else nearMiss(S, h, dd < S.derived.radius + 1.3);
    }
    if (u >= 1) {
      h.state = 0; h.timer = h.def.every || 9;
      if (n.perches) { const np = n.perches.length / 2; n.pathIdx = (n.pathIdx + 1) % np; n.x = n.perches[n.pathIdx * 2]; n.z = n.perches[n.pathIdx * 2 + 1]; }
      else { n.x = h.sx; n.z = h.sz; }
    }
  }
  void d;
}

function stepMarmoset(S, h, i, dt, calm) {
  const n = h.npcs[0], p = S.state.player, D = S.derived, flags = S.state.flags;
  const g = h.region;
  const dx = p.x - n.x, dz = p.z - n.z, dd = hypot(dx, dz);
  n.y = S.terrain.heightAt(n.x, n.z);
  if (h.timer > 0) h.timer -= dt;
  if (calm) { n.anim = 'sit'; n.speed = 0; }
  else if (!flags.hatStolen) {
    // lurk, then dash in and nick the hat
    if (dd < 5 + p.size && h.timer <= 0 && S.state.phase === 'play' && D.stepUp < 1) {
      const s = Math.min(dd, (4 + p.size * 2) * dt * (S.assist ? 0.5 : 1));
      n.x += dx / (dd || 1) * s; n.z += dz / (dd || 1) * s; n.yaw = Math.atan2(dx, dz); n.anim = 'run'; n.speed = 4;
      if (dd < D.radius + 0.3) {
        flags.hatStolen = true;
        h.grace = 1.2;
        S.state.starProgress.hazardsTouched++; S.run.hazardsTouched++;
        S.emit({ type: EV.HAZARD, kind: 'marmoset', stolen: true, x: n.x, z: n.z });
      }
    } else { n.anim = 'idle'; n.speed = 0; }
  } else {
    // run away, staying roughly in its patch; catch it to get the hat back
    const fleeSp = Math.max(1.5, D.top * 0.85) * (S.assist ? 0.6 : 1);
    if (dd < 8 + p.size * 3) {
      let fx = -dx / (dd || 1), fz = -dz / (dd || 1);
      const hx = g.x - n.x, hz = g.z - n.z, hd = hypot(hx, hz);
      if (hd > g.r * 3) { fx += hx / hd * 1.5; fz += hz / hd * 1.5; const l = hypot(fx, fz) || 1; fx /= l; fz /= l; }
      n.x += fx * fleeSp * dt; n.z += fz * fleeSp * dt; n.yaw = Math.atan2(fx, fz); n.anim = 'run'; n.speed = fleeSp;
      const b = S.terrain.bounds;
      n.x = Math.max(b.minX, Math.min(b.maxX, n.x)); n.z = Math.max(b.minZ, Math.min(b.maxZ, n.z));
    } else { n.anim = 'idle'; n.speed = 0; }
    if (h.grace > 0) h.grace -= dt;
    else if (dd < D.radius + 0.45) {
      flags.hatStolen = false;
      h.timer = 30;
      S.run.biccies += 5;
      S.emit({ type: EV.ACTIVITY, kind: 'marmoset', phase: 'success', reward: 5 });
    }
  }
  void clamp01;
}
