import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirector, EVENT_MIN_GAP } from '../../src/dialogue/index.js';
import { createRng } from '../../src/core/rng.js';
import { EV } from '../../src/core/events.js';

function setup({ npcs = [], speciesId = 'oli', seed = 7, flags = {} } = {}) {
  const d = createDirector({ rng: createRng(seed) });
  const lines = [];
  d.onLine((l) => lines.push(l));
  const state = { phase: 'play', time: 0, worldId: 'w1', player: { x: 0, z: 0, size: 1 }, npcs, flags };
  const ctx = { state, worldId: 'w1', speciesId, playerName: 'Biscuit' };
  d.reset('w1');
  const run = (secs, each) => { for (let i = 0; i < secs * 60; i++) { state.time += 1 / 60; d.tick(1 / 60, ctx); if (each) each(i); } };
  return { d, lines, state, ctx, run };
}

test('director imports in Node and has the contract API', () => {
  const d = createDirector({});
  for (const k of ['onLine', 'onEvent', 'tick', 'reset']) assert.equal(typeof d[k], 'function');
});

test('lines have the contract shape', () => {
  const { d, lines, ctx } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 3, z: 0 }] });
  d.onEvent({ type: EV.MILESTONE, index: 0 }, ctx);
  const l = lines[0];
  assert.ok(l);
  for (const k of ['speaker', 'text', 'lang', 'anchor', 'style', 'ttl', 'blip']) assert.ok(l[k] != null, k);
  assert.ok(['chatter', 'thought', 'item', 'big'].includes(l.style));
  assert.ok(typeof l.blip.pitch === 'number' && typeof l.blip.wave === 'string');
});

test('intro is the narrator, styled big, with the world intro', () => {
  const { d, lines, ctx } = setup();
  d.onEvent({ type: EV.INTRO, worldId: 'w1' }, ctx);
  assert.equal(lines[0].speaker, 'narrator');
  assert.equal(lines[0].style, 'big');
  assert.match(lines[0].key, /^bark.narrator.intro-w1-/);
});

test('player thoughts are in the player name and styled as thoughts', () => {
  const { d, lines, ctx } = setup();
  d.onEvent({ type: EV.IDLE, seconds: 12, anim: 'sit' }, ctx);
  d.onEvent({ type: EV.BUMP, dropped: 2 }, ctx); // may be gated, fine
  const th = lines.find((l) => l.speaker === 'player');
  assert.ok(th, 'a thought fired');
  assert.equal(th.style, 'thought');
  assert.match(th.text, /Biscuit/);
  assert.equal(th.voiceId, undefined, 'animals do not speak English');
});

test('EV.SAY is always voiced, even straight after another line', () => {
  const { d, lines, ctx } = setup({ npcs: [{ id: 'kev1', kind: 'kev', x: 300, z: 0 }] });
  d.onEvent({ type: EV.INTRO, worldId: 'w1' }, ctx);
  d.onEvent({ type: EV.SAY, speaker: 'kev', key: 'bark.kev.egg-C11' }, ctx);
  d.onEvent({ type: EV.SAY, speaker: 'kev', key: 'bark.kev.egg-C11' }, ctx);
  const says = lines.filter((l) => l.speaker === 'kev');
  assert.equal(says.length, 2);
  assert.equal(says[0].text, 'Oi. I can see you.');
  assert.equal(says[0].voiceId, 'kev-egg-C11');
  assert.equal(says[0].anchor, 'kev1');
  assert.ok(says[0].force);
});

test('EV.SAY with an unknown key still speaks and gets a recordable voiceId', () => {
  const { d, lines, ctx } = setup();
  d.onEvent({ type: EV.SAY, speaker: 'gerald', key: 'egg.C99.line', x: 1, z: 2 }, ctx);
  assert.equal(lines[0].voiceId, 'egg-C99-line');
  assert.deepEqual(lines[0].anchor, { x: 1, y: 1.5, z: 2 });
});

test('Zé lines arrive in pt-BR with an English sub', () => {
  const { d, lines, ctx, run } = setup({ npcs: [{ id: 'z', kind: 'human', speakerId: 'ze', x: 4, z: 4 }], seed: 11 });
  run(120);
  const ze = lines.filter((l) => l.speaker === 'ze');
  assert.ok(ze.length > 3);
  for (const l of ze) { assert.equal(l.lang, 'pt-BR'); assert.ok(l.sub); }
});

test('proximity: far-away cast never chimes in', () => {
  const { lines, run } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 500, z: 0 }, { id: 'p', kind: 'pru', x: 0, z: 400 }] });
  run(120);
  assert.ok(lines.length > 0);
  for (const l of lines) assert.ok(['player', 'narrator'].includes(l.speaker), l.speaker);
});

test('proximity: nearby cast do chime in, anchored on their npc', () => {
  const { lines, run } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 6, z: 0 }] });
  run(120);
  const g = lines.filter((l) => l.speaker === 'gerald');
  assert.ok(g.length >= 3);
  for (const l of g) assert.equal(l.anchor, 'g');
});

test('proximity range grows with the player', () => {
  const { d, state } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 60, z: 0 }] });
  assert.equal(d.nearbyCast(state).length, 0);
  state.player.size = 8;
  assert.equal(d.nearbyCast(state).length, 1);
});

test('ambient pace is roughly one line every 3 to 5 seconds, never spammy', () => {
  const { lines, d, run } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 5, z: 0 }, { id: 'z', speakerId: 'ze', kind: 'human', x: -5, z: 0 }, { id: 'p', kind: 'pru', x: 0, z: 5 }] });
  const times = [];
  d.onLine(() => times.push(d.clock));
  run(300);
  const rate = times.length / 300;
  assert.ok(rate > 1 / 7 && rate < 1 / 2.8, 'lines per second ' + rate.toFixed(3));
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 2.9, 'gap ' + (times[i] - times[i - 1]));
  assert.ok(lines.length === times.length);
});

test('speaker cooldown: the same cast member does not talk twice within 7 s', () => {
  const { d, run } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 5, z: 0 }] });
  const last = {};
  let ok = true;
  d.onLine((l) => { if (l.speaker === 'gerald' && !l.force) { if (last.g != null && d.clock - last.g < 6.99) ok = false; last.g = d.clock; } });
  run(300, (i) => { if (i % 40 === 0) d.onEvent({ type: EV.GOBBLE, combo: 1 }, {}); });
  assert.ok(ok);
});

test('event lines respect the global gap; priority events bypass it', () => {
  const { d, lines, ctx } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 5, z: 0 }] });
  d.onEvent({ type: EV.MILESTONE, index: 0 }, ctx);
  const n = lines.length;
  for (let i = 0; i < 30; i++) d.onEvent({ type: EV.BUMP, dropped: 1 }, ctx);
  assert.equal(lines.length, n, 'bumps inside the gap are dropped');
  d.onEvent({ type: EV.STAR, index: 1 }, ctx);
  assert.equal(lines.length, n + 1, 'a star always gets a line');
  assert.ok(EVENT_MIN_GAP >= 1.5);
});

test('routing: pigeon scares prefer Gerald when he is near', () => {
  let gerald = 0, total = 0;
  for (let seed = 1; seed < 40; seed++) {
    const { d, lines, ctx } = setup({ seed, npcs: [{ id: 'g', kind: 'gerald', x: 5, z: 0 }, { id: 'm', kind: 'marco', x: 4, z: 0 }] });
    d.onEvent({ type: EV.PIGEON_SCARE, count: 6 }, ctx);
    if (lines.length) { total++; if (lines[0].speaker === 'gerald') gerald++; }
  }
  assert.ok(total > 10 && gerald === total);
});

test('routing: fetch activity is Marco, combos only on round numbers', () => {
  const { d, lines, ctx } = setup({ npcs: [{ id: 'm', kind: 'marco', x: 5, z: 0 }] });
  d.onEvent({ type: EV.ACTIVITY, kind: 'fetch', phase: 'start' }, ctx);
  assert.equal(lines[0].speaker, 'marco');
  assert.match(lines[0].voiceId, /marco-activity-fetch-start/);
  const s2 = setup({ npcs: [{ id: 'm', kind: 'marco', x: 5, z: 0 }] });
  s2.d.onEvent({ type: EV.COMBO, count: 7 }, s2.ctx);
  assert.equal(s2.lines.length, 0);
});

test('routing: combo lines fill in the count', () => {
  let found = false;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const { d, lines, ctx } = setup({ seed });
    d.onEvent({ type: EV.COMBO, count: 10 }, ctx);
    if (lines[0] && lines[0].text.includes('10')) found = true;
    if (lines[0]) assert.ok(!lines[0].text.includes('{count}'));
  }
  assert.ok(found);
});

test('routing: weather goes to nearby cast or the narrator', () => {
  const { d, lines, ctx } = setup({ npcs: [{ id: 'z', kind: 'ze', x: 5, z: 0 }] });
  d.onEvent({ type: EV.WEATHER, kind: 'parade' }, ctx);
  assert.equal(lines[0].speaker, 'ze');
  const s2 = setup();
  s2.d.onEvent({ type: EV.WEATHER, kind: 'rain' }, s2.ctx);
  assert.equal(s2.lines[0].speaker, 'narrator');
});

test('routing: tea buff is Pru if she is near, else a thought', () => {
  const a = setup({ npcs: [{ id: 'p', kind: 'pru', x: 5, z: 0 }] });
  a.d.onEvent({ type: EV.BUFF, kind: 'tea', duration: 6 }, a.ctx);
  assert.equal(a.lines[0].speaker, 'pru');
  const b = setup();
  b.d.onEvent({ type: EV.BUFF, kind: 'tea', duration: 6 }, b.ctx);
  assert.equal(b.lines[0].speaker, 'player');
});

test('go plays Gerald story beats in order, finish plays the outro', () => {
  const { d, lines, ctx } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 50, z: 0 }] });
  d.onEvent({ type: EV.GO }, ctx);
  assert.equal(lines[0].voiceId, 'gerald-story-w1-01');
  d.onEvent({ type: EV.FINISH, result: {} }, ctx);
  assert.match(lines.at(-1).key, /^bark.narrator.outro-w1/);
});

test('species flavour: cats never get dog-only thoughts', () => {
  const { lines, run } = setup({ speciesId: 'cat', seed: 3 });
  run(400);
  const th = lines.filter((l) => l.speaker === 'player');
  assert.ok(th.length > 10);
  for (const l of th) assert.ok(!/sausage|tail is wagging/i.test(l.text), l.text);
});

test('chatter pauses with the sim clock and stops when finished', () => {
  const { d, lines, state, ctx } = setup({ npcs: [{ id: 'g', kind: 'gerald', x: 5, z: 0 }] });
  for (let i = 0; i < 60 * 60; i++) d.tick(1 / 60, ctx);  // state.time never advances: paused
  assert.equal(lines.length, 0);
  state.phase = 'finished';
  for (let i = 0; i < 60 * 30; i++) { state.time += 1 / 60; d.tick(1 / 60, ctx); }
  assert.equal(lines.length, 0);
});

test('almost lines name the item when the item has copy, and skip otherwise', async () => {
  const { registerCopy } = await import('../../src/core/copy/index.js');
  registerCopy('en-GB', { 'item.testbus.name': 'Double-decker' });
  let named = false;
  for (let seed = 1; seed < 60 && !named; seed++) {
    const { d, lines, ctx } = setup({ seed });
    d.onEvent({ type: EV.ALMOST, itemType: 'testbus' }, ctx);
    if (lines[0]) { assert.match(lines[0].text, /double-decker/); named = true; }
    const s2 = setup({ seed });
    s2.d.onEvent({ type: EV.ALMOST, itemType: 'nope' }, s2.ctx);
    for (const l of s2.lines) assert.ok(!l.text.includes('{item}'));
  }
  assert.ok(named);
});

test('good boy mode turns captions into good boys', () => {
  const { d, lines, ctx } = setup({ flags: { goodBoy: true } });
  d.onEvent({ type: EV.STAR, index: 0 }, ctx);
  assert.match(lines[0].text, /good|best/i);
});
