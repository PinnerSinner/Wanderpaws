// Item builders: recurring gags plus W1 Copacabana. Modelled in real metres,
// front facing +Z; the registry normalises them afterwards.
import { PI, TAU, crimp, lumpy, rgb, mixRgb, noise2, smooth } from '../util.js';
import { hash } from '../textures.js';

const C = {
  cream: '#fff6e6', white: '#fffdf7', coral: '#ff7a59', turq: '#3cc0c8', sea: '#2aa6b8', sun: '#ffd23f',
  lime: '#8bd450', pink: '#ff9ec7', sky: '#6cc4f0', ink: '#2f2a33', sand: '#f2dcae', wood: '#b07a4a',
  orange: '#ff9a3c', red: '#e8473a', choc: '#5a3524', alu: '#d6dde3', lilac: '#b9a3ff', mint: '#7fe3c4',
};
export const W1C = C;

// eyes helper for cute faces
export function eyes(b, x, y, z, r, gap, o = {}) {
  b.ball(r, o.col || C.ink, { x: x - gap, y, z, seg: 8, sz: 0.6 });
  b.ball(r, o.col || C.ink, { x: x + gap, y, z, seg: 8, sz: 0.6 });
  if (o.glint !== false) {
    b.ball(r * 0.35, '#ffffff', { x: x - gap + r * 0.3, y: y + r * 0.35, z: z + r * 0.5, seg: 6 });
    b.ball(r * 0.35, '#ffffff', { x: x + gap + r * 0.3, y: y + r * 0.35, z: z + r * 0.5, seg: 6 });
  }
}

export const shared = {
  teamug(b) {
    // cream mug with a pastel band, tea inside, handle on the right, tag hanging over the rim
    b.lathe([[0, 0.004], [0.034, 0], [0.039, 0.006], [0.041, 0.092], [0.036, 0.092], [0.033, 0.012], [0, 0.012]], C.cream, {
      seg: 16, cf: (x, y) => (y > 0.03 && y < 0.05 ? rgb('#ff8fa3') : y < 0.004 ? rgb('#e9dcc6') : rgb(C.cream)),
    });
    b.circle(0.034, '#a8683c', { y: 0.078, seg: 14 });
    b.torus(0.022, 0.0065, C.cream, { x: 0.041, y: 0.05, arc: PI, rz: -PI / 2, rs: 6, ts: 10 });
    b.ball(0.007, '#ff5d73', { y: 0.04, z: 0.04, sz: 0.4, seg: 8 }); // little heart dot
    b.rod([0.012, 0.08, 0.03], [0.02, 0.094, 0.038], 0.0012, '#fff', { seg: 3 });
    b.rod([0.02, 0.094, 0.038], [0.024, 0.07, 0.044], 0.0012, '#fff', { seg: 3 });
    b.box(0.014, 0.016, 0.003, C.sun, { x: 0.024, y: 0.062, z: 0.045, r: 0.001 });
  },

  rubberduck(b) {
    const Y = '#ffd23f';
    b.ball(0.034, Y, { y: 0.026, sx: 1, sy: 0.72, sz: 1.22, seg: 14 });
    b.ball(0.012, Y, { y: 0.03, z: -0.038, sx: 1.2, sy: 0.6, sz: 1.2, rx: -0.6, seg: 8 }); // tail
    b.ball(0.022, Y, { y: 0.06, z: 0.018, seg: 12 });
    b.ball(0.011, C.orange, { y: 0.055, z: 0.04, sx: 1.25, sy: 0.45, sz: 1.1, seg: 10 });
    b.ball(0.0045, C.ink, { x: -0.011, y: 0.066, z: 0.036, seg: 6 });
    b.ball(0.0045, C.ink, { x: 0.011, y: 0.066, z: 0.036, seg: 6 });
    b.ball(0.014, '#ffc21a', { x: -0.028, y: 0.03, z: -0.004, sx: 0.4, sy: 0.7, sz: 1.2, seg: 8 });
    b.ball(0.014, '#ffc21a', { x: 0.028, y: 0.03, z: -0.004, sx: 0.4, sy: 0.7, sz: 1.2, seg: 8 });
  },

  cable(b) {
    // a loose coil of blue patch cable with a velcro tie and two plugs
    const blue = '#4b8fe0';
    for (let i = 0; i < 4; i++) {
      b.torus(0.1 - i * 0.006, 0.006, blue, { y: 0.055, rx: PI / 2 + 0.35 - i * 0.22, ry: i * 0.5, rs: 5, ts: 22 });
    }
    b.cyl(0.012, 0.012, 0.024, C.coral, { y: 0.012 + 0.01, x: 0, z: 0.09, rz: PI / 2, seg: 10 });
    b.rod([0.08, 0.02, 0.05], [0.15, 0.01, 0.08], 0.006, blue, { seg: 5 });
    b.box(0.022, 0.014, 0.03, '#dfeaf2', { x: 0.155, y: 0.01, z: 0.085, ry: 0.4, r: 0.003 });
    b.box(0.012, 0.004, 0.012, '#f2c14e', { x: 0.16, y: 0.017, z: 0.09, ry: 0.4 });
    b.rod([-0.07, 0.03, -0.06], [-0.14, 0.012, -0.1], 0.006, blue, { seg: 5 });
    b.box(0.022, 0.014, 0.03, '#dfeaf2', { x: -0.145, y: 0.01, z: -0.105, ry: 0.6, r: 0.003 });
  },

  router(b) {
    b.box(0.22, 0.04, 0.15, '#f4f1fb', { y: 0.024, r: 0.014, rk: 2 });
    b.box(0.2, 0.006, 0.13, '#cfc6ef', { y: 0.003, r: 0.002 });
    // feet
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.008, 0.008, 0.006, '#9a92b8', { x: sx * 0.08, y: 0.003, z: sz * 0.05, seg: 6 });
    // antennas
    b.rod([-0.085, 0.04, -0.065], [-0.11, 0.14, -0.08], 0.006, '#3d3a4a', { seg: 6 });
    b.rod([0.085, 0.04, -0.065], [0.11, 0.14, -0.08], 0.006, '#3d3a4a', { seg: 6 });
    b.ball(0.008, '#3d3a4a', { x: -0.11, y: 0.14, z: -0.08, seg: 6 });
    b.ball(0.008, '#3d3a4a', { x: 0.11, y: 0.14, z: -0.08, seg: 6 });
    // vent slots on top
    for (let i = 0; i < 5; i++) b.box(0.1, 0.002, 0.005, '#d8d2ee', { y: 0.0445, z: -0.04 + i * 0.016 });
    // blinking LEDs on the front (green, green, amber, blue)
    const leds = [['#5dff8a', 1.3, 0.0], ['#5dff8a', 0.8, 0.3], ['#ffb02e', 2.1, 0.6], ['#6cc4ff', 0, 0]];
    leds.forEach(([c, rate, ph], i) => b.ball(0.0055, c, { x: -0.06 + i * 0.03, y: 0.026, z: 0.075, seg: 6, sz: 0.5, layer: 'glow', blink: [rate, ph] }));
  },
};

export const w1 = {
  bottlecap(b) {
    b.cyl(0.0145, 0.0155, 0.007, C.red, { y: 0.0035, seg: 24, df: crimp(12, 0.07) });
    b.circle(0.0095, C.white, { y: 0.0071, seg: 16 });
    b.circle(0.006, C.sun, { y: 0.0072, seg: 5, ry: 0.3 });
  },

  brigadeiro(b) {
    b.cyl(0.017, 0.012, 0.012, C.pink, { y: 0.006, seg: 18, open: true, df: crimp(9, 0.12) });
    b.circle(0.012, '#f7a8c4', { y: 0.0005, seg: 10 });
    b.ball(0.015, C.choc, {
      y: 0.02, seg: 12,
      cf: (x, y, z) => { const h = hash(Math.floor(x * 900 + 99), Math.floor((y + z) * 900 + 7)); return h > 0.86 ? rgb('#3a1f14') : h > 0.8 ? rgb('#8a5a3c') : rgb(C.choc); },
    });
  },

  seashell(b) {
    const fan = (v) => {
      const th = Math.atan2(v.x, v.z);
      const k = 1 + 0.07 * Math.cos(th * 16);
      v.x *= k; v.z *= k;
    };
    b.ball(0.025, '#ffb59a', {
      y: 0, seg: 22, hseg: 8, tl: PI / 2, sy: 0.55, df: fan, t0: 0,
      cf: (x, y, z) => { const th = Math.atan2(x, z); const r = Math.hypot(x, z) / 0.026; return mixRgb('#fff0e0', Math.cos(th * 16) > 0.2 ? '#ff8f7a' : '#ffc2a6', 0.3 + r * 0.7); },
    });
    b.box(0.018, 0.006, 0.008, '#ffd8c4', { y: 0.003, z: -0.024, r: 0.002 });
    b.transform(0, 0, 0.004, 1, 1, 1);
  },

  pastel(b) {
    b.box(0.13, 0.002, 0.1, C.white, { y: 0.001, ry: 0.2 });
    b.box(0.12, 0.028, 0.075, '#f0b34a', {
      y: 0.016, r: 0.012, rk: 2,
      cf: (x, y, z) => { const n = noise2(x * 140, z * 140); return mixRgb('#f6c35e', '#d8862c', smooth(-0.2, 0.9, n) * 0.6 + (y < 0.012 ? 0.3 : 0)); },
    });
    // fork crimps along the edge
    for (let i = 0; i < 9; i++) b.box(0.004, 0.006, 0.006, '#c97a2a', { x: -0.05 + i * 0.0125, y: 0.016, z: 0.038 });
    for (let i = 0; i < 4; i++) b.ball(0.005, '#ffd88a', { x: -0.03 + i * 0.022, y: 0.031, z: (i % 2) * 0.012 - 0.006, sy: 0.5, seg: 6 });
  },

  caipirinha(b) {
    b.cyl(0.036, 0.03, 0.085, '#e8fbff', { y: 0.0425, seg: 16, open: true, layer: 'trans', layerOpts: { opacity: 0.45 } });
    b.cyl(0.03, 0.03, 0.006, '#e8fbff', { y: 0.003, seg: 16, layer: 'trans' });
    b.cyl(0.033, 0.029, 0.06, '#d7f5a8', { y: 0.034, seg: 14 });
    b.box(0.022, 0.02, 0.022, '#f6ffff', { x: -0.01, y: 0.062, z: 0.004, ry: 0.5, rx: 0.3, r: 0.004 });
    b.box(0.02, 0.018, 0.02, '#f6ffff', { x: 0.012, y: 0.06, z: -0.008, ry: 0.2, rz: 0.4, r: 0.004 });
    b.ball(0.012, C.lime, { x: 0.005, y: 0.046, z: 0.012, sy: 0.6, seg: 8 });
    b.cyl(0.024, 0.024, 0.006, '#7cc23a', { x: 0.035, y: 0.08, z: 0.0, rz: PI / 2, ry: 0.3, seg: 14, cf: (x, y, z) => (Math.abs(y) > 0.002 ? (Math.hypot(x, z) < 0.019 ? rgb('#d9f59a') : rgb('#5aa62a')) : rgb('#5aa62a')) });
    b.rod([-0.008, 0.02, 0.0], [-0.036, 0.13, -0.01], 0.0035, '#ff5d73', { seg: 6, cf: (x, y) => (Math.floor(y * 90) % 2 ? rgb('#ff5d73') : rgb('#ffffff')) });
  },

  sunglasses(b) {
    const frame = C.coral;
    for (const sx of [-1, 1]) {
      b.cyl(0.026, 0.026, 0.006, frame, { x: sx * 0.034, y: 0.026, z: 0.04, rx: PI / 2, seg: 16 });
      b.cyl(0.021, 0.021, 0.008, '#25466b', {
        x: sx * 0.034, y: 0.026, z: 0.04, rx: PI / 2, seg: 14,
        cf: (x, y, z, wx, wy) => (wy - 0.026 > 0.006 && Math.abs((wx - sx * 0.034) + (wy - 0.026) * 0.8) < 0.006 ? rgb('#cfe9ff') : mixRgb('#2c6fa8', '#18284a', smooth(-0.02, 0.02, -(wy - 0.026)))),
      });
      b.box(0.006, 0.006, 0.12, frame, { x: sx * 0.06, y: 0.03, z: -0.02, r: 0.002 });
      b.box(0.006, 0.014, 0.008, frame, { x: sx * 0.06, y: 0.024, z: -0.08, r: 0.002 });
    }
    b.torus(0.012, 0.0035, frame, { y: 0.034, z: 0.04, arc: PI, rs: 5, ts: 8 });
  },

  icelolly(b) {
    b.ball(0.035, '#ffb7cf', { y: 0.002, sy: 0.08, sx: 1.4, seg: 12, df: lumpy(0.2, 60) });
    b.ball(0.01, '#ffb7cf', { x: 0.045, y: 0.002, sy: 0.25, seg: 6 });
    b.box(0.011, 0.07, 0.004, '#e8c690', { y: 0.035, r: 0.002 });
    b.box(0.058, 0.11, 0.024, '#ff7aa0', {
      y: 0.115, r: 0.011, rk: 2,
      fc: true, cf: (x, y, z, wx, wy) => (wy > 0.14 ? rgb('#6b3a26') : wy > 0.105 ? rgb('#fff1c8') : rgb('#ff6f96')),
    });
    // chocolate drips down the sides
    b.capsule(0.004, 0.012, '#6b3a26', { x: -0.029, y: 0.137, z: 0.0, seg: 6 });
    b.capsule(0.004, 0.02, '#6b3a26', { x: 0.029, y: 0.133, z: 0.004, seg: 6 });
    b.ball(0.004, '#ff6f96', { x: 0.018, y: 0.058, z: 0.008, sy: 1.6, seg: 6 });
  },

  coconut(b) {
    b.ball(0.085, '#58b043', {
      y: 0.085, sy: 1.08, seg: 16,
      cf: (x, y) => mixRgb('#7ccc4e', '#3d8f33', smooth(0.17, 0.0, y)),
      df: (v) => { if (v.y > 0.06) v.y = 0.06 + (v.y - 0.06) * 0.25; },
    });
    b.circle(0.05, '#f2f0d6', { y: 0.153, seg: 14 });
    b.circle(0.016, '#d6e8b0', { y: 0.154, seg: 10 });
    b.rod([0.005, 0.12, 0], [0.04, 0.23, 0.01], 0.0045, '#ff5d73', { seg: 6, cf: (x, y) => (Math.floor(y * 60) % 2 ? rgb('#ff5d73') : rgb('#ffffff')) });
    b.rod([0.04, 0.23, 0.01], [0.06, 0.225, 0.012], 0.0045, '#ff5d73', { seg: 6 });
    // tiny paper umbrella
    b.rod([-0.02, 0.15, 0.0], [-0.045, 0.22, 0.01], 0.0015, '#e8c690', { seg: 3 });
    b.cone(0.03, 0.012, C.sun, { x: -0.045, y: 0.226, z: 0.01, rz: 0.3, seg: 8, cf: (x, y, z) => (Math.floor((Math.atan2(z, x) + PI) / (TAU / 8)) % 2 ? rgb(C.sun) : rgb(C.coral)) });
  },

  biscuitpacket(b) {
    // a pillow pack of ring biscuits: pink wrapper, sunny band, a window of biscuits
    const col = (x, y, z, wx, wy, wz) => {
      if (Math.abs(wx) < 0.026) return wy > 0.025 && Math.abs(wz) < 0.022 ? rgb('#f3c27a') : rgb(C.sun);
      if (Math.abs(wx) < 0.032) return rgb(C.white);
      return Math.abs(wz) < 0.01 ? rgb('#3cc0c8') : rgb('#ff7a8c');
    };
    b.box(0.15, 0.045, 0.09, C.pink, { y: 0.024, r: 0.02, rk: 2, fc: true, cf: col, df: (v) => { v.y *= 1 - 0.5 * Math.pow(Math.abs(v.x) / 0.075, 4); } });
    for (const sx of [-1, 1]) b.box(0.02, 0.008, 0.088, '#ff7a8c', { x: sx * 0.083, y: 0.024, df: (v) => { v.y += 0.0025 * Math.sign(Math.sin(v.z * 700)); } });
    b.torus(0.017, 0.007, '#f3c27a', { x: 0.1, y: 0.007, z: 0.045, rx: PI / 2, rs: 5, ts: 10 });
    b.torus(0.017, 0.007, '#e8b060', { x: 0.075, y: 0.007, z: 0.075, rx: PI / 2, rs: 5, ts: 10 });
  },

  bucketspade(b) {
    b.lathe([[0, 0.002], [0.055, 0], [0.072, 0.12], [0.078, 0.122], [0.078, 0.13], [0.07, 0.13], [0.06, 0.012], [0, 0.012]], '#3a8ee6', {
      seg: 16, x: -0.035, cf: (x, y) => (y > 0.118 ? rgb('#ffffff') : rgb('#3a8ee6')),
    });
    b.torus(0.075, 0.004, '#f2f2f2', { x: -0.035, y: 0.125, arc: PI, rs: 4, ts: 12, ry: 0.3 });
    // spade leaning on the bucket
    b.push({});
    b.rod([0.06, 0.0, 0.03], [0.02, 0.2, 0.0], 0.007, '#ffd23f', { seg: 6 });
    b.box(0.05, 0.004, 0.06, '#ff7a59', { x: 0.065, y: 0.016, z: 0.045, rx: -1.2, ry: 0.2, r: 0.002 });
    b.box(0.03, 0.012, 0.012, '#ffd23f', { x: 0.02, y: 0.205, z: 0.0, r: 0.004 });
  },

  football(b) {
    // pentagon patches: half-planes facing the icosahedron face centres round each vertex
    const t = (1 + Math.sqrt(5)) / 2;
    const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; });
    const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    const pents = V.map((d) => {
      const nb = V.filter((n) => n !== d && dot(n, d) > 0.4);
      const planes = [];
      for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) {
        if (dot(nb[i], nb[j]) > 0.4) { const f = [d[0] + nb[i][0] + nb[j][0], d[1] + nb[i][1] + nb[j][1], d[2] + nb[i][2] + nb[j][2]]; const l = Math.hypot(...f); planes.push([d[0] - f[0] / l, d[1] - f[1] / l, d[2] - f[2] / l]); }
      }
      return { d, planes };
    });
    b.ico(0.11, '#fffdf5', {
      y: 0.11, detail: 5, rx: 0.3, rz: 0.2, fc: true,
      cf: (x, y, z) => {
        const l = Math.hypot(x, y, z); const p = [x / l, y / l, z / l];
        for (const P of pents) {
          if (dot(p, P.d) < 0.8) continue;
          if (P.planes.every((q) => dot(p, q) > 0.05)) return rgb('#27407a');
        }
        return rgb('#fffdf5');
      },
    });
  },

  flipflop(b) {
    const sole = [[0, -0.12], [0.034, -0.11], [0.04, -0.06], [0.032, 0.0], [0.042, 0.06], [0.036, 0.105], [0.0, 0.13], [-0.034, 0.11], [-0.04, 0.06], [-0.03, 0.0], [-0.036, -0.06], [-0.03, -0.11]];
    const one = (dx, ry, top, strap) => {
      b.extrude(sole, 0.016, top, {
        x: dx, y: 0.008, rx: -PI / 2, ry, curve: 4,
        cf: (x, y, z) => (z > 0.006 ? rgb(top) : rgb('#fffaf0')),
      });
      const m = { x: dx, ry };
      const pt = (px, py, pz) => { const c = Math.cos(ry), s = Math.sin(ry); return [dx + px * c + pz * s, py, -px * s + pz * c]; };
      b.tube([pt(-0.034, 0.016, -0.01), pt(-0.016, 0.034, 0.03), pt(0, 0.022, 0.075)], 0.0055, strap, { ts: 10, rs: 5 });
      b.tube([pt(0.034, 0.016, -0.01), pt(0.016, 0.034, 0.03), pt(0, 0.022, 0.075)], 0.0055, strap, { ts: 10, rs: 5 });
      b.ball(0.008, strap, { x: pt(0, 0.02, 0.075)[0], y: 0.02, z: pt(0, 0.02, 0.075)[2], sy: 0.6, seg: 6 });
      void m;
    };
    one(-0.05, 0.12, '#3cc0c8', '#ffd23f');
    one(0.05, -0.08, '#3cc0c8', '#ffd23f');
  },

  sunhat(b) {
    const straw = (x, y, z) => { const h = (Math.sin(Math.atan2(z, x) * 40) * Math.sin(Math.hypot(x, z) * 300)) > 0 ? 1 : 0.92; return mixRgb('#f2d48a', '#e2bb68', 1 - h); };
    b.lathe([[0.19, 0.012], [0.17, 0.018], [0.12, 0.03], [0.085, 0.04], [0.08, 0.1], [0.06, 0.135], [0.0, 0.14], [0, 0.128], [0.055, 0.124], [0.07, 0.09], [0.074, 0.036], [0.11, 0.022], [0.165, 0.006], [0.19, 0.0]], '#f2d48a', { seg: 22, cf: straw });
    b.cyl(0.083, 0.087, 0.026, C.coral, { y: 0.054, seg: 20, open: true });
    b.ball(0.014, C.coral, { x: 0.04, y: 0.055, z: 0.078, sx: 1.6, sz: 0.6, seg: 8 });
    b.ball(0.014, C.coral, { x: 0.072, y: 0.055, z: 0.06, sx: 1.6, sz: 0.6, ry: 0.6, seg: 8 });
    b.box(0.012, 0.05, 0.004, C.coral, { x: 0.06, y: 0.03, z: 0.085, rz: 0.3 });
  },

  beachball(b) {
    const cols = ['#ff5d5d', '#fffdf5', '#3aa6f0', '#fffdf5', '#ffd23f', '#fffdf5'];
    b.ball(0.225, C.white, {
      y: 0.225, seg: 24, hseg: 14, fc: true,
      cf: (x, y, z) => {
        if (Math.abs(y) > 0.2) return rgb('#fffdf5');
        const a = (Math.atan2(z, x) + PI) / TAU;
        return rgb(cols[Math.floor(a * 6) % 6]);
      },
    });
    b.cyl(0.02, 0.02, 0.012, '#ff5d5d', { y: 0.452, seg: 10 });
  },

  coolbox(b) {
    b.box(0.55, 0.3, 0.36, C.turq, { y: 0.15, r: 0.04, rk: 2, cf: (x, y) => (y < 0.03 ? rgb('#2a96a0') : rgb(C.turq)) });
    b.box(0.57, 0.08, 0.38, C.white, { y: 0.32, r: 0.035, rk: 2 });
    b.box(0.3, 0.04, 0.05, C.white, { y: 0.375, r: 0.02 });
    b.box(0.08, 0.06, 0.02, '#ff7a59', { y: 0.26, z: 0.185, r: 0.008 });
    for (const sx of [-1, 1]) b.box(0.03, 0.06, 0.2, '#e9f6f6', { x: sx * 0.285, y: 0.2, r: 0.012 });
  },

  lifebuoy(b) {
    b.torus(0.25, 0.085, C.white, {
      y: 0.085, rx: PI / 2, rs: 10, ts: 32, fc: true,
      cf: (x, y, z) => (Math.floor((Math.atan2(y, x) + PI) / (TAU / 8)) % 2 ? rgb('#ff4f42') : rgb('#fffaf2')),
    });
    // grab rope with four ties
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * TAU;
      const sag = Math.abs(Math.sin(a * 2)) * 0.03;
      pts.push([Math.cos(a) * (0.345 - sag), 0.09 + Math.cos(a * 4) * 0.02, Math.sin(a) * (0.345 - sag)]);
    }
    b.tube(pts, 0.009, '#f2e3c0', { ts: 64, rs: 4, closed: true });
  },

  bollard(b) {
    b.cyl(0.24, 0.27, 0.06, '#7d7d84', { y: 0.03, seg: 16 });
    b.cyl(0.17, 0.18, 0.72, '#fffaf2', {
      y: 0.42, seg: 16, hs: 10, fc: true,
      cf: (x, y, z, wx, wy) => { const row = Math.floor((wy - 0.06) / 0.072); return row === 4 || row === 7 ? rgb('#ff4f42') : rgb('#fffaf2'); },
    });
    b.dome(0.17, '#fffaf2', { y: 0.78, seg: 16, sy: 0.7 });
    b.box(0.09, 0.06, 0.02, '#ffd23f', { y: 0.7, z: 0.172, r: 0.01, layer: 'glow', blink: [0, 0] });
  },

  towel(b) {
    const stripes = ['#ff7a59', '#ffd23f', '#3cc0c8', '#fffaf0', '#ff9ec7'];
    b.plane(0.95, 0.55, C.coral, {
      y: 0.006, ws: 27, ds: 6, fc: true,
      df: (v) => { v.y += 0.006 * noise2(v.x * 8, v.z * 8) + 0.006; },
      cf: (x, y, z) => rgb(stripes[Math.floor((x + 0.5) * 9) % 5]),
    });
    b.cyl(0.035, 0.035, 0.55, C.coral, { x: -0.47, y: 0.035, rx: PI / 2, seg: 12, cf: (x, y, z) => rgb(stripes[(Math.floor(Math.atan2(z, x) * 1.2) + 10) % 5]) });
    for (let i = 0; i < 8; i++) b.box(0.02, 0.003, 0.012, '#fffaf0', { x: 0.485, y: 0.004, z: -0.24 + i * 0.068 });
  },

  deckchair(b) {
    // low aluminium Copacabana beach chair with candy-stripe canvas
    const alu = '#dfe6ec';
    const stripes = ['#ff5d73', '#ffd23f', '#3cc0c8', '#8bd450', '#b9a3ff'];
    for (const sx of [-1, 1]) {
      b.rod([sx * 0.27, 0.0, 0.35], [sx * 0.27, 0.3, 0.15], 0.016, alu, { seg: 6 });
      b.rod([sx * 0.27, 0.0, -0.05], [sx * 0.27, 0.3, 0.3], 0.016, alu, { seg: 6 });
      b.rod([sx * 0.27, 0.25, 0.2], [sx * 0.27, 0.82, -0.32], 0.016, alu, { seg: 6 });
      b.box(0.04, 0.03, 0.3, alu, { x: sx * 0.29, y: 0.42, z: 0.12, r: 0.012 });
    }
    b.plane(0.52, 0.42, '#ff5d73', { y: 0.27, z: 0.16, ws: 10, ds: 4, fc: true, df: (v) => { v.y -= 0.06 * (1 - (v.x / 0.26) ** 2); }, cf: (x) => rgb(stripes[Math.floor((x + 0.26) * 9.6) % 5]) });
    b.quad(0.52, 0.66, '#ff5d73', { y: 0.55, z: -0.06, rx: -0.73, ws: 10, hs: 4, fc: true, df: (v) => { v.z -= 0.05 * (1 - (v.x / 0.26) ** 2); }, cf: (x) => rgb(stripes[Math.floor((x + 0.26) * 9.6) % 5]) });
    b.ball(0.12, '#ffffff', { y: 0.33, z: 0.06, sx: 1.4, sy: 0.4, seg: 10, cf: (x) => (x > 0 ? rgb('#fff6e0') : rgb('#ffe1c8')) }); // a cushion
  },

  sandcastle(b) {
    const sandC = (x, y, z) => mixRgb('#f6dca4', '#d9b06a', smooth(0.6, 0, y) * 0.5 + noise2(x * 20, z * 20 + y * 20) * 0.15 + 0.1);
    b.cyl(0.55, 0.62, 0.22, '#f2d498', { y: 0.11, seg: 18, df: lumpy(0.04, 6), cf: sandC });
    const tower = (x, z, r, h) => {
      b.cyl(r, r * 1.12, h, '#f2d498', { x, y: 0.22 + h / 2, z, seg: 12, cf: sandC });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.box(r * 0.45, r * 0.4, r * 0.3, '#f2d498', { x: x + Math.cos(a) * r * 0.8, y: 0.22 + h + r * 0.2, z: z + Math.sin(a) * r * 0.8, ry: -a, cf: sandC }); }
    };
    tower(-0.32, 0.25, 0.12, 0.26); tower(0.32, 0.25, 0.12, 0.26); tower(-0.32, -0.25, 0.12, 0.26); tower(0.32, -0.25, 0.12, 0.26);
    b.box(0.5, 0.22, 0.4, '#f2d498', { y: 0.33, cf: sandC });
    tower(0, 0, 0.16, 0.42);
    b.box(0.12, 0.14, 0.02, '#c99a5a', { y: 0.29, z: 0.205, r: 0.04 }); // gate
    b.rod([0, 0.72, 0], [0, 0.92, 0], 0.006, '#8a6a4a', { seg: 4 });
    b.extrude([[0, 0], [0.12, 0.04], [0, 0.08]], 0.004, C.coral, { y: 0.84, curve: 1 });
    b.ball(0.035, '#ffb59a', { x: 0.45, y: 0.23, z: 0.3, sy: 0.5, seg: 8 }); // shell decoration
    b.ball(0.03, '#fff0e0', { x: -0.4, y: 0.23, z: 0.38, sy: 0.5, seg: 8 });
  },

  kiosktable(b) {
    const tc = '#ffd23f';
    b.cyl(0.38, 0.38, 0.04, tc, { y: 0.72, seg: 18 });
    b.cyl(0.035, 0.05, 0.7, '#ffe680', { y: 0.36, seg: 8 });
    b.cyl(0.2, 0.22, 0.03, '#e8b820', { y: 0.015, seg: 12 });
    const chair = (x, ry) => {
      b.push({});
      const c = Math.cos(ry), s = Math.sin(ry);
      const P = (px, py, pz) => ({ x: x + px * c + pz * s, y: py, z: -px * s + pz * c, ry });
      b.box(0.36, 0.04, 0.34, tc, { ...P(0, 0.42, 0), r: 0.015 });
      b.box(0.36, 0.34, 0.04, tc, { ...P(0, 0.62, -0.17), rx: -0.12, r: 0.015 });
      for (const lx of [-0.15, 0.15]) for (const lz of [-0.14, 0.14]) b.cyl(0.016, 0.016, 0.42, '#e8b820', { ...P(lx, 0.21, lz), seg: 5 });
    };
    chair(-0.55, PI / 2);
    chair(0.55, -PI / 2);
    // a coconut and a glass on the table
    b.ball(0.07, '#58b043', { x: 0.1, y: 0.8, z: 0.05, seg: 10 });
    b.cyl(0.03, 0.026, 0.09, '#e8fbff', { x: -0.12, y: 0.785, z: -0.05, seg: 10, layer: 'trans' });
  },

  bicycle(b) {
    const frame = '#ff8a2a', tyre = '#34313a', rimC = '#e6e9ee';
    const wheel = (z) => {
      b.torus(0.33, 0.035, tyre, { y: 0.36, z, ry: PI / 2, rs: 6, ts: 24 });
      b.torus(0.3, 0.012, rimC, { y: 0.36, z, ry: PI / 2, rs: 4, ts: 20 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI; b.rod([0, 0.36 + Math.cos(a) * 0.3, z + Math.sin(a) * 0.3], [0, 0.36 - Math.cos(a) * 0.3, z - Math.sin(a) * 0.3], 0.004, rimC, { seg: 3 }); }
      b.cyl(0.03, 0.03, 0.06, '#888', { y: 0.36, z, rz: PI / 2, seg: 8 });
    };
    wheel(0.52); wheel(-0.52);
    const bb = [0, 0.38, 0.0], seat = [0, 0.78, -0.18], head = [0, 0.86, 0.36];
    b.rod([0, 0.36, -0.52], bb, 0.02, frame);
    b.rod([0, 0.36, -0.52], seat, 0.018, frame);
    b.rod(bb, seat, 0.024, frame);
    b.rod(bb, [0, 0.82, 0.33], 0.028, frame);
    b.rod([0, 0.78, -0.12], [0, 0.82, 0.33], 0.02, frame);
    b.rod([0, 0.36, 0.52], head, 0.02, frame);
    b.rod(head, [0, 1.0, 0.33], 0.018, '#555');
    b.rod([-0.26, 1.0, 0.3], [0.26, 1.0, 0.3], 0.016, '#555');
    b.capsule(0.024, 0.06, '#34313a', { x: -0.27, y: 1.0, z: 0.3, rz: PI / 2, seg: 6 });
    b.capsule(0.024, 0.06, '#34313a', { x: 0.27, y: 1.0, z: 0.3, rz: PI / 2, seg: 6 });
    b.box(0.13, 0.05, 0.24, '#34313a', { y: 0.82, z: -0.2, r: 0.025 });
    b.cyl(0.07, 0.07, 0.02, '#888', { y: 0.38, rz: PI / 2, seg: 10 });
    b.box(0.03, 0.02, 0.16, '#555', { x: 0.06, y: 0.33, z: 0.02, rx: 0.5 });
    // basket and mudguards
    b.box(0.32, 0.2, 0.24, '#d9a35a', { y: 0.95, z: 0.55, r: 0.02, cf: (x, y, z) => ((Math.floor(x * 40) + Math.floor(y * 40)) % 2 ? rgb('#c88f45') : rgb('#e0b06a')) });
    b.torus(0.37, 0.03, frame, { y: 0.36, z: -0.52, ry: PI / 2, arc: PI * 0.7, rz: 0.6, rs: 4, ts: 10 });
  },

  parasol(b) {
    const cols = ['#ff7a59', '#fffaf0', '#3cc0c8', '#fffaf0', '#ffd23f', '#fffaf0'];
    b.cyl(0.025, 0.03, 2.0, '#fffaf0', { y: 1.0, seg: 8 });
    b.cyl(0.12, 0.16, 0.08, '#d0c6b0', { y: 0.04, seg: 10 });
    b.cyl(0.0, 0.95, 0.42, C.coral, {
      y: 1.82, seg: 24, hs: 3, open: true, fc: true,
      df: (v) => { const th = Math.atan2(v.z, v.x); const r = Math.hypot(v.x, v.z); v.y -= 0.05 * Math.pow(r / 0.95, 2) * (1 - Math.cos(th * 12)) * 0.5; },
      cf: (x, y, z) => rgb(cols[Math.floor((Math.atan2(z, x) + PI) / (TAU / 12)) % 6]),
    });
    b.cyl(0.95, 0.0, 0.05, '#f0e4cc', { y: 1.62, seg: 24 }); // underside
    b.ball(0.05, '#fffaf0', { y: 2.06, seg: 8 });
    // scalloped valance
    for (let i = 0; i < 12; i++) { const a = ((i + 0.5) / 12) * TAU; b.ball(0.11, cols[(i * 1) % 6], { x: Math.cos(a) * 0.92, y: 1.58, z: Math.sin(a) * 0.92, sx: 1.4, sy: 0.6, sz: 0.25, ry: -a + PI / 2, seg: 8, hseg: 4, tl: PI / 2, rx: PI }); }
  },

  surfboard(b) {
    const rocker = (v) => { const t = v.z / 1.05; v.y += 0.09 * Math.pow(Math.max(0, t), 3) + 0.03 * Math.pow(Math.max(0, -t), 3); };
    b.ball(1, '#fffaf0', {
      y: 0.035, sx: 0.27, sy: 0.035, sz: 1.05, seg: 20, hseg: 10, df: (v) => { v.x *= 1 - 0.35 * Math.max(0, v.z); rocker(v); },
      cf: (x, y, z) => (Math.abs(x) < 0.03 ? rgb('#ff7a59') : z > 0.55 ? rgb('#3cc0c8') : y < -0.02 ? rgb('#e8e0cc') : rgb('#fffaf0')),
    });
    b.extrude([[0, 0], [0.09, 0], [0.02, 0.1]], 0.012, '#3cc0c8', { y: 0.06, z: -0.9, ry: PI / 2, rx: 0 });
    b.tube([[0, 0.05, -1.0], [0.1, 0.02, -1.1], [0.25, 0.01, -1.05]], 0.008, C.sun, { ts: 8, rs: 4 }); // leash
  },

  volleynet(b) {
    const post = '#fffaf0';
    for (const sx of [-1, 1]) {
      b.cyl(0.05, 0.05, 2.4, post, { x: sx * 1.5, y: 1.2, seg: 8, cf: (x, y) => (Math.floor(y * 3.3) % 2 ? rgb('#3cc0c8') : rgb('#fffaf0')) });
      b.ball(0.06, '#ffd23f', { x: sx * 1.5, y: 2.42, seg: 8 });
      b.rod([sx * 1.5, 2.3, 0], [sx * 1.6, 0, 0.6], 0.008, '#e8dcc0', { seg: 3 });
      b.rod([sx * 1.5, 2.3, 0], [sx * 1.6, 0, -0.6], 0.008, '#e8dcc0', { seg: 3 });
      b.cyl(0.1, 0.12, 0.08, '#e8d4a8', { x: sx * 1.5, y: 0.04, seg: 8 });
    }
    b.box(2.95, 0.07, 0.02, '#fffaf0', { y: 2.28 });
    b.box(2.95, 0.03, 0.015, '#fffaf0', { y: 1.5 });
    for (let i = 0; i < 4; i++) b.box(2.95, 0.008, 0.008, '#2f3a48', { y: 1.6 + i * 0.17 });
    for (let i = 0; i < 18; i++) b.box(0.008, 0.78, 0.008, '#2f3a48', { x: -1.42 + i * 0.167, y: 1.89 });
  },

  kiosk(b) {
    // hexagonal beach kiosk with a swooping white roof
    b.cyl(1.5, 1.55, 0.18, '#e8dcc6', { y: 0.09, seg: 6 });
    b.cyl(1.3, 1.3, 1.0, '#3cc0c8', { y: 0.68, seg: 6, cf: (x, y) => (y < -0.4 ? rgb('#2a96a0') : rgb('#3cc0c8')) });
    b.cyl(1.42, 1.42, 0.08, '#fffaf0', { y: 1.2, seg: 6 }); // counter top
    b.cyl(1.24, 1.24, 0.95, '#bfeaf4', { y: 1.72, seg: 6, open: true, layer: 'trans', layerOpts: { opacity: 0.5 } });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.box(0.08, 0.95, 0.08, '#fffaf0', { x: Math.cos(a) * 1.24, y: 1.72, z: Math.sin(a) * 1.24, ry: -a }); }
    b.cyl(0.05, 0.05, 0.4, '#fffaf0', { y: 2.4, seg: 6 });
    b.lathe([[0, 2.95], [0.4, 2.9], [1.2, 2.55], [1.8, 2.25], [1.9, 2.18], [1.85, 2.12], [1.2, 2.3], [0.2, 2.4], [0, 2.4]], '#fffaf0', {
      seg: 6, ry: PI / 6, cf: (x, y) => (y < 2.2 ? rgb('#ff7a59') : rgb('#fffaf0')),
    });
    b.cyl(0.03, 0.03, 0.5, '#d0c6b0', { y: 3.15, seg: 4 });
    b.extrude([[0, 0], [0.45, 0.12], [0, 0.24]], 0.02, C.coral, { y: 3.18 });
    // menu board and stools
    b.box(0.9, 0.42, 0.04, '#fffaf0', { y: 0.72, z: 1.14, r: 0.04, cf: (x, y) => (y > 0.14 ? rgb('#ff7a59') : Math.abs(y + 0.02) < 0.02 || Math.abs(y + 0.1) < 0.02 ? rgb('#2f3a48') : rgb('#fffaf0')) });
    for (const a of [-0.5, 0.5]) {
      const x = Math.sin(a) * 1.75, z = Math.cos(a) * 1.75;
      b.cyl(0.18, 0.18, 0.06, C.sun, { x, y: 0.72, z, seg: 10 });
      b.cyl(0.03, 0.03, 0.7, '#d0c6b0', { x, y: 0.35, z, seg: 5 });
    }
    // fruit display on the counter
    for (let i = 0; i < 5; i++) b.ball(0.09, i % 2 ? '#58b043' : C.sun, { x: -0.4 + i * 0.2, y: 1.32, z: 1.15, seg: 8 });
  },
};
