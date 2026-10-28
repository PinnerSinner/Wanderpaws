import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS, COSMETIC_SLOTS, getCosmetic, cosmeticsForSlot, SHOP_COSMETICS } from '../../src/animals/cosmetics.js';
import { hasCopy } from '../../src/core/copy/index.js';
import '../../src/animals/species.js';

test('30 to 45 shop cosmetics across every slot', () => {
  assert.ok(SHOP_COSMETICS.length >= 30 && SHOP_COSMETICS.length <= 45, String(SHOP_COSMETICS.length));
  for (const slot of COSMETIC_SLOTS) assert.ok(cosmeticsForSlot(slot).length >= 3, slot);
});

test('ids are unique and slots valid', () => {
  const ids = new Set();
  for (const c of COSMETICS) {
    assert.ok(!ids.has(c.id), c.id); ids.add(c.id);
    assert.ok(COSMETIC_SLOTS.includes(c.slot), c.id);
    assert.ok(Number.isInteger(c.price) && c.price >= 0);
    assert.equal(c.nameKey, `cosmetic.${c.id}.name`);
    assert.ok(hasCopy(c.nameKey), c.nameKey);
  }
});

test('the brief items exist', () => {
  for (const id of ['bowler', 'carnivalcrown', 'partyhat', 'goggles', 'flatcap', 'bobblehat', 'beret', 'tiara', 'bandanared', 'bowtie', 'scarf', 'goodanimal', 'cape', 'backpack', 'swimring', 'sunglasses', 'monocle', 'heartglasses', 'bubbles', 'sparkles', 'hearts', 'teasteam', 'wavetiles', 'datapackets', 'squeaky', 'kazoo', 'opera', 'robot']) assert.ok(getCosmetic(id), id);
});

test('unlock conditions are well formed', () => {
  const kinds = ['achievement', 'egg', 'finish', 'stars', 'golden', 'never'];
  for (const c of COSMETICS) if (c.unlock) {
    assert.ok(kinds.includes(c.unlock.kind), c.id);
    if (c.unlock.kind === 'egg') assert.match(c.unlock.egg, /^[A-Z]\d+$/);
    if (c.unlock.kind === 'stars') assert.ok(c.unlock.count > 0);
  }
  assert.ok(COSMETICS.some((c) => c.free));
});

test('getCosmetic returns null for unknown and hidden items stay out of the shop', () => {
  assert.equal(getCosmetic('nope'), null);
  assert.ok(getCosmetic('touristhat').hidden);
  assert.ok(!SHOP_COSMETICS.some((c) => c.hidden));
});
