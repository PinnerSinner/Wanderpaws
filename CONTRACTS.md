# Gobblepaws: module contracts

This is the source of truth for how the parts talk to each other. `SPEC.md` says *what* the game is; this says *how* the code fits. If you need a contract changed, append a dated entry to `REQUESTS.md`. Don't edit another area's files.

## 0. Ground rules (all agents)

- **Ownership:** you edit only the files and folders listed for your area (§10). Everything else is read-only to you. You may create new files inside your own folders.
- **British English** in all player-facing text. **No em dashes** (`—`) anywhere in copy, comments or docs. Use commas, colons or full stops.
- **Copy:** every player-facing string goes through `t(key)` from `src/core/copy/index.js`. Register your strings from a file in your own area, e.g. `src/ui/copy.js` calls `registerCopy('en-GB', {...})`. Key prefixes are per area: `ui.*`, `species.*`, `cosmetic.*`, `world.*`, `item.*`, `journal.*`, `egg.*`, `cast.*`, `bark.*`, `ach.*`, `meta.*`, `audio.*`. Seu Zé's lines are pt-BR text even in the en-GB table, with an English translation under `<key>.en`.
- **Node-importable:** everything in `src/core`, `src/sim`, `src/animals` (except `src/animals/view/`), `src/worlds` (except `src/worlds/meshes/`), `src/meta`, `src/dialogue` must import in plain Node with no `window`, `document`, `three` or WebAudio at import time. Tests import them directly.
- **Determinism:** the sim uses only `createRng` from `src/core/rng.js` and never reads the clock. Fixed `SIM_DT = 1/60`.
- **Conventions:** metres, seconds, radians. Y is up. Forward = `(sin yaw, 0, cos yaw)`. Right = `(-cos yaw, 0, sin yaw)`.
- **No per-frame allocations** in hot paths (sim step, animation update, particles, render frame). Preallocate and reuse.
- **Three.js** is `three@0.186.1`: `import * as THREE from 'three'`. Only render-side code (`src/render`, `src/animals/view`, `src/worlds/meshes`, `src/ui` if needed) may import it.
- **Tests:** `node --test` discovers `test/**/*.test.js`. Put yours in `test/<your-area>/`. Run `node --test "test/<your-area>/**/*.test.js"` while you work (passing a bare directory does not work in Node 22). Keep them fast (whole suite under about 60 s).
- **Build check:** `node tools/build.mjs --out .out/<your-area>.html` builds the whole game into your own scratch file, so you don't clobber anyone else's. Do it before you hand back, and fix anything of yours that breaks the build.
- **Don't commit.** The lead commits. Don't run `git` commands that change state.
- **UI rules from Marco:** no on-screen control hints or key prompts; no speech bubbles or boxes over the play area (chatter is small white floating text); nothing reserves space when empty; big readable sizes based on the unit `u = min(innerHeight, 0.55*innerWidth)/100`; must not clip at 2000x747, 2560x1080, 1920x1080, 1280x720 or 812x375.

## 1. Core (lead, read-only for everyone else)

| Module | Exports |
|---|---|
| `src/core/game.js` | `GAME {name, slug, domain, saveVersion}`, `SIM_HZ`, `SIM_DT` |
| `src/core/rng.js` | `createRng(seed) → {next, range, int, chance, pick, sign, shuffle, fork(label)}`, `hashString`, `dateKey(d)`, `dateSeed(d)` |
| `src/core/math.js` | `clamp, clamp01, lerp, invLerp, remap, smoothstep, damp, wrapAngle, angleDelta, dampAngle, springStep(s,target,freq,zeta,dt), spring(), ease.*, bezier2, v3*, dist2d, fwdX, fwdZ, yawOf, noise1, noise2, fbm2, hexToRgb, rgbToHex, rgbToHsl, hslToRgb, shadeHex, mixHex, formatSize, formatTime, TAU, DEG` |
| `src/core/events.js` | `EV` (event type names and payloads), `createBus() → {on, off, emit, clear}`. `on('*', fn)` receives every event as `fn(payload, type)` |
| `src/core/storage.js` | `createStorage(prefix?) → {get, set, remove, keys, clearAll, persistent}` |
| `src/core/settings.js` | `DEFAULT_SETTINGS`, `createSettings(storage) → {get, set, patch, all, reset, subscribe(fn(key, value, all))}` |
| `src/core/copy/index.js` | `registerCopy(locale, table)`, `t(key, vars)`, `tRaw(key)`, `setLocale`, `getLocale`, `hasCopy`, `allKeys` |
| `src/core/loop.js` | `createLoop({step, render})`, `runFixed(n, step)` |
| `src/assets/assets.js` | `Assets.has/uri/meta/keys/keysWithPrefix/text/image/audioBuffer(ctx,key)` |

Every event the sim emits is an object `{type: EV.X, ...payload}` (payloads are listed in `src/core/events.js`).

## 2. Animals (`src/animals/`)

### 2.1 Data (Node-importable)

`src/animals/species.js` (seeded by the lead, owned by Animals from now on):

```js
export const SPECIES = { oli: Species, cat: Species, ... };   // 13 entries, ids below
export const SPECIES_ORDER = ['oli','cat','capybara','penguin','rabbit','duck','tortoise','frog','redpanda','octopus','snake','elephant','routercat'];
export function getSpecies(id) // falls back to oli
```

`Species`:
```js
{
  id, nameKey: 'species.<id>.name', blurbKey: 'species.<id>.blurb',
  archetype: 'quadruped'|'hopper'|'waddler'|'shelled'|'serpent'|'tentacle',
  stats: { speed, accel, turn, jump, reach, startSize, waterSpeed, slideSpeed },   // multipliers, 1 = Oli
  swims: bool, floats: bool, canJump: bool,
  traits: { squeezeGaps, underFences, climbs, dropMult, foodBonus, noDrops },
  signature: { kind, cooldown, duration, nameKey: 'species.<id>.sig', descKey },
  affinity: { surfaces: { water: 1.2, snow: 1.0, ... } },  // speed multipliers by surface
  sounds: { voice: '<id>' },          // audio synthesises species.<voice>.<kind>
  defaults: Look,                     // believable default look
  presets: [{ id, nameKey, look: Partial<Look> }],
  unlock: { kind: 'start'|'stars'|'finish'|'journal'|'golden'|'secret'|'egg'|'story', world?, count?, egg?, pct?, price? },
  hitbox: { radius: 0.45, height: 0.6 },  // fractions of size
  personality: { bounce, sleek, weight, wag, idleBias: {...} },   // animation feel, 0..1
}
```

`Look`:
```js
{ base, secondary, belly, tips, eyes, nose,          // '#rrggbb'
  pattern: 'none'|'patches'|'stripes'|'spots'|'socks'|'blaze'|'saddle'|'mask'|'bands',
  patternColor, patternSeed: int, patternAmount: 0..1,
  accessories: { head: id|null, neck: id|null, back: id|null, face: id|null },
  trail: id|null, soundPack: id|null,
  decal: dataURL|null }          // optional photo face decal
```

`src/animals/cosmetics.js`: `COSMETICS = [{ id, slot: 'head'|'neck'|'back'|'face'|'trail'|'sound'|'badge', nameKey, price, unlock?: {...} }]`, `getCosmetic(id)`.

`src/animals/customise.js`: `mergeLook(species, partial) → Look`, `randomLook(species, rng)`, `paletteFromPixels(rgbaUint8Array, w, h) → {base, secondary, belly, tips}` (centre-weighted k-means, Node-testable), `validateLook(look) → Look`.

`src/animals/rig/index.js` (Node-importable maths): `createRig(species) → rig`, where `rig.update(player, dt)` reads the sim player state (§3.3) and writes `rig.pose`, a preallocated object with archetype-specific bone transforms. `rig.pose` is plain numbers. No Three.js.

### 2.2 View (render-side, imports three)

`src/animals/view/index.js`:
```js
createAnimalView({ THREE, mats, species, look, quality }) → {
  object3d,            // THREE.Group, origin at feet, faces +Z, unit size 1 (scale = player size)
  update(player, dt),  // runs the rig and applies the pose; player is §3.3 (or a fake one for title/showroom)
  setLook(look),       // live customisation
  setEmotion(e),       // optional override for menus
  dispose(),
}
createCritterView({ THREE, mats, kind }) → same shape    // NPC animals: 'pigeon','gerald','nigel','gull','toucan','marmoset','squirrel','sloth','highlandcow','haggis','kitten','magpenguin','frog','duckling','butterfly'
```
`mats` comes from the render materials factory (§4.2).

## 3. Sim (`src/sim/`, Node-importable)

### 3.1 Create and step

```js
import { createSim } from './src/sim/index.js';
const sim = createSim({
  world,              // World object from src/worlds (§5)
  species,            // Species object
  look,               // Look (sim only needs nothing visual, but passes ids through)
  mode: 'story'|'chill'|'zoomies'|'daily'|'speedrun',
  seed,               // uint32
  assist: false,
  modifiers: { bigHead, lowGravity, tiny, speedy, mirror },   // all optional booleans
  daily: null | { specialItem, modifier },
  playerName: 'Oli',
});
sim.step(inputFrame);     // advance exactly SIM_DT
sim.state;                // read-only for everyone else (§3.3)
sim.events;               // array of events emitted during the last step(s); main.js empties it (sim.events.length = 0) after draining
sim.debug;                // optional counters for tests
```

### 3.2 InputFrame (built by main.js each tick)

```js
{ mx, mz,           // world-space desired move direction * magnitude (0..1), already camera-relative
  sprint,           // bool held
  jump, jumpHeld,   // jump = pressed this tick
  sig, sigHeld,     // signature move pressed / held
  bark, barkHeld,   // tap = bark, hold >= 0.4 s = play-bow (the sim decides)
  aimYaw }          // camera yaw, for aimed moves
```

### 3.3 `sim.state` shape

```js
{
  tick, time,                       // ticks and seconds since start
  phase: 'intro'|'play'|'finished', introLeft,
  timeLeft: number|null,            // null when untimed
  worldId, mode,
  goals: { start, goal, stretch, par, star3: {...} },
  stars: [bool, bool, bool], starProgress: { hazardsTouched, collected: {type: n}, maxCombo },
  result: null | { stars, size, gobbled, biccies, time, goldenFound: [], eggsFound: [], maxCombo, distance, pigeonsScared, hazardsTouched },
  slowMo: 0..1,                     // milestone slow-mo beat, render may use it for the camera
  player: {
    x, y, z, yaw, px, py, pz, pyaw, // current and previous tick (for interpolation)
    vx, vy, vz, speed, speedNorm,   // speedNorm 0 (still) .. 1 (top sprint)
    size, displaySize,              // displaySize eases towards size, use it for visuals
    grounded, airborne, inWater, waterDepth, surface,  // 'sand'|'pavement'|'grass'|'water'|'snow'|'ice'|'wood'|'rock'|'leaves'|'data'
    sprinting, turnRate, landImpact, // landImpact decays 1 -> 0 after a landing
    gulp,                            // 1 on gobble, decays to 0 (drives the gulp-bounce)
    stagger,                         // > 0 after a bump
    sig: { kind, active, t, cooldownLeft, ready, aimYaw, power },
    emotion: 'happy'|'excited'|'scared'|'sleepy'|'proud'|'neutral',
    idleTime, idleAnim: null|'sniff'|'sit'|'scratch'|'yawn'|'look'|'playbow'|'shake'|'lie'|'species',
    barkT, playBow, shakeT,          // barkT: seconds since last bark (big when none)
    buffs: { tea, wobble, speed },   // seconds remaining
    combo: { count, mult, timer },
    reach,                           // current gobble reach radius in metres
  },
  items: {                           // structure-of-arrays, length = items.count
    count, types: string[],          // catalogue ids in order, typeIndex points here
    typeIndex: Uint16Array,
    x, y, z, px, py, pz, rotY, tilt, tiltAxis: Float32Array,
    scale: Float32Array,             // 1 normally, shrinks while being gobbled
    state: Uint8Array,               // 0 idle, 1 wobbling, 2 tumbling, 3 being gobbled, 4 gone, 5 hidden (spawns later)
    anim: Float32Array,              // per-state timer
    golden: Uint8Array,
    size: Float32Array,              // gobble size in metres
    gobbleable: Uint8Array,          // 1 when size <= threshold for the current player
    almost: Uint8Array,              // 1 when within the shimmer band
  },
  npcs: [ { id, kind, x, y, z, yaw, px, pz, anim, animT, mood, speakerId? } ],   // cast and crowd and critters
  birds: { count, x, y, z, vx, vy, vz: Float32Array, kind: Uint8Array },        // boids flocks
  weather: { kind: 'clear'|'rain'|'fog'|'parade'|'aurora'|'datastorm'|'snow', t, intensity },
  tide: number,                      // current sea level offset (matches world.water formula)
  zones: { [zoneId]: { inside: bool, time: number } },
  flags: { [key]: any },             // egg and story state
  activity: null | { kind, phase, t, score },
  camHint: null | { kind: 'milestone'|'pullback', t },
}
```

### 3.4 Gameplay rules the sim implements (summary; numbers are tunable)

- Gobble rule: `item.size <= player.size * (assist ? 0.75 : 0.6)`, with `almost` meaning between that and +15%. Reach: `player.size * 0.6 * species.stats.reach + item.size * 0.5`, plus buffs.
- Growth: `s' = cbrt(s^3 + k * item.size^3 * comboMult * foodBonus)`, `k = world.goals.growthK`.
- Bumps: hitting an item that's too big above 40% of top speed, or a hazard, drops `ceil(1..3 * dropMult)` recent gobbles (none in assist, or with `noDrops`), which respawn as items nearby with state 2 (tumbling).
- Step-up height = `0.45 * size`. Colliders taller than that block you. Gaps narrower than your hitbox block you. That's how size gates work. Colliders with `pass: 'squeeze'` let `traits.squeezeGaps` species through; `pass: 'under'` lets `traits.underFences` species through.
- Signature moves: all 13 kinds listed in `species.js`.
- Eggs: run each `world.eggs[i]` through the egg context (§5.3).
- Cast and crowd behaviours, boids, weather, activities (fetch, herding, sniffTrail, sitStay) and the timer, stars and milestones.

## 4. Render (`src/render/`)

### 4.1 Renderer

```js
createRenderer({ canvas, overlay /* DOM element for floating text */, settings, bus, app }) → {
  THREE, renderer, scene, camera, mats,
  showScene(kind, params),   // 'title' {speciesId, look} | 'showroom' {speciesId, look} | 'level' {world, sim, species, look} | 'none'
  setLook(look),             // live update of the hero in title/showroom/level
  frame(alpha, dtReal, simState),   // called every animation frame
  getCameraYaw(),            // for camera-relative input
  addLook(dx, dy),           // camera orbit input (mouse/stick), radians-ish
  floatingText: { add(line) },      // §6 Line
  enterPhoto(), exitPhoto(), isPhoto(),
  screenshot() → dataURL,
  clip: { supported, start(), save() → Promise<Blob|null> },
  setQuality(tier), stats() → { fps, drawCalls, triangles, frameMs },
  resize(),
  dispose(),
}
```

The renderer subscribes to the bus itself, for particles, ring pulses, milestone camera moves, splashes and so on.

### 4.2 Materials factory (`src/render/materials.js`)

`createMaterials(THREE, settings) → mats`:
- `mats.toon(color, { rim=true, emissive, map, vertexColors, transparent, opacity, side, flatShading })`: the soft storybook toon material (cached per params).
- `mats.sway(color, { strength, frequency, vertexColors })`: toon plus vertex wind sway for foliage, flags and bunting. Uses `mats.uniforms.time` and `mats.uniforms.wind`.
- `mats.water({ shallow, deep, foam })`: the animated water surface.
- `mats.outline(mesh, thickness)`: adds an inverted-hull outline child (animals and key props only).
- `mats.glow(color)`: an unlit additive material for rings, sparkles and data lines.
- `mats.uniforms`: `{ time, wind, sunDir, tint }`, shared and updated each frame by the renderer.

### 4.3 Who builds which meshes

| Thing | Built by | API |
|---|---|---|
| Player animals | Animals | `createAnimalView` |
| Critter NPCs (pigeons, Gerald, toucan, cow...) | Animals | `createCritterView` |
| Items (catalogue), scenery (`src/worlds/ids.js` SCENERY), terrain, water bodies, humans (cast and crowd, `HUMANS`), Packet | World-meshes | `src/worlds/meshes/index.js`: `buildItemMesh(THREE, mats, typeId) → Object3D`, normalised so its largest horizontal extent is 1 (render scales it by `item.size`), sitting on y = 0, facing +Z, with height in proportion to `item.height / item.size`. `buildSceneryMesh(THREE, mats, id, params?) → Object3D`, at the real-metre dims listed in `SCENERY`. `buildScenery(THREE, mats, world) → { group, update(dt, simState), dispose() }`, which builds the terrain from `heightAt`/`surfaceAt` (vertex colours by surface), the water bodies (`mats.water`, sea level following the tide formula), every `world.scenery` entry (instanced when repeated) and the skyline backdrops. `buildHuman(THREE, mats, kind) → { object3d, update(npc, dt) }`, at real scale (about 1.75 m), playing `NPC_ANIMS` from `npc.anim` |
| Engine: scene, lights, sky, fog, water shader, instancing, particles, camera, post, floating text, title and showroom staging, photo mode, clips | Render | everything in §4.1 |

Render instances items by type (`InstancedMesh` per type, built from `buildItemMesh` geometry) and syncs transforms from `sim.state.items` each frame, interpolating `px→x` by alpha.

## 5. Worlds (`src/worlds/`: World-data owns the data, World-meshes owns `meshes/`)

### 5.1 Catalogue (`src/worlds/catalogue.js`, Node-importable)

```js
export const CATALOGUE = { flipflop: ItemType, ... };
ItemType = { id, nameKey: 'item.<id>.name', journalKey: 'journal.<id>',
  size,          // gobble size in metres (characteristic diameter)
  height,        // visual height in metres (for stacking/colliders)
  worlds: ['w1'] | ['all'],
  food: bool, tier: 0..5, value: biccies, shape: 'circle'|'triangle'|'square'|'star',
  mass: 0.1..10 (wobble and tumble feel), recurring: bool, goldenOf?: id }
```

### 5.2 World (`src/worlds/index.js` exports `WORLDS` (array, in order), `getWorld(id)`, plus `src/worlds/w1-copacabana.js` ... `w5-marcoverse.js`)

```js
{
  id: 'w1', index: 1, nameKey, introKey, outroKey,
  music: 'w1', ambience: 'beach',
  palette: { skyTop, skyBottom, horizon, fog, fogNear, fogFar, sun, sunIntensity, ambient, ground, accent, water, waterDeep, foam, outline },
  timeOfDay: { start, end },     // 0..1 fraction of a day across the level (0.25 = 6am, 0.5 = noon, 0.75 = 6pm)
  bounds: { minX, maxX, minZ, maxZ },
  spawn: { x, z, yaw },
  heightAt(x, z) → y,            // pure, deterministic, cheap (called a lot)
  surfaceAt(x, z) → surface id,
  water: [ { kind: 'sea'|'pond'|'river'|'loch', level, rect?: {minX,maxX,minZ,maxZ}, tide?: { amp, period } } ],
  // sea level at time t = level + amp * sin(TAU * t / period). Render uses the same formula.
  colliders: [ { kind: 'box', x, z, w, d, h, rot, pass? } | { kind: 'cyl', x, z, r, h, pass? } ],
  scenery: [ { mesh, x, z, rot, scale, y? } ],     // non-gobble-able, visual only (colliders listed separately)
  items: {
    anchors: [ { type, x, z, rot?, golden?, hidden?, flag? } ],   // hand-placed
    fill: [ { types: [..], count, region: { minX,maxX,minZ,maxZ } | { x, z, r } , avoidWater?: true } ],  // seeded
  },
  zones: [ { id, x, z, r } ],
  hazards: [ { kind, ...params } ],
  cast: [ { id, speaker, kind: 'human'|'critter', mesh, x, z, yaw, behaviour, params } ],
  crowd: [ { kind, x, z, yaw, behaviour, params } ],
  flocks: [ { kind, count, x, z, r } ],
  activities: [ { kind: 'fetch'|'herding'|'sniffTrail'|'sitStay', x, z, params } ],
  eggs: [ Egg ],
  goals: { start, goal, stretch, timer, par, growthK, milestones: [m1, m2, ...], star3: { kind: 'noHazards'|'collectAll'|'golden'|'combo'|'par', type?, count? } },
  weather: ['clear', 'rain', ...],     // the sim picks one per run from the seed
  golden: { type, eggId },
}
```

### 5.3 Eggs (data plus small functions, Node-importable)

```js
Egg = {
  id: 'C1', world: 'w1', nameKey: 'egg.C1.name', descKey: 'egg.C1.desc', golden?: itemType,
  init?(ctx),               // once at sim start
  onEvent?(ev, ctx),        // every sim event (gobble, bark, playBow, sig, idle, land, splash...)
  tick?(ctx, dt),           // every tick (keep it cheap; early-out on flags)
}
ctx = {
  state,                    // sim.state (read-only)
  player,                   // sim.state.player
  species,                  // Species
  worldId, rng,             // forked per egg
  found(),                  // marks this egg found (once), emits EV.EGG
  isFound(),
  flag(key, value?),        // get/set a per-run flag
  zone(id) → { inside, time },
  stillTime(),              // seconds the player has been stationary
  dist(x, z),               // 2D distance from player
  spawnItem(type, x, z, { golden }) → index,
  revealItem(flag),         // un-hides anchors marked hidden with this flag
  say(speaker, key, vars?), // emits EV.SAY at that speaker's position
  buff(kind, seconds),      // 'tea' | 'wobble' | 'speed' | 'bighead'
  npc(id) → npc|null,       // live npc record (may set anim, mood)
  setNpcAnim(id, anim),
  emit(ev),                 // any extra event
}
```

## 6. Dialogue (`src/dialogue/`, Node-importable)

```js
createDirector({ rng, settings, bus }) → {
  onLine(fn),               // fn(Line)
  onEvent(ev, ctx),         // ctx = { state, worldId, speciesId, playerName }
  tick(dt, ctx),
  reset(worldId),
}
Line = { speaker: 'gerald'|'marco'|'kev'|'ze'|'pru'|'packet'|'player'|'narrator'|<npc kind>,
  text, sub?: string /* English under pt-BR */, lang: 'en-GB'|'pt-BR',
  anchor: 'player' | npcId | { x, y, z },
  style: 'chatter'|'thought'|'item'|'big',
  ttl, voiceId?: string /* recorded clip key */, blip: { pitch, wave } }
```

`main.js` routes each `Line` to `renderer.floatingText.add(line)` and `audio.say(line)`. Banks live in `src/dialogue/banks/<speaker>.js` (25+ throwaway lines per speaker, tagged by event).

## 7. Audio (`src/audio/`)

```js
createAudio({ settings, bus, assets }) → {
  unlock(),                       // call on the first user gesture
  music(id|null),                 // 'title'|'w1'..'w5'|'zoomies'|'end'|null, crossfades
  sfx(id, { pitch, gain, pan, x, z }),
  species(voiceId, kind, opts),   // kind: 'bark'|'happy'|'sad'|'excited'|'sniff'|'yawn'|'gulp'|'sig'
  say(line),                      // blip voice, or a recorded clip if Assets has voice/<voiceId>.mp3
  tick(dtReal, simState, listener /* {x, z, yaw} */),
  levels() → { musicDb, voiceDb, sfxDb },   // measured, for the honesty report
}
```

Audio subscribes to the bus itself and maps events to sounds (gobble pop pitch from `combo`, milestones, bumps, UI ticks via `ui.*` events such as `{type: 'ui', sound: 'tick'|'select'|'back'|'whoosh'|'count'|'star'|'buy'}`).

## 8. Meta (`src/meta/`, Node-importable) and Input (`src/input/`)

```js
createProfile(storage) → {
  data,                                    // serialisable snapshot
  save(),
  // animals
  isUnlocked(speciesId), unlockedSpecies(), unlockHint(speciesId) → string key,
  getLook(speciesId) → Look, setLook(speciesId, look),
  getName(speciesId) → string, setName(speciesId, name),
  lastSpecies, setLastSpecies(id),
  // worlds
  isWorldUnlocked(worldId), stars(worldId) → [b,b,b], best(worldId) → { size, time },
  // collection
  journal: { has(type), count(worldId?), total(worldId?), pct(worldId?), golden(type) },
  eggs: { has(id), count(worldId?), total(worldId?) },
  // economy
  biccies, canAfford(price), owns(cosmeticId), buy(cosmeticId) → bool,
  // run hooks
  onRunEvent(ev, run) → derived events [],   // e.g. journalNew, achievement, unlock
  finishRun(result, run) → { biccies, newUnlocks: [], achievements: [], records: {} },
  // modes
  daily(date?) → { key, seed, worldId, speciesId, modifier, specialItem },
  dailyDone(key), streak,
  codes: { check(buffer) → { code, modifier } | null },   // title-screen words and the Konami sequence
  modifiers, setModifier(id, on),
  ghost: { save(worldId, samples), load(worldId) },
  stats, achievements: { list(), has(id) },
  settingsNote?: never,                      // settings live in core/settings, not here
  reset(),
}
createInput({ element, settings, bus }) → {
  poll() → Raw,        // once per sim tick; edges latched since the last poll
  consumeLook() → { dx, dy },   // once per frame for the camera
  onText(fn),          // typed characters (for title codes); fn(char)
  onKonami(fn),
  onMenu(fn),          // fn('up'|'down'|'left'|'right'|'confirm'|'cancel'|'tabNext'|'tabPrev') from keyboard arrows, gamepad d-pad/stick/A/B/bumpers; UI uses it for focus navigation
  device,              // 'kb'|'pad'|'touch'
  setEnabled(bool), rebind(action, code), bindings(),
  touch: { setVisible(bool) },   // the signature button is drawn by input/touch.js
}
Raw = { moveX, moveY /* +y = forward */, sprint, jump, jumpHeld, sig, sigHeld, bark, barkHeld,
        pause, photo, confirm, cancel, menuX, menuY }
```

## 9. UI (`src/ui/`) and the app API

`main.js` (lead) builds an `app` object and passes it to `createUI({ root, app })`:

```js
app = {
  GAME, bus, settings, profile, input, audio, renderer, t,
  data: { SPECIES, SPECIES_ORDER, WORLDS, CATALOGUE, COSMETICS },
  state,            // getter: current sim.state or null
  run,              // getter: { worldId, speciesId, mode, seed, modifiers, name } or null
  paused,           // getter
  startRun({ worldId, speciesId, mode, seed?, modifiers? }),
  restartRun(), quitRun(), pause(), resume(),
  showScene(kind, params),    // forwards to renderer.showScene
  enterPhoto(), exitPhoto(), screenshot(), saveClip(),
  uiSound(name),              // emits {type: 'ui', sound}
}
createUI({ root, app }) → {
  show(screen, params),       // 'title'|'play'|'worlds'|'animals'|'dressing'|'comic'|'hud'|'pause'|'settings'|'journal'|'species'|'shop'|'achievements'|'stats'|'end'|'photo'|'daily'
  current,
  frame(dtReal, simState),    // per animation frame (HUD numbers, springs)
  onEvent(ev),                // UI also subscribes to the bus itself; this is optional
}
```

The UI owns all DOM except floating text (render) and the touch controls (input). It injects its own CSS (`src/ui/styles.css` is imported as text by esbuild).

## 10. Ownership

| Area | Owns |
|---|---|
| Lead | `src/core/**`, `src/assets/**`, `src/main.js`, `src/index.html`, `tools/build.mjs`, `tools/screenshots.mjs`, `test/core/**`, `SPEC.md`, `CONTRACTS.md`, `README.md`, `REQUESTS.md` (everyone may append), `.github/**`, `CNAME`, `package.json` |
| Sim | `src/sim/**`, `test/sim/**`, `tools/sim.mjs` |
| World-data | `src/worlds/*.js` (catalogue, ids, w1..w5, eggs, copy; everything except `meshes/`), `test/worlds/**` |
| World-meshes | `src/worlds/meshes/**`, `tools/mesh-preview.mjs`, `test/worldmeshes/**` |
| Animals | `src/animals/**`, `tools/animal-preview.mjs`, `test/animals/**` |
| Render | `src/render/**`, `test/render/**` |
| UI | `src/ui/**`, `test/ui/**` |
| Audio and dialogue | `src/audio/**`, `src/dialogue/**`, `test/audio/**`, `test/dialogue/**`, `VOICELINES.md` |
| Meta and input | `src/meta/**`, `src/input/**`, `test/meta/**`, `test/input/**` |
