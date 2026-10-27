import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { makeSim, run, input, ofType, place } from './helpers.js';

const acts = (sim, evs, phase) => ofType(evs, EV.ACTIVITY).filter((e) => e.phase === phase && e.kind !== 'wave');

test('fetch: play-bow near Marco starts it, catching the ball succeeds', () => {
  const sim = makeSim({
    cast: [{ id: 'marco', kind: 'human', mesh: 'marco', x: 0, z: 3, behaviour: 'idle', params: {} }],
    activities: [{ kind: 'fetch', x: 0, z: 3, params: { thrower: 'marco' } }],
  });
  let evs = run(sim, 40, (i) => input({ bark: i === 0, barkHeld: true }));
  assert.equal(acts(sim, evs, 'start').length, 1);
  assert.equal(sim.state.activity.kind, 'fetch');
  const P = sim.state.projectiles;
  const b = sim.state.activity.ball;
  assert.ok(b >= 0);
  // chase the ball
  evs = run(sim, 600, () => { const p = sim.state.player; return input({ mx: P.x[b] - p.x, mz: P.z[b] - p.z, sprint: true }); });
  const ok = acts(sim, evs, 'success');
  assert.equal(ok.length, 1);
  assert.ok(ok[0].reward >= 10);
});

test('fetch fails if you ignore the ball', () => {
  const sim = makeSim({ cast: [{ id: 'marco', kind: 'human', mesh: 'marco', x: 0, z: 3, behaviour: 'idle', params: {} }], activities: [{ kind: 'fetch', x: 0, z: 3, params: {} }] });
  run(sim, 40, (i) => input({ bark: i === 0, barkHeld: true }));
  place(sim, -30, -30);
  const evs = run(sim, 800);
  assert.equal(acts(sim, evs, 'fail').length, 1);
});

test('herding: bark to start, herd pigeons into the ring', () => {
  const sim = makeSim({ activities: [{ kind: 'herding', x: 0, z: 0, params: { ring: { x: 0, z: 6, r: 2.5 }, count: 3, time: 60 } }] });
  let evs = run(sim, 2, (i) => input({ bark: i === 0 }));
  assert.equal(acts(sim, evs, 'start').length, 1);
  const pigeons = sim.state.npcs.filter((n) => n.kind === 'pigeon');
  assert.ok(pigeons.every((n) => n.visible));
  // a simple herding dog: get behind the furthest-out pigeon and push it towards the ring
  evs = run(sim, 60 * 60, (i) => {
    const p = sim.state.player;
    let best = null, bd = -1;
    for (const n of pigeons) { const d = Math.hypot(n.x, n.z - 6); if (d > 2 && d > bd) { bd = d; best = n; } }
    if (!best) return input();
    const dx = best.x - 0, dz = best.z - 6, l = Math.hypot(dx, dz) || 1;
    const tx = best.x + (dx / l) * 1.2, tz = best.z + (dz / l) * 1.2;
    return input({ mx: tx - p.x, mz: tz - p.z, bark: i % 90 === 0 && Math.hypot(tx - p.x, tz - p.z) < 1.5 });
  });
  const done = ofType(evs, EV.ACTIVITY).filter((e) => e.kind === 'herding' && e.phase !== 'start');
  assert.equal(done.length, 1);
  assert.ok(['success', 'fail'].includes(done[0].phase));
});

test('herding fails on the clock', () => {
  const sim = makeSim({ activities: [{ kind: 'herding', x: 0, z: 0, params: { ring: { x: 20, z: 20, r: 1 }, time: 5 } }] });
  run(sim, 2, (i) => input({ bark: i === 0 }));
  place(sim, -30, -30);
  const evs = run(sim, 400);
  assert.equal(acts(sim, evs, 'fail').length, 1);
  assert.ok(sim.state.npcs.filter((n) => n.kind === 'pigeon').every((n) => !n.visible));
});

test('sniff trail: walk onto the spot, gobble the treats in time', () => {
  const sim = makeSim({ activities: [{ kind: 'sniffTrail', x: 0, z: 0, params: { count: 5, item: 'brigadeiro', time: 40 } }] });
  let evs = run(sim, 2);
  assert.equal(acts(sim, evs, 'start').length, 1);
  const I = sim.state.items;
  const trail = []; for (let i = 0; i < I.count; i++) if (sim._S.X.flag[i] === 'trail') trail.push(i);
  assert.equal(trail.length, 5);
  evs = run(sim, 40 * 60, () => {
    const p = sim.state.player;
    const t = trail.find((i) => I.state[i] <= 2);
    if (t == null) return input();
    return input({ mx: I.x[t] - p.x, mz: I.z[t] - p.z });
  });
  assert.equal(acts(sim, evs, 'success').length, 1);
});

test('sit-stay: hold still near Gerald, moving fails it', () => {
  const w = { cast: [{ id: 'gerald', kind: 'critter', mesh: 'gerald', x: 30, z: 30, behaviour: 'idle' }], activities: [{ kind: 'sitStay', x: 0, z: 0, params: { npc: 'gerald', time: 3 } }] };
  const ok = makeSim(w);
  let evs = run(ok, 300);
  assert.equal(acts(ok, evs, 'start').length, 1);
  assert.equal(acts(ok, evs, 'success').length, 1);
  const bad = makeSim(w);
  run(bad, 80);
  evs = run(bad, 30, input({ mz: 1 }));
  assert.equal(acts(bad, evs, 'fail').length, 1);
});

test('activity rewards go into the run biccies', () => {
  const sim = makeSim({ cast: [{ id: 'gerald', kind: 'critter', mesh: 'gerald', x: 30, z: 30, behaviour: 'idle' }], activities: [{ kind: 'sitStay', x: 0, z: 0, params: { npc: 'gerald', time: 2, reward: 33 } }] });
  run(sim, 300);
  assert.equal(sim._S.run.biccies, 33);
});
