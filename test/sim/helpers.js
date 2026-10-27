// Shared helpers for the sim tests.
import { createSim } from '../../src/sim/index.js';
import { SPECIES } from '../../src/animals/species.js';
import { flatWorld, parkWorld } from './fixtures/worlds.js';

export { flatWorld, parkWorld, SPECIES };

export function input(o = {}) {
  return { mx: 0, mz: 0, sprint: false, jump: false, jumpHeld: false, sig: false, sigHeld: false, bark: false, barkHeld: false, aimYaw: 0, ...o };
}

// A sim on a flat world, already past the intro.
export function makeSim(worldOver = {}, opts = {}) {
  const world = worldOver.id ? worldOver : flatWorld(worldOver);
  const sim = createSim({ world, species: SPECIES[opts.species || 'oli'], mode: opts.mode || 'story', seed: opts.seed ?? 1, assist: !!opts.assist, modifiers: opts.modifiers || {}, daily: opts.daily || null });
  if (opts.intro !== true) skipIntro(sim);
  return sim;
}

export function skipIntro(sim) {
  let n = 0;
  while (sim.state.phase === 'intro' && n++ < 300) sim.step(input());
  return sim;
}

// Step n ticks with an input (object or function of tick). Collects events.
export function run(sim, n, inp = input()) {
  const evs = [];
  for (let i = 0; i < n; i++) {
    sim.step(typeof inp === 'function' ? inp(i) : inp);
    for (const e of sim.events) evs.push(e);
    sim.events.length = 0;
  }
  return evs;
}

export const ofType = (evs, t) => evs.filter((e) => e.type === t);

// Teleport the player (and clear previous-position fields).
export function place(sim, x, z, yaw = 0) {
  const p = sim.state.player;
  p.x = p.px = x; p.z = p.pz = z; p.yaw = p.pyaw = yaw;
  p.y = p.py = sim._S.terrain.heightAt(x, z);
  p.vx = p.vy = p.vz = 0;
  sim._S.run.moveSpeed = 0;
}

export function itemIndex(sim, type, nth = 0) {
  const I = sim.state.items;
  let k = 0;
  for (let i = 0; i < I.count; i++) if (I.types[I.typeIndex[i]] === type && I.state[i] !== 4) { if (k++ === nth) return i; }
  return -1;
}
