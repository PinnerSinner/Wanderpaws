import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { makeSim, run, input, ofType } from './helpers.js';

const goals = (o = {}) => ({ goals: { start: 0.25, goal: 0.3, stretch: 0.35, timer: 70, par: 50, growthK: 1, milestones: [], star3: { kind: 'noHazards' }, ...o } });
const shells = (n, z0 = 0.2) => { const a = []; for (let k = 0; k < n; k++) a.push({ type: 'seashell', x: 0, z: z0 + k * 0.25 }); return a; };

test('story: the timer counts down with warnings at 60, 30 and 10 s, then FINISH with a result', () => {
  const sim = makeSim(goals());
  assert.equal(sim.state.timeLeft, 70);
  const evs = run(sim, 71 * 60);
  assert.deepEqual(ofType(evs, EV.TIMER_WARN).map((e) => e.secondsLeft), [60, 30, 10]);
  const f = ofType(evs, EV.FINISH);
  assert.equal(f.length, 1);
  assert.equal(sim.state.phase, 'finished');
  const r = f[0].result;
  for (const k of ['stars', 'size', 'gobbled', 'biccies', 'time', 'goldenFound', 'eggsFound', 'maxCombo', 'distance', 'pigeonsScared', 'hazardsTouched']) assert.ok(k in r, k);
  assert.equal(r.reason, 'timeout');
  assert.deepEqual(sim.state.result, r);
});

test('stars: goal, stretch and noHazards; story ends early once the stretch is reached', () => {
  const sim = makeSim({ ...goals({ growthK: 20 }), items: { anchors: shells(30), fill: [] } });
  const evs = run(sim, 600, input({ mz: 1 }));
  const stars = ofType(evs, EV.STAR).map((e) => e.index);
  assert.ok(stars.includes(0) && stars.includes(1) && stars.includes(2), JSON.stringify(stars));
  assert.equal(sim.state.phase, 'finished');
  assert.equal(sim.state.result.reason, 'stretch');
  assert.deepEqual(sim.state.stars, [true, true, true]);
});

test('noHazards is lost when you touch one', () => {
  const sim = makeSim({ ...goals({ growthK: 20 }), items: { anchors: shells(30), fill: [] }, hazards: [{ kind: 'puddle', x: 0, z: 0.5, r: 0.3 }] }, { species: 'cat' });
  run(sim, 600, input({ mz: 1 }));
  assert.equal(sim.state.stars[2], false);
  assert.equal(sim.state.stars[0], true);
});

test('collectAll star counts a type (defaulting to every one placed)', () => {
  const sim = makeSim({ ...goals({ star3: { kind: 'collectAll', type: 'teamug' } }), items: { anchors: [{ type: 'teamug', x: 3, z: 0 }, { type: 'teamug', x: 3, z: 0.3 }], fill: [] } }, { species: 'elephant' });
  assert.equal(sim.state.goals.star3.count, 2);
  const evs = run(sim, 300, input({ mx: 1 }));
  assert.ok(ofType(evs, EV.STAR).some((e) => e.index === 2));
});

test('golden star', () => {
  const sim = makeSim({ ...goals({ star3: { kind: 'golden' } }), items: { anchors: [{ type: 'seashell', x: 0, z: 0.12, golden: true }], fill: [] } });
  run(sim, 40);
  assert.equal(sim.state.stars[2], true);
});

test('combo star', () => {
  const sim = makeSim({ ...goals({ star3: { kind: 'combo', count: 5 }, goal: 10, stretch: 20 }), items: { anchors: shells(8), fill: [] } });
  run(sim, 300, input({ mz: 1 }));
  assert.equal(sim.state.stars[2], true);
});

test('par star: reach the goal under par', () => {
  const sim = makeSim({ ...goals({ star3: { kind: 'par' }, growthK: 20 }), items: { anchors: shells(10), fill: [] } });
  run(sim, 300, input({ mz: 1 }));
  assert.equal(sim.state.stars[0], true);
  assert.equal(sim.state.stars[2], true);
});

test('chill: no timer, never star 2, finishes at the goal', () => {
  const sim = makeSim({ ...goals({ growthK: 20 }), items: { anchors: shells(30), fill: [] } }, { mode: 'chill' });
  assert.equal(sim.state.timeLeft, null);
  run(sim, 600, input({ mz: 1 }));
  assert.equal(sim.state.phase, 'finished');
  assert.equal(sim.state.stars[1], false);
  assert.equal(sim.state.stars[0], true);
});

test('chill without reaching the goal just keeps going', () => {
  const sim = makeSim(goals(), { mode: 'chill' });
  run(sim, 100 * 60);
  assert.equal(sim.state.phase, 'play');
});

test('speedrun: untimed, ends the moment you reach the goal; star 2 is under par', () => {
  const sim = makeSim({ ...goals({ growthK: 20 }), items: { anchors: shells(30), fill: [] } }, { mode: 'speedrun' });
  assert.equal(sim.state.timeLeft, null);
  run(sim, 600, input({ mz: 1 }));
  assert.equal(sim.state.result.reason, 'goal');
  assert.equal(sim.state.stars[1], true);
  assert.ok(sim.state.result.time < 10);
  assert.ok(sim.state.result.size < 0.35);
});

test('zoomies: a 3-minute run with respawn waves and a combo score', () => {
  const sim = makeSim({ ...goals(), items: { anchors: shells(10), fill: [] } }, { mode: 'zoomies' });
  assert.equal(sim.state.timeLeft, 180);
  let evs = run(sim, 300, input({ mz: 1 }));
  const gobbled = ofType(evs, EV.GOBBLE).length;
  assert.ok(gobbled >= 8);
  assert.ok(sim._S.run.score > 0);
  evs = run(sim, 15 * 60);
  assert.ok(ofType(evs, EV.ACTIVITY).some((e) => e.kind === 'wave'));
  evs = run(sim, 180 * 60);
  assert.equal(sim.state.phase, 'finished');
  assert.ok('score' in sim.state.result);
});

test('daily mode applies the daily modifier', () => {
  const sim = makeSim(goals(), { mode: 'daily', daily: { specialItem: 'seashell', modifier: 'lowGravity' } });
  assert.equal(sim._S.gravityScale < 1, true);
  assert.equal(sim.state.timeLeft, 70);
});

test('after the finish, input is ignored', () => {
  const sim = makeSim(goals({ timer: 1 }));
  run(sim, 70);
  assert.equal(sim.state.phase, 'finished');
  const z = sim.state.player.z;
  run(sim, 60, input({ mz: 1 }));
  assert.ok(Math.abs(sim.state.player.z - z) < 0.01);
});

test('result biccies include item values and combo payouts', () => {
  const sim = makeSim({ ...goals({ goal: 10, stretch: 20, timer: 20 }), items: { anchors: shells(10), fill: [] } });
  run(sim, 21 * 60, input({ mz: 1 }));
  assert.ok(sim.state.result.biccies >= 10);
  assert.equal(sim.state.result.gobbled, 10);
});
