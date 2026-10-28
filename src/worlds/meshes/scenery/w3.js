// W3 Tijuca scenery: buttress-rooted giants, ferns, the waterfall, cliffs, rope bridge.
import { PI, TAU, lumpy, rgb, mixRgb, noise2, smooth, rngFrom } from '../util.js';
import { fallTexture, texClone, canvasTexture, FONT } from '../textures.js';
import { frond } from '../items/w3.js';
import { hazeCf, signBoard } from './w1.js';

function trailMapTex(THREE) {
  return canvasTexture(THREE, 'trailmap', 512, 448, (ctx, w, h) => {
    ctx.fillStyle = '#f6efd8'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8a5a3b'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = '#3a2a22'; ctx.font = `800 34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('TRAIL MAP', w / 2, 52);
    const cx = w / 2, cy = h / 2 + 30;
    const spokes = [['Waterfall', -2.5], ['Lookout', -0.6], ['Bridge', 0.9], ['Cave', 2.4], ['Lily pads', 3.6], ['Kiosk', 5.0]];
    ctx.lineWidth = 6; ctx.strokeStyle = '#2f8a4a'; ctx.setLineDash([12, 8]);
    for (const [, a] of spokes) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 160, cy + Math.sin(a) * 120); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = '#4ab8d8'; ctx.beginPath(); ctx.ellipse(cx, cy, 70, 44, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `800 24px ${FONT}`; ctx.fillText('LAKE', cx, cy - 4); ctx.font = `700 18px ${FONT}`; ctx.fillText('(the switch)', cx, cy + 20);
    ctx.font = `700 20px ${FONT}`;
    for (const [n, a] of spokes) { const x = cx + Math.cos(a) * 165, y = cy + Math.sin(a) * 124; ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a2a22'; ctx.fillText(n, x, y + (Math.sin(a) > 0 ? 36 : -22)); }
    ctx.fillStyle = '#e8473a'; ctx.beginPath(); ctx.arc(cx + 40, cy + 70, 9, 0, TAU); ctx.fill();
    ctx.font = `700 16px ${FONT}`; ctx.fillText('You are here', cx + 40, cy + 98);
  });
}

export const w3 = {
  jungletree(b) {
    const bark = (x, y, z, wx, wy, wz) => mixRgb('#9a8060', '#6a5038', smooth(-0.5, 0.5, noise2(Math.atan2(wz, wx) * 3, wy * 0.6)));
    b.cyl(0.75, 1.25, 19, '#8a7050', { y: 9.5, seg: 10, cf: bark });
    // buttress roots: tall thin fins flaring from the trunk
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2;
      b.extrude([[0, 0], [3.2, 0], [2.0, 0.6], [0.9, 2.2], [0.3, 4.2], [0, 4.4]], 0.32, '#8a7050', { y: 0, ry: -a, cf: bark, curve: 3 });
    }
    for (const [a, h, l] of [[0.5, 14, 6], [2.6, 15.5, 5.5], [4.4, 13, 6]]) b.rod([0, h, 0], [Math.cos(a) * l, h + 3.2, Math.sin(a) * l], 0.45, '#8a7050', { r2: 0.22, seg: 6 });
    // a broad umbrella canopy, flatter and higher than a park tree
    const blobs = [[0, 21, 0, 4.6], [4.8, 19.6, 1.6, 3.6], [-4.6, 19.8, -1.0, 3.7], [1.2, 19.4, -4.8, 3.5], [-1.4, 19.5, 4.6, 3.5], [3.4, 20.4, -3.4, 3.0], [-3.6, 20.2, 3.0, 3.0]];
    for (const [x, y, z, r] of blobs) b.ico(r, '#3f9a4a', { x, y, z, sy: 0.62, detail: 1, layer: 'sway', layerOpts: { strength: 0.4 }, df: lumpy(0.14, 0.5, x + z), cf: (lx, ly, lz, wx, wy) => mixRgb('#246a36', '#86d060', smooth(17, 23, wy + lx * 0.2)) });
    // lianas and a bromeliad perched on a branch
    for (const [x, z] of [[3.5, 1.2], [-3.2, -1.4], [0.6, 3.6]]) b.tube([[x, 17, z], [x * 1.05 + 0.4, 11, z], [x * 1.1, 6, z + 0.3]], 0.07, '#4f7a3a', { ts: 10, rs: 4, layer: 'sway' });
    for (let i = 0; i < 5; i++) { const a = i * 1.25; b.cone(0.12, 0.6, i % 2 ? '#ff4f7a' : '#4cb85a', { x: 4.2 + Math.cos(a) * 0.15, y: 17.7, z: 1.6 + Math.sin(a) * 0.15, rz: Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5, seg: 4 }); }
  },

  fern(b) {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + (i % 2) * 0.2; frond(b, 0, 0.15, 0, a, 1.2 + (i % 3) * 0.2, 0.9, i % 2 ? '#4cb85a' : '#3a9a4a', { n: 6, width: 0.42, lift: 1.0, col2: '#2f8a40', layer: 'sway', rib: '#6a9a3a' }); }
    b.ball(0.18, '#5a7a3a', { y: 0.1, seg: 6 });
  },

  waterfall(b, ctx) {
    const { THREE } = ctx;
    const H = 22, W = 12;
    // cliff face behind with a dark cave mouth (egg T2)
    b.box(W + 10, H + 3, 6, '#8a8478', { y: (H + 3) / 2, z: -3.4, df: lumpy(0.05, 0.15, 2), cf: (x, y, z, wx, wy, wz, nx, ny) => (ny > 0.6 ? rgb('#5aa04a') : mixRgb('#9a948a', '#6a665e', smooth(-0.5, 0.5, noise2(wx * 0.3, wy * 0.25)))) });
    b.ball(3.2, '#2a2620', { y: 1.5, z: -0.35, sx: 1.2, sy: 1.0, sz: 0.25, seg: 12 });
    for (let i = 0; i < 10; i++) b.dodeca(1.2 + (i % 3) * 0.5, '#7a766c', { x: -9 + i * 2, y: 0.4, z: 1.6 + (i % 2), detail: 1, df: lumpy(0.2, 1, i), cf: (x, y, z, wx, wy, wz, nx, ny) => (ny > 0.6 ? rgb('#5aa04a') : rgb('#7a766c')) });
    const tex = texClone(fallTexture(THREE), 3, 4);
    const sheet = new THREE.PlaneGeometry(W, H, 6, 12);
    const P = sheet.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); const t = (y + H / 2) / H; P.setZ(i, 0.6 + Math.pow(t, 6) * 1.6 + Math.sin(P.getX(i) * 0.8) * 0.15); }
    sheet.translate(0, H / 2, 0);
    sheet.computeVertexNormals();
    const mat = tex ? ctx.mats.toon('#ffffff', { map: tex, transparent: true, opacity: 0.88, rim: true }) : ctx.mats.toon('#bfeaf4', { transparent: true, opacity: 0.85 });
    const fall = new THREE.Mesh(sheet, mat);
    fall.name = 'waterfall-sheet';
    fall.castShadow = false;
    ctx.extras.push(fall);
    // foam and spray puffs (instanced, bobbing)
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    const puffs = new THREE.InstancedMesh(puffGeo, ctx.mats.toon('#ffffff', { transparent: true, opacity: 0.75 }), 14);
    puffs.name = 'waterfall-spray';
    puffs.castShadow = false;
    puffs.frustumCulled = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const seeds = [];
    for (let i = 0; i < 14; i++) seeds.push([(i / 13 - 0.5) * W * 1.05, 2.4 + (i % 3) * 0.3, 0.8 + (i % 4) * 0.6, 1.0 + (i % 3) * 0.6]);
    ctx.extras.push(puffs);
    ctx.anim((dt, st, t) => {
      if (tex) tex.offset.y = (t * 0.9) % 1;
      for (let i = 0; i < seeds.length; i++) {
        const [x, z, r, sz] = seeds[i];
        const k = 1 + 0.25 * Math.sin(t * 2.3 + i * 1.7);
        v.set(x, 0.3 + 0.4 * Math.abs(Math.sin(t * 1.7 + i)), z + r * 0.5);
        s.set(sz * k, sz * 0.6 * k, sz * k);
        m4.compose(v, q, s);
        puffs.setMatrixAt(i, m4);
      }
      puffs.instanceMatrix.needsUpdate = true;
    });
    void seeds;
  },

  cliff(b) {
    b.box(30, 25, 10, '#8a8478', {
      y: 12.5, r: 3, rk: 2, df: lumpy(0.09, 0.08, 5),
      cf: (x, y, z, wx, wy, wz, nx, ny) => (ny > 0.55 ? mixRgb('#4f9a3a', '#7ab84a', noise2(wx * 0.2, wz * 0.2) * 0.5 + 0.5) : mixRgb('#a09a8c', '#706a60', (Math.sin(wy * 0.9 + noise2(wx * 0.1, wz * 0.1) * 2) + 1) * 0.35 + 0.15)),
    });
    for (let i = 0; i < 6; i++) b.ico(2.4 + (i % 3), '#3f9a4a', { x: -12 + i * 5, y: 25.5, z: (i % 2) * 2 - 1, detail: 1, layer: 'sway', df: lumpy(0.15, 0.6, i), cf: (lx, ly) => mixRgb('#2a7a3e', '#6cc05a', smooth(-2, 3, ly)) });
  },

  ropebridge(b, ctx) {
    const L = ctx.params.len || 24;
    const y0 = (ctx.params.y0 ?? 4) + 0, y1 = (ctx.params.y1 ?? 4) + 0;
    const h0 = (ctx.params.h0 || 0) + y0, h1 = (ctx.params.h1 || 0) + y1;
    const sag = Math.min(2.5, L * 0.07);
    const yAt = (t) => h0 + (h1 - h0) * t - sag * Math.sin(t * PI);
    const n = Math.max(8, Math.round(L / 0.45));
    for (let i = 0; i <= n; i++) { const t = i / n; b.box(0.38, 0.08, 2.2, i % 3 ? '#b9824e' : '#9a6a3e', { x: -L / 2 + t * L, y: yAt(t), ry: (i % 2 ? 0.03 : -0.03) }); }
    for (const sz of [-1.15, 1.15]) {
      const deck = [], rail = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; deck.push([-L / 2 + t * L, yAt(t) - 0.02, sz]); rail.push([-L / 2 + t * L, yAt(t) + 1.0 + sag * 0.15 * Math.sin(t * PI), sz]); }
      b.tube(deck, 0.04, '#d9c08a', { ts: 30, rs: 4 });
      b.tube(rail, 0.05, '#d9c08a', { ts: 30, rs: 4 });
      for (let i = 1; i < 16; i++) { const t = i / 16; b.rod([-L / 2 + t * L, yAt(t), sz], [-L / 2 + t * L, yAt(t) + 1.0 + sag * 0.15 * Math.sin(t * PI), sz], 0.015, '#d9c08a', { seg: 3 }); }
      for (const [x, h] of [[-L / 2, h0], [L / 2, h1]]) { b.cyl(0.14, 0.18, h + 1.6, '#7a5030', { x, y: (h + 1.6) / 2 - 0.3, z: sz, seg: 7 }); b.ball(0.16, '#7a5030', { x, y: h + 1.3, z: sz, seg: 6 }); }
    }
  },

  lilypad(b) {
    b.cyl(0.6, 0.6, 0.04, '#4cae4a', { y: 0.02, seg: 18, tl: TAU * 0.9, ts: 0.3, cf: (x, y, z) => mixRgb('#6ec85a', '#3f9a42', smooth(0.1, 0.55, Math.hypot(x, z))) });
    for (let i = 0; i < 5; i++) b.box(0.02, 0.01, 0.5, '#8ad070', { y: 0.045, ry: i * 1.1 + 0.4, z: 0 });
  },

  jaguarstatue(b) {
    const st = '#a8a090';
    b.box(2.4, 0.7, 1.2, '#8a8478', { y: 0.35, r: 0.08 });
    b.ball(0.5, st, { y: 1.35, sx: 1.6, sy: 0.8, sz: 0.85, seg: 12 });
    b.ball(0.33, st, { x: 0.85, y: 1.7, seg: 10 });
    b.ball(0.16, st, { x: 1.12, y: 1.62, seg: 8, sx: 1.2 });
    for (const sz of [-0.14, 0.14]) { b.cone(0.09, 0.16, st, { x: 0.82, y: 2.02, z: sz, seg: 5 }); b.ball(0.045, '#ffb02e', { x: 1.12, y: 1.78, z: sz * 0.9, seg: 6, layer: 'glow', blink: [0, 0] }); }
    for (const [x, z] of [[0.55, 0.3], [0.55, -0.3], [-0.55, 0.3], [-0.55, -0.3]]) b.capsule(0.12, 0.4, st, { x, y: 0.95, z, seg: 6 });
    b.tube([[-0.75, 1.35, 0], [-1.15, 1.1, 0.1], [-1.1, 1.6, 0.3], [-0.9, 1.75, 0.2]], 0.07, st, { ts: 10, rs: 5 });
    for (let i = 0; i < 8; i++) b.ball(0.08, '#7a7468', { x: -0.4 + (i % 4) * 0.3, y: 1.62, z: (i < 4 ? 0.35 : -0.35), sz: 0.3, seg: 5 }); // rosettes
  },

  lookoutdeck(b) {
    const wood = '#b9824e', dk = '#7a5030';
    for (const sx of [-4.6, 0, 4.6]) for (const sz of [-3.6, 3.6]) b.cyl(0.18, 0.22, 4.2, dk, { x: sx, y: 1.6, z: sz, seg: 7 });
    b.box(10, 0.3, 8, wood, { y: 3.6, fc: true, cf: (x, y, z, wx) => (Math.floor((wx + 6) * 1.6) % 2 ? rgb(wood) : rgb('#c8925a')) });
    for (const [x, z, w, d] of [[0, 4, 10, 0.1], [5, 0, 0.1, 8], [-5, 0, 0.1, 8]]) {
      b.box(w || 0.1, 0.1, d || 0.1, dk, { x, y: 4.65, z });
      const n = Math.round(Math.max(w, d) / 0.6);
      for (let i = 0; i <= n; i++) { const t = -Math.max(w, d) / 2 + (i / n) * Math.max(w, d); b.box(0.07, 1.0, 0.07, dk, { x: w > d ? t : x, y: 4.2, z: w > d ? z : t }); }
    }
    // coin-operated binoculars on a post
    b.cyl(0.08, 0.1, 1.2, '#3a7a5a', { x: 2, y: 4.35, z: 3.2, seg: 6 });
    b.box(0.5, 0.3, 0.4, '#3a7a5a', { x: 2, y: 5.05, z: 3.2, rx: 0.3, r: 0.08 });
    for (const sx of [-0.12, 0.12]) b.cyl(0.08, 0.08, 0.3, '#2a2a30', { x: 2 + sx, y: 5.1, z: 3.45, rx: PI / 2 + 0.3, seg: 8 });
  },

  citybackdrop(b, ctx) {
    const pal = ctx.palette;
    const r = rngFrom(11);
    const prev = b.push({ layer: 'backdrop' });
    // the bay
    b.box(600, 0.5, 60, '#4ab8c8', { y: 0, z: 10, cf: hazeCf('#4ab8c8', pal, 0.4, false) });
    // a ribbon of pastel city along the shore
    for (let i = 0; i < 70; i++) {
      const x = -290 + i * 8.4 + r() * 3, h = 8 + r() * 30, c = ['#fff0e0', '#e8f4f8', '#ffe0e8', '#f8f0c8'][i % 4];
      b.box(7, h, 8, c, { x, y: h / 2, z: -10 + r() * 8, cf: hazeCf(c, pal, 0.4) });
    }
    // green hills behind and a rounded sugarloaf-ish peak at the end
    for (let i = 0; i < 8; i++) b.ball(1, '#4f9a4a', { x: -260 + i * 75, y: 0, z: -40, sx: 60 + r() * 30, sy: 45 + r() * 45, sz: 30, seg: 12, hseg: 6, tl: PI / 2, cf: hazeCf('#4f9a4a', pal, 0.45) });
    b.lathe([[0, 0], [30, 0], [32, 25], [24, 60], [10, 78], [0, 80]], '#8a8a7a', { x: 270, z: 5, seg: 14, cf: hazeCf((x, y, z, wx, wy, wz, nx, ny) => (ny > 0.5 ? rgb('#5a9a4a') : rgb('#8a8a7a')), pal, 0.4) });
    b.pop(prev);
  },

  vine(b) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.sin(t * 5) * 0.25, 10 - t * 9.5, Math.cos(t * 4) * 0.2]); }
    b.tube(pts, 0.06, '#4f7a3a', { ts: 24, rs: 4, layer: 'sway' });
    for (let i = 0; i < 10; i++) { const p = pts[Math.min(8, Math.floor(i * 0.85))]; b.ball(0.18, i % 2 ? '#4cb85a' : '#3a9a4a', { x: p[0] + 0.15, y: p[1] - 0.3, z: p[2], sx: 1.4, sy: 0.25, ry: i, rz: 0.5, seg: 6, layer: 'sway' }); }
  },

  trailmap(b, ctx) {
    for (const sx of [-0.85, 0.85]) b.cyl(0.07, 0.08, 1.9, '#7a5030', { x: sx, y: 0.95, seg: 6 });
    const tex = trailMapTex(ctx.THREE);
    b.box(1.9, 1.6, 0.1, '#7a5030', { y: 1.15, r: 0.03 });
    b.quad(1.8, 1.5, tex ? '#ffffff' : '#f6efd8', { y: 1.15, z: 0.055, layer: tex ? 'tex:trailmap' : 'main', map: tex });
    b.extrude([[-1.1, 0], [1.1, 0], [0, 0.4]], 0.3, '#2f8a4a', { y: 1.95 });
  },
};
void signBoard;
