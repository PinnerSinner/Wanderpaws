import test from 'node:test';
import assert from 'node:assert/strict';
import { gobbleThreshold, almostThreshold, canGobbleSize, grow, comboMultFor, reachFor, dropCount } from '../../src/sim/gobble.js';
import { topSpeedFor, gravityFor, jumpVelocityFor } from '../../src/sim/player.js';
import { TUNE } from '../../src/sim/tune.js';

test('gobble threshold is 60% of size, 75% in assist', () => {
  assert.equal(gobbleThreshold(1, false), 0.6);
  assert.equal(gobbleThreshold(1, true), 0.75);
  assert.ok(canGobbleSize(0.6, 1, false));
  assert.ok(!canGobbleSize(0.61, 1, false));
  assert.ok(canGobbleSize(0.74, 1, true));
});

test('almost band sits 15 points above the threshold', () => {
  assert.ok(Math.abs(almostThreshold(1, false) - 0.75) < 1e-9);
  assert.ok(Math.abs(almostThreshold(2, true) - 1.8) < 1e-9);
});

test('growth is volume-additive: cbrt(s^3 + k * item^3 * mults)', () => {
  assert.ok(Math.abs(grow(1, 1, 1) - Math.cbrt(2)) < 1e-12);
  assert.ok(Math.abs(grow(2, 1, 0.5) - Math.cbrt(8.5)) < 1e-12);
  assert.ok(Math.abs(grow(1, 0.5, 1, 1.5, 1.1) - Math.cbrt(1 + 0.125 * 1.5 * 1.1)) < 1e-12);
  assert.ok(grow(1, 0.5, 2) > grow(1, 0.5, 1));
});

test('growth slows per gobble as you grow (same item)', () => {
  const a = grow(1, 0.3, 1) - 1;
  const b = grow(2, 0.3, 1) - 2;
  assert.ok(b < a);
});

test('about 30 to 60 half-size gobbles double you at k = 1', () => {
  let s = 1, n = 0;
  while (s < 2 && n < 1000) { s = grow(s, s * 0.5, 1); n++; }
  assert.ok(n >= 5 && n <= 60, `n = ${n}`);
  s = 1; n = 0;
  while (s < 2 && n < 1000) { s = grow(s, s * 0.25, 1); n++; }
  assert.ok(n >= 30 && n <= 600, `n = ${n}`);
});

test('combo multiplier climbs 5% per gobble and caps at 1.5', () => {
  assert.equal(comboMultFor(1), 1);
  assert.ok(Math.abs(comboMultFor(2) - 1.05) < 1e-12);
  assert.equal(comboMultFor(11), 1.5);
  assert.equal(comboMultFor(50), 1.5);
});

test('reach formula matches the contract', () => {
  assert.ok(Math.abs(reachFor(1, 1, 0.4) - (0.6 + 0.2)) < 1e-12);
  assert.ok(Math.abs(reachFor(2, 1.1, 0) - 1.32) < 1e-12);
  assert.ok(reachFor(1, 1, 0, 0.35) > reachFor(1, 1, 0));
});

test('drop count: ceil(roll * dropMult)', () => {
  assert.equal(dropCount(1, 1), 1);
  assert.equal(dropCount(3, 1), 3);
  assert.equal(dropCount(3, 0.6), 2);
  assert.equal(dropCount(1, 0.6), 1);
});

test('top speed scales with size^0.85 so bigger animals cover fewer body lengths a second', () => {
  const small = topSpeedFor(0.25) / 0.25, big = topSpeedFor(25) / 25;
  assert.ok(big < small);
  assert.ok(Math.abs(topSpeedFor(2) / topSpeedFor(1) - Math.pow(2, TUNE.speedExp)) < 1e-9);
  assert.ok(topSpeedFor(1, 0.8) < topSpeedFor(1, 1));
});

test('gravity and jump scale with size; low gravity floats', () => {
  assert.ok(gravityFor(4) > gravityFor(1));
  assert.ok(gravityFor(1, true) < gravityFor(1));
  // jump height in body lengths is the same at every size
  for (const s of [0.25, 1, 10, 100]) {
    const v = jumpVelocityFor(s); const h = (v * v) / (2 * gravityFor(s));
    assert.ok(Math.abs(h / s - TUNE.jumpK) < 1e-9);
  }
  // low gravity: same height, longer hang time
  const v1 = jumpVelocityFor(1), v2 = jumpVelocityFor(1, 1, true);
  assert.ok(v2 / gravityFor(1, true) > v1 / gravityFor(1));
});
