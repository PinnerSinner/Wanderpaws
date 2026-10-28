// Hopper meshes: the rabbit (pear body, huge ears, pom-pom, long feet, buck
// teeth) and the frog (wide flat body, bulging eyes on top, a big grin, a
// throat pouch, folded hind legs with webbed feet).

import { makeParts } from '../parts.js';

export function buildHopper(THREE, S, B, bones, plan, species, q) {
  const X = makeParts(THREE, S, B, bones, q);
  const { wp, w2, seg, ss, M4 } = X;
  const frog = !plan.ear;
  const body = wp('body'), hips = wp('hips'), chest = wp('chest'), head = wp('head');
  const hr = plan.headR;

  // torso
  const zBack = hips.z - (frog ? 0.13 : 0.15), zFront = chest.z + (frog ? 0.08 : 0.1);
  const torso = S.loft(zBack, zFront, (t) => {
    const a = Math.sin(Math.PI * t) ** 0.55;
    const z = zBack + (zFront - zBack) * t;
    const k = ss(hips.z, chest.z, z);
    if (frog) return { rx: (0.2 - 0.03 * k) * a, ry: 0.11 * a, cy: body.y + 0.01 * k, e: 2.3, ryLow: 0.12 * a };
    return { rx: (0.155 - 0.05 * k) * a, ry: (0.16 - 0.04 * k) * a, cy: body.y + 0.02 * k + 0.02 * (1 - k), e: 2 };
  }, seg(16), seg(18));
  B.add(torso, {
    bone: 'root', tag: 'body', weights: (w) => w2('hips', 'chest', ss(hips.z, chest.z, w.z)),
    region: (l, w, n) => (n.y < 0 ? ['base', 'belly', ss(0, -0.6, n.y)] : n.y > 0.5 ? ['base', 'secondary', ss(0.5, 1, n.y) * 0.6] : 'base'),
  });
  // neck fill (rabbit)
  if (!frog) {
    const g = S.ellipsoid(0.1, 0.11, 0.1, seg(12), seg(10));
    g.translate(0, body.y + 0.09, chest.z + 0.05);
    B.add(g, { bone: 'root', tag: 'neck', weights: (w) => w2('chest', 'head', ss(body.y + 0.05, body.y + 0.18, w.y) * 0.6), region: (l, w, n) => (n.z > 0.3 && n.y < 0.3 ? ['base', 'belly', 0.8] : 'base') });
  }

  // head
  {
    const g = frog
      ? S.blob(hr, seg(22), seg(14), (v, d) => { v.x *= 1.15; v.y *= 0.55; v.z *= 0.85; if (d.y < 0) v.y *= 0.8; })
      : S.blob(hr, seg(20), seg(16), (v, d) => { v.x *= 1.0; v.y *= 0.95; v.z *= 1.05; if (d.y < 0.1 && Math.abs(d.x) > 0.4) v.x *= 1.1; });
    B.add(g, {
      bone: 'head', tag: 'head',
      region: (l, w, n) => {
        if (frog) return n.y < -0.2 ? ['base', 'belly', ss(-0.2, -0.7, n.y)] : 'base';
        const ax = Math.abs(l.x) / hr, ly = l.y / hr, lz = l.z / hr;
        const cheek = Math.exp(-((ax - 0.55) ** 2 + (ly + 0.25) ** 2 + (lz - 0.6) ** 2) / 0.03);
        if (cheek > 0.05) return ['base', 'inner', cheek * 0.35];
        return n.y < -0.3 && lz > 0 ? ['base', 'belly', ss(-0.3, -0.8, n.y)] : 'base';
      },
    });
  }
  if (frog) {
    // eye domes on top so the eyes bulge out of the head
    for (const s of [1, -1]) {
      const g = S.ellipsoid(plan.eyeR * 1.15, plan.eyeR * 1.0, plan.eyeR * 1.1, seg(12), seg(10));
      g.translate(s * plan.eye[0], plan.eye[1] - plan.eyeR * 0.35, plan.eye[2] - 0.01);
      B.add(g, { bone: 'head', tag: 'face', region: 'base' });
    }
    // the grin: a dark curved line round the front of the head
    const grin = S.torus(hr * 0.95, 0.006, 4, seg(24), Math.PI * 0.75);
    grin.rotateX(Math.PI / 2); grin.rotateY(Math.PI * 0.125 + Math.PI / 2 - Math.PI * 0.75 / 2 + Math.PI * 0.375 - Math.PI / 2);
    grin.scale(1.13, 1, 0.84);
    grin.translate(0, -0.03, 0.005);
    B.add(grin, { bone: 'head', tag: 'face', region: 'mouth', pattern: false });
    // lower jaw (chin) on the jaw bone, mouth interior behind it
    const jaw = wp('jaw');
    const jg = S.blob(1, seg(16), seg(8), (v, d) => { v.set(d.x * hr * 1.05, d.y * 0.03, d.z * hr * 0.8); });
    jg.translate(0, -(jaw.y - head.y) - 0.035, -(jaw.z - head.z) + 0.01);
    B.add(jg, { bone: 'jaw', tag: 'face', region: (l, w, n) => (n.y < 0 ? 'belly' : 'mouth'), pattern: false });
    const tg = S.blob(1, 10, 6, (v, d) => { v.set(d.x * 0.03, d.y * 0.01, (d.z + 1) * 0.03); });
    B.add(tg, { bone: 'tongue', tag: 'face', region: 'tongue', pattern: false });
    // throat pouch
    const th = S.ellipsoid(0.07, 0.04, 0.065, seg(12), seg(8));
    B.add(th, { bone: 'throat', tag: 'face', region: 'belly', pattern: false });
    // nostrils
    for (const s of [1, -1]) {
      const n = S.ellipsoid(0.008, 0.006, 0.006, 6, 4);
      n.translate(s * 0.03, 0.02, hr * 0.84);
      B.add(n, { bone: 'head', tag: 'face', region: 'pupil', pattern: false });
    }
  } else {
    // muzzle puffs, pink nose, buck teeth
    for (const s of [1, -1]) {
      const g = S.ellipsoid(0.042, 0.035, 0.035, seg(12), seg(8));
      g.translate(s * 0.03, -0.045, hr * 0.88);
      B.add(g, { bone: 'head', tag: 'muzzle', region: 'belly' });
    }
    const nose = S.blob(0.018, 10, 8, (v, d) => { v.x *= 1.3 * (1 + 0.3 * d.y); v.y *= 0.8; });
    nose.translate(0, -0.012, hr * 1.02);
    B.add(nose, { bone: 'head', tag: 'face', region: 'nose', pattern: false });
    const jaw = wp('jaw');
    const jg = S.ellipsoid(0.04, 0.02, 0.03, seg(10), 6);
    jg.translate(0, -(jaw.y - head.y) - 0.07, -(jaw.z - head.z) + hr * 0.85);
    B.add(jg, { bone: 'jaw', tag: 'muzzle', region: 'belly' });
    for (const s of [1, -1]) {
      const t = S.superBox(0.009, 0.014, 0.004, 4, 8, 6);
      t.translate(s * 0.01, -0.075, hr * 0.97);
      B.add(t, { bone: 'head', tag: 'face', region: 'white', pattern: false });
    }
    const tg = S.ellipsoid(0.015, 0.006, 0.02, 8, 5);
    B.add(tg, { bone: 'tongue', tag: 'face', region: 'tongue', pattern: false });
  }
  for (const s of ['L', 'R']) X.eye(s, { r: plan.eyeR, outward: frog ? 0.4 : 0.55, up: frog ? 0.15 : 0.05, irisFrac: frog ? 0.9 : 0.86, pupilFrac: frog ? 0.55 : 0.68, pupil: frog ? 'bar' : 'round', lidRegion: 'base' });

  // ears (rabbit): long flattened tubes with pink insides
  if (plan.ear) {
    for (const s of ['L', 'R']) {
      const m = s === 'L' ? 1 : -1;
      const chain = `ear${s}`;
      const p0 = wp(`${chain}0`), p1 = wp(`${chain}Tip`);
      const dir = p1.clone().sub(p0).normalize();
      const len = p0.distanceTo(p1);
      const names = []; for (let i = 0; i < plan.ear.links; i++) names.push(`${chain}${i}`);
      const cw = X.chainWeights(names);
      const g = S.blob(1, seg(12), seg(14), (v, d) => {
        const t = (d.y + 1) / 2;
        const w = 0.05 * Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.85)) + 0.012;
        v.set(d.x * w, d.y * len * 0.52, d.z * w * 0.38);
      });
      const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.applyMatrix4(M4().makeRotationY(-m * 0.3));
      g.applyMatrix4(M4().makeRotationFromQuaternion(qq));
      const c = p0.clone().lerp(p1, 0.5);
      g.translate(c.x, c.y, c.z);
      B.add(g, {
        bone: 'root', tag: 'ear', weights: (w) => cw(Math.max(0, Math.min(1, w.clone().sub(p0).dot(dir) / len)) * plan.ear.links),
        region: (l, w, n) => { const u = w.clone().sub(p0).dot(dir) / len; if (n.z > 0.35) return ['base', 'inner', ss(0.35, 0.7, n.z) * 0.85]; return u > 0.75 ? ['base', 'tips', ss(0.75, 1, u)] : 'base'; },
      });
    }
  }

  // legs
  for (const k of ['FL', 'FR', 'HL', 'HR']) {
    const front = k[0] === 'F';
    const leg = front ? plan.front : plan.hind;
    const j = wp(`leg${k}`), kn = wp(`knee${k}`), ft = wp(`foot${k}`);
    const r0 = frog ? (front ? 0.025 : 0.045) : (front ? 0.03 : 0.05);
    const ug = S.limb([0, 0, 0], [0, kn.y - j.y, kn.z - j.z], r0, r0 * 0.75, seg(8), 2);
    B.add(ug, { bone: `leg${k}`, tag: 'leg', region: 'base' });
    const lg = S.limb([0, 0, 0], [0, ft.y - kn.y, ft.z - kn.z], r0 * 0.8, r0 * 0.6, seg(8), 2);
    B.add(lg, { bone: `knee${k}`, tag: 'leg', region: 'base' });
    if (!front) {
      // big haunch
      const par = 'hips';
      const hb = S.ellipsoid(frog ? 0.07 : 0.085, frog ? 0.06 : 0.105, frog ? 0.09 : 0.11, seg(12), seg(10));
      hb.translate(j.x * (frog ? 1.1 : 1.05) - hips.x, j.y - hips.y - 0.01, j.z - hips.z - 0.01);
      B.add(hb, { bone: par, tag: 'body', region: (l, w, n) => (n.y < -0.3 ? ['base', 'belly', 0.6] : 'base') });
    }
    // feet: rabbits have long flat hind feet, frogs webbed fans
    const fl = front ? 0.04 : (leg.footLen || 0.12);
    if (frog) {
      const fg = S.blob(1, seg(12), seg(6), (v, d) => { v.set(d.x * (front ? 0.03 : 0.05) * (1 + 0.5 * Math.max(0, d.z)), d.y * 0.012, d.z * fl * 0.5); });
      fg.translate(0, -0.01, fl * 0.4);
      B.add(fg, { bone: `foot${k}`, tag: 'paw', region: 'base' });
      for (let t = -1; t <= 1; t++) {
        const toe = S.ellipsoid(0.011, 0.009, 0.011, 6, 4);
        toe.translate(t * (front ? 0.022 : 0.038), -0.006, fl * 0.85 + (1 - Math.abs(t)) * 0.01);
        B.add(toe, { bone: `foot${k}`, tag: 'paw', region: 'belly', pattern: false });
      }
    } else {
      const fg = S.blob(1, seg(12), seg(8), (v, d) => { v.set(d.x * (front ? 0.03 : 0.04), d.y * (front ? 0.025 : 0.03), d.z * fl * 0.55); });
      fg.translate(0, -0.012, fl * (front ? 0.3 : 0.35));
      B.add(fg, { bone: `foot${k}`, tag: 'paw', region: (l, w, n) => (n.y < -0.3 ? ['base', 'belly', 0.6] : 'base') });
    }
  }
  // pom-pom tail
  if (plan.tail) {
    const t0 = wp('tail0');
    const g = S.blob(0.055, seg(12), seg(10), (v, d) => { v.multiplyScalar(1 + 0.08 * Math.sin(d.x * 9) * Math.sin(d.y * 9)); });
    g.translate(0, 0.02, -0.025);
    B.add(g, { bone: 'tail0', tag: 'tail', region: 'belly', pattern: false });
    void t0;
  }
  return {
    pattern: { eyeY: head.y + plan.eye[1], headZ: head.z + hr * 0.3, bodyTop: body.y + 0.15, zMin: zBack, zMax: zFront, bbox: [-0.3, 0, zBack - 0.1, 0.3, head.y + 0.45, head.z + 0.25] },
    attach: {
      head: { bone: 'head', pos: frog ? [0, hr * 0.5, -0.03] : [0, hr * 0.85, -0.03], scale: hr / 0.165 * (frog ? 1.1 : 1.05), tilt: frog ? 0 : -0.15 },
      face: { bone: 'head', pos: [0, plan.eye[1], plan.eye[2] + plan.eyeR * 0.95], scale: hr / 0.165, spread: plan.eye[0] },
      neck: { bone: frog ? 'head' : 'neck', pos: frog ? [0, -0.06, -0.02] : [0, -0.01, 0.0], scale: frog ? 1.25 : 0.85, tilt: frog ? 0 : Math.PI / 2 - plan.neckDir },
      back: { bone: 'body', pos: [0, frog ? 0.11 : 0.15, -0.04], scale: frog ? 0.9 : 0.8, len: zFront - zBack },
      badge: { bone: 'chest', pos: [0, frog ? -0.04 : -0.02, frog ? 0.07 : 0.1], scale: 0.8 },
    },
  };
}
