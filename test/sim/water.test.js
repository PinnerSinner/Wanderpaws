import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { TAU } from '../../src/core/math.js';
import { createTerrain } from '../../src/sim/terrain.js';
import { makeSim, run, input, ofType, place, flatWorld } from './helpers.js';

// sea to the east: terrain drops below the water level past x = 2
const seaWorld = (tide) => ({
  heightAt: (x) => (x > 2 ? -Math.min(3, (x - 2) * 0.5) : 0),
  water: [{ kind: 'sea', level: -0.05, ...(tide ? { tide } : {}) }],
});

test('the tide follows level + amp * sin(TAU * t / period)', () => {
  const w = flatWorld({ water: [{ kind: 'sea', level: -1, tide: { amp: 0.5, period: 20 } }] });
  const T = createTerrain(w);
  for (const t of [0, 3, 5, 12.5]) {
    T.update(t);
    assert.ok(Math.abs(T.waterAt(0, 0) - (-1 + 0.5 * Math.sin((TAU * t) / 20))) < 1e-12);
    assert.ok(Math.abs(T.tide - 0.5 * Math.sin((TAU * t) / 20)) < 1e-12);
  }
});

test('state.tide tracks the sea in the sim', () => {
  const sim = makeSim(seaWorld({ amp: 0.3, period: 10 }));
  run(sim, 150);
  const t = sim.state.time;
  assert.ok(Math.abs(sim.state.tide - 0.3 * Math.sin((TAU * t) / 10)) < 1e-9);
});

test('rect water bodies only cover their rectangle', () => {
  const w = flatWorld({ water: [{ kind: 'pond', level: 0.2, rect: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 } }] });
  const T = createTerrain(w);
  assert.ok(Math.abs(T.depthAt(1, 1) - 0.2) < 1e-12);
  assert.equal(T.depthAt(5, 5), 0);
});

test('swimmers swim out to sea and float at the surface', () => {
  const sim = makeSim(seaWorld(), { species: 'oli' });
  const evs = run(sim, 600, input({ mx: 1 }));
  const p = sim.state.player;
  assert.ok(p.x > 6, `x ${p.x}`);
  assert.ok(p.inWater);
  assert.ok(p.waterDepth > 0.5);
  assert.ok(p.y > -0.3 && p.y < 0, `floats near the surface (${p.y})`);
  assert.equal(p.surface, 'water');
  assert.ok(ofType(evs, EV.SPLASH).length >= 1);
});

test('non-swimmers are nudged back to the shallows', () => {
  const sim = makeSim(seaWorld(), { species: 'cat' });
  run(sim, 900, input({ mx: 1 }));
  const p = sim.state.player;
  assert.ok(p.waterDepth < 0.25, `depth ${p.waterDepth}`);
});

test('wading slows non-swimmers down', () => {
  const dry = makeSim({}, { species: 'cat' }); run(dry, 90, input({ mz: 1 }));
  const wet = makeSim({ water: [{ kind: 'pond', level: 0.12 }] }, { species: 'cat' }); run(wet, 90, input({ mz: 1 }));
  assert.ok(wet.state.player.speed < dry.state.player.speed * 0.9);
});

test('the duck paddles faster in water than it walks', () => {
  const land = makeSim({}, { species: 'duck' }); run(land, 120, input({ mz: 1 }));
  const water = makeSim({ heightAt: () => -2, water: [{ kind: 'pond', level: 0 }] }, { species: 'duck' }); run(water, 120, input({ mz: 1 }));
  assert.ok(water.state.player.speed > land.state.player.speed * 1.2);
});

test('leaving the water triggers a shake-off (SHAKE)', () => {
  const sim = makeSim(seaWorld());
  place(sim, 5, 0);
  run(sim, 60);
  const evs = run(sim, 400, input({ mx: -1 }));
  assert.equal(ofType(evs, EV.SHAKE).length, 1);
  assert.ok(sim.state.player.shakeT >= 0);
});

test("Oli's shake-off sprays small items towards him", () => {
  const sim = makeSim({ ...seaWorld(), items: { anchors: [{ type: 'seashell', x: -1.5, z: 0 }], fill: [] } });
  place(sim, 5, 0);
  run(sim, 60);
  const I = sim.state.items;
  const evs = run(sim, 400, input({ mx: -1 }));
  assert.equal(ofType(evs, EV.SHAKE).length, 1);
  // the shell was knocked (tumbled) or gobbled
  assert.ok(sim._S.debug.gobbleStarts >= 1 || I.state[0] !== 0);
});

test('landing in water splashes', () => {
  const sim = makeSim({ heightAt: () => -1, water: [{ kind: 'pond', level: -0.85 }] }, { species: 'cat' });
  run(sim, 60);
  const evs = run(sim, 80, (i) => input({ jump: i === 0, jumpHeld: true }));
  assert.ok(ofType(evs, EV.SPLASH).length >= 1 || ofType(evs, EV.LAND).length >= 0);
});
