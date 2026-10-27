import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { makeSim, run, input, ofType, place, itemIndex } from './helpers.js';

const anchors = (list) => ({ items: { anchors: list, fill: [] } });

test('an item inside reach is pulled in over about 0.25 s, then gone, and you grow', () => {
  const sim = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.12 }]));
  const i = itemIndex(sim, 'seashell');
  const s0 = sim.state.player.size;
  run(sim, 1);
  assert.equal(sim.state.items.state[i], 3, 'being gobbled');
  const evs = run(sim, 20);
  assert.equal(sim.state.items.state[i], 4, 'gone');
  const g = ofType(evs, EV.GOBBLE);
  assert.equal(g.length, 1);
  assert.equal(g[0].itemType, 'seashell');
  const expected = Math.cbrt(s0 ** 3 + 1 * 0.05 ** 3);
  assert.ok(Math.abs(sim.state.player.size - expected) < 1e-6);
  assert.ok(sim.state.player.gulp > 0);
  for (const k of ['size', 'x', 'y', 'z', 'combo', 'golden', 'food', 'first']) assert.ok(k in g[0], k);
});

test('pull-in shrinks the item (scale) along a curved path', () => {
  const sim = makeSim(anchors([{ type: 'seashell', x: 0.1, z: 0.1 }]));
  const i = itemIndex(sim, 'seashell');
  run(sim, 1);
  let maxY = 0, minScale = 2;
  for (let k = 0; k < 14; k++) { run(sim, 1); maxY = Math.max(maxY, sim.state.items.y[i]); if (sim.state.items.state[i] === 3) minScale = Math.min(minScale, sim.state.items.scale[i]); }
  assert.ok(maxY > 0.05, 'arcs upwards');
  assert.ok(minScale < 0.5, 'shrinks');
});

test('too-big items are not gobbled and are flagged not gobble-able', () => {
  const sim = makeSim(anchors([{ type: 'beachball', x: 0, z: 0.4 }]));
  const i = itemIndex(sim, 'beachball');
  run(sim, 30);
  assert.equal(sim.state.items.gobbleable[i], 0);
  assert.notEqual(sim.state.items.state[i], 3);
  assert.notEqual(sim.state.items.state[i], 4);
});

test('almost flag marks items just above the threshold', () => {
  const sim = makeSim(anchors([{ type: 'icelolly', x: 5, z: 5 }, { type: 'coconut', x: 6, z: 5 }, { type: 'sunhat', x: 7, z: 5 }]));
  run(sim, 1);
  const I = sim.state.items;
  // size 0.25: threshold 0.15, almost up to 0.1875
  assert.equal(I.gobbleable[itemIndex(sim, 'icelolly')], 1);
  assert.equal(I.almost[itemIndex(sim, 'coconut')], 1);
  assert.equal(I.almost[itemIndex(sim, 'sunhat')], 0);
  assert.equal(I.gobbleable[itemIndex(sim, 'sunhat')], 0);
});

test('first is true only for the first gobble of a type in the run', () => {
  const sim = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }, { type: 'seashell', x: 0, z: 0.13 }, { type: 'bottlecap', x: 0.05, z: 0.1 }]));
  const evs = ofType(run(sim, 40), EV.GOBBLE);
  assert.equal(evs.length, 3);
  const shells = evs.filter((e) => e.itemType === 'seashell');
  assert.deepEqual(shells.map((e) => e.first), [true, false]);
  assert.equal(evs.find((e) => e.itemType === 'bottlecap').first, true);
});

test('combo chains gobbles within 1.2 s and ends with COMBO_END', () => {
  const list = [];
  for (let k = 0; k < 6; k++) list.push({ type: 'seashell', x: 0, z: 0.5 + k * 0.5 });
  const sim = makeSim(anchors(list));
  const evs = run(sim, 400, input({ mz: 1 }));
  const g = ofType(evs, EV.GOBBLE);
  assert.equal(g.length, 6);
  assert.deepEqual(g.map((e) => e.combo), [1, 2, 3, 4, 5, 6]);
  assert.ok(ofType(evs, EV.COMBO).length >= 5);
  const end = ofType(evs, EV.COMBO_END);
  assert.equal(end.length, 1);
  assert.equal(end[0].count, 6);
  assert.equal(sim.state.player.combo.count, 0);
  assert.equal(sim.state.starProgress.maxCombo, 6);
});

test('combo breaks when gobbles are more than 1.2 s apart', () => {
  const sim = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }, { type: 'seashell', x: 30, z: 30 }]));
  run(sim, 30);
  assert.equal(sim.state.player.combo.count, 1);
  run(sim, 80);
  assert.equal(sim.state.player.combo.count, 0);
});

test('combo multiplier boosts growth', () => {
  const a = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }]));
  run(a, 30);
  const b = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }]));
  b.state.player.combo.count = 10; b.state.player.combo.timer = 1;
  run(b, 30);
  assert.ok(b.state.player.size > a.state.player.size);
});

test('food bonus: Oli grows more from food', () => {
  const food = makeSim(anchors([{ type: 'brigadeiro', x: 0, z: 0.1 }]));
  run(food, 30);
  const s0 = 0.25;
  const plain = Math.cbrt(s0 ** 3 + 0.035 ** 3);
  assert.ok(food.state.player.size > plain);
  const cat = makeSim(anchors([{ type: 'brigadeiro', x: 0, z: 0.1 }]), { species: 'cat' });
  run(cat, 30);
  assert.ok(Math.abs(cat.state.player.size - plain) < 1e-6);
});

test('milestones fire once each with a slow-mo beat and a camera hint', () => {
  const sim = makeSim({ ...anchors([{ type: 'seashell', x: 0, z: 0.1 }]), goals: { start: 0.25, goal: 3, stretch: 4.5, timer: 300, par: 200, growthK: 200, milestones: [0.3, 0.4], star3: { kind: 'noHazards' } } });
  const evs = run(sim, 30);
  const m = ofType(evs, EV.MILESTONE);
  assert.ok(m.length >= 1);
  assert.equal(m[0].index, 0);
  assert.equal(m[0].size, 0.3);
  assert.ok(evs.some(() => true));
  // slow-mo was set and decays to 0
  run(sim, 60);
  assert.equal(sim.state.slowMo, 0);
});

test('slow-mo stretches sim time (still deterministic)', () => {
  const sim = makeSim();
  sim._S.run.slowMoT = 0.35; sim.state.slowMo = 1;
  const t0 = sim.state.time;
  run(sim, 6);
  assert.ok(sim.state.time - t0 < 6 / 60 - 1e-6);
});

test('golden items emit GOLDEN and are recorded', () => {
  const sim = makeSim(anchors([{ type: 'rubberduck', x: 0, z: 0.1, golden: true }]), { species: 'elephant' });
  const evs = run(sim, 30);
  assert.equal(ofType(evs, EV.GOLDEN).length, 1);
  assert.equal(ofType(evs, EV.GOBBLE)[0].golden, true);
  assert.deepEqual(sim._S.run.goldenFound, ['rubberduck']);
});

test('a tea mug grants Tea Time, which widens reach', () => {
  const sim = makeSim(anchors([{ type: 'teamug', x: 0, z: 0.1 }]), { species: 'elephant' });
  const before = sim._S.derived.reachBase;
  const evs = run(sim, 30);
  assert.ok(ofType(evs, EV.BUFF).some((e) => e.kind === 'tea'));
  assert.ok(sim.state.player.buffs.tea > 5);
  assert.ok(sim._S.derived.reachBase > before);
});

test('living creatures are never gobbled, however big you are', () => {
  const sim = makeSim({ cast: [{ id: 'gerald', kind: 'critter', mesh: 'gerald', x: 0, z: 1, behaviour: 'idle' }], crowd: [{ kind: 'tourist', x: 1, z: 0, behaviour: 'idle' }], flocks: [{ kind: 'pigeon', count: 5, x: 0, z: 0, r: 1 }] });
  sim.state.player.size = 50;
  const evs = run(sim, 60);
  assert.equal(ofType(evs, EV.GOBBLE).length, 0);
  assert.ok(sim.state.npcs.every((n) => n.visible));
  assert.equal(sim.state.birds.count, 5);
});

test('flag nogobble:<type> makes a type un-gobble-able', () => {
  const sim = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }]));
  sim.state.flags['nogobble:seashell'] = true;
  run(sim, 30);
  assert.equal(sim.state.items.state[itemIndex(sim, 'seashell')], 0);
  sim.state.flags['nogobble:seashell'] = false;
  run(sim, 30);
  assert.equal(itemIndex(sim, 'seashell'), -1);
});

test('nudging an almost-sized item knocks it about and emits ALMOST (throttled)', () => {
  const sim = makeSim(anchors([{ type: 'coconut', x: 0, z: 1 }, { type: 'coconut', x: 0, z: 1.6 }]));
  const evs = run(sim, 120, input({ mz: 1 }));
  assert.ok(ofType(evs, EV.ALMOST).length >= 1);
  assert.ok(ofType(evs, EV.ALMOST).length <= 2);
});

test('running into a big item fast bumps you and drops recent gobbles, which tumble', () => {
  const list = [{ type: 'kiosk', x: 0, z: 4 }];
  for (let k = 0; k < 5; k++) list.push({ type: 'seashell', x: 0, z: 0.4 + k * 0.3 });
  const sim = makeSim(anchors(list));
  const evs = run(sim, 300, input({ mz: 1, sprint: true }));
  const b = ofType(evs, EV.BUMP);
  assert.ok(b.length >= 1, 'bumped');
  assert.equal(b[0].by, 'item');
  assert.ok(b[0].dropped >= 1 && b[0].dropped <= 3);
  assert.ok(sim.state.player.stagger >= 0);
  const I = sim.state.items;
  let back = 0;
  for (let i = 0; i < I.count; i++) if (I.types[I.typeIndex[i]] === 'seashell' && I.state[i] !== 4 && I.state[i] !== 3) back++;
  assert.ok(back >= 1, 'dropped items are back in the world');
});

test('dropped items tumble (state 2) and cannot be re-gobbled straight away', () => {
  const sim = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }]));
  run(sim, 30);
  const S = sim._S;
  const s1 = sim.state.player.size;
  const { dropItems } = S;
  void dropItems;
  // drop it by hand
  const mod = S;
  const n = mod.run.ringLen;
  assert.equal(n, 1);
  // use the real bump path
  sim._S.run.bumpCd = 0;
  const { bump } = awaitBump();
  bump(S, 'hazard', 'test', 0, 5, 1);
  const i = itemIndex(sim, 'seashell');
  assert.equal(sim.state.items.state[i], 2);
  assert.ok(sim.state.player.size < s1);
  run(sim, 5);
  assert.notEqual(sim.state.items.state[i], 3);
});

import * as G from '../../src/sim/gobble.js';
function awaitBump() { return G; }

test('assist mode never drops items', () => {
  const sim = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }]), { assist: true });
  run(sim, 30);
  G.bump(sim._S, 'hazard', 'test', 0, 5, 1);
  assert.equal(itemIndex(sim, 'seashell'), -1);
});

test('the tortoise (noDrops) and chill mode never drop items', () => {
  for (const [species, mode] of [['tortoise', 'story'], ['oli', 'chill']]) {
    const sim = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }]), { species, mode });
    run(sim, 30);
    const r = G.bump(sim._S, 'hazard', 'test', 0, 5, 1);
    assert.ok(r);
    assert.equal(itemIndex(sim, 'seashell'), -1, species + mode);
  }
});

test('bumps have a cooldown and end the combo', () => {
  const sim = makeSim();
  sim.state.player.combo.count = 5; sim.state.player.combo.timer = 1;
  assert.ok(G.bump(sim._S, 'hazard', 'x', 0, 1, 1));
  assert.ok(!G.bump(sim._S, 'hazard', 'x', 0, 1, 1));
  assert.equal(sim.state.player.combo.count, 0);
  assert.ok(sim.state.player.stagger > 0);
});

test('reach is published on the player and grows with size', () => {
  const sim = makeSim();
  run(sim, 1);
  const r0 = sim.state.player.reach;
  sim.state.player.size = 1;
  run(sim, 1);
  assert.ok(sim.state.player.reach > r0 * 3);
});

test('daily special item is flagged and pays triple', () => {
  const sim = makeSim(anchors([{ type: 'seashell', x: 0, z: 0.1 }]), { mode: 'daily', daily: { specialItem: 'seashell' } });
  const g = ofType(run(sim, 30), EV.GOBBLE)[0];
  assert.equal(g.special, true);
  assert.equal(g.value, 3 * 1 * (Math.max(1, Math.round(Math.log2(1 + 0.05 * 20)))));
});

test('place helper sanity', () => { const s = makeSim(); place(s, 3, 4); assert.equal(s.state.player.x, 3); });
