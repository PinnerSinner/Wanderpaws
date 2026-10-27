import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS } from '../../src/meta/achievements.js';
import { SPECIES_ORDER } from '../../src/animals/species.js';
import { t, hasCopy, allKeys } from '../../src/core/copy/index.js';
import '../../src/meta/copy.js';
import { newProfile, run, finish } from './helpers.js';

const achOf = (out) => out.filter((e) => e.type === 'achievement').map((e) => e.id);

test('achievements: about forty, unique ids, copy for each', () => {
  assert.ok(ACHIEVEMENTS.length >= 38 && ACHIEVEMENTS.length <= 55, String(ACHIEVEMENTS.length));
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) {
    assert.ok(hasCopy(`ach.${a.id}.name`), a.id);
    assert.ok(hasCopy(`ach.${a.id}.desc`), a.id);
  }
  assert.equal(t('ach.absoluteUnit.name'), 'Absolute Unit');
});

test('copy: no em dashes in meta copy', () => {
  for (const k of allKeys()) if (k.startsWith('ach.') || k.startsWith('meta.')) assert.ok(!t(k).includes('\u2014'), k);
});

test('Tea-Total: five Tea Times in one run, mid-run', () => {
  const { p } = newProfile();
  const r = run('w2');
  let got = [];
  for (let i = 0; i < 5; i++) got = got.concat(achOf(p.onRunEvent({ type: 'buff', kind: 'tea', duration: 6 }, r)));
  assert.deepEqual(got.filter((x) => x === 'teaTotal'), ['teaTotal']);
  assert.equal(p.stats.tea, 5);
});

test('Tea-Total: mugs and buffs are not double counted', () => {
  const { p } = newProfile();
  const r = run('w1');
  for (let i = 0; i < 4; i++) {
    p.onRunEvent({ type: 'gobble', itemType: 'teamug', combo: 1 }, r);
    p.onRunEvent({ type: 'buff', kind: 'tea', duration: 6 }, r);
  }
  assert.equal(p.stats.tea, 4);
  assert.equal(p.achievements.has('teaTotal'), false);
});

test('Fluent in Pombo: 100 pigeons across runs', () => {
  const { p } = newProfile();
  p.onRunEvent({ type: 'pigeonScare', count: 60 }, run('w1'));
  finish(p, 'w1');
  const out = p.onRunEvent({ type: 'pigeonScare', count: 40 }, run('w1'));
  assert.ok(achOf(out).includes('fluentInPombo'));
  assert.equal(p.stats.pigeons, 100);
});

test('egg achievements: Three-Way Handshake and Turning It Off and On Again', () => {
  const { p } = newProfile();
  assert.ok(achOf(p.onRunEvent({ type: 'egg', id: 'M10', worldId: 'w5' }, run('w5'))).includes('threeWayHandshake'));
  assert.ok(achOf(p.onRunEvent({ type: 'egg', id: 'M14', worldId: 'w5' }, run('w5'))).includes('turnItOffAndOn'));
});

test('size and combo achievements', () => {
  const { p } = newProfile();
  const r = run('w5');
  assert.ok(achOf(p.onRunEvent({ type: 'milestone', index: 3, size: 120 }, r)).includes('absoluteUnit'));
  assert.ok(p.achievements.has('bigLad'));
  const out = p.onRunEvent({ type: 'combo', count: 25, mult: 1.5 }, r);
  assert.ok(achOf(out).includes('comboBreaker'));
  assert.ok(p.achievements.has('onARoll'));
});

test('finish achievements: Hat Trick, Not a Scratch, Feet Up', () => {
  const { p } = newProfile();
  const s = finish(p, 'w1', [true, true, true], { hazardsTouched: 0 }, run('w1', 'oli', 'chill'));
  for (const id of ['hatTrick', 'notAScratch', 'goldStar', 'feetUp']) assert.ok(s.achievements.includes(id), id);
  const again = finish(p, 'w1', [true, true, true], { hazardsTouched: 0 });
  assert.ok(!again.achievements.includes('hatTrick'), 'only once');
});

test('Biscuit Tin and Every Animal Is a Good Animal', () => {
  const { p } = newProfile();
  p.addBiccies(500);
  assert.ok(p.achievements.pending().includes('biscuitTin'));
  let last = null;
  for (const sp of SPECIES_ORDER) last = finish(p, 'w1', [false, false, false], {}, run('w1', sp));
  assert.ok(last.achievements.includes('everyAnimal'));
});

test('mid-run achievements are not repeated by finishRun', () => {
  const { p } = newProfile();
  const r = run('w1');
  const mid = achOf(p.onRunEvent({ type: 'gobble', itemType: 'teamug', combo: 1 }, r));
  assert.ok(mid.includes('elevenses'));
  const s = finish(p, 'w1', [false, false, false], {}, r);
  assert.ok(!s.achievements.includes('elevenses'));
});

test('achievements.list reports earned state', () => {
  const { p } = newProfile();
  p.onRunEvent({ type: 'gobble', itemType: 'teamug', combo: 1 }, run());
  const list = p.achievements.list();
  assert.equal(list.length, ACHIEVEMENTS.length);
  const e = list.find((a) => a.id === 'elevenses');
  assert.equal(e.earned, true);
  assert.equal(e.nameKey, 'ach.elevenses.name');
  assert.equal(p.achievements.count(), list.filter((a) => a.earned).length);
});

test('stats: tracked live and at finish', () => {
  const { p } = newProfile();
  const r = run('w1');
  p.onRunEvent({ type: 'gobble', itemType: 'teamug', combo: 1 }, r);
  p.onRunEvent({ type: 'bark' }, r);
  p.onRunEvent({ type: 'playBow' }, r);
  p.onRunEvent({ type: 'splash', size: 1 }, r);
  p.onRunEvent({ type: 'jump' }, r);
  p.onRunEvent({ type: 'bump', by: 'hazard', dropped: 1 }, r);
  p.onRunEvent({ type: 'footstep', surface: 'sand' }, r);
  finish(p, 'w1', [true, false, false], { size: 3.5, time: 240, distance: 812 }, r);
  const s = p.stats;
  assert.equal(s.gobbled, 1);
  assert.equal(s.barks, 1);
  assert.equal(s.playBows, 1);
  assert.equal(s.splashes, 1);
  assert.equal(s.jumps, 1);
  assert.equal(s.bumps, 1);
  assert.equal(s.runs, 1);
  assert.equal(s.distance, 812);
  assert.equal(s.timePlayed, 240);
  assert.equal(s.biggestSize, 3.5);
  assert.equal(s.stars, 1);
  assert.equal(s.tea, 1);
  assert.equal(p.speciesBest('oli'), 3.5);
});

test('derived and noisy events are ignored cheaply', () => {
  const { p } = newProfile();
  const a = p.onRunEvent({ type: 'footstep' }, run());
  const b = p.onRunEvent({ type: 'journalNew', itemType: 'x' }, run());
  assert.equal(a.length, 0);
  assert.equal(a, b, 'shared frozen empty array');
  assert.equal(p.onRunEvent(null, run()).length, 0);
});
