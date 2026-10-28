import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAnimalView, createCritterView } from '../../src/animals/view/index.js';
import { SPECIES, SPECIES_ORDER } from '../../src/animals/species.js';
import { COSMETICS } from '../../src/animals/cosmetics.js';
import { CRITTERS, NPC_ANIMS } from '../../src/worlds/ids.js';

// Minimal stand-in for the render materials factory (no WebGL needed).
const mats = {
  toon: (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, vertexColors: !!o.vertexColors }),
  outline(mesh) { const o = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, new THREE.MeshBasicMaterial()) : new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial()); if (mesh.isSkinnedMesh) o.bind(mesh.skeleton, mesh.bindMatrix); mesh.add(o); return o; },
  glow: (c) => new THREE.MeshBasicMaterial({ color: c }),
  uniforms: { time: { value: 0 } },
};
const fakePlayer = (o = {}) => ({ vx: 0, vz: 3, vy: 0, yaw: 0, speedNorm: 0.4, displaySize: 1, grounded: true, emotion: 'happy', sig: { active: false, t: 0, power: 0 }, ...o });
const bodyTris = (v) => { const m = v.object3d.getObjectByName('animal-body'); return m.geometry.index.count / 3; };

test('every species builds within the draw-call and triangle budget', () => {
  for (const id of SPECIES_ORDER) {
    const v = createAnimalView({ THREE, mats, species: SPECIES[id], look: SPECIES[id].defaults, quality: 'high' });
    const st = v.stats();
    assert.ok(st.drawCalls <= 4, `${id} draws ${st.drawCalls}`);
    assert.ok(bodyTris(v) <= 7500, `${id} tris ${bodyTris(v)}`);
    const lo = createAnimalView({ THREE, mats, species: SPECIES[id], quality: 'low' });
    assert.ok(bodyTris(lo) < bodyTris(v) * 0.75, `${id} low LOD is lighter`);
    v.dispose(); lo.dispose();
  }
});

test('view origin is at the feet, facing +Z, about unit size', () => {
  const v = createAnimalView({ THREE, mats, species: SPECIES.oli });
  const box = new THREE.Box3().setFromObject(v.object3d.getObjectByName('animal-body'));
  assert.ok(box.min.y > -0.05 && box.min.y < 0.05, `feet ${box.min.y}`);
  assert.ok(box.max.z > 0.4 && box.min.z < -0.3, 'nose forward, tail back');
  assert.ok(box.max.y < 1.2);
});

test('update applies the pose to bones without NaN for every species and scenario', () => {
  for (const id of SPECIES_ORDER) {
    const v = createAnimalView({ THREE, mats, species: SPECIES[id] });
    for (const sc of [{}, { speedNorm: 1, vz: 7, sprinting: true }, { airborne: true, grounded: false, vy: 4 }, { idleAnim: 'shake', speedNorm: 0, vz: 0 }, { sig: { active: true, t: 0.3, power: 0 } }, { inWater: true, waterDepth: 2 }]) {
      for (let i = 0; i < 30; i++) v.update(fakePlayer(sc), 1 / 60);
    }
    v.object3d.traverse((o) => { if (o.isBone) for (const k of ['x', 'y', 'z']) { assert.ok(Number.isFinite(o.position[k]), `${id} ${o.name}`); assert.ok(Number.isFinite(o.rotation[k])); } });
    v.dispose();
  }
});

test('setLook repaints colours live and markings change the paint', () => {
  const v = createAnimalView({ THREE, mats, species: SPECIES.oli });
  const col = v.object3d.getObjectByName('animal-body').geometry.getAttribute('color');
  const before = Float32Array.from(col.array);
  v.setLook({ base: '#222222' });
  let diff = 0; for (let i = 0; i < before.length; i++) diff += Math.abs(before[i] - col.array[i]);
  assert.ok(diff > 10);
  const plain = Float32Array.from(col.array);
  v.setLook({ base: '#222222', pattern: 'spots', patternColor: '#ffffff', patternAmount: 0.8 });
  diff = 0; for (let i = 0; i < plain.length; i++) diff += Math.abs(plain[i] - col.array[i]);
  assert.ok(diff > 5, 'spots painted');
  assert.equal(v.look.pattern, 'spots');
});

test('every pattern paints on every archetype', () => {
  for (const id of ['oli', 'rabbit', 'duck', 'tortoise', 'snake', 'octopus']) {
    const v = createAnimalView({ THREE, mats, species: SPECIES[id] });
    for (const p of ['patches', 'stripes', 'spots', 'socks', 'blaze', 'saddle', 'mask', 'bands']) v.setLook({ pattern: p, patternColor: '#ff00ff', patternAmount: 0.7 });
    v.dispose();
  }
});

test('every wearable cosmetic builds on every archetype and stays under 8 draw calls', () => {
  const wear = COSMETICS.filter((c) => ['head', 'neck', 'back', 'face', 'badge'].includes(c.slot));
  for (const id of ['oli', 'rabbit', 'penguin', 'duck', 'tortoise', 'snake', 'octopus', 'elephant']) {
    const v = createAnimalView({ THREE, mats, species: SPECIES[id] });
    for (const c of wear) v.setLook({ accessories: { [c.slot]: c.id } });
    v.setLook({ accessories: { head: 'bobblehat', neck: 'goodanimal', back: 'cape', face: 'sunglasses', badge: 'badge_star' } });
    for (let i = 0; i < 20; i++) v.update(fakePlayer({ speedNorm: 1, vz: 7 }), 1 / 60);
    const st = v.stats();
    assert.ok(st.drawCalls <= 8, `${id} ${st.drawCalls}`);
    v.setLook({ accessories: { head: null, neck: null, back: null, face: null, badge: null } });
    assert.ok(v.stats().drawCalls < st.drawCalls);
    v.dispose();
  }
});

test('every critter kind builds and plays every NPC anim', () => {
  for (const kind of CRITTERS) {
    const c = createCritterView({ THREE, mats, kind });
    assert.ok(c.object3d.isObject3D, kind);
    for (const anim of NPC_ANIMS) {
      for (let i = 0; i < 10; i++) c.update({ id: kind, kind, x: i * 0.01, z: 0, px: (i - 1) * 0.01, pz: 0, yaw: 0, anim, animT: i / 60, mood: null }, 1 / 60);
    }
    c.object3d.traverse((o) => { if (o.isBone) assert.ok(Number.isFinite(o.rotation.x) && Number.isFinite(o.position.y), `${kind} ${o.name}`); });
    c.dispose();
  }
});

test('critters are real scale by default', () => {
  const pigeon = createCritterView({ THREE, mats, kind: 'pigeon' });
  const cow = createCritterView({ THREE, mats, kind: 'highlandcow' });
  const size = (v) => new THREE.Box3().setFromObject(v.object3d).getSize(new THREE.Vector3());
  assert.ok(size(pigeon).z < 0.6 && size(cow).z > 1.5, `${size(pigeon).z} ${size(cow).z}`);
});

test('Gerald takes disguises from setDisguise, npc.disguise and npc.mood', () => {
  const g = createCritterView({ THREE, mats, kind: 'gerald' });
  const base = g.stats().drawCalls;
  g.setDisguise('bowler');
  assert.equal(g.stats().drawCalls, base + 1);
  g.update({ x: 0, z: 0, px: 0, pz: 0, anim: 'idle', disguise: 'tartan' }, 1 / 60);
  assert.equal(g.view.look.accessories.neck, 'scarf');
  g.update({ x: 0, z: 0, px: 0, pz: 0, anim: 'idle', mood: 'disguise:explorer' }, 1 / 60);
  assert.equal(g.view.look.accessories.head, 'explorer');
  for (const d of ['touristhat', 'bowler', 'explorer', 'tartan', 'hoodie', 'beret', 'swimring', 'sunglasses']) g.setDisguise(d);
  g.setDisguise(null);
  assert.equal(g.stats().drawCalls, base);
});

test('the magpenguin wears sunglasses', () => {
  const m = createCritterView({ THREE, mats, kind: 'magpenguin' });
  assert.equal(m.view.look.accessories.face, 'sunglasses');
});
