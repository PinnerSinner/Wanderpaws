// Quadruped solver: dog, cat, capybara, red panda, elephant, router-cat.
//
// Phase-driven 4-leg gait that blends walk -> trot -> gallop -> sprint by
// speed, with 2-bone analytic IK planting each paw. A bendy spine (body, hips,
// chest) carries bob, gallop flex, corner lean, and the whole-back-end wag.
// Poses (sit, lie, play-bow, rear up, crouch, stretch, airborne, swim, shake,
// scratch, beg, groom) are blended on top as weighted body offsets and paw
// targets, so the IK keeps everything on the ground through transitions.

import { clamp, clamp01, lerp, smoothstep, TAU } from '../../core/math.js';
import { createChain } from './chain.js';
import { createFrame, composeFrame } from './pose.js';
import { solveLeg, applyFace, chainToPose, clearChainTargets } from './parts.js';

//               FL    FR    HL   HR    duty  lift  freq  bob
const GAITS = [
  [0.25, 0.75, 0.0, 0.5, 0.64, 0.8, 1.55, 0.5], // walk
  [0.5, 1.0, 0.0, 0.5, 0.46, 1.1, 2.3, 1.0], // trot
  [0.6, 1.5, 0.0, 0.1, 0.36, 1.25, 2.8, 1.5], // gallop
  [0.55, 1.5, 0.0, 0.05, 0.3, 1.35, 3.2, 1.8], // sprint
];
const KEYS = [0.15, 0.45, 0.74, 0.95];
const LEGS = ['FL', 'FR', 'HL', 'HR'];

export function createQuadruped(core, plan, skel, pose) {
  const P = core.P;
  const ears = plan.ear ? [createChain(plan.ear), createChain(plan.ear)] : null;
  const tail = plan.tail ? createChain(plan.tail) : null;
  const trunk = plan.trunk ? createChain(plan.trunk) : null;
  const rw = skel.restWorld;
  const ri = (n) => skel.index[n];
  const neutral = LEGS.map((k) => {
    const i = ri(`leg${k}`);
    const front = k[0] === 'F';
    return [rw[i * 3] * 0.94, 0, rw[i * 3 + 2] + (front ? 0.015 : -0.005)];
  });
  const joints = LEGS.map((k) => skel.bones[ri(`leg${k}`)].pos);
  const rest = (n) => skel.bones[ri(n)].pos;
  const R_body = rest('body'), R_hips = rest('hips'), R_chest = rest('chest');
  const ssd = plan.shortSide || 1;
  const shortL = (l) => ({ ...l, upper: l.upper * ssd, lower: l.lower * ssd });
  const specs = [plan.front, ssd !== 1 ? shortL(plan.front) : plan.front, plan.hind, ssd !== 1 ? shortL(plan.hind) : plan.hind];
  const sideTilt = ssd !== 1 ? Math.atan2((1 - ssd) * (plan.front.upper + plan.front.lower), plan.hipJoint[0] * 2) * 0.9 : 0;
  const fBody = createFrame(), fHips = createFrame(), fChest = createFrame();
  const tmpR = new Float64Array(9);
  const gaitV = new Float64Array(8);
  const legPhase = new Float64Array(4);
  const tgt = new Float64Array(12);
  const lift01 = new Float64Array(4);
  const st = {
    phase: 0, prevHipsYaw: 0, prevHeadP: 0, prevHeadY: 0, prevHeadR: 0, prevBodyP: 0,
    bob: 0, bobV: 0, bobA: 0, shakePh: 0, swimPh: 0, earPhase: 0,
  };
  const dEar = [{ wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 }, { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 }];
  const dTail = { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 };
  const dTrunk = { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 };
  const earKind = plan.ear ? plan.ear.kind : 'none';
  const upEar = earKind === 'pointy' || earKind === 'antenna' || earKind === 'round';

  function gaitBlend(sn) {
    // piecewise-linear blend of the table rows by speed
    let a = 0, b = 0, t = 0;
    if (sn <= KEYS[0]) { a = b = 0; } else if (sn >= KEYS[3]) { a = b = 3; } else {
      for (let i = 0; i < 3; i++) if (sn <= KEYS[i + 1]) { a = i; b = i + 1; t = (sn - KEYS[i]) / (KEYS[i + 1] - KEYS[i]); break; }
    }
    t = t * t * (3 - 2 * t);
    for (let j = 0; j < 8; j++) gaitV[j] = lerp(GAITS[a][j], GAITS[b][j], t);
    return { a, b, t };
  }

  function update(dt) {
    const c = core.c, emo = core.emo, b = pose.bones;
    const move = core.move, sn = core.speedN;
    const bounce = P.bounce ?? 0.5, sleek = P.sleek ?? 0.5;
    gaitBlend(sn);
    const duty = gaitV[4];
    const gal = smoothstep(0.6, 0.85, sn) * move; // gallop-ness
    const dbl = 1 - smoothstep(0.55, 0.75, sn); // double-bob gaits (walk, trot)

    // --- phase and stride
    const sizeK = 1;
    let freq = gaitV[6] * (P.gaitFreq || 1) * sizeK;
    const strideMax = plan.gait.stride * (1 + 0.35 * sn);
    if (core.v / freq > strideMax) freq = core.v / strideMax;
    const stride = Math.min(core.v / Math.max(0.01, freq), strideMax * 1.15) * move;
    const swimW = c.swim, airW = c.air;
    st.phase = (st.phase + dt * freq * smoothstep(0, 0.25, move) * (1 - swimW)) % 1;
    st.swimPh = (st.swimPh + dt * (1.6 + 1.2 * sn) * swimW) % 1;
    const ph = st.phase;

    // --- body offsets
    const bodyX = b.body, hips = b.hips, chest = b.chest;
    const bobAmp = plan.gait.bob * gaitV[7] * (0.5 + bounce) * emo.bounce * move * (1 - swimW) * (1 - airW);
    const bob = -bobAmp * (dbl * (0.5 + 0.5 * Math.cos(ph * TAU * 2)) + (1 - dbl) * (0.5 + 0.5 * Math.cos(ph * TAU + 0.6)));
    const bv = (bob - st.bob) / dt; st.bobA = clamp((bv - st.bobV) / dt, -60, 60); st.bobV = bv; st.bob = bob;
    const sit = clamp01(c.sit), lie = clamp01(c.lie), bow = clamp01(c.bow), rear = clamp01(c.rear);
    const crouch = clamp01(c.crouch), stretch = clamp01(c.stretch), paw = clamp01(c.paw) * sit;
    const legLen = plan.front.upper + plan.front.lower;
    let py = bob - crouch * 0.1 * legLen / 0.33 - sit * 0.1 - lie * (plan.bodyY - 0.2) * 0.95 - bow * 0.07 + rear * 0.08 + c.hop;
    py -= swimW * 0.24 * (core.species.floats ? 0.7 : 1);
    py += c.butt * 0.0;
    let rx = core.pitch.x - sit * 0.62 + bow * 0.34 - rear * 1.12 - swimW * 0.1 + crouch * 0.05;
    rx += gal * 0.1 * Math.sin(ph * TAU + 1.6);
    rx -= airW * clamp(core.vyN, -1, 1) * 0.22;
    let rz = core.lean.x + (1 - gal) * dbl * 0.035 * move * Math.sin(ph * TAU) + c.tremble * 0.02 * Math.sin(core.t * 47);
    bodyX.py = py - sideTilt * 0.08; bodyX.rx = rx; bodyX.rz = rz + sideTilt;
    bodyX.pz = -sit * 0.05 + stretch * 0.0;
    // spine flex in the gallop and the whole-back-end wag
    const flex = gal * (0.12 + 0.1 * (1 - (P.weight ?? 0.5))) * Math.sin(ph * TAU);
    const wagAmp = clamp(emo.wag + c.wagAdd * 0.45, 0, 1.6);
    const backEnd = wagAmp * (P.wag ?? 0.5) * 0.3 * (1 - gal * 0.85) * (1 - swimW * 0.6) * (1 - lie * 0.7) * (1 - rear * 0.8);
    const wig = Math.sin(core.wagPhase);
    const butt = c.butt * 0.13 * Math.sin(core.t * 15);
    // shake: a twisting sine through the spine, frequency rising as it goes
    const sh = clamp01(c.shake);
    const shU = clamp01((core.idleCur === 'shake' ? core.idleCurT : core.shakeT) / 1.4);
    st.shakePh += dt * TAU * (3.5 + 6 * shU) * (sh > 0.001 ? 1 : 0);
    const shk = Math.sin(st.shakePh);
    hips.ry = backEnd * wig + butt;
    hips.rx = flex - rear * 0.1 + c.butt * 0.06;
    hips.rz = sh * 0.3 * Math.sin(st.shakePh - 1.4);
    hips.pz = -stretch * 0.035;
    chest.ry = -backEnd * 0.35 * wig - butt * 0.3;
    chest.rx = -flex * 0.8;
    chest.rz = sh * 0.38 * Math.sin(st.shakePh - 0.7);
    chest.pz = stretch * 0.035;
    bodyX.rz += backEnd * 0.12 * wig;
    pose.fx.shake = sh;

    // --- frames
    composeFrame(fBody, null, R_body, bodyX, 'YXZ', tmpR);
    composeFrame(fHips, fBody, R_hips, hips, 'YXZ', tmpR);
    composeFrame(fChest, fBody, R_chest, chest, 'YXZ', tmpR);

    // --- paw targets
    const liftK = gaitV[5] * (0.75 + 0.5 * bounce);
    for (let l = 0; l < 4; l++) {
      const front = l < 2;
      const off = gaitV[l];
      const lp = ((ph + off) % 1 + 1) % 1;
      legPhase[l] = lp;
      let z, y, lf = 0;
      if (lp < duty) { const s = lp / duty; z = stride * (0.5 - s); y = 0; }
      else {
        const s = (lp - duty) / (1 - duty);
        const e = s * s * (3 - 2 * s);
        z = stride * (-0.5 + e);
        lf = Math.pow(Math.sin(Math.PI * s), 0.8);
        y = lf * (front ? plan.gait.liftF : plan.gait.liftH) * liftK * clamp01(stride / 0.12 + 0.3);
      }
      y *= move; lift01[l] = lf * move;
      let tx = neutral[l][0], ty = y, tz = neutral[l][2] + z;
      const side = l % 2 === 0 ? 1 : -1;
      // sit: hind paws come forward under the body
      if (!front) { tz += sit * 0.11 + lie * 0.1; tx += side * (sit * 0.015 + lie * 0.075); }
      else { tz += sit * 0.03 + lie * 0.17 + bow * 0.15; }
      tz += crouch * (front ? 0.03 : -0.02);
      // stretch (dash / pounce leap): reach out front and back
      tz += stretch * (front ? 0.17 : -0.17);
      ty += stretch * airW * 0.07;
      // airborne: legs reach on the way up, gather and reach down on the way down
      if (airW > 0.001) {
        const up = clamp01(core.vyN), down = clamp01(-core.vyN);
        const tuck = clamp01(c.tuck);
        const ay = 0.06 + 0.08 * up + 0.03 * down + tuck * 0.12;
        const az = front ? 0.07 * up + 0.05 * down : -0.09 * up - 0.02 * down;
        ty = lerp(ty, ay, airW); tz = lerp(tz, neutral[l][2] + az + stretch * (front ? 0.15 : -0.15), airW);
      }
      // swimming: dog paddle circles
      if (swimW > 0.001) {
        const a = st.swimPh * TAU + (l === 0 || l === 3 ? 0 : Math.PI) + (front ? 0 : 0.6);
        const r = front ? 0.07 : 0.05;
        ty = lerp(ty, 0.12 + r * Math.sin(a), swimW);
        tz = lerp(tz, neutral[l][2] + (front ? 0.05 : -0.04) + r * 1.2 * Math.cos(a), swimW);
      }
      tgt[l * 3] = tx; tgt[l * 3 + 1] = ty; tgt[l * 3 + 2] = tz;
    }
    // rear up: hind paws stay under the hips, front legs become arms
    if (rear > 0.001 || paw > 0.001 || c.groom > 0.001 || c.reach > 0.001) {
      for (let l = 0; l < 2; l++) {
        const side = l === 0 ? 1 : -1;
        const j = joints[l];
        const spread = clamp01(c.spread);
        // shoulder in root space
        const sx = fChest.P[0] + fChest.R[0] * j[0] + fChest.R[1] * j[1] + fChest.R[2] * j[2];
        const sy = fChest.P[1] + fChest.R[3] * j[0] + fChest.R[4] * j[1] + fChest.R[5] * j[2];
        const sz = fChest.P[2] + fChest.R[6] * j[0] + fChest.R[7] * j[1] + fChest.R[8] * j[2];
        const wr = Math.max(rear, paw);
        const ax = sx + side * (0.03 + 0.16 * spread), ay = sy - 0.16 + 0.1 * spread, az = sz + 0.1 - 0.02 * spread;
        tgt[l * 3] = lerp(tgt[l * 3], ax, wr);
        tgt[l * 3 + 1] = lerp(tgt[l * 3 + 1], ay + paw * 0.02 * Math.sin(core.t * 6 + l), wr);
        tgt[l * 3 + 2] = lerp(tgt[l * 3 + 2], az, wr);
        if (l === 0 && c.groom > 0.001) {
          const g = clamp01(c.groom);
          tgt[0] = lerp(tgt[0], sx - 0.04, g); tgt[1] = lerp(tgt[1], sy + 0.02 + 0.02 * Math.sin(core.t * 7), g); tgt[2] = lerp(tgt[2], sz + 0.12, g);
        }
        if (c.reach > 0.001 && core.species.signature.kind === 'pounce') {
          const r = clamp01(c.reach) * airW;
          tgt[l * 3 + 1] = lerp(tgt[l * 3 + 1], sy - 0.12, r); tgt[l * 3 + 2] = lerp(tgt[l * 3 + 2], sz + 0.24, r);
        }
      }
      for (let l = 2; l < 4; l++) {
        const side = l === 2 ? 1 : -1;
        const j = joints[l];
        const hx = fHips.P[0] + fHips.R[0] * j[0] + fHips.R[1] * j[1] + fHips.R[2] * j[2];
        const hz = fHips.P[2] + fHips.R[6] * j[0] + fHips.R[7] * j[1] + fHips.R[8] * j[2];
        tgt[l * 3] = lerp(tgt[l * 3], hx * 1.1, rear); tgt[l * 3 + 2] = lerp(tgt[l * 3 + 2], hz + 0.04, rear);
      }
    }
    // scratch: left hind leg thumps at the ear
    if (c.scratch > 0.001) {
      const s = clamp01(c.scratch);
      tgt[6] = lerp(tgt[6], 0.15, s);
      tgt[7] = lerp(tgt[7], 0.3 + 0.035 * Math.sin(core.t * 26), s);
      tgt[8] = lerp(tgt[8], fChest.P[2] + 0.02 + 0.02 * Math.cos(core.t * 26), s);
    }

    // --- solve legs
    const bodyPitch = bodyX.rx;
    for (let l = 0; l < 4; l++) {
      const front = l < 2;
      const side = l % 2 === 0 ? 1 : -1;
      const key = LEGS[l];
      const fr = front ? fChest : fHips;
      const j = joints[l];
      const parentPitch = bodyPitch + (front ? chest.rx : hips.rx);
      const flex = lift01[l] * (front ? 1.0 : 0.6) + swimW * 0.6 + airW * clamp01(c.tuck) * 0.8;
      void side;
      solveLeg(pose, key, fr, j, specs[l], tgt[l * 3], tgt[l * 3 + 1], tgt[l * 3 + 2], parentPitch, flex);
    }

    // --- neck and head
    const neck = b.neck, head = b.head;
    const hp = core.headPitch.x;
    const hy = core.headYaw.x;
    const nd = clamp01(c.noseDown);
    const bodyWorldPitch = bodyPitch + chest.rx;
    neck.rx = 0.55 * nd + 0.4 * hp + 0.32 * lie + 0.28 * stretch - 0.45 * swimW + crouch * 0.12 - 0.1 * bow;
    neck.ry = 0.4 * hy;
    head.rx = 0.35 * nd + 0.55 * hp - 0.12 * lie - 0.85 * bodyWorldPitch - 0.15 * stretch - 0.15 * bow + 0.05 * dbl * move * Math.sin(ph * TAU * 2 + 1);
    head.rx += 0.04 * Math.sin(core.t * 30) * clamp01(c.sniff);
    head.ry = 0.6 * hy - chest.ry * 0.8;
    head.rz = c.headRoll + sh * 0.55 * shk - core.lean.x * 0.3;
    head.py = 0; head.pz = 0;
    // gulp: cheeks and neck bulge, handled as a head squash pulse
    const g = c.gulp;
    head.sx = 1 + g * 0.08; head.sz = 1 + g * 0.05; head.sy = 1 - g * 0.04;

    applyFace(core, pose, { jawMax: 0.55, tongueOut: 0.04 });

    // --- chains
    const headPw = bodyX.rx + chest.rx + neck.rx + head.rx;
    const headYw = neck.ry + head.ry;
    const headRw = head.rz + bodyX.rz;
    const wP = (headPw - st.prevHeadP) / dt, wY = (headYw - st.prevHeadY) / dt, wR = (headRw - st.prevHeadR) / dt;
    st.prevHeadP = headPw; st.prevHeadY = headYw; st.prevHeadR = headRw;
    const accY = core.accY + st.bobA;
    if (ears) {
      const perk = emo.perk - c.earBack;
      for (let e = 0; e < 2; e++) {
        const ch = ears[e];
        clearChainTargets(ch);
        const d = dEar[e];
        const m = e === 0 ? 1 : -1;
        if (earKind === 'floppy') {
          ch.tgtP[0] = -0.25 * Math.max(0, perk) + 0.55 * Math.max(0, -perk) + swimW * 0.6 + stretch * 0.5;
          ch.tgtY[0] = 0.35 * Math.max(0, perk) + 0.25 * Math.max(0, -perk) + sh * 0.3;
          d.wP = wP; d.wY = wR * m; d.gP = headPw;
          d.fP = core.accF * 0.35 + stretch * 0; d.fY = -core.accR * 0.4 * m - accY * 0.35;
        } else if (earKind === 'elephant') {
          const flapE = 0.18 * Math.sin(core.t * 1.9) + clamp01(c.spread) * 0.8;
          ch.tgtP[0] = -flapE; ch.tgtY[0] = 0.1 * perk;
          d.wP = wY * m; d.wY = wR * m; d.gP = 0;
          d.fP = core.accF * 0.25; d.fY = -accY * 0.2 - core.accR * 0.25 * m;
        } else {
          // upright ears: back = negative pitch, outward = positive yaw
          ch.tgtP[0] = 0.12 * perk - (perk < 0 ? 0.8 * -perk : 0) - stretch * 0.5;
          ch.tgtY[0] = (perk < 0 ? 0.55 * -perk : 0) + sh * 0.2;
          d.wP = wP; d.wY = -wR * m; d.gP = 0;
          d.fP = -core.accF * 0.15; d.fY = core.accR * 0.15 * m;
        }
        if (earKind === 'elephant') chainToPose(pose, skel, e === 0 ? 'earL' : 'earR', ch, dt, d, 'ry', 'rz', 1);
        else chainToPose(pose, skel, e === 0 ? 'earL' : 'earR', ch, dt, d, 'rx', 'rz', upEar ? -1 : 1);
        if (earKind === 'elephant' && e === 1) {
          // mirror the flap axis for the right ear
          const info = skel.chains.earR;
          for (let i = 0; i < ch.n; i++) pose.list[info.ids[i]].ry = -pose.list[info.ids[i]].ry;
        }
      }
    }
    if (tail) {
      clearChainTargets(tail);
      const lift = clamp(emo.tail + c.tailLift, -1.2, 1.2);
      const tuck = Math.max(0, -lift);
      tail.tgtP[0] = 0.45 * Math.max(0, lift) - 1.1 * tuck - sit * 0.75 - lie * 0.4 + rear * 0.1 - gal * 0.25 - swimW * 0.5 + stretch * -0.2;
      if (tail.n > 2) { tail.tgtP[1] = -0.3 * tuck; tail.tgtP[2] = -0.25 * tuck; }
      const amp = wagAmp * (0.5 + (P.wag ?? 0.5) * 0.7) * (1 - tuck * 0.8);
      tail.tgtY[0] = amp * 0.75 * wig * (1 - gal * 0.6);
      if (tail.n > 1) tail.tgtY[1] = amp * 0.3 * Math.sin(core.wagPhase - 0.8) * (1 - gal * 0.6);
      // cats: a lazy tip flick
      if ((P.sleek ?? 0) > 0.8) tail.tgtY[tail.n - 1] += 0.5 * Math.sin(core.t * 1.3) + 0.2 * Math.sin(core.t * 3.1);
      const hipsYawW = hips.ry + chest.ry * 0;
      dTail.wY = (hipsYawW - st.prevHipsYaw) / dt + core.yawRate * 0.6 + sh * 0;
      st.prevHipsYaw = hipsYawW;
      const bp = bodyX.rx + hips.rx;
      dTail.wP = (bp - st.prevBodyP) / dt; st.prevBodyP = bp;
      dTail.fY = core.accR * 0.25 + sh * 30 * Math.sin(st.shakePh - 2.1);
      dTail.fP = -accY * 0.25 - core.accF * 0.06;
      dTail.gP = 0;
      chainToPose(pose, skel, 'tail', tail, dt, dTail, 'rx', 'ry', 1);
    }
    if (trunk) {
      clearChainTargets(trunk);
      const up = clamp01(c.trunk), reach = clamp01(c.reach);
      for (let i = 0; i < trunk.n; i++) {
        const fwd = -trunk.restP[i] * reach + reach * 0.02 * Math.sin(core.t * 23 + i);
        trunk.tgtP[i] = -up * (0.5 + 0.1 * i) * (i < trunk.n - 1 ? 1 : 1.5) + fwd + nd * 0.1 - swimW * (i < 4 ? 0.3 : 0.25);
        trunk.tgtY[i] = (1 - reach) * (1 - up) * 0.12 * Math.sin(core.t * 0.9 + i * 0.5);
      }
      dTrunk.wP = wP; dTrunk.wY = wY + core.yawRate * 0.5; dTrunk.gP = headPw;
      dTrunk.fP = -accY * 0.15 + core.accF * 0.2; dTrunk.fY = -core.accR * 0.25;
      chainToPose(pose, skel, 'trunk', trunk, dt, dTrunk, 'rx', 'ry', 1);
    }

    // --- root squash and stretch (about the feet)
    const sq = core.squash.x;
    const root = b.root;
    root.sy = 1 + sq; root.sx = root.sz = 1 / Math.sqrt(1 + sq);
    // effects
    pose.fx.glow = clamp01(c.glow);
    pose.fx.ledRate = 1 + c.ledRate;
    pose.fx.led = (pose.fx.led + dt * pose.fx.ledRate) % 1000;
    pose.fx.aura = core.sigKind === 'chillAura' ? core.sigW : 0;
    pose.fx.signal = core.sigKind === 'wifiPurr' ? core.sigW : 0;
    pose.fx.colour = c.colour;
    pose.fx.puff = c.puff;
    pose.fx.cheeks = c.gulp;
  }

  function reset() {
    if (ears) for (const e of ears) e.first = true;
    st.phase = 0;
  }
  return { update, reset, chains: { ears, tail, trunk }, state: st };
}
