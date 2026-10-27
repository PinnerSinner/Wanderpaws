// Item builders: W2 London park and street. Real metres, front faces +Z.
import { PI, TAU, crimp, lumpy, rgb, mixRgb, noise2, smooth } from '../util.js';

const C = {
  red: '#d8342c', redDk: '#a82620', green: '#4f9a4a', leaf: '#6bb04a', slate: '#5b6b7a', cream: '#f4ead2',
  navy: '#2c3e66', mustard: '#e6b33a', black: '#2a2a30', gold: '#e8b83a', wood: '#a8754a', white: '#fbf8f0',
  brick: '#b8573e', glass: '#bfe4f2', ink: '#2f2a33',
};

export const w2 = {
  conker(b) {
    b.ball(0.019, '#8a4a22', {
      x: -0.006, y: 0.018, seg: 14, sy: 0.92, df: lumpy(0.05, 60),
      cf: (x, y, z) => (y > 0.012 && z > -0.004 ? rgb('#e9d3a8') : mixRgb('#a35a28', '#6a3214', smooth(-0.02, 0.02, noise2(x * 300, z * 300 + y * 200)))),
    });
    b.ball(0.004, '#ffffff', { x: -0.012, y: 0.026, z: 0.012, seg: 5 }); // shine
    // half a spiky husk beside it
    b.dome(0.016, '#7cc04a', { x: 0.022, y: 0.0, z: -0.004, rx: 0.2, seg: 10, sy: 0.8, cf: () => rgb('#7cc04a') });
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; b.cone(0.002, 0.008, '#5f9e38', { x: 0.022 + Math.cos(a) * 0.012, y: 0.007 + (i % 3) * 0.002, z: -0.004 + Math.sin(a) * 0.012, rz: -Math.cos(a) * 0.9, rx: Math.sin(a) * 0.9, seg: 4 }); }
  },

  biscuit(b) {
    // jammy biscuit: crimped shortbread with a jam heart window
    b.cyl(0.03, 0.03, 0.008, '#e9b46a', { y: 0.004, seg: 22, df: crimp(14, 0.04) });
    b.cyl(0.03, 0.03, 0.008, '#f2c27c', { y: 0.013, seg: 22, df: crimp(14, 0.04) });
    b.extrude([[0, -0.009], [0.01, 0.001], [0.008, 0.007], [0.004, 0.009], [0, 0.005], [-0.004, 0.009], [-0.008, 0.007], [-0.01, 0.001]], 0.004, '#d8243a', { y: 0.017, rx: -PI / 2, curve: 3 });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; b.ball(0.0016, '#c98a44', { x: Math.cos(a) * 0.021, y: 0.017, z: Math.sin(a) * 0.021, seg: 4 }); }
  },

  scone(b) {
    b.cyl(0.04, 0.043, 0.04, '#e8b56a', {
      y: 0.02, seg: 18, df: lumpy(0.05, 40),
      cf: (x, y, z, wx, wy) => mixRgb('#f3cf8e', '#c9853c', smooth(0.025, 0.04, wy) * 0.8),
    });
    b.dome(0.04, '#f0c27a', { y: 0.038, sy: 0.35, seg: 16 });
    b.dome(0.03, '#fff8e8', { y: 0.046, sy: 0.45, seg: 12, df: lumpy(0.12, 60) }); // cream first, obviously
    b.dome(0.02, '#d8243a', { y: 0.055, sy: 0.5, seg: 10, df: lumpy(0.15, 80) });
    b.ball(0.004, '#ff6070', { x: 0.006, y: 0.064, z: 0.005, seg: 5 });
  },

  crisps(b) {
    const col = (x, y, z, wx, wy, wz) => {
      const d = Math.hypot(wx, wz - 0.004);
      if (wy > 0.02 && d < 0.03) return d < 0.025 ? rgb('#ffd35a') : rgb('#ffffff');
      return Math.abs(wz) > 0.05 ? rgb('#e8e8f0') : rgb('#2f6fd8');
    };
    b.box(0.1, 0.035, 0.13, '#2f6fd8', { y: 0.02, r: 0.016, rk: 2, fc: true, cf: col, df: (v) => { v.y *= 1 - 0.55 * Math.pow(Math.abs(v.z) / 0.065, 4); } });
    for (const sz of [-1, 1]) b.box(0.098, 0.006, 0.012, '#e8e8f0', { y: 0.02, z: sz * 0.068, df: (v) => { v.y += 0.002 * Math.sign(Math.sin(v.x * 800)); } });
    // a few crisps spilling out
    for (const [x, z, r] of [[0.06, 0.04, 0.4], [0.07, 0.0, 1.2], [0.05, 0.075, 2]]) b.ball(0.014, '#f7c844', { x, y: 0.003, z, sy: 0.2, ry: r, rx: 0.3, seg: 8, df: lumpy(0.2, 200) });
  },

  newspaper(b) {
    const print = (x, y, z, wx, wy, wz) => {
      if (wz > 0.1) return rgb('#2f2a33');
      if (wz > 0.085) return rgb('#f4ead2');
      if (wx < -0.03 && wz > 0.02) return rgb('#9aa6b2');
      return Math.floor((wz + 1) * 140) % 3 === 0 ? rgb('#b6b0a4') : rgb('#f4ead2');
    };
    b.box(0.21, 0.012, 0.29, '#ece3cc', { y: 0.006, r: 0.004, ry: 0.15 });
    b.box(0.2, 0.012, 0.28, '#f4ead2', { y: 0.018, r: 0.004, ws: 1, fc: true, cf: print, df: (v) => { v.y += 0.004 * Math.sin(v.x * 20); } });
    b.cyl(0.012, 0.012, 0.28, '#f4ead2', { x: -0.1, y: 0.018, rx: PI / 2, seg: 8 });
  },

  wellies(b) {
    const boot = (x, ry, col) => {
      const c = Math.cos(ry), s = Math.sin(ry);
      const P = (px, pz) => ({ x: x + px * c + pz * s, z: -px * s + pz * c });
      b.cyl(0.055, 0.05, 0.3, col, { ...P(0, -0.02), y: 0.2, seg: 12 });
      b.torus(0.055, 0.008, col, { ...P(0, -0.02), y: 0.35, rx: PI / 2, rs: 5, ts: 12 });
      b.box(0.1, 0.07, 0.2, col, { ...P(0, 0.03), y: 0.045, ry, r: 0.035, rk: 2 });
      b.box(0.105, 0.022, 0.21, '#3a3530', { ...P(0, 0.03), y: 0.011, ry, r: 0.008 });
      b.ball(0.012, '#ffffff', { ...P(0.045, -0.02), y: 0.3, sx: 0.3, seg: 6 });
    };
    boot(-0.065, 0.1, '#ffd23f');
    boot(0.065, -0.15, '#ffd23f');
    // polka dots for cheer
    for (let i = 0; i < 8; i++) b.ball(0.008, '#ff7a59', { x: (i % 2 ? 0.065 : -0.065) + ((i * 37) % 5 - 2) * 0.008, y: 0.12 + (i >> 1) * 0.05, z: 0.035, sz: 0.4, seg: 5 });
  },

  flowerpot(b) {
    b.lathe([[0, 0], [0.13, 0], [0.17, 0.24], [0.19, 0.25], [0.19, 0.3], [0.16, 0.3], [0, 0.29]], '#c8683c', { seg: 16, cf: (x, y) => (y > 0.24 ? rgb('#d8784a') : rgb('#c0603a')) });
    b.circle(0.16, '#5a3a24', { y: 0.29, seg: 14 });
    const fl = [['#ff5d73', 0, 0], ['#ffd23f', 0.08, 0.05], ['#b98cff', -0.08, 0.04], ['#ff9ec7', 0.04, -0.08], ['#ffffff', -0.05, -0.07]];
    for (const [c, x, z] of fl) {
      b.rod([x * 0.4, 0.29, z * 0.4], [x, 0.37, z], 0.006, '#4f9a4a', { seg: 4 });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; b.ball(0.022, c, { x: x + Math.cos(a) * 0.02, y: 0.38, z: z + Math.sin(a) * 0.02, sy: 0.4, seg: 6 }); }
      b.ball(0.012, '#ffb02e', { x, y: 0.388, z, seg: 6 });
    }
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; b.ball(0.045, '#5fae4a', { x: Math.cos(a) * 0.11, y: 0.31, z: Math.sin(a) * 0.11, sy: 0.35, ry: -a, sx: 1.4, seg: 6 }); }
  },

  trafficcone(b) {
    b.box(0.42, 0.04, 0.42, '#ff6a2a', { y: 0.02, r: 0.03 });
    b.cyl(0.035, 0.16, 0.64, '#ff6a2a', {
      y: 0.36, seg: 16, hs: 8, fc: true,
      cf: (x, y, z, wx, wy) => { const row = Math.floor((wy - 0.04) / 0.08); return row === 3 || row === 5 ? rgb('#ffffff') : rgb('#ff6a2a'); },
    });
    b.cyl(0.04, 0.04, 0.02, '#ff6a2a', { y: 0.685, seg: 10 });
  },

  brolly(b) {
    const panel = ['#ff5d73', '#ffd23f', '#3cc0c8', '#b98cff'];
    b.cyl(0.06, 0.46, 0.26, '#ff5d73', {
      y: 0.74, seg: 16, hs: 2, open: true, fc: true,
      df: (v) => { const th = Math.atan2(v.z, v.x); const r = Math.hypot(v.x, v.z); v.y += 0.06 * (1 - (r / 0.46) ** 2); v.y -= 0.03 * (r / 0.46) * (1 - Math.abs(Math.cos(th * 4))); },
      cf: (x, y, z) => rgb(panel[Math.floor((Math.atan2(z, x) + PI) / (TAU / 8)) % 4]),
    });
    b.cyl(0.46, 0.06, 0.2, '#e9e2d6', { y: 0.66, seg: 16, open: true });
    b.ball(0.065, '#ff5d73', { y: 0.86, sy: 0.6, seg: 10 });
    b.cyl(0.01, 0.01, 0.85, '#3a3530', { y: 0.45, seg: 6 });
    b.cone(0.012, 0.06, '#e8b83a', { y: 0.93, seg: 6 });
    b.torus(0.04, 0.012, '#8a5a3c', { x: 0.04, y: 0.04, arc: PI, rz: PI, rs: 5, ts: 8 });
    b.cyl(0.012, 0.012, 0.03, '#8a5a3c', { y: 0.05, seg: 6 });
  },

  parkbin(b) {
    b.cyl(0.32, 0.3, 0.78, '#2f5d3a', {
      y: 0.42, seg: 18, hs: 6, fc: true,
      cf: (x, y, z, wx, wy) => { const row = Math.floor((wy - 0.03) / 0.13); return row === 4 ? rgb('#e8b83a') : rgb('#2f5d3a'); },
    });
    b.cyl(0.3, 0.32, 0.06, '#26442c', { y: 0.03, seg: 18 });
    b.lathe([[0, 0.98], [0.12, 0.97], [0.3, 0.88], [0.34, 0.83], [0.34, 0.8], [0, 0.8]], '#2f5d3a', { seg: 18 });
    b.box(0.24, 0.08, 0.06, '#1a2a1e', { y: 0.86, z: 0.29, rx: -0.5, r: 0.02 }); // slot
    b.ball(0.035, '#e8b83a', { y: 0.99, seg: 8 });
    b.box(0.14, 0.09, 0.02, '#e8b83a', { y: 0.55, z: 0.31, r: 0.01 });
  },

  stripedeckchair(b) {
    const wood = '#c08a56';
    for (const sx of [-1, 1]) {
      b.box(0.04, 0.03, 1.15, wood, { x: sx * 0.3, y: 0.45, z: -0.02, rx: -0.95, r: 0.01 });
      b.box(0.04, 0.03, 0.8, wood, { x: sx * 0.3, y: 0.33, z: 0.12, rx: 0.75, r: 0.01 });
      b.box(0.035, 0.03, 0.5, wood, { x: sx * 0.33, y: 0.3, z: 0.28, rx: 0.05, r: 0.01 });
    }
    for (const [y, z] of [[0.92, -0.4], [0.05, 0.4], [0.38, 0.28]]) b.cyl(0.018, 0.018, 0.64, wood, { y, z, rz: PI / 2, seg: 6 });
    b.plane(0.56, 0.95, '#d8342c', {
      y: 0.55, z: -0.05, rx: 0.88, ws: 14, ds: 6, fc: true,
      df: (v) => { v.y -= 0.08 * (1 - ((v.z) / 0.475) ** 2); },
      cf: (x) => (Math.floor((x + 0.28) * 25) % 2 ? rgb('#fbf8f0') : rgb('#d8342c')),
    });
  },

  postbox(b) {
    const red = C.red;
    b.cyl(0.3, 0.32, 0.12, '#2a2a30', { y: 0.06, seg: 20 });
    b.cyl(0.27, 0.27, 1.18, red, { y: 0.71, seg: 20 });
    b.cyl(0.31, 0.31, 0.07, red, { y: 1.33, seg: 20 });
    b.dome(0.28, red, { y: 1.36, sy: 0.55, seg: 20 });
    b.cyl(0.29, 0.29, 0.06, C.redDk, { y: 0.17, seg: 20 });
    b.box(0.26, 0.035, 0.07, '#1c1c22', { y: 1.16, z: 0.25, r: 0.012 }); // slot
    b.box(0.3, 0.06, 0.05, red, { y: 1.205, z: 0.26, r: 0.02 });
    b.box(0.18, 0.13, 0.02, '#fbf8f0', { y: 0.95, z: 0.27, r: 0.012, cf: (x, y, z, wx, wy) => (Math.abs(wy - 0.97) < 0.008 || Math.abs(wy - 0.93) < 0.008 ? rgb('#4a4a55') : rgb('#fbf8f0')) });
    b.ball(0.05, C.gold, { y: 0.7, z: 0.27, sz: 0.3, seg: 10 });
    b.box(0.2, 0.36, 0.02, C.redDk, { y: 0.42, z: 0.265, r: 0.03 }); // door
    b.ball(0.02, C.gold, { x: 0.06, y: 0.55, z: 0.28, seg: 6 });
  },

  bench(b) {
    const iron = '#2f4a3a', wood = '#c08a56';
    for (const sx of [-0.7, 0.7]) {
      b.box(0.06, 0.45, 0.06, iron, { x: sx, y: 0.225, z: 0.18, r: 0.02 });
      b.box(0.06, 0.85, 0.06, iron, { x: sx, y: 0.43, z: -0.2, rx: -0.12, r: 0.02 });
      b.box(0.06, 0.05, 0.5, iron, { x: sx, y: 0.43, z: 0, r: 0.02 });
      b.box(0.06, 0.05, 0.36, iron, { x: sx, y: 0.65, z: 0.06, r: 0.02 });
      b.torus(0.08, 0.018, iron, { x: sx, y: 0.6, z: 0.24, ry: PI / 2, arc: PI, rz: -PI / 2, rs: 5, ts: 8 });
    }
    for (let i = 0; i < 4; i++) b.box(1.6, 0.04, 0.09, wood, { y: 0.46, z: 0.17 - i * 0.11, r: 0.015 });
    for (let i = 0; i < 3; i++) b.box(1.6, 0.11, 0.035, wood, { y: 0.62 + i * 0.13, z: -0.22 - i * 0.017, rx: -0.12, r: 0.012 });
    b.box(0.16, 0.05, 0.01, '#d9b24a', { y: 0.75, z: -0.2, rx: -0.12, r: 0.006 }); // the plaque
  },

  phonebox(b) {
    const red = C.red;
    b.box(1.04, 0.1, 1.04, '#8a8a90', { y: 0.05, r: 0.02 });
    b.box(0.96, 2.2, 0.96, red, { y: 1.2, r: 0.05 });
    // windows: grids of small panes on every side
    for (let f = 0; f < 4; f++) {
      const a = (f * PI) / 2, c = Math.cos(a), s = Math.sin(a);
      for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) {
        const px = -0.22 + k * 0.22, py = 0.62 + r * 0.22;
        b.box(0.18, 0.18, 0.02, C.glass, { x: px * c + 0.485 * s, y: py, z: -px * s + 0.485 * c, ry: a, cf: (x, y) => (y > 0.03 && x < 0 ? rgb('#e8f6fc') : rgb(C.glass)) });
      }
      // TELEPHONE header strip
      b.box(0.7, 0.13, 0.02, '#fbf8f0', { x: 0.49 * s, y: 2.04, z: 0.49 * c, ry: a, cf: (x, y, z, wx, wy) => (Math.abs(wy - 2.04) < 0.03 && Math.floor((x + 1) * 30) % 2 ? rgb('#2a2a30') : rgb('#fbf8f0')) });
    }
    b.box(1.02, 0.16, 1.02, red, { y: 2.3, r: 0.04 });
    b.box(0.9, 0.1, 0.9, red, { y: 2.42, r: 0.04 });
    b.dome(0.62, red, { y: 2.46, sy: 0.24, seg: 4, ry: PI / 4, sx: 1, sz: 1 });
    b.ball(0.08, C.gold, { y: 2.62, seg: 8, sy: 0.6 });
    b.box(0.03, 0.12, 0.04, '#d8c050', { x: 0.36, y: 1.1, z: 0.5 }); // door handle
  },

  lamppost(b) {
    const blk = '#2a2c34';
    b.cyl(0.22, 0.28, 0.5, blk, { y: 0.25, seg: 10, df: crimp(10, 0.06) });
    b.cyl(0.12, 0.17, 0.3, blk, { y: 0.62, seg: 10 });
    b.cyl(0.07, 0.09, 3.0, blk, { y: 2.2, seg: 10 });
    b.torus(0.1, 0.03, '#e8b83a', { y: 0.78, rx: PI / 2, rs: 5, ts: 12 });
    b.box(0.9, 0.06, 0.06, blk, { y: 3.4, r: 0.02 }); // ladder bar
    for (const sx of [-0.45, 0.45]) b.ball(0.06, blk, { x: sx, y: 3.4, seg: 6 });
    b.cyl(0.14, 0.09, 0.15, blk, { y: 3.78, seg: 6 });
    b.cyl(0.24, 0.16, 0.55, '#ffe9a8', { y: 4.12, seg: 6, layer: 'glow' });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.box(0.03, 0.56, 0.03, blk, { x: Math.cos(a) * 0.21, y: 4.12, z: Math.sin(a) * 0.21, rz: -Math.cos(a) * 0.14, rx: Math.sin(a) * 0.14 }); }
    b.cone(0.3, 0.2, blk, { y: 4.48, seg: 6 });
    b.ball(0.06, blk, { y: 4.6, seg: 6 });
    b.cone(0.03, 0.1, blk, { y: 4.68, seg: 4 });
  },

  taxi(b) {
    const body = '#2a2a34';
    b.box(1.75, 0.75, 4.2, body, { y: 0.62, r: 0.22, rk: 2 });
    b.box(1.6, 0.75, 2.4, body, { y: 1.3, z: -0.35, r: 0.22, rk: 2 });
    // windows
    b.box(1.62, 0.5, 2.0, '#9fcfe2', { y: 1.35, z: -0.35, r: 0.1, cf: (x, y, z, wx, wy, wz) => (Math.abs(wz + 0.35) % 0.66 < 0.05 ? rgb(body) : rgb('#9fcfe2')) });
    b.box(1.4, 0.48, 0.1, '#bfe4f2', { y: 1.35, z: 0.85, rx: -0.2, r: 0.04 });
    // chrome grille and bumpers
    b.box(0.8, 0.4, 0.1, '#d8dde2', { y: 0.65, z: 2.08, r: 0.05, cf: (x, y, z, wx, wy) => (Math.floor(wy * 30) % 2 ? rgb('#9aa2aa') : rgb('#e6eaee')) });
    b.box(1.8, 0.14, 0.14, '#d8dde2', { y: 0.32, z: 2.1, r: 0.06 });
    b.box(1.8, 0.14, 0.14, '#d8dde2', { y: 0.32, z: -2.1, r: 0.06 });
    for (const sx of [-0.62, 0.62]) {
      b.cyl(0.14, 0.14, 0.08, '#fff6c0', { x: sx, y: 0.78, z: 2.1, rx: PI / 2, seg: 12, layer: 'glow' });
      b.cyl(0.17, 0.17, 0.06, '#d8dde2', { x: sx, y: 0.78, z: 2.08, rx: PI / 2, seg: 12 });
      b.box(0.18, 0.1, 0.05, '#ff5040', { x: sx, y: 0.7, z: -2.12, r: 0.02, layer: 'glow' });
    }
    for (const sx of [-0.82, 0.82]) for (const sz of [-1.35, 1.35]) {
      b.cyl(0.38, 0.38, 0.28, '#1c1c20', { x: sx, y: 0.38, z: sz, rz: PI / 2, seg: 14 });
      b.cyl(0.2, 0.2, 0.3, '#c8ccd2', { x: sx, y: 0.38, z: sz, rz: PI / 2, seg: 10 });
    }
    b.box(0.5, 0.16, 0.24, '#ffc93a', { y: 1.76, z: 0.1, r: 0.05, layer: 'glow' }); // TAXI light
    b.box(0.05, 0.05, 0.3, '#d8dde2', { x: 0.88, y: 1.05, z: 0.4 }); // door handle stripe
  },

  doubledecker(b) {
    const red = C.red;
    b.box(2.5, 4.1, 6.0, red, { y: 2.25, r: 0.3, rk: 2, fc: true, cf: (x, y, z, wx, wy) => (wy > 2.15 && wy < 2.35 ? rgb('#fbf8f0') : wy < 0.5 ? rgb('#3a3a40') : rgb(red)) });
    const win = (y, h) => {
      for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) b.box(0.05, h, 0.78, '#a8d8ea', { x: sx * 1.25, y, z: -2.35 + i * 0.92, r: 0.03, cf: (x, y2, z) => (y2 > 0 && z > 0.1 ? rgb('#e0f4fc') : rgb('#a8d8ea')) });
      b.box(2.1, h, 0.06, '#a8d8ea', { y, z: 3.0, r: 0.03 });
    };
    win(3.3, 0.9); win(1.5, 0.95);
    b.box(1.2, 0.3, 0.06, '#1c1c22', { y: 2.7, z: 3.02, r: 0.03 });
    b.box(1.1, 0.2, 0.08, '#ffd23f', { y: 2.7, z: 3.03, layer: 'glow' }); // destination board
    b.box(0.06, 1.9, 0.8, '#7a1a16', { x: 1.25, y: 1.25, z: 2.3, r: 0.02 }); // door
    for (const sx of [-0.85, 0.85]) {
      b.cyl(0.14, 0.14, 0.06, '#fff6c0', { x: sx, y: 0.7, z: 3.01, rx: PI / 2, seg: 10, layer: 'glow' });
    }
    for (const sx of [-1.15, 1.15]) for (const sz of [-1.9, 2.0]) {
      b.cyl(0.52, 0.52, 0.34, '#1c1c20', { x: sx, y: 0.52, z: sz, rz: PI / 2, seg: 14 });
      b.cyl(0.26, 0.26, 0.36, '#c8ccd2', { x: sx, y: 0.52, z: sz, rz: PI / 2, seg: 10 });
    }
    b.box(2.45, 0.1, 5.9, '#c42c26', { y: 4.33, r: 0.05 });
  },

  bandstand(b) {
    const green = '#3f7f5a', white = '#fbf8f0', gold = '#e8b83a';
    b.cyl(3.4, 3.5, 0.7, '#c9bfae', { y: 0.35, seg: 8, ry: PI / 8 });
    b.cyl(3.5, 3.5, 0.12, white, { y: 0.76, seg: 8, ry: PI / 8 });
    b.box(1.4, 0.35, 0.8, '#c9bfae', { y: 0.175, z: 3.5 }); // steps
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + PI / 8;
      const x = Math.cos(a) * 3.1, z = Math.sin(a) * 3.1;
      b.cyl(0.08, 0.1, 3.1, white, { x, y: 2.35, z, seg: 8 });
      b.cyl(0.16, 0.16, 0.18, gold, { x, y: 3.86, z, seg: 8 });
      // railings between columns (leave the front open)
      if (i !== 1) {
        const a2 = ((i + 1) / 8) * TAU + PI / 8;
        const x2 = Math.cos(a2) * 3.1, z2 = Math.sin(a2) * 3.1;
        b.rod([x, 1.7, z], [x2, 1.7, z2], 0.04, green, { seg: 5 });
        for (let k = 1; k < 6; k++) { const t = k / 6; b.rod([x + (x2 - x) * t, 0.82, z + (z2 - z) * t], [x + (x2 - x) * t, 1.7, z + (z2 - z) * t], 0.025, green, { seg: 4 }); }
      }
    }
    b.cyl(3.7, 3.7, 0.25, green, { y: 4.0, seg: 8, ry: PI / 8, cf: (x, y, z, wx, wy) => (wy < 3.92 ? rgb(white) : rgb(green)) });
    b.cyl(0.4, 3.7, 1.6, green, { y: 4.9, seg: 8, ry: PI / 8, fc: true, cf: (x, y, z) => (Math.floor((Math.atan2(z, x) + PI) / (TAU / 16)) % 2 ? rgb(green) : rgb('#4f9a6a')) });
    b.cyl(0.25, 0.45, 0.5, white, { y: 5.9, seg: 8 });
    b.ball(0.18, gold, { y: 6.2, seg: 8 });
    b.cone(0.06, 0.4, gold, { y: 6.5, seg: 6 });
    // scalloped valance
    for (let i = 0; i < 16; i++) { const a = ((i + 0.5) / 16) * TAU; b.ball(0.32, i % 2 ? white : '#d8342c', { x: Math.cos(a) * 3.55, y: 3.82, z: Math.sin(a) * 3.55, sx: 1.4, sz: 0.2, sy: 0.6, ry: -a + PI / 2, seg: 8, hseg: 4, tl: PI / 2, rx: PI }); }
  },
};
