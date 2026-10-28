// Things the real world data relies on (World-data requests in REQUESTS.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EV } from '../../src/core/events.js';
import { makeSim, run, input, ofType, itemIndex } from './helpers.js';

test('a collider with openFlag is solid until the flag is set', () => {
  const sim = makeSim({ colliders: [{ kind: 'box', id: 'door404', x: 0, z: 2, w: 20, d: 0.5, h: 5, openFlag: 'M3.open' }] });
  run(sim, 200, input({ mz: 1 }));
  assert.ok(sim.state.player.z < 2);
  sim.state.flags['M3.open'] = true;
  run(sim, 200, input({ mz: 1 }));
  assert.ok(sim.state.player.z > 2.5);
});

test('nogobble items (curling stones) are pushed about without a bump', () => {
  const sim = makeSim({ items: { anchors: [{ type: 'curlingstone', x: 0, z: 2 }], fill: [] }, goals: { start: 1.5, goal: 45, stretch: 60, timer: 300, growthK: 1, milestones: [], star3: { kind: 'combo', count: 30 } } }, { species: 'cat' });
  sim.state.flags['nogobble:curlingstone'] = true;
  const i = itemIndex(sim, 'curlingstone');
  const evs = run(sim, 120, input({ mz: 1, sprint: true }));
  assert.equal(ofType(evs, EV.BUMP).length, 0);
  assert.equal(ofType(evs, EV.GOBBLE).length, 0);
  assert.ok(sim.state.items.z[i] > 2.5, 'stone moved');
});

test('a football just too big to eat gets knocked, not bonked', () => {
  const sim = makeSim({ items: { anchors: [{ type: 'football', x: 0, z: 1 }], fill: [] } });
  const i = itemIndex(sim, 'football');
  const evs = run(sim, 120, input({ mz: 1, sprint: true }));
  assert.equal(ofType(evs, EV.BUMP).length, 0);
  assert.ok(sim.state.items.z[i] > 1.2);
});

test('custom egg events pass straight through to sim.events', () => {
  const sim = makeSim({ eggs: [{ id: 'X', onEvent(ev, c) { if (ev.type === EV.BARK) c.emit({ type: 'snowAngel', x: 1, z: 2 }); } }] });
  const evs = run(sim, 2, (i) => input({ bark: i === 0 }));
  assert.equal(ofType(evs, 'snowAngel').length, 1);
});

test('state.playerName, perchY and the marcoJog alias', () => {
  const sim = makeSim({ cast: [
    { id: 'nigel', kind: 'critter', mesh: 'nigel', x: 5, z: 5, behaviour: 'idle', params: { perchY: 40 } },
    { id: 'marco', kind: 'human', mesh: 'marco', x: -5, z: 5, behaviour: 'marcoJog', params: { path: [[-5, 5], [5, 5]] } },
  ] });
  assert.equal(sim.state.playerName, 'Oli');
  run(sim, 30);
  assert.ok(sim.state.npcs[0].y > 39);
  assert.equal(sim.state.npcs[1].behaviour, 'marco');
});

test('hazard ids become npc ids (ctx.npc finds the marmoset)', () => {
  let c;
  makeSim({ hazards: [{ kind: 'marmoset', id: 'marmoset', x: 3, z: 3 }], eggs: [{ id: 'T4', init(x) { c = x; } }] });
  assert.equal(c.npc('marmoset').kind, 'marmoset');
});
