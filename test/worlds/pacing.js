// Rough greedy-bot pacing estimate for tuning growthK (not the real sim).
// Speed follows the sim's TUNE (4.6 * size^0.85, times an average zoomies factor).
// Reach is 0.6 * size + item / 2. The bot targets the best nearby item worth at least
// 8% of its size, and hoovers up anything within reach along the way for free.
import { CATALOGUE } from '../../src/worlds/catalogue.js';
import { expandItems } from '../../src/worlds/layout.js';

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const l2 = vx * vx + vz * vz;
  let t = l2 > 0 ? ((px - ax) * vx + (pz - az) * vz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + vx * t - px, az + vz * t - pz);
}

export function estimatePacing(world, { seed = 7, comboMult = 1.15, speedMult = 1.3, overhead = 0.6, maxTime = 900, trace = null } = {}) {
  const list = expandItems(world, seed).filter((i) => !i.hidden).map((i) => ({ x: i.x, z: i.z, type: i.type, size: CATALOGUE[i.type].size, gone: false }));
  let s = world.goals.start, x = world.spawn.x, z = world.spawn.z, t = 0, n = 0;
  const k = world.goals.growthK;
  const out = { goalT: null, stretchT: null, gobblesToGoal: null, gobblesToStretch: null, final: 0, items: list.length };
  const eat = (it) => {
    it.gone = true; n++;
    s = Math.cbrt(s ** 3 + k * it.size ** 3 * comboMult);
    if (out.goalT == null && s >= world.goals.goal) { out.goalT = t; out.gobblesToGoal = n; }
    if (out.stretchT == null && s >= world.goals.stretch) { out.stretchT = t; out.gobblesToStretch = n; }
  };
  let lastTrace = 0;
  while (t < maxTime) {
    const lim = s * 0.6;
    let best = -1, bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.gone || it.size > lim || it.size < s * 0.08) continue;
      const d = Math.hypot(it.x - x, it.z - z);
      const c = (d + 2 * s) / (it.size / s);
      if (c < bd) { bd = c; best = i; }
    }
    if (best < 0) {
      // nothing worth chasing: sweep up the nearest crumb
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (it.gone || it.size > lim) continue;
        const d = Math.hypot(it.x - x, it.z - z);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) break;
    }
    const it = list[best];
    const reach = 0.6 * s;
    const d = Math.max(0, Math.hypot(it.x - x, it.z - z) - (reach + it.size / 2));
    const v = 4.6 * Math.pow(s, 0.85) * speedMult;
    t += d / v + overhead;
    // hoover anything small within reach of the path
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.gone || o === it || o.size > lim) continue;
      if (segDist(o.x, o.z, x, z, it.x, it.z) <= reach + o.size / 2) eat(o);
    }
    x = it.x; z = it.z;
    eat(it);
    if (trace && t - lastTrace > 20) { lastTrace = t; trace.push(`${Math.round(t)}s:${s.toFixed(2)}m`); }
  }
  out.final = s; out.gobbles = n; out.t = t;
  return out;
}
