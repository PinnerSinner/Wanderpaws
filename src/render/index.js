// The renderer (CONTRACTS §4.1): scenes (title, showroom, level), lighting,
// sky, the spring-arm camera, particles and weather, floating text, light
// post-processing, quality tiers with auto-detect, photo mode, screenshots and
// clips. Subscribes to the bus for the event-driven effects.
//
// Hot path rule: nothing in frame() allocates. Everything is preallocated here.

import * as THREE from 'three';
import { createMaterials } from './materials.js';
import * as AnimalViews from '../animals/view/index.js';
import * as WorldMeshes from '../worlds/meshes/index.js';
import * as WorldIds from '../worlds/ids.js';
import { CATALOGUE } from '../worlds/catalogue.js';
import { getSpecies } from '../animals/species.js';
import { EV } from '../core/events.js';

import { TIERS, resolveTier, createBenchmark, dprFor } from './pure/quality.js';
import { createCameraRig, createCameraInput } from './pure/cameraRig.js';
import { timeOfDayAt } from './pure/sun.js';
import { createSky } from './sky.js';
import { createLighting } from './lighting.js';
import { createParticles } from './particles.js';
import { createWeather } from './weather.js';
import { createEffects } from './effects.js';
import { createItemLayer } from './items.js';
import { createBirds } from './birds.js';
import { createNpcLayer, createGhost, makeFakePlayer, interpPlayer, setShadows } from './actors.js';
import { createFloatingText } from './floatingText.js';
import { createPost, PHOTO_FILTERS } from './post.js';
import { createClipRecorder } from './clip.js';
import { createTitleStage } from './stages/title.js';
import { createShowroomStage } from './stages/showroom.js';
import { buildFallbackScenery } from './fallbackScenery.js';

const SIM_DT = 1 / 60;

export function createRenderer({ canvas, overlay, settings, bus, app }) {
  const S = (k, d) => { const v = settings?.get?.(k); return v === undefined ? d : v; };

  // ------------------------------------------------------------------ core
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
  } catch (e) {
    console.error('[render] WebGL unavailable', e);
    return createNullRenderer(canvas);
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  renderer.setClearColor('#ffd9a0', 1);

  const scene = new THREE.Scene();
  scene.name = 'gobblepaws';
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 3000);
  camera.position.set(0, 2, -4);
  const mats = createMaterials(THREE, settings);
  const sky = createSky(THREE);
  scene.add(sky.mesh);
  const lighting = createLighting(THREE, { scene, mats, sky });
  const particles = createParticles(THREE, { capacity: 2500, cap: 1000 });
  scene.add(particles.mesh);
  const weather = createWeather(THREE, { capacity: 1400 });
  scene.add(weather.mesh);
  const birds = createBirds(THREE, { mats, max: 64 });
  scene.add(birds.mesh);
  const stageRoot = new THREE.Group();
  stageRoot.name = 'stage-root';
  scene.add(stageRoot);
  const floatingText = createFloatingText({ overlay, settings });
  const post = createPost(THREE, renderer);
  const clip = createClipRecorder(canvas);

  // player contact blob (soft grounding on every tier)
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0.3 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: '#include <common>\nuniform float uAlpha; varying vec2 vUv; void main(){ float r = length(vUv * 2.0 - 1.0); float a = (1.0 - smoothstep(0.15, 1.0, r)) * uAlpha; if (a < 0.01) discard; gl_FragColor = vec4(0.2, 0.14, 0.24, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6,
  });
  const heroBlob = new THREE.Mesh(blobGeo, blobMat);
  heroBlob.name = 'hero-blob';
  heroBlob.renderOrder = 1;

  // ------------------------------------------------------------------ state
  let tierId = resolveTier(S('quality', 'auto'), S('resolvedQuality', 'medium'));
  let tier = TIERS[tierId];
  let bench = S('quality', 'auto') === 'auto' ? createBenchmark({ duration: 2, skip: 0.6 }) : null;
  let kind = 'none';
  let time = 0;
  let photo = false, photoFilter = 0, photoZoom = 1;
  let titleStage = null, showroomStage = null;
  let showroomFraming = 'left';
  let hero = null; // { view, speciesId }
  let heroLook = null;
  const heroFake = makeFakePlayer(1);
  let level = null; // { world, sim, scenery, items, npcs, ghost, species, look, heightAt }
  const rig = createCameraRig();
  const camIn = createCameraInput();
  const pv = makeFakePlayer(1);           // interpolated player passed to the view
  const pTmp = { x: 0, y: 0, z: 0, yaw: 0 };
  const pPose = { x: 0, y: 0, z: 0, yaw: 0, size: 1, vx: 0, vz: 0, inWater: false, grounded: true, sprinting: false, surface: 'sand', reach: 0.6, waterDepth: 0 };
  const fxCtx = { player: null, heightAt: null, time: 0, trail: null, confetti: 70, waterLevel: null, onMilestone: null, onBump: null };
  const vPos = new THREE.Vector3(), vLook = new THREE.Vector3(), vTmp = new THREE.Vector3(), vTmp2 = new THREE.Vector3();
  const focus = { x: 0, y: 0, z: 0 };
  const camDir = new THREE.Vector3();
  const textCtx = { width: 1, height: 1, project: null, resolve: null, playerRect: null, visible: true, insetL: 0, insetR: 0, insetT: 0, insetB: 0 };
  const playerRect = { l: 0, t: 0, r: 0, b: 0 };
  let viewW = 1, viewH = 1;
  let lastCamHintT = -1;
  let weatherOverride = null;
  let lagT = 0;
  // stats
  let fps = 0, frameMs = 0, fpsAcc = 0, fpsN = 0, lastDraw = 0, lastTris = 0, cpuMs = 0;
  const statsOut = { fps: 0, drawCalls: 0, triangles: 0, frameMs: 0, cpuMs: 0, tier: tierId, particles: 0, weather: 0, itemTypes: 0, npcs: 0, scene: 'none' };

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ------------------------------------------------------------------ quality
  function applyTier(id) {
    tierId = id;
    tier = TIERS[id] || TIERS.medium;
    renderer.setPixelRatio(dprFor(id, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1));
    lighting.setShadows(tier);
    post.configure(tier);
    particles.setCap(tier.particles);
    weather.setCap(tier.weather);
    birds.setCap(tier.birds);
    sky.uniforms.uClouds.value = tier.clouds ? 1 : 0.6;
    if (level) {
      level.items.setBlobs(!tier.shadows);
      level.npcs.setShadows(tier.shadows);
    }
    resize();
  }

  function setQuality(q) {
    if (q === 'auto') {
      bench = createBenchmark({ duration: 2, skip: 0.6 });
      applyTier(resolveTier('auto', S('resolvedQuality', 'medium')));
    } else if (TIERS[q]) {
      bench = null;
      applyTier(q);
    }
  }

  const unsub = settings?.subscribe?.((k, v) => {
    if (k === 'quality') setQuality(v);
    else if (k === 'colourBlind' && level) level.items.applyColours();
  });

  // ------------------------------------------------------------------ sizing
  function resize() {
    const w = Math.max(1, (canvas && canvas.clientWidth) || (typeof innerWidth !== 'undefined' ? innerWidth : 800));
    const h = Math.max(1, (canvas && canvas.clientHeight) || (typeof innerHeight !== 'undefined' ? innerHeight : 600));
    viewW = w; viewH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h, renderer.getPixelRatio());
    readInsets();
  }

  function readInsets() {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      textCtx.insetT = parseFloat(cs.paddingTop) || 0; textCtx.insetR = parseFloat(cs.paddingRight) || 0;
      textCtx.insetB = parseFloat(cs.paddingBottom) || 0; textCtx.insetL = parseFloat(cs.paddingLeft) || 0;
      probe.remove();
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------ hero
  function setHero(speciesId, look) {
    const species = getSpecies(speciesId);
    const lk = look || species.defaults;
    heroLook = lk;
    if (hero && hero.speciesId === species.id) {
      try { hero.view.setLook?.(lk); } catch (e) { console.warn('[render] setLook', e); }
      return hero;
    }
    if (hero) { stageRoot.remove(hero.view.object3d); try { hero.view.dispose?.(); } catch { /* ignore */ } hero = null; }
    let view = null;
    try { view = AnimalViews.createAnimalView({ THREE, mats, species, look: lk, quality: tierId }); } catch (e) { console.warn('[render] createAnimalView failed', e); }
    if (!view || !view.object3d) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 4, 10).rotateX(Math.PI / 2), mats.toon(lk.base || '#e8c27a'));
      m.position.y = 0.3; g.add(m);
      view = { object3d: g, update() {}, setLook() {}, setEmotion() {}, dispose() { m.geometry.dispose(); } };
    }
    setShadows(view.object3d, true, true);
    mats.sanitize(view.object3d);
    view.object3d.name = 'hero:' + species.id;
    hero = { view, speciesId: species.id, species };
    heroFake.sig.kind = species.signature?.kind || null;
    return hero;
  }

  function disposeLevel() {
    if (!level) return;
    try { level.scenery.dispose?.(); } catch { /* ignore */ }
    level.items.dispose();
    level.npcs.clear();
    if (level.ghost) level.ghost.dispose();
    level = null;
  }

  function clearStage() {
    while (stageRoot.children.length) stageRoot.remove(stageRoot.children[0]);
  }

  // ------------------------------------------------------------------ scenes
  function showScene(k, p = {}) {
    if (k !== 'level') disposeLevel();
    clearStage();
    particles.clear();
    floatingText.clear();
    weather.set('clear', 0);
    sky.uniforms.uAurora.value = 0;
    sky.uniforms.uStudio.value = 0;
    kind = k;
    if (k !== 'level' && clip.running) clip.stop();

    if (k === 'title') {
      if (!titleStage) titleStage = createTitleStage(THREE, { mats, buildSceneryMesh: WorldMeshes.buildSceneryMesh, buildItemMesh: WorldMeshes.buildItemMesh, catalogue: CATALOGUE });
      stageRoot.add(titleStage.group);
      lighting.setPalette(titleStage.palette);
      mats.setHeightField(titleStage.heightAt, titleStage.bounds, 96);
      mats.uniforms.waterScale.value = 1;
      setHero(p.speciesId || 'oli', p.look);
      stageRoot.add(hero.view.object3d);
      stageRoot.add(heroBlob);
      heroFake.idleTime = 0;
    } else if (k === 'showroom') {
      if (!showroomStage) showroomStage = createShowroomStage(THREE, { mats });
      showroomFraming = p.framing || 'centre';
      stageRoot.add(showroomStage.group);
      lighting.setPalette(showroomStage.palette);
      mats.setHeightField(null);
      sky.uniforms.uStudio.value = 1;
      setHero(p.speciesId || 'oli', p.look);
      stageRoot.add(hero.view.object3d);
      stageRoot.add(heroBlob);
      heroFake.idleTime = 0;
    } else if (k === 'level' && p.world && p.sim) {
      disposeLevel();
      buildLevel(p);
    } else {
      kind = 'none';
    }
  }

  function buildLevel(p) {
    const world = p.world;
    const species = p.species || getSpecies(p.speciesId);
    let scenery = null;
    try { scenery = WorldMeshes.buildScenery ? WorldMeshes.buildScenery(THREE, mats, world) : null; } catch (e) { console.warn('[render] buildScenery failed', e); }
    if (!scenery || !scenery.group || scenery.group.children.length === 0) {
      try { scenery?.dispose?.(); } catch { /* ignore */ }
      scenery = buildFallbackScenery(THREE, mats, world);
    }
    // shadows: big flat things receive, everything else casts too
    scenery.group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material && o.material.name === 'gp-water') { o.castShadow = false; o.receiveShadow = false; return; }
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const r = o.isInstancedMesh ? 1 : (o.geometry.boundingSphere?.radius || 1) * maxScale(o);
      o.receiveShadow = true;
      if (o.castShadow === false && o.userData.noShadow) return;
      o.castShadow = r < 60;
    });
    mats.sanitize(scenery.group);
    stageRoot.add(scenery.group);
    const heightAt = typeof world.heightAt === 'function' ? world.heightAt : null;
    mats.setHeightField(heightAt, padBounds(world.bounds, 60), 160);
    mats.uniforms.waterScale.value = Math.max(1, (world.goals?.start || 0.25) * 2);
    lighting.setPalette(world.palette);
    effects.setSand(world.palette?.ground);

    const items = createItemLayer(THREE, { mats, buildItemMesh: WorldMeshes.buildItemMesh, catalogue: CATALOGUE, settings });
    items.setup(p.sim.state.items, { heightAt });
    items.setBlobs(!tier.shadows);
    stageRoot.add(items.group);

    const npcs = createNpcLayer(THREE, {
      mats, buildHuman: WorldMeshes.buildHuman, createCritterView: AnimalViews.createCritterView,
      humanKinds: WorldIds.HUMANS || [], critterKinds: WorldIds.CRITTERS || [],
    });
    npcs.setShadows(tier.shadows);
    stageRoot.add(npcs.group);

    setHero(species.id, p.look);
    stageRoot.add(hero.view.object3d);
    stageRoot.add(heroBlob);

    const ghost = createGhost(THREE, { mats, createAnimalView: AnimalViews.createAnimalView, species, look: p.look || species.defaults, samples: p.ghost });
    if (ghost) stageRoot.add(ghost.object3d);

    level = { world, sim: p.sim, scenery, items, npcs, ghost, species, look: p.look || species.defaults, heightAt };
    lastCamHintT = -1;
    const pl = p.sim.state.player;
    camIn.x = pl.x; camIn.y = pl.y; camIn.z = pl.z; camIn.yaw = pl.yaw || world.spawn?.yaw || 0; camIn.size = pl.displaySize || pl.size || 0.25;
    camIn.heightAt = heightAt;
    rig.snap(camIn);
    effects.reset();
    if (clip.supported) clip.start();
  }

  function maxScale(o) { const s = o.scale; return Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)); }
  function padBounds(b, pad) {
    if (!b) return { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    return { minX: b.minX - pad, maxX: b.maxX + pad, minZ: b.minZ - pad, maxZ: b.maxZ + pad };
  }

  // ------------------------------------------------------------------ effects
  const effects = createEffects(THREE, { particles, bus, getCtx: () => fxCtx });
  fxCtx.onMilestone = () => { if (kind === 'level') rig.milestone(); };
  fxCtx.onBump = () => { if (kind === 'level') rig.shake(0.45); };

  // ------------------------------------------------------------------ text helpers
  textCtx.project = (x, y, z, out) => {
    vTmp.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    out.behind = vTmp.z > -camera.near;
    vTmp.applyMatrix4(camera.projectionMatrix);
    out.x = (vTmp.x * 0.5 + 0.5) * viewW;
    out.y = (-vTmp.y * 0.5 + 0.5) * viewH;
    return out;
  };
  textCtx.resolve = (anchor, style, out) => {
    if (anchor === 'player' || anchor == null || anchor === 'narrator') {
      if (kind === 'level' || kind === 'title' || kind === 'showroom') {
        const s = kind === 'level' ? pPose.size : 1;
        const o = hero ? hero.view.object3d.position : vTmp2.set(0, 0, 0);
        out.x = o.x; out.y = o.y + s * 1.15; out.z = o.z;
        return true;
      }
      return false;
    }
    if (level) return level.npcs.find(anchor, out);
    return false;
  };
  const scr = { x: 0, y: 0, behind: false };
  function computePlayerRect(x, y, z, size) {
    textCtx.project(x, y, z, scr);
    if (scr.behind) return null;
    const bx = scr.x, by = scr.y;
    textCtx.project(x, y + size * 0.95, z, scr);
    const hgt = Math.max(8, by - scr.y);
    playerRect.l = bx - hgt * 0.75; playerRect.r = bx + hgt * 0.75;
    playerRect.t = scr.y; playerRect.b = by + hgt * 0.1;
    return playerRect;
  }

  // ------------------------------------------------------------------ frame
  function frame(alpha, dtReal, simState) {
    const t0 = now();
    const dt = Math.min(0.1, Math.max(0, dtReal || 0));
    const vdt = photo ? dt * 0.2 : dt;
    time += vdt;
    mats.uniforms.time.value = time;
    renderer.info.reset();

    if (bench && kind !== 'none') {
      if (bench.push(dt, tierId)) {
        const r = bench.result;
        bench = null;
        try { settings?.set?.('resolvedQuality', r); } catch { /* ignore */ }
        if (r !== tierId) applyTier(r);
      }
    }

    const reduced = !!S('reducedMotion', false);
    const fov = camera.fov;
    let tod = 0.45, studio = false, size = 1, fogScale = 1, weatherFog = 0;

    if (kind === 'title' && titleStage) {
      titleStage.update(vdt, time);
      updateMenuHero(vdt, titleStage.hero, 1);
      titleStage.camera(reduced ? time * 0.35 : time, camera.aspect, fov, vPos, vLook, 1);
      setCamera(vPos, vLook, 52, 0, 0.05, 2400);
      tod = titleStage.tod;
      birds.sync(titleStage.birds, 1, 1);
      focus.x = titleStage.hero.x; focus.y = titleStage.hero.y; focus.z = titleStage.hero.z;
      size = 1.2;
      fxCtx.player = null;
    } else if (kind === 'showroom' && showroomStage) {
      showroomStage.update(reduced ? vdt * 0.4 : vdt);
      updateMenuHero(vdt, showroomStage.hero, 1);
      showroomStage.camera(time, camera.aspect, fov, vPos, vLook, 1, showroomFraming, reduced);
      setCamera(vPos, vLook, 40, 0, 0.05, 200);
      tod = showroomStage.tod; studio = true;
      birds.sync(null, 1, 1);
      focus.x = 0; focus.y = 0; focus.z = 0;
      size = 1;
      fxCtx.player = null;
    } else if (kind === 'level' && level) {
      const state = simState || level.sim.state;
      const r = updateLevel(state, app && app.paused && !photo ? 1 : alpha, dt, vdt, reduced);
      tod = r.tod; size = r.size; fogScale = r.fogScale; weatherFog = r.weatherFog;
    } else {
      setCamera(vTmp.set(0, 2, -4), vLook.set(0, 0, 0), 52, 0, 0.1, 100);
      birds.sync(null, 1, 1);
      fxCtx.player = null;
    }

    camera.updateMatrixWorld();
    const mood = lighting.update(tod, focus, size, camera, { fogScale, weatherFog, studio });
    sky.follow(camera);
    sky.uniforms.uTime.value = time;
    particles.update(time);
    fxCtx.time = time;
    if (fxCtx.player) effects.tick(vdt);
    camera.getWorldDirection(camDir);
    weather.update(time, camera.position, size, mats.uniforms.wind.value, camDir);
    if (!reduced) mats.uniforms.wind.value.set(0.85 + Math.sin(time * 0.11) * 0.2, 0.35 + Math.sin(time * 0.07) * 0.1);

    // floating text
    textCtx.width = viewW; textCtx.height = viewH; textCtx.visible = !photo;
    floatingText.update(dt, textCtx);

    // draw
    if (tier.post) post.render(scene, camera, mood, { filter: photo ? photoFilter : 0, bloom: 0.5, vignette: photo && photoFilter ? 0.3 : 0.2 });
    else { renderer.setRenderTarget(null); renderer.render(scene, camera); }

    lastDraw = renderer.info.render.calls;
    lastTris = renderer.info.render.triangles;
    const t1 = now();
    cpuMs = cpuMs * 0.9 + (t1 - t0) * 0.1;
    fpsAcc += dtReal || 0; fpsN++;
    if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; frameMs = (fpsAcc / fpsN) * 1000; fpsAcc = 0; fpsN = 0; }
  }

  function setCamera(pos, look, fovDeg, roll, near, far) {
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    if (roll) camera.rotateZ(roll);
    let dirty = false;
    if (Math.abs(camera.fov - fovDeg) > 0.01) { camera.fov = fovDeg; dirty = true; }
    if (camera.near !== near) { camera.near = near; dirty = true; }
    if (camera.far !== far) { camera.far = far; dirty = true; }
    if (dirty) camera.updateProjectionMatrix();
  }

  function updateMenuHero(dt, spot, scale) {
    if (!hero) return;
    const f = heroFake;
    f.idleTime += dt;
    f.x = f.px = spot.x; f.y = f.py = spot.y; f.z = f.pz = spot.z; f.yaw = f.pyaw = spot.yaw;
    f.size = f.displaySize = scale;
    f.speed = 0; f.speedNorm = 0; f.vx = f.vz = 0;
    f.emotion = 'happy';
    const o = hero.view.object3d;
    o.position.set(spot.x, spot.y, spot.z);
    o.rotation.y = spot.yaw;
    o.scale.setScalar(scale);
    try { hero.view.update(f, dt); } catch (e) { /* stub views may throw */ }
    heroBlob.position.set(spot.x, spot.y + 0.01, spot.z);
    heroBlob.scale.setScalar(scale * 1.1);
    blobMat.uniforms.uAlpha.value = 0.22;
  }

  const itemOpts = { lodPx: 10, shapeCodes: false, camX: 0, camY: 0, camZ: 0, pxPerRad: 600, cullPx: 1.5, far: 1e6 };
  const levelOut = { tod: 0.45, size: 1, fogScale: 1, weatherFog: 0 };
  function updateLevel(state, alpha, dt, vdt, reduced) {
    const world = level.world;
    const p = state.player;
    interpPlayer(p, alpha, pv, pTmp);
    const ds = Math.max(0.02, p.displaySize || p.size || 0.25);
    pv.displaySize = ds;

    // hero (inside a lag zone the pose updates at a choppy 8 fps, unless reduced motion)
    const o = hero.view.object3d;
    lagT += dt;
    const choppy = p.lag && !reduced;
    if (!choppy || lagT >= 0.125) {
      const hdt = choppy ? lagT : dt;
      lagT = 0;
      o.position.set(pv.x, pv.y, pv.z);
      o.rotation.y = pv.yaw;
      o.scale.setScalar(ds);
      try { hero.view.update(pv, hdt); } catch (e) { /* tolerate */ }
    }

    const groundY = level.heightAt ? safeH(level.heightAt, pv.x, pv.z, pv.y) : pv.y;
    heroBlob.position.set(pv.x, groundY + 0.004 + ds * 0.005, pv.z);
    const air = Math.max(0, pv.y - groundY);
    heroBlob.scale.setScalar(ds * (1.0 - Math.min(0.5, air / ds * 0.4)));
    heroBlob.visible = !p.inWater;
    blobMat.uniforms.uAlpha.value = (tier.shadows ? 0.16 : 0.3) * (1 - Math.min(0.7, air / ds));

    // pose for items and effects
    pPose.x = pv.x; pPose.y = pv.y; pPose.z = pv.z; pPose.yaw = pv.yaw; pPose.size = ds;
    pPose.vx = p.vx || 0; pPose.vz = p.vz || 0; pPose.inWater = !!p.inWater; pPose.grounded = p.grounded !== false;
    pPose.sprinting = !!p.sprinting; pPose.surface = p.surface || 'sand'; pPose.reach = p.reach || ds * 0.6; pPose.waterDepth = p.waterDepth || 0;
    fxCtx.player = pPose;
    fxCtx.heightAt = level.heightAt;
    fxCtx.trail = typeof level.look?.trail === 'string' ? level.look.trail : null;
    fxCtx.confetti = tier.id === 'low' ? 36 : tier.id === 'medium' ? 70 : 110;
    fxCtx.waterLevel = p.inWater ? pv.y + (p.waterDepth || 0) : null;

    // camera
    camIn.x = pv.x; camIn.y = pv.y; camIn.z = pv.z;
    camIn.vx = p.vx || 0; camIn.vz = p.vz || 0; camIn.yaw = pv.yaw;
    camIn.size = ds; camIn.sprinting = !!p.sprinting; camIn.speedNorm = p.speedNorm || 0; camIn.airborne = !!p.airborne;
    camIn.reducedMotion = reduced; camIn.fovKick = S('fovKick', true) !== false;
    camIn.time = time; camIn.heightAt = level.heightAt; camIn.photo = photo; camIn.zoom = photo ? photoZoom : 1;
    camIn.slowMo = state.slowMo || 0;
    if (state.camHint && state.camHint.kind && state.camHint.t !== lastCamHintT) {
      if (lastCamHintT === -1 || state.camHint.t < lastCamHintT) rig.milestone();
      lastCamHintT = state.camHint.t;
    } else if (!state.camHint) lastCamHintT = -1;
    rig.update(camIn, photo ? dt : dt);
    const near = Math.min(2, Math.max(0.02, ds * 0.04));
    const far = Math.max(900, ds * 600, lighting.fog.far * 1.6);
    vPos.set(rig.pos.x, rig.pos.y, rig.pos.z);
    vLook.set(rig.look.x, rig.look.y, rig.look.z);
    setCamera(vPos, vLook, rig.fov, rig.roll, near, far);

    // world
    try { level.scenery.update?.(vdt, state); } catch (e) { /* tolerate */ }
    camera.updateMatrixWorld();
    const pxPerRad = viewH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    itemOpts.shapeCodes = !!S('shapeCodes', false);
    itemOpts.camX = camera.position.x; itemOpts.camY = camera.position.y; itemOpts.camZ = camera.position.z;
    itemOpts.pxPerRad = pxPerRad; itemOpts.cullPx = tier.id === 'low' ? 2.5 : tier.id === 'medium' ? 1.6 : 1;
    itemOpts.far = lighting.fog.far * 1.05;
    itemOpts.lodPx = tier.id === 'low' ? 16 : tier.id === 'medium' ? 11 : 7;
    level.items.sync(state.items, alpha, vdt, pPose, time, itemOpts);
    level.npcs.sync(state.npcs, alpha, dt, camera, pxPerRad, tier.npcCullPx);
    birds.sync(state.birds, alpha, 1);
    if (level.ghost) level.ghost.update(state.tick || 0, alpha, dt, null);

    // floating text: keep off the animal
    textCtx.playerRect = computePlayerRect(pv.x, pv.y, pv.z, ds);

    // time of day across the run, fog that grows with you, weather
    const dur = state.timeLeft != null && state.goals?.timer ? state.goals.timer : (world.goals?.timer || 300);
    const frac = Math.min(1, (state.time || 0) / Math.max(30, dur));
    levelOut.tod = timeOfDayAt(world.timeOfDay, frac);
    levelOut.size = ds;
    levelOut.fogScale = Math.min(60, Math.pow(Math.max(1, ds / Math.max(0.05, world.goals?.start || 0.25)), 0.6));
    const w = weatherOverride || state.weather || null;
    const wk = w ? w.kind : 'clear';
    const wi = w ? (w.intensity == null ? 1 : w.intensity) : 0;
    if (weather.kind !== wk) weather.set(wk, wi); else weather.set(wk, wi);
    levelOut.weatherFog = wk === 'fog' ? wi * 0.7 : wk === 'rain' ? wi * 0.25 : wk === 'snow' ? wi * 0.2 : 0;
    sky.uniforms.uAurora.value = wk === 'aurora' ? wi : (state.flags && state.flags.aurora ? 1 : 0);
    focus.x = pv.x; focus.y = pv.y; focus.z = pv.z;
    return levelOut;
  }

  function safeH(fn, x, z, fb) { const h = fn(x, z); return Number.isFinite(h) ? h : fb; }

  // ------------------------------------------------------------------ input
  function addLook(dx, dy) {
    if (kind === 'level') { camIn.lookDx += dx || 0; camIn.lookDy += dy || 0; }
    else if (kind === 'showroom' && showroomStage) showroomStage.addLook(dx || 0, dy || 0);
  }

  function getCameraYaw() {
    if (kind === 'level') return rig.yaw;
    camera.getWorldDirection(vTmp2);
    return Math.atan2(vTmp2.x, vTmp2.z);
  }

  // ------------------------------------------------------------------ photo mode
  let wheelHandler = null;
  function enterPhoto() {
    if (photo) return;
    photo = true;
    photoZoom = 1;
    if (overlay) overlay.style.visibility = 'hidden';
    wheelHandler = (e) => { photoZoom = Math.max(0.35, Math.min(3, photoZoom * Math.exp((e.deltaY || 0) * 0.0012))); };
    canvas?.addEventListener?.('wheel', wheelHandler, { passive: true });
  }
  function exitPhoto() {
    if (!photo) return;
    photo = false;
    photoFilter = 0;
    if (overlay) overlay.style.visibility = '';
    if (wheelHandler) canvas?.removeEventListener?.('wheel', wheelHandler);
    wheelHandler = null;
  }

  // ------------------------------------------------------------------ capture
  function screenshot() {
    try {
      // render and read back in the same task, so no preserveDrawingBuffer is needed
      frame(1, 0, level ? level.sim.state : null);
      return canvas.toDataURL('image/png');
    } catch (e) { console.warn('[render] screenshot failed', e); return null; }
  }

  // ------------------------------------------------------------------ boot
  applyTier(tierId);
  if (typeof window !== 'undefined') window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  return {
    THREE, renderer, scene, camera, mats,
    showScene,
    setLook(look) {
      if (!hero) return;
      heroLook = look;
      try { hero.view.setLook?.(look); } catch (e) { console.warn('[render] setLook', e); }
      if (level) level.look = look;
    },
    frame,
    getCameraYaw,
    addLook,
    floatingText: { add: (line) => floatingText.add(line) },
    enterPhoto, exitPhoto, isPhoto: () => photo,
    photo: {
      filters: PHOTO_FILTERS,
      get filter() { return PHOTO_FILTERS[photoFilter]; },
      setFilter(id) { const i = PHOTO_FILTERS.indexOf(id); photoFilter = i < 0 ? 0 : i; },
      cycleFilter(dir = 1) { photoFilter = (photoFilter + dir + PHOTO_FILTERS.length) % PHOTO_FILTERS.length; return PHOTO_FILTERS[photoFilter]; },
      zoom(f) { photoZoom = Math.max(0.35, Math.min(3, photoZoom * f)); },
    },
    screenshot,
    clip: {
      get supported() { return clip.supported; },
      start: () => clip.start(),
      save: () => clip.save(),
    },
    setQuality,
    get quality() { return tierId; },
    // testing and photo use: force a weather kind ('clear' | 'rain' | 'snow' | 'fog' | 'parade' | 'aurora' | 'datastorm'), null to follow the sim
    setWeatherOverride(kind, intensity = 1) { weatherOverride = kind ? { kind, intensity } : null; },
    stats() {
      statsOut.fps = fps; statsOut.drawCalls = lastDraw; statsOut.triangles = lastTris; statsOut.frameMs = frameMs;
      statsOut.cpuMs = cpuMs; statsOut.tier = tierId; statsOut.particles = particles.alive(); statsOut.weather = weather.count;
      statsOut.itemTypes = level ? level.items.layerCount : 0; statsOut.npcs = level ? level.npcs.count : 0; statsOut.scene = kind;
      return statsOut;
    },
    resize,
    dispose() {
      exitPhoto();
      clip.stop();
      disposeLevel();
      clearStage();
      titleStage?.dispose(); showroomStage?.dispose();
      if (hero) { try { hero.view.dispose?.(); } catch { /* ignore */ } }
      effects.dispose(); particles.dispose(); weather.dispose(); birds.dispose(); sky.dispose();
      floatingText.dispose(); post.dispose(); mats.dispose();
      blobGeo.dispose(); blobMat.dispose();
      if (unsub) unsub();
      renderer.dispose();
    },
  };
}

// When WebGL is missing entirely: keep the API so the UI still works.
function createNullRenderer(canvas) {
  const noop = () => {};
  return {
    THREE, renderer: null, scene: null, camera: null, mats: null,
    showScene: noop, setLook: noop, frame: noop, getCameraYaw: () => 0, addLook: noop,
    floatingText: { add: noop }, enterPhoto: noop, exitPhoto: noop, isPhoto: () => false,
    photo: { filters: ['none'], filter: 'none', setFilter: noop, cycleFilter: () => 'none', zoom: noop },
    screenshot: () => null, clip: { supported: false, start: noop, save: async () => null },
    setQuality: noop, quality: 'low', stats: () => ({ fps: 0, drawCalls: 0, triangles: 0, frameMs: 0 }), resize: noop, dispose: noop,
  };
}
