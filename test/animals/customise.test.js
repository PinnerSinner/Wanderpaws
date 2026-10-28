import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLook, validateLook, randomLook, paletteFromPixels, normHex, applyPreset, rgbToLab } from '../../src/animals/customise.js';
import { SPECIES } from '../../src/animals/species.js';
import { createRng } from '../../src/core/rng.js';
import { hexToRgb, rgbToHsl } from '../../src/core/math.js';

const hsl = (hex) => { const c = hexToRgb(hex); return rgbToHsl(c.r, c.g, c.b); };

function img(w, h, fn) {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); const i = (y * w + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; }
  return px;
}
const dog = (w, h, coat, bellyC, bg) => img(w, h, (x, y) => {
  const dx = (x - w / 2) / (w * 0.3), dy = (y - h / 2) / (h * 0.27);
  if (dx * dx + dy * dy < 1) return y > h * 0.6 ? bellyC : coat;
  return bg;
});

test('normHex accepts short and long forms, rejects junk', () => {
  assert.equal(normHex('#ABC'), '#aabbcc');
  assert.equal(normHex('e8c27a'), '#e8c27a');
  assert.equal(normHex('red', '#000000'), '#000000');
  assert.equal(normHex(42, null), null);
});

test('mergeLook fills from species defaults and merges accessories per slot', () => {
  const l = mergeLook(SPECIES.cat, { base: '#ffffff', accessories: { head: 'bowler' } });
  assert.equal(l.base, '#ffffff');
  assert.equal(l.eyes, SPECIES.cat.defaults.eyes);
  assert.equal(l.accessories.head, 'bowler');
  assert.equal(l.accessories.neck, null);
  assert.equal(l.pattern, 'stripes');
});

test('mergeLook with nothing returns the defaults', () => {
  const l = mergeLook(SPECIES.oli, null);
  assert.equal(l.base, '#e8c27a');
  assert.equal(l.decal, null);
});

test('validateLook repairs bad values', () => {
  const l = validateLook({ base: 'banana', pattern: 'paisley', patternAmount: 7, patternSeed: -3.7, accessories: { head: 'scarf', neck: 'scarf', face: 'unknown' }, trail: 'kazoo', soundPack: 'kazoo', decal: 'javascript:alert(1)' }, SPECIES.oli.defaults);
  assert.equal(l.base, '#e8c27a');
  assert.equal(l.pattern, 'none');
  assert.equal(l.patternAmount, 1);
  assert.equal(l.patternSeed, 3);
  assert.equal(l.accessories.head, null, 'scarf is not a hat');
  assert.equal(l.accessories.neck, 'scarf');
  assert.equal(l.accessories.face, null);
  assert.equal(l.trail, null, 'kazoo is not a trail');
  assert.equal(l.soundPack, 'kazoo');
  assert.equal(l.decal, null);
});

test('validateLook keeps a data URL decal and is idempotent', () => {
  const l = validateLook({ decal: 'data:image/png;base64,AAAA' });
  assert.equal(l.decal, 'data:image/png;base64,AAAA');
  assert.deepEqual(validateLook(l), l);
});

test('validateLook handles garbage input', () => {
  const l = validateLook(null);
  assert.match(l.base, /^#[0-9a-f]{6}$/);
  assert.equal(validateLook('nope').pattern, 'none');
});

test('applyPreset swaps colours but keeps accessories', () => {
  const cur = mergeLook(SPECIES.oli, { accessories: { head: 'bowler' } });
  const l = applyPreset(SPECIES.oli, 'dalmatian', cur);
  assert.equal(l.pattern, 'spots');
  assert.equal(l.accessories.head, 'bowler');
});

test('randomLook is deterministic and valid for every species', () => {
  for (const sp of Object.values(SPECIES)) {
    const a = randomLook(sp, createRng(42)), b = randomLook(sp, createRng(42));
    assert.deepEqual(a, b);
    assert.deepEqual(validateLook(a, sp.defaults), a);
  }
});

test('randomLook only equips owned accessories', () => {
  const l = randomLook(SPECIES.oli, createRng(7), { owned: ['bowler'] });
  for (const v of Object.values(l.accessories)) assert.ok(v === null || v === 'bowler');
});

test('palette: a yellow dog on green grass gives a yellow base', () => {
  const p = paletteFromPixels(dog(160, 120, [232, 194, 122], [245, 225, 170], [70, 150, 60]), 160, 120);
  const h = hsl(p.base);
  assert.ok(h.h > 0.08 && h.h < 0.17, 'hue yellow-ish: ' + p.base);
  assert.ok(h.l > 0.55);
});

test('palette: belly comes out lighter than the base', () => {
  const p = paletteFromPixels(dog(160, 120, [232, 194, 122], [250, 235, 200], [70, 150, 60]), 160, 120);
  assert.ok(hsl(p.belly).l > hsl(p.base).l, `${p.belly} vs ${p.base}`);
});

test('palette: a black cat on a white wall gives a dark base', () => {
  const p = paletteFromPixels(dog(120, 120, [30, 28, 28], [40, 38, 36], [245, 245, 240]), 120, 120);
  assert.ok(hsl(p.base).l < 0.25, p.base);
});

test('palette: background green never wins even when it fills most of the frame', () => {
  const p = paletteFromPixels(img(100, 100, (x, y) => (Math.hypot(x - 50, y - 50) < 18 ? [200, 90, 40] : [60, 160, 70])), 100, 100);
  const c = hexToRgb(p.base);
  assert.ok(c.r > c.g, p.base);
});

test('palette is deterministic and returns four hex colours', () => {
  const px = dog(97, 73, [120, 80, 50], [200, 170, 140], [180, 200, 230]);
  const a = paletteFromPixels(px, 97, 73), b = paletteFromPixels(px, 97, 73);
  assert.deepEqual({ ...a }, { ...b });
  for (const k of ['base', 'secondary', 'belly', 'tips']) assert.match(a[k], /^#[0-9a-f]{6}$/);
});

test('palette copes with tiny and uniform images', () => {
  const p = paletteFromPixels(img(3, 3, () => [10, 200, 10]), 3, 3);
  assert.match(p.base, /^#[0-9a-f]{6}$/);
  const big = paletteFromPixels(img(400, 300, () => [128, 128, 128]), 400, 300);
  assert.match(big.base, /^#[0-9a-f]{6}$/);
});

test('rgbToLab sanity', () => {
  const o = [0, 0, 0];
  rgbToLab(1, 1, 1, o); assert.ok(Math.abs(o[0] - 100) < 0.5);
  rgbToLab(0, 0, 0, o); assert.ok(Math.abs(o[0]) < 0.5);
});
