// Humans: friendly peg-people with personality, one skinned mesh each (rigid
// skinning: every vertex follows exactly one bone), so a crowd costs one draw
// call per person (plus one for glowing or translucent bits when they have any).
//
// buildHuman(THREE, mats, kind, opts?) -> { object3d, update(npc, dt), dispose() }
//   opts.variant: integer for colour variation within a crowd kind (defaults to a counter)
// update() animates bones only: render places object3d from the npc record.
import { createBuilder } from './kit.js';
import { PI, TAU, rgb, mixRgb, smooth, rngFrom, hashStr } from './util.js';
import { w1 } from './items/w1.js';
import { w4, tartan } from './items/w4.js';

// ---------------------------------------------------------------- skeleton
// Bone indices and rest positions (world space at 1.75 m, facing +Z, left = +X)
const B = { root: 0, hips: 1, spine: 2, head: 3, uArmL: 4, lArmL: 5, uArmR: 6, lArmR: 7, thighL: 8, shinL: 9, thighR: 10, shinR: 11 };
const PARENT = [-1, 0, 1, 2, 2, 4, 2, 6, 1, 8, 1, 10];
const REST = [
  [0, 0, 0], [0, 0.86, 0], [0, 0.92, 0], [0, 1.4, 0],
  [0.25, 1.34, 0], [0.25, 1.05, 0], [-0.25, 1.34, 0], [-0.25, 1.05, 0],
  [0.11, 0.84, 0], [0.11, 0.45, 0], [-0.11, 0.84, 0], [-0.11, 0.45, 0],
];

// pose channels
const P = {
  rootY: 0, rootRX: 1, rootRY: 2, rootRZ: 3, hipsRX: 4, hipsRY: 5, hipsRZ: 6, spineRX: 7, spineRY: 8, spineRZ: 9,
  headRX: 10, headRY: 11, headRZ: 12, uaLX: 13, uaLY: 14, uaLZ: 15, laLX: 16, uaRX: 17, uaRY: 18, uaRZ: 19, laRX: 20,
  thLX: 21, thLZ: 22, shLX: 23, thRX: 24, thRZ: 25, shRX: 26, rootZ: 27, laLY: 28, laRY: 29,
};
const NP = 30;

// ---------------------------------------------------------------- palettes
const SKINS = ['#f6d2b8', '#e8b48a', '#c88a5e', '#a0663e', '#7a4a2c', '#f2c6a0', '#d89a6a'];
const HAIRS = ['#3a2a22', '#6a4028', '#c8873a', '#2a2a30', '#e8c878', '#9a9aa0', '#a83a2a', '#5a3a24'];
const BRIGHTS = ['#ff7a59', '#3cc0c8', '#ffd23f', '#8bd450', '#b98cff', '#ff9ec7', '#6cc4f0', '#ffb347', '#e8473a', '#4f9a6a'];
const DARKS = ['#3a4a6a', '#2c3e66', '#4a4a55', '#5a3a2a', '#2f5d3a', '#6a5a8a'];

// Every design field is optional. top/bottom styles drive the colouring.
export const HUMAN_DESIGNS = {
  marco: { skin: '#e8b48a', hair: '#5a3a24', hairStyle: 'short', top: '#9b7bff', topStyle: 'tee', logo: 'cloud', bottom: '#3a4a6a', bottomStyle: 'shorts', shoes: '#7fe3c4', stubble: true, idle: 'idle' },
  kev: { skin: '#f0b890', hair: '#c8873a', hairStyle: 'fringe', top: '#ffd23f', topStyle: 'vest', bottom: '#e8473a', bottomStyle: 'shorts', shoes: '#ffffff', props: ['megaphone', 'whistle', 'shadesUp', 'zinc'], build: 1.12 },
  ze: { skin: '#a0663e', hair: '#2a2a30', hairStyle: 'short', top: '#fbf8f0', topStyle: 'shirt', bottom: '#3a5a8a', bottomStyle: 'trousers', shoes: '#8a5a3c', hat: 'straw', props: ['tray', 'tache', 'apron'], idle: 'sell' },
  pru: { skin: '#f6d2b8', hair: '#d8d8e0', hairStyle: 'perm', top: '#c8a8e8', topStyle: 'cardigan', bottom: '#8a6a8a', bottomStyle: 'skirt', shoes: '#6a4028', props: ['flask', 'pearls', 'specs'], build: 0.96 },
  packet: { special: 'packet' },
  hologrammarco: { base: 'marco', hologram: true },
  sunbather: { crowd: true, topStyle: 'swim', bottomStyle: 'swim', shoesNone: true, hat: 'sunhat', props: ['shades'], idle: 'lie' },
  jogger: { crowd: true, topStyle: 'tee', bottomStyle: 'shorts', props: ['headband'], idle: 'run' },
  cyclist: { crowd: true, topStyle: 'tee', bottomStyle: 'shorts', bottom: '#2a2a30', hat: 'helmet', props: ['bike'], ride: true },
  tourist: { crowd: true, topStyle: 'hawaii', bottom: '#d8c090', bottomStyle: 'shorts', hat: 'bucket', props: ['camera', 'socks'], skin: '#f6c8b0' },
  footvolleyer: { crowd: true, topStyle: 'bare', bottomStyle: 'shorts', shoesNone: true, hat: 'capback', idle: 'cheer' },
  vendor: { crowd: true, top: '#ff8a2a', topStyle: 'tee', bottom: '#fbf8f0', bottomStyle: 'shorts', hat: 'cap', hatCol: '#ff8a2a', props: ['canisters'], idle: 'sell' },
  kid: { crowd: true, scale: 0.68, headScale: 1.18, topStyle: 'stripes', bottomStyle: 'shorts', hat: 'cap' },
  commuter: { crowd: true, top: '#2c3e66', topStyle: 'suit', bottom: '#2c3e66', bottomStyle: 'trousers', shoes: '#2a2a30', props: ['briefcase', 'tie'] },
  queuer: { crowd: true, top: '#c89a6a', topStyle: 'coat', bottomStyle: 'trousers', hat: 'beanie', props: ['coffee', 'scarf'] },
  sentry: { top: '#d8342c', topStyle: 'tunic', bottom: '#2a2a30', bottomStyle: 'trousers', shoes: '#1c1c22', hat: 'bearskin', skin: '#f2c6a0' },
  birdwatcher: { crowd: true, top: '#9aa25a', topStyle: 'gilet', bottom: '#8a7a5a', bottomStyle: 'trousers', hat: 'bucket', hatCol: '#9aa25a', props: ['binoculars', 'backpack'] },
  hiker: { crowd: true, top: '#3cc0c8', topStyle: 'tee', bottom: '#8a7a5a', bottomStyle: 'shorts', shoes: '#8a5a3c', hat: 'cap', props: ['bigpack', 'pole'] },
  piper: { top: '#2a2a30', topStyle: 'jacket', bottomStyle: 'kilt', shoes: '#1c1c22', hat: 'bonnet', props: ['bagpipes', 'sporran', 'socks'], skin: '#f2c6a0' },
  skier: { crowd: true, topStyle: 'puffy', bottom: '#2c3e66', bottomStyle: 'trousers', hat: 'bobble', props: ['goggles', 'skis', 'poles'] },
  curler: { crowd: true, topStyle: 'jumper', bottom: '#2a2a30', bottomStyle: 'trousers', hat: 'flatcap', props: ['broom'] },
  techie: { crowd: true, top: '#b98cff', topStyle: 'hoodie', bottom: '#3a4a6a', bottomStyle: 'trousers', props: ['lanyard', 'laptop', 'specs'] },
  reader: { crowd: true, top: '#e6b33a', topStyle: 'cardigan', bottomStyle: 'trousers', props: ['book', 'specs'], idle: 'read' },
};
export const HUMAN_KINDS = Object.keys(HUMAN_DESIGNS);

let _variantCounter = 0;

function resolveDesign(kind, variant) {
  let d = HUMAN_DESIGNS[kind] || HUMAN_DESIGNS.marco;
  if (d.base) d = { ...HUMAN_DESIGNS[d.base], ...d };
  const r = rngFrom(hashStr(kind) ^ Math.imul(variant + 1, 2654435761));
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  const out = { ...d };
  out.skin = d.skin || pick(SKINS);
  out.hair = d.hair || pick(HAIRS);
  out.hairStyle = d.hairStyle || pick(['short', 'bob', 'bun', 'ponytail', 'curly', 'short', 'bald']);
  out.top = d.top || pick(BRIGHTS);
  out.top2 = pick(BRIGHTS.filter((c) => c !== out.top));
  out.bottom = d.bottom || pick(DARKS);
  out.shoes = d.shoes || pick(['#ffffff', '#2a2a30', '#ff7a59', '#3cc0c8', '#8a5a3c']);
  out.hatCol = d.hatCol || pick(BRIGHTS);
  out.scale = (d.scale || 1) * (d.crowd ? 0.94 + r() * 0.12 : 1);
  out.build = (d.build || 1) * (d.crowd ? 0.92 + r() * 0.18 : 1);
  out.phase = r() * TAU;
  return out;
}

// ---------------------------------------------------------------- geometry
function buildBody(b, d) {
  const k = d.build;
  const skin = d.skin;
  const bone = (i) => b.push({ bone: i });
  const ink = '#2f2a33';

  // colour helpers by world y (rest pose)
  const topColUnused = (x, y, z, wx, wy, wz) => {
    switch (d.topStyle) {
      case 'stripes': return Math.floor(wy * 18) % 2 ? rgb(d.top) : rgb('#fbf8f0');
      case 'hawaii': { const f = Math.sin(wx * 40) * Math.sin(wy * 40 + wz * 30); return f > 0.55 ? rgb('#fbf8f0') : f < -0.6 ? rgb('#ffd23f') : rgb(d.top); }
      case 'swim': return wy > 1.08 && wy < 1.26 ? rgb(d.top) : rgb(skin);
      case 'bare': return rgb(skin);
      case 'vest': return Math.abs(wx) > 0.15 && wy > 1.2 ? rgb(skin) : rgb(d.top);
      case 'suit': return Math.abs(wx) < 0.05 && wz > 0 && wy > 1.15 ? rgb('#fbf8f0') : rgb(d.top);
      case 'tunic': return Math.abs(wy - 0.98) < 0.035 ? rgb('#fbf8f0') : rgb(d.top);
      case 'cardigan': return Math.abs(wx) < 0.035 && wz > 0 ? (mixHex(d.top, '#ffffff', 0.4)) : rgb(d.top);
      case 'puffy': return Math.floor(wy * 11) % 2 ? rgb(d.top) : (mixHex(d.top, '#ffffff', 0.25));
      case 'jumper': return Math.abs(wy - 1.22) < 0.05 ? (Math.floor((wx + 1) * 30) % 2 ? rgb('#fbf8f0') : rgb('#c0392b')) : rgb(d.top);
      case 'gilet': return Math.abs(wx) > 0.16 ? rgb('#fbf8f0') : rgb(d.top);
      default: return rgb(d.top);
    }
  };
  const sleeve = { tee: 0.55, vest: 0, swim: 0, bare: 0, hawaii: 0.55, stripes: 0.55, gilet: 1, shirt: 0.7 }[d.topStyle] ?? 1;
  const sleeveCol = d.topStyle === 'gilet' ? '#fbf8f0' : d.topStyle === 'stripes' ? d.top : d.top;
  const shortLen = { shorts: 0.55, swim: 0.2, kilt: 0.6, skirt: 0.5 }[d.bottomStyle] ?? 1;
  const botCol = d.bottomStyle === 'swim' ? d.top2 : d.bottom;

  // pelvis
  let prev = bone(B.hips);
  b.box(0.38 * k, 0.2, 0.25 * k, botCol, { y: 0.87, r: 0.09 * k, cf: d.bottomStyle === 'kilt' ? (x, y, z, wx, wy, wz) => tartan(wx * 6 + 9, wy * 6 + wz * 4, 0.5) : null });
  if (d.bottomStyle === 'skirt') b.cyl(0.21 * k, 0.3 * k, 0.42, d.bottom, { y: 0.66, seg: 12, sz: 0.85 });
  if (d.bottomStyle === 'kilt') b.cyl(0.21 * k, 0.27 * k, 0.36, '#c0392b', { y: 0.7, seg: 14, sz: 0.85, fc: true, cf: (x, y, z, wx, wy, wz) => tartan(Math.atan2(wz, wx) * 1.2 + 9, wy * 5, 0.5) });
  b.pop(prev);

  // torso
  prev = bone(B.spine);
  const torsoCol = d.topStyle === 'bare' || d.topStyle === 'swim' ? skin : d.top;
  b.box(0.44 * k, 0.56, 0.3 * k, torsoCol, { y: 1.15, r: 0.13 * k, rk: 2 });
  const band = (y, h, col, o = {}) => b.cyl(0.228 * k, 0.228 * k, h, col, { y, seg: 18, sz: 0.69, ...o });
  switch (d.topStyle) {
    case 'stripes': for (let i = 0; i < 4; i++) band(0.98 + i * 0.1, 0.045, '#fbf8f0'); break;
    case 'swim': band(1.17, 0.12, d.top); break;
    case 'tunic': band(0.99, 0.06, '#fbf8f0'); break;
    case 'puffy': for (let i = 0; i < 3; i++) band(1.0 + i * 0.13, 0.05, mixHex(d.top, '#ffffff', 0.3), { sx: 1.05 }); break;
    case 'jumper': band(1.22, 0.08, '#c0392b', { fc: true, cf: (x, y, z) => (Math.floor((Math.atan2(z, x) + PI) * 4) % 2 ? rgb('#fbf8f0') : rgb('#c0392b')) }); break;
    case 'suit': b.box(0.1, 0.18, 0.02, '#fbf8f0', { y: 1.33, z: 0.148, r: 0.01 }); break;
    case 'cardigan': b.box(0.06, 0.5, 0.02, mixHex(d.top, '#ffffff', 0.35), { y: 1.13, z: 0.148, r: 0.01 }); break;
    case 'hawaii': for (let i = 0; i < 9; i++) { const a = i * 2.3; b.ball(0.035, i % 2 ? '#fbf8f0' : '#ffd23f', { x: Math.cos(a) * 0.15 * k, y: 0.95 + (i % 5) * 0.09, z: 0.15 * k * (Math.sin(a) > 0 ? 1 : -1), sz: 0.3, seg: 6 }); } break;
    case 'gilet': b.box(0.1, 0.5, 0.02, '#fbf8f0', { y: 1.15, z: 0.148 }); break;
    default:
  }
  if (d.topStyle === 'coat' || d.topStyle === 'tunic' || d.topStyle === 'jacket') b.cyl(0.23 * k, 0.26 * k, 0.24, d.top, { y: 0.84, seg: 12, sz: 0.75, open: true });
  if (d.topStyle === 'hoodie') { b.torus(0.12, 0.05, d.top, { y: 1.42, z: -0.06, rx: PI / 2 + 0.3, rs: 5, ts: 12 }); b.box(0.2, 0.12, 0.04, mixHex(d.top, '#000000', 0.12), { y: 1.0, z: 0.15, r: 0.03 }); }
  if (d.topStyle === 'tunic') for (let i = 0; i < 4; i++) b.ball(0.016, '#e8b83a', { y: 1.32 - i * 0.09, z: 0.155, seg: 5 });
  if (d.topStyle === 'cardigan') for (let i = 0; i < 3; i++) b.ball(0.014, '#fbf8f0', { x: 0.045, y: 1.28 - i * 0.1, z: 0.153, seg: 5 });
  if (d.logo === 'cloud') { for (const [x, y, r] of [[-0.04, 1.2, 0.04], [0.02, 1.22, 0.05], [0.07, 1.19, 0.035]]) b.ball(r, '#7fe3c4', { x, y, z: 0.145, sz: 0.25, seg: 8 }); }
  if (d.topStyle === 'jacket') for (let i = 0; i < 3; i++) b.ball(0.014, '#e8b83a', { x: 0.05, y: 1.3 - i * 0.1, z: 0.152, seg: 5 });
  b.pop(prev);

  // head
  prev = bone(B.head);
  const hs = d.headScale || 1;
  const hy = 1.4 + 0.18 * hs;
  b.cyl(0.06, 0.07, 0.1, skin, { y: 1.42, seg: 8 });
  b.ball(0.18 * hs, skin, { y: hy, seg: 16, sy: 1.04 });
  b.ball(0.035 * hs, skin, { x: 0.172 * hs, y: hy, seg: 6, sx: 0.5 });
  b.ball(0.035 * hs, skin, { x: -0.172 * hs, y: hy, seg: 6, sx: 0.5 });
  b.ball(0.032 * hs, d.props && d.props.includes('zinc') ? '#ffffff' : mixHex(skin, '#c86a5a', 0.25), { y: hy - 0.01, z: 0.18 * hs, seg: 8, sy: 0.85 });
  for (const sx of [-1, 1]) {
    b.ball(0.026 * hs, ink, { x: sx * 0.068 * hs, y: hy + 0.03, z: 0.155 * hs, seg: 8, sy: 1.25, sz: 0.6 });
    b.ball(0.009 * hs, '#ffffff', { x: sx * 0.068 * hs + 0.008, y: hy + 0.045, z: 0.17 * hs, seg: 4 });
    b.ball(0.03 * hs, '#ff9a9a', { x: sx * 0.11 * hs, y: hy - 0.03, z: 0.135 * hs, seg: 6, sz: 0.35 });
  }
  b.torus(0.045 * hs, 0.011, '#8a3a3a', { y: hy - 0.05, z: 0.165 * hs, arc: PI, rz: PI, rs: 4, ts: 8, rx: -0.25 });
  if (d.stubble) b.ball(0.15 * hs, mixHex(skin, '#5a3a24', 0.35), { y: hy - 0.07, z: 0.03, seg: 10, sy: 0.6, t0: PI * 0.55, tl: PI * 0.45 });
  hair(b, d, hy, hs);
  hat(b, d, hy, hs);
  b.pop(prev);

  // arms
  for (const side of [1, -1]) {
    const x = side * 0.25 * k;
    const ua = side > 0 ? B.uArmL : B.uArmR, la = side > 0 ? B.lArmL : B.lArmR;
    prev = bone(ua);
    b.ball(0.075 * k, d.topStyle === 'bare' || d.topStyle === 'swim' || d.topStyle === 'vest' ? skin : sleeveCol, { x, y: 1.32, seg: 8 });
    b.capsule(0.058 * k, 0.2, skin, { x, y: 1.2, seg: 8, cs: 2 });
    if (sleeve > 0) b.cyl(0.07 * k, 0.068 * k, 0.32 * Math.min(1, sleeve) + 0.02, sleeveCol, { x, y: 1.34 - (0.32 * Math.min(1, sleeve)) / 2, seg: 10 });
    b.pop(prev);
    prev = bone(la);
    b.capsule(0.052 * k, 0.2, skin, { x, y: 0.93, seg: 8, cs: 2 });
    if (sleeve >= 1) b.cyl(0.064 * k, 0.07 * k, 0.2, sleeveCol, { x, y: 0.96, seg: 10 });
    b.ball(0.062, d.props && d.props.includes('gloves') ? '#2a2a30' : skin, { x, y: 0.775, seg: 8 });
    b.pop(prev);
  }

  // legs
  for (const side of [1, -1]) {
    const x = side * 0.11 * k;
    const th = side > 0 ? B.thighL : B.thighR, sh = side > 0 ? B.shinL : B.shinR;
    prev = bone(th);
    if (shortLen >= 1) b.capsule(0.085 * k, 0.26, botCol, { x, y: 0.645, seg: 8, cs: 2 });
    else {
      b.capsule(0.078 * k, 0.26, skin, { x, y: 0.645, seg: 8, cs: 2 });
      if (d.bottomStyle !== 'skirt' && d.bottomStyle !== 'kilt') b.cyl(0.098 * k, 0.094 * k, 0.4 * shortLen + 0.04, botCol, { x, y: 0.86 - (0.4 * shortLen) / 2, seg: 10 });
    }
    b.pop(prev);
    prev = bone(sh);
    const sock = d.props && d.props.includes('socks');
    b.capsule(0.074 * k, 0.28, shortLen >= 1 ? botCol : skin, { x, y: 0.27, seg: 8, cs: 2 });
    if (sock && shortLen < 1) b.cyl(0.08 * k, 0.08 * k, 0.2, '#fbf8f0', { x, y: 0.2, seg: 10 });
    if (!d.shoesNone) b.box(0.13, 0.09, 0.24, d.shoes, { x, y: 0.045, z: 0.04, r: 0.04, cf: (x2, y, z, wx, wy) => (wy < 0.018 ? rgb('#fbf8f0') : rgb(d.shoes)) });
    else b.box(0.11, 0.05, 0.2, skin, { x, y: 0.025, z: 0.04, r: 0.025 });
    b.pop(prev);
  }
  props(b, d, k, hy, hs);
}

function mixHex(a, c, t) { const A = rgb(a), C = rgb(c); return [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t, A[2] + (C[2] - A[2]) * t]; }

function hair(b, d, hy, hs) {
  const h = d.hair, r = 0.18 * hs;
  switch (d.hairStyle) {
    case 'bald': return;
    case 'fringe': b.ball(r * 1.04, h, { y: hy, seg: 14, t0: PI * 0.5, tl: PI * 0.3, rx: 0 }); return; // ring round the back
    case 'perm': for (let i = 0; i < 14; i++) { const a = i * 2.4, e = 0.3 + (i % 4) * 0.22; b.ball(r * 0.42, h, { x: Math.cos(a) * r * Math.cos(e), y: hy + Math.sin(e) * r * 0.95 + 0.02, z: Math.sin(a) * r * Math.cos(e) - 0.02, seg: 7 }); } return;
    case 'curly': for (let i = 0; i < 11; i++) { const a = i * 2.4, e = 0.5 + (i % 3) * 0.3; b.ball(r * 0.4, h, { x: Math.cos(a) * r * Math.cos(e), y: hy + Math.sin(e) * r, z: Math.sin(a) * r * Math.cos(e) - 0.03, seg: 7 }); } return;
    default: break;
  }
  // cap of hair over the top and back, with a little quiff at the front
  b.ball(r * 1.06, h, { y: hy + 0.012, seg: 14, tl: PI * 0.48, rx: -0.35 });
  b.ball(r * 0.4, h, { x: 0.05, y: hy + r * 0.85, z: r * 0.5, seg: 7, sy: 0.6 });
  if (d.hairStyle === 'bob') b.ball(r * 1.1, h, { y: hy - 0.02, z: -0.02, seg: 12, sy: 0.9, t0: PI * 0.35, tl: PI * 0.35 });
  if (d.hairStyle === 'bun') b.ball(r * 0.42, h, { y: hy + r * 0.95, z: -r * 0.45, seg: 8 });
  if (d.hairStyle === 'ponytail') b.capsule(r * 0.24, r * 0.7, h, { y: hy - 0.02, z: -r * 1.05, rx: 0.4, seg: 6 });
}

function hat(b, d, hy, hs) {
  const r = 0.18 * hs, top = hy + r * 0.85, c = d.hatCol;
  switch (d.hat) {
    case 'straw':
      b.lathe([[0.42, 0], [0.4, 0.02], [0.2, 0.04], [0.17, 0.2], [0.0, 0.22], [0, 0.18], [0.15, 0.17], [0.17, 0.03], [0.38, 0.0]], '#f2d48a', { y: top - 0.08, seg: 18, cf: (x, y, z) => (Math.sin(Math.atan2(z, x) * 30) > 0 ? rgb('#f2d48a') : rgb('#e2bb68')) });
      b.cyl(0.175, 0.178, 0.04, '#c0392b', { y: top - 0.02, seg: 16 });
      return;
    case 'sunhat':
      b.lathe([[0.34, 0], [0.18, 0.03], [0.15, 0.13], [0, 0.15], [0, 0.12], [0.33, -0.02]], '#fff0c8', { y: top - 0.05, seg: 16 });
      b.cyl(0.155, 0.158, 0.035, '#ff7a59', { y: top - 0.0, seg: 14 });
      return;
    case 'cap': case 'capback': {
      const back = d.hat === 'capback';
      b.dome(r * 1.05, c, { y: hy + 0.03, seg: 14, sy: 0.75 });
      b.box(0.2, 0.02, 0.15, c, { y: hy + 0.05, z: back ? -0.24 : 0.24, rx: back ? -0.15 : 0.15, r: 0.01 });
      b.ball(0.02, '#fbf8f0', { y: hy + r * 0.8, seg: 5 });
      return;
    }
    case 'bucket':
      b.cyl(r * 0.9, r * 1.05, 0.13, c, { y: top, seg: 14 });
      b.cyl(r * 1.55, r * 1.05, 0.05, c, { y: top - 0.07, seg: 14, open: true });
      return;
    case 'helmet':
      b.dome(r * 1.12, c, { y: hy + 0.02, seg: 12, sy: 0.85, fc: true, cf: (x, y, z) => (Math.abs(x) < 0.03 ? rgb('#2a2a30') : rgb(c)) });
      return;
    case 'beanie': case 'bobble':
      b.dome(r * 1.06, c, { y: hy + 0.02, seg: 12, sy: 0.95 });
      b.cyl(r * 1.08, r * 1.08, 0.06, d.hat === 'bobble' ? '#fbf8f0' : c, { y: hy + 0.03, seg: 14 });
      if (d.hat === 'bobble') b.ball(0.05, '#fbf8f0', { y: hy + r * 1.05, seg: 7 });
      return;
    case 'bearskin':
      b.capsule(r * 1.05, 0.28, '#1c1c22', { y: hy + 0.2, seg: 12, df: (v) => { v.x *= 1 + 0.08 * Math.sin(v.y * 40); } });
      b.torus(0.12, 0.012, '#e8b83a', { y: hy - 0.07, z: 0.04, rx: PI / 2 + 0.3, rs: 4, ts: 10, arc: PI, rz: PI });
      return;
    case 'bonnet':
      b.cyl(r * 1.02, r * 1.05, 0.14, '#1c1c22', { y: top - 0.02, seg: 14 });
      b.cyl(r * 1.06, r * 1.06, 0.03, '#c0392b', { y: top - 0.08, seg: 14, fc: true, cf: (x, y, z) => (Math.floor((Math.atan2(z, x) + PI) * 3) % 2 ? rgb('#c0392b') : rgb('#fbf8f0')) });
      b.capsule(0.03, 0.18, '#fbf8f0', { x: 0.14, y: top + 0.1, rz: -0.4, seg: 6 });
      return;
    case 'flatcap':
      b.ball(r * 1.08, c, { y: hy + 0.06, seg: 12, sy: 0.45, sz: 1.1, z: 0.02 });
      b.box(0.24, 0.02, 0.1, c, { y: hy + 0.06, z: 0.2, rx: 0.2, r: 0.01 });
      return;
    default:
  }
}

function props(b, d, k, hy, hs) {
  const list = d.props || [];
  const has = (p) => list.includes(p);
  let prev;
  const onBone = (i, fn) => { prev = b.push({ bone: i }); fn(); b.pop(prev); };
  // right hand world rest position
  const RH = [-0.25 * k, 0.76, 0], LH = [0.25 * k, 0.76, 0];
  if (has('megaphone')) onBone(B.lArmR, () => {
    b.cyl(0.03, 0.1, 0.24, '#fbf8f0', { x: RH[0], y: RH[1] - 0.12, z: 0.07, seg: 10, cf: (x, y) => (y < -0.08 ? rgb('#e8473a') : rgb('#fbf8f0')) });
    b.box(0.04, 0.08, 0.04, '#e8473a', { x: RH[0], y: RH[1], z: 0.03 });
  });
  if (has('whistle')) onBone(B.spine, () => { b.torus(0.1, 0.006, '#e8473a', { y: 1.37, rx: PI / 2 + 0.25, rs: 3, ts: 12 }); b.box(0.04, 0.025, 0.06, '#ffd23f', { y: 1.27, z: 0.17, r: 0.01 }); });
  if (has('shadesUp')) onBone(B.head, () => { for (const sx of [-1, 1]) b.cyl(0.04, 0.04, 0.015, '#1c2a4a', { x: sx * 0.06, y: hy + 0.13, z: 0.13, rx: PI / 2 - 0.6, seg: 10 }); });
  if (has('shades') || has('goggles')) onBone(B.head, () => {
    if (has('goggles')) { b.box(0.3, 0.08, 0.06, '#ffb347', { y: hy + 0.05, z: 0.15, r: 0.03 }); b.torus(0.18, 0.012, '#2a2a30', { y: hy + 0.05, rx: PI / 2, rs: 3, ts: 14 }); }
    else for (const sx of [-1, 1]) b.cyl(0.04, 0.04, 0.015, '#1c2a4a', { x: sx * 0.068, y: hy + 0.03, z: 0.17, rx: PI / 2, seg: 10 });
  });
  if (has('specs')) onBone(B.head, () => { for (const sx of [-1, 1]) b.torus(0.035, 0.007, '#6a4a8a', { x: sx * 0.068, y: hy + 0.03, z: 0.175, rs: 3, ts: 10 }); b.box(0.04, 0.008, 0.008, '#6a4a8a', { y: hy + 0.035, z: 0.18 }); });
  if (has('tache')) onBone(B.head, () => { for (const sx of [-1, 1]) b.ball(0.035, '#2a2a30', { x: sx * 0.03, y: hy - 0.035, z: 0.165, sx: 1.3, sy: 0.5, sz: 0.5, rz: sx * 0.3, seg: 6 }); });
  if (has('headband')) onBone(B.head, () => b.cyl(0.185 * hs, 0.185 * hs, 0.045, d.top2, { y: hy + 0.07, seg: 14 }));
  if (has('tray')) onBone(B.spine, () => {
    b.box(0.6, 0.03, 0.38, '#c8925a', { y: 1.0, z: 0.36, r: 0.01 });
    b.box(0.62, 0.05, 0.02, '#a8743e', { y: 1.03, z: 0.55 });
    for (let i = 0; i < 4; i++) b.box(0.12, 0.05, 0.08, ['#ff9ec7', '#ffd23f', '#ff7a8c', '#3cc0c8'][i], { x: -0.2 + i * 0.13, y: 1.04, z: 0.38, r: 0.02 });
    b.ball(0.06, '#58b043', { x: 0.18, y: 1.07, z: 0.26, seg: 8 });
    b.tube([[-0.28, 1.02, 0.2], [-0.24, 1.4, 0.0], [0.24, 1.4, 0.0], [0.28, 1.02, 0.2]], 0.01, '#e8d4a8', { ts: 12, rs: 3 }); // neck strap
  });
  if (has('apron')) onBone(B.hips, () => b.box(0.34, 0.36, 0.03, '#ff8a2a', { y: 0.74, z: 0.14, r: 0.02 }));
  if (has('flask')) onBone(B.lArmL, () => { b.cyl(0.045, 0.045, 0.2, '#c0392b', { x: LH[0], y: LH[1] - 0.06, z: 0.06, seg: 10, fc: true, cf: (x, y, z, wx, wy, wz) => tartan(Math.atan2(z, x) * 1.5, wy * 8, 0.5) }); b.cyl(0.04, 0.04, 0.05, '#c8cce0', { x: LH[0], y: LH[1] + 0.06, z: 0.06, seg: 10 }); });
  if (has('pearls')) onBone(B.spine, () => { for (let i = 0; i < 11; i++) { const a = PI * 0.15 + (i / 10) * PI * 0.7; b.ball(0.014, '#fbf8f0', { x: Math.cos(a) * 0.12, y: 1.38 - Math.sin(a) * 0.06, z: Math.sin(a) * 0.1 + 0.03, seg: 5 }); } });
  if (has('camera')) onBone(B.spine, () => { b.box(0.13, 0.09, 0.06, '#2a2a30', { y: 1.2, z: 0.18, r: 0.015 }); b.cyl(0.03, 0.03, 0.05, '#4a4a55', { y: 1.2, z: 0.23, rx: PI / 2, seg: 8 }); b.torus(0.12, 0.006, '#2a2a30', { y: 1.33, rx: PI / 2 + 0.3, rs: 3, ts: 12 }); });
  if (has('canisters')) onBone(B.spine, () => {
    for (const sx of [-1, 1]) { b.cyl(0.09, 0.09, 0.4, '#d8dde6', { x: sx * 0.2, y: 1.05, z: -0.2, seg: 10 }); b.dome(0.09, '#e8473a', { x: sx * 0.2, y: 1.25, z: -0.2, seg: 8 }); }
    b.rod([-0.25, 1.42, -0.18], [0.25, 1.42, -0.18], 0.02, '#8a5a3c', { seg: 5 });
  });
  if (has('briefcase')) onBone(B.lArmR, () => { b.box(0.08, 0.3, 0.4, '#6a4028', { x: RH[0], y: RH[1] - 0.17, r: 0.02 }); b.torus(0.04, 0.01, '#3a2a1a', { x: RH[0], y: RH[1] - 0.01, ry: PI / 2, arc: PI, rs: 3, ts: 6 }); });
  if (has('tie')) onBone(B.spine, () => b.box(0.05, 0.24, 0.02, '#c0392b', { y: 1.24, z: 0.155, r: 0.01, df: (v) => { v.x *= 1 + Math.max(0, -v.y) * 3; } }));
  if (has('coffee')) onBone(B.lArmR, () => { b.cyl(0.04, 0.033, 0.11, '#fbf8f0', { x: RH[0], y: RH[1] - 0.02, z: 0.06, seg: 10, cf: (x, y) => (Math.abs(y) < 0.02 ? rgb('#c8925a') : rgb('#fbf8f0')) }); b.cyl(0.042, 0.042, 0.015, '#3a3a40', { x: RH[0], y: RH[1] + 0.04, z: 0.06, seg: 10 }); });
  if (has('scarf')) onBone(B.spine, () => { b.torus(0.12, 0.045, d.top2, { y: 1.4, rx: PI / 2, rs: 5, ts: 12 }); b.box(0.09, 0.26, 0.04, d.top2, { x: 0.06, y: 1.28, z: 0.15, rz: 0.1, r: 0.02 }); });
  if (has('binoculars')) onBone(B.spine, () => { for (const sx of [-1, 1]) b.cyl(0.03, 0.03, 0.1, '#3f5a3a', { x: sx * 0.035, y: 1.18, z: 0.2, rx: PI / 2, seg: 8 }); b.torus(0.12, 0.006, '#e8473a', { y: 1.31, rx: PI / 2 + 0.3, rs: 3, ts: 12 }); });
  if (has('backpack')) onBone(B.spine, () => b.box(0.32, 0.38, 0.16, '#8a6a4a', { y: 1.15, z: -0.22, r: 0.06 }));
  if (has('bigpack')) onBone(B.spine, () => { b.box(0.38, 0.62, 0.24, '#e8733a', { y: 1.22, z: -0.26, r: 0.08 }); b.cyl(0.07, 0.07, 0.4, '#4fa0d8', { y: 1.58, z: -0.26, rz: PI / 2, seg: 8 }); });
  if (has('pole')) onBone(B.lArmR, () => b.cyl(0.012, 0.012, 1.2, '#c8ccd2', { x: RH[0], y: RH[1] - 0.3, z: 0.05, seg: 5 }));
  if (has('poles')) for (const [bn, H] of [[B.lArmR, RH], [B.lArmL, LH]]) onBone(bn, () => { b.cyl(0.01, 0.01, 1.0, '#c8ccd2', { x: H[0], y: H[1] - 0.42, z: 0.05, seg: 5 }); b.cyl(0.04, 0.04, 0.01, '#2a2a30', { x: H[0], y: H[1] - 0.82, z: 0.05, seg: 8 }); });
  if (has('skis')) for (const [bn, sx] of [[B.shinL, 1], [B.shinR, -1]]) onBone(bn, () => b.box(0.09, 0.025, 1.5, '#e8473a', { x: sx * 0.11 * k, y: 0.012, z: 0.1, r: 0.01, df: (v) => { if (v.z > 0.55) v.y += (v.z - 0.55) * 0.4; } }));
  if (has('broom')) onBone(B.lArmR, () => { b.rod([RH[0], RH[1] + 0.25, -0.12], [RH[0] + 0.05, RH[1] - 0.72, 0.4], 0.014, '#e8d4a8', { seg: 5 }); b.box(0.22, 0.05, 0.08, '#27346a', { x: RH[0] + 0.05, y: RH[1] - 0.74, z: 0.41, r: 0.02 }); });
  if (has('lanyard')) onBone(B.spine, () => { b.torus(0.12, 0.006, '#7fe3c4', { y: 1.33, rx: PI / 2 + 0.35, rs: 3, ts: 12 }); b.box(0.06, 0.08, 0.01, '#fbf8f0', { y: 1.18, z: 0.16 }); });
  if (has('laptop')) onBone(B.lArmL, () => b.box(0.04, 0.24, 0.32, '#c8cce0', { x: LH[0] + 0.02, y: LH[1] + 0.12, z: 0.0, r: 0.01 }));
  if (has('book')) onBone(B.spine, () => {
    b.box(0.3, 0.02, 0.2, '#3cc0c8', { y: 1.02, z: 0.33, rx: -0.6, r: 0.006 });
    b.box(0.28, 0.025, 0.18, '#fbf8f0', { y: 1.035, z: 0.335, rx: -0.6, cf: (x, y, z, wx) => (Math.abs(wx) < 0.008 ? rgb('#c8c0b0') : rgb('#fbf8f0')) });
  });
  if (has('sporran')) onBone(B.hips, () => { b.box(0.14, 0.16, 0.05, '#fbf8f0', { y: 0.68, z: 0.18, r: 0.03 }); b.ball(0.02, '#e8b83a', { y: 0.75, z: 0.21, seg: 5 }); });
  if (has('bagpipes')) onBone(B.spine, () => {
    prev = b.push({ bone: B.spine, m: new (b._M)().makeScale(0.55, 0.55, 0.55).premultiply(new (b._M)().makeTranslation(0.22, 0.95, 0.12)) });
    w4.bagpipes(b);
    b.pop(prev);
  });
}

// ---------------------------------------------------------------- packet
function buildPacket(b) {
  const bone = (i) => b.push({ bone: i });
  let prev = bone(B.spine);
  b.box(0.7, 0.6, 0.55, '#fff6e6', { y: 0.72, r: 0.14, rk: 2 });
  b.box(0.72, 0.16, 0.57, '#b9a3ff', { y: 0.94, r: 0.08, cf: (x, y, z, wx) => (wx < -0.12 ? rgb('#7fe3c4') : wx < 0.12 ? rgb('#b9a3ff') : rgb('#ffb347')) });
  b.extrude([[-0.3, 0], [0.3, 0], [0, -0.2]], 0.02, '#f2e4cc', { y: 0.86, z: 0.28 });
  for (const sx of [-1, 1]) {
    b.ball(0.06, '#2f2a33', { x: sx * 0.13, y: 0.7, z: 0.27, sz: 0.5, sy: 1.2, seg: 8 });
    b.ball(0.02, '#ffffff', { x: sx * 0.13 + 0.02, y: 0.73, z: 0.3, seg: 5 });
    b.ball(0.04, '#ff9ed9', { x: sx * 0.22, y: 0.62, z: 0.27, sz: 0.3, seg: 6 });
  }
  b.torus(0.05, 0.012, '#8a3a5a', { y: 0.6, z: 0.28, arc: PI, rz: PI, rs: 4, ts: 8 });
  b.pop(prev);
  prev = bone(B.head);
  b.rod([0, 1.02, 0], [0.05, 1.28, -0.03], 0.015, '#3a3456', { seg: 5 });
  b.ball(0.05, '#7fffc8', { x: 0.05, y: 1.3, z: -0.03, seg: 8, layer: 'glow', blink: [1.0, 0] });
  b.box(0.16, 0.08, 0.02, '#3a3456', { x: -0.2, y: 1.05, z: 0.1, rz: 0.2, r: 0.01 }); // TTL tag
  b.pop(prev);
  for (const side of [1, -1]) {
    prev = bone(side > 0 ? B.lArmL : B.lArmR);
    b.capsule(0.05, 0.16, '#3a3456', { x: side * 0.4, y: 0.62, seg: 6 });
    b.ball(0.065, '#fff6e6', { x: side * 0.4, y: 0.5, seg: 7 });
    b.pop(prev);
    prev = bone(side > 0 ? B.shinL : B.shinR);
    b.capsule(0.055, 0.22, '#3a3456', { x: side * 0.15, y: 0.25, seg: 6 });
    b.box(0.14, 0.08, 0.2, '#7fe3c4', { x: side * 0.15, y: 0.04, z: 0.04, r: 0.035 });
    b.pop(prev);
  }
}
// packet rest skeleton (smaller): bones placed to fit the cube
const REST_PACKET = [
  [0, 0, 0], [0, 0.42, 0], [0, 0.42, 0], [0, 1.0, 0],
  [0.36, 0.78, 0], [0.38, 0.72, 0], [-0.36, 0.78, 0], [-0.38, 0.72, 0],
  [0.15, 0.42, 0], [0.15, 0.4, 0], [-0.15, 0.42, 0], [-0.15, 0.4, 0],
];

// ---------------------------------------------------------------- animation
// Each anim writes a target pose (channel values) from t (seconds) and phase.
function poseFor(anim, out, t, ph, run, design) {
  out.fill(0);
  const s = Math.sin, c = Math.cos;
  switch (anim) {
    case 'walk': case 'run': case 'flee': {
      const fast = anim !== 'walk';
      const A = fast ? 0.85 : 0.5;
      const sp = s(ph), cp = c(ph);
      out[P.thLX] = -sp * A; out[P.thRX] = sp * A;
      out[P.shLX] = Math.max(0, cp) * (fast ? 1.3 : 0.7) + 0.05; out[P.shRX] = Math.max(0, -cp) * (fast ? 1.3 : 0.7) + 0.05;
      out[P.rootY] = Math.abs(cp) * (fast ? 0.07 : 0.035) - (fast ? 0.04 : 0.01);
      out[P.spineRY] = sp * 0.12; out[P.hipsRY] = -sp * 0.1;
      out[P.spineRX] = fast ? 0.2 : 0.04;
      if (anim === 'flee') {
        out[P.spineRX] = -0.1;
        out[P.uaLZ] = 2.4 + s(t * 14) * 0.3; out[P.uaRZ] = -2.4 - s(t * 14 + 1) * 0.3;
        out[P.laLX] = -0.4; out[P.laRX] = -0.4; out[P.headRX] = -0.2; out[P.headRY] = s(t * 9) * 0.3;
      } else {
        out[P.uaLX] = sp * A * 0.9; out[P.uaRX] = -sp * A * 0.9;
        out[P.uaLZ] = 0.08; out[P.uaRZ] = -0.08;
        out[P.laLX] = fast ? -1.3 : -0.3; out[P.laRX] = fast ? -1.3 : -0.3;
        out[P.headRX] = -out[P.spineRX] * 0.6;
      }
      break;
    }
    case 'sit':
      out[P.rootY] = -0.7; out[P.thLX] = -1.5; out[P.thRX] = -1.5; out[P.shLX] = 0.25; out[P.shRX] = 0.25;
      out[P.thLZ] = 0.08; out[P.thRZ] = -0.08;
      out[P.spineRX] = -0.12 + s(t * 1.3) * 0.02; out[P.uaLX] = 0.5; out[P.uaRX] = 0.5; out[P.uaLZ] = 0.25; out[P.uaRZ] = -0.25;
      out[P.headRY] = s(t * 0.4) * 0.35; out[P.headRX] = 0.05;
      break;
    case 'lie':
      out[P.rootRX] = -PI / 2; out[P.rootY] = 0.16; out[P.rootZ] = 0.85;
      out[P.uaLZ] = 0.5 + s(t * 0.5) * 0.04; out[P.uaRZ] = -2.6; out[P.laRX] = -1.6;
      out[P.thRX] = -0.4; out[P.shRX] = 0.8; out[P.headRX] = -0.15; out[P.headRY] = s(t * 0.3) * 0.3;
      break;
    case 'swim': {
      out[P.rootRX] = PI / 2 - 0.15; out[P.rootY] = 0.15; out[P.rootZ] = -0.6;
      const p = t * 4;
      out[P.uaLX] = -((p % TAU) - PI); out[P.uaRX] = -(((p + PI) % TAU) - PI);
      out[P.thLX] = s(p * 2) * 0.3; out[P.thRX] = -s(p * 2) * 0.3;
      out[P.headRX] = -0.9; out[P.headRY] = s(p) * 0.35;
      break;
    }
    case 'wave':
      out[P.uaRZ] = -2.7; out[P.uaRX] = -0.2; out[P.laRX] = -0.5; out[P.laRY] = 0; out[P.uaRY] = s(t * 9) * 0.35;
      out[P.laRX] = -0.4 + s(t * 9) * 0.35;
      out[P.headRZ] = 0.1; out[P.spineRZ] = -0.06; out[P.uaLZ] = 0.1; out[P.rootY] = Math.abs(s(t * 4.5)) * 0.015;
      break;
    case 'cheer': {
      const j = Math.max(0, s(t * 6));
      out[P.rootY] = j * 0.18;
      out[P.uaLZ] = 2.7 + s(t * 12) * 0.15; out[P.uaRZ] = -2.7 - s(t * 12) * 0.15; out[P.laLX] = -0.3; out[P.laRX] = -0.3;
      out[P.thLX] = -j * 0.3; out[P.thRX] = -j * 0.3; out[P.shLX] = j * 0.6; out[P.shRX] = j * 0.6;
      out[P.headRX] = -0.25; out[P.spineRX] = -0.1;
      break;
    }
    case 'tut':
      // arms folded, head shaking, a disapproving lean
      out[P.uaLX] = -0.35; out[P.uaRX] = -0.35; out[P.uaLZ] = -0.25; out[P.uaRZ] = 0.25;
      out[P.laLX] = -1.75; out[P.laRX] = -1.65; out[P.laLY] = -0.9; out[P.laRY] = 0.9;
      out[P.headRY] = s(t * 7) * 0.35; out[P.headRX] = 0.1; out[P.spineRX] = -0.08; out[P.hipsRZ] = 0.05;
      break;
    case 'throw': {
      const p = (t % 1.6) / 1.6;
      const wind = p < 0.45 ? smooth(0, 0.45, p) : 1 - smooth(0.45, 0.6, p);
      const rel = smooth(0.45, 0.6, p) * (1 - smooth(0.8, 1, p));
      out[P.uaRX] = -0.3 + wind * 2.2 - rel * 2.9; out[P.uaRZ] = -0.4; out[P.laRX] = -0.9 * wind - 0.2;
      out[P.spineRY] = wind * 0.5 - rel * 0.4; out[P.spineRX] = rel * 0.25 - wind * 0.1;
      out[P.uaLX] = -0.8 * wind + rel * 0.5; out[P.uaLZ] = 0.3;
      out[P.thLX] = -0.35; out[P.thRX] = 0.25; out[P.shLX] = 0.2;
      break;
    }
    case 'dance': {
      const b = t * 7;
      out[P.rootY] = Math.abs(s(b)) * 0.06; out[P.hipsRZ] = s(b) * 0.12; out[P.spineRZ] = -s(b) * 0.15;
      out[P.uaLZ] = 1.6 + s(b) * 0.9; out[P.uaRZ] = -1.6 + s(b) * 0.9; out[P.laLX] = -1.0; out[P.laRX] = -1.0;
      out[P.thLX] = -Math.max(0, s(b)) * 0.5; out[P.thRX] = -Math.max(0, -s(b)) * 0.5;
      out[P.shLX] = Math.max(0, s(b)) * 0.8; out[P.shRX] = Math.max(0, -s(b)) * 0.8;
      out[P.headRZ] = s(b + 1) * 0.2; out[P.hipsRY] = s(b * 0.5) * 0.3;
      break;
    }
    case 'sell': {
      // tray hands forward, every few seconds a cupped-hand opera shout
      const shout = smooth(0.0, 0.3, (t % 4) / 4) * (1 - smooth(0.55, 0.75, (t % 4) / 4));
      out[P.uaLX] = -0.7; out[P.laLX] = -0.9; out[P.uaLZ] = 0.15;
      out[P.uaRX] = -0.7 - shout * 1.0; out[P.laRX] = -0.9 - shout * 1.3; out[P.uaRZ] = -0.15 - shout * 0.5;
      out[P.headRX] = -shout * 0.4; out[P.spineRX] = -shout * 0.15; out[P.rootY] = shout * 0.04 + Math.abs(s(t * 2)) * 0.01;
      out[P.headRY] = s(t * 0.7) * 0.3 * (1 - shout);
      break;
    }
    case 'read':
      out[P.uaLX] = -0.6; out[P.uaRX] = -0.6; out[P.laLX] = -1.0; out[P.laRX] = -1.0; out[P.uaLZ] = -0.15; out[P.uaRZ] = 0.15;
      out[P.headRX] = 0.45 + s(t * 0.6) * 0.04; out[P.headRY] = s(t * 1.3) * 0.12; out[P.spineRX] = 0.06;
      break;
    case 'point':
      out[P.uaRX] = -1.5; out[P.uaRZ] = 0.15; out[P.laRX] = -0.05; out[P.spineRY] = -0.2; out[P.headRY] = -0.15;
      out[P.uaLZ] = 0.15; out[P.uaLX] = 0.1; out[P.rootY] = Math.abs(s(t * 3)) * 0.01; out[P.uaRY] = s(t * 5) * 0.05;
      break;
    case 'fly': {
      const f = s(t * 9);
      out[P.uaLZ] = 1.4 + f * 0.7; out[P.uaRZ] = -1.4 - f * 0.7; out[P.rootY] = 0.06 + Math.abs(f) * 0.05;
      out[P.thLX] = 0.2; out[P.thRX] = 0.3; out[P.shLX] = 0.5; out[P.shRX] = 0.6; out[P.spineRX] = 0.2; out[P.headRX] = -0.3;
      break;
    }
    case 'peck': {
      const p = Math.max(0, s(t * 5));
      out[P.spineRX] = 0.3 + p * 0.7; out[P.headRX] = p * 0.4; out[P.hipsRX] = p * 0.2;
      out[P.uaLX] = -p * 0.6; out[P.uaRX] = -p * 0.6; out[P.thLX] = -p * 0.25; out[P.thRX] = -p * 0.25; out[P.shLX] = p * 0.5; out[P.shRX] = p * 0.5; out[P.rootY] = -p * 0.06;
      break;
    }
    case 'hop': {
      const p = (t * 2.2) % 1;
      const air = s(p * PI);
      out[P.rootY] = air * 0.3 - (1 - air) * 0.05;
      out[P.thLX] = -(1 - air) * 0.5; out[P.thRX] = -(1 - air) * 0.5; out[P.shLX] = (1 - air) * 0.9; out[P.shRX] = (1 - air) * 0.9;
      out[P.uaLZ] = 0.3 + air * 0.6; out[P.uaRZ] = -0.3 - air * 0.6; out[P.spineRX] = (1 - air) * 0.2;
      break;
    }
    case 'ride': {
      const p = ph;
      out[P.rootY] = -0.02; out[P.spineRX] = 0.42; out[P.headRX] = -0.35;
      out[P.uaLX] = -1.05; out[P.uaRX] = -1.05; out[P.laLX] = -0.2; out[P.laRX] = -0.2; out[P.uaLZ] = 0.05; out[P.uaRZ] = -0.05;
      out[P.thLX] = -1.05 + s(p) * 0.45; out[P.thRX] = -1.05 - s(p) * 0.45;
      out[P.shLX] = 1.1 - s(p) * 0.3 + c(p) * 0.2; out[P.shRX] = 1.1 + s(p) * 0.3 - c(p) * 0.2;
      break;
    }
    default: { // idle: breathing, weight shifts, glances around
      const br = s(t * 1.8);
      out[P.rootY] = br * 0.006; out[P.spineRX] = br * 0.015;
      out[P.uaLZ] = 0.1 + br * 0.02; out[P.uaRZ] = -0.1 - br * 0.02; out[P.laLX] = -0.12; out[P.laRX] = -0.12;
      const look = s(t * 0.37 + ph) * s(t * 0.21);
      out[P.headRY] = look * 0.5; out[P.headRX] = s(t * 0.29 + ph) * 0.06;
      out[P.hipsRZ] = s(t * 0.25 + ph) * 0.03; out[P.thLZ] = 0.02; out[P.thRZ] = -0.02;
    }
  }
  if (design && design.special === 'packet') {
    // little legs: thighs are zero-length, so fold leg swing onto the shins
    out[P.shLX] = out[P.thLX] * 0.8; out[P.shRX] = out[P.thRX] * 0.8;
  }
  void run;
}

// ---------------------------------------------------------------- build
export function buildHuman(THREE, mats, kind, opts = {}) {
  const variant = opts.variant ?? _variantCounter++;
  const d = resolveDesign(kind, variant);
  const b = createBuilder(THREE);
  b._M = THREE.Matrix4;
  const packet = d.special === 'packet';
  const rest = packet ? REST_PACKET : REST;
  if (packet) buildPacket(b);
  else {
    buildBody(b, d);
    if (d.props && d.props.includes('bike')) {
      const prev = b.push({ bone: B.root, m: new THREE.Matrix4().makeTranslation(0, 0, 0.12).multiply(new THREE.Matrix4().makeScale(1.0, 0.98, 1.0)) });
      w1.bicycle(b);
      b.pop(prev);
    }
  }
  if (d.hologram) {
    // tint everything cyan and move it to the translucent glow layer
    for (const L of b.layers.values()) {
      for (let i = 0; i < L.col.length; i += 3) { const l = (L.col[i] + L.col[i + 1] + L.col[i + 2]) / 3; L.col[i] = 0.25 + l * 0.4; L.col[i + 1] = 0.8 + l * 0.2; L.col[i + 2] = 0.95; }
    }
    const main = b.layers.get('main');
    b.layers.delete('main');
    main.name = 'holo';
    b.layers.set('holo', main);
    const prev = b.push({ bone: B.root });
    b.cyl(0.45, 0.5, 0.06, '#5ad8ff', { y: 0.03, seg: 20, layer: 'glow', blink: [0, 0] });
    b.cyl(0.3, 0.3, 0.02, '#c8f8ff', { y: 0.065, seg: 20, layer: 'glow', blink: [0.8, 0] });
    b.pop(prev);
  }
  const s = d.scale;
  if (s !== 1) b.transform(0, 0, 0, s, s, s);

  // bones
  const bones = rest.map((p, i) => { const bn = new THREE.Bone(); bn.name = Object.keys(B)[i]; return bn; });
  rest.forEach((p, i) => {
    const par = PARENT[i];
    const pp = par >= 0 ? rest[par] : [0, 0, 0];
    bones[i].position.set((p[0] - pp[0]) * s, (p[1] - pp[1]) * s, (p[2] - pp[2]) * s);
    if (par >= 0) bones[par].add(bones[i]);
  });
  bones[B.lArmL].rotation.order = 'YXZ'; bones[B.lArmR].rotation.order = 'YXZ';
  const object3d = new THREE.Group();
  object3d.name = 'human:' + kind;
  object3d.add(bones[0]);
  object3d.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const geos = b.geometries();
  const meshes = [];
  for (const name of Object.keys(geos)) {
    const { geometry } = geos[name];
    let mat;
    if (name === 'holo') mat = mats.toon('#ffffff', { vertexColors: true, transparent: true, opacity: 0.5, rim: true });
    else if (name === 'glow') mat = blinkFor(THREE, mats);
    else if (name === 'trans') mat = mats.toon('#ffffff', { vertexColors: true, transparent: true, opacity: 0.55 });
    else mat = mats.toon('#ffffff', { vertexColors: true });
    const mesh = new THREE.SkinnedMesh(geometry, mat);
    mesh.name = name;
    mesh.castShadow = name === 'main';
    mesh.frustumCulled = false; // tiny bounds, posed outside bind pose
    object3d.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    meshes.push(mesh);
  }
  object3d.userData.triangles = b.triangles();
  object3d.userData.kind = kind;

  // animation state (preallocated)
  const target = new Float32Array(NP), cur = new Float32Array(NP);
  let clock = d.phase * 3, ph = d.phase, lastAnim = 'idle', animClock = 0;
  const idleAnim = d.idle || 'idle';
  const hips0 = bones[B.hips].position.y;
  poseFor(idleAnim === 'run' ? 'idle' : idleAnim, cur, 0, ph, false, d);

  function apply() {
    const r = bones[B.root];
    r.position.set(0, cur[P.rootY] * s, cur[P.rootZ] * s);
    r.rotation.set(cur[P.rootRX], cur[P.rootRY], cur[P.rootRZ]);
    bones[B.hips].position.y = hips0;
    bones[B.hips].rotation.set(cur[P.hipsRX], cur[P.hipsRY], cur[P.hipsRZ]);
    bones[B.spine].rotation.set(cur[P.spineRX], cur[P.spineRY], cur[P.spineRZ]);
    bones[B.head].rotation.set(cur[P.headRX], cur[P.headRY], cur[P.headRZ]);
    bones[B.uArmL].rotation.set(cur[P.uaLX], cur[P.uaLY], cur[P.uaLZ]);
    bones[B.lArmL].rotation.set(cur[P.laLX], cur[P.laLY], 0);
    bones[B.uArmR].rotation.set(cur[P.uaRX], cur[P.uaRY], cur[P.uaRZ]);
    bones[B.lArmR].rotation.set(cur[P.laRX], cur[P.laRY], 0);
    bones[B.thighL].rotation.set(cur[P.thLX], 0, cur[P.thLZ]);
    bones[B.shinL].rotation.set(cur[P.shLX], 0, 0);
    bones[B.thighR].rotation.set(cur[P.thRX], 0, cur[P.thRZ]);
    bones[B.shinR].rotation.set(cur[P.shRX], 0, 0);
  }
  apply();

  function update(npc, dt) {
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    clock += dt;
    let anim = (npc && npc.anim) || idleAnim;
    if (anim === 'idle' && idleAnim !== 'idle' && idleAnim !== 'run') anim = idleAnim;
    if (d.ride && (anim === 'idle' || anim === 'walk' || anim === 'run' || anim === 'flee')) anim = 'ride';
    if (anim !== lastAnim) { lastAnim = anim; animClock = 0; }
    animClock += dt;
    let speed = 0;
    if (npc && npc.px !== undefined && npc.pz !== undefined) speed = Math.hypot(npc.x - npc.px, npc.z - npc.pz) * 60;
    if (speed > 12) speed = 0; // teleports
    const fast = anim === 'run' || anim === 'flee';
    const nominal = anim === 'ride' ? 4.5 : fast ? 3.6 : 1.3;
    const v = speed > 0.2 ? speed : nominal;
    ph += dt * (v / (anim === 'ride' ? 0.6 : fast ? 0.9 : 0.62)) * PI * (anim === 'walk' || fast || anim === 'ride' ? 1 : 0);
    const t = (npc && npc.animT !== undefined && anim === npc.anim ? npc.animT : animClock) + d.phase;
    poseFor(anim, target, t, ph, fast, d);
    const k = 1 - Math.exp(-14 * dt);
    for (let i = 0; i < NP; i++) cur[i] += (target[i] - cur[i]) * k;
    apply();
  }

  function dispose() {
    for (const m of meshes) m.geometry.dispose();
    skeleton.dispose();
  }

  return { object3d, update, dispose };
}

// blink material for skinned glow parts (MeshBasicMaterial supports skinning)
import { blinkMaterial } from './kit.js';
function blinkFor(THREE, mats) { return blinkMaterial(THREE, mats, {}); }
