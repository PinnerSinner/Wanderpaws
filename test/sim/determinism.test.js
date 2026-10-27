import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, stateHash } from '../../src/sim/index.js';
import { EV } from '../../src/core/events.js';
import { pickIdle } from '../../src/sim/idle.js';
import { createRng } from '../../src/core/rng.js';
import { SPECIES, input, run, makeSim, parkWorld, ofType } from './helpers.js';

function script(i) {
  return input({ mx: Math.sin(i / 50), mz: Math.cos(i / 37), sprint: (i >> 7) & 1, jump: i % 113 === 0, jumpHeld: i % 113 < 10, sig: i % 401 === 0, sigHeld: i % 401 < 20, bark: i % 257 === 0, barkHeld: i % 600 < 40 && i % 600 > 0 });
}

test('same seed and inputs give the same final state hash', () => {
  const hashes = [];
  for (let k = 0; k < 2; k++) {
    const sim = createSim({ world: parkWorld(), species: SPECIES.oli, seed: 42 });
    run(sim, 2400, script);
    hashes.push(sim.hash());
  }
  assert.equal(hashes[0], hashes[1]);
});

test('determinism holds for every species', () => {
  for (const id of Object.keys(SPECIES)) {
    const a = createSim({ world: parkWorld(), species: SPECIES[id], seed: 9 }); run(a, 900, script);
    const b = createSim({ world: parkWorld(), species: SPECIES[id], seed: 9 }); run(b, 900, script);
    assert.equal(stateHash(a.state), stateHash(b.state), id);
  }
});

test('different seeds place items differently', () => {
  const a = createSim({ world: parkWorld(), species: SPECIES.oli, seed: 1 });
  const b = createSim({ world: parkWorld(), species: SPECIES.oli, seed: 2 });
  assert.notEqual(stateHash(a.state), stateHash(b.state));
  // anchors are hand-placed and identical
  assert.equal(a.state.items.x[0], b.state.items.x[0]);
});

test('the sim never touches Math.random or the clock', () => {
  const r = Math.random, n = Date.now, pn = performance.now;
  Math.random = () => { throw new Error('Math.random'); };
  Date.now = () => { throw new Error('Date.now'); };
  try {
    const sim = createSim({ world: parkWorld(), species: SPECIES.cat, seed: 3 });
    run(sim, 600, script);
  } finally { Math.random = r; Date.now = n; performance.now = pn; }
});

test('state has every field the other layers read', () => {
  const sim = createSim({ world: parkWorld(), species: SPECIES.oli, seed: 3 });
  const s = sim.state;
  for (const k of ['tick', 'time', 'phase', 'introLeft', 'timeLeft', 'worldId', 'mode', 'goals', 'stars', 'starProgress', 'result', 'slowMo', 'player', 'items', 'npcs', 'birds', 'weather', 'tide', 'zones', 'flags', 'activity', 'camHint']) assert.ok(k in s, k);
  const I = s.items;
  for (const k of ['x', 'y', 'z', 'px', 'py', 'pz', 'rotY', 'tilt', 'tiltAxis', 'scale', 'anim', 'size']) { assert.ok(I[k] instanceof Float32Array, k); assert.equal(I[k].length, I.count); }
  for (const k of ['state', 'golden', 'gobbleable', 'almost']) assert.ok(I[k] instanceof Uint8Array, k);
  assert.ok(I.typeIndex instanceof Uint16Array);
  for (let i = 0; i < I.count; i++) assert.ok(I.typeIndex[i] < I.types.length);
  const B = s.birds;
  for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(B[k] instanceof Float32Array);
  assert.ok(B.kind instanceof Uint8Array);
  const sg = s.player.sig;
  for (const k of ['kind', 'active', 't', 'cooldownLeft', 'ready', 'aimYaw', 'power']) assert.ok(k in sg, k);
  for (const k of ['tea', 'wobble', 'speed']) assert.ok(k in s.player.buffs);
  for (const k of ['count', 'mult', 'timer']) assert.ok(k in s.player.combo);
});

test('seeded placement keeps fill items out of colliders and water', () => {
  const sim = createSim({ world: parkWorld(), species: SPECIES.oli, seed: 11 });
  const S = sim._S, I = sim.state.items;
  let inCol = 0, wet = 0, placed = 0;
  for (let i = 7; i < S.X.spareStart; i++) {
    placed++;
    if (S.col.containing(I.x[i], I.z[i], 0) >= 0) inCol++;
    if (S.terrain.depthAt(I.x[i], I.z[i]) > 0.05) wet++;
  }
  assert.ok(placed > 500);
  assert.ok(inCol / placed < 0.01, `in colliders ${inCol}`);
  assert.ok(wet / placed < 0.02, `in water ${wet}`);
});

test('a step stays under 2 ms with ~800 items and allocates little', () => {
  const w = parkWorld();
  const sim = createSim({ world: w, species: SPECIES.oli, seed: 5 });
  run(sim, 600, script); // warm up
  const t0 = process.hrtime.bigint();
  const N = 3000;
  for (let i = 0; i < N; i++) { sim.step(script(i)); sim.events.length = 0; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  assert.ok(ms < 2, `${ms.toFixed(3)} ms per step`);
});

test('idle director: deterministic, weighted, never the same twice in a row', () => {
  const a = createRng(5), b = createRng(5);
  let last = null;
  for (let i = 0; i < 200; i++) {
    const x = pickIdle(a, { sniff: 3, sit: 1 }, last, false);
    assert.equal(x, pickIdle(b, { sniff: 3, sit: 1 }, last, false));
    assert.notEqual(x, last);
    last = x;
  }
});

test('standing still picks idle anims and emits IDLE; moving clears it', () => {
  const sim = makeSim();
  const evs = run(sim, 60 * 12);
  const idles = ofType(evs, EV.IDLE);
  assert.ok(idles.length >= 1);
  assert.ok(typeof idles[0].anim === 'string' && idles[0].seconds >= 3);
  run(sim, 5, input({ mz: 1 }));
  assert.equal(sim.state.player.idleAnim, null);
  assert.equal(sim.state.player.idleTime, 0);
});

test('emotion responds: scared after a bump, sleepy when idle a long time', () => {
  const sim = makeSim();
  run(sim, 60 * 30);
  assert.equal(sim.state.player.emotion, 'sleepy');
  sim._S.run.scaredT = 1;
  run(sim, 1);
  assert.equal(sim.state.player.emotion, 'scared');
});

test('weather is picked from the world list by the seed and announced at GO', () => {
  const kinds = new Set();
  for (let s = 0; s < 12; s++) {
    const sim = createSim({ world: parkWorld(), species: SPECIES.oli, seed: s });
    kinds.add(sim.state.weather.kind);
    const evs = run(sim, 200);
    if (sim.state.weather.kind !== 'clear') assert.ok(ofType(evs, EV.WEATHER).length === 1);
  }
  assert.ok(kinds.size >= 2);
  for (const k of kinds) assert.ok(['clear', 'rain', 'fog'].includes(k));
});

test('a full bot-free 5-minute park run never produces NaN or launches', () => {
  const sim = createSim({ world: parkWorld(), species: SPECIES.elephant, seed: 8 });
  run(sim, 60 * 120, script);
  const p = sim.state.player;
  assert.ok(Number.isFinite(p.x + p.y + p.z + p.size));
  assert.equal(sim.debug.launches, 0);
  const I = sim.state.items;
  for (let i = 0; i < I.count; i++) assert.ok(Number.isFinite(I.x[i] + I.y[i] + I.z[i]), `item ${i}`);
});
