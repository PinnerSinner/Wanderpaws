import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dbToGain, gainToDb, sliderToGain, sliderToDb, pentatonicSemis, gobbleSemis, gobblePitch, loudness, activeLoudness,
  normGainDb, normalise, peak, compressCurveDb, webAudioMakeupDb, spatial, makeLoop, panGains, midiToFreq,
} from '../../src/audio/dsp.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);
const sine = (f, secs, amp = 1, sr = 48000) => Float32Array.from({ length: Math.round(secs * sr) }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr));

test('dB and gain round-trip', () => {
  for (const db of [-60, -18, -6, 0, 6]) near(gainToDb(dbToGain(db)), db, 1e-9);
  near(dbToGain(-6.0206), 0.5, 1e-4);
});

test('slider curve: squared, 0 is silence, defaults land where documented', () => {
  assert.equal(sliderToGain(0), 0);
  assert.equal(sliderToGain(1), 1);
  near(sliderToDb(0.6), -8.87, 0.01);
  near(sliderToDb(0.9), -1.83, 0.01);
  assert.equal(sliderToGain(2), 1);
});

test('pentatonic pitch maths: the gobble pop climbs a major pentatonic', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(pentatonicSemis), [0, 2, 4, 7, 9, 12, 14, 16]);
  assert.equal(gobbleSemis(1), 0);
  assert.equal(gobbleSemis(6), 12);
  assert.equal(gobbleSemis(0), 0);
  assert.equal(gobbleSemis(500), 24, 'capped at two octaves');
  near(gobblePitch(6), 2, 1e-9);
  near(gobblePitch(4), Math.pow(2, 7 / 12), 1e-9);
  for (let c = 1; c < 30; c++) assert.ok(gobblePitch(c + 1) >= gobblePitch(c));
});

test('midi to frequency', () => {
  near(midiToFreq(69), 440, 1e-9);
  near(midiToFreq(60), 261.6256, 1e-3);
});

test('loudness: a 1 kHz full-scale sine reads about -3 LUFS (BS.1770 reference)', () => {
  near(loudness(sine(1000, 3), 48000), -3.01, 0.15);
  near(loudness(sine(1000, 3, 0.5), 48000), -9.03, 0.15);
});

test('loudness works at the synth sample rate too', () => {
  near(loudness(sine(1000, 3, 1, 32000), 32000), -3.01, 0.2);
});

test('loudness gating ignores silence', () => {
  const a = sine(1000, 2, 0.5);
  const b = new Float32Array(a.length * 3); b.set(a, a.length);
  near(loudness(b, 48000), loudness(a, 48000), 0.8); // edge blocks pass the relative gate, as BS.1770 intends
  near(activeLoudness(b, 48000), activeLoudness(a, 48000), 0.3);
});

test('normalisation gain maths: target, peak ceiling and limits', () => {
  assert.equal(normGainDb(-26, -16), 10);
  assert.equal(normGainDb(-10, -16), -6);
  assert.equal(normGainDb(-60, -16, { maxBoost: 24 }), 24);
  near(normGainDb(-26, -16, { peakLin: 0.5, ceilingDb: -1 }), -1 - gainToDb(0.5), 1e-9);
  assert.equal(normGainDb(-200, -16), 0, 'silence is left alone');
});

test('normalise hits the target on a real buffer', () => {
  const b = sine(440, 2, 0.05, 32000);
  normalise(b, 32000, -16, { active: false, ceilingDb: 0 });
  near(loudness(b, 32000), -16, 0.2);
  assert.ok(peak(b) <= 1);
});

test('compressor curve and WebAudio makeup model', () => {
  assert.equal(compressCurveDb(-30, -18, 3, 0), -30);
  near(compressCurveDb(0, -18, 3, 0), -12, 1e-9);
  near(webAudioMakeupDb(-18, 3, 0), 7.2, 1e-9);
  near(compressCurveDb(-18, -18, 3, 6), -18 + (1 / 3 - 1) * 9 / 12, 1e-9);
});

test('spatial: pan follows the listener yaw, gain falls with distance', () => {
  // facing +Z (yaw 0), right is -X
  assert.ok(spatial(0, 0, 0, -30, 0).pan > 0.9);
  assert.ok(spatial(0, 0, 0, 30, 0).pan < -0.9);
  assert.ok(Math.abs(spatial(0, 0, 0, 0, 30).pan) < 1e-9);
  assert.equal(spatial(0, 0, 0, 2, 0).gain, 1);
  assert.ok(spatial(0, 0, 0, 40, 0).gain < spatial(0, 0, 0, 20, 0).gain);
  assert.equal(spatial(0, 0, 0, 500, 0).gain, 0);
});

test('equal-power pan keeps power constant', () => {
  for (const p of [-1, -0.3, 0, 0.6, 1]) { const [l, r] = panGains(p); near(l * l + r * r, 1, 1e-9); }
});

test('makeLoop crossfades into itself', () => {
  const b = sine(100, 2, 1, 8000);
  const l = makeLoop(b, 8000, 0.25);
  assert.equal(l.length, b.length - 2000);
});
