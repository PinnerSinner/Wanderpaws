// Static meta data: world order, the known egg list (used until the worlds
// data carries eggs), golden fallbacks and the default animal names.

import { WORLDS } from '../worlds/index.js';

export const WORLD_IDS = ['w1', 'w2', 'w3', 'w4', 'w5'];

// Egg id prefixes per world (SPEC §7). G* are global title codes, tracked as codes.
export const EGG_PREFIX = { C: 'w1', L: 'w2', T: 'w3', H: 'w4', M: 'w5' };
const EGG_COUNTS = { C: 13, L: 13, T: 13, H: 13, M: 14 };

export const KNOWN_EGGS = (() => {
  const out = [];
  for (const p of Object.keys(EGG_COUNTS)) for (let i = 1; i <= EGG_COUNTS[p]; i++) out.push(p + i);
  return out;
})();

// Golden collectible per world (SPEC §7), used when a world has no `golden` data yet.
export const GOLDEN_FALLBACK = {
  w1: { eggId: 'C5' }, w2: { eggId: 'L7' }, w3: { eggId: 'T2' }, w4: { eggId: 'H3' }, w5: { eggId: 'M10' },
};

export function worldOrder() {
  // Prefer the real worlds list order, then fill in any of the five that are missing.
  const ids = [];
  for (const w of WORLDS || []) if (w && w.id && !ids.includes(w.id)) ids.push(w.id);
  for (const id of WORLD_IDS) if (!ids.includes(id)) ids.push(id);
  return ids;
}

export function worldData(id) {
  return (WORLDS || []).find((w) => w && w.id === id) || null;
}

export function eggWorld(id) {
  for (const w of WORLDS || []) {
    if (w && Array.isArray(w.eggs) && w.eggs.some((e) => e && e.id === id)) return w.id;
  }
  return EGG_PREFIX[String(id || '').charAt(0)] || null;
}

export function eggIdsForWorld(worldId) {
  const w = worldData(worldId);
  if (w && Array.isArray(w.eggs) && w.eggs.length) return w.eggs.map((e) => e.id).filter(Boolean);
  return KNOWN_EGGS.filter((id) => EGG_PREFIX[id.charAt(0)] === worldId);
}

export function goldenForWorld(worldId) {
  const w = worldData(worldId);
  const g = (w && w.golden) || {};
  return { type: g.type || null, eggId: g.eggId || (GOLDEN_FALLBACK[worldId] || {}).eggId || null };
}

// Default names per species: copy keys `meta.name.<id>` (see copy.js).
export const DEFAULT_NAMES = {
  oli: 'Oli', cat: 'Biscuit', capybara: 'Sir Reginald', penguin: 'Percy', rabbit: 'Clementine',
  duck: 'Admiral Quackers', tortoise: 'Gordon', frog: 'Bernard', redpanda: 'Crumpet', octopus: 'Inky Pete',
  snake: 'Monty', elephant: 'Big Trev', routercat: 'Wi-Fi Wendy',
};

export const NAME_MAX = 16;
