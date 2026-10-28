// Waddler solver: penguin and duck.
//
// Short legs stepping alternately with a big side-to-side body roll (the
// waddle), flippers or wings held out for balance and flapping on demand, a
// pumping neck for the duck, a tail wiggle, the penguin belly-slide (flat on
// the tummy, feet up, flippers back), floating and torpedo swimming, and the
// duck's flap-glide with wings spread.

import { clamp, clamp01, lerp, smoothstep, TAU } from '../../core/math.js';
import { createChain } from './chain.js';
import { createFrame, composeFrame } from './pose.js';
import { solveLeg, applyFace, chainToPose, clearChainTargets } from './parts.js';

export function createWaddler(core, plan, skel, pose) {
  const P = core.P;
  const upright = plan.upright ? 1 : 0;
  const wingSpec = { links: plan.wing.links, stiff: 7, damp: 0.5, inertia: 0.5, gravity: 0, rest: [0, 0] };
  const wings = [createChain(wingSpec), createChain(wingSpec)];
  const neckCh = createChain({ links: plan.neck.links, stiff: 6, damp: 0.6, inertia: 0.5, gravity: 0 });
  const tail = plan.tail ? createChain(plan.tail) : null;
  const ri = (n) => skel.index[n];
  const rest = (n) => skel.bones[ri(n)].pos;
  const rw = skel.restWorld;
  const joints = ['L', 'R'].map((k) => skel.bones[ri(`leg${k}`)].pos);
  const neutral = ['L', 'R'].map((k) => { const i = ri(`leg${k}`); return [rw[i * 3] * 1.05, 0, rw[i * 3 + 2]]; });
  const fBody = createFrame();
  const tmpR = new Float64Array(9);
  const st = { phase: 0, flapPh: 0, swimPh: 0, prevBodyR: 0, prevBodyP: 0, prevBodyY: 0, bob: 0, bobV: 0, bobA: 0 };
  const dW = [{ wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 }, { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 }];
  const dN = { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 };
  const dT = { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 };
  const isDuck = !upright;

  function update(dt) {
    const c = core.c, emo = core.emo, b = pose.bones;
    const sn = core.speedN, move = core.move;
    const bounce = P.bounce ?? 0.6;
    const swimW = c.swim, airW = c.air;
    const slide = clamp01(c.slide);
    const freq = (1.6 + 2.6 * sn) * (P.gaitFreq || 1);
    st.phase = (st.phase + dt * freq * smoothstep(0, 0.2, move) * (1 - slide) * (1 - swimW * 0.6)) % 1;
    const flapping = clamp01(c.flap + airW * (isDuck ? 0.7 : 0.4));
    st.flapPh = (st.flapPh + dt * (isDuck ? 7 : 9) * (0.4 + flapping)) % 1;
    st.swimPh = (st.swimPh + dt * (1.5 + sn * 1.5) * swimW) % 1;
    const ph = st.phase;
    const s1 = Math.sin(ph * TAU);
    const rollA = plan.gait.roll * (0.6 + 0.6 * bounce) * move * (1 - slide) * (1 - swimW);
    const bob = -0.012 * (0.5 + 0.5 * Math.cos(ph * TAU * 2)) * move * (0.6 + bounce) * (1 - slide);
    const bv = (bob - st.bob) / dt; st.bobA = clamp((bv - st.bobV) / dt, -60, 60); st.bobV = bv; st.bob = bob;

    const body = b.body;
    const sit = clamp01(c.sit + c.lie);
    const crouch = clamp01(c.crouch);
    // the belly-slide (and penguin swimming) lays the body flat, nose forward
    const flat = Math.max(slide, upright ? swimW : 0);
    body.py = bob + c.hop - crouch * 0.05 - sit * 0.08 - flat * (plan.bodyY - plan.bodyR * 0.85) - (isDuck ? swimW * 0.12 : 0);
    body.rx = core.pitch.x + flat * (upright ? 1.45 : 0.3) - airW * clamp(core.vyN, -1, 1) * 0.1 + sit * (upright ? 0.0 : 0.1);
    body.rz = core.lean.x * (1 + flat) + rollA * s1 + c.bodyRoll + c.tremble * 0.02 * Math.sin(core.t * 47) + c.shake * 0.35 * Math.sin(core.t * 26);
    body.ry = 0.08 * move * Math.sin(ph * TAU) * (1 - slide) + c.spin * TAU;
    if (isDuck && swimW > 0) body.py += 0.008 * Math.sin(core.t * 2.2) * swimW;
    composeFrame(fBody, null, rest('body'), body, 'YXZ', tmpR);

    // legs
    const stride = plan.gait.stride * (0.4 + 0.8 * sn) * move;
    const lift = plan.gait.lift * (0.6 + 0.6 * bounce);
    for (let l = 0; l < 2; l++) {
      const key = l === 0 ? 'L' : 'R';
      const lp = (ph + l * 0.5) % 1;
      const duty = 0.55;
      let z, y = 0;
      if (lp < duty) z = stride * (0.5 - lp / duty);
      else { const s = (lp - duty) / (1 - duty); z = stride * (-0.5 + s * s * (3 - 2 * s)); y = Math.sin(Math.PI * s) * lift * move; }
      let tx = neutral[l][0], ty = y, tz = neutral[l][2] + z;
      const j = joints[l];
      const jx = fBody.P[0] + fBody.R[0] * j[0] + fBody.R[1] * j[1] + fBody.R[2] * j[2];
      const jy = fBody.P[1] + fBody.R[3] * j[0] + fBody.R[4] * j[1] + fBody.R[5] * j[2];
      const jz = fBody.P[2] + fBody.R[6] * j[0] + fBody.R[7] * j[1] + fBody.R[8] * j[2];
      const reachLen = plan.leg.upper + plan.leg.lower;
      // flat (slide / torpedo): feet trail behind the body
      if (flat > 0.001) { tx = lerp(tx, jx * 0.8, flat); ty = lerp(ty, jy + 0.01, flat); tz = lerp(tz, jz - reachLen * 0.95, flat); }
      // airborne: tucked
      const tk = Math.max(airW, clamp01(c.tuck)) * (1 - flat);
      if (tk > 0.001) { tx = lerp(tx, jx, tk); ty = lerp(ty, jy - reachLen * 0.55, tk); tz = lerp(tz, jz - 0.03, tk); }
      // floating duck: paddle under the surface
      if (isDuck && swimW > 0.001) {
        const a = st.swimPh * TAU + l * Math.PI;
        tx = lerp(tx, jx, swimW); ty = lerp(ty, jy - reachLen * 0.85 + 0.02 * Math.sin(a), swimW); tz = lerp(tz, jz + 0.05 * Math.cos(a), swimW);
      }
      solveLeg(pose, key, fBody, j, plan.leg, tx, ty, tz, body.rx, flat * 1.2 + tk * 0.4);
    }

    // wings / flippers: hang at the sides, out for balance, flap, spread
    const spread = clamp01(c.spread + airW * 0.9);
    const flapA = Math.sin(st.flapPh * TAU);
    for (let e = 0; e < 2; e++) {
      const ch = wings[e];
      clearChainTargets(ch);
      const m = e === 0 ? 1 : -1;
      const balance = 0.25 * move * (1 - slide) * (0.5 + 0.5 * Math.sin(ph * TAU + (e ? Math.PI : 0)));
      const out = balance + spread * (isDuck ? 1.2 : 1.35) + flapping * (0.7 + 0.6 * flapA) + emo.bounce * 0.05 + (core.emotion === 'excited' ? 0.2 : 0);
      // duck wings fold along the back (chain points backwards): yaw is out, pitch is lift
      ch.tgtY[0] = (isDuck ? -0.05 : 0.12) + out * (isDuck ? 0.6 : 1) - (isDuck ? balance * 0.5 : 0);
      ch.tgtP[0] = isDuck ? -flapping * 0.6 * flapA - spread * 0.2 : -slide * 1.1 - swimW * 0.6;
      if (isDuck) { ch.tgtY[0] += spread * 0.6; ch.tgtP[0] += spread * 0.1; }
      ch.tgtY[1] = flapping * 0.3 * Math.sin(st.flapPh * TAU - 0.8) + spread * 0.2;
      const d = dW[e];
      d.wP = (body.rx - st.prevBodyP) / dt; d.wY = ((body.rz - st.prevBodyR) / dt) * m;
      d.fP = core.accF * 0.2; d.fY = -st.bobA * 0.05 - core.accR * 0.2 * m;
      if (isDuck) chainToPose(pose, skel, e === 0 ? 'wingL' : 'wingR', ch, dt, d, 'rx', 'ry', -1);
      else chainToPose(pose, skel, e === 0 ? 'wingL' : 'wingR', ch, dt, d, 'rx', 'rz', 1);
    }
    st.prevBodyP = body.rx; st.prevBodyR = body.rz;

    // neck (duck pumps with each step) and head
    clearChainTargets(neckCh);
    const pump = isDuck ? 0.18 * move * Math.sin(ph * TAU * 2) : 0;
    const hp = core.headPitch.x, hy = core.headYaw.x;
    const nd = clamp01(c.noseDown);
    for (let i = 0; i < neckCh.n; i++) {
      neckCh.tgtP[i] = (pump + nd * 0.5 + hp * 0.3) / neckCh.n * (isDuck ? 1.2 : 1) - flat * (upright ? 1.2 : 0.3) / neckCh.n;
      neckCh.tgtY[i] = hy * 0.5 / neckCh.n;
    }
    if (isDuck && neckCh.n >= 3) { neckCh.tgtP[0] += 0.35; neckCh.tgtP[2] -= 0.35; } // gentle S-curve
    dN.wP = 0; dN.wY = 0; dN.fP = core.accF * 0.25 + st.bobA * 0.05; dN.fY = -core.accR * 0.15; dN.gP = 0;
    chainToPose(pose, skel, 'neck', neckCh, dt, dN, 'rx', 'ry', -1);
    const head = b.head;
    let neckPitch = 0; for (let i = 0; i < neckCh.n; i++) neckPitch += neckCh.p[i];
    head.rx = hp * 0.6 + nd * 0.5 - (body.rx + neckPitch) * 0.85 + flat * (upright ? 0.0 : 0.0);
    if (flat > 0) head.rx -= flat * (upright ? 0.35 : 0);
    head.ry = hy * 0.6 - body.ry * 0.7;
    head.rz = c.headRoll - body.rz * 0.6 + c.shake * 0.4 * Math.sin(core.t * 30 + 1);
    const g = c.gulp;
    head.sx = 1 + g * 0.08; head.sy = 1 - g * 0.05;
    applyFace(core, pose, { jawMax: 0.45, lidOpen: -1.3, lidShut: 1.5 });

    if (tail) {
      clearChainTargets(tail);
      tail.tgtY[0] = (emo.wag * 0.5 + c.wagAdd * 0.3) * Math.sin(core.wagPhase * 1.4) + 0.15 * move * Math.sin(ph * TAU);
      tail.tgtP[0] = 0.2 * emo.tail - flat * 0.3;
      dT.wP = 0; dT.wY = (body.ry - st.prevBodyY) / dt; dT.fP = -st.bobA * 0.05; dT.fY = core.accR * 0.2; dT.gP = 0;
      st.prevBodyY = body.ry;
      chainToPose(pose, skel, 'tail', tail, dt, dT, 'rx', 'ry', 1);
    }
    const sq = core.squash.x;
    b.root.sy = 1 + sq; b.root.sx = b.root.sz = 1 / Math.sqrt(1 + sq);
    pose.fx.glow = clamp01(c.glow);
    pose.fx.cheeks = c.gulp;
  }
  return { update, reset() { st.phase = 0; } };
}
