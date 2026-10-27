// Animal preview page (bundled by tools/animal-preview.mjs). Renders a
// contact sheet: one species, many cells, each cell its own view instance
// driven by a fake player over time, so silhouettes and motion can be judged
// from several angles in one screenshot.
//
// URL params: species=oli  layout=grid|hero|critters|lineup  t=seconds  look=<preset id>
//             cells=<comma list of scenario:angle>  q=high|low

import * as THREE from 'three';
import { createMaterials } from '../../../render/materials.js';
import { createAnimalView, createCritterView } from '../index.js';
import { SPECIES, SPECIES_ORDER, getSpecies } from '../../species.js';
import { mergeLook, applyPreset } from '../../customise.js';
import { CRITTERS } from '../../../worlds/ids.js';

const params = new URLSearchParams(location.search);
const speciesId = params.get('species') || 'oli';
const layout = params.get('layout') || 'grid';
const T = Number(params.get('t') || 2.2);
const quality = params.get('q') || 'high';

const DEFAULT_CELLS = [
  'stand:front', 'stand:side', 'stand:threeq', 'stand:top',
  'walk:threeq', 'trot:side', 'sprint:side', 'jump:side',
  'sit:threeq', 'shake:front', 'sig:threeq', 'idle2:threeq',
];

// --- fake player state ------------------------------------------------------
function makePlayer() {
  return {
    x: 0, y: 0, z: 0, yaw: 0, px: 0, py: 0, pz: 0, pyaw: 0, vx: 0, vy: 0, vz: 0, speed: 0, speedNorm: 0,
    size: 1, displaySize: 1, grounded: true, airborne: false, inWater: false, waterDepth: 0, surface: 'grass',
    sprinting: false, turnRate: 0, landImpact: 0, gulp: 0, stagger: 0,
    sig: { kind: null, active: false, t: 0, cooldownLeft: 0, ready: true, aimYaw: 0, power: 0 },
    emotion: 'happy', idleTime: 0, idleAnim: null, barkT: 99, playBow: false, shakeT: 0,
    buffs: { tea: 0, wobble: 0, speed: 0 }, combo: { count: 0, mult: 1, timer: 0 }, reach: 0.6,
  };
}

const TOP = 7; // top speed in body lengths per second

function drive(p, sc, t, sp, dt) {
  p.vx = 0; p.vz = 0; p.vy = 0; p.speedNorm = 0; p.sprinting = false; p.airborne = false; p.grounded = true;
  p.idleAnim = null; p.playBow = false; p.turnRate = 0; p.inWater = false; p.waterDepth = 0; p.y = 0;
  p.sig.active = false; p.sig.power = 0; p.sig.kind = sp.signature.kind;
  p.landImpact = Math.max(0, p.landImpact - dt * 2.5);
  p.gulp = Math.max(0, p.gulp - dt * 2.2);
  const run = (sn) => { p.speedNorm = sn; p.vz = sn * TOP; p.sprinting = sn > 0.9; };
  switch (sc) {
    case 'stand': break;
    case 'walk': run(0.22); break;
    case 'trot': run(0.5); break;
    case 'gallop': run(0.8); break;
    case 'sprint': run(1); break;
    case 'turn': run(0.6); p.turnRate = 1.6; p.yaw += 1.6 * dt; break;
    case 'jump': {
      run(0.4);
      const cyc = 1.3, u = (t % cyc);
      const air = 0.75;
      if (u < air) {
        const v0 = 3.2, g = (2 * v0) / air;
        p.y = v0 * u - 0.5 * g * u * u; p.vy = v0 - g * u; p.airborne = true; p.grounded = false;
      } else if (u - dt < air || p._wasAir) { p.landImpact = 1; }
      p._wasAir = u < air;
      break;
    }
    case 'swim': run(0.4); p.inWater = true; p.waterDepth = 2; break;
    case 'gulp': if ((t % 0.9) < dt) p.gulp = 1; run(0.15); break;
    case 'bark': p.barkT = t % 1.2; break;
    case 'playbow': p.playBow = true; break;
    case 'sig': {
      const dur = sp.signature.duration;
      const cyc = dur + 1.2;
      const u = t % cyc;
      if (u < 0.6) { p.sig.power = u / 0.6; }
      else if (u < 0.6 + dur) { p.sig.active = true; p.sig.t = u - 0.6; if (sp.signature.kind === 'bellySlide' || sp.signature.kind === 'sniffBoost') run(0.8); }
      break;
    }
    case 'sigmid': { p.sig.active = true; p.sig.t = sp.signature.duration * 0.45; break; }
    case 'excited': p.emotion = 'excited'; run(0.3); break;
    case 'scared': p.emotion = 'scared'; break;
    case 'sleepy': p.emotion = 'sleepy'; break;
    case 'stagger': p.stagger = 1; break;
    case 'idle2': p.idleAnim = 'species'; break;
    default:
      if (['sit', 'sniff', 'scratch', 'yawn', 'look', 'shake', 'lie', 'species'].includes(sc)) p.idleAnim = sc;
  }
  p.speed = Math.hypot(p.vx, p.vz);
  if (sc !== 'excited' && sc !== 'scared' && sc !== 'sleepy') p.emotion = 'happy';
  if (sc !== 'stagger') p.stagger = 0;
  if (sc !== 'bark') p.barkT = 99;
}

// --- scene ------------------------------------------------------------------
const W = Number(params.get('w') || (layout === 'hero' ? 1200 : 1600));
const H = Number(params.get('h') || (layout === 'hero' ? 900 : 1200));
const canvas = document.createElement('canvas');
document.body.style.margin = '0';
document.body.style.background = '#cfe8f2';
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.setScissorTest(true);
const settings = { get: () => null, set() {}, subscribe() { return () => {}; }, all: () => ({}) };
const mats = createMaterials(THREE, settings);

function makeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe3f0');
  const hemi = new THREE.HemisphereLight('#dff4ff', '#d8c49a', 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
  sun.position.set(2.5, 4, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = 1.6; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.1, far: 12 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshLambertMaterial({ color: '#a8d88a' }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // stripes to sell motion
  const stripeMat = new THREE.MeshLambertMaterial({ color: '#98cc7c' });
  const stripes = new THREE.Group();
  for (let i = -6; i <= 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.12), stripeMat); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.002, i * 0.5); stripes.add(m); }
  scene.add(stripes);
  return { scene, sun, stripes };
}

const ANGLES = {
  front: [0, 0.55, 2.6], side: [2.6, 0.55, 0], threeq: [1.9, 1.0, 1.9], top: [0.01, 3.0, 0.2], back: [-1.2, 0.9, -2.2], hero: [1.55, 0.75, 1.75], low: [1.6, 0.25, 1.6],
};

const cells = [];
function addCell(kind, id, sc, angle, look) {
  const { scene, sun, stripes } = makeScene();
  let view;
  if (kind === 'critter') view = createCritterView({ THREE, mats, kind: id, quality });
  else view = createAnimalView({ THREE, mats, species: getSpecies(id), look, quality });
  scene.add(view.object3d);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const a = ANGLES[angle] || ANGLES.threeq;
  cam.position.set(a[0], a[1], a[2]);
  cam.lookAt(0, kind === 'critter' ? 0.3 : 0.35, 0);
  cells.push({ kind, id, sc, angle, view, scene, sun, cam, stripes, player: makePlayer(), sp: kind === 'critter' ? null : getSpecies(id), npc: { id, kind: id, x: 0, y: 0, z: 0, yaw: 0, px: 0, pz: 0, anim: sc, animT: 0, mood: null } });
}

const lookParam = params.get('look');
function lookFor(id) {
  const sp = getSpecies(id);
  let l = mergeLook(sp, {});
  if (lookParam) l = applyPreset(sp, lookParam, l);
  const acc = params.get('acc');
  if (acc) { const a = { ...l.accessories }; for (const p of acc.split(',')) { const [slot, v] = p.split(':'); a[slot] = v; } l = mergeLook(sp, { ...l, accessories: a }); }
  return l;
}

if (layout === 'grid') {
  const list = (params.get('cells') || DEFAULT_CELLS.join(',')).split(',');
  for (const c of list) { const [sc, ang] = c.split(':'); addCell('animal', speciesId, sc, ang || 'threeq', lookFor(speciesId)); }
} else if (layout === 'hero') {
  addCell('animal', speciesId, params.get('sc') || 'stand', params.get('angle') || 'hero', lookFor(speciesId));
} else if (layout === 'lineup') {
  for (const id of SPECIES_ORDER) addCell('animal', id, params.get('sc') || 'stand', params.get('angle') || 'threeq', lookFor(id));
} else if (layout === 'presets') {
  const sp = getSpecies(speciesId);
  for (const pr of sp.presets) addCell('animal', speciesId, 'stand', 'threeq', applyPreset(sp, pr.id));
} else if (layout === 'critters') {
  const list = params.get('kinds') ? params.get('kinds').split(',') : CRITTERS;
  for (const k of list) addCell('critter', k, params.get('sc') || 'idle', params.get('angle') || 'threeq');
}

const n = cells.length;
const cols = Number(params.get('cols') || (layout === 'hero' ? 1 : n <= 4 ? n : n <= 9 ? 3 : 4));
const rows = Math.ceil(n / cols);
const cw = Math.floor(W / cols), ch = Math.floor(H / rows);

function stepAll(dt, t) {
  for (const c of cells) {
    if (c.kind === 'critter') {
      c.npc.animT = t;
      c.view.update(c.npc, dt);
      continue;
    }
    drive(c.player, c.sc, t, c.sp, dt);
    c.view.update(c.player, dt);
    c.view.object3d.position.y = c.player.y;
    c.view.object3d.rotation.y = c.sc === 'turn' ? 0 : 0;
    c.stripes.position.z = -((t * c.player.vz) % 0.5);
  }
}
function render(t) {
  mats.uniforms.time.value = t;
  cells.forEach((c, i) => {
    const x = (i % cols) * cw, y = H - (Math.floor(i / cols) + 1) * ch;
    renderer.setViewport(x, y, cw, ch);
    renderer.setScissor(x, y, cw, ch);
    c.cam.aspect = cw / ch;
    c.cam.updateProjectionMatrix();
    const v = new THREE.Vector3().copy(c.sun.position).normalize().transformDirection(c.cam.matrixWorldInverse);
    mats.uniforms.sunView.value.copy(v);
    renderer.render(c.scene, c.cam);
  });
}

// Simulate to time T deterministically at 60 Hz, then render.
let simT = 0;
function advanceTo(t) { const dt = 1 / 60; while (simT < t) { simT += dt; stepAll(dt, simT); } render(simT); }
advanceTo(T);

const stats = cells.map((c) => ({ id: c.id, sc: c.sc, ...(c.view.stats ? c.view.stats() : {}) }));
window.__preview = { ready: true, stats, advanceTo, cells: cells.length, renderInfo: () => renderer.info.render };
if (params.get('live')) {
  let last = performance.now();
  const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; simT += dt; stepAll(dt, simT); render(simT); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
void SPECIES;
