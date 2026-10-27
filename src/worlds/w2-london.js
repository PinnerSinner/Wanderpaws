// W2 London Park and Street. Late morning, drizzle into sun. 260 x 200 m.
//
// Layout (z runs from the park, negative, to the street and gardens, positive):
//   z < 10      the park: a duck pond (west), the bandstand ringed with deckchairs (centre),
//               a grassy knoll (east), big oaks dropping conkers, paths, a jogging loop
//   z = 10      black railings with two gates (big animals step over them, cats slip through)
//   10..33      the street: pavement, road with parked cabs and buses, pavement with the
//               bus stop, phone box, post box and a gallery window
//   33..42      a long terrace of coloured front doors, with an arch through it at x 30..33
//   42..50      THE MEWS: a cobbled lane behind the terrace, a hidden shortcut from the arch
//               to Admiral's Square (west, with the column and Nigel)
//   50..100     mews houses, allotments, and a walled secret garden (a 0.7 m gap for small
//               animals, a 2 m wall the big ones step over)

import { box, cyl, scen, strip, wall, at, row, ring, cluster, sstep, lerp, hill, ellipse01, pathDist, inRect, PI, HALF_PI } from './util.js';
import { settleAnchors } from './layout.js';
import { makeEggsW2 } from './eggs/w2.js';

const BASE = 0.3;

export const P = {
  spawn: { x: 2, z: 2 },
  pond: { x: -45, z: -45, rx: 26, rz: 15 },
  bandstand: { x: 28, z: -45 },
  knoll: { x: 85, z: -62 },
  column: { x: -95, z: 32 },
  sentry: { x: -112, z: 47.5 },
  cart: { x: -40, z: 13 },
  busstop: { x: 70, z: 30 },
  bus: { x: 78, z: 23.5 },
  phonebox: { x: 20, z: 31 },
  postbox: { x: 0, z: 30.6 },
  gallery: { x: -15, z: 33 },
  plaque: { x: -18, z: -22 },
  squirrel: { x: 62, z: -25 },
  garden: { minX: 62, maxX: 110, minZ: 62, maxZ: 95 },
  puddles: [
    { x: 0, z: -6, r: 1.5 }, { x: -30, z: -24.5, r: 2 }, { x: 40, z: 22, r: 2 },
    { x: -50, z: 30.5, r: 1.5 }, { x: 80, z: 13, r: 1.6 }, { x: 12, z: -38, r: 1.8 }, { x: -20, z: 46, r: 1.6 },
  ],
};

// Park paths (pavement in surfaceAt)
const PATHS = [
  [[0, 10], [0, -20], [14, -32], [28, -38]],
  [[0, -20], [-20, -25], [-45, -26], [-70, -36], [-74, -50], [-60, -64], [-32, -66], [-16, -54], [-20, -25]],
  [[0, -20], [40, -22], [70, -40], [85, -62]],
  [[-80, 10], [-62, -14], [-45, -26]],
  [[-120, -90], [120, -90], [120, 0], [-120, 0], [-120, -90]],
  [[28, -52], [30, -70], [10, -88]],
];

function heightAt(x, z) {
  if (z >= 10) {
    if (z > 16 && z < 28) return BASE - 0.1; // road below the kerb
    return BASE;
  }
  let h = BASE + 0.25 * Math.sin(x * 0.05) * Math.sin(z * 0.07 + 1) * sstep(10, 0, z);
  h += hill(x, z, P.knoll.x, P.knoll.z, 32, 6);
  h += hill(x, z, -100, -75, 18, 1.8);
  const e = ellipse01(x, z, P.pond.x, P.pond.z, P.pond.rx, P.pond.rz, 0.35);
  if (e > 0) h = lerp(h, -1.0, e);
  return h;
}

function surfaceAt(x, z) {
  if (z < 10) {
    const db = Math.hypot(x - P.bandstand.x, z - P.bandstand.z);
    if (db < 5) return 'wood';
    for (let i = 0; i < PATHS.length; i++) if (pathDist(x, z, PATHS[i]) < 1.6) return 'pavement';
    return 'grass';
  }
  if (z < 42) return 'pavement';
  if (z < 50 && x < 33) return 'rock'; // the cobbled mews
  if (inRect(x, z, P.garden)) return Math.abs(x - 86) < 1.2 || Math.abs(z - 78) < 1.2 ? 'pavement' : 'grass';
  return 'grass';
}

// ---- colliders ----------------------------------------------------------
const terraces = [-45, -15, 15, 48, 78, 108]; // 30 m blocks; the arch is the gap at x 30..33
const oaks = [[-95, -62], [-88, -20], [60, -8], [68, -30], [102, -22], [110, -80], [-10, -82], [42, -80], [-104, -42], [-30, -5], [50, -60]];
const planes = [];
for (let x = -52; x <= 120; x += 18) { planes.push([x, 11.2]); planes.push([x + 9, 31.8]); }

const colliders = [
  // railings with gates at x = 0 and x = -80
  wall(-130, 10, -83, 10, 1.2, 0.15, { pass: 'squeeze' }),
  wall(-77, 10, -3, 10, 1.2, 0.15, { pass: 'squeeze' }),
  wall(3, 10, 130, 10, 1.2, 0.15, { pass: 'squeeze' }),
  // terraces
  box(-30, 37.5, 60, 9, 12), box(15, 37.5, 30, 9, 12), box(78, 37.5, 90, 9, 12), wall(123, 37.5, 130, 37.5, 3, 9),
  // mews houses (two blocks with a passage at x 0..2 to the allotments)
  box(-31, 54, 62, 8, 7), box(21.5, 54, 39, 8, 7),
  // back green fence between the mews end and the gardens
  wall(41, 50, 41, 62, 2.2, 0.3),
  // the walled secret garden: 0.7 m gap in the west wall, 2 m wall on the south side
  wall(62, 62, 62, 77.65, 3.2, 0.5), wall(62, 78.35, 62, 95, 3.2, 0.5),
  wall(62, 62, 110, 62, 2.0, 0.5), wall(110, 62, 110, 95, 3.2, 0.5), wall(62, 95, 110, 95, 3.2, 0.5),
  // the square: column, sentry box, palace gate
  cyl(P.column.x, P.column.z, 2.6, 40),
  box(P.sentry.x, P.sentry.z + 1.6, 1.4, 1.4, 2.8),
  box(-112, 58, 12, 1, 4),
  // coffee cart, bus shelter back panel
  box(P.cart.x, P.cart.z, 2.5, 1.6, 2.4),
  box(P.busstop.x, P.busstop.z + 1.8, 4, 0.3, 2.6),
  // the bandstand roof posts are part of the item; hedges round the knoll
  box(85, -30, 14, 1.2, 1.6), box(-110, -5, 1.2, 14, 1.6),
  // bounds walls behind the gardens
  wall(-130, 100, 130, 100, 3, 0.6),
  ...oaks.map(([x, z]) => cyl(x, z, 0.9, 14)),
  ...planes.map(([x, z]) => cyl(x, z, 0.5, 16)),
];

// ---- scenery --------------------------------------------------------------
const scenery = [
  strip('pavement', -130, 130, 10, 16), strip('road', -130, 130, 16, 28), strip('pavement', -130, 130, 28, 33),
  strip('pavement', -130, -60, 33, 62), // Admiral's Square
  strip('pond', P.pond.x - P.pond.rx, P.pond.x + P.pond.rx, P.pond.z - P.pond.rz, P.pond.z + P.pond.rz),
  ...terraces.map((x, i) => scen('terrace', x, 37.5, PI, 1, { params: { seed: i } })),
  scen('terrace', -31, 54, 0, [2.06, 0.6, 0.9]), scen('terrace', 21.5, 54, 0, [1.3, 0.6, 0.9]),
  scen('parkgate', 0, 10, 0), scen('parkgate', -80, 10, 0),
  ...[-106, -90, -60, -40, -20, 20, 40, 60, 80, 100, 120].map((x) => scen('railings', x, 10, 0, [x === -106 || x === 120 ? 3.8 : 3.3, 1, 1])),
  scen('admiralcolumn', P.column.x, P.column.z, 0),
  scen('sentrybox', P.sentry.x, P.sentry.z + 1.6, PI),
  scen('parkgate', -112, 58, PI, [2, 1.3, 1]),
  scen('coffeecart', P.cart.x, P.cart.z, 0),
  scen('busstop', P.busstop.x, P.busstop.z + 1.4, PI),
  scen('gallerywindow', P.gallery.x, P.gallery.z, PI),
  scen('plaque', P.plaque.x, P.plaque.z - 1.3, 0, 1, { params: { textKey: 'world.w2.plaque' } }),
  scen('hedge', 85, -30, 0, [2.3, 1, 1]), scen('hedge', -110, -5, HALF_PI, [2.3, 1, 1]),
  ...oaks.map(([x, z], i) => scen('oaktree', x, z, i, 0.85 + (i % 3) * 0.1)),
  ...planes.map(([x, z], i) => scen('plane_tree', x, z, i * 0.7, 0.9)),
  ...[[-60, -10], [-25, -78], [100, -50], [-115, -88], [115, 5], [20, -5]].map(([x, z], i) => scen('bush', x, z, i, 1.2)),
  scen('fence', 20, 72, 0), scen('fence', 0, 80, HALF_PI), scen('fence', -30, 72, 0), // allotments
  scen('hedge', 86, 70, 0), scen('hedge', 72, 86, HALF_PI), // the secret garden's beds
  scen('flagpole', -112, 59, 0),
  scen('streetlamp', -100, 15, 0), scen('streetlamp', -85, 50, 0), scen('streetlamp', -70, 20, 0),
];

// ---- items ----------------------------------------------------------------
const TEA = [ // exactly twelve: W2's third star
  [24.8, -36.6], [-38.2, 14.6], [27, -52.5], [72, 29.4], [21.5, 29.3], [-17.5, -20.6],
  [86, 78], [80, 66], [100, 90], [-100, 40], [-30, 46], [-14, 31.2],
];
const anchors = [
  // spawn: a dropped picnic by the gate
  ...cluster(['biscuit', 'crisps', 'scone', 'conker', 'biscuit', 'conker'], 5, -3, 4.5, 24, 'w2spawn'),
  at('newspaper', 0, 5), at('newspaper', -3, 1), at('wellies', 8, 4), at('flowerpot', -6, 6),
  // conkers under every oak
  ...oaks.flatMap(([x, z], i) => cluster(['conker', 'conker', 'conker', 'biscuit'], x, z + 0.5, 4.5, 10, `oak${i}`)),
  // tea mugs (12)
  ...TEA.map(([x, z]) => at('teamug', x, z)),
  // the bandstand and its deckchairs
  at('bandstand', P.bandstand.x, P.bandstand.z),
  ...ring('stripedeckchair', P.bandstand.x, P.bandstand.z, 9.5, 12, 0.2),
  ...cluster(['scone', 'biscuit', 'crisps', 'newspaper'], P.bandstand.x, P.bandstand.z, 13, 16, 'band'),
  // benches and bins along the paths
  ...[[6, -14], [-10, -24], [-55, -22], [-76, -46], [-46, -68], [44, -24], [66, -42], [-64, -10], [0, -84], [100, -88]].flatMap(([x, z], i) => [
    at('bench', x, z, { rot: i * 0.8 }), at('parkbin', x + 2.2, z + 0.4), ...cluster(['crisps', 'biscuit', 'newspaper'], x, z, 2.2, 3, `bench${i}`),
  ]),
  at('bench', P.plaque.x, P.plaque.z, { rot: PI }), // L10's bench
  // ducks on the pond
  ...ring('rubberduck', P.pond.x, P.pond.z, 8, 6, 0.4), at('rubberduck', P.pond.x - 14, P.pond.z + 3), at('rubberduck', P.pond.x + 12, P.pond.z - 4),
  // the knoll: kites, picnics, a lost welly
  ...cluster(['scone', 'crisps', 'wellies', 'biscuit', 'newspaper'], P.knoll.x, P.knoll.z, 10, 14, 'knoll'),
  // the squirrel's stash
  ...cluster(['conker', 'scone', 'conker'], P.squirrel.x, P.squirrel.z, 3, 6, 'squirrel'),
  // street: lampposts, cabs, buses, roadworks
  ...[-100, -60, -20, 20, 60, 100].map((x) => at('lamppost', x, 14.6)),
  ...[-80, -40, 0, 40, 90, 118].map((x) => at('lamppost', x, 29.6)),
  ...[-110, -70, -10, 30, 100].map((x, i) => at('taxi', x, 18.6, { rot: i % 2 ? -HALF_PI : HALF_PI })),
  at('taxi', -60, 25.6, { rot: -HALF_PI }), at('taxi', 115, 25.6, { rot: -HALF_PI }),
  at('doubledecker', 52, 24.5, { rot: -HALF_PI }), at('doubledecker', -96, 18.8, { rot: HALF_PI }),
  ...cluster(['trafficcone', 'trafficcone', 'cable', 'trafficcone', 'router'], -24, 21.5, 3.5, 9, 'roadworks'),
  at('phonebox', P.phonebox.x, P.phonebox.z), at('phonebox', -120, 30),
  at('postbox', P.postbox.x, P.postbox.z), at('postbox', -70, 14.2), at('postbox', 104, 30.6),
  ...row('flowerpot', -55, 32.6, 120, 32.6, 22),
  // brollies by the bus stop and the queue (L8)
  ...cluster(['brolly'], P.busstop.x, P.busstop.z - 1.2, 3, 3, 'brolly1'), ...cluster(['brolly'], -32, 14.2, 3, 3, 'brolly2'),
  at('brolly', -95, 26), at('brolly', 15, 14),
  at('parkbin', 64, 29.8), at('parkbin', -46, 14.4), at('parkbin', -88, 40),
  // Admiral's Square
  ...cluster(['newspaper', 'crisps', 'biscuit', 'scone'], P.column.x, P.column.z, 9, 14, 'square'),
  ...row('bench', -118, 36, -118, 52, 3, { rot: HALF_PI }),
  // the mews: cobbles, bins, a router in a wall box, cables
  at('router', -10, 43), at('router', 20, 49.2), at('cable', 5, 46), at('cable', -40, 47),
  ...cluster(['parkbin', 'newspaper', 'wellies', 'flowerpot', 'crisps', 'biscuit'], -20, 46, 3, 14, 'mews'),
  // allotments
  ...cluster(['wellies', 'flowerpot', 'trafficcone', 'conker', 'scone', 'crisps'], 0, 80, 17, 30, 'allot'),
  // the secret garden: a tea party for nobody, and a golden rubber duck in the birdbath
  at('rubberduck', 86, 78.6, { golden: true }),
  ...cluster(['scone', 'scone', 'biscuit', 'crisps', 'flowerpot'], 80, 72, 6, 16, 'garden1'),
  ...cluster(['scone', 'biscuit', 'stripedeckchair', 'flowerpot', 'brolly'], 98, 84, 6, 10, 'garden2'),
  // the back green
  ...cluster(['wellies', 'flowerpot', 'parkbin', 'newspaper', 'bench'], 85, 51, 7, 14, 'green'),
];

const fill = [
  { types: ['conker', 'biscuit', 'crisps', 'scone'], count: 120, region: { minX: -125, maxX: 125, minZ: -95, maxZ: 8 }, avoidWater: true },
  { types: ['biscuit', 'conker', 'crisps'], count: 30, region: { x: 2, z: -6, r: 14 } },
  { types: ['newspaper', 'wellies', 'flowerpot', 'trafficcone', 'crisps'], count: 50, region: { minX: -125, maxX: 125, minZ: 11, maxZ: 32.5 } },
  { types: ['newspaper', 'wellies', 'flowerpot', 'stripedeckchair', 'parkbin', 'trafficcone'], count: 40, region: { minX: -120, maxX: 120, minZ: -92, maxZ: 6 }, avoidWater: true },
];

export const W2 = {
  id: 'w2', index: 2,
  nameKey: 'world.w2.name', introKey: 'world.w2.intro', outroKey: 'world.w2.outro',
  music: 'w2', ambience: 'park',
  palette: {
    skyTop: '#9cc3e0', skyBottom: '#e8eef0', horizon: '#dfe6e6', fog: '#d6dfe0', fogNear: 60, fogFar: 320,
    sun: '#fff4e0', sunIntensity: 1.7, ambient: '#c4d2dc', ground: '#7fb35e', accent: '#d8343a',
    water: '#6aa8a8', waterDeep: '#3d7880', foam: '#e8f4f0', outline: '#2c2a2a',
  },
  timeOfDay: { start: 0.42, end: 0.5 },
  bounds: { minX: -130, maxX: 130, minZ: -100, maxZ: 100 },
  spawn: { x: P.spawn.x, z: P.spawn.z, yaw: PI },
  heightAt, surfaceAt,
  water: [{ kind: 'pond', level: 0.1, rect: { minX: P.pond.x - P.pond.rx, maxX: P.pond.x + P.pond.rx, minZ: P.pond.z - P.pond.rz, maxZ: P.pond.z + P.pond.rz } }],
  colliders, scenery,
  items: { anchors: settleAnchors(anchors, colliders), fill },
  zones: [
    { id: 'phonebox', x: P.phonebox.x, z: P.phonebox.z - 2, r: 1.4 },
    { id: 'busstop', x: P.busstop.x, z: P.busstop.z, r: 2.4 },
    { id: 'queueFront', x: P.cart.x + 2.4, z: P.cart.z, r: 0.9 },
    { id: 'plaque', x: P.plaque.x, z: P.plaque.z + 1.4, r: 1.6 },
    { id: 'gallery', x: P.gallery.x, z: P.gallery.z - 1.8, r: 1.6 },
    { id: 'gardenGap', x: 62.6, z: 78, r: 1.0 },
    { id: 'garden', x: 86, z: 78, r: 16 },
    { id: 'mews', x: -15, z: 46, r: 6 },
    { id: 'square', x: P.column.x, z: P.column.z, r: 18 },
  ],
  hazards: [
    ...P.puddles.map((p, i) => ({ kind: 'puddle', id: `puddle${i + 1}`, x: p.x, z: p.z, r: p.r })),
    { kind: 'hose', id: 'hose', x: 52, z: -8, len: 7, arc: 1.2, period: 6, yaw: -HALF_PI },
    { kind: 'jogger', id: 'jogger', path: PATHS[4], speed: 3.4, r: 0.7 },
    { kind: 'pigeons', id: 'squareSquad', x: P.column.x + 6, z: P.column.z - 6, r: 8, count: 8 },
    { kind: 'pigeons', id: 'bandSquad', x: P.bandstand.x, z: P.bandstand.z + 12, r: 5, count: 5 },
  ],
  cast: [
    { id: 'gerald', speaker: 'gerald', kind: 'critter', mesh: 'gerald', x: 7, z: -14, yaw: 0, behaviour: 'gerald',
      params: { disguise: 'bowler', spots: [[7, -13], [P.bandstand.x, P.bandstand.z + 6], [70, 28], [-88, 26], [-20, 47], [85, -55]], approachR: 4 } },
    { id: 'nigel', speaker: 'nigel', kind: 'critter', mesh: 'nigel', x: P.column.x, z: P.column.z, yaw: 0, behaviour: 'idle', params: { anim: 'idle', perchY: 40 } },
    { id: 'marco', speaker: 'marco', kind: 'human', mesh: 'marco', x: -85, z: -5, yaw: HALF_PI, behaviour: 'marco',
      params: { path: [[-85, -5], [100, -5], [100, -85], [-85, -85]], speed: 3.2 } },
    { id: 'pru', speaker: 'pru', kind: 'human', mesh: 'pru', x: 24, z: -37.6, yaw: PI, behaviour: 'idle', params: { anim: 'sit', react: 'wave', reactR: 4 } },
    { id: 'sentry', speaker: 'sentry', kind: 'human', mesh: 'sentry', x: P.sentry.x, z: P.sentry.z, yaw: PI, behaviour: 'idle', params: { anim: 'idle' } },
    { id: 'squirrel', speaker: 'squirrel', kind: 'critter', mesh: 'squirrel', x: P.squirrel.x, z: P.squirrel.z, yaw: 0, behaviour: 'react', params: { react: 'flee', r: 5 } },
  ],
  crowd: [
    ...[0, 1, 2, 3, 4].map((i) => ({ id: `q${i + 1}`, kind: 'queuer', x: P.cart.x + 3.6 + i * 1.3, z: P.cart.z, yaw: -HALF_PI, behaviour: 'idle', params: { anim: 'idle', react: 'tut', reactR: 1.5 } })),
    { id: 'comm1', kind: 'commuter', x: P.busstop.x - 1, z: P.busstop.z, yaw: PI, behaviour: 'idle', params: { anim: 'idle', react: 'tut', reactR: 2 } },
    { id: 'comm2', kind: 'commuter', x: P.busstop.x + 1.2, z: P.busstop.z + 0.4, yaw: PI, behaviour: 'read' },
    { id: 'comm3', kind: 'commuter', x: -100, z: 13, yaw: HALF_PI, behaviour: 'pathLoop', params: { path: [[-120, 13], [120, 13]], speed: 1.4, pingPong: true, react: 'tut' } },
    { id: 'comm4', kind: 'commuter', x: 100, z: 30.5, yaw: -HALF_PI, behaviour: 'pathLoop', params: { path: [[120, 30.5], [-55, 30.5]], speed: 1.3, pingPong: true, react: 'tut' } },
    { id: 'comm5', kind: 'commuter', x: 2, z: -2, yaw: 0, behaviour: 'pathLoop', params: { path: PATHS[0], speed: 1.2, pingPong: true, react: 'tut' } },
    { id: 'kid1', kind: 'kid', x: -22, z: -36, yaw: -1.2, behaviour: 'idle', params: { anim: 'throw', react: 'cheer', reactR: 3 } },
    { id: 'tour1', kind: 'tourist', x: P.column.x + 6, z: P.column.z + 4, yaw: PI, behaviour: 'wander', params: { r: 8, speed: 0.7, react: 'wave' } },
    { id: 'tour2', kind: 'tourist', x: P.column.x - 5, z: P.column.z + 8, yaw: 0, behaviour: 'idle', params: { anim: 'point', react: 'wave', reactR: 3 } },
    { id: 'reader2', kind: 'reader', x: 44, z: -24.8, yaw: 0, behaviour: 'idle', params: { anim: 'read', react: 'tut', reactR: 2 } },
    ...[0, 1, 2, 3].map((i) => ({ id: `duckling${i + 1}`, kind: 'duckling', x: P.pond.x + i * 2, z: P.pond.z + 2, yaw: 0, behaviour: 'wander', params: { r: 9, speed: 0.6 } })),
  ],
  flocks: [
    { kind: 'pigeon', count: 12, x: P.column.x, z: P.column.z, r: 14 },
    { kind: 'pigeon', count: 6, x: 0, z: -30, r: 20 },
  ],
  activities: [
    { kind: 'fetch', x: 40, z: -70, params: { thrower: 'marco', r: 10, reward: 20 } },
    { kind: 'herding', x: P.column.x + 10, z: 22, params: { ring: { x: P.column.x + 14, z: 20, r: 3 }, count: 6, time: 45, reward: 30 } },
    { kind: 'sniffTrail', x: -10, z: 46, params: { item: 'biscuit', count: 8, time: 25, path: [[-10, 46], [-25, 47], [-40, 45], [-55, 47], [-70, 46], [-85, 44]], reward: 20 } },
    { kind: 'sitStay', x: 18, z: -45, params: { npc: 'gerald', time: 6, reward: 25 } },
  ],
  eggs: makeEggsW2(P),
  goals: {
    start: 0.4, goal: 8, stretch: 12, timer: 330, par: 240, growthK: 1.6,
    milestones: [0.8, 1.5, 3, 5, 10],
    star3: { kind: 'collectAll', type: 'teamug', count: 12 },
  },
  weather: ['rain', 'rain', 'clear', 'fog'],
  golden: { type: 'scone', eggId: 'L7' },
};
