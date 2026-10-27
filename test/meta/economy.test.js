import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY, gobbleBiccies, comboBiccies, starBiccies, dailyBiccies, itemValue, modeMult } from '../../src/meta/economy.js';
import { CATALOGUE } from '../../src/worlds/catalogue.js';
import { COSMETICS } from '../../src/animals/cosmetics.js';
import { newProfile, run, finish } from './helpers.js';

test('economy: gobble value scales by catalogue value, golden and special', () => {
  const v = itemValue('teamug');
  assert.equal(v, CATALOGUE.teamug.value);
  assert.equal(gobbleBiccies('teamug'), v * ECONOMY.gobbleRate);
  assert.equal(gobbleBiccies('teamug', { golden: true }), v * ECONOMY.gobbleRate * ECONOMY.goldenMult);
  assert.equal(gobbleBiccies('teamug', { special: true }), v * ECONOMY.gobbleRate * ECONOMY.specialMult);
  assert.equal(itemValue('no-such-item'), 1);
});

test('economy: combo bonus curve', () => {
  assert.equal(comboBiccies(0), 0);
  assert.equal(comboBiccies(4), 0);
  assert.equal(comboBiccies(5), 6);
  assert.equal(comboBiccies(10), 15);
  assert.equal(comboBiccies(20), 40);
  assert.equal(comboBiccies(30), 75);
});

test('economy: stars pay first-time rates once, then the repeat rate', () => {
  assert.equal(starBiccies([false, false, false], [true, true, true]), 25 + 40 + 75);
  assert.equal(starBiccies([true, true, true], [true, true, true]), 15);
  assert.equal(starBiccies([true, false, false], [true, true, false]), 5 + 40);
  assert.equal(starBiccies([false, false, false], [false, false, false]), 0);
});

test('economy: daily pay grows with the streak and caps', () => {
  assert.equal(dailyBiccies(1), 100);
  assert.equal(dailyBiccies(2), 115);
  assert.equal(dailyBiccies(8), 100 + 7 * 15);
  assert.equal(dailyBiccies(50), 100 + 7 * 15);
  assert.equal(modeMult('chill'), 0.75);
  assert.equal(modeMult('weird'), 1);
});

test('finishRun: breakdown adds up and lands in the tin', () => {
  const { p } = newProfile();
  const r = run('w1');
  for (let i = 0; i < 40; i++) p.onRunEvent({ type: 'gobble', itemType: i % 2 ? 'teamug' : 'rubberduck', combo: i + 1 }, r);
  p.onRunEvent({ type: 'comboEnd', count: 10 }, r);
  p.onRunEvent({ type: 'egg', id: 'C1', worldId: 'w1' }, r);
  p.onRunEvent({ type: 'activity', kind: 'fetch', phase: 'success' }, r);
  const s = finish(p, 'w1', [true, true, false], {}, r);
  const b = s.breakdown;
  const sum = Object.values(b).reduce((a, n) => a + n, 0);
  assert.equal(s.biccies, sum);
  assert.equal(p.biccies, sum);
  assert.equal(b.stars, 65);
  assert.equal(b.eggs, ECONOMY.eggFirst);
  assert.equal(b.discoveries, 2 * ECONOMY.discovery);
  assert.equal(b.combos, 15);
  assert.equal(b.activities, ECONOMY.activity);
  assert.equal(b.finish, ECONOMY.finishRun);
  const expectGobbles = Math.round(20 * gobbleBiccies('teamug') + 20 * gobbleBiccies('rubberduck'));
  assert.equal(b.gobbles, expectGobbles);
});

test('finishRun: a replay pays less than the first clear', () => {
  const { p } = newProfile();
  const first = finish(p, 'w1', [true, true, true]);
  const second = finish(p, 'w1', [true, true, true]);
  assert.ok(second.biccies < first.biccies);
  assert.equal(second.breakdown.stars, 15);
});

test('finishRun: falls back to result counts when no events arrived', () => {
  const { p } = newProfile();
  const s = finish(p, 'w1', [false, false, false], { gobbled: 50, biccies: 100 });
  assert.equal(s.breakdown.gobbles, Math.round(100 * ECONOMY.gobbleRate));
  assert.equal(p.stats.gobbled, 50);
});

test('finishRun: the daily special item pays triple', () => {
  const { p } = newProfile();
  const r = run('w1', 'oli', 'story', { daily: { specialItem: 'teamug' } });
  p.onRunEvent({ type: 'gobble', itemType: 'teamug', combo: 1 }, r);
  const s = finish(p, 'w1', [false, false, false], {}, r);
  assert.equal(s.breakdown.gobbles, Math.round(gobbleBiccies('teamug', { special: true })));
});

test('balance: a typical first clear buys a mid-priced cosmetic', () => {
  // ~200 gobbles averaging value 2.5, a few combos, two stars, two eggs, 15 new entries.
  const gob = 200 * 2.5 * ECONOMY.gobbleRate;
  const est = gob + comboBiccies(10) * 4 + 65 + 2 * ECONOMY.eggFirst + 15 * ECONOMY.discovery + ECONOMY.finishRun;
  const prices = COSMETICS.map((c) => c.price).filter((n) => n > 0).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 200;
  assert.ok(est >= median, `first clear ${est} vs median price ${median}`);
  const replay = gob + comboBiccies(10) * 4 + 10 + ECONOMY.finishRun;
  const max = prices.length ? prices[prices.length - 1] : 500;
  assert.ok(replay * 3 >= max, 'the dearest thing is at most about three replays');
});
