// Music instruments, rendered note by note into buffers (pure, cached by the
// engine). Each note is loudness-normalised to NOTE_LUFS so part gains in the
// songs (theory.js) are the whole mix, and offline measurement matches runtime.

import { midiToFreq, normalise, createNoise, fadeEdges, TAU } from './dsp.js';
import { buf, tone, pluck, fm, applyEnv, pluckEnv, adsr, lp, hp, bp, peakEq, sweep, noise, chirp, drive } from './synth.js';

export const NOTE_LUFS = -18;

const R = {
  // Nylon-string guitar: Karplus-Strong with a warm body bump.
  nylon(sr, midi, dur) {
    const f = midiToFreq(midi);
    const len = Math.min(2.4, dur + 0.6);
    const o = pluck(sr, f, len, { bright: 0.35, damp: 0.55, decay: 0.997, seed: midi * 7 + 3 });
    peakEq(o, sr, 220, 1.2, 4);
    lp(o, sr, Math.min(5000, f * 8));
    applyEnv(o, (t) => (t > dur + 0.25 ? Math.max(0, 1 - (t - dur - 0.25) / 0.3) : 1), sr);
    return o;
  },
  // Pizzicato strings: brighter, shorter pluck.
  pizz(sr, midi) {
    const f = midiToFreq(midi);
    const o = pluck(sr, f, 0.7, { bright: 0.7, damp: 0.5, decay: 0.99, seed: midi * 13 + 1 });
    peakEq(o, sr, 900, 1, 3);
    applyEnv(o, pluckEnv(0.002, 0.18), sr);
    return o;
  },
  // Electric piano: FM tine with a decaying index.
  epiano(sr, midi, dur) {
    const f = midiToFreq(midi);
    const len = Math.min(3, dur + 0.5);
    const o = fm(sr, len, { fc: f, ratio: 1, index: (t) => 0.2 + 1.3 * Math.exp(-t / 0.25), amp: pluckEnv(0.004, 1.4, dur, 0.35) });
    fm(sr, len, { fc: f, ratio: 14, index: (t) => 0.8 * Math.exp(-t / 0.04), amp: (t) => 0.12 * Math.exp(-t / 0.08), out: o });
    return o;
  },
  // Round bass: sine plus a little second harmonic, plucky decay.
  bass(sr, midi, dur) {
    const f = midiToFreq(midi);
    const len = Math.min(4, dur + 0.12);
    const env = (t) => (t < 0.008 ? t / 0.008 : 1) * (0.55 + 0.45 * Math.exp(-t / 0.3)) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.1) : 1);
    const o = tone(sr, len, { f, amp: env });
    tone(sr, len, { f: f * 2, amp: (t) => env(t) * 0.25 * Math.exp(-t / 0.4), out: o });
    tone(sr, len, { f: f * 3, wave: 'tri', amp: (t) => env(t) * 0.08 * Math.exp(-t / 0.15), out: o });
    return o;
  },
  // Tuba: buzzy saw, low-passed, short.
  tuba(sr, midi, dur) {
    const f = midiToFreq(midi);
    const len = Math.min(1.2, dur + 0.1);
    const o = tone(sr, len, { f, wave: 'saw', amp: adsr(0.025, 0.1, 0.7, 0.08, dur) });
    sweep(o, sr, (i) => f * (2.5 + 2 * Math.exp(-i / sr / 0.08)), 0.9);
    return o;
  },
  // Brass section stab: three detuned saws with a filter swell.
  brass(sr, midi, dur) {
    const f = midiToFreq(midi);
    const len = Math.min(2.5, dur + 0.15);
    const env = adsr(0.03, 0.15, 0.75, 0.12, dur);
    const o = buf(sr, len);
    for (const d of [-0.004, 0, 0.0045]) tone(sr, len, { f: f * (1 + d), wave: 'saw', amp: env, out: o, phase: Math.abs(d) * 50 });
    sweep(o, sr, (i) => { const t = i / sr; return f * (1.6 + 4.5 * Math.min(1, t / 0.06) * (0.6 + 0.4 * Math.exp(-t / 0.3))); }, 0.8);
    return o;
  },
  // Marimba: fundamental plus the 4th-ish partial and a mallet tick.
  marimba(sr, midi) {
    const f = midiToFreq(midi);
    const tau = 0.25 + 40 / f;
    const o = tone(sr, 1.4, { f, amp: pluckEnv(0.002, tau) });
    tone(sr, 1.4, { f: f * 3.93, amp: pluckEnv(0.001, tau * 0.25, Infinity), out: o });
    tone(sr, 0.1, { f: f * 9.2, amp: (t) => 0.15 * Math.exp(-t / 0.01), out: o });
    const click = noise(sr, 0.01, midi);
    bp(click, sr, 3000, 1);
    for (let i = 0; i < click.length; i++) o[i] += click[i] * 0.3 * (1 - i / click.length);
    return o;
  },
  // Flute: sine with breath, a delayed vibrato and a soft attack.
  flute(sr, midi, dur) {
    const f = midiToFreq(midi);
    const len = Math.min(3.5, dur + 0.15);
    const vib = (t) => f * (1 + 0.005 * Math.min(1, Math.max(0, t - 0.15) / 0.3) * Math.sin(TAU * 5.2 * t));
    const env = adsr(0.06, 0.1, 0.85, 0.12, dur);
    const o = tone(sr, len, { f: vib, amp: env });
    tone(sr, len, { f: (t) => vib(t) * 2, amp: (t) => env(t) * 0.12, out: o });
    const br = noise(sr, len, midi + 99);
    bp(br, sr, f * 2, 2);
    for (let i = 0; i < o.length; i++) { const t = i / sr; o[i] += br[i] * env(t) * (0.25 + 0.5 * Math.exp(-t / 0.05)); }
    return o;
  },
  // Highland drone: root, fifth and sub-octave, mellow.
  drone(sr, midi, dur) {
    const f = midiToFreq(midi);
    const len = Math.min(10, dur + 0.6);
    const env = (t) => Math.min(1, t / 0.5) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.6) : 1);
    const o = buf(sr, len);
    tone(sr, len, { f, wave: 'saw', amp: env, out: o });
    tone(sr, len, { f: f * 1.5 * 1.001, wave: 'saw', amp: (t) => env(t) * 0.6, out: o });
    tone(sr, len, { f: f * 0.5, wave: 'tri', amp: (t) => env(t) * 0.7, out: o });
    lp(o, sr, 800, 0.6); lp(o, sr, 1400, 0.6);
    return o;
  },
  // Soft synth arp: a narrow pulse through a lowpass.
  arp(sr, midi) {
    const f = midiToFreq(midi);
    const o = tone(sr, 0.6, { f, wave: 'pulse', pw: 0.3, amp: pluckEnv(0.004, 0.16) });
    sweep(o, sr, (i) => f * (2 + 6 * Math.exp(-i / sr / 0.05)), 0.9);
    return o;
  },
  // Pad: four detuned saws, slow attack.
  pad(sr, midi, dur) {
    const f = midiToFreq(midi);
    const len = Math.min(8, dur + 0.7);
    const env = adsr(0.45, 0.4, 0.8, 0.6, dur);
    const o = buf(sr, len);
    for (const d of [-0.007, -0.002, 0.003, 0.008]) tone(sr, len, { f: f * (1 + d), wave: 'saw', amp: env, out: o, phase: d * 37 + 0.5 });
    lp(o, sr, 1100, 0.7); lp(o, sr, 2200, 0.5);
    return o;
  },
  // Bell: inharmonic FM.
  bell(sr, midi) {
    const f = midiToFreq(midi);
    return fm(sr, 2.2, { fc: f, ratio: 3.5, index: (t) => 2.2 * Math.exp(-t / 0.5), amp: pluckEnv(0.002, 0.7) });
  },
  // Glockenspiel: bright, three partials.
  glock(sr, midi) {
    const f = midiToFreq(midi);
    const o = tone(sr, 1.5, { f, amp: pluckEnv(0.001, 0.6) });
    tone(sr, 1.5, { f: f * 2.76, amp: pluckEnv(0.001, 0.25), out: o });
    tone(sr, 0.5, { f: f * 5.4, amp: (t) => 0.4 * Math.exp(-t / 0.08), out: o });
    return o;
  },
  // ---- percussion (midi is ignored or used as a seed) ----
  shaker(sr, midi) {
    const o = noise(sr, 0.09, midi + 5);
    hp(o, sr, 6000); bp(o, sr, 9000, 0.8);
    applyEnv(o, (t) => (t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) / 0.025)), sr);
    return o;
  },
  hat(sr, midi) {
    const o = noise(sr, 0.08, midi + 11);
    hp(o, sr, 7500); hp(o, sr, 7500);
    applyEnv(o, (t) => Math.exp(-t / 0.018), sr);
    return o;
  },
  kick(sr) {
    const o = tone(sr, 0.35, { f: (t) => 45 + 85 * Math.exp(-t / 0.035), amp: (t) => Math.exp(-t / 0.12) });
    const c = noise(sr, 0.004, 3);
    for (let i = 0; i < c.length; i++) o[i] += c[i] * 0.3;
    return drive(o, 1.4);
  },
  snare(sr, midi) {
    const o = noise(sr, 0.22, midi + 21);
    bp(o, sr, 2600, 0.7);
    applyEnv(o, (t) => Math.exp(-t / 0.06) * 0.8, sr);
    tone(sr, 0.22, { f: (t) => 190 + 30 * Math.exp(-t / 0.02), amp: (t) => 0.5 * Math.exp(-t / 0.04), out: o });
    return o;
  },
  clap(sr, midi) {
    const o = buf(sr, 0.25);
    const n = noise(sr, 0.25, midi + 31);
    bp(n, sr, 1500, 1.2);
    for (let i = 0; i < o.length; i++) {
      const t = i / sr;
      let e = Math.exp(-Math.max(0, t - 0.022) / 0.07);
      if (t < 0.022) e = ((t % 0.0075) < 0.0035 ? 1 : 0.2);
      o[i] = n[i] * e;
    }
    return o;
  },
  rim(sr) {
    const o = tone(sr, 0.06, { f: 2100, amp: (t) => Math.exp(-t / 0.012) });
    tone(sr, 0.06, { f: 1250, amp: (t) => 0.6 * Math.exp(-t / 0.015), out: o });
    return o;
  },
  conga(sr, midi) {
    const hi = midi % 2 === 0;
    const f0 = hi ? 330 : 220;
    const o = tone(sr, 0.4, { f: (t) => f0 * (1 + 0.12 * Math.exp(-t / 0.01)), amp: (t) => Math.exp(-t / (hi ? 0.1 : 0.16)) });
    const s = noise(sr, 0.02, midi);
    bp(s, sr, 1800, 1);
    for (let i = 0; i < s.length; i++) o[i] += s[i] * 0.4 * (1 - i / s.length);
    return o;
  },
  frame(sr, midi) {
    const o = tone(sr, 0.6, { f: (t) => 85 + 25 * Math.exp(-t / 0.02), amp: (t) => Math.exp(-t / 0.22) });
    const s = noise(sr, 0.6, midi + 41);
    lp(s, sr, 700);
    for (let i = 0; i < o.length; i++) o[i] += s[i] * 0.4 * Math.exp(-i / sr / 0.05);
    return o;
  },
  // A short bird phrase for the Tijuca chorus.
  bird(sr, midi) {
    const rnd = createNoise(midi * 977 + 5);
    const o = buf(sr, 0.9);
    const base = 2200 + (midi % 6) * 350;
    let off = 0;
    const n = 2 + Math.floor((rnd() + 1) * 2);
    for (let k = 0; k < n; k++) {
      const secs = 0.05 + 0.05 * Math.abs(rnd());
      chirp(sr, { f0: base * (1 + 0.2 * rnd()), f1: base * (1.3 + 0.4 * rnd()), secs, wob: 1 }, o, off);
      off += Math.floor((secs + 0.04 + 0.05 * Math.abs(rnd())) * sr);
    }
    return o;
  },
};

export const INSTRUMENTS = Object.keys(R);
export const PERCUSSION = new Set(['shaker', 'hat', 'kick', 'snare', 'clap', 'rim', 'conga', 'frame', 'bird']);

// Duration is quantised (50 ms) so the cache stays small.
export function noteKey(inst, midi, dur) {
  if (PERCUSSION.has(inst)) return inst + ':' + (inst === 'bird' ? midi : inst === 'conga' ? midi % 2 : midi % 3);
  if (inst === 'pizz' || inst === 'marimba' || inst === 'bell' || inst === 'glock' || inst === 'arp') return inst + ':' + midi;
  return inst + ':' + midi + ':' + Math.round(dur * 20);
}

export function renderNote(inst, midi, dur, sr) {
  const fn = R[inst];
  if (!fn) throw new Error('unknown instrument ' + inst);
  const q = Math.max(0.05, Math.round(dur * 20) / 20);
  const seedMidi = PERCUSSION.has(inst) ? (inst === 'bird' ? midi : inst === 'conga' ? midi % 2 : midi % 3) : midi;
  const o = fn(sr, seedMidi, q);
  fadeEdges(o, sr, 0.001, 0.01);
  normalise(o, sr, NOTE_LUFS, { active: true, ceilingDb: -3 });
  return o;
}
