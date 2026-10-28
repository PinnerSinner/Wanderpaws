import test from 'node:test';
import assert from 'node:assert/strict';
import { createRig, getSkeleton } from '../../src/animals/rig/index.js';
import { SPECIES, SPECIES_ORDER, SIGNATURE_KINDS } from '../../src/animals/species.js';
import { solveTwoBone, mat3FromEuler } from '../../src/animals/rig/math3.js';
import { createChain, stepChain } from '../../src/animals/rig/chain.js';
import { createRng } from '../../src/core/rng.js';

const REP = { oli: 'quadruped', rabbit: 'hopper', penguin: 'waddler', tortoise: 'shelled', snake: 'serpent', octopus: 'tentacle' };

function player(o = {}) {
  return { x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0, speed: 0, speedNorm: 0, size: 1, displaySize: 1, grounded: true, airborne: false,
    inWater: false, waterDepth: 0, sprinting: false, turnRate: 0, landImpact: 0, gulp: 0, stagger: 0,
    sig: { kind: null, active: false, t: 0, cooldownLeft: 0, ready: true, aimYaw: 0, power: 0 }, emotion: 'happy', idleTime: 0, idleAnim: null,
    barkT: 99, playBow: false, shakeT: 0, buffs: { tea: 0, wobble: 0, speed: 0 }, ...o };
}
const run = (rig, p, secs, fn) => { for (let i = 0; i < secs * 60; i++) { if (fn) fn(p, i / 60); rig.update(p, 1 / 60); } return rig.pose; };
const snapshot = (pose) => pose.list.map((x) => [x.px, x.py, x.pz, x.rx, x.ry, x.rz, x.sx, x.sy, x.sz]);
const finite = (pose) => pose.list.every((x) => Object.values(x).every(Number.isFinite));

test('every species gets a rig of its archetype with a valid skeleton', () => {
  for (const id of SPECIES_ORDER) {
    const r = createRig(id);
    assert.equal(r.archetype, SPECIES[id].archetype, id);
    const bones = r.skeleton.bones;
    assert.equal(r.pose.list.length, bones.length);
    bones.forEach((b, i) => { assert.ok(b.parent < i, `${id} ${b.name} parent order`); assert.equal(r.pose.bones[b.name], r.pose.list[i]); });
    assert.equal(new Set(bones.map((b) => b.name)).size, bones.length, `${id} unique names`);
    for (const need of ['root', 'head', 'jaw', 'eyeL', 'eyeR', 'lidL', 'lidR']) assert.ok(r.pose.bones[need], `${id} ${need}`);
  }
});

test('skeletons are cached and shared', () => { assert.equal(getSkeleton('oli'), getSkeleton('oli')); });

for (const [id, arch] of Object.entries(REP)) {
  test(`${arch}: deterministic for the same input`, () => {
    const a = createRig(id), b = createRig(id);
    const drive = (p, t) => { p.speedNorm = 0.5 + 0.5 * Math.sin(t); p.vz = p.speedNorm * 7; p.turnRate = Math.cos(t * 0.7); p.yaw += p.turnRate / 60; };
    run(a, player(), 4, drive); run(b, player(), 4, drive);
    assert.deepEqual(snapshot(a.pose), snapshot(b.pose));
  });

  test(`${arch}: stable over 10k ticks of random input`, () => {
    const r = createRig(id);
    const rng = createRng(99);
    const p = player();
    const idles = [null, 'sniff', 'sit', 'scratch', 'yawn', 'look', 'playbow', 'shake', 'lie', 'species'];
    const emos = ['happy', 'excited', 'scared', 'sleepy', 'proud', 'neutral'];
    let maxRot = 0, maxScale = 0;
    for (let i = 0; i < 10000; i++) {
      if (i % 37 === 0) {
        p.speedNorm = rng.next(); p.vx = rng.range(-12, 12); p.vz = rng.range(-12, 12); p.vy = rng.range(-10, 10);
        p.turnRate = rng.range(-6, 6); p.airborne = rng.chance(0.2); p.grounded = !p.airborne; p.inWater = rng.chance(0.15); p.waterDepth = rng.range(0, 2);
        p.idleAnim = rng.pick(idles); p.emotion = rng.pick(emos); p.landImpact = rng.chance(0.1) ? 1 : 0; p.gulp = rng.chance(0.1) ? 1 : p.gulp;
        p.stagger = rng.chance(0.05) ? 1 : 0; p.playBow = rng.chance(0.05); p.barkT = rng.range(0, 2); p.shakeT = rng.chance(0.05) ? 1 : 0;
        p.sig.active = rng.chance(0.2); p.sig.t = rng.range(0, 3); p.sig.power = rng.next(); p.displaySize = rng.range(0.2, 30); p.yaw = rng.range(-10, 10);
      }
      p.gulp *= 0.96;
      r.update(p, i % 500 === 0 ? 0.2 : rng.range(0.005, 0.05));
      for (const x of r.pose.list) {
        for (const k of ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz']) assert.ok(Number.isFinite(x[k]), `${id} tick ${i} ${k}`);
        maxRot = Math.max(maxRot, Math.abs(x.rx), Math.abs(x.ry), Math.abs(x.rz));
        maxScale = Math.max(maxScale, x.sx, x.sy, x.sz);
      }
    }
    assert.ok(maxRot < 4 * Math.PI, `${id} rotation bounded ${maxRot}`);
    assert.ok(maxScale < 30, `${id} scale bounded ${maxScale}`);
  });
}

test('all 13 rigs stay finite through every idle, emotion and their signature', () => {
  for (const id of SPECIES_ORDER) {
    const r = createRig(id);
    const p = player();
    for (const ia of ['sniff', 'sit', 'scratch', 'yawn', 'look', 'playbow', 'shake', 'lie', 'species']) { p.idleAnim = ia; run(r, p, 1.5); assert.ok(finite(r.pose), `${id} ${ia}`); }
    p.idleAnim = null;
    for (const e of ['excited', 'scared', 'sleepy', 'proud', 'neutral']) { p.emotion = e; run(r, p, 0.5); assert.ok(finite(r.pose), `${id} ${e}`); }
    p.sig.active = true;
    run(r, p, SPECIES[id].signature.duration, (pp, t) => { pp.sig.t = t; });
    assert.ok(finite(r.pose), `${id} sig`);
  }
});

test('every signature kind visibly changes the pose', () => {
  const covered = new Set();
  for (const id of SPECIES_ORDER) {
    const kind = SPECIES[id].signature.kind;
    const still = createRig(id), sig = createRig(id);
    run(still, player(), 1);
    const p = player();
    p.sig.active = true;
    run(sig, p, SPECIES[id].signature.duration * 0.5, (pp, t) => { pp.sig.t = t; });
    run(still, player(), SPECIES[id].signature.duration * 0.5);
    const a = snapshot(still.pose).flat(), b = snapshot(sig.pose).flat();
    let diff = 0; for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
    const fxDiff = Math.abs((sig.pose.fx.glow || 0) - (still.pose.fx.glow || 0));
    assert.ok(diff > 0.3 || fxDiff > 0.3, `${kind} diff ${diff}`);
    covered.add(kind);
  }
  assert.deepEqual([...covered].sort(), [...SIGNATURE_KINDS].sort());
});

test('sitting lowers and tilts the quadruped body', () => {
  const r = createRig('oli');
  run(r, player({ idleAnim: 'sit' }), 3);
  assert.ok(r.pose.bones.body.py < -0.05);
  assert.ok(r.pose.bones.body.rx < -0.3);
});

test('scared tucks the tail, happy lifts it', () => {
  const s = createRig('oli'), h = createRig('oli');
  run(s, player({ emotion: 'scared' }), 3); run(h, player({ emotion: 'excited' }), 3);
  assert.ok(s.pose.bones.tail0.rx < h.pose.bones.tail0.rx - 0.5);
});

test('Oli wags his whole back end', () => {
  const r = createRig('oli');
  let min = 0, max = 0;
  run(r, player({ emotion: 'excited' }), 3, () => { min = Math.min(min, r.pose.bones.hips.ry); max = Math.max(max, r.pose.bones.hips.ry); });
  assert.ok(max - min > 0.3, `hips swing ${max - min}`);
  const c = createRig('capybara');
  let cm = 0; run(c, player({ emotion: 'excited' }), 3, () => { cm = Math.max(cm, Math.abs(c.pose.bones.hips.ry)); });
  assert.ok(cm < (max - min) / 3, 'capybara barely wags');
});

test('the gulp makes a squash and stretch bounce', () => {
  const r = createRig('oli');
  const p = player();
  run(r, p, 1);
  p.gulp = 1;
  let minY = 1, maxY = 1;
  run(r, p, 1, (pp) => { pp.gulp *= 0.95; minY = Math.min(minY, r.pose.bones.root.sy); maxY = Math.max(maxY, r.pose.bones.root.sy); });
  assert.ok(minY < 0.97 && maxY > 1.005, `${minY} ${maxY}`);
  assert.ok(minY > 0.6 && maxY < 1.4);
});

test('landing compresses, airborne stretches', () => {
  const r = createRig('rabbit');
  const p = player({ airborne: true, grounded: false, vy: 6 });
  run(r, p, 0.3);
  assert.ok(r.pose.bones.root.sy > 1.01);
  p.airborne = false; p.grounded = true; p.vy = 0; p.landImpact = 1;
  let min = 2; run(r, p, 0.5, (pp) => { pp.landImpact *= 0.9; min = Math.min(min, r.pose.bones.root.sy); });
  assert.ok(min < 0.97, String(min));
});

test('gait: paws lift in turn while trotting', () => {
  const r = createRig('oli');
  const lifts = { FL: 0, HR: 0 };
  run(r, player({ speedNorm: 0.5, vz: 3.5 }), 2, () => { lifts.FL = Math.max(lifts.FL, -r.pose.bones.legFL.rx); lifts.HR = Math.max(lifts.HR, Math.abs(r.pose.bones.kneeHR.rx)); });
  assert.ok(lifts.FL > 0.1 && lifts.HR > 0.1, JSON.stringify(lifts));
});

test('swimming lowers the body', () => {
  const r = createRig('oli');
  run(r, player({ inWater: true, waterDepth: 2, speedNorm: 0.4, vz: 2.8 }), 3);
  assert.ok(r.pose.bones.body.py < -0.15);
});

test('the snake body keeps its segment spacing', () => {
  const r = createRig('snake');
  run(r, player(), 4, (p, t) => { p.speedNorm = 0.6; p.yaw = Math.sin(t) * 1.5; p.vx = Math.sin(p.yaw) * 4; p.vz = Math.cos(p.yaw) * 4; });
  const sk = r.skeleton, plan = r.plan;
  let total = 0;
  for (let i = 1; i < plan.segs; i++) {
    const a = r.pose.bones[`seg${i - 1}`], b = r.pose.bones[`seg${i}`];
    const ax = sk.bones[sk.index[`seg${i - 1}`]].pos, bx = sk.bones[sk.index[`seg${i}`]].pos;
    const d = Math.hypot(ax[0] + a.px - bx[0] - b.px, ax[2] + a.pz - bx[2] - b.pz);
    assert.ok(d < plan.segLen * 2.2 && d > plan.segLen * 0.3, `seg ${i} ${d}`);
    total += d;
  }
  assert.ok(total > plan.segLen * plan.segs * 0.6);
});

test('octopus has eight bounded arms', () => {
  const r = createRig('octopus');
  assert.equal(Object.keys(r.skeleton.chains).filter((k) => k.startsWith('arm')).length, 8);
  run(r, player({ speedNorm: 1, vz: 7 }), 3);
  for (let k = 0; k < 8; k++) for (let i = 0; i < r.plan.armLinks; i++) assert.ok(Math.abs(r.pose.bones[`arm${k}_${i}`].rx) < 3);
});

test('blink closes the lids now and then', () => {
  const r = createRig('cat');
  let shut = 0, open = 0;
  run(r, player(), 12, () => { if (r.pose.fx.blink > 0.8) shut++; else open++; });
  assert.ok(shut > 0 && open > shut * 5);
});

test('pose objects are preallocated (same objects every frame)', () => {
  const r = createRig('oli');
  const before = r.pose.list.slice(), fx = r.pose.fx;
  run(r, player({ speedNorm: 1, vz: 7 }), 1);
  r.pose.list.forEach((x, i) => assert.equal(x, before[i]));
  assert.equal(r.pose.fx, fx);
});

test('setEmotion overrides the player emotion', () => {
  const r = createRig('oli');
  r.setEmotion('sleepy');
  run(r, player({ emotion: 'excited' }), 2);
  assert.equal(r.core.emotion, 'sleepy');
});

test('two-bone IK reaches reachable targets', () => {
  const out = {};
  for (const [dx, dy, dz] of [[0, -0.3, 0], [0, -0.25, 0.1], [0.05, -0.2, -0.12]]) {
    solveTwoBone(out, dx, dy, dz, 0.17, 0.16, 1);
    // forward kinematics with XYZ order: rz then rx, lower rx about the same plane
    const m = mat3FromEuler(new Float64Array(9), out.upperRx, 0, out.upperRz, 'XYZ');
    // foot in the upper bone's frame: (0, -a, 0) + Rx(lower) (0, -b, 0)
    const ly = -0.17 - 0.16 * Math.cos(out.lowerRx), lz = -0.16 * Math.sin(out.lowerRx);
    const fx = m[1] * ly + m[2] * lz, fy = m[4] * ly + m[5] * lz, fz = m[7] * ly + m[8] * lz;
    assert.ok(Math.hypot(fx - dx, fy - dy, fz - dz) < 0.02, `${dx},${dy},${dz} -> ${fx},${fy},${fz}`);
  }
  solveTwoBone(out, 0, -5, 0, 0.17, 0.16, 1);
  assert.ok(out.reach > 1 && Number.isFinite(out.upperRx));
});

test('spring chains settle to rest and stay bounded under violent input', () => {
  const ch = createChain({ links: 6, stiff: 8, damp: 0.5, inertia: 0.7, rest: [0.5, 0, 0, 0, 0, 0] });
  const d = { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 };
  for (let i = 0; i < 2000; i++) { d.wY = Math.sin(i * 0.9) * 200; d.fP = (i % 7) * 500 - 1500; stepChain(ch, 0.016, d); }
  for (let i = 0; i < 6; i++) assert.ok(Math.abs(ch.p[i]) <= 2.6 && Math.abs(ch.y[i]) <= 2.6);
  d.wY = 0; d.fP = 0;
  for (let i = 0; i < 600; i++) stepChain(ch, 0.016, d);
  assert.ok(Math.abs(ch.p[0] - 0.5) < 0.01 && Math.abs(ch.y[3]) < 0.01);
});

test('rig update copes with a missing or empty player', () => {
  const r = createRig('duck');
  r.update(null, 1 / 60); r.update({}, 0); r.update({ vx: NaN, speedNorm: Infinity }, 1 / 60);
  assert.ok(finite(r.pose));
});
