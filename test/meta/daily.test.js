import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDaily, specialItemFor, dayDiff, nextStreak, liveStreak, DAILY_MODIFIERS } from '../../src/meta/daily.js';
import { itemsForWorld } from '../../src/worlds/catalogue.js';
import { newProfile, fixedNow, run, finish } from './helpers.js';

const day = (s) => new Date(s + 'T09:30:00');

test('daily: the same date gives the same challenge', () => {
  const a = makeDaily(day('2026-11-05'), { worlds: ['w1', 'w2', 'w3'], species: ['oli', 'cat', 'penguin'] });
  const b = makeDaily(new Date('2026-11-05T22:10:00'), { worlds: ['w3', 'w1', 'w2'], species: ['penguin', 'cat', 'oli'] });
  assert.deepEqual(a, b);
  assert.equal(a.key, '2026-11-05');
});

test('daily: different dates differ', () => {
  const opts = { worlds: ['w1', 'w2', 'w3', 'w4', 'w5'], species: ['oli', 'cat', 'capybara', 'penguin'] };
  const seen = new Set();
  for (let i = 1; i <= 14; i++) {
    const d = makeDaily(day(`2026-12-${String(i).padStart(2, '0')}`), opts);
    seen.add(`${d.worldId}|${d.speciesId}|${d.modifier}|${d.specialItem}`);
    assert.ok(DAILY_MODIFIERS.includes(d.modifier));
    assert.ok(opts.worlds.includes(d.worldId));
    assert.ok(itemsForWorld(d.worldId).some((it) => it.id === d.specialItem));
    assert.equal(d.modifiers[d.modifier], true);
  }
  assert.ok(seen.size >= 10, `variety: ${seen.size}`);
  const x = makeDaily(day('2026-12-01'), opts), y = makeDaily(day('2026-12-02'), opts);
  assert.notEqual(x.seed, y.seed);
});

test('daily: picks from unlocked worlds, falling back to w1', () => {
  const d = makeDaily(day('2026-11-05'), { worlds: [], species: [] });
  assert.equal(d.worldId, 'w1');
  assert.equal(d.speciesId, 'oli');
  const { p } = newProfile();
  for (let i = 0; i < 10; i++) assert.equal(p.daily(day(`2026-11-1${i}`)).worldId, 'w1');
});

test('daily: profile caches the day so mid-day progress does not reshuffle it', () => {
  const { p } = newProfile();
  const a = p.daily(day('2026-11-05'));
  finish(p, 'w1', [true, true, true]);
  const b = p.daily(day('2026-11-05'));
  assert.deepEqual(a, b);
});

test('special item: one per world per day, stable', () => {
  assert.equal(specialItemFor('w2', day('2026-11-05')), specialItemFor('w2', new Date('2026-11-05T23:00:00')));
  assert.ok(itemsForWorld('w1').some((it) => it.id === specialItemFor('w1', day('2026-11-05'))));
});

test('streak maths', () => {
  assert.equal(dayDiff('2026-02-28', '2026-03-01'), 1);
  assert.equal(dayDiff('2026-12-31', '2027-01-01'), 1);
  assert.equal(nextStreak({ lastKey: null, streak: 0 }, '2026-11-01'), 1);
  assert.equal(nextStreak({ lastKey: '2026-11-01', streak: 3 }, '2026-11-02'), 4);
  assert.equal(nextStreak({ lastKey: '2026-11-01', streak: 3 }, '2026-11-03'), 1);
  assert.equal(nextStreak({ lastKey: '2026-11-01', streak: 3 }, '2026-11-01'), 3);
  assert.equal(liveStreak({ lastKey: '2026-11-01', streak: 3 }, '2026-11-02'), 3);
  assert.equal(liveStreak({ lastKey: '2026-11-01', streak: 3 }, '2026-11-03'), 0);
});

test('daily runs: finishRun marks the day done, pays out and builds the streak', () => {
  const now = fixedNow('2026-11-01T10:00:00');
  const { p } = newProfile({ now });
  for (let i = 1; i <= 7; i++) {
    now.set(`2026-11-0${i}T10:00:00`);
    const dl = p.daily();
    assert.equal(p.dailyDone(dl.key), false);
    const s = finish(p, dl.worldId, [true, false, false], {}, run(dl.worldId, dl.speciesId, 'daily', { daily: dl }));
    assert.equal(s.breakdown.daily, 100 + (i - 1) * 15);
    assert.equal(p.dailyDone(dl.key), true);
    assert.equal(p.streak, i);
    if (i === 7) assert.ok(s.achievements.includes('creatureOfHabit'));
  }
  // Second daily on the same day pays no daily bonus
  const again = finish(p, 'w1', [true, false, false], {}, run('w1', 'oli', 'daily', { daily: p.daily() }));
  assert.equal(again.breakdown.daily, 0);
  now.set('2026-11-09T10:00:00');
  assert.equal(p.streak, 0, 'missed a day');
  assert.equal(p.bestStreak, 7);
  assert.equal(p.stats.dailies, 7);
});

test('markDailyDone is idempotent', () => {
  const { p } = newProfile();
  assert.equal(p.markDailyDone('2026-10-27'), true);
  assert.equal(p.markDailyDone('2026-10-27'), false);
  assert.equal(p.streak, 1);
  assert.ok(p.achievements.pending().includes('sameTimeTomorrow'));
});
