import test from 'node:test';
import assert from 'node:assert/strict';
import { createShuffleBag, createSequence } from '../../src/dialogue/shufflebag.js';
import { createRng } from '../../src/core/rng.js';

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: i }));

test('shuffle bag never repeats back-to-back, across many refills', () => {
  const bag = createShuffleBag(items(5), createRng(1));
  let last = null;
  for (let i = 0; i < 5000; i++) {
    const it = bag.next();
    assert.notEqual(it, last);
    last = it;
  }
});

test('shuffle bag deals every line once before any repeats', () => {
  const list = items(12);
  const bag = createShuffleBag(list, createRng(2));
  const seen = new Set();
  for (let i = 0; i < 12; i++) seen.add(bag.next().id);
  assert.equal(seen.size, 12);
});

test('shuffle bag respects weights', () => {
  // weight 3 among six weight-1 lines: a third of draws, which the
  // no-repeat rule allows (a line can never exceed half of all draws)
  const list = [{ id: 'a', w: 3 }, ...'bcdefg'.split('').map((id) => ({ id, w: 1 }))];
  const bag = createShuffleBag(list, createRng(3));
  const n = {};
  for (let i = 0; i < 9000; i++) { const id = bag.next().id; n[id] = (n[id] || 0) + 1; }
  const ratio = n.a / ((9000 - n.a) / 6);
  assert.ok(ratio > 2.2 && ratio < 3.4, 'weight 3 drawn about 3x as often, got ' + ratio.toFixed(2));
});

test('fractional weights include the line some of the time', () => {
  const list = [{ id: 'a', w: 0.5 }, { id: 'b', w: 1 }, { id: 'c', w: 1 }];
  const bag = createShuffleBag(list, createRng(4));
  const n = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 6000; i++) n[bag.next().id]++;
  assert.ok(n.a > 0 && n.a < n.b * 0.8);
});

test('filters restrict lines and a single match still plays', () => {
  const list = [{ id: 'a', s: 'cat' }, { id: 'b', s: 'dog' }, { id: 'c', s: 'dog' }];
  const bag = createShuffleBag(list, createRng(5));
  for (let i = 0; i < 50; i++) assert.notEqual(bag.next((x) => x.s === 'dog').id, 'a');
  for (let i = 0; i < 5; i++) assert.equal(bag.next((x) => x.s === 'cat').id, 'a');
  assert.equal(bag.next((x) => x.s === 'fish'), null);
});

test('sequence plays in order and then stops', () => {
  const s = createSequence(['one', 'two', 'three']);
  assert.deepEqual([s.next(), s.next(), s.next(), s.next()], ['one', 'two', 'three', null]);
  assert.ok(s.done);
});
