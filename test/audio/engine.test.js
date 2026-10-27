// The engine against a tiny fake AudioContext, so its runtime paths (graph,
// music scheduling, say, sfx, ambience, meters) run in Node.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus, EV } from '../../src/core/events.js';
import { createSettings } from '../../src/core/settings.js';

function param(v = 0) {
  return { value: v, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; }, setTargetAtTime(x) { this.value = x; }, cancelScheduledValues() {} };
}
function fakeCtx() {
  const log = { sources: 0, started: 0, stopped: 0, buffers: 0 };
  const node = (extra = {}) => ({ connect(n) { return n; }, disconnect() {}, ...extra });
  const ctx = {
    log, currentTime: 0, state: 'running', sampleRate: 48000, destination: node(),
    createGain: () => node({ gain: param(1) }),
    createStereoPanner: () => node({ pan: param(0) }),
    createDynamicsCompressor: () => node({ threshold: param(), ratio: param(), knee: param(), attack: param(), release: param(), reduction: -1.5 }),
    createBiquadFilter: () => node({ type: '', frequency: param(), gain: param(), Q: param() }),
    createChannelSplitter: () => node(),
    createAnalyser: () => node({ fftSize: 2048, getFloatTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = 0.05 * Math.sin(i / 7); } }),
    createBuffer: (ch, len, sr) => { log.buffers++; const d = new Float32Array(len); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => d, copyToChannel(src) { d.set(src); } }; },
    createBufferSource: () => { log.sources++; return node({ buffer: null, loop: false, playbackRate: param(1), start() { log.started++; }, stop() { log.stopped++; }, onended: null }); },
    resume: async () => {}, suspend: async () => {}, close: async () => {},
  };
  return ctx;
}

async function setup() {
  const ctxs = [];
  globalThis.AudioContext = function () { const c = fakeCtx(); ctxs.push(c); return c; };
  const { createAudio } = await import('../../src/audio/index.js');
  const bus = createBus();
  const settings = createSettings(null);
  const audio = createAudio({ settings, bus, assets: null });
  return { audio, bus, settings, ctxs };
}

test('audio module imports in Node and is inert before unlock', async () => {
  delete globalThis.AudioContext;
  const { createAudio } = await import('../../src/audio/index.js');
  const a = createAudio({});
  a.music('w1'); a.sfx('pop'); a.species('oli', 'bark'); a.say({ speaker: 'gerald', text: 'Coo.' });
  a.tick(0.016, null, null);
  assert.equal(a.unlocked, false);
  assert.equal(a.unlock(), false, 'no AudioContext in Node');
  const lv = a.levels();
  assert.equal(lv.measured, false);
  assert.ok(Math.abs(lv.design.voiceOverMusicDb - 5) < 0.01);
});

test('unlock builds the graph and starts the wanted music', async () => {
  const { audio, ctxs } = await setup();
  audio.music('w1');
  assert.equal(audio.unlock(), true);
  const c = ctxs[0];
  for (let i = 0; i < 30; i++) { c.currentTime += 0.05; audio.tick(0.05, null, null); }
  const st = audio.stats();
  assert.equal(st.music.id, 'w1');
  assert.ok(st.music.bar >= 1, 'bars scheduled');
  assert.ok(c.log.started > 20, 'notes started: ' + c.log.started);
  audio.dispose();
});

test('music crossfades and the combo layer toggles from events', async () => {
  const { audio, bus, ctxs } = await setup();
  audio.unlock();
  audio.music('title');
  const c = ctxs[0];
  for (let i = 0; i < 10; i++) { c.currentTime += 0.05; audio.tick(0.05, null, null); }
  audio.music('w2');
  bus.emit(EV.COMBO, { type: EV.COMBO, count: 6 });
  assert.equal(audio.stats().music.combo, true);
  for (let i = 0; i < 10; i++) { c.currentTime += 0.05; audio.tick(0.05, null, null); }
  assert.equal(audio.stats().music.decks, 2, 'both decks during the fade');
  for (let i = 0; i < 60; i++) { c.currentTime += 0.05; audio.tick(0.05, null, null); }
  assert.equal(audio.stats().music.decks, 1, 'old deck retired');
  bus.emit(EV.COMBO_END, { type: EV.COMBO_END, count: 6 });
  assert.equal(audio.stats().music.combo, false);
  audio.dispose();
});

test('bus events make sounds, including UI events', async () => {
  const { audio, bus, ctxs } = await setup();
  audio.unlock();
  const c = ctxs[0];
  const before = c.log.sources;
  for (const [type, p] of [[EV.GOBBLE, { combo: 3, size: 0.1, food: true }], [EV.MILESTONE, {}], [EV.BUMP, { dropped: 2, by: 'hazard', hazardKind: 'cyclist' }],
    [EV.SPLASH, { size: 1 }], [EV.FOOTSTEP, { surface: 'sand' }], [EV.BARK, {}], [EV.EGG, {}], ['ui', { sound: 'tick' }], [EV.HAZARD, { kind: 'mystery' }]]) {
    c.currentTime += 0.2;
    bus.emit(type, { type, ...p });
  }
  assert.ok(c.log.sources - before >= 12, 'sources ' + (c.log.sources - before));
  audio.dispose();
});

test('say: blips play, the per-speaker window stops spam, forced lines get through, cap 6', async () => {
  const { audio, ctxs } = await setup();
  audio.unlock();
  const c = ctxs[0];
  assert.equal(audio.say({ speaker: 'gerald', text: 'Coo! Finders keepers.' }), true);
  assert.equal(audio.say({ speaker: 'gerald', text: 'Again!' }), false, 'within 2.5 s');
  assert.equal(audio.say({ speaker: 'gerald', text: 'Egg line.', force: true }), true);
  c.currentTime += 2.6;
  assert.equal(audio.say({ speaker: 'gerald', text: 'Later.' }), true);
  for (const s of ['marco', 'kev', 'ze', 'pru', 'packet', 'narrator', 'nigel']) audio.say({ speaker: s, text: 'Hello there.' });
  assert.ok(audio.stats().voices <= 6);
  assert.equal(audio.say({ speaker: 'player', text: 'Oli is thinking.', react: 'happy' }), true);
  audio.dispose();
});

test('volume settings are live', async () => {
  const { audio, settings, ctxs } = await setup();
  audio.unlock();
  settings.set('volMusic', 0);
  settings.set('volVoice', 1);
  const lv = audio.levels();
  assert.equal(lv.design.musicDb < -100, true);
  audio.dispose();
  assert.ok(ctxs.length === 1);
});

test('ambience follows the world and weather, meters report levels', async () => {
  const { audio, ctxs } = await setup();
  audio.unlock();
  const c = ctxs[0];
  const state = { worldId: 'w1', tide: 0.3, weather: { kind: 'rain', intensity: 1 }, player: { x: 0, z: 0, size: 1, speedNorm: 0.5 }, npcs: [] };
  for (let i = 0; i < 80; i++) { c.currentTime += 0.05; audio.tick(0.05, state, { x: 0, z: 0, yaw: 0 }); }
  const st = audio.stats();
  assert.equal(st.ambience, 'beach');
  assert.equal(st.weather, 'rain');
  const lv = audio.levels();
  assert.equal(lv.measured, true);
  assert.ok(Number.isFinite(lv.musicDb) && Number.isFinite(lv.voiceDb));
  assert.equal(lv.voiceCompReductionDb, -1.5);
  audio.dispose();
});

test('setPlayer picks the species voice for barks', async () => {
  const { audio, bus } = await setup();
  audio.unlock();
  audio.setPlayer({ speciesId: 'penguin', soundPack: 'kazoo' });
  bus.emit(EV.BARK, { type: EV.BARK });
  assert.equal(audio.stats().player.voiceId, 'penguin');
  assert.ok(audio.stats().cache.creature >= 1);
  audio.dispose();
});
