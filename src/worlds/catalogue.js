// Every gobble-able item type. Seeded by the lead so World-data and World-meshes
// agents share one id list; owned by the World-data agent from here on.
// size = gobble size in metres (characteristic diameter), height = visual height.
// tier 0..5 (shape-coded for colour-blind players), value = biccies.

const T = (id, size, height, worlds, o = {}) => ({
  id, nameKey: `item.${id}.name`, journalKey: `journal.${id}`,
  size, height, worlds,
  food: false, tier: tierOf(size, worlds), value: Math.max(1, Math.round(Math.log2(1 + size * 20))),
  shape: 'circle', mass: Math.min(10, Math.max(0.1, size * 2)), recurring: false,
  ...o,
});

function tierOf(size, worlds) {
  // relative to the world's own size range, so every world uses all the tiers
  const ranges = { w1: [0.03, 2.6], w2: [0.04, 7], w3: [0.05, 15], w4: [0.12, 40], w5: [0.9, 200], all: [0.03, 3] };
  const [a, b] = ranges[worlds[0]] || ranges.all;
  const t = Math.log(size / a) / Math.log(b / a);
  return Math.max(0, Math.min(5, Math.floor(t * 6)));
}

const SHAPES = ['circle', 'circle', 'triangle', 'triangle', 'square', 'star'];

const list = [
  // Recurring gags (appear in every world from w1 to w4; w5 has giant cousins)
  T('teamug', 0.1, 0.1, ['all'], { food: true, recurring: true }),
  T('rubberduck', 0.08, 0.08, ['all'], { recurring: true }),
  T('cable', 0.3, 0.12, ['all'], { recurring: true }),
  T('router', 0.25, 0.08, ['all'], { recurring: true }),

  // W1 Copacabana (0.25 m -> 3 m)
  T('bottlecap', 0.03, 0.01, ['w1']),
  T('brigadeiro', 0.035, 0.03, ['w1'], { food: true }),
  T('seashell', 0.05, 0.03, ['w1']),
  T('pastel', 0.12, 0.04, ['w1'], { food: true }),
  T('caipirinha', 0.12, 0.13, ['w1'], { food: true }),
  T('sunglasses', 0.14, 0.05, ['w1']),
  T('icelolly', 0.15, 0.18, ['w1'], { food: true }),
  T('coconut', 0.18, 0.2, ['w1'], { food: true }),
  T('biscuitpacket', 0.2, 0.06, ['w1'], { food: true }),
  T('bucketspade', 0.22, 0.2, ['w1']),
  T('football', 0.22, 0.22, ['w1']),
  T('flipflop', 0.26, 0.03, ['w1']),
  T('sunhat', 0.38, 0.14, ['w1']),
  T('beachball', 0.45, 0.45, ['w1']),
  T('coolbox', 0.55, 0.4, ['w1', 'w3']),
  T('lifebuoy', 0.7, 0.12, ['w1', 'w3']),
  T('bollard', 0.9, 0.9, ['w1']),
  T('towel', 0.9, 0.05, ['w1']),
  T('deckchair', 1.0, 0.9, ['w1']),
  T('sandcastle', 1.2, 0.9, ['w1']),
  T('kiosktable', 1.2, 0.8, ['w1']),
  T('bicycle', 1.7, 1.0, ['w1', 'w3']),
  T('parasol', 1.9, 2.1, ['w1']),
  T('surfboard', 2.1, 0.2, ['w1']),
  // finale tier: the net and the kiosk become gobble-able just before the stretch size (4.5 m)
  T('volleynet', 2.4, 2.4, ['w1']),
  T('kiosk', 2.6, 2.6, ['w1']),

  // W2 London (0.4 m -> 8 m)
  T('conker', 0.04, 0.04, ['w2']),
  T('biscuit', 0.06, 0.02, ['w2'], { food: true }),
  T('scone', 0.09, 0.06, ['w2'], { food: true }),
  T('crisps', 0.15, 0.04, ['w2'], { food: true }),
  T('newspaper', 0.3, 0.05, ['w2']),
  T('wellies', 0.35, 0.4, ['w2']),
  T('flowerpot', 0.45, 0.4, ['w2']),
  T('trafficcone', 0.5, 0.7, ['w2']),
  T('brolly', 0.9, 0.9, ['w2']),
  T('parkbin', 0.9, 1.0, ['w2']),
  T('stripedeckchair', 1.0, 0.9, ['w2']),
  T('postbox', 1.4, 1.6, ['w2']),
  T('bench', 1.6, 0.9, ['w2']),
  T('phonebox', 2.5, 2.6, ['w2', 'w4']),
  T('lamppost', 3.5, 4.5, ['w2']),
  T('taxi', 4.2, 1.8, ['w2']),
  T('doubledecker', 6.0, 4.4, ['w2']),
  T('bandstand', 7.0, 6.0, ['w2']),

  // W3 Tijuca (0.8 m -> 18 m)
  T('brazilnut', 0.05, 0.05, ['w3'], { food: true }),
  T('mango', 0.12, 0.12, ['w3'], { food: true }),
  T('acai', 0.15, 0.1, ['w3'], { food: true }),
  T('binoculars', 0.18, 0.12, ['w3']),
  T('bananas', 0.25, 0.2, ['w3'], { food: true }),
  T('hikingboot', 0.3, 0.25, ['w3']),
  T('bromeliad', 0.4, 0.4, ['w3']),
  T('jackfruit', 0.45, 0.4, ['w3'], { food: true }),
  T('rucksack', 0.6, 0.55, ['w3']),
  T('lilyflower', 0.3, 0.15, ['w3']),
  T('paddle', 1.6, 0.1, ['w3']),
  T('treestump', 1.5, 0.8, ['w3']),
  T('signpost', 1.8, 2.0, ['w3']),
  T('picnictable', 2.0, 0.8, ['w3']),
  T('hammock', 2.2, 1.2, ['w3']),
  T('tent', 2.5, 1.6, ['w3']),
  T('kayak', 3.2, 0.5, ['w3']),
  T('boulder', 3.5, 2.5, ['w3', 'w4']),
  T('jeep', 4.2, 2.0, ['w3']),
  T('cablecar', 5.0, 3.5, ['w3']),
  T('bridgesection', 6.0, 1.5, ['w3']),
  T('lookouthut', 12.0, 7.0, ['w3']),
  T('palmtree', 15.0, 16.0, ['w3']),

  // W4 Highlands (1.5 m -> 45 m)
  T('shortbread', 0.12, 0.03, ['w4'], { food: true }),
  T('snowball', 0.2, 0.2, ['w4']),
  T('thistle', 0.3, 0.4, ['w4']),
  T('snowflake', 0.3, 0.3, ['w4']),
  T('curlingstone', 0.5, 0.25, ['w4']),
  T('tartanscarf', 0.6, 0.1, ['w4']),
  T('bagpipes', 0.9, 0.7, ['w4']),
  T('sledge', 1.2, 0.5, ['w4']),
  T('curlingbroom', 1.3, 0.2, ['w4']),
  T('haybale', 1.6, 1.2, ['w4']),
  T('woodsign', 1.6, 1.8, ['w4']),
  T('skis', 1.8, 0.2, ['w4']),
  T('snowman', 1.9, 1.9, ['w4']),
  T('skiliftchair', 2.2, 1.6, ['w4']),
  T('tractor', 4.5, 2.8, ['w4']),
  T('lochboat', 5.0, 1.5, ['w4']),
  T('standingstone', 5.0, 4.0, ['w4']),
  T('bothy', 7.0, 5.0, ['w4']),
  T('pinetree', 10.0, 12.0, ['w4']),
  T('cottage', 14.0, 9.0, ['w4']),
  T('lighthouse', 18.0, 22.0, ['w4']),
  T('skiliftpylon', 26.0, 24.0, ['w4']),
  T('castleturret', 30.0, 30.0, ['w4']),
  T('castlekeep', 40.0, 36.0, ['w4']),

  // W5 Marcoverse (4 m -> 300 m)
  T('bit', 0.9, 0.9, ['w5']),
  T('cookie', 1.2, 0.4, ['w5'], { food: true }),
  T('packet', 1.5, 1.0, ['w5']),
  T('sdcard', 2.0, 0.2, ['w5']),
  T('rj45', 1.5, 0.8, ['w5']),
  T('usbstick', 2.5, 0.6, ['w5']),
  T('teaurn', 3.0, 3.5, ['w5'], { food: true }),
  T('mouse', 3.0, 1.2, ['w5']),
  T('floppy', 3.0, 0.3, ['w5']),
  T('handshake', 3.0, 2.5, ['w5']),
  T('debugduck', 4.0, 4.0, ['w5']),
  T('keyboard', 6.0, 1.0, ['w5']),
  T('monitor', 8.0, 6.0, ['w5']),
  T('megarouter', 10.0, 4.0, ['w5']),
  T('cablespool', 12.0, 10.0, ['w5']),
  T('serverblade', 15.0, 3.0, ['w5']),
  T('firewallbrick', 20.0, 12.0, ['w5']),
  T('rack', 25.0, 30.0, ['w5']),
  T('cloudpuff', 30.0, 18.0, ['w5']),
  T('antenna', 35.0, 50.0, ['w5']),
  T('logoletter', 45.0, 50.0, ['w5']),
  T('satellitedish', 50.0, 40.0, ['w5']),
  T('loaderball', 60.0, 60.0, ['w5']),
  T('dcblock', 90.0, 60.0, ['w5']),
  T('blimp', 130.0, 50.0, ['w5']),
  T('giantcloud', 200.0, 120.0, ['w5']),
];

for (const it of list) it.shape = SHAPES[it.tier];

export const CATALOGUE = Object.fromEntries(list.map((it) => [it.id, it]));
export const CATALOGUE_ORDER = list.map((it) => it.id);

export function itemsForWorld(worldId) {
  return list.filter((it) => it.worlds.includes(worldId) || (it.worlds.includes('all') && worldId !== 'w5'));
}
export function getItem(id) { return CATALOGUE[id] || null; }
