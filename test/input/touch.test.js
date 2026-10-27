import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTouchGestures, createTouchControls, PAW_SVG } from '../../src/input/touch.js';

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('touch stick: appears where the thumb lands and maps up to forward', () => {
  const g = createTouchGestures({ stickRadius: 100, deadzone: 0.1 });
  assert.equal(g.start(1, 200, 500, 0, 'left'), 'stick');
  assert.equal(g.state.stick.active, true);
  assert.equal(g.state.stick.ox, 200);
  g.move(1, 200, 450);
  close(g.state.moveY, (0.5 - 0.1) / 0.9);
  close(g.state.moveX, 0);
  assert.equal(g.state.sprint, false);
  g.move(1, 255, 500);
  assert.ok(g.state.moveX > 0);
});

test('touch stick: deadzone, edge means zoomies, base follows the thumb', () => {
  const g = createTouchGestures({ stickRadius: 100, deadzone: 0.12, edge: 0.9 });
  g.start(1, 100, 100, 0, 'left');
  g.move(1, 105, 100);
  assert.equal(g.state.moveX, 0);
  g.move(1, 195, 100);
  assert.equal(g.state.sprint, true);
  g.move(1, 400, 100);
  close(g.state.moveX, 1);
  assert.equal(g.state.stick.ox, 300, 'base dragged along');
  g.end(1, 400, 100, 1);
  assert.equal(g.state.stick.active, false);
  assert.equal(g.state.moveX, 0);
  assert.equal(g.state.sprint, false);
});

test('touch right half: tap jumps, drag looks without jumping', () => {
  const g = createTouchGestures({ lookScale: 0.01 });
  g.start(2, 900, 300, 0, 'right');
  assert.equal(g.end(2, 902, 301, 0.1), 'tap');
  assert.equal(g.consumeEdges().jump, true);
  assert.equal(g.consumeEdges().jump, false, 'edge consumed');
  g.start(3, 900, 300, 1, 'right');
  g.move(3, 960, 280);
  assert.equal(g.end(3, 960, 280, 1.1), 'look');
  assert.equal(g.consumeEdges().jump, false);
  const l = g.consumeLook();
  close(l.dx, 0.6); close(l.dy, -0.2);
  assert.equal(g.consumeLook().dx, 0);
});

test('touch right half: a long press is not a tap', () => {
  const g = createTouchGestures();
  g.start(2, 900, 300, 0, 'right');
  assert.equal(g.end(2, 900, 300, 0.6), 'look');
  assert.equal(g.consumeEdges().jump, false);
});

test('touch right half: double-tap barks, and holding it holds the bark', () => {
  const g = createTouchGestures();
  g.start(1, 900, 300, 0, 'right'); g.end(1, 900, 300, 0.08);
  assert.equal(g.start(2, 905, 302, 0.2, 'right'), 'bark');
  const e = g.consumeEdges();
  assert.equal(e.bark, true);
  assert.equal(g.state.barkHeld, true);
  g.end(2, 905, 302, 0.9);
  assert.equal(g.state.barkHeld, false);
  // Too slow for a double
  g.start(3, 900, 300, 2, 'right'); g.end(3, 900, 300, 2.05);
  assert.equal(g.start(4, 900, 300, 2.6, 'right'), 'look');
});

test('touch: a second left touch while the stick is held looks instead', () => {
  const g = createTouchGestures();
  g.start(1, 100, 500, 0, 'left');
  assert.equal(g.start(2, 150, 300, 0, 'left'), 'look');
});

test('touch: signature button press and release, reset clears all', () => {
  const g = createTouchGestures();
  g.sigDown();
  assert.equal(g.consumeEdges().sig, true);
  assert.equal(g.state.sigHeld, true);
  g.sigUp();
  assert.equal(g.state.sigHeld, false);
  g.start(1, 10, 10, 0, 'left'); g.move(1, 200, 10);
  g.reset();
  assert.equal(g.state.moveX, 0);
  assert.equal(g.activeCount, 0);
});

test('touch controls: without a DOM they are a harmless no-op, paw has no text', () => {
  const c = createTouchControls({ win: {} });
  c.setVisible(true); c.setAuto(true);
  assert.equal(c.active, false);
  assert.ok(PAW_SVG.startsWith('<svg'));
  assert.ok(!/<text/i.test(PAW_SVG));
});
