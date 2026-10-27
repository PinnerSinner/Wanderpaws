// W3 Tijuca Rainforest. Afternoon, dappled light. 500 x 400 m.
//
// Layout: a river valley running west to east.
//   west (x < -180)   a plateau with a river that pours off the cliff as THE WATERFALL into a
//                     plunge pool; behind the water, a cave (1.8 m lip: you must be 4 m) with
//                     the golden mango. A gentle ramp climbs to the plateau on the north side.
//   the valley        the river winds east; a ford of slippery stepping stones (x -100), a sagging
//                     rope bridge (x 0) with the trailhead and spawn on the north bank, a giant leaf
//                     slide down the north slope, the jaguar statue, a sloth, a butterfly glade
//   east              the lily lake: lily pads that play a tune, Seu Zé's açaí cart, picnics, kayaks
//   north-east ridge  the lookout over the city (Rio's skyline on the horizon), with Auntie Pru
//   south-west        a grove ringed by buttress roots: a 1 m gap for small animals, a 3.2 m root
//                     the giants can step over

import { box, cyl, scen, span, wall, gappedWall, at, ring, cluster, sstep, lerp, hill, ellipse01, pathDist, PI, HALF_PI } from './util.js';
import { settleAnchors } from './layout.js';
import { makeEggsW3, LILY_ZONES } from './eggs/w3.js';

const PLATEAU = 22;
export const riverZ = (x) => 18 * Math.sin((x + 180) / 60);

export const P = {
  spawn: { x: -15, z: 30 },
  pool: { x: -170, z: 0 },
  cave: { x: -190, z: 0 },
  ford: { x: -100 },
  bridge: { x: 0 },
  lake: { x: 160, z: -10, rx: 48, rz: 38 },
  ze: { x: 150, z: 34 },
  lookout: { x: 110, z: 152 },
  trailmap: { x: -11, z: 35 },
  jaguar: { x: 45, z: 40 },
  sloth: { x: -50, z: -32 },
  glade: { x: -80, z: -62 },
  hammock: { x: 30, z: -42 },
  router5g: { x: 70, z: -46 },
  grove: { x: -120, z: -120 },
  slideTop: { x: -62, z: 98 }, slideEnd: { x: -30, z: 55 },
  lilyPrize: { x: 162, z: -12 },
  pads: [[150, -22, 1.6], [161, -30, 1.4], [173, -21, 1.2], [176, -7, 1.0], [164, 2, 0.8]],
  toucan: { x: 60, z: 12 },
  marmoset: { x: 168, z: 46 },
};
P.bridge.z = riverZ(0);
P.ford.z = riverZ(-100);

const TRAIL = [[-150, 60], [-90, 45], [-40, 38], [-15, 30], [0, 18], [0, P.bridge.z], [0, -14], [30, -30], [70, -40], [115, -35]];
const TRAIL_N = [[-15, 30], [20, 36], [45, 40], [80, 60], [100, 100], [110, 145]];
const TRAIL_LAKE = [[45, 40], [100, 38], [130, 34], [170, 40]];

function valley(x, z) {
  const dz = Math.abs(z - riverZ(x));
  let h;
  if (dz < 5) h = -1.6;
  else if (dz < 9) h = lerp(-1.6, 1.0, sstep(5, 9, dz));
  else { const e = dz - 9; h = 1 + 0.06 * e + 0.0006 * e * e; }
  h += 2.2 * Math.sin(x * 0.031) * Math.sin(z * 0.043 + 0.5) * sstep(10, 30, dz);
  return h;
}

function heightAt(x, z) {
  let h = valley(x, z);
  // ford: shallow stones
  if (Math.abs(x - P.ford.x) < 5) h = Math.max(h, lerp(h, -0.35, 1 - sstep(3, 5, Math.abs(x - P.ford.x))));
  // raised banks at the rope bridge so the deck meets the ground
  h += hill(x, z, 0, P.bridge.z - 19, 14, 3.6) + hill(x, z, 0, P.bridge.z + 19, 14, 3.6);
  // the deck (sagging) over the gorge
  if (Math.abs(x) < 1.3 && Math.abs(z - P.bridge.z) < 15) {
    const u = (z - P.bridge.z) / 15;
    h = Math.max(h, 4.6 - 1.1 * (1 - u * u));
  }
  // the lookout ridge
  h += hill(x, z, P.lookout.x, P.lookout.z - 4, 46, 9);
  // the leaf slide chute: a smooth groove
  const ds = pathDist(x, z, [[P.slideTop.x, P.slideTop.z], [P.slideEnd.x, P.slideEnd.z]]);
  if (ds < 4) h -= 0.6 * (1 - ds / 4);
  // the lily lake
  const e = ellipse01(x, z, P.lake.x, P.lake.z, P.lake.rx, P.lake.rz, 0.3);
  if (e > 0) h = lerp(h, -2.2, e);
  // the plunge pool
  const pp = ellipse01(x, z, P.pool.x, P.pool.z, 12, 14, 0.4);
  if (pp > 0) h = lerp(h, -2.5, pp);
  // plateau: a cliff in the south, a gentle ramp in the north
  const northness = sstep(38, 50, z);
  const cliff = sstep(-180, -187, x);
  const ramp = sstep(-118, -186, x);
  const pf = lerp(cliff, ramp, northness);
  if (pf > 0) {
    let top = PLATEAU;
    if (Math.abs(z) < 6 && x < -181) top = lerp(PLATEAU - 1.6, PLATEAU, sstep(3.5, 6, Math.abs(z))); // upper river channel
    h = lerp(h, top, pf);
  }
  // the cave behind the waterfall
  if (x > -198 && x < -180.5 && Math.abs(z) < 5) h = 1.0;
  return h;
}

function surfaceAt(x, z) {
  if (x > -198 && x < -180.5 && Math.abs(z) < 5) return 'rock';
  if (Math.abs(x) < 1.3 && Math.abs(z - P.bridge.z) < 15) return 'wood';
  const dz = Math.abs(z - riverZ(x));
  if (x > -182 && x < 115 && dz < 9) return 'rock';
  if (x < -180) return Math.abs(z) < 7 ? 'rock' : 'grass';
  if (pathDist(x, z, [[P.slideTop.x, P.slideTop.z], [P.slideEnd.x, P.slideEnd.z]]) < 3.5) return 'leaves';
  if (pathDist(x, z, TRAIL) < 1.8 || pathDist(x, z, TRAIL_N) < 1.8 || pathDist(x, z, TRAIL_LAKE) < 1.8) return 'leaves';
  if (Math.hypot(x - P.lookout.x, z - P.lookout.z) < 7) return 'wood';
  const e = ellipse01(x, z, P.lake.x, P.lake.z, P.lake.rx + 6, P.lake.rz + 6, 0.2);
  if (e > 0.5) return 'sand';
  return 'grass';
}

// ---- colliders ------------------------------------------------------------
const bigTrees = [
  [-60, 40], [-30, 60], [20, 60], [60, 70], [-90, 80], [-130, 30], [-140, -40], [-80, -30], [-20, -50], [40, -60], [90, -70],
  [120, 70], [60, 110], [150, 90], [200, 60], [210, -60], [120, -80], [-40, 120], [10, 140], [-160, 110], [-200, 120], [-210, -80],
  [-60, -100], [20, -110], [80, -120], [160, 150], [-100, 150], [72, -48], [26, -40], [36, -44], [-48, -34],
];
const colliders = [
  // the cave: walls and the 1.8 m lip
  box(-189, 5.6, 18, 1.2, 20), box(-189, -5.6, 18, 1.2, 20), box(-198.6, 0, 1.2, 12.4, 20),
  box(-181.4, 0, 1.0, 10, 1.8),
  // rope bridge side ropes (step over them and you're in the river)
  box(-1.4, P.bridge.z, 0.12, 30, 1.2), box(1.4, P.bridge.z, 0.12, 30, 1.2),
  // the buttress-root grove: 1 m gap to the east, a 3.2 m root to the north
  wall(-140, -140, -100, -140, 6, 1.2),
  wall(-140, -140, -140, -100, 6, 1.2),
  wall(-140, -100, -100, -100, 3.2, 1.2),
  ...gappedWall(-100, -100, -100, -140, 6, 1.0, 0.5, 1.2),
  // lookout deck rails and the açaí cart
  box(P.ze.x, P.ze.z + 1.6, 3, 2, 2.6),
  ...bigTrees.map(([x, z]) => cyl(x, z, 1.4, 22)),
];

// ---- scenery ------------------------------------------------------------
const scenery = [
  scen('waterfall', -181, 0, HALF_PI, 1, { y: 0 }),
  scen('cliff', -192, -32, HALF_PI, [1.4, 1, 1]), scen('cliff', -192, 34, HALF_PI, [1.2, 1, 1]),
  { ...span('ropebridge', 0, P.bridge.z - 15, 0, P.bridge.z + 15, 24), params: { y0: 4.6, y1: 4.6 } },
  scen('trailmap', P.trailmap.x, P.trailmap.z, PI),
  scen('jaguarstatue', P.jaguar.x, P.jaguar.z, -HALF_PI),
  scen('lookoutdeck', P.lookout.x, P.lookout.z, PI),
  scen('citybackdrop', 60, 700, PI),
  scen('coconutstall', P.ze.x, P.ze.z + 1.6, PI, 1, { params: { variant: 'acai' } }),
  ...P.pads.map(([x, z, s], i) => scen('lilypad', x, z, i, s)),
  ...[-104, -101, -98, -95].map((x, i) => scen('rock', x, P.ford.z + (i % 2 ? 1.5 : -1.5), i, 0.5)),
  ...bigTrees.map(([x, z], i) => scen('jungletree', x, z, i * 0.9, 0.8 + (i % 4) * 0.1)),
  ...[[-20, 20], [10, 26], [-45, 45], [35, 30], [70, 30], [-75, 60], [100, 20], [-110, 20], [130, 60], [-60, -60],
    [-100, -60], [-70, -80], [10, -70], [60, -80], [140, -60], [190, 20], [85, 45], [90, 55], [90, 65], [90, 75], [90, 85]].map(([x, z], i) => scen('fern', x, z, i, 1 + (i % 3) * 0.3)),
  ...[[-60, 22], [20, 62], [-140, -38], [120, 72], [-40, 118], [72, -46], [-50, -32]].map(([x, z], i) => scen('vine', x + 1.5, z, i)),
  ...[[-150, 5], [-120, 30], [-60, 30], [60, -15], [100, -30], [-160, -20], [-190, 20], [-185, -20]].map(([x, z], i) => scen('rock', x, z, i, 1.4)),
  scen('rock', -140, -100, 0, 1.6), scen('rock', -100, -140, 1, 1.6), // grove corners (roots)
];

// ---- items ------------------------------------------------------------------
const anchors = [
  // trailhead around spawn: snacks from the hikers, nuts from the trees
  ...cluster(['brazilnut', 'mango', 'acai', 'brazilnut', 'bananas', 'binoculars', 'brazilnut'], -12, 28, 6, 26, 'w3spawn'),
  at('hikingboot', -18, 25), at('rucksack', -8, 26), at('jackfruit', -20, 33), at('teamug', -10, 33),
  // the cave: the golden mango and a cosy stash
  at('mango', P.cave.x - 2, P.cave.z, { golden: true }),
  ...cluster(['mango', 'brazilnut', 'bananas', 'bromeliad'], P.cave.x, P.cave.z, 3, 8, 'cave'),
  // plunge pool and the river: ducks, kayak, paddles
  at('rubberduck', -168, 3), at('rubberduck', -60, riverZ(-60)), at('rubberduck', 40, riverZ(40)), at('rubberduck', 90, riverZ(90)),
  at('kayak', -150, riverZ(-150) + 8, { rot: 0.3 }), at('paddle', -146, riverZ(-146) + 9),
  ...[-150, -120, -60, -20, 30, 60, 100].map((x, i) => at('boulder', x, riverZ(x) + (i % 2 ? 11 : -11))),
  // the bridge works: spare sections
  at('bridgesection', 12, P.bridge.z + 26, { rot: HALF_PI }), at('bridgesection', -12, P.bridge.z - 26, { rot: HALF_PI }),
  at('signpost', 4, P.bridge.z + 17), at('signpost', -4, P.bridge.z - 17),
  // trail clusters
  ...TRAIL.filter(([x, z]) => Math.abs(z - riverZ(x)) > 10).flatMap(([x, z], i) => cluster(['brazilnut', 'acai', 'mango', 'hikingboot', 'bananas'], x, z, 5, 6, `trail${i}`)),
  ...TRAIL_N.flatMap(([x, z], i) => cluster(['brazilnut', 'binoculars', 'bananas', 'bromeliad'], x, z, 5, 5, `trailn${i}`)),
  // leaf slide: a pile of leaves (and mangoes) at the bottom
  ...cluster(['mango', 'bananas', 'jackfruit', 'bromeliad'], P.slideEnd.x, P.slideEnd.z - 3, 4, 8, 'slide'),
  // hammock camp
  at('hammock', P.hammock.x, P.hammock.z, { rot: 0.3 }), at('tent', P.hammock.x + 6, P.hammock.z - 4), at('teamug', P.hammock.x - 2, P.hammock.z + 2),
  ...cluster(['rucksack', 'hikingboot', 'coolbox', 'binoculars', 'acai'], P.hammock.x + 3, P.hammock.z + 3, 3, 6, 'camp'),
  // Rainforest_5G
  at('router', P.router5g.x, P.router5g.z), at('cable', P.router5g.x + 2, P.router5g.z + 1),
  // the sloth's tree and the butterfly glade
  ...cluster(['bromeliad', 'bananas', 'mango'], P.sloth.x, P.sloth.z, 4, 6, 'sloth'),
  ...cluster(['bromeliad', 'bromeliad', 'acai', 'jackfruit'], P.glade.x, P.glade.z, 8, 14, 'glade'),
  // the lily lake: lilies, ducks, kayaks, Zé's cart, picnics
  ...ring('lilyflower', P.lake.x, P.lake.z, 22, 10, 0.3),
  ...ring('rubberduck', P.lake.x, P.lake.z, 12, 4, 1),
  at('kayak', 115, -2, { rot: 1.2 }), at('kayak', 118, -16, { rot: 1.4 }), at('paddle', 113, -9), at('paddle', 110, -4), at('lifebuoy', 116, 6),
  ...cluster(['acai', 'acai', 'bananas', 'mango', 'coolbox'], P.ze.x, P.ze.z - 2, 3, 10, 'acai'),
  ...[[165, 40], [178, 36], [190, 30]].flatMap(([x, z], i) => [at('picnictable', x, z, { rot: i }), ...cluster(['mango', 'acai', 'bananas', i === 1 ? 'teamug' : 'coolbox'], x, z, 2.4, 5, `pic${i}`)]),
  at('tent', 200, 40), at('tent', 196, 52), at('bicycle', 180, 50), at('bicycle', 182, 50.5),
  // lookout: birdwatchers' kit, Pru's flask, the hut and the cable car
  at('lookouthut', P.lookout.x + 14, P.lookout.z + 2), at('cablecar', P.lookout.x - 15, P.lookout.z + 8),
  ...cluster(['binoculars', 'teamug', 'rucksack', 'binoculars', 'acai'], P.lookout.x, P.lookout.z - 8, 4, 10, 'lookout'),
  at('jeep', 92, 108, { rot: 0.8 }), at('jeep', 60, 128, { rot: -0.4 }), at('jeep', -120, 70, { rot: 0.2 }),
  // the grove: bromeliads, jackfruit, a golden rubber duck
  at('rubberduck', P.grove.x, P.grove.z, { golden: true }),
  ...cluster(['bromeliad', 'jackfruit', 'mango', 'brazilnut', 'bananas'], P.grove.x, P.grove.z, 15, 26, 'grove'),
  // the plateau: the river's source, picnic, a router with no signal
  ...cluster(['mango', 'brazilnut', 'hikingboot', 'treestump', 'signpost', 'rucksack'], -215, 40, 20, 18, 'plateau'),
  at('router', -220, -20), at('teamug', -214, 24),
  // tree stumps, palms (the finale), hammocks and tents about the valley
  ...[[-70, 50], [-40, -20], [50, 90], [130, 110], [-180, 80], [180, -70], [-110, -60]].map(([x, z]) => at('treestump', x, z)),
  ...[[120, 40], [205, -20], [200, 10], [130, -55], [-130, 50], [60, -100], [-30, 160]].map(([x, z]) => at('palmtree', x, z)),
  at('hammock', -100, 40), at('hammock', 140, 100), at('tent', -60, 120), at('tent', 20, 120),
  ...[[-40, 80], [100, 80], [150, 120], [-90, 110], [180, 100], [-170, -60], [220, 120], [-220, 100]].map(([x, z]) => at('boulder', x, z)),
  ...[[-60, 140], [150, 160], [200, 130], [-200, 150], [220, -140], [-200, -140], [100, -150], [0, -160]].map(([x, z]) => at('palmtree', x, z)),
  at('cable', -18, 30), at('cable', 150, 30), at('router', 108, 150),
  // the upper storey: treehouses, more bridge sections, cable cars and huts for the big finish
  ...[[-64, 36], [24, 64], [-136, -44], [116, 74], [-36, 124], [86, -74], [156, 94], [-156, 114]].map(([x, z]) => at('treehouse', x, z)),
  at('bridgesection', 30, 75, { rot: 0.4 }), at('bridgesection', -80, 100, { rot: 1 }), at('bridgesection', 140, -90), at('bridgesection', -170, 60, { rot: 0.2 }),
  at('cablecar', 130, 150), at('cablecar', 80, 140), at('cablecar', -215, 60), at('jeep', 210, 90), at('jeep', -60, -140), at('jeep', 160, -120),
  at('lookouthut', -220, 70), at('lookouthut', 205, -110), at('lookouthut', -30, -150),
];

const fill = [
  { types: ['brazilnut', 'acai', 'mango', 'binoculars', 'bananas'], count: 70, region: { minX: -170, maxX: 120, minZ: -60, maxZ: 70 }, avoidWater: true },
  { types: ['brazilnut', 'mango', 'acai'], count: 30, region: { x: -12, z: 28, r: 14 }, avoidWater: true },
  { types: ['hikingboot', 'bromeliad', 'jackfruit', 'rucksack', 'bananas'], count: 70, region: { minX: -240, maxX: 240, minZ: -190, maxZ: 190 }, avoidWater: true },
  { types: ['treestump', 'signpost', 'picnictable', 'paddle', 'coolbox', 'lifebuoy', 'bicycle'], count: 40, region: { minX: -230, maxX: 230, minZ: -180, maxZ: 180 }, avoidWater: true },
  { types: ['tent', 'kayak', 'hammock', 'boulder', 'jeep', 'cablecar'], count: 24, region: { minX: -230, maxX: 230, minZ: -180, maxZ: 180 }, avoidWater: true },
];

export const W3 = {
  id: 'w3', index: 3,
  nameKey: 'world.w3.name', introKey: 'world.w3.intro', outroKey: 'world.w3.outro',
  music: 'w3', ambience: 'jungle',
  palette: {
    skyTop: '#8ccfd8', skyBottom: '#f4f0c8', horizon: '#e6efc4', fog: '#cfe6c4', fogNear: 50, fogFar: 380,
    sun: '#fff0c0', sunIntensity: 2.0, ambient: '#a8d4b0', ground: '#5fa848', accent: '#ffa63a',
    water: '#4ab8a0', waterDeep: '#1f6e64', foam: '#f0fff4', outline: '#22301e',
  },
  timeOfDay: { start: 0.55, end: 0.64 },
  bounds: { minX: -250, maxX: 250, minZ: -200, maxZ: 200 },
  spawn: { x: P.spawn.x, z: P.spawn.z, yaw: HALF_PI },
  heightAt, surfaceAt,
  water: [
    { kind: 'river', level: 0, rect: { minX: -183, maxX: 116, minZ: -42, maxZ: 40 } },
    { kind: 'river', level: PLATEAU - 0.6, rect: { minX: -250, maxX: -199.5, minZ: -6, maxZ: 6 } },
    { kind: 'pond', level: 0, rect: { minX: P.lake.x - P.lake.rx, maxX: P.lake.x + P.lake.rx, minZ: P.lake.z - P.lake.rz, maxZ: P.lake.z + P.lake.rz } },
  ],
  colliders, scenery,
  items: { anchors: settleAnchors(anchors, colliders), fill },
  zones: [
    { id: 'cave', x: P.cave.x, z: P.cave.z, r: 5 },
    { id: 'slideTop', x: P.slideTop.x, z: P.slideTop.z, r: 5 },
    { id: 'slideEnd', x: P.slideEnd.x, z: P.slideEnd.z, r: 6 },
    { id: 'glade', x: P.glade.x, z: P.glade.z, r: 6 },
    { id: 'trailmap', x: P.trailmap.x, z: P.trailmap.z - 1.8, r: 1.8 },
    { id: 'jaguar', x: P.jaguar.x - 2.5, z: P.jaguar.z, r: 3 },
    { id: 'hammock', x: P.hammock.x, z: P.hammock.z, r: 2 },
    { id: 'lookout', x: P.lookout.x, z: P.lookout.z, r: 6 },
    { id: 'grove', x: P.grove.x, z: P.grove.z, r: 18 },
    ...P.pads.map(([x, z, s], i) => ({ id: LILY_ZONES[i], x, z, r: 0.6 * s + 0.3 })),
  ],
  hazards: [
    ...[-104, -101, -98, -95].map((x, i) => ({ kind: 'slipperyRock', id: `rock${i + 1}`, x, z: P.ford.z + (i % 2 ? 1.5 : -1.5), r: 1.6 })),
    { kind: 'slipperyRock', id: 'poolrim', x: -176, z: 12, r: 3 },
    { kind: 'toucan', id: 'toucan', x: P.toucan.x, z: P.toucan.z, r: 10, perches: [[60, 12], [20, 60], [-30, 60], [60, 70]] },
    { kind: 'marmoset', id: 'marmoset', x: P.marmoset.x, z: P.marmoset.z, r: 12 },
  ],
  cast: [
    { id: 'gerald', speaker: 'gerald', kind: 'critter', mesh: 'gerald', x: 30, z: 20, yaw: 0, behaviour: 'gerald',
      params: { disguise: 'explorer', spots: [[30, 20], [58, 14], [P.jaguar.x, P.jaguar.z - 4], [-60, 24], [110, 140], [140, 30], [-170, 18]], approachR: 5 } },
    { id: 'marco', speaker: 'marco', kind: 'human', mesh: 'marco', x: -40, z: 38, yaw: HALF_PI, behaviour: 'marco',
      params: { path: TRAIL_N.concat([[80, 60], [45, 40], [-15, 30], [-90, 45]]), speed: 2.4 } },
    { id: 'ze', speaker: 'ze', kind: 'human', mesh: 'ze', x: P.ze.x, z: P.ze.z, yaw: PI, behaviour: 'vendor', params: { anim: 'sell' } },
    { id: 'pru', speaker: 'pru', kind: 'human', mesh: 'pru', x: P.lookout.x + 3, z: P.lookout.z - 2, yaw: 0, behaviour: 'idle', params: { anim: 'sit', react: 'wave', reactR: 5 } },
    { id: 'sloth', speaker: 'sloth', kind: 'critter', mesh: 'sloth', x: P.sloth.x + 1.6, z: P.sloth.z, yaw: 0, behaviour: 'idle', params: { anim: 'idle', perchY: 5 } },
  ],
  crowd: [
    { id: 'hiker1', kind: 'hiker', x: -90, z: 45, yaw: HALF_PI, behaviour: 'pathLoop', params: { path: TRAIL, speed: 1.3, pingPong: true, react: 'wave' } },
    { id: 'hiker2', kind: 'hiker', x: 80, z: 60, yaw: 0, behaviour: 'pathLoop', params: { path: TRAIL_N, speed: 1.1, pingPong: true, react: 'wave' } },
    { id: 'hiker3', kind: 'hiker', x: 170, z: 40, yaw: 0, behaviour: 'idle', params: { anim: 'sit', react: 'wave', reactR: 3 } },
    { id: 'bw1', kind: 'birdwatcher', x: P.lookout.x - 3, z: P.lookout.z + 3, yaw: 0, behaviour: 'idle', params: { anim: 'point' } },
    { id: 'bw2', kind: 'birdwatcher', x: 60, z: 16, yaw: 0, behaviour: 'idle', params: { anim: 'point', react: 'tut', reactR: 3 } },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: `fly${i + 1}`, kind: 'butterfly', x: P.glade.x + Math.cos(i) * 4, z: P.glade.z + Math.sin(i) * 4, yaw: 0, behaviour: 'wander', params: { r: 6, speed: 1.2 } })),
    ...[0, 1, 2].map((i) => ({ id: `frog${i + 1}`, kind: 'frog', x: P.pads[i][0], z: P.pads[i][1], yaw: i, behaviour: 'idle', params: { anim: 'idle', react: 'flee', reactR: 2 } })),
    ...[0, 1, 2].map((i) => ({ id: `duckling${i + 1}`, kind: 'duckling', x: P.lake.x - 10 + i * 2, z: P.lake.z + 6, yaw: 0, behaviour: 'wander', params: { r: 10, speed: 0.6 } })),
  ],
  flocks: [{ kind: 'pigeon', count: 6, x: 175, z: 42, r: 10 }],
  activities: [
    { kind: 'fetch', x: 45, z: 46, params: { thrower: 'marco', r: 10, reward: 25 } },
    { kind: 'herding', x: 182, z: 46, params: { ring: { x: 186, z: 58, r: 3.5 }, count: 6, time: 45, reward: 30 } },
    { kind: 'sniffTrail', x: -15, z: 22, params: { item: 'brazilnut', count: 8, time: 30, path: [[-15, 22], [-8, 14], [-2, 8], [-30, 10], [-50, 20], [-60, 30]], reward: 25 } },
    { kind: 'sitStay', x: -18, z: 36, params: { npc: 'gerald', time: 6, reward: 25 } },
  ],
  eggs: makeEggsW3(P),
  goals: {
    start: 0.8, goal: 18, stretch: 27, timer: 330, par: 260, growthK: 1.6,
    milestones: [1.5, 3, 6, 10, 20],
    star3: { kind: 'golden' },
  },
  weather: ['clear', 'fog', 'fog', 'rain'],
  golden: { type: 'mango', eggId: 'T2' },
};

