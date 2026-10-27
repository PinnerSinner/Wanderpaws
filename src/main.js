// Gobblepaws entry point: boots every subsystem, owns the fixed-step loop and
// the run lifecycle, and routes sim events onto the bus.

import { GAME, SIM_DT } from './core/game.js';
import { createBus, EV } from './core/events.js';
import { createStorage } from './core/storage.js';
import { createSettings } from './core/settings.js';
import { t, setLocale } from './core/copy/index.js';
import { createLoop } from './core/loop.js';
import { createRng, hashString } from './core/rng.js';
import { Assets } from './assets/assets.js';

import { SPECIES, SPECIES_ORDER, getSpecies } from './animals/species.js';
import { COSMETICS } from './animals/cosmetics.js';
import { WORLDS, getWorld } from './worlds/index.js';
import { CATALOGUE } from './worlds/catalogue.js';
import { createSim } from './sim/index.js';
import { createRenderer } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './audio/index.js';
import { createDirector } from './dialogue/index.js';
import { createProfile } from './meta/index.js';
import { createInput } from './input/index.js';

const params = new URLSearchParams(location.search);

function boot() {
  document.title = GAME.name;
  const canvas = document.getElementById('game');
  const overlay = document.getElementById('float');
  const root = document.getElementById('ui');

  const storage = createStorage();
  const settings = createSettings(storage);
  if (params.has('quality')) settings.set('quality', params.get('quality'));
  if (params.has('reset')) storage.clearAll();
  setLocale(settings.get('locale'));

  const bus = createBus();
  const profile = createProfile(storage);
  const input = createInput({ element: document.body, settings, bus });
  const audio = createAudio({ settings, bus, assets: Assets });

  let sim = null;
  let run = null;
  let paused = false;
  let ghostSamples = null;

  const app = {
    GAME, bus, settings, profile, input, audio, t,
    renderer: null,
    data: { SPECIES, SPECIES_ORDER, WORLDS, CATALOGUE, COSMETICS },
    get state() { return sim ? sim.state : null; },
    get run() { return run; },
    get paused() { return paused; },
    startRun, restartRun, quitRun,
    pause() { if (!sim || paused) return; paused = true; bus.emit(EV.PAUSE, {}); },
    resume() { if (!paused) return; paused = false; bus.emit(EV.RESUME, {}); },
    showScene(kind, p) { renderer.showScene(kind, p); },
    enterPhoto() { renderer.enterPhoto(); },
    exitPhoto() { renderer.exitPhoto(); },
    screenshot() { return renderer.screenshot(); },
    saveClip() { return renderer.clip.save(); },
    uiSound(sound) { bus.emit('ui', { type: 'ui', sound }); },
  };

  const renderer = createRenderer({ canvas, overlay, settings, bus, app });
  app.renderer = renderer;

  const director = createDirector({ rng: createRng(hashString('director')), settings, bus });
  director.onLine((line) => {
    if (settings.get('chatter')) renderer.floatingText.add(line);
    audio.say(line);
  });

  const ui = createUI({ root, app });

  function dirCtx() {
    return { state: sim ? sim.state : null, worldId: run?.worldId, speciesId: run?.speciesId, playerName: run?.name || 'Oli' };
  }

  function dispatch(ev) {
    bus.emit(ev.type, ev);
    director.onEvent(ev, dirCtx());
    if (run) {
      const derived = profile.onRunEvent(ev, run) || [];
      for (const d of derived) dispatch(d);
    }
    if (ev.type === EV.FINISH) onFinish(ev);
  }

  function startRun({ worldId, speciesId, mode = 'story', seed, modifiers, daily = null }) {
    const world = getWorld(worldId);
    const species = getSpecies(speciesId);
    const look = profile.getLook(species.id);
    const name = profile.getName(species.id);
    const mods = { ...(profile.modifiers || {}), ...(modifiers || {}) };
    run = {
      worldId: world.id, speciesId: species.id, mode, name, modifiers: mods, daily,
      seed: seed ?? (mode === 'daily' && daily ? daily.seed : (Math.random() * 2 ** 32) >>> 0),
    };
    sim = createSim({
      world, species, look, mode, seed: run.seed,
      assist: settings.get('assist'), modifiers: mods, daily, playerName: name,
    });
    paused = false;
    ghostSamples = [];
    profile.setLastSpecies(species.id);
    director.reset(world.id);
    renderer.showScene('level', { world, sim, species, look, ghost: profile.ghost.load(world.id) });
    audio.music(world.music || world.id);
    ui.show('hud');
    flushSimEvents();
  }

  function restartRun() {
    if (!run) return;
    const { worldId, speciesId, mode, modifiers, daily } = run;
    startRun({ worldId, speciesId, mode, modifiers, daily, seed: mode === 'daily' ? run.seed : undefined });
  }

  function quitRun() {
    sim = null;
    run = null;
    paused = false;
    goTitle();
  }

  function onFinish(ev) {
    const result = ev.result || sim?.state.result;
    if (!result || !run) return;
    const summary = profile.finishRun(result, run);
    if (ghostSamples && (run.mode === 'speedrun' || run.mode === 'story')) {
      const best = profile.best(run.worldId);
      if (!best || !best.time || result.time <= best.time) profile.ghost.save(run.worldId, ghostSamples);
    }
    for (const a of summary.achievements || []) bus.emit(EV.ACHIEVEMENT, { type: EV.ACHIEVEMENT, id: a });
    for (const u of summary.newUnlocks || []) bus.emit(EV.UNLOCK, { type: EV.UNLOCK, ...u });
    setTimeout(() => ui.show('end', { result, summary, run: { ...run } }), 1400);
    audio.music('end');
  }

  function flushSimEvents() {
    if (!sim) return;
    const evs = sim.events;
    if (!evs.length) return;
    const copy = evs.slice();
    evs.length = 0;
    for (const ev of copy) dispatch(ev);
  }

  function goTitle() {
    const id = profile.lastSpecies || 'oli';
    renderer.showScene('title', { speciesId: id, look: profile.getLook(id) });
    audio.music('title');
    ui.show('title');
  }

  // Input: camera-relative world-space move for the sim
  const frameIn = { mx: 0, mz: 0, sprint: false, jump: false, jumpHeld: false, sig: false, sigHeld: false, bark: false, barkHeld: false, aimYaw: 0 };
  function buildFrame(raw) {
    const yaw = renderer.getCameraYaw();
    let x = raw.moveX, y = raw.moveY;
    if (run?.modifiers?.mirror) x = -x;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    frameIn.mx = x * -c + y * s;
    frameIn.mz = x * s + y * c;
    const len = Math.hypot(frameIn.mx, frameIn.mz);
    if (len > 1) { frameIn.mx /= len; frameIn.mz /= len; }
    frameIn.sprint = raw.sprint || settings.get('autoSprint');
    frameIn.jump = raw.jump; frameIn.jumpHeld = raw.jumpHeld;
    frameIn.sig = raw.sig; frameIn.sigHeld = raw.sigHeld;
    frameIn.bark = raw.bark; frameIn.barkHeld = raw.barkHeld;
    frameIn.aimYaw = yaw;
    return frameIn;
  }

  let wasPausePressed = false;
  function step() {
    const raw = input.poll();
    if (raw.pause && !wasPausePressed && sim) {
      if (renderer.isPhoto()) { renderer.exitPhoto(); ui.show('pause'); }
      else if (paused) { app.resume(); ui.show('hud'); }
      else if (sim.state.phase !== 'finished') { app.pause(); ui.show('pause'); }
    }
    wasPausePressed = raw.pause;
    if (raw.photo && sim && !renderer.isPhoto()) { app.pause(); renderer.enterPhoto(); ui.show('photo'); }

    if (sim && !paused) {
      sim.step(buildFrame(raw));
      if (ghostSamples && (sim.state.tick & 1) === 0 && ghostSamples.length < 40000) {
        const p = sim.state.player;
        ghostSamples.push(Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), Math.round(p.yaw * 1000), Math.round(p.displaySize * 1000));
      }
      flushSimEvents();
      director.tick(SIM_DT, dirCtx());
    } else {
      director.tick(SIM_DT, dirCtx());
    }
  }

  let fpsAcc = 0, fpsN = 0;
  function render(alpha, dtReal) {
    const look = input.consumeLook();
    if (look.dx || look.dy) renderer.addLook(look.dx, look.dy);
    const state = sim ? sim.state : null;
    renderer.frame(alpha, dtReal, state);
    ui.frame(dtReal, state);
    const p = state?.player;
    audio.tick(dtReal, state, p ? { x: p.x, z: p.z, yaw: renderer.getCameraYaw() } : null);
    fpsAcc += dtReal; fpsN++;
    if (fpsAcc > 1) { window.__gp.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  }

  const loop = createLoop({ step, render });

  // First gesture unlocks audio
  const unlock = () => { audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  window.addEventListener('resize', () => renderer.resize());

  // Portrait phones get the "turn sideways" overlay (pure CSS in index.html)

  // Automation hooks for headless screenshots and tests
  window.__gp = {
    app, ui, renderer, profile, settings, bus, loop, fps: 0,
    get sim() { return sim; },
    start: (o) => startRun(o),
    show: (screen, p) => ui.show(screen, p),
    stepTicks(n, inputOverride) {
      for (let i = 0; i < n; i++) {
        if (!sim) break;
        sim.step(inputOverride || buildFrame(input.poll()));
        flushSimEvents();
      }
    },
  };

  loop.start();

  // Deep links: ?screen=journal, ?world=w2&species=cat&mode=chill, ?autoplay=1
  const screen = params.get('screen');
  if (params.has('world') || params.get('autoplay')) {
    startRun({
      worldId: params.get('world') || 'w1',
      speciesId: params.get('species') || profile.lastSpecies || 'oli',
      mode: params.get('mode') || 'story',
      seed: params.has('seed') ? Number(params.get('seed')) : undefined,
    });
  } else {
    goTitle();
    if (screen && screen !== 'title') {
      const sp = params.get('species');
      if (screen === 'dressing' || screen === 'animals') renderer.showScene('showroom', { speciesId: sp || 'oli', look: profile.getLook(sp || 'oli') });
      ui.show(screen, sp ? { speciesId: sp } : {});
    }
  }
  document.body.classList.add('ready');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
