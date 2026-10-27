import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX_IDS, renderSfx, SFX_LUFS, SURFACES } from '../../src/audio/sfxlib.js';
import { SPECIES_VOICES, KINDS, SOUND_PACKS, renderCreature, packFor, VOICE_LUFS } from '../../src/audio/creatures.js';
import { renderBlipLine, syllabify, trimSyllables, voiceProfile, VOICE_PROFILES, blipDuration, BLIP_LUFS, MAX_SYLLABLES } from '../../src/audio/blips.js';
import { INSTRUMENTS, renderNote } from '../../src/audio/instruments.js';
import { LOOP_IDS, renderLoop, AMB_SHOTS, renderShot } from '../../src/audio/ambience.js';
import { activeLoudness, peak, rms } from '../../src/audio/dsp.js';
import { SPECIES_ORDER } from '../../src/animals/species.js';

const SR = 16000; // lower rate keeps the suite quick; the maths is rate-independent
const ok = (b, what) => {
  assert.ok(b.length > 10, what + ' has samples');
  assert.ok(!b.some((x) => !Number.isFinite(x)), what + ' is finite');
  assert.ok(peak(b) <= 1.0001, what + ' does not clip');
};
// a cheap fingerprint: rms in 8 slices, to prove sounds are distinct
const print = (b) => Array.from({ length: 8 }, (_, k) => rms(b.subarray(Math.floor(k * b.length / 8), Math.floor((k + 1) * b.length / 8))).toFixed(3)).join(',') + ':' + b.length;

test('every SFX renders, is finite, normalised and distinct', () => {
  const prints = new Map();
  for (const id of SFX_IDS) {
    const b = renderSfx(id, SR);
    ok(b, id);
    const L = activeLoudness(b, SR);
    assert.ok(Math.abs(L - SFX_LUFS) < 3, `${id} at ${L.toFixed(1)} LUFS`);
    prints.set(id, print(b));
  }
  const aliases = new Set(['tea', 'wobble', 'hazard.pigeon', 'hazard.rock', 'ui.pause', 'hazard.kid']);
  const seen = new Map();
  for (const [id, p] of prints) {
    if (aliases.has(id)) continue;
    assert.ok(!seen.has(p), `${id} sounds identical to ${seen.get(p)}`);
    seen.set(p, id);
  }
});

test('the SFX library covers the brief', () => {
  for (const id of ['pop', 'squish', 'gulp', 'whum', 'milestone', 'star', 'bump', 'whoopsie', 'splash', 'jump', 'land', 'shake', 'slurp', 'boing', 'egg', 'golden', 'timerWarn',
    'ui.tick', 'ui.select', 'ui.back', 'ui.whoosh', 'ui.count', 'ui.star', 'ui.buy']) assert.ok(SFX_IDS.includes(id), id);
  for (const s of ['sand', 'pavement', 'grass', 'water', 'snow', 'ice', 'wood', 'leaves', 'data']) assert.ok(SURFACES.includes(s), s);
});

test('footstep variants differ from each other', () => {
  for (const s of SURFACES) {
    const a = renderSfx('step.' + s, SR, 0), b = renderSfx('step.' + s, SR, 1);
    assert.notEqual(print(a), print(b), s);
  }
});

test('every species has every kind of sound, all distinct per species', () => {
  assert.deepEqual([...SPECIES_VOICES].sort(), [...SPECIES_ORDER].sort());
  for (const sp of SPECIES_VOICES) {
    const prints = new Set();
    for (const k of KINDS) {
      const b = renderCreature(sp, k, SR);
      ok(b, sp + '.' + k);
      assert.ok(Math.abs(activeLoudness(b, SR) - VOICE_LUFS) < 3, sp + '.' + k + ' loudness');
      prints.add(print(b));
    }
    assert.equal(prints.size, KINDS.length, sp + ' has distinct kinds');
  }
});

test('barks differ between species', () => {
  const prints = new Set(SPECIES_VOICES.map((sp) => print(renderCreature(sp, 'bark', SR))));
  assert.equal(prints.size, SPECIES_VOICES.length);
});

test('sound packs replace the bark and map from cosmetic ids', () => {
  const base = print(renderCreature('oli', 'bark', SR));
  for (const p of SOUND_PACKS) {
    const b = renderCreature('oli', 'bark', SR, 0, p);
    ok(b, p);
    assert.notEqual(print(b), base);
  }
  assert.equal(packFor('sound-squeaky'), 'squeaky');
  assert.equal(packFor('kazoo'), 'kazoo');
  assert.equal(packFor('tinyopera'), 'opera');
  assert.equal(packFor('robotpack'), 'robot');
  assert.equal(packFor(null), null);
  assert.equal(print(renderCreature('oli', 'happy', SR, 0, 'kazoo')), print(renderCreature('oli', 'happy', SR)), 'packs only change the bark');
});

test('syllables come from the text, punctuation shapes pauses', () => {
  const s = syllabify('Hello there, lovely!');
  assert.ok(s.length >= 4 && s.length <= 7);
  assert.ok(s.find((x) => x.pauseAfter >= 0.12));
  assert.ok(s.at(-1).exclaim);
  assert.equal(trimSyllables(syllabify('a '.repeat(40))).length, MAX_SYLLABLES);
  assert.ok(blipDuration('Hi.', voiceProfile('gerald')) < blipDuration('Hello there, this is a much longer line.', voiceProfile('gerald')));
});

test('every speaker has a distinct blip voice, normalised like a recorded clip', () => {
  const prints = new Set();
  for (const sp of ['gerald', 'marco', 'kev', 'ze', 'pru', 'packet', 'narrator']) {
    const b = renderBlipLine(sp, 'Lovely day for it, isn\'t it?', { sr: SR });
    ok(b, sp);
    assert.ok(Math.abs(activeLoudness(b, SR) - BLIP_LUFS) < 1.5, sp + ' loudness');
    prints.add(print(b));
  }
  assert.equal(prints.size, 7);
  const ps = Object.values(VOICE_PROFILES).map((p) => p.pitch + p.wave + p.fx);
  assert.equal(new Set(ps).size, ps.length);
});

test('unknown speakers get a stable voice', () => {
  assert.deepEqual(voiceProfile('haggis'), voiceProfile('haggis'));
  assert.notDeepEqual(voiceProfile('haggis'), voiceProfile('highlandcow'));
});

test('every instrument renders a finite note', () => {
  for (const inst of INSTRUMENTS) ok(renderNote(inst, 62, 0.5, SR), inst);
});

test('ambience loops and shots render', () => {
  for (const id of LOOP_IDS) ok(renderLoop(id, 8000), id);
  for (const id of Object.keys(AMB_SHOTS)) ok(renderShot(id, 8000), id);
});
