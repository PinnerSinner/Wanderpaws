// The Biccies economy. Tuned so a mid-priced cosmetic (about 250) costs a run
// or two: a first clear of a world pays roughly 350 to 500, a replay 150 to 300.

import { CATALOGUE } from '../worlds/catalogue.js';

export const ECONOMY = Object.freeze({
  gobbleRate: 0.3,          // biccies per catalogue value point gobbled
  goldenMult: 5,            // golden variants are worth five times as much
  specialMult: 3,           // the daily special item is worth triple (F16)
  comboMin: 5,              // combos shorter than this pay nothing extra
  starFirst: [25, 40, 75],  // first time each star is earned in a world
  starRepeat: 5,            // every star earned again on a replay
  eggFirst: 30,             // first time an egg is found
  discovery: 4,             // first ever gobble of an item type (Journal entry)
  goldenFirst: 25,          // first golden item found in a world
  activity: 15,             // a mini-game success with no reward of its own
  finishRun: 10,            // turning up and finishing a run
  dailyBase: 100,           // completing the daily challenge
  dailyStreakStep: 15,      // extra per day of streak, capped below
  dailyStreakCap: 7,
  modeMult: { story: 1, chill: 0.75, zoomies: 1, daily: 1, speedrun: 1 },
});

// Suggested shop price bands (shared with the Animals agent in REQUESTS.md).
export const PRICE_BANDS = Object.freeze({ cheap: 120, mid: 250, posh: 450, swanky: 750 });

export function itemValue(type) {
  const it = CATALOGUE[type];
  return it && Number.isFinite(it.value) ? it.value : 1;
}

// Unrounded biccies for one gobble.
export function gobbleBiccies(type, { golden = false, special = false } = {}) {
  let v = itemValue(type) * ECONOMY.gobbleRate;
  if (golden) v *= ECONOMY.goldenMult;
  if (special) v *= ECONOMY.specialMult;
  return v;
}

// Bonus when a combo ends: 5 -> 6, 10 -> 15, 20 -> 40, 30 -> 75.
export function comboBiccies(count) {
  if (!(count >= ECONOMY.comboMin)) return 0;
  return Math.round(count * (1 + count / 20));
}

// Stars: newly earned pay the first-time rate, the rest pay the repeat rate.
export function starBiccies(prev, now) {
  let total = 0;
  for (let i = 0; i < 3; i++) {
    if (!now[i]) continue;
    total += prev[i] ? ECONOMY.starRepeat : ECONOMY.starFirst[i];
  }
  return total;
}

export function dailyBiccies(streak) {
  const s = Math.max(0, Math.min(ECONOMY.dailyStreakCap, (streak | 0) - 1));
  return ECONOMY.dailyBase + s * ECONOMY.dailyStreakStep;
}

export function modeMult(mode) {
  return ECONOMY.modeMult[mode] ?? 1;
}
