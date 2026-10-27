// The daily challenge (F17) and the per-world daily special item (F16).
// Seeded from the local date only, so everyone on the same day gets the same
// challenge for the same progress, with no backend.

import { createRng, dateKey, dateSeed, hashString } from '../core/rng.js';
import { itemsForWorld } from '../worlds/catalogue.js';
import { WORLD_IDS } from './data.js';
import { SPECIES_ORDER } from '../animals/species.js';

export const DAILY_MODIFIERS = ['bigHead', 'lowGravity', 'tiny', 'speedy', 'mirror'];

function specialPool(worldId) {
  const items = itemsForWorld(worldId).filter((it) => !it.goldenOf);
  const small = items.filter((it) => it.tier <= 3);
  return (small.length ? small : items).map((it) => it.id);
}

// worlds and species are the unlocked id lists; order is normalised so the
// pick is stable regardless of how the caller sorted them.
export function makeDaily(date = new Date(), { worlds = ['w1'], species = ['oli'] } = {}) {
  const key = dateKey(date);
  const seed = dateSeed(date);
  const rng = createRng(seed);
  const ws = WORLD_IDS.filter((w) => worlds.includes(w));
  for (const w of worlds) if (!ws.includes(w)) ws.push(w);
  if (!ws.length) ws.push('w1');
  const ss = SPECIES_ORDER.filter((s) => species.includes(s));
  if (!ss.length) ss.push('oli');
  const worldId = rng.pick(ws);
  const speciesId = rng.pick(ss);
  const modifier = rng.pick(DAILY_MODIFIERS);
  const pool = specialPool(worldId);
  const specialItem = pool.length ? rng.pick(pool) : null;
  return { key, seed, worldId, speciesId, modifier, specialItem, mode: 'daily', modifiers: { [modifier]: true } };
}

// F16: one special item per world per day, worth triple biccies in any mode.
export function specialItemFor(worldId, date = new Date()) {
  const pool = specialPool(worldId);
  if (!pool.length) return null;
  const rng = createRng(hashString('special:' + worldId + ':' + dateKey(date)));
  return rng.pick(pool);
}

// Whole days between two 'YYYY-MM-DD' keys (b - a).
export function dayDiff(a, b) {
  const pa = parseKey(a), pb = parseKey(b);
  if (pa == null || pb == null) return NaN;
  return Math.round((pb - pa) / 86400000);
}

function parseKey(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k || ''));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Streak update when a daily is completed on `key`.
export function nextStreak(daily, key) {
  if (daily.lastKey === key) return daily.streak || 1;
  const d = daily.lastKey ? dayDiff(daily.lastKey, key) : NaN;
  if (d === 1) return (daily.streak || 0) + 1;
  return 1;
}

// The streak as it stands today: it lapses once a whole day is missed.
export function liveStreak(daily, todayKey) {
  if (!daily.lastKey) return 0;
  const d = dayDiff(daily.lastKey, todayKey);
  return d === 0 || d === 1 ? daily.streak || 0 : 0;
}
