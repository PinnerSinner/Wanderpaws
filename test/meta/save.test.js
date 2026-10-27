import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, KEY, KEY_BAK, KEY_CORRUPT, migrate, sanitize, loadData, defaultData } from '../../src/meta/save.js';
import { createStorage } from '../../src/core/storage.js';
import { createProfile } from '../../src/meta/index.js';
import { memStorage, newProfile, finish, run } from './helpers.js';

test('save: a fresh profile is new and versioned', () => {
  const { p } = newProfile();
  assert.equal(p.loadStatus, 'new');
  assert.equal(p.data.v, SCHEMA_VERSION);
  assert.equal(p.biccies, 0);
});

test('save: round trip through storage', () => {
  const { p, storage } = newProfile();
  finish(p, 'w1', [true, true, false]);
  p.onRunEvent({ type: 'egg', id: 'C2', worldId: 'w1' }, run());
  const { p: p2 } = newProfile({ storage });
  assert.equal(p2.loadStatus, 'ok');
  assert.deepEqual(p2.stars('w1'), [true, true, false]);
  assert.equal(p2.eggs.has('C2'), true);
  assert.equal(p2.biccies, p.biccies);
});

test('save: works with the real core storage (in-memory in Node)', () => {
  const st = createStorage('test.meta.' + Math.random() + '.');
  const p = createProfile(st);
  p.addBiccies(42);
  assert.equal(createProfile(st).biccies, 42);
});

test('migration: v1 scaffold-era save upgrades', () => {
  const v1 = {
    version: 1, coins: 77, journal: ['teamug', 'flipflop'], eggs: ['C1'], unlocked: ['oli', 'cat'],
    stars: { w1: [true, false, true] }, best: { w1: { size: 3.3, time: 190 } }, names: { oli: 'Olly' }, last: 'cat',
  };
  const { data, from } = migrate(v1);
  assert.equal(from, 1);
  assert.equal(data.v, SCHEMA_VERSION);
  const storage = memStorage();
  storage.set(KEY, v1);
  const p = createProfile(storage);
  assert.equal(p.loadStatus, 'migrated');
  assert.equal(p.biccies, 77);
  assert.equal(p.journal.has('flipflop'), true);
  assert.equal(p.eggs.has('C1'), true);
  assert.deepEqual(p.stars('w1'), [true, false, true]);
  assert.deepEqual(p.best('w1'), { size: 3.3, time: 190 });
  assert.equal(p.getName('oli'), 'Olly');
  assert.equal(p.lastSpecies, 'cat');
  assert.equal(p.isWorldUnlocked('w2'), true);
  // Upgraded save written back plus a backup
  assert.equal(storage.get(KEY).v, SCHEMA_VERSION);
  assert.equal(storage.get(KEY_BAK).v, SCHEMA_VERSION);
});

test('migration: unversioned saves go through v0 then v1', () => {
  const { data, from } = migrate({ coins: 5 });
  assert.equal(from, 0);
  assert.equal(data.biccies, 5);
  assert.throws(() => migrate('nonsense'));
  assert.throws(() => migrate(null));
});

test('corrupt save: falls back to the backup and keeps the wreckage', () => {
  const { p, storage } = newProfile();
  finish(p, 'w1', [true, false, false]);   // writes a backup
  const good = p.biccies;
  storage.raw.set(KEY, '{"v":2,"biccies":12');   // truncated JSON
  const p2 = createProfile(storage);
  assert.equal(p2.loadStatus, 'backup');
  assert.equal(p2.biccies, good);
  assert.ok(storage.raw.has(KEY_CORRUPT));
});

test('corrupt save with no backup: defaults, status reset', () => {
  const storage = memStorage();
  storage.raw.set(KEY, 'not json at all');
  const p = createProfile(storage);
  assert.equal(p.loadStatus, 'reset');
  assert.equal(p.biccies, 0);
  assert.ok(storage.raw.has(KEY_CORRUPT));
});

test('wrong-shaped save is sanitised rather than trusted', () => {
  const storage = memStorage();
  storage.set(KEY, { v: 2, biccies: -50, journal: 'oops', worlds: { w1: { stars: 'yes' } }, stats: { gobbled: 'lots', runs: 3 }, eggs: { C1: true } });
  const p = createProfile(storage);
  assert.equal(p.biccies, 0);
  assert.equal(p.journal.count(), 0);
  assert.deepEqual(p.stars('w1'), [false, false, false]);
  assert.equal(p.stats.gobbled, 0);
  assert.equal(p.stats.runs, 3);
  assert.equal(p.eggs.has('C1'), true);
  const s = sanitize(42);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(defaultData()).sort());
});

test('a save from a future version without a migration path loads its backup', () => {
  const storage = memStorage();
  storage.set(KEY, { v: 1, version: 1, coins: 3 });
  createProfile(storage); // writes v2 + backup
  storage.raw.set(KEY, 'garbage');
  assert.equal(loadData(storage).status, 'backup');
});

test('reset wipes progress and ghosts', () => {
  const { p, storage } = newProfile();
  finish(p, 'w1', [true, true, true]);
  p.ghost.save('w1', [1, 2, 3, 4, 5]);
  p.reset();
  assert.equal(p.biccies, 0);
  assert.equal(p.isWorldUnlocked('w2'), false);
  assert.equal(p.ghost.load('w1'), null);
  assert.equal(createProfile(storage).biccies, 0);
});
