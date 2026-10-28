// W2 London scenery: terraces with coloured doors, park furniture, the column, the bus stop.
import { PI, TAU, lumpy, rgb, mixRgb, noise2, smooth, rngFrom } from '../util.js';
import { roadTexture, canvasTexture, FONT } from '../textures.js';
import { strip, kerbs } from './shared.js';
import { signBoard } from './w1.js';

const DOORS = ['#d8342c', '#2c5a9a', '#2f7a4a', '#e6b33a', '#2a2a30', '#8a4aa8', '#3cc0c8'];
const FACADES = ['#f4ead2', '#e8dcc0', '#c8a878', '#f0e0d0', '#e0e6e8', '#f8f0e0'];

function portraitTex(THREE) {
  return canvasTexture(THREE, 'goodboy', 384, 320, (ctx, w, h) => {
    ctx.fillStyle = '#3a2a22'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8b83a'; ctx.fillRect(14, 14, w - 28, h - 80);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6a8aa8'); g.addColorStop(1, '#3a5a6a');
    ctx.fillStyle = g; ctx.fillRect(32, 32, w - 64, h - 116);
    // a sunny yellow Labrador, oil on Labrador
    ctx.fillStyle = '#f2c46a';
    ctx.beginPath(); ctx.ellipse(w / 2, 175, 70, 52, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2, 108, 50, 44, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8a04a';
    ctx.beginPath(); ctx.ellipse(w / 2 - 44, 112, 16, 32, 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2 + 44, 112, 16, 32, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2f2a33';
    ctx.beginPath(); ctx.arc(w / 2 - 17, 100, 6, 0, TAU); ctx.arc(w / 2 + 17, 100, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2, 124, 11, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8473a'; ctx.fillRect(w / 2 - 40, 146, 80, 10);
    ctx.fillStyle = '#fff6e0'; ctx.font = `800 22px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('Portrait of a Good Boy', w / 2, h - 42);
    ctx.font = `600 17px ${FONT}`; ctx.fillText('(oil on Labrador)', w / 2, h - 18);
  });
}

function timetableTex(THREE) {
  return canvasTexture(THREE, 'busstop127', 256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#fbf8f0'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d8342c'; ctx.fillRect(0, 0, w, 96);
    ctx.fillStyle = '#ffffff'; ctx.font = `800 64px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('127', w / 2, 70);
    ctx.fillStyle = '#2a2a30'; ctx.font = `800 30px ${FONT}`; ctx.fillText('to Localhost', w / 2, 140);
    ctx.font = `600 22px ${FONT}`;
    ['Every 30 seconds', 'if you wait nicely', '', 'Stops: Gateway,', 'Router, Switch,', 'Home'].forEach((l, i) => ctx.fillText(l, w / 2, 190 + i * 32));
  });
}

export const w2 = {
  terrace(b, ctx) {
    const r = rngFrom((ctx.params.seed || 3) * 13 + 1);
    const n = 5, hw = 6, H = 11, D = 9;
    const facade = FACADES[Math.floor(r() * FACADES.length)];
    for (let i = 0; i < n; i++) {
      const x = -12 + i * hw;
      const f = r() < 0.3 ? FACADES[Math.floor(r() * FACADES.length)] : facade;
      b.box(hw - 0.05, H, D, f, { x, y: H / 2 });
      b.box(hw, 1.2, D, '#fbf8f0', { x, y: 0.6 }); // stucco base
      b.box(hw + 0.02, 0.35, D + 0.25, '#fbf8f0', { x, y: H - 0.2 }); // cornice
      b.box(hw, 0.2, D + 0.1, '#fbf8f0', { x, y: 3.9 });
      // door with fanlight and steps
      const dc = DOORS[Math.floor(r() * DOORS.length)];
      const dx = x - 1.6;
      b.box(1.3, 2.4, 0.15, dc, { x: dx, y: 1.95, z: D / 2 + 0.05, r: 0.04 });
      b.box(1.5, 0.5, 0.1, '#bfe4f2', { x: dx, y: 3.45, z: D / 2 + 0.03 });
      b.box(1.8, 3.3, 0.12, '#fbf8f0', { x: dx, y: 2.25, z: D / 2 + 0.0 });
      b.ball(0.06, '#e8b83a', { x: dx + 0.4, y: 1.95, z: D / 2 + 0.15, seg: 5 });
      for (let s = 0; s < 3; s++) b.box(1.8, 0.25, 0.5, '#e0dcd4', { x: dx, y: 0.6 - s * 0.25 + 0.12, z: D / 2 + 0.25 + s * 0.4 });
      // sash windows: ground floor bay, then two upper floors
      const win = (wx, wy, ww, wh) => {
        b.box(ww + 0.25, wh + 0.25, 0.08, '#fbf8f0', { x: wx, y: wy, z: D / 2 + 0.02 });
        b.box(ww, wh, 0.1, '#6a8aa0', { x: wx, y: wy, z: D / 2 + 0.03, cf: (lx, ly) => (Math.abs(ly) < 0.05 || Math.abs(lx) < 0.04 ? rgb('#fbf8f0') : ly > 0 ? rgb('#8aaac0') : rgb('#6a8aa0')) });
        b.box(ww + 0.35, 0.12, 0.25, '#fbf8f0', { x: wx, y: wy - wh / 2 - 0.1, z: D / 2 + 0.1 });
      };
      win(x + 1.2, 2.3, 1.8, 1.9);
      for (const fy of [5.4, 8.3]) { win(x - 1.4, fy, 1.1, 1.7); win(x + 1.4, fy, 1.1, 1.7); }
      if (r() < 0.6) b.box(1.5, 0.35, 0.35, '#5aa04a', { x: x + 1.4, y: 4.45, z: D / 2 + 0.25, r: 0.1 }); // window box
      if (r() < 0.6) for (let k = 0; k < 3; k++) b.ball(0.12, ['#ff5d73', '#ffd23f', '#fff'][k], { x: x + 0.9 + k * 0.45, y: 4.7, z: D / 2 + 0.3, seg: 5 });
      // chimney stack with pots
      b.box(1.2, 1.8, 0.7, f === facade ? '#c8a878' : f, { x: x + hw / 2 - 0.1, y: H + 1.6, z: -1.5 });
      for (let k = 0; k < 3; k++) b.cyl(0.13, 0.15, 0.45, '#c8683c', { x: x + hw / 2 - 0.45 + k * 0.35, y: H + 2.7, z: -1.5, seg: 6 });
    }
    // slate roof
    b.extrude([[-D / 2 + 0.3, 0], [D / 2 - 0.3, 0], [0, 2.2]], n * hw, '#5b6b7a', { x: 0, y: H, ry: PI / 2, fc: true, cf: (x, y, z, wx, wy) => (Math.floor(wy * 4) % 2 ? rgb('#5b6b7a') : rgb('#4f5e6c')) });
    // area railings
    for (let i = 0; i < 60; i++) { const x = -15 + i * 0.5; if (Math.abs(((x + 12 + 1.6) % 6 + 6) % 6 - 0) < 1.1) continue; b.box(0.04, 1.0, 0.04, '#2a2a30', { x, y: 0.5, z: D / 2 + 1.6 }); }
    b.box(30, 0.06, 0.06, '#2a2a30', { y: 0.95, z: D / 2 + 1.6 });
  },

  parkgate(b) {
    const brick = '#b8573e';
    for (const sx of [-1, 1]) {
      b.box(0.8, 2.8, 0.8, brick, { x: sx * 2.8, y: 1.4 });
      b.box(1.0, 0.2, 1.0, '#e0dcd4', { x: sx * 2.8, y: 2.9 });
      b.ball(0.3, '#e0dcd4', { x: sx * 2.8, y: 3.25, seg: 8 });
    }
    for (let i = 0; i < 18; i++) { const x = -2.25 + i * 0.265; const h = 2.0 + 0.6 * Math.cos((x / 2.4) * PI / 2); b.box(0.05, h, 0.05, '#2a2a30', { x, y: h / 2 }); b.cone(0.05, 0.14, '#e8b83a', { x, y: h + 0.07, seg: 4 }); }
    for (const y of [0.3, 1.6]) b.box(4.6, 0.07, 0.06, '#2a2a30', { y });
    b.torus(2.3, 0.05, '#2a2a30', { y: 0.6, arc: PI, rs: 4, ts: 18 });
    b.ball(0.15, '#e8b83a', { y: 2.95, seg: 6 });
  },

  railings(b) {
    for (let i = 0; i < 25; i++) { const x = -3 + i * 0.25; b.box(0.04, 1.1, 0.04, '#2a2a30', { x, y: 0.55 }); b.cone(0.04, 0.12, '#2a2a30', { x, y: 1.16, seg: 4 }); }
    for (const y of [0.15, 0.95]) b.box(6.0, 0.06, 0.05, '#2a2a30', { y });
  },

  oaktree(b) {
    b.cyl(0.6, 0.9, 5, '#7a5a3a', { y: 2.5, seg: 9, df: lumpy(0.08, 1) });
    for (const [a, l, h] of [[0.4, 3.5, 5.5], [2.5, 3.2, 6], [4.4, 3.4, 5.2]]) b.rod([0, h - 1, 0], [Math.cos(a) * l, h + 2, Math.sin(a) * l], 0.35, '#7a5a3a', { r2: 0.18, seg: 6 });
    const blobs = [[0, 9.5, 0, 4.2], [3.2, 8.2, 1, 3.1], [-3.0, 8.5, -0.5, 3.2], [0.8, 8.0, -3.0, 3.0], [-0.8, 8.4, 3.0, 3.0], [0, 11.6, 0.4, 2.6]];
    for (const [x, y, z, r] of blobs) b.ico(r, '#4f9a3a', { x, y, z, detail: 1, layer: 'sway', df: lumpy(0.1, 0.7, x), cf: (lx, ly, lz, wx, wy) => mixRgb('#3a7a30', '#7cc04a', smooth(5, 13, wy + lx * 0.3)) });
  },

  plane_tree(b) {
    b.cyl(0.45, 0.65, 8, '#a8a080', { y: 4, seg: 9, cf: (x, y, z, wx, wy, wz) => (noise2(wx * 3 + wz * 2, wy * 2) > 0.2 ? rgb('#d8d0b0') : noise2(wx * 2, wy * 3) < -0.3 ? rgb('#7a7a60') : rgb('#a8a080')) });
    for (const [a, h] of [[0.3, 7], [2.4, 8], [4.3, 7.5]]) b.rod([0, h, 0], [Math.cos(a) * 2.5, h + 3, Math.sin(a) * 2.5], 0.25, '#a8a080', { r2: 0.12, seg: 5 });
    const blobs = [[0, 12.5, 0, 3.4], [2.4, 11, 0.8, 2.6], [-2.3, 11.2, -0.4, 2.6], [0.5, 10.6, -2.4, 2.4], [-0.4, 11, 2.4, 2.4], [0, 14.6, 0, 2.0]];
    for (const [x, y, z, r] of blobs) b.ico(r, '#5aa040', { x, y, z, detail: 1, layer: 'sway', df: lumpy(0.12, 0.8, y), cf: (lx, ly, lz, wx, wy) => mixRgb('#3f8a35', '#8ad050', smooth(8, 16, wy + lx * 0.3)) });
  },

  admiralcolumn(b) {
    const stone = '#e0d8c8';
    for (let i = 0; i < 3; i++) b.box(7 - i * 1.2, 0.5, 7 - i * 1.2, i % 2 ? '#d0c8b8' : stone, { y: 0.25 + i * 0.5 });
    b.box(3.6, 4.5, 3.6, stone, { y: 3.75 });
    b.box(4.0, 0.4, 4.0, '#d0c8b8', { y: 6.2 });
    for (const sx of [-1, 1]) b.box(0.08, 1.6, 2.0, '#b88a3a', { x: sx * 1.82, y: 3.8 }); // bronze reliefs
    b.cyl(1.2, 1.4, 28, stone, { y: 20.4, seg: 16, fc: true, cf: (x, y, z) => (Math.floor((Math.atan2(z, x) + PI) * 2.5) % 2 ? rgb(stone) : rgb('#d0c8b8')) });
    b.cyl(1.8, 1.3, 1.6, '#b88a3a', { y: 35.2, seg: 12 });
    b.box(2.6, 0.6, 2.6, stone, { y: 36.3 });
    b.cyl(0.9, 1.1, 1.2, stone, { y: 37.2, seg: 10 });
    // the little admiral (a generic hat-wearing statue)
    b.capsule(0.35, 1.0, '#7a8a7a', { y: 38.6, seg: 8 });
    b.ball(0.3, '#7a8a7a', { y: 39.6, seg: 8 });
    b.box(0.9, 0.2, 0.4, '#6a7a6a', { y: 39.9, r: 0.08 });
    b.rod([0.3, 39, 0], [0.7, 38.4, 0.4], 0.09, '#7a8a7a', { seg: 5 });
  },

  gallerywindow(b, ctx) {
    b.box(4.0, 3.0, 0.3, '#2c3e66', { y: 1.5 });
    b.box(3.4, 2.2, 0.32, '#cfe6ee', { y: 1.5, z: 0.01, layer: 'trans', layerOpts: { opacity: 0.35 } });
    const tex = portraitTex(ctx.THREE);
    b.quad(1.7, 1.42, tex ? '#ffffff' : '#e8b83a', { y: 1.5, z: 0.0, layer: tex ? 'tex:goodboy' : 'main', map: tex });
    b.box(2.0, 0.08, 0.3, '#e8b83a', { y: 0.72, z: 0.0 });
    b.box(4.2, 0.4, 0.5, '#2c3e66', { y: 3.1 });
    signBoard(b, ctx, 'gallery', [{ text: 'GALLERY', color: '#e8b83a' }], 2.0, 0.32, { y: 3.1, z: 0.26, bg: '#2c3e66', edge: '#2c3e66', fg: '#e8b83a' });
  },

  coffeecart(b, ctx) {
    b.box(2.2, 1.0, 1.3, '#2f5d3a', { y: 0.85, r: 0.08 });
    b.box(2.3, 0.08, 1.4, '#c8925a', { y: 1.38 });
    for (const sx of [-0.8, 0.8]) b.cyl(0.32, 0.32, 0.1, '#2a2a30', { x: sx, y: 0.32, z: 0.66, rx: PI / 2, seg: 12 });
    b.box(0.6, 0.55, 0.45, '#c8ccd2', { x: -0.5, y: 1.7, r: 0.06 });
    b.cyl(0.08, 0.08, 0.15, '#2a2a30', { x: -0.5, y: 1.55, z: 0.28, seg: 6 });
    for (let i = 0; i < 4; i++) b.cyl(0.05, 0.04, 0.12, '#fbf8f0', { x: 0.2 + i * 0.16, y: 1.48, z: 0.3, seg: 6 });
    for (const sx of [-1.05, 1.05]) b.cyl(0.03, 0.03, 1.2, '#2a2a30', { x: sx, y: 2.0, z: -0.5, seg: 4 });
    b.box(2.5, 0.08, 1.6, '#2f5d3a', { y: 2.62, z: 0.1, rx: 0.15, fc: true, cf: (x, y, z, wx) => (Math.floor((wx + 2) * 3) % 2 ? rgb('#2f5d3a') : rgb('#fbf8f0')) });
    signBoard(b, ctx, 'coffee', [{ text: 'COFFEE', color: '#2f5d3a' }, { text: 'tea, if you must', size: 34 }], 1.4, 0.5, { y: 0.85, z: 0.67, bg: '#fbf8f0' });
  },

  busstop(b, ctx) {
    const red = '#d8342c';
    for (const sx of [-1.9, 1.9]) b.box(0.1, 2.5, 0.1, '#5a5f66', { x: sx, y: 1.25, z: -0.55 });
    b.box(4.0, 0.12, 1.5, red, { y: 2.55, r: 0.04 });
    b.box(3.8, 2.1, 0.06, '#cfe6ee', { y: 1.35, z: -0.6, layer: 'trans', layerOpts: { opacity: 0.35 } });
    b.box(0.06, 2.1, 1.0, '#cfe6ee', { x: 1.9, y: 1.35, z: -0.1, layer: 'trans', layerOpts: { opacity: 0.35 } });
    b.box(2.4, 0.08, 0.4, '#5a5f66', { y: 0.55, z: -0.35 });
    const tex = timetableTex(ctx.THREE);
    b.quad(0.6, 0.9, tex ? '#ffffff' : '#fbf8f0', { x: -1.2, y: 1.45, z: -0.56, layer: tex ? 'tex:busstop127' : 'main', map: tex });
    // the bus stop flag
    b.cyl(0.05, 0.05, 3.0, '#5a5f66', { x: 2.4, y: 1.5, z: 0.4, seg: 6 });
    b.cyl(0.32, 0.32, 0.06, red, { x: 2.4, y: 2.8, z: 0.4, rx: PI / 2, seg: 16 });
    b.box(0.7, 0.14, 0.07, '#fbf8f0', { x: 2.4, y: 2.8, z: 0.4 });
    signBoard(b, ctx, 'bus127', [{ text: '127', color: '#d8342c' }], 0.5, 0.3, { x: 2.4, y: 2.35, z: 0.44, bg: '#fbf8f0' });
  },

  road(b, ctx) {
    const map = roadTexture(ctx.THREE, { base: '#5a5f66', line: '#fbf6ea' });
    const s = strip(b, ctx, { map, layer: map ? 'tex:road2' : 'main', tileU: 9, tileV: ctx.params.d || 12, step: 6, lift: 0.025, color: map ? '#ffffff' : '#5a5f66' });
    kerbs(b, s, '#c8c4bc', 0.15, 0.3);
    for (const sz of [-1, 1]) { const n = Math.ceil(s.w / 10); for (let i = 0; i < n; i++) { const x = -s.w / 2 + (i + 0.5) * (s.w / n); b.box(s.w / n, 0.012, 0.1, '#ffd23f', { x, y: s.g0(x, 0) + 0.045, z: sz * (s.d / 2 - 0.5) }); } }
  },

  hedge(b) {
    b.box(6, 1.5, 1.2, '#3f8a3a', { y: 0.75, r: 0.45, rk: 2, df: lumpy(0.06, 2), cf: (x, y, z, wx, wy) => mixRgb('#2f6a2e', '#6cb050', smooth(0, 1.5, wy) * 0.8 + noise2(wx * 3, wy * 3) * 0.15) });
  },

  sentrybox(b) {
    b.box(1.3, 2.4, 1.3, '#fbf8f0', { y: 1.2 });
    b.box(0.95, 2.1, 0.1, '#2a2a30', { y: 1.15, z: 0.62 });
    b.extrude([[-0.8, 0], [0.8, 0], [0, 0.6]], 1.5, '#2a2a30', { y: 2.4, fc: true, cf: (x, y, z, wx, wy) => (wy < 2.5 ? rgb('#d8342c') : rgb('#2a2a30')) });
    for (const sx of [-0.66, 0.66]) b.box(0.1, 2.4, 0.1, '#d8342c', { x: sx, y: 1.2, z: 0.66 });
    b.ball(0.12, '#e8b83a', { y: 3.05, seg: 6 });
  },
};
void TAU;
