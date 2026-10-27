// Offline level measurement with the pure DSP (Node has no OfflineAudioContext).
// Keeps the calibration tables in mixdesign.js honest and prints the figures
// for the honesty report:  node --test test/audio/measure.test.js
// Set MEASURE_FULL=1 to measure a whole cycle of every context.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMusicOffline } from '../../src/audio/offline.js';
import { createArrangement, MUSIC_IDS } from '../../src/audio/theory.js';
import { renderBlipLine } from '../../src/audio/blips.js';
import { loudness, activeLoudness, peakDb, compressModel, dbToGain, scale } from '../../src/audio/dsp.js';
import { MUSIC_MEASURED_LUFS, VOICE_COMP, VOICE_PRE_DB, VOICE_COMP_LOSS_DB, designLevels, musicTrimDb, TARGET } from '../../src/audio/mixdesign.js';

const full = !!process.env.MEASURE_FULL;
const report = {};

test('music loudness per context matches the calibration table', () => {
  const cache = new Map();
  for (const id of MUSIC_IDS) {
    const a = createArrangement(id);
    const bars = full ? a.intro + a.cycleBars : 8;
    const { buffer, sr } = renderMusicOffline(id, { bars, startBar: full ? 0 : a.intro, cache });
    const L = loudness(buffer, sr);
    const out = L + musicTrimDb(id) + designLevels(undefined, id).musicDb - (MUSIC_MEASURED_LUFS[id] + musicTrimDb(id));
    report[id] = { rawLufs: +L.toFixed(2), table: MUSIC_MEASURED_LUFS[id], peakDb: +peakDb(buffer).toFixed(1), outputAtDefaults: +out.toFixed(1) };
    assert.ok(Math.abs(L - MUSIC_MEASURED_LUFS[id]) < (full ? 0.5 : 1.5), `${id}: measured ${L.toFixed(2)} vs table ${MUSIC_MEASURED_LUFS[id]}`);
  }
});

test('voice compressor loss matches the design constant', () => {
  const lines = [['gerald', 'Ball? What ball? Finders keepers, mate.'], ['ze', 'Olha o mate! Olha o biscoito!'], ['kev', 'Code red! Dog overboard!'],
    ['pru', 'Coffee? In this house? I think not, dear.'], ['packet', 'Recalculating. In two hops, turn left.'], ['marco', 'Right then, who wants a spare ball?'],
    ['narrator', 'Copacabana. Sand, sun and one very smug pigeon.']];
  let loss = 0, maxGr = 0;
  for (const [s, txt] of lines) {
    const b = scale(renderBlipLine(s, txt), dbToGain(VOICE_PRE_DB));
    const c = compressModel(b, 32000, VOICE_COMP);
    loss += activeLoudness(b, 32000) - activeLoudness(c, 32000);
    maxGr = Math.min(maxGr, c.maxReductionDb);
  }
  loss /= lines.length;
  report.voiceComp = { avgLossDb: +loss.toFixed(2), maxGainReductionDb: +maxGr.toFixed(1), designLossDb: VOICE_COMP_LOSS_DB };
  assert.ok(Math.abs(loss - VOICE_COMP_LOSS_DB) < 0.6, 'model loss ' + loss.toFixed(2));
});

test('design: voice sits about +5 dB over music at default settings', () => {
  for (const id of MUSIC_IDS) {
    const d = designLevels(undefined, id);
    assert.ok(Math.abs(d.voiceOverMusicDb - 5) < 0.01, id);
    assert.ok(Math.abs(d.musicDb - TARGET.music) < 0.01);
  }
  report.design = designLevels();
  // print for the honesty report
  console.log('[measure]', JSON.stringify(report, null, 1));
});
