// A tiny stand-in for the sim's egg context (CONTRACTS §5.3), for tests.
import { createRng } from '../../src/core/rng.js';
import { SPECIES } from '../../src/animals/species.js';

export function makeHarness(world, { speciesId = 'oli', mode = 'story' } = {}) {
  const npcs = [...world.cast, ...world.crowd].map((c, i) => ({ id: c.id || `npc${i}`, kind: c.kind === 'human' || c.kind === 'critter' ? (c.mesh || c.kind) : c.kind, x: c.x, z: c.z, yaw: c.yaw || 0, anim: 'idle', mood: null }));
  const items = { count: 0, types: [], typeIndex: new Uint16Array(4096), x: new Float32Array(4096), z: new Float32Array(4096), state: new Uint8Array(4096), golden: new Uint8Array(4096) };
  const state = {
    tick: 0, time: 0, mode, worldId: world.id, goals: world.goals, playerName: 'Biscuit',
    player: { x: world.spawn.x, z: world.spawn.z, y: 0, yaw: world.spawn.yaw, size: world.goals.start, surface: 'grass', sig: { kind: 'sniffBoost', active: false } },
    npcs, items, weather: { kind: 'clear' }, zones: {}, flags: {},
  };
  const addItem = (type, x, z, golden) => {
    let ti = items.types.indexOf(type);
    if (ti < 0) { ti = items.types.length; items.types.push(type); }
    const i = items.count++;
    items.typeIndex[i] = ti; items.x[i] = x; items.z[i] = z; items.state[i] = 0; items.golden[i] = golden ? 1 : 0;
    return i;
  };
  for (const a of world.items.anchors) if (!a.hidden) addItem(a.type, a.x, a.z, a.golden);
  const log = { found: new Set(), said: [], emitted: [], spawned: [], buffs: [], revealed: [] };
  let still = 0;
  const species = SPECIES[speciesId];
  const ctxs = world.eggs.map((egg) => ({
    state, player: state.player, species, worldId: world.id, rng: createRng(egg.id),
    found() { log.found.add(egg.id); },
    isFound() { return log.found.has(egg.id); },
    flag(k, v) { if (v === undefined) return state.flags[k]; state.flags[k] = v; return v; },
    zone(id) {
      const z = world.zones.find((q) => q.id === id);
      if (!z) throw new Error(`egg ${egg.id} asked for unknown zone ${id}`);
      const inside = Math.hypot(state.player.x - z.x, state.player.z - z.z) <= z.r;
      const rec = state.zones[id] || (state.zones[id] = { inside: false, time: 0 });
      rec.inside = inside;
      return rec;
    },
    stillTime() { return still; },
    dist(x, z) { return Math.hypot(state.player.x - x, state.player.z - z); },
    spawnItem(type, x, z, o = {}) { log.spawned.push({ type, x, z, golden: !!o.golden }); return addItem(type, x, z, o.golden); },
    revealItem(flag) { log.revealed.push(flag); },
    say(speaker, key, vars) { log.said.push({ egg: egg.id, speaker, key, vars }); },
    buff(kind, s) { log.buffs.push([kind, s]); },
    npc(id) { return npcs.find((n) => n.id === id) || null; },
    setNpcAnim(id, anim) { const n = npcs.find((q) => q.id === id); if (n) n.anim = anim; },
    emit(ev) { log.emitted.push(ev); },
  }));
  for (let i = 0; i < world.eggs.length; i++) world.eggs[i].init?.(ctxs[i]);
  const H = {
    state, log, ctxs,
    tick(n = 1, dt = 1 / 60) {
      for (let k = 0; k < n; k++) {
        state.tick++; state.time += dt; still += dt;
        for (const z of world.zones) {
          const rec = state.zones[z.id] || (state.zones[z.id] = { inside: false, time: 0 });
          rec.inside = Math.hypot(state.player.x - z.x, state.player.z - z.z) <= z.r;
          rec.time = rec.inside ? rec.time + dt : 0;
        }
        for (let i = 0; i < world.eggs.length; i++) world.eggs[i].tick?.(ctxs[i], dt);
      }
    },
    event(ev) { for (let i = 0; i < world.eggs.length; i++) world.eggs[i].onEvent?.(ev, ctxs[i]); },
    moveTo(x, z) { state.player.x = x; state.player.z = z; still = 0; },
    seconds(s) { H.tick(Math.round(s * 60)); },
  };
  return H;
}
