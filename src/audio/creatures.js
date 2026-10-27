// Per-species sound sets (pure renders). The animals never speak English: they
// bark, meow, whistle, bray, quack, croak and dial up. Kinds:
//   bark (the main call), happy, sad, excited, sniff, yawn, gulp, sig
// Sound packs (cosmetics) replace the bark: squeaky, kazoo, opera, robot.

import { createNoise, normalise, fadeEdges, TAU } from './dsp.js';
import { buf, tone, noise, pinkNoise, applyEnv, lp, hp, bp, sweep, drive, crush, formants, am, chirp, fm } from './synth.js';

export const VOICE_LUFS = -17;
export const KINDS = ['bark', 'happy', 'sad', 'excited', 'sniff', 'yawn', 'gulp', 'sig'];
export const SPECIES_VOICES = ['oli', 'cat', 'capybara', 'penguin', 'rabbit', 'duck', 'tortoise', 'frog', 'redpanda', 'octopus', 'snake', 'elephant', 'routercat'];
export const SOUND_PACKS = ['squeaky', 'kazoo', 'opera', 'robot'];

const mix = (a, b, g = 1, off = 0) => { for (let i = 0; i < b.length && i + off < a.length; i++) a[i + off] += b[i] * g; return a; };
const at = (sr, s) => Math.floor(s * sr);
const arc = (secs) => (t) => Math.sin(Math.PI * Math.min(1, t / secs));

// ---------------------------------------------------------------- generators
function woof(sr, f = 300, secs = 0.2, seed = 1, rough = 0.4) {
  const o = tone(sr, secs, { f: (t) => f * (0.8 + 0.5 * Math.sin(Math.PI * Math.min(1, t / secs * 1.2))), wave: 'saw', amp: (t) => (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / (secs * 0.45))) });
  const n = noise(sr, secs, seed); bp(n, sr, f * 3, 1);
  mix(o, n, rough * 0.6);
  const out = formants(o, sr, [f * 2.2, f * 4.4, 2600], 3, [1, 0.6, 0.25]);
  return drive(out, 1.5);
}
function whine(sr, f0, f1, secs, vib = 6) {
  const o = tone(sr, secs, { f: (t) => (f0 + (f1 - f0) * (t / secs)) * (1 + 0.03 * Math.sin(TAU * vib * t)), wave: 'tri', amp: arc(secs) });
  return bp(o, sr, (f0 + f1), 0.8);
}
function sniff(sr, n = 3, seed = 1, f = 3000) {
  const o = buf(sr, 0.12 * n + 0.1);
  for (let k = 0; k < n; k++) {
    const s = noise(sr, 0.07, seed + k); bp(s, sr, f * (1 + 0.1 * k), 2);
    applyEnv(s, arc(0.07), sr);
    mix(o, s, 1, at(sr, k * 0.11));
  }
  return o;
}
function yawn(sr, f = 220, secs = 1.0) {
  const o = tone(sr, secs, { f: (t) => f * (1.3 - 0.5 * t / secs), wave: 'saw', amp: (t) => Math.sin(Math.PI * t / secs) });
  sweep(o, sr, (i) => 400 + 900 * Math.sin(Math.PI * i / sr / secs), 4, 'bp');
  const br = pinkNoise(sr, secs, 7); bp(br, sr, 1200, 1);
  return mix(o, br, 0.15);
}
function gulp(sr, f = 160) {
  return bp(tone(sr, 0.28, { f: (t) => (t < 0.1 ? f + 600 * t : f + 60 - 300 * (t - 0.1)), amp: arc(0.27) }), sr, f * 2.5, 1.2);
}
function meow(sr, f = 520, secs = 0.55, seed = 1) {
  const o = tone(sr, secs, { f: (t) => f * (0.85 + 0.35 * Math.sin(Math.PI * t / secs)), wave: 'saw', amp: (t) => Math.sin(Math.PI * t / secs) ** 0.7 });
  // formant moves from "ee" to "ah" to "oo": the mi-aa-ow
  sweep(o, sr, (i) => { const t = i / sr / secs; return t < 0.5 ? 2200 - 1300 * t * 2 : 900 - 400 * (t - 0.5) * 2; }, 5, 'bp');
  const n = noise(sr, secs, seed); bp(n, sr, 3000, 2);
  applyEnv(n, (t) => 0.05 * Math.sin(Math.PI * t / secs), sr);
  return mix(o, n);
}
function purr(sr, secs = 1.2, rate = 26) {
  const o = pinkNoise(sr, secs, 11);
  lp(o, sr, 400);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    ph += rate / sr;
    const breath = 0.6 + 0.4 * Math.sin(TAU * t / 0.9);
    o[i] *= (0.5 + 0.5 * Math.sin(TAU * ph)) ** 3 * breath * Math.min(1, t / 0.1) * Math.min(1, (secs - t) / 0.15);
  }
  return mix(o, tone(sr, secs, { f: rate * 2, amp: (t) => 0.2 * Math.min(1, t / 0.1) * Math.min(1, (secs - t) / 0.15) }));
}
function whistle(sr, f, secs, bend = 1.2) {
  return tone(sr, secs, { f: (t) => f * (1 + (bend - 1) * Math.sin(Math.PI * t / secs)), amp: arc(secs) });
}
function squeaks(sr, n, f, spacing = 0.09, secs = 0.06) {
  const o = buf(sr, n * spacing + secs + 0.05);
  for (let k = 0; k < n; k++) chirp(sr, { f0: f * (1 + 0.05 * k), f1: f * 1.4, secs }, o, at(sr, k * spacing));
  return o;
}
function bray(sr, f = 260, parts = 4) {
  // the jackass penguin bray: alternating harsh in-and-out honks
  const o = buf(sr, parts * 0.26 + 0.2);
  for (let k = 0; k < parts; k++) {
    const hi = k % 2 === 1;
    const secs = hi ? 0.18 : 0.24;
    const s = tone(sr, secs, { f: (t) => f * (hi ? 1.6 : 1) * (1 + 0.1 * Math.sin(Math.PI * t / secs)), wave: 'saw', amp: arc(secs) });
    const out = formants(s, sr, hi ? [900, 2300] : [600, 1100], 4, [1, 0.5]);
    mix(o, drive(out, 3), 1, at(sr, k * 0.25));
  }
  return o;
}
function thump(sr, n = 2) {
  const o = buf(sr, n * 0.18 + 0.2);
  for (let k = 0; k < n; k++) mix(o, tone(sr, 0.15, { f: (t) => 60 + 60 * Math.exp(-t / 0.015), amp: (t) => Math.exp(-t / 0.04) }), 1, at(sr, k * 0.16));
  return o;
}
function quack(sr, f = 240, n = 2) {
  const o = buf(sr, n * 0.22 + 0.15);
  for (let k = 0; k < n; k++) {
    const secs = 0.17;
    const s = tone(sr, secs, { f: (t) => f * (1.1 - 0.35 * t / secs), wave: 'saw', amp: (t) => (t < 0.01 ? t / 0.01 : 1) * Math.exp(-t / 0.12) });
    const out = formants(s, sr, [1000, 1700, 2600], 6, [1, 0.8, 0.3]);
    mix(o, drive(out, 2.5), 1, at(sr, k * 0.21));
  }
  return o;
}
function hiss(sr, secs = 0.8, f = 4500, attack = 0.05) {
  const o = noise(sr, secs, 21);
  hp(o, sr, f * 0.6); bp(o, sr, f, 1);
  return applyEnv(o, (t) => Math.min(1, t / attack) * Math.min(1, (secs - t) / 0.12), sr);
}
function croak(sr, f = 28, secs = 0.45, res = 420) {
  // pulse train through a resonant body: rib-bit
  const o = buf(sr, secs * 2 + 0.1);
  for (const [t0, d, r] of [[0, secs * 0.45, res], [secs * 0.6, secs * 0.6, res * 1.25]]) {
    const s = tone(sr, d, { f, wave: 'pulse', pw: 0.12 });
    bp(s, sr, r, 5); bp(s, sr, r * 1.1, 2);
    applyEnv(s, arc(d), sr);
    mix(o, s, 1, at(sr, t0));
  }
  return o;
}
function bloop(sr, n = 1, f = 300) {
  const o = buf(sr, n * 0.16 + 0.25);
  for (let k = 0; k < n; k++) {
    const s = tone(sr, 0.18, { f: (t) => f * (1 + k * 0.15) * (1 + 2.5 * t / 0.18), amp: arc(0.18) });
    mix(o, s, 1, at(sr, k * 0.13));
  }
  return lp(o, sr, 1800);
}
function trumpet(sr, f = 320, secs = 0.9) {
  const o = tone(sr, secs, { f: (t) => f * (1 + 0.6 * Math.sin(Math.PI * Math.min(1, t / secs * 1.3))) * (1 + 0.02 * Math.sin(TAU * 7 * t)), wave: 'saw', amp: (t) => Math.min(1, t / 0.05) * Math.min(1, (secs - t) / 0.2) });
  const out = formants(o, sr, [700, 1400, 2800], 3, [1, 0.8, 0.5]);
  return drive(out, 3);
}
function dialup(sr, secs = 1.3) {
  // the old modem handshake: two DTMF-ish beeps, a carrier chirp and a scrunch
  const o = buf(sr, secs);
  const beep = (t0, f1, f2, d) => { mix(o, tone(sr, d, { f: f1, amp: 0.4 }), 1, at(sr, t0)); mix(o, tone(sr, d, { f: f2, amp: 0.4 }), 1, at(sr, t0)); };
  beep(0, 697, 1209, 0.08); beep(0.11, 770, 1336, 0.08);
  mix(o, tone(sr, 0.3, { f: 2100, amp: 0.35 }), 1, at(sr, 0.25));
  mix(o, fm(sr, 0.4, { fc: (t) => 1200 + 1800 * t / 0.4, ratio: 0.5, index: 3, amp: 0.4 }), 1, at(sr, 0.58));
  const n = noise(sr, 0.3, 31); bp(n, sr, 1800, 0.7); am(n, sr, 60, 0.9);
  mix(o, n, 0.5, at(sr, 0.98));
  return crush(o, 7, 2);
}
function whoosh(sr, secs = 0.4, lo = 400, hi = 3500) {
  const o = noise(sr, secs, 41);
  sweep(o, sr, (i) => lo + (hi - lo) * Math.sin(Math.PI * i / sr / secs), 1.5, 'bp');
  return applyEnv(o, (t) => Math.sin(Math.PI * t / secs) ** 2, sr);
}
function seq(sr, parts) {
  const len = Math.max(...parts.map(([b, t0]) => b.length + at(sr, t0)));
  const o = new Float32Array(len);
  for (const [b, t0, g] of parts) mix(o, b, g ?? 1, at(sr, t0));
  return o;
}

// ---------------------------------------------------------------- the table
// Each species maps every kind to a render function (sr, variant) -> buffer.
const V = {
  oli: { // butter-yellow Labrador: a warm, deep-ish "wuff", food-obsessed whines
    bark: (sr, v) => v % 2 ? seq(sr, [[woof(sr, 290, 0.17, 3), 0], [woof(sr, 310, 0.15, 4), 0.2]]) : woof(sr, 280, 0.2, 1 + v),
    happy: (sr) => whine(sr, 600, 900, 0.5),
    sad: (sr) => whine(sr, 800, 450, 0.7, 5),
    excited: (sr) => seq(sr, [[woof(sr, 360, 0.11, 5), 0], [woof(sr, 380, 0.11, 6), 0.14], [woof(sr, 400, 0.12, 7), 0.28]]),
    sniff: (sr) => sniff(sr, 4, 51, 2800),
    yawn: (sr) => yawn(sr, 230, 1.1),
    gulp: (sr) => gulp(sr, 150),
    sig: (sr) => seq(sr, [[sniff(sr, 5, 61, 3000), 0], [whoosh(sr, 0.45), 0.5, 0.8]]),
  },
  cat: {
    bark: (sr, v) => meow(sr, 520 + v * 30, 0.5, 1 + v),
    happy: (sr) => purr(sr, 1.2, 26),
    sad: (sr) => meow(sr, 420, 0.8, 9),
    excited: (sr) => seq(sr, [[meow(sr, 700, 0.15, 3), 0], [meow(sr, 760, 0.18, 4), 0.18]]),
    sniff: (sr) => sniff(sr, 2, 71, 4000),
    yawn: (sr) => yawn(sr, 400, 0.8),
    gulp: (sr) => gulp(sr, 220),
    sig: (sr) => seq(sr, [[meow(sr, 800, 0.12, 5), 0], [whoosh(sr, 0.3, 800, 5000), 0.1]]),
  },
  capybara: { // whistles and soft squeaks, zen
    bark: (sr, v) => seq(sr, [[whistle(sr, 1300 + v * 60, 0.14), 0], [squeaks(sr, 2, 1700), 0.17, 0.6]]),
    happy: (sr) => seq(sr, [[whistle(sr, 1100, 0.2, 1.15), 0], [whistle(sr, 1250, 0.25, 1.1), 0.25]]),
    sad: (sr) => whistle(sr, 1100, 0.5, 0.8),
    excited: (sr) => squeaks(sr, 5, 1800, 0.07),
    sniff: (sr) => sniff(sr, 2, 81, 2200),
    yawn: (sr) => yawn(sr, 160, 1.2),
    gulp: (sr) => gulp(sr, 130),
    sig: (sr) => seq(sr, [[fm(sr, 1.6, { fc: 523, ratio: 3.5, index: (t) => 1.5 * Math.exp(-t / 0.4), amp: (t) => Math.exp(-t / 0.6) }), 0], [whistle(sr, 1200, 0.3), 0.3, 0.6]]),
  },
  penguin: {
    bark: (sr, v) => bray(sr, 250 + v * 15, 4),
    happy: (sr) => bray(sr, 290, 2),
    sad: (sr) => whine(sr, 500, 300, 0.6),
    excited: (sr) => bray(sr, 300, 6),
    sniff: (sr) => sniff(sr, 2, 91, 2000),
    yawn: (sr) => yawn(sr, 300, 0.8),
    gulp: (sr) => gulp(sr, 180),
    sig: (sr) => seq(sr, [[whoosh(sr, 0.9, 300, 2000), 0], [bray(sr, 300, 2), 0.2, 0.7]]),
  },
  rabbit: {
    bark: (sr, v) => v % 2 ? thump(sr, 2) : seq(sr, [[thump(sr, 1), 0], [squeaks(sr, 1, 2600, 0.1, 0.05), 0.18, 0.7]]),
    happy: (sr) => squeaks(sr, 3, 2400, 0.1, 0.04),
    sad: (sr) => whine(sr, 1500, 1000, 0.4),
    excited: (sr) => seq(sr, [[thump(sr, 3), 0], [squeaks(sr, 2, 2800), 0.4, 0.6]]),
    sniff: (sr) => sniff(sr, 6, 101, 4500),
    yawn: (sr) => yawn(sr, 500, 0.6),
    gulp: (sr) => gulp(sr, 260),
    sig: (sr) => tone(sr, 0.5, { f: (t) => 200 * Math.pow(4, t / 0.5), wave: 'tri', amp: arc(0.5) }),
  },
  duck: {
    bark: (sr, v) => quack(sr, 230 + v * 15, 2),
    happy: (sr) => quack(sr, 270, 3),
    sad: (sr) => quack(sr, 190, 1),
    excited: (sr) => quack(sr, 290, 5),
    sniff: (sr) => sniff(sr, 2, 111, 3500),
    yawn: (sr) => yawn(sr, 350, 0.6),
    gulp: (sr) => gulp(sr, 200),
    sig: (sr) => { // flap flap and a quack
      const o = buf(sr, 0.8);
      for (let k = 0; k < 4; k++) { const f = noise(sr, 0.06, 112 + k); bp(f, sr, 700, 1.2); applyEnv(f, arc(0.06), sr); mix(o, f, 1, at(sr, k * 0.09)); }
      return mix(o, quack(sr, 260, 1), 0.8, at(sr, 0.4));
    },
  },
  tortoise: { // stately: small huffs and hisses
    bark: (sr, v) => hiss(sr, 0.35 + v * 0.05, 3500, 0.02),
    happy: (sr) => seq(sr, [[hiss(sr, 0.2, 3000, 0.02), 0], [hiss(sr, 0.2, 3000, 0.02), 0.3]]),
    sad: (sr) => hiss(sr, 0.7, 2500, 0.2),
    excited: (sr) => seq(sr, [[hiss(sr, 0.12, 3800, 0.01), 0], [hiss(sr, 0.12, 3800, 0.01), 0.16], [hiss(sr, 0.12, 3800, 0.01), 0.32]]),
    sniff: (sr) => sniff(sr, 2, 121, 1800),
    yawn: (sr) => yawn(sr, 140, 1.6),
    gulp: (sr) => gulp(sr, 110),
    sig: (sr) => seq(sr, [[tone(sr, 0.3, { f: (t) => 90 + 80 * Math.exp(-t / 0.02), amp: (t) => Math.exp(-t / 0.08) }), 0], [hiss(sr, 0.3, 2500, 0.02), 0.05, 0.4]]),
  },
  frog: {
    bark: (sr, v) => croak(sr, 26 + v * 2, 0.4, 420),
    happy: (sr) => croak(sr, 34, 0.3, 520),
    sad: (sr) => croak(sr, 20, 0.6, 330),
    excited: (sr) => seq(sr, [[croak(sr, 32, 0.25, 500), 0], [croak(sr, 36, 0.25, 560), 0.5]]),
    sniff: (sr) => sniff(sr, 1, 131, 2500),
    yawn: (sr) => yawn(sr, 200, 0.7),
    gulp: (sr) => gulp(sr, 140),
    sig: (sr) => { // the tongue thwip
      const o = tone(sr, 0.18, { f: (t) => 2500 * Math.exp(-t / 0.03) + 300, amp: arc(0.18) });
      return mix(o, noise(sr, 0.05, 132), 0.3);
    },
  },
  redpanda: { // huff-quacks and twittering squeaks
    bark: (sr, v) => squeaks(sr, 3 + v % 2, 1500, 0.08, 0.06),
    happy: (sr) => squeaks(sr, 5, 1800, 0.06, 0.05),
    sad: (sr) => whine(sr, 1200, 700, 0.5),
    excited: (sr) => squeaks(sr, 8, 2000, 0.05, 0.04),
    sniff: (sr) => sniff(sr, 3, 141, 3200),
    yawn: (sr) => yawn(sr, 380, 0.8),
    gulp: (sr) => gulp(sr, 210),
    sig: (sr) => seq(sr, [[squeaks(sr, 2, 1400, 0.1, 0.08), 0], [whoosh(sr, 0.3, 300, 1500), 0.15, 0.6]]),
  },
  octopus: {
    bark: (sr, v) => bloop(sr, 2 + v % 2, 280),
    happy: (sr) => bloop(sr, 3, 350),
    sad: (sr) => bloop(sr, 1, 200),
    excited: (sr) => bloop(sr, 6, 330),
    sniff: (sr) => bloop(sr, 1, 500),
    yawn: (sr) => lp(yawn(sr, 180, 1.0), sr, 1200),
    gulp: (sr) => gulp(sr, 120),
    sig: (sr) => bloop(sr, 8, 300),
  },
  snake: {
    bark: (sr, v) => hiss(sr, 0.7 + v * 0.1, 5000, 0.08),
    happy: (sr) => hiss(sr, 0.4, 6000, 0.03),
    sad: (sr) => hiss(sr, 0.9, 3500, 0.3),
    excited: (sr) => seq(sr, [[hiss(sr, 0.2, 6000, 0.01), 0], [hiss(sr, 0.4, 6000, 0.01), 0.25]]),
    sniff: (sr) => { const o = buf(sr, 0.4); for (let k = 0; k < 3; k++) mix(o, hiss(sr, 0.05, 7000, 0.005), 1, at(sr, k * 0.1)); return o; },
    yawn: (sr) => hiss(sr, 1.2, 2500, 0.4),
    gulp: (sr) => gulp(sr, 170),
    sig: (sr) => hiss(sr, 1.4, 5500, 0.3),
  },
  elephant: {
    bark: (sr, v) => trumpet(sr, 300 + v * 20, 0.9),
    happy: (sr) => trumpet(sr, 380, 0.6),
    sad: (sr) => lp(trumpet(sr, 220, 1.1), sr, 1500),
    excited: (sr) => seq(sr, [[trumpet(sr, 360, 0.4), 0], [trumpet(sr, 420, 0.6), 0.45]]),
    sniff: (sr) => sniff(sr, 3, 151, 900),
    yawn: (sr) => yawn(sr, 110, 1.6),
    gulp: (sr) => gulp(sr, 80),
    sig: (sr) => { // trunk hoover: rising suction then a toot
      const o = noise(sr, 1.0, 152);
      sweep(o, sr, (i) => 300 + 2000 * i / sr, 2, 'bp');
      applyEnv(o, (t) => Math.min(1, t / 0.2) * Math.min(1, (1 - t) / 0.1), sr);
      return mix(o, trumpet(sr, 400, 0.4), 0.7, at(sr, 0.6));
    },
  },
  routercat: {
    bark: (sr, v) => v % 2 ? seq(sr, [[meow(sr, 560, 0.35, 5), 0], [dialup(sr, 0.9), 0.32, 0.6]]) : seq(sr, [[meow(sr, 540, 0.4, 3), 0], [crush(meow(sr, 540, 0.4, 3), 5, 3), 0.02, 0.5]]),
    happy: (sr) => seq(sr, [[purr(sr, 1.0, 30), 0], [crush(tone(sr, 0.1, { f: 1800, wave: 'square', amp: 0.3 }), 5, 2), 0.8]]),
    sad: (sr) => crush(meow(sr, 400, 0.7, 7), 5, 3),
    excited: (sr) => dialup(sr, 1.2),
    sniff: (sr) => crush(sniff(sr, 3, 161, 3500), 6, 2),
    yawn: (sr) => crush(yawn(sr, 380, 0.8), 6, 2),
    gulp: (sr) => gulp(sr, 220),
    sig: (sr) => seq(sr, [[purr(sr, 1.3, 32), 0], [dialup(sr, 1.3), 0.3, 0.5]]),
  },
};

const PACKS = {
  squeaky: (sr, v) => { // a dog-toy squeak: "ee-oo"
    const o = buf(sr, 0.35);
    mix(o, tone(sr, 0.12, { f: (t) => 1900 + 400 * Math.sin(Math.PI * t / 0.12) + v * 80, wave: 'tri', amp: arc(0.12) }));
    mix(o, tone(sr, 0.16, { f: (t) => 1500 - 300 * t / 0.16, wave: 'tri', amp: arc(0.16) }), 1, at(sr, 0.14));
    return bp(o, sr, 1800, 1.5);
  },
  kazoo: (sr, v) => {
    const secs = 0.4;
    const o = tone(sr, secs, { f: (t) => (330 + v * 20) * (1 + 0.25 * Math.sin(Math.PI * t / secs)) * (1 + 0.015 * Math.sin(TAU * 7 * t)), wave: 'saw', amp: arc(secs) });
    const out = formants(o, sr, [600, 1300, 2800], 4, [1, 0.8, 0.6]);
    return drive(mix(out, noise(sr, secs, 171), 0.08), 3);
  },
  opera: (sr, v) => { // a tiny soprano "la!"
    const secs = 0.7;
    const f = 880 + v * 30;
    const o = tone(sr, secs, { f: (t) => f * (1 + 0.025 * Math.sin(TAU * 6.2 * t) * Math.min(1, t / 0.2)), amp: (t) => Math.min(1, t / 0.04) * Math.min(1, (secs - t) / 0.15) });
    tone(sr, secs, { f: (t) => 2 * f * (1 + 0.025 * Math.sin(TAU * 6.2 * t)), amp: (t) => 0.2 * Math.min(1, t / 0.04) * Math.min(1, (secs - t) / 0.15), out: o });
    return o;
  },
  robot: (sr, v) => {
    const o = buf(sr, 0.4);
    mix(o, tone(sr, 0.12, { f: 440 + v * 40, wave: 'square', amp: 0.6 }));
    mix(o, tone(sr, 0.16, { f: 330 + v * 30, wave: 'square', amp: 0.6 }), 1, at(sr, 0.15));
    return crush(lp(o, sr, 3000), 4, 4);
  },
};

// Map a cosmetic id (whatever Animals names it) onto one of our packs.
export function packFor(id) {
  if (!id) return null;
  const s = String(id).toLowerCase();
  if (s.includes('squeak')) return 'squeaky';
  if (s.includes('kazoo')) return 'kazoo';
  if (s.includes('opera') || s.includes('soprano')) return 'opera';
  if (s.includes('robot') || s.includes('bit')) return 'robot';
  return SOUND_PACKS.includes(s) ? s : null;
}

export function hasVoice(voiceId) { return !!V[voiceId]; }

export function renderCreature(voiceId, kind, sr, variant = 0, pack = null) {
  const p = packFor(pack);
  let o;
  if (p && kind === 'bark') o = PACKS[p](sr, variant);
  else {
    const set = V[voiceId] || V.oli;
    const fn = set[kind] || set.bark;
    o = fn(sr, variant);
  }
  fadeEdges(o, sr, 0.002, 0.02);
  normalise(o, sr, VOICE_LUFS, { active: true, ceilingDb: -1 });
  return o;
}

export function variantsFor(kind) { return kind === 'bark' ? 2 : 1; }
