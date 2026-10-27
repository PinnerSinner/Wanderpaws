// World-meshes: every item, scenery piece, terrain, water body and human.
// Render-side (imports nothing from three itself: THREE is passed in, so the
// registries below can be checked in Node without WebGL).
//
// API (CONTRACTS.md §4.3):
//   buildItemMesh(THREE, mats, typeId)        -> Object3D, normalised (see items/index.js)
//   buildSceneryMesh(THREE, mats, id, params) -> Object3D at real-metre dims
//   buildScenery(THREE, mats, world)          -> { group, update(dt, simState), dispose() }
//   buildHuman(THREE, mats, kind, opts?)      -> { object3d, update(npc, dt), dispose() }
//
// Registries (for tests and tools): ITEM_BUILDERS, SCENERY_BUILDERS, HUMAN_KINDS.

export { buildItemMesh, ITEM_BUILDERS, normaliseItem, buildItemBuilder } from './items/index.js';
export { buildSceneryMesh, SCENERY_BUILDERS } from './scenery/index.js';
export { buildScenery } from './world.js';
export { buildHuman, HUMAN_KINDS, HUMAN_DESIGNS } from './humans.js';
