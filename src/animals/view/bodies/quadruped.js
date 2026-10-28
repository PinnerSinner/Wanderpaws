// Quadruped meshes: Oli (and the dog presets), cat, router-cat, capybara,
// red panda and elephant. Each is one skinned mesh built from primitives,
// with its silhouette tuned so it reads from any angle.

import { makeParts } from '../parts.js';

const STYLES = {
  oli: {
    torso: { hipR: 0.17, waistR: 0.16, chestR: 0.19, chestRy: 0.2, back: 0.0, len: [0.19, 0.16] },
    head: { sx: 1.06, sy: 0.97, sz: 1.0 },
    muzzle: { y: -0.05, z: 0.15, rx: 0.095, ry: 0.072, rz: 0.11, region: 'belly' },
    nose: { r: 0.037, y: -0.0, z: 0.255, sx: 1.3, sy: 0.82 },
    eye: { outward: 0.32, up: 0.05, irisFrac: 0.78, pupilFrac: 0.6 },
    brow: true, cheeks: 0.28,
    legs: { fu: [0.062, 0.054], fl: [0.051, 0.047], hu: [0.075, 0.054], hl: [0.05, 0.046], paw: [0.056, 0.036, 0.068], haunch: 0.11 },
    ear: 'floppy', tail: 'otter',
  },
  cat: {
    torso: { hipR: 0.13, waistR: 0.115, chestR: 0.14, chestRy: 0.15, len: [0.17, 0.15] },
    head: { sx: 1.12, sy: 0.95, sz: 0.95 },
    muzzle: { y: -0.05, z: 0.105, rx: 0.06, ry: 0.045, rz: 0.05, region: 'belly' },
    nose: { r: 0.018, y: -0.022, z: 0.153, sx: 1.4, sy: 0.9, tri: true },
    eye: { outward: 0.3, up: 0.05, irisFrac: 0.86, pupilFrac: 0.68, pupil: 'slit', irisTall: 1.05 },
    cheeks: 0.25, whiskers: true, fluffCheeks: true,
    legs: { fu: [0.042, 0.036], fl: [0.034, 0.031], hu: [0.055, 0.036], hl: [0.033, 0.03], paw: [0.04, 0.03, 0.05], haunch: 0.08 },
    ear: 'pointy', tail: 'thin',
  },
  capybara: {
    torso: { hipR: 0.2, waistR: 0.19, chestR: 0.19, chestRy: 0.19, len: [0.22, 0.17], e: 2.4 },
    head: { sx: 0.9, sy: 0.95, sz: 1.25, boxy: true },
    muzzle: { y: -0.03, z: 0.15, rx: 0.1, ry: 0.095, rz: 0.11, region: 'base', boxy: true },
    nose: { r: 0.05, y: 0.02, z: 0.255, sx: 1.3, sy: 0.65, nostrils: true, region: 'secondary' },
    eye: { outward: 0.85, up: 0.1, irisFrac: 0.85, pupilFrac: 0.7 },
    cheeks: 0.0,
    legs: { fu: [0.055, 0.05], fl: [0.048, 0.045], hu: [0.07, 0.05], hl: [0.048, 0.045], paw: [0.05, 0.03, 0.06], haunch: 0.12 },
    ear: 'round', tail: null,
  },
  redpanda: {
    torso: { hipR: 0.15, waistR: 0.14, chestR: 0.15, chestRy: 0.155, len: [0.18, 0.15] },
    head: { sx: 1.16, sy: 0.95, sz: 0.92 },
    muzzle: { y: -0.05, z: 0.12, rx: 0.065, ry: 0.05, rz: 0.06, region: 'tips' },
    nose: { r: 0.022, y: -0.02, z: 0.175, sx: 1.3, sy: 0.9 },
    eye: { outward: 0.34, up: 0.05, irisFrac: 0.85, pupilFrac: 0.6 },
    cheeks: 0.0, pandaFace: true, fluffCheeks: true,
    legs: { fu: [0.05, 0.045], fl: [0.042, 0.04], hu: [0.06, 0.045], hl: [0.042, 0.04], paw: [0.046, 0.032, 0.056], haunch: 0.09, region: 'secondary' },
    ear: 'roundbig', tail: 'fluffy',
  },
  elephant: {
    torso: { hipR: 0.22, waistR: 0.22, chestR: 0.235, chestRy: 0.24, len: [0.2, 0.2], e: 2.2 },
    head: { sx: 1.0, sy: 1.0, sz: 0.95, dome: true },
    muzzle: null, nose: null,
    eye: { outward: 0.6, up: 0.0, irisFrac: 0.8, pupilFrac: 0.65 },
    cheeks: 0.2, tusks: true,
    legs: { fu: [0.085, 0.08], fl: [0.078, 0.08], hu: [0.09, 0.08], hl: [0.078, 0.08], paw: [0.085, 0.04, 0.085], haunch: 0.14, toenails: true },
    ear: 'elephant', tail: 'rope',
  },
};
STYLES.routercat = { ...STYLES.cat, ear: 'antenna', router: true };

export function buildQuadruped(THREE, S, B, bones, plan, species, q) {
  const st = STYLES[species.id] || STYLES.oli;
  const X = makeParts(THREE, S, B, bones, q);
  const { wp, w2, seg, ss, M4 } = X;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const body = wp('body'), hips = wp('hips'), chest = wp('chest'), neck = wp('neck'), head = wp('head');
  const T = st.torso;
  const zBack = hips.z - T.len[0], zFront = chest.z + T.len[1];
  const bodyY = body.y;

  // --- torso: a loft, skinned hips -> chest, with a lighter belly and darker back
  const torso = S.loft(zBack, zFront, (t) => {
    const z = zBack + (zFront - zBack) * t;
    const a = Math.sin(Math.PI * Math.min(1, t)) ** 0.55;
    const k = ss(hips.z - 0.05, chest.z + 0.02, z);
    const r = (T.hipR + (T.chestR - T.hipR) * k) * (1 - 0.1 * Math.sin(Math.PI * k) * (1 - T.waistR / Math.max(T.hipR, T.chestR)) * 3);
    const ry = (T.hipR + ((T.chestRy || T.chestR) - T.hipR) * k);
    return { rx: r * a, ry: ry * a, cy: bodyY + 0.01 * k, e: T.e || 2, ryLow: ry * a * 1.04 };
  }, seg(18), seg(20));
  const wHC = (w) => { const t = ss(hips.z - 0.02, chest.z + 0.02, w.z); return w2('hips', 'chest', t); };
  const belly = (l, w, n) => {
    if (n.y < -0.05) return ['base', 'belly', ss(-0.05, -0.65, n.y)];
    if (n.y > 0.35) return ['base', 'secondary', ss(0.35, 0.95, n.y) * 0.8];
    return 'base';
  };
  B.add(torso, { bone: 'root', tag: 'body', region: belly, weights: wHC });
  // chest fluff / bib in front
  const bib = S.ellipsoid(T.chestR * 0.82, T.chestRy * 0.85, 0.09, seg(14), seg(10));
  bib.translate(0, bodyY - 0.01, zFront - 0.06);
  B.add(bib, { bone: 'chest', matrix: M4().makeTranslation(-chest.x, -chest.y, -chest.z), tag: 'body', region: (l, w, n) => ['base', 'belly', ss(0.2, -0.4, n.y) * 0.9 + 0.1] });

  // --- neck: tube chest -> head, skinned chest/neck/head
  {
    const a = V3(0, bodyY + 0.05, chest.z + 0.06), b2 = head.clone().add(V3(0, -0.03, -0.03));
    const nr = Math.min(T.chestR * 0.62, plan.headR * 0.7);
    const g = S.limb(a.toArray(), b2.toArray(), nr * 1.05, nr * 0.9, seg(12), 4);
    const len = a.distanceTo(b2);
    const dir = b2.clone().sub(a).normalize();
    B.add(g, {
      bone: 'root', tag: 'neck', region: (l, w, n) => (n.y < -0.2 ? ['base', 'belly', ss(-0.2, -0.7, n.y)] : 'base'),
      weights: (w) => {
        const u = Math.max(0, Math.min(1, w.clone().sub(a).dot(dir) / len));
        if (u < 0.5) return [X.idx('chest'), 1 - u * 2, X.idx('neck'), u * 2];
        return [X.idx('neck'), 1 - (u - 0.5) * 2, X.idx('head'), (u - 0.5) * 2];
      },
    });
  }

  // --- head
  const hr = plan.headR;
  const H = st.head;
  const toHead = M4().makeTranslation(0, 0, 0);
  {
    const g = st.head.boxy ? S.superBox(hr * H.sx, hr * H.sy, hr * H.sz, 3.2, seg(18), seg(14)) : S.blob(hr, seg(22), seg(18), (v, d) => {
      v.x *= H.sx; v.y *= H.sy; v.z *= H.sz;
      if (H.dome && d.y > 0) v.y *= 1 + 0.15 * d.y;
      // a slightly flatter face, rounder cheeks
      if (d.z > 0.2) v.z *= 0.95;
      if (st.fluffCheeks && d.y < 0.1 && Math.abs(d.x) > 0.5) { v.x *= 1.12; v.y -= 0.01; }
    });
    const ch = st.cheeks || 0;
    B.add(g, {
      bone: 'head', matrix: toHead, tag: 'head',
      region: (l, w, n) => {
        const ax = Math.abs(l.x) / hr, ly = l.y / hr, lz = l.z / hr;
        if (st.pandaFace) {
          // white muzzle cheeks and eyebrow dots, dark tear stripes are the base
          const cheek = Math.exp(-((ax - 0.55) ** 2 + (ly + 0.25) ** 2 + (lz - 0.55) ** 2) / 0.07);
          const brow = Math.exp(-((ax - 0.38) ** 2 + (ly - 0.55) ** 2 + (lz - 0.6) ** 2) / 0.018);
          const t = Math.min(1, cheek * 1.6 + brow * 1.4);
          if (t > 0.02) return ['base', 'tips', ss(0.25, 0.6, t)];
          return 'base';
        }
        if (ch > 0) {
          const cheek = Math.exp(-((ax - 0.62) ** 2 + (ly + 0.18) ** 2 + (lz - 0.62) ** 2) / 0.03);
          if (cheek > 0.05) return ['base', 'inner', cheek * ch];
        }
        if (n.y < -0.4 && lz > 0) return ['base', 'belly', ss(-0.4, -0.8, n.y) * 0.8];
        return 'base';
      },
    });
  }
  // muzzle
  if (st.muzzle) {
    const m = st.muzzle;
    const g = m.boxy ? S.superBox(m.rx, m.ry, m.rz, 3, seg(14), seg(10)) : S.blob(1, seg(16), seg(12), (v, d) => {
      v.set(d.x * m.rx, d.y * m.ry * (d.y < 0 ? 0.85 : 1), d.z * m.rz);
    });
    g.translate(0, m.y, m.z);
    B.add(g, { bone: 'head', tag: 'muzzle', region: (l, w, n) => (m.region === 'belly' ? ['base', 'belly', ss(0.0, 0.5, n.z) * 0.6 + ss(0.3, -0.5, n.y) * 0.4 + 0.3] : m.region) });
    // mouth interior, a dark wedge you see when the jaw opens
    const mi = S.ellipsoid(m.rx * 0.7, m.ry * 0.38, m.rz * 0.72, seg(10), seg(6));
    mi.translate(0, m.y - m.ry * 0.5, m.z - m.rz * 0.15);
    B.add(mi, { bone: 'head', tag: 'face', region: 'mouth', pattern: false });
    // lower jaw on the jaw bone
    const jw = wp('jaw');
    const jg = S.blob(1, seg(14), seg(8), (v, d) => { v.set(d.x * m.rx * 0.82, d.y * m.ry * 0.42, d.z * m.rz * 0.9); });
    const hj = head.clone(); // jaw local = head local - jaw offset
    jg.translate(0, m.y - m.ry * 0.62 - (jw.y - hj.y), m.z - (jw.z - hj.z) - 0.005);
    B.add(jg, { bone: 'jaw', tag: 'muzzle', region: m.region === 'belly' ? 'belly' : m.region });
    // tongue
    if (bones[X.idx('tongue')]) {
      const tg = S.blob(1, seg(10), seg(8), (v, d) => { v.set(d.x * m.rx * 0.48, d.y * 0.012 + (d.y > 0 ? 0 : -0.004), d.z * m.rz * 0.75); });
      tg.translate(0, 0.0, 0.0);
      B.add(tg, { bone: 'tongue', tag: 'face', region: 'tongue', pattern: false });
    }
  } else if (species.id === 'elephant') {
    // elephant: jaw is a little lip under the trunk root
    const jg = S.ellipsoid(0.07, 0.035, 0.06, seg(12), seg(8));
    jg.translate(0, -0.01, 0.03);
    B.add(jg, { bone: 'jaw', tag: 'face', region: 'base' });
    const mi = S.ellipsoid(0.055, 0.03, 0.05, seg(10), seg(6));
    mi.translate(0, -0.07, 0.13);
    B.add(mi, { bone: 'head', tag: 'face', region: 'mouth', pattern: false });
    const tg = S.ellipsoid(0.03, 0.01, 0.035, 8, 6);
    B.add(tg, { bone: 'tongue', tag: 'face', region: 'tongue', pattern: false });
  }
  // nose
  if (st.nose) {
    const n = st.nose;
    const g = n.tri ? S.blob(n.r, 10, 8, (v, d) => { v.x *= n.sx * (1 + 0.3 * d.y); v.y *= n.sy; v.z *= 0.8; }) : S.blob(n.r, seg(14), seg(10), (v, d) => { v.x *= n.sx; v.y *= n.sy * (d.y > 0 ? 1 : 0.9); v.z *= 0.85; });
    g.translate(0, (st.muzzle ? st.muzzle.y : 0) + n.y, n.z);
    B.add(g, { bone: 'head', tag: 'face', region: n.region || 'nose', pattern: false });
    if (n.nostrils) for (const s of [1, -1]) {
      const ns = S.ellipsoid(0.012, 0.016, 0.01, 8, 6);
      ns.translate(s * 0.03, (st.muzzle ? st.muzzle.y : 0) + n.y + 0.004, n.z + n.r * 0.75);
      B.add(ns, { bone: 'head', tag: 'face', region: 'pupil', pattern: false });
    }
  }
  // eyes
  const er = plan.eyeR;
  for (const s of ['L', 'R']) X.eye(s, { r: er, ...st.eye, lidRegion: 'base' });
  // brows: little expressive ridges
  if (st.brow) for (const s of [1, -1]) {
    const g = S.ellipsoid(er * 0.75, er * 0.22, er * 0.4, 10, 6);
    g.rotateZ(-s * 0.25);
    g.translate(s * plan.eye[0] * 1.05, plan.eye[1] + er * 1.15, plan.eye[2] - er * 0.1);
    B.add(g, { bone: 'head', tag: 'face', region: 'secondary', pattern: false });
  }
  // whiskers (cats): thin pale spokes
  if (st.whiskers) for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
    const y0 = st.muzzle.y - 0.005 - k * 0.012;
    const a = [s * 0.045, y0, st.muzzle.z + 0.02], b2 = [s * 0.16, y0 - 0.01 + (k - 1) * 0.02, st.muzzle.z - 0.01];
    B.add(S.limb(a, b2, 0.0028, 0.0018, 4, 1), { bone: 'head', tag: 'face', region: 'white', pattern: false });
  }
  // tusks
  if (st.tusks) for (const s of [1, -1]) {
    const pts = [[s * 0.07, -0.08, 0.12], [s * 0.085, -0.12, 0.17], [s * 0.08, -0.13, 0.22], [s * 0.06, -0.11, 0.255]];
    const g = S.tube(pts, [0.02, 0.017, 0.012, 0.006], 8, 2);
    B.add(g, { bone: 'head', tag: 'face', region: 'claw', pattern: false });
  }

  // --- ears
  buildEars(THREE, S, B, X, plan, st, hr);

  // --- legs
  const L = st.legs;
  const legReg = L.region || 'base';
  for (const k of ['FL', 'FR', 'HL', 'HR']) {
    const front = k[0] === 'F';
    const j = wp(`leg${k}`), kn = wp(`knee${k}`), ft = wp(`foot${k}`);
    const up = front ? L.fu : L.hu, lo = front ? L.fl : L.hl;
    const parent = front ? 'chest' : 'hips';
    // upper: blend into the body at the top
    const ug = S.limb([j.x, j.y + up[0] * 0.6, j.z].map((v, i) => v - [j.x, j.y, j.z][i]), [0, kn.y - j.y, kn.z - j.z], up[0], up[1], seg(8), 3);
    B.add(ug, {
      bone: `leg${k}`, tag: 'leg', region: legReg,
      weights: (w) => { const t = ss(j.y + 0.02, j.y - 0.07, w.y); return [X.idx(parent), 1 - t, X.idx(`leg${k}`), t]; },
    });
    // haunch / shoulder blob for chunky toy limbs
    const hb = S.ellipsoid(L.haunch * (front ? 0.72 : 0.62), L.haunch * (front ? 0.95 : 1.0), L.haunch * (front ? 0.8 : 1.05), seg(10), seg(8));
    hb.translate(j.x * 1.05 - (front ? chest.x : hips.x), j.y - (front ? chest.y : hips.y) - 0.005, j.z - (front ? chest.z : hips.z) + (front ? 0 : -0.01));
    B.add(hb, { bone: parent, tag: 'body', region: (l, w, n) => (n.y < -0.3 ? ['base', 'belly', 0.5] : (legReg === 'base' ? 'base' : ['base', legReg, ss(0.0, -0.4, n.y)])) });
    // lower
    const lg = S.limb([0, 0, 0], [0, ft.y - kn.y, ft.z - kn.z], lo[0], lo[1], seg(8), 2);
    B.add(lg, { bone: `knee${k}`, tag: 'leg', region: legReg });
    // paw
    const p = L.paw;
    const pg = S.blob(1, seg(12), seg(8), (v, d) => { v.set(d.x * p[0], d.y * p[1] * (d.y < 0 ? 0.6 : 1), d.z * p[2]); });
    pg.translate(0, -p[1] * 0.35, p[2] * 0.3);
    B.add(pg, { bone: `foot${k}`, tag: 'paw', region: legReg });
    if (L.toenails) for (let t = -1; t <= 1; t++) {
      const tn = S.ellipsoid(0.018, 0.014, 0.012, 8, 6);
      tn.translate(t * 0.035, -p[1] * 0.25, p[2] * 0.3 + p[2] * 0.85 * Math.cos(t * 0.5));
      B.add(tn, { bone: `foot${k}`, tag: 'paw', region: 'claw', pattern: false });
    } else {
      // toe beans: three little bumps on the front of each paw
      for (let t = -1; t <= 1; t++) {
        const tb = S.ellipsoid(p[0] * 0.33, p[1] * 0.42, p[0] * 0.33, 6, 4);
        tb.translate(t * p[0] * 0.55, -p[1] * 0.38, p[2] * 0.3 + p[2] * 0.82);
        B.add(tb, { bone: `foot${k}`, tag: 'paw', region: legReg });
      }
    }
  }

  // --- tail
  if (plan.tail && st.tail) {
    const n = plan.tail.links;
    const [t0, t1] = plan.tail.thick;
    let rf;
    if (st.tail === 'otter') rf = (u) => t0 * (1 - 0.6 * u) * (0.75 + 0.25 * Math.sin(Math.min(1, u * 3) * Math.PI / 2)) + 0.004;
    else if (st.tail === 'fluffy') rf = (u) => (t0 * 0.7 + (t0 - t0 * 0.7) * Math.sin(Math.PI * Math.min(1, u * 1.3 + 0.1))) * (u > 0.85 ? 1 - (u - 0.85) * 3 : 1) + 0.01;
    else if (st.tail === 'rope') rf = (u) => t0 * (1 - 0.5 * u) + (u > 0.85 ? (u - 0.85) * 0.25 : 0);
    else rf = (u) => t0 * (1 - 0.35 * u) + t1 * 0.1;
    const tipReg = (l, w, nn, i, gu) => { const u = gu ? gu[i] : 0; return u > 0.6 ? ['base', 'tips', ss(0.6, 0.9, u)] : 'base'; };
    X.chainTube('tail', n, rf, { tag: 'tail', region: tipReg, radial: st.tail === 'fluffy' ? 12 : 10 });
    if (st.tail === 'rope') { // tuft
      const tip = wp('tailTip');
      const g = S.ellipsoid(0.03, 0.03, 0.05, 8, 6);
      g.translate(tip.x, tip.y, tip.z);
      B.add(g, { bone: `tail${n - 1}`, matrix: M4().copy(bones[X.idx(`tail${n - 1}`)].matrixWorld).invert(), tag: 'tail', region: 'tips', pattern: false });
    }
  }
  // --- trunk
  if (plan.trunk) {
    const n = plan.trunk.links;
    const [t0, t1] = plan.trunk.thick;
    X.chainTube('trunk', n, (u) => t0 + (t1 - t0) * Math.pow(u, 0.8) + (u > 0.94 ? 0.006 : 0), { tag: 'muzzle', region: (l, w, nn, i, gu) => ((gu ? gu[i] : 0) > 0.96 ? ['base', 'secondary', 0.6] : 'base'), radial: 12, sub: 3 });
  }

  // --- router-cat extras: a tiny router saddle with an LED strip (glow is a separate mesh in the view)
  if (st.router) {
    const g = S.superBox(0.08, 0.025, 0.1, 5, 14, 10);
    g.translate(0, T.chestRy * 0.98, -0.02);
    B.add(g, { bone: 'body', tag: 'other', region: 'secondary', pattern: false });
  }

  // pattern context (where the face and back are, for markings)
  const bb = new THREE.Box3();
  return {
    pattern: {
      eyeY: head.y + plan.eye[1], headZ: head.z + hr * 0.4, bodyTop: bodyY + T.chestRy, zMin: zBack, zMax: zFront,
      bbox: [-0.3, 0, zBack - 0.4, 0.3, head.y + hr + 0.2, head.z + hr + 0.3],
    },
    attach: {
      head: { bone: 'head', pos: [0, hr * H.sy * 0.88, -0.01], scale: hr / 0.165, tilt: -0.1 },
      face: { bone: 'head', pos: [0, plan.eye[1] + 0.005, plan.eye[2] + er * 0.95], scale: hr / 0.165, spread: plan.eye[0] },
      neck: { bone: 'neck', pos: [0, 0.0, 0.01], scale: Math.min(T.chestR * 0.62, hr * 0.7) / 0.105, tilt: Math.PI / 2 - plan.neckDir },
      back: { bone: 'body', pos: [0, (T.chestRy + T.hipR) * 0.5 + 0.005, 0], scale: T.chestR / 0.185, len: zFront - zBack },
      badge: { bone: 'chest', pos: [0, -0.02, T.len[1] + 0.02], scale: T.chestR / 0.185 },
      tail: plan.tail ? { bone: 'tailTip' } : null,
    },
    bb,
  };
}

function buildEars(THREE, S, B, X, plan, st, hr) {
  if (!plan.ear) return;
  const { wp, seg, ss, M4 } = X;
  const kind = st.ear;
  const n = plan.ear.links;
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const chain = `ear${s}`;
    const names = []; for (let i = 0; i < n; i++) names.push(`${chain}${i}`);
    const p0 = wp(`${chain}0`), p1 = wp(`${chain}Tip`);
    const len = p0.distanceTo(p1);
    const dir = p1.clone().sub(p0).normalize();
    const cw = X.chainWeights(names);
    const along = (w) => Math.max(0, Math.min(1, w.clone().sub(p0).dot(dir) / len));
    const weights = (w) => cw(along(w) * n);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const place = (g, centreU, yaw = 0) => {
      g.applyMatrix4(M4().makeRotationY(yaw));
      g.applyMatrix4(M4().makeRotationFromQuaternion(q));
      const c = p0.clone().lerp(p1, centreU);
      g.translate(c.x, c.y, c.z);
      return g;
    };
    if (kind === 'floppy') {
      // a soft rounded flap, wider at the bottom, thin, facing outward
      const g = S.blob(1, seg(14), seg(12), (v, d) => {
        const yy = d.y; // -1 bottom (tip) .. +1 top (root) before orienting: we orient +Y along dir, so flip
        const tt = (1 - yy) / 2; // 0 at the root, 1 at the tip
        const width = 0.085 * (0.7 + 0.45 * Math.sin(Math.min(1, tt * 1.15) * Math.PI * 0.75));
        v.set(d.z * 0.022 + 0.012 * (1 - d.y * d.y), d.y * len * 0.56, -d.x * width);
        v.x += Math.abs(d.x) * 0.0;
      });
      // the blob's local Z is the flap width; orient so the flat face points outward (local X)
      place(g, 0.5, Math.PI / 2 * 0);
      B.add(g, { bone: 'root', tag: 'ear', weights, region: (l, w, nn) => { const out = nn.x * m; return out > 0.1 ? ['base', 'tips', ss(0.1, 0.6, out) * 0.85 + ss(0.4, 0.9, along(w)) * 0.15] : ['base', 'tips', ss(0.4, 1, along(w)) * 0.4]; } });
    } else if (kind === 'pointy') {
      const g = S.blob(1, 8, 8, (v, d) => {
        const t = (d.y + 1) / 2; // 0 at base, 1 at tip after orient
        const w = 0.052 * (1 - t) ** 0.9 + 0.004;
        v.set(d.x * w, d.y * len * 0.6, d.z * w * 0.42);
      });
      place(g, 0.4, -m * 0.25);
      B.add(g, { bone: 'root', tag: 'ear', weights, region: (l, w, nn) => (nn.z > 0.25 && Math.abs(nn.x) < 0.8 ? ['base', 'inner', ss(0.25, 0.7, nn.z) * 0.9] : ['base', 'tips', ss(0.65, 1, along(w)) * 0.5]) });
    } else if (kind === 'antenna') {
      const a = p0.toArray(), b = p1.toArray();
      B.add(S.limb(a, b, 0.012, 0.009, 6, 2), { bone: 'root', tag: 'ear', weights, region: 'secondary', pattern: false });
      const tip = S.ellipsoid(0.024, 0.024, 0.024, 10, 8);
      tip.translate(p1.x, p1.y, p1.z);
      B.add(tip, { bone: 'root', tag: 'ear', weights: () => [X.idx(names[n - 1]), 1], region: 'tips', pattern: false });
      // a little flat cat ear behind the antenna so it still reads as a cat
      const e2 = S.blob(1, 8, 8, (v, d) => { const t = (d.y + 1) / 2; const w = 0.045 * (1 - t) + 0.004; v.set(d.x * w, d.y * 0.05, d.z * w * 0.4); });
      e2.translate(0, 0.03, 0);
      const base = p0.clone();
      e2.applyMatrix4(M4().makeRotationZ(-m * 0.5));
      e2.translate(base.x - m * 0.01, base.y - 0.01, base.z - 0.02);
      B.add(e2, { bone: 'root', weights: () => [X.idx('head'), 1], tag: 'ear', region: 'base' });
    } else if (kind === 'round' || kind === 'roundbig') {
      const r = kind === 'roundbig' ? 0.062 : 0.032;
      const g = S.blob(1, seg(12), seg(10), (v, d) => { v.set(d.x * r, d.y * r * 1.05, d.z * r * 0.4); });
      place(g, 0.3, -m * 0.2);
      B.add(g, { bone: 'root', tag: 'ear', weights, region: (l, w, nn) => (kind === 'roundbig' ? (nn.z > 0.3 ? ['secondary', 'tips', 0] : ['base', 'tips', ss(0.55, 0.95, along(w)) + (nn.z < -0.5 ? 0 : 0.0)]) : (nn.z > 0.4 ? 'secondary' : 'base')) });
      if (kind === 'roundbig') { // white rim
        const rim = S.torus(r * 0.82, r * 0.18, 6, 16);
        place(rim, 0.3, -m * 0.2 + Math.PI / 2 * 0);
        B.add(rim, { bone: 'root', tag: 'ear', weights, region: 'tips', pattern: false });
      }
    } else if (kind === 'elephant') {
      const g = S.blob(1, seg(16), seg(12), (v, d) => {
        // a big flat fan, lobed at the bottom, along dir (the chain points sideways)
        v.set(d.z * 0.024, d.y * len * 0.6, -d.x * 0.17 * (1 + 0.2 * Math.max(0, -d.y)));
      });
      place(g, 0.45, 0);
      B.add(g, { bone: 'root', tag: 'ear', weights, region: (l, w, nn) => (nn.x * m < -0.45 ? ['base', 'inner', 0.55] : 'base') });
    }
  }
}
