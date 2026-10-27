import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { makeSim, run, input, ofType, place } from './helpers.js';

test('pigeons scatter when you come close and emit PIGEON_SCARE', () => {
  const sim = makeSim({ flocks: [{ kind: 'pigeon', count: 8, x: 0, z: 3, r: 1 }] });
  const evs = run(sim, 200, input({ mz: 1 }));
  const s = ofType(evs, EV.PIGEON_SCARE);
  assert.ok(s.length >= 1);
  assert.ok(s.reduce((a, e) => a + e.count, 0) >= 6);
  assert.ok(Array.from(sim.state.birds.state).some((x) => x === 1));
  assert.ok(Math.max(...sim.state.birds.y) > 1, 'flying');
  assert.ok(sim._S.run.pigeonsScared >= 6);
});

test('a bark scatters birds from further away', () => {
  const sim = makeSim({ flocks: [{ kind: 'pigeon', count: 6, x: 0, z: 5, r: 1 }] });
  assert.equal(ofType(run(sim, 30), EV.PIGEON_SCARE).length, 0);
  const evs = run(sim, 5, (i) => input({ bark: i === 0 }));
  assert.ok(ofType(evs, EV.PIGEON_SCARE).length >= 1);
});

test('scattered birds flock as boids and later settle back home', () => {
  const sim = makeSim({ flocks: [{ kind: 'gull', count: 6, x: 0, z: 2, r: 1 }] });
  run(sim, 5, (i) => input({ bark: i === 0 }));
  place(sim, 40, 40);
  run(sim, 60 * 25);
  const B = sim.state.birds;
  let grounded = 0;
  for (let i = 0; i < B.count; i++) if (B.state[i] === 0) grounded++;
  assert.ok(grounded >= 4, `${grounded} settled`);
  for (let i = 0; i < B.count; i++) assert.ok(Math.hypot(B.x[i], B.z[i] - 2) < 6);
  assert.equal(B.kinds[B.kind[0]], 'gull');
});

test('Gerald hops ahead of you and flaps off to a new spot when you get close', () => {
  const sim = makeSim({ cast: [{ id: 'gerald', kind: 'critter', mesh: 'gerald', x: 0, z: 4, behaviour: 'gerald', params: {} }] });
  const g = sim.state.npcs[0];
  let flew = false;
  run(sim, 300, () => { if (g.anim === 'fly') flew = true; return input({ mz: 1 }); });
  assert.ok(flew);
  run(sim, 300);
  assert.ok(Math.hypot(g.x - sim.state.player.x, g.z - sim.state.player.z) > 3, 'got away');
  assert.notEqual(g.anim, 'fly');
});

test('Gerald follows his spots when given', () => {
  const sim = makeSim({ cast: [{ id: 'gerald', kind: 'critter', mesh: 'gerald', x: 0, z: 1, behaviour: 'gerald', params: { spots: [[0, 1], [20, 20]] } }] });
  run(sim, 300);
  const g = sim.state.npcs[0];
  assert.ok(Math.hypot(g.x - 20, g.z - 20) < 0.5);
});

test('Marco jogs his path and throws a ball now and then', () => {
  const sim = makeSim({ cast: [{ id: 'marco', kind: 'human', mesh: 'marco', x: -10, z: 5, behaviour: 'marco', params: { path: [[-10, 5], [10, 5]], speed: 3, pingPong: true, throwEvery: 4 } }] });
  let threw = false, ball = false;
  run(sim, 600, () => { const m = sim.state.npcs[0]; if (m.anim === 'throw') threw = true; if (sim.state.projectiles.kind.some((k) => k === 1)) ball = true; return input(); });
  assert.ok(threw && ball);
  assert.ok(sim.state.npcs[0].x > -9);
});

test('crowd behaviours: wander stays near home, pathLoop moves, react flees or waves', () => {
  const sim = makeSim({ crowd: [
    { kind: 'tourist', x: 10, z: 10, behaviour: 'wander', params: { r: 3 } },
    { kind: 'jogger', x: -10, z: -10, behaviour: 'pathLoop', params: { path: [[-10, -10], [10, -10]], speed: 3 } },
    { kind: 'tourist', x: 0, z: 1.5, behaviour: 'react', params: { react: 'flee', r: 3 } },
    { kind: 'kid', x: 1.5, z: 0, behaviour: 'idle', params: { react: 'cheer' } },
  ] });
  const [w, j, f, k] = sim.state.npcs;
  let cheered = false;
  run(sim, 600, () => { if (k.anim === 'cheer') cheered = true; return input(); });
  assert.ok(Math.hypot(w.x - 10, w.z - 10) <= 3.6);
  assert.ok(j.x > -9);
  assert.ok(Math.hypot(f.x, f.z) > 3, 'fled');
  assert.ok(cheered);
  for (const n of sim.state.npcs) for (const key of ['id', 'kind', 'x', 'y', 'z', 'yaw', 'px', 'pz', 'anim', 'animT', 'mood']) assert.ok(key in n, key);
});

test('NPCs gently block a small animal and step aside for a giant', () => {
  const sim = makeSim({ crowd: [{ kind: 'tourist', x: 0, z: 1.5, behaviour: 'idle', params: {} }] });
  run(sim, 120, input({ mz: 1 }));
  assert.ok(sim.state.player.z < 1.5);
  const big = makeSim({ crowd: [{ kind: 'tourist', x: 0, z: 6, behaviour: 'idle', params: {} }], goals: { start: 6, goal: 20, stretch: 30, timer: 300, growthK: 1, milestones: [], star3: { kind: 'par' } } });
  run(big, 120, input({ mz: 1 }));
  assert.ok(big.state.player.z > 7);
});
