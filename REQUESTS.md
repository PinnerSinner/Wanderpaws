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
