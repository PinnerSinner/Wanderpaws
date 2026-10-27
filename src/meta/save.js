// Versioned save schema: defaults, migrations and a corruption-safe load.
// Keys (inside the storage prefix, e.g. gobblepaws.v1.):
//   profile          the live save
//   profile.bak      the last known-good save (written on load and after each run)
//   profile.corrupt  whatever was in `profile` when it failed to load, kept for rescue

export const SCHEMA_VERSION = 2;
export const KEY = 'profile';
export const KEY_BAK = 'profile.bak';
export const KEY_CORRUPT = 'profile.corrupt';

export const STAT_KEYS = [
  'distance', 'gobbled', 'biggestSize', 'pigeons', 'tea', 'eggs', 'runs', 'timePlayed',
  'barks', 'playBows', 'splashes', 'jumps', 'bumps', 'bestCombo', 'goldens', 'dailies', 'stars',
];

export function defaultStats() {
  const s = {};
  for (const k of STAT_KEYS) s[k] = 0;
  return s;
}

export function defaultData(now = Date.now()) {
  return {
    v: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    biccies: 0,
    earned: 0,
    spent: 0,
    owned: {},          // cosmeticId or 'species:<id>' -> true
    looks: {},          // speciesId -> Look (partial or full)
    names: {},          // speciesId -> custom name
    renamed: false,
    lastSpecies: 'oli',
    played: {},         // speciesId -> runs started
    speciesBest: {},    // speciesId -> biggest size
    worlds: {},         // worldId -> { stars: [b,b,b], bestSize, bestTime, finished, runs }
    journal: {},        // itemType -> times gobbled
    golden: {},         // itemType -> true (golden variant found)
    goldens: {},        // worldId -> [itemType]
    eggs: {},           // eggId -> times found
    achievements: {},   // id -> timestamp earned
    stats: defaultStats(),
    daily: { done: {}, lastKey: null, streak: 0, bestStreak: 0, cache: null },
    codes: {},          // code -> times entered
    modifiers: {},      // modifier id -> true
    seen: { species: {}, worlds: {}, cosmetics: {} },  // unlocks already announced
  };
}

const isObj = (o) => o != null && typeof o === 'object' && !Array.isArray(o);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const boolMap = (o) => {
  const out = {};
  if (isObj(o)) for (const k in o) if (o[k]) out[k] = true;
  return out;
};
const numMap = (o) => {
  const out = {};
  if (isObj(o)) for (const k in o) { const n = num(o[k], o[k] === true ? 1 : 0); if (n > 0) out[k] = n; }
  return out;
};

// Migrations: MIGRATIONS[n] turns a version-n save into version n+1.
export const MIGRATIONS = {
  // v0: anything without a version number. Treated as a v1 save.
  0(d) { return { ...d, version: 1 }; },
  // v1 (the scaffold era): arrays and different names.
  //   { version: 1, coins, unlocked: [], journal: [types], eggs: [ids], stars: { w1: [..] },
  //     best: { w1: { size, time } }, looks, names, last }
  1(d) {
    const out = defaultData(num(d.createdAt, Date.now()));
    out.biccies = num(d.coins, num(d.biccies));
    out.earned = Math.max(out.biccies, num(d.earned));
    if (Array.isArray(d.journal)) for (const t of d.journal) out.journal[t] = 1;
    else if (isObj(d.journal)) out.journal = numMap(d.journal);
    if (Array.isArray(d.eggs)) for (const e of d.eggs) out.eggs[e] = 1;
    else if (isObj(d.eggs)) out.eggs = numMap(d.eggs);
    if (Array.isArray(d.owned)) for (const c of d.owned) out.owned[c] = true;
    if (Array.isArray(d.unlocked)) for (const s of d.unlocked) out.seen.species[s] = true;
    const stars = isObj(d.stars) ? d.stars : {};
    const best = isObj(d.best) ? d.best : {};
    for (const w of new Set([...Object.keys(stars), ...Object.keys(best)])) {
      const st = Array.isArray(stars[w]) ? stars[w].slice(0, 3).map(Boolean) : [false, false, false];
      while (st.length < 3) st.push(false);
      out.worlds[w] = { stars: st, bestSize: num(best[w]?.size), bestTime: num(best[w]?.time), finished: !!st[0], runs: 0 };
    }
    if (isObj(d.looks)) out.looks = d.looks;
    if (isObj(d.names)) out.names = d.names;
    if (typeof d.last === 'string') out.lastSpecies = d.last;
    if (isObj(d.stats)) Object.assign(out.stats, d.stats);
    out.v = 2;
    return out;
  },
};

export function versionOf(d) {
  if (!isObj(d)) return -1;
  if (typeof d.v === 'number') return d.v;
  if (typeof d.version === 'number') return d.version;
  return 0;
}

// Run every migration from the save's version up to SCHEMA_VERSION.
export function migrate(raw) {
  let d = raw;
  let v = versionOf(d);
  if (v < 0) throw new Error('save is not an object');
  const from = v;
  let guard = 0;
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error('no migration from v' + v);
    d = m(d);
    const nv = versionOf(d);
    if (nv <= v) throw new Error('migration did not advance from v' + v);
    v = nv;
    if (++guard > 20) throw new Error('migration loop');
  }
  return { data: d, from };
}

// Fill gaps and fix types so the rest of the code can trust the shape.
export function sanitize(d) {
  const def = defaultData();
  if (!isObj(d)) return def;
  const out = def;
  out.createdAt = num(d.createdAt, def.createdAt);
  out.updatedAt = num(d.updatedAt, def.updatedAt);
  out.biccies = Math.max(0, Math.floor(num(d.biccies)));
  out.earned = Math.max(out.biccies, Math.floor(num(d.earned)));
  out.spent = Math.max(0, Math.floor(num(d.spent)));
  out.owned = boolMap(d.owned);
  out.looks = isObj(d.looks) ? { ...d.looks } : {};
  out.names = {};
  if (isObj(d.names)) for (const k in d.names) if (typeof d.names[k] === 'string') out.names[k] = d.names[k];
  out.renamed = !!d.renamed;
  out.lastSpecies = typeof d.lastSpecies === 'string' ? d.lastSpecies : 'oli';
  out.played = numMap(d.played);
  out.speciesBest = numMap(d.speciesBest);
  if (isObj(d.worlds)) {
    for (const w in d.worlds) {
      const r = d.worlds[w];
      if (!isObj(r)) continue;
      const st = Array.isArray(r.stars) ? r.stars.slice(0, 3).map(Boolean) : [];
      while (st.length < 3) st.push(false);
      out.worlds[w] = { stars: st, bestSize: num(r.bestSize), bestTime: num(r.bestTime), finished: !!r.finished || st[0], runs: num(r.runs) };
    }
  }
  out.journal = numMap(d.journal);
  out.golden = boolMap(d.golden);
  if (isObj(d.goldens)) for (const w in d.goldens) if (Array.isArray(d.goldens[w])) out.goldens[w] = d.goldens[w].filter((x) => typeof x === 'string');
  out.eggs = numMap(d.eggs);
  if (isObj(d.achievements)) for (const k in d.achievements) if (d.achievements[k]) out.achievements[k] = num(d.achievements[k], 1);
  if (isObj(d.stats)) for (const k of Object.keys(d.stats)) out.stats[k] = Math.max(0, num(d.stats[k]));
  if (isObj(d.daily)) {
    out.daily.done = boolMap(d.daily.done);
    out.daily.lastKey = typeof d.daily.lastKey === 'string' ? d.daily.lastKey : null;
    out.daily.streak = Math.max(0, Math.floor(num(d.daily.streak)));
    out.daily.bestStreak = Math.max(out.daily.streak, Math.floor(num(d.daily.bestStreak)));
    out.daily.cache = isObj(d.daily.cache) ? d.daily.cache : null;
  }
  out.codes = numMap(d.codes);
  out.modifiers = boolMap(d.modifiers);
  if (isObj(d.seen)) {
    out.seen.species = boolMap(d.seen.species);
    out.seen.worlds = boolMap(d.seen.worlds);
    out.seen.cosmetics = boolMap(d.seen.cosmetics);
  }
  out.v = SCHEMA_VERSION;
  return out;
}

function tryParse(raw) {
  if (raw == null) return null;
  const { data, from } = migrate(raw);
  return { data: sanitize(data), from };
}

// Load with fallbacks: live save, then backup, then defaults.
// Returns { data, status: 'new'|'ok'|'migrated'|'backup'|'reset', from }.
export function loadData(storage) {
  if (!storage) return { data: defaultData(), status: 'new', from: SCHEMA_VERSION };
  const keys = safeKeys(storage);
  const exists = keys.includes(KEY);
  let raw = null;
  try { raw = storage.get(KEY, null); } catch { raw = null; }
  if (raw != null) {
    try {
      const r = tryParse(raw);
      return { data: r.data, status: r.from < SCHEMA_VERSION ? 'migrated' : 'ok', from: r.from };
    } catch { /* fall through to the backup */ }
  }
  if (raw != null || exists) {
    // Something was there but it's unreadable. Keep a copy for rescue.
    try { storage.set(KEY_CORRUPT, raw != null ? raw : rawString(storage, KEY)); } catch { /* ignore */ }
  }
  let bak = null;
  try { bak = storage.get(KEY_BAK, null); } catch { bak = null; }
  if (bak != null) {
    try {
      const r = tryParse(bak);
      return { data: r.data, status: 'backup', from: r.from };
    } catch { /* fall through */ }
  }
  return { data: defaultData(), status: (raw != null || exists) ? 'reset' : 'new', from: SCHEMA_VERSION };
}

export function saveData(storage, data, { backup = false } = {}) {
  if (!storage) return false;
  data.updatedAt = Date.now();
  try {
    storage.set(KEY, data);
    if (backup) storage.set(KEY_BAK, data);
    return true;
  } catch { return false; }
}

function safeKeys(storage) {
  try { return typeof storage.keys === 'function' ? storage.keys() : []; } catch { return []; }
}

function rawString(storage, key) {
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.endsWith('.' + key)) return localStorage.getItem(k);
      }
    }
  } catch { /* ignore */ }
  return null;
}
