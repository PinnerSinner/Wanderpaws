// W4 Snowy Highlands (Scotland in winter). Golden hour into dusk. 900 x 700 m.
//
// Layout:
//   centre-south   the frozen loch (slides!), thin-ice patches, Gerald failing to skate, and
//                  the curling rink by the north shore. Spawn is on the north shore.
//   north shore    the ice sculpture, the piper's stage, the snowball kids
//   west           the village: Auntie Pru's bothy, cottages, a phone box
//   north-west     the glen: heather, hay bales, dry-stone dykes (a hidden gap behind the
//                  heather), Highland cows including Hamish
//   north-east     the ski mountain: a ski lift from the glen-side base station, and a
//                  slalom slide course down to the loch ending at the golden snowflake
//   south-east     the haggis hill (a wild haggis runs round it), a castle on an outcrop,
//                  a lighthouse on the loch's east tip
//   south-west     a hidden cove of open water behind the rocks: a 2.2 m gap for small animals,
//                  a 4.5 m wall for giants. Sit there and something surfaces (H2).
//   beyond         snowy mountains on every horizon

import { box, cyl, scen, span, wall, gappedWall, at, row, ring, cluster, sstep, lerp, hill, ellipse01, rect01, pathDist, PI, HALF_PI } from './util.js';
import { settleAnchors } from './layout.js';
import { makeEggsW4 } from './eggs/w4.js';

export const P = {
  spawn: { x: 5, z: 36 },
  loch: { x: 0, z: -80, rx: 170, rz: 100 },
  rink: { x: -30, z: -12 },
  house: { x: -47, z: -12 },
  hack: { x: -13, z: -12 },
  sculpture: { x: 32, z: 12 },
  piper: { x: -90, z: 30 },
  bothy: { x: -200, z: 42 },
  village: { x: -240, z: 20 },
  glen: { minX: -390, maxX: -160, minZ: 90, maxZ: 270 },
  hamish: { x: -240, z: 150 },
  liftBase: { x: 160, z: 72 }, liftTop: { x: 300, z: 250 },
  slideTop: { x: 245, z: 150 }, slideEnd: { x: 150, z: 18 },
  haggisHill: { x: 220, z: -190 },
  castle: { x: 330, z: -240 },
  cove: { x: -170, z: -205 },
  stones: { x: -300, z: -120 },
  lighthouse: { x: 186, z: -80 },
};

function heightAt(x, z) {
  let h = 2;
  if (z > 90) { const e = z - 90; h += 0.0012 * e * e; }
  if (z < -220) { const e = -220 - z; h += 0.002 * e * e; }
  if (x < -380) { const e = -380 - x; h += 0.004 * e * e; }
  if (x > 380) { const e = x - 380; h += 0.004 * e * e; }
  h += 5 * Math.sin(x * 0.011 + 0.4) * Math.sin(z * 0.014) * sstep(40, 140, Math.hypot(x - P.loch.x, (z - P.loch.z) * 1.5));
  h += hill(x, z, P.haggisHill.x, P.haggisHill.z, 60, 22);
  h += hill(x, z, 300, 270, 230, 55);
  h += hill(x, z, P.castle.x, P.castle.z, 45, 14);
  // the glen: a broad, flat-bottomed valley
  const g = rect01(x, z, P.glen.minX, P.glen.maxX, P.glen.minZ, P.glen.maxZ, 40);
  if (g > 0) h = lerp(h, 4 + 1.2 * Math.sin(x * 0.03) * Math.sin(z * 0.025), g * 0.9);
  // the slalom course: smooth it into a clean chute
  const ds = pathDist(x, z, [[P.slideTop.x, P.slideTop.z], [P.slideEnd.x, P.slideEnd.z]]);
  if (ds < 12) {
    const t = Math.max(0, Math.min(1, ((x - P.slideEnd.x) * (P.slideTop.x - P.slideEnd.x) + (z - P.slideEnd.z) * (P.slideTop.z - P.slideEnd.z)) / ((P.slideTop.x - P.slideEnd.x) ** 2 + (P.slideTop.z - P.slideEnd.z) ** 2)));
    const chute = 2 + t * t * 26;
    h = lerp(h, chute, 1 - sstep(6, 12, ds));
  }
  // the frozen loch: dead flat ice
  const e = ellipse01(x, z, P.loch.x, P.loch.z, P.loch.rx, P.loch.rz, 0.12);
  if (e > 0) h = lerp(h, 0, e);
  // the hidden cove: open water
  const c = ellipse01(x, z, P.cove.x, P.cove.z, 30, 22, 0.45);
  if (c > 0) h = lerp(h, -4, c);
  return h;
}

function surfaceAt(x, z) {
  const dx = (x - P.loch.x) / P.loch.rx, dz = (z - P.loch.z) / P.loch.rz;
  if (dx * dx + dz * dz < 0.94) return 'ice';
  const cx = (x - P.cove.x) / 36, cz = (z - P.cove.z) / 28;
  if (cx * cx + cz * cz < 1) return 'rock';
  if (x > P.glen.minX && x < P.glen.maxX && z > P.glen.minZ && z < P.glen.maxZ) return 'grass';
  if (Math.hypot(x - P.piper.x, z - P.piper.z) < 2) return 'wood';
  if (Math.hypot(x - P.stones.x, z - P.stones.z) < 22 || Math.hypot(x - P.castle.x, z - P.castle.z) < 30) return 'rock';
  if (Math.abs(x - P.bothy.x) < 6 && Math.abs(z - P.bothy.z + 6) < 2) return 'rock';
  return 'snow';
}

// ---- colliders ------------------------------------------------------------
const pines = [];
{
  // forest belts: north of the village, around the haggis hill, east of the ski run
  const belts = [[-200, 120, 60, 9], [-90, 110, 50, 7], [60, 130, 60, 8], [360, 120, 50, 7], [300, -120, 50, 7], [-260, -60, 50, 8], [100, -230, 40, 6], [-60, -250, 50, 6], [-330, 300, 40, 5], [40, 260, 50, 6]];
  let k = 0;
  for (const [cx, cz, r, n] of belts) {
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + k;
      const d = r * Math.sqrt((i + 0.5) / n);
      pines.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d]);
    }
    k++;
  }
}
const colliders = [
  // Pru's bothy (scenery) and the piper's stage
  box(P.bothy.x, P.bothy.z, 8, 6, 5),
  cyl(P.sculpture.x, P.sculpture.z, 1.0, 2.2),
  // the hidden cove: rocks all round, a 2.2 m gap in the north, a 4.5 m wall in the east
  ...gappedWall(-215, -170, -125, -170, 12, 2.2, 0.5, 3),
  wall(-215, -170, -215, -240, 12, 3), wall(-215, -240, -125, -240, 12, 3),
  wall(-125, -170, -125, -240, 4.5, 3),
  // dry-stone dykes between the glen and the village (1.2 m: step over at 2.7 m), with a hidden gap
  ...gappedWall(-150, 90, -150, 270, 1.2, 2.5, 0.47, 0.8),
  wall(-380, 90, -160, 90, 1.2, 0.8),
  // ski lift base station
  box(P.liftBase.x, P.liftBase.z, 8, 5, 4, 0.9),
  ...pines.map(([x, z]) => cyl(x, z, 0.5, 12)),
];

// ---- scenery ----------------------------------------------------------------
const liftPts = [0, 0.25, 0.5, 0.75, 1].map((t) => [P.liftBase.x + (P.liftTop.x - P.liftBase.x) * t, P.liftBase.z + (P.liftTop.z - P.liftBase.z) * t]);
const scenery = [
  scen('curlingrink', P.rink.x, P.rink.z, 0),
  scen('icesculpture', P.sculpture.x, P.sculpture.z, -0.5),
  scen('piperstage', P.piper.x, P.piper.z, 0),
  scen('bothyhut', P.bothy.x, P.bothy.z, 0),
  scen('plaque', P.liftBase.x - 8, P.liftBase.z - 4, 0.9, 1, { params: { textKey: 'world.w4.liftsign' } }),
  ...liftPts.slice(0, -1).map(([x, z], i) => ({ ...span('skiliftline', x, z, liftPts[i + 1][0], liftPts[i + 1][1], 1), params: { y0: 24, y1: 24 } })),
  ...[-440, -200, 60, 320].map((x, i) => scen('mountain', x, 620, i, 1.6 + (i % 2) * 0.4)),
  scen('mountain', -650, 0, 1, 2), scen('mountain', 650, 80, 2, 1.8), scen('mountain', 120, -620, 3, 1.5), scen('mountain', -380, -560, 4, 1.4),
  ...pines.map(([x, z], i) => scen('pine', x, z, i, 0.8 + (i % 4) * 0.12)),
  ...[[-260, 120], [-200, 200], [-320, 180], [-280, 240], [-180, 150], [-152, 178], [-152, 172], [-230, 100], [-350, 120]].map(([x, z], i) => scen('heather', x, z, i, 1.2 + (i % 3) * 0.3)),
  ...[[-270, 140], [-210, 230], [-300, 200]].map(([x, z], i) => scen('stonewall', x, z, i * 0.6, 1)),
  ...[0.2, 0.4, 0.6, 0.8].flatMap((t, i) => {
    const x = P.slideEnd.x + (P.slideTop.x - P.slideEnd.x) * t, z = P.slideEnd.z + (P.slideTop.z - P.slideEnd.z) * t;
    const s = i % 2 ? 1 : -1;
    return [scen('flagpole', x + s * 7, z - s * 4, 0, 0.4)];
  }),
  ...[[-200, -175], [-140, -175], [-210, -230], [-130, -230], [-170, -240]].map(([x, z], i) => scen('rock', x, z, i, 4)),
  scen('rock', -127, -200, 0, 2.6), scen('rock', -127, -215, 1, 2.6),
];

// ---- items ----------------------------------------------------------------
const anchors = [
  // spawn: shortbread crumbs and snowballs on the shore
  ...cluster(['shortbread', 'snowball', 'thistle', 'snowball', 'shortbread', 'snowflake'], 5, 30, 7, 30, 'w4spawn'),
  at('tartanscarf', 12, 34), at('bagpipes', -4, 40), at('teamug', 2, 41), at('sledge', 16, 42), at('curlingbroom', -10, 26),
  // the curling rink: six stones at the hack, brooms, and the house
  ...row('curlingstone', P.hack.x + 1, P.hack.z - 2, P.hack.x + 1, P.hack.z + 2, 6),
  at('curlingbroom', P.hack.x + 3, P.hack.z - 3.5), at('curlingbroom', P.house.x - 4, P.house.z + 3.5), at('teamug', P.rink.x, P.rink.z + 4.5),
  // the piper and the kids
  at('bagpipes', P.piper.x + 3, P.piper.z), ...cluster(['snowball', 'snowball', 'shortbread', 'tartanscarf'], -130, 50, 8, 16, 'kids'),
  // the village
  at('cottage', P.village.x, P.village.z), at('cottage', P.village.x - 30, P.village.z + 30), at('cottage', P.village.x + 20, P.village.z - 30),
  at('phonebox', P.bothy.x + 12, P.bothy.z - 8), at('tractor', P.village.x - 10, P.village.z - 18, { rot: 0.4 }),
  ...cluster(['shortbread', 'teamug', 'tartanscarf', 'woodsign', 'sledge', 'skis'], P.bothy.x, P.bothy.z - 10, 8, 14, 'bothy'),
  at('bothy', -300, 40), at('bothy', 120, 160), at('bothy', -40, -230),
  // the glen: hay, thistles, a tractor, Hamish's hay bale
  ...cluster(['haybale', 'thistle', 'thistle', 'haybale', 'woodsign'], -260, 170, 70, 40, 'glen'),
  at('tractor', -300, 120, { rot: 1 }), at('tractor', -200, 240, { rot: 2 }), at('haybale', P.hamish.x + 4, P.hamish.z + 2),
  // the ski lift: pylons (the lift itself is the finale), chairs, skis and signs at the base
  ...liftPts.slice(1).map(([x, z]) => at('skiliftpylon', x, z)),
  ...cluster(['skiliftchair', 'skis', 'skis', 'sledge', 'woodsign'], P.liftBase.x - 10, P.liftBase.z - 10, 9, 14, 'liftbase'),
  at('cable', P.liftBase.x - 4, P.liftBase.z + 4), at('router', P.liftBase.x - 6, P.liftBase.z + 2), at('cable', P.liftBase.x + 6, P.liftBase.z - 4),
  // the slide course: snowballs down the chute, the golden snowflake waits at the bottom (spawned by H3)
  ...cluster(['snowball', 'snowflake', 'snowball'], 200, 85, 30, 16, 'chute'),
  // the frozen loch: a frozen rubber duck, boats stuck in the ice, a lighthouse
  at('rubberduck', 0, -80), at('rubberduck', -60, -60), at('rubberduck', 70, -110),
  at('lochboat', -100, -40, { rot: 0.5 }), at('lochboat', 120, -60, { rot: 2 }), at('lochboat', 40, -150, { rot: 1 }),
  at('lighthouse', P.lighthouse.x, P.lighthouse.z),
  // the haggis hill and the castle
  ...cluster(['thistle', 'haybale', 'standingstone', 'boulder'], P.haggisHill.x, P.haggisHill.z, 50, 14, 'haggis'),
  at('castlekeep', P.castle.x, P.castle.z),
  at('castleturret', P.castle.x - 40, P.castle.z + 20), at('castleturret', P.castle.x + 35, P.castle.z + 30), at('castleturret', P.castle.x - 10, P.castle.z - 40),
  // standing stones
  ...ring('standingstone', P.stones.x, P.stones.z, 18, 7),
  // the hidden cove: a golden rubber duck in the open water, and a picnic for one (Gerald's)
  at('rubberduck', P.cove.x, P.cove.z, { golden: true }),
  ...cluster(['shortbread', 'teamug', 'tartanscarf', 'snowflake', 'lochboat'], P.cove.x + 2, P.cove.z + 26, 6, 10, 'cove'),
  // snowmen (H5), sledges and pines about the place
  ...[[30, 50], [-60, 60], [100, 40], [-160, 10], [260, 20], [-280, -40], [60, -260], [200, -40]].map(([x, z]) => at('snowman', x, z)),
  ...[[-120, 160], [-40, 180], [30, 200], [200, 300], [-350, -200], [350, 0], [380, -100], [-100, -300], [150, -300], [250, -280], [-380, 0], [-250, -250]].map(([x, z]) => at('pinetree', x, z)),
  ...[[80, 220], [-120, 280], [-350, 260], [370, 220], [-400, -150]].map(([x, z]) => at('cottage', x, z)),
  at('lighthouse', -380, -280), at('castleturret', 380, -280),
];

const fill = [
  { types: ['snowball', 'shortbread', 'thistle', 'snowflake'], count: 110, region: { minX: -300, maxX: 300, minZ: -40, maxZ: 120 } },
  { types: ['snowball', 'shortbread', 'snowflake'], count: 30, region: { x: 5, z: 32, r: 14 } },
  { types: ['curlingbroom', 'tartanscarf', 'bagpipes', 'sledge', 'skis', 'snowball'], count: 60, region: { minX: -400, maxX: 400, minZ: -300, maxZ: 300 } },
  { types: ['haybale', 'woodsign', 'snowman', 'skiliftchair', 'phonebox', 'boulder'], count: 60, region: { minX: -400, maxX: 400, minZ: -300, maxZ: 300 } },
  { types: ['tractor', 'lochboat', 'standingstone', 'bothy', 'pinetree'], count: 40, region: { minX: -420, maxX: 420, minZ: -320, maxZ: 320 } },
  { types: ['snowball', 'thistle', 'shortbread'], count: 40, region: { minX: -160, maxX: 160, minZ: -170, maxZ: 10 } },
];

const HAGGIS_LOOP = [];
for (let i = 0; i < 12; i++) {
  const a = -i / 12 * Math.PI * 2; // clockwise seen from above
  HAGGIS_LOOP.push([P.haggisHill.x + Math.cos(a) * 42, P.haggisHill.z + Math.sin(a) * 42]);
}

export const W4 = {
  id: 'w4', index: 4,
  nameKey: 'world.w4.name', introKey: 'world.w4.intro', outroKey: 'world.w4.outro',
  music: 'w4', ambience: 'snow',
  palette: {
    skyTop: '#7f8fcf', skyBottom: '#ffc89a', horizon: '#ffd8b0', fog: '#e6dcef', fogNear: 120, fogFar: 900,
    sun: '#ffcf96', sunIntensity: 1.8, ambient: '#b8b8e0', ground: '#f4f6fb', accent: '#9a5aa8',
    water: '#5a8ac8', waterDeep: '#284a8a', foam: '#ffffff', outline: '#2a2840',
  },
  timeOfDay: { start: 0.68, end: 0.78 },
  bounds: { minX: -450, maxX: 450, minZ: -350, maxZ: 350 },
  spawn: { x: P.spawn.x, z: P.spawn.z, yaw: PI },
  heightAt, surfaceAt,
  water: [{ kind: 'loch', level: -0.6, rect: { minX: P.cove.x - 31, maxX: P.cove.x + 31, minZ: P.cove.z - 23, maxZ: P.cove.z + 23 } }],
  colliders, scenery,
  items: { anchors: settleAnchors(anchors, colliders), fill },
  zones: [
    { id: 'lochCove', x: P.cove.x, z: P.cove.z + 24, r: 9 },
    { id: 'slideTop', x: P.slideTop.x, z: P.slideTop.z, r: 9 },
    { id: 'slideEnd', x: P.slideEnd.x, z: P.slideEnd.z, r: 11 },
    { id: 'hamish', x: P.hamish.x, z: P.hamish.z, r: 6 },
    { id: 'liftsign', x: P.liftBase.x - 9, z: P.liftBase.z - 6, r: 3 },
    { id: 'sculpture', x: P.sculpture.x, z: P.sculpture.z + 2.4, r: 2.2 },
    { id: 'house', x: P.house.x, z: P.house.z, r: 2 },
    { id: 'rink', x: P.rink.x, z: P.rink.z, r: 22 },
    { id: 'glen', x: -270, z: 180, r: 90 },
  ],
  hazards: [
    { kind: 'thinIce', id: 'ice1', x: 40, z: -120, r: 10 }, { kind: 'thinIce', id: 'ice2', x: -80, z: -100, r: 12 },
    { kind: 'thinIce', id: 'ice3', x: 100, z: -60, r: 9 }, { kind: 'thinIce', id: 'ice4', x: -20, z: -150, r: 10 },
    { kind: 'thinIce', id: 'ice5', x: 130, z: -110, r: 8 },
    { kind: 'snowballKids', id: 'kids', x: -130, z: 52, count: 3, range: 14 },
    { kind: 'highlandCow', id: 'cow1', x: -300, z: 200, r: 8 },
    { kind: 'highlandCow', id: 'cow2', x: -200, z: 120, r: 8 },
  ],
  cast: [
    { id: 'gerald', speaker: 'gerald', kind: 'critter', mesh: 'gerald', x: 20, z: -40, yaw: 0, behaviour: 'gerald',
      params: { disguise: 'tartan', spots: [[20, -40], [60, -70], [-20, -90], [-60, -50], [10, -20]], approachR: 6 } },
    { id: 'marco', speaker: 'marco', kind: 'human', mesh: 'marco', x: -60, z: 30, yaw: HALF_PI, behaviour: 'marco',
      params: { path: [[-160, 30], [160, 30], [190, -60], [100, -190], [-120, -190], [-190, -60]], speed: 3 } },
    { id: 'pru', speaker: 'pru', kind: 'human', mesh: 'pru', x: P.bothy.x + 2, z: P.bothy.z - 5, yaw: PI, behaviour: 'idle', params: { anim: 'sit', react: 'wave', reactR: 5 } },
    { id: 'piper', speaker: 'piper', kind: 'human', mesh: 'piper', x: P.piper.x, z: P.piper.z, yaw: PI, behaviour: 'idle', params: { anim: 'idle', perchY: 0.4 } },
    { id: 'hamish', speaker: 'hamish', kind: 'critter', mesh: 'highlandcow', x: P.hamish.x, z: P.hamish.z, yaw: 0.6, behaviour: 'idle', params: { anim: 'idle' } },
    { id: 'haggis', speaker: 'haggis', kind: 'critter', mesh: 'haggis', x: HAGGIS_LOOP[0][0], z: HAGGIS_LOOP[0][1], yaw: 0, behaviour: 'pathLoop', params: { path: HAGGIS_LOOP, speed: 5 } },
  ],
  crowd: [
    { id: 'curler1', kind: 'curler', x: P.hack.x - 2, z: P.hack.z + 3.4, yaw: -HALF_PI, behaviour: 'react', params: { react: 'cheer', r: 6 } },
    { id: 'curler2', kind: 'curler', x: P.house.x + 4, z: P.house.z - 3.4, yaw: HALF_PI, behaviour: 'react', params: { react: 'cheer', r: 6 } },
    { id: 'curler3', kind: 'curler', x: P.rink.x, z: P.rink.z + 3.6, yaw: PI, behaviour: 'idle', params: { anim: 'idle', react: 'cheer', reactR: 5 } },
    ...[0, 1, 2].map((i) => ({ id: `kid${i + 1}`, kind: 'kid', x: -130 + i * 3, z: 52 + i, yaw: 0, behaviour: 'wander', params: { r: 6, speed: 1.2 } })),
    ...[0, 1, 2, 3, 4].map((i) => ({ id: `cow${i + 3}`, kind: 'highlandcow', x: -320 + i * 30, z: 150 + (i % 2) * 40, yaw: i, behaviour: 'wander', params: { r: 12, speed: 0.4 } })),
    { id: 'skier1', kind: 'skier', x: 200, z: 120, yaw: 0, behaviour: 'pathLoop', params: { path: [[P.slideTop.x, P.slideTop.z], [P.slideEnd.x, P.slideEnd.z]], speed: 8, pingPong: true } },
    { id: 'skier2', kind: 'skier', x: P.liftBase.x - 5, z: P.liftBase.z - 6, yaw: 0, behaviour: 'idle', params: { anim: 'idle', react: 'wave', reactR: 4 } },
    { id: 'tour1', kind: 'tourist', x: P.lighthouse.x - 14, z: P.lighthouse.z, yaw: HALF_PI, behaviour: 'idle', params: { anim: 'point' } },
  ],
  flocks: [{ kind: 'gull', count: 8, x: 0, z: -80, r: 80 }],
  activities: [
    { kind: 'fetch', x: 60, z: 40, params: { thrower: 'marco', r: 14, reward: 25 } },
    { kind: 'herding', x: -250, z: 160, params: { ring: { x: -230, z: 200, r: 6 }, count: 6, time: 50, reward: 30 } },
    { kind: 'sniffTrail', x: P.bothy.x + 10, z: P.bothy.z - 10, params: { item: 'shortbread', count: 8, time: 30, path: [[-190, 30], [-170, 20], [-150, 30], [-130, 20], [-110, 30]], reward: 25 } },
    { kind: 'sitStay', x: -20, z: 38, params: { npc: 'gerald', time: 6, reward: 25 } },
  ],
  eggs: makeEggsW4(P),
  goals: {
    start: 1.5, goal: 45, stretch: 67.5, timer: 360, par: 300, growthK: 1.7,
    milestones: [3, 6, 12, 25, 55],
    star3: { kind: 'combo', count: 30 },
  },
  weather: ['snow', 'clear', 'aurora', 'snow'],
  golden: { type: 'snowflake', eggId: 'H3' },
};
