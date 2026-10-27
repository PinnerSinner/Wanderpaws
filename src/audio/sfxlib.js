// The SFX library: every one-shot sound, synthesised (pure). Each entry renders
// a mono buffer; the engine normalises it to SFX_LUFS (active loudness) and
// applies the entry's mix trim. `variants` renders several takes so repeats
// (footsteps, pops) never sound like a machine gun.

import { createNoise, normalise, fadeEdges, TAU, midiToFreq } from './dsp.js';
import {
  buf, tone, noise, pinkNoise, fm, applyEnv, pluckEnv, adsr, lp, hp, bp, sweep, drive, crush, chirp, am,
} from './synth.js';

export const SFX_LUFS = -18;

const mix = (a, b, gb = 1, off = 0) => { for (let i = 0; i < b.length && i + off < a.length; i++) a[i + off] += b[i] * gb; return a; };
const at = (sr, s) => Math.floor(s * sr);

// A pitched bell note (for chimes and stings)
function bellNote(sr, f, secs = 1.2, idx = 2, tau = 0.5) {
  return fm(sr, secs, { fc: f, ratio: 3.5, index: (t) => idx * Math.exp(-t / 0.3), amp: pluckEnv(0.002, tau) });
}
function sparkle(sr, secs, seed, density = 40, lo = 3000, hi = 7000) {
  const o = buf(sr, secs), rnd = createNoise(seed);
  const n = Math.floor(density * secs);
  for (let k = 0; k < n; k++) {
    const t0 = Math.abs(rnd()) * (secs - 0.1);
    const f = lo + (hi - lo) * Math.abs(rnd());
    const s = tone(sr, 0.09, { f, amp: (t) => Math.exp(-t / 0.02) * (1 - t0 / secs) });
    mix(o, s, 0.5, at(sr, t0));
  }
  return o;
}
function brassChord(sr, notes, secs, start = 0, out) {
  const o = out || buf(sr, secs + start);
  for (const m of notes) {
    const f = midiToFreq(m);
    const env = adsr(0.03, 0.12, 0.7, 0.2, secs - 0.2);
    const s = buf(sr, secs);
    for (const d of [-0.004, 0.004]) tone(sr, secs, { f: f * (1 + d), wave: 'saw', amp: env, out: s });
    sweep(s, sr, (i) => f * (1.5 + 4 * Math.min(1, i / sr / 0.05)), 0.8);
    mix(o, s, 1 / notes.length, at(sr, start));
  }
  return o;
}
function splashCore(sr, secs, seed, size = 1) {
  const o = noise(sr, secs, seed);
  sweep(o, sr, (i) => 4000 * Math.exp(-i / sr / (0.15 * size)) + 500, 0.8);
  applyEnv(o, (t) => (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / (0.12 * size))), sr);
  const rnd = createNoise(seed + 9);
  for (let k = 0; k < 8 * size; k++) {
    const t0 = 0.05 + Math.abs(rnd()) * secs * 0.7;
    const f = 900 + 1800 * Math.abs(rnd());
    mix(o, tone(sr, 0.06, { f: (t) => f * (1 + t * 12), amp: (t) => 0.35 * Math.exp(-t / 0.015) }), 1, at(sr, t0));
  }
  return o;
}
function step(sr, seed, { lpF = 2000, hpF = 100, tau = 0.03, len = 0.12, thump = 0, thumpF = 90, grains = 0, grainF = 3000, ring = 0, ringF = 0 }) {
  const o = noise(sr, len, seed);
  hp(o, sr, hpF); lp(o, sr, lpF);
  applyEnv(o, (t) => (t < 0.004 ? t / 0.004 : Math.exp(-(t - 0.004) / tau)), sr);
  if (thump) mix(o, tone(sr, len, { f: (t) => thumpF * (1 + Math.exp(-t / 0.01)), amp: (t) => thump * Math.exp(-t / 0.025) }));
  if (grains) {
    const rnd = createNoise(seed * 3 + 1);
    for (let k = 0; k < grains; k++) {
      const t0 = Math.abs(rnd()) * len * 0.6;
      const g = noise(sr, 0.006, seed + k * 17);
      bp(g, sr, grainF * (0.7 + 0.6 * Math.abs(rnd())), 3);
      mix(o, g, 0.8, at(sr, t0));
    }
  }
  if (ring) mix(o, tone(sr, len, { f: ringF, amp: (t) => ring * Math.exp(-t / 0.05) }));
  return o;
}

// id -> { render(sr, variantIndex) -> Float32Array, trim (dB), variants }
export const SFX = {
  // ---------- gobbling ----------
  pop: { trim: -4, variants: 3, render(sr, v) {
    // a bright bubble pop at C5; the engine repitches it up the pentatonic
    const f = midiToFreq(72);
    const o = tone(sr, 0.16, { f: (t) => f * (1 + 0.9 * Math.exp(-t / 0.012)), amp: (t) => (t < 0.002 ? t / 0.002 : Math.exp(-t / 0.04)) });
    tone(sr, 0.16, { f: (t) => f * 2 * (1 + 0.5 * Math.exp(-t / 0.01)), amp: (t) => 0.25 * Math.exp(-t / 0.02), out: o });
    const c = noise(sr, 0.006, 31 + v); hp(c, sr, 2000);
    mix(o, c, 0.4);
    return o;
  } },
  popBig: { trim: -3, variants: 2, render(sr, v) {
    const f = midiToFreq(60);
    const o = tone(sr, 0.3, { f: (t) => f * (1 + 1.2 * Math.exp(-t / 0.02)), amp: (t) => (t < 0.003 ? t / 0.003 : Math.exp(-t / 0.07)) });
    mix(o, tone(sr, 0.3, { f: (t) => 70 + 60 * Math.exp(-t / 0.03), amp: (t) => 0.7 * Math.exp(-t / 0.08) }));
    const c = noise(sr, 0.01, 41 + v); bp(c, sr, 1200, 1);
    mix(o, c, 0.5);
    return o;
  } },
  squish: { trim: -9, variants: 3, render(sr, v) {
    const o = noise(sr, 0.22, 51 + v);
    sweep(o, sr, (i) => 2200 * Math.exp(-i / sr / 0.06) + 250, 3, 'bp');
    applyEnv(o, (t) => (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / 0.06)), sr);
    mix(o, tone(sr, 0.22, { f: (t) => 160 + 40 * Math.sin(TAU * 22 * t), amp: (t) => 0.4 * Math.exp(-t / 0.05) }));
    return o;
  } },
  gulp: { trim: -8, variants: 2, render(sr, v) {
    const o = tone(sr, 0.3, { f: (t) => (t < 0.12 ? 140 + 500 * t : 200 - 300 * (t - 0.12)) * (1 + v * 0.06), amp: (t) => Math.sin(Math.PI * Math.min(1, t / 0.28)) });
    return bp(o, sr, 400, 1.2);
  } },
  whum: { trim: -10, render(sr) {
    // the ring pulse: a soft low swell with a breathy whoosh
    const o = tone(sr, 0.7, { f: (t) => 95 + 60 * t, amp: (t) => Math.sin(Math.PI * Math.min(1, t / 0.7)) ** 2 });
    const n = pinkNoise(sr, 0.7, 61);
    sweep(n, sr, (i) => 300 + 2500 * (i / sr / 0.7), 1.5, 'bp');
    applyEnv(n, (t) => Math.sin(Math.PI * t / 0.7) * 0.6, sr);
    return mix(o, n);
  } },
  milestone: { trim: -5, render(sr) {
    // fanfare: arpeggio then a held major chord with a cymbal swell
    const o = buf(sr, 1.8);
    [60, 64, 67].forEach((m, k) => brassChord(sr, [m, m + 12], 0.22, k * 0.13, o));
    brassChord(sr, [60, 64, 67, 72, 76], 1.3, 0.42, o);
    const cym = noise(sr, 1.4, 71); hp(cym, sr, 5000);
    applyEnv(cym, (t) => Math.min(1, t / 0.3) * Math.exp(-t / 0.5) * 0.3, sr);
    return mix(o, cym, 1, at(sr, 0.35));
  } },
  star: { trim: -7, render(sr) {
    const o = buf(sr, 1.4);
    [76, 81, 88].forEach((m, k) => mix(o, bellNote(sr, midiToFreq(m), 1.1, 1.6, 0.45), 0.6, at(sr, k * 0.09)));
    return mix(o, sparkle(sr, 1.2, 81, 30, 5000, 9000), 0.5);
  } },
  // ---------- knocks ----------
  bump: { trim: -7, variants: 2, render(sr, v) {
    const o = tone(sr, 0.25, { f: (t) => 70 + 120 * Math.exp(-t / 0.02), amp: (t) => Math.exp(-t / 0.06) });
    const w = tone(sr, 0.12, { f: 620 + v * 40, amp: (t) => 0.5 * Math.exp(-t / 0.02) });
    tone(sr, 0.12, { f: 1010 + v * 60, amp: (t) => 0.3 * Math.exp(-t / 0.015), out: w });
    return mix(o, w);
  } },
  whoopsie: { trim: -10, render(sr) {
    // slide whistle down with a wobble
    return tone(sr, 0.55, { f: (t) => 1400 * Math.pow(0.35, t / 0.5) * (1 + 0.02 * Math.sin(TAU * 9 * t)), amp: (t) => Math.min(1, t / 0.02) * (t > 0.45 ? Math.max(0, 1 - (t - 0.45) / 0.1) : 1) });
  } },
  nearMiss: { trim: -14, render(sr) {
    const o = noise(sr, 0.35, 91);
    sweep(o, sr, (i) => 400 + 3000 * Math.sin(Math.PI * i / sr / 0.35), 2, 'bp');
    return applyEnv(o, (t) => Math.sin(Math.PI * t / 0.35) ** 2, sr);
  } },
  splash: { trim: -7, variants: 2, render: (sr, v) => splashCore(sr, 0.8, 101 + v, 1) },
  splashBig: { trim: -5, render: (sr) => mix(splashCore(sr, 1.4, 111, 2), tone(sr, 0.4, { f: (t) => 60 + 40 * Math.exp(-t / 0.05), amp: (t) => 0.6 * Math.exp(-t / 0.1) })) },
  jump: { trim: -12, variants: 2, render(sr, v) {
    return tone(sr, 0.18, { f: (t) => (260 + v * 30) * Math.pow(2.6, t / 0.18), wave: 'tri', amp: (t) => Math.sin(Math.PI * t / 0.18) });
  } },
  land: { trim: -9, variants: 2, render(sr, v) {
    const o = tone(sr, 0.2, { f: (t) => 55 + 70 * Math.exp(-t / 0.02), amp: (t) => Math.exp(-t / 0.05) });
    const n = noise(sr, 0.15, 121 + v); lp(n, sr, 900);
    applyEnv(n, (t) => Math.exp(-t / 0.03), sr);
    return mix(o, n, 0.8);
  } },
  shake: { trim: -10, render(sr) {
    // ears and jowls flapping: noise chopped at a rising rate, then droplets
    const o = noise(sr, 0.9, 131);
    bp(o, sr, 900, 0.8);
    let ph = 0;
    for (let i = 0; i < o.length; i++) {
      const t = i / sr;
      ph += (14 + 10 * t) / sr;
      o[i] *= (0.5 + 0.5 * Math.sin(TAU * ph)) ** 2 * Math.sin(Math.PI * Math.min(1, t / 0.75));
    }
    return mix(o, sparkle(sr, 0.9, 132, 25, 1500, 3500), 0.4);
  } },
  slurp: { trim: -9, render(sr) {
    const o = noise(sr, 0.7, 141);
    sweep(o, sr, (i) => { const t = i / sr; return 700 + 1600 * t + 300 * Math.sin(TAU * 11 * t); }, 6, 'bp');
    am(o, sr, 17, 0.6);
    applyEnv(o, (t) => Math.min(1, t / 0.05) * (t > 0.5 ? Math.max(0, 1 - (t - 0.5) / 0.2) : 1), sr);
    // contented "ahh"
    const ah = tone(sr, 0.5, { f: (t) => 220 * (1 - 0.1 * t), wave: 'saw', amp: (t) => Math.sin(Math.PI * t / 0.5) * 0.35 });
    bp(ah, sr, 800, 3);
    return mix(o, ah, 1, at(sr, 0.18));
  } },
  boing: { trim: -9, render(sr) {
    return tone(sr, 1, { f: (t) => 180 * (1 + 0.5 * Math.sin(TAU * 7 * t) * Math.exp(-t / 0.35)) * (1 + 0.3 * Math.exp(-t / 0.05)), amp: (t) => Math.exp(-t / 0.35) });
  } },
  egg: { trim: -5, render(sr) {
    // magical sting: a rising arpeggio of bells over a shimmer and a soft chord
    const o = buf(sr, 2);
    [72, 76, 79, 84, 88, 91].forEach((m, k) => mix(o, bellNote(sr, midiToFreq(m), 1.3, 1.8, 0.5), 0.45, at(sr, k * 0.07)));
    const pad = buf(sr, 1.8);
    for (const m of [60, 67, 71, 76]) tone(sr, 1.8, { f: midiToFreq(m), wave: 'tri', amp: (t) => Math.min(1, t / 0.3) * Math.exp(-t / 0.7) * 0.25, out: pad });
    mix(o, pad, 1, at(sr, 0.1));
    return mix(o, sparkle(sr, 1.8, 151, 50, 4000, 9000), 0.6);
  } },
  golden: { trim: -6, render(sr) {
    // a shaken jingle of little bells plus a bright major chord
    const o = buf(sr, 1.5), rnd = createNoise(161);
    for (let k = 0; k < 18; k++) {
      const t0 = k * 0.035 + Math.abs(rnd()) * 0.02;
      mix(o, fm(sr, 0.4, { fc: 3200 + 900 * Math.abs(rnd()), ratio: 1.41, index: (t) => 1.5 * Math.exp(-t / 0.05), amp: (t) => Math.exp(-t / 0.08) }), 0.3 * (1 - k / 22), at(sr, t0));
    }
    [79, 83, 86].forEach((m) => mix(o, bellNote(sr, midiToFreq(m), 1.2, 1.2, 0.5), 0.35, at(sr, 0.05)));
    return o;
  } },
  finish: { trim: -4, render(sr) {
    const o = buf(sr, 2.4);
    [[0, [67, 72]], [0.15, [69, 74]], [0.3, [71, 76]]].forEach(([t, n]) => brassChord(sr, n, 0.16, t, o));
    brassChord(sr, [60, 64, 67, 72, 76, 79], 1.8, 0.48, o);
    return mix(o, sparkle(sr, 2, 171, 30), 0.4, at(sr, 0.45));
  } },
  go: { trim: -10, render(sr) {
    // referee-style trill whistle, short and friendly
    const o = tone(sr, 0.45, { f: (t) => 2600 * (1 + 0.04 * Math.sign(Math.sin(TAU * 28 * t))), amp: (t) => Math.min(1, t / 0.01) * (t > 0.38 ? Math.max(0, 1 - (t - 0.38) / 0.07) : 1) });
    const n = noise(sr, 0.45, 181); bp(n, sr, 2600, 2);
    return mix(o, n, 0.25);
  } },
  achievement: { trim: -7, render(sr) {
    const o = buf(sr, 1.2);
    [[0, 72], [0.1, 76], [0.2, 79], [0.3, 84]].forEach(([t, m]) => mix(o, bellNote(sr, midiToFreq(m), 0.9, 1.4, 0.35), 0.5, at(sr, t)));
    return o;
  } },
  unlock: { trim: -7, render(sr) {
    const o = buf(sr, 1.4);
    [[0, 67], [0.12, 74], [0.24, 79], [0.36, 86]].forEach(([t, m]) => mix(o, bellNote(sr, midiToFreq(m), 1, 2, 0.4), 0.45, at(sr, t)));
    return mix(o, sparkle(sr, 1.3, 191, 30), 0.5);
  } },
  page: { trim: -12, render(sr) {
    const o = noise(sr, 0.3, 201);
    sweep(o, sr, (i) => 1500 + 3000 * (i / sr / 0.3), 1, 'bp');
    applyEnv(o, (t) => Math.sin(Math.PI * t / 0.3) ** 3, sr);
    return mix(o, bellNote(sr, midiToFreq(84), 0.6, 1, 0.2), 0.3, at(sr, 0.2));
  } },
  secret: { trim: -8, render(sr) {
    const o = buf(sr, 1.4);
    [79, 78, 75, 69, 68, 76, 80, 84].forEach((m, k) => mix(o, bellNote(sr, midiToFreq(m), 0.5, 1.2, 0.2), 0.4, at(sr, k * 0.09)));
    return o;
  } },
  success: { trim: -7, render(sr) {
    const o = buf(sr, 1);
    [[0, 72], [0.12, 79], [0.24, 84]].forEach(([t, m]) => mix(o, brassChord(sr, [m, m - 5], 0.3), 0.8, at(sr, t)));
    return o;
  } },
  fail: { trim: -9, render(sr) {
    // the muted trombone "wah wah waaah"
    const o = buf(sr, 1.6);
    [[0, 62, 0.3], [0.35, 61, 0.3], [0.7, 60, 0.8]].forEach(([t, m, d]) => {
      const f = midiToFreq(m - 12);
      const s = tone(sr, d, { f: (x) => f * (1 + (d > 0.5 ? 0.015 * Math.sin(TAU * 6 * x) : 0)), wave: 'saw', amp: adsr(0.04, 0.05, 0.8, 0.1, d - 0.1) });
      sweep(s, sr, (i) => 400 + 900 * (0.5 + 0.5 * Math.sin(TAU * 3 * i / sr)), 3);
      mix(o, s, 0.8, at(sr, t));
    });
    return o;
  } },
  gate: { trim: -10, render(sr) {
    const o = brownNoiseRumble(sr, 0.9);
    return mix(o, bellNote(sr, midiToFreq(67), 0.8, 1, 0.3), 0.3, at(sr, 0.5));
  } },
  bark: { trim: -8, render(sr) { // generic, used only if a species sound is missing
    const o = tone(sr, 0.16, { f: (t) => 420 * (1 + 0.4 * Math.sin(Math.PI * t / 0.16)), wave: 'saw', amp: (t) => Math.sin(Math.PI * t / 0.16) });
    return bp(o, sr, 900, 1.5);
  } },
  pigeonScare: { trim: -9, render(sr) {
    // a burst of wings flapping off
    const o = buf(sr, 1.1), rnd = createNoise(211);
    for (let k = 0; k < 9; k++) {
      const t0 = k * 0.07 + Math.abs(rnd()) * 0.05;
      const f = noise(sr, 0.05, 212 + k); bp(f, sr, 600 + 400 * Math.abs(rnd()), 1.2);
      applyEnv(f, (t) => Math.sin(Math.PI * t / 0.05), sr);
      mix(o, f, 1 - k / 12, at(sr, t0));
    }
    return o;
  } },
  // ---------- buffs and pickups ----------
  tea: { trim: -9, render: (sr) => SFX.slurp.render(sr) },
  wobble: { trim: -9, render: (sr) => SFX.boing.render(sr) },
  speed: { trim: -11, render(sr) {
    return mix(tone(sr, 0.4, { f: (t) => 400 * Math.pow(4, t / 0.4), wave: 'tri', amp: (t) => Math.sin(Math.PI * t / 0.4) }), SFX.nearMiss.render(sr), 0.5);
  } },
  almost: { trim: -16, render(sr) {
    // a little "hmm, not yet" double boop, falling
    const b = buf(sr, 0.26);
    mix(b, tone(sr, 0.1, { f: 330, wave: 'tri', amp: (t) => Math.sin(Math.PI * t / 0.1) }));
    return mix(b, tone(sr, 0.12, { f: 262, wave: 'tri', amp: (t) => Math.sin(Math.PI * t / 0.12) }), 1, at(sr, 0.13));
  } },
  comboEnd: { trim: -13, render(sr) {
    const o = buf(sr, 0.6);
    [84, 79, 76, 72].forEach((m, k) => mix(o, bellNote(sr, midiToFreq(m), 0.4, 0.8, 0.12), 0.5, at(sr, k * 0.06)));
    return o;
  } },
  timerWarn: { trim: -9, render(sr) {
    // tick-tock with a soft two-note chime
    const o = buf(sr, 0.9);
    mix(o, tone(sr, 0.05, { f: 1800, amp: (t) => Math.exp(-t / 0.008) }));
    mix(o, tone(sr, 0.05, { f: 1300, amp: (t) => Math.exp(-t / 0.008) }), 1, at(sr, 0.25));
    mix(o, bellNote(sr, midiToFreq(81), 0.4, 1, 0.12), 0.5, at(sr, 0.5));
    mix(o, bellNote(sr, midiToFreq(76), 0.4, 1, 0.12), 0.5, at(sr, 0.65));
    return o;
  } },
  // ---------- UI ----------
  'ui.tick': { trim: -16, render: (sr) => tone(sr, 0.03, { f: 2400, amp: (t) => Math.exp(-t / 0.005) }) },
  'ui.select': { trim: -12, render(sr) {
    const o = buf(sr, 0.18);
    mix(o, tone(sr, 0.08, { f: 880, wave: 'tri', amp: (t) => Math.exp(-t / 0.03) }));
    return mix(o, tone(sr, 0.1, { f: 1320, wave: 'tri', amp: (t) => Math.exp(-t / 0.04) }), 1, at(sr, 0.06));
  } },
  'ui.back': { trim: -13, render(sr) {
    const o = buf(sr, 0.18);
    mix(o, tone(sr, 0.08, { f: 990, wave: 'tri', amp: (t) => Math.exp(-t / 0.03) }));
    return mix(o, tone(sr, 0.1, { f: 660, wave: 'tri', amp: (t) => Math.exp(-t / 0.04) }), 1, at(sr, 0.06));
  } },
  'ui.whoosh': { trim: -15, render(sr) {
    const o = noise(sr, 0.3, 221);
    sweep(o, sr, (i) => 600 + 4000 * (i / sr / 0.3), 1.2, 'bp');
    return applyEnv(o, (t) => Math.sin(Math.PI * t / 0.3) ** 2, sr);
  } },
  'ui.count': { trim: -18, render: (sr) => tone(sr, 0.04, { f: 1600, wave: 'tri', amp: (t) => Math.exp(-t / 0.008) }) },
  'ui.star': { trim: -9, render: (sr) => mix(bellNote(sr, midiToFreq(88), 1, 1.5, 0.35), sparkle(sr, 0.8, 231, 25, 6000, 9500), 0.5) },
  'ui.buy': { trim: -10, render(sr) {
    const o = buf(sr, 0.7);
    mix(o, bellNote(sr, midiToFreq(83), 0.5, 1.2, 0.15), 0.6);
    mix(o, bellNote(sr, midiToFreq(88), 0.6, 1.2, 0.3), 0.6, at(sr, 0.08));
    const n = noise(sr, 0.1, 241); hp(n, sr, 4000); applyEnv(n, (t) => Math.exp(-t / 0.03), sr);
    return mix(o, n, 0.5);
  } },
  'ui.pause': { trim: -15, render: (sr) => SFX['ui.whoosh'].render(sr) },
  // ---------- hazards ----------
  'hazard.generic': { trim: -11, render(sr) {
    const o = buf(sr, 0.35);
    mix(o, tone(sr, 0.14, { f: 660, wave: 'square', amp: (t) => Math.sin(Math.PI * t / 0.14) * 0.5 }));
    mix(o, tone(sr, 0.18, { f: 495, wave: 'square', amp: (t) => Math.sin(Math.PI * t / 0.18) * 0.5 }), 1, at(sr, 0.15));
    return lp(o, sr, 2500);
  } },
  'hazard.cyclist': { trim: -10, render(sr) { // ring ring
    const o = buf(sr, 0.7);
    for (const t0 of [0, 0.22]) mix(o, fm(sr, 0.4, { fc: 2350, ratio: 1.47, index: (t) => 2 * Math.exp(-t / 0.05), amp: (t) => Math.exp(-t / 0.12) }), 0.7, at(sr, t0));
    return o;
  } },
  'hazard.tide': { trim: -10, render(sr) {
    const o = pinkNoise(sr, 1.2, 251);
    sweep(o, sr, (i) => 300 + 2500 * Math.sin(Math.PI * i / sr / 1.2), 0.8);
    return applyEnv(o, (t) => Math.sin(Math.PI * t / 1.2) ** 2, sr);
  } },
  'hazard.pigeon': { trim: -10, render: (sr) => SFX.pigeonScare.render(sr) },
  'hazard.hose': { trim: -12, render(sr) {
    const o = noise(sr, 0.8, 261); hp(o, sr, 2500);
    return applyEnv(o, (t) => Math.min(1, t / 0.05) * Math.exp(-t / 0.5), sr);
  } },
  'hazard.puddle': { trim: -9, render: (sr) => splashCore(sr, 0.6, 271, 0.7) },
  'hazard.jogger': { trim: -12, render(sr) { // huff huff
    const o = buf(sr, 0.6);
    for (const t0 of [0, 0.3]) { const h = noise(sr, 0.18, 281 + t0 * 10); bp(h, sr, 1200, 1.5); applyEnv(h, (t) => Math.sin(Math.PI * t / 0.18), sr); mix(o, h, 1, at(sr, t0)); }
    return o;
  } },
  'hazard.toucan': { trim: -10, render(sr) {
    const o = buf(sr, 0.5);
    for (const t0 of [0, 0.18]) { const s = tone(sr, 0.14, { f: (t) => 700 - 900 * t, wave: 'saw', amp: (t) => Math.sin(Math.PI * t / 0.14) }); bp(s, sr, 1400, 3); mix(o, s, 1, at(sr, t0)); }
    return o;
  } },
  'hazard.marmoset': { trim: -11, render(sr) {
    const o = buf(sr, 0.5);
    for (let k = 0; k < 6; k++) chirp(sr, { f0: 5000, f1: 6500 + k * 100, secs: 0.04 }, o, at(sr, k * 0.07));
    return o;
  } },
  'hazard.rock': { trim: -10, render: (sr) => SFX.whoopsie.render(sr) },
  'hazard.ice': { trim: -9, render(sr) { // crack
    const o = buf(sr, 0.5), rnd = createNoise(291);
    for (let k = 0; k < 12; k++) { const c = noise(sr, 0.01, 292 + k); hp(c, sr, 1500); mix(o, c, 1 - k / 14, at(sr, k * 0.02 + Math.abs(rnd()) * 0.02)); }
    return mix(o, tone(sr, 0.4, { f: (t) => 2500 * Math.exp(-t / 0.1) + 400, amp: (t) => 0.2 * Math.exp(-t / 0.1) }));
  } },
  'hazard.snowball': { trim: -9, render(sr) {
    const o = noise(sr, 0.25, 301); lp(o, sr, 1200);
    return applyEnv(o, (t) => Math.exp(-t / 0.05), sr);
  } },
  'hazard.cow': { trim: -8, render(sr) { // moo
    const o = tone(sr, 1.1, { f: (t) => 130 + 30 * Math.sin(Math.PI * t / 1.1) - 20 * t, wave: 'saw', amp: (t) => Math.sin(Math.PI * Math.min(1, t / 1.05)) });
    return bp(lp(o, sr, 1200), sr, 500, 0.7);
  } },
  'hazard.firewall': { trim: -9, render(sr) {
    const o = noise(sr, 0.9, 311);
    sweep(o, sr, (i) => 200 + 1500 * Math.sin(Math.PI * i / sr / 0.9), 0.7);
    applyEnv(o, (t) => Math.sin(Math.PI * t / 0.9), sr);
    return drive(o, 2);
  } },
  'hazard.lag': { trim: -11, render(sr) {
    const o = tone(sr, 0.5, { f: (t) => 300 + 600 * ((t * 13) % 1), wave: 'square', amp: 0.5 });
    return crush(o, 4, 12);
  } },
  'hazard.packetloss': { trim: -11, render(sr) {
    const o = buf(sr, 0.4), rnd = createNoise(321);
    for (let k = 0; k < 8; k++) if (rnd() > -0.3) mix(o, tone(sr, 0.03, { f: 900 + 700 * Math.abs(rnd()), wave: 'square', amp: 0.6 }), 1, at(sr, k * 0.045));
    return crush(o, 5, 3);
  } },
  'hazard.kid': { trim: -10, render: (sr) => SFX['hazard.snowball'].render(sr) },
};

function brownNoiseRumble(sr, secs) {
  const o = pinkNoise(sr, secs, 331);
  lp(o, sr, 220);
  return applyEnv(o, (t) => Math.sin(Math.PI * t / secs), sr);
}

// Footsteps per surface: three takes each.
const STEP_DEFS = {
  sand: { lpF: 1800, hpF: 200, tau: 0.04, len: 0.14, grains: 6, grainF: 2500 },
  pavement: { lpF: 5000, hpF: 900, tau: 0.012, len: 0.08, thump: 0.5, thumpF: 120 },
  grass: { lpF: 4500, hpF: 1200, tau: 0.05, len: 0.15 },
  water: null,
  snow: { lpF: 2500, hpF: 300, tau: 0.05, len: 0.18, grains: 10, grainF: 1800 },
  ice: { lpF: 9000, hpF: 3000, tau: 0.02, len: 0.12, ring: 0.3, ringF: 3100 },
  wood: { lpF: 2500, hpF: 150, tau: 0.015, len: 0.12, thump: 0.9, thumpF: 220, ring: 0.25, ringF: 440 },
  rock: { lpF: 4000, hpF: 400, tau: 0.01, len: 0.08, thump: 0.6, thumpF: 160 },
  leaves: { lpF: 7000, hpF: 1500, tau: 0.06, len: 0.16, grains: 14, grainF: 4500 },
  data: null,
};
for (const surf of Object.keys(STEP_DEFS)) {
  const d = STEP_DEFS[surf];
  let render;
  if (surf === 'water') render = (sr, v) => splashCore(sr, 0.25, 401 + v, 0.35);
  else if (surf === 'data') render = (sr, v) => crush(tone(sr, 0.06, { f: [1200, 1500, 1800][v % 3], wave: 'square', amp: (t) => Math.exp(-t / 0.015) }), 5, 2);
  else render = (sr, v) => step(sr, 411 + v * 7 + surf.length * 13, d);
  SFX['step.' + surf] = { trim: surf === 'data' ? -20 : -15, variants: 3, render };
}
export const SURFACES = Object.keys(STEP_DEFS);

export const SFX_IDS = Object.keys(SFX);

export function renderSfx(id, sr, variant = 0) {
  const def = SFX[id];
  if (!def) throw new Error('unknown sfx ' + id);
  const o = def.render(sr, variant);
  fadeEdges(o, sr, 0.001, 0.008);
  normalise(o, sr, SFX_LUFS, { active: true, ceilingDb: -1 });
  return o;
}

