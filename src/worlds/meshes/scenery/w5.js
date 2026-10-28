// W5 Marcoverse scenery (plus the shared plaque): cloud islands, server-rack skyline,
// router towers, the data castle, the 404 door, signs and the hologram classroom.
import { PI, TAU, lumpy, rgb, mixRgb, noise2, smooth, rngFrom } from '../util.js';
import { binaryTexture, cableTexture, canvasTexture, FONT } from '../textures.js';
import { blinkMaterial } from '../kit.js';
import { strip } from './shared.js';
import { signBoard, wrapText } from './w1.js';
import { w5 as items5 } from '../items/w5.js';
import { buildHuman } from '../humans.js';

const C = { lilac: '#b9a3ff', mint: '#7fe3c4', amber: '#ffb347', navy: '#2b2350', dark: '#3a3456', pink: '#ff7ad9', cream: '#fff6e6' };
const LEDS = ['#5dff8a', '#ffb02e', '#6cc4ff', '#ff7ad9', '#7fe3c4'];

function boardTex(THREE) {
  return canvasTexture(THREE, 'ccnaboard', 512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#f8f6ff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3a3456'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#3a3456'; ctx.font = `800 30px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('CCNA for Cats: Lesson 1', w / 2, 44);
    const nodes = [[110, 150, 'Router'], [256, 110, 'Switch'], [400, 150, 'Cat Flap'], [180, 250, 'Food Bowl'], [340, 250, 'Sofa']];
    ctx.strokeStyle = '#7f75b8'; ctx.lineWidth = 4;
    for (const [x, y] of nodes) { ctx.beginPath(); ctx.moveTo(256, 110); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.font = `700 18px ${FONT}`;
    for (const [x, y, n] of nodes) { ctx.fillStyle = '#7fe3c4'; ctx.fillRect(x - 46, y - 18, 92, 36); ctx.fillStyle = '#3a3456'; ctx.fillText(n, x, y + 6); }
  });
}

export const w5 = {
  plaque(b, ctx) {
    const text = ctx.text(ctx.params.textKey, ctx.params.text || 'Gobblepaws');
    const lines = wrapText(text, 24);
    for (const sx of [-1.2, 1.2]) b.cyl(0.08, 0.1, 1.2, '#5a5f66', { x: sx, y: 0.6, seg: 6 });
    signBoard(b, ctx, 'plaque:' + text, lines.map((l) => ({ text: l, size: lines.length > 2 ? 44 : 54 })), 2.8, 1.5, { y: 1.75, bg: '#fff6e0', inner: '#c8a050', back: true, edge: '#5a4a3a' });
  },

  cloudisland(b) {
    const r = rngFrom(9);
    const puffs = [[0, 0, 0, 34]];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + r() * 0.3; puffs.push([Math.cos(a) * 42, -4 - r() * 6, Math.sin(a) * 42, 18 + r() * 8]); }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.4; puffs.push([Math.cos(a) * 20, -14, Math.sin(a) * 20, 16]); }
    for (const [x, y, z, s] of puffs) b.ico(s, '#f4f0ff', { x, y: y + 7, z, sy: 0.55, detail: 1, df: lumpy(0.08, 0.06, x), cf: (lx, ly, lz, wx, wy) => mixRgb('#a890e0', '#ffffff', smooth(-6, 22, wy)) });
  },

  serverskyline(b) {
    const r = rngFrom(4);
    let y = 0;
    const tiers = [[30, 50, 30], [24, 40, 24], [16, 26, 16]];
    for (const [w, h, d] of tiers) {
      b.box(w, h, d, '#3a3456', { y: y + h / 2, cf: (x, yy, z, wx, wy) => (Math.floor(wy / 2.5) % 2 ? rgb('#3a3456') : rgb('#453f66')) });
      b.box(w + 1, 0.8, d + 1, C.lilac, { y: y + h });
      // LED grid on all four faces (a few blink, most glow steadily)
      for (let f = 0; f < 4; f++) {
        const a = (f * PI) / 2, c = Math.cos(a), s = Math.sin(a);
        const half = (f % 2 ? w : d) / 2 + 0.05;
        for (let row = 0; row < Math.floor(h / 5); row++) {
          for (let k = 0; k < 4; k++) {
            const lx = -w / 2 + 3 + k * ((w - 6) / 3);
            const col = LEDS[Math.floor(r() * LEDS.length)];
            b.box(1.6, 0.7, 0.2, col, { x: lx * c + half * s, y: y + 2.5 + row * 5, z: -lx * s + half * c, ry: a, layer: 'glow', blink: r() < 0.35 ? [0.3 + r() * 1.2, r()] : [0, 0] });
          }
        }
      }
      y += h;
    }
    b.cyl(0.6, 0.8, 12, '#c8cce0', { y: y + 6, seg: 6 });
    b.ball(1.2, '#ff4060', { y: y + 12.5, seg: 8, layer: 'glow', blink: [0.5, r()] });
  },

  cableriver(b, ctx) {
    const map = cableTexture(ctx.THREE);
    strip(b, ctx, { map, layer: map ? 'tex:cables' : 'main', tileU: 24, tileV: ctx.params.d || 12, step: 12, lift: 0.1, color: map ? '#ffffff' : C.mint });
  },

  binarypavement(b, ctx) {
    const map = binaryTexture(ctx.THREE);
    strip(b, ctx, { map, layer: map ? 'tex:binary' : 'main', tileU: 30, tileV: 14, step: 12, lift: 0.08, color: map ? '#ffffff' : C.lilac });
  },

  routertower(b) {
    b.cyl(5, 8, 60, '#d8d0f4', { y: 30, seg: 8, cf: (x, y, z, wx, wy) => (Math.floor(wy / 6) % 2 ? rgb('#d8d0f4') : rgb('#c4b8ec')) });
    for (let i = 0; i < 6; i++) b.torus(6.5 - i * 0.4, 0.4, C.mint, { y: 6 + i * 9.5, rx: PI / 2, rs: 4, ts: 16, layer: 'glow', blink: [0, 0] });
    // the router on top, with antennas and blinking lights
    b.box(18, 6, 12, '#f4f1fb', { y: 63, r: 1.5 });
    b.box(17, 0.8, 11, C.lilac, { y: 60.2 });
    for (const [x, lean] of [[-7, -0.3], [-2.5, -0.1], [2.5, 0.1], [7, 0.3]]) { b.rod([x, 65, -3.5], [x + lean * 10, 78, -5], 0.6, C.dark, { seg: 6 }); b.ball(0.9, '#ff4060', { x: x + lean * 10, y: 78, z: -5, seg: 6, layer: 'glow', blink: [0.4 + Math.abs(lean), x * 0.1] }); }
    LEDS.forEach((c, i) => b.ball(0.6, c, { x: -6 + i * 3, y: 63, z: 6.05, sz: 0.4, seg: 6, layer: 'glow', blink: [0.6 + i * 0.3, i * 0.2] }));
  },

  datacastle(b, ctx) {
    const { THREE } = ctx;
    const wall = '#d8d0f4', dk = '#4a4470';
    const lit = blinkMaterial(THREE, ctx.mats, { castle: true });
    const win = (x, y, z, w, h, ry = 0) => b.box(w, h, 0.8, '#ffd98a', { x, y, z, ry, layer: 'glow', blink: [0, 0] });
    // curtain walls and gatehouse
    b.box(140, 40, 100, wall, { y: 20, cf: (x, y, z, wx, wy) => (Math.floor(wy / 5) % 2 ? rgb(wall) : rgb('#c8bfee')) });
    for (let i = 0; i < 14; i++) for (const sz of [-1, 1]) b.box(6, 6, 4, wall, { x: -65 + i * 10, y: 43, z: sz * 49 });
    for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) b.box(4, 6, 6, wall, { x: sx * 69, y: 43, z: -40 + i * 10 });
    // corner towers as giant server racks with cosy cone roofs
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 70, z = sz * 50;
      b.box(26, 90, 26, dk, { x, y: 45, cf: (lx, ly, lz, wx, wy) => (Math.floor(wy / 4) % 2 ? rgb(dk) : rgb('#5a5488')) });
      b.cone(20, 26, C.lilac, { x, y: 103, z, seg: 4, ry: PI / 4 });
      b.ball(2, C.mint, { x, y: 117, z, seg: 8, layer: 'glow', blink: [0.5, sx * 0.2 + sz * 0.1] });
      for (let row = 0; row < 16; row++) for (let k = 0; k < 3; k++) b.box(3, 1, 0.5, LEDS[(row + k + (sx > 0 ? 1 : 0)) % LEDS.length], { x: x - 7 + k * 7, y: 6 + row * 5, z: z + 13.1 * (sz > 0 ? 1 : -1), layer: 'glow', blink: (row + k) % 4 === 0 ? [0.4 + ((row * 3 + k) % 5) * 0.25, (row * 0.17) % 1] : [0, 0] });
    }
    // central keep: a tall data centre with a big M and a flag
    b.box(60, 100, 50, '#e8e0ff', { y: 50, z: -10 });
    for (let r2 = 0; r2 < 9; r2++) for (let k = 0; k < 5; k++) win(-20 + k * 10, 12 + r2 * 10, 15.4, 5, 4);
    b.box(36, 30, 2, C.lilac, { y: 112, z: 10, r: 2 });
    b.extrude([[-12, 0], [-7, 0], [-7, 16], [0, 8], [7, 16], [7, 0], [12, 0], [12, 26], [7, 26], [0, 16], [-7, 26], [-12, 26]], 2, '#ffffff', { y: 99, z: 11.5 });
    b.rod([25, 100, -30], [25, 135, -30], 0.6, '#c8cce0', { seg: 5 });
    b.plane(14, 8, C.mint, { x: 32, y: 130, z: -30, rx: PI / 2, ws: 6, layer: 'sway', cf: (x, y, z) => (Math.abs(z) < 1 ? rgb('#ffffff') : rgb(C.mint)) });
    // gate
    b.box(30, 32, 6, dk, { y: 16, z: 51, cf: (x, y, z, wx, wy) => (Math.floor((wx + 40) / 3) % 2 || Math.floor(wy / 3) % 2 ? rgb('#2b2350') : rgb(dk)) });
    b.cyl(15, 15, 6, dk, { y: 32, z: 51, rx: PI / 2, seg: 16, tl: PI, ts: -PI / 2 });
    for (let k = 0; k < 6; k++) win(-55 + k * 22, 24, 50.5, 8, 6);
    // the castle's own light material, so egg M14 can switch it off and on again
    const geos = b.geometries();
    const glow = geos.glow;
    if (glow) {
      b.layers.delete('glow');
      const mesh = new THREE.Mesh(glow.geometry, lit);
      mesh.name = 'datacastle-lights';
      ctx.extras.push(mesh);
      let cur = 1;
      ctx.anim((dt, st) => {
        const f = st && st.flags ? st.flags['M14.lights'] : undefined;
        const target = typeof f === 'number' ? f : 1;
        cur += (target - cur) * Math.min(1, dt * 6);
        lit.color.setScalar(0.15 + 0.85 * cur);
      });
    }
    for (const k of Object.keys(geos)) if (k !== 'glow') geos[k].geometry.dispose();
  },

  door404(b, ctx) {
    const { THREE } = ctx;
    b.box(1.2, 18, 1.6, C.dark, { x: -5.4, y: 9 });
    b.box(1.2, 18, 1.6, C.dark, { x: 5.4, y: 9 });
    b.box(12, 1.4, 1.6, C.dark, { y: 18.4 });
    b.box(12, 0.4, 3, '#c8bfee', { y: 0.2 });
    signBoard(b, ctx, '404', [{ text: '404', size: 120, color: '#ff7ad9' }, { text: 'Door Not Found', size: 46 }], 6.0, 3.0, { y: 21.2, bg: '#fff6e6', edge: C.dark, back: true });
    // the door leaf, hinged on the left
    const lb = new (b.constructor)();
    lb.box(9.4, 16.4, 0.5, C.lilac, { x: 4.7, y: 8.4, r: 0.15 });
    for (const [px, py] of [[2.4, 12], [7, 12], [2.4, 4.5], [7, 4.5]]) lb.box(3.4, 5.6, 0.2, '#a890f0', { x: px, y: py, z: 0.3, r: 0.1 });
    lb.ball(0.4, C.amber, { x: 8.4, y: 8.4, z: 0.5, seg: 8 });
    const leaf = lb.toGroup(ctx.mats);
    leaf.position.set(-4.7, 0.2, 0);
    leaf.name = 'door404-leaf';
    ctx.extras.push(leaf);
    let ang = 0;
    ctx.anim((dt, st) => {
      const open = st && st.flags && st.flags['M3.open'] ? 1 : 0;
      ang += ((open ? -1.6 : 0) - ang) * Math.min(1, dt * 3);
      leaf.rotation.y = ang;
    });
    void THREE;
  },

  dnssign(b, ctx) {
    const text = ctx.text(ctx.params.textKey, "who's-a-good-boy.local");
    b.cyl(0.35, 0.45, 12, '#c8cce0', { y: 6, seg: 8 });
    const arrows = [[10.2, 0.3, C.mint, 'DNS'], [8.4, -0.5, C.lilac, text], [6.6, 2.7, C.amber, '1.1.1.1']];
    for (const [y, ry, col, label] of arrows) {
      b.extrude([[0, -0.75], [5.2, -0.75], [6.2, 0], [5.2, 0.75], [0, 0.75], [0.4, 0]], 0.3, col, { y, ry, bevel: 0.05 });
      const c = Math.cos(ry), s = Math.sin(ry);
      signBoard(b, ctx, 'dns:' + label, [{ text: label, size: 60 }], 4.6, 1.1, { x: c * 2.9 + s * 0.2, y, z: -s * 2.9 + c * 0.2, ry, bg: '#fff6e6', edge: col, depth: 0.04 });
    }
    b.ball(0.6, C.pink, { y: 12.3, seg: 8, layer: 'glow' });
  },

  subnetsign(b, ctx) {
    const text = ctx.text(ctx.params.textKey, '192.168.0.0/16. Your neighbours are on a different VLAN.');
    for (const sx of [-4.5, 4.5]) b.cyl(0.3, 0.35, 3.5, '#c8cce0', { x: sx, y: 1.75, seg: 8 });
    const lines = wrapText(text, 22);
    signBoard(b, ctx, 'subnet:' + text, lines.map((l, i) => ({ text: l, size: i === 0 ? 70 : 46, color: i === 0 ? '#5a4ab8' : '#3a3456' })), 11.4, 4.2, { y: 5.6, bg: '#fff6e6', inner: C.mint, back: true, edge: C.dark, pw: 768, ph: 284 });
    for (let i = 0; i < 12; i++) b.ball(0.18, '#fff2b0', { x: -5.6 + i * 1.02, y: 7.9, z: 0.1, seg: 6, layer: 'glow', blink: [0.7, i * 0.08] });
  },

  hologram(b, ctx) {
    const { THREE } = ctx;
    b.cyl(6, 6.4, 0.6, C.dark, { y: 0.3, seg: 24 });
    b.cyl(5.4, 5.4, 0.08, '#5ad8ff', { y: 0.64, seg: 24, layer: 'glow', blink: [0, 0] });
    // the whiteboard
    const tex = boardTex(THREE);
    b.box(5.4, 3.6, 0.2, C.dark, { x: 1.5, y: 4.4, z: -3.4, r: 0.05 });
    b.quad(5.2, 3.4, tex ? '#ffffff' : '#f8f6ff', { x: 1.5, y: 4.4, z: -3.29, layer: tex ? 'tex:ccnaboard' : 'main', map: tex });
    for (const sx of [-0.8, 3.8]) b.cyl(0.08, 0.08, 2.6, C.dark, { x: sx, y: 1.3, z: -3.4, seg: 5 });
    // a class of attentive holo-cats on cushions
    for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) {
      const x = -3 + k * 2, z = 1.5 + row * 2;
      b.cyl(0.6, 0.65, 0.25, C.pink, { x, y: 0.75, z, seg: 10 });
      const p = b.push({ layer: 'trans', layerOpts: { opacity: 0.5 } });
      b.ball(0.38, '#9af0ff', { x, y: 1.25, z, sy: 1.1, seg: 8 });
      b.ball(0.28, '#9af0ff', { x, y: 1.8, z: z - 0.05, seg: 8 });
      for (const ex of [-0.15, 0.15]) b.cone(0.09, 0.2, '#9af0ff', { x: x + ex, y: 2.08, z: z - 0.05, seg: 4 });
      b.tube([[x + 0.2, 1.0, z + 0.3], [x + 0.6, 1.1, z + 0.5], [x + 0.55, 1.6, z + 0.6]], 0.06, '#9af0ff', { ts: 8, rs: 4 });
      b.pop(p);
    }
    // Marco, as a hologram, teaching (pointing at the board)
    const h = buildHuman(THREE, ctx.mats, 'hologrammarco', { variant: 0 });
    h.object3d.scale.setScalar(2.0);
    h.object3d.position.set(-2.4, 0.64, -2.2);
    h.object3d.rotation.y = 0.9;
    ctx.extras.push(h.object3d);
    const npc = { anim: 'point', animT: 0, x: 0, z: 0, px: 0, pz: 0 };
    ctx.anim((dt) => { npc.animT += dt; npc.anim = (npc.animT % 9) < 6 ? 'point' : 'wave'; h.update(npc, dt); });
  },

  firewallgate(b, ctx) {
    const { THREE } = ctx;
    for (const sx of [-1, 1]) {
      const prev = b.push({ m: new THREE.Matrix4().makeTranslation(sx * 11, 0, 0).multiply(new THREE.Matrix4().makeScale(0.4, 1.4, 0.7)) });
      items5.firewallbrick(b);
      b.pop(prev);
    }
    b.box(14, 3, 4, '#d8603e', { y: 15, fc: true, cf: (x, y, z, wx, wy) => (Math.floor(wy / 1) % 2 ? rgb('#e0704a') : rgb('#c0503a')) });
    for (let i = 0; i < 9; i++) b.box(0.4, 13, 0.4, '#5a4a6a', { x: -6 + i * 1.5, y: 7, z: 0 });
    signBoard(b, ctx, 'port443', [{ text: 'PORT 443', color: '#c0503a' }, { text: 'knock knock', size: 40 }], 6, 1.6, { y: 18.8, z: 2.1, bg: '#fff6e6' });
  },
};
