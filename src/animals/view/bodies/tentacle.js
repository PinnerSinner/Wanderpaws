// Octopus mesh: a big round mantle, a soft head with huge eyes, and eight
// tapering arms with pale undersides and sucker dots.

import { makeParts } from '../parts.js';

export function buildTentacle(THREE, S, B, bones, plan, species, q) {
  const X = makeParts(THREE, S, B, bones, q);
  const { wp, seg, ss } = X;
  const body = wp('body');
  // mantle: a tall egg leaning back a little
  const mr = plan.mantleR, mh = plan.mantleH;
  const mg = S.blob(1, seg(22), seg(16), (v, d) => {
    v.set(d.x * mr * (1 - 0.1 * Math.max(0, d.y)), d.y * mh * 0.5, d.z * mr * 1.0);
    if (d.y < 0) v.y *= 0.7;
  });
  B.add(mg, { bone: 'mantle', tag: 'body', region: (l, w, n) => (n.y > 0.75 ? ['base', 'secondary', ss(0.75, 1, n.y) * 0.5] : 'base') });
  // head / skirt where the arms join
  const hg = S.blob(1, seg(20), seg(12), (v, d) => { v.set(d.x * 0.17, d.y * 0.11, d.z * 0.17); if (d.y < 0) v.y *= 0.6; });
  B.add(hg, { bone: 'head', tag: 'head', region: (l, w, n) => (n.y < -0.4 ? ['base', 'belly', 0.7] : 'base') });
  // little mouth (a siphon smile)
  const sm = S.torus(0.03, 0.006, 4, 10, Math.PI);
  sm.rotateZ(Math.PI); sm.translate(0, -0.015, 0.165);
  B.add(sm, { bone: 'head', tag: 'face', region: 'mouth', pattern: false });
  // jaw bone carries a tiny lip so the rig's jaw does something
  const lip = S.ellipsoid(0.025, 0.008, 0.012, 8, 4);
  B.add(lip, { bone: 'jaw', tag: 'face', region: 'secondary', pattern: false });
  for (const s of ['L', 'R']) X.eye(s, { r: plan.eyeR, outward: 0.5, up: 0.05, irisFrac: 0.85, pupilFrac: 0.6, pupil: 'bar', lidRegion: 'base' });
  // arms
  for (let k = 0; k < plan.arms; k++) {
    const names = []; for (let i = 0; i < plan.armLinks; i++) names.push(`arm${k}_${i}`);
    const [t0, t1] = plan.armThick;
    X.chainTube(`arm${k}`, plan.armLinks, (u) => t0 + (t1 - t0) * Math.pow(u, 0.85), {
      names, tip: `arm${k}Tip`, tag: 'arm', radial: 8, sub: 2, cap: 2,
      region: (l, w, nn, i, gu) => {
        const u = gu ? gu[i] : 0;
        if (nn.y < -0.3) {
          // sucker dots along the underside
          const dots = Math.sin(u * 60) > 0.55 ? 1 : 0;
          return dots ? 'tips' : ['base', 'belly', 0.85];
        }
        return u > 0.8 ? ['base', 'tips', ss(0.8, 1, u) * 0.6] : 'base';
      },
    });
  }
  return {
    pattern: { eyeY: body.y + plan.eye[1], headZ: plan.eye[2], bodyTop: body.y + plan.mantle[1] + mh * 0.5, zMin: -0.25, zMax: 0.25, bbox: [-0.6, 0, -0.6, 0.6, 0.7, 0.6] },
    attach: {
      head: { bone: 'mantle', pos: [0, mh * 0.48, 0], scale: 1.25, tilt: 0.1 },
      face: { bone: 'head', pos: [0, plan.eye[1], plan.eye[2] + plan.eyeR * 0.9], scale: 1.0, spread: plan.eye[0] },
      neck: { bone: 'head', pos: [0, 0.03, 0], scale: 1.55, tilt: 0 },
      back: { bone: 'mantle', pos: [0, 0.02, -mr * 0.95], scale: 0.9, len: 0.3, upright: true },
      badge: { bone: 'mantle', pos: [0, -0.02, mr * 0.98], scale: 0.9 },
    },
  };
}
