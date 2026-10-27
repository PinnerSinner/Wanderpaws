import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { makeSim, run, input, ofType, place, parkWorld } from './helpers.js';

function eggWorld(egg, over = {}) {
  return {
    cast: [{ id: 'kev', speaker: 'kev', kind: 'human', mesh: 'kev', x: 5, z: 0, behaviour: 'idle' }],
    zones: [{ id: 'hut', x: 0, z: 0, r: 2 }],
    items: { anchors: [{ type: 'flipflop', x: 3, z: 3, hidden: true, flag: 'secret' }], fill: [] },
    eggs: [egg],
    ...over,
  };
}

test('ctx has the full API from CONTRACTS §5.3', () => {
  let ctx;
  makeSim(eggWorld({ id: 'E1', init(c) { ctx = c; } }));
  for (const k of ['state', 'player', 'species', 'worldId', 'rng']) assert.ok(ctx[k] != null, k);
  for (const k of ['found', 'isFound', 'flag', 'zone', 'stillTime', 'dist', 'spawnItem', 'revealItem', 'say', 'buff', 'npc', 'setNpcAnim', 'emit']) assert.equal(typeof ctx[k], 'function', k);
});

test('init runs once, tick runs every tick, onEvent sees every event (including INTRO)', () => {
  let inits = 0, ticks = 0; const seen = new Set();
  const sim = makeSim(eggWorld({ id: 'E1', init() { inits++; }, tick() { ticks++; }, onEvent(ev) { seen.add(ev.type); } }), { intro: true });
  run(sim, 200, (i) => input({ mz: 1, bark: i === 150 }));
  assert.equal(inits, 1);
  assert.equal(ticks, 200);
  for (const t of [EV.INTRO, EV.GO, EV.BARK, EV.FOOTSTEP]) assert.ok(seen.has(t), t);
});

test('found() marks the egg once and emits EGG', () => {
  const sim = makeSim(eggWorld({ id: 'E1', onEvent(ev, c) { if (ev.type === EV.BARK) c.found(); } }));
  const evs = run(sim, 20, (i) => input({ bark: i === 1 || i === 5 }));
  const e = ofType(evs, EV.EGG);
  assert.equal(e.length, 1);
  assert.equal(e[0].id, 'E1');
  assert.equal(e[0].worldId, 'tflat');
  assert.deepEqual(sim._S.run.eggsFound, ['E1']);
});

test('flags, zones, stillTime and dist', () => {
  let c;
  const sim = makeSim(eggWorld({ id: 'E1', init(x) { c = x; } }));
  c.flag('a', 3);
  assert.equal(c.flag('a'), 3);
  assert.equal(sim.state.flags.a, 3);
  run(sim, 120);
  assert.equal(c.zone('hut').inside, true);
  assert.ok(c.zone('hut').time > 1.9);
  assert.ok(c.stillTime() > 1.5);
  assert.equal(c.zone('nope').inside, false);
  assert.ok(Math.abs(c.dist(3, 4) - 5) < 1e-6);
  run(sim, 60, input({ mz: 1, sprint: true }));
  assert.equal(c.stillTime(), 0);
});

test('spawnItem and revealItem put items in the world', () => {
  let c;
  const sim = makeSim(eggWorld({ id: 'E1', init(x) { c = x; } }));
  const v0 = sim.state.items.version;
  const i = c.spawnItem('football', 10, 10, { golden: true });
  assert.ok(i >= 0);
  assert.equal(sim.state.items.golden[i], 1);
  assert.equal(sim.state.items.types[sim.state.items.typeIndex[i]], 'football');
  assert.ok(sim.state.items.version > v0, 'render is told types changed');
  run(sim, 120);
  assert.ok(sim.state.items.state[i] <= 1, 'landed');
  const I = sim.state.items;
  const hidden = Array.from(I.state).indexOf(5);
  assert.ok(hidden >= 0);
  assert.equal(c.revealItem('secret'), 1);
  assert.notEqual(I.state[hidden], 5);
});

test('say emits SAY at the speaker, falling back to the player', () => {
  let c;
  const sim = makeSim(eggWorld({ id: 'E1', init(x) { c = x; } }));
  c.say('kev', 'egg.E1.line', { n: 1 });
  c.say('nobody', 'egg.E1.other');
  const s = ofType(sim.events, EV.SAY);
  assert.equal(s[0].anchor, 'kev'); assert.equal(s[0].x, 5); assert.deepEqual(s[0].vars, { n: 1 });
  assert.equal(s[1].anchor, 'player');
});

test('buff, npc, setNpcAnim and emit', () => {
  let c;
  const sim = makeSim(eggWorld({ id: 'E1', init(x) { c = x; } }));
  c.buff('wobble', 8);
  assert.equal(sim.state.player.buffs.wobble, 8);
  assert.equal(c.npc('kev').id, 'kev');
  assert.equal(c.npc('ghost'), null);
  c.setNpcAnim('kev', 'point');
  run(sim, 2);
  assert.equal(c.npc('kev').anim, 'point');
  c.emit({ type: EV.GATE, id: 'g1', open: true });
  assert.ok(sim.events.some((e) => e.type === EV.GATE));
});

test('rng is forked per egg and deterministic', () => {
  const vals = [];
  for (let k = 0; k < 2; k++) makeSim(eggWorld({ id: 'E1', init(c) { vals.push(c.rng.next()); } }));
  assert.equal(vals[0], vals[1]);
});

test('a broken egg is switched off and recorded, never crashing the run', () => {
  const sim = makeSim(eggWorld({ id: 'BAD', tick() { throw new Error('oops'); } }));
  run(sim, 10);
  assert.equal(sim.debug.eggErrors.length, 1);
  assert.match(sim.debug.eggErrors[0], /BAD\.tick/);
});

test('eggs emitting events inside onEvent cannot loop forever', () => {
  const sim = makeSim(eggWorld({ id: 'LOOP', onEvent(ev, c) { if (ev.type === 'ping' || ev.type === EV.BARK) c.emit({ type: 'ping' }); } }));
  run(sim, 2, (i) => input({ bark: i === 0 }));
  assert.ok(sim.events.length < 1000);
});

test('the park fixture eggs can be found', () => {
  const sim = makeSim(parkWorld());
  place(sim, 28, 10);
  const evs = run(sim, 60, (i) => input({ bark: i % 12 === 0 }));
  assert.ok(ofType(evs, EV.EGG).some((e) => e.id === 'TX1'));
  place(sim, 15, 25);
  const e2 = run(sim, 300);
  assert.ok(ofType(e2, EV.EGG).some((e) => e.id === 'TX2'));
  assert.ok(ofType(e2, EV.BUFF).some((e) => e.kind === 'tea'));
});
