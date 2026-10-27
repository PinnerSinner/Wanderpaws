// Preview page for World-meshes (bundled by tools/mesh-preview.mjs).
// Query params:
//   mode=items|humans|scenery|world   ids=a,b,c (optional subset)   world=w1
//   view=front|three|top|side         cols=8   cell=220   anim=walk   t=1.3 (seconds to advance)
import * as THREE from 'three';
import { createMaterials } from '../../../render/materials.js';
import { CATALOGUE_ORDER, CATALOGUE } from '../../catalogue.js';
import { SCENERY, HUMANS, NPC_ANIMS } from '../../ids.js';
import { WORLDS, getWorld } from '../../index.js';
import { buildItemMesh, buildSceneryMesh, buildScenery, buildHuman } from '../index.js';

const q = new URLSearchParams(location.search);
const mode = q.get('mode') || 'items';
const view = q.get('view') || 'three';
const cell = Number(q.get('cell') || 220);
const cols = Number(q.get('cols') || 8);
const advance = Number(q.get('t') || 1.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = false;
document.body.style.cssText = 'margin:0;background:#f3efe6;font:600 13px Trebuchet MS, sans-serif;color:#3a2a22;overflow:hidden';
document.body.appendChild(renderer.domElement);
const settings = { get: (k) => ({ quality: 'medium' })[k], subscribe() {} };
const mats = createMaterials(THREE, settings);
window.__mats = mats;

function lights(scene) {
  scene.add(new THREE.HemisphereLight('#fff6e8', '#b8a890', 1.6));
  const d = new THREE.DirectionalLight('#fff1d6', 2.2);
  d.position.set(4, 8, 6);
  scene.add(d);
  scene.add(d.target);
  return d;
}

function label(text, x, y, w, sub) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;text-align:center;pointer-events:none;text-shadow:0 1px 0 #fff`;
  el.innerHTML = text + (sub ? `<div style="font-weight:400;font-size:11px;opacity:.7">${sub}</div>` : '');
  document.body.appendChild(el);
}

function viewDir() {
  if (view === 'front') return new THREE.Vector3(0, 0.25, 1).normalize();
  if (view === 'top') return new THREE.Vector3(0, 1, 0.001).normalize();
  if (view === 'side') return new THREE.Vector3(1, 0.25, 0).normalize();
  if (view === 'back') return new THREE.Vector3(0, 0.25, -1).normalize();
  return new THREE.Vector3(0.75, 0.55, 1).normalize();
}

function frameObject(cam, obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getBoundingSphere(new THREE.Sphere());
  const dir = viewDir();
  const dist = s.radius / Math.sin((cam.fov * Math.PI) / 360) * 1.05;
  cam.position.copy(s.center).addScaledVector(dir, dist);
  cam.near = dist / 100; cam.far = dist * 10;
  cam.lookAt(s.center);
  cam.updateProjectionMatrix();
}

function countTris(obj) {
  let n = 0, calls = 0;
  obj.traverse((o) => { if (o.isMesh) { calls++; const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  return { n: Math.round(n), calls };
}

const cells = [];
let worldScene = null;

function gridMode(entries) {
  const rows = Math.ceil(entries.length / cols);
  const W = cols * cell, H = rows * (cell + 22);
  renderer.setSize(W, H);
  entries.forEach((e, i) => {
    const scene = new THREE.Scene();
    lights(scene);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#e6dfcf' }));
    scene.add(e.obj);
    const box = new THREE.Box3().setFromObject(e.obj);
    const sz = box.getSize(new THREE.Vector3());
    ground.scale.setScalar(Math.max(sz.x, sz.z) * 0.75 + 0.01);
    ground.position.y = box.min.y - 0.001;
    if (e.ground !== false) scene.add(ground);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
    const c = i % cols, r = Math.floor(i / cols);
    cells.push({ scene, cam, obj: e.obj, update: e.update, x: c * cell, y: r * (cell + 22), npc: e.npc });
    const t = countTris(e.obj);
    label(e.name, c * cell, r * (cell + 22) + cell - 4, cell, `${t.n} tris, ${t.calls} calls${e.sub ? ', ' + e.sub : ''}`);
  });
}

function itemsMode() {
  const ids = q.get('ids') ? q.get('ids').split(',') : CATALOGUE_ORDER;
  gridMode(ids.map((id) => {
    const obj = buildItemMesh(THREE, mats, id);
    const it = CATALOGUE[id];
    const d = obj.userData.dims;
    return { name: id + (obj.userData.fallback ? ' (FALLBACK)' : ''), obj, sub: d ? `${d.width.toFixed(2)}x${d.height.toFixed(2)}` : '' };
  }));
}

function humansMode() {
  const kinds = q.get('ids') ? q.get('ids').split(',') : HUMANS;
  const anim = q.get('anim') || 'idle';
  gridMode(kinds.map((k, i) => {
    const h = buildHuman(THREE, mats, k, { variant: i });
    const npc = { id: k, kind: k, x: 0, y: 0, z: 0, px: 0, pz: 0, yaw: 0, anim, animT: 0, mood: 'happy' };
    return { name: k, obj: h.object3d, update: h.update, npc };
  }));
}

function animsMode() {
  const kind = q.get('kind') || 'marco';
  gridMode(NPC_ANIMS.map((a, i) => {
    const h = buildHuman(THREE, mats, kind, { variant: i });
    const npc = { id: kind, kind, x: 0, y: 0, z: 0, px: 0, pz: 0, yaw: 0, anim: a, animT: 0, mood: 'happy' };
    return { name: a, obj: h.object3d, update: h.update, npc };
  }));
}

function sceneryMode() {
  const ids = q.get('ids') ? q.get('ids').split(',') : Object.keys(SCENERY);
  const pal = getWorld(q.get('world') || 'w1').palette;
  gridMode(ids.map((id) => {
    const obj = buildSceneryMesh(THREE, mats, id, { palette: pal, preview: true });
    return { name: id, obj, update: obj.userData.update ? (n, dt) => obj.userData.update(dt, null) : null };
  }));
}

function worldMode() {
  const w = getWorld(q.get('world') || 'w1');
  const W = Number(q.get('w') || 1600), H = Number(q.get('h') || 900);
  renderer.setSize(W, H);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(w.palette.skyTop);
  scene.fog = new THREE.Fog(w.palette.fog, w.palette.fogNear * 3, w.palette.fogFar * 4);
  lights(scene);
  const t0 = performance.now();
  const sc = buildScenery(THREE, mats, w);
  const ms = performance.now() - t0;
  scene.add(sc.group);
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.5, 8000);
  const b = w.bounds;
  const cx = q.has('cx') ? Number(q.get('cx')) : (b.minX + b.maxX) / 2, cz = q.has('cz') ? Number(q.get('cz')) : (b.minZ + b.maxZ) / 2;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  const dist = Number(q.get('dist') || span * 0.75);
  const yaw = Number(q.get('yaw') || 0.6), pitch = Number(q.get('pitch') || 0.55);
  cam.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * dist, w.heightAt(cx, cz) + Math.sin(pitch) * dist, cz + Math.cos(yaw) * Math.cos(pitch) * dist);
  cam.lookAt(cx, w.heightAt(cx, cz), cz);
  worldScene = { scene, cam, sc };
  const t = countTris(sc.group);
  label(`${w.id} scenery: ${t.n} tris, ${t.calls} meshes, built in ${ms.toFixed(0)} ms`, 0, 4, W);
}

if (mode === 'items') itemsMode();
else if (mode === 'humans') humansMode();
else if (mode === 'anims') animsMode();
else if (mode === 'scenery') sceneryMode();
else worldMode();

let time = 0;
function tick(dt) {
  time += dt;
  mats.uniforms.time.value = time;
  for (const c of cells) if (c.update) { if (c.npc) c.npc.animT += dt; c.update(c.npc, dt); }
  if (worldScene) worldScene.sc.update(dt, null);
}
// advance animation deterministically before the first render
for (let i = 0; i < Math.round(advance * 60); i++) tick(1 / 60);

function render() {
  if (worldScene) {
    renderer.render(worldScene.scene, worldScene.cam);
    window.__stats = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    return;
  }
  renderer.setScissorTest(true);
  renderer.setClearColor('#f3efe6');
  renderer.clear();
  const H = renderer.domElement.height;
  for (const c of cells) {
    frameObject(c.cam, c.obj);
    renderer.setViewport(c.x, H - c.y - cell, cell, cell);
    renderer.setScissor(c.x, H - c.y - cell, cell, cell);
    renderer.setClearColor(cells.indexOf(c) % 2 ? '#f6f2ea' : '#efe9dc');
    renderer.clear();
    renderer.render(c.scene, c.cam);
  }
  renderer.setScissorTest(false);
}
render();
window.__ready = true;
window.__rerender = (dt = 0.25) => { tick(dt); render(); };
void WORLDS;
