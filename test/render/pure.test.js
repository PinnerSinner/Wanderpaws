// Node-safe tests for the render helpers (no WebGL, no DOM).
import test from 'node:test';
import assert from 'node:assert/strict';

import { TIERS, resolveTier, pickTier, createBenchmark, dprFor, frameStats } from '../../src/render/pure/quality.js';
import { createCameraRig, createCameraInput, armDistance, pullEnvelope, armClearance, CAM } from '../../src/render/pure/cameraRig.js';
import { createLayout, addLabel, addAvoid, resolveLayout, clearLayout, edgeFade, defaultTtl } from '../../src/render/pure/textLayout.js';
import { createRingPool, createEmitter } from '../../src/render/pure/pool.js';
import { sampleGhost, decodeSample, ghostLength, isGhost, ghostIndexForTick } from '../../src/render/pure/ghost.js';
import { interpEntity, interpItem, gobblePath, gobbleScale, wobble, lerpAngle, shimmerPulse } from '../../src/render/pure/interp.js';
import { sunState, timeOfDayAt, MIN_LIGHT_ELEVATION } from '../../src/render/pure/sun.js';
import { cueColours, CB_MODES, shapeIndex } from '../../src/render/pure/colourBlind.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------- quality
test('quality: tiers have rising particle caps and the spec caps', () => {
  assert.equal(TIERS.low.particles, 300);
  assert.equal(TIERS.medium.particles, 1000);
  assert.equal(TIERS.high.particles, 2500);
  assert.equal(TIERS.low.shadows, false);
  assert.equal(TIERS.medium.shadows, true);
  assert.equal(TIERS.high.godRays, true);
  assert.equal(TIERS.medium.godRays, false);
  assert.equal(TIERS.low.bloom, false);
});

test('quality: resolveTier honours explicit settings and falls back', () => {
  assert.equal(resolveTier('high', 'low'), 'high');
  assert.equal(resolveTier('auto', 'low'), 'low');
  assert.equal(resolveTier('auto', 'nonsense'), 'medium');
  assert.equal(resolveTier(undefined, undefined), 'medium');
});

test('quality: pickTier maps frame times to tiers', () => {
  const fill = (ms, n = 100) => { const a = new Float32Array(n); a.fill(ms); return a; };
  assert.equal(pickTier(fill(6), 100, 'medium'), 'high');
  assert.equal(pickTier(fill(14), 100, 'medium'), 'medium');
  assert.equal(pickTier(fill(40), 100, 'medium'), 'low');
  // measured on low: 8 ms on low means medium is roughly 15 ms
  assert.equal(pickTier(fill(8), 100, 'low'), 'medium');
  assert.equal(pickTier(new Float32Array(0), 0, 'medium'), 'medium');
});

test('quality: a few slow outlier frames do not drop the tier', () => {
  const a = new Float32Array(100).fill(8);
  for (let i = 0; i < 5; i++) a[i] = 60;
  assert.equal(pickTier(a, 100, 'medium'), 'high');
});

test('quality: benchmark skips warm-up and finishes after its duration', () => {
  const b = createBenchmark({ duration: 2, skip: 0.5 });
  let frames = 0;
  while (!b.push(1 / 60, 'medium')) frames++;
  assert.ok(frames >= 145 && frames <= 152, `frames ${frames}`);
  assert.ok(b.samples > 100 && b.samples < 125);
  assert.equal(b.result, 'medium'); // 16.7 ms on medium
});

test('quality: dpr is capped per tier and never below 1', () => {
  assert.equal(dprFor('low', 3), 1);
  assert.equal(dprFor('medium', 3), 1.5);
  assert.equal(dprFor('high', 3), 2);
  assert.equal(dprFor('high', 0.5), 1);
});

test('quality: frameStats', () => {
  const s = frameStats(new Float32Array([10, 20, 30, 40]), 4);
  assert.equal(s.mean, 25);
  assert.equal(s.median, 20);
  assert.equal(s.fps, 40);
});

// ---------------------------------------------------------------- camera
function runRig(rig, inp, seconds, dt = 1 / 60, each) {
  for (let t = 0; t < seconds; t += dt) { inp.time += dt; if (each) each(inp, t); rig.update(inp, dt); }
}

test('camera: arm length grows with size', () => {
  assert.ok(armDistance(0.25) < armDistance(1));
  assert.ok(armDistance(1) < armDistance(10));
  assert.ok(armDistance(300) > 1000);
});

test('camera: settles behind the player at the arm distance', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1; inp.yaw = 0;
  runRig(rig, inp, 4);
  // behind = -z for yaw 0
  assert.ok(rig.pos.z < -2, `z ${rig.pos.z}`);
  assert.ok(near(rig.pos.x, 0, 0.05));
  const d = Math.hypot(rig.pos.x - rig.look.x, rig.pos.y - rig.look.y, rig.pos.z - rig.look.z);
  assert.ok(Math.abs(d - armDistance(1)) < 0.15, `dist ${d}`);
});

test('camera: spring follow is smooth (no overshoot on a step)', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1; inp.reducedMotion = true;
  runRig(rig, inp, 1);
  inp.x = 5; // step
  let maxX = -Infinity;
  runRig(rig, inp, 3, 1 / 60, () => { maxX = Math.max(maxX, rig.look.x); });
  assert.ok(maxX <= 5.02, `overshoot ${maxX}`);
  assert.ok(rig.look.x > 4.9, `settled ${rig.look.x}`);
});

test('camera: look-ahead leads on velocity and is clamped by size', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1; inp.reducedMotion = true; inp.vz = 100; inp.speedNorm = 1;
  runRig(rig, inp, 3);
  assert.ok(rig.lookAheadZ > 1.5 && rig.lookAheadZ <= 2.2 + 1e-6, `ahead ${rig.lookAheadZ}`);
});

test('camera: FOV kicks on sprint, but not with reduced motion', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1; inp.sprinting = true; inp.speedNorm = 1;
  runRig(rig, inp, 3);
  assert.ok(rig.fov > CAM.baseFov + 5, `fov ${rig.fov}`);
  const rig2 = createCameraRig(), inp2 = createCameraInput();
  inp2.size = 1; inp2.sprinting = true; inp2.speedNorm = 1; inp2.reducedMotion = true;
  runRig(rig2, inp2, 3);
  assert.ok(near(rig2.fov, CAM.baseFov, 0.01));
});

test('camera: reduced motion zeroes sway, shake and the milestone pull-back', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1; inp.reducedMotion = true;
  runRig(rig, inp, 2);
  rig.shake(1); rig.milestone();
  let maxRoll = 0, maxPull = 0;
  runRig(rig, inp, 2, 1 / 60, () => { maxRoll = Math.max(maxRoll, Math.abs(rig.roll)); maxPull = Math.max(maxPull, rig.pull); });
  assert.equal(maxRoll, 0);
  assert.equal(maxPull, 0);
  assert.ok(near(rig.look.x, 0, 1e-6));
});

test('camera: milestone pull-back eases out and returns', () => {
  assert.equal(pullEnvelope(-1), 0);
  assert.ok(pullEnvelope(0.4) > 0.5);
  assert.equal(pullEnvelope(1.0), 1);
  assert.equal(pullEnvelope(10), 0);
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1;
  runRig(rig, inp, 2);
  const d0 = rig.dist;
  rig.milestone();
  let maxD = 0;
  runRig(rig, inp, 1.6, 1 / 60, () => { maxD = Math.max(maxD, rig.dist); });
  assert.ok(maxD > d0 * 1.3, `pull ${maxD} vs ${d0}`);
  runRig(rig, inp, 5);
  assert.ok(Math.abs(rig.dist - d0) < 0.05);
});

test('camera: handheld sway stays tiny (about 0.15 degrees)', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1;
  let maxAng = 0;
  runRig(rig, inp, 6, 1 / 60, () => {
    const off = Math.hypot(rig.look.x, rig.look.z);
    maxAng = Math.max(maxAng, Math.atan2(off, rig.dist) * 180 / Math.PI);
  });
  assert.ok(maxAng < 0.4, `sway ${maxAng} deg`);
  assert.ok(maxAng > 0.01);
});

test('camera: orbit input turns the yaw and clamps pitch', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1;
  runRig(rig, inp, 0.5);
  inp.lookDx = 0.5; inp.lookDy = 5;
  rig.update(inp, 1 / 60);
  assert.ok(near(rig.yaw, -0.5, 1e-9));
  assert.ok(rig.pitch <= CAM.maxPitch + 1e-9);
  assert.equal(inp.lookDx, 0); // consumed
});

test('camera: auto-recentres behind movement after idle', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1; inp.reducedMotion = true;
  runRig(rig, inp, 0.5);
  inp.vx = 3; inp.vz = 0; inp.speedNorm = 0.8; // heading +x = yaw PI/2
  runRig(rig, inp, 8);
  assert.ok(Math.abs(rig.yaw - Math.PI / 2) < 0.15, `yaw ${rig.yaw}`);
});

test('camera: does not swing round when running straight at it', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1; inp.reducedMotion = true;
  runRig(rig, inp, 0.5);
  inp.vz = -3; inp.speedNorm = 0.8; // heading PI, camera yaw 0
  runRig(rig, inp, 6);
  assert.ok(Math.abs(rig.yaw) < 0.05, `yaw ${rig.yaw}`);
});

test('camera: pushes in against a terrain wall and stays above ground', () => {
  const wall = (x, z) => (z < -2 ? 20 : 0);
  assert.ok(armClearance(wall, 0, 1, 0, 0, 2, -6, 0.1) < 0.4);
  assert.equal(armClearance(null, 0, 1, 0, 0, 2, -6, 0.1), 1);
  const rig = createCameraRig(), inp = createCameraInput();
  inp.size = 1; inp.heightAt = wall; inp.reducedMotion = true;
  runRig(rig, inp, 3);
  assert.ok(rig.pos.z > -2.3, `cam z ${rig.pos.z}`);
  const hill = (x, z) => 3 + z * -0.8;
  const rig2 = createCameraRig(), inp2 = createCameraInput();
  inp2.size = 1; inp2.heightAt = hill; inp2.y = hill(0, 0);
  runRig(rig2, inp2, 3);
  assert.ok(rig2.pos.y >= hill(rig2.pos.x, rig2.pos.z) + 0.2, 'above ground');
});

test('camera: no allocations per update (smoke: stable object identity)', () => {
  const rig = createCameraRig(), inp = createCameraInput();
  const p = rig.pos, l = rig.look;
  runRig(rig, inp, 1);
  assert.equal(rig.pos, p);
  assert.equal(rig.look, l);
});

// ---------------------------------------------------------------- text layout
const SAFE = { l: 0, t: 0, r: 1000, b: 600 };

test('layout: a lone label keeps its spot', () => {
  const L = createLayout();
  addLabel(L, 500, 300, 100, 20, 1);
  resolveLayout(L, SAFE);
  assert.equal(L.ox[0], 500);
  assert.equal(L.oy[0], 300);
});

test('layout: overlapping labels stack without overlapping', () => {
  const L = createLayout();
  for (let i = 0; i < 4; i++) addLabel(L, 500 + i * 10, 300, 120, 20, 4 - i);
  resolveLayout(L, SAFE, 4);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const ov = L.ox[i] - 60 < L.ox[j] + 60 && L.ox[i] + 60 > L.ox[j] - 60 && L.oy[i] - 20 < L.oy[j] && L.oy[i] > L.oy[j] - 20;
    assert.ok(!ov, `labels ${i} and ${j} overlap`);
  }
  // highest priority keeps its place
  assert.equal(L.oy[0], 300);
});

test('layout: labels avoid the player rectangle', () => {
  const L = createLayout();
  addAvoid(L, 450, 250, 550, 350);
  addLabel(L, 500, 320, 80, 20, 1);
  resolveLayout(L, SAFE, 4);
  assert.ok(L.oy[0] <= 250 - 4 + 1e-3, `y ${L.oy[0]}`);
});

test('layout: goes below when there is no room above', () => {
  const L = createLayout();
  addAvoid(L, 400, 0, 600, 100);
  addLabel(L, 500, 60, 80, 20, 1);
  resolveLayout(L, SAFE, 4);
  assert.ok(L.oy[0] - 20 >= 100, `y ${L.oy[0]}`);
});

test('layout: clamps into the safe area', () => {
  const L = createLayout();
  addLabel(L, -50, -50, 100, 20, 1);
  addLabel(L, 2000, 2000, 100, 20, 1);
  resolveLayout(L, { l: 10, t: 10, r: 990, b: 590 });
  assert.equal(L.ox[0], 60); assert.equal(L.oy[0], 30);
  assert.equal(L.ox[1], 940); assert.equal(L.oy[1], 590);
});

test('layout: clear resets and edgeFade fades near the edges', () => {
  const L = createLayout();
  addLabel(L, 1, 1, 1, 1, 1); addAvoid(L, 0, 0, 1, 1);
  clearLayout(L);
  assert.equal(L.n, 0); assert.equal(L.avoidN, 0);
  assert.equal(edgeFade(500, 300, 100, 20, SAFE, 40), 1);
  assert.ok(edgeFade(55, 300, 100, 20, SAFE, 40) < 0.5);
});

test('layout: ttl grows with text length and stays bounded', () => {
  assert.ok(defaultTtl('Hi', 'chatter') < defaultTtl('A much longer line of chatter here', 'chatter'));
  assert.ok(defaultTtl('x'.repeat(500), 'chatter') <= 6.5);
});

// ---------------------------------------------------------------- pool
test('pool: allocates round-robin and recycles the oldest', () => {
  const p = createRingPool(10, 4);
  const idx = [];
  for (let i = 0; i < 6; i++) idx.push(p.alloc(0, 5));
  assert.deepEqual(idx, [0, 1, 2, 3, 0, 1]);
  assert.equal(p.recycled, 2);
  assert.equal(p.alive(1), 4);
  assert.equal(p.spawned, 6);
});

test('pool: expired slots stop counting as alive', () => {
  const p = createRingPool(8);
  p.alloc(0, 1); p.alloc(0, 3);
  assert.equal(p.alive(0.5), 2);
  assert.equal(p.alive(2), 1);
  assert.equal(p.alive(4), 0);
});

test('pool: setCap trims the active range for a lower tier', () => {
  const p = createRingPool(2500, 2500);
  for (let i = 0; i < 2000; i++) p.alloc(0, 10);
  p.setCap(300, 1);
  assert.equal(p.cap, 300);
  assert.ok(p.alive(1) <= 300);
  const i = p.alloc(1, 1);
  assert.ok(i < 300);
});

test('pool: dirty range tracks spawns for partial uploads', () => {
  const p = createRingPool(100);
  const out = [0, 0];
  p.takeDirty(out);
  p.alloc(0, 1); p.alloc(0, 1); p.alloc(0, 1);
  assert.equal(p.takeDirty(out), true);
  assert.deepEqual(out, [0, 2]);
  assert.equal(p.takeDirty(out), false);
});

test('pool: emitter spawns whole particles without drift', () => {
  const e = createEmitter();
  let n = 0;
  for (let i = 0; i < 600; i++) n += e.take(30, 1 / 60);
  assert.ok(n === 299 || n === 300, `n ${n}`);
});

// ---------------------------------------------------------------- ghost
function makeGhost(n) {
  const a = new Int32Array(n * 5);
  for (let i = 0; i < n; i++) { a[i * 5] = i * 10; a[i * 5 + 1] = 0; a[i * 5 + 2] = -i * 20; a[i * 5 + 3] = 1000; a[i * 5 + 4] = 250 + i; }
  return a;
}

test('ghost: decodes cm, mrad and mm', () => {
  const g = makeGhost(3);
  const o = {};
  decodeSample(g, 2, o);
  assert.ok(near(o.x, 0.2)); assert.ok(near(o.z, -0.4)); assert.ok(near(o.yaw, 1)); assert.ok(near(o.size, 0.252));
  assert.equal(ghostLength(g), 3);
  assert.equal(isGhost(null), false);
  assert.equal(isGhost([1, 2, 3]), false);
  assert.equal(isGhost(g), true);
});

test('ghost: interpolates between samples by tick', () => {
  const g = makeGhost(10);
  const o = {};
  assert.equal(ghostIndexForTick(2), 0);
  sampleGhost(g, 2, o); assert.ok(near(o.x, 0));
  sampleGhost(g, 3, o); assert.ok(near(o.x, 0.05)); // halfway between sample 0 and 1
  sampleGhost(g, 6, o); assert.ok(near(o.x, 0.2));
  assert.ok(o.speed > 0);
  sampleGhost(g, 1000, o); assert.ok(near(o.x, 0.9)); assert.equal(o.done, true);
  sampleGhost(g, 0, o); assert.ok(near(o.x, 0)); assert.equal(o.done, false);
});

test('ghost: yaw interpolates the short way round', () => {
  const g = new Int32Array([0, 0, 0, 3100, 250, 0, 0, 0, -3100, 250]);
  const o = {};
  sampleGhost(g, 3, o);
  assert.ok(Math.abs(Math.abs(o.yaw) - Math.PI) < 0.05, `yaw ${o.yaw}`);
});

test('ghost: empty input is safe', () => {
  const o = {};
  sampleGhost(new Int32Array(0), 10, o);
  assert.equal(o.done, true);
});

// ---------------------------------------------------------------- interpolation
test('interp: entities and items lerp from previous to current', () => {
  const o = {};
  interpEntity({ x: 10, y: 2, z: -4, px: 0, py: 0, pz: 0, yaw: 0.2, pyaw: 0 }, 0.5, o);
  assert.ok(near(o.x, 5)); assert.ok(near(o.y, 1)); assert.ok(near(o.z, -2)); assert.ok(near(o.yaw, 0.1));
  const items = { x: new Float32Array([4]), y: new Float32Array([0]), z: new Float32Array([2]), px: new Float32Array([0]), py: new Float32Array([0]), pz: new Float32Array([0]) };
  interpItem(items, 0, 0.25, o);
  assert.ok(near(o.x, 1)); assert.ok(near(o.z, 0.5));
  assert.ok(near(lerpAngle(3, -3, 0.5), Math.PI, 0.3) || near(lerpAngle(3, -3, 0.5), -Math.PI, 0.3));
});

test('interp: the gobble path starts at the item, ends in the mouth and arcs up', () => {
  const o = {};
  gobblePath(0, 0, 0, 0, 2, 0.5, 0, 1, 0.5, o);
  assert.ok(near(o.x, 0) && near(o.y, 0) && near(o.z, 0));
  gobblePath(1, 0, 0, 0, 2, 0.5, 0, 1, 0.5, o);
  assert.ok(near(o.x, 2) && near(o.y, 0.5) && near(o.z, 0));
  gobblePath(0.5, 0, 0, 0, 2, 0.5, 0, 1, 0.5, o);
  assert.ok(o.y > 0.5, 'arcs above both ends');
  assert.ok(Math.abs(o.z) > 0.01, 'swerves sideways');
});

test('interp: gobble scale swells then squishes to nothing', () => {
  const o = {};
  gobbleScale(0, o); assert.ok(near(o.s, 1));
  gobbleScale(0.15, o); assert.ok(o.s > 1.1);
  gobbleScale(1, o); assert.ok(near(o.s, 0));
});

test('interp: wobble decays and the shimmer never flashes', () => {
  assert.ok(Math.abs(wobble(3)) < 0.001);
  assert.equal(wobble(-1), 0);
  // shimmer: a slow sine, under 3 cycles per second, and never drops to zero
  let min = 1, crossings = 0, prev = shimmerPulse(0) - 0.6;
  for (let t = 0; t < 1; t += 0.001) {
    const v = shimmerPulse(t); min = Math.min(min, v);
    const c = v - 0.6; if ((c > 0) !== (prev > 0)) crossings++; prev = c;
  }
  assert.ok(min >= 0.2);
  assert.ok(crossings / 2 < 3);
});

// ---------------------------------------------------------------- sun
test('sun: rises in the morning, peaks at noon, sets in the evening', () => {
  const a = sunState(0.25), b = sunState(0.5), c = sunState(0.75);
  assert.ok(Math.abs(a.y) < 0.05);
  assert.ok(b.y > 0.85);
  assert.ok(Math.abs(c.y) < 0.05);
  assert.ok(a.x < 0 && c.x > 0, 'east to west');
  assert.ok(b.warmth < 0.05 && c.warmth > 0.5);
});

test('sun: night has moonlight and stars, and light never drops below the floor', () => {
  const n = sunState(0.98);
  assert.equal(n.moon, true);
  assert.ok(n.night > 0.9);
  for (let t = 0; t < 1; t += 0.01) {
    const s = sunState(t);
    assert.ok(s.ly >= Math.sin(MIN_LIGHT_ELEVATION) - 1e-6);
    assert.ok(near(Math.hypot(s.lx, s.ly, s.lz), 1, 1e-6));
  }
});

test('sun: time of day moves across the run', () => {
  assert.ok(near(timeOfDayAt({ start: 0.3, end: 0.4 }, 0), 0.3));
  assert.ok(near(timeOfDayAt({ start: 0.3, end: 0.4 }, 1), 0.4));
  assert.ok(near(timeOfDayAt({ start: 0.3, end: 0.4 }, 2), 0.4));
  assert.ok(near(timeOfDayAt(null, 0.5), 0.45));
});

// ---------------------------------------------------------------- colour-blind
test('colour-blind: every mode has distinct almost and gobble cues', () => {
  for (const m of CB_MODES) {
    const c = cueColours(m);
    assert.match(c.almost, /^#[0-9a-f]{6}$/);
    assert.notEqual(c.almost, c.iconGood);
  }
  assert.equal(cueColours('bogus'), cueColours('none'));
  assert.notEqual(cueColours('tritanopia').almost, cueColours('none').almost);
  assert.equal(shapeIndex('star'), 3);
  assert.equal(shapeIndex('blob'), 0);
});
