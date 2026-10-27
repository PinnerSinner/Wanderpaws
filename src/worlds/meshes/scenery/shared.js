// Shared scenery (palms, lamps, bunting, flags, rocks, bushes, fences) and the
// strip helper used by every "scale to the rectangle" surface.
import { PI, TAU, lumpy, rgb, mixRgb, noise2, smooth, rngFrom } from '../util.js';
import { frond } from '../items/w3.js';

// A terrain-hugging rectangle w x d (local X along, Z across) with UVs in metres
// divided by the tile size, so one shared RepeatWrapping texture tiles it.
export function strip(b, ctx, o) {
  const { THREE, params } = ctx;
  const w = params.w || o.w || 10, d = params.d || o.d || 4;
  const g0 = params.groundAt || (() => 0);
  const nx = Math.max(1, Math.min(160, Math.ceil(w / (o.step || 4))));
  const nz = Math.max(1, Math.min(24, Math.ceil(d / (o.step || 4))));
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const lx = -w / 2 + (i / nx) * w, lz = -d / 2 + (j / nz) * d;
      pos.push(lx, g0(lx, lz) + (o.lift ?? 0.04), lz);
      uv.push((lx + (o.uOff || 0)) / (o.tileU || 1), (lz + d / 2) / (o.tileV || 1));
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i;
    idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.add(g, o.color || '#ffffff', { layer: o.layer || 'main', map: o.map, cf: o.cf, layerOpts: o.layerOpts });
  return { w, d, g0 };
}

// kerb boxes along both long edges of a strip
export function kerbs(b, s, col = '#d8d2c4', h = 0.16, wd = 0.3, sides = [-1, 1]) {
  const n = Math.max(1, Math.ceil(s.w / 8));
  for (const sz of sides) for (let i = 0; i < n; i++) {
    const x = -s.w / 2 + (i + 0.5) * (s.w / n);
    const z = sz * (s.d / 2 - wd / 2);
    b.box(s.w / n + 0.02, h, wd, col, { x, y: s.g0(x, z) + h / 2, z });
  }
}

export const shared = {
  palm(b) {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.sin(t * 1.3) * 0.9, t * 8.6, 0]); }
    b.tube(pts, 0.24, '#a8784a', { ts: 18, rs: 7, cf: (x, y, z, wx, wy) => (Math.floor(wy * 2.2) % 2 ? rgb('#a8784a') : rgb('#8a5e3a')), df: (v) => { const k = v.y < 0.8 ? 1.5 - v.y * 0.6 : 1; v.x *= k; v.z *= k; } });
    const tx = Math.sin(1.3) * 0.9, ty = 8.6;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3;
      frond(b, tx, ty, 0, a, 3.6 + (i % 3) * 0.4, 1.1 + (i % 2) * 0.3, i % 2 ? '#3fa84a' : '#52bc5a', { n: 6, width: 0.9, lift: 0.5, col2: '#2f9a44', layer: 'sway' });
    }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; b.ball(0.2, '#7a9a3a', { x: tx + Math.cos(a) * 0.25, y: ty - 0.3, z: Math.sin(a) * 0.25, seg: 7 }); }
    b.ball(0.32, '#6a8a3a', { x: tx, y: ty - 0.05, seg: 7 });
  },

  streetlamp(b) {
    const c = '#e8ecef';
    b.cyl(0.12, 0.16, 0.4, '#9aa0a6', { y: 0.2, seg: 8 });
    b.cyl(0.07, 0.09, 4.6, c, { y: 2.5, seg: 8 });
    b.tube([[0, 4.7, 0], [0, 5.05, 0.25], [0, 5.0, 0.8]], 0.06, c, { ts: 8, rs: 6 });
    b.cyl(0.24, 0.12, 0.18, c, { y: 4.92, z: 0.85, seg: 10 });
    b.cyl(0.18, 0.2, 0.1, '#fff2c0', { y: 4.79, z: 0.85, seg: 10, layer: 'glow' });
  },

  bunting(b, ctx) {
    const L = ctx.params.len || 12;
    const cols = ['#ff7a59', '#ffd23f', '#3cc0c8', '#ff9ec7', '#8bd450', '#b98cff'];
    const H = 4.2, sag = Math.min(1.2, L * 0.06);
    const yAt = (x) => H - sag * (1 - (2 * x / L) ** 2);
    for (const sx of [-1, 1]) { b.cyl(0.06, 0.08, H + 0.3, '#e8ecef', { x: sx * L / 2, y: (H + 0.3) / 2, seg: 6 }); b.ball(0.1, '#ffd23f', { x: sx * L / 2, y: H + 0.35, seg: 6 }); }
    const pts = [];
    for (let i = 0; i <= 12; i++) { const x = -L / 2 + (i / 12) * L; pts.push([x, yAt(x), 0]); }
    b.tube(pts, 0.015, '#f2e3c0', { ts: 24, rs: 3 });
    const n = Math.max(4, Math.round(L / 0.55));
    for (let i = 1; i < n; i++) {
      const x = -L / 2 + (i / n) * L, y = yAt(x);
      b.extrude([[-0.2, 0], [0.2, 0], [0, -0.42]], 0.01, cols[i % cols.length], { x, y, layer: 'sway' });
    }
  },

  flagpole(b, ctx) {
    const col = ctx.params.color || ctx.palette.accent || '#ff7a59';
    b.cyl(0.25, 0.3, 0.3, '#c8c4bc', { y: 0.15, seg: 8 });
    b.cyl(0.05, 0.07, 6.0, '#f2f2f2', { y: 3.15, seg: 8 });
    b.ball(0.1, '#ffd23f', { y: 6.2, seg: 8 });
    b.plane(1.6, 1.0, col, {
      x: 0.85, y: 5.55, rx: PI / 2, ws: 8, ds: 2, layer: 'sway',
      df: (v) => { v.z += 0.08 * Math.sin(v.x * 4); v.y *= 1 - (v.x + 0.8) * 0.2; },
      cf: (x, y, z) => (Math.abs(z) < 0.12 ? rgb('#ffffff') : rgb(col)),
    });
  },

  rock(b, ctx) {
    const pal = ctx.palette || {};
    const base = ctx.params.color || (pal.ground === '#f4f6fb' ? '#9aa0aa' : '#a8a49a');
    b.dodeca(1.1, base, {
      y: 0.55, sx: 1.0, sy: 0.65, sz: 0.95, detail: 1, df: lumpy(0.16, 1.2, 2),
      cf: (x, y, z, wx, wy, wz, nx, ny) => (ny > 0.75 && pal.ground === '#f4f6fb' ? rgb('#f6f8ff') : ny > 0.8 ? mixRgb(base, '#7ab84a', 0.35) : mixRgb(base, '#6a6660', smooth(-0.6, 0.6, noise2(wx * 2.5, wy * 2.5 + wz)) * 0.5)),
    });
    b.dodeca(0.45, base, { x: 0.9, y: 0.2, z: 0.4, detail: 1, df: lumpy(0.2, 2, 5) });
  },

  bush(b, ctx) {
    const col = ctx.params.color || '#58b04a';
    const r = rngFrom(7);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU, rr = i === 0 ? 0 : 0.45;
      b.ico(i === 0 ? 0.62 : 0.45, col, { x: Math.cos(a) * rr, y: i === 0 ? 0.65 : 0.42, z: Math.sin(a) * rr, detail: 1, layer: 'sway', df: lumpy(0.12, 3, i), cf: (x, y, z, wx, wy) => mixRgb('#3a8a3a', '#7ccc5a', smooth(0.1, 1.1, wy)) });
    }
    for (let i = 0; i < 5; i++) b.ball(0.07, ['#ff7aa0', '#fff6e6', '#ffd23f'][i % 3], { x: (r() - 0.5) * 1.1, y: 0.7 + r() * 0.4, z: 0.45 + r() * 0.15, seg: 5, layer: 'sway' });
  },

  fence(b, ctx) {
    const col = ctx.params.color || '#fbf8f0';
    for (const y of [0.35, 0.75]) b.box(4.0, 0.08, 0.05, col, { y, z: -0.03 });
    for (let i = 0; i < 11; i++) {
      const x = -1.9 + i * 0.38;
      b.box(0.12, 0.95, 0.04, col, { x, y: 0.475 });
      b.cone(0.085, 0.12, col, { x, y: 1.0, seg: 4, ry: PI / 4, sz: 0.4 });
    }
  },
};
