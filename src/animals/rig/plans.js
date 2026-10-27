// Body plans: the proportions of every species in "unit" space (size 1, origin
// at the feet, facing +Z, left is +X). The rig uses them for IK and chains,
// the view uses the same skeleton to build meshes, so they never disagree.
//
// Each plan builds a skeleton: a flat list of bones in parent-first order.
//   { name, parent (index or -1), pos: [x,y,z] (rest offset from parent),
//     rot: [rx,ry,rz] (rest rotation, usually zero), order: 'XYZ'|'YXZ' }
// Chains are runs of bones named `${chain}${i}`; `plan.chains` describes them.

const V = (x, y, z) => [x, y, z];

// ---------------------------------------------------------------------------
// Per-species plan data

const QUAD_BASE = {
  archetype: 'quadruped',
  bodyY: 0.39, bodyZ: -0.02,
  hips: V(0, 0, -0.2), chest: V(0, 0.02, 0.18),
  hipJoint: V(0.1, -0.05, -0.02), shoulderJoint: V(0.1, -0.07, 0.03),
  front: { upper: 0.15, lower: 0.14, foot: 0.055, bend: 1 },
  hind: { upper: 0.16, lower: 0.145, foot: 0.055, bend: -1 },
  neck: V(0, 0.1, 0.1), neckDir: 1.0, neckLen: 0.12,
  jaw: V(0, -0.06, 0.08), tongue: V(0, 0.012, 0.05),
  eye: V(0.08, 0.04, 0.128), eyeR: 0.052,
  ear: { anchor: V(0.15, 0.1, -0.035), dir: V(0.3, -1, -0.05), links: 3, len: 0.19, gravity: 0.8, stiff: 6, damp: 0.5, inertia: 0.8, kind: 'floppy' },
  tail: { anchor: V(0, 0.06, -0.17), dir: V(0, 0, -1), links: 6, len: 0.34, rest: [0.3, -0.02, -0.05, -0.04, -0.03, 0.02], gravity: 0.15, stiff: 8, damp: 0.45, inertia: 0.7, thick: [0.065, 0.022] },
  gait: { stride: 0.33, liftF: 0.07, liftH: 0.065, bob: 0.02 },
  headR: 0.18,
};

function quad(o) {
  const p = { ...QUAD_BASE, ...o };
  p.front = { ...QUAD_BASE.front, ...(o.front || {}) };
  p.hind = { ...QUAD_BASE.hind, ...(o.hind || {}) };
  p.ear = { ...QUAD_BASE.ear, ...(o.ear || {}) };
  p.tail = o.tail === null ? null : { ...QUAD_BASE.tail, ...(o.tail || {}) };
  p.gait = { ...QUAD_BASE.gait, ...(o.gait || {}) };
  return p;
}

export const PLANS = {
  oli: quad({}),
  cat: quad({
    bodyY: 0.41,
    hips: V(0, 0.01, -0.2), chest: V(0, 0.0, 0.17),
    hipJoint: V(0.085, -0.05, -0.02), shoulderJoint: V(0.085, -0.06, 0.02),
    front: { upper: 0.17, lower: 0.165, foot: 0.045 },
    hind: { upper: 0.19, lower: 0.17, foot: 0.045 },
    neck: V(0, 0.09, 0.09), neckDir: 1.0, neckLen: 0.13, headR: 0.15,
    eye: V(0.066, 0.03, 0.1), eyeR: 0.047,
    jaw: V(0, -0.05, 0.06),
    ear: { anchor: V(0.085, 0.12, -0.01), dir: V(0.35, 1, 0.05), links: 2, len: 0.1, gravity: 0, stiff: 16, damp: 0.6, inertia: 0.2, kind: 'pointy' },
    tail: { anchor: V(0, 0.06, -0.15), links: 7, len: 0.46, rest: [0.9, 0.25, 0.15, 0.05, -0.1, -0.25, -0.35], gravity: 0.05, stiff: 8, damp: 0.45, inertia: 0.6, thick: [0.035, 0.022] },
    gait: { stride: 0.38, liftF: 0.07, liftH: 0.07, bob: 0.012 },
  }),
  routercat: null, // filled below from cat
  capybara: quad({
    bodyY: 0.38,
    hips: V(0, 0.01, -0.22), chest: V(0, 0.0, 0.18),
    hipJoint: V(0.12, -0.08, -0.02), shoulderJoint: V(0.12, -0.09, 0.03),
    front: { upper: 0.13, lower: 0.12, foot: 0.05 },
    hind: { upper: 0.14, lower: 0.12, foot: 0.05 },
    neck: V(0, 0.07, 0.12), neckDir: 0.55, neckLen: 0.12, headR: 0.15,
    eye: V(0.085, 0.07, 0.07), eyeR: 0.042,
    jaw: V(0, -0.07, 0.12),
    ear: { anchor: V(0.08, 0.12, -0.06), dir: V(0.4, 1, -0.3), links: 2, len: 0.05, gravity: 0, stiff: 14, damp: 0.6, inertia: 0.25, kind: 'round' },
    tail: null,
    gait: { stride: 0.3, liftF: 0.05, liftH: 0.05, bob: 0.01 },
  }),
  redpanda: quad({
    bodyY: 0.37,
    hips: V(0, 0.01, -0.19), chest: V(0, 0.0, 0.17),
    hipJoint: V(0.1, -0.07, -0.02), shoulderJoint: V(0.1, -0.08, 0.03),
    front: { upper: 0.13, lower: 0.13, foot: 0.05 },
    hind: { upper: 0.14, lower: 0.135, foot: 0.05 },
    neck: V(0, 0.08, 0.1), neckDir: 0.85, neckLen: 0.12, headR: 0.16,
    eye: V(0.07, 0.035, 0.12), eyeR: 0.042,
    jaw: V(0, -0.05, 0.08),
    ear: { anchor: V(0.105, 0.12, -0.02), dir: V(0.6, 1, 0), links: 2, len: 0.085, gravity: 0, stiff: 14, damp: 0.6, inertia: 0.25, kind: 'round' },
    tail: { anchor: V(0, 0.05, -0.16), links: 7, len: 0.5, rest: [0.35, 0.1, -0.02, -0.04, -0.04, -0.02, 0.05], gravity: 0.1, stiff: 7, damp: 0.5, inertia: 0.6, thick: [0.08, 0.06] },
    gait: { stride: 0.32, liftF: 0.065, liftH: 0.06, bob: 0.018 },
  }),
  elephant: quad({
    bodyY: 0.5,
    hips: V(0, 0.0, -0.2), chest: V(0, 0.03, 0.16),
    hipJoint: V(0.14, -0.1, -0.02), shoulderJoint: V(0.14, -0.1, 0.02),
    front: { upper: 0.2, lower: 0.18, foot: 0.06 },
    hind: { upper: 0.2, lower: 0.18, foot: 0.06 },
    neck: V(0, 0.08, 0.14), neckDir: 0.45, neckLen: 0.08, headR: 0.2,
    eye: V(0.12, 0.05, 0.11), eyeR: 0.038,
    jaw: V(0, -0.1, 0.08),
    ear: { anchor: V(0.17, 0.08, -0.04), dir: V(0.45, -1, -0.2), links: 3, len: 0.24, gravity: 0.3, stiff: 5, damp: 0.45, inertia: 0.7, kind: 'elephant' },
    tail: { anchor: V(0, 0.05, -0.22), links: 4, len: 0.22, rest: [-0.9, -0.2, -0.1, 0], gravity: 0.4, stiff: 9, damp: 0.5, inertia: 0.7, thick: [0.025, 0.015] },
    trunk: { anchor: V(0, -0.03, 0.17), dir: V(0, -0.15, 1), links: 8, len: 0.5, rest: [0.5, 0.35, 0.25, 0.2, 0.15, 0.1, 0.05, -0.2], gravity: 0.4, stiff: 6, damp: 0.5, inertia: 0.5, thick: [0.075, 0.03] },
    gait: { stride: 0.32, liftF: 0.06, liftH: 0.055, bob: 0.012 },
  }),

  rabbit: {
    archetype: 'hopper',
    bodyY: 0.25,
    hips: V(0, 0.0, -0.13), chest: V(0, 0.04, 0.1),
    hipJoint: V(0.1, -0.02, -0.02), shoulderJoint: V(0.065, -0.06, 0.04),
    front: { upper: 0.08, lower: 0.1, foot: 0.03, bend: 1 },
    hind: { upper: 0.13, lower: 0.13, foot: 0.04, bend: -1, footLen: 0.17 },
    neck: V(0, 0.1, 0.08), neckDir: 1.2, neckLen: 0.06, headR: 0.15,
    jaw: V(0, -0.06, 0.07), tongue: V(0, 0.01, 0.04),
    eye: V(0.085, 0.035, 0.09), eyeR: 0.05,
    ear: { anchor: V(0.05, 0.12, -0.03), dir: V(0.12, 1, -0.1), links: 3, len: 0.3, gravity: 0.15, stiff: 9, damp: 0.5, inertia: 0.6, kind: 'bunny' },
    tail: { anchor: V(0, 0.04, -0.17), dir: V(0, 0.3, -1), links: 1, len: 0.06, rest: [0.6], gravity: 0, stiff: 14, damp: 0.5, inertia: 0.4, thick: [0.07, 0.07] },
    gait: { hop: 0.16, stride: 0.42 },
  },
  frog: {
    archetype: 'hopper',
    bodyY: 0.17,
    hips: V(0, 0.0, -0.12), chest: V(0, 0.03, 0.1),
    hipJoint: V(0.13, -0.02, -0.04), shoulderJoint: V(0.12, -0.05, 0.05),
    front: { upper: 0.065, lower: 0.07, foot: 0.02, bend: 1 },
    hind: { upper: 0.15, lower: 0.15, foot: 0.03, bend: -1, footLen: 0.15 },
    neck: V(0, 0.03, 0.08), neckDir: 0.5, neckLen: 0.03, headR: 0.17,
    jaw: V(0, -0.04, -0.02), tongue: V(0, 0.0, 0.1),
    eye: V(0.095, 0.11, 0.05), eyeR: 0.06,
    ear: null,
    tail: null,
    throat: V(0, -0.07, 0.06),
    gait: { hop: 0.18, stride: 0.5 },
  },

  penguin: {
    archetype: 'waddler',
    bodyY: 0.3, bodyR: 0.23, bodyH: 0.62,
    hipJoint: V(0.09, -0.18, 0.07),
    leg: { upper: 0.06, lower: 0.06, foot: 0.03, bend: 1, footLen: 0.14 },
    wing: { anchor: V(0.215, 0.1, -0.01), dir: V(0.25, -1, 0), links: 2, len: 0.3, kind: 'flipper' },
    neck: { anchor: V(0, 0.28, 0.0), dir: V(0, 1, 0.05), links: 1, len: 0.05 },
    headR: 0.16, headOff: V(0, 0.1, 0.03),
    jaw: V(0, -0.03, 0.12), eye: V(0.07, 0.04, 0.13), eyeR: 0.045,
    tail: { anchor: V(0, -0.2, -0.17), dir: V(0, -0.3, -1), links: 1, len: 0.08, rest: [0.2], gravity: 0, stiff: 12, damp: 0.5, inertia: 0.4, thick: [0.05, 0.02] },
    upright: 1,
    gait: { stride: 0.16, lift: 0.04, roll: 0.16 },
  },
  duck: {
    archetype: 'waddler',
    bodyY: 0.27, bodyR: 0.2, bodyH: 0.34,
    hipJoint: V(0.08, -0.12, -0.02),
    leg: { upper: 0.07, lower: 0.07, foot: 0.03, bend: 1, footLen: 0.1 },
    wing: { anchor: V(0.17, 0.08, 0.0), dir: V(0.15, -0.25, -1), links: 2, len: 0.28, kind: 'wing' },
    neck: { anchor: V(0, 0.1, 0.16), dir: V(0, 1, 0.3), links: 3, len: 0.15 },
    headR: 0.14, headOff: V(0, 0.05, 0.02),
    jaw: V(0, -0.02, 0.1), eye: V(0.07, 0.035, 0.07), eyeR: 0.038,
    tail: { anchor: V(0, 0.06, -0.2), dir: V(0, 0.5, -1), links: 2, len: 0.12, rest: [0.4, 0.3], gravity: 0, stiff: 12, damp: 0.5, inertia: 0.5, thick: [0.07, 0.03] },
    upright: 0,
    gait: { stride: 0.18, lift: 0.045, roll: 0.12 },
  },

  tortoise: {
    archetype: 'shelled',
    bodyY: 0.13, shellR: 0.37, shellH: 0.32,
    legs: { x: 0.21, zF: 0.17, zH: -0.17, y: -0.01, upper: 0.055, lower: 0.05, foot: 0.03 },
    neck: { anchor: V(0, 0.04, 0.3), dir: V(0, 0.45, 1), links: 3, len: 0.18 },
    headR: 0.11, headOff: V(0, 0.01, 0.06),
    jaw: V(0, -0.035, 0.05), eye: V(0.055, 0.03, 0.06), eyeR: 0.03,
    tail: { anchor: V(0, 0.01, -0.33), dir: V(0, -0.3, -1), links: 2, len: 0.09, rest: [0, 0], gravity: 0.1, stiff: 10, damp: 0.5, inertia: 0.5, thick: [0.035, 0.012] },
    gait: { stride: 0.14, lift: 0.05 },
  },

  snake: {
    archetype: 'serpent',
    segs: 28, segLen: 0.055, radius: 0.07, bodyY: 0.065,
    headR: 0.095, headOff: V(0, 0.015, 0.06),
    jaw: V(0, -0.025, 0.02), tongue: V(0, -0.005, 0.11),
    eye: V(0.055, 0.035, 0.05), eyeR: 0.035,
    wave: { amp: 0.09, wavelength: 0.75 },
  },

  octopus: {
    archetype: 'tentacle',
    bodyY: 0.2, mantle: V(0, 0.16, -0.05), mantleR: 0.22, mantleH: 0.36,
    eye: V(0.085, 0.07, 0.14), eyeR: 0.055,
    arms: 8, armLinks: 6, armLen: 0.42, armR: 0.13, armThick: [0.05, 0.012],
    gait: { stride: 0.2 },
  },
};
PLANS.routercat = { ...PLANS.cat, ear: { ...PLANS.cat.ear, links: 2, len: 0.12, kind: 'antenna', stiff: 18 } };

export function getPlan(speciesId) { return PLANS[speciesId] || PLANS.oli; }

// ---------------------------------------------------------------------------
// Skeleton builders

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

function makeSkel() {
  const bones = [];
  const index = {};
  const add = (name, parent, pos, order = 'XYZ', rot = [0, 0, 0]) => {
    const pi = parent == null ? -1 : (typeof parent === 'number' ? parent : index[parent]);
    if (pi === undefined) throw new Error('rig: unknown parent ' + parent);
    index[name] = bones.length;
    bones.push({ name, parent: pi, pos: [pos[0], pos[1], pos[2]], rot: [rot[0], rot[1], rot[2]], order });
    return bones.length - 1;
  };
  return { bones, index, add, chains: {} };
}

// A chain of `links` bones along dir (in the parent frame). Mirror flips x.
function addChain(sk, name, parent, spec, mirror = 1) {
  const d = norm([spec.dir[0] * mirror, spec.dir[1], spec.dir[2]]);
  const seg = spec.len / spec.links;
  const ids = [];
  let prev = parent;
  for (let i = 0; i < spec.links; i++) {
    const pos = i === 0 ? [spec.anchor[0] * mirror, spec.anchor[1], spec.anchor[2]] : [d[0] * seg, d[1] * seg, d[2] * seg];
    prev = sk.add(`${name}${i}`, prev, pos, 'XYZ');
    ids.push(prev);
  }
  // a tip marker (no mesh weight needed but handy for the view)
  sk.add(`${name}Tip`, prev, [d[0] * seg, d[1] * seg, d[2] * seg], 'XYZ');
  sk.chains[name] = { ids, dir: d, seg, spec, mirror };
  return ids;
}

function addLeg(sk, key, parent, joint, leg, mirror) {
  sk.add(`leg${key}`, parent, [joint[0] * mirror, joint[1], joint[2]], 'XYZ');
  sk.add(`knee${key}`, `leg${key}`, [0, -leg.upper, 0], 'XYZ');
  sk.add(`foot${key}`, `knee${key}`, [0, -leg.lower, 0], 'XYZ');
}

function addFace(sk, p, headName) {
  sk.add('jaw', headName, p.jaw, 'XYZ');
  if (p.tongue) sk.add('tongue', 'jaw', p.tongue, 'XYZ');
  for (const [s, m] of [['L', 1], ['R', -1]]) {
    sk.add(`eye${s}`, headName, [p.eye[0] * m, p.eye[1], p.eye[2]], 'YXZ');
    sk.add(`lid${s}`, headName, [p.eye[0] * m, p.eye[1], p.eye[2]], 'XYZ');
  }
}

export function buildSkeleton(plan) {
  const sk = makeSkel();
  const p = plan;
  sk.add('root', null, [0, 0, 0], 'YXZ');
  if (p.archetype === 'quadruped' || p.archetype === 'hopper') {
    sk.add('body', 'root', [0, p.bodyY, p.bodyZ || 0], 'YXZ');
    sk.add('hips', 'body', p.hips, 'YXZ');
    sk.add('chest', 'body', p.chest, 'YXZ');
    addLeg(sk, 'HL', 'hips', p.hipJoint, p.hind, 1);
    addLeg(sk, 'HR', 'hips', p.hipJoint, p.hind, -1);
    addLeg(sk, 'FL', 'chest', p.shoulderJoint, p.front, 1);
    addLeg(sk, 'FR', 'chest', p.shoulderJoint, p.front, -1);
    if (p.tail) addChain(sk, 'tail', 'hips', p.tail);
    sk.add('neck', 'chest', p.neck, 'YXZ');
    sk.add('head', 'neck', [0, Math.sin(p.neckDir) * p.neckLen, Math.cos(p.neckDir) * p.neckLen], 'YXZ');
    addFace(sk, p, 'head');
    if (p.ear) { addChain(sk, 'earL', 'head', p.ear, 1); addChain(sk, 'earR', 'head', p.ear, -1); }
    if (p.trunk) addChain(sk, 'trunk', 'head', p.trunk);
    if (p.throat) sk.add('throat', 'head', p.throat, 'XYZ');
  } else if (p.archetype === 'waddler') {
    sk.add('body', 'root', [0, p.bodyY, 0], 'YXZ');
    addLeg(sk, 'L', 'body', p.hipJoint, p.leg, 1);
    addLeg(sk, 'R', 'body', p.hipJoint, p.leg, -1);
    addChain(sk, 'wingL', 'body', p.wing, 1);
    addChain(sk, 'wingR', 'body', p.wing, -1);
    if (p.tail) addChain(sk, 'tail', 'body', p.tail);
    const neckIds = addChain(sk, 'neck', 'body', p.neck);
    sk.add('head', `neckTip`, p.headOff, 'YXZ');
    void neckIds;
    addFace(sk, p, 'head');
  } else if (p.archetype === 'shelled') {
    sk.add('body', 'root', [0, p.bodyY, 0], 'YXZ');
    const L = p.legs;
    const legSpec = { upper: L.upper, lower: L.lower };
    addLeg(sk, 'FL', 'body', [L.x, L.y, L.zF], legSpec, 1);
    addLeg(sk, 'FR', 'body', [L.x, L.y, L.zF], legSpec, -1);
    addLeg(sk, 'HL', 'body', [L.x, L.y, L.zH], legSpec, 1);
    addLeg(sk, 'HR', 'body', [L.x, L.y, L.zH], legSpec, -1);
    addChain(sk, 'neck', 'body', p.neck);
    sk.add('head', 'neckTip', p.headOff, 'YXZ');
    addFace(sk, p, 'head');
    if (p.tail) addChain(sk, 'tail', 'body', p.tail);
  } else if (p.archetype === 'serpent') {
    for (let i = 0; i < p.segs; i++) sk.add(`seg${i}`, 'root', [0, p.bodyY, -i * p.segLen], 'YXZ');
    sk.add('head', 'seg0', p.headOff, 'YXZ');
    addFace(sk, p, 'head');
  } else if (p.archetype === 'tentacle') {
    sk.add('body', 'root', [0, p.bodyY, 0], 'YXZ');
    sk.add('mantle', 'body', p.mantle, 'YXZ');
    sk.add('head', 'body', [0, 0, 0], 'YXZ');
    sk.add('jaw', 'head', [0, -0.03, 0.17], 'XYZ');
    for (const [s, m] of [['L', 1], ['R', -1]]) {
      sk.add(`eye${s}`, 'head', [p.eye[0] * m, p.eye[1], p.eye[2]], 'YXZ');
      sk.add(`lid${s}`, 'head', [p.eye[0] * m, p.eye[1], p.eye[2]], 'XYZ');
    }
    const seg = p.armLen / p.armLinks;
    for (let k = 0; k < p.arms; k++) {
      const th = ((k + 0.5) / p.arms) * Math.PI * 2;
      const ax = Math.sin(th) * p.armR, az = Math.cos(th) * p.armR;
      // base bone yawed to point outward, links run along its local +Z
      sk.add(`arm${k}Base`, 'body', [ax, -0.06, az], 'YXZ', [0, th, 0]);
      const ids = [];
      let prev = `arm${k}Base`;
      for (let i = 0; i < p.armLinks; i++) {
        prev = sk.bones[sk.add(`arm${k}_${i}`, prev, [0, 0, i === 0 ? 0 : seg], 'XYZ')].name;
        ids.push(sk.index[prev]);
      }
      sk.add(`arm${k}Tip`, prev, [0, 0, seg], 'XYZ');
      sk.chains[`arm${k}`] = { ids, dir: [0, 0, 1], seg, spec: { links: p.armLinks, len: p.armLen }, mirror: 1, theta: th };
    }
  }
  // world rest positions (rest rotations compose too, needed for octopus arms)
  computeRestWorld(sk);
  return sk;
}

import { mat3FromEuler, mat3Mul, mat3Apply } from './math3.js';

function computeRestWorld(sk) {
  const n = sk.bones.length;
  sk.restWorld = new Float64Array(n * 3);
  const rots = [];
  const tmp = new Float64Array(9);
  for (let i = 0; i < n; i++) {
    const b = sk.bones[i];
    const local = mat3FromEuler(new Float64Array(9), b.rot[0], b.rot[1], b.rot[2], b.order);
    const v = [b.pos[0], b.pos[1], b.pos[2]];
    if (b.parent >= 0) {
      mat3Apply(rots[b.parent], v);
      sk.restWorld[i * 3] = sk.restWorld[b.parent * 3] + v[0];
      sk.restWorld[i * 3 + 1] = sk.restWorld[b.parent * 3 + 1] + v[1];
      sk.restWorld[i * 3 + 2] = sk.restWorld[b.parent * 3 + 2] + v[2];
      rots[i] = mat3Mul(new Float64Array(9), rots[b.parent], local);
    } else {
      sk.restWorld[i * 3] = v[0]; sk.restWorld[i * 3 + 1] = v[1]; sk.restWorld[i * 3 + 2] = v[2];
      rots[i] = local;
    }
  }
  void tmp;
  sk.restRot = rots;
}
