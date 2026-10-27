// Item builders: W5 The Marcoverse (giant tech, storybook-soft neon). Real metres, front +Z.
import { PI, TAU, crimp, lumpy, rgb, mixRgb, noise2, smooth } from '../util.js';
import { canvasTexture, FONT } from '../textures.js';
import { shared, eyes } from './w1.js';

const C = {
  lilac: '#b9a3ff', mint: '#7fe3c4', amber: '#ffb347', navy: '#2b2350', pink: '#ff7ad9', sky: '#8fd0ff',
  steel: '#c8cce0', dark: '#3a3456', cream: '#fff6e6', white: '#fbf8ff', ink: '#2f2a33',
};

const digit1 = [[-0.12, 0], [0.32, 0], [0.32, 0.14], [0.17, 0.14], [0.17, 0.9], [0.05, 0.9], [-0.16, 0.72], [-0.1, 0.62], [0.03, 0.7], [0.03, 0.14], [-0.12, 0.14]];

function screenTex(THREE) {
  return canvasTexture(THREE, 'monitor-screen', 512, 320, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3b2f7a'); g.addColorStop(1, '#2a2350');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.font = `700 26px ${FONT}`; ctx.textBaseline = 'top';
    const lines = [['#7fe3c4', '$ ping oli'], ['#fff6e6', '64 bytes: woof=1 ttl=64'], ['#fff6e6', '64 bytes: woof=2 ttl=64'], ['#ffb347', '$ sudo fetch --ball'], ['#ff9ed9', 'Good boy detected.'], ['#7fe3c4', '$ _']];
    lines.forEach(([c, t], i) => { ctx.fillStyle = c; ctx.fillText(t, 26, 24 + i * 46); });
  });
}

export const w5 = {
  bit(b) {
    // "10": binary for two, chunky and glowing at the edges
    b.extrude(digit1, 0.3, C.mint, { x: -0.3, bevel: 0.04, curve: 4, cf: (x, y, z, wx, wy, wz) => (Math.abs(wz) > 0.14 ? rgb('#c8fff0') : rgb(C.mint)) });
    b.torus(0.27, 0.11, C.lilac, { x: 0.28, y: 0.45, sy: 1.55, rs: 8, ts: 18 });
    b.box(1.1, 0.06, 0.45, C.dark, { y: 0.0, r: 0.02 });
  },

  cookie(b) {
    const bite = (v) => { const d = Math.hypot(v.x - 0.5, v.z - 0.3); if (d < 0.2) { const k = 0.2 / Math.max(d, 1e-3); v.x = 0.5 + (v.x - 0.5) * k; v.z = 0.3 + (v.z - 0.3) * k; } };
    b.cyl(0.6, 0.6, 0.22, '#e8b56a', {
      y: 0.11, seg: 28, hs: 2, df: (v) => { crimp(9, 0.03)(v); bite(v); if (v.y > 0.05) v.y += 0.05 * (1 - Math.hypot(v.x, v.z) / 0.6); },
      cf: (x, y, z, wx, wy) => mixRgb('#f2c27c', '#c88a44', smooth(-0.4, 0.8, noise2(x * 8, z * 8)) * 0.7 + (wy < 0.05 ? 0.3 : 0)),
    });
    for (let i = 0; i < 9; i++) { const a = i * 2.3, r = 0.12 + (i % 3) * 0.14; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - 0.5, z - 0.3) < 0.28) continue; b.ico(0.055, '#5a3524', { x, y: 0.27 - r * 0.07, z, sy: 0.7, detail: 0 }); }
    for (let i = 0; i < 3; i++) b.ico(0.04, '#e8b56a', { x: 0.75 + i * 0.07, y: 0.03, z: 0.42 - i * 0.12, detail: 0 }); // crumbs
  },

  packet(b) {
    // an envelope-like data packet with a stripy header
    b.box(1.4, 0.95, 0.9, C.cream, { y: 0.475, r: 0.14, rk: 2 });
    b.box(1.42, 0.22, 0.92, C.lilac, { y: 0.82, r: 0.1, cf: (x, y, z, wx) => (wx < -0.3 ? rgb(C.mint) : wx < 0.2 ? rgb(C.lilac) : rgb(C.amber)) });
    b.extrude([[-0.62, 0], [0.62, 0], [0, -0.42]], 0.04, '#f2e4cc', { y: 0.7, z: 0.46 });
    b.ball(0.11, '#ff5d73', { y: 0.36, z: 0.47, sz: 0.4, seg: 10 }); // wax seal
    for (let i = 0; i < 4; i++) b.box(0.08, 0.08, 0.02, i % 2 ? C.navy : '#7f75b8', { x: -0.5 + i * 0.12, y: 0.15, z: 0.455 });
  },

  sdcard(b) {
    const sh = [[-0.7, -1.0], [0.7, -1.0], [0.7, 0.75], [0.45, 1.0], [-0.7, 1.0]];
    b.extrude(sh, 0.12, C.navy, { y: 0.06, rx: -PI / 2, bevel: 0.03 });
    b.box(1.15, 0.03, 1.1, C.cream, { y: 0.14, z: 0.25, r: 0.04 });
    b.box(1.15, 0.035, 0.3, C.amber, { y: 0.145, z: -0.15, r: 0.03 });
    b.box(0.5, 0.04, 0.12, C.lilac, { x: -0.25, y: 0.15, z: 0.45 });
    for (let i = 0; i < 8; i++) b.box(0.11, 0.02, 0.28, '#f2c94c', { x: -0.52 + i * 0.15, y: 0.13, z: -0.82 });
    b.box(0.08, 0.04, 0.3, '#e8e8f0', { x: -0.74, y: 0.06, z: 0.3 });
  },

  rj45(b) {
    b.box(0.7, 0.5, 1.0, '#dff2ff', { y: 0.3, z: 0.1, r: 0.06, layer: 'trans', layerOpts: { opacity: 0.55 } });
    for (let i = 0; i < 8; i++) b.box(0.05, 0.1, 0.5, '#f2c94c', { x: -0.27 + i * 0.077, y: 0.5, z: 0.3 });
    const wires = ['#ff9a3c', '#fff6e6', '#7fe3c4', '#3d6fa8', '#fff6e6', '#7fe3c4', '#a0603a', '#fff6e6'];
    wires.forEach((c, i) => b.cyl(0.03, 0.03, 0.5, c, { x: -0.27 + i * 0.077, y: 0.28, z: -0.15, rx: PI / 2, seg: 5 }));
    b.box(0.3, 0.06, 0.7, '#dff2ff', { y: 0.58, z: 0.0, rx: 0.25, r: 0.02 }); // latch
    b.box(0.76, 0.56, 0.45, '#5a8ae8', { y: 0.3, z: -0.55, r: 0.15 }); // boot
    b.cyl(0.18, 0.2, 0.8, '#5a8ae8', { y: 0.25, z: -1.05, rx: PI / 2, seg: 10 });
    b.transform(0, 0, 0, 1, 1, 1);
  },

  usbstick(b) {
    b.box(0.85, 0.42, 2.0, C.lilac, { y: 0.21, z: -0.3, r: 0.18, rk: 2 });
    b.box(0.7, 0.28, 0.9, '#e8eaf4', { y: 0.21, z: 1.1, r: 0.02, cf: (x, y, z, wx, wy, wz) => (wy > 0.33 && Math.abs(wx) > 0.1 && Math.abs(wx) < 0.25 && Math.abs(wz - 1.2) < 0.12 ? rgb('#3a3456') : rgb('#e8eaf4')) });
    b.box(0.5, 0.1, 0.5, '#f2f2f8', { y: 0.22, z: 1.15 });
    b.torus(0.18, 0.05, C.mint, { y: 0.21, z: -1.4, rx: PI / 2, rs: 5, ts: 12 });
    b.ball(0.06, '#7fffc8', { x: 0.25, y: 0.43, z: 0.4, seg: 6, layer: 'glow', blink: [1.2, 0] });
  },

  teaurn(b) {
    b.cyl(1.0, 0.95, 2.6, '#dfe3ee', { y: 1.5, seg: 20, cf: (x, y, z, wx, wy) => (Math.abs(x + 0.35) < 0.2 && z > 0 ? rgb('#f8f8ff') : mixRgb('#e8ecf6', '#a8aec2', smooth(0.6, -0.9, x))) });
    b.cyl(0.85, 0.9, 0.2, '#3a3456', { y: 0.1, seg: 16 });
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + PI / 2; b.cyl(0.1, 0.12, 0.25, '#3a3456', { x: Math.cos(a) * 0.75, y: 0.1, z: Math.sin(a) * 0.75, seg: 6 }); }
    b.lathe([[0, 3.25], [0.3, 3.2], [0.85, 2.95], [1.02, 2.82], [1.0, 2.78], [0, 2.78]], '#dfe3ee', { seg: 20 });
    b.ball(0.18, '#3a3456', { y: 3.3, sy: 0.7, seg: 10 });
    for (const sx of [-1, 1]) b.torus(0.3, 0.07, '#3a3456', { x: sx * 1.05, y: 2.2, ry: PI / 2, arc: PI, rz: sx > 0 ? -PI / 2 : PI / 2, rs: 5, ts: 10 });
    b.box(0.2, 0.2, 0.4, '#3a3456', { y: 0.8, z: 1.05, r: 0.05 });
    b.box(0.35, 0.12, 0.12, '#3a3456', { y: 0.98, z: 1.15, r: 0.04 });
    b.cyl(0.06, 0.06, 0.2, '#3a3456', { y: 0.62, z: 1.22, seg: 6 });
    b.ball(0.07, '#ff5040', { x: 0.5, y: 1.4, z: 0.85, seg: 8, layer: 'glow', blink: [0, 0] });
    b.box(0.6, 0.3, 0.04, C.cream, { x: -0.1, y: 1.9, z: 0.97, r: 0.05, cf: (x, y) => (Math.abs(y) < 0.04 ? rgb('#c0392b') : rgb(C.cream)) }); // TEA label stripe
  },

  mouse(b) {
    b.ball(1, C.white, {
      y: 0, sx: 1.05, sy: 0.75, sz: 1.5, seg: 22, hseg: 10, tl: PI / 2,
      df: (v) => { v.y *= 1 + 0.25 * (v.z < 0 ? -v.z * 0.6 : -v.z * 0.4); },
      cf: (x, y, z, wx, wy, wz) => (wz > 0.15 && Math.abs(wx) < 0.04 ? rgb(C.lilac) : wz > 0.15 ? rgb('#f4f0ff') : rgb(C.white)),
    });
    b.box(2.0, 0.08, 2.9, C.lilac, { y: 0.04, r: 0.04, sx: 1, sz: 1, df: (v) => { const k = 1 - 0.15 * Math.abs(v.z / 1.45); v.x *= k; } });
    b.capsule(0.09, 0.22, '#7f75b8', { y: 0.7, z: 0.75, rx: PI / 2, rz: PI / 2, seg: 8 });
    b.tube([[0, 0.15, 1.45], [0, 0.1, 2.2], [0.6, 0.06, 2.6], [1.3, 0.06, 2.4]], 0.07, '#7f75b8', { ts: 16, rs: 5 });
  },

  floppy(b) {
    b.box(3.0, 0.2, 3.0, '#3a7ad8', { y: 0.1, r: 0.06, df: (v) => { if (v.x > 1.25 && v.z > 1.25) { v.x -= 0.18; } } });
    b.box(1.5, 0.22, 1.05, '#d8dce8', { x: 0.1, y: 0.11, z: -0.95, r: 0.03 });
    b.box(0.45, 0.24, 0.7, '#3a3456', { x: 0.35, y: 0.11, z: -1.05 });
    b.box(2.2, 0.22, 1.5, C.cream, { y: 0.115, z: 0.62, r: 0.04, cf: (x, y, z, wx, wy, wz) => (Math.floor((wz + 2) * 5) % 2 && wz > 0.3 ? rgb('#c8c0e8') : wz < 0.12 ? rgb(C.pink) : rgb(C.cream)) });
    b.box(0.2, 0.22, 0.2, '#2a2a40', { x: -1.25, y: 0.12, z: 1.25 });
  },

  handshake(b) {
    // two chunky mitten hands meeting in the middle: SYN, SYN-ACK, ACK
    const hand = (sx, col, cuff) => {
      b.capsule(0.32, 0.7, cuff, { x: sx * 1.05, y: 1.2, rz: PI / 2, seg: 12 });
      b.box(0.9, 0.62, 0.9, col, { x: sx * 0.35, y: 1.22, r: 0.28, rk: 2, rz: sx * 0.08 });
      b.capsule(0.15, 0.3, col, { x: sx * 0.15, y: 1.6, z: 0.35, rz: sx * 0.9, seg: 8 }); // thumb
    };
    hand(-1, '#ffd6b8', C.mint);
    hand(1, '#e8b48a', C.lilac);
    for (let i = 0; i < 3; i++) b.box(0.2, 0.08, 0.95, '#d8a07a', { y: 1.08 + i * 0.14, x: 0.02 });
    b.cyl(0.9, 1.0, 0.2, C.dark, { y: 0.1, seg: 16 });
    b.cyl(0.12, 0.14, 0.9, C.dark, { y: 0.6, seg: 8 });
    // three sparkles for the three-way handshake
    for (let i = 0; i < 3; i++) b.octa(0.12, C.amber, { x: -0.6 + i * 0.6, y: 2.1 + (i % 2) * 0.2, layer: 'glow' });
  },

  debugduck(b) {
    const Y = '#ffd23f';
    b.ball(1.7, Y, { y: 1.3, sx: 1, sy: 0.72, sz: 1.22, seg: 16 });
    b.ball(0.6, Y, { y: 1.5, z: -1.9, sx: 1.2, sy: 0.6, sz: 1.2, rx: -0.6, seg: 8 });
    b.ball(1.1, Y, { y: 3.0, z: 0.9, seg: 16 });
    b.ball(0.55, '#ff9a3c', { y: 2.75, z: 2.0, sx: 1.25, sy: 0.45, sz: 1.1, seg: 10 });
    for (const sx of [-1, 1]) {
      b.ball(0.2, C.ink, { x: sx * 0.42, y: 3.3, z: 1.8, seg: 8 });
      b.torus(0.3, 0.06, C.dark, { x: sx * 0.42, y: 3.3, z: 1.9, rs: 5, ts: 14 }); // specs
      b.ball(0.7, '#ffc21a', { x: sx * 1.4, y: 1.5, z: -0.2, sx: 0.4, sy: 0.7, sz: 1.2, seg: 8 });
    }
    b.box(0.3, 0.06, 0.08, C.dark, { y: 3.3, z: 1.95 });
    // headset with a mic boom, and a lanyard badge
    b.torus(1.08, 0.08, C.dark, { y: 3.05, z: 0.9, arc: PI, rz: 0, ry: PI / 2, rs: 5, ts: 16 });
    for (const sx of [-1, 1]) b.cyl(0.25, 0.25, 0.18, C.lilac, { x: sx * 1.08, y: 3.0, z: 0.9, rz: PI / 2, seg: 10 });
    b.tube([[1.1, 2.9, 1.0], [0.9, 2.5, 1.6], [0.45, 2.45, 2.1]], 0.05, C.dark, { ts: 10, rs: 4 });
    b.ball(0.12, C.mint, { x: 0.45, y: 2.45, z: 2.12, seg: 6 });
    b.box(0.5, 0.65, 0.06, C.cream, { y: 1.75, z: 1.95, rx: -0.3, r: 0.05, cf: (x, y) => (y > 0.15 ? rgb(C.lilac) : Math.abs(y + 0.05) < 0.04 ? rgb('#3a3456') : rgb(C.cream)) });
  },

  keyboard(b) {
    b.box(6.0, 0.35, 2.2, C.dark, { y: 0.2, r: 0.12, rx: 0.04 });
    const keyCols = [C.cream, C.cream, C.cream, '#ece4ff'];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 13; k++) {
      let col = keyCols[(r + k) % 4];
      if (r === 0 && k === 0) col = C.amber; if (r === 1 && k === 12) col = C.mint; if (r === 3 && k === 12) col = C.pink;
      b.cyl(0.19, 0.26, 0.2, col, { x: -2.6 + k * 0.43, y: 0.45 + r * 0.02, z: 0.68 - r * 0.45, seg: 4, ry: PI / 4 });
    }
    b.box(2.4, 0.2, 0.36, C.cream, { x: 0.0, y: 0.45, z: -1.05 + 0.15, r: 0.06 }); // space bar row offset
    b.ball(0.05, '#7fffc8', { x: 2.6, y: 0.42, z: -0.98, seg: 6, layer: 'glow', blink: [0.7, 0.2] });
    b.tube([[0, 0.25, -1.1], [0.1, 0.1, -1.8], [-0.8, 0.08, -2.3]], 0.08, C.dark, { ts: 10, rs: 5 });
  },

  monitor(b, { THREE }) {
    b.box(7.6, 4.6, 0.4, C.dark, { y: 3.4, r: 0.2, rk: 2 });
    b.quad(7.0, 4.0, '#ffffff', { y: 3.45, z: 0.205, layer: 'tex:monitor', map: screenTex(THREE) });
    b.box(1.0, 1.0, 0.25, C.dark, { y: 0.95, z: -0.2 });
    b.box(3.2, 0.2, 1.8, C.dark, { y: 0.1, z: -0.1, r: 0.08 });
    b.ball(0.07, '#7fffc8', { x: 3.4, y: 1.25, z: 0.21, seg: 6, layer: 'glow' });
    b.box(0.8, 0.5, 0.05, C.amber, { x: -3.0, y: 5.3, z: 0.22, rz: 0.2, r: 0.02 }); // sticky note
  },

  megarouter(b) {
    b.box(9.0, 2.0, 5.5, '#f4f1fb', { y: 1.2, r: 0.6, rk: 2 });
    b.box(8.4, 0.25, 5.0, C.lilac, { y: 0.12, r: 0.08 });
    for (let i = 0; i < 6; i++) b.box(4.5, 0.06, 0.18, '#d8d2ee', { y: 2.2, z: -1.6 + i * 0.6 });
    const ant = [[-3.6, -2.0, -0.35], [-1.3, -2.2, -0.1], [1.3, -2.2, 0.1], [3.6, -2.0, 0.35]];
    for (const [x, z, lean] of ant) { b.rod([x, 1.8, z], [x + lean * 2, 4.2, z - 0.5], 0.22, C.dark, { seg: 8 }); b.ball(0.26, C.dark, { x: x + lean * 2, y: 4.2, z: z - 0.5, seg: 8 }); }
    const leds = [['#5dff8a', 1.3], ['#5dff8a', 0.7], ['#ffb02e', 2.0], ['#6cc4ff', 0], ['#5dff8a', 1.6], ['#ff7ad9', 0.9]];
    leds.forEach(([c, r], i) => b.ball(0.16, c, { x: -2.5 + i * 1.0, y: 1.2, z: 2.76, sz: 0.5, seg: 8, layer: 'glow', blink: [r, i * 0.17] }));
  },

  cablespool(b) {
    for (const sx of [-1, 1]) b.cyl(5.0, 5.0, 0.6, '#c8925a', { x: sx * 2.8, y: 5.0, rz: PI / 2, seg: 22, cf: (x, y, z, wx, wy, wz, nx) => (Math.abs(nx) > 0.9 ? mixRgb('#d8a26a', '#b07a48', Math.abs(Math.sin(Math.hypot(wy - 5, wz) * 2.2)) * 0.6) : rgb('#a8723e')) });
    const cols = ['#5a8ae8', '#7fe3c4', '#ffb347', '#ff7ad9', '#b9a3ff'];
    b.cyl(3.6, 3.6, 5.0, '#5a8ae8', { y: 5.0, rz: PI / 2, seg: 22, hs: 10, fc: true, cf: (x, y, z, wx) => rgb(cols[((Math.floor((wx + 2.5) * 1.0) % 5) + 5) % 5]) });
    for (let i = 0; i < 20; i++) b.box(0.08, 0.1, 0.6, '#ffffff', { x: -2.4 + i * 0.25, y: 8.65, z: ((i * 7) % 5 - 2) * 0.2 }); // winding lines
    b.cyl(0.9, 0.9, 6.4, '#8a5a34', { y: 5.0, rz: PI / 2, seg: 10 });
    b.tube([[1.0, 8.4, 2.0], [1.4, 6.0, 5.4], [2.2, 0.4, 6.4], [4.0, 0.3, 7.6]], 0.3, '#5a8ae8', { ts: 18, rs: 6 });
  },

  serverblade(b) {
    b.box(15.0, 2.0, 7.0, '#4a4470', { y: 1.0, r: 0.25, cf: (x, y, z, wx, wy, wz) => (wz > 3.3 ? rgb('#5a5488') : rgb('#4a4470')) });
    for (let i = 0; i < 24; i++) b.box(0.25, 1.1, 0.1, '#2b2350', { x: -6 + i * 0.4, y: 1.0, z: 3.5 });
    for (const sx of [-1, 1]) { b.box(0.5, 1.6, 0.6, C.steel, { x: sx * 7.1, y: 1.0, z: 3.5, r: 0.12 }); b.box(0.2, 1.2, 0.5, C.steel, { x: sx * 7.4, y: 1.0, z: 3.9, r: 0.08 }); }
    const leds = [['#5dff8a', 1.5], ['#5dff8a', 0.9], ['#ffb02e', 2.1], ['#6cc4ff', 0.6]];
    leds.forEach(([c, r], i) => b.box(0.3, 0.2, 0.1, c, { x: 4.0 + i * 0.6, y: 1.4, z: 3.56, layer: 'glow', blink: [r, i * 0.31] }));
    b.box(2.0, 0.6, 0.06, C.cream, { x: -4.5 + 0, y: 1.5, z: 3.53, r: 0.04 });
  },

  firewallbrick(b) {
    b.box(19.6, 9.6, 5.6, '#e8d8c0', { y: 4.8 });
    for (let row = 0; row < 6; row++) {
      const off = (row % 2) * 1.6;
      for (let k = -1; k < 7; k++) {
        const x0 = -9.8 + k * 3.2 + off, x1 = Math.min(9.8, x0 + 3.0), xa = Math.max(-9.8, x0);
        if (x1 - xa < 0.4) continue;
        const col = ['#e0704a', '#d0603e', '#c8583a', '#e88058'][(row * 7 + k * 3 + 8) % 4];
        for (const sz of [-1, 1]) b.box(x1 - xa, 1.42, 0.3, col, { x: (xa + x1) / 2, y: 0.8 + row * 1.6, z: sz * 2.85 });
      }
    }
    b.box(20.4, 0.6, 6.4, '#c8b8a0', { y: 9.9, r: 0.2 });
    // cosy cartoon flames
    for (let i = 0; i < 7; i++) {
      const x = -8.4 + i * 2.8, h = 2.2 + (i % 3) * 0.6;
      b.cone(1.1, h, '#ffb347', { x, y: 10.2 + h / 2, seg: 8, layer: 'glow', df: (v) => { v.x += Math.sin(v.y * 1.6 + i) * 0.25; }, cf: (lx, ly) => mixRgb('#ff7a3c', '#ffe08a', smooth(-h / 2, h / 2, ly)) });
      b.cone(0.55, h * 0.6, '#fff2b0', { x: x + 0.2, y: 10.2 + h * 0.3, z: 0.5, seg: 6, layer: 'glow' });
    }
  },

  rack(b) {
    b.box(6.0, 20.0, 7.0, '#3a3456', { y: 10.0, r: 0.3, rk: 2 });
    for (let i = 0; i < 12; i++) {
      const y = 1.6 + i * 1.5;
      b.box(5.2, 1.2, 0.2, i % 3 === 1 ? '#5a5488' : '#4a4470', { y, z: 3.5, r: 0.06 });
      for (let k = 0; k < 3; k++) b.box(0.22, 0.22, 0.1, ['#5dff8a', '#ffb02e', '#6cc4ff', '#ff7ad9'][(i + k) % 4], { x: 1.4 + k * 0.45, y: y + 0.2, z: 3.62, layer: 'glow', blink: [0.4 + ((i * 7 + k * 3) % 10) * 0.18, (i * 0.13 + k * 0.37) % 1] });
      b.box(2.0, 0.12, 0.08, '#2b2350', { x: -1.3, y, z: 3.62 });
    }
    b.box(6.2, 0.6, 7.2, '#2b2350', { y: 20.2, r: 0.2 });
    for (const sx of [-2.6, 2.6]) for (const sz of [-3.0, 3.0]) b.cyl(0.25, 0.25, 0.4, '#2b2350', { x: sx, y: 0.2, z: sz, seg: 6 });
  },

  cloudpuff(b) {
    const puffs = [[0, 8, 0, 9], [-9, 6, 2, 7], [9, 6, -1, 7.5], [-4, 12, -2, 7], [5, 12, 2, 6.5], [0, 5, 6, 6], [-13, 4, -2, 4.5], [13, 4, 2, 4.5]];
    for (const [x, y, z, r] of puffs) b.ico(r, C.white, { x, y, z, detail: 2, cf: (lx, ly, lz, wx, wy) => mixRgb('#d8ccff', '#ffffff', smooth(3, 13, wy)) });
    b.transform(0, -1, 0, 1, 1, 1);
  },

  antenna(b) {
    const steel = '#c8cce0';
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU;
      b.rod([Math.cos(a) * 4, 0, Math.sin(a) * 4], [Math.cos(a) * 0.6, 44, Math.sin(a) * 0.6], 0.35, steel, { seg: 6 });
    }
    for (let i = 0; i < 10; i++) {
      const y = 2 + i * 4.2, r = 4 - (y / 44) * 3.4;
      for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU, a2 = ((k + 1) / 3) * TAU; b.rod([Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a2) * r, y + 2, Math.sin(a2) * r], 0.15, i % 2 ? '#ff7ad9' : steel, { seg: 4 }); }
    }
    for (const [y, ry] of [[30, 0.4], [36, 2.6]]) b.lathe([[0, 0], [1.6, 0.5], [2.0, 0.9], [1.9, 1.0], [0, 0.3]], '#f4f1fb', { y, x: Math.cos(ry) * 1.6, z: Math.sin(ry) * 1.6, rz: PI / 2, ry: -ry, seg: 12 });
    b.rod([0, 44, 0], [0, 49, 0], 0.2, steel, { seg: 5 });
    b.ball(0.7, '#ff4060', { y: 49.4, seg: 8, layer: 'glow', blink: [0.5, 0] });
    b.cyl(5, 5.5, 0.8, '#5a5488', { y: 0.4, seg: 6 });
  },

  logoletter(b) {
    // a giant friendly "M", the Marcoverse initial
    const M = [[-20, 0], [-11, 0], [-11, 30], [0, 15], [11, 30], [11, 0], [20, 0], [20, 48], [12, 48], [0, 30], [-12, 48], [-20, 48]];
    b.extrude(M, 10, C.lilac, { y: 0, bevel: 1.6, curve: 2, fc: true, cf: (x, y, z, wx, wy, wz) => (Math.abs(wz) > 5.5 ? mixRgb('#d8ccff', '#7fe3c4', smooth(0, 48, wy)) : mixRgb(C.lilac, '#9a86f0', smooth(0, 48, wy))) });
    for (let i = 0; i < 9; i++) b.ball(0.7, '#fff2b0', { x: -16 + i * 4, y: 49.8, z: 0, seg: 6, layer: 'glow', blink: [0.6, i * 0.11] });
  },

  satellitedish(b) {
    const tilt = 0.5;
    b.lathe([[0, 0], [8, 1.0], [16, 3.8], [22, 7.5], [22.6, 7.8], [22.4, 8.2], [16, 4.6], [8, 1.8], [0, 0.8]], '#f4f1fb', {
      y: 22, z: 2, rx: tilt, seg: 24, cf: (x, y, z, wx, wy, wz, nx, ny, nz) => (Math.hypot(x, z) > 21.5 ? rgb(C.lilac) : mixRgb('#ffffff', '#d4ccf0', smooth(0, 22, Math.hypot(x, z)))),
    });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; b.rod([Math.cos(a) * 18, 22 + Math.sin(a) * 9 + 7, 2 + Math.sin(a) * 12 + 2], [0, 22 + Math.cos(tilt) * 14, 2 + Math.sin(tilt) * 14], 0.35, '#c8cce0', { seg: 5 }); }
    b.ball(1.6, C.amber, { y: 22 + Math.cos(tilt) * 14, z: 2 + Math.sin(tilt) * 14, seg: 10, layer: 'glow' });
    b.cyl(2.2, 3.0, 20, '#5a5488', { y: 11, seg: 10 });
    b.box(12, 2.0, 12, '#3a3456', { y: 1.0, r: 0.5 });
    b.box(4, 4, 0.6, '#c8cce0', { y: 21, z: 0, rx: tilt + PI / 2, r: 0.3 });
  },

  loaderball(b) {
    // a swirly rainbow loading ball on a little stand: "Thanks for your patience."
    const cols = ['#ff7a8c', '#ffb347', '#ffe066', '#7fe3c4', '#6cc4ff', '#b9a3ff'];
    b.ball(28, C.white, {
      y: 32, seg: 30, hseg: 18, fc: true,
      cf: (x, y, z) => { const a = Math.atan2(z, x) + (y / 28) * 2.2; return rgb(cols[((Math.floor(((a + 20 * PI) / TAU) * 6)) % 6 + 6) % 6]); },
    });
    b.cyl(6, 9, 4, C.dark, { y: 2, seg: 12 });
    b.ball(2.4, '#ffffff', { x: -12, y: 46, z: 18, seg: 8 }); // glint
  },

  dcblock(b) {
    b.box(90, 40, 50, '#d8d0f4', { y: 20, r: 1.5, cf: (x, y, z, wx, wy) => (wy < 3 ? rgb('#8a80b8') : rgb('#d8d0f4')) });
    // window rows that glow
    for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) b.box(6, 4, 0.6, r % 2 ? '#7fe3c4' : '#ffd98a', { x: -38 + k * 8.4, y: 8 + r * 8.5, z: 25.1, layer: 'glow', blink: [(k * 3 + r) % 5 === 0 ? 0.3 : 0, (k + r) * 0.1] });
    // cooling units and pipes on the roof
    for (let k = 0; k < 6; k++) {
      const x = -35 + k * 14;
      b.box(10, 6, 10, '#b4aadc', { x, y: 43, z: -10, r: 1 });
      b.cyl(3.6, 3.6, 0.8, '#4a4470', { x, y: 46.4, z: -10, seg: 12 });
      b.cyl(0.6, 0.6, 7, '#8a80b8', { x: x - 2, y: 43.5, z: 8, seg: 6 });
    }
    b.box(30, 12, 2, C.lilac, { y: 52, z: 10, r: 1 }); // logo board
    b.extrude([[-4, 0], [-2.2, 0], [-2.2, 6], [0, 3], [2.2, 6], [2.2, 0], [4, 0], [4, 9.6], [2.4, 9.6], [0, 6], [-2.4, 9.6], [-4, 9.6]], 1, C.white, { y: 47.2, z: 11.2 });
    b.box(16, 12, 3, '#4a4470', { y: 6, z: 25.5, r: 0.6 }); // loading doors
    b.box(60, 1.2, 1.2, C.mint, { y: 40.6, z: 25.2, layer: 'glow' });
  },

  blimp(b) {
    b.ball(1, C.lilac, {
      y: 30, sx: 22, sy: 22, sz: 62, seg: 24, hseg: 14,
      fc: true, cf: (x, y, z) => (Math.abs(y) < 0.12 ? rgb(C.mint) : Math.floor((Math.atan2(y, x) + PI) / (TAU / 12)) % 2 ? rgb(C.lilac) : rgb('#cbbcff')),
    });
    for (let k = 0; k < 4; k++) b.box(1.4, 26, 14, C.amber, { y: 30, z: -50, rz: (k * PI) / 2 + PI / 4, r: 0.6, df: (v) => { v.z -= Math.abs(v.y) * 0.25; } });
    b.box(9, 6, 18, C.cream, { y: 6.5, z: 4, r: 2.5 });
    for (let i = 0; i < 5; i++) b.box(0.4, 2.4, 2.4, '#8fd0ff', { x: 4.6, y: 7, z: -2.5 + i * 3.4, layer: 'glow' });
    b.box(1.2, 8, 1.2, '#c8cce0', { y: 10, z: 4 });
    // banner: "Ping me"
    for (const sx of [-1, 1]) b.box(0.8, 7, 40, C.cream, { x: sx * 21.4, y: 26, z: 0, rz: sx * 0.25, r: 0.3, fc: true, cf: (x, y, z, wx, wy, wz) => (Math.abs(wy - 26) < 1.2 && Math.floor((wz + 30) / 2.5) % 2 ? rgb(C.pink) : rgb(C.cream)) });
  },

  giantcloud(b) {
    // the finale: a vast cloud with Gerald's nest of stolen balls on top
    const puffs = [[0, 52, 0, 48], [-60, 38, 10, 38], [60, 40, -8, 40], [-25, 75, -12, 34], [30, 72, 10, 32], [0, 40, 45, 30], [-85, 26, -14, 24], [85, 28, 14, 26], [-40, 30, -40, 28], [45, 30, 42, 26]];
    for (const [x, y, z, r] of puffs) b.ico(r, C.white, { x, y, z, detail: 2, cf: (lx, ly, lz, wx, wy) => mixRgb('#cfc2ff', '#ffffff', smooth(10, 80, wy)) });
    b.torus(12, 4.5, '#a8743e', { y: 102, rx: PI / 2, rs: 6, ts: 18, cf: (x, y, z) => (Math.sin(Math.atan2(y, x) * 18) > 0 ? rgb('#a8743e') : rgb('#8a5a30')) });
    for (let i = 0; i < 14; i++) { const a = i * 2.39, r = (i % 4) * 2.8; b.ball(3.2, '#d8f04a', { x: Math.cos(a) * r, y: 103 + (i % 3) * 2.4, z: Math.sin(a) * r, seg: 8 }); }
    b.transform(0, -10, 0, 1, 1, 1);
  },
};

void shared; void eyes;
