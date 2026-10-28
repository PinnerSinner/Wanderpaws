// Actors: the hero animal (player, title, showroom), NPC views (humans and
// critters) and the translucent ghost. All tolerant of stub views.

import { interpEntity } from './pure/interp.js';
import { sampleGhost, isGhost } from './pure/ghost.js';

// A full §3.3 player-shaped object for menus, the ghost and fallbacks.
export function makeFakePlayer(size = 1) {
  return {
    x: 0, y: 0, z: 0, yaw: 0, px: 0, py: 0, pz: 0, pyaw: 0,
    vx: 0, vy: 0, vz: 0, speed: 0, speedNorm: 0,
    size, displaySize: size,
    grounded: true, airborne: false, inWater: false, waterDepth: 0, surface: 'sand',
    sprinting: false, turnRate: 0, landImpact: 0, gulp: 0, stagger: 0,
    sig: { kind: null, active: false, t: 0, cooldownLeft: 0, ready: true, aimYaw: 0, power: 0 },
    emotion: 'happy', idleTime: 0, idleAnim: null,
    barkT: 99, playBow: false, shakeT: 0,
    buffs: { tea: 0, wobble: 0, speed: 0 },
    combo: { count: 0, mult: 1, timer: 0 },
    reach: size * 0.6,
  };
}

// Copy the sim player into `out` with interpolated pose. No allocation after the first call.
export function interpPlayer(p, alpha, out, tmp) {
  for (const k in p) out[k] = p[k];
  interpEntity(p, alpha, tmp);
  out.x = tmp.x; out.y = tmp.y; out.z = tmp.z; out.yaw = tmp.yaw;
  return out;
}

export function setShadows(obj, cast, receive) {
  obj.traverse((o) => {
    if (o.isMesh && !o.userData.gpOutline) { o.castShadow = cast; o.receiveShadow = receive; }
  });
}

// ---------------------------------------------------------------- NPCs
export function createNpcLayer(THREE, { mats, buildHuman, createCritterView, humanKinds, critterKinds }) {
  const group = new THREE.Group();
  group.name = 'gp-npcs';
  const views = new Map(); // id -> { view, kind, human, stamp, height, x, z }
  const tmp = { x: 0, y: 0, z: 0, yaw: 0 };
  const hk = new Set(humanKinds || []);
  const ck = new Set(critterKinds || []);
  let stamp = 0;
  let shadows = false;
  const v = new THREE.Vector3();

  function make(npc) {
    const kind = npc.kind || 'pigeon';
    const human = npc.human !== undefined ? !!npc.human : hk.has(kind);
    let view = null;
    try {
      if (human && buildHuman) view = buildHuman(THREE, mats, kind);
      else if (createCritterView) view = createCritterView({ THREE, mats, kind });
    } catch (e) { console.warn('[render] npc view failed', kind, e); }
    if (!view || !view.object3d) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 3, 8), mats.toon('#c7a0ff'));
      m.position.y = 0.4; g.add(m);
      view = { object3d: g, update() {}, dispose() { m.geometry.dispose(); } };
    }
    setShadows(view.object3d, shadows, false);
    mats.sanitize?.(view.object3d);
    group.add(view.object3d);
    const box = new THREE.Box3().setFromObject(view.object3d);
    const height = Number.isFinite(box.max.y) ? Math.max(0.2, box.max.y - Math.min(0, box.min.y)) : (human ? 1.8 : 0.5);
    const rec = { view, kind, human, stamp, height, x: npc.x, y: npc.y, z: npc.z };
    views.set(npc.id, rec);
    return rec;
  }

  // npcs: state.npcs; camera for culling; px: pixels per metre at distance 1
  function sync(npcs, alpha, dt, camera, pxPerRad, cullPx) {
    stamp++;
    if (npcs) {
      for (let i = 0; i < npcs.length; i++) {
        const n = npcs[i];
        if (!n || n.id == null) continue;
        let r = views.get(n.id);
        if (n.visible === false) { if (r) { r.stamp = stamp; r.view.object3d.visible = false; } continue; }
        if (!r) r = make(n);
        r.stamp = stamp;
        interpEntity(n, alpha, tmp);
        if (n.py === undefined) tmp.y = n.y ?? 0;
        r.x = tmp.x; r.y = tmp.y; r.z = tmp.z;
        const o = r.view.object3d;
        // cull tiny or far actors (saves draw calls when the player is huge)
        const d = v.set(tmp.x - camera.position.x, tmp.y - camera.position.y, tmp.z - camera.position.z).length();
        const px = (r.height / Math.max(0.01, d)) * pxPerRad;
        const vis = px > cullPx && d < camera.far;
        o.visible = vis;
        if (!vis) continue;
        try { r.view.update(n, dt); } catch (e) { /* tolerate stub errors */ }
        o.position.set(tmp.x, tmp.y, tmp.z);
        o.rotation.y = tmp.yaw;
      }
    }
    for (const [id, r] of views) {
      if (r.stamp !== stamp) { group.remove(r.view.object3d); try { r.view.dispose?.(); } catch { /* ignore */ } views.delete(id); }
    }
  }

  function find(id, out) {
    const r = views.get(id);
    if (!r) return false;
    out.x = r.x; out.y = r.y + r.height * 1.08; out.z = r.z;
    return true;
  }

  function clear() {
    for (const r of views.values()) { group.remove(r.view.object3d); try { r.view.dispose?.(); } catch { /* ignore */ } }
    views.clear();
  }

  return {
    group, sync, find, clear,
    setShadows(on) { shadows = on; for (const r of views.values()) setShadows(r.view.object3d, on, false); },
    get count() { return views.size; },
  };
}

// ---------------------------------------------------------------- ghost
export function createGhost(THREE, { mats, createAnimalView, species, look, samples }) {
  if (!isGhost(samples) || !createAnimalView) return null;
  let view;
  try { view = createAnimalView({ THREE, mats, species, look, quality: 'low' }); } catch { return null; }
  const mat = new THREE.ShaderMaterial({
    name: 'gp-ghost',
    uniforms: { uCol: { value: new THREE.Color('#d8f0ff') }, uTime: mats.uniforms.time },
    vertexShader: /* glsl */`
#include <common>
#include <skinning_pars_vertex>
varying vec3 vN; varying vec3 vV;
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vN = normalize( normalMatrix * objectNormal ); vV = -mvPosition.xyz;
}`,
    fragmentShader: /* glsl */`
#include <common>
uniform vec3 uCol; uniform float uTime; varying vec3 vN; varying vec3 vV;
void main() {
  float f = 1.0 - abs( dot( normalize( vN ), normalize( vV ) ) );
  float a = 0.12 + pow( f, 2.0 ) * 0.55;
  gl_FragColor = vec4( uCol * ( 0.8 + f ), a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false,
  });
  const apply = () => view.object3d.traverse((o) => {
    if (o.isMesh) { if (o.userData.gpOutline) o.visible = false; else { o.material = mat; o.castShadow = false; o.receiveShadow = false; } }
  });
  apply();
  const fp = makeFakePlayer(0.25);
  const g = { x: 0, y: 0, z: 0, yaw: 0, size: 0.25, speed: 0, done: false };
  return {
    object3d: view.object3d,
    update(tick, alpha, dt, refSpeed) {
      sampleGhost(samples, tick + alpha, g);
      fp.px = fp.x; fp.pz = fp.z; fp.py = fp.y; fp.pyaw = fp.yaw;
      fp.x = g.x; fp.y = g.y; fp.z = g.z; fp.yaw = g.yaw;
      fp.size = fp.displaySize = Math.max(0.02, g.size);
      fp.speed = g.speed;
      fp.vx = Math.sin(g.yaw) * g.speed; fp.vz = Math.cos(g.yaw) * g.speed;
      fp.speedNorm = Math.min(1, g.speed / Math.max(0.1, refSpeed || fp.size * 8));
      fp.idleTime = g.speed < 0.01 ? fp.idleTime + dt : 0;
      const o = view.object3d;
      o.visible = !g.done;
      o.position.set(g.x, g.y, g.z);
      o.rotation.y = g.yaw;
      o.scale.setScalar(fp.displaySize);
      try { view.update(fp, dt); } catch { /* ignore */ }
      return g;
    },
    reapply: apply,
    dispose() { try { view.dispose(); } catch { /* ignore */ } mat.dispose(); },
  };
}
