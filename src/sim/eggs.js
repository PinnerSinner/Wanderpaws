// Easter eggs: each world egg gets its own ctx (CONTRACTS §5.3) and sees every
// sim event. Eggs are data plus small functions, so they're guarded: an egg
// that throws is switched off and noted in sim.debug, never takes the run down.
import { EV } from '../core/events.js';
import { IS_HIDDEN } from './items.js';

export function createEggs(S) {
  const eggs = (S.world.eggs || []).filter((e) => e && e.id);
  const found = new Set();
  const list = [];
  for (const egg of eggs) {
    const rng = S.rng.fork('egg:' + egg.id);
    const ctx = makeCtx(S, egg, rng, found);
    list.push({ egg, ctx, dead: false });
  }
  const E = { list, found, dispatching: false };
  for (const e of list) safe(S, e, 'init', () => e.egg.init && e.egg.init(e.ctx));
  return E;
}

function safe(S, e, what, fn) {
  if (e.dead) return;
  try { fn(); } catch (err) {
    e.dead = true;
    S.debug.eggErrors.push(`${e.egg.id}.${what}: ${err && err.message}`);
    S.warn(`egg ${e.egg.id} threw in ${what}: ${err && err.message}`);
  }
}

function makeCtx(S, egg, rng, foundSet) {
  const st = S.state;
  const ctx = {
    state: st,
    player: st.player,
    species: S.species,
    worldId: st.worldId,
    rng,
    egg,
    get time() { return st.time; },
    get events() { return S.events; },
    found() {
      if (foundSet.has(egg.id)) return false;
      foundSet.add(egg.id);
      S.run.eggsFound.push(egg.id);
      S.emit({ type: EV.EGG, id: egg.id, worldId: st.worldId });
      return true;
    },
    isFound() { return foundSet.has(egg.id); },
    flag(key, value) {
      if (value === undefined) return st.flags[key];
      st.flags[key] = value;
      return value;
    },
    zone(id) { return st.zones[id] || S.emptyZone; },
    stillTime() { return S.run.stillT; },
    dist(x, z) { return Math.hypot(st.player.x - x, st.player.z - z); },
    spawnItem(type, x, z, opts) {
      const o = opts || {};
      return S.items.spawn(type, x, z, { golden: !!o.golden, drop: o.drop !== false, size: o.size });
    },
    revealItem(flag) {
      const I = S.I, X = S.X;
      let n = 0;
      for (let i = 0; i < I.count; i++) if (I.state[i] === IS_HIDDEN && X.flag[i] === flag) { S.items.reveal(i, true); n++; }
      return n;
    },
    say(speaker, key, vars) {
      const n = S.npcs.index(speaker) || S.npcs.list.find((m) => m.speakerId === speaker || m.kind === speaker) || null;
      const ev = { type: EV.SAY, speaker, key };
      if (vars) ev.vars = vars;
      if (n) { ev.x = n.x; ev.y = n.y + (n.human ? 1.9 : n.height + 0.2); ev.z = n.z; ev.anchor = n.id; }
      else { ev.x = st.player.x; ev.y = st.player.y + S.derived.height; ev.z = st.player.z; ev.anchor = 'player'; }
      S.emit(ev);
    },
    buff(kind, seconds) { S.buff(kind, seconds); },
    npc(id) { return S.npcs.index(id); },
    setNpcAnim(id, anim) { const n = S.npcs.index(id); if (n) { n.anim = anim; n.animT = 0; n.holdT = 2.5; } return !!n; },
    emit(ev) { if (ev && ev.type) S.emit(ev); },
  };
  return ctx;
}

// Feed events emitted since `from` to every egg. Events eggs emit are fed too
// (bounded, so a chatty egg can't loop forever).
export function dispatchEggs(S, from) {
  const E = S.eggs; if (!E || !E.list.length) return;
  const evs = S.events;
  let i = from, guard = 0;
  while (i < evs.length && guard < 400) {
    const ev = evs[i++]; guard++;
    for (let k = 0; k < E.list.length; k++) {
      const e = E.list[k];
      if (e.dead || !e.egg.onEvent) continue;
      try { e.egg.onEvent(ev, e.ctx); } catch (err) { e.dead = true; S.debug.eggErrors.push(`${e.egg.id}.onEvent: ${err && err.message}`); }
    }
  }
}

export function tickEggs(S, dt) {
  const E = S.eggs; if (!E) return;
  for (let k = 0; k < E.list.length; k++) {
    const e = E.list[k];
    if (e.dead || !e.egg.tick) continue;
    try { e.egg.tick(e.ctx, dt); } catch (err) { e.dead = true; S.debug.eggErrors.push(`${e.egg.id}.tick: ${err && err.message}`); }
  }
}
