// Pure music theory and arrangement: scales, chords, voicings, seeded melodies
// and per-bar note generation for each music context. No WebAudio, so the
// scheduler's musical brain is unit tested and measured offline.

import { createRng, hashString } from '../core/rng.js';

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  majPent: [0, 2, 4, 7, 9],
  minPent: [0, 3, 5, 7, 10],
};

export const QUALITIES = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14],
  sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], '7sus4': [0, 5, 7, 10], m7b5: [0, 3, 6, 10],
};

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'F#m7' -> { root: 6, quality: 'm7', intervals: [0,3,7,10], name }
export function parseChord(name) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(String(name).trim());
  if (!m) throw new Error('parseChord: bad chord ' + name);
  let root = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  root = ((root % 12) + 12) % 12;
  const quality = m[3];
  const intervals = QUALITIES[quality];
  if (!intervals) throw new Error('parseChord: unknown quality ' + quality);
  return { root, quality, intervals, name };
}

export const chordPcs = (ch) => ch.intervals.map((i) => (ch.root + i) % 12);

// All midi notes of a scale between lo and hi (inclusive).
export function scaleNotes(rootPc, scale, lo = 48, hi = 84) {
  const iv = SCALES[scale] || SCALES.major;
  const out = [];
  for (let m = lo; m <= hi; m++) if (iv.includes((((m - rootPc) % 12) + 12) % 12)) out.push(m);
  return out;
}

// Chord tones as midi notes between lo and hi.
export function chordNotes(ch, lo = 48, hi = 84) {
  const pcs = chordPcs(ch);
  const out = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) out.push(m);
  return out;
}

// A close voicing of up to `size` notes whose centre sits near `centre`,
// chosen to move as little as possible from `prev` (smooth voice leading).
export function voiceChord(ch, centre = 60, size = 4, prev = null) {
  const pcs = chordPcs(ch).slice(0, size);
  let best = null, bestCost = Infinity;
  for (let inv = 0; inv < pcs.length; inv++) {
    for (let oct = -1; oct <= 1; oct++) {
      const notes = [];
      let base = Math.floor(centre / 12) * 12 + oct * 12;
      let last = -Infinity;
      for (let k = 0; k < pcs.length; k++) {
        const pc = pcs[(inv + k) % pcs.length];
        let n = base + pc;
        while (n <= last) n += 12;
        notes.push(n); last = n;
      }
      const mid = (notes[0] + notes[notes.length - 1]) / 2;
      let cost = Math.abs(mid - centre) * 0.6;
      if (prev && prev.length) {
        for (const n of notes) cost += Math.min(...prev.map((p) => Math.abs(p - n))) * 0.5;
      }
      if (cost < bestCost) { bestCost = cost; best = notes; }
    }
  }
  return best;
}

const nearest = (arr, x) => arr.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), arr[0]);

// ---------------------------------------------------------------------------
// Seeded melodies. A motif is a rhythm (onsets in beats over two bars) plus a
// contour of scale steps. Phrases repeat and vary the motif, landing on chord
// tones on strong beats.

const RHYTHM_CELLS = [
  [0, 1, 1.5, 2, 3],
  [0, 0.5, 1, 2, 2.5, 3],
  [0, 1.5, 2, 3],
  [0.5, 1, 1.5, 2.5, 3],
  [0, 0.75, 1.5, 2, 3, 3.5],
  [0, 2, 2.5, 3],
  [0, 1, 2, 2.5, 3.5],
  [0, 0.5, 1.5, 2.5],
];

export function makeMotif(rng, density = 0.6) {
  const cellsFor = () => {
    const c = rng.pick(RHYTHM_CELLS).slice();
    // thin out for low density, never below two notes
    return c.filter((_, i) => i === 0 || rng.next() < 0.45 + density * 0.6);
  };
  const bar1 = cellsFor();
  const bar2 = rng.chance(0.5) ? bar1.slice(0, Math.max(1, Math.ceil(bar1.length / 2))) : cellsFor().slice(0, 3);
  const onsets = [...bar1, ...bar2.map((t) => t + 4)];
  const steps = onsets.map((_, i) => (i === 0 ? 0 : rng.pick([-2, -1, -1, 1, 1, 2, 0, 3, -3])));
  return { onsets, steps };
}

// Realise a motif over the given chords (one chord per bar from barOffset).
export function realiseMotif(motif, { chords, barOffset = 0, scale, start, lo, hi, transpose = 0, vel = 0.8 }) {
  const out = [];
  let cur = start;
  const n = motif.onsets.length;
  for (let i = 0; i < n; i++) {
    const t = motif.onsets[i];
    const bar = Math.floor(t / 4);
    const ch = chords[(barOffset + bar) % chords.length];
    const strong = (t % 2) === 0;
    let target = cur;
    const idx = scale.indexOf(nearest(scale, cur));
    target = scale[Math.max(0, Math.min(scale.length - 1, idx + motif.steps[i] + (i === 0 ? transpose : 0)))];
    if (strong) target = nearest(chordNotes(ch, lo, hi), target);
    target = Math.max(lo, Math.min(hi, target));
    const next = i + 1 < n ? motif.onsets[i + 1] : Math.ceil((t + 0.01) / 4) * 4;
    out.push({ t, dur: Math.max(0.25, Math.min(2, next - t) * 0.9), midi: target, vel: vel * (strong ? 1 : 0.82) });
    cur = target;
  }
  return out;
}

// A melody for a whole section: motif A, its variation, motif A again, then a
// cadence that resolves to a chord tone. Deterministic for (seed, label).
export function sectionMelody({ seed, label, chords, bars, rootPc, scale = 'major', lo = 67, hi = 84, density = 0.6 }) {
  const rng = createRng((seed ^ hashString(label)) >>> 0);
  const sc = scaleNotes(rootPc, scale, lo, hi);
  const motif = makeMotif(rng, density);
  const varied = { onsets: motif.onsets, steps: motif.steps.map((s) => (rng.chance(0.35) ? s + rng.pick([-1, 1]) : s)) };
  const out = [];
  let start = nearest(sc, (lo + hi) / 2 + rng.int(-3, 3));
  for (let b = 0; b < bars; b += 2) {
    const phrase = b / 2;
    const isLast = b + 2 >= bars;
    const m = phrase % 2 === 1 ? varied : motif;
    const notes = realiseMotif(m, { chords, barOffset: b, scale: sc, start, lo, hi, transpose: phrase === 2 ? rng.pick([2, -2, 3]) : 0 });
    let kept = notes.filter((n) => n.t < (bars - b) * 4);
    if (isLast && kept.length) {
      // cadence: last note long on the chord root or third
      const lastCh = chords[(b + 1) % chords.length] || chords[b % chords.length];
      const ct = chordNotes(lastCh, lo, hi);
      const tail = kept[kept.length - 1];
      tail.midi = nearest(ct, tail.midi);
      tail.dur = Math.max(tail.dur, Math.min(3, 8 - tail.t));
    }
    for (const n of kept) out.push({ ...n, t: n.t + b * 4 });
    if (kept.length) start = kept[kept.length - 1].midi;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drum and percussion step patterns: 16 steps per bar, 'x' hit, 'X' accent.
export function parseSteps(str, stepBeats = 0.25) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === 'x' || c === 'X' || c === 'o') out.push({ t: i * stepBeats, vel: c === 'X' ? 1 : c === 'o' ? 0.45 : 0.7 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Songs. Each context has a key, tempo, sections (one chord per bar), a form,
// and parts with roles. `gain` is a per-part mix level in dB.

export const SONGS = {
  title: {
    bpm: 84, key: 5, scale: 'major', swing: 0.1, seed: 101,
    sections: { A: ['Fmaj7', 'Dm7', 'Gm7', 'C7sus4'], B: ['Bbmaj7', 'Am7', 'Gm7', 'C7'] },
    form: ['A', 'A', 'B', 'A'],
    parts: [
      { inst: 'epiano', role: 'pad', centre: 62, gain: -10, size: 4, hits: [0, 2.5] },
      { inst: 'bass', role: 'bass', pattern: 'sustain', octave: 41, gain: -8 },
      { inst: 'bell', role: 'melody', lo: 69, hi: 86, density: 0.4, gain: -12, rest: 0.3 },
      { inst: 'nylon', role: 'arp', centre: 60, pattern: [0, 1, 2, 3, 2, 1, 0, 2], step: 0.5, gain: -16 },
      { inst: 'shaker', role: 'perc', steps: '..o...o...o...o.', gain: -24, sections: ['B'] },
    ],
  },
  w1: {
    bpm: 128, key: 2, scale: 'major', swing: 0, seed: 211,
    sections: { A: ['Dmaj7', 'Bm7', 'Em7', 'A7'], B: ['Gmaj7', 'Gm6', 'F#m7', 'B7'], C: ['Em7', 'A7', 'F#m7', 'Bm7'] },
    form: ['A', 'A', 'B', 'A', 'C', 'A'],
    parts: [
      { inst: 'nylon', role: 'comp', pattern: [0, 1.5, 3], alt: [0.5, 2, 2.75], centre: 59, size: 4, dur: 0.6, gain: -9 },
      { inst: 'bass', role: 'bass', pattern: 'bossa', octave: 38, gain: -7 },
      { inst: 'shaker', role: 'perc', steps: 'XxxxXxxxXxxxXxxx', gain: -19 },
      { inst: 'rim', role: 'perc', steps: 'x..x..x...x..x..', alt: '..x..x...x..x...', gain: -17 },
      { inst: 'flute', role: 'melody', lo: 69, hi: 86, density: 0.55, gain: -11, rest: 0.2 },
      { inst: 'epiano', role: 'pad', centre: 64, size: 3, gain: -19, hits: [0], sections: ['B', 'C'] },
    ],
  },
  w2: {
    bpm: 116, key: 10, scale: 'major', swing: 0.18, seed: 307,
    sections: { A: ['Bb', 'Gm7', 'Cm7', 'F7'], B: ['Eb', 'Bb', 'C7', 'F7'], C: ['Gm', 'D7', 'Gm', 'F7'] },
    form: ['A', 'A', 'B', 'A', 'C', 'B'],
    parts: [
      { inst: 'tuba', role: 'bass', pattern: 'oompah', octave: 34, gain: -6 },
      { inst: 'pizz', role: 'comp', pattern: [1, 3], alt: [1, 2.5, 3], centre: 62, size: 3, dur: 0.3, gain: -10 },
      { inst: 'pizz', role: 'melody', lo: 70, hi: 87, density: 0.75, gain: -9 },
      { inst: 'brass', role: 'comp', pattern: [3.5], alt: [1.5, 3.5], centre: 63, size: 3, dur: 0.35, gain: -14, sections: ['A', 'B'], chance: 0.7 },
      { inst: 'snare', role: 'perc', steps: '....x.......x...', gain: -22 },
      { inst: 'kick', role: 'perc', steps: 'x.......x.......', gain: -16 },
    ],
  },
  w3: {
    bpm: 100, key: 7, scale: 'mixolydian', swing: 0.08, seed: 401,
    sections: { A: ['G', 'F', 'C', 'G'], B: ['Em7', 'Am7', 'D7sus4', 'G'], C: ['C', 'D', 'Bm7', 'Em7'] },
    form: ['A', 'B', 'A', 'C', 'A', 'B'],
    parts: [
      { inst: 'marimba', role: 'arp', centre: 60, pattern: [0, 2, 1, 2, 0, 2, 1, 3], step: 0.5, gain: -10 },
      { inst: 'marimba', role: 'melody', lo: 72, hi: 88, density: 0.6, gain: -9, rest: 0.25 },
      { inst: 'bass', role: 'bass', pattern: 'rootfifth', octave: 36, gain: -8 },
      { inst: 'conga', role: 'perc', steps: 'x..x..x.x.x..x..', gain: -16 },
      { inst: 'shaker', role: 'perc', steps: '.x.x.x.x.x.x.x.x', gain: -24 },
      { inst: 'bird', role: 'birds', gain: -20, chance: 0.55 },
    ],
  },
  w4: {
    bpm: 76, key: 2, scale: 'dorian', swing: 0, seed: 503,
    sections: { A: ['Dm', 'Dm', 'C', 'Dm'], B: ['F', 'C', 'Dm', 'Am'], C: ['Dm', 'C', 'Bb', 'C'] },
    form: ['A', 'A', 'B', 'A', 'C'],
    parts: [
      { inst: 'drone', role: 'drone', octave: 38, gain: -12 },
      { inst: 'flute', role: 'melody', lo: 69, hi: 88, density: 0.55, gain: -9, grace: true, rest: 0.15 },
      { inst: 'frame', role: 'perc', steps: 'X.....x.x.......', gain: -17 },
      { inst: 'nylon', role: 'arp', centre: 57, pattern: [0, 1, 2, 1], step: 1, gain: -17, sections: ['B', 'C'] },
    ],
  },
  w5: {
    bpm: 108, key: 4, scale: 'minor', swing: 0, seed: 607,
    sections: { A: ['Em9', 'Cmaj7', 'G', 'D'], B: ['Am7', 'Em7', 'Cmaj7', 'Bm7'], C: ['Cmaj7', 'D', 'Em9', 'Em9'] },
    form: ['A', 'A', 'B', 'A', 'C', 'B'],
    parts: [
      { inst: 'arp', role: 'arp', centre: 64, pattern: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3], step: 0.25, gain: -13 },
      { inst: 'pad', role: 'pad', centre: 60, size: 4, gain: -15, hits: [0] },
      { inst: 'bass', role: 'bass', pattern: 'pulse8', octave: 28, gain: -9 },
      { inst: 'kick', role: 'perc', steps: 'x...x...x...x...', gain: -15, sections: ['A', 'B'] },
      { inst: 'glock', role: 'melody', lo: 72, hi: 88, density: 0.45, gain: -15, rest: 0.35 },
      { inst: 'clap', role: 'perc', steps: '....x.......x...', gain: -24, sections: ['B'] },
    ],
  },
  zoomies: {
    bpm: 142, key: 0, scale: 'major', swing: 0, seed: 709,
    sections: { A: ['C', 'G', 'Am7', 'F'], B: ['F', 'G', 'Em7', 'Am7'], C: ['Dm7', 'G', 'C', 'C'] },
    form: ['A', 'A', 'B', 'A', 'C'],
    parts: [
      { inst: 'arp', role: 'arp', centre: 67, pattern: [0, 2, 1, 2, 0, 2, 1, 3], step: 0.25, gain: -14 },
      { inst: 'nylon', role: 'comp', pattern: [0, 1, 2, 3], alt: [0, 1.5, 2, 3.5], centre: 60, size: 3, dur: 0.3, gain: -12 },
      { inst: 'bass', role: 'bass', pattern: 'pulse8', octave: 36, gain: -9 },
      { inst: 'kick', role: 'perc', steps: 'x...x...x...x...', gain: -13 },
      { inst: 'snare', role: 'perc', steps: '....x.......x..o', gain: -19 },
      { inst: 'pizz', role: 'melody', lo: 72, hi: 88, density: 0.8, gain: -10 },
    ],
  },
  end: {
    bpm: 96, key: 0, scale: 'major', swing: 0.12, seed: 811,
    intro: 2, // sting bars before the loop
    sections: { S: ['C', 'G'], A: ['Cmaj7', 'Am7', 'Dm7', 'G7'], B: ['Fmaj7', 'Em7', 'Dm7', 'G7sus4'] },
    form: ['A', 'B'],
    parts: [
      { inst: 'brass', role: 'sting', gain: -8 },
      { inst: 'epiano', role: 'pad', centre: 62, size: 4, gain: -11, hits: [0, 1.5, 3] },
      { inst: 'bass', role: 'bass', pattern: 'rootfifth', octave: 36, gain: -8 },
      { inst: 'bell', role: 'melody', lo: 72, hi: 88, density: 0.55, gain: -12 },
      { inst: 'clap', role: 'perc', steps: '....x.......x...', gain: -21 },
      { inst: 'shaker', role: 'perc', steps: 'x.x.x.x.x.x.x.x.', gain: -24 },
    ],
  },
};

export const MUSIC_IDS = Object.keys(SONGS);

// Hi-hat pickup layer, added when the combo is 5 or more.
export const COMBO_HAT = { inst: 'hat', steps: 'x.x.x.x.x.x.x.x.', accentSteps: 'X.x.X.x.X.x.X.x.', gain: -21 };

// ---------------------------------------------------------------------------
// The arrangement: per-bar note events, deterministic for (song, seed).
// bar(i, { combo }) -> [{ inst, t (beats from bar start), dur, midi, vel, gain }]
export function createArrangement(id, seedOverride) {
  const song = SONGS[id];
  if (!song) throw new Error('unknown song ' + id);
  const seed = (seedOverride ?? song.seed) >>> 0;
  const chordsBy = {};
  for (const k in song.sections) chordsBy[k] = song.sections[k].map(parseChord);
  const formBars = song.form.map((s) => song.sections[s].length);
  const cycleBars = formBars.reduce((a, b) => a + b, 0);
  const intro = song.intro || 0;
  const melodyMemo = new Map();
  const voicingMemo = new Map();

  function locate(i) {
    if (i < intro) return { section: 'S', sectionBar: i, cycle: 0, formIndex: -1, sectionBars: intro };
    let k = (i - intro) % cycleBars;
    const cycle = Math.floor((i - intro) / cycleBars);
    for (let f = 0; f < song.form.length; f++) {
      if (k < formBars[f]) return { section: song.form[f], sectionBar: k, cycle, formIndex: f, sectionBars: formBars[f] };
      k -= formBars[f];
    }
    return { section: song.form[0], sectionBar: 0, cycle, formIndex: 0, sectionBars: formBars[0] };
  }

  function melodyFor(part, pi, loc) {
    // the melody repeats for two cycles and then is reseeded, so it varies
    // slowly; each appearance of a section in one cycle can vary too
    const variant = Math.floor(loc.cycle / 2) * 31 + (loc.formIndex >= 0 ? song.form.slice(0, loc.formIndex).filter((s) => s === loc.section).length : 0) % 2;
    const key = pi + ':' + loc.section + ':' + variant;
    if (!melodyMemo.has(key)) {
      melodyMemo.set(key, sectionMelody({
        seed, label: id + ':' + pi + ':' + loc.section + ':' + variant, chords: chordsBy[loc.section], bars: loc.sectionBars,
        rootPc: song.key, scale: song.scale, lo: part.lo, hi: part.hi, density: part.density,
      }));
    }
    return melodyMemo.get(key);
  }

  function voicing(part, pi, chord, name) {
    const key = pi + ':' + name;
    if (!voicingMemo.has(key)) voicingMemo.set(key, voiceChord(chord, part.centre || 60, part.size || 4));
    return voicingMemo.get(key);
  }

  function bar(i, { combo = false } = {}) {
    const loc = locate(i);
    const chords = chordsBy[loc.section];
    const chord = chords[loc.sectionBar % chords.length];
    const nextChord = chords[(loc.sectionBar + 1) % chords.length];
    const brng = createRng((seed ^ hashString(id + ':bar:' + i)) >>> 0);
    const lastBarOfSection = loc.sectionBar === loc.sectionBars - 1;
    const evs = [];
    const push = (part, e) => evs.push({ inst: part.inst, gain: part.gain || 0, ...e });

    song.parts.forEach((part, pi) => {
      if (loc.section === 'S' && part.role !== 'sting') return;
      if (loc.section !== 'S' && part.role === 'sting') return;
      if (part.sections && !part.sections.includes(loc.section)) return;
      if (part.chance != null && part.role !== 'birds' && !brng.chance(part.chance)) return;
      switch (part.role) {
        case 'pad': {
          const v = voicing(part, pi, chord, loc.section + chord.name);
          const hits = part.hits || [0];
          hits.forEach((h, k) => {
            const d = (k + 1 < hits.length ? hits[k + 1] : 4) - h;
            for (const m of v) push(part, { t: h, dur: d * 0.95, midi: m, vel: k === 0 ? 0.75 : 0.55 });
          });
          break;
        }
        case 'comp': {
          const v = voicing(part, pi, chord, loc.section + chord.name);
          const pat = (i % 2 === 1 && part.alt) ? part.alt : part.pattern;
          for (const h of pat) {
            v.forEach((m, k) => push(part, { t: h + k * 0.012, dur: part.dur || 0.5, midi: m, vel: 0.7 - k * 0.04 + brng.range(-0.05, 0.05) }));
          }
          break;
        }
        case 'arp': {
          const v = voicing(part, pi, chord, loc.section + chord.name);
          const ext = [...v, ...v.map((m) => m + 12)];
          const step = part.step || 0.5;
          const n = Math.round(4 / step);
          for (let s = 0; s < n; s++) {
            const idx = part.pattern[s % part.pattern.length];
            push(part, { t: s * step, dur: step * 1.6, midi: ext[idx % ext.length], vel: (s % (1 / step * 1) === 0 ? 0.75 : 0.55) + brng.range(-0.05, 0.05) });
          }
          break;
        }
        case 'bass': {
          const r = part.octave + ((chord.root - part.octave % 12) + 12) % 12;
          const fifth = r + 7, nextR = part.octave + ((nextChord.root - part.octave % 12) + 12) % 12;
          switch (part.pattern) {
            case 'sustain': push(part, { t: 0, dur: 3.8, midi: r, vel: 0.8 }); break;
            case 'bossa':
              push(part, { t: 0, dur: 1.4, midi: r, vel: 0.85 });
              push(part, { t: 1.5, dur: 0.45, midi: fifth - 12 >= part.octave - 2 ? fifth - 12 : fifth, vel: 0.65 });
              push(part, { t: 2, dur: 1.4, midi: fifth - 12 >= part.octave - 2 ? fifth - 12 : fifth, vel: 0.8 });
              push(part, { t: 3.5, dur: 0.45, midi: lastBarOfSection ? nextR : r, vel: 0.6 });
              break;
            case 'oompah':
              push(part, { t: 0, dur: 0.45, midi: r, vel: 0.9 });
              push(part, { t: 2, dur: 0.45, midi: fifth - 12, vel: 0.75 });
              if (lastBarOfSection) push(part, { t: 3, dur: 0.45, midi: nextR + (brng.chance(0.5) ? -1 : 2), vel: 0.6 });
              break;
            case 'rootfifth':
              push(part, { t: 0, dur: 1.4, midi: r, vel: 0.85 });
              push(part, { t: 2, dur: 1.4, midi: brng.chance(0.6) ? fifth : r + 12, vel: 0.7 });
              break;
            case 'pulse8':
              for (let s = 0; s < 8; s++) push(part, { t: s * 0.5, dur: 0.4, midi: s === 7 && lastBarOfSection ? nextR : r, vel: s % 2 === 0 ? 0.8 : 0.6 });
              break;
            default: push(part, { t: 0, dur: 3.8, midi: r, vel: 0.8 });
          }
          break;
        }
        case 'drone': {
          if (i % 2 === 0) {
            const r = part.octave + ((song.key - part.octave % 12) + 12) % 12;
            push(part, { t: 0, dur: 8, midi: r, vel: 0.8 });
          }
          break;
        }
        case 'melody': {
          // rest some bars so the tune breathes; never the last bar of a section
          if (part.rest && !lastBarOfSection && brng.chance(part.rest * 0.5)) break;
          const mel = melodyFor(part, pi, loc);
          const from = loc.sectionBar * 4, to = from + 4;
          for (const n of mel) {
            if (n.t >= from && n.t < to) {
              if (part.grace && n.dur >= 0.75 && brng.chance(0.35)) {
                push(part, { t: n.t - from, dur: 0.08, midi: n.midi + 2, vel: n.vel * 0.6 });
                push(part, { t: n.t - from + 0.08, dur: n.dur - 0.08, midi: n.midi, vel: n.vel });
              } else push(part, { t: n.t - from, dur: n.dur, midi: n.midi, vel: n.vel });
            }
          }
          break;
        }
        case 'perc': {
          let steps = (i % 2 === 1 && part.alt) ? part.alt : part.steps;
          if (lastBarOfSection && brng.chance(0.5)) steps = fill(steps, brng);
          parseSteps(steps).forEach((s, k) => push(part, { t: s.t, dur: 0.25, midi: 60 + k, vel: s.vel * (0.9 + brng.range(0, 0.15)) }));
          break;
        }
        case 'birds': {
          const n = brng.chance(part.chance ?? 0.5) ? brng.int(1, 2) : 0;
          for (let k = 0; k < n; k++) push(part, { t: brng.int(0, 7) * 0.5, dur: 1, midi: 60 + brng.int(0, 5), vel: brng.range(0.5, 0.9) });
          break;
        }
        case 'sting': {
          // a rising fanfare across the intro bars: root, third, fifth, octave
          if (loc.sectionBar === 0) {
            const r = 60 + song.key;
            [[0, r], [0.5, r + 4], [1, r + 7], [1.5, r + 12]].forEach(([t, m]) => push(part, { t, dur: 0.45, midi: m, vel: 0.9 }));
            [r + 4, r + 7, r + 12, r + 16].forEach((m) => push(part, { t: 2, dur: 1.9, midi: m, vel: 1 }));
          } else {
            const r = 55 + song.key;
            [r, r + 4, r + 7, r + 11].forEach((m) => push(part, { t: 0, dur: 1.5, midi: m, vel: 0.75 }));
            [r + 5, r + 9, r + 12, r + 16].forEach((m) => push(part, { t: 2, dur: 1.9, midi: m, vel: 0.8 }));
          }
          break;
        }
        default: break;
      }
    });

    if (combo && loc.section !== 'S') {
      const st = brng.chance(0.5) ? COMBO_HAT.accentSteps : COMBO_HAT.steps;
      for (const s of parseSteps(st)) evs.push({ inst: COMBO_HAT.inst, gain: COMBO_HAT.gain, t: s.t, dur: 0.1, midi: 60, vel: s.vel });
    }

    // swing the off-beat eighths
    if (song.swing) for (const e of evs) { const f = e.t % 1; if (Math.abs(f - 0.5) < 0.01) e.t += song.swing * 0.5; }
    return evs;
  }

  return {
    id, song, seed, cycleBars, intro,
    beatsPerBar: 4,
    secondsPerBeat: 60 / song.bpm,
    locate, bar,
  };
}

// Perc fill: densify the last half bar.
function fill(steps, rng) {
  const a = steps.split('');
  for (let i = 8; i < 16; i++) if (a[i] === '.' && rng.chance(0.5)) a[i] = i >= 12 ? 'x' : 'o';
  return a.join('');
}
