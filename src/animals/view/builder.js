// Skinned-mesh builder: merges primitive parts into ONE BufferGeometry with
// skin indices and weights, so a whole animal is a single SkinnedMesh (one
// draw call, plus one for the outline). Every vertex remembers a colour
// region and a "pattern coordinate" so looks and markings can be repainted
// live into the colour attribute without rebuilding anything.

import { hexToRgb } from '../../core/math.js';
import { paintPattern } from './markings.js';

// Colour regions. Look-driven ones come from the Look; the rest are fixed.
export const REG = {
  base: 0, secondary: 1, belly: 2, tips: 3, eyes: 4, nose: 5, patternColor: 6,
  white: 7, pupil: 8, shine: 9, tongue: 10, mouth: 11, pad: 12, inner: 13, beak: 14, claw: 15,
  custom: 16, // per-part fixed colour (part.color)
};
const LOOK_KEYS = ['base', 'secondary', 'belly', 'tips', 'eyes', 'nose', 'patternColor'];
const FIXED = { 7: '#fbfaf6', 8: '#15110f', 9: '#ffffff', 10: '#ef7f8e', 11: '#5a2a2e', 12: '#3a2a26', 13: '#f2b8b0', 14: '#f2a43a', 15: '#efe6d6' };

export function createBuilder(THREE, bones) {
  const parts = [];
  const boneIndex = new Map(bones.map((b, i) => [b.name, i]));
  const v3 = new THREE.Vector3(), n3 = new THREE.Vector3();
  const nm = new THREE.Matrix3();

  // geometry: any BufferGeometry (will be read, not kept).
  // o: { bone, matrix (local, in the bone's frame), region (key or fn(local, world, normal) -> [a, b, t]),
  //      weights: fn(world) -> [i0, w0, i1, w1] (bone indices), tag, u: fn(local) -> 0..1, color, pattern (bool) }
  function add(geometry, o) {
    const bi = boneIndex.get(o.bone);
    if (bi === undefined) throw new Error('animal view: unknown bone ' + o.bone);
    const bone = bones[bi];
    const g = geometry.index ? geometry : geometry; // keep index if present
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal') || (g.computeVertexNormals(), g.getAttribute('normal'));
    const mLocal = o.matrix || new THREE.Matrix4();
    const mWorld = new THREE.Matrix4().multiplyMatrices(bone.matrixWorld, mLocal);
    nm.getNormalMatrix(mWorld);
    const n = pos.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), L = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v3.fromBufferAttribute(pos, i);
      L[i * 3] = v3.x; L[i * 3 + 1] = v3.y; L[i * 3 + 2] = v3.z;
      v3.applyMatrix4(mWorld);
      P[i * 3] = v3.x; P[i * 3 + 1] = v3.y; P[i * 3 + 2] = v3.z;
      n3.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      N[i * 3] = n3.x; N[i * 3 + 1] = n3.y; N[i * 3 + 2] = n3.z;
    }
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: n }, (_, i) => i);
    parts.push({ P, N, L, idx, n, bi, o, gu: geometry.userData.u || null });
    geometry.dispose();
  }

  function build() {
    let nv = 0, ni = 0;
    for (const p of parts) { nv += p.n; ni += p.idx.length; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    const regA = new Uint8Array(nv), regB = new Uint8Array(nv), regT = new Float32Array(nv);
    const custom = new Float32Array(nv * 3); // fixed colour for REG.custom
    const pat = new Uint8Array(nv); // pattern allowed
    const tags = new Uint8Array(nv);
    const uu = new Float32Array(nv);
    const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const TAGS = ['body', 'head', 'leg', 'tail', 'ear', 'face', 'muzzle', 'paw', 'shell', 'arm', 'wing', 'neck', 'eye', 'other'];
    let vo = 0, io = 0;
    const tmpW = new THREE.Vector3(), tmpL = new THREE.Vector3(), tmpN = new THREE.Vector3();
    for (const p of parts) {
      const o = p.o;
      const cc = o.color ? hexToRgb(o.color) : null;
      const tagI = Math.max(0, TAGS.indexOf(o.tag || 'other'));
      for (let i = 0; i < p.n; i++) {
        const k = vo + i;
        pos[k * 3] = p.P[i * 3]; pos[k * 3 + 1] = p.P[i * 3 + 1]; pos[k * 3 + 2] = p.P[i * 3 + 2];
        nor[k * 3] = p.N[i * 3]; nor[k * 3 + 1] = p.N[i * 3 + 1]; nor[k * 3 + 2] = p.N[i * 3 + 2];
        tmpW.set(p.P[i * 3], p.P[i * 3 + 1], p.P[i * 3 + 2]);
        tmpL.set(p.L[i * 3], p.L[i * 3 + 1], p.L[i * 3 + 2]);
        tmpN.set(p.N[i * 3], p.N[i * 3 + 1], p.N[i * 3 + 2]);
        if (o.weights) {
          const w = o.weights(tmpW, tmpL, i, p.gu);
          si[k * 4] = w[0]; sw[k * 4] = w[1]; si[k * 4 + 1] = w[2] ?? 0; sw[k * 4 + 1] = w[3] ?? 0;
          if (w.length > 4) { si[k * 4 + 2] = w[4]; sw[k * 4 + 2] = w[5]; }
        } else { si[k * 4] = p.bi; sw[k * 4] = 1; }
        let r = o.region ?? 'base';
        if (typeof r === 'function') r = r(tmpL, tmpW, tmpN, i, p.gu);
        if (Array.isArray(r)) { regA[k] = REG[r[0]] ?? 0; regB[k] = REG[r[1]] ?? 0; regT[k] = r[2]; }
        else { regA[k] = REG[r] ?? 0; regB[k] = regA[k]; regT[k] = 0; }
        if (cc) { custom[k * 3] = cc.r; custom[k * 3 + 1] = cc.g; custom[k * 3 + 2] = cc.b; }
        pat[k] = o.pattern === false ? 0 : 1;
        tags[k] = tagI;
        uu[k] = o.u ? o.u(tmpL, tmpW, i, p.gu) : (p.gu ? p.gu[i] : 0);
      }
      for (let j = 0; j < p.idx.length; j++) index[io + j] = p.idx[j] + vo;
      vo += p.n; io += p.idx.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const info = { regA, regB, regT, custom, pat, tags, uu, TAGS, pos, nor, n: nv };
    return { geometry: geo, info };
  }

  return { add, build, boneIndex };
}

// Repaint the colour attribute from a Look. ctx gives species-specific
// pattern hints (eye positions, body extents).
export function paintLook(geometry, info, look, ctx) {
  const col = geometry.getAttribute('color');
  const arr = col.array;
  const pal = new Float32Array(17 * 3);
  for (let i = 0; i < LOOK_KEYS.length; i++) {
    const c = hexToRgb(look[LOOK_KEYS[i]] || '#888888');
    pal[i * 3] = srgbToLinear(c.r); pal[i * 3 + 1] = srgbToLinear(c.g); pal[i * 3 + 2] = srgbToLinear(c.b);
  }
  for (const k in FIXED) {
    const c = hexToRgb(FIXED[k]);
    pal[k * 3] = srgbToLinear(c.r); pal[k * 3 + 1] = srgbToLinear(c.g); pal[k * 3 + 2] = srgbToLinear(c.b);
  }
  const pc = [pal[6 * 3], pal[6 * 3 + 1], pal[6 * 3 + 2]];
  const { regA, regB, regT, custom, n } = info;
  for (let i = 0; i < n; i++) {
    let r, g, b;
    const a = regA[i], bb = regB[i], t = regT[i];
    if (a === REG.custom) { r = srgbToLinear(custom[i * 3]); g = srgbToLinear(custom[i * 3 + 1]); b = srgbToLinear(custom[i * 3 + 2]); }
    else { r = pal[a * 3]; g = pal[a * 3 + 1]; b = pal[a * 3 + 2]; }
    if (t > 0) {
      let r2, g2, b2;
      if (bb === REG.custom) { r2 = srgbToLinear(custom[i * 3]); g2 = srgbToLinear(custom[i * 3 + 1]); b2 = srgbToLinear(custom[i * 3 + 2]); }
      else { r2 = pal[bb * 3]; g2 = pal[bb * 3 + 1]; b2 = pal[bb * 3 + 2]; }
      r += (r2 - r) * t; g += (g2 - g) * t; b += (b2 - b) * t;
    }
    arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = b;
  }
  if (look.pattern && look.pattern !== 'none') paintPattern(arr, info, look, ctx, pc);
  col.needsUpdate = true;
}

export function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
