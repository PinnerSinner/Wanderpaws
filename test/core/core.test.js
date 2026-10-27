import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, hashString, dateKey, dateSeed } from '../../src/core/rng.js';
import * as M from '../../src/core/math.js';
import { createBus, EV } from '../../src/core/events.js';
import { createStorage } from '../../src/core/storage.js';
import { createSettings, DEFAULT_SETTINGS } from '../../src/core/settings.js';
import { registerCopy, t, tRaw, setLocale, hasCopy } from '../../src/core/copy/index.js';
import { runFixed } from '../../src/core/loop.js';
import { GAME, SIM_DT } from '../../src/core/game.js';
import { Assets } from '../../src/assets/assets.js';

test('rng is deterministic and in range', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 1000; i++) { const x = a.next(); assert.equal(x, b.next()); assert.ok(x >= 0 && x < 1); }
});
test('rng string seeds and forks are stable', () => {
  assert.equal(createRng('oli').next(), createRng('oli').next());
  const r = createRng(7);
  const f1 = r.fork('eggs').next();
  assert.equal(createRng(7).fork('eggs').next(), f1);
  assert.notEqual(createRng(7).fork('other').next(), f1);
});
test('rng helpers', () => {
  const r = createRng(1);
  for (let i = 0; i < 200; i++) {
    const n = r.int(2, 5); assert.ok(n >= 2 && n <= 5 && Number.isInteger(n));
    const v = r.range(-1, 1); assert.ok(v >= -1 && v < 1);
  }
  const arr = [1, 2, 3, 4, 5];
  assert.deepEqual([...r.shuffle(arr.slice())].sort(), arr);
  assert.ok(arr.includes(r.pick(arr)));
});
test('hashString is FNV-1a', () => {
  assert.equal(hashString(''), 0x811c9dc5);
  assert.notEqual(hashString('a'), hashString('b'));
});
test('daily seeds differ per date and are stable', () => {
  const d1 = new Date(2026, 9, 27), d2 = new Date(2026, 9, 28);
  assert.equal(dateKey(d1), '2026-10-27');
  assert.equal(dateSeed(d1), dateSeed(new Date(2026, 9, 27, 23, 59)));
  assert.notEqual(dateSeed(d1), dateSeed(d2));
});
test('math basics', () => {
  assert.equal(M.clamp(5, 0, 1), 1);
  assert.equal(M.lerp(0, 10, 0.5), 5);
  assert.equal(M.remap(0, 10, 0, 100, 5), 50);
  assert.ok(Math.abs(M.wrapAngle(3 * Math.PI) - Math.PI) < 1e-9 || Math.abs(M.wrapAngle(3 * Math.PI) + Math.PI) < 1e-9);
  assert.ok(Math.abs(M.angleDelta(0.1, -0.1) + 0.2) < 1e-9);
  assert.ok(Math.abs(M.angleDelta(3.1, -3.1) - (2 * Math.PI - 6.2)) < 1e-9);
});
test('spring converges to target without blowing up', () => {
  const s = M.spring(0, 0);
  for (let i = 0; i < 600; i++) M.springStep(s, 1, 2, 0.5, SIM_DT);
  assert.ok(Math.abs(s.x - 1) < 1e-3);
  const big = M.spring(0, 0);
  for (let i = 0; i < 100; i++) M.springStep(big, 1, 30, 0.1, 0.1);
  assert.ok(Number.isFinite(big.x));
});
test('damp is frame-rate independent', () => {
  let a = 0; for (let i = 0; i < 60; i++) a = M.damp(a, 1, 5, 1 / 60);
  let b = 0; for (let i = 0; i < 30; i++) b = M.damp(b, 1, 5, 1 / 30);
  assert.ok(Math.abs(a - b) < 1e-9);
});
test('easing endpoints', () => {
  for (const [k, f] of Object.entries(M.ease)) {
    assert.ok(Math.abs(f(0)) < 1e-6, k + '(0)');
    assert.ok(Math.abs(f(1) - 1) < 1e-6, k + '(1)');
  }
});
test('noise is deterministic and bounded', () => {
  for (let i = 0; i < 500; i++) {
    const v = M.noise2(i * 0.37, i * 0.11);
    assert.ok(v >= -1 && v <= 1);
    assert.equal(v, M.noise2(i * 0.37, i * 0.11));
  }
});
test('colour helpers round-trip', () => {
  const { r, g, b } = M.hexToRgb('#e8c27a');
  assert.equal(M.rgbToHex(r, g, b), '#e8c27a');
  const hsl = M.rgbToHsl(r, g, b); const back = M.hslToRgb(hsl.h, hsl.s, hsl.l);
  assert.equal(M.rgbToHex(back.r, back.g, back.b), '#e8c27a');
  assert.equal(M.mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(M.hexToRgb('#fff').r, 1);
});
test('format helpers', () => {
  assert.equal(M.formatSize(0.25), '25 cm');
  assert.equal(M.formatSize(3.04), '3.0 m');
  assert.equal(M.formatSize(120.4), '120 m');
  assert.equal(M.formatTime(125), '2:05');
  assert.equal(M.formatTime(-3), '0:00');
});
test('forward convention', () => {
  assert.ok(Math.abs(M.fwdZ(0) - 1) < 1e-9);
  assert.ok(Math.abs(M.fwdX(Math.PI / 2) - 1) < 1e-9);
  assert.ok(Math.abs(M.yawOf(1, 0) - Math.PI / 2) < 1e-9);
});
test('bus emits, wildcard, unsubscribes and survives throwing handlers', () => {
  const bus = createBus();
  const got = [];
  const off = bus.on(EV.GOBBLE, (p) => got.push(p.n));
  bus.on('*', (p, type) => got.push(type));
  bus.on(EV.GOBBLE, () => { throw new Error('boom'); });
  const orig = console.error; console.error = () => {};
  bus.emit(EV.GOBBLE, { n: 1 });
  off();
  bus.emit(EV.GOBBLE, { n: 2 });
  console.error = orig;
  assert.deepEqual(got, [1, 'gobble', 'gobble']);
});
test('event names are unique strings', () => {
  const vals = Object.values(EV);
  assert.equal(new Set(vals).size, vals.length);
});
test('storage falls back to memory in Node', () => {
  const s = createStorage('test.');
  assert.equal(s.persistent, false);
  s.set('a', { x: 1 });
  assert.deepEqual(s.get('a'), { x: 1 });
  assert.equal(s.get('missing', 7), 7);
  assert.deepEqual(s.keys(), ['a']);
  s.remove('a');
  assert.equal(s.get('a'), null);
});
test('settings persist, notify and reset', () => {
  const st = createStorage('t2.');
  const s = createSettings(st);
  const seen = [];
  s.subscribe((k, v) => seen.push([k, v]));
  s.set('volMusic', 0.2);
  s.set('volMusic', 0.2);
  assert.deepEqual(seen, [['volMusic', 0.2]]);
  assert.equal(createSettings(st).get('volMusic'), 0.2);
  s.reset();
  assert.equal(s.get('volMusic'), DEFAULT_SETTINGS.volMusic);
});
test('copy lookup, vars, fallback and arrays', () => {
  registerCopy('en-GB', { 'test.hello': 'Hello {name}', 'test.arr': ['first', 'second'] });
  registerCopy('pt-BR', { 'test.hello': 'Olá {name}' });
  assert.equal(t('test.hello', { name: 'Oli' }), 'Hello Oli');
  assert.equal(t('test.arr'), 'first');
  assert.deepEqual(tRaw('test.arr'), ['first', 'second']);
  setLocale('pt-BR');
  assert.equal(t('test.hello', { name: 'Oli' }), 'Olá Oli');
  assert.equal(t('test.arr'), 'first');
  setLocale('en-GB');
  assert.equal(t('nope.missing'), 'nope.missing');
  assert.ok(hasCopy('test.hello'));
});
test('runFixed steps n times', () => {
  let n = 0; runFixed(120, (dt) => { n++; assert.equal(dt, SIM_DT); });
  assert.equal(n, 120);
});
test('game constant drives the name', () => {
  assert.equal(GAME.name, 'Gobblepaws');
  assert.equal(GAME.slug, GAME.name.toLowerCase());
});
test('assets API works with no assets', () => {
  assert.equal(Assets.has('photos/oli.jpg'), false);
  assert.equal(Assets.uri('x'), null);
  assert.deepEqual(Assets.keysWithPrefix('voice/'), []);
  globalThis.__ASSETS__ = { 'voice/a.txt': 'data:text/plain;base64,' + Buffer.from('hiya').toString('base64') };
  assert.equal(Assets.text('voice/a.txt'), 'hiya');
  assert.deepEqual(Assets.keysWithPrefix('voice/'), ['voice/a.txt']);
  delete globalThis.__ASSETS__;
});
