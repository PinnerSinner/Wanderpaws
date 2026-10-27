// Snake mesh: one long smoothly-skinned tube across every segment bone,
// tapering to a fine tail, a pale belly, banded markings, and a rounded
// head with a forked tongue and big friendly eyes.

import { makeParts } from '../parts.js';

export function buildSerpent(THREE, S, B, bones, plan, species, q) {
  const X = makeParts(THREE, S, B, bones, q);
  const { wp, seg, ss } = X;
  const n = plan.segs;
  const names = []; for (let i = 0; i < n; i++) names.push(`seg${i}`);
  const pts = [];
  const sub = 2;
  const P = names.map(wp);
  const last = P[n - 1].clone().add(new THREE.Vector3(0, 0, -plan.segLen));
  P.push(last);
  for (let i = 0; i < n; i++) for (let k = 0; k < sub; k++) pts.push(P[i].clone().lerp(P[i + 1], k / sub).toArray());
  pts.push(P[n].toArray());
  const R = plan.radius;
  const rad = pts.map((_, i) => { const u = i / (pts.length - 1); return R * (u < 0.06 ? 0.85 + u * 2.5 : Math.pow(1 - (u - 0.06) / 0.94, 0.75) * 1.0) + 0.006; });
  const g = S.tube(pts, rad, seg(12), 2);
  // flatten the tube a little (snakes are oval in section)
  g.scale(1.12, 0.85, 1);
  g.translate(0, -0.01, 0);
  const cw = X.chainWeights(names);
  B.add(g, {
    bone: 'root', tag: 'body',
    weights: (w, l, i, gu) => cw(Math.min(n - 0.001, (gu ? gu[i] : 0) * n)),
    region: (l, w, nn) => (nn.y < -0.25 ? ['base', 'belly', ss(-0.25, -0.6, nn.y)] : nn.y > 0.6 ? ['base', 'secondary', ss(0.6, 1, nn.y) * 0.5] : 'base'),
  });
  // head: a rounded wedge
  const hr = plan.headR;
  const hg = S.blob(hr, seg(18), seg(12), (v, d) => { v.x *= 1.0; v.y *= 0.62; v.z *= 1.3; if (d.z > 0) v.x *= 1 - 0.18 * d.z; });
  B.add(hg, { bone: 'head', tag: 'head', region: (l, w, nn) => (nn.y < -0.3 ? ['base', 'belly', ss(-0.3, -0.7, nn.y)] : 'base') });
  const jaw = wp('jaw'), head = wp('head');
  const jg = S.blob(1, seg(14), seg(6), (v, d) => { v.set(d.x * hr * 0.8 * (1 - 0.15 * Math.max(0, d.z)), d.y * 0.015, d.z * hr * 1.15); });
  jg.translate(0, -(jaw.y - head.y) - 0.035, -(jaw.z - head.z) + 0.02);
  B.add(jg, { bone: 'jaw', tag: 'face', region: (l, w, nn) => (nn.y < 0 ? 'belly' : 'mouth'), pattern: false });
  // forked tongue on the tongue bone (grows out along +Z)
  for (const s of [1, -1]) {
    const tg = S.limb([0, 0, 0], [s * 0.012, 0, 0.05], 0.005, 0.0025, 5, 1);
    tg.translate(0, 0, 0.0);
    B.add(tg, { bone: 'tongue', tag: 'face', region: 'tongue', pattern: false });
  }
  const stem = S.limb([0, 0, -0.04], [0, 0, 0.005], 0.006, 0.005, 5, 1);
  B.add(stem, { bone: 'tongue', tag: 'face', region: 'tongue', pattern: false });
  for (const s of [1, -1]) { const ns = S.ellipsoid(0.006, 0.004, 0.004, 5, 4); ns.translate(s * 0.025, 0.012, hr * 1.24); B.add(ns, { bone: 'head', tag: 'face', region: 'pupil', pattern: false }); }
  for (const s of ['L', 'R']) X.eye(s, { r: plan.eyeR, outward: 0.55, up: 0.15, irisFrac: 0.88, pupilFrac: 0.6, pupil: 'round', lidRegion: 'base' });
  return {
    pattern: { eyeY: head.y + plan.eye[1], headZ: head.z, bodyTop: plan.bodyY + R, zMin: -n * plan.segLen, zMax: 0, bandsBody: true, bbox: [-0.2, 0, -n * plan.segLen - 0.1, 0.2, 0.3, 0.3] },
    attach: {
      head: { bone: 'head', pos: [0, hr * 0.55, -0.01], scale: hr / 0.165 * 1.15, tilt: 0 },
      face: { bone: 'head', pos: [0, plan.eye[1], plan.eye[2] + plan.eyeR * 0.9], scale: hr / 0.165 * 0.95, spread: plan.eye[0] },
      neck: { bone: 'seg2', pos: [0, 0, 0], scale: 0.75, tilt: Math.PI / 2 },
      back: { bone: 'seg9', pos: [0, R * 0.85, 0], scale: 0.6, len: 0.3 },
      badge: { bone: 'seg3', pos: [0, R * 0.6, 0], scale: 0.7 },
    },
  };
}
