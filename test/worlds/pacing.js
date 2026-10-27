// Rough greedy-bot pacing estimate for tuning growthK (not the real sim).
// Speed follows sim TUNE (4.6 * size^0.85 * ~1.35 average sprint), reach 0.6*size + item/2.
import { CATALOGUE } from '../../src/worlds/catalogue.js';
import { expandItems } from '../../src/worlds/layout.js';

export function estimatePacing(world, { seed = 7, comboMult = 1.15, speedMult = 1.35, overhead = 0.35, maxTime = 900 } = {}) {
  const list = expandItems(world, seed).filter((i) => !i.hidden).map((i) => ({ ...i, size: CATALOGUE[i.type].size, gone: false }));
  let s = world.goals.start, x = world.spawn.x, z = world.spawn.z, t = 0, n = 0;
  const k = world.goals.growthK;
  const out = { goalT: null, stretchT: null, gobblesToGoal: null, final: 0, items: list.length };
  while (t < maxTime) {
    const lim = s * 0.6;
    let best = -1, bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.gone || it.size > lim) continue;
      // prefer near and big-ish: cost = distance / value
      const d = Math.hypot(it.x - x, it.z - z);
      const c = d / (0.3 + it.size / s);
      if (c < bd) { bd = c; best = i; }
    }
    if (best < 0) break;
    const it = list[best];
    const d = Math.max(0, Math.hypot(it.x - x, it.z - z) - (0.6 * s + it.size / 2));
    const v = 4.6 * Math.pow(s, 0.85) * speedMult;
    t += d / v + overhead * Math.min(1, s) * 0 + 0.12;
    x = it.x; z = it.z; it.gone = true; n++;
    s = Math.cbrt(s ** 3 + k * it.size ** 3 * comboMult * (CATALOGUE[it.type].food ? 1 : 1));
    if (out.goalT == null && s >= world.goals.goal) { out.goalT = t; out.gobblesToGoal = n; }
    if (out.stretchT == null && s >= world.goals.stretch) out.stretchT = t;
  }
  out.final = s; out.gobbles = n; out.t = t;
  return out;
}
