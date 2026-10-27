// Shelled solver: the tortoise. Stately and smug.
//
// A slow diagonal-pair gait on four stubby legs, the shell rocking gently,
// the head extending on its 3-link neck as it walks (and retracting when
// shy or tucked). Shell Up pulls everything in and, if moving, rolls the
// whole shell like a bowling ball.

import { clamp, clamp01, lerp, smoothstep, TAU } from '../../core/math.js';
import { createChain } from './chain.js';
import { createFrame, composeFrame } from './pose.js';
import { solveLeg, applyFace, chainToPose, clearChainTargets } from './parts.js';

const LEGS = ['FL', 'FR', 'HL', 'HR'];
const OFF = [0, 0.5, 0.5, 0]; // diagonal pairs

export function createShelled(core, plan, skel, pose) {
  const P = core.P;
  const neckCh = createChain({ links: plan.neck.links, stiff: 4, damp: 0.7, inertia: 0.4, gravity: 0 });
  const tail = plan.tail ? createChain(plan.tail) : null;
  const ri = (n) => skel.index[n];
  const rest = (n) => skel.bones[ri(n)].pos;
  const rw = skel.restWorld;
  const joints = LEGS.map((k) => skel.bones[ri(`leg${k}`)].pos);
  const neutral = LEGS.map((k) => { const i = ri(`leg${k}`); return [rw[i * 3] * 1.15, 0, rw[i * 3 + 2]]; });
  const legSpec = { upper: plan.legs.upper, lower: plan.legs.lower, bend: 1 };
  const fBody = createFrame();
  const tmpR = new Float64Array(9);
  const st = { phase: 0, roll: 0, prevHead: 0 };
  const dN = { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 };
  const dT = { wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 };
  const neckIds = skel.chains.neck.ids;

  function update(dt) {
    const c = core.c, emo = core.emo, b = pose.bones;
    const sn = core.speedN, move = core.move;
    const shell = clamp01(c.shell);
    const swimW = c.swim;
    const freq = (0.9 + 1.4 * sn) * (P.gaitFreq || 0.7);
    st.phase = (st.phase + dt * freq * smoothstep(0, 0.2, move) * (1 - shell)) % 1;
    st.roll += dt * core.v * shell * (move > 0.1 ? 1 : 0) / Math.max(0.15, plan.shellR) * 0.5;
    st.roll %= TAU;
    if (shell < 0.2) { const target = st.roll > Math.PI ? TAU : 0; st.roll += (target - st.roll) * Math.min(1, dt * 6); }
    const ph = st.phase;
    const body = b.body;
    const rock = 0.04 * move * Math.sin(ph * TAU * 2);
    body.py = -shell * (plan.bodyY - plan.shellH * 0.45) - clamp01(c.lie + c.sit) * 0.06 + c.hop - swimW * 0.12 + 0.006 * move * Math.cos(ph * TAU * 2);
    body.rx = core.pitch.x * 0.5 + rock * 0.5 + st.roll;
    body.rz = core.lean.x * 0.6 + rock + c.bodyRoll + c.shake * 0.2 * Math.sin(core.t * 22);
    body.ry = c.spin * 0 + 0.03 * move * Math.sin(ph * TAU);
    composeFrame(fBody, null, rest('body'), body, 'YXZ', tmpR);

    const stride = plan.gait.stride * (0.5 + 0.7 * sn) * move;
    for (let l = 0; l < 4; l++) {
      const key = LEGS[l];
      const lp = (ph + OFF[l]) % 1;
      const duty = 0.6;
      let z, y = 0;
      if (lp < duty) z = stride * (0.5 - lp / duty);
      else { const s = (lp - duty) / (1 - duty); z = stride * (-0.5 + s * s * (3 - 2 * s)); y = Math.sin(Math.PI * s) * plan.gait.lift * move; }
      let tx = neutral[l][0], ty = y, tz = neutral[l][2] + z;
      if (swimW > 0.001) {
        const a = core.t * 4 + l * 1.6;
        ty = lerp(ty, 0.1 + 0.03 * Math.sin(a), swimW); tz = lerp(tz, neutral[l][2] + 0.05 * Math.cos(a), swimW); tx = lerp(tx, neutral[l][0] * 1.3, swimW);
      }
      solveLeg(pose, key, fBody, joints[l], legSpec, tx, ty, tz, body.rx, 0);
      // tucked legs shrink into the shell
      const L = pose.bones[`leg${key}`];
      const s = 1 - shell * 0.85;
      L.sx = L.sy = L.sz = s;
      if (shell > 0) { L.rx *= 1 - shell; L.rz *= 1 - shell; L.py = shell * 0.04; }
    }

    // neck: extends forward as it walks, retracts when shy
    clearChainTargets(neckCh);
    const hp = core.headPitch.x, hy = core.headYaw.x;
    const nd = clamp01(c.noseDown);
    for (let i = 0; i < neckCh.n; i++) {
      neckCh.tgtP[i] = (hp * 0.5 + nd * 0.6 + 0.05 * move * Math.sin(ph * TAU * 2 + i)) / neckCh.n;
      neckCh.tgtY[i] = hy * 0.8 / neckCh.n;
    }
    dN.fP = core.accF * 0.2; dN.fY = -core.accR * 0.2;
    chainToPose(pose, skel, 'neck', neckCh, dt, dN, 'rx', 'ry', 1);
    const extend = smoothstep(0, 0.6, move) * 0.02 + Math.max(0, emo.perk) * 0.01;
    const retract = Math.max(shell, core.emotion === 'scared' ? 0.6 : 0);
    for (let i = 0; i < neckIds.length; i++) {
      const x = pose.list[neckIds[i]];
      x.pz += extend - retract * (i === 0 ? 0.18 : 0.06);
      x.py -= retract * 0.01;
    }
    const head = b.head;
    head.rx = hp * 0.4 - body.rx * 0.6 + 0.03 * Math.sin(core.t * 1.3);
    head.ry = hy * 0.3;
    head.rz = c.headRoll;
    const hs = 1 - shell * 0.3;
    head.sx = hs * (1 + c.gulp * 0.08); head.sy = hs; head.sz = hs;
    applyFace(core, pose, { jawMax: 0.4, lidOpen: -1.1, lidShut: 1.5 });
    // smug half-lidded look when proud or neutral
    if (core.emotion === 'proud' || core.emotion === 'neutral') { b.lidL.rx = Math.max(b.lidL.rx, -0.25); b.lidR.rx = Math.max(b.lidR.rx, -0.25); }

    if (tail) {
      clearChainTargets(tail);
      tail.tgtY[0] = 0.25 * Math.sin(core.wagPhase) * emo.wag;
      dT.fY = core.accR * 0.1;
      chainToPose(pose, skel, 'tail', tail, dt, dT, 'rx', 'ry', 1);
      const t0 = pose.list[skel.chains.tail.ids[0]];
      t0.sx = t0.sy = t0.sz = 1 - shell * 0.8;
    }
    const sq = core.squash.x;
    b.root.sy = 1 + sq * 0.6; b.root.sx = b.root.sz = 1 / Math.sqrt(1 + sq * 0.6);
    pose.fx.glow = clamp01(c.glow);
  }
  return { update, reset() { st.phase = 0; st.roll = 0; } };
}
