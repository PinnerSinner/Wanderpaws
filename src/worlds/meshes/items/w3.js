// Item builders: W3 Tijuca rainforest. Real metres, front faces +Z.
import { PI, TAU, crimp, lumpy, rgb, mixRgb, noise2, smooth } from '../util.js';

const C = {
  emerald: '#2fa36b', leaf: '#4cb85a', leafDk: '#2f8a4a', mango: '#ffb02e', mist: '#dff3ea', bark: '#8a5a3b',
  barkDk: '#6a4028', wood: '#b9824e', woodDk: '#8e5e34', rope: '#d9c08a', ink: '#2f2a33', red: '#e8473a',
  canvas: '#f2e2b8', yellow: '#ffd23f', khaki: '#9aa25a',
};

// a palm or fern frond: one tapered strip bent down along its length, with a
// darker midrib and zigzag leaflet colouring (crisp face colours)
function frond(b, x, y, z, yaw, len, droop, col, o = {}) {
  const width = o.width || len * 0.3, lift = o.lift ?? 0.5;
  b.plane(width, len, col, {
    x, y, z, ry: yaw, ws: 4, ds: o.n || 8, fc: true, layer: o.layer,
    df: (v) => {
      const t = (v.z + len / 2) / len; // 0 at the base, 1 at the tip
      const w = Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * (1 - 0.15 * t);
      v.x *= w;
      const a = lift - droop * t * t * 1.4;
      // integrate a gentle arc: height from the pitch profile
      const d = t * len;
      v.y = Math.sin(lift) * d - droop * len * t * t * t * 0.55 + Math.abs(v.x) * 0.25 * (o.cup ?? 1);
      v.z = Math.cos(a * 0.5) * d;
    },
    cf: (lx, ly, lz) => (Math.abs(lx) < width * 0.07 ? rgb(o.rib || '#8aa83a') : (Math.floor((lz + len) * (8 / len) * 1.5 + Math.abs(lx) * (6 / width)) % 2 ? rgb(col) : rgb(o.col2 || col))),
  });
}
export { frond };

export const w3 = {
  brazilnut(b) {
    const nut = (o) => b.cyl(0.011, 0.011, 0.045, '#8a5a34', {
      seg: 3, hs: 5, ...o,
      df: (v) => { const t = v.y / 0.0225; const k = Math.sqrt(Math.max(0.05, 1 - t * t)); v.x *= k; v.z *= k * (1 + 0.15 * t); },
      cf: (x, y, z) => mixRgb('#a06a3c', '#5a3418', smooth(-0.3, 0.6, noise2(x * 500, y * 300 + z * 500))),
    });
    nut({ y: 0.008, rz: PI / 2, rx: 0.5, ry: 0.3 });
    nut({ x: 0.012, y: 0.018, z: 0.01, rz: PI / 2 + 0.4, rx: 2.4, ry: -0.7 });
  },

  mango(b) {
    b.ball(0.055, C.mango, {
      y: 0.055, sx: 1.15, sy: 0.9, sz: 0.85, seg: 16, rz: 0.15,
      df: (v) => { v.y += 0.012 * Math.max(0, v.x / 0.06) ** 2; },
      cf: (x, y, z) => { const t = (x / 0.06 + y / 0.05) * 0.5; return t > 0.3 ? mixRgb('#ff7a3c', '#e8473a', smooth(0.3, 0.9, t)) : t < -0.4 ? mixRgb('#ffc23a', '#9ccc4a', smooth(-0.4, -0.9, t)) : rgb('#ffb02e'); },
    });
    b.cyl(0.004, 0.005, 0.02, '#6a4a2a', { x: 0.05, y: 0.115, rz: -0.4, seg: 5 });
    b.ball(0.03, C.leaf, { x: 0.03, y: 0.125, z: 0.01, sx: 1.4, sy: 0.12, sz: 0.5, rz: 0.25, ry: 0.5, seg: 8 });
  },

  acai(b) {
    b.lathe([[0, 0], [0.04, 0], [0.068, 0.03], [0.075, 0.06], [0.07, 0.062], [0.06, 0.035], [0, 0.03]], '#8a5a3c', { seg: 18, cf: (x, y) => (y > 0.058 ? rgb('#c49a6a') : rgb('#7a4a2c')) });
    b.dome(0.066, '#5a2a6a', { y: 0.05, sy: 0.4, seg: 16, df: lumpy(0.05, 80) });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; b.cyl(0.013, 0.013, 0.005, '#fff2c8', { x: Math.cos(a) * 0.035, y: 0.073, z: Math.sin(a) * 0.035, rx: 0.3 * Math.sin(a), rz: 0.3 * Math.cos(a), seg: 10 }); }
    for (let i = 0; i < 9; i++) { const a = i * 2.4; b.box(0.008, 0.006, 0.008, '#d8a050', { x: Math.cos(a) * 0.015 * (i % 3), y: 0.076, z: Math.sin(a) * 0.015 * (i % 3), ry: a }); }
    b.ball(0.007, '#e8473a', { x: 0.0, y: 0.078, z: 0.0, seg: 6 });
    b.rod([0.03, 0.07, -0.02], [0.08, 0.12, -0.05], 0.004, '#e9e2d6', { seg: 4 });
    b.ball(0.012, '#e9e2d6', { x: 0.025, y: 0.07, z: -0.018, sy: 0.35, sx: 1.4, seg: 6 });
  },

  binoculars(b) {
    const g = '#3f5a3a';
    for (const sx of [-1, 1]) {
      b.cyl(0.032, 0.032, 0.11, g, { x: sx * 0.04, y: 0.04, z: 0.0, rx: PI / 2, seg: 12 });
      b.cyl(0.036, 0.036, 0.03, '#2a2a30', { x: sx * 0.04, y: 0.04, z: 0.06, rx: PI / 2, seg: 12 });
      b.circle(0.028, '#6cc4f0', { x: sx * 0.04, y: 0.04, z: 0.076, rx: PI / 2, seg: 12, cf: (x, y, z, wx, wy) => (wy > 0.048 && Math.abs(wx - sx * 0.04 + 0.01) < 0.008 ? rgb('#e8f8ff') : rgb('#3a7ab0')) });
      b.cyl(0.02, 0.024, 0.03, '#2a2a30', { x: sx * 0.035, y: 0.045, z: -0.065, rx: PI / 2, seg: 10 });
    }
    b.box(0.05, 0.03, 0.06, '#2a2a30', { y: 0.06, z: -0.01, r: 0.01 });
    b.cyl(0.012, 0.012, 0.06, '#c8ccd2', { y: 0.078, z: -0.02, rz: PI / 2, seg: 8 });
    b.tube([[-0.07, 0.04, 0.02], [-0.1, 0.005, 0.07], [0.0, 0.004, 0.11], [0.1, 0.005, 0.07], [0.07, 0.04, 0.02]], 0.004, C.red, { ts: 20, rs: 4 });
  },

  bananas(b) {
    for (let i = 0; i < 5; i++) {
      const a = -0.6 + i * 0.3;
      const pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([Math.sin(a) * t * 0.2, 0.03 + Math.sin(t * PI) * 0.06 + t * 0.03 + (i % 2) * 0.02, Math.cos(a) * t * 0.2 - 0.08]); }
      b.tube(pts, 0.022, C.yellow, { ts: 12, rs: 6, cf: (x, y, z, wx, wy, wz) => (Math.hypot(wx, wz + 0.08) < 0.02 || Math.hypot(wx, wz + 0.08) > 0.19 ? rgb('#6a4a24') : mixRgb('#ffe066', '#c8d84a', smooth(0.06, 0.02, Math.hypot(wx, wz + 0.08)) * 0.6)) });
    }
    b.cyl(0.018, 0.02, 0.05, '#6a5a2a', { y: 0.04, z: -0.1, rx: -0.6, seg: 6 });
  },

  hikingboot(b) {
    b.box(0.11, 0.06, 0.28, '#3a3530', { y: 0.03, r: 0.025, rk: 2, cf: (x, y, z, wx, wy) => (wy > 0.035 ? rgb('#e8d6a8') : rgb('#3a3530')) });
    b.box(0.1, 0.09, 0.24, '#9a6038', { y: 0.1, z: 0.0, r: 0.04, rk: 2 });
    b.cyl(0.052, 0.058, 0.13, '#9a6038', { y: 0.17, z: -0.06, seg: 12 });
    b.torus(0.052, 0.014, '#c84a3a', { y: 0.235, z: -0.06, rx: PI / 2, rs: 5, ts: 12 });
    b.box(0.07, 0.06, 0.13, '#b87a48', { y: 0.15, z: 0.04, rx: 0.5, r: 0.02 });
    for (let i = 0; i < 4; i++) b.box(0.07, 0.008, 0.01, '#e8473a', { y: 0.135 + i * 0.024, z: 0.07 - i * 0.03, rx: 0.5 });
    b.tube([[0.02, 0.21, 0.0], [0.07, 0.19, 0.06], [0.09, 0.17, 0.1]], 0.004, '#e8473a', { ts: 6, rs: 4 });
  },

  bromeliad(b) {
    b.cyl(0.08, 0.1, 0.1, '#8a5a3a', { y: 0.05, seg: 10 });
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, inner = i >= 7;
      b.ball(0.12, '#3ea85a', {
        x: Math.sin(a) * 0.07, y: inner ? 0.2 : 0.16, z: Math.cos(a) * 0.07,
        sx: 0.28, sy: 0.05, sz: 1, ry: a, rx: inner ? -0.95 : -0.45, order: 'YXZ', seg: 8,
        df: (v) => { v.z += 0.12; v.y -= 0.25 * (v.z / 0.24) ** 2 * 0.12; },
        cf: (x, y, z, wx, wy) => (wy > 0.3 ? rgb('#ff5d8a') : mixRgb('#2f9a4a', '#7ad06a', smooth(0.12, 0.28, wy))),
      });
    }
    for (let i = 0; i < 5; i++) { const a = i * 1.26; b.cone(0.03, 0.14, '#ff4f7a', { x: Math.sin(a) * 0.025, y: 0.24, z: Math.cos(a) * 0.025, rx: Math.cos(a) * 0.35, rz: -Math.sin(a) * 0.35, seg: 5 }); }
    b.ball(0.028, '#ffd23f', { y: 0.31, seg: 8 });
  },

  jackfruit(b) {
    b.ball(0.2, '#9cc44a', {
      y: 0.19, sx: 0.85, sy: 0.95, sz: 1.15, seg: 18, rx: 0.2,
      df: (v) => { const k = 1 + 0.03 * Math.sin(v.x * 140) * Math.sin(v.y * 140) * Math.sin(v.z * 140 + 1); v.multiplyScalar(k); },
      cf: (x, y, z) => mixRgb('#b8d45a', '#6a9a3a', smooth(-0.5, 0.5, Math.sin(x * 140) * Math.sin(y * 140) * Math.sin(z * 140 + 1) * 2)),
    });
    b.cyl(0.02, 0.026, 0.08, '#6a5a2a', { y: 0.38, z: -0.18, rx: -0.7, seg: 6 });
  },

  rucksack(b) {
    const col = '#e8733a';
    b.box(0.38, 0.5, 0.26, col, { y: 0.26, r: 0.09, rk: 2 });
    b.box(0.3, 0.2, 0.1, '#c95a2a', { y: 0.2, z: 0.15, r: 0.04 });
    b.box(0.4, 0.14, 0.28, '#2f8a6a', { y: 0.5, z: 0.01, r: 0.06, rx: 0.1 }); // lid
    b.box(0.05, 0.03, 0.02, '#ffd23f', { y: 0.47, z: 0.15 });
    for (const sx of [-1, 1]) {
      b.box(0.06, 0.22, 0.12, '#c95a2a', { x: sx * 0.21, y: 0.22, r: 0.03 });
      b.tube([[sx * 0.12, 0.48, -0.13], [sx * 0.14, 0.3, -0.2], [sx * 0.13, 0.08, -0.14]], 0.022, '#3a3a40', { ts: 8, rs: 4 });
    }
    b.cyl(0.07, 0.07, 0.36, '#4fa0d8', { y: 0.6, z: -0.02, rz: PI / 2, seg: 10 }); // bedroll
    b.cyl(0.03, 0.03, 0.12, '#b8c4cc', { x: 0.2, y: 0.38, z: 0.02, seg: 8 }); // bottle
  },

  lilyflower(b) {
    b.cyl(0.15, 0.15, 0.012, '#4cae4a', {
      y: 0.006, seg: 22, tl: TAU * 0.92, ts: 0.2,
      cf: (x, y, z, wx, wy) => (wy > 0.004 ? mixRgb('#6ec85a', '#3f9a42', smooth(0.04, 0.14, Math.hypot(x, z))) : rgb('#2f7a3a')),
    });
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 6 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring * 0.3;
        b.ball(0.04 - ring * 0.008, ring ? '#ffd0e0' : '#ff8fb8', { x: Math.cos(a) * (0.04 - ring * 0.02), y: 0.05 + ring * 0.02, z: Math.sin(a) * (0.04 - ring * 0.02), sx: 0.45, sz: 1, sy: 0.3, ry: -a, rx: 0, rz: (0.7 + ring * 0.4) * 1, order: 'YXZ', seg: 8, cf: (x, y, z, wx, wy) => mixRgb('#fff0f5', ring ? '#ffd0e0' : '#ff7aa8', smooth(0.04, 0.09, wy)) });
      }
    }
    b.ball(0.018, '#ffd23f', { y: 0.075, seg: 8 });
  },

  paddle(b) {
    b.cyl(0.018, 0.018, 1.4, '#e9e2d6', { y: 0.05, rz: PI / 2, seg: 8, cf: (x, y) => (Math.abs(y) < 0.18 ? rgb('#3a3a40') : rgb('#e9e2d6')) });
    for (const sx of [-1, 1]) {
      b.ball(0.2, '#ffb02e', { x: sx * 0.78, y: 0.05, sx: 1.1, sy: 0.06, sz: 0.48, ry: sx * 0.1, seg: 12, cf: (x, y, z) => (Math.abs(z) < 0.015 ? rgb('#3a3a40') : rgb(sx > 0 ? '#ffb02e' : '#3cc0c8')) });
    }
  },

  treestump(b) {
    b.cyl(0.55, 0.62, 0.7, C.bark, {
      y: 0.35, seg: 16, df: (v) => { const th = Math.atan2(v.z, v.x); v.x *= 1 + 0.06 * Math.sin(th * 5); v.z *= 1 + 0.06 * Math.sin(th * 5); },
      cf: (x, y, z, wx, wy, wz, nx, ny) => (ny > 0.9 ? mixRgb('#f2d8a4', '#c8985a', (Math.sin(Math.hypot(x, z) * 60) + 1) * 0.35 + smooth(0.4, 0.55, Math.hypot(x, z))) : mixRgb('#8a5a3b', '#6a4028', smooth(-0.3, 0.3, Math.sin(Math.atan2(z, x) * 22)))),
    });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.4; b.capsule(0.13, 0.4, C.bark, { x: Math.cos(a) * 0.6, y: 0.08, z: Math.sin(a) * 0.6, rz: Math.cos(a) * 1.25, rx: -Math.sin(a) * 1.25, seg: 7, sx: 1, cf: () => rgb('#7a4a30') }); }
    // moss and a red-capped toadstool family
    b.ball(0.2, '#6ab84a', { x: -0.3, y: 0.5, z: 0.35, sy: 0.35, seg: 8, df: lumpy(0.2, 10) });
    for (const [x, z, s] of [[0.5, 0.45, 1], [0.62, 0.3, 0.7]]) {
      b.cyl(0.03 * s, 0.035 * s, 0.14 * s, '#fff6e6', { x, y: 0.07 * s, z, seg: 6 });
      b.dome(0.09 * s, '#e8473a', { x, y: 0.13 * s, z, sy: 0.7, seg: 10, cf: (x2, y2, z2) => (Math.sin(x2 * 200) * Math.sin(z2 * 200) > 0.6 ? rgb('#ffffff') : rgb('#e8473a')) });
    }
  },

  signpost(b) {
    b.cyl(0.07, 0.08, 2.0, C.woodDk, { y: 1.0, seg: 8 });
    b.cone(0.16, 0.14, '#3f8a4a', { y: 2.07, seg: 4, ry: PI / 4 });
    const arrows = [[1.6, 0.4, '#ffd23f'], [1.25, -0.5, '#ff7a59'], [0.9, 2.6, '#7fd0e8']];
    for (const [y, ry, col] of arrows) {
      b.extrude([[0, -0.11], [0.62, -0.11], [0.78, 0], [0.62, 0.11], [0, 0.11], [0.06, 0]], 0.05, col, { y, ry, bevel: 0.01 });
      for (let i = 0; i < 3; i++) b.box(0.08, 0.025, 0.06, '#5a3a24', { x: Math.cos(ry) * (0.2 + i * 0.13), y, z: -Math.sin(ry) * (0.2 + i * 0.13), ry });
    }
    b.ball(0.18, '#5ab04a', { x: 0.15, y: 0.1, z: 0.1, sy: 0.6, seg: 8 });
  },

  picnictable(b) {
    const w = C.wood;
    for (let i = 0; i < 5; i++) b.box(1.9, 0.05, 0.15, i % 2 ? w : '#c8925a', { y: 0.76, z: -0.32 + i * 0.16, r: 0.015 });
    for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) b.box(1.9, 0.05, 0.14, '#c8925a', { y: 0.45, z: sz * (0.62 + i * 0.15), r: 0.015 });
    for (const sx of [-0.75, 0.75]) {
      b.box(0.08, 0.06, 1.75, C.woodDk, { x: sx, y: 0.4, r: 0.02 });
      b.box(0.08, 0.85, 0.08, C.woodDk, { x: sx, y: 0.38, z: 0.35, rx: 0.5, r: 0.02 });
      b.box(0.08, 0.85, 0.08, C.woodDk, { x: sx, y: 0.38, z: -0.35, rx: -0.5, r: 0.02 });
    }
    // a gingham cloth and a basket
    b.box(0.7, 0.012, 0.6, '#ff7a7a', { y: 0.79, fc: true, cf: (x, y, z) => ((Math.floor((x + 1) * 12) + Math.floor((z + 1) * 12)) % 2 ? rgb('#ffffff') : rgb('#ff7a7a')) });
    b.box(0.36, 0.2, 0.26, '#d8a860', { y: 0.9, r: 0.03 });
    b.torus(0.14, 0.015, '#b8884a', { y: 1.0, arc: PI, rs: 4, ts: 10 });
  },

  hammock(b) {
    const wood = C.woodDk;
    // free-standing curved stand
    const arc = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1; arc.push([t * 1.1, 0.12 + (t * t) * 1.0, 0]); }
    b.tube(arc, 0.05, wood, { ts: 30, rs: 6 });
    for (const sx of [-1, 1]) b.box(0.12, 0.08, 0.9, wood, { x: sx * 0.75, y: 0.04, r: 0.03 });
    b.box(0.12, 0.1, 0.12, wood, { y: 0.1, r: 0.03 });
    const stripes = ['#ff7a59', '#ffd23f', '#3cc0c8', '#fffaf0'];
    b.plane(1.6, 0.8, '#ff7a59', {
      y: 0.62, ws: 16, ds: 8, fc: true,
      df: (v) => { const t = v.x / 0.8; v.y += 0.45 * t * t - 0.0; v.y += 0.18 * (v.z / 0.4) ** 2 * (1 - t * t); v.z *= 1 - 0.75 * t * t; },
      cf: (x) => rgb(stripes[Math.floor((x + 0.8) * 6) % 4]),
    });
    for (const sx of [-1, 1]) b.rod([sx * 0.8, 1.07, 0], [sx * 1.08, 1.2, 0], 0.012, C.rope, { seg: 4 });
    b.ball(0.16, '#ffffff', { x: -0.35, y: 0.62, sx: 1.3, sy: 0.5, seg: 8 }); // pillow
  },

  tent(b) {
    const sh = [[-1.0, 0], [1.0, 0], [0.05, 1.5], [-0.05, 1.5]];
    b.extrude(sh, 2.2, '#ff9a3c', { y: 0, ry: PI / 2, cf: (x, y, z, wx, wy, wz) => (wz > 1.05 && Math.abs(wx) < 0.45 && wy < 1.1 - Math.abs(wx) ? rgb('#c8602a') : rgb('#ff9a3c')) });
    b.box(2.25, 0.08, 0.12, '#ffd23f', { y: 1.5, r: 0.03 });
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.rod([sx * 1.1, 0.0, sz * 1.0], [sx * 0.2, 1.45, sz * 1.0], 0.008, '#e9e2d6', { seg: 3 });
    b.box(2.6, 0.02, 2.6, '#8ac850', { y: 0.01, r: 0.01 }); // groundsheet
    b.ball(0.18, '#3cc0c8', { x: 0.2, y: 0.12, z: 1.25, sy: 0.6, sx: 1.3, seg: 8 }); // sleeping bag peeking out
  },

  kayak(b) {
    b.ball(1, '#ff5d5d', {
      y: 0.24, sx: 0.36, sy: 0.24, sz: 1.6, seg: 18, hseg: 10,
      df: (v) => { v.x *= 1 - 0.75 * Math.abs(v.z) ** 2; v.y += 0.08 * v.z * v.z; },
      cf: (x, y, z, wx, wy) => (Math.abs(wy - 0.24) < 0.03 ? rgb('#ffd23f') : wy > 0.24 ? rgb('#ff5d5d') : rgb('#e84040')),
    });
    b.torus(0.25, 0.04, '#2a2a30', { y: 0.47, z: -0.1, rx: PI / 2, sx: 1, sy: 1.6, rs: 5, ts: 16 });
    b.ball(0.24, '#2a2a30', { y: 0.42, z: -0.1, sx: 1, sz: 1.5, sy: 0.15, seg: 12 });
    b.box(0.3, 0.02, 0.3, '#fffaf0', { y: 0.49, z: 0.7, r: 0.01 }); // bungee pad
    for (let i = 0; i < 3; i++) b.box(0.42, 0.012, 0.012, '#2a2a30', { y: 0.5, z: 0.58 + i * 0.12 });
  },

  boulder(b) {
    b.dodeca(1.5, '#9a9a94', {
      y: 1.1, sy: 0.82, sx: 1.15, detail: 1, df: lumpy(0.14, 0.9, 3),
      cf: (x, y, z, wx, wy, wz, nx, ny) => (ny > 0.55 ? mixRgb('#7ab84a', '#5a9a3a', noise2(wx * 2, wz * 2) * 0.5 + 0.5) : mixRgb('#a8a8a0', '#7a7a76', smooth(-0.5, 0.6, noise2(wx * 3, wy * 3 + wz)))),
    });
    b.dodeca(0.6, '#8a8a84', { x: 1.5, y: 0.35, z: 0.5, detail: 1, df: lumpy(0.15, 2, 9) });
    b.ball(0.35, '#5aa04a', { x: -1.3, y: 0.2, z: 0.8, sy: 0.6, seg: 8, df: lumpy(0.2, 3) });
  },

  jeep(b) {
    const body = '#5a8a3a', bodyDk = '#4a7230';
    b.box(1.8, 0.7, 3.8, body, { y: 0.85, r: 0.12, rk: 2, cf: (x, y, z, wx, wy) => (wy < 0.62 ? rgb(bodyDk) : rgb(body)) });
    b.box(1.82, 0.12, 1.25, body, { y: 1.26, z: 1.25, r: 0.05 }); // bonnet
    b.box(1.7, 0.12, 0.12, '#2a2a30', { y: 0.5, z: 1.95, r: 0.04 });
    b.box(1.2, 0.42, 0.06, '#3a3a40', { y: 0.95, z: 1.92, cf: (x, y, z, wx) => (Math.floor((wx + 1) * 12) % 2 ? rgb('#2a2a30') : rgb('#5a5a60')) });
    for (const sx of [-0.68, 0.68]) b.cyl(0.13, 0.13, 0.06, '#fff6c0', { x: sx, y: 1.05, z: 1.92, rx: PI / 2, seg: 10, layer: 'glow' });
    // windscreen frame and roll bar
    b.box(1.7, 0.6, 0.06, '#a8d8ea', { y: 1.6, z: 0.55, rx: -0.15, r: 0.03, cf: (x, y) => (Math.abs(y) > 0.24 || Math.abs(x) > 0.8 ? rgb(body) : rgb('#a8d8ea')) });
    b.tube([[-0.82, 1.2, -0.4], [-0.82, 2.0, -0.4], [0.82, 2.0, -0.4], [0.82, 1.2, -0.4]], 0.05, '#2a2a30', { ts: 20, rs: 6, tension: 0.1 });
    // seats
    for (const sx of [-0.45, 0.45]) {
      b.box(0.6, 0.18, 0.55, '#d8b47a', { x: sx, y: 1.28, z: 0.05, r: 0.06 });
      b.box(0.6, 0.6, 0.15, '#d8b47a', { x: sx, y: 1.6, z: -0.2, r: 0.06 });
    }
    b.box(1.6, 0.18, 0.55, '#d8b47a', { y: 1.28, z: -1.1, r: 0.06 });
    // wheels and spare
    for (const sx of [-0.92, 0.92]) for (const sz of [-1.25, 1.25]) {
      b.cyl(0.46, 0.46, 0.36, '#2a2a30', { x: sx, y: 0.46, z: sz, rz: PI / 2, seg: 12 });
      b.cyl(0.22, 0.22, 0.38, '#d8dde2', { x: sx, y: 0.46, z: sz, rz: PI / 2, seg: 8 });
    }
    b.cyl(0.42, 0.42, 0.3, '#2a2a30', { y: 1.0, z: -2.05, rx: PI / 2, seg: 12 });
    b.cyl(0.2, 0.2, 0.32, '#e8b83a', { y: 1.0, z: -2.05, rx: PI / 2, seg: 8 });
    b.box(0.12, 0.6, 0.12, '#2a2a30', { x: 0.95, y: 1.4, z: 0.8 }); // snorkel
  },

  cablecar(b) {
    const red = '#e8473a';
    b.box(2.4, 2.0, 2.4, red, { y: 1.0, r: 0.35, rk: 2 });
    b.box(2.52, 0.78, 2.52, '#bfe8f4', { y: 1.38, r: 0.4, rk: 2, cf: (x, y, z, wx, wy) => (wy > 1.5 ? rgb('#e4f7fc') : rgb('#a8dcec')) });
    for (let f = 0; f < 4; f++) {
      const a = (f * PI) / 2;
      for (let k = -1; k <= 1; k += 2) b.box(0.08, 0.82, 0.04, red, { x: Math.sin(a) * 1.21 + Math.cos(a) * k * 0.35, y: 1.35, z: Math.cos(a) * 1.21 - Math.sin(a) * k * 0.35, ry: a });
    }
    b.box(2.3, 0.18, 2.3, '#fbf8f0', { y: 2.06, r: 0.08 });
    b.cyl(0.08, 0.08, 1.0, '#5a5f66', { y: 2.6, seg: 8 });
    b.box(1.0, 0.25, 0.3, '#5a5f66', { y: 3.15, r: 0.06 });
    for (const sx of [-0.35, 0.35]) b.cyl(0.18, 0.18, 0.12, '#2a2a30', { x: sx, y: 3.35, rx: PI / 2, seg: 10 });
    b.cyl(0.04, 0.04, 1.6, '#3a3a40', { y: 3.48, rz: PI / 2, seg: 5 });
  },

  bridgesection(b) {
    for (let i = 0; i < 13; i++) b.box(1.3, 0.07, 0.36, i % 3 ? C.wood : '#a8743e', { x: -2.7 + i * 0.45, y: 0.2 + Math.sin((i / 12) * PI) * -0.0, ry: PI / 2 + (i % 2 ? 0.04 : -0.03), r: 0.02 });
    for (const sz of [-0.62, 0.62]) {
      b.rod([-2.9, 0.2, sz], [2.9, 0.2, sz], 0.04, C.rope, { seg: 5 });
      const rail = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; rail.push([-2.9 + t * 5.8, 1.15 - Math.sin(t * PI) * 0.25, sz]); }
      b.tube(rail, 0.045, C.rope, { ts: 24, rs: 5 });
      for (let i = 1; i < 10; i++) { const t = i / 10; b.rod([-2.9 + t * 5.8, 0.2, sz], [-2.9 + t * 5.8, 1.15 - Math.sin(t * PI) * 0.25, sz], 0.015, C.rope, { seg: 3 }); }
      for (const sx of [-2.95, 2.95]) { b.cyl(0.1, 0.12, 1.5, C.woodDk, { x: sx, y: 0.75, z: sz, seg: 7 }); b.ball(0.12, C.woodDk, { x: sx, y: 1.5, z: sz, seg: 6 }); }
    }
  },

  lookouthut(b) {
    const wood = C.wood, dk = C.woodDk;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.18, 0.22, 3.2, dk, { x: sx * 2.3, y: 1.6, z: sz * 2.0, seg: 7 });
    for (const sx of [-1, 1]) b.rod([sx * 2.3, 0.2, -2.0], [sx * 2.3, 3.0, 2.0], 0.07, dk, { seg: 5 });
    b.box(5.8, 0.25, 5.0, wood, { y: 3.2, r: 0.05, fc: true, cf: (x, y, z, wx) => (Math.floor((wx + 3) * 2.2) % 2 ? rgb(wood) : rgb('#c8925a')) });
    // railings
    for (const [ax, az, len, ry] of [[0, 2.45, 5.8, 0], [0, -2.45, 5.8, 0], [2.85, 0, 5.0, PI / 2], [-2.85, 0, 5.0, PI / 2]]) {
      b.box(len, 0.1, 0.1, dk, { x: ax, y: 4.25, z: az, ry, r: 0.03 });
      const n = Math.round(len / 0.5);
      for (let i = 0; i <= n; i++) { const t = -len / 2 + (i / n) * len; if (az > 2 && Math.abs(t) < 0.5) continue; b.box(0.07, 0.95, 0.07, dk, { x: ax + Math.cos(ry) * t, y: 3.8, z: az - Math.sin(ry) * t }); }
    }
    // hut on the platform
    b.box(3.4, 2.0, 2.8, '#d8a868', { y: 4.35, z: -0.6, r: 0.06, fc: true, cf: (x, y, z, wx, wy) => (Math.floor(wy * 3) % 2 ? rgb('#d8a868') : rgb('#c8925a')) });
    b.box(0.9, 0.7, 0.06, '#5a3a24', { y: 4.6, z: 0.82 });
    // thatched pyramid roof
    b.cone(3.6, 2.2, '#e8c86a', { y: 6.0, seg: 4, ry: PI / 4, sx: 1.1, z: -0.4, fc: true, cf: (x, y, z, wx, wy) => (Math.floor(wy * 4) % 2 ? rgb('#e8c86a') : rgb('#d8b050')) });
    // ladder
    for (const sx of [-0.35, 0.35]) b.rod([sx, 0, 3.6], [sx, 3.3, 2.5], 0.06, dk, { seg: 5 });
    for (let i = 1; i < 9; i++) { const t = i / 9; b.box(0.75, 0.06, 0.08, dk, { y: t * 3.3, z: 3.6 - t * 1.1 }); }
    b.rod([2.6, 4.3, 2.3], [2.6, 7.0, 2.3], 0.04, '#ddd', { seg: 4 });
    b.extrude([[0, 0], [0.9, 0.25], [0, 0.5]], 0.03, '#ffd23f', { x: 2.6, y: 6.5, z: 2.3 });
  },

  palmtree(b) {
    // a gently curved ringed trunk with a crown of fronds and coconuts
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.sin(t * 1.4) * 1.6, t * 12.6, 0]); }
    b.tube(pts, 0.42, '#a8784a', { ts: 32, rs: 8, cf: (x, y, z, wx, wy) => (Math.floor(wy * 1.8) % 2 ? rgb('#a8784a') : rgb('#8a5e3a')), df: (v) => { const t = v.y / 12.6; if (t < 0.1) { v.x *= 1.4 - t * 4; v.z *= 1.4 - t * 4; } } });
    const tx = Math.sin(1.4) * 1.6, ty = 12.6;
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + 0.2;
      frond(b, tx, ty, 0, a, 7.4 + (i % 3) * 0.8, 1.0 + (i % 2) * 0.3, i % 2 ? '#3fa84a' : '#52bc5a', { n: 8, width: 1.4, lift: 0.45, col2: '#2f9a44' });
    }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; b.ball(0.34, '#7a9a3a', { x: tx + Math.cos(a) * 0.45, y: ty - 0.45, z: Math.sin(a) * 0.45, seg: 8 }); }
    b.ball(0.5, '#6a8a3a', { x: tx, y: ty - 0.1, seg: 8 });
  },
};
