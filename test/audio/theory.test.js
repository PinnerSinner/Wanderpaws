import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChord, chordPcs, scaleNotes, chordNotes, voiceChord, sectionMelody, createArrangement, MUSIC_IDS, SONGS, parseSteps, makeMotif, SCALES,
} from '../../src/audio/theory.js';
import { INSTRUMENTS } from '../../src/audio/instruments.js';
import { createRng } from '../../src/core/rng.js';

test('chord parsing, including sharps, flats and sevenths', () => {
  assert.deepEqual(chordPcs(parseChord('Dmaj7')), [2, 6, 9, 1]);
  assert.deepEqual(chordPcs(parseChord('F#m7')), [6, 9, 1, 4]);
  assert.deepEqual(chordPcs(parseChord('Bb7')), [10, 2, 5, 8]);
  assert.deepEqual(chordPcs(parseChord('Gm6')), [7, 10, 2, 4]);
  assert.throws(() => parseChord('H7'));
  assert.throws(() => parseChord('Cwobbly'));
});

test('every chord in every song parses', () => {
  for (const id of MUSIC_IDS) for (const s of Object.values(SONGS[id].sections)) for (const c of s) parseChord(c);
});

test('scale generation', () => {
  assert.deepEqual(scaleNotes(0, 'major', 60, 72), [60, 62, 64, 65, 67, 69, 71, 72]);
  assert.deepEqual(scaleNotes(2, 'dorian', 62, 74).map((m) => m - 62), [0, 2, 3, 5, 7, 9, 10, 12]);
  assert.equal(SCALES.majPent.length, 5);
});

test('chord notes and voicings stay on chord tones near the centre', () => {
  const ch = parseChord('Cmaj7');
  for (const m of chordNotes(ch, 48, 72)) assert.ok([0, 4, 7, 11].includes(m % 12));
  const v = voiceChord(ch, 60, 4);
  assert.equal(v.length, 4);
  for (const m of v) assert.ok(Math.abs(m - 60) <= 12);
  for (let i = 1; i < v.length; i++) assert.ok(v[i] > v[i - 1]);
});

test('voice leading moves little from the previous chord', () => {
  const a = voiceChord(parseChord('Dm7'), 60, 4);
  const b = voiceChord(parseChord('G7'), 60, 4, a);
  const move = b.reduce((s, n, i) => s + Math.abs(n - a[i]), 0);
  assert.ok(move <= 10, 'total movement ' + move);
});

test('seeded melodies are deterministic, in range and in scale', () => {
  const chords = ['Fmaj7', 'Dm7', 'Gm7', 'C7'].map(parseChord);
  const opts = { seed: 42, label: 'x', chords, bars: 4, rootPc: 5, scale: 'major', lo: 65, hi: 84 };
  const a = sectionMelody(opts), b = sectionMelody(opts);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 6);
  const sc = new Set(scaleNotes(5, 'major', 0, 127));
  for (const n of a) { assert.ok(n.midi >= 65 && n.midi <= 84); assert.ok(sc.has(n.midi), 'in scale ' + n.midi); assert.ok(n.t >= 0 && n.t < 16); }
  const c = sectionMelody({ ...opts, seed: 43 });
  assert.notDeepEqual(a.map((n) => n.midi), c.map((n) => n.midi));
});

test('strong-beat melody notes land on chord tones', () => {
  const chords = ['C', 'Am', 'F', 'G'].map(parseChord);
  const m = sectionMelody({ seed: 9, label: 'y', chords, bars: 4, rootPc: 0, scale: 'major', lo: 60, hi: 84 });
  for (const n of m) if (n.t % 2 === 0) {
    const ch = chords[Math.floor(n.t / 4) % 4];
    assert.ok(chordPcs(ch).includes(n.midi % 12), `t=${n.t} midi=${n.midi}`);
  }
});

test('motifs have onsets within two bars', () => {
  const m = makeMotif(createRng(1));
  assert.ok(m.onsets.length >= 2 && m.onsets.every((t) => t >= 0 && t < 8));
  assert.equal(m.steps.length, m.onsets.length);
});

test('step patterns parse with accents and ghosts', () => {
  assert.deepEqual(parseSteps('X..x..o.'), [{ t: 0, vel: 1 }, { t: 0.75, vel: 0.7 }, { t: 1.5, vel: 0.45 }]);
});

test('arrangements: every context produces valid notes for real instruments', () => {
  for (const id of MUSIC_IDS) {
    const a = createArrangement(id);
    for (let b = 0; b < a.intro + a.cycleBars; b++) {
      for (const e of a.bar(b)) {
        assert.ok(INSTRUMENTS.includes(e.inst), id + ' ' + e.inst);
        assert.ok(e.t >= 0 && e.t < 4.2, `${id} bar ${b} t ${e.t}`);
        assert.ok(e.dur > 0 && e.vel > 0 && e.vel <= 1.2 && Number.isFinite(e.midi));
      }
    }
  }
});

test('arrangements are deterministic and vary across cycles', () => {
  const a = createArrangement('w1'), b = createArrangement('w1');
  assert.deepEqual(a.bar(3), b.bar(3));
  const mel = (bar) => a.bar(bar).filter((e) => e.inst === 'flute').map((e) => e.midi).join(',');
  const cyc = a.cycleBars;
  let differ = 0;
  for (let i = 0; i < cyc; i++) if (mel(i) !== mel(i + cyc * 2)) differ++;
  assert.ok(differ >= 3, 'melodies change after two cycles: ' + differ + ' bars differ');
});

test('the combo layer adds a hi-hat and nothing else changes', () => {
  const a = createArrangement('w2');
  const plain = a.bar(5), combo = a.bar(5, { combo: true });
  assert.equal(plain.filter((e) => e.inst === 'hat').length, 0);
  assert.ok(combo.filter((e) => e.inst === 'hat').length >= 8);
  assert.equal(combo.filter((e) => e.inst !== 'hat').length, plain.length);
});

test('end music starts with a sting, then loops', () => {
  const a = createArrangement('end');
  assert.ok(a.bar(0).some((e) => e.inst === 'brass'));
  assert.ok(!a.bar(a.intro).some((e) => e.inst === 'brass'));
  assert.equal(a.locate(a.intro + a.cycleBars).section, a.locate(a.intro).section);
});

test('the required contexts exist with their signature instruments', () => {
  const insts = (id) => new Set(SONGS[id].parts.map((p) => p.inst));
  for (const id of ['title', 'w1', 'w2', 'w3', 'w4', 'w5', 'zoomies', 'end']) assert.ok(MUSIC_IDS.includes(id));
  assert.ok(insts('w1').has('nylon') && insts('w1').has('shaker'));
  assert.ok(SONGS.w1.sections.A.some((c) => /7/.test(c)), 'bossa sevenths');
  assert.ok(insts('w2').has('pizz') && insts('w2').has('brass'));
  assert.ok(insts('w3').has('marimba') && insts('w3').has('bird'));
  assert.ok(insts('w4').has('drone') && insts('w4').has('flute'));
  assert.ok(insts('w5').has('arp'));
  assert.ok(SONGS.zoomies.bpm > SONGS.w1.bpm);
});
