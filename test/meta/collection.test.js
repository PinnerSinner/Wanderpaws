import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemsForWorld } from '../../src/worlds/catalogue.js';
import { COSMETICS } from '../../src/animals/cosmetics.js';
import { eggIdsForWorld, KNOWN_EGGS, globalEggIds } from '../../src/meta/data.js';
import { newProfile, run, finish } from './helpers.js';

const w1Items = () => itemsForWorld('w1').filter((it) => !it.goldenOf).map((it) => it.id);

test('journal: first gobble of a type emits JOURNAL_NEW once', () => {
  const { p } = newProfile();
  const r = run('w1');
  const a = p.onRunEvent({ type: 'gobble', itemType: 'teamug', combo: 1 }, r);
  assert.ok(a.some((e) => e.type === 'journalNew' && e.itemType === 'teamug'));
  const b = p.onRunEvent({ type: 'gobble', itemType: 'teamug', combo: 2 }, r);
  assert.ok(!b.some((e) => e.type === 'journalNew'));
  assert.equal(p.journal.has('teamug'), true);
  assert.equal(p.journal.times('teamug'), 2);
  // New profile on the same storage remembers it
  assert.equal(p.journal.has('flipflop'), false);
});

test('journal: per-world count, total and pct', () => {
  const { p } = newProfile();
  const items = w1Items();
  assert.equal(p.journal.total('w1'), items.length);
  assert.equal(p.journal.pct('w1'), 0);
  const half = items.slice(0, Math.ceil(items.length / 2));
  for (const id of half) p.onRunEvent({ type: 'gobble', itemType: id, combo: 1 }, run('w1'));
  assert.equal(p.journal.count('w1'), half.length);
  assert.equal(p.journal.pct('w1'), Math.floor((100 * half.length) / items.length));
  assert.ok(p.journal.total() >= items.length);
  assert.ok(p.journal.count() >= half.length);
  const list = p.journal.list('w1');
  assert.equal(list.length, items.length);
  assert.equal(list.filter((x) => x.found).length, half.length);
});

test('eggs: counts per world and totals', () => {
  const { p } = newProfile();
  const total = ['w1', 'w2', 'w3', 'w4', 'w5'].reduce((a, w) => a + eggIdsForWorld(w).length, 0);
  assert.equal(p.eggs.total(), total + globalEggIds().length);
  for (const w of ['w1', 'w2', 'w3', 'w4', 'w5']) assert.ok(!eggIdsForWorld(w).some((id) => id.startsWith('G')), 'globals once only');
  assert.equal(KNOWN_EGGS.length, 66);
  p.onRunEvent({ type: 'egg', id: 'C1', worldId: 'w1' }, run('w1'));
  p.onRunEvent({ type: 'egg', id: 'C1', worldId: 'w1' }, run('w1'));
  p.onRunEvent({ type: 'egg', id: 'L3', worldId: 'w2' }, run('w2'));
  assert.equal(p.eggs.has('C1'), true);
  assert.equal(p.eggs.count(), 2);
  assert.equal(p.eggs.count('w1'), 1);
  assert.equal(p.eggs.count('w2'), 1);
  assert.equal(p.stats.eggs, 2);
  p.onRunEvent({ type: 'egg', id: 'G8', worldId: 'w2' }, run('w2'));
  assert.equal(p.eggs.count('w2'), 1, 'global eggs belong to no world');
  assert.equal(p.eggs.count(), 3);
  p.codes.check('DISCO');
  assert.equal(p.eggs.has('G3'), true);
  assert.equal(p.eggs.count(), 4);
});

test('eggs: result.eggsFound is folded in at finish', () => {
  const { p } = newProfile();
  const s = finish(p, 'w4', [false, false, false], { eggsFound: ['H1', 'H2'] });
  assert.deepEqual(s.eggsNew, ['H1', 'H2']);
  assert.equal(p.eggs.count('w4'), 2);
});

test('shop: free items owned, buying deducts and persists', () => {
  const { p, storage } = newProfile();
  const free = COSMETICS.find((c) => c.free || c.price === 0);
  if (free) assert.equal(p.owns(free.id), true);
  const cheap = COSMETICS.filter((c) => !c.unlock && !c.free && c.price > 0).sort((a, b) => a.price - b.price)[0];
  if (!cheap) return;
  assert.equal(p.canAfford(cheap.price), false);
  assert.equal(p.buy(cheap.id), false, 'skint');
  p.addBiccies(cheap.price + 5);
  assert.equal(p.cosmeticStatus(cheap.id), 'buyable');
  assert.equal(p.buy(cheap.id), true);
  assert.equal(p.biccies, 5);
  assert.equal(p.owns(cheap.id), true);
  assert.equal(p.buy(cheap.id), false, 'already owned');
  assert.equal(p.cosmeticStatus(cheap.id), 'owned');
  assert.ok(p.achievements.pending().includes('retailTherapy'));
  // persisted
  const { p: p2 } = newProfile({ storage });
  assert.equal(p2.owns(cheap.id), true);
  assert.equal(p2.biccies, 5);
  assert.equal(p.buy('no-such-thing'), false);
});

test('shop: locked cosmetics are not for sale until their rule is met', () => {
  const locked = COSMETICS.find((c) => c.unlock && c.unlock.kind === 'finish');
  if (!locked) return;
  const { p } = newProfile();
  p.addBiccies(10000);
  assert.equal(p.cosmeticStatus(locked.id), 'locked');
  assert.equal(p.buy(locked.id), false);
  const s = finish(p, locked.unlock.world, [true, false, false]);
  assert.ok(s.newUnlocks.some((u) => u.kind === 'cosmetic' && u.id === locked.id));
  assert.equal(p.buy(locked.id), true);
});

test('looks and names per species', () => {
  const { p, storage } = newProfile();
  assert.equal(p.getName('oli'), 'Oli');
  assert.equal(p.getName('capybara'), 'Sir Reginald');
  assert.equal(p.setName('oli', '  Sir\u0007   Bark\tLot  '), 'Sir Bark Lot');
  assert.equal(p.getName('oli'), 'Sir Bark Lot');
  assert.equal(p.setName('cat', 'Abcdefghijklmnopqrstuvwxyz').length, 16);
  assert.ok(p.achievements.pending().includes('whatsInAName'));
  p.setName('oli', '   ');
  assert.equal(p.getName('oli'), 'Oli');
  const look = p.getLook('cat');
  assert.ok(look.base && look.accessories);
  p.setLook('cat', { ...look, base: '#123456' });
  const { p: p2 } = newProfile({ storage });
  assert.equal(p2.getLook('cat').base, '#123456');
  assert.equal(p.setLook('nobody', look), false);
  p.setLastSpecies('cat');
  assert.equal(p2.lastSpecies, 'oli');
  assert.equal(newProfile({ storage }).p.lastSpecies, 'cat');
});

test('records: best size and time, ghost-friendly best()', () => {
  const { p } = newProfile();
  assert.equal(p.best('w1'), null);
  let s = finish(p, 'w1', [true, false, false], { size: 3, time: 200 });
  assert.equal(s.records.size, true);
  assert.equal(s.records.time, true);
  s = finish(p, 'w1', [true, false, false], { size: 2.5, time: 180 });
  assert.equal(s.records.size, false);
  assert.equal(s.records.time, true);
  s = finish(p, 'w1', [false, false, false], { size: 4, time: 100 });
  assert.equal(s.records.time, false, 'no goal, no time record');
  assert.deepEqual(p.best('w1'), { size: 4, time: 180 });
  assert.deepEqual(p.stars('w1'), [true, false, false]);
});
