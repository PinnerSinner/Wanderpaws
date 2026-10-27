// Shared test helpers for the meta suites.
import { createProfile } from '../../src/meta/index.js';

// A storage double that keeps raw strings, so tests can plant corrupt JSON.
export function memStorage() {
  const raw = new Map();
  return {
    raw,
    persistent: false,
    get(k, fallback = null) {
      if (!raw.has(k)) return fallback;
      try { return JSON.parse(raw.get(k)); } catch { return fallback; }
    },
    set(k, v) { raw.set(k, JSON.stringify(v)); },
    remove(k) { raw.delete(k); },
    keys() { return [...raw.keys()]; },
    clearAll() { raw.clear(); },
  };
}

export function fixedNow(iso = '2026-10-27T12:00:00') {
  let d = new Date(iso);
  const fn = () => new Date(d);
  fn.set = (s) => { d = new Date(s); };
  return fn;
}

export function newProfile(opts = {}) {
  const storage = opts.storage || memStorage();
  const now = opts.now || fixedNow();
  return { p: createProfile(storage, { now }), storage, now };
}

export const run = (worldId = 'w1', speciesId = 'oli', mode = 'story', extra = {}) => ({ worldId, speciesId, mode, seed: 1, modifiers: {}, name: 'Oli', ...extra });

// Finish a run with the given stars.
export function finish(p, worldId, stars = [true, false, false], extra = {}, r = run(worldId)) {
  return p.finishRun({ stars, size: 3, time: 200, gobbled: 0, distance: 100, eggsFound: [], goldenFound: [], maxCombo: 0, pigeonsScared: 0, hazardsTouched: 1, ...extra }, r);
}
