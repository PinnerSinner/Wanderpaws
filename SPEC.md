# Gobblepaws: design spec (v0.1, for Marco's approval)

> Working title chosen by Marco: **Gobblepaws**. It lives in one constant (`src/core/game.js` exports `GAME = { name, slug, domain }`), so the page title, README, save keys (`gobblepaws.v1.*`) and copy all follow it. The repo is still `PinnerSinner/wanderpaws`. I'd rename it to `gobblepaws` (Settings → General → Repository name; GitHub redirects the old URL), but nothing breaks if you don't.

**How to use this doc.** Every feature, egg and animal has an ID (`F12`, `C3`, `A7`...). Reply with the ones you want binned or changed, for example "deny F31, F40, swap A10 for a fox", and anything you don't mention counts as approved. The **Phase** column says when it lands: **S** = first vertical slice, **L** = launch, **Later** = parked.

---

## 1. The pitch in one breath

You're Oli (or a cat, a capybara, a penguin...). Gerald the pigeon has nicked your tennis ball and legged it round the world. Chase him through five places, **gobbling up everything smaller than you**, growing from flip-flop height to the size of a data centre. Stuff wobbles, crowds cheer, tea is drunk. It looks like a picture book that's had three espressos.

### 1.1 Core loop (and where I've tweaked the brief)

1. **Roam.** Third-person, analogue movement with weight: acceleration, a turn-rate cap that tightens with speed, and a sprint ("zoomies") that builds over a second.
2. **Gobble.** Anything whose size is ≤ **60%** of yours (75% in Assist) gets pulled in when it's inside your gobble reach. It flies in on a curved path with spin, shrinks with a squish, and you do a gulp-bounce. Living creatures are **never** gobbled: they're friends, hazards or both.
3. **Grow.** Size is volume-additive: `s' = cbrt(s³ + k · item³)`, with `k` tuned per level so growth feels front-loaded and never stalls. A level is reckoned at roughly 30 to 60 gobbles per doubling.
4. **Unlock.** Bigger size opens new item tiers and **size-gated areas** (a gap you squeeze through when small, a wall you can step over when big).
5. **Finish.** Hit the goal size (or the item list) before the timer, then on to the end screen with stars, a result card and unlocks.

**Changes I'm proposing to the brief, and why:**

- **"Almost gobble-able" shimmer.** Items between 60% and 75% of your size get a faint warm rim light. That teaches the size rule with no tutorial and no on-screen hints, and it's the "one more go" itch ("I'm *nearly* big enough for that bus").
- **Gentle bump, not punishment.** Running into something too big or a hazard knocks loose 1 to 3 of your most recent gobbles, which you can re-gobble. There's no health and no failing, just a wobble and a "whoopsie". Assist mode turns the drops off.
- **Combos.** Gobbles within 1.2 s of each other chain up. The pop pitch climbs a pentatonic scale, the multiplier boosts growth a little (capped at ×1.5), and the combo pays Biccies (the currency).
- **Per-level reset.** Each world starts you at a set size, so levels are replayable in any order once they're unlocked, and Zoomies or Daily can drop you anywhere.

---

## 2. The animal roster

Quality over count: **12 launch animals plus 1 secret**, across **6 rig archetypes**. All are built from primitives with no external models. Silhouette is king: each animal is checked from front, side, three-quarter and top in screenshots before it's signed off.

Stat tweaks are relative to Oli's baseline of 1.0. Every animal gets **one signature move**, **a sound set**, an **affinity** (a flavour bonus, never a lock) and 2 to 3 stat tweaks. Headless sims prove that every animal can earn every star in every level (§11).

| ID | Animal | Archetype | Signature move | Stat tweaks | Affinity | Unlock | Phase |
|---|---|---|---|---|---|---|---|
| A1 | **Oli, yellow Labrador** (default hero) | Quadruped | **Sniff Boost**: hold to sniff, which draws a scent trail to the nearest gobble-able cluster or golden item; release to dash along it | Reach +10%, food items give +10% growth (he's Oli) | Water: swims, and his shake-off sprays loose small items towards him | Start | S |
| A2 | Cat | Quadruped (sleek) | **Pounce**: aimed leap, gobbles everything in a ring where it lands | Turn +25%, top speed +5%, jump +10% | Squeezes through cat-flaps and fence gaps at any size tier | Start | L |
| A3 | Capybara | Quadruped (chunky) | **Chill Aura**: 5 s bubble that calms hazards and freezes pigeons mid-strut | Speed −10%, start size +10%, bumps drop 1 fewer item | Floats on water at full speed; other animals pile on top if you idle (egg) | Start | L |
| A4 | Penguin | Waddler | **Belly-Slide**: dive into a fast, momentum-steered slide that gobbles in a line | Walk −20%, slide +40%, turn −10% while sliding | Snow and ice: slide lasts twice as long; swims like a torpedo | Start | **S** |
| A5 | Rabbit | Hopper | **Super Hop**: charge for a big arcing leap, gobbles on landing | Jump +60%, accel +20%, top speed −5% | Grass: tiny speed boost; binkies (joy-twists) on combos | W1 two stars | L |
| A6 | Duck | Waddler | **Flap-Glide**: from any height, a short glide | Land speed −10%, water speed +40% | Water: paddles happily, leaves a V-shaped wake | Finish W1 | L |
| A7 | Tortoise | Shelled | **Shell Up**: tuck in; immune to bumps and rolls downhill like a bowling ball | Speed −30%, never drops items, reach +15% | None: just stately and smug | Journal 25% | L |
| A8 | Frog | Hopper | **Tongue Snap**: grabs one item at 3× reach, with a satisfying *thwip* | Jump +40%, land speed −5% | Water and lily pads: chain-hops | Finish W3 | L |
| A9 | Red panda | Quadruped (fluffy) | **Stand Tall**: rears up arms-out (real red panda behaviour) and counts as 25% bigger for 3 s | Turn +15%, jump +15%, speed −5% | Trees: climbs short trunks to reach high items | W3 golden item | L |
| A10 | Octopus | Tentacle | **Eight-Arm Grab**: snatches up to 8 nearby items at once | Land speed −20%, water speed +50%, reach +20% | Water: jets; colour-shifts to match the ground (cosmetic) | W4 secret loch area | L |
| A11 | Snake | Serpent | **Coil Pull**: circles a cluster and drags the lot in | No jump, turn +30%, slips under fences | Sand and leaves: faster S-curve slither | Tijuca secret area | L |
| A12 | Elephant | Quadruped (huge) | **Trunk Hoover**: cone of suction in front | Start size +35%, speed −20%, knocks big items flying | Water: trunk-spray shower | Finish the story | L |
| A13 | **Router-Cat** (secret) | Quadruped (cat rig) | **Wi-Fi Purr**: pulls items in a radius that scales with its "signal bars" (which rise with combo) | As cat, plus antenna ears and blinking LEDs | Marcoverse: full bars all the time | Find 3 kittens in the cable spaghetti (M12) | L |

**Parked for Later:** hamster (rodent rig), pig, goat, fox, parrot, axolotl. Each is mostly data once the archetypes exist; the fox and pig are nearly free on the quadruped rig.

### 2.1 Rig archetypes (technical)

One shared animal runtime (`src/animals/`) with archetype modules, all **Node-importable maths** (no Three.js at import time), with a thin render layer that maps the solved pose onto meshes.

| Archetype | Animals | Locomotion | Chains |
|---|---|---|---|
| Quadruped | Dog, cat, capybara, red panda, elephant, router-cat | Phase-driven 4-leg gait with per-leg offsets that blend walk → trot → gallop by speed; 2-bone analytic IK to the ground | Ears (2× 3-link), tail (5 to 8 links), trunk (elephant, 8 links) |
| Hopper | Rabbit, frog | Discrete hop cycle: crouch, launch, airborne tuck, land squash | Ears (rabbit), throat pouch (frog, a scale pulse) |
| Waddler | Duck, penguin | Side-to-side body roll with short legs, plus a flipper or wing flap layer | Tail feathers, neck (duck, 3 links) |
| Shelled | Tortoise | Slow diagonal-pair gait, head extends and retracts | Head-neck (3 links) |
| Serpent | Snake | Spline body following a path history (follow-the-leader), with sinusoidal lateral offset | Body is the chain (24 to 32 segments, instanced) |
| Tentacle | Octopus | Mantle bob, with 8 verlet tentacles that plant and push | 8 × 8-link verlet chains |

**Shared layers on every archetype:** a spring-damped root (squash and stretch, corner lean, landing compression), head-leads-body look-at, an **emotion layer** (happy, excited, scared, sleepy, proud) that drives tail wag amplitude, ear angle, gait bounce and blink rate, and an **idle director** that picks weighted, non-repeating idles (sniff, scratch, sit, play-bow, yawn, shake-off, look-around, species extras) with randomised timing so it never reads as a loop.

### 2.2 Oli, the showcase

- **Coat:** classic butter-yellow (`#E8C27A` base, `#F3DCA6` belly and muzzle, `#C9A05A` ear backs and saddle), black nose, warm brown eyes, otter tail.
- **Quirks built into him:**
  - *Food-obsessed:* a nose-down sniff idle, +10% growth from food items, an occasional dramatic beg-sit at kiosks, and a food-pickup reaction ("NOM").
  - *Water-mad:* beelines for puddles if left idle nearby, belly-flops into the sea, and does a full-body shake-off with a droplet burst that splashes NPCs ("Oh, lovely.").
  - *Tail-wagging whirlwind:* his wag swings the whole back end, the tail knocks tiny items into gobble range, and he greets NPCs with a wiggle that clears tables.
- He's the title-screen star (then whoever you last played).

---

## 3. Customisation (dressing room)

| ID | Feature | Phase |
|---|---|---|
| F1 | **Colours and patterns** per species: base, secondary, belly, ear and tail tips, eye colour, nose. HSL sliders plus presets | S |
| F2 | **Markings**: patches, stripes, spots, socks, blaze, saddle, mask. Procedural, painted into a small per-animal texture atlas from a seed and params | S |
| F3 | **Breed-style presets for the dog**: yellow Lab (Oli), black Lab, chocolate Lab, Border Collie, Dalmatian-style, Beagle-style, Husky-style. Generic looks, no breed-registry logos | L |
| F4 | **Accessories**: collars, bandanas, hats (bowler, carnival crown, party hat, goggles, flat cap, bobble hat), cape, sunglasses, "Certified Good Animal" badge. Attachment points per archetype (neck, head, back) | S (3 items), L (all) |
| F5 | **Trails**: bubbles, sparkles, hearts, tea steam, wave-pavement tiles, data packets | L |
| F6 | **Sound packs**: squeaky toy, kazoo, tiny opera, "robot" (bit-crushed) | L |
| F7 | **Make it your pet (photo)**: file picker, processed locally in a canvas and never uploaded. Downsample to 96 px, sample a centre-weighted region, weighted k-means (k = 5), drop the background via a border-sampled colour model, then map clusters to base, secondary, belly and tips by luminance and area. A preview swatch lets you nudge it. Fallback: a "pick a preset" grid | L |
| F8 | **Face decal**: optional circular crop of the photo onto a soft-edged face decal plane, with a mini cropper (drag and zoom) | L |
| F9 | **Name your animal**: shown under the size badge and in captions ("*Biscuit is thinking about lunch*") | S |
| F10 | **Dressing room screen**: live model on a turntable, with drag-orbit, a gentle auto-rotate and idles playing | S |
| F11 | Loadouts saved per species (`localStorage`, try/catch with an in-memory fallback) | S |

---

## 4. The worlds

Five worlds, five palettes, and one story that runs from **morning on Copacabana** to **midnight in the Marcoverse**. The time of day moves on across the run, which gives the storybook arc for free.

| ID | World | Time and palette | Start → goal size | Vibe and layout | Phase |
|---|---|---|---|---|---|
| W1 | **Copacabana Promenade** | Morning: turquoise, sand, coral, white | 25 cm → 3 m | The black-and-white wave pavement as the spine, beach on one side and kiosks and the avenue on the other. Sugarloaf on the horizon. The shoreline advances and retreats. Volleyball and footvolley nets, a lifeguard tower | **S** |
| W2 | **London Park and Street** | Late morning, drizzle into sun: leaf green, pillar-box red, slate | 40 cm → 8 m | A park with a bandstand, pond and deckchairs, opening onto a terraced street with a bus stop, phone box and post box. A hidden mews shortcut | L |
| W3 | **Tijuca Rainforest** (Rio's own jungle) | Afternoon, dappled: emerald, mango, mist | 80 cm → 18 m | A river valley, waterfall, rope-bridge path and a lookout over the city. A cave behind the waterfall (size gate). Lily-pad lake | L |
| W4 | **Snowy Highlands** (Scotland in winter) | Golden hour into dusk: snow white, heather purple, loch blue | 1.5 m → 45 m | A frozen loch (slides!), a curling rink, a bothy, a ski lift, a glen with Highland cows. Aurora at the end | L |
| W5 | **The Marcoverse** | Midnight neon, but storybook-soft: lilac, mint, warm amber | 4 m → 300 m | A floating cloud city: server-rack skyline, cable rivers, router towers, a data centre "castle". The wave pavement is made of 1s and 0s | L |

Swaps if you'd rather: **farmyard** for W3, or **coral reef** for W4 (underwater movement is a bigger build, so I'd park it as **Later**).

### 4.1 Collectibles per world (curated, 14 to 18 types each)

Sizes are rough "gobble at" sizes. Recurring gags in **bold** appear in every world: **tea mug**, **rubber duck** (each world hides a **golden rubber duck**), and **cable or router**.

- **W1 Copacabana:** bottle cap, seashell, **rubber duck**, flip-flop, ice lolly, coconut, beach ball, sun hat, **tea mug** (a tourist's), cool box, **router** (a kiosk Wi-Fi box), parasol, deckchair, surfboard, cycle-lane bollard, kiosk table, footvolley net, bicycle, the kiosk itself (finale tier).
- **W2 London:** biscuit, conker, **tea mug**, **rubber duck** (pond), wellies, brolly (only when open), newspaper, **Cat-5 cable**, park bin, deckchair, bench, post box, phone box, black cab-style taxi, bandstand, double-decker.
- **W3 Tijuca:** Brazil nut, mango, banana bunch, bromeliad, **rubber duck** (river), **tea mug** (birdwatcher's flask), hammock, kayak, signpost, picnic table, **router** ("Rainforest_5G"), jeep, rope-bridge section, tree stump, lookout hut.
- **W4 Highlands:** snowball, thistle, **tea mug** (bothy flask), **rubber duck** (frozen in ice), tartan scarf, curling stone, sledge, skis, snowman, hay bale, **cable** (ski-lift power), wooden sign, tractor, ski-lift chair, bothy, the ski lift itself.
- **W5 Marcoverse:** data packet, RJ45 plug, **tea mug** (the server room's), **rubber duck** (debugging duck!), keyboard, monitor, **router**, cable spool, server blade, rack, cloud puff, satellite dish, beachball loader, data-centre block, giant cloud (finale).

Every item gets a one-line **Journal** entry in animal-eye voice, for example: *Flip-flop: "Smells of feet and freedom. Ten out of ten."* or *Router: "Blinks at you. Rude, but intriguing."*

### 4.2 Hazards (gentle tension, never fatal)

| World | Hazards |
|---|---|
| W1 | The advancing tide (non-swimmers get nudged; water-lovers get a speed boost), cyclists on the lane, a grumpy pigeon squad |
| W2 | Puddles (most animals slow; Oli, duck and capybara love them), a garden hose, swooping pigeons, a jogger |
| W3 | Slippery rocks, a heckling toucan, a cheeky marmoset that nicks a hat cosmetic until you chase it |
| W4 | Thin ice that cracks (bounce, never fall in), snowball-throwing kids, a stubborn Highland cow |
| W5 | Firewalls (bounce), lag zones (choppy movement, purely visual; skipped with reduced motion), packet-loss puddles |

A hazard bump knocks loose 1 to 3 recent gobbles, with a short stagger and a "whoopsie" caption. Assist mode: no drops, and hazards move at half speed.

### 4.3 Star goals per level

| Star | Rule |
|---|---|
| ★ | Reach the goal size |
| ★★ | Reach the stretch size (about 1.5× goal) before the timer, or under a par time in Chill |
| ★★★ | A per-level twist: W1 *touch no hazards*, W2 *gobble all 12 tea mugs*, W3 *find the golden item*, W4 *a 30-gobble combo*, W5 *finish under par* |

Story timers run 4 to 6 minutes. Chill mode has no timer and stars 1 and 3 only.

---

## 5. Cast and story

| Who | Persona | Voice and blip | Phase |
|---|---|---|---|
| **Gerald** the pigeon | Smug London-born pigeon on a gap year. Nicked your ball. Thinks he's a mastermind | Wide pitch swings, a clucky square-wave blip | S |
| **Marco** (cameo) | Jogging, teaching, always has a spare ball. Shows up in every world | Mid, warm blip; your recorded clips upgrade it | S (W1 cameo) |
| **Captain Kev** | British ex-pat lifeguard on Copacabana who treats everything as a maritime emergency | Low and booming, a megaphone-filtered blip | L |
| **Seu Zé** | Copacabana and Tijuca street vendor. **Speaks only pt-BR.** Shouts his wares like opera | Bright, rapid, triangle-wave blip | L |
| **Auntie Pru** | Tea-obsessed Brit with a bottomless flask, turns up in every world, appalled by the coffee | High and trilling, a sine blip with vibrato | L |
| **Packet** | A little data packet, the Marcoverse tour guide, talks like an over-keen sat-nav | Robotic, bit-crushed blip | L |

**Story arc:** a comic-panel intro (four panels: Oli, the tennis ball, Gerald's swoop, a "HOI!" caption), one panel between worlds, and an ending where Gerald's nest in the Cloud turns out to hold 3,000 stolen balls. He gives yours back; the end credits are a beach kickabout. Captions only, no text walls.

The animals don't speak English: they react with synthesised (and later recorded) sounds, plus little italic **thought captions** in your animal's name ("*Oli is considering the bus.*").

---

## 6. Features, meta-game and reasons to keep playing

| ID | Feature | Phase |
|---|---|---|
| F12 | **Journal**: a grid of every item type, with silhouettes for undiscovered ones, a one-liner each, completion % per world, and golden variants | L (basic in S) |
| F13 | **Species log**: unlocked animals, stats, signature move, and your best size with each | L |
| F14 | **Golden collectible** per world, found in an interesting way (each one is egg-linked, see §7) | L |
| F15 | **Size-gated secret areas** and shortcuts in every world | S (one in W1) |
| F16 | **Daily special item**: one item per world chosen by date hash, worth triple Biccies | L |
| F17 | **Daily challenge**: date-seeded world, animal, modifier and item list. No backend; your local streak is shown | L |
| F18 | **Zoomies** (endless): a growing-size arena, scored on combo chains, with escalating spawn waves | L |
| F19 | **Chill mode**: no timer, no hazard drops, relaxed music | L |
| F20 | **Speedrun timer plus local ghost** of your best run (input-recorded, replayed deterministically on the fixed timestep) | L |
| F21 | **Biccies** currency: earned from gobbles, combos, stars, eggs and dailies. Spent on cosmetics, animals and cast costumes | S (earn), L (shop) |
| F22 | **Cast costumes**: Gerald in a beret, Captain Kev in Speedos, Auntie Pru in a carnival crown | L |
| F23 | **Achievements** with silly names (about 40): *Absolute Unit*, *Tea-Total*, *Puddle Professional*, *Fluent in Pombo*, *Three-Way Handshake*, *Have You Tried Turning It Off and On Again* | L |
| F24 | **Shareable result card**: a PNG rendered from the canvas with your animal in its outfit, name, stars, size and world art | L |
| F25 | **Stats page**: distance walked, items gobbled, biggest size, pigeons scared, cups of tea | L |
| F26 | **Weather events per run**: rain, fog, surprise samba parade (W1), drizzle-then-sun (W2), mist (W3), aurora (W4), data storm (W5) | L |
| F27 | **Reactive NPCs** who remember you within a run (tutting, waving, applauding, hiding their sandwiches) | L |
| F28 | **Animal friends** who follow you once you've done them a favour and bark, chirp or squeak along with your combos | L |
| F29 | **Mini-game: Fetch**. Marco throws a ball; catch it at the peak for bonus Biccies | L |
| F30 | **Mini-game: Pigeon herding**. Steer six pigeons into a ring with your bark | L |
| F31 | **Mini-game: Sniff trail**. Follow a scent trail of treats against the clock | L |
| F32 | **Mini-game: Sit and stay**. Hold still while Gerald wafts a biscuit about | L |
| F33 | **Seeded item placement**: hand-placed "anchor" props plus seeded fill, so each run differs a bit | L |
| F34 | **Level modifiers**: big-head, low gravity, tiny world, speedy, mirror. Used by the daily and unlockable as toggles | L |
| F35 | **Weekly rotating theme** (date-seeded): a palette swap plus a special item, for example "Carnival week" | Later |
| F36 | **Comic-panel story wrapper** (§5) | L |
| F37 | **Photo mode**: orbit camera, slow time, hide the HUD, frames and filters, with the "Carrot cam" from H5 | L |
| F38 | **Save clip**: records the last ~10 s via `MediaRecorder` (two staggered recorders restarting every 10 s, so one always holds a full window) and saves a `.webm`. Falls back to a screenshot button where `captureStream` or webm isn't supported, and I'll tell you which browsers | L |

---

## 7. Easter eggs (13 to 14 per world, tracked in the Journal as "???" until found)

Title-screen and global eggs come first, then one block per world. IDs are for approve or deny.

**Global**
- G1 Type **`BIGHEAD`** on the title: big-head mode.
- G2 **`MOONWALK`**: low gravity.
- G3 **`DISCO`**: disco lighting (slow colour fades, photosensitivity-safe, no strobing).
- G4 **`TINY`**: tiny-world mode (everything is half size).
- G5 **`QUACKERS`**: rubber ducks rain gently from the sky.
- G6 **↑ ↑ ↓ ↓ ← → ← → B A** (or the pad equivalent): *Good Boy Mode*. Every caption becomes a variation of "good boy".
- G7 **`OLI`**: Oli does a zoomies lap round the title scene.
- G8 Tea mugs grant a 6 s **Tea Time** buff: a bigger gobble reach and a cosy colour grade.
- G9 Gerald turns up in every world with a new disguise (a running gag across all five).

**W1 Copacabana**
- C1 A kiosk router blinks Morse for **PING**; gobble it mid-blink and you get "PONG!"
- C2 A beach hut sign reads **127.0.0.1**: "There's no place like home". Sit in it for a cosy nap.
- C3 The caipirinha stand ("lime squash, honest") makes your animal wobble for 8 s (no camera sway in reduced motion).
- C4 Marco jogging along the promenade; play-bow near him and he throws a ball, which starts Fetch.
- C5 Knock the footvolley ball over the net three times: the crowd roars "GOLAÇO!" and the **golden football** appears.
- C6 A Sugarloaf-shaped sandcastle: gobble it at 2 m to find a buried **golden flip-flop**.
- C7 A Magellanic penguin "on holiday" under a parasol (they really do wash up in Rio). Play as the penguin and it high-fives you.
- C8 Gobble 10 biscuit packets from Seu Zé: "Acabou o biscoito!" and you win a hat.
- C9 Wait by the coconut stall: he pops a straw in, and drinking it gives a speed burst.
- C10 A sunbather reading *Networking for Dogs*; the open page reads "Layer 2: barking at the wrong frame".
- C11 Bark three times at the lifeguard tower: Captain Kev swings his binoculars round. "Oi. I can see you."
- C12 Dawdle until sunset in Chill: soft fireworks out at sea (a New Year's Eve on the beach nod).
- C13 The wave pavement spells **MARCOVERSE** when viewed from directly above in photo mode.

**W2 London**
- L1 Step into the phone box: "Please hold" music, then a Cat-5 joke.
- L2 Gerald's cousin **Nigel** perches on top of the Admiral's column and heckles in Cockney.
- L3 The bus stop: wait 30 s and the **127 to Localhost** pulls up.
- L4 Oli and the puddles: a full belly-flop and shake-off that splashes a commuter ("Oh, lovely.").
- L5 Cut the queue at the coffee cart and five NPCs tut in perfect sync.
- L6 The Cat-5 cable on pickup: "Cat-5. Its brother Dog-6 is still in testing."
- L7 A squirrel nicks a scone; chase it down to get the **golden scone**.
- L8 Brollies can only be gobbled while open (they open when it rains).
- L9 A post box letter addressed to "Marco, Copacabana" unlocks a postcard in the Journal.
- L10 A bench plaque: "In memory of the three seconds of sun, 14th July".
- L11 A sentry in a bearskin hat who won't move; play-bow three times and he cracks the tiniest smile.
- L12 A gallery window shows *Portrait of a Good Boy (oil on Labrador)*. It's Oli, or your custom animal.
- L13 Auntie Pru's flask: a cuppa sends Tea Time to double length in London ("It's the water, dear.").

**W3 Tijuca**
- T1 A toucan heckles Gerald from the canopy; get them in the same frame for a photo-mode achievement.
- T2 A cave behind the waterfall (size 4 m+) holds the **golden mango**.
- T3 As the capybara, idle for 10 s and a marmoset, a duck and a frog pile on top of you.
- T4 A marmoset pinches your hat; chase it to get it back (and a Biccies bonus).
- T5 The Brazil nut: "Brazil nut. From Brazil. Unlike the ones at Christmas."
- T6 A giant leaf slide; belly-sliders get triple distance.
- T7 A butterfly swarm briefly spells your animal's name.
- T8 A router in a tree, "Rainforest_5G". Password on a sticky note: "banana".
- T9 The trail map is drawn as a **star topology** with the lake as the switch.
- T10 A jaguar statue's eyes follow you; as the cat or router-cat it purrs back.
- T11 Seu Zé selling açaí, in pt-BR, louder than the waterfall.
- T12 Hop the lily pads in pitch order to play a little tune and earn the **golden lily**.
- T13 A sloth says one word every 60 s; by the end of the level it's finished a sentence.

**W4 Highlands**
- H1 Knock a curling stone into the house: polite applause and a "Good stone!"
- H2 Sit by the loch for 20 s and *something* surfaces. It's Gerald in a rubber ring.
- H3 The penguin belly-slide course down the glen ends at the **golden snowflake**.
- H4 The piper's drone pitches down as you grow.
- H5 Gobble the snowman at 2 m and its carrot unlocks the **Carrot cam** photo filter.
- H6 A Highland cow whose fringe blows aside in the wind to reveal surprisingly judgemental eyes.
- H7 A ski-lift sign: "Load balancer: distributing skiers across three pistes".
- H8 The bothy flask (Auntie Pru's, of course): Tea Time.
- H9 Aurora at dusk, slow and pastel, photosensitivity-safe.
- H10 Sit still on fresh snow for 5 s to make a snow angel shaped like your species.
- H11 Gerald in a tiny tartan scarf, sliding about on the ice and failing.
- H12 An ice sculpture of a router with "Frozen packet" on the plinth.
- H13 A wild haggis runs clockwise round a hill (its legs are shorter on one side, obviously).

**W5 Marcoverse**
- M1 Server racks blink the Marcoverse logo in their LEDs.
- M2 Packet-loss pigeons: little bits of Gerald's data drift off behind him.
- M3 A 404 door that's "Not Found" while you look at it but opens when you turn your back.
- M4 District signs: "192.168.0.0/16. Your neighbours are on a different VLAN."
- M5 Packet's TTL counter ticks down with every hop it guides you.
- M6 A hologram of Marco teaching a CCNA class to a room of cats.
- M7 A plaque: "The Cloud is just someone else's computer."
- M8 A firewall that opens if you bark the HTTPS port: 4 barks, pause, 4 barks, pause, 3 barks.
- M9 A DNS signpost that resolves "Who's a good boy?" to your animal's name.
- M10 **Three-way handshake**: approach a packet NPC (SYN), it waves (SYN-ACK), you play-bow (ACK), and out pops the **golden handshake**.
- M11 A spinning beach-ball loader the size of a house; gobbling it gives "Thanks for your patience."
- M12 Find 3 kittens tangled in the cable spaghetti to unlock **Router-Cat** (A13).
- M13 A lag zone where your animal stutters at 10 fps for comedy (skipped with reduced motion).
- M14 "Have you tried turning it off and on again?": the data centre castle's lights do exactly that.

---

## 8. Animation plan (top priority)

All of this is procedural and runs off the fixed 60 Hz sim with render interpolation.

| Area | Technique |
|---|---|
| Body | A critically-damped spring on root position, rotation and scale; squash and stretch from vertical velocity; corner lean from the yaw rate; head look-at leads the body by about 120 ms |
| Gait | Per-archetype phase oscillators with speed-blended gait tables (walk, trot, gallop, sprint), foot-plant IK on terrain height, and stride length scaled by size |
| Chains | Verlet chains (2 to 4 iterations) for ears, tails, trunk, tentacles and neck feathers, driven by root acceleration plus an emotion-driven target (wag amplitude, tucked tail when scared) |
| Idles | A weighted shuffle-bag idle director per species, with timings jittered ±40% and additive blending over the base pose |
| Shake-off | A twisting sine through the spine chain, low to high frequency, with a GPU-instanced droplet burst |
| Pickup chain | A Bézier pull with spin, a scale-to-zero squish with an overshoot, the animal's gulp-bounce, an expanding ring pulse (shader), up to 12 particles, and a pentatonic pop pitch |
| Milestones | Camera pull-back (eased, about 0.8 s), a 0.35 s slow-mo beat (0.4× sim rate, still deterministic), confetti, a new size badge |
| Camera | A spring-arm third-person camera with look-ahead on velocity, an FOV kick on sprint, handheld sway (Perlin, amplitude ~0.15°), collision push-in. Reduced motion zeroes sway and kicks |
| World | Vertex-shader wind sway for grass, trees, flags, bunting and washing lines; a water shader with foam lines and a shoreline offset on a slow sine; fading footprint decals (pooled); boids pigeon and gull flocks (≤ 48 birds, instanced); instanced crowds with simple reaction states |
| Objects | Knocked items get a spring wobble and settle, plus faked rigid-body tumbles (a ballistic arc with angular velocity and a damped bounce); bins can domino |
| Light | A moving sun across the level duration, warm sunset grading, cheap god rays (a radial blur on a sun mask at the half-resolution post step, High tier only) |
| UI | Spring-overshoot easing on every panel, count-up numbers with ticks, parallax menus |
| Title | A living scene: the hero idling at sunset, waves moving, the camera drifting. Whoever you last played takes the spotlight |

**Look and feel:** sunny storybook rather than neon. That means soft toon shading (a 3-band ramp with a warm rim light), pastel per-world palettes, inverted-hull outlines on animals and key props only, chunky rounded geometry, soft contact shadows and a gentle bloom on Medium and up.

---

## 9. Accessibility and welcome

| ID | Feature | Phase |
|---|---|---|
| F39 | **Reduced motion**: kills camera sway, FOV kicks, shake, slow-mo zooms and the lag zone, and calms UI overshoot | S |
| F40 | **Colour-blind-safe palettes** (deuteranopia, protanopia, tritanopia) plus **shape-coded** item tiers (rim icon: circle, triangle, square, star) | L |
| F41 | **Text and HUD size** sliders (80 to 160%) and a **high-contrast HUD** | S (size), L (contrast) |
| F42 | **Assist mode**: bigger gobble threshold and reach, no fail or drop states, half-speed hazards | S |
| F43 | **One-handed and simplified controls**: auto-sprint, a signature on a single button, optional hold-to-move toward the pointer | L |
| F44 | **Subtitles** on by default for every voice line and meaningful sound ("[happy bark]"); pt-BR lines get an optional English translation line | S |
| F45 | **Independent volumes**: master, music, SFX, voices, ambience | S |
| F46 | **Photosensitivity-safe** by default: no flashes over 3 per second, no high-contrast strobing, and confetti and lighting fades kept smooth | S |
| F47 | **Input**: keyboard, gamepad and touch all fully playable with rebinding. **No on-screen control prompts.** One contextual hint at most (an animal icon pulses once the first time the signature move is useful) | S |
| F48 | **Copy table**: every string goes through `t(key)`; ships `en-GB` with the pt-BR cast lines, and full pt-BR comes later | S |
| F49 | **Portrait overlay** on phones: "Turn your phone sideways" with a wiggling Oli | S |

**Default controls** (in the README and the pause menu's controls page only, never in the HUD):

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | Left stick | Floating stick (left half, invisible until touched) |
| Camera | Mouse drag / IJKL | Right stick | Drag right half |
| Jump / hop | Space | A | Tap right half |
| Zoomies (sprint) | Shift (or auto-sprint) | RT / hold A | Push the stick to its edge |
| Signature move | E | X / RB | Animal-icon button (bottom right) |
| Bark / sound | Q | Y | Double-tap right half |
| Photo mode | P | View/Back | Pause menu |
| Pause | Esc | Start | Pause button (top right, small) |

---

## 10. UI layout

**The unit:** `u = min(innerHeight, 0.55 × innerWidth) / 100`, with a floor of 3.6 px so phones stay readable.

| Viewport | u | Size badge (20u) | Timer text (7u) | Body text (2.6u, min 14 px) |
|---|---|---|---|---|
| **2000 × 747** (your ultrawide) | 7.47 px | 149 px | 52 px | 19 px |
| 2560 × 1080 | 10.8 px | 216 px | 76 px | 28 px |
| 1920 × 1080 | 10.56 px | 211 px | 74 px | 27 px |
| 1280 × 720 | 7.04 px | 141 px | 49 px | 18 px |
| 812 × 375 (phone landscape) | 3.75 px | 75 px | 26 px | 14 px |

**HUD (in game). Nothing reserves space when empty, and the centre is always clear:**

- **Top-left: size badge.** A ring showing the current size (cm, then m) with a progress arc to the next milestone, and your animal's name beneath at 3u. Always visible, since it's *the* number.
- **Top-centre: timer.** Only in timed modes. It warms to coral in the last 30 s, with no flashing.
- **Top-right: goal and stars.** It shows big for 3 s at the start, then shrinks to a small star pip row. It pulses when a star is earned.
- **Lower-left third: combo.** "×7" at 8u, only during a combo, and it springs out when the combo ends.
- **Left edge, mid-height: Journal toast.** "New: Flip-flop!" slides in for 2.5 s, only on a first discovery.
- **World space: floating text.** Cast chatter, thought captions and item names as **small white text with a soft dark outline**, following the speaker, with no boxes or bubbles. It fades at the edges of the safe area and never sits over the player's animal.
- **Bottom-right: the touch signature button,** touch devices only.

**Menus:** designed ultrawide-first as a two- or three-column layout that reflows to one column under 1.3:1. The title screen puts the hero and scene on the left 60% and the menu column on the right, with nothing clipped at any listed size. Every screen gets screenshotted at all five sizes before I call it done.

Screens: Title → Play (world select, map style) → Animal select → Dressing room → Level → Pause (resume, settings, controls, quit) → End card. Plus Journal, Species log, Shop, Achievements, Stats, Settings (Video, Audio, Accessibility, Controls).

---

## 11. Audio plan

- **Buses:** `music` (constant level, never ducked), `sfx`, `ambience`, and `voice` at **+5 dB over music**, through a compressor (−18 dB threshold, 3:1) and then a limiter (−1 dBFS). Voices overlap freely (cap 6) with a per-speaker anti-spam window of 2.5 s.
- **Music**, procedural and per world: W1 bossa-ish nylon pluck, shaker and 7th chords; W2 jaunty pizzicato and brass stabs; W3 marimba and a bird chorus; W4 drone and flute; W5 soft synth arps. A pickup layer adds a hi-hat once your combo is ≥ 5. Level changes crossfade over 2 s.
- **SFX:** all synthesised in WebAudio. Gobble pops (pitch climbing a pentatonic scale with the combo), squish, gulp, a ring "whum", bumps, splashes, footsteps per surface, UI ticks.
- **Per-species sound sets** (synthesised): bark, meow and purr, capybara whistle-squeak, penguin bray, rabbit thump, quack, tortoise hiss, frog croak, red panda squeak, octopus bloop, snake hiss, elephant trumpet, router-cat dial-up meow.
- **Cast blips:** a distinct waveform, pitch and formant per character (§5). Speech synthesis is optional and off by default (it can only say one line at a time and sits outside WebAudio).
- **Your recordings:** drop mp3s in `assets/user/voice/`. Each gets per-clip loudness normalisation at build time (to −16 LUFS integrated, measured in `tools/build.mjs` and stored as gain metadata) and plays through the voice bus. Unrecorded lines fall back to blip plus text.

**Honesty clause:** I can't hear any of it. I'll give you measured numbers (LUFS gaps between buses, peak levels), and you tell me if it sounds like a kazoo in a bin.

---

## 12. Dialogue and chatter

- A **director** maps events (`pickup`, `combo`, `milestone`, `bump`, `nearMiss`, `pigeonScare`, `finish`, `idle`, `egg`) to barks with per-character weights and tags.
- **Shuffle-bag banks** per character (no back-to-back repeats), with 25+ throwaway lines per speaker. A global ambient cooldown means roughly one line every 3 to 5 s, never spammy, with speaker cooldowns on top.
- Rendering is floating world-space text only.
- Seu Zé's lines are entirely pt-BR ("Olha o mate! Olha o biscoito!"), with the optional English translation line underneath (F44).

---

## 13. Technical architecture

**Stack:** Three.js **0.186.1** (pinned), esbuild → a **single self-contained HTML** (IIFE). No network at runtime. Assets are embedded as data URIs by `tools/build.mjs` into `window.__ASSETS__`, behind an `Assets` API: `has / uri / text / image / audioBuffer / keysWithPrefix`. Everything works with zero assets.

**Conventions:** a fixed **60 Hz** timestep with render interpolation, and the sim never reads the clock. Y is up, forward = `(sin yaw, 0, cos yaw)`. Seeded RNG (mulberry32) everywhere in the sim. No per-frame allocations in hot paths (pooled vectors, reusable arrays).

**Node-importable rule:** everything outside `src/ui/`, `src/audio/`, `src/input/` and `src/render/` imports in plain Node, and is unit-tested and simulated headlessly with `node --test`.

```
src/
  core/        game.js (GAME constant), loop.js, rng.js, math.js, events.js, storage.js, copy/ (en-GB, pt-BR)
  sim/         world.js, player.js, growth.js, gobble.js, collide.js (spatial hash, capsule vs AABB/cyl),
               props.js (wobble, tumble), hazards.js, level.js, ghost.js
  animals/     species/*.js (data), archetypes/*.js (gait solvers), chains.js, emotion.js, idles.js,
               customise.js (palette, markings, photo k-means maths)
  worlds/      w1-copacabana.js ... w5-marcoverse.js (layout data, item tables, eggs), catalogue.js
  meta/        progression.js, journal.js, achievements.js, daily.js, eggs.js, shop.js, stats.js
  dialogue/    director.js, banks/*.js, shufflebag.js
  render/      scene.js, materials/ (toon, water, sway), animalMesh.js, instancing.js, particles.js,
               camera.js, post.js, sky.js, floatingText.js
  ui/          hud.js, menus/*, dressingRoom.js, journal.js, settings.js, styles.css
  audio/       engine.js, buses.js, synth/*.js, music/*.js, voice.js
  input/       keyboard.js, gamepad.js, touch.js, bindings.js
  assets/      assets.js
  main.js
tools/         build.mjs, screenshots.mjs, sim.mjs, photos/ (Python: OpenCV, Pillow, numpy)
test/          *.test.js
assets/user/   (your drop folder: photos/, voice/; originals are git-ignored)
```

### 13.1 File ownership (parallel agents)

Each agent owns its folders outright. Cross-agent asks go in `REQUESTS.md` (append-only, dated). No two agents ever edit the same file.

| Agent | Owns | Hand-back |
|---|---|---|
| **Lead** (me) | `src/core/`, `src/main.js`, `SPEC.md`, `README.md`, `REQUESTS.md`, `.github/`, `CNAME` | Integration, reviews, final screenshots |
| World and levels | `src/worlds/`, `src/sim/` (except `player.js`), `src/render/` world materials and `sky.js` | Level data, colliders, items, eggs placement |
| Animals and animation | `src/animals/`, `src/sim/player.js`, `src/render/animalMesh.js` | All species, archetypes, customiser maths |
| UI and menus | `src/ui/`, `src/render/floatingText.js` | Every screen at 5 sizes |
| Audio and dialogue | `src/audio/`, `src/dialogue/` | SFX, music, voice bus, bark banks |
| Meta and progression | `src/meta/` | Journal, unlocks, daily, achievements, shop |
| Tests and tooling | `test/`, `tools/` | Sims, screenshots, build, perf report |

---

## 14. Test plan

- **Unit tests** (`node --test`), heading for several hundred: growth maths, the gobble rule, combo timing, collisions, shuffle bags, daily seeding, progression and unlock rules, save migration, copy-key coverage (no missing keys in either locale), the photo k-means on synthetic images, and species data validation (every species has a sig move, a sound set and an archetype).
- **Headless sims for every animal on every level:** a scripted "greedy gobbler" bot plus a random-walk bot, run at 60 Hz with no rendering. They assert:
  - nobody gets stuck in geometry (no-progress-for-N-seconds detection),
  - no prop's velocity goes over a cap (nothing launches into space),
  - every item is reachable at its gobble size (a flood-fill on the nav grid per size tier),
  - every star is attainable by every animal within the timer, with a margin.
- **Determinism test:** the same seed and inputs give the same end state hash, which is what keeps ghosts honest.
- **Screenshots:** Playwright plus headless Chromium with `--use-gl=swiftshader`, low quality, small viewport. Covers every screen at the five sizes, each animal from four angles, and each world. I look at them myself before saying anything's done.
- **Before every "done":** the full test suite plus a build. Flaky audio or timing tests get flagged and re-run, never hidden.

## 15. Performance budget

| Metric | Budget |
|---|---|
| Frame rate | 60 fps on a mid-range laptop (Medium) |
| Draw calls | < 250 typical, < 400 worst case |
| Triangles | Low 150k / Med 350k / High 600k |
| Particles | Low 300 / Med 1,000 / High 2,500 |
| Sim step | < 2 ms per 60 Hz tick (measured headless) |
| JS heap churn | No per-frame allocations in sim, animation or particles (checked with a GC counter in perf runs) |
| Bundle | < 3 MB with no assets, < 15 MB with your assets (hard cap 25 MB; the Artifact preview limit is 16 MB) |

Quality tiers: **Low** (no shadows, no bloom, half-res post, lower instance counts), **Medium** (soft shadows, bloom), **High** (god rays, more sway instances, more particles). Auto-picks from a 2 s warm-up benchmark, and you can override it.

---

## 16. Hosting and pipeline

- `.github/workflows/deploy.yml`: on every push to `main`, run the tests, build `dist/index.html`, then `actions/configure-pages`, `upload-pages-artifact` and `deploy-pages`. (I can't reach `marco-kart` from this session, so I'll write it fresh with the same three actions.)
- **Domain suggestion: `gobble.marcoverse.co.uk`** (short and cheeky). The alternative is `gobblepaws.marcoverse.co.uk`.
  - On Squarespace DNS, add a **CNAME** record with host `gobble` pointing at `pinnersinner.github.io` (no `www`).
  - The repo gets a `CNAME` file containing `gobble.marcoverse.co.uk`.
  - In GitHub: Settings → Pages → Source: **GitHub Actions**, then Custom domain: `gobble.marcoverse.co.uk`, then tick **Enforce HTTPS** once the certificate lands.
- `.gitignore` keeps originals, scratch files and `assets/user/**/originals/` out of the repo. **I'll remind you before anything personal (photos or recordings) gets pushed**, since the repo is public.
- Windows Command Prompt commands for anything you need to run locally.

---

## 17. First vertical slice (what lands once you approve)

- **Oli** (A1) and the **Penguin** (A4): a quadruped and a waddler, as different as I can make them on day one.
- **W1 Copacabana**: the wave pavement, beach, animated shoreline, kiosks and nets, about 15 item types, one size-gated secret, Gerald and a Marco cameo.
- Gobble and grow with the full pickup juice chain, milestones and the camera.
- Big HUD (size badge, timer, combo, Journal toast), the living title screen, animal select, and a dressing room with colours, markings, 3 accessories and naming.
- Procedural W1 music, pickup and species sounds, and floating chatter for Gerald and Marco.
- Settings: volumes, reduced motion, assist, text size, quality.
- Tests, headless sims for both animals, screenshots at the five sizes, the Pages workflow, and a README.

Then the voice-line list and photo shot-list (§6 of the brief) come your way while I carry on building.

## 18. Later list (parked, not forgotten)

Hamster, pig, goat, fox, parrot and axolotl; a coral reef world; weekly themes (F35); full pt-BR localisation; a level editor; online leaderboards (needs a backend, so it's off the table for now); co-op.

## 19. Questions still open for you

1. Happy with **Tijuca Rainforest** and **Snowy Highlands** as worlds 3 and 4?
2. Happy with **Penguin** as Oli's sidekick in the slice? (It's the most visually different animal, and Rio genuinely gets penguins.)
3. Domain: **`gobble.marcoverse.co.uk`** or `gobblepaws.marcoverse.co.uk`?
4. Rename the repo to `gobblepaws`? (Optional, but it's tidier.)
