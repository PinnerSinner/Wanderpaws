// W1 Copacabana Promenade. Morning. 140 x 100 m.
//
// Layout (z runs from the sea, negative, to the city, positive; x along the beach):
//   z < -17   the Atlantic, with a tide that walks the shoreline up and down the wet sand
//   -24..-7   the beach: kiosks, footvolley and volleyball, the lifeguard tower (posto),
//             sunbathers, the Sugarloaf sandcastle
//   -7..0     THE SPINE: the black-and-white wave promenade
//   0..2.5    the red cycle lane (cyclists!)
//   2.5..16   Avenida, closed to traffic on a Sunday morning, palm-lined central reservation
//   16..20    the building-side mosaic pavement
//   20..38    seafront hotels and flats; a side street to the west, a 0.6 m alley to a
//             secret pool courtyard, and a back lane shortcut behind the blocks
//   x > 60    the Arpoador-ish rocks hide a cove with the 127.0.0.1 beach hut
// Sugarloaf sits on the horizon to the south-west.

import { box, cyl, scen, strip, span, wall, at, row, ring, cluster, sstep, lerp, hill, ripple, rect01, PI, HALF_PI } from './util.js';
import { settleAnchors } from './layout.js';
import { makeEggsW1 } from './eggs/w1.js';

const SEA_LEVEL = -0.3;
const CITY_H = 0.4;

// Key positions (shared with the eggs).
export const P = {
  spawn: { x: 4, z: -3.5 },
  k1: { x: -32, z: -10 }, k2: { x: 10, z: -10 }, k3: { x: 44, z: -10 },
  router: { x: 13.2, z: -8.2 },
  tower: { x: -12, z: -15.5 },
  net: { x: 24, z: -16 }, ball: { x: 20.5, z: -16 },
  vnet: { x: -48, z: -16 },
  castle: { x: -28, z: -18.6 },
  hut: { x: 65, z: -19 },
  caipi: { x: -56, z: -5.2 },
  coconut: { x: 32, z: -5.2 },
  reader: { x: -3, z: -18.5 },
  penguin: { x: 47.4, z: -19.2 },
  mosaic: { x: -20, z: -3.5 },
  pool: { minX: 26, maxX: 35, minZ: 41.5, maxZ: 46.5 },
  fireworks: { x: 0, z: -120 },
};

function heightAt(x, z) {
  if (z >= -7) {
    let h = CITY_H;
    if (z > 40 && x > 25 && x < 36) h -= 1.2 * rect01(x, z, P.pool.minX + 0.5, P.pool.maxX - 0.5, P.pool.minZ + 0.5, P.pool.maxZ - 0.5, 0.5);
    return h;
  }
  let h;
  if (z > -8) h = lerp(0.15, CITY_H, sstep(-8, -7, z));
  else if (z > -19) h = (z + 19) / 11 * 0.15;
  else if (z > -30) h = (z + 19) * 0.055;
  else h = -0.605 + (z + 30) * 0.12;
  if (z > -19 && z < -7.5) {
    const dry = sstep(-19, -16, z) * (1 - sstep(-9, -7.5, z));
    h += ripple(x, z, 0.035, 0.7) * dry;
    h += hill(x, z, -42, -12.5, 4.5, 0.45) + hill(x, z, 52, -14, 4.5, 0.5) + hill(x, z, -4, -13, 3.5, 0.22);
  }
  return h;
}

function surfaceAt(x, z) {
  if (z < -7.3) return 'sand';
  if (z < 2.5) return 'pavement';
  if (z < 16) return z > 8.6 && z < 9.9 ? 'grass' : 'pavement';
  if (z > 36 && x > 22 && x < 38.6) {
    if (x > 24.5 && x < 36.5 && z > 39.5 && z < 48.5) return 'wood';
    return 'grass';
  }
  return 'pavement';
}

// ---- buildings --------------------------------------------------------
const blocks = [
  { mesh: 'apartmentblock', x: -60, z: 29, w: 16, d: 14, h: 40 },
  { mesh: 'hotelblock', x: -40, z: 30, w: 24, d: 16, h: 30 },
  // side street x -28..-18
  { mesh: 'apartmentblock', x: -10, z: 29, w: 16, d: 14, h: 40 },
  { mesh: 'hotelblock', x: 10, z: 30, w: 24, d: 16, h: 30 },
  // the 0.6 m alley x 22..22.6
  { mesh: 'apartmentblock', x: 30.6, z: 29, w: 16, d: 14, h: 40 },
  { mesh: 'hotelblock', x: 50.6, z: 30, w: 24, d: 16, h: 30 },
  // east street x 62.6..70
];

const colliders = [
  ...blocks.map((b) => box(b.x, b.z, b.w, b.d, b.h)),
  // beach kiosks (scenery versions) and stalls
  cyl(P.k1.x, P.k1.z, 1.9, 3.2), cyl(P.k2.x, P.k2.z, 1.9, 3.2), cyl(P.k3.x, P.k3.z, 1.9, 3.2),
  box(P.caipi.x, P.caipi.z - 1.2, 3, 2, 2.6),
  box(P.coconut.x, P.coconut.z - 1.2, 3, 2, 2.6),
  box(P.tower.x, P.tower.z, 3, 3, 6),
  cyl(-20, -8.4, 0.3, 2.5), cyl(36, -8.4, 0.3, 2.5), // beach showers
  // beach hut with an open door facing west (U of three walls)
  box(P.hut.x + 1.4, P.hut.z, 0.2, 3, 3), box(P.hut.x, P.hut.z - 1.4, 3, 0.2, 3), box(P.hut.x, P.hut.z + 1.4, 3, 0.2, 3),
  // Arpoador rocks: a crack for small animals, a low ledge by the sea for big ones, swim round for swimmers
  wall(60, -7.6, 60, -14.6, 2.6, 1.4), wall(60, -15.6, 60, -24, 2.6, 1.4), wall(60, -24, 60, -28.5, 1.3, 1.4),
  wall(60, -7.6, 70, -7.6, 2.6, 1.2),
  // secret pool courtyard behind the flats: alley in from the south, cat-flap from the west back lane,
  // a 1.3 m garden wall to the east that big animals simply step over
  wall(22, 38, 22, 43.4, 3.2, 0.4), box(22, 44, 0.15, 1.2, 2.2, 0, { pass: 'squeeze' }), wall(22, 44.6, 22, 50, 3.2, 0.4),
  wall(38.6, 38, 38.6, 50, 1.3, 0.4),
  wall(-70, 50, 70, 50, 3, 0.6),
  // padaria tables on the side street have little umbrellas, nothing solid
];
// palms on the central reservation, lamps along the promenade
const palms = [];
for (let x = -64; x <= 64; x += 12) palms.push([x + 2, 9.25]);
const lamps = [];
for (let x = -64; x <= 56; x += 16) lamps.push([x, -0.3]);
for (const [x, z] of palms) colliders.push(cyl(x, z, 0.3, 9));
for (const [x, z] of lamps) colliders.push(cyl(x, z, 0.15, 5));

// ---- scenery ------------------------------------------------------------
const scenery = [
  strip('wavepavement', -70, 70, -7, 0),
  strip('cyclelane', -70, 70, 0, 2.5),
  strip('avenue', -70, 70, 2.5, 16),
  strip('wavepavement', -70, 70, 16, 20),
  strip('pavement', -28, -18, 20, 50),
  strip('pavement', 62.6, 70, 20, 50),
  strip('pavement', -70, 22, 38, 50),
  strip('pavement', 38.6, 70, 38, 50),
  strip('pond', P.pool.minX, P.pool.maxX, P.pool.minZ, P.pool.maxZ),
  ...blocks.map((b) => scen(b.mesh, b.x, b.z, PI, 1)),
  scen('kioskbig', P.k1.x, P.k1.z, 0.3), scen('kioskbig', P.k2.x, P.k2.z, -0.2), scen('kioskbig', P.k3.x, P.k3.z, 0.5),
  scen('caipistand', P.caipi.x, P.caipi.z - 1.2, 0),
  scen('coconutstall', P.coconut.x, P.coconut.z - 1.2, 0),
  scen('lifeguardtower', P.tower.x, P.tower.z, 0),
  scen('flagpole', P.tower.x + 2.4, P.tower.z - 1.4, 0),
  scen('showertap', -20, -8.4), scen('showertap', 36, -8.4),
  scen('footvolleycourt', P.net.x, P.net.z, 0),
  scen('footvolleycourt', P.vnet.x, P.vnet.z, 0),
  scen('beachhut', P.hut.x, P.hut.z, -HALF_PI),
  scen('sugarloaf', -330, -380, 0.3, 1),
  scen('rock', 140, -210, 0, 9), scen('rock', 175, -235, 1, 6), scen('rock', 110, -260, 2, 5), // islands offshore
  scen('rock', 60, -9, 0, 1.4), scen('rock', 60.4, -12.5, 1, 1.5), scen('rock', 59.6, -18, 2, 1.6), scen('rock', 60.3, -21.5, 3, 1.5),
  scen('rock', 60, -26, 4, 1.0), scen('rock', 64, -7.8, 5, 1.6), scen('rock', 68, -7.6, 6, 1.7), scen('rock', 67, -29, 1, 1.2),
  scen('rock', -68, -10, 2, 1.6), scen('rock', -66, -26, 1, 1.3),
  scen('plaque', P.mosaic.x, P.mosaic.z, 0, 1, { params: { textKey: 'world.w1.mosaic' }, y: 0.4 }),
  span('bunting', P.k3.x - 6, -8, P.k3.x + 6, -8, 12),
  span('bunting', P.net.x, -20.5, P.net.x, -11.5, 12),
  scen('bush', 24, 39), scen('bush', 37, 39), scen('bush', 24, 49), scen('bush', 37, 49),
  scen('palm', 25, 48, 0, 0.8), scen('palm', 37, 41, 0, 0.7),
  ...palms.map(([x, z], i) => scen('palm', x, z, i * 1.3, 0.9 + (i % 3) * 0.08)),
  ...lamps.map(([x, z]) => scen('streetlamp', x, z, 0)),
  scen('palm', -50, -6.5, 0.4, 0.85), scen('palm', 22, -6.4, 1.2, 0.9), scen('palm', 56, -6.6, 2, 0.8),
];
colliders.push(cyl(-50, -6.5, 0.3, 9), cyl(22, -6.4, 0.3, 9), cyl(56, -6.6, 0.3, 9));

// ---- items ----------------------------------------------------------------
const snacks = ['pastel', 'brigadeiro', 'bottlecap', 'caipirinha', 'brigadeiro', 'coconut', 'bottlecap'];
const anchors = [
  // around spawn: a scatter of crumbs and caps on the promenade, and coconuts just too big (almost!)
  ...cluster(['bottlecap', 'brigadeiro', 'seashell', 'bottlecap', 'pastel', 'brigadeiro'], 6, -4, 5.5, 22, 'w1spawn'),
  at('coconut', 8.5, -6.2), at('coconut', 1, -6.5), at('flipflop', -2, -5.8), at('flipflop', -1.3, -5.6, { rot: 0.4 }),
  at('icelolly', 3, -1.4), at('icelolly', 9, -1.2), at('teamug', 5.5, -0.8),
  // K1: Auntie Pru's kiosk, with tables
  at('kiosktable', -36.5, -11.5), ...cluster(snacks, -36.5, -11.5, 1.6, 7, 'k1a'),
  at('kiosktable', -28, -12.8), ...cluster(snacks, -28, -12.8, 1.6, 7, 'k1b'),
  at('kiosktable', -33, -14.8), ...cluster(snacks, -33, -14.8, 1.6, 6, 'k1c'),
  at('teamug', -28.6, -12.2), at('teamug', -36, -11.0), at('cable', -29.5, -9.2), at('router', -34.6, -8.6),
  // K2 by spawn, with the Morse-blinking router (C1)
  at('router', P.router.x, P.router.z),
  at('kiosktable', 6.5, -12.2), ...cluster(snacks, 6.5, -12.2, 1.6, 7, 'k2a'),
  at('kiosktable', 13.8, -12.6), ...cluster(snacks, 13.8, -12.6, 1.6, 7, 'k2b'),
  at('kiosktable', 10, -14.8), ...cluster(snacks, 10, -14.8, 1.6, 6, 'k2c'),
  at('cable', 7.6, -8.4), at('teamug', 13.2, -12.0),
  // K3 with surf rental
  at('kiosktable', 40.5, -12.2), ...cluster(snacks, 40.5, -12.2, 1.6, 7, 'k3a'),
  at('kiosktable', 47.5, -12.6), ...cluster(snacks, 47.5, -12.6, 1.6, 7, 'k3b'),
  at('surfboard', 41, -7.8, { rot: HALF_PI }), at('surfboard', 43, -7.8, { rot: HALF_PI }), at('surfboard', 45, -7.8, { rot: HALF_PI }),
  at('router', 46.5, -8.4), at('teamug', 47, -12.0),
  // caipirinha stand ("lime squash, honest") and coconut stall
  ...cluster(['caipirinha', 'caipirinha', 'bottlecap', 'caipirinha'], P.caipi.x, P.caipi.z + 1.6, 1.8, 8, 'caipi'),
  ...cluster(['coconut', 'coconut', 'bottlecap'], P.coconut.x + 2.6, P.coconut.z + 0.4, 1.0, 5, 'coco'),
  // footvolley (C5) and volleyball
  at('volleynet', P.net.x, P.net.z, { rot: HALF_PI }), at('football', P.ball.x, P.ball.z),
  at('volleynet', P.vnet.x, P.vnet.z, { rot: HALF_PI }), at('beachball', P.vnet.x - 3, P.vnet.z + 1), at('beachball', P.vnet.x + 5, P.vnet.z - 2),
  // lifeguard posto
  at('lifebuoy', P.tower.x + 2.2, P.tower.z + 1.8), at('lifebuoy', P.tower.x - 2.2, P.tower.z + 1.8),
  at('surfboard', P.tower.x + 3.5, P.tower.z - 2, { rot: 0.3 }), at('coolbox', P.tower.x - 2.6, P.tower.z - 1.5),
  // the Sugarloaf sandcastle (C6) with buckets and spades
  at('sandcastle', P.castle.x, P.castle.z),
  ...ring('bucketspade', P.castle.x, P.castle.z, 1.9, 4, 0.5),
  // Magellanic penguin's parasol (C7)
  at('parasol', P.penguin.x + 1.1, P.penguin.z - 1.1), at('towel', P.penguin.x + 0.4, P.penguin.z + 0.6), at('icelolly', P.penguin.x - 0.8, P.penguin.z + 0.3),
  // sunbathers' camps: towel, parasol, cool box, flip-flops, sun hat
  ...[[-20, -14], [-5, -16], [6, -17.2], [36, -16.5], [-40, -18.4], [50, -15.5], [-62, -14], [-3, -18.2]].flatMap(([x, z], i) => [
    at('towel', x, z, { rot: i * 0.7 }), at('parasol', x + 1.8, z - 0.8), at('flipflop', x - 1.2, z + 0.9, { rot: i }),
    at(i % 2 ? 'coolbox' : 'sunhat', x + 1.5, z + 1.2), at('sunglasses', x - 0.6, z - 1.1),
  ]),
  // deckchairs in rows near K1 and K3
  ...row('deckchair', -46, -12, -40, -12, 4, { rot: PI }), ...row('deckchair', 32, -13.5, 37, -13.5, 3, { rot: PI }),
  // bicycles parked between the cycle lane and the avenue; bollards along the edge
  ...row('bicycle', -44, 3.3, -39, 3.3, 4, { rot: HALF_PI }), ...row('bicycle', 36, 3.3, 39.6, 3.3, 3, { rot: HALF_PI }),
  ...[-60, -52, -32, -24, -8, 0, 16, 24, 48, 56].map((x) => at('bollard', x, 2.8)),
  // drinks kiosks (gobble-able finale) on the building side and the far beach
  at('kiosk', -50, 18), at('kiosk', -5, 18), at('kiosk', 44, 18), at('kiosk', -63, -11),
  // padaria tables on the side street
  ...cluster(['kiosktable', 'pastel', 'teamug', 'biscuitpacket', 'brigadeiro', 'pastel'], -23, 27, 2.5, 6, 'pad1'),
  ...cluster(['kiosktable', 'pastel', 'biscuitpacket', 'bottlecap', 'brigadeiro', 'icelolly'], -23, 34, 2.5, 6, 'pad2'),
  ...cluster(['bottlecap', 'pastel', 'biscuitpacket', 'cable'], -23, 44, 3, 8, 'pad3'),
  // back lanes
  ...cluster(['bottlecap', 'coolbox', 'cable', 'router', 'bicycle', 'flipflop'], -45, 44, 4.5, 10, 'lane1'),
  ...cluster(['bottlecap', 'cable', 'surfboard', 'coolbox', 'parasol'], 54, 44, 4.5, 8, 'lane2'),
  // the secret pool courtyard: party leftovers and a golden rubber duck
  ...cluster(['brigadeiro', 'pastel', 'caipirinha', 'sunglasses', 'brigadeiro', 'bottlecap', 'icelolly', 'teamug'], 30, 39.4, 1.6, 12, 'pool1'),
  ...cluster(['brigadeiro', 'pastel', 'sunglasses', 'bottlecap'], 25, 44, 1.8, 10, 'pool3'),
  ...row('deckchair', 27, 48.4, 34, 48.4, 4, { rot: PI }), at('towel', 36.8, 44), at('lifebuoy', 36.8, 41.5), at('sunhat', 24.5, 41),
  at('rubberduck', 30.5, 44, { golden: true }), at('rubberduck', 33, 43), at('rubberduck', 28, 45.5),
  // the cove behind the rocks: shells, a stray surfboard, coconuts
  ...cluster(['seashell', 'seashell', 'coconut', 'flipflop', 'seashell', 'bottlecap'], 65, -14, 4, 14, 'cove'),
  at('surfboard', 66, -20.5, { rot: 1 }), at('sunhat', 63, -12), at('rubberduck', 64, -27),
  // rubber ducks bobbing in the shallows
  ...[[-50, -23], [-15, -24], [18, -25], [40, -24], [-35, -26]].map(([x, z]) => at('rubberduck', x, z)),
  // tourist tea (G8)
  at('teamug', -45, -3), at('teamug', 28, -2), at('teamug', -10, 17.5), at('teamug', 52, 17.5),
];

const fill = [
  { types: ['seashell', 'seashell', 'bottlecap'], count: 80, region: { minX: -58, maxX: 58, minZ: -24, maxZ: -8 }, avoidWater: true },
  { types: ['bottlecap', 'brigadeiro', 'seashell'], count: 45, region: { minX: -25, maxX: 35, minZ: -7, maxZ: 0 } },
  { types: ['bottlecap', 'brigadeiro', 'pastel'], count: 30, region: { x: 4, z: -6, r: 13 } },
  { types: ['flipflop', 'sunglasses', 'icelolly', 'coconut', 'bucketspade', 'biscuitpacket'], count: 80, region: { minX: -58, maxX: 58, minZ: -22, maxZ: -8 }, avoidWater: true },
  { types: ['sunhat', 'beachball', 'coolbox', 'towel', 'football'], count: 34, region: { minX: -58, maxX: 58, minZ: -22, maxZ: -8.5 }, avoidWater: true },
  { types: ['bottlecap', 'icelolly', 'pastel', 'biscuitpacket', 'sunglasses'], count: 40, region: { minX: -68, maxX: 68, minZ: 3.5, maxZ: 19.5 } },
  { types: ['deckchair', 'parasol', 'lifebuoy', 'surfboard'], count: 14, region: { minX: -56, maxX: 56, minZ: -21, maxZ: -9 }, avoidWater: true },
];

export const W1 = {
  id: 'w1', index: 1,
  nameKey: 'world.w1.name', introKey: 'world.w1.intro', outroKey: 'world.w1.outro',
  music: 'w1', ambience: 'beach',
  palette: {
    skyTop: '#6ec3ee', skyBottom: '#fff0c8', horizon: '#ffe6b8', fog: '#ffe9c4', fogNear: 45, fogFar: 260,
    sun: '#fff1d0', sunIntensity: 2.2, ambient: '#bfdcf2', ground: '#f2dcae', accent: '#ff7a59',
    water: '#3cc8c8', waterDeep: '#1e86a8', foam: '#ffffff', outline: '#3a2a22',
  },
  timeOfDay: { start: 0.3, end: 0.4 },
  bounds: { minX: -70, maxX: 70, minZ: -50, maxZ: 50 },
  spawn: { x: P.spawn.x, z: P.spawn.z, yaw: HALF_PI },
  heightAt, surfaceAt,
  water: [
    { kind: 'sea', level: SEA_LEVEL, rect: { minX: -700, maxX: 700, minZ: -700, maxZ: -17 }, tide: { amp: 0.15, period: 80 } },
    { kind: 'pond', level: 0.2, rect: { ...P.pool } },
  ],
  colliders, scenery,
  items: { anchors: settleAnchors(anchors, colliders), fill },
  zones: [
    { id: 'hut127', x: P.hut.x, z: P.hut.z, r: 1.2 },
    { id: 'coconut', x: P.coconut.x, z: P.coconut.z + 1.8, r: 1.6 },
    { id: 'reader', x: P.reader.x, z: P.reader.z, r: 2.5 },
    { id: 'tower', x: P.tower.x, z: P.tower.z, r: 9 },
    { id: 'mosaic', x: P.mosaic.x, z: P.mosaic.z, r: 1.5 },
    { id: 'footvolley', x: P.net.x, z: P.net.z, r: 8 },
    { id: 'courtyard', x: 30, z: 43, r: 8 },
    { id: 'cove', x: 65, z: -17, r: 6 },
  ],
  hazards: [
    { kind: 'tide' },
    { kind: 'cyclist', id: 'cyclist1', path: [[-68, 0.7], [68, 0.7], [68, 1.9], [-68, 1.9]], speed: 5, r: 0.8 },
    { kind: 'cyclist', id: 'cyclist2', path: [[68, 1.9], [-68, 1.9], [-68, 0.7], [68, 0.7]], speed: 4.2, r: 0.8 },
    { kind: 'pigeons', id: 'squad1', x: -8, z: 6, r: 6, count: 7 },
    { kind: 'pigeons', id: 'squad2', x: 44, z: -4, r: 5, count: 5 },
  ],
  cast: [
    { id: 'gerald', speaker: 'gerald', kind: 'critter', mesh: 'gerald', x: 18, z: -3, yaw: 0, behaviour: 'gerald',
      params: { disguise: 'touristhat', spots: [[18, -3], [-8, 4], [-30, -6], [44, -5], [10, -20], [-55, 10]], approachR: 4 } },
    { id: 'marco', speaker: 'marco', kind: 'human', mesh: 'marco', x: -40, z: -2, yaw: HALF_PI, behaviour: 'marco',
      params: { path: [[-64, -2], [58, -2], [58, 6], [-64, 6]], speed: 3, throwEvery: 0 } },
    { id: 'kev', speaker: 'kev', kind: 'human', mesh: 'kev', x: P.tower.x, z: P.tower.z, yaw: PI, behaviour: 'idle',
      params: { anim: 'idle', perchY: 3.2, react: 'wave', reactR: 6 } },
    { id: 'ze', speaker: 'ze', kind: 'human', mesh: 'ze', x: -20, z: -12.5, yaw: HALF_PI, behaviour: 'pathLoop',
      params: { path: [[-30, -12.5], [-10, -18], [20, -13], [50, -18]], speed: 0.9, pingPong: true, anim: 'sell' } },
    { id: 'pru', speaker: 'pru', kind: 'human', mesh: 'pru', x: -29.4, z: -13.8, yaw: 0.4, behaviour: 'idle', params: { anim: 'sit', react: 'wave', reactR: 4 } },
    { id: 'magpenguin', speaker: 'magpenguin', kind: 'critter', mesh: 'magpenguin', x: P.penguin.x, z: P.penguin.z, yaw: 0, behaviour: 'idle', params: { anim: 'sit' } },
    { id: 'coco', speaker: 'coco', kind: 'human', mesh: 'vendor', x: P.coconut.x, z: P.coconut.z - 2.6, yaw: 0, behaviour: 'vendor', params: { anim: 'sell' } },
    { id: 'reader', speaker: 'reader', kind: 'human', mesh: 'reader', x: P.reader.x, z: P.reader.z, yaw: 0.3, behaviour: 'idle', params: { anim: 'read' } },
  ],
  crowd: [
    ...[[-20, -14], [-5, -16], [6, -17.2], [36, -16.5], [-40, -18.4], [50, -15.5], [-62, -14]].map(([x, z], i) => (
      { id: `sb${i + 1}`, kind: 'sunbather', x, z, yaw: i, behaviour: 'idle', params: { anim: 'lie', react: 'wave', reactR: 2 } })),
    { id: 'fv1', kind: 'footvolleyer', x: P.net.x - 5, z: P.net.z + 2, yaw: HALF_PI, behaviour: 'react', params: { react: 'cheer', r: 5 } },
    { id: 'fv2', kind: 'footvolleyer', x: P.net.x - 5, z: P.net.z - 2, yaw: HALF_PI, behaviour: 'react', params: { react: 'cheer', r: 5 } },
    { id: 'fv3', kind: 'footvolleyer', x: P.net.x + 5, z: P.net.z + 2, yaw: -HALF_PI, behaviour: 'react', params: { react: 'cheer', r: 5 } },
    { id: 'fv4', kind: 'footvolleyer', x: P.net.x + 5, z: P.net.z - 2, yaw: -HALF_PI, behaviour: 'react', params: { react: 'cheer', r: 5 } },
    { id: 'tour1', kind: 'tourist', x: -15, z: -4, yaw: 0, behaviour: 'wander', params: { r: 6, speed: 0.8, react: 'wave' } },
    { id: 'tour2', kind: 'tourist', x: 25, z: -3, yaw: 0, behaviour: 'wander', params: { r: 6, speed: 0.7, react: 'wave' } },
    { id: 'tour3', kind: 'tourist', x: -45, z: -3, yaw: 0, behaviour: 'wander', params: { r: 5, speed: 0.8, react: 'flee' } },
    { id: 'jog1', kind: 'jogger', x: -60, z: 5, yaw: HALF_PI, behaviour: 'pathLoop', params: { path: [[-66, 5], [66, 5], [66, 13], [-66, 13]], speed: 2.6 } },
    { id: 'jog2', kind: 'jogger', x: 60, z: 13, yaw: -HALF_PI, behaviour: 'pathLoop', params: { path: [[66, 13], [-66, 13], [-66, 5], [66, 5]], speed: 2.2 } },
    { id: 'kid1', kind: 'kid', x: P.castle.x - 2.4, z: P.castle.z + 0.6, yaw: 1, behaviour: 'idle', params: { anim: 'sit', react: 'cheer', reactR: 3 } },
    { id: 'kid2', kind: 'kid', x: P.castle.x + 2.2, z: P.castle.z + 1.2, yaw: -1, behaviour: 'wander', params: { r: 3, speed: 1 } },
    { id: 'cafe1', kind: 'tourist', x: -21, z: 30, yaw: -HALF_PI, behaviour: 'idle', params: { anim: 'sit', react: 'tut', reactR: 2 } },
  ],
  flocks: [
    { kind: 'gull', count: 10, x: 0, z: -40, r: 30 },
    { kind: 'pigeon', count: 8, x: 30, z: 10, r: 8 },
  ],
  activities: [
    { kind: 'fetch', x: 0, z: -12, params: { thrower: 'marco', r: 8, reward: 20 } },
    { kind: 'herding', x: -30, z: 11.5, params: { ring: { x: -30, z: 9.25, r: 2.5 }, count: 6, time: 45, reward: 30 } },
    { kind: 'sniffTrail', x: 44, z: -5, params: { item: 'brigadeiro', count: 8, time: 25, path: [[44, -7.5], [46, -11], [50, -13], [54, -11], [56, -8.5], [52, -5]], reward: 20 } },
    { kind: 'sitStay', x: -30, z: -16.5, params: { npc: 'gerald', time: 6, reward: 25 } },
  ],
  eggs: makeEggsW1(P),
  goals: {
    start: 0.25, goal: 3, stretch: 6, timer: 300, par: 200, growthK: 0.7,
    milestones: [0.5, 1, 1.5, 2.25, 3.5],
    star3: { kind: 'noHazards' },
  },
  weather: ['clear', 'clear', 'clear', 'parade', 'fog'],
  golden: { type: 'football', eggId: 'C5' },
};
