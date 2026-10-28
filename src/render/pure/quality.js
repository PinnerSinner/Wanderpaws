// Quality tiers and the auto-detect benchmark. Pure: no three, no DOM.

export const TIER_ORDER = ['low', 'medium', 'high'];

export const TIERS = Object.freeze({
  low: Object.freeze({
    id: 'low', dprCap: 1, shadows: false, shadowMap: 0, shadowRadius: 0,
    post: false, bloom: false, godRays: false, msaa: 0,
    particles: 300, weather: 700, birds: 24, icons: 24,
    npcCullPx: 6, swayDetail: 0, waterDetail: 0, clouds: false,
  }),
  medium: Object.freeze({
    id: 'medium', dprCap: 1.5, shadows: true, shadowMap: 1024, shadowRadius: 3,
    post: true, bloom: true, godRays: false, msaa: 4,
    particles: 1000, weather: 1100, birds: 48, icons: 40,
    npcCullPx: 4, swayDetail: 1, waterDetail: 1, clouds: true,
  }),
  high: Object.freeze({
    id: 'high', dprCap: 2, shadows: true, shadowMap: 2048, shadowRadius: 4,
    post: true, bloom: true, godRays: true, msaa: 4,
    particles: 2500, weather: 1400, birds: 48, icons: 64,
    npcCullPx: 2, swayDetail: 2, waterDetail: 2, clouds: true,
  }),
});

export function isTier(t) { return t === 'low' || t === 'medium' || t === 'high'; }

// The tier to run right now, from the 'quality' and 'resolvedQuality' settings.
export function resolveTier(quality, resolved) {
  if (isTier(quality)) return quality;
  if (isTier(resolved)) return resolved;
  return 'medium';
}

// Frame-time statistics over a sample buffer (ms). Writes into `out`.
export function frameStats(samples, n, out = { mean: 0, median: 0, p90: 0, fps: 0 }) {
  if (!n) { out.mean = out.median = out.p90 = out.fps = 0; return out; }
  const tmp = Array.prototype.slice.call(samples, 0, n).sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += tmp[i];
  out.mean = sum / n;
  out.median = tmp[(n - 1) >> 1];
  out.p90 = tmp[Math.min(n - 1, Math.floor(n * 0.9))];
  out.fps = out.mean > 0 ? 1000 / out.mean : 0;
  return out;
}

// Pick a tier from warm-up frame times measured at `measuredAt` quality.
// Thresholds leave headroom: a tier is only chosen if it would hold about 60 fps.
export function pickTier(samples, n, measuredAt = 'medium') {
  const s = frameStats(samples, n);
  if (!n) return measuredAt;
  const ms = s.median * 0.6 + s.p90 * 0.4;
  // Rough cost ratios relative to medium (shadows + bloom on, dpr 1.5).
  const scale = measuredAt === 'low' ? 1.9 : measuredAt === 'high' ? 0.7 : 1;
  const medMs = ms * scale;
  if (medMs < 9.5) return 'high';
  if (medMs < 19) return 'medium';
  return 'low';
}

// A 2 s warm-up benchmark: skip the first `skip` seconds (shader compiles), then
// record frame times for `duration` seconds and pick a tier.
export function createBenchmark({ duration = 2, skip = 0.6, maxSamples = 600 } = {}) {
  const samples = new Float32Array(maxSamples);
  let n = 0, t = 0, done = false, result = null;
  return {
    get done() { return done; },
    get result() { return result; },
    get samples() { return n; },
    push(dtSec, measuredAt) {
      if (done) return true;
      t += dtSec;
      if (t > skip && n < maxSamples) samples[n++] = dtSec * 1000;
      if (t >= skip + duration) { done = true; result = pickTier(samples, n, measuredAt); }
      return done;
    },
    reset() { n = 0; t = 0; done = false; result = null; },
  };
}

// Device pixel ratio for a tier, capped, never below 1 (and never above the device's own).
export function dprFor(tier, deviceDpr = 1) {
  const cap = (TIERS[tier] || TIERS.medium).dprCap;
  return Math.max(1, Math.min(cap, deviceDpr || 1));
}
