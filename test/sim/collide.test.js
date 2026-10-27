import test from 'node:test';
import assert from 'node:assert/strict';
import { createColliders, passMaskFor, PASS_SQUEEZE, PASS_UNDER } from '../../src/sim/collide.js';
import { createTerrain } from '../../src/sim/terrain.js';
import { makeSim, run, input, place, flatWorld, SPECIES } from './helpers.js';

const res = () => ({ x: 0, z: 0, support: 0, hit: 0, nx: 0, nz: 0, hitIndex: -1 });
function cols(list) { const w = flatWorld({ colliders: list }); return createColliders(w, createTerrain(w)); }

test('circle is pushed out of an axis-aligned box', () => {
  const C = cols([{ kind: 'box', x: 0, z: 0, w: 2, d: 2, h: 2 }]);
  const o = C.resolve(1.1, 0, 0.3, 0, 0.5, 0.1, 0, res());
  assert.equal(o.hit, 1);
  assert.ok(Math.abs(o.x - 1.3) < 1e-6);
  assert.ok(Math.abs(o.nx - 1) < 1e-6);
});

test('rotated boxes use their local frame', () => {
  const C = cols([{ kind: 'box', x: 0, z: 0, w: 4, d: 0.2, h: 2, rot: Math.PI / 2 }]);
  // rotated 90 degrees, the long side runs along z
  const a = C.resolve(0, 1.5, 0.2, 0, 0.5, 0.1, 0, res());
  assert.equal(a.hit, 1, 'inside the long side now');
  const b = C.resolve(1.5, 0, 0.2, 0, 0.5, 0.1, 0, res());
  assert.equal(b.hit, 0, 'clear of the short side');
});

test('circle is pushed out of a cylinder', () => {
  const C = cols([{ kind: 'cyl', x: 0, z: 0, r: 1, h: 3 }]);
  const o = C.resolve(0, 1.1, 0.2, 0, 0.5, 0.1, 0, res());
  assert.ok(Math.abs(Math.hypot(o.x, o.z) - 1.2) < 1e-6);
});

test('a centre deep inside still gets pushed out', () => {
  const C = cols([{ kind: 'box', x: 0, z: 0, w: 2, d: 6, h: 2 }]);
  const o = C.resolve(0.2, 0, 0.1, 0, 0.5, 0.1, 0, res());
  assert.ok(o.x >= 1.1 - 1e-6);
});

test('low colliders are walkable and give support; tall ones block', () => {
  const C = cols([{ kind: 'box', x: 0, z: 0, w: 2, d: 2, h: 0.1 }, { kind: 'box', x: 5, z: 0, w: 2, d: 2, h: 0.3 }]);
  const a = C.resolve(0.5, 0, 0.2, 0, 0.5, 0.15, 0, res());
  assert.equal(a.hit, 0);
  assert.ok(Math.abs(a.support - 0.1) < 1e-6);
  const b = C.resolve(4.2, 0, 0.2, 0, 0.5, 0.15, 0, res());
  assert.equal(b.hit, 1);
});

test('pass flags let squeezers and under-fence species through', () => {
  const C = cols([{ kind: 'box', x: 0, z: 0, w: 0.2, d: 4, h: 1, pass: 'squeeze' }, { kind: 'box', x: 3, z: 0, w: 0.2, d: 4, h: 1, pass: 'under' }]);
  assert.equal(C.resolve(0.1, 0, 0.2, 0, 0.5, 0.1, 0, res()).hit, 1);
  assert.equal(C.resolve(0.1, 0, 0.2, 0, 0.5, 0.1, PASS_SQUEEZE, res()).hit, 0);
  assert.equal(C.resolve(3.1, 0, 0.2, 0, 0.5, 0.1, PASS_SQUEEZE, res()).hit, 1);
  assert.equal(C.resolve(3.1, 0, 0.2, 0, 0.5, 0.1, PASS_UNDER, res()).hit, 0);
  assert.equal(passMaskFor(SPECIES.cat), PASS_SQUEEZE);
  assert.equal(passMaskFor(SPECIES.snake), PASS_UNDER);
  assert.equal(passMaskFor(SPECIES.oli), 0);
});

test('raised colliders with a base let you walk underneath', () => {
  const C = cols([{ kind: 'box', x: 0, z: 0, w: 4, d: 4, h: 0.5, y: 2 }]);
  assert.equal(C.resolve(0, 0, 0.2, 0, 0.5, 0.1, 0, res()).hit, 0);
  assert.equal(C.resolve(0, 0, 0.2, 1.8, 0.5, 0.1, 0, res()).hit, 1);
});

test('the spatial hash finds colliders anywhere and dedupes', () => {
  const list = [];
  for (let i = 0; i < 100; i++) list.push({ kind: 'cyl', x: -45 + (i % 10) * 10, z: -45 + Math.floor(i / 10) * 10, r: 0.5, h: 2 });
  list.push({ kind: 'box', x: 0, z: 0, w: 60, d: 1, h: 2 });
  const C = cols(list);
  const n = C.query(0, 0, 40);
  const seen = new Set(); for (let i = 0; i < n; i++) seen.add(C.hits[i]);
  assert.equal(seen.size, n, 'no duplicates');
  assert.ok(seen.has(100));
  assert.equal(C.resolve(25, 0.4, 0.3, 0, 1, 0.1, 0, res()).hit, 1, 'long box found far from its centre');
});

// ---- in the sim ----
function gateWorld() {
  return { colliders: [{ kind: 'box', x: -5.25, z: 3, w: 10, d: 0.4, h: 2 }, { kind: 'box', x: 5.25, z: 3, w: 10, d: 0.4, h: 2 }] }; // 0.5 m gap at x = 0
}

test('size gates: a small animal fits through a gap a big one cannot', () => {
  const small = makeSim(gateWorld());
  run(small, 300, input({ mz: 1 }));
  assert.ok(small.state.player.z > 4, `small got through (${small.state.player.z})`);
  const big = makeSim(gateWorld());
  big.state.player.size = 1.5; big.state.player.displaySize = 1.5;
  run(big, 300, input({ mz: 1 }));
  assert.ok(big.state.player.z < 3, `big blocked (${big.state.player.z})`);
});

test('step-up: a kerb under 0.45 x size is climbed, a taller wall blocks', () => {
  const w = { colliders: [{ kind: 'box', x: 0, z: 2, w: 20, d: 1, h: 0.1 }] };
  const sim = makeSim(w);
  run(sim, 200, input({ mz: 1 }));
  assert.ok(sim.state.player.z > 3, 'climbed the kerb');
  const sim2 = makeSim({ colliders: [{ kind: 'box', x: 0, z: 2, w: 20, d: 1, h: 0.2 }] });
  run(sim2, 200, input({ mz: 1 }));
  assert.ok(sim2.state.player.z < 2, 'blocked by the wall');
});

test('you stand on top of a platform you stepped onto', () => {
  const sim = makeSim({ colliders: [{ kind: 'box', x: 0, z: 2, w: 4, d: 2, h: 0.1 }] });
  run(sim, 60, input({ mz: 1 }));
  place(sim, 0, 2); sim.state.player.y = 0.1;
  run(sim, 10);
  assert.ok(Math.abs(sim.state.player.y - 0.1) < 1e-6);
});

test('the cat squeezes through a cat-flap fence; Oli does not', () => {
  const w = { colliders: [{ kind: 'box', x: 0, z: 2, w: 20, d: 0.2, h: 1.2, pass: 'squeeze' }] };
  const cat = makeSim(w, { species: 'cat' }); run(cat, 200, input({ mz: 1 }));
  const oli = makeSim(w); run(oli, 200, input({ mz: 1 }));
  assert.ok(cat.state.player.z > 2.5);
  assert.ok(oli.state.player.z < 2);
});

test('soft world bounds push you back in', () => {
  const sim = makeSim();
  place(sim, 49.9, 0);
  run(sim, 600, input({ mx: 1, sprint: true }));
  assert.ok(sim.state.player.x < 50 + 1.6, `x ${sim.state.player.x}`);
});

test('steep terrain blocks walking straight up a cliff', () => {
  const sim = makeSim({ heightAt: (x, z) => (z > 3 ? 5 : 0) });
  run(sim, 300, input({ mz: 1 }));
  assert.ok(sim.state.player.z < 3.2);
  assert.ok(sim.state.player.y < 0.5);
});

test('gentle slopes are walked up and the player follows the ground', () => {
  const sim = makeSim({ heightAt: (x, z) => Math.max(0, z) * 0.2 });
  run(sim, 300, input({ mz: 1 }));
  const p = sim.state.player;
  assert.ok(p.z > 2);
  assert.ok(Math.abs(p.y - p.z * 0.2) < 0.05);
  assert.ok(p.grounded);
});
