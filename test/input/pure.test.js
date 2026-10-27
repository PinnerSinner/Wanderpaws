import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radialDeadzone, responseCurve, axisDeadzone, buttonPressed, padDirection, pickPad, padActive, PAD } from '../../src/input/pad.js';
import { DEFAULT_BINDINGS, resolveBindings, rebindAction, actionsForCode, indexBindings, ONE_HANDED_EXTRA } from '../../src/input/bindings.js';
import { createKonami, keyToken, padToken, KONAMI } from '../../src/input/konami.js';
import { createRepeater, isTextTarget, isNativeActivator, textChar, MENU_DELAY, MENU_INTERVAL } from '../../src/input/menu.js';
import { fakePad } from './helpers.js';

const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('pad: radial deadzone zeroes the centre and rescales to full at the rim', () => {
  const o = radialDeadzone(0.1, 0.05, 0.15, 0.95, 1);
  assert.equal(o.mag, 0); assert.equal(o.x, 0);
  const full = radialDeadzone(0, -1, 0.15, 0.95, 1.6);
  close(full.mag, 1); close(full.y, -1);
  const mid = radialDeadzone(0.55, 0, 0.15, 0.95, 1);
  close(mid.x, 0.5);
});

test('pad: deadzone is radial (diagonals keep their direction)', () => {
  const o = radialDeadzone(0.5, 0.5, 0.15, 0.95, 1.6);
  close(o.x, o.y);
  assert.ok(o.mag > 0 && o.mag < 1);
  const out = { x: 0, y: 0, mag: 0 };
  assert.equal(radialDeadzone(1, 0, 0.1, 0.9, 1, out), out, 'writes into out');
});

test('pad: response curve is gentle in the middle', () => {
  close(responseCurve(0), 0); close(responseCurve(1), 1);
  assert.ok(responseCurve(0.5, 2) < 0.5);
  close(responseCurve(0.5, 1), 0.5);
  close(responseCurve(2), 1);
  assert.equal(axisDeadzone(0.05), 0);
  close(axisDeadzone(-1), -1);
});

test('pad: buttons, directions, picking and activity', () => {
  assert.equal(buttonPressed({ pressed: true, value: 1 }), true);
  assert.equal(buttonPressed({ pressed: false, value: 0.7 }), true);
  assert.equal(buttonPressed({ pressed: false, value: 0.2 }), false);
  assert.equal(buttonPressed(0.9), true);
  assert.equal(buttonPressed(undefined), false);
  assert.equal(padDirection(fakePad({ pressed: [PAD.UP] })), 'up');
  assert.equal(padDirection(fakePad({ pressed: [PAD.RIGHT] })), 'right');
  assert.equal(padDirection(fakePad({ axes: [0, 0.9, 0, 0] })), 'down');
  assert.equal(padDirection(fakePad({ axes: [-0.8, 0.2, 0, 0] })), 'left');
  assert.equal(padDirection(fakePad({ axes: [0.3, 0.2, 0, 0] })), null);
  const a = fakePad({ timestamp: 5 }), b = fakePad({ timestamp: 9 });
  assert.equal(pickPad([null, a, b]), b);
  assert.equal(pickPad([]), null);
  assert.equal(padActive(fakePad()), false);
  assert.equal(padActive(fakePad({ pressed: [0] })), true);
});

test('bindings: defaults follow SPEC §9', () => {
  const b = resolveBindings(null);
  assert.ok(b.up.includes('KeyW') && b.up.includes('ArrowUp'));
  assert.ok(b.left.includes('KeyA') && b.right.includes('ArrowRight'));
  assert.deepEqual([b.lookUp, b.lookLeft, b.lookDown, b.lookRight].map((x) => x[0]), ['KeyI', 'KeyJ', 'KeyK', 'KeyL']);
  assert.ok(b.jump.includes('Space') && b.jump.includes('Pad0'));
  assert.ok(b.sprint.includes('ShiftLeft') && b.sprint.includes('Pad7'));
  assert.ok(b.sig.includes('KeyE') && b.sig.includes('Pad2') && b.sig.includes('Pad5'));
  assert.ok(b.bark.includes('KeyQ') && b.bark.includes('Pad3'));
  assert.ok(b.photo.includes('KeyP') && b.photo.includes('Pad8'));
  assert.ok(b.pause.includes('Escape') && b.pause.includes('Pad9'));
  assert.deepEqual(actionsForCode(b, 'KeyE'), ['sig']);
  assert.deepEqual(indexBindings(b).get('Space'), ['jump']);
});

test('bindings: rebinding swaps a clash so nothing is left unbound', () => {
  let custom = rebindAction({}, 'jump', 'KeyE');
  const b = resolveBindings(custom);
  assert.equal(b.jump[0], 'KeyE');
  assert.ok(b.jump.includes('Pad0'), 'pad codes kept');
  assert.ok(!b.sig.includes('KeyE'));
  assert.ok(b.sig.includes('Space'), 'sig took the old jump key');
  custom = rebindAction(custom, 'bark', 'Pad1');
  const b2 = resolveBindings(custom);
  assert.equal(b2.bark.filter((c) => c.startsWith('Pad'))[0], 'Pad1');
  assert.ok(b2.bark.includes('KeyQ'));
  assert.deepEqual(rebindAction({}, 'nope', 'KeyZ'), {});
});

test('bindings: one-handed adds nearby keys without stealing', () => {
  const b = resolveBindings(null, true);
  for (const a in ONE_HANDED_EXTRA) for (const c of ONE_HANDED_EXTRA[a]) {
    const owners = Object.keys(b).filter((k) => b[k].includes(c));
    assert.equal(owners.length, 1, c);
  }
  assert.ok(b.jump.includes('Slash'));
  assert.ok(b.sig.includes('Period'));
  assert.ok(b.bark.includes('Comma'));
  assert.deepEqual(resolveBindings(null).jump, DEFAULT_BINDINGS.jump);
});

test('konami: matches the sequence, ignores noise before it', () => {
  const k = createKonami();
  const seq = ['L', 'A', 'U', ...KONAMI];
  const hits = seq.map((s) => k.push(s));
  assert.deepEqual(hits.map((h, i) => (h ? i : -1)).filter((i) => i >= 0), [seq.length - 1]);
});

test('konami: extra ups at the start still match, wrong order does not', () => {
  const k = createKonami();
  let hit = false;
  for (const s of ['U', 'U', 'U', 'D', 'D', 'L', 'R', 'L', 'R', 'B', 'A']) hit = k.push(s) || hit;
  assert.equal(hit, true);
  const k2 = createKonami();
  hit = false;
  for (const s of ['U', 'U', 'D', 'D', 'R', 'L', 'R', 'L', 'B', 'A']) hit = k2.push(s) || hit;
  assert.equal(hit, false);
  const k3 = createKonami();
  for (const s of ['U', 'U', 'D']) k3.push(s);
  assert.equal(k3.progress, 3);
  assert.equal(keyToken('ArrowUp'), 'U');
  assert.equal(keyToken('KeyB'), 'B');
  assert.equal(keyToken('KeyX'), null);
  assert.equal(padToken(12), 'U');
  assert.equal(padToken(0), 'A');
  assert.equal(padToken(1), 'B');
});

test('menu repeat: fires at once, waits the delay, then repeats', () => {
  const r = createRepeater();
  assert.equal(r.update('down', 0), 'down');
  assert.equal(r.update('down', 0.1), null);
  assert.equal(r.update('down', MENU_DELAY - 0.01), null);
  assert.equal(r.update('down', MENU_DELAY + 0.001), 'down');
  assert.equal(r.update('down', MENU_DELAY + MENU_INTERVAL * 0.5), null);
  assert.equal(r.update('down', MENU_DELAY + MENU_INTERVAL + 0.002), 'down');
  assert.equal(r.update('up', 1), 'up', 'a new direction fires at once');
  assert.equal(r.update(null, 1.1), null);
  assert.equal(r.update(null, 2), null);
});

test('menu repeat: a stalled caller does not get a burst', () => {
  const r = createRepeater({ delay: 0.3, interval: 0.1 });
  r.update('left', 0);
  let n = 0;
  if (r.update('left', 5)) n++;
  if (r.update('left', 5.01)) n++;
  assert.equal(n, 1);
});

test('menu: text targets, native activators and typed characters', () => {
  assert.equal(isTextTarget({ tagName: 'INPUT', type: 'text' }), true);
  assert.equal(isTextTarget({ tagName: 'INPUT', type: '' }), true);
  assert.equal(isTextTarget({ tagName: 'INPUT', type: 'range' }), false);
  assert.equal(isTextTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTextTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTextTarget({ tagName: 'BUTTON' }), false);
  assert.equal(isTextTarget(null), false);
  assert.equal(isNativeActivator({ tagName: 'BUTTON' }), true);
  assert.equal(isNativeActivator({ tagName: 'DIV' }), false);
  assert.equal(textChar({ key: 'b' }), 'B');
  assert.equal(textChar({ key: '7' }), '7');
  assert.equal(textChar({ key: 'b', ctrlKey: true }), null);
  assert.equal(textChar({ key: 'Enter' }), null);
  assert.equal(textChar({ key: '!' }), null);
});
