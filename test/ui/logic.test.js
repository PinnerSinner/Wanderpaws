import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unitPx, bodyPx, menuColumns, viewportInUnits, countUp, countUpDuration, countTicks, easeOutBack,
  formatInt, formatSizeUI, formatClock, milestoneProgress, timerWarmth, mixColour, hexToHsl, hslToHex,
  statBar, createCodeBuffer, createKonamiMatcher, KONAMI, navPick, createActionDeduper, downsampleSize,
  cropRect, simplePalette, resultCardLayout, layoutInside, unlockHintFor, comicBefore, createToastQueue,
  newStars, nextWorldId, springTo, clampScale,
} from '../../src/ui/logic.js';

const SIZES = [[2000, 747], [2560, 1080], [1920, 1080], [1280, 720], [812, 375]];

test('unit matches SPEC §10 table', () => {
  assert.equal(unitPx(2000, 747).toFixed(2), '7.47');
  assert.equal(unitPx(2560, 1080).toFixed(1), '10.8');
  assert.equal(unitPx(1920, 1080).toFixed(2), '10.56');
  assert.equal(unitPx(1280, 720).toFixed(2), '7.04');
  assert.equal(unitPx(812, 375).toFixed(2), '3.75');
  assert.equal(unitPx(300, 200), 3.6, 'floor of 3.6 px');
});

test('unit scales with hud/text scale, clamped to 0.8..1.6', () => {
  assert.equal(unitPx(2000, 747, 2), unitPx(2000, 747) * 1.6);
  assert.equal(unitPx(2000, 747, 0.1), unitPx(2000, 747) * 0.8);
  assert.equal(clampScale('nope'), 1);
});

test('body text: 2.6u with a 14 px floor', () => {
  assert.equal(Math.round(bodyPx(2000, 747)), 19);
  assert.equal(Math.round(bodyPx(2560, 1080)), 28);
  assert.equal(bodyPx(812, 375), 14);
});

test('every target viewport is at least 100u tall and 180u wide (layout budget)', () => {
  for (const [w, h] of SIZES) {
    const v = viewportInUnits(w, h);
    assert.ok(v.tall >= 99.9, `${w}x${h} tall ${v.tall}`);
    assert.ok(v.wide >= 180, `${w}x${h} wide ${v.wide}`);
  }
});

test('menus reflow to one column below 1.3:1', () => {
  assert.equal(menuColumns(1000, 1000), 1);
  assert.equal(menuColumns(1280, 1000), 1);
  assert.equal(menuColumns(1920, 1080), 2);
  assert.equal(menuColumns(2000, 747), 3);
});

test('count-up eases from start to end, monotonic', () => {
  assert.equal(countUp(0, 100, 0, 1), 0);
  assert.equal(countUp(0, 100, 1, 1), 100);
  assert.equal(countUp(0, 100, 5, 1), 100);
  let prev = -1;
  for (let i = 0; i <= 20; i++) { const v = countUp(0, 100, i / 20, 1); assert.ok(v >= prev); prev = v; }
  assert.ok(countUp(0, 100, 0.5, 1) > 50, 'ease-out front-loads');
  assert.equal(countUpDuration(0), 0);
  assert.ok(countUpDuration(10000) <= 1.6 && countUpDuration(1) >= 0.5);
  assert.equal(countTicks(1.2, 4.9), 3);
  assert.ok(easeOutBack(0.7) > 1, 'overshoots');
});

test('spring settles on its target', () => {
  const s = { x: 0, v: 0 };
  for (let i = 0; i < 300; i++) springTo(s, 1, 1 / 60);
  assert.ok(Math.abs(s.x - 1) < 1e-3);
});

test('formatting', () => {
  assert.equal(formatInt(1234567), '1,234,567');
  assert.equal(formatInt(-42), '-42');
  assert.equal(formatSizeUI(0.25), '25 cm');
  assert.equal(formatSizeUI(3.04), '3.0 m');
  assert.equal(formatSizeUI(1234), '1,234 m');
  assert.equal(formatClock(65.9), '1:05');
});

test('milestone progress runs prev -> next in log space, then finishes', () => {
  const g = { start: 0.25, goal: 3, stretch: 4.5, milestones: [0.5, 1, 2] };
  const a = milestoneProgress(0.25, g);
  assert.equal(a.next, 0.5); assert.equal(a.t, 0);
  const b = milestoneProgress(Math.sqrt(0.5), g);
  assert.equal(b.next, 1); assert.ok(Math.abs(b.t - 0.5) < 1e-9);
  const c = milestoneProgress(3.5, g);
  assert.equal(c.next, 4.5);
  assert.equal(milestoneProgress(9, g).done, true);
});

test('timer warmth: none above 30 s, smooth to 1 at zero', () => {
  assert.equal(timerWarmth(null), 0);
  assert.equal(timerWarmth(45), 0);
  assert.equal(timerWarmth(30), 0);
  assert.equal(timerWarmth(0), 1);
  assert.ok(timerWarmth(10) > timerWarmth(20));
  assert.equal(mixColour('#000000', '#ffffff', 0.5), '#808080');
});

test('HSL round trip', () => {
  for (const hex of ['#e8c27a', '#2bb59a', '#ff7a59', '#222222']) {
    const { h, s, l } = hexToHsl(hex);
    const back = hslToHex(h, s, l);
    const d = parseInt(back.slice(1), 16) - parseInt(hex.slice(1), 16);
    assert.ok(Math.abs(d) < 0x030303, `${hex} -> ${back}`);
  }
  assert.ok(statBar(1.6) <= 1 && statBar(0.5) > 0 && statBar(1) > statBar(0.8));
});

test('code buffer: checks the rolling buffer, clears on a hit, dedupes twin sources', () => {
  const seen = [];
  const buf = createCodeBuffer({ check: (b) => { seen.push(b); return b.endsWith('BIGHEAD') ? { code: 'BIGHEAD', modifier: 'bigHead' } : null; } });
  let hit = null;
  let t = 0;
  for (const c of 'xxbighead') { hit = buf.push(c, (t += 200)) || hit; }
  assert.deepEqual(hit, { code: 'BIGHEAD', modifier: 'bigHead' });
  assert.equal(buf.value, '');
  // same key from input.onText and the keyboard fallback in the same instant
  assert.equal(buf.push('O', 1000), null);
  buf.push('O', 1010);
  assert.equal(buf.value, 'O');
  assert.equal(buf.push('!', 2000), null, 'non-alphanumerics ignored');
  const long = createCodeBuffer({ max: 4, check: () => null });
  for (const c of 'ABCDEFG') long.push(c, (t += 100));
  assert.equal(long.value, 'DEFG');
});

test('konami matcher', () => {
  const k = createKonamiMatcher();
  let got = false;
  for (const tok of ['up', ...KONAMI]) got = k.push(tok) || got;
  assert.equal(got, true);
  const k2 = createKonamiMatcher();
  assert.equal(KONAMI.slice(0, -1).map((x) => k2.push(x)).some(Boolean), false);
});

test('spatial nav picks the nearest in a direction', () => {
  const rects = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }, { x: 0, y: 20, w: 10, h: 10 }, { x: 40, y: 30, w: 10, h: 10 }];
  assert.equal(navPick(rects[0], rects, 'right'), 1);
  assert.equal(navPick(rects[0], rects, 'down'), 2);
  assert.equal(navPick(rects[0], rects, 'left'), -1);
  assert.equal(navPick(rects[2], rects, 'up'), 0);
});

test('action deduper drops the twin from the other source only', () => {
  const d = createActionDeduper(70);
  assert.equal(d('down', 'kb', 0), true);
  assert.equal(d('down', 'input', 10), false);
  assert.equal(d('down', 'kb', 20), true, 'key repeat from the same source passes');
  assert.equal(d('down', 'input', 200), true);
});

test('photo helpers', () => {
  assert.deepEqual(downsampleSize(4000, 3000, 96), { w: 96, h: 72 });
  assert.deepEqual(downsampleSize(50, 40, 96), { w: 50, h: 40 });
  const r = cropRect(400, 300, 2, 1000, 0);
  assert.equal(r.side, 150);
  assert.equal(r.x, 250, 'pan clamps inside the image');
  const px = new Uint8Array(16 * 16 * 4);
  for (let i = 0; i < px.length; i += 4) { px[i] = 232; px[i + 1] = 194; px[i + 2] = 122; px[i + 3] = 255; }
  const pal = simplePalette(px, 16, 16);
  assert.equal(pal.base, '#e8c27a');
  for (const k of ['secondary', 'belly', 'tips']) assert.match(pal[k], /^#[0-9a-f]{6}$/);
});

test('result card layout stays inside the card and stacks in order', () => {
  for (const [w, h] of [[1200, 630], [1080, 1080], [1600, 900]]) {
    const L = resultCardLayout(w, h);
    assert.ok(layoutInside(L), `${w}x${h}`);
    assert.ok(L.photo.x + L.photo.w < L.colX, 'photo left of the text column');
  }
});

test('flow helpers', () => {
  assert.equal(unlockHintFor({ unlock: { kind: 'stars', world: 'w1', count: 2 } }).key, 'ui.unlock.stars');
  assert.equal(unlockHintFor({}).key, 'ui.unlock.start');
  assert.equal(comicBefore({ worldId: 'w1', mode: 'story', seen: {} }), 'intro');
  assert.equal(comicBefore({ worldId: 'w1', mode: 'story', seen: { intro: true } }), null);
  assert.equal(comicBefore({ worldId: 'w3', mode: 'story', seen: {} }), 'between-w3');
  assert.equal(comicBefore({ worldId: 'w3', mode: 'chill', seen: {} }), null);
  assert.deepEqual(newStars([true, false, false], [true, true, true]), [1, 2]);
  assert.equal(nextWorldId('w4'), 'w5');
  assert.equal(nextWorldId('w5'), null);
});

test('toast queue shows at most three and expires them', () => {
  const q = createToastQueue({ max: 3, ttl: 2.5 });
  for (let i = 0; i < 5; i++) q.push({ id: i });
  assert.equal(q.tick(0).added.length, 3);
  assert.equal(q.tick(1).added.length, 0);
  const r = q.tick(2.6);
  assert.equal(r.removed.length, 3);
  assert.equal(r.added.length, 2);
});
