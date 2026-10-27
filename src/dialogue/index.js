// The dialogue director (Node-importable). Turns game events into Lines using
// shuffle-bag banks, a global ambient cooldown (about one line every 3 to 5 s),
// per-speaker cooldowns and proximity (only cast near the player chime in).
// EV.SAY lines (from eggs) always speak. See CONTRACTS §6.

import { EV } from '../core/events.js';
import { createRng } from '../core/rng.js';
import { t, hasCopy } from '../core/copy/index.js';
import { BANKS, LINE_BY_KEY, CAST_IDS } from './banks/index.js';
import { createShuffleBag, createSequence } from './shufflebag.js';
import { blipFor } from '../audio/blips.js';
import './copy.js';

export { BANKS, CAST_IDS, LINE_BY_KEY };

export const AMBIENT_GAP = [3, 5];        // seconds between any two lines
export const EVENT_MIN_GAP = 2.5;         // non-priority event lines wait this long after any line
export const SPEAKER_COOLDOWN = { player: 6, narrator: 25, default: 7 };
export const PROXIMITY_BASE = 22;         // metres, plus 6 per metre of player size

// Event routing. who: 'near' = nearby cast with lines for the tag,
// 'player' = thought, 'narrator'. p = chance, pri = bypasses gaps and cooldowns.
export const ROUTES = {
  [EV.GOBBLE]: { tag: 'gobble', p: 0.1, who: ['player', 'near'] },
  [EV.COMBO]: { tag: 'combo', p: 0.85, who: ['near', 'player'], when: (ev) => [5, 10, 15, 20, 30, 40, 50].includes(ev.count) },
  [EV.MILESTONE]: { tag: 'milestone', p: 1, pri: true, who: ['near', 'player', 'narrator'] },
  [EV.BUMP]: { tag: 'bump', p: 0.6, who: ['player', 'near'] },
  [EV.NEAR_MISS]: { tag: 'nearMiss', p: 0.5, who: ['near', 'player'] },
  [EV.PIGEON_SCARE]: { tag: 'pigeonScare', p: 0.7, who: ['near', 'player'], prefer: 'gerald' },
  [EV.IDLE]: { tag: 'idle', p: 0.7, who: ['player'], when: (ev) => (ev.seconds ?? 10) >= 6 },
  [EV.EGG]: { tag: 'egg', p: 1, pri: true, who: ['near', 'player'] },
  [EV.GOLDEN]: { tag: 'golden', p: 1, pri: true, who: ['near', 'player'] },
  [EV.STAR]: { tag: 'star', p: 1, pri: true, who: ['near', 'player'] },
  [EV.TIMER_WARN]: { tag: 'timerWarn', p: 1, pri: true, who: ['near', 'player'] },
  [EV.SPLASH]: { tag: 'splash', p: 0.5, who: ['near', 'player'], prefer: 'kev' },
  [EV.SHAKE]: { tag: 'shake', p: 0.6, who: ['near', 'player'] },
  [EV.BARK]: { tag: 'bark', p: 0.15, who: ['near'] },
  [EV.ALMOST]: { tag: 'almost', p: 0.3, who: ['player'], limit: 8 },
  [EV.ACHIEVEMENT]: { tag: 'achievement', p: 0.5, who: ['narrator'], limit: 20 },
  [EV.WEATHER]: { tag: (ev) => 'weather-' + ev.kind, p: 1, who: ['near', 'narrator'], when: (ev) => ev.kind && ev.kind !== 'clear' },
};

const FOOD_SPECIES_P = { oli: 0.25 };

export function createDirector({ rng, settings, bus } = {}) {
  const R = rng || createRng(0xd1a106);
  const listeners = [];
  const bags = new Map();
  const seqs = new Map();
  const nextFor = new Map();
  const rateLimit = new Map();
  const pending = [];
  let clock = 0;
  let lastLineAt = -1e9;
  let nextAmbient = 4;
  let lastStateTime = -1;
  let worldId = null;

  // ---------------------------------------------------------------- helpers
  function bag(speaker, tag) {
    const k = speaker + '|' + tag;
    if (!bags.has(k)) {
      const list = BANKS[speaker]?.tags[tag];
      bags.set(k, list && list.length ? createShuffleBag(list, R) : null);
    }
    return bags.get(k);
  }
  const hasTag = (speaker, tag) => !!(BANKS[speaker]?.tags[tag]?.length);
  const cooldownOf = (s) => SPEAKER_COOLDOWN[s] ?? SPEAKER_COOLDOWN.default;
  const ready = (s) => clock >= (nextFor.get(s) ?? -1e9);

  function lineFilter(ctx) {
    return (l) => (!l.species || l.species.includes(ctx?.speciesId || 'oli')) && (!l.worlds || l.worlds.includes(ctx?.worldId || worldId));
  }

  function npcFor(state, speaker) {
    const list = state?.npcs;
    if (!list) return null;
    for (const n of list) if ((n.speakerId || n.kind) === speaker) return n;
    return null;
  }

  // Cast near the player, sorted nearest first: [{ speaker, npc, d }]
  function nearbyCast(state) {
    const p = state?.player;
    const list = state?.npcs;
    if (!p || !list) return [];
    const range = PROXIMITY_BASE + 6 * (p.size || 1);
    const out = [];
    const seen = new Set();
    for (const n of list) {
      const sp = n.speakerId || n.kind;
      if (!CAST_IDS.includes(sp) || sp === 'player' || sp === 'narrator' || seen.has(sp)) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d <= range) { out.push({ speaker: sp, npc: n, d }); seen.add(sp); }
    }
    return out.sort((a, b) => a.d - b.d);
  }

  function vars(ctx, extra = {}) {
    const v = { name: ctx?.playerName || 'Oli', ...extra };
    if (extra.itemType) {
      const k = 'item.' + extra.itemType + '.name';
      if (hasCopy(k)) { const s = t(k); v.item = s.charAt(0).toLowerCase() + s.slice(1); }
    }
    return v;
  }

  function goodBoy(ctx) {
    return !!(ctx?.goodBoy || ctx?.state?.flags?.goodBoy || ctx?.state?.flags?.goodBoyMode || settings?.get?.('goodBoy'));
  }

  function build(entry, ctx, { anchor, style, extra, force } = {}) {
    const v = vars(ctx, extra);
    let text = t(entry.key, v);
    if (text.includes('{item}')) return null;          // no item name to hand
    let sub = entry.sub ? t(entry.key + '.en', v) : undefined;
    const speaker = entry.speaker;
    let lang = entry.lang;
    if (goodBoy(ctx) && speaker !== 'narrator') {
      const gb = bag('goodboy', 'any').next();
      text = t(gb.key); sub = undefined; lang = 'en-GB';
    }
    const npc = speaker === 'player' || speaker === 'narrator' ? null : npcFor(ctx?.state, speaker);
    const st = style || (speaker === 'player' ? 'thought' : speaker === 'narrator' ? 'big' : 'chatter');
    return {
      speaker, text, sub, lang,
      anchor: anchor || (npc ? npc.id : 'player'),
      style: st,
      ttl: Math.min(6, Math.max(2.2, 1.6 + text.length * 0.055)),
      // a recording says "Oli"; for a renamed pet, fall back to the blip voice
      voiceId: speaker === 'player' || (entry.text.includes('{name}') && v.name !== 'Oli') ? undefined : entry.voiceId,
      blip: blipFor(speaker),
      react: entry.react || undefined,
      force: !!force || undefined,
      key: entry.key,
      tag: entry.tag,
    };
  }

  function emit(line, priority = false) {
    if (!line) return false;
    lastLineAt = clock;
    nextFor.set(line.speaker, clock + cooldownOf(line.speaker));
    nextAmbient = Math.max(nextAmbient, clock + AMBIENT_GAP[0] + R.next() * (AMBIENT_GAP[1] - AMBIENT_GAP[0]));
    for (const fn of listeners) { try { fn(line); } catch (e) { console.error('[dialogue]', e); } }
    return true;
  }

  function speak(speaker, tag, ctx, opts = {}) {
    const b = bag(speaker, tag);
    if (!b) return false;
    const entry = b.next(lineFilter(ctx));
    if (!entry) return false;
    return emit(build(entry, ctx, opts), opts.priority);
  }

  // Pick who says a tag, honouring proximity and cooldowns.
  function chooseSpeaker(route, tag, ctx, priority) {
    const near = nearbyCast(ctx?.state).filter((c) => hasTag(c.speaker, tag) && (priority || ready(c.speaker)));
    for (const who of route.who) {
      if (who === 'near' && near.length) {
        const pref = route.prefer && near.find((c) => c.speaker === route.prefer);
        return (pref || near[R.int(0, Math.min(near.length, 2) - 1)]).speaker;
      }
      if (who === 'player' && hasTag('player', tag) && (priority || ready('player'))) {
        // mix thoughts with nearby cast so it's not always the same voice
        if (route.who[0] === 'player' && near.length && R.chance(0.35)) return near[0].speaker;
        return 'player';
      }
      if (who === 'narrator' && hasTag('narrator', tag) && (priority ? ready('narrator') || R.chance(0.3) : ready('narrator'))) return 'narrator';
    }
    return null;
  }

  function later(delay, fn) { pending.push({ at: clock + delay, fn }); }

  // ---------------------------------------------------------------- events
  function onEvent(ev, ctx) {
    if (!ev || !ev.type) return;
    const type = ev.type;
    const state = ctx?.state;

    if (type === EV.SAY) return say(ev, ctx);
    if (type === EV.INTRO) {
      const w = ev.worldId || ctx?.worldId || worldId;
      return speak('narrator', 'intro-' + w, ctx, { force: true, priority: true });
    }
    if (type === EV.GO) {
      // Gerald's storyline beat for this world, if he's here at all
      const w = ctx?.worldId || worldId;
      if (npcFor(state, 'gerald') && storyBeat(ctx, w)) return true;
      later(0.3, () => (ready('player') ? speak('player', 'go', ctx) : false));
      return true;
    }
    if (type === EV.FINISH) {
      const w = ctx?.worldId || worldId;
      speak('narrator', 'outro-' + w, ctx, { force: true, priority: true });
      later(2.8, () => {
        const near = nearbyCast(state).filter((c) => hasTag(c.speaker, 'finish'));
        if (near.length) speak(near[0].speaker, 'finish', ctx);
        else speak('player', 'finish', ctx);
      });
      return true;
    }
    if (type === EV.ACTIVITY) return activity(ev, ctx);
    if (type === EV.BUFF) {
      const tag = 'buff-' + ev.kind;
      const sp = ev.kind === 'tea' ? 'pru' : ev.kind === 'wobble' ? 'ze' : null;
      const near = nearbyCast(state);
      if (sp && near.find((c) => c.speaker === sp) && hasTag(sp, tag) && ready(sp)) return speak(sp, tag, ctx);
      if (hasTag('player', tag)) return speak('player', tag, ctx, { priority: true });
      return false;
    }
    if (type === EV.GOBBLE && ev.food && !ev.golden) {
      const p = FOOD_SPECIES_P[ctx?.speciesId] ?? 0.12;
      if (clock - lastLineAt >= EVENT_MIN_GAP && ready('player') && R.chance(p)) return speak('player', 'food', ctx);
    }

    const route = ROUTES[type];
    if (!route) return false;
    if (route.when && !route.when(ev)) return false;
    const tag = typeof route.tag === 'function' ? route.tag(ev) : route.tag;
    if (route.limit) {
      if ((rateLimit.get(tag) ?? -1e9) + route.limit > clock) return false;
    }
    const priority = !!route.pri;
    if (!priority && clock - lastLineAt < EVENT_MIN_GAP) return false;
    if (!R.chance(route.p)) return false;
    const speaker = chooseSpeaker(route, tag, ctx, priority);
    if (!speaker) return false;
    if (route.limit) rateLimit.set(tag, clock);
    return speak(speaker, tag, ctx, { priority, extra: { count: ev.count, itemType: ev.itemType } });
  }

  function storyBeat(ctx, w) {
    const k = 'story-' + w;
    if (!hasTag('gerald', k)) return false;
    if (!seqs.has(k)) seqs.set(k, createSequence(BANKS.gerald.tags[k]));
    const s = seqs.get(k);
    const entry = s.next();
    if (!entry) return false;
    return emit(build(entry, ctx, { force: true }), true);
  }

  function activity(ev, ctx) {
    const kind = ev.kind, phase = ev.phase || 'start';
    const owner = { fetch: 'marco', herding: 'gerald', sitStay: 'gerald', sniffTrail: 'player' }[kind] || 'player';
    const tag = `activity-${kind}-${phase}`;
    if (hasTag(owner, tag)) return speak(owner, tag, ctx, { priority: true });
    if (hasTag('player', 'activity-' + phase)) return speak('player', 'activity-' + phase, ctx, { priority: true });
    return false;
  }

  // EV.SAY: { speaker, key, vars?, x?, y?, z?, anchor?, style? }. Always voiced.
  function say(ev, ctx) {
    const speaker = ev.speaker || 'narrator';
    const known = LINE_BY_KEY.get(ev.key);
    const v = vars(ctx, ev.vars || {});
    let text, sub, voiceId;
    if (known) {
      text = t(known.key, v);
      sub = known.sub ? t(known.key + '.en', v) : undefined;
      voiceId = known.voiceId;
    } else {
      text = t(ev.key, v);
      sub = hasCopy(ev.key + '.en') ? t(ev.key + '.en', v) : undefined;
      voiceId = String(ev.key || 'line').replace(/[^A-Za-z0-9_-]+/g, '-');
    }
    const npc = npcFor(ctx?.state, speaker);
    const anchor = ev.anchor || (ev.x != null ? { x: ev.x, y: ev.y ?? 1.5, z: ev.z } : npc ? npc.id : 'player');
    const line = {
      speaker, text, sub,
      lang: speaker === 'ze' || sub ? 'pt-BR' : 'en-GB',
      anchor,
      style: ev.style || (speaker === 'player' ? 'thought' : speaker === 'narrator' ? 'big' : 'chatter'),
      ttl: Math.min(6.5, Math.max(2.5, 1.8 + text.length * 0.055)),
      voiceId: speaker === 'player' ? undefined : voiceId,
      blip: blipFor(speaker),
      react: known?.react || (speaker === 'player' ? 'excited' : undefined),
      force: true,
      key: ev.key,
    };
    return emit(line, true);
  }

  // ---------------------------------------------------------------- ambient
  function tick(dt, ctx) {
    clock += dt || 0;
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].at <= clock) { const p = pending.splice(i, 1)[0]; try { p.fn(); } catch (e) { console.error(e); } }
    }
    const state = ctx?.state;
    if (!state || state.phase !== 'play') return;
    // paused: the sim clock stands still, and so does the chatter
    if (state.time === lastStateTime) return;
    lastStateTime = state.time;
    if (clock < nextAmbient) return;
    nextAmbient = clock + AMBIENT_GAP[0] + R.next() * (AMBIENT_GAP[1] - AMBIENT_GAP[0]);

    const near = nearbyCast(state).filter((c) => ready(c.speaker) && hasTag(c.speaker, 'throwaway'));
    let speaker = null;
    if (near.length && R.chance(0.7)) speaker = near[R.int(0, near.length - 1)].speaker;
    else if (ready('player') && R.chance(near.length ? 0.8 : 0.45)) speaker = 'player';
    else if (ready('narrator') && R.chance(0.04)) speaker = 'narrator';
    if (!speaker) return;
    if (speaker === 'gerald' && R.chance(0.35) && storyBeat(ctx, ctx?.worldId || worldId)) return;
    speak(speaker, 'throwaway', ctx);
  }

  return {
    onLine(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    onEvent,
    tick,
    reset(w) {
      worldId = w || null;
      lastLineAt = -1e9;
      nextAmbient = clock + 5;
      nextFor.clear();
      pending.length = 0;
      rateLimit.clear();
      lastStateTime = -1;
      for (const k of [...seqs.keys()]) if (k === 'story-' + w) seqs.delete(k);
    },
    // for tests and debugging
    get clock() { return clock; },
    nearbyCast,
  };
}
