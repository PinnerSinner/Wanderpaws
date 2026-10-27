import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput, KONAMI_TOKEN } from '../../src/input/index.js';
import { createSettings } from '../../src/core/settings.js';
import { createBus } from '../../src/core/events.js';
import { fakeEnv, fakePad } from './helpers.js';
import { MENU_DELAY, MENU_INTERVAL } from '../../src/input/menu.js';

function setup(extra = {}) {
  const env = fakeEnv();
  const settings = createSettings(null);
  for (const k in extra) settings.set(k, extra[k]);
  const bus = createBus();
  const input = createInput({ element: env.element, settings, bus, win: env.win, now: env.clock });
  return { env, settings, bus, input };
}

test('keyboard: WASD and arrows move, diagonals are normalised', () => {
  const { env, input } = setup();
  env.key('keydown', 'KeyW');
  let r = input.poll();
  assert.equal(r.moveY, 1); assert.equal(r.moveX, 0);
  env.key('keydown', 'ArrowRight');
  r = input.poll();
  assert.ok(Math.abs(Math.hypot(r.moveX, r.moveY) - 1) < 1e-9);
  env.key('keyup', 'KeyW'); env.key('keyup', 'ArrowRight');
  r = input.poll();
  assert.equal(r.moveX, 0); assert.equal(r.moveY, 0);
});

test('keyboard: edges latch until poll even if released first', () => {
  const { env, input } = setup();
  env.tap('Space');
  env.tap('KeyE');
  env.tap('KeyQ');
  let r = input.poll();
  assert.equal(r.jump, true); assert.equal(r.sig, true); assert.equal(r.bark, true);
  assert.equal(r.jumpHeld, true, 'held counts for the latched tick');
  r = input.poll();
  assert.equal(r.jump, false); assert.equal(r.sig, false); assert.equal(r.bark, false);
  env.key('keydown', 'KeyQ');
  r = input.poll(); assert.equal(r.bark, true); assert.equal(r.barkHeld, true);
  r = input.poll(); assert.equal(r.bark, false); assert.equal(r.barkHeld, true);
});

test('keyboard: auto-repeat does not re-fire edges', () => {
  const { env, input } = setup();
  env.key('keydown', 'Space');
  input.poll();
  env.key('keydown', 'Space', { repeat: true });
  assert.equal(input.poll().jump, false);
});

test('keyboard: sprint, pause, photo, confirm and cancel', () => {
  const { env, input } = setup();
  env.key('keydown', 'ShiftLeft');
  env.tap('Escape'); env.tap('KeyP'); env.tap('Enter');
  const r = input.poll();
  assert.equal(r.sprint, true); assert.equal(r.pause, true); assert.equal(r.photo, true);
  assert.equal(r.confirm, true); assert.equal(r.cancel, true);
});

test('keyboard: arrows and Space are kept from scrolling, but not in text fields', () => {
  const { env } = setup();
  assert.equal(env.key('keydown', 'ArrowDown').defaultPrevented, true);
  assert.equal(env.key('keydown', 'Space').defaultPrevented, true);
  const field = { tagName: 'INPUT', type: 'text' };
  assert.equal(env.key('keydown', 'Space', { target: field }).defaultPrevented, false);
  assert.equal(env.key('keydown', 'KeyW', { target: field }).defaultPrevented, false);
  assert.equal(env.key('keydown', 'Enter', { target: { tagName: 'BUTTON' } }).defaultPrevented, false, 'buttons activate natively');
  assert.equal(env.key('keydown', 'KeyP', { ctrl: true }).defaultPrevented, false, 'browser shortcuts');
  assert.equal(env.key('keydown', 'F5').defaultPrevented, false);
});

test('text fields: no game input, no menu, no text events', () => {
  const { env, input } = setup();
  const seen = [];
  input.onMenu((a) => seen.push(a));
  input.onText((c) => seen.push(c));
  env.doc.activeElement = { tagName: 'TEXTAREA' };
  env.tap('ArrowDown'); env.tap('KeyB'); env.tap('Enter');
  env.key('keydown', 'KeyW');
  assert.deepEqual(seen, []);
  assert.equal(input.poll().moveY, 0);
});

test('menu: arrows fire at once and repeat on hold; Enter, Esc and Q/E', () => {
  const { env, input } = setup();
  const seen = [];
  input.onMenu((a, info) => seen.push(`${a}${info.repeat ? '*' : ''}`));
  env.key('keydown', 'ArrowDown');
  assert.deepEqual(seen, ['down']);
  env.advance(MENU_DELAY - 0.05); input.poll();
  assert.deepEqual(seen, ['down']);
  env.advance(0.06); input.poll();
  env.advance(MENU_INTERVAL + 0.001); input.poll();
  assert.deepEqual(seen, ['down', 'down*', 'down*']);
  env.key('keyup', 'ArrowDown');
  env.advance(1); input.poll();
  assert.equal(seen.length, 3);
  seen.length = 0;
  env.tap('Enter'); env.tap('Escape'); env.tap('KeyE'); env.tap('KeyQ');
  assert.deepEqual(seen, ['confirm', 'cancel', 'tabNext', 'tabPrev']);
});

test('menu: releasing one of two held arrows does not fire the other', () => {
  const { env, input } = setup();
  const seen = [];
  input.onMenu((a) => seen.push(a));
  env.key('keydown', 'ArrowDown');
  env.key('keydown', 'ArrowRight');
  env.key('keyup', 'ArrowRight');
  assert.deepEqual(seen, ['down', 'right']);
  const r = input.poll();
  assert.equal(r.menuY, -1);
});

test('menu: confirm on a focused button is flagged native', () => {
  const { env, input } = setup();
  let info = null;
  input.onMenu((a, i) => { if (a === 'confirm') info = i; });
  env.doc.activeElement = { tagName: 'BUTTON' };
  env.tap('Enter');
  assert.equal(info.native, true);
  env.doc.activeElement = env.body;
  env.tap('Enter');
  assert.equal(info.native, false);
});

test('onText: letters and digits, upper-cased, for title codes', () => {
  const { env, input } = setup();
  let buf = '';
  input.onText((c) => { buf += c; });
  for (const ch of 'bighead') env.tap('Key' + ch.toUpperCase());
  env.tap('Digit1', { key: '1' });
  env.tap('ShiftLeft', { key: 'Shift' });
  assert.equal(buf, 'BIGHEAD1');
});

test('Konami from the keyboard', () => {
  const { env, input } = setup();
  const hits = [];
  input.onKonami((tok) => hits.push(tok));
  for (const c of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']) env.tap(c);
  assert.deepEqual(hits, [KONAMI_TOKEN]);
});

test('gamepad: stick moves with a deadzone, A jumps on the press only', () => {
  const { env, input } = setup();
  env.setPads([fakePad({ axes: [0.05, -0.05, 0, 0] })]);
  assert.equal(input.poll().moveY, 0);
  env.setPads([fakePad({ axes: [0, -1, 0, 0], pressed: [0], timestamp: 2 })]);
  let r = input.poll();
  assert.ok(r.moveY > 0.99, 'stick up is forward');
  assert.equal(r.jump, true);
  assert.equal(input.device, 'pad');
  r = input.poll();
  assert.equal(r.jump, false);
  assert.equal(r.jumpHeld, true);
  env.setPads([fakePad({ pressed: [7, 2, 3, 9, 8] })]);
  r = input.poll();
  assert.equal(r.sprint, true); assert.equal(r.sig, true); assert.equal(r.bark, true);
  assert.equal(r.pause, true); assert.equal(r.photo, true);
  env.setPads([fakePad({ pressed: [5] })]);
  assert.equal(input.poll().sig, true, 'RB is also the signature');
});

test('gamepad: menus from the d-pad with repeat, A/B/bumpers', () => {
  const { env, input } = setup();
  const seen = [];
  input.onMenu((a) => seen.push(a));
  env.setPads([fakePad({ pressed: [13] })]);
  input.poll();
  env.advance(0.1); input.poll();
  env.advance(MENU_DELAY); input.poll();
  assert.deepEqual(seen, ['down', 'down']);
  seen.length = 0;
  env.setPads([fakePad()]); input.poll();
  for (const b of [0, 1, 4, 5]) { env.setPads([fakePad({ pressed: [b] })]); input.poll(); env.setPads([fakePad()]); input.poll(); }
  assert.deepEqual(seen, ['confirm', 'cancel', 'tabPrev', 'tabNext']);
});

test('gamepad: Konami on the d-pad plus B, A', () => {
  const { env, input } = setup();
  let hit = 0;
  input.onKonami(() => hit++);
  for (const b of [12, 12, 13, 13, 14, 15, 14, 15, 1, 0]) {
    env.setPads([fakePad({ pressed: [b] })]); input.poll();
    env.setPads([fakePad()]); input.poll();
  }
  assert.equal(hit, 1);
});

test('look: mouse drag on the canvas, IJKL, right stick, sensitivity and invert', () => {
  const { env, input, settings } = setup();
  input.consumeLook();
  env.pointer('pointerdown', { clientX: 100, clientY: 100 });
  env.pointer('pointermove', { clientX: 140, clientY: 90 });
  env.pointer('pointerup', { clientX: 140, clientY: 90 });
  let l = input.consumeLook();
  assert.ok(l.dx > 0 && l.dy < 0);
  env.pointer('pointermove', { clientX: 400, clientY: 90 });
  assert.equal(input.consumeLook().dx, 0, 'no drag after release');
  env.key('keydown', 'KeyL');
  env.advance(0.05);
  l = input.consumeLook();
  assert.ok(l.dx > 0);
  env.key('keyup', 'KeyL');
  env.setPads([fakePad({ axes: [0, 0, 0, 1] })]);
  input.poll();
  env.advance(0.05);
  l = input.consumeLook();
  assert.ok(l.dy > 0);
  settings.set('invertY', true);
  env.advance(0.05);
  assert.ok(input.consumeLook().dy < 0);
  settings.set('lookSensitivity', 0);
  env.advance(0.05);
  assert.equal(input.consumeLook().dy === 0, true);
});

test('look: drags that start on UI controls are ignored', () => {
  const { env, input } = setup();
  input.consumeLook();
  const btn = { tagName: 'BUTTON', closest: () => ({}) };
  env.pointer('pointerdown', { clientX: 0, clientY: 0, target: btn });
  env.pointer('pointermove', { clientX: 50, clientY: 0 });
  assert.equal(input.consumeLook().dx, 0);
});

test('rebind: persists through settings and takes effect', () => {
  const { env, input, settings } = setup();
  const b = input.rebind('jump', 'KeyJ');
  assert.equal(b.jump[0], 'KeyJ');
  assert.ok(settings.get('bindings').jump.includes('KeyJ'));
  env.tap('KeyJ');
  assert.equal(input.poll().jump, true);
  env.tap('Space');
  assert.equal(input.poll().jump, false);
  input.resetBindings();
  env.tap('Space');
  assert.equal(input.poll().jump, true);
});

test('captureNext: the controls page grabs the next key or pad button', () => {
  const { env, input } = setup();
  let got;
  input.captureNext((c) => { got = c; });
  env.tap('KeyZ');
  assert.equal(got, 'KeyZ');
  assert.equal(input.poll().jump, false);
  input.captureNext((c) => { got = c; });
  env.tap('Escape');
  assert.equal(got, null);
  input.captureNext((c) => { got = c; });
  env.setPads([fakePad({ pressed: [3] })]);
  const r = input.poll();
  assert.equal(got, 'Pad3');
  assert.equal(r.bark, false);
});

test('one-handed: auto-sprint and the keys round the arrows', () => {
  const { env, input } = setup({ oneHanded: true });
  env.key('keydown', 'ArrowUp');
  env.tap('Slash'); env.tap('Period'); env.tap('Comma');
  const r = input.poll();
  assert.equal(r.sprint, true);
  assert.equal(r.moveY, 1);
  assert.equal(r.jump, true); assert.equal(r.sig, true); assert.equal(r.bark, true);
});

test('one-handed: hold the mouse to walk towards the pointer', () => {
  const { env, input } = setup({ oneHanded: true });
  env.pointer('pointerdown', { clientX: 640, clientY: 100 });
  let r = input.poll();
  assert.ok(r.moveY > 0.9);
  env.pointer('pointerup', { clientX: 640, clientY: 100 });
  r = input.poll();
  assert.equal(r.moveY, 0);
  env.pointer('pointerdown', { button: 2, clientX: 640, clientY: 360 });
  assert.equal(input.poll().jump, true);
});

test('auto-sprint setting sets sprint', () => {
  const { input } = setup({ autoSprint: true });
  assert.equal(input.poll().sprint, true);
});

test('setEnabled(false) silences play but keeps pause and menus', () => {
  const { env, input } = setup();
  const seen = [];
  input.onMenu((a) => seen.push(a));
  input.setEnabled(false);
  env.key('keydown', 'KeyW');
  env.tap('Space'); env.tap('Escape');
  const r = input.poll();
  assert.equal(r.moveY, 0); assert.equal(r.jump, false);
  assert.equal(r.pause, true);
  assert.ok(seen.includes('cancel'));
  input.setEnabled(true);
  assert.equal(input.poll().moveY, 1);
});

test('blur releases held keys', () => {
  const { env, input } = setup();
  env.key('keydown', 'KeyW');
  env.win.fire('blur', {});
  assert.equal(input.poll().moveY, 0);
});

test('touch visibility API and bus wiring are safe without a DOM', () => {
  const { input, bus } = setup();
  input.touch.setVisible(true);
  bus.emit('go', { type: 'go' });
  bus.emit('pause', { type: 'pause' });
  assert.equal(input.touch.visible, false);
  assert.equal(typeof input.device, 'string');
});

test('dispose removes listeners', () => {
  const { env, input } = setup();
  assert.ok(env.win.count('keydown') > 0);
  input.dispose();
  assert.equal(env.win.count('keydown'), 0);
  assert.equal(env.element.count('pointerdown'), 0);
});
