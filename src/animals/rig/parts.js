// Building blocks shared by the archetype solvers: leg IK, the face (eyes,
// lids, jaw, tongue) and writing spring chains into the pose.

import { clamp, clamp01 } from '../../core/math.js';
import { solveTwoBone } from './math3.js';
import { toFrame } from './pose.js';
import { stepChain } from './chain.js';

const V = [0, 0, 0];
const IK = { upperRx: 0, upperRz: 0, lowerRx: 0, reach: 0 };

// Plant leg `key` (bones leg<key>, knee<key>, foot<key>) on root-space target
// (tx, ty, tz). parentFrame is the leg's parent bone frame in root space,
// joint the leg bone's rest offset in that frame. footPitch is the world
// pitch the paw should end up with (0 = flat), plus `flex` extra curl.
export function solveLeg(pose, key, parentFrame, joint, leg, tx, ty, tz, parentPitch, flex) {
  toFrame(parentFrame, tx, ty, tz, V);
  const dx = V[0] - joint[0], dy = V[1] - joint[1], dz = V[2] - joint[2];
  solveTwoBone(IK, dx, dy, dz, leg.upper, leg.lower, leg.bend || 1);
  const L = pose.bones[`leg${key}`], K = pose.bones[`knee${key}`], F = pose.bones[`foot${key}`];
  L.rx = IK.upperRx; L.rz = IK.upperRz;
  K.rx = IK.lowerRx;
  // keep the paw level in world, then add the flex (positive tips the toe down/back)
  F.rx = -(parentPitch + IK.upperRx + IK.lowerRx) + (flex || 0);
  F.rz = -IK.upperRz * 0.8;
  return IK.reach;
}

// Face: eyes look, lids blink, jaw, tongue. Works for every archetype that has
// eyeL/eyeR/lidL/lidR/jaw (and optionally tongue) bones.
export function applyFace(core, pose, opt = {}) {
  const c = core.c, emo = core.emo, b = pose.bones;
  const close = clamp01(Math.max(core.blink, c.eyeClose + (1 - Math.min(1, emo.eyeOpen)) * 0.8));
  const open = opt.lidOpen ?? -1.25, shut = opt.lidShut ?? 1.35;
  const lidRx = open + (shut - open) * close;
  if (b.lidL) { b.lidL.rx = lidRx; b.lidR.rx = lidRx; }
  const lx = clamp(core.lookX + c.aim * 0.0, -0.8, 0.8) * (opt.lookScale ?? 0.45);
  const ly = core.lookY * (opt.lookScale ?? 0.45);
  if (b.eyeL) {
    b.eyeL.ry = lx; b.eyeR.ry = lx; b.eyeL.rx = -ly; b.eyeR.rx = -ly;
    const wide = emo.eyeOpen > 1 ? emo.eyeOpen : 1;
    const sq = 1 - c.squint * 0.25;
    b.eyeL.sx = b.eyeL.sy = b.eyeL.sz = wide * sq; b.eyeR.sx = b.eyeR.sy = b.eyeR.sz = wide * sq;
  }
  const jaw = clamp(c.jaw, 0, 1.3);
  const pantWobble = c.pant > 0.05 ? Math.sin(core.t * 13) * 0.06 * c.pant : 0;
  if (b.jaw) b.jaw.rx = jaw * (opt.jawMax ?? 0.5) + pantWobble;
  if (b.tongue) {
    const tg = clamp(c.tongue, 0, 3);
    const out = Math.min(tg, 1) * (jaw > 0.12 ? 1 : 0.0);
    const t = b.tongue;
    t.pz = out * (opt.tongueOut ?? 0.03) + Math.max(0, tg - 1) * (opt.tongueFar ?? 0);
    t.sz = 0.4 + out * 0.8 + Math.max(0, tg - 1) * (opt.tongueStretch ?? 0);
    t.sx = t.sy = 0.4 + out * 0.6;
    t.rx = out * 0.35 + (c.pant > 0.05 ? Math.sin(core.t * 13 + 1) * 0.15 * c.pant : 0);
    pose.fx.tongue = tg;
  }
  pose.fx.blink = close;
  pose.fx.eyeScale = emo.eyeOpen;
}

// Step a chain and write it into the pose. axes: [pitchKey, yawKey, yawSign].
export function chainToPose(pose, skel, name, ch, dt, drive, pitchKey, yawKey, yawSign) {
  stepChain(ch, dt, drive);
  const info = skel.chains[name];
  if (!info) return;
  const ys = yawSign * (info.mirror || 1);
  for (let i = 0; i < ch.n; i++) {
    const x = pose.list[info.ids[i]];
    x[pitchKey] += ch.p[i];
    x[yawKey] += ch.y[i] * ys;
  }
}

export function clearChainTargets(ch) { ch.tgtP.fill(0); ch.tgtY.fill(0); }
