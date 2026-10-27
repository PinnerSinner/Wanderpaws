// STUB (lead): replaced by the Render agent.
import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { createAnimalView } from '../animals/view/index.js';
import { getSpecies } from '../animals/species.js';
import { buildScenery } from '../worlds/meshes/index.js';
export function createRenderer({ canvas, settings, app }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#9fd8f5');
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 2000);
  scene.add(new THREE.HemisphereLight('#ffffff', '#d0b080', 2));
  const mats = createMaterials(THREE, settings);
  let hero = null, world = null, yaw = 0, sim = null;
  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  resize();
  function clear() { while (scene.children.length > 1) scene.remove(scene.children[1]); hero = null; }
  return { THREE, renderer, scene, camera, mats,
    showScene(kind, p = {}) { clear(); sim = p.sim || null;
      const sp = getSpecies(p.speciesId || p.species?.id); const look = p.look || sp.defaults;
      hero = createAnimalView({ THREE, mats, species: sp, look }); scene.add(hero.object3d);
      if (p.world) { world = buildScenery(THREE, mats, p.world); scene.add(world.group); } },
    setLook() {}, frame(alpha, dt, state) {
      if (state && hero) { const p = state.player; hero.object3d.position.set(p.x, p.y, p.z); hero.object3d.rotation.y = p.yaw; hero.object3d.scale.setScalar(p.displaySize * 2);
        camera.position.set(p.x - Math.sin(yaw) * 4, 2.5, p.z - Math.cos(yaw) * 4); camera.lookAt(p.x, 0.5, p.z); }
      else { camera.position.set(2, 1.2, 3); camera.lookAt(0, 0.4, 0); if (hero) hero.object3d.rotation.y += dt * 0.5; }
      renderer.render(scene, camera); },
    getCameraYaw: () => yaw, addLook(dx) { yaw -= dx; }, floatingText: { add() {} },
    enterPhoto() {}, exitPhoto() {}, isPhoto: () => false, screenshot: () => canvas.toDataURL('image/png'),
    clip: { supported: false, start() {}, save: async () => null }, setQuality() {}, stats: () => ({ fps: 0, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frameMs: 0 }), resize, dispose() {} };
}
