// buildScenery(THREE, mats, world) -> { group, update(dt, simState), dispose() }
// Terrain (sampled from heightAt, vertex colours by surfaceAt, softly blended,
// with a skirt out to the horizon), water bodies following the tide formula,
// every world.scenery entry (static parts merged by material into a few spatial
// chunks, swaying parts instanced, animated parts kept live), and per-world
// backdrop dressing.
import { createBuilder } from './kit.js';
import { buildSceneryMesh, PARAM_IDS, STRIP_IDS, backdropMaterial } from './scenery/index.js';
import { SCENERY } from '../ids.js';
import { rgb, noise2, fbm2, smooth, rngFrom, hashStr, lumpy, mixRgb } from './util.js';
import { hazeCf } from './scenery/w1.js';
import { buildGroundCover } from './groundcover.js';

const TAU = Math.PI * 2;
const VARIED = new Set(['hotelblock', 'apartmentblock', 'terrace']);

function mixHexStr(a, c, t) {
  const pa = parseInt(a.slice(1), 16), pc = parseInt(c.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pc >> sh) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

function surfaceColours(world) {
  const p = world.palette || {};
  const g = p.ground || '#7fb35e';
  const grass = { w1: '#8ccf6a', w2: g, w3: g, w4: '#a8c890', w5: '#cfe8c8' }[world.id] || '#7fb35e';
  return {
    sand: world.id === 'w1' ? g : '#e8d4a0', pavement: '#d8d2c4', grass, water: '#c8b890',
    snow: world.id === 'w4' ? '#f4f6fb' : '#fbf8ff', ice: '#cfe6f4', wood: mixHexStr(g, '#b9824e', 0.25), rock: world.id === 'w4' ? '#a8a6b4' : '#9a958c',
    leaves: '#5a9a40', data: world.id === 'w5' ? '#d4c8fa' : '#e8e0ff', default: g,
    horizonGround: world.id === 'w5' ? '#efe8ff' : world.id === 'w4' ? '#f4f6fb' : g,
  };
}

// ----------------------------------------------------------------- terrain
function buildTerrain(THREE, world) {
  const bd = world.bounds;
  const pad = Math.max(20, (bd.maxX - bd.minX) * 0.08);
  const minX = bd.minX - pad, maxX = bd.maxX + pad, minZ = bd.minZ - pad, maxZ = bd.maxZ + pad;
  const span = Math.max(maxX - minX, maxZ - minZ);
  const cell = Math.min(14, Math.max(0.8, span / 190));
  const nx = Math.ceil((maxX - minX) / cell), nz = Math.ceil((maxZ - minZ) / cell);
  const cols = surfaceColours(world);
  const H = (x, z) => { try { const y = world.heightAt(x, z); return Number.isFinite(y) ? y : 0; } catch { return 0; } };
  const S = (x, z) => { try { return world.surfaceAt(x, z); } catch { return 'default'; } };
  const water = world.water || [];
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const col = new Float32Array((nx + 1) * (nz + 1) * 3);
  const off = [[0, 0], [0.6, 0.3], [-0.5, 0.55], [0.3, -0.6], [-0.4, -0.4]];
  let k = 0;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = minX + i * cell, z = minZ + j * cell;
      const y = H(x, z);
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      // soft blend: average the surface colour over a little jittered footprint
      let r = 0, g = 0, b = 0;
      for (const [ox, oz] of off) { const c = rgb(cols[S(x + ox * cell, z + oz * cell)] || cols.default); r += c[0]; g += c[1]; b += c[2]; }
      r /= off.length; g /= off.length; b /= off.length;
      // subtle storybook mottling
      const n = world.id === 'w5' ? 1 + fbm2(x * 0.02, z * 0.02, 3) * 0.14 : 1 + fbm2(x * 0.08, z * 0.08, 3) * 0.12 + noise2(x * 0.7, z * 0.7) * 0.03;
      r *= n; g *= n; b *= n;
      // wet sand / darker bed under water
      for (const w of water) {
        if (!w.rect) continue;
        if (x < w.rect.minX - 4 || x > w.rect.maxX + 4 || z < w.rect.minZ - 4 || z > w.rect.maxZ + 4) continue;
        const depth = w.level + (w.tide ? w.tide.amp : 0) - y;
        if (depth > -0.4) { const t = smooth(-0.4, 2.0, depth); r *= 1 - 0.3 * t; g *= 1 - 0.22 * t; b *= 1 - 0.1 * t; }
      }
      col[k] = r; col[k + 1] = g; col[k + 2] = b;
      k += 3;
    }
  }
  const idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i;
    idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
  }
  // skirt: a ring from the terrain edge out to the horizon so there's never a void
  const perim = [];
  for (let i = 0; i <= nx; i++) perim.push(i);
  for (let j = 1; j <= nz; j++) perim.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) perim.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j >= 1; j--) perim.push(j * (nx + 1));
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const far = Math.max(3500, span * 4);
  const base = (nx + 1) * (nz + 1);
  const RINGS = 3;
  const P2 = new Float32Array(pos.length + perim.length * RINGS * 3), C2 = new Float32Array(col.length + perim.length * RINGS * 3);
  P2.set(pos); C2.set(col);
  const gc = rgb(cols.horizonGround || cols.default);
  const clampY = (y) => Math.max(-300, Math.min(800, y));
  perim.forEach((p, q) => {
    const x = pos[p * 3], z = pos[p * 3 + 2];
    const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1;
    const ux = dx / l, uz = dz / l;
    const d1 = l * 1.35 + 60, d2 = l * 2.4 + 300;
    const y1 = clampY(H(cx + ux * d1, cz + uz * d1)), y2 = clampY(H(cx + ux * d2, cz + uz * d2));
    const ring = [[d1, y1], [d2, y2], [far, y2 - 20]];
    for (let k = 0; k < RINGS; k++) {
      const o = (base + q * RINGS + k) * 3;
      P2[o] = cx + ux * ring[k][0]; P2[o + 1] = ring[k][1]; P2[o + 2] = cz + uz * ring[k][0];
      const sx = P2[o], sz = P2[o + 2];
      const c = k === 0 ? rgb(cols[S(sx, sz)] || cols.default) : gc;
      const n = 1 + fbm2(sx * 0.01, sz * 0.01, 2) * 0.1;
      C2[o] = c[0] * n; C2[o + 1] = c[1] * n; C2[o + 2] = c[2] * n;
    }
  });
  const np = perim.length;
  for (let q = 0; q < np; q++) {
    const q2 = (q + 1) % np;
    const a = perim[q], b2 = perim[q2];
    const r1 = base + q * RINGS, r2 = base + q2 * RINGS;
    idx.push(a, b2, r1, b2, r2, r1);
    for (let k = 0; k < RINGS - 1; k++) idx.push(r1 + k, r2 + k, r1 + k + 1, r2 + k, r2 + k + 1, r1 + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P2, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C2, 3));
  g.setIndex(P2.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ----------------------------------------------------------------- merging
function mergeInto(bucket, geo, matrix, THREE) {
  const P = geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, U = geo.attributes.uv, BL = geo.attributes.blink;
  const nm = new THREE.Matrix3().getNormalMatrix(matrix);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const base = bucket.pos.length / 3;
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(matrix);
    bucket.pos.push(v.x, v.y, v.z);
    if (N) { n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); bucket.nor.push(n.x, n.y, n.z); } else bucket.nor.push(0, 1, 0);
    if (C) bucket.col.push(C.getX(i), C.getY(i), C.getZ(i)); else bucket.col.push(1, 1, 1);
    if (U) bucket.uv.push(U.getX(i), U.getY(i)); else bucket.uv.push(0, 0);
    if (BL) bucket.blink.push(BL.getX(i), BL.getY(i)); else bucket.blink.push(0, 0);
  }
  const flip = matrix.determinant() < 0;
  if (geo.index) {
    const I = geo.index.array;
    for (let i = 0; i < I.length; i += 3) {
      if (flip) bucket.idx.push(base + I[i], base + I[i + 2], base + I[i + 1]);
      else bucket.idx.push(base + I[i], base + I[i + 1], base + I[i + 2]);
    }
  } else for (let i = 0; i < P.count; i += 3) bucket.idx.push(base + i, base + i + (flip ? 2 : 1), base + i + (flip ? 1 : 2));
  bucket.uvUsed = bucket.uvUsed || !!U;
  bucket.blinkUsed = bucket.blinkUsed || !!BL;
}

function bucketGeometry(THREE, bk) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(bk.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(bk.col, 3));
  if (bk.uvUsed) g.setAttribute('uv', new THREE.Float32BufferAttribute(bk.uv, 2));
  if (bk.blinkUsed) g.setAttribute('blink', new THREE.Float32BufferAttribute(bk.blink, 2));
  g.setIndex(bk.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(bk.idx, 1) : new THREE.Uint16BufferAttribute(bk.idx, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// ----------------------------------------------------------------- dressing
// Distant per-world silhouettes in the fog-free backdrop material, tinted to the horizon.
function buildDressing(THREE, mats, world) {
  const b = createBuilder(THREE);
  const pal = world.palette || {};
  const bd = world.bounds;
  const cx = (bd.minX + bd.maxX) / 2, cz = (bd.minZ + bd.maxZ) / 2;
  const span = Math.max(bd.maxX - bd.minX, bd.maxZ - bd.minZ);
  const R = span * 0.9 + 420;
  const r = rngFrom(hashStr(world.id));
  const prev = b.push({ layer: 'backdrop' });
  const hill = (a, dist, w, h, col, haze) => {
    const x = cx + Math.sin(a) * dist, z = cz + Math.cos(a) * dist;
    b.ball(1, col, { x, y: -h * 0.15, z, sx: w, sy: h, sz: w * 0.7, ry: a, seg: 12, hseg: 6, tl: Math.PI / 2, df: lumpy(0.08, 2.0, a * 3), cf: hazeCf((lx, ly, lz, wx, wy) => mixRgb(col, '#ffffff', 0.0), pal, haze) });
  };
  if (world.id === 'w1') {
    // green morros behind the avenue (the beach faces -Z, the city +Z)
    for (let i = 0; i < 9; i++) hill(-1.2 + i * 0.3 + r() * 0.1, R + r() * 120, 90 + r() * 80, 70 + r() * 70, '#5a9a5a', 0.45 + r() * 0.15);
    for (let i = 0; i < 18; i++) { const a = -0.9 + i * 0.1; const x = cx + Math.sin(a) * (R * 0.7), z = cz + Math.cos(a) * (R * 0.7); b.box(18 + r() * 14, 30 + r() * 50, 14, ['#ffe0d0', '#e8f0f4', '#fff4d8'][i % 3], { x, y: 10, z, ry: a, cf: hazeCf(['#ffe0d0', '#e8f0f4', '#fff4d8'][i % 3], pal, 0.45) }); }
  } else if (world.id === 'w2') {
    // a generic London-ish skyline: towers, a dome, a clock tower, a big wheel
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + r() * 0.1, d = R + r() * 100;
      const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, h = 20 + r() * 60;
      const c = ['#b8c0c8', '#c8c0b0', '#a8b4c0'][i % 3];
      b.box(16 + r() * 20, h, 16, c, { x, y: h / 2, z, ry: a, cf: hazeCf(c, pal, 0.5) });
      if (i % 7 === 2) b.dome(20, c, { x, y: h, z, seg: 12, cf: hazeCf(c, pal, 0.5) });
      if (i % 9 === 4) b.cone(7, 30, c, { x, y: h + 15, z, seg: 4, cf: hazeCf(c, pal, 0.5) });
    }
    const a = 2.2, x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
    b.torus(45, 2, '#c8ccd4', { x, y: 55, z, ry: a + Math.PI / 2, rs: 4, ts: 32, cf: hazeCf('#c8ccd4', pal, 0.45, false) });
  } else if (world.id === 'w3') {
    for (let i = 0; i < 18; i++) hill((i / 18) * TAU + r() * 0.2, R + 100 + r() * 150, 160 + r() * 90, 70 + r() * 90, ['#3f8a4a', '#4f9a4a', '#5aa050'][i % 3], 0.4 + r() * 0.2);
  } else if (world.id === 'w4') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + r() * 0.2, d = R + 300 + r() * 200;
      const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, h = 150 + r() * 120;
      b.cone(180 + r() * 100, h, '#a8a8c0', { x, y: h / 2 - 10, z, seg: 9, df: lumpy(0.06, 0.02, i), cf: hazeCf((lx, ly) => (ly > h * 0.05 ? rgb('#ffffff') : rgb('#8a88a8')), pal, 0.45) });
    }
  } else if (world.id === 'w5') {
    // a sea of soft cloud far below and floating islets on the horizon
    b.circle(R * 4, '#8a6ab8', { x: cx, y: -140, z: cz, seg: 32, cf: hazeCf('#9a7ac8', pal, 0.3, false) });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU + r() * 0.2, d = R + 200 + r() * 400;
      const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, y = -60 + r() * 160;
      b.ico(40 + r() * 50, '#e8dcff', { x, y, z, sy: 0.45, detail: 1, cf: hazeCf((lx, ly) => (ly > 0 ? rgb('#ffffff') : rgb('#b8a0e8')), pal, 0.35) });
      if (i % 3 === 0) b.box(14, 60 + r() * 60, 14, '#4a4470', { x, y: y + 30, z, cf: hazeCf('#5a5488', pal, 0.3) });
    }
  }
  b.pop(prev);
  if (!b.layers.size) return null;
  const grp = b.toGroup(mats, () => backdropMaterial(THREE, mats));
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.userData.noShadow = true; } });
  return grp;
}

// ----------------------------------------------------------------- main
export function buildScenery(THREE, mats, world) {
  const group = new THREE.Group();
  group.name = 'world:' + world.id;
  const disposables = [];
  const anims = [];
  const H = (x, z) => { try { const y = world.heightAt(x, z); return Number.isFinite(y) ? y : 0; } catch { return 0; } };

  // terrain
  const tg = buildTerrain(THREE, world);
  const terrain = new THREE.Mesh(tg, mats.toon('#ffffff', { vertexColors: true, detail: true }));
  terrain.name = 'terrain';
  terrain.receiveShadow = true; terrain.castShadow = false; terrain.userData.noShadow = true;
  group.add(terrain);
  disposables.push(tg);

  // grass tufts and flowers on grass and leaf litter
  const cover = buildGroundCover(THREE, mats, world);
  group.add(cover.group);
  disposables.push(cover);

  // water bodies
  const pal = world.palette || {};
  const waters = [];
  for (const w of world.water || []) {
    const rect = w.rect || { minX: world.bounds.minX, maxX: world.bounds.maxX, minZ: world.bounds.minZ, maxZ: world.bounds.maxZ };
    let { minX, maxX, minZ, maxZ } = rect;
    if (w.kind === 'sea') { const big = 3500; if (minX <= world.bounds.minX) minX = -big; if (maxX >= world.bounds.maxX) maxX = big; if (minZ <= world.bounds.minZ) minZ = -big; if (maxZ >= world.bounds.maxZ) maxZ = big; }
    const wgeo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, 1, 1).rotateX(-Math.PI / 2);
    const mat = mats.water({ shallow: pal.water, deep: pal.waterDeep, foam: pal.foam });
    const m = new THREE.Mesh(wgeo, mat);
    m.name = 'water:' + w.kind;
    m.position.set((minX + maxX) / 2, w.level, (minZ + maxZ) / 2);
    m.castShadow = false; m.receiveShadow = false; m.userData.noShadow = true;
    m.renderOrder = 1;
    group.add(m);
    disposables.push(wgeo);
    waters.push({ mesh: m, w });
  }

  // scenery entries
  const chunkN = 3;
  const bd = world.bounds;
  const chunkOf = (x, z) => {
    const i = Math.max(0, Math.min(chunkN - 1, Math.floor(((x - bd.minX) / (bd.maxX - bd.minX)) * chunkN)));
    const j = Math.max(0, Math.min(chunkN - 1, Math.floor(((z - bd.minZ) / (bd.maxZ - bd.minZ)) * chunkN)));
    return i + j * chunkN;
  };
  const buckets = new Map(); // key -> { material, pos, nor, col, uv, blink, idx }
  const instanced = new Map(); // key -> { geometry, material, matrices: [] }
  const protos = new Map();
  const params0 = { palette: pal };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const counts = {};
  for (const e of world.scenery || []) counts[e.mesh] = (counts[e.mesh] || 0) + 1;

  for (const e of world.scenery || []) {
    const id = e.mesh;
    const y0 = Number.isFinite(e.y) ? e.y : H(e.x, e.z);
    const sc = Array.isArray(e.scale) ? e.scale : [e.scale ?? 1, e.scale ?? 1, e.scale ?? 1];
    const rot = e.rot || 0;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    let obj, objScale = sc;
    const perEntry = PARAM_IDS.has(id) || VARIED.has(id);
    if (perEntry) {
      const params = { ...params0, ...(e.params || {}) };
      const dims = (SCENERY[id] && SCENERY[id].dims) || [1, 1, 1];
      if (STRIP_IDS.has(id)) {
        params.w = sc[0]; params.d = sc[2];
        params.groundAt = (lx, lz) => H(e.x + lx * cosR + lz * sinR, e.z - lx * sinR + lz * cosR) - y0;
        objScale = [1, 1, 1];
      } else if (id === 'bunting' || id === 'ropebridge' || id === 'skiliftline') {
        params.len = dims[0] * sc[0];
        const L = params.len;
        params.h0 = H(e.x - (L / 2) * cosR, e.z + (L / 2) * sinR) - y0;
        params.h1 = H(e.x + (L / 2) * cosR, e.z - (L / 2) * sinR) - y0;
        objScale = [1, sc[1], sc[2]];
      }
      if (VARIED.has(id)) params.seed = hashStr(id + ':' + Math.round(e.x) + ',' + Math.round(e.z));
      obj = buildSceneryMesh(THREE, mats, id, params);
    } else {
      obj = protos.get(id);
      if (!obj) { obj = buildSceneryMesh(THREE, mats, id, params0); protos.set(id, obj); }
    }
    Q.setFromAxisAngle(Y, rot);
    V.set(e.x, y0, e.z);
    Sc.set(objScale[0], objScale[1], objScale[2]);
    M.compose(V, Q, Sc);
    const animated = !!obj.userData.update;
    if (animated) {
      // animated pieces stay live objects (each its own instance)
      const live = perEntry ? obj : buildSceneryMesh(THREE, mats, id, params0);
      live.position.copy(V); live.quaternion.copy(Q); live.scale.copy(Sc);
      group.add(live);
      anims.push(live.userData.update);
      continue;
    }
    const chunk = SCENERY[id] && SCENERY[id].dims[0] > 150 ? 'far' : chunkOf(e.x, e.z);
    for (const child of obj.children) {
      if (!child.isMesh) continue;
      const mat = child.material;
      const isSway = mat && mat.defines && mat.defines.GP_SWAY !== undefined && !mat.userData.wmBlink;
      if (isSway) {
        if (perEntry || counts[id] < 3) {
          const m = new THREE.Mesh(child.geometry, mat);
          m.applyMatrix4(M.clone());
          m.castShadow = true;
          group.add(m);
          if (perEntry) disposables.push(child.geometry);
        } else {
          const key = id + '|' + child.name;
          if (!instanced.has(key)) instanced.set(key, { geometry: child.geometry, material: mat, matrices: [] });
          instanced.get(key).matrices.push(M.clone());
        }
        continue;
      }
      const key = mat.uuid + '|' + chunk;
      if (!buckets.has(key)) buckets.set(key, { material: mat, pos: [], nor: [], col: [], uv: [], blink: [], idx: [], chunk });
      mergeInto(buckets.get(key), child.geometry, M, THREE);
    }
    if (perEntry) for (const child of obj.children) if (child.isMesh && !(child.material.defines && child.material.defines.GP_SWAY !== undefined && !child.material.userData.wmBlink)) child.geometry.dispose();
  }
  for (const [, bk] of buckets) {
    const g = bucketGeometry(THREE, bk);
    const m = new THREE.Mesh(g, bk.material);
    m.name = 'scenery:' + (bk.material.name || 'mat') + ':' + bk.chunk;
    const glowy = bk.material.userData && bk.material.userData.wmBlink;
    m.castShadow = !glowy && bk.chunk !== 'far';
    m.receiveShadow = true;
    if (bk.chunk === 'far') { m.castShadow = false; m.userData.noShadow = true; }
    group.add(m);
    disposables.push(g);
  }
  for (const [key, it] of instanced) {
    const im = new THREE.InstancedMesh(it.geometry, it.material, it.matrices.length);
    it.matrices.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere?.();
    im.name = 'inst:' + key;
    im.castShadow = true; im.receiveShadow = true;
    group.add(im);
  }
  for (const p of protos.values()) for (const c of p.children) if (c.isMesh) disposables.push(c.geometry);

  // per-world backdrop dressing
  const dressing = buildDressing(THREE, mats, world);
  if (dressing) { group.add(dressing); dressing.traverse((o) => { if (o.geometry) disposables.push(o.geometry); }); }

  let clock = 0;
  function update(dt, simState) {
    clock += dt || 0;
    const t = simState && Number.isFinite(simState.time) ? simState.time : clock;
    for (let i = 0; i < waters.length; i++) {
      const { mesh, w } = waters[i];
      const tide = w.tide ? w.tide.amp * Math.sin((TAU * t) / w.tide.period) : 0;
      mesh.position.y = w.level + tide;
    }
    for (let i = 0; i < anims.length; i++) anims[i](dt || 0, simState);
  }
  update(0, null);

  function dispose() {
    for (const g of disposables) g.dispose();
    group.traverse((o) => { if (o.isSkinnedMesh) o.geometry.dispose(); });
  }

  return { group, update, dispose };
}
