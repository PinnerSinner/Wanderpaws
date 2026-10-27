// Safe lookups over game data and copy, tolerant of stubs and missing keys.
// Node-importable (no DOM).

import { t, hasCopy } from '../core/copy/index.js';
import { WORLD_IDS } from './logic.js';

export function tk(key, fallback, vars) {
  return key && hasCopy(key) ? t(key, vars) : (fallback ?? key);
}

export function safe(fn, fb) {
  try { const v = fn(); return v === undefined || v === null ? fb : v; } catch { return fb; }
}

const PRETTY = { oli: 'Oli', redpanda: 'Red panda', routercat: 'Router-Cat' };
export function prettyId(id) {
  if (PRETTY[id]) return PRETTY[id];
  const s = String(id || '').replace(/([a-z])([A-Z0-9])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const speciesName = (id) => tk(`species.${id}.name`, prettyId(id));
export const worldName = (id) => tk(`world.${id}.name`, tk(`ui.world.${id}`, prettyId(id)));
export const worldBlurb = (w) => tk(w?.introKey || `world.${w?.id}.intro`, tk(`ui.worldBlurb.${w?.id}`, ''));
export const itemName = (id) => tk(`item.${id}.name`, prettyId(id));
export const cosmeticName = (c) => tk(c?.nameKey || `cosmetic.${c?.id}.name`, prettyId(c?.id));
export const modName = (id) => tk(`ui.mod.${id}`, tk(`meta.mod.${id}`, prettyId(id)));

export function getWorldData(app, id) {
  const list = app?.data?.WORLDS || [];
  return list.find((w) => w.id === id) || null;
}

export function worldIds(app) {
  const ids = (app?.data?.WORLDS || []).map((w) => w.id);
  const out = [...WORLD_IDS];
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}

export function itemsForWorld(app, worldId) {
  const cat = app?.data?.CATALOGUE || {};
  return Object.values(cat).filter((it) => it && !it.goldenOf && Array.isArray(it.worlds) && (it.worlds.includes(worldId) || (it.worlds.includes('all') && worldId !== 'w5')))
    .sort((a, b) => (a.size || 0) - (b.size || 0));
}

const TOKEN_COLOURS = ['#ff7a59', '#2bb59a', '#4fa6d4', '#a996ff', '#e9a93a', '#ff6fa8', '#5fae4a', '#d9372b'];
export function tokenColour(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TOKEN_COLOURS[h % TOKEN_COLOURS.length];
}
export function initials(name) {
  const w = String(name || '?').split(/[\s-]+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
}

// Stat formatting for the Stats page. Unknown keys fall back to integers.
export function statValue(key, v) {
  const n = Number(v) || 0;
  if (key === 'distance') return n < 1000 ? `${Math.round(n)} m` : `${(n / 1000).toFixed(n < 10000 ? 2 : 1)} km`;
  if (key === 'biggestSize') return n < 1 ? `${Math.round(n * 100)} cm` : n < 10 ? `${n.toFixed(1)} m` : `${Math.round(n)} m`;
  if (key === 'timePlayed') {
    const m = Math.floor(n / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
  }
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
