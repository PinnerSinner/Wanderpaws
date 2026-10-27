// Offline (pure JS) renderer for the procedural music, so Node can measure the
// real loudness of every context with the same notes, instruments and part
// gains the WebAudio scheduler plays. Used by tests and measure scripts.

import { createArrangement } from './theory.js';
import { renderNote, noteKey } from './instruments.js';
import { dbToGain, mixInto } from './dsp.js';
import { SR } from './synth.js';

export function renderMusicOffline(id, { bars = 8, startBar = 0, sr = SR, combo = false, cache = new Map(), seed } = {}) {
  const arr = createArrangement(id, seed);
  const spb = arr.secondsPerBeat;
  const barSecs = spb * 4;
  const out = new Float32Array(Math.ceil((bars * barSecs + 3) * sr));
  for (let b = 0; b < bars; b++) {
    const evs = arr.bar(startBar + b, { combo });
    for (const e of evs) {
      const dur = e.dur * spb;
      const key = noteKey(e.inst, e.midi, dur);
      let nb = cache.get(key);
      if (!nb) { nb = renderNote(e.inst, e.midi, dur, sr); cache.set(key, nb); }
      mixInto(out, nb, (b * barSecs + e.t * spb) * sr, e.vel * dbToGain(e.gain));
    }
  }
  return { buffer: out.subarray(0, Math.ceil(bars * barSecs * sr)), sr, barSecs, arrangement: arr };
}
