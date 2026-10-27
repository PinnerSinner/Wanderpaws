// Shared building blocks for easter eggs (CONTRACTS §5.3). Every egg is a plain
// object with optional init / onEvent / tick functions that only talk to the
// world through ctx. Keep ticks cheap: early-out once found.

import { EV } from '../../core/events.js';

export { EV };

// Base egg record with the standard copy keys.
export function egg(id, world, body = {}) {
  return {
    id, world,
    nameKey: `egg.${id}.name`,
    descKey: `egg.${id}.desc`,
    hintKey: `egg.${id}.hint`,
    ...body,
  };
}

// Copy keys an egg says, declared so tests can check they all exist.
// lines: array of keys (strings).
export function withLines(e, lines) { e.lines = lines; return e; }

const TAU = Math.PI * 2;

export function distXZ(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

// Find an npc by id, falling back to the first npc of that kind.
export function findNpc(ctx, idOrKind) {
  const n = ctx.npc ? ctx.npc(idOrKind) : null;
  if (n) return n;
  const list = ctx.state && ctx.state.npcs;
  if (!list) return null;
  for (let i = 0; i < list.length; i++) if (list[i].kind === idOrKind || list[i].id === idOrKind) return list[i];
  return null;
}

export function npcDist(ctx, idOrKind) {
  const n = findNpc(ctx, idOrKind);
  return n ? ctx.dist(n.x, n.z) : Infinity;
}

// Indices of live items of a type, optionally within r of (x, z).
export function findItems(ctx, type, x, z, r) {
  const it = ctx.state && ctx.state.items;
  const out = [];
  if (!it) return out;
  const ti = it.types ? it.types.indexOf(type) : -1;
  if (ti < 0) return out;
  for (let i = 0; i < it.count; i++) {
    if (it.typeIndex[i] !== ti) continue;
    if (it.state[i] >= 3) continue;
    if (r != null && distXZ(it.x[i], it.z[i], x, z) > r) continue;
    out.push(i);
  }
  return out;
}

export const isGobble = (ev, type) => ev.type === EV.GOBBLE && (!type || ev.itemType === type);
export const near = (ev, x, z, r) => ev.x != null && distXZ(ev.x, ev.z, x, z) <= r;

// The player has stood still inside a zone for `secs`.
export function stillInZone(ctx, zoneId, secs) {
  const z = ctx.zone(zoneId);
  return !!(z && z.inside && ctx.stillTime() >= secs);
}

// Speech helper with an optional per-egg cooldown stored in flags.
export function sayOnce(ctx, speaker, key, vars, cooldown = 6) {
  const fk = `say:${key}`;
  const last = ctx.flag(fk);
  const now = ctx.state.time;
  if (last != null && now - last < cooldown) return false;
  ctx.flag(fk, now);
  ctx.say(speaker, key, vars);
  return true;
}

export function playerName(ctx) {
  return (ctx.state && ctx.state.playerName) || 'Oli';
}

// ---- factories for the common shapes --------------------------------------

// Stand still in a zone for secs: found, say a line, optional buff and extra.
export function zoneEgg(id, world, { zone, secs = 2, speaker = 'narrator', line, lines, vars, buff, after, cond }) {
  const e = egg(id, world, {
    tick(ctx) {
      if (ctx.isFound()) return;
      if (cond && !cond(ctx)) return;
      if (!stillInZone(ctx, zone, secs)) return;
      ctx.found();
      if (line) ctx.say(speaker, line, typeof vars === 'function' ? vars(ctx) : vars);
      if (buff) ctx.buff(buff[0], buff[1]);
      if (after) after(ctx);
    },
  });
  return withLines(e, lines || (line ? [line] : []));
}

// Gobble a given type (optionally near a spot): found plus a line.
export function gobbleEgg(id, world, { type, x, z, r, speaker = 'narrator', line, lines, cond, after }) {
  const e = egg(id, world, {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.GOBBLE || ev.itemType !== type) return;
      if (r != null && !near(ev, x, z, r)) return;
      if (cond && !cond(ctx, ev)) return;
      ctx.found();
      if (line) ctx.say(speaker, line);
      if (after) after(ctx, ev);
    },
  });
  return withLines(e, lines || (line ? [line] : []));
}

// Come within r of an npc: found plus a line.
export function npcEgg(id, world, { npc, r = 4, speaker, line, lines, anim, cond, after }) {
  const e = egg(id, world, {
    tick(ctx) {
      if (ctx.isFound()) return;
      if ((ctx.state.tick & 7) !== 0) return; // eight times a second is plenty
      if (cond && !cond(ctx)) return;
      if (npcDist(ctx, npc) > r) return;
      ctx.found();
      if (anim) ctx.setNpcAnim(npc, anim);
      if (line) ctx.say(speaker || npc, line);
      if (after) after(ctx);
    },
  });
  return withLines(e, lines || (line ? [line] : []));
}

// N barks (or play-bows) within `window` seconds near a point or npc.
export function countEvents(ctx, key, now, window) {
  let arr = ctx.flag(key);
  if (!arr) { arr = []; ctx.flag(key, arr); }
  arr.push(now);
  while (arr.length && now - arr[0] > window) arr.shift();
  return arr.length;
}

// ---- globals: G8 (Tea Time) and G9 (Gerald's disguise) --------------------

// G8: every tea mug (and W5's tea urn) gives a 6 s Tea Time buff. London's water
// doubles it (L13 sets flags.teaMult).
export function teaTimeEgg(worldId, types = ['teamug']) {
  return withLines(egg('G8', 'all', {
    onEvent(ev, ctx) {
      if (ev.type !== EV.GOBBLE || !types.includes(ev.itemType)) return;
      const mult = ctx.flag('teaMult') || 1;
      ctx.buff('tea', 6 * mult);
      const n = (ctx.flag('G8.cups') || 0) + 1;
      ctx.flag('G8.cups', n);
      if (!ctx.isFound()) { ctx.found(); ctx.say('player', 'egg.G8.line1'); }
      else if (n === 5) ctx.say('player', 'egg.G8.line2');
    },
  }), ['egg.G8.line1', 'egg.G8.line2']);
}

// G9: Gerald turns up in every world in a new disguise. Bark at him (or get close
// for 2 s) to rumble it.
export function geraldDisguiseEgg(worldId) {
  const key = `egg.G9.${worldId}`;
  return withLines(egg('G9', 'all', {
    onEvent(ev, ctx) {
      if (ctx.isFound() || ev.type !== EV.BARK) return;
      if (npcDist(ctx, 'gerald') > Math.max(7, ctx.player.size * 2.5)) return;
      ctx.found();
      ctx.say('gerald', key);
    },
    tick(ctx) {
      if (ctx.isFound() || (ctx.state.tick & 7) !== 0) return;
      const d = npcDist(ctx, 'gerald');
      const t = ctx.flag('G9.near') || 0;
      if (d < 3.5 * Math.max(1, ctx.player.size)) {
        ctx.flag('G9.near', t + 8 / 60);
        if (t > 2) { ctx.found(); ctx.say('gerald', key); }
      } else if (t) ctx.flag('G9.near', 0);
    },
  }), [key]);
}

export { TAU };
