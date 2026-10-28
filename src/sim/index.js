// Gobblepaws gameplay simulation. Node-importable, deterministic (seeded rng
// only, never the clock), fixed 60 Hz, and allocation-free in the step apart
// from the event objects it emits. See CONTRACTS §3 for the public shape.
import { SIM_DT } from '../core/game.js';
import { createRng } from '../core/rng.js';
import { EV } from '../core/events.js';
import { CATALOGUE } from '../worlds/catalogue.js';
import { TUNE } from './tune.js';
import { createTerrain } from './terrain.js';
import { createColliders, passMaskFor } from './collide.js';
import { createItems } from './items.js';
import { updateGobbleFlags, tryGobble, processCompleted, tickCombo } from './gobble.js';
import { stepPlayer, updateDerived, topSpeedFor } from './player.js';
import { createSigMods, resetSigMods, stepSignature } from './signature.js';
import { createNpcs, stepNpcs, stepProjectiles, npcPush } from './npcs.js';
import { createBirds, stepBirds } from './boids.js';
import { createHazards, stepHazards, resetHazMods, hazardColliders, touchHazard, onWall } from './hazards.js';
import { createWeather, stepWeather } from './weather.js';
import { createActivities, stepActivities } from './activities.js';
import { createEggs, dispatchEggs, tickEggs } from './eggs.js';
import { initModes, stepModes, finishRun } from './modes.js';
import { stepIdle, stepEmotion } from './idle.js';
import { hashNumbers } from './util.js';

export { TUNE } from './tune.js';

const NO_INPUT = Object.freeze({ mx: 0, mz: 0, sprint: false, jump: false, jumpHeld: false, sig: false, sigHeld: false, bark: false, barkHeld: false, aimYaw: 0 });

export function createSim(opts = {}) {
  const world = opts.world;
  const species = opts.species;
  if (!world || !species) throw new Error('createSim needs a world and a species');
  const mode = opts.mode || 'story';
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const daily = opts.daily || null;
  const modifiers = { ...(opts.modifiers || {}) };
  if (daily && daily.modifier) modifiers[daily.modifier] = true;

  const rng = createRng(seed ^ 0x5eed);
  const S = {
    world, species, look: opts.look || null, mode, seed, assist: !!opts.assist, modifiers, daily,
    playerName: opts.playerName || 'Oli', catalogue: CATALOGUE,
    rng, rngFx: rng.fork('fx'), rngIdle: rng.fork('idle'), rngAI: null,
    events: [],
    debug: { launches: 0, maxItemSpeedRatio: 0, fillRejects: 0, gobbleStarts: 0, dominoes: 0, warnings: [], eggErrors: [], launchLog: [] },
    gravityScale: modifiers.lowGravity ? TUNE.lowGravity : 1,
    growthK: (world.goals && world.goals.growthK) || 1,
    completed: null, nCompleted: 0,
    sigMods: createSigMods(),
    hazMods: resetHazMods({}),
    derived: { top: 1, topSprint: 1, gravity: 1, radius: 0.1, height: 0.1, stepUp: 0.1, effSize: 1, T: 0, almostT: 0, reachBase: 0 },
    emptyZone: Object.freeze({ inside: false, time: 0 }),
    passMask: passMaskFor(species),
  };
  S.emit = (ev) => { S.events.push(ev); return ev; };
  S.warn = (msg) => { if (S.debug.warnings.length < 50) S.debug.warnings.push(msg); };

  S.terrain = createTerrain(world);
  S.col = createColliders(world, S.terrain, hazardColliders(world));

  const g = world.goals || {};
  const startSize = (g.start || 0.25) * ((species.stats && species.stats.startSize) || 1);
  S.startSize = startSize;
  S.milestones = (g.milestones || []).slice().sort((a, b) => a - b);
  const sp = world.spawn || { x: 0, z: 0, yaw: 0 };

  const sigDef = species.signature || { kind: 'sniffBoost' };
  const player = {
    x: +sp.x || 0, y: 0, z: +sp.z || 0, yaw: +sp.yaw || 0, px: 0, py: 0, pz: 0, pyaw: 0,
    vx: 0, vy: 0, vz: 0, speed: 0, speedNorm: 0,
    size: startSize, displaySize: startSize,
    grounded: true, airborne: false, inWater: false, waterDepth: 0, surface: 'grass',
    sprinting: false, turnRate: 0, landImpact: 0, gulp: 0, stagger: 0,
    sig: { kind: sigDef.kind, active: false, t: 0, cooldownLeft: 0, ready: false, aimYaw: 0, power: 0, phase: null, chargeT: 0, tx: null, tz: null, target: -1, radius: 0, bars: 1, count: 0, dur: 0, speed: 0, hs: 0, icy: false, theta0: 0 },
    emotion: 'happy', idleTime: 0, idleAnim: null,
    barkT: 99, playBow: false, shakeT: 0,
    buffs: { tea: 0, wobble: 0, speed: 0, bighead: modifiers.bigHead ? 1e9 : 0 },
    combo: { count: 0, mult: 1, timer: 0 },
    reach: 0, lag: 0, swimming: false,
  };
  player.y = S.terrain.heightAt(player.x, player.z);
  player.px = player.x; player.py = player.y; player.pz = player.z; player.pyaw = player.yaw;

  const camHint = { kind: 'milestone', t: 0 };
  const state = {
    tick: 0, time: 0, phase: 'intro', introLeft: TUNE.introTime,
    timeLeft: null, worldId: world.id, mode, speciesId: species.id, playerName: S.playerName, modifiers,
    goals: null, stars: [false, false, false],
    starProgress: { hazardsTouched: 0, collected: {}, maxCombo: 0 },
    result: null, slowMo: 0,
    player, items: null, npcs: null, birds: null, projectiles: null, hazards: null,
    weather: { kind: 'clear', t: 0, intensity: 0 },
    tide: 0, zones: {}, flags: {}, activity: null, camHint: null,
  };
  S.state = state;
  S.setCamHint = (kind, t) => { camHint.kind = kind; camHint.t = t; state.camHint = camHint; };
  S.buff = (kind, secs) => {
    const b = state.player.buffs;
    b[kind] = Math.max(b[kind] || 0, +secs || 0);
    S.emit({ type: EV.BUFF, kind, duration: +secs || 0 });
  };

  S.run = {
    moveSpeed: 0, zoom: 0, coyote: 0, jumpBuf: 0, jumping: false, airT: 0, swimming: false, swimJump: false,
    inputMag: 0, inputYaw: 0, wallHit: 0, blockedT: 0, landedThisTick: false,
    wetT: 0, dryT: 0, wasInWater: false, stillT: 0, distance: 0, footDist: 0, footSide: 0,
    barked: false, barkHolding: false, barkHoldT: 0, barks: 0, playBowWas: false,
    bumpCd: 0, almostCd: 0, scaredT: 0, proudT: 0, happyT: 0, slowMoT: 0,
    idleNext: TUNE.idleStart, idleAnimT: 0, lastIdle: null,
    gobbled: 0, biccies: 0, score: 0, sigUses: 0, activitiesDone: 0,
    hazardsTouched: 0, pigeonsScared: 0, goldenFound: [], eggsFound: [],
    typeSeen: new Uint8Array(64),
    ringIdx: new Int32Array(24), ringVol: new Float64Array(24), ringHead: 0, ringLen: 0,
    nextMilestone: 0, reachedGoal: false, reachedStretch: false, goalTime: null, stretchTime: null, playTime: 0,
    slideV: 0,
  };
  while (S.run.nextMilestone < S.milestones.length && S.milestones[S.run.nextMilestone] <= startSize) S.run.nextMilestone++;

  // items
  S.items = createItems(S);
  S.I = S.items.I; S.X = S.items.X;
  state.items = S.I;
  S.completed = new Int32Array(S.I.count);
  S.scratchIdx = new Int32Array(Math.max(256, S.I.count));
  S.scratchIdx2 = new Int32Array(Math.max(256, S.I.count));
  S.scratchD = new Float64Array(Math.max(256, S.I.count));
  S.typeBlocked = new Uint8Array(S.I.types.length + 16);
  S.noGobbleKey = S.I.types.map((t) => 'nogobble:' + t);
  if (S.run.typeSeen.length < S.I.types.length + 16) S.run.typeSeen = new Uint8Array(S.I.types.length + 16);

  // living things
  S.npcs = createNpcs(S);
  S.birds = createBirds(S);
  S.hazards = createHazards(S);
  S.activities = createActivities(S);
  state.npcs = S.npcs.list;
  state.birds = S.birds.B;
  state.projectiles = S.npcs.P;
  state.hazards = S.hazards.pub;
  S.npcPush = npcPush;
  S.touchHazard = (hi, x, z, s) => touchHazard(S, hi, x, z, s);
  S.onWall = (ci, vn) => onWall(S, ci, vn);

  S.weatherCtl = createWeather(S);
  initModes(S);
  if (state.goals.growthK) S.growthK = state.goals.growthK;
  S.growthDamp = g.growthDamp != null ? +g.growthDamp : TUNE.growthDamp;

  // zones
  const zoneList = [];
  for (const z of world.zones || []) {
    if (!z || !z.id) continue;
    const o = { inside: false, time: 0 };
    state.zones[z.id] = o;
    zoneList.push({ x: +z.x || 0, z: +z.z || 0, r: +z.r || 3, o });
  }

  updateDerived(S);
  updateGobbleFlags(S);
  player.reach = S.derived.reachBase;
  S.derived.top = topSpeedFor(player.size, species.stats.speed);

  S.eggTea = (world.eggs || []).some((e) => e && e.id === 'G8');
  S.eggs = createEggs(S);
  S.emit({ type: EV.INTRO, worldId: world.id, mode, speciesId: species.id });
  dispatchEggs(S, 0);

  function step(inp) {
    const st = S.state, p = st.player, R = S.run;
    const from = S.events.length;
    let input = inp || NO_INPUT;
    if (st.phase !== 'play') input = st.phase === 'intro' ? introInput(inp) : NO_INPUT;
    // milestone slow-mo: a short, deterministic stretch of sim time
    if (R.slowMoT > 0) { R.slowMoT -= SIM_DT; st.slowMo = Math.max(0, R.slowMoT / TUNE.slowMoTime); } else st.slowMo = 0;
    const dt = SIM_DT * (1 - (1 - TUNE.slowMoRate) * st.slowMo);
    st.tick++;
    st.time += dt;
    R.landedThisTick = false;
    p.px = p.x; p.py = p.y; p.pz = p.z; p.pyaw = p.yaw;
    S.terrain.update(st.time);
    S.col.updateFlags(st.flags);
    st.tide = S.terrain.tide;

    resetSigMods(S.sigMods);
    updateDerived(S);
    stepSignature(S, input, dt);
    updateGobbleFlags(S);
    resetHazMods(S.hazMods);
    stepHazards(S, dt);
    stepPlayer(S, input, dt);
    p.lag = S.hazMods.lag;
    p.swimming = R.swimming;
    tryGobble(S);
    S.items.step(dt);
    processCompleted(S);
    tickCombo(S, dt);
    stepNpcs(S, dt);
    stepProjectiles(S, dt);
    stepBirds(S, dt);
    stepWeather(S, dt);
    stepActivities(S, dt);
    stepIdle(S, dt);
    stepEmotion(S, dt);
    for (let k = 0; k < zoneList.length; k++) {
      const z = zoneList[k];
      const dx = p.x - z.x, dz = p.z - z.z;
      const inside = dx * dx + dz * dz <= z.r * z.r;
      z.o.inside = inside;
      z.o.time = inside ? z.o.time + dt : 0;
    }
    stepModes(S, dt);
    tickEggs(S, dt);
    // decays
    if (p.gulp > 0) p.gulp = Math.max(0, p.gulp - dt / 0.35);
    if (p.landImpact > 0) p.landImpact = Math.max(0, p.landImpact - dt * 3);
    if (p.stagger > 0) p.stagger = Math.max(0, p.stagger - dt);
    if (R.bumpCd > 0) R.bumpCd -= dt;
    if (R.almostCd > 0) R.almostCd -= dt;
    const b = p.buffs;
    if (b.tea > 0) b.tea = Math.max(0, b.tea - dt);
    if (b.wobble > 0) b.wobble = Math.max(0, b.wobble - dt);
    if (b.speed > 0) b.speed = Math.max(0, b.speed - dt);
    if (b.bighead > 0 && b.bighead < 1e8) b.bighead = Math.max(0, b.bighead - dt);
    p.displaySize += (p.size - p.displaySize) * (1 - Math.exp(-6 * dt));
    if (st.camHint) { st.camHint.t -= dt; if (st.camHint.t <= 0) st.camHint = null; }
    dispatchEggs(S, from);
  }

  const introIn = { mx: 0, mz: 0, sprint: false, jump: false, jumpHeld: false, sig: false, sigHeld: false, bark: false, barkHeld: false, aimYaw: 0 };
  function introInput(inp) {
    // you can bark and look about during the intro, but not go anywhere
    if (!inp) return NO_INPUT;
    introIn.bark = !!inp.bark; introIn.barkHeld = !!inp.barkHeld; introIn.aimYaw = inp.aimYaw || 0;
    return introIn;
  }

  const sim = {
    state, events: S.events, debug: S.debug,
    step,
    finish(reason = 'quit') { finishRun(S, reason); },
    hash() { return stateHash(state); },
    _S: S, // internals, for tests and tools only
  };
  return sim;
}

// Deterministic fingerprint of the state, for determinism tests and ghosts.
export function stateHash(state) {
  let h = 0x811c9dc5;
  const p = state.player;
  h = hashNumbers(h, state.tick);
  h = hashNumbers(h, p.x); h = hashNumbers(h, p.y); h = hashNumbers(h, p.z); h = hashNumbers(h, p.yaw); h = hashNumbers(h, p.size);
  h = hashNumbers(h, p.combo.count);
  const I = state.items;
  for (let i = 0; i < I.count; i++) { h = hashNumbers(h, I.x[i]); h = hashNumbers(h, I.y[i]); h = hashNumbers(h, I.z[i]); h = hashNumbers(h, I.state[i]); }
  for (const n of state.npcs) { h = hashNumbers(h, n.x); h = hashNumbers(h, n.z); }
  const B = state.birds;
  for (let i = 0; i < B.count; i++) { h = hashNumbers(h, B.x[i]); h = hashNumbers(h, B.y[i]); h = hashNumbers(h, B.z[i]); }
  h = hashNumbers(h, state.stars[0] ? 1 : 0); h = hashNumbers(h, state.stars[1] ? 1 : 0); h = hashNumbers(h, state.stars[2] ? 1 : 0);
  return h >>> 0;
}
