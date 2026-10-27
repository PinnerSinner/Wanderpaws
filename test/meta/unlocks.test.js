import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_ORDER } from '../../src/animals/species.js';
import { ruleMet, isRuleUnlocked, starCount } from '../../src/meta/rules.js';
import { itemsForWorld } from '../../src/worlds/catalogue.js';
import { newProfile, run, finish } from './helpers.js';

const byKind = (kind) => SPECIES_ORDER.filter((id) => SPECIES[id].unlock?.kind === kind);
const fakeQ = (o = {}) => ({
  stars: () => [false, false, false], totalStars: () => 0, finished: () => false, journalPct: () => 0,
  goldenFound: () => false, egg: () => false, storyDone: () => false, bought: () => false, achievement: () => false, ...o,
});

test('rules: start is always met, missing rule counts as start', () => {
  assert.equal(ruleMet({ kind: 'start' }, fakeQ()), true);
  assert.equal(ruleMet(null, fakeQ()), true);
});

test('rules: stars with a world counts that world, without counts the total', () => {
  const q = fakeQ({ stars: (w) => (w === 'w1' ? [true, true, false] : [false, false, false]), totalStars: () => 2 });
  assert.equal(ruleMet({ kind: 'stars', world: 'w1', count: 2 }, q), true);
  assert.equal(ruleMet({ kind: 'stars', world: 'w1', count: 3 }, q), false);
  assert.equal(ruleMet({ kind: 'stars', world: 'w2', count: 1 }, q), false);
  assert.equal(ruleMet({ kind: 'stars', count: 2 }, q), true);
  assert.equal(ruleMet({ kind: 'stars', count: 9 }, q), false);
});

test('rules: finish, journal, golden, egg, secret, story, achievement, price', () => {
  assert.equal(ruleMet({ kind: 'finish', world: 'w3' }, fakeQ({ finished: (w) => w === 'w3' })), true);
  assert.equal(ruleMet({ kind: 'finish', world: 'w3' }, fakeQ()), false);
  assert.equal(ruleMet({ kind: 'journal', pct: 25 }, fakeQ({ journalPct: () => 25 })), true);
  assert.equal(ruleMet({ kind: 'journal', pct: 25 }, fakeQ({ journalPct: () => 24 })), false);
  assert.equal(ruleMet({ kind: 'golden', world: 'w3' }, fakeQ({ goldenFound: (w) => w === 'w3' })), true);
  assert.equal(ruleMet({ kind: 'egg', egg: 'M12' }, fakeQ({ egg: (id) => id === 'M12' })), true);
  assert.equal(ruleMet({ kind: 'secret', egg: 'H2' }, fakeQ({ egg: (id) => id === 'H2' })), true);
  assert.equal(ruleMet({ kind: 'secret', egg: 'H2' }, fakeQ()), false);
  assert.equal(ruleMet({ kind: 'story' }, fakeQ({ storyDone: () => true })), true);
  assert.equal(ruleMet({ kind: 'achievement', id: 'x' }, fakeQ({ achievement: (id) => id === 'x' })), true);
  assert.equal(ruleMet({ kind: 'price', price: 10 }, fakeQ()), false);
  assert.equal(ruleMet({ kind: 'mystery' }, fakeQ()), false);
});

test('rules: a price is an alternative route once bought', () => {
  const rule = { kind: 'finish', world: 'w5', price: 900 };
  assert.equal(isRuleUnlocked(rule, fakeQ(), 'species:x'), false);
  assert.equal(isRuleUnlocked(rule, fakeQ({ bought: (k) => k === 'species:x' }), 'species:x'), true);
  assert.equal(starCount([true, false, true]), 2);
});

test('profile: only start animals at first, W1 only', () => {
  const { p } = newProfile();
  assert.deepEqual(p.unlockedSpecies(), byKind('start'));
  assert.equal(p.isWorldUnlocked('w1'), true);
  for (const w of ['w2', 'w3', 'w4', 'w5']) assert.equal(p.isWorldUnlocked(w), false);
  assert.equal(p.isWorldUnlocked('nope'), false);
  for (const id of SPECIES_ORDER) {
    if (byKind('start').includes(id)) assert.equal(p.unlockHint(id), '');
    else assert.equal(p.unlockHint(id), `meta.hint.${id}`);
  }
});

test('profile: world unlocks chain on one star each', () => {
  const { p } = newProfile();
  const s1 = finish(p, 'w1', [true, false, false]);
  assert.equal(p.isWorldUnlocked('w2'), true);
  assert.equal(p.isWorldUnlocked('w3'), false);
  assert.ok(s1.newUnlocks.some((u) => u.kind === 'world' && u.id === 'w2'));
  finish(p, 'w2', [false, false, false]);
  assert.equal(p.isWorldUnlocked('w3'), false, 'no star, no unlock');
  finish(p, 'w2', [false, false, true]);
  assert.equal(p.isWorldUnlocked('w3'), true, 'any star counts');
});

test('profile: stars unlock (rabbit-style rule)', () => {
  const id = byKind('stars').find((s) => SPECIES[s].unlock.world);
  if (!id) return;
  const u = SPECIES[id].unlock;
  const { p } = newProfile();
  assert.equal(p.isUnlocked(id), false);
  const stars = [false, false, false];
  for (let i = 0; i < (u.count ?? 1) - 1; i++) stars[i] = true;
  finish(p, u.world, stars);
  assert.equal(p.isUnlocked(id), (u.count ?? 1) - 1 >= (u.count ?? 1));
  stars[(u.count ?? 1) - 1] = true;
  const s = finish(p, u.world, stars);
  assert.equal(p.isUnlocked(id), true);
  assert.ok(s.newUnlocks.some((x) => x.kind === 'species' && x.id === id));
});

test('profile: finish unlock needs the goal star', () => {
  const id = byKind('finish')[0];
  if (!id) return;
  const w = SPECIES[id].unlock.world;
  const { p } = newProfile();
  finish(p, w, [false, true, true]);
  assert.equal(p.isUnlocked(id), false);
  finish(p, w, [true, false, false]);
  assert.equal(p.isUnlocked(id), true);
  assert.equal(p.finished(w), true);
});

test('profile: journal unlock fires mid-run as an UNLOCK event', () => {
  const id = byKind('journal')[0];
  if (!id) return;
  const pct = SPECIES[id].unlock.pct;
  const { p } = newProfile();
  const r = run('w1');
  const types = new Set();
  for (const w of ['w1', 'w2', 'w3', 'w4', 'w5']) for (const it of itemsForWorld(w)) if (!it.goldenOf) types.add(it.id);
  let unlockedAt = null;
  for (const type of types) {
    const out = p.onRunEvent({ type: 'gobble', itemType: type, combo: 1 }, r);
    if (out.some((e) => e.type === 'unlock' && e.id === id)) { unlockedAt = p.journal.pct(); break; }
  }
  assert.ok(unlockedAt != null, 'unlocked at some point');
  assert.ok(unlockedAt >= pct);
  assert.equal(p.isUnlocked(id), true);
});

test('profile: golden unlock from a golden find in that world', () => {
  const id = byKind('golden')[0];
  if (!id) return;
  const w = SPECIES[id].unlock.world;
  const { p } = newProfile();
  const out = p.onRunEvent({ type: 'golden', itemType: 'mango' }, run(w));
  assert.ok(out.some((e) => e.type === 'unlock' && e.kind === 'species' && e.id === id));
  assert.equal(p.goldenFound(w), true);
  assert.equal(p.goldenFound('w1'), false);
});

test('profile: golden unlock also via a golden gobble flag', () => {
  const id = byKind('golden')[0];
  if (!id) return;
  const w = SPECIES[id].unlock.world;
  const { p } = newProfile();
  p.onRunEvent({ type: 'gobble', itemType: 'rubberduck', golden: true, combo: 1 }, run(w));
  assert.equal(p.isUnlocked(id), true);
  assert.equal(p.journal.golden('rubberduck'), true);
});

test('profile: secret and egg unlocks fire mid-run', () => {
  for (const kind of ['secret', 'egg']) {
    for (const id of byKind(kind)) {
      const { p } = newProfile();
      const egg = SPECIES[id].unlock.egg;
      assert.equal(p.isUnlocked(id), false);
      const out = p.onRunEvent({ type: 'egg', id: egg, worldId: 'w1' }, run('w1'));
      assert.ok(out.some((e) => e.type === 'unlock' && e.id === id), `${id} via ${egg}`);
      assert.equal(p.isUnlocked(id), true);
      // Not announced twice
      const s = finish(p, 'w1', [false, false, false]);
      assert.ok(!s.newUnlocks.some((u) => u.id === id));
    }
  }
});

test('profile: story unlock after all five worlds', () => {
  const id = byKind('story')[0];
  if (!id) return;
  const { p } = newProfile();
  for (const w of ['w1', 'w2', 'w3', 'w4']) finish(p, w, [true, false, false]);
  assert.equal(p.isUnlocked(id), false);
  const s = finish(p, 'w5', [true, false, false]);
  assert.equal(p.isUnlocked(id), true);
  assert.ok(s.newUnlocks.some((u) => u.id === id));
  assert.ok(s.achievements.includes('geraldWho'));
});
