// Scenery registry: one builder per SCENERY id, at real-metre dims.
// A builder is fn(b, ctx) that fills the Builder b; it may also push extra
// Object3Ds into ctx.extras and register per-frame animation via ctx.anim(fn).
//   ctx = { THREE, mats, params, palette, extras, anim(fn(dt, simState, time)), text(key, fallback) }
// Strip ids (wavepavement, road...) read params.w / params.d (metres) and
// params.groundAt(lx, lz) (height offset from the base) so they hug the terrain.
import { createBuilder, layerMaterial } from '../kit.js';
import { t } from '../../../core/copy/index.js';
import { shared } from './shared.js';
import { w1 } from './w1.js';
import { w2 } from './w2.js';
import { w3 } from './w3.js';
import { w4 } from './w4.js';
import { w5 } from './w5.js';

export const SCENERY_BUILDERS = { ...shared, ...w1, ...w2, ...w3, ...w4, ...w5 };
export const STRIP_IDS = new Set(['wavepavement', 'avenue', 'cyclelane', 'road', 'pavement', 'binarypavement', 'cableriver', 'pond']);
// ids whose geometry depends on params, so they are built per entry rather than instanced
export const PARAM_IDS = new Set([...STRIP_IDS, 'bunting', 'ropebridge', 'skiliftline', 'plaque', 'dnssign', 'subnetsign']);

const _backdrop = new WeakMap();
// Distant backdrops ignore fog (they are pre-tinted towards the horizon instead),
// so the Sugarloaf and the mountains stay visible beyond the fog distance.
export function backdropMaterial(THREE, mats) {
  let m = _backdrop.get(mats);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    m.name = 'wm-backdrop';
    _backdrop.set(mats, m);
  }
  return m;
}

export function sceneryMaterial(THREE, mats, name, map, opts) {
  if (name === 'backdrop') return backdropMaterial(THREE, mats);
  return layerMaterial(THREE, mats, name, map, opts);
}

function textFor(key, fallback) {
  if (!key) return fallback;
  const s = t(key);
  return s && s !== key ? s : fallback;
}

export function buildSceneryMesh(THREE, mats, id, params = {}) {
  const fn = SCENERY_BUILDERS[id];
  const b = createBuilder(THREE);
  const extras = [];
  const anims = [];
  const ctx = {
    THREE, mats, params, palette: params.palette || {}, extras,
    anim: (f) => anims.push(f),
    text: (key, fallback) => textFor(key, fallback),
  };
  if (fn) fn(b, ctx);
  else b.box(2, 2, 2, '#ff9ec7', { y: 1, r: 0.3 }); // visible stand-in for a new id
  const group = b.toGroup(mats, (name, map, opts) => sceneryMaterial(THREE, mats, name, map, opts));
  for (const e of extras) group.add(e);
  group.name = 'scenery:' + id;
  group.userData.sceneryId = id;
  group.userData.triangles = b.triangles();
  group.userData.fallback = !fn;
  if (anims.length) {
    let time = 0;
    group.userData.update = (dt, simState) => {
      time += dt;
      const tt = simState && Number.isFinite(simState.time) ? simState.time : time;
      for (let i = 0; i < anims.length; i++) anims[i](dt, simState, tt);
    };
  }
  return group;
}
