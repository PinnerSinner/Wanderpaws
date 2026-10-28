// Waddler meshes: the penguin (upright egg, white tummy and face, flippers,
// orange beak and feet, coloured ear patches) and the duck (boat-shaped body,
// S-neck, round head, flat bill, folded wings, perky tail).

import { makeParts } from '../parts.js';

export function buildWaddler(THREE, S, B, bones, plan, species, q) {
  const X = makeParts(THREE, S, B, bones, q);
  const { wp, seg, ss, M4 } = X;
  const duck = !plan.upright;
  const body = wp('body'), head = wp('head');
  const hr = plan.headR;
  const R = plan.bodyR, Hh = plan.bodyH;

  if (!duck) {
    // upright egg, a touch wider low down, belly white on the front
    const g = S.blob(1, seg(22), seg(18), (v, d) => {
      const y = d.y;
      const w = R * (1 + 0.12 * (1 - y) * 0.5) * (y > 0.4 ? 1 - (y - 0.4) * 0.35 : 1);
      v.set(d.x * w, y * Hh * 0.5 + (y < 0 ? y * 0.02 : 0), d.z * w * 0.95);
    });
    g.translate(0, 0.0, 0);
    B.add(g, {
      bone: 'body', tag: 'body',
      region: (l, w, n) => {
        const front = n.z + 0.15 * Math.abs(n.x) * 0;
        const t = ss(0.05, 0.4, front) * (1 - ss(0.75, 0.95, n.y)) ;
        return t > 0.01 ? ['base', 'belly', t] : 'base';
      },
    });
  } else {
    const zB = -0.24, zF = 0.2;
    const g = S.loft(zB, zF, (t) => {
      const a = Math.sin(Math.PI * t) ** 0.6;
      return { rx: R * a * (1 - 0.15 * t), ry: R * 0.82 * a, cy: (t < 0.25 ? (0.25 - t) * 0.25 : 0), e: 2, ryLow: R * 0.95 * a };
    }, seg(16), seg(18));
    B.add(g, { bone: 'body', tag: 'body', region: (l, w, n) => (n.y < -0.1 ? ['base', 'belly', ss(-0.1, -0.6, n.y)] : 'base') });
  }

  // neck (duck): tube along the neck chain
  if (duck) {
    const n = plan.neck.links;
    const start = wp('neck0').clone().add(new THREE.Vector3(0, -0.06, -0.03));
    X.chainTube('neck', n, (u) => 0.085 - 0.02 * u, { tag: 'neck', region: (l, w, nn, i, gu) => ((gu ? gu[i] : 0) > 0.55 ? ['base', 'secondary', ss(0.55, 0.85, gu[i])] : 'base'), radial: 10, startAt: start });
  }

  // head
  {
    const g = S.blob(hr, seg(18), seg(14), (v, d) => { v.x *= duck ? 0.95 : 1.0; v.z *= duck ? 1.05 : 0.98; });
    B.add(g, {
      bone: 'head', tag: 'head',
      region: (l, w, n) => {
        if (duck) return 'secondary';
        // penguin: white face mask round the eyes, coloured patches behind
        const lz = l.z / hr, ly = l.y / hr, ax = Math.abs(l.x) / hr;
        const face = ss(0.0, 0.35, lz) * (1 - ss(0.35, 0.65, ly)) * ss(-0.75, -0.4, ly);
        const patch = Math.exp(-((ax - 0.8) ** 2 + (ly + 0.1) ** 2 + (lz + 0.15) ** 2) / 0.05);
        if (patch > 0.15) return ['base', 'tips', ss(0.15, 0.45, patch)];
        return face > 0.01 ? ['base', 'belly', face] : 'base';
      },
    });
  }
  // beak / bill
  {
    const jaw = wp('jaw');
    if (duck) {
      const up = S.blob(1, seg(14), seg(8), (v, d) => { v.set(d.x * 0.062 * (1 + 0.2 * Math.max(0, d.z)), d.y * 0.024, d.z * 0.09); });
      up.translate(0, -0.02, hr * 0.88 + 0.05);
      B.add(up, { bone: 'head', tag: 'face', region: 'nose', pattern: false });
      const lo = S.blob(1, seg(12), seg(6), (v, d) => { v.set(d.x * 0.055, d.y * 0.014, d.z * 0.08); });
      lo.translate(0, -(jaw.y - head.y) - 0.034, -(jaw.z - head.z) + hr * 0.9 + 0.035);
      B.add(lo, { bone: 'jaw', tag: 'face', region: 'nose', pattern: false });
      for (const s of [1, -1]) { const ns = S.ellipsoid(0.006, 0.004, 0.008, 6, 4); ns.translate(s * 0.018, 0.0, hr * 0.9 + 0.08); B.add(ns, { bone: 'head', tag: 'face', region: 'pupil', pattern: false }); }
    } else {
      const up = S.cone(0.04, 0.13, seg(10));
      up.rotateX(Math.PI / 2); up.scale(1, 0.75, 1);
      up.translate(0, -0.02, hr * 0.92 + 0.045);
      B.add(up, { bone: 'head', tag: 'face', region: 'nose', pattern: false });
      const lo = S.cone(0.028, 0.1, seg(8));
      lo.rotateX(Math.PI / 2); lo.scale(1, 0.6, 1);
      lo.translate(0, -(jaw.y - head.y) - 0.036, -(jaw.z - head.z) + hr * 0.9 + 0.02);
      B.add(lo, { bone: 'jaw', tag: 'face', region: 'nose', pattern: false });
      // rockhopper style crest uses the tips colour: small tufts over the eyes
      if (species.id === 'penguin') for (const s of [1, -1]) {
        const tuft = S.ellipsoid(0.03, 0.008, 0.012, 6, 4);
        tuft.rotateZ(s * 0.5); tuft.rotateY(s * 0.4);
        tuft.translate(s * 0.075, plan.eye[1] + 0.05, plan.eye[2] - 0.03);
        B.add(tuft, { bone: 'head', tag: 'face', region: 'tips', pattern: false });
      }
    }
  }
  for (const s of ['L', 'R']) X.eye(s, { r: plan.eyeR, outward: duck ? 0.75 : 0.42, up: 0.05, irisFrac: 0.82, pupilFrac: 0.7, lidRegion: duck ? 'secondary' : 'base', white: 'white' });

  // wings / flippers
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const chain = `wing${s}`;
    const n = plan.wing.links;
    const names = []; for (let i = 0; i < n; i++) names.push(`${chain}${i}`);
    const p0 = wp(`${chain}0`), p1 = wp(`${chain}Tip`);
    const dir = p1.clone().sub(p0).normalize();
    const len = p0.distanceTo(p1);
    const cw = X.chainWeights(names);
    const g = S.blob(1, seg(12), seg(10), (v, d) => {
      const t = (d.y + 1) / 2;
      const w = duck ? 0.09 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.8)) + 0.01 : 0.06 * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.2))) ;
      v.set(d.z * 0.018 * (duck ? 1.2 : 1), d.y * len * 0.55, -d.x * w);
    });
    // orient: local +Y along the wing, flat face outward
    const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyMatrix4(M4().makeRotationFromQuaternion(qq));
    const c = p0.clone().lerp(p1, 0.48);
    g.translate(c.x + m * (duck ? 0.0 : 0.01), c.y, c.z);
    B.add(g, {
      bone: 'root', tag: 'wing', weights: (w) => cw(Math.max(0, Math.min(1, w.clone().sub(p0).dot(dir) / len)) * n),
      u: (l, w) => Math.max(0, Math.min(1, w.clone().sub(p0).dot(dir) / len)),
      region: (l, w, nn) => (nn.x * m < -0.2 ? (duck ? 'base' : 'belly') : duck ? ['base', 'secondary', ss(0.5, 0.9, w.clone().sub(p0).dot(dir) / len) * 0.5] : 'base'),
    });
  }

  // legs and feet
  for (const k of ['L', 'R']) {
    const j = wp(`leg${k}`), kn = wp(`knee${k}`), ft = wp(`foot${k}`);
    const ug = S.limb([0, 0.02, 0], [0, kn.y - j.y, kn.z - j.z], 0.03, 0.022, seg(8), 2);
    B.add(ug, { bone: `leg${k}`, tag: 'leg', region: duck ? 'tips' : 'base' });
    const lg = S.limb([0, 0, 0], [0, ft.y - kn.y, ft.z - kn.z], 0.018, 0.016, seg(8), 2);
    B.add(lg, { bone: `knee${k}`, tag: 'leg', region: duck ? 'tips' : 'nose' });
    const fl = plan.leg.footLen;
    const fg = S.blob(1, seg(12), seg(6), (v, d) => { v.set(d.x * 0.055 * (1 + 0.6 * Math.max(0, d.z)), d.y * 0.014, d.z * fl * 0.5); });
    fg.translate(0, -0.015, fl * 0.38);
    B.add(fg, { bone: `foot${k}`, tag: 'paw', region: duck ? 'tips' : 'nose', pattern: false });
  }
  // tail
  if (plan.tail) {
    const n = plan.tail.links;
    X.chainTube('tail', n, (u) => (duck ? 0.06 * (1 - u * 0.7) : 0.045 * (1 - u * 0.5)), { tag: 'tail', region: 'base', radial: 8, squash: null });
  }
  return {
    pattern: { eyeY: head.y + plan.eye[1], headZ: head.z, bodyTop: body.y + (duck ? R : Hh * 0.5), zMin: -0.25, zMax: 0.25, bandsNeck: duck, bbox: [-0.3, 0, -0.35, 0.3, head.y + 0.25, head.z + 0.25] },
    attach: {
      head: { bone: 'head', pos: [0, hr * 0.85, -0.01], scale: hr / 0.165, tilt: 0 },
      face: { bone: 'head', pos: [0, plan.eye[1], plan.eye[2] + plan.eyeR * 0.9], scale: hr / 0.165 * (duck ? 0.9 : 1), spread: plan.eye[0] },
      neck: duck ? { bone: 'neck1', pos: [0, 0, 0], scale: 0.75, tilt: 0.2 } : { bone: 'body', pos: [0, Hh * 0.36, 0.0], scale: 1.35, tilt: 0 },
      back: { bone: 'body', pos: duck ? [0, R * 0.8, -0.04] : [0, 0.05, -R * 0.9], scale: duck ? 0.9 : 1.0, len: duck ? 0.4 : 0.35, upright: !duck },
      badge: { bone: 'body', pos: duck ? [0, 0.02, 0.2] : [0, Hh * 0.18, R * 0.95], scale: 0.9 },
    },
  };
}
