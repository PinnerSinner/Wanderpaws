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
