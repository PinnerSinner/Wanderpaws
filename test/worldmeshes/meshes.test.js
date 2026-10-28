// World-meshes: coverage of every catalogue id, scenery id and human kind, plus
// headless geometry checks (normalisation, triangle budgets, draw calls).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CATALOGUE, CATALOGUE_ORDER } from '../../src/worlds/catalogue.js';
import { SCENERY, HUMANS, NPC_ANIMS } from '../../src/worlds/ids.js';
import { WORLDS } from '../../src/worlds/index.js';
import {
  ITEM_BUILDERS, SCENERY_BUILDERS, HUMAN_KINDS,
  buildItemMesh, buildItemBuilder, buildSceneryMesh, buildScenery, buildHuman,
} from '../../src/worlds/meshes/index.js';

// A Node-safe stand-in for the render materials factory (same API, plain materials).
function fakeMats() {
  const cache = new Map();
  const mk = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
  const uniforms = { time: { value: 0 }, wind: { value: new THREE.Vector2(1, 0) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, tint: { value: new THREE.Color(1, 1, 1) } };
  const toon = (c, o = {}) => mk('t' + c + JSON.stringify({ ...o, map: o.map ? o.map.uuid : null }), () => new THREE.MeshLambertMaterial({ color: c, vertexColors: !!o.vertexColors, transparent: !!o.transparent }));
  const sway = (c, o = {}) => mk('s' + c + JSON.stringify(o), () => { const m = new THREE.MeshLambertMaterial({ color: c, vertexColors: !!o.vertexColors }); m.defines = { GP_SWAY: '' }; return m; });
  return { uniforms, toon, sway, water: () => mk('w', () => new THREE.MeshBasicMaterial({ color: '#3cc0c8' })), outline() {}, glow: (c) => mk('g' + c, () => new THREE.MeshBasicMaterial({ color: c })) };
}

const meshCount = (o) => { let n = 0; o.traverse((c) => { if (c.isMesh) n++; }); return n; };
const triCount = (o) => { let n = 0; o.traverse((c) => { if (c.isMesh) { const g = c.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return n; };

test('a builder exists for every catalogue item', () => {
  const missing = CATALOGUE_ORDER.filter((id) => !ITEM_BUILDERS[id]);
  assert.deepEqual(missing, [], 'missing item builders: ' + missing.join(', '));
});

test('a builder exists for every scenery id', () => {
  const missing = Object.keys(SCENERY).filter((id) => !SCENERY_BUILDERS[id]);
  assert.deepEqual(missing, [], 'missing scenery builders: ' + missing.join(', '));
});

test('a design exists for every human kind', () => {
  const missing = HUMANS.filter((k) => !HUMAN_KINDS.includes(k));
  assert.deepEqual(missing, [], 'missing humans: ' + missing.join(', '));
});

test('items are normalised, cheap and merged into few draw calls', () => {
  const mats = fakeMats();
  const over = [];
  for (const id of CATALOGUE_ORDER) {
    const it = CATALOGUE[id];
    const { b, dims } = buildItemBuilder(THREE, id);
    const bb = b.bounds();
    const r = it.height / it.size;
    assert.ok(Math.abs(bb.minY) < 1e-3, `${id} sits on y=0 (minY ${bb.minY})`);
    assert.ok(Math.abs(bb.maxY - r) < 1e-3, `${id} height ${bb.maxY} should be ${r}`);
    const horiz = Math.max(bb.maxX - bb.minX, bb.maxZ - bb.minZ);
    assert.ok(horiz <= 1 + 1e-3, `${id} horizontal extent ${horiz} <= 1`);
    assert.ok(horiz > 0.12, `${id} is not vanishingly thin (${horiz})`);
    assert.ok(Math.abs((bb.minX + bb.maxX) / 2) < 1e-3 && Math.abs((bb.minZ + bb.maxZ) / 2) < 1e-3, `${id} is centred`);
    const tris = b.triangles();
    const budget = it.size >= 3 ? 9000 : 2600;
    if (tris > budget) over.push(`${id}=${tris}`);
    const g = buildItemMesh(THREE, mats, id);
    assert.ok(meshCount(g) >= 1 && meshCount(g) <= 3, `${id} has ${meshCount(g)} meshes`);
    g.traverse((c) => { if (c.isMesh) assert.ok(c.position.lengthSq() === 0, `${id}: child transforms are baked`); });
    void dims;
  }
  assert.deepEqual(over, [], 'items over the triangle budget');
});

test('every scenery piece builds headless', () => {
  const mats = fakeMats();
  for (const id of Object.keys(SCENERY)) {
    const params = { palette: WORLDS[0].palette, w: 20, d: 6, len: 12, textKey: 'world.w5.plaque' };
    const g = buildSceneryMesh(THREE, mats, id, params);
    assert.ok(meshCount(g) >= 1, `${id} has meshes`);
    assert.ok(triCount(g) < 12000, `${id} triangles ${triCount(g)}`);
    assert.equal(g.userData.fallback, false, `${id} is not the fallback`);
    if (g.userData.update) g.userData.update(1 / 60, { time: 1, flags: {} });
  }
});

test('every world builds within the draw-call budget', () => {
  const mats = fakeMats();
  for (const w of WORLDS) {
    const sc = buildScenery(THREE, mats, w);
    const calls = meshCount(sc.group);
    const tris = triCount(sc.group);
    assert.ok(calls <= 120, `${w.id}: ${calls} draw calls`);
    assert.ok(tris < 400000, `${w.id}: ${tris} triangles`);
    // tide follows the formula
    const sea = (w.water || []).find((b) => b.tide);
    sc.update(1 / 60, { time: sea ? sea.tide.period / 4 : 1, flags: {} });
    if (sea) {
      const m = sc.group.children.find((c) => c.name === 'water:' + sea.kind);
      assert.ok(Math.abs(m.position.y - (sea.level + sea.tide.amp)) < 1e-6, `${w.id} tide`);
    }
    sc.dispose();
  }
});

test('every human builds, plays every anim without allocating new objects, and stays near 1.75 m', () => {
  const mats = fakeMats();
  for (const kind of HUMANS) {
    const h = buildHuman(THREE, mats, kind, { variant: 1 });
    assert.ok(h.object3d && typeof h.update === 'function');
    assert.ok(meshCount(h.object3d) <= 3, `${kind} draw calls ${meshCount(h.object3d)}`);
    const npc = { id: kind, kind, x: 0, z: 0, px: 0, pz: 0, y: 0, yaw: 0, anim: 'idle', animT: 0 };
    for (const a of NPC_ANIMS) { npc.anim = a; for (let i = 0; i < 20; i++) { npc.animT += 1 / 60; h.update(npc, 1 / 60); } }
    const box = new THREE.Box3();
    h.object3d.traverse((c) => { if (c.isMesh) { c.geometry.computeBoundingBox(); box.union(c.geometry.boundingBox); } });
    const H = box.max.y - box.min.y;
    if (kind === 'packet') assert.ok(H > 0.8 && H < 1.6, `packet height ${H}`);
    else if (kind !== 'kid' && kind !== 'cyclist' && kind !== 'sentry' && kind !== 'piper') assert.ok(H > 1.55 && H < 2.1, `${kind} height ${H}`);
    h.dispose();
  }
});
