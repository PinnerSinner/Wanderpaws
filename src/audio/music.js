// The music scheduler (WebAudio side). A lookahead clock asks the arrangement
// (theory.js) for each bar shortly before it starts and schedules every note
// as a buffer source. Contexts crossfade over 2 s on "decks". Music runs at a
// constant level and nothing in the game ever ducks it.

import { createArrangement, SONGS } from './theory.js';
import { noteKey } from './instruments.js';
import { dbToGain } from './dsp.js';
import { musicTrimDb } from './mixdesign.js';

export const CROSSFADE_S = 2;
const LOOKAHEAD_S = 0.45;   // schedule a bar this long before it starts
const START_DELAY_S = 0.1;

const PAN = { nylon: -0.25, pizz: 0.2, brass: 0.3, marimba: -0.2, flute: 0.15, bell: 0.25, glock: 0.3, arp: -0.3, shaker: 0.4, hat: 0.35, rim: -0.4, conga: -0.3, epiano: -0.1, pad: 0, clap: 0.1, bird: 0.5 };

export function createMusicPlayer({ ctx, out, getNote, prerender }) {
  const decks = [];
  let current = null;
  let combo = false;

  function makeDeck(id, at) {
    const arr = createArrangement(id);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(dbToGain(musicTrimDb(id)), at + CROSSFADE_S);
    gain.connect(out);
    const deck = { id, arr, gain, panners: new Map(), bar: 0, nextBarTime: at + START_DELAY_S, sources: new Set(), stopAt: Infinity, evCache: new Map() };
    // warm the first bars at once so the opening isn't rendered note by note
    for (let b = 0; b < 2; b++) warm(deck, b, true);
    return deck;
  }

  function panner(deck, inst) {
    let p = deck.panners.get(inst);
    if (!p) {
      p = ctx.createStereoPanner();
      p.pan.value = PAN[inst] || 0;
      p.connect(deck.gain);
      deck.panners.set(inst, p);
    }
    return p;
  }

  function eventsFor(deck, b) {
    let evs = deck.evCache.get(b);
    if (!evs) {
      evs = deck.arr.bar(b, { combo });
      deck.evCache.set(b, evs);
      if (deck.evCache.size > 6) deck.evCache.delete(deck.evCache.keys().next().value);
    }
    return evs;
  }

  function warm(deck, b, now = false) {
    const spb = deck.arr.secondsPerBeat;
    for (const e of eventsFor(deck, b)) prerender(e.inst, e.midi, e.dur * spb, now);
  }

  function scheduleBar(deck) {
    const spb = deck.arr.secondsPerBeat;
    const t0 = deck.nextBarTime;
    // the combo layer is decided when the bar is scheduled, so drop the cache
    deck.evCache.delete(deck.bar);
    const evs = eventsFor(deck, deck.bar);
    for (const e of evs) {
      const when = t0 + e.t * spb;
      if (when >= deck.stopAt) continue;
      const b = getNote(e.inst, e.midi, e.dur * spb);
      if (!b) continue;
      const src = ctx.createBufferSource();
      src.buffer = b;
      const g = ctx.createGain();
      g.gain.value = e.vel * dbToGain(e.gain);
      src.connect(g);
      g.connect(e.inst === 'bird' ? birdPan(deck, e.midi) : panner(deck, e.inst));
      src.start(Math.max(when, ctx.currentTime));
      deck.sources.add(src);
      src.onended = () => { deck.sources.delete(src); try { g.disconnect(); } catch { /* gone */ } };
    }
    deck.bar++;
    deck.nextBarTime = t0 + spb * deck.arr.beatsPerBar;
    warm(deck, deck.bar);
    warm(deck, deck.bar + 1);
  }

  function birdPan(deck, midi) { // birds come from all around
    const key = 'bird' + (midi % 4);
    let p = deck.panners.get(key);
    if (!p) { p = ctx.createStereoPanner(); p.pan.value = [-0.7, -0.3, 0.35, 0.75][midi % 4]; p.connect(deck.gain); deck.panners.set(key, p); }
    return p;
  }

  function retire(deck, at) {
    deck.gain.gain.cancelScheduledValues(at);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, at);
    deck.gain.gain.linearRampToValueAtTime(0, at + CROSSFADE_S);
    deck.stopAt = at + CROSSFADE_S + 0.05;
  }

  function dispose(deck) {
    for (const s of deck.sources) { try { s.stop(); } catch { /* not started */ } }
    deck.sources.clear();
    try { deck.gain.disconnect(); } catch { /* ok */ }
  }

  return {
    get current() { return current ? current.id : null; },
    play(id) {
      if (id && !SONGS[id]) id = 'title';
      if ((current && current.id) === (id || null)) return;
      const now = ctx.currentTime;
      if (current) retire(current, now);
      current = id ? makeDeck(id, now) : null;
      if (current) decks.push(current);
    },
    setCombo(on) { combo = !!on; },
    get combo() { return combo; },
    schedule() {
      const now = ctx.currentTime;
      for (let i = decks.length - 1; i >= 0; i--) {
        const d = decks[i];
        if (now > d.stopAt) { dispose(d); decks.splice(i, 1); continue; }
        // if we fell far behind (tab was hidden), jump forward rather than flood
        if (d.nextBarTime < now - 1) d.nextBarTime = now + START_DELAY_S;
        let guard = 0;
        while (d.nextBarTime - now < LOOKAHEAD_S && d.nextBarTime < d.stopAt && guard++ < 2) scheduleBar(d);
      }
    },
    stats() { return { decks: decks.length, sources: decks.reduce((a, d) => a + d.sources.size, 0), bar: current ? current.bar : -1 }; },
    dispose() { for (const d of decks) dispose(d); decks.length = 0; current = null; },
  };
}

export { noteKey };
