// The title scene: a little Copacabana beach at sunset. Gentle dunes down to
// the sea (water shader with shoreline foam), a strip of the black-and-white
// wave promenade, palms swaying, a parasol, a beach ball, the Sugarloaf on
// the horizon and a few gulls. The hero idles in the foreground on the left
// of the frame (the menu lives on the right) while the camera drifts.

import { noise2, fbm2 } from '../../core/math.js';

export const TITLE_PALETTE = {
  skyTop: '#6fa8e0', skyBottom: '#ffd2a8', horizon: '#ffc9a0', fog: '#ffc9a8', fogNear: 40, fogFar: 420,
  sun: '#ffe3b8', sunIntensity: 2.1, ambient: '#c9d6f2', ground: '#f0d4a4', accent: '#ff7a59',
  water: '#4fcac8', waterDeep: '#1f7fa8', foam: '#fffaf0', outline: '#3a2a22',
};
export const TITLE_TOD = 0.705;

export function titleHeight(x, z) {
  // sand slopes down to the sea at x ~ 9, dunes inland, a little ripple everywhere
  let h = 0.55 - x * 0.07;
  h += noise2(x * 0.12 + 3.1, z * 0.12) * 0.18 * smooth01((8 - x) / 8);
  h += fbm2(x * 0.5, z * 0.5, 2) * 0.03;
  if (x < -6) h += (-6 - x) * 0.06;
  if (x > 9) h -= (x - 9) * 0.12;
  return h;
}
const smooth01 = (t) => { const v = t < 0 ? 0 : t > 1 ? 1 : t; return v * v * (3 - 2 * v); };

function waveTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#2a2524';
  // the Copacabana wave: bands that undulate across the promenade
  for (let band = -1; band < 5; band++) {
    g.beginPath();
    const y0 = band * 64;
    g.moveTo(0, y0);
    for (let x = 0; x <= 256; x += 4) g.lineTo(x, y0 + Math.sin((x / 256) * Math.PI * 2) * 18);
    for (let x = 256; x >= 0; x -= 4) g.lineTo(x, y0 + 30 + Math.sin((x / 256) * Math.PI * 2) * 18);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function fallbackPalm(THREE, mats) {
  const g = new THREE.Group();
  const trunkMat = mats.sway('#a7794f', { strength: 0.7 });
  let y = 0, x = 0;
  for (let i = 0; i < 8; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.008, 0.2 - i * 0.008, 1.05, 7), trunkMat);
    x += i * 0.035;
    seg.position.set(x, y + 0.5, 0);
    seg.rotation.z = -0.05 - i * 0.012;
    g.add(seg);
    y += 1.0;
  }
  const frondMat = mats.sway('#5fb36a', { strength: 1.4 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.0, 4, 1), frondMat);
    f.scale.set(1, 1, 0.25);
    f.position.set(x + Math.cos(a) * 1.2, y + 0.1, Math.sin(a) * 1.2);
    f.rotation.set(Math.sin(a) * 1.15, -a, -Math.cos(a) * 1.15, 'YXZ');
    f.rotation.order = 'YXZ';
    f.rotation.y = -a + Math.PI / 2;
    f.rotation.z = 1.2;
    g.add(f);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mats.toon('#6b4a2a'));
  nut.position.set(x + 0.1, y - 0.2, 0.1);
  g.add(nut);
  return g;
}

function fallbackLoaf(THREE, mats) {
  const g = new THREE.Group();
  const m = mats.toon('#6f8f7a');
  const a = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m);
  a.scale.set(60, 160, 70);
  g.add(a);
  const b = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), m);
  b.scale.set(90, 70, 80);
  b.position.set(-110, 0, 30);
  g.add(b);
  return g;
}

export function createTitleStage(THREE, { mats, buildSceneryMesh, buildItemMesh, catalogue }) {
  const group = new THREE.Group();
  group.name = 'stage:title';
  const disposables = [];
  const own = (x) => { disposables.push(x); return x; };

  // terrain with vertex colours: dry sand, wet sand near the water
  const W = 90, D = 70, SX = 110, SZ = 80;
  const tg = own(new THREE.PlaneGeometry(W, D, SX, SZ).rotateX(-Math.PI / 2));
  tg.translate(-5, 0, 0);
  const pos = tg.getAttribute('position');
  const cols = new Float32Array(pos.count * 3);
  const dry = new THREE.Color('#f2d7a6'), wet = new THREE.Color('#c9a77a'), dune = new THREE.Color('#ecc994'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = titleHeight(x, z);
    pos.setY(i, h);
    c.copy(dry).lerp(dune, smooth01((noise2(x * 0.2, z * 0.2) + 0.3) * 0.8));
    c.lerp(wet, smooth01((0.35 - h) / 0.3));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, mats.toon('#ffffff', { vertexColors: true, rim: false }));
  terrain.receiveShadow = true;
  terrain.name = 'title-terrain';
  group.add(terrain);

  // the sea
  const wg = own(new THREE.PlaneGeometry(700, 700, 48, 48).rotateX(-Math.PI / 2));
  const sea = new THREE.Mesh(wg, mats.water({ shallow: '#62d4cc', deep: '#2a7fb0', foam: '#fffaf0' }));
  sea.position.set(330, 0, 0);
  sea.name = 'title-sea';
  sea.renderOrder = 2;
  group.add(sea);

  // the wave promenade
  let waveTex = null;
  if (typeof document !== 'undefined') {
    waveTex = own(waveTexture(THREE));
    waveTex.repeat.set(1.5, 18);
    const pg = own(new THREE.PlaneGeometry(6, 70, 6, 70).rotateX(-Math.PI / 2));
    const pp = pg.getAttribute('position');
    for (let i = 0; i < pp.count; i++) pp.setY(i, titleHeight(pp.getX(i) - 15, pp.getZ(i)) + 0.03);
    pg.computeVertexNormals();
    const prom = new THREE.Mesh(pg, mats.toon('#ffffff', { map: waveTex, rim: false }));
    prom.position.set(-15, 0, 0);
    prom.receiveShadow = true;
    group.add(prom);
  }

  // scenery: palms, the Sugarloaf, a parasol, towel and beach ball
  const tryScenery = (id, fb) => {
    try { const o = buildSceneryMesh ? buildSceneryMesh(THREE, mats, id, {}) : null; if (o) return o; } catch (e) { console.warn('[render] title scenery', id, e); }
    return fb ? fb() : null;
  };
  const tryItem = (id) => {
    try {
      const o = buildItemMesh ? buildItemMesh(THREE, mats, id) : null;
      if (o) { const s = catalogue?.[id]?.size || 1; o.scale.multiplyScalar(s); return o; }
    } catch (e) { console.warn('[render] title item', id, e); }
    return null;
  };
  const palms = [[-4, -7, 0.3], [-9, 6, 2.1], [1.5, 11, 4.0], [-13, -14, 1.2]];
  for (const [x, z, r] of palms) {
    const p = tryScenery('palm', () => fallbackPalm(THREE, mats));
    p.position.set(x, titleHeight(x, z) - 0.05, z);
    p.rotation.y = r;
    p.scale.multiplyScalar(0.9 + ((x * 13 + z * 7) % 3) * 0.08);
    group.add(p);
  }
  const loaf = tryScenery('sugarloaf', () => fallbackLoaf(THREE, mats));
  loaf.position.set(520, -6, 210);
  loaf.rotation.y = -0.6;
  group.add(loaf);
  const loaf2 = tryScenery('sugarloaf', () => fallbackLoaf(THREE, mats));
  loaf2.position.set(640, -10, -260);
  loaf2.scale.multiplyScalar(0.7);
  group.add(loaf2);
  const parasol = tryItem('parasol');
  if (parasol) { parasol.position.set(1.4, titleHeight(1.4, -2.6), -2.6); parasol.rotation.y = 0.4; group.add(parasol); }
  const towel = tryItem('towel');
  if (towel) { towel.position.set(1.8, titleHeight(1.8, -1.6) + 0.01, -1.6); towel.rotation.y = 0.5; group.add(towel); }
  const ball = tryItem('beachball');
  if (ball) { ball.position.set(5.2, titleHeight(5.2, 1.9), 1.9); group.add(ball); }
  const coco = tryItem('coconut');
  if (coco) { coco.position.set(2.6, titleHeight(2.6, 0.9), 0.9); group.add(coco); }

  group.traverse((o) => { if (o.isMesh && o !== terrain && o !== sea) { o.castShadow = true; o.receiveShadow = true; } });

  const hero = { x: 3.6, z: 0.2, yaw: -2.15 };
  hero.y = titleHeight(hero.x, hero.z);

  // gulls circling over the shore (fake boids state)
  const birds = { count: 4, x: new Float32Array(4), y: new Float32Array(4), z: new Float32Array(4), vx: new Float32Array(4), vy: new Float32Array(4), vz: new Float32Array(4), kind: new Uint8Array(4).fill(1) };

  function update(dt, time) {
    for (let i = 0; i < birds.count; i++) {
      const r = 10 + i * 4, sp = 0.12 + i * 0.02, a = time * sp + i * 1.7;
      birds.x[i] = 20 + Math.cos(a) * r; birds.z[i] = Math.sin(a) * r * 0.7 + i * 3; birds.y[i] = 9 + i * 1.5 + Math.sin(time * 0.4 + i) * 0.8;
      birds.vx[i] = -Math.sin(a) * r * sp; birds.vz[i] = Math.cos(a) * r * 0.7 * sp; birds.vy[i] = Math.cos(time * 0.4 + i) * 0.3;
    }
    sea.position.y = Math.sin(time * 0.35) * 0.06;
  }

  // the drifting camera: writes into pos/look. aspect for framing the hero on the left.
  function camera(time, aspect, fovDeg, pos, look, heroSize = 1) {
    const s = heroSize;
    const yaw = Math.PI / 2 + 0.42 + Math.sin(time * 0.045) * 0.16;
    const d = 3.5 * s + Math.sin(time * 0.07) * 0.25 * s;
    const h = 0.95 * s + Math.sin(time * 0.06 + 1) * 0.12 * s;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const tx = hero.x, ty = hero.y + 0.5 * s, tz = hero.z;
    pos.set(tx - fx * d, ty + h, tz - fz * d);
    // shift the look target right so the hero sits on the left of the frame
    const halfW = d * Math.tan((fovDeg * Math.PI) / 360) * Math.max(1, aspect);
    const off = aspect > 1.25 ? halfW * 0.34 : halfW * 0.08;
    look.set(tx - Math.cos(yaw) * off, ty + 0.12 * s, tz + Math.sin(yaw) * off);
  }

  return {
    group, hero, birds, update, camera,
    heightAt: titleHeight,
    bounds: { minX: -50, maxX: 40, minZ: -35, maxZ: 35 },
    palette: TITLE_PALETTE, tod: TITLE_TOD,
    dispose() {
      for (const d of disposables) d.dispose?.();
      group.traverse((o) => { if (o.geometry && !disposables.includes(o.geometry)) o.geometry.dispose(); });
    },
  };
}
