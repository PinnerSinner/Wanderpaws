// Procedural animal rig (Node-importable, no three).
//
//   const rig = createRig(species);
//   rig.update(player, dt);   // player = sim.state.player (CONTRACTS §3.3) or a fake one
//   rig.pose                  // preallocated: pose.list[i] matches rig.skeleton.bones[i]
//
// pose.list[i] = { px,py,pz, rx,ry,rz, sx,sy,sz }: offsets from the bone's rest
// position, rotations added to its rest rotation (Euler, bone order), scale.
// pose.bones[name] is the same object by name. pose.fx holds extra numbers for
// the view (glow, LED phase, colour shift, shake intensity...).

import { getSpecies } from '../species.js';
import { getPlan, buildSkeleton } from './plans.js';
import { createCore, updateCore } from './core.js';
import { createPose, resetPose } from './pose.js';
import { createQuadruped } from './quadruped.js';
import { createHopper } from './hopper.js';
import { createWaddler } from './waddler.js';
import { createShelled } from './shelled.js';
import { createSerpent } from './serpent.js';
import { createTentacle } from './tentacle.js';

const SOLVERS = {
  quadruped: createQuadruped,
  hopper: createHopper,
  waddler: createWaddler,
  shelled: createShelled,
  serpent: createSerpent,
  tentacle: createTentacle,
};

const skelCache = new Map();
export function getSkeleton(speciesId) {
  if (!skelCache.has(speciesId)) skelCache.set(speciesId, buildSkeleton(getPlan(speciesId)));
  return skelCache.get(speciesId);
}

export function createRig(speciesOrId) {
  const species = typeof speciesOrId === 'string' ? getSpecies(speciesOrId) : (speciesOrId || getSpecies('oli'));
  const plan = getPlan(species.id);
  const skeleton = getSkeleton(species.id);
  const pose = createPose(skeleton);
  const core = createCore(species, plan);
  const make = SOLVERS[plan.archetype] || createQuadruped;
  const solver = make(core, plan, skeleton, pose);
  const rig = {
    species, plan, skeleton, pose, core,
    archetype: plan.archetype,
    update(player, dt) {
      updateCore(core, player, dt);
      resetPose(pose);
      solver.update(core.dt, player);
      return pose;
    },
    setEmotion(e) { core.emoOverride = e || null; },
    reset() { solver.reset && solver.reset(); },
    solver,
  };
  return rig;
}

export { getPlan, buildSkeleton };
