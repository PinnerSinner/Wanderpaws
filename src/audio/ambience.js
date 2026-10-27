// Ambience beds, weather loops and one-shot world details (pure renders).
// Loops are rendered once per world and crossfaded into themselves so they
// repeat seamlessly. The engine places them in space (see index.js).

import { createNoise, normalise, makeLoop, TAU, midiToFreq } from './dsp.js';
import { buf, tone, noise, pinkNoise, brownNoise, applyEnv, lp, hp, bp, sweep, am, chirp, fm, drive, crush } from './synth.js';

export const AMB_LUFS = -20;

const mix = (a, b, g = 1, off = 0) => { for (let i = 0; i < b.length && i + off < a.length; i++) a[i + off] += b[i] * g; return a; };
const at = (sr, s) => Math.floor(s * sr);

function slowEnv(o, sr, seed, rate = 0.2, depth = 0.5) {
  const rnd = createNoise(seed);
  const p1 = Math.abs(rnd()), p2 = Math.abs(rnd());
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    o[i] *= 1 - depth * 0.5 * (1 + 0.6 * Math.sin(TAU * (rate * t + p1)) + 0.4 * Math.sin(TAU * (rate * 2.3 * t + p2))) / 1;
  }
  return o;
}

// Loops: id -> render(sr) returning a seamless loop
export const LOOPS = {
  sea(sr) { // the steady wash under the waves
    const o = pinkNoise(sr, 9.5, 1);
    lp(o, sr, 900); hp(o, sr, 80);
    return slowEnv(o, sr, 2, 0.12, 0.4);
  },
  birds(sr) { // park birdsong: robins and sparrows scattered across 12 s
    const o = buf(sr, 12.5), rnd = createNoise(3);
    for (let k = 0; k < 34; k++) {
      const t0 = Math.abs(rnd()) * 11.8;
      const base = 2500 + 2500 * Math.abs(rnd());
      const n = 2 + Math.floor(Math.abs(rnd()) * 5);
      const g = 0.25 + 0.5 * Math.abs(rnd());
      for (let j = 0; j < n; j++) chirp(sr, { f0: base * (1 + 0.15 * rnd()), f1: base * (1.1 + 0.3 * rnd()), secs: 0.04 + 0.05 * Math.abs(rnd()), wob: 1, amp: g }, o, at(sr, t0 + j * 0.09));
    }
    return o;
  },
  jungleBirds(sr) {
    const o = buf(sr, 11.5), rnd = createNoise(4);
    for (let k = 0; k < 22; k++) {
      const t0 = Math.abs(rnd()) * 10.8;
      if (rnd() > 0.3) {
        const base = 1500 + 3500 * Math.abs(rnd());
        for (let j = 0; j < 4; j++) chirp(sr, { f0: base, f1: base * (j % 2 ? 0.7 : 1.4), secs: 0.07, wob: 2, amp: 0.5 }, o, at(sr, t0 + j * 0.11));
      } else { // a woody toucan croak
        const s = tone(sr, 0.2, { f: (t) => 600 - 800 * t, wave: 'saw', amp: (t) => Math.sin(Math.PI * t / 0.2) * 0.35 });
        bp(s, sr, 1300, 3); mix(o, s, 1, at(sr, t0));
      }
    }
    return o;
  },
  traffic(sr) { // distant city: a low rumble with tyre swells
    const o = brownNoise(sr, 10.5, 5);
    lp(o, sr, 350);
    const t = pinkNoise(sr, 10.5, 6); bp(t, sr, 900, 0.6);
    slowEnv(t, sr, 7, 0.15, 0.8);
    return mix(o, t, 0.35);
  },
  insects(sr) { // cicadas swelling plus cricket triplets
    const o = noise(sr, 8.5, 8);
    bp(o, sr, 5200, 2.5);
    am(o, sr, 42, 0.8);
    slowEnv(o, sr, 9, 0.18, 0.7);
    const rnd = createNoise(10);
    for (let k = 0; k < 40; k++) {
      const t0 = Math.abs(rnd()) * 8;
      for (let j = 0; j < 3; j++) mix(o, tone(sr, 0.025, { f: 4300, amp: (t) => Math.sin(Math.PI * t / 0.025) * 0.25 }), 1, at(sr, t0 + j * 0.05));
    }
    return o;
  },
  waterfall(sr) {
    const o = pinkNoise(sr, 6.5, 11);
    bp(o, sr, 1100, 0.35);
    const r = brownNoise(sr, 6.5, 12); lp(r, sr, 200);
    return mix(o, r, 0.6);
  },
  wind(sr) { // highland wind: a moving bandpass with gusts
    const o = noise(sr, 10.5, 13);
    const rnd = createNoise(14), ph = Math.abs(rnd());
    sweep(o, sr, (i) => { const t = i / sr; return 450 + 300 * Math.sin(TAU * (t / 7 + ph)) + 150 * Math.sin(TAU * t / 2.3); }, 2.5, 'bp');
    return slowEnv(o, sr, 15, 0.11, 0.75);
  },
  hum(sr) { // server room: mains-ish harmonics, fans and the odd data chirp
    const L = 6.5;
    const o = pinkNoise(sr, L, 16);
    lp(o, sr, 1800);
    for (const [f, g] of [[50, 0.5], [100, 0.35], [150, 0.15], [250, 0.08]]) tone(sr, L, { f, amp: g, out: o });
    const rnd = createNoise(17);
    for (let k = 0; k < 10; k++) {
      const t0 = Math.abs(rnd()) * 5.8;
      for (let j = 0; j < 3; j++) mix(o, crush(tone(sr, 0.03, { f: 1500 + 900 * Math.abs(rnd()), wave: 'square', amp: 0.08 }), 5, 2), 1, at(sr, t0 + j * 0.05));
    }
    return o;
  },
  rain(sr) {
    const o = noise(sr, 8.5, 18);
    hp(o, sr, 900); lp(o, sr, 7000);
    slowEnv(o, sr, 19, 0.1, 0.3);
    const rnd = createNoise(20);
    for (let k = 0; k < 260; k++) {
      const t0 = Math.abs(rnd()) * 8.4;
      const d = noise(sr, 0.006, 21 + k); bp(d, sr, 2000 + 4000 * Math.abs(rnd()), 3);
      mix(o, d, 0.6 + 0.6 * Math.abs(rnd()), at(sr, t0));
    }
    return o;
  },
  gusts(sr) { // stormier wind for weather
    const o = LOOPS.wind(sr);
    return slowEnv(drive(o, 1.2), sr, 22, 0.3, 0.6);
  },
  drums(sr) { // a samba parade batucada, two bars at 100 bpm
    const beat = 0.6, L = beat * 8;
    const o = buf(sr, L + 0.6);
    const surdo = (f) => tone(sr, 0.5, { f: (t) => f * (1 + 0.15 * Math.exp(-t / 0.02)), amp: (t) => Math.exp(-t / 0.18) });
    const caixa = (g, seed) => { const s = noise(sr, 0.08, seed); bp(s, sr, 3000, 0.8); return applyEnv(s, (t) => Math.exp(-t / 0.02) * g, sr); };
    const tam = () => tone(sr, 0.06, { f: 1800, amp: (t) => Math.exp(-t / 0.015) * 0.5 });
    const ago = (f) => fm(sr, 0.3, { fc: f, ratio: 1.4, index: (t) => 2 * Math.exp(-t / 0.05), amp: (t) => Math.exp(-t / 0.1) * 0.35 });
    for (let b = 0; b < 8; b++) {
      const t = b * beat;
      mix(o, surdo(b % 2 ? 62 : 75), b % 2 ? 1 : 0.6, at(sr, t));
      for (let s = 0; s < 4; s++) mix(o, caixa(s === 0 ? 0.6 : 0.3, b * 4 + s + 30), 1, at(sr, t + s * beat / 4));
    }
    for (const st of [0, 3, 6, 10, 12, 16, 19, 22, 26, 28]) mix(o, tam(), 1, at(sr, st * beat / 4));
    [[0, 1100], [1.5, 1100], [2, 820], [4, 1100], [5, 820], [6, 820]].forEach(([b, f]) => mix(o, ago(f), 1, at(sr, b * beat)));
    return o; // already a whole number of bars; looped with a tiny crossfade
  },
  datahum(sr) { // data storm: a buzzing chord with crackles
    const L = 6.5;
    const o = buf(sr, L);
    for (const m of [40, 47, 52, 55]) tone(sr, L, { f: midiToFreq(m), wave: 'square', amp: 0.15, out: o });
    lp(o, sr, 900);
    am(o, sr, 3, 0.4);
    const rnd = createNoise(23);
    for (let k = 0; k < 60; k++) { const c = noise(sr, 0.01, 24 + k); hp(c, sr, 3000); mix(o, c, 0.6 * Math.abs(rnd()), at(sr, Math.abs(rnd()) * (L - 0.1))); }
    return o;
  },
  shimmer(sr) { // aurora: slow pastel chord
    const L = 8.5;
    const o = buf(sr, L);
    [62, 66, 69, 73, 78].forEach((m, k) => tone(sr, L, { f: midiToFreq(m), amp: (t) => 0.2 * (0.5 + 0.5 * Math.sin(TAU * (t / 4.25) + k)), out: o }));
    return o;
  },
};

export const LOOP_IDS = Object.keys(LOOPS);

export function renderLoop(id, sr) {
  const o = LOOPS[id](sr);
  const loop = makeLoop(o, sr, id === 'drums' ? 0.6 : 0.5);
  normalise(loop, sr, AMB_LUFS, { active: false, ceilingDb: -3 });
  return loop;
}

// One-shots scheduled by the ambience engine
export const AMB_SHOTS = {
  wave(sr) { // a wave rolling in, breaking and washing back
    const L = 5;
    const o = pinkNoise(sr, L, 31);
    sweep(o, sr, (i) => { const t = i / sr; return t < 1.6 ? 250 + 600 * t : 1200 * Math.exp(-(t - 1.6) / 1.2) + 300; }, 0.7);
    return applyEnv(o, (t) => (t < 1.6 ? (t / 1.6) ** 2 : Math.exp(-(t - 1.6) / 1.1)), sr);
  },
  gull(sr) {
    const o = buf(sr, 1);
    for (const t0 of [0, 0.28, 0.5]) {
      const s = tone(sr, 0.22, { f: (t) => 1500 - 1500 * t, wave: 'saw', amp: (t) => Math.sin(Math.PI * t / 0.22) });
      bp(s, sr, 1700, 4); mix(o, s, 1, at(sr, t0));
    }
    return o;
  },
  horn(sr) { // a polite distant car horn (it's London)
    const o = buf(sr, 0.5);
    for (const f of [400, 500]) tone(sr, 0.35, { f, wave: 'square', amp: (t) => Math.min(1, t / 0.02) * Math.min(1, (0.35 - t) / 0.05) * 0.3, out: o });
    return lp(o, sr, 1200);
  },
  crow(sr) {
    const s = tone(sr, 0.3, { f: (t) => 700 - 300 * t, wave: 'saw', amp: (t) => Math.sin(Math.PI * t / 0.3) });
    return bp(s, sr, 1100, 2);
  },
  bleep(sr) {
    const o = buf(sr, 0.3);
    [0, 0.08, 0.16].forEach((t0, k) => mix(o, tone(sr, 0.05, { f: [1320, 1760, 2093][k], wave: 'square', amp: 0.5 }), 1, at(sr, t0)));
    return crush(lp(o, sr, 4000), 6, 2);
  },
  foghorn(sr) {
    const o = tone(sr, 2.2, { f: 82, wave: 'saw', amp: (t) => Math.min(1, t / 0.3) * Math.min(1, (2.2 - t) / 0.5) });
    return lp(o, sr, 400);
  },
  thunder(sr) {
    const o = brownNoise(sr, 3, 41);
    lp(o, sr, 300);
    return applyEnv(o, (t) => Math.min(1, t / 0.1) * Math.exp(-t / 0.9), sr);
  },
};

export function renderShot(id, sr) {
  const o = AMB_SHOTS[id](sr);
  normalise(o, sr, AMB_LUFS, { active: true, ceilingDb: -3 });
  return o;
}

// World soundscapes. A layer is a loop placed somewhere:
//   at: 'everywhere' | 'sea' (nearest water) | 'scenery:<mesh>' | 'ring' (around the listener)
export const SOUNDSCAPES = {
  beach: { layers: [{ loop: 'sea', at: 'sea', gain: 0 }], shots: [{ id: 'wave', at: 'sea', every: [5, 9], gain: 0, tide: true }, { id: 'gull', at: 'ring', every: [9, 20], gain: -9 }] },
  park: { layers: [{ loop: 'birds', at: 'everywhere', gain: -3 }, { loop: 'traffic', at: 'everywhere', gain: -7 }], shots: [{ id: 'horn', at: 'ring', every: [18, 40], gain: -14 }, { id: 'crow', at: 'ring', every: [14, 30], gain: -12 }] },
  jungle: { layers: [{ loop: 'insects', at: 'everywhere', gain: -5 }, { loop: 'jungleBirds', at: 'everywhere', gain: -4 }, { loop: 'waterfall', at: 'scenery:waterfall', gain: 2 }], shots: [] },
  highland: { layers: [{ loop: 'wind', at: 'everywhere', gain: -2 }], shots: [{ id: 'crow', at: 'ring', every: [16, 35], gain: -12 }] },
  server: { layers: [{ loop: 'hum', at: 'everywhere', gain: -4 }], shots: [{ id: 'bleep', at: 'ring', every: [6, 14], gain: -12 }] },
  title: { layers: [{ loop: 'sea', at: 'everywhere', gain: -10 }], shots: [{ id: 'gull', at: 'ring', every: [14, 30], gain: -16 }] },
};
// Ambience ids by world, for worlds that don't name one.
export const WORLD_AMBIENCE = { w1: 'beach', w2: 'park', w3: 'jungle', w4: 'highland', w5: 'server' };
export const AMBIENCE_ALIASES = { sea: 'beach', city: 'park', london: 'park', rainforest: 'jungle', snow: 'highland', highlands: 'highland', marcoverse: 'server', data: 'server', cloud: 'server' };

export const WEATHER_LOOPS = { rain: 'rain', fog: null, parade: 'drums', aurora: 'shimmer', datastorm: 'datahum', snow: 'gusts', clear: null };
export const WEATHER_SHOTS = { fog: { id: 'foghorn', every: [20, 40], gain: -14 }, rain: { id: 'thunder', every: [35, 70], gain: -12 } };
