import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { HAZARD_KINDS } from '../../src/sim/hazards.js';
import { makeSim, run, input, ofType, place, parkWorld } from './helpers.js';

const npcOf = (sim, kind) => sim.state.npcs.find((n) => n.kind === kind);

test('a cyclist riding into you is a hazard bump', () => {
  const sim = makeSim({ hazards: [{ kind: 'cyclist', path: [[-10, 0], [10, 0]], speed: 6 }] });
  place(sim, 0, 0);
  const evs = run(sim, 240);
  const h = ofType(evs, EV.HAZARD);
  assert.ok(h.length >= 1);
  assert.equal(h[0].kind, 'cyclist');
  const b = ofType(evs, EV.BUMP);
  assert.equal(b[0].by, 'hazard');
  assert.equal(b[0].hazardKind, 'cyclist');
  assert.ok(sim.state.starProgress.hazardsTouched >= 1);
});

test('near misses are reported', () => {
  const sim = makeSim({ hazards: [{ kind: 'cyclist', path: [[-10, 1.0], [10, 1.0]], speed: 6 }] });
  const evs = run(sim, 240);
  assert.ok(ofType(evs, EV.NEAR_MISS).length >= 1);
  assert.equal(ofType(evs, EV.HAZARD).length, 0);
});

test('assist halves hazard speeds', () => {
  const a = makeSim({ hazards: [{ kind: 'jogger', path: [[-20, 9], [20, 9]], speed: 3 }] });
  const b = makeSim({ hazards: [{ kind: 'jogger', path: [[-20, 9], [20, 9]], speed: 3 }] }, { assist: true });
  run(a, 60); run(b, 60);
  const da = npcOf(a, 'jogger').x + 20, db = npcOf(b, 'jogger').x + 20;
  assert.ok(Math.abs(db / da - 0.5) < 0.05, `${da} ${db}`);
});

test('giants are not bothered by cyclists', () => {
  const sim = makeSim({ hazards: [{ kind: 'cyclist', path: [[-10, 0], [10, 0]], speed: 6 }] });
  sim.state.player.size = 6;
  const evs = run(sim, 240);
  assert.equal(ofType(evs, EV.HAZARD).length, 0);
});

test('puddles slow most animals but delight water-lovers', () => {
  const w = { hazards: [{ kind: 'puddle', x: 0, z: 0, r: 3 }] };
  const cat = makeSim(w, { species: 'cat' }); const evs = run(cat, 90, input({ mz: 0.3 }));
  const free = makeSim({}, { species: 'cat' }); run(free, 90, input({ mz: 0.3 }));
  assert.ok(cat.state.player.speed < free.state.player.speed * 0.8);
  assert.equal(ofType(evs, EV.HAZARD)[0].kind, 'puddle');
  const capy = makeSim(w, { species: 'capybara' }); const e2 = run(capy, 90, input({ mz: 0.3 }));
  assert.equal(ofType(e2, EV.HAZARD).length, 0);
});

test('the hose sweeps and bumps you when it hits', () => {
  const sim = makeSim({ hazards: [{ kind: 'hose', x: 0, z: -3, len: 6, arc: 1.2, period: 3, yaw: 0 }] }, { species: 'cat' });
  const y0 = sim.state.hazards[0].yaw;
  const evs = run(sim, 300);
  assert.notEqual(sim.state.hazards[0].yaw, y0);
  assert.ok(ofType(evs, EV.HAZARD).some((e) => e.kind === 'hose'));
});

test('firewalls bounce you until their flag opens them', () => {
  const sim = makeSim({ hazards: [{ kind: 'firewall', x: 0, z: 2, w: 10, d: 0.5, h: 3, openFlag: 'fw' }] });
  const evs = run(sim, 200, input({ mz: 1 }));
  assert.ok(sim.state.player.z < 2);
  assert.ok(ofType(evs, EV.HAZARD).some((e) => e.kind === 'firewall'));
  sim.state.flags.fw = true;
  run(sim, 300, input({ mz: 1 }));
  assert.ok(sim.state.player.z > 2.5, 'walked through once open');
  assert.equal(sim.state.hazards[0].active, false);
});

test('thin ice cracks under you and bounces you off', () => {
  const sim = makeSim({ hazards: [{ kind: 'thinIce', x: 0, z: 0, r: 20 }] });
  let maxLevel = 0;
  const evs = run(sim, 900, (i) => { maxLevel = Math.max(maxLevel, sim.state.hazards[0].level); return input({ mx: Math.sin(i / 40), mz: Math.cos(i / 40), sprint: true }); });
  assert.ok(maxLevel > 0.5);
  assert.ok(ofType(evs, EV.HAZARD).some((e) => e.kind === 'thinIce'));
});

test('snowball kids throw snowballs that can hit you', () => {
  const sim = makeSim({ hazards: [{ kind: 'snowballKids', x: 0, z: 6, count: 3 }] });
  const evs = run(sim, 1200);
  assert.ok(ofType(evs, EV.HAZARD).some((e) => e.kind === 'snowballThrow'));
  assert.ok(ofType(evs, EV.HAZARD).some((e) => e.kind === 'snowballKids'));
});

test('the marmoset nicks your hat (flag) and you get it back by catching it', () => {
  const sim = makeSim({ hazards: [{ kind: 'marmoset', x: 0, z: 3, r: 3 }] });
  run(sim, 200);
  assert.equal(sim.state.flags.hatStolen, true);
  const m = npcOf(sim, 'marmoset');
  // chase it down (cheat: put it next to us)
  m.x = sim.state.player.x; m.z = sim.state.player.z + 0.05;
  const evs = run(sim, 2);
  assert.equal(sim.state.flags.hatStolen, false);
  assert.ok(ofType(evs, EV.ACTIVITY).some((e) => e.kind === 'marmoset' && e.phase === 'success'));
});

test('packet-loss puddles knock a gobble loose', () => {
  const sim = makeSim({ items: { anchors: [{ type: 'seashell', x: 0, z: 0.1 }], fill: [] }, hazards: [{ kind: 'packetLoss', x: 0, z: 2, r: 1 }] });
  run(sim, 30);
  const evs = run(sim, 200, input({ mz: 1 }));
  assert.ok(ofType(evs, EV.BUMP).some((e) => e.hazardKind === 'packetLoss'));
});

test('lag zones set player.lag for the render, without a hazard touch', () => {
  const sim = makeSim({ hazards: [{ kind: 'lagZone', x: 0, z: 0, r: 3 }] });
  const evs = run(sim, 10);
  assert.equal(sim.state.player.lag, 1);
  assert.equal(ofType(evs, EV.HAZARD).length, 0);
});

test('slippery rocks take your grip away', () => {
  const sim = makeSim({ hazards: [{ kind: 'slipperyRock', x: 0, z: 0, r: 8 }] });
  run(sim, 120, input({ mz: 1 })); run(sim, 15);
  const g = makeSim(); run(g, 120, input({ mz: 1 })); run(g, 15);
  assert.ok(sim.state.player.speed > g.state.player.speed + 0.1);
});

test('the highland cow blocks you and ambles aside when you bark', () => {
  const sim = makeSim({ hazards: [{ kind: 'highlandCow', x: 0, z: 2 }] });
  run(sim, 120, input({ mz: 1 }));
  assert.ok(sim.state.player.z < 1.2);
  const cow = npcOf(sim, 'highlandcow'); const x0 = cow.x;
  run(sim, 1, input({ bark: true }));
  run(sim, 240);
  assert.ok(Math.abs(cow.x - x0) > 1);
});

test('the toucan swoops at you', () => {
  const sim = makeSim({ hazards: [{ kind: 'toucan', x: 0, z: 4 }] });
  const evs = run(sim, 900);
  assert.ok(ofType(evs, EV.HAZARD).some((e) => e.kind === 'toucanSwoop'));
});

test('the tide counts as a hazard for non-swimmers only', () => {
  const w = { heightAt: (x) => (x > 2 ? -(x - 2) * 0.3 : 0), water: [{ kind: 'sea', level: -0.05, tide: { amp: 0.02, period: 30 } }], hazards: [{ kind: 'tide' }] };
  const cat = makeSim(w, { species: 'cat' }); const a = run(cat, 400, input({ mx: 1 }));
  assert.ok(ofType(a, EV.HAZARD).some((e) => e.kind === 'tide'));
  const oli = makeSim(w); const b = run(oli, 400, input({ mx: 1 }));
  assert.equal(ofType(b, EV.HAZARD).length, 0);
});

test('grumpy pigeon squads swoop at you', () => {
  const sim = makeSim({ hazards: [{ kind: 'pigeons', x: 2, z: 2, r: 1, count: 4 }] });
  const evs = run(sim, 1500);
  assert.ok(ofType(evs, EV.HAZARD).some((e) => e.kind === 'pigeons'));
});

test('every hazard kind runs on the park fixture without errors', () => {
  const w = parkWorld();
  const kinds = new Set(w.hazards.map((h) => h.kind));
  for (const k of HAZARD_KINDS) assert.ok(kinds.has(k), k);
  const sim = makeSim(w);
  run(sim, 1200, (i) => input({ mx: Math.sin(i / 90), mz: Math.cos(i / 70), sprint: true }));
  assert.ok(Number.isFinite(sim.state.player.x));
});
