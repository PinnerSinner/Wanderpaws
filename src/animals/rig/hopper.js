// Hopper solver: rabbit and frog.
//
// A discrete hop cycle while moving: crouch, launch (hind legs fire), an
// airborne arc with the hind legs trailing then tucking, front paws reaching
// for the landing, then a squash as the hind feet swing back under. The hop
// height grows with speed and bounce. Rabbits sit upright on their haunches
// when still and do binkies; frogs squat low with the throat pulsing.

import { clamp, clamp01, lerp, smoothstep, TAU } from '../../core/math.js';
import { createChain } from './chain.js';
import { createFrame, composeFrame } from './pose.js';
import { solveLeg, applyFace, chainToPose, clearChainTargets } from './parts.js';

const LEGS = ['FL', 'FR', 'HL', 'HR'];

export function createHopper(core, plan, skel, pose) {
  const P = core.P;
  const isFrog = core.species.id === 'frog' || !plan.ear;
  const ears = plan.ear ? [createChain(plan.ear), createChain(plan.ear)] : null;
  const tail = plan.tail ? createChain(plan.tail) : null;
  const rw = skel.restWorld;
  const ri = (n) => skel.index[n];
  const rest = (n) => skel.bones[ri(n)].pos;
  const joints = LEGS.map((k) => skel.bones[ri(`leg${k}`)].pos);
  const neutral = LEGS.map((k) => {
    const i = ri(`leg${k}`);
    const front = k[0] === 'F';
    const wide = isFrog && !front ? 1.45 : isFrog ? 1.2 : 1;
    return [rw[i * 3] * wide, 0, rw[i * 3 + 2] + (front ? 0.02 : (plan.hind.footLen || 0) * (isFrog ? 0.25 : 0.1))];
  });
  const fBody = createFrame(), fHips = createFrame(), fChest = createFrame();
  const tmpR = new Float64Array(9);
  const tgt = new Float64Array(12);
  const st = { phase: 0, hopping: 0, prevHeadP: 0, prevHeadR: 0, prevBodyP: 0, hopH: 0, prevHop: 0, hopV: 0, hopA: 0, swimPh: 0 };
  const dEar = [{ wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 }, { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 }];
  const dTail = { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 };

  function update(dt) {
    const c = core.c, emo = core.emo, b = pose.bones;
    const sn = core.speedN, move = core.move;
    const bounce = P.bounce ?? 0.8;
    const swimW = c.swim, airW = c.air;
    // hop phase: keeps going while moving, finishes the current hop when stopping
    const freq = (1.9 + 1.3 * sn) * (P.gaitFreq || 1);
    const want = move > 0.2 && swimW < 0.5 && airW < 0.5;
    if (want || st.phase > 0.001) {
      st.phase += dt * freq;
      if (st.phase >= 1) st.phase = want ? st.phase % 1 : 0;
    }
    st.swimPh = (st.swimPh + dt * (1.2 + sn) * swimW) % 1;
    const ph = st.phase;
    const launch = 0.14, land = 0.74;
    const flying = ph > launch && ph < land;
    const fu = flying ? (ph - launch) / (land - launch) : 0;
    const hopMax = plan.gait.hop * (0.35 + 0.85 * sn) * (0.6 + 0.5 * bounce) * emo.bounce;
    const hopY = flying ? Math.sin(Math.PI * fu) * hopMax : 0;
    const crouchHop = ph > 0 && ph < launch ? Math.sin(Math.PI * ph / launch) : ph >= land ? Math.sin(Math.PI * (ph - land) / (1 - land)) * 0.8 : 0;
    const hv = (hopY - st.prevHop) / dt; st.hopA = clamp((hv - st.hopV) / dt, -80, 80); st.hopV = hv; st.prevHop = hopY;

    const sit = clamp01(c.sit), lie = clamp01(c.lie), rear = clamp01(c.rear + (isFrog ? 0 : sit * 0.55 * (1 - move)));
    const crouch = clamp01(c.crouch + crouchHop * 0.6 + (isFrog ? 0.15 : 0));
    const stretch = clamp01(c.stretch + (flying ? Math.sin(Math.PI * Math.min(1, fu * 1.6)) * 0.8 : 0));
    const tuck = clamp01(c.tuck + (flying ? smoothstep(0.45, 0.8, fu) : 0));

    const bodyX = b.body, hips = b.hips, chest = b.chest;
    let py = hopY + c.hop - crouch * 0.06 - lie * plan.bodyY * 0.45 + rear * 0.06 - swimW * plan.bodyY * 0.8;
    let rx = core.pitch.x - rear * 0.75 + (flying ? lerp(-0.35, 0.35, fu) * (0.5 + sn) : 0) + crouch * 0.12;
    rx -= airW * clamp(core.vyN, -1, 1) * 0.25;
    if (swimW > 0) rx = lerp(rx, isFrog ? 0.05 : -0.2, swimW);
    bodyX.py = py; bodyX.rx = rx;
    bodyX.rz = core.lean.x + c.tremble * 0.02 * Math.sin(core.t * 47);
    bodyX.ry = c.twist * 0.6;
    hips.rz = c.twist * 0.5;
    hips.rx = -stretch * 0.15 + c.butt * 0.05;
    chest.rx = stretch * 0.1;
    // breathing / nose twitch
    const breathe = Math.sin(core.t * (isFrog ? 3.2 : 5)) * 0.01;
    chest.sy = 1 + breathe; chest.sx = 1 + breathe;
    composeFrame(fBody, null, rest('body'), bodyX, 'YXZ', tmpR);
    composeFrame(fHips, fBody, rest('hips'), hips, 'YXZ', tmpR);
    composeFrame(fChest, fBody, rest('chest'), chest, 'YXZ', tmpR);

    // leg targets
    const stride = plan.gait.stride * (0.4 + 0.6 * sn) * move;
    for (let l = 0; l < 4; l++) {
      const front = l < 2;
      const fr = front ? fChest : fHips;
      const j = joints[l];
      // joint world position
      const jx = fr.P[0] + fr.R[0] * j[0] + fr.R[1] * j[1] + fr.R[2] * j[2];
      const jy = fr.P[1] + fr.R[3] * j[0] + fr.R[4] * j[1] + fr.R[5] * j[2];
      const jz = fr.P[2] + fr.R[6] * j[0] + fr.R[7] * j[1] + fr.R[8] * j[2];
      let tx = neutral[l][0], ty = 0, tz = neutral[l][2];
      if (front) { tz += -sit * 0.0 + lie * 0.08; }
      else { tz += rear * 0.05; }
      // ground slide during the planted parts of the hop
      if (front) { if (ph >= land) tz += stride * (0.4 - (ph - land) / (1 - land) * 0.6); }
      else if (ph < launch) tz += stride * (-0.2 - ph / launch * 0.3);
      // airborne: relative to the joint
      const fl = flying ? 1 : 0;
      if (fl || airW > 0.01) {
        const w = Math.max(fl, airW);
        let ax, ay, az;
        if (front) { ax = jx; ay = jy - (plan.front.upper + plan.front.lower) * 0.8; az = jz + 0.05 + 0.06 * stretch; }
        else {
          const trail = 1 - tuck;
          ax = jx * (isFrog ? 1.3 : 1); ay = jy - (plan.hind.upper + plan.hind.lower) * (0.55 + 0.35 * trail); az = jz - 0.18 * trail + 0.06 * tuck;
        }
        tx = lerp(tx, ax, w); ty = lerp(ty, ay, w); tz = lerp(tz, az, w);
      }
      // rear up: front paws tucked to the chest
      if (front && rear > 0.001) {
        const spread = clamp01(c.spread);
        tx = lerp(tx, jx * (1 + spread * 2), rear); ty = lerp(ty, jy - 0.08 + spread * 0.04, rear); tz = lerp(tz, jz + 0.05, rear);
      }
      if (swimW > 0.001) {
        const a = st.swimPh * TAU + (front ? 0 : Math.PI * (isFrog ? 0 : 1)) + (l % 2) * (isFrog ? 0 : Math.PI);
        const kick = isFrog && !front ? 0.12 : 0.05;
        tx = lerp(tx, jx * (isFrog && !front ? 1.4 + 0.4 * Math.sin(a) : 1), swimW);
        ty = lerp(ty, jy - 0.06 + 0.03 * Math.sin(a), swimW);
        tz = lerp(tz, jz + (front ? 0.06 : -0.1) + kick * Math.cos(a), swimW);
      }
      tgt[l * 3] = tx; tgt[l * 3 + 1] = ty; tgt[l * 3 + 2] = tz;
    }
    for (let l = 0; l < 4; l++) {
      const front = l < 2;
      const parentPitch = bodyX.rx + (front ? chest.rx : hips.rx);
      const flex = front ? (flying ? 0.6 : 0) : (flying ? -0.4 * (1 - tuck) : 0);
      solveLeg(pose, LEGS[l], front ? fChest : fHips, joints[l], front ? plan.front : plan.hind, tgt[l * 3], tgt[l * 3 + 1], tgt[l * 3 + 2], parentPitch, flex);
      if (isFrog && !front) pose.bones[`leg${LEGS[l]}`].rz += (l === 2 ? 1 : -1) * 0.35 * (1 - stretch);
    }

    // neck and head
    const neck = b.neck, head = b.head;
    const hp = core.headPitch.x, hy = core.headYaw.x;
    const nd = clamp01(c.noseDown);
    neck.rx = 0.4 * nd + 0.4 * hp + 0.2 * lie;
    neck.ry = 0.35 * hy;
    head.rx = 0.4 * nd + 0.5 * hp - 0.8 * (bodyX.rx + chest.rx) + 0.03 * Math.sin(core.t * 30) * clamp01(c.sniff + (isFrog ? 0 : 0.3));
    head.ry = 0.65 * hy;
    head.rz = c.headRoll - core.lean.x * 0.3 + c.shake * 0.5 * Math.sin(core.t * 30);
    const g = c.gulp;
    head.sx = 1 + g * 0.08; head.sy = 1 - g * 0.04;
    applyFace(core, pose, { jawMax: isFrog ? 0.7 : 0.4, tongueOut: isFrog ? 0.02 : 0.015, tongueFar: 0, tongueStretch: isFrog ? 9 : 0, lidOpen: -1.3, lidShut: 1.5 });
    if (isFrog && b.tongue) b.tongue.rx = -b.jaw.rx * 0.95 + c.aim * 0.05;
    if (b.throat) {
      const puff = clamp01(c.puff + (isFrog ? 0.15 + 0.15 * Math.sin(core.t * 4.5) : 0));
      b.throat.sx = b.throat.sz = 1 + puff * 0.9; b.throat.sy = 1 + puff * 0.6;
    }

    // chains
    const headPw = bodyX.rx + chest.rx + neck.rx + head.rx;
    const headRw = head.rz + bodyX.rz;
    const wP = (headPw - st.prevHeadP) / dt, wR = (headRw - st.prevHeadR) / dt;
    st.prevHeadP = headPw; st.prevHeadR = headRw;
    const accY = core.accY + st.hopA;
    if (ears) {
      const perk = emo.perk - c.earBack;
      for (let e = 0; e < 2; e++) {
        const ch = ears[e];
        clearChainTargets(ch);
        const m = e === 0 ? 1 : -1;
        // bunny ears: up, back when scared or flying, droop when sleepy
        ch.tgtP[0] = 0.15 * perk - Math.max(0, -perk) * 0.9 - stretch * 0.4 - swimW * 0.8;
        ch.tgtY[0] = Math.max(0, -perk) * 0.3 + (core.emotion === 'sleepy' ? 0.5 : 0) + c.twist * 0.3 * m;
        if (ch.n > 2) ch.tgtP[2] = core.emotion === 'sleepy' ? -0.6 : 0;
        const d = dEar[e];
        d.wP = wP; d.wY = -wR * m; d.gP = 0;
        d.fP = -core.accF * 0.2 + accY * 0.12; d.fY = core.accR * 0.2 * m;
        chainToPose(pose, skel, e === 0 ? 'earL' : 'earR', ch, dt, d, 'rx', 'rz', -1);
      }
    }
    if (tail) {
      clearChainTargets(tail);
      tail.tgtP[0] = 0.3 * emo.tail + 0.2 * Math.sin(core.t * 9) * emo.wag;
      tail.tgtY[0] = emo.wag * 0.4 * Math.sin(core.wagPhase);
      dTail.wP = (bodyX.rx - st.prevBodyP) / dt; st.prevBodyP = bodyX.rx;
      dTail.wY = core.yawRate * 0.4; dTail.fP = -accY * 0.15; dTail.fY = core.accR * 0.15;
      chainToPose(pose, skel, 'tail', tail, dt, dTail, 'rx', 'ry', 1);
    }
    const sq = core.squash.x;
    b.root.sy = 1 + sq; b.root.sx = b.root.sz = 1 / Math.sqrt(1 + sq);
    pose.fx.puff = b.throat ? b.throat.sx - 1 : 0;
    pose.fx.glow = clamp01(c.glow);
    pose.fx.cheeks = c.gulp;
  }
  return { update, reset() { st.phase = 0; } };
}
