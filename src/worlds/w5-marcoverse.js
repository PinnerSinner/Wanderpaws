// W5 The Marcoverse. Midnight neon, storybook-soft. 2.2 x 2.2 km.
//
// A floating cloud city: data-paved islands joined by soft cloud slopes over a cloud sea.
//   south (z ~ 700)    Localhost, the spawn island: binary pavement, the "someone else's
//                      computer" plaque, the SYN packet, Marco on his laps
//   centre             The Backbone, a long boulevard island running north, lined with router
//                      towers (Packet's hops), a cable river across it, the DNS signpost, a lag zone
//   west               the 192.168.0.0/16 subnet district and the hologram classroom
//   east               the server-rack skyline (a cable river runs through it) and the 404 room
//   south-east         the cable spaghetti, where three kittens are tangled (small gaps, high walls)
//   north-west         the DMZ behind the firewall (bark the HTTPS port; or squeeze through the hole)
//   north              the data-centre castle on its mound, with the big power switch

import { box, cyl, scen, strip, wall, gappedWall, at, row, ring, cluster, sstep, lerp, hill, ellipse01, inRect, PI, HALF_PI } from './util.js';
import { settleAnchors } from './layout.js';
import { makeEggsW5, HOP_ZONES } from './eggs/w5.js';

const SEA = -25;
// Islands: [cx, cz, rx, rz]
const ISLANDS = [
  [0, 700, 270, 210],     // Localhost
  [0, 0, 170, 560],       // The Backbone
  [-600, 250, 270, 230],  // subnet district
  [600, 150, 290, 270],   // server skyline
  [560, 620, 210, 190],   // cable spaghetti
  [-650, -550, 260, 260], // DMZ
  [0, -680, 330, 290],    // castle island
  [-330, 560, 160, 120],  // hologram rise (a stepping stone between Localhost and the subnet)
  [380, -330, 150, 130],  // the 404 annexe
];

export const P = {
  spawn: { x: 0, z: 640 },
  plaque: { x: 22, z: 660 },
  syn: { x: -160, z: 620 },
  dns: { x: 0, z: 380 },
  lag: { x: -60, z: -200 },
  river1: { minX: -110, maxX: 110, minZ: 80, maxZ: 120 },
  river2: { minX: 580, maxX: 620, minZ: 0, maxZ: 300 },
  subnet: { x: -470, z: 260 },
  hologram: { x: -620, z: 160 },
  skyline: { x: 600, z: 150 },
  door: { x: 330, z: -330 },
  room: { x: 380, z: -330 },
  spaghetti: { x: 560, z: 620 },
  dmz: { x: -650, z: -550 },
  firewall: { x: -470, z: -550 },
  castle: { x: 0, z: -760 },
  castleGate: { x: 0, z: -640 },
  staffroom: { x: -150, z: -600 },
  hops: [[-115, 450], [115, 330], [-115, 210], [115, -10], [-115, -130], [115, -260], [-115, -390], [115, -480]],
};

function islandFactor(x, z) {
  let best = 0;
  for (let i = 0; i < ISLANDS.length; i++) {
    const s = ISLANDS[i];
    const dx = x - s[0], dz = z - s[1];
    if (Math.abs(dx) > s[2] || Math.abs(dz) > s[3]) continue;
    const v = ellipse01(x, z, s[0], s[1], s[2], s[3], 0.35);
    if (v > best) best = v;
  }
  return best;
}

function heightAt(x, z) {
  const I = islandFactor(x, z);
  const puff = 2.5 * Math.sin(x * 0.013 + 1) * Math.sin(z * 0.011);
  let h = lerp(SEA + puff, 0, I);
  h += hill(x, z, P.castle.x, P.castle.z + 40, 260, 18) * I;
  // cable rivers: glowing channels cut into the islands
  const r1 = P.river1, r2 = P.river2;
  if (x > r1.minX - 8 && x < r1.maxX + 8 && z > r1.minZ - 8 && z < r1.maxZ + 8) {
    const f = Math.min(sstep(r1.minZ - 8, r1.minZ, z), 1 - sstep(r1.maxZ, r1.maxZ + 8, z)) * Math.min(sstep(r1.minX - 8, r1.minX + 4, x), 1 - sstep(r1.maxX - 4, r1.maxX + 8, x));
    h = lerp(h, -5, f);
  }
  if (x > r2.minX - 8 && x < r2.maxX + 8 && z > r2.minZ - 8 && z < r2.maxZ + 8) {
    const f = Math.min(sstep(r2.minX - 8, r2.minX, x), 1 - sstep(r2.maxX, r2.maxX + 8, x)) * Math.min(sstep(r2.minZ - 8, r2.minZ + 4, z), 1 - sstep(r2.maxZ - 4, r2.maxZ + 8, z));
    h = lerp(h, -5, f);
  }
  return h;
}

function surfaceAt(x, z) {
  return islandFactor(x, z) > 0.5 ? 'data' : 'snow'; // data pavement on islands, soft cloud in between
}

// ---- colliders ------------------------------------------------------------
const towers = [[480, 60], [520, 260], [680, 40], [720, 230], [650, 330], [540, -40], [760, 120], [470, 180]];
const colliders = [
  // router towers (Packet's hops)
  ...P.hops.map(([x, z]) => cyl(x, z, 10, 80)),
  // server-rack skyscrapers (scenery)
  ...towers.map(([x, z]) => box(x, z, 40, 40, 120)),
  // the data-centre castle
  box(P.castle.x, P.castle.z, 160, 120, 140),
  // the 404 room: 80 x 80 walls, door in the west wall (solid until flags['M3.open'])
  wall(340, -370, 420, -370, 30, 4), wall(340, -290, 420, -290, 30, 4), wall(420, -370, 420, -290, 30, 4),
  wall(340, -370, 340, -337, 30, 4), wall(340, -323, 340, -290, 30, 4),
  box(P.door.x + 10, P.door.z, 2, 14, 18, 0, { id: 'door404', openFlag: 'M3.open' }),
  // the DMZ: 120 m walls all round; a 60 m gate in the east (the firewall), and an 8 m hole for small packets in the south
  wall(-820, -720, -820, -380, 120, 8), wall(-820, -380, -480, -380, 120, 8),
  wall(-480, -380, -480, -520, 120, 8), wall(-480, -580, -480, -720, 120, 8),
  ...gappedWall(-820, -720, -480, -720, 120, 8, 0.5, 8),
  // the cable spaghetti: tangled 30 m walls with three 6 m gaps (small animals only, or giants step over)
  ...gappedWall(440, 500, 680, 500, 30, 6, 0.3, 6),
  ...gappedWall(680, 500, 680, 740, 30, 6, 0.6, 6),
  ...gappedWall(680, 740, 440, 740, 30, 6, 0.5, 6),
  wall(440, 740, 440, 500, 30, 6),
  wall(520, 560, 600, 640, 30, 4), wall(600, 560, 640, 700, 30, 4), wall(480, 680, 560, 660, 30, 4),
  // the hologram stage and DNS signpost
  cyl(P.hologram.x, P.hologram.z, 7, 1.2),
  box(P.dns.x + 10, P.dns.z, 2, 2, 12),
];

// ---- scenery ----------------------------------------------------------------
const scenery = [
  ...ISLANDS.map(([x, z, rx, rz], i) => scen('cloudisland', x, z, i, [rx / 60, 1, rz / 60], { y: SEA - 5 })),
  strip('binarypavement', -120, 120, 520, 780),
  strip('binarypavement', -60, 60, -460, 500),
  strip('cableriver', P.river1.minX, P.river1.maxX, P.river1.minZ, P.river1.maxZ),
  strip('cableriver', P.river2.minX, P.river2.maxX, P.river2.minZ, P.river2.maxZ),
  ...P.hops.map(([x, z], i) => scen('routertower', x, z, i)),
  ...towers.map(([x, z], i) => scen('serverskyline', x, z, i * 0.4)),
  scen('datacastle', P.castle.x, P.castle.z, 0),
  scen('door404', P.door.x + 10, P.door.z, HALF_PI),
  scen('firewallgate', P.firewall.x - 10, P.firewall.z, HALF_PI, 2),
  scen('hologram', P.hologram.x, P.hologram.z, 0),
  scen('dnssign', P.dns.x + 10, P.dns.z, -HALF_PI, 1, { params: { textKey: 'world.w5.dns' } }),
  scen('subnetsign', P.subnet.x, P.subnet.z, HALF_PI, 1, { params: { textKey: 'world.w5.subnet' } }),
  scen('plaque', P.plaque.x, P.plaque.z, PI, 1, { params: { textKey: 'world.w5.plaque' } }),
  scen('plaque', P.castleGate.x + 20, P.castleGate.z, PI, 2, { params: { textKey: 'world.w5.switch' } }),
  ...[[-900, -900], [900, -900], [-900, 900], [900, 900], [0, -1050], [-1050, 0], [1050, 0]].map(([x, z], i) => scen('serverskyline', x, z, i, 2.5)),
];

// ---- items ----------------------------------------------------------------
const small = ['bit', 'cookie', 'packet', 'rj45', 'sdcard', 'bit'];
const anchors = [
  // Localhost: a scatter of bits around spawn, a desk of kit to grow on
  ...cluster(small, 0, 632, 12, 34, 'w5spawn'),
  ...cluster(['usbstick', 'mouse', 'floppy', 'keyboard', 'teaurn', 'debugduck'], 40, 600, 30, 12, 'desk1'),
  ...cluster(['usbstick', 'mouse', 'floppy', 'monitor', 'cookie'], -50, 700, 30, 12, 'desk2'),
  at('loaderball', 180, 470), at('teaurn', -20, 660),
  // the SYN packet's corner (M10)
  ...cluster(['packet', 'rj45', 'bit'], P.syn.x, P.syn.z, 20, 10, 'syn'),
  // the Backbone: packets along the boulevard, monitors, spools, megarouters at each hop
  ...P.hops.flatMap(([x, z], i) => [at('megarouter', x + (x < 0 ? 22 : -22), z), ...cluster(['packet', 'rj45', 'cablespool', 'usbstick', 'keyboard'], x * 0.4, z, 40, 8, `hop${i}`)]),
  ...row('serverblade', -60, 300, -60, -300, 6), ...row('serverblade', 60, 260, 60, -340, 6),
  // DNS junction and the lag zone
  ...cluster(['monitor', 'keyboard', 'mouse', 'packet'], P.dns.x, P.dns.z, 30, 10, 'dns'),
  ...cluster(['floppy', 'mouse', 'usbstick', 'cookie'], P.lag.x, P.lag.z, 50, 14, 'lag'),
  // subnet district: houses on different VLANs, the hologram classroom
  ...cluster(['monitor', 'megarouter', 'keyboard', 'cablespool', 'antenna', 'satellitedish'], -600, 300, 200, 26, 'subnet'),
  ...cluster(['packet', 'cookie', 'mouse', 'teaurn'], P.hologram.x, P.hologram.z, 40, 10, 'holo'),
  // server skyline: racks, blades, dishes
  ...cluster(['rack', 'serverblade', 'rack', 'monitor', 'antenna', 'firewallbrick'], 600, 160, 230, 30, 'skyline'),
  at('satellitedish', 760, 330), at('satellitedish', 450, -40), at('dcblock', 720, -60), at('dcblock', 820, 300),
  // the 404 room: Not Found items (revealed by M3), including the golden debugging duck
  at('debugduck', P.room.x, P.room.z, { hidden: true, flag: 'M3', golden: true }),
  ...cluster(['floppy', 'cookie', 'usbstick', 'teaurn', 'keyboard'], P.room.x, P.room.z, 25, 12, 'room404', { hidden: true, flag: 'M3' }),
  // the cable spaghetti: spools and plugs (and kittens, see cast)
  ...cluster(['cablespool', 'rj45', 'packet', 'cablespool', 'sdcard'], P.spaghetti.x, P.spaghetti.z, 100, 24, 'spag'),
  // the DMZ: a treasure trove behind the firewall (some revealed by M8)
  ...cluster(['logoletter', 'satellitedish', 'dcblock', 'antenna', 'rack'], P.dmz.x, P.dmz.z, 140, 14, 'dmz'),
  ...cluster(['teaurn', 'handshake', 'debugduck', 'cookie'], P.dmz.x, P.dmz.z, 60, 12, 'dmzM8', { hidden: true, flag: 'M8' }),
  at('giantcloud', P.dmz.x - 40, P.dmz.z - 40),
  // the castle island: logo letters spelling MARCOVERSE, tea in the staff room, giant clouds
  ...row('logoletter', -225, -470, 225, -470, 10),
  ...cluster(['teaurn', 'teaurn', 'cookie', 'mouse', 'keyboard'], P.staffroom.x, P.staffroom.z, 30, 12, 'staff'),
  at('giantcloud', -260, -720), at('giantcloud', 260, -700), at('giantcloud', 0, -900),
  at('dcblock', -180, -800), at('dcblock', 180, -820), at('dcblock', -200, -560), at('dcblock', 200, -580),
  at('blimp', -300, -550), at('blimp', 320, -560), at('blimp', 600, 450),
  // out on the cloud sea: cloud puffs, a giant cloud or two, a stray loader
  ...[[300, 400], [-300, 380], [300, -150], [-300, -160], [-250, 0], [250, 50], [800, -300], [-850, 100], [-400, -850], [400, -900], [850, 600], [-800, 650]].map(([x, z]) => at('cloudpuff', x, z)),
  at('giantcloud', 850, -700), at('loaderball', -400, -300),
  at('giantcloud', -850, -150), at('giantcloud', 700, 850), at('blimp', -500, 750), at('blimp', 850, -400),
];

const fill = [
  { types: ['bit', 'cookie', 'packet', 'rj45', 'sdcard'], count: 110, region: { minX: -230, maxX: 230, minZ: 520, maxZ: 860 } },
  { types: ['bit', 'packet', 'cookie', 'rj45'], count: 30, region: { x: 0, z: 640, r: 14 } },
  { types: ['packet', 'rj45', 'usbstick', 'mouse', 'floppy', 'teaurn', 'sdcard'], count: 95, region: { minX: -150, maxX: 150, minZ: -500, maxZ: 520 } },
  { types: ['keyboard', 'monitor', 'debugduck', 'megarouter', 'cablespool', 'handshake'], count: 60, region: { minX: -900, maxX: 900, minZ: -900, maxZ: 900 } },
  { types: ['serverblade', 'firewallbrick', 'rack', 'cloudpuff', 'antenna'], count: 40, region: { minX: -950, maxX: 950, minZ: -950, maxZ: 950 } },
  { types: ['logoletter', 'satellitedish', 'loaderball', 'dcblock'], count: 14, region: { minX: -950, maxX: 950, minZ: -950, maxZ: 950 } },
];

const LOOP_LOCALHOST = [[-150, 600], [150, 600], [180, 760], [-180, 760]];

export const W5 = {
  id: 'w5', index: 5,
  nameKey: 'world.w5.name', introKey: 'world.w5.intro', outroKey: 'world.w5.outro',
  music: 'w5', ambience: 'data',
  palette: {
    skyTop: '#2a2350', skyBottom: '#7a5aa8', horizon: '#c08ad0', fog: '#5a4a8a', fogNear: 300, fogFar: 2600,
    sun: '#ffd8a8', sunIntensity: 1.2, ambient: '#9a8ad8', ground: '#e8e0ff', accent: '#7affc8',
    water: '#7affc8', waterDeep: '#3a8aa8', foam: '#e0fff4', outline: '#1e1838',
  },
  timeOfDay: { start: 0.96, end: 1.02 },
  bounds: { minX: -1100, maxX: 1100, minZ: -1100, maxZ: 1100 },
  spawn: { x: P.spawn.x, z: P.spawn.z, yaw: PI },
  heightAt, surfaceAt,
  water: [
    { kind: 'river', level: -1.5, rect: { ...P.river1 } },
    { kind: 'river', level: -1.5, rect: { ...P.river2 } },
  ],
  colliders, scenery,
  items: { anchors: settleAnchors(anchors, colliders).filter((a) => !inRect(a.x, a.z, P.river1) && !inRect(a.x, a.z, P.river2)), fill },
  zones: [
    { id: 'plaque', x: P.plaque.x, z: P.plaque.z - 8, r: 7 },
    { id: 'dns', x: P.dns.x, z: P.dns.z, r: 16 },
    { id: 'subnet', x: P.subnet.x + 14, z: P.subnet.z, r: 14 },
    { id: 'hologram', x: P.hologram.x, z: P.hologram.z + 18, r: 12 },
    { id: 'skyline', x: P.skyline.x, z: P.skyline.z, r: 40 },
    { id: 'room404', x: P.room.x, z: P.room.z, r: 30 },
    { id: 'lag', x: P.lag.x, z: P.lag.z, r: 60 },
    { id: 'castleGate', x: P.castleGate.x, z: P.castleGate.z, r: 30 },
    { id: 'localhost', x: P.spawn.x, z: P.spawn.z, r: 120 },
    { id: 'dmz', x: P.dmz.x, z: P.dmz.z, r: 160 },
    ...P.hops.map(([x, z], i) => ({ id: HOP_ZONES[i], x, z, r: 40 })),
  ],
  hazards: [
    { kind: 'firewall', id: 'firewall', x: P.firewall.x - 10, z: P.firewall.z, w: 60, d: 6, h: 40, rot: HALF_PI, openFlag: 'M8.open' },
    { kind: 'firewall', id: 'fw2', x: 0, z: 240, w: 90, d: 6, h: 20, rot: 0 },
    { kind: 'firewall', id: 'fw3', x: 30, z: -320, w: 80, d: 6, h: 20, rot: 0 },
    { kind: 'lagZone', id: 'lag', x: P.lag.x, z: P.lag.z, r: 60 },
    { kind: 'packetLoss', id: 'loss1', x: 40, z: 420, r: 16 },
    { kind: 'packetLoss', id: 'loss2', x: -50, z: 50, r: 18 },
    { kind: 'packetLoss', id: 'loss3', x: 520, z: 100, r: 20 },
    { kind: 'packetLoss', id: 'loss4', x: -20, z: -560, r: 22 },
  ],
  cast: [
    { id: 'gerald', speaker: 'gerald', kind: 'critter', mesh: 'gerald', x: 0, z: -560, yaw: 0, behaviour: 'gerald',
      params: { disguise: 'hoodie', spots: [[0, -560], [80, -380], [-90, -100], [60, 200], [-40, 450], [0, -620]], approachR: 30 } },
    { id: 'packet', speaker: 'packet', kind: 'human', mesh: 'packet', x: 0, z: 560, yaw: PI, behaviour: 'pathLoop',
      params: { path: [[0, 560], ...P.hops.map(([x, z]) => [x * 0.6, z]), [0, -600], [0, 560]], speed: 10, perchY: 2, react: 'wave' } },
    { id: 'marco', speaker: 'marco', kind: 'human', mesh: 'marco', x: -150, z: 600, yaw: HALF_PI, behaviour: 'marco', params: { path: LOOP_LOCALHOST, speed: 4 } },
    { id: 'pru', speaker: 'pru', kind: 'human', mesh: 'pru', x: P.staffroom.x, z: P.staffroom.z, yaw: 0, behaviour: 'idle', params: { anim: 'sit', react: 'wave', reactR: 10 } },
    { id: 'synpacket', speaker: 'synpacket', kind: 'human', mesh: 'packet', x: P.syn.x, z: P.syn.z, yaw: HALF_PI, behaviour: 'idle', params: { anim: 'idle', perchY: 1.5 } },
    { id: 'kitten1', speaker: 'kitten', kind: 'critter', mesh: 'kitten', x: 560, z: 600, yaw: 0, behaviour: 'idle', params: { anim: 'sit' } },
    { id: 'kitten2', speaker: 'kitten', kind: 'critter', mesh: 'kitten', x: 630, z: 690, yaw: 1, behaviour: 'idle', params: { anim: 'sit' } },
    { id: 'kitten3', speaker: 'kitten', kind: 'critter', mesh: 'kitten', x: 480, z: 560, yaw: 2, behaviour: 'idle', params: { anim: 'sit' } },
  ],
  crowd: [
    { id: 'holo', kind: 'hologrammarco', x: P.hologram.x, z: P.hologram.z, yaw: PI, behaviour: 'idle', params: { anim: 'point', perchY: 1.2 } },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: `student${i + 1}`, kind: 'kitten', x: P.hologram.x - 15 + (i % 3) * 15, z: P.hologram.z + 18 + Math.floor(i / 3) * 10, yaw: PI, behaviour: 'idle', params: { anim: 'sit' } })),
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: `techie${i + 1}`, kind: 'techie', x: -100 + i * 40, z: 620 - (i % 2) * 60, yaw: i, behaviour: 'wander', params: { r: 30, speed: 1.5, react: 'wave' } })),
    { id: 'techie7', kind: 'techie', x: 560, z: 120, yaw: 0, behaviour: 'pathLoop', params: { path: [[500, 120], [700, 120], [700, 200], [500, 200]], speed: 2 } },
    { id: 'techie8', kind: 'techie', x: P.castleGate.x + 10, z: P.castleGate.z + 20, yaw: PI, behaviour: 'idle', params: { anim: 'tut', react: 'tut', reactR: 20 } },
  ],
  flocks: [{ kind: 'pigeon', count: 10, x: 0, z: 0, r: 200 }],
  activities: [
    { kind: 'fetch', x: 0, z: 700, params: { thrower: 'marco', r: 40, reward: 30 } },
    { kind: 'herding', x: 0, z: 150, params: { ring: { x: 0, z: 180, r: 20 }, count: 6, time: 50, reward: 30 } },
    { kind: 'sniffTrail', x: 0, z: 520, params: { item: 'cookie', count: 8, time: 30, path: [[0, 520], [40, 470], [-40, 420], [30, 360], [-30, 300]], reward: 30 } },
    { kind: 'sitStay', x: 0, z: -600, params: { npc: 'gerald', time: 6, reward: 30 } },
  ],
  eggs: makeEggsW5(P),
  goals: {
    start: 4, goal: 300, stretch: 450, timer: 360, par: 240, growthK: 1.5,
    milestones: [10, 25, 60, 150, 350],
    star3: { kind: 'par' },
  },
  weather: ['clear', 'datastorm', 'clear', 'fog'],
  golden: { type: 'handshake', eggId: 'M10' },
};
