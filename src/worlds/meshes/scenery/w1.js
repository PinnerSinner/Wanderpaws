// W1 Copacabana scenery: the wave promenade, art deco blocks, posto, kiosks, Sugarloaf.
import { PI, TAU, lumpy, rgb, mixRgb, noise2, smooth, rngFrom } from '../util.js';
import { waveTexture, roadTexture, slabTexture, signTexture } from '../textures.js';
import { strip, kerbs } from './shared.js';
import { w1 as items1 } from '../items/w1.js';

export const PASTELS = ['#ffc8c8', '#bfe8d8', '#fff0b0', '#ffd8b8', '#d8c8f4', '#c8e4f8', '#f8d8e8', '#e8f0c0'];

// tint towards the horizon for distant backdrops (aerial perspective)
export function hazeCf(base, pal, amt, shade = true) {
  const hz = pal.horizon || '#ffe6b8';
  return (x, y, z, wx, wy, wz, nx, ny, nz) => {
    const c = typeof base === 'function' ? base(x, y, z, wx, wy, wz, nx, ny, nz) : rgb(base);
    const H = rgb(hz);
    const lit = shade ? 0.66 + 0.45 * Math.max(0, nx * 0.45 + ny * 0.55 + nz * 0.45) : 1;
    return [(c[0] * lit) * (1 - amt) + H[0] * amt, (c[1] * lit) * (1 - amt) + H[1] * amt, (c[2] * lit) * (1 - amt) + H[2] * amt];
  };
}

export function wrapText(s, n = 20) {
  const words = String(s).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
}

// a sign board: textured face on a frame, centred at x,y,z facing +Z
export function signBoard(b, ctx, key, lines, w, h, o = {}) {
  const tex = signTexture(ctx.THREE, key, lines, { w: o.pw || 512, h: o.ph || Math.round(512 * h / w), bg: o.bg, fg: o.fg, edge: o.edge, inner: o.inner });
  b.box(w + 0.12, h + 0.12, o.depth || 0.1, o.edge || '#3a2a22', { x: o.x || 0, y: o.y || 0, z: (o.z || 0) - 0.02, ry: o.ry || 0, r: 0.03 });
  const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0);
  const dz = (o.depth || 0.1) / 2 + 0.005;
  b.quad(w, h, tex ? '#ffffff' : (o.bg || '#fff6e0'), { x: (o.x || 0) + s * dz, y: o.y || 0, z: (o.z || 0) + c * dz - 0.02, ry: o.ry || 0, layer: tex ? 'tex:' + key : 'main', map: tex });
  if (o.back) b.quad(w, h, o.edge || '#3a2a22', { x: (o.x || 0) - s * dz, y: o.y || 0, z: (o.z || 0) - c * dz - 0.02, ry: (o.ry || 0) + PI });
}

export const w1 = {
  wavepavement(b, ctx) {
    const map = waveTexture(ctx.THREE);
    const s = strip(b, ctx, { map, layer: map ? 'tex:wave' : 'main', tileU: 7.5, tileV: 3.6, step: 4, lift: 0.03, color: map ? '#ffffff' : '#e8e2d4' });
    kerbs(b, s, '#e8e0d0', 0.12, 0.25);
  },

  avenue(b, ctx) {
    const map = roadTexture(ctx.THREE, { base: '#6a6e76' });
    const s = strip(b, ctx, { map, layer: map ? 'tex:road' : 'main', tileU: 9, tileV: ctx.params.d || 13.5, step: 5, lift: 0.025, color: map ? '#ffffff' : '#6a6e76' });
    kerbs(b, s, '#d8d2c4', 0.15, 0.3);
    // zebra crossings
    for (const cx of [-40, 25]) { if (Math.abs(cx) > s.w / 2 - 4) continue; for (let i = 0; i < 7; i++) { const z = -s.d / 2 + 1 + i * ((s.d - 2) / 7); b.box(2.6, 0.02, 0.9, '#f6f2e8', { x: cx, y: s.g0(cx, z) + 0.045, z: z + 0.5 }); } }
  },

  cyclelane(b, ctx) {
    const s = strip(b, ctx, { color: '#d0503e', step: 6, lift: 0.035 });
    for (const sz of [-1, 1]) { const n = Math.ceil(s.w / 10); for (let i = 0; i < n; i++) { const x = -s.w / 2 + (i + 0.5) * (s.w / n); b.box(s.w / n, 0.015, 0.1, '#fbf6ea', { x, y: s.g0(x, sz * (s.d / 2 - 0.1)) + 0.045, z: sz * (s.d / 2 - 0.1) }); } }
    for (let x = -s.w / 2 + 10; x < s.w / 2 - 5; x += 22) {
      const y = s.g0(x, 0) + 0.05;
      for (const dx of [-0.35, 0.35]) b.torus(0.25, 0.03, '#fbf6ea', { x: x + dx, y, rx: PI / 2, rs: 3, ts: 12 });
      b.box(0.5, 0.012, 0.05, '#fbf6ea', { x, y, rz: 0, ry: 0 });
      b.box(0.05, 0.012, 0.3, '#fbf6ea', { x: x + 0.1, y, z: 0.0, ry: 0.6 });
    }
  },

  pavement(b, ctx) {
    const map = slabTexture(ctx.THREE, { base: ctx.palette.ground === '#7fb35e' ? '#c9c4bb' : '#e2dccd' });
    strip(b, ctx, { map, layer: map ? 'tex:slab' : 'main', tileU: 2.4, tileV: 2.4, step: 5, lift: 0.03, color: map ? '#ffffff' : '#d8d2c4' });
  },

  pond(b, ctx) {
    const w = ctx.params.w || 10, d = ctx.params.d || 6;
    const g0 = ctx.params.groundAt || (() => 0);
    const edge = [[0, d / 2, w], [0, -d / 2, w], [w / 2, 0, d], [-w / 2, 0, d]];
    for (const [x, z, len] of edge) {
      const n = Math.max(1, Math.ceil(len / 1.2));
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + (i + 0.5) * (len / n);
        const px = z !== 0 ? t : x, pz = z !== 0 ? z : t;
        b.box(z !== 0 ? len / n + 0.02 : 0.5, 0.3, z !== 0 ? 0.5 : len / n + 0.02, i % 2 ? '#c8c0b0' : '#d8d0c0', { x: px, y: g0(px, pz) + 0.12, z: pz });
      }
    }
    const r = rngFrom(Math.round(w * 13 + d));
    for (let i = 0; i < Math.min(14, Math.round((w + d) / 3)); i++) {
      const side = i % 4, t = r() - 0.5;
      const x = side < 2 ? t * w * 0.9 : (side === 2 ? 1 : -1) * (w / 2 - 0.5), z = side < 2 ? (side === 0 ? 1 : -1) * (d / 2 - 0.5) : t * d * 0.9;
      for (let k = 0; k < 3; k++) b.cyl(0.02, 0.03, 1.0 + k * 0.2, '#6aa84f', { x: x + k * 0.12, y: g0(x, z) + 0.5, z, rz: (k - 1) * 0.15, seg: 4, layer: 'sway' });
      b.capsule(0.05, 0.16, '#8a5a34', { x: x + 0.12, y: g0(x, z) + 1.25, z, seg: 5, layer: 'sway' });
    }
  },

  hotelblock(b, ctx) {
    const r = rngFrom(ctx.params.seed || 1);
    const col = PASTELS[Math.floor(r() * PASTELS.length)];
    const trim = '#fbf8f0', glass = '#7fb4d0';
    const W = 24, H = 28, D = 16;
    b.box(W, H, D, col, { y: H / 2, r: 2.2, rk: 2 });
    b.box(W + 0.4, 3.6, D + 0.4, trim, { y: 1.8, r: 2.2 });
    // ground floor colonnade and awning
    for (let i = 0; i < 7; i++) b.box(0.6, 3.4, 0.6, trim, { x: -9 + i * 3, y: 1.7, z: D / 2 + 1.2 });
    b.box(W - 2, 0.4, 2.6, '#ff7a59', { y: 3.6, z: D / 2 + 1.2, cf: (x) => (Math.floor((x + 20) * 0.8) % 2 ? rgb('#ff7a59') : rgb('#fbf8f0')) });
    b.box(4, 2.8, 0.2, '#5a4a3a', { y: 1.4, z: D / 2 + 0.25 });
    // balcony bands with glass between (streamline style)
    for (let f = 0; f < 7; f++) {
      const y = 5.4 + f * 3.1;
      b.box(W - 1.5, 1.6, 0.3, glass, { y: y + 1.0, z: D / 2 + 0.05, cf: (x, yy) => (yy > 0.3 ? rgb('#a8d0e4') : rgb(glass)) });
      b.box(W - 1.0, 0.25, 1.6, trim, { y, z: D / 2 + 0.7, r: 0.1 });
      b.box(W - 1.0, 0.6, 0.08, trim, { y: y + 0.4, z: D / 2 + 1.45 });
      for (const sx of [-1, 1]) b.box(0.3, 1.6, D - 3, glass, { x: sx * (W / 2 + 0.05), y: y + 1.0 });
    }
    // the back and sides get window bands too (they face the avenue)
    for (let f = 0; f < 7; f++) {
      const y = 6.4 + f * 3.1;
      b.box(W - 3, 1.3, 0.2, '#86b4cc', { y, z: -D / 2 - 0.05 });
      b.box(W - 2.5, 0.2, 0.5, trim, { y: y - 0.85, z: -D / 2 - 0.2 });
    }
    // stepped art deco crown with a little flagpole
    b.box(W * 0.6, 3, D * 0.6, col, { y: H + 1.5, r: 0.8 });
    b.box(W * 0.3, 2.5, D * 0.3, trim, { y: H + 4.2, r: 0.5 });
    for (let i = 0; i < 3; i++) b.box(0.4, 4.5, 0.3, trim, { x: -2 + i * 2, y: H - 1, z: D / 2 + 0.2 });
    b.cyl(0.08, 0.08, 4, '#e8e8e8', { y: H + 7.4, seg: 5 });
    b.plane(1.6, 1.0, '#ff7a59', { x: 0.85, y: H + 8.9, rx: PI / 2, layer: 'sway' });
  },

  apartmentblock(b, ctx) {
    const r = rngFrom((ctx.params.seed || 1) * 7 + 3);
    const col = PASTELS[Math.floor(r() * PASTELS.length)];
    const W = 16, H = 38, D = 14, floors = 12;
    b.box(W, H, D, col, { y: H / 2, r: 0.4 });
    b.box(W + 0.3, 3.4, D + 0.3, '#e8e0d0', { y: 1.7, r: 0.3 });
    b.box(5, 2.8, 0.3, '#5a7a8a', { y: 1.4, z: D / 2 + 0.1 });
    for (let f = 0; f < floors; f++) {
      const y = 4.6 + f * 2.85;
      for (let k = 0; k < 3; k++) {
        const x = -5.2 + k * 5.2;
        b.box(3.6, 1.6, 0.2, '#86b4cc', { x, y: y + 0.9, z: D / 2 + 0.02 });
        b.box(4.2, 0.2, 1.2, '#fbf8f0', { x, y, z: D / 2 + 0.6 });
        b.box(4.2, 0.9, 0.08, (f + k) % 3 === 0 ? '#ff9a7a' : '#fbf8f0', { x, y: y + 0.55, z: D / 2 + 1.18 });
      }
      if (f % 3 === 1) b.box(0.6, 0.6, 0.2, '#3cc0c8', { x: 6.8, y: y + 0.5, z: D / 2 + 1.0 }); // a towel on the rail
    }
    for (let f = 0; f < floors; f++) {
      const y = 5.5 + f * 2.85;
      for (let k = 0; k < 3; k++) b.box(2.6, 1.5, 0.2, '#86b4cc', { x: -5.2 + k * 5.2, y, z: -D / 2 - 0.05 });
      for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) b.box(0.2, 1.5, 2.6, '#86b4cc', { x: sx * (W / 2 + 0.05), y, z: -3.5 + k * 7 });
    }
    b.box(4, 2.5, 3, '#d8d2c4', { x: 3, y: H + 1.25, z: -2 }); // water tank housing
    b.cyl(1.0, 1.0, 2.0, '#3cc0c8', { x: -4, y: H + 1, z: -3, seg: 10 });
    b.box(W + 0.2, 0.6, D + 0.2, '#fbf8f0', { y: H + 0.1 });
  },

  lifeguardtower(b, ctx) {
    const wood = '#fbf8f0';
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.18, 3.0, 0.18, wood, { x: sx * 1.2, y: 1.5, z: sz * 1.2 });
    b.rod([-1.2, 0.2, 1.2], [1.2, 2.8, 1.2], 0.06, wood, { seg: 4 });
    b.rod([1.2, 0.2, -1.2], [-1.2, 2.8, -1.2], 0.06, wood, { seg: 4 });
    b.box(3.0, 0.2, 3.0, '#e8473a', { y: 3.1, r: 0.04 });
    b.box(2.6, 1.6, 2.6, '#ffd23f', { y: 4.0, r: 0.1 });
    b.box(2.0, 0.7, 0.1, '#7fc8e8', { y: 4.25, z: 1.31 });
    b.box(0.1, 0.7, 2.0, '#7fc8e8', { x: 1.31, y: 4.25 });
    b.box(0.1, 0.7, 2.0, '#7fc8e8', { x: -1.31, y: 4.25 });
    b.cone(2.4, 1.0, '#e8473a', { y: 5.3, seg: 4, ry: PI / 4, fc: true, cf: (x, y, z) => (Math.floor((Math.atan2(z, x) + PI) / (TAU / 8)) % 2 ? rgb('#e8473a') : rgb('#fbf8f0')) });
    for (let i = 0; i < 7; i++) b.box(0.9, 0.06, 0.14, wood, { y: 0.4 + i * 0.4, z: 1.7 + i * 0.0, x: 0 });
    for (const sx of [-0.45, 0.45]) b.box(0.08, 3.1, 0.08, wood, { x: sx, y: 1.55, z: 1.7 });
    b.cyl(0.04, 0.04, 2.0, '#e8e8e8', { x: 1.0, y: 6.5, z: -1.0, seg: 4 });
    b.plane(1.2, 0.7, '#e8473a', { x: 1.62, y: 7.1, z: -1.0, rx: PI / 2, layer: 'sway', cf: (x, y, z) => (z > 0 ? rgb('#ffd23f') : rgb('#e8473a')) });
    signBoard(b, ctx, 'posto', [{ text: 'POSTO 4', color: '#e8473a' }], 1.6, 0.5, { y: 3.55, z: 1.4, bg: '#fffaf0' });
    b.ball(0.35, '#ff5040', { x: -1.0, y: 3.6, z: 1.35, sy: 1.0, seg: 8 }); // a lifebuoy-red rescue float
  },

  kioskbig(b, ctx) {
    const prev = b.push({ m: new ctx.THREE.Matrix4().makeScale(1.1, 1.08, 1.1) });
    items1.kiosk(b);
    b.pop(prev);
  },

  sugarloaf(b, ctx) {
    const pal = ctx.palette;
    const prevL = b.push({ layer: 'backdrop' });
    const rock = (x, y, z, wx, wy, wz, nx, ny) => (ny > 0.55 && wy < 150 ? rgb('#5a9a4a') : mixRgb('#8a8a7a', '#a8a090', smooth(-0.5, 0.5, noise2(wx * 0.05, wy * 0.04))));
    b.lathe([[0, 0], [70, 0], [76, 30], [72, 90], [58, 150], [38, 195], [14, 218], [0, 222]], '#8a8a7a', { x: 30, seg: 22, sx: 0.85, df: lumpy(0.04, 0.02, 3), cf: hazeCf(rock, pal, 0.5) });
    b.lathe([[0, 0], [60, 0], [56, 30], [40, 62], [16, 80], [0, 84]], '#7a8a6a', { x: -90, z: 30, seg: 16, df: lumpy(0.06, 0.03, 9), cf: hazeCf((x, y, z, wx, wy, wz, nx, ny) => (ny > 0.4 ? rgb('#5a9a4a') : rgb('#8a8a7a')), pal, 0.5) });
    b.cyl(150, 160, 6, '#6a9a5a', { x: -20, z: 15, y: 2, seg: 18, sz: 0.6, cf: hazeCf('#6a9a5a', pal, 0.5) });
    // the cable car line between the two peaks
    b.rod([-90, 82, 30], [12, 205, 0], 0.6, '#5a5a5a', { seg: 3, layer: 'backdrop', cf: hazeCf('#5a5a5a', pal, 0.45, false) });
    b.box(5, 4, 4, '#e8473a', { x: -40, y: 140, z: 15, layer: 'backdrop', cf: hazeCf('#e8473a', pal, 0.35) });
    b.pop(prevL);
  },

  coconutstall(b) {
    // a green coconut cart with a striped umbrella
    b.box(2.2, 0.9, 1.2, '#58b043', { y: 0.95, r: 0.08, cf: (x, y, z, wx, wy) => (wy < 0.6 ? rgb('#3d8f33') : rgb('#58b043')) });
    b.box(2.3, 0.08, 1.3, '#fbf8f0', { y: 1.42 });
    for (const sx of [-0.8, 0.8]) { b.cyl(0.42, 0.42, 0.12, '#3a3a40', { x: sx, y: 0.42, z: 0.66, rx: PI / 2, seg: 14 }); b.cyl(0.15, 0.15, 0.14, '#ffd23f', { x: sx, y: 0.42, z: 0.66, rx: PI / 2, seg: 8 }); }
    b.cyl(0.04, 0.04, 0.6, '#c8c4bc', { x: -1.2, y: 0.5, z: -0.4, seg: 4 });
    for (let i = 0; i < 14; i++) { const r = i < 8 ? 0 : 1; b.ball(0.17, '#6cc04e', { x: -0.75 + (i % 8) * 0.21 + r * 0.1, y: 1.6 + r * 0.25, z: -0.2 + ((i * 37) % 5) * 0.08, sy: 1.08, seg: 8 }); }
    b.cyl(0.035, 0.035, 2.4, '#e8e8e8', { x: 0.7, y: 2.0, seg: 5 });
    b.cyl(0.05, 1.5, 0.45, '#ffd23f', { x: 0.7, y: 3.25, seg: 16, open: true, fc: true, cf: (x, y, z) => (Math.floor((Math.atan2(z, x) + PI) / (TAU / 12)) % 2 ? rgb('#ffd23f') : rgb('#58b043')) });
    b.box(0.9, 0.35, 0.05, '#fffaf0', { x: -0.4, y: 1.1, z: 0.62, r: 0.04, cf: (x, y) => (Math.abs(y) < 0.06 ? rgb('#3d8f33') : rgb('#fffaf0')) });
  },

  showertap(b) {
    b.box(1.0, 0.06, 1.0, '#c8c4bc', { y: 0.03 });
    for (let i = 0; i < 5; i++) b.box(0.8, 0.02, 0.05, '#8a8a90', { y: 0.065, z: -0.3 + i * 0.15 });
    b.cyl(0.06, 0.07, 2.4, '#e8ecef', { y: 1.25, seg: 8 });
    b.rod([0, 2.4, 0], [0, 2.5, 0.35], 0.05, '#e8ecef', { seg: 6 });
    b.cyl(0.16, 0.08, 0.1, '#c8ccd2', { y: 2.45, z: 0.38, seg: 10 });
    b.box(0.12, 0.08, 0.16, '#3cc0c8', { y: 1.1, z: 0.1, r: 0.03 });
  },

  beachhut(b, ctx) {
    const cols = ['#ff9ec7', '#fbf8f0'];
    b.box(2.6, 2.2, 2.4, '#ff9ec7', { y: 1.3, fc: true, cf: (x, y, z, wx) => rgb(cols[Math.floor((wx + 2) * 2.5) % 2]) });
    b.box(2.9, 0.2, 2.7, '#c8b090', { y: 0.1 });
    b.extrude([[-1.6, 0], [1.6, 0], [0, 1.0]], 2.8, '#3cc0c8', { y: 2.4, ry: PI / 2, sx: 1.0 });
    b.box(0.9, 1.7, 0.08, '#3cc0c8', { y: 1.05, z: 1.22, r: 0.04 });
    b.ball(0.05, '#ffd23f', { x: 0.3, y: 1.05, z: 1.28, seg: 6 });
    signBoard(b, ctx, 'home', [{ text: '127.0.0.1', size: 70, color: '#2f6fb0' }, { text: "There's no place like home", size: 34 }], 2.0, 0.62, { y: 2.2, z: 1.35, bg: '#fffaf0' });
    b.box(1.6, 0.04, 0.9, '#ff7a59', { y: 0.22, z: 1.8, cf: (x) => (Math.floor((x + 1) * 5) % 2 ? rgb('#ff7a59') : rgb('#ffd23f')) }); // welcome towel
  },

  footvolleycourt(b) {
    const rope = '#2f6fd8';
    for (const [x, z, w, d] of [[0, 4, 16, 0.08], [0, -4, 16, 0.08], [8, 0, 0.08, 8], [-8, 0, 0.08, 8], [0, 0, 0.06, 8]]) b.box(w, 0.04, d, rope, { x, y: 0.03, z });
    for (const sx of [-8, 8]) for (const sz of [-4, 4]) b.cyl(0.05, 0.05, 0.2, '#ffd23f', { x: sx, y: 0.1, z: sz, seg: 5 });
  },

  caipistand(b, ctx) {
    b.box(2.6, 1.1, 1.0, '#8bd450', { y: 0.55, r: 0.06, cf: (x, y, z, wx, wy) => (wy > 0.95 ? rgb('#fbf8f0') : rgb('#8bd450')) });
    b.box(2.7, 0.1, 1.1, '#fbf8f0', { y: 1.12 });
    for (const sx of [-1.2, 1.2]) b.cyl(0.05, 0.05, 2.4, '#fbf8f0', { x: sx, y: 1.2, z: -0.4, seg: 5 });
    b.box(2.9, 0.08, 1.5, '#8bd450', { y: 2.45, z: 0.2, rx: 0.25, fc: true, cf: (x, y, z, wx) => (Math.floor((wx + 2) * 2.5) % 2 ? rgb('#8bd450') : rgb('#fbf8f0')) });
    for (let i = 0; i < 9; i++) b.ball(0.11, i % 3 ? '#7cc23a' : '#b8e86a', { x: -1.0 + (i % 5) * 0.2, y: 1.26, z: -0.25 + Math.floor(i / 5) * 0.2, seg: 7 });
    for (let i = 0; i < 4; i++) b.cyl(0.06, 0.05, 0.16, '#d8f5a8', { x: 0.3 + i * 0.22, y: 1.25, z: 0.2, seg: 8, layer: 'trans' });
    signBoard(b, ctx, 'limesquash', [{ text: 'lime squash', size: 60, color: '#3d8f33' }, { text: 'honest', size: 40 }], 1.8, 0.6, { y: 2.0, z: -0.42, bg: '#fffaf0' });
  },
};

function mergeLayer(dst, src) {
  const base = dst.pos.length / 3;
  dst.pos.push(...src.pos); dst.nor.push(...src.nor); dst.col.push(...src.col); dst.uv.push(...src.uv); dst.blink.push(...src.blink); dst.skin.push(...src.skin);
  for (const i of src.idx) dst.idx.push(base + i);
}
export { mergeLayer };
void roadTexture; void slabTexture;
