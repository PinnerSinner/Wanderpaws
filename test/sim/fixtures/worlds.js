// Fixture worlds for the sim tests and bots. They follow CONTRACTS §5.2 but are
// built here so the sim can be tested while the real worlds are being written.

// A bare flat world; tests add exactly what they need.
export function flatWorld(over = {}) {
  return {
    id: 'tflat', index: 0, nameKey: 'world.tflat.name',
    bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
    spawn: { x: 0, z: 0, yaw: 0 },
    heightAt: () => 0, surfaceAt: () => 'grass',
    water: [], colliders: [], scenery: [],
    items: { anchors: [], fill: [] },
    zones: [], hazards: [], cast: [], crowd: [], flocks: [], activities: [], eggs: [],
    goals: { start: 0.25, goal: 3, stretch: 4.5, timer: 300, par: 200, growthK: 1, milestones: [0.5, 1, 2], star3: { kind: 'noHazards' } },
    weather: ['clear'], golden: null,
    ...over,
  };
}

// A beach park: sea with a tide on the east, a pond, a hill, size gates, a
// squeeze gap, a raised boardwalk, hazards, cast, flocks, activities and eggs.
export function parkWorld(over = {}) {
  const heightAt = (x, z) => {
    let h = 0;
    if (x > 25) h -= (x - 25) * 0.08;                          // beach slopes into the sea
    const hx = x + 20, hz = z - 20; const d2 = hx * hx + hz * hz;
    h += 3 * Math.exp(-d2 / 60);                               // a hill
    const px = x + 10, pz = z + 15; if (px * px + pz * pz < 25) h -= 0.6 * (1 - (px * px + pz * pz) / 25); // pond bowl
    return h;
  };
  const surfaceAt = (x, z) => (x > 22 ? 'sand' : Math.abs(z) < 2 ? 'pavement' : x < -30 ? 'snow' : 'grass');
  const w1 = ['bottlecap', 'brigadeiro', 'seashell', 'pastel', 'caipirinha', 'sunglasses', 'icelolly', 'coconut', 'biscuitpacket', 'bucketspade', 'football', 'flipflop'];
  const w1mid = ['sunhat', 'beachball', 'coolbox', 'lifebuoy', 'teamug', 'rubberduck', 'router'];
  const w1big = ['bollard', 'towel', 'deckchair', 'sandcastle', 'kiosktable', 'bicycle', 'parasol', 'surfboard', 'volleynet', 'kiosk'];
  return flatWorld({
    id: 'tpark', nameKey: 'world.tpark.name',
    bounds: { minX: -45, maxX: 45, minZ: -40, maxZ: 40 },
    spawn: { x: 0, z: 0, yaw: 0 },
    heightAt, surfaceAt,
    water: [
      { kind: 'sea', level: -1.2, tide: { amp: 0.4, period: 40 } },
      { kind: 'pond', level: -0.25, rect: { minX: -16, maxX: -4, minZ: -21, maxZ: -9 } },
    ],
    colliders: [
      // a size gate: two walls with a 0.5 m gap (only small things fit)
      { kind: 'box', x: -5.5, z: 10, w: 10, d: 0.4, h: 2, rot: 0 },
      { kind: 'box', x: 5.5, z: 10, w: 10, d: 0.4, h: 2, rot: 0 },
      // a low wall you can step over once you're about 2 m
      { kind: 'box', x: 0, z: -25, w: 20, d: 0.5, h: 0.9, rot: 0.3 },
      // a cat-flap fence: squeeze through
      { kind: 'box', x: 20, z: 15, w: 0.2, d: 10, h: 1.2, rot: 0, pass: 'squeeze' },
      // a garden fence: snakes slip under
      { kind: 'box', x: 20, z: -15, w: 0.2, d: 10, h: 1.0, rot: 0, pass: 'under' },
      // posts and a kiosk
      { kind: 'cyl', x: 8, z: 3, r: 0.3, h: 1.2 },
      { kind: 'cyl', x: -8, z: 3, r: 0.3, h: 1.2 },
      { kind: 'box', x: 12, z: -6, w: 3, d: 3, h: 3, rot: 0.6 },
      // a raised boardwalk with a ramp-ish step
      { kind: 'box', x: -25, z: -2, w: 8, d: 3, h: 0.08, rot: 0 },
      { kind: 'box', x: -32, z: -2, w: 6, d: 3, h: 0.5, rot: 0, y: 0 },
    ],
    items: {
      anchors: [
        { type: 'rubberduck', x: -10, z: -15, golden: true },
        { type: 'kiosk', x: 30, z: 30 },
        { type: 'volleynet', x: 0, z: 30, rot: 1.57 },
        { type: 'teamug', x: 2, z: 2 },
        { type: 'teamug', x: -2, z: 2 },
        { type: 'sandcastle', x: 28, z: -10, hidden: false },
        { type: 'flipflop', x: 0, z: 12, hidden: true, flag: 'secretflip' },
      ],
      fill: [
        { types: w1, count: 260, region: { x: 0, z: 0, r: 22 }, avoidWater: true },
        { types: w1, count: 120, region: { minX: -44, maxX: 44, minZ: -39, maxZ: 39 }, avoidWater: true },
        { types: w1mid, count: 150, region: { minX: -44, maxX: 44, minZ: -39, maxZ: 39 }, avoidWater: true },
        { types: w1big, count: 70, region: { minX: -44, maxX: 44, minZ: -39, maxZ: 39 }, avoidWater: true },
      ],
    },
    zones: [{ id: 'hut', x: 15, z: 25, r: 2 }, { id: 'hill', x: -20, z: 20, r: 4 }],
    hazards: [
      { kind: 'tide' },
      { kind: 'cyclist', path: [{ x: -40, z: 0.5 }, { x: 40, z: 0.5 }], speed: 6, pingPong: true },
      { kind: 'jogger', path: [[-30, -5], [30, -5], [30, 5], [-30, 5]], speed: 3 },
      { kind: 'pigeons', x: 10, z: 20, r: 3, count: 4 },
      { kind: 'puddle', x: -3, z: -6, r: 1.5 },
      { kind: 'hose', x: 15, z: -20, len: 6, arc: 1.4, period: 4, yaw: 0 },
      { kind: 'slipperyRock', x: -20, z: 10, r: 2 },
      { kind: 'thinIce', x: -38, z: 25, r: 4 },
      { kind: 'snowballKids', x: -38, z: -25, count: 2 },
      { kind: 'highlandCow', x: -15, z: 30 },
      { kind: 'toucan', x: 5, z: -30, perches: [[5, -30], [-5, -32]] },
      { kind: 'marmoset', x: 35, z: -30, r: 3 },
      { kind: 'firewall', x: 35, z: 0, w: 0.6, d: 8, h: 3, openFlag: 'fwOpen' },
      { kind: 'lagZone', x: -35, z: 10, r: 3 },
      { kind: 'packetLoss', x: 10, z: -12, r: 1.2 },
    ],
    cast: [
      { id: 'gerald', speaker: 'gerald', kind: 'critter', mesh: 'gerald', x: 4, z: 8, yaw: 0, behaviour: 'gerald', params: {} },
      { id: 'marco', speaker: 'marco', kind: 'human', mesh: 'marco', x: -20, z: 1, yaw: 1.57, behaviour: 'marco', params: { path: [[-20, 1], [20, 1]], speed: 3, pingPong: true } },
      { id: 'ze', speaker: 'ze', kind: 'human', mesh: 'ze', x: 26, z: 26, yaw: 3, behaviour: 'vendor', params: {} },
      { id: 'kev', speaker: 'kev', kind: 'human', mesh: 'kev', x: 30, z: 10, yaw: -1.5, behaviour: 'idle', params: { react: 'wave' } },
    ],
    crowd: [
      { kind: 'sunbather', x: 26, z: 5, yaw: 0, behaviour: 'lie', params: {} },
      { kind: 'tourist', x: -6, z: 20, yaw: 0, behaviour: 'wander', params: { r: 5 } },
      { kind: 'tourist', x: 6, z: -20, yaw: 0, behaviour: 'react', params: { react: 'flee', r: 3 } },
      { kind: 'reader', x: -12, z: 5, yaw: 0, behaviour: 'read', params: { react: 'tut' } },
      { kind: 'kid', x: 14, z: 14, yaw: 0, behaviour: 'idle', params: { react: 'cheer' } },
    ],
    flocks: [{ kind: 'pigeon', count: 10, x: -5, z: 5, r: 3 }, { kind: 'gull', count: 6, x: 28, z: -5, r: 4 }],
    activities: [
      { kind: 'fetch', x: -10, z: 1, params: { thrower: 'marco' } },
      { kind: 'herding', x: -25, z: -30, params: { ring: { x: -18, z: -30, r: 2.5 } } },
      { kind: 'sniffTrail', x: 12, z: 25, params: { count: 6 } },
      { kind: 'sitStay', x: -30, z: 30, params: { npc: 'gerald', time: 4 } },
    ],
    eggs: [
      {
        id: 'TX1', world: 'tpark', nameKey: 'egg.TX1.name', descKey: 'egg.TX1.desc',
        // bark three times at Kev
        init(ctx) { ctx.flag('kevBarks', 0); },
        onEvent(ev, ctx) {
          if (ev.type !== 'bark' || ctx.isFound()) return;
          if (ctx.dist(30, 10) < 8) {
            const n = ctx.flag('kevBarks') + 1; ctx.flag('kevBarks', n);
            if (n >= 3) { ctx.found(); ctx.say('kev', 'egg.TX1.line'); ctx.setNpcAnim('kev', 'point'); }
          }
        },
      },
      {
        id: 'TX2', world: 'tpark', nameKey: 'egg.TX2.name', descKey: 'egg.TX2.desc', golden: 'football',
        // sit in the hut for 3 s: a golden football and the hidden flip-flop appear
        tick(ctx) {
          if (ctx.isFound()) return;
          if (ctx.zone('hut').time > 3 && ctx.stillTime() > 1) {
            ctx.found();
            ctx.spawnItem('football', 15, 27, { golden: true });
            ctx.revealItem('secretflip');
            ctx.buff('tea', 6);
          }
        },
      },
    ],
    goals: { start: 0.25, goal: 3, stretch: 4.5, timer: 300, par: 200, growthK: 1, milestones: [0.5, 1, 2, 3], star3: { kind: 'noHazards' } },
    weather: ['clear', 'rain', 'fog'],
    golden: { type: 'rubberduck', eggId: 'TX2' },
    ...over,
  });
}

export const FIXTURES = [parkWorld()];
