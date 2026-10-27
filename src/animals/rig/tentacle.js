// Tentacle solver: the octopus.
//
// A bobbing, breathing mantle over eight spring-chain arms. Walking is a
// travelling wave round the arms: each one plants, pushes back and lifts in
// turn. Swimming tilts the body and streams the arms behind with jet pulses.
// Eight-Arm Grab flings every arm outward then curls them all in.

import { clamp, clamp01, smoothstep, TAU } from '../../core/math.js';
import { createChain } from './chain.js';
import { applyFace, chainToPose, clearChainTargets } from './parts.js';

export function createTentacle(core, plan, skel, pose) {
  const P = core.P;
  const A = plan.arms, L = plan.armLinks;
  const rest = [];
  for (let i = 0; i < L; i++) rest.push(i === 0 ? 0.75 : i === 1 ? 0.15 : -0.32);
  const arms = [];
  for (let k = 0; k < A; k++) arms.push(createChain({ links: L, stiff: 4.5, damp: 0.45, inertia: 0.75, gravity: 0, rest }));
  const theta = [];
  for (let k = 0; k < A; k++) theta.push(skel.chains[`arm${k}`].theta);
  const drives = arms.map(() => ({ wP: 0, wY: 0, fP: 0, fY: 0, gP: 0 }));
  const st = { phase: 0, jet: 0, prevYaw: 0 };

  function update(dt) {
    const c = core.c, emo = core.emo, b = pose.bones;
    const sn = core.speedN, move = core.move;
    const swimW = c.swim;
    st.phase = (st.phase + dt * (0.8 + 1.6 * sn) * (P.gaitFreq || 1) * Math.max(0.15, move)) % 1;
    st.jet = (st.jet + dt * (1.2 + sn) * swimW) % 1;
    const body = b.body, mantle = b.mantle;
    const breathe = Math.sin(core.t * 2.1);
    const jetPulse = swimW * Math.max(0, Math.sin(st.jet * TAU));
    body.py = 0.015 * Math.sin(st.phase * TAU * 2) * move + c.hop - swimW * 0.05 + 0.008 * breathe - clamp01(c.crouch) * 0.06;
    body.rx = core.pitch.x + swimW * 1.1 - core.c.air * clamp(core.vyN, -1, 1) * 0.15;
    body.rz = core.lean.x + c.bodyRoll + c.shake * 0.3 * Math.sin(core.t * 24);
    body.ry = c.spin * TAU;
    mantle.rx = -0.25 * move - swimW * 0.25 + 0.05 * breathe + clamp01(c.reach) * -0.2;
    mantle.ry = core.headYaw.x * 0.2;
    mantle.rz = c.headRoll * 0.6 + 0.04 * Math.sin(core.t * 1.3);
    const ms = 1 + 0.04 * breathe - jetPulse * 0.12 + c.gulp * 0.12;
    mantle.sx = ms; mantle.sz = ms; mantle.sy = 1 / Math.sqrt(ms) + jetPulse * 0.1;
    const head = b.head;
    head.ry = core.headYaw.x * 0.5;
    head.rx = core.headPitch.x * 0.3;
    applyFace(core, pose, { jawMax: 0.4, lidOpen: -1.2, lidShut: 1.5 });

    const reach = clamp01(c.reach), curl = clamp01(c.curl);
    const yawW = core.yawRate;
    for (let k = 0; k < A; k++) {
      const ch = arms[k];
      clearChainTargets(ch);
      const th = theta[k];
      // forward-facing arms (cos th > 0) lead, rear ones push
      const fwd = Math.cos(th);
      const ap = (st.phase + k / A) % 1;
      const lift = Math.max(0, Math.sin(ap * TAU)) * move;
      const sweep = Math.cos(ap * TAU) * 0.35 * move;
      ch.tgtP[0] = -lift * 0.55 - reach * 0.6 + curl * 0.2 - swimW * 0.6;
      ch.tgtY[0] = sweep * (0.6 + 0.4 * Math.abs(fwd)) + 0.06 * Math.sin(core.t * 0.9 + k);
      for (let i = 1; i < L; i++) {
        ch.tgtP[i] = -reach * ch.restP[i] * 1.0 - curl * 0.55 + lift * 0.1 + swimW * (-ch.restP[i] + 0.05);
        ch.tgtY[i] = 0.12 * Math.sin(core.t * 1.7 + k * 1.3 + i * 0.6) * (1 - reach) * (1 + emo.wag * 0.5);
      }
      const d = drives[k];
      d.wP = 0; d.wY = yawW;
      // linear acceleration in the arm's own frame
      const aF = core.accF * Math.cos(th) - core.accR * Math.sin(th);
      const aS = core.accF * Math.sin(th) + core.accR * Math.cos(th);
      d.fP = aF * 0.12 - core.accY * 0.1; d.fY = -aS * 0.12;
      chainToPose(pose, skel, `arm${k}`, ch, dt, d, 'rx', 'ry', 1);
    }
    const sq = core.squash.x;
    b.root.sy = 1 + sq; b.root.sx = b.root.sz = 1 / Math.sqrt(1 + sq);
    pose.fx.colour = clamp01(c.colour + smoothstep(0.5, 1, reach) * 0.3);
    pose.fx.glow = clamp01(c.glow);
  }
  return { update, reset() { st.phase = 0; } };
}
