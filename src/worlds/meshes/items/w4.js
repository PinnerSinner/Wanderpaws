// Item builders: W4 Snowy Highlands. Real metres, front faces +Z.
import { PI, TAU, crimp, lumpy, rgb, mixRgb, noise2, smooth } from '../util.js';

const C = {
  snow: '#f6f8ff', snowSh: '#d8e2f4', heather: '#9b6bb5', loch: '#3d6fa8', tartan: '#c0392b', wood: '#9a6b45',
  woodDk: '#6e4a2e', stone: '#9aa0a6', stoneDk: '#757b82', slate: '#4f5868', red: '#d8443a', ink: '#2f2a33',
  pine: '#2f6a4a', pineDk: '#245a3e', gold: '#e8b83a', cream: '#f6efe0',
};

// A woven tartan: red ground with green and navy bands crossing, plus a thin yellow overcheck.
const _t = [0, 0, 0];
export function tartan(u, v, scale = 1) {
  const band = (w) => {
    const p = ((w / scale) % 1 + 1) % 1;
    if (p < 0.22) return 1;             // green
    if (p > 0.4 && p < 0.52) return 2;  // navy
    if (p > 0.7 && p < 0.725) return 3; // yellow line
    return 0;
  };
  const cols = ['#c0392b', '#2f6a4a', '#27346a', '#f2c94c'];
  const a = rgb(cols[band(u)]), c = rgb(cols[band(v)]);
  _t[0] = (a[0] + c[0]) / 2; _t[1] = (a[1] + c[1]) / 2; _t[2] = (a[2] + c[2]) / 2;
  return [_t[0], _t[1], _t[2]];
}

const snowCap = (y0) => (x, y, z, wx, wy, wz, nx, ny) => (ny > 0.55 && wy > y0 ? rgb(C.snow) : null);

export const w4 = {
  shortbread(b) {
    for (let i = 0; i < 2; i++) {
      b.box(0.11, 0.022, 0.04, '#f2d08a', {
        x: i * 0.012, y: 0.011 + i * 0.022, z: i * 0.035 - 0.017, ry: i * 0.35, r: 0.006,
        cf: (x, y, z) => (y > 0.008 && (Math.abs(x % 0.025) < 0.004) && Math.abs(z) < 0.012 ? rgb('#c8944a') : rgb('#f2d08a')),
      });
      for (let k = 0; k < 4; k++) b.ball(0.0025, '#c8944a', { x: i * 0.012 - 0.036 + k * 0.024, y: 0.022 + i * 0.022, z: i * 0.035 - 0.017, seg: 4 });
    }
  },

  snowball(b) {
    b.ico(0.1, C.snow, { y: 0.095, detail: 2, df: lumpy(0.08, 30), cf: (x, y) => mixRgb('#d4e0f4', '#ffffff', smooth(-0.08, 0.06, y)) });
    b.ico(0.03, C.snow, { x: 0.09, y: 0.02, z: 0.04, detail: 1 });
  },

  thistle(b) {
    b.cyl(0.008, 0.012, 0.28, '#5f9a4a', { y: 0.14, seg: 5 });
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + 0.3;
      b.box(0.14, 0.006, 0.05, '#6aa84f', { x: Math.cos(a) * 0.06, y: 0.07 + i * 0.045, z: Math.sin(a) * 0.06, ry: -a, rz: 0.3, df: (v) => { v.z *= 1 + 0.5 * Math.sin(v.x * 80); }, cf: () => rgb('#6aa84f') });
    }
    b.ball(0.05, '#6aa84f', { y: 0.3, sy: 0.9, seg: 10, cf: (x, y, z) => (Math.sin(x * 300) * Math.sin(z * 300 + y * 200) > 0.3 ? rgb('#8ac86a') : rgb('#4f8a3a')) });
    b.cyl(0.055, 0.035, 0.08, C.heather, { y: 0.37, seg: 12, df: crimp(12, 0.18), cf: (x, y, z, wx, wy) => mixRgb('#7a3a9a', '#d08ae8', smooth(0.33, 0.41, wy)) });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; b.cone(0.01, 0.05, '#7cae5a', { x: Math.cos(a) * 0.045, y: 0.28, z: Math.sin(a) * 0.045, rz: -Math.cos(a) * 1.9, rx: Math.sin(a) * 1.9, seg: 4 }); }
  },

  snowflake(b) {
    const ice = (x, y, z, wx, wy) => mixRgb('#ffffff', '#8fd0f4', smooth(0.0, 0.14, Math.hypot(wx, wy - 0.15)));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const c = Math.cos(a), s = Math.sin(a);
      b.box(0.022, 0.15, 0.022, C.snow, { x: s * 0.075, y: 0.15 + c * 0.075, rz: -a, cf: ice });
      for (const k of [-1, 1]) b.box(0.016, 0.055, 0.016, C.snow, { x: s * 0.1 + c * k * 0.02, y: 0.15 + c * 0.1 - s * k * 0.02, rz: -a + k * 0.8, cf: ice });
    }
    b.cyl(0.03, 0.03, 0.024, C.snow, { y: 0.15, rx: PI / 2, seg: 6, cf: ice });
  },

  curlingstone(b) {
    b.cyl(0.24, 0.22, 0.17, C.stone, {
      y: 0.1, seg: 22, df: (v) => { const r = Math.hypot(v.x, v.z); if (Math.abs(v.y) > 0.07) { v.x *= 0.88; v.z *= 0.88; } void r; },
      cf: (x, y, z) => (Math.abs(y) < 0.025 ? rgb('#6a6f78') : mixRgb('#b4b8be', '#7c828a', smooth(-0.4, 0.6, noise2(x * 90, z * 90 + y * 60)))),
    });
    b.cyl(0.07, 0.08, 0.035, '#c0392b', { y: 0.19, seg: 12 });
    b.box(0.06, 0.06, 0.28, '#d8443a', { y: 0.235, z: 0.05, r: 0.025 });
    b.box(0.06, 0.03, 0.06, '#d8443a', { y: 0.205, z: -0.06, r: 0.01 });
  },

  tartanscarf(b) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([(t - 0.5) * 0.5, 0.03 + Math.sin(t * PI) * 0.03, Math.sin(t * TAU * 1.1) * 0.08]); }
    b.tube(pts, 0.045, C.tartan, { ts: 40, rs: 6, sy: 0.45, cf: (x, y, z, wx, wy, wz) => tartan(wx * 6 + wz * 3, wy * 4 + wz * 6 - wx * 3, 0.5) });
    for (const e of [0, 10]) for (let k = 0; k < 5; k++) b.box(0.006, 0.004, 0.03, '#c0392b', { x: pts[e][0] + (e ? 0.035 : -0.035), y: 0.03, z: pts[e][2] - 0.03 + k * 0.015, ry: PI / 2 });
  },

  bagpipes(b) {
    b.ball(0.26, C.tartan, { y: 0.24, sx: 1.2, sy: 0.85, sz: 0.85, seg: 16, rz: 0.2, fc: true, cf: (x, y, z) => tartan(x * 3 + 10, y * 3 + z * 2 + 10, 0.55) });
    const drone = (a, b2, len, r) => {
      const end = [a[0] + b2[0] * len, a[1] + b2[1] * len, a[2] + b2[2] * len];
      b.rod(a, end, r, '#2a2a30', { seg: 6 });
      b.cyl(r * 1.8, r * 1.4, 0.06, '#f2ead8', { x: end[0], y: end[1], z: end[2], rz: -Math.atan2(b2[0], b2[1]), seg: 8 });
      for (const t of [0.35, 0.7]) b.cyl(r * 1.5, r * 1.5, 0.025, '#f2ead8', { x: a[0] + b2[0] * len * t, y: a[1] + b2[1] * len * t, z: a[2] + b2[2] * len * t, rz: -Math.atan2(b2[0], b2[1]), seg: 8 });
    };
    drone([-0.1, 0.4, -0.05], [-0.35, 0.94, 0], 0.55, 0.018);
    drone([0.0, 0.42, -0.05], [-0.15, 0.99, 0], 0.48, 0.016);
    drone([0.1, 0.4, -0.05], [0.05, 0.99, 0], 0.42, 0.016);
    b.rod([0.22, 0.15, 0.08], [0.32, -0.12, 0.25], 0.02, '#2a2a30', { seg: 6 }); // chanter
    b.rod([0.25, 0.35, 0.05], [0.42, 0.55, 0.15], 0.012, '#2a2a30', { seg: 5 }); // blowpipe
    for (const [x, y] of [[-0.2, 0.75], [-0.05, 0.75]]) b.tube([[x, y, 0], [x + 0.08, y - 0.2, 0.02], [x + 0.03, y - 0.35, 0.03]], 0.01, '#c0392b', { ts: 8, rs: 4 });
    b.transform(0, 0.12, 0, 1, 1, 1);
  },

  sledge(b) {
    for (const sx of [-0.25, 0.25]) {
      const pts = [[sx, 0.03, -0.55], [sx, 0.02, 0.2], [sx, 0.06, 0.45], [sx, 0.22, 0.56], [sx, 0.3, 0.48]];
      b.tube(pts, 0.025, C.red, { ts: 18, rs: 5 });
      for (const z of [-0.4, 0.0, 0.3]) b.box(0.04, 0.2, 0.04, C.woodDk, { x: sx, y: 0.13, z });
    }
    for (let i = 0; i < 6; i++) b.box(0.62, 0.035, 0.12, i % 2 ? C.wood : '#b07a4a', { y: 0.25, z: -0.42 + i * 0.15, r: 0.012 });
    b.tube([[-0.22, 0.3, 0.5], [0, 0.2, 0.75], [0.22, 0.3, 0.5]], 0.012, '#e8d4a8', { ts: 10, rs: 4 }); // pull rope
    b.box(0.5, 0.04, 0.3, C.snow, { y: 0.29, z: -0.2, r: 0.02, df: lumpy(0.2, 10) }); // a dusting of snow
  },

  curlingbroom(b) {
    b.cyl(0.018, 0.018, 1.0, '#e8d4a8', { y: 0.06, z: -0.12, rx: PI / 2 - 0.05, seg: 8, cf: (x, y) => (y > 0.38 ? rgb('#3a3a40') : rgb('#e8d4a8')) });
    b.box(0.26, 0.06, 0.1, '#27346a', { y: 0.05, z: 0.42, r: 0.025 });
    b.box(0.24, 0.035, 0.08, '#2a2a30', { y: 0.017, z: 0.42, r: 0.01 });
    b.box(0.2, 0.02, 0.02, '#f2c94c', { y: 0.08, z: 0.47 });
  },

  haybale(b) {
    b.cyl(0.75, 0.75, 1.3, '#e8c060', {
      y: 0.75, rz: PI / 2, seg: 20,
      cf: (x, y, z, wx, wy, wz, nx) => (Math.abs(nx) > 0.9 ? mixRgb('#f2d27a', '#c89a3a', (Math.sin(Math.hypot(wy - 0.75, wz) * 30) + 1) * 0.4) : mixRgb('#f0cc6a', '#c8983a', smooth(-0.3, 0.6, noise2(wx * 8, Math.atan2(wy - 0.75, wz) * 12)))),
    });
    for (const sx of [-0.35, 0.35]) b.torus(0.755, 0.012, '#c8443a', { x: sx, y: 0.75, ry: PI / 2, rs: 3, ts: 24 });
    b.cyl(0.6, 0.65, 0.12, C.snow, { y: 1.47, seg: 14, df: lumpy(0.15, 4), sz: 0.6 });
  },

  woodsign(b) {
    for (const sx of [-0.6, 0.6]) b.cyl(0.06, 0.07, 1.8, C.woodDk, { x: sx, y: 0.9, seg: 7 });
    b.box(1.5, 0.6, 0.08, C.wood, { y: 1.3, r: 0.04, fc: true, cf: (x, y, z, wx, wy) => (Math.abs(wy - 1.3) < 0.15 && Math.abs(wx) < 0.55 && z > 0.035 ? (Math.floor((wx + 1) * 14) % 3 ? rgb('#f6efe0') : rgb(C.wood)) : Math.floor(wy * 12) % 2 ? rgb(C.wood) : rgb('#8a5e3a')) });
    b.box(1.6, 0.1, 0.16, C.snow, { y: 1.64, r: 0.05, df: lumpy(0.2, 6) });
    b.cyl(0.1, 0.1, 0.06, C.snow, { x: 0.6, y: 1.82, seg: 8 });
    b.cyl(0.1, 0.1, 0.06, C.snow, { x: -0.6, y: 1.82, seg: 8 });
  },

  skis(b) {
    for (const sx of [-0.12, 0.12]) {
      b.box(0.09, 0.025, 1.7, '#e8473a', {
        x: sx, y: 0.03, ws: 1, df: (v) => { if (v.z > 0.6) v.y += ((v.z - 0.6) / 0.25) ** 2 * 0.03; }, rk: 1,
        cf: (x, y, z) => (Math.abs(x) < 0.015 ? rgb('#ffffff') : rgb('#e8473a')),
      });
      b.box(0.09, 0.025, 0.2, '#e8473a', { x: sx, y: 0.1, z: 0.92, rx: -0.8 });
      b.box(0.1, 0.06, 0.24, '#3a3a40', { x: sx, y: 0.07, z: -0.05, r: 0.02 });
      b.box(0.1, 0.07, 0.06, '#ffd23f', { x: sx, y: 0.08, z: 0.1, r: 0.02 });
    }
  },

  snowman(b) {
    const snowC = (x, y, z) => mixRgb('#d0dcf2', '#ffffff', smooth(-0.3, 0.3, y));
    b.ico(0.62, C.snow, { y: 0.58, detail: 2, df: lumpy(0.03, 3), cf: snowC });
    b.ico(0.45, C.snow, { y: 1.22, detail: 2, df: lumpy(0.03, 3), cf: snowC });
    b.ico(0.32, C.snow, { y: 1.68, detail: 2, df: lumpy(0.03, 3), cf: snowC });
    b.cone(0.055, 0.3, '#ff8a2a', { y: 1.68, z: 0.42, rx: PI / 2, seg: 8 });
    for (const sx of [-0.11, 0.11]) b.ball(0.04, C.ink, { x: sx, y: 1.77, z: 0.27, seg: 6 });
    for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; b.ball(0.025, C.ink, { x: Math.sin(a) * 0.2, y: 1.58 - Math.cos(a) * 0.04 + 0.04, z: 0.27, seg: 5 }); }
    for (let i = 0; i < 3; i++) b.ball(0.045, C.ink, { y: 1.4 - i * 0.17, z: 0.4 + i * 0.015, seg: 6 });
    // tartan scarf with a dangling end
    b.torus(0.33, 0.07, C.tartan, { y: 1.47, rx: PI / 2, rs: 6, ts: 18, sz: 0.8, fc: true, cf: (x, y, z, wx, wy, wz) => tartan(wx * 5, wz * 5 + wy * 3, 0.5) });
    b.box(0.16, 0.42, 0.06, C.tartan, { x: 0.2, y: 1.28, z: 0.33, rz: 0.15, rx: -0.3, fc: true, cf: (x, y, z, wx, wy) => tartan(wx * 5, wy * 5, 0.5) });
    // stick arms
    for (const sx of [-1, 1]) {
      b.rod([sx * 0.38, 1.3, 0], [sx * 0.9, 1.62, 0.05], 0.025, '#6a4a2e', { seg: 5 });
      b.rod([sx * 0.78, 1.55, 0.04], [sx * 0.92, 1.72, 0.08], 0.017, '#6a4a2e', { seg: 4 });
    }
    // bobble hat
    b.dome(0.28, '#3d6fa8', { y: 1.86, sy: 0.85, seg: 12 });
    b.cyl(0.29, 0.29, 0.09, '#f6f8ff', { y: 1.88, seg: 14 });
    b.ball(0.08, '#f6f8ff', { y: 2.12, seg: 8 });
  },

  skiliftchair(b) {
    const blu = '#3d6fa8';
    b.box(1.6, 0.1, 0.55, blu, { y: 0.48, r: 0.04 });
    b.box(1.6, 0.6, 0.08, blu, { y: 0.8, z: -0.28, rx: -0.15, r: 0.04 });
    for (let i = 0; i < 4; i++) b.box(1.5, 0.04, 0.02, '#2a4a7a', { y: 0.62 + i * 0.12, z: -0.24 - i * 0.02, rx: -0.15 });
    for (const sx of [-0.82, 0.82]) {
      b.rod([sx, 0.45, 0.25], [sx, 0.45, -0.28], 0.03, '#8a9098', { seg: 6 });
      b.rod([sx, 0.45, -0.28], [sx * 0.95, 1.12, -0.36], 0.03, '#8a9098', { seg: 6 });
    }
    b.rod([-0.82, 1.12, -0.36], [0.82, 1.12, -0.36], 0.03, '#8a9098', { seg: 6 });
    // safety bar (raised)
    b.tube([[-0.8, 1.1, -0.3], [-0.8, 1.35, 0.15], [0.8, 1.35, 0.15], [0.8, 1.1, -0.3]], 0.025, '#ffd23f', { ts: 16, rs: 5, tension: 0.2 });
    b.rod([0, 1.12, -0.36], [0, 1.55, -0.2], 0.05, '#8a9098', { seg: 6 });
    b.box(0.3, 0.12, 0.12, '#5a5f66', { y: 1.58, z: -0.2, r: 0.03 });
    b.box(1.2, 0.05, 0.4, C.snow, { y: 0.55, r: 0.02, df: lumpy(0.3, 8) });
  },

  tractor(b) {
    const red = '#d8443a';
    b.box(1.1, 0.9, 2.2, red, { y: 1.15, z: 0.55, r: 0.15, rk: 2 });
    b.box(1.0, 0.25, 0.08, '#3a3a40', { y: 1.15, z: 1.66, cf: (x, y, z, wx, wy) => (Math.floor(wy * 30) % 2 ? rgb('#2a2a30') : rgb('#6a6a70')) });
    for (const sx of [-0.4, 0.4]) b.cyl(0.09, 0.09, 0.06, '#fff6c0', { x: sx, y: 1.42, z: 1.67, rx: PI / 2, seg: 8, layer: 'glow' });
    b.cyl(0.07, 0.07, 1.1, '#3a3a40', { x: 0.35, y: 2.0, z: 1.1, seg: 8 });
    b.cyl(0.09, 0.07, 0.1, '#3a3a40', { x: 0.35, y: 2.56, z: 1.1, seg: 8 });
    // cab
    b.box(1.5, 0.15, 1.5, red, { y: 1.5, z: -0.7, r: 0.04 });
    for (const sx of [-0.7, 0.7]) for (const sz of [-1.38, -0.02]) b.box(0.08, 1.25, 0.08, '#3a3a40', { x: sx, y: 2.18, z: sz });
    b.box(1.55, 0.12, 1.55, '#fbf8f0', { y: 2.84, z: -0.7, r: 0.04 });
    b.box(1.36, 1.1, 1.3, '#bfe4f2', { y: 2.15, z: -0.7, layer: 'trans', layerOpts: { opacity: 0.4 } });
    b.box(0.5, 0.45, 0.45, '#3a3a40', { y: 1.8, z: -0.7, r: 0.1 }); // seat
    b.cyl(0.18, 0.18, 0.04, '#2a2a30', { y: 2.15, z: -0.3, rx: 0.9, seg: 10 });
    // wheels: big back, small front
    for (const sx of [-0.92, 0.92]) {
      b.cyl(0.85, 0.85, 0.55, '#2a2a30', { x: sx, y: 0.85, z: -0.7, rz: PI / 2, seg: 16, fc: true, cf: (x, y, z) => (Math.abs(y) < 0.26 && Math.hypot(x, z) > 0.78 && Math.floor((Math.atan2(z, x) + PI) * 4) % 2 ? rgb('#1a1a1e') : rgb('#2a2a30')) });
      b.cyl(0.45, 0.45, 0.57, '#ffd23f', { x: sx, y: 0.85, z: -0.7, rz: PI / 2, seg: 12 });
      b.cyl(0.42, 0.42, 0.32, '#2a2a30', { x: sx * 0.78, y: 0.42, z: 1.2, rz: PI / 2, seg: 12 });
      b.cyl(0.22, 0.22, 0.34, '#ffd23f', { x: sx * 0.78, y: 0.42, z: 1.2, rz: PI / 2, seg: 10 });
      b.box(0.4, 0.06, 0.95, red, { x: sx * 0.95, y: 1.75, z: -0.7, r: 0.02 }); // mudguards
    }
  },

  lochboat(b) {
    b.ball(1, '#3d6fa8', {
      y: 0.62, sx: 0.85, sy: 0.6, sz: 2.4, seg: 18, hseg: 10, tl: PI / 2, rx: PI,
      df: (v) => { v.x *= 1 - 0.55 * Math.max(0, v.z) ** 3; v.y *= 1 - 0.2 * Math.abs(v.z); },
      cf: (x, y, z, wx, wy) => (wy > 0.5 ? rgb('#fbf8f0') : wy > 0.38 ? rgb('#d8443a') : rgb('#3d6fa8')),
    });
    b.ball(1, '#c8925a', { y: 0.6, sx: 0.78, sy: 0.02, sz: 2.25, seg: 14, hseg: 4, df: (v) => { v.x *= 1 - 0.55 * Math.max(0, v.z) ** 3; } });
    for (const z of [-1.2, 0.0, 1.0]) b.box(1.3 - Math.abs(z) * 0.2, 0.06, 0.32, '#a8743e', { y: 0.55, z, r: 0.02 });
    for (const sx of [-1, 1]) b.rod([sx * 0.2, 0.62, -0.2], [sx * 1.6, 0.12, 0.5], 0.035, '#b07a4a', { seg: 5 });
    for (const sx of [-1, 1]) b.box(0.18, 0.02, 0.5, '#b07a4a', { x: sx * 1.55, y: 0.14, z: 0.48, ry: sx * 0.9, r: 0.01 });
    b.transform(0, 0.38, 0, 1, 1, 1);
  },

  standingstone(b) {
    b.box(1.6, 4.0, 0.8, C.stone, {
      y: 2.0, rz: 0.05, r: 0.3, rk: 2, df: lumpy(0.08, 0.8, 5),
      cf: (x, y, z, wx, wy, wz, nx, ny) => {
        if (nz(nx, ny) && Math.abs(Math.hypot(wx - 0.05, wy - 2.6) - 0.35) < 0.05 && wz > 0) return rgb('#6a6f78');
        if (ny > 0.6) return rgb(C.snow);
        return noise2(wx * 5, wy * 5) > 0.7 ? rgb('#b4bc8a') : mixRgb('#a8aeb4', '#7a8088', smooth(-0.5, 0.5, noise2(wx * 4, wy * 3 + wz)));
      },
    });
    for (let i = 0; i < 5; i++) { const a = i * 1.3; b.ball(0.32, C.heather, { x: Math.cos(a) * 1.1, y: 0.15, z: Math.sin(a) * 0.8, sy: 0.6, seg: 8, df: lumpy(0.2, 4) }); }
  },

  bothy(b) {
    const stoneC = (x, y, z, wx, wy, wz) => { const row = Math.floor(wy * 2.4); const col = Math.floor((wx + wz + (row % 2) * 0.35) * 1.4); const k = ((row * 31 + col * 17) % 7) / 7; return mixRgb('#b4b0a8', '#848078', k * 0.8); };
    b.box(6.0, 3.0, 4.4, '#a8a49c', { y: 1.5, fc: true, cf: stoneC });
    b.extrude([[-2.2, 0], [2.2, 0], [0, 1.6]], 6.0, '#a8a49c', { y: 3.0, ry: PI / 2, fc: true, cf: stoneC });
    // slate roof planes with snow
    for (const s of [-1, 1]) b.box(6.5, 0.14, 2.9, C.slate, { y: 3.85, z: s * 1.18, rx: s * 0.63, r: 0.03, fc: true, cf: (x, y, z, wx, wy) => (wy > 4.4 ? rgb(C.snow) : Math.floor(wy * 5) % 2 ? rgb('#4f5868') : rgb('#5f6878')) });
    b.box(6.6, 0.22, 0.3, C.snow, { y: 4.62, r: 0.1 });
    b.box(0.9, 1.6, 0.9, '#a8a49c', { x: 2.4, y: 4.6, fc: true, cf: stoneC });
    b.cyl(0.18, 0.18, 0.3, '#c8683c', { x: 2.4, y: 5.5, seg: 8 });
    b.box(1.0, 1.8, 0.12, '#d8443a', { y: 0.9, z: 2.22, r: 0.04 });
    b.ball(0.05, C.gold, { x: 0.32, y: 0.9, z: 2.3, seg: 6 });
    for (const sx of [-1.8, 1.8]) {
      b.box(0.9, 0.8, 0.1, '#ffd98a', { x: sx, y: 1.7, z: 2.21, layer: 'glow' });
      b.box(1.1, 0.1, 0.16, '#fbf8f0', { x: sx, y: 2.15, z: 2.24 });
      b.box(1.1, 0.1, 0.2, '#fbf8f0', { x: sx, y: 1.25, z: 2.26 });
      b.box(0.06, 0.8, 0.12, '#fbf8f0', { x: sx, y: 1.7, z: 2.25 });
    }
    b.box(1.6, 0.6, 0.8, '#9a6b45', { x: -2.4, y: 0.3, z: 2.7, r: 0.04, fc: true, cf: (x, y, z, wx, wy) => (Math.floor(wy * 8) % 2 ? rgb('#9a6b45') : rgb('#7a4e30')) }); // log pile
  },

  pinetree(b) {
    b.cyl(0.35, 0.5, 2.4, '#6e4a2e', { y: 1.2, seg: 8 });
    const tiers = [[3.2, 3.6, 1.7], [2.6, 3.2, 4.2], [1.9, 2.9, 6.6], [1.2, 2.5, 8.8]];
    for (const [r, h, y] of tiers) {
      b.cone(r, h, C.pine, {
        y: y + h / 2, seg: 10, hs: 2, df: (v) => { const th = Math.atan2(v.z, v.x); const k = 1 + 0.1 * Math.cos(th * 5); if (v.y < -h / 2 + 0.01) { v.x *= k; v.z *= k; v.y += 0.25 * Math.cos(th * 5); } },
        cf: (x, y2, z, wx, wy, wz, nx, ny) => (y2 > h * 0.3 + 0.15 * Math.sin(Math.atan2(z, x) * 5) ? rgb(C.snow) : y2 < -h * 0.47 ? rgb('#e8eef8') : mixRgb('#3a7a52', '#1f4a36', smooth(h * 0.1, -h / 2, y2))),
      });
    }
    b.cone(0.5, 1.4, C.snow, { y: 11.3, seg: 8 });
    b.octa(0.35, '#ffd23f', { y: 12.0, sy: 1.2, detail: 0 });
  },

  cottage(b) {
    const white = '#f6efe0';
    b.box(10.0, 4.0, 6.0, white, { y: 2.0, r: 0.15, cf: (x, y, z, wx, wy) => (wy < 0.5 ? rgb('#c8c0b0') : mixRgb(white, '#e4dccb', smooth(-0.3, 0.8, noise2(wx * 0.8, wy * 0.8)))) });
    b.extrude([[-3.0, 0], [3.0, 0], [0, 2.6]], 10.0, white, { y: 4.0, ry: PI / 2 });
    // thick thatch roof with snow
    for (const s of [-1, 1]) b.box(10.8, 0.5, 4.3, '#c8a050', { y: 5.25, z: s * 1.6, rx: s * 0.72, r: 0.25, rk: 2, fc: true, cf: (x, y, z, wx, wy) => (wy > 5.7 ? rgb(C.snow) : Math.floor(wy * 3) % 2 ? rgb('#c8a050') : rgb('#b08840')) });
    b.capsule(0.35, 10.4, C.snow, { y: 6.65, rz: PI / 2, seg: 8 });
    for (const sx of [-4.4, 4.4]) { b.box(1.0, 2.2, 1.0, white, { x: sx, y: 7.0 }); b.box(1.2, 0.2, 1.2, '#8a8478', { x: sx, y: 8.15 }); b.cyl(0.18, 0.18, 0.4, '#c8683c', { x: sx, y: 8.45, seg: 8 }); }
    b.box(1.3, 2.3, 0.15, '#3d6fa8', { y: 1.15, z: 3.02, r: 0.06 });
    b.box(1.6, 0.2, 0.5, '#8a8478', { y: 2.4, z: 3.2 });
    for (const sx of [-3.0, 3.0]) {
      b.box(1.6, 1.3, 0.12, '#ffd98a', { x: sx, y: 2.2, z: 3.01, layer: 'glow' });
      b.box(1.8, 0.14, 0.2, '#3d6fa8', { x: sx, y: 2.9, z: 3.06 });
      b.box(0.1, 1.3, 0.16, '#3d6fa8', { x: sx, y: 2.2, z: 3.05 });
      b.box(1.8, 0.14, 0.3, '#3d6fa8', { x: sx, y: 1.5, z: 3.1 });
      b.box(1.6, 0.25, 0.35, '#5aa04a', { x: sx, y: 1.65, z: 3.25, r: 0.1 }); // window box
      for (let k = 0; k < 4; k++) b.ball(0.12, ['#ff5d73', '#ffd23f', '#b98cff', '#fff'][k], { x: sx - 0.6 + k * 0.4, y: 1.85, z: 3.3, seg: 6 });
    }
  },

  lighthouse(b) {
    b.cyl(4.2, 4.6, 1.2, '#8a8478', { y: 0.6, seg: 14, df: lumpy(0.04, 0.6) });
    b.cyl(2.0, 2.8, 15.0, '#fbf8f0', {
      y: 8.7, seg: 18, hs: 6, fc: true,
      cf: (x, y, z, wx, wy) => (Math.floor((wy - 1.2) / 2.5) % 2 ? rgb('#d8443a') : rgb('#fbf8f0')),
    });
    b.cyl(2.6, 2.6, 0.4, '#3a3a40', { y: 16.4, seg: 18 });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; b.box(0.08, 0.9, 0.08, '#3a3a40', { x: Math.cos(a) * 2.5, y: 17.05, z: Math.sin(a) * 2.5 }); }
    b.torus(2.5, 0.06, '#3a3a40', { y: 17.5, rx: PI / 2, rs: 4, ts: 24 });
    b.cyl(1.5, 1.5, 2.2, '#fff2b0', { y: 17.7, seg: 12, layer: 'glow', blink: [0.25, 0] });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.box(0.1, 2.2, 0.1, '#3a3a40', { x: Math.cos(a) * 1.52, y: 17.7, z: Math.sin(a) * 1.52 }); }
    b.cone(1.9, 1.8, '#d8443a', { y: 19.7, seg: 12 });
    b.ball(0.3, '#3a3a40', { y: 20.7, seg: 8 });
    b.rod([0, 20.7, 0], [0, 21.9, 0], 0.06, '#3a3a40', { seg: 4 });
    b.box(1.1, 2.0, 0.2, '#3d6fa8', { y: 2.2, z: 2.68, r: 0.1 });
    for (const y of [6, 10, 13.5]) b.box(0.7, 1.0, 0.2, '#3a4a6a', { y, z: 2.62 - (y - 1.2) * 0.053, rx: -0.05, r: 0.05 });
    b.cyl(4.25, 4.25, 0.2, C.snow, { y: 1.25, seg: 14, df: lumpy(0.05, 1) });
  },

  skiliftpylon(b) {
    const steel = '#c8ccd2', dk = '#8a9098';
    b.cyl(1.0, 1.3, 0.8, '#9a9a94', { y: 0.4, seg: 8 });
    b.cyl(0.45, 0.6, 20.0, steel, { y: 10.4, seg: 10, cf: (x, y, z, wx, wy) => (wy > 19 ? rgb('#d8443a') : rgb(steel)) });
    b.box(8.0, 0.6, 0.6, dk, { y: 20.6, r: 0.1 });
    for (const sx of [-3.6, 3.6]) {
      b.box(2.2, 0.3, 0.5, steel, { x: sx, y: 20.1, r: 0.08 });
      for (let i = 0; i < 4; i++) b.cyl(0.25, 0.25, 0.18, '#3a3a40', { x: sx - 0.75 + i * 0.5, y: 19.85, rx: PI / 2, seg: 10 });
      b.rod([sx, 20.6, 0], [sx * 0.15, 18.0, 0], 0.12, dk, { seg: 6 });
    }
    // maintenance ladder and a little platform
    for (let i = 0; i < 18; i++) b.box(0.6, 0.06, 0.06, dk, { y: 1.5 + i * 1.0, z: 0.62 });
    b.box(2.0, 0.12, 1.4, dk, { y: 21.2, r: 0.04 });
    b.box(2.0, 0.6, 0.06, '#ffd23f', { y: 21.6, z: 0.68 });
    b.ball(0.25, '#ff4040', { y: 22.4, seg: 8, layer: 'glow', blink: [0.5, 0] });
    b.cyl(1.25, 1.35, 0.2, C.snow, { y: 0.85, seg: 8 });
  },

  castleturret(b) {
    const stoneC = (x, y, z, wx, wy, wz) => { const row = Math.floor(wy * 0.9); const col = Math.floor((Math.atan2(wz, wx) * 6) + (row % 2) * 0.5); return mixRgb('#b8b2a6', '#8c867a', (((row * 13 + col * 7) % 5) / 5) * 0.8); };
    b.cyl(6.5, 7.5, 20.0, '#b0aa9e', { y: 10.0, seg: 16, hs: 10, fc: true, cf: stoneC });
    b.cyl(7.6, 7.6, 1.0, '#a09a8e', { y: 20.5, seg: 16 });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; if (i % 2) b.box(2.0, 1.4, 1.2, '#b0aa9e', { x: Math.cos(a) * 7.0, y: 21.7, z: Math.sin(a) * 7.0, ry: -a }); }
    b.cone(6.6, 7.0, C.slate, { y: 24.4, seg: 16, fc: true, cf: (x, y, z, wx, wy) => (wy > 25.5 ? rgb(C.snow) : Math.floor(wy * 1.2) % 2 ? rgb('#4f5868') : rgb('#5f6878')) });
    b.rod([0, 27.8, 0], [0, 30.5, 0], 0.12, '#3a3a40', { seg: 4 });
    b.extrude([[0, 0], [2.6, 0.5], [0, 1.2]], 0.06, '#3d6fa8', { y: 29.2, cf: (x, y) => (Math.abs(y - 0.6) < 0.12 ? rgb('#ffffff') : rgb('#3d6fa8')) });
    // arrow slits and a door
    for (let i = 0; i < 5; i++) { const a = -PI / 2 + 0.2 + i * 1.25; b.box(0.4, 1.8, 0.4, '#3a3a40', { x: Math.cos(a + PI) * 0, y: 7 + (i % 3) * 4.5, z: 0, ...((p) => ({ x: Math.sin(a) * 6.95, z: Math.cos(a) * 6.95, ry: a }))() }); }
    b.box(2.4, 3.6, 0.6, '#6e4a2e', { y: 1.8, z: 7.3, r: 0.3 });
    b.cyl(1.2, 1.2, 0.6, '#6e4a2e', { y: 3.6, z: 7.3, rx: PI / 2, seg: 12, tl: PI, ts: -PI / 2 });
  },

  castlekeep(b) {
    const stoneC = (x, y, z, wx, wy, wz) => { const row = Math.floor(wy * 0.8); const col = Math.floor((wx + wz) * 0.6 + (row % 2) * 0.5); return mixRgb('#bab4a8', '#8e887c', (((row * 13 + col * 7) % 5) / 5) * 0.75); };
    b.box(24, 22, 20, '#b0aa9e', { y: 11, fc: true, cf: stoneC, ws: 1 });
    // crenellations
    for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {
      b.box(1.8, 1.6, 1.0, '#b0aa9e', { x: -11 + i * 2.75, y: 22.8, z: s * 9.6 });
      if (i < 7) b.box(1.0, 1.6, 1.8, '#b0aa9e', { x: s * 11.6, y: 22.8, z: -8.2 + i * 2.75 });
    }
    // corner towers with slate cones
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.cyl(3.4, 3.6, 28, '#b0aa9e', { x: sx * 12, y: 14, z: sz * 10, seg: 12, fc: true, cf: stoneC });
      b.cone(4.0, 6.5, C.slate, { x: sx * 12, y: 31.2, z: sz * 10, seg: 12, cf: (x, y, z, wx, wy) => (wy > 32.5 ? rgb(C.snow) : rgb('#4f5868')) });
    }
    b.rod([12, 34.4, 10], [12, 36, 10], 0.15, '#3a3a40', { seg: 4 });
    b.extrude([[0, 0], [3, 0.6], [0, 1.2]], 0.08, '#d8443a', { x: 12, y: 34.8, z: 10 });
    // gate with portcullis
    b.box(6, 8, 1.2, '#4a3a2e', { y: 4, z: 10.2, r: 0.3, cf: (x, y, z, wx, wy) => (Math.floor((wx + 10) * 1.6) % 2 || Math.floor(wy * 1.6) % 2 ? rgb('#3a3a40') : rgb('#5a4a3e')) });
    b.cyl(3, 3, 1.2, '#4a3a2e', { y: 8, z: 10.2, rx: PI / 2, seg: 14, tl: PI, ts: -PI / 2 });
    for (const sx of [-6, 6]) for (const y of [10, 16]) b.box(1.4, 2.6, 0.4, '#ffd98a', { x: sx, y, z: 10.05, layer: 'glow' });
    b.box(24.4, 0.5, 20.4, C.snow, { y: 22.1, r: 0.2 });
  },
};

function nz(nx, ny) { return Math.abs(ny) < 0.5; }
