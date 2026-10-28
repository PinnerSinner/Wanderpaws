// The animal roster. Data-driven: adding an animal is mostly a new entry here
// plus archetype tuning (src/animals/rig/plans.js). Stats are multipliers
// relative to Oli (1.0). Copy lives in src/animals/copy.js.
//
// personality (all 0..1 unless noted) drives how the rig moves:
//   bounce  gait bob and springiness       sleek  snappy, sudden, low bob
//   weight  slow springs, big landings      wag    tail and back-end wag
//   idleBias  weights for the idle director (the sim picks idleAnim, the
//             rig and the sim can both read these)
//   extraIdle the species-specific idle played for idleAnim === 'species'
//   gaitFreq  stride frequency multiplier   snap   head-turn snappiness

import './copy.js';

const look = (o) => ({
  base: '#e8c27a', secondary: '#c9a05a', belly: '#f3dca6', tips: '#c9a05a',
  eyes: '#5a3a1e', nose: '#2a1d17',
  pattern: 'none', patternColor: '#ffffff', patternSeed: 1, patternAmount: 0.5,
  accessories: { head: null, neck: null, back: null, face: null },
  trail: null, soundPack: null, decal: null,
  ...o,
});

const IDLE_BASE = { sniff: 1, sit: 1, scratch: 1, yawn: 1, look: 1, playbow: 0.5, shake: 0.5, lie: 1, species: 1 };

function make(id, o) {
  const p = o.personality || {};
  return {
    swims: false, floats: false, canJump: true,
    ...o,
    id,
    nameKey: `species.${id}.name`,
    blurbKey: `species.${id}.blurb`,
    stats: { speed: 1, accel: 1, turn: 1, jump: 1, reach: 1, startSize: 1, waterSpeed: 0.7, slideSpeed: 1, ...(o.stats || {}) },
    traits: { squeezeGaps: false, underFences: false, climbs: false, dropMult: 1, foodBonus: 0, noDrops: false, ...(o.traits || {}) },
    affinity: { surfaces: { ...(o.affinity?.surfaces || {}) } },
    hitbox: { radius: 0.42, height: 0.6, ...(o.hitbox || {}) },
    personality: {
      bounce: 0.5, sleek: 0.5, weight: 0.5, wag: 0.5, gaitFreq: 1, snap: 0.5, extraIdle: 'none',
      ...p,
      idleBias: { ...IDLE_BASE, ...(p.idleBias || {}) },
    },
    signature: { nameKey: `species.${id}.sig`, descKey: `species.${id}.sigDesc`, ...o.signature },
    sounds: { voice: id, ...(o.sounds || {}) },
    defaults: look(o.defaults || {}),
    presets: (o.presets || []).map((pr) => ({ ...pr, nameKey: `species.${id}.preset.${pr.id}` })),
  };
}

export const SPECIES = {
  oli: make('oli', {
    archetype: 'quadruped',
    stats: { reach: 1.1, waterSpeed: 1.0 },
    swims: true,
    traits: { foodBonus: 0.1 },
    affinity: { surfaces: { water: 1.15, sand: 1.05 } },
    signature: { kind: 'sniffBoost', cooldown: 6, duration: 1.2 },
    personality: {
      bounce: 0.7, sleek: 0.3, weight: 0.55, wag: 1.0, gaitFreq: 1, snap: 0.6, extraIdle: 'beg',
      idleBias: { sniff: 3, sit: 1.5, scratch: 1, yawn: 0.8, look: 1, playbow: 2, shake: 1.5, lie: 0.8, species: 1.2 },
    },
    defaults: { base: '#e8c27a', secondary: '#d9ae66', belly: '#f3dca6', tips: '#c9a05a', eyes: '#5a3a1e', nose: '#1f1714' },
    presets: [
      { id: 'yellowlab', look: { base: '#e8c27a', secondary: '#d9ae66', belly: '#f3dca6', tips: '#c9a05a', eyes: '#5a3a1e', nose: '#1f1714', pattern: 'none' } },
      { id: 'blacklab', look: { base: '#2a2725', secondary: '#24211f', belly: '#3a3532', tips: '#1c1a19', eyes: '#6b4424', nose: '#141110', pattern: 'none' } },
      { id: 'choclab', look: { base: '#7a4a2e', secondary: '#663d25', belly: '#8d5a3a', tips: '#57331f', eyes: '#c08a3a', nose: '#3d2418', pattern: 'none' } },
      { id: 'collie', look: { base: '#232120', secondary: '#232120', belly: '#f4f1ea', tips: '#f4f1ea', eyes: '#6b4424', nose: '#141110', pattern: 'blaze', patternColor: '#f4f1ea', patternAmount: 0.75 } },
      { id: 'dalmatian', look: { base: '#f6f3ec', secondary: '#ece7dc', belly: '#ffffff', tips: '#1b1b1b', eyes: '#5a3a1e', nose: '#1b1b1b', pattern: 'spots', patternColor: '#1b1b1b', patternAmount: 0.6, patternSeed: 7 } },
      { id: 'beagle', look: { base: '#c08445', secondary: '#7a5230', belly: '#f6f0e4', tips: '#f6f0e4', eyes: '#4a2c16', nose: '#1f1b18', pattern: 'saddle', patternColor: '#262120', patternAmount: 0.65 } },
      { id: 'husky', look: { base: '#727982', secondary: '#4d5257', belly: '#f2f2f0', tips: '#f2f2f0', eyes: '#7fb7e0', nose: '#1c1c1e', pattern: 'mask', patternColor: '#f2f2f0', patternAmount: 0.7 } },
    ],
    unlock: { kind: 'start' },
  }),
  cat: make('cat', {
    archetype: 'quadruped',
    stats: { turn: 1.25, speed: 1.05, jump: 1.1, waterSpeed: 0.55 },
    traits: { squeezeGaps: true },
    affinity: { surfaces: { water: 0.8, wood: 1.05 } },
    signature: { kind: 'pounce', cooldown: 4, duration: 0.7 },
    personality: {
      bounce: 0.3, sleek: 1.0, weight: 0.3, wag: 0.35, gaitFreq: 1.1, snap: 1.0, extraIdle: 'groom',
      idleBias: { sniff: 0.6, sit: 2, scratch: 1.2, yawn: 1.5, look: 1.5, playbow: 0.6, shake: 0.4, lie: 2, species: 2.5 },
    },
    hitbox: { radius: 0.36 },
    defaults: { base: '#e08a3c', secondary: '#c56f28', belly: '#f7e2c8', tips: '#f7e2c8', eyes: '#8fbf3a', nose: '#d77b7b', pattern: 'stripes', patternColor: '#b45f1f', patternAmount: 0.6, patternSeed: 3 },
    presets: [
      { id: 'ginger', look: { base: '#e08a3c', secondary: '#c56f28', belly: '#f7e2c8', tips: '#f7e2c8', eyes: '#8fbf3a', nose: '#d77b7b', pattern: 'stripes', patternColor: '#b45f1f' } },
      { id: 'tuxedo', look: { base: '#1d1c1c', secondary: '#1d1c1c', belly: '#f4f4f2', tips: '#f4f4f2', pattern: 'socks', patternColor: '#f4f4f2', eyes: '#d9b43a', nose: '#e8a0a8' } },
      { id: 'tabby', look: { base: '#8a7a68', secondary: '#6b5d4f', belly: '#d9cdbd', tips: '#d9cdbd', eyes: '#c9a23a', nose: '#c98a7f', pattern: 'stripes', patternColor: '#4a3f35' } },
      { id: 'siamese', look: { base: '#efe3cf', secondary: '#5b4335', belly: '#f6efe3', tips: '#4a352a', eyes: '#5aa7e0', nose: '#4a352a', pattern: 'mask', patternColor: '#4a352a' } },
      { id: 'calico', look: { base: '#f4efe6', secondary: '#e08a3c', belly: '#ffffff', tips: '#2a2523', eyes: '#c9a23a', nose: '#e8a0a8', pattern: 'patches', patternColor: '#e08a3c', patternAmount: 0.55, patternSeed: 11 } },
      { id: 'void', look: { base: '#1a1819', secondary: '#151314', belly: '#221f20', tips: '#151314', eyes: '#f2c94c', nose: '#2a2526', pattern: 'none' } },
    ],
    unlock: { kind: 'start' },
  }),
  capybara: make('capybara', {
    archetype: 'quadruped',
    stats: { speed: 0.9, startSize: 1.1, waterSpeed: 1.0 },
    swims: true, floats: true,
    traits: { dropMult: 0.6 },
    affinity: { surfaces: { water: 1.2, grass: 1.05 } },
    signature: { kind: 'chillAura', cooldown: 10, duration: 5 },
    personality: {
      bounce: 0.12, sleek: 0.2, weight: 0.85, wag: 0.05, gaitFreq: 0.8, snap: 0.15, extraIdle: 'chill',
      idleBias: { sniff: 1, sit: 2, scratch: 0.4, yawn: 1.5, look: 0.6, playbow: 0.1, shake: 0.6, lie: 3, species: 2.5 },
    },
    hitbox: { radius: 0.48 },
    defaults: { base: '#9b6f47', secondary: '#87603d', belly: '#a98260', tips: '#6e4d31', eyes: '#2b1d14', nose: '#3a2a20' },
    presets: [
      { id: 'classic', look: { base: '#9b6f47', secondary: '#87603d', belly: '#a98260', tips: '#6e4d31' } },
      { id: 'golden', look: { base: '#c99a5c', secondary: '#b5864a', belly: '#d8b07a', tips: '#8a6236' } },
      { id: 'mocha', look: { base: '#6e4c33', secondary: '#5d3f2a', belly: '#7d5a40', tips: '#4a3221' } },
      { id: 'yuzu', look: { base: '#a37a4f', secondary: '#8d6741', belly: '#b38c62', tips: '#f2c94c', pattern: 'spots', patternColor: '#f2c94c', patternAmount: 0.25, patternSeed: 4 } },
    ],
    unlock: { kind: 'start' },
  }),
  penguin: make('penguin', {
    archetype: 'waddler',
    stats: { speed: 0.8, slideSpeed: 1.4, waterSpeed: 1.5, turn: 0.95, jump: 0.7 },
    swims: true,
    affinity: { surfaces: { snow: 1.25, ice: 1.4, water: 1.3 } },
    signature: { kind: 'bellySlide', cooldown: 2.5, duration: 1.8 },
    personality: {
      bounce: 0.7, sleek: 0.4, weight: 0.5, wag: 0.6, gaitFreq: 1.4, snap: 0.5, extraIdle: 'flap',
      idleBias: { sniff: 0.3, sit: 0.5, scratch: 0.8, yawn: 0.6, look: 2, playbow: 0.3, shake: 1.5, lie: 0.5, species: 2.5 },
    },
    hitbox: { radius: 0.38, height: 0.8 },
    defaults: { base: '#1f2329', secondary: '#1f2329', belly: '#f7f5ef', tips: '#f2b134', eyes: '#1a1a1a', nose: '#f2a43a' },
    presets: [
      { id: 'emperor', look: { base: '#1f2329', secondary: '#2a3038', belly: '#f7f5ef', tips: '#f2b134', nose: '#f2a43a' } },
      { id: 'rockhopper', look: { base: '#262b33', secondary: '#262b33', belly: '#f7f5ef', tips: '#f7d23a', nose: '#e0503a', eyes: '#c4303a' } },
      { id: 'fairy', look: { base: '#4f7fa8', secondary: '#41698c', belly: '#f5f7fa', tips: '#9fc3e0', nose: '#2a2a2a' } },
      { id: 'magellanic', look: { base: '#22262c', secondary: '#22262c', belly: '#f7f5ef', tips: '#f7f5ef', nose: '#3a3a3a', pattern: 'bands', patternColor: '#22262c', patternAmount: 0.5 } },
    ],
    unlock: { kind: 'start' },
  }),
  rabbit: make('rabbit', {
    archetype: 'hopper',
    stats: { jump: 1.6, accel: 1.2, speed: 0.95 },
    affinity: { surfaces: { grass: 1.1 } },
    signature: { kind: 'superHop', cooldown: 3, duration: 0.9 },
    personality: {
      bounce: 1.0, sleek: 0.5, weight: 0.2, wag: 0.3, gaitFreq: 1.2, snap: 0.9, extraIdle: 'binky',
      idleBias: { sniff: 2, sit: 1.5, scratch: 1.2, yawn: 0.6, look: 2, playbow: 0.2, shake: 0.6, lie: 1, species: 2 },
    },
    hitbox: { radius: 0.36 },
    defaults: { base: '#cfc4b6', secondary: '#b8ab9b', belly: '#f4efe8', tips: '#8c7e6e', eyes: '#3a2418', nose: '#e7a3a3' },
    presets: [
      { id: 'wild', look: { base: '#cfc4b6', secondary: '#b8ab9b', belly: '#f4efe8', tips: '#8c7e6e' } },
      { id: 'lop', look: { base: '#a9764b', secondary: '#8d603b', belly: '#efe0cc', tips: '#6e4a2c' } },
      { id: 'snowy', look: { base: '#f7f5f2', secondary: '#ece8e2', belly: '#ffffff', tips: '#e0d8d0', eyes: '#c4505a' } },
      { id: 'dutch', look: { base: '#3a3330', secondary: '#3a3330', belly: '#f7f5f2', tips: '#3a3330', pattern: 'blaze', patternColor: '#f7f5f2', patternAmount: 0.8 } },
    ],
    unlock: { kind: 'stars', world: 'w1', count: 2 },
  }),
  duck: make('duck', {
    archetype: 'waddler',
    stats: { speed: 0.9, waterSpeed: 1.4, jump: 0.9 },
    swims: true, floats: true,
    affinity: { surfaces: { water: 1.3 } },
    signature: { kind: 'flapGlide', cooldown: 3, duration: 1.5 },
    personality: {
      bounce: 0.6, sleek: 0.5, weight: 0.35, wag: 0.8, gaitFreq: 1.5, snap: 0.7, extraIdle: 'preen',
      idleBias: { sniff: 1, sit: 1, scratch: 0.8, yawn: 0.3, look: 1.5, playbow: 0.2, shake: 1.5, lie: 0.8, species: 2.5 },
    },
    hitbox: { radius: 0.36, height: 0.7 },
    defaults: { base: '#f4f1e8', secondary: '#e9e3d4', belly: '#fbf8f0', tips: '#f2a13a', eyes: '#1c1c1c', nose: '#f29a2e' },
    presets: [
      { id: 'pekin', look: { base: '#f4f1e8', secondary: '#e9e3d4', belly: '#fbf8f0', tips: '#f2a13a', nose: '#f29a2e' } },
      { id: 'mallard', look: { base: '#8a6d4f', secondary: '#2f7a4a', belly: '#b9a084', tips: '#f2a13a', nose: '#e8c23a', pattern: 'bands', patternColor: '#f7f7f7' } },
      { id: 'rubber', look: { base: '#ffd23a', secondary: '#ffcb1f', belly: '#ffe066', tips: '#ff8a1f', nose: '#ff8a1f' } },
      { id: 'runner', look: { base: '#b08a5a', secondary: '#9a7648', belly: '#efe6d4', tips: '#5f6b3a', nose: '#5f6b3a' } },
    ],
    unlock: { kind: 'finish', world: 'w1' },
  }),
  tortoise: make('tortoise', {
    archetype: 'shelled',
    stats: { speed: 0.74, accel: 0.85, turn: 0.85, reach: 1.3, jump: 0.5 },
    traits: { noDrops: true },
    signature: { kind: 'shellUp', cooldown: 5, duration: 3 },
    personality: {
      bounce: 0.05, sleek: 0.2, weight: 1.0, wag: 0.1, gaitFreq: 0.7, snap: 0.1, extraIdle: 'retract',
      idleBias: { sniff: 1.5, sit: 0.5, scratch: 0.3, yawn: 1.5, look: 2, playbow: 0, shake: 0.2, lie: 2, species: 2 },
    },
    hitbox: { radius: 0.5, height: 0.5 },
    defaults: { base: '#7c8a4a', secondary: '#4a5628', belly: '#d9c88f', tips: '#a9b36a', eyes: '#1d1a12', nose: '#5c5436', pattern: 'patches', patternColor: '#9aa255', patternAmount: 0.3 },
    presets: [
      { id: 'garden', look: { base: '#7c8a4a', secondary: '#5f6d35', belly: '#d9c88f', tips: '#a9b36a', pattern: 'patches', patternColor: '#c2a35a' } },
      { id: 'desert', look: { base: '#b08a55', secondary: '#7a5a34', belly: '#e0c890', tips: '#c9a86a', pattern: 'patches', patternColor: '#e0b860' } },
      { id: 'star', look: { base: '#3a2e22', secondary: '#2a2118', belly: '#e8d48a', tips: '#9a8a5a', pattern: 'spots', patternColor: '#f2d36a', patternAmount: 0.6 } },
      { id: 'mossy', look: { base: '#5a7a3a', secondary: '#3f5a2a', belly: '#c8d08a', tips: '#8fbf5a', pattern: 'spots', patternColor: '#8fbf5a', patternAmount: 0.45 } },
    ],
    unlock: { kind: 'journal', pct: 25 },
  }),
  frog: make('frog', {
    archetype: 'hopper',
    stats: { jump: 1.4, speed: 0.95, waterSpeed: 1.2 },
    swims: true,
    affinity: { surfaces: { water: 1.2, leaves: 1.1 } },
    signature: { kind: 'tongueSnap', cooldown: 1.5, duration: 0.35 },
    personality: {
      bounce: 0.9, sleek: 0.6, weight: 0.3, wag: 0, gaitFreq: 1.1, snap: 1.0, extraIdle: 'croak',
      idleBias: { sniff: 0.2, sit: 3, scratch: 0.5, yawn: 1, look: 1.5, playbow: 0, shake: 0.4, lie: 0.5, species: 3 },
    },
    hitbox: { radius: 0.4, height: 0.5 },
    defaults: { base: '#5fb548', secondary: '#4a9a37', belly: '#e6f0b8', tips: '#2f6e25', eyes: '#f2c94c', nose: '#3f7f2e', pattern: 'spots', patternColor: '#2f6e25' },
    presets: [
      { id: 'tree', look: { base: '#5fb548', secondary: '#4a9a37', belly: '#e6f0b8', tips: '#2f6e25', eyes: '#f2c94c', pattern: 'spots', patternColor: '#2f6e25' } },
      { id: 'poison', look: { base: '#2f7fe0', secondary: '#1f5fb0', belly: '#3a8ff0', tips: '#111111', eyes: '#111111', pattern: 'spots', patternColor: '#111111', patternAmount: 0.7 } },
      { id: 'tomato', look: { base: '#e0503a', secondary: '#c0402a', belly: '#f2a060', tips: '#9a2a1a', eyes: '#2a2a2a', pattern: 'none' } },
      { id: 'golden', look: { base: '#f2c234', secondary: '#e0a820', belly: '#fbe08a', tips: '#c08a10', eyes: '#2a2a2a', pattern: 'none' } },
    ],
    unlock: { kind: 'finish', world: 'w3' },
  }),
  redpanda: make('redpanda', {
    archetype: 'quadruped',
    stats: { turn: 1.15, jump: 1.15, speed: 0.95 },
    traits: { climbs: true },
    affinity: { surfaces: { leaves: 1.1, snow: 1.05 } },
    signature: { kind: 'standTall', cooldown: 6, duration: 3 },
    personality: {
      bounce: 0.55, sleek: 0.5, weight: 0.4, wag: 0.5, gaitFreq: 1.05, snap: 0.7, extraIdle: 'stand',
      idleBias: { sniff: 1.2, sit: 1.5, scratch: 1, yawn: 1.2, look: 1.5, playbow: 0.5, shake: 0.8, lie: 1.5, species: 2 },
    },
    hitbox: { radius: 0.4 },
    defaults: { base: '#c2532a', secondary: '#2a1a14', belly: '#2a1a14', tips: '#f4ece2', eyes: '#1d120c', nose: '#1d120c', pattern: 'bands', patternColor: '#7a2e14', patternAmount: 0.6 },
    presets: [
      { id: 'classic', look: { base: '#c2532a', secondary: '#2a1a14', belly: '#2a1a14', tips: '#f4ece2', pattern: 'bands', patternColor: '#7a2e14' } },
      { id: 'ember', look: { base: '#e0682e', secondary: '#3a2016', belly: '#3a2016', tips: '#fff4e6', pattern: 'bands', patternColor: '#a03a18' } },
      { id: 'autumn', look: { base: '#a8622e', secondary: '#4a2a18', belly: '#4a2a18', tips: '#f2e2c8', pattern: 'bands', patternColor: '#6a3a1a' } },
      { id: 'snowy', look: { base: '#efe6da', secondary: '#c2532a', belly: '#c2532a', tips: '#c2532a', pattern: 'bands', patternColor: '#c2532a', patternAmount: 0.5 } },
    ],
    unlock: { kind: 'golden', world: 'w3' },
  }),
  octopus: make('octopus', {
    archetype: 'tentacle',
    stats: { speed: 0.8, waterSpeed: 1.5, reach: 1.2, jump: 0.6 },
    swims: true,
    affinity: { surfaces: { water: 1.3, sand: 0.95 } },
    signature: { kind: 'eightArmGrab', cooldown: 5, duration: 0.8 },
    personality: {
      bounce: 0.4, sleek: 0.8, weight: 0.45, wag: 0.7, gaitFreq: 0.9, snap: 0.6, extraIdle: 'ink',
      idleBias: { sniff: 0.5, sit: 1, scratch: 1, yawn: 0.8, look: 2, playbow: 0.2, shake: 1, lie: 1, species: 2.5 },
    },
    hitbox: { radius: 0.46, height: 0.55 },
    defaults: { base: '#d9607a', secondary: '#c24b66', belly: '#f2b3bf', tips: '#f7d4db', eyes: '#1a1a1a', nose: '#c24b66', pattern: 'spots', patternColor: '#f2b3bf' },
    presets: [
      { id: 'coral', look: { base: '#d9607a', secondary: '#c24b66', belly: '#f2b3bf', tips: '#f7d4db', pattern: 'spots', patternColor: '#f2b3bf' } },
      { id: 'blueringed', look: { base: '#e0c060', secondary: '#c8a848', belly: '#f2e0a0', tips: '#f2e0a0', pattern: 'spots', patternColor: '#2a6ae0', patternAmount: 0.6 } },
      { id: 'deepsea', look: { base: '#6a4ab0', secondary: '#553a94', belly: '#b8a0e8', tips: '#e0d4ff', pattern: 'spots', patternColor: '#e0d4ff', patternAmount: 0.4 } },
      { id: 'mimic', look: { base: '#e8d8c0', secondary: '#7a4a2a', belly: '#f2e8d8', tips: '#7a4a2a', pattern: 'bands', patternColor: '#7a4a2a', patternAmount: 0.6 } },
    ],
    unlock: { kind: 'secret', egg: 'H2' },
  }),
  snake: make('snake', {
    archetype: 'serpent',
    stats: { turn: 1.3, speed: 1.0 },
    canJump: false,
    traits: { underFences: true },
    affinity: { surfaces: { sand: 1.1, leaves: 1.1 } },
    signature: { kind: 'coilPull', cooldown: 5, duration: 1.2 },
    personality: {
      bounce: 0, sleek: 1.0, weight: 0.4, wag: 0, gaitFreq: 1, snap: 0.8, extraIdle: 'taste',
      idleBias: { sniff: 1.5, sit: 0.2, scratch: 0, yawn: 1, look: 2, playbow: 0, shake: 0.5, lie: 1.5, species: 3 },
    },
    hitbox: { radius: 0.34, height: 0.35 },
    defaults: { base: '#4f9b5a', secondary: '#3c7d46', belly: '#e9e2a6', tips: '#2d5e35', eyes: '#e0b23a', nose: '#3c7d46', pattern: 'bands', patternColor: '#e0b23a', patternAmount: 0.4 },
    presets: [
      { id: 'garden', look: { base: '#4f9b5a', secondary: '#3c7d46', belly: '#e9e2a6', tips: '#2d5e35', pattern: 'bands', patternColor: '#e0b23a', patternAmount: 0.4 } },
      { id: 'coral', look: { base: '#e0503a', secondary: '#1a1a1a', belly: '#f2d23a', tips: '#1a1a1a', eyes: '#1a1a1a', pattern: 'bands', patternColor: '#f2d23a', patternAmount: 0.6 } },
      { id: 'python', look: { base: '#c8a060', secondary: '#6a4a2a', belly: '#efe0b8', tips: '#6a4a2a', pattern: 'patches', patternColor: '#6a4a2a', patternAmount: 0.6 } },
      { id: 'albino', look: { base: '#f5efe0', secondary: '#f2d27a', belly: '#ffffff', tips: '#f2d27a', eyes: '#e05a6a', pattern: 'patches', patternColor: '#f2d27a', patternAmount: 0.5 } },
    ],
    unlock: { kind: 'secret', egg: 'T2' },
  }),
  elephant: make('elephant', {
    archetype: 'quadruped',
    stats: { startSize: 1.35, speed: 0.8, accel: 0.8, turn: 0.8, jump: 0.6, waterSpeed: 0.9 },
    swims: true,
    affinity: { surfaces: { water: 1.1 } },
    signature: { kind: 'trunkHoover', cooldown: 6, duration: 1.6 },
    personality: {
      bounce: 0.15, sleek: 0.1, weight: 1.0, wag: 0.3, gaitFreq: 0.75, snap: 0.25, extraIdle: 'trumpet',
      idleBias: { sniff: 1.5, sit: 0.8, scratch: 0.6, yawn: 0.8, look: 1, playbow: 0.3, shake: 0.8, lie: 0.6, species: 2.5 },
    },
    hitbox: { radius: 0.5, height: 0.75 },
    defaults: { base: '#9aa0a8', secondary: '#868c94', belly: '#aab0b7', tips: '#757b83', eyes: '#2a2420', nose: '#868c94' },
    presets: [
      { id: 'grey', look: { base: '#9aa0a8', secondary: '#868c94', belly: '#aab0b7', tips: '#757b83' } },
      { id: 'dusty', look: { base: '#b09a88', secondary: '#9a8472', belly: '#c0ac9a', tips: '#7a6656' } },
      { id: 'pink', look: { base: '#e8a8b8', secondary: '#d890a4', belly: '#f2c0cc', tips: '#c87890' } },
      { id: 'festival', look: { base: '#8a98b0', secondary: '#7484a0', belly: '#9aa8c0', tips: '#f2c94c', pattern: 'spots', patternColor: '#f2c94c', patternAmount: 0.35 } },
    ],
    unlock: { kind: 'story' },
  }),
  routercat: make('routercat', {
    archetype: 'quadruped',
    stats: { turn: 1.25, speed: 1.05, jump: 1.1, waterSpeed: 0.55 },
    traits: { squeezeGaps: true },
    affinity: { surfaces: { data: 1.2 } },
    signature: { kind: 'wifiPurr', cooldown: 7, duration: 2.5 },
    personality: {
      bounce: 0.4, sleek: 0.9, weight: 0.35, wag: 0.5, gaitFreq: 1.1, snap: 1.0, extraIdle: 'reboot',
      idleBias: { sniff: 0.5, sit: 2, scratch: 1, yawn: 1, look: 1.5, playbow: 0.5, shake: 0.6, lie: 1.5, species: 2.5 },
    },
    hitbox: { radius: 0.36 },
    defaults: { base: '#3b4a6b', secondary: '#2c3854', belly: '#c9d6f2', tips: '#5ef0c2', eyes: '#5ef0c2', nose: '#5ef0c2', pattern: 'stripes', patternColor: '#5ef0c2', patternAmount: 0.2 },
    presets: [
      { id: 'stock', look: { base: '#3b4a6b', secondary: '#2c3854', belly: '#c9d6f2', tips: '#5ef0c2', eyes: '#5ef0c2', nose: '#5ef0c2', pattern: 'stripes', patternColor: '#5ef0c2' } },
      { id: 'beige', look: { base: '#e8e0cc', secondary: '#d0c6ae', belly: '#f5f0e2', tips: '#4ae05a', eyes: '#4ae05a', nose: '#4ae05a', pattern: 'stripes', patternColor: '#b8ae96', patternAmount: 0.3 } },
      { id: 'rgb', look: { base: '#1c1c24', secondary: '#14141a', belly: '#2a2a36', tips: '#ff4ad0', eyes: '#4ad0ff', nose: '#ff4ad0', pattern: 'stripes', patternColor: '#ff4ad0', patternAmount: 0.4 } },
      { id: 'enterprise', look: { base: '#2a5aa8', secondary: '#1f4a8c', belly: '#d8e4f8', tips: '#f2a63a', eyes: '#f2a63a', nose: '#f2a63a', pattern: 'socks', patternColor: '#d8e4f8' } },
    ],
    unlock: { kind: 'egg', egg: 'M12' },
  }),
};

export const SPECIES_ORDER = ['oli', 'cat', 'capybara', 'penguin', 'rabbit', 'duck', 'tortoise', 'frog', 'redpanda', 'octopus', 'snake', 'elephant', 'routercat'];

export const SIGNATURE_KINDS = ['sniffBoost', 'pounce', 'chillAura', 'bellySlide', 'superHop', 'flapGlide', 'shellUp', 'tongueSnap', 'standTall', 'eightArmGrab', 'coilPull', 'trunkHoover', 'wifiPurr'];

export const ARCHETYPES = ['quadruped', 'hopper', 'waddler', 'shelled', 'serpent', 'tentacle'];

export const PATTERNS = ['none', 'patches', 'stripes', 'spots', 'socks', 'blaze', 'saddle', 'mask', 'bands'];

export const IDLE_ANIMS = ['sniff', 'sit', 'scratch', 'yawn', 'look', 'playbow', 'shake', 'lie', 'species'];

export const EMOTIONS = ['happy', 'excited', 'scared', 'sleepy', 'proud', 'neutral'];

export function getSpecies(id) { return SPECIES[id] || SPECIES.oli; }
