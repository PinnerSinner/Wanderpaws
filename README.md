# Gobblepaws

**Gobble everything smaller than you.**

A cosy 3D collect-and-grow game for the browser. You play an animal (Oli the butter-yellow Labrador by default, or a cat, capybara, penguin and nine more), roam five storybook worlds and hoover up anything smaller than you. Start at flip-flop height on Copacabana and finish the size of a data centre in the Marcoverse. Gerald the pigeon nicked your tennis ball, and you want it back.

**Play it:** <https://pinnersinner.github.io/Wanderpaws/> (and soon at <https://gobble.marcoverse.co.uk>)

> **Status:** under active construction. The engine, tooling and design are in; the five worlds, thirteen animals, menus, audio and meta-game are being built in parallel and land over the next few pushes. Every push to the default branch redeploys the link above automatically. Screenshots of every world, animal and screen get added here once the full build lands.

---

## What's in it

- **13 animals, each with a proper personality.** Oli the Lab (sniff-boost dash), a cat (pounce), a capybara (chill aura, floats), a penguin (belly-slide), a rabbit, duck, tortoise, frog, red panda, octopus, snake, elephant, and a secret **Router-Cat**. Each one has its own procedural gait, sounds, signature move and small stat tweaks, and every animal can earn every star.
- **Five worlds:** Copacabana Promenade, a London park and street, the Tijuca Rainforest, the Snowy Highlands and the Marcoverse (a neon-soft cloud and data-centre fantasy).
- **Dressing room:** colours, markings, breed-style presets, hats, collars, capes, trails and sound packs. Plus **"make it your pet"**: load a photo of your own pet and it samples the coat colours locally in your browser (nothing is ever uploaded).
- **Reasons to keep playing:** a Journal of every item with silly one-liners, golden collectibles, size-gated secret areas, a date-seeded **daily challenge**, an endless **Zoomies** mode, a chill mode, a speedrun ghost of your best run, Biccies to spend on cosmetics, and around 40 achievements with daft names.
- **Easter eggs everywhere:** about 66 of them across the worlds (a router blinking PING in Morse, the 127 bus to Localhost, a firewall you open by barking the HTTPS port...) plus title-screen secret words. They're tracked in the Journal so you can hunt for the rest.
- **Accessibility built in:** reduced motion, colour-blind palettes with shape-coded items, text and HUD scaling, high-contrast HUD, assist mode, one-handed controls, subtitles on by default, and five independent volume sliders. Photosensitivity-safe effects throughout.

The full design lives in [`SPEC.md`](SPEC.md).

## Controls

There are no on-screen prompts, so here they are:

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | Left stick | Floating stick (left half of the screen) |
| Camera | Mouse drag / IJKL | Right stick | Drag on the right half |
| Jump / hop | Space | A | Tap the right half |
| Zoomies (sprint) | Shift | RT | Push the stick to its edge |
| Signature move | E | X / RB | Paw button (bottom right) |
| Bark (hold to play-bow) | Q | Y | Double-tap the right half |
| Photo mode | P | View | From the pause menu |
| Pause | Esc | Start | Pause button |

Everything can be rebound in Settings → Controls.

## Build, test and run locally (Windows Command Prompt)

You'll need [Node.js 22](https://nodejs.org/).

```bat
git clone https://github.com/PinnerSinner/Wanderpaws.git
cd Wanderpaws
npm install
npm test
npm run build
start dist\index.html
```

`npm run build` produces **one self-contained file**, `dist\index.html`, with no network access needed at runtime. Double-click it and you're playing.

Other handy commands:

| Command | What it does |
|---|---|
| `npm run watch` | Rebuilds on every save |
| `npm run sim` | Headless bots play every animal in every world and report soft-locks, launched props and timings |
| `npm run shots` | Headless Chromium screenshots of every screen and world at five window sizes (needs Playwright) |
| `node tools\build.mjs --out .out\test.html` | Build to a different file |

## Deploying

Every push to the default branch runs the tests, builds the single HTML file, runs the headless sims and publishes to GitHub Pages ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

One-off setup on github.com:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** (The workflow tries to switch this on itself, but GitHub sometimes insists you click it.)
2. For the custom domain, add a **CNAME** record in Squarespace DNS: host `gobble`, value `pinnersinner.github.io` (no `www`). Then enter `gobble.marcoverse.co.uk` under **Settings → Pages → Custom domain**, and tick **Enforce HTTPS** once the certificate turns up (usually within the hour).

## Your photos and voice clips

The game works with zero assets and gets better as you add them.

- **Voice clips:** drop mp3s into `assets/user/voice/` using the file names in `VOICELINES.md`, then run `npm run build`. Each clip is loudness-normalised and plays over the music; any line you haven't recorded falls back to a little synth "blip" voice plus text.
- **Photos:** put originals in `assets/user/photos/originals/` (git-ignored, so they never get pushed), list them in `tools/photos/registry.json`, then run:

  ```bat
  pip install opencv-python-headless pillow numpy
  python tools\photos\process.py
  ```

  That makes small portraits, round stamps, storybook posters and cartoon versions in `assets/user/photos/`. It's image processing, not AI generation. Anything you list in a photo's `blur` polygons is blurred before cropping. If a photo can't be processed, the script says so loudly instead of skipping it.
- **Heads-up:** the repo is public, so anything in `assets/user/` (apart from `originals/`) is public too.

## How it's built

| Area | Folder | What lives there |
|---|---|---|
| Core | `src/core/` | Fixed 60 Hz loop, seeded RNG, maths, event bus, storage, settings, the copy table |
| Sim | `src/sim/` | Movement, collisions, gobbling and growth, signature moves, hazards, NPCs, boids, mini-games, modes. Pure JS, runs headless in Node |
| Worlds | `src/worlds/` | The five worlds' layouts, items, eggs and copy; `meshes/` builds every prop, building and person procedurally |
| Animals | `src/animals/` | Species data, procedural rigs (gaits, spring chains, emotions, idles), models, cosmetics, the photo palette sampler |
| Render | `src/render/` | Three.js scene, toon, water and sway shaders, camera, particles, floating text, photo mode, clip recording |
| UI | `src/ui/` | Menus, HUD, dressing room, Journal, comic panels, end cards |
| Audio | `src/audio/`, `src/dialogue/` | Synthesised SFX, animal voices and music; the barks director and cast banks |
| Meta and input | `src/meta/`, `src/input/` | Saves, unlocks, achievements, daily challenge, ghosts; keyboard, gamepad and touch |
| Tooling | `tools/` | Single-file build, screenshots, headless sims, the photo pipeline |

Built with [Three.js](https://threejs.org/) 0.186.1 and [esbuild](https://esbuild.github.io/). Everything you see is built from code at runtime: no external 3D models, no sound files, no fonts to download. Logic outside the browser-only folders imports in plain Node, so it's covered by `node --test`. [`CONTRACTS.md`](CONTRACTS.md) documents how the modules talk to each other.

## Credits

Made by Marco ([Marcoverse](https://marcoverse.co.uk)), starring Oli. All characters, art, music and sounds are original.
