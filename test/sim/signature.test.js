import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { SIGNATURE_KINDS, SPECIES } from '../../src/animals/species.js';
import { SIG_IMPLEMENTED } from '../../src/sim/signature.js';
import { makeSim, run, input, ofType, place } from './helpers.js';

const ring = (type, n, r, cx = 0, cz = 0) => { const a = []; for (let k = 0; k < n; k++) a.push({ type, x: cx + Math.sin((k / n) * 6.283) * r, z: cz + Math.cos((k / n) * 6.283) * r }); return a; };
const withItems = (anchors, over = {}) => ({ items: { anchors, fill: [] }, ...over });
const gone = (sim) => { const I = sim.state.items; let n = 0; for (let i = 0; i < sim._S.X.spareStart; i++) if (I.state[i] >= 3 && I.state[i] <= 4) n++; return n; };
const press = (extra = {}) => (i) => input({ sig: i === 0, sigHeld: i === 0, ...extra });

test('every signature kind is implemented and every species has one', () => {
  for (const k of SIGNATURE_KINDS) assert.ok(SIG_IMPLEMENTED.includes(k), k);
  for (const s of Object.values(SPECIES)) assert.ok(SIGNATURE_KINDS.includes(s.signature.kind), s.id);
});

test('signature start and end events, cooldown and ready flag', () => {
  const sim = makeSim({}, { species: 'redpanda' });
  run(sim, 1);
  assert.ok(sim.state.player.sig.ready);
  const evs = run(sim, 240, press());
  const sigs = ofType(evs, EV.SIG);
  assert.deepEqual(sigs.map((e) => e.phase), ['start', 'end']);
  assert.equal(sigs[0].kind, 'standTall');
  assert.ok(sim.state.player.sig.cooldownLeft > 0);
  assert.equal(sim.state.player.sig.ready, false);
  // pressing during cooldown does nothing
  assert.equal(ofType(run(sim, 5, press()), EV.SIG).length, 0);
});

test('sniffBoost: hold to sniff (slow, scent target set), release to dash towards it', () => {
  const sim = makeSim(withItems(ring('seashell', 8, 0.2, 0, 4)));
  const sg = sim.state.player.sig;
  run(sim, 30, (i) => input({ sig: i === 0, sigHeld: true }));
  assert.equal(sg.phase, 'charge');
  assert.ok(sg.tz > 3, 'target is the cluster ahead');
  assert.ok(sim.state.player.speed < 0.2);
  const evs = run(sim, 90, input());
  assert.ok(ofType(evs, EV.SIG).some((e) => e.phase === 'start'));
  assert.ok(sim.state.player.z > 3, `dashed (${sim.state.player.z})`);
  assert.ok(gone(sim) >= 3);
});

test('sniffBoost prefers a golden item', () => {
  const sim = makeSim(withItems([...ring('seashell', 6, 0.3, 0, 4), { type: 'rubberduck', x: -6, z: 0, golden: true }]));
  run(sim, 2, (i) => input({ sig: i === 0, sigHeld: true }));
  assert.ok(sim.state.player.sig.tx < -5);
});

test('pounce: an aimed leap that gobbles a ring where it lands', () => {
  const sim = makeSim(withItems(ring('seashell', 8, 0.3, 0, 0.85)), { species: 'cat' });
  const evs = run(sim, 90, press({ mz: 1 }));
  assert.ok(ofType(evs, EV.JUMP).length >= 1);
  assert.ok(sim.state.player.z > 0.6, `leapt (${sim.state.player.z})`);
  assert.ok(gone(sim) >= 6, `gobbled ${gone(sim)}`);
});

test('chillAura: calms hazards, freezes pigeons', () => {
  const sim = makeSim({ hazards: [{ kind: 'cyclist', path: [[-5, 1], [5, 1]], speed: 6, pingPong: true }], flocks: [{ kind: 'pigeon', count: 5, x: 3, z: 0, r: 1 }] }, { species: 'capybara' });
  run(sim, 2, press());
  const n = sim.state.npcs.find((m) => m.kind === 'cyclist');
  const x0 = n.x;
  run(sim, 30);
  assert.ok(Math.abs(n.x - x0) < 0.01, 'cyclist stopped');
  assert.ok(sim.state.hazards[0].calm > 0);
  assert.ok(Array.from(sim.state.birds.state).every((s) => s === 2), 'pigeons frozen');
  assert.ok(sim.state.player.sig.radius > 3);
  run(sim, 400);
  assert.ok(Math.abs(n.x - x0) > 0.5, 'moves again afterwards');
});

test('bellySlide: a fast momentum slide that gobbles in a line, longer on ice', () => {
  const line = []; for (let k = 1; k <= 10; k++) line.push({ type: 'seashell', x: 0, z: k * 0.4 });
  const sim = makeSim(withItems(line), { species: 'penguin' });
  run(sim, 30, input({ mz: 1 }));
  const walk = sim.state.player.speed;
  run(sim, 10, press({ mz: 1 }));
  assert.ok(sim.state.player.speed > walk * 1.5);
  run(sim, 120, input({ mz: 1 }));
  assert.ok(gone(sim) >= 8);
  const ice = makeSim({ surfaceAt: () => 'ice' }, { species: 'penguin' });
  run(ice, 1, press());
  assert.ok(ice.state.player.sig.dur > 3);
});

test('superHop: charge for a bigger leap that gobbles on landing', () => {
  const tap = makeSim({}, { species: 'rabbit' }); let a = 0;
  run(tap, 120, (i) => { a = Math.max(a, tap.state.player.y); return input({ sig: i === 0, sigHeld: i < 1 }); });
  const charged = makeSim(withItems(ring('seashell', 6, 0.3, 0, 1.25)), { species: 'rabbit' }); let b = 0;
  run(charged, 160, (i) => { b = Math.max(b, charged.state.player.y); return input({ sig: i === 0, sigHeld: i < 40 }); });
  assert.ok(b > a * 1.4, `charged ${b} vs tap ${a}`);
  assert.ok(gone(charged) >= 4);
});

test('flapGlide: falls slowly from height', () => {
  const sim = makeSim({}, { species: 'duck' });
  let air1 = 0; run(sim, 200, (i) => { if (!sim.state.player.grounded) air1++; return input({ jump: i === 0, jumpHeld: true }); });
  const g = makeSim({}, { species: 'duck' });
  let air2 = 0; run(g, 200, (i) => { if (!g.state.player.grounded) air2++; return input({ jump: i === 0, jumpHeld: true, sig: i === 12, sigHeld: i === 12 }); });
  assert.ok(air2 > air1 * 1.5, `glide air ${air2} vs ${air1}`);
});

test('shellUp: immune to bumps and rolls downhill', () => {
  const sim = makeSim({ heightAt: (x, z) => -z * 0.3 }, { species: 'tortoise' });
  run(sim, 2, press());
  assert.ok(sim._S.sigMods.immune);
  const { bump } = sim._S.__g || {};
  void bump;
  run(sim, 100);
  assert.ok(sim.state.player.z > 1, `rolled (${sim.state.player.z})`);
});

test('tongueSnap: grabs one item at 3x reach', () => {
  const sim = makeSim(withItems([{ type: 'seashell', x: 0, z: 0.42 }, { type: 'seashell', x: 0, z: 0.46 }]), { species: 'frog' });
  const reach = sim._S.derived.reachBase;
  assert.ok(0.42 > reach + 0.03, 'out of normal reach');
  run(sim, 2, press());
  assert.equal(sim.state.player.sig.count, 1);
  run(sim, 30);
  assert.equal(gone(sim), 1);
});

test('standTall: counts as 25% bigger', () => {
  const sim = makeSim(withItems([{ type: 'icelolly', x: 3, z: 3 }, { type: 'coconut', x: 4, z: 3 }]), { species: 'redpanda' });
  run(sim, 1);
  const I = sim.state.items;
  assert.equal(I.gobbleable[1], 0);
  run(sim, 2, press());
  assert.equal(I.gobbleable[1], 1, 'coconut gobble-able while standing tall');
});

test('eightArmGrab: snatches up to 8 at once', () => {
  const sim = makeSim(withItems(ring('seashell', 12, 0.4)), { species: 'octopus' });
  run(sim, 2, press());
  assert.equal(sim.state.player.sig.count, 8);
});

test('coilPull: circles and drags in the cluster', () => {
  const sim = makeSim(withItems(ring('seashell', 10, 0.25, 0, 0.45)), { species: 'snake' });
  run(sim, 100, press());
  assert.ok(gone(sim) >= 8, `got ${gone(sim)}`);
});

test('trunkHoover: cone suction in front only', () => {
  const front = []; for (let k = 0; k < 5; k++) front.push({ type: 'seashell', x: (k - 2) * 0.08, z: 0.55 });
  const sim = makeSim(withItems([...front, { type: 'seashell', x: 0, z: -0.55 }]), { species: 'elephant' });
  run(sim, 100, press());
  const I = sim.state.items;
  assert.equal(I.state[5], 0, 'behind untouched');
  assert.ok(gone(sim) >= 5);
});

test('wifiPurr: pull radius scales with combo bars (full bars in the Marcoverse)', () => {
  const sim = makeSim({}, { species: 'routercat' });
  run(sim, 1);
  assert.equal(sim.state.player.sig.bars, 1);
  sim.state.player.combo.count = 9; sim.state.player.combo.timer = 1;
  run(sim, 1);
  assert.equal(sim.state.player.sig.bars, 4);
  const w5 = makeSim({ id: 'w5', ...withItems(ring('seashell', 6, 0.5)) , heightAt: () => 0, surfaceAt: () => 'data', bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, spawn: { x: 0, z: 0 }, goals: { start: 0.25, goal: 3, stretch: 4, timer: 300, growthK: 1, milestones: [], star3: { kind: 'par' } } }, { species: 'routercat' });
  run(w5, 1);
  assert.equal(w5.state.player.sig.bars, 4);
  run(w5, 60, press());
  assert.ok(gone(w5) >= 6);
});

test('assist shortens signature cooldowns', () => {
  const a = makeSim({}, { species: 'frog', assist: true }); run(a, 1, press());
  const b = makeSim({}, { species: 'frog' }); run(b, 1, press());
  run(a, 30); run(b, 30);
  assert.ok(a.state.player.sig.cooldownLeft < b.state.player.sig.cooldownLeft);
});

test('every species can fire its move without errors', () => {
  for (const id of Object.keys(SPECIES)) {
    const sim = makeSim(withItems(ring('seashell', 6, 0.4)), { species: id });
    const evs = run(sim, 420, (i) => input({ mz: 1, sig: i === 0, sigHeld: i < 20 }));
    assert.ok(ofType(evs, EV.SIG).length >= 2, id);
    const p = sim.state.player;
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), id);
    place(sim, 0, 0);
  }
});
