// Achievements (F23). Names and descriptions live in copy.js as
// ach.<id>.name and ach.<id>.desc. Each check gets a context:
//   d    the save data
//   r    the current run's counters (or null outside a run)
//   res  the run result (only at finishRun, otherwise null)
//   q    derived queries: journalPct, eggCount(w?), eggTotal(w?), totalStars,
//        worldStars(w), storyDone, goldenWorlds, ownedCount, playedCount, world(id)
// `group` is for the UI to sort by: grow, gobble, explore, eggs, play, collect, social.

import { SPECIES_ORDER } from '../animals/species.js';

const st = (c) => c.d.stats;
const egg = (id) => (c) => !!c.d.eggs[id];
const runStars = (c) => (c.res && Array.isArray(c.res.stars) ? c.res.stars : null);

export const ACHIEVEMENTS = [
  // Grow
  { id: 'elevenses', group: 'gobble', check: (c) => st(c).gobbled >= 1 },
  { id: 'peckish', group: 'gobble', check: (c) => st(c).gobbled >= 1000 },
  { id: 'bigLad', group: 'grow', check: (c) => st(c).biggestSize >= 10 },
  { id: 'absoluteUnit', group: 'grow', check: (c) => st(c).biggestSize >= 100 },
  { id: 'visibleFromSpace', group: 'grow', check: (c) => st(c).biggestSize >= 300 },
  // Tea and silliness
  { id: 'teaTotal', group: 'play', check: (c) => !!c.r && c.r.tea >= 5 },
  { id: 'milkTwoSugars', group: 'play', check: (c) => st(c).tea >= 100 },
  { id: 'puddleProfessional', group: 'play', check: (c) => st(c).splashes >= 50 },
  { id: 'fluentInPombo', group: 'play', check: (c) => st(c).pigeons >= 100 },
  { id: 'allBark', group: 'play', check: (c) => st(c).barks >= 500 },
  { id: 'veryPolite', group: 'play', check: (c) => st(c).playBows >= 50 },
  { id: 'bitWobbly', group: 'play', check: (c) => (!!c.r && c.r.wobble > 0) || !!c.d.eggs.C3 },
  { id: 'walkies', group: 'play', check: (c) => st(c).distance >= 10000 },
  // Combos and bumps
  { id: 'onARoll', group: 'gobble', check: (c) => st(c).bestCombo >= 10 },
  { id: 'comboBreaker', group: 'gobble', check: (c) => st(c).bestCombo >= 25 },
  { id: 'butterpaws', group: 'play', check: (c) => !!c.r && c.r.bumps >= 10 },
  { id: 'notAScratch', group: 'play', check: (c) => {
    const s = runStars(c);
    if (!s || !s[0]) return false;
    const touched = c.res.hazardsTouched ?? c.r?.hazardBumps ?? 0;
    return touched === 0;
  } },
  // Stars and worlds
  { id: 'goldStar', group: 'explore', check: (c) => c.q.totalStars() >= 1 },
  { id: 'hatTrick', group: 'explore', check: (c) => { const s = runStars(c); return !!s && !!(s[0] && s[1] && s[2]); } },
  { id: 'teachersPet', group: 'explore', check: (c) => c.q.totalStars() >= 15 },
  { id: 'beatTheKettle', group: 'explore', check: (c) => {
    const s = runStars(c);
    if (!s || !s[0] || !c.r) return false;
    const par = c.q.world(c.r.worldId)?.goals?.par;
    return !!par && c.res.time > 0 && c.res.time <= par;
  } },
  { id: 'geraldWho', group: 'explore', check: (c) => c.q.storyDone() },
  { id: 'feetUp', group: 'play', check: (c) => !!c.res && !!c.r && c.r.mode === 'chill' },
  { id: 'offLikeAShot', group: 'play', check: (c) => !!c.res && !!c.r && c.r.mode === 'zoomies' },
  // Eggs
  { id: 'eggsBenedict', group: 'eggs', check: (c) => c.q.eggCount() >= 10 },
  { id: 'fullEnglish', group: 'eggs', check: (c) => c.q.anyWorldEggsComplete() },
  { id: 'wholeClutch', group: 'eggs', check: (c) => c.q.eggTotal() > 0 && c.q.eggCount() >= c.q.eggTotal() },
  { id: 'pingPong', group: 'eggs', check: egg('C1') },
  { id: 'noPlaceLikeHome', group: 'eggs', check: egg('C2') },
  { id: 'golaco', group: 'eggs', check: egg('C5') },
  { id: 'localhostExpress', group: 'eggs', check: egg('L3') },
  { id: 'stiffUpperLip', group: 'eggs', check: egg('L11') },
  { id: 'threeWayHandshake', group: 'eggs', check: egg('M10') },
  { id: 'turnItOffAndOn', group: 'eggs', check: egg('M14') },
  // Collection
  { id: 'midasPaws', group: 'collect', check: (c) => c.q.goldenWorlds() >= 1 || Object.keys(c.d.golden).length >= 1 },
  { id: 'gildedLily', group: 'collect', check: (c) => c.q.goldenWorlds() >= 5 },
  { id: 'nosyParker', group: 'collect', check: (c) => c.q.journalPct() >= 50 },
  { id: 'knowItAll', group: 'collect', check: (c) => c.q.journalPct() >= 100 },
  { id: 'everyAnimal', group: 'collect', check: (c) => SPECIES_ORDER.every((s) => c.d.played[s] > 0) },
  { id: 'purrfectlyNetworked', group: 'collect', check: (c) => !!c.d.eggs.M12 },
  // Shop and profile
  { id: 'biscuitTin', group: 'collect', check: (c) => c.d.biccies >= 500 },
  { id: 'retailTherapy', group: 'collect', check: (c) => c.d.spent > 0 },
  { id: 'dressedToTheNines', group: 'collect', check: (c) => c.q.ownedCount() >= 9 },
  { id: 'whatsInAName', group: 'social', check: (c) => !!c.d.renamed },
  // Daily and codes
  { id: 'sameTimeTomorrow', group: 'social', check: (c) => st(c).dailies >= 1 },
  { id: 'creatureOfHabit', group: 'social', check: (c) => c.d.daily.bestStreak >= 7 },
  { id: 'characterBuilding', group: 'social', check: (c) => Object.keys(c.d.codes).length >= 1 },
  { id: 'goodBoyMode', group: 'social', check: (c) => !!c.d.codes.KONAMI },
  { id: 'secretSquirrel', group: 'social', check: (c) => c.q.codesFound() >= 7 },
];

export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);

// Returns ids that pass now and weren't already earned. Doesn't record them.
export function evaluate(ctx, earned) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (earned[a.id]) continue;
    let ok = false;
    try { ok = !!a.check(ctx); } catch { ok = false; }
    if (ok) out.push(a.id);
  }
  return out;
}
