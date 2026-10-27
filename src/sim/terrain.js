// World adapter: terrain height, surfaces and water levels, with the tide formula
// shared with render: level + amp * sin(TAU * t / period).
import { TAU } from '../core/math.js';

export function createTerrain(world) {
  const heightAt = typeof world.heightAt === 'function' ? world.heightAt : () => 0;
  const surfaceAt = typeof world.surfaceAt === 'function' ? world.surfaceAt : () => 'grass';
  const b = world.bounds || { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

  // Water bodies compiled to flat arrays for speed.
  const waters = (world.water || []).map((w) => ({
    kind: w.kind || 'pond',
    level: +w.level || 0,
    rect: w.rect || null,
    amp: w.tide ? +w.tide.amp || 0 : 0,
    period: w.tide ? +w.tide.period || 60 : 60,
    cur: +w.level || 0,
  }));
  const nW = waters.length;
  let maxLevel = -Infinity;
  for (const w of waters) maxLevel = Math.max(maxLevel, w.level + Math.abs(w.amp));
  const sea = waters.find((w) => w.amp !== 0) || waters.find((w) => w.kind === 'sea') || null;

  const T = {
    bounds: b,
    heightAt,
    surfaceAt,
    waters,
    maxLevel,
    hasWater: nW > 0,
    tide: 0,
    // Called once per tick with the sim time.
    update(t) {
      for (let i = 0; i < nW; i++) {
        const w = waters[i];
        w.cur = w.amp ? w.level + w.amp * Math.sin((TAU * t) / w.period) : w.level;
      }
      T.tide = sea && sea.amp ? sea.amp * Math.sin((TAU * t) / sea.period) : 0;
    },
    // Water surface height at a point, or -Infinity if no body covers it.
    waterAt(x, z) {
      let best = -Infinity;
      for (let i = 0; i < nW; i++) {
        const w = waters[i];
        const r = w.rect;
        if (r && (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ)) continue;
        if (w.cur > best) best = w.cur;
      }
      return best;
    },
    // Depth of water over the terrain at a point (0 when dry).
    depthAt(x, z) {
      if (!nW) return 0;
      const wl = T.waterAt(x, z);
      if (wl === -Infinity) return 0;
      const d = wl - heightAt(x, z);
      return d > 0 ? d : 0;
    },
    // Uphill direction, written into out {x, z} (unit or zero). Used to push non-swimmers ashore.
    uphill(x, z, step, out) {
      const hx = heightAt(x + step, z) - heightAt(x - step, z);
      const hz = heightAt(x, z + step) - heightAt(x, z - step);
      const l = Math.hypot(hx, hz);
      if (l < 1e-6) { out.x = 0; out.z = 0; } else { out.x = hx / l; out.z = hz / l; }
      return out;
    },
    inBounds(x, z, m = 0) {
      return x >= b.minX - m && x <= b.maxX + m && z >= b.minZ - m && z <= b.maxZ + m;
    },
  };
  T.update(0);
  return T;
}
