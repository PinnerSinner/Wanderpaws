// Ground cover: instanced grass tufts and little flowers scattered over grass
// and leaf-litter surfaces, so the foreground reads as a living place even when
// you're tiny. Two draw calls per world, a few triangles each, swaying in the wind.
import { rngFrom, hashStr } from './util.js';

const COVER = {
  // surface -> [tuft colours], flower chance, flower colours
  grass: { tufts: ['#6fae4a', '#7fbe55', '#5e9c3e', '#8cc861'], flower: 0.12, flowers: ['#fff6e8', '#ffd84a', '#ff9ec4', '#b9a4ff'] },
  leaves: { tufts: ['#4f8f36', '#6a9c3a', '#3f7d2e', '#7a9a44'], flower: 0.08, flowers: ['#ff7a59', '#ffd84a', '#ff6fa8'] },
};

function tuftGeometry(THREE) {
  // three blades fanned round the stem, darker at the root, sunlit at the tip
  const pos = [], col = [];
  const blades = [[0, 0.11, 1.0, 0.18], [2.1, 0.1, 0.8, -0.22], [4.2, 0.1, 0.9, 0.12]];
  for (const [a, w, h, lean] of blades) {
    const cx = Math.cos(a), sz = Math.sin(a);
    const tx = Math.cos(a + Math.PI / 2) * lean, tz = Math.sin(a + Math.PI / 2) * lean;
    pos.push(-cx * w, 0, -sz * w, cx * w, 0, sz * w, tx, h, tz);
    col.push(0.55, 0.62, 0.5, 0.55, 0.62, 0.5, 1.12, 1.1, 0.95);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // blades are lit from above regardless of facing, so both sides read the same
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

function flowerGeometry(THREE) {
  // a thin stem with a crossed four-petal head
  const pos = [], col = [];
  const stem = [0.02, 0, 0, -0.02, 0, 0, 0, 0.8, 0];
  pos.push(...stem); col.push(0.4, 0.62, 0.3, 0.4, 0.62, 0.3, 0.45, 0.7, 0.35);
  const r = 0.22, y = 0.82;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2, b = a + Math.PI / 2;
    pos.push(0, y + 0.02, 0, Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(b) * r, y, Math.sin(b) * r);
    col.push(1.25, 1.2, 0.9, 1, 1, 1, 1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

export function buildGroundCover(THREE, mats, world, { maxCount = 7000 } = {}) {
  const b = world.bounds;
  const start = world.goals?.start || 0.5;
  const rng = rngFrom(hashStr('cover:' + world.id));
  const surf = (x, z) => { try { return world.surfaceAt(x, z); } catch { return null; } };
  const H = (x, z) => { try { const y = world.heightAt(x, z); return Number.isFinite(y) ? y : 0; } catch { return 0; } };
  const sp = world.spawn || { x: 0, z: 0 };
  const nearR = Math.max(12, start * 45);
  const tufts = [], flowers = [];
  const tries = maxCount * 5;
  for (let t = 0; t < tries && tufts.length + flowers.length < maxCount; t++) {
    let x, z;
    if (rng() < 0.45) { // keep the foreground lush where you start
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * nearR;
      x = sp.x + Math.cos(a) * r; z = sp.z + Math.sin(a) * r;
    } else {
      x = b.minX + rng() * (b.maxX - b.minX); z = b.minZ + rng() * (b.maxZ - b.minZ);
    }
    const s = surf(x, z);
    const c = COVER[s];
    if (!c) continue;
    const h = start * (0.25 + rng() * 0.45);
    const isFlower = rng() < c.flower;
    const list = isFlower ? flowers : tufts;
    const pal = isFlower ? c.flowers : c.tufts;
    list.push({ x, y: H(x, z) - h * 0.04, z, h, rot: rng() * Math.PI * 2, col: pal[Math.floor(rng() * pal.length)] });
  }
  const group = new THREE.Group();
  group.name = 'groundcover';
  const disposables = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), colr = new THREE.Color();
  const make = (list, geo, strength) => {
    if (!list.length) return;
    const mat = mats.sway('#ffffff', { vertexColors: true, strength, frequency: 1.3, rim: false });
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      e.set(0, it.rot, 0); q.setFromEuler(e);
      v.set(it.x, it.y, it.z); sc.set(it.h, it.h, it.h);
      m4.compose(v, q, sc); im.setMatrixAt(i, m4);
      im.setColorAt(i, colr.set(it.col));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = false; im.receiveShadow = true; im.userData.noShadow = true;
    im.frustumCulled = false;
    group.add(im);
    disposables.push(geo);
  };
  make(tufts, tuftGeometry(THREE), 5);
  make(flowers, flowerGeometry(THREE), 4);
  return { group, count: tufts.length + flowers.length, dispose() { for (const d of disposables) d.dispose(); } };
}
