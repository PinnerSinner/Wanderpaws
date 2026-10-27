// Procedural "blip" voices for the cast (pure). Each speaker has a distinct
// waveform, pitch, formant shift, syllable rate and effect (SPEC §5). A line's
// text drives the syllable rhythm, vowels pick the formants and punctuation
// shapes the intonation. Rendered lines are loudness-normalised to the same
// target as recorded clips, so blips and real voices sit at one level.

import { createNoise, normalise, fadeEdges, TAU, clamp, biquad, rbj } from './dsp.js';
import { buf, tone, noise, lp, hp, bp, drive, crush, echo } from './synth.js';
import { hashString } from '../core/rng.js';

export const BLIP_LUFS = -16;     // same target as recorded clips
export const MAX_SYLLABLES = 16;

export const VOICE_PROFILES = {
  gerald: { wave: 'square', pitch: 300, range: 7, rate: 7.2, formant: 1.12, fx: 'cluck' },
  marco: { wave: 'tri', pitch: 165, range: 3, rate: 5.6, formant: 1.0, fx: 'warm' },
  kev: { wave: 'saw', pitch: 100, range: 2.5, rate: 4.6, formant: 0.85, fx: 'megaphone' },
  ze: { wave: 'tri', pitch: 255, range: 5, rate: 8.6, formant: 1.06, fx: 'opera' },
  pru: { wave: 'sine', pitch: 410, range: 4, rate: 6.2, formant: 1.18, fx: 'trill' },
  packet: { wave: 'square', pitch: 235, range: 4, rate: 6.6, formant: 1.0, fx: 'crush' },
  narrator: { wave: 'soft', pitch: 135, range: 2, rate: 4.4, formant: 0.95, fx: 'room' },
  nigel: { wave: 'square', pitch: 360, range: 6, rate: 8.2, formant: 1.18, fx: 'cluck' },
  sloth: { wave: 'sine', pitch: 115, range: 1, rate: 1.6, formant: 0.9, fx: 'warm' },
  toucan: { wave: 'saw', pitch: 520, range: 8, rate: 7, formant: 1.3, fx: 'cluck' },
};

const WAVES = ['square', 'tri', 'saw', 'sine'];

// A profile for any speaker id; unknown speakers get a stable hashed voice.
export function voiceProfile(speaker) {
  if (VOICE_PROFILES[speaker]) return VOICE_PROFILES[speaker];
  const h = hashString(String(speaker || 'npc'));
  return { wave: WAVES[h % 4], pitch: 140 + (h >>> 3) % 260, range: 2 + (h >>> 9) % 5, rate: 5 + ((h >>> 13) % 30) / 10, formant: 0.9 + ((h >>> 17) % 30) / 100, fx: 'warm' };
}

const VOWEL_FORMANTS = { a: [800, 1250], e: [520, 1850], i: [320, 2300], o: [520, 900], u: [360, 820], y: [400, 2000] };

// Text -> syllables: [{ vowel, len (relative), pauseAfter (s), accent }]
export function syllabify(text) {
  const out = [];
  const words = String(text || '').replace(/\{[^}]*\}/g, 'name').split(/\s+/).filter(Boolean);
  for (const w of words) {
    const lower = w.toLowerCase();
    const groups = lower.match(/[aeiouyàáâãéêíóôõúü]+/g) || ['a'];
    const letters = lower.replace(/[^a-zà-ü]/g, '').length || 1;
    const per = letters / groups.length;
    groups.forEach((g, k) => {
      const ch = g.normalize('NFD')[0];
      out.push({ vowel: VOWEL_FORMANTS[ch] ? ch : 'a', len: clamp(0.7 + per * 0.12, 0.7, 1.6), pauseAfter: 0, accent: k === 0 && letters > 3 ? 1 : 0 });
    });
    const last = out[out.length - 1];
    if (/[.!?]$/.test(w)) last.pauseAfter = 0.22;
    else if (/[,;:]$/.test(w)) last.pauseAfter = 0.12;
    else last.pauseAfter = 0.025;
    if (/!$/.test(w)) last.exclaim = true;
    if (/\?$/.test(w)) last.question = true;
  }
  return out;
}

// Compress long lines: keep the first syllables and the final cadence.
export function trimSyllables(syl, max = MAX_SYLLABLES) {
  if (syl.length <= max) return syl;
  const head = syl.slice(0, max - 3);
  head[head.length - 1] = { ...head[head.length - 1], pauseAfter: Math.max(0.05, head[head.length - 1].pauseAfter) };
  return [...head, ...syl.slice(-3)];
}

// Seconds a line's blips will take (used by tests and for the anti-spam window).
export function blipDuration(text, profile) {
  const syl = trimSyllables(syllabify(text));
  const base = 1 / profile.rate;
  return syl.reduce((a, s) => a + base * s.len + s.pauseAfter, 0) + 0.05;
}

export function renderBlipLine(speaker, text, { sr = 32000, seed, profile: prof } = {}) {
  const p = prof || voiceProfile(speaker);
  const syl = trimSyllables(syllabify(text));
  const rnd = createNoise(seed ?? hashString(speaker + '|' + text));
  const total = blipDuration(text, p) + 0.35;
  const o = buf(sr, total);
  const base = 1 / p.rate;
  const exclaimLine = /!/.test(text), questionLine = /\?\s*$/.test(text);
  let t = 0.02;
  syl.forEach((s, k) => {
    const d = base * s.len;
    const last = k === syl.length - 1;
    // intonation: a gentle downdrift, random swings, accents up, questions rise
    let semis = rnd() * p.range * 0.6 + s.accent * p.range * 0.4 - (k / syl.length) * p.range * 0.5;
    if (exclaimLine) semis += p.range * 0.35;
    if (last && questionLine) semis += p.range;
    if (last && !questionLine) semis -= p.range * 0.4;
    if (p.fx === 'crush') semis = Math.round(semis / 2) * 2;
    const f0 = p.pitch * Math.pow(2, semis / 12);
    const long = last && p.fx === 'opera' ? 2.2 : 1;
    const dd = d * long;
    const vibDepth = p.fx === 'trill' ? 0.035 : p.fx === 'opera' ? (last ? 0.04 : 0.01) : 0.006;
    const vibRate = p.fx === 'trill' ? 7.5 : 5.5;
    const cluck = p.fx === 'cluck';
    const env = (x) => Math.min(1, x / 0.008) * Math.min(1, Math.max(0, dd - x) / 0.025);
    const fF = (x) => f0 * (1 + vibDepth * Math.sin(TAU * vibRate * x)) * (cluck ? 1 + 0.35 * Math.exp(-x / 0.015) : 1);
    let src;
    if (p.wave === 'soft') {
      src = tone(sr, dd, { f: fF, wave: 'tri', amp: env });
      tone(sr, dd, { f: fF, wave: 'sine', amp: (x) => env(x) * 0.6, out: src });
    } else src = tone(sr, dd, { f: fF, wave: p.wave, amp: env });
    // formants for the vowel, shifted per speaker
    const [f1, f2] = VOWEL_FORMANTS[s.vowel];
    const a = Float32Array.from(src), b = Float32Array.from(src);
    biquad(a, rbj('bandpass', f1 * p.formant, 4, sr));
    biquad(b, rbj('bandpass', f2 * p.formant, 6, sr));
    const off = Math.floor(t * sr);
    const dry = p.wave === 'sine' || p.wave === 'soft' ? 0.6 : 0.18;
    for (let i = 0; i < src.length && off + i < o.length; i++) o[off + i] += a[i] + b[i] * 0.7 + src[i] * dry;
    if (cluck) {
      const c = noise(sr, 0.008, k + 3);
      bp(c, sr, 2500, 2);
      for (let i = 0; i < c.length && off + i < o.length; i++) o[off + i] += c[i] * 0.5;
    }
    t += dd + s.pauseAfter;
  });
  switch (p.fx) {
    case 'megaphone': hp(o, sr, 450); bp(o, sr, 1400, 0.8); drive(o, 4); break;
    case 'crush': crush(o, 5, 4); lp(o, sr, 6000); break;
    case 'warm': lp(o, sr, 3200); break;
    case 'room': lp(o, sr, 3500); echo(o, sr, 0.09, 0.25, 0.2); break;
    default: break;
  }
  fadeEdges(o, sr, 0.002, 0.05);
  normalise(o, sr, BLIP_LUFS, { active: true, ceilingDb: -1 });
  return o;
}

// The { pitch, wave } summary that goes on a dialogue Line.
export function blipFor(speaker) {
  const p = voiceProfile(speaker);
  return { pitch: p.pitch, wave: p.wave, formant: p.formant, rate: p.rate, fx: p.fx };
}
