// Pure DSP helpers: decibel maths, filters, loudness measurement and
// normalisation. No WebAudio here, so everything is testable in Node and the
// same code measures the synth offline (see test/audio/measure.test.js).

export const TAU = Math.PI * 2;

export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => (g > 1e-10 ? 20 * Math.log10(g) : -200);
export const powerToDb = (p) => (p > 1e-20 ? 10 * Math.log10(p) : -200);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const semisToRatio = (s) => Math.pow(2, s / 12);

// Volume sliders (0..1) use a squared curve: it feels even across the range
// and 0 is true silence. 0.6 is about -8.9 dB, 0.9 about -1.8 dB.
export function sliderToGain(v) {
  const x = clamp(Number(v) || 0, 0, 1);
  return x * x;
}
export const sliderToDb = (v) => gainToDb(sliderToGain(v));

// Gobble pop pitch: climbs a major pentatonic scale with the combo count.
// combo 1 is the root, 2 is +2 semitones, ... 6 is an octave up. Capped at
// two octaves so it never turns into a dog whistle.
export const PENTATONIC = [0, 2, 4, 7, 9];
export function pentatonicSemis(step) {
  const s = Math.max(0, Math.floor(step));
  return PENTATONIC[s % 5] + 12 * Math.floor(s / 5);
}
export function gobbleSemis(combo, maxSemis = 24) {
  const c = Math.max(1, Math.floor(combo || 1));
  return Math.min(maxSemis, pentatonicSemis(c - 1));
}
export const gobblePitch = (combo) => semisToRatio(gobbleSemis(combo));

// ---------------------------------------------------------------------------
// Deterministic noise (xorshift32), so rendered buffers are reproducible.
export function createNoise(seed = 1) {
  let s = (seed >>> 0) || 0x1234567;
  const f = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
  f.uniform = () => (f() + 1) * 0.5;
  return f;
}

// ---------------------------------------------------------------------------
// Biquads (RBJ cookbook). coefs = { b0, b1, b2, a1, a2 } normalised by a0.
export function rbj(type, freq, q, sr, gainDb = 0) {
  const f = clamp(freq, 1, sr * 0.49);
  const w = TAU * f / sr;
  const cw = Math.cos(w), sw = Math.sin(w);
  const alpha = sw / (2 * (q || 0.7071));
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lowpass': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'highpass': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break; // 0 dB peak
    case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'peaking': b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
    case 'highshelf': {
      const sq = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cw + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sq);
      a0 = (A + 1) - (A - 1) * cw + sq; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sq; break;
    }
    case 'lowshelf': {
      const sq = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cw + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sq);
      a0 = (A + 1) + (A - 1) * cw + sq; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sq; break;
    }
    default: throw new Error('rbj: unknown type ' + type);
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

// In-place transposed direct form II.
export function biquad(buf, c, start = 0, end = buf.length) {
  let z1 = 0, z2 = 0;
  const { b0, b1, b2, a1, a2 } = c;
  for (let i = start; i < end; i++) {
    const x = buf[i];
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    buf[i] = y;
  }
  return buf;
}
export const filter = (buf, type, freq, q, sr, gainDb) => biquad(buf, rbj(type, freq, q, sr, gainDb));

// A state-variable filter whose cutoff can move every sample (for sweeps).
// cutoffAt(i) returns Hz. Returns the chosen output ('lp'|'bp'|'hp').
export function svf(buf, sr, cutoffAt, q = 0.7, mode = 'lp') {
  let ic1 = 0, ic2 = 0;
  const k = 1 / q;
  for (let i = 0; i < buf.length; i++) {
    const fc = clamp(cutoffAt(i), 10, sr * 0.45);
    const g = Math.tan(Math.PI * fc / sr);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v0 = buf[i];
    const v3 = v0 - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    buf[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 : v0 - k * v1 - v2;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Measurement
export function peak(buf) {
  let p = 0;
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; }
  return p;
}
export function meanSquare(buf, start = 0, end = buf.length) {
  let s = 0;
  for (let i = start; i < end; i++) s += buf[i] * buf[i];
  return end > start ? s / (end - start) : 0;
}
export const rms = (buf) => Math.sqrt(meanSquare(buf));
export const peakDb = (buf) => gainToDb(peak(buf));
export const rmsDb = (buf) => powerToDb(meanSquare(buf));

// ITU-R BS.1770 K-weighting coefficients for any sample rate (the same
// derivation libebur128 uses), as two biquads.
export function kWeighting(sr) {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / sr);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = { b0: (Vh + Vb * K / Q + K * K) / a0, b1: 2 * (K * K - Vh) / a0, b2: (Vh - Vb * K / Q + K * K) / a0, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
  f0 = 38.13547087602444; Q = 0.5003270373238773;
  K = Math.tan(Math.PI * f0 / sr);
  a0 = 1 + K / Q + K * K;
  const hp = { b0: 1, b1: -2, b2: 1, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, hp];
}

// Integrated loudness in LUFS (mono, gated as BS.1770-4: 400 ms blocks with
// 75% overlap, absolute gate -70, relative gate -10 LU). Clips shorter than one
// block are measured ungated over their whole length.
export function loudness(buf, sr) {
  if (!buf.length) return -200;
  const w = Float32Array.from(buf);
  for (const c of kWeighting(sr)) biquad(w, c);
  const block = Math.round(0.4 * sr), hop = Math.round(0.1 * sr);
  if (w.length < block) return -0.691 + powerToDb(meanSquare(w));
  const ms = [];
  for (let s = 0; s + block <= w.length; s += hop) ms.push(meanSquare(w, s, s + block));
  const lk = (p) => -0.691 + powerToDb(p);
  const abs = ms.filter((p) => lk(p) > -70);
  if (!abs.length) return -200;
  const relGate = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const rel = abs.filter((p) => lk(p) > relGate);
  return lk(rel.reduce((a, b) => a + b, 0) / rel.length);
}

// Loudness of only the sounding part of a short clip (so a pop with a long
// silent tail is judged by its body). Uses 50 ms blocks above -50 LUFS.
export function activeLoudness(buf, sr) {
  const w = Float32Array.from(buf);
  for (const c of kWeighting(sr)) biquad(w, c);
  const block = Math.max(1, Math.round(0.05 * sr));
  let sum = 0, n = 0;
  for (let s = 0; s < w.length; s += block) {
    const p = meanSquare(w, s, Math.min(w.length, s + block));
    if (-0.691 + powerToDb(p) > -50) { sum += p; n++; }
  }
  return n ? -0.691 + powerToDb(sum / n) : -200;
}

// Gain (dB) that takes a clip measured at `measured` LUFS to `target`, limited
// so the clip's peak lands no higher than `ceilingDb` and the boost is sane.
export function normGainDb(measured, target = -16, { peakLin = 0, ceilingDb = -1, maxBoost = 24, maxCut = 40 } = {}) {
  if (!(measured > -150)) return 0;
  let g = clamp(target - measured, -maxCut, maxBoost);
  if (peakLin > 0) g = Math.min(g, ceilingDb - gainToDb(peakLin));
  return g;
}

export function scale(buf, g) { for (let i = 0; i < buf.length; i++) buf[i] *= g; return buf; }

// Normalise a buffer in place to a loudness target, with a peak ceiling.
export function normalise(buf, sr, target = -16, { active = true, ceilingDb = -1 } = {}) {
  const L = active ? activeLoudness(buf, sr) : loudness(buf, sr);
  const g = normGainDb(L, target, { peakLin: peak(buf), ceilingDb });
  scale(buf, dbToGain(g));
  return g;
}

export function normalisePeak(buf, ceilingDb = -1) {
  const p = peak(buf);
  if (p > 0) scale(buf, dbToGain(ceilingDb) / p);
  return buf;
}

// Mix src into dst at a sample offset with a gain (clipped to dst length).
export function mixInto(dst, src, offset = 0, gain = 1) {
  const o = Math.floor(offset);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[o + i] += src[i] * gain;
  return dst;
}

// Short fades to kill clicks at buffer edges.
export function fadeEdges(buf, sr, inS = 0.002, outS = 0.01) {
  const a = Math.min(buf.length, Math.floor(inS * sr)), b = Math.min(buf.length, Math.floor(outS * sr));
  for (let i = 0; i < a; i++) buf[i] *= i / a;
  for (let i = 0; i < b; i++) buf[buf.length - 1 - i] *= i / b;
  return buf;
}

// Make a buffer loop seamlessly: crossfades the last `fadeS` seconds into the
// start and returns a buffer that much shorter.
export function makeLoop(buf, sr, fadeS = 0.5) {
  const f = Math.min(Math.floor(fadeS * sr), Math.floor(buf.length / 3));
  const n = buf.length - f;
  const out = new Float32Array(n);
  out.set(buf.subarray(0, n));
  for (let i = 0; i < f; i++) {
    const t = i / f;
    out[i] = buf[i] * Math.sin(t * Math.PI / 2) + buf[n + i] * Math.cos(t * Math.PI / 2);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dynamics: a static compressor curve and the WebAudio makeup-gain model.
// The Web Audio spec's DynamicsCompressorNode applies automatic makeup gain of
// (1 / curve(0 dBFS)) ^ 0.6, so we compensate with a fixed gain after it.
export function compressCurveDb(xDb, threshold, ratio, knee = 0) {
  const over = xDb - threshold;
  if (knee > 0 && Math.abs(over) <= knee / 2) {
    const t = over + knee / 2;
    return xDb + (1 / ratio - 1) * t * t / (2 * knee);
  }
  return over > 0 ? threshold + over / ratio : xDb;
}
export function webAudioMakeupDb(threshold, ratio, knee = 0) {
  return -0.6 * compressCurveDb(0, threshold, ratio, knee);
}

// Sample-by-sample feed-forward compressor model (peak detector with attack and
// release), used offline to estimate what the voice chain does to a line.
export function compressModel(buf, sr, { threshold = -18, ratio = 3, knee = 6, attack = 0.005, release = 0.15, makeupDb = 0 } = {}) {
  const out = new Float32Array(buf.length);
  const aA = Math.exp(-1 / (attack * sr)), aR = Math.exp(-1 / (release * sr));
  let env = 0, maxGr = 0;
  const mk = dbToGain(makeupDb);
  for (let i = 0; i < buf.length; i++) {
    const x = Math.abs(buf[i]);
    env = x > env ? aA * env + (1 - aA) * x : aR * env + (1 - aR) * x;
    const eDb = gainToDb(env);
    const gr = compressCurveDb(eDb, threshold, ratio, knee) - eDb;
    if (gr < maxGr) maxGr = gr;
    out[i] = buf[i] * dbToGain(gr) * mk;
  }
  out.maxReductionDb = maxGr;
  return out;
}

// Equal-power pan gains for -1..1.
export function panGains(pan) {
  const p = (clamp(pan, -1, 1) + 1) * Math.PI / 4;
  return [Math.cos(p), Math.sin(p)];
}

// Listener-relative pan and distance gain. Forward is (sin yaw, cos yaw),
// right is (-cos yaw, sin yaw), as in CONTRACTS §0.
export function spatial(lx, lz, yaw, sx, sz, refDist = 6, maxDist = 80) {
  const dx = sx - lx, dz = sz - lz;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return { pan: 0, gain: 1, dist: 0 };
  const rx = -Math.cos(yaw), rz = Math.sin(yaw);
  const pan = clamp((dx * rx + dz * rz) / d, -1, 1) * clamp(d / refDist, 0, 1);
  const gain = d <= refDist ? 1 : d >= maxDist ? 0 : Math.pow(refDist / d, 1.1) * (1 - (d - refDist) / (maxDist - refDist)) ** 0.5;
  return { pan, gain, dist: d };
}
