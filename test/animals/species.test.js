import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_ORDER, SIGNATURE_KINDS, ARCHETYPES, PATTERNS, IDLE_ANIMS, getSpecies } from '../../src/animals/species.js';
import { hasCopy, t, tRaw } from '../../src/core/copy/index.js';

const HEX = /^#[0-9a-f]{6}$/i;
const LOOK_COLOURS = ['base', 'secondary', 'belly', 'tips', 'eyes', 'nose', 'patternColor'];

test('roster has the 13 ids in order', () => {
  assert.deepEqual(SPECIES_ORDER, ['oli', 'cat', 'capybara', 'penguin', 'rabbit', 'duck', 'tortoise', 'frog', 'redpanda', 'octopus', 'snake', 'elephant', 'routercat']);
  assert.deepEqual(Object.keys(SPECIES).sort(), [...SPECIES_ORDER].sort());
});

test('getSpecies falls back to Oli', () => {
  assert.equal(getSpecies('nope').id, 'oli');
  assert.equal(getSpecies('cat').id, 'cat');
});

test('every species has the contract shape', () => {
  for (const id of SPECIES_ORDER) {
    const s = SPECIES[id];
    assert.equal(s.id, id);
    assert.equal(s.nameKey, `species.${id}.name`);
    assert.equal(s.blurbKey, `species.${id}.blurb`);
    assert.ok(ARCHETYPES.includes(s.archetype), id);
    for (const k of ['speed', 'accel', 'turn', 'jump', 'reach', 'startSize', 'waterSpeed', 'slideSpeed']) assert.ok(s.stats[k] > 0 && s.stats[k] < 3, `${id}.${k}`);
    for (const k of ['swims', 'floats', 'canJump']) assert.equal(typeof s[k], 'boolean');
    for (const k of ['squeezeGaps', 'underFences', 'climbs', 'noDrops']) assert.equal(typeof s.traits[k], 'boolean');
    assert.ok(s.traits.dropMult >= 0 && s.traits.foodBonus >= 0);
    assert.ok(s.hitbox.radius > 0 && s.hitbox.height > 0);
    assert.equal(s.sounds.voice, id);
    assert.ok(['start', 'stars', 'finish', 'journal', 'golden', 'secret', 'egg', 'story'].includes(s.unlock.kind), id);
    for (const [surf, m] of Object.entries(s.affinity.surfaces)) assert.ok(m > 0.5 && m < 2, `${id} ${surf}`);
  }
});

test('signature kinds are complete and unique', () => {
  const kinds = SPECIES_ORDER.map((id) => SPECIES[id].signature.kind);
  assert.deepEqual([...kinds].sort(), [...SIGNATURE_KINDS].sort());
  for (const id of SPECIES_ORDER) {
    const g = SPECIES[id].signature;
    assert.ok(g.cooldown > 0 && g.duration > 0);
    assert.equal(g.nameKey, `species.${id}.sig`);
    assert.equal(g.descKey, `species.${id}.sigDesc`);
  }
});

test('defaults are complete, valid looks', () => {
  for (const id of SPECIES_ORDER) {
    const d = SPECIES[id].defaults;
    for (const k of LOOK_COLOURS) assert.match(d[k], HEX, `${id}.${k}`);
    assert.ok(PATTERNS.includes(d.pattern));
    assert.ok(d.patternAmount >= 0 && d.patternAmount <= 1);
    assert.deepEqual(Object.keys(d.accessories).sort(), ['back', 'face', 'head', 'neck']);
  }
});

test('every species has 4+ presets with valid hex colours', () => {
  for (const id of SPECIES_ORDER) {
    const pr = SPECIES[id].presets;
    assert.ok(pr.length >= 4, id);
    const ids = new Set();
    for (const p of pr) {
      assert.ok(!ids.has(p.id)); ids.add(p.id);
      assert.equal(p.nameKey, `species.${id}.preset.${p.id}`);
      for (const [k, v] of Object.entries(p.look)) if (LOOK_COLOURS.includes(k)) assert.match(v, HEX, `${id}.${p.id}.${k}`);
      if (p.look.pattern) assert.ok(PATTERNS.includes(p.look.pattern));
    }
  }
});

test('Oli has the dog breed presets including yellow Lab', () => {
  const ids = SPECIES.oli.presets.map((p) => p.id);
  for (const want of ['yellowlab', 'blacklab', 'choclab', 'collie', 'dalmatian', 'beagle', 'husky']) assert.ok(ids.includes(want), want);
  assert.equal(SPECIES.oli.defaults.base.toLowerCase(), '#e8c27a');
});

test('personality values are in range with idle biases', () => {
  for (const id of SPECIES_ORDER) {
    const p = SPECIES[id].personality;
    for (const k of ['bounce', 'sleek', 'weight', 'wag']) assert.ok(p[k] >= 0 && p[k] <= 1, `${id}.${k}`);
    for (const k of IDLE_ANIMS) assert.ok(p.idleBias[k] >= 0, `${id} idle ${k}`);
    assert.equal(typeof p.extraIdle, 'string');
  }
  assert.ok(SPECIES.cat.personality.sleek > SPECIES.tortoise.personality.sleek);
  assert.ok(SPECIES.rabbit.personality.bounce > SPECIES.tortoise.personality.bounce);
  assert.equal(SPECIES.oli.personality.wag, 1);
});

test('all species copy is registered', () => {
  for (const id of SPECIES_ORDER) {
    const s = SPECIES[id];
    for (const k of [s.nameKey, s.blurbKey, s.signature.nameKey, s.signature.descKey]) assert.ok(hasCopy(k), k);
    for (const p of s.presets) assert.ok(hasCopy(p.nameKey), p.nameKey);
    const th = tRaw(`species.${id}.thought`);
    assert.ok(Array.isArray(th) && th.length >= 3);
    for (const line of th) assert.ok(line.includes('{name}'));
  }
  assert.equal(t('species.oli.name'), 'Oli');
});

test('no em dashes in animal copy', async () => {
  const { ANIMAL_COPY } = await import('../../src/animals/copy.js');
  for (const [k, v] of Object.entries(ANIMAL_COPY)) assert.ok(!String(v).includes(String.fromCharCode(0x2014)), k);
});
