// Serpent solver: the snake. It flows.
//
// Follow-the-leader: the head lays down a path (integrated from velocity, so
// it works on a treadmill too) and every segment sits a fixed arc length
// further back along it. A serpentine S-wave pinned to the ground is added
// sideways, so the body slides through a fixed curve instead of wiggling in
// place. Coil Pull winds the body into a spiral; idles raise the head and
// flick the tongue. Segment bones are children of the root and get absolute
// local positions and yaws. Preallocated ring buffer, no allocations.

import { clamp, clamp01, lerp, damp, TAU } from '../../core/math.js';
import { applyFace } from './parts.js';

const N = 512;

export function createSerpent(core, plan, skel, pose) {
  const segs = plan.segs;
  const seg = plan.segLen;
  const hx = new Float64Array(N), hz = new Float64Array(N), hs = new Float64Array(N);
  const sx = new Float64Array(segs), sz = new Float64Array(segs), sOff = new Float64Array(segs);
  const ox = new Float64Array(segs), oz = new Float64Array(segs);
  const ids = [];
  for (let i = 0; i < segs; i++) ids.push(skel.index[`seg${i}`]);
  const st = { head: 0, count: 0, ox: 0, oz: 0, cum: 0, amp: 0.5, init: false, coil: 0, lastYaw: 0 };

  function reset(yaw) {
    // straight line behind the head
    st.count = 0; st.head = 0; st.cum = 0; st.ox = 0; st.oz = 0;
    const bx = -Math.sin(yaw), bz = -Math.cos(yaw);
    const len = segs * seg + 0.5;
    const n = 64;
    for (let k = n; k >= 0; k--) {
      const d = (k / n) * len;
      push(bx * d, bz * d);
    }
    st.init = true;
  }
  function push(x, z) {
    if (st.count > 0) {
      const p = (st.head + N - 1) % N;
      st.cum += Math.hypot(x - hx[p], z - hz[p]);
    }
    hx[st.head] = x; hz[st.head] = z; hs[st.head] = st.cum;
    st.head = (st.head + 1) % N;
    if (st.count < N) st.count++;
  }

  function update(dt, player) {
    const c = core.c, b = pose.bones;
    const pl = player || {};
    const size = Math.max(0.05, Number(pl.displaySize) || Number(pl.size) || 1);
    const yaw = Number(pl.yaw) || 0;
    if (!st.init) reset(yaw);
    // odometry in unit space (body lengths)
    const vx = (Number(pl.vx) || 0) / size, vz = (Number(pl.vz) || 0) / size;
    let mx = vx * dt, mz = vz * dt;
    const step = Math.hypot(mx, mz);
    if (step > 1.5) { reset(yaw); mx = 0; mz = 0; }
    st.ox += mx; st.oz += mz;
    const last = (st.head + N - 1) % N;
    if (Math.hypot(st.ox - hx[last], st.oz - hz[last]) > seg * 0.25) push(st.ox, st.oz);
    st.amp = damp(st.amp, 0.35 + 0.65 * core.move, 2, dt);
    st.coil = damp(st.coil, clamp01(c.curl), 5, dt);

    // walk back along the path
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const wave = plan.wave;
    let k = last, prevX = st.ox, prevZ = st.oz;
    let dist = 0, target = 0;
    let idx = 0;
    let cumAtHead = st.cum + Math.hypot(st.ox - hx[last], st.oz - hz[last]);
    // segment 0 is at the head position
    while (idx < segs) {
      target = idx * seg;
      // advance along the polyline until we cover `target`
      let px = prevX, pz = prevZ, kk = k, d = dist, found = false;
      for (let guard = 0; guard < st.count; guard++) {
        const nx = hx[kk], nz = hz[kk];
        const l = Math.hypot(nx - px, nz - pz);
        if (d + l >= target) {
          const t = l > 1e-9 ? (target - d) / l : 0;
          const wx = px + (nx - px) * t, wz = pz + (nz - pz) * t;
          // world-ish -> local (head at origin, +Z forward, +X left)
          const dx = wx - st.ox, dz = wz - st.oz;
          sx[idx] = dx * cosY - dz * sinY;
          sz[idx] = dx * sinY + dz * cosY;
          sOff[idx] = cumAtHead - target;
          prevX = px; prevZ = pz; k = kk; dist = d; found = true;
          break;
        }
        d += l; px = nx; pz = nz;
        kk = (kk + N - 1) % N;
        if (kk === st.head) break;
      }
      if (!found) {
        // ran out of history: extend straight back
        const pi = Math.max(0, idx - 1);
        sx[idx] = idx > 1 ? sx[pi] + (sx[pi] - sx[pi - 1]) : 0;
        sz[idx] = idx > 1 ? sz[pi] + (sz[pi] - sz[pi - 1]) : -idx * seg;
      }
      idx++;
    }
    // lateral S-wave pinned to the ground, plus a breathing ripple when still
    const lam = wave.wavelength, amp = wave.amp * st.amp * (1 + (core.P.sleek || 0) * 0.2);
    for (let i = 0; i < segs; i++) {
      const ip = Math.max(0, i - 1), inx = Math.min(segs - 1, i + 1);
      let tx = sx[ip] - sx[inx], tz = sz[ip] - sz[inx];
      ox[i] = 0; oz[i] = 0;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const taper = clamp(i / 4, 0, 1) * (1 - 0.3 * i / segs);
      const phase = (sOff[i] / lam) * TAU;
      const off = amp * taper * Math.sin(phase) + 0.012 * (1 - core.move) * Math.sin(core.t * 1.4 - i * 0.45) * taper;
      // perpendicular (left of the tangent), applied after all tangents are known
      ox[i] = tz * off; oz[i] = -tx * off;
    }
    for (let i = 0; i < segs; i++) { sx[i] += ox[i]; sz[i] += oz[i]; }
    // follow-the-leader: keep every segment exactly one link from the one ahead
    for (let i = 1; i < segs; i++) {
      const dx = sx[i] - sx[i - 1], dz = sz[i] - sz[i - 1];
      const d = Math.hypot(dx, dz);
      if (d > 1e-6) { sx[i] = sx[i - 1] + dx / d * seg; sz[i] = sz[i - 1] + dz / d * seg; }
      else { sz[i] = sz[i - 1] - seg; sx[i] = sx[i - 1]; }
    }
    // coil: blend into a spiral around a point behind the head
    if (st.coil > 0.001) {
      const cz = -0.16;
      let ang = 0;
      for (let i = 0; i < segs; i++) {
        const r = 0.07 + 0.0055 * i;
        ang += seg / r;
        const qx = Math.sin(ang - 0.4) * r, qz = cz + Math.cos(ang - 0.4) * r;
        const w = st.coil * clamp((i - 1) / 3, 0, 1);
        sx[i] = lerp(sx[i], qx, w); sz[i] = lerp(sz[i], qz, w);
      }
    }
    // write segment bones: absolute local position (pose is offset from rest) and yaw
    const lift = clamp01(c.curl * 0.8 + Math.max(0, -core.headPitch.x) * 0.6 + c.rear);
    for (let i = 0; i < segs; i++) {
      const x = pose.list[ids[i]];
      const ip = Math.max(0, i - 1), inx = Math.min(segs - 1, i + 1);
      const fx = sx[ip] - sx[inx], fz = sz[ip] - sz[inx];
      x.px = sx[i];
      x.pz = sz[i] + i * seg;
      x.ry = Math.atan2(fx, fz);
      const up = lift * Math.max(0, 1 - i / 6) ** 1.5 * 0.16;
      x.py = up + core.c.hop * Math.max(0, 1 - i / 8);
      if (i < 6 && lift > 0) x.rx = -lift * 0.35 * (1 - i / 6);
      const gulpBulge = c.gulp > 0 ? Math.exp(-((i - (1 - c.gulp) * segs * 0.8) ** 2) / 4) * c.gulp * 0.35 : 0;
      x.sx = x.sy = 1 + gulpBulge + c.tremble * 0.02 * Math.sin(core.t * 40 + i);
      if (c.swim > 0) x.py -= c.swim * 0.04;
    }
    const head = b.head;
    head.rx = core.headPitch.x * 0.6 + (lift > 0 ? lift * 0.25 : 0);
    head.ry = core.headYaw.x * 0.5;
    head.rz = c.headRoll + c.shake * 0.4 * Math.sin(core.t * 26);
    head.sx = 1 + c.gulp * 0.12;
    // tongue flicks: a quick flutter now and then, always when tasting the air
    const flick = (core.t * 0.7) % 3 < 0.25 ? 1 : 0;
    c.tongue = Math.max(c.tongue, flick * (1 - core.move * 0.5));
    if (c.tongue > 0.01 && c.jaw < 0.15) c.jaw = 0.15;
    applyFace(core, pose, { jawMax: 0.5, tongueOut: 0.05, lidOpen: -1.2, lidShut: 1.45, lookScale: 0.3 });
    if (b.tongue) b.tongue.ry = 0.2 * Math.sin(core.t * 40);
    const sq = core.squash.x;
    b.root.sy = 1 + sq * 0.5;
    pose.fx.glow = clamp01(c.glow);
  }
  return { update, reset() { st.init = false; } };
}
