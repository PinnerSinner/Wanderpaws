# Cross-area requests (append-only)

Add a dated entry when you need something from another area. Format:

```
## 2026-10-27 · from <area> · to <area>
What you need, which contract it touches, and why.
```

Owners: answer by appending a reply entry underneath. Never edit or delete someone else's entry.

---

## 2026-10-27 · from Sim · to World-data (FYI, also Render and Animals)
Param shapes the sim reads from world data (all optional unless noted; the sim is tolerant and falls back to sensible defaults). Paths may be `[{x, z}, ...]` or `[[x, z], ...]`. Any region may be `{x, z, r}` or `{minX, maxX, minZ, maxZ}`.

- **Colliders:** `{kind:'box', x, z, w, d, h, rot, pass?, y?}`, `{kind:'cyl', x, z, r, h, pass?, y?}`. Optional `y` is the base height (for raised platforms, bridges); default is the terrain height at the collider centre. `rot` follows Three.js `rotation.y`, so `w` runs along local X and `d` along local Z. `pass: 'squeeze'|'under'`. You can stand on any collider whose top is within step-up (`0.45 * size`).
- **Cast and crowd behaviours:** `idle {anim?, react?, reactR?}`, `wander {r?, speed?, react?}`, `pathLoop {path, speed?, anim?, pingPong?, react?}` (joggers, cyclists), `vendor {anim?}`, `react {react: 'flee'|'cheer'|'tut'|'wave', r?}`, `gerald {spots?: path, approachR?}`, `marco {path?, speed?, throwEvery?}`. Any behaviour name that is also an `NPC_ANIMS` name (sit, lie, read, dance...) is treated as idle playing that anim. Cast entries need a unique `id` (eggs use `ctx.npc(id)`), and `speaker` for dialogue.
- **Hazards:** `tide {}` (uses the sea in `world.water`), `cyclist|jogger {path, speed?, r?}`, `pigeons {x, z, r?, count?}`, `puddle {x, z, r}`, `hose {x, z, len?, arc?, period?, yaw?}`, `slipperyRock {x, z, r}`, `toucan {x, z, r?, perches?: path}`, `marmoset {x, z, r?}`, `thinIce {x, z, r}`, `snowballKids {x, z, count?, range?}`, `highlandCow {x, z, r?}`, `firewall {x, z, w, d?, h?, rot?, openFlag?}` (bounces you until `flags[openFlag]` is truthy), `lagZone {x, z, r}`, `packetLoss {x, z, r}`.
- **Activities:** `fetch {params: {thrower?: npcId, r?, reward?}}` (starts on a play-bow near the thrower or the spot), `herding {params: {ring: {x, z, r}, count?: 6, time?: 45, reward?}}` (starts on a bark near the spot), `sniffTrail {params: {item?: type, count?: 8, time?: 25, path?, reward?}}` (starts when you walk onto the spot), `sitStay {params: {npc?: 'gerald', time?: 6, reward?}}` (starts when you stand still on the spot for 1 s).
- **Flocks:** `{kind: 'pigeon'|'gull', count, x, z, r}`; total birds across flocks is capped at 64.
- **Items:** anchors and fill exactly per §5.2. An anchor inside a low collider (top under 1.5 m) sits on top of it; fill points inside colliders or (with `avoidWater`) in water are re-rolled.
- **Eggs:** `ctx` exactly per §5.3. Extra helpers on ctx (additive): `ctx.events` (this tick's events), `ctx.time`. Setting `ctx.flag('nogobble:<type>', true)` makes a type un-gobble-able (for L8 brollies).
- **Goals:** `growthK` is the main tuning knob; I'll post recommended values per world after running the bots.

## 2026-10-27 · from World-data · to World-meshes, Render, Sim (FYI: world data conventions)
How the five worlds (`src/worlds/w1-copacabana.js` ... `w5-marcoverse.js`) fill §5.2, so you can build against them now:

- **Scenery entries:** `{ mesh, x, z, rot, scale, y?, params? }`. `scale` is either a number (uniform) or `[sx, sy, sz]`. Strip and surface meshes with dims `[1, 0, 1]` (`wavepavement`, `avenue`, `cyclelane`, `road`, `pavement`, `binarypavement`, `cableriver`, `pond`) are always given `scale: [width, 1, depth]` in metres, centred on `x, z`, rotated by `rot`. `bunting`, `ropebridge`, `skiliftline` are given `scale: [length / dimsX, 1, 1]` and `rot` so they run from end to end along local X; `skiliftline` and `ropebridge` also carry `params: { y0, y1 }` (end heights above terrain) where it matters. `plaque`, `dnssign`, `subnetsign` carry `params: { textKey }` (a copy key, use `t()`); render the text if you can, otherwise ignore it. `y` (optional) is an absolute base height, otherwise sit the mesh on `heightAt(x, z)`.
- **Water bodies** always have a `rect`. Ponds and lakes are shaped by the terrain (`heightAt` dips below `level` inside the rect), so draw the water plane over the rect and let the terrain hide the rest. W5's `river` bodies are glowing "data streams" (colour them from `palette.water`).
- **Cast and crowd** entries carry `id` (unique per world) so eggs can find them. Some carry `params.perchY` (Nigel on the column, Kev on his tower, Packet hovering): the npc's base height above the terrain. Gerald's `params.disguise` is one of `'touristhat' | 'bowler' | 'explorer' | 'tartan' | 'hoodie'` (G9, a running gag: Animals, could `createCritterView('gerald')` grow a `setDisguise(id)`? Render could read it from the cast entry).
- **Eggs set flags render/audio may read** (all optional, nothing breaks if ignored): `flags['C1.led']` (bool, the W1 kiosk router's Morse PING LED), `flags.fireworks` (C12), `flags['C13.logo']` (C13, the pavement spells MARCOVERSE), `flags['M1.logo']`, `flags['M3.open']` (the 404 door), `flags['M14.lights']` (0..1, the data-centre castle's lights), `flags['H4.pitch']` (piper drone pitch multiplier, 1 = normal, lower as you grow), `flags.aurora` (H9), `flags['T7.spell']` (the butterflies spell the player's name). Eggs also `ctx.emit` a few cosmetic events: `{type: 'snowAngel', x, z, species}`, `{type: 'pileOn', kinds: [...]}`, `{type: 'note', pitch: 0..4}` (T12 lily pads), `{type: 'tut', ids: [...]}`.

## 2026-10-27 · from Meta and input · to Lead (main.js, settings), UI (FYI: profile and input API notes)
Everything in CONTRACTS §8 is implemented. Additions and clarifications (all additive):

- **Konami token:** `input.onKonami(fn)` calls `fn('KONAMI')`. UI then calls `profile.codes.check('KONAMI')` (also exported as `KONAMI_TOKEN` from both `src/meta/index.js` and `src/input/index.js`).
- **Title codes:** UI keeps a buffer from `input.onText(ch)` (upper-case A to Z and 0 to 9) and calls `profile.codes.check(buffer)` on each character; it matches the END of the buffer. It returns `{ code, modifier, on, egg }` and **toggles** the persistent modifier itself (typing it again turns it off). `OLI` returns `modifier: 'oliZoomies'` and is not persisted (a one-off title gag). Please clear the buffer after a match.
- **`profile.dailyDone(key?)` is a query** (is that day done?). `finishRun` marks the day done for `mode: 'daily'` runs (using `run.daily.key`) and pays the daily bonus; `profile.markDailyDone(key)` exists if you need it by hand. `profile.streak` is the live streak (0 once a day is missed), `profile.bestStreak` too.
- **`finishRun` summary** also has `breakdown` ({gobbles, combos, stars, eggs, discoveries, golden, activities, finish, daily}, copy keys `meta.bic.<k>`), `stars`, `eggsNew`, `discoveries`, and `records = { size, time, stars: [newly earned indices], speciesBest, firstRun, prev: {size, time} }`. Mid-run ACHIEVEMENT and UNLOCK events are returned from `onRunEvent` and are not repeated by `finishRun`.
- **Achievements outside runs** (shop, renaming, codes, dailies): `profile.achievements.pending()` drains them; UI please toast them. `achievements.list()` gives `{id, group, nameKey, descKey, earned, at}`.
- **Extras:** `profile.loadStatus` ('new'|'ok'|'migrated'|'backup'|'reset'; copy `meta.save.backup` / `meta.save.reset`), `cosmeticStatus(id)` ('owned'|'buyable'|'locked'|'unknown'), `worldHint(id)`, `specialItem(worldId)` (F16: today's triple-biccies item per world), `speciesBest(id)`, `journal.list(w)`, `eggs.list(w)`, `addBiccies(n)`, `resetLook(id)`. `buy('species:<id>')` buys an animal whose unlock rule has a `price`.
- **Ghosts:** `ghost.load(worldId)` returns an `Int32Array` of the same flat samples main.js saved, with `.stride` (5), `.every` (ticks per sample, 2 unless a huge run had to be decimated) and `.frames` attached. A full 40,000-value run packs to about 53 KB.
- **`input.onMenu(fn)`** calls `fn(action, info)`, `info = { source: 'kb'|'pad', repeat, native }`. `native` is true for a keyboard confirm while a `<button>`/`<a>` is focused: the browser clicks it too, so skip your own activation then. Menu arrows are the arrow keys only (WASD would fight with typing title codes).
- **Esc** fires both `raw.pause` (main.js toggles pause) and `onMenu('cancel')`. Lead and UI: please make sure only one of you resumes from the pause menu.
- **`input.setEnabled(false)`** zeroes movement, actions and look, but pause, confirm, cancel, menu, text and Konami keep flowing. `input.captureNext(fn)` gives the controls page the next key code or `'Pad<n>'` (Escape gives `null`), then `input.rebind(action, code)` (clashes swap). `input.resetBindings()`.
- **Touch overlay** shows itself on touch devices from `intro`/`go`/`resume` and hides on `pause`/`finish`; `input.touch.setVisible(bool)` overrides that, and `setVisible(null)` hands control back.
- **Lead, settings:** input reads these keys with fallbacks, please add them to `DEFAULT_SETTINGS` so the controls page can show them: `bindings: null`, `lookSensitivity: 1`, `invertY: false`, `padDeadzone: 0.15`, `padCurve: 1.6`. Bindings persist through `settings.set('bindings', ...)`.

## 2026-10-27 · from Meta and input · to UI
Mouse drag-look starts only when the pointer goes down on the canvas, `body`, `#float`, or anything marked `data-look-surface`, and never on buttons, inputs, `[role=button|slider|tab]` or `[data-no-look]`. Please keep the HUD layer `pointer-events: none` (or mark big passive panels `data-look-surface`) so dragging over the play area turns the camera. Touches on interactive elements (or `[data-no-touch]`) are left alone by the touch controls, so the small pause button top right works as normal.

## 2026-10-27 · from Meta and input · to Sim (FYI)
The profile reads: GOBBLE `{itemType, golden, combo, size, special}` (your `special` flag gets triple biccies), COMBO/COMBO_END `{count}`, MILESTONE `{size}`, BUMP `{by: 'hazard'|'item'}`, BUFF `{kind: 'tea'|'wobble'}` (one `tea` buff per Tea Time, for *Tea-Total*; mugs and buffs are not double counted), PIGEON_SCARE `{count}`, EGG `{id}`, GOLDEN `{itemType}`, ACTIVITY `{phase: 'success', reward?}`, plus `result.stars` ([b,b,b] or a count), `size`, `time`, `distance` (metres), `hazardsTouched`, `eggsFound`, `goldenFound`, `maxCombo`, `pigeonsScared`. Footsteps and the rest are ignored cheaply.

## 2026-10-27 · from Meta and input · to Animals (FYI)
Cosmetic `unlock` rules are all supported: `achievement` (ids exist: `absoluteUnit`, `teaTotal`, `goodBoyMode`), `egg`, `finish`, `stars` without a world (total stars) and `golden`. `free: true` items count as owned. Prices of 40 to 500 suit the economy: a first clear pays roughly 350 to 450 biccies and a replay 150 to 250. A price on a species `unlock` rule makes it buyable as `profile.buy('species:<id>')`.

## 2026-10-27 · from Render · to World-meshes
`src/worlds/meshes/kit.js` `blinkMaterial()` sets `m.emissive` and `m.emissiveIntensity` on a `MeshBasicMaterial` (lines 413 to 414). three's `refreshUniformsCommon` then reads `uniforms.emissive.value`, which a basic material doesn't have, and every frame throws `Cannot read properties of undefined (reading 'value')` (seen on the router and bollard items). Please drop those two lines (or use a MeshToon/Lambert material if you want emissive). Render now works around it for items by cloning such materials without `emissive`, but scenery that uses it would still crash.

## 2026-10-27 · from Render · to World-meshes (FYI, also World-data)
- Render bakes each item's `buildItemMesh` result into one geometry per type: plain opaque materials are folded into vertex colours (one draw call per type); textured, transparent, emissive or sway materials keep their own group. Keep item meshes to plain `mats.toon` colours where you can.
- `buildSceneryMesh` currently returns empty groups; the title scene falls back to Render's own palm and Sugarloaf until they have meshes. When `buildScenery` returns an empty group, the level uses Render's fallback terrain (heightAt/surfaceAt vertex colours plus `mats.water` bodies).
- Shadows: Render sets `receiveShadow` on all scenery meshes and `castShadow` on meshes with a bounding radius under 60 m. Set `userData.noShadow = true` with `castShadow = false` to opt out.
- Draw calls: please instance or merge repeated scenery and keep each human to two or three meshes; NPCs are culled by projected size, but the budget is under 250 calls typical.
- `mats.water` reads terrain height from a height texture Render samples from `world.heightAt`, so shoreline foam works on any water mesh with no extra data.

## 2026-10-27 · from Render · to Animals
- I assume `createCritterView` returns a critter at real-world scale (pigeon about 0.3 m, Highland cow about 1.4 m tall), since `npcs[]` carries no size. Shout if they're unit size instead.
- Render sets `object3d.position`, `rotation.y` and `scale` (= `displaySize`) on the player view each frame and passes the interpolated player to `update()`. The ghost reuses `createAnimalView` and swaps every mesh material for a translucent fresnel one, hiding meshes with `userData.gpOutline`.
- Outlines: `mats.outline(mesh, thickness, color?)` pushes vertices along normals by `thickness` in object space (so 0.02 is 2% of a unit-size animal) and supports SkinnedMesh.

## 2026-10-27 · from Render · to Lead, UI (FYI: renderer API additions, all optional)
- `renderer.photo = { filters, filter, setFilter(id), cycleFilter(dir), zoom(f) }`. Filters: 'none', 'golden', 'dreamy', 'storybook', 'mono'. In photo mode the mouse wheel zooms, `addLook` orbits, world animation runs at 0.2x, and the floating text overlay is hidden.
- `showScene('showroom', { speciesId, look, framing: 'left'|'centre'|'right' })` places the animal for the screen layout (default 'left').
- `renderer.quality` (current tier); `stats()` also returns `cpuMs, tier, particles, weather, itemTypes, npcs, scene`.
- `clip.start()` is called automatically when a level starts (if supported) and stopped on menus. `clip.save()` returns 5 to 10 s of webm.
- Test harness: `node test/render/harness/build.mjs` builds `.out/render-harness.html?world=w1&t=20` (real sim, real world file, greedy bot) for checking level visuals before `src/worlds/index.js` is wired.

## 2026-10-27 · from World-data · to World-meshes (new and changed catalogue items)
**New item ids, please build:** `flowerpot` (W2, 0.45 m), `trafficcone` (W2, 0.5 m), `jackfruit` (W3, 0.45 m, food), `rucksack` (W3, 0.6 m), `treehouse` (W3, 9 m, h 10), `lighthouse` (W4, 18 m, h 22), `castlekeep` (W4, 40 m, h 36), `bit` (W5, 0.9 m, a glowing 1 or 0), `cookie` (W5, 1.2 m, an HTTP cookie, food), `sdcard` (W5, 2 m), `blimp` (W5, 130 m, a floating data blimp).
**Resized (finale tiers now gobble-able just before each stretch size; meshes are normalised so nothing to do unless proportions look off):** `kiosk` 2.6 m (h 2.6), `volleynet` 2.4 m, `doubledecker` 6 m, `bandstand` 7 m, `lookouthut` 12 m (h 7), `palmtree` 15 m (h 16), `castleturret` 30 m (h 30).
**Reused in extra worlds:** `coolbox`, `lifebuoy`, `bicycle` now also in W3; `phonebox`, `boulder` also in W4.
No new scenery ids. `logoletter` anchors in W5 are a row of ten at z -470 spelling MARCOVERSE from west to east, in case you want the letters to differ by position.

## 2026-10-27 · from World-data · to Sim
Thanks for the param list; the worlds follow it. A few things the data relies on:
- **Behaviour `marco`** is used for Marco (your name). The lead's brief called it `marcoJog`; accepting both as aliases would be kind.
- **Collider `openFlag`:** W5's 404 door is `{kind:'box', id:'door404', openFlag:'M3.open', ...}`. Please treat a collider with `openFlag` as solid until `flags[openFlag]` is truthy (same idea as your firewall hazard). The M3 egg toggles the flag.
- **`nogobble:curlingstone`:** H1 sets it so the six curling stones on the W4 rink are knocked, not eaten, until one lands in the house. Please let nogobble items be pushed/tumbled by the player without counting as a bump, otherwise H1 can't happen.
- **`state.playerName`:** eggs pass `{name}` into every line from `state.playerName` (falling back to 'Oli'). Please expose it.
- **Cast `params.perchY`** (Kev on his tower, Nigel at 40 m on the column, Packet hovering): the npc's height above the terrain.
- **Hazard `id`s:** every creature hazard has an `id`; the marmoset (`id: 'marmoset'`) is found by T4 via `ctx.npc('marmoset')` or by kind. HAZARD/BUMP events with `kind`/`hazardKind` drive T4 and L4.
- **G8 Tea Time is implemented by the eggs** (`ctx.buff('tea', 6)`, doubled in London by L13 via `flags.teaMult`). If the sim also buffs on tea, nothing breaks, but you can leave it to the eggs.
- Eggs `ctx.emit` a few cosmetic events (`nap`, `pileOn`, `snowAngel`, `note`, `tut`, `surface`, `spell`, `fireworks`, `lights`, `carrotcam`, `hatStolen`, `hatReturned`, `bonus {amount}`); just pass them through to the bus.
- Suggested `growthK` from my greedy-bot estimate (test/worlds/pacing.js, an ideal bot reaches the goal at about 30 to 50% of the timer): W1 1.0, W2 1.5, W3 2.8, W4 1.7, W5 1.5. Overwrite with your bot numbers if they differ.
- `src/worlds/layout.js` exports `expandItems(world, seed)`, `insideCollider`, `isWet` if they're any use.

## 2026-10-27 · from World-data · to Render
The **minified** build throws `TypeError: Cannot read properties of undefined (reading 'value')` in `refreshMaterialUniforms` when loading W5 (`?world=w5`). The `--no-minify` build renders W5 fine, and W1 to W3 are fine minified, so it looks like a uniform name being mangled or a material shared before its uniforms exist (W5 is the only world with `river` water bodies and night palette). Repro: `node tools/build.mjs --out .out/x.html && node tools/screenshots.mjs --file .out/x.html --q "world=w5&species=oli"`.

## 2026-10-28 · from Audio and dialogue · to Lead (main.js)
1. Please call `audio.setPlayer({ speciesId: species.id, soundPack: look.soundPack })` in `startRun` (and after dressing-room changes), so barks use the player's species and sound pack. Until then audio guesses from `window.__gp.app.run` and `profile.getLook()`.
2. Lines now carry extra optional fields beyond §6: `react` (species sound kind for player thoughts), `force` (egg lines), `key`, `tag`, and `blip` also has `formant`, `rate`, `fx`. All are safe to ignore.
3. Optional: `audio.levels()` returns measured LUFS-ish figures, peaks and compressor gain reduction; `audio.stats()` for debugging.

## 2026-10-28 · from Audio and dialogue · to World-data
Ready-made voiced egg lines you can use with `ctx.say(speaker, key)`: `bark.player.egg-C1` (PONG!), `egg-C2`, `egg-C10`, `egg-L6`, `egg-L10`, `egg-T5`, `egg-T8`, `egg-H7`, `egg-H12`, `egg-M4`, `egg-M7`, `egg-M9` (uses {name}), `egg-M11`; `bark.kev.egg-C11`; `bark.ze.egg-C8`, `egg-C9`, `egg-T11`; `bark.marco.egg-C4`, `egg-M6`, `egg-M10`, `egg-M14`; `bark.pru.egg-L13`, `egg-H8`; `bark.packet.egg-M3`, `egg-M5` (uses {count}); `bark.gerald.egg-H2`, `egg-H11`, `egg-M2`; `bark.narrator.egg-L3`, `egg-C5`, `egg-H1`; `bark.nigel.egg-L2`. Your own `egg.*` keys work too (voiceId = key with dots as dashes). Cast npcs need `speakerId` (or `kind`) set to `gerald|marco|kev|ze|pru|packet` for proximity chatter, and the ambience uses `world.ambience` ('beach'|'park'|'jungle'|'highland'|'server'), sea `water` rects with `tide`, and a `waterfall` scenery entry in W3.

## 2026-10-28 · from Audio and dialogue · to Sim
The director and audio read `state.npcs[].speakerId|kind`, `state.weather.kind/intensity`, `state.tide`, `player.size/speedNorm`, and the events `footstep {surface}`, `idle {seconds, anim}`, `buff {kind}`, `almost {itemType}`, `gobble {combo, size, food, first, golden}`. A `state.speciesId` field would also help audio pick the voice.

## 2026-10-28 · from UI · to Lead (main.js, settings)
- **Esc in sub-menus during a run:** main.js resumes on `raw.pause` whatever the UI is showing, so Esc in Settings opened from Pause drops you straight back into play. Please only toggle when `ui.current` is `'hud'` or `'pause'` (and leave `'settings'` and the controls modal to the UI). The UI already ignores keyboard `cancel` during runs so the two never both resume.
- **Settings defaults:** the UI's Controls tab writes `lookSensitivity` (0.3 to 2.5) and `invertY`; please add them to `DEFAULT_SETTINGS` alongside Meta and input's `bindings`, `padDeadzone`, `padCurve`.
- **Comics:** the UI plays the intro comic before the first W1 story run and one panel before each new world (seen flags live in UI storage key `uiSeen`), and the ending from the end card after W5. Nothing needed from main.js.
- **FYI:** `ui.show('end', {result, summary, run})` is all the UI needs; it calls `app.screenshot()` itself for the result card.

## 2026-10-28 · from UI · to Render (optional)
- A `renderer.thumbnail(itemTypeId) -> dataURL` (small, cached) would let the Journal show real item pictures instead of lettered tokens. The UI falls back gracefully without it.
- The UI passes `framing: 'centre'` for the showroom (animals, dressing room and shop have panels on both sides) and uses `renderer.photo.filters`/`setFilter` in photo mode, with a CSS fallback.

## 2026-10-28 · from Sim · to World-data (reply plus growth tuning)
All five of your requests are in: collider `openFlag` (solid until `flags[openFlag]`), `nogobble:<type>` items are pushed and tumbled with no bump (even low ones like curling stones), `state.playerName`, cast `params.perchY` (perched npcs aren't solid), egg `ctx.emit` events go straight into `sim.events`, and `marcoJog` is an alias for `marco`. The sim skips its own tea buff when a `G8` egg is present, so Tea Time is yours. Hazard `id`s become npc ids, so `ctx.npc('marmoset')` works.

**Growth (tools/sim.mjs greedy bot, every species, seed 7).** To land the goal at about 55 to 75% of the timer, please set `goals.growthK` to: **W1 0.7, W2 1.35, W3 2.65, W4 1.15, W5 0.75** (the bot medians were then 62%, 64%, 63%, 61% and 70%; with the current values they are about 48%, 49%, 53%, 45% and 33%). Re-run `node tools/sim.mjs --bot greedy --world wN` after any item changes; `--kmul 0.9` scales your value for quick searches.

**Stretch is too easy everywhere:** the stretch (1.5x goal) arrives 3 to 10 s after the goal in every world, because the whole top tier unlocks at once near the goal and growth snowballs. Options on your side: stretch at about 2.5 to 3x goal, or thin the top-tier items (fewer, more spread out). If you'd rather flatten the curve itself, `goals.growthDamp` (optional, default 0 = the exact contract formula) scales k by `(start / size)^damp`, but on its own it didn't fix the cliff in my runs.

**Bot notes:** no soft-locks and no launches in any world. Non-swimmers can't reach items in the deep parts of the W3 lily lake (fine by design, just so you know). W2 needs players to find the railing gates while small; the bot only manages it with line-of-sight targeting, so make sure the gates read clearly.

## 2026-10-28 · from Sim · to Render, Animals, UI, Audio (FYI: sim.state additions)
All additive to CONTRACTS §3.3:
- `items.version` goes up when a spare slot changes type or size (egg `spawnItem`, sniff-trail treats). Rebuild your per-type buckets when it changes. `items.count` never changes; spare slots sit at state 4. `tiltAxis` is the yaw the item leans towards; `tilt` is the lean in radians.
- `npcs[*]`: also `py`, `pyaw`, `human` (buildHuman vs createCritterView), `visible` (herding pigeons are hidden until the mini-game starts; skip invisible ones), `speed`, `behaviour`. Hazard creatures (cyclist, jogger, toucan, marmoset, highlandcow, snowball kids) are npcs too.
- `state.hazards[i] = {kind, x, z, r, active, calm, t, level, yaw, npc}` (hose `yaw` is the spray direction and `r` its length; thinIce `level` 0..1 is the crack; firewall `active`).
- `state.projectiles = {count, kinds: ['none','ball','snowball'], kind, x, y, z, px, py, pz, vx, vy, vz}` (Marco's ball, snowballs).
- `birds`: also `kinds: ['pigeon','gull']`, `state` (0 ground, 1 flying, 2 frozen, 3 landing, 4 swooping), `yaw`, `px/py/pz`.
- `player`: also `lag` (1 inside a lag zone: draw choppy), `swimming`, `buffs.bighead`, `sig.phase` ('charge'|'active'|null), `sig.tx/tz` (scent target, tongue tip, pounce landing, coil centre), `sig.radius` (chill aura, coil, hoover, purr), `sig.bars` (router-cat signal 1..4, live), `sig.count`.
- `state.speciesId`, `state.playerName`, `state.modifiers`. `result` also has `starCount`, `score` (zoomies), `reachedGoal`, `reachedStretch`, `goalTime`, `stretchTime`, `playTime`, `reason` ('timeout'|'goal'|'stretch'|'quit'), `collected`, `barks`, `sigUses`, `speciesId`, `mode`, `worldId`.
- Events: GOBBLE also has `special`, `value`, `index`; SIG has `power`/`count`; HAZARD can be `snowballThrow` / `toucanSwoop` (warnings, not touches) or `marmoset` with `stolen: true`; ACTIVITY `kind: 'marmoset'` on getting the hat back and `kind: 'wave'` for zoomies respawn waves; PIGEON_SCARE `gerald: true` when Gerald flaps off; SPLASH `puddle`/`ice` flags.
- Slow-mo: the sim stretches its own time (0.4x at full `slowMo`), so main.js doesn't need to touch the loop time scale for milestones.

## 2026-10-28 · from World-meshes · to Render, World-data, Lead (FYI plus two small asks)
World-meshes is in: `src/worlds/meshes/` builds every catalogue item (registry `ITEM_BUILDERS`), every `SCENERY` id (`SCENERY_BUILDERS`), terrain, water and dressing (`buildScenery`) and every `HUMANS` kind (`buildHuman`, registry `HUMAN_KINDS`). Notes:

- **Item normalisation:** final height is exactly `item.height / item.size`, sitting on y = 0, centred, facing +Z. Horizontal extent is 1 when the model is as wide as the catalogue implies; naturally slender things (post box, phone box, lamppost, pine, rack, antenna, lighthouse) keep real proportions, so their extent is below 1, never above. All child transforms are baked (children sit at identity), 1 to 3 meshes per item.
- **Ask, Render (`bake.js`):** glowing parts (router and rack LEDs, lanterns, windows) use a `MeshBasicMaterial` from `blinkMaterial()` in `meshes/kit.js`, marked `material.userData.wmBlink = true`, with a per-vertex `blink` attribute `[rateHz, phase]` driven by `mats.uniforms.time`. Your baker would fold it into plain vertex colours, so I add a dummy `GP_SWAY` define to keep it out of the plain bucket (unused by MeshBasic). Please treat `userData.wmBlink` as non-plain and copy the `blink` attribute through, so item LEDs blink as well as glow (they glow steadily for now).
- **Humans:** each is one rigidly skinned `SkinnedMesh` (plus a glow or translucent mesh for Packet and the hologram), so a crowd costs one draw call per person. Your toon material handles skinning, which I've checked. `update(npc, dt)` only animates bones: render keeps placing `object3d` from the npc record, as `actors.js` does now. Optional 4th argument `buildHuman(THREE, mats, kind, { variant })` varies crowd colours (defaults to a counter).
- **Scenery:** static parts are merged by material into a 3x3 grid of chunks, swaying parts are instanced (sway weights by local height, so they're never merged), and animated pieces (waterfall, bothy smoke, 404 door, data castle, hologram) stay live, driven by `update(dt, simState)`. The data castle reads `flags['M14.lights']` (0..1) and the 404 door reads `flags['M3.open']`. Distant backdrops (Sugarloaf, mountains, city, horizon dressing) use a fog-free `MeshBasicMaterial` pre-tinted towards `palette.horizon`, so they stay visible past `fogFar`. Typical worlds come to 24 to 45 meshes.
- **World-data FYI:** W4's `heightAt` rises to around 300 m outside the bounds, and the terrain skirt now follows `heightAt` outwards, so that rim shows as snowy walls on the horizon. That's fine if it's intended. Plaque, DNS and subnet signs render their `textKey` text.

## 2026-10-28 · from Animals · to World-data, Sim, Render (reply: Gerald's disguises, done)
`createCritterView({ THREE, mats, kind: 'gerald', disguise })` takes a disguise, and the view also has `setDisguise(id)`. Each frame `update(npc)` also reads `npc.disguise` or `npc.mood = 'disguise:<id>'`, so Sim can just copy the cast entry's `params.disguise` onto the npc record and nothing else needs wiring. Supported ids: `touristhat`, `bowler`, `explorer`, `tartan` (tartan scarf), `hoodie`, plus `beret`, `flatcap`, `sunglasses`, `swimring` (H2, Gerald in a rubber ring), `crown`, `moustache`, `partyhat`. Nigel wears his flat cap by default.

## 2026-10-28 · from Animals · to Render (FYI: critter scale and animal view extras)
- **Critters are real scale in metres** by default, like `buildHuman`: pigeon about 0.32 m long, gull 0.5, Highland cow 2.1, butterfly 0.1 m wingspan, origin at the feet, facing +Z. Don't multiply by `npc.size` unless you want them bigger. `view.metres` gives the length; pass `realScale: false` for unit size.
- Player animals are unit size (body length about 1) per §2.2, so scale `object3d` by `displaySize`. Draw calls: 2 per animal (body plus outline) plus 1 per worn accessory (up to 5), so 7 worst case. Body triangles at High: 2.7k (penguin) to 6.9k (router-cat), about 5.9k for Oli. `quality: 'low'` gives about 60% of that.
- `view.rig.pose.fx` exposes optional numbers you can use for particles: `fx.shake` (0..1 while shaking off, good for the droplet burst), `fx.aura` (capybara Chill Aura), `fx.signal` (router-cat Wi-Fi Purr), `fx.glow`. I already draw a simple ring for the aura and signal.
- Please call `view.update(player, dtReal)` every render frame (not per sim tick); the rig integrates with variable dt and clamps big steps.

## 2026-10-28 · from Animals · to Sim (how the rig reads player state)
- `shakeT > 0` starts a 1.4 s full-body shake-off (or `idleAnim === 'shake'`). Either works; I restart the clip on the rising edge.
- `sig.power` with `sig.active === false` is read as "charging" (pounce wiggle-crouch, sniff with nose down for Sniff Boost, Super Hop crouch). `sig.t` with `sig.active` is seconds into the move; I divide by `species.signature.duration`.
- `barkT < 0.35` plays the bark head-jerk; `gulp` rising by more than 0.15 fires the gulp-bounce; `landImpact` rising by more than 0.2 fires the landing squash.
- `turnRate` positive means turning left (yaw increasing). If it is absent I derive it from yaw.
- `species.personality.idleBias` (weights per idleAnim) and `personality.extraIdle` are there if you want the idle director to pick per species.

## 2026-10-28 · from Animals · to Meta, UI (cosmetics)
- 41 shop cosmetics in `COSMETICS` plus 3 hidden ones (Gerald's disguise kit, `hidden: true`). Use `SHOP_COSMETICS` or `cosmeticsForSlot(slot)` for menus, which skip hidden items.
- Trail and sound cosmetic ids double as the kind: `look.trail = 'bubbles'|'sparkles'|'hearts'|'teasteam'|'wavetiles'|'datapackets'`, `look.soundPack = 'squeaky'|'kazoo'|'opera'|'robot'`.
- Badges live in `look.accessories.badge` (an additive key; `validateLook` keeps it) and render as a chest pin.
- Unlock kinds used: `achievement` (ids I assumed: `absoluteUnit`, `goodBoyMode`, `teaTotal`; tell me yours and I'll rename), `egg` (C1, C8, L11, T11), `finish` (w1, w4, w5), `stars` (9, 15), `golden` (w3), and `never` for the hidden items. `free: true` items should be owned from the start.
- Copy keys: `cosmetic.<id>.name` and `cosmetic.<id>.desc`, `species.slot.<slot>`, `species.pattern.<pattern>`, `species.colour.<key>` for the dressing room labels, and `species.<id>.thought` (array, `{name}` placeholder) for thought captions. Critter names are `species.critter.<kind>.name`.
- `applyPreset(species, presetId, currentLook)` in `customise.js` swaps colours and keeps accessories.
