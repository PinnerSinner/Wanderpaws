// A tiny synchronous event bus plus the canonical list of game event types.
// The sim pushes events into sim.events each tick; main.js drains them and
// emits them on the bus where audio, dialogue, render, UI and meta listen.

export const EV = Object.freeze({
  // flow
  INTRO: 'intro',            // {worldId}
  GO: 'go',                  // {}
  FINISH: 'finish',          // {result}
  PAUSE: 'pause', RESUME: 'resume',
  // player
  GOBBLE: 'gobble',          // {itemType, size, x, y, z, combo, golden, food, first}
  COMBO: 'combo',            // {count, mult}
  COMBO_END: 'comboEnd',     // {count}
  MILESTONE: 'milestone',    // {index, size}
  ALMOST: 'almost',          // {itemType} nudging an item you're nearly big enough for
  BUMP: 'bump',              // {dropped, by: 'item'|'hazard', hazardKind?, x, z}
  NEAR_MISS: 'nearMiss',     // {hazardKind}
  JUMP: 'jump',              // {}
  LAND: 'land',              // {impact 0..1}
  SPLASH: 'splash',          // {x, z, size}
  SHAKE: 'shake',            // {x, z}
  FOOTSTEP: 'footstep',      // {surface, x, z, side}
  BARK: 'bark',              // {x, z}
  PLAY_BOW: 'playBow',       // {x, z}
  SIG: 'sig',                // {kind, phase: 'start'|'end'}
  IDLE: 'idle',              // {seconds, anim}
  BUFF: 'buff',              // {kind, duration}
  // world
  PIGEON_SCARE: 'pigeonScare', // {count}
  HAZARD: 'hazard',          // {kind, x, z}
  EGG: 'egg',                // {id, worldId}
  GOLDEN: 'golden',          // {itemType}
  STAR: 'star',              // {index}
  TIMER_WARN: 'timerWarn',   // {secondsLeft}
  SAY: 'say',                // {speaker, key, vars?, x?, y?, z?, anchor?}
  ACTIVITY: 'activity',      // {kind, phase: 'start'|'success'|'fail', reward?}
  WEATHER: 'weather',        // {kind}
  GATE: 'gate',              // {id, open}
  // meta (derived by the profile)
  JOURNAL_NEW: 'journalNew', // {itemType}
  ACHIEVEMENT: 'achievement',// {id}
  UNLOCK: 'unlock',          // {kind: 'species'|'cosmetic'|'world'|'mode', id}
  CODE: 'code',              // {code, modifier}
});

export function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type)?.delete(fn);
    },
    off(type, fn) { map.get(type)?.delete(fn); },
    emit(type, payload) {
      const set = map.get(type);
      if (set) for (const fn of set) { try { fn(payload, type); } catch (e) { console.error('[bus]', type, e); } }
      const any = map.get('*');
      if (any) for (const fn of any) { try { fn(payload, type); } catch (e) { console.error('[bus*]', type, e); } }
    },
    clear() { map.clear(); },
  };
}
