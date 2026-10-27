// Animal views (render-side, imports nothing from three directly: THREE is
// passed in, per CONTRACTS §2.2).
//
//   createAnimalView({ THREE, mats, species, look, quality }) -> {
//     object3d, update(player, dt), setLook(look), setEmotion(e), dispose(),
//     rig, attach (slot points), stats() -> { drawCalls, triangles }
//   }
//
// Each animal is ONE SkinnedMesh (vertex colours, markings painted in) plus
// its outline, with accessory meshes parented to bones. Origin at the feet,
// facing +Z, unit size 1: the renderer scales object3d by the player size.

import { getSpecies } from '../species.js';
import { createRig } from '../rig/index.js';
import { mergeLook, validateLook } from '../customise.js';
import { createBuilder, paintLook } from './builder.js';
import { makeShapes } from './shapes.js';
import { buildQuadruped } from './bodies/quadruped.js';
import { buildHopper } from './bodies/hopper.js';
import { buildWaddler } from './bodies/waddler.js';
import { buildShelled } from './bodies/shelled.js';
import { buildSerpent } from './bodies/serpent.js';
import { buildTentacle } from './bodies/tentacle.js';
import { createAccessories } from './accessories.js';
import { createDecal } from './decal.js';
export { createCritterView } from './critters.js';

const BUILDERS = { quadruped: buildQuadruped, hopper: buildHopper, waddler: buildWaddler, shelled: buildShelled, serpent: buildSerpent, tentacle: buildTentacle };
const QUALITY = { low: 0.6, medium: 0.85, med: 0.85, high: 1, ultra: 1.15 };

// Geometry cache per species and quality: building is the slow part, and the
// colour attribute is cloned per view so looks stay independent.
const geoCache = new Map();

export function createAnimalView({ THREE, mats, species, look, quality = 'high' } = {}) {
  const sp = species && species.id ? species : getSpecies(species);
  const rig = createRig(sp);
  const skel = rig.skeleton;
  const q = QUALITY[quality] || 1;
  const S = makeShapes(THREE);

  const group = new THREE.Group();
  group.name = `animal:${sp.id}`;
  const bones = skel.bones.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bone.position.set(b.pos[0], b.pos[1], b.pos[2]);
    bone.rotation.set(b.rot[0], b.rot[1], b.rot[2], b.order);
    return bone;
  });
  skel.bones.forEach((b, i) => { if (b.parent >= 0) bones[b.parent].add(bones[i]); });
  bones[0].updateMatrixWorld(true);

  const key = sp.id + '|' + q;
  let built = geoCache.get(key);
  let ctx;
  if (!built) {
    const B = createBuilder(THREE, bones);
    ctx = (BUILDERS[rig.archetype] || buildQuadruped)(THREE, S, B, bones, rig.plan, sp, q);
    const out = B.build();
    built = { geometry: out.geometry, info: out.info, ctx };
    geoCache.set(key, built);
  }
  ctx = built.ctx;
  const geometry = built.geometry.clone();
  geometry.setAttribute('color', built.geometry.getAttribute('color').clone());
  const r = geometry.boundingSphere ? geometry.boundingSphere.radius : 1;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.4, 0), Math.max(r * 1.6, 1.2));

  const material = mats.toon('#ffffff', { vertexColors: true });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'animal-body';
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.add(bones[0]);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  group.add(mesh);
  const outlineThick = 0.009 * (sp.id === 'elephant' ? 1.2 : 1);
  try { if (mats.outline) mats.outline(mesh, outlineThick); } catch (e) { /* outline is optional */ }

  // extra glowing bits (router-cat LEDs, chill aura) live in a small add-on
  const extras = createExtras(THREE, mats, sp, bones, skel, rig, ctx);
  if (extras.object) group.add(extras.object);

  let curLook = mergeLook(sp, look);
  paintLook(geometry, built.info, curLook, ctx.pattern);
  const acc = createAccessories(THREE, mats, S, bones, skel, ctx.attach, sp);
  acc.set(curLook);
  const decal = createDecal(THREE, mats, bones, ctx.attach, sp);
  decal.set(curLook.decal);

  const list = rig.pose.list;
  const rest = skel.bones;
  function applyPose() {
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i], x = list[i], rb = rest[i];
      b.position.set(rb.pos[0] + x.px, rb.pos[1] + x.py, rb.pos[2] + x.pz);
      b.rotation.set(rb.rot[0] + x.rx, rb.rot[1] + x.ry, rb.rot[2] + x.rz);
      b.scale.set(x.sx, x.sy, x.sz);
    }
  }

  const view = {
    object3d: group,
    rig,
    species: sp,
    get look() { return curLook; },
    attach: ctx.attach,
    update(player, dt) {
      rig.update(player, dt);
      applyPose();
      extras.update(rig.pose, dt);
      acc.update(rig.pose, dt);
    },
    setLook(l) {
      const next = validateLook(mergeLook(sp, l), sp.defaults);
      paintLook(geometry, built.info, next, ctx.pattern);
      acc.set(next);
      if (next.decal !== curLook.decal) decal.set(next.decal);
      curLook = next;
      extras.setLook && extras.setLook(next);
    },
    setEmotion(e) { rig.setEmotion(e); },
    stats() {
      let calls = 0, tris = 0;
      group.traverse((o) => {
        if (o.isMesh && o.visible) {
          calls++;
          const g = o.geometry;
          tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3 * (o.isInstancedMesh ? o.count : 1);
        }
      });
      return { drawCalls: calls, triangles: Math.round(tris) };
    },
    dispose() {
      geometry.dispose();
      acc.dispose();
      decal.dispose();
      extras.dispose();
      group.removeFromParent();
    },
  };
  // settle into the rest pose straight away (no pop on the first frame)
  view.update({ displaySize: 1, grounded: true, emotion: 'happy' }, 1 / 60);
  return view;
}

function createExtras(THREE, mats, sp, bones, skel, rig, ctx) {
  const parts = [];
  let object = null;
  const idx = (n) => skel.index[n];
  if (sp.id === 'routercat') {
    object = new THREE.Group();
    // LED dots along the router saddle plus antenna tips
    const geo = new THREE.SphereGeometry(0.011, 8, 6);
    const ledMat = mats.glow ? mats.glow('#5ef0c2') : new THREE.MeshBasicMaterial({ color: '#5ef0c2' });
    const inst = new THREE.InstancedMesh(geo, ledMat, 4);
    const m = new THREE.Matrix4();
    const plan = rig.plan;
    for (let i = 0; i < 4; i++) { m.makeTranslation(-0.045 + i * 0.03, 0.15 * 0 + plan.bodyY * 0 + 0.0, 0.05); inst.setMatrixAt(i, m); }
    inst.instanceMatrix.needsUpdate = true;
    const body = bones[idx('body')];
    const holder = new THREE.Group();
    holder.position.set(0, 0.15 + 0.0, -0.02);
    holder.add(inst);
    body.add(holder);
    parts.push({ kind: 'leds', inst, holder, m });
    inst.frustumCulled = false;
  }
  if (sp.signature?.kind === 'chillAura' || sp.signature?.kind === 'wifiPurr') {
    object = object || new THREE.Group();
    const g = new THREE.TorusGeometry(0.6, 0.012, 6, 48);
    g.rotateX(Math.PI / 2);
    const mat = mats.glow ? mats.glow(sp.signature.kind === 'chillAura' ? '#bff2c8' : '#5ef0c2') : new THREE.MeshBasicMaterial({ color: '#bff2c8' });
    const ring = new THREE.Mesh(g, mat);
    ring.position.y = 0.05;
    ring.visible = false;
    object.add(ring);
    parts.push({ kind: 'aura', ring });
  }
  let t = 0;
  return {
    object,
    update(pose, dt) {
      t += dt;
      for (const p of parts) {
        if (p.kind === 'leds') {
          const rate = pose.fx.ledRate || 1;
          for (let i = 0; i < 4; i++) {
            const on = Math.sin(pose.fx.led * 9 + i * 1.7) > -0.2 || pose.fx.glow > 0.5;
            const s = on ? 1 + pose.fx.glow * 0.6 : 0.001;
            p.m.makeScale(s, s, s).setPosition(-0.045 + i * 0.03, 0, 0.0);
            p.inst.setMatrixAt(i, p.m);
          }
          void rate;
          p.inst.instanceMatrix.needsUpdate = true;
        } else if (p.kind === 'aura') {
          const a = Math.max(pose.fx.aura || 0, pose.fx.signal || 0);
          p.ring.visible = a > 0.02;
          if (p.ring.visible) {
            const s = 0.4 + a * 0.8 + 0.12 * ((t * 0.8) % 1);
            p.ring.scale.set(s, 1, s);
          }
        }
      }
    },
    dispose() { for (const p of parts) { if (p.inst) p.inst.geometry.dispose(); if (p.ring) p.ring.geometry.dispose(); } },
  };
}
