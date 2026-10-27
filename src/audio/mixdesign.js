// The mix design: every calibration constant in one place, plus pure helpers
// that predict each bus's output loudness for given settings. Tests check that
// voice lands about +5 dB over music at the default settings, and the measure
// test re-derives MUSIC_MEASURED_LUFS from the offline renderer.

import { sliderToDb, webAudioMakeupDb } from './dsp.js';
import { DEFAULT_SETTINGS } from '../core/settings.js';

// Targets at the output with DEFAULT settings (LUFS, mono-equivalent).
export const TARGET = {
  voice: -20,     // speech: clips and blips
  music: -25,     // constant, never ducked
  sfx: -24,       // a typical SFX at trim 0 (individual trims spread them)
  ambience: -31,  // a bed under the music
};
export const VOICE_OVER_MUSIC_DB = TARGET.voice - TARGET.music; // +5

// Content levels before the bus faders.
export const CLIP_LUFS = -16;     // recorded clips are normalised to this
export const BLIP_LUFS = -16;     // blips are rendered to the same target
export const SFX_LUFS = -18;      // see sfxlib.js
export const AMB_LUFS = -20;      // see ambience.js

// Integrated loudness of one full cycle of each music context with no trim
// (measured by renderMusicOffline; test/audio/measure.test.js keeps this honest).
export const MUSIC_MEASURED_LUFS = { title: -21.61, w1: -21.31, w2: -26.77, w3: -23.32, w4: -26.93, w5: -23.66, zoomies: -22.57, end: -22.32 };

// Voice chain dynamics (CONTRACTS §7, SPEC §11)
export const VOICE_COMP = { threshold: -18, ratio: 3, knee: 6, attack: 0.005, release: 0.15 };
export const VOICE_LIMIT = { threshold: -1, ratio: 20, knee: 0, attack: 0.001, release: 0.08 };
export const MASTER_LIMIT = { threshold: -0.5, ratio: 20, knee: 0, attack: 0.002, release: 0.12 };
// WebAudio compressors add automatic makeup gain; we take it back off after each.
export const VOICE_COMP_MAKEUP_DB = webAudioMakeupDb(VOICE_COMP.threshold, VOICE_COMP.ratio, VOICE_COMP.knee);
export const VOICE_LIMIT_MAKEUP_DB = webAudioMakeupDb(VOICE_LIMIT.threshold, VOICE_LIMIT.ratio, VOICE_LIMIT.knee);
export const MASTER_LIMIT_MAKEUP_DB = webAudioMakeupDb(MASTER_LIMIT.threshold, MASTER_LIMIT.ratio, MASTER_LIMIT.knee);
// The voice chain is: line -> pre gain -> compressor -> makeup -> limiter ->
// voice slider -> master. The slider sits after the dynamics so the amount of
// compression never depends on the player's volume settings.
// VOICE_PRE_DB puts a -16 LUFS line into the compressor at about -18 LUFS,
// where it levels peaks by a few dB. VOICE_COMP_LOSS_DB is the average loudness
// the compressor takes off a typical line there (compressModel over a set of
// blip lines; measure.test.js keeps it honest) and is given back as makeup.
export const VOICE_PRE_DB = -2;
export const VOICE_COMP_LOSS_DB = 3.6;

const D = DEFAULT_SETTINGS;
const sd = (v) => sliderToDb(v);

// Fixed bus calibration gains (dB) so that the targets hold at default settings.
export const CAL = {
  voicePost: TARGET.voice - (BLIP_LUFS + VOICE_PRE_DB) - sd(D.volVoice) - sd(D.volMaster),
  musicRef: TARGET.music - sd(D.volMusic) - sd(D.volMaster),     // music content is trimmed to this
  sfx: TARGET.sfx - SFX_LUFS - sd(D.volSfx) - sd(D.volMaster),
  ambience: TARGET.ambience - AMB_LUFS - sd(D.volAmbience) - sd(D.volMaster),
};

// Per-context trim that brings every song to CAL.musicRef at slider 1.
export function musicTrimDb(id) {
  const m = MUSIC_MEASURED_LUFS[id];
  return m == null ? 0 : CAL.musicRef - m;
}

// Predicted output loudness of each bus for given settings (LUFS).
export function designLevels(settings = D, musicId = 'w1') {
  const g = (k) => sd(settings[k] ?? D[k]);
  const master = g('volMaster');
  const music = (MUSIC_MEASURED_LUFS[musicId] ?? CAL.musicRef) + musicTrimDb(musicId) + g('volMusic') + master;
  const voice = BLIP_LUFS + VOICE_PRE_DB - VOICE_COMP_LOSS_DB + VOICE_COMP_LOSS_DB + CAL.voicePost + g('volVoice') + master;
  const sfx = SFX_LUFS + CAL.sfx + g('volSfx') + master;
  const ambience = AMB_LUFS + CAL.ambience + g('volAmbience') + master;
  return { musicDb: music, voiceDb: voice, sfxDb: sfx, ambienceDb: ambience, voiceOverMusicDb: voice - music };
}
