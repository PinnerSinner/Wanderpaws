// STUB (lead): replaced by the Worlds agent.
const w1 = {
  id: 'w1', index: 1, nameKey: 'world.w1.name', music: 'w1', ambience: 'beach',
  palette: { skyTop: '#7fc8f0', skyBottom: '#ffe3b0', horizon: '#ffe3b0', fog: '#ffe3b0', fogNear: 30, fogFar: 160, sun: '#fff1d0', sunIntensity: 2, ambient: '#bcd8f0', ground: '#f2dcae', accent: '#ff7a59', water: '#3cc0c8', waterDeep: '#1e7fa0', foam: '#ffffff', outline: '#3a2a22' },
  timeOfDay: { start: 0.33, end: 0.42 },
  bounds: { minX: -60, maxX: 60, minZ: -40, maxZ: 40 },
  spawn: { x: 0, z: 0, yaw: 0 },
  heightAt: () => 0, surfaceAt: () => 'sand',
  water: [], colliders: [], scenery: [],
  items: { anchors: [], fill: [{ types: ['ball'], count: 60, region: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 } }] },
  zones: [], hazards: [], cast: [], crowd: [], flocks: [], activities: [], eggs: [],
  goals: { start: 0.25, goal: 3, stretch: 4.5, timer: 300, par: 240, growthK: 1, milestones: [0.5, 1, 2], star3: { kind: 'noHazards' } },
  weather: ['clear'], golden: null,
};
export const WORLDS = [w1];
export function getWorld(id) { return WORLDS.find((w) => w.id === id) || WORLDS[0]; }
