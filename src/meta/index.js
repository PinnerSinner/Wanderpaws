// The player profile: save data, unlocks, the Journal, eggs, biccies, the shop,
// achievements, stats, dailies, title codes, modifiers and ghosts.
// Node-importable (tests drive it with a fake storage). See CONTRACTS §8.

import './copy.js';
import { t } from '../core/copy/index.js';
import { EV } from '../core/events.js';
import { dateKey } from '../core/rng.js';
import { SPECIES, SPECIES_ORDER, getSpecies } from '../animals/species.js';
import { COSMETICS } from '../animals/cosmetics.js';
import { mergeLook } from '../animals/customise.js';
import { CATALOGUE, itemsForWorld } from '../worlds/catalogue.js';

import { WORLD_IDS, DEFAULT_NAMES, NAME_MAX, worldOrder, worldData, eggIdsForWorld, eggWorld, goldenForWorld } from './data.js';
import { ruleMet, isRuleUnlocked, starCount } from './rules.js';
import { loadData, saveData, defaultData } from './save.js';
import { ECONOMY, gobbleBiccies, comboBiccies, starBiccies, dailyBiccies, modeMult } from './economy.js';
import { ACHIEVEMENTS, evaluate } from './achievements.js';
import { makeDaily, specialItemFor, nextStreak, liveStreak } from './daily.js';
import { matchCode, MODIFIER_IDS, KONAMI_TOKEN } from './codes.js';
import { packGhost, unpackGhost } from './ghost.js';

export { ECONOMY } from './economy.js';
export { ACHIEVEMENTS, ACHIEVEMENT_IDS } from './achievements.js';
export { CODES, KONAMI_TOKEN, MODIFIER_IDS } from './codes.js';
export { SCHEMA_VERSION } from './save.js';
export { DAILY_MODIFIERS } from './daily.js';

const NONE = Object.freeze([]);
const IGNORED = new Set([EV.FOOTSTEP, EV.SAY, EV.TIMER_WARN, EV.ALMOST, EV.NEAR_MISS, EV.JOURNAL_NEW, EV.ACHIEVEMENT, EV.UNLOCK, EV.CODE, EV.PAUSE, EV.RESUME, EV.WEATHER, EV.GATE, EV.LAND, EV.SHAKE, EV.IDLE, EV.SIG, EV.STAR, EV.HAZARD, EV.FINISH, 'ui']);
const DECAL_MAX = 300 * 1024;
const DAILY_KEEP = 60;

function normStars(s) {
  if (Array.isArray(s)) return [!!s[0], !!s[1], !!s[2]];
  const n = Number(s) || 0;
  return [n >= 1, n >= 2, n >= 3];
}

function cleanName(name) {
  // Strip control characters, collapse whitespace, cap the length.
  const s = String(name ?? '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  return Array.from(s).slice(0, NAME_MAX).join('');
}

/**
 * @param storage createStorage() result (get/set/remove/keys)
 * @param opts { now: () => Date } for tests
 */
export function createProfile(storage, opts = {}) {
  const now = opts.now || (() => new Date());
  const loaded = loadData(storage);
  let d = loaded.data;
  let pending = [];         // achievements earned outside a run, drained by the UI or finishRun
  let cur = null;           // the current run's counters

  // ---------- catalogue helpers (cached; the catalogue is static at runtime) ----------
  const itemCache = new Map();
  function worldItems(w) {
    if (!itemCache.has(w)) itemCache.set(w, itemsForWorld(w).filter((it) => !it.goldenOf).map((it) => it.id));
    return itemCache.get(w);
  }
  function allItems() {
    if (!itemCache.has('*')) {
      const set = new Set();
      for (const w of worldOrder()) for (const id of worldItems(w)) set.add(id);
      itemCache.set('*', [...set]);
    }
    return itemCache.get('*');
  }
  const journalCount = (w) => { let n = 0; for (const id of (w ? worldItems(w) : allItems())) if (d.journal[id]) n++; return n; };
  const journalTotal = (w) => (w ? worldItems(w) : allItems()).length;
  const journalPct = (w) => { const tot = journalTotal(w); return tot ? Math.floor((100 * journalCount(w)) / tot) : 0; };

  function allEggIds() {
    const out = [];
    for (const w of WORLD_IDS) for (const id of eggIdsForWorld(w)) out.push(id);
    return out;
  }
  const eggCount = (w) => { let n = 0; for (const id of (w ? eggIdsForWorld(w) : allEggIds())) if (d.eggs[id]) n++; return n; };
  const eggTotal = (w) => (w ? eggIdsForWorld(w) : allEggIds()).length;

  function goldenFound(w) {
    if ((d.goldens[w] || []).length) return true;
    const g = goldenForWorld(w);
    return !!(g.eggId && d.eggs[g.eggId]);
  }
  const worldRec = (w) => d.worlds[w] || null;
  const worldStars = (w) => (worldRec(w)?.stars || [false, false, false]);
  const totalStars = () => { let n = 0; for (const w in d.worlds) n += starCount(d.worlds[w].stars); return n; };
  const storyDone = () => WORLD_IDS.every((w) => !!worldRec(w)?.finished);

  // Query object for unlock rules.
  const q = {
    stars: worldStars,
    totalStars: () => totalStars(),
    finished: (w) => !!worldRec(w)?.finished,
    journalPct: () => journalPct(),
    goldenFound,
    egg: (id) => !!d.eggs[id],
    storyDone,
    bought: (key) => !!d.owned[key],
    achievement: (id) => !!d.achievements[id],
  };
  // Extra queries for achievements.
  const aq = {
    journalPct: () => journalPct(),
    eggCount, eggTotal, totalStars, worldStars, storyDone,
    goldenWorlds: () => WORLD_IDS.filter(goldenFound).length,
    anyWorldEggsComplete: () => WORLD_IDS.some((w) => eggTotal(w) > 0 && eggCount(w) >= eggTotal(w)),
    ownedCount: () => Object.keys(d.owned).filter((k) => !k.startsWith('species:')).length,
    codesFound: () => Object.keys(d.codes).length,
    world: (id) => worldData(id),
  };
  const ctx = (r, res) => ({ d, r, res, q: aq });

  // ---------- species and worlds ----------
  function isUnlocked(id) {
    const sp = SPECIES[id];
    if (!sp) return false;
    return isRuleUnlocked(sp.unlock, q, 'species:' + id);
  }
  function isWorldUnlocked(id) {
    const order = worldOrder();
    const i = order.indexOf(id);
    if (i < 0) return false;
    if (i === 0) return true;
    return starCount(worldStars(order[i - 1])) >= 1;
  }
  const cosmetic = (id) => (COSMETICS || []).find((c) => c && c.id === id) || null;
  function cosmeticUnlocked(c) { return !c.unlock || ruleMet(c.unlock, q); }

  // Unlocks not yet announced. Marks them as announced.
  function collectNewUnlocks() {
    const out = [];
    for (const id of SPECIES_ORDER) if (!d.seen.species[id] && isUnlocked(id)) { d.seen.species[id] = true; out.push({ kind: 'species', id }); }
    for (const id of worldOrder()) if (!d.seen.worlds[id] && isWorldUnlocked(id)) { d.seen.worlds[id] = true; out.push({ kind: 'world', id }); }
    for (const c of COSMETICS || []) {
      if (!c || !c.unlock || d.seen.cosmetics[c.id]) continue;
      if (ruleMet(c.unlock, q)) { d.seen.cosmetics[c.id] = true; out.push({ kind: 'cosmetic', id: c.id }); }
    }
    return out;
  }
  // On load, whatever is already unlocked counts as announced.
  collectNewUnlocks();

  function save(backup = false) { return saveData(storage, d, { backup }); }
  if (loaded.status !== 'new') save(true);

  function earn(ids) {
    const ts = Date.now();
    for (const id of ids) d.achievements[id] = ts;
    return ids;
  }
  function checkPending() {
    const ids = evaluate(ctx(cur, null), d.achievements);
    if (ids.length) { earn(ids); pending.push(...ids); }
    return ids;
  }

  // ---------- run counters ----------
  function newRun(run) {
    const worldId = run?.worldId || 'w1';
    const speciesId = run?.speciesId || d.lastSpecies || 'oli';
    const special = run?.daily?.specialItem || specialItemFor(worldId, now());
    if (SPECIES[speciesId]) d.played[speciesId] = (d.played[speciesId] || 0) + 1;
    return {
      ref: run, worldId, speciesId, mode: run?.mode || 'story', special,
      gobbles: 0, bicGobbles: 0, bicCombos: 0, bicActivities: 0, discoveries: 0, goldenNew: 0,
      teaMugs: 0, teaBuffs: 0, tea: 0, maxCombo: 0, bumps: 0, hazardBumps: 0, splashes: 0,
      pigeons: 0, wobble: 0, eggsNew: [], maxSize: 0,
    };
  }
  function runFor(run) {
    if (!cur || cur.ref !== run) cur = newRun(run);
    return cur;
  }
  function updTea(r) {
    const tea = Math.max(r.teaMugs, r.teaBuffs);
    if (tea > r.tea) { d.stats.tea += tea - r.tea; r.tea = tea; }
  }
  function combo(r, n) {
    n = n | 0;
    if (n > r.maxCombo) r.maxCombo = n;
    if (n > d.stats.bestCombo) d.stats.bestCombo = n;
  }
  // Records a golden find. Returns true when it's the first golden in that world.
  function markGolden(type, w, r) {
    if (!type) return false;
    d.golden[type] = true;
    const list = d.goldens[w] || (d.goldens[w] = []);
    if (list.includes(type)) return false;
    list.push(type);
    d.stats.goldens++;
    if (list.length === 1) { if (r) r.goldenNew++; return true; }
    return false;
  }
  function markEgg(id, r) {
    const first = !d.eggs[id];
    d.eggs[id] = (d.eggs[id] || 0) + 1;
    if (first) { d.stats.eggs++; if (r) r.eggsNew.push(id); }
    return first;
  }

  function onRunEvent(ev, run) {
    if (!ev || !ev.type || IGNORED.has(ev.type)) return NONE;
    const r = runFor(run);
    let out = null;
    let ach = false, unlocks = false, dirty = false;
    switch (ev.type) {
      case EV.GOBBLE: {
        const type = ev.itemType;
        if (!type) break;
        r.gobbles++;
        d.stats.gobbled++;
        const it = CATALOGUE[type];
        const golden = !!ev.golden || !!(it && it.goldenOf);
        if (!d.journal[type]) {
          (out ||= []).push({ type: EV.JOURNAL_NEW, itemType: type, golden: !!(it && it.goldenOf) });
          r.discoveries++;
          dirty = true; unlocks = true;
        }
        d.journal[type] = (d.journal[type] || 0) + 1;
        if (golden) { markGolden(it?.goldenOf || type, r.worldId, r); dirty = true; unlocks = true; }
        r.bicGobbles += gobbleBiccies(type, { golden, special: !!ev.special || r.special === type });
        if (type === 'teamug' || it?.goldenOf === 'teamug') { r.teaMugs++; updTea(r); }
        if (ev.combo) combo(r, ev.combo);
        if (ev.size > r.maxSize) r.maxSize = ev.size;
        ach = true;
        break;
      }
      case EV.COMBO: combo(r, ev.count); ach = true; break;
      case EV.COMBO_END: combo(r, ev.count); r.bicCombos += comboBiccies(ev.count | 0); break;
      case EV.MILESTONE: {
        const s = Number(ev.size) || 0;
        if (s > r.maxSize) r.maxSize = s;
        if (s > d.stats.biggestSize) d.stats.biggestSize = s;
        ach = true;
        break;
      }
      case EV.BUMP:
        r.bumps++; d.stats.bumps++;
        if (ev.by === 'hazard') r.hazardBumps++;
        ach = true;
        break;
      case EV.BARK: d.stats.barks++; ach = true; break;
      case EV.PLAY_BOW: d.stats.playBows++; ach = true; break;
      case EV.SPLASH: d.stats.splashes++; r.splashes++; ach = true; break;
      case EV.JUMP: d.stats.jumps++; break;
      case EV.BUFF:
        if (ev.kind === 'tea') { r.teaBuffs++; updTea(r); ach = true; }
        else if (ev.kind === 'wobble') { r.wobble++; ach = true; }
        break;
      case EV.PIGEON_SCARE: {
        const n = Math.max(1, ev.count | 0);
        r.pigeons += n; d.stats.pigeons += n;
        ach = true;
        break;
      }
      case EV.EGG:
        if (ev.id && markEgg(ev.id, r)) { dirty = true; unlocks = true; ach = true; }
        break;
      case EV.GOLDEN:
        if (ev.itemType && markGolden(ev.itemType, r.worldId, r)) { dirty = true; unlocks = true; ach = true; }
        break;
      case EV.ACTIVITY:
        if (ev.phase === 'success') r.bicActivities += typeof ev.reward === 'number' ? ev.reward : ECONOMY.activity;
        break;
      default: break;
    }
    if (unlocks) {
      // Mid-run unlocks only come from eggs, goldens and the Journal; stars and
      // finishes are settled in finishRun.
      for (const u of collectNewUnlocks()) {
        if (u.kind === 'world') { d.seen.worlds[u.id] = false; delete d.seen.worlds[u.id]; continue; }
        (out ||= []).push({ type: EV.UNLOCK, ...u });
        dirty = true;
      }
    }
    if (ach) {
      const ids = evaluate(ctx(r, null), d.achievements);
      if (ids.length) {
        earn(ids);
        for (const id of ids) (out ||= []).push({ type: EV.ACHIEVEMENT, id });
        dirty = true;
      }
    }
    if (dirty) save();
    return out || NONE;
  }

  function markDailyDone(key = dateKey(now())) {
    if (d.daily.done[key]) return false;
    d.daily.done[key] = true;
    d.daily.streak = nextStreak(d.daily, key);
    d.daily.lastKey = key;
    if (d.daily.streak > d.daily.bestStreak) d.daily.bestStreak = d.daily.streak;
    d.stats.dailies++;
    const keys = Object.keys(d.daily.done).sort();
    while (keys.length > DAILY_KEEP) delete d.daily.done[keys.shift()];
    return true;
  }

  function finishRun(result, run) {
    const r = runFor(run);
    const res = result || {};
    const w = r.worldId;
    const rec = d.worlds[w] || (d.worlds[w] = { stars: [false, false, false], bestSize: 0, bestTime: 0, finished: false, runs: 0 });
    const prevStars = rec.stars.slice();
    const stars = normStars(res.stars);
    const records = { size: false, time: false, stars: [], speciesBest: false, firstRun: rec.runs === 0, prev: { size: rec.bestSize, time: rec.bestTime } };

    // Fold in anything the result knows that events may have missed.
    for (const id of res.eggsFound || []) markEgg(id, r);
    for (const type of res.goldenFound || []) markGolden(type, w, r);
    if (r.gobbles === 0 && res.gobbled > 0) {
      d.stats.gobbled += res.gobbled;
      r.gobbles = res.gobbled;
      r.bicGobbles += typeof res.biccies === 'number' ? res.biccies * ECONOMY.gobbleRate : res.gobbled * 2 * ECONOMY.gobbleRate;
    }
    if (r.pigeons === 0 && res.pigeonsScared > 0) { d.stats.pigeons += res.pigeonsScared; r.pigeons = res.pigeonsScared; }
    if (res.maxCombo) combo(r, res.maxCombo);

    // World record
    for (let i = 0; i < 3; i++) if (stars[i] && !prevStars[i]) { rec.stars[i] = true; records.stars.push(i); }
    const size = Number(res.size) || 0;
    if (size > rec.bestSize) { records.size = true; rec.bestSize = size; }
    const time = Number(res.time) || 0;
    if (stars[0]) {
      rec.finished = true;
      if (time > 0 && (!rec.bestTime || time < rec.bestTime)) { records.time = true; rec.bestTime = time; }
    }
    rec.runs++;

    // Stats
    d.stats.runs++;
    d.stats.distance += Math.max(0, Number(res.distance) || 0);
    d.stats.timePlayed += Math.max(0, time);
    if (size > d.stats.biggestSize) d.stats.biggestSize = size;
    if (r.maxSize > d.stats.biggestSize) d.stats.biggestSize = r.maxSize;
    d.stats.stars = totalStars();
    if (size > (d.speciesBest[r.speciesId] || 0)) { d.speciesBest[r.speciesId] = size; records.speciesBest = true; }

    // Biccies
    const mult = modeMult(r.mode);
    const breakdown = {
      gobbles: Math.round(r.bicGobbles * mult),
      combos: Math.round(r.bicCombos * mult),
      stars: starBiccies(prevStars, stars),
      eggs: r.eggsNew.length * ECONOMY.eggFirst,
      discoveries: r.discoveries * ECONOMY.discovery,
      golden: r.goldenNew * ECONOMY.goldenFirst,
      activities: Math.round(r.bicActivities),
      finish: ECONOMY.finishRun,
      daily: 0,
    };
    if (r.mode === 'daily') {
      const key = run?.daily?.key || dateKey(now());
      if (markDailyDone(key)) breakdown.daily = dailyBiccies(d.daily.streak);
    }
    let total = 0;
    for (const k in breakdown) total += breakdown[k];
    d.biccies += total;
    d.earned += total;

    const newUnlocks = collectNewUnlocks();
    const achievements = [...pending, ...earn(evaluate(ctx(r, res), d.achievements))];
    pending = [];
    const summary = {
      biccies: total, breakdown, newUnlocks, achievements, records,
      stars, eggsNew: r.eggsNew.slice(), discoveries: r.discoveries, worldId: w, speciesId: r.speciesId,
    };
    cur = null;
    save(true);
    return summary;
  }

  // ---------- the profile object ----------
  const profile = {
    get data() { return d; },
    get loadStatus() { return loaded.status; },
    save() { return save(); },

    // animals
    isUnlocked,
    unlockedSpecies() { return SPECIES_ORDER.filter(isUnlocked); },
    unlockHint(id) { return isUnlocked(id) ? '' : `meta.hint.${id}`; },
    unlockRule(id) { return SPECIES[id]?.unlock || null; },
    getLook(id) {
      const sp = getSpecies(id);
      const stored = d.looks[sp.id];
      try { return mergeLook(sp, stored); } catch {
        return { ...sp.defaults, ...(stored || {}), accessories: { ...sp.defaults.accessories, ...(stored?.accessories || {}) } };
      }
    },
    setLook(id, look) {
      if (!SPECIES[id] || !look || typeof look !== 'object') return false;
      let copy;
      try { copy = JSON.parse(JSON.stringify(look)); } catch { return false; }
      if (typeof copy.decal === 'string' && copy.decal.length > DECAL_MAX) copy.decal = null;
      d.looks[id] = copy;
      save();
      return true;
    },
    resetLook(id) { delete d.looks[id]; save(); },
    getName(id) {
      if (d.names[id]) return d.names[id];
      const k = `meta.name.${id}`;
      const s = t(k);
      return s !== k ? s : (DEFAULT_NAMES[id] || 'Buddy');
    },
    setName(id, name) {
      const n = cleanName(name);
      if (!n) delete d.names[id];
      else {
        d.names[id] = n;
        if (n !== (DEFAULT_NAMES[id] || '')) d.renamed = true;
      }
      checkPending();
      save();
      return profile.getName(id);
    },
    get lastSpecies() { return d.lastSpecies; },
    setLastSpecies(id) { if (SPECIES[id] && d.lastSpecies !== id) { d.lastSpecies = id; save(); } },
    speciesBest(id) { return d.speciesBest[id] || 0; },
    speciesRuns(id) { return d.played[id] || 0; },

    // worlds
    isWorldUnlocked,
    stars(w) { return worldStars(w).slice(); },
    best(w) { const r = worldRec(w); return r ? { size: r.bestSize || 0, time: r.bestTime || null } : null; },
    finished(w) { return !!worldRec(w)?.finished; },
    totalStars,
    worldHint(w) { return isWorldUnlocked(w) ? '' : `meta.worldHint.${w}`; },

    // collection
    journal: {
      has: (type) => !!d.journal[type],
      count: (w) => journalCount(w),
      total: (w) => journalTotal(w),
      pct: (w) => journalPct(w),
      golden: (type) => !!d.golden[type],
      times: (type) => d.journal[type] || 0,
      list: (w) => (w ? worldItems(w) : allItems()).map((id) => ({ id, found: !!d.journal[id], times: d.journal[id] || 0, golden: !!d.golden[id] })),
    },
    eggs: {
      has: (id) => !!d.eggs[id] || (String(id).charAt(0) === 'G' && !!globalEggFound(id)),
      count: (w) => eggCount(w),
      total: (w) => eggTotal(w),
      list: (w) => (w ? eggIdsForWorld(w) : allEggIds()).map((id) => ({ id, world: eggWorld(id), found: !!d.eggs[id] })),
    },
    goldenFound,

    // economy
    get biccies() { return d.biccies; },
    canAfford(price) { return d.biccies >= (Number(price) || 0); },
    owns(id) {
      if (d.owned[id]) return true;
      if (String(id).startsWith('species:')) return isUnlocked(String(id).slice(8));
      const c = cosmetic(id);
      if (!c) return false;
      return (!!c.free || !c.price) && cosmeticUnlocked(c);
    },
    // 'owned' | 'buyable' | 'locked' | 'unknown'
    cosmeticStatus(id) {
      const c = cosmetic(id);
      if (!c) return 'unknown';
      if (profile.owns(id)) return 'owned';
      return cosmeticUnlocked(c) ? 'buyable' : 'locked';
    },
    buy(id) {
      const key = String(id || '');
      // Animals with a price on their unlock rule can be bought outright.
      const spId = key.startsWith('species:') ? key.slice(8) : (SPECIES[key] ? key : null);
      if (spId) {
        const rule = SPECIES[spId]?.unlock;
        if (!rule || rule.price == null || isUnlocked(spId)) return false;
        if (d.biccies < rule.price) return false;
        d.biccies -= rule.price; d.spent += rule.price;
        d.owned['species:' + spId] = true;
        d.seen.species[spId] = true;
        checkPending();
        save();
        return true;
      }
      const c = cosmetic(key);
      if (!c || profile.owns(key) || !cosmeticUnlocked(c)) return false;
      const price = Math.max(0, Number(c.price) || 0);
      if (d.biccies < price) return false;
      d.biccies -= price;
      d.spent += price;
      d.owned[key] = true;
      checkPending();
      save();
      return true;
    },
    addBiccies(n) { const v = Math.floor(Number(n) || 0); d.biccies = Math.max(0, d.biccies + v); if (v > 0) d.earned += v; checkPending(); save(); return d.biccies; },
    specialItem(worldId, date) { return specialItemFor(worldId, date || now()); },

    // run hooks
    onRunEvent,
    finishRun,

    // modes
    daily(date) {
      const dt = date || now();
      const key = dateKey(dt);
      if (d.daily.cache && d.daily.cache.key === key) return { ...d.daily.cache, modifiers: { ...d.daily.cache.modifiers } };
      const worlds = worldOrder().filter(isWorldUnlocked);
      const dl = makeDaily(dt, { worlds, species: profile.unlockedSpecies() });
      d.daily.cache = dl;
      save();
      return { ...dl, modifiers: { ...dl.modifiers } };
    },
    dailyDone(key) { return !!d.daily.done[key || dateKey(now())]; },
    markDailyDone(key) { const ok = markDailyDone(key); if (ok) { checkPending(); save(); } return ok; },
    get streak() { return liveStreak(d.daily, dateKey(now())); },
    get bestStreak() { return d.daily.bestStreak; },

    codes: {
      // Matches the END of the buffer. Toggles the code's modifier (except the
      // one-off OLI gag) and returns { code, modifier, on, egg }. Clear your
      // buffer after a match so the same word doesn't toggle twice.
      check(buffer) {
        const m = matchCode(buffer);
        if (!m) return null;
        d.codes[m.code] = (d.codes[m.code] || 0) + 1;
        let on = true;
        if (m.toggle) { on = !d.modifiers[m.modifier]; setMod(m.modifier, on); }
        checkPending();
        save();
        return { code: m.code, modifier: m.modifier, on, egg: m.egg };
      },
      found(code) { return !!d.codes[code]; },
      KONAMI: KONAMI_TOKEN,
    },
    get modifiers() { return { ...d.modifiers }; },
    setModifier(id, on) {
      if (!MODIFIER_IDS.includes(id)) return false;
      setMod(id, on);
      save();
      return true;
    },

    ghost: {
      save(worldId, samples, o) {
        if (!storage || !worldId || !samples || !samples.length) return 0;
        const rec = packGhost(samples, o);
        try { storage.set('ghost.' + worldId, rec); } catch { return 0; }
        return rec.d.length;
      },
      load(worldId) {
        if (!storage || !worldId) return null;
        let rec = null;
        try { rec = storage.get('ghost.' + worldId, null); } catch { rec = null; }
        return unpackGhost(rec);
      },
      clear(worldId) { try { storage?.remove('ghost.' + worldId); } catch { /* ignore */ } },
    },

    get stats() { return { ...d.stats, stars: totalStars(), biccies: d.earned }; },
    achievements: {
      list() {
        return ACHIEVEMENTS.map((a) => ({
          id: a.id, group: a.group, nameKey: `ach.${a.id}.name`, descKey: `ach.${a.id}.desc`,
          earned: !!d.achievements[a.id], at: d.achievements[a.id] || null,
        }));
      },
      has: (id) => !!d.achievements[id],
      count: () => ACHIEVEMENTS.filter((a) => d.achievements[a.id]).length,
      total: () => ACHIEVEMENTS.length,
      // Earned outside a run (shop, names, codes, dailies). Drains the queue.
      pending() { const p = pending; pending = []; return p; },
    },

    reset() {
      d = defaultData();
      pending = [];
      cur = null;
      collectNewUnlocks();
      for (const w of worldOrder()) { try { storage?.remove('ghost.' + w); } catch { /* ignore */ } }
      save(true);
    },
  };

  function setMod(id, on) {
    if (on) d.modifiers[id] = true;
    else delete d.modifiers[id];
  }
  function globalEggFound(id) {
    const m = { G1: 'BIGHEAD', G2: 'MOONWALK', G3: 'DISCO', G4: 'TINY', G5: 'QUACKERS', G6: KONAMI_TOKEN, G7: 'OLI' }[id];
    return m ? d.codes[m] : 0;
  }

  return profile;
}
