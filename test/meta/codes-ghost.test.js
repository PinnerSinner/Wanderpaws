import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCode, CODES, KONAMI_TOKEN } from '../../src/meta/codes.js';
import { encodeSamples, decodeSamples, packGhost, unpackGhost, bytesToBase64, base64ToBytes, GHOST_CAP } from '../../src/meta/ghost.js';
import { newProfile } from './helpers.js';

test('codes: every title word maps to its modifier', () => {
  const want = { BIGHEAD: 'bigHead', MOONWALK: 'lowGravity', DISCO: 'disco', TINY: 'tiny', QUACKERS: 'duckRain', OLI: 'oliZoomies', [KONAMI_TOKEN]: 'goodBoy' };
  for (const [code, mod] of Object.entries(want)) assert.equal(matchCode(code).modifier, mod, code);
  assert.equal(CODES.length, 7);
});

test('codes: match at the end of a longer buffer, case-insensitive', () => {
  assert.equal(matchCode('asdfqwerBIGHEAD').code, 'BIGHEAD');
  assert.equal(matchCode('hello moonwalk').code, 'MOONWALK');
  assert.equal(matchCode('BIGHEADX'), null);
  assert.equal(matchCode(''), null);
  assert.equal(matchCode(null), null);
  assert.equal(matchCode('XXDISCOOLI').code, 'OLI');
});

test('codes: profile toggles persistent modifiers, OLI is a one-off', () => {
  const { p, storage } = newProfile();
  const r = p.codes.check('zzzbighead');
  assert.deepEqual(r, { code: 'BIGHEAD', modifier: 'bigHead', on: true, egg: 'G1' });
  assert.equal(p.modifiers.bigHead, true);
  assert.equal(p.codes.check('BIGHEAD').on, false);
  assert.equal(p.modifiers.bigHead, undefined);
  const oli = p.codes.check('OLI');
  assert.equal(oli.on, true);
  assert.equal(p.modifiers.oliZoomies, undefined);
  assert.equal(p.codes.check('nothing'), null);
  p.codes.check(p.codes.KONAMI);
  assert.equal(p.modifiers.goodBoy, true);
  assert.equal(p.eggs.has('G6'), true);
  const pend = p.achievements.pending();
  assert.ok(pend.includes('characterBuilding'));
  assert.ok(pend.includes('goodBoyMode'));
  assert.equal(newProfile({ storage }).p.modifiers.goodBoy, true);
});

test('codes: all seven earns Secret Squirrel', () => {
  const { p } = newProfile();
  for (const c of CODES) p.codes.check(c.code);
  assert.ok(p.achievements.has('secretSquirrel'));
});

test('modifiers: setModifier persists known ids only', () => {
  const { p } = newProfile();
  assert.equal(p.setModifier('mirror', true), true);
  assert.equal(p.modifiers.mirror, true);
  assert.equal(p.setModifier('nonsense', true), false);
  p.setModifier('mirror', false);
  assert.deepEqual(p.modifiers, {});
});

test('ghost: base64 round trip at every remainder', () => {
  for (let n = 0; n < 10; n++) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 255);
    const s = bytesToBase64(b);
    assert.equal(s, Buffer.from(b).toString('base64'));
    assert.deepEqual([...base64ToBytes(s)], [...b]);
  }
});

test('ghost: delta encoding round trips including big jumps and negatives', () => {
  const s = [0, 0, 0, 0, 0, 100, -200, 300, 3141, 250, -2147483648, 2147483647, 5, -6283, 1000];
  assert.deepEqual([...decodeSamples(encodeSamples(s, 5), 5)], s);
  assert.deepEqual([...decodeSamples(encodeSamples([1.4, NaN, 2.6, Infinity, -0.6], 5), 5)], [1, 0, 3, 0, -1]);
});

function fakeRun(frames) {
  const out = [];
  let x = 0, z = 0, yaw = 0;
  for (let f = 0; f < frames; f++) {
    yaw += Math.sin(f / 90) * 20;
    x += Math.round(Math.sin(yaw / 1000) * 12);
    z += Math.round(Math.cos(yaw / 1000) * 12);
    out.push(x, Math.round(Math.abs(Math.sin(f / 40)) * 30), z, Math.round(yaw), 250 + Math.floor(f / 4));
  }
  return out.map((v) => v | 0);   // no -0
}

test('ghost: a full 8000-frame run fits well under 150 KB and round trips', () => {
  const s = fakeRun(8000);   // what main.js records at most (40000 values)
  const rec = packGhost(s);
  assert.ok(rec.d.length < GHOST_CAP, `${rec.d.length} chars`);
  assert.equal(rec.every, 2);
  const back = unpackGhost(JSON.parse(JSON.stringify(rec)));
  assert.equal(back.stride, 5);
  assert.equal(back.frames, 8000);
  assert.deepEqual([...back], s);
});

test('ghost: oversized runs are decimated rather than dropped', () => {
  const s = fakeRun(4000);
  const rec = packGhost(s, { cap: 8000 });
  assert.ok(rec.d.length <= 8000);
  assert.ok(rec.every > 2);
  const back = unpackGhost(rec);
  assert.equal(back.every, rec.every);
  assert.equal(back[0], s[0]);
});

test('ghost: profile save and load per world, junk loads as null', () => {
  const { p, storage } = newProfile();
  assert.equal(p.ghost.load('w1'), null);
  const s = fakeRun(500);
  const size = p.ghost.save('w1', s);
  assert.ok(size > 0);
  assert.deepEqual([...p.ghost.load('w1')], s);
  assert.equal(p.ghost.load('w2'), null);
  storage.set('ghost.w3', { v: 1, d: '!!!!' });
  assert.equal(p.ghost.load('w3'), null);
  assert.equal(p.ghost.save('w1', []), 0);
});
