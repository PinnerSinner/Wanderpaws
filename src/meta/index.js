// STUB (lead): replaced by the Meta agent.
import { getSpecies } from '../animals/species.js';
export function createProfile() {
  return { data: {}, save() {}, isUnlocked: () => true, unlockedSpecies: () => [], unlockHint: () => '',
    getLook: (id) => getSpecies(id).defaults, setLook() {}, getName: (id) => (id === 'oli' ? 'Oli' : 'Buddy'), setName() {},
    lastSpecies: 'oli', setLastSpecies() {}, isWorldUnlocked: () => true, stars: () => [false, false, false], best: () => null,
    journal: { has: () => false, count: () => 0, total: () => 0, pct: () => 0, golden: () => false }, eggs: { has: () => false, count: () => 0, total: () => 0 },
    biccies: 0, canAfford: () => false, owns: () => false, buy: () => false, onRunEvent: () => [], finishRun: () => ({ biccies: 0, newUnlocks: [], achievements: [], records: {} }),
    daily: () => null, dailyDone() {}, streak: 0, codes: { check: () => null }, modifiers: {}, setModifier() {},
    ghost: { save() {}, load: () => null }, stats: {}, achievements: { list: () => [], has: () => false }, reset() {} };
}
