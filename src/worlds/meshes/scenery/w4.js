// W4 Highlands scenery: snowy mountains, pines, the curling rink, dykes, the bothy and its smoke.
import { PI, TAU, lumpy, rgb, mixRgb, noise2, smooth, rngFrom } from '../util.js';
import { w4 as items4, tartan } from '../items/w4.js';
import { shared as sharedItems } from '../items/w1.js';
import { hazeCf, signBoard } from './w1.js';

export const w4 = {
  mountain(b, ctx) {
    const pal = ctx.palette;
    const prev = b.push({ layer: 'backdrop' });
    const peak = (x, z, r, h, seed) => b.cone(r, h, '#8a88a8', {
      x, y: h / 2 - 5, z, seg: 14, hs: 6, df: (v) => { const k = 1 + 0.12 * noise2(Math.atan2(v.z, v.x) * 2 + seed, v.y * 0.03); v.x *= k; v.z *= k; },
      cf: hazeCf((lx, ly, lz, wx, wy, wz, nx, ny) => (ly > h * (0.0 + 0.08 * noise2(Math.atan2(lz, lx) * 3 + seed, 0)) ? rgb('#ffffff') : mixRgb('#7a7898', '#9a8ab8', smooth(-h / 2, 0, ly))), pal, 0.42),
    });
    peak(0, 0, 100, 120, 1);
    peak(-70, 30, 65, 80, 4);
    peak(75, -20, 60, 70, 7);
    b.pop(prev);
  },

  pine(b) {
    b.cyl(0.2, 0.32, 1.6, '#6e4a2e', { y: 0.8, seg: 7 });
    const tiers = [[2.4, 3.6, 1.2], [1.9, 3.2, 3.6], [1.4, 2.9, 5.9], [0.9, 2.4, 8.0]];
    for (const [r, h, y] of tiers) {
      b.cone(r, h, '#2f6a4a', {
        y: y + h / 2, seg: 9, hs: 2, layer: 'sway', layerOpts: { strength: 0.35 },
        df: (v) => { const th = Math.atan2(v.z, v.x); if (v.y < -h / 2 + 0.01) { v.y += 0.18 * Math.cos(th * 5); } },
        cf: (x, y2, z) => (y2 > h * 0.28 + 0.12 * Math.sin(Math.atan2(z, x) * 5) ? rgb('#f6f8ff') : y2 < -h * 0.46 ? rgb('#e8eef8') : mixRgb('#3a7a52', '#1f4a36', smooth(h * 0.1, -h / 2, y2))),
      });
    }
    b.cone(0.35, 1.0, '#f6f8ff', { y: 10.9, seg: 7, layer: 'sway' });
  },

  curlingrink(b) {
    b.box(40, 0.06, 6, '#d8ecf8', { y: 0.03, cf: (x, y, z, wx) => mixRgb('#e8f4fc', '#c8e0f0', smooth(-0.5, 0.5, noise2(wx * 0.3, z)) * 0.6) });
    for (const sx of [-1, 1]) {
      const rings = [[1.83, '#3d6fa8'], [1.22, '#fbf8f0'], [0.61, '#d8443a'], [0.15, '#fbf8f0']];
      rings.forEach(([r, c], i) => b.circle(r, c, { x: sx * 16.5, y: 0.065 + i * 0.004, seg: 28 }));
      b.box(0.08, 0.01, 6, '#d8443a', { x: sx * 10, y: 0.07 }); // hog lines
      b.box(0.04, 0.01, 6, '#3d6fa8', { x: sx * 16.5, y: 0.075 });
    }
    b.box(40, 0.01, 0.04, '#3d6fa8', { y: 0.07 });
    for (const sz of [-3.1, 3.1]) b.box(40.4, 0.35, 0.2, '#9a6b45', { y: 0.175, z: sz, cf: (x, y, z, wx) => (Math.floor((wx + 30) / 4) % 2 ? rgb('#9a6b45') : rgb('#fbf8f0')) });
    for (const sx of [-20.1, 20.1]) b.box(0.2, 0.35, 6.4, '#9a6b45', { x: sx, y: 0.175 });
    // spare stones waiting at one end
    for (let i = 0; i < 4; i++) {
      const x = -19.2, z = -2.2 + i * 0.6;
      b.cyl(0.22, 0.2, 0.16, '#9aa0a6', { x, y: 0.15, z, seg: 12 });
      b.box(0.06, 0.05, 0.22, i % 2 ? '#d8443a' : '#ffd23f', { x, y: 0.25, z, r: 0.02 });
    }
  },

  stonewall(b) {
    const r = rngFrom(5);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 11; i++) {
        const x = -3.8 + i * 0.76 + (row % 2) * 0.35 + (r() - 0.5) * 0.1;
        if (Math.abs(x) > 3.9) continue;
        const c = ['#9aa0a6', '#8a8e94', '#a8aaae', '#7f8590'][Math.floor(r() * 4)];
        b.dodeca(0.36, c, { x, y: 0.22 + row * 0.33, z: (r() - 0.5) * 0.1, sx: 1.25 - row * 0.12, sy: 0.6, sz: 1.05 - row * 0.15, detail: 0, ry: r() * 3 });
      }
    }
    for (let i = 0; i < 16; i++) b.box(0.18, 0.32, 0.5, '#8a8e94', { x: -3.8 + i * 0.5, y: 1.08, rz: 0.3 * (i % 2 ? 1 : -1) }); // cope stones on edge
    b.box(8.0, 0.12, 0.65, '#f6f8ff', { y: 1.26, r: 0.05, df: lumpy(0.2, 2) });
  },

  bothyhut(b, ctx) {
    const { THREE } = ctx;
    const prev = b.push({ m: new THREE.Matrix4().makeScale(1.15, 1.0, 1.25) });
    items4.bothy(b);
    b.pop(prev);
    // chimney smoke: soft puffs drifting up and fading (instanced)
    const n = 7;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const smoke = new THREE.InstancedMesh(geo, ctx.mats.toon('#eef0f8', { transparent: true, opacity: 0.6 }), n);
    smoke.name = 'bothy-smoke';
    smoke.castShadow = false;
    smoke.frustumCulled = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const cx = 2.4 * 1.15, cy = 5.7, cz = 0;
    ctx.extras.push(smoke);
    ctx.anim((dt, st, t) => {
      const wind = 0.35;
      for (let i = 0; i < n; i++) {
        const p = ((t * 0.18 + i / n) % 1);
        const sc = 0.25 + p * 1.1;
        v.set(cx + p * p * 4 * wind + Math.sin(t + i) * 0.15, cy + p * 6, cz + Math.sin(t * 0.7 + i * 2) * 0.3 * p);
        s.setScalar(sc * (p > 0.85 ? (1 - p) / 0.15 : 1));
        m4.compose(v, q, s);
        smoke.setMatrixAt(i, m4);
      }
      smoke.instanceMatrix.needsUpdate = true;
    });
  },

  skiliftline(b, ctx) {
    const L = ctx.params.len || 50;
    const h0 = (ctx.params.h0 || 0) + (ctx.params.y0 ?? 20), h1 = (ctx.params.h1 || 0) + (ctx.params.y1 ?? 20);
    for (const sz of [-3.6, 3.6]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([-L / 2 + t * L, h0 + (h1 - h0) * t - Math.sin(t * PI) * L * 0.02 - 0.25, sz]); }
      b.tube(pts, 0.05, '#3a3a40', { ts: 20, rs: 3 });
    }
    // a couple of chairs on the cable
    for (const [t, sz] of [[0.3, 3.6], [0.72, -3.6]]) {
      const x = -L / 2 + t * L, y = h0 + (h1 - h0) * t - Math.sin(t * PI) * L * 0.02 - 0.25;
      const prev = b.push({ m: new ctx.THREE.Matrix4().makeTranslation(x, y - 1.6, sz).multiply(new ctx.THREE.Matrix4().makeRotationY(PI / 2)) });
      items4.skiliftchair(b);
      b.pop(prev);
    }
  },

  icesculpture(b, ctx) {
    b.box(1.6, 0.8, 1.6, '#c8c4bc', { y: 0.4, r: 0.06 });
    const prev = b.push({ layer: 'trans', m: new ctx.THREE.Matrix4().makeTranslation(0, 0.8, 0).multiply(new ctx.THREE.Matrix4().makeScale(6, 6, 6)) });
    sharedItems.router(b);
    b.pop(prev);
    for (const L of b.layers.values()) if (L.name === 'trans') for (let i = 0; i < L.col.length; i += 3) { L.col[i] = 0.62 + L.col[i] * 0.2; L.col[i + 1] = 0.85 + L.col[i + 1] * 0.1; L.col[i + 2] = 1; }
    signBoard(b, ctx, 'frozenpacket', [{ text: 'Frozen packet', color: '#3d6fa8' }], 1.2, 0.32, { y: 0.45, z: 0.82, bg: '#f6f8ff' });
  },

  heather(b) {
    const r = rngFrom(3);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, d = i ? 0.55 : 0;
      b.ico(i ? 0.42 : 0.5, '#9b6bb5', { x: Math.cos(a) * d, y: 0.25, z: Math.sin(a) * d, sy: 0.65, detail: 1, layer: 'sway', df: lumpy(0.2, 4, i), cf: (lx, ly, lz, wx, wy) => (r() > 0.75 ? rgb('#d8a8f0') : mixRgb('#6a8a4a', '#a878c8', smooth(0.0, 0.45, wy))) });
    }
  },

  piperstage(b) {
    b.box(3, 0.4, 3, '#9a6b45', { y: 0.2, fc: true, cf: (x, y, z, wx) => (Math.floor((wx + 2) * 3) % 2 ? rgb('#9a6b45') : rgb('#8a5e3a')) });
    b.box(3.05, 0.3, 0.04, '#c0392b', { y: 0.2, z: 1.52, fc: true, cf: (x, y, z, wx, wy) => tartan(wx * 3 + 4, wy * 3 + 4, 0.5) });
    for (const sx of [-1.4, 1.4]) { b.cyl(0.05, 0.05, 1.6, '#6e4a2e', { x: sx, y: 1.2, z: -1.4, seg: 5 }); }
    b.tube([[-1.4, 2.0, -1.4], [0, 1.7, -1.4], [1.4, 2.0, -1.4]], 0.02, '#f2e3c0', { ts: 10, rs: 3 });
    for (let i = 0; i < 7; i++) b.extrude([[-0.12, 0], [0.12, 0], [0, -0.26]], 0.01, ['#3d6fa8', '#fbf8f0', '#c0392b'][i % 3], { x: -1.2 + i * 0.4, y: 1.95 - Math.sin((i / 6) * PI) * 0.25, z: -1.4, layer: 'sway' });
  },
};
