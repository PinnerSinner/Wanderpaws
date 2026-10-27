import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { TUNE } from '../../src/sim/tune.js';
import { topSpeedFor } from '../../src/sim/player.js';
import { makeSim, run, input, ofType } from './helpers.js';

test('acceleration ramps up rather than snapping to top speed', () => {
  const sim = makeSim();
  run(sim, 2, input({ mz: 1 }));
  const early = sim.state.player.speed;
  run(sim, 60, input({ mz: 1 }));
  const later = sim.state.player.speed;
  assert.ok(early > 0 && early < later * 0.5);
  assert.ok(Math.abs(later - topSpeedFor(0.25) * 0.98) < 0.1, `walk top ~ ${later}`);
});

test('zoomies build over about a second', () => {
  const sim = makeSim();
  run(sim, 60, input({ mz: 1 }));
  const walk = sim.state.player.speed;
  run(sim, 20, input({ mz: 1, sprint: true }));
  const mid = sim.state.player.speed;
  run(sim, 70, input({ mz: 1, sprint: true }));
  const full = sim.state.player.speed;
  assert.ok(mid > walk && mid < full);
  assert.ok(full / walk > 1.5);
  assert.ok(sim.state.player.sprinting);
  assert.ok(sim.state.player.speedNorm > 0.9);
});

test('speed in body lengths is similar across sizes (size^0.85)', () => {
  const a = makeSim(); run(a, 90, input({ mz: 1 }));
  const b = makeSim({ goals: { start: 4, goal: 10, stretch: 12, timer: 300, par: 200, growthK: 1, milestones: [], star3: { kind: 'noHazards' } }, bounds: { minX: -500, maxX: 500, minZ: -500, maxZ: 500 } });
  run(b, 90, input({ mz: 1 }));
  const blA = a.state.player.speed / 0.25, blB = b.state.player.speed / 4;
  assert.ok(blB < blA && blB > blA * 0.5);
});

test('turn rate is capped and tighter at speed', () => {
  const slow = makeSim();
  run(slow, 1, input({ mx: 1 }));
  const fastSim = makeSim();
  run(fastSim, 120, input({ mz: 1, sprint: true }));
  const y0 = fastSim.state.player.yaw;
  run(fastSim, 1, input({ mx: 1, sprint: true }));
  const fastTurn = Math.abs(fastSim.state.player.yaw - y0);
  const slowTurn = Math.abs(slow.state.player.yaw);
  assert.ok(slowTurn > fastTurn, `slow ${slowTurn} fast ${fastTurn}`);
  assert.ok(fastTurn <= TUNE.turnSlow / 60 + 1e-6);
  assert.notEqual(fastSim.state.player.turnRate, 0);
});

test('previous-tick fields are kept for interpolation', () => {
  const sim = makeSim();
  run(sim, 30, input({ mz: 1 }));
  const p = sim.state.player;
  assert.ok(p.z > p.pz);
  assert.ok(Math.abs(p.z - p.pz - p.vz / 60) < 0.01);
  for (const k of ['px', 'py', 'pz', 'pyaw', 'displaySize', 'turnRate', 'landImpact', 'gulp', 'stagger', 'emotion', 'idleAnim', 'reach', 'speedNorm']) assert.ok(k in p, k);
});

test('jump height scales with size and you land with an impact', () => {
  const sim = makeSim();
  let maxY = 0;
  const evs = run(sim, 90, (i) => { maxY = Math.max(maxY, sim.state.player.y); return input({ jump: i === 0, jumpHeld: i < 30 }); });
  assert.ok(ofType(evs, EV.JUMP).length === 1);
  assert.ok(ofType(evs, EV.LAND).length === 1);
  assert.ok(Math.abs(maxY - TUNE.jumpK * 0.25) < 0.03, `max ${maxY}`);
  assert.ok(sim.state.player.grounded);
});

test('releasing jump early cuts the jump short', () => {
  const full = makeSim(); let a = 0;
  run(full, 60, (i) => { a = Math.max(a, full.state.player.y); return input({ jump: i === 0, jumpHeld: true }); });
  const short = makeSim(); let b = 0;
  run(short, 60, (i) => { b = Math.max(b, short.state.player.y); return input({ jump: i === 0, jumpHeld: i < 2 }); });
  assert.ok(b < a * 0.8);
});

test('low gravity modifier: same height, longer hang time', () => {
  const n = makeSim(); let tn = 0;
  run(n, 200, (i) => { if (!n.state.player.grounded) tn++; return input({ jump: i === 0, jumpHeld: true }); });
  const l = makeSim({}, { modifiers: { lowGravity: true } }); let tl = 0;
  run(l, 200, (i) => { if (!l.state.player.grounded) tl++; return input({ jump: i === 0, jumpHeld: true }); });
  assert.ok(tl > tn * 1.4);
});

test('jump buffer: pressing just before landing still jumps', () => {
  const sim = makeSim();
  run(sim, 1, input({ jump: true, jumpHeld: true }));
  let landedAt = -1;
  for (let i = 0; i < 80 && landedAt < 0; i++) { run(sim, 1, input({ jumpHeld: true })); if (sim.state.player.grounded) landedAt = i; }
  // re-jump: press a few ticks before the next landing
  const sim2 = makeSim();
  run(sim2, 1, input({ jump: true, jumpHeld: true }));
  run(sim2, landedAt - 4, input({ jumpHeld: true }));
  const evs = run(sim2, 12, (i) => input({ jump: i === 0, jumpHeld: true }));
  assert.equal(ofType(evs, EV.JUMP).length, 1);
});

test('coyote time: you can still jump just after walking off a ledge', () => {
  const sim = makeSim({ heightAt: (x, z) => (z > 1 ? -2 : 0) });
  run(sim, 200, (i) => input({ mz: 1 }));
  // find the tick we left the ledge
  const sim2 = makeSim({ heightAt: (x, z) => (z > 1 ? -2 : 0) });
  let off = -1;
  for (let i = 0; i < 400 && off < 0; i++) { run(sim2, 1, input({ mz: 1 })); if (!sim2.state.player.grounded) off = i; }
  assert.ok(off > 0);
  const evs = run(sim2, 2, (i) => input({ mz: 1, jump: i === 1, jumpHeld: true }));
  assert.equal(ofType(evs, EV.JUMP).length, 1);
});

test('the snake cannot jump', () => {
  const sim = makeSim({}, { species: 'snake' });
  const evs = run(sim, 30, (i) => input({ jump: i === 0, jumpHeld: true }));
  assert.equal(ofType(evs, EV.JUMP).length, 0);
});

test('bark is a tap; a hold of 0.4 s or more is a play-bow', () => {
  const sim = makeSim();
  let evs = run(sim, 3, (i) => input({ bark: i === 0, barkHeld: i < 2 }));
  assert.equal(ofType(evs, EV.BARK).length, 1);
  assert.equal(ofType(evs, EV.PLAY_BOW).length, 0);
  assert.ok(sim.state.player.barkT < 0.1);
  evs = run(sim, 40, (i) => input({ bark: i === 0, barkHeld: true }));
  assert.equal(ofType(evs, EV.BARK).length, 0);
  assert.equal(ofType(evs, EV.PLAY_BOW).length, 1);
  assert.equal(sim.state.player.playBow, true);
  evs = run(sim, 2, input());
  assert.equal(sim.state.player.playBow, false);
  assert.equal(ofType(evs, EV.BARK).length, 0, 'releasing a play-bow is not a bark');
});

test('an instant tap (no held state) barks immediately', () => {
  const sim = makeSim();
  const evs = run(sim, 1, input({ bark: true, barkHeld: false }));
  assert.equal(ofType(evs, EV.BARK).length, 1);
});

test('footsteps come at gait intervals with alternating sides and the surface', () => {
  const sim = makeSim();
  const evs = ofType(run(sim, 120, input({ mz: 1, sprint: true })), EV.FOOTSTEP);
  assert.ok(evs.length >= 4 && evs.length < 40, `${evs.length}`);
  assert.equal(evs[0].surface, 'grass');
  assert.notEqual(evs[0].side, evs[1].side);
});

test('the intro lasts about 2 s, emits INTRO then GO, and you cannot move during it', () => {
  const sim = makeSim({}, { intro: true });
  assert.equal(sim.state.phase, 'intro');
  assert.equal(sim.events[0].type, EV.INTRO);
  sim.events.length = 0;
  let goAt = -1;
  for (let i = 0; i < 200 && goAt < 0; i++) { sim.step(input({ mz: 1 })); if (sim.events.some((e) => e.type === EV.GO)) goAt = i; sim.events.length = 0; if (goAt < 0) assert.equal(sim.state.player.z, 0); }
  assert.ok(goAt >= 115 && goAt <= 125, `go at ${goAt}`);
  assert.equal(sim.state.phase, 'play');
});

test('surface affinity: the penguin is quicker on ice than on grass', () => {
  const g = makeSim({}, { species: 'penguin' }); run(g, 120, input({ mz: 1 }));
  const ice = makeSim({ surfaceAt: () => 'ice' }, { species: 'penguin' }); run(ice, 400, input({ mz: 1 }));
  assert.ok(ice.state.player.speed > g.state.player.speed * 1.2);
});

test('ice is slippery: you keep sliding after letting go', () => {
  const grass = makeSim(); run(grass, 90, input({ mz: 1 })); run(grass, 20);
  const ice = makeSim({ surfaceAt: () => 'ice' }); run(ice, 300, input({ mz: 1 })); run(ice, 20);
  assert.ok(ice.state.player.speed > grass.state.player.speed + 0.05);
});
