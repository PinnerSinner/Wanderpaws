// Tortoise mesh: a high domed shell with scute lines and a pale rim, a flat
// plastron, a wrinkly head on a long neck, stumpy elephant legs.

import { makeParts } from '../parts.js';

export function buildShelled(THREE, S, B, bones, plan, species, q) {
  const X = makeParts(THREE, S, B, bones, q);
  const { wp, seg, ss } = X;
  const body = wp('body'), head = wp('head');
  const R = plan.shellR, H = plan.shellH;
  // scute centres in direction space (a ring of six round a top plate)
  const cells = [[0, 1, 0]];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; cells.push([Math.sin(a) * 0.75, 0.55, Math.cos(a) * 0.75]); }
  for (let i = 0; i < 10; i++) { const a = ((i + 0.5) / 10) * Math.PI * 2; cells.push([Math.sin(a), 0.12, Math.cos(a)]); }
  const shell = S.blob(1, seg(26), seg(16), (v, d) => {
    const y = d.y;
    const up = y > 0 ? y : y * 0.12;
    const rr = R * (1 + 0.06 * Math.max(0, -y));
    v.set(d.x * rr, up * H + (y > 0 ? 0 : 0), d.z * rr * 1.08);
  });
  B.add(shell, {
    bone: 'body', tag: 'shell',
    region: (l, w, n) => {
      if (l.y < 0.005) return 'belly';
      const len = Math.hypot(l.x / R, l.y / H, l.z / (R * 1.08)) || 1;
      const dx = l.x / R / len, dy = l.y / H / len, dz = l.z / (R * 1.08) / len;
      let b1 = 9, b2 = 9;
      for (const c of cells) { const dd = (dx - c[0]) ** 2 + (dy - c[1]) ** 2 + (dz - c[2]) ** 2; if (dd < b1) { b2 = b1; b1 = dd; } else if (dd < b2) b2 = dd; }
      const edge = 1 - ss(0.0, 0.07, Math.sqrt(b2) - Math.sqrt(b1));
      if (l.y < H * 0.18) return ['base', 'tips', ss(H * 0.18, H * 0.05, l.y) * 0.9];
      return edge > 0.05 ? ['base', 'secondary', edge] : 'base';
    },
  });
  // neck tube and head (skin = tips colour)
  const nn = plan.neck.links;
  X.chainTube('neck', nn, (u) => 0.055 - 0.012 * u, { tag: 'neck', region: (l, w, n) => (n.y < -0.3 ? ['tips', 'belly', 0.6] : 'tips'), radial: 10, startAt: wp('neck0').clone().add(new THREE.Vector3(0, 0, -0.08)) });
  const hr = plan.headR;
  const hg = S.blob(hr, seg(16), seg(12), (v, d) => { v.z *= 1.25; v.y *= 0.85; if (d.z > 0.5) v.y -= 0.01 * d.z; });
  B.add(hg, { bone: 'head', tag: 'head', region: (l, w, n) => (n.y < -0.4 ? ['tips', 'belly', 0.5] : 'tips') });
  const jaw = wp('jaw');
  const jg = S.blob(1, seg(12), seg(6), (v, d) => { v.set(d.x * hr * 0.75, d.y * 0.02, d.z * hr * 0.95); });
  jg.translate(0, -(jaw.y - head.y) - 0.04, -(jaw.z - head.z) + 0.03);
  B.add(jg, { bone: 'jaw', tag: 'face', region: 'tips' });
  // a beaky smile line
  const smile = S.torus(hr * 0.9, 0.004, 4, seg(16), Math.PI * 0.5);
  smile.rotateX(Math.PI / 2); smile.rotateY(Math.PI * 0.25);
  smile.scale(0.85, 1, 1.18);
  smile.translate(0, -0.03, 0.0);
  B.add(smile, { bone: 'head', tag: 'face', region: 'mouth', pattern: false });
  for (const s of [1, -1]) { const ns = S.ellipsoid(0.005, 0.004, 0.004, 5, 4); ns.translate(s * 0.02, 0.015, hr * 1.22); B.add(ns, { bone: 'head', tag: 'face', region: 'pupil', pattern: false }); }
  for (const s of ['L', 'R']) X.eye(s, { r: plan.eyeR, outward: 0.6, up: 0.05, irisFrac: 0.8, pupilFrac: 0.72, lidRegion: 'tips' });
  // legs
  for (const k of ['FL', 'FR', 'HL', 'HR']) {
    const j = wp(`leg${k}`), kn = wp(`knee${k}`), ft = wp(`foot${k}`);
    const ug = S.limb([0, 0.03, 0], [0, kn.y - j.y, kn.z - j.z], 0.05, 0.045, seg(8), 2);
    B.add(ug, { bone: `leg${k}`, tag: 'leg', region: 'tips' });
    const lg = S.limb([0, 0, 0], [0, ft.y - kn.y, ft.z - kn.z], 0.045, 0.05, seg(8), 2);
    B.add(lg, { bone: `knee${k}`, tag: 'leg', region: 'tips' });
    const pg = S.ellipsoid(0.055, 0.025, 0.06, seg(10), 6);
    pg.translate(0, -0.02, 0.01);
    B.add(pg, { bone: `foot${k}`, tag: 'paw', region: 'tips' });
    for (let t = -1; t <= 1; t++) { const tn = S.ellipsoid(0.012, 0.01, 0.01, 5, 4); tn.translate(t * 0.025, -0.022, 0.06); B.add(tn, { bone: `foot${k}`, tag: 'paw', region: 'claw', pattern: false }); }
  }
  if (plan.tail) X.chainTube('tail', plan.tail.links, (u) => 0.03 * (1 - u * 0.8), { tag: 'tail', region: 'tips', radial: 8 });
  return {
    pattern: { eyeY: head.y + plan.eye[1], headZ: head.z, bodyTop: body.y + H, zMin: -R, zMax: R, bbox: [-R, 0, -R - 0.1, R, body.y + H + 0.05, R + 0.2] },
    attach: {
      head: { bone: 'head', pos: [0, hr * 0.8, -0.0], scale: hr / 0.165 * 1.1, tilt: 0 },
      face: { bone: 'head', pos: [0, plan.eye[1], plan.eye[2] + plan.eyeR * 0.9], scale: hr / 0.165 * 0.9, spread: plan.eye[0] },
      neck: { bone: 'neck1', pos: [0, 0, 0], scale: 0.6, tilt: 1.2 },
      back: { bone: 'body', pos: [0, H * 0.98, -0.02], scale: 1.1, len: R * 1.6 },
      badge: { bone: 'body', pos: [0, H * 0.35, R * 1.0], scale: 0.9 },
    },
  };
}
