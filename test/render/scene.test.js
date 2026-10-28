// Node tests for render pieces that use three's maths and geometry but no
// WebGL: geometry baking, the item instancer's sync, the materials cache.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { createMaterials } from '../../src/render/materials.js';
import { bakeObject, safeMaterial } from '../../src/render/bake.js';
import { createItemLayer } from '../../src/render/items.js';
import { createParticles, PK } from '../../src/render/particles.js';
import { createRingPool } from '../../src/render/pure/pool.js';

const fakeSettings = (o = {}) => { const d = { colourBlind: 'none', ...o }; return { get: (k) => d[k], subscribe: () => () => {} }; };

test('materials: toon and sway are cached per parameters', () => {
  const mats = createMaterials(THREE, fakeSettings());
  assert.equal(mats.toon('#ff0000'), mats.toon('#ff0000'));
  assert.notEqual(mats.toon('#ff0000'), mats.toon('#00ff00'));
  assert.notEqual(mats.toon('#ff0000'), mats.toon('#ff0000', { vertexColors: true }));
  assert.equal(mats.sway('#00ff00', { strength: 2 }), mats.sway('#00ff00', { strength: 2 }));
  assert.ok(mats.sway('#00ff00').defines.GP_SWAY !== undefined);
  assert.equal(mats.water({ shallow: '#00ffff' }), mats.water({ shallow: '#00ffff' }));
  assert.ok(mats.uniforms.time && mats.uniforms.wind && mats.uniforms.sunDir && mats.uniforms.tint);
});

test('materials: the toon patch rewrites the shader and shares uniforms', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const m = mats.itemFx(mats.toon('#ffffff', { vertexColors: true }));
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.toon.vertexShader,
    fragmentShader: THREE.ShaderLib.toon.fragmentShader,
  };
  m.onBeforeCompile(shader);
  assert.equal(shader.uniforms.gpTime, mats.uniforms.time);
  assert.match(shader.fragmentShader, /getGradientIrradiance/);
  assert.match(shader.fragmentShader, /gpAlmostColor/);
  assert.match(shader.vertexShader, /attribute vec3 aFx/);
  assert.ok(!shader.fragmentShader.includes('#include <gradientmap_pars_fragment>'));
});

test('materials: colour-blind setting changes the shimmer colour', () => {
  const a = createMaterials(THREE, fakeSettings());
  const b = createMaterials(THREE, fakeSettings({ colourBlind: 'tritanopia' }));
  assert.notEqual(a.uniforms.almostColor.value.getHex(), b.uniforms.almostColor.value.getHex());
});

test('materials: outline adds an inverted-hull child', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), mats.toon('#fff'));
  const o = mats.outline(mesh, 0.03);
  assert.equal(o.parent, mesh);
  assert.equal(o.material.side, THREE.BackSide);
  assert.equal(o.userData.gpOutline, true);
});

test('bake: plain materials fold into one vertex-coloured group', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const g = new THREE.Group();
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.toon('#ff0000'));
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mats.toon('#0000ff'));
  b.position.set(2, 0, 0);
  g.add(a, b);
  const baked = bakeObject(THREE, g, mats);
  assert.equal(baked.materials.length, 1);
  assert.equal(baked.geometry.groups.length, 1);
  const bb = baked.geometry.boundingBox;
  assert.ok(bb.max.x > 2.4, 'transforms applied');
  const col = baked.geometry.getAttribute('color');
  let red = 0, blue = 0;
  for (let i = 0; i < col.count; i++) { if (col.getX(i) > 0.9) red++; if (col.getZ(i) > 0.9) blue++; }
  assert.ok(red > 0 && blue > 0, 'colours baked');
});

test('bake: textured or transparent materials keep their own group', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), mats.toon('#ff0000')));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), mats.toon('#00ff00', { transparent: true, opacity: 0.5 })));
  const baked = bakeObject(THREE, g, mats);
  assert.equal(baked.materials.length, 2);
});

test('bake: MeshBasicMaterial with a stray emissive gets a safe clone', () => {
  const m = new THREE.MeshBasicMaterial();
  m.emissive = new THREE.Color(1, 1, 1);
  const s = safeMaterial(m);
  assert.notEqual(s, m);
  assert.equal('emissive' in s, false);
  assert.equal(safeMaterial(s), s);
});

function fakeItems(types, n) {
  const f = () => new Float32Array(n);
  const it = {
    count: n, types, typeIndex: new Uint16Array(n), x: f(), y: f(), z: f(), px: f(), py: f(), pz: f(),
    rotY: f(), tilt: f(), tiltAxis: f(), scale: new Float32Array(n).fill(1), state: new Uint8Array(n), anim: f(),
    golden: new Uint8Array(n), size: new Float32Array(n).fill(0.3), gobbleable: new Uint8Array(n), almost: new Uint8Array(n),
  };
  for (let i = 0; i < n; i++) { it.typeIndex[i] = i % types.length; it.x[i] = it.px[i] = i; it.z[i] = it.pz[i] = 2; }
  return it;
}

const builder = (THREE, mats, id) => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.toon(id === 'a' ? '#ff0000' : '#00ff00')));
  return g;
};
const player = { x: 0, y: 0, z: 0, yaw: 0, size: 1 };

test('items: one instanced mesh per type, counts follow state', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const layer = createItemLayer(THREE, { mats, buildItemMesh: builder, catalogue: {}, settings: fakeSettings() });
  const it = fakeItems(['a', 'b'], 10);
  layer.setup(it);
  it.state[0] = 4; it.state[1] = 5; // gone, hidden
  layer.sync(it, 1, 1 / 60, player, 0, {});
  const meshes = layer.group.children.filter((c) => c.name.startsWith('item:'));
  assert.equal(meshes.length, 2);
  const total = meshes.reduce((s, m) => s + m.count, 0);
  assert.equal(total, 8);
  assert.equal(layer.layerCount, 2);
});

test('items: interpolates between previous and current positions', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const layer = createItemLayer(THREE, { mats, buildItemMesh: builder, catalogue: {}, settings: fakeSettings() });
  const it = fakeItems(['a'], 1);
  it.px[0] = 0; it.x[0] = 2;
  layer.setup(it);
  layer.sync(it, 0.5, 1 / 60, player, 0, {});
  const m = layer.group.children.find((c) => c.name === 'item:a');
  const mat = new THREE.Matrix4().fromArray(m.instanceMatrix.array, 0);
  const p = new THREE.Vector3().setFromMatrixPosition(mat);
  assert.ok(Math.abs(p.x - 1) < 1e-5);
});

test('items: a gobbled item flies into the mouth and shrinks away, then disappears', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const layer = createItemLayer(THREE, { mats, buildItemMesh: builder, catalogue: {}, settings: fakeSettings() });
  const it = fakeItems(['a'], 1);
  it.x[0] = it.px[0] = 3; it.z[0] = it.pz[0] = 0;
  layer.setup(it);
  it.state[0] = 3;
  const m = layer.group.children.find((c) => c.name === 'item:a');
  const mat = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  layer.sync(it, 1, 0.05, { x: 0, y: 0, z: 0, yaw: Math.PI / 2, size: 1 }, 0, {});
  mat.fromArray(m.instanceMatrix.array, 0).decompose(p, q, s);
  const d0 = p.length();
  it.state[0] = 4; // the sim says gone; render finishes the flight
  for (let k = 0; k < 4; k++) layer.sync(it, 1, 0.05, { x: 0, y: 0, z: 0, yaw: Math.PI / 2, size: 1 }, 0, {});
  assert.equal(m.count, 1, 'still flying');
  mat.fromArray(m.instanceMatrix.array, 0).decompose(p, q, s);
  assert.ok(p.distanceTo(new THREE.Vector3(0.5, 0.42, 0)) < d0, 'moving towards the mouth');
  for (let k = 0; k < 10; k++) layer.sync(it, 1, 0.05, { x: 0, y: 0, z: 0, yaw: Math.PI / 2, size: 1 }, 0, {});
  assert.equal(m.count, 0, 'gone after the flight');
});

test('items: almost and golden flags reach the FX attribute', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const layer = createItemLayer(THREE, { mats, buildItemMesh: builder, catalogue: {}, settings: fakeSettings() });
  const it = fakeItems(['a'], 2);
  it.almost[0] = 1; it.golden[1] = 1;
  layer.setup(it);
  layer.sync(it, 1, 1 / 60, player, 0, {});
  const m = layer.group.children.find((c) => c.name === 'item:a');
  const fx = m.geometry.getAttribute('aFx');
  assert.equal(fx.getX(0), 1); assert.equal(fx.getY(0), 0);
  assert.equal(fx.getX(1), 0); assert.equal(fx.getY(1), 1);
});

test('items: tiny far items are culled and mid-distance ones use the shared far LOD', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const layer = createItemLayer(THREE, { mats, buildItemMesh: builder, catalogue: {}, settings: fakeSettings() });
  const it = fakeItems(['a'], 3);
  it.size[0] = 0.3; it.x[0] = it.px[0] = 1;        // near: full mesh
  it.size[1] = 0.3; it.x[1] = it.px[1] = 30;       // ~8 px: far LOD
  it.size[2] = 0.01; it.x[2] = it.px[2] = 200;     // sub-pixel: culled
  layer.setup(it);
  layer.sync(it, 1, 1 / 60, player, 0, { camX: 0, camY: 0, camZ: 0, pxPerRad: 800, cullPx: 1.5, lodPx: 12 });
  const m = layer.group.children.find((c) => c.name === 'item:a');
  const far = layer.group.children.find((c) => c.name === 'gp-item-far');
  assert.equal(m.count, 1);
  assert.equal(far.count, 1);
  assert.equal(layer.culled, 1);
});

test('items: capacity grows when the sim spawns more of a type', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const layer = createItemLayer(THREE, { mats, buildItemMesh: builder, catalogue: {}, settings: fakeSettings() });
  const small = fakeItems(['a'], 2);
  layer.setup(small);
  const big = fakeItems(['a'], 40);
  layer.sync(big, 1, 1 / 60, player, 0, { lodPx: 1 });
  const m = layer.group.children.find((c) => c.name === 'item:a');
  assert.equal(m.count, 40);
});

test('particles: spawns write the interleaved buffer and respect the tier cap', () => {
  const p = createParticles(THREE, { capacity: 2500, cap: 300 });
  for (let i = 0; i < 400; i++) p.spawn(PK.DOT, i, 0, 0, 0, 1, 0, 1, 0.1, 0.2, 1, 1, 1, 1);
  p.update(0.5);
  assert.ok(p.alive() <= 300);
  assert.equal(p.mesh.geometry.instanceCount, 300);
  p.setCap(1000);
  assert.equal(p.mesh.geometry.instanceCount, 1000);
  p.update(5);
  assert.equal(p.alive(), 0);
});

test('pool: per-tier caps hold 300 / 1000 / 2500 under a burst storm', () => {
  for (const cap of [300, 1000, 2500]) {
    const pool = createRingPool(2500, cap);
    for (let i = 0; i < 10000; i++) pool.alloc(i * 0.0001, 5);
    assert.equal(pool.alive(1), cap);
  }
});

test('bake: wmBlink materials keep their own group and the blink attribute', () => {
  const mats = createMaterials(THREE, fakeSettings());
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), mats.toon('#ff0000')));
  const led = new THREE.MeshBasicMaterial({ vertexColors: true });
  led.userData.wmBlink = true;
  const lg = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const n = lg.getAttribute('position').count;
  lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  lg.setAttribute('blink', new THREE.BufferAttribute(new Float32Array(n * 2).fill(2), 2));
  g.add(new THREE.Mesh(lg, led));
  const baked = bakeObject(THREE, g, mats);
  assert.equal(baked.materials.length, 2);
  const bl = baked.geometry.getAttribute('blink');
  assert.ok(bl, 'blink copied');
  let twos = 0;
  for (let i = 0; i < bl.count; i++) if (bl.getX(i) === 2) twos++;
  assert.equal(twos, n);
});

test('npcs: invisible npcs are skipped, human flag picks the builder', async () => {
  const { createNpcLayer } = await import('../../src/render/actors.js');
  const mats = createMaterials(THREE, fakeSettings());
  let humans = 0, critters = 0;
  const layer = createNpcLayer(THREE, {
    mats,
    buildHuman: () => { humans++; const o = new THREE.Group(); o.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.3))); return { object3d: o, update() {} }; },
    createCritterView: () => { critters++; const o = new THREE.Group(); o.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3))); return { object3d: o, update() {} }; },
    humanKinds: ['jogger'], critterKinds: ['pigeon'],
  });
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 2, -5);
  const npcs = [
    { id: 'a', kind: 'jogger', x: 0, y: 0, z: 0, yaw: 0 },
    { id: 'b', kind: 'pigeon', x: 1, y: 0, z: 0, yaw: 0, visible: false },
    { id: 'c', kind: 'cyclist', human: true, x: 2, y: 0, z: 0, yaw: 0 },
  ];
  layer.sync(npcs, 1, 1 / 60, cam, 800, 2);
  assert.equal(humans, 2);
  assert.equal(critters, 0);
  assert.equal(layer.count, 2);
  const out = {};
  assert.equal(layer.find('a', out), true);
  assert.ok(out.y > 1.8);
});
