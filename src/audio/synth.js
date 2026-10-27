// Pure synthesis primitives. Every sound in the game is rendered by these into
// a Float32Array (mono), then played back by WebAudio as an AudioBuffer. That
// keeps the runtime graph tiny and lets Node measure every sound offline.

import { TAU, createNoise, clamp, biquad, rbj, svf } from './dsp.js';

export const SR = 32000;          // music, sfx, voices
export const SR_AMB = 24000;      // long ambience loops

export const buf = (sr, secs) => new Float32Array(Math.max(1, Math.ceil(secs * sr)));

function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

// Generic oscillator into a buffer. f, amp and pw may be numbers or functions
// of time in seconds. wave: sine | tri | saw | square | pulse | noise.
export function tone(sr, secs, { f = 440, wave = 'sine', amp = 1, pw = 0.5, phase = 0, seed = 1, out } = {}) {
  const o = out || buf(sr, secs);
  const n = Math.min(o.length, Math.ceil(secs * sr));
  const fF = typeof f === 'function', aF = typeof amp === 'function', pF = typeof pw === 'function';
  const noise = wave === 'noise' ? createNoise(seed) : null;
  let ph = phase;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const fr = fF ? f(t) : f;
    const dt = fr / sr;
    let v;
    switch (wave) {
      case 'sine': v = Math.sin(TAU * ph); break;
      case 'tri': v = 1 - 4 * Math.abs(ph - 0.5); break;
      case 'saw': v = 2 * ph - 1 - blep(ph, dt); break;
      case 'square': case 'pulse': {
        const w = pF ? pw(t) : (wave === 'square' ? 0.5 : pw);
        v = (ph < w ? 1 : -1) + blep(ph, dt) - blep((ph + 1 - w) % 1, dt);
        break;
      }
      case 'noise': v = noise(); break;
      default: v = Math.sin(TAU * ph);
    }
    o[i] += v * (aF ? amp(t) : amp);
    ph += dt; if (ph >= 1) ph -= Math.floor(ph);
  }
  return o;
}

// Envelopes as functions of t (seconds)
export const expDecay = (tau) => (t) => Math.exp(-t / tau);
export function adsr(a, d, s, r, holdUntil) {
  return (t) => {
    if (t < a) return t / a;
    if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
    if (holdUntil == null || t < holdUntil) return s;
    const rt = t - holdUntil;
    return rt < r ? s * (1 - rt / r) : 0;
  };
}
// Attack then exponential decay, with an optional release cut at `hold`.
export function pluckEnv(attack, tau, hold = Infinity, release = 0.08) {
  return (t) => {
    const a = t < attack ? t / attack : 1;
    let v = a * Math.exp(-Math.max(0, t - attack) / tau);
    if (t > hold) v *= Math.max(0, 1 - (t - hold) / release);
    return v;
  };
}

export function noise(sr, secs, seed = 1, amp = 1, out) {
  return tone(sr, secs, { wave: 'noise', seed, amp, out });
}

// Pinkish noise via a cheap 3-pole filter (Paul Kellet's economy method).
export function pinkNoise(sr, secs, seed = 1) {
  const o = buf(sr, secs), rnd = createNoise(seed);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < o.length; i++) {
    const w = rnd();
    b0 = 0.99765 * b0 + w * 0.0990460;
    b1 = 0.96300 * b1 + w * 0.2965164;
    b2 = 0.57000 * b2 + w * 1.0526913;
    o[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return o;
}

// Brown noise (integrated white noise), for rumbles and distant traffic.
export function brownNoise(sr, secs, seed = 1) {
  const o = buf(sr, secs), rnd = createNoise(seed);
  let last = 0;
  for (let i = 0; i < o.length; i++) { last = (last + 0.02 * rnd()) / 1.02; o[i] = last * 3.5; }
  return o;
}

// Karplus-Strong plucked string. bright 0..1 colours the excitation, damp is
// the loop lowpass (0.5 = classic average), decay scales sustain.
export function pluck(sr, freq, secs, { bright = 0.5, damp = 0.5, decay = 0.996, seed = 7 } = {}) {
  const o = buf(sr, secs);
  const D = sr / freq - damp;           // loop delay left after the averager
  let N = Math.floor(D), frac = D - N;
  if (frac < 0.1 && N > 2) { N -= 1; frac += 1; }
  N = Math.max(2, N);
  const c = (1 - frac) / (1 + frac);   // first-order allpass for fine tuning
  const line = new Float32Array(N);
  const rnd = createNoise(seed);
  let lpv = 0;
  const k = 0.15 + 0.8 * bright;
  for (let i = 0; i < N; i++) { lpv += k * (rnd() - lpv); line[i] = lpv; }
  let mean = 0; for (let i = 0; i < N; i++) mean += line[i]; mean /= N;
  for (let i = 0; i < N; i++) line[i] -= mean;
  let idx = 0, last = 0, apx = 0, apy = 0;
  for (let i = 0; i < o.length; i++) {
    const out = line[idx];
    const y = decay * ((1 - damp) * out + damp * last);
    last = out;
    apy = c * y + apx - c * apy; apx = y;
    line[idx] = apy;
    o[i] = out;
    idx++; if (idx === N) idx = 0;
  }
  return o;
}

// Two-operator FM. index may be a function of t.
export function fm(sr, secs, { fc = 440, ratio = 1, index = 1, amp = 1, fmod, out } = {}) {
  const o = out || buf(sr, secs);
  const iF = typeof index === 'function', aF = typeof amp === 'function', cF = typeof fc === 'function';
  let pc = 0, pm = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const c = cF ? fc(t) : fc;
    const m = fmod != null ? fmod : c * ratio;
    const mod = Math.sin(TAU * pm) * (iF ? index(t) : index);
    o[i] += Math.sin(TAU * pc + mod) * (aF ? amp(t) : amp);
    pc += c / sr; pm += m / sr;
    if (pc > 1) pc -= 1; if (pm > 1) pm -= 1;
  }
  return o;
}

export function applyEnv(o, env, sr) {
  for (let i = 0; i < o.length; i++) o[i] *= env(i / sr);
  return o;
}

export function lp(o, sr, f, q = 0.707) { return biquad(o, rbj('lowpass', f, q, sr)); }
export function hp(o, sr, f, q = 0.707) { return biquad(o, rbj('highpass', f, q, sr)); }
export function bp(o, sr, f, q = 1) { return biquad(o, rbj('bandpass', f, q, sr)); }
export function peakEq(o, sr, f, q, db) { return biquad(o, rbj('peaking', f, q, sr, db)); }
export function sweep(o, sr, cutoffAt, q, mode) { return svf(o, sr, cutoffAt, q, mode); }

// Soft saturation
export function drive(o, amount = 2) {
  const k = Math.tanh(amount);
  for (let i = 0; i < o.length; i++) o[i] = Math.tanh(o[i] * amount) / k;
  return o;
}

// Bit and sample-rate crusher (Packet, robot sound pack, data sounds).
export function crush(o, bits = 6, hold = 4) {
  const q = Math.pow(2, bits - 1);
  let h = 0;
  for (let i = 0; i < o.length; i++) {
    if (i % hold === 0) h = Math.round(o[i] * q) / q;
    o[i] = h;
  }
  return o;
}

// Formant filter: a sum of parallel bandpasses at the given formants.
export function formants(o, sr, fs, q = 8, gains) {
  const out = new Float32Array(o.length);
  fs.forEach((f, k) => {
    const c = Float32Array.from(o);
    biquad(c, rbj('bandpass', f, q, sr));
    const g = gains ? gains[k] : 1;
    for (let i = 0; i < out.length; i++) out[i] += c[i] * g;
  });
  return out;
}

// Simple feedback delay for a sense of space, rendered in.
export function echo(o, sr, time = 0.12, fb = 0.3, mix = 0.25) {
  const d = Math.max(1, Math.floor(time * sr));
  const out = new Float32Array(o.length);
  for (let i = 0; i < o.length; i++) {
    const del = i >= d ? out[i - d] : 0;
    out[i] = o[i] + del * fb;
  }
  for (let i = 0; i < o.length; i++) o[i] = o[i] * (1 - mix) + out[i] * mix;
  return o;
}

// Tremolo or amplitude modulation
export function am(o, sr, rate, depth = 1) {
  for (let i = 0; i < o.length; i++) o[i] *= 1 - depth * 0.5 * (1 + Math.sin(TAU * rate * i / sr));
  return o;
}

export function concat(...bufs) {
  const n = bufs.reduce((a, b) => a + b.length, 0);
  const o = new Float32Array(n);
  let off = 0;
  for (const b of bufs) { o.set(b, off); off += b.length; }
  return o;
}

export const silence = (sr, secs) => buf(sr, secs);

// Bird chirp: a short FM sweep. kind picks a shape.
export function chirp(sr, { f0 = 3000, f1 = 4500, secs = 0.08, wob = 0, amp = 1 } = {}, out, offset = 0) {
  const n = Math.ceil(secs * sr);
  const o = out || buf(sr, secs);
  let ph = 0;
  for (let i = 0; i < n && offset + i < o.length; i++) {
    const t = i / n;
    const f = f0 + (f1 - f0) * t + wob * Math.sin(TAU * t * 3) * f0 * 0.1;
    const e = Math.sin(Math.PI * t) ** 1.5;
    o[offset + i] += Math.sin(TAU * ph) * e * amp;
    ph += f / sr;
  }
  return o;
}

export { clamp };
